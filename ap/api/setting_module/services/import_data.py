from datetime import datetime
from pathlib import Path

from apscheduler.triggers.date import DateTrigger
from pytz import utc

from ap.api.setting_module.services.csv_import import convert_csv_timezone, remove_duplicates
from ap.api.setting_module.services.data_import import (
    data_pre_processing,
    gen_error_output_df,
    gen_import_job_info,
    get_df_first_n_last,
    import_data,
    save_failed_import_history,
    validate_datetime,
    write_error_import,
    write_error_trace,
)
from ap.api.setting_module.services.factory_import import (
    remove_non_exist_columns_in_df,
    write_duplicate_records_to_file_factory,
)
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job, finished_transaction_import
from ap.common.common_utils import read_feather_file
from ap.common.constants import (
    DATA_TYPE_DUPLICATE_MSG,
    DATA_TYPE_ERROR_MSG,
    IMPORT_FACTOR_EMPTY_DATA,
    DataType,
    JobStatus,
    JobType,
    MasterDBType,
)
from ap.common.jobs.job_info_schema import ImportDataJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import get_data_path
from ap.common.scheduler import scheduler_app_context
from ap.etl.transform import TransformData
from ap.etl.transform.pipeline import (
    software_workshop_snowflake_history_transform_pipeline_local,
    software_workshop_snowflake_measurement_transform_pipeline_local,
)
from ap.setting_module.models import CfgProcess, CfgProcessColumn, JobManagement
from ap.setting_module.services.background_process import JobInfo, send_processing_info


