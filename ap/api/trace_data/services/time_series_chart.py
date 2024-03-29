import itertools
import json
import re
import traceback
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime
from itertools import groupby
from math import ceil
from typing import Dict, List

import numpy as np
import pandas as pd
from numpy import quantile
from pandas import DataFrame, Series
from sqlalchemy import and_

from ap import db, dic_request_info
from ap.api.common.services.services import convert_datetime_to_ct, get_filter_on_demand_data
from ap.api.trace_data.services.proc_link import TraceGraph
from ap.api.trace_data.services.regex_infinity import (
    check_validate_target_column,
    get_changed_value_after_validate,
    validate_data_with_regex,
    validate_data_with_simple_searching,
)
from ap.common.common_utils import (
    add_days,
    as_list,
    chunk_two_list,
    chunks,
    convert_time,
    end_of_minute,
    gen_abbr_name,
    gen_sql_label,
    gen_sql_like_value,
    get_debug_data,
    sql_regexp,
    start_of_minute,
)
from ap.common.constants import *
from ap.common.logger import log_execution_time, logger
from ap.common.memoize import memoize
from ap.common.pydn.dblib.db_common import PARAM_SYMBOL, gen_select_col_str
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.ana_inf_data import calculate_kde_trace_data, detect_abnormal_count_values
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import notify_progress
from ap.common.services.statistics import calc_summaries, convert_series_to_number, get_mode
from ap.common.sigificant_digit import get_fmt_from_array, signify_digit
from ap.common.trace_data_log import (
    EventAction,
    EventType,
    Target,
    TraceErrKey,
    save_df_to_file,
    trace_log,
)
from ap.setting_module.models import (
    CfgConstant,
    CfgFilter,
    CfgFilterDetail,
    CfgProcess,
    CfgProcessColumn,
    CfgTrace,
    CfgVisualization,
)
from ap.trace_data.models import (
    Cycle,
    ProcLink,
    Sensor,
    SensorType,
    find_cycle_class,
    find_sensor_class,
)
from ap.trace_data.schemas import CategoryProc, ConditionProc, DicParam, EndProc


@log_execution_time('[TRACE DATA]')
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.FPP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True)
def gen_graph_fpp(dic_param, max_graph=None):
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        temp_serial_column,
        temp_serial_order,
        temp_serial_process,
        temp_x_option,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    dic_param, df, orig_graph_param, graph_param, graph_param_with_cate = gen_df(
        dic_param, dic_cat_filters, use_expired_cache=use_expired_cache
    )

    convert_datetime_to_ct(df, graph_param)

    # use for enable and disable index columns
    all_procs = []
    all_cols = []
    for proc in graph_param.array_formval:
        all_procs.append(proc.proc_id)
        all_cols.extend(proc.col_ids)

    dic_param[COMMON][DF_ALL_PROCS] = all_procs
    dic_param[COMMON][DF_ALL_COLUMNS] = all_cols

    if cat_exp:
        for i, val in enumerate(cat_exp):
            dic_param[COMMON][f'{CAT_EXP_BOX}{i + 1}'] = val
    if cat_procs:
        dic_param[COMMON][CATE_PROCS] = cat_procs

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # order index with other param
    df, dic_param = sort_df_by_x_option(
        df,
        dic_param,
        graph_param,
        dic_proc_cfgs,
        temp_x_option,
        temp_serial_process,
        temp_serial_column,
        temp_serial_order,
    )

    graph_param = bind_dic_param_to_class(dic_param)

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param, True)

    dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, graph_param.common.cate_col_ids, True)

    # reset index (keep sorted position)
    df.reset_index(inplace=True, drop=True)

    str_cols = dic_param.get(STRING_COL_IDS)
    dic_str_cols = get_str_cols_in_end_procs(dic_proc_cfgs, graph_param)
    dic_ranks = gen_before_rank_dict(df, dic_str_cols)
    dic_data, is_graph_limited = gen_dic_data(df, graph_param, graph_param_with_cate, max_graph)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited

    is_thin_data = False
    # 4000 chunks x 3 values(min,median,max)
    dic_thin_param = None
    if len(df) > THIN_DATA_COUNT:
        is_thin_data = True
        dic_thin_param = deepcopy(dic_param)

    dic_param = gen_dic_param(df, dic_param, dic_data, dic_proc_cfgs)
    gen_dic_serial_data_from_df(df, dic_proc_cfgs, dic_param)

    # calculate_summaries
    calc_summaries(dic_param)

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(
        dic_param.get(ARRAY_PLOTDATA, []), str_cols
    )

    # get min max order columns
    output_orders = []
    x_option = graph_param.common.x_option
    if x_option == 'INDEX' and graph_param.common.serial_columns:
        group_col = '__group_col__'
        dic_cfg_cols = {
            cfg_col.id: cfg_col
            for cfg_col in CfgProcessColumn.get_by_ids(graph_param.common.serial_columns)
        }
        dic_order_cols = {}
        for order_col_id in graph_param.common.serial_columns:
            cfg_col = dic_cfg_cols.get(order_col_id)
            if not cfg_col:
                continue

            sql_label = gen_sql_label(RANK_COL, cfg_col.id, cfg_col.column_name)
            if sql_label not in df.columns:
                sql_label = gen_sql_label(cfg_col.id, cfg_col.column_name)
                if sql_label not in df.columns:
                    continue

            dic_order_cols[sql_label] = cfg_col

        df_order = df[dic_order_cols]
        if is_thin_data:
            count_per_group = ceil(len(df_order) / THIN_DATA_CHUNK)
            df_order[group_col] = df_order.index // count_per_group
            df_order = df_order.dropna().groupby(group_col).agg(['min', 'max'])
            for sql_label, col in dic_order_cols.items():
                output_orders.append(
                    dict(
                        name=col.shown_name,
                        min=df_order[(sql_label, 'min')].tolist(),
                        max=df_order[(sql_label, 'max')].tolist(),
                        id=col.id,
                    )
                )
        else:
            for sql_label, col in dic_order_cols.items():
                output_orders.append(
                    dict(name=col.shown_name, value=df_order[sql_label].tolist(), id=col.id)
                )

    full_arrays = None
    if is_thin_data:
        full_arrays = make_str_full_array_y(dic_param)
        list_summaries = get_summary_infos(dic_param)
        dic_cat_exp_labels = None
        if graph_param.common.cat_exp:
            df, dic_cat_exp_labels = gen_thin_df_cat_exp(dic_param)
        else:
            add_serials_to_thin_df(dic_param, df)

        copy_dic_param_to_thin_dic_param(dic_param, dic_thin_param)
        dic_param = gen_thin_dic_param(
            df, dic_thin_param, dic_proc_cfgs, dic_cat_exp_labels, dic_ranks
        )
        dic_param['is_thin_data'] = is_thin_data

        for i, plot in enumerate(dic_param[ARRAY_PLOTDATA]):
            plot[SUMMARIES] = list_summaries[i]
    else:
        dic_param = gen_category_info(dic_param, dic_ranks)
    set_str_rank_to_dic_param(dic_param, dic_ranks, dic_str_cols, full_arrays)
    set_str_category_data(dic_param, dic_ranks)

    calc_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max, str_cols)

    # kde
    gen_kde_data_trace_data(dic_param, full_arrays)

    # add unique category values
    for dic_cate in dic_param.get(CATEGORY_DATA) or []:
        col_id = dic_cate['column_id']
        dic_cate[UNIQUE_CATEGORIES] = (
            dic_unique_cate[col_id][UNIQUE_CATEGORIES] if dic_unique_cate.get(col_id) else []
        )
        if len(set(dic_cate.get('data', []))) > CAT_UNIQUE_LIMIT:
            dic_cate[IS_OVER_UNIQUE_LIMIT] = True
        else:
            dic_cate[IS_OVER_UNIQUE_LIMIT] = False

    # dic_param[CAT_EXP_BOX] = cat_exp_list
    dic_param[INDEX_ORDER_COLS] = output_orders
    dic_param['proc_name'] = {k: proc.shown_name for (k, proc) in dic_proc_cfgs.items()}

    # get order column data
    retrieve_order_setting(dic_param, dic_proc_cfgs)

    dic_param = get_filter_on_demand_data(dic_param, remove_filter_data=True)

    return dic_param


def gen_group_filter_list(df, graph_param, dic_param, others=[]):
    LIMIT = 100_000
    if df.empty:
        return dic_param
    cate_col_ids = []
    for proc in graph_param.common.cate_procs or []:
        cate_col_ids += proc.col_ids

    filter_cols = sorted(list(set(cate_col_ids + graph_param.common.cat_exp + others)))
    filter_sensors = CfgProcessColumn.get_by_ids(filter_cols)
    filter_labels = []
    actual_filter_cols = []
    for col in filter_sensors:
        sql_label = gen_sql_label(RANK_COL, col.id, col.column_name)
        if sql_label not in df.columns:
            sql_label = gen_sql_label(col.id, col.column_name)
        if sql_label in df.columns and df[sql_label].value_counts().size <= LIMIT:
            filter_labels.append(sql_label)
            actual_filter_cols.append(col.id)

    if len(filter_labels) <= 1:
        return dic_param

    group_list = list(df.groupby(filter_labels).groups.keys())

    sorted_filter_cols = [col.id for col in filter_sensors if col.id in actual_filter_cols]

    group_df = pd.DataFrame(columns=sorted_filter_cols, data=group_list)
    dic_filter = {}
    for col in sorted_filter_cols:
        dic_filter[col] = {}
        gr = group_df.groupby([col])
        gr_keys = list(gr.groups.keys())
        for key in gr_keys:
            dic_filter[col][key] = {}
            gr_value = gr.get_group(key)
            for sub_key in gr_value.columns:
                if sub_key != col:
                    dic_filter[col][key][sub_key] = list(set(gr_value[sub_key].to_list()))

    dic_param['dic_filter'] = dic_filter

    return dic_param


def customize_dic_param_for_reuse_cache(dic_param):
    use_expired_cache = False
    for name in (
        DIC_CAT_FILTERS,
        TEMP_CAT_EXP,
        TEMP_CAT_PROCS,
        TEMP_X_OPTION,
        TEMP_SERIAL_PROCESS,
        TEMP_SERIAL_COLUMN,
        TEMP_SERIAL_ORDER,
        MATRIX_COL,
        COLOR_ORDER,
    ):
        if name in dic_param[COMMON]:
            use_expired_cache = True
            break
    dic_cat_filters = (
        json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {}))
        if isinstance(dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str)
        else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
    )
    cat_exp = [int(id) for id in dic_param[COMMON].get(TEMP_CAT_EXP, []) if id]
    cat_procs = dic_param[COMMON].get(TEMP_CAT_PROCS, [])
    for name in (DIC_CAT_FILTERS, TEMP_CAT_EXP, TEMP_CAT_PROCS):
        if name in dic_param[COMMON]:
            dic_param[COMMON].pop(name)
    (
        dic_param,
        temp_x_option,
        temp_serial_process,
        temp_serial_column,
        temp_serial_order,
    ) = prepare_temp_x_option(dic_param)

    matrix_col = dic_param[COMMON].get(MATRIX_COL)
    if matrix_col and isinstance(matrix_col, (list, tuple)):
        matrix_col = matrix_col[0]

    if matrix_col:
        matrix_col = int(matrix_col)

    # set default for color order ( default : data value )
    color_order = dic_param[COMMON].get(COLOR_ORDER)
    if color_order:
        color_order = ColorOrder(int(color_order))
    else:
        color_order = ColorOrder.DATA

    return (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        temp_serial_column,
        temp_serial_order,
        temp_serial_process,
        temp_x_option,
        matrix_col,
        color_order,
    )


def filter_cat_dict_common(
    df, dic_param, cat_exp, cat_procs, graph_param, has_na=False, label_col_id=None
):
    """
        filter cat_exp_box function common
    :param df:
    :param dic_param;
    :param cat_exp:
    :param cat_procs:
    :param graph_param:
    :param has_na:
    :return:
    """
    if COMMON in dic_param:
        if cat_exp:
            for i, val in enumerate(cat_exp):
                cat_label = f'{CAT_EXP_BOX}{i + 1}'
                if cat_label in dic_param[COMMON]:
                    dic_param[COMMON][cat_label] = val
        if cat_procs:
            dic_param[COMMON][CATE_PROCS] = cat_procs

    dic_param = gen_cat_label_unique(df, dic_param, graph_param, has_na, label_col_id)

    return dic_param


def gen_cat_label_unique(df, dic_param, graph_param, has_na=False, label_col_id=None):
    # get list cat_exp_box
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    cat_and_div = []
    if DIV_BY_CAT in dic_param[COMMON]:
        if dic_param[COMMON][DIV_BY_CAT]:
            cat_and_div.append(int(dic_param[COMMON][DIV_BY_CAT]))

    cat_and_div += graph_param.common.cat_exp
    cat_exp_list = gen_unique_data(df, dic_proc_cfgs, cat_and_div, has_na)
    dic_param[CAT_EXP_BOX] = list(cat_exp_list.values())

    color_vals = []
    if graph_param.common.color_var:
        color_vals.append(graph_param.common.color_var)
    if graph_param.common.agp_color_vars:
        agp_color_vals = list(
            set(int(color) for color in graph_param.common.agp_color_vars.values())
        )
        color_vals += agp_color_vals

    exclude_col_id = cat_and_div
    exclude_col_id += label_col_id or graph_param.common.cate_col_ids

    exclude_col_id += color_vals

    sensor_ids = [col for col in graph_param.common.sensor_cols if col not in exclude_col_id]
    dic_param[CAT_ON_DEMAND] = list(gen_unique_data(df, dic_proc_cfgs, sensor_ids, True).values())
    dic_param[UNIQUE_COLOR] = list(gen_unique_data(df, dic_proc_cfgs, color_vals, False).values())
    dic_param[FILTER_DATA] = list(
        gen_unique_data(df, dic_proc_cfgs, graph_param.common.cate_col_ids, True).values()
    )

    dic_param = gen_group_filter_list(df, graph_param, dic_param)

    return dic_param


@notify_progress(60)
def gen_graph(dic_param, max_graph=None, use_export_df=False):
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)
    dic_param, df, orig_graph_param, graph_param, graph_param_with_cate = gen_df(
        dic_param, dic_cat_filters, add_dt_col=True, use_expired_cache=use_expired_cache
    )

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param)

    export_df = df.copy()
    convert_datetime_to_ct(df, graph_param)
    dic_data, is_graph_limited = gen_dic_data(
        df, orig_graph_param, graph_param_with_cate, max_graph
    )
    dic_param = gen_dic_param(df, dic_param, dic_data)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited

    if use_export_df:
        return dic_param, export_df, graph_param
    return dic_param


@log_execution_time()
def gen_dic_data(df, orig_graph_param, graph_param_with_cate, max_graph=None):
    # create output data
    cat_exp_cols = orig_graph_param.common.cat_exp
    is_graph_limited = False
    if cat_exp_cols:
        dic_cfg_cat_exps = {
            cfg_col.id: cfg_col for cfg_col in CfgProcessColumn.get_by_ids(cat_exp_cols)
        }
        dic_data, is_graph_limited = gen_dic_data_cat_exp_from_df(
            df, orig_graph_param, dic_cfg_cat_exps, max_graph
        )
        dic_cates = defaultdict(dict)
        for proc in orig_graph_param.common.cate_procs:
            for col_id, col_name in zip(proc.col_ids, proc.col_names):
                sql_label = gen_sql_label(col_id, col_name)
                dic_cates[proc.proc_id][col_id] = (
                    df[sql_label].tolist() if sql_label in df.columns else []
                )

        dic_data[CATEGORY_DATA] = dic_cates
    else:
        dic_data = gen_dic_data_from_df(df, graph_param_with_cate, cat_exp_mode=True)

    return dic_data, is_graph_limited


def prepare_temp_x_option(dic_param):
    params = [TEMP_X_OPTION, TEMP_SERIAL_PROCESS, TEMP_SERIAL_COLUMN, TEMP_SERIAL_ORDER]
    temp_x_option = dic_param[COMMON].get(TEMP_X_OPTION, '')
    temp_serial_process = as_list(dic_param[COMMON].get(TEMP_SERIAL_PROCESS))
    temp_serial_column = as_list(dic_param[COMMON].get(TEMP_SERIAL_COLUMN))
    temp_serial_order = as_list(dic_param[COMMON].get(TEMP_SERIAL_ORDER))

    for param in params:
        if param in dic_param[COMMON]:
            dic_param[COMMON].pop(param)

    return dic_param, temp_x_option, temp_serial_process, temp_serial_column, temp_serial_order


@log_execution_time()
@abort_process_handler()
def gen_df(dic_param, dic_filter=None, add_dt_col=False, use_expired_cache=False):
    """tracing data to show graph
    1 start point x n end point
    filter by condition point
    """
    # bind dic_param
    orig_graph_param = bind_dic_param_to_class(dic_param)
    # cat_exp_col = orig_graph_param.common.cat_exp

    graph_param_with_cate = bind_dic_param_to_class(dic_param)
    graph_param_with_cate.add_cate_procs_to_array_formval()

    graph_param = bind_dic_param_to_class(dic_param)

    # add start proc
    # graph_param.add_start_proc_to_array_formval()

    # add condition procs
    # graph_param.add_cond_procs_to_array_formval()

    # add category
    # if cat_exp_col:
    #     graph_param.add_cat_exp_to_array_formval()

    # graph_param.add_cate_procs_to_array_formval()

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # get serials
    # for proc in graph_param.array_formval:
    #     proc_cfg = dic_proc_cfgs[proc.proc_id]
    #     serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
    #     proc.add_cols(serial_ids)
    if add_dt_col:
        for proc in graph_param.array_formval:
            proc_cfg = dic_proc_cfgs[proc.proc_id]
            get_date = proc_cfg.get_date_col(column_name_only=False).id
            proc.add_cols(get_date, append_first=True)

    # get order columns
    if graph_param.common.x_option == 'INDEX':
        for proc_id, col_id in zip(
            graph_param.common.serial_processes, graph_param.common.serial_columns
        ):
            if proc_id and col_id:
                proc_id = int(proc_id)
                col_id = int(col_id)
                graph_param.add_proc_to_array_formval(proc_id, col_id)

    # get data from database
    df, actual_record_number, unique_serial = get_data_from_db(
        graph_param, dic_filter, use_expired_cache=use_expired_cache
    )

    # string columns
    df, str_cols = rank_str_cols(df, dic_proc_cfgs, orig_graph_param)
    dic_param[STRING_COL_IDS] = str_cols
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

    # apply coef for text
    df = apply_coef_text(df, graph_param_with_cate, dic_proc_cfgs)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = int(df.memory_usage(deep=True).sum())
    dic_param[UNIQUE_SERIAL] = unique_serial
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    return dic_param, df, orig_graph_param, graph_param, graph_param_with_cate


@log_execution_time()
@abort_process_handler()
def gen_dic_param(
    df,
    dic_param,
    dic_data,
    dic_proc_cfgs=None,
    dic_cates=None,
    dic_org_cates=None,
    is_get_chart_infos=True,
):
    if df is None or not len(df):
        dic_param[ARRAY_PLOTDATA] = []
        return dic_param

    graph_param = bind_dic_param_to_class(dic_param)
    if not dic_proc_cfgs:
        dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    times = df[Cycle.time.key].tolist() or []
    if times and str(times[0])[-1].upper() != 'Z':
        times = [convert_time(tm) for tm in times if tm]

    # get chart infos
    chart_infos = None
    original_graph_configs = None
    if is_get_chart_infos:
        chart_infos, original_graph_configs = get_chart_infos(graph_param, dic_data, times)

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] = gen_plotdata_fpp(
        graph_param, dic_data, chart_infos, original_graph_configs
    )
    dic_param[CATEGORY_DATA] = gen_category_data(
        dic_proc_cfgs, graph_param, dic_cates or dic_data, dic_org_cates
    )
    dic_param[TIMES] = times

    if Cycle.id.key in df.columns:
        dic_param[CYCLE_IDS] = df.id.tolist()

    return dic_param


