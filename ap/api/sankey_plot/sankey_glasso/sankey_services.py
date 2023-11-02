# GraphicalLASSO is implemented in glasso.py
# Let us define 2 more functions here
import collections
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix

from ap.api.common.services.services import get_filter_on_demand_data
from ap.api.sankey_plot.sankey_glasso import glasso
from ap.api.sankey_plot.sankey_glasso.grplasso import preprocess_skdpage
from ap.api.trace_data.services.time_series_chart import (
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_cfg_proc_col_info,
    get_data_from_db,
    get_procs_in_dic_param,
    main_check_filter_detail_match_graph_data,
)
from ap.common.common_utils import gen_sql_label, zero_variance
from ap.common.constants import *
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log
from ap.setting_module.models import CfgProcessColumn
from ap.trace_data.models import Cycle

colors = [
    '#ec654a',
    '#915558',
    '#02c39a',
    '#c3b281',
    '#f15bb5',
    '#e3c20b',
    '#ab2f1e',
    '#024381',
    '#750704',
    '#0d639d',
    '#db1168',
    '#4895ef',
    '#00f5d4',
    '#037003',
    '#510ca0',
    '#ff7aa2',
    '#985d02',
    '#642902',
    '#70e000',
    '#9c5fea',
]


@log_execution_time()
def gen_sankeydata_from_adj(adj_mat):
    """
    Helper function to generate source/target/value/color lists from adjacency matrix

    Inputs:
    ----------
    adj_mat: NumpyArray of shape (num of sensors, num of sensors)
      Adjacency matrix. This matrix is strictly upper triangular, and
      (j, i) th element indicate partial correlation between (j, i)

    Returns:
    ----------
    see preprocess_for_sankey_glasso()
    """

    # define colors for positive/negative correlation
    color_positive = 'rgba(44, 160, 44, 0.2)'  # green-like color
    color_negative = 'rgba(214, 39, 40, 0.2)'  # red-like color

    d = adj_mat.shape[0]
    source = []
    target = []
    value = []
    color = []
    for i in range(d):
        for j in range(d):
            source.append(i)
            target.append(j)
            value.append(np.abs(adj_mat[j, i]))  # sankey can not handle negative valued links
            color.append(color_positive if adj_mat[j, i] > 0 else color_negative)
    return source, target, value, color


@log_execution_time()
def preprocess_for_sankey_glasso(X, idx_target, num_layers=2):
    """
    Preprocessing for Sankey Diagrams
    Generate source/target/value/color lists from given sensor data

    Inputs:
    ----------
    X: NumpyArray or pandas dataframe of shape (num of records, num of sensors)
        sensor data

    idx_target: list of integers
        column index of target sensor(s)

    num_layers: integer of greater than 0. default=1
        maximum number of paths from target column(s)

    Returns:
    ----------
    lists of integers to pass to sankey diagram (sankey diagram)
        source, target, value, color
    """

    # generate instance and fit glasso (large alpha returns more sparse result)
    ggm = glasso.GaussianGraphicalModel()
    ggm.fit(X, idx_target)

    # extract column index of (target/direct/indirect) sensors,
    # and remove unnecessary edges
    adj_mat = glasso.remove_unnecessary_edges(ggm.parcor, idx_target, num_layers)

    # convert data to pass to sankey
    source, target, value, color = gen_sankeydata_from_adj(adj_mat)
    return source, target, value, color


