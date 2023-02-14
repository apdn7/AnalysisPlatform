import numpy as np
import pandas as pd
from ap.common.logger import logger
from scipy.linalg import pinv
from scipy.signal import convolve2d
from scipy.stats import gaussian_kde, binned_statistic_2d
from sklearn.preprocessing import StandardScaler

from ap.api.setting_module.services.data_import import ALL_SYMBOLS
from ap.api.trace_data.services.time_series_chart import (get_data_from_db, get_chart_infos,
                                                          gen_plotdata, make_irregular_data_none,
                                                          get_procs_in_dic_param, gen_dic_data_from_df,
                                                          main_check_filter_detail_match_graph_data,
                                                          calc_raw_common_scale_y, calc_scale_info,
                                                          get_serial_and_datetime_data)
from ap.common.constants import ARRAY_FORMVAL, ARRAY_PLOTDATA, ACTUAL_RECORD_NUMBER, \
    UNIQUE_SERIAL, ARRAY_Y, MATCHED_FILTER_IDS, UNMATCHED_FILTER_IDS, NOT_EXACT_MATCH_FILTER_IDS, \
    END_PROC, \
    GET02_VALS_SELECT, END_COL_ID, CORRS, CORR, PCORR, ARRAY_X, SCALE_SETTING, KDE_DATA, NTOTALS, \
    NORMAL_MODE_MAX_RECORD, CYCLE_IDS, PROC_NAME, \
    COL_DETAIL, COL_TYPE, DataTypeEncode, ORG_ARRAY_Y, SCALE_COMMON, SCALE_THRESHOLD, \
    SCALE_AUTO, SCALE_FULL, SERIALS, DATETIME, START_PROC
from ap.common.memoize import memoize
from ap.common.services.ana_inf_data import calculate_kde, calculate_kde_trace_data
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import abort_process_handler
from ap.common.services.sse import notify_progress
from ap.common.sigificant_digit import signify_digit, get_fmt_from_array
from ap.common.trace_data_log import *
from ap.trace_data.models import Cycle


@log_execution_time('[MULTI SCATTER PLOT]')
@abort_process_handler()
@notify_progress(60)
@trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
           (EventType.MSP, EventAction.PLOT, Target.GRAPH), send_ga=True)
@memoize(is_save_file=True)
def gen_scatter_plot(dic_param):
    """tracing data to show graph
        1 start point x n end point
        filter by condition points that between start point and end_point
    """
    # bind dic_param
    graph_param = bind_dic_param_to_class(dic_param)

    # add start proc
    # graph_param.add_start_proc_to_array_formval()

    # add condition procs
    # graph_param.add_cond_procs_to_array_formval()

    dic_proc_cfgs = get_procs_in_dic_param(graph_param)

    # add datetime col
    graph_param.add_datetime_col_to_start_proc()
    dic_proc_name = {}
    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        # serial_ids = [serial.id for serial in proc_cfg.get_serials(column_name_only=False)]
        # proc.add_cols(serial_ids)
        dic_proc_name[proc.proc_id] = proc_cfg.name

    # get data from database
    df, actual_record_number, unique_serial = get_data_from_db(graph_param)

    # check filter match or not ( for GUI show )
    matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids = main_check_filter_detail_match_graph_data(
        graph_param, df)

    # matched_filter_ids, unmatched_filter_ids, not_exact_match_filter_ids
    dic_param[MATCHED_FILTER_IDS] = matched_filter_ids
    dic_param[UNMATCHED_FILTER_IDS] = unmatched_filter_ids
    dic_param[NOT_EXACT_MATCH_FILTER_IDS] = not_exact_match_filter_ids
    dic_param[PROC_NAME] = dic_proc_name

    # create output data
    orig_graph_param = bind_dic_param_to_class(dic_param)
    dic_data = gen_dic_data_from_df(df, orig_graph_param)
    times = df[Cycle.time.key].tolist() or []

    # TODO: ask Tinh san how about serial hover
    # gen_dic_serial_data_scatter(df, dic_proc_cfgs, dic_param)

    # get chart infos
    chart_infos, chart_infos_org = get_chart_infos(orig_graph_param, dic_data, times)

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] = \
        gen_plotdata(orig_graph_param, dic_data, chart_infos, chart_infos_org, reorder=False)
    dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number

    if Cycle.id.key in df.columns:
        dic_param[CYCLE_IDS] = df.id.tolist()

    # calculate_summaries
    # calc_summaries(dic_param)

    # scale settings
    # min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(dic_param[ARRAY_PLOTDATA])
    # calc_scale_info(dic_param[ARRAY_PLOTDATA], min_max_list, all_graph_min, all_graph_max)

    # flag to show that trace result was limited
    dic_param[UNIQUE_SERIAL] = unique_serial

    # convert irregular data
    make_irregular_data_none(dic_param)

    # remove none data points
    # remove_none_data(dic_param)

    gen_scale_info(dic_param)

    # partial correlation
    calc_partial_corr(dic_param)

    serial_data, datetime_data, start_proc_name = get_serial_and_datetime_data(df, graph_param, dic_proc_cfgs)
    dic_param[SERIALS] = serial_data
    dic_param[DATETIME] = datetime_data
    dic_param[START_PROC] = start_proc_name

    return dic_param, dic_data


