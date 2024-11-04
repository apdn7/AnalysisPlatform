from __future__ import annotations

import contextlib
import logging
import multiprocessing
import queue
import threading
from typing import Any, Callable, Optional

from pydantic import BaseModel, ConfigDict

from ap.common.multiprocess_sharing.events import Event
from ap.common.multiprocess_sharing.manager import CustomManager

logger = logging.getLogger(__name__)


class EventQueue:
    """A queue wrapper to enable sharing event between parent process and children processes"""

    inner: queue.Queue[Event] | None = None

    # callback to run on Event
    # we don't need to lock this because all callbacks should be added only in main thread
    callbacks: list[Callable[[Event], Any]] = []

    @classmethod
    def put(cls, event: Event):
        """Putting event into queue, this is a block operation
        If you are running test, please look at `setup_test_event_queue` function instead
        We don't perform queue when running tests
        """
        cls._put(event)

    @classmethod
    def get(cls) -> Event | None:
        """Getting a message from the queue, this is a blocking operation,
        However, we run this in separated thread, hence it is ok to just block them
        return None when the queue is stopped.
        """
        return cls._get()

    @classmethod
    def start_listening(cls) -> None:
        # start running thread to process event queue
        # daemon=True, when the main process exit, the thread will stop as well
        threading.Thread(target=cls._listen, daemon=True).start()

    @classmethod
    def add_event_listeners(cls, *listeners: Callable[[Event], Any]):
        if multiprocessing.parent_process() is not None:
            raise RuntimeError('This method should only be called on main process')

        for listener in listeners:
            cls.callbacks.append(listener)

    @classmethod
    def _listen(cls):
        while True:
            event = cls.get()
            # even though we waited, we cannot get any message, hence we stop the loop
            if event is None:
                break

            # if Exception occurs in some callbacks, we can still listen to other events, so we add try catch here
            try:
                for callback in cls.callbacks:
                    callback(event)
            except Exception as e:
                logger.exception(e)

    @classmethod
    def _put(cls, event: Event):
        # Cannot connect to the server to get shared object
        if not cls.try_init():
            return

        # Still need to suppress exception here
        # To avoid TOCTOU issue: <https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use>
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            try:
                cls.inner.put(event)
            except queue.Full:
                logger.exception(f'Event queue is full, cannot put more event {event}')

    @classmethod
    def _get(cls) -> Event | None:
        # Cannot connect to the server to get shared object
        if not cls.try_init():
            return None

        # Still need to suppress exception here
        # To avoid TOCTOU issue: <https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use>
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            # We want to wait for message from the queue, so just block here
            return cls.inner.get()

        return None

    @classmethod
    def is_connected(cls) -> bool:
        """Run an O(1) test if we are still connect to the server."""
        # If this raises error, this means we are disconnected from the server.
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            cls.inner.qsize()
            return True

        return False

    @classmethod
    def _init(cls):
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            cls.inner = CustomManager.get_event_queue()

    @classmethod
    def try_init(cls) -> bool:
        """Try to initialize object from server, return True if success, otherwise return False"""

        should_run_init = (
            # Inner is not set, we are definitely not connecting to a server.
            cls.inner is None
            # Inner is set, but we might check if we are still connecting to the sever.
            # If we are not, we need to try to reconnect again.
            or not cls.is_connected()
        )

        if should_run_init:
            cls._init()

        # Return whether we are connected
        return cls.is_connected()


class RunningJob(BaseModel):
    id: str = ConfigDict(coerce_numbers_to_str=True)
    name: str = ConfigDict(coerce_numbers_to_str=True)
    proc_id: Optional[int] = ConfigDict(coerce_numbers_to_str=True)


class RunningJobs:
    """Dictionary contains jobs running inside our applications, we use this to check jobs conflict"""

    _running_jobs: dict[str, RunningJob] | None = None

    @classmethod
    def get(cls) -> dict[str, RunningJob] | None:
        return cls._get()

    @classmethod
    def _get(cls) -> dict[str, RunningJob] | None:
        # Cannot connect to the server to get shared object
        if not cls.try_init():
            return None

        # Still need to suppress exception here
        # To avoid TOCTOU issue: <https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use>
        with contextlib.suppress(BrokenPipeError, FileNotFoundError, AssertionError):
            # We want to wait for message from the queue, so just block here
            return cls._running_jobs

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

    @classmethod
    def try_init(cls) -> bool:
        """Try to initialize object from server, return True if success, otherwise return False"""

        should_run_init = (
            # Running jobs is not set, we are definitely not connecting to a server.
            cls._running_jobs is None
            # Inner is set, but we might check if we are still connecting to the sever.
            # If we are not, we need to try to reconnect again.
            or not cls.is_connected()
        )

        if should_run_init:
            cls._init()

        # Return whether we are connected
        return cls.is_connected()
