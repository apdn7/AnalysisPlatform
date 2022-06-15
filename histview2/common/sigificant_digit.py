import math

import numpy as np
from loguru import logger

from histview2.common.constants import ARRAY_PLOTDATA, ARRAY_Y
from histview2.common.logger import log_execution_time
from histview2.common.services.request_time_out_handler import request_timeout_handling


def signify_digit_pca(x, sig_dig=4):
    """
    Signify a number array.
    :param x:
    :param sig_dig:
    :return: Signified numbers.
        """
    if sig_dig < 1:
        sig_dig = 1
    elif sig_dig > 6:
        sig_dig = 6

    digit = np.floor(np.log10(abs(x))).astype(int)
    if digit < -3 or 6 < digit:
        fmt = "{:." + str(sig_dig - 1) + "e}"
    elif isinstance(x, int) or isinstance(x, float) and x.is_integer():
        x = int(x)
        fmt = "{:,d}"
    elif digit > sig_dig - 3:
        fmt = "{:,.1f}"
    else:
        fmt = "{:,." + (sig_dig - digit - 1).astype(str) + "f}"
    return fmt.format(x)


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


# def signification_digit(n, sig_digit=4):
#     if n and n > 0:
#         sd = np.round(n * 10**(-1 * np.floor(np.log10(n))), sig_digit-1) * 10**(np.floor(np.log10(n)))
#
#         sd_splited = str(sd).split('.')
#         if len(sd_splited[0]) > sig_digit:
#             return int(sd_splited[0])
#         return np.round(sd, sig_digit - len(sd_splited[0]))
#     if np.isnan(n):
#         n = np.where(np.isnan(n), None, n)
#     return n


def signify_digit2(n, sig_digit=4):
    if not isinstance(n, float):
        return n

    try:
        return round(n, sig_digit - int(math.floor(math.log10(abs(n)))) - 1)
    except:
        if n is None or np.isnan(n):
            return None
        return n


def signify_digit(n, sig_digit=4):
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
        vsig_digits = np.vectorize(signify_digit2)
        signified_digits = vsig_digits(np.array(input_array), sig_digit=sig_dig)
        return signified_digits.tolist()

        # return [signify_digit2(x, sig_dig) if isinstance(x, float) else x for x in input_array]
    except Exception as ex:
        logger.exception(ex)
        return input_array


@log_execution_time()
@request_timeout_handling()
def round_data(dic_param):
    array_plotdata = dic_param.get(ARRAY_PLOTDATA)
    for num, plotdata in enumerate(array_plotdata):
        plotdata[ARRAY_Y] = signify_digit_vector(plotdata.get(ARRAY_Y), sig_dig=4)
        # plotdata[Y_MAX] = signify_digit(plotdata.get(Y_MAX))
        # plotdata[Y_MIN] = signify_digit(plotdata.get(Y_MIN))


@log_execution_time()
def round_data_stp(dic_param):
    array_plotdatas = dic_param.get(ARRAY_PLOTDATA) or {}
    for end_col, plotdatas in array_plotdatas.items():
        for plotdata in plotdatas or []:
            plotdata[ARRAY_Y] = signify_digit_vector(plotdata[ARRAY_Y], sig_dig=4)
