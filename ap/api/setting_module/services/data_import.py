from __future__ import annotations

import functools
import logging
import os.path
from datetime import datetime
from typing import Any, Literal, Optional

import numpy as np
import pandas as pd
from dateutil import tz
from pandas import DataFrame, Series

from ap.api.common.services.utils import gen_sql_and_params
from ap.common.common_utils import (
    convert_numeric_by_type,
    convert_time,
    gen_transaction_table_name,
    get_csv_delimiter,
    get_current_timestamp,
    parse_int_value,
)
from ap.common.constants import (
    CAST_DATA_TYPE_ERROR_MSG,
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_MSG,
    DATE_FORMAT_FOR_ONE_HOUR,
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_ONLY_DIGIT,
    DATETIME,
    EFA_HEADER_FLAG,
    EMPTY_STRING,
    TXT_FILE_TYPE,
    WR_HEADER_NAMES,
    WR_VALUES,
    CacheType,
    CfgConstantType,
    CsvDelimiter,
    DataColumnType,
    DataType,
    DBType,
    EFAColumn,
    JobStatus,
    JobType,
)
from ap.common.disk_usage import get_ip_address
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventExpireCache, EventQueue
from ap.common.path_utils import (
    get_basename,
    get_error_cast_path,
    get_error_duplicate_path,
    get_error_import_path,
    get_error_trace_path,
    make_dir_from_file_path,
    split_path_to_list,
)
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import read_data
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_df, normalize_str
from ap.common.timezone_utils import calc_offset_between_two_tz
from ap.import_filter.utils import import_filter_from_df
from ap.setting_module.models import (
    CfgConstant,
    CfgDataSource,
    CfgDataSourceDB,
    CfgProcess,
    CfgProcessColumn,
)
from ap.trace_data.transaction_model import DataCountTable, ImportHistoryTable, TransactionData

logger = logging.getLogger(__name__)

# csv_import : max id of cycles
# ( because of csv import performance, we make a deposit/a guess of cycle id number
# to avoid conflict of other csv import thread/job  )
csv_import_cycle_max_id = None

# index column in df
INDEX_COL = '__INDEX__'
CYCLE_TIME_COL = '__time__'

# file index col in df
FILE_IDX_COL = '__FILE_INDEX__'

# max insert record per job
RECORD_PER_COMMIT = 10_000

# range of time per sql

# N/A value lists
PANDAS_DEFAULT_NA = {
    '#N/A',
    '#N/A N/A',
    '#NA',
    '-1.#IND',
    '-1.#QNAN',
    '-NaN',
    '-nan',
    '1.#IND',
    '1.#QNAN',
    '<NA>',
    'N/A',
    'NA',
    'NULL',
    'NaN',
    'n/a',
    'nan',
    'null',
    'na',
}
NA_VALUES = {'na', '-', '--', '---', '#NULL!', '#REF!', '#VALUE!', '#NUM!', '#NAME?', '0/0', '-0/0'}
PREVIEW_ALLOWED_EXCEPTIONS = {'-', '--', '---'}
INF_VALUES = {'Inf', 'Infinity', '1/0', '#DIV/0!', float('inf'), np.inf}
INF_NEG_VALUES = {'-Inf', '-Infinity', '-1/0', '-#DIV/0!', float('-inf'), -np.inf}

ALL_SYMBOLS = set(PANDAS_DEFAULT_NA | NA_VALUES | INF_VALUES | INF_NEG_VALUES)
# let app can show preview and import all na column, as string
NORMAL_NULL_VALUES = {'NA', 'na', 'n/a', 'N/A', '<NA>', 'null', 'NULL', 'nan'}
# SPECIAL_SYMBOLS = ALL_SYMBOLS - NORMAL_NULL_VALUES - PREVIEW_ALLOWED_EXCEPTIONS
IS_ERROR_COL = '___ERR0R___'
ERR_COLS_NAME = '___ERR0R_C0LS___'


@log_execution_time('[DATA IMPORT]')
def import_data(df, target_cfg_process: CfgProcess, get_date_col, job_info=None, child_cfg_proc=None):
    df = import_filter_from_df(df, target_cfg_process)
    cycles_len = len(df)
    if not cycles_len:
        return 0

    insert_vals = gen_insert_cycle_values(df)
    # updated importing records number
    if not job_info.committed_count:
        job_info.committed_count = df.shape[0]

    # insert cycles
    # get cycle and sensor columns for insert sql
    dic_cfg_cols = {cfg_col.column_name: cfg_col for cfg_col in target_cfg_process.get_transaction_process_columns()}
    table_name = gen_transaction_table_name(target_cfg_process.id)
    dic_col_with_type = {dic_cfg_cols[col].bridge_column_name: dic_cfg_cols[col].data_type for col in df.columns}
    col_names = dic_col_with_type.keys()

    sql_params = get_insert_params(col_names)
    sql_insert = gen_bulk_insert_sql(table_name, *sql_params)
    with DbProxy(
        gen_data_source_of_universal_db(target_cfg_process.id),
        True,
        immediate_isolation_level=True,
    ) as db_instance:
        # add new column name if not exits
        TransactionData.add_columns(db_instance, table_name, dic_col_with_type)

        # insert transaction data
        insert_data(db_instance, sql_insert, insert_vals)

        # insert data count
        save_proc_data_count(db_instance, df, target_cfg_process.id, get_date_col)

    # update actual imported rows
    job_info.committed_count = df.shape[0]
    # insert import history
    if child_cfg_proc:
        save_import_history(child_cfg_proc.id, job_info=job_info)
    else:
        save_import_history(target_cfg_process.id, job_info=job_info)

    EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))

    return cycles_len


