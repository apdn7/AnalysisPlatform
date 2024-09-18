import copy
import functools
import json
import locale
import os
import pickle
import re
import shutil
import socket
import sys
import zipfile
from collections import OrderedDict
from datetime import datetime, timedelta
from enum import Enum
from io import IOBase
from itertools import permutations
from multiprocessing import Manager
from pathlib import Path
from typing import IO, Any, List, TextIO, Union

import chardet
import numpy as np
import pandas as pd

# from charset_normalizer import detect
from dateutil import parser, tz
from dateutil.relativedelta import relativedelta
from flask import g
from flask_assets import Bundle, Environment
from pandas import DataFrame, Series
from pandas.io import parquet
from pyarrow import feather

from ap.common.constants import (
    ANALYSIS_INTERFACE_ENV,
    ENCODING_ASCII,
    ENCODING_SHIFT_JIS,
    ENCODING_UTF_8,
    ENCODING_UTF_8_BOM,
    INT64_MAX,
    INT64_MIN,
    LANGUAGES,
    PROCESS_QUEUE,
    SAFARI_SUPPORT_VER,
    SCP_HMP_X_AXIS,
    SCP_HMP_Y_AXIS,
    SQL_COL_PREFIX,
    UNIVERSAL_DB_FILE,
    ZERO_FILL_PATTERN,
    ZERO_FILL_PATTERN_2,
    AbsPath,
    AppEnv,
    CsvDelimiter,
    CSVExtTypes,
    DataType,
    FileExtension,
    FilterFunc,
    FlaskGKey,
    ListenNotifyType,
)
from ap.common.logger import log_execution_time, logger
from ap.common.services.jp_to_romaji_utils import replace_special_symbols, to_romaji
from ap.common.services.normalization import NORMALIZE_FORM_NFKD, normalize_str, unicode_normalize

TXT_FILE_TYPE = '.txt'
DATE_FORMAT_STR = '%Y-%m-%dT%H:%M:%S.%fZ'
DATE_FORMAT_SQLITE_STR = '%Y-%m-%dT%H:%M:%S'
DATE_FORMAT_QUERY = '%Y-%m-%dT%H:%M:%S.%f'
DATE_FORMAT_STR_CSV = '%Y-%m-%d %H:%M:%S.%f'
DATE_FORMAT_STR_FACTORY_DB = '%Y-%m-%d %H:%M:%S.%f'
DATE_FORMAT_STR_ONLY_DIGIT = '%Y%m%d%H%M%S.%f'
DATE_FORMAT = '%Y-%m-%d'
TIME_FORMAT = '%H:%M'
TIME_FORMAT_WITH_SEC = '%H:%M:%S'
RL_DATETIME_FORMAT = '%Y-%m-%dT%H:%M'
DATE_FORMAT_SIMPLE = '%Y-%m-%d %H:%M:%S'
DATE_FORMAT_FOR_ONE_HOUR = '%Y-%m-%d %H:00:00'
API_DATETIME_FORMAT = '%Y-%m-%dT%H:%MZ'
# for data count
TERM_FORMAT = {'year': '%Y', 'month': '%Y-%m', 'week': DATE_FORMAT}
FREQ_FOR_RANGE = {'year': 'M', 'month': 'D', 'week': 'H'}


def get_current_timestamp(format_str=DATE_FORMAT_STR):
    return datetime.utcnow().strftime(format_str)


class PostgresFormatStrings(Enum):
    DATE = '%Y-%m-%d'
    TIME = '%H:%M:%S'
    DATETIME = '%Y-%m-%d %H:%M:%S.%f'


class SQLiteFormatStrings(Enum):
    DATE = '%Y-%m-%d'
    TIME = '%H:%M:%S'
    DATETIME = '%Y-%m-%d %H:%M:%S'


def parse_int_value(value):
    """
    Parse integral value from text or numeric data
    :param value:
    :return: parsed integral value.
    """
    if isinstance(value, str):
        value = unicode_normalize(value, convert_irregular_chars=False)
        if value.isdigit():
            return int(value)
    elif isinstance(value, int):
        return value

    return None


def gen_sql_cast_text_no_as(col):
    return f'CAST({col} AS TEXT)'


def dict_deep_merge(source, destination):
    """
    Deep merge two dictionary to one.

    >>> a = { 'first' : { 'all_rows' : { 'pass' : 'dog', 'number' : '1' } } }
    >>> b = { 'first' : { 'all_rows' : { 'fail' : 'cat', 'number' : '5' } } }
    >>> dict_deep_merge(b, a) == { 'first' : { 'all_rows' : { 'pass' : 'dog', 'fail' : 'cat', 'number' : '5' } } }
    """
    if source:
        for key, value in source.items():
            if isinstance(value, dict) and destination.get(key):
                # get node or create one
                node = destination.setdefault(key, {})
                dict_deep_merge(value, node)
            else:
                destination[key] = copy.deepcopy(value)

    return destination


def convert_json_to_ordered_dict(json):
    """
    Deeply convert a normal dict to OrderedDict.
    :param json: input json
    :return: ordered json
    """
    if isinstance(json, dict):
        ordered_json = OrderedDict(json)
        try:
            for key, value in ordered_json.items():
                ordered_json[key] = convert_json_to_ordered_dict(value)
        except AttributeError:
            pass
        return ordered_json

    return json


