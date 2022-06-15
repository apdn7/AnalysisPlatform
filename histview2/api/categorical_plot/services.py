import traceback
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta

import pandas as pd
from dateutil import tz
from pandas import DataFrame

from histview2.api.efa.services.etl import FILE as FILE_ETL_SPRAY_SHAPE
from histview2.api.efa.services.etl import call_com_view
from histview2.api.trace_data.services.time_series_chart import (get_data_from_db, get_chart_infos,
                                                                 get_procs_in_dic_param,
                                                                 gen_dic_data_from_df, get_min_max_of_all_chart_infos,
                                                                 get_chart_infos_by_stp_var,
                                                                 get_chart_infos_by_stp_value, build_regex_index,
                                                                 apply_coef_text,
                                                                 main_check_filter_detail_match_graph_data,
                                                                 set_chart_infos_to_plotdata, calc_raw_common_scale_y,
                                                                 calc_scale_info, get_cfg_proc_col_info)
from histview2.common.common_utils import (start_of_minute, end_of_minute, create_file_path,
                                           get_view_path, get_basename, gen_sql_label,
                                           make_dir_from_file_path,
                                           any_not_none_in_dict, DATE_FORMAT_STR, TIME_FORMAT, DATE_FORMAT,
                                           RL_DATETIME_FORMAT, convert_time)
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.services.ana_inf_data import calculate_kde_trace_data
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.common.services.sse import notify_progress
from histview2.common.services.statistics import calc_summaries_cate_var, calc_summaries
from histview2.common.trace_data_log import EventType, trace_log, TraceErrKey, EventAction, Target
from histview2.setting_module.models import CfgProcess, CfgDataSource, CfgProcessColumn
from histview2.trace_data.models import Cycle


@log_execution_time()
def gen_graph_param(dic_param):
    # bind dic_param
    graph_param = category_bind_dic_param_to_class(dic_param)

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # TODO: check start proc cols( difference to time series)
    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add cat exp
    graph_param.add_cat_exp_to_array_formval()

    proc_cfg = dic_proc_cfgs[graph_param.common.start_proc]

    non_sensor_cols = []
    if use_etl_spray_shape(proc_cfg):
        # get all checked cols
        non_sensor_cols = [column.id for column in proc_cfg.columns if not column.data_type == DataType.REAL.name]

    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        proc_sensor_ids = proc.col_sensor_only_ids
        proc_col_ids = proc.col_ids.copy()
        serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        proc.add_cols(serial_ids + non_sensor_cols)
        if len(proc_sensor_ids) != len(proc_col_ids):
            proc.add_sensor_col_ids(proc_col_ids)

    return graph_param, dic_proc_cfgs


@log_execution_time()
@notify_progress(50)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.STP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_trace_data_by_categorical_var(dic_param, max_graph=None):
    """tracing data to show graph
        1 start point x n end point
        filter by condition points that between start point and end_point
    """

    # gen graph_param
    graph_param, dic_proc_cfgs = gen_graph_param(dic_param)

    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(graph_param)

    # check filter match or not ( for GUI show )
    matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = main_check_filter_detail_match_graph_data(
        graph_param, df)

    # apply coef for text
    df = apply_coef_text(df, graph_param, dic_proc_cfgs)

    # convert proc to cols dic
    # transform raw data to graph data
    # create output data
    graph_param_with_cate = category_bind_dic_param_to_class(dic_param)
    graph_param_with_cate.add_cate_procs_to_array_formval()
    graph_param_with_cate.add_cat_exp_to_array_formval()
    dic_data = gen_dic_data_from_df(df, graph_param_with_cate)
    orig_graph_param = category_bind_dic_param_to_class(dic_param)
    dic_data, is_graph_limited = split_data_by_condition(dic_data, orig_graph_param, max_graph)
    dic_plots = gen_plotdata_for_var(dic_data)
    for col_id, plots in dic_plots.items():
        if max_graph and max_graph < len(plots):
            is_graph_limited = True
            dic_plots[col_id] = plots[:max_graph]

    dic_param[ARRAY_PLOTDATA] = dic_plots
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    # flag to show that trace result was limited
    dic_param[IS_RES_LIMITED] = is_res_limited

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # get visualization setting
    add_threshold_configs(dic_param, orig_graph_param)

    # calculating the summaries information
    calc_summaries_cate_var(dic_param)

    # calc common scale y min max
    for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
        min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(plotdatas)
        calc_scale_info(plotdatas, min_max_list, all_graph_min, all_graph_max)

    # generate kde for each trace output array
    dic_param = gen_kde_data_cate_var(dic_param)

    remove_array_x_y_cyclic(dic_param)

    # images
    img_files = dump_img_files(df, graph_param, dic_proc_cfgs)
    dic_param['images'] = img_files

    return dic_param


