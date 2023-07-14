import traceback
from collections import defaultdict
from copy import deepcopy

import numpy as np
import pandas
import pandas as pd
import pytz
from dateutil import tz

from ap.api.categorical_plot.services import (gen_graph_param,
                                              category_bind_dic_param_to_class,
                                              gen_trace_data_by_cyclic_common, split_data_by_condition,
                                              customize_dict_param_common, split_data_by_div)
from ap.api.common.services.services import convert_datetime_to_ct
from ap.api.trace_data.services.time_series_chart import (get_data_from_db, gen_new_dic_param,
                                                          get_non_sensor_cols, gen_graph,
                                                          gen_dic_data_from_df, get_procs_in_dic_param,
                                                          main_check_filter_detail_match_graph_data,
                                                          get_cfg_proc_col_info,
                                                          customize_dic_param_for_reuse_cache,
                                                          filter_cat_dict_common, calc_raw_common_scale_y,
                                                          get_chart_infos, get_min_max_of_all_chart_infos,
                                                          calc_auto_scale_y, calc_setting_scale_y,
                                                          calc_threshold_scale_y, detect_abnormal_data,
                                                          extend_min_max, gen_cat_label_unique)
from ap.common.common_utils import (start_of_minute, end_of_minute, gen_sql_label)
from ap.common.constants import *
from ap.common.memoize import memoize
from ap.common.services.ana_inf_data import get_bound, get_grid_points, calculate_kde_for_ridgeline
from ap.common.services.request_time_out_handler import abort_process_handler, request_timeout_handling
from ap.common.services.sse import notify_progress
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.timezone_utils import convert_dt_str_to_timezone, from_utc_to_localtime
from ap.common.trace_data_log import *
from ap.setting_module.models import CfgProcess, CfgProcessColumn
from ap.trace_data.models import Cycle
from ap.trace_data.schemas import DicParam


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.RLP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_trace_data_by_cyclic(dic_param, max_graph=None):
    dic_param, export_df = gen_trace_data_by_cyclic_common(dic_param)
    term_groups = [gen_term_groups(term) for term in dic_param.get('time_conds')] or []
    dic_plotdata = defaultdict(list)
    for plotdata in dic_param[ARRAY_PLOTDATA]:
        dic_plotdata[plotdata['end_col']].append(plotdata)

    dic_param[ARRAY_PLOTDATA], dic_param[IS_GRAPH_LIMITED] = gen_cyclic_term_plotdata(dic_plotdata, dic_param,
                                                                                      max_graph)

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA], y_col='data')
    calc_rlp_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max, end_col_id='sensor_id')

    # calculate emd data
    cal_emd_data(dic_param)
    gen_rlp_kde(dic_param, term_groups)

    return dic_param, export_df


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.RLP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_trace_data_by_categorical_var(dic_param, max_graph=None):
    """tracing data to show graph
        1 start point x n end point
        filter by condition points that between start point and end_point
    """

    dic_param, cat_exp, cat_procs, dic_cat_filters, use_expired_cache, *_ = customize_dic_param_for_reuse_cache(
        dic_param)
    # gen graph_param
    graph_param, dic_proc_cfgs = gen_graph_param(dic_param, with_ct_col=True)

    cat_div_id = graph_param.common.div_by_cat
    if cat_div_id:
        graph_param.add_column_to_array_formval([graph_param.common.div_by_cat])

    # get data from database
    df, actual_record_number, unique_serial = get_data_from_db(graph_param, dic_cat_filters,
                                                               use_expired_cache=use_expired_cache)

    df, dic_param = filter_cat_dict_common(df, dic_param, dic_cat_filters, cat_exp, cat_procs, graph_param)

    export_df = df.copy()

    convert_datetime_to_ct(df, graph_param)
    # check filter match or not ( for GUI show )
    matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = main_check_filter_detail_match_graph_data(
        graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # gen dic_data
    dic_data = gen_dic_data_from_df(df, graph_param, calculate_cycle_time=False)

    # flag to show that trace result was limited
    dic_param[UNIQUE_SERIAL] = unique_serial

    # convert proc to cols dic
    # transform raw data to graph data
    # create output data
    orig_graph_param: DicParam = category_bind_dic_param_to_class(dic_param)
    dic_data, is_graph_limited, div_names = split_data_by_condition(dic_data, orig_graph_param, max_graph)

    # split data by div
    if cat_div_id:
        dic_data = split_data_by_div(dic_data, div_names)

    end_cols = []
    for param in orig_graph_param.array_formval:
        end_cols += param.col_ids

    dic_param[ARRAY_PLOTDATA], is_graph_limited = gen_custom_plotdata(dic_data, end_cols, cat_div_id, max_graph)
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
    dic_param[TIMES] = df[Cycle.time.key].tolist()
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited

    # get visualization setting
    add_threshold_configs(dic_param, orig_graph_param)

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA], y_col='data')
    calc_rlp_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max, end_col_id='sensor_id')

    # calculate emd data
    cal_emd_data(dic_param)
    gen_rlp_kde(dic_param, div_names)

    return dic_param, export_df


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.RLP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_rlp_data_by_term(dic_param, max_graph=None):
    """rlp data to show graph
        filter by condition points that between start point and end_point
    """

    dic_param[ARRAY_PLOTDATA] = []
    terms = dic_param.get(TIME_CONDS) or []

    dic_param[MATCHED_FILTER_IDS] = []
    dic_param[UNMATCHED_FILTER_IDS] = []
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = []
    dic_param[ACTUAL_RECORD_NUMBER] = 0
    dic_param[UNIQUE_SERIAL] = 0

    term_results = []
    export_dfs = []
    df = None
    for term in terms:
        # create dic_param for each term from original dic_param
        term_dic_param = deepcopy(dic_param)
        term_dic_param[TIME_CONDS] = [term]
        term_dic_param[COMMON][START_DATE] = term[START_DATE]
        term_dic_param[COMMON][START_TM] = term[START_TM]
        term_dic_param[COMMON][END_DATE] = term[END_DATE]
        term_dic_param[COMMON][END_TM] = term[END_TM]

        # get data from database + visual setting from yaml
        term_result, export_df, graph_param = gen_graph(term_dic_param, use_export_df=True)

        if df is None:
            df = export_df.copy()
        else:
            df = pd.concat([df, export_df])

        # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
        dic_param[MATCHED_FILTER_IDS] += term_result.get(MATCHED_FILTER_IDS, [])
        dic_param[UNMATCHED_FILTER_IDS] += term_result.get(UNMATCHED_FILTER_IDS, [])
        dic_param[NOT_EXACT_MATCH_FILTER_IDS] += term_result.get(NOT_EXACT_MATCH_FILTER_IDS, [])
        dic_param[ACTUAL_RECORD_NUMBER] = term_result.get(ACTUAL_RECORD_NUMBER, 0)

        unique_serial = term_result.get(UNIQUE_SERIAL)
        if unique_serial is None:
            dic_param[UNIQUE_SERIAL] = None
        if dic_param[UNIQUE_SERIAL] is not None:
            dic_param[UNIQUE_SERIAL] += term_result.get(UNIQUE_SERIAL)

        term_results.append(term_result)
        export_dfs.append(export_df)

    # rpl_array_data
    dic_rlp, is_graph_limited = transform_data_to_rlp(term_results, max_graph, terms)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited
    dic_param[ARRAY_PLOTDATA] = [plotdata for dic_cat_exp in dic_rlp.values() for plotdata in dic_cat_exp.values()]
    # get list cat_exp_box
    dic_param = gen_cat_label_unique(df, dic_param, graph_param)

    term_groups = [gen_term_groups(term) for term in terms]

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA], y_col='data')
    calc_rlp_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max, end_col_id='sensor_id')

    # calculate emd data
    cal_emd_data(dic_param)
    gen_rlp_kde(dic_param, term_groups)

    return dic_param, df