# -------------------------- Factory data import -----------------------------


@log_execution_time()
def update_or_create_constant_by_type(const_type, value=0):
    try:
        CfgConstant.create_or_update_by_type(const_type=const_type, const_value=value)
    except Exception as e:
        logger.exception(e)
        return False

    return True


# -------------------------- Factory past 1 days data import -----------------------------


@log_execution_time()
def check_db_con(db_type, host, port, dbname, schema, username, password):
    parsed_int_port = parse_int_value(port)
    if parsed_int_port is None and db_type.lower() != DBType.SQLITE.name.lower():
        return False

    # 　オブジェクトを初期化する
    db_source_detail = CfgDataSourceDB()
    db_source_detail.host = host
    db_source_detail.port = parsed_int_port
    db_source_detail.dbname = dbname
    db_source_detail.schema = schema
    db_source_detail.username = username
    db_source_detail.password = password

    db_source = CfgDataSource()
    db_source.db_detail = db_source_detail
    db_source.type = db_type

    # if we cannot connect, this will raise Exception
    # コネクションをチェックする
    DbProxy.check_db_connection(db_source, force=True)

    return True


@log_execution_time()
def write_error_trace(df_error: DataFrame, proc_name, file_path=None, ip_address=None):
    if not len(df_error):
        return df_error

    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()
    ip_address = f'_{ip_address}' if ip_address else ''

    base_name = f'_{get_basename(file_path)}' if file_path else ''

    file_name = f'{proc_name}{base_name}_{time_str}{ip_address}{TXT_FILE_TYPE}'
    full_path = os.path.join(get_error_trace_path(), file_name)
    make_dir_from_file_path(full_path)

    df_error.to_csv(full_path, sep=CsvDelimiter.TSV.value, header=None, index=False)

    return df_error


@log_execution_time()
def write_duplicate_import(df: DataFrame, file_name_elements: list[str]):
    if not len(df):
        return df

    file_name = '_'.join([str(element) for element in file_name_elements if element])
    export_file_name = f'{file_name}{TXT_FILE_TYPE}'
    full_path = os.path.join(get_error_duplicate_path(), export_file_name)
    # make folder
    make_dir_from_file_path(full_path)

    df.to_csv(full_path, sep=CsvDelimiter.TSV.value, header=None, index=False)

    return df


