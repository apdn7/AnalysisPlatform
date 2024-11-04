from __future__ import annotations

import contextlib
import glob
import logging
import os
import time
from datetime import date as ddate
from datetime import datetime, timedelta
from datetime import time as dtime
from functools import wraps
from logging.handlers import MemoryHandler, RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from time import perf_counter
from typing import Callable, Dict, List, Optional, Union
from zipfile import ZipFile

from ap.common.constants import LOG_LEVEL, ApLogLevel

tz = time.strftime('%z')
LOG_FORMAT = '%(asctime)s' + tz + ' %(levelname)s: %(message)s'
# LOG_FORMAT = '%(count)s %(asctime)s %(levelname)s: %(message)s'
# buffer (records) to write log file
WRITE_BY_BUFFER = 10_000
# do not store record more than 1Kb, because 10_000 * 1Kb = 10Mb, this is more friendly to memory
# 1Kb = 1024 u8 characters, normal string usually does not exceed this
RECORD_MAX_BYTE = 1 * 1024
# time interval (seconds) to write log file
# default is 60 (1 minute)
WRITE_BY_TIME = 60
# time interval (seconds) to rotate log file
# default is 86400 (1 day)

ROTATE_BY_SIZE = 50 * 1024 * 1024  # 50MB
BACKUP_COUNT_FOR_SIZE_ROTATED = 10000

DELETE_ZIPPED_FILE_OLDER_THAN = 5  # weeks

logger = logging.getLogger(__name__)

# set log format
formatter = logging.Formatter(LOG_FORMAT)

BASE_FILENAME_FORMAT = '%Y%m%d_%H%M%S'

ZIP_FILENAME_FORMAT = '%Yw%W_%m%d'

ZIP_LOG_INTERVAL = 60 * 60 * 24 * 7  # 7 day
CLEAN_ZIP_INTERVAL = 60 * 60 * 24 * 7 * 4  # 4 weeks


def shift_date_to_monday(dt: datetime) -> datetime:
    week_day = dt.weekday()
    return dt - timedelta(days=week_day)


def get_filename_without_ext_from_abspath(absolute_path: str) -> Optional[str]:
    path, filename = os.path.split(absolute_path)
    if not filename:
        return None
    filename = filename.split('.')[0]
    return filename


def get_datetime_from_file(filename: str, fmt: str) -> datetime:
    file_without_ext = get_filename_without_ext_from_abspath(filename)

    # datetime string always put at the beginning of the filename
    datetime_str_example = datetime.now().strftime(fmt)
    prefix_file_without_ext = file_without_ext[: len(datetime_str_example)]

    return datetime.strptime(prefix_file_without_ext, fmt)


def create_log_filename_from_datetime(dt: Union[datetime, ddate], suffix=None) -> str:
    file_name = dt.strftime(BASE_FILENAME_FORMAT)
    if suffix:
        file_name = f'{file_name}_{suffix}'

    return file_name + '.log'


def get_base_filename(basedir, suffix=None):
    """Generate log file basename"""
    if not basedir:
        basedir = 'log'
    return os.path.join(basedir, create_log_filename_from_datetime(datetime.now(), suffix))


class CustomRotatingNamer:
    def __init__(self, pid: str, datetime_format: str):
        self.pid = pid
        self.datetime_format = datetime_format

    def __call__(self, name):
        *prefix, log_ext, suffix = name.split('.')

        # This is the default log file name perhaps
        if log_ext != 'log':
            return name

        # check if this is datetime format from timed rotating handler
        # timed rotating filename:
        # file.log.2024-02-03_01-02-03 -> 20240203_010203_pid.log
        with contextlib.suppress(ValueError):
            # try to parse this, if we have error on this, the following codes will not be executed
            _ = datetime.strptime(suffix, self.datetime_format)
            dir_name = os.path.dirname(name)
            return get_base_filename(dir_name, self.pid)

        # rotating file name:
        # file.log.1 --> file.1.log
        if suffix.isdigit():
            return '.'.join([*prefix, suffix, log_ext])

        # something unexpected occur, we return default name created by stdlib
        return name


