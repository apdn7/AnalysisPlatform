from typing import List

import numpy as np
import pandas as pd
from pandas import DataFrame
from sklearn.preprocessing import StandardScaler

from histview2.api.trace_data.services.csv_export import to_csv
from histview2.api.trace_data.services.time_series_chart import get_data_from_db, get_procs_in_dic_param
from histview2.common.common_utils import gen_sql_label, gen_abbr_name, zero_variance
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.pysize import get_size
from histview2.common.services.form_env import bind_dic_param_to_class
from histview2.common.services.sse import notify_progress
from histview2.common.trace_data_log import set_log_attr, TraceErrKey, save_trace_log_db, trace_log, \
    EventAction, EventType, Target
from histview2.setting_module.models import CfgProcess
# ------------------------------------START TRACING DATA TO SHOW ON GRAPH-----------------------------
from histview2.trace_data.schemas import DicParam


@log_execution_time('[PCA]')
@notify_progress(75)
def run_pca(dic_param, sample_no=0):
    """run pca package to get graph jsons"""

    dic_output, dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors = gen_base_object(dic_param)
    if errors:
        return None, errors

    plotly_jsons, errors = get_sample_no_data(dic_biplot, dic_t2q_lrn, dic_t2q_tst, sample_no)
    if errors:
        return None, errors

    # get sample no info
    graph_param, dic_proc_cfgs, dic_serials, dic_get_date = pca_bind_dic_param_to_class(dic_param)
    data_point_info = get_data_point_info(sample_no, dic_output.get('df'), graph_param, dic_proc_cfgs, dic_serials,
                                          dic_get_date)
    return {PLOTLY_JSON: plotly_jsons, DATAPOINT_INFO: data_point_info,
            IS_RES_LIMITED_TRAIN: dic_output.get(IS_RES_LIMITED_TRAIN),
            IS_RES_LIMITED_TEST: dic_output.get(IS_RES_LIMITED_TEST),
            ACTUAL_RECORD_NUMBER_TRAIN: dic_output.get(ACTUAL_RECORD_NUMBER_TRAIN),
            ACTUAL_RECORD_NUMBER_TEST: dic_output.get(ACTUAL_RECORD_NUMBER_TEST),
            REMOVED_OUTLIER_NAN_TRAIN: dic_output.get(REMOVED_OUTLIER_NAN_TRAIN),
            REMOVED_OUTLIER_NAN_TEST: dic_output.get(REMOVED_OUTLIER_NAN_TEST),
            SHORT_NAMES: dic_output.get(SHORT_NAMES)
            }, None


@log_execution_time()
@memoize(is_save_file=True)
def gen_base_object(dic_param):
    dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors = None, None, None, None
    dic_output, dict_data, dict_train_data, errors = get_test_n_train_data(dic_param)
    if not errors:
        # call pca function
        dic_sensor_headers = dict_train_data[DIC_SENSOR_HEADER]
        x_train = dict_train_data['df'][dic_sensor_headers].rename(columns=dic_sensor_headers)
        x_test = dict_data['df'][dic_sensor_headers].rename(columns=dic_sensor_headers)
        var_names = x_train.columns.values
        dic_biplot, dic_t2q_lrn, dic_t2q_tst = run_pca_and_calc_t2q(x_train, x_test, var_names)

    return dic_output, dic_biplot, dic_t2q_lrn, dic_t2q_tst, errors