@log_execution_time()
@abort_process_handler()
# @trace_log((TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
#            (EventType.MSP, EventAction.PLOT, Target.GRAPH), send_ga=True)
def gen_kde_data(dic_param):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    dic_param['hist_data'] = []
    for num, plotdata in enumerate(array_plotdata):
        array_plotdata_y = plotdata.get(ARRAY_Y)
        # todo: add plotdata.scale_options befre calc kde
        # hist_data = calculate_kde_trace_data(plotdata)
        hist_data = calculate_kde(array_plotdata_y, use_hist_counts=True, bins=128)
        dic_param['hist_data'].append(hist_data)
    return dic_param


@log_execution_time()
@abort_process_handler()
def remove_none_data(dic_param):
    num_sensors = len(dic_param.get(ARRAY_PLOTDATA) or [])
    if not num_sensors or not dic_param[ARRAY_PLOTDATA][0] or not len(dic_param[ARRAY_PLOTDATA][0].get(ARRAY_Y) or []):
        return

    # find none vals
    array_ys = zip(*[dic_param[ARRAY_PLOTDATA][ss].get(ARRAY_Y) or [] for ss in range(num_sensors)])
    list_nones = [idx for idx, vals in enumerate(array_ys) if any([v is None or np.isnan(v) for v in vals])]

    # remove none vals
    num_points = len(dic_param[ARRAY_PLOTDATA][0].get(ARRAY_Y) or [])
    for ss in range(num_sensors):
        array_y = dic_param[ARRAY_PLOTDATA][ss][ARRAY_Y]
        dic_param[ARRAY_PLOTDATA][ss][ARRAY_Y] = [array_y[i] for i in range(num_points) if i not in list_nones]


@log_execution_time()
@abort_process_handler()
def gen_scatter_n_contour_data_pair(dic_param, array_y1, array_y2, use_contour, show_contour_limit):
    # parameters
    num_bins = 50  # 50 x 50 cells
    outlier_ratio = 0.05  # ratio for number of points to plot
    max_num_points = 1000  # maximum number of points for scatter plot
    max_num_points_kde = 10000  # maximum number of points for kde

    df = pd.DataFrame({'array_y1': array_y1, 'array_y2': array_y2,
                       DATETIME: dic_param[DATETIME], SERIALS: dic_param[SERIALS][0], CYCLE_IDS: dic_param[CYCLE_IDS]})
    df = df.replace(dict.fromkeys([np.inf, -np.inf, np.nan], np.nan)).dropna()
    array_y1 = df['array_y1'].to_numpy()
    array_y2 = df['array_y2'].to_numpy()
    datetime = df[DATETIME].to_numpy()
    serials = df[SERIALS].to_numpy()
    cycle_ids = df[CYCLE_IDS].to_numpy()

    contour_data = {
        'x': [],
        'y': [],
        'z': [],
        'contours_coloring': 'heatmap',
        'line_width': 0
    }
    scatter_data = {
        'x': [],
        'y': [],
        'mode': 'markers'
    }

    if len(array_y1) < 2 or len(array_y2) < 2:
        return [contour_data, scatter_data]

    try:
        # fit kde and generate/evaluate gridpoints
        kernel = fit_2d_kde(array_y1, array_y2, max_num_points_kde)
        hist = calc_2d_hist(array_y1, array_y2, num_bins)
        kde_gridpoints, x_grid, y_grid = calc_kde_gridpoints(kernel, hist.x_edge, hist.y_edge)

        # for contour: store x-y value and density of each gridpoints
        # dic_contour = {'x': x_grid, 'y': y_grid, 'z': kde_gridpoints.ravel()} # TODO comment out for now

        if len(array_y1) < show_contour_limit and not use_contour:
            # return full point
            scatter_data = {
                'x': array_y1,
                'y': array_y2,
                DATETIME: datetime,
                SERIALS: [serials],
                CYCLE_IDS: cycle_ids,
                'x_fmt': get_fmt_from_array(array_y1),
                'y_fmt': get_fmt_from_array(array_y2),
                'mode': 'markers'
            }

        if len(array_y1) >= show_contour_limit or use_contour:
            # return contour;
            num_outliers = np.min([int(len(array_y1) * outlier_ratio), max_num_points])
            flg_outlier = get_outlier_flg(hist, kde_gridpoints, num_outliers, num_bins)
            # normalize and change to log scale (fit to Logarithm)
            z_value = np.log(kde_gridpoints.ravel() / np.max(kde_gridpoints.ravel()) * 1000 + 1)
            datetime = datetime[flg_outlier] if len(datetime) == len(array_y1) else []
            serials = serials[flg_outlier] if len(serials) == len(array_y1) else []
            cycle_ids = cycle_ids[flg_outlier] if len(cycle_ids) == len(array_y1) else []
            contour_data = {
                'x': x_grid,
                'y': y_grid,
                'z': z_value,
                'x_fmt': get_fmt_from_array(x_grid),
                'y_fmt': get_fmt_from_array(y_grid),
                'z_fmt': get_fmt_from_array(z_value),
                'contours_coloring': 'heatmap',
                'line_width': 1
            }

            scatter_data = {
                'x': array_y1[flg_outlier],
                'y': array_y2[flg_outlier],
                DATETIME: datetime,
                SERIALS: [serials],
                CYCLE_IDS: cycle_ids,
                'x_fmt': get_fmt_from_array(array_y1[flg_outlier]),
                'y_fmt': get_fmt_from_array(array_y2[flg_outlier]),
                'mode': 'markers'
            }

    except Exception as ex:
        logger.exception(ex)

    return [contour_data, scatter_data]


