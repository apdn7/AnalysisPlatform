import math
from datetime import datetime, timedelta
from typing import Dict

import numpy as np
import pandas as pd
from dateutil import parser
from dateutil.tz import tz
from flask_babel import gettext as _
from scipy.stats import iqr

from ap.api.categorical_plot.services import gen_graph_param
from ap.api.common.services.services import convert_datetime_to_ct, get_filter_on_demand_data
from ap.api.trace_data.services.time_series_chart import (
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_data_from_db,
    main_check_filter_detail_match_graph_data,
)
from ap.common.common_utils import (
    DATE_FORMAT_QUERY,
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_CSV,
    end_of_minute,
    gen_sql_label,
    reformat_dt_str,
    start_of_minute,
)
from ap.common.constants import (
    ACT_CELLS,
    ACTUAL_RECORD_NUMBER,
    AGG_COL,
    AGG_FUNC,
    ARRAY_PLOTDATA,
    CAT_EXP_BOX,
    CATE_VAL,
    CELL_SUFFIX,
    COL_DATA_TYPE,
    COMMON,
    DATA_SIZE,
    END_COL,
    MATCHED_FILTER_IDS,
    MAX_GRAPHS,
    MAX_TICKS,
    NA_STR,
    NOT_EXACT_MATCH_FILTER_IDS,
    TIME_COL,
    UNIQUE_CATEGORIES,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    X_TICKTEXT,
    X_TICKVAL,
    Y_TICKTEXT,
    Y_TICKVAL,
    DataType,
    HMFunction,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import AnnounceEvent, background_announcer, notify_progress
from ap.common.sigificant_digit import get_fmt_from_array, signify_digit
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.setting_module.models import CfgProcess, CfgProcessColumn
from ap.trace_data.schemas import DicParam

CHM_AGG_FUNC = [HMFunction.median.name, HMFunction.mean.name, HMFunction.std.name]


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@notify_progress(75)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.CHM, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True)
def gen_heatmap_data(dic_param):
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    # gen graph_param
    graph_param, dic_proc_cfgs = gen_graph_param(dic_param, with_ct_col=True)

    (
        dic_df_proc,
        hm_mode,
        hm_step,
        dic_col_func,
        df_cells,
        var_agg_cols,
        target_var_data,
        _,
    ) = gen_heatmap_data_as_dict(
        graph_param,
        dic_param,
        dic_proc_cfgs,
        dic_cat_filters,
        cat_exp,
        cat_procs,
        use_expired_cache,
    )

    # gen plotly data + gen array_plotdata from here
    dic_param = gen_plotly_data(
        dic_param, dic_df_proc, hm_mode, hm_step, dic_col_func, df_cells, var_agg_cols
    )

    dic_param = get_filter_on_demand_data(dic_param)

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


def limit_num_cells(df_cells: pd.DataFrame, end_tm, client_tz, limit=10000):
    """Limit number of cells to 10k including empty cells"""
    # is_res_limited = df_cells.index.size > limit

    # print("///// is_res_limited: ", is_res_limited, ': ', df_cells.index.size)
    df_cells: pd.DataFrame = df_cells.loc[:limit]

    # update new end_time to 10000 cells
    last_cell_time = list(df_cells.tail(1)[TIME_COL])[0]
    # end_tm is utc -> convert to local-time
    end_tm_tz = pd.to_datetime(pd.Series([end_tm]), utc=True).dt.tz_convert(client_tz)
    end_tm_tz = list(end_tm_tz)[0]
    new_end_time = np.minimum(end_tm_tz, last_cell_time)
    new_end_tm = new_end_time.strftime(DATE_FORMAT_QUERY)

    return df_cells, new_end_tm


