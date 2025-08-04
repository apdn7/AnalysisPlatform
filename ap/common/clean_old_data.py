import datetime as dt

from apscheduler.triggers import interval
from pytz import utc

from ap.common.constants import JobType
from ap.common.logger import (
    CLEAN_ZIP_INTERVAL,
    ZIP_LOG_INTERVAL,
    ZipFileHandler,
)
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import get_data_path


def add_job_zip_all_previous_log_files():
    log_path = get_data_path(is_log=True)
    interval_trigger = interval.IntervalTrigger(seconds=ZIP_LOG_INTERVAL, timezone=utc)
    EventQueue.put(
        EventAddJob(
            fn=ZipFileHandler.zip_all_previous_files,
            kwargs={'path': log_path},
            job_type=JobType.ZIP_LOG,
            trigger=interval_trigger,
            replace_existing=True,
            next_run_time=dt.datetime.now().astimezone(utc),
        ),
    )


def add_job_delete_old_zipped_log_files():
    log_path = get_data_path(is_log=True)
    interval_trigger = interval.IntervalTrigger(seconds=CLEAN_ZIP_INTERVAL, timezone=utc)
    EventQueue.put(
        EventAddJob(
            fn=ZipFileHandler.delete_old_zipped_files,
            kwargs={'path': log_path},
            job_type=JobType.CLEAN_ZIP,
            trigger=interval_trigger,
            replace_existing=True,
            next_run_time=dt.datetime.now().astimezone(utc),
        ),
    )
