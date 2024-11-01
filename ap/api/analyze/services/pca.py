import numpy as np
import pandas as pd
from pandas import DataFrame
from sklearn.preprocessing import StandardScaler

from ap.api.common.services.show_graph_services import (
    convert_datetime_to_ct,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    get_data_from_db,
    get_filter_on_demand_data,
)
from ap.api.sankey_plot.sankey_glasso.sankey_services import clean_input_data
from ap.common.common_utils import gen_abbr_name, gen_sql_label
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ACTUAL_RECORD_NUMBER_TEST,
    ACTUAL_RECORD_NUMBER_TRAIN,
    ARRAY_PLOTDATA,
    CYCLE_IDS,
    DATAPOINT_INFO,
    DIC_SENSOR_HEADER,
    FILTER_ON_DEMAND,
    PLOTLY_JSON,
    REMOVED_OUTLIER_NAN_TEST,
    REMOVED_OUTLIER_NAN_TRAIN,
    REMOVED_OUTLIERS,
    ROWID,
    SELECTED_VARS,
    SHORT_NAMES,
    UNIQUE_SERIAL,
    UNIQUE_SERIAL_TEST,
    UNIQUE_SERIAL_TRAIN,
    CacheType,
    DataType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.pysize import get_size
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import MessageAnnouncer
from ap.common.trace_data_log import (
    EventAction,
    EventType,
    Target,
    TraceErrKey,
    save_trace_log_db,
    set_log_attr,
    trace_log,
)

# ------------------------------------START TRACING DATA TO SHOW ON GRAPH-----------------------------
from ap.trace_data.schemas import DicParam


@log_execution_time('[PCA]')
@request_timeout_handling()
@abort_process_handler()
@MessageAnnouncer.notify_progress(75)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.PCA, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def run_pca(root_graph_param: DicParam, dic_param, sample_no=0):
    """run pca package to get graph jsons"""

    dic_output, dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors = gen_base_object(root_graph_param, dic_param)
    if errors:
        return None, errors

    plotly_jsons, errors = get_sample_no_data(dic_biplot, dic_t2q_lrn, dic_t2q_tst, sample_no)
    if errors:
        return None, errors

    # get sample no info
    graph_param, dic_serials, dic_get_dates = pca_bind_dic_param_to_class(root_graph_param, dic_param)
    data_point_info, meta_data = get_data_point_info(
        sample_no,
        dic_output.get('df'),
        graph_param,
        graph_param.dic_proc_cfgs,
        dic_serials,
        dic_get_dates,
    )
    array_plotdata = [
        {
            'array_x': dic_output.get('df').time,
            # 'array_x': plotly_jsons.get('json_pca_score_test').get('scatter').get('x'),
            'end_col_id': meta_data['sensor_id_x'],
            'end_proc_id': meta_data['proc_id_x'],
        },
    ]
    dic_output_df = dic_output.get('df')
    cycle_ids = []
    if ROWID in dic_output_df.columns:
        cycle_ids = dic_output.get('df').rowid
    return {
        PLOTLY_JSON: plotly_jsons,
        DATAPOINT_INFO: data_point_info,
        UNIQUE_SERIAL_TRAIN: dic_output.get(UNIQUE_SERIAL_TRAIN),
        UNIQUE_SERIAL_TEST: dic_output.get(UNIQUE_SERIAL_TEST),
        ACTUAL_RECORD_NUMBER_TRAIN: dic_output.get(ACTUAL_RECORD_NUMBER_TRAIN),
        ACTUAL_RECORD_NUMBER_TEST: dic_output.get(ACTUAL_RECORD_NUMBER_TEST),
        REMOVED_OUTLIER_NAN_TRAIN: dic_output.get(REMOVED_OUTLIER_NAN_TRAIN),
        REMOVED_OUTLIER_NAN_TEST: dic_output.get(REMOVED_OUTLIER_NAN_TEST),
        SHORT_NAMES: dic_output.get(SHORT_NAMES),
        ARRAY_PLOTDATA: array_plotdata,
        CYCLE_IDS: cycle_ids,
        FILTER_ON_DEMAND: dic_output.get(FILTER_ON_DEMAND, {}),
        REMOVED_OUTLIERS: dic_output.get(REMOVED_OUTLIERS, None),
    }, None


