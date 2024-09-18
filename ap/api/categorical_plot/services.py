import traceback
from collections import OrderedDict, defaultdict
from copy import deepcopy
from datetime import datetime, timedelta

import pandas as pd
from dateutil import tz
from pandas import DataFrame

from ap.api.common.services.show_graph_services import (
    calc_raw_common_scale_y,
    calc_scale_info,
    calculate_histogram_count_common,
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    gen_before_rank_dict,
    gen_cat_label_unique,
    get_cfg_proc_col_info,
    get_chart_infos,
    get_data_from_db,
    get_min_max_of_all_chart_infos,
    main_check_filter_detail_match_graph_data,
    rank_categorical_cols,
    set_chart_infos_to_plotdata,
    set_str_rank_to_dic_param,
)
from ap.api.efa.services.etl import FILE as FILE_ETL_SPRAY_SHAPE
from ap.api.efa.services.etl import call_com_view
from ap.api.trace_data.services.time_series_chart import (
    gen_dic_data_from_df,
)
from ap.common.common_utils import (
    DATE_FORMAT,
    DATE_FORMAT_STR,
    RL_DATETIME_FORMAT,
    TIME_FORMAT,
    convert_time,
    create_file_path,
    end_of_minute,
    gen_sql_label,
    get_basename,
    get_view_path,
    make_dir_from_file_path,
    start_of_minute,
)
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    ARRAY_X,
    ARRAY_Y,
    CAT_EXP_BOX,
    CAT_EXP_BOX_NAME,
    CHART_INFOS,
    CHART_INFOS_ORG,
    COL_DATA_TYPE,
    COMMON,
    CYCLIC_DIV_NUM,
    CYCLIC_INTERVAL,
    CYCLIC_TERMS,
    CYCLIC_WINDOW_LEN,
    DATA_SIZE,
    DIC_STR_COLS,
    END_COL,
    END_COL_NAME,
    END_DATE,
    END_DT,
    END_PROC,
    END_PROC_ID,
    END_PROC_NAME,
    END_TM,
    GET02_VALS_SELECT,
    IS_GRAPH_LIMITED,
    KDE_DATA,
    MATCHED_FILTER_IDS,
    NA_STR,
    NOT_EXACT_MATCH_FILTER_IDS,
    SCALE_AUTO,
    SCALE_COMMON,
    SCALE_FULL,
    SCALE_SETTING,
    SCALE_THRESHOLD,
    START_DATE,
    START_DT,
    START_TM,
    TIME_COL,
    TIME_CONDS,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    Y_MAX,
    Y_MIN,
    YAML_DATA_TYPES,
    CacheType,
    CsvDelimiter,
    DataType,
    DBType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.ana_inf_data import calculate_kde_trace_data
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import MessageAnnouncer
from ap.common.services.statistics import calc_summaries, calc_summaries_cate_var
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.setting_module.models import CfgDataSource, CfgProcess


@log_execution_time()
@abort_process_handler()
def gen_graph_param(graph_param, dic_param, with_ct_col=False):
    # bind dic_param
    graph_param = category_bind_dic_param_to_class(graph_param, dic_param)

    # add category
    graph_param.add_cate_procs_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    # add cat exp
    graph_param.add_cat_exp_to_array_formval()

    # add div and color
    graph_param.add_column_to_array_formval(
        [col for col in [graph_param.common.color_var, graph_param.common.div_by_cat] if col],
    )

    # must get dic_proc_cfgs after above add proc to array_formval
    proc_cfg = graph_param.dic_proc_cfgs[graph_param.common.start_proc]

    non_sensor_cols = []
    if use_etl_spray_shape(proc_cfg):
        # get all checked cols
        non_sensor_cols = [column.id for column in proc_cfg.columns if column.data_type != DataType.REAL.name]

    # get serials
    for proc in graph_param.array_formval:
        if with_ct_col:
            get_date = graph_param.dic_proc_cfgs[proc.proc_id].get_date_col(column_name_only=False).id
            proc.add_cols(get_date, append_first=True)

        serial_ids = [
            serial.id for serial in graph_param.dic_proc_cfgs[proc.proc_id].get_serials(column_name_only=False)
        ]
        proc.add_cols(serial_ids, True)
        proc.add_cols(non_sensor_cols)

    return graph_param


