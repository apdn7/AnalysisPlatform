import json
import re
import traceback
from collections import defaultdict, Counter
from copy import deepcopy
from itertools import groupby
from math import ceil
from typing import List, Dict

import numpy as np
import pandas as pd
from loguru import logger
from numpy import quantile
from pandas import DataFrame, Series
from sqlalchemy import and_, or_

from histview2 import db
from histview2.api.trace_data.services.regex_infinity import validate_data_with_regex, get_changed_value_after_validate, \
    validate_data_with_simple_searching, check_validate_target_column
from histview2.common.common_utils import as_list, get_debug_data
from histview2.common.common_utils import start_of_minute, end_of_minute, convert_time, add_days, gen_sql_label, \
    gen_sql_like_value, gen_python_regex, chunks, gen_abbr_name
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.services.ana_inf_data import calculate_kde_trace_data
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.common.services.request_time_out_handler import request_timeout_handling
from histview2.common.services.sse import notify_progress
from histview2.common.services.statistics import calc_summaries, get_mode
from histview2.common.sigificant_digit import signify_digit
from histview2.common.trace_data_log import trace_log, TraceErrKey, EventAction, Target, EventType, save_df_to_file
from histview2.setting_module.models import CfgConstant, CfgProcess, CfgProcessColumn, CfgFilter, CfgFilterDetail, \
    CfgVisualization
from histview2.trace_data.models import find_cycle_class, GlobalRelation, Sensor, Cycle, find_sensor_class
from histview2.trace_data.schemas import DicParam, EndProc, ConditionProc, CategoryProc


@log_execution_time('[TRACE DATA]')
@request_timeout_handling()
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.FPP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_graph_fpp(dic_param, max_graph=None):
    dic_param, cat_exp, cat_procs, dic_cat_filters, use_expired_cache, temp_serial_column, temp_serial_order, \
    temp_serial_process, temp_x_option, *_ = customize_dic_param_for_reuse_cache(dic_param)

    dic_param, df, orig_graph_param, graph_param, graph_param_with_cate = gen_df(dic_param,
                                                                                 _use_expired_cache=use_expired_cache)

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

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

    orig_graph_param = bind_dic_param_to_class(dic_param)

    # order index with other param
    if temp_x_option:
        df = check_and_order_data(df, dic_proc_cfgs, temp_x_option, temp_serial_process, temp_serial_column,
                                  temp_serial_order)
        dic_param[COMMON][X_OPTION] = temp_x_option
        dic_param[COMMON][SERIAL_PROCESS] = temp_serial_process
        dic_param[COMMON][SERIAL_COLUMNS] = temp_serial_column
        dic_param[COMMON][SERIAL_ORDER] = temp_serial_order

    # distinct category for filter setting form
    cate_col_ids = []
    for proc in graph_param.common.cate_procs or []:
        cate_col_ids += proc.col_ids

    dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, cate_col_ids)
    cat_exp_list = gen_unique_data(df, dic_proc_cfgs, graph_param.common.cat_exp)
    cat_exp_list = list(cat_exp_list.values())

    # filter list
    df = filter_df(df, dic_cat_filters)

    # reset index (keep sorted position)
    df.reset_index(inplace=True, drop=True)

    str_cols = dic_param.get(STRING_COL_IDS)
    dic_str_cols = get_str_cols_in_end_procs(dic_proc_cfgs, orig_graph_param)
    dic_ranks = gen_before_rank_dict(df, dic_str_cols)
    dic_data, is_graph_limited = gen_dic_data(df, orig_graph_param, graph_param_with_cate, max_graph)
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
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA], str_cols)

    # get min max order columns
    output_orders = []
    x_option = graph_param.common.x_option
    if x_option == 'INDEX' and graph_param.common.serial_columns:
        group_col = '__group_col__'
        dic_cfg_cols = {cfg_col.id: cfg_col for cfg_col in
                        CfgProcessColumn.get_by_ids(graph_param.common.serial_columns)}
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
                output_orders.append(dict(name=col.name, min=df_order[(sql_label, 'min')].tolist(),
                                          max=df_order[(sql_label, 'max')].tolist()))
        else:
            for sql_label, col in dic_order_cols.items():
                output_orders.append(dict(name=col.name, value=df_order[sql_label].tolist()))

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
        dic_param = gen_thin_dic_param(df, dic_thin_param, dic_proc_cfgs, dic_cat_exp_labels, dic_ranks)
        dic_param['is_thin_data'] = is_thin_data

        for i, plot in enumerate(dic_param[ARRAY_PLOTDATA]):
            plot[SUMMARIES] = list_summaries[i]
    else:
        dic_param = gen_category_info(dic_param, dic_ranks)
    set_str_rank_to_dic_param(dic_param, dic_ranks, full_arrays)
    set_str_category_data(dic_param, dic_ranks)

    calc_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max, str_cols)

    # kde
    gen_kde_data_trace_data(dic_param, full_arrays)

    # add unique category values
    for dic_cate in dic_param.get(CATEGORY_DATA) or []:
        col_id = dic_cate['column_id']
        dic_cate[UNIQUE_CATEGORIES] = dic_unique_cate[col_id][UNIQUE_CATEGORIES] if dic_unique_cate.get(col_id) else []
        if len(set(dic_cate.get('data', []))) > 200:
            dic_cate[IS_OVER_UNIQUE_LIMIT] = True
        else:
            dic_cate[IS_OVER_UNIQUE_LIMIT] = False

    dic_param[CAT_EXP_BOX] = cat_exp_list
    dic_param[INDEX_ORDER_COLS] = output_orders
    dic_param['proc_name'] = {k: proc.name for (k, proc) in dic_proc_cfgs.items()}

    # remove unnecessary data
    # if graph_param.common.x_option == 'INDEX':
    #     del dic_param[TIMES]

    return dic_param


def customize_dic_param_for_reuse_cache(dic_param):
    use_expired_cache = False
    for name in (DIC_CAT_FILTERS, TEMP_CAT_EXP, TEMP_CAT_PROCS, TEMP_X_OPTION, TEMP_SERIAL_PROCESS, TEMP_SERIAL_COLUMN,
                 TEMP_SERIAL_ORDER, MATRIX_COL, COLOR_ORDER):
        if name in dic_param[COMMON]:
            use_expired_cache = True
            break
    dic_cat_filters = json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {})) if isinstance(
        dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str) else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
    cat_exp = [int(id) for id in dic_param[COMMON].get(TEMP_CAT_EXP, []) if id]
    cat_procs = dic_param[COMMON].get(TEMP_CAT_PROCS, [])
    for name in (DIC_CAT_FILTERS, TEMP_CAT_EXP, TEMP_CAT_PROCS):
        if name in dic_param[COMMON]:
            dic_param[COMMON].pop(name)
    dic_param, temp_x_option, temp_serial_process, temp_serial_column, temp_serial_order = \
        prepare_temp_x_option(dic_param)

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

    return dic_param, cat_exp, cat_procs, dic_cat_filters, use_expired_cache, temp_serial_column, temp_serial_order, \
           temp_serial_process, temp_x_option, matrix_col, color_order


