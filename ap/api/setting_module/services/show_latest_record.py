import os
import re
import time
from contextlib import suppress
from functools import lru_cache
from itertools import islice
from typing import Any, List, Tuple

import pandas as pd
from flask_babel import get_locale

from ap.api.efa.services.etl import detect_file_path_delimiter, preview_data
from ap.api.setting_module.services.csv_import import convert_csv_timezone, gen_dummy_header
from ap.api.setting_module.services.data_import import (
    PANDAS_DEFAULT_NA,
    strip_special_symbol,
    validate_datetime,
)
from ap.api.setting_module.services.v2_etl_services import (
    get_df_v2_process_single_file,
    get_preview_processes_v2,
    get_v2_datasource_type_from_file,
    get_vertical_df_v2_process_single_file,
    is_v2_data_source,
    rename_abnormal_history_col_names,
    rename_sub_part_no,
)
from ap.common.common_utils import (
    get_csv_delimiter,
    get_sorted_files,
    get_sorted_files_by_size,
    get_sorted_files_by_size_and_time,
    remove_non_ascii_chars,
)
from ap.common.constants import (
    DATETIME_DUMMY,
    EMPTY_STRING,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    PREVIEW_DATA_TIMEOUT,
    REVERSED_WELL_KNOWN_COLUMNS,
    SUB_PART_NO_PREFIX,
    SUB_PART_NO_SUFFIX,
    WR_HEADER_NAMES,
    WR_TYPES,
    WR_VALUES,
    DataGroupType,
    DataType,
    DBType,
    RelationShip,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.pydn.dblib import mssqlserver, oracle
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import (
    check_exception_case,
    get_delimiter_encoding,
    is_normal_csv,
    read_data,
)
from ap.common.services.csv_header_wrapr import gen_colsname_for_duplicated
from ap.common.services.data_type import gen_data_types
from ap.common.services.jp_to_romaji_utils import change_duplicated_columns, to_romaji
from ap.common.services.normalization import (
    normalize_big_rows,
    normalize_list,
    normalize_str,
    unicode_normalize,
)
from ap.common.timezone_utils import gen_dummy_datetime
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    CfgProcessColumn,
    CfgVisualization,
    crud_config,
    make_session,
)
from ap.setting_module.schemas import VisualizationSchema
from ap.trace_data.transaction_model import TransactionData


