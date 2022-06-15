from datetime import datetime

import pandas as pd
from loguru import logger
from pandas import DataFrame

from histview2.api.setting_module.services.csv_import import remove_duplicates
from histview2.api.setting_module.services.data_import import import_data, save_sensors, get_new_adding_columns, \
    gen_import_job_info, \
    data_pre_processing, convert_df_col_to_utc, convert_df_datetime_to_str, validate_datetime, \
    gen_dic_sensor_n_cls, gen_substring_column_info, check_update_time_by_changed_tz, gen_error_output_df, \
    get_df_first_n_last, write_error_import, write_error_trace, gen_duplicate_output_df, write_duplicate_import
from histview2.api.trace_data.services.proc_link import add_gen_proc_link_job
from histview2.common.common_utils import add_days, convert_time, DATE_FORMAT_STR_FACTORY_DB, add_double_quotes, \
    add_years, DATE_FORMAT_STR_ONLY_DIGIT, get_ip_address
from histview2.common.constants import MSG_DB_CON_FAILED, JobStatus, DataType
from histview2.common.logger import log_execution_time
from histview2.common.pydn.dblib import mysql, mssqlserver, oracle
from histview2.common.pydn.dblib.db_proxy import DbProxy
from histview2.common.scheduler import scheduler_app_context, JobType
from histview2.common.timezone_utils import get_db_timezone, gen_sql, get_time_info, detect_timezone
from histview2.setting_module.models import FactoryImport, CfgProcess, CfgDataSourceDB, JobManagement
from histview2.setting_module.services.background_process import send_processing_info, JobInfo, \
    format_factory_date_to_meta_data
from histview2.trace_data.models import Process, find_cycle_class

MAX_RECORD = 1_000_000
SQL_FACTORY_LIMIT = 5_000_000
SQL_DAY = 8
SQL_DAYS_AGO = 30
FETCH_MANY_SIZE = 10_000

pd.options.mode.chained_assignment = None  # default='warn'