@log_execution_time()
def get_test_n_train_data(dic_param):
    dic_output, dict_data, dict_train_data, errors = None, None, None, None
    # is remove outlier
    is_remove_outlier = int(dic_param[COMMON][IS_REMOVE_OUTLIER])

    # bind dic_param
    orig_graph_param = bind_dic_param_to_class(dic_param)
    graph_param, dic_proc_cfgs, dic_serials, dic_get_date = pca_bind_dic_param_to_class(dic_param)
    train_graph_param, *_ = pca_bind_dic_param_to_class(dic_param, dic_proc_cfgs, is_train_data=True)

    dict_train_data = gen_trace_data(dic_proc_cfgs, train_graph_param, orig_graph_param,
                                     training_data=True, is_remove_outlier=is_remove_outlier)

    errors = dict_train_data.get('errors')
    if errors:
        return dic_output, dict_data, dict_train_data, errors

    dict_data = gen_trace_data(dic_proc_cfgs, graph_param, orig_graph_param)

    errors = dict_data.get('errors')
    if errors:
        return dic_output, dict_data, dict_train_data, errors

    # count removed outlier, nan
    dic_output = {IS_RES_LIMITED_TRAIN: dict_train_data.get(IS_RES_LIMITED),
                  IS_RES_LIMITED_TEST: dict_data.get(IS_RES_LIMITED),
                  REMOVED_OUTLIER_NAN_TRAIN: int(dict_train_data[ACTUAL_RECORD_NUMBER]) - len(dict_train_data['df']),
                  ACTUAL_RECORD_NUMBER_TEST: dict_data.get(ACTUAL_RECORD_NUMBER),
                  REMOVED_OUTLIER_NAN_TEST: int(dict_data[ACTUAL_RECORD_NUMBER]) - len(dict_data['df']),
                  'df': dict_data['df'],
                  SHORT_NAMES: dict_data[SHORT_NAMES]}

    return dic_output, dict_data, dict_train_data, errors


@log_execution_time()
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
        if isinstance(plotly_jsons, str):
            errors = [plotly_jsons]
        else:
            errors = plotly_jsons.get('err')

        if errors:
            set_log_attr(TraceErrKey.MSG, str(errors))
            save_trace_log_db()
            return None, errors
    else:
        return None, ['No output from R']

    return plotly_jsons, None


@log_execution_time()
def gen_trace_data(dic_proc_cfgs, graph_param, orig_graph_param, training_data=False, is_remove_outlier=False):
    """tracing data to show graph
        1 start point x n end point
        filter by condition points that between start point and end_point
    """

    # get sensor cols
    dic_sensor_headers, short_names = gen_sensor_headers(orig_graph_param)

    # get data from database
    df, actual_record_number, is_res_limited = get_trace_data(dic_proc_cfgs, graph_param)

    if not actual_record_number:
        return dict(errors=[ErrorMsg.E_ALL_NA.name])

    # sensor headers
    cols = list(dic_sensor_headers)

    # replace inf -inf to NaN , so we can dropNA later
    df.loc[:, cols] = df[cols].replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan))

    # sensors
    df_sensors: DataFrame = df[dic_sensor_headers]

    # if training_data and int(dic_param[COMMON][IS_REMOVE_OUTLIER]):
    if training_data and is_remove_outlier:
        df_sensors = remove_outlier(df_sensors, threshold=0.05)
        if df_sensors is None or not df_sensors.size:
            return dict(errors=[ErrorMsg.E_ALL_NA.name])

        df[cols] = df_sensors[cols].to_numpy()

    # remove NaN row
    df.dropna(subset=cols, inplace=True)

    # zero variance check
    if zero_variance(df[df_sensors.columns]):
        return dict(errors=[ErrorMsg.E_ZERO_VARIANCE.name])

    # if there is no data
    if not df.size:
        return dict(errors=[ErrorMsg.E_ALL_NA.name])

    return {'df': df, 'dic_sensor_headers': dic_sensor_headers, IS_RES_LIMITED: is_res_limited,
            ACTUAL_RECORD_NUMBER: actual_record_number, SHORT_NAMES: short_names}


@log_execution_time()
def remove_outlier(df: pd.DataFrame, threshold=0.05):
    if df is None:
        return None

    cols = list(df.columns)
    total = df.index.size
    for col in cols:
        num_nan = df[col].isna().sum()
        num_numeric = total - num_nan
        if num_numeric < 20:  # when n=19, p1=0, p9=19 -> remove nothing -> skip
            continue
        p1 = np.floor(num_numeric * threshold)
        p9 = num_numeric - p1
        df['rank_{}'.format(col)] = df[col].replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).rank(
            method='first')
        df[col] = np.where((df['rank_{}'.format(col)] > p9) | (df['rank_{}'.format(col)] < p1), np.nan, df[col])

    return df[cols]


