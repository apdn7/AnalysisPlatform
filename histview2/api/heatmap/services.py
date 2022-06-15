import math
from datetime import timedelta, datetime
from typing import Dict, List

import numpy as np
import pandas as pd
from dateutil import parser
from dateutil.tz import tz
from flask_babel import gettext as _
from scipy.stats import iqr

from histview2.api.categorical_plot.services import gen_graph_param
from histview2.api.trace_data.services.time_series_chart import validate_data, graph_one_proc, \
    main_check_filter_detail_match_graph_data
from histview2.common.common_utils import start_of_minute, end_of_minute, DATE_FORMAT_QUERY, gen_sql_label, \
    reformat_dt_str
from histview2.common.constants import TIME_COL, CELL_SUFFIX, AGG_COL, ARRAY_PLOTDATA, HMFunction, DataType, \
    MATCHED_FILTER_IDS, UNMATCHED_FILTER_IDS, NOT_EXACT_MATCH_FILTER_IDS, ACTUAL_RECORD_NUMBER, IS_RES_LIMITED, \
    AGG_FUNC, CATE_VAL, END_COL, X_TICKTEXT, X_TICKVAL, Y_TICKTEXT, Y_TICKVAL, ACT_CELLS, MAX_TICKS, NA_STR
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.services.sse import notify_progress, background_announcer, AnnounceEvent
from histview2.common.sigificant_digit import signify_digit2
from histview2.common.trace_data_log import TraceErrKey, EventType, EventAction, Target, trace_log
from histview2.setting_module.models import CfgProcess
from histview2.trace_data.schemas import DicParam


@log_execution_time()
@notify_progress(75)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.CHM, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_heatmap_data(dic_param):
    # gen graph_param
    graph_param, dic_proc_cfgs = gen_graph_param(dic_param)

    hm_mode = int(graph_param.common.hm_mode)
    hm_step = int(graph_param.common.hm_step)
    # start proc
    start_tm = start_of_minute(graph_param.common.start_date, graph_param.common.start_time)
    end_tm = end_of_minute(graph_param.common.end_date, graph_param.common.end_time)
    client_timezone = graph_param.get_client_timezone()
    # client_tz = pytz.timezone(client_timezone) if client_timezone else tz.tzlocal()
    client_tz = tz.gettz(client_timezone or None) or tz.tzlocal()

    # generate all cells
    cells = gen_cells(start_tm, end_tm, hm_mode, hm_step)
    df_cells = pd.DataFrame({TIME_COL: cells})
    # time_delta = calc_time_delta(hm_mode, hm_step, start_tm)
    offset = get_utc_offset(client_tz)
    df_cells = convert_cell_tz(df_cells, offset)
    df_cells = gen_agg_col(df_cells, hm_mode, hm_step)

    # limit to 10000 cells
    dic_param.update({ACT_CELLS: df_cells.index.size})
    df_cells, end_tm, is_res_limited = limit_num_cells(df_cells, end_tm, offset)
    dic_param.update({IS_RES_LIMITED: is_res_limited})

    # generate x, y, x_label, y_label
    df_cells = gen_x_y(df_cells, hm_mode, hm_step, start_tm, end_tm, client_tz)

    # build dic col->function
    dic_col_func = build_dic_col_func(dic_proc_cfgs, graph_param)

    # get stratified variable
    var_col_id = graph_param.get_cate_var_col_id()
    var_agg_col = None
    if var_col_id:
        var_col_name = graph_param.get_cate_var_col_name()
        var_agg_col = gen_sql_label(var_col_id, var_col_name)

    dic_df_proc = dict()
    num_proc = len(dic_proc_cfgs.keys()) or 1
    total_actual_record_number = 0
    for idx, (proc_id, proc_config) in enumerate(dic_proc_cfgs.items()):
        if graph_param.is_end_proc(proc_id):
            pct_start = (idx + 1) * 50 / num_proc  # to report progress
            dic_df_proc[proc_id], dic_filter_results, actual_record_number = graph_heatmap_data_one_proc(
                proc_config, graph_param, start_tm, end_tm, offset, dic_col_func, var_agg_col, pct_start)
            total_actual_record_number += actual_record_number

    # fill empty cells
    dic_df_proc = fill_empty_cells(df_cells, dic_df_proc, var_agg_col)

    # gen plotly data + gen array_plotdata from here
    dic_param = gen_plotly_data(dic_param, dic_df_proc, hm_mode, hm_step, dic_col_func, df_cells, var_agg_col)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param.update(dic_filter_results)

    # real records
    dic_param[ACTUAL_RECORD_NUMBER] = total_actual_record_number

    return dic_param