def get_latest_file(root_name):
    try:
        latest_files = get_files(
            root_name,
            depth_from=1,
            depth_to=100,
            extension=[CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value],
        )
        latest_files.sort()
        return latest_files[-1].replace(os.sep, '/')
    except Exception:
        return ''


def get_sorted_files(root_name, is_allow_zip: bool = True) -> List[str]:
    try:
        extension = [CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value]
        if is_allow_zip:
            extension.append(CSVExtTypes.ZIP.value)
        latest_files = get_files(root_name, depth_from=1, depth_to=100, extension=extension)
        latest_files = [file_path.replace(os.sep, '/') for file_path in latest_files]
        latest_files.sort(reverse=True)
        return latest_files
    except Exception:
        return []


@log_execution_time()
def is_normal_zip(f_name: Union[str, Path]) -> bool:
    return Path(f_name).suffix == '.zip'


def get_largest_files_in_list(files: List[str]) -> List[str]:
    sorted_files = sorted(files, key=lambda x: os.path.getsize(x))
    sorted_files.reverse()
    return sorted_files


def get_sorted_files_in_list(files: List[str]) -> List[str]:
    sorted_files = sorted(files, key=lambda x: (os.path.getsize(x), os.path.getctime(x)))
    sorted_files.reverse()
    return sorted_files


def get_sorted_files_by_size(root_name: str, is_allow_zip: bool = True) -> List[str]:
    try:
        extension = [CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value]
        if is_allow_zip:
            extension.append(CSVExtTypes.ZIP.value)
        files = get_files(root_name, depth_from=1, depth_to=100, extension=extension)
        largest_files = get_largest_files_in_list(files)
        return largest_files
    except FileNotFoundError:
        return []


def get_sorted_files_by_size_and_time(root_name: str, is_allow_zip: bool = True) -> List[str]:
    try:
        extension = [CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value]
        if is_allow_zip:
            extension.append(CSVExtTypes.ZIP.value)
        files = get_files(root_name, depth_from=1, depth_to=100, extension=extension)
        largest_files = get_sorted_files_in_list(files)
        return largest_files
    except FileNotFoundError:
        return []


def get_latest_files(root_name: Union[Path, str]) -> List[str]:
    try:
        files = get_files(
            str(root_name),
            depth_from=1,
            depth_to=100,
            extension=[CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value, CSVExtTypes.ZIP.value],
        )
        files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        files = [f.replace(os.sep, '/') for f in files]
        return files
    except FileNotFoundError:
        return []


def start_of_minute(start_date, start_tm, delimiter='T'):
    if start_date is None or start_tm is None:
        return None
    if start_tm and len(start_tm) == 5:
        start_tm = start_tm + ':00'

    return '{}{}{}'.format(start_date.replace('/', '-'), delimiter, start_tm)


def end_of_minute(start_date, start_tm, delimiter='T'):
    if start_date is None or start_tm is None:
        return None
    if start_tm and len(start_tm) == 5:
        start_tm = start_tm + ':00'

    # start_tm = start_tm[:8] + '.999999'
    start_tm = start_tm[:8]

    return '{}{}{}'.format(start_date.replace('/', '-'), delimiter, start_tm)


def clear_special_char(target):
    if not target:
        return target

    if isinstance(target, (list, tuple)):
        return [_clear_special_char(s) for s in target]
    elif isinstance(target, str):
        return _clear_special_char(target)


def _clear_special_char(target_str):
    if not target_str:
        return target_str

    output = target_str
    for s in ('"', "'", '*'):
        output = output.replace(s, '')

    return output


def universal_db_exists():
    universal_db = os.path.join(os.getcwd(), 'instance', 'universal.sqlite3')
    # if getattr(sys, 'frozen', False): # Use for EXE file only
    instance_folder = os.path.join(os.getcwd(), 'instance')
    if not os.path.exists(instance_folder):
        os.makedirs(instance_folder)
    return os.path.exists(universal_db)


# convert time before save to database YYYY-mm-DDTHH:MM:SS.NNNNNNZ
def convert_time(
    time: object = None,
    format_str: object = DATE_FORMAT_STR,
    return_string: object = True,
    only_millisecond: object = False,
    remove_ms: object = False,
) -> object:
    if not time:
        time = datetime.utcnow()
    elif isinstance(time, str):
        time = parser.parse(time)

    if return_string:
        time = time.strftime(format_str)
        if only_millisecond:
            time = time[:-3]
        elif remove_ms:
            time = time[:-8]
    return time


def calculator_day_ago(from_time, is_tz_col, to_time=None):
    if not to_time:
        to_time = datetime.now()
        if is_tz_col:
            to_time = datetime.utcnow().replace(tzinfo=tz.tzutc())
    day_ago = (to_time - from_time).days
    return day_ago


def add_seconds(time=None, seconds=0):
    """add seconds

    Keyword Arguments:
        time {[type]} -- [description] (default: {datetime.now()})
        days {int} -- [description] (default: {0})

    Returns:
        [type] -- [description]
    """
    if not time:
        time = datetime.utcnow()

    return time + timedelta(seconds=seconds)


def add_days(time=datetime.utcnow(), days=0):
    """add days

    Keyword Arguments:
        time {[type]} -- [description] (default: {datetime.now()})
        days {int} -- [description] (default: {0})

    Returns:
        [type] -- [description]
    """
    return time + timedelta(days)


