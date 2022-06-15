from datetime import datetime

from apscheduler.triggers.date import DateTrigger
from pytz import utc

from histview2 import db, scheduler
from histview2.common.logger import log_execution_time, log_execution
from histview2.common.scheduler import scheduler_app_context, JobType, remove_jobs
from histview2.setting_module.models import CfgDataSource, make_session
from histview2.setting_module.models import CfgProcess
from histview2.setting_module.services.background_process import send_processing_info
from histview2.trace_data.models import Process


@scheduler_app_context
def delete_process_job(_job_id=None, _job_name=None, *args, **kwargs):
    """ scheduler job to delete process from db

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = delete_process(*args, **kwargs)
    send_processing_info(gen, JobType.DEL_PROCESS, db_code=kwargs.get('db_id'), process_id=kwargs.get('proc_id'), is_check_disk=False)


@log_execution_time()
def delete_process():
    """
    delete processes
    :return:
    """
    yield 0

    missing_procs = get_unused_procs()

    if missing_procs:
        proc_id = missing_procs[0]
        proc = Process.query.get(proc_id)
        proc.delete_proc_detail()
        db.session.delete(proc)
        db.session.commit()

    yield 100


@log_execution()
def add_del_proc_job():
    missing_procs = get_unused_procs()

    if not missing_procs:
        return

    scheduler.add_job(
        JobType.DEL_PROCESS.name, delete_process_job,
        trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
        replace_existing=True,
        kwargs=dict(_job_id=JobType.DEL_PROCESS.name, _job_name=JobType.DEL_PROCESS.name)
    )


@log_execution_time()
def delete_proc_cfg_and_relate_jobs(proc_id):
    # delete cfg process
    deleted = CfgProcess.delete(proc_id=proc_id)

    # remove job relate to that process
    if deleted:
        # target jobs
        target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT, JobType.FACTORY_PAST_IMPORT]
        # remove importing job from job queue
        remove_jobs(target_jobs, proc_id)


@log_execution_time()
def get_unused_procs():
    return list(set([proc.id for proc in Process.get_all_ids()]) - set([proc.id for proc in CfgProcess.get_all_ids()]))


def del_data_source(ds_id):
    """
    delete data source
    :param ds_id:
    :return:
    """
    with make_session() as meta_session:
        ds = meta_session.query(CfgDataSource).get(ds_id)
        if not ds:
            return

        # delete data
        for proc in ds.processes or []:
            delete_proc_cfg_and_relate_jobs(proc.id)
        meta_session.delete(ds)
