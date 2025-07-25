import contextlib
from typing import Optional, Union

from apscheduler.jobstores.base import JobLookupError

from ap import log_execution_time, scheduler
from ap.common.common_utils import generate_job_id
from ap.common.constants import JobType
from ap.common.jobs.jobs import RunningJob, RunningJobs


def remove_job(job_id: str, process_id: Optional[Union[str, int]] = None):
    """Remove a job from scheduler

    :param str job_id:
    :param Optional[Union[str, int]] process_id:
    :return: void
    """
    with contextlib.suppress(JobLookupError):
        all_jobs = scheduler.get_jobs()
        job_ids = [job_id] if process_id else [job.id for job in all_jobs if job.name == job_id]
        for jid in job_ids:
            scheduler.remove_job(jid)


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
        remove_job(job_id, process_id=process_id)


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


def get_update_transaction_table_job(process_id: Union[int, str]):
    """
    Get UPDATE_TRANSACTION_TABLE job of process_id

    :param Union[int, str] process_id: a process id
    :return: the job, otherwise None
    """

    job_id = generate_job_id(JobType.UPDATE_TRANSACTION_TABLE, process_id)
    return scheduler.get_job(job_id)
