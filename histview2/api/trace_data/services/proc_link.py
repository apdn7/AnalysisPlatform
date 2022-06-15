from collections import namedtuple, deque
from datetime import datetime, timedelta
from typing import List, Dict

from apscheduler.triggers import date
from pytz import utc
from sqlalchemy import insert
from sqlalchemy.sql.expression import literal

from histview2 import scheduler
# from histview2 import web_socketio
from histview2.api.setting_module.services.data_import import get_from_to_substring_col
from histview2.common.common_utils import chunks_dic
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.memoize import set_all_cache_expired
from histview2.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from histview2.common.scheduler import scheduler_app_context, JobType, IMPORT_DATA_JOBS, RESCHEDULE_SECONDS
from histview2.common.services.sse import background_announcer, AnnounceEvent
from histview2.setting_module.models import JobManagement, CfgTrace, ProcLink, CfgProcess
from histview2.setting_module.services.background_process import send_processing_info
from histview2.trace_data.models import *

# socketio = web_socketio[SOCKETIO]

# 2 proc join key string
JOIN_KEY = 'key'
SET_RELATION_INSERT = 'set_relation_insert'
DIC_CYCLE_UPDATE = 'dic_cycle_update'
SET_EXIST_RELATION = 'set_exist_relation'
RECORD_PER_COMMIT = 1_000_000


@scheduler_app_context
def gen_global_id_job(_job_id=None, _job_name=None, is_new_data_check=True, is_publish=True):
    """run job generate global id

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """

    # check if generate global is needed
    if is_new_data_check:
        prev_gen_job = JobManagement.get_last_job_id_by_jobtype(JobType.GEN_GLOBAL.name)
        prev_gen_job_id = 0
        if prev_gen_job:
            prev_gen_job_id = prev_gen_job.id

        jobs = JobManagement.check_new_jobs(prev_gen_job_id, IMPORT_DATA_JOBS)
        if not jobs:
            print("QUIT GENERATE GLOBAL ID , BECAUSE THERE IS NO NEW DATA FROM THE LAST GENERATE")
            return

        # generate global ids
        gen = gen_global_id()
    else:
        # generate global ids
        gen = gen_global_id(reset_existed_global_id=True)

    send_processing_info(gen, JobType.GEN_GLOBAL)

    # publish to clients that proc link job was done !
    if is_publish:
        background_announcer.announce(True, AnnounceEvent.PROC_LINK.name)
        print('PROC_LINK_DONE_PUBLISH: DONE')
        # clear cache
        set_all_cache_expired()


@log_execution_time('[GENERATE GLOBAL ID]')
def gen_global_id(reset_existed_global_id=False):
    """
    generate global id for universal db (root function)
    """
    yield 0

    if reset_existed_global_id:
        clear_data_before_gen_proc_link()

    yield 10

    # get all first,end procs ( forward trace )
    edges = CfgTrace.get_all()

    start_procs = get_start_procs(edges)

    # check universal zero
    if not start_procs:
        return

    # create sub string sensors
    gen_substring_sensors(edges)

    # set global id for start procs
    for proc_id in start_procs:
        cycle_cls = find_cycle_class(proc_id)
        cycle_cls.gen_auto_global_id(proc_id)

    db.session.commit()
    percent = 20

    # trace each edge , return global & relation list
    dic_output = {SET_RELATION_INSERT: set(), DIC_CYCLE_UPDATE: {}, SET_EXIST_RELATION: set(GlobalRelation.get_all())}

    # matched count on proc
    # dic_cycle_ids = defaultdict(set)
    dic_edge_cnt = {}
    edges = order_before_mapping_data(edges)
    for edge in edges:
        # matching data
        start_cycle_ids, end_cycle_ids = mapping_data(edge, dic_output)

        # count matching data for per process
        dic_edge_cnt[(edge.self_process_id, edge.target_process_id)] = len(start_cycle_ids)
        # dic_cycle_ids[edge.self_process_id].update(start_cycle_ids)
        # dic_cycle_ids[edge.target_process_id].update(end_cycle_ids)

        # save db
        cycle_cls = find_cycle_class(edge.target_process_id)
        for chunk in chunks_dic(dic_output[DIC_CYCLE_UPDATE], RECORD_PER_COMMIT):
            cycles = [dict(id=cycle_id, global_id=global_id) for cycle_id, global_id in chunk.items()]
            db.session.bulk_update_mappings(cycle_cls, cycles)
            db.session.commit()

        # reset dict after saved
        dic_output[DIC_CYCLE_UPDATE] = {}
        percent += 1
        yield percent

    insert_targets = list(dic_output[SET_RELATION_INSERT])
    if len(insert_targets):
        global_relate_cols = (GlobalRelation.global_id.key, GlobalRelation.relate_id.key, GlobalRelation.created_at.key)
        with DbProxy(gen_data_source_of_universal_db(), True) as db_instance:
            for chunk in chunks(insert_targets, RECORD_PER_COMMIT):
                created_at = get_current_timestamp()
                insert_relations = []

                for rel in chunk:
                    insert_relations.append((rel[0], rel[1], created_at))
                    insert_relations.append((rel[1], rel[0], created_at))

                # insert to db
                db_instance.bulk_insert(GlobalRelation.__table__.name, global_relate_cols, insert_relations)

                # commit changes to db
                db_instance.connection.commit()

                # percent
                percent += 1
                yield percent

    yield 99, {}, dic_edge_cnt
    yield 100