@notify_progress(60)
def gen_graph(dic_param, max_graph=None):
    dic_param, df, orig_graph_param, graph_param, graph_param_with_cate = gen_df(dic_param)
    dic_data, is_graph_limited = gen_dic_data(df, orig_graph_param, graph_param_with_cate, max_graph)
    dic_param = gen_dic_param(df, dic_param, dic_data)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited

    return dic_param


@log_execution_time()
def gen_dic_data(df, orig_graph_param, graph_param_with_cate, max_graph=None):
    # create output data
    cat_exp_cols = orig_graph_param.common.cat_exp
    is_graph_limited = False
    if cat_exp_cols:
        dic_cfg_cat_exps = {cfg_col.id: cfg_col for cfg_col in CfgProcessColumn.get_by_ids(cat_exp_cols)}
        dic_data, is_graph_limited = gen_dic_data_cat_exp_from_df(df, orig_graph_param, dic_cfg_cat_exps, max_graph)
        dic_cates = defaultdict(dict)
        for proc in orig_graph_param.common.cate_procs:
            for col_id, col_name in zip(proc.col_ids, proc.col_names):
                sql_label = gen_sql_label(col_id, col_name)
                dic_cates[proc.proc_id][col_id] = df[sql_label].tolist() if sql_label in df.columns else []

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
@memoize(is_save_file=True)
def gen_df(dic_param, _use_expired_cache=False):
    """tracing data to show graph
        1 start point x n end point
        filter by condition point
    """
    # bind dic_param
    orig_graph_param = bind_dic_param_to_class(dic_param)
    cat_exp_col = orig_graph_param.common.cat_exp

    graph_param_with_cate = bind_dic_param_to_class(dic_param)
    graph_param_with_cate.add_cate_procs_to_array_formval()

    graph_param = bind_dic_param_to_class(dic_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add category
    if cat_exp_col:
        graph_param.add_cat_exp_to_array_formval()

    graph_param.add_cate_procs_to_array_formval()

    # get serials
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids)

    # get order columns
    if graph_param.common.x_option == 'INDEX':
        for proc_id, col_id in zip(graph_param.common.serial_processes, graph_param.common.serial_columns):
            if proc_id and col_id:
                proc_id = int(proc_id)
                col_id = int(col_id)
                graph_param.add_proc_to_array_formval(proc_id, col_id)

    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(graph_param)

    # string columns
    df, str_cols = rank_str_cols(df, dic_proc_cfgs, orig_graph_param)
    dic_param[STRING_COL_IDS] = str_cols

    # check filter match or not ( for GUI show )
    matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = main_check_filter_detail_match_graph_data(
        graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # apply coef for text
    df = apply_coef_text(df, graph_param_with_cate, dic_proc_cfgs)

    # order data by order columns
    x_option = graph_param.common.x_option or 'TIME'
    serial_processes = graph_param.common.serial_processes or []
    serial_cols = graph_param.common.serial_columns or []
    serial_orders = graph_param.common.serial_orders or []
    df = check_and_order_data(df, dic_proc_cfgs, x_option, serial_processes, serial_cols, serial_orders)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[IS_RES_LIMITED] = is_res_limited
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    return dic_param, df, orig_graph_param, graph_param, graph_param_with_cate


@log_execution_time()
def gen_dic_param(df, dic_param, dic_data, dic_proc_cfgs=None, dic_cates=None, dic_org_cates=None,
                  is_get_chart_infos=True):
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

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] = gen_plotdata_fpp(graph_param, dic_data, chart_infos,
                                                                           original_graph_configs)
    dic_param[CATEGORY_DATA] = gen_category_data(dic_proc_cfgs, graph_param, dic_cates or dic_data, dic_org_cates)
    dic_param[TIMES] = times

    if Cycle.id.key in df.columns:
        dic_param[CYCLE_IDS] = df.id.tolist()

    return dic_param


@log_execution_time()
def rank_str_cols(df: DataFrame, dic_proc_cfgs, graph_param: DicParam):
    dic_str_cols = get_str_cols_in_end_procs(dic_proc_cfgs, graph_param)
    str_cols = []
    for sql_label, (before_rank_label, _, col_id, _) in dic_str_cols.items():
        if sql_label not in df.columns:
            continue

        df[before_rank_label] = df[sql_label]
        df[sql_label] = np.where(df[sql_label].isnull(), df[sql_label], df[sql_label].astype('category').cat.codes + 1)

        df[sql_label] = df[sql_label].convert_dtypes()
        str_cols.append(col_id)

    return df, str_cols


@log_execution_time()
def get_str_cols_in_end_procs(dic_proc_cfgs, graph_param: DicParam):
    dic_output = {}
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        dic_cols = {col.id: col for col in proc_cfg.get_cols_by_data_type(DataType.TEXT, False)}
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            cfg_col = dic_cols.get(col_id)
            if cfg_col is None:
                continue

            rank_col_name = gen_sql_label(col_id, col_name)
            before_rank_col_name = gen_sql_label(RANK_COL, rank_col_name)
            dic_output[rank_col_name] = (before_rank_col_name, proc.proc_id, col_id, col_name)

    return dic_output


@log_execution_time()
def gen_before_rank_dict(df: DataFrame, dic_str_cols):
    dic_output = {}
    for sql_label, (before_rank_label, _, col_id, _) in dic_str_cols.items():
        if before_rank_label in df.columns:
            df_rank = df[[sql_label, before_rank_label]].drop_duplicates().dropna()
            dic_output[col_id] = dict(zip(df_rank[sql_label], df_rank[before_rank_label]))

    return dic_output


@log_execution_time()
def set_str_rank_to_dic_param(dic_param, dic_ranks, dic_full_array_y=None):
    for i, plot in enumerate(dic_param[ARRAY_PLOTDATA]):
        col_id = plot.get(END_COL_ID)
        dic_col_ranks = dic_ranks.get(col_id)
        if not dic_col_ranks:
            continue

        # enc col (show graph)
        # plot[ARRAY_Y] = reduce_stepped_chart_data(plot.get(ARRAY_Y))
        plot[ARRAY_Y_MIN] = None
        plot[ARRAY_Y_MAX] = None

        category_distributed = {}
        full_dat = dic_full_array_y[i] if dic_full_array_y else plot.get(ARRAY_Y)
        none_idxs = plot.get(NONE_IDXS)
        total_counts = 0

        dic_cat_counter = Counter(full_dat)
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
            N_NA_PCTG: signify_digit(100 * na_count / n_total) if n_total else 0
        }
        plot[CAT_DISTRIBUTE] = category_distributed
        plot[CAT_SUMMARY] = step_chart_summary


