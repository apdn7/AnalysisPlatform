import os.path
import re
import traceback
from collections import defaultdict
from datetime import datetime
from typing import List

import numpy as np
import pandas as pd
from apscheduler.triggers.date import DateTrigger
from dateutil import tz
from loguru import logger
from pandas import DataFrame
from pytz import utc
from sqlalchemy import and_

from histview2 import db, scheduler
from histview2.common.common_utils import (
    parse_int_value,
    make_dir_from_file_path, get_current_timestamp, get_csv_delimiter, DATE_FORMAT_STR, convert_time,
    DATE_FORMAT_STR_ONLY_DIGIT, split_path_to_list, get_error_trace_path, get_error_import_path, get_basename,
    get_ip_address, chunks
)
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from histview2.common.memoize import set_all_cache_expired
from histview2.common.scheduler import scheduler_app_context, JobType, lock
from histview2.common.services import csv_header_wrapr as chw
from histview2.common.services.csv_content import read_data
from histview2.common.services.normalization import normalize_df, normalize_str
from histview2.common.services.sse import background_announcer, AnnounceEvent
from histview2.common.timezone_utils import calc_offset_between_two_tz
from histview2.setting_module.models import CfgConstant, CfgDataSource, CfgDataSourceDB, CfgProcess
from histview2.setting_module.services.background_process import send_processing_info
from histview2.trace_data.models import Sensor, find_sensor_class, SensorType, find_cycle_class, CYCLE_CLASSES, Cycle

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
PANDAS_DEFAULT_NA = {'#N/A', '#N/A N/A', '#NA', '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN', '<NA>',
                     'N/A', 'NA', 'NULL', 'NaN', 'n/a', 'nan', 'null'}
NA_VALUES = {'na', '-', '--', '---', '#NULL!', '#REF!', '#VALUE!', '#NUM!', '#NAME?', '0/0'}
INF_VALUES = {'Inf', 'Infinity', '1/0', '#DIV/0!'}
INF_NEG_VALUES = {'-Inf', '-Infinity', '-1/0'}

ALL_SYMBOLS = set(PANDAS_DEFAULT_NA | NA_VALUES | INF_VALUES | INF_NEG_VALUES)
SPECIAL_SYMBOLS = ALL_SYMBOLS - {'-'}
IS_ERROR_COL = '___ERR0R___'


@log_execution_time('[DATA IMPORT]')
def import_data(df, proc_id, get_date_col, cycle_cls, dic_sensor, dic_sensor_cls, dic_substring_sensors):
    cycles_len = len(df)
    if not cycles_len:
        return 0

    # get available cycle ids from db
    current_id = set_cycle_max_id(cycles_len)

    # set ids for df
    start_cycle_id = current_id + 1
    df = set_cycle_ids_to_df(df, start_cycle_id)

    cycle_vals = gen_insert_cycle_values(df, proc_id, cycle_cls, get_date_col)

    # insert cycles
    # get cycle and sensor columns for insert sql
    cycle_sql_params = get_insert_params(get_cycle_columns())
    sql_insert_cycle = gen_bulk_insert_sql(cycle_cls.__table__.name, *cycle_sql_params)

    # run in threads
    # pipeline = queue.Queue()
    # q_output = queue.Queue()
    # with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    #     executor.submit(gen_sensor_data_in_thread, pipeline, df, dic_sensor, dic_sensor_cls, dic_substring_sensors)
    #     executor.submit(insert_data_in_thread, pipeline, q_output, cycle_vals, sql_insert_cycle)
    #
    # commit_error = q_output.get()

    # run in main thread
    sensor_vals = []
    for col_name, sensor in dic_sensor.items():
        sensor_vals += gen_sensor_data(df, sensor, col_name, dic_sensor_cls, dic_substring_sensors)

    commit_error = insert_data_to_db(sensor_vals, cycle_vals, sql_insert_cycle)

    if isinstance(commit_error, Exception):
        set_cycle_max_id(-cycles_len)
        return commit_error

    return cycles_len


