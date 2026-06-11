from datetime import datetime, timedelta
from pathlib import Path

import duckdb
from flask import current_app
from loguru import logger
from pytz import utc
from sqlalchemy import func

from ap import db
from ap.common.common_utils import convert_time, create_trigger_everyweek, function_to_generator
from ap.common.constants import APP_DB_FILE, DATE_FORMAT_STR_SQLITE, EXPORT_DATETIME_FORMAT, FileExtension, JobType
from ap.common.db_maintenance import get_backup_path
from ap.common.jobs.job_info_schema import BackupJobHistoryJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import get_sqlite_extension_file_path
from ap.common.scheduler import scheduler_app_context
from ap.common.timezone_utils import get_datetime_from_str
from ap.setting_module.models import JobManagement, make_session
from ap.setting_module.services.background_process import send_processing_info

BACKUP_JOB_OLDER_THAN = 7 * 5  # 5 weeks
BACKUP_JOB_FOLDER = Path(get_backup_path())


@log_execution_time()
def backup_job_history(job_management: JobManagement):
    """Backup old jobs that have created_at older than BACKUP_JOB_OLDER_THAN from now
    There are 2 steps in this flow:
    1. Export old jobs to parquet file
    2. Delete old jobs in t_job_management table
    """
    backup_job_history_job_info = BackupJobHistoryJobInfo()
    job_management.info = backup_job_history_job_info

    # set started time and message
    backup_job_history_job_info.started_at = datetime.now(utc)
    backup_job_history_job_info.info('Starting backup job history')

    now_utc = datetime.now(utc)
    milestone = now_utc - timedelta(days=BACKUP_JOB_OLDER_THAN)
    milestone_str: str = convert_time(milestone, format_str=DATE_FORMAT_STR_SQLITE)
    sqlite_extension_path = get_sqlite_extension_file_path()
    with duckdb.connect() as con:
        con.execute(f"LOAD '{sqlite_extension_path}';")
        con.execute(f"ATTACH '{current_app.config[APP_DB_FILE]}' AS sqlite_db (TYPE SQLITE);")
        con.execute('USE sqlite_db;')

        # Get min created_at, max created_at, row count of old jobs
        count_stmt = db.session.query(
            func.max(JobManagement.created_at).label('max_time'),
            func.min(JobManagement.created_at).label('min_time'),
            func.count().label('row_count'),
        ).filter(JobManagement.created_at <= milestone_str)
        count_compiled = count_stmt.statement.compile(compile_kwargs={'literal_binds': True})
        max_time, min_time, row_count = con.execute(count_compiled.string).fetchone()

        if row_count > 0:
            # Export old jobs to parquet file
            export_condition = db.session.query(JobManagement).filter(JobManagement.created_at <= milestone_str)
            export_max_time = convert_time(max_time, EXPORT_DATETIME_FORMAT)
            export_min_time = convert_time(min_time, EXPORT_DATETIME_FORMAT)
            file_path = (
                BACKUP_JOB_FOLDER
                / f'{JobManagement.__tablename__}_{export_min_time}_{export_max_time}.{FileExtension.Parquet.value}'
            )

            if not BACKUP_JOB_FOLDER.exists():
                BACKUP_JOB_FOLDER.mkdir(parents=True, exist_ok=True)
            elif file_path.exists():
                # In case file exist due to some reason, delete it before export
                file_path.unlink()

            export_compiled = export_condition.statement.compile(compile_kwargs={'literal_binds': True})
            con.execute(f"COPY ({export_compiled.string}) TO '{file_path}' (FORMAT PARQUET);")

            logger.info(f'[{JobType.BACKUP_JOB_HISTORY.name}] Exported old jobs to {file_path.absolute().as_posix()}')
            backup_job_history_job_info.backup_records = row_count
            backup_job_history_job_info.job_max_time = get_datetime_from_str(max_time)
            backup_job_history_job_info.job_min_time = get_datetime_from_str(min_time)
            backup_job_history_job_info.file_path = file_path.absolute().as_posix()

    if row_count > 0:
        # Delete old jobs in t_job_management table
        with make_session() as meta_session:
            deleted_records = JobManagement.delete_old_jobs(milestone_str, meta_session)
        logger.info(
            f'[{JobType.BACKUP_JOB_HISTORY.name}] Deleted {deleted_records} old jobs'
            f' in {JobManagement.__tablename__} table'
        )
        backup_job_history_job_info.deleted_records = deleted_records

    # finalize info
    backup_job_history_job_info.finished_at = datetime.now(utc)
    backup_job_history_job_info.info('Backup job history finished')


@scheduler_app_context
def backup_job_history_job(job_management: JobManagement):
    gen = function_to_generator(backup_job_history, job_management)
    send_processing_info(
        gen,
        job_management=job_management,
        retry_if_fail=True,
        retry_function_job=backup_job_history_job,
    )


def add_backup_job_history_job():
    """
    Registers a new cron job to run the backup operation weekly.
    Note: the schedule time to 3:00 AM local time every week start from current day.
    """
    trigger = create_trigger_everyweek()
    EventQueue.put(
        EventAddJob(
            fn=backup_job_history_job,
            job_type=JobType.BACKUP_JOB_HISTORY,
            replace_existing=True,
            trigger=trigger,
        ),
    )