@abort_process_handler()
@request_timeout_handling()
@log_execution_time()
@MessageAnnouncer.notify_progress(50)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.STP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True, cache_type=CacheType.TRANSACTION_DATA)
def gen_trace_data_by_categorical_var(graph_param, dic_param, max_graph=None, df=None):
    """tracing data to show graph
    1 start point x n end point
    filter by condition points that between start point and end_point
    """
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)
    # gen graph_para_
    dic_proc_cfgs = graph_param.dic_proc_cfgs

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            use_expired_cache=use_expired_cache,
        )
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
        dic_param[UNIQUE_SERIAL] = unique_serial

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param)

    # check filter match or not ( for GUI show )
    (
        matched_filter_ids,
        unmatched_filter_ids,
        not_exact_match_filter_ids,
    ) = main_check_filter_detail_match_graph_data(graph_param, df)

    convert_datetime_to_ct(df, graph_param)

    # convert proc to cols dic
    # transform raw data to graph data
    # create output data
    graph_param_with_cate = bind_dic_param_to_class(
        dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )
    graph_param_with_cate.add_cate_procs_to_array_formval()
    graph_param_with_cate.add_cat_exp_to_array_formval()
    df, dic_param = rank_categorical_cols(df, graph_param, dic_param)
    dic_str_cols = dic_param.get(DIC_STR_COLS, {})
    dic_ranks = gen_before_rank_dict(df, dic_str_cols)
    dic_data = gen_dic_data_from_df(df, graph_param_with_cate)
    dic_data, is_graph_limited, _ = split_data_by_condition(dic_data, graph_param, max_graph)
    dic_plots = gen_plotdata_for_var(graph_param.dic_proc_cfgs, dic_data, graph_param.common.cat_exp)
    for col_id, plots in dic_plots.items():
        if max_graph and max_graph < len(plots):
            is_graph_limited = True
            dic_plots[col_id] = plots[:max_graph]

    dic_param[ARRAY_PLOTDATA] = dic_plots
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids
    set_str_rank_to_dic_param(dic_param, dic_ranks, dic_str_cols, is_stp=True)

    # get visualization setting
    add_threshold_configs(dic_param, graph_param)

    # calculating the summaries information
    calc_summaries_cate_var(dic_param)

    # calc common scale y min max
    for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
        min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(plotdatas)
        calc_scale_info(dic_proc_cfgs, plotdatas, min_max_list, all_graph_min, all_graph_max)

    # generate kde for each trace output array
    dic_param = gen_kde_data_cate_var(dic_param)

    # gen_cat_data_for_ondemand(dic_param, dic_proc_cfgs)

    remove_array_x_y_cyclic(dic_param)

    # images
    img_files = dump_img_files(df, graph_param, dic_proc_cfgs)
    dic_param['images'] = img_files

    return dic_param


@log_execution_time()
def add_threshold_configs(dic_param, orig_graph_param):
    try:
        chart_infos_by_cond_procs, chart_infos_org = get_chart_infos(orig_graph_param, no_convert=True)
        if chart_infos_by_cond_procs:
            for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
                # TODO proc_id, col_id are str vs int
                chart_info_cond_proc = (
                    chart_infos_by_cond_procs[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                )
                chart_info_cond_proc_org = (
                    chart_infos_org[int(dic_param[COMMON][END_PROC][end_col])].get(int(end_col)) or {}
                )
                for plotdata in plotdatas:
                    selected_chart_infos = chart_info_cond_proc
                    y_min, y_max = get_min_max_of_all_chart_infos(selected_chart_infos)
                    plotdata[CHART_INFOS] = selected_chart_infos
                    plotdata[CHART_INFOS_ORG] = chart_info_cond_proc_org
                    plotdata[Y_MIN] = y_min
                    plotdata[Y_MAX] = y_max
    except Exception:
        traceback.print_exc()


@abort_process_handler()
@log_execution_time()
@request_timeout_handling()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.STP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True, cache_type=CacheType.TRANSACTION_DATA)
def gen_trace_data_by_cyclic(graph_param, dic_param, max_graph=None, df=None):
    dic_param, _ = gen_trace_data_by_cyclic_common(graph_param, dic_param, max_graph, df)

    dic_plotdata = defaultdict(list)
    for plotdata in dic_param[ARRAY_PLOTDATA]:
        dic_plotdata[plotdata['end_col']].append(plotdata)

    dic_param[ARRAY_PLOTDATA] = dic_plotdata
    # calculating the summaries information
    calc_summaries_cate_var(dic_param)

    # calc common scale y min max
    for end_col, plotdatas in dic_param[ARRAY_PLOTDATA].items():
        min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(plotdatas)
        calc_scale_info(graph_param.dic_proc_cfgs, plotdatas, min_max_list, all_graph_min, all_graph_max)

    # generate kde for each trace output array
    dic_param = gen_kde_data_cate_var(dic_param)

    # kde
    remove_array_x_y_cyclic(dic_param)

    return dic_param


