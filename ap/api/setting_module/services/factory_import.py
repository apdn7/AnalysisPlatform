import logging
from datetime import datetime

import pandas as pd
import pytz
from pandas import DataFrame

from ap.api.setting_module.services.csv_import import remove_duplicates
from ap.api.setting_module.services.data_import import (
    check_update_time_by_changed_tz,
    convert_df_col_to_utc,
    convert_df_datetime_to_str,
    data_pre_processing,
    gen_duplicate_output_df,
    gen_error_output_df,
    gen_import_job_info,
    get_df_first_n_last,
    import_data,
    save_failed_import_history,
    save_import_history,
    validate_datetime,
    write_duplicate_import,
    write_error_import,
    write_error_trace,
)
from ap.api.setting_module.services.software_workshop_etl_services import (
    get_transaction_data_stmt,
    transform_df_for_software_workshop,
)
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job
from ap.common.common_utils import (
    DATE_FORMAT_STR_FACTORY_DB,
    DATE_FORMAT_STR_ONLY_DIGIT,
    add_days,
    add_double_quotes,
    add_years,
    convert_time,
)
from ap.common.constants import (
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_EMPTY_DATA,
    DATA_TYPE_ERROR_MSG,
    DATETIME_DUMMY,
    PAST_IMPORT_LIMIT_DATA_COUNT,
    DataColumnType,
    DataType,
    DBType,
    JobStatus,
    JobType,
    MasterDBType,
)
from ap.common.disk_usage import get_ip_address
from ap.common.logger import log_execution_time
from ap.common.pydn.dblib import mssqlserver, mysql, oracle, sqlite
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import scheduler_app_context
from ap.common.timezone_utils import detect_timezone, gen_sql, get_db_timezone, get_time_info
from ap.setting_module.models import CfgDataSourceDB, CfgProcess, JobManagement
from ap.setting_module.services.background_process import (
    JobInfo,
    format_factory_date_to_meta_data,
    send_processing_info,
)
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)

MAX_RECORD = 1_000_000
SQL_FACTORY_LIMIT = 5_000_000
SQL_DAY = 1
SQL_DAYS_AGO = 30
FETCH_MANY_SIZE = 20_000
SQL_FACTORY_LIMIT_DAYS = 16


# pd.options.mode.chained_assignment = None  # default='warn'


