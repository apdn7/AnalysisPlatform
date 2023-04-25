import copy
from datetime import timedelta
from typing import List, Optional, Dict, Any, Tuple

import pandas as pd
from dateutil.tz import tz
from pandas.core.groupby import DataFrameGroupBy
from scipy.stats import iqr

from ap.api.categorical_plot.services import gen_graph_param
from ap.api.heatmap.services import agg_func_with_na
from ap.api.heatmap.services import get_function_i18n, range_func
from ap.api.trace_data.services.time_series_chart import customize_dic_param_for_reuse_cache, get_data_from_db, \
    filter_cat_dict_common
from ap.common.common_utils import gen_sql_label
from ap.common.constants import ARRAY_PLOTDATA, HMFunction, ACTUAL_RECORD_NUMBER, UNIQUE_SERIAL, DIVIDE_FMT_COL, \
    COLOR_NAME, AGG_FUNC, DATA, COL_DATA_TYPE, DataType, CAT_EXP_BOX, COL_DETAIL_NAME, COL_TYPE, UNIQUE_DIV, FMT, \
    END_PROC_ID, END_COL_NAME
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.request_time_out_handler import abort_process_handler, request_timeout_handling
from ap.common.services.sse import notify_progress
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.timezone_utils import get_utc_offset
from ap.common.trace_data_log import TraceErrKey, EventType, EventAction, Target, trace_log
from ap.setting_module.models import CfgProcessColumn
from ap.trace_data.models import Cycle
from ap.trace_data.schemas import DicParam

CHM_AGG_FUNC = [HMFunction.median.name, HMFunction.mean.name, HMFunction.std.name]

# TODO: rename and move this to constant
OTHER_KEY = 'Other'
OTHER_COL = 'summarized_other_col'
MAX_ALLOW_GROUPS = 9


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@notify_progress(75)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.AGP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_agp_data(dic_param: DicParam):
    dic_param, cat_exp, cat_procs, dic_cat_filters, use_expired_cache, *_ = \
        customize_dic_param_for_reuse_cache(dic_param)

    # gen graph_param
    graph_param, dic_proc_cfgs = gen_graph_param(dic_param, with_ct_col=True)
    graph_param.add_agp_color_vars()

    df, actual_number_records, duplicated_serials = get_data_from_db(graph_param, dic_cat_filters,
                                                                     use_expired_cache=use_expired_cache)

    df, dic_param = filter_cat_dict_common(df, dic_param, dic_cat_filters, cat_exp, cat_procs, graph_param)
    df = convert_utc_to_local_time_and_offset(df, graph_param)

    graph_param: DicParam
    if graph_param.common.divide_format is not None:
        df = gen_divide_format_column(df, graph_param.common.divide_calendar_dates,
                                      graph_param.common.divide_calendar_labels)

    export_data = df

    dic_data = gen_agp_data_from_df(df, graph_param)
    dic_param[ARRAY_PLOTDATA] = dic_data
    dic_param[ACTUAL_RECORD_NUMBER] = actual_number_records
    dic_param[UNIQUE_SERIAL] = duplicated_serials

    return dic_param, export_data, graph_param, dic_proc_cfgs


@log_execution_time()
def gen_divide_format_column(df: pd.DataFrame, divide_calendar_dates: List[str],
                             divide_calendar_labels: List[str]) -> pd.DataFrame:
    df.sort_values(Cycle.time.key, inplace=True)
    dt = df[Cycle.time.key]
    df[DIVIDE_FMT_COL] = None
    divide_calendar_dates = pd.to_datetime(divide_calendar_dates, utc=True)
    for i, label in enumerate(divide_calendar_labels):
        start_time = divide_calendar_dates[i]
        end_time = divide_calendar_dates[i + 1]
        start_index, end_index = dt.searchsorted([start_time, end_time])
        df[start_index:end_index][DIVIDE_FMT_COL] = label
    return df


