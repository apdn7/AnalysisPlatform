#!/usr/bin/python3
import logging
from itertools import groupby

import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde, iqr

from ap.common.constants import *
from ap.common.logger import log_execution_time
from ap.common.services.request_time_out_handler import abort_process_handler
from ap.common.services.statistics import convert_series_to_number
from ap.common.sigificant_digit import get_fmt_from_array

logger = logging.getLogger(__name__)


def all_equal(iterable):
    g = groupby(iterable)
    return next(g, True) and not next(g, False)


@log_execution_time()
def calculate_kde_for_ridgeline(
    data, grid_points, height=1, use_range=False, use_hist_counts=False
):
    """
    Calculate KDE + Histogram bins + Histogram labels for an input array.
    :param data: input array
    :param height: high of the kde line
    :param grid_points: (tuple) special of xmin, xmax, x
    :param use_range: use range to show the y-axis
    :param use_hist_counts: use hist_counts to show histogram by line, do not use for RLP
    :return: KDE + Histogram bins + Histogram labels with 100 data points.
    """
    hist_counts = []

    data_np = pd.Series(data)
    data_np = data_np[data_np.notnull()].convert_dtypes()
    if not len(data_np):
        return gen_kde_result()

    data_np = convert_series_to_number(data_np)
    data_np = data_np[np.isfinite(data_np)]

    data = data_np.tolist()
    if not data:  # empty
        return gen_kde_result()
    else:
        try:
            # grid points
            (xmin, xmax, x) = grid_points
            histogram = (
                np.histogram(data, bins=x, range=(xmin, xmax))
                if use_range
                else np.histogram(data, bins=x)
            )
            std_value = np.std(data)
            if std_value == 0:
                # use histogram value from numpy
                g_kde_values = histogram[0]
            else:
                g_kde = gen_gaussian_kde_1d_same_as_r(data, std_value)
                g_kde_values = g_kde(x) * height

            if use_hist_counts:
                hist_counts = histogram[0].tolist()
            return gen_kde_result(g_kde_values.tolist(), x.tolist(), hist_counts)
        except Exception:
            return gen_kde_result()


@log_execution_time()
def gen_kde_result(kde=(), hist_labels=(), hist_counts=()):
    return {
        'kde': kde,
        'hist_labels': hist_labels,
        'hist_counts': hist_counts,
        'label_fmt': get_fmt_from_array(hist_labels),
    }


@log_execution_time()
def calculate_kde_trace_data(plotdata, bins=128, height=1, full_array_y=None):
    """
    :param plotdata:
    :param bins:
    :param height:
    :param full_array_y:
    :param remove_abnormal_count:
    :return:
    """
    kde_list = []
    scales = [SCALE_SETTING, SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL]

    if full_array_y is None:
        data = plotdata[ARRAY_Y]
    else:
        data = full_array_y

    hist_counts = []
    # remove inf, nan in data
    data = pd.Series(data)

    if data.dtypes == object:
        return [gen_kde_result() for _ in scales]

    data = data[data.notnull()]

    if not len(data):
        kde = gen_kde_result()
        return [kde] * 5

    data = convert_series_to_number(data)
    data = data[np.isfinite(data)]
    if full_array_y and len(data) > 10_000:
        sample_data = resample_preserve_min_med_max(data, RESAMPLING_SIZE - 1).tolist()
    else:
        sample_data = data.tolist()

    if not sample_data:
        kde = gen_kde_result()
        return [kde] * 5

    # only_one_point = False
    # if np.unique(sample_data).size == 1:
    #     only_one_point = True

    for scale in scales:
        scale_info = plotdata.get(scale)
        if not scale_info:
            kde = gen_kde_result()
            kde_list.append(kde)
            continue
        # if scale = SCALE_THRESHOLD -> SCALE_THRESHOLD * 10% margin
        y_min = scale_info[Y_MIN]
        y_max = scale_info[Y_MAX]
        if scale is SCALE_THRESHOLD:
            margin = (y_max - y_min) * 0.1
            y_min -= margin
            y_max += margin

        try:
            # grid points
            histogram = np.histogram(data, bins=bins, range=(y_min, y_max))
            hist_counts, hist_labels = histogram
            std_value = np.std(sample_data)
            if std_value == 0:
                # use histogram value from numpy
                g_kde_values = histogram[0]
            else:
                g_kde = gen_gaussian_kde_1d_same_as_r(sample_data, std_value)
                g_kde_values = g_kde(hist_labels) * height

            kde = gen_kde_result(g_kde_values.tolist(), hist_labels, hist_counts)
        except Exception:
            kde = gen_kde_result()

        kde_list.append(kde)

    return kde_list


def is_numeric(n):
    try:
        float(n)
    except Exception:
        return False

    return True