@log_execution_time()
@abort_process_handler()
def gen_base_object(root_graph_param, dic_param):
    dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors = None, None, None, None
    dic_output, dict_data, dict_train_data, errors = get_test_n_train_data(root_graph_param, dic_param)
    if not errors:
        # call pca function
        dic_sensor_headers = dict_train_data[DIC_SENSOR_HEADER]
        x_train = dict_train_data['df'][dic_sensor_headers].rename(columns=dic_sensor_headers)
        x_test = dict_data['df'][dic_sensor_headers].rename(columns=dic_sensor_headers)
        dic_selected_vars = dic_output[SELECTED_VARS]
        var_names = x_train.columns.values
        dic_biplot, dic_t2q_lrn, dic_t2q_tst = run_pca_and_calc_t2q(x_train, x_test, var_names, dic_selected_vars)

    return dic_output, dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors


@log_execution_time()
@abort_process_handler()
def get_test_n_train_data(root_graph_param: DicParam, dic_param):
    dic_output, dict_data, dict_train_data, errors = None, None, None, None

    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    # bind dic_param
    graph_param, *_ = pca_bind_dic_param_to_class(root_graph_param, dic_param)
    train_graph_param, *_ = pca_bind_dic_param_to_class(root_graph_param, dic_param, is_train_data=True)

    # add filter condition
    train_graph_param = pca_bind_conditions(train_graph_param)

    dict_train_data = gen_trace_data(train_graph_param, root_graph_param, dic_cat_filters, use_expired_cache)
    dict_train_errors = dict_train_data.get('errors')

    dict_data = gen_trace_data(graph_param, root_graph_param, dic_cat_filters, use_expired_cache)
    dict_target_errors = dict_data.get('errors')

    if dict_train_errors['error'] or dict_target_errors['error']:
        errors = {'train_data': dict_train_errors, 'target_data': dict_target_errors}
        return dic_output, dict_data, dict_train_data, errors

    # get filter data of train data
    full_df = pd.concat([dict_train_data['df'], dict_data['df']])
    dic_param = filter_cat_dict_common(full_df, dic_param, cat_exp, cat_procs, root_graph_param, False)

    dic_param = get_filter_on_demand_data(dic_param)

    # count removed outlier, nan
    dic_output = {
        SELECTED_VARS: dict_data[SELECTED_VARS],
        UNIQUE_SERIAL_TRAIN: dict_train_data.get(UNIQUE_SERIAL),
        UNIQUE_SERIAL_TEST: dict_data.get(UNIQUE_SERIAL),
        REMOVED_OUTLIER_NAN_TRAIN: int(dict_train_data[ACTUAL_RECORD_NUMBER]) - len(dict_train_data['df']),
        ACTUAL_RECORD_NUMBER_TEST: dict_data.get(ACTUAL_RECORD_NUMBER, 0),
        ACTUAL_RECORD_NUMBER_TRAIN: dict_train_data.get(ACTUAL_RECORD_NUMBER, 0),
        REMOVED_OUTLIER_NAN_TEST: int(dict_data[ACTUAL_RECORD_NUMBER]) - len(dict_data['df']),
        'df': dict_data['df'],
        SHORT_NAMES: dict_data[SHORT_NAMES],
        FILTER_ON_DEMAND: dic_param[FILTER_ON_DEMAND],
        REMOVED_OUTLIERS: graph_param.common.outliers,
    }

    return dic_output, dict_data, dict_train_data, errors