def get_latest_records(data_source_id, table_name, file_name=None, directory=None, limit=5):
    is_v2_datasource = False
    previewed_files = None
    cols_with_types = []
    filtered_process_name = False
    delimiter = 'Auto'
    skip_head = ''
    etl_func = ''

    if data_source_id:
        data_source = CfgDataSource.query.get(data_source_id)
        if not data_source_id:
            return None
        is_v2_datasource = is_v2_data_source(ds_type=data_source.type)
        is_csv_or_v2 = data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]
        csv_detail = data_source.csv_detail
        filtered_process_name = csv_detail.process_name or False
        directory = csv_detail.directory
        delimiter = csv_detail.delimiter
        etl_func = csv_detail.etl_func
        skip_head = '' if (csv_detail.skip_head == 0 and not csv_detail.dummy_header) else csv_detail.skip_head
    else:
        is_csv_or_v2 = True

    if is_csv_or_v2:
        if is_v2_datasource:
            dic_preview = preview_v2_data(
                directory,
                delimiter,
                limit,
                return_df=True,
                process_name=filtered_process_name,
                file_name=file_name,
            )
        else:
            dic_preview = preview_csv_data(
                directory,
                etl_func,
                delimiter,
                limit,
                return_df=True,
                max_records=1000,
                file_name=file_name,
                line_skip=skip_head,
            )
        column_raw_name = dic_preview.get('org_headers')
        headers = normalize_list(dic_preview.get('header'))
        headers = [normalize_str(col) for col in headers]
        data_types = dic_preview.get('dataType')
        same_values = dic_preview.get('same_values')
        is_v2_history = dic_preview.get('v2_type') == DBType.V2_HISTORY
        if headers and data_types:
            cols_with_types = gen_cols_with_types(headers, data_types, same_values, is_v2_history, column_raw_name)

        # sort columns
        # sorted(csv_detail.csv_columns, key=lambda c: c.order or c.id)
        # cols = {col.column_name for col in sorted_columns if col.column_name in headers}
        cols = headers

        # get rows
        df_rows = dic_preview.get('content', None)
        previewed_files = dic_preview.get('previewed_files')
    else:
        cols, df_rows = get_info_from_db(data_source, table_name)
        data_types = [gen_data_types(df_rows[col]) for col in cols]
        same_values = check_same_values_in_df(df_rows, cols)
        if cols and data_types:
            cols_with_types = gen_cols_with_types(cols, data_types, same_values)
        # format data
        df_rows = convert_utc_df(df_rows, cols, data_types, data_source, table_name)

    # change name if romaji cols is duplicated
    cols_with_types, cols_duplicated = change_duplicated_columns(cols_with_types)
    has_ct_col = True
    dummy_datetime_idx = None
    if DataType.DATETIME.value not in data_types:
        dummy_datetime_idx = 0
        cols_with_types.insert(
            dummy_datetime_idx,
            {
                'name': DATETIME_DUMMY,
                'type': DataType.DATETIME.name,
                'romaji': DATETIME_DUMMY,
                'is_date': True,
                'check_same_value': {'is_null': False, 'is_same': False},
            },
        )
        cols.insert(dummy_datetime_idx, DATETIME_DUMMY)
        if is_valid_list(df_rows):
            df_rows = gen_dummy_datetime(df_rows)

    if DATETIME_DUMMY in cols or DataType.DATETIME.value not in data_types:
        dummy_datetime_idx = 0
        has_ct_col = False

    rows = []
    if is_valid_list(df_rows):
        data_type_by_cols = {}
        for col_data in cols_with_types:
            data_type_by_cols[col_data['column_name']] = col_data['data_type']
        # convert to correct dtypes
        for col in df_rows.columns:
            try:
                if data_type_by_cols[col] == DataType.INTEGER.name:
                    df_rows[col] = df_rows[col].astype('float64').astype('Int64')

                if data_type_by_cols[col] == DataType.TEXT.name:
                    # fill na to '' for string column
                    df_rows[col] = df_rows[col].astype('string').fillna('')
            except Exception:
                continue
        rows = transform_df_to_rows(cols, df_rows, limit)
    return cols_with_types, rows, cols_duplicated, previewed_files, has_ct_col, dummy_datetime_idx


# def get_col_type_as_cast(col_type):
#     if col_type == DataType.TEXT.name:
#         return 'str'
#
#     if col_type == DataType.REAL.name:
#         return 'float64'
#
#     if col_type == DataType.INTEGER.name:
#         return 'int64'
#
#     return None


# def gen_data_types_from_factory_type(cols, cols_with_types):
#     dic_col_type = {col.get('name'): guess_data_types(col.get('type')) for col in cols_with_types}
#     return [dic_col_type.get(col) for col in cols]


@lru_cache(maxsize=20)
def get_info_from_db(data_source, table_name, sql_limit: int = 2000):
    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], []

        if isinstance(db_instance, mssqlserver.MSSQLServer):
            cols, rows = db_instance.run_sql('select TOP {}  * from "{}"'.format(sql_limit, table_name), False)
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                'select * from "{}" where rownum <= {}'.format(table_name, sql_limit),
                False,
            )
        else:
            cols, rows = db_instance.run_sql('select * from "{}" limit {}'.format(table_name, sql_limit), False)

    cols = normalize_list(cols)
    df_rows = normalize_big_rows(rows, cols, strip_quote=False)
    return cols, df_rows


@log_execution_time()
def get_last_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    trans_data = TransactionData(cfg_col.process_id)
    col_name = cfg_col.bridge_column_name
    with DbProxy(gen_data_source_of_universal_db(cfg_col.process_id), True) as db_instance:
        unique_sensor_vals = trans_data.select_distinct_data(db_instance, col_name, limit=1000)

    return unique_sensor_vals


def save_master_vis_config(proc_id, cfg_jsons):
    vis_schema = VisualizationSchema()

    with make_session() as meta_session:
        proc: CfgProcess = meta_session.query(CfgProcess).get(proc_id or -1)
        if proc:
            cfg_vis_data = []
            for cfg_json in cfg_jsons:
                cfg_vis_data.append(vis_schema.load(cfg_json))
            crud_config(
                meta_session=meta_session,
                data=cfg_vis_data,
                model=CfgVisualization,
                key_names=CfgVisualization.id.key,
                parent_key_names=CfgVisualization.process_id.key,
                parent_obj=proc,
                parent_relation_key=CfgProcess.visualizations.key,
                parent_relation_type=RelationShip.MANY,
            )