@scheduler_app_context
def import_factory_job(
    process_id: int,
    process_name: str,
    data_source_id: int,
    is_user_request: bool = False,
):
    """scheduler job import factory data"""

    gen = import_factory(process_id)
    send_processing_info(
        gen,
        JobType.FACTORY_IMPORT,
        db_code=data_source_id,
        process_id=process_id,
        process_name=process_name,
        after_success_func=add_gen_proc_link_job,
        after_success_func_kwargs={'process_id': process_id, 'is_user_request': is_user_request, 'publish': True},
    )


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
    DbProxy.check_db_connection(data_src)

    trans_data = TransactionData(proc_cfg.id)
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        trans_data.create_table(db_instance)
        # last import date
        last_import = trans_data.get_import_history_last_import(db_instance, JobType.FACTORY_IMPORT.name)

    # columns info
    proc_name = proc_cfg.name
    column_names = [col.column_name for col in proc_cfg.columns]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    auto_increment_idx = column_names.index(auto_increment_col)
    dic_use_cols = {col.column_name: col for col in proc_cfg.columns}
    cfg_columns = proc_cfg.columns

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    # the first time import data : get minimum time of factory db
    filter_time = last_import.import_to if last_import else None

    # convert utc function
    dic_tz_info = {
        col: handle_time_zone(proc_cfg, col)
        for col, cfg_col in dic_use_cols.items()
        if DataType[cfg_col.data_type] is DataType.DATETIME or col == get_date_col
    }

    # get factory max date
    fac_min_date, fac_max_date, is_tz_col = get_factory_min_max_date(proc_cfg)

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
    job_info.job_id = job_id
    data_source_name = proc_cfg.data_source.name
    table_name = proc_cfg.table_name
    has_data = True

    while inserted_row_count < MAX_RECORD and is_import:
        # get sql range
        if end_time:
            if total_row:
                sql_day = calc_range_days_func(sql_day, total_row)

            start_time, end_time, filter_time = get_sql_range_time(
                end_time,
                range_day=sql_day,
                fac_max_date=fac_max_date,
                is_tz_col=is_tz_col,
            )
        else:
            start_time, end_time, filter_time = get_sql_range_time(
                filter_time,
                fac_max_date=fac_max_date,
                is_tz_col=is_tz_col,
                is_first_time=True,
            )

        # no data in range, stop
        if start_time > fac_max_date:
            has_data = False
            break

        # validate import date range
        if end_time >= fac_max_date:
            is_import = False

        # get data from factory
        data = get_factory_data(proc_cfg, column_names, auto_increment_col, start_time, end_time)
        if not data:
            has_data = False
            break

        cols = next(data)
        remain_rows = ()
        error_type = None
        for _rows in data:
            # Reassign attribute
            get_date_col = proc_cfg.get_date_col()
            proc_id = proc_cfg.id
            cfg_columns = [
                col for col in proc_cfg.columns if col.column_type != DataColumnType.GENERATED_EQUATION.value
            ]

            is_import, rows, remain_rows = gen_import_data(_rows, remain_rows, auto_increment_idx)
            if not is_import:
                continue

            # dataframe
            df = pd.DataFrame(rows, columns=cols)
            # to save into import history
            imported_end_time = str(df[auto_increment_col].max())
            # pivot if this is vertical data
            if proc_cfg.data_source.type == DBType.SOFTWARE_WORKSHOP.name:
                df = transform_df_for_software_workshop(
                    df,
                    proc_cfg.data_source_id,
                    proc_cfg.process_factid,
                    master_type=MasterDBType[proc_cfg.master_type],
                    rename_columns={col.column_raw_name: col.column_name for col in cfg_columns},
                )

            # no records
            if not len(df):
                error_type = DATA_TYPE_ERROR_EMPTY_DATA
                save_failed_import_history(proc_id, job_info, error_type)
                continue

            # Convert UTC time
            for col, cfg_col in dic_use_cols.items():
                dtype = cfg_col.data_type
                if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
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
            df_error = data_pre_processing(
                df,
                orig_df,
                dic_use_cols,
                exclude_cols=[get_date_col],
                get_date_col=get_date_col,
            )
            df_error_cnt = len(df_error)
            if df_error_cnt:
                factory_data_name = f'{proc_id}_{proc_name}'
                df_error_trace = gen_error_output_df(
                    factory_data_name,
                    dic_use_cols,
                    get_df_first_n_last(df_error),
                    df_error.head(),
                )
                write_error_trace(df_error_trace, proc_cfg.name)
                write_error_import(df_error, proc_cfg.name)
                error_type = DATA_TYPE_ERROR_MSG

            # no records
            if not len(df):
                error_type = DATA_TYPE_ERROR_EMPTY_DATA
                save_failed_import_history(proc_id, job_info, error_type)
                continue

            # merge mode
            cfg_proc: CfgProcess = CfgProcess.get_proc_by_id(proc_id)
            parent_id = cfg_proc.parent_id
            if parent_id:
                cfg_parent_proc: CfgProcess = CfgProcess.get_proc_by_id(parent_id)
                dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in cfg_parent_proc.columns}
                dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
                dic_rename = {}
                for col in df.columns:
                    if dic_cols.get(col):
                        dic_rename[col] = dic_parent_cfg_cols[dic_cols[col]].column_name
                df = df.rename(columns=dic_rename)
                orig_df = orig_df.rename(columns=dic_rename)
                df_error = df_error.rename(columns=dic_rename)
                proc_id = parent_id
                cfg_columns = [
                    col for col in cfg_parent_proc.columns if col.column_type != DataColumnType.GENERATED_EQUATION.value
                ]
                get_date_col = cfg_parent_proc.get_date_col()

            # remove duplicate records which exists DB
            df_duplicate = remove_duplicates(df, orig_df, df_error, proc_id, get_date_col, cfg_columns)
            df_duplicate_cnt = len(df_duplicate)
            if df_duplicate_cnt:
                write_duplicate_records_to_file_factory(
                    df_duplicate,
                    data_source_name,
                    table_name,
                    dic_use_cols,
                    proc_cfg.name,
                    job_id,
                )
                error_type = DATA_TYPE_DUPLICATE_MSG

            # import data
            job_info.import_type = JobType.FACTORY_IMPORT.name

            # to save into
            job_info.import_from = start_time
            job_info.import_to = imported_end_time

            job_info.status = JobStatus.DONE.name
            if error_type:
                job_info.status = JobStatus.FAILED.name
                job_info.err_msg = error_type

            df = remove_non_exist_columns_in_df(df, [col.column_name for col in cfg_columns])
            save_res = import_data(df, proc_id, get_date_col, cfg_columns, job_info)

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
                f'FACTORY DATA IMPORT SQL(days = {sql_day}, records = {total_row}, range = {start_time} - {end_time})',
            )

    if not has_data:
        # save record into factory import to start job FACTORY PAST
        gen_import_job_info(job_info, 0, start_time, start_time)
        job_info.auto_increment_col_timezone = is_tz_col
        job_info.percent = 100
        # insert import history
        job_info.import_type = JobType.FACTORY_IMPORT.name
        job_info.import_from = start_time
        job_info.import_to = start_time
        save_import_history(proc_id, job_info=job_info)
        yield job_info