@log_execution_time()
@abort_process_handler()
def transform_data_to_rlp(term_results, max_graph=None, terms=[]):
    is_graph_limited = False
    dic_plots = defaultdict(dict)
    count = 0
    for term_result in term_results:
        time_range = term_result[TIME_CONDS][0][START_DT] + 'Z' + ' | ' + term_result[TIME_CONDS][0][END_DT] + 'Z'
        for dic_plot in term_result[ARRAY_PLOTDATA]:
            selected_sensor = int(dic_plot[END_COL_ID])
            array_y = dic_plot[ARRAY_Y]
            sensor_name = dic_plot[END_COL_NAME]
            proc_name = dic_plot[END_PROC_NAME]
            proc_id = dic_plot[END_PROC_ID]
            group_name = dic_plot.get(CAT_EXP_BOX) or ''

            if selected_sensor in dic_plots:
                if group_name in dic_plots[selected_sensor]:
                    plotdata = dic_plots[selected_sensor][group_name]
                else:
                    if max_graph and count >= max_graph:
                        is_graph_limited = True
                        continue

                    plotdata = gen_blank_rlp_plot(proc_name=proc_name, proc_id=proc_id, sensor_name=sensor_name,
                                                  sensor_id=selected_sensor, group_name=group_name)
                    dic_plots[selected_sensor][group_name] = plotdata
                    count += 1
            else:
                if max_graph and count >= max_graph:
                    is_graph_limited = True
                    continue

                plotdata = gen_blank_rlp_plot(proc_name=proc_name, proc_id=proc_id, sensor_name=sensor_name,
                                              sensor_id=selected_sensor, group_name=group_name)
                dic_plots[selected_sensor][group_name] = plotdata
                count += 1

            plotdata[RL_DATA].extend(array_y)
            plotdata[RL_GROUPS].extend([time_range] * len(array_y))
            rlpdata = dict(array_x=array_y, cate_name=time_range)
            plotdata[RL_RIDGELINES].append(rlpdata)
            plotdata[END_PROC_ID] = dic_plot[END_PROC_ID]

    for sensor_id, sensor_dat in dic_plots.items():
        for cat_id, plotdat in sensor_dat.items():
            plotdat['ridgelines'] = merge_data_by_direct_terms(plotdat['ridgelines'], terms)

    return dic_plots, is_graph_limited


def merge_dict(dict1, dict2):
    """ Merge dictionaries and keep values of common keys in list"""
    if not dict1:
        dict1 = {}
    if not dict2:
        dict2 = {}

    dict3 = {**dict1, **dict2}
    for key, value in dict3.items():
        if key in dict1 and key in dict2:
            if isinstance(value, str) or isinstance(value, int):
                dict3[key] = value
            elif isinstance(value, list):
                dict3[key] = value + dict1[key]
            else:
                dict3[key] = merge_dict(value, dict1[key])
    return dict3


