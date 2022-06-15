import os
from datetime import datetime

from apscheduler.triggers.cron import CronTrigger

from histview2 import log_execution, dic_config, SQLITE_CONFIG_DIR, APP_DB_FILE, UNIVERSAL_DB_FILE, make_dir
from histview2.common.common_utils import copy_file
from histview2.common.logger import log_execution_time
from histview2.common.scheduler import scheduler_app_context, JobType, add_job_to_scheduler
from histview2.setting_module.services.background_process import send_processing_info
from histview2.common.constants import AUTO_BACKUP
from histview2.common.yaml_utils import BasicConfigYaml

BACKUP_TRANS_DATA_INTERVAL_DAY = 7
CONFIG_BK_PATH = os.path.join(dic_config[SQLITE_CONFIG_DIR], 'backup')


@log_execution()
def backup_config_db():
    db_file_path = dic_config[APP_DB_FILE]
    make_dir(CONFIG_BK_PATH)
    copy_file(db_file_path, CONFIG_BK_PATH)


@log_execution()
def backup_universal_db():
    db_file_path = dic_config[UNIVERSAL_DB_FILE]
    today = datetime.now()
    created_date = datetime.fromtimestamp(os.path.getctime(db_file_path))
    if (today - created_date).days < BACKUP_TRANS_DATA_INTERVAL_DAY:
        return

    make_dir(CONFIG_BK_PATH)
    copy_file(dic_config[UNIVERSAL_DB_FILE], CONFIG_BK_PATH)


@log_execution()
def backup_dbs():
    basic_config_yaml = BasicConfigYaml()
    auto_backup = BasicConfigYaml.get_node(basic_config_yaml.dic_config, ['info', AUTO_BACKUP], False)
    yield 0
    backup_config_db()
    if auto_backup:
        yield 50
        backup_universal_db()
    yield 100


@scheduler_app_context
def backup_dbs_job(_job_id, _job_name, *args, **kwargs):
    """ backup config database

    Keyword Arguments:
        _job_id {[type]} -- [description] (default: {None})
        _job_name {[type]} -- [description] (default: {None})
    """
    gen = backup_dbs(*args, **kwargs)
    send_processing_info(gen, JobType.BACKUP_DATABASE)


@log_execution_time()
def add_backup_dbs_job(is_run_now=None):
    job_name = JobType.BACKUP_DATABASE.name
    trigger = CronTrigger(hour=3, minute=0, second=0)
    kwargs = dict(_job_id=job_name, _job_name=job_name)
    add_job_to_scheduler(job_id=job_name, job_name=job_name, trigger=trigger, import_func=backup_dbs_job,
                         run_now=is_run_now, dic_import_param=kwargs)