@log_execution_time()
@abort_process_handler()
def gen_cells(start_tm, end_tm, hm_mode, hm_step):
    """Generate cells of heatmap"""
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
@abort_process_handler()
def fill_empty_cells(df_cells: pd.DataFrame, dic_df_proc, var_agg_col=None):
    """Some cells don't have data -> need to fill"""
    for proc_id, proc_data in dic_df_proc.items():
        for end_col in proc_data:
            df_sensor: pd.DataFrame = dic_df_proc[proc_id][end_col].set_index(AGG_COL)
            if var_agg_col:
                dic_df_proc[proc_id][end_col] = dict()

                dic_df_cate = {
                    NA_STR if cate_value in ['nan', '<NA>'] else cate_value: df_cate
                    for cate_value, df_cate in df_sensor.groupby(var_agg_col, dropna=False)
                }
                df_cates = list(dic_df_cate.items())[:30]
                for cate_value, df_cate in df_cates:
                    dic_df_proc[proc_id][end_col][cate_value] = (
                        df_cells.set_index(AGG_COL)
                        .join(df_cate, how='left', lsuffix=CELL_SUFFIX)
                        .replace({np.nan: None})
                    )
            else:
                dic_df_proc[proc_id][end_col] = (
                    df_cells.set_index(AGG_COL)
                    .join(df_sensor, how='left', lsuffix=CELL_SUFFIX)
                    .replace({np.nan: None})
                )
    return dic_df_proc


@log_execution_time()
@abort_process_handler()
def gen_y_ticks(hm_mode, hm_step):
    """Generate ticks of y-axis"""
    if hm_mode == 7:
        ticktext = ['Sun', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon']
        row_per_day = int(24 / hm_step)
        tickvals = [(i + 1) * row_per_day for i in range(len(ticktext))]
    else:
        ticktext = [
            '24:00',
            '22:00',
            '20:00',
            '18:00',
            '16:00',
            '14:00',
            '12:00',
            '10:00',
            ' 8:00',
            ' 6:00',
            ' 4:00',
            ' 2:00',
            ' 0:00',
        ]
        row_per_2hour = 120 / hm_step
        tickvals = [i * row_per_2hour for i in range(len(ticktext))]

    return ticktext, tickvals


@log_execution_time()
@abort_process_handler()
def get_x_ticks(df: pd.DataFrame):
    """Generate ticks of x-axis"""
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
    df['hover'] = (
        df['from'].astype(str)
        + df['to'].astype(str)
        + hm_function
        + ': '
        + df[end_col].apply(signify_digit).astype(str).str.replace(r'None|nan', NA_STR, regex=True)
        + '<br>'
    )
    return df['hover'].to_list()


def build_plot_data(df, end_col, hm_function):
    """Build data for heatmap trace of Plotly"""
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
        'z_fmt': get_fmt_from_array(z),
        'z_min': z_min or 0,
        'z_max': z_max or 0,
        'hover': hover_texts,
    }


def get_function_i18n(hm_function):
    """Generate i18n aggregate function name"""
    return _('CHM' + hm_function.replace('_', ' ').title().replace(' ', ''))