@log_execution_time()
def rank_str_cols(df: DataFrame, dic_proc_cfgs, graph_param: DicParam):
    dic_str_cols = get_str_cols_in_end_procs(dic_proc_cfgs, graph_param)
    str_cols = []
    sensors = graph_param.common.sensor_cols
    for sql_label, (before_rank_label, _, col_id, _, _) in dic_str_cols.items():
        if sql_label not in df.columns:
            continue

        if str(col_id) == str(graph_param.common.judge_var) and col_id not in sensors:
            # if sensor is judge_var but not target sensor
            continue

        df[before_rank_label] = df[sql_label]
        df[sql_label] = np.where(
            df[sql_label].isnull(), df[sql_label], df[sql_label].astype('category').cat.codes + 1
        )

        df[sql_label] = df[sql_label].convert_dtypes()
        str_cols.append(col_id)

    return df, str_cols


@log_execution_time()
def get_str_cols_in_end_procs(dic_proc_cfgs, graph_param: DicParam):
    dic_output = {}
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        dic_cols = {col.id: col for col in proc_cfg.get_cols_by_data_type(DataType.TEXT, False)}
        for col_id, col_name, show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            cfg_col = dic_cols.get(col_id)
            if cfg_col is None:
                continue

            rank_col_name = gen_sql_label(col_id, col_name)
            before_rank_col_name = gen_sql_label(RANK_COL, rank_col_name)
            dic_output[rank_col_name] = (
                before_rank_col_name,
                proc.proc_id,
                col_id,
                col_name,
                show_name,
            )

    return dic_output


@log_execution_time()
def gen_before_rank_dict(df: DataFrame, dic_str_cols):
    dic_output = {}
    for sql_label, (before_rank_label, _, col_id, _, _) in dic_str_cols.items():
        if before_rank_label in df.columns:
            df_rank = df[[sql_label, before_rank_label]].drop_duplicates().dropna()
            dic_output[col_id] = dict(zip(df_rank[sql_label], df_rank[before_rank_label]))

    return dic_output


@log_execution_time()
def get_org_rank(dic_ranks, dic_str_cols):
    origin_ranks = {}
    for i, (_, _, col_id, col_name, show_name) in dic_str_cols.items():
        if col_id in dic_ranks:
            ranks = {}
            # convert key to string
            for r in dic_ranks[col_id]:
                ranks[str(r)] = dic_ranks[col_id][r]
            origin_ranks[show_name] = ranks
    return origin_ranks


@log_execution_time()
def cat_exp_box_to_org_name(plot, org_rank, is_stp=False):
    if CAT_EXP_BOX in plot:
        cat_exp_box = plot[CAT_EXP_BOX]
        if type(cat_exp_box) is tuple:
            cat_exp_box = list(cat_exp_box)
        if type(cat_exp_box) is int:
            cat_exp_box = [cat_exp_box]
        if is_stp and type(cat_exp_box) is str:
            cat_exp_box = [cat_box for cat_box in cat_exp_box.split(' | ')]

        if type(cat_exp_box) is not list:
            cat_exp_box = [cat_exp_box]

        for i, name in enumerate(plot[CAT_EXP_BOX_NAME]):
            cat_box_id = str(cat_exp_box[i])
            if name in org_rank and cat_box_id in org_rank[name]:
                cat_exp_box[i] = org_rank[name][cat_box_id]

        #  reassign cat_exp_box
        if is_stp:
            if type(cat_exp_box) is list:
                cat_exp_box = [str(cat_box) for cat_box in cat_exp_box]
                cat_exp_box = ' | '.join(cat_exp_box)
        else:
            cat_exp_box = tuple(cat_exp_box)
        plot[CAT_EXP_BOX] = cat_exp_box


@log_execution_time()
def gen_ranking_to_dic_param(sensor_dat, dic_full_array_y, dic_ranks, org_ranks, is_stp=False):
    for i, plot in enumerate(sensor_dat):
        cat_exp_box_to_org_name(plot, org_ranks, is_stp)

        col_id = plot.get(END_COL_ID) if not is_stp else plot.get(END_COL)
        dic_col_ranks = dic_ranks.get(col_id)
        if not dic_col_ranks:
            continue

        if is_stp:
            # category variable
            p_array_y = pd.Series(plot[ARRAY_Y]).dropna().tolist()
            cat_size = 0
            if len(p_array_y):
                cat_size = np.unique(p_array_y).size
            plot[CAT_TOTAL] = cat_size
            plot[IS_CAT_LIMITED] = True if len(dic_col_ranks.keys()) >= MAX_CATEGORY_SHOW else False

        # enc col (show graph)
        # plot[ARRAY_Y] = reduce_stepped_chart_data(plot.get(ARRAY_Y))
        plot[ARRAY_Y_MIN] = None
        plot[ARRAY_Y_MAX] = None

        category_distributed = {}
        full_dat = dic_full_array_y[i] if dic_full_array_y else plot.get(ARRAY_Y)
        none_idxs = plot.get(NONE_IDXS)
        total_counts = 0

        dic_cat_counter = Counter(full_dat)
        dic_cat_counter = {
            key: dic_cat_counter[key] for key in list(dic_cat_counter.keys())[:MAX_CATEGORY_SHOW]
        }
        ranks = []
        before_ranks = []
        for rank_val, cat_count in dic_cat_counter.items():
            if rank_val is None:
                continue

            cat_name = dic_col_ranks.get(rank_val)
            if cat_name is None:
                continue

            ranks.append(rank_val)
            before_ranks.append(cat_name)

            short_name = gen_abbr_name(cat_name)
            category_distributed[cat_name] = {
                'counts': cat_count,
                'short_name': short_name,
                'counts_org': cat_count,
                'pctg': 0,
            }
            total_counts += cat_count

        plot[RANK_COL] = [ranks, before_ranks]

        for k, cat in category_distributed.items():
            cat_dist = signify_digit(cat['counts'] * 100 / total_counts) if total_counts else 0
            category_distributed[k]['pctg'] = cat_dist
            category_distributed[k]['counts'] = '{} ({}%)'.format(cat['counts'], cat_dist)

        # show end col summary info
        series = pd.Series(full_dat)
        if none_idxs is None:
            pass
        else:
            if none_idxs:
                series = series[(series.notnull()) | (series.index.isin(none_idxs))]
            else:
                series.dropna(inplace=True)

        n_total = len(series)
        non_na_count = len(series.dropna())
        na_count = n_total - non_na_count

        step_chart_summary = {
            N_TOTAL: n_total,
            N: non_na_count,
            N_PCTG: signify_digit(100 * non_na_count / n_total) if n_total else 0,
            N_NA: na_count,
            N_NA_PCTG: signify_digit(100 * na_count / n_total) if n_total else 0,
        }
        plot[CAT_DISTRIBUTE] = category_distributed
        plot[CAT_SUMMARY] = step_chart_summary


@log_execution_time()
def set_str_rank_to_dic_param(
    dic_param, dic_ranks, dic_str_cols, dic_full_array_y=None, is_stp=False
):
    plotdata = dic_param[ARRAY_PLOTDATA]
    org_ranks = get_org_rank(dic_ranks, dic_str_cols)
    if not is_stp or type(plotdata) is list:
        gen_ranking_to_dic_param(plotdata, dic_full_array_y, dic_ranks, org_ranks, is_stp)
    else:
        for sensor_id, sensor_dat in plotdata.items():
            gen_ranking_to_dic_param(sensor_dat, dic_full_array_y, dic_ranks, org_ranks, is_stp)


@log_execution_time()
def set_str_category_data(dic_param, dic_ranks):
    for dic_cate in dic_param.get(CATEGORY_DATA, []):
        col_id = dic_cate.get('column_id')
        if col_id not in dic_ranks:
            continue

        dic_cate['data'] = pd.Series(dic_cate.get('data')).map(dic_ranks[col_id]).tolist()


@log_execution_time()
def gen_thin_dic_param(df, dic_param, dic_proc_cfgs, dic_cat_exp_labels=None, dic_ranks=None):
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)
    dic_datetime_serial_cols = get_serials_and_date_col(graph_param, dic_proc_cfgs)
    dic_str_cols = get_str_cols_in_end_procs(dic_proc_cfgs, graph_param)
    (
        df_thin,
        dic_cates,
        dic_org_cates,
        group_counts,
        df_from_to_count,
        dic_min_med_max,
    ) = reduce_data(df, graph_param, dic_str_cols)

    # create output data
    df_cat_exp = gen_df_thin_values(
        df, graph_param, df_thin, dic_str_cols, df_from_to_count, dic_min_med_max
    )
    dic_data = gen_dic_data_from_df(
        df_cat_exp,
        graph_param,
        cat_exp_mode=True,
        dic_cat_exp_labels=dic_cat_exp_labels,
        calculate_cycle_time=False,
    )
    dic_param = gen_dic_param(
        df_cat_exp,
        dic_param,
        dic_data,
        dic_proc_cfgs,
        dic_cates,
        dic_org_cates,
        is_get_chart_infos=False,
    )
    gen_dic_serial_data_from_df_thin(df_cat_exp, dic_param, dic_datetime_serial_cols, dic_ranks)

    # get start proc time
    start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
    threshold_filter_detail_ids = graph_param.common.threshold_boxes

    # gen min max for thin data
    for plot in dic_param[ARRAY_PLOTDATA]:
        sql_label = gen_sql_label(plot[END_COL_ID], plot[END_COL_NAME], plot.get(CAT_EXP_BOX))
        time_label = gen_sql_label(TIMES, sql_label)
        min_label = gen_sql_label(ARRAY_Y_MIN, sql_label)
        max_label = gen_sql_label(ARRAY_Y_MAX, sql_label)
        cycle_label = gen_sql_label(CYCLE_IDS, sql_label)
        sql_label_from = gen_sql_label(SLOT_FROM, sql_label)
        sql_label_to = gen_sql_label(SLOT_TO, sql_label)
        sql_label_count = gen_sql_label(SLOT_COUNT, sql_label)

        if time_label in df_cat_exp.columns:
            plot[ARRAY_X] = df_cat_exp[time_label].replace({np.nan: None}).tolist()
            # get chart infos
            plot[CHART_INFOS_ORG], plot[CHART_INFOS] = get_chart_info_detail(
                plot[ARRAY_X],
                plot[END_COL_ID],
                threshold_filter_detail_ids,
                plot[END_PROC_ID],
                graph_param.common.start_proc,
                start_tm,
                end_tm,
                dic_param[TIMES],
            )

        if min_label in df_cat_exp.columns:
            plot[ARRAY_Y_MIN] = (
                df_cat_exp[min_label]
                .replace({pd.NA: 'NA', float('inf'): 'inf', float('-inf'): '-inf', np.nan: 'NA'})
                .tolist()
            )

        if max_label in df_cat_exp.columns:
            plot[ARRAY_Y_MAX] = (
                df_cat_exp[max_label]
                .replace({pd.NA: 'NA', float('inf'): 'inf', float('-inf'): '-inf', np.nan: 'NA'})
                .tolist()
            )

        if cycle_label in df_cat_exp.columns:
            plot[CYCLE_IDS] = df_cat_exp[cycle_label].tolist()

        if sql_label_from in df_cat_exp.columns:
            plot[SLOT_FROM] = df_cat_exp[sql_label_from].tolist()

        if sql_label_to in df_cat_exp.columns:
            plot[SLOT_TO] = df_cat_exp[sql_label_to].tolist()

        if sql_label_count in df_cat_exp.columns:
            plot[SLOT_COUNT] = df_cat_exp[sql_label_count].tolist()

        if plot[END_COL_ID] in dic_ranks:
            # category variable
            p_array_y = pd.Series(plot[ARRAY_Y]).dropna().tolist()
            cat_size = 0
            if len(p_array_y):
                cat_size = np.unique(p_array_y).size
            plot[CAT_TOTAL] = cat_size
            plot[IS_CAT_LIMITED] = True if cat_size >= MAX_CATEGORY_SHOW else False

        plot[NONE_IDXS] = None

    # group count
    dic_param[THIN_DATA_GROUP_COUNT] = group_counts

    return dic_param


def make_str_full_array_y(dic_param):
    return [plot[ARRAY_Y] for plot in dic_param[ARRAY_PLOTDATA]]


def get_summary_infos(dic_param):
    return [plot[SUMMARIES] for plot in dic_param[ARRAY_PLOTDATA]]


@log_execution_time()
def check_and_order_data(
    df, dic_proc_cfgs, x_option='TIME', serial_processes=[], serial_cols=[], serial_orders=[]
):
    if df is None or not len(df):
        return df

    if x_option.upper() == 'TIME':
        df = df.sort_values(Cycle.time.key, ascending=True)
        return df

    cols = []
    orders = []
    for proc_id, col_id, order in zip(serial_processes, serial_cols, serial_orders):
        if not proc_id or not col_id:
            continue

        proc_cfg: CfgProcess = dic_proc_cfgs.get(int(proc_id))
        if not proc_cfg:
            continue

        order_cols: List[CfgProcessColumn] = proc_cfg.get_order_cols(column_name_only=False)
        if not order_cols:
            continue

        dic_order_cols = {col.id: gen_sql_label(col.id, col.column_name) for col in order_cols}

        col_label = dic_order_cols.get(int(col_id))
        if col_label and col_label in df.columns and col_label not in cols:
            cols.append(dic_order_cols.get(int(col_id)))
            orders.append(bool(int(order)))

    if cols:
        df = df.sort_values(cols, ascending=orders)

    return df


def gen_blank_df_end_col(proc: EndProc, columns):
    dic_cols = {}
    for cfg_col in columns:
        if cfg_col.column_name not in proc.col_names:
            continue

        name = gen_sql_label(cfg_col.id, cfg_col.column_name)
        dic_cols[name] = []

    dic_cols.update({Cycle.id.key: [], Cycle.global_id.key: [], Cycle.time.key: []})
    return pd.DataFrame(dic_cols)


def gen_blank_df_end_cols(procs: List[EndProc]):
    params = dict()
    for proc in procs:
        params.update(
            {
                gen_sql_label(col_id, proc.col_names[idx]): []
                for idx, col_id in enumerate(proc.col_ids)
            }
        )
        params.update({'{}{}'.format(Cycle.time.key, create_rsuffix(proc.proc_id)): []})
    params.update({Cycle.id.key: [], Cycle.global_id.key: [], Cycle.time.key: []})

    df = pd.DataFrame(params)
    df = df.append(pd.Series(), ignore_index=True)
    return df.replace({np.nan: ''})


def gen_df_end(proc: EndProc, start_relate_ids=None, start_tm=None, end_tm=None):
    proc_id = proc.proc_id

    # get serials
    cfg_cols = CfgProcessColumn.get_all_columns(proc_id)
    serials = [col for col in cfg_cols if col.is_serial_no]
    serials = [gen_sql_label(serial.id, serial.column_name) for serial in serials]

    # get sensor values
    df_end = get_sensor_values(
        proc, start_relate_ids=start_relate_ids, start_tm=start_tm, end_tm=end_tm
    )
    if df_end.empty:
        df_end = gen_blank_df_end_col(proc, cfg_cols)

    # filter duplicate
    if df_end.columns.size:
        df_end = df_end[df_end.eval('global_id.notnull()')]

    # drop duplicate
    if df_end.columns.size and serials:
        cols = [col for col in serials if col in df_end.columns]
        if cols:
            df_end = df_end.drop_duplicates(subset=cols, keep='last')

    # set index
    if df_end.columns.size:
        df_end.set_index(Cycle.global_id.key, inplace=True)

    return df_end


def gen_df_end_same_with_start(
    proc: EndProc, start_proc_id, start_tm, end_tm, drop_duplicate=True, with_limit=None
):
    # proc_id = proc.proc_id

    # get serials
    serials = CfgProcessColumn.get_serials(start_proc_id)
    serials = [gen_sql_label(serial.id, serial.column_name) for serial in serials]

    # get sensor values
    df_end = get_sensor_values(
        proc, start_tm=start_tm, end_tm=end_tm, use_global_id=False, with_limit=with_limit
    )
    if df_end.empty:
        return pd.DataFrame()

    df_end.set_index(Cycle.id.key, inplace=True)

    # if only 1 proc, show all data without filter duplicate
    if drop_duplicate and len(serials):  # TODO ask PO
        cols = [col for col in serials if col in df_end.columns]
        if cols:
            df_end.drop_duplicates(subset=cols, keep='last', inplace=True)

    return df_end


def create_rsuffix(proc_id):
    return '_{}'.format(proc_id)


@log_execution_time()
@notify_progress(30)
def gen_graph_df(
    start_proc_id,
    start_tm,
    end_tm,
    end_procs: List[EndProc],
    cond_procs,
    duplicate_serial_show=None,
    duplicated_serial_count=None,
    _use_expired_cache=False,
):
    edges = CfgTrace.get_all()

    # graph object
    graph = TraceGraph(edges)
    common_paths, dic_end_proc_cols, short_procs = reduce_graph(end_procs, graph, start_proc_id)

    dic_mapping_col_n_sensor = {}
    dic_cfg_col_id_sensor = {}
    dic_sensor_id_cfg_col = {}
    serial_labels = []

    # get serials
    for proc in end_procs:
        dic_serials = {
            serial.id: serial.column_name for serial in CfgProcessColumn.get_serials(proc.proc_id)
        }
        for key, val in dic_serials.items():
            serial_labels.append(gen_sql_label(key, val))
        proc.add_cols(list(dic_serials), True)

    for proc_id in short_procs:
        _dic_col_name, _dic_cfg_col, _dic_sensor = gen_cfg_col_n_sensor_pair(proc_id)
        dic_mapping_col_n_sensor[proc_id] = _dic_col_name
        dic_cfg_col_id_sensor.update(_dic_cfg_col)
        dic_sensor_id_cfg_col.update(_dic_sensor)

    # condition information
    dic_conditions = defaultdict(list)
    for cond_proc in cond_procs:
        conds = get_cond_data(cond_proc, start_tm, end_tm, SQL_LIMIT)
        if conds:
            dic_conditions[cond_proc.proc_id].extend(conds)

    if len(short_procs) == 1:
        df, actual_total_record = gen_graph_df_one_proc(
            start_proc_id,
            start_tm,
            end_tm,
            dic_mapping_col_n_sensor,
            end_procs,
            short_procs,
            dic_conditions,
            duplicate_serial_show,
        )

        # count total record (with duplicate)
        duplicated_option, for_count = is_show_duplicated_serials(
            duplicate_serial_show, duplicated_serial_count, actual_total_record
        )
        unique_record_number = actual_total_record

        if for_count:
            _, actual_total_record = gen_graph_df_one_proc(
                start_proc_id,
                start_tm,
                end_tm,
                dic_mapping_col_n_sensor,
                end_procs,
                short_procs,
                dic_conditions,
                duplicated_option,
                for_count,
            )

    else:
        df, actual_total_record = gen_trace_procs_df(
            start_proc_id,
            start_tm,
            end_tm,
            graph,
            common_paths,
            short_procs,
            dic_mapping_col_n_sensor,
            dic_conditions,
            duplicate_serial_show,
        )

        # cycle id
        df[Cycle.id.key] = df.index

        # check empty
        if df is None or not len(df):
            return df, serial_labels, 0, 0

        unique_record_number = actual_total_record

        # select sensor values
        df_cols = df.columns
        for proc_id in df_cols:
            # ignore time, serial columns
            if not proc_id.isnumeric():
                continue

            col_info = dic_end_proc_cols.get(int(proc_id))
            if col_info is None:
                continue

            col_ids, col_names = col_info
            cycle_ids = df[[proc_id]].dropna().drop_duplicates().to_records(index=False).tolist()
            if not len(cycle_ids):
                continue

            df = gen_trace_sensors_df(
                col_ids, col_names, cycle_ids, df, dic_mapping_col_n_sensor, proc_id
            )

        # count total record (with duplicate)
        duplicated_option, for_count = is_show_duplicated_serials(
            duplicate_serial_show, duplicated_serial_count, actual_total_record
        )
        if for_count:
            _, actual_total_record = gen_trace_procs_df(
                start_proc_id,
                start_tm,
                end_tm,
                graph,
                common_paths,
                short_procs,
                dic_mapping_col_n_sensor,
                dic_conditions,
                duplicated_option,
                for_count=True,
            )

    if duplicated_option != DuplicateSerialShow.SHOW_BOTH:
        actual_total_record, unique_record_number = unique_record_number, actual_total_record

    return df, serial_labels, actual_total_record, unique_record_number