@log_execution_time()
@abort_process_handler()
def fit_2d_kde(x, y, max_num_points_kde=10000):
    """
    Fit density estimator
    scipy.stats.gaussian_kde is used.

    Parameters
    ----------
    x, y: array
        Raw data
    max_num_points_kde: int
        x and y is under-sampled to this length

    Returns
    -------
    kernel:
        Fitted gaussian_kde
    """

    idx_sample = np.arange(len(x))
    if len(x) > max_num_points_kde:
        idx_sample = np.random.choice(np.arange(len(x)), size=max_num_points_kde)
    x = x[idx_sample].copy()
    y = y[idx_sample].copy()

    # add jitter when x and y have almost complete linear correlation, or constant value
    x, y = add_jitter_for_kde(x, y)

    kernel = gaussian_kde(np.vstack((x, y)))
    # kde with Silverman bandwidth estimation method
    # kernel = gen_gaussian_kde_1d_same_as_r(np.vstack((x, y)))
    return kernel


@log_execution_time()
@abort_process_handler()
def add_jitter_for_kde(x, y):
    """
    Add jitter (random noise) to x, y
    If x, y have almost complete linear correlation, or constant value.
    This is due to usage of inverse covariance matrix in gaussian_kde()

    Parameters
    ----------
    x, y: array
        Raw data

    Returns
    -------
    x_, y_: array
        Added jitter if necessary
    """

    xrng = (np.nanmax(x) - np.nanmin(x))
    yrng = (np.nanmax(y) - np.nanmin(y))

    add_jitter = False
    if (xrng == 0.0) or (yrng == 0.0):
        add_jitter = True
    elif np.abs(np.corrcoef(x, y)[0, 1]) > 0.999:
        # corrcoef returns nan if y or x is constant
        add_jitter = True

    if add_jitter:
        x_offset = xrng / 50
        y_offset = yrng / 50
        x_offset = x_offset if xrng > 0.0 else 0.01
        y_offset = y_offset if yrng > 0.0 else 0.01
        x_ = x + np.random.uniform(-x_offset, x_offset, len(x))
        y_ = y + np.random.uniform(-y_offset, y_offset, len(y))
        return x_, y_

    return x, y


