import json
import traceback
from collections import defaultdict
from typing import Dict, List

import numpy as np
import pandas as pd
from loguru import logger
from numpy import quantile
from pandas import DataFrame
from sqlalchemy import and_, or_

from histview2 import db
from histview2.api.analyze.services.pca import remove_outlier
from histview2.api.trace_data.services.regex_infinity import validate_numeric_minus, validate_numeric_plus, \
    validate_string
from histview2.api.trace_data.services.time_series_chart import main_check_filter_detail_match_graph_data, \
    get_data_from_db
from histview2.common.common_utils import convert_time, add_days, gen_sql_label, \
    gen_sql_like_value, chunks
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.scheduler import dic_running_job, JobType
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.common.services.sse import notify_progress
from histview2.common.trace_data_log import trace_log, TraceErrKey, EventAction, Target, EventType
from histview2.setting_module.models import CfgConstant, CfgProcess, CfgProcessColumn, CfgFilterDetail
from histview2.trace_data.models import find_cycle_class, GlobalRelation, Sensor, Cycle, find_sensor_class
from histview2.trace_data.schemas import DicParam, EndProc, ConditionProc, CategoryProc


@log_execution_time('[TRACE DATA]')
@notify_progress(60)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.PCP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_graph_paracords(dic_param):
    """tracing data to show graph
        1 start point x n end point
        filter by condition point
        https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids)

    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(graph_param)

    # check filter match or not ( for GUI show )
    matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = main_check_filter_detail_match_graph_data(
        graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # order data by serials
    # df = check_and_order_data(df, graph_param, dic_proc_cfgs)
    if int(dic_param[COMMON][IS_REMOVE_OUTLIER]) == 1:
        numeric_cols = []
        objective_var = int(dic_param[COMMON]['objectiveVar'][0]) if dic_param[COMMON]['objectiveVar'] else None
        for proc in graph_param.array_formval:
            end_cols = []
            proc_cfg = dic_proc_cfgs[proc.proc_id]
            end_col_ids = graph_param.get_sensor_cols(proc.proc_id)
            if objective_var and objective_var in end_col_ids:
                end_cols = proc_cfg.get_cols([objective_var])

            if len(end_cols):
                numeric_cols = [gen_sql_label(col.id, col.column_name) for col in end_cols
                                if DataType[col.data_type] in [DataType.REAL, DataType.INTEGER]]

        df_numeric: DataFrame = df[numeric_cols]
        df_numeric = remove_outlier(df_numeric)
        df[numeric_cols] = df_numeric[numeric_cols].to_numpy()
        df = df.dropna(subset=numeric_cols)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[IS_RES_LIMITED] = is_res_limited

    # create output data
    orig_graph_param = bind_dic_param_to_class(dic_param)
    orig_graph_param.add_cate_procs_to_array_formval()
    dic_data = gen_dic_data_from_df(df, orig_graph_param)
    gen_dic_serial_data_from_df(df, dic_proc_cfgs, dic_param)

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] \
        = gen_plotdata(orig_graph_param, dic_data, dic_proc_cfgs)
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    return dic_param


def gen_blank_df_end_col(proc: EndProc):
    params = {gen_sql_label(col_id, proc.col_names[idx]): [] for idx, col_id in enumerate(proc.col_ids)}
    params.update({Cycle.id.key: [], Cycle.global_id.key: [], Cycle.time.key: []})
    return pd.DataFrame(params)


def gen_df_end(proc: EndProc, proc_cfg: CfgProcess, start_relate_ids=None, start_tm=None, end_tm=None):
    proc_id = proc.proc_id

    # get serials
    serials = proc_cfg.get_serials(column_name_only=False)
    serials = [gen_sql_label(serial.id, serial.column_name) for serial in serials]

    # get sensor values
    df_end = get_sensor_values(proc, start_relate_ids=start_relate_ids, start_tm=start_tm, end_tm=end_tm)
    if df_end.empty:
        df_end = gen_blank_df_end_col(proc)

    # filter duplicate
    if df_end.columns.size:
        df_end = df_end[df_end.eval('global_id.notnull()')]

    # drop duplicate
    if df_end.columns.size:
        df_end = df_end.drop_duplicates(subset=serials, keep='last')

    # set index
    if df_end.columns.size:
        df_end.set_index(Cycle.global_id.key, inplace=True)

    return df_end


def gen_df_end_same_with_start(proc: EndProc, proc_cfg: CfgProcess, start_tm, end_tm, drop_duplicate=True):
    # proc_id = proc.proc_id

    # get serials
    serials = proc_cfg.get_serials(column_name_only=False)
    serials = [gen_sql_label(serial.id, serial.column_name) for serial in serials]

    # get sensor values
    df_end = get_sensor_values(proc, start_tm=start_tm, end_tm=end_tm, use_global_id=False)
    if df_end.empty:
        return pd.DataFrame()

    df_end.set_index(Cycle.id.key, inplace=True)

    # if only 1 proc, show all data without filter duplicate
    if drop_duplicate:  # TODO ask PO
        df_end.drop_duplicates(subset=serials, keep='last', inplace=True)

    return df_end


def filter_proc_same_with_start(proc: ConditionProc, start_tm, end_tm):
    if not proc.dic_col_id_filters:
        return None

    cond_records = get_cond_data(proc, start_tm=start_tm, end_tm=end_tm, use_global_id=False)
    # important : None is no filter, [] is no data
    if cond_records is None:
        return None

    return [cycle.id for cycle in cond_records]


def filter_proc(proc: ConditionProc, start_relate_ids=None, start_tm=None, end_tm=None):
    if not proc.dic_col_id_filters:
        return None

    cond_records = get_cond_data(proc, start_relate_ids=start_relate_ids, start_tm=start_tm, end_tm=end_tm)
    # important : None is no filter, [] is no data
    if cond_records is None:
        return None

    return [cycle.global_id for cycle in cond_records]


def create_rsuffix(proc_id):
    return '_{}'.format(proc_id)


def graph_one_proc(proc_cfg: CfgProcess, graph_param: DicParam, start_tm, end_tm, sql_limit):
    """ get data from database

    Arguments:
        trace {[type]} -- [description]
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """

    # start proc
    # proc_id = graph_param.common.start_proc
    proc_id = proc_cfg.id  # or graph_param.common.start_proc
    data = get_start_proc_data(proc_id, start_tm, end_tm, with_limit=sql_limit, with_time_order=True)
    # no data
    if not data:
        return gen_blank_df(graph_param)

    df_start = pd.DataFrame(data)
    df_start.set_index(Cycle.id.key, inplace=True)

    # condition
    for proc in graph_param.common.cond_procs:
        ids = filter_proc_same_with_start(proc, start_tm, end_tm)
        if ids is None:
            continue

        df_start = df_start[df_start.index.isin(ids)]

    # end proc
    for proc in graph_param.array_formval:
        df_end = gen_df_end_same_with_start(proc, proc_cfg, start_tm, end_tm, drop_duplicate=False)
        df_start = df_start.join(df_end, rsuffix=create_rsuffix(proc.proc_id)).reset_index()

    return df_start


def graph_many_proc(dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam, start_tm, end_tm, sql_limit):
    """ get data from database

    Arguments:
        trace {[type]} -- [description]
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    # start proc
    start_proc_id = graph_param.common.start_proc

    # without relate
    data = get_start_proc_data(start_proc_id, start_tm, end_tm, with_limit=sql_limit)
    # no data
    if not data:
        return gen_blank_df(graph_param), False

    df_start = pd.DataFrame(data)

    # with relate
    data_with_relate_id = get_start_proc_data_with_relate_id(start_proc_id, start_tm, end_tm, with_limit=sql_limit)
    if data_with_relate_id:
        df_start_with_relate_id = pd.DataFrame(data_with_relate_id)
        df_start = df_start.append(df_start_with_relate_id, ignore_index=True)

    # downcast data type
    # data_types = {Cycle.global_id.key: np.int64, Cycle.is_outlier.key: 'category'}
    # for col in data_types:
    #     df_start[col].replace({np.nan: None}, inplace=True)
    # df_start = df_start.astype(data_types)

    start_relate_ids = list(df_start[df_start.eval('global_id.notnull()')][Cycle.global_id.key])

    is_res_limited = True
    if len(start_relate_ids) < 5000:
        start_relate_ids = [start_relate_ids[x:x + 900] for x in range(0, len(start_relate_ids), 900)]
        is_res_limited = False
    else:
        start_relate_ids = None

    # set index
    df_start.set_index(Cycle.id.key, drop=False, inplace=True)

    # condition that same with start
    cycle_ids = None
    is_filter = False
    for proc in graph_param.common.cond_procs:
        if not proc.proc_id == start_proc_id:
            continue

        ids = filter_proc_same_with_start(proc, start_tm, end_tm)
        if ids is None:
            continue

        if cycle_ids is None:
            cycle_ids = set(ids)
        else:
            cycle_ids.intersection_update(ids)

        is_filter = True

    if is_filter:
        df_start = df_start[df_start.index.isin(cycle_ids)]
        if not df_start.columns.size:
            return gen_blank_df(graph_param), False

    # end proc that same with start
    for proc in graph_param.array_formval:
        if not proc.proc_id == start_proc_id:
            continue

        # get sensor value data
        df_end = gen_df_end_same_with_start(proc, dic_proc_cfgs[proc.proc_id], start_tm, end_tm)
        df_start = df_start.join(df_end, how='inner', rsuffix=create_rsuffix(proc.proc_id))

    if not df_start.columns.size:
        return gen_blank_df(graph_param), False

    # get min max time {proc_id:[min,max]}
    e_start_tm = convert_time(start_tm, return_string=False)
    e_start_tm = add_days(e_start_tm, -14)
    e_start_tm = convert_time(e_start_tm)
    e_end_tm = convert_time(end_tm, return_string=False)
    e_end_tm = add_days(e_end_tm, 14)
    e_end_tm = convert_time(e_end_tm)

    global_ids = None
    is_filter = False
    for proc in graph_param.common.cond_procs:
        if proc.proc_id == start_proc_id:
            continue

        ids = filter_proc(proc, start_relate_ids, e_start_tm, e_end_tm)
        if ids is None:
            continue

        if global_ids is None:
            global_ids = set(ids)
        else:
            global_ids.intersection_update(ids)

        is_filter = True

    if is_filter:
        if data_with_relate_id:
            idxs = df_start[df_start[Cycle.global_id.key].isin(global_ids)].index
            idxs = set(idxs)
            df_start = df_start.loc[idxs]
            # df_start_grp = df_start.groupby(df_start.index)
            # df_start = df_start[
            #     df_start_grp[Cycle.global_id.key].transform(lambda sub_df: sub_df.isin(global_ids).any())]
        else:
            df_start = df_start[df_start[Cycle.global_id.key].isin(global_ids)]

    # set new Index
    df_start.set_index(Cycle.global_id.key, inplace=True)

    # end proc
    for proc in graph_param.array_formval:
        if proc.proc_id == start_proc_id:
            continue

        df_end = gen_df_end(proc, dic_proc_cfgs[proc.proc_id], start_relate_ids, e_start_tm, e_end_tm)
        df_start = df_start.join(df_end, rsuffix=create_rsuffix(proc.proc_id))

    # group by cycle id to drop duplicate ( 1:n with global relation)
    df_start.set_index(Cycle.id.key, inplace=True)
    if data_with_relate_id:
        df_start = df_start.groupby(df_start.index).first().reset_index()
        # df_start = df_start.groupby(df_start.index).agg(lambda vals: vals.loc[~vals.isnull()].iloc[0])
        # df_start = df_start.groupby(df_start.index).agg(
        #     lambda vals: next((val for val in vals if val is not None), None))

    # sort by time
    df_start.sort_values(Cycle.time.key, inplace=True)

    return df_start, is_res_limited


