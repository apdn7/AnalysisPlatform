import collections
import logging
from datetime import datetime

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pytz import utc

from ap import dic_request_info
from ap.api.setting_module.services.csv_import import import_csv_job
from ap.api.setting_module.services.factory_import import factory_past_data_transform_job, import_factory_job
from ap.common.common_utils import add_seconds
from ap.common.constants import IDLE_MONITORING_INTERVAL, LAST_REQUEST_TIME, CfgConstantType, DBType, JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue, EventRemoveJobs
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgConstant, CfgProcess

logger = logging.getLogger(__name__)


@log_execution_time()
def change_polling_all_interval_jobs(interval_sec=None, run_now=False, is_user_request: bool = False):
    """add job for csv and factory import

    Arguments:
        interval_sec {[type]} -- [description]

    Keyword Arguments:
        target_job_names {[type]} -- [description] (default: {None})
    """
    # target jobs (do not remove factory past data import)
    target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT]

    # remove jobs
    EventQueue.put(EventRemoveJobs(job_types=target_jobs))

    if interval_sec is None:
        interval_sec = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name, int)

    # check if not run now and interval is zero , quit
    if interval_sec == 0 and not run_now:
        return

    # add new jobs with new interval
    # need to call list map, so that we can load all params data, otherwise the data will be staled
    params = list(map(add_import_job_params, CfgProcess.get_all(is_import=True)))
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
        ['process_id', 'process_name', 'data_source_id', 'data_source_type'],
    )
    return ImportJobParam(
        process_id=proc_cfg.id,
        process_name=proc_cfg.name,
        data_source_id=proc_cfg.data_source_id,
        data_source_type=proc_cfg.data_source.type,
    )


def add_import_job(
    process_id: int,
    process_name: str,
    data_source_id: int,
    data_source_type: str,
    interval_sec=None,
    run_now=None,
    is_user_request: bool = False,
    register_by_file_request_id: str = None,
):
    if interval_sec is None:
        interval_sec = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name, int)

    if interval_sec:
        trigger = IntervalTrigger(seconds=interval_sec, timezone=utc)
    else:
        trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)

    next_run_time = None
    if run_now:
        next_run_time = datetime.now().astimezone(utc)

    if data_source_type.lower() in [DBType.CSV.value.lower(), DBType.V2.value.lower()]:
        job_type = JobType.CSV_IMPORT
        import_func = import_csv_job
    else:
        job_type = JobType.FACTORY_IMPORT
        import_func = import_factory_job

    EventQueue.put(
        EventAddJob(
            fn=import_func,
            kwargs={
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


@log_execution_time()
def add_idle_monitoring_job():
    EventQueue.put(
        EventAddJob(
            fn=idle_monitoring,
            job_type=JobType.IDLE_MONITORING,
            replace_existing=True,
            trigger=IntervalTrigger(seconds=IDLE_MONITORING_INTERVAL, timezone=utc),
            executor='threadpool',
        ),
    )

    return True


@scheduler_app_context
def idle_monitoring():
    """
    check if system if idle

    """
    # check last request > now() - 5 minutes
    last_request_time = dic_request_info.get(LAST_REQUEST_TIME, datetime.utcnow())
    if last_request_time > add_seconds(seconds=-IDLE_MONITORING_INTERVAL):
        return

    # delete unused processes
    # add_del_proc_job()

    processes = CfgProcess.get_all(is_import=True, with_parent=True)
    # need to call list map, so that we can load all params data, otherwise the data will be staled
    params = list(map(add_import_job_params, processes))
    for param in params:
        if param.data_source_type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]:
            continue

        EventQueue.put(
            EventAddJob(
                fn=factory_past_data_transform_job,
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
