from __future__ import annotations

import logging

import pandas as pd
from pandas import Series

from ap import log_execution_time
from ap.common.common_utils import SQLiteFormatStrings
from ap.common.constants import DEFAULT_NONE_VALUE, DataType

logger = logging.getLogger(__name__)


class DateTimeFormatUtils(object):
    datetime_format: str
    date_format: str
    time_format: str

    def __init__(self, dic: dict):
        self.datetime_format = dic['datetime']
        self.date_format = dic['date']
        self.time_format = dic['time']

    TIME_FORMAT_CODES = ['%H', '%I', '%M', '%S', '%p', '%f', '%z', '%Z']
    DATE_FORMAT_CODES = [
        '%a',
        '%A',
        '%w',
        '%d',
        '%b',
        '%B',
        '%m',
        '%y',
        '%Y',
        '%z',
        '%Z',
        '%j',
        '%U',
        '%W',
        '%c',
        '%x',
        '%G',
        '%u',
        '%V',
    ]

    @staticmethod
    def get_datetime_format(datetime_format_str: str):
        format_dict = {
            'datetime': datetime_format_str if datetime_format_str is not None and datetime_format_str != '' else None,
            'date': None,
            'time': None,
        }

        if format_dict['datetime'] is None:
            return DateTimeFormatUtils(format_dict)

        def get_start_index_by_codes(format_codes):
            indexes = [datetime_format_str.index(code) for code in format_codes if code in datetime_format_str]
            return min(indexes) if indexes else None

        time_start_index = get_start_index_by_codes(DateTimeFormatUtils.TIME_FORMAT_CODES)
        date_start_index = get_start_index_by_codes(DateTimeFormatUtils.DATE_FORMAT_CODES)

        if time_start_index is not None and date_start_index is not None:
            # These are valid indexes if and only if one of them is zero
            if time_start_index == 0:
                format_dict['time'] = datetime_format_str[:date_start_index].strip()
                format_dict['date'] = datetime_format_str[date_start_index:].strip()
            elif date_start_index == 0:
                format_dict['time'] = datetime_format_str[time_start_index:].strip()
                format_dict['date'] = datetime_format_str[:time_start_index].strip()
        elif time_start_index is not None and date_start_index is None:
            format_dict['time'] = datetime_format_str[time_start_index:]
        elif time_start_index is None and date_start_index is not None:
            format_dict['date'] = datetime_format_str[date_start_index:]
        else:
            DateTimeFormatUtils.notify_invalid_format()

        return DateTimeFormatUtils(format_dict)

    @staticmethod
    def notify_invalid_format():
        raise Exception('Invalid datetime format!!!')


@log_execution_time()
def convert_datetime_format(
    df,
    dic_data_type,
    datetime_format: str | None = None,
    client_timezone: str | None = None,
):
    datetime_format_obj = DateTimeFormatUtils.get_datetime_format(datetime_format)
    for col, data_type in dic_data_type.items():
        if col not in df.columns:
            continue
        try:
            if data_type == DataType.DATETIME.name:
                df[col] = format_datetime(df, col, datetime_format_obj.datetime_format, client_timezone)

            elif data_type == DataType.DATE.name:
                df[col] = format_date(df, col, datetime_format_obj.date_format)

            elif data_type == DataType.TIME.name:
                df[col] = format_time(df, col, datetime_format_obj.time_format)

            df[col] = df[col].replace({pd.NaT: DEFAULT_NONE_VALUE})

        except Exception:
            df[col] = DEFAULT_NONE_VALUE

    return df


def format_datetime(df, col, datetime_format, client_timezone):
    from ap.api.setting_module.services.csv_import import datetime_transform

    # Convert datetime base on datetime format
    if datetime_format:
        datetime_series = pd.to_datetime(df[col], errors='coerce', format=datetime_format)

        if client_timezone:
            df[col] = convert_client_timezone(datetime_series, client_timezone)
        else:
            df[col] = datetime_series.dt.strftime(SQLiteFormatStrings.DATETIME.value).astype(pd.StringDtype())

        return df[col]

    if pd.api.types.is_object_dtype(df[col]):
        df[col] = df[col].astype(pd.StringDtype())

    if not pd.api.types.is_string_dtype(df[col]):
        return df[col]

    df[col] = datetime_transform(df[col])
    if client_timezone:
        df[col] = pd.to_datetime(df[col], errors='coerce', format='mixed')
        df[col] = convert_client_timezone(df[col], client_timezone)

    return df[col]


def convert_client_timezone(series: Series, client_timezone: str):
    if pd.api.types.is_object_dtype(series):
        series = pd.to_datetime(series, errors='coerce', utc=True)
    if series.dt.tz:
        series = series.dt.tz_convert(client_timezone).astype(pd.StringDtype())
    else:
        series = series.dt.tz_localize(client_timezone).astype(pd.StringDtype())

    return series


def format_date(df, col, date_format):
    from ap.api.setting_module.services.csv_import import date_transform

    # Convert date base on date format
    if date_format:
        return (
            pd.to_datetime(df[col], errors='coerce', format=date_format)
            .dt.strftime(SQLiteFormatStrings.DATE.value)
            .astype(pd.StringDtype())
        )

    if pd.api.types.is_datetime64_dtype(df[col]):
        return df[col].dt.strftime(SQLiteFormatStrings.DATE.value).astype(pd.StringDtype())

    # try to convert to date using pandas, and replaced those cannot be converted with old values
    date_series = pd.to_datetime(df[col], errors='coerce').dt.strftime(SQLiteFormatStrings.DATE.value)
    is_na = date_series.isna()
    date_series.loc[is_na] = df.loc[is_na, col].astype(pd.StringDtype())

    return date_transform(date_series)


def format_time(df, col, time_format):
    from ap.api.setting_module.services.csv_import import time_transform

    # Convert time base on time format
    if time_format:
        return (
            pd.to_datetime(df[col], errors='coerce', format=time_format)
            .dt.strftime(SQLiteFormatStrings.TIME.value)
            .astype(pd.StringDtype())
        )

    if pd.api.types.is_datetime64_dtype(df[col]):
        return df[col].dt.strftime(SQLiteFormatStrings.TIME.value).astype(pd.StringDtype())

    # try to convert to time using pandas, and replaced those cannot be converted with old values
    time_series = pd.to_datetime(df[col], errors='coerce').dt.strftime(SQLiteFormatStrings.TIME.value)
    is_na = time_series.isna()
    time_series.loc[is_na] = df.loc[is_na, col].astype(pd.StringDtype())

    return time_transform(time_series)
