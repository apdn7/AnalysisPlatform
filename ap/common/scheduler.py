from datetime import datetime
from functools import wraps
from threading import Lock

from pytz import utc

from ap import ListenNotifyType, close_sessions, scheduler
from ap.common.common_utils import get_multiprocess_queue_file, read_pickle_file
from ap.common.constants import JobType
from ap.common.logger import log_execution_time

# RESCHEDULE_SECONDS
RESCHEDULE_SECONDS = 5

# max concurrent importing jobs
MAX_CONCURRENT_JOBS = 10

# multi thread lock
lock = Lock()

PRIORITY_JOBS = [
    JobType.CSV_IMPORT.name,
    JobType.FACTORY_IMPORT.name,
    JobType.FACTORY_PAST_IMPORT.name,
]

# check parallel running
# ex: (JobType.CSV_IMPORT, JobType.GEN_GLOBAL): False
#       csv import and gen global can not run in the same time
#       False: Don't need to check key between 2 job (key: job parameter).
#       True: Need to check key between 2 job , if key is not the same , they can run parallel
CONFLICT_PAIR = {
    # (JobType.DEL_PROCESS.name, JobType.DEL_PROCESS.name),
    # (JobType.DEL_PROCESS.name, JobType.GEN_GLOBAL.name),
    # (JobType.DEL_PROCESS.name, JobType.RESTRUCTURE_INDEXES.name),
    # (JobType.DEL_PROCESS.name, JobType.CSV_IMPORT.name),
    # (JobType.DEL_PROCESS.name, JobType.FACTORY_IMPORT.name),
    # (JobType.DEL_PROCESS.name, JobType.FACTORY_PAST_IMPORT.name),
    (JobType.GEN_GLOBAL.name, JobType.GEN_GLOBAL.name),
    (JobType.GEN_GLOBAL.name, JobType.RESTRUCTURE_INDEXES.name),
    # (JobType.GEN_GLOBAL.name, JobType.CSV_IMPORT.name),
    # (JobType.GEN_GLOBAL.name, JobType.FACTORY_IMPORT.name),
    # (JobType.GEN_GLOBAL.name, JobType.FACTORY_PAST_IMPORT.name),
    # (JobType.RESTRUCTURE_INDEXES.name, JobType.CSV_IMPORT.name),
    # (JobType.RESTRUCTURE_INDEXES.name, JobType.FACTORY_IMPORT.name),
    # (JobType.RESTRUCTURE_INDEXES.name, JobType.FACTORY_PAST_IMPORT.name),
}


@log_execution_time(logging_exception=True)
def scheduler_app_context(fn):
    """application context decorator for background task(scheduler)

    Arguments:
        fn {function} -- [description]

    Returns:
        [type] -- [description]
    """

    @wraps(fn)
    def inner(*args, **kwargs):
        print('--------CHECK_BEFORE_RUN---------')
        job_id = kwargs.get('_job_id')
        job_name = kwargs.get('_job_name')
        proc_id = kwargs.get('_proc_id') or kwargs.get('proc_id') or kwargs.get('process_id')
        try:
            process_queue = read_pickle_file(get_multiprocess_queue_file())
            dic_running_job = process_queue[ListenNotifyType.RUNNING_JOB.name]
            # dic_running_job = kwargs[PROCESS_QUEUE][ListenNotifyType.RUNNING_JOB.name]
        except Exception:
            dic_running_job = {}

        # check before run
        if not scheduler_check_before_run(job_id, job_name, proc_id, dic_running_job):
            scheduler.reschedule_job(job_id, fn, kwargs)
            return None

        flask_app = scheduler.app
        with flask_app.app_context():
            print(f'--------{job_id} START---------')

            try:
                dic_running_job[job_id] = [job_name, proc_id, datetime.utcnow()]
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


# def is_running_jobs_over_limitation():
#     priority_jobs_running = []
#     for running_job_name, *_ in dic_running_job.values():
#         if running_job_name in PRIORITY_JOBS:
#             priority_jobs_running.append(running_job_name)
#     if len(priority_jobs_running) >= MAX_CONCURRENT_JOBS:
#         return True
#     return False


def scheduler_check_before_run(job_id, job_name, proc_id, dic_running_job_param):
    """check if job can run parallel with other jobs"""

    print('job_id:', job_id)
    print('job_name:', job_name)
    print('proc_id:', proc_id)
    print('RUNNING JOBS:', dic_running_job_param)
    if dic_running_job_param.get(job_id):
        print('The same job is running')
        return False

    for running_job_name, running_proc_id, *_ in dic_running_job_param.values():
        if (job_name, running_job_name) in CONFLICT_PAIR or (running_job_name, job_name) in CONFLICT_PAIR:
            print(f'{job_name} job can not run parallel with {running_job_name}')
            return False
        if proc_id is not None and proc_id == running_proc_id:
            return False

    # multiprocess , so it not need anymore
    # if is_running_jobs_over_limitation():
    #     print(f'=== PENDING JOB: {job_id} ===')
    #     return False

    return True


# def reschedule_job(job_id, job_name, fn, args, kwargs):
#     """let the job wait about n minutes
#
#     Arguments:
#         job_id {[type]} -- [description]
#         job_name {[type]} -- [description]
#         fn {function} -- [description]
#         args {[type]} -- [description]
#         kwargs {[type]} -- [description]
#     """
#
#     job = scheduler.get_job(job_id)
#     run_time = datetime.now().astimezone(utc) + timedelta(seconds=RESCHEDULE_SECONDS)
#     if job:
#         job.next_run_time = run_time
#         if job.trigger:
#             if type(job.trigger).__name__ == 'DateTrigger':
#                 job.trigger.run_date = run_time
#             elif type(job.trigger).__name__ == 'IntervalTrigger':
#                 job.trigger.start_date = run_time
#         job.reschedule(trigger=job.trigger)
#     else:
#         # for non-interval job , there is no job in scheduler anymore
#         # so we must add new job to scheduler.
#         job = scheduler.add_job(
#             job_id,
#             fn,
#             name=job_name,
#             trigger=date.DateTrigger(run_date=run_time, timezone=utc),
#             args=args,
#             kwargs=kwargs,
#         )
#     print('=== RESCHEDULED JOB ===')
#     print(job)


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
    print(f'=== ADD JOB: {job_id}===')
    if run_now:
        scheduler.add_job(
            job_id,
            import_func,
            name=job_name,
            replace_existing=True,
            trigger=trigger,
            next_run_time=datetime.now().astimezone(utc),
            kwargs=dic_import_param,
        )
    else:
        scheduler.add_job(
            job_id,
            import_func,
            name=job_name,
            replace_existing=True,
            trigger=trigger,
            kwargs=dic_import_param,
        )


def get_job_details(job_id):
    job = scheduler.get_job(job_id)
    if job is None:
        return None
    return {
        'func': job.func,
        'trigger': job.trigger,
        'args': job.args,
        'kwargs': job.kwargs,
        'job_id': job.id,
        'name': job.name,
    }
