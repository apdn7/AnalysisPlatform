import numpy as np
import pandas as pd


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
    if isinstance(x, int) or isinstance(x, float) and x.is_integer():
        fmt = ',d'
    elif digit < -3 or digit > 6:
        fmt = '.' + str(sig_dig - 1) + 'e'
    elif digit > sig_dig - 3:
        fmt = ',.1f'
    else:
        fmt = ',.' + (sig_dig - digit - 1).astype(str) + 'f'
    return fmt


def get_fmt_from_array(arr, sig_dit=4):
    if len(arr) == 0:
        return ''
    if isinstance(arr[0], str):
        return ''

    with pd.option_context('mode.use_inf_as_na', True):
        arr = pd.Series(arr).dropna().sort_values().to_list()

    if len(arr) == 0:
        return ''

    length = len(arr)
    trim_number = int(np.floor(length * 0.05))
    max_number_arr = arr[trim_number : length - trim_number]
    max_number = max(max_number_arr) if max_number_arr else max(arr)

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