def get_utc_offset(time_zone):
    """
    get utc time offset
    :param time_zone: str, timezone object
    :return: timedelta(seconds)
    """
    if isinstance(time_zone, str):
        time_zone = tz.gettz(time_zone)

    time_in_tz = datetime.now(tz=time_zone)
    time_offset = time_in_tz.utcoffset().seconds
    time_offset = timedelta(seconds=time_offset)

    return time_offset


def limit_num_cells(df_cells: pd.DataFrame, end_tm, offset, limit=10000):
    """ Limit number of cells to 10k including empty cells """
    is_res_limited = df_cells.index.size > limit

    print("///// is_res_limited: ", is_res_limited, ': ', df_cells.index.size)
    df_cells: pd.DataFrame = df_cells.loc[:limit]

    # update new end_time to 10000 cells
    last_cell_time = list(df_cells.tail(1)[TIME_COL])[0]
    end_tm_tz = pd.Timestamp(end_tm) + offset
    new_end_time = np.minimum(end_tm_tz, last_cell_time)
    new_end_tm = new_end_time.strftime(DATE_FORMAT_QUERY)

    return df_cells, new_end_tm, is_res_limited


@log_execution_time()
def gen_cells(start_tm, end_tm, hm_mode, hm_step):
    """ Generate cells of heatmap """
    floor_start_tm = pd.Timestamp(start_tm)
    floor_end_tm = pd.Timestamp(end_tm).replace(microsecond=0)
    cells = [floor_start_tm]
    prev = floor_start_tm
    while prev < floor_end_tm:
        if hm_mode == 1:
            next_cell = prev + pd.Timedelta(minutes=hm_step)
        else:
            next_cell = prev + pd.Timedelta(hours=hm_step)
        cells.append(next_cell)
        prev = next_cell

    return cells[:-1]


@log_execution_time()
def fill_empty_cells(df_cells: pd.DataFrame, dic_df_proc, var_agg_col=None):
    """ Some cells don't have data -> need to fill """
    for proc_id, proc_data in dic_df_proc.items():
        for end_col in proc_data:
            df_sensor: pd.DataFrame = dic_df_proc[proc_id][end_col].set_index(AGG_COL)
            if var_agg_col:
                dic_df_proc[proc_id][end_col] = dict()
                dic_df_cate = {cate_value: df_cate for cate_value, df_cate in df_sensor.groupby(var_agg_col)}
                df_cates = list(dic_df_cate.items())[:30]
                for cate_value, df_cate in df_cates:
                    dic_df_proc[proc_id][end_col][cate_value] = df_cells.set_index(AGG_COL) \
                        .join(df_cate, how="left", lsuffix=CELL_SUFFIX).replace({np.nan: None})
            else:
                dic_df_proc[proc_id][end_col] = df_cells.set_index(AGG_COL) \
                    .join(df_sensor, how="left", lsuffix=CELL_SUFFIX).replace({np.nan: None})
    return dic_df_proc


@log_execution_time()
def gen_y_ticks(hm_mode, hm_step):
    """ Generate ticks of y-axis """
    if hm_mode == 7:
        ticktext = ['Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon', 'Sun']
        row_per_day = int(24 / hm_step)
        tickvals = [(i + 1) * row_per_day for i in range(len(ticktext))]
    else:
        ticktext = ['24:00', '22:00', '20:00', '18:00', '16:00', '14:00', '12:00', '10:00', ' 8:00', ' 6:00', ' 4:00',
                    ' 2:00', ' 0:00']
        row_per_2hour = 120 / hm_step
        tickvals = [i * row_per_2hour for i in range(len(ticktext))]

    return ticktext, tickvals


