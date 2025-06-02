from __future__ import annotations

import json
import logging
import os
import re
import time
from contextlib import suppress
from itertools import islice
from typing import List

import pandas as pd
from flask_babel import get_locale

from ap import check_exist
from ap.api.efa.services.etl import csv_transform, detect_file_path_delimiter, df_transform
from ap.api.setting_module.services.csv_import import convert_csv_timezone, gen_dummy_header
from ap.api.setting_module.services.data_import import (
    PANDAS_DEFAULT_NA,
    strip_special_symbol,
    validate_data,
    validate_datetime,
)
from ap.api.setting_module.services.master_data_transform_pattern import ColumnRawNameRule
from ap.api.setting_module.services.software_workshop_etl_services import (
    get_code_name_mapping,
    get_transaction_data_stmt,
    measurements_table,
    quality_measurements_table,
    transform_df_for_software_workshop,
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
    DATE_FORMAT_SIMPLE,
    add_suffix_for_same_column_name,
    get_csv_delimiter,
    get_files,
    get_preview_data_file_folder,
    get_sorted_files,
    get_sorted_files_by_size,
    get_sorted_files_by_size_and_time,
    make_dir_from_file_path,
)
from ap.common.constants import (
    DATETIME_DUMMY,
    EMPTY_STRING,
    FILE_NAME,
    HALF_WIDTH_SPACE,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    PREVIEW_DATA_TIMEOUT,
    REVERSED_WELL_KNOWN_COLUMNS,
    SUB_PART_NO_PREFIX,
    SUB_PART_NO_SUFFIX,
    WR_HEADER_NAMES,
    WR_TYPES,
    WR_VALUES,
    DataColumnType,
    DataGroupType,
    DataType,
    DBType,
    MasterDBType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.pydn.dblib import mssqlserver, oracle
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import (
    check_exception_case,
    get_delimiter_encoding,
    is_normal_csv,
    read_data,
)
from ap.common.services.csv_header_wrapr import (
    _translate_wellknown_jp2en,
    convert_wellknown_col_name,
    gen_colsname_for_duplicated,
)
from ap.common.services.data_type import gen_data_types
from ap.common.services.jp_to_romaji_utils import change_duplicated_columns, to_romaji
from ap.common.services.normalization import (
    normalize_big_rows,
    normalize_list,
    normalize_str,
    unicode_normalize,
)
from ap.common.timezone_utils import gen_dummy_datetime, gen_dummy_datetime_data
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    CfgProcessColumn,
    MUnit,
    make_session,
)
from ap.setting_module.schemas import VisualizationSchema
from ap.setting_module.services.process_config import get_process_columns
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)


