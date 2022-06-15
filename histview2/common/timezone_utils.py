import re
from datetime import datetime
from datetime import timedelta, timezone
from functools import partial

# import pytz
from dateutil import parser, tz
from loguru import logger

from histview2.common.common_utils import DATE_FORMAT_STR, DATE_FORMAT_STR_CSV, add_double_quotes
from histview2.common.logger import log_execution_time
from histview2.common.pydn.dblib import oracle, mssqlserver, mysql


@log_execution_time()
def detect_timezone(dt_input):
    """
    Detect timezone of a datetime string. e.g. 2019-05-14T09:01:04.000000Z/2019-05-14T09:01:04.000000,...
    Return timezone object
    """
    try:
        if isinstance(dt_input, str):
            dt = parser.parse(dt_input)
            return dt.tzinfo
        elif isinstance(dt_input, datetime):
            return dt_input.tzinfo
    except Exception as ex:
        logger.error(ex)
    return None


# def convert_str_utc_by_timezone_pytz(time_zone: pytz.tzinfo.DstTzInfo, dt_str):
#     """
#     timezone: pytz.tzinfo.DstTzInfo object. e.g. pytz.timezone('Asia/Tokyo')
#     dt_str: datetime string: e.g.2019-05-14T20:01:04.000000Z
#     """
#     try:
#         dt_obj = parser.parse(dt_str)
#         dt_obj = time_zone.localize(dt_obj)
#         dt_obj = dt_obj.astimezone(tz.tzutc())
#     except Exception:
#         return None
#
#     return datetime.strftime(dt_obj, DATE_FORMAT_STR)
#
#
def convert_str_utc_by_timezone(time_zone, dt_str):
    """
    timezone: timezone object. e.g. dateutil.tz.tzutc(), dateutil.tz.tzlocal()
    dt_str: datetime string: e.g.2019-05-14T20:01:04.000000Z
    """
    try:
        dt_obj = parser.parse(dt_str)
        dt_obj = dt_obj.replace(tzinfo=time_zone)
        dt_obj = dt_obj.astimezone(tz.tzutc())
    except Exception:
        return None

    return datetime.strftime(dt_obj, DATE_FORMAT_STR)


def convert_dt_str_to_timezone(time_zone, dt_str):
    """
    timezone: timezone object. e.g. dateutil.tz.tzutc(), dateutil.tz.tzlocal()
    dt_str: datetime string: e.g.2019-05-14T20:01:04.000000Z
    """
    if not dt_str:
        return dt_str

    try:
        dt_obj = parser.parse(dt_str)
        dt_obj = dt_obj.astimezone(time_zone)
    except Exception:
        return None

    return datetime.strftime(dt_obj, DATE_FORMAT_STR_CSV)


def convert_str_utc(dt_str):
    """
    dt_str: datetime string: e.g.2019-05-14T20:01:04.000000Z
    """
    try:
        dt_obj = parser.parse(dt_str)
        dt_obj = dt_obj.astimezone(tz.tzutc())
    except Exception:
        return None

    return datetime.strftime(dt_obj, DATE_FORMAT_STR)


def convert_date_utc_by_timezone(time_zone, date_obj):
    """
    timezone: timezone object. e.g. dateutil.tz.tzutc(), dateutil.tz.tzlocal()
    date_obj: date object: e.g.2019-05-14
    """
    date_obj = datetime.combine(date_obj, datetime.min.time())
    date_obj = date_obj.replace(tzinfo=time_zone)
    date_obj = date_obj.astimezone(tz.tzutc())

    return datetime.strftime(date_obj, DATE_FORMAT_STR)


# def convert_dt_utc_by_timezone_pytz(time_zone: pytz.tzinfo.DstTzInfo, dt_obj):
#     """
#     timezone: pytz.tzinfo.DstTzInfo object. e.g. pytz.timezone('Asia/Tokyo')
#     dt_obj: datetime object: e.g.2019-05-14T20:01:04.000000Z
#     """
#     dt_obj = time_zone.localize(dt_obj)
#     dt_obj = dt_obj.astimezone(tz.tzutc())
#
#     return datetime.strftime(dt_obj, DATE_FORMAT_STR)
#
#
def convert_dt_utc_by_timezone(time_zone, dt_obj):
    """
    timezone: timezone object. e.g. dateutil.tz.tzutc(), dateutil.tz.tzlocal()
    dt_obj: datetime object: e.g.2019-05-14T20:01:04.000000Z
    """
    dt_obj = dt_obj.replace(tzinfo=time_zone)
    dt_obj = dt_obj.astimezone(tz.tzutc())

    return datetime.strftime(dt_obj, DATE_FORMAT_STR)


