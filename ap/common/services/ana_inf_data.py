#!/usr/bin/python3
import logging
from itertools import groupby

import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde, iqr

from ap.common.constants import *
from ap.common.sigificant_digit import get_fmt_from_array
from ap.common.services.statistics import convert_series_to_number

logger = logging.getLogger(__name__)


def all_equal(iterable):
    g = groupby(iterable)
    return next(g, True) and not next(g, False)


def calculate_kde(data, bins=128, width=1, height=1, bounds=None, use_range=False, use_hist_counts=False):
    """
    Calculate KDE + Histogram bins + Histogram labels for an input array.
    :param data: input array
    :param bins: number of bins
    :param width: width of the kde line, default is [.1min, .1max]
    :param height: high of the kde line
    :param bounds: special of xmin and xmax
    :param use_range: use range to show the y-axis
    :param use_hist_counts: use hist_counts to show histogram by line, do not use for RLP
    :return: KDE + Histogram bins + Histogram labels with 100 data points.
    """
    hist_counts = []

    if str_in_dat(data):
        return gen_kde_result()

    data_np = pd.Series(data)
    data_np = data_np[data_np.notnull()]
    if not len(data_np):
        return gen_kde_result()

    data_np = convert_series_to_number(data_np)
    data_np = data_np[np.isfinite(data_np)]
    data = data_np.tolist()

    # remove inf, nan in data
    data_np = np.array(data)
    data = data_np[np.isfinite(data_np)].tolist()

    if not data:  # empty
        return gen_kde_result()
    elif all_equal(data):  # all elements are the same
        return gen_kde_result([data[0]], [data[0]], [len(data)])
    else:
        # boundaries
        if bounds:
            xmin, xmax = bounds
        else:
            mind = min(data)
            maxd = max(data)
            # default width=1 -> line scope is min/max +- 10%
            xmin = mind - 0.1 * width * (maxd - mind)
            xmax = maxd + 0.1 * width * (maxd - mind)

        # xmin, xmax = [1450, 1850]
        try:
            # grid points
            x = np.linspace(xmin, xmax, bins)
            g_kde = gen_gaussian_kde_1d_same_as_r(data)
            g_kde_values = g_kde(x) * height

            if use_hist_counts:
                # counting on bins
                if use_range:
                    histogram = np.histogram(data, bins=x, range=(xmin, xmax))
                else:
                    histogram = np.histogram(data, bins=x)

                hist_counts = histogram[0].tolist()
            return gen_kde_result(g_kde_values.tolist(), x.tolist(), hist_counts)
        except Exception:
            return gen_kde_result()


def calculate_kde_for_ridgeline(data, grid_points, height=1, use_range=False, use_hist_counts=False):
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
            histogram = np.histogram(data, bins=x, range=(xmin, xmax)) if use_range else np.histogram(data, bins=x)

            if all_equal(data):
                # use histogram value from numpy
                g_kde_values = histogram[0]
            else:
                g_kde = gen_gaussian_kde_1d_same_as_r(data)
                g_kde_values = g_kde(x) * height

            if use_hist_counts:
                hist_counts = histogram[0].tolist()
            return gen_kde_result(g_kde_values.tolist(), x.tolist(), hist_counts)
        except Exception:
            return gen_kde_result()


def gen_kde_result(kde=(), hist_labels=(), hist_counts=()):
    return {
        'kde': kde,
        'hist_labels': hist_labels,
        'hist_counts': hist_counts,
        'label_fmt': get_fmt_from_array(hist_labels),
    }


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
        sample_data = np.random.choice(data, size=10_000).tolist()
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

            if all_equal(data):
                # use histogram value from numpy
                g_kde_values = histogram[0]
            else:
                g_kde = gen_gaussian_kde_1d_same_as_r(sample_data)
                g_kde_values = g_kde(hist_labels) * height

            kde = gen_kde_result(g_kde_values.tolist(), hist_labels, hist_counts)
        except Exception:
            kde = gen_kde_result()

        kde_list.append(kde)

    return kde_list


# def gen_kde_from_singular_matrix(singular_matrix, range=(0, 1), bins=128, normalized=True):
#     x = np.linspace(range[0], range[1], bins)
#     kde = np.zeros(bins)
#     for val in singular_matrix:
#         kde += norm.pdf(x, loc=val, scale=1)
#
#     # normalized the KDE
#     if normalized:
#         kde /= integrate.simps(kde, x)
#     return kde


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


def gen_gaussian_kde_1d_same_as_r(x):
    # x: 1D ndarray
    bw_silverman = 1.06 * np.min([np.std(x), iqr(x) / 1.34]) * (len(x) ** (-0.2))
    factor = bw_silverman / (np.std(x, ddof=1))
    kde = gaussian_kde(x, bw_method=factor)
    return kde


def detect_abnormal_count_values(x, nmax=2, threshold=50, min_uniques=10, max_sample_size=10_000,
                                 verbose=False) -> list:
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
            print(f"resampled: exceeded {max_sample_size} data points")
        rng = np.random.default_rng()
        x = rng.choice(x, max_sample_size, replace=False)

    # count unique values
    uniq, count = np.unique(x, return_counts=True)
    if len(uniq) < min_uniques:
        if verbose:
            print(f"Number of unique values where less than {min_uniques}")
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
            print("detected: {}".format(val_outlier))
        else:
            print("outlier not detected")

    return val_outlier
