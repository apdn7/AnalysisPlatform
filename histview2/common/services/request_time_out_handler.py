import os
import time
from flask import g
from functools import wraps
from histview2.common.constants import appENV

class requestTimeOutAPI(Exception):
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


def request_timeout_handling(max_timeout=1):
    """ Decorator to log function run time
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

            current_env = os.environ.get('ANALYSIS_INTERFACE_ENV', appENV.DEVELOPMENT.value)
            if (current_env == appENV.PRODUCTION.value):
                start_func_time = time.time()
                request_start_time = getattr(g, 'request_start_time', None)
                if (request_start_time):
                    timeout = (start_func_time - request_start_time) / 60 # to minutes
                    if (timeout > max_timeout):
                        raise requestTimeOutAPI('Request timeout: {} seconds'.format(str(timeout)))

            return result

        return wrapper

    return decorator
