from __future__ import annotations

from datetime import datetime

from apscheduler.triggers.date import DateTrigger
from pytz import utc

from ap import scheduler
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job
from ap.common.constants import JobType
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.services.background_process import send_processing_info
from ap.setting_module.services.backup_and_restore.backup import backup_db_data
from ap.setting_module.services.backup_and_restore.restore import restore_db_data


def add_backup_data_job(process_id, start_time, end_time):
    job_name = job_id = f'{JobType.USER_BACKUP_DATABASE.name}_{process_id}'
    dic_params = {
        '_job_id': job_id,
        '_job_name': job_name,
        'process_id': process_id,
        'start_time': start_time,
        'end_time': end_time,
    }
    scheduler.add_job(
        job_id,
        backup_data_job,
        trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
        replace_existing=True,
        kwargs=dic_params,
    )


@scheduler_app_context
def backup_data_job(_job_id, _job_name, *args, **kwargs):
    """
    :param _job_id:
    :param _job_name:
    :param args:
    :param kwargs:
    :return:
    """
    process_id = kwargs.get('process_id')
    gen = backup_db_data(*args, **kwargs)
    send_processing_info(gen, JobType.USER_BACKUP_DATABASE, process_id=process_id)
    add_gen_proc_link_job(process_id=process_id, is_user_request=True)


def add_restore_data_job(process_id, start_time, end_time):
    job_name = job_id = f'{JobType.USER_RESTORE_DATABASE.name}_{process_id}'
    dic_params = {
        '_job_id': job_id,
        '_job_name': job_name,
        'process_id': process_id,
        'start_time': start_time,
        'end_time': end_time,
    }
    scheduler.add_job(
        job_id,
        restore_data_job,
        trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
        replace_existing=True,
        kwargs=dic_params,
    )


@scheduler_app_context
def restore_data_job(_job_id, _job_name, *args, **kwargs):
    """
    :param _job_id:
    :param _job_name:
    :param args:
    :param kwargs:
    :return:
    """
    process_id = kwargs.get('process_id')
    gen = restore_db_data(*args, **kwargs)
    send_processing_info(gen, JobType.USER_RESTORE_DATABASE, process_id=process_id)
    add_gen_proc_link_job(process_id=process_id, is_user_request=True)