@log_execution_time()
@abort_process_handler()
def get_sample_no_data(dic_biplot, dic_t2q_lrn, dic_t2q_tst, sample_no=0):
    """
    clicked sample no data
    :param dic_biplot:
    :param dic_t2q_lrn:
    :param dic_t2q_tst:
    :param sample_no:
    :return:
    """
    plotly_jsons = _gen_jsons_for_plotly(dic_biplot, dic_t2q_lrn, dic_t2q_tst, sample_no)
    # check R script error
    if plotly_jsons:
        errors = [plotly_jsons] if isinstance(plotly_jsons, str) else plotly_jsons.get('err')

        if errors:
            set_log_attr(TraceErrKey.MSG, str(errors))
            save_trace_log_db()
            return None, errors
    else:
        return None, ['No output from R']

    return plotly_jsons, None


@log_execution_time()
@abort_process_handler()
def gen_trace_data(graph_param, orig_graph_param, dic_cat_filters, use_expired_cache):
    """tracing data to show graph
    1 start point x n end point
    filter by condition points that between start point and end_point
    """

    # get sensor cols
    dic_sensor_headers, short_names, ids = gen_sensor_headers(orig_graph_param)

    # get data from database
    df, actual_record_number, unique_serial = get_trace_data(graph_param, dic_cat_filters, use_expired_cache)
    convert_datetime_to_ct(df, graph_param)

    dic_var_name = {}
    for col_alias, id in ids.items():
        dic_var_name[id] = dic_sensor_headers[col_alias]

    if not actual_record_number:
        return {'errors': {'error': True, SELECTED_VARS: dic_var_name, 'null_percent': {}, 'zero_variance': []}}
    # sensor headers
    cols = list(dic_sensor_headers)

    # replace inf -inf to NaN , so we can dropNA later
    df.loc[:, cols] = df[cols].replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan))

    # sensors
    df_sensors: DataFrame = df[dic_sensor_headers]

    _, _, errors, err_cols, dic_null_percent, dic_var = clean_input_data(df_sensors)

    # use column id instead of label
    err_cols = [ids[col] for col in err_cols] if len(err_cols) else []
    if dic_null_percent:
        dic_null_percent = {ids[col]: value for col, value in dic_null_percent.items()}

    # all NA columns is not zero_var
    error = bool(len(errors))

    # remove NaN row
    df.dropna(subset=cols, inplace=True)

    # if there is no data
    if not df.size:
        return {
            'errors': {
                'error': True,
                'errors': errors,
                SELECTED_VARS: dic_var_name,
                'null_percent': dic_null_percent,
                'zero_variance': err_cols,
            },
        }

    return {
        'df': df,
        'dic_sensor_headers': dic_sensor_headers,
        SELECTED_VARS: dic_var_name,
        'errors': {
            'error': error,
            'errors': errors,
            SELECTED_VARS: dic_var_name,
            'null_percent': dic_null_percent,
            'zero_variance': err_cols,
        },
        UNIQUE_SERIAL: unique_serial,
        ACTUAL_RECORD_NUMBER: actual_record_number,
        SHORT_NAMES: short_names,
    }


@log_execution_time()
@abort_process_handler()
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.PCA, EventAction.READ, Target.DATABASE),
    send_ga=True,
)
def get_trace_data(graph_param, dic_cat_filters, use_expired_cache):
    """get data from universal db

    Arguments:
        trace {Trace} -- [DataFrame Trace]
        dic_param {dictionary} -- parameter form client

    Returns:
        [type] -- data join from start to end by global_id
    """
    # get data from database
    df, actual_record_number, unique_serial = get_data_from_db(
        graph_param,
        dic_cat_filters,
        use_expired_cache=use_expired_cache,
    )

    return df, actual_record_number, unique_serial


