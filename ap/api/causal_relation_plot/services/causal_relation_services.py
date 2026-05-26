import collections
from typing import Any, Union

from ap.api.causal_relation_plot.services.causal_discovery import CRPBarDict, CRPNetDict, preprocess_crppage
from ap.api.common.services.show_graph_services import (
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_data_from_db,
    get_filter_on_demand_data,
    main_check_filter_detail_match_graph_data,
)
from ap.common.common_utils import gen_sql_label
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    DATA_SIZE,
    MATCHED_FILTER_IDS,
    NOT_EXACT_MATCH_FILTER_IDS,
    REMOVED_OUTLIERS,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    CacheType,
)
from ap.common.log import log_execution_time
from ap.common.memoize import CustomCache, OptionalCacheConfig
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import abort_process_handler, request_timeout_handling
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.SKD, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def gen_graph_causal_relation(graph_param, dic_param, df=None):
    # for on-demand filter
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    # get serials
    serials = []
    objective_var = graph_param.common.objective_var
    for proc in graph_param.array_formval:
        proc_cfg = graph_param.dic_proc_cfgs[proc.proc_id]
        # if objective_var in proc_cfg.col
        serial_ids = []
        for serial in proc_cfg.get_serials(column_name_only=False):
            serial_ids.append(serial.id)
            if objective_var in proc.col_ids:
                serials.append((proc_cfg.shown_name, serial.id, serial.column_name))
        proc.add_cols(serial_ids)

    # get data from database
    if df is None:
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            optional_cache_config=OptionalCacheConfig(use_expired_cache=use_expired_cache),
        )
        dic_param[UNIQUE_SERIAL] = unique_serial
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    # outliers count
    dic_param[REMOVED_OUTLIERS] = graph_param.common.outliers

    df = convert_datetime_to_ct(df, graph_param)

    dic_param = filter_cat_dict_common(
        df,
        dic_param,
        cat_exp,
        cat_procs,
        graph_param,
    )

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

    orig_graph_param = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )

    all_processes_ids_by_topo_order = graph_param.trace_graph.get_topological_order()
    order_index = {id_: i for i, id_ in enumerate(all_processes_ids_by_topo_order)}
    # Sort processes by topological order before processing
    orig_graph_param.array_formval.sort(key=lambda x: order_index[x.proc_id])

    dic_param['dic_bar'] = {}
    dic_param['dic_net'] = {}

    if not df.empty:
        df = df.dropna(how='any').reset_index(drop=True)
        objective_var = None
        explanation_vars = []

        groups = []
        group_orders = []
        cat_sensors = []
        dic_cols = {}
        for proc in orig_graph_param.array_formval:
            proc_cfg = graph_param.dic_proc_cfgs[proc.proc_id]
            for col_id, col_name, col_show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names, strict=False):
                col_cfg = proc_cfg.get_col(col_id)
                label = gen_sql_label(col_id, col_name)
                dic_cols[label] = (col_cfg.shown_name, proc_cfg.shown_name)
                if col_id == graph_param.common.objective_var:
                    objective_var = label
                else:
                    explanation_vars.append(label)
                    groups.append(proc_cfg.shown_name)
                    if proc_cfg.shown_name not in group_orders:
                        group_orders.append(proc_cfg.shown_name)
                if col_cfg.is_category:
                    cat_sensors.append(label)
        df_explanation = df[explanation_vars]
        objective_series = df[objective_var]
        dic_bar, dic_net = preprocess_crppage(df_explanation, objective_series, groups, group_orders, cat_sensors)

        dic_param['dic_bar'] = plot_barchart_causal_relation(dic_bar, dic_cols)
        dic_param['dic_net'] = preprocess_vis_network(dic_net, dic_cols)

        dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
        dic_param = get_filter_on_demand_data(dic_param)

    return dic_param


def plot_barchart_causal_relation(
    dic_bar: Union[dict[str, list[Union[float, str]]], CRPBarDict], dic_cols: dict[str, tuple[str, str]]
) -> dict[str, Any]:
    """
    Transforms causal relation data into Plotly horizontal bar chart format.

    Args:
        dic_bar: Dictionary containing bar chart data with keys:
            - 'values': List of numeric values (can be negative)
            - 'names': List of column identifiers
            - 'colors': List of color values for bars
        dic_cols: Dictionary mapping column identifiers to tuples of (sensor_name, process_name)

    Returns:
        Dictionary with Plotly bar chart configuration:
            - 'type': Chart type ('bar')
            - 'x': Absolute values for bar lengths
            - 'text': Original values for display
            - 'y': Sensor names from dic_cols
            - 'orientation': Bar orientation ('h' for horizontal)
            - 'marker': Color configuration

    Example:
        >>> dic_bar = {
        ...     'values': [0.5, -0.3, 0.8],
        ...     'names': ['col1', 'col2', 'col3'],
        ...     'colors': ['red', 'blue', 'green'],
        ... }
        >>> dic_cols = {
        ...     'col1': ('Sensor1', 'Process1'),
        ...     'col2': ('Sensor2', 'Process2'),
        ...     'col3': ('Sensor3', 'Process3'),
        ... }
        >>> result = plot_barchart_causal_relation(dic_bar, dic_cols)
    """
    # check duplicated shown name => show process_name | shown_name
    shown_names = [dic_cols[label][0] for label in dic_bar['names']]
    name_counts = collections.Counter(shown_names)
    tick_text = [
        f'{dic_cols[label][1]} | {dic_cols[label][0]}' if name_counts[dic_cols[label][0]] > 1 else dic_cols[label][0]
        for label in dic_bar['names']
    ]
    return {
        'type': 'bar',
        'x': [abs(x) for x in dic_bar['values']],
        'text': dic_bar['values'],
        'y': dic_bar['names'],
        'tick_text': tick_text,
        'orientation': 'h',
        'marker': {
            'color': dic_bar['colors'],
        },
    }


def preprocess_vis_network(
    dic_net: Union[dict[str, list[Any]], CRPNetDict], dic_cols: dict[str, tuple[str, str]]
) -> dict[str, list[Any]]:
    """
    Preprocesses network data for vis.js visualization by formatting node labels.

    Args:
        dic_net: Dictionary containing network data with keys:
            - 'node_labels': List of column identifiers
            - Other network properties (edges, positions, etc.)
        dic_cols: Dictionary mapping column identifiers to tuples of (sensor_name, process_name)

    Returns:
        Modified dic_net dictionary with updated 'nodes' and 'node_labels' keys

    Example:
        >>> dic_net = {
        ...     'node_labels': ['col1', 'col2'],
        ...     'edges': [[0, 1, 0.5, 'red']],
        ...     'node_positions_x': [0, 100],
        ...     'node_positions_y': [0, 100],
        ... }
        >>> dic_cols = {'col1': ('Sensor1', 'Process1'), 'col2': ('Sensor2', 'Process2')}
        >>> result = preprocess_vis_network(dic_net, dic_cols)
        >>> result['node_labels']
        ['Process1 | Sensor1', 'Process2 | Sensor2']
    """
    dic_net['nodes'] = dic_net['node_labels']
    dic_net['node_labels'] = [f'{dic_cols[label][1]} | {dic_cols[label][0]}' for label in dic_net['node_labels']]
    return dic_net
