import copy
import csv
import fnmatch
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
from io import IOBase
from itertools import chain, islice, permutations
from pathlib import Path
from typing import IO, List, Optional, TextIO, Union

import chardet
import numpy as np
import pandas as pd
import pyper

# from charset_normalizer import detect
from dateutil import parser, tz
from dateutil.relativedelta import relativedelta
from flask import g
from flask_assets import Bundle, Environment
from pandas import DataFrame

from ap.common.constants import (
    ENCODING_ASCII,
    ENCODING_SHIFT_JIS,
    ENCODING_UTF_8,
    ENCODING_UTF_8_BOM,
    LANGUAGES,
    R_PORTABLE,
    SAFARI_SUPPORT_VER,
    SQL_COL_PREFIX,
    YAML_AUTO_INCREMENT_COL,
    AbsPath,
    AppEnv,
    CsvDelimiter,
    DataType,
    FilterFunc,
    FlaskGKey,
)
from ap.common.logger import log_execution_time, logger
from ap.common.services.normalization import unicode_normalize_nfkc

INCLUDES = ['*.csv', '*.tsv']
TXT_FILE_TYPE = '.txt'
DATE_FORMAT_STR_SQLITE = '%Y-%m-%dT%H:%M:%S.%fZ'
DATE_FORMAT_STR = '%Y-%m-%dT%H:%M:%S.%fZ'
DATE_FORMAT_QUERY = '%Y-%m-%dT%H:%M:%S.%f'
DATE_FORMAT_STR_CSV = '%Y-%m-%d %H:%M:%S.%f'
DATE_FORMAT_STR_CSV_FOLDER = '%Y%m%d'
DATE_FORMAT_STR_FACTORY_DB = '%Y-%m-%d %H:%M:%S.%f'
DATE_FORMAT_STR_ONLY_DIGIT = '%Y%m%d%H%M%S.%f'
DATE_FORMAT = '%Y-%m-%d'
TIME_FORMAT = '%H:%M'
RL_DATETIME_FORMAT = '%Y-%m-%dT%H:%M'
DATE_FORMAT_SIMPLE = '%Y-%m-%d %H:%M:%S'
DATE_FORMAT_FOR_ONE_HOUR = '%Y-%m-%d %H:00:00'
API_DATETIME_FORMAT = '%Y-%m-%dT%H:%MZ'
# for data count
TERM_FORMAT = {'year': '%Y', 'month': '%Y-%m', 'week': DATE_FORMAT}
FREQ_FOR_RANGE = {'year': 'M', 'month': 'D', 'week': 'H'}


def get_current_timestamp(format_str=DATE_FORMAT_STR):
    return datetime.utcnow().strftime(format_str)


def parse_int_value(value):
    """
    Parse integral value from text or numeric data
    :param value:
    :return: parsed integral value.
    """
    if type(value) is str:
        value = unicode_normalize_nfkc(value)
        if value.isdigit():
            return int(value)
    elif type(value) is int:
        return value

    return None


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


def get_columns_selected(histview_cfg, proc_cfg):
    date_col = ''
    result = serial_cols = alias_names = column_names = master_names = operators = coefs = []
    check_columns = proc_cfg.get('checked-columns', {})

    # Get date-column
    if histview_cfg.get('date-column'):
        date_col = re.sub(r'(["*\/\'\s]+)', '', re.split(' as ', histview_cfg['date-column'])[0])
        # date_col = re.sub(r'(["*\/\'\s]+)', '', re.split(r'[-+*/]\d+', hvc['date-column'])[0])

    # Get serial column
    if histview_cfg.get('serial-column'):
        serial_cols = list(
            map(
                lambda x: re.sub(r'(["*\/\'\s]+)', '', re.split(' as ', x)[0]),
                histview_cfg['serial-column'],
            )
        )

    # Get serial column
    auto_increment_col = histview_cfg.get(YAML_AUTO_INCREMENT_COL)

    # Get params from checked-columns
    if check_columns:
        alias_names = check_columns.get('alias-names', []) or []
        column_names = check_columns.get('column-names', []) or []
        master_names = check_columns.get('master-names', []) or []
        operators = check_columns.get('operators', []) or []
        coefs = check_columns.get('coefs', []) or []
        data_types = check_columns.get('data-types', []) or []

    # Merge params to result dict
    for key, value in enumerate(column_names):
        column_name = re.sub(r'(["*\/\'\s]+)', '', value)
        alias = alias_names[key]
        master_name = master_names[key]
        operator = operators[key]
        coef = coefs[key]
        data_type = data_types[key]

        is_datetime = True if (value == date_col) else False
        is_serial = True if (value in serial_cols) else False
        is_auto_increment = value == auto_increment_col

        result.append(
            {
                'master_name': master_name,
                'column_name': column_name,
                'alias': alias,
                'operator': operator,
                'coef': coef,
                'is_datetime': is_datetime,
                'is_serial': is_serial,
                'is_auto_increment': is_auto_increment,
                'data_type': data_type,
            }
        )
    return result