@log_execution_time()
def validate_data(df):
    # regex filter exclude columns
    exclude_cols = [Cycle.id.key, Cycle.global_id.key, Cycle.time.key, Cycle.is_outlier.key]

    # convert data types
    df = df.convert_dtypes()

    # integer cols
    int_cols = df.select_dtypes(include='integer').columns.tolist()
    return_vals = [pd.NA, pd.NA]
    for col in int_cols:
        if col in exclude_cols:
            continue

        df = validate_numeric_minus(df, col, return_vals)
        df = validate_numeric_plus(df, col, return_vals + [pd.NA])

    # float
    float_cols = df.select_dtypes(include='float').columns.tolist()
    return_neg_vals = [float('-inf'), float('-inf')]
    return_pos_vals = [float('inf'), float('inf'), np.NAN]
    for col in float_cols:
        if col in exclude_cols:
            continue

        df = validate_numeric_minus(df, col, return_neg_vals)
        df = validate_numeric_plus(df, col, return_pos_vals)

    # non-numeric cols
    for col in df.columns:
        if col in exclude_cols:
            continue

        if col in int_cols or col in float_cols:
            continue
        df = validate_string(df, col)

    return df


@log_execution_time()
def gen_dic_data_from_df(df: DataFrame, graph_param: DicParam):
    dic_data = defaultdict(dict)
    for proc in graph_param.array_formval:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            sql_label = gen_sql_label(col_id, col_name)
            if sql_label in df.columns:
                dic_data[proc.proc_id][col_id] = df[sql_label].replace({np.nan: None}).tolist()
            else:
                dic_data[proc.proc_id][col_id] = [None] * df.index.size

        dic_data[proc.proc_id][Cycle.time.key] = []
        time_col_alias = '{}_{}'.format(Cycle.time.key, proc.proc_id)
        if time_col_alias in df:
            dic_data[proc.proc_id][Cycle.time.key] = df[time_col_alias].replace({np.nan: None}).tolist()

    return dic_data


