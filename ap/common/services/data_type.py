import contextlib
import decimal
import math
import re
from datetime import date, datetime, time

import numpy as np
import pandas as pd
from pandas import Series

from ap.common.constants import INF_STR, MAX_SAFE_INTEGER, MIN_DATETIME_LEN, MINUS_INF_STR, DataType
from ap.common.logger import log_execution_time

na_values = [None, '', 'nan', 'NA', np.nan, np.inf, -np.inf]
datetime_pattern = (
    r'^\d{4}'  # begin with YYYY
    r'[-\/]'  # separator
    r'\d{1,2}'  # MM or M
    r'[-\/]'  # separator
    r'\d{1,2}'  # DD or D
    r'[\sT]'  # separator or T
    r'\d{1,2}'  # HH or H
    r':'  # separator
    r'\d{1,2}'  # mm or m
    r'(:\d{1,2})?'  # optional (separator and seconds (ss or s))
    r'(\.\d+)?'  # optional fractional seconds
    r'((\s?([+-]?\d{1,2}:\d{2})?)|Z)?$'  # end with optional (timezone (+-HH:ss or +-H:ss) or Z)
)
"""This pattern is designed to match datetime strings, particularly those that follow a format similar to:
YYYY-MM-DD HH:MM[:SS][.fraction][timezone]
Or
YYYY/MM/DDTHH:MM[:SS][.fraction][timezone]
"""
dtype_pattern = {
    DataType.DATETIME: [re.compile(datetime_pattern)],
    DataType.INTEGER: [re.compile(r'^-?[1-9]\d{9}$')],
    DataType.TEXT: [re.compile(r'^\d{6}-\d{4}$')],
}
extra_int_pattern = {DataType.INTEGER: [re.compile(r'^-?\d+\.0$')]}


def detect_type_from_patterns(series: pd.Series, extra_pattern=None):
    """
    Detect data type for special cases defined by predefined regex patterns.

    Parameters
    ----------
    series : pd.Series
        Input data to check.
    extra_pattern : dict | None
        If specified, only check against this particular data type.

    Returns:
    -------
    DataType | None
        The detected data type, or None if no pattern matches.
    """
    global dtype_pattern
    if extra_pattern is None:
        extra_pattern = {}

    # Always work on string values
    series_str = series.astype(str)

    # If check_type is specified, update checking pattern with extra pattern
    pattern_dict = {
        k: dtype_pattern.get(k, []) + extra_pattern.get(k, []) for k in set(dtype_pattern) | set(extra_pattern)
    }

    for dtype, regex_def in pattern_dict.items():
        for regex in regex_def:
            try:
                if series_str.str.match(regex).all():
                    return dtype.value
            except Exception:
                continue

    return None


@log_execution_time()
def gen_data_types(series: Series, is_v2=False):
    """
    Check datatype of a list of columns
    :param is_v2:
    :param series:
    :return:
    """
    series = series.drop_duplicates().dropna()
    # drop 'NA' in series if series is ('1.1', 'NA')
    # BUG: BooleanArray raising on comparison to string: https://github.com/pandas-dev/pandas/pull/44533
    if series.dtypes.name != 'boolean':
        series = series.replace(na_values, pd.NA).dropna()

    # for v2, try to convert dtypes from float to int
    # if data=[1.0, 2.0] (to avoid wrong data-type prediction)
    if not series.empty:
        extra_pattern = extra_int_pattern if is_v2 else None
        dtype = detect_type_from_patterns(series, extra_pattern=extra_pattern)
        if dtype:
            return dtype

    data_type = check_data_type_series(series)
    if data_type is not None:
        return data_type

    data_types = [check_data_type(val) for val in series]

    if DataType.TEXT in data_types:
        return DataType.TEXT.value

    if DataType.DATETIME in data_types:
        return DataType.DATETIME.value

    if DataType.K_SEP_NULL in data_types:
        total = len(data_types)
        k_sep_null_count = data_types.count(DataType.K_SEP_NULL)
        if k_sep_null_count >= total * 0.1:  # <= 10% of total
            return DataType.REAL_SEP.value
        return DataType.TEXT.value

    if DataType.REAL in data_types:
        return check_float_type(series)

    if DataType.INTEGER in data_types:
        return DataType.INTEGER.value

    if DataType.REAL_SEP in data_types:
        return DataType.REAL_SEP.value

    if DataType.EU_REAL_SEP in data_types:
        return DataType.EU_REAL_SEP.value

    return DataType.TEXT.value


def convert_series_to_str(s: Series) -> Series:
    if s.dtypes.name != 'string':
        s = s.astype(str)

    return s.str.strip().str.lower()


def count_inf_in_str_series(s: Series) -> int:
    return s.isin([INF_STR.lower(), MINUS_INF_STR.lower()]).sum()


def count_inf_in_float_series(s: Series) -> int:
    return s.isin([math.inf, -math.inf]).sum()


