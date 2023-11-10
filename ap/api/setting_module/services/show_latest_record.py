import os
import re
import time
from functools import lru_cache
from itertools import islice
from typing import Any, List, Tuple

import pandas as pd

from ap.api.efa.services.etl import detect_file_path_delimiter, preview_data
from ap.api.setting_module.services.csv_import import convert_csv_timezone
from ap.api.setting_module.services.data_import import (
    PANDAS_DEFAULT_NA,
    strip_special_symbol,
    validate_datetime,
)
from ap.api.setting_module.services.factory_import import get_tzoffset_of_random_record
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
    guess_data_types,
)
from ap.common.constants import (
    DATETIME_DUMMY,
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
from ap.common.pydn.dblib.db_proxy import DbProxy
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import (
    check_exception_case,
    gen_data_types,
    is_normal_csv,
    read_data,
)
from ap.common.services.jp_to_romaji_utils import change_duplicated_columns, to_romaji
from ap.common.services.normalization import (
    normalize_big_rows,
    normalize_list,
    unicode_normalize_nfkc,
)
from ap.common.timezone_utils import gen_dummy_datetime, get_time_info
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    CfgProcessColumn,
    CfgVisualization,
    crud_config,
    make_session,
)
from ap.setting_module.schemas import VisualizationSchema
from ap.trace_data.models import Sensor, find_sensor_class


def get_latest_records(data_source_id, table_name, limit):
    blank_output = dict(cols=[], rows=[])
    if not data_source_id:
        return blank_output

    data_source = CfgDataSource.query.get(data_source_id)
    if not data_source:
        return blank_output

    previewed_files = None
    cols_with_types = []
    is_v2_datasource = is_v2_data_source(ds_type=data_source.type)
    is_csv_or_v2 = data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]
    if is_csv_or_v2:
        csv_detail = data_source.csv_detail
        filtered_process_name = csv_detail.process_name or False

        if is_v2_datasource:
            dic_preview = preview_v2_data(
                csv_detail.directory,
                csv_detail.delimiter,
                limit,
                return_df=True,
                process_name=filtered_process_name,
            )
        else:
            dic_preview = preview_csv_data(
                csv_detail.directory,
                csv_detail.etl_func,
                csv_detail.delimiter,
                limit,
                return_df=True,
                max_records=1000,
            )
        headers = dic_preview.get('header')
        data_types = dic_preview.get('dataType')
        same_values = dic_preview.get('same_values')
        is_v2_history = dic_preview.get('v2_type') == DBType.V2_HISTORY
        if headers and data_types:
            cols_with_types = gen_cols_with_types(headers, data_types, same_values, is_v2_history)

        # sort columns
        sorted_columns = sorted(csv_detail.csv_columns, key=lambda c: c.order or c.id)
        cols = [col.column_name for col in sorted_columns if col.column_name in headers]

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
            data_type_by_cols[col_data['name']] = col_data['type']
        # convert to correct dtypes
        for col in df_rows.columns:
            try:
                if data_type_by_cols[col] == DataType.INTEGER.name:
                    df_rows[col] = df_rows[col].astype('float64').astype('Int64')
            except:
                continue
        rows = transform_df_to_rows(cols, df_rows, limit)
    return cols_with_types, rows, cols_duplicated, previewed_files, has_ct_col, dummy_datetime_idx


def get_col_type_as_cast(col_type):
    if col_type == DataType.TEXT.name:
        return 'str'

    if col_type == DataType.REAL.name:
        return 'float64'

    if col_type == DataType.INTEGER.name:
        return 'int64'

    return None


def gen_data_types_from_factory_type(cols, cols_with_types):
    dic_col_type = {col.get('name'): guess_data_types(col.get('type')) for col in cols_with_types}
    return [dic_col_type.get(col) for col in cols]


@lru_cache(maxsize=20)
def get_info_from_db(data_source, table_name, sql_limit: int = 2000):
    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], []

        if isinstance(db_instance, mssqlserver.MSSQLServer):
            cols, rows = db_instance.run_sql(
                'select TOP {}  * from "{}"'.format(sql_limit, table_name), False
            )
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                'select * from "{}" where rownum <= {}'.format(table_name, sql_limit), False
            )
        else:
            cols, rows = db_instance.run_sql(
                'select * from "{}" limit {}'.format(table_name, sql_limit), False
            )

    cols = normalize_list(cols)
    df_rows = normalize_big_rows(rows, cols, strip_quote=False)
    return cols, df_rows


def get_filter_col_data(proc_config: dict):
    filter_cfgs = proc_config.get('filters') or []
    cfg_col_ids = [filter_cfg.get('column_id') for filter_cfg in filter_cfgs]
    if not cfg_col_ids:
        return {}
    sensor_data = {}
    for col_id in cfg_col_ids:
        sensor_data[col_id] = get_distinct_sensor_values(col_id)
    return sensor_data


