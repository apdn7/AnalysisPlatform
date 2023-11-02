from collections import Counter, defaultdict, deque, namedtuple
from datetime import datetime, timedelta
from typing import List

from apscheduler.triggers import date, interval
from apscheduler.triggers.date import DateTrigger
from pytz import utc
from sqlalchemy import insert
from sqlalchemy.sql.expression import literal

from ap import scheduler
from ap.common.constants import *
from ap.common.logger import log_execution_time, logger
from ap.common.memoize import set_all_cache_expired
from ap.common.pydn.dblib.db_common import (
    PARAM_SYMBOL,
    add_single_quote,
    gen_insert_col_str,
    gen_select_col_str,
)
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import RESCHEDULE_SECONDS, JobType, scheduler_app_context
from ap.common.services.sse import AnnounceEvent, background_announcer
from ap.setting_module.models import CfgProcess, CfgTrace, ProcLinkCount, make_session
from ap.setting_module.services.background_process import send_processing_info
from ap.trace_data.models import *

# 2 proc join key string
JOIN_KEY = 'key'
SET_RELATION_INSERT = 'set_relation_insert'
DIC_CYCLE_UPDATE = 'dic_cycle_update'
SET_EXIST_RELATION = 'set_exist_relation'
RECORD_PER_COMMIT = 1_000_000
OVERLAP_DAYS = 14
PROC_LINK_COUNT_JOB_HOUR = 3  # 3AM: run proc link count job at 3am once


class TraceGraph:
    def __init__(self, edges):
        self.dic_graph = defaultdict(list)
        self.dic_graph_undirected = defaultdict(list)
        self.dic_edges = {}
        self.nodes = set()
        self_procs = []
        target_procs = []
        for edge in edges:
            start_proc = edge.self_process_id
            end_proc = edge.target_process_id
            self_procs.append(start_proc)
            target_procs.append(end_proc)
            self.nodes.add(start_proc)
            self.nodes.add(end_proc)
            self.dic_edges[(start_proc, end_proc)] = edge
            self.dic_graph[start_proc].append(end_proc)
            self.dic_graph_undirected[start_proc].append(end_proc)
            self.dic_graph_undirected[end_proc].append(start_proc)

        counter_self_procs = Counter(self_procs)
        counter_target_procs = Counter(target_procs)
        set_self_procs = set(counter_self_procs)
        set_target_procs = set(counter_target_procs)
        self.split_multi_nodes = [
            _node for _node, _count in counter_self_procs.items() if _count > 1
        ]
        self.merge_multi_nodes = [
            _node for _node, _count in counter_target_procs.items() if _count > 1
        ]
        self.leaf_start_nodes = list(set_self_procs - set_target_procs)
        self.leaf_end_nodes = list(set_target_procs - set_self_procs)

    # function to add an edge to graph
    def _get_all_paths(self, start_proc, path, paths, end_proc=None, undirected_graph=None):
        # avoid cycle
        if start_proc in path:
            return paths
        # don't use append here.
        path = path + [start_proc]

        if undirected_graph:
            dic_graph = self.dic_graph_undirected
        else:
            dic_graph = self.dic_graph

        if start_proc == end_proc:
            paths.append(path)
        elif start_proc not in dic_graph:
            if end_proc is None:
                paths.append(path)
        else:
            for next_proc in dic_graph[start_proc]:
                self._get_all_paths(next_proc, path, paths, end_proc, undirected_graph)

        return paths

    # Prints all paths from 's' to 'd'
    def get_all_paths(self, start_proc, end_proc=None, undirected_graph=None):
        path = []
        paths = []
        return self._get_all_paths(start_proc, path, paths, end_proc, undirected_graph)

    def get_all_paths_in_graph(self):
        paths = []
        for start_proc in self.leaf_start_nodes:
            _paths = self.get_all_paths(start_proc)
            paths.extend(_paths)

        return paths

    def remove_middle_nodes(self, path):
        if len(path) <= 2:
            return path

        reduced_path = [path[0]]
        for idx in range(len(path))[1:-1]:
            start_proc = path[idx - 1]
            middle_proc = path[idx]
            end_proc = path[idx + 1]

            first_edge = self.dic_edges.get((start_proc, middle_proc))
            if not first_edge:
                first_edge = self.dic_edges.get((middle_proc, start_proc))
                left_cols = tuple(
                    (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to)
                    for key in first_edge.trace_keys
                )
            else:
                left_cols = tuple(
                    (
                        key.target_column_id,
                        key.target_column_substr_from,
                        key.target_column_substr_to,
                    )
                    for key in first_edge.trace_keys
                )

            next_edge = self.dic_edges.get((middle_proc, end_proc))
            if not next_edge:
                next_edge = self.dic_edges.get((end_proc, middle_proc))
                right_cols = tuple(
                    (
                        key.target_column_id,
                        key.target_column_substr_from,
                        key.target_column_substr_to,
                    )
                    for key in next_edge.trace_keys
                )
            else:
                right_cols = tuple(
                    (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to)
                    for key in next_edge.trace_keys
                )

            if left_cols != right_cols:
                reduced_path.append(middle_proc)

        reduced_path.append(path[-1])
        return reduced_path

    def find_sub_paths(self, paths=None):
        dic_sub_path = defaultdict(int)
        dic_sub_paths = defaultdict(list)
        if not paths:
            paths = self.get_all_paths_in_graph()

        for path in paths:
            path_keys = tuple(path)
            sub_path = []
            for node in path:
                sub_path.append(node)
                if len(sub_path) > 1:
                    if node in self.split_multi_nodes or node in self.merge_multi_nodes:
                        sub_path_keys = tuple(sub_path)
                        dic_sub_path[sub_path_keys] += 1
                        dic_sub_paths[path_keys].append(sub_path_keys)
                        sub_path = [node]
            else:
                if len(sub_path) > 1:
                    sub_path_keys = tuple(sub_path)
                    dic_sub_path[sub_path_keys] += 1
                    dic_sub_paths[path_keys].append(sub_path_keys)
        return dic_sub_path, dic_sub_paths

    def get_distinct_trace_columns(self):
        trace_cols = set()
        for edge in self.dic_edges.values():
            start_proc_id = edge.self_process_id
            start_cols = tuple(
                (key.self_column_id, key.self_column_substr_from, key.self_column_substr_to)
                for key in edge.trace_keys
            )

            trace_cols.add((start_proc_id, start_cols))

            end_proc_id = edge.target_process_id
            end_cols = tuple(
                (key.target_column_id, key.target_column_substr_from, key.target_column_substr_to)
                for key in edge.trace_keys
            )

            trace_cols.add((end_proc_id, end_cols))

        return trace_cols


