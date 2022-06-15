import os
import shutil
from datetime import datetime, timedelta, time, date
from functools import wraps
from time import perf_counter
from zipfile import ZipFile

from loguru import logger

LOGGING_CONFIG = {
    "handlers": [
        {
            "sink": os.path.join("log", "{time:YYYYMMDD}", "{time:YYYYMMDD_HHmm}_access.log"),
            "format": "{time}|{level}|{extra[ip]}|{extra[method]}|{extra[url]}|{extra[agent]}|{extra[status]}|\
                {message}",
            "level": "INFO",
            "mode": "a",
            "compression": "zip"
        }
    ],
    "extra": {
        "ip": "-",
        "agent": "-",
        "url": "-",
        "method": "-",
        "status": "---"
    }
}


class TimeAndSizeBasedRotator:
    def __init__(self, *, size, at):
        now = datetime.utcnow()

        self._size_limit = size
        self._time_limit = now.replace(hour=at.hour, minute=at.minute, second=at.second)

        if now >= self._time_limit:
            # The current time is already past the target time so it would rotate already.
            # Add one day to prevent an immediate rotation.
            self._time_limit += timedelta(days=1)

    def should_rotate(self, message, file):
        file.seek(0, 2)
        if file.tell() + len(message) > self._size_limit:
            return True
        if message.record["time"].timestamp() > self._time_limit.timestamp():
            self._time_limit += timedelta(days=1)
            return True
        return False


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
                logger.info('{0} Function Name: {1}; START; {2}; {3}'.format(prefix, fn.__name__, log_args, log_kwargs))
                result = fn(*args, **kwargs)
            except Exception as e:
                if logging_exception:
                    logger.exception(e)
                raise e
            finally:
                end = perf_counter()
                end_dt = datetime.utcnow()
                logger.info('{0} Function Name: {1}; START: {2}; END: {3}; Execution Time: {4:.6f}s;'
                            .format(prefix, fn.__name__, start_dt, end_dt, end - start))
            return result

        return wrapper

    return decorator


def get_all_file_paths(directory, start_with='', end_with='.log'):
    # initializing empty file paths list
    file_paths = []

    # crawling through directory and subdirectories
    for root, directories, files in os.walk(directory):
        for filename in files:
            if filename.startswith(start_with) and filename.endswith(end_with):
                filepath = os.path.join(root, filename)
                file_paths.append(filepath)

    # returning all file paths
    return file_paths


def zip_logs(directory, prefix=''):
    zip_file_path = os.path.join('log', '{zipped_month}.zip'.format(zipped_month=prefix))
    if os.path.exists(zip_file_path):
        return True

    # get all file paths in the directory
    file_paths = get_all_file_paths(directory, start_with=prefix, end_with='.log')

    # writing files to a zipfile
    try:
        with ZipFile(zip_file_path, 'w') as zip_file:
            # writing each file one by one
            for file in file_paths:
                zip_file.write(file)
    except Exception as ex:
        print(ex)
        return False

    return True


def delete_sub_folders(directory, prefix=''):
    try:
        sub_folders = os.listdir(directory)
        for sub_folder in sub_folders:
            if os.path.isdir(os.path.join(directory, sub_folder)) and sub_folder.startswith(prefix):
                shutil.rmtree(os.path.join(directory, sub_folder))
    except Exception as ex:
        print(ex)


def month_compressor(*kwargs):
    log_dir = os.path.join('.', 'log')

    today = date.today()
    this_month_1st_day = today.replace(day=1)  # just in case
    last_month_last_day = this_month_1st_day - timedelta(days=1)
    last_month_prefix = last_month_last_day.strftime("%Y%m")

    # zip last month
    is_zipped = zip_logs(log_dir, prefix=last_month_prefix)

    # remove old logs folders after compression
    if is_zipped:
        delete_sub_folders(log_dir, prefix=last_month_prefix)


@log_execution()
def set_log_config():
    logger.info("----------------WEB SERVER STARTED---------------------")
    # Rotate file if over 50 MB and/or at midnight every day
    rotator = TimeAndSizeBasedRotator(size=50000000, at=time(0, 0, 0))
    logger.configure(extra={
        "ip": "-",
        "agent": "-",
        "url": "-",
        "method": "-",
        "status": "---"
    })
    log_format = "{time}|{level}|{extra[ip]}|{extra[method]}|{extra[url]}|{extra[agent]}|{extra[status]}|{message}"
    # logger.add(sink=os.path.join("log", "{time:YYYYMMDD}", "{time:YYYYMMDD_HHmmss}_access.log"),
    #            rotation=rotator.should_rotate, format=log_format, level="INFO", mode="a",
    #            compression=month_compressor,
    #            enqueue=True)

    logger.add(sink=os.path.join("log", "{time:YYYYMMDD}", "{time:YYYYMMDD_HHmmss}_access.log"),
               rotation=rotator.should_rotate, format=log_format, level="INFO", mode="a",
               compression=month_compressor, encoding="utf8")


def bind_user_info(req=None, res=None):
    status = LOGGING_CONFIG["extra"]["status"]

    if req is None:
        return logger.bind()
    if res is not None:
        status = res.status_code

    return logger.bind(ip=req.remote_addr, url=req.full_path, agent=req.user_agent.string,
                       status=status, method=req.method)


def log_execution_time(prefix='', logging_exception=True):
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
                end_dt = datetime.now()
                logger.info('{0} Function Name: {1}; START: {2}; END: {3}; Execution Time: {4:.6f}s; {5}; {6}'
                            .format(prefix, fn.__name__, start_dt, end_dt, end - start, log_args, log_kwargs))
            return result

        return wrapper

    return decorator