@log_execution_time()
@abort_process_handler()
def calc_2d_hist(x, y, num_bins):
    """
    Calculate 2D histogram
    scipy.stats.binned_statistic_2d is used.

    Parameters
    ----------
    x, y: array
        Raw data
    num_bins: int
        Total number of cells = num_bins^2

    Returns
    -------
    hist:
        Fitted 2D histogram.
        Counts for each cell, and x-y value for binning is contained.
    """

    # range of x and y
    xmin = np.nanmin(x)
    xmax = np.nanmax(x)
    ymin = np.nanmin(y)
    ymax = np.nanmax(y)

    # 2D histogram. TypeError when values=None
    # https://stackoverflow.com/questions/60623899/why-is-binned-statistic-2d-now-throwing-typeerror
    hist = binned_statistic_2d(x=x, y=y, values=x, statistic='count',
                               bins=num_bins, range=[[xmin, xmax], [ymin, ymax]])
    return hist


@log_execution_time()
@abort_process_handler()
def calc_kde_gridpoints(kernel, x_edge, y_edge):
    """
    Calculate density values on each gridpoint

    Parameters
    ----------
    kernel:
        Fitted density estimator
    x_edge, y_edge: array
        Vales fo binning

    Returns
    -------
    kde_gridpoints: array
        Density values on each gridpoint
        shape = len(x_edge), len(y_edge)
    x_grid, y_grid: array
        x-y values of each gridpoint
        len = len(x_edge) * len(y_edge)
    """

    # calculate density of each gridpoints
    x_grid, y_grid = np.meshgrid(x_edge, y_edge)
    x_grid = x_grid.ravel()
    y_grid = y_grid.ravel()
    kde_gridpoints = kernel(np.vstack((x_grid, y_grid))).reshape((len(x_edge), len(y_edge)))
    return kde_gridpoints, x_grid, y_grid


@log_execution_time()
@abort_process_handler()
def get_outlier_flg(hist, kde_gridpoints, num_outliers, num_bins):
    """
    Get outlier flag of each data point
    Data with low density is estimated as outliers.

    Parameters
    ----------
    hist:
        Fitted 2D histogram
    kde_gridpoints: array
        Density values on each gridpoint
    num_outliers: int
        Number of outliers to show in scatter plot

    Returns
    -------
    flg_outlier: array
        True/False values
    """

    num_cells = hist.statistic.shape[0]

    # we have to be careful that
    # `hist.binnumber` returns bin index of (num_bins+2, num_bins+2) array,
    # where +2 is for boundaries of each dimension
    # https://stackoverflow.com/questions/31708773/translate-scipy-stats-binned-statistic-2ds-binnumber-to-a-x-y-bin
    idx_cells_scipy = (np.arange(0, (num_cells + 2) ** 2)).reshape(num_cells + 2, num_cells + 2)
    idx_cells_scipy = idx_cells_scipy[1:(num_cells + 1), 1:(num_cells + 1)].ravel()

    # density of each cells (average of surrounding girdpoints)
    ave_filter = np.ones((2, 2)) / 4.0
    kde_cells = convolve2d(ave_filter, kde_gridpoints, mode='valid')

    cnts = hist.statistic.ravel()
    idx_cells = np.argsort(kde_cells.T.ravel())

    csum = 0
    for k, cell in enumerate(idx_cells):
        csum += cnts[cell]
        if csum > num_outliers:
            break

    idx_outlier_cells = idx_cells_scipy[idx_cells[:(k + 1)]]
    flg_outlier = np.isin(hist.binnumber, idx_outlier_cells)
    return flg_outlier


@log_execution_time()
@abort_process_handler()
def gen_scatter_n_contour_data(dic_param: dict, dic_data, use_contour):
    scatter_contours = {}
    array_formval = dic_param[ARRAY_FORMVAL]
    num_sensor = len(array_formval)
    adjust = 0.7
    combi_count = num_sensor * (num_sensor - 1) / 2
    show_contour_limit = round(NORMAL_MODE_MAX_RECORD / (pow(combi_count, adjust) or 1))
    for i in range(num_sensor - 1):
        c_idx = i + 1
        array_formval_i = array_formval[i]
        proc_id_i = array_formval_i.get(END_PROC)
        col_id_i = array_formval_i.get(GET02_VALS_SELECT)
        array_y_i = dic_data[proc_id_i][col_id_i]

        for k in range(i + 1, num_sensor):
            r_idx = k + 1
            array_formval_k = array_formval[k]
            proc_id_k = array_formval_k.get(END_PROC)
            col_id_k = array_formval_k.get(GET02_VALS_SELECT)
            array_y_k = dic_data[proc_id_k][col_id_k]

            contour_data, scatter_data = \
                gen_scatter_n_contour_data_pair(dic_param, array_y_i, array_y_k, use_contour, show_contour_limit)
            scatter_contours['{}-{}'.format(r_idx, c_idx)] = {
                'contour_data': contour_data,
                'scatter_data': scatter_data,
                'proc_id_x': proc_id_i,
                'col_id_x': col_id_i,
                'proc_id_y': proc_id_k,
                'col_id_y': col_id_k,
            }

    return scatter_contours, show_contour_limit


