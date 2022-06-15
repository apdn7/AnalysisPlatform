import json
import queue
from enum import Enum, auto
from functools import wraps

from histview2.common.services import http_content


class AnnounceEvent(Enum):
    JOB_RUN = auto()
    PROC_LINK = auto()
    SHUT_DOWN = auto()
    DATA_TYPE_ERR = auto()
    EMPTY_FILE = auto()
    PCA_SENSOR = auto()
    SHOW_GRAPH = auto()
    DISK_USAGE = auto()


class MessageAnnouncer:

    def __init__(self):
        self.listeners = []

    def listen(self):
        self.listeners.append(queue.Queue(maxsize=10))
        return self.listeners[-1]

    @staticmethod
    def format_sse(data, event=None) -> str:
        """Formats a string and an event name in order to follow the event stream convention.
        format_sse(data=json.dumps({'abc': 123}), event='Jackson 5')
        'event: Jackson 5\\ndata: {"abc": 123}\\n\\n'
        """
        msg = json.dumps(data, ensure_ascii=False, default=http_content.json_serial)
        msg = f'data: {msg}\n\n'
        if event is not None:
            msg = f'event: {event}\n{msg}'
        return msg

    def announce(self, data, event):
        # We go in reverse order because we might have to delete an element, which will shift the
        # indices backward
        msg = self.format_sse(data, event)
        for i in reversed(range(len(self.listeners))):
            try:
                self.listeners[i].put_nowait(msg)
            except queue.Full:
                del self.listeners[i]


# background job status
background_announcer = MessageAnnouncer()


def notify_progress(percent):
    """ Decorator to notify progress
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                result = fn(*args, **kwargs)
                background_announcer.announce(percent, AnnounceEvent.SHOW_GRAPH.name)
            except Exception as e:
                raise e

            return result
        return wrapper
    return decorator
