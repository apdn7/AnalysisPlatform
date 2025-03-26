import logging
import math

import numpy as np
import pandas as pd

from ap import log_execution_time
from ap.common.constants import ColorOrder

logger = logging.getLogger(__name__)


def signify_digit_pca(x, sig_dig=4):
    """
    Signify a number array.
    :param x:
    :param sig_dig:
    :return: Signified numbers.
    """
    try:
        if not x or isinstance(x, (int, np.integer)):  # None -> None, 0 -> 0
            return x
        if pd.isna(x):  # NaN -> None
            return None

        fmt = '{:' + signify_digit_fmt(x, sig_dig) + '}'
        return fmt.format(x)
    except Exception:
        return x


def signify_digit_fmt(x, sig_dig=4):
    if isinstance(x, str):
        return ''

    if sig_dig < 1:
        sig_dig = 1
    elif sig_dig > 6:
        sig_dig = 6

    digit = np.floor(np.log10(abs(x))).astype(int)
    if isinstance(x, (int, np.integer)) or (
        isinstance(x, (float, np.float16, np.float32, np.float64)) and x.is_integer()
    ):
        fmt = ',d'
    elif digit < -3 or digit > 6:
        fmt = '.' + str(sig_dig - 1) + 'e'
    elif digit > sig_dig - 3:
        fmt = ',.1f'
    else:
        fmt = ',.' + (sig_dig - digit - 1).astype(str) + 'f'
    return fmt


@log_execution_time()
def get_fmt_from_array(arr, sig_dit=4):
    if not isinstance(arr, pd.Series):
        arr = pd.Series(arr)

    if len(arr) == 0:
        return ''

    if not pd.api.types.is_numeric_dtype(arr):
        return ''

    arr = arr.replace([np.inf, -np.inf], np.nan).dropna().sort_values()
    if len(arr) == 0:
        return ''

    length = len(arr)

    lower_bound = math.floor(length * 0.05)
    upper_bound = length - lower_bound

    max_number_arr = arr.iloc[lower_bound:upper_bound]
    max_number = max_number_arr.max() if len(max_number_arr) else arr.max()

    return signify_digit_fmt(max_number, sig_dit)


def signify_digit_pca_vector(input_array, sig_dig=4):
    """
    Signify an array.
    :param input_array:
    :param sig_dig:
    :return: Array of signified numbers.
    """
    if not input_array:
        return []

    try:
        vsig_digits = np.vectorize(signify_digit_pca)
        signified_digits = vsig_digits(np.array(input_array), sig_dig=sig_dig)
    except Exception:
        signified_digits = input_array

    return signified_digits


def signify_digit(n, sig_digit=4):
    return signify_digit_pca(n, sig_digit)


def get_fmt_from_color_setting(color_vals: pd.Series, color_setting):
    scp_scatter_max_tick_vals = 5
    color_max = color_vals.max()
    color_min = color_vals.min()
    fmt = get_fmt_from_array(color_vals)
    if 'e' not in fmt:
        if color_setting is ColorOrder.TIME:
            return ',d'
        if color_max - color_min > scp_scatter_max_tick_vals:
            return ',d'
    return fmt