@log_execution_time()
def is_show_duplicated_serials(duplicate_serial_show, duplicated_serial_count, actual_total_record):
    for_count = True if actual_total_record <= THIN_DATA_COUNT else False

    if duplicated_serial_count == DuplicateSerialCount.CHECK:
        for_count = True
    if duplicated_serial_count == DuplicateSerialCount.SILENT:
        for_count = False

    if duplicate_serial_show == DuplicateSerialShow.SHOW_BOTH:
        duplicate_serial_show = DuplicateSerialShow.SHOW_FIRST
    else:
        duplicate_serial_show = DuplicateSerialShow.SHOW_BOTH

    return duplicate_serial_show, for_count


@log_execution_time()
def gen_serial_from_link_value(df, dic_sensor_id_cfg_col, dic_mapping_col_n_sensor):
    proc_link_first_cls = ProcLink.get_first_cls()
    link_val_col = proc_link_first_cls.link_value.key
    for col_name in df.columns:
        if str(col_name).startswith(link_val_col):
            link_key_str = col_name[len(link_val_col) + 1 :]
            link_keys = str(link_key_str).split(TRACING_KEY_DELIMITER_SYMBOL)
            cfg_cols = []
            for sensor_id in link_keys:
                cfg_col = dic_sensor_id_cfg_col[int(sensor_id)]
                if cfg_col is None:
                    proc_id, orig_col_name = get_original_serial(sensor_id)
                    cfg_col, _ = dic_mapping_col_n_sensor.get(proc_id, {}).get(
                        orig_col_name, (None, None)
                    )

                cfg_cols.append(cfg_col)

            col_labels = [
                gen_sql_label(cfg_col.id, cfg_col.column_name)
                for cfg_col in cfg_cols
                if cfg_col is not None
            ]
            if len(col_labels) == 0:
                continue
            elif len(col_labels) == 1:
                if col_labels[0] not in df.columns:
                    df[col_labels[0]] = df[col_name]
            else:
                temp_df = pd.DataFrame(columns=col_labels, data=[])
                temp_df[col_labels] = df[col_name].str.split(
                    TRACING_KEY_DELIMITER_SYMBOL, expand=True
                )
                for label in col_labels:
                    if label not in df.columns:
                        df[label] = temp_df[label]

    return df


@log_execution_time()
def gen_trace_sensors_df(
    column_ids, column_names, cycle_ids, df, dic_mapping_col_n_sensor, proc_id
):
    df.set_index(proc_id, inplace=True)
    with DbProxy(gen_data_source_of_universal_db(), True, True) as db_instance:
        sql = gen_create_temp_table_sql()
        db_instance.execute_sql(sql)
        db_instance.bulk_insert(SHOW_GRAPH_TEMP_TABLE_NAME, [SHOW_GRAPH_TEMP_TABLE_COL], cycle_ids)

        cfg_process: CfgProcess = CfgProcess.query.get(proc_id)
        serial_cols = cfg_process.get_serials(column_name_only=False)
        getdate_col = cfg_process.get_date_col(column_name_only=False)

        for col_ids, col_names in chunk_two_list(column_ids, column_names, 50):
            if getdate_col.id not in col_ids:
                col_ids.append(getdate_col.id)
                col_names.append(getdate_col.column_name)

            for serial_col in serial_cols:
                if serial_col.id not in col_ids:
                    col_ids.append(serial_col.id)
                    col_names.append(serial_col.column_name)

            sql, params = gen_trace_sensors_sql(
                int(proc_id),
                col_names,
                dic_mapping_col_n_sensor,
                SHOW_GRAPH_TEMP_TABLE_NAME,
                SHOW_GRAPH_TEMP_TABLE_COL,
            )
            _, rows = db_instance.run_sql(sql, params=params, row_is_dict=False)

            labels = [
                gen_sql_label(_col_id, _col_name) for _col_id, _col_name in zip(col_ids, col_names)
            ]
            df_proc = pd.DataFrame(rows, columns=[SHOW_GRAPH_TEMP_TABLE_COL] + labels)
            df_proc.set_index(SHOW_GRAPH_TEMP_TABLE_COL, inplace=True)
            # df = df.join(df_proc, rsuffix='_old_')
            df = df.merge(
                df_proc, how='left', left_index=True, right_index=True, suffixes=('', '_old_')
            )

            old_cols = [col for col in df.columns if str(col).endswith('_old_')]
            if old_cols:
                df.drop(old_cols, axis=1, inplace=True)

    return df


@log_execution_time()
def gen_trace_procs_df(
    start_proc_id,
    start_tm,
    end_tm,
    graph,
    common_paths,
    short_procs,
    dic_mapping_col_n_sensor,
    dic_conditions,
    duplicate_serial_show,
    for_count=False,
):
    df = None
    blank_df = None
    if for_count:
        if not dic_conditions:
            common_paths = [common_paths[0]]
        else:
            reduced_path = []
            for proc_id in dic_conditions.keys():
                for path, is_forward in common_paths:
                    if proc_id in path:
                        reduced_path.append((path, is_forward))
                        break

            common_paths = reduced_path

    immediate_isolation_level = bool(dic_conditions)
    with DbProxy(gen_data_source_of_universal_db(), True, immediate_isolation_level) as db_instance:
        for path, is_trace_forward in common_paths:
            if not is_trace_forward:
                path = list(reversed(path))

            res = gen_trace_procs_sql(
                path,
                graph,
                start_tm,
                end_tm,
                short_procs,
                dic_mapping_col_n_sensor,
                dic_conditions,
                duplicate_serial_show,
                for_count,
            )

            sql, params, table_name, link_key = res
            if dic_conditions:
                # add regular expression function to db
                db_instance.connection.create_function(SQL_REGEXP_FUNC, 2, sql_regexp)

            cols, rows = db_instance.run_sql(sql, params=params, row_is_dict=False)

            # there is no data in start proc
            if not len(rows):
                blank_df = pd.DataFrame(rows, columns=cols)
                continue

            start_proc_id_str = str(start_proc_id)
            end_proc_id = path[-1]
            end_time_col = gen_proc_time_label(end_proc_id)
            _df = pd.DataFrame(rows, columns=cols)

            if not for_count:
                _df.sort_values(end_time_col, inplace=True)
                # remove duplicate cycle_id
                _df.drop_duplicates(subset=[start_proc_id_str], keep='last', inplace=True)

            if df is None:
                df = _df
            else:
                _df_cols = _df.columns.difference(df.columns).tolist()
                df = df.merge(_df[[start_proc_id_str] + _df_cols], on=start_proc_id_str)
                # df = df.merge(_df[[start_proc_id_str] + _df_cols], how='outer', on=start_proc_id_str)

    if df is None:
        df = blank_df

    return df, len(df)


@log_execution_time()
def reduce_graph(end_procs, graph, start_proc_id):
    # get all paths between start and end procs
    paths = []
    dic_end_proc_cols = {}
    for end_proc_obj in end_procs:
        end_proc = end_proc_obj.proc_id
        dic_end_proc_cols[end_proc] = (end_proc_obj.col_ids, end_proc_obj.col_names)
        end_paths = []
        # trace forward vs trace backward
        for _start_proc, _end_proc in ((start_proc_id, end_proc), (end_proc, start_proc_id)):
            is_trace_forward = _start_proc == start_proc_id
            _paths = graph.get_all_paths(_start_proc, _end_proc)
            _paths = [
                (_path, is_trace_forward)
                for _path in _paths
                if len(_path) and _path[-1] == _end_proc
            ]
            if _paths:
                end_paths.extend(_paths)
                break

        if not end_paths:
            _paths = graph.get_all_paths(start_proc_id, end_proc, undirected_graph=True)
            _paths = [(_path, True) for _path in _paths if len(_path) and _path[-1] == end_proc]
            if _paths:
                end_paths.extend(_paths)

        paths.extend(end_paths)
    # remove middle nodes
    short_paths = [graph.remove_middle_nodes(_path) for _path, _ in paths]
    short_procs = set(itertools.chain.from_iterable(short_paths))
    common_paths = get_common_longest_paths(paths)
    return common_paths, dic_end_proc_cols, short_procs


def gen_cfg_col_n_sensor_pair(proc_id):
    cfg_columns = CfgProcessColumn.get_all_columns(proc_id)
    sensors = Sensor.get_sensors_by_proc_id(proc_id)
    dic_cfg_columns = {_cfg_col.column_name: _cfg_col for _cfg_col in cfg_columns}
    dic_col_name = {
        _sensor.column_name: (dic_cfg_columns.get(_sensor.column_name), _sensor)
        for _sensor in sensors
    }
    dic_cfg_col = {
        dic_cfg_columns.get(_sensor.column_name).id: _sensor
        for _sensor in sensors
        if dic_cfg_columns.get(_sensor.column_name)
    }
    dic_sensor = {_sensor.id: dic_cfg_columns.get(_sensor.column_name) for _sensor in sensors}
    return dic_col_name, dic_cfg_col, dic_sensor


def gen_create_temp_table_sql():
    sql = f'CREATE TEMP TABLE {SHOW_GRAPH_TEMP_TABLE_NAME} (cycle_id INT)'
    return sql


def gen_trace_sensors_sql(
    proc_id,
    col_names,
    dic_mapping_col_n_sensor,
    cycle_table_name,
    cycle_id_col,
    time_col=None,
    start_tm=None,
    end_tm=None,
    where_proc_id=False,
    dic_conditions=None,
    dup_serials_show=DuplicateSerialShow.SHOW_BOTH,
):
    sql_joins = []
    select_cols = []
    params = []
    serial_name = []
    serials_groups = []
    index = 1
    is_dup = dup_serials_show != DuplicateSerialShow.SHOW_BOTH
    if is_dup:
        serial_name = [proc.column_name for proc in CfgProcessColumn.get_serials(proc_id)]
        if not serial_name:
            is_dup = False

    for col_name in col_names:
        _, sensor = dic_mapping_col_n_sensor[proc_id][col_name]
        sensor_cls = find_sensor_class(sensor.id, DataType(sensor.type))
        table_name = sensor_cls.__table__.name
        table_alias = f'{table_name}_{str(sensor.id)}'

        serial_alias = ''
        if is_dup and col_name in serial_name:
            serial_label = f'serial{index}'
            serial_alias = f' as {serial_label}'
            serials_groups.append(serial_label)
            index += 1

        select_cols.append(f'{table_alias}.{SensorType.value.key}{serial_alias}')

        left_join = f'LEFT JOIN {table_name} {table_alias}'
        left_join += f' ON {table_alias}.{SensorType.sensor_id.key} = ?'
        left_join += (
            f' AND {cycle_table_name}.{cycle_id_col} = {table_alias}.{SensorType.cycle_id.key}'
        )
        params.append(sensor.id)
        sql_joins.append(left_join)

    select_cols = [
        f'{cycle_table_name}.{_col}' for _col in [cycle_id_col, time_col] if _col
    ] + select_cols
    select_col_str = gen_select_col_str(select_cols, is_add_double_quote=False)
    select_sql = f'SELECT {select_col_str}'
    from_sql = f' FROM {cycle_table_name} '

    where_sql = ' WHERE 1 = 1'
    if where_proc_id:
        where_sql += f' AND {Cycle.process_id.key} = {PARAM_SYMBOL}'
        params.append(proc_id)

    if start_tm and end_tm:
        where_sql += f' AND {time_col} >= {PARAM_SYMBOL} AND {time_col} < {PARAM_SYMBOL}'
        params.append(start_tm)
        params.append(end_tm)

    if is_dup:
        serials_groups = ','.join(serials_groups)
        order = (
            f'MIN({time_col})'
            if dup_serials_show == DuplicateSerialShow.SHOW_FIRST
            else f'MAX({time_col})'
        )
        group_by = f'GROUP BY {serials_groups} HAVING {order}' if serials_groups else ''
        sql = select_sql + from_sql + ' '.join(sql_joins) + where_sql
        dup_sql = f'{sql} {group_by}'
        where_sql = 'WHERE 1 = 1'

    if is_dup:
        table_name = 'temp_trace_tb'
    else:
        table_name = cycle_table_name

    if dic_conditions:
        if proc_id in dic_conditions:
            for condition_sql, condition_params in dic_conditions[proc_id]:
                where_sql += f' AND {table_name}.{cycle_id_col} IN ({condition_sql})'
                params.extend(condition_params)

    where_sql += f' LIMIT {SQL_LIMIT}'
    sql = select_sql + from_sql + ' '.join(sql_joins) + where_sql
    if is_dup:
        sql = f'SELECT * FROM ({dup_sql}) {table_name} {where_sql}'

    return sql, params


def gen_show_graph_distinct_sql(table_name, duplicate_serial_show):
    proc_link_first_cls = ProcLink.get_first_cls()
    proc_id_col = proc_link_first_cls.process_id.key
    cycle_id_col = proc_link_first_cls.cycle_id.key
    time_col = proc_link_first_cls.time.key
    link_key_col = proc_link_first_cls.link_key.key
    link_val_col = proc_link_first_cls.link_value.key

    having = ''
    if duplicate_serial_show is DuplicateSerialShow.SHOW_FIRST:
        having = f'HAVING MIN({time_col})'
    elif duplicate_serial_show is DuplicateSerialShow.SHOW_LAST:
        having = f'HAVING MAX({time_col})'

    with_time_str = f'AND {time_col} >= {PARAM_SYMBOL} AND {time_col} < {PARAM_SYMBOL}'

    sql = f'''
        (SELECT {cycle_id_col}, {time_col}, {link_val_col}  
        FROM {table_name} 
        WHERE {proc_id_col} = {PARAM_SYMBOL}
          AND {link_key_col} = {PARAM_SYMBOL}
          {with_time_str})
        '''

    if duplicate_serial_show in (DuplicateSerialShow.SHOW_FIRST, DuplicateSerialShow.SHOW_LAST):
        sql = f'(SELECT * FROM {sql} GROUP BY {link_val_col} {having})'

    return sql


# def sql_count_original_record(table_name):
#     proc_link_first_cls = ProcLink.get_first_cls()
#     proc_id_col = proc_link_first_cls.process_id.key
#     time_col = proc_link_first_cls.time.key
#     link_key_col = proc_link_first_cls.link_key.key
#
#     sql = f"""
#         SELECT COUNT(1)
#         FROM {table_name}
#         WHERE {proc_id_col} = {PARAM_SYMBOL}
#         AND {link_key_col} = {PARAM_SYMBOL}
#         AND {time_col} BETWEEN {PARAM_SYMBOL} AND {PARAM_SYMBOL}
#     """
#
#     return sql


def gen_trace_procs_sql(
    path,
    graph: TraceGraph,
    start_tm,
    end_tm,
    short_procs,
    dic_mapping_col_n_sensor,
    dic_conditions,
    duplicate_serial_show=None,
    for_count=False,
):
    sql_joins = []
    params = []
    done_link_keys = []
    table_aliases = []
    dic_table_alias = {}
    not_select_cols = []
    dic_select_cycle_alias = {}

    # get proc link column names
    proc_link_first_cls = ProcLink.get_first_cls()
    cycle_id_col = proc_link_first_cls.cycle_id.key
    time_col = proc_link_first_cls.time.key
    link_val_col = proc_link_first_cls.link_value.key
    select_cols = []
    start_t_proc_link_tb_name = ''
    start_link_key = ''
    start_cycle_id_col = None

    # calculate +-14 day for end processes
    e_start_tm = convert_time(start_tm, return_string=False)
    e_start_tm = add_days(e_start_tm, -14)
    e_start_tm = convert_time(e_start_tm, remove_ms=True)
    e_end_tm = convert_time(end_tm, return_string=False)
    e_end_tm = add_days(e_end_tm, 14)
    e_end_tm = convert_time(e_end_tm, remove_ms=True)
    for from_proc, to_proc in zip(path[:-1], path[1:]):
        is_trace_forward = True
        edge_id = (from_proc, to_proc)
        edge = graph.dic_edges.get(edge_id)
        if not edge:
            is_trace_forward = False
            edge_id = (to_proc, from_proc)
            edge = graph.dic_edges.get(edge_id)

        self_sensor_ids, target_sensor_ids = gen_sensor_ids_from_trace_keys(
            edge, dic_mapping_col_n_sensor
        )

        from_link_key = None
        if self_sensor_ids and all(self_sensor_ids):
            from_link_key = TRACING_KEY_DELIMITER_SYMBOL.join([str(id) for id in self_sensor_ids])

        to_link_key = None
        if target_sensor_ids and all(target_sensor_ids):
            to_link_key = TRACING_KEY_DELIMITER_SYMBOL.join([str(id) for id in target_sensor_ids])

        if is_trace_forward:
            edge_cols = (from_link_key, to_link_key)
        else:
            edge_id = tuple(reversed(edge_id))
            edge_cols = (to_link_key, from_link_key)

        for idx, proc_id in enumerate(edge_id):
            if short_procs and proc_id not in short_procs:
                continue

            link_key = edge_cols[idx]
            if not link_key:
                continue

            proc_link_cls = ProcLink.find_proc_link_class(link_key)
            table_name = proc_link_cls.__table__.name
            table_alias = f't{proc_id}_{link_key}'
            if idx == 0:
                if not table_aliases:
                    start_t_proc_link_tb_name = table_name
                    start_link_key = link_key
                    table_name = gen_show_graph_distinct_sql(table_name, duplicate_serial_show)
                    sql_join = f' FROM {table_name} {table_alias}'
                    start_cycle_id_col = f'{table_alias}.{cycle_id_col} "{proc_id}"'
                    params.extend([proc_id, link_key, start_tm, end_tm])
                    sql_joins.append(sql_join)
                elif link_key not in done_link_keys:
                    table_name = gen_show_graph_distinct_sql(table_name, duplicate_serial_show)
                    sql_join = f'LEFT JOIN {table_name} {table_alias}'
                    sql_join += (
                        f' ON {table_alias}.{cycle_id_col} = {table_aliases[-1]}.{cycle_id_col}'
                    )
                    params.extend([proc_id, link_key, e_start_tm, e_end_tm])
                    sql_joins.append(sql_join)
                    not_select_cols.append(table_alias)
                else:
                    continue
            else:
                table_name = gen_show_graph_distinct_sql(table_name, duplicate_serial_show)
                sql_join = f'LEFT JOIN {table_name} {table_alias}'
                sql_join += f' ON {table_alias}.{link_val_col} = {table_aliases[-1]}.{link_val_col}'
                params.extend([proc_id, link_key, e_start_tm, e_end_tm])
                sql_joins.append(sql_join)

            done_link_keys.append(link_key)
            table_aliases.append(table_alias)
            dic_table_alias[table_alias] = proc_id
            dic_select_cycle_alias[proc_id] = f'{table_alias}.{cycle_id_col}'

            proc_link_val_col = gen_link_val_label(link_key)
            select_cols.append(f'{table_alias}.{link_val_col} "{proc_link_val_col}"')

    # gen select columns in sql
    for alias, proc_id in dic_table_alias.items():
        if alias in not_select_cols:
            continue

        select_cols.append(f'{alias}.{cycle_id_col} "{proc_id}"')
        proc_time_col = gen_proc_time_label(proc_id)
        select_cols.append(f'{alias}.{time_col} "{proc_time_col}"')

    # conditions
    sql_where = ''
    if dic_conditions:
        for proc_id in path:
            if proc_id not in dic_conditions:
                continue

            for condition_sql, condition_params in dic_conditions[proc_id]:
                if sql_where:
                    sql_where += ' AND'
                else:
                    sql_where += ' WHERE'

                sql_where += f' {dic_select_cycle_alias[proc_id]} IN ({condition_sql})'
                params.extend(condition_params)

    if for_count:
        sql = f'SELECT DISTINCT {start_cycle_id_col} {" ".join(sql_joins)} {sql_where} LIMIT {SQL_LIMIT}'
        # sql = f'SELECT COUNT(1) FROM ({sql})'
    else:
        select_cols_str = gen_select_col_str(select_cols, is_add_double_quote=False)
        sql = f'SELECT {select_cols_str} {" ".join(sql_joins)} {sql_where} LIMIT {SQL_LIMIT}'

    return sql, params, start_t_proc_link_tb_name, start_link_key


