from __future__ import annotations

import math
import os.path
import re
from datetime import datetime
from io import BytesIO
from typing import List, Optional

import numpy as np
import pandas as pd
from pandas import DataFrame

from ap.api.efa.services.etl import csv_transform, detect_file_path_delimiter
from ap.api.setting_module.services.data_import import (
    FILE_IDX_COL,
    INDEX_COL,
    NA_VALUES,
    RECORD_PER_COMMIT,
    add_new_col_to_df,
    convert_df_col_to_utc,
    convert_df_datetime_to_str,
    csv_data_with_headers,
    data_pre_processing,
    gen_duplicate_output_df,
    gen_error_output_df,
    gen_import_job_info,
    get_df_first_n_last,
    get_latest_records,
    import_data,
    save_failed_import_history,
    validate_datetime,
    write_duplicate_import,
    write_error_import,
    write_error_trace,
)
from ap.api.setting_module.services.v2_etl_services import (
    get_df_v2_process_single_file,
    get_v2_datasource_type_from_file,
    get_vertical_df_v2_process_single_file,
    is_v2_data_source,
    prepare_to_import_v2_df,
    remove_timezone_inside,
)
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job
from ap.common.common_utils import (
    DATE_FORMAT,
    DATE_FORMAT_STR_ONLY_DIGIT,
    TIME_FORMAT_WITH_SEC,
    SQLiteFormatStrings,
    convert_time,
    detect_encoding,
    detect_file_encoding,
    get_basename,
    get_csv_delimiter,
    get_current_timestamp,
    get_file_modify_time,
    get_files,
)
from ap.common.constants import (
    ALMOST_COMPLETE_PERCENT,
    COMPLETED_PERCENT,
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_EMPTY_DATA,
    DATA_TYPE_ERROR_MSG,
    DATE_TYPE_REGEX,
    DATETIME_DUMMY,
    DEFAULT_NONE_VALUE,
    EMPTY_STRING,
    FILE_NAME,
    NUM_CHARS_THRESHOLD,
    TIME_TYPE_REGEX,
    CSVExtTypes,
    DataType,
    DBType,
    JobStatus,
    JobType,
)
from ap.common.datetime_format_utils import DateTimeFormatUtils
from ap.common.disk_usage import get_ip_address
from ap.common.logger import log_execution_time, logger
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import scheduler_app_context
from ap.common.services.csv_content import (
    get_limit_records,
    is_normal_csv,
    read_csv_with_transpose,
    read_data,
)
from ap.common.services.csv_header_wrapr import (
    add_suffix_if_duplicated,
    gen_colsname_for_duplicated,
    transform_duplicated_col_suffix_to_pandas_col,
)
from ap.common.services.normalization import normalize_list, normalize_str
from ap.common.services.sse import AnnounceEvent, background_announcer
from ap.common.timezone_utils import (
    add_days_from_utc,
    gen_dummy_datetime,
    get_next_datetime_value,
    get_time_info,
)
from ap.setting_module.models import (
    CfgDataSourceCSV,
    CfgProcess,
    CfgProcessColumn,
    JobManagement,
)
from ap.setting_module.services.background_process import JobInfo, send_processing_info
from ap.trace_data.transaction_model import TransactionData

# pd.options.mode.chained_assignment = None  # default='warn'


@scheduler_app_context
def import_csv_job(
    _job_id,
    _job_name,
    _db_id,
    _proc_id,
    _proc_name,
    proc_id,
    is_user_request: bool = False,
    register_by_file_request_id: str = None,
    **kwargs,
):
    """scheduler job import csv

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """

    def _add_gen_proc_link_job(*_args, **_kwargs):
        add_gen_proc_link_job(process_id=proc_id, is_user_request=is_user_request, *_args, **_kwargs)

    gen = import_csv(proc_id, register_by_file_request_id=register_by_file_request_id)
    send_processing_info(
        gen,
        JobType.CSV_IMPORT,
        db_code=_db_id,
        process_id=_proc_id,
        process_name=_proc_name,
        after_success_func=_add_gen_proc_link_job,
        **kwargs,
    )


def get_config_sensor(proc_id):
    # check new adding column, save.
    dic_use_cols = {col.column_name: col for col in CfgProcessColumn.get_all_columns(proc_id)}

    return dic_use_cols


