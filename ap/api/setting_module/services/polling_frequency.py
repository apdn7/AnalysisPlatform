import collections
import logging
from datetime import datetime
from typing import Union

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pytz import utc

from ap import dic_request_info
from ap.api.setting_module.services.csv_import import import_csv_job
from ap.api.setting_module.services.export_config import DataExport, ExportConfig
from ap.api.setting_module.services.factory_import import (
    factory_import_job,
    factory_past_import_job,
)
from ap.api.setting_module.services.process_delete import (
    delete_all_transaction_data_job,
    delete_transaction_data_job,
)
from ap.api.setting_module.services.show_latest_record import get_latest_records
from ap.api.setting_module.services.web_api_import import import_web_api_job
from ap.common.common_utils import add_seconds, parse_int_value
from ap.common.constants import (
    DELETE_TRANSACTION_DATA_INTERVAL,
    IDLE_MONITORING_INTERVAL,
    LAST_REQUEST_TIME,
    AnnounceEvent,
    BulkRegisterProcessError,
    BulkRegisterProcessErrorData,
    DataColumnType,
    DBType,
    JobType,
    MasterDBType,
    ProcessColumnConst,
    ProcessStatus,
)
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventBackgroundAnnounce, EventQueue, EventRemoveJobs
from ap.common.scheduler import scheduler_app_context
from ap.etl.pull.pull_data import add_pull_transaction_data_job
from ap.setting_module.models import CfgDataSource, CfgExport, CfgProcess, JobManagement, make_session
from ap.setting_module.schemas import ProcessColumnSchema, ProcessSchema
from ap.setting_module.services.background_process import send_processing_info

logger = logging.getLogger(__name__)


@log_execution_time()
def change_polling_all_interval_jobs(run_now=False, is_user_request: bool = False):
    """Add job for csv and factory import

    Arguments:
        interval_sec {[type]} -- [description]

    Keyword Arguments:
        target_job_names {[type]} -- [description] (default: {None})
    """
    # target jobs (do not remove factory past data import)
    target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT, JobType.PULL_DATA, JobType.IMPORT_DATA]

    # remove jobs
    EventQueue.put(EventRemoveJobs(job_types=target_jobs))

    # add new jobs with new interval
    # need to call list map, so that we can load all params data, otherwise the data will be staled
    params = list(map(add_import_job_params, CfgProcess.get_all(status=ProcessStatus.REGISTERED, with_parent=True)))
    for param in params:
        add_import_job(
            process_id=param.process_id,
            process_name=param.process_name,
            data_source_id=param.data_source_id,
            data_source_type=param.data_source_type,
            interval_sec=None if param.polling_frequency == 0 else param.polling_frequency,
            run_now=run_now,
            is_user_request=is_user_request,
        )


def handle_update_polling(
    data_src_db_saved: CfgDataSource, with_import_option: bool = False, is_change_frequency: bool = False
):
    if with_import_option or is_change_frequency:
        freq_sec = (
            parse_int_value(data_src_db_saved.polling_frequency)
            if data_src_db_saved.polling_frequency is not None
            else None
        )
        is_user_request = with_import_option and freq_sec is None
        change_polling_by_data_source(
            interval_sec=freq_sec,
            data_source_id=data_src_db_saved.id,
            run_now=with_import_option,
            is_user_request=is_user_request,
        )


def has_important_changes(data_src_req: CfgDataSource) -> tuple[bool, bool]:
    """
    Checks if important fields (polling_frequency, db_detail.pull_from)
    have changed compared to the existing database record.

    Returns:
        (bool, bool): (is_polling_frequency_changed, is_pull_from_changed)
    """
    if not data_src_req.id:
        return False, False

    existing_dbs = CfgDataSource.get_by_id(data_src_req.id)
    is_polling_frequency_changed = existing_dbs.polling_frequency != data_src_req.polling_frequency
    is_pull_from_changed = (
        data_src_req.db_detail is not None
        and existing_dbs.db_detail is not None
        and existing_dbs.db_detail.pull_from != data_src_req.db_detail.pull_from
    )

    return is_polling_frequency_changed, is_pull_from_changed