@log_execution_time()
def gen_agp_data_from_df(df: pd.DataFrame, graph_param: DicParam) -> List[Dict[Any, Any]]:
    plot_data = []
    target_vars = graph_param.common.sensor_cols

    # calculate cycle_time and replace target column
    for target_var in target_vars:
        # find proc_id from col info
        general_col_info = graph_param.get_col_info_by_id(target_var)
        # list out all CT column from this process
        dic_datetime_cols = {cfg_col.id: cfg_col for cfg_col in
                             CfgProcessColumn.get_by_data_type(general_col_info[END_PROC_ID], DataType.DATETIME)}
        sql_label = gen_sql_label(target_var, general_col_info[END_COL_NAME])
        if target_var in dic_datetime_cols:
            series = pd.to_datetime(df[sql_label])
            series.sort_values(inplace=True)
            series = series.diff().dt.total_seconds()
            series.sort_index(inplace=True)
            df.sort_index(inplace=True)
            df[sql_label] = series
            df[sql_label].convert_dtypes()

    # each target var be shown on one chart (barchart or line chart)
    for target_var in target_vars:
        general_col_info = graph_param.get_col_info_by_id(target_var)
        is_real_data = general_col_info[COL_DATA_TYPE] in [DataType.REAL.name, DataType.DATETIME.name]
        agg_func = graph_param.common.hm_function_real if is_real_data else HMFunction.count.name
        agg_func_show = get_function_i18n(agg_func)

        summarized_df, sorted_colors = summarize_redundant_groups_into_others(df, graph_param, target_var,
                                                                              MAX_ALLOW_GROUPS, OTHER_KEY, OTHER_COL)
        df_groupby = gen_groupby_from_target_var(summarized_df, graph_param, target_var, is_real_data)

        # get unique sorted div
        unique_div_vars = []
        div_col_name = get_div_col_name(graph_param)
        if div_col_name != DIVIDE_FMT_COL:
            unique_div_vars = sorted(df[div_col_name].dropna().unique())

        if general_col_info is None:
            continue

        color_show_name = graph_param.get_color_info(target_var, shown_name=True)

        agp_obj = {
            COLOR_NAME: color_show_name,
            AGG_FUNC: agg_func_show,
            DATA: [],
            CAT_EXP_BOX: [],
            UNIQUE_DIV: unique_div_vars,
            FMT: None,
        }
        general_col_info.update(agp_obj)

        if is_real_data:
            target_var_label = CfgProcessColumn.gen_label_from_col_id(target_var)
            agg_df = get_agg_lamda_func(df_groupby, target_var_label, agg_func)
        else:
            agg_df = df_groupby.count()

        num_facets = len(graph_param.common.cat_exp)

        # TODO refactor this
        if num_facets == 0:
            data = get_data_for_target_var_without_facets(agg_df, graph_param, is_real_data, target_var, sorted_colors)
            modified_agp_obj = {DATA: data, CAT_EXP_BOX: [], FMT: gen_ticks_format(data)}
            col_info = copy.deepcopy(general_col_info)
            col_info.update(modified_agp_obj)
            plot_data.append(col_info)

        elif num_facets == 1:

            # TODO: remove hard code level=0
            facets = agg_df.index.unique(level=0)
            for facet in facets:
                data = get_data_for_target_var_without_facets(agg_df.xs(facet), graph_param, is_real_data,
                                                              target_var, sorted_colors)
                modified_agp_obj = {
                    DATA: data,
                    CAT_EXP_BOX: [facet],
                    FMT: gen_ticks_format(data)
                }
                col_info = copy.deepcopy(general_col_info)
                col_info.update(modified_agp_obj)
                plot_data.append(col_info)

        else:
            # TODO: remove hard code level=0, level=1
            facets1 = agg_df.index.unique(level=0)
            facets2 = agg_df.index.unique(level=1)
            for facet1 in facets1:
                sub_df = agg_df.xs(facet1)
                for facet2 in facets2:
                    try:
                        sub_sub_df = sub_df.xs(facet2)
                        data = get_data_for_target_var_without_facets(sub_sub_df, graph_param, is_real_data,
                                                                      target_var, sorted_colors)
                    except KeyError:
                        data = []

                    modified_agp_obj = {
                        DATA: data,
                        CAT_EXP_BOX: [facet1, facet2],
                        FMT: gen_ticks_format(data)
                    }
                    col_info = copy.deepcopy(general_col_info)
                    col_info.update(modified_agp_obj)
                    plot_data.append(col_info)

    return plot_data


def get_div_col_name(graph_param: DicParam) -> str:
    """Get division column name
    Args:
        graph_param:
    Returns:
        Column name which we will use to groupby final result.
    """
    div_col_name = DIVIDE_FMT_COL
    if graph_param.common.divide_format is None:
        div_col_name = CfgProcessColumn.gen_label_from_col_id(graph_param.common.div_by_cat)
    return div_col_name


def get_color_col_name(graph_param: DicParam, target_var: int) -> Optional[str]:
    """Get color column name used to groupby from target variable
    """
    color_id = graph_param.get_color_id(target_var)
    color_col_name = CfgProcessColumn.gen_label_from_col_id(color_id)
    return color_col_name


@log_execution_time()
def need_add_other_col(df: pd.DataFrame, graph_param: DicParam, target_var: int, maximum_allowed_groups: int) -> bool:
    color_col_name = get_color_col_name(graph_param, target_var)
    if color_col_name is None:
        return False
    return df[color_col_name].nunique(dropna=True) > maximum_allowed_groups


# TODO: write test for this
@log_execution_time()
def summarize_redundant_groups_into_others(df: pd.DataFrame, graph_param: DicParam, target_var: int,
                                           maximum_allowed_groups: int, other_key: str, other_col: Optional[str]) -> \
        Tuple[pd.DataFrame, List[Any]]:
    """Summarize color value if total unique value of color columns exceed `maximum_allowed_groups`
    """
    color_col_name = get_color_col_name(graph_param, target_var)
    if color_col_name is None or other_col is None:
        return df, []
    df, sorted_colors = replace_redundant_groups_into_others(df, color_col_name, other_col, maximum_allowed_groups,
                                                             other_key)
    return df, sorted_colors


