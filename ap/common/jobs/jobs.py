from __future__ import annotations

import contextlib
import logging
import threading
from datetime import datetime
from enum import auto
from multiprocessing.managers import DictProxy
from typing import Optional

from apscheduler.job import Job
from pydantic import BaseModel, ConfigDict, Field
from pytz import utc

from ap.common.constants import BaseEnum
from ap.common.multiprocess_sharing.manager import AcquirerProxy, CustomManager

logger = logging.getLogger(__name__)


class JobKwargs(BaseModel):
    """Optional parameters for verifying submitting and removing job"""

    job_id: Optional[str] = Field(None, alias='_job_id')
    job_name: Optional[str] = Field(None, alias='_job_name')
    job_added_at: datetime = Field(alias='_job_added_at', default_factory=lambda: datetime.now(utc))
    proc_id: Optional[int] = Field(None, alias='process_id')

    @classmethod
    def verify(cls, job: Job) -> 'JobKwargs':
        job_kwargs = cls.model_validate(job.kwargs)

        # Fix `job_added_at` for old application
        job.kwargs['_job_added_at'] = job_kwargs.job_added_at

        return job_kwargs


class RunningJobStatus(BaseEnum):
    EXECUTED = auto()
    EXECUTING = auto()


class RunningJob(BaseModel):
    id: str = ConfigDict(coerce_numbers_to_str=True)
    name: str = ConfigDict(coerce_numbers_to_str=True)
    proc_id: Optional[int] = ConfigDict(coerce_numbers_to_str=True)

    # When this job was added to the scheduler
    added_at: datetime = Field(default_factory=lambda: datetime.now(utc))

    # When this job was scheduled to run
    run_at: datetime = Field(default_factory=lambda: datetime.now(utc))

    wait_to_kill: bool = False
    status: RunningJobStatus = RunningJobStatus.EXECUTING

    def modified(self):
        """
        Check if a job is modified after it was added
        ----|run_at|----|added_at|----|now|----
        """
        return self.added_at > self.run_at

    def update(
        self,
        added_at: Optional[datetime] = None,
        run_at: Optional[datetime] = None,
        wait_to_kill: Optional[bool] = None,
        status: Optional[RunningJobStatus] = None,
        running_jobs: Optional[DictProxy[str, RunningJob]] = None,
    ):
        """Update RunningJob info and update it into running_jobs"""
        self.added_at = added_at or self.added_at
        self.run_at = run_at or self.run_at
        if wait_to_kill is not None:
            self.wait_to_kill = wait_to_kill
        self.status = status or self.status

        # Update item into DictProxy
        running_jobs = running_jobs or RunningJobs.get_running_jobs()
        if self.id in running_jobs:
            running_jobs[self.id] = self


class RunningJobs:
    """Dictionary contains jobs running inside our applications, we use this to check jobs conflict"""

    _running_jobs: DictProxy[str, RunningJob] | None = None

    # lock to protect running_jobs
    # use threading.RLock same as
    # <https://docs.python.org/3/library/multiprocessing.html#multiprocessing.managers.SyncManager.RLock>
    _lock: AcquirerProxy[threading.RLock] | None = None

    @classmethod
    def get_running_jobs(cls) -> DictProxy[str, RunningJob] | None:
        return cls._get()

    @classmethod
    def lock(cls) -> AcquirerProxy[threading.RLock]:
        return cls._get(lock=True)

    @classmethod
    def _get(cls, lock=False) -> DictProxy[str, RunningJob] | threading.RLock | None:
        # Cannot connect to the server to get shared object
        if not cls.try_init():
            return None

        # Still need to suppress exception here
        # To avoid TOCTOU issue: <https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use>
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            return cls._lock if lock else cls._running_jobs

        return None

    @classmethod
    def is_connected(cls) -> bool:
        """Run an O(1) test if we are still connect to the server."""
        # If this raises error, this means we are disconnected from the server.
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            len(cls._running_jobs)
            return True

        return False

    @classmethod
    def _init(cls):
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            cls._running_jobs = CustomManager.get_running_jobs()
            cls._lock = CustomManager.get_running_jobs_lock()

    @classmethod
    def try_init(cls) -> bool:
        """Try to initialize object from server, return True if success, otherwise return False"""

        should_run_init = (
            # Running jobs is not set, we are definitely not connecting to a server.
            cls._running_jobs is None
            or cls._lock is None
            # Inner is set, but we might check if we are still connecting to the sever.
            # If we are not, we need to try to reconnect again.
            or not cls.is_connected()
        )

        if should_run_init:
            cls._init()

        # Return whether we are connected
        return cls.is_connected()