@log_execution_time()
@abort_process_handler()
@notify_progress(60)
def gen_plotly_data(
    dic_param, dic_df_proc, hm_mode, hm_step, dic_col_func, df_cells, var_agg_col=None
):
    dic_param[ARRAY_PLOTDATA] = dict()

    # gen x-axis ticks: ticktexts + tickvals daily, weekly, monthly, yearly
    x_tickvals, x_ticktext = get_x_ticks(df_cells)

    # gen y-axis ticks: ticktexts + tickvals
    y_ticktext, y_tickvals = gen_y_ticks(hm_mode, hm_step)
    plot_count = 0

    # target variables list
    # [11,14,15,16,18,19,20,21,22,6]
    target_vars = dic_param[COMMON]['GET02_VALS_SELECT']
    for proc_id, proc_data in dic_df_proc.items():
        dic_param[ARRAY_PLOTDATA][proc_id] = []
        for end_col, end_col_data in proc_data.items():
            if end_col in target_vars:
                hm_function = get_function_i18n(dic_col_func[proc_id][end_col].name)
                if var_agg_col:
                    for cate_value, df_cate in end_col_data.items():
                        df_sensor_agg: pd.DataFrame = df_cate
                        plotdata: dict = build_plot_data(df_sensor_agg, end_col, hm_function)
                        col_data_type = CfgProcessColumn.get_by_id(end_col)
                        plotdata.update(
                            {
                                AGG_FUNC: hm_function,
                                CATE_VAL: cate_value,
                                END_COL: end_col,
                                COL_DATA_TYPE: col_data_type.data_type if col_data_type else None,
                                X_TICKTEXT: x_ticktext,
                                X_TICKVAL: x_tickvals,
                                Y_TICKTEXT: y_ticktext,
                                Y_TICKVAL: y_tickvals,
                            }
                        )
                        dic_param[ARRAY_PLOTDATA][proc_id].append(plotdata)
                else:
                    df_sensor_agg: pd.DataFrame = end_col_data
                    plotdata: dict = build_plot_data(df_sensor_agg, end_col, hm_function)
                    col_data_type = CfgProcessColumn.get_by_id(end_col)
                    plotdata.update(
                        {
                            AGG_FUNC: hm_function,
                            END_COL: end_col,
                            COL_DATA_TYPE: col_data_type.data_type if col_data_type else None,
                            X_TICKTEXT: x_ticktext,
                            X_TICKVAL: x_tickvals,
                            Y_TICKTEXT: y_ticktext,
                            Y_TICKVAL: y_tickvals,
                        }
                    )
                    dic_param[ARRAY_PLOTDATA][proc_id].append(plotdata)

        plot_count += len(dic_param[ARRAY_PLOTDATA][proc_id])

    # limit to show only 30 graphs
    if plot_count > MAX_GRAPHS:
        remain = MAX_GRAPHS
        for proc_id, plot_datas in dic_param[ARRAY_PLOTDATA].items():
            num_plot = len(plot_datas)
            keep = min(remain, num_plot)
            dic_param[ARRAY_PLOTDATA][proc_id] = plot_datas[:keep]
            remain -= keep
            remain = max(0, remain)

    return dic_param


@log_execution_time()
@abort_process_handler()
def gen_agg_col(df: pd.DataFrame, hm_mode, hm_step):
    """Aggregate data by time"""
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
    df['x_label'] = df[TIME_COL] - (df[TIME_COL].dt.weekday % 7) * np.timedelta64(1, 'D')
    df['x_label'] = (
        get_year_week_in_df_column(df['x_label'])
        + '<br>'
        + df['x_label'].dt.month.astype(str).str.pad(2, fillchar='0')
        + '-'
        + df['x_label'].dt.day.astype(str).str.pad(2, fillchar='0')
    )
    return df['x_label']


def gen_daily_ticks(df: pd.DataFrame):
    # tick weekly, first day of week, sunday
    df['x_label'] = (
        get_year_week_in_df_column(df[TIME_COL])
        + '<br>'
        + df[TIME_COL].dt.month.astype(str).str.pad(2, fillchar='0')
        + '-'
        + df[TIME_COL].dt.day.astype(str).str.pad(2, fillchar='0')
    )
    return df['x_label']


def get_year_week_in_df_column(column: pd.DataFrame.columns):
    """get year and week with format 'yy,w' -> '22, 20'"""
    return (
        column.dt.year.astype(str).str[-2:]
        + ', '
        + (column.dt.strftime('%U').astype(int)).astype(str).str.pad(2, fillchar='0')
    )


def convert_cell_tz(df: pd.DataFrame, offset):
    df[TIME_COL] = df[TIME_COL] + offset
    return df


