# GraphicalLASSO is implemented in glasso.py
# Let us define 2 more functions here
import collections
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix
from sklearn.preprocessing import LabelEncoder

from ap.api.common.services.show_graph_services import (
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_data_from_db,
    get_filter_on_demand_data,
    is_nominal_check,
    main_check_filter_detail_match_graph_data,
)
from ap.api.sankey_plot.sankey_glasso.grplasso import preprocess_skdpage
from ap.common.common_utils import gen_sql_label, zero_variance
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    BAR_COLORS,
    CATEGORY_COLS,
    COEF,
    COMMON,
    COMPLETED_PERCENT,
    DATA_SIZE,
    MATCHED_FILTER_IDS,
    NOT_EXACT_MATCH_FILTER_IDS,
    NULL_PERCENT,
    OBJ_VAR,
    OBJECTIVE,
    REMOVED_OUTLIERS,
    SELECTED_VARS,
    SENSOR_IDS,
    SENSOR_NAMES,
    STRENGTHEN_SELECTION,
    SUMMARY_MESSAGE,
    TASK_KEY,
    TIME_COL,
    TRUE_MATCH,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    ZERO_VARIANCE,
    CacheType,
    DataType,
    ErrorMsg,
    GrLassoTask,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log

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
@request_timeout_handling()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.SKD, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def gen_graph_sankey_group_lasso(graph_param, dic_param, df=None):
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

    # get serials
    serials = []
    objective_var = graph_param.common.objective_var
    objective_var_shown_name = ''
    for proc in graph_param.array_formval:
        proc_cfg = graph_param.dic_proc_cfgs[proc.proc_id]
        if proc_cfg.get_col(objective_var) is not None:
            objective_var_shown_name = proc_cfg.get_col(objective_var).shown_name

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
            use_expired_cache=use_expired_cache,
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

    # sensors
    dic_param['plotly_data'] = gen_plotly_data(dic_skd={}, dic_bar={}, dic_proc_cfgs={}, dic_col_proc_id={})
    orig_graph_param = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )
    dic_var_name = None
    dic_null_percent = None
    err_cols = []

    cat_col_details = []
    dic_param['importance_columns_ids'] = None
    if not df.empty:
        dic_label_id, dic_id_name, dic_col_proc_id = get_sensors_objective_explanation(orig_graph_param)
        df_sensors: pd.DataFrame = df[dic_label_id.keys()]
        df_sensors = df_sensors.rename(columns=dic_label_id)
        df_sensors, data_clean, errors, err_cols, dic_null_percent = clean_input_data(df_sensors)
        if data_clean and not errors:
            # prepare column names and process names
            y_id = graph_param.common.objective_var
            y_col = (y_id, dic_id_name[y_id])
            x_cols = {key: val for key, val in dic_id_name.items() if key != y_id}
            groups = [
                graph_param.dic_proc_cfgs.get(proc_id).shown_name
                for key, proc_id in dic_col_proc_id.items()
                if key != y_id
            ]

            # get category sensors from df
            cat_sensors = []
            for col in df_sensors.columns.to_list():
                proc_cfg = graph_param.dic_proc_cfgs[dic_col_proc_id[col]]
                col_cfg = proc_cfg.get_col(col)
                if not col_cfg:
                    continue
                # cat sensors is data type Text or Int_Cate
                if col_cfg.is_category:
                    cat_sensors.append(col)
                    col_detail = {
                        'col_id': col,
                        'col_shown_name': col_cfg.shown_name,
                        'col_en_name': col_cfg.name_en,
                        'data_type': col_cfg.data_type,
                        'proc_id': proc_cfg.id,
                        'proc_shown_name': proc_cfg.shown_name,
                        'proc_en_name': proc_cfg.name_en,
                        'is_category': True,
                        'is_checked': is_nominal_check(col, graph_param),
                        'is_serial_no': col_cfg.is_serial_no,
                    }
                    cat_col_details.append(col_detail)

            nominal_vars = []
            strengthen_selection = dic_param[COMMON].get(STRENGTHEN_SELECTION) == TRUE_MATCH
            if graph_param.common.is_nominal_scale:
                # nominal variables are category: string or int which unique value < 128
                nominal_vars = cat_sensors
            # if re-select from modal
            if graph_param.common.nominal_vars is not None:
                nominal_vars = graph_param.common.nominal_vars
            is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx, msg = gen_sankey_grouplasso_plot_data(
                df_sensors,
                x_cols,
                y_col,
                groups,
                cat_cols=cat_sensors,
                nominal_vars=nominal_vars,
                objective_var_shown_name=objective_var_shown_name,
                strengthen_selection=strengthen_selection,
            )

            # get dic_scp
            dic_scp = dict(**dic_scp, **dic_tbl)
            obj_var_id = graph_param.common.objective_var
            obj_var_name = None
            is_cat_obj = False
            for proc_id, cfg_proc in graph_param.dic_proc_cfgs.items():
                for cfg_col in cfg_proc.columns:
                    if cfg_col.id == obj_var_id:
                        obj_var_name = cfg_col.shown_name
                        is_cat_obj = cfg_col.is_category and cfg_col.data_type != DataType.INTEGER.name
                        break

                if obj_var_name is not None:
                    break

            # _, dic_cols = get_cfg_proc_col_info(graph_param.dic_proc_cfgs, obj_var)
            dic_scp[OBJ_VAR] = obj_var_name

            dic_scp['fitted_fmt'] = get_fmt_from_array(dic_scp['fitted'])
            dic_scp['actual_fmt'] = get_fmt_from_array(dic_scp['actual'])

            # compute residual for actual and fitted data
            is_multi_class = dic_bar[TASK_KEY] == GrLassoTask.MULTI_CLASS.value
            _actual = dic_scp.get('actual')
            _fitted = dic_scp.get('fitted')
            if is_multi_class or is_cat_obj:
                # encoding category variable
                encoder = LabelEncoder()
                _y_combination = np.array([dic_scp['actual'], dic_scp['fitted']])
                _y_encoding = encoder.fit_transform(_y_combination.flatten()).reshape(_y_combination.shape)
                _actual, _fitted = _y_encoding[0], _y_encoding[1]
            dic_scp['residuals'] = _actual - _fitted
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
                if serial_label in df:
                    dic_serials[serial_name] = df[serial_label][idx]

            times = df[TIME_COL]
            dic_param['plotly_data'] = gen_plotly_data(dic_skd, dic_bar, graph_param.dic_proc_cfgs, dic_col_proc_id)
            dic_param['dic_scp'] = dic_scp
            dic_scp['times'] = times[idx]
            dic_scp['serials'] = dic_serials
            dic_param['importance_columns_ids'] = []
            dic_param[SUMMARY_MESSAGE] = msg

            if not is_multi_class:
                # sort by abs of coef from barplot
                dic_bar_df = pd.DataFrame({'coef': dic_bar['coef'], 'sensor_ids': dic_bar['sensor_ids']})
                dic_bar_df = dic_bar_df.reindex(dic_bar_df['coef'].abs().sort_values(ascending=False).index)

                for col_id in dic_bar_df['sensor_ids'].tolist():
                    dic_param['importance_columns_ids'].append(col_id)

        if errors:
            dic_param['errors'] = errors
            dic_param['err_cols'] = err_cols

        dic_var_name = dic_id_name

    dic_param[DATA_SIZE] = df.memory_usage(deep=True).sum()
    dic_param[NULL_PERCENT] = dic_null_percent
    dic_param[ZERO_VARIANCE] = err_cols
    dic_param[SELECTED_VARS] = dic_var_name
    dic_param[CATEGORY_COLS] = cat_col_details

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
    dic_null_percent = (df.isna().sum() * 100 / len(df)).to_dict()

    # if there are greater than 50% Null percent -> remove these columns
    remove_cols = []
    na_error = False
    for col_id, percent in dic_null_percent.items():
        if percent > COMPLETED_PERCENT / 2:
            data_clean = False
            na_error = True
            remove_cols.append(col_id)

    # drop > 50% NA column before drop NA to calculate variance
    df_drop = df.drop(remove_cols, axis=1)
    original_dtypes = df_drop.dtypes

    df_drop = df_drop.replace([np.inf, -np.inf], np.nan).dropna(how='any')
    # After dropping NA, int columns will be converted to float
    # convert int columns back to their original datatypes of the dataframe
    for column in df_drop.columns:
        if original_dtypes.get(column).name == pd.Int64Dtype().name:
            df_drop[column] = df_drop[column].astype(original_dtypes.get(column))

    is_zero_var, error_cols = zero_variance(df_drop)
    if is_zero_var:
        data_clean = False
        errors.append(ErrorMsg.E_ZERO_VARIANCE.name)

    if df_drop.empty:
        data_clean = False
        errors.append(ErrorMsg.E_EMPTY_DF.name)

    if na_error:
        errors.append(ErrorMsg.E_ALL_NA.name)

    return df_drop, data_clean, errors, error_cols, dic_null_percent