def add_years(time=datetime.utcnow(), years=0):
    """add days

    Keyword Arguments:
        time {[type]} -- [description] (default: {datetime.now()})
        years {int} -- [description] (default: {0})

    Returns:
        [type] -- [description]
    """
    return time + relativedelta(years=years)


def add_months(time=datetime.utcnow(), months=0):
    """add months

    Keyword Arguments:
        time {[type]} -- [description] (default: {datetime.now()})
        months {int} -- [description] (default: {0})

    Returns:
        [type] -- [description]
    """
    if isinstance(time, str):
        time = parser.parse(time)
    return time + relativedelta(months=months)


@log_execution_time()
def get_files(directory, depth_from=1, depth_to=2, extension=[''], file_name_only=False):
    """get files in folder

    Arguments:
        directory {[type]} -- [description]

    Keyword Arguments:
        depth_limit {int} -- [description] (default: 2)
        extension {list} -- [description] (default: [''])

    Returns:
        [type] -- [description]
    """
    output_files = []
    if not directory:
        return output_files

    if not check_exist(directory):
        raise FileNotFoundError('Folder not found!')

    root_depth = directory.count(os.path.sep)
    for root, _, files in os.walk(directory):
        # limit depth of recursion
        current_depth = root.count(os.path.sep) + 1
        # assume that directory depth is 1, sub folders are 2, 3, ...
        # default is to just read children sub folder, depth from 1 to 2
        if (current_depth < root_depth + depth_from) or (current_depth > root_depth + depth_to):
            continue

        # list files with extension
        for file in files:
            # Check file is modified in [in_modified_days] days or not
            if any(file.lower().endswith(ext) for ext in extension):
                if file_name_only:
                    output_files.append(file)
                else:
                    output_files.append(os.path.join(root, file))

    return output_files


def add_double_quotes(instr: str):
    """add double quotes to a string (column name)

    Arguments:
        instr {str} -- [description]

    Returns:
        [type] -- [description]
    """
    if not instr:
        return instr

    instr = instr.strip('"')

    return f'"{instr}"'


def resource_path(*relative_path, level=AbsPath.SHOW):
    """make absolute path

    Keyword Arguments:
        level {int} -- [0: auto, 1: user can see folder, 2: user can not see folder(MEIPASS)] (default: {0})

    Returns:
        [type] -- [description]
    """

    show_path = os.getcwd()
    hide_path = getattr(sys, '_MEIPASS', show_path)

    if level is AbsPath.SHOW:
        basedir = show_path
    elif level is AbsPath.HIDE or getattr(sys, 'frozen', False):
        basedir = hide_path
    else:
        basedir = show_path

    return os.path.join(basedir, *relative_path)


# class RUtils:
#     def __init__(self, package, *args, **kwargs):
#         # r instance
#         r_portable_env = os.environ.get('R-PORTABLE')
#         if r_portable_env:
#             self.r_exe = os.path.join(r_portable_env, 'bin', 'R.exe')
#             self.r_library = os.path.join(r_portable_env, 'library')
#         else:
#             self.r_exe = resource_path(R_PORTABLE, 'bin', 'R.exe', level=AbsPath.SHOW)
#             self.r_library = resource_path(R_PORTABLE, 'library', level=AbsPath.SHOW)
#
#         # specify R-Portable execution
#         self.r = pyper.R(RCMD=self.r_exe, *args, **kwargs)
#         logger.info(self.r('Sys.getenv()'))
#
#         # specify R-Portable library
#         self.r('.libPaths(c(""))')
#         self.r(f'.libPaths(c("{self.r_library}"))')
#         logger.info(self.r('.libPaths()'))
#
#         # R package folder
#         self.source = resource_path('ap', 'script', 'r_scripts', package)
#         self.r(f'source("{self.source}")')
#
#     def __call__(self, func, *args, _number_of_recheck_r_output=1000, **kwargs) -> object:
#         """call funtion with parameters
#
#         Arguments:
#             func {[string]} -- R function name
#
#         Keyword Arguments:
#             _number_of_recheck_r_output {int} -- [R function may take time to return output, Python must check many
#             time to get final output] (default: {100})
#
#         Returns:
#             [type] -- [R output]
#         """
#         args_prefix = 'args__'
#         kwargs_prefix = 'kwargs__'
#         output_var = 'output__'
#
#         r_args = []
#         for i, val in enumerate(args):
#             para = f'{args_prefix}{i}'
#             self.r.assign(para, val)
#             r_args.append(para)
#
#         r_kwargs = []
#         for i, (key, val) in enumerate(kwargs.items()):
#             para = f'{kwargs_prefix}{i}'
#             self.r.assign(para, val)
#             r_kwargs.append(f'{key}={para}')
#
#         final_args = ','.join(chain(r_args, r_kwargs))
#
#         self.r(f'{output_var} = {func}({final_args})')
#
#         # wait for R return an output
#         output = None
#         while (not output) and _number_of_recheck_r_output:
#             output = self.r.get(output_var)
#             _number_of_recheck_r_output -= 1
#
#         print(_number_of_recheck_r_output, output)
#         return output


# def get_file_size(f_name):
#     """get file size
#
#     Arguments:
#         f_name {[type]} -- [description]
#
#     Returns:
#         [type] -- [description]
#     """
#     return os.path.getsize(f_name)


