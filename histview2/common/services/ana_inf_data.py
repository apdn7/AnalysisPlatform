#!/usr/bin/python3
import logging
from itertools import groupby

import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde, iqr

from histview2.common.constants import *

logger = logging.getLogger(__name__)


def all_equal(iterable):
    g = groupby(iterable)
    return next(g, True) and not next(g, False)


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

    try:
        data_np = data_np[np.isfinite(data_np)]
    except Exception:
        pass

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
    }


def calculate_kde_trace_data(plotdata, bins=128, height=1, full_array_y=None):
    """
    :param plotdata:
    :param bins:
    :param height:
    :param full_array_y
    :param gen_chart_js_hist:
    :return:
    """
    if full_array_y is None:
        data = plotdata[ARRAY_Y]
    else:
        data = full_array_y

    hist_counts = []
    # remove inf, nan in data
    data = pd.Series(data)
    data = data[data.notnull()]
    if not len(data):
        kde = gen_kde_result()
        return [kde] * 5

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

    kde_list = []
    scales = [plotdata.get(scale) for scale in (SCALE_SETTING, SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL)]
    for scale_info in scales:
        if not scale_info:
            kde = gen_kde_result()
            kde_list.append(kde)
            continue

        y_min = scale_info[Y_MIN]
        y_max = scale_info[Y_MAX]
        try:
            # grid points
            histogram = np.histogram(data, bins=bins, range=(y_min, y_max))
            hist_counts, hist_labels = histogram

            # if only_one_point:
            #     g_kde_values = gen_kde_from_singular_matrix(sample_data, range=(y_min, y_max))
            # else:
            #     g_kde = gaussian_kde(dataset=sample_data)
            #     g_kde_values = g_kde(hist_labels) * height

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


def gen_gaussian_kde_1d_same_as_r(x):
    # x: 1D ndarray
    bw_silverman = 1.06 * np.min([np.std(x), iqr(x) / 1.34]) * (len(x) ** (-0.2))
    factor = bw_silverman / (np.std(x, ddof=1))
    kde = gaussian_kde(x, bw_method=factor)
    return kde