def _excludes(root, folders):
    fd = folders[:]
    ex = []
    try:
        for folder in fd:
            if datetime.strptime(folder, '%Y%m%d'):
                ex.append(folder)
    except Exception:
        pass
    ex.sort()

    if len(fd) > 0:
        fd.remove(ex[-1])
    return map(lambda d: os.path.join(root, d), fd)


def _filter(paths, excludes):
    matches = []
    for path in paths:
        append = None

        for include in INCLUDES:
            if os.path.isdir(path):
                append = True
                break

            if fnmatch.fnmatch(path, include):
                append = True
                break

        for exclude in excludes:
            if os.path.isdir(path) and path == exclude:
                append = False
                break

            if fnmatch.fnmatch(path, exclude):
                append = False
                break

        if append:
            matches.append(path)

    return matches


def get_latest_file(root_name):
    try:
        latest_files = get_files(root_name, depth_from=1, depth_to=100, extension=['csv', 'tsv'])
        latest_files.sort()
        return latest_files[-1].replace(os.sep, '/')
    except Exception:
        return ''


def get_sorted_files(root_name, is_allow_zip: bool = True) -> List[str]:
    try:
        extension = ['csv', 'tsv', 'zip'] if is_allow_zip else ['csv', 'tsv']
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
        extension = ['csv', 'tsv', 'zip'] if is_allow_zip else ['csv', 'tsv']
        files = get_files(root_name, depth_from=1, depth_to=100, extension=extension)
        largest_files = get_largest_files_in_list(files)
        return largest_files
    except FileNotFoundError:
        return []


def get_sorted_files_by_size_and_time(root_name: str, is_allow_zip: bool = True) -> List[str]:
    try:
        extension = ['csv', 'tsv', 'zip'] if is_allow_zip else ['csv', 'tsv']
        files = get_files(root_name, depth_from=1, depth_to=100, extension=extension)
        largest_files = get_sorted_files_in_list(files)
        return largest_files
    except FileNotFoundError:
        return []


def get_latest_files(root_name: Union[Path, str]) -> List[str]:
    try:
        files = get_files(
            str(root_name), depth_from=1, depth_to=100, extension=['csv', 'tsv', 'zip']
        )
        files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        files = [f.replace(os.sep, '/') for f in files]
        return files
    except FileNotFoundError:
        return []


@log_execution_time()
def get_maximum_file_in_zip(file: str) -> Optional[str]:
    if not is_normal_zip(file):
        return file
    with zipfile.ZipFile(file) as zf:
        largest_file = None
        for zfile in zf.filelist:
            if largest_file is None:
                largest_file = zfile
            else:
                largest_file = zfile if zfile.file_size > largest_file.file_size else largest_file
        if largest_file is None:
            return None
        return largest_file.filename


def start_of_minute(start_date, start_tm, delimeter='T'):
    if start_date is None or start_tm is None:
        return None
    if start_tm and len(start_tm) == 5:
        start_tm = start_tm + ':00'

    return '{}{}{}'.format(start_date.replace('/', '-'), delimeter, start_tm)