@log_execution_time()
@abort_process_handler()
def gen_x_y(df: pd.DataFrame, hm_mode, hm_step, start_tm, end_tm):
    """Generate x, y values and text labels of x and y axes"""
    start_dt = parser.parse(start_tm)
    end_dt = parser.parse(end_tm)
    diff: timedelta = end_dt - start_dt
    num_days = diff.days

    if hm_mode == 7:
        # gen y
        row_per_day = int(24 / hm_step)
        df['dayofweek'] = df[TIME_COL].dt.day_name().astype(str).str[:3]
        df['newdayofweek'] = (16 - df[TIME_COL].dt.dayofweek) % 10  # mon, tue... sat
        df['y'] = (
            int(24 / hm_step)
            - (df[TIME_COL].dt.hour / hm_step).astype(int)
            + df['newdayofweek'] * row_per_day
        )

        # gen x
        df['year'] = df[TIME_COL].dt.year
        min_year = df['year'].min()
        df['x'] = df[TIME_COL].dt.strftime('%U').astype(int) + (df['year'] % min_year) * 53

        # x_label
        if num_days <= 140:
            df['x_label'] = gen_weekly_ticks(df)
        elif num_days <= 365 * 2:
            # tick monthly
            df['x_label'] = (
                get_year_week_in_df_column(df[TIME_COL])
                + '<br>'
                + df[TIME_COL].dt.month.astype(str).str.pad(2, fillchar='0')
                + '-01'
            )
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
                ((df[TIME_COL].dt.minute + df[TIME_COL].dt.hour * 60) / hm_step).astype(float)
            )
        else:
            df['y'] = num_rows - (
                (df[TIME_COL].dt.minute / hm_step).astype(int)
                + (df[TIME_COL].dt.hour * row_per_hour).astype(int)
            )

        # gen x
        df['year'] = df[TIME_COL].dt.year
        min_year = df['year'].min()
        df['x'] = df[TIME_COL].dt.dayofyear + 366 * (df['year'] % min_year)

        # x_label
        if num_days <= 21:
            # tick daily
            df['x_label'] = (
                get_year_week_in_df_column(df[TIME_COL])
                + '<br>'
                + df[TIME_COL].dt.date.astype(str).str[5:]
            )
        elif num_days <= 140:
            df['x_label'] = gen_daily_ticks(df)
        elif num_days <= 365 * 2:
            # tick monthly
            df['x_label'] = (
                get_year_week_in_df_column(df[TIME_COL])
                + '<br>'
                + df[TIME_COL].dt.month.astype(str).str.pad(2, fillchar='0')
                + '-01'
            )
        else:
            # tick yearly
            df['x_label'] = get_year_week_in_df_column(df[TIME_COL]) + '<br>01-01'

    time_fmt = '%Y-%m-%d %a %H:%M'
    df['from'] = 'From: ' + df[TIME_COL].dt.strftime(time_fmt) + '<br>'
    unit = 'min' if hm_mode == 1 else 'h'
    df['to_temp'] = df[TIME_COL] + pd.to_timedelta(hm_step, unit=unit)
    df.loc[df['to_temp'].astype(str).str[11:16] == '00:00', 'to'] = (
        df['to_temp'].astype(str).str[:8] + df[TIME_COL].dt.strftime('%d %a ') + '24:00'
    )
    df.loc[df['to_temp'].astype(str).str[11:16] != '00:00', 'to'] = df['to_temp'].dt.strftime(
        time_fmt
    )
    df['to'] = 'To: ' + df['to'] + '<br>'

    return df


@log_execution_time()
@abort_process_handler()
def build_dic_col_func(dic_proc_cfgs: Dict[int, CfgProcess], graph_param: DicParam):
    """Each column needs an aggregate function"""
    dic_col_func = dict()
    for proc_id, proc_config in dic_proc_cfgs.items():
        if graph_param.is_end_proc(proc_id):
            dic_col_func[proc_id] = dict()
            end_col_ids = [
                col
                for col in graph_param.get_sensor_cols(proc_id)
                if col in graph_param.common.sensor_cols
            ]
            end_cols = proc_config.get_cols(end_col_ids)
            for end_col in end_cols:
                if DataType[end_col.data_type] in [DataType.REAL, DataType.DATETIME]:
                    hm_function = HMFunction[graph_param.common.hm_function_real]
                else:
                    hm_function = HMFunction[graph_param.common.hm_function_cate]
                dic_col_func[proc_id][end_col.id] = hm_function
    return dic_col_func