@log_execution_time()
def add_threshold_configs(dic_param, orig_graph_param):
    try:
        chart_infos_by_cond_procs, chart_infos_org = get_chart_infos(orig_graph_param, no_convert=True)
        chart_infos_by_stp_var = get_chart_infos_by_stp_var(orig_graph_param)
        var_col_id = orig_graph_param.get_cate_var_col_id()
        dic_filter_detail_2_regex = build_regex_index(var_col_id)
        if chart_infos_by_cond_procs:
            for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
                # TODO proc_id, col_id are str vs int
                chart_info_cond_proc \
                    = chart_infos_by_cond_procs[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                chart_info_cond_proc_org \
                    = chart_infos_org[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                for plotdata in plotdatas:
                    stp_value = plotdata[RL_CATE_NAME]
                    chart_info_stp_value = get_chart_infos_by_stp_value(
                        stp_value,
                        end_col,
                        dic_filter_detail_2_regex,
                        chart_infos_by_stp_var,
                    )
                    # selected_chart_infos = chart_info_stp_value or chart_info_cond_proc  # OR for now, may union
                    if any_not_none_in_dict(chart_info_stp_value):
                        selected_chart_infos = chart_info_stp_value
                        chart_info_cond_proc_org = chart_info_stp_value
                    else:
                        selected_chart_infos = chart_info_cond_proc

                    y_min, y_max = get_min_max_of_all_chart_infos(selected_chart_infos)
                    plotdata[CHART_INFOS] = selected_chart_infos
                    plotdata[CHART_INFOS_ORG] = chart_info_cond_proc_org
                    plotdata[Y_MIN] = y_min
                    plotdata[Y_MAX] = y_max
    except Exception:
        traceback.print_exc()


@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.STP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_trace_data_by_cyclic(dic_param, max_graph=None):
    dic_param = gen_trace_data_by_cyclic_common(dic_param, max_graph)

    dic_plotdata = defaultdict(list)
    for plotdata in dic_param[ARRAY_PLOTDATA]:
        dic_plotdata[plotdata['end_col']].append(plotdata)

    dic_param[ARRAY_PLOTDATA] = dic_plotdata

    # calculating the summaries information
    calc_summaries_cate_var(dic_param)

    # calc common scale y min max
    for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
        min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(plotdatas)
        calc_scale_info(plotdatas, min_max_list, all_graph_min, all_graph_max)

    # generate kde for each trace output array
    dic_param = gen_kde_data_cate_var(dic_param)

    # kde
    remove_array_x_y_cyclic(dic_param)

    return dic_param


@log_execution_time()
@notify_progress(75)
def gen_trace_data_by_cyclic_common(dic_param, max_graph=None):
    """tracing data to show graph
        filter by condition points that between start point and end_point
    """

    produce_cyclic_terms(dic_param)
    terms = gen_dic_param_terms(dic_param)

    dic_param = gen_graph_cyclic(dic_param, terms, max_graph)
    dic_param[TIME_CONDS] = terms
    return dic_param


def gen_dic_param_terms(dic_param):
    terms = dic_param[COMMON].get(CYCLIC_TERMS) or []
    terms = [{START_DATE: convert_time(start_dt, DATE_FORMAT),
              START_TM: convert_time(start_dt, TIME_FORMAT),
              START_DT: start_dt,
              END_DATE: convert_time(end_dt, DATE_FORMAT),
              END_TM: convert_time(end_dt, TIME_FORMAT),
              END_DT: end_dt} for start_dt, end_dt in terms]
    return terms


@log_execution_time()
@notify_progress(75)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.STP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_trace_data_by_term(dic_param, max_graph=None):
    """tracing data to show graph
        filter by condition points that between start point and end_point
    """
    is_graph_limited = False
    terms = dic_param.get(TIME_CONDS) or []
    dic_param[ARRAY_PLOTDATA] = []
    dic_param[MATCHED_FILTER_IDS] = []
    dic_param[UNMATCHED_FILTER_IDS] = []
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = []
    dic_param[ACTUAL_RECORD_NUMBER] = 0

    if max_graph and len(terms) > max_graph:
        terms = terms[:max_graph]
        is_graph_limited = True

    for term_id, term in enumerate(terms):
        # create dic_param for each term from original dic_param
        term_dic_param = deepcopy(dic_param)
        term_dic_param[TIME_CONDS] = [term]
        term_dic_param[COMMON][START_DATE] = term[START_DATE]
        term_dic_param[COMMON][START_TM] = term[START_TM]
        term_dic_param[COMMON][END_DATE] = term[END_DATE]
        term_dic_param[COMMON][END_TM] = term[END_TM]
        term_dic_param['term_id'] = term_id

        # get data from database + visual setting from yaml
        term_result = gen_graph_term(term_dic_param, max_graph)
        if term_result.get(IS_GRAPH_LIMITED):
            is_graph_limited = True

        # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
        dic_param[MATCHED_FILTER_IDS] += term_result.get(MATCHED_FILTER_IDS, [])
        dic_param[UNMATCHED_FILTER_IDS] += term_result.get(UNMATCHED_FILTER_IDS, [])
        dic_param[NOT_EXACT_MATCH_FILTER_IDS] += term_result.get(NOT_EXACT_MATCH_FILTER_IDS, [])
        dic_param[ACTUAL_RECORD_NUMBER] += term_result.get(ACTUAL_RECORD_NUMBER, 0)

        # update term data to original dic_param
        dic_param[ARRAY_PLOTDATA].extend(term_result.get(ARRAY_PLOTDATA))

    dic_param[ARRAY_PLOTDATA], is_graph_limited_second = limit_graph_per_tab(dic_param[ARRAY_PLOTDATA], max_graph)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited or is_graph_limited_second

    # calculating the summaries information
    calc_summaries(dic_param)

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA])
    calc_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max)

    # generate kde for each trace output array
    dic_param = gen_kde_data(dic_param)

    remove_array_x_y(dic_param)

    return dic_param


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
    dic_param[TIME_CONDS] = gen_time_conditions(dic_param)


