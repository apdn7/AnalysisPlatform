from __future__ import annotations

import os
import shutil
import sys
import zipfile
from pathlib import Path
from typing import IO, List, TextIO, Union

from ap.common.constants import (
    CONFIG_DB,
    PREVIEW_DATA_FOLDER,
    SCHEDULER_DB,
    TRANSACTION_FOLDER,
    UNIVERSAL_DB_FILE,
    AbsPath,
    CSVExtTypes,
)
from ap.common.logger import log_execution_time


def check_exist(file_path):
    return os.path.exists(file_path)


def get_data_path(abs=True, is_log=False):
    """get data folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'data'
    if is_log:
        folder_name = 'log'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


def get_log_path(abs=True):
    """get data folder path

    Returns:
        [type] -- [description]
    """
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


def get_cookie_policy_md_file(current_locale):
    """
    get about markdown file path
    """
    folder_name = 'about'
    file_name = 'cookie_policy_jp.md' if current_locale.language == 'ja' else 'cookie_policy_en.md'
    return resource_path(folder_name, file_name, level=AbsPath.SHOW)


def get_user_scripts_path():
    folder_names = ['ap', 'script', 'user_scripts']
    return resource_path(*folder_names, level=AbsPath.SHOW)


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
    temp_dir = resource_path(data_folder, folder_name, level=AbsPath.SHOW)

    # check if temp dir exists, if not, create it
    os.makedirs(temp_dir, exist_ok=True)

    return temp_dir


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


def get_preview_data_file_folder(data_source_id):
    folder = get_preview_data_path()
    if not check_exist(folder):
        os.makedirs(folder)

    return os.path.join(folder, str(data_source_id))


def get_preview_data_path():
    data_folder = get_instance_path()
    return resource_path(data_folder, PREVIEW_DATA_FOLDER, level=AbsPath.SHOW)


def get_transaction_folder_path():
    return resource_path(get_instance_path(), TRANSACTION_FOLDER, level=AbsPath.SHOW)


def get_config_db_path():
    return resource_path(get_instance_path(), CONFIG_DB, level=AbsPath.SHOW)


def get_scheduler_db_path():
    return resource_path(get_instance_path(), SCHEDULER_DB, level=AbsPath.SHOW)


def get_export_setting_path():
    """get cache folder path

    Returns:
        [type] -- [description]
    """
    folder_name = 'export_setting'
    return resource_path(folder_name, level=AbsPath.SHOW) if abs else folder_name


def gen_sqlite3_file_name(proc_id=None):
    from ap import dic_config

    file_name = f't_process_{proc_id}.sqlite3' if proc_id else 'universal.sqlite3'
    return os.path.join(dic_config[UNIVERSAL_DB_FILE], file_name)


def get_dummy_data_path():
    """Get dummy data folder path

    Returns:
        [type] -- [description]
    """
    folder_names = ['data_files']
    return resource_path(*folder_names, level=AbsPath.SHOW)


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
        raise FileNotFoundError('File not found')


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


def get_base_dir(path, is_file=True):
    dir_name = os.path.dirname(path) if is_file else path
    return os.path.basename(dir_name)


def make_dir(dir_path):
    os.makedirs(dir_path, exist_ok=True)
    return True


def get_basename(path):
    return os.path.basename(path)


def make_dir_from_file_path(file_path):
    dirname = os.path.dirname(file_path)
    # make dir
    if not os.path.exists(dirname):
        os.makedirs(dirname)

    return dirname


def delete_file(file_path):
    if os.path.exists(file_path):
        os.remove(file_path)


def split_path_to_list(file_path):
    folders = os.path.normpath(file_path).split(os.path.sep)
    return folders


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


def rename_file(src, des):
    if os.path.exists(src):
        os.rename(src, des)


def count_file_in_folder(folder_path):
    if not check_exist(folder_path):
        return 0

    return len([name for name in os.listdir(folder_path) if name.endswith('.sqlite3')])


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


@log_execution_time()
def is_normal_zip(f_name: Union[str, Path]) -> bool:
    return Path(f_name).suffix == '.zip'


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
