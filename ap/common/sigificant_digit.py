import numpy as np
import pandas as pd
from ap.common.logger import logger

from ap.common.logger import log_execution_time


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
        if np.isnan(x):  # NaN -> None
            return None

        fmt = "{:" + signify_digit_fmt(x, sig_dig) + "}"
        return fmt.format(x)
    except:
        return x


def signify_digit_fmt(x, sig_dig=4):
    if isinstance(x, str):
        return ''

    if sig_dig < 1:
        sig_dig = 1
    elif sig_dig > 6:
        sig_dig = 6

    digit = np.floor(np.log10(abs(x))).astype(int)
    if isinstance(x, int) or isinstance(x, float) and x.is_integer():
        fmt = ",d"
    elif digit < -3 or 6 < digit:
        fmt = "." + str(sig_dig - 1) + "e"
    elif digit > sig_dig - 3:
        fmt = ",.1f"
    else:
        fmt = ",." + (sig_dig - digit - 1).astype(str) + "f"
    return fmt


def get_fmt_from_array(arr, sig_dit=4):
    if len(arr) == 0:
        return ''
    if isinstance(arr[0], str):
        return ''

    arr = pd.Series(arr).dropna().sort_values().to_list()
    if len(arr) == 0:
        return ''

    length = len(arr)
    trim_number = int(np.floor(length * 0.05))
    max_number_arr = arr[trim_number:length - trim_number]
    if max_number_arr:
        max_number = max(max_number_arr)
    else:
        max_number = max(arr)

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

    if not n or isinstance(n, int):  # None -> None, 0 -> 0
        return n
    if np.isnan(n):  # NaN -> None
        return None

    res = n
    try:
        n_abs = abs(n)
        if n_abs:
            sd = np.round(n_abs * 10 ** (-1 * np.floor(np.log10(n_abs))), sig_digit - 1) * 10 ** (
                np.floor(np.log10(n_abs)))
            sd_splited = str(sd).split('.')
            if len(sd_splited[0]) > sig_digit:
                res = int(sd_splited[0])
            else:
                res = np.round(sd, sig_digit - len(sd_splited[0]))
        if n < 0:
            return -res
    # Python automatically convert 0.0000001 to '1e-07' -> error -> Fixed by using try-catch to handle
    except Exception as ex:
        logger.exception(ex)
        return n
    return res


@log_execution_time()
def signify_digit_vector(input_array, sig_dig=4):
    """
    Signify an array.
    :param input_array:
    :param sig_dig:
    :return: Array of signified numbers.
    """
    if input_array is None:
        return []

    try:
        # TODO use vector
        vsig_digits = np.vectorize(signify_digit)
        signified_digits = vsig_digits(np.array(input_array), sig_digit=sig_dig)
        return signified_digits.tolist()

        # return [signify_digit2(x, sig_dig) if isinstance(x, float) else x for x in input_array]
    except Exception as ex:
        logger.exception(ex)
        return input_array

