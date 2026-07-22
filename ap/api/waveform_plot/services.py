from dataclasses import dataclass

import numpy as np
import pandas as pd

from ap import MaxGraphNumber, max_graph_config
from ap.api.common.services.show_graph_services import (
    calc_auto_scale_y,
    calc_setting_scale_y,
    calc_threshold_scale_y,
    customize_dic_param_for_reuse_cache,
    extend_min_max,
    filter_cat_dict_common,
    get_data_from_db,
    get_filter_on_demand_data,
    get_serial_and_datetime_data,
)
from ap.api.scatter_plot.services import get_v_keys_str
from ap.common.common_utils import gen_sql_label, get_x_y_info, select_between_color_and_temp_color
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_PLOTDATA,
    ARRAY_X,
    ARRAY_Y,
    AVAILABLE_COLORS,
    COL_DATA_TYPE,
    COLOR_NAME,
    COMMON,
    DATETIME,
    DIV,
    ELAPSED_TIME,
    END_COL_ID,
    JUDGE_COLOR,
    LOWER_OUTLIER_IDXS,
    SERIALS,
    START_PROC,
    THIN_DATA_CHUNK,
    TIME_COL,
    UPPER_OUTLIER_IDXS,
    X_NAME,
    Y_MAX,
    Y_MIN,
    Y_NAME,
    DataType,
    JudgeDisplay,
)
from ap.common.log import log_execution_time
from ap.common.memoize import OptionalCacheConfig
from ap.common.services.request_time_out_handler import abort_process_handler
from ap.common.sigificant_digit import get_fmt_from_array
from ap.conversion_formula import JudgeFormula
from ap.trace_data.schemas import DicParam

DATA_COUNT_COL = '__data_count_col__'
MATRIX = 7
SCATTER_PLOT_TOTAL_POINT = 50_000
SCATTER_PLOT_MAX_POINT = 10_000
HEATMAP_COL_ROW = 100
TOTAL_VIOLIN_PLOT = 200
__NONE__ = '__NONE__'


@log_execution_time()
@abort_process_handler()
def gen_graph_for_waveform_plot(
    graph_param: DicParam,
    dic_param,
    df=None,
):
    # for caching
    (
        dic_param,
        cat_exp,
        _,
        dic_cat_filters,
        use_expired_cache,
        temp_serial_column,
        temp_serial_order,
        *_,
        temp_color_var,
        matrix_col,
        color_order,
    ) = customize_dic_param_for_reuse_cache(dic_param)
    matrix_col = matrix_col if matrix_col else MATRIX

    xy_ids, xy_names, *_ = get_x_y_info(graph_param, dic_param[COMMON])

    x_id = xy_ids[0]
    y_id = xy_ids[-1]
    x_name = xy_names[0]
    y_name = xy_names[-1]

    for target_var in graph_param.common.sensor_cols:
        col_info = graph_param.get_col_info_by_id(target_var)
        if col_info[COL_DATA_TYPE] == DataType.DATETIME.name and col_info[END_COL_ID] != x_id:
            x_id, y_id = y_id, x_id
            x_name, y_name = y_name, x_name

    x_label = gen_sql_label(x_id, x_name)
    y_label = gen_sql_label(y_id, y_name)
    if len(xy_ids) == 1:
        x_label = TIME_COL

    color_id = select_between_color_and_temp_color(temp_color_var, graph_param)
    cat_div_id = graph_param.common.div_by_cat
    level_ids = graph_param.common.cat_exp

    col_ids = [col for col in list({x_id, y_id, color_id, cat_div_id, *level_ids}) if col]
    dic_cols = {cfg_col.id: cfg_col for cfg_col in graph_param.get_col_cfgs(col_ids)}

    color_label = gen_sql_label(color_id, dic_cols[color_id].column_name) if color_id else None
    level_labels = [gen_sql_label(id, dic_cols[id].column_name) for id in level_ids]
    cat_div_label = gen_sql_label(cat_div_id, dic_cols[cat_div_id].column_name) if cat_div_id else None

    graph_param.add_column_to_array_formval([graph_param.common.color_var, graph_param.common.div_by_cat])

    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(
        graph_param=graph_param,
        dic_filter=dic_cat_filters,
        optional_cache_config=OptionalCacheConfig(use_expired_cache=use_expired_cache),
    )

    # dic_data, is_thin_data = gen_waveform_plot_plotdata(
    #     matrix_col, df, x_label, y_label, cat_div_label, color_label, level_labels
    # )

    dic_data = gen_waveform_plot_plotdata(matrix_col, df, x_label, y_label, cat_div_label, color_label, level_labels)
    dic_param[ARRAY_PLOTDATA] = dic_data
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
    dic_param[X_NAME] = dic_cols[x_id].shown_name if x_id else None
    dic_param[Y_NAME] = dic_cols[y_id].shown_name if y_id else None
    dic_param['x_fmt'] = get_fmt_from_array(df[x_label].tolist())
    dic_param['y_fmt'] = get_fmt_from_array(df[y_label].tolist())
    # dic_param[IS_THIN_DATA] = is_thin_data
    if color_id and dic_cols[color_id].is_judge:
        formula = JudgeFormula.from_formula(dic_cols[color_id].formula)
        # handle color for judge
        dic_param[JUDGE_COLOR] = {
            formula.positive_display: JudgeDisplay.POSITIVE.name,
            formula.negative_display: JudgeDisplay.NEGATIVE.name,
        }

    if len(xy_ids) == 1:
        dic_param[X_NAME] = ELAPSED_TIME
    dic_param[COLOR_NAME] = dic_cols[color_id].shown_name if color_id else None
    dic_param['div_name'] = dic_cols[cat_div_id].shown_name if cat_div_id else None

    serial_data, datetime_data, start_proc_name = get_serial_and_datetime_data(
        df,
        graph_param,
        graph_param.dic_proc_cfgs,
    )
    dic_param[SERIALS] = serial_data
    dic_param[DATETIME] = datetime_data
    dic_param[START_PROC] = start_proc_name
    dic_param[AVAILABLE_COLORS] = [
        {'id': col_id, 'column_name': graph_param.get_col_cfg(col_id).shown_name}
        for col_id in graph_param.common.available_colors_id
    ]

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, [], graph_param, False, [], True)
    dic_param = get_filter_on_demand_data(dic_param)
    return dic_param