# @log_execution_time()
# @abort_process_handler()
# def get_batch_data(proc_cfg: CfgProcess, graph_param: DicParam, start_tm, end_tm,
#                    sql_limit=None, _use_expired_cache=False) -> pd.DataFrame:
#     """ Query data for each batch. """
#     batches = generate_batches(start_tm, end_tm, batch_size=7)
#     num_batches = len(batches)
#
#     result = []
#     proc_ids = get_proc_ids_in_dic_param(graph_param)
#     for idx, (batch_start_tm, batch_end_tm) in enumerate(batches):
#         if len(proc_ids) == 1:
#             df_batch = graph_one_proc(proc_cfg.id, batch_start_tm, batch_end_tm,
#                                       graph_param.common.cond_procs, graph_param.array_formval, sql_limit,
#                                       same_proc_only=False)
#         else:
#             df_batch, _ = graph_many_proc(graph_param.common.start_proc, batch_start_tm, batch_end_tm,
#                                           graph_param.common.cond_procs, graph_param.array_formval, sql_limit)
#         df_batch = validate_data(df_batch)
#
#         # to report progress
#         progress = idx / num_batches
#
#         result.append((progress, df_batch))
#
#     return result


def gen_empty_df(
    end_col_id,
    var_agg_cols,
):
    new_df = pd.DataFrame({TIME_COL: [], AGG_COL: [], end_col_id: []})
    if var_agg_cols:
        for col in var_agg_cols:
            new_df[col] = []
    return new_df


@log_execution_time()
@abort_process_handler()
def gen_df_end_col(df_batch, end_col, var_agg_cols):
    """Use separate data frame for each column"""
    end_col_label = gen_sql_label(end_col.id, end_col.column_name)
    if var_agg_cols:
        df_end_col = df_batch[[TIME_COL, AGG_COL, *var_agg_cols, end_col_label]]
        for col in var_agg_cols:
            df_end_col[col] = df_end_col[col].astype(str)
    else:
        df_end_col = df_batch[[TIME_COL, AGG_COL, end_col_label]]

    if var_agg_cols and end_col_label in var_agg_cols:
        c_id = list(df_end_col.columns).index(end_col_label)
        df_end_col.columns.values[c_id] = end_col.id
    else:
        df_end_col = df_end_col.rename({end_col_label: end_col.id}, axis=1)
    return df_end_col


def gen_agg_col_names(var_agg_cols):
    """If use stratify variable -> aggregate by [stratify variable, time], otherwise, aggregate by time."""
    if var_agg_cols:
        return list({*var_agg_cols, AGG_COL})
    else:
        return [AGG_COL]


@log_execution_time()
@abort_process_handler()
def graph_heatmap_data_one_proc(
    df, proc_cfg: CfgProcess, graph_param: DicParam, dic_col_func, var_agg_cols, agg_cols
):
    """Build heatmap data for all columns of each process"""

    # start proc
    proc_id = proc_cfg.id

    # get end cols
    end_col_ids = [
        col for col in graph_param.get_sensor_cols(proc_id) if col in graph_param.common.sensor_cols
    ]
    end_cols = proc_cfg.get_cols(end_col_ids)

    dic_df_col = {}
    if df is None or df.empty:
        for end_col in end_cols:
            df_end_col = gen_empty_df(end_col.id, var_agg_cols)
            dic_df_col[end_col.id] = df_end_col
    else:
        # transform + aggregate
        for end_col in end_cols:
            df_end_col = gen_df_end_col(df, end_col, var_agg_cols)
            hm_function = dic_col_func[proc_id][end_col.id]
            df_end_col = gen_heat_map_cell_value(
                df_end_col, graph_param, agg_cols, end_col.id, hm_function
            )
            dic_df_col[end_col.id] = df_end_col

    # dic_df_col = apply_significant_digit(dic_df_col)

    return dic_df_col