@log_execution_time()
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.SKD, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@memoize(is_save_file=True)
def gen_graph_sankey_group_lasso(dic_param):
    """tracing data to show graph
    1 start point x n end point
    filter by condition point
    https://files.slack.com/files-pri/TJHPR9BN3-F01GG67J84C/image.pngnts that between start point and end_point
    """
    # for on-demand filter
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    # get serials
    dic_proc_cfgs = get_procs_in_dic_param(graph_param)
    serials = []
    objective_var = graph_param.common.objective_var
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serial_ids = []
        for serial in proc_cfg.get_serials(column_name_only=False):
            serial_ids.append(serial.id)
            if objective_var in proc.col_ids:
                serials.append((proc_cfg.name, serial.id, serial.column_name))
        proc.add_cols(serial_ids)

    # get data from database
    df, actual_record_number, unique_serial = get_data_from_db(
        graph_param, dic_cat_filters, use_expired_cache=use_expired_cache
    )

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

    # sensors
    dic_param['plotly_data'] = gen_plotly_data(
        dic_skd={}, dic_bar={}, dic_proc_cfgs={}, dic_col_proc_id={}
    )
    orig_graph_param = bind_dic_param_to_class(dic_param)
    dic_var_name = None
    dic_null_percent = None
    dic_var = None

    dic_param['importance_columns_ids'] = None
    if not df.empty:
        dic_label_id, dic_id_name, dic_col_proc_id = get_sensors_objective_explanation(
            orig_graph_param
        )
        df_sensors: pd.DataFrame = df[dic_label_id]
        df_sensors = df_sensors.rename(columns=dic_label_id)
        df_sensors, data_clean, errors, err_cols, dic_null_percent, dic_var = clean_input_data(
            df_sensors
        )

        if data_clean and not errors:
            # prepare column names and process names
            y_id = graph_param.common.objective_var
            y_col = (y_id, dic_id_name[y_id])
            x_cols = {key: val for key, val in dic_id_name.items() if key != y_id}
            groups = [
                dic_proc_cfgs.get(proc_id).name
                for key, proc_id in dic_col_proc_id.items()
                if key != y_id
            ]

            # get category sensors from df
            cat_sensors = []
            for col in df_sensors.columns.to_list():
                proc_col = CfgProcessColumn.get_by_id(int(col))
                if proc_col.data_type == DataType.TEXT.name:
                    cat_sensors.append(col)

            is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx = gen_sankey_grouplasso_plot_data(
                df_sensors, x_cols, y_col, groups, cat_cols=cat_sensors
            )

            # get dic_scp
            dic_scp = dict(**dic_scp, **dic_tbl)
            obj_var = dic_param[COMMON][OBJ_VAR]
            _, dic_cols = get_cfg_proc_col_info(obj_var)
            dic_scp[OBJ_VAR] = dic_cols[int(obj_var[0])].name

            dic_scp['fitted_fmt'] = get_fmt_from_array(dic_scp['fitted'])
            dic_scp['actual_fmt'] = get_fmt_from_array(dic_scp['actual'])
            dic_scp['residuals'] = dic_scp['actual'] - dic_scp['fitted']
            dic_scp['residuals_fmt'] = get_fmt_from_array(dic_scp['residuals'])
            dic_scp['index'] = list(range(1, len(dic_scp['residuals']) + 1))

            # in case of objective variable is binary data
            dic_scp['is_classif'] = is_classif
            if is_classif:
                dic_scp['classif'] = gen_confusion_matrix(dic_scp['actual'], dic_scp['fitted'])

            dic_serials = {}
            for proc_name, serial_id, serial_name in serials:
                serial_label = gen_sql_label(serial_id, serial_name)
                # dic_serials[f'{proc_name} {serial_name}'] = df[serial_label][idx]
                dic_serials[serial_name] = df[serial_label][idx]

            times = df[Cycle.time.key]

            dic_param['plotly_data'] = gen_plotly_data(
                dic_skd, dic_bar, dic_proc_cfgs, dic_col_proc_id
            )
            dic_param['dic_scp'] = dic_scp
            dic_scp['times'] = times[idx]
            dic_scp['serials'] = dic_serials
            dic_param['importance_columns_ids'] = []

            # sort by abs of coef from barplot
            dic_bar_df = pd.DataFrame(
                {'coef': dic_bar['coef'], 'sensor_ids': dic_bar['sensor_ids']}
            )
            dic_bar_df = dic_bar_df.reindex(
                dic_bar_df['coef'].abs().sort_values(ascending=False).index
            )

            for col_id in dic_bar_df['sensor_ids'].tolist():
                dic_param['importance_columns_ids'].append(col_id)

        if errors:
            dic_param['errors'] = errors
            dic_param['err_cols'] = err_cols

        dic_var_name = dic_id_name

    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[UNIQUE_SERIAL] = unique_serial
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
    dic_param[NULL_PERCENT] = dic_null_percent
    dic_param[ZERO_VARIANCE] = dic_var
    dic_param[SELECTED_VARS] = dic_var_name

    dic_param = get_filter_on_demand_data(dic_param)

    return dic_param


def get_end_proc_cols(df, orig_graph_param):
    dic_cols = {}
    for end_proc in orig_graph_param.array_formval:
        for col_id, col_name in zip(end_proc.col_ids, end_proc.col_names):
            df_col = gen_sql_label(col_id, col_name)
            if df_col in df.columns:
                dic_cols[df_col] = col_id
    return dic_cols


def gen_sensor_headers(orig_graph_param):
    target_sensor_ids = []
    for proc in orig_graph_param.array_formval:
        target_sensor_ids.extend(proc.col_ids)
    return target_sensor_ids


@log_execution_time()
@abort_process_handler()
def clean_input_data(df: pd.DataFrame):
    data_clean = True
    errors = []

    # calculate null percentage and zero variance
    dic_null_percent = (df.isnull().sum() * 100 / len(df)).to_dict()
    dic_var = {}

    # if there are greater than 50% Null percent -> remove these columns
    remove_cols = []
    na_error = False
    for col_id, percent in dic_null_percent.items():
        if percent > 50:
            data_clean = False
            na_error = True
            remove_cols.append(col_id)

    # drop > 50% NA column before drop NA to calculate variance
    df_drop = df.drop(remove_cols, axis=1)

    df_drop = df_drop.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).dropna(how='any')

    is_zero_var, err_cols = zero_variance(df_drop)
    if is_zero_var:
        data_clean = False
        errors.append(ErrorMsg.E_ZERO_VARIANCE.name)
        dic_var = df_drop.var().to_dict()

    if na_error:
        errors.append(ErrorMsg.E_ALL_NA.name)

    return df_drop, data_clean, errors, err_cols, dic_null_percent, dic_var