def rotator_wrapper(
    zip_create_caller: Callable[[Path], None] = None,
    zip_delete_caller: Callable[[Path], None] = None,
) -> Callable[[str, str], None]:
    """Create rotator to be used by logger's handler"""

    def inner(source: str, dest: str) -> None:
        if not os.path.exists(source):
            return
        path = Path(source)
        if zip_delete_caller is not None:
            zip_delete_caller(path.parent)
        if zip_create_caller is not None:
            zip_create_caller(path.parent)
        if os.path.exists(source):
            os.rename(source, dest)

    return inner


class ZipFileHandler:
    @staticmethod
    def create_zip_filename_from_datetime(dt: Union[datetime, ddate]) -> str:
        """Create zip file based on date_time"""
        first_date_of_week = dt - timedelta(days=dt.weekday())
        return first_date_of_week.strftime(ZIP_FILENAME_FORMAT) + '.zip'

    @staticmethod
    def create_zip_filename_from_logfile(logfile: str) -> str:
        dt = get_datetime_from_file(logfile, BASE_FILENAME_FORMAT)
        zip_filename = ZipFileHandler.create_zip_filename_from_datetime(dt)
        parent = Path(logfile).parent
        return str(parent / zip_filename)

    @staticmethod
    def zip_all_files(files: List[str], zip_filename: str):
        """Zip all the files into a zip"""
        if not files:
            return
        with ZipFile(zip_filename, 'w') as zf:
            for file in files:
                _, basename = os.path.split(file)
                zf.write(file, arcname=basename)
                os.remove(file)

    @staticmethod
    def should_zip_file(current_date: datetime, creation_date: datetime) -> bool:
        """Check if we should zip the file with creation_date
        All the file with created before this week should be zipped
        """
        current_date_monday = shift_date_to_monday(current_date)
        creation_date_monday = shift_date_to_monday(creation_date)
        return current_date_monday - creation_date_monday >= timedelta(weeks=1)

    @staticmethod
    def zip_all_previous_files(path: Path, **kwargs):
        """Zip all previous files which in the same week into a single zip file"""
        # only run this if we have log files to be zipped
        current_date = datetime.now()
        files_to_be_zipped: Dict[str, List[str]] = {}

        # gather all log files should be zipped
        for logfile in glob.glob(os.path.join(path, '*.log')):
            creation_date = get_datetime_from_file(logfile, BASE_FILENAME_FORMAT)
            if not ZipFileHandler.should_zip_file(current_date, creation_date):
                break
            zip_filename = ZipFileHandler.create_zip_filename_from_logfile(logfile)
            if zip_filename not in files_to_be_zipped:
                files_to_be_zipped[zip_filename] = [logfile]
            else:
                files_to_be_zipped[zip_filename].append(logfile)

        for zip_filename, logfiles in files_to_be_zipped.items():
            ZipFileHandler.zip_all_files(logfiles, zip_filename)

    @staticmethod
    def should_delete_zipped_file(
        current_date: datetime,
        creation_date: datetime,
        week_offset: int = DELETE_ZIPPED_FILE_OLDER_THAN,
    ) -> bool:
        current_date_monday = shift_date_to_monday(current_date)
        creation_date_monday = shift_date_to_monday(creation_date)
        return current_date_monday - creation_date_monday >= timedelta(weeks=week_offset)

    @staticmethod
    def delete_old_zipped_files(path: Path, **kwargs):
        """Delete zip file older than day_offset"""
        current_date = datetime.now()
        for file in glob.glob(os.path.join(path, '*.zip')):
            if not os.path.exists(file):
                continue
            creation_date = get_datetime_from_file(file, ZIP_FILENAME_FORMAT)
            if ZipFileHandler.should_delete_zipped_file(current_date, creation_date):
                os.remove(file)


