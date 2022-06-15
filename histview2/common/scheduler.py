from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from threading import Lock

from apscheduler.triggers import date
from pytz import utc

from histview2 import scheduler, close_sessions
from histview2.common.logger import log_execution_time

# RESCHEDULE_SECONDS
RESCHEDULE_SECONDS = 5

# running jobs dict
dic_running_job = {}

# multi thread lock
lock = Lock()


class JobType(Enum):
    def __str__(self):
        return str(self.name)

    # 1,2 is priority
    DEL_PROCESS = 1
    CSV_IMPORT = 2
    FACTORY_IMPORT = 3
    GEN_GLOBAL = 4
    CLEAN_DATA = 5
    FACTORY_PAST_IMPORT = 6
    IDLE_MORNITORING = 7
    SHUTDOWN_APP = 8
    BACKUP_DATABASE = 9


# check parallel running
# ex: (JobType.CSV_IMPORT, JobType.GEN_GLOBAL): False
#       csv import and gen global can not run in the same time
#       False: Don't need to check key between 2 job (key: job parameter).
#       True: Need to check key between 2 job , if key is not the same , they can run parallel
CONFLICT_PAIR = {
    (JobType.DEL_PROCESS.name, JobType.DEL_PROCESS.name),
    (JobType.DEL_PROCESS.name, JobType.CSV_IMPORT.name),
    (JobType.DEL_PROCESS.name, JobType.FACTORY_IMPORT.name),
    (JobType.DEL_PROCESS.name, JobType.GEN_GLOBAL.name),
    (JobType.DEL_PROCESS.name, JobType.FACTORY_PAST_IMPORT.name),

    # (JobType.CSV_IMPORT.name, JobType.CSV_IMPORT.name),
    # (JobType.CSV_IMPORT.name, JobType.FACTORY_IMPORT.name),
    (JobType.CSV_IMPORT.name, JobType.GEN_GLOBAL.name),
    # (JobType.CSV_IMPORT.name, JobType.FACTORY_PAST_IMPORT.name),

    # (JobType.FACTORY_IMPORT.name, JobType.FACTORY_IMPORT.name),
    (JobType.FACTORY_IMPORT.name, JobType.GEN_GLOBAL.name),
    # (JobType.FACTORY_IMPORT.name, JobType.FACTORY_PAST_IMPORT.name),

    (JobType.GEN_GLOBAL.name, JobType.GEN_GLOBAL.name),
    (JobType.GEN_GLOBAL.name, JobType.FACTORY_PAST_IMPORT.name),

    # (JobType.FACTORY_PAST_IMPORT.name, JobType.FACTORY_PAST_IMPORT.name),
}

# Jobs that change universal data
IMPORT_DATA_JOBS = [JobType.CSV_IMPORT.name, JobType.FACTORY_IMPORT.name, JobType.FACTORY_PAST_IMPORT.name]


@log_execution_time(logging_exception=True)
def scheduler_app_context(fn):
    """ application context decorator for background task(scheduler)

    Arguments:
        fn {function} -- [description]

    Returns:
        [type] -- [description]
    """

    @wraps(fn)
    def inner(*args, **kwargs):
        global dic_running_job
        print(f'--------CHECK_BEFORE_RUN---------')
        job_id = kwargs.get('_job_id')
        job_name = kwargs.get('_job_name')

        # check before run
        with lock:
            try:
                scheduler.pause()
                if scheduler_check_before_run(job_id, job_name, dic_running_job):
                    dic_running_job[job_id] = [job_name, datetime.utcnow()]
                else:
                    reschedule_job(job_id, job_name, fn, args, kwargs)
                    return None

            finally:
                scheduler.resume()

        flask_app = scheduler.app
        with flask_app.app_context():
            print(f'--------{job_id} START---------')

            try:
                result = fn(*args, **kwargs)
                print(f'--------{job_id} END-----------')
            except Exception as e:
                raise e
            finally:
                dic_running_job.pop(job_id, None)
                # rollback and close session to avoid database locked.
                close_sessions()

            return result

    return inner


def scheduler_check_before_run(job_id, job_name, dic_running_job_param):
    """check if job can run parallel with other jobs
    """

    print("job_id:", job_id)
    print("job_name:", job_name)
    print("RUNNING JOBS:", dic_running_job_param)
    if dic_running_job_param.get(job_id):
        print("The same job is running")
        return False

    for running_job_name, *_ in dic_running_job_param.values():
        if (job_name, running_job_name) in CONFLICT_PAIR or (running_job_name, job_name) in CONFLICT_PAIR:
            print(f"{job_name} job can not run parallel with {running_job_name}")
            return False

    return True


def reschedule_job(job_id, job_name, fn, args, kwargs):
    """let the job wait about n minutes

    Arguments:
        job_id {[type]} -- [description]
        job_name {[type]} -- [description]
        fn {function} -- [description]
        args {[type]} -- [description]
        kwargs {[type]} -- [description]
    """

    job = scheduler.get_job(job_id)
    run_time = datetime.now().astimezone(utc) + timedelta(seconds=RESCHEDULE_SECONDS)
    if job:
        job.next_run_time = run_time
        if job.trigger:
            if type(job.trigger).__name__ == 'DateTrigger':
                job.trigger.run_date = run_time
            elif type(job.trigger).__name__ == 'IntervalTrigger':
                job.trigger.start_date = run_time
        job.reschedule(trigger=job.trigger)
    else:
        # for non-interval job , there is no job in scheduler anymore
        # so we must add new job to scheduler.
        job = scheduler.add_job(job_id, fn, name=job_name,
                                trigger=date.DateTrigger(run_date=run_time, timezone=utc),
                                args=args, kwargs=kwargs)
    print(job)


@log_execution_time()
def remove_jobs(target_job_names, proc_id=None):
    """remove all interval jobs

    Keyword Arguments:
        target_job_names {[type]} -- [description] (default: {None})
    """
    with lock:
        try:
            scheduler.pause()
            jobs = scheduler.get_jobs()
            for job in jobs:
                if job.name not in JobType.__members__ or JobType[job.name] not in target_job_names:
                    continue

                if proc_id:
                    if job.id == f'{job.name}_{proc_id}':
                        job.remove()
                else:
                    job.remove()

        finally:
            scheduler.resume()


def add_job_to_scheduler(job_id, job_name, trigger, import_func, run_now, dic_import_param):
    if run_now:
        scheduler.add_job(job_id, import_func, name=job_name, replace_existing=True, trigger=trigger,
                          next_run_time=datetime.now().astimezone(utc),
                          kwargs=dic_import_param)
    else:
        scheduler.add_job(job_id, import_func, name=job_name, replace_existing=True, trigger=trigger,
                          kwargs=dic_import_param)