@scheduler_app_context
def import_factory_job(_job_id, _job_name, _db_id, _proc_id, _proc_name, *args, **kwargs):
    """ scheduler job import factory data

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = import_factory(*args, **kwargs)
    send_processing_info(gen, JobType.FACTORY_IMPORT, db_code=_db_id, process_id=_proc_id, process_name=_proc_name,
                         after_success_func=add_gen_proc_link_job)


@log_execution_time()
def import_factory(proc_id):
    """transform data and then import from factory db to universal db

    Arguments:
        proc_id {[type]} -- [description]

    Yields:
        [type] -- [description]
    """
    # start job
    yield 0

    # get process id in edge db
    proc_cfg: CfgProcess = CfgProcess.query.get(proc_id)
    data_src: CfgDataSourceDB = CfgDataSourceDB.query.get(proc_cfg.data_source_id)

    # check db connection
    check_db_connection(data_src)

    # process info
    proc = Process.get_or_create_proc(proc_id=proc_id, proc_name=proc_cfg.name)

    # columns info
    proc_name = proc_cfg.name
    column_names = [col.column_name for col in proc_cfg.columns]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    auto_increment_idx = column_names.index(auto_increment_col)
    dic_use_cols = {col.column_name: col.data_type for col in proc_cfg.columns}

    # cycle class
    cycle_cls = find_cycle_class(proc_id)

    # check new adding column, save.
    missing_sensors = get_new_adding_columns(proc, dic_use_cols)
    save_sensors(missing_sensors)

    # sensor classes
    dic_sensor, dic_sensor_cls = gen_dic_sensor_n_cls(proc_id, dic_use_cols)

    # substring sensors info
    dic_substring_sensors = gen_substring_column_info(proc_id, dic_sensor)

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    # last import date
    last_import = FactoryImport.get_last_import(proc.id, JobType.FACTORY_IMPORT.name)

    if last_import:
        filter_time = last_import.import_to
    else:
        # the first time import data : get minimum time of factory db
        filter_time = None

    # convert utc function
    dic_tz_info = {col: handle_time_zone(proc_cfg, col)
                   for col, dtype in dic_use_cols.items() if DataType[dtype] is DataType.DATETIME}

    # get factory max date
    fac_max_date, is_tz_col = get_factory_max_date(proc_cfg)

    inserted_row_count = 0
    calc_range_days_func = calc_sql_range_days()
    sql_day = SQL_DAY
    is_import = True
    end_time = None
    total_row = 0
    job_info = JobInfo()
    job_info.auto_increment_col_timezone = is_tz_col
    job_info.target = proc_cfg.name

    # get current job id
    t_job_management: JobManagement = JobManagement.get_last_job_of_process(proc_id, JobType.FACTORY_IMPORT.name)
    job_id = str(t_job_management.id) if t_job_management else ''
    data_source_name = proc_cfg.data_source.name
    table_name = proc_cfg.table_name

    while inserted_row_count < MAX_RECORD and is_import:
        # get sql range
        if end_time:
            if total_row:
                sql_day = calc_range_days_func(sql_day, total_row)

            start_time, end_time, filter_time = get_sql_range_time(end_time, range_day=sql_day, is_tz_col=is_tz_col)
        else:
            start_time, end_time, filter_time = get_sql_range_time(filter_time, is_tz_col=is_tz_col)

        # no data in range, stop
        if start_time > fac_max_date:
            break

        # validate import date range
        if end_time >= fac_max_date:
            end_time = fac_max_date
            is_import = False

        # get data from factory
        data = get_factory_data(proc_cfg, column_names, auto_increment_col, start_time, end_time)
        if not data:
            break

        cols = next(data)
        remain_rows = tuple()
        for rows in data:
            is_import, rows, remain_rows = gen_import_data(rows, remain_rows, auto_increment_idx)
            if not is_import:
                continue

            # dataframe
            df = pd.DataFrame(rows, columns=cols)

            # no records
            if not len(df):
                continue

            # Convert UTC time
            for col, dtype in dic_use_cols.items():
                if DataType[dtype] is not DataType.DATETIME:
                    continue

                null_is_error = False
                if col == get_date_col:
                    null_is_error = True

                validate_datetime(df, col, is_strip=False, null_is_error=null_is_error)
                df[col] = convert_df_col_to_utc(df, col, *dic_tz_info[col])
                df[col] = convert_df_datetime_to_str(df, col)

            # convert types
            df = df.convert_dtypes()

            # original df
            orig_df = df.copy()

            # data pre-processing
            df_error = data_pre_processing(df, orig_df, dic_use_cols, exclude_cols=[get_date_col])
            df_error_cnt = len(df_error)
            if df_error_cnt:
                df_error_trace = gen_error_output_df(proc_id, proc_name, dic_sensor, get_df_first_n_last(df_error))
                write_error_trace(df_error_trace, proc_cfg.name)
                write_error_import(df_error, proc_cfg.name)

            # no records
            if not len(df):
                continue

            # remove duplicate records which exists DB
            df_duplicate = remove_duplicates(df, orig_df, proc_id, get_date_col)
            df_duplicate_cnt = len(df_duplicate)
            if df_duplicate_cnt:
                write_duplicate_records_to_file_factory(df_duplicate, data_source_name, table_name, dic_use_cols,
                                                        proc_cfg.name, job_id)

            # import data
            save_res = import_data(df, proc_id, get_date_col, cycle_cls, dic_sensor, dic_sensor_cls,
                                   dic_substring_sensors)

            # update job info
            imported_end_time = rows[-1][auto_increment_idx]
            gen_import_job_info(job_info, save_res, start_time, imported_end_time, err_cnt=df_error_cnt)

            # total row of one job
            total_row = job_info.row_count
            inserted_row_count += total_row

            job_info.calc_percent(inserted_row_count, MAX_RECORD)

            yield job_info

            # raise exception if FATAL error happened
            if job_info.status is JobStatus.FATAL:
                raise job_info.exception

            # calc range of days to gen sql
            logger.info(
                f'FACTORY DATA IMPORT SQL(days = {sql_day}, records = {total_row}, range = {start_time} - {end_time})')



@log_execution_time()
def calc_sql_range_days():
    """
    calculate range of days for 1 sql sentence
    """
    limit_record = 100_000
    limit_max_day = 256
    limit_min_day = 1

    prev_day_cnt = 1
    prev_record_cnt = 0

    def _calc_sql_range_days(cur_day_cnt, cur_record_cnt):
        nonlocal prev_day_cnt, prev_record_cnt

        # compare current to previous, get max
        if cur_record_cnt >= prev_record_cnt:
            rec_cnt = cur_record_cnt
            day_cnt = cur_day_cnt
        else:
            rec_cnt = prev_record_cnt
            day_cnt = prev_day_cnt

        # set previous sql
        prev_day_cnt = day_cnt
        prev_record_cnt = rec_cnt

        # adjust number of days to get data
        if rec_cnt > limit_record * 2:
            day_cnt //= 2
        elif rec_cnt < limit_record:
            day_cnt *= 2

        # make sure range is 1 ~ 256 days
        day_cnt = min(day_cnt, limit_max_day)
        day_cnt = max(day_cnt, limit_min_day)

        return day_cnt

    return _calc_sql_range_days


@log_execution_time()
def get_sql_range_time(filter_time=None, range_day=SQL_DAY, start_days_ago=SQL_DAYS_AGO, is_tz_col=False):
    # if there is no data , this poling is the first time, so get data of n days ago.
    limit_date = add_days(days=-start_days_ago)
    limit_date = limit_date.replace(hour=0, minute=0, second=0, microsecond=0)

    if filter_time:
        filter_time = max(convert_time(filter_time), convert_time(limit_date))
    else:
        filter_time = convert_time(limit_date)

    # start time
    start_time = convert_time(filter_time, return_string=False)

    # 8 days after
    end_time = add_days(start_time, days=range_day)

    # convert to string
    start_time = convert_time(start_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_milisecond=True)
    end_time = convert_time(end_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_milisecond=True)
    filter_time = convert_time(filter_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_milisecond=True)

    if is_tz_col:
        start_time += 'Z'
        end_time += 'Z'
        filter_time += 'Z'

    return start_time, end_time, filter_time


@log_execution_time('[FACTORY DATA IMPORT SELECT SQL]')
def get_data_by_range_time(db_instance, get_date_col, column_names, table_name, start_time, end_time, sql_limit):
    if isinstance(db_instance, mysql.MySQL):
        sel_cols = ','.join(column_names)
    else:
        table_name = add_double_quotes(table_name)
        sel_cols = ','.join([add_double_quotes(col) for col in column_names])
        get_date_col = add_double_quotes(get_date_col)

    # sql
    sql = f"{sel_cols} FROM {table_name} WHERE {get_date_col} > '{start_time}' AND {get_date_col} <= '{end_time}'"
    sql = f'{sql} ORDER BY {get_date_col}'

    if isinstance(db_instance, mssqlserver.MSSQLServer):
        sql = f'SELECT TOP {sql_limit} {sql}'
    elif isinstance(db_instance, oracle.Oracle):
        sql = f'SELECT * FROM (SELECT {sql}) WHERE ROWNUM <= {sql_limit}'
    else:
        sql = f'SELECT {sql} LIMIT {sql_limit}'

    logger.info(f'sql: {sql}')
    data = db_instance.fetch_many(sql, FETCH_MANY_SIZE)
    if not data:
        return None

    yield from data


@log_execution_time()
def get_factory_data(proc_cfg, column_names, auto_increment_col, start_time, end_time):
    """generate select statement and get data from factory db

    Arguments:
        proc_id {[type]} -- [description]
        db_config_yaml {DBConfigYaml} -- [description]
        proc_config_yaml {ProcConfigYaml} -- [description]
    """
    # exe sql
    with DbProxy(proc_cfg.data_source) as db_instance:
        data = get_data_by_range_time(db_instance, auto_increment_col, column_names, proc_cfg.table_name, start_time,
                                      end_time,
                                      SQL_FACTORY_LIMIT)

        if not data:
            return None

        for rows in data:
            yield tuple(rows)


@log_execution_time()
def get_factory_max_date(proc_cfg):
    """
    get factory max date
    """

    with DbProxy(proc_cfg.data_source) as db_instance:
        # gen sql
        get_date_col = add_double_quotes(proc_cfg.get_auto_increment_col_else_get_date())
        orig_tblname = proc_cfg.table_name.strip('\"')
        if not isinstance(db_instance, mysql.MySQL):
            table_name = add_double_quotes(orig_tblname)
        else:
            table_name = orig_tblname

        sql = f'select max({get_date_col}) from {table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)

        if not rows:
            return None

        out = rows[0][0]

        is_tz_col = db_instance.is_timezone_hold_column(orig_tblname, get_date_col)
        out = format_factory_date_to_meta_data(out, is_tz_col)

    return out, is_tz_col


SQL_PAST_DAYS_AGO = 1


@log_execution_time()
def get_tzoffset_of_random_record(data_source, table_name, get_date_col):
    # exec sql
    with DbProxy(data_source) as db_instance:
        # get timezone offset
        db_timezone = get_db_timezone(db_instance)

        sql = gen_sql(db_instance, table_name, get_date_col)
        _, rows = db_instance.run_sql(sql, row_is_dict=False)

        date_val = None
        tzoffset_str = None
        if rows:
            date_val, tzoffset_str = rows[0]

    return date_val, tzoffset_str, db_timezone


@scheduler_app_context
def factory_past_data_transform_job(_job_id, _job_name, _db_id, _proc_id, _proc_name, *args, **kwargs):
    """ scheduler job import factory data

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = factory_past_data_transform(*args, **kwargs)
    send_processing_info(gen, JobType.FACTORY_PAST_IMPORT, db_code=_db_id,
                         process_id=_proc_id, process_name=_proc_name,
                         after_success_func=add_gen_proc_link_job)


