from __future__ import annotations

from datetime import datetime

import pandas as pd
import pytz
from loguru import logger
from pandas import DataFrame

from ap.api.efa.services.etl import df_transform
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
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job, finished_transaction_import
from ap.common.common_utils import (
    RangeBound,
    add_days,
    add_double_quotes,
    add_years,
    convert_time,
)
from ap.common.constants import (
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_MSG,
    DATE_FORMAT_STR_ONLY_DIGIT,
    DATETIME_DUMMY,
    IMPORT_FACTOR_EMPTY_DATA,
    PAST_IMPORT_LIMIT_DATA_COUNT,
    SQL_DAYS_AGO,
    DataType,
    DBType,
    JobStatus,
    JobType,
    MasterDBType,
)
from ap.common.disk_usage import get_ip_address
from ap.common.jobs.job_info_schema import FactoryImportJobInfo, FactoryPastImportJobInfo
from ap.common.log import log_execution_time
from ap.common.pandas_helper import check_if_array_is_repeating
from ap.common.pydn.dblib import mssqlserver, mysql, oracle, sqlite
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.scheduler import scheduler_app_context
from ap.common.timezone_utils import (
    detect_timezone,
    gen_sql,
    get_db_timezone,
    get_time_info,
)
from ap.conversion_formula import JudgeFormula, conversion_formula
from ap.etl.factory_import.common import ImportBase
from ap.etl.transform import TransformData
from ap.etl.transform.pipeline import (
    software_workshop_postgres_history_transform_pipeline,
    software_workshop_postgres_measurement_transform_pipeline,
)
from ap.setting_module.models import CfgDataSourceDB, CfgProcess, CfgProcessColumn, JobManagement
from ap.setting_module.services.background_process import (
    JobInfo,
    format_factory_date_to_meta_data,
    send_processing_info,
)
from ap.trace_data.transaction_model import ImportHistoryTable, TransactionData

MAX_RECORD = 1_000_000
SQL_FACTORY_LIMIT = 5_000_000
SOFTWARE_WORKSHOP_FACTORY_LIMIT = 20_000
SQL_DAY = 1
FETCH_MANY_SIZE = 20_000
SQL_FACTORY_LIMIT_DAYS = 16


# pd.options.mode.chained_assignment = None  # default='warn'


@scheduler_app_context
def factory_import_job(
    process_id: int,
    job_management: JobManagement,
    is_user_request: bool = False,
):
    """Scheduler job import factory data"""
    gen = factory_import(process_id, job_management=job_management)
    send_processing_info(
        gen,
        job_management=job_management,
        after_success_func=finished_transaction_import,
        after_success_func_kwargs={'process_id': process_id, 'is_user_request': is_user_request, 'publish': True},
    )
    add_gen_proc_link_job(process_id=process_id, is_user_request=True, publish=True)


