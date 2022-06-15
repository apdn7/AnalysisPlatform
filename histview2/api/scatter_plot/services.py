import math
import re
from collections import Counter
from copy import deepcopy
from typing import List

import numpy as np
import pandas as pd
from numpy import matrix
from pandas import Series, RangeIndex, Index

from histview2.api.categorical_plot.services import produce_cyclic_terms, gen_dic_param_terms, gen_time_conditions
from histview2.api.trace_data.services.time_series_chart import (get_data_from_db,
                                                                 main_check_filter_detail_match_graph_data,
                                                                 calc_raw_common_scale_y,
                                                                 calc_scale_info, get_procs_in_dic_param,
                                                                 gen_unique_data, filter_df,
                                                                 customize_dic_param_for_reuse_cache,
                                                                 get_chart_info_detail)
from histview2.common.common_utils import gen_sql_label
from histview2.common.constants import ACTUAL_RECORD_NUMBER, \
    IS_RES_LIMITED, ARRAY_Y, MATCHED_FILTER_IDS, UNMATCHED_FILTER_IDS, NOT_EXACT_MATCH_FILTER_IDS, ARRAY_X, \
    TIMES, COLORS, H_LABEL, V_LABEL, DataType, CHART_TYPE, CYCLIC_DIV_NUM, COMMON, START_DATE, \
    START_TM, END_DATE, END_TM, ELAPSED_TIME, ARRAY_Z, ChartType, SCALE_COLOR, END_COL_ID, END_PROC_ID, \
    SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL, SCALE_Y, SCALE_X, TIME_MIN, TIME_MAX, \
    ORIG_ARRAY_Z, SUMMARIES, N_TOTAL, UNIQUE_CATEGORIES, UNIQUE_DIV, UNIQUE_COLOR, CAT_EXP_BOX, X_THRESHOLD, \
    Y_THRESHOLD, SCALE_SETTING, \
    CHART_INFOS, X_SERIAL, Y_SERIAL, ARRAY_PLOTDATA, IS_DATA_LIMITED, ColorOrder, TIME_NUMBERINGS, SORT_KEY, \
    VAR_TRACE_TIME
from histview2.common.memoize import memoize
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.common.services.sse import notify_progress
from histview2.common.services.statistics import calc_summary_elements
from histview2.common.trace_data_log import *
from histview2.setting_module.models import CfgProcessColumn
from histview2.trace_data.models import Cycle

DATA_COUNT_COL = '__data_count_col__'
MATRIX = 7
SCATTER_PLOT_MAX_POINT = 500_000
HEATMAP_COL_ROW = 100
TOTAL_VIOLIN_PLOT = 200


