from datetime import datetime, timedelta

import _duckdb
import pandas as pd
from apscheduler.triggers import date, interval
from apscheduler.triggers.date import DateTrigger
from loguru import logger
from pytz import utc

from ap import scheduler
from ap.api.common.services.sql_generator import gen_sql_proc_link_count
from ap.common.constants import AnnounceEvent, CacheType, JobType
from ap.common.jobs.job_info_schema import GenProcLinkCountJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventBackgroundAnnounce, EventExpireCache, EventQueue
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMultiDataConnection
from ap.common.scheduler import RESCHEDULE_SECONDS, scheduler_app_context
from ap.setting_module.models import (
    CfgProcess,
    CfgTrace,
    JobManagement,
    ProcLinkCount,
    make_session,
)
from ap.setting_module.services.background_process import send_processing_info
from ap.trace_data.transaction_model import TransactionData

# 2 proc join key string
JOIN_KEY = 'key'
SET_RELATION_INSERT = 'set_relation_insert'
DIC_CYCLE_UPDATE = 'dic_cycle_update'
SET_EXIST_RELATION = 'set_exist_relation'
RECORD_PER_COMMIT = 1_000_000
OVERLAP_DAYS = 14
PROC_LINK_COUNT_JOB_HOUR = 3  # 3AM: run proc link count job at 3am once


@scheduler_app_context
def gen_proc_link_count_job(is_publish=True, is_user_request: bool = False):
    """
    Run job generate global id
    :param is_publish:
    :param is_user_request: this flag used to run gen proc link immediately after gen global id
    :return: void
    """
    proc_link_count_job(is_user_request=is_user_request)
    # publish to clients that proc link job was done !
    if is_publish:
        logger.debug('PROC_LINK_DONE_PUBLISH: DONE')
        EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.PROC_LINK))
        EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))


def finished_transaction_import(process_id=None, publish: bool = True, is_user_request: bool = False):
    logger.info('TRANSACTION_UPDATED_SUCCESS')
    EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.TRANSACTION_UPDATED))
    EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))


def add_gen_proc_link_job(process_id=None, publish=True, is_user_request: bool = False):
    """Call gen proc link id job

    Args:
        :param process_id:
        :param publish:
        :param is_user_request: this flag used to run gen proc link immediately after gen global id
    """
    run_time = datetime.now().astimezone(utc) + timedelta(seconds=RESCHEDULE_SECONDS)
    date_trigger = date.DateTrigger(run_date=run_time, timezone=utc)
    EventQueue.put(
        EventAddJob(
            fn=gen_proc_link_count_job,
            kwargs={
                'is_publish': publish,
                'is_user_request': is_user_request,
            },
            job_type=JobType.GEN_GLOBAL,
            trigger=date_trigger,
            replace_existing=True,
        ),
    )


#######################################################


def show_proc_link_info():
    """
    Show matched global id count
    :return:
    """
    # count matched per edge
    dic_proc_cnt = {}
    trans = [TransactionData(proc_id) for proc_id in CfgProcess.get_all_ids()]
    for tran_data in trans:
        with TxnDataConnection(process_id=tran_data.process_id, readonly_transaction=True) as data_con:
            data_count = 0
            if tran_data.is_table_exist(data_con):
                data_count = tran_data.count_data(data_con)
            dic_proc_cnt[str(tran_data.process_id)] = data_count

    dic_edge_cnt = {}
    data = ProcLinkCount.calc_proc_link()
    for row in data:
        proc_id = str(row.process_id)
        target_proc_id = str(row.target_process_id)
        cnt = row.matched_count
        dic_edge_cnt[f'{proc_id}-{target_proc_id}'] = cnt
        if proc_id not in dic_proc_cnt:
            dic_proc_cnt[proc_id] = cnt

        if target_proc_id not in dic_proc_cnt:
            dic_proc_cnt[target_proc_id] = cnt

    return dic_proc_cnt, dic_edge_cnt


def count_proc_links():
    edges = CfgTrace.get_all()
    dic_count = {}
    for edge in edges:
        edge_cnt = gen_proc_link_of_edge(edge, limit=None)
        dic_count[(edge.self_process_id, edge.target_process_id)] = edge_cnt
        logger.debug(
            f'[ProcLinkCount] Self proc id {edge.self_process_id} - Target proc id {edge.target_process_id}:'
            f' {edge_cnt}',
        )
    return dic_count