@log_execution_time()
@abort_process_handler()
def gen_sankey_grouplasso_plot_data(df: pd.DataFrame, x_cols, y_col, groups, cat_cols):
    # names
    y_col_id, y_col_name = y_col
    x_col_names = np.array(list(x_cols.values()))

    # Inputs
    x_2d = df[x_cols]
    y_1d = df[[y_col_id]].values

    x_col_ids = np.array(x_2d.columns.tolist())
    # please set verbose=False if info should not be printed
    is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx = preprocess_skdpage(
        x_2d,
        y_1d,
        groups,
        x_col_names,
        y_col_name,
        cat_cols=cat_cols,
        penalty_factors=[0.0, 0.1, 0.3, 1.0],
        max_datapoints=10000,
        verbose=True,
        colids_x=x_col_ids,
    )

    return is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx


@abort_process_handler()
def gen_plotly_data(dic_skd: dict, dic_bar: dict, dic_proc_cfgs: dict, dic_col_proc_id: dict):
    return dict(
        sankey_trace=plot_sankey_grplasso(defaultdict(list, dic_skd)),
        bar_trace=plot_barchart_grplasso(
            defaultdict(list, dic_bar), dic_proc_cfgs, dic_col_proc_id
        ),
    )


@abort_process_handler()
def plot_sankey_grplasso(dic_skd: defaultdict):
    sankey_trace = dict(
        arrangement='snap',
        node=dict(
            pad=20,
            thickness=20,
            label=dic_skd['node_labels'],
            color=dic_skd['node_color'],
            x=dic_skd['node_x'],
            y=dic_skd['node_y'],
        ),
        link=dict(
            source=dic_skd['source'],
            target=dic_skd['target'],
            value=dic_skd['edge_value'],
            color=dic_skd['edge_color'],
        ),
    )
    return sankey_trace


@abort_process_handler()
def plot_barchart_grplasso(dic_bar: defaultdict, dic_proc_cfgs: dict, dic_col_proc_id: dict):
    sensor_label = []
    if len(dic_bar[SENSOR_NAMES]):
        dup_sensor_name = [
            item for item, count in collections.Counter(dic_bar[SENSOR_NAMES]).items() if count > 1
        ]
        for idx, sensor_name in enumerate(dic_bar[SENSOR_NAMES].tolist()):
            label = sensor_name
            if label in dup_sensor_name:
                sensor_ids = dic_bar[SENSOR_IDS].tolist()
                col_id = sensor_ids[idx]
                label = f'{dic_proc_cfgs[dic_col_proc_id[col_id]].name}|{label}'
            sensor_label.append(label)

    bar_trace = dict(
        y=sensor_label,
        x=np.abs(dic_bar[COEF]),
        name=None,
        orientation='h',
        marker_color=dic_bar[BAR_COLORS],
        hovertemplate='%{text}',
        text=np.round(dic_bar[COEF], 5),
    )
    return bar_trace


@log_execution_time()
@abort_process_handler()
def gen_sankey_plot_data(
    x: pd.DataFrame, idx_tgt, num_layers, dic_label_id, dic_proc_cfgs, target_proc
):
    # preprocess
    source, target, value, color = preprocess_for_sankey_glasso(x, idx_tgt, num_layers)

    # sensor names are also required for sankey diagram
    col_ids = [dic_label_id.get(c) for c in x.columns.values]
    cols = CfgProcessColumn.get_by_ids(col_ids) or []
    dic_cols = {
        col.id: '{} | {}'.format(dic_proc_cfgs.get(col.process_id).name, col.name) for col in cols
    }
    node_labels = [dic_cols.get(col_id) for col_id in col_ids]
    dic_proc_color = {}

    for idx, proc_id in enumerate(dic_proc_cfgs.keys()):
        dic_proc_color[proc_id] = (
            SKD_TARGET_PROC_CLR if (proc_id == target_proc) else colors[idx % len(colors)]
        )
    dic_col_color = {col.id: dic_proc_color.get(col.process_id) for col in cols}
    node_colors = [dic_col_color.get(col_id) for col_id in col_ids]

    return {
        'source': source,
        'target': target,
        'value': value,
        'color': color,
        'node_labels': node_labels,
        'node_colors': node_colors,
    }


@abort_process_handler()
def get_sensors_objective_explanation(orig_graph_param):
    dic_label_id = {}
    dic_id_name = {}
    dic_col_proc_id = {}
    for proc in orig_graph_param.array_formval:
        for col_id, col_name, col_show_name in zip(
            proc.col_ids, proc.col_names, proc.col_show_names
        ):
            label = gen_sql_label(col_id, col_name)
            dic_label_id[label] = col_id
            dic_id_name[col_id] = col_show_name
            dic_col_proc_id[col_id] = proc.proc_id

    return dic_label_id, dic_id_name, dic_col_proc_id


@abort_process_handler()
def gen_confusion_matrix(actual, fitted):
    uniq_vals = [str(x) for x in np.unique(actual)]
    cm = confusion_matrix(actual, fitted)
    cm = pd.DataFrame(cm, index=uniq_vals, columns=uniq_vals)
    cm_data = {'columns': uniq_vals, 'data': cm.values.tolist()}
    return cm_data
