import os
import time
import shutil
from datetime import datetime, timedelta, date
from datetime import time as dtime
from functools import wraps
from time import perf_counter
from zipfile import ZipFile
import logging

from logging.handlers import TimedRotatingFileHandler
from ap.common.constants import LOG_LEVEL, AP_LOG_LEVEL


tz = time.strftime('%z')
LOG_FORMAT = '%(asctime)s' + tz + ' %(levelname)s: %(message)s'
# LOG_FORMAT = '%(count)s %(asctime)s %(levelname)s: %(message)s'
# buffer (records) to write log file
WRITE_BY_BUFFER = 1000
# time interval (seconds) to write log file
# default is 60 (1 minute)
WRITE_BY_TIME = 60
# time interval (seconds) to rotate log file
# default is 86400 (1 day)
ROTATE_BY_TIME = 86400

logger = logging.getLogger('')
# set logging level for application, global use
logger.setLevel(logging.DEBUG)
# set log format
formatter = logging.Formatter(LOG_FORMAT)

def getBaseFilename(basedir):
    """
    generate log file basename
    """
    if not basedir:
        basedir = 'log'
    _basename = datetime.now().strftime('%Y%m%d_%H%M%S') + ".log"
    return os.path.join(basedir, _basename)

class BatchAndRotatingHandler(TimedRotatingFileHandler):
    _WRITE_BY_BUFFER = WRITE_BY_BUFFER
    _WRITE_BY_TIME = WRITE_BY_TIME
    # _ROTATE_BY_TIME = ROTATE_BY_TIME
    _ROTATE_BY_MAX_SIZE = 0

    # counter for batching write
    _msg_counter = 0
    # counter for time interval write
    _start_time = 0
    # max size of log file to rotate (bytes)
    _max_size = 0
    _basedir = None
    _buffers = []

    def __int__(self, logfile, **kwargs):
        TimedRotatingFileHandler.__init__(self, logfile, **kwargs)

    def setBaseDir(self, basedir):
        self._basedir = basedir

    def set_rotator(self, size):
        self._max_size = size

    def is_should_write_log(self, elapsed_time):
        if self._msg_counter >= self._WRITE_BY_BUFFER:
            print('counter is {}'.format(self._msg_counter))
        return elapsed_time >= self._WRITE_BY_TIME or self._msg_counter >= self._WRITE_BY_BUFFER

    def emit(self, record):
        try:
            msg = self.format(record)
            # open stream to write to RAM
            if self.stream is None:
                self.stream = self._open()
            stream = self.stream
            self._msg_counter += 1

            emit_time = int(time.time())
            if not self._start_time:
                self._start_time = int(time.time())
            elapsed_time = emit_time - self._start_time

            should_rollover = self.shouldRollover(record)
            should_write_log = self.is_should_write_log(elapsed_time)
            if should_write_log or should_rollover:
                if should_write_log and len(self._buffers):
                    # write all msg to file
                    for _msg in self._buffers:
                        stream.write(_msg + self.terminator)
                    stream.write(msg + self.terminator)
                    self._buffers = []

                if should_rollover:
                    self.baseFilename = getBaseFilename(self._basedir)
                    # if it's time to rotate to new file
                    self.doRollover()
                # reset batch size and time
                self._msg_counter = 0
                self._start_time = 0
                self.flush()
            else:
                # write all msg in batch before flush
                self._buffers.append(msg)
        except RecursionError:  # See issue 36272
            raise
        except Exception:
            self.handleError(record)


def set_log_config():
    import ap
    from ap import get_basic_yaml_obj
    from ap.common.common_utils import make_dir

    # retrieve config to write the debug log on file
    basic_config_yaml = get_basic_yaml_obj()
    log_level = basic_config_yaml.dic_config['info'].get(LOG_LEVEL) or AP_LOG_LEVEL.INFO.name
    default_logger_level = logging.DEBUG if log_level == AP_LOG_LEVEL.DEBUG.name else logging.INFO

    # get log folder from config
    log_dir = ap.dic_config.get('INIT_LOG_DIR')
    # initiate log dir if not existing
    make_dir(log_dir)
    log_file = getBaseFilename(log_dir)

    file_handler = BatchAndRotatingHandler(log_file, when='midnight', backupCount=0, encoding='utf8', delay=True, atTime=dtime(0, 0, 0))
    file_handler.setLevel(default_logger_level)
    file_handler.setFormatter(formatter)
    file_handler.setBaseDir(log_dir)
    # handle rotate log file by file-size
    # file_handler.set_rotator(size=1000)

    logger.addHandler(file_handler)

    # write log into console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

def log_execution(prefix='', logging_exception=True):
    """ Decorator to log function run time
    Arguments:
        fn {function} -- [description]
        prefix {string} -- prefix set to logged message
    Returns:
        fn {function} -- [description]
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            start_dt = datetime.utcnow()
            start = perf_counter()

            log_args = str(args)
            log_kwargs = str(kwargs)
            try:
                logger.info('{0}{1}; START; {2}; {3}'.format(prefix, fn.__name__, log_args, log_kwargs))
                result = fn(*args, **kwargs)
            except Exception as e:
                if logging_exception:
                    logger.exception(e)
                raise e
            finally:
                end = perf_counter()
                count_time = end - start
                if count_time >= 1:
                    log_func = logger.info
                else:
                    log_func = logger.debug
                log_func('{0}Function: {1}; START: {2}; ExecTime: {3:.6f}s;'
                            .format(prefix, fn.__name__, start_dt, end - start))
            return result

        return wrapper

    return decorator

def bind_user_info(req=None, res=None):
    logger.info(f'REQUEST: {req.method} {req.full_path}')
    if res:
        logger.info(f'RESPONSE: {res.status_code}')
    return logger


def log_execution_time(prefix='', logging_exception=True, is_debug=False):
    """ Decorator to log function run time
    Arguments:
        fn {function} -- [description]
        prefix {string} -- prefix set to logged message
    Returns:
        fn {function} -- [description]
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            start_dt = datetime.now()
            start = perf_counter()

            log_args = ''
            log_kwargs = ''
            try:
                result = fn(*args, **kwargs)
            except Exception as e:
                if logging_exception:
                    logger.exception(e)
                # log_args = str(args)
                # log_kwargs = str(kwargs)
                raise e
            finally:
                end = perf_counter()
                count_time = end - start
                if count_time >= 1:
                    log_func = logger.info
                else:
                    log_func = logger.debug

                log_func(
                    '{0}Function: {1}; START: {2}; ExecTime: {3:.6f}s; {4}; {5}'.format(
                        prefix, fn.__name__, start_dt, end - start, log_args, log_kwargs
                    )
                )
            return result

        return wrapper

    return decorator