@log_execution_time()
def factory_past_data_transform(proc_id):
    """transform data and then import from factory db to universal db

    Arguments:
        proc_id {[type]} -- [description]

    Yields:
        [type] -- [description]
    """
    # start job
    yield 0

    # get process id in edge db
    proc_cfg: CfgProcess = CfgProcess.query.get(proc_id)
    data_src: CfgDataSourceDB = CfgDataSourceDB.query.get(proc_cfg.data_source_id)

    # check db connection
    check_db_connection(data_src)

    proc = Process.get_or_create_proc(proc_id=proc_id)

    # columns info
    proc_name = proc_cfg.name
    column_names = [col.column_name for col in proc_cfg.columns]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    auto_increment_idx = column_names.index(auto_increment_col)
    dic_use_cols = {col.column_name: col.data_type for col in proc_cfg.columns}

    # cycle class
    cycle_cls = find_cycle_class(proc_id)

    # check new adding column, save.
    missing_sensors = get_new_adding_columns(proc, dic_use_cols)
    save_sensors(missing_sensors)

    # sensor classes
    dic_sensor, dic_sensor_cls = gen_dic_sensor_n_cls(proc_id, dic_use_cols)

    # substring sensors info
    dic_substring_sensors = gen_substring_column_info(proc_id, dic_sensor)

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    # last import date
    last_import = FactoryImport.get_last_import(proc.id, JobType.FACTORY_PAST_IMPORT.name, is_first_id=True)

    if not last_import:
        # check if first time factory import was DONE !
        last_import = FactoryImport.get_first_import(proc.id, JobType.FACTORY_IMPORT.name)

        # the first time import data
        if not last_import:
            yield 100
            return

    filter_time = last_import.import_from

    if filter_time < convert_time(add_years(years=-1)):
        yield 100
        return

    # return if already inserted 2 millions
    if cycle_cls.get_count_by_proc_id(proc.id) > 2_000_000:
        yield 100
        return

    # is timezone column
    is_tz_col = False
    if filter_time[-1] == 'Z':
        is_tz_col = True

    # calc end time
    end_time = convert_time(filter_time, return_string=False)

    # calc start time
    start_time = add_days(end_time, days=-SQL_PAST_DAYS_AGO)

    # convert to char format
    start_time = format_factory_date_to_meta_data(start_time, is_tz_col)
    end_time = format_factory_date_to_meta_data(end_time, is_tz_col)

    # convert utc function
    dic_tz_info = {col: handle_time_zone(proc_cfg, col)
                   for col, dtype in dic_use_cols.items() if DataType[dtype] is DataType.DATETIME}

    # job info
    job_info = JobInfo()
    job_info.auto_increment_col_timezone = is_tz_col
    job_info.target = proc_cfg.name

    # get data from factory
    data = get_factory_data(proc_cfg, column_names, auto_increment_col, start_time, end_time)

    # there is no data , return
    if not data:
        gen_import_job_info(job_info, 0, start_time, end_time)
        job_info.auto_increment_col_timezone = is_tz_col
        job_info.percent = 100
        yield job_info
        return

    # get current job id
    t_job_management: JobManagement = JobManagement.get_last_job_of_process(proc_id, JobType.FACTORY_PAST_IMPORT.name)
    job_id = str(t_job_management.id) if t_job_management else ''
    data_source_name = proc_cfg.data_source.name
    table_name = proc_cfg.table_name

    # start import data
    cols = next(data)
    remain_rows = tuple()
    inserted_row_count = 0
    for rows in data:
        is_import, rows, remain_rows = gen_import_data(rows, remain_rows, auto_increment_idx)
        if not is_import:
            continue

        # dataframe
        df = pd.DataFrame(rows, columns=cols)

        # no records
        if not len(df):
            continue

        # Convert UTC time
        for col, dtype in dic_use_cols.items():
            if DataType[dtype] is not DataType.DATETIME:
                continue

            null_is_error = False
            if col == get_date_col:
                null_is_error = True

            validate_datetime(df, col, is_strip=False, null_is_error=null_is_error)
            df[col] = convert_df_col_to_utc(df, col, *dic_tz_info[col])
            df[col] = convert_df_datetime_to_str(df, col)

        # convert types
        df = df.convert_dtypes()

        # original df
        orig_df = df.copy()

        # data pre-processing
        df_error = data_pre_processing(df, orig_df, dic_use_cols, exclude_cols=[get_date_col])
        df_error_cnt = len(df_error)
        if df_error_cnt:
            df_error_trace = gen_error_output_df(proc_id, proc_name, dic_sensor, get_df_first_n_last(df_error))
            write_error_trace(df_error_trace, proc_cfg.name)
            write_error_import(df_error, proc_cfg.name)

        # remove duplicate records which exists DB
        df_duplicate = remove_duplicates(df, orig_df, proc_id, get_date_col)
        df_duplicate_cnt = len(df_duplicate)
        if df_duplicate_cnt:
            write_duplicate_records_to_file_factory(df_duplicate, data_source_name, table_name, dic_use_cols,
                                                    proc_cfg.name, job_id)

        # import data
        save_res = import_data(df, proc_id, get_date_col, cycle_cls, dic_sensor, dic_sensor_cls, dic_substring_sensors)

        # update job info
        imported_end_time = rows[-1][auto_increment_idx]
        gen_import_job_info(job_info, save_res, start_time, imported_end_time, err_cnt=df_error_cnt)

        # total row of one job
        total_row = job_info.row_count
        inserted_row_count += total_row

        job_info.calc_percent(inserted_row_count, MAX_RECORD)
        yield job_info

        # raise exception if FATAL error happened
        if job_info.status is JobStatus.FATAL:
            raise job_info.exception

        # output log
        log_str = 'FACTORY PAST DATA IMPORT SQL(days={}, records={}, range={}-{})'
        logger.info(log_str.format(SQL_PAST_DAYS_AGO, total_row, start_time, end_time))

    yield 100