@log_execution_time()
def preview_csv_data(
    folder_url,
    etl_func,
    csv_delimiter,
    limit,
    return_df=False,
    max_records=5,
    file_name=None,
    line_skip=None,
):
    csv_delimiter = get_csv_delimiter(csv_delimiter)

    if not file_name:
        sorted_files = get_sorted_files(folder_url)
        sorted_files = sorted_files[0:5]
    else:
        sorted_files = [file_name]

    dummy_header = False
    csv_file = ''
    skip_head = 0 if not line_skip else int(line_skip)
    skip_tail = 0
    header_names = []
    data_types = []
    data_details = []
    same_values = []
    if not sorted_files:
        return {
            'file_name': csv_file,
            'header': header_names,
            'content': [] if return_df else data_details,
            'dataType': data_types,
            'skip_head': line_skip,
            'skip_tail': skip_tail,
            'previewed_files': sorted_files,
            'same_values': same_values,
        }

    csv_file = sorted_files[0]

    # call efa etl
    has_data_file = None
    encoding = None
    if etl_func:
        # try to get file which has data to detect data types + get col names
        for file_path in sorted_files:
            preview_file_path = preview_data(file_path)
            if preview_file_path and not isinstance(preview_file_path, Exception):
                has_data_file = True
                csv_file = preview_file_path
                csv_delimiter = detect_file_path_delimiter(csv_file, csv_delimiter)
                break

        if has_data_file:
            for i in range(2):
                data = None
                try:
                    data = read_data(csv_file, delimiter=csv_delimiter, do_normalize=False)
                    header_names = next(data)

                    # strip special symbols
                    if i == 0:
                        data = strip_special_symbol(data)

                    # get 5 rows
                    data_details = list(islice(data, 1000))
                finally:
                    if data:
                        data.close()

                if data_details:
                    break
    elif is_normal_csv(csv_file, csv_delimiter, skip_head=skip_head):
        header_names, data_details, encoding = retrieve_data_from_several_files(
            folder_url,
            csv_delimiter,
            max_records,
            csv_file,
            skip_head=skip_head,
        )
    else:
        # try to get file which has data to detect data types + get col names
        dic_file_info, csv_file = get_etl_good_file(sorted_files)
        if dic_file_info and csv_file:
            skip_head = chw.get_skip_head(dic_file_info)
            skip_tail = chw.get_skip_tail(dic_file_info)
            header_names = chw.get_columns_name(dic_file_info)
            etl_headers = chw.get_etl_headers(dic_file_info)
            data_types = chw.get_data_type(dic_file_info)
            for i in range(2):
                data = None
                try:
                    data = read_data(
                        csv_file,
                        headers=header_names,
                        skip_head=skip_head,
                        delimiter=csv_delimiter,
                        do_normalize=False,
                    )
                    # non-use header
                    next(data)

                    # strip special symbols
                    if i == 0:
                        data = strip_special_symbol(data)

                    # get 5 rows
                    data_details = list(islice(data, limit + skip_tail))
                    data_details = data_details[: len(data_details) - skip_tail]
                finally:
                    if data:
                        data.close()

                if data_details:
                    break

            # Merge heads with Machine, Line, Process
            if etl_headers[WR_VALUES]:
                header_names += etl_headers[WR_HEADER_NAMES]
                data_types += etl_headers[WR_TYPES]
                data_details = chw.merge_etl_heads(etl_headers[WR_VALUES], data_details)

    # generate column name if there is not header in file
    org_header, header_names, dummy_header, data_details = gen_dummy_header(header_names, data_details, line_skip)

    # normalize data detail
    df_data_details, org_headers, header_names, dupl_cols, data_types = extract_data_detail(
        header_names,
        data_details,
        org_header,
    )
    has_ct_col = True
    dummy_datetime_idx = None
    if df_data_details is not None:
        # sort by datetime
        first_datetime_col_idx = None
        # convert utc
        for col, dtype in zip(header_names, data_types):
            if DataType(dtype) is not DataType.DATETIME:
                continue
            # Convert UTC time
            validate_datetime(df_data_details, col, False, False)
            convert_csv_timezone(df_data_details, col)
            df_data_details.dropna(subset=[col], inplace=True)

            if not first_datetime_col_idx:
                # first ct column is selected as datetime column
                # append datetime to start of list columns
                # and sort preview rows by datetime value
                df_data_details = df_data_details.sort_values(col)
                first_datetime_col_idx = header_names.index(col)

        df_data_details = df_data_details[0:limit]
        if DataType.DATETIME.value not in data_types and DATETIME_DUMMY not in df_data_details.columns:
            dummy_datetime_idx = 0
            df_data_details = gen_dummy_datetime(df_data_details)
            data_types.insert(dummy_datetime_idx, DataType.DATETIME.value)
            header_names.insert(dummy_datetime_idx, DATETIME_DUMMY)
            org_headers.insert(dummy_datetime_idx, DATETIME_DUMMY)
            has_ct_col = False
        elif first_datetime_col_idx:
            header_names = re_order_items_by_datetime_idx(first_datetime_col_idx, header_names)
            data_types = re_order_items_by_datetime_idx(first_datetime_col_idx, data_types)
            org_headers = re_order_items_by_datetime_idx(first_datetime_col_idx, org_headers)
            df_data_details = df_data_details[header_names]

        same_values = check_same_values_in_df(df_data_details, header_names)

        if not return_df:
            df_data_details = df_data_details.to_records(index=False).tolist()
    elif not return_df:
        df_data_details = []

    if csv_file:
        csv_file = csv_file.replace('/', os.sep)

    has_dupl_cols = False
    if len(dupl_cols) and same_values:
        if dummy_datetime_idx is not None:
            # for dummy datetime column
            dupl_cols = [False] + dupl_cols
        for key, value in enumerate(same_values):
            is_dupl_col = bool(dupl_cols[key])
            same_values[key]['is_dupl'] = is_dupl_col
            if is_dupl_col:
                has_dupl_cols = True

    return {
        'file_name': csv_file,
        'header': header_names,
        'content': df_data_details,
        'dataType': data_types,
        'skip_head': 0 if dummy_header else line_skip,
        'skip_tail': skip_tail,
        'previewed_files': sorted_files,
        'has_ct_col': has_ct_col,
        'dummy_datetime_idx': dummy_datetime_idx,
        'same_values': [{key: bool(value) for key, value in same_value.items()} for same_value in same_values],
        'has_dupl_cols': False if dummy_header else has_dupl_cols,
        'org_headers': org_headers,
        'encoding': encoding,
        'is_dummy_header': dummy_header,
    }