def get_latest_records(
    data_source_id,
    table_name,
    file_name=None,
    directory=None,
    limit=5,
    current_process_id: int | None = None,
    is_v2_datasource=False,
    filtered_process_name=None,
    process_factid=None,
    master_type: MasterDBType = None,
    etl_func: str = '',
):
    previewed_files = None
    cols_with_types = []
    delimiter = 'Auto'
    skip_head = None
    n_rows = None
    is_transpose = None
    has_ct_col = True
    dummy_datetime_idx = None
    file_name_col_idx = None
    is_gen_cols = []
    is_file_checker = False

    if data_source_id:
        data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
        if not data_source:
            return None
        is_v2_datasource = is_v2_data_source(ds_type=data_source.type)
        is_csv_or_v2 = data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]
        if is_csv_or_v2:
            csv_detail = data_source.csv_detail
            if not filtered_process_name:
                filtered_process_name = csv_detail.process_name or False
            directory = csv_detail.directory
            if not file_name:
                file_name = csv_detail.directory if csv_detail.is_file_path else None
            delimiter = csv_detail.delimiter
            etl_func = csv_detail.etl_func
            skip_head = csv_detail.skip_head
            n_rows = csv_detail.n_rows
            is_transpose = csv_detail.is_transpose
            is_file_checker = csv_detail.is_file_checker
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
                show_file_name_column=True,
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
                skip_head=skip_head,
                n_rows=n_rows,
                is_transpose=is_transpose,
                show_file_name_column=True,
                current_process_id=current_process_id,
                is_file_checker=is_file_checker,
            )
        column_raw_names = dic_preview.get('org_headers')
        headers = normalize_list(dic_preview.get('header'))
        headers = [normalize_str(col) for col in headers]
        data_types = dic_preview.get('dataType')
        has_ct_col = dic_preview.get('has_ct_col')
        dummy_datetime_idx = dic_preview.get('dummy_datetime_idx')
        file_name_col_idx = dic_preview.get('file_name_col_idx')
        same_values = dic_preview.get('same_values')
        is_v2_history = dic_preview.get('v2_type') == DBType.V2_HISTORY
        is_gen_cols = dic_preview.get('is_gen_cols')
        if headers and data_types:
            cols_with_types = gen_cols_with_types(
                headers,
                data_types,
                same_values,
                is_v2_history,
                column_raw_names,
                dummy_datetime_idx=dummy_datetime_idx,
                file_name_idx=file_name_col_idx,
                is_gen_cols=is_gen_cols,
            )

        # sort columns
        # sorted(csv_detail.csv_columns, key=lambda c: c.order or c.id)
        # cols = {col.column_name for col in sorted_columns if col.column_name in headers}
        cols = headers

        # get rows
        df_rows = dic_preview.get('content', None)
        previewed_files = dic_preview.get('previewed_files')
    else:
        cols, df_rows, dict_column_name_and_unit = get_info_from_db(
            data_source,
            table_name,
            process_factid=process_factid,
            master_type=master_type,
        )
        if etl_func:
            df_rows = df_transform(df_rows, etl_func)
            cols = df_rows.columns.tolist()
        data_types = [gen_data_types(df_rows[col]) for col in cols]
        same_values = check_same_values_in_df(df_rows, cols)
        if cols and data_types:
            cols_with_types = gen_cols_with_types(
                normalize_list(cols),
                data_types,
                same_values,
                column_raw_name=cols,
                dict_column_name_and_unit=dict_column_name_and_unit,
            )
        # format data
        df_rows = convert_utc_df(df_rows, cols, data_types, data_source, table_name)

    # change name if romaji cols is duplicated
    cols_with_types, cols_duplicated = change_duplicated_columns(cols_with_types)
    if is_csv_or_v2 and DataType.DATETIME.value not in data_types:
        dummy_datetime_idx = 0
        cols_with_types.insert(
            dummy_datetime_idx,
            {
                'column_name': DATETIME_DUMMY,
                'data_type': DataType.DATETIME.name,
                'romaji': DATETIME_DUMMY,
                'is_date': True,
                'check_same_value': {'is_null': False, 'is_same': False},
                'is_checked': True,
                'is_show': True,
                'is_dummy_datetime': True,
            },
        )
        cols.insert(dummy_datetime_idx, DATETIME_DUMMY)
        if is_valid_list(df_rows):
            df_rows = gen_dummy_datetime(df_rows)

    # if DATETIME_DUMMY in cols or DataType.DATETIME.value not in data_types:
    #     dummy_datetime_idx = 0
    #     has_ct_col = False

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
                    df_rows[col] = df_rows[col].astype(pd.StringDtype())
                    # if original data is boolean, it should be convert to lower string
                    # same as text from sql (true/false), instead of python bool type (True/False)
                    if pd.api.types.is_bool_dtype(df_rows[col]):
                        df_rows[col] = df_rows[col].str.lower()
                    # fill na to '' for string column
                    df_rows[col] = df_rows[col].fillna('')

            except Exception:
                continue
        rows = transform_df_to_rows(cols, df_rows, limit)

    is_rdb = not is_csv_or_v2
    return (
        cols_with_types,
        rows,
        cols_duplicated,
        previewed_files,
        has_ct_col,
        dummy_datetime_idx,
        is_rdb,
        file_name_col_idx,
    )


def get_sample_from_preview_data(preview_data, columns):
    link_cols = {col.column_name: str(col.id) for col in columns}
    # make dic use cols for validate and parse sensor value by selected type
    dic_use_cols = {col.column_name: col for col in columns}
    # bind data from preview_data
    df = pd.DataFrame(data=preview_data['rows'])
    df = validate_data(df, dic_use_cols, na_vals=[None, pd.NA])
    df = df[list(link_cols.keys())]
    # use column id to get easier from frontend
    df = df.rename(columns=link_cols)
    return df


def get_latest_record_from_preview_file(fp, proc_id, limit=10):
    data = json.load(fp)
    proc_cols = get_process_columns(proc_id, show_graph=False)
    dict_data = json.loads(data)
    cols_org = dict_data.get('cols', [])
    rows_org = dict_data.get('rows', [])
    if not cols_org and not rows_org:
        return dict_data

    df_data = pd.DataFrame(rows_org)
    column_name = [col['column_name'] for col in cols_org]
    data_types = [DataType[col['data_type']].value for col in cols_org]
    dupl_cols = []
    _, df_data_details, org_headers, *_ = add_generated_datetime_column(
        proc_id,
        df_data,
        column_name.copy(),
        column_name.copy(),
        dupl_cols,
        data_types,
    )
    new_cols_name = list(set(org_headers) - set(column_name))
    if new_cols_name:
        col_add = next((col for col in reversed(proc_cols) if col.get('column_name') in new_cols_name), None)
        dict_data['cols'].append(col_add)
    dict_data['rows'] = transform_df_to_rows(org_headers, df_data_details, limit)
    return dict_data


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