def import_transaction_data_from_files(
    *,
    process: CfgProcess,
    job_info: JobInfo,
    job_management: JobManagement,
):
    """
    Imports and processes Snowflake data from feather files for a specific software workshop,
    including data transformation, validation, de-duplication, and importing into the target
    system.

    This function orchestrates reading transaction data from files, applying necessary
    transformations based on the master database type, validating and normalizing columns,
    pre-processing and handling errors, removing duplicates, and finally importing
    the processed dataset into the respective destination.

    Parameters:
        process (CfgProcess): The process configuration object containing metadata
            for the transaction processing.
        job_info (JobInfo): The job information object used to manage job status,
            progress tracking, and reporting.
        job_management (JobManagement): The job management object for storing
            job information. If provided, job info will be saved to the database.

    Yields:
        JobInfo: An updated job information object with progress status at each step
            of the import pipeline.

    Raises:
        NotImplementedError: If the master database type specified in the process
            is not supported for import operations.
    """
    # columns info
    dic_use_cols = {col.column_name: col for col in process.get_transaction_process_columns()}
    raw_to_column_name_dict = {value.column_raw_name: value.column_name for key, value in dic_use_cols.items()}

    get_date_col = process.get_date_col()
    cfg_columns = process.columns

    # get parent process config
    parent_cfg_proc: CfgProcess | None = None
    parent_cfg_columns: list[CfgProcessColumn] | None = None
    if process.parent_id:
        parent_cfg_proc: CfgProcess | None = CfgProcess.get_proc_by_id(process.parent_id)
        parent_cfg_columns: list[CfgProcessColumn] | None = parent_cfg_proc.get_transaction_process_columns()

    master_type = MasterDBType[process.master_type] if process.master_type is not None else None

    auto_increment_col = process.get_auto_increment_col_else_get_date()

    # Initialize job info
    import_data_job_info = ImportDataJobInfo()
    job_management.info = import_data_job_info

    data_path = Path(get_data_path()) / str(process.id)
    files = list(data_path.glob('TRANSACTION-*'))
    for idx, file in enumerate(files):
        # TODO: we want to have a list of errors instead of one
        error_type = None
        # dataframe
        df = read_feather_file(file)
        transformed_data = TransformData(df=df)
        import_target_info = ImportDataJobInfo.ImportTargetInfo()

        if master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT:
            transformed_data = software_workshop_snowflake_measurement_transform_pipeline_local(
                process_id=process.id,
            ).run(
                input_data=TransformData(df=df),
            )
        elif master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY:
            transformed_data = software_workshop_snowflake_history_transform_pipeline_local(
                process_id=process.id,
            ).run(
                input_data=TransformData(df=df),
            )

        df = transformed_data.df
        df = df.rename(columns=raw_to_column_name_dict)

        # Handle calculate data for main::Datetime, main::Serial function column
        from ap.api.setting_module.services.import_function_column import handle_main_function_columns

        df = handle_main_function_columns(process, df)

        # no records
        if not len(df):
            error_type = IMPORT_FACTOR_EMPTY_DATA
            save_failed_import_history(process.id, job_info, error_type)
            file.unlink()
            import_data_job_info.warning('No data to import after transformation.')
            continue

        # Convert UTC time
        for col, cfg_col in dic_use_cols.items():
            dtype = cfg_col.data_type
            if DataType[dtype] is not DataType.DATETIME and col != get_date_col:
                continue

            empty_as_error = col == get_date_col
            df = validate_datetime(df, col, is_strip=False, empty_as_error=empty_as_error)
            # POC: workaround timezone
            df = convert_csv_timezone(df, col)

        # convert types
        df = df.convert_dtypes()

        # original df
        orig_df = df.copy()

        # data pre-processing
        df, df_error = data_pre_processing(
            df,
            orig_df,
            dic_use_cols,
            exclude_cols=[get_date_col],
            get_date_col=get_date_col,
        )
        df_error_cnt = len(df_error)
        if df_error_cnt:
            factory_data_name = f'{process.id}_{process.name}'
            df_error_trace = gen_error_output_df(
                factory_data_name,
                dic_use_cols,
                get_df_first_n_last(df_error),
                df_error.head(),
            )
            write_error_trace(df_error_trace, process.name)
            write_error_import(df_error, process.name)
            error_type = DATA_TYPE_ERROR_MSG
            import_data_job_info.error(f'{df_error_cnt} record(s) failed validation and were excluded.')
            import_target_info.error_target_records = df_error_cnt
            import_data_job_info.error_records += import_target_info.error_target_records
        # no records
        if not len(df):
            error_type = IMPORT_FACTOR_EMPTY_DATA
            save_failed_import_history(process.id, job_info, error_type)
            file.unlink()
            import_data_job_info.warning(f'All records ({len(orig_df)}) failed validation. No data imported.')
            continue

        job_info.import_from = df[auto_increment_col].min()
        job_info.import_to = df[auto_increment_col].max()

        # update job info
        import_target_info.import_from = job_info.import_from
        import_target_info.import_to = job_info.import_to

        # merge mode
        target_cfg_process = process
        target_get_date_col = get_date_col
        target_cfg_columns = cfg_columns
        child_cfg_proc = None
        if parent_cfg_proc:
            child_cfg_proc = process
            target_cfg_process = parent_cfg_proc
            target_cfg_columns = parent_cfg_columns
            dic_parent_cfg_cols = {cfg_col.id: cfg_col for cfg_col in parent_cfg_columns}
            dic_cols = {cfg_col.column_name: cfg_col.parent_id for cfg_col in cfg_columns}
            dic_rename = {}
            for col in df.columns:
                if dic_cols.get(col):
                    dic_rename[col] = dic_parent_cfg_cols[dic_cols[col]].column_name
            df = df.rename(columns=dic_rename)
            # remove column do not merge
            df = df[dic_rename.values()]
            orig_df = orig_df.rename(columns=dic_rename)
            df_error = df_error.rename(columns=dic_rename)
            target_get_date_col = parent_cfg_proc.get_date_col()

        # remove duplicate records which exists DB
        df, df_duplicate = remove_duplicates(df, orig_df, df_error, target_cfg_process, target_get_date_col)
        df_duplicate_cnt = len(df_duplicate)
        if df_duplicate_cnt:
            write_duplicate_records_to_file_factory(
                df_duplicate,
                process.data_source.name,
                process.table_name,
                dic_use_cols,
                process.name,
                job_info.job_id,
            )
            error_type = DATA_TYPE_DUPLICATE_MSG
            import_data_job_info.warning(
                f'{df_duplicate_cnt} duplicate record(s) from '
                f'{import_target_info.import_from} to {import_target_info.import_to} detected and skipped. '
            )

        # import data
        # FIXME: need to tell job_info import from and to for each chunk...
        job_info.import_type = JobType.IMPORT_DATA.name

        # we save this into import_history, not t_job_management, this is bad
        job_info.status = JobStatus.DONE
        if error_type:
            job_info.status = JobStatus.FAILED
            job_info.err_msg = error_type
        df = remove_non_exist_columns_in_df(df, [col.column_name for col in target_cfg_columns])
        save_res = import_data(df, target_cfg_process, target_get_date_col, job_info, child_cfg_proc=child_cfg_proc)
        gen_import_job_info(job_info, save_res, err_cnt=df_error_cnt)

        # update job info with imported records count
        import_target_info.imported_target_records = job_info.committed_count
        import_data_job_info.imported_records += import_target_info.imported_target_records
        import_data_job_info.import_targets.append(import_target_info)

        # FIXME: we set this as processing, to avoid showing DONE on SSE, but this is wrong.
        # fix later when we implement proper error reporting
        job_info.status = JobStatus.PROCESSING
        job_info.calc_percent(idx, len(files))
        with job_info.interruptible() as job:
            yield job

        # raise exception if FATAL error happened
        if job_info.status is JobStatus.FATAL:
            raise job_info.exception

        file.unlink()

    # tell front-end that we have finished
    if job_info.status not in (JobStatus.FATAL, JobStatus.FAILED):
        job_info.percent = 100
        job_info.status = JobStatus.DONE
    with job_info.interruptible() as job:
        yield job