@log_execution_time()
def concat_unique_categories(dic_filter_results, cat_exp_box):
    for i in range(0, len(dic_filter_results[CAT_EXP_BOX])):
        unique_cat = []
        for cat in cat_exp_box:
            unique_cat += cat[i][UNIQUE_CATEGORIES]

        dic_filter_results[CAT_EXP_BOX][i][UNIQUE_CATEGORIES] = set(unique_cat)

    return dic_filter_results


def range_func(x):
    return np.max(x) - np.min(x)


def convert_to_pandas_step(hm_step, hm_mode):
    """Pandas steps are: 4h, 15min, ..."""
    if hm_mode == 7:
        return '{}h'.format(hm_step)
    return '{}min'.format(hm_step)


@log_execution_time()
@abort_process_handler()
def create_agg_column(df, pd_step='4h', agg_col=AGG_COL, hm_mode=7, client_tz=tz.tzutc()):
    """Create aggregate column data"""
    if hm_mode == 7:
        length = 13
    else:
        length = 16
    temp = pd.to_datetime(df[TIME_COL], format='%Y-%m-%dT%H:%M', utc=True).dt.tz_convert(
        tz=client_tz
    )
    df[agg_col] = temp.dt.floor(pd_step).astype(str).str[:length]
    return df


@log_execution_time()
def agg_func_with_na(group_data, func_name):
    agg_func = {
        HMFunction.median.name: group_data.median,
        HMFunction.mean.name: group_data.mean,
        HMFunction.std.name: group_data.std,
    }
    return agg_func[func_name](skipna=True)