@log_execution_time()
def gen_dic_sensor_n_cls(proc_id, dic_use_cols):
    # sensor classes
    dic_sensor = {}
    dic_sensor_cls = {}
    sensors = Sensor.get_sensor_by_col_names(proc_id, dic_use_cols)
    for sensor in sensors:
        dic_sensor[sensor.column_name] = sensor
        dic_sensor_cls[sensor.column_name] = find_sensor_class(sensor.id, sensor.type)

    return dic_sensor, dic_sensor_cls


@log_execution_time()
def gen_substring_column_info(proc_id, dic_sensor):
    # substring dic
    dic_substring_sensors = defaultdict(list)
    for col_name, sensor in dic_sensor.items():
        candidates = Sensor.get_substring_sensors(proc_id, sensor.id, col_name)
        for candidate in candidates:
            substr_check_res = get_from_to_substring_col(candidate)
            if substr_check_res:
                dic_substring_sensors[col_name].append(candidate)

    return dic_substring_sensors


@log_execution_time()
def gen_data_type_list(columns, data_types, get_date_col, auto_increment_col=None):
    ints = []
    reals = []
    dates = []
    texts = []
    for col, data_type in zip(columns, data_types):
        if DataType[data_type] is DataType.INTEGER:
            ints.append(col)
        elif DataType[data_type] is DataType.REAL:
            reals.append(col)
        elif DataType[data_type] is DataType.DATETIME:
            dates.append(col)
        else:
            texts.append(col)

    return {'get_date_col': get_date_col,
            'auto_increment_col': auto_increment_col or get_date_col,
            'int_type_cols': ints,
            'real_type_cols': reals,
            'date_type_cols': dates,
            'text_type_cols': texts,
            }


# -------------------------- Factory data import -----------------------------


@log_execution_time()
def gen_cols_info(proc_cfg: CfgProcess):
    """generate import columns, data types prepare for factory data import
    :rtype: dict
    :param proc_cfg:
    :return:
    """

    columns = []
    data_types = []
    get_date_col = None
    auto_increment_col = None
    for col in proc_cfg.columns:
        columns.append(col.column_name)
        data_types.append(col.data_type)

        # get date
        if col.is_get_date:
            get_date_col = col.column_name

        # auto incremental column
        if col.is_auto_increment:
            auto_increment_col = col.column_name

    # generate data type list
    dic_cols_info = gen_data_type_list(columns, data_types, get_date_col, auto_increment_col)
    return dic_cols_info


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
    with DbProxy(db_source) as db_instance:
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

    file_name = f'{proc_name}{base_name}_{time_str}{ip_address}.txt'
    full_path = os.path.join(get_error_trace_path(), file_name)
    make_dir_from_file_path(full_path)

    df_error.to_csv(full_path, sep=CsvDelimiter.TSV.value, header=None, index=False)

    return df_error


@log_execution_time()
def write_duplicate_import(df: DataFrame, file_name_elements: List):
    if not len(df):
        return df

    file_name = '_'.join([element for element in file_name_elements if element])
    export_file_name = f'{file_name}.txt'
    full_path = os.path.join(get_error_trace_path(), export_file_name)
    # make folder
    make_dir_from_file_path(full_path)

    df.to_csv(full_path, sep=CsvDelimiter.TSV.value, header=None, index=False)

    return df


