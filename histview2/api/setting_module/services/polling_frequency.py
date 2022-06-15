import time
from datetime import datetime
from typing import List

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger
from pytz import utc

from histview2 import scheduler, dic_request_info
from histview2.api.setting_module.services.csv_import import import_csv_job
from histview2.api.setting_module.services.factory_import import import_factory_job, \
    factory_past_data_transform_job
from histview2.api.setting_module.services.process_delete import add_del_proc_job
from histview2.common.common_utils import add_seconds
from histview2.common.constants import CfgConstantType, DBType
from histview2.common.logger import log_execution_time
from histview2.common.scheduler import JobType, remove_jobs, scheduler_app_context, add_job_to_scheduler
from histview2.setting_module.models import CfgConstant, CfgProcess, JobManagement


@log_execution_time()
def change_polling_all_interval_jobs(interval_sec, run_now=False):
    """ add job for csv and factory import

    Arguments:
        interval_sec {[type]} -- [description]

    Keyword Arguments:
        target_job_names {[type]} -- [description] (default: {None})
    """
    # target jobs (do not remove factory past data import)
    target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT]

    # remove jobs
    remove_jobs(target_jobs)

    # check if not run now and interval is zero , quit
    if interval_sec == 0 and not run_now:
        return

    # add new jobs with new interval
    procs: List[CfgProcess] = CfgProcess.query.all()

    for proc_cfg in procs:
        add_import_job(proc_cfg, interval_sec=interval_sec, run_now=run_now)


def add_import_job(proc_cfg: CfgProcess, interval_sec=None, run_now=None):
    if interval_sec is None:
        interval_sec = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name, int)

    if interval_sec:
        trigger = IntervalTrigger(seconds=interval_sec, timezone=utc)
    else:
        trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)

    if proc_cfg.data_source.type.lower() == DBType.CSV.value.lower():
        job_name = JobType.CSV_IMPORT.name
        import_func = import_csv_job
    else:
        job_name = JobType.FACTORY_IMPORT.name
        import_func = import_factory_job

    # check for last job entry in t_job_management
    prev_job = JobManagement.get_last_job_of_process(proc_cfg.id, job_name)

    job_id = f'{job_name}_{proc_cfg.id}'
    dic_import_param = dict(_job_id=job_id, _job_name=job_name,
                            _db_id=proc_cfg.data_source_id, _proc_id=proc_cfg.id, _proc_name=proc_cfg.name,
                            proc_id=proc_cfg.id)

    add_job_to_scheduler(job_id, job_name, trigger, import_func, run_now, dic_import_param)

    add_idle_mornitoring_job()

    # double check
    attempt = 0
    while attempt < 3:
        attempt += 1
        scheduler_job = scheduler.get_job(job_id)
        last_job = JobManagement.get_last_job_of_process(proc_cfg.id, job_name)
        if is_job_added(scheduler_job, prev_job, last_job):
            break
        else:
            add_job_to_scheduler(job_id, job_name, trigger, import_func, run_now, dic_import_param)
            logger.info("ADD MISSING JOB: job_id=", job_id)
        time.sleep(1)


def is_job_added(scheduler_job, prev_job, last_job):
    if not scheduler_job:
        if (prev_job is None and last_job is None) or (prev_job is not None and last_job.id == prev_job.id):
            return False
    return True


@log_execution_time()
def add_idle_mornitoring_job():
    scheduler.add_job(JobType.IDLE_MORNITORING.name, idle_monitoring,
                      name=JobType.IDLE_MORNITORING.name,
                      replace_existing=True,
                      trigger=IntervalTrigger(seconds=60, timezone=utc),
                      kwargs=dict(_job_id=JobType.IDLE_MORNITORING.name, _job_name=JobType.IDLE_MORNITORING.name))

    return True


@scheduler_app_context
def idle_monitoring(_job_id=None, _job_name=None):
    """
    check if system if idle

    """
    # check last request > now() - 5 minutes
    last_request_time = dic_request_info.get('last_request_time', datetime.utcnow())
    if last_request_time > add_seconds(seconds=-5 * 60):
        return

    # delete unused processes
    add_del_proc_job()

    processes = CfgProcess.get_all()
    for proc_cfg in processes:
        if proc_cfg.data_source.type.lower() == DBType.CSV.name.lower():
            continue

        job_id = f'{JobType.FACTORY_PAST_IMPORT.name}_{proc_cfg.id}'
        logger.info('IDLE_MONITORING', job_id)
        dic_import_param = dict(_job_id=job_id, _job_name=JobType.FACTORY_PAST_IMPORT.name,
                                _db_id=proc_cfg.data_source_id, _proc_id=proc_cfg.id, _proc_name=proc_cfg.name,
                                proc_id=proc_cfg.id)
        scheduler.add_job(job_id, factory_past_data_transform_job,
                          trigger=DateTrigger(datetime.now().astimezone(utc), timezone=utc),
                          name=JobType.FACTORY_PAST_IMPORT.name, replace_existing=True,
                          kwargs=dic_import_param)