@scheduler_app_context
def gen_global_id_job(
    _job_id=None,
    _job_name=None,
    is_new_data_check=True,
    is_publish=True,
    is_user_request: bool = False,
):
    """run job generate global id

    :param _job_id:
    :param _job_name:
    :param process_id:
    :param is_publish:
    :param is_user_request: this flag used to run gen proc link immediately after gen global id
    :return: void
    """

    # check if generate global is needed
    # if is_new_data_check:
    #     prev_gen_job = JobManagement.get_last_job_id_by_jobtype(JobType.GEN_GLOBAL.name)
    #     prev_gen_job_id = 0
    #     if prev_gen_job:
    #         prev_gen_job_id = prev_gen_job.id
    #
    #     jobs = JobManagement.check_new_jobs(prev_gen_job_id, IMPORT_DATA_JOBS)
    #     if not jobs:
    #         print("QUIT GENERATE GLOBAL ID , BECAUSE THERE IS NO NEW DATA FROM THE LAST GENERATE")
    #         return

    # generate global ids
    gen = gen_global_id()
    send_processing_info(gen, JobType.GEN_GLOBAL)

    proc_link_count_job(is_user_request=is_user_request)
    # publish to clients that proc link job was done !
    if is_publish:
        background_announcer.announce(True, AnnounceEvent.PROC_LINK.name)
        print('PROC_LINK_DONE_PUBLISH: DONE')
        # clear cache
        set_all_cache_expired()


@log_execution_time('[GENERATE GLOBAL ID]')
def gen_global_id():
    """
    generate global id for universal db (root function)
    """
    # get all first,end procs ( forward trace )

    edges = CfgTrace.get_all()
    if not len(edges):
        return

    yield 0

    # graph instance
    graph = TraceGraph(edges)

    # check universal zero
    if not graph.leaf_start_nodes:
        return

    # create sub string sensors
    gen_substring_sensors(edges)
    yield 10

    # distinct sub path
    trace_cols = graph.get_distinct_trace_columns()

    # insert to wk_proc_link
    percent_per_proc = 90 // len(trace_cols)
    for idx, (proc_id, proc_cols) in enumerate(trace_cols, start=1):
        insert_proc_link_data(proc_id, proc_cols)
        yield percent_per_proc * idx + 10

    yield 100
    return True