@log_execution_time()
def gen_dic_serial_data_from_df(df: DataFrame, dic_proc_cfgs, dic_param):
    dic_param[SERIAL_DATA] = dict()
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        serial_cols = proc_cfg.get_serials(column_name_only=False)
        sql_labels = [gen_sql_label(serial_col.id, serial_col.column_name) for serial_col in serial_cols]
        if sql_labels and all(item in df.columns for item in sql_labels):
            dic_param[SERIAL_DATA][proc_id] = df[sql_labels] \
                .replace({np.nan: ''}) \
                .to_records(index=False) \
                .tolist()
        else:
            dic_param[SERIAL_DATA][proc_id] = []


@log_execution_time()
def group_by_start_cycle(data):
    dic_cycle_idx = {}
    relate_ids = []
    idxs = []
    cycle_ids = []

    cnt = 0
    for idx, row in enumerate(data):
        current_idx = dic_cycle_idx.get(row.id)
        if current_idx is None:
            dic_cycle_idx[row.id] = cnt

            # relate
            relate_ids.append(gen_relate_ids(row))

            cycle_ids.append([row.id])
            idxs.append(idx)
            cnt += 1
        else:
            if row.relate_id:
                relate_ids[current_idx].append(row.relate_id)

    return cycle_ids, relate_ids, idxs


