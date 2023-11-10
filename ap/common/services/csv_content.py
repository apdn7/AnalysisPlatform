# CSVコンテンツを生成するService
# read(dic_form, local_params)が外向けの関数
import codecs
import csv
import decimal
import io

# https://stackoverrun.com/ja/q/6869533
import logging
import math
import re
from datetime import date, datetime, time
from itertools import islice
from zipfile import ZipFile

import numpy as np
import pandas as pd
from flask import Response
from pandas import Series

from ap.api.efa.services.etl import detect_file_stream_delimiter
from ap.common.common_utils import detect_encoding, is_normal_zip, open_with_zip
from ap.common.constants import *
from ap.common.logger import log_execution_time
from ap.common.services.normalization import normalize_list

logger = logging.getLogger(__name__)


def gen_csv_fname(export_type='csv'):
    timestr = datetime.utcnow().strftime('%Y%m%d_%H%M%S.%f')[:-3]
    csv_fname = '{0:s}_out.{1:s}'.format(timestr, export_type)
    return csv_fname


def read_data(f_name, headers=None, skip_head=None, end_row=None, delimiter=',', do_normalize=True):
    if do_normalize:
        normalize_func = normalize_list
    else:
        normalize_func = lambda x: x

    with open_with_zip(f_name, 'rb') as f:
        metadata = get_metadata(f, is_full_scan_metadata=True, default_csv_delimiter=',')
        delimiter = metadata.get(DELIMITER_KW)
        encoding = metadata.get(ENCODING_KW)

    with open_with_zip(f_name, 'r', encoding=encoding) as f:
        _f = f
        if is_normal_zip(f_name):
            _f = codecs.iterdecode(f, encoding)
        try:
            rows = csv.reader(_f, delimiter=delimiter)
        except Exception:
            rows = csv.reader((line.replace('\0', '') for line in _f), delimiter=delimiter)

        if isinstance(rows, bytes):
            rows = rows.decode(encoding)

        # skip tail
        if end_row is not None:
            rows = islice(rows, end_row + 1)
        # skip head
        if skip_head is not None:
            rows = islice(rows, skip_head, None)

        # use specify header( may be get from yaml config)
        csv_headers = next(rows)
        if headers is not None:
            yield normalize_func(headers)
        else:
            yield normalize_func(csv_headers)
        # send data
        for row in rows:
            yield normalize_func(row)


def gen_data_types(data: Series, is_v2=False):
    """
    check datatype of a list of columns
    :param data:
    :return:
    """

    # try to convert dtypes from float to int
    # if data=[1.0, 2.0] (to avoid wrong data-type prediction)
    if is_v2:
        try:
            df = pd.DataFrame({COL_NAME: data})
            df[COL_NAME] = df[COL_NAME].astype(str)
            is_int_types = pd.Series(df[COL_NAME]).str.match(r'^\d*.0$').tolist()
            if False not in is_int_types:
                return DataType.INTEGER.value
        except Exception:
            pass

    data_types = [check_data_type(val) for val in data]

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
        return check_float_type(data)

    if DataType.INTEGER in data_types:
        return DataType.INTEGER.value

    if DataType.REAL_SEP in data_types:
        return DataType.REAL_SEP.value

    if DataType.EU_REAL_SEP in data_types:
        return DataType.EU_REAL_SEP.value

    if DataType.BIG_INT in data_types:
        return DataType.BIG_INT.value

    return DataType.TEXT.value