def gen_time_conditions(dic_param):
    start_dates = dic_param.get(COMMON).get(START_DATE)
    start_times = dic_param.get(COMMON).get(START_TM)
    end_dates = dic_param.get(COMMON).get(END_DATE)
    end_times = dic_param.get(COMMON).get(END_TM)
    # if type(start_dates) is not list and type(start_dates) is not tuple:
    if not isinstance(start_dates, (list, tuple)):
        start_dates = [start_dates]
        start_times = [start_times]
        end_dates = [end_dates]
        end_times = [end_times]

    lst_datetimes = []
    if start_dates and start_times and end_dates and end_times and len(start_dates) == len(start_times) == len(
            end_dates) == len(end_times):
        names = [START_DATE, START_TM, END_DATE, END_TM]
        lst_datetimes = [dict(zip(names, row)) for row in zip(start_dates, start_times, end_dates, end_times)]
        for idx, time_cond in enumerate(lst_datetimes):
            start_dt = start_of_minute(time_cond.get(START_DATE), time_cond.get(START_TM))
            end_dt = end_of_minute(time_cond.get(END_DATE), time_cond.get(END_TM))
            lst_datetimes[idx][START_DT] = start_dt
            lst_datetimes[idx][END_DT] = end_dt

    return lst_datetimes


@log_execution_time()
def convert_end_cols_to_array(dic_param):
    end_col_alias = dic_param[COMMON][GET02_VALS_SELECT]
    if type(end_col_alias) == str:
        dic_param[COMMON][GET02_VALS_SELECT] = [end_col_alias]

    from_end_col_alias = dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT]
    if type(from_end_col_alias) == str:
        dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT] = [from_end_col_alias]