@log_execution_time()
def order_before_mapping_data(edges: List[CfgTrace]):
    """ trace all node in dic_node , and gen sql
    """
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


@log_execution_time()
def mapping_data(edge: CfgTrace, dic_output: Dict):
    dic_start_data = build_proc_data(edge, True)
    dic_end_data = build_proc_data(edge)

    # update global id and relation
    start_cycle_ids = []
    end_cycle_ids = []
    for keys, start_row in dic_start_data.items():
        end_row = dic_end_data.get(keys)
        if end_row is None:
            continue

        # if end proc global id is NULL
        if end_row.global_id:
            # cross relate
            # if not same number( already added), and not exist in database
            if end_row.global_id == start_row.global_id:
                continue

            key = (start_row.global_id, end_row.global_id)
            reverse_key = (end_row.global_id, start_row.global_id)

            if key in dic_output[SET_EXIST_RELATION]:
                continue

            if key in dic_output[SET_RELATION_INSERT]:
                continue

            if reverse_key in dic_output[SET_RELATION_INSERT]:
                continue

            # add to insert list
            dic_output[SET_RELATION_INSERT].add((start_row.global_id, end_row.global_id))
        else:
            # add to update list
            dic_output[DIC_CYCLE_UPDATE][end_row.id] = start_row.global_id

        # count
        start_cycle_ids.append(start_row.id)
        end_cycle_ids.append(end_row.id)

    return start_cycle_ids, end_cycle_ids


def gen_trace_key_info(edge: CfgTrace, is_start_proc):
    # trace key info
    TraceKeyInfo = namedtuple('TraceKeyInfo',
                              'proc_id, column_id, column_name, col_name_with_substr, from_char, to_char')

    if is_start_proc:
        proc_id = edge.self_process_id
        keys = [(key.self_column_id, key.self_column_substr_from, key.self_column_substr_to) for key in edge.trace_keys]
    else:
        proc_id = edge.target_process_id
        keys = [(key.target_column_id, key.target_column_substr_from, key.target_column_substr_to) for key in
                edge.trace_keys]

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


def build_proc_data(edge: CfgTrace, is_start_proc=False):
    """
    build sql to query matching global
    get cycles by proc_id
    """

    # get proc_id , keys
    trace_key_infos = gen_trace_key_info(edge, is_start_proc)
    proc_id = trace_key_infos[0].proc_id

    cycle_cls = find_cycle_class(proc_id)
    data = db.session.query(cycle_cls.id, cycle_cls.global_id).filter(cycle_cls.process_id == proc_id)
    data = data.order_by(cycle_cls.time, cycle_cls.id)

    # only get global_id that not null
    if is_start_proc:
        data = data.filter(cycle_cls.global_id > 0)

    # get sensor information of keys from database (run separate to reuse cache, keys are only 1 or 2 columns)
    sensors = Sensor.query.filter(Sensor.process_id == proc_id).filter(
        Sensor.column_name.in_([trace_key.col_name_with_substr for trace_key in trace_key_infos])).all()
    for sensor in sensors:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)
        data = data.join(sensor_val_cls, sensor_val_cls.cycle_id == cycle_cls.id)
        data = data.filter(sensor_val_cls.sensor_id == sensor.id)
        data = data.add_columns(sensor_val_cls.value.label(gen_sql_label(sensor.column_name)))

    data = data.all()

    # make dictionary (remove duplicate and faster for tracing)
    data = {tuple([getattr(row, gen_sql_label(key.col_name_with_substr)) for key in trace_key_infos]): row
            for row in data}
    return data