@log_execution_time()
def get_x_ticks(df: pd.DataFrame):
    """ Generate ticks of x-axis """
    df_ticks = df.drop_duplicates('x', keep='last')
    df_ticks = df_ticks.drop_duplicates('x_label', keep='first')
    size = df_ticks.index.size
    if size <= MAX_TICKS:
        return df_ticks['x'].tolist(), df_ticks['x_label'].tolist()

    step = math.ceil(size / MAX_TICKS)
    indices = np.array(range(size))
    selected_indices = indices[0:-1:step]
    df_ticks = df_ticks.reset_index()
    df_ticks = df_ticks.loc[df_ticks.index.intersection(selected_indices)]
    return df_ticks['x'].tolist(), df_ticks['x_label'].tolist()


def build_hover(df, end_col, hm_function):
    df['hover'] = df['from'].astype(str) + \
                  df['to'].astype(str) + \
                  hm_function + ': ' + df[end_col].astype(str).str.replace('None', NA_STR) + '</br>'
    return df['hover'].to_list()


def build_plot_data(df, end_col, hm_function):
    """ Build data for heatmap trace of Plotly """
    df = df.sort_values(by=['x', 'y'])
    df = df.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan))
    df = df.where(pd.notnull(df), None)

    x = df['x'].to_list()
    y = df['y'].to_list()
    z = df[end_col].to_list()

    # build color scale
    z_min = df[end_col].dropna().min()
    if np.isnan(z_min):
        z_min = None
    z_max = df[end_col].dropna().max()
    if np.isnan(z_max):
        z_max = None

    hover_texts = build_hover(df, end_col, hm_function)

    return {
        'x': x,
        'y': y,
        'z': z,
        'z_min': z_min,
        'z_max': z_max,
        'hover': hover_texts,
    }


def get_function_i18n(hm_function):  # TODO better. can be moved to frontend
    """ Generate i18n aggregate function name """
    return _('CHM' + hm_function.replace('_', ' ').title().replace(' ', ''))


@log_execution_time()
@notify_progress(60)
def gen_plotly_data(dic_param: dict(), dic_df_proc: dict(), hm_mode, hm_step, dic_col_func: dict(), df_cells,
                    var_agg_col=None):
    dic_param[ARRAY_PLOTDATA] = dict()

    # gen x-axis ticks: ticktexts + tickvals daily, weekly, monthly, yearly
    x_tickvals, x_ticktext = get_x_ticks(df_cells)

    # gen y-axis ticks: ticktexts + tickvals
    y_ticktext, y_tickvals = gen_y_ticks(hm_mode, hm_step)
    plot_count = 0
    for proc_id, proc_data in dic_df_proc.items():
        dic_param[ARRAY_PLOTDATA][proc_id] = []
        for end_col, end_col_data in proc_data.items():
            hm_function = get_function_i18n(dic_col_func[proc_id][end_col].name)
            if var_agg_col:
                for cate_value, df_cate in end_col_data.items():
                    df_sensor_agg: pd.DataFrame = df_cate
                    plotdata: dict = build_plot_data(df_sensor_agg, end_col, hm_function)
                    plotdata.update({
                        AGG_FUNC: hm_function,
                        CATE_VAL: cate_value,
                        END_COL: end_col,
                        X_TICKTEXT: x_ticktext,
                        X_TICKVAL: x_tickvals,
                        Y_TICKTEXT: y_ticktext,
                        Y_TICKVAL: y_tickvals,
                    })
                    dic_param[ARRAY_PLOTDATA][proc_id].append(plotdata)
            else:
                df_sensor_agg: pd.DataFrame = end_col_data
                plotdata: dict = build_plot_data(df_sensor_agg, end_col, hm_function)
                plotdata.update({
                    AGG_FUNC: hm_function,
                    END_COL: end_col,
                    X_TICKTEXT: x_ticktext,
                    X_TICKVAL: x_tickvals,
                    Y_TICKTEXT: y_ticktext,
                    Y_TICKVAL: y_tickvals,
                })
                dic_param[ARRAY_PLOTDATA][proc_id].append(plotdata)

        plot_count += len(dic_param[ARRAY_PLOTDATA][proc_id])

    # limit to show only 30 graphs
    if plot_count > 30:
        remain = 30
        for proc_id, plot_datas in dic_param[ARRAY_PLOTDATA].items():
            num_plot = len(plot_datas)
            keep = min(remain, num_plot)
            dic_param[ARRAY_PLOTDATA][proc_id] = plot_datas[:keep]
            remain -= keep
            remain = max(0, remain)

    return dic_param


