import copy
import uuid
from typing import Any, List, Optional

import pandas as pd
from dateutil.tz import tz
from pandas.core.groupby import DataFrameGroupBy
from scipy.stats import iqr

from ap.api.calendar_heatmap.services import agg_func_with_na, get_function_i18n, range_func
from ap.api.categorical_plot.services import (
    gen_dic_param_terms,
    gen_graph_param,
    gen_time_conditions,
    produce_cyclic_terms,
)
from ap.api.common.services.show_graph_services import (
    calc_raw_common_scale_y,
    calc_scale_info,
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_chart_infos,
    get_data_from_db,
    get_filter_on_demand_data,
    judge_data_conversion,
    set_chart_infos_to_plotdata,
)
from ap.api.scatter_plot.services import gen_df
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    AGG_FUNC,
    ARRAY_PLOTDATA,
    ARRAY_X,
    ARRAY_Y,
    CAT_EXP_BOX,
    COL_DATA_TYPE,
    COL_DETAIL_NAME,
    COL_TYPE,
    COLOR_COLUMN_TYPE,
    COLOR_NAME,
    COMMON,
    DATA,
    DIV_FROM_TO,
    DIVIDE_FMT_COL,
    END_COL_ID,
    END_DATE,
    END_DT,
    END_TM,
    FMT,
    IS_CATEGORY,
    IS_GRAPH_LIMITED,
    REMOVED_OUTLIERS,
    RL_CATEGORY,
    RL_DIRECT_TERM,
    START_DATE,
    START_DT,
    START_TM,
    TIME_COL,
    UNIQUE_COLOR,
    UNIQUE_DIV,
    UNIQUE_SERIAL,
    CacheType,
    DataType,
    HMFunction,
    X,
    Y,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.pandas_helper import append_series, assign_group_labels_for_dataframe
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import MessageAnnouncer
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.trace_data.schemas import DicParam

CHM_AGG_FUNC = [HMFunction.median.name, HMFunction.mean.name, HMFunction.std.name]

# TODO: rename and move this to constant
OTHER_KEY = 'Other'
OTHER_COL = 'summarized_other_col'
MAX_ALLOW_GROUPS = 9


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@MessageAnnouncer.notify_progress(75)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.AGP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def gen_agp_data(root_graph_param: DicParam, dic_param, df=None, max_graph=None):
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    # gen graph_param
    graph_param = gen_graph_param(root_graph_param, dic_param, with_ct_col=True)
    graph_param.add_agp_color_vars()

    if df is None:
        if graph_param.common.compare_type == RL_DIRECT_TERM:
            # direct term
            df, actual_number_records, duplicated_serials = gen_df_direct_term(
                graph_param,
                dic_param,
                dic_cat_filters,
                use_expired_cache,
            )
        else:
            df, actual_number_records, duplicated_serials = get_data_from_db(
                graph_param,
                dic_cat_filters,
                use_expired_cache=use_expired_cache,
            )

        dic_param[ACTUAL_RECORD_NUMBER] = actual_number_records
        dic_param[UNIQUE_SERIAL] = duplicated_serials
        dic_param[REMOVED_OUTLIERS] = graph_param.common.outliers

    dic_param = filter_cat_dict_common(df, dic_param, cat_exp, cat_procs, graph_param)
    export_data = df.copy()

    # calculate cycle_time and replace target column
    df = convert_datetime_to_ct(df, graph_param)

    # chunk data by cyclic terms
    if graph_param.common.cyclic_div_num:
        df = get_df_chunk_cyclic(df, dic_param)
    if graph_param.common.div_by_data_number:
        data_number = graph_param.common.div_by_data_number
        df[DIVIDE_FMT_COL] = df.reset_index().index // data_number
        df_from_to = df.groupby(DIVIDE_FMT_COL)[TIME_COL].agg(['min', 'max'])
        from_to_list = list(zip(df_from_to['min'], df_from_to['max']))
        df[DIVIDE_FMT_COL] = df[DIVIDE_FMT_COL].apply(lambda x: f'{data_number * x + 1} - {data_number * (x + 1)}')
        dic_param[DIV_FROM_TO] = from_to_list

    graph_param: DicParam
    if graph_param.common.divide_format is not None:
        # df, client_tz = convert_utc_to_local_time_and_offset(df, graph_param)
        df = gen_divide_format_column(
            df,
            graph_param.common.divide_calendar_dates,
            graph_param.common.divide_calendar_labels,
        )

    dic_data, str_cols, is_graph_limited = gen_agp_data_from_df(df, graph_param, max_graph)
    dic_param[ARRAY_PLOTDATA] = dic_data
    dic_param[IS_GRAPH_LIMITED] = is_graph_limited
    dic_param[REMOVED_OUTLIERS] = graph_param.common.outliers
    chart_infos, original_graph_configs = get_chart_infos(graph_param)
    for plot in dic_param[ARRAY_PLOTDATA]:
        set_chart_infos_to_plotdata(plot[END_COL_ID], chart_infos, original_graph_configs, plot)

    # calc y scale
    min_max_list, all_graph_min, all_graph_max, max_common_y_scale_count = calc_raw_common_scale_y(
        dic_param[ARRAY_PLOTDATA],
        str_cols,
        is_get_common_y_scale_count=True,
    )
    calc_scale_info(
        graph_param.dic_proc_cfgs,
        dic_param[ARRAY_PLOTDATA],
        min_max_list,
        all_graph_min,
        all_graph_max,
        str_cols,
        max_common_y_scale_count=max_common_y_scale_count,
    )

    dic_param = get_filter_on_demand_data(dic_param)

    return dic_param, export_data, graph_param


