# CSVコンテンツを生成するService
# read(dic_form, local_params)が外向けの関数
from __future__ import annotations

import codecs
import csv
import io

# https://stackoverrun.com/ja/q/6869533
import logging
from datetime import datetime
from itertools import islice
from zipfile import ZipFile

import numpy as np
import pandas as pd
from flask import Response

from ap.api.efa.services.etl import detect_file_stream_delimiter
from ap.common.common_utils import detect_encoding, is_normal_zip, open_with_zip
from ap.common.constants import (
    CP932,
    DELIMITER_KW,
    EMPTY_STRING,
    ENCODING_KW,
    SHIFT_JIS,
    SHIFT_JIS_NAME,
    UTF8_WITH_BOM,
    UTF8_WITH_BOM_NAME,
    UTF8_WITHOUT_BOM,
    WINDOWS_31J,
    CSVExtTypes,
)
from ap.common.logger import log_execution_time
from ap.common.services.normalization import normalize_list

logger = logging.getLogger(__name__)


def gen_csv_fname(export_type=CSVExtTypes.CSV.value):
    timestr = datetime.utcnow().strftime('%Y%m%d_%H%M%S.%f')[:-3]
    csv_fname = '{0:s}_out.{1:s}'.format(timestr, export_type)
    return csv_fname


def get_encoding_name(encoding):
    encoding = encoding.lower()
    jis_groups = [SHIFT_JIS, WINDOWS_31J, CP932]
    if SHIFT_JIS in encoding or encoding in jis_groups:
        return SHIFT_JIS_NAME
    if encoding == UTF8_WITH_BOM:
        return UTF8_WITH_BOM_NAME

    return encoding


def get_delimiter_encoding(f_name, preview=False, skip_head: int | None = None):
    with open_with_zip(f_name, 'rb') as f:
        if skip_head is not None and skip_head != 0:
            f.readlines(skip_head)
        metadata = get_metadata(f, is_full_scan_metadata=True, default_csv_delimiter=',')
        delimiter = metadata.get(DELIMITER_KW)
        encoding = metadata.get(ENCODING_KW)

        if preview:
            encoding = get_encoding_name(encoding)
        return delimiter, encoding


def get_limit_records(
    is_transpose: bool = False,
    n_rows: int | None = None,
    user_limit: int | None = None,
) -> int | None:
    nrows = get_number_of_reading_lines(n_rows, user_limit)

    # do not use user provided limit if we need to transpose
    if is_transpose:
        return nrows

    if nrows is None:
        return user_limit

    # need to escape 1 records because of the header
    nrows = nrows - 1

    if user_limit is None:
        return nrows

    return min(nrows, user_limit)


def get_number_of_reading_lines(n_rows: int | None = None, limit: int | None = None) -> int | None:
    """
    @param n_rows:
    @param limit:
    @return: The number of rows we need to read
    If we specify n_rows, we must use these instead.
    Otherwise, we should use user_limit
    However if n_rows is 0, we will read all the rows (return None)
    """
    if n_rows is not None:
        if n_rows == 0:
            return None
        return n_rows

    if limit is not None:
        # include the header
        return limit + 1

    return None


def read_data(
    f_name,
    headers=None,
    skip_head=None,
    n_rows: int | None = None,
    limit: int | None = None,
    is_transpose: bool = False,
    delimiter=',',
    do_normalize=True,
):
    nrows = get_number_of_reading_lines(n_rows, limit)

    normalize_func = normalize_list if do_normalize else lambda x: x

    _delimiter, encoding = get_delimiter_encoding(f_name, skip_head=skip_head)
    # prioritize provided delimiter
    if delimiter is None or delimiter == 'Auto':
        delimiter = _delimiter

    with open_with_zip(f_name, 'r', encoding=encoding) as f:
        _f = f
        if is_normal_zip(f_name):
            _f = codecs.iterdecode(f, encoding)

        # replace NUL (\0) in line
        rows = csv.reader((line.replace('\0', '') for line in _f), delimiter=delimiter)
        if isinstance(rows, bytes):
            rows = rows.decode(encoding)

        # skip head
        if skip_head is not None:
            rows = islice(rows, skip_head, None)

        # skip tail
        if nrows is not None:
            rows = islice(rows, nrows)

        if is_transpose:
            rows = filter_blank_row(rows)
            rows = list(rows)
            rows = map(list, zip(*rows))

        # use specify header( maybe get from yaml config)
        csv_headers = next(rows)
        if headers is not None:
            yield normalize_func(headers)
        else:
            yield normalize_func(csv_headers)
        # send data
        for row in rows:
            yield normalize_func(row)


def read_csv_with_transpose(file_path: str, is_transpose: bool = False, **pd_params) -> pd.DataFrame:
    if is_transpose:
        params = pd_params.copy()
        params.pop('index_col', None)
        params.pop('header', None)
        use_cols = params.pop('usecols', [])
        dtypes = params.pop('dtype', [])
        df = pd.read_csv(file_path, **params, index_col=0, header=None).T

        # rename columns
        df_headers = df.columns
        parsed_headers = df.columns.to_series().replace({np.nan: ''}).to_list()

        dropped_columns = []
        renamed_columns = {}
        for df_header, parsed_header in zip(df_headers, parsed_headers):
            if parsed_header not in use_cols:
                dropped_columns.append(df_header)
            else:
                renamed_columns[df_header] = parsed_header
        df = df.drop(dropped_columns, axis=1)
        df = df.rename(columns=renamed_columns)

        # cast datatype
        for col_name, dtype in dtypes.items():
            if col_name in df:
                df[col_name] = df[col_name].astype(dtype)

        return df

    return pd.read_csv(file_path, **pd_params)


# check special float type


# check data type of 1 data


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
def check_exception_case(data_headers, data_rows):
    # exception case 1&2 from factory data
    # header: col_1,col2
    # row (1 only) with trailing comma: val_1,val_2,
    def row_has_trailing_comma(row: list[str]):
        return row and row[-1] == EMPTY_STRING

    with_trailing_comma = all(map(row_has_trailing_comma, data_rows))

    def row_equal_data_headers(row: list[str]):
        return len(row) == len(data_headers) + 1

    if with_trailing_comma:
        is_exception_case = all(map(row_equal_data_headers, data_rows))
        if is_exception_case:
            return True
    return False


@log_execution_time()
def is_normal_csv(f_name, delimiter=',', skip_head=None, n_rows: int | None = None, is_transpose: bool = False):
    """
    @param f_name:
    @param delimiter:
    @param skip_head:
    @param n_rows:
    @param is_transpose:
    @return:
    """
    if not delimiter:
        delimiter, _ = get_delimiter_encoding(f_name)

    data = read_data(
        f_name,
        n_rows=n_rows,
        delimiter=delimiter,
        do_normalize=False,
        skip_head=skip_head,
        is_transpose=is_transpose,
        limit=20,
    )
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
    return all(len(row) == len(headers) for row in rows)


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
            file_delimiter = detect_file_stream_delimiter(file_stream, default_csv_delimiter, encoding)
            get_metadata.metadata[DELIMITER_KW] = file_delimiter

    return get_metadata.metadata


def zip_file_to_response(csv_data, file_names, export_type=CSVExtTypes.CSV.value):
    encoding = UTF8_WITH_BOM if export_type == CSVExtTypes.CSV.value else UTF8_WITHOUT_BOM
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