@log_execution_time('[SCATTER PLOT]')
@notify_progress(60)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.SCP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_scatter_plot(dic_param):
    """tracing data to show graph
        1 start point x n end point
        filter by condition points that between start point and end_point
    """
    recent_flg = False
    for key in dic_param[COMMON]:
        if str(key).startswith(VAR_TRACE_TIME):
            if dic_param[COMMON][key] == 'recent':
                recent_flg = True
                break

    is_data_limited = False
    # for caching
    dic_param, cat_exp, _, dic_cat_filters, use_expired_cache, temp_serial_column, temp_serial_order, *_, matrix_col, \
    color_order = customize_dic_param_for_reuse_cache(dic_param)
    matrix_col = matrix_col if matrix_col else MATRIX

    # cyclic
    terms = None
    if dic_param[COMMON].get(CYCLIC_DIV_NUM):
        produce_cyclic_terms(dic_param)
        terms = gen_dic_param_terms(dic_param)

    # get x,y,color, levels, cat_div information
    orig_graph_param = bind_dic_param_to_class(dic_param)
    threshold_filter_detail_ids = orig_graph_param.common.threshold_boxes
    dic_proc_cfgs = get_procs_in_dic_param(orig_graph_param)
    scatter_xy_ids = []
    scatter_xy_names = []
    scatter_proc_ids = []
    for proc in orig_graph_param.array_formval:
        scatter_proc_ids.append(proc.proc_id)
        scatter_xy_ids = scatter_xy_ids + proc.col_ids
        scatter_xy_names = scatter_xy_names + proc.col_names

    x_proc_id = scatter_proc_ids[0]
    y_proc_id = scatter_proc_ids[-1]
    x_id = scatter_xy_ids[0]
    y_id = scatter_xy_ids[-1]
    x_name = scatter_xy_names[0]
    y_name = scatter_xy_names[-1]
    x_label = gen_sql_label(x_id, x_name)
    y_label = gen_sql_label(y_id, y_name)

    color_id = orig_graph_param.common.color_var
    cat_div_id = orig_graph_param.common.div_by_cat
    level_ids = cat_exp if cat_exp else orig_graph_param.common.cat_exp
    col_ids = [col for col in list(set([x_id, y_id, color_id, cat_div_id] + level_ids)) if col]
    dic_cols = {cfg_col.id: cfg_col for cfg_col in CfgProcessColumn.get_by_ids(col_ids)}

    color_label = gen_sql_label(color_id, dic_cols[color_id].column_name) if color_id else None
    level_labels = [gen_sql_label(id, dic_cols[id].column_name) for id in level_ids]
    cat_div_label = gen_sql_label(cat_div_id, dic_cols[cat_div_id].column_name) if cat_div_id else None
    if orig_graph_param.common.compare_type == 'directTerm':
        matched_filter_ids = []
        unmatched_filter_ids = []
        not_exact_match_filter_ids = []
        actual_record_number = 0
        is_res_limited = False

        dic_dfs = {}
        terms = gen_time_conditions(dic_param)
        df = None
        for term in terms:
            # create dic_param for each term from original dic_param
            term_dic_param = deepcopy(dic_param)
            term_dic_param[COMMON][START_DATE] = term[START_DATE]
            term_dic_param[COMMON][START_TM] = term[START_TM]
            term_dic_param[COMMON][END_DATE] = term[END_DATE]
            term_dic_param[COMMON][END_TM] = term[END_TM]
            h_keys = (term[START_DATE], term[START_TM], term[END_DATE], term[END_TM])

            # query data and gen df
            df_term, graph_param, record_number, _is_res_limited = gen_df(term_dic_param,
                                                                          _use_expired_cache=use_expired_cache)
            if df is None:
                df = df_term.copy()
            else:
                df = pd.concat([df, df_term])

            # filter list
            df_term = filter_df(df_term, dic_cat_filters)

            if _is_res_limited:
                is_res_limited = _is_res_limited

            # check filter match or not ( for GUI show )
            filter_ids = main_check_filter_detail_match_graph_data(graph_param, df_term)

            # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids, actual records
            actual_record_number += record_number
            matched_filter_ids += filter_ids[0]
            unmatched_filter_ids += filter_ids[1]
            not_exact_match_filter_ids += filter_ids[2]

            dic_dfs[h_keys] = df_term

        # gen scatters
        output_graphs, output_times = gen_scatter_by_direct_term(matrix_col, dic_dfs, x_proc_id, y_proc_id, x_label,
                                                                 y_label, color_label, level_labels)
    else:
        # query data and gen df
        df, graph_param, actual_record_number, is_res_limited = gen_df(dic_param,
                                                                       _use_expired_cache=use_expired_cache)

        # filter list
        df_sub = filter_df(df, dic_cat_filters)

        # check filter match or not ( for GUI show )
        matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = \
            main_check_filter_detail_match_graph_data(graph_param, df_sub)

        if orig_graph_param.common.div_by_data_number:
            output_graphs, output_times = gen_scatter_data_count(matrix_col, df_sub, x_proc_id, y_proc_id, x_label,
                                                                 y_label, orig_graph_param.common.div_by_data_number,
                                                                 color_label, level_labels, recent_flg)
        elif orig_graph_param.common.cyclic_div_num:
            output_graphs, output_times = gen_scatter_by_cyclic(matrix_col, df_sub, x_proc_id, y_proc_id, x_label,
                                                                y_label, terms, color_label, level_labels)
        else:
            output_graphs, output_times = gen_scatter_cat_div(matrix_col, df_sub, x_proc_id, y_proc_id, x_label,
                                                              y_label, cat_div_label, color_label, level_labels)

    # check graphs
    if not output_graphs:
        return dic_param

    # chart type
    series_keys = [ARRAY_X, ARRAY_Y, COLORS, TIMES]
    chart_type = get_chart_type(x_id, y_id, dic_cols)
    dic_param[CHART_TYPE] = chart_type
    if chart_type == ChartType.HEATMAP.value:
        # get unique data
        dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, [id for id in (x_id, y_id) if id])

        # get color for filter
        dic_unique_color = gen_unique_data(df, dic_proc_cfgs, [])

        # get div for filter
        dic_unique_div = gen_unique_data(df, dic_proc_cfgs, [id for id in [cat_div_id] if id])

        # gen matrix
        all_x, all_y = get_heatmap_distinct(output_graphs)
        for graph in output_graphs:
            # handle x, y, z data
            array_x = graph[ARRAY_X]
            array_y = graph[ARRAY_Y]
            unique_x = set(array_x.drop_duplicates().tolist())
            unique_y = set(array_y.drop_duplicates().tolist())

            missing_x = all_x - unique_x
            missing_y = all_y - unique_y
            array_z = pd.crosstab(array_y, array_x)
            for key in missing_x:
                array_z[key] = None

            sorted_cols = sorted(array_z.columns)
            array_z = array_z[sorted_cols]

            missing_data = [None] * len(missing_y)
            df_missing = pd.DataFrame({col: missing_data for col in array_z.columns}, index=missing_y)
            array_z = pd.concat([array_z, df_missing])
            array_z.sort_index(inplace=True)

            # limit 10K cells
            if array_z.size > HEATMAP_COL_ROW * HEATMAP_COL_ROW:
                array_z = array_z[:HEATMAP_COL_ROW][array_z.columns[:HEATMAP_COL_ROW]]

            graph[ARRAY_X] = array_z.columns
            graph[ARRAY_Y] = array_z.index
            graph[ORIG_ARRAY_Z] = matrix(array_z)

            # ratio
            z_count = len(array_x)
            array_z = array_z * 100 // z_count
            graph[ARRAY_Z] = matrix(array_z)

            # reduce sending data to browser
            graph[COLORS] = []
            graph[X_SERIAL] = []
            graph[Y_SERIAL] = []
            graph[TIMES] = []
            graph[ELAPSED_TIME] = []

    elif chart_type == ChartType.SCATTER.value:
        # get unique data
        dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, [])

        # get color for filter
        dic_unique_color = gen_unique_data(df, dic_proc_cfgs, [id for id in {color_id} if id])

        # get div for filter
        dic_unique_div = gen_unique_data(df, dic_proc_cfgs, [id for id in {cat_div_id} if id])

        # gen scatter matrix
        data_per_graph = SCATTER_PLOT_MAX_POINT / len(output_graphs)
        color_scale = []
        for graph, (x_times, y_times) in zip(output_graphs, output_times):
            # limit and sort by color
            df_graph, _is_data_limited = gen_df_limit_data(graph, series_keys, data_per_graph)
            if _is_data_limited:
                is_data_limited = True

            # sort by color (high frequency first)
            color_col = ELAPSED_TIME
            df_graph[color_col] = calc_elapsed_times(df_graph, TIMES)
            if color_order is ColorOrder.DATA:
                color_col = COLORS if COLORS in df_graph else ARRAY_X
                df_graph = sort_df(df_graph, [color_col])
            elif color_order is ColorOrder.TIME:
                color_col = TIME_NUMBERINGS
                df_graph[color_col] = pd.to_datetime(df_graph[TIMES]).rank().convert_dtypes()

            color_scale += df_graph[color_col].tolist()

            # group by and count frequency
            df_graph['__count__'] = df_graph.groupby(color_col)[color_col].transform('count')
            df_graph.sort_values('__count__', inplace=True, ascending=False)
            df_graph.drop('__count__', axis=1, inplace=True)

            for key in df_graph.columns:
                graph[key] = df_graph[key].tolist()

            # chart infos
            x_chart_infos, _ = get_chart_info_detail(x_times or graph[TIMES], x_id, threshold_filter_detail_ids)
            graph[X_THRESHOLD] = x_chart_infos[-1] if x_chart_infos else None
            y_chart_infos, _ = get_chart_info_detail(y_times or graph[TIMES], y_id, threshold_filter_detail_ids)
            graph[Y_THRESHOLD] = y_chart_infos[-1] if y_chart_infos else None
    else:
        group_by_cols = []
        unique_data_cols = [cat_div_id, color_id]
        if DataType[dic_cols[x_id].data_type] is DataType.TEXT:
            str_col = ARRAY_X
            number_col = ARRAY_Y
            group_by_cols.append(str_col)
            unique_data_cols.append(x_id)
            dic_param['string_axis'] = 'x'
            if color_id and color_id != x_id:
                group_by_cols.append(COLORS)
        else:
            str_col = ARRAY_Y
            number_col = ARRAY_X
            group_by_cols.append(str_col)
            unique_data_cols.append(x_id)
            dic_param['string_axis'] = 'y'
            if color_id and color_id != y_id:
                group_by_cols.append(COLORS)

        number_of_graph = min(len(output_graphs), matrix_col ** 2) or 1
        limit_violin_per_graph = math.floor(TOTAL_VIOLIN_PLOT / number_of_graph)
        most_vals, is_reduce_violin_number = get_most_common_in_graphs(output_graphs, group_by_cols,
                                                                       limit_violin_per_graph)
        number_of_violin = (len(most_vals) * number_of_graph) or 1
        max_n_per_violin = math.floor(10_000 / number_of_violin)

        # for show message reduced number of violin chart
        dic_param['is_reduce_violin_number'] = is_reduce_violin_number

        # get unique data
        dic_unique_cate = gen_unique_data(df, dic_proc_cfgs, [])

        # get color for filter
        dic_unique_color = gen_unique_data(df, dic_proc_cfgs, [id for id in {color_id} if id])

        # get div for filter
        dic_unique_div = gen_unique_data(df, dic_proc_cfgs, [id for id in {cat_div_id} if id])

        # gen violin data
        for graph, (x_times, y_times) in zip(output_graphs, output_times):
            # limit and sort by color
            df_graph, _is_data_limited = gen_df_limit_data(graph, series_keys)
            if _is_data_limited:
                is_data_limited = True

            df_graph = filter_violin_df(df_graph, group_by_cols, most_vals)
            df_graph = sort_df(df_graph, group_by_cols)

            # get hover information
            dic_summaries = {}
            str_col_vals = []
            num_col_vals = []
            for key, df_sub in df_graph.groupby(group_by_cols):
                if isinstance(key, (list, tuple)):
                    key = '|'.join(key)

                vals = df_sub[number_col].tolist()
                dic_summaries[key] = calc_summary_elements(
                    {ARRAY_X: df_sub[TIMES].tolist(), ARRAY_Y: vals})

                # resample_data = df_sub[number_col]
                # resample_data = resample_by_sort(df_sub[number_col], max_n_per_violin)
                resample_data = resample_preserve_min_med_max(df_sub[number_col], max_n_per_violin)
                # todo: remove q2 computing after demonstration
                # if df_sub[number_col].size:
                #     q2_raw_data = np.quantile(df_sub[number_col], [0.5])
                #     q2_new_data = np.quantile(resample_data, [0.5])
                #     q2_old_data = np.quantile(resample_data_old, [0.5])

                if resample_data is not None:
                    vals = resample_data.tolist()
                    is_data_limited = True

                str_col_vals.append(key)
                num_col_vals.append(vals)

            graph[str_col] = str_col_vals
            graph[number_col] = num_col_vals
            graph[SUMMARIES] = dic_summaries

            # reduce sending data to browser
            graph[COLORS] = []
            graph[X_SERIAL] = []
            graph[Y_SERIAL] = []
            graph[TIMES] = []
            graph[ELAPSED_TIME] = []

            if number_col == ARRAY_X:
                x_chart_infos, _ = get_chart_info_detail(x_times or graph[TIMES], x_id, threshold_filter_detail_ids)
                graph[X_THRESHOLD] = x_chart_infos[-1] if x_chart_infos else None
            else:
                y_chart_infos, _ = get_chart_info_detail(y_times or graph[TIMES], y_id, threshold_filter_detail_ids)
                graph[Y_THRESHOLD] = y_chart_infos[-1] if y_chart_infos else None

        # TODO : we should calc box plot and kde before send to front end to improve performance

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # flag to show that trace result was limited
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
    dic_param[IS_RES_LIMITED] = is_res_limited

    # check show col and row labels
    is_show_h_label = False
    is_show_v_label = False
    is_show_first_h_label = False
    v_labels = list({graph[V_LABEL] for graph in output_graphs})
    h_labels = list({graph[H_LABEL] for graph in output_graphs})
    if len(h_labels) > 1 or (h_labels and h_labels[0]):
        is_show_h_label = True

        if len(output_graphs) > len(h_labels):
            is_show_first_h_label = True

    if len(v_labels) > 1 or (v_labels and v_labels[0]):
        is_show_v_label = True

    # column names
    dic_param['x_name'] = dic_cols[x_id].name if x_id else None
    dic_param['y_name'] = dic_cols[y_id].name if y_id else None
    dic_param['color_name'] = dic_cols[color_id].name if color_id else None
    dic_param['color_type'] = dic_cols[color_id].data_type if color_id else None
    dic_param['div_name'] = dic_cols[cat_div_id].name if cat_div_id else None
    dic_param['div_data_type'] = dic_cols[cat_div_id].data_type if cat_div_id else None
    dic_param['level_names'] = [dic_cols[level_id].name for level_id in level_ids] if level_ids else None
    dic_param['is_show_v_label'] = is_show_v_label
    dic_param['is_show_h_label'] = is_show_h_label
    dic_param['is_show_first_h_label'] = is_show_first_h_label
    dic_param['is_filtered'] = True if dic_cat_filters else False

    # add proc name for x and y column
    dic_param['x_proc'] = dic_proc_cfgs[dic_cols[x_id].process_id].name if x_id else None
    dic_param['y_proc'] = dic_proc_cfgs[dic_cols[y_id].process_id].name if y_id else None

    # min, max color
    # TODO: maybe we need to get chart infor for color to get ymax ymin of all chart infos
    if color_order is ColorOrder.DATA:
        dic_scale_color = calc_scale(df, color_id, color_label, dic_cols)
    else:
        df_color_scale = pd.DataFrame({color_col: color_scale})
        dic_scale_color = calc_scale(df_color_scale, None, color_col, dic_cols)

    dic_param[SCALE_COLOR] = dic_scale_color

    # y scale
    y_chart_configs = [graph[Y_THRESHOLD] for graph in output_graphs if graph.get(Y_THRESHOLD)]
    dic_scale_y = calc_scale(df, y_id, y_label, dic_cols, y_chart_configs)
    dic_param[SCALE_Y] = dic_scale_y

    # x scale
    x_chart_configs = [graph[X_THRESHOLD] for graph in output_graphs if graph.get(X_THRESHOLD)]
    dic_scale_x = calc_scale(df, x_id, x_label, dic_cols, x_chart_configs)
    dic_param[SCALE_X] = dic_scale_x

    # output graphs
    dic_param[ARRAY_PLOTDATA] = [convert_series_to_list(graph) for graph in output_graphs]

    dic_cat_exp_unique = gen_unique_data(df, dic_proc_cfgs, level_ids)
    dic_param[CAT_EXP_BOX] = list(dic_cat_exp_unique.values())
    dic_param[UNIQUE_CATEGORIES] = list(dic_unique_cate.values())
    dic_param[UNIQUE_DIV] = list(dic_unique_div.values())
    dic_param[UNIQUE_COLOR] = list(dic_unique_color.values())
    dic_param[IS_DATA_LIMITED] = is_data_limited
    return dic_param