@log_execution_time()
def gen_agg_col(df: pd.DataFrame, hm_mode, hm_step):
    """ Aggregate data by time """
    pd_step = convert_to_pandas_step(hm_step, hm_mode)
    print(df.index.size)
    if hm_mode == 7:
        # .astype(str).str[:13] or 16 sometimes doesn't work as expected
        df[AGG_COL] = df[TIME_COL].dt.floor(pd_step).dt.strftime('%Y-%m-%d %H')
    else:
        df[AGG_COL] = df[TIME_COL].dt.floor(pd_step).dt.strftime('%Y-%m-%d %H:%M')
    return df


def gen_weekly_ticks(df: pd.DataFrame):
    # tick weekly, first day of week, sunday
    df['x_label'] = df[TIME_COL] - ((df[TIME_COL].dt.weekday + 1) % 7) * np.timedelta64(1, 'D')
    df['x_label'] = get_year_week_in_df_column(df['x_label']) \
                    + "<br>" + df['x_label'].dt.month.astype(str).str.pad(2, fillchar='0') \
                    + "-" + df['x_label'].dt.day.astype(str).str.pad(2, fillchar='0')
    return df['x_label']


def get_year_week_in_df_column(column: pd.DataFrame.columns):
    """ get year and week with format 'yy,w' -> '22, 20' """
    return column.dt.year.astype(str).str[-2:] + ", " \
           + (column.dt.strftime('%U').astype(int) + 1).astype(str).str.pad(2, fillchar='0')


def convert_cell_tz(df: pd.DataFrame, offset):
    df[TIME_COL] = df[TIME_COL] + offset
    return df


@log_execution_time()
def gen_x_y(df: pd.DataFrame, hm_mode, hm_step, start_tm, end_tm, client_tz=tz.tzlocal()):
    """ Generate x, y values and text labels of x and y axes """
    start_dt = parser.parse(start_tm)
    end_dt = parser.parse(end_tm)
    diff: timedelta = end_dt - start_dt
    num_days = diff.days

    if hm_mode == 7:
        # gen y
        row_per_day = int(24 / hm_step)
        df['dayofweek'] = df[TIME_COL].dt.day_name().astype(str).str[:3]
        df['newdayofweek'] = (12 - df[TIME_COL].dt.dayofweek) % 7  # sat,fri,...,mon,sun
        df['y'] = int(24 / hm_step) - (df[TIME_COL].dt.hour / hm_step).astype(int) + df[
            'newdayofweek'] * row_per_day

        # gen x
        df['year'] = df[TIME_COL].dt.year
        min_year = df['year'].min()
        df['x'] = df[TIME_COL].dt.strftime('%U').astype(int) + 1 + (df['year'] % min_year) * 53

        # x_label
        if num_days <= 140:
            df['x_label'] = gen_weekly_ticks(df)
        elif num_days <= 365 * 2:
            # tick monthly
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) + '<br>' \
                            + df[TIME_COL].dt.month.astype(str).str.pad(2, fillchar='0') + '-01'
        else:
            # tick yearly
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) + '<br>01-01'
    else:
        # gen y
        num_rows = int(1440 / hm_step)
        row_per_hour = 60 / hm_step
        df['dayofweek'] = df[TIME_COL].dt.day_name().astype(str).str[:3]
        if hm_step > 60:
            df['y'] = num_rows - (
                ((df[TIME_COL].dt.minute + df[TIME_COL].dt.hour * 60) / hm_step).astype(float))
        else:
            df['y'] = num_rows - (
                    (df[TIME_COL].dt.minute / hm_step).astype(int) + (df[TIME_COL].dt.hour * row_per_hour).astype(int))

        # gen x
        df['year'] = df[TIME_COL].dt.year
        min_year = df['year'].min()
        df['x'] = df[TIME_COL].dt.dayofyear + 366 * (df['year'] % min_year)

        # x_label
        if num_days <= 21:
            # tick daily
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) \
                            + "<br>" + df[TIME_COL].dt.date.astype(str).str[5:]
        elif num_days <= 140:
            df['x_label'] = gen_weekly_ticks(df)
        elif num_days <= 365 * 2:
            # tick monthly
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) + '<br>' \
                            + df[TIME_COL].dt.month.astype(str).str.pad(2, fillchar='0') + '-01'
        else:
            # tick yearly
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) + '<br>01-01'

    df['from'] = 'From: ' + df[TIME_COL].astype(str).str[:16] + '<br>'
    unit = 'min' if hm_mode == 1 else 'h'
    df['to_temp'] = df[TIME_COL] + pd.to_timedelta(hm_step, unit=unit)
    df.loc[df['to_temp'].astype(str).str[11:16] == '00:00', 'to'] = \
        df['to_temp'].astype(str).str[:8] + df[TIME_COL].astype(str).str[8:11] + '24:00'
    df.loc[df['to_temp'].astype(str).str[11:16] != '00:00', 'to'] = df['to_temp'].astype(str).str[:16]
    df['to'] = 'To     : ' + df['to'] + '</br>'

    return df


