from __future__ import annotations

import contextlib
import inspect
import logging
from functools import wraps
from threading import Lock
from typing import Any

from apscheduler.jobstores.base import JobLookupError

from ap import close_sessions, scheduler
from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventQueue, EventRescheduleJob, RunningJob, RunningJobs

logger = logging.getLogger(__name__)

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

# jobs with `_id` suffixes
EXCLUSIVE_JOBS_WITH_IDS = {
    JobType.USER_BACKUP_DATABASE.name,
    JobType.USER_RESTORE_DATABASE.name,
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
        if len(args):
            raise RuntimeError(
                'Function running in scheduler should never have passed `args`.'
                'Please remove those `args` when you add job in `scheduler`',
            )

        running_jobs = RunningJobs.get()

        logger.info('--------CHECK_BEFORE_RUN---------')
        job_id = kwargs.get('_job_id')
        job_name = kwargs.get('_job_name')
        proc_id = kwargs.get('process_id')

        # check before run
        if not scheduler_check_before_run(job_id, job_name, proc_id, running_jobs):
            EventQueue.put(EventRescheduleJob(job_id=job_id, fn=fn, kwargs=kwargs))
            return None

        flask_app = scheduler.app
        with flask_app.app_context():
            logger.info(f'--------{job_id} START---------')

            try:
                running_jobs[job_id] = RunningJob(id=job_id, name=job_name, proc_id=proc_id)

                # FIXME: remove this function after 3 release. (Current release: 4.7.4v240)
                # We refactored our scheduler.
                # To avoid breaking changes that users' schedulers don't work,
                # we convert params from old scheduler to new scheduler.
                # This function should be delete in 3 release later.
                # When every user has new scheduler params in their database.
                new_scheduler_kwargs = convert_kwargs_from_old_scheduler(kwargs)

                acceptable_kwargs = filter_kwargs_for_function(fn, new_scheduler_kwargs)
                result = fn(**acceptable_kwargs)
                logger.info(f'--------{job_id} END-----------')
            except Exception as e:
                raise e
            finally:
                running_jobs.pop(job_id)
                # rollback and close session to avoid database locked.
                close_sessions()

            return result

    return inner


def convert_kwargs_from_old_scheduler(kwargs: dict[str, Any]) -> dict[str, Any]:
    """We don't want to create breaking changes for users, so we want to convert old kwargs in old scheduler
    This functions should be removed later: like 3 releases after that.
    """
    mapping_keys = {
        '_job_id': 'job_id',
        '_job_name': 'job_name',
        '_db_id': 'data_source_id',
        '_proc_id': 'process_id',
        '_proc_name': 'process_name',
        'proc_id': 'process_id',
    }

    new_kwargs_added = False

    new_kwargs = kwargs.copy()
    for old_key, new_key in mapping_keys.items():
        if old_key not in kwargs:  # There is no key to map.
            continue
        if new_kwargs.get(new_key) is not None:  # new_key's already existed
            continue
        new_kwargs[new_key] = kwargs[old_key]
        new_kwargs_added = True

    if new_kwargs_added:
        logger.warning('Converting from old scheduler to new scheduler')

    return new_kwargs


def filter_kwargs_for_function(function, kwargs: dict[str, Any]) -> dict[str, Any]:
    """Find all acceptable keyword arguments for a function
    If this function contains `**kwargs` we return all remaining
    If this function does not contain `**kwargs`, we must return correct arguments for them
    Please see: <https://docs.python.org/3/library/inspect.html#inspect.Parameter.kind> on how signature works
    """
    signature = inspect.signature(function)

    # function can contain all kwargs
    if any(p.kind == p.VAR_KEYWORD for p in signature.parameters.values()):
        return kwargs

    # function does contain kwargs, we return key that only exist in that
    acceptable_keys = {p.name for p in signature.parameters.values()}
    reduced_kwargs = {k: v for k, v in kwargs.items() if k in acceptable_keys}

    # delete signature
    del signature

    return reduced_kwargs


def is_job_existed_in_exclusive_jobs_with_ids(job: str, running_job_name: str):
    def extract_id_from_job(job_name: str) -> int | None:
        for exclusive_job_with_id in EXCLUSIVE_JOBS_WITH_IDS:
            if job_name.startswith(exclusive_job_with_id):
                id_from_job = job_name[len(exclusive_job_with_id) + 1 :]
                with contextlib.suppress(ValueError):
                    return int(id_from_job)
        return None

    job_id = extract_id_from_job(job)
    running_job_id = extract_id_from_job(running_job_name)
    return job_id is not None and running_job_id is not None and job_id == running_job_id


def scheduler_check_before_run(job_id, job_name, proc_id, running_jobs: dict[str, RunningJob]):
    """check if job can run parallel with other jobs"""

    logger.info(
        f'''\
job_id: {job_id}
job_name: {job_name}
proc_id: {proc_id}
RUNNING JOBS: {running_jobs}
''',
    )

    if job_id in running_jobs:
        logger.warning('The same job is running')
        return False

    for running_job in running_jobs.values():
        if is_job_existed_in_exclusive_jobs_with_ids(job_name, running_job.name):
            return False

        if (job_name, running_job.name) in CONFLICT_PAIR or (running_job.name, job_name) in CONFLICT_PAIR:
            logger.info(f'{job_name} job can not run parallel with {running_job.name}')
            return False

        if proc_id is not None and proc_id == running_job.proc_id:
            return False

    return True


@log_execution_time()
def remove_jobs(job_types, process_id=None):
    """remove all interval jobs

    Keyword Arguments:
        target_job_names {[type]} -- [description] (default: {None})
    """
    with lock:
        try:
            scheduler.pause()
            jobs = scheduler.get_jobs()
            for job in jobs:
                if job.name not in JobType.__members__ or JobType[job.name] not in job_types:
                    continue

                if process_id:
                    if job.id == f'{job.name}_{process_id}':
                        job.remove()
                else:
                    job.remove()
        except JobLookupError:
            pass
        finally:
            scheduler.resume()


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
