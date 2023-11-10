import queue
from datetime import datetime
from enum import Enum, auto
from functools import wraps
from types import GeneratorType

from ap import json_dumps, logger
from ap.common.constants import LISTEN_BACKGROUND_TIMEOUT
from ap.common.logger import log_exec_time_inside_func


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
    FORCE_SECOND = 10

    def __init__(self):
        self.dic_listeners = {}

    def add_uuid(self, uuid: str, main_tab_uuid: str):
        if uuid not in self.dic_listeners:
            self.dic_listeners[uuid] = [None, None, {}, queue.Queue(maxsize=100)]

        self.dic_listeners[uuid][0] = datetime.utcnow()

        # if self.dic_listeners[uuid][1] and False:  # TODO: EdgeServer faced auto disconnect sse issue
        if (
            'main_tab_uuid' in self.dic_listeners[uuid][2]
            and self.dic_listeners[uuid][2]['main_tab_uuid'] != main_tab_uuid
        ):
            try:
                self.dic_listeners[uuid][1].close()
            except ValueError:
                # In case cannot close normally, add flag to generator will be break automatically later
                self.dic_listeners[uuid][2]['is_close'] = True

            self.dic_listeners[uuid][2] = {}  # reset flag for new stream sse

        self.dic_listeners[uuid][2]['main_tab_uuid'] = main_tab_uuid
        self.dic_listeners[uuid][1] = stream_sse(uuid, self.dic_listeners[uuid][2])

    def remove_uuid(self, uuid: str, main_tab_uuid: str):
        if self.is_exist(uuid, main_tab_uuid):
            del self.dic_listeners[uuid]
            logger.debug(f'[SSE] {uuid} - {main_tab_uuid} is removed out of dic_listeners')

    def _get_item(self, uuid: str):
        date, stream_sse_func, break_dic, qe = self.dic_listeners.get(uuid)
        return date, stream_sse_func, break_dic, qe

    def listen(self, uuid: str) -> queue.Queue:
        *_, listener = self._get_item(uuid)
        return listener

    def get_stream_see(self, uuid: str) -> GeneratorType:
        _, stream_sse_func, *_ = self._get_item(uuid)
        return stream_sse_func

    def get_start_date(self, uuid: str) -> datetime:
        start_date, *_ = self._get_item(uuid)
        return start_date

    def is_exist(self, uuid: str, main_tab_uuid: str = None) -> bool:
        if main_tab_uuid is None:
            return uuid in self.dic_listeners
        else:
            return (
                uuid in self.dic_listeners
                and self.dic_listeners[uuid][2].get('main_tab_uuid') == main_tab_uuid
            )

    @staticmethod
    def format_sse(data, event=None) -> str:
        """Formats a string and an event name in order to follow the event stream convention.
        format_sse(data=json.dumps({'abc': 123}), event='Jackson 5')
        'event: Jackson 5\\ndata: {"abc": 123}\\n\\n'
        """

        msg = json_dumps(data)
        msg = f'data: {msg}\n\n'
        if event is not None:
            msg = f'event: {event}\n{msg}'
        return msg

    def announce(self, data, event):
        # We go in reverse order because we might have to delete an element, which will shift the
        # indices backward
        msg = self.format_sse(data, event)
        full_queue_uuids = []
        for uuid, (*_, listener) in self.dic_listeners.items():
            try:
                listener: queue.Queue
                listener.put_nowait(msg)
            except queue.Full:
                logger.debug(f'[SSE] Announce: {event}; {data};  Exception: QUEUE IS FULL')
                full_queue_uuids.append(uuid)
                continue

        if full_queue_uuids:
            for uuid in full_queue_uuids:
                listener = self.listen(uuid)
                with listener.mutex:
                    listener.queue.clear()
                    del self.dic_listeners[uuid]
                    logger.debug(f'[SSE]: [{uuid}] Clear queue')


# background job status
background_announcer = MessageAnnouncer()


def notify_progress(percent):
    """Decorator to notify progress"""

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


def stream_sse(uuid: str, break_dic: dict):
    messages = background_announcer.listen(uuid)
    ping_msg = background_announcer.format_sse(None, event='ping')
    timeout_msg = background_announcer.format_sse(None, event='timeout')
    close_old_sse_msg = background_announcer.format_sse(None, event='close_old_sse')

    logger.debug(f'[SSE]: UUID = {uuid}; ping')
    yield ping_msg

    while True:
        func_log = log_exec_time_inside_func(f'[SSE]: UUID = {uuid};', 'messages.get()', True)
        try:
            if break_dic.get('is_close'):
                break

            msg = messages.get(timeout=LISTEN_BACKGROUND_TIMEOUT)
            func_log(msg)
            yield msg
        except queue.Empty:
            func_log('timeout')
            yield timeout_msg
        except GeneratorExit as _exit:
            break

    main_tab_uuid = break_dic.get('main_tab_uuid')
    background_announcer.remove_uuid(uuid, main_tab_uuid)
    logger.debug(f'[SSE]: UUID = {uuid}; Main Tab UUID = {main_tab_uuid}; Close old stream_sse')
    return close_old_sse_msg