@log_execution_time()
def handle_time_zone(proc_cfg, get_date_col):
    # convert utc time func
    get_date, tzoffset_str, db_timezone = get_tzoffset_of_random_record(proc_cfg.data_source, proc_cfg.table_name,
                                                                        get_date_col)

    if tzoffset_str:
        # use os time zone
        db_timezone = None
    else:
        detected_timezone = detect_timezone(get_date)
        # if there is time offset in datetime value, do not force time.
        if detected_timezone is None:
            # check and update if use os time zone flag changed
            # if tz offset in val date, do not need to force
            check_update_time_by_changed_tz(proc_cfg)

    if proc_cfg.data_source.db_detail.use_os_timezone:
        # use os time zone
        db_timezone = None

    is_tz_inside, _, time_offset = get_time_info(get_date, db_timezone)

    return is_tz_inside, time_offset


@log_execution_time()
def check_db_connection(data_src):
    # check db connection
    with DbProxy(data_src) as db_instance:
        if not db_instance.is_connected:
            raise Exception(MSG_DB_CON_FAILED)


@log_execution_time()
def gen_import_data(rows, remain_rows, auto_increment_idx):
    is_allow_import = True
    # last fetch
    if len(rows) < FETCH_MANY_SIZE:
        return is_allow_import, remain_rows + rows, []

    rows += remain_rows
    last_row_idx = len(rows) - 1
    first_row_idx = max(last_row_idx - 1000, 0)

    for i in range(last_row_idx, first_row_idx, -1):
        # difference time
        if rows[i][auto_increment_idx] != rows[i - 1][auto_increment_idx]:
            return is_allow_import, rows[:i], rows[i:]

    # no difference
    is_allow_import = False
    return is_allow_import, [], rows


def write_duplicate_records_to_file_factory(df_duplicate: DataFrame, data_source_name, table_name, dic_use_cols,
                                            proc_name, job_id=None):
    error_msg = 'Duplicate Record'
    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()

    df_output = gen_duplicate_output_df(dic_use_cols, get_df_first_n_last(df_duplicate),
                                        table_name=table_name, error_msgs=error_msg)

    write_duplicate_import(df_output, [proc_name, data_source_name, 'Duplicate', job_id, time_str, ip_address])
