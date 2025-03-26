from __future__ import annotations

import contextlib
import dataclasses
import logging
import queue
import threading
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Generator

from ap import json_dumps
from ap.common.constants import AnnounceEvent
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventQueue

logger = logging.getLogger(__name__)


@dataclasses.dataclass
class SSEMessage:
    """SSE message notify to front-end, with datetime encapsulated"""

    data: str | None = None
    event: str | None = None
    timestamp: datetime = dataclasses.field(default_factory=datetime.now)

    def format(self) -> str:
        """
        Formats a string and an event name in order to follow the event stream convention.
        format(data=json.dumps({'abc': 123}), event='Jackson 5')
        'event: Jackson 5\\ndata: {"abc": 123}\\n\\n'
        """

        msg = json_dumps(self.data)
        msg = f'data: {msg}\n\n'

        if self.event is not None:
            msg = f'event: {self.event}\n{msg}'

        return msg

    @classmethod
    def from_background_event(cls, e: EventBackgroundAnnounce) -> 'SSEMessage':
        """Create `SSEMessage` from `EventBackgroundAnnounce`."""

        return SSEMessage(data=e.data, event=e.event.name, timestamp=e.timestamp)


class SSEStreamer:
    """Streamer handling for sending message to a specific client"""

    def __init__(
        self,
        uuid: Any,
        blocking_message_timeout: int = 1,
        idle_timeout: float = 60,
        message_queue_size: int = 1000,
    ):
        # The streamer unique identifier
        self.uuid: str = str(uuid)

        # The total of time (in seconds) that we should wait for message in each stream loop.
        self.blocking_message_timeout = blocking_message_timeout

        # The total of time we consider that our streamer is idle (no client is pulling message from it).
        self.idle_timeout = idle_timeout

        # The latest time that we access our messages.
        # We use this to check if a connected client is disconnected
        self.latest_response: datetime = datetime.now()

        # Store messages from background announcing.
        # Memory leak can occur if we have a streamer running around without pointing to any client.
        self.messages: queue.Queue[SSEMessage] = queue.Queue(maxsize=message_queue_size)

        # Internal flag to exit out of the stream.
        # Because we cannot execute `self.stream().close()` after it is run, we need to stop it using this flag.
        self.stop: bool = False

        logger.debug(f'[SSE]: UUID = {self.uuid}; streamer created')

    def is_alive(self):
        """Check if our streamer is alive"""

        latest_message_query_time_diff = datetime.now() - self.latest_response
        return latest_message_query_time_diff < timedelta(seconds=self.idle_timeout)

    def get_message(self) -> SSEMessage | None:
        """Getting message from queue, we also update our `latest_response` depends on `sse_message.timestamp`."""

        with contextlib.suppress(queue.Empty):
            sse_message = self.messages.get(timeout=self.blocking_message_timeout)
            self.latest_response = sse_message.timestamp
            return sse_message

        return None

    def add_message(self, sse_message: SSEMessage):
        """Add new msg to messages"""
        # Do not accept new message for stopped stream.
        if self.stop:
            return

        # TODO: do we want to accept event only after we establish our connection ?
        # Or we just accept messages, so that messages received before connection is established can be sent.
        try:
            self.messages.put_nowait(sse_message)
        except queue.Full:
            # Our queue is full, hence we should pop out old message to append the new one.

            # Pop the oldest message out of the queue,
            # the operation below does not raise `queue.Empty` exception because
            # our queue is not full.
            self.messages.get_nowait()

            # Put back the newest msg
            self.messages.put_nowait(sse_message)

    def stream(self) -> Generator[str, None, None]:
        """Generator for stream to front-end"""

        while True:
            if self.stop:
                logger.debug(f'[SSE]: UUID = {self.uuid}; streamer stopped')
                break

            sse_message = self.get_message()
            if sse_message is not None:
                yield sse_message.format()