@log_execution_time()
@abort_process_handler()
@MessageAnnouncer.notify_progress(75)
def gen_trace_data_by_cyclic_common(graph_param, dic_param, max_graph=None, df=None):
    """tracing data to show graph
    filter by condition points that between start point and end_point
    """

    produce_cyclic_terms(dic_param)
    terms = gen_dic_param_terms(dic_param)

    dic_param, export_df = gen_graph_cyclic(graph_param, dic_param, terms, max_graph, df)
    dic_param[TIME_CONDS] = terms
    return dic_param, export_df


def gen_dic_param_terms(dic_param):
    terms = dic_param[COMMON].get(CYCLIC_TERMS) or []
    terms = [
        {
            START_DATE: convert_time(start_dt, DATE_FORMAT),
            START_TM: convert_time(start_dt, TIME_FORMAT),
            START_DT: start_dt,
            END_DATE: convert_time(end_dt, DATE_FORMAT),
            END_TM: convert_time(end_dt, TIME_FORMAT),
            END_DT: end_dt,
        }
        for start_dt, end_dt in terms
    ]
    return terms


@log_execution_time()
@abort_process_handler()
@request_timeout_handling()
@MessageAnnouncer.notify_progress(75)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.STP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True, cache_type=CacheType.TRANSACTION_DATA)
def gen_trace_data_by_term(graph_param, dic_param, max_graph=None, df_cache=None):
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
    dic_param[UNIQUE_SERIAL] = 0

    if max_graph and len(terms) > max_graph:
        terms = terms[:max_graph]
        is_graph_limited = True

    df = None
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
        term_result, df_term, graph_param = gen_graph_term(graph_param, term_dic_param, max_graph, df_cache)
        df = df_term.copy() if df is None else pd.concat([df, df_term])

        if term_result.get(IS_GRAPH_LIMITED):
            is_graph_limited = True

        # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
        dic_param[MATCHED_FILTER_IDS] += term_result.get(MATCHED_FILTER_IDS, [])
        dic_param[UNMATCHED_FILTER_IDS] += term_result.get(UNMATCHED_FILTER_IDS, [])
        dic_param[NOT_EXACT_MATCH_FILTER_IDS] += term_result.get(NOT_EXACT_MATCH_FILTER_IDS, [])
        dic_param[ACTUAL_RECORD_NUMBER] += term_result.get(ACTUAL_RECORD_NUMBER, 0)

        unique_serial = term_result.get(UNIQUE_SERIAL)
        if unique_serial is None:
            dic_param[UNIQUE_SERIAL] = None
        if dic_param[UNIQUE_SERIAL] is not None:
            dic_param[UNIQUE_SERIAL] += term_result.get(UNIQUE_SERIAL)

        # update term data to original dic_param
        dic_param[ARRAY_PLOTDATA].extend(term_result.get(ARRAY_PLOTDATA))

    dic_param[ARRAY_PLOTDATA], is_graph_limited_second = limit_graph_per_tab(dic_param[ARRAY_PLOTDATA], max_graph)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited or is_graph_limited_second

    # get list cat_exp_box
    dic_param = gen_cat_label_unique(df, dic_param, graph_param)

    # calculating the summaries information
    calc_summaries(dic_param)

    # calc common scale y min max
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA])
    calc_scale_info(
        graph_param.dic_proc_cfgs,
        dic_param[ARRAY_PLOTDATA],
        min_max_list,
        all_graph_min,
        all_graph_max,
    )

    # generate kde for each trace output array
    dic_param = gen_kde_data(dic_param)

    # gen_cat_data_for_ondemand(dic_param, dic_proc_cfgs)
    remove_array_x_y(dic_param)

    return dic_param