@log_execution_time()
def preview_v2_data(folder_url, csv_delimiter, limit, return_df=False, process_name=None, file_name=None):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files_by_size(folder_url) if not file_name else [file_name]
    encoding = None
    csv_file = ''
    skip_head = 0
    skip_tail = 0
    header_names = []
    data_types = []
    data_details = []
    same_values = []
    v2_process_names = []
    if not sorted_files:
        return {
            'file_name': csv_file,
            'header': header_names,
            'content': [] if return_df else data_details,
            'dataType': data_types,
            'skip_head': skip_head,
            'skip_tail': skip_tail,
            'previewed_files': sorted_files,
            'same_values': same_values,
            'encoding': encoding,
        }

    is_abnormal_v2 = None
    datasource_type = None
    if process_name:
        # V2 preview with the largest file
        file_data_idx = 0
        while file_data_idx >= 0:
            largest_file = sorted_files[file_data_idx]
            _, encoding = get_delimiter_encoding(largest_file, preview=True)
            datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(largest_file)

            if datasource_type == DBType.V2_HISTORY:
                data_details = get_df_v2_process_single_file(
                    largest_file,
                    process_name,
                    datasource_type,
                    is_abnormal_v2,
                )
            elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
                data_details = get_vertical_df_v2_process_single_file(
                    largest_file,
                    process_name,
                    datasource_type,
                    is_abnormal_v2,
                    is_en_cols,
                )
            else:
                raise NotImplementedError

            file_data_idx += 1
            if len(data_details) > 0 or file_data_idx >= len(sorted_files):
                file_data_idx = -1

        data_details = data_details[:1000]
        header_names = data_details.columns.tolist()

    if not len(header_names):
        v2_process_names = get_preview_processes_v2(
            sorted_files,
            maximum_files=MAXIMUM_V2_PREVIEW_ZIP_FILES,
        )

        csv_file = sorted_files[0]
        _, encoding = get_delimiter_encoding(csv_file, preview=True)
        for i in range(2):
            data = None
            try:
                data = read_data(csv_file, delimiter=csv_delimiter, do_normalize=False)
                header_names = next(data)

                # strip special symbols
                if i == 0:
                    data = strip_special_symbol(data)

                # get 5 rows
                data_details = list(islice(data, 1000))
            finally:
                if data:
                    data.close()

            if data_details:
                break

    org_headers = header_names.copy()
    # normalization
    header_names = normalize_list(header_names)

    if process_name:
        data_details, *_ = rename_sub_part_no(pd.DataFrame(data_details), datasource_type)
        header_names = data_details.columns.tolist()

    # get DB Type and check if there is abnormal history
    if is_abnormal_v2 is None and not datasource_type:
        datasource_type, is_abnormal_v2, _ = get_v2_datasource_type_from_file(csv_file)
    header_names = rename_abnormal_history_col_names(datasource_type, header_names, is_abnormal_v2)
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names)
    data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]
    df_data_details, org_headers, header_names, dupl_cols, data_types = drop_null_header_column(
        df_data_details,
        org_headers,
        header_names,
        dupl_cols,
        data_types,
    )
    has_ct_col = True
    dummy_datetime_idx = None
    if df_data_details is not None:
        # convert utc
        for col, dtype in zip(header_names, data_types):
            if DataType(dtype) is not DataType.DATETIME:
                continue
            # Convert UTC time
            validate_datetime(df_data_details, col, False, False)
            convert_csv_timezone(df_data_details, col)
            df_data_details.dropna(subset=[col], inplace=True)
            # TODO: can we do this faster?
            data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]

        df_data_details = df_data_details[0:limit]
        if DataType.DATETIME.value not in data_types and DATETIME_DUMMY not in df_data_details.columns:
            dummy_datetime_idx = 0
            df_data_details = gen_dummy_datetime(df_data_details)
            data_types.insert(dummy_datetime_idx, DataType.DATETIME.value)
            header_names.insert(dummy_datetime_idx, DATETIME_DUMMY)
            org_headers.insert(dummy_datetime_idx, DATETIME_DUMMY)
            has_ct_col = False

        same_values = check_same_values_in_df(df_data_details, header_names)

        if not return_df:
            df_data_details = df_data_details.to_records(index=False).tolist()
    elif not return_df:
        df_data_details = []

    if csv_file:
        csv_file = csv_file.replace('/', os.sep)

    has_dupl_cols = False
    if len(dupl_cols) and same_values:
        if dummy_datetime_idx is not None:
            # for dummy datetime column
            dupl_cols = [False] + dupl_cols
        for key, value in enumerate(same_values):
            is_dupl_col = bool(dupl_cols[key])
            same_values[key]['is_dupl'] = is_dupl_col
            if is_dupl_col:
                has_dupl_cols = True

    # # replace NA in df to empty
    if not isinstance(df_data_details, list):
        df_data_details = df_data_details.replace(list(PANDAS_DEFAULT_NA), '')
    return {
        'file_name': csv_file,
        'v2_processes': v2_process_names,
        'header': header_names,
        'content': df_data_details,
        'dataType': data_types,
        'skip_head': skip_head,
        'skip_tail': skip_tail,
        'previewed_files': sorted_files,
        'has_ct_col': has_ct_col,
        'dummy_datetime_idx': dummy_datetime_idx,
        'same_values': [{key: bool(value) for key, value in same_value.items()} for same_value in same_values],
        'has_dupl_cols': has_dupl_cols,
        'org_headers': org_headers,
        'v2_type': datasource_type.value,
        'encoding': encoding,
        'is_process_null': not v2_process_names,
    }


