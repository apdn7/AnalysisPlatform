import logging

import numpy as np
import pandas as pd
from scipy.linalg import pinv
from scipy.signal import convolve2d
from scipy.stats import binned_statistic_2d, gaussian_kde
from sklearn.preprocessing import StandardScaler

from ap.api.common.services.show_graph_services import (
    calc_raw_common_scale_y,
    calc_scale_info,
    customize_dic_param_for_reuse_cache,
    filter_cat_dict_common,
    gen_plotdata,
    get_chart_infos,
    get_data_from_db,
    get_filter_on_demand_data,
    get_serial_and_datetime_data,
    main_check_filter_detail_match_graph_data,
    make_irregular_data_none,
)
from ap.api.setting_module.services.data_import import ALL_SYMBOLS
from ap.api.trace_data.services.time_series_chart import (
    gen_dic_data_from_df,
)
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ARRAY_FORMVAL,
    ARRAY_PLOTDATA,
    ARRAY_X,
    ARRAY_Y,
    AS_HEATMAP_MATRIX,
    COL_DETAIL,
    CORR,
    CORRS,
    CYCLE_IDS,
    DATETIME,
    END_COL_ID,
    END_COL_SHOW_NAME,
    END_PROC,
    END_PROC_ID,
    GET02_VALS_SELECT,
    HEATMAP_MATRIX,
    IS_INT_CATEGORY,
    KDE_DATA,
    MATCHED_FILTER_IDS,
    MSP_AS_HEATMAP_FROM,
    MSP_CONTOUR_ADJUST,
    NORMAL_MODE_MAX_RECORD,
    NOT_EXACT_MATCH_FILTER_IDS,
    NTOTALS,
    ORG_ARRAY_Y,
    PCORR,
    PROC_NAME,
    REMOVED_OUTLIERS,
    ROWID,
    SCALE_AUTO,
    SCALE_COMMON,
    SCALE_FULL,
    SCALE_SETTING,
    SCALE_THRESHOLD,
    SERIALS,
    START_PROC,
    TIME_COL,
    UNIQUE_SERIAL,
    UNMATCHED_FILTER_IDS,
    CacheType,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache, OptionalCacheConfig
from ap.common.services.ana_inf_data import calculate_kde_trace_data
from ap.common.services.form_env import bind_dic_param_to_class
from ap.common.services.request_time_out_handler import (
    abort_process_handler,
    request_timeout_handling,
)
from ap.common.services.sse import MessageAnnouncer
from ap.common.sigificant_digit import get_fmt_from_array, signify_digit
from ap.common.trace_data_log import EventAction, EventType, Target, TraceErrKey, trace_log

logger = logging.getLogger(__name__)