def change_polling_by_data_source(
    interval_sec: Union[int, None],
    data_source_id: int,
    run_now=False,
    is_user_request: bool = False,
):
    target_jobs = JobType.polling_freq_interval_data_jobs()
    data_source = CfgDataSource.get_by_id(data_source_id)
    if data_source.type in [DBType.SNOWFLAKE.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]:
        # remove pull job by data source id
        EventQueue.put(EventRemoveJobs(job_types=JobType.jobs_include_data_source_id(), data_source_id=data_source_id))
    processes = CfgProcess.get_all(status=ProcessStatus.REGISTERED, data_source_id=data_source_id)
    for process in processes:
        EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=process.id))

    if interval_sec is None and not run_now:
        return

    params = list(
        map(
            add_import_job_params,
            CfgProcess.get_all(status=ProcessStatus.REGISTERED, data_source_id=data_source_id),
        )
    )
    for param in params:
        add_import_job(
            process_id=param.process_id,
            process_name=param.process_name,
            data_source_id=param.data_source_id,
            data_source_type=param.data_source_type,
            interval_sec=interval_sec,
            run_now=run_now,
            is_user_request=is_user_request,
        )


def add_import_job_params(proc_cfg: CfgProcess):
    ImportJobParam = collections.namedtuple(
        'ImportJobParam',
        ['process_id', 'process_name', 'data_source_id', 'data_source_type', 'polling_frequency'],
    )
    return ImportJobParam(
        process_id=proc_cfg.id,
        process_name=proc_cfg.name,
        data_source_id=proc_cfg.data_source_id,
        data_source_type=proc_cfg.data_source.type,
        polling_frequency=proc_cfg.data_source.polling_frequency,
    )


def add_delete_transaction_data_job(run_now=False, is_increase: bool = False):
    next_run_time = None
    if run_now:
        next_run_time = datetime.now().astimezone(utc)
    if is_increase:
        fn = delete_all_transaction_data_job
        job_type = JobType.DEL_ALL_TRANSACTION_DATA
        trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)
    else:
        fn = delete_transaction_data_job
        job_type = JobType.DEL_TRANSACTION_DATA_BY_LIMIT
        trigger = IntervalTrigger(seconds=DELETE_TRANSACTION_DATA_INTERVAL, timezone=utc)

    EventQueue.put(
        EventAddJob(
            fn=fn,
            job_type=job_type,
            replace_existing=True,
            trigger=trigger,
            next_run_time=next_run_time,
        ),
    )
    return True


def add_import_job(
    process_id: int,
    process_name: str,
    data_source_id: int,
    data_source_type: str,
    interval_sec=None,
    run_now=None,
    is_user_request: bool = False,
    register_by_file_request_id: str | None = None,
):
    if interval_sec is not None:
        trigger = IntervalTrigger(seconds=interval_sec, timezone=utc)
    else:
        trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)

    next_run_time = None
    if run_now:
        next_run_time = datetime.now().astimezone(utc)

    kwargs = {}
    if data_source_type.lower() in [DBType.CSV.value.lower(), DBType.V2.value.lower()]:
        job_type = JobType.CSV_IMPORT
        import_func = import_csv_job
    elif data_source_type in [DBType.SNOWFLAKE.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]:
        # Only add PULL data job first, it'll automatically add IMPORT data job when PULL data is finished
        add_pull_transaction_data_job(data_source_id)
        return
    elif data_source_type in [DBType.WEB_API.name]:
        job_type = JobType.WEB_API_IMPORT
        import_func = import_web_api_job
    else:
        job_type = JobType.FACTORY_IMPORT
        import_func = factory_import_job

    EventQueue.put(
        EventAddJob(
            fn=import_func,
            kwargs={
                **kwargs,
                'is_user_request': is_user_request,
                'register_by_file_request_id': register_by_file_request_id,
            },
            job_type=job_type,
            data_source_id=data_source_id,
            process_id=process_id,
            process_name=process_name,
            replace_existing=True,
            trigger=trigger,
            next_run_time=next_run_time,
        ),
    )


