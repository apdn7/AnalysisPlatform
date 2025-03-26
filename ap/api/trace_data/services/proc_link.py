import logging
from collections import deque, namedtuple
from datetime import datetime, timedelta
from typing import List, Optional

from apscheduler.triggers import date, interval
from apscheduler.triggers.date import DateTrigger
from pytz import utc

from ap import scheduler
from ap.api.common.services.sql_generator import gen_sql_proc_link_count
from ap.api.common.services.utils import gen_sql_and_params
from ap.common.common_utils import gen_sqlite3_file_name
from ap.common.constants import SUB_STRING_COL_NAME, AnnounceEvent, CacheType, JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventBackgroundAnnounce, EventExpireCache, EventQueue
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import RESCHEDULE_SECONDS, scheduler_app_context
from ap.setting_module.models import (
    CfgProcess,
    CfgProcessColumn,
    CfgTrace,
    ProcLinkCount,
    make_session,
)
from ap.setting_module.services.background_process import send_processing_info
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)

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


@log_execution_time()
def order_before_mapping_data(edges: List[CfgTrace]):
    """trace all node in dic_node , and gen sql"""
    ordered_edges = []

    max_loop = len(edges) * 10
    edges = deque(edges)
    cnt = 0
    while edges:
        if cnt > max_loop:
            raise Exception('Edges made a ring circle, You must re-setting tracing edge to break the ring circle!!!')

        # get first element
        edge = edges.popleft()

        # check if current start proc is in others edge's end procs
        # if YES , we must wait for these end proc run first( move the current edge to the end)
        if any((edge.self_process_id == other_edge.target_process_id for other_edge in edges)):
            # move to the end of queue
            edges.append(edge)
            cnt += 1
        else:
            ordered_edges.append(edge)
            cnt = 0

    return ordered_edges


# def gen_trace_key_info(edge: CfgTrace, is_start_proc):
def gen_trace_key_info(proc_id, keys):
    # trace key info
    TraceKeyInfo = namedtuple(
        'TraceKeyInfo',
        'proc_id, column_id, column_name, col_name_with_substr, from_char, to_char',
    )

    trace_key_infos = []
    for key in keys:
        col_id, from_char, to_char = key
        column = CfgProcessColumn.query.get(col_id)
        if from_char or to_char:
            substr_col_name = SUB_STRING_COL_NAME.format(column.column_name, from_char, to_char)
        else:
            substr_col_name = column.column_name

        trace_key_info = TraceKeyInfo(proc_id, column.id, column.column_name, substr_col_name, from_char, to_char)
        trace_key_infos.append(trace_key_info)

    return trace_key_infos


def finished_transaction_import(process_id=None, publish: bool = True, is_user_request: bool = False):
    logger.info('TRANSACTION_UPDATED_SUCCESS')
    EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.TRANSACTION_UPDATED))
    EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))


def add_gen_proc_link_job(process_id=None, publish=True, is_user_request: bool = False):
    """call gen proc link id job

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
    show matched global id count
    :return:
    """
    # count matched per edge
    dic_proc_cnt = {}
    trans = [TransactionData(proc.id) for proc in CfgProcess.get_all_ids()]
    for tran_data in trans:
        with DbProxy(gen_data_source_of_universal_db(tran_data.process_id), True) as db_instance:
            data_count = 0
            if tran_data.is_table_exist(db_instance):
                data_count = tran_data.count_data(db_instance)
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


def update_proc_link_count(dic_count):
    ProcLinkCount.delete_all()
    with make_session() as meta_session:
        for (self_proc, target_proc), matched_count in dic_count.items():
            rec = ProcLinkCount()
            rec.process_id = self_proc
            rec.target_process_id = target_proc
            rec.matched_count = matched_count
            meta_session.merge(rec)
    logger.debug('[ProcLinkCount] Done Update proc link count proc id')


def proc_link_count_job(is_user_request: bool = False):
    job_id = JobType.PROC_LINK_COUNT.name
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
def proc_link_count():
    gen = proc_link_count_main()
    send_processing_info(gen, JobType.PROC_LINK_COUNT)


def proc_link_count_main():
    yield 0
    dic_count = count_proc_links()
    yield 80
    update_proc_link_count(dic_count)
    yield 100


def restructure_indexes_gen(process_id):
    yield 0
    tran_data = TransactionData(process_id)

    yield 10
    with DbProxy(gen_data_source_of_universal_db(process_id), True, True) as db_instance:
        if not tran_data.is_table_exist(db_instance):
            tran_data.create_table(db_instance)

        tran_data.re_structure_index(db_instance)
    yield 100


def add_restructure_indexes_job(process_id=None, delay: int = 0):
    """
    add job to handle indexes restructure of processes
    """
    proc_ids = [process_id] if process_id else [proc.id for proc in CfgProcess.get_all_ids()]

    for proc_id in proc_ids:
        run_time = datetime.now().astimezone(utc)
        run_time += timedelta(seconds=delay)
        date_trigger = date.DateTrigger(run_date=run_time, timezone=utc)
        EventQueue.put(
            EventAddJob(
                fn=re_structure_indexes_job,
                kwargs={'process_id': proc_id},
                job_type=JobType.RESTRUCTURE_INDEXES,
                process_id=proc_id,
                trigger=date_trigger,
                replace_existing=True,
            ),
        )


@scheduler_app_context
def re_structure_indexes_job(process_id: int):
    """indexes restructure job"""
    # refactoring transaction data indexes
    gen = restructure_indexes_gen(process_id)
    send_processing_info(gen, JobType.RESTRUCTURE_INDEXES, process_id=process_id)
    return True


@log_execution_time('gen_proc_link')
def gen_proc_link_of_edge(trace: CfgTrace, limit: Optional[int] = None):
    # create table if not exist
    dic_db_files = {}
    for proc_id in (trace.self_process_id, trace.target_process_id):
        file_name = gen_sqlite3_file_name(proc_id)
        dic_db_files[proc_id] = file_name

        with DbProxy(gen_data_source_of_universal_db(proc_id), True, True) as db_instance:
            trans_data = TransactionData(proc_id)
            if not trans_data.is_table_exist(db_instance):
                trans_data.create_table(db_instance)

    sql_stmt = gen_sql_proc_link_count(trace, limit)
    sql, params = gen_sql_and_params(sql_stmt)
    proc_id = trace.self_process_id
    with DbProxy(
        gen_data_source_of_universal_db(proc_id),
        True,
        dic_db_files=dic_db_files,
        proc_id=proc_id,
    ) as db_instance:
        _, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
    count = rows[0][0]
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