# check special float type
def check_float_type(data: Series):
    def preprocess(s: Series) -> Series:
        return s.astype(str).str.strip().str.lower()

    def count_inf(s: Series) -> int:
        s_str = preprocess(s)
        return ((s == math.inf) | (s_str == INF_STR.lower())).sum() or (
            (s == -math.inf) | (s_str == MINUS_INF_STR.lower())
        ).sum()

    cast_float = data[preprocess(data) != ''].astype(float)

    # count +inf|-inf of cast data
    n = count_inf(cast_float)

    if n == 0:
        return DataType.REAL.value
    else:
        # count +inf|-inf of raw data
        nr = count_inf(data)
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
        return check_large_int_type(data)

    if isinstance(data, float) or isinstance(data, decimal.Decimal):
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

    try:
        re_dt = r'^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[\sT]\d{1,2}:\d{1,2}(:\d{1,2})?(\.\d+)?((\s?([+-]?\d{1,2}:\d{2})?)|Z)?$'
        matches = re.match(re_dt, data)
        if matches:
            return DataType.DATETIME
    except (ValueError, TypeError):
        pass

    return predict_eu_type(data)


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


def filter_blank_row(data):
    """
    filter blank row in csv
    :param data:
    :return:
    """
    for row in data:
        if row:
            yield row


def check_large_int_type(val):
    if int(val) > MAX_SAFE_INTEGER:
        return DataType.BIG_INT
    return DataType.INTEGER


@log_execution_time()
def check_exception_case(data_headers, data_rows):
    # exception case 1&2 from factory data
    # header: col_1,col2
    # row (1 only) with trailing comma: val_1,val_2,
    with_trailing_comma = False not in [row[-1] == '' for row in data_rows]
    if with_trailing_comma:
        is_exception_case = False not in [len(row) == (len(data_headers) + 1) for row in data_rows]
        if is_exception_case:
            return True
    return False


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
    # from sprint164 - accept duplicated columns
    # and apply add_suffix_if_duplicated
    # if len(headers) != len(set(headers)):
    #     return False

    is_exception = check_exception_case(headers, rows)
    if is_exception:
        return True

    # check column number of header vs data
    for row in rows:
        if len(row) != len(headers):
            return False

    return True


def get_metadata(file_stream, is_full_scan_metadata, default_csv_delimiter):
    # todo get_metadata.metadata --> maybe bug when run job ??
    dict_metadata = getattr(get_metadata, 'metadata', None)
    if not dict_metadata:
        # methodname.variable : variable is not deleted after function call
        get_metadata.metadata = {DELIMITER_KW: None, ENCODING_KW: None}  # trick for cache

    if is_full_scan_metadata:
        encoding = detect_encoding(file_stream)
        file_delimiter = detect_file_stream_delimiter(file_stream, default_csv_delimiter, encoding)
        get_metadata.metadata[ENCODING_KW] = encoding
        get_metadata.metadata[DELIMITER_KW] = file_delimiter
    else:
        encoding = get_metadata.metadata.get(ENCODING_KW)
        if not encoding:
            encoding = detect_encoding(file_stream)
            get_metadata.metadata[ENCODING_KW] = encoding
        file_delimiter = get_metadata.metadata.get(DELIMITER_KW)
        if not file_delimiter:
            file_delimiter = detect_file_stream_delimiter(
                file_stream, default_csv_delimiter, encoding
            )
            get_metadata.metadata[DELIMITER_KW] = file_delimiter

    return get_metadata.metadata


def zip_file_to_response(csv_data, file_names, export_type='csv'):
    encoding = UTF8_WITH_BOM if export_type == 'csv' else UTF8_WITHOUT_BOM
    if len(csv_data) == 1:
        csv_data = csv_data[0]
        csv_filename = gen_csv_fname(export_type)
        response = Response(
            csv_data.encode(encoding),
            mimetype=f'text/{export_type}',
            headers={
                'Content-Disposition': 'attachment;filename={}'.format(csv_filename),
            },
        )
    else:
        csv_filename = gen_csv_fname('zip')
        outfile = io.BytesIO()
        with ZipFile(outfile, 'w') as zf:
            for name, data in zip(file_names, csv_data):
                zf.writestr(name, data)

        zip_dat = outfile.getvalue()
        response = Response(
            zip_dat,
            mimetype='application/octet-stream',
            headers={
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment;filename={}'.format(csv_filename),
            },
        )

    response.charset = encoding
    return response