@log_execution_time()
def filter_data(start_proc_name, cycle_ids, relate_ids, cycle_conds):
    if not cycle_conds:
        return [i for i in range(len(relate_ids))]

    filter_idxs = []
    for idx, [cycle_id, relate_id] in enumerate(zip(cycle_ids, relate_ids)):
        checks = [None] * len(cycle_conds)
        for chk_idx, [proc_name, chk_keys] in enumerate(cycle_conds):
            if proc_name == start_proc_name:
                ids = cycle_id
            else:
                ids = relate_id

            for id in ids:
                if checks[chk_idx] is None and id in chk_keys:
                    checks[chk_idx] = True

        if all(checks):
            filter_idxs.append(idx)

    return filter_idxs


@log_execution_time()
def gen_filtered_data(relate_ids, filtered_relate_idxs, data, data_idxs):
    times = []
    cycles = []
    outliers = []
    new_relate_ids = []

    for idx in filtered_relate_idxs:
        data_idx = data_idxs[idx]
        row = data[data_idx]
        new_relate_ids.append(relate_ids[idx])
        times.append(row.time)
        cycles.append([row.id])
        outliers.append(row.is_outlier)

    return new_relate_ids, times, cycles, outliers


@log_execution_time()
def gen_null_array_for_sensor(graph_param: DicParam, arr_len, show_none=True):
    ele = None if show_none else ''
    dic_proc_sensors = defaultdict(dict)

    for proc in graph_param.array_formval:
        for sensor in proc.col_ids:
            dic_proc_sensors[proc.proc_id][sensor] = [ele] * arr_len

    return dic_proc_sensors


@log_execution_time()
def gen_final_data(graphic_param: DicParam, cycle_ids, relate_ids, dic_sensor_vals, show_none=True):
    # create null arrays
    dic_data = gen_null_array_for_sensor(graphic_param, len(relate_ids), show_none=show_none)

    for idx, [cycle_id, relate_id] in enumerate(zip(cycle_ids, relate_ids)):
        for proc_id, dic_col_data in dic_data.items():
            if proc_id == graphic_param.common.start_proc:
                ids = cycle_id
            else:
                ids = relate_id

            for id in ids:
                if id is None:
                    continue

                row = dic_sensor_vals[proc_id].get(id)
                if not row:
                    continue

                for col_id in dic_col_data:
                    # TODO : Duy name is id or column name
                    # val = getattr(row, SQL_COL_PREFIX + sensor_name, None)
                    val = getattr(row, str(col_id), None)
                    if val is None:
                        continue

                    dic_data[proc_id][col_id][idx] = val

    return dic_data


@log_execution_time()
def get_proc_ids(procs):
    pass


@log_execution_time()
def get_start_proc_data_with_relate_id(proc_id, start_tm, end_tm, with_limit=None):
    """
    inner join with relate table
    :param proc_id:
    :param start_tm:
    :param end_tm:
    :param with_limit:
    :return:
    """
    # start proc subquery
    cycle_cls = find_cycle_class(proc_id)
    data = db.session.query(cycle_cls.id, GlobalRelation.relate_id.label(Cycle.global_id.key), cycle_cls.time,
                            cycle_cls.is_outlier)
    data = data.filter(cycle_cls.process_id == proc_id)
    data = data.filter(cycle_cls.time >= start_tm)
    data = data.filter(cycle_cls.time < end_tm)

    # join global relation
    data = data.join(GlobalRelation, GlobalRelation.global_id == cycle_cls.global_id)

    if with_limit:
        data = data.limit(with_limit)

    data = data.all()

    return data