def get_common_longest_paths(paths):
    if not paths:
        return []

    sorted_paths = sorted(paths, key=lambda x: len(x[0]), reverse=True)
    output_paths = [sorted_paths[0]]
    for path_obj in sorted_paths[1:]:
        path, _ = path_obj
        is_new_branch = True
        for output_path, _ in output_paths:
            if path == output_path[: len(path)]:
                is_new_branch = False
                break

        if is_new_branch and len(path) > 1:
            output_paths.append(path_obj)

    return output_paths


@notify_progress(40)
@abort_process_handler()
@log_execution_time()
@trace_log((TraceErrKey.ACTION, TraceErrKey.TARGET), (EventAction.READ, Target.DATABASE))
@memoize(is_save_file=True)
def get_df_from_db(graph_param: DicParam, is_save_df_to_file=False, _use_expired_cache=False):
    if get_debug_data(DebugKey.IS_DEBUG_MODE.name):
        df = get_debug_data(DebugKey.GET_DATA_FROM_DB.name)
        return df, df.index.size, None

    # start proc
    start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)

    # add start proc to end procs to get serial data
    graph_param.add_start_proc_to_array_formval()

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add cat exp
    graph_param.add_cat_exp_to_array_formval()

    # add NG column
    graph_param.add_ng_condition_to_array_formval()

    # add color, cat_div
    # graph_param.add_column_to_array_formval(
    #     ele for ele in [graph_param.common.color_var, graph_param.common.div_by_cat] if ele)
    duplicate_serial_show = graph_param.common.duplicate_serial_show
    duplicated_serials_count = graph_param.common.duplicated_serials_count

    df, serial_labels, actual_total_record, unique_record_number = gen_graph_df(
        graph_param.common.start_proc,
        start_tm,
        end_tm,
        graph_param.array_formval,
        graph_param.common.cond_procs,
        duplicate_serial_show,
        duplicated_serials_count,
    )

    # sort by time
    df[Cycle.time.key] = df[gen_proc_time_label(graph_param.common.start_proc)]
    time_cols = sorted([col for col in df.columns if str(col).startswith(Cycle.time.key)])
    df.sort_values(time_cols, inplace=True)

    # check empty
    if df is None or not len(df):
        return df, 0, 0

    duplicated_serials_number = actual_total_record - unique_record_number

    _, is_show_duplicated = is_show_duplicated_serials(
        duplicate_serial_show, duplicated_serials_count, actual_total_record
    )
    if not is_show_duplicated:
        duplicated_serials_number = None

    # df, unique_serial = remove_show_graph_duplicates(graph_param, df, serial_labels)

    # fill missing columns
    for proc in graph_param.array_formval:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            label = gen_sql_label(col_id, col_name)
            if label not in df.columns:
                df[label] = None

    # reset index
    df.reset_index(inplace=True, drop=True)

    df = cast_df_number(df, graph_param.array_formval)

    # save log
    if is_save_df_to_file or graph_param.common.is_export_mode:
        save_df_to_file(df)

    return df, actual_total_record, duplicated_serials_number


@notify_progress(40)
@abort_process_handler()
@log_execution_time()
def get_data_from_db(
    graph_param: DicParam,
    dic_filter=None,
    is_save_df_to_file=False,
    use_expired_cache=False,
    with_categorized_real=False,
):
    # the system is busy
    dic_request_info[LAST_REQUEST_TIME] = datetime.utcnow()

    # DEBUG Function
    df, actual_total_record, duplicated_serials_number = get_df_from_db(
        graph_param, is_save_df_to_file, _use_expired_cache=use_expired_cache
    )

    # check empty
    if df is None or not len(df):
        return df, 0, 0

    # graph_param.common.is_validate_data = True
    if graph_param.common.is_validate_data:
        df = validate_data(df)
        df = cast_df_number(df, graph_param.array_formval)  # TODO: we might not need this.

    cfg_cols = CfgProcessColumn.get_by_ids(graph_param.common.sensor_cols)
    sensor_labels = [gen_sql_label(col.id, col.column_name) for col in cfg_cols]

    if with_categorized_real:
        for i, col in enumerate(cfg_cols):
            if col.data_type == DataType.REAL.name and sensor_labels[i] in df.columns:
                col_name = sensor_labels[i]
                categorized_col_name = sensor_labels[i] + CATEGORIZED_SUFFIX
                df[categorized_col_name] = df[col_name]
                df[categorized_col_name] = df[categorized_col_name].replace(
                    dict.fromkeys([np.inf, -np.inf, float('nan')], np.nan)
                )
                df[categorized_col_name][
                    df[categorized_col_name].notna()
                ] = discretize_float_data_equally(
                    df[categorized_col_name][df[categorized_col_name].notna()]
                )

    # on-demand filter
    if dic_filter:
        df = filter_df(df, dic_filter)

    if graph_param.common.abnormal_count:
        df = validate_abnormal_count(df, sensor_labels)

    if graph_param.common.is_remove_outlier:
        df = remove_outlier(df, sensor_labels, graph_param)

    if graph_param.common.remove_outlier_objective_var:
        objective_id = graph_param.common.objective_var
        sensor_labels = [
            gen_sql_label(col.id, col.column_name) for col in cfg_cols if col.id == objective_id
        ]
        df = remove_outlier(df, sensor_labels, graph_param)

    if graph_param.common.remove_outlier_explanatory_var:
        objective_id = graph_param.common.objective_var
        sensor_labels = [
            gen_sql_label(col.id, col.column_name) for col in cfg_cols if col.id != objective_id
        ]
        df = remove_outlier(df, sensor_labels, graph_param)

    df = cast_df_number(df, graph_param.array_formval)
    return df, actual_total_record, duplicated_serials_number


def cast_df_integer(df: DataFrame, end_procs: List[EndProc]) -> DataFrame:
    integer_column_ids = set()
    for proc in end_procs:
        integer_column_ids.update(
            (col.id for col in CfgProcessColumn.get_by_data_type(proc.proc_id, DataType.INTEGER))
        )
    for col_id in integer_column_ids:
        col_name = CfgProcessColumn.gen_label_from_col_id(col_id)
        if col_name in df.columns:
            df[col_name] = df[col_name].astype('Int64')
    return df


def cast_df_real(df: DataFrame, end_procs: List[EndProc]) -> DataFrame:
    real_column_ids = set()
    for proc in end_procs:
        real_column_ids.update(
            (col.id for col in CfgProcessColumn.get_by_data_type(proc.proc_id, DataType.REAL))
        )
    for col_id in real_column_ids:
        col_name = CfgProcessColumn.gen_label_from_col_id(col_id)
        if col_name in df.columns:
            df[col_name] = df[col_name].astype('Float64')
    return df


@log_execution_time()
def cast_df_number(df: DataFrame, end_procs: List[EndProc]) -> DataFrame:
    df = cast_df_integer(df, end_procs)
    df = cast_df_real(df, end_procs)
    return df


@log_execution_time()
def remove_show_graph_duplicates(graph_param, df, serial_labels):
    serial_labels = serial_labels or []
    serial_labels = [label for label in serial_labels if label in df.columns]
    if serial_labels:
        if graph_param.common.duplicate_serial_show is DuplicateSerialShow.SHOW_FIRST:
            df = df.drop_duplicates(subset=serial_labels, keep='first')
            unique_serial = len(df)
        elif graph_param.common.duplicate_serial_show is DuplicateSerialShow.SHOW_LAST:
            df = df.drop_duplicates(subset=serial_labels, keep='last')
            unique_serial = len(df)
        else:
            unique_serial = len(df.drop_duplicates(subset=serial_labels))
    else:
        unique_serial = len(df)
    return df, unique_serial


@log_execution_time()
def validate_abnormal_count(df, sensor_labels):
    number_cols = df.select_dtypes(include=['integer', 'float']).columns.tolist()
    for col in number_cols:
        if col not in sensor_labels:
            continue

        x = df[col].replace({pd.NA: np.nan})
        abnormal_vals = detect_abnormal_count_values(x.dropna())
        df[col] = df[col].replace(abnormal_vals, pd.NA).astype(df[col].dtypes)

    return df


@log_execution_time()
def validate_data(df: DataFrame):
    if len(df) > THIN_DATA_COUNT:
        df_before = get_sample_df(df)
        df_after = validate_data_with_regex(df_before.copy(deep=True))
        checked_cols, dic_abnormal = get_changed_value_after_validate(df_before, df_after)
        df = validate_data_with_simple_searching(df, checked_cols, dic_abnormal)
    else:
        df = validate_data_with_regex(df)
    return df


@log_execution_time()
def get_sample_df(df):
    sample_df = df.head(THIN_DATA_COUNT)
    number_cols = df.select_dtypes(include=['integer', 'float']).columns.tolist()
    for col in number_cols:
        if not check_validate_target_column(col):
            continue
        try:
            # TODO: remove Exception handler after pandas version up
            # https://github.com/pandas-dev/pandas/issues/41696
            # pandas 1.2 does not work with Float64, Int64
            min_idx = df[col].idxmin()
            max_idx = df[col].idxmax()
            sample_df = sample_df.append(df.loc[min_idx], ignore_index=True)
            sample_df = sample_df.append(df.loc[max_idx], ignore_index=True)
        except Exception:
            pass

    return sample_df


@log_execution_time()
def gen_df_thin_values(
    df: DataFrame, graph_param: DicParam, df_thin, dic_str_cols, df_from_to_count, dic_min_med_max
):
    thin_idxs_len = len(df_thin)
    thin_boxes = [None] * thin_idxs_len
    df_cat_exp = pd.DataFrame({Cycle.time.key: thin_boxes}, index=df_thin.index)

    df_cat_exp[Cycle.time.key] = df_thin[Cycle.time.key]
    if CAT_EXP_BOX in df_thin.columns:
        df_cat_exp[CAT_EXP_BOX] = df_thin[CAT_EXP_BOX]

    series = pd.Series(thin_boxes, index=df_thin.index)
    for proc in graph_param.array_formval:
        orig_sql_label_serial = gen_sql_label(SERIAL_DATA, proc.proc_id)
        time_col_alias = '{}_{}'.format(Cycle.time.key, proc.proc_id)

        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            col_id_name = gen_sql_label(col_id, col_name)
            cols_in_df = [col for col in df_thin.columns if col.startswith(col_id_name)]
            target_col_info = dic_str_cols.get(col_id_name)
            for sql_label in cols_in_df:
                sql_label_min = gen_sql_label(ARRAY_Y_MIN, sql_label)
                sql_label_max = gen_sql_label(ARRAY_Y_MAX, sql_label)
                sql_label_cycle = gen_sql_label(CYCLE_IDS, sql_label)
                sql_label_serial = gen_sql_label(SERIAL_DATA, sql_label)
                sql_label_time = gen_sql_label(TIMES, sql_label)
                sql_label_from = gen_sql_label(SLOT_FROM, sql_label)
                sql_label_to = gen_sql_label(SLOT_TO, sql_label)
                sql_label_count = gen_sql_label(SLOT_COUNT, sql_label)
                idxs = df_thin[sql_label].notnull()

                if not len(idxs) or not len(df_thin[idxs]):
                    df_cat_exp[sql_label] = thin_boxes
                    df_cat_exp[sql_label_min] = thin_boxes
                    df_cat_exp[sql_label_max] = thin_boxes
                    continue

                # before rank
                if target_col_info:
                    rows = df_thin[sql_label]
                    df_cat_exp[sql_label] = rows
                    df_cat_exp[sql_label_min] = thin_boxes
                    df_cat_exp[sql_label_max] = thin_boxes
                    continue

                med_idxs = list(df_thin.loc[idxs, sql_label])
                df_cat_exp[sql_label] = dic_min_med_max[sql_label]['median']

                # time start proc
                if Cycle.time.key in df.columns:
                    series[:] = None
                    series[idxs] = df.loc[med_idxs, Cycle.time.key].values
                    df_cat_exp[Cycle.time.key] = np.where(
                        series.isnull(), df_cat_exp[Cycle.time.key], series
                    )

                # time end proc
                if time_col_alias in df.columns:
                    series[:] = None
                    series[idxs] = df.loc[med_idxs, time_col_alias].values
                    df_cat_exp[sql_label_time] = series

                # cycle ids
                if Cycle.id.key in df.columns:
                    series[:] = None
                    series[idxs] = df.loc[med_idxs, Cycle.id.key].values
                    df_cat_exp[sql_label_cycle] = series

                # serial ids
                if orig_sql_label_serial in df.columns:
                    series[:] = None
                    series[idxs] = df.loc[med_idxs, orig_sql_label_serial].values
                    df_cat_exp[sql_label_serial] = series

                df_cat_exp[sql_label_min] = dic_min_med_max[sql_label]['min']

                df_cat_exp[sql_label_max] = dic_min_med_max[sql_label]['max']
                df_cat_exp[sql_label_from] = df_from_to_count['min']
                df_cat_exp[sql_label_to] = df_from_to_count['max']
                df_cat_exp[sql_label_count] = df_from_to_count['count']

    return df_cat_exp


@log_execution_time()
@abort_process_handler()
def gen_dic_data_from_df(
    df: DataFrame,
    graph_param: DicParam,
    cat_exp_mode=None,
    dic_cat_exp_labels=None,
    calculate_cycle_time=True,
):
    """
    :param df:
    :param graph_param:
    :param cat_exp_mode:
    :param dic_cat_exp_labels:
    :param calculate_cycle_time:
    :return:
    """
    dic_data = defaultdict(dict)
    blank_vals = [None] * df.index.size
    for proc in graph_param.array_formval:
        dic_data_cat_exp = defaultdict(list)
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            col_id_name = gen_sql_label(col_id, col_name)
            sql_labels = [col for col in df.columns if col.startswith(col_id_name)]
            series_lst = []
            for sql_label in sql_labels:
                if sql_label in df.columns:
                    series = df[sql_label]
                    series = series.replace({np.nan: None}).tolist()
                else:
                    series = blank_vals

                series_lst.append(series)
                if dic_cat_exp_labels:
                    sql_label_vals = dic_cat_exp_labels.get(sql_label)
                    if sql_label_vals:
                        dic_data_cat_exp[col_id].append(sql_label_vals[2])

            if series_lst:
                dic_data[proc.proc_id][col_id] = series_lst if cat_exp_mode else series_lst[0]
            else:
                dic_data[proc.proc_id][col_id] = []

        if len(dic_data_cat_exp):
            dic_data[proc.proc_id][CAT_EXP_BOX] = dic_data_cat_exp

        time_col_alias = '{}_{}'.format(Cycle.time.key, proc.proc_id)
        if time_col_alias in df:
            dic_data[proc.proc_id][Cycle.time.key] = (
                df[time_col_alias].replace({np.nan: None}).tolist()
            )
        else:
            dic_data[proc.proc_id][Cycle.time.key] = []

        # if CAT_EXP_BOX in df.columns:
        #     dic_data[CAT_EXP_BOX] = df[CAT_EXP_BOX].tolist()

    return dic_data


@log_execution_time()
def get_fmt_str_from_dic_data(dic_data):
    fmt = {}
    for end_proc, data in dic_data.items():
        for sensor, array_y in data.items():
            fmt[sensor] = get_fmt_from_array(array_y)

    return fmt


@log_execution_time()
def gen_dic_data_cat_exp_from_df(
    df: DataFrame, graph_param: DicParam, dic_cfg_cat_exps, max_graph=None
):
    is_graph_limited = False
    dic_data = defaultdict(dict)
    if not len(df):
        return dic_data, is_graph_limited

    cat_exp_cols = gen_cat_exp_names(graph_param.common.cat_exp)
    for cat_exp_col, cat_exp_label in zip(graph_param.common.cat_exp, cat_exp_cols):
        if cat_exp_label not in df.columns:
            cfg_cat_exp = dic_cfg_cat_exps[cat_exp_col]
            sql_label = gen_sql_label(cfg_cat_exp.id, cfg_cat_exp.column_name)
            df[cat_exp_label] = df[sql_label]

    df_group = df.groupby(cat_exp_cols, dropna=False)
    dic_df_group = {key: df_sub for key, df_sub in df_group}

    blank_vals = [None] * len(df)
    series = pd.Series(blank_vals, index=df.index)
    graph_count = 0
    for proc in graph_param.array_formval:
        if max_graph and graph_count >= max_graph:
            is_graph_limited = True
            break

        dic_datetime_cols = {
            cfg_col.id: cfg_col
            for cfg_col in CfgProcessColumn.get_by_data_type(proc.proc_id, DataType.DATETIME)
        }
        dic_none_idxs = defaultdict(list)
        dic_cat_exp_names = defaultdict(list)
        time_col_alias = '{}_{}'.format(Cycle.time.key, proc.proc_id)
        if time_col_alias in df:
            dic_data[proc.proc_id][Cycle.time.key] = (
                df[time_col_alias].replace({np.nan: None}).tolist()
            )
        else:
            dic_data[proc.proc_id][Cycle.time.key] = []

        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            if max_graph and graph_count >= max_graph:
                is_graph_limited = True
                break

            sql_label = gen_sql_label(col_id, col_name)
            if sql_label not in df.columns:
                dic_data[proc.proc_id][col_id] = blank_vals
                dic_none_idxs[col_id].append(list(range(len(df))))
                dic_cat_exp_names[col_id].append(NA_STR)
                continue

            plots = []
            # for cat_exp_val, idxs in df_group.groups.items():
            for cat_exp_val, df_sub in dic_df_group.items():
                if graph_count >= 20:
                    break

                idxs = df_sub.index
                if not len(idxs):
                    continue

                series[:] = None
                temp_series: Series = df_sub[sql_label]
                if col_id in dic_datetime_cols:
                    temp_series = pd.to_datetime(temp_series)
                    temp_series.sort_values(inplace=True)
                    temp_series = temp_series.diff().dt.total_seconds()
                    temp_series.sort_index(inplace=True)

                nan_idxs = temp_series.isnull()
                nan_series = temp_series[nan_idxs]
                if len(temp_series) == len(nan_series):
                    continue

                series[idxs] = temp_series.tolist()
                if len(nan_series):
                    series[nan_series.index] = None

                plots.append(series.tolist())
                dic_none_idxs[col_id].append(nan_series.index.tolist())
                dic_cat_exp_names[col_id].append(
                    NA_STR if cat_exp_val is None or pd.isna(cat_exp_val) else cat_exp_val
                )

                graph_count += 1

            if plots:
                dic_data[proc.proc_id][col_id] = plots
                dic_data[proc.proc_id][CAT_EXP_BOX] = dic_cat_exp_names
                dic_data[proc.proc_id][NONE_IDXS] = dic_none_idxs

    return dic_data, is_graph_limited