@log_execution_time()
def build_dic_col_func(dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam):
    """ Each column needs an aggregate function """
    dic_col_func = dict()
    for proc_id, proc_config in dic_proc_cfgs.items():
        if graph_param.is_end_proc(proc_id):
            dic_col_func[proc_id] = dict()
            end_col_ids = graph_param.get_sensor_cols(proc_id)
            end_cols = proc_config.get_cols(end_col_ids)
            for end_col in end_cols:
                if DataType[end_col.data_type] is DataType.REAL:
                    hm_function = HMFunction[graph_param.common.hm_function_real]
                else:
                    hm_function = HMFunction[graph_param.common.hm_function_cate]
                dic_col_func[proc_id][end_col.id] = hm_function
    return dic_col_func


@log_execution_time()
def apply_significant_digit(dic_df_col):
    for end_col, df_end in dic_df_col.items():
        df_end[end_col] = df_end[end_col].apply(signify_digit2)

    return dic_df_col


def append_result(dic_df_col, df_end_col, end_col_id):
    """ Append result of each batch to the whole result """
    if dic_df_col.get(end_col_id) is None:  # no need if use default dict
        dic_df_col[end_col_id] = df_end_col
    else:
        dic_df_col[end_col_id] = dic_df_col[end_col_id].append(df_end_col)


def get_batch_data(proc_cfg: CfgProcess, graph_param: DicParam, start_tm, end_tm, sql_limit=None) -> pd.DataFrame:
    """ Query data for each batch. """
    batches = generate_batches(start_tm, end_tm, batch_size=7)
    num_batches = len(batches)

    for idx, (batch_start_tm, batch_end_tm) in enumerate(batches):
        df_batch = graph_one_proc(proc_cfg.id, batch_start_tm, batch_end_tm,
                                  graph_param.common.cond_procs, graph_param.array_formval, sql_limit,
                                  same_proc_only=True)
        df_batch = validate_data(df_batch)

        # to report progress
        progress = idx / num_batches

        yield progress, df_batch


def gen_empty_df(end_col_id, var_agg_col, ):
    if var_agg_col:
        return pd.DataFrame({TIME_COL: [], AGG_COL: [], end_col_id: [], var_agg_col: []})
    else:
        return pd.DataFrame({TIME_COL: [], AGG_COL: [], end_col_id: []})