@log_execution_time()
def check_same_values_in_df(df, cols):
    same_values = []
    len_df = len(df)
    for col in cols:
        is_null = False
        null_count = df[col].isnull().sum()
        if null_count == len_df:
            is_null = True
        else:
            null_count = (df[col].astype(str) == EMPTY_STRING).sum()
            if null_count == len_df:
                is_null = True

        is_same = df[col].nunique() == 1

        same_values.append({'is_null': is_null, 'is_same': is_same})

    return same_values


@log_execution_time()
def get_etl_good_file(sorted_files):
    csv_file = None
    dic_file_info = None
    try:
        for file_path in sorted_files:
            check_result = chw.get_file_info_py(file_path)
            if isinstance(check_result, Exception):
                continue

            dic_file_info, is_empty_file = check_result

            if dic_file_info is None or isinstance(dic_file_info, Exception):
                continue

            if is_empty_file:
                continue

            csv_file = file_path
            break
    except IndexError:
        pass
    return dic_file_info, csv_file


@log_execution_time()
def gen_v2_history_sub_part_no_column(column_name):
    column_name = unicode_normalize(column_name)
    sub_part_no_idxs = re.findall(r'\d+', column_name)
    if sub_part_no_idxs:
        sub_part_no_idx = sub_part_no_idxs[0]
        [_, suffix_name] = column_name.split(sub_part_no_idx)
        if REVERSED_WELL_KNOWN_COLUMNS[DBType.V2_HISTORY.name][DataGroupType.PART_NO.value] == suffix_name:
            return SUB_PART_NO_PREFIX + sub_part_no_idx + SUB_PART_NO_SUFFIX
        return SUB_PART_NO_PREFIX + sub_part_no_idx + to_romaji(suffix_name)
    return to_romaji(column_name)


