#!/usr/bin/python3
from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
from pandas import Series
from scipy.stats import gaussian_kde, iqr

from ap.common.constants import (
    ARRAY_X,
    ARRAY_Y,
    RESAMPLING_SIZE,
    SCALE_AUTO,
    SCALE_COMMON,
    SCALE_FULL,
    SCALE_SETTING,
    SCALE_THRESHOLD,
    Y_MAX,
    Y_MIN,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.services.request_time_out_handler import abort_process_handler
from ap.common.services.statistics import convert_series_to_number
from ap.common.sigificant_digit import get_fmt_from_array

logger = logging.getLogger(__name__)


@log_execution_time()
def calculate_kde_for_ridgeline(data_np, grid_points, height=1, use_range=False, use_hist_counts=False):
    """
    Calculate KDE + Histogram bins + Histogram labels for an input array.
    :param data_np: input array
    :param height: high of the kde line
    :param grid_points: (tuple) special of xmin, xmax, x
    :param use_range: use range to show the y-axis
    :param use_hist_counts: use hist_counts to show histogram by line, do not use for RLP
    :return: KDE + Histogram bins + Histogram labels with 100 data points.
    """
    hist_counts = []

    data_np: Series = data_np.reset_index(drop=True)
    data_np = data_np[data_np.notna()].convert_dtypes()
    if not len(data_np):
        return gen_kde_result()

    data_np = convert_series_to_number(data_np)
    data_np = data_np[np.isfinite(data_np)]

    if data_np.empty:  # empty
        return gen_kde_result()
    else:
        try:
            # grid points
            (xmin, xmax, x) = grid_points
            histogram = (
                np.histogram(data_np, bins=x, range=(xmin, xmax)) if use_range else np.histogram(data_np, bins=x)
            )
            std_value = np.std(data_np)
            if std_value == 0:
                # use histogram value from numpy
                g_kde_values = histogram[0]
            else:
                g_kde = gen_gaussian_kde_1d_same_as_r(data_np, std_value)
                g_kde_values = g_kde(x) * height

            if use_hist_counts:
                hist_counts = histogram[0]
            return gen_kde_result(g_kde_values, x, hist_counts)
        except Exception:
            return gen_kde_result()


@log_execution_time()
def gen_kde_result(kde=pd.Series([]), hist_labels=pd.Series([]), hist_counts=pd.Series([])):
    return {
        'kde': kde,
        'hist_labels': hist_labels,
        'hist_counts': hist_counts,
        'label_fmt': get_fmt_from_array(hist_labels),
    }


@log_execution_time()
def calculate_kde_trace_data(plotdata, bins=128, height=1, full_array_y: pd.Series | None = None):
    """
    :param plotdata:
    :param bins:
    :param height:
    :param full_array_y:
    :return:
    """
    kde_list = []
    scales = [SCALE_SETTING, SCALE_COMMON, SCALE_THRESHOLD, SCALE_AUTO, SCALE_FULL]

    data = full_array_y
    if full_array_y is None or full_array_y.empty:
        data = plotdata[ARRAY_Y]

    data = data.dropna().convert_dtypes()

    if not len(data) or pd.api.types.is_object_dtype(data):
        return [gen_kde_result() for _ in scales]

    data = convert_series_to_number(data)
    data = data[np.isfinite(data)]

    # convert to numpy with correct dtype because later functions always treat those as numpy array
    # numpy doesn't understand `Float64` or `Int64`, so we convert them to `np.float64`
    np_dtype = np.float64 if pd.api.types.is_numeric_dtype(data) else None
    data = data.to_numpy(dtype=np_dtype)

    sample_data = resample_preserve_min_med_max(data, RESAMPLING_SIZE - 1) if len(data) > RESAMPLING_SIZE else data

    if len(sample_data) == 0:
        return [gen_kde_result() for _ in scales]

    # only_one_point = False
    # if np.unique(sample_data).size == 1:
    #     only_one_point = True

    std_value = np.std(sample_data)
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

        kde = calc_kde(data, bins, height, sample_data, std_value, y_max, y_min)

        kde_list.append(kde)

    return kde_list


@log_execution_time()
@CustomCache.memoize()
def calc_kde(data, bins, height, sample_data, std_value, y_max, y_min):
    try:
        # grid points
        histogram = np.histogram(data, bins=bins, range=(y_min, y_max))
        hist_counts, hist_labels = histogram
        if std_value == 0:
            # use histogram value from numpy
            g_kde_values = hist_counts
        else:
            g_kde = gen_gaussian_kde_1d_same_as_r(sample_data, std_value)
            g_kde_values = g_kde(hist_labels) * height

        kde = gen_kde_result(g_kde_values, hist_labels, hist_counts)
    except Exception:
        # There are cases where we cannot calculate histogram, because data is just a single point. (tinhtn19)
        kde = gen_kde_result()
    return kde


@log_execution_time()
def get_bound(plotdata):
    bmin, bmax = None, None

    for _, ridgeline in enumerate(plotdata):
        array_x = ridgeline.get(ARRAY_X, pd.Series())
        data = pd.to_numeric(array_x, errors='coerce')

        # remove inf, nan in data
        data = data[np.isfinite(data)]

        if len(data):
            mean = data.mean()
            std = data.std()

            # std is never less than 0
            value_min = mean - 2.5 * std
            value_max = mean + 2.5 * std

            bmin = value_min if bmin is None else min(bmin, value_min)
            bmax = value_max if bmax is None else max(bmax, value_max)

    if bmin is not None and bmax is not None:
        return [bmin, bmax]

    return []


@log_execution_time()
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
            # FIXME: this isn't correct, we cannot subtract lists
            # default width=1 -> line scope is min/max +- 10%
            xmin = mind - 0.1 * width * (maxd - mind)
            xmax = maxd + 0.1 * width * (maxd - mind)

    x = np.linspace(xmin, xmax, bins)
    return (xmin, xmax, x)


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
    x,
    nmax=2,
    threshold=50,
    min_uniques=10,
    max_sample_size=10_000,
    verbose=False,
) -> list[Any] | np.ndarray[Any, Any]:
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
            logger.info(f'resampled: exceeded {max_sample_size} data points')
        rng = np.random.default_rng(1)  # fix random seed
        x = rng.choice(x, max_sample_size, replace=False)

    uniq, count = np.unique(x, return_counts=True)
    if len(uniq) < min_uniques:
        if verbose:
            logger.info(f'Number of unique values where less than {min_uniques}')
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
    val_outlier = values_detected[idx_desc[:nmax]]  # return values in ascending order
    if verbose:
        if len(val_outlier) > 0:
            logger.info(f'detected: {val_outlier}')
        else:
            logger.info('outlier not detected')

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
