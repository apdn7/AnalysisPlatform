from datetime import datetime, timedelta

from loguru import logger
from pytz import utc

from ap.common.backup_job_history import BACKUP_JOB_FOLDER
from ap.common.common_utils import create_trigger_everyweek, function_to_generator
from ap.common.constants import FileExtension, JobType
from ap.common.jobs.job_info_schema import CleanupJobHistoryJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import JobManagement
from ap.setting_module.services.background_process import send_processing_info

CLEANUP_JOB_OLDER_THAN = 30 * 3  # 3 months


@log_execution_time()
def cleanup_job_history(job_management: JobManagement):
    """Delete old backup job files that were created from {CLEANUP_JOB_OLDER_THAN} days ago or older."""
    cleanup_job_history_job_info = CleanupJobHistoryJobInfo()
    job_management.info = cleanup_job_history_job_info

    # set started time and message
    cleanup_job_history_job_info.started_at = datetime.now(utc)
    cleanup_job_history_job_info.info('Starting cleanup job history')

    now = datetime.now()
    milestone = now - timedelta(days=CLEANUP_JOB_OLDER_THAN)

    if not BACKUP_JOB_FOLDER.exists():
        BACKUP_JOB_FOLDER.mkdir(parents=True, exist_ok=True)

    for file in BACKUP_JOB_FOLDER.rglob(f'*.{FileExtension.Parquet.value}'):
        # using st_mtime instead of st_ctime because it will work cross-platform and stable to detect
        # But it depends on modified date
        created_time = datetime.fromtimestamp(file.stat().st_mtime, tz=now.tzinfo)

        if created_time <= milestone:
            file.unlink()
            cleanup_job_history_job_info.deleted_files.append(
                CleanupJobHistoryJobInfo.DeletedFile(file_path=file.as_posix())
            )
            logger.info(f'[{JobType.CLEANUP_JOB_HISTORY.name}] Deleted file: {file.as_posix()}')

    # finalize info
    cleanup_job_history_job_info.finished_at = datetime.now(utc)
    cleanup_job_history_job_info.info('Cleanup job history finished')


@scheduler_app_context
def cleanup_job_history_job(job_management: JobManagement):
    gen = function_to_generator(cleanup_job_history, job_management)
    send_processing_info(
        gen,
        job_management=job_management,
    )


def add_cleanup_job_history_job():
    """
    Registers a new cron job to run the cleanup operation weekly.
    Note: the schedule time to 3:00 AM local time every week start from current day.
    """
    trigger = create_trigger_everyweek()
    EventQueue.put(
        EventAddJob(
            fn=cleanup_job_history_job,
            job_type=JobType.CLEANUP_JOB_HISTORY,
            replace_existing=True,
            trigger=trigger,
        ),
    )