@log_execution_time()
def calc_scale(df, col_id, col_label, dic_cols, chart_configs=None):
    if not col_id and not col_label:
        return None

    if col_id:
        cfg_col = dic_cols.get(col_id)
        if not cfg_col:
            return None

        if df is None or not len(df):
            return None

        if DataType[cfg_col.data_type] not in (DataType.REAL, DataType.INTEGER):
            return None

        plot = {END_PROC_ID: cfg_col.process_id, END_COL_ID: col_id, ARRAY_X: df[Cycle.time.key],
                ARRAY_Y: df[col_label]}
    else:
        plot = {END_PROC_ID: None, END_COL_ID: None, ARRAY_X: [None],
                ARRAY_Y: df[col_label]}

    if chart_configs:
        plot[CHART_INFOS] = chart_configs

    min_max_list, all_min, all_max = calc_raw_common_scale_y([plot])
    calc_scale_info([plot], min_max_list, all_min, all_max)

    dic_scale = {scale_name: plot.get(scale_name) for scale_name in
                 (SCALE_SETTING, SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL)}
    return dic_scale


@log_execution_time()
def convert_series_to_list(graph):
    for key, series in graph.items():
        if isinstance(series, (Series, np.ndarray, RangeIndex, Index)):
            graph[key] = series.tolist()

    return graph