@log_execution_time()
def get_data(trace, dic_param):
    """get data from database

    Arguments:
        dic_param {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    db_code = trace.proc_yaml.get_db_id(dic_param[COMMON][START_PROC])
    is_efa = trace.db_yaml.get_etl_func(db_code)
    compare_type = dic_param[COMMON][COMPARE_TYPE]

    dic_cate_var = None
    if is_efa:
        # get all checked cols
        dic_non_sensor = get_checked_cols(trace, dic_param)
    else:
        # get serials + date
        dic_non_sensor = get_non_sensor_cols(trace, dic_param)
        # get category var and val

        if compare_type == RL_CATEGORY:
            dic_cate_var = get_cate_var(dic_param)

    # edit dic_param
    edited_dic_param = gen_new_dic_param(dic_param, dic_non_sensor)

    # cate var and val
    if dic_cate_var:
        edited_dic_param = gen_new_dic_param(edited_dic_param, dic_cate_var)

    if compare_type == RL_CATEGORY:
        edited_dic_param = add_cond_to_dic_param(edited_dic_param)

    # get data from database
    dic_data, times, _, _, actual_record_number, is_res_limited = get_data_from_db(trace, edited_dic_param)

    return dic_data, times, actual_record_number, is_res_limited


@log_execution_time()
def customize_dict_param(dic_param):
    """ Combine start_time, end_time, start_date, end_date into one object

    Arguments:
        dic_form {[type]} -- [description]
    """
    # end_proc
    dic_end_procs = customize_dict_param_common(dic_param)
    dic_param[COMMON][END_PROC] = dic_end_procs
    dic_param[COMMON][GET02_VALS_SELECT] = list(dic_end_procs)

    # time
    start_dates = dic_param.get(COMMON).get(START_DATE)
    start_times = dic_param.get(COMMON).get(START_TM)
    end_dates = dic_param.get(COMMON).get(END_DATE)
    end_times = dic_param.get(COMMON).get(END_TM)

    if type(start_dates) is not list and type(start_dates) is not tuple:
        start_dates = [start_dates]
        start_times = [start_times]
        end_dates = [end_dates]
        end_times = [end_times]

    if start_dates and start_times and end_dates and end_times \
            and len(start_dates) == len(start_times) == len(end_dates) == len(end_times):
        names = [START_DATE, START_TM, END_DATE, END_TM]
        lst_datetimes = [dict(zip(names, row)) for row in zip(start_dates, start_times, end_dates, end_times)]
        for idx, time_cond in enumerate(lst_datetimes):
            start_dt = start_of_minute(time_cond.get(START_DATE), time_cond.get(START_TM))
            end_dt = end_of_minute(time_cond.get(END_DATE), time_cond.get(END_TM))
            lst_datetimes[idx][START_DT] = start_dt
            lst_datetimes[idx][END_DT] = end_dt
        dic_param[TIME_CONDS] = lst_datetimes
    else:
        dic_param[TIME_CONDS] = []


def convert_end_cols_to_array(dic_param):
    end_col_alias = dic_param[COMMON][GET02_VALS_SELECT]
    if type(end_col_alias) == str:
        dic_param[COMMON][GET02_VALS_SELECT] = [end_col_alias]

    from_end_col_alias = dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT]
    if type(from_end_col_alias) == str:
        dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT] = [from_end_col_alias]


@log_execution_time()
def split_data_by_cyclic_terms(dic_data, times, dic_param):
    """split data by condition

    Arguments:
        data {[type]} -- [description]

    Returns:
        [type] -- [description]
    """

    proc_id = dic_param.common.start_proc
    cyclic_terms = dic_param.cyclic_terms
    dic_output = {}

    end_col_ids = dic_param.array_formval[0].col_ids
    for end_col in end_col_ids:
        dic_output[end_col] = {term: [] for term in cyclic_terms}

    for idx, t_cycle_time in enumerate(times):
        for end_col in end_col_ids:
            end_col_data = dic_data[proc_id][end_col]
            for cyclic_term in cyclic_terms:
                if cyclic_term[0] <= t_cycle_time <= cyclic_term[1]:
                    dic_output[end_col][cyclic_term].append(end_col_data[idx])

    return dic_output


def get_cate_var(dic_param):
    cate_vars = dic_param[COMMON].get(f'{CATE_VARIABLE}1', [])
    if not isinstance(cate_vars, (list, tuple)):
        cate_vars = [cate_vars]

    return {dic_param[COMMON][START_PROC]: cate_vars}


def add_cond_to_dic_param(dic_param):
    cate_var = dic_param[COMMON].get(f'{CATE_VARIABLE}1')
    cate_vals = dic_param[COMMON].get(f'{CATE_VALUE_MULTI}1', [])
    if not isinstance(cate_vals, (list, tuple)):
        cate_vals = [cate_vals]

    edited_dic_param = deepcopy(dic_param)

    # start proc
    proc_name = dic_param[COMMON][START_PROC]

    cond_proc = None
    for ele in edited_dic_param[COMMON][COND_PROCS]:
        if ele[COND_PROC] == proc_name:
            cond_proc = ele
            break

    if cond_proc:
        cond_proc.update({cate_var: cate_vals})
    else:
        cond_proc = {COND_PROC: proc_name, cate_var: cate_vals}
        edited_dic_param[COMMON][COND_PROCS].append(cond_proc)

    return edited_dic_param


@log_execution_time()
@abort_process_handler()
def cal_emd_data(dic_param):
    array_plotdatas = dic_param.get(ARRAY_PLOTDATA) or {}
    emd_type = dic_param[COMMON][EMD_TYPE] or EMDType.drift.name
    emd_value = EMDType[emd_type].value
    num_bins = 100
    emds = []
    for sensor_dat in array_plotdatas:
        data = sensor_dat[RL_DATA]
        if not len(data):
            continue

        group_ids = sensor_dat[RL_GROUPS]

        # convert to dataframe
        dic_emds = {RL_GROUPS: group_ids, 'data': data}
        df = pd.DataFrame(dic_emds)

        # dropna before calc emd
        df = df.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).dropna()
        group_ids = df[RL_GROUPS]

        # revert original dataframe without groups
        df.drop(RL_GROUPS, inplace=True, axis=1)
        emd_stacked_without_nan = df.to_numpy()
        for diff in emd_value:
            if emd_stacked_without_nan.size:
                emd_array = calc_emd_for_ridgeline(emd_stacked_without_nan, np.array(group_ids), num_bins, diff=diff)
                if len(emd_array) > 0:
                    emds.append(np.stack(emd_array, axis=-1).tolist()[0])
                else:
                    emds.append([])
            else:
                emds.append([])

    dic_param[RL_EMD] = emds
    dic_param[EMD_TYPE] = emd_type


@log_execution_time()
def calc_emd_for_ridgeline(data, group_id, num_bins, signed=True, diff=False):
    """
    Calculate Earth Mover's Distance (EMD) for each sensor data

    Inputs:
        data     [2d numpy array]
        group_id [1d numpy array]
        num_bins [integer]
        signed   [boolean] if True, return EMD without taking np.abs()
        diff     [boolean] if True, calculates EMD based on the diff of 1-step
    Returns:
        emd_mat [2d numpy array] (group_id x num of sensors)
    """

    # in case when data was 1d array (only 1 sensor selected)
    if len(data.shape) == 1:
        data = data.reshape(-1, 1)

    num_groups = len(np.unique(group_id))
    num_sensors = data.shape[1]
    emd_mat = np.zeros((num_groups, num_sensors))

    # calculate emd sequence in each sensor
    for sensor in np.arange(num_sensors):
        dens_mat = np.zeros((num_groups, num_bins))
        x = data[:, sensor]

        # generate bins for histograms
        x_wo_none = x[x != None]
        group_id_wo_none = np.delete(group_id, np.where(x == None))

        x_min = np.nanmin(x_wo_none)
        x_max = np.nanmax(x_wo_none)
        # in case of 0 standard deviation
        if x_min == x_max:
            x_min -= 4
            x_max += 4
        bins = np.linspace(x_min, x_max, num=num_bins + 1)

        # histogram for all group_ids
        for g, grp in enumerate(np.unique(group_id_wo_none)):
            bin_count, _ = np.histogram(x_wo_none[group_id_wo_none == grp], bins=bins)
            dens_mat[g, :] = bin_count / np.sum(bin_count)

        # reference density (first density or previous density)
        if diff:
            ref_density = np.vstack([dens_mat[0, :], dens_mat[:(num_groups - 1), :]])
        else:
            ref_density = np.tile(dens_mat[0, :], (num_groups, 1))

        # calculate emd (matrix multiplication form)
        if signed:
            emd = (dens_mat - ref_density) @ np.arange(1, num_bins + 1).reshape(-1, 1)
        else:
            emd = np.zeros(num_groups)
            for g, _ in enumerate(np.unique(group_id_wo_none)):
                # exact 1D EMD
                # https://en.wikipedia.org/wiki/Earth_mover%27s_distance#Computing_the_EMD
                emd_1d = np.zeros(num_bins + 1)
                for bin_idx in range(1, num_bins + 1):
                    emd_1d[bin_idx] = ref_density[g, bin_idx - 1] - dens_mat[g, bin_idx - 1] + emd_1d[bin_idx - 1]
                emd[g] = np.sum(np.abs(emd_1d))

        # scale emd to have original unit
        emd = emd / (num_bins - 1) * (x_max - x_min)
        emd_mat[:, sensor] = emd.reshape(-1)

    return emd_mat


@log_execution_time()
def gen_term_groups(terms_obj):
    if 'Z' not in terms_obj['start_dt']:
        terms_obj['start_dt'] = terms_obj['start_dt'] + 'Z'
    if 'Z' not in terms_obj['end_dt']:
        terms_obj['end_dt'] = terms_obj['end_dt'] + 'Z'
    return '{} | {}'.format(terms_obj['start_dt'], terms_obj['end_dt'])


@log_execution_time()
def merge_data_by_terms(data_list, terms):
    term_of_data = [dat['cate_name'] for dat in data_list]
    for term in terms:
        term_name = gen_term_groups(term)
        if term_name not in term_of_data:
            # append empty data of ridgeline if there is no data
            data_list.append({
                'array_x': [],
                'cate_name': term_name
            })
    # sort terms in case of cylic terms
    data_list = sorted(data_list, key=lambda x: x['cate_name'])
    return data_list


@log_execution_time()
def merge_data_by_direct_terms(data_list, terms):
    term_of_data = [dat['cate_name'] for dat in data_list]
    terms_name = [gen_term_groups(term) for term in terms]
    ridge_id = 0
    combined_data = []
    for i in range(len(terms_name)):
        if ridge_id < len(term_of_data) and terms_name[i] == term_of_data[ridge_id]:
            combined_data.append(data_list[ridge_id])
            ridge_id += 1
        else:
            combined_data.append({
                'array_x': [],
                'cate_name': terms_name[i]
            })
    return combined_data


@log_execution_time()
@abort_process_handler()
def gen_cyclic_term_plotdata(dic_data, dic_param, max_graph=None):
    is_graph_limited = False
    plotdatas = []
    sensors = dic_param[COMMON][GET02_VALS_SELECT]

    for k, sensor in enumerate(sensors):
        if max_graph and len(plotdatas) >= max_graph:
            plotdatas = plotdatas[:max_graph]
            is_graph_limited = True
            break

        dic_group_by_cat = {}
        for dic_plot in dic_data[int(sensor)]:
            array_y = dic_plot[ARRAY_Y]
            if array_y:
                term_obj = dic_param[TIME_CONDS][dic_plot['term_id']]
                cate_name_str = f'{term_obj[START_DT]} | {term_obj[END_DT]}'
                group_name = dic_plot.get(CAT_EXP_BOX) or ''

                if group_name in dic_group_by_cat:
                    plotdata = dic_group_by_cat[group_name]
                else:
                    plotdata = gen_blank_rlp_plot(proc_name=dic_plot[END_PROC_NAME], proc_id=dic_plot[END_PROC_ID],
                                                  sensor_id=sensor, sensor_name=dic_plot[END_COL_NAME],
                                                  group_name=group_name)
                    dic_group_by_cat[group_name] = plotdata

                plotdata[RL_DATA].extend(array_y)
                plotdata[RL_GROUPS].extend([cate_name_str] * len(array_y))
                rlpdata = dict(array_x=array_y, cate_name=cate_name_str)
                plotdata[RL_RIDGELINES].append(rlpdata)
                plotdata[END_PROC_ID] = dic_plot[END_PROC_ID]

        if dic_group_by_cat:
            plotdatas += list(dic_group_by_cat.values())

    for plotdat in plotdatas:
        plotdat['ridgelines'] = merge_data_by_terms(plotdat['ridgelines'], dic_param['time_conds'])

    return plotdatas, is_graph_limited


@log_execution_time()
def gen_custom_plotdata(dic_data, sensors, cat_div_id, max_graph):
    is_graph_limited = False
    plotdatas = []
    if not dic_data:
        return plotdatas, is_graph_limited
    dic_procs, dic_cols = get_cfg_proc_col_info(sensors)
    for sensor_id in sensors:
        if max_graph and len(plotdatas) >= max_graph:
            is_graph_limited = True
            break
        cfg_col: CfgProcessColumn = dic_cols[sensor_id]
        cfg_proc: CfgProcess = dic_procs[cfg_col.process_id]

        plotdata = gen_blank_rlp_plot(proc_name=cfg_proc.name, proc_id=cfg_proc.id, sensor_id=sensor_id,
                                      sensor_name=cfg_col.name)

        if not cat_div_id:
            for cate_name, dic_plot in dic_data[sensor_id].items():
                array_y = dic_plot[ARRAY_Y]
                plotdata[RL_DATA].extend(array_y)
                plotdata[RL_GROUPS].extend([cate_name] * len(array_y))
                rlpdata = dict(array_x=array_y, cate_name=cate_name)
                plotdata[RL_RIDGELINES].append(rlpdata)
            plotdatas.append(plotdata)
        else:
            for cate_name, dic_plot in dic_data[sensor_id].items():
                if max_graph and len(plotdatas) >= max_graph:
                    is_graph_limited = True
                    break
                plotdata = gen_blank_rlp_plot(proc_name=cfg_proc.name, proc_id=cfg_proc.id, sensor_id=sensor_id,
                                              sensor_name=cfg_col.name, group_name=cate_name)
                plotdata['facet_groups'] = cate_name
                for div_name, div_data in dic_plot.items():
                    array_y = div_data[ARRAY_Y]
                    plotdata[RL_DATA].extend(array_y)
                    plotdata[RL_GROUPS].extend([div_name] * len(array_y))
                    rlpdata = dict(array_x=array_y, cate_name=div_name, div_name=div_name)
                    plotdata[RL_RIDGELINES].append(rlpdata)

                plotdatas.append(plotdata)
    return plotdatas, is_graph_limited


def get_checked_cols(trace, dic_param):
    dic_header = {}
    for proc in dic_param[ARRAY_FORMVAL]:
        proc_name = proc[END_PROC]
        end_cols = proc[GET02_VALS_SELECT]
        if isinstance(end_cols, str):
            end_cols = [end_cols]

        checked_cols = trace.proc_yaml.get_checked_columns(proc_name)
        cols = []
        for col, col_detail in checked_cols.items():
            data_type = col_detail[YAML_DATA_TYPES]
            # alias_name = col_detail[YAML_ALIASES]
            if data_type == DataType.REAL.name or col in end_cols:
                continue

            cols.append(col)

        dic_header[proc_name] = cols
        return dic_header


@log_execution_time()
@notify_progress(75)
def csv_export_dispatch(dic_param):
    proc_name = list(set(dic_param.get(COMMON).get(END_PROC).values()))
    time_conds = dic_param.get(TIME_CONDS)
    compare_type = dic_param.get(COMMON).get(COMPARE_TYPE)
    emd_type = dic_param[COMMON][EMD_TYPE] or EMDType.drift.name

    if not proc_name or not time_conds:
        return False, None

    # convert to array to query data for many sensors
    convert_end_cols_to_array(dic_param)
    cate_var = None
    if compare_type == RL_CATEGORY:
        cate_var = dic_param[COMMON].get(DIV_BY_CAT)
        if not cate_var:
            return False, None

        if isinstance(cate_var, (list, tuple)):
            cate_var = cate_var[0]

        dic_param, export_df = gen_trace_data_by_categorical_var(dic_param)
    if compare_type == RL_CYCLIC_TERM:
        cate_var = RL_PERIOD
        dic_param, export_df = gen_trace_data_by_cyclic(dic_param)
    elif compare_type == RL_DIRECT_TERM:
        cate_var = RL_PERIOD
        dic_param, export_df = gen_rlp_data_by_term(dic_param)

    # cate name for emd
    cate_vals = [dic_ridge[RL_CATE_NAME] for dic_ridge in dic_param[ARRAY_PLOTDATA][0][RL_RIDGELINES]]
    sensors = dic_param[COMMON][GET02_VALS_SELECT]
    emds = dic_param[RL_EMD]
    if emd_type == EMDType.both.name:
        emds = np.array_split(emds, len(emds) / 2)
    dic_data = {proc_name[0]: {cate_var: cate_vals, **dict(zip(sensors, emds))}}

    return dic_data, export_df


@log_execution_time()
def gen_csv_data(dic_param, dic_data, sensors, client_tz, delimiter=None):  # get the most cover flows
    """tracing data to show csv
        1 start point x n end point
        filter by condition points that between start point and end_point
    """

    if delimiter:
        csv_data = to_csv(dic_param, dic_data, sensors, client_tz, delimiter=delimiter)
    else:
        csv_data = to_csv(dic_param, dic_data, sensors, client_tz)

    return csv_data


@log_execution_time()
def to_csv(dic_param, dic_data, sensors, client_tz=None, newline='\n', delimiter=','):
    """generate csv export string

    Arguments:
        trace {[Trace]} -- [tracing information]
        dic_data {[dictionary]} -- [export data]

    Keyword Arguments:
        newline {str} -- [description] (default: {'\n'})
        delimiter {str} -- [description] (default: {','})

    Returns:
        [type] -- [description]
    """
    out_str = ''

    graph_param = category_bind_dic_param_to_class(dic_param)
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)
    emd_type = dic_param[COMMON][EMD_TYPE] or EMDType.drift.name
    emd_value = ['|diff' if diff is True else '|drift' for diff in EMDType[emd_type].value]

    # get columns
    cols = []
    for proc_id, data in dic_data.items():
        # get master name of proc
        proc_cfg: CfgProcess = dic_proc_cfgs[int(proc_id)]

        for col in data:
            if col == RL_PERIOD:
                dt_frm, dt_to = col.split('|')
                cols.append(f'{proc_cfg.name}|{dt_frm}')
                cols.append(f'{proc_cfg.name}|{dt_to}')
            else:
                column = CfgProcessColumn.query.get(int(col))

                for diff in emd_value:
                    show_col = column.name
                    show_col += '|emd'
                    if col in sensors:
                        show_col += diff

                    # col_name = CfgProcessColumn.get_by_col_name(proc_id,col)
                    cols.append(f'{proc_cfg.name}|{show_col}')

    out_str += delimiter.join(cols)
    out_str += newline

    # get rows
    merged_rows = []
    for proc_id, proc_values in dic_data.items():
        for col_name, col_values in proc_values.items():
            if col_name == RL_PERIOD:
                # get client timezone
                client_timezone = pytz.timezone(client_tz) if client_tz else tz.tzlocal()
                # client_timezone = tz.gettz(client_tz or None) or tz.tzlocal()

                arr_from = []
                arr_to = []
                for val in col_values:
                    dt_frm, dt_to = val.split('|')
                    arr_from.append(convert_dt_str_to_timezone(client_timezone, dt_frm))
                    arr_to.append(convert_dt_str_to_timezone(client_timezone, dt_to))

                merged_rows.append(arr_from)
                merged_rows.append(arr_to)
            else:
                if emd_type == EMDType.both.name:
                    if type(col_values) == list:
                        merged_rows.append(col_values)
                    else:
                        for val in col_values:
                            merged_rows.append(val)
                else:
                    merged_rows.append(col_values)

    for row in zip(*merged_rows):
        if row[0] == '':
            continue
        out_str += delimiter.join([str(i) for i in row])
        out_str += newline

    return out_str


@log_execution_time()
@abort_process_handler()
def gen_rlp_kde(dic_param, div_names=[]):
    # retrieve the ridge-lines from array_plotdata
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    fmt = {}
    for _, plotdata in enumerate(array_plotdata):
        # plotdata[RL_KDE] = {}
        plotdata_rlp = plotdata.get(RL_RIDGELINES)
        sensor_id = plotdata.get(SENSOR_ID)
        if sensor_id not in fmt:
            fmt[sensor_id] = []

        # default_scale_ymin, default_scale_ymax = plotdata[SCALE_SETTING]['y-min'], plotdata[SCALE_SETTING]['y-max']
        default_scale_ymin = plotdata[SCALE_SETTING]['y-min']
        default_scale_ymax = plotdata[SCALE_SETTING]['y-max']
        if default_scale_ymin != None and default_scale_ymax != None:
            # tailed = (default_scale_ymax - default_scale_ymin) * 0.25
            # use tail range for ridgeline to show smoothly RLP line
            tailed = 0
            bounds = [default_scale_ymin - tailed, default_scale_ymax + tailed]
        else:
            bounds = get_bound(plotdata_rlp)
        grid_points = get_grid_points(plotdata_rlp, bounds=bounds)
        for num, ridgeline in enumerate(plotdata_rlp):
            array_x = ridgeline.get(ARRAY_X)
            fmt[sensor_id] += array_x
            ridgeline[RL_KDE] = calculate_kde_for_ridgeline(array_x, grid_points, height=3, use_hist_counts=True)

    for idx in fmt.keys():
        fmt[idx] = get_fmt_from_array(fmt[idx])
    dic_param[FMT] = fmt
    res = transform_rlp_kde(dic_param, div_names)
    return res


@log_execution_time()
def transform_rlp_kde(dic_param, div_names):
    default_hist_bins = 128
    # retrieve the ridge-lines from array_plotdata
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)

    # scale ratio from the maximum value of RLP chart's x-axis,
    # RLP line height, default is 2% chart
    scale_ratio = 0.02

    for _, plotdata in enumerate(array_plotdata):
        plotdata_rlp = plotdata.get(RL_RIDGELINES)

        start_value = 0.1
        # calculate the step value between 2 line
        total_lines = len(plotdata_rlp)

        if total_lines > 1:
            line_steps = 1 / (total_lines - 1)
        else:
            # if data have one ridge line only, the first line will be draw from x=0.1 in xaxis
            line_steps = 0.1

        plotdata[RL_XAXIS] = []
        # distinct groups
        plotdata[RL_CATES] = div_names if len(div_names) else list(dict.fromkeys(plotdata[RL_GROUPS]))
        # plotdata['categories'] = distinct_rlp_groups(plotdata['groups'])
        rlp_range_min = []
        rlp_range_max = []

        # get max value from kde, use to make new xaxis range
        max_kde_list = []
        tmp_histlabel = []
        for num, ridgeline in enumerate(plotdata_rlp):
            # calculate trans value from start_value and line_steps
            trans_val = start_value + (num * line_steps)
            kde_data = ridgeline.get(RL_KDE)

            if kde_data[RL_DEN_VAL]:
                max_value = max(kde_data[RL_DEN_VAL]) + trans_val
                max_kde_list.append(max_value)

            if len(kde_data[RL_HIST_LABELS]) > 1:
                tmp_histlabel = kde_data[RL_HIST_LABELS]

        for num, ridgeline in enumerate(plotdata_rlp):
            kde_data = ridgeline.get(RL_KDE)

            # calculate trans value from start_value and line_steps
            trans_val = start_value + (num * line_steps)
            trans_val_list = [trans_val] * len(kde_data[RL_DEN_VAL])
            trans_obj = {RL_ORG_DEN: kde_data[RL_DEN_VAL], RL_TRANS_VAL: trans_val_list}
            trans_val_df = pd.DataFrame(trans_obj)

            # devide by maximum value of density, except max = 0
            max_den_val = trans_val_df[RL_ORG_DEN].max()
            if max_den_val:
                trans_kde_val = trans_val_df[RL_ORG_DEN] / max_den_val
            else:
                trans_kde_val = trans_val_df[RL_ORG_DEN]

            # convert to new value with line by steps and scale ratio
            new_kde_df = (trans_kde_val * scale_ratio) + trans_val_df[RL_TRANS_VAL]
            new_kde_val = new_kde_df.to_list()

            ridgeline[RL_TRANS_DEN] = new_kde_val
            if (len(new_kde_val) == 1):
                ridgeline[RL_TRANS_DEN] = trans_val_list * default_hist_bins
                ridgeline[RL_KDE][RL_HIST_LABELS] = tmp_histlabel * default_hist_bins

            plotdata[RL_XAXIS].append(trans_val)

            # get min/max range from numpy array kde_data
            if kde_data[RL_DEN_VAL]:
                if kde_data[RL_HIST_LABELS]:
                    rlp_range_min.append(min(kde_data[RL_HIST_LABELS]))
                    rlp_range_max.append(max(kde_data[RL_HIST_LABELS]))

            # delete un-use params in rigdeline node
            ridgeline[RL_DATA_COUNTS] = len(ridgeline[ARRAY_X])
            del ridgeline[ARRAY_X]
            # del ridgeline[RL_KDE][RL_HIST_COUNTS]
            del ridgeline[RL_KDE][RL_DEN_VAL]
        if rlp_range_min:
            rlp_yaxis_min = round(min(rlp_range_min)) if len(rlp_range_min) > 1 else round(rlp_range_min[0])
        else:
            rlp_yaxis_min = 0

        if rlp_range_max:
            rlp_yaxis_max = round(min(rlp_range_max)) if len(rlp_range_max) > 1 else round(rlp_range_max[0])
        else:
            rlp_yaxis_max = 0
        # use tail range for ridgeline to show smoothly RLP line
        # tailed = (plotdata[SCALE_SETTING]['y-max'] - plotdata[SCALE_SETTING]['y-min']) * 0.25
        tailed = 0
        scale_range = [plotdata[SCALE_SETTING]['y-min'] - tailed, plotdata[SCALE_SETTING]['y-max'] + tailed]
        plotdata[RL_YAXIS] = scale_range

        # delete groups
        del plotdata[RL_GROUPS]

    return dic_param


def distinct_rlp_groups(groups):
    unique_groups = []
    for group_name in groups:
        if group_name not in unique_groups:
            unique_groups.append(group_name)
    return unique_groups


def merge_multiple_dic_params(dic_params):
    if len(dic_params) > 1:
        merged_dic_params = merge_dict(*dic_params)
        return merged_dic_params
    return dic_params[0]


def gen_blank_rlp_plot(proc_name='', proc_id='', sensor_name='', sensor_id='', group_name=''):
    return {RL_DATA: [], RL_GROUPS: [], RL_RIDGELINES: [], RL_SENSOR_NAME: sensor_name, SENSOR_ID: sensor_id,
            PROC_NAME: proc_name, CAT_EXP_BOX: group_name, END_PROC_ID: proc_id}


def convert_list_to_dict_multiple_data_proc(datas):
    dict_data = {}
    for data in datas:
        dict_data = {**dict_data, **data}

    return dict_data


@log_execution_time()
def add_threshold_configs(dic_param, orig_graph_param):
    try:
        chart_infos_by_cond_procs, chart_infos_org = get_chart_infos(orig_graph_param, no_convert=True)
        if chart_infos_by_cond_procs:
            for plotdata in dic_param[ARRAY_PLOTDATA]:
                end_col = plotdata['sensor_id']
                # TODO proc_id, col_id are str vs int
                chart_info_cond_proc \
                    = chart_infos_by_cond_procs[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                chart_info_cond_proc_org \
                    = chart_infos_org[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                y_min, y_max = get_min_max_of_all_chart_infos(chart_info_cond_proc)
                plotdata[CHART_INFOS] = chart_info_cond_proc
                plotdata[CHART_INFOS_ORG] = chart_info_cond_proc_org
                plotdata[Y_MIN] = y_min
                plotdata[Y_MAX] = y_max
    except Exception:
        traceback.print_exc()


@log_execution_time()
def calc_rlp_scale_info(array_plotdata, min_max_list, all_graph_min,
                        all_graph_max, string_col_ids=None,
                        has_val_idxs=None, end_col_id='sensor_id', y_col='data'):
    dic_datetime_cols = {}
    for idx, plotdata in enumerate(array_plotdata):
        # datetime column
        proc_id = plotdata.get(END_PROC_ID)
        col_id = plotdata.get(end_col_id)
        if proc_id and proc_id not in dic_datetime_cols:
            dic_datetime_cols[proc_id] = {cfg_col.id: cfg_col for cfg_col in
                                          CfgProcessColumn.get_by_data_type(proc_id, DataType.DATETIME)}

        is_datetime_col = True if col_id in dic_datetime_cols.get(proc_id, {}) else False

        y_min = min_max_list[idx][0] if min_max_list else None
        y_min = all_graph_min if y_min is None else y_min
        y_max = min_max_list[idx][1] if min_max_list else None
        y_max = all_graph_max if y_max is None else y_max

        y_min, y_max = extend_min_max(y_min, y_max)
        all_graph_min, all_graph_max = extend_min_max(all_graph_min, all_graph_max)

        array_y = plotdata.get(y_col)
        if (not len(array_y)) or (string_col_ids and plotdata[END_COL_ID] in string_col_ids):
            dic_base_scale = {Y_MIN: y_min, Y_MAX: y_max, LOWER_OUTLIER_IDXS: [], UPPER_OUTLIER_IDXS: []}
            plotdata[SCALE_AUTO] = dic_base_scale
            plotdata[SCALE_SETTING] = dic_base_scale
            plotdata[SCALE_THRESHOLD] = dic_base_scale
            plotdata[SCALE_COMMON] = dic_base_scale
            plotdata[SCALE_FULL] = dic_base_scale
            continue

        series_x = pd.Series([])
        series_y = pd.Series(array_y)

        # don't do with all blank idxs
        if has_val_idxs is not None:
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


def gen_emd_df(rlp_data, div_name, term_sep, client_tz='Asia/Tokyo', has_facet=False, file_extension='csv'):
    csv_data = []
    csv_name = []
    rlp_emd = {}
    if has_facet:
        for rlp in rlp_data[ARRAY_PLOTDATA]:
            file_name = '{}_{}_{}.{}'.format(rlp[PROC_NAME], rlp[RL_SENSOR_NAME], rlp[CAT_EXP_BOX], file_extension)
            csv_name.append(file_name)
    for i, rlp in enumerate(rlp_data[ARRAY_PLOTDATA]):
        if has_facet:
            rlp_emd = {}
        repaired_emd = []
        index = 0
        for rl in rlp[RL_RIDGELINES]:
            if rl[RL_DATA_COUNTS] < 8 or len(rl[RL_KDE][RL_HIST_LABELS]) == 0:
                repaired_emd.append(None)
            else:
                repaired_emd.append(rlp_data[RL_EMD][i][index])
                index += 1

        if div_name:
            rlp_emd[div_name] = [ridge[RL_CATE_NAME] for ridge in rlp[RL_RIDGELINES]]
        elif term_sep:
            rlp_emd['From'] = [from_utc_to_localtime(ridge[RL_CATE_NAME].split(' | ')[0], client_tz, False) for ridge
                               in rlp[RL_RIDGELINES] if ridge[RL_CATE_NAME]]
            rlp_emd['To'] = [from_utc_to_localtime(ridge[RL_CATE_NAME].split(' | ')[1], client_tz, False) for ridge
                             in rlp[RL_RIDGELINES] if ridge[RL_CATE_NAME]]

        col = CfgProcessColumn.get_by_ids([rlp[SENSOR_ID]])[0]
        col_name = gen_sql_label(col.id, col.column_name)
        rlp_emd[col_name] = repaired_emd
        if has_facet:
            csv_data.append(pandas.DataFrame(rlp_emd))

    if not has_facet:
        csv_data.append(pandas.DataFrame(rlp_emd))
    return csv_data, csv_name