@log_execution_time()
@abort_process_handler()
def gen_sankey_grouplasso_plot_data(
    df: pd.DataFrame,
    x_cols,
    y_col,
    groups,
    cat_cols,
    nominal_vars=[],
    objective_var_shown_name='',
    strengthen_selection=False,
):
    # names
    y_col_id, y_col_name = y_col
    x_col_names = np.array(list(x_cols.values()))

    # Inputs
    x_2d = df[x_cols.keys()]
    y_1d = df[[y_col_id]].to_numpy()

    x_col_ids = np.array(x_2d.columns.tolist())
    # please set verbose=False if info should not be printed
    is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx, msg = preprocess_skdpage(
        x_2d,
        y_1d,
        groups,
        x_col_names,
        y_col_name,
        cat_cols=cat_cols,
        penalty_factors=[0.0, 0.1, 0.3, 1.0],
        strengthen_selection=strengthen_selection,
        max_datapoints=10000,
        verbose=True,
        colids_x=x_col_ids,
        nominal_variables=nominal_vars,
        objective_var_shown_name=objective_var_shown_name,
    )

    return is_classif, dic_skd, dic_bar, dic_scp, dic_tbl, idx, msg


@abort_process_handler()
def gen_plotly_data(dic_skd: dict, dic_bar: dict, dic_proc_cfgs: dict, dic_col_proc_id: dict):
    return {
        'sankey_trace': plot_sankey_grplasso(defaultdict(list, dic_skd)),
        'bar_trace': plot_barchart_grplasso(defaultdict(list, dic_bar), dic_proc_cfgs, dic_col_proc_id),
    }