def convert_other_utc_by_timezone(time_zone, val):
    """
    Return the same value for types that are not str/datetime
    Note: Don't remove time_zone param
    """
    return val


def convert_dt_utc(dt_obj):
    """
    dt_str: datetime string: e.g.2019-05-14T20:01:04.000000Z
    """
    dt_obj = dt_obj.astimezone(tz.tzutc())

    return datetime.strftime(dt_obj, DATE_FORMAT_STR)


def keep_same_val(val):
    return val


def choose_utc_convert_func(date_val, time_zone=None):
    # detect timezone
    detected_timezone = detect_timezone(date_val)

    if detected_timezone:
        # convert utc time func
        if isinstance(date_val, str):
            convert_utc_func = convert_str_utc
        elif isinstance(date_val, datetime):
            convert_utc_func = convert_dt_utc
        else:
            convert_utc_func = keep_same_val
    else:
        detected_timezone = time_zone or tz.tzlocal()
        # convert utc time func
        if isinstance(date_val, str):
            convert_utc_func = partial(convert_str_utc_by_timezone, detected_timezone)
        elif isinstance(date_val, datetime):
            convert_utc_func = partial(convert_dt_utc_by_timezone, detected_timezone)
        else:
            convert_utc_func = partial(convert_other_utc_by_timezone, None)

    return convert_utc_func, detected_timezone


def gen_sql(db_instance, table_name, get_date_col):
    get_date_col = add_double_quotes(get_date_col)
    if not isinstance(db_instance, mysql.MySQL):
        table_name = add_double_quotes(table_name)

    sql = f'from {table_name} where {get_date_col} is not null'
    if isinstance(db_instance, mssqlserver.MSSQLServer):
        sql = f'select TOP 1 {get_date_col}, 0 {sql}'
    elif isinstance(db_instance, oracle.Oracle):
        data_type = db_instance.get_data_type_by_colname(table_name.strip('\"'), get_date_col.strip('\"'))
        format_str = 'TZR' if data_type and 'TIME ZONE' in data_type else None
        if format_str:
            sql = f"select {get_date_col}, to_char({get_date_col},'{format_str}') {sql} and rownum = 1"
        else:
            sql = f'select {get_date_col}, 0 {sql} and rownum = 1'
    else:
        sql = f'select {get_date_col}, 0 {sql} limit 1'

    return sql


def calc_offset_between_two_tz(from_tz, to_tz):
    cur_datetime = datetime.now()

    dt_frm = cur_datetime.replace(tzinfo=from_tz)
    dt_frm = dt_frm.astimezone(tz.tzutc())

    dt_to = cur_datetime.replace(tzinfo=to_tz)
    dt_to = dt_to.astimezone(tz.tzutc())

    # get timezone offset
    if dt_to == dt_frm:
        return None

    if dt_to >= dt_frm:
        sign = '+'
        diff_tm = str(dt_to - dt_frm)
    else:
        sign = '-'
        diff_tm = str(dt_frm - dt_to)

    if diff_tm[1] == ':':
        sign += '0'

    diff_tm = sign + diff_tm

    return diff_tm


def get_db_timezone(db_instance):
    # get timezone offset
    tz_offset = db_instance.get_timezone()
    db_timezone = timezone_regex(tz_offset)

    return db_timezone


def timezone_regex(tz_offset):
    if isinstance(tz_offset, str):
        matches = re.match('^([+\-]?)(\d{1,2}):?(\d{2})?', tz_offset)

        if matches:
            sign, hours, minutes = matches.groups()
            time_zone = timezone(timedelta(hours=float('{}{}'.format(sign, hours)), minutes=float(minutes or 0)))
        else:
            time_zone = tz.gettz(tz_offset or None) or tz.tzlocal()
            # time_zone = pytz.timezone(tz_offset)
    else:
        time_zone = tz_offset

    return time_zone


@log_execution_time()
def get_utc_offset(time_zone):
    """
    get utc time offset
    :param time_zone: str, timezone object
    :return: timedelta(seconds)
    """
    if isinstance(time_zone, str):
        time_zone = tz.gettz(time_zone)

    time_in_tz = datetime.now(tz=time_zone)
    time_offset = time_in_tz.utcoffset().seconds
    time_offset = timedelta(seconds=time_offset)

    return time_offset


def get_time_info(date_val, time_zone=None):
    # detect timezone
    detected_timezone = detect_timezone(date_val)

    if detected_timezone:
        is_timezone_inside = True
    else:
        is_timezone_inside = False
        detected_timezone = time_zone or tz.tzlocal()

    utc_offset = get_utc_offset(detected_timezone)

    return is_timezone_inside, detected_timezone, utc_offset