@log_execution_time()
def gen_dic_serial_data_from_df(df: DataFrame, dic_proc_cfgs, dic_param):
    dic_param[SERIAL_DATA] = dict()
    dic_param[COMMON_INFO] = dict()
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        serial_cols = proc_cfg.get_serials(column_name_only=False)
        datetime_col = proc_cfg.get_date_col(column_name_only=False)
        if datetime_col:
            datetime_col = datetime_col.shown_name
        sql_labels = [
            gen_sql_label(serial_col.id, serial_col.column_name) for serial_col in serial_cols
        ]
        before_rank_sql_labels = [gen_sql_label(RANK_COL, sql_label) for sql_label in sql_labels]
        serial_cols = [serial_col.shown_name for serial_col in serial_cols]
        dic_param[COMMON_INFO][proc_id] = {
            DATETIME_COL: datetime_col or '',
            SERIAL_COLUMNS: serial_cols,
        }
        cols = []
        for sql_label, before_rank_label in zip(sql_labels, before_rank_sql_labels):
            if before_rank_label in df.columns:
                cols.append(before_rank_label)
            else:
                cols.append(sql_label)

        is_not_exist = set(cols) - set(list(df.columns))
        if not is_not_exist and cols:
            dic_param[SERIAL_DATA][proc_id] = (
                df[cols].replace({np.nan: ''}).to_records(index=False).tolist()
            )
        else:
            dic_param[SERIAL_DATA][proc_id] = []


@log_execution_time()
def gen_dic_serial_data_from_df_thin(df: DataFrame, dic_param, dic_datetime_serial_cols, dic_ranks):
    dic_param[COMMON_INFO] = {}

    for plot in dic_param[ARRAY_PLOTDATA]:
        col_id = plot[END_COL_ID]

        proc_id = plot[END_PROC_ID]
        col_name = plot[END_COL_NAME]
        cat_exp = plot.get(CAT_EXP_BOX)
        datetime_col, serial_cols = dic_datetime_serial_cols.get(proc_id, (None, None))
        if datetime_col:
            dic_param[COMMON_INFO][proc_id] = {
                DATETIME_COL: datetime_col.shown_name,
                SERIAL_COLUMNS: [serial_col.shown_name for serial_col in serial_cols],
            }

        if col_id in dic_ranks:
            continue

        sql_label = gen_sql_label(col_id, col_name, cat_exp)
        sql_label = gen_sql_label(SERIAL_DATA, sql_label)
        if sql_label in df.columns:
            plot[SERIAL_DATA] = df[sql_label].tolist()
        else:
            plot[SERIAL_DATA] = []


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
    cycle = db.session.query(
        cycle_cls.id, cycle_cls.global_id, cycle_cls.time, cycle_cls.is_outlier
    )
    cycle = cycle.filter(cycle_cls.process_id == proc_id)
    cycle = cycle.filter(cycle_cls.time >= start_tm)
    cycle = cycle.filter(cycle_cls.time < end_tm)

    if with_time_order:
        cycle = cycle.order_by(cycle_cls.time)

    if with_limit:
        cycle = cycle.limit(with_limit)

    cycle = cycle.all()

    return cycle


def get_sensor_values_chunk(
    data_query,
    chunk_sensor,
    dic_sensors,
    cycle_cls,
    start_relate_ids=None,
    start_tm=None,
    end_tm=None,
    with_limit=None,
):
    for col_id, col_name in chunk_sensor:
        if col_name not in dic_sensors:
            continue
        sensor = dic_sensors[col_name]
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type), auto_alias=True)
        sensor_val = sensor_val_cls.coef(col_id)

        data_query = data_query.outerjoin(
            sensor_val_cls,
            and_(sensor_val_cls.cycle_id == cycle_cls.id, sensor_val_cls.sensor_id == sensor.id),
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
        if with_limit:
            data_query = data_query.limit(with_limit)

        records = data_query.all()
        id_key = Cycle.id.key

    if records:
        return pd.DataFrame(records)
    else:
        params = {gen_sql_label(col_id, col_name) for col_id, col_name in chunk_sensor}
        params.update(
            {
                id_key: [],
                Cycle.time.key: [],
            }
        )
        df_chunk = pd.DataFrame(
            {gen_sql_label(col_id, col_name): [] for col_id, col_name in chunk_sensor}
        )
        return df_chunk


@log_execution_time()
def get_sensor_values(
    proc: EndProc,
    start_relate_ids=None,
    start_tm=None,
    end_tm=None,
    use_global_id=True,
    with_limit=None,
):
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
        df_chunk = get_sensor_values_chunk(
            data,
            chunk_sensor,
            dic_sensors,
            cycle_cls,
            start_relate_ids,
            start_tm,
            end_tm,
            with_limit=with_limit,
        )
        if idx != 0 and Cycle.time.key in df_chunk.columns:
            df_chunk = df_chunk.drop(Cycle.time.key, axis=1)
        dataframes.append(df_chunk)

    df = pd.DataFrame()
    if dataframes:
        df = pd.concat(
            [dfc.set_index(dfc.columns[0]) for dfc in dataframes], ignore_index=False, axis=1
        ).reset_index()
    return df


@log_execution_time()
def get_cond_data(proc: ConditionProc, start_tm, end_tm, with_limit=None):
    """generate subquery for every condition procs"""
    if not proc.dic_col_id_filters:
        return None

    conds = []
    # for filter_sensor in filter_sensors:
    for col_name, filters in proc.dic_col_name_filters.items():
        sql, params = gen_sql_condition_per_column(
            proc.proc_id, start_tm, end_tm, col_name, filters, with_limit
        )
        conds.append((sql, params))

    return conds


def gen_sql_condition_per_column(proc_id, start_tm, end_tm, col_name, filters, with_limit=None):
    sensor = Sensor.get_sensor_by_col_name(proc_id, col_name)
    sensor_val = find_sensor_class(sensor.id, DataType(sensor.type))
    and_conditions = gen_conditions_per_column(filters)
    params = []
    cycle_cls = find_cycle_class(proc_id)
    cycle_table_name = cycle_cls.__table__.name

    sql = f'SELECT {sensor_val.cycle_id.key} FROM {sensor_val.__table__.name}'
    sql += f' LEFT JOIN {cycle_table_name} on {cycle_table_name}.id = {sensor_val.__table__.name}.cycle_id'
    sql += f' WHERE {sensor_val.sensor_id.key} = {PARAM_SYMBOL}'
    sql += f' AND {cycle_table_name}.time >= {PARAM_SYMBOL} AND {cycle_table_name}.time < {PARAM_SYMBOL}'
    params.append(sensor.id)
    params.append(start_tm)
    params.append(end_tm)
    and_sql = ''
    for in_vals, like_vals, regex_vals in and_conditions:
        or_sql = ''

        # IN
        if in_vals:
            if or_sql:
                or_sql += ' OR'

            or_sql += f" {sensor_val.value.key} IN ({','.join([PARAM_SYMBOL] * len(in_vals))})"
            params.extend(in_vals)

        # LIKE
        if like_vals:
            for like_val in like_vals:
                if or_sql:
                    or_sql += ' OR'
                or_sql += f' {sensor_val.value.key} LIKE {PARAM_SYMBOL}'
                params.append(like_val)

        # REGEX
        if regex_vals:
            for regex_val in regex_vals:
                if or_sql:
                    or_sql += ' OR'
                or_sql += f' {sensor_val.value.key} {SQL_REGEXP_FUNC} {PARAM_SYMBOL}'
                params.append(regex_val)

        if or_sql:
            and_sql += f' AND ({or_sql})'

    sql += and_sql

    if with_limit:
        sql += f' LIMIT {with_limit}'

    return sql, params


def gen_conditions_per_column(filters):
    ands = []
    for cfg_filter in filters:
        comp_ins = []
        comp_likes = []
        comp_regexps = []
        cfg_filter_detail: CfgFilterDetail
        for cfg_filter_detail in cfg_filter.cfg_filter_details:
            val = cfg_filter_detail.filter_condition
            if cfg_filter_detail.filter_function == FilterFunc.REGEX.name:
                comp_regexps.append(val)
            elif (
                not cfg_filter_detail.filter_function
                or cfg_filter_detail.filter_function == FilterFunc.MATCHES.name
            ):
                comp_ins.append(val)
            else:
                comp_likes.extend(
                    gen_sql_like_value(
                        val,
                        FilterFunc[cfg_filter_detail.filter_function],
                        position=cfg_filter_detail.filter_from_pos,
                    )
                )

        ands.append((comp_ins, comp_likes, comp_regexps))
        # ands.append(
        #     or_(
        #         sensor_val.value.in_(comp_ins),
        #         *[sensor_val.value.op(SQL_REGEXP_FUNC)(val) for val in comp_regexps if val is not None],
        #         *[sensor_val.value.like(val) for val in comp_likes if val is not None],
        #     )

    return ands


def create_graph_config(cfgs: List[CfgVisualization] = []):
    if not cfgs:
        return [
            {
                THRESH_HIGH: None,
                THRESH_LOW: None,
                Y_MAX: None,
                Y_MIN: None,
                PRC_MAX: None,
                PRC_MIN: None,
                ACT_FROM: None,
                ACT_TO: None,
                'type': None,
                'name': None,
            }
        ]

    list_cfgs = []
    for cfg in cfgs:
        list_cfgs.append(
            {
                THRESH_HIGH: cfg.ucl,
                THRESH_LOW: cfg.lcl,
                Y_MAX: cfg.ymax,
                Y_MIN: cfg.ymin,
                PRC_MAX: cfg.upcl,
                PRC_MIN: cfg.lpcl,
                ACT_FROM: cfg.act_from,
                ACT_TO: cfg.act_to,
                'type': cfg.filter_column.shown_name if cfg.filter_column else None,
                'name': cfg.filter_detail.name if cfg.filter_detail else None,
                'eng_name': cfg.filter_column.name_en if cfg.filter_column else None,
            }
        )
    return list_cfgs


def get_default_graph_config(col_id, start_tm, end_tm):
    # get sensor default cfg chart info
    sensor_default_cfg: List[CfgVisualization] = (
        CfgVisualization.get_sensor_default_chart_info(col_id, start_tm, end_tm) or []
    )
    return create_graph_config(sensor_default_cfg)


def get_col_graph_configs(col_id, filter_detail_ids, start_tm, end_tm):
    if not filter_detail_ids:
        return get_default_graph_config(col_id, start_tm, end_tm)

    graph_configs = CfgVisualization.get_by_control_n_filter_detail_ids(
        col_id, filter_detail_ids, start_tm, end_tm
    )
    if graph_configs:
        return create_graph_config(graph_configs)

    return get_default_graph_config(col_id, start_tm, end_tm)


def convert_chart_info_time_range(
    chart_config, start_proc_times, end_proc_times, query_start_tm, query_end_tm
):
    last_idx = len(end_proc_times) - 1
    act_from = chart_config.get(ACT_FROM)
    act_to = chart_config.get(ACT_TO)
    if act_from:
        act_from = convert_time(act_from)
    if act_to:
        act_to = convert_time(act_to)
    converted_act_from = None
    converted_act_to = None
    if act_from and act_to:
        found_act_from = False
        found_act_to = False
        for idx, end_proc_time in enumerate(end_proc_times):
            back_idx = last_idx - idx
            if not found_act_from:
                if act_from <= end_proc_time <= act_to:
                    found_act_from = True
                    # if idx == 0:  # if it's first point -> converted act_from = -inf
                    #     converted_act_from = None  # -inf
                    # else:
                    #     converted_act_from = start_proc_times[idx]
                    converted_act_from = start_proc_times[idx]
                    if idx == 0:
                        converted_act_from = query_start_tm
            if not found_act_to:
                back_time = end_proc_times[back_idx]
                if act_from <= back_time <= act_to:
                    found_act_to = True
                    # if back_idx == last_idx:
                    #     converted_act_to = None  # if it's last point -> converted act_to = +inf
                    # else:
                    #     converted_act_to = start_proc_times[back_idx]
                    converted_act_to = start_proc_times[back_idx]
                    if back_idx == last_idx:
                        converted_act_to = query_end_tm
            if found_act_from and found_act_to:
                break
    else:
        if act_from:
            for idx, end_proc_time in enumerate(end_proc_times):
                if act_from <= end_proc_time:
                    converted_act_from = start_proc_times[idx]
                    if idx == 0:
                        converted_act_from = query_start_tm
                    break
        if act_to:
            for idx in range(len(end_proc_times)):
                back_idx = last_idx - idx
                if end_proc_times[back_idx] <= act_to:
                    converted_act_to = start_proc_times[back_idx]
                    if back_idx == last_idx:
                        converted_act_to = query_end_tm
                    break

    return converted_act_from, converted_act_to


@log_execution_time()
def get_chart_infos_by_stp_var(graph_param: DicParam):
    graph_configs = {}
    var_col_id = graph_param.get_cate_var_col_id()
    start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
    start_tm = convert_time(start_tm)
    end_tm = convert_time(end_tm)
    # get_end_cols = graph_param.get_end_cols(graph_param.get_start_proc())
    get_end_cols = []
    for col in graph_param.array_formval:
        if col.col_ids:
            get_end_cols += col.col_ids

    # query by var_col_id
    for end_col in get_end_cols:
        graph_configs[end_col] = {}
        chart_infos: List[CfgVisualization] = CfgVisualization.get_all_by_control_n_filter_col_id(
            end_col, var_col_id, start_tm, end_tm
        )
        for chart_info in chart_infos:
            filter_detail_id = chart_info.filter_detail_id
            if not graph_configs[end_col].get(filter_detail_id):
                graph_configs[end_col][filter_detail_id] = []
            graph_configs[end_col][filter_detail_id].append(chart_info)

    return graph_configs


@log_execution_time()
def map_stp_val_2_cfg_details(stp_value, map_filter_detail_2_regex={}):
    mapped_cfg_detail_ids = []
    for cfg_id, regex in map_filter_detail_2_regex.items():
        if regex and re.match(regex, str(stp_value)):
            mapped_cfg_detail_ids.append(cfg_id)
    return mapped_cfg_detail_ids


@log_execution_time()
def get_chart_infos_by_stp_value(
    stp_value, end_col, dic_filter_detail_2_regex, chart_infos_by_stp_var
):
    mapped_cfg_detail_ids = map_stp_val_2_cfg_details(stp_value, dic_filter_detail_2_regex) or []
    chart_infos_for_stp_value = []
    sensor_chart_infos = chart_infos_by_stp_var.get(end_col) or {}
    for cfg_detail_id in mapped_cfg_detail_ids:
        chart_infos_for_stp_value.extend(sensor_chart_infos.get(cfg_detail_id) or [])

    # None means default chart info of category var
    # In cfg_visualization table, filter_detail_id = null means default of control column/filter column
    if not chart_infos_for_stp_value:
        chart_infos_for_stp_value.extend(sensor_chart_infos.get(None) or [])
    return create_graph_config(chart_infos_for_stp_value)


@log_execution_time()
def get_chart_infos(graph_param: DicParam, dic_data=None, start_proc_times=None, no_convert=False):
    graph_configs = {}
    original_graph_configs = {}
    start_proc = graph_param.common.start_proc
    threshold_filter_detail_ids = graph_param.common.threshold_boxes
    for proc in graph_param.array_formval:
        graph_configs[proc.proc_id] = {}
        original_graph_configs[proc.proc_id] = {}

        start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
        end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
        end_proc = proc.proc_id
        end_proc_times = dic_data[proc.proc_id].get(Cycle.time.key) if dic_data else []
        for col_id in proc.col_ids:
            orig_graph_cfg, graph_cfg = get_chart_info_detail(
                end_proc_times,
                col_id,
                threshold_filter_detail_ids,
                end_proc,
                start_proc,
                start_tm,
                end_tm,
                start_proc_times,
                no_convert=no_convert,
            )
            original_graph_configs[proc.proc_id][col_id] = orig_graph_cfg
            graph_configs[proc.proc_id][col_id] = graph_cfg

    return graph_configs, original_graph_configs


@log_execution_time()
def get_chart_info_detail(
    end_proc_times,
    end_col,
    threshold_filter_detail_ids,
    end_proc=None,
    start_proc=None,
    start_tm=None,
    end_tm=None,
    start_proc_times=None,
    no_convert=False,
):
    start_tm = convert_time(start_tm)
    end_tm = convert_time(end_tm)
    query_start_tm = start_tm
    query_end_tm = end_tm
    if end_proc_times:
        end_proc_times = pd.Series(end_proc_times, dtype='string')
        end_proc_times = end_proc_times[end_proc_times.notna()]
        if len(end_proc_times):
            start_tm = end_proc_times.min()
            end_tm = end_proc_times.max()

        end_proc_times = end_proc_times.to_list()

    # get chart thresholds for each sensor
    col_graph_configs = get_col_graph_configs(
        end_col, threshold_filter_detail_ids, start_tm, end_tm
    )
    orig_graph_cfgs = deepcopy(col_graph_configs)

    if (
        end_proc_times
        and start_proc
        and end_proc
        and start_proc != end_proc
        and not no_convert
        and start_proc_times
    ):
        # convert thresholds
        for chart_config in col_graph_configs:
            act_from, act_to = convert_chart_info_time_range(
                chart_config, start_proc_times, end_proc_times, query_start_tm, query_end_tm
            )
            chart_config[ACT_FROM] = act_from
            chart_config[ACT_TO] = act_to

    return col_graph_configs, orig_graph_cfgs


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


@log_execution_time()
def order_end_proc_sensor(orig_graph_param: DicParam, reorder):
    dic_orders = {}
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        orders = (
            CfgConstant.get_value_by_type_name(
                type=CfgConstantType.TS_CARD_ORDER.name, name=proc_id
            )
            or '{}'
        )
        orders = json.loads(orders)
        if orders:
            dic_orders[proc_id] = orders

    lst_proc_end_col = []
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        for col_id, col_name, col_show_name in zip(
            proc.col_ids, proc.col_names, proc.col_show_names
        ):
            proc_order = dic_orders.get(proc_id) or {}
            order = proc_order.get(str(col_id)) or 999
            lst_proc_end_col.append((proc_id, col_id, col_name, col_show_name, order))

    if not reorder:
        return lst_proc_end_col

    return sorted(lst_proc_end_col, key=lambda x: x[-1])


@log_execution_time()
def gen_plotdata(
    orig_graph_param: DicParam,
    dic_data,
    chart_infos=None,
    original_graph_configs=None,
    reorder=True,
):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param, reorder)

    cat_exp_box_cols = orig_graph_param.common.cat_exp or []
    cat_exp_box_proc_name = []
    dic_procs, dic_cols = get_cfg_proc_col_info(cat_exp_box_cols)
    for col in cat_exp_box_cols:
        cat_exp_box_proc_name.append(dic_cols[col].shown_name)

    plotdatas = []
    array_formval = []
    for proc_id, col_id, col_name, col_show_name, _ in lst_proc_end_col:
        array_y = dic_data.get(proc_id, {}).get(col_id, [])
        array_x = dic_data.get(proc_id, {}).get(Cycle.time.key, [])
        plotdata = {
            ARRAY_Y: array_y,
            ARRAY_X: array_x,
            END_PROC_ID: proc_id,
            END_COL_ID: col_id,
            END_COL_NAME: col_name,
            END_COL_SHOW_NAME: col_show_name,
            CAT_EXP_BOX_NAME: cat_exp_box_proc_name,
        }

        plotdatas.append(plotdata)

        array_formval.append({END_PROC: proc_id, GET02_VALS_SELECT: col_id})

        # add chart info
        if chart_infos:
            set_chart_infos_to_plotdata(col_id, chart_infos, original_graph_configs, plotdata)

    return array_formval, plotdatas