@log_execution_time()
def calc_sql_range_days():
    """
    calculate range of days for 1 sql sentence
    """
    limit_record = 100_000
    limit_max_day = SQL_FACTORY_LIMIT_DAYS
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

        # make sure range is 1 ~ 16 days
        day_cnt = min(day_cnt, limit_max_day)
        day_cnt = max(day_cnt, limit_min_day)
        # day range for next time import

        logger.debug(
            f'''\
== factory import info ==
cur_day_cnt: {cur_day_cnt}
cur_record_cnt: {cur_record_cnt}
limit_record: {limit_record}
limit_max_day: {limit_max_day}
limit_min_day: {limit_min_day}
next time range: day_cnt: {day_cnt}
== end of factory import info ==
''',
        )

        return day_cnt

    return _calc_sql_range_days


def get_limit_date(from_date=None, start_days_ago=SQL_DAYS_AGO):
    if not from_date:
        from_date = datetime.utcnow()
    return add_days(time=from_date, days=-start_days_ago).replace(hour=0, minute=0, second=0, microsecond=0)


@log_execution_time()
def get_sql_range_time(
    filter_time=None,
    range_day=SQL_DAY,
    start_days_ago=SQL_DAYS_AGO,
    fac_max_date=None,
    is_tz_col=False,
    is_first_time=False,
):
    # if there is no data , this poling is the first time, so get data of n days ago.
    limit_date = get_limit_date(start_days_ago=start_days_ago)
    # first time of importing but fac_max_date in past
    # --|//////|----|<-limit_date---now->|----
    if fac_max_date:
        max_date = convert_time(fac_max_date, return_string=False)
        max_date_utc = max_date.replace(tzinfo=pytz.utc)
        limit_date_utc = limit_date.replace(tzinfo=pytz.utc)
        if max_date_utc < limit_date_utc:
            limit_date = get_limit_date(max_date)

    # start time
    filter_time = max(convert_time(filter_time), convert_time(limit_date)) if filter_time else convert_time(limit_date)

    # start time
    start_time = convert_time(filter_time, return_string=False)

    # 8 days after
    end_time = add_days(start_time, days=range_day)

    # convert to string
    start_time = convert_time(start_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_millisecond=True)
    end_time = convert_time(end_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_millisecond=True)
    filter_time = convert_time(filter_time, format_str=DATE_FORMAT_STR_FACTORY_DB, only_millisecond=True)

    if is_tz_col:
        start_time += 'Z'
        end_time += 'Z'
        filter_time += 'Z'

    return start_time, end_time, filter_time


def get_data_by_range_time_sql(db_instance, get_date_col, column_names, table_name, start_time, end_time, sql_limit):
    if isinstance(db_instance, mysql.MySQL):
        sel_cols = ','.join(column_names)
    else:
        table_name = add_double_quotes(table_name)
        if isinstance(db_instance, mssqlserver.MSSQLServer):
            sel_cols = ','.join(
                [
                    add_double_quotes(col) if col != get_date_col else f'convert(varchar(30), "{col}", 127) "{col}"'
                    for col in column_names
                ],
            )
        else:
            sel_cols = ','.join([add_double_quotes(col) for col in column_names])
        get_date_col = add_double_quotes(get_date_col)

    # sql
    sql = f"{sel_cols} FROM {table_name} WHERE {get_date_col} > '{start_time}' AND {get_date_col} <= '{end_time}'"
    if isinstance(db_instance, sqlite.SQLite3):
        # compare datetime for sqlite case only
        sql = f"{sel_cols} FROM {table_name} WHERE datetime({get_date_col}) > datetime('{start_time}') "
        sql += f"AND datetime({get_date_col}) <= datetime('{end_time}')"
    sql = f'{sql} ORDER BY {get_date_col}'

    if isinstance(db_instance, mssqlserver.MSSQLServer):
        sql = f'SELECT TOP {sql_limit} {sql}'
    elif isinstance(db_instance, oracle.Oracle):
        sql = f'SELECT * FROM (SELECT {sql}) WHERE ROWNUM <= {sql_limit}'
    else:
        sql = f'SELECT {sql} LIMIT {sql_limit}'

    return sql, None