@dataclass
class WaveformArrayPlotData:
    """Data container for waveform plot visualization.

    This dataclass holds all the necessary data for rendering waveform plots,
    including color mappings, scale information for different display modes,
    and vertical labels.

    Attributes:
        color: Dictionary mapping color keys to plot data entries.
        scale_auto: Auto-calculated scale information for Y-axis.
        scale_common: Common scale information across all graphs.
        scale_full: Full scale information for the current graph.
        scale_setting: User-defined scale settings.
        scale_threshold: Threshold-based scale information.
        v_label: Vertical label for the plot.

    Generated by Duo
    """

    color: dict
    scale_auto: dict
    scale_common: dict
    scale_full: dict
    scale_setting: dict
    scale_threshold: dict
    v_label: str


@log_execution_time()
def gen_waveform_plot_plotdata(
    matrix_col: int,
    df: pd.DataFrame,
    x_label,
    y_label,
    cat_div_col_label=None,
    color_col_label=None,
    levels=None,
):
    df = drop_missing_data(df, [x_label, y_label, cat_div_col_label, color_col_label, *levels])

    # if x label is numeric then sort by x_label
    # (for duckdb it auto sort by dt so need to re-order by sort by x_label)
    if pd.api.types.is_numeric_dtype(df[x_label]):
        df = df.sort_values(by=x_label)

    # is_thin_data = len(df) > THIN_DATA_COUNT
    h_group_cols = []
    h_group_cols += [color_col_label] if color_col_label else []
    h_group_cols += [cat_div_col_label] if cat_div_col_label else []

    f_group_cols = [col for col in levels if col and col not in h_group_cols]

    max_graph = matrix_col if f_group_cols else max_graph_config[MaxGraphNumber.SCP_MAX_GRAPH.name]
    # group by facet
    dic_groups = group_by_df(df, f_group_cols, max_graph)

    all_graph_min = df[y_label].min()
    all_graph_max = df[y_label].max()
    dic_data = []
    for f_keys, _df_data in dic_groups.items():
        data = WaveformArrayPlotData(
            color={},
            scale_auto={},
            scale_common={},
            scale_full={},
            scale_setting={},
            scale_threshold={},
            v_label='',
        )
        f_keys_str = get_v_keys_str(f_keys)
        y_min = _df_data[y_label].min()
        y_max = _df_data[y_label].max()

        df_data = _df_data
        # if is_thin_data:
        #     df_data = reduce_data(_df_data, y_label, x_label, cat_div_col_label)
        df_data = df_data.set_index(h_group_cols)

        df_data = df_data.groupby(cat_div_col_label, group_keys=False).apply(
            lambda group: gen_elapsed_time_data(group, x_label),
            include_groups=False,
        )

        data.v_label = f_keys_str
        data.scale_setting = calc_setting_scale_y({}, _df_data[y_label])
        data.scale_auto = calc_auto_scale_y({}, _df_data[y_label])
        data.scale_threshold = calc_threshold_scale_y({}, _df_data[y_label])
        data.scale_common = calc_scale_info(all_graph_min, all_graph_max)
        data.scale_full = calc_scale_info(y_min, y_max)

        df_data = df_data.groupby(h_group_cols, group_keys=False).agg(list)
        for k in df_data.index:
            is_tuple = isinstance(k, tuple)
            if is_tuple:
                color_key = k[0] if color_col_label else __NONE__
                div = str(k[-1])
            else:
                color_key = str(k) if color_col_label else __NONE__
                div = str(k)
            entry = {
                ARRAY_X: df_data.loc[k][x_label] if x_label != color_col_label else [color_key],
                ARRAY_Y: df_data.loc[k][y_label] if y_label != color_col_label else [color_key],
                DIV: div,
            }

            if color_key in data.color:
                data.color[color_key].append(entry)
            else:
                data.color[color_key] = [entry]

        dic_data.append(data)
    return dic_data