@log_execution_time()
def gen_kde_data(dic_param, dic_array_full=None):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        full_array_y = dic_array_full[num] if dic_array_full else None
        kde_list = calculate_kde_trace_data(plotdata, full_array_y=full_array_y)
        plotdata[SCALE_SETTING][KDE_DATA], plotdata[SCALE_COMMON][KDE_DATA], plotdata[SCALE_THRESHOLD][KDE_DATA], \
        plotdata[SCALE_AUTO][KDE_DATA], plotdata[SCALE_FULL][KDE_DATA] = kde_list

    return dic_param


@log_execution_time()
def gen_kde_data_cate_var(dic_param, dic_array_full=None):
    array_plotdatas = dic_param.get(ARRAY_PLOTDATA)
    for end_col, array_plotdata in array_plotdatas.items():
        for num, plotdata in enumerate(array_plotdata):
            full_array_y = dic_array_full[num] if dic_array_full else None
            kde_list = calculate_kde_trace_data(plotdata, full_array_y=full_array_y)
            plotdata[SCALE_SETTING][KDE_DATA], plotdata[SCALE_COMMON][KDE_DATA], plotdata[SCALE_THRESHOLD][KDE_DATA], \
            plotdata[SCALE_AUTO][KDE_DATA], plotdata[SCALE_FULL][KDE_DATA] = kde_list

    return dic_param


