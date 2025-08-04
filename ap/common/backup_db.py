import logging
import os
from datetime import datetime

from apscheduler.triggers.cron import CronTrigger
from dateutil import tz
from pytz import utc

from ap import (
    APP_DB_FILE,
    SQLITE_CONFIG_DIR,
    dic_config,
)
from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import copy_file, make_dir
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.services.background_process import send_processing_info

logger = logging.getLogger(__name__)

BACKUP_TRANS_DATA_INTERVAL_DAY = 7


def get_backup_path():
    return os.path.join(dic_config[SQLITE_CONFIG_DIR], 'backup')


@log_execution_time()
def backup_config_db():
    backup_path = get_backup_path()
    db_file_path = dic_config[APP_DB_FILE]
    make_dir(backup_path)
    copy_file(db_file_path, backup_path)
    logger.info('Backup database')


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
def backup_dbs():
    # basic_config_yaml = get_basic_yaml_obj()
    # auto_backup = basic_config_yaml.get_node(['info', AUTO_BACKUP], False)
    yield 0
    backup_config_db()
    # if auto_backup:
    #     yield 50
    #     backup_universal_db()
    yield 100


@scheduler_app_context
def backup_dbs_job():
    """backup config database"""
    gen = backup_dbs()
    send_processing_info(gen, JobType.BACKUP_DATABASE)


@log_execution_time()
def add_backup_dbs_job(is_run_now=None):
    # backup db job run at 3 AM local time
    backup_db_at = (3, 0, 0)
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
