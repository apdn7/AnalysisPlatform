import json
import queue
from datetime import datetime
from enum import Enum, auto
from functools import wraps

from ap.common.services import http_content


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
    FORCE_SECOND = 15

    def __init__(self):
        self.dic_listeners = {}

    def add_uuid(self, uuid):
        if uuid not in self.dic_listeners:
            self.dic_listeners[uuid] = [None, queue.Queue(maxsize=100)]

        self.dic_listeners[uuid][0] = datetime.utcnow()

    def listen(self, uuid):
        _, listener = self.dic_listeners.get(uuid)
        return listener

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
        for uuid, (_, listener) in self.dic_listeners.items():
            try:
                listener.put_nowait(msg)
            except queue.Full:
                del self.dic_listeners[uuid]


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