def get_info_from_db(
    data_source: CfgDataSource,
    table_name: str,
    process_factid: str | None = None,
    sql_limit: int = 2000,
    master_type: MasterDBType = None,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    if data_source.type == DBType.SOFTWARE_WORKSHOP.name:
        return get_info_from_db_software_workshop(
            data_source.id,
            quality_measurements_table.name,
            process_factid,
            master_type=master_type,
        )
    return get_info_from_db_normal(data_source.id, table_name, sql_limit)


@CustomCache.memoize(duration=300)
def get_info_from_db_normal(
    data_source_id,
    table_name,
    sql_limit: int = 2000,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    data_source = CfgDataSource.query.get(data_source_id)
    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], pd.DataFrame(), {}

        if isinstance(db_instance, mssqlserver.MSSQLServer):
            cols, rows = db_instance.run_sql('select TOP {}  * from "{}"'.format(sql_limit, table_name), False)
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                'select * from "{}" where rownum <= {}'.format(table_name, sql_limit),
                False,
            )
        else:
            cols, rows = db_instance.run_sql('select * from "{}" limit {}'.format(table_name, sql_limit), False)

    df_rows = normalize_big_rows(rows, cols, strip_quote=False)
    return cols, df_rows, {}


@log_execution_time()
@CustomCache.memoize(duration=300)
def get_info_from_db_software_workshop(
    data_source_id: int,
    table_name: str,
    child_equip_id: str,
    sql_limit: int = 2000,
    master_type: MasterDBType = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    data_source = CfgDataSource.query.get(data_source_id)
    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name or not child_equip_id:
            return [], pd.DataFrame(), {}
        stmt = get_transaction_data_stmt(
            child_equip_id,
            limit=sql_limit,
            master_type=master_type,
        )
        sql, params = db_instance.gen_sql_and_params(stmt)
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)

    df = pd.DataFrame(rows, columns=cols)
    if master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT:
        return get_measurement_info_from_db_software_workshop(data_source.id, child_equip_id, df)
    elif master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY:
        return get_history_info_from_db_software_workshop(data_source.id, child_equip_id, df)
    else:
        return cols, df, {}