def end_of_minute(start_date, start_tm, delimeter='T'):
    if start_date is None or start_tm is None:
        return None
    if start_tm and len(start_tm) == 5:
        start_tm = start_tm + ':00'

    # start_tm = start_tm[:8] + '.999999'
    start_tm = start_tm[:8]

    return '{}{}{}'.format(start_date.replace('/', '-'), delimeter, start_tm)


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
    time=None,
    format_str=DATE_FORMAT_STR,
    return_string=True,
    only_milisecond=False,
    remove_ms=False,
):
    if not time:
        time = datetime.utcnow()
    elif isinstance(time, str):
        time = parser.parse(time)

    if return_string:
        time = time.strftime(format_str)
        if only_milisecond:
            time = time[:-3]
        elif remove_ms:
            time = time[:-8]
    return time


def fast_convert_time(time, format_str=DATE_FORMAT_STR):
    return parser.parse(time).strftime(format_str)


def add_miliseconds(time=None, milis=0):
    """add miliseconds

    Keyword Arguments:
        time {[type]} -- [description] (default: {datetime.now()})
        days {int} -- [description] (default: {0})

    Returns:
        [type] -- [description]
    """
    if not time:
        time = datetime.utcnow()

    return time + timedelta(milliseconds=milis)



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
    for root, dirs, files in os.walk(directory):
        # limit depth of recursion
        current_depth = root.count(os.path.sep) + 1
        # assume that directory depth is 1, sub folders are 2, 3, ...
        # default is to just read children sub folder, depth from 1 to 2
        if (current_depth < root_depth + depth_from) or (current_depth > root_depth + depth_to):
            continue

        # list files with extension
        for file in files:
            # Check file is modified in [in_modified_days] days or not
            if any([file.endswith(ext) for ext in extension]):
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


def guess_data_types(instr: str):
    """guess data type of all kind of databases to 4 type (INTEGER,REAL,DATETIME,TEXT)

    Arguments:
        instr {str} -- [description]

    Returns:
        [type] -- [description]
    """
    dates = ['date', 'time']
    ints = ['int', 'bit', r'num.*\([^,]+$', r'num.*\(.*,\ *0']
    reals = ['num', 'real', 'float', 'double', 'long', 'dec', 'money']

    instr = instr.lower()
    for data_type in dates:
        if re.search(data_type, instr):
            return DataType.DATETIME

    for data_type in ints:
        if re.search(data_type, instr):
            return DataType.INTEGER

    for data_type in reals:
        if re.search(data_type, instr):
            return DataType.REAL
    return DataType.TEXT


def resource_path(*relative_path, level=None):
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
    elif level is AbsPath.HIDE:
        basedir = hide_path
    else:
        if getattr(sys, 'frozen', False):
            basedir = hide_path
        else:
            basedir = show_path

    return os.path.join(basedir, *relative_path)


class RUtils:
    def __init__(self, package, *args, **kwargs):
        # r instance
        r_portable_env = os.environ.get('R-PORTABLE')
        if r_portable_env:
            self.r_exe = os.path.join(r_portable_env, 'bin', 'R.exe')
            self.r_library = os.path.join(r_portable_env, 'library')
        else:
            self.r_exe = resource_path(R_PORTABLE, 'bin', 'R.exe', level=AbsPath.SHOW)
            self.r_library = resource_path(R_PORTABLE, 'library', level=AbsPath.SHOW)

        # specify R-Portable execution
        self.r = pyper.R(RCMD=self.r_exe, *args, **kwargs)
        logger.info(self.r('Sys.getenv()'))

        # specify R-Portable library
        self.r(f'.libPaths(c(""))')
        self.r(f'.libPaths(c("{self.r_library}"))')
        logger.info(self.r('.libPaths()'))

        # R package folder
        self.source = resource_path('ap', 'script', 'r_scripts', package)
        self.r(f'source("{self.source}")')

    def __call__(self, func, *args, _number_of_recheck_r_output=1000, **kwargs) -> object:
        """call funtion with parameters

        Arguments:
            func {[string]} -- R function name

        Keyword Arguments:
            _number_of_recheck_r_output {int} -- [R function may take time to return output, Python must check many
            time to get final output] (default: {100})

        Returns:
            [type] -- [R output]
        """
        args_prefix = 'args__'
        kwargs_prefix = 'kwargs__'
        output_var = 'output__'

        r_args = []
        for i, val in enumerate(args):
            para = f'{args_prefix}{i}'
            self.r.assign(para, val)
            r_args.append(para)

        r_kwargs = []
        for i, (key, val) in enumerate(kwargs.items()):
            para = f'{kwargs_prefix}{i}'
            self.r.assign(para, val)
            r_kwargs.append(f'{key}={para}')

        final_args = ','.join(chain(r_args, r_kwargs))

        self.r(f'{output_var} = {func}({final_args})')

        # wait for R return an output
        output = None
        while (not output) and _number_of_recheck_r_output:
            output = self.r.get(output_var)
            _number_of_recheck_r_output -= 1

        print(_number_of_recheck_r_output, output)
        return output