@log_execution_time()
@memoize(is_save_file=True)
def gen_df(dic_param, _use_expired_cache=False):
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    # target procs
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()
    # add condition procs
    graph_param.add_cond_procs_to_array_formval()
    # add level
    graph_param.add_cat_exp_to_array_formval()
    # add color, cat_div
    graph_param.add_column_to_array_formval([graph_param.common.color_var, graph_param.common.div_by_cat])

    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids)

    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(graph_param)
    return df, graph_param, actual_record_number, is_res_limited


@log_execution_time()
def get_chart_type(x_id, y_id, dic_cols):
    number_types = (DataType.INTEGER, DataType.REAL)
    x_type = DataType[dic_cols[x_id].data_type]
    y_type = DataType[dic_cols[y_id].data_type]
    if x_type in number_types and y_type in number_types:
        return ChartType.SCATTER.value
    elif x_type is DataType.TEXT and y_type is DataType.TEXT:
        return ChartType.HEATMAP.value
    else:
        return ChartType.VIOLIN.value


@log_execution_time()
def split_data_by_number(df: DataFrame, count):
    df[DATA_COUNT_COL] = df.reset_index().index // count
    return df


def sort_data_count_key(key):
    new_key = re.match(r'^\d+', str(key))
    if new_key is not None:
        return int(new_key[0])

    return key