def get_measurement_info_from_db_software_workshop(
    data_source_id: int,
    child_equip_id: str,
    df: pd.DataFrame,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    code_col = measurements_table.c.code.name
    unit_col = measurements_table.c.unit.name

    df[unit_col] = df[unit_col].str.strip()  # Remove space characters in unit value

    dict_code_with_unit = (
        df.dropna(subset=[unit_col])  # do not get unit column with NA
        .drop_duplicates(subset=[code_col])[[code_col, unit_col]]  # only get unique code column
        .set_index(code_col)[unit_col]  # convert to dictionary
        .to_dict()
    )
    dict_code_with_name = get_code_name_mapping(data_source_id, child_equip_id)
    dict_code_with_name = add_suffix_for_same_column_name(dict_code_with_name)
    dict_column_name_with_unit = {dict_code_with_name[code]: unit for code, unit in dict_code_with_unit.items()}

    df = transform_df_for_software_workshop(df, data_source_id, child_equip_id)
    transform_cols = df.columns.to_list()
    transform_rows = df.to_numpy().tolist()

    df_rows = normalize_big_rows(transform_rows, transform_cols, strip_quote=False)

    return transform_cols, df_rows, dict_column_name_with_unit


def get_history_info_from_db_software_workshop(
    data_source_id: int,
    child_equip_id: str,
    df: pd.DataFrame,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    dict_column_name_with_unit = {}

    df = transform_df_for_software_workshop(
        df,
        data_source_id,
        child_equip_id,
        master_type=MasterDBType.SOFTWARE_WORKSHOP_HISTORY,
    )
    transform_cols = df.columns.to_list()
    transform_rows = df.to_numpy().tolist()

    df_rows = normalize_big_rows(transform_rows, transform_cols, strip_quote=False)

    return transform_cols, df_rows, dict_column_name_with_unit


@log_execution_time()
def get_last_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    trans_data = TransactionData(cfg_col.process_id)
    if len(cfg_col.function_details):  # in db not save data of function column
        return []

    col_name = cfg_col.bridge_column_name
    with DbProxy(gen_data_source_of_universal_db(cfg_col.process_id), True) as db_instance:
        unique_sensor_vals = trans_data.select_distinct_data(db_instance, col_name, limit=1000)

    return unique_sensor_vals


def save_master_vis_config(proc_id, cfg_jsons) -> CfgProcess | None:
    vis_schema = VisualizationSchema()

    with make_session() as meta_session:
        proc: CfgProcess = meta_session.query(CfgProcess).get(proc_id or -1)
        if proc:
            cfg_vis_data = []
            for cfg_json in cfg_jsons:
                cfg_vis_data.append(vis_schema.load(cfg_json))

            proc.visualizations = cfg_vis_data
            proc = meta_session.merge(proc)

            return proc

    return None


@log_execution_time()
def get_csv_data_from_files(
    sorted_files,
    skip_head: int | None,
    n_rows: int | None,
    is_transpose: bool,
    etl_func,
    csv_delimiter,
    max_records=5,
    is_file_checker=False,
):
    csv_file = sorted_files[0]
    skip_tail = 0
    encoding = None
    skip_head_detected = None
    header_names = []
    data_details = []

    # call efa etl
    has_data_file = None
    if etl_func:
        # try to get file which has data to detect data types + get col names
        for file_path in sorted_files:
            preview_file_path = csv_transform(file_path, etl_func)
            if preview_file_path and not isinstance(preview_file_path, Exception):
                has_data_file = True
                csv_file = preview_file_path
                csv_delimiter = detect_file_path_delimiter(csv_file, csv_delimiter)
                break

        if has_data_file:
            for i in range(2):
                data = None
                try:
                    data = read_data(
                        csv_file,
                        skip_head=skip_head,
                        n_rows=n_rows,
                        is_transpose=is_transpose,
                        delimiter=csv_delimiter,
                        do_normalize=False,
                    )
                    header_names = next(data)

                    # strip special symbols
                    if i == 0:
                        data = strip_special_symbol(data)

                    # get 5 rows
                    data_details = list(islice(data, max_records))
                finally:
                    if data:
                        data.close()

                if data_details:
                    break
    elif (
        is_normal_csv(csv_file, csv_delimiter, skip_head=skip_head, n_rows=n_rows, is_transpose=is_transpose)
        and not is_file_checker
    ):
        header_names, data_details, encoding = retrieve_data_from_several_files(
            None,
            csv_delimiter,
            max_records,
            csv_file,
            skip_head=skip_head,
            n_rows=n_rows,
            is_transpose=is_transpose,
        )
    else:
        # try to get file which has data to detect data types + get col names
        dic_file_info, csv_file, is_file_checker = get_etl_good_file(sorted_files)
        if dic_file_info and csv_file:
            skip_head = chw.get_skip_head(dic_file_info)
            skip_head_detected = skip_head
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
                    get_limit = max_records + skip_tail if max_records else None
                    data_details = list(islice(data, get_limit))
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

        else:
            raise ValueError('Cannot get headers_name and data_details')

    # check for header and generate column name
    # TODO: We should make use of dummy_header variable of data_src if data_src already exists and not check again
    org_header, header_names, dummy_header, partial_dummy_header, data_details, is_gen_cols = gen_dummy_header(
        header_names,
        data_details,
        skip_head,
    )

    skip_head = skip_head_detected if skip_head_detected else skip_head
    return (
        org_header,
        header_names,
        dummy_header,
        partial_dummy_header,
        data_details,
        encoding,
        skip_tail,
        skip_head,
        is_gen_cols,
        is_file_checker,
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
    skip_head=None,
    n_rows: int | None = None,
    is_transpose: bool = False,
    show_file_name_column=False,
    current_process_id=None,
    is_convert_datetime=False,
    is_file_checker=False,
    is_show_raw_data=False,
):
    csv_delimiter = get_csv_delimiter(csv_delimiter)

    if not file_name:
        sorted_files = get_sorted_files(folder_url)
        sorted_files = sorted_files[0:5]
    else:
        sorted_files = [file_name]

    csv_file = ''
    header_names = []
    data_types = []
    data_details = []
    same_values = []
    if not sorted_files:
        return {
            'directory': folder_url,
            'file_name': csv_file,
            'header': header_names,
            'content': [] if return_df else data_details,
            'dataType': data_types,
            'skip_head': skip_head,
            'n_rows': n_rows,
            'is_transpose': is_transpose,
            'skip_tail': 0,
            'previewed_files': sorted_files,
            'same_values': same_values,
        }

    csv_file = sorted_files[0]

    (
        org_header,
        header_names,
        dummy_header,
        partial_dummy_header,
        data_details,
        encoding,
        skip_tail,
        skip_head_detected,
        is_gen_cols,
        is_file_checker,
    ) = get_csv_data_from_files(
        sorted_files,
        skip_head=skip_head,
        n_rows=n_rows,
        is_transpose=is_transpose,
        etl_func=etl_func,
        csv_delimiter=csv_delimiter,
        max_records=max_records,
        is_file_checker=is_file_checker,
    )

    # normalize data detail
    df_data_details, org_headers, header_names, dupl_cols, data_types = extract_data_detail(
        header_names,
        data_details,
        org_header,
        is_show_raw_data=is_show_raw_data,
    )
    has_ct_col = True
    dummy_datetime_idx = None
    file_name_col_idx = None
    if df_data_details is not None:
        # sort by datetime
        first_datetime_col_idx = None
        # convert utc
        for col, dtype in zip(header_names, data_types):
            if DataType(dtype) in [DataType.DATETIME, DataType.DATE, DataType.TIME]:
                df_data_details[col] = df_data_details[col].astype(pd.StringDtype())

            if DataType(dtype) is not DataType.DATETIME:
                continue
            # Convert UTC time
            df_data_details = validate_datetime(
                df_data_details,
                col,
                is_strip=False,
                add_is_error_col=False,
                is_convert_datetime=is_convert_datetime,
            )
            # When show sample data on Process Config, it will show raw data of datetime value.
            if is_convert_datetime:
                df_data_details = convert_csv_timezone(df_data_details, col)
            else:
                df_data_details[col] = df_data_details[col].astype(pd.StringDtype())
            df_data_details = df_data_details.dropna(subset=[col])

            # if not first_datetime_col_idx:
            #     # first ct column is selected as datetime column
            #     # append datetime to start of list columns
            #     # and sort preview rows by datetime value
            #     df_data_details = df_data_details.sort_values(col)
            #     first_datetime_col_idx = header_names.index(col)

        df_data_details = df_data_details[0:limit]

        if DataType.DATETIME.value not in data_types:
            (
                header_names,
                df_data_details,
                org_headers,
                data_types,
                dupl_cols,
                dummy_datetime_idx,
                is_gen_cols,
            ) = add_dummy_datetime_column(
                header_names,
                df_data_details,
                org_headers,
                data_types,
                is_gen_cols=is_gen_cols,
            )
            has_ct_col = False
        elif first_datetime_col_idx:
            header_names = re_order_items_by_datetime_idx(first_datetime_col_idx, header_names)
            data_types = re_order_items_by_datetime_idx(first_datetime_col_idx, data_types)
            org_headers = re_order_items_by_datetime_idx(first_datetime_col_idx, org_headers)
            df_data_details = df_data_details[header_names]

        # check to add generated datetime column
        if current_process_id is not None:
            # we check datetime column and add this datetime column into details
            (
                header_names,
                df_data_details,
                org_headers,
                data_types,
                dupl_cols,
                _,
            ) = add_generated_datetime_column(
                current_process_id,
                df_data_details,
                org_headers,
                header_names,
                dupl_cols,
                data_types,
            )

        # add file name
        if show_file_name_column:
            (
                header_names,
                df_data_details,
                org_headers,
                data_types,
                dupl_cols,
                file_name_col_idx,
                is_gen_cols,
            ) = add_show_file_name_column(
                header_names,
                df_data_details,
                org_headers,
                data_types,
                csv_file,
                is_gen_cols,
            )

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
        'directory': folder_url,
        'file_name': csv_file,
        'header': header_names,
        'content': df_data_details,
        'dataType': data_types,
        'skip_head': 0 if dummy_header and not skip_head_detected else skip_head_detected,
        'skip_tail': skip_tail,
        'n_rows': n_rows,
        'is_transpose': is_transpose,
        'previewed_files': sorted_files,
        'has_ct_col': has_ct_col,
        'dummy_datetime_idx': dummy_datetime_idx,
        'same_values': [{key: bool(value) for key, value in same_value.items()} for same_value in same_values],
        'has_dupl_cols': False if dummy_header else has_dupl_cols,
        'org_headers': header_names if dummy_header else org_headers,
        'encoding': encoding,
        'is_dummy_header': dummy_header,
        'partial_dummy_header': partial_dummy_header,
        'file_name_col_idx': file_name_col_idx,
        'is_gen_cols': is_gen_cols,
        'is_file_checker': is_file_checker,
    }


@log_execution_time()
def preview_v2_data(
    folder_url,
    csv_delimiter,
    limit,
    return_df=False,
    process_name=None,
    file_name=None,
    show_file_name_column=False,
    is_show_raw_data=False,
    is_convert_datetime=False,
):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files_by_size(folder_url) if not file_name else [file_name]
    encoding = None
    csv_file = ''
    skip_head = None
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
            csv_file = os.path.basename(largest_file)
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
    df_data_details = normalize_big_rows(data_details, header_names, is_show_raw_data=is_show_raw_data)
    data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]
    file_name_col_idx = None
    if show_file_name_column:
        (
            header_names,
            df_data_details,
            org_headers,
            data_types,
            dupl_cols,
            file_name_col_idx,
            _,
        ) = add_show_file_name_column(
            header_names,
            df_data_details,
            org_headers,
            data_types,
            csv_file,
            is_gen_cols=None,
        )

    has_ct_col = True
    dummy_datetime_idx = None
    if df_data_details is not None:
        # convert utc
        for col, dtype in zip(header_names, data_types):
            if DataType(dtype) is not DataType.DATETIME:
                continue
            # Convert UTC time
            df_data_details = validate_datetime(
                df_data_details,
                col,
                False,
                False,
                is_convert_datetime=is_convert_datetime,
            )
            if is_convert_datetime:
                df_data_details = convert_csv_timezone(df_data_details, col)
            df_data_details = df_data_details.dropna(subset=[col])
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
    if df_data_details is not None and not isinstance(df_data_details, list):
        df_data_details = df_data_details.astype(pd.StringDtype()).replace(list(PANDAS_DEFAULT_NA), EMPTY_STRING)
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
        'file_name_col_idx': file_name_col_idx,
        'is_gen_cols': [False] * len(header_names),
    }