class MessageAnnouncer:
    """Maintain streamers that send notify (SSE) to front-end"""

    # Key is the id of client (which is browser in our case)
    # Value is the specific streamer that we use to send our message to front-end
    streamers: dict[str, SSEStreamer] = {}

    # Lock to maintain that we are not modifying streamer while reading it at the same time.
    # Though it rarely happens, we still want to avoid returning a *dead* streamer to caller.
    streamer_lock: threading.Lock = threading.Lock()

    # cleanup streamers interval thread
    cleanup_streamers_thread: threading.Thread | None = None
    cleanup_streamers_interval: float = 5  # seconds
    should_run_cleanup: bool = False  # flag to stop running cleanup

    @classmethod
    def create_streamer(cls, uuid: str) -> SSEStreamer:
        """Create a new streamer for specific request."""

        # We lock it to prevent other trying to delete this streamer at the same time.

        # There no such case that a streamer will be deleted immediately after creation.
        # For example: `cleanup_streamers` run and delete the client, it thinks that this client should be removed.
        # During that time, we are also create a new streamer. There are 2 cases:
        # - `create_streamer` run before `cleanup_streamers`: `create_streamer` gets the lock, `cleanup_streamers` needs
        #    to wait, after `create_streamer` done, new streamer is created with `is_alive` always true. Then it would
        #    not be deleted.
        # - `cleanup_streamers` run before `create_streamer`: `cleanup_streamers` gets the lock, `create_streamer` needs
        #    to wait, after `cleanup_streamers` done, `create_streamer` runs.
        with cls.streamer_lock:
            # We need to remove a streamer if it is still connecting.
            # If we don't remove previous streamer and just return it instead,
            # this streamer will connect with two running `EventSource`.
            # In case a client is reloaded multiple times, there will be multiple `EventSource` connect to the
            # same client.
            # Some of them will be disconnected later, but in the meantime,
            # they will try to pull message from streamer. Resulting in message loss.
            cls.remove_streamer(uuid)

            cls.streamers[uuid] = SSEStreamer(uuid)
            return cls.streamers[uuid]

    @classmethod
    def announce(cls, event: EventBackgroundAnnounce):
        """
        Send message data to front-end by EVENT name
        :param event: event to be announced
        """

        sse_message = SSEMessage.from_background_event(event)
        for streamer in cls.streamers.values():
            streamer.add_message(sse_message)

    @staticmethod
    def notify_progress(percent):
        """Decorator to notify progress"""

        def decorator(fn):
            @wraps(fn)
            def wrapper(*args, **kwargs):
                try:
                    result = fn(*args, **kwargs)
                    EventQueue.put(EventBackgroundAnnounce(data=percent, event=AnnounceEvent.SHOW_GRAPH))
                except Exception as e:
                    raise e

                return result

            return wrapper

        return decorator

    @classmethod
    def start_background_cleanup_streamers(cls):
        if cls.cleanup_streamers_thread is None:
            cls.should_run_cleanup = True
            # Add daemon to make sure thread will be killed if our process is killed,
            # this ensures we can clean up our thread, in case users abort application but `should_run_cleanup = True`.
            cls.cleanup_streamers_thread = threading.Thread(target=cls._run_cleanup_streamer_thread, daemon=True)
            cls.cleanup_streamers_thread.start()

    @classmethod
    def _run_cleanup_streamer_thread(cls):
        while cls.should_run_cleanup:
            time.sleep(cls.cleanup_streamers_interval)
            cls.cleanup_streamers()
        cls.cleanup_streamers_thread = None

    @classmethod
    def cleanup_streamers(cls):
        """Remove non-alive streamer, to avoid memory leak"""
        # We lock it here to avoid deleting a streamer that are being getting by `get_or_create_streamer`
        # in other thread.
        with cls.streamer_lock:
            # We need to get all uuids first, to avoid remove items in dictionary while looping through it
            streamers_uuid = list(cls.streamers.keys())

            for uuid in streamers_uuid:
                # only remove dead streamer
                if not cls.streamers[uuid].is_alive():
                    cls.remove_streamer(uuid)

    @classmethod
    def remove_streamer(cls, uuid: str):
        """Remove a streamer from streamers pool.
        This function is not threadsafe, it must be called inside a function that calls `MessageAnnouncer.streamer_lock`
        """
        logger.debug(f'[SSE]: UUID = {uuid}; remove streamer')
        # Pop out streamer and stop it, so that generator can safely exit
        streamer = cls.streamers.pop(uuid, None)
        if streamer is not None:
            streamer.stop = True
