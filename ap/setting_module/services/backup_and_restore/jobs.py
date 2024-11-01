from __future__ import annotations

from datetime import datetime

from apscheduler.triggers.date import DateTrigger
from pytz import utc

from ap.api.trace_data.services.proc_link import add_gen_proc_link_job
from ap.common.constants import JobType
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.services.background_process import send_processing_info
from ap.setting_module.services.backup_and_restore.backup import backup_db_data
from ap.setting_module.services.backup_and_restore.restore import restore_db_data


def add_backup_data_job(process_id, start_time, end_time):
    EventQueue.put(
        EventAddJob(
            fn=backup_data_job,
            kwargs={
                'process_id': process_id,
                'start_time': start_time,
                'end_time': end_time,
            },
            job_type=JobType.USER_BACKUP_DATABASE,
            process_id=process_id,
            trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
            replace_existing=True,
        ),
    )


@scheduler_app_context
def backup_data_job(process_id: int, start_time: str, end_time: str):
    gen = backup_db_data(process_id, start_time, end_time)
    send_processing_info(gen, JobType.USER_BACKUP_DATABASE, process_id=process_id)
    add_gen_proc_link_job(process_id=process_id, is_user_request=True)


def add_restore_data_job(process_id, start_time, end_time):
    EventQueue.put(
        EventAddJob(
            fn=restore_data_job,
            kwargs={
                'process_id': process_id,
                'start_time': start_time,
                'end_time': end_time,
            },
            job_type=JobType.USER_RESTORE_DATABASE,
            process_id=process_id,
            trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
            replace_existing=True,
        ),
    )


@scheduler_app_context
def restore_data_job(process_id: int, start_time: str, end_time: str):
    gen = restore_db_data(process_id, start_time, end_time)
    send_processing_info(gen, JobType.USER_RESTORE_DATABASE, process_id=process_id)
    add_gen_proc_link_job(process_id=process_id, is_user_request=True)
