import os.path
import traceback
from datetime import datetime
from typing import List

import numpy as np
import pandas as pd
from dateutil import tz
from pandas import DataFrame, Series

from ap.common.common_utils import (
    DATE_FORMAT_FOR_ONE_HOUR,
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_ONLY_DIGIT,
    TXT_FILE_TYPE,
    convert_time,
    gen_transaction_table_name,
    get_basename,
    get_csv_delimiter,
    get_current_timestamp,
    get_error_duplicate_path,
    get_error_import_path,
    get_error_trace_path,
    make_dir_from_file_path,
    parse_int_value,
    split_path_to_list,
)
from ap.common.constants import (
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_MSG,
    DATETIME,
    EFA_HEADER_FLAG,
    WR_HEADER_NAMES,
    WR_VALUES,
    CacheType,
    CfgConstantType,
    CsvDelimiter,
    DataType,
    DBType,
    EFAColumn,
    JobStatus,
    JobType,
)
from ap.common.disk_usage import get_ip_address
from ap.common.logger import log_execution_time, logger
from ap.common.memoize import set_all_cache_expired
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import read_data
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_df, normalize_str
from ap.common.timezone_utils import calc_offset_between_two_tz
from ap.setting_module.models import (
    CfgConstant,
    CfgDataSource,
    CfgDataSourceDB,
    CfgProcess,
    CfgProcessColumn,
)
from ap.trace_data.transaction_model import DataCountTable, ImportHistoryTable, TransactionData

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
}
NA_VALUES = {'na', '-', '--', '---', '#NULL!', '#REF!', '#VALUE!', '#NUM!', '#NAME?', '0/0'}
INF_VALUES = {'Inf', 'Infinity', '1/0', '#DIV/0!', float('inf')}
INF_NEG_VALUES = {'-Inf', '-Infinity', '-1/0', float('-inf')}

ALL_SYMBOLS = set(PANDAS_DEFAULT_NA | NA_VALUES | INF_VALUES | INF_NEG_VALUES)
# let app can show preview and import all na column, as string
NORMAL_NULL_VALUES = {'NA', 'na', 'null'}
SPECIAL_SYMBOLS = ALL_SYMBOLS - NORMAL_NULL_VALUES - {'-'}
IS_ERROR_COL = '___ERR0R___'
ERR_COLS_NAME = '___ERR0R_C0LS___'


@log_execution_time('[DATA IMPORT]')
def import_data(df, proc_id, get_date_col, cfg_columns: List[CfgProcessColumn], job_info=None):
    cycles_len = len(df)
    if not cycles_len:
        return 0

    insert_vals = gen_insert_cycle_values(df)
    # updated importing records number
    if not job_info.committed_count:
        job_info.committed_count = df.shape[0]

    # insert cycles
    # get cycle and sensor columns for insert sql
    dic_cfg_cols = {cfg_col.column_name: cfg_col for cfg_col in cfg_columns}
    table_name = gen_transaction_table_name(proc_id)
    dic_col_with_type = {dic_cfg_cols[col].bridge_column_name: dic_cfg_cols[col].data_type for col in df.columns}
    col_names = dic_col_with_type.keys()

    # add new column name if not exits
    add_new_not_exits_columns(proc_id, table_name, dic_col_with_type)

    sql_params = get_insert_params(col_names)
    sql_insert = gen_bulk_insert_sql(table_name, *sql_params)
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        # insert transaction data
        insert_data(db_instance, sql_insert, insert_vals)

        # insert data count
        save_proc_data_count(db_instance, df, proc_id, get_date_col)

    # update actual imported rows
    job_info.committed_count = df.shape[0]
    # insert import history
    save_import_history(proc_id, job_info=job_info)

    # clear cache
    # TODO: clear cache in main thread
    set_all_cache_expired(CacheType.TRANSACTION_DATA)

    return cycles_len


# -------------------------- Factory data import -----------------------------


@log_execution_time()
def update_or_create_constant_by_type(const_type, value=0):
    try:
        CfgConstant.create_or_update_by_type(const_type=const_type, const_value=value)
    except Exception:
        traceback.print_exc()
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

    # 戻り値の初期化
    result = False

    # コネクションをチェックする
    with DbProxy(db_source, force_connect=True) as db_instance:
        if db_instance.is_connected:
            result = True

    return result


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
def write_duplicate_import(df: DataFrame, file_name_elements: List):
    if not len(df):
        return df

    file_name = '_'.join([element for element in file_name_elements if element])
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