@log_execution_time()
def replace_redundant_groups_into_others(df: pd.DataFrame, column_name: str, new_column_name: str,
                                         maximum_allowed_groups: int, other_key: str) -> Tuple[pd.DataFrame, List[Any]]:
    """ Rename redundant value in `column_name` into `other_key`
    - We first sort value priority based on `value_counts`.
    - Every key have smaller `value_counts` should have lower priority
    """
    assert maximum_allowed_groups > 0

    color_counts = df[column_name].value_counts()
    counted_keys = color_counts.index.to_list()

    if maximum_allowed_groups >= len(counted_keys):
        counted_keys.reverse()
        return df, counted_keys

    non_redundant_groups = maximum_allowed_groups - 1
    df[new_column_name] = df[column_name].replace(to_replace=counted_keys[non_redundant_groups:], value=other_key)

    # form a new_keys, with OTHER_KEY always on tops
    sorted_keys = [other_key] + counted_keys[:non_redundant_groups]
    sorted_keys.reverse()

    return df, sorted_keys


@log_execution_time()
def get_data_for_target_var_without_facets(df: pd.DataFrame, graph_param: DicParam, is_real_data: bool,
                                           target_var: int, sorted_colors: List[Any]) -> List[Dict[Any, Any]]:
    chart_type = 'lines+markers' if is_real_data else 'bar'

    target_col = CfgProcessColumn.get_by_id(target_var)
    target_col_name = CfgProcessColumn.gen_label_from_col_id(target_var)

    color_id = graph_param.get_color_id(target_var)

    def gen_trace_data(sub_df: pd.DataFrame, col_name: str) -> Dict[str, Any]:
        trace_data = {
            'x': sub_df[target_col_name].index.tolist(),
            'y': list(sub_df[target_col_name].values),
            COL_DETAIL_NAME: col_name,
            COL_TYPE: chart_type,
        }
        if is_real_data:
            # TODO: set `mode` in constant
            trace_data['mode'] = chart_type
        return trace_data

    if color_id is None:
        plot_data = [gen_trace_data(df, target_col.name)]
    else:
        plot_data = []
        for color in sorted_colors:
            try:
                plot_data.append(gen_trace_data(df.xs(color), color))
            except KeyError:
                pass
    return plot_data


@log_execution_time()
def get_agg_cols(df: pd.DataFrame, graph_param: DicParam, target_var: int) -> List[str]:
    agg_cols = []

    facet_cols_name = [CfgProcessColumn.gen_label_from_col_id(col) for col in graph_param.common.cat_exp]
    facet_cols_name = filter(lambda x: x is not None, facet_cols_name)
    agg_cols.extend(facet_cols_name)

    color_col_name = get_color_col_name(graph_param, target_var)
    if color_col_name is not None:
        if need_add_other_col(df, graph_param, target_var, MAX_ALLOW_GROUPS):
            agg_cols.append(OTHER_COL)
        else:
            agg_cols.append(color_col_name)

    div_col_name = get_div_col_name(graph_param)
    agg_cols.append(div_col_name)

    return agg_cols


@log_execution_time()
def gen_groupby_from_target_var(df: pd.DataFrame, graph_param: DicParam,
                                target_var: int, is_real_data: bool) -> DataFrameGroupBy:
    agg_cols = get_agg_cols(df, graph_param, target_var)
    target_col_name = CfgProcessColumn.gen_label_from_col_id(target_var)
    # remove na before apply aggregate method for real variable only
    if is_real_data:
        df_groupby = df.dropna(subset=[target_col_name]).groupby(agg_cols)[[target_col_name]]
    else:
        # count, do not remove na
        df_groupby = df.groupby(agg_cols)[[target_col_name]]
    return df_groupby


@log_execution_time()
def convert_utc_to_local_time_and_offset(df, graph_param):
    client_timezone = graph_param.get_client_timezone()
    # divide_offset = graph_param.common.divide_offset or 0
    client_tz = tz.gettz(client_timezone or None) or tz.tzlocal()
    offset = get_utc_offset(client_tz)
    df[Cycle.time.key] = pd.to_datetime(df[Cycle.time.key]) + offset

    return df


@log_execution_time()
def get_agg_lamda_func(df: DataFrameGroupBy, target_var, agg_func_name) -> pd.DataFrame:
    if agg_func_name == HMFunction.std.name:
        agg_params = {target_var: lambda x: agg_func_with_na(x, agg_func_name)}
        agg_df = df.agg(agg_params)
    elif agg_func_name == HMFunction.iqr.name:
        # iqr
        agg_df = df.agg(func=iqr, nan_policy='omit')
    elif agg_func_name == HMFunction.range.name:
        agg_params = {target_var: range_func}
        agg_df = df.agg(agg_params)
    else:
        # median, mean, min, max
        agg_df = df.agg(func=agg_func_name, numeric_only=False)
    return agg_df


@log_execution_time()
def gen_ticks_format(data):
    if not len(data):
        return None

    # get fmt from first list of data instead of all data
    ticks_format = get_fmt_from_array(data[0]['y'])
    return ticks_format