def gen_elapsed_time_data(df: pd.DataFrame, label: str):
    if label in df.columns and not pd.api.types.is_numeric_dtype(df[label]):
        df[label] = pd.to_datetime(df[label])
        df[label] = (df[label] - df[label].iloc[0]).dt.total_seconds()
    return df


@log_execution_time()
def drop_missing_data(df: pd.DataFrame, cols):
    if df is not None and len(df):
        df = df.dropna(subset=[col for col in cols if col]).convert_dtypes()
    return df


@log_execution_time()
@abort_process_handler()
def group_by_df(
    df: pd.DataFrame,
    cols,
    max_group=None,
    max_record_per_group=None,
    sort_key_func=None,
    reverse=True,
    get_from_last=None,
):
    dic_groups = {}
    if df is None or not len(df):
        return dic_groups

    if not cols:
        dic_groups[__NONE__] = df.head(max_record_per_group)
        return dic_groups

    if len(cols) == 1:
        cols = cols[0]
    df_groups = df.groupby(cols)
    max_group = max_group or len(df_groups.groups)

    # sort desc
    if sort_key_func:

        def sort_func(x):
            return sort_key_func(x[0])

    else:
        all_numeric = all(str(key).isnumeric() for key, df_group in df_groups)
        sort_func = (lambda x: int(x[0])) if all_numeric else lambda x: str(x[0])

    groups = sorted(df_groups, key=sort_func, reverse=reverse)
    groups = groups[:max_group]
    if get_from_last:
        groups.reverse()

    for key, df_group in groups:
        dic_groups[key] = df_group.head(max_record_per_group)

    return dic_groups


@log_execution_time()
def calc_scale_info(
    y_min,
    y_max,
):
    y_min, y_max = extend_min_max(y_min, y_max)

    dic_base_scale = {
        Y_MIN: y_min,
        Y_MAX: y_max,
        LOWER_OUTLIER_IDXS: [],
        UPPER_OUTLIER_IDXS: [],
    }

    return dic_base_scale


@log_execution_time()
def reduce_data(df: pd.DataFrame, y_label, x_label, cat_label) -> pd.DataFrame:
    # --- Per-category rank ---
    df['rank'] = df.groupby(cat_label).cumcount()

    # --- Per-category size ---
    group_sizes = df.groupby(cat_label)[x_label].transform('size')

    # --- Compute count_per_group PER CATEGORY ---
    # ceil(size / THIN_DATA_CHUNK)
    count_per_group = np.ceil(group_sizes / THIN_DATA_CHUNK)

    # Avoid division issues
    count_per_group = count_per_group.replace(0, 1)

    # --- Assign chunk group within each category ---
    df['group'] = (df['rank'] / count_per_group).astype(int)

    group_cols = [cat_label, 'group']

    # --- Stats ---
    # Group the data once
    grouped = df.groupby(group_cols)[y_label]

    # Use built-in methods instead of lambdas
    stats = grouped.agg(['median', 'max', 'min']).rename(columns={'median': 'p50', 'max': 'y_max', 'min': 'y_min'})

    # Calculate quantiles separately (Pandas handles this much faster than lambda)
    stats['p25'] = grouped.quantile(0.25)
    stats['p75'] = grouped.quantile(0.75)

    # Clean up the index
    stats = stats.reset_index()

    # --- Thresholds ---
    stats['high_threshold'] = stats['p50'] + 2.5 * (stats['p75'] - stats['p50'])
    stats['low_threshold'] = stats['p50'] - 2.5 * (stats['p50'] - stats['p25'])

    stats['max_exceeds'] = stats['y_max'] > stats['high_threshold']
    stats['min_exceeds'] = stats['y_min'] < stats['low_threshold']

    stats['dist_max'] = stats['y_max'] - stats['p50']
    stats['dist_min'] = stats['p50'] - stats['y_min']

    # --- Merge ---
    df = df.merge(stats, on=group_cols, how='left')

    # --- Conditions ---
    cond_both = df['max_exceeds'] & df['min_exceeds']
    cond_max = df['max_exceeds'] & ~df['min_exceeds']
    cond_min = df['min_exceeds'] & ~df['max_exceeds']
    cond_no_exceed = ~df['max_exceeds'] & ~df['min_exceeds']

    mask = (
        (
            cond_both
            & (
                ((df['dist_max'] > df['dist_min']) & (df[y_label] == df['y_max']))
                | ((df['dist_max'] <= df['dist_min']) & (df[y_label] == df['y_min']))
            )
        )
        | (cond_max & (df[y_label] == df['y_max']))
        | (cond_min & (df[y_label] == df['y_min']))
        | (cond_no_exceed & (df[y_label] == df['p50']))
    )

    selected = df[mask]

    # --- Combine ---
    result = selected.drop_duplicates(group_cols)

    return result.drop(
        columns=[
            'rank',
            'p25',
            'p50',
            'p75',
            'y_max',
            'y_min',
            'high_threshold',
            'low_threshold',
            'max_exceeds',
            'min_exceeds',
            'dist_max',
            'dist_min',
        ]
    ).reset_index(drop=True)