@log_execution_time('[FACTORY DATA IMPORT SELECT SQL]')
def get_data_by_range_time(
    db_instance,
    proc_cfg,
    get_date_col,
    column_names,
    table_name,
    start_time,
    end_time,
    sql_limit,
):
    if proc_cfg.data_source.type == DBType.SOFTWARE_WORKSHOP.name:
        stmt = get_transaction_data_stmt(
            proc_cfg.process_factid,
            start_time,
            end_time,
            limit=sql_limit,
            master_type=MasterDBType[proc_cfg.master_type],
        )
        sql, params = db_instance.gen_sql_and_params(stmt)
    else:
        sql, params = get_data_by_range_time_sql(
            db_instance,
            get_date_col,
            column_names,
            table_name,
            start_time,
            end_time,
            sql_limit,
        )

    logger.info(f'sql: {sql}')
    data = db_instance.fetch_many(sql, FETCH_MANY_SIZE, params=params)
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
        data = get_data_by_range_time(
            db_instance,
            proc_cfg,
            auto_increment_col,
            column_names,
            proc_cfg.table_name,
            start_time,
            end_time,
            SQL_FACTORY_LIMIT,
        )

        if not data:
            return None

        for rows in data:
            yield tuple(rows)


@log_execution_time()
def get_factory_min_max_date(proc_cfg):
    """
    get factory max date
    """

    with DbProxy(proc_cfg.data_source) as db_instance:
        # gen sql
        agg_results = []
        get_date_col = add_double_quotes(proc_cfg.get_auto_increment_col_else_get_date())
        orig_tblname = proc_cfg.table_name_for_query_datetime().strip('"')
        table_name = add_double_quotes(orig_tblname) if not isinstance(db_instance, mysql.MySQL) else orig_tblname
        for agg_func in ['MIN', 'MAX']:
            sql = f'select {agg_func}({get_date_col}) from {table_name}'
            if isinstance(db_instance, mssqlserver.MSSQLServer):
                sql = f'select convert(varchar(30), {agg_func}({get_date_col}), 127) from {table_name}'
            sql = proc_cfg.filter_for_query_datetime(sql)
            _, rows = db_instance.run_sql(sql, row_is_dict=False)

            if not rows:
                break

            agg_results.append(rows[0][0])
            # out = rows[0][0]
            #
            # if out == DATETIME_DUMMY:
            #     return None, False

        min_time, max_time = agg_results
        if max_time == DATETIME_DUMMY:
            return None, None, False

        is_tz_col = db_instance.is_timezone_hold_column(orig_tblname, get_date_col)
        min_time = format_factory_date_to_meta_data(min_time, is_tz_col)
        max_time = format_factory_date_to_meta_data(max_time, is_tz_col)

    return min_time, max_time, is_tz_col


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
def factory_past_data_transform_job(process_id: int, process_name: str, data_source_id: int):
    """scheduler job import factory data"""

    gen = factory_past_data_transform(process_id)
    send_processing_info(
        gen,
        JobType.FACTORY_PAST_IMPORT,
        db_code=data_source_id,
        process_id=process_id,
        process_name=process_name,
        after_success_func=add_gen_proc_link_job,
        after_success_func_kwargs={'process_id': process_id},
    )


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
    DbProxy.check_db_connection(data_src)

    # columns info
    proc_name = proc_cfg.name
    cfg_columns = [col for col in proc_cfg.columns if col.column_type != DataColumnType.GENERATED_EQUATION.value]
    column_names = [col.column_name for col in cfg_columns]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    auto_increment_idx = column_names.index(auto_increment_col)
    dic_use_cols = {col.column_name: col for col in cfg_columns}

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    trans_data = TransactionData(proc_id)
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        trans_data.create_table(db_instance)
        # last import date
        last_import = trans_data.get_import_history_last_import(db_instance, JobType.FACTORY_PAST_IMPORT.name)

        if not last_import:
            # check if first time factory import was DONE !
            last_import = trans_data.get_import_history_first_import(db_instance, JobType.FACTORY_IMPORT.name)

        # the first time import data
        if not last_import:
            yield 100
            return

    filter_time = last_import.import_from

    if not filter_time or filter_time < convert_time(add_years(years=-1)):
        yield 100
        return

    # return if already inserted 2 millions
    with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
        data_cnt = trans_data.count_data(db_instance)

    if data_cnt > PAST_IMPORT_LIMIT_DATA_COUNT:
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
    dic_tz_info = {
        col: handle_time_zone(proc_cfg, col)
        for col, cfg_col in dic_use_cols.items()
        if DataType[cfg_col.data_type] is DataType.DATETIME
    }

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
    job_info.job_id = job_id
    data_source_name = proc_cfg.data_source.name
    table_name = proc_cfg.table_name

    # start import data
    cols = next(data)
    remain_rows = ()
    inserted_row_count = 0
    has_data = False
    error_type = None
    for _rows in data:
        has_data = True
        is_import, rows, remain_rows = gen_import_data(_rows, remain_rows, auto_increment_idx)
        if not is_import:
            continue

        # dataframe
        df = pd.DataFrame(rows, columns=cols)
        # pivot if this is vertical data
        if proc_cfg.data_source.type == DBType.SOFTWARE_WORKSHOP.name:
            df = transform_df_for_software_workshop(
                df,
                proc_cfg.data_source_id,
                proc_cfg.process_factid,
                master_type=MasterDBType[proc_cfg.master_type],
                rename_columns={col.column_raw_name: col.column_name for col in cfg_columns},
            )

        # no records
        if not len(df):
            error_type = DATA_TYPE_ERROR_EMPTY_DATA
            save_failed_import_history(proc_id, job_info, error_type)
            continue
        # TODO: check merge mode
        # Convert UTC time
        for col, cfg_col in dic_use_cols.items():
            dtype = cfg_col.data_type
            if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
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
        df_error = data_pre_processing(
            df,
            orig_df,
            dic_use_cols,
            exclude_cols=[get_date_col],
            get_date_col=get_date_col,
        )
        df_error_cnt = len(df_error)
        if df_error_cnt:
            factory_data_name = f'{proc_id}_{proc_name}'
            df_error_trace = gen_error_output_df(
                factory_data_name,
                dic_use_cols,
                get_df_first_n_last(df_error),
                df_error.head(),
            )
            write_error_trace(df_error_trace, proc_cfg.name)
            write_error_import(df_error, proc_cfg.name)
            error_type = DATA_TYPE_ERROR_MSG

        # remove duplicate records which exists DB
        df_duplicate = remove_duplicates(df, orig_df, df_error, proc_id, get_date_col, cfg_columns)
        df_duplicate_cnt = len(df_duplicate)
        if df_duplicate_cnt:
            write_duplicate_records_to_file_factory(
                df_duplicate,
                data_source_name,
                table_name,
                dic_use_cols,
                proc_cfg.name,
                job_id,
            )
            error_type = DATA_TYPE_DUPLICATE_MSG

        # import data
        job_info.import_type = JobType.FACTORY_PAST_IMPORT.name

        imported_end_time = rows[-1][auto_increment_idx]
        # to save into import history
        job_info.import_from = start_time
        job_info.import_to = imported_end_time

        job_info.status = JobStatus.DONE.name
        if error_type:
            # save import history
            job_info.status = JobStatus.FAILED.name
            job_info.err_msg = error_type

        df = remove_non_exist_columns_in_df(df, [col.column_name for col in cfg_columns])
        save_res = import_data(df, proc_id, get_date_col, cfg_columns, job_info)

        # update job info
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

    if not has_data:
        gen_import_job_info(job_info, 0, start_time, end_time)
        job_info.auto_increment_col_timezone = is_tz_col
        job_info.percent = 100
        job_info.import_type = JobType.FACTORY_PAST_IMPORT.name
        job_info.import_from = start_time
        job_info.import_to = end_time
        save_import_history(proc_id, job_info)
        yield job_info


def remove_non_exist_columns_in_df(df, required_columns: list[str]) -> pd.DataFrame:
    good_columns = [col for col in df.columns if col in required_columns]
    return df[good_columns]


@log_execution_time()
def handle_time_zone(proc_cfg, get_date_col):
    # convert utc time func
    get_date, tzoffset_str, db_timezone = get_tzoffset_of_random_record(
        proc_cfg.data_source,
        proc_cfg.table_name_for_query_datetime(),
        get_date_col,
    )

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

    is_timezone_inside, db_time_zone, utc_offset = get_time_info(get_date, db_timezone)

    return is_timezone_inside, db_time_zone, utc_offset


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


def write_duplicate_records_to_file_factory(
    df_duplicate: DataFrame,
    data_source_name,
    table_name,
    dic_use_cols,
    proc_name,
    job_id=None,
):
    error_msg = DATA_TYPE_DUPLICATE_MSG
    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()

    df_output = gen_duplicate_output_df(
        dic_use_cols,
        get_df_first_n_last(df_duplicate),
        table_name=table_name,
        error_msgs=error_msg,
    )

    write_duplicate_import(df_output, [proc_name, data_source_name, 'Duplicate', job_id, time_str, ip_address])
