from datetime import datetime, timedelta

import pytz
from apscheduler.triggers import interval
from apscheduler.triggers.interval import IntervalTrigger

from ap import db, scheduler
from ap.common.constants import CLEAN_REQUEST_INTERVAL
from ap.common.logger import log_execution_time
from ap.common.scheduler import JobType, scheduler_app_context
from ap.setting_module.models import CfgOption, CfgProcess, CfgRequest


@scheduler_app_context
def get_expired_reqs():
    now = datetime.now().astimezone(pytz.utc)
    expired_time = now + timedelta(days=-1)
    expired_req_ids = CfgRequest.find_all_expired_reqs(expired_time)

    return expired_req_ids


@scheduler_app_context
def delete_old_requests(_job_id=None, _job_name=None):
    expired_reqs = get_expired_reqs()
    if expired_reqs:
        for request in expired_reqs:
            db.session.delete(request)
            db.session.commit()

        print('-------- EXPIRED REQUESTS DELETED --------')
    else:
        print('-------- NO REQUEST TO DELETE --------')

    add_job_delete_expired_request(run_now=False)


@log_execution_time()
def add_job_delete_expired_request(run_now=True):
    print(f'-------- ADD JOB {JobType.CLEAN_EXPIRED_REQUEST.name} --------')
    interval_trigger = interval.IntervalTrigger(hours=CLEAN_REQUEST_INTERVAL, minutes=0, seconds=0)
    run_time = datetime.now()
    if not run_now:
        run_time = run_time.replace(hour=0, minute=0, second=0, microsecond=0)
        run_time += timedelta(days=1)
    run_time = run_time.astimezone(pytz.utc)
    scheduler.add_job(
        JobType.CLEAN_EXPIRED_REQUEST.name,
        delete_old_requests,
        trigger=interval_trigger,
        next_run_time=run_time,
        replace_existing=True,
        kwargs=dict(
            _job_id=JobType.CLEAN_EXPIRED_REQUEST.name, _job_name=JobType.CLEAN_EXPIRED_REQUEST.name
        ),
    )
    return True
