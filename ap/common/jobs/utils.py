import contextlib
from typing import Optional, Union

from apscheduler.jobstores.base import JobLookupError

from ap import log_execution_time, scheduler
from ap.common.common_utils import generate_job_id
from ap.common.constants import JobType
from ap.common.jobs.jobs import RunningJob, RunningJobs


def remove_job(job_id: str):
    """Remove a job from scheduler

    :param str job_id:
    :return: void
    """
    with contextlib.suppress(JobLookupError):
        scheduler.remove_job(job_id)


@log_execution_time()
def remove_jobs(job_types: list[JobType], process_id: Optional[int] = None):
    """Remove all interval jobs

    :param list[JobType] job_types:
    :param Optional[int] process_id:
    :return: void
    """
    kill_jobs(job_types, process_id=process_id)
    for job_type in job_types:
        job_id = generate_job_id(job_type, process_id)
        remove_job(job_id)


def kill_jobs(job_types: list[JobType], process_id: Optional[int] = None):
    """Kill all interval jobs by type and process id

    :param list[JobType] job_types:
    :param Optional[int] process_id process_id:
    :return: void
    """
    running_jobs = RunningJobs.get_running_jobs()
    with RunningJobs.lock():
        for job_type in job_types:
            job_id = generate_job_id(job_type, process_id)
            running_job: Optional[RunningJob] = running_jobs.get(job_id)
            if running_job:
                running_job.update(wait_to_kill=True, running_jobs=running_jobs)


def kill_all_jobs():
    """Kill all running jobs
    :return: void"""
    running_jobs = RunningJobs.get_running_jobs()
    with RunningJobs.lock():
        for job in running_jobs.values():
            job.update(wait_to_kill=True, running_jobs=running_jobs)


def is_update_transaction_data_job_completed(process_id: Union[int, str]):
    """
    Check UPDATE_TRANSACTION_DATA job of process_id is executed completely or not

    A job is completed if and only if it does not exist in scheduled yet.

    :param Union[int, str] process_id: a process id
    :return: True: the job is executed completely, otherwise False
    """

    job_id = generate_job_id(JobType.UPDATE_TRANSACTION_TABLE, process_id)
    return scheduler.get_job(job_id) is None
