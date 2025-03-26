from __future__ import annotations

from datetime import datetime, timedelta

from apscheduler.job import Job
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from flask_apscheduler import APScheduler
from pytz import utc


class CustomizeScheduler(APScheduler):
    RESCHEDULE_SECONDS = 30
    # TODO: add lock here

    def add_job(self, id, func, **kwargs):
        super().add_job(id, func, **kwargs)

    def reschedule_job(self, id, func, func_params, reschedule_seconds: int = RESCHEDULE_SECONDS):
        job: Job | None = self.get_job(id)
        run_time = datetime.now().astimezone(utc) + timedelta(seconds=reschedule_seconds)

        if job:
            job.next_run_time = run_time
            if job.trigger:
                if isinstance(job.trigger, DateTrigger):
                    job.trigger.run_date = run_time
                elif isinstance(job.trigger, IntervalTrigger):
                    job.trigger.start_date = run_time
            # TODO: this is not correct, we should use `job.modify` instead
            job.reschedule(trigger=job.trigger)
        else:
            trigger = DateTrigger(run_date=run_time, timezone=utc)
            self.add_job(id, func, trigger=trigger, replace_existing=True, kwargs=func_params)