@log_execution_time()
def factory_import(proc_id, job_management: JobManagement):
    """Transform data and then import from factory db to universal db

    Arguments:
        proc_id {[type]} -- [description]

    Yields:
        [type] -- [description]
    """
    # start job
    yield 0

    # get process id in edge db
    proc_cfg: CfgProcess = CfgProcess.get_proc_by_id(proc_id)

    if not proc_cfg:
        return

    # Isolate object that not link to SQLAlchemy to avoid changes in other session
    proc_cfg = proc_cfg.clone()
    data_src: CfgDataSourceDB = proc_cfg.data_source.db_detail
    cfg_columns = proc_cfg.get_transaction_process_columns()

    # get parent process config
    parent_cfg_proc: CfgProcess | None = None
    parent_cfg_columns: list[CfgProcessColumn] | None = None
    if proc_cfg.parent_id:
        parent_cfg_proc: CfgProcess | None = CfgProcess.get_proc_by_id(proc_cfg.parent_id)
        parent_cfg_columns: list[CfgProcessColumn] | None = parent_cfg_proc.get_transaction_process_columns()

    # check db connection
    ReadOnlyDbProxy.check_db_connection(data_src)

    trans_data = TransactionData(proc_cfg)
    with (
        TxnMetaConnection(process_id=proc_id) as meta_con,
        TxnDataConnection(process_id=proc_id, readonly_transaction=False) as data_con,
    ):
        # last import date
        # TODO: need to improve to not create table here
        trans_data.create_table(data_con=data_con, meta_con=meta_con)

    # columns info
    proc_name = proc_cfg.name
    transaction_columns = proc_cfg.get_transaction_process_columns()
    raw_column_names = [col.column_raw_name for col in transaction_columns if col.is_normal_column]
    col_name = [col.column_name for col in transaction_columns if col.is_normal_column]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    dic_use_cols = {col.column_name: col for col in transaction_columns}
    # get etl from the process
    etl_func = proc_cfg.get_etl_func()

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    # convert utc function
    dic_tz_info = {
        col: handle_time_zone(proc_cfg, col)
        for col, cfg_col in dic_use_cols.items()
        if DataType[cfg_col.data_type] is DataType.DATETIME or col == get_date_col
    }

    # get factory max date
    factory_import_obj: ImportBase = ImportBase.get_instance(proc_cfg)
    is_tz_col = factory_import_obj.is_tz_col
    factory_time_range = factory_import_obj.get_factory_min_max_date()

    inserted_row_count = 0
    job_info = JobInfo()
    job_info.auto_increment_col_timezone = is_tz_col
    job_info.target = proc_cfg.name

    factory_job_info = FactoryImportJobInfo()
    job_management.info = factory_job_info

    if factory_time_range is None:
        job_info.percent = 100
        error_type = IMPORT_FACTOR_EMPTY_DATA
        save_failed_import_history(proc_cfg.id, job_info, error_type)
        factory_job_info.warning(error_type)
        yield job_info
        return

    # get current job id
    job_id = int(job_management.id) if job_management else None
    job_info.job_id = job_id
    data_source_name = proc_cfg.data_source.name
    table_name = proc_cfg.table_name

    try:
        import_history_record = ImportHistoryTable.get_import_history(proc_cfg.id)
        selectable_time_range = factory_import_obj.detect_query_datetime_range(
            factory_time_range, import_history_record
        )
        if selectable_time_range is None:
            # In case there are no matched time range to collect data, it means that out of range or no new future data.
            factory_job_info.warning('No selectable time range was found')
            return

        start_time = format_factory_date_to_meta_data(
            selectable_time_range.min.value, is_tz_col=is_tz_col, db_type=proc_cfg.data_source.type
        )
        end_time = format_factory_date_to_meta_data(
            selectable_time_range.max.value, is_tz_col=is_tz_col, db_type=proc_cfg.data_source.type
        )

        factory_job_info.start_time = selectable_time_range.max.value
        factory_job_info.end_time = selectable_time_range.min.value

        data = factory_import_obj.get_factory_data(selectable_time_range)

        cols = next(data)  # this is essentially raw names
        # cols_normalize = normalize_list(cols)
        remain_rows = ()
        error_type = None
        for _rows in data:
            is_import, rows, remain_rows = gen_import_data(_rows, remain_rows, cols, auto_increment_col)

            if not is_import:
                continue

            if etl_func:
                # apply etl_func for rows
                df_rows = pd.DataFrame(rows, columns=cols)
                df_rows = df_transform(df_rows, etl_func)

                # filter columns by raw_column_names in transaction
                df_rows_filter = df_rows[raw_column_names]
                rows = tuple(tuple(row) for row in df_rows_filter.to_numpy())
                # dataframe
                df = pd.DataFrame(rows, columns=col_name, dtype=pd.StringDtype())
            else:
                # dataframe
                df = pd.DataFrame(rows, columns=cols, dtype=pd.StringDtype())

            # to save into import history
            imported_start_time = str(df[auto_increment_col].min())
            imported_end_time = str(df[auto_increment_col].max())
            data_frame_info = FactoryImportJobInfo.FactoryImportDataFrameInfo(
                size=len(df),
                imported_start_time=format_factory_date_to_meta_data(df[auto_increment_col].min(), is_tz_col=is_tz_col),
                imported_end_time=format_factory_date_to_meta_data(df[auto_increment_col].max(), is_tz_col=is_tz_col),
            )
            factory_job_info.data_frame_info_objects.append(data_frame_info)

            # pivot if this is vertical data
            if MasterDBType.is_software_workshop(proc_cfg.master_type):
                if proc_cfg.master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name:
                    pipeline = software_workshop_postgres_measurement_transform_pipeline(
                        data_source_id=proc_cfg.data_source_id,
                        process_factid=proc_cfg.process_factid,
                        add_missing_columns=False,
                    )
                elif proc_cfg.master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name:
                    pipeline = software_workshop_postgres_history_transform_pipeline()
                else:
                    factory_job_info.error(f'Unsupported master type: {proc_cfg.master_type}')
                    raise NotImplementedError(f'unsupported {proc_cfg.master_type} for software workshop')
                transformed_data = pipeline.run(TransformData(df=df))
                df = transformed_data.df.rename(columns={col.column_raw_name: col.column_name for col in cfg_columns})

            # no records
            if not len(df):
                error_type = IMPORT_FACTOR_EMPTY_DATA
                factory_job_info.warning(error_type)
                save_failed_import_history(proc_id, job_info, error_type)
                continue

            for col, cfg_col in dic_use_cols.items():
                dtype = cfg_col.data_type
                df = convert_with_formula_for_factory_import(cfg_col, df)
                if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
                    continue
                empty_as_error = col == get_date_col
                df = validate_datetime(df, col, is_strip=False, empty_as_error=empty_as_error)
                df[col] = convert_df_col_to_utc(df, col, *dic_tz_info[col])
                df[col] = convert_df_datetime_to_str(df, col)

            # convert types
            df = df.convert_dtypes()

            # rename df's columns using the column names matching with the raw names
            raw_to_column_name_dict = {value.column_raw_name: value.column_name for key, value in dic_use_cols.items()}
            df = df.rename(columns=raw_to_column_name_dict)

            # original df
            orig_df = df.copy()

            # data pre-processing
            df, df_error = data_pre_processing(
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
                data_frame_info.error_rows = df_error_cnt

            # no records
            if not len(df):
                error_type = IMPORT_FACTOR_EMPTY_DATA
                save_failed_import_history(proc_id, job_info, error_type)
                factory_job_info.warning(error_type)
                continue

            # merge mode
            target_cfg_process = proc_cfg
            target_get_date_col = get_date_col
            target_cfg_columns = cfg_columns
            child_cfg_proc = None
            if parent_cfg_proc:
                child_cfg_proc = proc_cfg
                target_cfg_process = parent_cfg_proc
                target_cfg_columns = parent_cfg_columns
                dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in parent_cfg_columns}
                dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
                dic_rename = {}
                for col in df.columns:
                    if dic_cols.get(col):
                        dic_rename[col] = dic_parent_cfg_cols[dic_cols[col]].column_name
                df = df.rename(columns=dic_rename)
                # remove column do not merge
                df = df[dic_rename.values()]
                orig_df = orig_df.rename(columns=dic_rename)
                df_error = df_error.rename(columns=dic_rename)
                target_get_date_col = parent_cfg_proc.get_date_col()

            # Handle calculate data for main::Serial function column
            from ap.api.setting_module.services.import_function_column import handle_main_function_columns

            df = handle_main_function_columns(target_cfg_process, df)

            # remove duplicate records which exists DB
            df, df_duplicate = remove_duplicates(df, orig_df, df_error, target_cfg_process, target_get_date_col)
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
                data_frame_info.duplicate_rows = df_duplicate_cnt

            # import data
            job_info.import_type = JobType.FACTORY_IMPORT.name

            # to save into
            job_info.import_from = format_factory_date_to_meta_data(
                imported_start_time, is_tz_col, db_type=proc_cfg.data_source.type
            )
            job_info.import_to = format_factory_date_to_meta_data(
                imported_end_time, is_tz_col, db_type=proc_cfg.data_source.type
            )

            job_info.status = JobStatus.DONE.name
            if error_type:
                job_info.status = JobStatus.FAILED.name
                job_info.err_msg = error_type
            df = remove_non_exist_columns_in_df(df, [col.column_name for col in target_cfg_columns])
            save_res = import_data(df, target_cfg_process, target_get_date_col, job_info, child_cfg_proc)
            gen_import_job_info(job_info, save_res, imported_start_time, imported_end_time, err_cnt=df_error_cnt)
            data_frame_info.imported_rows = len(df)
            # total row of one job
            total_row = job_info.row_count
            inserted_row_count += total_row

            job_info.calc_percent(inserted_row_count, MAX_RECORD)

            with job_info.interruptible() as job_info:
                yield job_info

            # raise exception if FATAL error happened
            if job_info.status is JobStatus.FATAL:
                raise job_info.exception

            log_str = f'Imported {total_row} records, range={job_info.import_from} - {job_info.import_to}'
            factory_job_info.info(content=log_str)
            logger.info(log_str)

        log_str = (
            f'FACTORY DATA IMPORT SQL('
            f'total_imported_rows={factory_job_info.total_imported_rows}, '
            f'total_duplicate_rows={factory_job_info.total_duplicate_rows}, '
            f'total_error_rows={factory_job_info.total_error_rows}, '
            f'import_from={start_time}, '
            f'import_to={end_time}'
            f')'
        )
        factory_job_info.info(content=log_str)
        logger.info(log_str)
    except Exception as e:
        factory_job_info.error(f'Exception raised: {e!s}')
        raise e