@log_execution_time()
def write_error_import(df_error: DataFrame, proc_name, file_path=None, error_file_delimiter=CsvDelimiter.CSV.value,
                       csv_directory=None):
    if not len(df_error):
        return df_error

    if csv_directory:
        file_paths = split_path_to_list(file_path)
        csv_directories = split_path_to_list(csv_directory)
        file_name = file_paths[-1]
        folders = file_paths[len(csv_directories):-1]
    else:
        time_str = convert_time(format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
        file_name = time_str + error_file_delimiter
        folders = []

    full_path = os.path.join(get_error_import_path(), proc_name, *folders, file_name)
    make_dir_from_file_path(full_path)

    df_error.to_csv(full_path, sep=error_file_delimiter, index=False)

    return df_error


def get_latest_records(proc_id, dic_sensors, get_date_col):
    cycle_cls = find_cycle_class(proc_id)
    cycle_ids = cycle_cls.get_latest_cycle_ids(proc_id)
    df_blank = pd.DataFrame({col: [] for col in [INDEX_COL] + list(dic_sensors)})
    if not cycle_ids:
        return df_blank

    is_first = True
    col_names = list(dic_sensors)
    dfs = []
    for cols in chunks(col_names, 50):
        records = get_sensor_values(proc_id, cols, dic_sensors, cycle_cls, cycle_ids=cycle_ids, get_time_col=is_first)
        is_first = False

        if not records:
            return df_blank

        df = pd.DataFrame(records)
        dfs.append(df)

    dfs = [_df.set_index(INDEX_COL) for _df in dfs]
    df = pd.concat(dfs, ignore_index=False, axis=1)
    df.sort_values(CYCLE_TIME_COL, inplace=True)
    if get_date_col in col_names:
        df.drop(CYCLE_TIME_COL, axis=1, inplace=True)
    else:
        df.rename({CYCLE_TIME_COL: get_date_col}, inplace=True)

    return df


def gen_error_output_df(csv_file_name, dic_sensors, df_error, df_db, error_msgs=None):
    db_len = len(df_db)
    df_db = df_db.append(df_error, ignore_index=True)
    columns = df_db.columns.tolist()

    # error data
    new_row = columns
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    new_row = ('column name/sample data (first 10 & last 10)',)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    new_row = ('Data File', csv_file_name)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row, db_len)

    # data in db
    new_row = columns
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('column name/sample data (latest 5)',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = [DataType(dic_sensors[col_name].type).name for col_name in columns if col_name in dic_sensors]
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('data type',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('Database',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row)

    new_row = ('',)
    df_db = add_row_to_df(df_db, columns, new_row)

    if isinstance(error_msgs, (list, tuple)):
        error_msg = '|'.join(error_msgs)
    else:
        error_msg = error_msgs

    new_row = ('Error Type', error_msg or DATA_TYPE_ERROR_MSG)
    df_db = add_row_to_df(df_db, columns, new_row)

    return df_db


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

    new_row = [dic_use_cols[col_name] for col_name in columns if col_name in dic_use_cols]
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

    if isinstance(error_msgs, (list, tuple)):
        error_msg = '|'.join(error_msgs)
    else:
        error_msg = error_msgs

    new_row = ('Error Type', error_msg or DATA_TYPE_DUPLICATE_MSG)
    df_output = add_row_to_df(df_output, columns, new_row)

    return df_output


def add_row_to_df(df, columns, new_row, pos=0):
    df_temp = pd.DataFrame({columns[i]: new_row[i] for i in range(len(new_row))}, index=[pos])
    df = pd.concat([df.iloc[0:pos], df_temp, df.iloc[pos:]]).reset_index(drop=True)

    return df


@log_execution_time()
def get_new_adding_columns(proc, dic_use_cols):
    proc_id = proc.id

    # exist sensors
    created_at = get_current_timestamp()
    dic_exist_sensor = {s.column_name: s for s in proc.sensors}
    missing_sensors = []
    for col_name, data_type in dic_use_cols.items():
        # already exist
        if dic_exist_sensor.get(col_name):
            continue

        data_type_obj = DataType[data_type]
        if data_type_obj is DataType.DATETIME:
            data_type_obj = DataType.TEXT

        sensor = dict(process_id=proc_id, column_name=col_name, type=data_type_obj.value, created_at=created_at)
        missing_sensors.append(sensor)

    return missing_sensors


@log_execution_time()
def commit_db_instance(db_instance):
    # commit changes to db
    db_instance.connection.commit()

    # clear cache
    set_all_cache_expired()


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
                WR_HEADER_NAMES: [EFAColumn.Line.name, EFAColumn.Process.name, EFAColumn.Machine.name],
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
            CfgConstant.create_or_update_by_type(const_type=CfgConstantType.EFA_HEADER_EXISTS.name,
                                                 const_name=data_src.id,
                                                 const_value=EFA_HEADER_FLAG)

        return etl_headers[WR_HEADER_NAMES], etl_headers[WR_VALUES]


# -------------------------- shutdown app job -----------------------------
@log_execution_time()
def add_shutdown_app_job():
    # delete process data from universal db
    shutdown_app_job_id = JobType.SHUTDOWN_APP.name
    scheduler.add_job(
        shutdown_app_job_id, shutdown_app_job,
        trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
        replace_existing=True,
        kwargs=dict(
            _job_id=shutdown_app_job_id,
            _job_name=JobType.SHUTDOWN_APP.name,
        )
    )


@scheduler_app_context
def shutdown_app_job(_job_id=None, _job_name=None, *args, **kwargs):
    """ scheduler job to shutdown app

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = waiting_for_job_done(*args, **kwargs)
    send_processing_info(gen, JobType.SHUTDOWN_APP, is_check_disk=False)


@log_execution_time()
def waiting_for_job_done():
    """pause scheduler and wait for all other jobs done.

    Arguments:
        proc_id {[type]} -- [description]

    Keyword Arguments:
        db_id {[type]} -- [description] (default: {None})

    Yields:
        [type] -- [description]
    """
    yield 0

    from histview2.common.scheduler import dic_running_job, scheduler
    import time

    with lock:
        try:
            scheduler.pause()
        except Exception:
            pass

    start_time = time.time()
    percent = 0
    shutdown_job = {JobType.SHUTDOWN_APP.name}
    while True:
        running_jobs = set(dic_running_job.keys())
        if not running_jobs.difference(shutdown_job):
            print('///////////// ELIGIBLE TO SHUTDOWN APP ///////////')
            # notify frontend to stop main thread
            background_announcer.announce(True, AnnounceEvent.SHUT_DOWN.name)
            break

        # show progress
        percent = min(percent + 5, 99)
        yield percent

        # check timeout: 2 hours
        if time.time() - start_time > 7200:
            break

        # sleep 5 seconds and wait
        time.sleep(5)

    yield 100


@log_execution_time()
def save_sensors(sensors):
    # sensor commit
    if not sensors:
        return

    with lock:
        db.session.execute(Sensor.__table__.insert(), sensors)
        # db.session.bulk_insert_mappings(Sensor, sensors)
        db.session.commit()


@log_execution_time()
def strip_special_symbol(data, is_dict=False):
    # TODO: convert to dataframe than filter is faster , but care about generation purpose ,
    #  we just need to read some rows
    iter_func = lambda x: x
    if is_dict:
        iter_func = lambda x: x.values()

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


def gen_cycle_data(cycle_id, proc_id, cycle_time, created_at):
    """
    vectorize function , do not use decorator
    :param cycle_id:
    :param cycle_time:
    :param proc_id:
    :param created_at:
    :return:
    """
    return dict(id=cycle_id, process_id=proc_id, time=cycle_time, created_at=created_at)


def gen_sensors_data(cycle_id, sensor_id, sensor_val, created_at):
    """
    vectorize function , do not use decorator
    :param cycle_id:
    :param sensor_id:
    :param sensor_val:
    :param created_at:
    :return:
    """
    return dict(cycle_id=cycle_id, sensor_id=sensor_id, value=sensor_val, created_at=created_at)


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
        if not err_msgs:
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
        user_data_type = dic_use_cols[col_name]

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

                try:
                    if len(non_num_idxs):
                        pd.to_numeric(df.loc[non_num_idxs.index, col_name], errors='raise')
                except Exception as ex:
                    logger.exception(ex)

            # replace Inf --> None
            if user_data_type == DataType.INTEGER.name:
                df.loc[df[col_name].isin([float('inf'), float('-inf')]), col_name] = nan

        elif user_data_type == DataType.TEXT.name:
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
                conditions = [df[col_name].isin(na_vals),
                              df[col_name].isin(INF_VALUES),
                              df[col_name].isin(INF_NEG_VALUES)]
                return_vals = [nan, inf_val, inf_neg_val]

                df[col_name] = np.select(conditions, return_vals, df[col_name])


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
def data_pre_processing(df, orig_df, dic_use_cols, na_values=None, exclude_cols=None):
    if na_values is None:
        na_values = PANDAS_DEFAULT_NA | NA_VALUES

    # string parse
    cols = get_object_cols(df)
    df[cols] = df[cols].astype(str)
    cols += get_string_cols(df)

    # normalization
    for col in cols:
        normalize_df(df, col)

    # parse data type
    validate_data(df, dic_use_cols, na_values, exclude_cols)

    # write to file
    df_error = orig_df.loc[df.eval(f'{IS_ERROR_COL} == 1')]

    # remove status column ( no need anymore )
    df.drop(df[df[IS_ERROR_COL] == 1].index, inplace=True)
    df.drop(IS_ERROR_COL, axis=1, inplace=True)

    return df_error


@log_execution_time()
def get_from_to_substring_col(sensor):
    substr_regex = re.compile(SUB_STRING_REGEX)
    from_to_pos = substr_regex.match(sensor.column_name)
    if not from_to_pos:
        return None

    from_char = int(from_to_pos[1]) - 1
    to_char = int(from_to_pos[2])
    substr_cls = find_sensor_class(sensor.id, DataType(sensor.type))

    return substr_cls, from_char, to_char


@log_execution_time()
def gen_substr_data(substr_sensor, df, col_name):
    """
    generate data for sub string column from original data
    :param substr_sensor:
    :param df:
    :param col_name:
    :return:
    """
    substr_check_res = get_from_to_substring_col(substr_sensor)
    if not substr_check_res:
        return None, None

    substr_cls, from_char, to_char = substr_check_res

    sub_col_name = add_new_col_to_df(df, f'{col_name}_{from_char}_{to_char}', df[col_name].str[from_char:to_char])

    # # remove blank values (we need to insert the same with proclink, so do not move blank)
    # df_insert = df[df[sub_col_name] != '']
    # if not len(df_insert):
    #     return None, None

    # gen insert data
    sensor_vals = gen_insert_sensor_values(df, substr_sensor.id, sub_col_name)

    return substr_cls, sensor_vals


@log_execution_time()
def get_data_without_na(data):
    valid_rows = []
    for row in data:
        # exclude_na = False not in [col not in ALL_SYMBOLS for col in row]
        if any([val in ALL_SYMBOLS for val in row]):
            continue

        valid_rows.append(row)
    return valid_rows


def get_string_cols(df: DataFrame):
    return [col for col in df.columns if df[col].dtype.name.lower() == 'string']


def get_object_cols(df: DataFrame):
    return [col for col in df.columns if df[col].dtype.name.lower() == 'object']


@log_execution_time('[CONVERT DATE TIME TO UTC')
def convert_df_col_to_utc(df, get_date_col, is_tz_inside, utc_time_offset):
    if is_tz_inside:
        return df[get_date_col].dt.tz_convert('UTC')

    return df[get_date_col] - utc_time_offset


@log_execution_time()
def convert_df_datetime_to_str(df: DataFrame, get_date_col):
    return df[get_date_col].dt.strftime(DATE_FORMAT_STR)


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

    # convert to datetime value
    if not null_is_error:
        idxs = df[date_col].notna()

    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')  # failed records -> pd.NaT

    # mark error records
    if add_is_error_col:
        init_is_error_col(df)

        if null_is_error:
            df[IS_ERROR_COL] = np.where(pd.isna(df[date_col]), 1, df[IS_ERROR_COL])
        else:
            df_temp = df.loc[idxs, [date_col, IS_ERROR_COL]]
            # df.loc[idxs, IS_ERROR_COL] = np.where(pd.isna(df.loc[idxs, date_col]), 1, df.loc[idxs, IS_ERROR_COL])
            df_temp[IS_ERROR_COL] = np.where(pd.isna(df_temp[date_col]), 1, df_temp[IS_ERROR_COL])
            df.loc[idxs, IS_ERROR_COL] = df_temp


def init_is_error_col(df: DataFrame):
    if IS_ERROR_COL not in df.columns:
        df[IS_ERROR_COL] = 0


@log_execution_time()
def set_cycle_max_id(next_use_id_count):
    """ get cycle max id to avoid conflict cycle id
    """
    global csv_import_cycle_max_id
    with lock:
        # when app start get max id of all tables
        if csv_import_cycle_max_id is None:
            csv_import_cycle_max_id = 0
            max_id = max([cycle_cls.get_max_id() for cycle_cls in CYCLE_CLASSES])
        else:
            max_id = csv_import_cycle_max_id

        csv_import_cycle_max_id = max_id + next_use_id_count
    return max_id


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
        cycle_cls = find_cycle_class(proc_cfg.id)
        with lock:
            cycle_cls.update_time_by_tzoffset(proc_cfg.id, tz_offset)
            date_sensor = Sensor.get_sensor_by_col_name(proc_cfg.id, proc_cfg.get_date_col())

            sensor_cls = find_sensor_class(date_sensor.id, DataType(date_sensor.type))
            sensor_cls.update_time_by_tzoffset(proc_cfg.id, date_sensor.id, tz_offset)
            db.session.commit()

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
        CfgConstantType.USE_OS_TIMEZONE.name, proc_id, lambda x: bool(int(x)))
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
        const_name=proc_id)

    return True


@log_execution_time()
def gen_insert_cycle_values(df, proc_id, cycle_cls, get_date_col):
    # created time
    created_at = get_current_timestamp()
    created_at_col_name = add_new_col_to_df(df, cycle_cls.created_at.key, created_at)

    proc_id_col_name = add_new_col_to_df(df, cycle_cls.process_id.key, proc_id)
    is_outlier_col_name = add_new_col_to_df(df, cycle_cls.is_outlier.key, 0)
    cycle_vals = df[[proc_id_col_name, get_date_col, is_outlier_col_name, created_at_col_name]].to_records().tolist()
    return cycle_vals


@log_execution_time()
def insert_data(db_instance, sql, vals):
    db_instance.execute_sql_in_transaction(sql, vals)
    return True


@log_execution_time()
def gen_insert_sensor_values(df_insert, sensor_id, col_name):
    sensor_id_col = add_new_col_to_df(df_insert, SensorType.sensor_id.key, sensor_id)
    sensor_vals = df_insert[[sensor_id_col, col_name]].to_records().tolist()

    return sensor_vals


@log_execution_time()
def gen_bulk_insert_sql(tblname, cols_str, params_str):
    sql = f'INSERT INTO {tblname} ({cols_str}) VALUES ({params_str})'

    return sql


@log_execution_time()
def get_cycle_columns():
    return Cycle.id.key, Cycle.process_id.key, Cycle.time.key, Cycle.is_outlier.key, Cycle.created_at.key


@log_execution_time()
def get_sensor_columns():
    return SensorType.cycle_id.key, SensorType.sensor_id.key, SensorType.value.key


@log_execution_time()
def get_insert_params(columns):
    cols_str = ','.join(columns)
    params_str = ','.join(['?'] * len(columns))

    return cols_str, params_str


@log_execution_time()
def gen_sensor_data(df, sensor, col_name, dic_sensor_cls, dic_substring_sensors):
    data = []
    sensor_cls = dic_sensor_cls[col_name]

    df_insert = df.dropna(subset=[col_name])[[col_name]]
    if not df_insert.size:
        return data

    sensor_vals = gen_insert_sensor_values(df_insert, sensor.id, col_name)
    data.append((sensor_cls.__table__.name, sensor_vals))

    # insert substring columns
    substr_sensors = dic_substring_sensors.get(col_name, [])
    if substr_sensors:
        df_insert[col_name] = df_insert[col_name].astype(str)

    for substr_sensor in substr_sensors:
        substr_cls, substr_rows = gen_substr_data(substr_sensor, df_insert, col_name)
        if substr_cls and substr_rows:
            data.append((substr_cls.__table__.name, substr_rows))

    return data


@log_execution_time()
def insert_data_to_db(sensor_values, cycle_vals, sql_insert_cycle):
    try:
        with lock:
            with DbProxy(gen_data_source_of_universal_db(), True) as db_instance:
                # insert cycle
                insert_data(db_instance, sql_insert_cycle, cycle_vals)

                # insert sensor
                sensor_sql_params = get_insert_params(get_sensor_columns())
                for tblname, vals in sensor_values:
                    sql_insert_sensor = gen_bulk_insert_sql(tblname, *sensor_sql_params)
                    insert_data(db_instance, sql_insert_sensor, vals)

                # commit data to database
                commit_db_instance(db_instance)

        return None
    except Exception as e:
        return e


# def gen_sensor_data_in_thread(pipeline: Queue, df, dic_sensor, dic_sensor_cls, dic_substring_sensors):
#     for col_name, sensor in dic_sensor.items():
#         sensor_cls = dic_sensor_cls[col_name]
#         sensor_vals = gen_insert_sensor_values(df, sensor, col_name)
#         if sensor_vals:
#             pipeline.put((sensor_cls.__table__.name, sensor_vals))
#             # insert substring columns
#             for substr_sensor in dic_substring_sensors.get(col_name, []):
#                 substr_cls, substr_rows = gen_substr_data(substr_sensor, sensor_vals)
#                 if substr_cls and substr_rows:
#                     pipeline.put((sensor_cls.__table__.name, sensor_vals))
#
#     # Stop flag
#     pipeline.put(None)
#
#
# def insert_data_in_thread(pipeline: Queue, q_output: Queue, cycle_vals, sql_insert_cycle):
#     try:
#         with lock:
#             with DbProxy(gen_data_source_of_universal_db(), True) as db_instance:
#                 # insert cycle
#                 insert_data(db_instance, sql_insert_cycle, cycle_vals)
#
#                 # insert sensor
#                 sensor_sql_params = get_insert_params(get_sensor_columns())
#                 while True:
#                     data = pipeline.get()
#                     if data is None:
#                         break
#
#                     tblname, vals = data
#
#                     sql_insert_sensor = gen_bulk_insert_sql(tblname, *sensor_sql_params)
#                     insert_data(db_instance, sql_insert_sensor, vals)
#
#                 # commit data to database
#                 commit_db_instance(db_instance)
#
#         q_output.put(None)
#     except Exception as e:
#         q_output.put(e)

@log_execution_time()
def get_sensor_values(proc_id, col_names, dic_sensors, cycle_cls, start_tm=None, end_tm=None, cycle_ids=None,
                      sort_by_time=False, get_time_col=None):
    cols = [cycle_cls.id.label(INDEX_COL)]
    if get_time_col:
        cols.append(cycle_cls.time.label(CYCLE_TIME_COL))

    data_query = db.session.query(*cols)
    data_query = data_query.filter(cycle_cls.process_id == proc_id)

    for col_name in col_names:
        sensor = dic_sensors[col_name]
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)
        sensor_val = sensor_val_cls.value.label(col_name)

        data_query = data_query.outerjoin(
            sensor_val_cls,
            and_(sensor_val_cls.cycle_id == cycle_cls.id, sensor_val_cls.sensor_id == sensor.id)
        )

        data_query = data_query.add_columns(sensor_val)

    # chunk
    if cycle_ids:
        data_query = data_query.filter(cycle_cls.id.in_(cycle_ids))
    else:
        data_query = data_query.filter(cycle_cls.time >= start_tm)
        data_query = data_query.filter(cycle_cls.time <= end_tm)

    if sort_by_time:
        data_query = data_query.order_by(cycle_cls.time)

    records = data_query.all()
    return records


def get_df_first_n_last(df: DataFrame, first_count=10, last_count=10):
    if len(df) <= first_count + last_count:
        return df

    return df.loc[df.head(first_count).index.append(df.tail(last_count).index)]