@log_execution_time()
def set_str_category_data(dic_param, dic_ranks):
    for dic_cate in dic_param[CATEGORY_DATA]:
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
    df_thin, dic_cates, dic_org_cates, group_counts = reduce_data(df, graph_param, dic_str_cols)

    # create output data
    df_cat_exp = gen_df_thin_values(df, graph_param, df_thin, dic_str_cols)
    dic_data = gen_dic_data_from_df(df_cat_exp, graph_param, cat_exp_mode=True, dic_cat_exp_labels=dic_cat_exp_labels,
                                    calculate_cycle_time=False)
    dic_param = gen_dic_param(df_cat_exp, dic_param, dic_data, dic_proc_cfgs, dic_cates, dic_org_cates,
                              is_get_chart_infos=False)
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

        if time_label in df_cat_exp.columns:
            plot[ARRAY_X] = df_cat_exp[time_label].replace({np.nan: None}).tolist()
            # get chart infos
            plot[CHART_INFOS_ORG], plot[CHART_INFOS] = get_chart_info_detail(plot[ARRAY_X], plot[END_COL_ID],
                                                                             threshold_filter_detail_ids,
                                                                             plot[END_PROC_ID],
                                                                             graph_param.common.start_proc,
                                                                             start_tm, end_tm,
                                                                             dic_param[TIMES])

        if min_label in df_cat_exp.columns:
            plot[ARRAY_Y_MIN] = df_cat_exp[min_label].tolist()

        if max_label in df_cat_exp.columns:
            plot[ARRAY_Y_MAX] = df_cat_exp[max_label].tolist()

        if cycle_label in df_cat_exp.columns:
            plot[CYCLE_IDS] = df_cat_exp[cycle_label].tolist()

        if plot[END_COL_ID] in dic_ranks:
            # category variable
            p_array_y = pd.Series(plot[ARRAY_Y]).dropna().tolist()
            cat_size = 0
            if len(p_array_y):
                cat_size = np.unique(p_array_y).size
            plot[CAT_TOTAL] = cat_size
            plot[IS_CAT_LIMITED] = True if cat_size >= MAX_CATEGORY_SHOW else False

        # ignore show none value in thin mode
        plot[NONE_IDXS] = []

    # group count
    dic_param[THIN_DATA_GROUP_COUNT] = group_counts

    return dic_param


def make_str_full_array_y(dic_param):
    return [plot[ARRAY_Y] for plot in dic_param[ARRAY_PLOTDATA]]


def get_summary_infos(dic_param):
    return [plot[SUMMARIES] for plot in dic_param[ARRAY_PLOTDATA]]


@log_execution_time()
def check_and_order_data(df, dic_proc_cfgs, x_option='TIME', serial_processes=[], serial_cols=[], serial_orders=[]):
    if x_option.upper() == 'TIME':
        df = df.sort_values(Cycle.time.key, ascending=True)
        return df

    cols = []
    orders = []
    for proc_id in set(serial_processes):
        if not proc_id:
            continue

        proc_cfg: CfgProcess = dic_proc_cfgs.get(int(proc_id))
        if not proc_cfg:
            continue
        order_cols: List[CfgProcessColumn] = proc_cfg.get_order_cols(column_name_only=False)

        if not order_cols:
            continue

        dic_order_cols = {col.id: gen_sql_label(col.id, col.column_name) for col in order_cols}
        for col_id, order in zip(serial_cols, serial_orders):
            if not col_id:
                continue
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
        params.update({gen_sql_label(col_id, proc.col_names[idx]): [] for idx, col_id in enumerate(proc.col_ids)})
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
    df_end = get_sensor_values(proc, start_relate_ids=start_relate_ids, start_tm=start_tm, end_tm=end_tm)
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


def gen_df_end_same_with_start(proc: EndProc, start_proc_id, start_tm, end_tm, drop_duplicate=True,
                               with_limit=None):
    # proc_id = proc.proc_id

    # get serials
    serials = CfgProcessColumn.get_serials(start_proc_id)
    serials = [gen_sql_label(serial.id, serial.column_name) for serial in serials]

    # get sensor values
    df_end = get_sensor_values(proc, start_tm=start_tm, end_tm=end_tm, use_global_id=False, with_limit=with_limit)
    if df_end.empty:
        return pd.DataFrame()

    df_end.set_index(Cycle.id.key, inplace=True)

    # if only 1 proc, show all data without filter duplicate
    if drop_duplicate and len(serials):  # TODO ask PO
        cols = [col for col in serials if col in df_end.columns]
        if cols:
            df_end.drop_duplicates(subset=cols, keep='last', inplace=True)

    return df_end


def filter_proc_same_with_start(proc: ConditionProc, start_tm, end_tm, with_limit=None):
    if not proc.dic_col_id_filters:
        return None

    cond_records = get_cond_data(proc, start_tm=start_tm, end_tm=end_tm, use_global_id=False, with_limit=with_limit)
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


@log_execution_time()
@notify_progress(30)
@memoize(is_save_file=True)
def graph_one_proc(proc_id, start_tm, end_tm, cond_procs, end_procs, sql_limit, same_proc_only=False,
                   with_time_order=True):
    """ get data from database

    Arguments:
        trace {[type]} -- [description]
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """

    # start proc
    data = get_start_proc_data(proc_id, start_tm, end_tm, with_limit=sql_limit, with_time_order=with_time_order)
    # no data
    if not data:
        return gen_blank_df()

    df_start = pd.DataFrame(data)
    df_start.set_index(Cycle.id.key, inplace=True)

    # condition
    for proc in cond_procs:
        if same_proc_only and proc.proc_id != proc_id:
            continue

        ids = filter_proc_same_with_start(proc, start_tm, end_tm, with_limit=sql_limit)
        if ids is None:
            continue

        df_start = df_start[df_start.index.isin(ids)]

    # end proc
    for proc in end_procs:
        if same_proc_only and proc.proc_id != proc_id:
            continue
        df_end = gen_df_end_same_with_start(proc, proc_id, start_tm, end_tm, drop_duplicate=False)
        df_start = df_start.join(df_end, rsuffix=create_rsuffix(proc.proc_id)).reset_index()

    return df_start