def gen_df_end_col(df_batch, end_col, var_agg_col):
    """ Use separate data frame for each column """
    end_col_label = gen_sql_label(end_col.id, end_col.column_name)
    if var_agg_col:
        df_end_col = df_batch[[TIME_COL, AGG_COL, var_agg_col, end_col_label]]
        df_end_col[var_agg_col] = df_end_col[var_agg_col].astype(str)
    else:
        df_end_col = df_batch[[TIME_COL, AGG_COL, end_col_label]]

    if end_col_label == var_agg_col:
        c_id = list(df_end_col.columns).index(end_col_label)
        df_end_col.columns.values[c_id] = end_col.id
    else:
        df_end_col = df_end_col.rename({end_col_label: end_col.id}, axis=1)
    return df_end_col


def gen_agg_col_names(var_agg_col):
    """ If use stratify variable -> aggregate by [stratify variable, time], otherwise, aggregate by time. """
    if var_agg_col:
        return [var_agg_col, AGG_COL]
    else:
        return [AGG_COL]


@log_execution_time()
def graph_heatmap_data_one_proc(proc_cfg: CfgProcess, graph_param: DicParam, start_tm, end_tm, offset,
                                dic_col_func, var_agg_col=None, pct_start=0.0):
    """ Build heatmap data for all columns of each process """

    # start proc
    proc_id = proc_cfg.id

    # get end cols
    end_col_ids = graph_param.get_sensor_cols(proc_id)
    end_cols = proc_cfg.get_cols(end_col_ids)
    hm_mode = int(graph_param.common.hm_mode)
    hm_step = int(graph_param.common.hm_step)

    num_rows = 0
    dic_df_col = dict()
    dic_filter_results = {MATCHED_FILTER_IDS: [], UNMATCHED_FILTER_IDS: [], NOT_EXACT_MATCH_FILTER_IDS: []}
    for (progress, df_batch) in get_batch_data(proc_cfg, graph_param, start_tm, end_tm):
        percent = pct_start + progress * 10  # to report progress
        background_announcer.announce(percent, AnnounceEvent.SHOW_GRAPH.name)

        # check filter match or not ( for GUI show )
        matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = \
            main_check_filter_detail_match_graph_data(graph_param, df_batch)

        # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
        dic_filter_results[MATCHED_FILTER_IDS] += matched_filter_ids
        dic_filter_results[UNMATCHED_FILTER_IDS] += unmatched_filter_ids
        dic_filter_results[NOT_EXACT_MATCH_FILTER_IDS] += not_exact_match_filter_ids

        if df_batch is None or df_batch.empty:
            for end_col in end_cols:
                df_end_col = gen_empty_df(end_col.id, var_agg_col)
                append_result(dic_df_col, df_end_col, end_col.id)
        else:
            num_rows += df_batch.index.size

            # gen aggregate endcol
            pd_step = convert_to_pandas_step(hm_step, hm_mode)
            df_batch: pd.DataFrame = create_agg_column(df_batch, pd_step, AGG_COL, hm_mode, offset)

            # transform + aggregate
            for end_col in end_cols:
                agg_cols = gen_agg_col_names(var_agg_col)
                df_end_col = gen_df_end_col(df_batch, end_col, var_agg_col)
                hm_function = dic_col_func[proc_id][end_col.id]

                df_end_col: pd.DataFrame \
                    = gen_heat_map_cell_value(df_end_col, graph_param, agg_cols, end_col.id, hm_function)

                append_result(dic_df_col, df_end_col, end_col.id)

    print('/////// proc_id: {}, num_rows: '.format(proc_id), num_rows)
    dic_df_col = apply_significant_digit(dic_df_col)

    return dic_df_col, dic_filter_results, num_rows


@log_execution_time()
def trim_data(df: pd.DataFrame, agg_cols: List, end_col):
    """ Trim first 5% biggest and 5% smallest. Alternative, rank by pct. """

    df = df.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).dropna()
    df['rank'] = df.groupby(agg_cols)[end_col].rank(method='first')
    df['group_size'] = df.groupby(agg_cols)['rank'].transform(np.size)
    df['p1'] = (df['group_size'] * 0.05).transform(np.floor)
    df['p9'] = df['group_size'] - df['p1']
    return df[(df['p1'] <= df['rank']) & (df['rank'] <= df['p9'])].reset_index()