@log_execution_time()
@memoize(is_save_file=False)
def gen_cols_with_types(cols, data_types, same_values, is_v2_history=False, column_raw_name=[]):
    ja_locale = False
    with suppress(Exception):
        ja_locale = get_locale().language == 'ja'
    cols_with_types = []
    has_is_get_date_col = False
    if not column_raw_name:
        column_raw_name = cols
    for col_name, col_raw_name, data_type, same_value in zip(cols, column_raw_name, data_types, same_values):
        is_date = False if has_is_get_date_col else DataType(data_type) is DataType.DATETIME
        if is_date:
            has_is_get_date_col = True

        is_big_int = DataType(data_type) is DataType.BIG_INT
        # add to output
        if col_name:
            if ja_locale:
                system_name = to_romaji(col_name) if not is_v2_history else gen_v2_history_sub_part_no_column(col_name)
            else:
                system_name = (
                    remove_non_ascii_chars(col_name)
                    if not is_v2_history
                    else gen_v2_history_sub_part_no_column(col_name)
                )
            cols_with_types.append(
                {
                    'column_name': col_name,
                    'data_type': DataType(data_type).name if not is_big_int else DataType.TEXT.name,
                    'name_en': system_name,  # this is system_name
                    'romaji': to_romaji(col_name),
                    'is_get_date': is_date,
                    'check_same_value': same_value,
                    'is_big_int': is_big_int,
                    'name_jp': col_name if ja_locale else '',
                    'name_local': col_name if not ja_locale else '',
                    'column_raw_name': col_raw_name,
                },
            )

    return cols_with_types


@log_execution_time()
def convert_utc_df(df_rows, cols, data_types, data_source, table_name):
    for col_name, data_type in zip(cols, data_types):
        is_date = DataType(data_type) is DataType.DATETIME
        if not is_date:
            continue

        # convert utc
        # date_val, tzoffset_str, db_timezone = get_tzoffset_of_random_record(data_source, table_name, col_name)

        # use os timezone
        if data_source.db_detail.use_os_timezone:
            pass

        # is_tz_inside, _, time_offset = get_time_info(date_val, db_timezone)

        # Convert UTC time
        validate_datetime(df_rows, col_name, False, False)
        convert_csv_timezone(df_rows, col_name)
        df_rows.dropna(subset=[col_name], inplace=True)

    return df_rows


@log_execution_time()
def transform_df_to_rows(cols, df_rows, limit):
    df_rows.columns = normalize_list(df_rows.columns)
    return [dict(zip(cols, vals)) for vals in df_rows[0:limit][cols].to_records(index=False).tolist()]