class CustomRotatingHandler(TimedRotatingFileHandler, RotatingFileHandler):
    """
    Custom rotating handler for both time and size rotate
    This is actually a bad design using diamond inheritance, however doing this way
    would be safer since we do not handle stream and buffer directly
    """

    def __init__(
        self,
        log_dir,
        is_main: bool = False,
        # timed rotating handler parameters
        when: str = 'h',
        interval: int = 1,
        at_time: Optional[time.time] = None,
        # rotating handler parameters
        max_bytes: int = 0,
        backup_count: int = 0,
    ):
        pid = str(os.getpid())
        suffix_pid = f'{pid}_main' if is_main else pid
        filename = get_base_filename(log_dir, suffix_pid)

        RotatingFileHandler.__init__(
            self,
            filename,
            encoding='utf-8',
            maxBytes=max_bytes,
            backupCount=backup_count,
            delay=True,
        )
        TimedRotatingFileHandler.__init__(
            self,
            filename,
            encoding='utf-8',
            when=when,
            interval=interval,
            atTime=at_time,
            delay=True,
            # we don't use backup count here, but this is shared with rotating file handler ...
            # if we don't set it, this __init__ will reset the count back to zero
            backupCount=backup_count,
        )

        # self.suffix here is actually a datetime format driven by `TimedRotatingFileHandler`
        self.namer = CustomRotatingNamer(suffix_pid, self.suffix)

        self.should_rollover_by_time = False
        self.should_rollover_by_size = False

    def shouldRollover(self, record):  # noqa: N802 overwrite from standard lib
        self.should_rollover_by_time = TimedRotatingFileHandler.shouldRollover(self, record)
        self.should_rollover_by_size = RotatingFileHandler.shouldRollover(self, record)
        return self.should_rollover_by_time or self.should_rollover_by_size

    def doRollover(self):  # noqa: N802 overwrite from standard lib
        if self.should_rollover_by_time:
            TimedRotatingFileHandler.doRollover(self)
        elif self.should_rollover_by_size:
            RotatingFileHandler.doRollover(self)
            self.recompute_rollover_at()

    def recompute_rollover_at(self):
        """
        When RotatingFileHandler.doRollover occur,
        we need to update `rolloverAt` for `TimedRotatingFileHandler` as well
        These lines of code are hard-copied from `TimedRotatingFileHandler.doRollover` stdlib
        """
        # get the time that this sequence started at and make it a TimeTuple
        currentTime = int(time.time())  # noqa
        dstNow = time.localtime(currentTime)[-1]  # noqa
        newRolloverAt = self.computeRollover(currentTime)  # noqa
        while newRolloverAt <= currentTime:
            newRolloverAt += self.interval
        # If DST changes and midnight or weekly rollover, adjust for this.
        if (self.when == 'MIDNIGHT' or self.when.startswith('W')) and not self.utc:
            dstAtRollover = time.localtime(newRolloverAt)[-1]  # noqa
            if dstNow != dstAtRollover:
                if not dstNow:  # noqa DST kicks in before next rollover, so we need to deduct an hour
                    addend = -3600
                else:  # DST bows out before next rollover, so we need to add an hour
                    addend = 3600
                newRolloverAt += addend
        self.rolloverAt = newRolloverAt


class CustomMemoryHandler(MemoryHandler):
    def __init__(
        self,
        capacity,
        target: CustomRotatingHandler | None = None,
        record_max_bytes: int | None = None,
        flush_interval: int | None = None,
    ):
        MemoryHandler.__init__(
            self,
            capacity=capacity,
            target=target,
            # never flush on any certain level
            flushLevel=logging.CRITICAL * 2,
        )
        self.record_max_bytes = record_max_bytes

        self.flush_interval = flush_interval
        self.flush_at = None
        if self.flush_interval is not None:
            self.flush_at = int(time.time()) + self.flush_interval

    def shouldFlush(self, record):  # noqa: N802 overwrite from standard lib
        """
        Determine if a record should trigger flush by `total records in buffer` and `record size`

        - Total records in buffer: we rely on `MemoryHandler.shouldFlush`
        - Record size: we use `RotatingFileHandler.shouldRollover` to check record byte size
        """
        if MemoryHandler.shouldFlush(self, record):
            return True

        if self.record_max_bytes is not None:
            # these lines are copied from `RotatingFileHandler.shouldRollover`
            msg = '%s\n' % self.format(record)
            if len(msg) >= self.record_max_bytes:
                return True

        # should flush at some interval to avoid log stale
        if self.flush_at is not None and self.flush_interval is not None:
            current_time = int(time.time())
            if current_time >= self.flush_at:
                # recompute next flush at
                self.flush_at = current_time + self.flush_interval
                return True

        return False


