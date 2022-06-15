from collections import deque
from typing import List, Union, Dict

from sqlalchemy import and_

from histview2 import db
from histview2.api.trace_data.services.proc_link import gen_trace_key_info
from histview2.common.common_utils import gen_sql_label
from histview2.common.constants import DataType
from histview2.common.logger import log_execution_time
from histview2.setting_module.models import CfgTrace, CfgProcess
from histview2.trace_data.models import find_cycle_class, Sensor, find_sensor_class

PREDICT_SAMPLE = 10_000


@log_execution_time('[SIMULATE GLOBAL ID]')
def sim_gen_global_id(edges: List[CfgTrace]):
    """
    generate global id for universal db (root function)
    """
    edges = sim_order_before_mapping_data(edges)

    # matched count on proc
    dic_cycle_ids = {}

    # matched count on edge
    dic_edge_cnt = {}

    # proc : rows in database
    dic_proc_data = {}

    # filtered flags
    filtered_procs = []

    # backward start leaf procs
    for edge in edges:
        # matching keys
        start_keys = gen_trace_key_info(edge, False)
        end_keys = gen_trace_key_info(edge, True)

        start_proc_id = edge.target_process_id
        start_proc_data = gen_start_proc_data(start_proc_id, dic_proc_data, filtered_procs, dic_cycle_ids)
        if not start_proc_data:
            continue

        dic_start_data = gen_dic_proc_data(start_proc_data, start_keys)

        end_proc_id = edge.self_process_id
        end_proc_data = gen_end_proc_data(start_proc_id, start_keys, end_proc_id, end_keys, dic_proc_data)
        dic_end_data = gen_dic_proc_data(end_proc_data, end_keys)

        # init count data
        dic_cycle_ids.setdefault(start_proc_id, set())
        dic_cycle_ids.setdefault(end_proc_id, set())

        # mapping
        cnt = 0
        for keys, end_row in dic_end_data.items():
            start_row = dic_start_data.get(keys)
            if not start_row:
                continue

            dic_cycle_ids[start_proc_id].add(start_row.id)
            dic_cycle_ids[end_proc_id].add(end_row.id)
            cnt += 1

        # count matched per edge
        dic_edge_cnt[f'{end_proc_id}-{start_proc_id}'] = cnt

    dic_proc_cnt = {proc_id: [len(cycles), len(dic_proc_data[proc_id])] for proc_id, cycles in dic_cycle_ids.items()}
    return dic_proc_cnt, dic_edge_cnt


def get_sample_data(proc_id, cols_filters: Union[Dict, List], from_time=None, limit=PREDICT_SAMPLE):
    """
    build sql to query matching global
    get cycles by proc_id
    """
    dic_filter = {}
    if isinstance(cols_filters, dict):
        dic_filter = cols_filters

    column_names = list(cols_filters)

    cycle_cls = find_cycle_class(proc_id)
    data = db.session.query(cycle_cls.id, cycle_cls.global_id, cycle_cls.time).filter(cycle_cls.process_id == proc_id)
    data = data.order_by(cycle_cls.time, cycle_cls.id)

    offset = PREDICT_SAMPLE
    if from_time:
        data = data.filter(cycle_cls.time >= from_time)
        offset = 0

    # get sensor information of keys from database (run separate to reuse cache, keys are only 1 or 2 columns)
    sensors = Sensor.query.filter(Sensor.process_id == proc_id).filter(Sensor.column_name.in_(column_names)).all()

    for sensor in sensors:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)

        filter_val = dic_filter.get(sensor.column_name)
        if filter_val is None:
            data = data.join(sensor_val_cls, sensor_val_cls.cycle_id == cycle_cls.id)
        else:
            data = data.join(sensor_val_cls,
                             and_(sensor_val_cls.cycle_id == cycle_cls.id, sensor_val_cls.value == filter_val))

        data = data.filter(sensor_val_cls.sensor_id == sensor.id)
        data = data.add_columns(sensor_val_cls.value.label(gen_sql_label(sensor.column_name)))

    data = data.limit(limit + offset)

    data = data.all()

    # do not use offset , because maybe records count < 50
    if not from_time:
        data = data[min(offset * 2, len(data)) // 2:]

    return data


@log_execution_time()
def sim_order_before_mapping_data(edges: List[CfgTrace]):
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
        # traceback. So target => start , self => end
        if any((edge.target_process_id == other_edge.self_process_id for other_edge in edges)):
            # move to the end of queue
            edges.append(edge)
            cnt += 1
        else:
            ordered_edges.append(edge)
            cnt = 0

    return ordered_edges


def gen_start_proc_data(proc_id, dic_proc_data, filtered_procs, dic_cycle_ids):
    # get sample data
    proc_data = dic_proc_data.get(proc_id)
    if proc_data:
        # already a node of previous edge
        if proc_id not in filtered_procs:
            filter_cycle_ids = dic_cycle_ids.get(proc_id)

            # only use data that matched before edge ( as a end proc of previous edge )
            if filter_cycle_ids:
                proc_data = [row for row in proc_data if row.id in filter_cycle_ids]
            elif filter_cycle_ids is not None:
                proc_data = []

            # save after filtered
            filtered_procs.append(proc_id)
            dic_proc_data[proc_id] = proc_data
    else:
        # end leaf proc case
        cfg_proc = CfgProcess.query.get(proc_id)
        serials = cfg_proc.get_serials()
        proc_data = get_sample_data(proc_id, serials)
        dic_proc_data[proc_id] = proc_data

    return proc_data


def gen_end_proc_data(start_proc_id, start_keys, end_proc_id, end_keys, dic_proc_data):
    # get sample data
    end_proc_data = dic_proc_data.get(end_proc_id)

    # reuse already exist data
    if end_proc_data:
        return end_proc_data

    # get end proc time by start proc condition
    start_proc_data = dic_proc_data[start_proc_id]
    from_time = find_from_time(start_proc_data, start_keys, end_proc_id, end_keys)

    # get data from db
    cfg_proc = CfgProcess.query.get(end_proc_id)
    serials = cfg_proc.get_serials()
    end_proc_data = get_sample_data(end_proc_id, serials, from_time=from_time)
    dic_proc_data[end_proc_id] = end_proc_data

    return end_proc_data


def find_from_time(start_proc_data, start_keys, end_proc_id, end_keys):
    row = start_proc_data[0]
    dic_keys = {end_key.column_name: getattr(row, gen_sql_label(start_key.column_name))
                for start_key, end_key in zip(start_keys, end_keys)}

    end_proc_data = get_sample_data(end_proc_id, dic_keys, limit=1)
    if end_proc_data:
        return end_proc_data[0].time

    return row.time


def gen_dic_proc_data(data, trace_key_infos):
    dic_filter = {}
    for row in data:
        keys = []
        for key in trace_key_infos:
            val = str(getattr(row, gen_sql_label(key.column_name)))
            if key.from_char:
                val = val[key.from_char - 1:key.to_char]

            keys.append(val)

        dic_filter[tuple(keys)] = row

    return dic_filter