@log_execution_time()
@abort_process_handler()
def get_data_point_info(sample_no, df: DataFrame, graph_param: DicParam, dic_proc_cfgs, dic_serials, dic_get_dates):
    meta_data = {
        'proc_id_x': None,
        'sensor_id_x': None,
    }
    row = df.iloc[sample_no]
    proc_cnt = -1
    col_infos = []
    for proc in graph_param.array_formval:
        proc_cnt += 1
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        for col_id, _col_name, show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            col_name = _col_name
            col_name = gen_sql_label(col_id, col_name)
            if col_name not in df.columns:
                continue

            if col_name in dic_serials.values():
                order = f'{proc_cnt:03}_1'
            elif col_name in dic_get_dates.values():
                order = f'{proc_cnt:03}_2'
            # elif str(col_name).startswith('time'):
            #     order = f'{proc_cnt:03}_2'
            else:
                order = f'{proc_cnt:03}_3'
                if proc_cnt == 0:
                    meta_data = {
                        'proc_id_x': proc.proc_id,
                        'sensor_id_x': col_id,
                    }

            col_infos.append((proc_cfg.shown_name, show_name, row[col_name], order))

    return col_infos, meta_data


@log_execution_time()
@abort_process_handler()
def calculate_data_size(output_dict):
    """
    Calculate data size for each chart.
    """
    dtsize_pca_score_train = get_size(output_dict.get('json_pca_score_train'))
    output_dict['dtsize_pca_score_train'] = dtsize_pca_score_train

    dtsize_pca_score_test = get_size(output_dict.get('json_pca_score_test'))
    output_dict['dtsize_pca_score_test'] = dtsize_pca_score_test

    dtsize_t2_time_series = get_size(output_dict.get('json_t2_time_series'))
    output_dict['dtsize_t2_time_series'] = dtsize_t2_time_series

    dtsize_q_time_series = get_size(output_dict.get('json_q_time_series'))
    output_dict['dtsize_q_time_series'] = dtsize_q_time_series

    dtsize_t2_contribution = get_size(output_dict.get('json_t2_contribution'))
    output_dict['dtsize_t2_contribution'] = dtsize_t2_contribution

    dtsize_q_contribution = get_size(output_dict.get('json_q_contribution'))
    output_dict['dtsize_q_contribution'] = dtsize_q_contribution

    dtsize_pca_biplot = get_size(output_dict.get('json_pca_biplot'))
    output_dict['dtsize_pca_biplot'] = dtsize_pca_biplot


def pca_bind_conditions(graph_params: DicParam):
    # overwrite cond_procs by train/test conditions
    graph_params.common.cond_procs = graph_params.common.traincond_procs
    return graph_params


@log_execution_time()
@abort_process_handler()
def pca_bind_dic_param_to_class(root_graph_param: DicParam, dic_param, is_train_data=False):
    graph_param = bind_dic_param_to_class(
        root_graph_param.dic_proc_cfgs,
        root_graph_param.trace_graph,
        root_graph_param.dic_card_orders,
        dic_param,
        is_train_data=is_train_data,
    )

    dic_proc_cfgs = graph_param.dic_proc_cfgs

    # get serials and get_date
    dic_serials = {}
    dic_get_dates = {}
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        serials = proc_cfg.get_serials(column_name_only=False)
        serial_ids = [serial.id for serial in serials]
        get_date = proc_cfg.get_date_col(column_name_only=False)
        get_date_id = get_date.id
        text_cols = [col.id for col in proc_cfg.get_cols_by_data_type(DataType.TEXT, column_name_only=False)]
        proc.add_cols(text_cols, append_first=True)
        proc.add_cols(get_date_id, append_first=True)
        proc.add_cols(serial_ids, append_first=True)

        dic_serials.update({col.id: gen_sql_label(col.id, col.column_name) for col in serials})
        dic_get_dates[get_date_id] = gen_sql_label(get_date.id, get_date.column_name)

    time_idx = 0 if is_train_data else 1

    graph_param.common.start_date = graph_param.common.start_date[time_idx]
    graph_param.common.start_time = graph_param.common.start_time[time_idx]
    graph_param.common.end_date = graph_param.common.end_date[time_idx]
    graph_param.common.end_time = graph_param.common.end_time[time_idx]

    return graph_param, dic_serials, dic_get_dates


