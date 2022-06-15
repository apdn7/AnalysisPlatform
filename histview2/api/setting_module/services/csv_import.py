import math
from datetime import datetime
from io import BytesIO
from typing import List

import pandas as pd
from dateutil import tz
from pandas import DataFrame

from histview2.api.efa.services.etl import csv_transform, detect_file_delimiter
from histview2.api.parallel_plot.services import gen_dic_sensors
from histview2.api.setting_module.services.data_import import csv_data_with_headers, import_data, \
    save_sensors, \
    RECORD_PER_COMMIT, get_new_adding_columns, gen_import_job_info, NA_VALUES, \
    data_pre_processing, gen_substring_column_info, gen_dic_sensor_n_cls, add_new_col_to_df, convert_df_col_to_utc, \
    convert_df_datetime_to_str, validate_datetime, get_sensor_values, INDEX_COL, \
    gen_error_output_df, get_df_first_n_last, write_error_trace, write_error_import, get_latest_records, FILE_IDX_COL, \
    gen_duplicate_output_df, write_duplicate_import
from histview2.api.trace_data.services.proc_link import add_gen_proc_link_job
from histview2.common.common_utils import get_files, get_csv_delimiter, detect_encoding, get_file_modify_time, chunks, \
    get_current_timestamp, detect_file_encoding, convert_time, DATE_FORMAT_STR_ONLY_DIGIT, get_ip_address, get_basename
from histview2.common.constants import JobStatus, DataType
from histview2.common.logger import log_execution_time
from histview2.common.scheduler import scheduler_app_context, JobType
from histview2.common.services.csv_content import read_data, is_normal_csv
from histview2.common.services.normalization import normalize_str, normalize_list
from histview2.common.timezone_utils import detect_timezone, get_utc_offset
from histview2.setting_module.models import CsvImport, CfgProcess, CfgDataSourceCSV, CfgProcessColumn, JobManagement
from histview2.setting_module.services.background_process import send_processing_info, JobInfo
from histview2.trace_data.models import Process, find_cycle_class

pd.options.mode.chained_assignment = None  # default='warn'