@log_execution_time()
def get_start_proc_data(proc_id, start_tm, end_tm, with_limit=None, with_time_order=None):
    """
    get start proc only (with out relation)
    :param proc_id:
    :param start_tm:
    :param end_tm:
    :param with_limit:
    :param with_time_order:
    :return:
    """
    cycle_cls = find_cycle_class(proc_id)
    cycle = db.session.query(cycle_cls.id, cycle_cls.global_id, cycle_cls.time, cycle_cls.is_outlier)
    cycle = cycle.filter(cycle_cls.process_id == proc_id)
    cycle = cycle.filter(cycle_cls.time >= start_tm)
    cycle = cycle.filter(cycle_cls.time < end_tm)

    if with_time_order:
        cycle = cycle.order_by(cycle_cls.time)

    if with_limit:
        cycle = cycle.limit(with_limit)

    cycle = cycle.all()

    return cycle


def get_sensor_values_chunk(data_query, chunk_sensor, dic_sensors, cycle_cls, start_relate_ids, start_tm, end_tm):
    for col_id, col_name in chunk_sensor:
        sensor = dic_sensors[col_name]
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)
        sensor_val = sensor_val_cls.coef(col_id)

        data_query = data_query.outerjoin(
            sensor_val_cls,
            and_(sensor_val_cls.cycle_id == cycle_cls.id, sensor_val_cls.sensor_id == sensor.id)
        )

        data_query = data_query.add_columns(sensor_val)

    # chunk
    if start_relate_ids:
        records = []
        for ids in start_relate_ids:
            temp = data_query.filter(cycle_cls.global_id.in_(ids))
            records += temp.all()
        id_key = Cycle.global_id.key
    else:
        data_query = data_query.filter(cycle_cls.time >= start_tm)
        data_query = data_query.filter(cycle_cls.time < end_tm)
        records = data_query.all()
        id_key = Cycle.id.key

    if records:
        return pd.DataFrame(records)
    else:
        params = {gen_sql_label(col_id, col_name) for col_id, col_name in chunk_sensor}
        params.update({
            id_key: [],
            Cycle.time.key: [],
        })
        df_chunk = pd.DataFrame({gen_sql_label(col_id, col_name): [] for col_id, col_name in chunk_sensor})
        return df_chunk


@log_execution_time()
def get_sensor_values(proc: EndProc, start_relate_ids=None, start_tm=None, end_tm=None, use_global_id=True):
    """gen inner join sql for all column in 1 proc

    Arguments:
        proc_id {[string]} -- [process id]
        cols {[list]} -- [column name list]
    """
    dic_sensors = gen_dic_sensors(proc.proc_id, proc.col_names)

    cycle_cls = find_cycle_class(proc.proc_id)
    if use_global_id:
        data = db.session.query(cycle_cls.global_id, cycle_cls.time)
    else:
        data = db.session.query(cycle_cls.id, cycle_cls.time)

    data = data.filter(cycle_cls.process_id == proc.proc_id)
    dataframes = []
    all_sensors = list(zip(proc.col_ids, proc.col_names))
    for idx, chunk_sensor in enumerate(chunks(all_sensors, 50)):
        df_chunk = get_sensor_values_chunk(data, chunk_sensor, dic_sensors, cycle_cls, start_relate_ids,
                                           start_tm, end_tm)
        if idx != 0 and Cycle.time.key in df_chunk.columns:
            df_chunk = df_chunk.drop(Cycle.time.key, axis=1)
        dataframes.append(df_chunk)

    df = pd.concat([dfc.set_index(dfc.columns[0]) for dfc in dataframes], ignore_index=False, axis=1).reset_index()

    return df