@log_execution_time()
def write_error_import(
    df_error: DataFrame,
    proc_name,
    file_path=None,
    error_file_delimiter=CsvDelimiter.CSV.value,
    csv_directory=None,
):
    if not len(df_error):
        return df_error

    if csv_directory:
        file_paths = split_path_to_list(file_path)
        csv_directories = split_path_to_list(csv_directory)
        file_name = file_paths[-1]
        folders = file_paths[len(csv_directories) : -1]
    else:
        time_str = convert_time(format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
        file_name = proc_name + '_' + time_str + TXT_FILE_TYPE
        folders = []

    full_path = os.path.join(get_error_import_path(), proc_name, *folders, file_name)
    full_path = full_path.replace('.zip', '')
    make_dir_from_file_path(full_path)

    df_error.to_csv(full_path, sep=error_file_delimiter, index=False)

    return df_error


def get_latest_records(cfg_process: CfgProcess):
    trans_data = TransactionData(cfg_process)
    dic_cols = {cfg_col.bridge_column_name: cfg_col.column_name for cfg_col in trans_data.cfg_process_columns}
    with DbProxy(gen_data_source_of_universal_db(cfg_process.id), True) as db_instance:
        cols, rows = trans_data.get_latest_records_by_process_id(db_instance)

    df = pd.DataFrame(rows, columns=[dic_cols[col_name] for col_name in cols])
    return df


@log_execution_time()
def write_error_cast_data_types(process: CfgProcess, failed_column_data: dict[CfgProcessColumn, list[object]]):
    """
    Export to csv file that contain all failed convert data for all
    :param process: a process object
    :param failed_column_data: a list of columns that failed convert data type
    """
    if not failed_column_data:
        return

    # Create file path & folder
    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()
    ip_address = f'_{ip_address}' if ip_address else ''
    file_name = f'{process.name}_{time_str}{ip_address}{TXT_FILE_TYPE}'
    full_path = os.path.join(get_error_cast_path(), file_name)
    make_dir_from_file_path(full_path)

    df = pd.DataFrame()
    for column, data in failed_column_data.items():
        column_name = column.bridge_column_name
        df[column_name] = pd.Series(data, dtype=object)
    df = gen_error_cast_output_df(process, df)

    # write data to file
    df.to_csv(full_path, sep=CsvDelimiter.TSV.value, header=None, index=False)

    return full_path


@log_execution_time()
def gen_error_cast_output_df(process: CfgProcess, df_error: DataFrame) -> DataFrame:
    """
    Generate a dataframe with title & error data
    :param process: a process object
    :param df_error: a dataframe containing error data
    :return: a dataframe with title & error data
    """

    df_output = df_error.copy()
    new_row = df_error.columns.tolist()
    columns = df_error.columns.tolist()
    if len(columns) == 1:
        columns.append('')
        new_row.append('')
        df_output[''] = ''

    df_output, _ = mark_error_records_in_df(df_output)

    df_output = add_row_to_df(df_output, columns, new_row)

    if len(columns) > 1:
        columns = columns[:2]

    new_row = ('', '')
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('Table Name', process.table_name)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('Process Name', process.name)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('', '')
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('', '')
    df_output = add_row_to_df(df_output, columns, new_row)

    error_type = CAST_DATA_TYPE_ERROR_MSG
    # error_type += '(!: Target column)'
    new_row = ('Error Type', error_type)
    df_output = add_row_to_df(df_output, columns, new_row)

    return df_output


@log_execution_time()
def gen_error_output_df(csv_file_name, dic_cols: dict[str, CfgProcessColumn], df_error, df_db, error_msgs=None):
    db_len = len(df_db)
    df_output = pd.concat([df_db, df_error], ignore_index=True)
    columns = df_output.columns.tolist()

    # extract error
    df_output, error_cols = mark_error_records_in_df(df_output)

    # error data
    new_row = columns
    df_output = add_row_to_df(df_output, columns, new_row, db_len, error_cols=error_cols)

    new_row = ('column name/sample data (first 10 & last 10)',)
    df_output = add_row_to_df(df_output, columns, new_row, db_len)

    new_row = ('Data File', csv_file_name)
    df_output = add_row_to_df(df_output, columns, new_row, db_len)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row, db_len)

    # data in db
    new_row = columns
    selected_columns = list(dic_cols.keys())
    df_output = add_row_to_df(df_output, columns, new_row, selected_columns=selected_columns, mark_not_set_cols=True)

    new_row = ('column name/sample data (latest 5)',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = [DataType[dic_cols[col_name].data_type].name for col_name in columns if col_name in dic_cols]
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('data type',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('Database',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    error_msg = '|'.join(error_msgs) if isinstance(error_msgs, (list, tuple)) else error_msgs

    error_type = error_msg or DATA_TYPE_ERROR_MSG
    error_type += '(!: Target column)'
    new_row = ('Error Type', error_type)
    df_output = add_row_to_df(df_output, columns, new_row)

    if ERR_COLS_NAME in df_output.columns:
        df_output = df_output.drop(columns=ERR_COLS_NAME)

    return df_output


@log_execution_time()
def gen_duplicate_output_df(
    dic_use_cols: dict[str, CfgProcessColumn],
    df_duplicate,
    csv_file_name=None,
    table_name=None,
    error_msgs=None,
):
    # db_name: if factory db -> db name
    #                           else if csv -> file name
    columns = df_duplicate.columns.tolist()

    # mark error
    df_output, _ = mark_error_records_in_df(df_duplicate)

    # duplicate data
    new_row = columns
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = (f'column name/duplicate data (total: {len(df_duplicate)} rows)',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = [dic_use_cols[col_name].raw_data_type for col_name in columns if col_name in dic_use_cols]
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('data type',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    if csv_file_name:
        new_row = ('Data File', csv_file_name)
        df_output = add_row_to_df(df_output, columns, new_row)

    if table_name:
        new_row = ('Table name', table_name)
        df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    error_msg = '|'.join(error_msgs) if isinstance(error_msgs, (list, tuple)) else error_msgs

    new_row = ('Error Type', error_msg or DATA_TYPE_DUPLICATE_MSG)
    df_output = add_row_to_df(df_output, columns, new_row)

    return df_output


@log_execution_time()
def add_row_to_df(
    df,
    columns,
    new_row,
    pos=0,  # position to put `new_row`
    error_cols: dict[str, str] | None = None,
    selected_columns=None,
    mark_not_set_cols=False,
):
    """Add new rows to the top of dataframe"""
    df_temp = pd.DataFrame({columns[i]: new_row[i] for i in range(len(new_row))}, index=[pos])

    # add ! to head of error columns
    if error_cols is not None:
        for col_val in error_cols:
            df_temp[col_val] = error_cols[col_val]

    # add bracket to unselected columns
    if mark_not_set_cols and selected_columns is not None and len(selected_columns):
        for col_val in columns:
            if col_val not in selected_columns:
                df_temp[col_val] = '({})'.format(col_val)

    df = pd.concat([df.iloc[0:pos], df_temp, df.iloc[pos:]]).reset_index(drop=True)

    return df


def mark_error_records_in_df(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
    """Mark error items with ***** and extract error columns from dataframe"""

    error_cols = {}
    if ERR_COLS_NAME in df.columns:
        df = df.astype(pd.StringDtype())
        for col_name in df.columns:
            if col_name in [ERR_COLS_NAME, IS_ERROR_COL]:
                continue

            is_error = df[ERR_COLS_NAME].str.contains(col_name, regex=False)
            if is_error.any():
                df.loc[is_error, col_name] = df.loc[is_error, col_name].fillna('') + '*****'
                error_cols[col_name] = f'!{col_name}'

        # not sure if this one is needed...
        # remove all error columns
        df[ERR_COLS_NAME] = None

    return df, error_cols


@log_execution_time()
def get_new_adding_columns(proc, dic_use_cols):
    proc_id = proc.id

    # exist sensors
    created_at = get_current_timestamp()
    dic_exist_sensor = {s.column_name: s for s in proc.sensors}
    missing_sensors = []
    for col_name, cfg_col in dic_use_cols.items():
        data_type = cfg_col.data_type
        # already exist
        if dic_exist_sensor.get(col_name):
            continue

        data_type_obj = DataType[data_type]
        if data_type_obj is DataType.DATETIME:
            data_type_obj = DataType.TEXT

        sensor = {
            'process_id': proc_id,
            'column_name': col_name,
            'type': data_type_obj.value,
            'created_at': created_at,
            'name_en': to_romaji(col_name),
        }
        missing_sensors.append(sensor)

    return missing_sensors


def csv_data_with_headers(csv_file_name, data_src):
    efa_header_exists = CfgConstant.get_efa_header_flag(data_src.id)
    read_directly_ok = True
    if efa_header_exists:
        try:
            # csv delimiter
            csv_delimiter = get_csv_delimiter(data_src.delimiter)

            # read file directly to get Line, Machine, Process
            csv_reader = read_data(csv_file_name, limit=5, delimiter=csv_delimiter, do_normalize=False)
            next(csv_reader)

            row_line = next(csv_reader)  # 2nd row
            line = normalize_str(row_line[1])  # 2nd cell

            row_process = next(csv_reader)  # 3rd row
            process = normalize_str(row_process[1])  # 2nd cell

            row_machine = next(csv_reader)  # 4th row
            machine = normalize_str(row_machine[1])  # 2nd cell

            etl_headers = {
                WR_HEADER_NAMES: [
                    EFAColumn.Line.name,
                    EFAColumn.Process.name,
                    EFAColumn.Machine.name,
                ],
                WR_VALUES: [line, process, machine],
            }
            return etl_headers[WR_HEADER_NAMES], etl_headers[WR_VALUES]
        except Exception as e:
            read_directly_ok = False
            logger.exception(e)

    # if there is no flag in DB or failed to read file directly -> call R script + save flag
    if not efa_header_exists or not read_directly_ok:
        csv_inst, _ = chw.get_file_info_py(csv_file_name)
        if isinstance(csv_inst, Exception):
            return csv_inst

        if csv_inst is None:
            return [], []

        etl_headers = chw.get_etl_headers(csv_inst)

        # save flag to db if header exists
        efa_header_exists = chw.get_efa_header_flag(csv_inst)
        if efa_header_exists:
            CfgConstant.create_or_update_by_type(
                const_type=CfgConstantType.EFA_HEADER_EXISTS.name,
                const_name=data_src.id,
                const_value=EFA_HEADER_FLAG,
            )

        return etl_headers[WR_HEADER_NAMES], etl_headers[WR_VALUES]


# -------------------------- shutdown app job -----------------------------


@log_execution_time()
def strip_special_symbol(data, is_dict=False):
    # TODO: convert to dataframe than filter is faster , but care about generation purpose ,
    #  we just need to read some rows

    def clean_value(val):
        str_val = str(val)
        if str_val in ALL_SYMBOLS or str_val.lower() in ALL_SYMBOLS:
            return ''
        return val

    if is_dict:

        def iter_func(x):
            return x.values()

    else:

        def iter_func(x):
            return x

    for row in data:
        if not row:
            continue
        new_row = {k: clean_value(v) for k, v in row.items()} if is_dict else [clean_value(v) for v in row]
        yield new_row


@log_execution_time()
def set_cycle_ids_to_df(df: DataFrame, start_cycle_id):
    """
    reset new cycle id to save to db
    :param df:
    :param start_cycle_id:
    :return:
    """
    df = df.reset_index(drop=True)
    df.index = df.index + start_cycle_id
    return df


# def gen_cycle_data(cycle_id, proc_id, cycle_time, created_at):
#     """
#     vectorize function , do not use decorator
#     :param cycle_id:
#     :param cycle_time:
#     :param proc_id:
#     :param created_at:
#     :return:
#     """
#     return dict(id=cycle_id, process_id=proc_id, time=cycle_time, created_at=created_at)


# def gen_sensors_data(cycle_id, sensor_id, sensor_val, created_at):
#     """
#     vectorize function , do not use decorator
#     :param cycle_id:
#     :param sensor_id:
#     :param sensor_val:
#     :param created_at:
#     :return:
#     """
#     return dict(cycle_id=cycle_id, sensor_id=sensor_id, value=sensor_val, created_at=created_at)


@log_execution_time()
def gen_import_job_info(job_info, save_res, start_time=None, end_time=None, imported_count=0, err_cnt=0, err_msgs=None):
    # start time
    if job_info.last_cycle_time:
        job_info.first_cycle_time = job_info.last_cycle_time
    else:
        job_info.first_cycle_time = start_time

    # end time
    job_info.last_cycle_time = end_time

    if isinstance(save_res, Exception):
        job_info.exception = save_res
        job_info.status = JobStatus.FATAL
    else:
        if imported_count:
            job_info.row_count = imported_count
            job_info.committed_count = imported_count
        else:
            job_info.row_count = save_res
            job_info.committed_count = save_res

        if job_info.err_msg or err_cnt > 0 or err_msgs:
            job_info.status = JobStatus.FAILED
        else:
            job_info.status = JobStatus.DONE

    # set msg
    if job_info.status == JobStatus.FAILED:
        if not job_info.err_msg and not err_msgs:
            msg = DATA_TYPE_ERROR_MSG
            job_info.data_type_error_cnt += err_cnt
        elif isinstance(err_msgs, (list, tuple)):
            msg = ','.join(err_msgs)
        else:
            msg = err_msgs

        if job_info.err_msg and msg:
            job_info.err_msg += msg
        else:
            job_info.err_msg = msg

    return job_info


@log_execution_time()
def validate_data(df: DataFrame, dic_use_cols, na_vals, exclude_cols=None):
    """
    validate data type, NaN values...
    :param df:
    :param dic_use_cols:
    :param na_vals:
    :param exclude_cols:
    :return:
    """
    from ap.api.setting_module.services.csv_import import convert_eu_decimal

    df = init_is_error_col(df)

    if exclude_cols is None:
        exclude_cols = []

    exclude_cols.append(IS_ERROR_COL)
    exclude_cols.append(ERR_COLS_NAME)

    # string + object + category
    float_cols = df.select_dtypes(include=['float32', 'float64']).columns.tolist()
    for col_name in df.columns:
        if col_name in exclude_cols:
            continue

        if col_name not in dic_use_cols:
            continue

        # data type that user chose
        user_data_type = dic_use_cols[col_name].data_type
        raw_data_type = dic_use_cols[col_name].raw_data_type
        column_type = dic_use_cols[col_name].column_type

        if col_name in float_cols:
            if user_data_type == DataType.INTEGER.name:
                df[col_name] = df[col_name].replace([np.inf, -np.inf], np.nan).astype(pd.Int64Dtype())
            # do nothing with float cols for now
            continue

        # convert inf , -inf to Nan
        nan, inf_neg_val, inf_val = return_inf_vals(user_data_type)
        to_replaces = [na_vals, INF_NEG_VALUES, INF_VALUES]
        replace_values = [nan, inf_neg_val, inf_val]
        # skip infinity for boolean dtype
        # there is a caveat case, where our `numeric_data` is `Int64` but boolean's `inf_val` is `string`
        if user_data_type == DataType.BOOLEAN.name:
            to_replaces = [na_vals]
            replace_values = [nan]

        # change boolean to string column name
        # handle case when importing boolean column as float
        # ask tuannh3 for more information
        if pd.api.types.is_bool_dtype(df[col_name]):
            df[col_name] = df[col_name].astype(pd.StringDtype()).str.lower()

        # convert K sep Int|Real data type
        if raw_data_type and DataType[raw_data_type] in [
            DataType.REAL_SEP,
            DataType.INTEGER_SEP,
            DataType.EU_REAL_SEP,
            DataType.EU_INTEGER_SEP,
        ]:
            df = convert_eu_decimal(df, col_name, raw_data_type)

        if column_type == DataColumnType.JUDGE.value:
            df[col_name] = convert_judge_values(df[col_name], dic_use_cols[col_name])

        if user_data_type in [DataType.INTEGER.name, DataType.REAL.name, DataType.BOOLEAN.name]:
            numeric_data, non_numeric_data = convert_numeric_by_type(df[col_name], user_data_type)
            df[col_name] = numeric_data

            # try to convert the unconverted values
            if len(non_numeric_data) > 0:
                # convert to string before converting to number
                non_numeric_data = non_numeric_data.astype(pd.StringDtype()).str.strip("'").str.strip()

                # need to handle boolean dtype
                if user_data_type == DataType.BOOLEAN.name:
                    non_numeric_data = non_numeric_data.replace(['true', 'false'], ['1', '0'])

                # try to convert to numeric again with those from string
                numeric_data_from_str, non_numeric_data = convert_numeric_by_type(non_numeric_data, user_data_type)

                # set converted number to `col_name`
                df.loc[numeric_data_from_str.index, col_name] = numeric_data_from_str

            # There are still some `non_numeric_data`, we convert them into `NA`, `INF` and `INF_NEG`
            # If this is True, it means `non_numeric_data` is now string
            if len(non_numeric_data):
                for to_replace, replace_value in zip(to_replaces, replace_values):
                    replaceable = non_numeric_data.isin(to_replace)

                    # set those replaceable with new replace_value
                    df.loc[non_numeric_data[replaceable].index, col_name] = replace_value

                    # remove them from `non_numeric_data`
                    non_numeric_data = non_numeric_data[~replaceable]

            if len(non_numeric_data):
                # TODO: separate them using `set_error_col`
                df.loc[non_numeric_data.index, IS_ERROR_COL] = 1
                df.loc[non_numeric_data.index, ERR_COLS_NAME] += f'{col_name},'

                try:
                    # report some here, we might not need this for better performance ...
                    pd.to_numeric(non_numeric_data)
                except Exception as e:
                    logger.exception(e)

            # replace Inf --> None
            if user_data_type == DataType.INTEGER.name:
                df[col_name] = df[col_name].replace([np.inf, -np.inf], np.nan).astype(pd.Int64Dtype())
        # elif user_data_type == DataType.BOOLEAN.name and column_type == DataColumnType.JUDGE.value:
        #     df = convert_judge_values(df, dic_use_cols[col_name])
        elif user_data_type == DataType.TEXT.name:
            if pd.api.types.is_object_dtype(df[col_name]):
                df[col_name] = df[col_name].astype(pd.StringDtype()).str.strip("'").str.strip()
            elif pd.api.types.is_string_dtype(df[col_name]):
                df[col_name] = df[col_name].str.strip("'").str.strip()
            else:
                # convert to string before insert to database
                df[col_name] = df[col_name].astype(pd.StringDtype())
                # previously this is not string.
                # However, every value to be replaced are string (except inf values)
                # so we can skip them here.
                continue

            # replace string to correct values
            # refer to csv files in <https://trello.com/c/YtbtrFUk/213-13e-import-data-with-column-name-is-empty>
            # we only replace if df has non-na, this is legacy code.
            if df[col_name].notna().any():
                for to_replace, replace_value in zip(to_replaces, replace_values):
                    df.loc[df[col_name].isin(to_replace), col_name] = replace_value

    return df


def return_inf_vals(data_type):
    if data_type == DataType.REAL.name:
        return np.nan, -np.inf, np.inf
    elif data_type == DataType.INTEGER.name:
        return pd.NA, pd.NA, pd.NA

    # pandas replace does not work with None, we must use pd.NA here
    # <https://stackoverflow.com/questions/17097236/replace-invalid-values-with-none-in-pandas-dataframe>
    return pd.NA, '-inf', 'inf'


@log_execution_time()
def data_pre_processing(
    df,
    orig_df,
    dic_use_cols,
    na_values=None,
    exclude_cols=None,
    get_date_col=None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return non_error_df and error_df"""
    if exclude_cols is None:
        exclude_cols = []
    if na_values is None:
        na_values = PANDAS_DEFAULT_NA | NA_VALUES

    # string parse
    cols = get_object_cols(df)
    df[cols] = df[cols].astype(pd.StringDtype())
    cols += get_string_cols(df)
    # normalization
    for col in cols:
        df[col] = normalize_df(df, col)

    # parse data type
    df = validate_data(df, dic_use_cols, na_values, exclude_cols)

    columns = list(set(df.columns) - set(exclude_cols))

    # If there are all invalid values in one row, the row will be invalid and not be imported to database
    # Otherwise, invalid values will be set nan in the row and be imported normally
    is_error_row_series = df[IS_ERROR_COL] == 1
    if get_date_col:
        # FIXME: is this needed in new pandas?
        # datetime_col as string, but value is 'nan' -> could not filter by isnull
        datetime_series = pd.to_datetime(df[get_date_col])
        is_error_row_series &= datetime_series.isna() | df[columns].isna().all(axis=1)
    else:
        is_error_row_series &= df[columns].isna().all(axis=1)

    df_error = orig_df
    df_error[ERR_COLS_NAME] = df[ERR_COLS_NAME]
    df_error = df_error[is_error_row_series]

    # remove status column ( no need anymore )
    df = df.drop(columns=[IS_ERROR_COL, ERR_COLS_NAME])[~is_error_row_series]

    return df, df_error


# @log_execution_time()
# def get_from_to_substring_col(sensor):
#     substr_regex = re.compile(SUB_STRING_REGEX)
#     from_to_pos = substr_regex.match(sensor.column_name)
#     if not from_to_pos:
#         return None
#
#     from_char = int(from_to_pos[2]) - 1
#     to_char = int(from_to_pos[3])
#     substr_cls = find_sensor_class(sensor.id, DataType(sensor.type))
#
#     return substr_cls, from_char, to_char


# @log_execution_time()
# def gen_substr_data(substr_sensor, df, col_name):
#     """
#     generate data for sub string column from original data
#     :param substr_sensor:
#     :param df:
#     :param col_name:
#     :return:
#     """
#     substr_check_res = get_from_to_substring_col(substr_sensor)
#     if not substr_check_res:
#         return None, None
#
#     substr_cls, from_char, to_char = substr_check_res
#
#     sub_col_name = add_new_col_to_df(df, f'{col_name}_{from_char}_{to_char}', df[col_name].str[from_char:to_char])
#
#     # # remove blank values (we need to insert the same with proclink, so do not move blank)
#     # df_insert = df[df[sub_col_name] != '']
#     # if not len(df_insert):
#     #     return None, None
#
#     # gen insert data
#     sensor_vals = gen_insert_sensor_values(df, substr_sensor.id, sub_col_name)
#
#     return substr_cls, sensor_vals


# @log_execution_time()
# def get_data_without_na(data):
#     valid_rows = []
#     for row in data:
#         # exclude_na = False not in [col not in ALL_SYMBOLS for col in row]
#         if any([val in ALL_SYMBOLS for val in row]):
#             continue
#
#         valid_rows.append(row)
#     return valid_rows


def get_string_cols(df: DataFrame):
    return [col for col in df.columns if df[col].dtype.name.lower() == 'string']


def get_object_cols(df: DataFrame):
    return [col for col in df.columns if df[col].dtype.name.lower() == 'object']


@log_execution_time('[CONVERT DATE TIME TO UTC')
def convert_df_col_to_utc(df, get_date_col, is_timezone_inside, db_time_zone, utc_time_offset):
    if DATETIME not in df[get_date_col].dtype.name:
        # create datetime column in df
        # if data has tz info, convert to utc
        df[get_date_col] = pd.to_datetime(df[get_date_col], errors='coerce', utc=is_timezone_inside)

    if not db_time_zone:
        db_time_zone = tz.tzlocal()

    local_dt = df[get_date_col]
    # return if there is utc
    if not utc_time_offset:
        # utc_offset = 0
        return local_dt

    if not local_dt.dt.tz:
        # utc_time_offset = 0: current UTC
        # cast to local before convert to utc
        local_dt = local_dt.dt.tz_localize(tz=db_time_zone, ambiguous='infer')
    return local_dt.dt.tz_convert(tz.tzutc())


@log_execution_time()
def convert_df_datetime_to_str(df: DataFrame, get_date_col):
    return df[get_date_col].dt.strftime(DATE_FORMAT_STR).astype(pd.StringDtype())


@log_execution_time()
def validate_datetime(
    df: DataFrame,
    date_col,
    is_strip=True,
    add_is_error_col=True,
    empty_as_error=True,
    is_convert_datetime=True,
):
    # We validate based on string, so we must convert them into string first.
    df[date_col] = df[date_col].astype(pd.StringDtype())

    # Somehow, pandas does not allow to convert to `string`, we skip for now.
    # But this is error, might need to address it.
    if not pd.api.types.is_string_dtype(df[date_col]):
        logger.error('validate_datetime: cannot convert `date_col` to `string`')
        return df

    # for csv data
    if is_strip:
        df[date_col] = df[date_col].str.strip("'").str.strip()

    # Need to check `is_empty` here, before converting them into datetime datetype.
    is_empty = df[date_col].str.strip() == EMPTY_STRING

    if is_convert_datetime:
        try:
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce', format='mixed')
        except TypeError:
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')

    # mark error records
    if add_is_error_col:
        df = init_is_error_col(df)
        is_error = df[date_col].isna()
        if empty_as_error:
            is_error |= is_empty
        df = set_error_col(df, is_error, date_col)

    return df


def init_is_error_col(df: DataFrame):
    if IS_ERROR_COL not in df.columns:
        df[IS_ERROR_COL] = 0
    if ERR_COLS_NAME not in df.columns:
        df[ERR_COLS_NAME] = ''
    return df


def set_error_col(df: pd.DataFrame, is_error: pd.Series[bool], col_name: str) -> pd.DataFrame:
    df = init_is_error_col(df)
    if is_error.any():
        # if `is_error` is False use old value, otherwise use 1
        df[IS_ERROR_COL] = df[IS_ERROR_COL].where(~is_error, 1)

        # if `is_error` is False use old value, otherwise use `err_col_name`
        err_col_name = df[ERR_COLS_NAME] + f'{col_name},'
        df[ERR_COLS_NAME] = df[ERR_COLS_NAME].where(~is_error, err_col_name)

    return df


@log_execution_time()
def check_update_time_by_changed_tz(proc_cfg: CfgProcess, time_zone=None):
    if time_zone is None:
        time_zone = tz.tzutc()

    use_os_tz = proc_cfg.data_source.db_detail.use_os_timezone
    # check use ose time zone
    if check_timezone_changed(proc_cfg.id, use_os_tz):
        # convert to local or convert from local
        if use_os_tz:
            # calculate offset +/-HH:MM
            tz_offset = calc_offset_between_two_tz(time_zone, tz.tzlocal())
        else:
            tz_offset = calc_offset_between_two_tz(tz.tzlocal(), time_zone)

        if tz_offset is None:
            return None

        # update time to new time zone
        trans_data = TransactionData(proc_cfg.id)
        with DbProxy(gen_data_source_of_universal_db(proc_cfg.id), True, True) as db_instance:
            trans_data.update_timezone(db_instance, tz_offset)

    # save latest use os time zone flag to db
    save_use_os_timezone_to_db(proc_cfg.id, use_os_tz)

    return True


@log_execution_time()
def check_timezone_changed(proc_id, yml_use_os_timezone):
    """check if use os timezone was changed by user

    Args:
        proc_id ([type]): [description]
        yml_use_os_timezone ([type]): [description]

    Returns:
        [type]: [description]
    """
    if yml_use_os_timezone is None:
        return False

    db_use_os_tz = CfgConstant.get_value_by_type_name(
        CfgConstantType.USE_OS_TIMEZONE.name,
        proc_id,
        lambda x: bool(int(x)),
    )
    if db_use_os_tz is None:
        return False

    if db_use_os_tz == yml_use_os_timezone:
        return False

    return True


@log_execution_time()
def save_use_os_timezone_to_db(proc_id, yml_use_os_timezone):
    """save os timezone to constant table

    Args:
        proc_id ([type]): [description]
        yml_use_os_timezone ([type]): [description]

    Returns:
        [type]: [description]
    """
    if not yml_use_os_timezone:
        yml_use_os_timezone = False

    CfgConstant.create_or_update_by_type(
        const_type=CfgConstantType.USE_OS_TIMEZONE.name,
        const_value=yml_use_os_timezone,
        const_name=proc_id,
    )

    return True


@log_execution_time()
def gen_insert_cycle_values(df):
    # https://github.com/pandas-dev/pandas/issues/55127
    # Pandas 2.0 failed to convert pd.NA to np.nan
    cycle_vals = df.replace({pd.NA: None}).to_records(index=False).tolist()
    return cycle_vals


@log_execution_time()
def insert_data(db_instance, sql, vals):
    try:
        db_instance.execute_sql_in_transaction(sql, vals)
        return True
    except Exception as e:
        logger.error(e)
        return False


@log_execution_time()
def gen_bulk_insert_sql(tblname, cols_str, params_str):
    sql = f'INSERT INTO {tblname} ({cols_str}) VALUES ({params_str})'

    return sql


# @log_execution_time()
# def get_cycle_columns():
#     return (
#         ID,
#         Cycle.process_id.key,
#         TIME_COL,
#         Cycle.is_outlier.key,
#         Cycle.created_at.key,
#     )


# @log_execution_time()
# def get_sensor_columns():
#     return SensorType.cycle_id.key, SensorType.sensor_id.key, SensorType.value.key


@log_execution_time()
def get_insert_params(columns):
    cols_str = ','.join(columns)
    params_str = ','.join(['?'] * len(columns))

    return cols_str, params_str


@log_execution_time()
def get_record_from_obj(columns, object_data):
    return [object_data[col] for col in columns]


@log_execution_time()
def insert_data_to_db(cycle_vals, sql_insert_cycle):
    with DbProxy(gen_data_source_of_universal_db(), True, immediate_isolation_level=True) as db_instance:
        # insert cycle
        insert_data(db_instance, sql_insert_cycle, cycle_vals)

    EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))


def get_df_first_n_last(df: DataFrame, first_count=10, last_count=10):
    if len(df) <= first_count + last_count:
        return df
    return pd.concat([df.head(first_count), df.tail(last_count)])


@log_execution_time()
def save_proc_data_count(db_instance, df, proc_id, get_date_col):
    save_proc_data_count_multiple_dfs(
        db_instance,
        proc_id=proc_id,
        get_date_col=get_date_col,
        dfs_push_to_db=df,
    )


def save_proc_data_count_multiple_dfs(
    db_instance,
    *,
    proc_id,
    get_date_col,
    dfs_push_to_db: list[pd.DataFrame] | pd.DataFrame = None,
    dfs_pop_from_db: list[pd.DataFrame] | pd.DataFrame = None,
    dfs_push_to_file: list[pd.DataFrame] | pd.DataFrame = None,
    dfs_pop_from_file: list[pd.DataFrame] | pd.DataFrame = None,
):
    def check_args(dfs):
        if dfs is None:
            return []
        if not isinstance(dfs, list):
            return [dfs]
        return dfs

    dfs_push_to_db = check_args(dfs_push_to_db)
    dfs_pop_from_db = check_args(dfs_pop_from_db)
    dfs_push_to_file = check_args(dfs_push_to_file)
    dfs_pop_from_file = check_args(dfs_pop_from_file)

    get_proc_data_count_df_func = functools.partial(
        get_proc_data_count_df,
        get_date_col=get_date_col,
    )
    # TODO: aggregate to one df instead of run 4 times
    aggregated_df = pd.DataFrame()

    for df in dfs_push_to_db:
        count_df = get_proc_data_count_df_func(df, is_db=True, decrease=False)
        aggregated_df = pd.concat([aggregated_df, count_df])

    for df in dfs_pop_from_db:
        count_df = get_proc_data_count_df_func(df, is_db=True, decrease=True)
        aggregated_df = pd.concat([aggregated_df, count_df])

    for df in dfs_push_to_file:
        count_df = get_proc_data_count_df_func(df, is_db=False, decrease=False)
        aggregated_df = pd.concat([aggregated_df, count_df])

    for df in dfs_pop_from_file:
        count_df = get_proc_data_count_df_func(df, is_db=False, decrease=True)
        aggregated_df = pd.concat([aggregated_df, count_df])

    if aggregated_df.empty:
        return

    agg_keys = {DataCountTable.count.name: 'sum', DataCountTable.count_file.name: 'sum'}
    aggregated_df = aggregated_df.groupby(DataCountTable.datetime.name).agg(agg_keys).reset_index()

    sql_vals = aggregated_df.to_records(index=False).tolist()
    sql_params = get_insert_params(DataCountTable.get_keys())
    sql_insert = gen_bulk_insert_sql(DataCountTable.get_table_name(proc_id), *sql_params)

    insert_data(db_instance, sql_insert, sql_vals)
    EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))


def get_proc_data_count_df(df, *, get_date_col, decrease: bool, is_db: bool):
    if df.empty:
        return pd.DataFrame()

    count_column = DataCountTable.count.name if is_db else DataCountTable.count_file.name
    count_df = calculate_value_counts_per_hours(df, get_date_col, count_column=count_column)
    if decrease:
        count_df[count_column] = -count_df[count_column]

    return count_df


@log_execution_time()
def save_import_history(proc_id, job_info):
    if not job_info.dic_imported_row:
        job_info.dic_imported_row = {0: (job_info.target, job_info.committed_count)}

    sql: Optional[str] = None
    sql_params: list[list[Any]] = []

    for _, (target_file, imported_row) in job_info.dic_imported_row.items():
        status = (
            job_info.status.name if isinstance(job_info.status, JobStatus) else job_info.status or JobStatus.DONE.name
        )
        import_history = ImportHistoryTable(
            job_id=job_info.job_id,
            import_type=job_info.import_type,
            file_name=None,
            import_from=None,
            import_to=None,
            imported_row=None,
            status=status,
            error_msg=job_info.err_msg or None,
            start_tm=job_info.start_tm or get_current_timestamp(),
            end_tm=job_info.end_tm or get_current_timestamp(),
            created_at=get_current_timestamp(),
            updated_at=get_current_timestamp(),
        )

        if isinstance(job_info.status, JobStatus):
            # convert to string instead of JobStatus type
            import_history.status = job_info.status.name

        if not job_info.import_type or job_info.import_type == JobType.CSV_IMPORT.name:
            # for csv import
            import_history.file_name = target_file
            import_history.imported_row = imported_row
        else:
            if not job_info.import_from:
                job_info.import_from = job_info.first_cycle_time
            if not job_info.import_to:
                job_info.import_to = job_info.last_cycle_time
            # for factory import
            import_history.import_from = job_info.import_from
            import_history.import_to = job_info.import_to
            import_history.imported_row = job_info.committed_count

        table = ImportHistoryTable.table(proc_id=proc_id)
        insert_stmt = table.insert().values(**import_history.model_dump())
        sql, params = gen_sql_and_params(insert_stmt)
        sql_params.append(params)

    if sql is not None:
        with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
            insert_data(db_instance, sql, sql_params)


@log_execution_time()
def save_failed_import_history(proc_id, job_info, error_type):
    job_info.status = JobStatus.FAILED.name
    job_info.err_msg = error_type
    # save import history before return
    # insert import history
    save_import_history(proc_id, job_info)


@log_execution_time()
def calculate_value_counts_per_hours(
    df: DataFrame,
    get_date_col,
    count_column: Literal['count', 'count_file'] = DataCountTable.count.name,
):
    if not df.size or not get_date_col:
        return None

    s = pd.to_datetime(df[get_date_col], errors='coerce')
    s: Series = (s.dt.year * 1_00_00_00 + s.dt.month * 1_00_00 + s.dt.day * 1_00 + s.dt.hour).value_counts()
    count_df = s.rename(count_column).reset_index(name=count_column)
    count_df = count_df.rename(columns={get_date_col: DataCountTable.datetime.name})
    count_df[DataCountTable.datetime.name] = pd.to_datetime(
        count_df[DataCountTable.datetime.name],
        format='%Y%m%d%H',
    ).dt.strftime(DATE_FORMAT_FOR_ONE_HOUR)

    if count_column == DataCountTable.count.name:
        count_df[DataCountTable.count_file.name] = 0
    else:
        count_df[DataCountTable.count.name] = 0

    return count_df


@log_execution_time()
def convert_judge_values(series: pd.Series, col: CfgProcessColumn):
    judge_positive_value = col.judge_positive_value
    if col.parent_column is not None:
        judge_positive_value = col.parent_column.judge_positive_value
    series = series.apply(lambda x: x if pd.isna(x) else (1 if x == judge_positive_value else 0))

    return series