@log_execution_time()
def group_by_df(df: DataFrame, cols, max_group=None, max_record_per_group=None, sort_key_func=None, reverse=True,
                get_from_last=None):
    dic_groups = {}
    if not len(df):
        return dic_groups

    if not cols:
        dic_groups[None] = df.head(max_record_per_group)
        return dic_groups

    df_groups = df.groupby(cols)
    max_group = max_group or len(df_groups.groups)

    # sort desc
    if sort_key_func:
        sort_func = lambda x: sort_key_func(x[0])
    else:
        sort_func = lambda x: int(x[0]) if str(x[0]).isnumeric() else x[0]

    groups = sorted([(key, df_group) for key, df_group in df_groups], key=sort_func, reverse=reverse)
    groups = groups[:max_group]
    if get_from_last:
        groups.reverse()

    for key, df_group in groups:
        dic_groups[key] = df_group.head(max_record_per_group)

    return dic_groups


@log_execution_time()
def split_df_by_time_range(dic_df_chunks, max_group=None, max_record_per_group=None):
    dic_groups = {}
    max_group = max_group or len(dic_df_chunks)

    count = 0
    for key, df_group in dic_df_chunks.items():
        # for key, df_group in df_groups.groups.items():
        if count >= max_group:
            break

        dic_groups[key] = df_group.head(max_record_per_group)
        count += 1

    return dic_groups


@log_execution_time()
def drop_missing_data(df: DataFrame, cols):
    if len(df):
        df.dropna(subset=[col for col in cols if col], inplace=True)
        df = df.convert_dtypes()
    return df


@log_execution_time()
def get_v_keys_str(v_keys):
    if v_keys is None:
        v_keys_str = None
    elif isinstance(v_keys, (list, tuple)):
        v_keys_str = '|'.join([str(key) for key in v_keys])
    else:
        v_keys_str = v_keys
    return v_keys_str


@log_execution_time()
def calc_elapsed_times(df_data, time_col):
    elapsed_times = pd.to_datetime(df_data[time_col]).sort_values()
    elapsed_times = elapsed_times.diff().dt.total_seconds().fillna(0)
    elapsed_times = elapsed_times.sort_index()
    elapsed_times = elapsed_times.convert_dtypes()
    return elapsed_times