def gen_sensor_headers(orig_graph_param):
    dic_labels = {}
    short_names = {}
    ids = {}
    used_names = set()
    for proc in orig_graph_param.array_formval:
        for col_id, col_name, col_show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            name = gen_sql_label(col_id, col_name)
            dic_labels[name] = col_show_name

            # gen short name
            new_name = gen_abbr_name(col_show_name)
            i = 1
            while new_name in used_names:
                new_name = f'{new_name[0:-3]}({i})'
                i += 1

            short_names[name] = new_name
            ids[name] = col_id

    return dic_labels, short_names, ids


# ------------------------------------------------------

# run_pca_and_calc_t2q()
#     - _calc_biplot_data()
#         - _calc_biplot_circle_radius()
#         - _gen_biplot_circles_dataframe()
#         - _calc_biplot_arrows()
#         - _gen_biplot_axislabs()
#
#     - _calc_mspc_t2q()
#
#     - _gen_jsons_for_plotly()
#         - _extract_clicked_sample()
#         - _convert_df_circles_to_dict()


@log_execution_time()
def run_pca_and_calc_t2q(X_train, X_test, varnames: list, dic_selected_vars: dict) -> dict:
    """Run PCA and Calculate T2/Q Statistics/Contributions

    X_train and X_test must have same number of columns.
    Data must all be integer or float, and NA/NaNs must be removed beforehand.
    Number of rows can not be 0, and columns with constant value is not allowed.

    Inputs
    ----------
    X_train: dataframe or 2d ndarray
        (ntrain x p) pd.DataFrame of train data.
    X_test: dataframe or 2d ndarray
        (ntest x p) pd.DataFrame of test data. Must be X_test.shape[1] == X_train.shape[1]
    varnames: list
        (p) Column names. Must be len(varnames) == X_train.shape[1]
    dic_selected_vars: dict
        (p) Dictionary of column id and column name. Must be len(dic_selected_vars) == X_train.shape[1]
    Returns
    ----------
    output_dict: dict
        A dictionary of jsons (dictionaries) to draw Biplot and T2/Q chart with plotly.js
            json_pca_score_test
            json_pca_score_train
            json_t2_time_series
            json_q_time_series
            json_t2_contribution
            json_q_contribution
            json_pca_biplot

    """
    pca = PCA()
    pca.fit(X_train)
    pca.x = pca.transform(X_train)
    pca.newx = pca.transform(X_test)
    dic_biplot = _calc_biplot_data(pca, varnames=varnames, dic_selected_vars=dic_selected_vars)

    threshold = 80
    num_pc = np.where(pca.cum_explained >= threshold)[0][0] + 1
    dic_t2q_lrn = _calc_mspc_t2q(pca, X_train, num_pc)
    dic_t2q_tst = _calc_mspc_t2q(pca, X_test, num_pc)

    # move getting sample no data out of this function to cache base object.
    # output_dict = _gen_jsons_for_plotly(dic_biplot, dic_t2q_lrn, dic_t2q_tst, clicked_sample_no)
    # return output_dict

    return dic_biplot, dic_t2q_lrn, dic_t2q_tst