@log_execution_time()
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.PCA, EventAction.READ, Target.DATABASE), send_ga=True)
def get_trace_data(dic_proc_cfgs, graph_param):
    """get data from universal db

    Arguments:
        trace {Trace} -- [DataFrame Trace]
        dic_param {dictionary} -- parameter form client

    Returns:
        [type] -- data join from start to end by global_id
    """
    # get data from database
    df, actual_record_number, is_res_limited = get_data_from_db(graph_param)

    return df, actual_record_number, is_res_limited


@log_execution_time()
@trace_log((TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventAction.SAVE, Target.TSV),
           output_key=TraceErrKey.DUMPFILE, send_ga=True)
def write_csv(dfs, dic_proc_cfgs, graph_param, file_paths, dic_headers):
    for df, file_path in zip(dfs, file_paths):
        to_csv(df, dic_proc_cfgs, graph_param, delimiter=CsvDelimiter.TSV.value,
               output_path=file_path, output_col_ids=dic_headers, len_of_col_name=10)

    return file_paths[0]


@log_execution_time()
def change_path(file_path):
    return file_path.replace('dat_', 'ret_').replace('tsv', 'pickle')


@log_execution_time()
def get_data_point_info(sample_no, df: DataFrame, graph_param: DicParam, dic_proc_cfgs, dic_serials, dic_get_date):
    row = df.iloc[sample_no]
    proc_cnt = -1
    col_infos = []
    for proc in graph_param.array_formval:
        proc_cnt += 1
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        for col_id, col_name, show_name in zip(proc.col_ids, proc.col_names, proc.col_show_names):
            col_name = gen_sql_label(col_id, col_name)
            if col_name not in df.columns:
                continue

            if col_name in dic_serials.values():
                order = f'{proc_cnt:03}_1'
            elif col_name in dic_get_date.values():
                order = f'{proc_cnt:03}_2'
            else:
                order = f'{proc_cnt:03}_3'

            col_infos.append((proc_cfg.name, show_name, row[col_name], order))

    return col_infos


@log_execution_time()
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


@log_execution_time()
def pca_bind_dic_param_to_class(dic_param, dic_proc_cfgs: List[CfgProcess] = None, is_train_data=False):
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    # move start proc to first
    graph_param.add_start_proc_to_array_formval()

    # add condition procs
    graph_param.add_cond_procs_to_array_formval()

    if dic_proc_cfgs is None:
        dic_proc_cfgs = get_procs_in_dic_param(graph_param)  # add start proc

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

    if is_train_data:
        time_idx = 0
    else:
        time_idx = 1

    graph_param.common.start_date = graph_param.common.start_date[time_idx]
    graph_param.common.start_time = graph_param.common.start_time[time_idx]
    graph_param.common.end_date = graph_param.common.end_date[time_idx]
    graph_param.common.end_time = graph_param.common.end_time[time_idx]

    return graph_param, dic_proc_cfgs, dic_serials, dic_get_dates


def gen_sensor_headers(orig_graph_param):
    dic_labels = {}
    short_names = {}
    used_names = set()
    for proc in orig_graph_param.array_formval:
        for col_id, col_name in zip(proc.col_ids, proc.col_names):
            name = gen_sql_label(col_id, col_name)
            dic_labels[name] = col_name

            # gen short name
            new_name = gen_abbr_name(col_name)
            i = 1
            while new_name in used_names:
                new_name = f'{new_name[0:-3]}({i})'
                i += 1

            short_names[name] = new_name

    return dic_labels, short_names


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
def run_pca_and_calc_t2q(X_train, X_test, varnames: list) -> dict:
    ''' Run PCA and Calculate T2/Q Statistics/Contributions

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

    '''
    pca = PCA()
    pca.fit(X_train)
    pca.x = pca.transform(X_train)
    pca.newx = pca.transform(X_test)
    dic_biplot = _calc_biplot_data(pca, varnames)

    threshold = 80
    num_pc = np.where(pca.cum_explained >= threshold)[0][0] + 1
    dic_t2q_lrn = _calc_mspc_t2q(pca, X_train, num_pc)
    dic_t2q_tst = _calc_mspc_t2q(pca, X_test, num_pc)

    # move getting sample no data out of this function to cache base object.
    # output_dict = _gen_jsons_for_plotly(dic_biplot, dic_t2q_lrn, dic_t2q_tst, clicked_sample_no)
    # return output_dict

    return dic_biplot, dic_t2q_lrn, dic_t2q_tst