@log_execution_time()
def get_cond_data(proc: ConditionProc, start_relate_ids=None, start_tm=None, end_tm=None, use_global_id=True):
    """generate subquery for every condition procs
    """
    # get sensor info ex: sensor id , data type (int,real,text)
    filter_query = Sensor.query.filter(Sensor.process_id == proc.proc_id)

    # filter
    cycle_cls = find_cycle_class(proc.proc_id)
    if use_global_id:
        data = db.session.query(cycle_cls.global_id)
    else:
        data = db.session.query(cycle_cls.id)

    data = data.filter(cycle_cls.process_id == proc.proc_id)

    # for filter_sensor in filter_sensors:
    for col_name, filter_details in proc.dic_col_name_filters.items():
        sensor = filter_query.filter(Sensor.column_name == col_name).first()
        sensor_val = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)

        ands = []
        for filter_detail in filter_details:
            comp_ins = []
            comp_likes = []
            comp_regexps = []
            cfg_filter_detail: CfgFilterDetail
            for cfg_filter_detail in filter_detail.cfg_filter_details:
                val = cfg_filter_detail.filter_condition
                if cfg_filter_detail.filter_function == FilterFunc.REGEX.name:
                    comp_regexps.append(val)
                elif not cfg_filter_detail.filter_function \
                        or cfg_filter_detail.filter_function == FilterFunc.MATCHES.name:
                    comp_ins.append(val)
                else:
                    comp_likes.extend(gen_sql_like_value(val, FilterFunc[cfg_filter_detail.filter_function],
                                                         position=cfg_filter_detail.filter_from_pos))

            ands.append(
                or_(
                    sensor_val.value.in_(comp_ins),
                    *[sensor_val.value.op(SQL_REGEXP_FUNC)(val) for val in comp_regexps if val is not None],
                    *[sensor_val.value.like(val) for val in comp_likes if val is not None],
                )
            )

        data = data.join(
            sensor_val, and_(
                sensor_val.cycle_id == cycle_cls.id,
                sensor_val.sensor_id == sensor.id,
                *ands,
            )
        )

    # chunk
    if start_relate_ids:
        records = []
        for ids in start_relate_ids:
            temp = data.filter(cycle_cls.global_id.in_(ids))
            records += temp.all()
    else:
        data = data.filter(cycle_cls.time >= start_tm)
        data = data.filter(cycle_cls.time < end_tm)
        records = data.all()

    return records


@log_execution_time()
def gen_dic_sensors(proc_id, cols=None):
    """gen dictionary of sensors
        {column_name: T_sensor instance}

    Arguments:
        proc_id {string} -- process id
    """

    sensors = Sensor.query.filter(Sensor.process_id == proc_id)
    if cols:
        sensors = sensors.filter(Sensor.column_name.in_(cols))

    return {sensor.column_name: sensor for sensor in sensors}


def order_end_proc_sensor(orig_graph_param: DicParam):
    dic_orders = {}
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        orders = CfgConstant.get_value_by_type_name(type=CfgConstantType.TS_CARD_ORDER.name, name=proc_id) or '{}'
        orders = json.loads(orders)
        if orders:
            dic_orders[proc_id] = orders

    lst_proc_end_col = []
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        for col_id in proc.col_ids:
            proc_order = dic_orders.get(proc_id) or {}
            order = proc_order.get(str(col_id)) or 999
            lst_proc_end_col.append((proc_id, col_id, order))

    return sorted(lst_proc_end_col, key=lambda x: x[-1])


@log_execution_time()
@notify_progress(50)
def gen_plotdata(orig_graph_param: DicParam, dic_data, dic_proc_cfg):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param)

    plotdatas = []
    array_formval = []
    for proc_id, col_id, _ in lst_proc_end_col:
        col_detail = {}
        rank_value = {}
        get_cols = dic_proc_cfg[proc_id].get_cols([col_id])
        array_y = dic_data[proc_id][col_id]

        if get_cols:
            # remove none from data
            array_y_without_na = pd.DataFrame(array_y).dropna()
            array_y_without_na = array_y_without_na[0].to_list() if not array_y_without_na.empty else []
            # if get_cols[0].data_type == DataType.TEXT.name and len(array_y_without_na):
            if get_cols[0].data_type in [DataType.TEXT.name, DataType.INTEGER.name]:
                cat_array_y = pd.Series(array_y).astype('category').cat
                array_y = cat_array_y.codes.tolist()

                rank_value = {-1: NA_STR}
                if (len(cat_array_y.categories.to_list())):
                    rank_value = dict(enumerate(cat_array_y.categories))
            col_detail = {
                'id': col_id,
                'name': get_cols[0].name,
                'type': get_cols[0].data_type,
                'proc_id': proc_id,
                'proc_name': get_cols[0].cfg_process.name
            }

        plotdata = dict(array_y=array_y, col_detail=col_detail, rank_value=rank_value)
        plotdatas.append(plotdata)

        array_formval.append({
            END_PROC: proc_id,
            GET02_VALS_SELECT: col_id
        })

    return array_formval, plotdatas


@log_execution_time()
def gen_category_data(dic_proc_cfgs: Dict[int, CfgProcess], cate_procs: List[CategoryProc], dic_data):
    plotdatas = []
    for proc in cate_procs:
        proc_id = proc.proc_id
        dic_proc = dic_data.get(proc_id)
        if dic_proc is None:
            continue

        proc_cfg = dic_proc_cfgs[proc_id]
        dic_column_cfgs: Dict[int, CfgProcessColumn] = {col.id: col for col in proc_cfg.columns}

        for col_id, col_show_name in zip(proc.col_ids, proc.col_show_names):
            array_y = dic_proc.get(col_id)
            if array_y is None:
                continue

            plotdata = dict(proc_name=proc_id, proc_master_name=proc_cfg.name,
                            column_name=col_id, column_master_name=col_show_name,
                            data=array_y)
            plotdatas.append(plotdata)

    return plotdatas