@log_execution_time('[MULTI SCATTER PLOT]')
@request_timeout_handling()
@abort_process_handler()
@MessageAnnouncer.notify_progress(60)
@trace_log(
    (TraceErrKey.TYPE, TraceErrKey.ACTION, TraceErrKey.TARGET),
    (EventType.MSP, EventAction.PLOT, Target.GRAPH),
    send_ga=True,
)
@CustomCache.memoize(cache_type=CacheType.TRANSACTION_DATA)
def gen_scatter_plot(graph_param, dic_param, df=None, custom_order=None):
    """tracing data to show graph
    1 start point x n end point
    filter by condition points that between start point and end_point
    """
    (
        dic_param,
        cat_exp,
        cat_procs,
        dic_cat_filters,
        use_expired_cache,
        *_,
    ) = customize_dic_param_for_reuse_cache(dic_param)

    dic_proc_cfgs = graph_param.dic_proc_cfgs

    # add datetime col
    graph_param.add_datetime_col_to_start_proc()
    dic_proc_name = {}
    # get serials
    for proc in graph_param.array_formval:
        proc_cfg = dic_proc_cfgs[proc.proc_id]
        dic_proc_name[proc.proc_id] = proc_cfg.shown_name

    if df is None:
        # get data from database
        df, actual_record_number, unique_serial = get_data_from_db(
            graph_param,
            dic_cat_filters,
            optional_cache_config=OptionalCacheConfig(use_expired_cache=use_expired_cache),
        )
        dic_param[ACTUAL_RECORD_NUMBER] = actual_record_number
        dic_param[UNIQUE_SERIAL] = unique_serial
        dic_param[REMOVED_OUTLIERS] = graph_param.common.outliers

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
    dic_param[PROC_NAME] = dic_proc_name

    # create output data
    orig_graph_param = bind_dic_param_to_class(
        graph_param.dic_proc_cfgs,
        graph_param.trace_graph,
        graph_param.dic_card_orders,
        dic_param,
    )
    dic_data = gen_dic_data_from_df(df, orig_graph_param)
    times = df[TIME_COL]

    # get chart infos
    chart_infos, chart_infos_org = get_chart_infos(orig_graph_param, dic_data, times)

    dic_param[ARRAY_FORMVAL], dic_param[ARRAY_PLOTDATA] = gen_plotdata(
        orig_graph_param,
        dic_data,
        chart_infos,
        chart_infos_org,
        reorder=False,
        custom_order=custom_order,
    )

    if ROWID in df.columns:
        dic_param[CYCLE_IDS] = df.rowid

    # convert irregular data
    make_irregular_data_none(dic_param)

    gen_scale_info(graph_param.dic_proc_cfgs, dic_param)

    # partial correlation
    calc_partial_corr(dic_param)

    serial_data, datetime_data, start_proc_name = get_serial_and_datetime_data(df, graph_param, dic_proc_cfgs)
    dic_param[SERIALS] = serial_data
    dic_param[DATETIME] = datetime_data
    dic_param[START_PROC] = start_proc_name

    # msp as heatmap matrix
    # in case of variables number > MSP_AS_HEATMAP_FROM
    gen_heatmap_data_from_msp(dic_param, dic_proc_cfgs)

    dic_param = get_filter_on_demand_data(dic_param)

    return dic_param, dic_data