@log_execution_time()
@notify_progress(30)
@memoize(is_save_file=True)
def graph_many_proc(start_proc_id, start_tm, end_tm, cond_procs: List[ConditionProc], end_procs: List[EndProc],
                    sql_limit, with_time_order=True):
    """ get data from database

    Arguments:
        trace {[type]} -- [description]
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    # without relate
    data = get_start_proc_data(start_proc_id, start_tm, end_tm, with_limit=sql_limit, with_time_order=with_time_order)
    # no data
    if not data:
        return gen_blank_df(), False

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
    for proc in cond_procs:
        if not proc.proc_id == start_proc_id:
            continue

        ids = filter_proc_same_with_start(proc, start_tm, end_tm, with_limit=sql_limit)
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
            return gen_blank_df(), False

    # end proc that same with start
    for proc in end_procs:
        if not proc.proc_id == start_proc_id:
            continue

        # get sensor value data
        df_end = gen_df_end_same_with_start(proc, proc.proc_id, start_tm, end_tm, with_limit=sql_limit)
        df_start = df_start.join(df_end, how='inner', rsuffix=create_rsuffix(proc.proc_id))

    if not df_start.columns.size:
        return gen_blank_df(), False

    # get min max time {proc_id:[min,max]}
    e_start_tm = convert_time(start_tm, return_string=False)
    e_start_tm = add_days(e_start_tm, -14)
    e_start_tm = convert_time(e_start_tm)
    e_end_tm = convert_time(end_tm, return_string=False)
    e_end_tm = add_days(e_end_tm, 14)
    e_end_tm = convert_time(e_end_tm)

    global_ids = None
    is_filter = False
    for proc in cond_procs:
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
        else:
            df_start = df_start[df_start[Cycle.global_id.key].isin(global_ids)]

    # set new Index
    df_start.set_index(Cycle.global_id.key, inplace=True)

    # end proc
    for proc in end_procs:
        if proc.proc_id == start_proc_id:
            continue

        df_end = gen_df_end(proc, start_relate_ids, e_start_tm, e_end_tm)
        df_start = df_start.join(df_end, rsuffix=create_rsuffix(proc.proc_id))

    # group by cycle id to drop duplicate ( 1:n with global relation)
    df_start.set_index(Cycle.id.key, inplace=True)
    if data_with_relate_id:
        df_start = df_start.groupby(df_start.index).first().reset_index()

    # sort by time
    if with_time_order:
        df_start.sort_values(Cycle.time.key, inplace=True)

    return df_start, is_res_limited


@notify_progress(40)
@log_execution_time()
@trace_log((TraceErrKey.ACTION, TraceErrKey.TARGET), (EventAction.READ, Target.DATABASE))
def get_data_from_db(graph_param: DicParam, with_time_order=True, is_save_df_to_file=True):
    # DEBUG Function
    if get_debug_data(DebugKey.IS_DEBUG_MODE.name):
        df = get_debug_data(DebugKey.GET_DATA_FROM_DB.name)
        return df, df.index.size, None

    # with limit
    sql_limit = SQL_LIMIT

    # start proc
    start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)

    is_res_limited = False
    proc_ids = get_proc_ids_in_dic_param(graph_param)
    if len(proc_ids) == 1:
        df = graph_one_proc(graph_param.common.start_proc, start_tm, end_tm, graph_param.common.cond_procs,
                            graph_param.array_formval, sql_limit,
                            with_time_order=with_time_order)
    else:
        df, is_res_limited = graph_many_proc(graph_param.common.start_proc, start_tm, end_tm,
                                             graph_param.common.cond_procs, graph_param.array_formval, sql_limit,
                                             with_time_order=with_time_order)

    # reset index
    df.reset_index(inplace=True)

    # save log
    if is_save_df_to_file:
        save_df_to_file(df)

    # with limit
    actual_record_number = df.index.size

    # graph_param.common.is_validate_data = True
    if graph_param.common.is_validate_data:
        df = validate_data(df)

    return df, actual_record_number, is_res_limited


@log_execution_time()
def validate_data(df: DataFrame):
    if len(df) > THIN_DATA_COUNT:
        df_before = get_sample_df(df)
        df_before = df_before.convert_dtypes()
        df_after = validate_data_with_regex(df_before)
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
            min_idx = df[col].idxmin()
            max_idx = df[col].idxmax()
            sample_df = sample_df.append(df.loc[min_idx], ignore_index=True)
            sample_df = sample_df.append(df.loc[max_idx], ignore_index=True)
        except Exception:
            pass

    return sample_df


@log_execution_time()
def gen_df_thin_values(df: DataFrame, graph_param: DicParam, df_thin, dic_str_cols):
    thin_idxs_len = len(df_thin)
    thin_boxes = [None] * thin_idxs_len
    df_cat_exp = pd.DataFrame()
    df_cat_exp[Cycle.time.key] = thin_boxes

    # df_cat_exp[Cycle.time.key] = df_thin[Cycle.time.key]
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

                min_idxs, med_idxs, max_idxs = list(zip(*df_thin.loc[idxs, sql_label]))
                min_idxs, med_idxs, max_idxs = list(min_idxs), list(med_idxs), list(max_idxs)
                series[:] = None
                series[idxs] = df.loc[med_idxs, sql_label].values
                df_cat_exp[sql_label] = series

                # time start proc
                if Cycle.time.key in df.columns:
                    series[:] = None
                    series[idxs] = df.loc[med_idxs, Cycle.time.key].values
                    df_cat_exp[Cycle.time.key] = np.where(series.isnull(), df_cat_exp[Cycle.time.key], series)

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

                # add min value to median position
                series[:] = None
                series[idxs] = df.loc[min_idxs, sql_label].values
                df_cat_exp[sql_label_min] = series

                # add max value to median position
                series[:] = None
                series[idxs] = df.loc[max_idxs, sql_label].values
                df_cat_exp[sql_label_max] = series

    return df_cat_exp


@log_execution_time()
def gen_dic_data_from_df(df: DataFrame, graph_param: DicParam, cat_exp_mode=None, dic_cat_exp_labels=None,
                         calculate_cycle_time=True):
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
        # TODO: CfgProcessColumn call many times because outside loop
        dic_datetime_cols = {cfg_col.id: cfg_col for cfg_col in
                             CfgProcessColumn.get_by_data_type(proc.proc_id, DataType.DATETIME)}
        dic_data_cat_exp = defaultdict(list)
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            col_id_name = gen_sql_label(col_id, col_name)
            sql_labels = [col for col in df.columns if col.startswith(col_id_name)]
            series_lst = []
            for sql_label in sql_labels:
                if sql_label in df.columns:
                    if calculate_cycle_time and col_id in dic_datetime_cols:
                        series = pd.to_datetime(df[sql_label])
                        series.sort_values(inplace=True)
                        series = series.diff().dt.total_seconds()
                        series.sort_index(inplace=True)
                        df[sql_label] = series
                    else:
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
            dic_data[proc.proc_id][Cycle.time.key] = df[time_col_alias].replace({np.nan: None}).tolist()
        else:
            dic_data[proc.proc_id][Cycle.time.key] = []

        # if CAT_EXP_BOX in df.columns:
        #     dic_data[CAT_EXP_BOX] = df[CAT_EXP_BOX].tolist()

    return dic_data


@log_execution_time()
def gen_dic_data_cat_exp_from_df(df: DataFrame, graph_param: DicParam, dic_cfg_cat_exps, max_graph=None):
    is_graph_limited = False
    dic_data = defaultdict(dict)
    if not len(df):
        return dic_data

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

        dic_datetime_cols = {cfg_col.id: cfg_col for cfg_col in
                             CfgProcessColumn.get_by_data_type(proc.proc_id, DataType.DATETIME)}
        dic_none_idxs = defaultdict(list)
        dic_cat_exp_names = defaultdict(list)
        time_col_alias = '{}_{}'.format(Cycle.time.key, proc.proc_id)
        if time_col_alias in df:
            dic_data[proc.proc_id][Cycle.time.key] = df[time_col_alias].replace({np.nan: None}).tolist()
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
                dic_cat_exp_names[col_id].append(NA_STR if cat_exp_val is None or pd.isna(cat_exp_val) else cat_exp_val)

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
            datetime_col = datetime_col.name
        sql_labels = [gen_sql_label(serial_col.id, serial_col.column_name) for serial_col in serial_cols]
        before_rank_sql_labels = [gen_sql_label(RANK_COL, sql_label) for sql_label in sql_labels]
        serial_cols = [serial_col.name for serial_col in serial_cols]
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
            dic_param[SERIAL_DATA][proc_id] = df[cols].replace({np.nan: ''}).to_records(index=False).tolist()
        else:
            dic_param[SERIAL_DATA][proc_id] = []


@log_execution_time()
def gen_dic_serial_data_from_df_thin(df: DataFrame, dic_param, dic_datetime_serial_cols, dic_ranks):
    dic_param[COMMON_INFO] = {}

    for plot in dic_param[ARRAY_PLOTDATA]:
        col_id = plot[END_COL_ID]
        if col_id in dic_ranks:
            continue

        proc_id = plot[END_PROC_ID]
        col_name = plot[END_COL_NAME]
        cat_exp = plot.get(CAT_EXP_BOX)
        datetime_col, serial_cols = dic_datetime_serial_cols.get(proc_id, (None, None))
        if datetime_col:
            dic_param[COMMON_INFO][proc_id] = {
                DATETIME_COL: datetime_col.name,
                SERIAL_COLUMNS: [serial_col.name for serial_col in serial_cols],
            }

        sql_label = gen_sql_label(col_id, col_name, cat_exp)
        sql_label = gen_sql_label(SERIAL_DATA, sql_label)
        if sql_label in df.columns:
            plot[SERIAL_DATA] = df[sql_label].tolist()
        else:
            plot[SERIAL_DATA] = []


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


def get_sensor_values_chunk(data_query, chunk_sensor, dic_sensors, cycle_cls, start_relate_ids=None, start_tm=None,
                            end_tm=None, with_limit=None):
    for col_id, col_name in chunk_sensor:
        if col_name not in dic_sensors:
            continue
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
        if with_limit:
            data_query = data_query.limit(with_limit)

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
def get_sensor_values(proc: EndProc, start_relate_ids=None, start_tm=None, end_tm=None, use_global_id=True,
                      with_limit=None):
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
        df_chunk = get_sensor_values_chunk(data, chunk_sensor, dic_sensors, cycle_cls, start_relate_ids, start_tm,
                                           end_tm, with_limit=with_limit)
        if idx != 0 and Cycle.time.key in df_chunk.columns:
            df_chunk = df_chunk.drop(Cycle.time.key, axis=1)
        dataframes.append(df_chunk)

    df = pd.DataFrame()
    if dataframes:
        df = pd.concat([dfc.set_index(dfc.columns[0]) for dfc in dataframes], ignore_index=False, axis=1).reset_index()
    return df


@log_execution_time()
def get_cond_data(proc: ConditionProc, start_relate_ids=None, start_tm=None, end_tm=None, use_global_id=True,
                  with_limit=None):
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
        if with_limit:
            data = data.limit(with_limit)

        records = data.all()

    return records


def create_graph_config(cfgs: List[CfgVisualization] = []):
    if not cfgs:
        return [{
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
        }]

    list_cfgs = []
    for cfg in cfgs:
        list_cfgs.append({
            THRESH_HIGH: cfg.ucl,
            THRESH_LOW: cfg.lcl,
            Y_MAX: cfg.ymax,
            Y_MIN: cfg.ymin,
            PRC_MAX: cfg.upcl,
            PRC_MIN: cfg.lpcl,
            ACT_FROM: cfg.act_from,
            ACT_TO: cfg.act_to,
            'type': cfg.filter_column.name if cfg.filter_column else None,
            'name': cfg.filter_detail.name if cfg.filter_detail else None,
            'eng_name': cfg.filter_column.english_name if cfg.filter_column else None,
        })
    return list_cfgs


def get_default_graph_config(col_id, start_tm, end_tm):
    # get sensor default cfg chart info
    sensor_default_cfg: List[CfgVisualization] = CfgVisualization.get_sensor_default_chart_info(col_id, start_tm,
                                                                                                end_tm) or []
    return create_graph_config(sensor_default_cfg)


def get_col_graph_configs(col_id, filter_detail_ids, start_tm, end_tm):
    if not filter_detail_ids:
        return get_default_graph_config(col_id, start_tm, end_tm)

    graph_configs = CfgVisualization.get_by_control_n_filter_detail_ids(col_id, filter_detail_ids, start_tm, end_tm)
    if graph_configs:
        return create_graph_config(graph_configs)

    return get_default_graph_config(col_id, start_tm, end_tm)


def convert_chart_info_time_range(chart_config, start_proc_times, end_proc_times, query_start_tm, query_end_tm):
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
    get_end_cols = graph_param.get_end_cols(graph_param.get_start_proc())

    # query by var_col_id
    for end_col in get_end_cols:
        graph_configs[end_col] = {}
        chart_infos: List[CfgVisualization] \
            = CfgVisualization.get_all_by_control_n_filter_col_id(end_col, var_col_id, start_tm, end_tm)
        for chart_info in chart_infos:
            filter_detail_id = chart_info.filter_detail_id
            if not graph_configs[end_col].get(filter_detail_id):
                graph_configs[end_col][filter_detail_id] = []
            graph_configs[end_col][filter_detail_id].append(chart_info)

    return graph_configs


@log_execution_time()
def build_regex_index(var_col_id):
    cfg_filter: CfgFilter = CfgFilter.get_filter_by_col_id(var_col_id)
    cfg_filter_details = []
    if cfg_filter:
        cfg_filter_details = cfg_filter.filter_details or []

    return {
        cfg.id: gen_python_regex(cfg.filter_condition, FilterFunc[cfg.filter_function], cfg.filter_from_pos)
        for cfg in cfg_filter_details
    }


@log_execution_time()
def map_stp_val_2_cfg_details(stp_value, map_filter_detail_2_regex={}):
    mapped_cfg_detail_ids = []
    for cfg_id, regex in map_filter_detail_2_regex.items():
        if regex and re.match(regex, str(stp_value)):
            mapped_cfg_detail_ids.append(cfg_id)
    return mapped_cfg_detail_ids


@log_execution_time()
def get_chart_infos_by_stp_value(stp_value, end_col, dic_filter_detail_2_regex, chart_infos_by_stp_var):
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
            orig_graph_cfg, graph_cfg = get_chart_info_detail(end_proc_times, col_id, threshold_filter_detail_ids,
                                                              end_proc, start_proc, start_tm, end_tm, start_proc_times,
                                                              no_convert=no_convert)
            original_graph_configs[proc.proc_id][col_id] = orig_graph_cfg
            graph_configs[proc.proc_id][col_id] = graph_cfg

    return graph_configs, original_graph_configs


@log_execution_time()
def get_chart_info_detail(end_proc_times, end_col, threshold_filter_detail_ids, end_proc=None, start_proc=None,
                          start_tm=None, end_tm=None, start_proc_times=None, no_convert=False):
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
    col_graph_configs = get_col_graph_configs(end_col, threshold_filter_detail_ids, start_tm, end_tm)
    orig_graph_cfgs = deepcopy(col_graph_configs)

    if end_proc_times and start_proc and end_proc and start_proc != end_proc and not no_convert and start_proc_times:
        # convert thresholds
        for chart_config in col_graph_configs:
            act_from, act_to = convert_chart_info_time_range(chart_config, start_proc_times, end_proc_times,
                                                             query_start_tm, query_end_tm)
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
        orders = CfgConstant.get_value_by_type_name(type=CfgConstantType.TS_CARD_ORDER.name, name=proc_id) or '{}'
        orders = json.loads(orders)
        if orders:
            dic_orders[proc_id] = orders

    lst_proc_end_col = []
    for proc in orig_graph_param.array_formval:
        proc_id = proc.proc_id
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            proc_order = dic_orders.get(proc_id) or {}
            order = proc_order.get(str(col_id)) or 999
            lst_proc_end_col.append((proc_id, col_id, col_name, order))

    if not reorder:
        return lst_proc_end_col

    return sorted(lst_proc_end_col, key=lambda x: x[-1])


@log_execution_time()
def gen_plotdata(orig_graph_param: DicParam, dic_data, chart_infos=None, original_graph_configs=None, reorder=True):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param, reorder)

    plotdatas = []
    array_formval = []
    for proc_id, col_id, col_name, _ in lst_proc_end_col:
        array_y = dic_data.get(proc_id, {}).get(col_id, [])
        array_x = dic_data.get(proc_id, {}).get(Cycle.time.key, [])
        plotdata = {ARRAY_Y: array_y, ARRAY_X: array_x, END_PROC_ID: proc_id, END_COL_ID: col_id,
                    END_COL_NAME: col_name}

        plotdatas.append(plotdata)

        array_formval.append({
            END_PROC: proc_id,
            GET02_VALS_SELECT: col_id
        })

        # add chart info
        if chart_infos:
            set_chart_infos_to_plotdata(col_id, chart_infos, original_graph_configs, plotdata)

    return array_formval, plotdatas


@log_execution_time()
def gen_plotdata_fpp(orig_graph_param: DicParam, dic_data, chart_infos=None, original_graph_configs=None,
                     dic_cycle_ids=None, reorder=True):
    # re-order proc-sensors to show to UI
    lst_proc_end_col = order_end_proc_sensor(orig_graph_param, reorder)

    plotdatas = []
    array_formval = []
    dic_proc_name = gen_dict_procs([proc_id for proc_id, *_ in lst_proc_end_col])
    for proc_id, col_id, col_name, _ in lst_proc_end_col:
        if proc_id not in dic_data or col_id not in dic_data.get(proc_id):
            continue

        y_list = dic_data.get(proc_id, {}).get(col_id) or [[]]
        array_x = dic_data.get(proc_id, {}).get(Cycle.time.key, [])
        ranks = dic_data[proc_id].get(RANK_COL, {}).get(col_id)
        if not isinstance(y_list, (list, tuple)):
            y_list = [y_list]

        cate_names = dic_data.get(proc_id, {}).get(CAT_EXP_BOX, {}).get(col_id)
        none_idxs = dic_data.get(proc_id, {}).get(NONE_IDXS, {}).get(col_id)
        for idx, array_y in enumerate(y_list):
            if orig_graph_param.common.cat_exp and not array_y:
                continue

            plotdata = {ARRAY_Y: array_y, ARRAY_X: array_x, END_PROC_ID: proc_id,
                        END_PROC_NAME: dic_proc_name[proc_id].name,
                        END_COL_ID: col_id,
                        END_COL_NAME: col_name}

            if cate_names:
                plotdata.update({CAT_EXP_BOX: cate_names[idx]})

            if none_idxs:
                plotdata.update({NONE_IDXS: none_idxs[idx]})

            if dic_cycle_ids:
                plotdata.update({CYCLE_IDS: dic_cycle_ids.get(proc_id, {}).get(col_id, [])})

            if ranks:
                plotdata.update({RANK_COL: ranks[idx]})

            plotdatas.append(plotdata)

            array_formval.append({
                END_PROC: proc_id,
                GET02_VALS_SELECT: col_id
            })

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
def gen_category_data(dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam, dic_data,
                      dic_org_cates=None):
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

        for col_id, column_name, col_show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            data = dic_proc.get(col_id)
            if not data:
                continue

            if isinstance(data[0], (list, tuple)):
                array_y = data[0]
            else:
                array_y = data

            cate_summary = None
            if dic_org_cates:
                cate_summary = dic_org_cates[proc_id].get(col_id) if dic_org_cates.get(proc_id) else None

            plotdata = dict(proc_name=proc_id, proc_master_name=proc_cfg.name, column_name=column_name,
                            column_master_name=col_show_name, data=array_y, summary=cate_summary, column_id=col_id)
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


@log_execution_time()
@request_timeout_handling()
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
    vals = [chart.get(THRESH_LOW) for chart in chart_infos if chart.get(THRESH_LOW) is not None]
    vals += [chart.get(THRESH_HIGH) for chart in chart_infos if chart.get(THRESH_HIGH) is not None]

    y_min = None
    y_max = None
    if vals:
        y_min = min(vals)
        y_max = max(vals)

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
            CfgConstant.create_or_merge_by_type(const_type=CfgConstantType.TS_CARD_ORDER.name,
                                                const_name=proc_code,
                                                const_value=new_orders)
    except Exception as ex:
        traceback.print_exc()
        logger.error(ex)


def get_proc_ids_in_dic_param(graph_param: DicParam):
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

    return list(procs)


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


def fx(v): return pd.NA


@log_execution_time()
def apply_coef_text(df: DataFrame, graph_param: DicParam, dic_proc_cfgs: dict):
    for proc_id, proc_cfg in dic_proc_cfgs.items():
        if graph_param.is_end_proc(proc_id):
            end_col_ids = graph_param.get_end_cols(proc_id) or []
            end_cols: List[CfgProcessColumn] = proc_cfg.get_cols(end_col_ids) or []
            for end_col in end_cols:
                if DataType[end_col.data_type] is DataType.TEXT \
                        and end_col.coef is not None and end_col.operator == Operator.REGEX.value:
                    col_label = gen_sql_label(end_col.id, end_col.column_name)
                    if col_label in df.columns:
                        df[col_label] = df[col_label].astype('object').str \
                            .replace('^(?!{})'.format(end_col.coef), fx, regex=True)
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
                dic_col_filter_details[df_col_name].append((cfg_detail.id, cfg_detail.filter_condition))
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
def main_check_filter_detail_match_graph_data(graph_param: DicParam, df: DataFrame):
    cond_proc_ids = [cond.proc_id for cond in graph_param.common.cond_procs]
    cond_col_ids = graph_param.get_all_end_col_ids()
    dic_col_filter_details, not_exact_match_filter_ids = get_filter_detail_ids(cond_proc_ids, cond_col_ids)
    dic_col_values = gen_dic_uniq_value_from_df(df, dic_col_filter_details)
    matched_filter_ids, unmatched_filter_ids = check_filter_detail_match_graph_data(dic_col_filter_details,
                                                                                    dic_col_values)

    return matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids


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
        set([Cycle.time.key] + list(dic_end_col_names) + list(dic_cate_names) + rank_cols))
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

    # get category mode(most common)
    df_blank = pd.DataFrame(index=range(THIN_DATA_CHUNK))
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
    for sql_label, (proc_id, *_) in dic_end_col_names.items():
        df_temp = df[[index_col, sql_label]].dropna()
        df_temp = df_temp.sort_values([group_col, sql_label], ascending=[True, True])
        df_temp.drop(sql_label, axis=1, inplace=True)
        df_temp = df_temp.groupby(group_col).agg(get_min_median_max_pos)
        df_temp = df_temp.rename(columns={index_col: sql_label})
        if len(df_temp) == 0:
            blank_vals = [None] * THIN_DATA_CHUNK
            df_temp[sql_label] = blank_vals

        dfs.append(df_temp)
        cols.append(sql_label)

    df_box = pd.concat(dfs, axis=1)

    # add time
    # start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    # end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
    # times = pd.date_range(start=start_tm, end=end_tm, periods=THIN_DATA_CHUNK)
    # df_box[Cycle.time.key] = times
    # df_box[Cycle.time.key] = df_box[Cycle.time.key].astype('datetime64[s]')

    # remove blanks
    df_box.dropna(how="all", subset=cols + rank_cols, inplace=True)

    # remove blank category
    dic_cates = defaultdict(dict)
    dic_org_cates = defaultdict(dict)
    for sql_label, (proc_id, col_id, _) in dic_cate_names.items():
        if df_cates is not None and sql_label in df_cates:
            dic_cates[proc_id][col_id] = df_cates.loc[df_box.index, sql_label].tolist()
        dic_org_cates[proc_id][col_id] = get_available_ratio(df[sql_label])

    return df_box, dic_cates, dic_org_cates, group_counts


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
def calc_raw_common_scale_y(plots, string_col_ids=None):
    """
    calculate y min max in common scale
    :param plots:
    :param string_col_ids:
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

        s = s.convert_dtypes()
        s_without_inf = s[np.isfinite(s)]
        # s_without_inf = remove_inf(s)

        min_val = s_without_inf.min()
        max_val = s_without_inf.max()
        if pd.isna(min_val):
            min_val = None
        if pd.isna(max_val):
            max_val = None

        min_max_list.append((min_val, max_val))

        if string_col_ids and plot[END_COL_ID] in string_col_ids:
            continue

        if min_val:
            y_commons.append(min_val)

        if max_val:
            y_commons.append(max_val)

    all_graph_min = None
    all_graph_max = None
    if y_commons:
        all_graph_min = min(y_commons)
        all_graph_max = max(y_commons)

    return min_max_list, all_graph_min, all_graph_max