@log_execution_time()
def gen_scatter_data_count(matrix_col, df: DataFrame, x_proc_id, y_proc_id, x, y, data_count_div, color=None,
                           levels=None, recent_flg=None):
    """
    spit by data count
    :param matrix_col:
    :param df:
    :param x_proc_id:
    :param y_proc_id:
    :param x:
    :param y:
    :param data_count_div:
    :param color:
    :param levels:
    :return:
    """
    if levels is None:
        levels = []

    # time column
    time_col = Cycle.time.key
    # time_col = [col for col in df.columns if col.startswith(Cycle.time.key)][0]

    # remove missing data
    df = drop_missing_data(df, [x, y, color] + levels)

    h_group_col = DATA_COUNT_COL

    v_group_cols = [col for col in levels if col and col != h_group_col]

    # graph number is depend on facet
    max_graph = matrix_col if v_group_cols else matrix_col * matrix_col

    # facet
    dic_groups = {}
    dic_temp_groups = group_by_df(df, v_group_cols)
    facet_keys = [key for key, _ in Counter(dic_temp_groups.keys()).most_common(matrix_col)]
    for key, df_group in dic_temp_groups.items():
        if key not in facet_keys:
            continue

        df_group = split_data_by_number(df_group, data_count_div)
        df_group = reduce_data_by_number(df_group, max_graph, recent_flg)

        dic_groups[key] = group_by_df(df_group, h_group_col, max_graph, sort_key_func=sort_data_count_key,
                                      reverse=recent_flg, get_from_last=recent_flg)

        facet_keys.append(key)

    # serials
    x_serial_cols = CfgProcessColumn.get_serials(x_proc_id)
    if y_proc_id == x_proc_id:
        y_serial_cols = None
    else:
        y_serial_cols = CfgProcessColumn.get_serials(y_proc_id)

    output_graphs = []
    output_times = []
    for v_keys, dic_group in dic_groups.items():
        if v_keys not in facet_keys:
            continue

        for idx, (h_key, df_data) in enumerate(dic_group.items()):
            if recent_flg:
                h_key = idx

            h_keys_str = f'{data_count_div * h_key + 1} – {data_count_div * (h_key + 1)}'

            v_keys_str = get_v_keys_str(v_keys)
            # elapsed_times = calc_elapsed_times(df_data, time_col)

            # v_label : name ( not id )
            dic_data = gen_dic_graphs(df_data, x, y, h_keys_str, v_keys_str, color, time_col, sort_key=h_key)

            # serial
            dic_data[X_SERIAL] = get_proc_serials(df_data, x_serial_cols)
            dic_data[Y_SERIAL] = get_proc_serials(df_data, y_serial_cols)

            output_times.append((get_proc_times(df_data, x_proc_id), get_proc_times(df_data, y_proc_id)))
            output_graphs.append(dic_data)

    return output_graphs, output_times


@log_execution_time()
def get_proc_times(df, proc_id):
    col_name = f'{Cycle.time.key}_{proc_id}'
    if col_name in df.columns:
        return df[col_name].tolist()

    return []


@log_execution_time()
def gen_scatter_by_cyclic(matrix_col, df: DataFrame, x_proc_id, y_proc_id, x, y, terms, color=None, levels=None):
    """
    split by terms
    :param matrix_col:
    :param df:
    :param x_proc_id:
    :param y_proc_id:
    :param x:
    :param y:
    :param terms:
    :param color:
    :param levels:
    :return:
    """
    if levels is None:
        levels = []

    # time column
    time_col = Cycle.time.key
    # time_col = [col for col in df.columns if col.startswith(Cycle.time.key)][0]

    # remove missing data
    df = drop_missing_data(df, [x, y, color] + levels)

    dic_df_chunks = {}
    df.set_index(Cycle.time.key, inplace=True, drop=False)
    for term_id, term in enumerate(terms):
        start_dt = term['start_dt']
        end_dt = term['end_dt']
        df_chunk = df[(df.index >= start_dt) & (df.index < end_dt)]
        dic_df_chunks[(start_dt, end_dt)] = df_chunk

    v_group_cols = [col for col in levels if col]

    # graph number is depend on facet
    max_graph = matrix_col if v_group_cols else matrix_col * matrix_col
    dic_groups = split_df_by_time_range(dic_df_chunks, max_graph)

    # facet
    dic_groups = {key: group_by_df(df_group, v_group_cols) for key, df_group in dic_groups.items()}
    facet_keys = [key for key, _ in
                  Counter([val for vals in dic_groups.values() for val in vals]).most_common(matrix_col)]

    # serials
    x_serial_cols = CfgProcessColumn.get_serials(x_proc_id)
    if y_proc_id == x_proc_id:
        y_serial_cols = None
    else:
        y_serial_cols = CfgProcessColumn.get_serials(y_proc_id)

    output_graphs = []
    output_times = []
    for h_key, dic_group in dic_groups.items():
        h_keys_str = f'{h_key[0]} – {h_key[1]}'

        for v_keys, df_data in dic_group.items():
            if v_keys not in facet_keys:
                continue

            v_keys_str = get_v_keys_str(v_keys)
            # elapsed_times = calc_elapsed_times(df_data, time_col)

            # v_label : name ( not id )
            dic_data = gen_dic_graphs(df_data, x, y, h_keys_str, v_keys_str, color, time_col)

            # serial
            dic_data[X_SERIAL] = get_proc_serials(df_data, x_serial_cols)
            dic_data[Y_SERIAL] = get_proc_serials(df_data, y_serial_cols)

            output_times.append((get_proc_times(df_data, x_proc_id), get_proc_times(df_data, y_proc_id)))
            output_graphs.append(dic_data)

    return output_graphs, output_times


