from datetime import datetime, timedelta

import pytz
from apscheduler.triggers.cron import CronTrigger

from ap import db, scheduler
from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgRequest


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

    # add_job_delete_expired_request(run_now=False)


@log_execution_time()
def add_job_delete_expired_request(run_now=True):
    print(f'-------- ADD JOB {JobType.CLEAN_EXPIRED_REQUEST.name} --------')

    run_time = (0, 0, 0)
    # generate datetime of today
    today = datetime.today()
    local_datetime = datetime(today.year, today.month, today.day, *run_time)

    # convert to utc
    utc_datetime = local_datetime.astimezone(pytz.utc)
    trigger = CronTrigger(hour=utc_datetime.hour, minute=run_time[1], second=run_time[2], timezone=pytz.utc)

    dic_params = {}
    if run_now:
        run_time = datetime.utcnow()
        dic_params = {'next_run_time': run_time}

    scheduler.add_job(
        JobType.CLEAN_EXPIRED_REQUEST.name,
        delete_old_requests,
        trigger=trigger,
        replace_existing=True,
        kwargs={
            '_job_id': JobType.CLEAN_EXPIRED_REQUEST.name,
            '_job_name': JobType.CLEAN_EXPIRED_REQUEST.name,
        },
        **dic_params,
    )
    return True