def calc_stp_raw_common_scale_y(dic_param):
    """
    calculate y min max in common scale
    :param dic_param:
    :return:
    """
    y_commons = []
    min_max_list = []
    for k, plots in dic_param[ARRAY_PLOTDATA].items():
        for plot in plots:
            s = pd.Series(plot[ARRAY_Y])

            s = s[s.notnull()]
            if not len(s):
                min_max_list.append((None, None))
                continue

            s_without_inf = s[np.isfinite(s)]
            min_val = s_without_inf.min()
            max_val = s_without_inf.max()
            min_max_list.append((min_val, max_val))

            # if plot[END_COL_ID] in dic_param[STRING_COL_IDS]:
            #     continue

            if min_val:
                y_commons.append(min_val)

            if max_val:
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

    return {UNLINKED_IDXS: series_x[series_x.isnull()].index.tolist(),
            NONE_IDXS: nones,
            INF_IDXS: series_y[series_y == float('inf')].index.tolist(),
            NEG_INF_IDXS: series_y[series_y == float('-inf')].index.tolist()}


def calc_auto_scale_y(plotdata, series_y):
    notna_series_y = series_y[series_y.notna()]
    if not len(notna_series_y):
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

    lower_outlier_idxs = series_y[series_y < lower_range].index.tolist() if lower_range is not None else []
    upper_outlier_idxs = series_y[series_y > upper_range].index.tolist() if upper_range is not None else []

    if lower_range and series_y.min() >= 0:
        lower_range = max(0, lower_range)

    if upper_range and series_y.max() <= 0:
        upper_range = min(0, upper_range)

    lower_range, upper_range = extend_min_max(lower_range, upper_range)

    return {Y_MIN: lower_range, Y_MAX: upper_range,
            LOWER_OUTLIER_IDXS: lower_outlier_idxs,
            UPPER_OUTLIER_IDXS: upper_outlier_idxs}