def get_latest_records(proc_id):
    trans_data = TransactionData(proc_id)
    dic_cols = {cfg_col.bridge_column_name: cfg_col.column_name for cfg_col in trans_data.cfg_process_columns}
    with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
        cols, rows = trans_data.get_latest_records_by_process_id(db_instance)

    df = pd.DataFrame(rows, columns=[dic_cols[col_name] for col_name in cols])
    return df


def gen_error_output_df(csv_file_name, dic_cols, df_error, df_db, error_msgs=None):
    db_len = len(df_db)
    df_db = df_db.append(df_error, ignore_index=True)
    columns = df_db.columns.tolist()

    # error data
    new_row = columns
    df_db = add_row_to_df(df_db, columns, new_row, db_len, rename_err_cols=True)

    new_row = ('column name/sample data (first 10 & last 10)',)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    new_row = ('Data File', csv_file_name)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    # data in db
    new_row = columns
    selected_columns = list(dic_cols.keys())
    df_db = add_row_to_df(df_db, columns, new_row, selected_columns=selected_columns, mark_not_set_cols=True)

    new_row = ('column name/sample data (latest 5)',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = [DataType[dic_cols[col_name].data_type].name for col_name in columns if col_name in dic_cols]
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('data type',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('Database',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row)

    error_msg = '|'.join(error_msgs) if isinstance(error_msgs, (list, tuple)) else error_msgs

    error_type = error_msg or DATA_TYPE_ERROR_MSG
    error_type += '(!: Target column)'
    new_row = ('Error Type', error_type)
    df_db = add_row_to_df(df_db, columns, new_row)

    if ERR_COLS_NAME in df_db.columns:
        df_db.drop(columns=ERR_COLS_NAME, inplace=True)

    return df_db


@log_execution_time()
def gen_duplicate_output_df(dic_use_cols, df_duplicate, csv_file_name=None, table_name=None, error_msgs=None):
    # db_name: if factory db -> db name
    #                           else if csv -> file name
    columns = df_duplicate.columns.tolist()

    # duplicate data
    new_row = columns
    df_output = add_row_to_df(df_duplicate, columns, new_row)

    new_row = (f'column name/duplicate data (total: {len(df_duplicate)} rows)',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = ('',)
    df_output = add_row_to_df(df_output, columns, new_row)

    new_row = [dic_use_cols[col_name].predict_type for col_name in columns if col_name in dic_use_cols]
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


def add_row_to_df(df, columns, new_row, pos=0, rename_err_cols=False, selected_columns=[], mark_not_set_cols=False):
    df_temp = pd.DataFrame({columns[i]: new_row[i] for i in range(len(new_row))}, index=[pos])

    error_cols = {}
    if ERR_COLS_NAME in df.columns:
        df = df.astype('string')
        for i in range(len(df)):
            for col_name in df.columns:
                if (
                    not pd.isna(df.iloc[i][ERR_COLS_NAME])
                    and col_name in df.iloc[i][ERR_COLS_NAME]
                    and col_name not in [ERR_COLS_NAME, IS_ERROR_COL]
                ):
                    df.loc[i, col_name] = '{}*****'.format(df.iloc[i][col_name])
                    error_cols[col_name] = '!{}'.format(col_name)
            df.loc[i, ERR_COLS_NAME] = None

    # add ! to head of error columns
    if rename_err_cols:
        for col_val in error_cols:
            df_temp[col_val] = error_cols[col_val]

    # add bracket to unselected columns
    if mark_not_set_cols and len(selected_columns):
        for col_val in columns:
            if col_val not in selected_columns:
                df_temp[col_val] = '({})'.format(col_val)

    df = pd.concat([df.iloc[0:pos], df_temp, df.iloc[pos:]]).reset_index(drop=True)

    return df


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
            csv_reader = read_data(csv_file_name, end_row=5, delimiter=csv_delimiter, do_normalize=False)
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
        except Exception:
            read_directly_ok = False
            traceback.print_exc()

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

    if is_dict:

        def iter_func(x):
            return x.values()

    else:

        def iter_func(x):
            return x

    for row in data:
        is_ng = False
        if not row:
            continue
        for val in iter_func(row):
            if str(val).lower() in SPECIAL_SYMBOLS:
                is_ng = True
                break

        if not is_ng:
            yield row


@log_execution_time()
def set_cycle_ids_to_df(df: DataFrame, start_cycle_id):
    """
    reset new cycle id to save to db
    :param df:
    :param start_cycle_id:
    :return:
    """
    df.reset_index(drop=True, inplace=True)
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

        if job_info.err_msg:
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

    init_is_error_col(df)

    if exclude_cols is None:
        exclude_cols = []

    exclude_cols.append(IS_ERROR_COL)
    exclude_cols.append(ERR_COLS_NAME)

    # string + object + category
    float_cols = df.select_dtypes(include=['float']).columns.tolist()
    int_cols = df.select_dtypes(include=['integer']).columns.tolist()
    for col_name in df.columns:
        if col_name in exclude_cols:
            continue

        if col_name not in dic_use_cols:
            continue

        # do nothing with int column
        if col_name in int_cols:
            continue

        # data type that user chose
        user_data_type = dic_use_cols[col_name].data_type

        # do nothing with float column
        if col_name in float_cols and user_data_type != DataType.INTEGER.name:
            continue

        # convert inf , -inf to Nan
        nan, inf_neg_val, inf_val = return_inf_vals(user_data_type)
        if col_name in float_cols and user_data_type == DataType.INTEGER.name:
            df.loc[df[col_name].isin([float('inf'), float('-inf')]), col_name] = nan
            non_na_vals = df[col_name].dropna()
            if len(non_na_vals):
                df.loc[non_na_vals.index, col_name] = df.loc[non_na_vals.index, col_name].astype('Int64')

            continue

        # strip quotes and spaces
        dtype_name = df[col_name].dtype.name
        if user_data_type in [DataType.INTEGER.name, DataType.REAL.name]:
            vals = df[col_name].copy()

            # convert numeric values
            numerics = pd.to_numeric(vals, errors='coerce')
            df[col_name] = numerics

            # strip quote space then convert non numeric values
            non_num_idxs = numerics.isna()
            non_numerics = vals.loc[non_num_idxs].dropna()
            if len(non_numerics):
                non_num_idxs = non_numerics.index
                non_numerics = non_numerics.astype(str).str.strip("'").str.strip()

                # convert non numeric again
                numerics = pd.to_numeric(non_numerics, errors='coerce')
                df.loc[non_num_idxs, col_name] = numerics

                # set error for non numeric values
                non_num_idxs = numerics.isna()
                for idx, is_true in non_num_idxs.items():
                    if not is_true:
                        continue

                    if vals.at[idx] in na_vals:
                        df.at[idx, col_name] = nan
                    elif vals.at[idx] in INF_VALUES:
                        df.at[idx, col_name] = inf_val
                    elif vals.at[idx] in INF_NEG_VALUES:
                        df.at[idx, col_name] = inf_neg_val
                    else:
                        df.at[idx, IS_ERROR_COL] = 1
                        df.at[idx, ERR_COLS_NAME] = df[ERR_COLS_NAME].at[idx] + '{},'.format(col_name)

                try:
                    if len(non_num_idxs):
                        pd.to_numeric(df.loc[non_num_idxs.index, col_name], errors='raise')
                except Exception as ex:
                    logger.exception(ex)

            # replace Inf --> None
            if user_data_type == DataType.INTEGER.name:
                df.loc[df[col_name].isin([float('inf'), float('-inf')]), col_name] = nan

        elif user_data_type == DataType.TEXT.name:
            if dtype_name == 'boolean':
                df[col_name] = df[col_name].replace({True: 'True', False: 'False'})
            else:
                idxs = df[col_name].dropna().index
                if dtype_name == 'object':
                    df.loc[idxs, col_name] = df.loc[idxs, col_name].astype(str).str.strip("'").str.strip()
                elif dtype_name == 'string':
                    df.loc[idxs, col_name] = df.loc[idxs, col_name].str.strip("'").str.strip()
                else:
                    # convert to string before insert to database
                    df.loc[idxs, col_name] = df.loc[idxs, col_name].astype(str)
                    continue

                if len(idxs):
                    conditions = [
                        df[col_name].isin(na_vals),
                        df[col_name].isin(INF_VALUES),
                        df[col_name].isin(INF_NEG_VALUES),
                    ]
                    return_vals = [nan, inf_val, inf_neg_val]

                    df[col_name] = np.select(conditions, return_vals, df[col_name])
    df.head()


@log_execution_time()
def add_new_col_to_df(df: DataFrame, col_name, value):
    """
    add new value as a new column in dataframe , but avoid duplicate column name.
    :param df:
    :param col_name:
    :param value:
    :return:
    """
    columns = list(df.columns)
    # avoid duplicate column name
    while col_name in columns:
        col_name = '_' + col_name

    df[col_name] = value

    return col_name


def return_inf_vals(data_type):
    if data_type == DataType.REAL.name:
        return np.nan, float('-inf'), float('inf')
    elif data_type == DataType.INTEGER.name:
        return pd.NA, pd.NA, pd.NA

    return None, '-inf', 'inf'


@log_execution_time()
def data_pre_processing(df, orig_df, dic_use_cols, na_values=None, exclude_cols=None, get_date_col=None):
    if exclude_cols is None:
        exclude_cols = []
    if na_values is None:
        na_values = PANDAS_DEFAULT_NA | NA_VALUES

    # string parse
    cols = get_object_cols(df)
    # keep None value in object column, instead of convert to "None"
    df[cols] = df[cols].fillna(np.nan)
    df[cols] = df[cols].astype(str)
    cols += get_string_cols(df)

    # normalization
    for col in cols:
        df[col] = normalize_df(df, col)

    # parse data type
    validate_data(df, dic_use_cols, na_values, exclude_cols)

    # If there are all invalid values in one row, the row will be invalid and not be imported to database
    # Otherwise, invalid values will be set nan in the row and be imported normally
    if get_date_col:
        # datetime_col as string, but value is 'nan' -> could not filter by isnull
        datetime_series = pd.to_datetime(df[get_date_col])
        is_error_row_series = df.eval(f'{IS_ERROR_COL} == 1') & (
            datetime_series.isnull() | df[set(df.columns) - set(exclude_cols)].isnull().all(axis=1)
        )
    else:
        is_error_row_series = df.eval(f'{IS_ERROR_COL} == 1') & df[set(df.columns) - set(exclude_cols)].isnull().all(
            axis=1,
        )
    df_error = orig_df.loc[is_error_row_series]
    df_error[ERR_COLS_NAME] = df.loc[is_error_row_series][ERR_COLS_NAME]

    # remove status column ( no need anymore )
    df.drop(df[is_error_row_series].index, inplace=True)
    df.drop(IS_ERROR_COL, axis=1, inplace=True)
    df.drop(ERR_COLS_NAME, axis=1, inplace=True)

    return df_error


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

    local_dt = df[df[get_date_col].notnull()][get_date_col]
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
    return df[df[get_date_col].notnull()][get_date_col].dt.strftime(DATE_FORMAT_STR)


@log_execution_time()
def validate_datetime(df: DataFrame, date_col, is_strip=True, add_is_error_col=True, null_is_error=True):
    dtype_name = df[date_col].dtype.name
    if dtype_name == 'object':
        df[date_col] = df[date_col].astype(str)
    elif dtype_name != 'string':
        return

    # for csv data
    if is_strip:
        df[date_col] = df[date_col].str.strip("'").str.strip()

    na_value = [np.nan, np.inf, -np.inf, 'nan', '<NA>', np.NAN, pd.NA]
    # convert to datetime value
    if not null_is_error:
        idxs = ~(df[date_col].isin(na_value))

    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')  # failed records -> pd.NaT

    # mark error records
    if add_is_error_col:
        init_is_error_col(df)

        if null_is_error:
            df[IS_ERROR_COL] = np.where(pd.isna(df[date_col]), 1, df[IS_ERROR_COL])
            err_date_col_idxs = df[date_col].isna()
            for idx, _ in err_date_col_idxs.items():
                err_col_name = df[ERR_COLS_NAME].at[idx] + '{},'.format(date_col)
                df.at[idx, ERR_COLS_NAME] = err_col_name if pd.isna(df[date_col].at[idx]) else df[ERR_COLS_NAME].at[idx]
        else:
            df_temp = df.loc[idxs, [date_col, IS_ERROR_COL, ERR_COLS_NAME]]
            # df.loc[idxs, IS_ERROR_COL] = np.where(pd.isna(df.loc[idxs, date_col]), 1, df.loc[idxs, IS_ERROR_COL])
            df_temp[IS_ERROR_COL] = np.where(pd.isna(df_temp[date_col]), 1, df_temp[IS_ERROR_COL])
            df_temp[ERR_COLS_NAME] = np.where(
                pd.isna(df_temp[date_col]),
                df_temp[ERR_COLS_NAME] + date_col + ',',
                df_temp[ERR_COLS_NAME],
            )
            df.loc[idxs, IS_ERROR_COL] = df_temp
            df.loc[idxs, ERR_COLS_NAME] = df_temp

        df.head()


def init_is_error_col(df: DataFrame):
    if IS_ERROR_COL not in df.columns:
        df[IS_ERROR_COL] = 0
    if ERR_COLS_NAME not in df.columns:
        df[ERR_COLS_NAME] = ''


# @log_execution_time()
# def set_cycle_max_id(next_use_id_count):
#     """get cycle max id to avoid conflict cycle id"""
#     global csv_import_cycle_max_id
#     with lock:
#         # when app start get max id of all tables
#         if csv_import_cycle_max_id is None:
#             csv_import_cycle_max_id = 0
#             max_id = max([cycle_cls.get_max_id() for cycle_cls in CYCLE_CLASSES])
#         else:
#             max_id = csv_import_cycle_max_id
#
#         csv_import_cycle_max_id = max_id + next_use_id_count
#     return max_id


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
    cycle_vals = df.replace({pd.NA: np.nan}).to_records(index=False).tolist()
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

    # clear cache
    set_all_cache_expired(CacheType.TRANSACTION_DATA)


@log_execution_time()
def add_new_not_exits_columns(proc_id, table_name, dic_col_with_type):
    sql = f'SELECT * FROM {table_name} WHERE 1=2;'
    import_cols = dic_col_with_type.keys()
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        exist_columns, _ = db_instance.run_sql(sql)
        new_columns = [import_col for import_col in import_cols if import_col not in exist_columns]
        for new_column in new_columns:
            add_sql = f'ALTER TABLE {table_name} ADD COLUMN {new_column} {dic_col_with_type[new_column]};'
            db_instance.execute_sql(add_sql)

        db_instance.connection.commit()


def get_df_first_n_last(df: DataFrame, first_count=10, last_count=10):
    if len(df) <= first_count + last_count:
        return df

    return df.loc[df.head(first_count).index.append(df.tail(last_count).index)]


@log_execution_time()
def save_proc_data_count(db_instance, df: DataFrame, proc_id, get_date_col):
    if not df.size or not get_date_col:
        return None

    s = pd.to_datetime(df[get_date_col], errors='coerce')
    s: Series = (s.dt.year * 1_00_00_00 + s.dt.month * 1_00_00 + s.dt.day * 1_00 + s.dt.hour).value_counts()
    s.rename(DataCountTable.count.name, inplace=True)
    count_df = s.reset_index(name=DataCountTable.count.name)
    count_df.rename(columns={'index': DataCountTable.datetime.name}, inplace=True)
    count_df[DataCountTable.datetime.name] = pd.to_datetime(
        count_df[DataCountTable.datetime.name],
        format='%Y%m%d%H',
    ).dt.strftime(DATE_FORMAT_FOR_ONE_HOUR)

    # # rename
    # df = df.rename(columns={get_date_col: DataCountTable.get_date_col()})
    #
    # # group data by datetime time
    # df[get_date_col] = df[get_date_col].apply(
    #     lambda x: '{}'.format(datetime.strptime(x, DATE_FORMAT_STR).strftime(DATE_FORMAT_FOR_ONE_HOUR)),
    # )
    # count_df = df.groupby([get_date_col]).value_counts()
    # count_df = count_df.to_frame(name=DataCountTable.count.name).reset_index()

    sql_params = get_insert_params(DataCountTable.get_keys())
    sql_insert = gen_bulk_insert_sql(DataCountTable.get_table_name(proc_id), *sql_params)
    sql_vals = count_df.to_records(index=False).tolist()
    insert_data(db_instance, sql_insert, sql_vals)


@log_execution_time()
def save_import_history(proc_id, job_info):
    sql_vals, sql_params = [], []
    if not job_info.dic_imported_row:
        job_info.dic_imported_row = {0: (job_info.target, job_info.committed_count)}
    for _, (target_file, imported_row) in job_info.dic_imported_row.items():
        import_history = ImportHistoryTable.as_obj()
        import_history.job_id = job_info.job_id or None
        import_history.import_type = job_info.import_type or None
        import_history.status = job_info.status or JobStatus.DONE.name
        if isinstance(import_history.status, JobStatus):
            # convert to string instead of JobStatus type
            import_history.status = import_history.status.name

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

        import_history.error_msg = job_info.err_msg or None
        import_history.start_tm = job_info.start_tm or get_current_timestamp()
        import_history.end_tm = job_info.end_tm or get_current_timestamp()
        import_history.created_at = get_current_timestamp()
        import_history.updated_at = get_current_timestamp()

        sql_vals += [import_history.get_values()]
        if not sql_params:
            sql_params = get_insert_params(import_history.get_keys())

    sql_insert = gen_bulk_insert_sql(ImportHistoryTable.get_table_name(proc_id), *sql_params)

    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        insert_data(db_instance, sql_insert, sql_vals)


@log_execution_time()
def save_failed_import_history(proc_id, job_info, error_type):
    job_info.status = JobStatus.FAILED.name
    job_info.err_msg = error_type
    # save import history before return
    # insert import history
    save_import_history(proc_id, job_info)