@log_execution_time()
def split_data_by_condition(dic_data, graph_param, max_graph=None):
    """split data by condition

    Arguments:
        data {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    is_graph_limited = False
    dic_output = {}
    for proc in graph_param.array_formval:
        proc_id = proc.proc_id
        cat_exp_cols = graph_param.common.cat_exp

        end_cols = proc.col_ids
        dic_data_for_df = {Cycle.time.key: dic_data[proc_id][Cycle.time.key],
                           **{end_col: dic_data[proc_id][end_col] for end_col in end_cols}
                           }
        group_by_cols = []
        for cat_exp_col in cat_exp_cols or []:
            group_by_cols.append(cat_exp_col)
            if cat_exp_col not in dic_data_for_df:
                for dic_col in dic_data.values():
                    vals = dic_col.get(cat_exp_col)
                    if vals:
                        dic_data_for_df[cat_exp_col] = vals
                        break

        df = pd.DataFrame(dic_data_for_df)
        if not len(df):
            continue

        df = df.convert_dtypes()

        if group_by_cols:
            dic_col, is_graph_limited = gen_plotdata_with_group_by(df, end_cols, group_by_cols, max_graph)
        else:
            dic_col = gen_plotdata_without_group_by(df, end_cols)

        dic_output.update(dic_col)

    return dic_output, is_graph_limited


def gen_plotdata_without_group_by(df, end_cols):
    dic_output = {}
    array_x = df[Cycle.time.key].to_list()
    for end_col in end_cols:
        dic_cate = defaultdict(dict)
        dic_output[end_col] = dic_cate
        dic_cate[None] = {ARRAY_X: array_x, ARRAY_Y: df[end_col].to_list()}

    return dic_output


def gen_plotdata_with_group_by(df, end_cols, group_by_cols, max_graph=None):
    is_graph_limit = False
    dic_output = {}
    df_group = df.groupby(group_by_cols)
    limit_cols = end_cols
    if max_graph and max_graph < len(end_cols):
        is_graph_limit = True
        limit_cols = end_cols[:max_graph]

    for end_col in limit_cols:
        dic_cate = defaultdict(dict)
        dic_output[end_col] = dic_cate
        for group_name, idxs in df_group.groups.items():
            if isinstance(group_name, (list, tuple)):
                group_name = ' | '.join([str(NA_STR if pd.isna(val) else val) for val in group_name])

            rows = df.loc[idxs, end_col]
            if len(rows.dropna()) == 0:
                continue

            dic_cate[group_name] = {ARRAY_X: df.loc[idxs, Cycle.time.key].to_list(), ARRAY_Y: rows.to_list()}

    return dic_output, is_graph_limit


def gen_plotdata_for_var(dic_data):
    plotdatas = {}
    col_ids = list(dic_data.keys())
    dic_procs, dic_cols = get_cfg_proc_col_info(col_ids)
    for end_col, cat_exp_data in dic_data.items():
        plotdatas[end_col] = []
        cfg_col: CfgProcessColumn = dic_cols[end_col]
        cfg_proc: CfgProcess = dic_procs[cfg_col.process_id]
        for cat_exp_name, data in cat_exp_data.items():
            if not data:
                continue

            plotdata = {ARRAY_Y: data[ARRAY_Y], ARRAY_X: data[ARRAY_X],
                        END_PROC_ID: cfg_col.process_id, END_PROC_NAME: cfg_proc.name,
                        END_COL: end_col, END_COL_NAME: cfg_col.name, CAT_EXP_BOX: cat_exp_name}
            plotdatas[end_col].append(plotdata)

    return plotdatas


def gen_plotdata_one_proc(dic_data):
    plotdatas = []
    col_ids = list(dic_data.keys())
    dic_procs, dic_cols = get_cfg_proc_col_info(col_ids)
    for end_col, cat_exp_data in dic_data.items():
        cfg_col: CfgProcessColumn = dic_cols[end_col]
        cfg_proc: CfgProcess = dic_procs[cfg_col.process_id]
        for cat_exp_name, data in cat_exp_data.items():
            plotdata = {ARRAY_Y: data[ARRAY_Y], ARRAY_X: data[ARRAY_X],
                        END_PROC_ID: cfg_col.process_id, END_PROC_NAME: cfg_proc.name,
                        END_COL: end_col, END_COL_NAME: cfg_col.name, CAT_EXP_BOX: cat_exp_name}
            plotdatas.append(plotdata)

    return plotdatas


@log_execution_time()
def save_input_data_to_gen_images(df: DataFrame, graph_param):
    dic_rename_columns = {}
    for proc in graph_param.array_formval:
        col_ids_names = sorted(zip(proc.col_ids, proc.col_names))
        for col_id, col_name in col_ids_names:
            sql_label = gen_sql_label(col_id, col_name)
            if sql_label in df.columns:
                dic_rename_columns[sql_label] = col_name

    file_path = create_file_path('dat_' + EventType.STP.value + '_image')

    make_dir_from_file_path(file_path)
    df.rename(columns=dic_rename_columns).to_csv(file_path, sep=CsvDelimiter.TSV.value, index=False,
                                                 columns=list(dic_rename_columns.values()))
    return file_path


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
def use_etl_spray_shape(proc: CfgProcess):
    data_source: CfgDataSource = proc.data_source
    if data_source.type.lower() == DBType.CSV.name.lower():
        etl_func = data_source.csv_detail.etl_func
        if etl_func == FILE_ETL_SPRAY_SHAPE:
            return True
    return False


@log_execution_time()
def category_bind_dic_param_to_class(dic_param):
    graph_param = bind_dic_param_to_class(dic_param)
    if dic_param[COMMON].get(CYCLIC_TERMS):
        graph_param.cyclic_terms += dic_param[COMMON][CYCLIC_TERMS]

    return graph_param


@log_execution_time()
def gen_graph_cyclic(dic_param, terms, max_graph=None):
    """tracing data to show graph
        1 start point x n end point
        filter by condition point
        https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    # bind dic_param
    orig_graph_param = bind_dic_param_to_class(dic_param)

    graph_param_with_cat_exp = bind_dic_param_to_class(dic_param)
    graph_param_with_cat_exp.add_cat_exp_to_array_formval()

    graph_param = bind_dic_param_to_class(dic_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add cat exp (use for category page)
    graph_param.add_cat_exp_to_array_formval()

    # get serials
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)
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

    # apply coef for text
    df = apply_coef_text(df, orig_graph_param, dic_proc_cfgs)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[IS_RES_LIMITED] = is_res_limited

    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    # create output dataJOIN
    dic_param[ARRAY_PLOTDATA] = []
    end_procs = orig_graph_param.array_formval
    df.set_index(Cycle.time.key, inplace=True, drop=False)
    all_plots = []
    is_graph_limited = False
    for term_id, term in enumerate(terms):
        df_chunk = df[(df.index >= term['start_dt']) & (df.index < term['end_dt'])]
        if not len(df_chunk):
            continue

        dic_data = gen_dic_data_from_df(df_chunk, graph_param_with_cat_exp)
        dic_data, _is_graph_limited = split_data_by_condition(dic_data, orig_graph_param, max_graph)
        if _is_graph_limited:
            is_graph_limited = True

        plots = gen_plotdata_one_proc(dic_data)
        # get graph configs
        times = df_chunk[Cycle.time.key].tolist() or []
        dic_data_for_graph_configs = {}
        for end_proc in end_procs:
            time_col_alias = f'{Cycle.time.key}_{end_proc.proc_id}'
            end_col_time = df_chunk[time_col_alias].to_list()
            dic_data_for_graph_configs[end_proc.proc_id] = {Cycle.time.key: end_col_time}

        chart_infos, original_graph_configs = get_chart_infos(orig_graph_param, dic_data_for_graph_configs, times)
        for plot in plots:
            plot['term_id'] = term_id
            set_chart_infos_to_plotdata(plot[END_COL], chart_infos, original_graph_configs, plot)

        all_plots += plots

    dic_param[ARRAY_PLOTDATA], dic_param[IS_GRAPH_LIMITED] = limit_graph_per_tab(all_plots, max_graph)

    if is_graph_limited:
        dic_param[IS_GRAPH_LIMITED] = True

    return dic_param