@log_execution_time()
def gen_plotdata_fpp(
    orig_graph_param: DicParam,
    dic_data,
    chart_infos=None,
    original_graph_configs=None,
    dic_cycle_ids=None,
    reorder=True,
):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param, reorder)

    plotdatas = []
    array_formval = []
    dic_proc_name = gen_dict_procs([proc_id for proc_id, *_ in lst_proc_end_col])
    for proc_id, col_id, col_name, col_show_name, _ in lst_proc_end_col:
        if proc_id not in dic_data or col_id not in dic_data.get(proc_id):
            continue

        y_list = dic_data.get(proc_id, {}).get(col_id) or [[]]
        array_x = dic_data.get(proc_id, {}).get(Cycle.time.key, [])
        ranks = dic_data[proc_id].get(RANK_COL, {}).get(col_id)
        if not isinstance(y_list, (list, tuple)):
            y_list = [y_list]

        cate_names = dic_data.get(proc_id, {}).get(CAT_EXP_BOX, {}).get(col_id)
        none_idxs = dic_data.get(proc_id, {}).get(NONE_IDXS, {}).get(col_id)

        cat_exp_box_cols = orig_graph_param.common.cat_exp or []
        cat_exp_box_proc_name = []
        dic_procs, dic_cols = get_cfg_proc_col_info(cat_exp_box_cols)
        for col in cat_exp_box_cols:
            cat_exp_box_proc_name.append(dic_cols[col].shown_name)

        for idx, array_y in enumerate(y_list):
            if orig_graph_param.common.cat_exp and not array_y:
                continue

            plotdata = {
                ARRAY_Y: array_y,
                ARRAY_X: array_x,
                END_PROC_ID: proc_id,
                END_PROC_NAME: dic_proc_name[proc_id].shown_name,
                END_COL_ID: col_id,
                END_COL_NAME: col_name,
                END_COL_SHOW_NAME: col_show_name,
                CAT_EXP_BOX_NAME: cat_exp_box_proc_name,
            }

            if cate_names:
                plotdata.update({CAT_EXP_BOX: cate_names[idx]})

            if none_idxs:
                plotdata.update({NONE_IDXS: none_idxs[idx]})

            if dic_cycle_ids:
                plotdata.update({CYCLE_IDS: dic_cycle_ids.get(proc_id, {}).get(col_id, [])})

            if ranks:
                plotdata.update({RANK_COL: ranks[idx]})

            plotdatas.append(plotdata)

            array_formval.append({END_PROC: proc_id, GET02_VALS_SELECT: col_id})

            # add chart info
            if chart_infos:
                set_chart_infos_to_plotdata(col_id, chart_infos, original_graph_configs, plotdata)

    return array_formval, plotdatas


def set_chart_infos_to_plotdata(col_id, chart_infos, original_graph_configs, plotdata):
    """
    set chart config
    :param col_id:
    :param chart_infos:
    :param original_graph_configs:
    :param plotdata:
    :return:
    """
    if chart_infos is None:
        chart_infos = {}

    if original_graph_configs is None:
        original_graph_configs = {}

    chart_info = []
    original_graph_config = []
    for proc_id, dic_col in chart_infos.items():
        if col_id in dic_col:
            chart_info = dic_col[col_id]
            original_graph_config = original_graph_configs[proc_id][col_id]
            break

    plotdata[CHART_INFOS] = chart_info
    plotdata[CHART_INFOS_ORG] = original_graph_config


@log_execution_time()
def gen_category_data(
    dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam, dic_data, dic_org_cates=None
):
    plotdatas = []
    cate_procs: List[CategoryProc] = graph_param.common.cate_procs
    if graph_param.common.cat_exp:
        dic_cates = dic_data.get(CATEGORY_DATA) or dic_data
    else:
        dic_cates = dic_data

    for proc in cate_procs:
        proc_id = proc.proc_id
        dic_proc = dic_cates.get(proc_id)
        if dic_proc is None:
            continue

        proc_cfg = dic_proc_cfgs[proc_id]

        for col_id, column_name, col_show_name in zip(
            proc.col_ids, proc.col_names, proc.col_show_names
        ):
            col_cfg = dic_proc_cfgs[proc_id].get_cols([col_id])[0]
            data = dic_proc.get(col_id)
            if not data:
                continue

            if isinstance(data[0], (list, tuple)):
                array_y = data[0]
            else:
                array_y = data

            cate_summary = None
            if dic_org_cates:
                cate_summary = (
                    dic_org_cates[proc_id].get(col_id) if dic_org_cates.get(proc_id) else None
                )

            plotdata = dict(
                proc_name=proc_id,
                proc_master_name=proc_cfg.shown_name,
                column_name=column_name,
                column_master_name=col_show_name,
                data=array_y,
                summary=cate_summary,
                column_id=col_id,
                data_type=col_cfg.data_type,
            )
            plotdatas.append(plotdata)

    return plotdatas


@log_execution_time()
def clear_all_keyword(dic_param):
    """clear [All] keyword in selectbox

    Arguments:
        dic_param {json} -- [params from client]
    """
    dic_common = dic_param[COMMON]
    cate_procs = dic_common.get(CATE_PROCS, [])
    dic_formval = dic_param[ARRAY_FORMVAL]
    for idx in range(len(dic_formval)):
        select_vals = dic_formval[idx][GET02_VALS_SELECT]
        if isinstance(select_vals, (list, tuple)):
            dic_formval[idx][GET02_VALS_SELECT] = [
                val for val in select_vals if val not in [SELECT_ALL, NO_FILTER]
            ]
        else:
            dic_formval[idx][GET02_VALS_SELECT] = [select_vals]

    for idx in range(len(cate_procs)):
        select_vals = cate_procs[idx][GET02_CATE_SELECT]
        if isinstance(select_vals, (list, tuple)):
            cate_procs[idx][GET02_CATE_SELECT] = [
                val for val in select_vals if val not in [SELECT_ALL, NO_FILTER]
            ]
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
        return {
            ele[CATE_PROC]: ele[GET02_CATE_SELECT]
            for ele in cate_procs
            if ele.get(CATE_PROC) and ele.get(GET02_CATE_SELECT)
        }

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


@log_execution_time()
def make_irregular_data_none(dic_param):
    use_list = [YType.NORMAL.value, YType.OUTLIER.value, YType.NEG_OUTLIER.value]
    none_list = [float('inf'), float('-inf')]
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        array_y = plotdata.get(ARRAY_Y) or []
        array_y_type = plotdata.get(ARRAY_Y_TYPE) or []

        if array_y_type:  # use y_type to check for irregular data
            # TODO : save data as {(from,to): value} is better
            # array_plotdata[num][ARRAY_Y] = [None if array_y_type[idx] not in {YType.NORMAL.value, YType.OUTLIER.value,
            # YType.NEG_OUTLIER.value} else e for idx, e in enumerate(array_y)]
            df = pd.DataFrame({ARRAY_Y: array_y, ARRAY_Y_TYPE: array_y_type})
            df[ARRAY_Y] = np.where(df[ARRAY_Y_TYPE].isin(use_list), df[ARRAY_Y], None)
        else:  # or use value to check for irregular data directly
            # array_plotdata[num][ARRAY_Y] = [None if e == float('inf') or e == float('-inf') else e for e in array_y]
            df = pd.DataFrame({ARRAY_Y: array_y})
            df[ARRAY_Y] = np.where(df[ARRAY_Y].isin(none_list), None, df[ARRAY_Y])

        array_plotdata[num][ARRAY_Y] = df[ARRAY_Y].to_list()

    return dic_param


def get_min_max_of_all_chart_infos(chart_infos):
    vals = [chart.get(Y_MIN) for chart in chart_infos if chart.get(Y_MIN) is not None]
    vals += [chart.get(Y_MAX) for chart in chart_infos if chart.get(Y_MAX) is not None]
    y_min = None
    y_max = None
    if vals:
        y_min = min(vals)
        y_max = max(vals)

    return y_min, y_max


def get_threshold_min_max_chartinfo(chart_infos):
    threshold_lows = [
        chart.get(THRESH_LOW) for chart in chart_infos if chart.get(THRESH_LOW) is not None
    ]
    threshold_high = [
        chart.get(THRESH_HIGH) for chart in chart_infos if chart.get(THRESH_HIGH) is not None
    ]

    vals = threshold_lows + threshold_high
    y_min = None
    y_max = None
    if vals:
        y_min = min(vals) if threshold_lows else None
        y_max = max(vals) if threshold_high else None

    return y_min, y_max


def calc_upper_lower_range(array_y: Series):
    arr = array_y[array_y.notnull()]
    arr = arr[~arr.isin([float('inf'), float('-inf')])]
    # arr = [e for e in arr if e not in {None, float('inf'), float('-inf')} and not pd.isna(e)]
    if not len(arr):
        return None, None

    q1, q3 = quantile(arr, [0.25, 0.75], interpolation='midpoint')
    iqr = q3 - q1
    if iqr:
        lower_range = q1 - 2.5 * iqr
        upper_range = q3 + 2.5 * iqr
    else:
        lower_range = 0.9 * min(arr)
        upper_range = 1.1 * max(arr)
        if lower_range == upper_range:
            lower_range -= 1
            upper_range += 1

    return float(lower_range), float(upper_range)


def save_proc_sensor_order_to_db(orders):
    try:
        for proc_code, new_orders in orders.items():
            CfgConstant.create_or_merge_by_type(
                const_type=CfgConstantType.TS_CARD_ORDER.name,
                const_name=proc_code,
                const_value=new_orders,
            )
    except Exception as ex:
        traceback.print_exc()
        logger.error(ex)


def get_proc_ids_in_dic_param(graph_param: DicParam):
    """
    get process
    :param graph_param:
    :return:
    """
    procs = [graph_param.common.start_proc]
    for proc in graph_param.common.cond_procs:
        procs.append(proc.proc_id)

    for proc in graph_param.common.cate_procs:
        procs.append(proc.proc_id)

    for proc in graph_param.array_formval:
        procs.append(proc.proc_id)

    for proc_id in graph_param.common.serial_processes:
        procs.append(proc_id)

    cols = []
    cols += _get_cols(graph_param.common.cat_exp)
    cols += _get_cols(graph_param.common.color_var)
    cols += _get_cols(graph_param.common.objective_var)
    cols += _get_cols(graph_param.common.div_by_cat)

    if cols:
        cols = list(set(cols))
        _proc_ids = [proc.process_id for proc in CfgProcessColumn.get_by_ids(cols)]
        procs += _proc_ids

    return list(set(procs))


def _get_cols(cols):
    if not cols:
        return []

    if not isinstance(cols, (tuple, list)):
        cols = [cols]

    return cols


def get_procs_in_dic_param(graph_param: DicParam):
    """
    get process
    :param graph_param:
    :return:
    """
    proc_ids = get_proc_ids_in_dic_param(graph_param)
    dic_procs = gen_dict_procs(proc_ids)
    return dic_procs


def gen_dict_procs(proc_ids):
    return {proc.id: proc for proc in CfgProcess.get_procs(proc_ids)}


def get_end_procs_in_dic_param(graph_param: DicParam):
    """
    get process
    :param graph_param:
    :return:
    """
    procs = set()
    for proc in graph_param.array_formval:
        procs.add(proc.proc_id)

    return {proc.id: proc for proc in CfgProcess.get_procs(procs)}


def gen_blank_df():
    data = {Cycle.time.key: [], Cycle.is_outlier.key: []}
    return pd.DataFrame(data)


def fx(v):
    return pd.NA


@log_execution_time()
def apply_coef_text(df: DataFrame, graph_param: DicParam, dic_proc_cfgs: dict):
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        if graph_param.is_end_proc(proc_id):
            end_col_ids = graph_param.get_end_cols(proc_id) or []
            end_cols: List[CfgProcessColumn] = proc_cfg.get_cols(end_col_ids) or []
            for end_col in end_cols:
                if (
                    DataType[end_col.data_type] is DataType.TEXT
                    and end_col.coef is not None
                    and end_col.operator == Operator.REGEX.value
                ):
                    col_label = gen_sql_label(end_col.id, end_col.column_name)
                    if col_label in df.columns:
                        df[col_label] = (
                            df[col_label]
                            .astype('object')
                            .str.replace('^(?!{})'.format(end_col.coef), fx, regex=True)
                        )
    return df


def get_filter_detail_ids(proc_ids, column_ids):
    """
    get filter detail ids to check if this filter matching dataset of graph
    :param proc_ids:
    :param column_ids:
    :return:
    """
    not_exact_matches = []
    dic_col_filter_details = defaultdict(list)
    cfg_filters = CfgFilter.get_by_proc_n_col_ids(proc_ids, column_ids)
    for cfg_filter in cfg_filters:
        cfg_filter: CfgFilter
        cfg_column: CfgProcessColumn = cfg_filter.column
        df_col_name = gen_sql_label(cfg_column.id, cfg_column.column_name)
        for cfg_detail in cfg_filter.filter_details:
            if cfg_detail.filter_function == FilterFunc.MATCHES.name:
                dic_col_filter_details[df_col_name].append(
                    (cfg_detail.id, cfg_detail.filter_condition)
                )
            else:
                not_exact_matches.append(cfg_detail.id)

    return dic_col_filter_details, not_exact_matches


@log_execution_time()
def gen_dic_uniq_value_from_df(df, col_names):
    dic_col_values = {}
    for col in col_names:
        if col in df.columns:
            vals = set(df[col])
            vals = [str(val) for val in vals]
            dic_col_values[col] = set(vals)

    return dic_col_values


def check_filter_detail_match_graph_data(dic_col_filter_details, dic_col_values):
    matched_filter_ids = []
    unmatched_filter_ids = []
    for col_name, filter_details in dic_col_filter_details.items():
        vals = dic_col_values.get(col_name, [])
        for filter_detail_id, filter_condition in filter_details:
            if filter_condition in vals:
                matched_filter_ids.append(filter_detail_id)
            else:
                unmatched_filter_ids.append(filter_detail_id)

    return matched_filter_ids, unmatched_filter_ids


@log_execution_time()
@abort_process_handler()
def main_check_filter_detail_match_graph_data(graph_param: DicParam, df: DataFrame):
    cond_proc_ids = [cond.proc_id for cond in graph_param.common.cond_procs]
    cond_col_ids = graph_param.get_all_end_col_ids()
    dic_col_filter_details, not_exact_match_filter_ids = get_filter_detail_ids(
        cond_proc_ids, cond_col_ids
    )
    dic_col_values = gen_dic_uniq_value_from_df(df, dic_col_filter_details)
    matched_filter_ids, unmatched_filter_ids = check_filter_detail_match_graph_data(
        dic_col_filter_details, dic_col_values
    )

    return matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids


@log_execution_time()
def reduce_data(df_orig: DataFrame, graph_param, dic_str_cols):
    """
    make data for thin  mode
    :param df_orig:
    :param graph_param:
    :param dic_str_cols:
    :return:
    """

    # end cols
    dic_end_col_names = {}
    rank_cols = []
    for proc in graph_param.array_formval:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            sql_label = gen_sql_label(col_id, col_name)
            cols_in_df = [col for col in df_orig.columns if col.startswith(sql_label)]
            target_col_info = dic_str_cols.get(sql_label)
            if target_col_info:
                rank_cols += cols_in_df
            else:
                for col_in_df in cols_in_df:
                    dic_end_col_names[col_in_df] = (proc.proc_id, col_id, col_name)

    # category
    dic_cate_names = {}
    cat_exp_col = graph_param.common.cat_exp
    for proc in graph_param.common.cate_procs:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            if cat_exp_col:
                sql_label = gen_sql_label(CATEGORY_DATA, col_id, col_name)
            else:
                sql_label = gen_sql_label(col_id, col_name)

            if sql_label in df_orig.columns:
                dic_cate_names[sql_label] = (proc.proc_id, col_id, col_name)

    all_cols = list(
        set([Cycle.time.key] + list(dic_end_col_names) + list(dic_cate_names) + rank_cols)
    )
    group_col = '__group_col__'
    index_col = '__index_col__'
    all_cols = [col for col in all_cols if col in df_orig.columns]
    df = df_orig[all_cols]
    x_option = graph_param.common.x_option or 'TIME'
    if x_option.upper() == 'TIME':
        df[group_col] = pd.to_datetime(df[Cycle.time.key]).values.astype(float)
        min_epoc_time = df[group_col].min()
        max_epoc_time = df[group_col].max()
        count_per_group = calc_data_per_group(min_epoc_time, max_epoc_time)
        df[group_col] = (df[group_col] - min_epoc_time) // count_per_group
        df[group_col] = df[group_col].astype(int)
    else:
        count_per_group = ceil(len(df) / THIN_DATA_CHUNK)
        df[group_col] = df.index // count_per_group

    # count element in one group
    group_counts = df[group_col].value_counts().tolist()

    df[index_col] = df.index
    df.set_index(group_col, inplace=True)
    total_group = len(group_counts)

    # get category mode(most common)
    df_blank = pd.DataFrame(index=range(total_group))
    dfs = [df_blank]
    str_cols = list(set(list(dic_cate_names) + rank_cols))
    df_cates = None
    if str_cols:
        df_temp = df[str_cols]
        df_temp = df_temp.groupby(group_col).agg(get_mode)

        for col in str_cols:
            if col not in df_temp.columns:
                df_temp[col] = None

        df_cates = pd.concat([df_blank, df_temp], axis=1)
        if rank_cols:
            dfs.append(df_cates[rank_cols])

    cols = []
    dic_min_med_max = {}

    # get from, to and count of each slot
    df_from_to_count = df.groupby(group_col)[Cycle.time.key].agg(['max', 'min', 'count'])

    df_not_na = df.replace([float('-inf'), float('inf')], np.nan).notna()

    # select all group which has all na value
    df_group_all_na = (~df_not_na).groupby(group_col).all()

    for sql_label, (proc_id, *_) in dic_end_col_names.items():
        df_temp = df[[Cycle.time.key, index_col, sql_label]]

        # get df remove -inf, inf and NA
        df_drop = df_temp[df_not_na[sql_label]]

        # get remaining group has only inf, -inf, NA
        remaining_df = df_temp[df_group_all_na[sql_label]]

        # calc min med max of 2 df and merge to one
        df_min_med_max_1 = df_drop.groupby(group_col)[sql_label].agg(['min', 'median', 'max'])
        df_min_med_max_2 = remaining_df.groupby(group_col)[sql_label].agg(['min', 'median', 'max'])
        df_min_med_max = pd.concat([df_min_med_max_1, df_min_med_max_2]).sort_index()

        # get idxs of each group
        df_temp.drop(sql_label, axis=1, inplace=True)
        df_temp = df_temp.groupby(group_col).agg('min')
        df_temp = df_temp.rename(columns={index_col: sql_label})
        if len(df_temp) == 0:
            blank_vals = [None] * total_group
            df_temp[sql_label] = blank_vals

        dfs.append(df_temp)
        cols.append(sql_label)
        dic_min_med_max[sql_label] = df_min_med_max

    df_box = pd.concat(dfs, axis=1)

    # add time
    # start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    # end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
    # times = pd.date_range(start=start_tm, end=end_tm, periods=THIN_DATA_CHUNK)
    # df_box[Cycle.time.key] = times
    # df_box[Cycle.time.key] = df_box[Cycle.time.key].astype('datetime64[s]')

    # remove blanks
    if x_option.upper() == 'TIME':
        df_box.dropna(how='all', subset=cols + rank_cols, inplace=True)

    # in case of select category sensors only, it should be add "time" into df
    if Cycle.time.key not in df_box.columns.tolist():
        df_box[Cycle.time.key] = df_from_to_count['min']

    # remove blank category
    dic_cates = defaultdict(dict)
    dic_org_cates = defaultdict(dict)
    for sql_label, (proc_id, col_id, _) in dic_cate_names.items():
        if df_cates is not None and sql_label in df_cates:
            dic_cates[proc_id][col_id] = df_cates.loc[df_box.index, sql_label].tolist()
        dic_org_cates[proc_id][col_id] = get_available_ratio(df[sql_label])

    return df_box, dic_cates, dic_org_cates, group_counts, df_from_to_count, dic_min_med_max