@memoize()
def get_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    if not cfg_col:
        return []
    sensor = Sensor.get_sensor_by_col_name(cfg_col.process_id, cfg_col.column_name)
    sensor_vals = []
    if sensor:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type))
        sensor_vals = sensor_val_cls.get_distinct_values(cfg_col.column_name, limit=1000)
        sensor_vals = [sensor_val.value for sensor_val in sensor_vals]
    return sensor_vals


@memoize()
@log_execution_time()
def get_last_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    if not cfg_col:
        return []
    sensor = Sensor.get_sensor_by_col_name(cfg_col.process_id, cfg_col.column_name)
    unique_sensor_vals = set()
    if sensor:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type))
        sensor_vals = sensor_val_cls.get_last_distinct_values(sensor.id, limit=1000)
        unique_sensor_vals = sorted(set([sensor_val.value for sensor_val in sensor_vals]))
    return list(unique_sensor_vals)


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
def preview_csv_data(folder_url, etl_func, csv_delimiter, limit, return_df=False, max_records=5):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files(folder_url)
    sorted_files = sorted_files[0:5]

    csv_file = ''
    skip_head = 0
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
            'skip_head': skip_head,
            'skip_tail': skip_tail,
            'previewed_files': sorted_files,
            'same_values': same_values,
        }

    csv_file = sorted_files[0]

    # call efa etl
    has_data_file = None
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
    elif is_normal_csv(csv_file, csv_delimiter):
        header_names, data_details = retrieve_data_from_several_files(
            folder_url, csv_delimiter, max_records
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

    # normalize data detail
    df_data_details, org_headers, header_names, dupl_cols, data_types = extract_data_detail(
        header_names, data_details
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
        if (
            DataType.DATETIME.value not in data_types
            and DATETIME_DUMMY not in df_data_details.columns
        ):
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
    else:
        if not return_df:
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
        'skip_head': skip_head,
        'skip_tail': skip_tail,
        'previewed_files': sorted_files,
        'has_ct_col': has_ct_col,
        'dummy_datetime_idx': dummy_datetime_idx,
        'same_values': [
            {key: bool(value) for key, value in same_value.items()} for same_value in same_values
        ],
        'has_dupl_cols': has_dupl_cols,
        'org_headers': org_headers,
    }


@log_execution_time()
@memoize(is_save_file=True)
def preview_v2_data(folder_url, csv_delimiter, limit, return_df=False, process_name=None):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files_by_size(folder_url)

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
        }

    is_abnormal_v2 = None
    datasource_type = None
    if process_name:
        # V2 preview with the largest file
        file_data_idx = 0
        while file_data_idx >= 0:
            largest_file = sorted_files[file_data_idx]
            datasource_type, is_abnormal_v2 = get_v2_datasource_type_from_file(largest_file)

            if datasource_type == DBType.V2_HISTORY:
                data_details = get_df_v2_process_single_file(
                    largest_file, process_name, datasource_type, is_abnormal_v2
                )
            elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
                data_details = get_vertical_df_v2_process_single_file(
                    largest_file, process_name, datasource_type, is_abnormal_v2
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

    # normalization
    header_names = normalize_list(header_names)

    if process_name:
        data_details, *_ = rename_sub_part_no(pd.DataFrame(data_details), datasource_type)
        header_names = data_details.columns.tolist()

    # get DB Type and check if there is abnormal history
    if is_abnormal_v2 is None and not datasource_type:
        datasource_type, is_abnormal_v2 = get_v2_datasource_type_from_file(csv_file)
    header_names = rename_abnormal_history_col_names(datasource_type, header_names, is_abnormal_v2)
    org_headers, header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names)
    data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]
    df_data_details, org_headers, header_names, dupl_cols, data_types = drop_null_header_column(
        df_data_details, org_headers, header_names, dupl_cols, data_types
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
        if (
            DataType.DATETIME.value not in data_types
            and DATETIME_DUMMY not in df_data_details.columns
        ):
            dummy_datetime_idx = 0
            df_data_details = gen_dummy_datetime(df_data_details)
            data_types.insert(dummy_datetime_idx, DataType.DATETIME.value)
            header_names.insert(dummy_datetime_idx, DATETIME_DUMMY)
            org_headers.insert(dummy_datetime_idx, DATETIME_DUMMY)
            has_ct_col = False

        same_values = check_same_values_in_df(df_data_details, header_names)

        if not return_df:
            df_data_details = df_data_details.to_records(index=False).tolist()
    else:
        if not return_df:
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
        'same_values': [
            {key: bool(value) for key, value in same_value.items()} for same_value in same_values
        ],
        'has_dupl_cols': has_dupl_cols,
        'org_headers': org_headers,
        'v2_type': datasource_type.value,
    }


def check_same_values_in_df(df, cols):
    same_values = []
    len_df = len(df)
    for col in cols:
        is_null = False
        null_count = df[col].isnull().sum()
        if null_count == len_df:
            is_null = True
        else:
            null_count = (df[col] == '').sum()
            if null_count == len_df:
                is_null = True

        is_same = df[col].nunique() == 1

        same_values.append(dict(is_null=is_null, is_same=is_same))

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
    except IndexError as e:
        pass
    return dic_file_info, csv_file