def create_file_path(prefix, suffix='.tsv', dt=None):
    f_name = f'{prefix}_{convert_time(dt, format_str=DATE_FORMAT_STR_ONLY_DIGIT)}{suffix}'
    file_path = resource_path(get_data_path(abs=False), f_name, level=AbsPath.SHOW)

    if not os.path.exists(os.path.dirname(file_path)):
        os.makedirs(os.path.dirname(file_path))

    return file_path


def copy_file(source, target):
    """copy file

    Arguments:
        source {[type]} -- [description]
        target {[type]} -- [description]
    """
    if not check_exist(source):
        return False

    shutil.copy2(source, target)
    return True


# def path_split_all(path):
#     """split all part of a path
#
#     Arguments:
#         path {[string]} -- [full path]
#     """
#     allparts = []
#     while True:
#         parts = os.path.split(path)
#         if parts[0] == path:  # sentinel for absolute paths
#             allparts.insert(0, parts[0])
#             break
#         elif parts[1] == path:  # sentinel for relative paths
#             allparts.insert(0, parts[1])
#             break
#         else:
#             path = parts[0]
#             allparts.insert(0, parts[1])
#
#     return allparts


def get_data_path(abs=True, is_log=False):
    """get data folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'data'
    if is_log:
        folder_name = 'log'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_instance_path(abs=True):
    """get data folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'instance'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_error_trace_path(abs=True):
    """get import folder path

    Returns:
        [type] -- [description]
    """
    folder_name = ['error', 'trace']
    return resource_path(*folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_error_cast_path(abs=True):
    """get error cast folder path

    Returns:
        [type] -- [description]
    """
    folder_name = ['error', 'cast']
    return resource_path(*folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_error_duplicate_path(abs=True):
    """get duplicate folder path

    Returns:
        [type] -- [description]
    """
    folder_name = ['error', 'duplicate']
    return resource_path(*folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_error_import_path(abs=True):
    """get import folder path

    Returns:
        [type] -- [description]
    """
    folder_name = ['error', 'import']
    return resource_path(*folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_about_md_file():
    """
    get about markdown file path
    """
    folder_name = 'about'
    file_name = 'Endroll.md'
    return resource_path(folder_name, file_name, level=AbsPath.SHOW)


def get_terms_of_use_md_file(current_locale):
    """
    get about markdown file path
    """
    folder_name = 'about'
    file_name = 'terms_of_use_jp.md' if current_locale.language == 'ja' else 'terms_of_use_en.md'
    return resource_path(folder_name, file_name, level=AbsPath.SHOW)


def get_wrapr_path():
    """get wrap r folder path

    Returns:
        [type] -- [description]
    """
    folder_names = ['ap', 'script', 'r_scripts', 'wrapr']
    return resource_path(*folder_names, level=AbsPath.SHOW)


def get_temp_path():
    """get temporaty folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'temp'
    data_folder = get_data_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)


def get_cache_path():
    """get cache folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'cache'
    data_folder = get_data_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)


def get_export_path():
    """get cache folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'export'
    data_folder = get_data_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)


def get_view_path():
    """get view/image folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'view'
    data_folder = get_data_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)


def get_etl_path(*sub_paths):
    """get etl output folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'etl'
    data_folder = get_data_path()

    return resource_path(data_folder, folder_name, *sub_paths, level=AbsPath.SHOW)


def get_backup_data_path():
    folder_name = 'backup_data'
    data_folder = get_data_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)


def get_backup_data_folder(process_id):
    folder = get_backup_data_path()
    if not check_exist(folder):
        os.makedirs(folder)
    return os.path.join(folder, str(process_id))


# def df_chunks(df, size):
#     """Yield n-sized chunks from dataframe."""
#     if df.columns.size == 0:
#         return df
#
#     for i in range(0, df.shape[0], size):
#         yield df.iloc[i: i + size]


def chunk_two_list(lst1, lst2, size):
    """Yield n-sized chunks from lst."""
    for i in range(0, len(lst1), size):
        yield lst1[i : i + size], lst2[i : i + size]


def chunks(lst, size):
    """Yield n-sized chunks from lst."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


# def chunks_dic(data, size):
#     it = iter(data)
#     for i in range(0, len(data), size):
#         yield {k: data[k] for k in islice(it, size)}


def get_base_dir(path, is_file=True):
    dir_name = os.path.dirname(path) if is_file else path
    return os.path.basename(dir_name)


def make_dir(dir_path):
    os.makedirs(dir_path, exist_ok=True)
    return True


def get_basename(path):
    return os.path.basename(path)


def strip_all_quote(instr):
    return str(instr).strip("'").strip('"')


def get_csv_delimiter(csv_delimiter):
    """
    return tab , comma depend on input data
    :param csv_delimiter:
    :return:
    """
    if csv_delimiter is None:
        return CsvDelimiter.CSV.value

    if isinstance(csv_delimiter, CsvDelimiter):
        return csv_delimiter.value

    return CsvDelimiter[csv_delimiter].value


def sql_regexp(expr, item):
    reg = re.compile(expr, re.I)
    return reg.search(str(item)) is not None


def set_sqlite_params(conn):
    cursor = conn.cursor()
    cursor.execute('PRAGMA journal_mode=WAL')
    cursor.execute('PRAGMA synchronous=NORMAL')
    cursor.execute('PRAGMA cache_size=10000')
    cursor.execute('pragma mmap_size = 30000000000')
    cursor.execute('PRAGMA temp_store=MEMORY')
    cursor.close()


# get x_y info for scp and heatmap page
def get_x_y_info(array_formval, dic_param_common):
    scatter_xy_ids = []
    scatter_proc_ids = []
    scatter_xy_names = []

    x_axis = dic_param_common.get(SCP_HMP_X_AXIS)
    y_axis = dic_param_common.get(SCP_HMP_Y_AXIS)

    # if no x_axis or y_axis in payload, no switch XY (may not have this case)
    if not x_axis or not y_axis:
        for proc in array_formval:
            scatter_proc_ids.append(proc.proc_id)
            scatter_xy_ids = scatter_xy_ids + proc.col_ids
            scatter_xy_names = scatter_xy_names + proc.col_names
    else:
        x_proc, x_column_id = map(int, x_axis.split('-'))
        y_proc, y_column_id = map(int, y_axis.split('-'))

        scatter_proc_ids += [x_proc, y_proc]
        scatter_xy_ids += [x_column_id, y_column_id]

        # get x_y name based on proc_id and column_id in dict_array
        def get_name(dict_array, find_proc_id, find_column_id):
            for proc in dict_array:
                if proc.proc_id == find_proc_id:
                    index = proc.col_ids.index(find_column_id)
                    return proc.col_names[index]

        x_name = get_name(array_formval, x_proc, x_column_id)
        y_name = get_name(array_formval, y_proc, y_column_id)

        scatter_xy_names += [x_name, y_name]

    return scatter_xy_ids, scatter_xy_names, scatter_proc_ids


def gen_sql_label(*args):
    return SQL_COL_PREFIX + SQL_COL_PREFIX.join([str(name).strip(SQL_COL_PREFIX) for name in args if name is not None])


def gen_sql_like_value(val, func: FilterFunc, position=None):
    if func is FilterFunc.STARTSWITH:
        return [val + '%']

    if func is FilterFunc.ENDSWITH:
        return ['%' + val]

    if func is FilterFunc.CONTAINS:
        return ['%' + val + '%']

    if func is FilterFunc.SUBSTRING:
        if position is None:
            position = 1
        return ['_' * max(0, (position - 1)) + val + '%']

    if func is FilterFunc.AND_SEARCH:
        conds = set(val.split())
        cond_patterns = list(permutations(conds))  # temp solution, conditions are not so many
        return ['%' + '%'.join(cond_pattern) + '%' for cond_pattern in cond_patterns]

    if func is FilterFunc.OR_SEARCH:
        return ['%' + cond + '%' for cond in val.split()]

    return []


def make_dir_from_file_path(file_path):
    dirname = os.path.dirname(file_path)
    # make dir
    if not os.path.exists(dirname):
        os.makedirs(dirname)

    return dirname


def delete_file(file_path):
    if os.path.exists(file_path):
        os.remove(file_path)


def rename_file(src, des):
    if os.path.exists(src):
        os.rename(src, des)


def check_exist(file_path):
    return os.path.exists(file_path)


def count_file_in_folder(folder_path):
    if not check_exist(folder_path):
        return 0

    return len([name for name in os.listdir(folder_path) if name.endswith('.sqlite3')])


def calc_overflow_boundary(arr):
    if len(arr):
        q1, q3 = np.quantile(arr, [0.25, 0.75], interpolation='midpoint')
        iqr = q3 - q1
        if iqr:
            lower_boundary = q1 - 4.5 * iqr
            upper_boundary = q3 + 4.5 * iqr
            return lower_boundary, upper_boundary
    return None, None


def reformat_dt_str(start_time, dt_format=DATE_FORMAT_QUERY):
    if not start_time:
        return start_time
    dt = parser.parse(start_time)
    return dt.strftime(dt_format)


def as_list(param):
    if type(param) in [tuple, list, set]:
        return list(param)
    else:
        return [param]


def is_empty(v):
    if not v and v != 0:
        return True
    return False


def detect_file_encoding(file):
    encoding = chardet.detect(file).get('encoding')
    if encoding == ENCODING_ASCII:
        encoding = ENCODING_UTF_8

    if not encoding:
        encoding = detect_encoding(file)

    return encoding


def detect_encoding_from_list(data):
    encoding = None
    encodings = [ENCODING_SHIFT_JIS, ENCODING_ASCII, ENCODING_UTF_8_BOM, ENCODING_UTF_8]

    for ecd in encodings:
        try:
            str_data = data.decode(ecd)
            if str_data:
                encoding = ecd
                return encoding
        except Exception:
            continue

    if encoding is None:
        return locale.getpreferredencoding(False)


def detect_encoding(f_name, read_line=200):
    if isinstance(f_name, IOBase):
        return detect_encoding_stream(f_name, read_line)
    if isinstance(f_name, str):
        return detect_encoding_file_name(f_name, read_line)
    return None


@log_execution_time()
def detect_encoding_stream(file_stream, read_line: int = 10000):
    # current stream position
    current_pos = file_stream.tell()

    if read_line:
        data = functools.reduce(
            lambda x, y: x + y,
            (file_stream.readline() for _ in range(read_line)),
        )
    else:
        data = file_stream.read()

    if isinstance(data, str):  # default is string, zip file is byte
        data = data.encode()

    encoding = chardet.detect(data).get('encoding')
    encoding = check_detected_encoding(encoding, data)

    file_stream.seek(current_pos)
    return encoding


@log_execution_time()
def detect_encoding_file_name(f_name, read_line=10000):
    with open_with_zip(f_name, 'rb') as f:
        return detect_encoding_stream(f, read_line)


def check_detected_encoding(encoding, data):
    if encoding:
        try:
            data.decode(encoding)
        except Exception:
            encoding = detect_encoding_from_list(data)
    else:
        encoding = detect_encoding_from_list(data)

    if encoding == ENCODING_ASCII:
        encoding = ENCODING_UTF_8

    return encoding


def replace_str_in_file(file_name, search_str, replace_to_str):
    # get encoding
    encoding = detect_encoding(file_name)
    with open(file_name, encoding=encoding) as f:
        replaced_text = f.read().replace(search_str, replace_to_str)

    with open(file_name, 'w', encoding=encoding) as f_out:
        f_out.write(replaced_text)


def get_file_modify_time(file_path):
    file_time = datetime.utcfromtimestamp(os.path.getmtime(file_path))
    return convert_time(file_time)


def split_path_to_list(file_path):
    folders = os.path.normpath(file_path).split(os.path.sep)
    return folders


def gen_abbr_name(name, len_of_col_name=10):
    suffix = '...'
    short_name = str(name)
    if len(short_name) > len_of_col_name:
        short_name = name[: len_of_col_name - len(suffix)] + suffix

    return short_name


# def remove_inf(series):
#     return series[~series.isin([float('inf'), float('-inf')])]


def read_pickle_file(file):
    with open(file, 'rb') as f:
        pickle_data = pickle.load(f)
    return pickle_data


def write_to_pickle(data, file):
    dir_path = os.path.dirname(file)
    if not check_exist(dir_path):
        make_dir(dir_path)

    with open(file, 'wb') as f:
        pickle.dump(data, f)
    return file


def read_feather_file(file):
    # df = pd.read_feather(file)
    df = feather.read_feather(file)
    return df


def read_parquet_file(file):
    df = parquet.read_parquet(file)
    return df


def write_feather_file(df: DataFrame, file):
    make_dir_from_file_path(file)
    # df.reset_index(drop=True, inplace=True)
    # df.to_feather(file, compression='lz4')
    # Use LZ4 explicitly
    if len(file) > 255:
        file = f'{file[:250]}.{FileExtension.Feather.value}'

    try:
        feather.write_feather(df.reset_index(drop=True), file, compression='lz4')
    except Exception as e:
        print(str(e))
        for col in df.columns:
            if df[col].dtype.name in ('object', 'category'):
                df[col] = np.where(pd.isnull(df[col]), None, df[col].astype(str))
                # df[col] = df[col].astype('category') # error in some cases
        feather.write_feather(df.reset_index(drop=True), file, compression='lz4')

    return file


def write_parquet_file(df: DataFrame, file):
    make_dir_from_file_path(file)
    if len(file) > 255:
        file = f'{file[:250]}.{FileExtension.Feather.value}'

    try:
        parquet.to_parquet(df.reset_index(drop=True), file, compression='gzip')
    except Exception as e:
        print(str(e))
        for col in df.columns:
            if df[col].dtype.name in ('object', 'category'):
                df[col] = np.where(pd.isnull(df[col]), None, df[col].astype(str))
                # df[col] = df[col].astype('category') # error in some cases
        parquet.to_parquet(df.reset_index(drop=True), file, compression='gzip')

    return file


def get_debug_g_dict():
    return g.setdefault(FlaskGKey.DEBUG_SHOW_GRAPH, {})


def set_debug_data(func_name, data):
    if not func_name:
        return

    g_debug = get_debug_g_dict()
    g_debug[func_name] = data

    return True


def get_debug_data(key):
    g_debug = get_debug_g_dict()
    data = g_debug.get(key, None)
    return data


@log_execution_time()
def zero_variance(df: DataFrame):
    is_zero_var = False
    err_cols = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            variance = df[col].replace([np.inf, -np.inf], np.nan).var()
            if pd.isna(variance) or variance == 0:
                is_zero_var = True
                err_cols.append(col)
    return is_zero_var, err_cols


@log_execution_time()
def find_babel_locale(lang):
    if not lang:
        return lang

    lang = str(lang).lower()
    lang = lang.replace('-', '_')
    for _lang in LANGUAGES:
        if lang == _lang.lower():
            return _lang

    return lang


def init_config(target_file, init_file):
    if not check_exist(target_file) and check_exist(init_file):
        shutil.copyfile(init_file, target_file)
    return True


class NoDataFoundException(Exception):
    def __init__(self):
        super().__init__()
        self.code = 999


def get_format_padding(column_format: str):
    if not column_format:
        return None

    format_padding = None
    match_pattern = re.match(ZERO_FILL_PATTERN, column_format) or re.match(ZERO_FILL_PATTERN_2, column_format)
    if match_pattern:
        fill_char, symbol, width = match_pattern.groups()
        format_padding = (fill_char, symbol, int(width))

    return format_padding


def bundle_assets(_app):
    """
    bundle assets when application be started at the first time
    for commnon assets (all page), and single page
    """
    env = os.environ.get(ANALYSIS_INTERFACE_ENV)
    # bundle js files
    assets_path = os.path.join('ap', 'common', 'assets', 'assets.json')
    with open(assets_path, 'r') as f:
        _assets = json.load(f)

    assets = Environment(_app)
    if env != AppEnv.PRODUCTION.value:
        assets.debug = True

    for page in _assets:
        js_assets = _assets[page].get('js') or []
        css_assets = _assets[page].get('css') or []
        js_asset_name = f'js_{page}'
        css_asset_name = f'css_{page}'
        if env != AppEnv.PRODUCTION.value:
            assets.register(js_asset_name, *js_assets)
            assets.register(css_asset_name, *css_assets)
        else:
            js_bundle = Bundle(*js_assets, output=f'common/js/{page}.packed.js')
            css_bundle = Bundle(*css_assets, output=f'common/css/{page}.packed.css')
            assets.register(js_asset_name, js_bundle)
            assets.register(css_asset_name, css_bundle)
            # build assets
            js_bundle.build()
            css_bundle.build()


def open_with_zip(file_name, mode, encoding=None) -> Union[IO[bytes], TextIO]:
    """
    :param file_name:
    :param mode:
    :param encoding: not for zip file
    :return:
    """
    if str(file_name).endswith('.zip'):
        zip_mode = 'w' if 'w' in mode else 'r'
        zf = zipfile.ZipFile(file_name)

        assert len(zf.namelist()) == 1, "We currently don't support multiple zip file"
        return zf.open(zf.namelist()[0], zip_mode)
    else:
        return open(file_name, mode, encoding=encoding)


def get_hostname():
    hostname = socket.gethostname()
    return hostname


@log_execution_time()
def get_ip_address():
    hostname = get_hostname()
    ip_addr = socket.gethostbyname(hostname)

    return ip_addr


def check_client_browser(client_request):
    is_valid_browser = False
    is_valid_version = True
    safari_support_version = str(SAFARI_SUPPORT_VER).split('.')  # >= ver15.4

    request_env = client_request.headers.environ
    http_ch_ua = request_env.get('HTTP_SEC_CH_UA') if request_env else None
    http_user_agent = request_env.get('HTTP_USER_AGENT') if request_env else client_request.user_agent

    # Windows
    if http_ch_ua:
        if 'Google Chrome' in http_ch_ua or 'Microsoft Edge' in http_ch_ua:
            is_valid_browser = True
            is_valid_version = True

        return is_valid_browser, is_valid_version

    # iOS
    if http_user_agent:
        if 'Edg' in http_user_agent:
            is_valid_browser = True

        if 'Safari' in http_user_agent:
            is_valid_browser = True
            user_agents = http_user_agent.split('Version/')
            if len(user_agents) == 1:
                # chrome in ios
                return is_valid_browser, is_valid_version

            [safari_version, _] = user_agents[1].split(' Safari/')
            if safari_version:
                versions = safari_version.split('.')
                v1 = versions[0]
                v2 = 0
                if len(versions) > 1:
                    v2 = versions[1]

                is_valid_version = (int(v1) > int(safari_support_version[0])) or (
                    int(v1) == int(safari_support_version[0]) and int(v2) >= int(safari_support_version[1])
                )

    return is_valid_browser, is_valid_version


def gen_transaction_table_name(proc_id: int):
    return f't_process_{proc_id}'


def gen_data_count_table_name(proc_id: int):
    return f't_data_finder_{proc_id}'


def gen_import_history_table_name(proc_id: int):
    return f't_import_history_{proc_id}'


def gen_bridge_column_name(id, name):
    name = to_romaji(name)
    return f"_{id}_{name.replace('-', '_').lower()}"[:50]


def gen_end_proc_start_end_time(start_tm, end_tm, return_string: bool = True, buffer_days=14):
    end_proc_start_tm = convert_time(
        add_days(convert_time(start_tm, return_string=False), -buffer_days),
        return_string=return_string,
    )
    end_proc_end_tm = convert_time(
        add_days(convert_time(end_tm, return_string=False), buffer_days),
        return_string=return_string,
    )
    return end_proc_start_tm, end_proc_end_tm


def gen_sqlite3_file_name(proc_id=None):
    from ap import dic_config

    file_name = f't_process_{proc_id}.sqlite3' if proc_id else 'universal.sqlite3'
    return os.path.join(dic_config[UNIVERSAL_DB_FILE], file_name)


def init_process_queue():
    manager = Manager()
    process_queue = manager.dict()
    # process_queue[LOCK] = manager.Lock()
    # process_queue[MAPPING_DATA_LOCK] = manager.Lock()
    for notify_type in ListenNotifyType.__members__:
        process_queue[notify_type] = manager.dict()

    write_to_pickle(process_queue, get_multiprocess_queue_file())
    return process_queue


def get_process_queue():
    from ap import dic_config

    process_queue = dic_config.get(PROCESS_QUEUE)
    if process_queue is None:
        process_queue_file = get_multiprocess_queue_file()
        if os.path.exists(process_queue_file):
            try:
                process_queue = read_pickle_file(get_multiprocess_queue_file())
            except Exception as e:
                # in case of old file, renew file
                logger.warning(e)
                process_queue = init_process_queue()
        else:
            process_queue = init_process_queue()

    return process_queue


def get_multiprocess_queue_file():
    return os.path.join(get_data_path(), 'process_queue.pickle')


def remove_non_ascii_chars(string, convert_irregular_chars=True):
    # special case for vietnamese: đ letter
    normalized_input = re.sub(r'[đĐ]', 'd', string)

    # pascal case
    normalized_input = normalized_input.title()

    # `[μµ]` in `English Name` should be replaced in to `u`.
    # convert u before kakasi applied to keep u instead of M
    normalized_input = re.sub(r'[μµ]', 'uu', normalized_input)

    # normalize with NFKD
    normalized_input = normalize_str(
        normalized_input,
        convert_irregular_chars=convert_irregular_chars,
        normalize_form=NORMALIZE_FORM_NFKD,
    )

    normalized_input = replace_special_symbols(normalized_input)

    normalized_string = normalized_input.encode(ENCODING_ASCII, 'ignore').decode()
    return normalized_string


def get_dummy_data_path():
    """Get dummy data folder path

    Returns:
        [type] -- [description]
    """
    folder_names = ['data_files']
    return resource_path(*folder_names, level=AbsPath.SHOW)


def sort_processes_by_parent_children_relationship(processes):
    """
    Sort and group processes based on order and parent-children relationship
    same group sorting:
        - parent-children should be in the same group
        - parent should be the smallest
        - children should be sorted as declared in `different group sorting`
    different group sorting
        - order = None -> large
        - same order: sort by id
    @param processes:
    @return:
    """
    procs_map = {p.id: p for p in processes}

    def sort_key(proc) -> tuple[int, int]:
        if proc.order is None:
            return sys.maxsize, proc.id
        return proc.order, proc.id

    def cmp_key(lhs: tuple[int, int], rhs: tuple[int, int]) -> int:
        if lhs[0] == rhs[0]:
            return lhs[1] - rhs[1]
        return lhs[0] - rhs[0]

    def cmp_proc(lhs_proc, rhs_proc) -> int:
        if lhs_proc.id == rhs_proc.parent_id:
            return -1
        if rhs_proc.id == lhs_proc.parent_id:
            return 1

        lhs_key = sort_key(lhs_proc)
        rhs_key = sort_key(rhs_proc)

        is_same_group = (
            lhs_proc.parent_id is not None
            and rhs_proc.parent_id is not None
            and lhs_proc.parent_id == rhs_proc.parent_id
        )
        # sort by parent's key if they are not in the same group
        if not is_same_group and lhs_proc.parent_id is not None:
            lhs_key = sort_key(procs_map[lhs_proc.parent_id])
        if not is_same_group and rhs_proc.parent_id is not None:
            rhs_key = sort_key(procs_map[rhs_proc.parent_id])

        return cmp_key(lhs_key, rhs_key)

    return sorted(processes, key=functools.cmp_to_key(cmp_proc))


def get_type_all_columns(db_instance, table_name: str):
    sql = f'PRAGMA table_info({table_name})'
    cols, rows = db_instance.run_sql(sql)
    df = pd.DataFrame(rows, columns=cols)
    names = df['name'].tolist()
    types = df['type'].tolist()
    dict_name_type = dict(zip(names, types))
    return dict_name_type


def get_month_diff(str_min_datetime, str_max_datetime):
    min_datetime = parser.parse(str_min_datetime)
    max_datetime = parser.parse(str_max_datetime)
    diff = relativedelta(max_datetime, min_datetime)
    return diff.years * 12 + diff.months


def is_boolean(data: Series):
    return (data >= 0) & (data <= 1)


def is_int_64(data: Series):
    return (data >= INT64_MIN) & (data <= INT64_MAX)


def convert_numeric_by_type(data: Series, provided_data_type):
    s = data[data.notnull()]
    if provided_data_type == DataType.BOOLEAN.name:
        s = s[((np.mod(s, 1) == 0) & is_boolean(s))]
        data = data.where(data.isin(s), np.nan)
    elif provided_data_type in DataType.INTEGER.name:
        s = s[((np.mod(s, 1) == 0) & is_int_64(s))]
        data = data.where(data.isin(s), np.nan)
    return data


def find_duplicate_values(key_value_dict: dict[Any, str]) -> dict[str, Any]:
    """Find duplicate values in dictionary

    Args:
        key_value_dict: dictionary with duplicate values

    Returns:
        a dictionary with

        - key: duplicate value of input dictionary

        - value: list of keys that contain duplicate values
    """

    # find duplicate values
    values = list(key_value_dict.values())
    duplicate_values = [value for value in values if values.count(value) > 1]

    # find keys belongs to duplicate values
    duplicate_value_item = {}
    for key, value in key_value_dict.items():
        if value in duplicate_values:
            duplicate_value_item[value] = (duplicate_value_item.get(value) or []) + [key]

    # sort keys by alphabet
    for key in duplicate_value_item.keys():
        duplicate_value_item[key].sort()

    return duplicate_value_item


def add_suffix_for_same_column_name(key_value_dict: dict[Any, str]):
    """Add suffix for duplicate names in dictionary

    Args:
        key_value_dict: dictionary with duplicate names

    Returns:
        dictionary with unique names (added suffix for duplicate names)
    """

    output = copy.deepcopy(key_value_dict)
    duplicate_value_item = find_duplicate_values(key_value_dict)
    for duplicate_value, keys in duplicate_value_item.items():
        suffix_index = 1
        for key in keys[1:]:  # skip first element in list
            output[key] = f'{output[key]}_{suffix_index:02}'
            suffix_index += 1

    return output


def get_preview_data_file_folder(data_source_id):
    folder = get_preview_data_path()
    if not check_exist(folder):
        os.makedirs(folder)

    return os.path.join(folder, str(data_source_id))


def get_preview_data_path():
    folder_name = 'preview_data'
    data_folder = get_instance_path()
    return resource_path(data_folder, folder_name, level=AbsPath.SHOW)