@log_execution_time()
def import_csv(proc_id, record_per_commit=RECORD_PER_COMMIT, register_by_file_request_id: str = None):
    """csv files import

    Keyword Arguments:
        proc_id {[type]} -- [description] (default: {None})
        db_id {[type]} -- [description] (default: {None})
        register_by_file_request_id {[type]} -- [description] (default: {None})

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
    is_v2_datasource = is_v2_data_source(ds_type=data_src.cfg_data_source.type)

    trans_data = TransactionData(proc_cfg.id)
    with DbProxy(gen_data_source_of_universal_db(proc_id), True, immediate_isolation_level=True) as db_instance:
        trans_data.create_table(db_instance)

        # get import files
        import_targets, no_data_files = get_import_target_files(proc_id, data_src, trans_data, db_instance)

    # job 100% with zero row
    if not import_targets:
        yield 100
        return

    # csv delimiter
    csv_delimiter = get_csv_delimiter(data_src.delimiter)

    # get header
    headers = data_src.get_column_names_with_sorted()
    dic_use_cols = {col.column_name: col for col in proc_cfg.columns}
    use_dummy_datetime = DATETIME_DUMMY in dic_use_cols

    latest_record = None
    # find last records in case of dummy datetime is used
    if use_dummy_datetime:
        # (latest_record,) = dic_sensor_cls[DATETIME_DUMMY].get_max_value(DATETIME_DUMMY)
        with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
            latest_record = trans_data.get_max_date_time_by_process_id(db_instance)
            if latest_record:
                latest_record = add_days_from_utc(latest_record, 1)

    # get GET_DATE
    get_date_col = proc_cfg.get_date_col()

    # depend on file type (efa1,2,3,4 or normal) , choose right header
    default_csv_param = {}
    use_col_names = []
    skip_head = data_src.skip_head if data_src else None
    n_rows = data_src.n_rows if data_src else None
    is_transpose = data_src.is_transpose if data_src else False
    if (
        not data_src.etl_func
        and import_targets
        and not is_normal_csv(
            import_targets[-1][0],
            csv_delimiter,
            skip_head=skip_head,
            n_rows=n_rows,
            is_transpose=is_transpose,
        )
    ):
        is_abnormal = True
        default_csv_param['names'] = headers
        use_col_names = headers
        if use_dummy_datetime and DATETIME_DUMMY in use_col_names:
            use_col_names.remove(DATETIME_DUMMY)
        # check for skip_head = None to prevent TypeError when adding 1
        data_first_row = (skip_head if skip_head is not None else 0) + 1
        head_skips = list(range(data_first_row))
    else:
        is_abnormal = False
        data_first_row = (skip_head if skip_head is not None else 0) + 1
        head_skips = list(range(skip_head if skip_head is not None else 0))

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
    job_info.job_id = job_id

    dummy_datetime_from = latest_record
    df_db_latest_records = None

    is_first_chunk = True
    error_type = None
    chunk_size = record_per_commit * 100
    for idx, (csv_file_name, transformed_file) in enumerate(import_targets):
        job_info.target = csv_file_name

        if not dic_imported_row:
            job_info.start_tm = get_current_timestamp()

        # R error check
        if isinstance(transformed_file, Exception):
            yield from yield_job_info(job_info, csv_file_name, err_msgs=str(transformed_file))
            continue

        # delimiter check
        transformed_file_delimiter, encoding = detect_file_path_delimiter(
            transformed_file,
            csv_delimiter,
            with_encoding=True,
        )
        # check missing columns
        if is_abnormal is False:
            dic_csv_cols = None
            dic_org_csv_cols = None
            csv_cols = headers
            # in case if v2, assume that there is not missing columns from v2 files
            if not is_v2_datasource:
                # check missing columns
                check_file = read_data(
                    transformed_file,
                    skip_head=data_src.skip_head,
                    n_rows=data_src.n_rows,
                    is_transpose=data_src.is_transpose,
                    delimiter=transformed_file_delimiter,
                    do_normalize=False,
                )
                org_csv_cols = next(check_file)

                if data_src.dummy_header:
                    # generate column name if there is not header in file
                    org_csv_cols, csv_cols, _, _, _ = gen_dummy_header(org_csv_cols, skip_head=data_src.skip_head)
                    csv_cols, _ = gen_colsname_for_duplicated(csv_cols)
                else:
                    # need to convert header in case of transposed
                    if data_src.is_transpose:
                        _, csv_cols, _, _, _ = gen_dummy_header(org_csv_cols)
                        csv_cols, _ = gen_colsname_for_duplicated(csv_cols)
                    else:
                        csv_cols = normalize_list(org_csv_cols)
                    # try to convert ➊ irregular number from csv columns
                    csv_cols = [normalize_str(col) for col in csv_cols]
                csv_cols, with_dupl_cols = add_suffix_if_duplicated(csv_cols)
                dic_csv_cols = dict(zip(csv_cols, with_dupl_cols))
                # add suffix to origin csv cols
                org_csv_cols, _ = add_suffix_if_duplicated(org_csv_cols)
                dic_org_csv_cols = dict(zip(csv_cols, org_csv_cols))

                check_file.close()
            # missing_cols = set(dic_use_cols).difference(csv_cols)
            # find same columns between csv file and db
            valid_columns = list(set(dic_use_cols).intersection(csv_cols))
            # re-arrange cols
            valid_columns = [col for col in csv_cols if col in valid_columns]
            dic_valid_csv_cols = dict(zip(valid_columns, [False] * len(valid_columns)))
            missing_cols = [] if len(valid_columns) else list(dic_use_cols.keys())

            if not is_v2_datasource:
                valid_with_dupl_cols = [dic_csv_cols[col] for col in valid_columns]
                dic_valid_csv_cols = dict(zip(valid_columns, valid_with_dupl_cols))

            if DATETIME_DUMMY in missing_cols:
                # remove dummy col before check
                missing_cols.remove(DATETIME_DUMMY)

            if missing_cols and not is_v2_datasource:
                err_msg = f"File {transformed_file} doesn't contain expected columns: {list(set(dic_use_cols))}"

                df_one_file = csv_to_df(
                    transformed_file,
                    data_src,
                    head_skips,
                    data_first_row,
                    0,
                    transformed_file_delimiter,
                    dic_use_cols=dic_use_cols,
                    encoding=encoding,
                )

                if df_db_latest_records is None:
                    df_db_latest_records = get_latest_records(proc_id)
                df_error_trace = gen_error_output_df(
                    csv_file_name,
                    dic_use_cols,
                    get_df_first_n_last(df_one_file),
                    df_db_latest_records,
                    err_msg,
                )

                write_error_trace(df_error_trace, proc_cfg.name, csv_file_name)
                write_error_import(
                    df_one_file,
                    proc_cfg.name,
                    csv_file_name,
                    transformed_file_delimiter,
                    data_src.directory,
                )

                yield from yield_job_info(job_info, csv_file_name, err_msgs=err_msg)
                continue

            # default_csv_param['usecols'] = [i for i, col in enumerate(valid_columns) if col]
            if not data_src.dummy_header:
                default_csv_param['usecols'] = transform_duplicated_col_suffix_to_pandas_col(
                    dic_valid_csv_cols,
                    dic_org_csv_cols,
                )
                use_col_names = [col for col in valid_columns if col]
            else:
                # dummy header
                default_csv_param['names'] = csv_cols

        # read csv file
        default_csv_param['dtype'] = {
            col: 'string'
            for col, col_cfg in dic_use_cols.items()
            if col in use_col_names
            and col_cfg.data_type
            in [
                DataType.TEXT.name,
                DataType.DATETIME.name,
                DataType.DATE.name,
                DataType.TIME.name,
            ]
        }

        # add more dtype columns in usecols
        if 'usecols' in default_csv_param:
            for col_name in default_csv_param['usecols']:
                if col_name not in default_csv_param['dtype']:
                    default_csv_param['dtype'][col_name] = 'string'

        if is_v2_datasource:
            datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(transformed_file)
            if datasource_type == DBType.V2_HISTORY:
                df_one_file = get_df_v2_process_single_file(
                    transformed_file,
                    process_name=data_src.process_name,
                    datasource_type=datasource_type,
                    is_abnormal_v2=is_abnormal_v2,
                )
            elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
                df_one_file = get_vertical_df_v2_process_single_file(
                    transformed_file,
                    process_name=data_src.process_name,
                    datasource_type=datasource_type,
                    is_abnormal_v2=is_abnormal_v2,
                    is_en_cols=is_en_cols,
                )
            else:
                continue
                # raise NotImplementedError

            if df_one_file.empty:
                continue

            df_one_file, has_remaining_cols = prepare_to_import_v2_df(df_one_file, proc_id, datasource_type)

            if has_remaining_cols:
                dic_use_cols = get_config_sensor(proc_id)

        else:
            # skip_rows = 0 if (is_abnormal or len(head_skips)) else data_src.skip_head
            df_one_file = csv_to_df(
                transformed_file,
                data_src,
                head_skips,
                data_first_row,
                0,
                transformed_file_delimiter,
                default_csv_param=default_csv_param,
                dic_use_cols=dic_use_cols,
                col_names=use_col_names,
                encoding=encoding,
            )
            # validate column name
            validate_columns(dic_use_cols, df_one_file.columns, use_dummy_datetime)

        file_record_count = len(df_one_file)

        if dic_use_cols.get(FILE_NAME):
            add_column_file_name(df_one_file, transformed_file)

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
            dic_use_cols_for_abnormal = dic_use_cols.copy()
            if use_dummy_datetime and DATETIME_DUMMY in dic_use_cols_for_abnormal:
                dic_use_cols_for_abnormal.pop(DATETIME_DUMMY)
            # remove unused columns
            df_one_file = df_one_file[list(dic_use_cols_for_abnormal)]

        if use_dummy_datetime and DATETIME_DUMMY not in df_one_file.columns:
            df_one_file = gen_dummy_datetime(df_one_file, dummy_datetime_from)
            dummy_datetime_from = get_next_datetime_value(df_one_file.shape[0], dummy_datetime_from)

        # mark file
        df_one_file[FILE_IDX_COL] = idx

        # merge df
        df = df.append(df_one_file, ignore_index=True)

        # 10K records
        if df.size < chunk_size:
            continue

        # calc percent
        percent_per_commit = percent_per_file * len(dic_imported_row)

        job_info.dic_imported_row = dic_imported_row
        job_info.import_type = JobType.CSV_IMPORT.name
        # do import
        save_res, df_error, df_duplicate = import_df(proc_id, df, dic_use_cols, get_date_col, job_info, trans_data)
        if is_first_chunk:
            if register_by_file_request_id:
                data_register_data = {
                    'RegisterByFileRequestID': register_by_file_request_id,
                    'status': JobStatus.PROCESSING.name,
                    'process_id': proc_id,
                    'is_first_imported': True,
                    'use_dummy_datetime': use_dummy_datetime,
                }
                background_announcer.announce(
                    data_register_data,
                    AnnounceEvent.DATA_REGISTER.name,
                    f'{AnnounceEvent.DATA_REGISTER.name}_{proc_id}',
                )
            is_first_chunk = False

        df_error_cnt = len(df_error)
        if df_error_cnt:
            if df_db_latest_records is None:
                df_db_latest_records = get_latest_records(proc_id)
            write_invalid_records_to_file(
                df_error,
                dic_imported_row,
                dic_use_cols,
                df_db_latest_records,
                proc_cfg,
                transformed_file_delimiter,
                data_src.directory,
            )
            error_type = DATA_TYPE_ERROR_MSG

        if df_duplicate is not None and len(df_duplicate):
            error_type = DATA_TYPE_DUPLICATE_MSG
            write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

        total_percent = set_csv_import_percent(job_info, total_percent, percent_per_commit)
        for _idx, (_csv_file_name, _imported_row) in dic_imported_row.items():
            yield from yield_job_info(job_info, _csv_file_name, _imported_row, save_res, df_error_cnt)

        # reset df (important!!!)
        df = pd.DataFrame()
        dic_imported_row = {}

    if not len(df):
        # if there is empty data in all files
        error_type = DATA_TYPE_ERROR_EMPTY_DATA

    # do last import
    if len(df):
        job_info.dic_imported_row = dic_imported_row
        job_info.import_type = JobType.CSV_IMPORT.name
        save_res, df_error, df_duplicate = import_df(proc_id, df, dic_use_cols, get_date_col, job_info, trans_data)

        if is_first_chunk and register_by_file_request_id:
            data_register_data = {
                'RegisterByFileRequestID': register_by_file_request_id,
                'status': JobStatus.PROCESSING.name,
                'process_id': proc_id,
                'is_first_imported': True,
                'use_dummy_datetime': use_dummy_datetime,
            }
            background_announcer.announce(
                data_register_data,
                AnnounceEvent.DATA_REGISTER.name,
                f'{AnnounceEvent.DATA_REGISTER.name}_{proc_id}',
            )

        df_error_cnt = len(df_error)
        if df_error_cnt:
            error_type = DATA_TYPE_ERROR_MSG
            if df_db_latest_records is None:
                df_db_latest_records = get_latest_records(proc_id)
            write_invalid_records_to_file(
                df_error,
                dic_imported_row,
                dic_use_cols,
                df_db_latest_records,
                proc_cfg,
                transformed_file_delimiter,
                data_src.directory,
            )

        if df_duplicate is not None and len(df_duplicate):
            error_type = DATA_TYPE_DUPLICATE_MSG
            write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

        for _idx, (_csv_file_name, _imported_row) in dic_imported_row.items():
            yield from yield_job_info(job_info, _csv_file_name, _imported_row, save_res, df_error_cnt)

    if error_type:
        save_failed_import_history(proc_id, job_info, error_type)

    yield 100


def set_csv_import_percent(job_info, total_percent, percent_per_chunk):
    total_percent += percent_per_chunk
    job_info.percent = math.floor(total_percent)
    if job_info.percent >= COMPLETED_PERCENT:
        job_info.percent = ALMOST_COMPLETE_PERCENT

    return total_percent


@log_execution_time()
def get_last_csv_import_info(trans_data, db_instance):
    """get latest csv import info"""

    latest_import_files = trans_data.get_import_history_latest_done_files(db_instance)
    dic_imported_file = {rec.file_name: rec.start_tm for rec in latest_import_files}
    csv_fatal_imports = trans_data.get_import_history_last_fatal(db_instance)
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


@log_execution_time()
def validate_columns(checked_cols, csv_cols, use_dummy_datetime):
    """
    check if checked column exists in csv file
    :param use_dummy_datetime:
    :param checked_cols:
    :param csv_cols:
    :return:
    """
    # ng_cols = set(csv_cols) - set(checked_cols)
    valid_cols = list(set(checked_cols).intersection(csv_cols))
    ng_cols = [] if len(valid_cols) else list(csv_cols)
    # remove dummy datetime columns from set to skip validate this column
    if use_dummy_datetime and DATETIME_DUMMY in ng_cols:
        ng_cols.remove(DATETIME_DUMMY)
    # if all columns from csv file is not included in db, raise exception
    if ng_cols:
        raise Exception('CSVファイルの列名・列数が正しくないです。')


@log_execution_time()
def csv_to_df(
    transformed_file,
    data_src,
    head_skips,
    data_first_row,
    skip_row,
    csv_delimiter,
    default_csv_param=None,
    from_file=False,
    dic_use_cols=None,
    col_names=None,
    encoding=None,
):
    # read csv file
    read_csv_param = {}
    if default_csv_param:
        read_csv_param.update(default_csv_param)

    read_csv_param.update(
        {
            'skiprows': head_skips + list(range(data_first_row, skip_row + data_first_row)),
        },
    )
    if len(head_skips) and data_src.dummy_header:
        # to avoid issue of header be duplicated at first row
        read_csv_param.update(
            {
                'header': 0,
            },
        )

    # assign n_rows with is_transpose
    n_rows = get_limit_records(is_transpose=data_src.is_transpose, n_rows=data_src.n_rows)
    read_csv_param.update({'nrows': n_rows})

    # get encoding
    if not encoding:
        if from_file:
            encoding = detect_file_encoding(transformed_file)
            transformed_file = BytesIO(transformed_file)
        else:
            encoding = detect_encoding(transformed_file)

    read_csv_param.update(
        {
            'sep': csv_delimiter,
            'na_values': NA_VALUES,
            'error_bad_lines': False,
            'encoding': encoding,
            'skip_blank_lines': True,
            'index_col': False,
        },
    )
    # load csv data to dataframe
    try:
        df = read_csv_with_transpose(transformed_file, is_transpose=data_src.is_transpose, **read_csv_param)
    except UnicodeDecodeError:
        read_csv_param.update({'encoding': 'unicode_escape'})
        df = read_csv_with_transpose(transformed_file, is_transpose=data_src.is_transpose, **read_csv_param)

    df.dropna(how='all', inplace=True)

    if col_names:
        df.columns = col_names

    col_names = {col: normalize_str(col) for col in df.columns}
    df = df.rename(columns=col_names)

    # skip tail
    if data_src.skip_tail and len(df):
        df.drop(df.tail(data_src.skip_tail).index, inplace=True)

    if dic_use_cols:
        # extract columns of df same as data-source
        sub_cols = [col for col in dic_use_cols.keys() if col in df.columns]
        df = df[sub_cols]
    return df


@log_execution_time()
def get_import_target_files(proc_id, data_src, trans_data, db_instance):
    dic_success_file, dic_error_file = get_last_csv_import_info(trans_data, db_instance)
    valid_extensions = [CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value, CSVExtTypes.ZIP.value]
    csv_files = []
    if data_src.is_file_path:
        if any(data_src.directory.lower().endswith(ext) for ext in valid_extensions):
            csv_files.append(data_src.directory)
    else:
        csv_files = get_files(
            data_src.directory,
            depth_from=1,
            depth_to=100,
            extension=valid_extensions,
        )

    # transform csv files (pre-processing)
    is_transform = False
    if data_src.etl_func:
        is_transform = True

    # filter target files
    has_trans_targets, no_trans_targets = filter_import_target_file(
        proc_id,
        csv_files,
        dic_success_file,
        dic_error_file,
        is_transform,
    )
    return has_trans_targets, no_trans_targets


def strip_quote(val):
    try:
        return val.strip("'").strip()
    except AttributeError:
        return val


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
def remove_duplicates(
    df: DataFrame,
    df_origin: DataFrame,
    df_error: DataFrame,
    proc_id,
    get_date_col,
    cfg_columns: List[CfgProcessColumn],
):
    # get min max time of df
    start_tm, end_tm = get_min_max_date(df, get_date_col)
    if not start_tm and not end_tm:
        return pd.DataFrame(columns=df.columns.tolist())

    # column names
    dic_cols = {cfg_col.bridge_column_name: cfg_col.column_name for cfg_col in cfg_columns}
    # find same columns from csv and datasource
    df_columns = list(set(df.columns.tolist()).intersection(dic_cols.values()))

    # remove error index in df_origin
    df_origin_check = df_origin[~df_origin.index.isin(df_error.index)]
    # remove duplicate in csv files
    if len(df_columns):
        df.drop_duplicates(subset=df_columns, keep='last', inplace=True)

    # get data from database
    with DbProxy(gen_data_source_of_universal_db(proc_id), True) as db_instance:
        trans_data = TransactionData(proc_id)
        cols, rows = trans_data.get_data_for_check_duplicate(db_instance, start_tm, end_tm)
        dic_col_dtypes = trans_data.get_column_dtype(db_instance, cols)

    df_db = pd.DataFrame(rows, columns=[dic_cols[col] for col in cols])

    # remove duplicate df vs df_db
    index_col = add_new_col_to_df(df, '__df_index_column__', df.index)
    dic_col_dtypes = {dic_cols[col]: dtype for col, dtype in dic_col_dtypes.items()}
    idxs = get_duplicate_info(df, df_db, index_col, col_dtypes=dic_col_dtypes)

    if idxs:
        df.drop(idxs, inplace=True)

    df.drop(index_col, axis=1, inplace=True)

    # duplicate data
    df_duplicate = df_origin_check[~df_origin_check.index.isin(df.index)]

    return df_duplicate


@log_execution_time()
def get_min_max_date(df: DataFrame, get_date_col):
    return df[get_date_col].min(), df[get_date_col].max()


@log_execution_time()
def get_duplicate_info(df_csv: DataFrame, df_db: DataFrame, df_index_col, col_dtypes=None):
    db_column_names = df_db.columns.tolist()
    csv_column_names = df_csv.columns.tolist()
    same_column_names = get_same_cols_from_dfs(db_column_names, csv_column_names)

    if not len(same_column_names):
        return []

    # fill None if df_csv missing column
    for col in db_column_names:
        if col not in csv_column_names:
            df_csv[col] = None

    df = df_csv.copy()

    # ↓====== Correct data type in dataFrame ======↓
    for col in df_db.columns:
        if col not in df:
            continue
        if df[col].dtype.name == df_db[col].dtype.name:
            continue

        if not col_dtypes:
            continue

        dtype = 'object'
        data_type = col_dtypes.get(col)

        try:
            if data_type == 'integer':
                dtype = pd.Int64Dtype.name
            if data_type == 'real':
                dtype = pd.Float64Dtype.name
            if data_type == 'text':
                dtype = pd.StringDtype.name
            if 'timestamp' in data_type:
                dtype = np.datetime64.__name__
            if data_type == 'boolean':
                dtype = 'boolean'

            df[col] = df[col].astype(dtype)
            df_db[col] = df_db[col].astype(dtype)
        except TypeError as e:
            logger.exception(e)
            continue
    # ↑====== Correct data type in dataFrame ======↑

    df_merged = pd.merge(df, df_db, on=db_column_names)
    idxs = df_merged[df_index_col].to_list()
    return idxs


@log_execution_time()
def datetime_transform(datetime_series, date_only=False):
    # MM-DD | MM月DD日 | MM/DD -> current year -MM-DD 00:00:00
    regex1 = r'^(?P<m>\d{1,2})(-|\/|月)(?P<d>\d{1,2})日?$'
    # YYYY/MM/DD | YYYY-MM-DD | YYYY年MM月DD日 | YY-MM-DD | YY/MM/DD | YY年MM月DD日-> YYYY-MM-DD 00:00:00
    regex2 = r'^(?P<y>\d{4}|\d{1,2})(-|\/|年)(?P<m>\d{1,2})(-|\/|月)(?P<d>\d{1,2})日?$'
    # YYYY年MM月DD日hh時mm分ss秒 -> YYYY-MM-DD hh:mm:ss
    regex3 = r'^(?P<y>\d{4})年(?P<m>\d{1,2})月(?P<d>\d{1,2})日(?P<h>\d{1,2})時(?P<min>\d{1,2})分(?P<s>\d{1,2})秒$'

    current_year = datetime.now().strftime('%Y')

    def without_year_datetime(m: re.match) -> str:
        result = f"{current_year}-{m.group('m')}-{m.group('d')}"
        if not date_only:
            result += ' 00:00:00'
        return result

    def full_datetime(m: re.match) -> str:
        if len(m.group('y')) == 4:
            result = f"{m.group('y')}-{m.group('m')}-{m.group('d')}"
        else:
            # if there is 2 digit of year, convert to full year
            result = f"{current_year[0:2]}{m.group('y')}-{m.group('m')}-{m.group('d')}"
        if not date_only:
            result += ' 00:00:00'
        return result

    def actual_datetime(m: re.match) -> str:
        result = f"{m.group('y')}-{m.group('m')}-{m.group('d')}"
        if not date_only:
            result += f" {m.group('h')}:{m.group('min')}:{m.group('s')}"
        return result

    # convert special datetime string to iso-format
    datetime_series = datetime_series.str.replace(regex1, without_year_datetime, regex=True)
    datetime_series = datetime_series.str.replace(regex2, full_datetime, regex=True)
    datetime_series = datetime_series.str.replace(regex3, actual_datetime, regex=True)

    return datetime_series


@log_execution_time()
def date_transform(date_series):
    """
    Convert date series to standard date format

    Support input formats:

    - YYYY/MM/DD
    - YYYY-MM-DD
    - YYYY年MM月DD日

    Args:
        date_series (Series): a series of time

    Returns:
        A series of date with standard format YYYY-MM-DD
    """
    separate_char = '-'
    begin_part_of_year = datetime.now().year.__str__()[:2]
    return date_series.str.replace(
        DATE_TYPE_REGEX,
        lambda m: (
            f'{m.group("year") if len(m.group("year")) == 4 else begin_part_of_year + m.group("year")}'
            f'{separate_char}'
            f'{m.group("month").rjust(2, "0")}'
            f'{separate_char}'
            f'{m.group("day").rjust(2, "0")}'
        ),
        regex=True,
    )


@log_execution_time()
def time_transform(time_series):
    """
    Convert time series to standard time format

    Support input formats:

    - HH:mm:ss
    - HH-mm-ss
    - HH.mm.ss
    - HH mm ss
    - HH時mm分ss秒

    Args:
        time_series (Series): a series of time

    Returns:
        A series of time with standard format HH:MM:SS
    """
    separate_char = ':'
    return time_series.str.replace(
        TIME_TYPE_REGEX,
        lambda m: (
            f'{m.group("hour").rjust(2, "0")}'
            f'{separate_char}'
            f'{m.group("minute").rjust(2, "0")}'
            f'{separate_char}'
            f'{m.group("second").rjust(2, "0")}'
        ),
        regex=True,
    )


@log_execution_time()
def convert_datetime_format(df, dic_use_cols, datetime_format: Optional[str] = None):
    datetime_format_obj = DateTimeFormatUtils.get_datetime_format(datetime_format)
    for col, cfg_col in dic_use_cols.items():
        if col not in df.columns:
            continue
        if cfg_col.data_type == DataType.DATETIME.name:
            # Convert datetime base on datetime format
            if datetime_format_obj.datetime_format:
                datetime_series = pd.to_datetime(
                    df[col],
                    errors='coerce',
                    format=datetime_format_obj.datetime_format,
                )
                non_na_datetime_series = datetime_series[datetime_series.notnull()]
                df[col] = non_na_datetime_series.dt.strftime(SQLiteFormatStrings.DATETIME.value).astype(
                    pd.StringDtype(),
                )
                continue

            dtype_name = df[col].dtype.name
            if dtype_name == 'object':
                df[col] = df[col].astype(str)
            elif dtype_name != 'string':
                continue
            date_only = cfg_col.data_type == DataType.DATE.name
            df[col] = datetime_transform(df[col], date_only=date_only)

        elif cfg_col.data_type == DataType.DATE.name:
            # Convert date base on date format
            if datetime_format_obj.date_format:
                date_series = pd.to_datetime(
                    df[col],
                    errors='coerce',
                    format=datetime_format_obj.date_format,
                )
                non_na_date_series = date_series[date_series.notnull()]
                df[col] = non_na_date_series.dt.strftime(SQLiteFormatStrings.DATE.value).astype(pd.StringDtype())
                continue

            if pd.api.types.is_datetime64_dtype(df[col]):
                df[col] = df[col].dt.strftime(SQLiteFormatStrings.DATE.value).astype(pd.StringDtype())
                continue

            date_series = pd.to_datetime(df[col], errors='coerce')
            date_series.update(date_series[date_series.notnull()].dt.strftime(SQLiteFormatStrings.DATE.value))
            unknown_series = df[date_series.isnull()][col].astype('string')
            date_series.update(unknown_series)
            date_series = date_series.astype('string')
            df[col] = date_transform(date_series).replace({pd.NaT: DEFAULT_NONE_VALUE})

        elif cfg_col.data_type == DataType.TIME.name:
            # Convert time base on time format
            if datetime_format_obj.time_format:
                time_series = pd.to_datetime(
                    df[col],
                    errors='coerce',
                    format=datetime_format_obj.time_format,
                )
                non_na_time_series = time_series[time_series.notnull()]
                df[col] = non_na_time_series.dt.strftime(SQLiteFormatStrings.TIME.value).astype(pd.StringDtype())
                continue

            if pd.api.types.is_datetime64_dtype(df[col]):
                df[col] = df[col].dt.strftime(SQLiteFormatStrings.TIME.value).astype(pd.StringDtype())
                continue

            time_series = pd.to_datetime(df[col], errors='coerce')
            time_series.update(time_series[time_series.notnull()].dt.strftime(SQLiteFormatStrings.TIME.value))
            unknown_series = df[time_series.isnull()][col].astype('string')
            time_series.update(unknown_series)
            time_series = time_transform(time_series).replace({pd.NaT: DEFAULT_NONE_VALUE})
            df[col] = time_series

    return df


@log_execution_time()
def datetime_processing(df, dic_use_cols, get_date_col, null_is_error=True):
    # remove FILE INDEX col
    if FILE_IDX_COL in df.columns:
        df.drop(FILE_IDX_COL, axis=1, inplace=True)
    for col, cfg_col in dic_use_cols.items():
        if cfg_col.data_type != DataType.DATETIME.name:
            continue

        # convert datatime type 2023年01月02日 -> 2023-01-02 00:00:00
        convert_datetime_format(df, col)

        if col == get_date_col:
            # validate datetime
            validate_datetime(df, col, null_is_error=null_is_error)

        # convert timezone to UTC
        convert_csv_timezone(df, col)

    return df


@log_execution_time()
def import_df(proc_id, df, dic_use_cols, get_date_col, job_info=None, trans_data=None):
    if not len(df):
        return 0, None, None

    # convert types
    df = df.convert_dtypes()

    # convert datatime type 2023年01月02日 -> 2023-01-02 00:00:00
    cfg_process = CfgProcess.get_proc_by_id(proc_id)
    df = convert_datetime_format(df, dic_use_cols, datetime_format=cfg_process.datetime_format)

    # make datetime main from date:main and time:main
    if trans_data and trans_data.main_date_column and trans_data.main_time_column:
        merge_is_get_date_from_date_and_time(
            df,
            trans_data.getdate_column.column_raw_name,
            trans_data.main_date_column.column_raw_name,
            trans_data.main_time_column.column_raw_name,
        )

    # original df
    orig_df = copy_df(df)

    # remove FILE INDEX col
    if FILE_IDX_COL in df.columns:
        df.drop(FILE_IDX_COL, axis=1, inplace=True)

    # Convert UTC time
    for col, cfg_col in dic_use_cols.items():
        dtype = cfg_col.data_type
        if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
            continue

        null_is_error = False
        if col == get_date_col:
            null_is_error = True

        validate_datetime(df, col, null_is_error=null_is_error)
        convert_csv_timezone(df, col)

    # data pre-processing
    df_error = data_pre_processing(
        df,
        orig_df,
        dic_use_cols,
        exclude_cols=[get_date_col, FILE_IDX_COL, INDEX_COL],
        get_date_col=get_date_col,
    )
    # job status
    job_info.status = JobStatus.FAILED.name if len(df_error) else JobStatus.DONE.name

    # no records
    if not len(df):
        return 0, df_error, None

    used_cols = set(dic_use_cols)
    df_columns = set(df.columns.to_list())
    unused_cols = used_cols - df_columns
    valid_cols = used_cols - unused_cols

    df = df[list(valid_cols)]
    # remove duplicate records in csv file which exists in csv or DB
    cfg_columns = list(dic_use_cols.values())

    # merge mode
    cfg_proc: CfgProcess = CfgProcess.get_proc_by_id(proc_id)
    parent_id = cfg_proc.parent_id
    if parent_id:
        cfg_parent_proc: CfgProcess = CfgProcess.get_proc_by_id(parent_id)
        dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in cfg_parent_proc.columns}
        dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
        dic_rename = {col: dic_parent_cfg_cols[dic_cols[col]].column_name for col in df.columns}
        df = df.rename(columns=dic_rename)
        orig_df = orig_df.rename(columns=dic_rename)
        df_error = df_error.rename(columns=dic_rename)
        proc_id = parent_id
        cfg_columns = cfg_parent_proc.columns
        get_date_col = cfg_parent_proc.get_date_col()

    df_duplicate = remove_duplicates(df, orig_df, df_error, proc_id, get_date_col, cfg_columns)
    save_res = import_data(df, proc_id, get_date_col, cfg_columns, job_info)

    return save_res, df_error, df_duplicate


def yield_job_info(job_info, csv_file_name, imported_row=0, save_res=0, df_error_cnt=0, err_msgs=None):
    try:
        job_info.target = csv_file_name
        job_info.err_msg = None
        job_info.status = JobStatus.DONE
        gen_import_job_info(
            job_info,
            save_res,
            end_time=get_current_timestamp(),
            imported_count=imported_row,
            err_cnt=df_error_cnt,
            err_msgs=err_msgs,
        )
        yield job_info
    except Exception:
        pass


@log_execution_time()
def convert_csv_timezone(df, get_date_col):
    datetime_val = get_datetime_val(df[get_date_col])
    is_timezone_inside, csv_timezone, utc_offset = get_time_info(datetime_val, None)
    # convert to utc if there is not utc in df
    if utc_offset != 0:
        df[get_date_col] = convert_df_col_to_utc(df, get_date_col, is_timezone_inside, csv_timezone, utc_offset)
    # convert to string
    df[get_date_col] = convert_df_datetime_to_str(df, get_date_col)


@log_execution_time()
def convert_eu_decimal(df: DataFrame, df_col, data_type):
    if data_type == DataType.REAL_SEP.name:
        df[df_col] = df[df_col].astype(str).str.replace(r'\,+', '', regex=True)

    if data_type == DataType.INTEGER_SEP.name:
        df[df_col] = df[df_col].astype(str).str.replace(r'\,+', '', regex=True)

    if data_type == DataType.EU_REAL_SEP.name:
        df[df_col] = df[df_col].astype(str).str.replace(r'\.+', '', regex=True).str.replace(r'\,+', '.', regex=True)

    if data_type == DataType.EU_INTEGER_SEP.name:
        df[df_col] = df[df_col].astype(str).str.replace(r'\.+', '', regex=True).str.replace(r'\,+', '.', regex=True)


def write_invalid_records_to_file(
    df_error: DataFrame,
    dic_imported_row,
    dic_sensor,
    df_db,
    proc_cfg,
    transformed_file_delimiter,
    data_src_folder,
    err_msg=None,
):
    idxs = df_error[FILE_IDX_COL].unique()
    for idx in idxs:
        csv_file_name, *_ = dic_imported_row[idx]
        df_error_one_file = df_error[df_error[FILE_IDX_COL] == idx]
        df_error_one_file.drop(FILE_IDX_COL, axis=1, inplace=True)
        df_error_trace = gen_error_output_df(
            csv_file_name,
            dic_sensor,
            get_df_first_n_last(df_error_one_file),
            df_db,
            err_msg,
        )
        write_error_trace(df_error_trace, proc_cfg.name, csv_file_name)
        write_error_import(
            df_error_one_file,
            proc_cfg.name,
            csv_file_name,
            transformed_file_delimiter,
            data_src_folder,
        )
    return True


@log_execution_time()
def write_duplicate_records_to_file(df_duplicate: DataFrame, dic_imported_row, dic_use_cols, proc_name, job_id=None):
    error_msg = DATA_TYPE_DUPLICATE_MSG
    time_str = convert_time(datetime.now(), format_str=DATE_FORMAT_STR_ONLY_DIGIT)[4:-3]
    ip_address = get_ip_address()

    for idx, df in df_duplicate.groupby(FILE_IDX_COL):
        csv_file_path_name, *_ = dic_imported_row[idx]
        csv_file_name = get_basename(csv_file_path_name) if csv_file_path_name else ''

        df.drop(FILE_IDX_COL, axis=1, inplace=True)
        df_output = gen_duplicate_output_df(
            dic_use_cols,
            get_df_first_n_last(df),
            csv_file_name=csv_file_path_name,
            error_msgs=error_msg,
        )

        write_duplicate_import(df_output, [proc_name, csv_file_name, 'Duplicate', job_id, time_str, ip_address])


def get_same_cols_from_dfs(all_cols, df_cols):
    all_cols = set(all_cols)
    df_cols = set(df_cols)
    unused_cols = all_cols - df_cols
    all_cols = all_cols - unused_cols

    return list(all_cols)


def is_header_contains_invalid_chars(header_names: list[str]) -> bool:
    first_row = ''.join(header_names)
    total_num = len(first_row)
    subst_num = len(re.findall(r'[\d\s\t,.:;\-/ ]', first_row))
    nchars = subst_num * 100 / total_num
    return nchars > NUM_CHARS_THRESHOLD


def gen_dummy_header(header_names, data_details=None, skip_head=None):
    """Generate dummy header for current data source
    - if skip_head is not provided (None) or skip_head > 0:
        generate dummy header if and only if number of invalid chars > 90%
    - if skip_head = 0:
        always generate dummy header
    @param header_names:
    @param data_details:
    @param skip_head:
    @return:
    """
    dummy_header = False
    partial_dummy_header = False
    org_header = header_names.copy()

    is_blank = skip_head is None
    is_auto_generate_dummy_header = is_header_contains_invalid_chars(header_names)

    # auto generate dummy header rules
    is_gen_from_blank_skip = is_blank and is_auto_generate_dummy_header
    is_gen_from_zero_skip = not is_blank and skip_head == 0
    is_gen_from_number_skip = not is_blank and skip_head > 0 and is_auto_generate_dummy_header
    if is_gen_from_blank_skip or is_gen_from_zero_skip or is_gen_from_number_skip:
        if data_details:
            data_details = [header_names] + data_details
        header_names = ['col'] * len(header_names)
        dummy_header = True

    if EMPTY_STRING in header_names:
        header_names = [name or 'col' for name in header_names]
        partial_dummy_header = True

    return org_header, header_names, dummy_header, partial_dummy_header, data_details


def merge_is_get_date_from_date_and_time(df, get_date_col, date_main_col, time_main_col, is_csv_or_v2=True):
    from ap.api.setting_module.services.data_import import convert_df_col_to_utc

    series_x = df[date_main_col]
    series_y = df[time_main_col]
    is_x_string = not pd.api.types.is_datetime64_any_dtype(series_x)
    is_y_string = not pd.api.types.is_datetime64_any_dtype(series_y)

    result_format = f'{DATE_FORMAT}{TIME_FORMAT_WITH_SEC}'

    # extract date format
    if not is_x_string:
        series_x = series_x.dt.strftime(DATE_FORMAT)

    # extract time format
    if not is_y_string:
        series_y = series_y.dt.strftime(TIME_FORMAT_WITH_SEC)

    get_date_series = pd.to_datetime(
        series_x + series_y,
        format=result_format,
        exact=True,
        errors='coerce',
    )
    df[get_date_col] = get_date_series
    # convert csv timezone
    if is_csv_or_v2:  # TODO: Confirm convert db timezone
        datetime_val = get_datetime_val(df[get_date_col])
        is_timezone_inside, csv_timezone, utc_offset = get_time_info(datetime_val, None)
        df[get_date_col] = convert_df_col_to_utc(df, get_date_col, is_timezone_inside, csv_timezone, utc_offset)
        df[get_date_col] = remove_timezone_inside(df[get_date_col], is_timezone_inside)


def add_column_file_name(df, file_path):
    file_name = os.path.basename(file_path)
    df[FILE_NAME] = file_name
