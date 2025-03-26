from __future__ import annotations

import contextlib
import logging
from multiprocessing.managers import DictProxy

from ap.common.constants import JobType
from ap.common.jobs.jobs import RunningJob, RunningJobStatus

logger = logging.getLogger(__name__)

PRIORITY_JOBS = [
    JobType.UPDATE_TRANSACTION_TABLE.name,
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

CONFLICT_PAIR_JOBS_WITH_IDS = {
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.CSV_IMPORT.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.FACTORY_IMPORT.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.FACTORY_PAST_IMPORT.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.RESTRUCTURE_INDEXES.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.USER_BACKUP_DATABASE.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.USER_RESTORE_DATABASE.name),
    (JobType.UPDATE_TRANSACTION_TABLE.name, JobType.UPDATE_TRANSACTION_TABLE.name),
}

# jobs with `_id` suffixes
EXCLUSIVE_JOBS_WITH_IDS = {
    JobType.USER_BACKUP_DATABASE.name,
    JobType.USER_RESTORE_DATABASE.name,
}


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


def is_conflict_jobs_with_ids(job_id: str, running_job_id: str):
    def _extract_process_id_from_job_id(_job_name: str) -> str | None:
        for job_with_id in CONFLICT_PAIR_JOBS_WITH_IDS:
            if _job_name.startswith(job_with_id):
                return _job_name[len(job_with_id) + 1 :]
        return None

    process_id = _extract_process_id_from_job_id(job_id)
    running_process_id = _extract_process_id_from_job_id(running_job_id)

    if process_id is None or running_process_id is None or process_id != running_process_id:
        return False

    job_name_without_id = job_id.replace(f'_{process_id}', '')
    running_job_name_without_id = running_job_id.replace(f'_{running_process_id}', '')

    return (job_name_without_id, running_job_name_without_id) in CONFLICT_PAIR or (
        running_job_name_without_id,
        job_name_without_id,
    ) in CONFLICT_PAIR


def is_conflict_with_other_jobs(job_id, job_name, proc_id, running_jobs: DictProxy[str, RunningJob]) -> bool:
    """
    Check if this job is conflicting with other running jobs
    :return bool: True if conflicting otherwise False
    """
    logger.info(f'{job_id}: check conflict with other running jobs')

    for running_job in running_jobs.values():
        # Do not check conflict with executed jobs
        if running_job.status is RunningJobStatus.EXECUTED:
            continue

        if is_job_existed_in_exclusive_jobs_with_ids(job_name, running_job.name):
            logger.info(f'{job_id}: existed in exclusive jobs with {running_job.name}')
            return True

        if (
            (job_name, running_job.name) in CONFLICT_PAIR
            or (running_job.name, job_name) in CONFLICT_PAIR
            or is_conflict_jobs_with_ids(job_id, running_job.id)
        ):
            logger.info(f'{job_id}: cannot run in parallel with {running_job.id}')
            return True

        if proc_id is not None and proc_id == running_job.proc_id:
            logger.info(f'{job_id}: cannot run multiple jobs with the same {proc_id}')
            return True

    return False
