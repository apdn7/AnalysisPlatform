import json
from collections import defaultdict

import numpy as np
import pandas as pd
from pandas import DataFrame

from ap.api.common.services.show_graph_services import (
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    gen_unique_data,
    get_data_from_db,
    get_filter_on_demand_data,
    get_fmt_str_from_dic_data,
    get_serial_and_datetime_data,
    is_nominal_check,
    main_check_filter_detail_match_graph_data,
)
from ap.common.common_utils import gen_sql_label
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    CAST_INF_VALS,
    CATEGORIZED_SUFFIX,
    CATEGORY_COLS,
    CATEGORY_DATA,
    COMMON,
    DATA_SIZE,
    DATETIME,
    END_PROC,
    FINE_SELECT,
    FMT,
    GET02_VALS_SELECT,
    MATCHED_FILTER_IDS,
    NA_STR,
    NOT_EXACT_MATCH_FILTER_IDS,
    SERIAL_DATA,
    SERIALS,
    START_PROC,
    TIME_COL,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    CacheType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import MessageAnnouncer
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.trace_data.schemas import DicParam


@log_execution_time('[TRACE DATA]')
@request_timeout_handling()
@abort_process_handler()
@MessageAnnouncer.notify_progress(60)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.PCP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True, cache_type=CacheType.TRANSACTION_DATA)
def gen_graph_paracords(graph_param, dic_param, df=None):
    """tracing data to show graph
    1 start point x n end points
    filter by condition point
    https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    dic_param, _, _, dic_cat_filters, use_expired_cache, *_ = customize_dic_param_for_reuse_cache(dic_param)

    # get dic process config
    dic_proc_cfgs = graph_param.dic_proc_cfgs

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            use_expired_cache=use_expired_cache,
            with_categorized_real=True,
        )
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
        dic_param[UNIQUE_SERIAL] = unique_serial

    # remove NA, -inf, inf in mode fine select
    fine_select = bool(int(dic_param[COMMON][FINE_SELECT])) if FINE_SELECT in dic_param[COMMON] else False
    if fine_select:
        # replace inf, -inf to nan and drop nan any
        df = df.replace({float('inf'): np.nan, float('-inf'): np.nan}).dropna(how='any')

    # check filter match or not ( for GUI show )
    (
        matched_filter_ids,
        unmatched_filter_ids,
        not_exact_match_filter_ids,
    ) = main_check_filter_detail_match_graph_data(graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # order data by serials
    # df = check_and_order_data(df, graph_param, dic_proc_cfgs)
    objective_var = graph_param.common.objective_var
    end_cols = graph_param.get_col_cfgs(graph_param.common.sensor_cols)
    if graph_param.common.remove_outlier_objective_var:
        objective_col = [gen_sql_label(col.id, col.column_name) for col in end_cols if col.id == objective_var]
        df = df.dropna(subset=objective_col)

    if graph_param.common.remove_outlier_explanatory_var:
        explanatory_cols = [gen_sql_label(col.id, col.column_name) for col in end_cols if col.id != objective_var]
        df = df.dropna(subset=explanatory_cols)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()

    # create output data
    # orig_graph_param = bind_dic_param_to_class(dic_param)
    # graph_param.add_cate_procs_to_array_formval()
    dic_data = gen_dic_data_from_df(df, graph_param)
    fmt_dic = get_fmt_str_from_dic_data(dic_data)
    gen_dic_serial_data_from_df(df, dic_proc_cfgs, dic_param)

    (
        dic_param[ARRAY_FORMVAL],
        dic_param[ARRAY_PLOTDATA],
        category_cols,
        category_cols_details,
        cast_inf_vals,
    ) = gen_plotdata(graph_param, dic_data, dic_proc_cfgs, df=df)

    dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, category_cols, True)

    # filter on-demand
    dic_param = filter_cat_dict_common(df, dic_param, None, None, graph_param, True, category_cols)

    dic_param[CATEGORY_DATA] = list(dic_unique_cate.values())

    dic_param[CAST_INF_VALS] = cast_inf_vals
    dic_param[FMT] = fmt_dic

    serial_data, datetime_data, start_proc_name = get_serial_and_datetime_data(df, graph_param, dic_proc_cfgs)
    dic_param[SERIALS] = serial_data
    dic_param[DATETIME] = datetime_data
    dic_param[START_PROC] = start_proc_name
    dic_param[CATEGORY_COLS] = category_cols_details

    dic_param = get_filter_on_demand_data(dic_param)

    return dic_param


@log_execution_time()
@abort_process_handler()
def gen_dic_data_from_df(df: DataFrame, graph_param: DicParam):
    dic_data = defaultdict(dict)
    for proc in graph_param.array_formval:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            sql_label = gen_sql_label(col_id, col_name)
            if sql_label in df.columns:
                dic_data[proc.proc_id][col_id] = df[sql_label].replace({np.nan: None}).tolist()
            else:
                dic_data[proc.proc_id][col_id] = [None] * df.index.size

        dic_data[proc.proc_id][TIME_COL] = []
        time_col_alias = '{}_{}'.format(TIME_COL, proc.proc_id)
        if time_col_alias in df:
            dic_data[proc.proc_id][TIME_COL] = df[time_col_alias].replace({np.nan: None}).tolist()

    return dic_data


@log_execution_time()
@abort_process_handler()
def gen_dic_serial_data_from_df(df: DataFrame, dic_proc_cfgs, dic_param):
    dic_param[SERIAL_DATA] = {}
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        serial_cols = dic_proc_cfgs[proc_id].get_serials(column_name_only=False)
        sql_labels = [gen_sql_label(serial_col.id, serial_col.column_name) for serial_col in serial_cols]
        if sql_labels and all(item in df.columns for item in sql_labels):
            dic_param[SERIAL_DATA][proc_id] = df[sql_labels].replace({np.nan: ''}).to_records(index=False).tolist()
        else:
            dic_param[SERIAL_DATA][proc_id] = []


# @log_execution_time()
# @abort_process_handler()
# def get_cond_data(proc: ConditionProc, start_relate_ids=None, start_tm=None, end_tm=None, use_global_id=True):
#     """generate subquery for every condition procs"""
#     # get sensor info ex: sensor id , data type (int,real,text)
#     filter_query = Sensor.query.filter(Sensor.process_id == proc.proc_id)
#
#     # filter
#     cycle_cls = find_cycle_class(proc.proc_id)
#     if use_global_id:
#         data = db.session.query(cycle_cls.global_id)
#     else:
#         data = db.session.query(cycle_cls.id)
#
#     data = data.filter(cycle_cls.process_id == proc.proc_id)
#
#     # for filter_sensor in filter_sensors:
#     for col_name, filter_details in proc.dic_col_name_filters.items():
#         sensor = filter_query.filter(Sensor.column_name == col_name).first()
#         sensor_val = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)
#
#         ands = []
#         for filter_detail in filter_details:
#             comp_ins = []
#             comp_likes = []
#             comp_regexps = []
#             cfg_filter_detail: CfgFilterDetail
#             for cfg_filter_detail in filter_detail.cfg_filter_details:
#                 val = cfg_filter_detail.filter_condition
#                 if cfg_filter_detail.filter_function == FilterFunc.REGEX.name:
#                     comp_regexps.append(val)
#                 elif (
#                         not cfg_filter_detail.filter_function
#                         or cfg_filter_detail.filter_function == FilterFunc.MATCHES.name
#                 ):
#                     comp_ins.append(val)
#                 else:
#                     comp_likes.extend(
#                         gen_sql_like_value(
#                             val,
#                             FilterFunc[cfg_filter_detail.filter_function],
#                             position=cfg_filter_detail.filter_from_pos,
#                         )
#                     )
#
#             ands.append(
#                 or_(
#                     sensor_val.value.in_(comp_ins),
#                     *[sensor_val.value.op(SQL_REGEXP_FUNC)(val) for val in comp_regexps if val is not None],
#                     *[sensor_val.value.like(val) for val in comp_likes if val is not None],
#                 )
#             )
#
#         data = data.join(
#             sensor_val,
#             and_(
#                 sensor_val.cycle_id == cycle_cls.id,
#                 sensor_val.sensor_id == sensor.id,
#                 *ands,
#             ),
#         )
#
#     # chunk
#     if start_relate_ids:
#         records = []
#         for ids in start_relate_ids:
#             temp = data.filter(cycle_cls.global_id.in_(ids))
#             records += temp.all()
#     else:
#         data = data.filter(cycle_cls.time >= start_tm)
#         data = data.filter(cycle_cls.time < end_tm)
#         records = data.all()
#
#     return records


@log_execution_time()
@abort_process_handler()
def order_end_proc_sensor(orig_graph_param: DicParam):
    dic_orders = {}
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        dic_card_orders = orig_graph_param.dic_card_orders
        orders = dic_card_orders[proc_id] if proc in dic_card_orders else '{}'
        orders = json.loads(orders)
        if orders:
            dic_orders[proc_id] = orders

    lst_proc_end_col = []
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        for col_id in proc.col_ids:
            if col_id in orig_graph_param.common.sensor_cols:
                proc_order = dic_orders.get(proc_id) or {}
                order = proc_order.get(str(col_id)) or 999
                lst_proc_end_col.append((proc_id, col_id, order))

    return sorted(lst_proc_end_col, key=lambda x: x[-1])


@log_execution_time()
@MessageAnnouncer.notify_progress(50)
def gen_plotdata(orig_graph_param: DicParam, dic_data, dic_proc_cfg, df=None):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param)

    plotdatas = []
    array_formval = []
    category_cols = []
    category_cols_details = []
    inf_idx = []
    m_inf_idx = []
    cast_inf_vals = False
    for proc_id, col_id, _ in lst_proc_end_col:
        col_detail = {}
        rank_value = {}
        col_cfg = dic_proc_cfg[proc_id].get_col(col_id)
        array_y = dic_data[proc_id][col_id]
        org_array_y = []
        categorized_data = []

        if col_cfg:
            # if get_cols[0].data_type == DataType.TEXT.name and len(array_y_without_na):
            is_categorical_sensor = col_cfg.is_category
            if is_categorical_sensor:
                cat_array_y = pd.Series(array_y).astype('category').cat
                na_vals = pd.Series(array_y).isnull().sum()
                array_y = cat_array_y.codes.tolist()

                rank_value = {-1: NA_STR}
                if len(cat_array_y.categories.to_list()):
                    rank_value = dict(enumerate(cat_array_y.categories))

                if na_vals:
                    rank_value[-1] = NA_STR

                category_cols.append(col_cfg.id)

                org_array_y = dic_data[proc_id][col_id]

            inf_idx = list(np.where(np.array(array_y) == float('inf'))[0])
            m_inf_idx = list(np.where(np.array(array_y) == float('-inf'))[0])
            if inf_idx or m_inf_idx:
                cast_inf_vals = True
            col_detail = {
                'col_id': col_id,
                'col_shown_name': col_cfg.shown_name,
                'col_en_name': col_cfg.name_en,
                'data_type': col_cfg.data_type,
                'proc_id': proc_id,
                'proc_shown_name': dic_proc_cfg[proc_id].shown_name,
                'proc_en_name': dic_proc_cfg[proc_id].name_en or to_romaji(dic_proc_cfg[proc_id].name),
                'is_category': is_categorical_sensor,
                'is_checked': is_nominal_check(col_id, orig_graph_param),
                'data_group_type': col_cfg.column_type,
                'is_int_category': col_cfg.is_int_category,
            }

            if is_categorical_sensor:
                category_cols_details.append(col_detail)

            col_name_label = gen_sql_label(col_id, col_cfg.column_name) + CATEGORIZED_SUFFIX
            if not is_categorical_sensor and df is not None and col_name_label in df.columns:
                categorized_data = df[col_name_label].tolist()

        plotdata = {
            'array_y': array_y,
            'col_detail': col_detail,
            'rank_value': rank_value,
            'end_col_id': col_id,
            'org_array_y': org_array_y,
            'inf_idx': inf_idx,
            'm_inf_idx': m_inf_idx,
            'categorized_data': categorized_data,
        }
        plotdatas.append(plotdata)

        array_formval.append({END_PROC: proc_id, GET02_VALS_SELECT: col_id})

    return array_formval, plotdatas, category_cols, category_cols_details, cast_inf_vals