@log_execution_time()
def check_same_values_in_df(df, cols):
    same_values = []
    for col in cols:
        df_string = df[col].astype(pd.StringDtype())
        is_empty = (df_string == EMPTY_STRING) | df_string.isna()
        is_null = bool(is_empty.all())

        # See: https://docs.astral.sh/ruff/rules/pandas-nunique-constant-series-check/
        # Actually, we don't care NA value here
        value = df[col].dropna().to_numpy()
        is_same = value.shape[0] == 0 or (value[0] == value).all()
        is_same = bool(is_same)

        same_values.append({'is_null': is_null, 'is_same': is_same})

    return same_values


@log_execution_time()
def get_etl_good_file(sorted_files):
    csv_file = None
    dic_file_info = None
    is_file_checker = False
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

            if dic_file_info:
                is_file_checker = True

            csv_file = file_path
            break
    except IndexError:
        pass
    return dic_file_info, csv_file, is_file_checker


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
@CustomCache.memoize()
def gen_cols_with_types(
    cols,
    data_types,
    same_values,
    is_v2_history=False,
    column_raw_name=[],
    dict_column_name_and_unit={},
    dummy_datetime_idx: int = None,
    file_name_idx: int = None,
    is_gen_cols=[],
):
    cols_with_types = []
    ja_locale = False

    if not len(is_gen_cols):
        is_gen_cols = [False] * len(cols)

    with suppress(Exception):
        ja_locale = get_locale().language == 'ja'
    has_is_get_date_col = False
    has_is_serial_no_col = False
    if not column_raw_name:
        column_raw_name = cols
    column_raw_name_normalize = [normalize_str(col) for col in column_raw_name.copy()]
    cols_raw_name_added_suffix, _ = gen_colsname_for_duplicated(column_raw_name_normalize)
    idx = 0
    serial_name_jp = 'シリアル'
    datetime_name_jp = '日時'
    for (
        col_name,
        col_raw_name,
        col_raw_name_added_suffix,
        data_type,
        same_value,
        is_gen_col,
    ) in zip(cols, column_raw_name, cols_raw_name_added_suffix, data_types, same_values, is_gen_cols):
        is_date = False if has_is_get_date_col else DataType(data_type) is DataType.DATETIME
        is_serial_no = (
            DataType(data_type) in [DataType.TEXT, DataType.INTEGER]
            and re.search(r'.*シリアル|serial.*', col_name.lower()) is not None
        )
        is_main_serial_no = False
        if is_date:
            has_is_get_date_col = True

        if is_serial_no:
            if has_is_serial_no_col:
                is_serial_no = True
            else:
                is_main_serial_no = True
                is_serial_no = False
                has_is_serial_no_col = True

        # add to output
        if col_name:
            # when stripped col_raw_name is empty, use col_name (which are generated headers)
            # TODO: should normalize_str() be used?
            mapped_col_name = col_raw_name_added_suffix if (col_raw_name.strip() and not is_gen_col) else col_name
            column_name_extracted, unit = ColumnRawNameRule.extract_data(mapped_col_name)
            if unit:
                # if unit extracted by regex, verify unit by m_unit data again
                valid_unit = MUnit.get_by_unit(unit)

                # if not valid, string normalization applied for column name
                if not valid_unit:
                    # set unit be empty
                    unit = ''
                    column_name_extracted = mapped_col_name

            if ja_locale:
                name_local = ''
                if is_date:
                    name_jp = datetime_name_jp
                    name_en = _translate_wellknown_jp2en([datetime_name_jp])[0]
                elif is_main_serial_no:
                    name_jp = serial_name_jp
                    name_en = _translate_wellknown_jp2en([serial_name_jp])[0]
                else:
                    name_jp = column_name_extracted
                    name_en, is_wellknown_col = convert_wellknown_col_name(name_jp)
                    if not is_wellknown_col:
                        name_en = (
                            to_romaji(name_en) if not is_v2_history else gen_v2_history_sub_part_no_column(name_en)
                        )
            else:
                name_jp = ''
                if is_date:
                    name_en = _translate_wellknown_jp2en([datetime_name_jp])[0]
                elif is_main_serial_no:
                    name_en = _translate_wellknown_jp2en([serial_name_jp])[0]
                else:
                    name_en, is_wellknown_col = convert_wellknown_col_name(column_name_extracted)
                    if not is_wellknown_col:
                        name_en = (
                            to_romaji(name_en) if not is_v2_history else gen_v2_history_sub_part_no_column(name_en)
                        )
                name_local = name_en

            romaji = name_en
            unit = dict_column_name_and_unit.get(col_raw_name, unit)
            cols_with_types.append(
                {
                    'column_name': col_name,
                    'data_type': DataType(data_type).name,
                    'name_en': name_en,  # this is system_name
                    'romaji': romaji,
                    'is_get_date': is_date,
                    'is_serial_no': is_serial_no,
                    'is_main_serial_no': is_main_serial_no,
                    'is_dummy_datetime': dummy_datetime_idx == idx if dummy_datetime_idx is not None else False,
                    'is_file_name': file_name_idx == idx if file_name_idx is not None else False,
                    'check_same_value': same_value,
                    'name_jp': name_jp,
                    'name_local': name_local,
                    'column_raw_name': col_raw_name,
                    'unit': unit,
                    'is_checked': not same_value.get('is_null'),
                    'is_show': True,
                },
            )

        idx += 1

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
        df_rows = validate_datetime(df_rows, col_name, False, False)
        df_rows = convert_csv_timezone(df_rows, col_name)
        df_rows = df_rows.dropna(subset=[col_name])

    return df_rows