@abort_process_handler()
def plot_sankey_grplasso(dic_skd: defaultdict):
    sankey_trace = {
        'arrangement': 'snap',
        'node': {
            'pad': 20,
            'thickness': 20,
            'label': dic_skd['node_labels'],
            'color': dic_skd['node_color'],
            'x': dic_skd['node_x'],
            'y': dic_skd['node_y'],
        },
        'link': {
            'source': dic_skd['source'],
            'target': dic_skd['target'],
            'value': dic_skd['edge_value'],
            'color': dic_skd['edge_color'],
            'relationship': dic_skd['relationship'],
        },
    }
    return sankey_trace


@abort_process_handler()
def plot_barchart_grplasso(dic_bar: defaultdict, dic_proc_cfgs: dict, dic_col_proc_id: dict):
    sensor_label = []
    x_data = None
    y_data = None
    marker_color = {}
    if len(dic_bar[SENSOR_NAMES]):
        dup_sensor_name = [item for item, count in collections.Counter(dic_bar[SENSOR_NAMES]).items() if count > 1]
        for idx, sensor_name in enumerate(dic_bar[SENSOR_NAMES].tolist()):
            label = sensor_name
            if label in dup_sensor_name:
                sensor_ids = dic_bar[SENSOR_IDS].tolist()
                col_id = sensor_ids[idx]
                label = f'{dic_proc_cfgs[dic_col_proc_id[col_id]].shown_name}|{label}'
            sensor_label.append(label)

    if len(sensor_label) and dic_bar[TASK_KEY] == 'multiclass':
        idx_df = [item[0] for item in dic_bar[BAR_COLORS]]
        df_group = pd.DataFrame(dic_bar[COEF], columns=sensor_label)
        df_group.index = idx_df
        df_group['total'] = df_group.abs().sum(axis=1)
        df_group_sorted = df_group.sort_values(by='total', ascending=False).drop(columns='total')
        marker_color = [[idx] * len(df_group_sorted.columns) for idx in df_group_sorted.index]
        x_data = df_group_sorted.to_numpy()
        y_data = df_group_sorted.columns.tolist()

    bar_trace = {
        'x': np.abs(x_data) if x_data is not None else np.abs(dic_bar[COEF]),
        'y': y_data if y_data is not None else sensor_label,
        'name': None,
        'orientation': 'h',
        'marker_color': marker_color if len(marker_color) > 0 else dic_bar[BAR_COLORS],
        'text': x_data if x_data is not None else dic_bar[COEF],
        'task': dic_bar[TASK_KEY],
        'objective': dic_bar[OBJECTIVE],
    }
    return bar_trace


@abort_process_handler()
def get_sensors_objective_explanation(orig_graph_param):
    dic_label_id = {}
    dic_id_name = {}
    dic_col_proc_id = {}
    for proc in orig_graph_param.array_formval:
        for col_id, col_name, col_show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
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
    cm_data = {'columns': uniq_vals, 'data': cm.to_numpy().tolist()}
    return cm_data