@log_execution_time()
@abort_process_handler()
def groupby_and_aggregate(
    df: pd.DataFrame, hm_function: HMFunction, hm_mode, hm_step, agg_cols, end_col
):
    """Group by time and calculate aggregates"""
    if df.empty:
        return df

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
        df = df.dropna()
        agg_params = {end_col: iqr, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
    elif hm_function is HMFunction.time_per_count:
        agg_params = {end_col: HMFunction.count.name, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()
        step_time = (hm_step * 60) if hm_mode == 1 else (hm_step * 3600)
        df[end_col] = step_time / df[end_col]
    else:
        if hm_function.name not in CHM_AGG_FUNC:
            agg_func = hm_function.name
        else:
            agg_func = lambda x: agg_func_with_na(x, hm_function.name)
        agg_params = {end_col: agg_func, TIME_COL: HMFunction.first.name}
        df = df.groupby(agg_cols).agg(agg_params).reset_index()

        # # This code below has bug because df[end_col].dtypes == 'object'
        # agg_params = {end_col: hm_function.name, TIME_COL: HMFunction.first.name}
        # df = df.groupby(agg_cols).agg(agg_params, numeric_only=False).reset_index()
    return df


@log_execution_time()
@abort_process_handler()
def gen_heat_map_cell_value(
    df: pd.DataFrame, graph_param: DicParam, agg_cols, end_col, hm_function: HMFunction
):
    """Value z for each cell (x,y)"""
    hm_mode = int(graph_param.common.hm_mode)
    hm_step = int(graph_param.common.hm_step)

    # drop na
    if 'count' not in hm_function.name:
        df = df.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).dropna()

    # groupby + aggregate
    df = groupby_and_aggregate(df, hm_function, hm_mode, hm_step, agg_cols, end_col)

    return df


@log_execution_time()
@abort_process_handler()
def generate_batches(start_tm, end_tm, batch_size=7):
    """Divide [start_time, end_time] to small batches. Default 7 days for each batch."""
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


def gen_heatmap_data_as_dict(
    graph_param,
    dic_param,
    dic_proc_cfgs,
    dic_cat_filters={},
    cat_exp=[],
    cat_procs=[],
    use_expired_cache=False,
):
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
    if not df_cells.empty:
        df_cells[TIME_COL] = pd.to_datetime(df_cells[TIME_COL], utc=True).dt.tz_convert(
            tz=client_tz
        )
    df_cells = gen_agg_col(df_cells, hm_mode, hm_step)

    # limit to 10000 cells
    dic_param.update({ACT_CELLS: df_cells.index.size})
    df_cells, end_tm = limit_num_cells(df_cells, end_tm, client_tz)

    # generate x, y, x_label, y_label
    df_cells = gen_x_y(df_cells, hm_mode, hm_step, start_tm, end_tm)

    # build dic col->function
    dic_col_func = build_dic_col_func(dic_proc_cfgs, graph_param)

    # get stratified variable
    cfg_facet_cols = graph_param.get_facet_var_cols_name()
    var_agg_cols = None
    if cfg_facet_cols:
        var_agg_cols = [
            gen_sql_label(cfg_col.id, cfg_col.column_name) for cfg_col in cfg_facet_cols
        ]

    # get sensor data from db
    df, actual_record_number, unique_serial = get_data_from_db(
        graph_param, dic_cat_filters, use_expired_cache=use_expired_cache
    )

    # filter by cat
    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param, True)

    export_df = df.copy()

    # convert datetime columns to CT
    convert_datetime_to_ct(df, graph_param)
    target_var_data = get_target_variable_data_from_df(df, dic_proc_cfgs, graph_param)
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
    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[UNIQUE_SERIAL] = unique_serial
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    # gen aggregate end col
    pd_step = convert_to_pandas_step(hm_step, hm_mode)
    df: pd.DataFrame = create_agg_column(df, pd_step, AGG_COL, hm_mode, client_tz)
    agg_cols = gen_agg_col_names(var_agg_cols)  # move

    dic_df_proc = {}
    num_proc = len(dic_proc_cfgs.keys()) or 1
    for idx, (proc_id, proc_config) in enumerate(dic_proc_cfgs.items()):
        pct_start = (idx + 1) * 50 / num_proc  # to report progress
        background_announcer.announce(pct_start, AnnounceEvent.SHOW_GRAPH.name)
        if graph_param.is_end_proc(proc_id):
            dic_df_proc[proc_id] = graph_heatmap_data_one_proc(
                df, proc_config, graph_param, dic_col_func, var_agg_cols, agg_cols
            )

    # fill empty cells
    dic_df_proc = fill_empty_cells(df_cells, dic_df_proc, var_agg_cols)

    return (
        dic_df_proc,
        hm_mode,
        hm_step,
        dic_col_func,
        df_cells,
        var_agg_cols,
        target_var_data,
        export_df,
    )


@log_execution_time()
def get_target_variable_data_from_df(df, dic_proc_cfgs, graph_param, cat_only=True):
    target_data = []
    target_vars = graph_param.get_all_target_cols()
    col_labels = [gen_sql_label(col['end_col_id'], col['end_col_name']) for col in target_vars]
    # return df[col_labels]

    for i, variable in enumerate(target_vars):
        col_label = col_labels[i]
        variable['array_y'] = df[col_label].to_list()
        variable['end_proc_name'] = dic_proc_cfgs[variable['end_proc_id']].name
        if cat_only:
            int_cols = dic_proc_cfgs[variable['end_proc_id']].get_cols_by_data_type(
                DataType.INTEGER, True
            )
            text_cols = dic_proc_cfgs[variable['end_proc_id']].get_cols_by_data_type(
                DataType.TEXT, True
            )
            cat_cols = int_cols + text_cols
            if variable['end_col_name'] in cat_cols:
                target_data.append(variable)
        else:
            # get all variable data
            target_data.append(variable)
    return target_data


def gen_plot_df(df, transform_target_sensor_name, transform_facets_name=None):
    export_columns = ['time_cell', 'to_temp', 'dayofweek'] + list(
        transform_target_sensor_name.keys()
    )
    transform_cols = dict({'time_cell': 'From', 'to_temp': 'To', 'dayofweek': 'Day'})
    transform_cols.update(transform_target_sensor_name)
    if transform_facets_name:
        export_columns += list(transform_facets_name.keys())
        transform_cols.update(transform_facets_name)

    sub_df = df[export_columns]
    sub_df.rename(columns=transform_cols, inplace=True)
    return sub_df