@log_execution_time()
def clear_all_keyword(dic_param):
    """ clear [All] keyword in selectbox

    Arguments:
        dic_param {json} -- [params from client]
    """
    dic_common = dic_param[COMMON]
    cate_procs = dic_common.get(CATE_PROCS, [])
    dic_formval = dic_param[ARRAY_FORMVAL]
    for idx in range(len(dic_formval)):
        select_vals = dic_formval[idx][GET02_VALS_SELECT]
        if isinstance(select_vals, (list, tuple)):
            dic_formval[idx][GET02_VALS_SELECT] = [val for val in select_vals if val not in [SELECT_ALL, NO_FILTER]]
        else:
            dic_formval[idx][GET02_VALS_SELECT] = [select_vals]

    for idx in range(len(cate_procs)):
        select_vals = cate_procs[idx][GET02_CATE_SELECT]
        if isinstance(select_vals, (list, tuple)):
            cate_procs[idx][GET02_CATE_SELECT] = [val for val in select_vals if val not in [SELECT_ALL, NO_FILTER]]
        else:
            cate_procs[idx][GET02_CATE_SELECT] = [select_vals]

    # Need NO_FILTER keyword to decide filter or not , so we can not remove NO_FILTER keyword here.
    for cond in dic_common[COND_PROCS]:
        for key, value in cond.items():
            if isinstance(value, (list, tuple)):
                vals = value
            else:
                vals = [value]

            if NO_FILTER in vals:
                continue

            cond[key] = [val for val in vals if not val == SELECT_ALL]


@log_execution_time()
def update_outlier_flg(proc_id, cycle_ids, is_outlier):
    """update outlier to t_cycle table

    Arguments:
        cycle_ids {[type]} -- [description]
        is_outlier {[type]} -- [description]

    Returns:
        [type] -- [description]
    """

    # get global_ids linked to target cycles
    cycle_cls = find_cycle_class(proc_id)
    cycle_recs = cycle_cls.get_cycles_by_ids(cycle_ids)
    if not cycle_recs:
        return True

    global_ids = []
    for rec in cycle_recs:
        if rec.global_id:
            global_ids.append(rec.global_id)
        else:
            rec.is_outlier = is_outlier

    target_global_ids = GlobalRelation.get_all_relations_by_globals(global_ids, set_done_globals=set())

    # update outlier for linked global ids
    # TODO: fix front end
    cycle_cls.update_outlier_by_global_ids(list(target_global_ids), is_outlier)

    db.session.commit()
    return True


@log_execution_time()
def get_serials(trace, proc_name):
    return [s.split()[0] for s in trace.hist2_yaml.get_serial_col(proc_name) if s]


@log_execution_time()
def get_date_col(trace, proc_name):
    date_col = trace.hist2_yaml.get_date_col(proc_name)
    date_col = date_col.split()[0]
    return date_col


def gen_new_dic_param(dic_param, dic_non_sensor, start_proc_first=False):
    pass


