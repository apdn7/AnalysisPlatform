import os
from datetime import datetime

from apscheduler.triggers.cron import CronTrigger
from dateutil import tz
from loguru import logger
from pytz import utc

from ap import (
    APP_DB_FILE,
    SQLITE_CONFIG_DIR,
    dic_config,
)
from ap.common.constants import JobType
from ap.common.jobs.job_info_schema import BackupDatabaseJobInfo
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import copy_file, make_dir
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import JobManagement
from ap.setting_module.services.background_process import send_processing_info

BACKUP_TRANS_DATA_INTERVAL_DAY = 7
DB_MAINTENANCE_TIME = (3, 0, 0)  # 3AM local time


def get_backup_path():
    return os.path.join(dic_config[SQLITE_CONFIG_DIR], 'backup')


@log_execution_time()
def backup_config_db():
    backup_path = get_backup_path()
    db_file_path = dic_config[APP_DB_FILE]
    make_dir(backup_path)
    # Perform copy; destination is backup folder with same file name
    copy_file(db_file_path, backup_path)
    dest_path = os.path.join(backup_path, os.path.basename(db_file_path))
    try:
        size = os.path.getsize(dest_path)
    except OSError:
        size = 0
    logger.info('Backup database')
    return dest_path, size


# @log_execution_time()
# def backup_universal_db():
#     backup_path = get_backup_path()
#     db_file_path = dic_config[UNIVERSAL_DB_FILE]
#     today = datetime.now()
#     created_date = datetime.fromtimestamp(os.path.getctime(db_file_path))
#     if (today - created_date).days < BACKUP_TRANS_DATA_INTERVAL_DAY:
#         return
#
#     make_dir(backup_path)
#     copy_file(dic_config[UNIVERSAL_DB_FILE], backup_path)


@log_execution_time()
def backup_dbs(job_management: JobManagement):
    # Emit starting percent
    yield 0

    job_management.info = BackupDatabaseJobInfo()

    # set started time and message
    job_management.info.started_at = datetime.now(utc)
    job_management.info.info('Starting config database backup!!')

    # perform backup and populate info
    dest_path, size = backup_config_db()
    job_management.info.backup_size = int(size or 0)
    job_management.info.backup_location = dest_path

    # finalize info
    job_management.info.finished_at = datetime.now(utc)
    job_management.info.info(f'Backup finished: {dest_path} ({size} bytes)')

    # finish percent
    yield 100


@scheduler_app_context
def backup_dbs_job(job_management: JobManagement):
    """Backup config database"""
    gen = backup_dbs(job_management)
    send_processing_info(gen, job_management=job_management)


@log_execution_time()
def add_backup_dbs_job(is_run_now=None):
    # backup db job run at 3 AM local time
    backup_db_at = DB_MAINTENANCE_TIME
    # generate datetime of today
    today = datetime.today()
    local_datetime = datetime(today.year, today.month, today.day, *backup_db_at)
    # convert to utc
    utc_datetime = local_datetime.astimezone(tz.tzutc())
    trigger = CronTrigger(hour=utc_datetime.hour, minute=backup_db_at[1], second=backup_db_at[2], timezone=utc)

    next_run_time = None
    if is_run_now:
        next_run_time = datetime.now().astimezone(utc)

    EventQueue.put(
        EventAddJob(
            fn=backup_dbs_job,
            job_type=JobType.BACKUP_DATABASE,
            replace_existing=True,
            trigger=trigger,
            next_run_time=next_run_time,
        ),
    )