class PCA:
    """Principle Component Analysis with sklearn interface

    Note that sklearn's PCA function does not return rotation matrix.

    Attributes
    ----------
    sdev: ndarray
        1D array containing standard deviation of principle components (calculated by eigen values).
    rotation: ndarray
        2D array of loadings.
    var_explained: ndarray
        1D array of ratio[%] of variance explained in each principle components.
    cum_explained: ndarray
        1D array of ratio[%] of cumulative variance explained.
    scale: bool
        If True, scale date to zero mean unit variance.
    scaler: StandardScaler instance
        Scaler fitted with data given to fit().
    """

    def __init__(self, scale=True):
        self.sdev = None
        self.rotation = None
        self.var_explained = None
        self.cum_explained = None
        self.scale = scale
        self.scaler = None
        self.x = None
        self.newx = None

    def fit(self, X):
        if self.scale:
            self.scaler = StandardScaler().fit(X)
            X = self.scaler.transform(X)
        covmat = np.cov(X.T)

        # note that eig() does not return eigen values in descending order
        eig_vals, eig_vecs = np.linalg.eig(covmat)
        idx_desc = np.argsort(eig_vals)[::-1]
        eig_vals = eig_vals[idx_desc]
        eig_vecs = eig_vecs[:, idx_desc]

        self.rotation = eig_vecs
        self.sdev = np.sqrt(eig_vals)
        self.var_explained = eig_vals / np.sum(eig_vals) * 100
        self.cum_explained = np.cumsum(self.var_explained)

    def transform(self, X):
        if self.scale:
            X = self.scaler.transform(X)
        return X.dot(self.rotation)


# ---------------------------
# Biplot (PCA)
# ---------------------------


def _calc_biplot_data(pca: dict, varnames: list, dic_selected_vars: dict, tgt_pc=[1, 2]) -> dict:
    """Generate a set of data for biplot
    Data for scatter plot, arrows, circles (and axis labels)
    """
    dic_radius = _calc_biplot_circle_radius(pca.x)
    dic_arrows = _calc_biplot_arrows(rotation=pca.rotation, sdev=pca.sdev, max_train=dic_radius['max'])
    df_circles = _gen_biplot_circles_dataframe(dic_radius)
    axislabs = _gen_biplot_axislabs(pca.var_explained)
    idx_tgt_pc = [x - 1 for x in tgt_pc]

    res = {
        'pca_obj': pca,
        'varnames': varnames,
        'dic_selected_vars': dic_selected_vars,
        'arr_biplot_lrn': pca.x[:, idx_tgt_pc],
        'arr_biplot_tst': pca.newx[:, idx_tgt_pc],
        'dic_arrows': dic_arrows,
        'dic_radius': dic_radius,
        'df_circles': df_circles,
        'axislab': axislabs,
    }
    return res


def _calc_biplot_circle_radius(pca_score_train, prob_manual=85) -> dict:
    """Calculate radius for circles in biplot"""
    # standardized to unit variance
    score_sqsums = pca_score_train[:, 0] ** 2 + pca_score_train[:, 1] ** 2

    dic_radius = {
        'sigma': 1,
        '2sigma': 2,
        '3sigma': 3,
        'max': np.sqrt(np.max(score_sqsums)),
        # 'train': np.sqrt(np.percentile(score_sqsums, 99.5)),
        'train': np.sqrt(np.max(score_sqsums)),
        'percentile': np.sqrt(np.percentile(score_sqsums, prob_manual)),
        'prob_manual': str(prob_manual),
    }
    return dic_radius


def _gen_biplot_circles_dataframe(dic_radius: dict):
    """Generate a dataframe with x,y values to plot circles in biplot"""
    theta = np.concatenate([np.linspace(-np.pi, np.pi, 50), np.linspace(np.pi, -np.pi, 50)])
    px = np.cos(theta)
    py = np.sin(theta)
    df_1sigma = pd.DataFrame({'pc1.x': dic_radius['sigma'] * px, 'pc2.y': dic_radius['sigma'] * py, 'border': 'Sigma'})
    df_2sigma = pd.DataFrame(
        {'pc1.x': dic_radius['2sigma'] * px, 'pc2.y': dic_radius['2sigma'] * py, 'border': '2Sigma'},
    )
    df_3sigma = pd.DataFrame(
        {'pc1.x': dic_radius['3sigma'] * px, 'pc2.y': dic_radius['3sigma'] * py, 'border': '3Sigma'},
    )
    df_maxval = pd.DataFrame({'pc1.x': dic_radius['max'] * px, 'pc2.y': dic_radius['max'] * py, 'border': 'Outlier'})
    df_normal = pd.DataFrame({'pc1.x': dic_radius['train'] * px, 'pc2.y': dic_radius['train'] * py, 'border': 'Range'})
    df_percen = pd.DataFrame(
        {
            'pc1.x': dic_radius['percentile'] * px,
            'pc2.y': dic_radius['percentile'] * py,
            'border': 'Percentile' + dic_radius['prob_manual'],
        },
    )
    df_circles = pd.concat([df_1sigma, df_2sigma, df_3sigma, df_maxval, df_normal, df_percen])
    return df_circles