@log_execution_time()
def gen_substring_sensor(proc_id, orig_col_name, from_char, to_char):
    # new column name for sub string
    substr_col_name = SUB_STRING_COL_NAME.format(orig_col_name, from_char, to_char)

    # check duplicate sub string sensors
    if Sensor.get_sensor_by_col_name(proc_id, substr_col_name):
        return None

    orig_sensor = Sensor.get_sensor_by_col_name(proc_id, orig_col_name)
    if not orig_sensor:
        return None

    sensor = Sensor(process_id=proc_id, column_name=substr_col_name, type=orig_sensor.type)
    db.session.add(sensor)
    db.session.commit()

    sensor_id = sensor.id
    sensor_type = sensor.type
    orig_sensor_val_cls = find_sensor_class(orig_sensor.id, DataType(orig_sensor.type))

    # get all value of original sensor
    data = db.session.query(orig_sensor_val_cls.cycle_id, literal(sensor_id),
                            func.substr(orig_sensor_val_cls.value, from_char, to_char - from_char + 1))

    data = data.filter(orig_sensor_val_cls.sensor_id == orig_sensor.id)

    # insert into sensor val
    sensor_val_cls = find_sensor_class(sensor_id, DataType(sensor_type))
    sensor_insert = insert(sensor_val_cls).from_select(
        (sensor_val_cls.cycle_id, sensor_val_cls.sensor_id, sensor_val_cls.value), data)

    # execute
    db.session.execute(sensor_insert)
    db.session.commit()

    return substr_col_name


def add_gen_proc_link_job(publish=False):
    """call gen proc link id job

    Args:
        :param publish:
    """
    job_id = JobType.GEN_GLOBAL.name
    run_time = datetime.now().astimezone(utc) + timedelta(seconds=RESCHEDULE_SECONDS)
    date_trigger = date.DateTrigger(run_date=run_time, timezone=utc)
    scheduler.add_job(job_id, gen_global_id_job, trigger=date_trigger, replace_existing=True,
                      kwargs=dict(_job_id=job_id, _job_name=job_id, is_new_data_check=True, is_publish=publish))


#######################################################

def get_start_procs(edges):
    self_trace_ids = set()
    target_trace_ids = set()

    for edge in edges:
        self_trace_ids.add(edge.self_process_id)
        target_trace_ids.add(edge.target_process_id)

    # start procs, end procs
    return self_trace_ids - target_trace_ids


def get_end_procs(edges):
    self_trace_ids = set()
    target_trace_ids = set()

    for edge in edges:
        self_trace_ids.add(edge.self_process_id)
        target_trace_ids.add(edge.target_process_id)

    # start procs, end procs
    return target_trace_ids - self_trace_ids


def gen_substring_sensors(edges: List[CfgTrace]):
    for edge in edges:
        for trace_key in edge.trace_keys:
            if trace_key.self_column_substr_from:
                orig_col = CfgProcessColumn.query.get(trace_key.self_column_id)
                gen_substring_sensor(edge.self_process_id, orig_col.column_name,
                                     trace_key.self_column_substr_from,
                                     trace_key.self_column_substr_to)
            if trace_key.target_column_substr_from:
                orig_col = CfgProcessColumn.query.get(trace_key.target_column_id)
                gen_substring_sensor(edge.target_process_id, orig_col.column_name,
                                     trace_key.target_column_substr_from,
                                     trace_key.target_column_substr_to)


# @log_execution_time()
# def show_proc_link_info():
#     """
#     show matched global id count
#     :return:
#     """
#     # get infos
#     data = ProcLink.calc_proc_link()
#
#     # matched count on edge
#     dic_edge_cnt = {}
#     dic_proc_cnt = {}
#
#     # count matched per edge
#     for row in data:
#         if row.target_process_id:
#             dic_edge_cnt[f'{row.process_id}-{row.target_process_id}'] = row.matched_count
#         else:
#             dic_proc_cnt[row.process_id] = row.matched_count
#
#     return dic_proc_cnt, dic_edge_cnt

@log_execution_time()
def show_proc_link_info():
    """
    show matched global id count
    :return:
    """
    dic_proc_cnt = {}
    dic_edge_cnt = {}

    # all procs
    all_procs = CfgProcess.get_all()

    for proc in all_procs:
        cycle_cls = find_cycle_class(proc.id)
        dic_proc_cnt[proc.id] = (cycle_cls.count_not_none_global_ids(proc.id), cycle_cls.count_all(proc.id))

        # get infos
        data = ProcLink.calc_proc_link()

        # count matched per edge
        for row in data:
            if row.target_process_id:
                dic_edge_cnt[f'{row.process_id}-{row.target_process_id}'] = row.matched_count

    return dic_proc_cnt, dic_edge_cnt


@log_execution_time()
def clear_data_before_gen_proc_link():
    # clear relation global id
    GlobalRelation.delete_all()
    for cycle_class in CYCLE_CLASSES:
        cycle_class.clear_global_id()

    # clear log in global_detail
    ProcLink.delete_all()
    db.session.commit()

    # clear substring data
    sensors = Sensor.query.all()
    for sensor in sensors:
        substr_check_res = get_from_to_substring_col(sensor)
        if not substr_check_res:
            continue

        substr_cls, from_char, to_char = substr_check_res
        substr_cls.delete_by_sensor_id(sensor.id)
        db.session.delete(sensor)
        db.session.commit()