@log_execution_time()
@abort_process_handler()
def gen_scatter_n_contour_data_pair(dic_param, array_y1, array_y2, use_contour, is_show_contour_only):
    # parameters
    num_bins = 50  # 50 x 50 cells
    outlier_ratio = 0.05  # ratio for number of points to plot
    max_num_points = 1000  # maximum number of points for scatter plot
    max_num_points_kde = 10000  # maximum number of points for kde

    data = {
        'array_y1': array_y1,
        'array_y2': array_y2,
        DATETIME: dic_param[DATETIME],
    }

    if len(dic_param[SERIALS]) > 0:
        data[SERIALS] = dic_param[SERIALS][0]

    if CYCLE_IDS in dic_param:
        data[CYCLE_IDS] = dic_param[CYCLE_IDS]

    df = pd.DataFrame(data)
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    array_y1 = df['array_y1'].to_numpy(dtype=float)
    array_y2 = df['array_y2'].to_numpy(dtype=float)
    datetime = df[DATETIME].to_numpy()
    serials = df[SERIALS].to_numpy() if SERIALS in df.columns else []
    cycle_ids = df[CYCLE_IDS].to_numpy() if CYCLE_IDS in df.columns else []

    contour_data = {'x': [], 'y': [], 'z': [], 'contours_coloring': 'heatmap', 'line_width': 0}
    scatter_data = {'x': [], 'y': [], 'mode': 'markers'}

    limit_min = 2
    if len(array_y1) < limit_min or len(array_y2) < limit_min:
        return [contour_data, scatter_data]

    try:
        # fit kde and generate/evaluate gridpoints
        kernel = fit_2d_kde(array_y1, array_y2, max_num_points_kde)
        hist = calc_2d_hist(array_y1, array_y2, num_bins)
        kde_gridpoints, x_grid, y_grid = calc_kde_gridpoints(kernel, hist.x_edge, hist.y_edge)

        # for contour: store x-y value and density of each gridpoints
        # dic_contour = {'x': x_grid, 'y': y_grid, 'z': kde_gridpoints.ravel()} # TODO comment out for now

        if not is_show_contour_only and not use_contour:
            # return full point
            scatter_data = {
                'x': array_y1,
                'y': array_y2,
                DATETIME: datetime,
                SERIALS: [serials],
                CYCLE_IDS: cycle_ids,
                'x_fmt': get_fmt_from_array(array_y1),
                'y_fmt': get_fmt_from_array(array_y2),
                'mode': 'markers',
            }

        if is_show_contour_only or use_contour:
            # return contour;
            num_outliers = np.min([int(len(array_y1) * outlier_ratio), max_num_points])
            flg_outlier = get_outlier_flg(hist, kde_gridpoints, num_outliers, num_bins)
            # normalize and change to log scale (fit to Logarithm)
            z_value = np.log(kde_gridpoints.ravel() / np.max(kde_gridpoints.ravel()) * 1000 + 1)
            datetime = datetime[flg_outlier] if len(datetime) == len(array_y1) else pd.Series()
            serials = serials[flg_outlier] if len(serials) == len(array_y1) else pd.Series()
            cycle_ids = cycle_ids[flg_outlier] if len(cycle_ids) == len(array_y1) else pd.Series()
            contour_data = {
                'x': x_grid,
                'y': y_grid,
                'z': z_value,
                'x_fmt': get_fmt_from_array(x_grid),
                'y_fmt': get_fmt_from_array(y_grid),
                'z_fmt': get_fmt_from_array(z_value),
                'contours_coloring': 'heatmap',
                'line_width': 1,
            }

            scatter_data = {
                'x': array_y1[flg_outlier],
                'y': array_y2[flg_outlier],
                DATETIME: datetime,
                SERIALS: [serials],
                CYCLE_IDS: cycle_ids,
                'x_fmt': get_fmt_from_array(array_y1[flg_outlier]),
                'y_fmt': get_fmt_from_array(array_y2[flg_outlier]),
                'mode': 'markers',
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
        # TODO: use np.random.default_rng(seed=610) https://numpy.org/doc/stable/reference/random/generated/numpy.random.seed.html
        np.random.seed(610)  # noqa: NPY002
        idx_sample = np.random.choice(np.arange(len(x)), size=max_num_points_kde)  # noqa: NPY002
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
    rng = np.random.default_rng()

    xrng = np.nanmax(x) - np.nanmin(x)
    yrng = np.nanmax(y) - np.nanmin(y)

    add_jitter = False
    min_val = 0.0
    max_val = 0.999
    if xrng == min_val or yrng == min_val or np.abs(np.corrcoef(x, y)[0, 1]) > max_val:
        add_jitter = True

    if add_jitter:
        x_offset = xrng / 50
        y_offset = yrng / 50
        x_offset = x_offset if xrng > min_val else 0.01
        y_offset = y_offset if yrng > min_val else 0.01
        x_ = x + rng.uniform(-x_offset, x_offset, len(x))
        y_ = y + rng.uniform(-y_offset, y_offset, len(y))
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

    qx = np.quantile(x, [0.0, 0.25, 0.75, 1.0], interpolation='midpoint')  # noqa
    min_x, q1_x, q3_x, max_x = qx[:4]
    iqr_x = q3_x - q1_x

    qy = np.quantile(y, [0.0, 0.25, 0.75, 1.0], interpolation='midpoint')  # noqa
    min_y, q1_y, q3_y, max_y = qy[:4]
    iqr_y = q3_y - q1_y

    xmin = np.nanmin([min_x, q1_x - 2.5 * iqr_x])  # noqa
    xmax = np.nanmax([max_x, q3_x + 2.5 * iqr_x])  # noqa
    ymin = np.nanmin([min_y, q1_y - 2.5 * iqr_y])  # noqa
    ymax = np.nanmax([max_y, q3_y + 2.5 * iqr_y])  # noqa

    # 2D histogram. TypeError when values=None
    # https://stackoverflow.com/questions/60623899/why-is-binned-statistic-2d-now-throwing-typeerror
    hist = binned_statistic_2d(
        x=x,
        y=y,
        values=x,
        statistic='count',
        bins=num_bins,
        range=[[xmin, xmax], [ymin, ymax]],
    )  # noqa
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
    idx_cells_scipy = idx_cells_scipy[1 : (num_cells + 1), 1 : (num_cells + 1)].ravel()

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

    idx_outlier_cells = idx_cells_scipy[idx_cells[: (k + 1)]]
    flg_outlier = np.isin(hist.binnumber, idx_outlier_cells)
    return flg_outlier


@log_execution_time()
@abort_process_handler()
def gen_scatter_n_contour_data(dic_param: dict, dic_data, use_contour):
    scatter_contours = {}
    array_formval = dic_param[ARRAY_FORMVAL]
    num_sensor = len(array_formval)
    adjust = MSP_CONTOUR_ADJUST
    combi_count = num_sensor * (num_sensor - 1) / 2
    show_contour_limit = round(NORMAL_MODE_MAX_RECORD / (pow(combi_count, adjust) or 1))

    is_show_contour_only = len(dic_param[DATETIME]) >= show_contour_limit
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

            contour_data, scatter_data = gen_scatter_n_contour_data_pair(
                dic_param,
                array_y_i,
                array_y_k,
                use_contour,
                is_show_contour_only,
            )
            scatter_contours['{}-{}'.format(r_idx, c_idx)] = {
                'contour_data': contour_data,
                'scatter_data': scatter_data,
                'proc_id_x': proc_id_i,
                'col_id_x': col_id_i,
                'proc_id_y': proc_id_k,
                'col_id_y': col_id_k,
            }

    return scatter_contours, is_show_contour_only


@log_execution_time()
def partial_corr(data, corr_only=False):
    # transpose dataframe before compute correlation
    # correlation_mat = np.corrcoef(data.T)
    correlation_mat = np.cov(data.T, ddof=0)
    if corr_only:
        return None, correlation_mat
    # It is safer to calculate inverse by (Moore-Penrose) pseudo inverse, in case of singular matrix
    precision_mat = pinv(correlation_mat)

    parcor_mat = np.zeros_like(correlation_mat)
    np.fill_diagonal(parcor_mat, np.diag(correlation_mat))

    rowidx, colidx = np.triu_indices(parcor_mat.shape[0])
    for i, j in zip(rowidx, colidx):
        if i == j:
            continue
        parcor = -precision_mat[i, j] / np.sqrt(precision_mat[i, i] * precision_mat[j, j])
        parcor_mat[i, j] = parcor
        parcor_mat[j, i] = parcor

    return parcor_mat, correlation_mat


def get_org_plotdat(plotdat):
    # get origin value from integer column instead of encoded value
    # to compute the correlation between variables
    if not len(plotdat[ARRAY_Y]):
        return []

    data = plotdat[ARRAY_Y]
    # use origin data for integer column only (unique<=128)
    if COL_DETAIL in plotdat and ORG_ARRAY_Y in plotdat and plotdat[COL_DETAIL][IS_INT_CATEGORY]:
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
    df = pd.DataFrame(plot_list).replace(dict.fromkeys(ALL_SYMBOLS, np.nan))
    columns = df.columns

    corrs = {CORR: {}, PCORR: {}, NTOTALS: {}}  # correlation coefficient  # partial correlation
    dic_param[CORRS] = corrs

    if df.empty:
        return dic_param

    scaler = StandardScaler()
    clean_df = df.dropna()
    p_corr_mat = None
    if len(clean_df):
        data = scaler.fit_transform(clean_df)
        p_corr_mat, _ = partial_corr(data)

    temp_corrs = {}
    for k, col in enumerate(columns):
        corrs[CORR][col] = {}
        corrs[PCORR][col] = {}
        corrs[NTOTALS][col] = {}
        for i, row in enumerate(columns):
            # get existing coors value of (col, row) in temp_corrs instead of re-calculate
            if (col, row) in temp_corrs:
                corrs[CORR][col][row], corrs[PCORR][col][row], corrs[NTOTALS][col][row] = temp_corrs[(col, row)]
                continue

            df_pair = df[[col, row]]
            df_pair = df_pair.dropna()
            if df_pair.empty:
                continue

            data = scaler.fit_transform(df_pair)
            _, corr_mat = partial_corr(data, corr_only=True)
            corrs[CORR][col][row] = corr_mat[0][1]
            corrs[PCORR][col][row] = signify_digit(p_corr_mat[k][i]) if p_corr_mat is not None else None
            corrs[NTOTALS][col][row] = df_pair.shape[0]

            # save CORR, PCORR, NTotale to temp_corrs
            temp_corrs[(col, row)] = (corrs[CORR][col][row], corrs[PCORR][col][row], corrs[NTOTALS][col][row])
            temp_corrs[(row, col)] = temp_corrs[(col, row)]

    dic_param[CORRS] = corrs
    return dic_param


def gen_scale_info(dic_proc_cfgs, dic_param):
    # generate kde for each trace output array
    # dic_param = gen_kde_data_trace_data(dic_param)
    array_plotdata = dic_param.get(ARRAY_PLOTDATA, [])
    min_max_list, all_graph_min, all_graph_max = calc_raw_common_scale_y(array_plotdata)
    calc_scale_info(dic_proc_cfgs, array_plotdata, min_max_list, all_graph_min, all_graph_max)

    if len(array_plotdata) <= MSP_AS_HEATMAP_FROM:
        for plotdata in array_plotdata:
            (
                plotdata[SCALE_SETTING][KDE_DATA],
                plotdata[SCALE_COMMON][KDE_DATA],
                plotdata[SCALE_THRESHOLD][KDE_DATA],
                plotdata[SCALE_AUTO][KDE_DATA],
                plotdata[SCALE_FULL][KDE_DATA],
            ) = calculate_kde_trace_data(plotdata)


def clear_unused_data(dic_param):
    for plot_data in dic_param.get(ARRAY_PLOTDATA, []):
        if ARRAY_Y in plot_data:
            del plot_data[ARRAY_Y]
        if ARRAY_X in plot_data:
            del plot_data[ARRAY_X]
    return dic_param


@log_execution_time()
def gen_heatmap_data_from_msp(dic_param, dic_proc_cfgs):
    dic_param[AS_HEATMAP_MATRIX] = False
    if len(dic_param[ARRAY_PLOTDATA]) > MSP_AS_HEATMAP_FROM:
        dic_param[AS_HEATMAP_MATRIX] = True
        x, z = [], []
        sensor_ids = [sensor[END_COL_ID] for sensor in dic_param[ARRAY_PLOTDATA]]
        y_sensor_ids = reversed(sensor_ids)
        for sensor_data in dic_param[ARRAY_PLOTDATA]:
            x_label = '{} | {}'.format(sensor_data[END_COL_SHOW_NAME], dic_proc_cfgs[sensor_data[END_PROC_ID]].name)
            x.append(x_label)

            # remove unused data
            sensor_data[ARRAY_X] = pd.Series()
            sensor_data[ARRAY_Y] = pd.Series()

        for id in y_sensor_ids:
            # in case there is no data
            if id not in dic_param[CORRS][CORR]:
                continue

            corr_data = dic_param[CORRS][CORR][id]
            z_data = [corr_data[_id] if _id != id else None for _id in sensor_ids]
            z.append(z_data)

        dic_param[HEATMAP_MATRIX] = {'x': x, 'y': x[::-1], 'z': z}