def get_min_median_max_pos(df):
    # last = len(df) - 1
    last = df.size - 1
    mid = last // 2
    try:
        return df.iloc[[0, mid, last]].to_list()
    except Exception as e:
        raise e


def calc_data_per_group(min_val, max_val, box=THIN_DATA_CHUNK):
    dif_val = max_val - min_val + 1
    ele_per_box = dif_val / box
    return ele_per_box


def reduce_stepped_chart_data(array_y):
    rows = [None] * len(array_y)

    idx = 0
    for key, vals in groupby(array_y):
        rows[idx] = key
        idx += len(list(vals))

    return rows


@log_execution_time()
def calc_raw_common_scale_y(plots, string_col_ids=None, y_col=ARRAY_Y):
    """
    calculate y min max in common scale
    :param plots:
    :param string_col_ids:
    :return:
    """
    y_commons = []
    min_max_list = []
    for plot in plots:
        s = pd.Series(plot[y_col])

        s = s[s.notnull()]
        if not len(s):
            min_max_list.append((None, None))
            continue

        s = convert_series_to_number(s)
        # if s.dtypes == 'string':
        #     min_max_list.append((None, None))
        #     continue
        s_without_inf = s[np.isfinite(s)]

        min_val = s_without_inf.min()
        max_val = s_without_inf.max()
        if pd.isna(min_val):
            min_val = None
        if pd.isna(max_val):
            max_val = None

        min_max_list.append((min_val, max_val))

        if string_col_ids and plot[END_COL_ID] in string_col_ids:
            continue

        if min_val is not None:
            y_commons.append(min_val)

        if max_val is not None:
            y_commons.append(max_val)

    all_graph_min = None
    all_graph_max = None
    if y_commons:
        all_graph_min = min(y_commons)
        all_graph_max = max(y_commons)

    return min_max_list, all_graph_min, all_graph_max


def calc_rlp_raw_common_scale(plots):
    """
    calculate y min max in common scale
    :param dic_param:
    :return:
    """
    y_commons = []
    min_max_list = []
    for plot in plots:
        s = pd.Series(plot[ARRAY_Y])

        s = s[s.notnull()]
        if not len(s):
            min_max_list.append((None, None))
            continue

            s = convert_series_to_number(s)
            s_without_inf = s[np.isfinite(s)]
            min_val = s_without_inf.min()
            max_val = s_without_inf.max()
            min_max_list.append((min_val, max_val))

        # if plot[END_COL_ID] in dic_param[STRING_COL_IDS]:
        #     continue

        if min_val is not None:
            y_commons.append(min_val)

        if max_val is not None:
            y_commons.append(max_val)

    all_graph_min = None
    all_graph_max = None
    if y_commons:
        all_graph_min = min(y_commons)
        all_graph_max = max(y_commons)

    return min_max_list, all_graph_min, all_graph_max


def detect_abnormal_data(series_x, series_y, none_idxs=None):
    nones = none_idxs
    if none_idxs is None:
        nones = series_y[series_y.isnull()].index.tolist()

    return {
        UNLINKED_IDXS: series_x[series_x.isnull()].index.tolist(),
        NONE_IDXS: nones,
        INF_IDXS: series_y[series_y == float('inf')].index.tolist(),
        NEG_INF_IDXS: series_y[series_y == float('-inf')].index.tolist(),
    }


def calc_auto_scale_y(plotdata, series_y):
    series_y = convert_series_to_number(series_y)
    notna_series_y = series_y[series_y.notna()]
    if not len(notna_series_y) or series_y.dtypes == object:
        return {Y_MIN: 0, Y_MAX: 1, LOWER_OUTLIER_IDXS: [], UPPER_OUTLIER_IDXS: []}

    summaries = plotdata.get(SUMMARIES) or []
    lower_range = None
    upper_range = None
    for summary in summaries:
        dic_non_param = summary.get('non_parametric')
        if dic_non_param:
            lower_range = dic_non_param.get('lower_range_org')
            upper_range = dic_non_param.get('upper_range_org')

    if lower_range is None:
        p25, p75 = np.percentile(notna_series_y, [25, 75])
        iqr = p75 - p25
        lower_range = p25 - 2.5 * iqr
        upper_range = p75 + 2.5 * iqr

    lower_outlier_idxs = (
        series_y[series_y < lower_range].index.tolist() if lower_range is not None else []
    )
    upper_outlier_idxs = (
        series_y[series_y > upper_range].index.tolist() if upper_range is not None else []
    )

    if upper_range == lower_range:
        lower_outlier_idxs = []
        upper_outlier_idxs = []

    if lower_range and series_y.min() >= 0:
        lower_range = max(0, lower_range)

    if upper_range and series_y.max() <= 0:
        upper_range = min(0, upper_range)

    lower_range, upper_range = extend_min_max(lower_range, upper_range)

    return {
        Y_MIN: lower_range,
        Y_MAX: upper_range,
        LOWER_OUTLIER_IDXS: lower_outlier_idxs,
        UPPER_OUTLIER_IDXS: upper_outlier_idxs,
    }


def calc_setting_scale_y(plotdata, series_y):
    series_y = convert_series_to_number(series_y)
    # calculate upper/lower limit
    chart_infos = plotdata.get(CHART_INFOS)
    dic_scale_auto = plotdata.get(SCALE_AUTO, {})
    if not chart_infos:
        if dic_scale_auto:
            return dic_scale_auto

        return {Y_MIN: series_y.min(), Y_MAX: series_y.max()}

    ymin, ymax = get_min_max_of_all_chart_infos(chart_infos)
    if ymin is None and ymax is None:
        if dic_scale_auto:
            return dic_scale_auto

        return {Y_MIN: series_y.min(), Y_MAX: series_y.max()}

    if ymin is None:
        ymin = dic_scale_auto.get(Y_MIN)
        lower_outlier_idxs = dic_scale_auto.get(LOWER_OUTLIER_IDXS)
    else:
        lower_outlier_idxs = series_y[series_y < ymin].index.tolist()

    if ymax is None:
        ymax = dic_scale_auto.get(Y_MAX)
        upper_outlier_idxs = dic_scale_auto.get(UPPER_OUTLIER_IDXS)
    else:
        upper_outlier_idxs = series_y[series_y > ymax].index.tolist()

    ymin, ymax = extend_min_max(ymin, ymax)

    return {
        Y_MIN: ymin,
        Y_MAX: ymax,
        LOWER_OUTLIER_IDXS: lower_outlier_idxs,
        UPPER_OUTLIER_IDXS: upper_outlier_idxs,
    }


def calc_threshold_scale_y(plotdata, series_y):
    series_y = convert_series_to_number(series_y)
    # calculate upper/lower limit
    chart_infos = plotdata.get(CHART_INFOS)
    dic_scale_auto = plotdata.get(SCALE_AUTO, {})
    if not chart_infos:
        return dic_scale_auto

    thresh_low, thresh_high = get_threshold_min_max_chartinfo(chart_infos)
    if thresh_low is None and thresh_high is None:
        return dic_scale_auto

    lower_range, upper_range = calc_upper_lower_range(series_y)
    if thresh_low is None:
        thresh_low = dic_scale_auto.get(THRESH_LOW) or lower_range

    if thresh_high is None:
        thresh_high = dic_scale_auto.get(THRESH_HIGH) or upper_range

    margin = (thresh_high - thresh_low) * 0.1  # margin 10%
    upper_margin_val = thresh_high + margin
    lower_margin_val = thresh_low - margin

    lower_outlier_idxs = series_y[series_y < lower_margin_val].index.tolist()
    upper_outlier_idxs = series_y[series_y > upper_margin_val].index.tolist()

    return {
        Y_MIN: thresh_low,
        Y_MAX: thresh_high,
        LOWER_OUTLIER_IDXS: lower_outlier_idxs,
        UPPER_OUTLIER_IDXS: upper_outlier_idxs,
    }


@log_execution_time()
def calc_scale_info(
    array_plotdata,
    min_max_list,
    all_graph_min,
    all_graph_max,
    string_col_ids=None,
    has_val_idxs=None,
    end_col_id=END_COL_ID,
    y_col=ARRAY_Y,
):
    dic_datetime_cols = {}
    for idx, plotdata in enumerate(array_plotdata):
        # datetime column
        proc_id = plotdata.get(END_PROC_ID)
        col_id = plotdata.get(END_COL_ID)
        if proc_id and proc_id not in dic_datetime_cols:
            dic_datetime_cols[proc_id] = {
                cfg_col.id: cfg_col
                for cfg_col in CfgProcessColumn.get_by_data_type(proc_id, DataType.DATETIME)
            }

        is_datetime_col = True if col_id in dic_datetime_cols.get(proc_id, {}) else False

        y_min = min_max_list[idx][0] if min_max_list else None
        y_min = all_graph_min if y_min is None else y_min
        y_max = min_max_list[idx][1] if min_max_list else None
        y_max = all_graph_max if y_max is None else y_max

        y_min, y_max = extend_min_max(y_min, y_max)
        all_graph_min, all_graph_max = extend_min_max(all_graph_min, all_graph_max)

        array_y = plotdata.get(ARRAY_Y)
        array_x = plotdata.get(ARRAY_X)
        if (
            (not len(array_y))
            or (not len(array_x))
            or (string_col_ids and plotdata[END_COL_ID] in string_col_ids)
        ):
            dic_base_scale = {
                Y_MIN: y_min,
                Y_MAX: y_max,
                LOWER_OUTLIER_IDXS: [],
                UPPER_OUTLIER_IDXS: [],
            }
            plotdata[SCALE_AUTO] = dic_base_scale
            plotdata[SCALE_SETTING] = dic_base_scale
            plotdata[SCALE_THRESHOLD] = dic_base_scale
            plotdata[SCALE_COMMON] = dic_base_scale
            plotdata[SCALE_FULL] = dic_base_scale
            continue

        series_x = pd.Series(array_x)
        series_y = pd.Series(array_y)

        # don't do with all blank idxs
        if has_val_idxs is not None:
            series_x = series_x.loc[has_val_idxs]
            series_y = series_y.loc[has_val_idxs]

        none_idxs = plotdata.get(NONE_IDXS)
        dic_abnormal_data = detect_abnormal_data(series_x, series_y, none_idxs)
        plotdata.update(dic_abnormal_data)
        for _idxs in dic_abnormal_data.values():
            if _idxs:
                # array_y[_idxs] = None
                for _idx in _idxs:
                    array_y[_idx] = None

        series_y = pd.Series(array_y)
        if has_val_idxs is not None:
            series_y = series_y.loc[has_val_idxs]

        series_y = convert_series_to_number(series_y)
        plotdata[SCALE_AUTO] = calc_auto_scale_y(plotdata, series_y)
        if is_datetime_col:
            plotdata[SCALE_AUTO][Y_MIN] = y_min

        plotdata[SCALE_SETTING] = calc_setting_scale_y(plotdata, series_y)
        plotdata[SCALE_THRESHOLD] = calc_threshold_scale_y(plotdata, series_y)
        plotdata[SCALE_COMMON] = {
            Y_MIN: all_graph_min,
            Y_MAX: all_graph_max,
            LOWER_OUTLIER_IDXS: [],
            UPPER_OUTLIER_IDXS: [],
        }
        plotdata[SCALE_FULL] = {
            Y_MIN: y_min,
            Y_MAX: y_max,
            LOWER_OUTLIER_IDXS: [],
            UPPER_OUTLIER_IDXS: [],
        }
        if is_datetime_col:
            plotdata[SCALE_FULL][Y_MIN] = 0

    return True


@log_execution_time()
def gen_kde_data_trace_data(dic_param, full_arrays=None):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        full_array_y = full_arrays[num] if full_arrays else None
        kde_list = calculate_kde_trace_data(plotdata, full_array_y=full_array_y)
        (
            plotdata[SCALE_SETTING][KDE_DATA],
            plotdata[SCALE_COMMON][KDE_DATA],
            plotdata[SCALE_THRESHOLD][KDE_DATA],
            plotdata[SCALE_AUTO][KDE_DATA],
            plotdata[SCALE_FULL][KDE_DATA],
        ) = kde_list

    calculate_histogram_count_common(array_plotdata)

    return dic_param


def extend_min_max(y_min, y_max):
    if y_max is None:
        y_max = y_min * 1.2 if y_min is not None else 1

    if y_min is None:
        y_min = y_max * 0.8

    if y_min == y_max:
        y_min *= 0.8
        y_max *= 1.2

    if y_min == 0 and y_max == 0:
        y_min = -1
        y_max = 1

    return y_min, y_max


def copy_dic_param_to_thin_dic_param(dic_param, dic_thin_param):
    ignore_keys = [COMMON, ARRAY_FORMVAL, ARRAY_PLOTDATA, CYCLE_IDS, SERIAL_DATA]
    for key, val in dic_param.items():
        if key in ignore_keys:
            continue

        dic_thin_param[key] = dic_param[key]

    return True


def gen_thin_df_cat_exp(dic_param):
    df = pd.DataFrame()
    dic_end_cols = {}

    # df['index'] = list(range(len(dic_param[TIMES])))
    df[Cycle.id.key] = dic_param[CYCLE_IDS]
    df[Cycle.time.key] = dic_param[TIMES]

    for plot in dic_param[ARRAY_PLOTDATA] or []:
        time_sql_label = f'time_{plot[END_PROC_ID]}'
        if time_sql_label not in df.columns:
            df[time_sql_label] = plot[ARRAY_X]

        sql_label = gen_sql_label(plot[END_COL_ID], plot[END_COL_NAME], plot.get(CAT_EXP_BOX))
        dic_end_cols[sql_label] = (plot[END_COL_ID], plot[END_COL_NAME], plot.get(CAT_EXP_BOX))
        df[sql_label] = plot[ARRAY_Y]

    # serials
    add_serials_to_thin_df(dic_param, df)

    # categories
    add_categories_to_thin_df(dic_param, df)

    return df, dic_end_cols


def get_available_ratio(series: Series):
    n_total = series.size
    # na_counts = series.isnull().sum().sum()
    non_na_counts = len(series.dropna())
    na_counts = n_total - non_na_counts
    na_percentage = (100 * na_counts / n_total) if n_total else 0
    non_na_percentage = 100 - na_percentage
    return dict(
        nTotal=n_total, nonNACounts=non_na_counts, nonNAPercentage=signify_digit(non_na_percentage)
    )


@log_execution_time()
def add_serials_to_thin_df(dic_param, df):
    for plot in dic_param[ARRAY_PLOTDATA] or []:
        proc_id = plot[END_PROC_ID]
        sql_label = gen_sql_label(SERIAL_DATA, proc_id)
        if sql_label in df.columns:
            continue

        serials = dic_param.get(SERIAL_DATA, {}).get(proc_id)
        if serials is not None and len(serials):
            df[sql_label] = serials


@log_execution_time()
def add_categories_to_thin_df(dic_param, df):
    for dic_cate in dic_param.get(CATEGORY_DATA) or []:
        col_id = dic_cate.get('column_id')
        col_name = dic_cate.get('column_name')
        data = dic_cate.get('data')
        sql_label = gen_sql_label(CATEGORY_DATA, col_id, col_name)
        if sql_label in df.columns:
            continue

        df[sql_label] = data


@log_execution_time()
def get_serials_and_date_col(graph_param: DicParam, dic_proc_cfgs):
    dic_output = {}
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serial_cols = proc_cfg.get_serials(column_name_only=False)
        datetime_col = proc_cfg.get_date_col(column_name_only=False)
        dic_output[proc.proc_id] = (datetime_col, serial_cols)

    return dic_output


@log_execution_time()
def gen_cat_exp_names(cat_exps):
    if cat_exps:
        return [gen_sql_label(CAT_EXP_BOX, level) for level, _ in enumerate(cat_exps, 1)]

    return None


@log_execution_time()
def gen_unique_data(df, dic_proc_cfgs, col_ids, has_na=False):
    if not col_ids:
        return {}

    dic_unique_cate = {}
    dic_cols = {col.id: col for col in CfgProcessColumn.get_by_ids(col_ids)}
    for col_id in col_ids:
        cfg_col = dic_cols.get(col_id)
        col_name = cfg_col.column_name
        master_name = cfg_col.shown_name
        proc_id = cfg_col.process_id
        col_type = cfg_col.data_type
        if col_type not in [DataType.TEXT.name, DataType.INTEGER.name]:
            continue
        sql_label = gen_sql_label(RANK_COL, col_id, col_name)
        if sql_label not in df.columns:
            sql_label = gen_sql_label(col_id, col_name)

        unique_data = []
        if sql_label in df.columns:
            # unique_data = df[sql_label].drop_duplicates().dropna().tolist()
            s = df[sql_label].value_counts(dropna=not has_na)
            unique_data = s.index.tolist()

        cfg_proc_name = dic_proc_cfgs[proc_id].shown_name
        unique_data = {
            'proc_name': proc_id,
            'proc_master_name': cfg_proc_name,
            'column_name': col_name,
            'column_master_name': master_name,
            'column_id': col_id,
            UNIQUE_CATEGORIES: unique_data,
            COL_DATA_TYPE: cfg_col.data_type,
        }

        dic_unique_cate[col_id] = unique_data

    return dic_unique_cate


@log_execution_time()
def filter_df(df, dic_filter):
    if not dic_filter:
        return df

    dic_names = {col.id: col for col in CfgProcessColumn.get_by_ids(dic_filter)}
    for col_id, vals in dic_filter.items():
        if not vals:
            continue

        if not isinstance(vals, (list, tuple)):
            vals = [vals]

        if NO_FILTER in vals:
            continue

        vals = [val for val in vals if val not in [SELECT_ALL, NO_FILTER]]
        if not vals:
            continue

        cfg_col = dic_names.get(col_id, None)
        if cfg_col is None:
            continue

        sql_label = gen_sql_label(RANK_COL, col_id, cfg_col.column_name)
        if sql_label not in df.columns:
            sql_label = gen_sql_label(col_id, cfg_col.column_name)

        is_filter_nan = False
        if None in vals:
            is_filter_nan = True
            vals.remove(None)
        dtype_name = cfg_col.data_type
        if dtype_name == DataType.INTEGER.name:
            vals = [int(val) for val in vals]
        elif dtype_name == DataType.REAL.name:
            vals = [float(val) for val in vals]
        elif dtype_name == DataType.TEXT.name:
            vals = [str(val) for val in vals]
            df[sql_label] = df[sql_label].astype(str)
        else:
            pass

        if is_filter_nan:
            vals += [np.nan, np.inf, -np.inf, 'nan', '<NA>', np.NAN, pd.NA]

        df = df[df[sql_label].isin(vals)]

        df[sql_label] = df[sql_label].replace(['nan', '<NA>'], np.nan)

    df.reset_index(drop=True, inplace=True)
    return df