@log_execution_time()
def order_before_mapping_data(edges: List[CfgTrace]):
    """trace all node in dic_node , and gen sql"""
    ordered_edges = []

    max_loop = len(edges) * 10
    edges = deque(edges)
    cnt = 0
    while edges:
        if cnt > max_loop:
            raise Exception(
                'Edges made a ring circle, You must re-setting tracing edge to break the ring circle!!!'
            )

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
        'TraceKeyInfo', 'proc_id, column_id, column_name, col_name_with_substr, from_char, to_char'
    )

    trace_key_infos = []
    for key in keys:
        col_id, from_char, to_char = key
        column = CfgProcessColumn.query.get(col_id)
        if from_char or to_char:
            substr_col_name = SUB_STRING_COL_NAME.format(column.column_name, from_char, to_char)
        else:
            substr_col_name = column.column_name

        trace_key_info = TraceKeyInfo(
            proc_id, column.id, column.column_name, substr_col_name, from_char, to_char
        )
        trace_key_infos.append(trace_key_info)

    return trace_key_infos


@log_execution_time()
def insert_proc_link_data(proc_id, proc_cols):
    """
    build sql to query matching global
    get cycles by proc_id
    """

    # get proc_id , keys
    # TODO: re-write with raw sql

    trace_key_infos = gen_trace_key_info(proc_id, proc_cols)

    # get sensor information of keys from database (run separate to reuse cache, keys are only 1 or 2 columns)
    col_names = set()
    for trace_key in trace_key_infos:
        col_names.add(trace_key.column_name)
        col_names.add(trace_key.col_name_with_substr)

    sensors = (
        Sensor.query.filter(Sensor.process_id == proc_id)
        .filter(Sensor.column_name.in_(list(col_names)))
        .all()
    )
    dic_sensors = {sensor.column_name: sensor for sensor in sensors}

    sensor_cols = []
    orig_sensor_cols = []
    sensor_sql = ''
    value_cols = []
    for idx, trace_key in enumerate(trace_key_infos):
        if trace_key.column_name not in dic_sensors:
            return
        orig_sensor = dic_sensors[trace_key.column_name]
        sensor = dic_sensors[trace_key.col_name_with_substr]
        sensor_cols.append(str(sensor.id))
        orig_sensor_cols.append(str(orig_sensor.id))
        alias = f'sensor_{idx}'
        sensor_val_cls = find_sensor_class(orig_sensor.id, DataType(orig_sensor.type))
        sensor_table_name = sensor_val_cls.__table__.name
        sensor_sql += f' LEFT JOIN {sensor_table_name} {alias} ON {alias}.cycle_id = cycle.id '
        sensor_sql += f' AND {alias}.sensor_id = {PARAM_SYMBOL}'
        if trace_key.column_name == trace_key.col_name_with_substr:
            value_cols.append(f'{alias}.value')
        else:
            sub_str_to = trace_key.to_char - trace_key.from_char + 1
            value_cols.append(f'substr({alias}.value,{trace_key.from_char},{sub_str_to})')

    # get all data
    cycle_cls = find_cycle_class(proc_id)
    cycle_table_name = cycle_cls.__table__.name
    cycle_cols = [Cycle.process_id.key, Cycle.id.key, Cycle.time.key]

    proc_link_cls = ProcLink.find_proc_link_class(sensor_cols)
    proc_link_table_name = proc_link_cls.__table__.name
    proc_link_cols = [
        proc_link_cls.process_id.key,
        proc_link_cls.cycle_id.key,
        proc_link_cls.time.key,
        proc_link_cls.link_key.key,
        proc_link_cls.link_value.key,
    ]

    select_max_cycle_id = f'''SELECT COALESCE(max({proc_link_cls.cycle_id.key}),0)
                              FROM {proc_link_table_name} WHERE {proc_link_cls.link_key.key} = {PARAM_SYMBOL}'''

    value_join_str = f" || '{TRACING_KEY_DELIMITER_SYMBOL}'  || "
    link_key = TRACING_KEY_DELIMITER_SYMBOL.join(sensor_cols)
    sql = f'''
    INSERT INTO {proc_link_table_name} ({gen_insert_col_str(proc_link_cols)})
    SELECT {gen_select_col_str(cycle_cols)}, 
    {add_single_quote(link_key)} ,
     {value_join_str.join(value_cols)}
    FROM {cycle_table_name} cycle
    {sensor_sql}
    WHERE cycle.process_id = {PARAM_SYMBOL} AND cycle.id > ({select_max_cycle_id})
    '''
    params = (*orig_sensor_cols, proc_id, link_key)
    with DbProxy(
        gen_data_source_of_universal_db(), True, immediate_isolation_level=True
    ) as db_instance:
        db_instance.execute_sql(sql, params=params)