@log_execution_time()
def import_transaction_data(process_id: int, job_management: JobManagement):
    """
    Decorator function to log the execution time of the method and import necessary data based on
    provided process ID. Processes records in distinct use cases like software workshop measurement
    or history data. It handles job management and isolates the process object from affecting other
    sessions.

    Parameters:
    proc_id: int
        The ID of the process to be used for data import.
    job_management: JobManagement
        The job management object for storing job information.

    Yields:
    int
        The progress status of the import operation, where 0 indicates the start.

    Returns:
    None
    """
    # start job
    yield 0

    process: CfgProcess = CfgProcess.get_proc_by_id(process_id)
    if not process:
        return

    # Isolate object that not link to SQLAlchemy to avoid changes in other session
    process = process.clone()

    job_info = JobInfo()
    job_info.target = process.name
    t_job_management: JobManagement = JobManagement.get_last_job_of_process(process.id, JobType.IMPORT_DATA.name)
    job_id = t_job_management.id if t_job_management else None
    job_info.job_id = job_id

    yield from import_transaction_data_from_files(process=process, job_info=job_info, job_management=job_management)


@scheduler_app_context
def import_transaction_data_job(process_id: int, job_management: JobManagement):
    """
    Executes the data import job and handles subsequent processing steps.

    This function orchestrates the full sequence of steps for importing
    data from a specific data source, sending processing information,
    and adding a generation process link. It leverages a generator for
    data import, ensures proper message handling, and links processes
    appropriately.

    Arguments:
        process_id (int): The unique identifier for the process to be handled.
        job_management (JobManagement): The job management object for this process.
        in the import operation.

    Raises:
        Any exceptions raised during data processing will originate from the
        respective methods invoked within this function.
    """
    generator = import_transaction_data(process_id, job_management=job_management)
    send_processing_info(
        generator,
        job_management=job_management,
        after_success_func=finished_transaction_import,
        after_success_func_kwargs={},
    )
    add_gen_proc_link_job(process_id=process_id, is_user_request=True, publish=True)


def add_import_transaction_data_job(process: CfgProcess):
    """
    Adds a recurring job to import transaction data using the given process configuration.
    The job is scheduled with an interval trigger and starts execution from the specified
    next run time based on the defined polling frequency.

    :param process: The configuration process object used to define the job details.
                    This includes the process ID, name, and associated data source ID.

    :return: None
    """
    # Temporary fix for bug 200 years
    trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)
    next_run_time = datetime.now().astimezone(utc)
    EventQueue.put(
        EventAddJob(
            fn=import_transaction_data_job,
            job_type=JobType.IMPORT_DATA,
            process_id=process.id,
            process_name=process.name,
            data_source_id=process.data_source_id,
            replace_existing=True,
            trigger=trigger,
            next_run_time=next_run_time,
        ),
    )