def get_df_chunk_cyclic(df, dic_param):
    produce_cyclic_terms(dic_param)
    terms = gen_dic_param_terms(dic_param)
    df = df.set_index(TIME_COL, drop=False)
    df_full = None
    for term_id, term in enumerate(terms):
        df_chunk = df[(df[TIME_COL] >= term[START_DT]) & (df[TIME_COL] < term[END_DT])]
        df_chunk[DIVIDE_FMT_COL] = f'{term[START_DT]} | {term[END_DT]}'

        df_full = df_chunk.copy(deep=True) if df_full is None else pd.concat([df_full, df_chunk])

    return df_full


@log_execution_time()
def gen_df_direct_term(root_graph_param, dic_param, dic_cat_filters, use_expired_cache):
    duplicated = 0
    total_record = 0
    terms = gen_time_conditions(dic_param)
    df = None
    outliers = None
    for term in terms:
        # create dic_param for each term from original dic_param
        term_dic_param = copy.deepcopy(dic_param)
        term_dic_param[COMMON][START_DATE] = term[START_DATE]
        term_dic_param[COMMON][START_TM] = term[START_TM]
        term_dic_param[COMMON][END_DATE] = term[END_DATE]
        term_dic_param[COMMON][END_TM] = term[END_TM]

        # query data and gen df
        df_term, graph_param, record_number, _duplicated = gen_df(
            root_graph_param,
            term_dic_param,
            dic_cat_filters,
            _use_expired_cache=use_expired_cache,
        )
        judge_columns = root_graph_param.get_judge_variables()
        df_term = judge_data_conversion(df_term, judge_columns)

        df_term[DIVIDE_FMT_COL] = f'{term[START_DT]} | {term[END_DT]}'

        df = df_term.copy() if df is None else pd.concat([df, df_term])

        if _duplicated is None:
            duplicated = None
        if duplicated is not None:
            duplicated += _duplicated
        total_record += record_number

        # outliers count
        if graph_param.common.outliers is not None:
            if outliers is None:
                outliers = graph_param.common.outliers
            else:
                outliers += graph_param.common.outliers
    root_graph_param.common.outliers = outliers
    return df, total_record, duplicated


@log_execution_time()
def gen_divide_format_column(
    df: pd.DataFrame,
    divide_calendar_dates: list[str],
    divide_calendar_labels: list[str],
) -> pd.DataFrame:
    # create temporary column for searching values
    temp_col = '__temp__datetime__'
    df[temp_col] = pd.to_datetime(df[TIME_COL])

    divide_calendar_dates = pd.to_datetime(divide_calendar_dates, utc=True)
    df = assign_group_labels_for_dataframe(
        df,
        by=temp_col,
        label_column=DIVIDE_FMT_COL,
        bins=divide_calendar_dates,
        labels=divide_calendar_labels,
    )

    # remove temporary column
    df = df.drop(columns=[temp_col])

    return df