@log_execution_time()
def gen_substring_sensor(proc_id, orig_col_name, from_char, to_char):
    # new column name for sub string
    substr_col_name = SUB_STRING_COL_NAME.format(orig_col_name, from_char, to_char)

    # check duplicate sub string sensors
    if Sensor.get_sensor_by_col_name(proc_id, substr_col_name):
        return None

    return proc_id, substr_col_name, DataType.TEXT.value


def gen_substring_proc_link_data(orig_sensor, sensor_id, sensor_col, sensor_type):
    orig_sensor_val_cls = find_sensor_class(orig_sensor.id, DataType(orig_sensor.type))

    # get all value of original sensor
    data = db.session.query(
        orig_sensor_val_cls.cycle_id,
        literal(sensor_id),
        func.substr(orig_sensor_val_cls.value, from_char, to_char - from_char + 1),
    )

    data = data.filter(orig_sensor_val_cls.sensor_id == orig_sensor.id)

    # insert into sensor val
    sensor_val_cls = find_sensor_class(sensor_id, DataType(sensor_type))
    sensor_insert = insert(sensor_val_cls).from_select(
        (sensor_val_cls.cycle_id, sensor_val_cls.sensor_id, sensor_val_cls.value), data
    )

    # execute
    db.session.execute(sensor_insert)
    db.session.commit()

    return substr_col_name


def add_gen_proc_link_job(publish=False, is_user_request: bool = False):
    """call gen proc link id job

    Args:
        :param publish:
        :param is_user_request: this flag used to run gen proc link immediately after gen global id
    """
    job_id = JobType.GEN_GLOBAL.name
    run_time = datetime.now().astimezone(utc) + timedelta(seconds=RESCHEDULE_SECONDS)
    date_trigger = date.DateTrigger(run_date=run_time, timezone=utc)
    scheduler.add_job(
        job_id,
        gen_global_id_job,
        trigger=date_trigger,
        replace_existing=True,
        kwargs=dict(
            _job_id=job_id,
            _job_name=job_id,
            is_new_data_check=True,
            is_publish=publish,
            is_user_request=is_user_request,
        ),
    )


#######################################################


@log_execution_time()
def gen_substring_sensors(edges: List[CfgTrace]):
    substr_sensors = set()
    for edge in edges:
        for trace_key in edge.trace_keys:
            if trace_key.self_column_substr_from:
                orig_col = CfgProcessColumn.query.get(trace_key.self_column_id)
                sensor = gen_substring_sensor(
                    edge.self_process_id,
                    orig_col.column_name,
                    trace_key.self_column_substr_from,
                    trace_key.self_column_substr_to,
                )
                if sensor:
                    substr_sensors.add(sensor)

            if trace_key.target_column_substr_from:
                orig_col = CfgProcessColumn.query.get(trace_key.target_column_id)
                sensor = gen_substring_sensor(
                    edge.target_process_id,
                    orig_col.column_name,
                    trace_key.target_column_substr_from,
                    trace_key.target_column_substr_to,
                )
                if sensor:
                    substr_sensors.add(sensor)

    if substr_sensors:
        add_sensor(substr_sensors)


def add_sensor(sensors):
    for sensor in sensors:
        proc_id, col_name, dtype = sensor
        sensor = Sensor()
        sensor.process_id = proc_id
        sensor.column_name = col_name
        sensor.type = dtype
        db.session.add(sensor)
    db.session.commit()


def show_proc_link_info():
    """
    show matched global id count
    :return:
    """
    dic_proc_cnt = {}
    dic_edge_cnt = {}

    # get infos
    data = ProcLinkCount.calc_proc_link()

    # count matched per edge
    for row in data:
        dic_edge_cnt[f'{row.process_id}-{row.target_process_id}'] = row.matched_count

    # get all processes
    for proc_cfg in CfgProcess.get_all_ids():
        dic_proc_cnt[proc_cfg.id] = 0

    dic_proc_cnt = count_all_procs(dic_proc_cnt)
    return dic_proc_cnt, dic_edge_cnt


def count_all_procs(dic_procs):
    dic_proc_cnt = {}

    if not dic_procs:
        dic_procs = {proc.id: 0 for proc in CfgProcess.get_all_ids()}

    for proc_id, _ in dic_procs.items():
        cycle_cls = find_cycle_class(proc_id)
        dic_proc_cnt[proc_id] = cycle_cls.count_all(proc_id)

    print('gen new without cached')
    return dic_proc_cnt