@log_execution_time()
def gen_scatter_cat_div(matrix_col, df: DataFrame, x_proc_id, y_proc_id, x, y, cat_div=None, color=None, levels=None):
    """
    category divide
    :param matrix_col:
    :param df:
    :param x_proc_id:
    :param y_proc_id:
    :param x:
    :param y:
    :param cat_div:
    :param color:
    :param levels:
    :return:
    """
    if levels is None:
        levels = []

    # time column
    time_col = Cycle.time.key
    # time_col = [col for col in df.columns if col.startswith(Cycle.time.key)][0]

    # remove missing data
    df = drop_missing_data(df, [x, y, cat_div, color] + levels)

    h_group_col = cat_div
    if not h_group_col:
        if len(levels) > 1:
            h_group_col = levels[-1]

    v_group_cols = [col for col in levels if col and col != h_group_col]

    # graph number is depend on facet
    max_graph = matrix_col if v_group_cols else matrix_col * matrix_col

    dic_groups = group_by_df(df, h_group_col, max_graph)

    # facet
    dic_groups = {key: group_by_df(df_group, v_group_cols) for key, df_group in dic_groups.items()}
    facet_keys = [key for key, _ in
                  Counter([val for vals in dic_groups.values() for val in vals]).most_common(matrix_col)]

    # serials
    x_serial_cols = CfgProcessColumn.get_serials(x_proc_id)
    if y_proc_id == x_proc_id:
        y_serial_cols = None
    else:
        y_serial_cols = CfgProcessColumn.get_serials(y_proc_id)

    output_graphs = []
    output_times = []
    for h_key, dic_group in dic_groups.items():
        h_keys_str = h_key

        for v_keys, df_data in dic_group.items():
            if v_keys not in facet_keys:
                continue

            v_keys_str = get_v_keys_str(v_keys)
            # elapsed_times = calc_elapsed_times(df_data, time_col)

            # v_label : name ( not id )
            dic_data = gen_dic_graphs(df_data, x, y, h_keys_str, v_keys_str, color, time_col)

            # serial
            dic_data[X_SERIAL] = get_proc_serials(df_data, x_serial_cols)
            dic_data[Y_SERIAL] = get_proc_serials(df_data, y_serial_cols)

            output_times.append((get_proc_times(df_data, x_proc_id), get_proc_times(df_data, y_proc_id)))
            output_graphs.append(dic_data)

    return output_graphs, output_times


@log_execution_time()
def gen_scatter_by_direct_term(matrix_col, dic_df_chunks, x_proc_id, y_proc_id, x, y, color=None, levels=None):
    """
    split by terms
    :param matrix_col:
    :param dic_df_chunks
    :param x_proc_id:
    :param y_proc_id:
    :param x:
    :param y:
    :param color:
    :param levels:
    :return:
    """
    if levels is None:
        levels = []

    # time column
    time_col = Cycle.time.key

    # remove missing data
    for key, df in dic_df_chunks.items():
        dic_df_chunks[key] = drop_missing_data(df, [x, y, color] + levels)

    v_group_cols = [col for col in levels if col]

    # graph number is depend on facet
    max_graph = matrix_col if v_group_cols else matrix_col * matrix_col
    dic_groups = split_df_by_time_range(dic_df_chunks, max_graph)

    # facet
    dic_groups = {key: group_by_df(df_group, v_group_cols) for key, df_group in dic_groups.items()}
    facet_keys = [key for key, _ in
                  Counter([val for vals in dic_groups.values() for val in vals]).most_common(matrix_col)]

    # serials
    x_serial_cols = CfgProcessColumn.get_serials(x_proc_id)
    if y_proc_id == x_proc_id:
        y_serial_cols = None
    else:
        y_serial_cols = CfgProcessColumn.get_serials(y_proc_id)

    output_graphs = []
    output_times = []
    for h_key, dic_group in dic_groups.items():
        h_keys_str = f'{h_key[0]} {h_key[1]} – {h_key[2]} {h_key[3]}'

        for v_keys, df_data in dic_group.items():
            if v_keys not in facet_keys:
                continue

            v_keys_str = get_v_keys_str(v_keys)
            # elapsed_times = calc_elapsed_times(df_data, time_col)

            # v_label : name ( not id )
            dic_data = gen_dic_graphs(df_data, x, y, h_keys_str, v_keys_str, color, time_col)

            # serial
            dic_data[X_SERIAL] = get_proc_serials(df_data, x_serial_cols)
            dic_data[Y_SERIAL] = get_proc_serials(df_data, y_serial_cols)

            output_times.append((get_proc_times(df_data, x_proc_id), get_proc_times(df_data, y_proc_id)))
            output_graphs.append(dic_data)

    return output_graphs, output_times