@log_execution_time()
def transform_df_to_rows(cols, df_rows, limit):
    df_rows.columns = normalize_list(df_rows.columns)
    normalized_cols = normalize_list(cols)
    return [
        dict(zip(normalized_cols, vals)) for vals in df_rows[0:limit][normalized_cols].to_records(index=False).tolist()
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

    dic_preview_limit['reach_fail_limit'] = bool(not rows and previewed_files)
    dic_preview_limit['file_name'] = file_name
    dic_preview_limit['folder'] = folder_path
    return dic_preview_limit


def is_valid_list(df_rows):
    return (isinstance(df_rows, list) and len(df_rows)) or (isinstance(df_rows, pd.DataFrame) and not df_rows.empty)


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
        file_name=v2_csv_detail.get('directory') if v2_csv_detail.get('is_file_path') else None,
    )
    for i, column in enumerate(v2_data_preview.get('header')):
        data_type = int(v2_data_preview.get('dataType')[i])
        v2_columns.append({'column_name': column, 'data_type': DataType(data_type).name, 'order': i})
    return v2_columns


@log_execution_time()
def retrieve_data_from_several_files(
    csv_files,
    csv_delimiter,
    max_record=1000,
    file_name=None,
    skip_head=None,
    n_rows: int | None = None,
    is_transpose: bool = False,
):
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
            data = read_data(
                csv_file,
                delimiter=csv_delimiter,
                do_normalize=False,
                skip_head=skip_head,
                n_rows=n_rows,
                is_transpose=is_transpose,
            )
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
        if (max_record and len(data_details) >= max_record) or over_timeout:
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
def extract_data_detail(header_names, data_details, org_header=None, is_show_raw_data=False):
    org_headers = org_header or header_names.copy()
    # normalization
    header_names = normalize_list(header_names)
    header_names = [normalize_str(col) for col in header_names]
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names, is_show_raw_data=is_show_raw_data)
    data_types = [gen_data_types(df_data_details[col]) for col in header_names]
    return df_data_details, org_headers, header_names, dupl_cols, data_types


