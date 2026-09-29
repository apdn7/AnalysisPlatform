from __future__ import annotations

import math
import os
import os.path
import re
import uuid
from collections.abc import Generator, Iterable, Iterator
from datetime import datetime
from io import BytesIO
from itertools import chain

import pandas as pd

# pd.options.mode.chained_assignment = None  # default='warn'
from pandas import DataFrame
from pandas.core.dtypes.base import ExtensionDtype

from ap.api.common.services.file_reader import StructuredFileReader
from ap.api.efa.services.etl import csv_transform
from ap.api.setting_module.services import archive_handler
from ap.api.setting_module.services.archive_handler import (
    FileEntry,
    RecursiveArchiveProcessor,
)
from ap.api.setting_module.services.data_import import (
    FILE_IDX_COL,
    INDEX_COL,
    NA_VALUES,
    RECORD_PER_COMMIT,
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
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job, finished_transaction_import
from ap.common.common_utils import (
    convert_eu_decimal_series,
    convert_time,
    detect_encoding,
    detect_file_encoding,
    get_csv_delimiter,
    get_current_timestamp,
    get_file_modify_time,
)
from ap.common.constants import (
    ALMOST_COMPLETE_PERCENT,
    ARCHIVE_MAX_FILES_DEFAULT,
    COMPLETED_PERCENT,
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_MSG,
    DATA_TYPE_ESTIMATION_LIMIT,
    DATE_FORMAT,
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_ONLY_DIGIT,
    DATETIME_DUMMY,
    EMPTY_ARCHIVE_ERROR_MSG,
    EMPTY_CHECK_TIME_PERIOD,
    EMPTY_STRING,
    FILE_NAME,
    IMPORT_CSV_EMPTY_DATA,
    NUM_CHARS_THRESHOLD,
    TIME_FORMAT_WITH_SEC,
    AnnounceEvent,
    CSVExtTypes,
    DataType,
    DBType,
    JobStatus,
    JobType,
)
from ap.common.datetime_format_utils import convert_datetime_format
from ap.common.disk_usage import get_ip_address
from ap.common.jobs.job_info_schema import CsvImportJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventQueue
from ap.common.path_utils import filter_files_by_select_condition, get_basename, get_files
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.scheduler import scheduler_app_context
from ap.common.services.csv_content import (
    EncodingException,
    get_limit_records,
    read_csv_with_transpose,
)
from ap.common.services.csv_header_wrapr import (
    add_suffix_if_duplicated,
    gen_colsname_for_duplicated,
    transform_duplicated_col_suffix_to_pandas_col,
)
from ap.common.services.normalization import normalize_list, normalize_str
from ap.common.timezone_utils import (
    add_days_from_utc,
    gen_dummy_datetime,
    get_next_datetime_value,
    get_time_info,
)
from ap.conversion_formula import conversion_formula
from ap.setting_module.models import (
    CfgDataSourceCSV,
    CfgProcess,
    JobManagement,
)
from ap.setting_module.services.background_process import JobInfo, send_processing_info
from ap.trace_data.transaction_model import (
    ImportProcessedSignatureTable,
    TransactionData,
    init_processed_signature_table,
)


@scheduler_app_context
def import_csv_job(
    process_id: int,
    job_management: JobManagement,
    is_user_request: bool = False,
    register_by_file_request_id: str | None = None,
):
    """Scheduler job import csv"""
    gen = import_csv(process_id, register_by_file_request_id=register_by_file_request_id, job_management=job_management)
    send_processing_info(
        gen,
        job_management=job_management,
        after_success_func=finished_transaction_import,
        after_success_func_kwargs={'process_id': process_id, 'is_user_request': is_user_request, 'publish': True},
    )
    add_gen_proc_link_job(process_id=process_id, is_user_request=is_user_request, publish=True)


def get_config_sensor(cfg_process: CfgProcess):
    # check new adding column, save.
    return {col.column_name: col for col in cfg_process.get_transaction_process_columns()}


class ArchiveImportContextManager:
    """Track archive entries by import index and finalize them safely."""

    def __init__(self) -> None:
        self._contexts: dict[int, tuple[RecursiveArchiveProcessor, FileEntry]] = {}

    def register(
        self,
        idx: int,
        archive_processor: RecursiveArchiveProcessor | None,
        archive_entry: FileEntry | None,
    ) -> None:
        if archive_processor is None or archive_entry is None:
            return
        self._contexts[idx] = (archive_processor, archive_entry)

    def mark_success(self, idx: int) -> None:
        context = self._contexts.pop(idx, None)
        if context is None:
            return
        processor, entry = context
        processor.mark_success(entry)

    def mark_failed(self, idx: int, err_msg: str) -> None:
        context = self._contexts.pop(idx, None)
        if context is None:
            return
        processor, entry = context
        processor.mark_failed(entry, err_msg)

    def mark_all_failed(self, indexes: Iterable[int], err_msg: str) -> None:
        for idx in list(indexes):
            self.mark_failed(idx, err_msg)


@log_execution_time()
def import_csv(
    proc_id,
    record_per_commit=RECORD_PER_COMMIT,
    register_by_file_request_id: str | None = None,
    job_management: JobManagement = JobManagement(),
):
    """Csv files import

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
    job_management.info = CsvImportJobInfo()

    data_register_data = {
        'RegisterByFileRequestID': register_by_file_request_id,
        'status': JobStatus.PROCESSING.name,
        'is_first_imported': False,  # show loading status after register a import job
    }
    EventQueue.put(EventBackgroundAnnounce(data=data_register_data, event=AnnounceEvent.DATA_REGISTER))

    # get db info
    proc_cfg: CfgProcess = CfgProcess.get_proc_by_id(proc_id)
    if not proc_cfg:
        return

    # Isolate object that not link to SQLAlchemy to avoid changes in other session
    proc_cfg = proc_cfg.clone()
    data_src: CfgDataSourceCSV = proc_cfg.data_source.csv_detail
    is_v2_datasource = is_v2_data_source(ds_type=proc_cfg.data_source.type)
    cfg_parent_proc: CfgProcess | None = CfgProcess.get_proc_by_id(proc_cfg.parent_id) if proc_cfg.parent_id else None

    trans_data = TransactionData(proc_cfg)
    with (
        TxnDataConnection(process_id=proc_id, readonly_transaction=False) as data_con,
        TxnMetaConnection(process_id=proc_id) as meta_con,
    ):
        # TODO: we want to remove `create_table` here, so that `data_con` doesn't need to access
        #  but there are many test cases, call `import_csv` alone. So we need to create table here
        #  we can remove this later
        trans_data.create_table(data_con=data_con, meta_con=meta_con)
        # get import files
        import_targets, no_data_files, toast_skip = get_import_target_files(proc_id, data_src, trans_data, meta_con)

    if not import_targets:
        yield 100
        return

    # get current job id
    t_job_management: JobManagement = JobManagement.get_last_job_of_process(proc_id, JobType.CSV_IMPORT.name)
    job_id = int(t_job_management.id) if t_job_management else None

    import_target_iter = _iter_import_targets_for_processing(proc_id, job_id, import_targets)
    # Get a single file path to detect/check CSV structure before the main loop.
    # This helper may consume the first streamed item (archive-only case) and then
    # prepend it back, so iteration order/data is preserved.
    import_target_iter, check_structure_target = _resolve_check_structure_target(import_targets, import_target_iter)

    # csv delimiter
    csv_delimiter = get_csv_delimiter(data_src.delimiter)

    # get header
    headers = data_src.get_column_names_with_sorted()
    dic_use_cols = get_config_sensor(proc_cfg)
    use_dummy_datetime = False
    dummy_datetime_col = DATETIME_DUMMY
    file_name_col = FILE_NAME
    for col in proc_cfg.columns:
        if col.is_dummy_datetime:
            use_dummy_datetime = True
            dummy_datetime_col = col.column_name

        if col.is_file_name:
            file_name_col = col.column_name

    latest_record = None
    # find last records in case of dummy datetime is used
    if use_dummy_datetime:
        with TxnDataConnection(process_id=proc_id, readonly_transaction=True) as data_con:
            latest_record = trans_data.get_max_date_time_by_process_id(data_con)
            if latest_record:
                latest_record = add_days_from_utc(latest_record, 1)

    # get GET_DATE
    get_date_col = proc_cfg.get_date_col()

    # depend on file type (efa1,2,3,4 or normal) , choose right header
    default_csv_param = {}
    use_col_names = []
    skip_head = data_src.skip_head if data_src else None

    is_file_checker = data_src.is_file_checker
    file_reader = StructuredFileReader(
        delimiter=csv_delimiter,
        encoding=data_src.encoding,
        skip_head=data_src.skip_head,
        is_transpose=data_src.is_transpose,
        limit=(data_src.n_rows or DATA_TYPE_ESTIMATION_LIMIT),  # to preview only, update when need
        etl_func=data_src.etl_func,
        is_file_checker=is_file_checker,
    )
    # To preview data
    if check_structure_target:
        file_reader.read(target_file=check_structure_target)

    is_invalid_csv = import_targets and not file_reader.is_valid and not data_src.etl_func
    is_same_number_of_rows_and_headers = not file_reader.is_mismatched_cols

    # EFA or abnormal CSV (mismatched columns file is excluding)
    if is_file_checker or (is_invalid_csv and is_same_number_of_rows_and_headers):
        is_abnormal = True
        default_csv_param['names'] = headers
        use_col_names = headers
        if use_dummy_datetime and dummy_datetime_col in use_col_names:
            use_col_names.remove(dummy_datetime_col)
        # check for skip_head = None to prevent TypeError when adding 1
        data_first_row = (skip_head if skip_head is not None else 0) + 1
        head_skips = list(range(data_first_row))
    else:
        # normal csv or mismatched columns
        is_abnormal = False
        data_first_row = (skip_head if skip_head is not None else 0) + 1
        head_skips = list(range(skip_head if skip_head is not None else 0))

    if is_v2_datasource:
        is_abnormal = False

    job_management.info.is_abnormal = is_abnormal

    total_percent = 0
    percent_per_file = 100 / max(1, len(import_targets))
    dic_imported_row = {}
    archive_context_manager = ArchiveImportContextManager()
    df = pd.DataFrame()

    # init job information object
    job_info = JobInfo()
    job_info.import_type = JobType.CSV_IMPORT.name
    job_info.empty_files = []

    # file can not transform by R script
    transformed_file_delimiter = csv_delimiter
    for idx, csv_file_name in enumerate(no_data_files):
        job_info.status = JobStatus.DONE
        job_info.empty_files = [csv_file_name]
        job_management.info.empty_files.append(csv_file_name)
        is_safe_interrupt = idx == len(no_data_files) - 1
        yield from yield_job_info(job_info, csv_file_name, is_safe_interrupt=is_safe_interrupt)
        job_info.empty_files = []

    job_info.job_id = job_id

    dummy_datetime_from = latest_record
    df_db_latest_records = None

    is_first_chunk = True
    error_type = None
    chunk_size = record_per_commit * 100
    origin_default_csv_param = default_csv_param.copy()
    total_imported_row = 0
    # `archive_processor` is the RecursiveArchiveProcessor handling the current archive source.
    # `archive_entry` is the current FileEntry inside that archive (both are None for non-archive files).
    for idx, (csv_file_name, transformed_file, is_temp_target, archive_processor, archive_entry) in enumerate(
        import_target_iter
    ):
        # Because each file has a different structure, it will read according to different parameters
        default_csv_param = origin_default_csv_param.copy()
        job_info.target = csv_file_name
        import_target_info = CsvImportJobInfo.CsvImportTargetInfo()
        job_management.info.import_targets.append(import_target_info)
        import_target_info.file_name = csv_file_name
        # `transformed_file` may be an Exception. Keep this field string-only
        # to avoid serialization failures when persisting job info.
        import_target_info.transform_file = transformed_file if isinstance(transformed_file, str) else ''

        if not dic_imported_row:
            job_info.start_tm = get_current_timestamp()

        # Keep per-item archive context so later chunk flush / exception handlers
        # can still mark this archive entry as success/failed reliably.
        archive_context_manager.register(idx, archive_processor, archive_entry)

        # R error check
        if isinstance(transformed_file, Exception):
            if str(transformed_file) == EMPTY_ARCHIVE_ERROR_MSG:
                job_info.status = JobStatus.DONE
                job_info.empty_files = [csv_file_name]
                job_management.info.empty_files.append(csv_file_name)
                yield from yield_job_info(job_info, csv_file_name, is_safe_interrupt=True)
                job_info.empty_files = []
                continue

            yield from yield_job_info(job_info, csv_file_name, err_msgs=str(transformed_file))
            import_target_info.error = str(transformed_file)
            error_type = DATA_TYPE_ERROR_MSG
            continue

        try:
            # Reset per-file reader state that may be changed by preview/file-checker.
            # Import logic below expects to evaluate each target with datasource defaults.
            file_reader.update(headers=[], skip_head=data_src.skip_head, skip_tail=data_src.skip_tail or 0)
            try:
                # To get metadata from transformed file
                file_header, file_data = (
                    file_reader.read(transformed_file)
                    if file_reader.is_mismatched_cols
                    else file_reader.read_data_normal_file(transformed_file)
                )
            except (EncodingException, UnicodeDecodeError, Exception) as e:
                # get error_info job
                error_info = JobInfo()
                error_info.job_id = job_id
                error_info.import_type = JobType.CSV_IMPORT.name
                error_info.dic_imported_row = {0: (csv_file_name, 0)}

                # to save error file into transaction import history
                save_failed_import_history(proc_id, error_info, str(e))
                # yield to show error file in toast
                yield from yield_job_info(error_info, csv_file_name)

                # go to next file if it is encoding error
                continue
            transformed_file_delimiter, encoding = file_reader.delimiter, file_reader.encoding
            import_target_info.encoding = encoding
            # check missing columns
            partial_dummy_header = False

            # Both normal and abnormal CSV sources share this parse flow.
            should_parse_file = True
            if should_parse_file:
                dic_csv_cols = None
                dic_org_csv_cols = None
                csv_cols = headers
                # in case if v2, assume that there is not missing columns from v2 files
                if not is_v2_datasource and not is_abnormal:
                    # Copy file_reader.header to avoid shared reference
                    org_csv_cols = list(file_header)
                    # to check missing columns
                    if data_src.dummy_header:
                        # generate column name if there is not header in file
                        org_csv_cols, csv_cols, *_ = gen_dummy_header(org_csv_cols, skip_head=data_src.skip_head)
                        csv_cols, _ = gen_colsname_for_duplicated(csv_cols)
                    else:
                        # need to convert header in case of transposed
                        if data_src.is_transpose:
                            _, csv_cols, *_ = gen_dummy_header(org_csv_cols)
                            csv_cols, _ = gen_colsname_for_duplicated(csv_cols)
                        else:
                            # for the column names with only spaces, we need to generate dummy headers for them
                            _, csv_cols, _, partial_dummy_header, *_ = gen_dummy_header(org_csv_cols)
                            csv_cols = normalize_list(csv_cols)
                        # try to convert ➊ irregular number from csv columns
                        csv_cols = [normalize_str(col) for col in csv_cols]

                    # add file for add suffix same show latest record
                    if proc_cfg.is_show_file_name:
                        csv_cols.append(FILE_NAME)
                        org_csv_cols.append(FILE_NAME)
                    if use_dummy_datetime:
                        csv_cols.insert(0, DATETIME_DUMMY)
                        org_csv_cols.insert(0, DATETIME_DUMMY)

                    csv_cols, with_dupl_cols, _is_gen_col = add_suffix_if_duplicated(csv_cols)
                    if not partial_dummy_header:
                        partial_dummy_header = _is_gen_col
                    dic_csv_cols = dict(zip(csv_cols, with_dupl_cols, strict=False))
                    # add suffix to origin csv cols
                    org_csv_cols, *_ = add_suffix_if_duplicated(org_csv_cols)
                    dic_org_csv_cols = dict(zip(csv_cols, org_csv_cols, strict=False))

                # missing_cols = set(dic_use_cols).difference(csv_cols)
                # find same columns between csv file and db
                valid_columns = list(set(dic_use_cols).intersection(csv_cols))
                # re-arrange cols
                valid_columns = [col for col in csv_cols if col in valid_columns]
                dic_valid_csv_cols = dict(zip(valid_columns, [False] * len(valid_columns), strict=False))
                missing_cols = [] if (valid_columns or is_abnormal) else list(dic_use_cols.keys())

                if not is_v2_datasource and not is_abnormal:
                    valid_with_dupl_cols = [dic_csv_cols[col] for col in valid_columns]
                    dic_valid_csv_cols = dict(zip(valid_columns, valid_with_dupl_cols, strict=False))

                if dummy_datetime_col in missing_cols:
                    # remove dummy col before check
                    missing_cols.remove(dummy_datetime_col)

                if missing_cols and not is_v2_datasource:
                    err_msg = f"File {transformed_file} doesn't contain expected columns: {list(set(dic_use_cols))}"

                    import_target_info.error = err_msg

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
                        df_db_latest_records = get_latest_records(proc_cfg)
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

                    archive_context_manager.mark_failed(idx, err_msg)
                    yield from yield_job_info(job_info, csv_file_name, err_msgs=err_msg)
                    error_type = DATA_TYPE_ERROR_MSG
                    continue

                # default_csv_param['usecols'] = [i for i, col in enumerate(valid_columns) if col]
                if not data_src.dummy_header and not partial_dummy_header and not is_abnormal:
                    default_csv_param['usecols'] = transform_duplicated_col_suffix_to_pandas_col(
                        dic_valid_csv_cols,
                        dic_org_csv_cols,
                    )
                    use_col_names = [col for col in valid_columns if col]
                    # remove file name in usecols after add suffix
                    if use_dummy_datetime:
                        default_csv_param['usecols'] = default_csv_param['usecols'][1:]
                        if dummy_datetime_col in use_col_names:
                            use_col_names.remove(dummy_datetime_col)

                    if proc_cfg.is_show_file_name:
                        default_csv_param['usecols'] = default_csv_param.get('usecols')[:-1]
                        use_col_names = use_col_names[:-1]
                else:
                    # dummy header
                    default_csv_param['names'] = csv_cols
                    if use_dummy_datetime:
                        default_csv_param['names'] = default_csv_param['names'][1:]
                    if proc_cfg.is_show_file_name:
                        default_csv_param['names'] = default_csv_param.get('names')[:-1]

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

                # add more dtype columns in names
                if 'names' in default_csv_param:
                    for col_name in default_csv_param['names']:
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
                        archive_context_manager.mark_success(idx)
                        continue
                        # raise NotImplementedError

                    if df_one_file.empty:
                        archive_context_manager.mark_success(idx)
                        continue

                    df_one_file, has_remaining_cols = prepare_to_import_v2_df(df_one_file, proc_cfg, datasource_type)

                    if has_remaining_cols:
                        dic_use_cols = get_config_sensor(proc_cfg)

                elif not is_file_checker:
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
                        is_partial_dummy_header=partial_dummy_header,
                    )
                    # validate column name
                    validate_columns(dic_use_cols, df_one_file.columns, use_dummy_datetime, dummy_datetime_col)
                elif is_file_checker:
                    # update setting to get all records from file
                    file_reader.update(
                        filenames=[transformed_file],
                        max_results=None,
                        limit=None,
                        headers=[],
                        preview=False,
                    )
                    # extract data for EFA by file_checker
                    file_header, file_data = file_reader.read_data_with_file_checker()
                    if file_reader.is_valid:
                        df_one_file = pd.DataFrame(file_data, columns=file_header)
                        dic_use_cols_for_abnormal = dic_use_cols.copy()
                        if use_dummy_datetime and dummy_datetime_col in dic_use_cols_for_abnormal:
                            dic_use_cols_for_abnormal.pop(dummy_datetime_col)
                        # remove unused columns
                        df_one_file = df_one_file[list(dic_use_cols_for_abnormal)]

                file_record_count = len(df_one_file)
                import_target_info.file_record_count = file_record_count

                if proc_cfg.is_import_file_name:
                    df_one_file = add_column_file_name(df_one_file, csv_file_name, file_name_col=file_name_col)

                # Save history even if the file is empty
                dic_imported_row[idx] = (csv_file_name, file_record_count)

                # no records
                if not file_record_count:
                    # Proceed to read the next file without showing a toast message.
                    if csv_file_name in toast_skip:
                        archive_context_manager.mark_success(idx)
                        continue

                    job_info.status = JobStatus.DONE
                    job_info.empty_files = [csv_file_name]
                    job_management.info.empty_files.append(csv_file_name)
                    yield from yield_job_info(job_info, csv_file_name)
                    job_info.empty_files = []
                    archive_context_manager.mark_success(idx)
                    continue

                # add 3 columns machine, line, process for efa 1,2,4
                if is_abnormal and not is_v2_datasource:
                    header_source_file = transformed_file if is_temp_target else csv_file_name
                    cols, vals = csv_data_with_headers(header_source_file, data_src)
                    df_one_file[cols] = vals
                    dic_use_cols_for_abnormal = dic_use_cols.copy()
                    if use_dummy_datetime and dummy_datetime_col in dic_use_cols_for_abnormal:
                        dic_use_cols_for_abnormal.pop(dummy_datetime_col)
                    # remove unused columns
                    df_one_file = df_one_file[list(dic_use_cols_for_abnormal)]

                if use_dummy_datetime and dummy_datetime_col not in df_one_file.columns:
                    df_one_file = gen_dummy_datetime(
                        df_one_file,
                        dummy_datetime_from,
                        dummy_datetime_col=dummy_datetime_col,
                    )
                    dummy_datetime_from = get_next_datetime_value(df_one_file.shape[0], dummy_datetime_from)

                # mark file
                df_one_file[FILE_IDX_COL] = idx

                # merge df
                df = pd.concat([df, df_one_file], ignore_index=True)

                # Flush only when chunk threshold is reached.
                should_import_now = _should_import_now(
                    df_size=df.size,
                    chunk_size=chunk_size,
                    _is_temp_target=is_temp_target,
                )
                if not should_import_now:
                    continue

                # calc percent
                percent_per_commit = percent_per_file * len(dic_imported_row)

                job_info.dic_imported_row = dic_imported_row
                job_info.import_type = JobType.CSV_IMPORT.name
                # do import
                save_res, df_error, df_duplicate = import_df(
                    proc_cfg,
                    df,
                    dic_use_cols,
                    get_date_col,
                    job_info,
                    trans_data,
                    parent_cfg_process=cfg_parent_proc,
                )
                total_imported_row += save_res
                if is_first_chunk:
                    if register_by_file_request_id:
                        data_register_data = {
                            'RegisterByFileRequestID': register_by_file_request_id,
                            'status': JobStatus.PROCESSING.name,
                            'process_id': proc_id,
                            'is_first_imported': True,
                            'use_dummy_datetime': use_dummy_datetime,
                        }
                        EventQueue.put(
                            EventBackgroundAnnounce(
                                job_id=f'{AnnounceEvent.DATA_REGISTER.name}_{proc_id}',
                                data=data_register_data,
                                event=AnnounceEvent.DATA_REGISTER,
                            ),
                        )
                    is_first_chunk = False

                df_error_cnt = len(df_error)

                if df_error_cnt:
                    job_management.info.error(f'{df_error_cnt} error record count')

                    if df_db_latest_records is None:
                        df_db_latest_records = get_latest_records(proc_cfg)
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
                    job_management.info.error(f'{len(df_duplicate)} duplicated record count')

                    error_type = DATA_TYPE_DUPLICATE_MSG
                    write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

                total_percent = set_csv_import_percent(job_info, total_percent, percent_per_commit)
                for _idx, (_csv_file_name, _imported_row) in dic_imported_row.items():
                    # If this item corresponds to the current import_targets index,
                    # it is safe to interrupt after yielding this update.
                    is_safe_interrupt = _idx == idx
                    yield from yield_job_info(
                        job_info,
                        _csv_file_name,
                        _imported_row,
                        save_res,
                        df_error_cnt,
                        is_safe_interrupt=is_safe_interrupt,
                    )
                    archive_context_manager.mark_success(_idx)

                # reset df (important!!!)
                df = pd.DataFrame()
                dic_imported_row = {}
        except Exception as ex:
            err_msg = str(ex)
            import_target_info.error = err_msg
            job_management.info.error(err_msg)
            error_type = DATA_TYPE_ERROR_MSG
            archive_context_manager.mark_all_failed(dic_imported_row.keys(), err_msg)
            if idx not in dic_imported_row:
                archive_context_manager.mark_failed(idx, err_msg)
            yield from yield_job_info(job_info, csv_file_name, err_msgs=err_msg)
            continue
        finally:
            _cleanup_import_temp_file(transformed_file, is_temp_target)

    job_info.dic_imported_row = dic_imported_row

    # do last import
    if len(df):
        try:
            job_info.dic_imported_row = dic_imported_row
            job_info.import_type = JobType.CSV_IMPORT.name
            save_res, df_error, df_duplicate = import_df(
                proc_cfg,
                df,
                dic_use_cols,
                get_date_col,
                job_info,
                trans_data,
                parent_cfg_process=cfg_parent_proc,
            )
            total_imported_row += save_res
            if register_by_file_request_id:
                data_register_data = {
                    'RegisterByFileRequestID': register_by_file_request_id,
                    'status': JobStatus.DONE.name,
                    'process_id': proc_id,
                    'is_first_imported': is_first_chunk,
                    'use_dummy_datetime': use_dummy_datetime,
                }
                EventQueue.put(
                    EventBackgroundAnnounce(
                        job_id=f'{AnnounceEvent.DATA_REGISTER.name}_{proc_id}',
                        data=data_register_data,
                        event=AnnounceEvent.DATA_REGISTER,
                    ),
                )

            df_error_cnt = len(df_error)
            if df_error_cnt:
                job_management.info.error(f'{df_error_cnt} error record count found in last import')
                error_type = DATA_TYPE_ERROR_MSG
                if df_db_latest_records is None:
                    df_db_latest_records = get_latest_records(proc_cfg)
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
                job_management.info.error(f'{len(df_duplicate)} duplicated record count found in last import')
                write_duplicate_records_to_file(df_duplicate, dic_imported_row, dic_use_cols, proc_cfg.name, job_id)

            for idx, (_csv_file_name, _imported_row) in enumerate(dic_imported_row.values()):
                is_safe_interrupt = idx == len(dic_imported_row) - 1
                yield from yield_job_info(
                    job_info,
                    _csv_file_name,
                    _imported_row,
                    save_res,
                    df_error_cnt,
                    is_safe_interrupt=is_safe_interrupt,
                )

            for context_idx in list(dic_imported_row):
                archive_context_manager.mark_success(context_idx)
        except Exception as ex:
            err_msg = str(ex)
            archive_context_manager.mark_all_failed(dic_imported_row.keys(), err_msg)
            raise

    job_management.info.imported_row = total_imported_row
    if total_imported_row == 0:
        # if there is empty data in all files
        error_type = IMPORT_CSV_EMPTY_DATA

    if error_type:
        job_management.info.error(error_type)
        save_failed_import_history(proc_id, job_info, error_type)

    yield 100


def set_csv_import_percent(job_info, total_percent, percent_per_chunk):
    total_percent += percent_per_chunk
    job_info.percent = math.floor(total_percent)
    if job_info.percent >= COMPLETED_PERCENT:
        job_info.percent = ALMOST_COMPLETE_PERCENT

    return total_percent


def _is_archive_file_path(file_path: str | Exception) -> bool:
    return isinstance(file_path, str) and archive_handler.is_supported_archive_path(file_path)


type StreamedImportFileResult = tuple[
    str,
    str | Exception,
    bool,
    RecursiveArchiveProcessor | None,
    FileEntry | None,
]  # (virtual_path, file_path or error, is_temp_file, processor, entry)


def _cleanup_import_temp_file(file_path: str | Exception, is_temp_file: bool) -> None:
    if not is_temp_file or not isinstance(file_path, str):
        return
    if os.path.exists(file_path):
        os.remove(file_path)


def _resolve_check_structure_target(
    import_targets: list[tuple[str, str | Exception]],
    import_target_iter: Iterator[StreamedImportFileResult],
) -> tuple[Iterator[StreamedImportFileResult], str | None]:
    """Resolve file path used for structure check without losing iterator items.

    Prefer transformed non-archive paths from original targets.
    If all original targets are archives, fallback to the first streamed item
    (typically an extracted member path) and put it back to the iterator.
    """
    check_structure_target = next(
        (
            transformed_file
            for _, transformed_file in reversed(import_targets)
            if isinstance(transformed_file, str) and not _is_archive_file_path(transformed_file)
        ),
        None,
    )
    if check_structure_target is not None:
        return import_target_iter, check_structure_target

    first_item = next(import_target_iter, None)
    if first_item is None:
        return import_target_iter, None

    _, transformed_file, *_ = first_item
    if isinstance(transformed_file, str) and not _is_archive_file_path(transformed_file):
        check_structure_target = transformed_file

    return chain([first_item], import_target_iter), check_structure_target


def _should_import_now(df_size: int, chunk_size: int, _is_temp_target: bool) -> bool:
    """Decide whether buffered rows should be imported now."""
    return df_size >= chunk_size


def _is_root_archive_signature_success(process_id: int, archive_path: str) -> bool:
    """Return True when root archive signature was already marked success."""
    signature = archive_handler.build_archive_root_signature(archive_path)
    if signature is None:
        return False

    return ImportProcessedSignatureTable.exists_success(
        process_id=process_id,
        virtual_path=signature.virtual_path,
        file_modified_time=signature.file_modified_time,
    )


def _iter_import_targets_for_processing(
    proc_id: int,
    job_id: int | None,
    import_targets: list[tuple[str, str | Exception]],
) -> Generator[StreamedImportFileResult, None, None]:
    """Yield import targets lazily.

    Non-archive files are yielded directly.
    Archive files are expanded per archive and yielded as extracted temp files.
    """
    # Archive dedup queries (`exists_success`) rely on this table.
    # Ensure schema exists before any archive signature checks.
    init_processed_signature_table(proc_id)

    target_extensions = {CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value}
    for csv_file_name, transformed_file in import_targets:
        if not _is_archive_file_path(transformed_file):
            yield csv_file_name, transformed_file, False, None, None
            continue

        if _is_root_archive_signature_success(proc_id, transformed_file):
            continue

        processor = RecursiveArchiveProcessor(
            process_id=proc_id,
            job_id=job_id,
            archive_path=transformed_file,
            target_extensions=target_extensions,
            max_files=ARCHIVE_MAX_FILES_DEFAULT,
        )
        matched_files = 0
        try:
            for entry in processor.iter_streaming_entries():
                matched_files += 1
                yield entry.virtual_path, entry.temp_path, True, processor, entry
        except Exception as ex:
            yield csv_file_name, ex, False, None, None
            continue

        if matched_files == 0 and not processor.temp_files:
            yield csv_file_name, Exception(EMPTY_ARCHIVE_ERROR_MSG), False, None, None


@log_execution_time()
def get_last_csv_import_info(trans_data: TransactionData, meta_con: SQLite3) -> tuple[dict[str, str], dict[str, str]]:
    """Get latest csv import info"""
    latest_import_files = trans_data.get_import_history_latest_done_files(meta_con)
    dic_imported_file = {rec.file_name: rec.start_tm for rec in latest_import_files}
    csv_fatal_imports = trans_data.get_import_history_last_fatal(meta_con)
    # error files
    dic_fatal_file = {rec.file_name: rec.start_tm for rec in csv_fatal_imports}

    return dic_imported_file, dic_fatal_file


def get_file_metadata(file_name, dic_success_file: dict | None = None) -> tuple[any, any]:
    _modified_date = get_file_modify_time(file_name)
    _imported_datetime = dic_success_file.get(file_name)
    modified_datetime = datetime.strptime(_modified_date, DATE_FORMAT_STR)
    imported_datetime = datetime.strptime(_imported_datetime, DATE_FORMAT_STR) if _imported_datetime else None
    return modified_datetime, imported_datetime


@log_execution_time()
def filter_import_target_file(proc_id, all_files, dic_success_file: dict, dic_error_file: dict, etl_func=None):
    """Filter import target file base on last import job

    Arguments:
        all_files {[type]} -- [description]
        dic_success_file {dict} -- [description]
        dic_error_file {dict} -- [description]

    Returns:
        [type] -- [description]
    """
    has_transform_targets = []
    no_transform_targets = []
    toast_skip = []
    for file_name in all_files:
        if file_name in dic_error_file:
            modified_date, error_datetime = get_file_metadata(file_name, dic_error_file)
            if modified_date <= error_datetime:
                continue

        if file_name in dic_success_file:
            modified_date, imported_datetime = get_file_metadata(file_name, dic_success_file)
            if modified_date <= imported_datetime:
                continue

            # If a previously failed file is now marked as "modified",
            # re-read it. Skip toastr message if no new change within 24h.
            _modify_imported_time_gap = modified_date - imported_datetime
            if _modify_imported_time_gap < EMPTY_CHECK_TIME_PERIOD:
                # Do not stop, because empty files should still be read for re-import.
                # Just skip showing the toast notification if the file remains empty.
                toast_skip.append(file_name)

        # count all rows
        transformed_file = file_name
        # if custom user etl func specified, execute it
        if etl_func:
            transformed_file = csv_transform(file_name, etl_func, proc_id)

        if transformed_file:
            has_transform_targets.append((file_name, transformed_file))
        else:
            no_transform_targets.append(file_name)

    return has_transform_targets, no_transform_targets, toast_skip


@log_execution_time()
def validate_columns(checked_cols, csv_cols, use_dummy_datetime, dummy_datetime_col):
    """
    Check if checked column exists in csv file
    :param use_dummy_datetime:
    :param checked_cols:
    :param csv_cols:
    :return:
    """
    # ng_cols = set(csv_cols) - set(checked_cols)
    valid_cols = list(set(checked_cols).intersection(csv_cols))
    ng_cols = [] if valid_cols else list(csv_cols)
    # remove dummy datetime columns from set to skip validate this column
    if use_dummy_datetime and dummy_datetime_col in ng_cols:
        ng_cols.remove(dummy_datetime_col)
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
    is_partial_dummy_header=False,
):
    # read csv file
    read_csv_param = {}
    if default_csv_param:
        read_csv_param.update(default_csv_param)

    if is_partial_dummy_header:  # skip header
        head_skips = [*head_skips, max(head_skips) + 1] if len(head_skips) else [0]

    read_csv_param.update(
        {
            'skiprows': head_skips + list(range(data_first_row, skip_row + data_first_row)),
        },
    )
    if head_skips and data_src.dummy_header:
        # to avoid issue of header be duplicated at first row
        read_csv_param.update(
            {
                'header': None,
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
            'on_bad_lines': 'skip',
            'encoding': encoding,
            'skip_blank_lines': True,
            'index_col': False,
        },
    )
    # load csv data to dataframe
    try:
        df = read_csv_with_transpose(transformed_file, is_transpose=data_src.is_transpose, **read_csv_param)
    except UnicodeDecodeError:
        try:
            read_csv_param.update({'encoding': 'unicode_escape'})
            df = read_csv_with_transpose(transformed_file, is_transpose=data_src.is_transpose, **read_csv_param)
        except UnicodeDecodeError:
            # prior to pandas 1.3, `encoding_errors` wasn't added, and the default behavior was `replace`
            # after pandas 1.3, `encoding_errors` attribute was added with default value was `raise`
            # see more: <https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html#:~:text=standard%20encodings%20.-,encoding_errorsstr,-%2C%20optional%2C%20default%20%E2%80%98strict>
            read_csv_param.update({'encoding': None, 'encoding_errors': 'replace'})
            df = read_csv_with_transpose(transformed_file, is_transpose=data_src.is_transpose, **read_csv_param)

    df = df.dropna(how='all')

    if col_names and len(col_names) == df.columns.size:
        df.columns = col_names

    col_names = {col: normalize_str(col) for col in df.columns}
    df = df.rename(columns=col_names)

    # skip tail
    if data_src.skip_tail and len(df):
        df = df.drop(df.tail(data_src.skip_tail).index)

    if dic_use_cols:
        # extract columns of df same as data-source
        sub_cols = [col for col in dic_use_cols.keys() if col in df.columns]
        df = df[sub_cols]
    return df


@log_execution_time()
def get_import_target_files(proc_id: int, data_src: CfgDataSourceCSV, trans_data: TransactionData, meta_con: SQLite3):
    dic_success_file, dic_error_file = get_last_csv_import_info(trans_data, meta_con)
    valid_extensions = [
        CSVExtTypes.CSV.value,
        CSVExtTypes.TSV.value,
        CSVExtTypes.SSV.value,
        CSVExtTypes.ZIP.value,
        CSVExtTypes.SEVEN_Z.value,
    ]
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
        # apply File Select Condition (file name / subfolder include-exclude)
        csv_files = filter_files_by_select_condition(
            csv_files,
            data_src.directory,
            file_name_include=data_src.file_name_include,
            file_name_exclude=data_src.file_name_exclude,
            subfolder_include=data_src.subfolder_include,
            subfolder_exclude=data_src.subfolder_exclude,
        )

    # filter target files
    has_trans_targets, no_trans_targets, toast_skip = filter_import_target_file(
        proc_id,
        csv_files,
        dic_success_file,
        dic_error_file,
        data_src.etl_func,
    )
    return has_trans_targets, no_trans_targets, toast_skip


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
    df_import: DataFrame,
    df_origin: DataFrame,
    df_error: DataFrame,
    cfg_process: CfgProcess,
    get_date_col: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return unique_df and duplicated_df
    This performs:
    - remove duplicates on `df_import`
    - get `min_date` and `max_date` from `df_import`
    - get data from database between [min_date, max_date] for duplicated check
    - remove duplicates on `df_import` if it is duplicated with `df_db`
    """
    # remove duplicated on df_import!
    cfg_columns = cfg_process.get_transaction_process_columns()
    dic_cols = {cfg_col.bridge_column_name: cfg_col.column_name for cfg_col in cfg_columns}
    # columns that shouldn't be used for duplicated checks
    ignored_dup_check_columns = [c.column_name for c in cfg_process.get_cols_ignored_by_duplicated_check()]

    # find columns that in both `df` and `dic_cols`, but not on `ignored_columns`
    df_import_subset_columns_dup_check = list(
        set(df_import.columns.tolist()).intersection(dic_cols.values()).difference(ignored_dup_check_columns)
    )
    # remove duplicated on importing columns
    if df_import_subset_columns_dup_check:
        df_import = df_import.drop_duplicates(subset=df_import_subset_columns_dup_check, keep='last')

    # get min max time of df
    start_tm, end_tm = get_min_max_date(df_import, get_date_col)
    if not start_tm and not end_tm:
        return df_import, pd.DataFrame(columns=df_import.columns.tolist())

    # get data from database
    with TxnDataConnection(process_id=cfg_process.id, readonly_transaction=True) as data_con:
        trans_data = TransactionData(cfg_process)
        df_db = trans_data.get_data_for_check_duplicate(data_con, start_tm, end_tm)
        pandas_dtypes = trans_data.get_pandas_column_dtypes(data_con)

    # There is a case that a new column is created in DB but this job still not interrupted yet.
    # In this case, it will throw an error that "new column" is not exist in dic_cols
    # To avoid this, we create df with full columns, then filter out the new column
    transaction_cols = {col: dic_cols[col] for col in df_db.columns if col in dic_cols}
    df_db = df_db[transaction_cols.keys()].rename(columns=transaction_cols)

    # remove duplicate df vs df_db
    # because column name in df and df_db are different, we must rename them pandas_types to contains column_name
    pandas_dtypes = {transaction_cols[c]: data_type for c, data_type in pandas_dtypes.items()}
    duplicated_indexes = get_duplicate_info(
        df_import, df_db, ignore_columns=ignored_dup_check_columns, pandas_dtypes=pandas_dtypes
    )

    if len(duplicated_indexes):
        df_import = df_import.drop(duplicated_indexes, axis=0)

    # Records that don't exist in both `df` and `df_error` are duplicated records.
    is_duplicated = ~(df_origin.index.isin(df_import.index) | df_origin.index.isin(df_error.index))
    df_duplicate = df_origin[is_duplicated]

    return df_import, df_duplicate


@log_execution_time()
def get_min_max_date(df: DataFrame, get_date_col):
    return df[get_date_col].min(), df[get_date_col].max()


@log_execution_time()
def get_duplicate_info(
    df_import: DataFrame, df_db: DataFrame, ignore_columns: list[str], pandas_dtypes: dict[str, ExtensionDtype]
) -> pd.Index:
    """
    Perform duplicated check with:
    - df_import: dataframe to be imported
    - df_db: dataframe inside database
    - ignore_columns: columns that we don't perform duplicated check on (This is `Datetime::key` atm)
    We also convert data type for `df_import` as well!!
    """
    db_column_names = set(df_db.columns) - set(ignore_columns)
    import_column_names = set(df_import.columns)
    same_column_names = list(db_column_names & import_column_names)
    missing_column_names = list(db_column_names - import_column_names)

    if not same_column_names:
        return pd.Index([])

    # fill None if df_csv missing column
    # we set `df_csv` = `df_db` to avoid converting datatype
    df_import[missing_column_names] = df_db[missing_column_names]
    # mark all data None
    df_import[missing_column_names] = None

    df = df_import.copy()

    index_col = str(uuid.uuid4().hex)
    df[index_col] = df.index

    # ↓====== Correct data type in dataFrame ======↓
    for col in df_db.columns:
        if col not in df.columns:
            continue

        if df[col].dtype == df_db[col].dtype:
            continue

        data_type = pandas_dtypes.get(col)
        if not data_type:
            continue

        df[col] = df[col].astype(data_type)
        df_db[col] = df_db[col].astype(data_type)

    # ↑====== Correct data type in dataFrame ======↑

    df_merged = df.merge(df_db, on=list(db_column_names))
    idxs = df_merged[index_col]
    return idxs


@log_execution_time()
def import_df(
    cfg_process: CfgProcess,
    df,
    dic_use_cols,
    get_date_col,
    job_info=None,
    trans_data=None,
    parent_cfg_process: CfgProcess | None = None,
):
    if not len(df):
        return 0, None, None

    # convert types
    df = df.convert_dtypes()

    # Handle calculate data for main::Datetime, main::Serial function column
    from ap.api.setting_module.services.import_function_column import handle_txn_function_columns

    df = handle_txn_function_columns(cfg_process, df)

    dic_date_time_data_type = {}
    for col, cfg_col in dic_use_cols.items():
        formula = conversion_formula(
            col_type=cfg_col.column_type,
            data_type=cfg_col.data_type,
            formula=cfg_col.formula,
        )
        if formula:
            df[cfg_col.column_name] = formula.convert(df[cfg_col.column_name])
        else:
            # get dic_data_type from dic_use_cols
            # if not have formula then add to dic_date_time to convert it in convert_datetime_format
            dic_date_time_data_type[col] = cfg_col.data_type

    # convert datatime type 2023年01月02日 -> 2023-01-02 00:00:00
    df = convert_datetime_format(df, dic_data_type=dic_date_time_data_type, datetime_format=cfg_process.datetime_format)
    # make datetime main from date:main and time:main
    # TODO: fix bug not validate after merge
    if trans_data and trans_data.main_date_column and trans_data.main_time_column:
        df = merge_is_get_date_from_date_and_time(
            df,
            trans_data.getdate_column.column_name,
            trans_data.main_date_column.column_name,
            trans_data.main_time_column.column_name,
        )

    # original df
    orig_df = copy_df(df)

    # remove FILE INDEX col
    if FILE_IDX_COL in df.columns:
        df = df.drop(FILE_IDX_COL, axis=1)

    # Convert UTC time
    for col, cfg_col in dic_use_cols.items():
        dtype = cfg_col.data_type
        # Validation is not done when column does not exist in df
        # This is necessary for cases where the datetime column only exists in one of the files
        if DataType[dtype] is not DataType.DATETIME and col != get_date_col or col not in df.columns:
            continue

        empty_as_error = col == get_date_col
        df = validate_datetime(df, col, empty_as_error=empty_as_error)
        df = convert_csv_timezone(df, col)

    # data pre-processing
    df, df_error = data_pre_processing(
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

    df = df[sorted(valid_cols)]
    # remove duplicate records in csv file which exists in csv or DB
    cfg_columns = list(dic_use_cols.values())

    # merge mode
    target_cfg_process = cfg_process
    target_get_date_col = get_date_col
    child_cfg_proc = None
    if parent_cfg_process:
        child_cfg_proc = cfg_process
        target_cfg_process = parent_cfg_process
        dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in parent_cfg_process.get_transaction_process_columns()}
        dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
        dic_rename = {col: dic_parent_cfg_cols[dic_cols[col]].column_name for col in df.columns}
        df = df.rename(columns=dic_rename)
        orig_df = orig_df.rename(columns=dic_rename)
        df_error = df_error.rename(columns=dic_rename)
        target_get_date_col = parent_cfg_process.get_date_col()

    df, df_duplicate = remove_duplicates(df, orig_df, df_error, target_cfg_process, target_get_date_col)
    save_res = import_data(df, target_cfg_process, target_get_date_col, job_info, child_cfg_proc=child_cfg_proc)

    return save_res, df_error, df_duplicate


def yield_job_info(
    job_info: JobInfo,
    csv_file_name: str,
    imported_row: int = 0,
    save_res: int = 0,
    df_error_cnt: int = 0,
    err_msgs: str | None = None,
    is_safe_interrupt: bool = False,
):
    """
    Update job info object to send to `send_processing_info`
    :param job_info:
    :param csv_file_name:
    :param imported_row:
    :param save_res:
    :param df_error_cnt:
    :param err_msgs:
    :param is_safe_interrupt: If True: informs to `send_processing_info` function that it's ready to break loop safety
     without missing data, otherwise
    :return: a JobInfo object
    """
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
        with job_info.interruptible(is_safe_interrupt) as job:
            yield job
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
    if not pd.api.types.is_string_dtype(df[get_date_col]):
        df[get_date_col] = convert_df_datetime_to_str(df, get_date_col)
    return df


@log_execution_time()
def convert_eu_decimal(df: DataFrame, df_col, data_type):
    df[df_col] = convert_eu_decimal_series(df[df_col], data_type)
    return df


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
        df_error_one_file = df_error_one_file.drop(FILE_IDX_COL, axis=1)
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

        df_dropped = df.drop(FILE_IDX_COL, axis=1)
        df_output = gen_duplicate_output_df(
            dic_use_cols,
            get_df_first_n_last(df_dropped),
            csv_file_name=csv_file_path_name,
            error_msgs=error_msg,
        )

        write_duplicate_import(df_output, [proc_name, csv_file_name, 'Duplicate', job_id, time_str, ip_address])


def is_header_contains_invalid_chars(header_names: list[str]) -> bool:
    if not header_names:
        return False

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
    # in case of skip_head != 0, maybe the detected header is including numeric
    # it should be converted to string before use join/strip in below logic
    header_names = list(map(str, header_names))
    org_header = header_names.copy()

    is_blank = skip_head is None
    is_auto_generate_dummy_header = is_header_contains_invalid_chars(header_names)

    # auto generate dummy header rules
    is_gen_from_blank_skip = is_blank and is_auto_generate_dummy_header
    is_gen_from_zero_skip = not is_blank and skip_head == 0
    is_gen_from_number_skip = not is_blank and skip_head > 0 and is_auto_generate_dummy_header
    if is_gen_from_blank_skip or is_gen_from_zero_skip or is_gen_from_number_skip:
        if data_details:
            data_details = [header_names, *data_details]
        header_names = ['col'] * len(header_names)
        dummy_header = True
    # columns with only spaces are treated the same way as empty column names
    # TODO: should normalize or strip be used here?
    stripped_header_names = [name.strip() for name in header_names]
    if EMPTY_STRING in stripped_header_names:
        header_names = ['col' if normalize_str(name) is EMPTY_STRING else name for name in header_names]
        partial_dummy_header = True

    is_gen_cols = [col_name != org_header[i] for i, col_name in enumerate(header_names)]

    return org_header, header_names, dummy_header, partial_dummy_header, data_details, is_gen_cols


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

    return df


def add_column_file_name(df, file_path, file_name_col=FILE_NAME):
    file_name = os.path.basename(file_path)
    df[file_name_col] = file_name
    return df