def get_bound(plotdata):
    bounds = []
    for _, ridgeline in enumerate(plotdata):
        array_x = ridgeline.get(ARRAY_X)
        data = [e for e in array_x if is_numeric(e)]
        if data:
            # remove inf, nan in data
            data_np = np.array(data)
            data_np = convert_series_to_number(data_np)
            data = data_np[np.isfinite(data_np)]

            if data.size:
                bounds.append(data.mean() - 2.5 * data.std())
                bounds.append(data.mean() + 2.5 * data.std())
    if bounds:
        bmin = np.array(bounds).min()
        bmax = np.array(bounds).max()
        return [bmin, bmax]

    return []


def get_grid_points(plotdata, bounds=None, bins=128, width=1):
    mind = []
    maxd = []
    if bounds:
        xmin, xmax = bounds
    else:
        for _, ridgeline in enumerate(plotdata):
            array_x = ridgeline.get(ARRAY_X)
            if array_x:
                mind.append(min(array_x))
                maxd.append(max(array_x))

        xmin = 0
        xmax = 0
        if len(mind) and len(maxd):
            # default width=1 -> line scope is min/max +- 10%
            xmin = mind - 0.1 * width * (maxd - mind)
            xmax = maxd + 0.1 * width * (maxd - mind)

    x = np.linspace(xmin, xmax, bins)
    return (xmin, xmax, x)


def str_in_dat(plotdata):
    return True in (isinstance(x, str) for x in plotdata)


def gen_gaussian_kde_1d_same_as_r(x, std_value):
    # x: 1D ndarray
    if not std_value:
        std_value = np.std(x)

    iqr_value = iqr(x)
    if iqr_value == 0:
        bw_silverman = 1.06 * std_value * (len(x) ** (-0.2))
    else:
        bw_silverman = 1.06 * np.min([std_value, (iqr_value / 1.34)]) * (len(x) ** (-0.2))

    factor = (bw_silverman / (np.std(x, ddof=1))) or None
    kde = gaussian_kde(x, bw_method=factor)
    return kde


def detect_abnormal_count_values(
    x, nmax=2, threshold=50, min_uniques=10, max_sample_size=10_000, verbose=False
) -> list:
    """
    Detect values those with abnormal count values.
    We can detect np.inf, but can not detect np.nan (depending on numpy version)

    Parameters
    ----------
    x: ndarray(dtype=float, ndim=1), pandas.Series, or list
        Input data
    nmax: int
        Maximum values to detect
    threshold: int
        Threshold of outlier detection. Higher threshold detects less outliers
    min_uniques: int
        If number of unique values does not exceed this value, stop detection.
    max_sample_size: int
        If number of data points exceeds this value, resample x.

    Returns
    -------
    val_outlier : list
        A list of detected values
        :param verbose:
    """
    # random samples
    # np.random.default_rng() is much faster than np.random.choice()
    if len(x) > max_sample_size:
        if verbose:
            print(f'resampled: exceeded {max_sample_size} data points')
        rng = np.random.default_rng()
        x = rng.choice(x, max_sample_size, replace=False)

    uniq, count = np.unique(x, return_counts=True)
    if len(uniq) < min_uniques:
        if verbose:
            print(f'Number of unique values where less than {min_uniques}')
        return []

    # average counts of left and right unique values
    average_left_right = np.convolve(np.hstack([0.0, count, 0.0]), [0.5, 0.0, 0.5], 'valid')

    # calculate ratio between each count and the average
    # (+1 is in case to avoid zero division, but basically this will not occur)
    ratio = (count + 1) / (average_left_right + 1)

    # thresholding
    values_detected = uniq[ratio > threshold]
    ratio_detected = ratio[ratio > threshold]
    idx_desc = np.argsort(ratio_detected)[::-1]  # descending order
    val_outlier = np.sort(values_detected[idx_desc[:nmax]])  # return values in ascending order
    if verbose:
        if len(val_outlier) > 0:
            print('detected: {}'.format(val_outlier))
        else:
            print('outlier not detected')

    return val_outlier


@log_execution_time()
@abort_process_handler()
def resample_preserve_min_med_max(x, n_after: int):
    """Resample x, but preserve (minimum, median, and maximum) values
    Inputs:
        x (1D-NumpyArray or a list)
        n_after (int) Length of x after resampling. Must be < len(x)
    Return:
        x (1D-NumpyArray) Resampled data
    """
    if x.shape[0] > n_after:
        # walkaround: n_after with odd number is easier
        if n_after % 2 == 0:
            n_after += 1

        n = len(x)
        n_half = int((n_after - 1) / 2)

        # index around median
        x = np.sort(x)
        idx_med = (n + 1) / 2 - 1  # median
        idx_med_l = int(np.ceil(idx_med - 1))  # left of median
        idx_med_r = int(np.floor(idx_med + 1))  # right of median

        # resampled index
        idx_low = np.linspace(0, idx_med_l - 1, num=n_half, dtype=int)
        idx_upp = np.linspace(idx_med_r, n - 1, num=n_half, dtype=int)

        # resampling
        if n % 2 == 1:
            med = x[int(idx_med)]
            x = np.concatenate((x[idx_low], [med], x[idx_upp]))
        else:
            med = 0.5 * (x[idx_med_l] + x[idx_med_r])
            x = np.concatenate((x[idx_low], [med], x[idx_upp]))
    return x