def add_new_column_with_data(
    header_names,
    df_data_details,
    org_headers,
    data_types,
    index,
    data,
    new_data_type,
    new_col_name,
    is_gen_cols=None,
):
    df_cols = df_data_details.columns.tolist()
    header_names.insert(index, new_col_name)
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    suffix_header_names = header_names.copy()
    new_col = suffix_header_names.pop(index)
    rename_cols = dict(zip(df_cols, suffix_header_names))
    df_data_details = df_data_details.rename(columns=rename_cols)
    org_headers.insert(index, new_col_name)
    data_types.insert(index, new_data_type)
    df_data_details.insert(loc=index, column=new_col, value=data)
    if is_gen_cols:
        is_gen_cols.insert(index, False)
    return header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols


def add_show_file_name_column(header_names, df_data_details, org_headers, data_types, file_path, is_gen_cols=None):
    file_name_col_idx = len(header_names)
    file_name = os.path.basename(file_path)
    data = [file_name] * len(df_data_details)
    data_type = DataType.TEXT.value
    header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols = add_new_column_with_data(
        header_names,
        df_data_details,
        org_headers,
        data_types,
        file_name_col_idx,
        data,
        data_type,
        FILE_NAME,
        is_gen_cols,
    )
    return header_names, df_data_details, org_headers, data_types, dupl_cols, file_name_col_idx, is_gen_cols