@log_execution_time()
def calc_sql_range_days():
    """Calculate range of days for 1 sql sentence"""
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
            f"""\
== factory import info ==
cur_day_cnt: {cur_day_cnt}
cur_record_cnt: {cur_record_cnt}
limit_record: {limit_record}
limit_max_day: {limit_max_day}
limit_min_day: {limit_min_day}
next time range: day_cnt: {day_cnt}
== end of factory import info ==
""",
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
    db_type: str = DBType.SQLITE.name,
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
    start_time = format_factory_date_to_meta_data(start_time, is_tz_col=is_tz_col, db_type=db_type)
    end_time = format_factory_date_to_meta_data(end_time, is_tz_col=is_tz_col, db_type=db_type)
    filter_time = format_factory_date_to_meta_data(filter_time, is_tz_col=is_tz_col, db_type=db_type)

    return start_time, end_time, filter_time


def get_data_by_range_time_sql(
    db_instance, get_date_col: str, column_names: list[str], table_name: str, time_range: RangeBound[str], sql_limit
):
    if isinstance(db_instance, mysql.MySQL):
        column_names = [f'`{column_name}`' for column_name in column_names]
        sel_cols = ','.join(column_names)
    else:
        if isinstance(db_instance, mssqlserver.MSSQLServer):
            sel_cols = ','.join(
                [
                    add_double_quotes(col) if col != get_date_col else f'convert(varchar(30), "{col}", 120) "{col}"'
                    for col in column_names
                ],
            )
        elif isinstance(db_instance, oracle.Oracle):
            sel_cols = ','.join(
                [
                    add_double_quotes(col)
                    if col != get_date_col
                    else f'{
                        db_instance.format_tz_column(table_name, add_double_quotes(get_date_col), get_date_col)
                    } AS {add_double_quotes(get_date_col)}'
                    for col in column_names
                ],
            )
        else:
            sel_cols = ','.join([add_double_quotes(col) for col in column_names])
        table_name = add_double_quotes(table_name)
        get_date_col = add_double_quotes(get_date_col)

    start_op = time_range.get_start_operator()
    end_op = time_range.get_end_operator()

    conditions = []

    if isinstance(db_instance, sqlite.SQLite3):
        if start_op:
            conditions.append(f"datetime({get_date_col}) {start_op} datetime('{time_range.min.value}')")
        if end_op:
            conditions.append(f"datetime({get_date_col}) {end_op} datetime('{time_range.max.value}')")
    else:
        if start_op:
            conditions.append(f"{get_date_col} {start_op} '{time_range.min.value}'")
        if end_op:
            conditions.append(f"{get_date_col} {end_op} '{time_range.max.value}'")

    where_clause = ' AND '.join(conditions) if conditions else '1=1'
    sql = f'{sel_cols} FROM {table_name} WHERE {where_clause}'

    sql = f'{sql} ORDER BY {get_date_col}'

    if isinstance(db_instance, mssqlserver.MSSQLServer):
        sql = f'SELECT TOP {sql_limit} {sql}'
    elif isinstance(db_instance, oracle.Oracle):
        sql = f'SELECT * FROM (SELECT {sql}) WHERE ROWNUM <= {sql_limit}'
    else:
        sql = f'SELECT {sql} LIMIT {sql_limit}'

    return sql, None