def gen_sub_df_from_heatmap(
    heatmap_data, dic_params, dic_proc_cfgs, dic_col_func, delimiter, client_timezone
):
    csv_dat = []
    csv_list_name = []
    file_type = '.csv' if delimiter == ',' else 'tsv'
    # get facets
    transform_facets_name = {}
    facet_ids = []
    for facet in dic_params['catExpBox']:
        facet_label = gen_sql_label(facet['column_id'], facet['column_name'])
        export_facet_name = '{}|{}'.format(facet['proc_master_name'], facet['column_name'])
        transform_facets_name[facet_label] = export_facet_name
        facet_ids.append(facet['column_id'])

    for proc_id, proc_dat in heatmap_data.items():
        proc_name = dic_proc_cfgs[proc_id].name
        for sensor_id, sensor_dat in proc_dat.items():
            if sensor_id not in facet_ids:
                # target sensor only
                sensor_obj = dic_proc_cfgs[proc_id].get_cols([sensor_id])
                aggregate_func = dic_col_func[proc_id][sensor_id].name
                export_name = '{}|{}|{}'.format(
                    proc_name, sensor_obj[0].column_name, aggregate_func
                )
                transform_target_sensor_name = {sensor_id: export_name}
                if isinstance(sensor_dat, dict) or len(facet_ids) != 0:
                    # has facets
                    for group, plot_dat in sensor_dat.items():
                        sub_df_dat = gen_plot_df(
                            plot_dat, transform_target_sensor_name, transform_facets_name
                        )

                        if client_timezone:
                            sub_df_dat['From'] = (
                                pd.to_datetime(sub_df_dat['From'], format=DATE_FORMAT_STR, utc=True)
                                .dt.tz_convert(client_timezone)
                                .dt.strftime(DATE_FORMAT_STR_CSV)
                            )
                            sub_df_dat['To'] = (
                                pd.to_datetime(sub_df_dat['To'], format=DATE_FORMAT_STR, utc=True)
                                .dt.tz_convert(client_timezone)
                                .dt.strftime(DATE_FORMAT_STR_CSV)
                            )
                        sub_df_dat = sub_df_dat.to_csv(sep=delimiter, index=False)
                        csv_dat.append(sub_df_dat)

                        group_name = '_'.join(group) if isinstance(group, tuple) else group
                        file_name = '{}_{}_{}.{}'.format(
                            proc_name, sensor_obj[0].column_name, group_name, file_type
                        )
                        csv_list_name.append(file_name)
                else:
                    # no facet
                    sub_df_dat = gen_plot_df(sensor_dat, transform_target_sensor_name)
                    if client_timezone:
                        sub_df_dat['From'] = (
                            pd.to_datetime(sub_df_dat['From'], format=DATE_FORMAT_STR, utc=True)
                            .dt.tz_convert(client_timezone)
                            .dt.strftime(DATE_FORMAT_STR_CSV)
                        )
                        sub_df_dat['To'] = (
                            pd.to_datetime(sub_df_dat['To'], format=DATE_FORMAT_STR, utc=True)
                            .dt.tz_convert(client_timezone)
                            .dt.strftime(DATE_FORMAT_STR_CSV)
                        )
                    sub_df_dat = sub_df_dat.to_csv(sep=delimiter, index=False)
                    csv_dat.append(sub_df_dat)

                    file_name = '{}_{}.{}'.format(proc_name, sensor_obj[0].column_name, file_type)
                    csv_list_name.append(file_name)

    return csv_dat, csv_list_name


def to_multiple_csv(data, delimiter=',', client_timezone=None):
    csv_data = []
    for df in data:
        csv_data.append(df.to_csv(sep=delimiter))