def get_log_level(basic_config_yaml) -> int:
    log_level = basic_config_yaml.get_node(keys=('info', LOG_LEVEL), default_val=ApLogLevel.INFO.name)
    default_logger_level = logging.DEBUG if log_level == ApLogLevel.DEBUG.name else logging.INFO
    return default_logger_level


def is_enable_log_file(start_up_yaml) -> bool:
    enable_file_log = start_up_yaml.get_node(keys=('setting_startup', 'enable_file_log'))
    return enable_file_log is not None and str(enable_file_log).strip() == '1'


def get_log_handlers(
    log_dir: str,
    log_level=logging.INFO,
    enable_log_file: bool = True,
    is_main: bool = False,
):
    handlers = []

    # loglevel for chardet encoding detect, avoid it emit too many messages
    logging.getLogger('chardet.charsetprober').setLevel(logging.INFO)

    if enable_log_file:
        # initiate log dir if not existing
        os.makedirs(log_dir, exist_ok=True)

        file_handler = CustomRotatingHandler(
            log_dir,
            is_main,
            # timed rotating handler parameters
            when='midnight',
            at_time=dtime(0, 0, 0),
            interval=WRITE_BY_TIME,
            # rotating handler parameters
            max_bytes=ROTATE_BY_SIZE,
            backup_count=BACKUP_COUNT_FOR_SIZE_ROTATED,
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)

        memory_handler = CustomMemoryHandler(
            capacity=WRITE_BY_BUFFER,
            target=file_handler,
            record_max_bytes=RECORD_MAX_BYTE,
            flush_interval=WRITE_BY_TIME,
        )

        # handle rotate log file by file-size
        handlers.append(memory_handler)

    # write log into console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    handlers.append(console_handler)

    return handlers


def bind_user_info(req=None, res=None):
    logger.info(f'REQUEST: {req.method} {req.full_path}')
    if res:
        logger.info(f'RESPONSE: {res.status_code}')
    return logger


def log_execution_time(prefix='', logging_exception=True):
    """Decorator to log function run time
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
            try:
                result = fn(*args, **kwargs)
            except Exception as e:
                raise e
            finally:
                print_log_with_processing_time(start, start_dt)
            return result

        def print_log_with_processing_time(start, start_dt):
            end = perf_counter()
            count_time = end - start
            log_func = logger.info if count_time >= 1 else logger.debug
            log_func(f'{prefix} Function: {fn.__name__}; START: {start_dt}; ExecTime: {count_time:.6f}s')

        return wrapper

    return decorator


def log_exec_time_inside_func(prefix, func_name, is_log_debug=False):
    """
    log inside a function . we use it for generator func
    :param prefix:
    :param func_name:
    :param is_log_debug:
    :return:
    """
    start = perf_counter()
    start_dt = datetime.utcnow()

    def inner(msg: str = ''):
        end = perf_counter()
        end_dt = datetime.utcnow()
        message = '{0} Function Name: {1}; START: {2}; END: {3}; Execution Time: {4:.6f}s; {5}; {6}'.format(
            prefix,
            func_name,
            start_dt,
            end_dt,
            end - start,
            msg,
            '',
        )
        if is_log_debug:
            logger.debug(message)
        else:
            logger.info(message)

    return inner


def log_count_record_number(file_name, record_number):
    logger.info(f'[READ CSV FILES] File name: {file_name}; Record number: {record_number}')