class PCA:
    ''' Principle Component Analysis with sklearn interface

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
    '''

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

def _calc_biplot_data(pca: dict, varnames: list, tgt_pc=[1, 2]) -> dict:
    ''' Generate a set of data for biplot
    Data for scatter plot, arrows, circles (and axis labels)
    '''
    dic_radius = _calc_biplot_circle_radius(pca.x)
    dic_arrows = _calc_biplot_arrows(rotation=pca.rotation, sdev=pca.sdev, max_train=dic_radius['max'])
    df_circles = _gen_biplot_circles_dataframe(dic_radius)
    axislabs = _gen_biplot_axislabs(pca.var_explained)
    idx_tgt_pc = [x - 1 for x in tgt_pc]

    res = {'pca_obj': pca,
           'varnames': varnames,
           'arr_biplot_lrn': pca.x[:, idx_tgt_pc],
           'arr_biplot_tst': pca.newx[:, idx_tgt_pc],
           'dic_arrows': dic_arrows,
           'dic_radius': dic_radius,
           'df_circles': df_circles,
           'axislab': axislabs}
    return res


def _calc_biplot_circle_radius(pca_score_train, prob_manual=85) -> dict:
    ''' Calculate radius for circles in biplot
    '''
    # standardized to unit variance
    score_sqsums = pca_score_train[:, 0] ** 2 + pca_score_train[:, 1] ** 2

    dic_radius = {'sigma': 1,
                  '2sigma': 2,
                  '3sigma': 3,
                  'max': np.sqrt(np.max(score_sqsums)),
                  # 'train': np.sqrt(np.percentile(score_sqsums, 99.5)),
                  'train': np.sqrt(np.max(score_sqsums)),
                  'percentile': np.sqrt(np.percentile(score_sqsums, prob_manual)),
                  'prob_manual': str(prob_manual)}
    return dic_radius


def _gen_biplot_circles_dataframe(dic_radius: dict):
    ''' Generate a dataframe with x,y values to plot circles in biplot
    '''
    theta = np.concatenate([np.linspace(-np.pi, np.pi, 50), np.linspace(np.pi, -np.pi, 50)])
    px = np.cos(theta)
    py = np.sin(theta)
    df_1sigma = pd.DataFrame({'pc1.x': dic_radius['sigma'] * px,
                              'pc2.y': dic_radius['sigma'] * py,
                              'border': 'Sigma'})
    df_2sigma = pd.DataFrame({'pc1.x': dic_radius['2sigma'] * px,
                              'pc2.y': dic_radius['2sigma'] * py,
                              'border': '2Sigma'})
    df_3sigma = pd.DataFrame({'pc1.x': dic_radius['3sigma'] * px,
                              'pc2.y': dic_radius['3sigma'] * py,
                              'border': '3Sigma'})
    df_maxval = pd.DataFrame({'pc1.x': dic_radius['max'] * px,
                              'pc2.y': dic_radius['max'] * py,
                              'border': 'Outlier'})
    df_normal = pd.DataFrame({'pc1.x': dic_radius['train'] * px,
                              'pc2.y': dic_radius['train'] * py,
                              'border': 'Range'})
    df_percen = pd.DataFrame({'pc1.x': dic_radius['percentile'] * px,
                              'pc2.y': dic_radius['percentile'] * py,
                              'border': 'Percentile' + dic_radius['prob_manual']})
    df_circles = pd.concat([df_1sigma, df_2sigma, df_3sigma, df_maxval, df_normal, df_percen])
    return df_circles