def calc_setting_scale_y(plotdata, series_y):
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

    return {Y_MIN: ymin, Y_MAX: ymax, LOWER_OUTLIER_IDXS: lower_outlier_idxs, UPPER_OUTLIER_IDXS: upper_outlier_idxs}


def calc_threshold_scale_y(plotdata, series_y):
    # calculate upper/lower limit
    chart_infos = plotdata.get(CHART_INFOS)
    dic_scale_auto = plotdata.get(SCALE_AUTO, {})
    if not chart_infos:
        return dic_scale_auto

    thresh_low, thresh_high = get_threshold_min_max_chartinfo(chart_infos)
    if thresh_low is None and thresh_high is None:
        return dic_scale_auto

    if thresh_low is None:
        thresh_low = dic_scale_auto.get(THRESH_LOW)
        lower_outlier_idxs = dic_scale_auto.get(LOWER_OUTLIER_IDXS)
    else:
        lower_outlier_idxs = series_y[series_y < thresh_low].index.tolist()

    if thresh_high is None:
        thresh_high = dic_scale_auto.get(THRESH_HIGH)
        upper_outlier_idxs = dic_scale_auto.get(UPPER_OUTLIER_IDXS)
    else:
        upper_outlier_idxs = series_y[series_y > thresh_high].index.tolist()

    thresh_low, thresh_high = extend_min_max(thresh_low, thresh_high)

    return {Y_MIN: thresh_low, Y_MAX: thresh_high,
            LOWER_OUTLIER_IDXS: lower_outlier_idxs,
            UPPER_OUTLIER_IDXS: upper_outlier_idxs}


