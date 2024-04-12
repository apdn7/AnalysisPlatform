import os
import time
from functools import wraps

from flask import g

from ap.common.constants import ANALYSIS_INTERFACE_ENV, AppEnv, FlaskGKey

api_request_threads = []


class RequestTimeOutAPI(Exception):
    status_code = 408

    def __init__(self, message, status_code=None, payload=None, response=None):
        super().__init__()
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload
        self.response = response

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv


def request_timeout_handling(max_timeout=10):
    """Decorator to log function run time
    Arguments:
        fn {function} -- [description]
        max_timeout {number} -- tracing timeout (minutes)
    Returns:
        fn {function} -- [description]
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = fn(*args, **kwargs)

            current_env = os.environ.get(ANALYSIS_INTERFACE_ENV, AppEnv.PRODUCTION.value)
            if current_env == AppEnv.PRODUCTION.value:
                start_func_time = time.time()
                request_start_time = getattr(g, 'request_start_time', None)
                if request_start_time:
                    timeout = (start_func_time - request_start_time) / 60  # to minutes
                    if timeout > max_timeout:
                        raise RequestTimeOutAPI('Request timeout: {} seconds'.format(str(timeout)))

            return result

        return wrapper

    return decorator


def get_request_g_dict():
    return g.setdefault(FlaskGKey.THREAD_ID, '')


def set_request_g_dict(value):
    g.setdefault(FlaskGKey.THREAD_ID, value)


def check_abort_process():
    thread_id = get_request_g_dict()
    if thread_id and thread_id in api_request_threads:
        api_request_threads.remove(thread_id)
        raise BrokenPipeError('PROCESS KILLED')


def abort_process_handler():
    """Decorator to abort running process
    Arguments:
        fn {function} -- [description]
    Returns:
        fn {function} -- [description]
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # check before run fn
            check_abort_process()

            result = fn(*args, **kwargs)

            # check after run fn
            check_abort_process()

            return result

        return wrapper

    return decorator