@scheduler_app_context
def import_csv_job(_job_id, _job_name, _db_id, _proc_id, _proc_name, *args, **kwargs):
    """ scheduler job import csv

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = import_csv(*args, **kwargs)
    send_processing_info(gen, JobType.CSV_IMPORT, db_code=_db_id, process_id=_proc_id, process_name=_proc_name,
                         after_success_func=add_gen_proc_link_job)


@log_execution_time()
def import_csv(proc_id, record_per_commit=RECORD_PER_COMMIT):
    """ csv files import

    Keyword Arguments:
        proc_id {[type]} -- [description] (default: {None})
        db_id {[type]} -- [description] (default: {None})

    Raises:
        e: [description]

    Yields:
        [type] -- [description]
    """
    # start job
    yield 0

    # get db info
    proc_cfg: CfgProcess = CfgProcess.query.get(proc_id)
    data_src: CfgDataSourceCSV = CfgDataSourceCSV.query.get(proc_cfg.data_source_id)

    # create or get process
    proc = Process.get_or_create_proc(proc_id=proc_id, proc_name=proc_cfg.name)

    # get import files
    import_targets, no_data_files = get_import_target_files(proc_id, data_src)

    # csv delimiter
    csv_delimiter = get_csv_delimiter(data_src.delimiter)

    # get header
    headers = data_src.get_column_names_with_sorted()
    dic_use_cols = {col.column_name: col.data_type for col in proc_cfg.columns}

    # job 100% with zero row
    if not import_targets:
        yield 100
        return

    # cycle class
    cycle_cls = find_cycle_class(proc_id)

    # check new adding column, save.
    missing_sensors = get_new_adding_columns(proc, dic_use_cols)
    save_sensors(missing_sensors)

    # sensor classes
    dic_sensor, dic_sensor_cls = gen_dic_sensor_n_cls(proc_id, dic_use_cols)

    # substring sensors info
    dic_substring_sensors = gen_substring_column_info(proc_id, dic_sensor)

    # get GET_DATE
    get_date_col = proc_cfg.get_date_col()

    # depend on file type (efa1,2,3,4 or normal) , choose right header
    default_csv_param = {}
    use_col_names = []
    if not data_src.etl_func and import_targets and not is_normal_csv(import_targets[-1][0], csv_delimiter):
        is_abnormal = True
        default_csv_param['names'] = headers
        use_col_names = headers
        data_first_row = data_src.skip_head + 1
        head_skips = list(range(0, data_first_row))
    else:
        is_abnormal = False
        data_first_row = data_src.skip_head + 1
        head_skips = list(range(0, data_src.skip_head))

    total_percent = 0
    percent_per_file = 100 / len(import_targets)
    dic_imported_row = {}
    df = pd.DataFrame()

    # init job information object
    job_info = JobInfo()
    job_info.empty_files = []

    # file can not transform by R script
    transformed_file_delimiter = csv_delimiter
    for csv_file_name in no_data_files:
        job_info.status = JobStatus.DONE
        job_info.empty_files = [csv_file_name]
        yield from yield_job_info(job_info, csv_file_name)
        job_info.empty_files = []

    # get current job id
    t_job_management: JobManagement = JobManagement.get_last_job_of_process(proc_id, JobType.CSV_IMPORT.name)
    job_id = str(t_job_management.id) if t_job_management else ''

    df_db_latest_records = None
    for idx, (csv_file_name, transformed_file) in enumerate(import_targets):
        job_info.target = csv_file_name

        if not dic_imported_row:
            job_info.start_tm = get_current_timestamp()

        # R error check
        if isinstance(transformed_file, Exception):
            yield from yield_job_info(job_info, csv_file_name, err_msgs=str(transformed_file))
            continue

        # delimiter check
        transformed_file_delimiter = detect_file_delimiter(transformed_file, csv_delimiter)

        # check missing columns
        if is_abnormal is False:
            # check missing columns
            check_file = read_data(transformed_file, skip_head=data_src.skip_head, end_row=1,
                                   delimiter=transformed_file_delimiter,
                                   do_normalize=False)
            csv_cols = next(check_file)
            csv_cols_normalized = normalize_list(csv_cols)

            check_file.close()
            missing_cols = set(dic_use_cols).difference(csv_cols_normalized)
            if missing_cols:
                err_msg = f"File {transformed_file} doesn't contain expected columns: {missing_cols}"

                df_one_file = csv_to_df(transformed_file, data_src, head_skips, data_first_row, 0,
                                        transformed_file_delimiter)

                if df_db_latest_records is None:
                    df_db_latest_records = get_latest_records(proc_id, dic_sensor, get_date_col)
                df_error_trace = gen_error_output_df(csv_file_name, dic_sensor, get_df_first_n_last(df_one_file),
                                                     df_db_latest_records, err_msg)

                write_error_trace(df_error_trace, proc_cfg.name, csv_file_name)
                write_error_import(df_one_file, proc_cfg.name, csv_file_name, transformed_file_delimiter,
                                   data_src.directory)

                yield from yield_job_info(job_info, csv_file_name, err_msgs=err_msg)
                continue

            default_csv_param['usecols'] = [col for col in csv_cols if col]
            use_col_names = csv_cols

        # read csv file
        default_csv_param['dtype'] = {col: 'string' for col, data_type in dic_use_cols.items() if
                                      col in use_col_names and data_type == DataType.TEXT.name}

        df_one_file = csv_to_df(transformed_file, data_src, head_skips, data_first_row, 0, transformed_file_delimiter,
                                default_csv_param=default_csv_param)

        # validate column name
        validate_columns(dic_use_cols, df_one_file.columns)

        file_record_count = len(df_one_file)

        # no records
        if not file_record_count:
            job_info.status = JobStatus.DONE
            job_info.empty_files = [csv_file_name]
            yield from yield_job_info(job_info, csv_file_name)
            job_info.empty_files = []
            continue

        dic_imported_row[idx] = (csv_file_name, file_record_count)

        # add 3 columns machine, line, process for efa 1,2,4
        if is_abnormal:
            cols, vals = csv_data_with_headers(csv_file_name, data_src)
            df_one_file[cols] = vals

            # remove unused columns
            df_one_file = df_one_file[list(dic_use_cols)]

        # mark file
        df_one_file[FILE_IDX_COL] = idx

        # merge df
        df = df.append(df_one_file, ignore_index=True)

        # 10K records
        if len(df) * len(df.columns) < record_per_commit * 100:
            continue

        # calc percent
        percent_per_commit = percent_per_file * len(dic_imported_row)

        # do import
        save_res, df_error, df_duplicate = import_df(proc_id, df, dic_use_cols, get_date_col, cycle_cls, dic_sensor,
                                                     dic_sensor_cls, dic_substring_sensors)

        df_error_cnt = len(df_error)
        if df_error_cnt:
            if df_db_latest_records is None:
                df_db_latest_records = get_latest_records(proc_id, dic_sensor, get_date_col)
            write_invalid_records_to_file(df_error, dic_imported_row, dic_sensor, df_db_latest_records,
                                          proc_cfg, transformed_file_delimiter, data_src.directory)

        if df_duplicate is not None and len(df_duplicate):
            write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

        total_percent = set_csv_import_percent(job_info, total_percent, percent_per_commit)
        for _idx, (_csv_file_name, _imported_row) in dic_imported_row.items():
            yield from yield_job_info(job_info, _csv_file_name, _imported_row, save_res, df_error_cnt)

        # reset df (important!!!)
        df = pd.DataFrame()
        dic_imported_row = {}

    # do last import
    if len(df):
        save_res, df_error, df_duplicate = import_df(proc_id, df, dic_use_cols, get_date_col, cycle_cls, dic_sensor,
                                                     dic_sensor_cls, dic_substring_sensors)

        df_error_cnt = len(df_error)
        if df_error_cnt:
            if df_db_latest_records is None:
                df_db_latest_records = get_latest_records(proc_id, dic_sensor, get_date_col)
            write_invalid_records_to_file(df_error, dic_imported_row, dic_sensor, df_db_latest_records,
                                          proc_cfg, transformed_file_delimiter, data_src.directory)

        if df_duplicate is not None and len(df_duplicate):
            write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

        for _idx, (_csv_file_name, _imported_row) in dic_imported_row.items():
            yield from yield_job_info(job_info, _csv_file_name, _imported_row, save_res, df_error_cnt)

    yield 100


def set_csv_import_percent(job_info, total_percent, percent_per_chunk):
    total_percent += percent_per_chunk
    job_info.percent = math.floor(total_percent)
    if job_info.percent >= 100:
        job_info.percent = 99

    return total_percent


@log_execution_time()
def get_last_csv_import_info(process_id):
    """ get latest csv import info
    """

    latest_import_files = CsvImport.get_latest_done_files(process_id)
    dic_imported_file = {rec.file_name: rec.start_tm for rec in latest_import_files}
    csv_fatal_imports = CsvImport.get_last_fatal_import(process_id)
    dic_fatal_file = {rec.file_name: rec.start_tm for rec in csv_fatal_imports}

    return dic_imported_file, dic_fatal_file


@log_execution_time()
def filter_import_target_file(proc_id, all_files, dic_success_file: dict, dic_error_file: dict, is_transform=False):
    """filter import target file base on last import job

    Arguments:
        all_files {[type]} -- [description]
        dic_success_file {dict} -- [description]
        dic_error_file {dict} -- [description]

    Returns:
        [type] -- [description]
    """

    has_transform_targets = []
    no_transform_targets = []
    for file_name in all_files:
        if file_name in dic_error_file:
            pass
        elif file_name in dic_success_file:
            modified_date = get_file_modify_time(file_name)
            imported_datetime = dic_success_file[file_name]
            if modified_date <= imported_datetime:
                continue

        # count all rows
        transformed_file = file_name
        if is_transform:
            transformed_file = csv_transform(proc_id, file_name)

        if transformed_file:
            has_transform_targets.append((file_name, transformed_file))
        else:
            no_transform_targets.append(file_name)

    return has_transform_targets, no_transform_targets


def validate_columns(checked_cols, csv_cols):
    """
    check if checked column exists in csv file
    :param checked_cols:
    :param csv_cols:
    :return:
    """
    ng_cols = set(checked_cols) - set(csv_cols)
    if ng_cols:
        raise Exception('CSVファイルの列名・列数が正しくないです。')


@log_execution_time()
def csv_to_df(transformed_file, data_src, head_skips, data_first_row, skip_row, csv_delimiter, default_csv_param=None,
              from_file=False):
    # read csv file
    read_csv_param = {}
    if default_csv_param:
        read_csv_param.update(default_csv_param)

    read_csv_param.update(dict(skiprows=head_skips + list(range(data_first_row, skip_row + data_first_row))))

    # get encoding
    if from_file:
        encoding = detect_file_encoding(transformed_file)
        transformed_file = BytesIO(transformed_file)
    else:
        encoding = detect_encoding(transformed_file)

    # load csv data to dataframe
    df = pd.read_csv(transformed_file, sep=csv_delimiter, skipinitialspace=True, na_values=NA_VALUES,
                     error_bad_lines=False, encoding=encoding, skip_blank_lines=True, **read_csv_param)
    df.dropna(how='all', inplace=True)
    col_names = {col: normalize_str(col) for col in df.columns}
    df = df.rename(columns=col_names)

    # skip tail
    if data_src.skip_tail and len(df):
        df.drop(df.tail(data_src.skip_tail).index, inplace=True)

    return df


@log_execution_time()
def get_import_target_files(proc_id, data_src):
    dic_success_file, dic_error_file = get_last_csv_import_info(proc_id)
    csv_files = get_files(data_src.directory, depth_from=1, depth_to=100, extension=['csv', 'tsv'])

    # transform csv files (pre-processing)
    is_transform = False
    if data_src.etl_func:
        is_transform = True

    # filter target files
    has_trans_targets, no_trans_targets = filter_import_target_file(proc_id, csv_files, dic_success_file,
                                                                    dic_error_file, is_transform)
    return has_trans_targets, no_trans_targets


def strip_quote(val):
    try:
        return val.strip("'").strip()
    except AttributeError:
        return val


@log_execution_time()
def strip_quote_in_df(df: DataFrame):
    """
    strip quote and space
    :param df:
    :return:
    """
    # strip quote
    cols = df.select_dtypes(include=['string', 'object']).columns.tolist()
    df[cols] = df[cols].apply(strip_quote)

    return df


@log_execution_time()
def get_datetime_val(datetime_col):
    """
    Gets a random datetime value support to convert UTC
    :return:
    """
    # Check one by one until get well-formatted datetime string
    valid_datetime_idx = datetime_col.first_valid_index()
    datetime_val = datetime_col.loc[valid_datetime_idx] if valid_datetime_idx is not None else None
    return datetime_val


@log_execution_time()
def copy_df(df):
    orig_df = df.copy()
    return orig_df


@log_execution_time()
def remove_duplicates(df: DataFrame, df_origin: DataFrame, proc_id, get_date_col):
    # get columns that use to check duplicate
    # df_cols = list(set(df.columns.tolist()) - set([INDEX_COL, FILE_IDX_COL]))

    # remove duplicate in csv files
    # df.drop_duplicates(subset=df_cols, keep='last', inplace=True)
    df.drop_duplicates(keep='last', inplace=True)
    index_col = add_new_col_to_df(df, '__df_index_column__', df.index)

    # get min max time of df
    start_tm, end_tm = get_min_max_date(df, get_date_col)

    # get sensors
    cfg_columns: List[CfgProcessColumn] = CfgProcessColumn.get_all_columns(proc_id)
    cfg_columns.sort(key=lambda c: c.is_serial_no + c.is_get_date + c.is_auto_increment, reverse=True)

    col_names = [cfg_col.column_name for cfg_col in cfg_columns]
    dic_sensors = gen_dic_sensors(proc_id, col_names)

    cycle_cls = find_cycle_class(proc_id)
    idxs = None
    for cols in chunks(col_names, 10):
        # get data from database
        records = get_sensor_values(proc_id, cols, dic_sensors, cycle_cls, start_tm=start_tm, end_tm=end_tm)
        if not records:
            break

        df_db = pd.DataFrame(records)
        df_db.drop(INDEX_COL, axis=1, inplace=True)
        df_db.drop_duplicates(inplace=True)

        # remove duplicate df vs df_db
        _idxs = get_duplicate_info(df, df_db, index_col, idxs)

        # can not check duplicate with these columns
        # no column : it is ok , no dupl
        if _idxs is None:
            continue

        # filter idxs
        idxs = _idxs

        # no duplicate
        if not len(idxs):
            break

    if idxs:
        df.drop(idxs, inplace=True)
        df.drop(index_col, axis=1, inplace=True)

    # duplicate data
    df_duplicate = df_origin[~df_origin.index.isin(df.index)]

    return df_duplicate


@log_execution_time()
def get_min_max_date(df: DataFrame, get_date_col):
    return df[get_date_col].min(), df[get_date_col].max()


@log_execution_time()
def get_duplicate_info(df_csv: DataFrame, df_db: DataFrame, df_index_col, idxs):
    col_names = df_db.columns.tolist()
    all_cols = col_names + [df_index_col]
    if idxs:
        df = df_csv.loc[idxs][all_cols].copy()
    else:
        df = df_csv[all_cols].copy()

    for col in col_names:
        if df[col].dtype.name != df_db[col].dtype.name:
            df[col] = df[col].astype(object)
            df_db[col] = df_db[col].astype(object)

    df_merged = pd.merge(df, df_db, on=col_names)
    idxs = df_merged[df_index_col].to_list()
    return idxs


@log_execution_time()
def import_df(proc_id, df, dic_use_cols, get_date_col, cycle_cls, dic_sensor, dic_sensor_cls, dic_substring_sensors):
    if not len(df):
        return 0, None, None

    # convert types
    df = df.convert_dtypes()

    # original df
    orig_df = copy_df(df)

    # remove FILE INDEX col
    if FILE_IDX_COL in df.columns:
        df.drop(FILE_IDX_COL, axis=1, inplace=True)

    # Convert UTC time
    for col, dtype in dic_use_cols.items():
        if DataType[dtype] is not DataType.DATETIME:
            continue

        null_is_error = False
        if col == get_date_col:
            null_is_error = True

        validate_datetime(df, col, null_is_error=null_is_error)
        convert_csv_timezone(df, col)

    # data pre-processing
    df_error = data_pre_processing(df, orig_df, dic_use_cols, exclude_cols=[get_date_col, FILE_IDX_COL, INDEX_COL])

    # no records
    if not len(df):
        return 0, df_error, None

    # remove duplicate records in csv file which exists in csv or DB
    df_duplicate = remove_duplicates(df, orig_df, proc_id, get_date_col)

    save_res = import_data(df, proc_id, get_date_col, cycle_cls, dic_sensor, dic_sensor_cls, dic_substring_sensors)
    return save_res, df_error, df_duplicate


def yield_job_info(job_info, csv_file_name, imported_row=0, save_res=0, df_error_cnt=0, err_msgs=None):
    job_info.target = csv_file_name
    job_info.err_msg = None
    job_info.status = JobStatus.DONE
    gen_import_job_info(job_info, save_res, end_time=get_current_timestamp(), imported_count=imported_row,
                        err_cnt=df_error_cnt, err_msgs=err_msgs)
    yield job_info


@log_execution_time()
def convert_csv_timezone(df, get_date_col):
    datetime_val = get_datetime_val(df[get_date_col])
    is_tz_inside = bool(detect_timezone(datetime_val))
    time_offset = get_utc_offset(tz.tzlocal()) if not is_tz_inside else None
    df[get_date_col] = convert_df_col_to_utc(df, get_date_col, is_tz_inside, time_offset)
    df[get_date_col] = convert_df_datetime_to_str(df, get_date_col)


def write_invalid_records_to_file(df_error: DataFrame, dic_imported_row, dic_sensor, df_db, proc_cfg,
                                  transformed_file_delimiter, data_src_folder, err_msg=None):
    idxs = df_error[FILE_IDX_COL].unique()
    for idx in idxs:
        csv_file_name, *_ = dic_imported_row[idx]
        df_error_one_file = df_error[df_error[FILE_IDX_COL] == idx]
        df_error_one_file.drop(FILE_IDX_COL, axis=1, inplace=True)
        df_error_trace = gen_error_output_df(csv_file_name, dic_sensor,
                                             get_df_first_n_last(df_error_one_file), df_db, err_msg)
        write_error_trace(df_error_trace, proc_cfg.name, csv_file_name)
        write_error_import(df_error_one_file, proc_cfg.name, csv_file_name, transformed_file_delimiter, data_src_folder)
    return True


def write_duplicate_records_to_file(df_duplicate: DataFrame, dic_imported_row, dic_use_cols, proc_name, job_id=None):
    error_msg = 'Duplicate Record'
    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()

    for idx, df in df_duplicate.groupby(FILE_IDX_COL):
        csv_file_path_name, *_ = dic_imported_row[idx]
        csv_file_name = get_basename(csv_file_path_name) if csv_file_path_name else ''

        df.drop(FILE_IDX_COL, axis=1, inplace=True)
        df_output = gen_duplicate_output_df(dic_use_cols, get_df_first_n_last(df),
                                            csv_file_name=csv_file_path_name, error_msgs=error_msg)

        write_duplicate_import(df_output, [proc_name, csv_file_name, 'Duplicate', job_id, time_str, ip_address])