@log_execution_time()
def customize_dict_param(dic_param):
    """Combine start_time, end_time, start_date, end_date into one object

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
    if (
        start_dates
        and start_times
        and end_dates
        and end_times
        and len(start_dates) == len(start_times) == len(end_dates) == len(end_times)
    ):
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
    if isinstance(end_col_alias, str):
        dic_param[COMMON][GET02_VALS_SELECT] = [end_col_alias]

    from_end_col_alias = dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT]
    if isinstance(from_end_col_alias, str):
        dic_param[ARRAY_FORMVAL][0][GET02_VALS_SELECT] = [from_end_col_alias]


@log_execution_time()
def gen_kde_data(dic_param, dic_array_full=None):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        full_array_y = dic_array_full[num] if dic_array_full else None
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


@log_execution_time()
@abort_process_handler()
def gen_kde_data_cate_var(dic_param, dic_array_full=None):
    array_plotdatas = dic_param.get(ARRAY_PLOTDATA)
    for end_col, array_plotdata in array_plotdatas.items():
        for num, plotdata in enumerate(array_plotdata):
            full_array_y = dic_array_full[num] if dic_array_full else None
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


@log_execution_time()
@abort_process_handler()
def split_data_by_condition(dic_data, graph_param, max_graph=None):
    """split data by condition

    Arguments:
        data {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    is_graph_limited = False
    dic_output = {}
    group_names = []
    cat_exp_cols = graph_param.common.cat_exp
    group_cols = cat_exp_cols.copy()
    sensor_cols = graph_param.common.sensor_cols
    if graph_param.common.div_by_cat:
        group_cols.append(graph_param.common.div_by_cat)

    if max_graph and max_graph < len(graph_param.common.sensor_cols):
        max_graph = True

    for proc in graph_param.array_formval:
        group_names = []
        proc_id = proc.proc_id
        end_cols = [end_col for end_col in proc.col_ids if end_col in sensor_cols]
        end_col_args = {}
        for end_col in end_cols:
            if end_col in dic_data[proc_id]:
                end_col_args[end_col] = dic_data[proc_id][end_col]
        dic_data_for_df = {
            **end_col_args,
        }

        # In case there is no time column in dic_data[proc_id], do not create time column in dataframe
        if TIME_COL in dic_data[proc_id]:
            dic_data_for_df[TIME_COL] = dic_data[proc_id][TIME_COL]

        group_by_cols = []
        for col in group_cols or []:
            group_by_cols.append(col)
            if col not in dic_data_for_df:
                for dic_col in dic_data.values():
                    vals = dic_col.get(col)
                    if vals:
                        dic_data_for_df[col] = vals
                        break

        df = pd.DataFrame(dic_data_for_df)
        if not len(df):
            continue

        df = df.convert_dtypes()

        limit_cols = end_cols
        if max_graph and max_graph < len(end_cols):
            limit_cols = end_cols[:max_graph]

        if group_by_cols:
            dic_col, group_names = gen_plotdata_with_group_by(df, limit_cols, group_by_cols)
        else:
            dic_col = gen_plotdata_without_group_by(df, limit_cols)

        dic_output.update(dic_col)

    return dic_output, is_graph_limited, group_names


def split_data_by_div(dic_data, div_names):
    dic_data_by_div = {}
    rlp_data_with_div = {}
    for sensor_id, sensor_data in dic_data.items():
        dic_data_by_div[sensor_id] = {}
        for group_name, group_val in sensor_data.items():
            group_names = str(group_name).replace(' ', '').split('|')
            div_name = group_names[-1]
            facet_group = ' | '.join(group_names[0:-1])
            if facet_group not in dic_data_by_div[sensor_id]:
                dic_data_by_div[sensor_id][facet_group] = {}

            dic_data_by_div[sensor_id][facet_group][div_name] = group_val

    if len(div_names):
        # div only
        for sensor_id, sensor_data in dic_data_by_div.items():
            rlp_data_with_div[sensor_id] = {}
            for group_name, group_val in sensor_data.items():
                for div in div_names:
                    if str(div) not in group_val.keys():
                        group_val[str(div)] = {'array_x': [], 'array_y': []}
                rlp_data_with_div[sensor_id][group_name] = OrderedDict(sorted(group_val.items()))
    return rlp_data_with_div


def gen_plotdata_without_group_by(df, end_cols):
    dic_output = {}
    array_x = df[TIME_COL].to_list()
    for end_col in end_cols:
        dic_cate = defaultdict(dict)
        dic_output[end_col] = dic_cate
        dic_cate[None] = {ARRAY_X: array_x, ARRAY_Y: df[end_col].to_list()}

    return dic_output


def gen_plotdata_with_group_by(df, end_cols, group_by_cols):
    dic_output = {}
    df_group = df.groupby(group_by_cols)
    limit_cols = end_cols
    group_names = []

    for end_col in limit_cols:
        dic_cate = defaultdict(dict)
        dic_output[end_col] = dic_cate
        for _group_name, idxs in df_group.groups.items():
            group_name = _group_name
            div_group = group_name
            if isinstance(group_name, (list, tuple)):
                group_name = ' | '.join([str(NA_STR if pd.isna(val) else val) for val in group_name])
                div_group = div_group[-1]

            rows = df.loc[idxs, end_col]
            # if len(rows.dropna()) == 0:
            #     continue

            if div_group not in group_names:
                group_names.append(div_group)
            dic_cate[group_name] = {
                ARRAY_X: df.loc[idxs, TIME_COL].to_list(),
                ARRAY_Y: rows.to_list(),
            }

    return dic_output, group_names


def gen_plotdata_for_var(dic_proc_cfgs, dic_data, cat_exp_box_cols):
    plotdatas = {}
    cat_exp_box_proc_name = []
    col_ids = list(dic_data.keys()) + cat_exp_box_cols
    dic_procs, dic_cols = get_cfg_proc_col_info(dic_proc_cfgs, col_ids)
    for col in cat_exp_box_cols:
        cat_exp_box_proc_name.append(dic_cols[col].shown_name)

    for end_col, cat_exp_data in dic_data.items():
        plotdatas[end_col] = []
        cfg_col = dic_cols[end_col]
        cfg_proc = dic_procs[cfg_col.process_id]
        for cat_exp_value, data in cat_exp_data.items():
            if not data:
                continue

            plotdata = {
                ARRAY_Y: data[ARRAY_Y],
                ARRAY_X: data[ARRAY_X],
                END_PROC_ID: cfg_col.process_id,
                END_PROC_NAME: cfg_proc.shown_name,
                END_COL: end_col,
                END_COL_NAME: cfg_col.shown_name,
                CAT_EXP_BOX: cat_exp_value,
                CAT_EXP_BOX_NAME: cat_exp_box_proc_name,
                COL_DATA_TYPE: cfg_col.data_type,
            }
            plotdatas[end_col].append(plotdata)

    return plotdatas


def gen_plotdata_one_proc(dic_proc_cfgs, dic_data, cat_exp_box_cols=[]):
    plotdatas = []
    cat_exp_box_proc_name = []
    col_ids = list(dic_data.keys()) + cat_exp_box_cols
    dic_procs, dic_cols = get_cfg_proc_col_info(dic_proc_cfgs, col_ids)
    for col in cat_exp_box_cols:
        cat_exp_box_proc_name.append(dic_cols[col].shown_name)

    for end_col, cat_exp_data in dic_data.items():
        cfg_col = dic_cols[end_col]
        cfg_proc = dic_procs[cfg_col.process_id]
        for cat_exp_value, data in cat_exp_data.items():
            cat_value = cat_exp_value if cat_exp_value is not None else ''
            plotdata = {
                ARRAY_Y: data[ARRAY_Y],
                ARRAY_X: data[ARRAY_X],
                END_PROC_ID: cfg_col.process_id,
                END_PROC_NAME: cfg_proc.shown_name,
                END_COL: end_col,
                END_COL_NAME: cfg_col.shown_name,
                CAT_EXP_BOX: cat_value,
                CAT_EXP_BOX_NAME: cat_exp_box_proc_name,
                COL_DATA_TYPE: cfg_col.data_type,
            }
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
    df.rename(columns=dic_rename_columns).to_csv(
        file_path,
        sep=CsvDelimiter.TSV.value,
        index=False,
        columns=list(dic_rename_columns.values()),
    )
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
    if data_source.type.lower() in {DBType.CSV.name.lower(), DBType.V2.name.lower()}:
        etl_func = data_source.csv_detail.etl_func
        if etl_func == FILE_ETL_SPRAY_SHAPE:
            return True
    return False


@log_execution_time()
def category_bind_dic_param_to_class(graph_param, dic_param):
    if dic_param[COMMON].get(CYCLIC_TERMS):
        graph_param.cyclic_terms += dic_param[COMMON][CYCLIC_TERMS]

    return graph_param


@log_execution_time()
def gen_graph_cyclic(graph_param, dic_param, terms, max_graph=None, df=None):
    """tracing data to show graph
    1 start point x n end point
    filter by condition point
    https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """

    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    graph_param_with_cat_exp = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )
    graph_param_with_cat_exp.add_cat_exp_to_array_formval()
    graph_param_with_cat_exp.add_ng_condition_to_array_formval()

    # get serials

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            use_expired_cache=use_expired_cache,
        )
        dic_param[UNIQUE_SERIAL] = unique_serial
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param)

    df, dic_param = rank_categorical_cols(df, graph_param, dic_param)
    dic_str_cols = dic_param.get(DIC_STR_COLS, {})

    export_df = df.copy()
    convert_datetime_to_ct(df, graph_param)
    dic_ranks = gen_before_rank_dict(df, dic_str_cols)
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

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = int(df.memory_usage(deep=True).sum())

    # create output dataJOIN
    dic_param[ARRAY_PLOTDATA] = []
    end_procs = graph_param.array_formval
    df.set_index(TIME_COL, inplace=True, drop=False)
    all_plots = []
    is_graph_limited = False
    for term_id, term in enumerate(terms):
        df_chunk = df[(df.index >= term['start_dt']) & (df.index < term['end_dt'])]
        if not len(df_chunk):
            continue

        dic_data = gen_dic_data_from_df(df_chunk, graph_param_with_cat_exp)
        dic_data, _is_graph_limited, _ = split_data_by_condition(dic_data, graph_param, max_graph)
        if _is_graph_limited:
            is_graph_limited = True

        cat_exp_box_cols = graph_param.common.cat_exp or []
        plots = gen_plotdata_one_proc(graph_param.dic_proc_cfgs, dic_data, cat_exp_box_cols)
        # get graph configs
        times = df_chunk[TIME_COL].tolist() or []
        dic_data_for_graph_configs = {}
        for end_proc in end_procs:
            time_col_alias = f'{TIME_COL}_{end_proc.proc_id}'
            end_col_time = df_chunk[time_col_alias].to_list()
            dic_data_for_graph_configs[end_proc.proc_id] = {TIME_COL: end_col_time}

        chart_infos, original_graph_configs = get_chart_infos(graph_param, dic_data_for_graph_configs, times)
        for plot in plots:
            plot['term_id'] = term_id
            set_chart_infos_to_plotdata(plot[END_COL], chart_infos, original_graph_configs, plot)

        # all_plots += plots
        all_plots.extend(plots)

    dic_param[ARRAY_PLOTDATA], dic_param[IS_GRAPH_LIMITED] = limit_graph_per_tab(all_plots, max_graph)

    set_str_rank_to_dic_param(dic_param, dic_ranks, dic_str_cols, is_stp=True)

    # gen_cat_data_for_ondemand(dic_param, dic_proc_cfgs)

    if is_graph_limited:
        dic_param[IS_GRAPH_LIMITED] = True

    return dic_param, export_df