@scheduler_app_context
def export_job_func(config_id: int, job_management: JobManagement):
    export_config = CfgExport.get_by_id(config_id)
    if export_config is not None:
        gen = DataExport(export_config).export_as_gen()
        send_processing_info(
            gen,
            job_management=job_management,
        )


def add_export_job(export_config: CfgExport):
    trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)
    if export_config.export_frequency:
        trigger = IntervalTrigger(seconds=export_config.export_frequency, timezone=utc)
    kwargs = ExportConfig(config_id=export_config.id).to_dict()

    EventQueue.put(
        EventAddJob(
            fn=export_job_func,
            kwargs=kwargs,
            job_type=JobType.DATA_EXPORT,
            job_id_suffix=f'{export_config.process_id}_{export_config.id}',
            replace_existing=True,
            trigger=trigger,
            next_run_time=datetime.now().astimezone(utc),
        ),
    )


@scheduler_app_context
def bulk_register_process_func(
    data_source_id: int, proc_ids: list[int], is_directly_import: bool, job_management: JobManagement
):
    gen = bulk_register_process(data_source_id, proc_ids, is_directly_import)
    send_processing_info(gen, job_management=job_management)


def add_bulk_register_process_job(proc_ids: list[int], is_directly_import: bool, ds_id: int):
    EventQueue.put(
        EventAddJob(
            fn=bulk_register_process_func,
            job_type=JobType.BULK_PROCESS_REGISTER,
            kwargs={'proc_ids': proc_ids, 'is_directly_import': is_directly_import},
            replace_existing=True,
            data_source_id=ds_id,
            trigger=DateTrigger(datetime.now().astimezone(utc), timezone=utc),
            next_run_time=datetime.now().astimezone(utc),
            executor='threadpool',
        )
    )


def update_process_info(process_id: int, status: ProcessStatus) -> CfgProcess:
    """
    Update process info after run bulk register from SW datasource
        - columns
        - status
    """
    with make_session() as meta_session:
        process = meta_session.query(CfgProcess).get(process_id)
        (detected_columns, *_tmp_) = get_latest_records(
            data_source_id=process.data_source_id,
            table_name=process.table_name,
            limit=1000,
            process_factid=process.process_factid,
            master_type=MasterDBType[process.master_type],
        )
        sw_columns = []
        for col in detected_columns:
            col_dtype = DataColumnType.GENERATED.value

            if col[ProcessColumnConst.IS_GET_DATE.value] or col[ProcessColumnConst.IS_DUMMY_DATETIME.value]:
                col_dtype = DataColumnType.DATETIME.value

            if col[ProcessColumnConst.IS_SERIAL_NO.value]:
                col_dtype = DataColumnType.SERIAL.value

            if col[ProcessColumnConst.IS_MAIN_SERIAL_NO.value]:
                col_dtype = DataColumnType.MAIN_SERIAL.value
                col[ProcessColumnConst.IS_SERIAL_NO.value] = True

            if col.get(ProcessColumnConst.IS_AUTO_INCREMENT.value):
                col_dtype = DataColumnType.DATETIME_KEY.value

            sw_columns.append(
                ProcessColumnSchema().load(
                    {
                        **col,
                        ProcessColumnConst.COLUMN_TYPE.value: col_dtype,
                        ProcessColumnConst.PREDICT_TYPE.value: col[ProcessColumnConst.DATA_TYPE.value],
                    }
                )
            )

        process.columns = sw_columns
        process.status = status.value
    return process