def _calc_biplot_arrows(rotation, sdev, max_train, var_name_adjust=1.5, tgt_pc=[1, 2]) -> dict:
    """Calculate direction of arrows (loadings) for biplot"""
    dic_arrows = {'xval': None, 'yval': None, 'angle': None, 'hjust': None, 'varname': None}

    # x,y direction for arrows (length corresponds to eigen values)
    scaled_eig_vecs = rotation * sdev
    max_len = np.sqrt(np.max(np.sum(scaled_eig_vecs**2, axis=1)))

    idx_tgt_pc = [x - 1 for x in tgt_pc]
    direc = scaled_eig_vecs[:, idx_tgt_pc] * (max_train / max_len)
    dic_arrows['xval'] = direc[:, 0].copy()
    dic_arrows['yval'] = direc[:, 1].copy()

    # angles and hjust for labels
    angle = (180 / np.pi) * np.arctan(direc[:, 1], direc[:, 0])
    hjust = (1 - var_name_adjust * np.sign(direc[:, 0])) / 2.0
    dic_arrows['angle'] = angle
    dic_arrows['hjust'] = hjust
    return dic_arrows


def _gen_biplot_axislabs(var_explained, tgt_pc=[1, 2]) -> list:
    """Generate axis labels for biplot"""
    axislabs = ['PC{}({:.1f} [%] explained Var.)'.format(x, var_explained[x - 1]) for x in tgt_pc]
    return axislabs


# ---------------------------
# PCA-MSPC
# ---------------------------


def _calc_mspc_t2q(pca, X, num_pc=2) -> dict:
    """PCA-MSPC: Calculate T2/Q statics and contributions"""
    dic_t2q = {'stats': None, 'contr_t2': None, 'contr_q': None}

    # calculate T2 stats and contributions
    pc_score = pca.transform(X)
    sigma = np.std(pc_score, axis=0)
    t2_stats = np.sum((pc_score[:, :num_pc] ** 2) / sigma[:num_pc] ** 2, axis=1)
    t2_contr = (pc_score / sigma) @ pca.rotation.T

    # calculate Q stats and contributions
    xstd = pca.scaler.transform(X)
    xhat = xstd @ pca.rotation[:, :num_pc] @ pca.rotation[:, :num_pc].T
    q_contr = (xstd - xhat) ** 2
    q_stats = np.sum(q_contr, axis=1)

    dic_t2q['dic_stats'] = {'t2': t2_stats, 'q': q_stats}
    dic_t2q['contr_t2'] = t2_contr
    dic_t2q['contr_q'] = (q_contr.T / q_stats).T
    return dic_t2q


# ---------------------------
# Utilities
# ---------------------------