@log_execution_time()
def gen_preview_data_check_dict(rows, previewed_files):
    dic_preview_limit = {}
    file_path = previewed_files[0] if previewed_files else ''
    file_name = ''
    folder_path = ''
    if file_path:
        file_name = os.path.basename(file_path)
        folder_path = os.path.dirname(file_path)

    dic_preview_limit['reach_fail_limit'] = bool(not rows and previewed_files)
    dic_preview_limit['file_name'] = file_name
    dic_preview_limit['folder'] = folder_path
    return dic_preview_limit


def is_valid_list(df_rows):
    return (isinstance(df_rows, list) and len(df_rows)) or (isinstance(df_rows, pd.DataFrame) and not df_rows.empty)


# TODO: add test for this
@log_execution_time()
def drop_null_header_column(
    df: pd.DataFrame,
    original_headers: List[str],
    header_names: List[str],
    duplicated_names: List[str],
    data_types: List[int],
) -> Tuple[pd.DataFrame, List[str], List[str], List[str], List[int]]:
    null_indexes = {i for i, col_name in enumerate(original_headers) if not col_name}
    if not null_indexes:
        return df, original_headers, header_names, duplicated_names, data_types

    null_header_names = [col_name for i, col_name in enumerate(header_names) if i in null_indexes]
    df = df.drop(columns=null_header_names)

    def filter_non_null_indexes(arr: List[Any]) -> List[Any]:
        return [elem for i, elem in enumerate(arr) if i not in null_indexes]

    new_original_headers = filter_non_null_indexes(original_headers)
    new_header_names = filter_non_null_indexes(header_names)
    new_duplicated_names = filter_non_null_indexes(duplicated_names)
    new_data_types = filter_non_null_indexes(data_types)
    return df, new_original_headers, new_header_names, new_duplicated_names, new_data_types


@log_execution_time()
def gen_v2_columns_with_types(v2_datasrc):
    v2_columns = []
    v2_csv_detail = v2_datasrc.get('csv_detail')
    csv_delimiter = get_csv_delimiter(v2_csv_detail.get('delimiter'))
    v2_data_preview = preview_v2_data(
        v2_csv_detail.get('directory'),
        csv_delimiter,
        limit=5,
        return_df=True,
        process_name=v2_csv_detail.get('process_name'),
    )
    for i, column in enumerate(v2_data_preview.get('header')):
        data_type = int(v2_data_preview.get('dataType')[i])
        v2_columns.append({'column_name': column, 'data_type': DataType(data_type).name, 'order': i})
    return v2_columns


@log_execution_time()
def retrieve_data_from_several_files(csv_files, csv_delimiter, max_record=1000, file_name=None, skip_head=None):
    header_names = []
    data_details = []
    sorted_list = get_sorted_files_by_size_and_time(csv_files) if not file_name else [file_name]
    start_time = time.time()
    encoding = None
    for i in range(len(sorted_list)):
        data = None
        csv_file = sorted_list[i]
        try:
            delimiter, encoding = get_delimiter_encoding(csv_file, preview=True)
            csv_delimiter = csv_delimiter or delimiter
            data = read_data(csv_file, delimiter=csv_delimiter, do_normalize=False, skip_head=skip_head)
            header_names = next(data)
            # strip special symbols
            if i == 0:
                data = strip_special_symbol(data)

            data_details += list(islice(data, max_record))
        finally:
            if data:
                data.close()

        current_time = time.time()
        over_timeout = (current_time - start_time) > PREVIEW_DATA_TIMEOUT
        if len(data_details) >= max_record or over_timeout:
            break

    if data_details:
        is_exception = check_exception_case(header_names, data_details)
        # remove end column because there is trailing comma
        if is_exception:
            data_details = [row[:-1] for row in data_details]

    return header_names, data_details, encoding


@log_execution_time()
def re_order_items_by_datetime_idx(datetime_idx: int, items: List) -> List:
    new_column_ordered = [items[datetime_idx]]
    new_column_ordered += [col for (i, col) in enumerate(items) if i != datetime_idx]
    return new_column_ordered


@log_execution_time()
# @memoize(is_save_file=False)
def extract_data_detail(header_names, data_details, org_header=None):
    org_headers = org_header or header_names.copy()
    # normalization
    header_names = normalize_list(header_names)
    header_names = [normalize_str(col) for col in header_names]
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names)
    data_types = [gen_data_types(df_data_details[col]) for col in header_names]
    return drop_null_header_column(df_data_details, org_headers, header_names, dupl_cols, data_types)