@log_execution_time()
def calc_scale_info(array_plotdata, min_max_list, all_graph_min, all_graph_max, string_col_ids=None, has_val_idxs=None):
    dic_datetime_cols = {}
    for idx, plotdata in enumerate(array_plotdata):
        # datetime column
        proc_id = plotdata.get(END_PROC_ID)
        col_id = plotdata.get(END_COL_ID)
        if proc_id and proc_id not in dic_datetime_cols:
            dic_datetime_cols[proc_id] = {cfg_col.id: cfg_col for cfg_col in
                                          CfgProcessColumn.get_by_data_type(proc_id, DataType.DATETIME)}

        is_datetime_col = True if col_id in dic_datetime_cols.get(proc_id, {}) else False

        y_min = min_max_list[idx][0]
        y_min = all_graph_min if y_min is None else y_min
        y_max = min_max_list[idx][1]
        y_max = all_graph_max if y_max is None else y_max

        y_min, y_max = extend_min_max(y_min, y_max)
        all_graph_min, all_graph_max = extend_min_max(all_graph_min, all_graph_max)

        array_y = plotdata.get(ARRAY_Y)
        array_x = plotdata.get(ARRAY_X)
        if (not len(array_y)) or (not len(array_x)) or (string_col_ids and plotdata[END_COL_ID] in string_col_ids):
            dic_base_scale = {Y_MIN: y_min, Y_MAX: y_max, LOWER_OUTLIER_IDXS: [], UPPER_OUTLIER_IDXS: []}
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

        plotdata[SCALE_AUTO] = calc_auto_scale_y(plotdata, series_y)
        if is_datetime_col:
            plotdata[SCALE_AUTO][Y_MIN] = y_min

        plotdata[SCALE_SETTING] = calc_setting_scale_y(plotdata, series_y)
        plotdata[SCALE_THRESHOLD] = calc_threshold_scale_y(plotdata, series_y)
        plotdata[SCALE_COMMON] = {Y_MIN: all_graph_min, Y_MAX: all_graph_max, LOWER_OUTLIER_IDXS: [],
                                  UPPER_OUTLIER_IDXS: []}
        plotdata[SCALE_FULL] = {Y_MIN: y_min, Y_MAX: y_max, LOWER_OUTLIER_IDXS: [], UPPER_OUTLIER_IDXS: []}
        if is_datetime_col:
            plotdata[SCALE_FULL][Y_MIN] = 0

    return True