def _gen_jsons_for_plotly(dic_biplot: dict, dic_t2q_lrn: dict, dic_t2q_tst: dict, sample_no=0) -> dict:
    """
    Generate a json to pass to plotly (Biplot and T2/Q Chart)
    :param dic_biplot:
    :param dic_t2q_lrn:
    :param dic_t2q_tst:
    :param sample_no:
    :return:
    sample_no: int
        An integer specifing sample no of clicked data point.
        For example, clicked_sample_no=1 is the first data point of X_test.
        clicked_sample_no=-1 is the last data point of X_train.
    """

    # Biplots (scatter, circles)
    dic_circles = _convert_df_circles_to_dict(dic_biplot['df_circles'])
    json_pca_score_train = {
        'scatter': {
            'x': dic_biplot['arr_biplot_lrn'][:, 0],
            'y': dic_biplot['arr_biplot_lrn'][:, 1],
        },
        'circles': dic_circles,
        'axislab': dic_biplot['axislab'],
        'r': dic_biplot['dic_radius'],
    }

    json_pca_score_test = {
        'scatter': {
            'x': dic_biplot['arr_biplot_tst'][:, 0],
            'y': dic_biplot['arr_biplot_tst'][:, 1],
        },
        'circles': dic_circles,
        'axislab': dic_biplot['axislab'],
        'r': dic_biplot['dic_radius'],
    }

    # Biplots (arrows): same graph for train and test
    score_clicked = _extract_clicked_sample(dic_biplot['arr_biplot_lrn'], dic_biplot['arr_biplot_tst'], sample_no)
    json_pca_biplot = {
        'x': dic_biplot['dic_arrows'].get('xval'),
        'y': dic_biplot['dic_arrows'].get('yval'),
        'varname': dic_biplot['varnames'],
        'angle': dic_biplot['dic_arrows'].get('angle'),
        'hjust': dic_biplot['dic_arrows'].get('hjust'),
        'r': dic_biplot['dic_radius'],
        'clicked_point': {
            'x': score_clicked[0],
            'y': score_clicked[1],
        },
    }

    # PCA-MSPC
    json_t2_time_series = {
        'train': dic_t2q_lrn['dic_stats']['t2'],
        'test': dic_t2q_tst['dic_stats']['t2'],
    }
    json_q_time_series = {
        'SPE': dic_t2q_lrn['dic_stats']['q'],
        'test': dic_t2q_tst['dic_stats']['q'],
    }
    t2_contr = _extract_clicked_sample(dic_t2q_lrn['contr_t2'], dic_t2q_tst['contr_t2'], sample_no)
    q_contr = _extract_clicked_sample(dic_t2q_lrn['contr_q'], dic_t2q_tst['contr_q'], sample_no)

    df_t2_contr = pd.DataFrame(
        {
            'id': dic_biplot['dic_selected_vars'].keys(),
            'Var': dic_biplot['dic_selected_vars'].values(),
            'Ratio': t2_contr / np.sum(np.abs(t2_contr)),
        },
    )
    df_q_contr = pd.DataFrame(
        {
            'id': dic_biplot['dic_selected_vars'].keys(),
            'Var': dic_biplot['dic_selected_vars'].values(),
            'Ratio': q_contr / np.sum(np.abs(q_contr)),
        },
    )
    df_t2_contr = df_t2_contr.sort_values('Ratio', ascending=False, key=abs).reset_index()
    df_q_contr = df_q_contr.sort_values('Ratio', ascending=False, key=abs).reset_index()

    output_dict = {
        'json_pca_score_test': json_pca_score_test,
        'json_pca_score_train': json_pca_score_train,
        'json_t2_time_series': json_t2_time_series,
        'json_q_time_series': json_q_time_series,
        'json_t2_contribution': df_t2_contr,
        'json_q_contribution': df_q_contr,
        'json_pca_biplot': json_pca_biplot,
    }
    return output_dict


def _convert_df_circles_to_dict(df_circles) -> dict:
    """Convert dataframe of circles to dictionary, to pass it to plotly"""
    dic_circles = {}
    for label in df_circles['border'].unique():
        dic_circles[label] = {'x': [], 'y': []}
        idx = np.where(df_circles['border'].values == label)[0]
        dic_circles[label]['x'] = df_circles['pc1.x'].values[idx]
        dic_circles[label]['y'] = df_circles['pc2.y'].values[idx]
    return dic_circles


def _extract_clicked_sample(df_train, df_test, sample_no=0):
    """Extract a row from train/test data, according to given sample_no"""

    if sample_no >= 0:
        return df_test[sample_no, :]
    else:
        return df_train[sample_no + df_train.shape[0], :]
