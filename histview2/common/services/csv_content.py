# CSVコンテンツを生成するService
# read(dic_form, local_params)が外向けの関数

import csv
import decimal
import math

# https://stackoverrun.com/ja/q/6869533
import logging
import re
from datetime import datetime, date, time
from itertools import islice

from histview2.api.efa.services.etl import detect_file_delimiter
from histview2.common.common_utils import detect_encoding
from histview2.common.constants import *
from histview2.common.logger import log_execution_time
from histview2.common.services.normalization import normalize_list

logger = logging.getLogger(__name__)


def gen_csv_fname(export_type="csv"):
    timestr = datetime.utcnow().strftime("%Y%m%d_%H%M%S.%f")[:-3]
    csv_fname = "{0:s}_out.{1:s}".format(timestr, export_type)
    return csv_fname


def read_data(f_name, headers=None, skip_head=None, end_row=None, delimiter=',', do_normalize=True):
    if do_normalize:
        normalize_func = normalize_list
    else:
        normalize_func = lambda x: x

    encoding = detect_encoding(f_name)
    if not delimiter:
        delimiter = detect_file_delimiter(f_name, ',')

    with open(f_name, "r", encoding=encoding) as f:
        rows = csv.reader(f, delimiter=delimiter)

        # skip tail
        if end_row:
            rows = islice(rows, end_row + 1)

        # skip head
        if skip_head:
            for _ in range(skip_head):
                next(rows)

        # use specify header( may be get from yaml config)
        csv_headers = next(rows)
        if headers:
            yield normalize_func(headers)
        else:
            yield normalize_func(csv_headers)

        # send data
        for row in rows:
            yield normalize_func(row)


def gen_data_types(data):
    """
    check datatype of a list of columns
    :param data:
    :return:
    """
    data_types = {check_data_type(val) for val in data}

    if DataType.TEXT in data_types:
        return DataType.TEXT.value

    if DataType.DATETIME in data_types:
        return DataType.DATETIME.value

    if DataType.REAL in data_types:
        return check_float_type(data)

    if DataType.INTEGER in data_types:
        return DataType.INTEGER.value

    return DataType.TEXT.value


# check special float type
def check_float_type(data):
    cast_float = data[data.astype(str).str.strip() != ''].astype(float)
    # count +inf|-inf of cast data
    n = (cast_float == math.inf).sum() or (cast_float == -math.inf).sum()

    if n == 0:
        return DataType.REAL.value
    else:
        # count +inf|-inf of raw data
        nr = (data == math.inf).sum() or (data == -math.inf).sum()
        if n > nr:
            return DataType.TEXT.value
        else:
            return DataType.REAL.value


# check data type of 1 data
def check_data_type(data):
    if data is None or data == '':
        return DataType.NULL

    if isinstance(data, datetime):
        return DataType.DATETIME

    if isinstance(data, (date, time)):
        return DataType.TEXT

    if isinstance(data, int):
        return DataType.INTEGER

    if isinstance(data, float) or isinstance(data, decimal.Decimal):
        return DataType.REAL

    try:
        if str(int(data)) == str(data):
            return DataType.INTEGER
        else:
            return DataType.TEXT
    except ValueError:
        pass

    try:
        if float(data) or float(data) == 0:
            return DataType.REAL
    except ValueError:
        pass

    try:
        re_dt = r'^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[\sT]\d{1,2}:\d{1,2}(:\d{1,2})?(\.\d{3,7})?((\s?([+-]?\d{1,2}:\d{2})?)|Z)?$'
        matches = re.match(re_dt, data)
        if matches:
            return DataType.DATETIME
    except (ValueError, TypeError):
        pass

    return DataType.TEXT


def filter_blank_row(data):
    """
    filter blank row in csv
    :param data:
    :return:
    """
    for row in data:
        if row:
            yield row


@log_execution_time()
def is_normal_csv(f_name, delimiter=','):
    """
    check if csv is normal type
    :param f_name:
    :param delimiter:
    :return:
    """
    data = read_data(f_name, end_row=20, delimiter=delimiter, do_normalize=False)
    data = filter_blank_row(data)

    data = list(data)
    if not data:
        return True

    headers = data[0] or []
    rows = data[1:] or []

    # column name is duplicate
    if len(headers) != len(set(headers)):
        return False

    # check column number of header vs data
    for row in rows:
        if len(row) != len(headers):
            return False

    return True