@log_execution_time()
def gen_agp_data_from_df(df: pd.DataFrame, graph_param: DicParam, max_graph: int = None) -> list[dict[Any, Any]]:
    plot_data = []
    is_graph_limited = False
    target_vars = graph_param.common.sensor_cols

    str_cols = []

    # each target var be shown on one chart (barchart or line chart)
    for target_var in target_vars:
        if len(plot_data) >= max_graph:
            is_graph_limited = True
            return plot_data, str_cols, is_graph_limited

        general_col_info = graph_param.get_col_info_by_id(target_var)
        # bar chart for category, line chart for real, integer, datetime
        is_numeric = (
            general_col_info[COL_DATA_TYPE]
            in [
                DataType.REAL.name,
                DataType.DATETIME.name,
                DataType.INTEGER.name,
            ]
            and not general_col_info[IS_CATEGORY]
        )
        if not is_numeric:
            str_cols.append(target_var)
        agg_func = graph_param.common.hm_function_real if is_numeric else HMFunction.count.name
        agg_func_show = get_function_i18n(agg_func)

        summarized_df, sorted_colors = summarize_redundant_groups_into_others(
            df,
            graph_param,
            target_var,
            MAX_ALLOW_GROUPS,
            OTHER_KEY,
            OTHER_COL,
        )
        df_groupby = gen_groupby_from_target_var(summarized_df, graph_param, target_var, is_numeric)

        # get unique sorted div
        div_col_name = get_div_col_name(graph_param)
        if graph_param.common.compare_type == RL_CATEGORY:
            unique_div_vars = sorted(df[div_col_name].dropna().unique())
        else:
            unique_div_vars = df[div_col_name].dropna().unique()
        if general_col_info is None:
            continue

        color_show_name, color_column_type = graph_param.get_color_info(target_var, shown_name=True)

        agp_obj = {
            COLOR_NAME: color_show_name,
            COLOR_COLUMN_TYPE: color_column_type,
            AGG_FUNC: agg_func_show,
            DATA: [],
            CAT_EXP_BOX: [],
            UNIQUE_DIV: sort_ok_ng(unique_div_vars),
            FMT: None,
        }
        general_col_info.update(agp_obj)

        if is_numeric:
            target_var_label = graph_param.gen_label_from_col_id(target_var)
            agg_df = get_agg_lamda_func(df_groupby, target_var_label, agg_func)
        else:
            agg_df = df_groupby.count()

        # check empty
        if agg_df.empty:
            return plot_data, str_cols, is_graph_limited

        num_facets = len(graph_param.common.cat_exp)

        # TODO refactor this
        if num_facets == 0:
            data, array_y = get_data_for_target_var_without_facets(
                agg_df,
                graph_param,
                is_numeric,
                target_var,
                sorted_colors,
            )
            modified_agp_obj = {
                DATA: data,
                CAT_EXP_BOX: [],
                FMT: gen_ticks_format(data),
                ARRAY_Y: array_y,
                ARRAY_X: array_y,
                UNIQUE_COLOR: sorted_colors,
            }
            col_info = copy.deepcopy(general_col_info)
            col_info.update(modified_agp_obj)
            plot_data.append(col_info)

        elif num_facets == 1:
            # TODO: remove hard code level=0
            facets = agg_df.index.unique(level=0)
            for facet in facets:
                if len(plot_data) >= max_graph:
                    is_graph_limited = True
                    return plot_data, str_cols, is_graph_limited

                data, array_y = get_data_for_target_var_without_facets(
                    agg_df.xs(facet),
                    graph_param,
                    is_numeric,
                    target_var,
                    sorted_colors,
                )
                modified_agp_obj = {
                    DATA: data,
                    CAT_EXP_BOX: [facet],
                    FMT: gen_ticks_format(data),
                    ARRAY_Y: array_y,
                    ARRAY_X: array_y,
                    UNIQUE_COLOR: sorted_colors,
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
                    if len(plot_data) >= max_graph:
                        is_graph_limited = True
                        return plot_data, str_cols, is_graph_limited

                    array_y = pd.Series([])
                    try:
                        sub_sub_df = sub_df.xs(facet2)
                        data, array_y = get_data_for_target_var_without_facets(
                            sub_sub_df,
                            graph_param,
                            is_numeric,
                            target_var,
                            sorted_colors,
                        )
                    except KeyError:
                        data = []

                    modified_agp_obj = {
                        DATA: data,
                        ARRAY_Y: array_y,
                        ARRAY_X: array_y,
                        CAT_EXP_BOX: [facet1, facet2],
                        FMT: gen_ticks_format(data),
                        UNIQUE_COLOR: sorted_colors,
                    }
                    col_info = copy.deepcopy(general_col_info)
                    col_info.update(modified_agp_obj)
                    plot_data.append(col_info)

    return plot_data, str_cols, is_graph_limited


def sort_ok_ng(unique_div_vars: list[str]):
    ok_index = unique_div_vars.index('OK') if 'OK' in unique_div_vars else None
    ng_index = unique_div_vars.index('NG') if 'NG' in unique_div_vars else None

    # change position of OK an NG
    if ok_index is not None and ng_index is not None and ok_index > ng_index:
        unique_div_vars[ok_index], unique_div_vars[ng_index] = unique_div_vars[ng_index], unique_div_vars[ok_index]
    return unique_div_vars


def get_div_col_name(graph_param: DicParam) -> str:
    """Get division column name
    Args:
        graph_param:
    Returns:
        Column name which we will use to groupby final result.
    """
    div_col_name = DIVIDE_FMT_COL
    if graph_param.common.compare_type == RL_CATEGORY:
        div_col_name = graph_param.gen_label_from_col_id(graph_param.common.div_by_cat)
    return div_col_name


def get_color_col_name(graph_param: DicParam, target_var: int) -> Optional[str]:
    """Get color column name used to groupby from target variable"""
    color_id = graph_param.get_color_id(target_var)
    color_col_name = None
    if color_id:
        color_col_name = graph_param.gen_label_from_col_id(color_id)
    return color_col_name


@log_execution_time()
def need_add_other_col(df: pd.DataFrame, graph_param: DicParam, target_var: int, maximum_allowed_groups: int) -> bool:
    color_col_name = get_color_col_name(graph_param, target_var)
    if color_col_name is None:
        return False
    return df[color_col_name].nunique(dropna=True) > maximum_allowed_groups


# TODO: write test for this
@log_execution_time()
def summarize_redundant_groups_into_others(
    df: pd.DataFrame,
    graph_param: DicParam,
    target_var: int,
    maximum_allowed_groups: int,
    other_key: str,
    other_col: Optional[str],
) -> tuple[pd.DataFrame, list[Any]]:
    """Summarize color value if total unique value of color columns exceed `maximum_allowed_groups`"""
    color_col_name = get_color_col_name(graph_param, target_var)
    if color_col_name is None or other_col is None:
        return df, []
    df, sorted_colors = replace_redundant_groups_into_others(
        df,
        color_col_name,
        other_col,
        maximum_allowed_groups,
        other_key,
    )
    return df, sorted_colors


@log_execution_time()
def replace_redundant_groups_into_others(
    df: pd.DataFrame,
    column_name: str,
    new_column_name: str,
    maximum_allowed_groups: int,
    other_key: str,
) -> tuple[pd.DataFrame, list[Any]]:
    """Rename redundant value in `column_name` into `other_key`
    - We first sort value priority based on `value_counts`.
    - Every key have smaller `value_counts` should have lower priority
    """
    assert maximum_allowed_groups > 0

    colors = df[column_name].astype(pd.StringDtype())
    color_counts = colors.value_counts()
    counted_keys = color_counts.index.to_list()

    if maximum_allowed_groups >= len(counted_keys):
        counted_keys.reverse()
        return df, counted_keys

    non_redundant_groups = maximum_allowed_groups - 1
    # Need to convert to string before converting because `other_key` can be "Other", which is string
    df[new_column_name] = colors.replace(to_replace=counted_keys[non_redundant_groups:], value=other_key)

    # form a new_keys, with OTHER_KEY always on tops
    sorted_keys = [other_key] + counted_keys[:non_redundant_groups]
    sorted_keys.reverse()

    return df, sorted_keys


@log_execution_time()
def get_data_for_target_var_without_facets(
    df: pd.DataFrame,
    graph_param: DicParam,
    is_real_data: bool,
    target_var: int,
    sorted_colors: list[str],
) -> tuple[list[dict[Any, Any]], pd.Series]:
    chart_type = 'lines+markers' if is_real_data else 'bar'

    target_col = graph_param.get_col_cfg(target_var)
    target_col_name = graph_param.gen_label_from_col_id(target_var)

    color_id = graph_param.get_color_id(target_var)

    full_array_y = pd.Series([])

    def gen_trace_data(sub_df: pd.DataFrame, col_name: str) -> tuple[dict[str, Any], pd.Series]:
        y = sub_df[target_col_name].reset_index(drop=True)
        trace_data = {
            X: pd.Series(sub_df[target_col_name].index),
            Y: y,
            COL_DETAIL_NAME: col_name,
            COL_TYPE: chart_type,
        }
        if is_real_data:
            # TODO: set `mode` in constant
            trace_data['mode'] = chart_type
        return trace_data, y

    if color_id is None:
        data, array_y = gen_trace_data(df, target_col.shown_name)
        if is_real_data:
            full_array_y = append_series(full_array_y, array_y)

        plot_data = [data]
    else:
        plot_data = []
        for color in sorted_colors:
            try:
                data, array_y = gen_trace_data(df.xs(color), color)
                if is_real_data:
                    full_array_y = append_series(full_array_y, array_y)

                plot_data.append(data)
            except KeyError:
                pass
    return plot_data, full_array_y


@log_execution_time()
def get_agg_cols(df: pd.DataFrame, graph_param: DicParam, target_var: int) -> List[str]:
    agg_cols = []

    facet_cols_name = [graph_param.gen_label_from_col_id(col) for col in graph_param.common.cat_exp]
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
def gen_groupby_from_target_var(
    df: pd.DataFrame,
    graph_param: DicParam,
    target_var: int,
    is_real_data: bool,
) -> DataFrameGroupBy:
    agg_cols = get_agg_cols(df, graph_param, target_var)

    # colors columns now converted into string, hence we need to convert our color columns into string
    # before grouping by
    agg_cols_str = [uuid.uuid4().hex for _ in agg_cols]

    # since we don't use this `df` anymore, we can modify it directly
    for col, col_str in zip(agg_cols, agg_cols_str):
        df[col_str] = df[col].astype(pd.StringDtype())

    target_col_name = graph_param.gen_label_from_col_id(target_var)
    # remove na before apply aggregate method for real variable only
    if is_real_data:
        df_groupby = df.dropna(subset=[target_col_name]).groupby(agg_cols_str)[[target_col_name]]
    else:
        # count, do not remove na
        df_groupby = df.groupby(agg_cols_str)[[target_col_name]]

    return df_groupby


@log_execution_time()
def convert_utc_to_local_time_and_offset(df, graph_param):
    client_timezone = graph_param.get_client_timezone()
    # divide_offset = graph_param.common.divide_offset or 0
    client_tz = tz.gettz(client_timezone or None) or tz.tzlocal()
    if not df.empty:
        df[TIME_COL] = pd.to_datetime(df[TIME_COL]).dt.tz_convert(tz=client_tz)

    return df, client_tz


@log_execution_time()
def get_agg_lamda_func(df: DataFrameGroupBy, target_var, agg_func_name) -> pd.DataFrame:
    if agg_func_name == HMFunction.std.name:
        agg_params = {target_var: lambda x: agg_func_with_na(x, agg_func_name)}
        agg_df = df.agg(agg_params)
    elif agg_func_name == HMFunction.iqr.name:
        agg_df = df.agg(func=iqr)
        agg_df = agg_df.dropna()
    elif agg_func_name == HMFunction.range.name:
        agg_params = {target_var: range_func}
        agg_df = df.agg(agg_params)
    else:
        # median, mean, min, max, sum
        agg_df = df.agg(func=agg_func_name, numeric_only=False)
    return agg_df


@log_execution_time()
def gen_ticks_format(data):
    if not len(data):
        return None

    # get fmt from first list of data instead of all data
    ticks_format = get_fmt_from_array(data[0]['y'])
    return ticks_format
