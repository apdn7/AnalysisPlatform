import logging
from datetime import datetime, timedelta

import pytz
from apscheduler.triggers.cron import CronTrigger

from ap import db
from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgRequest

logger = logging.getLogger(__name__)


def get_expired_reqs():
    now = datetime.now().astimezone(pytz.utc)
    expired_time = now + timedelta(days=-1)
    expired_req_ids = CfgRequest.find_all_expired_reqs(expired_time)

    return expired_req_ids


@scheduler_app_context
def delete_old_requests():
    expired_reqs = get_expired_reqs()
    if expired_reqs:
        for request in expired_reqs:
            db.session.delete(request)
            db.session.commit()

        logger.info('-------- EXPIRED REQUESTS DELETED --------')
    else:
        logger.info('-------- NO REQUEST TO DELETE --------')


@log_execution_time()
def add_job_delete_expired_request(run_now=True):
    logger.info(f'-------- ADD JOB {JobType.CLEAN_EXPIRED_REQUEST.name} --------')

    run_time = (0, 0, 0)
    # generate datetime of today
    today = datetime.today()
    local_datetime = datetime(today.year, today.month, today.day, *run_time)

    # convert to utc
    utc_datetime = local_datetime.astimezone(pytz.utc)
    trigger = CronTrigger(hour=utc_datetime.hour, minute=run_time[1], second=run_time[2], timezone=pytz.utc)

    EventQueue.put(
        EventAddJob(
            fn=delete_old_requests,
            job_type=JobType.CLEAN_EXPIRED_REQUEST,
            trigger=trigger,
            replace_existing=True,
            next_run_time=datetime.utcnow() if run_now else None,
        ),
    )
    return True