def count_proc_links():
    from ap.api.trace_data.services.time_series_chart import (
        gen_cfg_col_n_sensor_pair,
        gen_sensor_ids_from_trace_keys,
    )

    edges = CfgTrace.get_all()
    graph = TraceGraph(edges)

    dic_mapping_col_n_sensor = {}
    for proc_id in graph.nodes:
        _dic_col_name, _dic_cfg_col, _dic_sensor = gen_cfg_col_n_sensor_pair(proc_id)
        dic_mapping_col_n_sensor[proc_id] = _dic_col_name

    # get proc link column names
    proc_link_first_cls = ProcLink.get_first_cls()
    proc_id_col = proc_link_first_cls.process_id.key
    link_key_col = proc_link_first_cls.link_key.key
    link_val_col = proc_link_first_cls.link_value.key
    sql_list = []
    for edge in edges:
        self_sensor_ids, target_sensor_ids = gen_sensor_ids_from_trace_keys(
            edge, dic_mapping_col_n_sensor
        )

        from_link_key = None
        if self_sensor_ids and all(self_sensor_ids):
            from_link_key = TRACING_KEY_DELIMITER_SYMBOL.join([str(id) for id in self_sensor_ids])

        to_link_key = None
        if target_sensor_ids and all(target_sensor_ids):
            to_link_key = TRACING_KEY_DELIMITER_SYMBOL.join([str(id) for id in target_sensor_ids])

        start_proc_link_cls = ProcLink.find_proc_link_class(from_link_key)
        start_table_name = start_proc_link_cls.__table__.name
        end_proc_link_cls = ProcLink.find_proc_link_class(to_link_key)
        end_table_name = end_proc_link_cls.__table__.name

        sql = f'''SELECT COUNT(1) PROC_LINK_COUNT 
        FROM {start_table_name} s WHERE {proc_id_col} = {PARAM_SYMBOL} AND {link_key_col} = {PARAM_SYMBOL} AND EXISTS
        (SELECT 1 FROM {end_table_name} e 
        WHERE e.{proc_id_col} = {PARAM_SYMBOL} AND e.{link_key_col} = {PARAM_SYMBOL} AND e.{link_val_col} = s.{link_val_col})
        '''
        params = (edge.self_process_id, from_link_key, edge.target_process_id, to_link_key)
        sql_list.append((edge, sql, params))

    dic_count = {}
    with DbProxy(gen_data_source_of_universal_db(), True) as db_instance:
        for edge, sql, params in sql_list:
            _, rows = db_instance.run_sql(sql, params=params)
            dic_count[(edge.self_process_id, edge.target_process_id)] = rows[0]['PROC_LINK_COUNT']

    return dic_count


def update_proc_link_count(dic_count):
    with make_session() as meta_session:
        ProcLinkCount.delete_all()
        for (self_proc, target_proc), matched_count in dic_count.items():
            rec = ProcLinkCount()
            rec.process_id = self_proc
            rec.target_process_id = target_proc
            rec.matched_count = matched_count
            meta_session.add(rec)


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
        run_time = run_time.replace(
            hour=PROC_LINK_COUNT_JOB_HOUR, minute=0, second=0, microsecond=0
        )
        if (
            now_hour >= PROC_LINK_COUNT_JOB_HOUR
        ):  # Add 1 day if now exceed the run time {PROC_LINK_COUNT_JOB_HOUR}
            run_time += timedelta(days=1)

        scheduler.add_job(
            job_id,
            proc_link_count,
            replace_existing=False,
            trigger=interval_trigger,
            next_run_time=run_time.astimezone(utc),
            kwargs=dict(_job_id=job_id, _job_name=job_id),
        )
    else:
        scheduler.add_job(
            job_id,
            proc_link_count,
            replace_existing=True,
            trigger=DateTrigger(run_time.astimezone(utc), timezone=utc),
            kwargs=dict(_job_id=job_id, _job_name=job_id),
        )


@scheduler_app_context
def proc_link_count(_job_id=None, _job_name=None):
    gen = proc_link_count_main()
    send_processing_info(gen, JobType.PROC_LINK_COUNT)
    logger.info(f'DONE: {_job_id}')


def proc_link_count_main():
    yield 0
    dic_count = count_proc_links()
    yield 80
    update_proc_link_count(dic_count)
    yield 100
