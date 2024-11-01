from collections.abc import Callable
from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel

from ap.common.constants import AnnounceEvent, CacheType, JobType
from ap.common.multiprocess_sharing.event_base import EventBaseFunction


class SchedulerJobParams(BaseModel):
    id: str
    name: str
    func: Callable
    kwargs: dict[str, Any]
    replace_existing: bool = False
    trigger: Any  # cannot infer type for trigger
    next_run_time: Optional[datetime] = None
    executor: Optional[str] = None


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
    trigger: Any  # cannot infer type for trigger
    next_run_time: Optional[datetime] = None
    executor: Optional[str] = None

    @property
    def job_params(self):
        """Parameters from `EventAddJob` and parameters to passing to scheduler is different, need to convert them"""
        job_params = SchedulerJobParams(
            id=self.job_id,
            name=self.job_name,
            func=self.function,
            # FIXME: need to include `_job_id`, `_job_name`, etc into job_params because downstream function need them
            kwargs=self.func_params,
            replace_existing=self.replace_existing,
            trigger=self.trigger,
            next_run_time=self.next_run_time,
            executor=self.executor,
        )
        return job_params.model_dump(exclude_none=True)

    @property
    def func_params(self):
        """Parameter for function running inside scheduler"""
        kwargs = self.kwargs

        # add some additional params because downstream function needs to accses to them in order to determine
        # which jobs are running, so that we can skip / reschedule them
        kwargs.update(
            {
                '_job_id': self.job_id,
                '_job_name': self.job_name,
                'data_source_id': self.data_source_id,
                'process_id': self.process_id,
                'process_name': self.process_name,
            },
        )

        return kwargs

    @property
    def job_id(self) -> str:
        """Construct job id: `prefix_jobType_processId_suffix"""
        job_id = self.job_type.name

        if self.process_id is not None:
            job_id = f'{job_id}_{self.process_id}'
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

    data: Any
    event: AnnounceEvent
    job_id: Optional[Any] = None  # FIXME: change to correct type later


class EventShutDown(BaseModel):
    """Event for shutting down application"""

    ...


# union event type
Event = Union[
    EventRescheduleJob,
    EventAddJob,
    EventRunFunction,
    EventExpireCache,
    EventBackgroundAnnounce,
    EventShutDown,
    EventRemoveJobs,
]