@log_execution_time()
@request_timeout_handling()
def gen_kde_data_trace_data(dic_param, full_arrays=None):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        full_array_y = full_arrays[num] if full_arrays else None
        kde_list = calculate_kde_trace_data(plotdata, full_array_y=full_array_y)
        plotdata[SCALE_SETTING][KDE_DATA], plotdata[SCALE_COMMON][KDE_DATA], plotdata[SCALE_THRESHOLD][KDE_DATA], \
        plotdata[SCALE_AUTO][KDE_DATA], plotdata[SCALE_FULL][KDE_DATA] = kde_list

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
    na_percentage = signify_digit(100 * na_counts / n_total) if n_total else 0
    non_na_percentage = signify_digit(100 - na_percentage)
    return dict(nTotal=n_total, nonNACounts=non_na_counts, nonNAPercentage=non_na_percentage)


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
def gen_unique_data(df, dic_proc_cfgs, col_ids, ):
    if not col_ids:
        return {}

    dic_unique_cate = {}
    dic_cols = {col.id: col for col in CfgProcessColumn.get_by_ids(col_ids)}
    for col_id in col_ids:
        cfg_col = dic_cols.get(col_id)
        col_name = cfg_col.column_name
        master_name = cfg_col.name
        proc_id = cfg_col.process_id

        sql_label = gen_sql_label(RANK_COL, col_id, col_name)
        if sql_label not in df.columns:
            sql_label = gen_sql_label(col_id, col_name)

        unique_data = []
        if sql_label in df.columns:
            # unique_data = df[sql_label].drop_duplicates().dropna().tolist()
            s = df[sql_label].value_counts()
            unique_data = s.index.tolist()

        cfg_proc_name = dic_proc_cfgs[proc_id].name
        unique_data = {'proc_name': proc_id, 'proc_master_name': cfg_proc_name, 'column_name': col_name,
                       'column_master_name': master_name, 'column_id': col_id,
                       UNIQUE_CATEGORIES: unique_data}

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

        dtype_name = cfg_col.data_type
        if dtype_name == DataType.INTEGER.name:
            vals = [int(val) for val in vals]
        elif dtype_name == DataType.REAL.name:
            vals = [float(val) for val in vals]
        elif dtype_name == DataType.TEXT.name:
            vals = [str(val) for val in vals]
            df[sql_label] = df[sql_label].astype(str)

        df = df[df[sql_label].isin(vals)]

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