@log_execution_time()
@abort_process_handler()
def partial_corr(data):
    # transpose dataframe before compute correlation
    # correlation_mat = np.corrcoef(data.T)
    correlation_mat = np.cov(data.T, ddof=0)
    # It is safer to calculate inverse by (Moore-Penrose) pseudo inverse, in case of singular matrix
    precision_mat = pinv(correlation_mat)

    parcor_mat = np.zeros_like(correlation_mat)
    np.fill_diagonal(parcor_mat, np.diag(correlation_mat))

    rowidx, colidx = np.triu_indices(parcor_mat.shape[0])
    for i, j in zip(rowidx, colidx):
        if i == j:
            continue
        parcor = - precision_mat[i, j] / np.sqrt(precision_mat[i, i] * precision_mat[j, j])
        parcor_mat[i, j] = parcor
        parcor_mat[j, i] = parcor

    return parcor_mat, correlation_mat


def get_org_plotdat(plotdat):
    # get origin value from integer column instead of encoded value
    # to compute the correlation between variables
    if not len(plotdat[ARRAY_Y]):
        return []

    data = plotdat[ARRAY_Y]
    # use origin data for integer column only
    if COL_DETAIL and ORG_ARRAY_Y in plotdat and \
            plotdat[COL_DETAIL][COL_TYPE] == DataTypeEncode.INTEGER.name:
        data = plotdat[ORG_ARRAY_Y]

    return data


@log_execution_time()
@abort_process_handler()
def calc_partial_corr(dic_param):
    plot_list = {}
    for plotdata in dic_param[ARRAY_PLOTDATA]:
        plot_list[plotdata[END_COL_ID]] = get_org_plotdat(plotdata)
        if ORG_ARRAY_Y in plotdata:
            del plotdata[ORG_ARRAY_Y]
    df = pd.DataFrame(plot_list)
    columns = df.columns.to_list()

    corrs = {
        CORR: {},  # correlation coefficient
        PCORR: {},  # partial correlation
        NTOTALS: {}
    }

    pairs = []
    for k, col in enumerate(columns):
        corrs[CORR][col] = {}
        corrs[PCORR][col] = {}
        corrs[NTOTALS][col] = {}
        for i, row in enumerate(columns):
            df_pair = df[[col, row]]
            df_pair = df_pair.replace(dict.fromkeys(ALL_SYMBOLS, np.nan)).dropna()
            pairs.append(df_pair)

    for pair in pairs:
        if pair.shape[0]:
            pair_columns = pair.columns.to_list()
            scaler = StandardScaler()
            data = scaler.fit_transform(pair)
            p_corr_mat, corr_mat = partial_corr(data)
            for k, col in enumerate(pair_columns):
                for i, row in enumerate(pair_columns):
                    corrs[CORR][col][row] = corr_mat[k][i]
                    corrs[PCORR][col][row] = signify_digit(p_corr_mat[k][i])
                    corrs[NTOTALS][col][row] = pair.shape[0]

    dic_param[CORRS] = corrs
    return dic_param


def remove_unused_params(dic_param):
    for plot_data in dic_param[ARRAY_PLOTDATA]:
        del plot_data[ARRAY_X]
        del plot_data[ARRAY_Y]

    # del dic_param[SERIAL_DATA]
    # del dic_param[TIMES]

    return dic_param


def gen_scale_info(dic_param):
    # generate kde for each trace output array
    # dic_param = gen_kde_data_trace_data(dic_param)
    array_plotdata = dic_param.get(ARRAY_PLOTDATA, [])
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(array_plotdata)
    calc_scale_info(array_plotdata, min_max_list, all_graph_min, all_graph_max)
    for plotdata in array_plotdata:
        plotdata[SCALE_SETTING][KDE_DATA], plotdata[SCALE_COMMON][KDE_DATA], \
            plotdata[SCALE_THRESHOLD][KDE_DATA], plotdata[SCALE_AUTO][KDE_DATA], \
            plotdata[SCALE_FULL][KDE_DATA] = calculate_kde_trace_data(plotdata)


def clear_unused_data(dic_param):
    for plot_data in dic_param.get(ARRAY_PLOTDATA, []):
        del plot_data[ARRAY_Y]
        del plot_data[ARRAY_X]
    return dic_param