@log_execution_time()
def gen_dic_graphs(df_data, x, y, h_keys_str, v_keys_str, color, time_col, sort_key=None):
    times = df_data[time_col]
    n = times.dropna().size
    time_min = np.nanmin(times) if n else None
    time_max = np.nanmax(times) if n else None

    dic_data = {H_LABEL: h_keys_str,
                V_LABEL: v_keys_str,
                ARRAY_X: df_data[x],
                ARRAY_Y: df_data[y],
                COLORS: df_data[color] if color else [],
                TIMES: times,
                TIME_MIN: time_min,
                TIME_MAX: time_max,
                N_TOTAL: n,
                SORT_KEY: h_keys_str if sort_key is None else sort_key,
                }
    return dic_data


@log_execution_time()
def gen_df_limit_data(graph, keys, limit=None):
    is_limit = False
    dic_data = {}
    for key in keys:
        count = len(graph[key])
        if not count:
            continue

        if limit is None or count <= limit:
            dic_data[key] = graph[key]
        else:
            is_limit = True
            dic_data[key] = graph[key][:limit]

    return pd.DataFrame(dic_data), is_limit


@log_execution_time()
def sort_df(df, columns):
    cols = [col for col in columns if col in df.columns]
    df.sort_values(by=cols, inplace=True)

    return df


@log_execution_time()
def get_most_common_in_graphs(graphs, columns, first_most_common):
    data = []
    for graph in graphs:
        vals = pd.DataFrame({col: graph[col] for col in columns}).drop_duplicates().to_records(index=False).tolist()
        data += vals

    original_vals = [key for key, _ in Counter(data).most_common(None)]
    most_vals = [key for key, _ in Counter(data).most_common(first_most_common)]
    if len(columns) == 1:
        most_vals = [vals[0] for vals in most_vals]

    is_reduce_violin_number = len(original_vals) > len(most_vals)

    return most_vals, is_reduce_violin_number


@log_execution_time()
def filter_violin_df(df, cols, most_vals):
    df_result = df[df.set_index(cols).index.isin(most_vals)]
    return df_result


@log_execution_time()
def get_heatmap_distinct(graphs):
    array_x = []
    array_y = []
    for graph in graphs:
        array_x += graph[ARRAY_X].drop_duplicates().tolist()
        array_y += graph[ARRAY_Y].drop_duplicates().tolist()

    return set(array_x), set(array_y)


@log_execution_time()
def get_proc_serials(df: DataFrame, serial_cols: List[CfgProcessColumn]):
    if not serial_cols:
        return None

    if df is None or len(df) == 0:
        return None

    # serials
    serials = []
    for col in serial_cols:
        sql_label = gen_sql_label(col.id, col.column_name)
        if sql_label in df.columns:
            dic_serial = {'col_name': col.name, 'data': df[sql_label].tolist()}
            serials.append(dic_serial)

    return serials


@log_execution_time()
def resample_by_sort(x, max_n=10):
    """
    Sort data first, then extract rows (equal interval)
    Inputs:
        x: Pandas series
        max_n: Maximum number of rows
    Returns:
        x: pandas series of length min(x.shape[0], max_n)
    """
    if x.shape[0] > max_n:
        x = np.sort(x)
        idx = np.linspace(0, len(x) - 1, max_n, dtype=int)
        x = x[idx]
    return x



@log_execution_time()
def reduce_data_by_number(df, max_graph, recent_flg=None):
    if not len(df):
        return df

    if recent_flg:
        first_num = df[DATA_COUNT_COL].iloc[-1] - max_graph
        if first_num >= 0:
            df = df[df[DATA_COUNT_COL] > first_num]
    else:
        first_num = df[DATA_COUNT_COL].iloc[0] + max_graph
        if first_num >= 0:
            df = df[df[DATA_COUNT_COL] < first_num]

    return df

@log_execution_time()
def resample_preserve_min_med_max(x, n_after: int):
    """ Resample x, but preserve (minimum, median, and maximum) values
    Inputs:
        x (1D-NumpyArray or a list)
        n_after (int) Length of x after resampling. Must be < len(x)
    Return:
        x (1D-NumpyArray) Resampled data
    """
    if x.shape[0] > n_after:
        # walkaround: n_after with odd number is easier
        if n_after % 2 == 0:
            n_after += 1

        n = len(x)
        n_half = int((n_after - 1) / 2)

        # index around median
        x = np.sort(x)
        idx_med = (n + 1) / 2 - 1              # median
        idx_med_l = int(np.ceil(idx_med - 1))  # left of median
        idx_med_r = int(np.floor(idx_med + 1)) # right of median

        # resampled index
        idx_low = np.linspace(0, idx_med_l - 1, num=n_half, dtype=int)
        idx_upp = np.linspace(idx_med_r, n - 1, num=n_half, dtype=int)

        # resampling
        if n % 2 == 1:
            med = x[int(idx_med)]
            x = np.concatenate((x[idx_low], [med], x[idx_upp]))
        else:
            med = 0.5 * (x[idx_med_l] + x[idx_med_r])
            x = np.concatenate((x[idx_low], [med], x[idx_upp]))
    return x