def get_non_sensor_cols(dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam):
    """get non sensor headers

    Arguments:
        trace {[type]} -- [description]
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    dic_header = {}

    for proc in graph_param.array_formval:
        proc_id = proc.proc_id
        proc_cfg = dic_proc_cfgs[proc_id]
        serials = proc_cfg.get_serials()
        date_col = proc_cfg.get_date_col()
        cols = serials + [date_col]
        dic_header[proc_id] = cols

    # start proc
    proc_id = graph_param.common.start_proc
    if not dic_header.get(proc_id):
        proc_cfg = dic_proc_cfgs[proc_id]
        serials = proc_cfg.get_serials()
        date_col = proc_cfg.get_date_col()
        cols = serials + [date_col]
        dic_header[proc_id] = cols

    return dic_header


def get_cate_var(graph_param: DicParam):
    cate_procs = graph_param.common.cate_procs
    if cate_procs:
        return {ele[CATE_PROC]: ele[GET02_CATE_SELECT] for ele in cate_procs if
                ele.get(CATE_PROC) and ele.get(GET02_CATE_SELECT)}

    return None


def gen_relate_ids(row):
    """
    gen start proc relate ids
    """

    relate_ids = []
    if row.global_id:
        relate_ids.append(row.global_id)
        if row.relate_id:
            relate_ids.append(row.relate_id)

    return relate_ids


def is_import_job_running():
    return any([job.startswith(str(JobType.FACTORY_IMPORT)) or job.startswith(str(JobType.CSV_IMPORT))
                for job in set(dic_running_job.keys())])


@log_execution_time()
def make_irregular_data_none(dic_param):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        array_y = plotdata.get(ARRAY_Y) or []
        array_y_type = plotdata.get(ARRAY_Y_TYPE) or []
        if array_y_type:  # use y_type to check for irregular data
            array_plotdata[num][ARRAY_Y] = \
                [None if array_y_type[idx] not in (
                    YType.NORMAL.value, YType.OUTLIER.value, YType.NEG_OUTLIER.value) else e
                 for idx, e in enumerate(array_y)]
        else:  # or use value to check for irregular data directly
            array_plotdata[num][ARRAY_Y] = \
                [None if e == float('inf') or e == float('-inf') else e for e in array_y]
    return dic_param


def get_maxmax_minmin_chartinfo(chart_infos):
    y_min = float('inf')
    y_max = float('-inf')
    for chart_info in chart_infos:
        c_y_min = chart_info.get(Y_MIN) if chart_info.get(Y_MIN) is not None else float('inf')
        if y_min > c_y_min:
            y_min = c_y_min
        c_y_max = chart_info.get(Y_MAX) if chart_info.get(Y_MAX) is not None else float('-inf')
        if y_max < c_y_max:
            y_max = c_y_max
    # Default (y_min, y_max) = (0, 1) if can not found min/max
    # y_min = 0 if y_min == float('inf') else y_min
    # y_max = (y_min + 1) if y_max == float('-inf') else y_max
    y_min = None if y_min == float('inf') else y_min
    y_max = None if y_max == float('-inf') else y_max
    return [y_min, y_max]


def produce_irregular_plotdata(dic_param):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        array_y = plotdata.get(ARRAY_Y) or []

        # calculate upper/lower limit
        chart_infos = plotdata[CHART_INFOS] or []
        y_min, y_max = get_maxmax_minmin_chartinfo(chart_infos)

        if y_max is None or y_min is None:
            whisker_lower, whisker_upper = calc_upper_lower_whisker(array_y)
            y_min = whisker_lower if y_min is None else y_min
            y_max = whisker_upper if y_max is None else y_max

        # create new irregular_plotdata of array_y
        array_y_type = []
        for idx, e in enumerate(array_y):
            # convert inf/none to min/max; nan/na is not supported
            if e is None:
                array_y_type.append(YType.NONE.value)
            elif e == float('inf'):
                array_y_type.append(YType.INF.value)
            elif e == float('-inf'):
                array_y_type.append(YType.NEG_INF.value)
            else:  # normal values
                # convert outlier to min/max
                # if e > y-max or e < y-min:
                if y_max is not None and e > y_max:
                    # Sprint 79 #12: Keep actual value, FE display actual value
                    # array_plotdata[num][ARRAY_Y][idx] = y_max
                    array_y_type.append(YType.OUTLIER.value)
                elif y_min is not None and e < y_min:
                    # array_plotdata[num][ARRAY_Y][idx] = y_min
                    array_y_type.append(YType.NEG_OUTLIER.value)
                else:
                    array_y_type.append(YType.NORMAL.value)

        array_plotdata[num][ARRAY_Y_TYPE] = array_y_type
        array_plotdata[num][Y_MAX] = y_max
        array_plotdata[num][Y_MIN] = y_min


def calc_upper_lower_whisker(arr):
    arr = [e for e in arr if e not in {None, float('inf'), float('-inf')}]
    if arr:
        q1 = quantile(arr, 0.25, interpolation='midpoint')
        q3 = quantile(arr, 0.75, interpolation='midpoint')
        iqr = q3 - q1
        if iqr:
            whisker_lower = q1 - 2.5 * iqr
            whisker_upper = q3 + 2.5 * iqr
        else:
            whisker_lower = 0.9 * min(arr)
            whisker_upper = 1.1 * max(arr)
        return whisker_lower, whisker_upper
    return None, None


def save_proc_sensor_order_to_db(orders):
    try:
        for proc_code, new_orders in orders.items():
            CfgConstant.create_or_merge_by_type(const_type=CfgConstantType.TS_CARD_ORDER.name,
                                                const_name=proc_code,
                                                const_value=new_orders)
    except Exception as ex:
        traceback.print_exc()
        logger.error(ex)


def get_procs_in_dic_param(graph_param: DicParam):
    """
    get process
    :param graph_param:
    :return:
    """
    procs = set()
    procs.add(graph_param.common.start_proc)
    for proc in graph_param.common.cond_procs:
        procs.add(proc.proc_id)

    for proc in graph_param.common.cate_procs:
        procs.add(proc.proc_id)

    for proc in graph_param.array_formval:
        procs.add(proc.proc_id)

    return {proc.id: proc for proc in CfgProcess.get_procs(procs)}


def gen_blank_df(graph_param: DicParam):
    data = {Cycle.time.key: [], Cycle.is_outlier.key: []}
    return pd.DataFrame(data)
