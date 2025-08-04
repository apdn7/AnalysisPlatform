from dataclasses import dataclass

import pandas as pd

from ap import MaxGraphNumber, log_execution_time, max_graph_config
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
from ap.common.common_utils import gen_sql_label, get_x_y_info
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_PLOTDATA,
    ARRAY_X,
    ARRAY_Y,
    COLOR_NAME,
    COMMON,
    DATETIME,
    DIV,
    ELAPSED_TIME,
    LOWER_OUTLIER_IDXS,
    SERIALS,
    START_PROC,
    TIME_COL,
    UPPER_OUTLIER_IDXS,
    X_NAME,
    Y_MAX,
    Y_MIN,
    Y_NAME,
)
from ap.common.memoize import OptionalCacheConfig
from ap.common.services.request_time_out_handler import abort_process_handler
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
def gen_graph_for_time_vis(
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
        matrix_col,
        color_order,
    ) = customize_dic_param_for_reuse_cache(dic_param)
    matrix_col = matrix_col if matrix_col else MATRIX

    xy_ids, xy_names, *_ = get_x_y_info(graph_param.array_formval, dic_param[COMMON])

    x_id = xy_ids[0]
    y_id = xy_ids[-1]
    x_name = xy_names[0]
    y_name = xy_names[-1]
    x_label = gen_sql_label(x_id, x_name)
    y_label = gen_sql_label(y_id, y_name)
    if len(xy_ids) == 1:
        x_label = TIME_COL

    color_id = graph_param.common.color_var
    cat_div_id = graph_param.common.div_by_cat
    level_ids = graph_param.common.cat_exp

    col_ids = [col for col in list(set([x_id, y_id, color_id, cat_div_id] + level_ids)) if col]
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

    dic_data = gen_time_vis_plotdata(matrix_col, df, x_label, y_label, cat_div_label, color_label, level_labels)

    dic_param[ARRAY_PLOTDATA] = dic_data
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
    dic_param[X_NAME] = dic_cols[x_id].shown_name if x_id else None
    dic_param[Y_NAME] = dic_cols[y_id].shown_name if y_id else None
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

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, [], graph_param, False, [], True)
    dic_param = get_filter_on_demand_data(dic_param)
    return dic_param


@dataclass
class TimeVisArrayPlotData:
    color: dict
    scale_auto: dict
    scale_common: dict
    scale_full: dict
    scale_setting: dict
    scale_threshold: dict
    v_label: str


@log_execution_time()
def gen_time_vis_plotdata(
    matrix_col: int,
    df: pd.DataFrame,
    x_label,
    y_label,
    cat_div_col_label=None,
    color_col_label=None,
    levels=None,
):
    df = drop_missing_data(df, [x_label, y_label, cat_div_col_label, color_col_label] + levels)
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
    for f_keys, df_data_ in dic_groups.items():
        data = TimeVisArrayPlotData(
            color={},
            scale_auto={},
            scale_common={},
            scale_full={},
            scale_setting={},
            scale_threshold={},
            v_label='',
        )
        f_keys_str = get_v_keys_str(f_keys)
        df_data = df_data_.set_index(h_group_cols)

        y_min = df_data_[y_label].min()
        y_max = df_data_[y_label].max()

        data.v_label = f_keys_str
        data.scale_setting = calc_setting_scale_y({}, df_data_[y_label])
        data.scale_auto = calc_auto_scale_y({}, df_data_[y_label])
        data.scale_threshold = calc_threshold_scale_y({}, df_data_[y_label])
        data.scale_common = calc_scale_info(all_graph_min, all_graph_max)
        data.scale_full = calc_scale_info(y_min, y_max)

        df_data = df_data.groupby(cat_div_col_label, group_keys=False).apply(
            lambda group: gen_elapsed_time_data(group, x_label),
            include_groups=False,
        )
        df_data = df_data.groupby(h_group_cols, group_keys=False).agg(list)
        for k in df_data.index:
            is_tuple = isinstance(k, tuple)
            key = str(k[0]) if is_tuple else __NONE__
            div = str(k[1] if is_tuple else k)
            entry = {
                ARRAY_X: df_data.loc[k][x_label],
                ARRAY_Y: df_data.loc[k][y_label],
                DIV: div,
            }

            if key in data.color:
                data.color[key].append(entry)
            else:
                data.color[key] = [entry]

        dic_data.append(data)
    return dic_data


def gen_elapsed_time_data(df: pd.DataFrame, x_label: str):
    if not pd.api.types.is_numeric_dtype(df[x_label]):
        df[x_label] = pd.to_datetime(df[x_label])
        df[x_label] = (df[x_label] - df[x_label].iloc[0]).dt.total_seconds()
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
