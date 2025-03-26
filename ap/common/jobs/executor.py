import logging
from typing import Any, Callable

from apscheduler.events import JobExecutionEvent
from apscheduler.executors.base import BaseExecutor
from apscheduler.executors.pool import ProcessPoolExecutor, ThreadPoolExecutor
from apscheduler.job import Job

from ap.common.jobs.conflict import is_conflict_with_other_jobs
from ap.common.jobs.jobs import JobKwargs, RunningJob, RunningJobs, RunningJobStatus
from ap.common.jobs.trigger import always_trigger_job, unwrap_always_triggered_job

logger = logging.getLogger(__name__)


def mark_finished_job_done(event: JobExecutionEvent):
    """Event listener for: EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED
    That mark each finished job as done
    """
    running_jobs = RunningJobs.get_running_jobs()

    with RunningJobs.lock():
        running_job = running_jobs.get(event.job_id)
        running_job.update(status=RunningJobStatus.EXECUTED, running_jobs=running_jobs)
        logger.info(f'{event.job_id}: mark complete executing job as done')


def verify_job_submission(submit_function: Callable[[BaseExecutor, Job, list[Any]], Any]):
    def wrapper(self: BaseExecutor, job: Job, run_times, **kwargs: Any) -> Any:
        running_jobs = RunningJobs.get_running_jobs()

        # lock order is `scheduler lock` then `running jobs` lock, DO NOT revert this order.
        with RunningJobs.lock():
            job_kwargs = JobKwargs.verify(job)

            logger.info(f'{job_kwargs.job_id}: check before submitting')

            # Always re-trigger the job,
            # so that if our application failed / shutdown, or if the job cannot be submitted,
            # it will always be rescheduled after a fixed time (in this case 30 seconds)
            # without being removed from scheduler.
            always_trigger_job(job)

            running_job = running_jobs.get(job_kwargs.job_id, None)

            if running_job is not None:
                # update added time so that it can be verified correctly
                running_job.update(added_at=job_kwargs.job_added_at, running_jobs=running_jobs)

                # Job is running
                if running_job.status is RunningJobStatus.EXECUTING:
                    logger.info(f'{job_kwargs.job_id}: already running')
                    # Do not submit
                    return

                # Job is not running, remove it
                running_jobs.pop(running_job.id, None)

                # Job is finished, we don't need to always-trigger it anymore
                # Return right away and let the scheduler decides if it should be removed or re-run later
                if not running_job.modified():
                    unwrap_always_triggered_job(job)
                    logger.info(f'{job_kwargs.job_id}: already finished, schedule for the next run')
                    # Do not submit
                    return

            # We can be sure that the job is not running for now.
            # Can try to submit.

            # check before run and tell scheduler that we cannot submit our job
            if is_conflict_with_other_jobs(job_kwargs.job_id, job_kwargs.job_name, job_kwargs.proc_id, running_jobs):
                return

            try:
                # We need to mark our job as running here so that we don't run into awkward situation that our job
                # run so fast that it finishes right after submitting, but before we put it into `running_jobs`
                running_jobs[job_kwargs.job_id] = RunningJob(
                    id=job_kwargs.job_id,
                    name=job_kwargs.job_name,
                    proc_id=job_kwargs.proc_id,
                    added_at=job_kwargs.job_added_at,
                    status=RunningJobStatus.EXECUTING,
                )
                logger.info(f'{job_kwargs.job_id}: started to run')
                submit_function(self, job, run_times)
            except Exception as e:
                # `super.submit_job` runs into problems,
                # need to pop it out from `running_jobs` since we added it before submitting
                running_jobs.pop(job_kwargs.job_id, None)
                raise e

    return wrapper


class CustomizeProcessPoolExecutor(ProcessPoolExecutor):
    """Customize process pool executor, so we can add custom checks when submitting a job"""

    @verify_job_submission
    def submit_job(self, job: Job, run_times):
        super().submit_job(job, run_times)


class CustomizeThreadPoolExecutor(ThreadPoolExecutor):
    """Customize thread pool executor, so we can add custom checks when submitting a job"""

    @verify_job_submission
    def submit_job(self, job: Job, run_times):
        super().submit_job(job, run_times)