def _calc_biplot_arrows(rotation, sdev, max_train, var_name_adjust=1.5, tgt_pc=[1, 2]) -> dict:
    ''' Calculate direction of arrows (loadings) for biplot
    '''
    dic_arrows = {'xval': None, 'yval': None, 'angle': None, 'hjust': None, 'varname': None}

    # x,y direction for arrows (length corresponds to eigen values)
    scaled_eig_vecs = rotation * sdev
    max_len = np.sqrt(np.max(np.sum(scaled_eig_vecs ** 2, axis=1)))

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
    ''' Generate axis labels for biplot
    '''
    axislabs = ['PC{}({:.1f} [%] explained Var.)'.format(x, var_explained[x - 1]) for x in tgt_pc]
    return axislabs


# ---------------------------
# PCA-MSPC
# ---------------------------

def _calc_mspc_t2q(pca, X, num_pc=2) -> dict:
    ''' PCA-MSPC: Calculate T2/Q statics and contributions
    '''
    dic_t2q = dict(stats=None, contr_t2=None, contr_q=None)

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
        'r': dic_biplot['dic_radius']
    }

    json_pca_score_test = {
        'scatter': {
            'x': dic_biplot['arr_biplot_tst'][:, 0],
            'y': dic_biplot['arr_biplot_tst'][:, 1],
        },
        'circles': dic_circles,
        'axislab': dic_biplot['axislab'],
        'r': dic_biplot['dic_radius']
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
            "x": score_clicked[0],
            "y": score_clicked[1],
        }
    }

    # PCA-MSPC
    json_t2_time_series = {'train': dic_t2q_lrn['dic_stats']['t2'], 'test': dic_t2q_tst['dic_stats']['t2']}
    json_q_time_series = {'SPE': dic_t2q_lrn['dic_stats']['q'], 'test': dic_t2q_tst['dic_stats']['q']}
    t2_contr = _extract_clicked_sample(dic_t2q_lrn['contr_t2'], dic_t2q_tst['contr_t2'], sample_no)
    q_contr = _extract_clicked_sample(dic_t2q_lrn['contr_q'], dic_t2q_tst['contr_q'], sample_no)

    df_t2_contr = pd.DataFrame({'Var': dic_biplot['varnames'], 'Ratio': t2_contr / np.sum(np.abs(t2_contr))})
    df_q_contr = pd.DataFrame({'Var': dic_biplot['varnames'], 'Ratio': q_contr / np.sum(np.abs(q_contr))})
    df_t2_contr = df_t2_contr.sort_values('Ratio', ascending=False, key=abs).reset_index()
    df_q_contr = df_q_contr.sort_values('Ratio', ascending=False, key=abs).reset_index()

    output_dict = {
        'json_pca_score_test': json_pca_score_test,
        'json_pca_score_train': json_pca_score_train,
        'json_t2_time_series': json_t2_time_series,
        'json_q_time_series': json_q_time_series,
        'json_t2_contribution': df_t2_contr,
        'json_q_contribution': df_q_contr,
        'json_pca_biplot': json_pca_biplot}
    return output_dict


def _convert_df_circles_to_dict(df_circles) -> dict:
    ''' Convert dataframe of circles to dictionary, to pass it to plotly
    '''
    dic_circles = {}
    for label in df_circles['border'].unique():
        dic_circles[label] = {'x': [], 'y': []}
        idx = np.where(df_circles['border'].values == label)[0]
        dic_circles[label]['x'] = df_circles['pc1.x'].values[idx]
        dic_circles[label]['y'] = df_circles['pc2.y'].values[idx]
    return dic_circles


def _extract_clicked_sample(df_train, df_test, sample_no=0):
    ''' Extract a row from train/test data, according to given sample_no
    '''

    if sample_no >= 0:
        return df_test[sample_no, :]
    else:
        return df_train[sample_no + df_train.shape[0], :]