def gen_category_info(dic_param, dic_ranks):
    for plot in dic_param[ARRAY_PLOTDATA]:
        if plot[END_COL_ID] in dic_ranks:
            # category variable
            p_array_y = pd.Series(plot[ARRAY_Y]).dropna().tolist()
            cat_size = 0
            if len(p_array_y):
                cat_size = np.unique(p_array_y).size
            plot[CAT_TOTAL] = cat_size
            plot[IS_CAT_LIMITED] = True if cat_size >= MAX_CATEGORY_SHOW else False
    return dic_param


@memoize()
def get_cfg_proc_col_info(col_ids):
    dic_cols = {cfg_col.id: cfg_col for cfg_col in CfgProcessColumn.get_by_ids(col_ids)}
    proc_ids = list(set(cfg_col.process_id for cfg_col in dic_cols.values()))
    dic_procs = {cfg_proc.id: cfg_proc for cfg_proc in CfgProcess.get_procs(proc_ids)}

    return dic_procs, dic_cols


@log_execution_time()
def calculate_histogram_count_common(array_plotdata):
    x_min = {}
    x_max = {}
    for scale in [SCALE_SETTING, SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL]:
        x_min[scale] = 0
        x_max[scale] = 0
        fmt = {}
        for num, plotdata in enumerate(array_plotdata):
            hist_count = plotdata[scale][KDE_DATA][RL_HIST_COUNTS]
            x_min[scale] = min(x_min[scale], min(hist_count, default=0))
            x_max[scale] = max(x_max[scale], max(hist_count, default=0))

            col_id = plotdata.get(END_COL_ID) or plotdata.get(END_COL)
            hist_labels = plotdata[scale][KDE_DATA][RL_HIST_LABELS]
            if len(hist_labels) > 0:
                hist_labels = hist_labels.tolist()
            else:
                hist_labels = []
            if col_id not in fmt:
                fmt[col_id] = hist_labels
            else:
                fmt[col_id] += hist_labels

        for col, full_array in fmt.items():
            fmt[col] = get_fmt_from_array(full_array)

        for num, plotdata in enumerate(array_plotdata):
            col_id = plotdata.get(END_COL_ID) or plotdata.get(END_COL)
            # convert to int instead of np.int64 in some cases
            plotdata[scale]['x-min'] = int(x_min[scale])
            plotdata[scale]['x-max'] = int(x_max[scale])
            plotdata[scale]['label_fmt'] = fmt[col_id]


@log_execution_time()
def get_outlier_info(remove_outlier_type):
    percent = 0.25  # default p25-p75
    actual_type = RemoveOutlierType.O6M
    distance = 0
    if remove_outlier_type in [
        RemoveOutlierType.O6M,
        RemoveOutlierType.O6I,
        RemoveOutlierType.O6U,
        RemoveOutlierType.O6L,
    ]:
        distance = 2.5  # +- 2.5iqr

    if remove_outlier_type in [
        RemoveOutlierType.O4M,
        RemoveOutlierType.O4I,
        RemoveOutlierType.O4U,
        RemoveOutlierType.O4L,
    ]:
        distance = 1.5  # +- 1.5iqr

    if remove_outlier_type in [RemoveOutlierType.OP1]:
        percent = 0.01  # p1-p99

    if remove_outlier_type in [RemoveOutlierType.OP5]:
        percent = 0.05  # p5-p95

    if remove_outlier_type in [
        RemoveOutlierType.O4M,
        RemoveOutlierType.O6M,
        RemoveOutlierType.OP1,
        RemoveOutlierType.OP5,
    ]:
        actual_type = RemoveOutlierType.Majority

    if remove_outlier_type in [RemoveOutlierType.O4I, RemoveOutlierType.O6I]:
        actual_type = RemoveOutlierType.Minority

    if remove_outlier_type in [RemoveOutlierType.O4U, RemoveOutlierType.O6U]:
        actual_type = RemoveOutlierType.Upper

    if remove_outlier_type in [RemoveOutlierType.O6L, RemoveOutlierType.O4L]:
        actual_type = RemoveOutlierType.Lower

    return actual_type, percent, distance


@log_execution_time()
def remove_outlier(df: DataFrame, sensor_labels, graph_param):
    if df.empty:
        return df
    remove_outlier_type = graph_param.common.remove_outlier_type
    is_real_only = graph_param.common.remove_outlier_real_only

    actual_type, percent, distance = get_outlier_info(remove_outlier_type)
    upper_limit = 1 - percent
    lower_limit = percent

    valid_cols = [col for col in df.columns if col in sensor_labels]

    # limits to a (float), b (int) and e (timedelta)
    if is_real_only:
        numeric_cols = df.loc[:, valid_cols].select_dtypes('float').columns
    else:
        numeric_cols = df.loc[:, valid_cols].select_dtypes('number').columns
    df_sub = df.loc[:, numeric_cols]
    for target_col in numeric_cols:
        series = df_sub[target_col].replace(dict.fromkeys([pd.NA], np.nan))
        lower, upper, q1, q3 = series.quantile([lower_limit, upper_limit, 0.25, 0.75])
        # do not apply outlier of q1 = q3
        if q1 == q3:
            continue

        iqr = upper - lower
        lower_whisker = lower - distance * iqr
        upper_whisker = upper + distance * iqr
        condition = None

        if actual_type == RemoveOutlierType.Majority:
            condition = (df_sub[target_col] < lower_whisker) | (df_sub[target_col] > upper_whisker)
        elif actual_type == RemoveOutlierType.Minority:
            condition = (df_sub[target_col] > lower_whisker) & (df_sub[target_col] < upper_whisker)
        elif actual_type == RemoveOutlierType.Upper:
            condition = df_sub[target_col] < upper_whisker
        elif actual_type == RemoveOutlierType.Lower:
            condition = df_sub[target_col] > lower_whisker

        df.loc[condition, target_col] = pd.NA

    return df


@log_execution_time()
def get_serial_and_datetime_data(df, graph_param, dic_proc_cfgs):
    serials = []
    datetime = []
    start_proc_name = ''
    for proc in dic_proc_cfgs:
        if proc == graph_param.common.start_proc:
            start_proc = dic_proc_cfgs[proc]
            if start_proc:
                start_proc_name = start_proc.shown_name
                serial_cols = start_proc.get_serials(column_name_only=False)
                datetime_col = start_proc.get_date_col(column_name_only=False)
                datetime_id = datetime_col.id
                datetime_label = gen_sql_label(datetime_id, datetime_col.column_name)
                if datetime_label not in df.columns:
                    datetime_label = f'time_{proc}'
                datetime = df[datetime_label].to_list()
                for serial_col in serial_cols:
                    serial_label = gen_sql_label(serial_col.id, serial_col.column_name)
                    if serial_label in df.columns:
                        serials.append(df[serial_label].to_list())

    return serials, datetime, start_proc_name


def gen_proc_time_label(proc_id):
    return f'{Cycle.time.key}_{str(proc_id)}'


def gen_link_val_label(link_key):
    proc_link_first_cls = ProcLink.get_first_cls()
    link_val_col = proc_link_first_cls.link_value.key
    return f'{link_val_col}_{link_key}'


def get_substr_col_name(orig_col_name, from_char, to_char):
    if from_char or to_char:
        substr_col_name = SUB_STRING_COL_NAME.format(orig_col_name, from_char, to_char)
    else:
        substr_col_name = orig_col_name
    return substr_col_name


def gen_sensor_ids_from_trace_keys(edge, dic_mapping_col_n_sensor):
    self_sensor_ids = []
    target_sensor_ids = []
    for key in edge.trace_keys:
        self_name = get_substr_col_name(
            key.self_column.column_name, key.self_column_substr_from, key.self_column_substr_to
        )
        _, self_sensor = dic_mapping_col_n_sensor.get(edge.self_process_id, {}).get(
            self_name, (None, None)
        )
        if self_sensor is None:
            self_sensor_ids.append(None)
        else:
            self_sensor_ids.append(self_sensor.id)

        target_name = get_substr_col_name(
            key.target_column.column_name,
            key.target_column_substr_from,
            key.target_column_substr_to,
        )
        _, target_sensor = dic_mapping_col_n_sensor.get(edge.target_process_id, {}).get(
            target_name, (None, None)
        )
        if target_sensor is None:
            target_sensor_ids.append(None)
        else:
            target_sensor_ids.append(target_sensor.id)

    return self_sensor_ids, target_sensor_ids


def get_original_serial(sensor_id):
    sensor = Sensor.get_sensor_by_id(sensor_id)
    substr_regex = re.compile(SUB_STRING_REGEX)
    matches = substr_regex.match(sensor.column_name)
    if not matches:
        return None

    original_sensor_column_name = matches[1]
    return sensor.process_id, original_sensor_column_name


@log_execution_time()
def gen_graph_df_one_proc(
    start_proc_id,
    start_tm,
    end_tm,
    dic_mapping_col_n_sensor,
    end_procs,
    short_procs,
    dic_conditions,
    dup_show,
    for_count=False,
):
    valid_end_procs = [_proc for _proc in end_procs if _proc.proc_id in short_procs]
    if valid_end_procs:
        end_proc = valid_end_procs[0]
        end_proc_id = end_proc.proc_id
        cfg_process: CfgProcess = CfgProcess.query.get(end_proc_id)
        serial_cols = cfg_process.get_serials(column_name_only=False)
        getdate_col = cfg_process.get_date_col(column_name_only=False)
        if for_count:
            column_ids = end_proc.col_ids[:1]
            column_names = end_proc.col_names[:1]
        else:
            column_ids = end_proc.col_ids
            column_names = end_proc.col_names
    else:
        end_proc_id = start_proc_id
        column_ids = []
        column_names = []

    cycle_cls = find_cycle_class(end_proc_id)
    cycle_table_name = cycle_cls.__table__.name

    immediate_isolation_level = bool(dic_conditions)
    with DbProxy(gen_data_source_of_universal_db(), True, immediate_isolation_level) as db_instance:
        if dic_conditions:
            # add regular expression function to db
            db_instance.connection.create_function(SQL_REGEXP_FUNC, 2, sql_regexp)

        dfs = []
        for col_ids, col_names in chunk_two_list(column_ids, column_names, 50):
            if getdate_col.id not in col_ids:
                col_ids.append(getdate_col.id)
                col_names.append(getdate_col.column_name)

            for serial_col in serial_cols:
                if serial_col.id not in col_ids:
                    col_ids.append(serial_col.id)
                    col_names.append(serial_col.column_name)

            sql, params = gen_trace_sensors_sql(
                end_proc_id,
                col_names,
                dic_mapping_col_n_sensor,
                cycle_table_name,
                Cycle.id.key,
                Cycle.time.key,
                start_tm,
                end_tm,
                where_proc_id=True,
                dic_conditions=dic_conditions,
                dup_serials_show=dup_show,
            )

            _, rows = db_instance.run_sql(sql, params=params, row_is_dict=False)

            labels = [
                gen_sql_label(_col_id, _col_name) for _col_id, _col_name in zip(col_ids, col_names)
            ]
            _df = pd.DataFrame(
                rows, columns=[Cycle.id.key, gen_proc_time_label(end_proc_id)] + labels
            )

            dfs.append(_df)

        df = None
        actual_total_record = 0
        len_df = len(dfs)
        if not len_df:
            return df, actual_total_record

        if len_df == 1:
            df = dfs[0]
        else:
            idx_cols = dfs[0].columns.intersection(dfs[1].columns).tolist()
            for _df in dfs:
                _df.set_index(idx_cols, inplace=True)

            df = pd.concat(dfs, axis='columns')
            df.reset_index(inplace=True)

        actual_total_record = len(df)

    return df, actual_total_record


@log_execution_time()
def get_unique_category(category_list):
    unique_vals = pd.Series(category_list).value_counts(dropna=False).index.tolist()
    is_over_limit = len(unique_vals) > CAT_UNIQUE_LIMIT
    return unique_vals, is_over_limit


@log_execution_time()
def category_data_merging(cat_data={}, data=[]):
    for item in data:
        # assign unique category value by larger list
        if item[COL_ID] not in cat_data:
            unique_vals, is_over_cat_limit = get_unique_category(item[UNIQUE_CATEGORIES])
            cat_data[item[COL_ID]] = {
                PROC_NAME: item[PROC_NAME],
                PROC_MASTER_NAME: item[PROC_MASTER_NAME],
                COL_NAME: item[COL_NAME],
                COL_MASTER_NAME: item[COL_MASTER_NAME]
                if COL_MASTER_NAME in item
                else item[COL_NAME],
                COL_ID: item[COL_ID],
                UNIQUE_CATEGORIES: unique_vals,
                IS_OVER_UNIQUE_LIMIT: is_over_cat_limit,
            }
        elif len(item[UNIQUE_CATEGORIES]) > len(cat_data[item[COL_ID]][UNIQUE_CATEGORIES]):
            cat_data[item[COL_ID]][UNIQUE_CATEGORIES] = item[UNIQUE_CATEGORIES]

    return cat_data


@log_execution_time()
def gen_cat_plotdata(plot_data, array_y=[], dic_proc_cfgs={}):
    if COL_DETAIL in plot_data:
        # pcp
        proc_id = plot_data[COL_DETAIL][PROC_ID]
    else:
        if END_PROC_ID not in plot_data:
            # scp
            return []

        proc_id = plot_data[END_PROC_ID]

    col_id = plot_data[END_COL_ID] if END_COL_ID in plot_data else plot_data[END_COL]
    [column_data, *_] = dic_proc_cfgs[proc_id].get_cols([col_id])
    if column_data and column_data.data_type in [DataType.INTEGER.name, DataType.TEXT.name]:
        col_name = column_data.shown_name
        cat_list = array_y or plot_data[ARRAY_Y]
        if ORG_ARRAY_Y in plot_data and plot_data[ORG_ARRAY_Y]:
            cat_list = plot_data[ORG_ARRAY_Y]
        unique_vals, is_over_unique_lim = get_unique_category(cat_list)
        if RANK_COL in plot_data:
            # code transformed for string variable
            # get origin value to show on demand filter box
            [rank_code, rank_val] = plot_data[RANK_COL]
            org_value = []
            for unq_val in unique_vals:
                if unq_val in rank_code:
                    item_index = rank_code.index(unq_val)
                    org_val = rank_val[item_index]
                    if org_val:
                        org_value.append(org_val)
            if org_value:
                unique_vals = org_value
        return {
            PROC_NAME: proc_id,
            PROC_MASTER_NAME: dic_proc_cfgs[proc_id].shown_name,
            COL_NAME: col_name,
            COL_ID: col_id,
            UNIQUE_CATEGORIES: unique_vals,
            IS_OVER_UNIQUE_LIMIT: is_over_unique_lim,
        }
    return None


@log_execution_time()
def transform_array_plot_data(plot_datas, dic_proc_cfgs):
    all_plots = []
    if isinstance(plot_datas, dict):
        # stp
        for end_col, plot_data in plot_datas.items():
            array_y = []
            for plot_dat in plot_data:
                array_y += plot_dat[ARRAY_Y]
            cat_plot_data = gen_cat_plotdata(
                plot_data[0], array_y=array_y, dic_proc_cfgs=dic_proc_cfgs
            )
            if cat_plot_data:
                all_plots.append(cat_plot_data)
    else:
        for plot_data in plot_datas:
            cat_plot_data = gen_cat_plotdata(plot_data, dic_proc_cfgs=dic_proc_cfgs)
            if cat_plot_data:
                all_plots.append(cat_plot_data)

    return all_plots


@log_execution_time()
def gen_cat_data_for_ondemand(dic_param, dic_proc_cfgs, plotdata=None):
    cat_exp_box_data = dic_param.get(CAT_EXP_BOX) or []
    category_data = dic_param.get(CATEGORY_DATA) or []
    facet_and_label = cat_exp_box_data + category_data
    facet_and_label_ids = [var[COL_ID] for var in facet_and_label]
    # get category variables from plotdata
    array_y = plotdata or dic_param[ARRAY_PLOTDATA]
    plot_data = transform_array_plot_data(array_y, dic_proc_cfgs)

    # assign cat_data from facets
    cat_data = category_data_merging({}, data=cat_exp_box_data)
    # assign cat_data from labels
    cat_data = category_data_merging(cat_data, data=category_data)
    # assign cat data from array_plotdata
    cat_data = category_data_merging(cat_data, data=plot_data)

    dic_param[CAT_ON_DEMAND] = []
    for _, cat in cat_data.items():
        if cat[COL_ID] not in facet_and_label_ids:
            dic_param[CAT_ON_DEMAND].append(cat)

    return dic_param


@log_execution_time()
def retrieve_order_setting(dic_param, dic_proc_cfgs):
    dic_orders_columns = {}
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        order_cols = proc_cfg.get_order_cols(column_name_only=False, column_id_only=True)
        if len(order_cols):
            dic_orders_columns[proc_id] = [
                order_id for order_id in order_cols if order_id in dic_param[COMMON][DF_ALL_COLUMNS]
            ]
    dic_param[COMMON][AVAILABLE_ORDERS] = dic_orders_columns
    return dic_param


@log_execution_time()
def sort_df_by_x_option(
    df,
    dic_param,
    graph_param,
    dic_proc_cfgs,
    temp_x_option,
    temp_serial_process,
    temp_serial_column,
    temp_serial_order,
):
    if temp_x_option:
        df = check_and_order_data(
            df,
            dic_proc_cfgs,
            temp_x_option,
            temp_serial_process,
            temp_serial_column,
            temp_serial_order,
        )
        dic_param[COMMON][X_OPTION] = temp_x_option
        dic_param[COMMON][SERIAL_PROCESS] = temp_serial_process
        dic_param[COMMON][SERIAL_COLUMN] = temp_serial_column
        dic_param[COMMON][SERIAL_ORDER] = temp_serial_order
    else:
        x_option = graph_param.common.x_option or 'TIME'
        serial_processes = graph_param.common.serial_processes or []
        serial_cols = graph_param.common.serial_columns or []
        serial_orders = graph_param.common.serial_orders or []
        df = check_and_order_data(
            df, dic_proc_cfgs, x_option, serial_processes, serial_cols, serial_orders
        )

    return df, dic_param


@log_execution_time()
def discretize_float_data_equally(x, num_bins=10):
    """Discretize an 1D-NumpyArray with dtype=float
    Each value of x is replaced with the average value of its corresponding bin.
    For example, if x = np.array([0.0, 1.0, 2.0, 3.0]) and num_bins=2,
    this function will return [0.5, 0.5, 2.5, 2.5].
    """

    # NOTE:
    # 1. This function returns error when np.nan/np.inf exists
    # 2. x_discretized must have the same digits as x
    #    (If x is 123.45, x_discretized must be like 120.12)

    nuniq = len(np.unique(x))
    if nuniq <= num_bins:
        return x

    # get edges to categorize the data
    # +1 on the last elements ensures that the maximum value is included in the last bin
    bin_edges = np.histogram_bin_edges(x, bins=num_bins)
    bin_edges[-1] = bin_edges[-1] + 1
    assert len(bin_edges) == num_bins + 1

    # np.digitize returns bin number, starting from 1
    # (-1 is to let the bin number start from 0)
    bin_edges = np.array(bin_edges.tolist())
    x_discretized = np.digitize(x, bins=bin_edges) - 1

    # calculate sample size and sum of each x in each bin, then get averages
    counts = np.bincount(x_discretized)
    sums = np.bincount(x_discretized, weights=x)
    averages = sums / counts

    # replace the values of x to the average of its corresponding bin
    x_discretized = averages[x_discretized]
    return x_discretized
