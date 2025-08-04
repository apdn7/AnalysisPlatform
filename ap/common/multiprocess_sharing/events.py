from collections.abc import Callable
from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, Field
from pytz import utc

from ap.common.common_utils import generate_job_id
from ap.common.constants import AnnounceEvent, CacheType, JobType
from ap.common.multiprocess_sharing.event_base import EventBaseFunction


class SchedulerJobParams(BaseModel):
    id: str
    """explicit identifier for the job (for modifying it later)"""
    name: str
    """textual description of the job"""
    func: Callable
    """callable (or a textual reference to one) to run at the given time"""
    args: Optional[Union[list, tuple]] = None
    """list of positional arguments to call func with"""
    kwargs: dict[str, Any]
    """dict of keyword arguments to call func with"""
    replace_existing: bool = False
    """``True`` to replace an existing job with the same ``id`` (but retain the number of runs from the existing one)"""
    trigger: Any = None  # cannot infer type for trigger
    """trigger that determines when ``func`` is called"""
    next_run_time: Optional[datetime] = None
    """when to first run the job, regardless of the trigger (pass ``None`` to add the job as paused)"""
    executor: Optional[str] = None
    """alias of the executor to run the job with"""
    max_instances: Optional[int] = None
    """maximum number of concurrently running instances allowed for this job"""
    coalesce: Optional[bool] = None
    """run once instead of many times if the scheduler determines that the job should be run more than once in
     succession"""
    misfire_grace_time: Optional[int] = None
    """seconds after the designated runtime that the job is still allowed to be run (or ``None`` to allow the job to
     run no matter how late it is)"""


class EventAddJob(EventBaseFunction):
    """Event handle adding new jobs"""

    # type of jobs
    job_type: JobType
    # prefix for jobs, used for distinguish with other jobs
    job_id_prefix: Optional[str] = None
    # suffix for jobs, used for distinguish with other jobs
    job_id_suffix: Optional[str] = None

    data_source_id: Optional[int] = None
    process_id: Optional[int] = None
    process_name: Optional[str] = None

    # scheduler jobs parameters
    replace_existing: bool = False
    trigger: Any = None  # cannot infer type for trigger
    next_run_time: Optional[datetime] = None
    executor: Optional[str] = None
    max_instances: Optional[int] = None
    coalesce: Optional[bool] = None
    misfire_grace_time: Optional[int] = None

    @property
    def job_params(self):
        """Parameters from `EventAddJob` and parameters to passing to scheduler is different, need to convert them"""
        job_params = SchedulerJobParams(
            id=self.job_id,
            name=self.job_name,
            func=self.function,
            args=None,
            # FIXME: need to include `_job_id`, `_job_name`, etc into job_params because downstream function need them
            kwargs=self.func_params,
            replace_existing=self.replace_existing,
            trigger=self.trigger,
            next_run_time=self.next_run_time,
            executor=self.executor,
            max_instances=self.max_instances,
            coalesce=self.coalesce,
            misfire_grace_time=self.misfire_grace_time,
        )
        return job_params.model_dump(exclude_none=True)

    @property
    def func_params(self):
        """Parameter for function running inside scheduler"""
        kwargs = self.kwargs

        # add some additional params because downstream function needs to access to them in order to determine
        # which jobs are running, so that we can skip / reschedule them
        kwargs.update(
            {
                '_job_id': self.job_id,
                '_job_name': self.job_name,
                '_job_added_at': datetime.now(utc),
                'data_source_id': self.data_source_id,
                'process_id': self.process_id,
                'process_name': self.process_name,
                'job_type': self.job_type,
            },
        )

        return kwargs

    @property
    def job_id(self) -> str:
        """Construct job id: `prefix_jobType_processId_suffix"""
        job_id = self.job_type.name

        if self.process_id is not None:
            job_id = generate_job_id(job_id, self.process_id)
        if self.job_id_prefix is not None:
            job_id = f'{self.job_id_prefix}_{job_id}'
        if self.job_id_suffix is not None:
            job_id = f'{job_id}_{self.job_id_suffix}'

        return job_id

    @property
    def job_name(self):
        return self.job_type.name


class EventRescheduleJob(EventBaseFunction):
    """Event for rescheduling jobs"""

    job_id: str
    reschedule_seconds: Optional[int] = None
    """Delay in seconds from datetime now"""


class EventRemoveJobs(BaseModel):
    """Event for removing jobs"""

    job_types: list[JobType]
    process_id: Optional[Union[str, int]] = None


class EventRunFunction(EventBaseFunction):
    """Event for running a function, this function is run immediately in thread"""

    ...


class EventExpireCache(BaseModel):
    """Event for expiring cache, this is simply remove all caches"""

    cache_type: CacheType


class EventBackgroundAnnounce(BaseModel):
    """Event for background announcement, this will notify front-end what is happening"""

    data: Any = None
    event: AnnounceEvent
    job_id: Optional[Any] = None  # FIXME: change to correct type later
    timestamp: datetime = Field(default_factory=datetime.now)


class EventShutDown(BaseModel):
    """Event for shutting down application"""

    ...


class EventKillJobs(BaseModel):
    """Event for killing jobs"""

    job_types: list[JobType]
    process_id: Optional[Union[str, int]] = None


# union event type
Event = Union[
    EventRescheduleJob,
    EventAddJob,
    EventRunFunction,
    EventExpireCache,
    EventBackgroundAnnounce,
    EventShutDown,
    EventRemoveJobs,
    EventKillJobs,
]