def add_dummy_datetime_column(header_names, df_data_details, org_headers, data_types, is_gen_cols=None):
    dummy_datetime_col_idx = 0
    data = gen_dummy_datetime_data(df_data_details)
    data = data.strftime(DATE_FORMAT_SIMPLE)  # get raw string of datetime to show on sample data preview
    data_type = DataType.DATETIME.value
    header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols = add_new_column_with_data(
        header_names,
        df_data_details,
        org_headers,
        data_types,
        dummy_datetime_col_idx,
        data,
        data_type,
        DATETIME_DUMMY,
        is_gen_cols,
    )
    return header_names, df_data_details, org_headers, data_types, dupl_cols, dummy_datetime_col_idx, is_gen_cols


def add_generated_datetime_column(
    current_process_id: int,
    df_data_details,
    org_headers,
    header_names,
    dupl_cols,
    data_types,
):
    # get datetime column
    main_datetime_col = CfgProcessColumn.get_col_main_datetime(current_process_id)
    main_date_col = CfgProcessColumn.get_col_main_date(current_process_id)
    main_time_col = CfgProcessColumn.get_col_main_time(current_process_id)

    if main_date_col and main_time_col:
        column_name = main_datetime_col.column_name
        if column_name not in header_names:
            index = len(df_data_details.columns)
            # TODO: add sample data for datetime column
            data = [None] * len(df_data_details)
            data_type = DataType.DATETIME.value
            header_names, df_data_details, org_headers, data_types, dupl_cols, _ = add_new_column_with_data(
                header_names,
                df_data_details,
                org_headers,
                data_types,
                index,
                data,
                data_type,
                column_name,
            )

            # add sample data for datetime column
            df_data_details[column_name] = None
            proc_col = get_process_columns(current_process_id, show_graph=False)
            column_main_date_name = next(
                (col['column_name'] for col in proc_col if col.get('column_type') == DataColumnType.MAIN_DATE.value),
                None,
            )
            column_main_time_name = next(
                (col['column_name'] for col in proc_col if col.get('column_type') == DataColumnType.MAIN_TIME.value),
                None,
            )
            if column_main_date_name and column_main_time_name:
                df_data_details[column_name] = (
                    df_data_details[column_main_date_name].astype(str)
                    + HALF_WIDTH_SPACE
                    + df_data_details[column_main_time_name].astype(str)
                )

    return header_names, df_data_details, org_headers, data_types, dupl_cols, None


@log_execution_time()
def save_preview_data_file(
    data_source_id: int,
    data: dict,
    table_name=None,
    process_factid=None,
    etl_func=None,
):
    sample_data_file = gen_latest_record_result_file_path(
        data_source_id,
        table_name=table_name,
        process_factid=process_factid,
        etl_func=etl_func,
    )
    make_dir_from_file_path(sample_data_file)
    with open(sample_data_file, 'w') as outfile:
        json.dump(data, outfile)


def get_preview_data_files(data_source_id, table_name=None, process_factid=None, etl_func=None):
    folder_path = get_preview_data_file_folder(data_source_id)
    if check_exist(folder_path):
        _files = get_files(folder_path, extension=['csv', 'tsv', 'json'])
        file_name = gen_latest_record_result_file_path(
            data_source_id,
            table_name=table_name,
            process_factid=process_factid,
            etl_func=etl_func,
        )
        if file_name in _files:
            return file_name

    return None


def gen_latest_record_result_file_path(data_source_id, table_name=None, process_factid=None, etl_func=None):
    sample_data_path = get_preview_data_file_folder(data_source_id)
    if table_name:
        name = f'{data_source_id}_{table_name}'
        file_name = f'{name}.json' if not etl_func else f'{name}_{etl_func}.json'
    elif process_factid:
        file_name = (
            f'{data_source_id}_{process_factid}.json'
            if not etl_func
            else f'{data_source_id}_{process_factid}_{etl_func}.json'
        )
    else:
        file_name = f'{data_source_id}.json'
    sample_data_file = os.path.join(sample_data_path, file_name)
    return sample_data_file