def get_file_size(f_name):
    """get file size

    Arguments:
        f_name {[type]} -- [description]

    Returns:
        [type] -- [description]
    """
    return os.path.getsize(f_name)


def write_csv_file(data, file_path, headers, delimiter='\t'):
    """save csv, tsv file

    Arguments:
        data {[type]} -- [description]
        file_path {[type]} -- [description]
        headers {[type]} -- [description]

    Keyword Arguments:
        delimiter {str} -- [description] (default: {'\t'})
    """
    make_dir_from_file_path(file_path)

    with open(file_path, 'w', newline='') as f:
        writer = csv.writer(f, delimiter=delimiter)
        for row in chain([headers], data):
            writer.writerow(row)


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


def path_split_all(path):
    """split all part of a path

    Arguments:
        path {[string]} -- [full path]
    """
    allparts = []
    while True:
        parts = os.path.split(path)
        if parts[0] == path:  # sentinel for absolute paths
            allparts.insert(0, parts[0])
            break
        elif parts[1] == path:  # sentinel for relative paths
            allparts.insert(0, parts[1])
            break
        else:
            path = parts[0]
            allparts.insert(0, parts[1])

    return allparts


def get_data_path(abs=True, is_log=False):
    """get data folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'data'
    if is_log:
        folder_name = 'log'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


# TODO : delete
def get_import_error_path(abs=True):
    """get import folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'error'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_error_trace_path(abs=True):
    """get import folder path

    Returns:
        [type] -- [description]
    """
    folder_name = ['error', 'trace']
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
    if current_locale.language == 'ja':
        file_name = 'terms_of_use_jp.md'
    else:
        file_name = 'terms_of_use_en.md'
    return resource_path(folder_name, file_name, level=AbsPath.SHOW)


def get_wrapr_path():
    """get wrap r folder path

    Returns:
        [type] -- [description]
    """
    folder_names = ['ap', 'script', 'r_scripts', 'wrapr']
    return resource_path(*folder_names, level=AbsPath.HIDE)


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


def df_chunks(df, size):
    """Yield n-sized chunks from dataframe."""
    if df.columns.size == 0:
        return df

    for i in range(0, df.shape[0], size):
        yield df.iloc[i : i + size]


def chunk_two_list(lst1, lst2, size):
    """Yield n-sized chunks from lst."""
    for i in range(0, len(lst1), size):
        yield lst1[i : i + size], lst2[i : i + size]