@log_execution_time()
def get_factory_min_max_date(proc_cfg, is_tz_col=False):
    """Get factory max date"""
    with ReadOnlyDbProxy(proc_cfg.data_source) as db_instance:
        # gen sql
        agg_results = []
        get_date_col = add_double_quotes(proc_cfg.get_auto_increment_col_else_get_date())
        orig_tblname = proc_cfg.table_name_for_query_datetime().strip('"')
        table_name = add_double_quotes(orig_tblname) if not isinstance(db_instance, mysql.MySQL) else orig_tblname
        for agg_func in ['MIN', 'MAX']:
            sql = f'select {agg_func}({get_date_col}) from {table_name}'
            if isinstance(db_instance, mssqlserver.MSSQLServer):
                sql = f'select convert(varchar(30), {agg_func}({get_date_col}), 120) from {table_name}'
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
        # todo: confirm why it compares max_time to DATETIME_DUMMY
        if max_time == DATETIME_DUMMY:
            return None, None, False

        # because of sqlite has not tz information in DB, it necessary to get via value
        # in case of could not extract timezone from data value, try to get timezone by factory instance
        if not is_tz_col:
            is_tz_col = db_instance.is_timezone_hold_column(orig_tblname, get_date_col)
        min_time = format_factory_date_to_meta_data(min_time, is_tz_col, proc_cfg.data_source.type)
        max_time = format_factory_date_to_meta_data(max_time, is_tz_col, proc_cfg.data_source.type)

    return min_time, max_time, is_tz_col