@log_execution_time()
def bulk_register_process(data_source_id: int, proc_ids: list[int], is_directly_import: bool):
    yield 0
    process_status = ProcessStatus.REGISTERED if is_directly_import else ProcessStatus.INITIALIZED
    data_source = CfgDataSource.get_by_id(data_source_id)
    is_snowflake_datasource = data_source.type in [DBType.SNOWFLAKE.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]
    error_data: list[BulkRegisterProcessErrorData] = []
    for idx, pid in enumerate(proc_ids):
        error_message = None
        try:
            process = update_process_info(pid, status=process_status)
            if is_directly_import and not is_snowflake_datasource:
                # CAUTION:
                # In case of BULK REGISTER, the `add_import_job` function is not use for snowflake processes
                #  because all processes must be created columns before add PULL_DATA job to avoid that there
                #  are process without columns
                add_import_job(
                    process_id=process.id,
                    process_name=process.name,
                    data_source_id=data_source_id,
                    data_source_type=data_source.type,
                    run_now=True,
                    interval_sec=data_source.polling_frequency,
                )

        except Exception as e:
            with make_session() as meta_session:
                process = meta_session.query(CfgProcess).get(pid)
                process.status = ProcessStatus.INIT_FAIL.value
            error_message = e.__str__()
            error_data.append(
                BulkRegisterProcessErrorData(
                    process_name=process.name,
                    process_factid=process.process_factid,
                    error_message=error_message,
                )
            )

        finally:
            response_status = 200
            register_event_data = {
                'data': ProcessSchema().dump(process),
                'status': response_status,
                'bulk_register': True,
                'process_status': process.status,
                'error_message': error_message,
            }
            EventQueue.put(
                EventBackgroundAnnounce(data=register_event_data, event=AnnounceEvent.PROCESS_BULK_REGISTER),
            )

        yield idx * 90 / len(proc_ids)

    if is_directly_import and is_snowflake_datasource:
        # Add jobs after all processes are registered to optimize pulling data job
        add_pull_transaction_data_job(data_source_id)

    if error_data:
        raise BulkRegisterProcessError(error_data)

    yield 100


@log_execution_time()
def add_idle_monitoring_job(process_ids: list[int] | None = None):
    EventQueue.put(
        EventAddJob(
            fn=idle_monitoring,
            job_type=JobType.IDLE_MONITORING,
            kwargs={'process_ids': process_ids},
            replace_existing=True,
            trigger=IntervalTrigger(seconds=IDLE_MONITORING_INTERVAL, timezone=utc),
            executor='threadpool',
        ),
    )

    return True


@scheduler_app_context
def idle_monitoring(process_ids: list[int] | None = None):
    """Check if system if idle"""
    # check last request > now() - 5 minutes
    last_request_time = dic_request_info.get(LAST_REQUEST_TIME, datetime.utcnow())
    if last_request_time > add_seconds(seconds=-IDLE_MONITORING_INTERVAL):
        return

    # delete unused processes
    # add_del_proc_job()

    processes = CfgProcess.get_all(status=ProcessStatus.REGISTERED, with_parent=True)
    if process_ids is not None:
        processes = [proc for proc in processes if proc.id in process_ids]

    # need to call list map, so that we can load all params data, otherwise the data will be staled
    params = list(map(add_import_job_params, processes))
    for param in params:
        if param.data_source_type.lower() in [
            DBType.CSV.name.lower(),
            DBType.V2.name.lower(),
            # do not run factory past import for snowflake
            DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name.lower(),
            DBType.SNOWFLAKE.name.lower(),
            DBType.WEB_API.name.lower(),
        ]:
            continue

        EventQueue.put(
            EventAddJob(
                fn=factory_past_import_job,
                kwargs={'process_id': param.process_id},
                job_type=JobType.FACTORY_PAST_IMPORT,
                job_id_prefix=JobType.IDLE_MONITORING.name,
                data_source_id=param.data_source_id,
                process_id=param.process_id,
                process_name=param.process_name,
                trigger=DateTrigger(datetime.now().astimezone(utc), timezone=utc),
                replace_existing=True,
            ),
        )