def range_func(x):
    return np.max(x) - np.min(x)


def convert_to_pandas_step(hm_step, hm_mode):
    """ Pandas steps are: 4h, 15min, ... """
    if hm_mode == 7:
        return '{}h'.format(hm_step)
    return '{}min'.format(hm_step)


@log_execution_time()
def create_agg_column(df, pd_step='4h', agg_col=AGG_COL, hm_mode=7, offset=timedelta(0)):
    """ Create aggregate column data """
    if hm_mode == 7:
        length = 13
    else:
        length = 16
    temp = pd.to_datetime(df[TIME_COL], format='%Y-%m-%dT%H:%M') + offset
    df[agg_col] = temp.dt.floor(pd_step).astype(str).str[:length]
    return df


@log_execution_time()
def groupby_and_aggregate(df: pd.DataFrame, hm_function: HMFunction, hm_mode, hm_step, agg_cols, end_col):
    """ Group by time and calculate aggregates """
    if hm_function is HMFunction.count_per_hour:
        agg_params = {end_col: HMFunction.count.name, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
        if hm_mode == 7:
            df[end_col] = df[end_col].div(hm_step)
        else:
            df[end_col] = df[end_col].div(hm_step / 60)
    elif hm_function is HMFunction.count_per_min:
        agg_params = {end_col: HMFunction.count.name, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
        if hm_mode == 7:
            df[end_col] = df[end_col].div(hm_step * 60)
        else:
            df[end_col] = df[end_col].div(hm_step)
    elif hm_function is HMFunction.range:
        agg_params = {end_col: range_func, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
    elif hm_function is HMFunction.iqr:
        agg_params = {end_col: iqr, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
    elif hm_function is HMFunction.time_per_count:
        agg_params = {end_col: HMFunction.count.name, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
        step_time = (hm_step * 60) if hm_mode == 1 else (hm_step * 3600)
        df[end_col] = step_time / df[end_col]
    else:
        agg_params = {end_col: hm_function.name, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
    return df


@log_execution_time()
def gen_heat_map_cell_value(df: pd.DataFrame, graph_param: DicParam, agg_cols, end_col, hm_function: HMFunction):
    """ Value z for each cell (x,y) """
    hm_mode = int(graph_param.common.hm_mode)
    hm_step = int(graph_param.common.hm_step)
    hm_trim = int(graph_param.common.hm_trim)
    # trim data
    if 'count' not in hm_function.name and hm_trim:
        df = trim_data(df, agg_cols, end_col)

    # groupby + aggregate
    df = groupby_and_aggregate(df, hm_function, hm_mode, hm_step, agg_cols, end_col)

    return df


@log_execution_time()
def generate_batches(start_tm, end_tm, batch_size=7):
    """ Divide [start_time, end_time] to small batches. Default 7 days for each batch. """
    batch_start_str = reformat_dt_str(start_tm, DATE_FORMAT_QUERY)
    batch_start = datetime.strptime(batch_start_str, DATE_FORMAT_QUERY)

    batch_end = batch_start + timedelta(days=batch_size)
    batch_end_str = datetime.strftime(batch_end, DATE_FORMAT_QUERY)
    batch_end_str = min(batch_end_str, end_tm)

    batches = [(batch_start_str, batch_end_str)]

    # previous_start = batch_start
    previous_end = batch_end
    while batch_end_str < end_tm:
        batch_start = previous_end
        batch_start_str = datetime.strftime(batch_start, DATE_FORMAT_QUERY)

        batch_end = batch_start + timedelta(days=batch_size)
        batch_end_str = datetime.strftime(batch_end, DATE_FORMAT_QUERY)
        batch_end_str = min(batch_end_str, end_tm)

        batches.append((batch_start_str, batch_end_str))
        # previous_start = batch_start
        previous_end = batch_end
        # break

    return batches