@abort_process_handler()
@log_execution_time()
def gen_graph_term(graph_param, dic_param, max_graph=None, df=None):
    """tracing data to show graph
    1 start point x n end point
    filter by condition point
    https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """

    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    graph_param_with_cat_exp = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )
    graph_param_with_cat_exp.add_cat_exp_to_array_formval()

    show_graph_param = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )

    # get serials
    dic_proc_cfgs = graph_param.dic_proc_cfgs

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            show_graph_param,
            dic_cat_filters,
            use_expired_cache=use_expired_cache,
        )
        dic_param[UNIQUE_SERIAL] = unique_serial
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, show_graph_param)

    convert_datetime_to_ct(df, show_graph_param)

    df, dic_param = rank_categorical_cols(df, graph_param, dic_param)
    dic_str_cols = dic_param.get(DIC_STR_COLS, {})
    dic_ranks = gen_before_rank_dict(df, dic_str_cols)
    # check filter match or not ( for GUI show )
    (
        matched_filter_ids,
        unmatched_filter_ids,
        not_exact_match_filter_ids,
    ) = main_check_filter_detail_match_graph_data(show_graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids

    # flag to show that trace result was limited
    dic_param[DATA_SIZE] = int(df.memory_usage(deep=True).sum())

    # create output data
    cat_exp_box_cols = show_graph_param.common.cat_exp or []
    dic_data = gen_dic_data_from_df(df, graph_param_with_cat_exp)
    dic_data, is_graph_limited, _ = split_data_by_condition(dic_data, show_graph_param, max_graph)
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited
    dic_param[ARRAY_PLOTDATA] = gen_plotdata_one_proc(dic_proc_cfgs, dic_data, cat_exp_box_cols)
    set_str_rank_to_dic_param(dic_param, dic_ranks, dic_str_cols, is_stp=True)
    # get graph configs
    times = df[TIME_COL].tolist() or []
    end_procs = show_graph_param.array_formval
    dic_data_for_graph_configs = {}
    for end_proc in end_procs:
        if not len(df):
            continue
        time_col_alias = f'{TIME_COL}_{end_proc.proc_id}'
        end_col_time = df[time_col_alias].to_list()
        dic_data_for_graph_configs[end_proc.proc_id] = {TIME_COL: end_col_time}

    chart_infos, original_graph_configs = get_chart_infos(show_graph_param, dic_data_for_graph_configs, times)

    for plot in dic_param[ARRAY_PLOTDATA]:
        plot['term_id'] = dic_param['term_id']
        set_chart_infos_to_plotdata(plot[END_COL], chart_infos, original_graph_configs, plot)

    return dic_param, df, graph_param


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


@log_execution_time()
def gen_direct_terms(dic_param):
    list_dt = []
    terms = []
    start_dt = dic_param[COMMON][START_DATE]
    if isinstance(start_dt, list):
        for k, dt in enumerate(start_dt):
            start_date = dt
            start_time = dic_param[COMMON][START_TM][k]
            end_date = dic_param[COMMON][END_DATE][k]
            end_time = dic_param[COMMON][END_TM][k]
            start_datetime = '{}T{}'.format(start_date, start_time)  # '2020/11/01T00:00'
            end_datetime = '{}T{}'.format(end_date, end_time)
            prev_start = datetime.strptime(start_datetime, RL_DATETIME_FORMAT)
            start_utc_str = datetime.strftime(prev_start.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
            prev_end = datetime.strptime(end_datetime, RL_DATETIME_FORMAT)
            end_utc_str = datetime.strftime(prev_end.replace(tzinfo=tz.tzutc()), DATE_FORMAT_STR)
            terms.append(
                {
                    START_DATE: convert_time(start_date, DATE_FORMAT),
                    START_TM: convert_time(start_time, TIME_FORMAT),
                    START_DT: start_utc_str,
                    END_DATE: convert_time(end_date, DATE_FORMAT),
                    END_TM: convert_time(end_time, TIME_FORMAT),
                    END_DT: end_utc_str,
                },
            )
            list_dt.append(start_datetime)
            list_dt.append(end_datetime)

    # reassign startpoint endpoint of datetime range for dic_param
    if list_dt:
        list_dt.sort()
        first_date = convert_time(list_dt[0], return_string=False)
        last_date = convert_time(list_dt[-1], return_string=False)
        dic_param[COMMON][START_DATE] = str(first_date.date())
        dic_param[COMMON][START_TM] = str(first_date.time())
        dic_param[COMMON][END_DATE] = str(last_date.date())
        dic_param[COMMON][END_TM] = str(last_date.time())

    return terms


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
@MessageAnnouncer.notify_progress(75)
def dump_img_files(df, graph_param, dic_proc_cfgs):
    # TODO: minor trick to resolve nested-trace_log problem
    img_files = []
    if not df.index.size:
        return img_files

    if use_etl_spray_shape(dic_proc_cfgs[graph_param.common.start_proc]):
        # make input tsv file
        tsv_file = save_input_data_to_gen_images(df, graph_param)
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
            if proc_id:
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