def gen_graph_term(dic_param, max_graph=None):
    """tracing data to show graph
        1 start point x n end point
        filter by condition point
        https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    # bind dic_param
    orig_graph_param = bind_dic_param_to_class(dic_param)

    graph_param_with_cat_exp = bind_dic_param_to_class(dic_param)
    graph_param_with_cat_exp.add_cat_exp_to_array_formval()

    graph_param = bind_dic_param_to_class(dic_param)

    # add start proc
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add cat exp (use for category page)
    graph_param.add_cat_exp_to_array_formval()

    # get serials
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)
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

    # apply coef for text
    df = apply_coef_text(df, orig_graph_param, dic_proc_cfgs)

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[IS_RES_LIMITED] = is_res_limited

    # create output data
    dic_data = gen_dic_data_from_df(df, graph_param_with_cat_exp)
    dic_data, is_graph_limited = split_data_by_condition(dic_data, orig_graph_param, max_graph)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited
    dic_param[ARRAY_PLOTDATA] = gen_plotdata_one_proc(dic_data)

    # get graph configs
    times = df[Cycle.time.key].tolist() or []
    end_procs = orig_graph_param.array_formval
    dic_data_for_graph_configs = {}
    for end_proc in end_procs:
        if not len(df):
            continue
        time_col_alias = f'{Cycle.time.key}_{end_proc.proc_id}'
        end_col_time = df[time_col_alias].to_list()
        dic_data_for_graph_configs[end_proc.proc_id] = {Cycle.time.key: end_col_time}

    chart_infos, original_graph_configs = get_chart_infos(orig_graph_param, dic_data_for_graph_configs, times)

    for plot in dic_param[ARRAY_PLOTDATA]:
        plot['term_id'] = dic_param['term_id']
        set_chart_infos_to_plotdata(plot[END_COL], chart_infos, original_graph_configs, plot)

    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    return dic_param


@log_execution_time()
def produce_cyclic_terms(dic_param):  # TODO reverse when interval is negative
    num_ridge_lines = int(dic_param[COMMON][CYCLIC_DIV_NUM])
    interval = float(dic_param[COMMON][CYCLIC_INTERVAL])
    window_len = float(dic_param[COMMON][CYCLIC_WINDOW_LEN])
    start_date = dic_param[COMMON][START_DATE]
    start_time = dic_param[COMMON][START_TM]
    start_datetime = '{}T{}'.format(start_date, start_time)  # '2020/11/01T00:00'

    cyclic_terms = []
    prev_start = datetime.strptime(start_datetime, RL_DATETIME_FORMAT)
    end = prev_start + timedelta(hours=window_len)
    start_utc_str = datetime.strftime(prev_start.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
    end_utc_str = datetime.strftime(end.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
    cyclic_terms.append((start_utc_str, end_utc_str))

    for i in range(1, num_ridge_lines):
        start = prev_start + timedelta(hours=interval)
        end = start + timedelta(hours=window_len)
        start_utc_str = datetime.strftime(start.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
        end_utc_str = datetime.strftime(end.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
        cyclic_terms.append((start_utc_str, end_utc_str))
        prev_start = start

    # get new start/end datetime
    last_cyclic_term_end = cyclic_terms[-1][1]
    end_dt = datetime.strptime(last_cyclic_term_end, DATE_FORMAT_STR)
    end_date = datetime.strftime(end_dt, DATE_FORMAT)
    end_time = datetime.strftime(end_dt, TIME_FORMAT)

    if interval < 0:  # exchange start time and end time when interval is negative
        dic_param[COMMON][END_DATE] = start_date
        dic_param[COMMON][END_TM] = start_time
        dic_param[COMMON][START_DATE] = end_date
        dic_param[COMMON][START_TM] = end_time
        dic_param[TIME_CONDS] = {
            END_DATE: start_date,
            END_TM: start_time,
            END_DT: end_of_minute(start_date, start_time),
            START_DATE: end_date,
            START_TM: end_time,
            START_DT: start_of_minute(end_date, end_time),
        }
    else:
        # set END date/time
        dic_param[COMMON][END_DATE] = end_date
        dic_param[COMMON][END_TM] = end_time
        if dic_param.get(TIME_CONDS):
            time_cond = dic_param[TIME_CONDS][0]
            time_cond[END_DATE] = end_date
            time_cond[END_TM] = end_time
            time_cond[END_DT] = end_of_minute(end_date, end_time)

    dic_param[COMMON][CYCLIC_TERMS] = cyclic_terms


def remove_array_x_y(dic_param):
    for plot in dic_param[ARRAY_PLOTDATA]:
        if not plot:
            continue

        del plot[ARRAY_X]
        del plot[ARRAY_Y]
    return True


def remove_array_x_y_cyclic(dic_param):
    for plots in dic_param[ARRAY_PLOTDATA].values():
        for plot in plots:
            if not plot:
                continue

            del plot[ARRAY_X]
            del plot[ARRAY_Y]

    return True


@log_execution_time()
@notify_progress(75)
def dump_img_files(df, graph_param, dic_proc_cfgs):
    # TODO: minor trick to resolve nested-trace_log problem
    img_files = []
    if not df.index.size:
        return img_files

    # make input tsv file
    tsv_file = save_input_data_to_gen_images(df, graph_param)

    if use_etl_spray_shape(dic_proc_cfgs[graph_param.common.start_proc]):
        img_files = call_com_view(tsv_file, get_view_path())

    # strip folder
    if img_files is not None and not isinstance(img_files, Exception):
        if isinstance(img_files, str):
            img_files = [img_files]
        img_files = [get_basename(img) for img in img_files]

    return img_files


def customize_dict_param_common(dic_param):
    dic_end_procs = {}
    end_procs = dic_param.get(ARRAY_FORMVAL)
    for end_proc in end_procs:
        proc_id = end_proc.get(END_PROC)
        if isinstance(proc_id, list):
            proc_id = proc_id[0]

        col_ids = end_proc.get(GET02_VALS_SELECT)
        if not isinstance(col_ids, list):
            col_ids = [col_ids]

        for col_id in col_ids:
            dic_end_procs[int(col_id)] = int(proc_id)

    return dic_end_procs


@log_execution_time()
def limit_graph_per_tab(plots, max_graph=None):
    is_limited = False
    if max_graph is None:
        return plots, is_limited

    dic_count = defaultdict(int)
    limit_plots = []
    for plot in plots:
        col_id = plot[END_COL]
        dic_count[col_id] += 1
        if dic_count[col_id] > max_graph:
            is_limited = True
            continue

        limit_plots.append(plot)

    return limit_plots, is_limited