def update_proc_link_count(dic_count, job_management: JobManagement = None):
    with make_session() as meta_session:
        ProcLinkCount.delete_all(meta_session)
        for (self_proc, target_proc), matched_count in dic_count.items():
            rec = ProcLinkCount()
            rec.process_id = self_proc
            rec.target_process_id = target_proc
            rec.matched_count = matched_count
            meta_session.merge(rec)

        if job_management:
            total_matched_count = sum(dic_count.values())
            # update job_management info
            job_management.info = GenProcLinkCountJobInfo(total_matched_count=total_matched_count)
    logger.debug('[ProcLinkCount] Done Update proc link count proc id')


def proc_link_count_job(is_user_request: bool = False, run_time: datetime | None = None):
    job_id = JobType.PROC_LINK_COUNT.name

    if run_time is None:
        run_time = datetime.now()

    if not is_user_request:
        job_id += '_ONCE_PER_DAY'
        exist_job = scheduler.get_job(job_id)
        if exist_job:
            return

        interval_trigger = interval.IntervalTrigger(hours=24, timezone=utc)
        now_hour = run_time.hour
        run_time = run_time.replace(hour=PROC_LINK_COUNT_JOB_HOUR, minute=0, second=0, microsecond=0)
        if now_hour >= PROC_LINK_COUNT_JOB_HOUR:  # Add 1 day if now exceed the run time {PROC_LINK_COUNT_JOB_HOUR}
            run_time += timedelta(days=1)

        EventQueue.put(
            EventAddJob(
                fn=proc_link_count,
                job_type=JobType.PROC_LINK_COUNT,
                job_id_suffix='ONCE_PER_DAY',
                replace_existing=True,
                trigger=interval_trigger,
                next_run_time=run_time.astimezone(utc),
            ),
        )
    else:
        EventQueue.put(
            EventAddJob(
                fn=proc_link_count,
                job_type=JobType.PROC_LINK_COUNT,
                replace_existing=True,
                trigger=DateTrigger(run_time.astimezone(utc), timezone=utc),
            ),
        )


@scheduler_app_context
def proc_link_count(job_management: JobManagement):
    gen = proc_link_count_main(job_management=job_management)
    send_processing_info(gen, job_management=job_management)


def proc_link_count_main(job_management: JobManagement = None):
    yield 0
    dic_count = count_proc_links()
    yield 80
    update_proc_link_count(dic_count, job_management=job_management)
    yield 100


@log_execution_time('gen_proc_link')
def gen_proc_link_of_edge(trace: CfgTrace, limit: int | None = None):
    sql = gen_sql_proc_link_count(trace, limit)
    try:
        with TxnMultiDataConnection(process_ids=[trace.self_process_id, trace.target_process_id]) as data_con:
            df = data_con.fetch_df(sql)
        count = df['count_1'].item()
    except _duckdb.IOException:
        # In case transaction database does not exist, it means that process has not imported yet.
        count = 0
    except Exception as e:
        raise e
    return count


def convert_datetime_to_integer(dt):
    # dt: maybe a single datetime.datetime or np.series of np.datetime
    # yyyymm
    if isinstance(dt, str):
        return int(dt[0:4]) * 100 + int(dt[5:7])
    return dt.year * 100 + dt.month


def rename_df_column_for_dict(dict_rename_columns, dic_col_groups_equation):
    """
    Rename from db name to "gen_sql_label" type.
    See: gen_column_info_dic_for_equation for tuple format

    :param dict_rename_columns:
    :param dic_col_groups_equation:
    :return:
    """
    dict_return = {}
    for key, _value in dic_col_groups_equation.items():
        (
            formula,
            var_types,
            data_x,
            data_y,
            data_z,
            a,
            b,
            c,
            n,
            k,
            j,
            output_type,
        ) = _value  # un-package
        data_x = dict_rename_columns.get(data_x)
        data_y = dict_rename_columns.get(data_y)
        data_z = dict_rename_columns.get(data_z)
        value = (
            formula,
            var_types,
            data_x,
            data_y,
            data_z,
            a,
            b,
            c,
            n,
            k,
            j,
            output_type,
        )  # re-package
        dict_return[dict_rename_columns[key]] = value
    return dict_return


def get_first_valid_value_for_proc_link_preview(df):
    if df.empty:
        return pd.DataFrame()
    # get 1 valid value in column
    return (
        df.apply(lambda col: col[col.first_valid_index()] if col.first_valid_index() is not None else None, axis=0)
        .to_frame()
        .T
    )