def check_data_type(data):
    if data in na_values or data is pd.NA:
        # pd.NA should be compare value without check in na_value list
        # to avoid error of NA is ambiguous
        return DataType.NULL

    if isinstance(data, datetime):
        return DataType.DATETIME

    if isinstance(data, (date, time)):
        return DataType.TEXT

    if isinstance(data, int):
        return check_large_int_type(data)

    if isinstance(data, (decimal.Decimal, float)):
        return DataType.REAL

    # make sure data is real when it's -inf or inf instead of string
    if str(data).lower() in [INF_STR.lower(), MINUS_INF_STR.lower()]:
        return DataType.REAL

    # for 'nan'
    try:
        if np.isnan(float(data)):
            return DataType.NULL
    except ValueError:
        pass

    try:
        if str(int(data)) == str(data):
            return check_large_int_type(data)
        else:
            return DataType.TEXT
    except ValueError:
        pass

    try:
        if float(data) or float(data) == 0:
            return DataType.REAL
    except ValueError:
        pass

    eu_type = predict_eu_type(data)
    if eu_type != DataType.TEXT:  # as EU format of number
        return eu_type

    try:
        re_dt = datetime_pattern
        matches = re.match(re_dt, data)
        if matches:
            return DataType.DATETIME
    except (ValueError, TypeError):
        pass

    # try if there is not iso format of datetime
    # eg: 20-09-2023 01:00
    try:
        # Only cast datetime with string len > 10
        if len(data) < MIN_DATETIME_LEN:
            return DataType.TEXT

        is_datetime = datetime.fromisoformat(data)
        if is_datetime:
            return DataType.DATETIME
    except (ValueError, TypeError):
        valid_dt = detect_datetime(data)
        if valid_dt:
            return DataType.DATETIME

    return DataType.TEXT


def predict_eu_type(data):
    # OLD REGEX: r'^[\d,]+$'
    re_float_sep = r'^[+-]?\d+,\d+$'
    matches = re.match(re_float_sep, data)

    if matches:
        try:
            re_data = data.replace(',', '')
            float(re_data)
            return DataType.EU_REAL_SEP
        except ValueError:
            return predict_k_sep(data)

    return predict_k_sep(data)


def predict_k_sep(data):
    re_k_sep = r'^[+-]?[\d , \.]+$'
    matches = re.match(re_k_sep, data)

    if matches:
        try:
            float(data)
            return DataType.REAL_SEP
        except ValueError:
            return DataType.K_SEP_NULL

    return DataType.TEXT


def check_large_int_type(val):
    if int(val) > MAX_SAFE_INTEGER:
        return DataType.TEXT
    return DataType.INTEGER


def check_data_type_series(orig_series: Series):
    from ap.common.common_utils import is_boolean_dtype

    series: Series = convert_df_str_to_others(orig_series)

    try:
        non_inf_series = series.replace([float('inf'), float('-inf')], None)
        if non_inf_series[non_inf_series > MAX_SAFE_INTEGER].size:
            return DataType.TEXT.value
    except TypeError:
        # continue for string or datetime column
        pass

    # all items in series are NA
    if series.isna().all():
        return DataType.TEXT.value

    # series = series.convert_dtypes()
    series_type = str(series.dtypes.name).lower()

    # series is Decimal number
    is_decimal = all(isinstance(value, decimal.Decimal) for value in orig_series)
    # issue raised in s255b6
    # because of MSSQL return Decimal number, it should be detected as REAL instead of INT
    if is_decimal:
        return check_decimal_type(orig_series)

    if 'float' in series_type:
        return check_float_type(orig_series, series)

    if 'int' in series_type:
        if is_boolean_dtype(series):
            return DataType.BOOLEAN.value

        # BIG INT
        if series.max() > MAX_SAFE_INTEGER:
            return DataType.TEXT.value

        # STRING START WITH ZERO
        if not series.astype(str).equals(orig_series.astype(str)):
            return DataType.TEXT.value

        return DataType.INTEGER.value

    if 'time' in series_type:
        return DataType.DATETIME.value

    if (series_type in [pd.StringDtype.name, object]) and is_boolean_dtype(series):
        return DataType.BOOLEAN.value

    return None


def detect_datetime(datetime_value):
    try:
        # try to read value as datetime
        pd.to_datetime([datetime_value])
        return True
    except (ValueError, TypeError, OverflowError):
        return False


def convert_df_str_to_others(orig_series):
    data_types = (int, 'Int64', float, 'Float64')
    series_type = orig_series.dtypes.name
    if series_type not in ('object', 'string'):
        return orig_series

    series = None
    for data_type in data_types:
        try:
            series = orig_series.astype(data_type)
            break
        except Exception:
            continue

    if series is None:
        # updated at 2025/10: `1234567890` should be detected as Int instead of datetime
        # Only cast datetime with string len >= 10
        # cast to string before using .str accessor
        if orig_series.astype(str).str.len().min() < MIN_DATETIME_LEN:
            return orig_series

        with contextlib.suppress(Exception):
            series = pd.to_datetime(orig_series)

    if series is not None and not len(series.dropna()):
        series = None

    series = orig_series if series is None else series
    return series


@log_execution_time()
def check_float_type(string_series: Series, float_series: Series = None):
    if float_series is None:
        try:
            float_series = string_series[convert_series_to_str(string_series) != ''].astype(float)
        except Exception:
            return DataType.TEXT.value

    # count +inf|-inf of cast data
    n = count_inf_in_float_series(float_series)

    if n == 0:
        return DataType.REAL.value
    else:
        # count +inf|-inf of raw data
        string_series = convert_series_to_str(string_series)
        nr = count_inf_in_str_series(string_series)
        if n > nr:
            return DataType.TEXT.value
        else:
            return DataType.REAL.value


def check_decimal_type(series: Series):
    if all(value == value.to_integral_value() for value in series):
        return DataType.INTEGER.value
    return DataType.REAL.value