@log_execution_time()
def gen_v2_history_sub_part_no_column(column_name):
    column_name = unicode_normalize_nfkc(column_name)
    sub_part_no_idxs = re.findall('\d+', column_name)
    if sub_part_no_idxs:
        sub_part_no_idx = sub_part_no_idxs[0]
        [_, suffix_name] = column_name.split(sub_part_no_idx)
        if (
            REVERSED_WELL_KNOWN_COLUMNS[DBType.V2_HISTORY.name][DataGroupType.PART_NO.value]
            == suffix_name
        ):
            return SUB_PART_NO_PREFIX + sub_part_no_idx + SUB_PART_NO_SUFFIX
        return SUB_PART_NO_PREFIX + sub_part_no_idx + to_romaji(suffix_name)
    return to_romaji(column_name)


@log_execution_time()
def gen_cols_with_types(cols, data_types, same_values, is_v2_history=False):
    cols_with_types = []
    for col_name, data_type, same_value in zip(cols, data_types, same_values):
        is_date = DataType(data_type) is DataType.DATETIME
        is_big_int = DataType(data_type) is DataType.BIG_INT
        # add to output
        if col_name:
            romaji_name = (
                to_romaji(col_name)
                if not is_v2_history
                else gen_v2_history_sub_part_no_column(col_name)
            )
            cols_with_types.append(
                {
                    'name': col_name,
                    'type': DataType(data_type).name if not is_big_int else DataType.TEXT.name,
                    'romaji': romaji_name,
                    'is_date': is_date,
                    'check_same_value': same_value,
                    'is_big_int': is_big_int,
                }
            )

    return cols_with_types


@log_execution_time()
def convert_utc_df(df_rows, cols, data_types, data_source, table_name):
    for col_name, data_type in zip(cols, data_types):
        is_date = DataType(data_type) is DataType.DATETIME
        if not is_date:
            continue

        # # convert utc
        # date_val, tzoffset_str, db_timezone = get_tzoffset_of_random_record(
        #     data_source, table_name, col_name
        # )

        # # use os timezone
        # if data_source.db_detail.use_os_timezone:
        #     db_timezone = None

        # is_tz_inside, _, time_offset = get_time_info(date_val, db_timezone)

        # Convert UTC time
        validate_datetime(df_rows, col_name, False, False)
        convert_csv_timezone(df_rows, col_name)
        df_rows.dropna(subset=[col_name], inplace=True)

    return df_rows


def transform_df_to_rows(cols, df_rows, limit):
    return [
        dict(zip(cols, vals)) for vals in df_rows[0:limit][cols].to_records(index=False).tolist()
    ]


@log_execution_time()
def gen_preview_data_check_dict(rows, previewed_files):
    dic_preview_limit = {}
    file_path = previewed_files[0] if previewed_files else ''
    file_name = ''
    folder_path = ''
    if file_path:
        file_name = os.path.basename(file_path)
        folder_path = os.path.dirname(file_path)

    dic_preview_limit['reach_fail_limit'] = True if not rows and previewed_files else False
    dic_preview_limit['file_name'] = file_name
    dic_preview_limit['folder'] = folder_path
    return dic_preview_limit


@log_execution_time()
def gen_colsname_for_duplicated(cols_name):
    org_cols_name = cols_name.copy()
    cols_name, dup_cols = chw.add_suffix_if_duplicated(cols_name, True, True)
    return org_cols_name, cols_name, dup_cols


def is_valid_list(df_rows):
    return (isinstance(df_rows, list) and len(df_rows)) or (
        isinstance(df_rows, pd.DataFrame) and not df_rows.empty
    )


# TODO: add test for this
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
        v2_columns.append(
            {'column_name': column, 'data_type': DataType(data_type).name, 'order': i}
        )
    return v2_columns


@log_execution_time()
def retrieve_data_from_several_files(csv_files, csv_delimiter, max_record=1000):
    header_names = []
    data_details = []
    sorted_list = get_sorted_files_by_size_and_time(csv_files)
    start_time = time.time()
    for i in range(len(sorted_list)):
        data = None
        csv_file = sorted_list[i]
        try:
            data = read_data(csv_file, delimiter=csv_delimiter, do_normalize=False)
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

    return header_names, data_details


@log_execution_time()
def re_order_items_by_datetime_idx(datetime_idx: int, items: List) -> List:
    new_column_ordered = [items[datetime_idx]]
    new_column_ordered += [col for (i, col) in enumerate(items) if i != datetime_idx]
    return new_column_ordered


@log_execution_time()
def extract_data_detail(header_names, data_details):
    # normalization
    header_names = normalize_list(header_names)
    org_headers, header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names)
    data_types = [gen_data_types(df_data_details[col]) for col in header_names]
    return drop_null_header_column(
        df_data_details, org_headers, header_names, dupl_cols, data_types
    )