def chunks(lst, size):
    """Yield n-sized chunks from lst."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def chunks_dic(data, size):
    it = iter(data)
    for i in range(0, len(data), size):
        yield {k: data[k] for k in islice(it, size)}


def get_base_dir(path, is_file=True):
    dir_name = os.path.dirname(path) if is_file else path
    return os.path.basename(dir_name)


def make_dir(dir_path):
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

    return True


def get_basename(path):
    return os.path.basename(path)


def get_datetime_without_timezone(time):
    """remove timezone string from time

    Args:
        time ([type]): [description]
    """
    regex_str = r'(\d{4}[-\/]\d{2}[-\/]\d{2}\s\d{2}:\d{2}:\d{2}(.\d{1,6})?)'
    res = re.search(regex_str, time)
    if res:
        return convert_time(res.group())

    return None


def strip_quote_csv(instr):
    return str(instr).strip("'").strip()


def strip_all_quote(instr):
    return str(instr).strip("'").strip('"')


def strip_space(instr):
    return str(instr).strip()


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
    cursor.execute(f'PRAGMA journal_mode=WAL')
    cursor.execute('PRAGMA synchronous=NORMAL')
    cursor.execute('PRAGMA cache_size=10000')
    cursor.execute('pragma mmap_size = 30000000000')
    cursor.execute('PRAGMA temp_store=MEMORY')
    cursor.close()


def gen_sql_label(*args):
    return SQL_COL_PREFIX + SQL_COL_PREFIX.join(
        [str(name).strip(SQL_COL_PREFIX) for name in args if name is not None]
    )


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


def gen_python_regex(val, func: FilterFunc, position=None):
    if func is FilterFunc.MATCHES:
        return '^' + val + '$'

    if func is FilterFunc.STARTSWITH:
        return '^' + val

    if func is FilterFunc.ENDSWITH:
        return val + '$'

    if func is FilterFunc.CONTAINS:
        return '.*' + val + '.*'

    if func is FilterFunc.SUBSTRING:
        if position is None:
            position = 1
        return '^' + '.' * max(0, (position - 1)) + val
    return val


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


def any_not_none_in_dict(dict_input):
    """
    check any not None in a list of dictionary
    :param dict_input:  [{'a': None, 'b': None}, {'a': 1, 'b': 2}]
    :return: boolean
    """
    return True in [any(k is not None for k in v.values()) for _, v in enumerate(dict_input)]


def calc_overflow_boundary(arr, remove_non_real=False):
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
        except:
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
def detect_encoding_stream(file_stream, read_line=10000):
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

    file_stream.seek(0)
    return encoding


@log_execution_time()
def detect_encoding_file_name(f_name, read_line=10000):
    with open_with_zip(f_name, 'rb') as f:
        return detect_encoding_stream(f, read_line)


def check_detected_encoding(encoding, data):
    if encoding:
        try:
            data.decode(encoding)
        except:
            encoding = detect_encoding_from_list(data)
    else:
        encoding = detect_encoding_from_list(data)

    if encoding == ENCODING_ASCII:
        encoding = ENCODING_UTF_8

    return encoding


def is_eof(f):
    cur = f.tell()  # save current position
    f.seek(0, os.SEEK_END)
    end = f.tell()  # find the size of file
    f.seek(cur, os.SEEK_SET)
    return cur == end


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
    with open(file, 'wb') as f:
        pickle.dump(data, f)
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
        if df[col].dtype != 'object':
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


def bundle_assets(_app):
    """
    bundle assets when application be started at the first time
    for commnon assets (all page), and single page
    """
    env = os.environ.get('ANALYSIS_INTERFACE_ENV')
    # bundle js files
    assets_path = os.path.join('ap', 'common', 'assets', 'assets.json')
    with open(assets_path, 'r') as f:
        _assets = json.load(f)

    assets = Environment(_app)
    if env != AppEnv.PRODUCTION.value:
        assets.debug = True

    for page in _assets.keys():
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
    http_user_agent = (
        request_env.get('HTTP_USER_AGENT') if request_env else client_request.user_agent
    )

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
                    int(v1) == int(safari_support_version[0])
                    and int(v2) >= int(safari_support_version[1])
                )

    return is_valid_browser, is_valid_version


class DictToClass:
    # TODO: clear updated_at , created_at to reduce memory
    def __init__(self, **entries):
        self.__dict__.update(entries)
        for key, value in self.__dict__.items():
            if isinstance(value, (list, tuple)):
                self.__dict__[key] = [
                    DictToClass(**val) if isinstance(val, dict) else val for val in value
                ]
            elif isinstance(value, dict):
                self.__dict__[key] = DictToClass(**value)