SQL_PAST_DAYS_AGO = 1


@log_execution_time()
def get_tzoffset_of_random_record(data_source, table_name, get_date_col):
    # exec sql
    with ReadOnlyDbProxy(data_source) as db_instance:
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
def factory_past_import_job(process_id: int, job_management: JobManagement):
    """Scheduler job import factory data"""
    gen = factory_past_import(process_id, job_management)
    send_processing_info(
        gen,
        job_management=job_management,
        after_success_func=finished_transaction_import,
        after_success_func_kwargs={'process_id': process_id},
    )
    add_gen_proc_link_job(process_id=process_id, is_user_request=True)


@log_execution_time()
def factory_past_import(proc_id: int, job_management: JobManagement):
    """Transform data and then import from factory db to universal db

    Arguments:
        proc_id {int} -- The process id
        job_management {JobManagement} -- The job management info

    Yields:
        [type] -- [description]
    """
    # start job
    past_import_job_info = FactoryPastImportJobInfo()
    job_management.info = past_import_job_info
    yield 0

    # get process id in edge db
    proc_cfg: CfgProcess = CfgProcess.get_proc_by_id(proc_id)
    if not proc_cfg:
        past_import_job_info.error(content=f'Process id={proc_id} does not exist.')
        return

    if proc_cfg.data_source.type == DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name:
        error_msg = 'Do not run past import for snowflake, we can implement it in pull past data later'
        past_import_job_info.error(content=error_msg)
        raise ValueError(error_msg)

    # Isolate object that not link to SQLAlchemy to avoid changes in other session
    proc_cfg = proc_cfg.clone()
    data_src: CfgDataSourceDB = proc_cfg.data_source.db_detail

    # check db connection
    ReadOnlyDbProxy.check_db_connection(data_src)

    # columns info
    proc_name = proc_cfg.name
    cfg_columns = proc_cfg.get_transaction_process_columns()
    raw_column_names = [col.column_raw_name for col in cfg_columns if col.is_normal_column]
    col_name = [col.column_name for col in cfg_columns if col.is_normal_column]
    auto_increment_col = proc_cfg.get_auto_increment_col_else_get_date()
    dic_use_cols = {col.column_name: col for col in cfg_columns}
    # get etl from the process
    etl_func = proc_cfg.get_etl_func()

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    trans_data = TransactionData(proc_cfg)
    # get parent process config
    parent_cfg_proc: CfgProcess | None = None
    parent_cfg_columns: list[CfgProcessColumn] | None = None
    if proc_cfg.parent_id:
        parent_cfg_proc: CfgProcess | None = CfgProcess.get_proc_by_id(proc_cfg.parent_id)
        parent_cfg_columns: list[CfgProcessColumn] | None = parent_cfg_proc.get_transaction_process_columns()
    with (
        TxnMetaConnection(process_id=proc_id) as meta_con,
        TxnDataConnection(process_id=proc_id, readonly_transaction=False) as data_con,
    ):
        trans_data.create_table(data_con=data_con, meta_con=meta_con)
        # last import date
        last_import = trans_data.get_import_history_last_import(meta_con, JobType.FACTORY_PAST_IMPORT)

        if not last_import:
            # check if first time factory import was DONE !
            last_import = trans_data.get_import_history_first_import(meta_con, JobType.FACTORY_IMPORT)

        # the first time import data
        if not last_import:
            past_import_job_info.warning(f'There is no existing past import job for process id={proc_id}.')
            yield 100
            return

    filter_time = last_import.import_from

    if not filter_time or filter_time < convert_time(add_years(years=-1)):
        past_import_job_info.info('Datetime for query was not found, or is more than one year away.')
        yield 100
        return

    # return if already inserted 2 millions
    with TxnDataConnection(process_id=proc_id, readonly_transaction=True) as data_con:
        data_cnt = trans_data.count_data(data_con)

    if data_cnt > PAST_IMPORT_LIMIT_DATA_COUNT:
        past_import_job_info.info(
            content=f'Imported records is over limit ({data_cnt} > {PAST_IMPORT_LIMIT_DATA_COUNT}).'
        )
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
    start_time = format_factory_date_to_meta_data(start_time, is_tz_col, proc_cfg.data_source.type)
    end_time = format_factory_date_to_meta_data(end_time, is_tz_col, proc_cfg.data_source.type)

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
    # if it has etl_func get data from factory
    import_factory_obj: ImportBase = ImportBase.get_instance(proc_cfg)
    time_range = import_factory_obj.get_time_range_from_start_end_time(start_time, end_time, True)
    data = import_factory_obj.get_factory_data(time_range)
    past_import_job_info.start_time = time_range.min
    past_import_job_info.end_time = time_range.max

    # get current job id
    job_id = int(job_management.id) if job_management else None
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
        is_import, rows, remain_rows = gen_import_data(_rows, remain_rows, cols, auto_increment_col)
        if not is_import:
            continue

        # apply etl_func for rows
        if etl_func:
            # apply etl_func for rows
            df_rows = pd.DataFrame(rows, columns=cols)
            df_rows = df_transform(df_rows, etl_func)

            # filter columns by raw_column_names in transaction
            df_rows_filter = df_rows[raw_column_names]
            rows = tuple(tuple(row) for row in df_rows_filter.to_numpy())
            # dataframe
            df = pd.DataFrame(rows, columns=col_name)
        else:
            # dataframe
            df = pd.DataFrame(rows, columns=cols)

        # to save into import history
        data_frame_info = FactoryPastImportJobInfo.FactoryImportDataFrameInfo(
            size=len(df),
            imported_start_time=format_factory_date_to_meta_data(df[auto_increment_col].min(), is_tz_col=is_tz_col),
            imported_end_time=format_factory_date_to_meta_data(df[auto_increment_col].max(), is_tz_col=is_tz_col),
        )
        past_import_job_info.data_frame_info_objects.append(data_frame_info)
        # pivot if this is vertical data
        if MasterDBType.is_software_workshop(proc_cfg.master_type):
            if proc_cfg.master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name:
                pipeline = software_workshop_postgres_measurement_transform_pipeline(
                    data_source_id=proc_cfg.data_source_id,
                    process_factid=proc_cfg.process_factid,
                    add_missing_columns=False,
                )
            elif proc_cfg.master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name:
                pipeline = software_workshop_postgres_history_transform_pipeline()
            else:
                error_msg = f'unsupported {proc_cfg.master_type} for software workshop'
                past_import_job_info.error(error_msg)
                raise NotImplementedError(error_msg)
            transformed_data = pipeline.run(TransformData(df=df))
            df = transformed_data.df.rename(columns={col.column_raw_name: col.column_name for col in cfg_columns})

        # no records
        if not len(df):
            error_type = IMPORT_FACTOR_EMPTY_DATA
            past_import_job_info.warning(error_type)
            save_failed_import_history(proc_id, job_info, error_type)
            continue

        has_data = True
        for col, cfg_col in dic_use_cols.items():
            dtype = cfg_col.data_type
            df = convert_with_formula_for_factory_import(cfg_col, df)
            if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
                continue
            empty_as_error = col == get_date_col
            df = validate_datetime(df, col, is_strip=False, empty_as_error=empty_as_error)
            df[col] = convert_df_col_to_utc(df, col, *dic_tz_info[col])
            df[col] = convert_df_datetime_to_str(df, col)

        # convert types
        df = df.convert_dtypes()

        # rename df's columns using the column names matching with the raw names
        raw_to_column_name_dict = {value.column_raw_name: value.column_name for key, value in dic_use_cols.items()}
        df = df.rename(columns=raw_to_column_name_dict)

        # original df
        orig_df = df.copy()

        # data pre-processing
        df, df_error = data_pre_processing(
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
            data_frame_info.error_rows = df_error_cnt

        # merge mode
        target_cfg_process = proc_cfg
        target_get_date_col = get_date_col
        target_cfg_columns = cfg_columns
        child_cfg_proc = None
        if parent_cfg_proc:
            child_cfg_proc = proc_cfg
            target_cfg_process = parent_cfg_proc
            target_cfg_columns = parent_cfg_columns
            dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in parent_cfg_columns}
            dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
            dic_rename = {}
            for col in df.columns:
                if dic_cols.get(col):
                    dic_rename[col] = dic_parent_cfg_cols[dic_cols[col]].column_name
            df = df.rename(columns=dic_rename)
            orig_df = orig_df.rename(columns=dic_rename)
            df_error = df_error.rename(columns=dic_rename)
            target_get_date_col = parent_cfg_proc.get_date_col()

        # Handle calculate data for main::Serial function column
        from ap.api.setting_module.services.import_function_column import handle_main_function_columns

        df = handle_main_function_columns(target_cfg_process, df)

        # remove duplicate records which exists DB
        df, df_duplicate = remove_duplicates(df, orig_df, df_error, target_cfg_process, target_get_date_col)
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
            data_frame_info.duplicate_rows = df_duplicate_cnt

        # import data
        job_info.import_type = JobType.FACTORY_PAST_IMPORT.name

        # to save into import history
        # imported time range is always 24h, NOT get time range from df object (real data range)
        # because in the past, we assume that there are no new data will be inserted in the past. => rotation 24h
        job_info.import_from = start_time
        job_info.import_to = end_time

        job_info.status = JobStatus.DONE.name
        if error_type:
            # save import history
            job_info.status = JobStatus.FAILED.name
            job_info.err_msg = error_type

        df = remove_non_exist_columns_in_df(df, [col.column_name for col in target_cfg_columns])
        save_res = import_data(df, target_cfg_process, get_date_col, job_info, child_cfg_proc=child_cfg_proc)

        if len(df) == 0:
            # insert import history in case df have no record after dropping duplicate or filtering data error
            if child_cfg_proc:
                save_import_history(child_cfg_proc.id, job_info=job_info)
            else:
                save_import_history(target_cfg_process.id, job_info=job_info)

        # update job info
        gen_import_job_info(job_info, save_res, start_time, end_time, err_cnt=df_error_cnt)
        data_frame_info.imported_rows = len(df)
        # total row of one job
        total_row = job_info.row_count
        inserted_row_count += total_row

        job_info.calc_percent(inserted_row_count, MAX_RECORD)
        with job_info.interruptible() as job_info:
            yield job_info

        # raise exception if FATAL error happened
        if job_info.status is JobStatus.FATAL:
            past_import_job_info.error(content=str(job_info.exception))
            raise job_info.exception

        log_str = f'Imported {total_row} records, range={job_info.import_from} - {job_info.import_to}'
        past_import_job_info.info(content=log_str)
        logger.info(log_str)

    log_str = (
        f'FACTORY PAST DATA IMPORT SQL('
        f'days={SQL_PAST_DAYS_AGO}, '
        f'total_imported_rows={past_import_job_info.total_imported_rows}, '
        f'total_duplicate_rows={past_import_job_info.total_duplicate_rows}, '
        f'total_error_rows={past_import_job_info.total_error_rows}, '
        f'import_from={start_time}, '
        f'import_to={end_time}'
        f')'
    )
    past_import_job_info.info(content=log_str)
    logger.info(log_str)

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
def gen_import_data(rows: tuple, remain_rows: tuple, cols: tuple, auto_increment_col: str) -> tuple[bool, tuple, tuple]:
    is_allow_import = True
    # last fetch
    if len(rows) < FETCH_MANY_SIZE:
        return is_allow_import, remain_rows + rows, ()

    # rows with the largest grp_id of the previous chunk should be at the BEGINNING of the current chunk
    rows = remain_rows + rows

    rows_df = pd.DataFrame(rows, columns=cols)
    group_ids = rows_df.groupby([auto_increment_col]).ngroup()
    split_idx = rows_df.index[group_ids.idxmax()]
    # when all rows have the same grp_id, bring all rows to the next chunk
    group_ids = group_ids.to_numpy()
    if check_if_array_is_repeating(group_ids):
        is_allow_import = False
        return is_allow_import, (), rows

    return is_allow_import, rows[:split_idx], rows[split_idx:]


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


def convert_with_formula_for_factory_import(cfg_col: CfgProcessColumn, df: DataFrame):
    # TODO: add handle for datetime formula:
    #  See: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/442
    formula = conversion_formula(
        col_type=cfg_col.column_type,
        data_type=cfg_col.data_type,
        formula=cfg_col.formula,
    )
    if formula:
        match formula:
            case JudgeFormula():
                df[cfg_col.column_name] = formula.convert(df[cfg_col.column_name])
            case _:
                raise ValueError(f'Unsupported {formula} for factory import')

    return df
