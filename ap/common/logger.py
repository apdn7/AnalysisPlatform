import glob
import logging
import os
import time
from datetime import date as ddate
from datetime import datetime, timedelta
from datetime import time as dtime
from functools import wraps
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from time import perf_counter
from typing import Callable, Dict, List, Optional, Union
from zipfile import ZipFile

from ap.common.constants import LOG_LEVEL, ApLogLevel

tz = time.strftime('%z')
LOG_FORMAT = '%(asctime)s' + tz + ' %(levelname)s: %(message)s'
# LOG_FORMAT = '%(count)s %(asctime)s %(levelname)s: %(message)s'
# buffer (records) to write log file
# WRITE_BY_BUFFER = 1000
WRITE_BY_BUFFER = 10_000
# time interval (seconds) to write log file
# default is 60 (1 minute)
WRITE_BY_TIME = 60
# time interval (seconds) to rotate log file
# default is 86400 (1 day)

ROTATE_BY_SIZE = 50 * 1024 * 1024  # 50MB
BACKUP_COUNT_FOR_SIZE_ROTATED = 1000

DELETE_ZIPPED_FILE_OLDER_THAN = 5  # weeks

logger = logging.getLogger(__name__)

# do not emit root's logger message
logger.propagate = False

# set logging level for application, global use
logger.setLevel(logging.DEBUG)

# set log format
formatter = logging.Formatter(LOG_FORMAT)

BASE_FILENAME_FORMAT = '%Y%m%d_%H%M%S'

ZIP_FILENAME_FORMAT = '%Yw%W_%m%d'

ZIP_LOG_INTERVAL = 60 * 60 * 24 * 7  # 7 day
CLEAN_ZIP_INTERVAL = 60 * 60 * 24 * 7 * 4  # 4 weeks

# loglevel for chardet encoding detect
logging.getLogger('chardet.charsetprober').setLevel(logging.INFO)


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


def namer(name: str) -> str:
    """Switch extensions for RotatingFileHandler. Used by logger's handler.
    E.g: file.log.1 --> file.1.log
    """
    split_name = name.split('.')
    if len(split_name) < 2:
        return name
    if split_name[-2] == 'log' and split_name[-1].isdigit():
        split_name[-1], split_name[-2] = split_name[-2], split_name[-1]
    return '.'.join(split_name)


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
    def delete_old_zipped_files(path: Path):
        """Delete zip file older than day_offset"""
        current_date = datetime.now()
        for file in glob.glob(os.path.join(path, '*.zip')):
            if not os.path.exists(file):
                continue
            creation_date = get_datetime_from_file(file, ZIP_FILENAME_FORMAT)
            if ZipFileHandler.should_delete_zipped_file(current_date, creation_date):
                os.remove(file)


class BatchAndRotatingHandler(TimedRotatingFileHandler, RotatingFileHandler):
    # counter for batching write
    _msg_counter = 0
    # counter for time interval write
    _start_time = 0
    # max size of log file to rotate (bytes)
    _max_size = 0
    _basedir = None
    _buffers = []

    def __init__(
        self,
        log_dir,
        is_main=False,
        when: str = 'h',
        interval: int = 1,
        max_bytes: int = 0,
        backup_count: int = 0,
        encoding: Optional[str] = None,
        delay: bool = False,
        at_time: Optional[time.time] = False,
        rotate_by_job: bool = False,
        write_by_buffer=WRITE_BY_BUFFER,
        write_by_time=WRITE_BY_TIME,
    ):
        self._log_dir = log_dir
        self._pid = str(os.getpid())
        self._suffix = f'{self._pid}_main' if is_main else self._pid
        logfile = get_base_filename(self._log_dir, self._suffix)
        TimedRotatingFileHandler.__init__(
            self,
            logfile,
            when=when,
            interval=interval,
            backupCount=backup_count,
            encoding=encoding,
            delay=delay,
            atTime=at_time,
        )

        RotatingFileHandler.__init__(
            self,
            logfile,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding=encoding,
            delay=delay,
        )

        self.write_by_buffer = write_by_buffer
        self.write_by_time = write_by_time
        self.namer = namer

        if not rotate_by_job:
            print('This should only be used in test.')
            self.rotator = rotator_wrapper(
                ZipFileHandler.zip_all_previous_files,
                ZipFileHandler.delete_old_zipped_files,
            )

    def set_base_dir(self, basedir):
        self._basedir = basedir

    def timed_should_roll_over(self, record):
        return TimedRotatingFileHandler.shouldRollover(self, record)

    def batch_should_roll_over(self, record):
        return RotatingFileHandler.shouldRollover(self, record)

    def shouldRollover(self, record):  # noqa: N802, this method is inherited from standard library
        return self.timed_should_roll_over(record) or self.batch_should_roll_over(record)

    def is_should_write_log(self, elapsed_time):
        if self._msg_counter >= self.write_by_buffer:
            print('counter is {}'.format(self._msg_counter))
        return elapsed_time >= self.write_by_time or self._msg_counter >= self.write_by_buffer

    def emit(self, record):
        try:
            msg = self.format(record)
            # open stream to write to RAM
            if self.stream is None:
                self.stream = self._open()
            stream = self.stream

            emit_time = int(time.time())
            if not self._start_time:
                self._start_time = int(time.time())
            elapsed_time = emit_time - self._start_time

            timed_should_rollover = self.timed_should_roll_over(record)
            batch_should_rollover = self.batch_should_roll_over(record)
            should_rollover = timed_should_rollover or batch_should_rollover
            should_write_log = self.is_should_write_log(elapsed_time)
            if should_write_log or should_rollover:
                stream.write(msg + self.terminator)
                if should_write_log and len(self._buffers):
                    self.write_to_stream(stream)

                if should_rollover:
                    if timed_should_rollover:
                        self.baseFilename = get_base_filename(self._log_dir, self._suffix)
                        TimedRotatingFileHandler.doRollover(self)
                    elif batch_should_rollover:
                        RotatingFileHandler.doRollover(self)
                    else:
                        raise NotImplementedError

                # reset batch size and time
                self._start_time = 0
                self.flush()
            else:
                # write all msg in batch before flush
                self._buffers.append(msg)
                self._msg_counter += 1
        except RecursionError:  # See issue 36272
            raise
        except Exception as e:
            print(e)
            self.handleError(record)

    def write_to_stream(self, stream):
        for msg in self._buffers:
            stream.write(msg + self.terminator)
        self._buffers = []
        self._msg_counter = 0

    def force_flush(self):
        if self.stream is None:
            self.stream = self._open()
        stream = self.stream

        self.write_to_stream(stream)

        self._start_time = 0
        self.flush()


def logger_force_flush():
    for handler in logger.handlers:
        if isinstance(handler, BatchAndRotatingHandler):
            handler.force_flush()


def set_log_config(is_main=False):
    import ap
    from ap import get_basic_yaml_obj
    from ap.common.common_utils import make_dir

    basic_config_yaml = get_basic_yaml_obj()
    log_level = basic_config_yaml.dic_config['info'].get(LOG_LEVEL) or ApLogLevel.INFO.name
    default_logger_level = logging.DEBUG if log_level == ApLogLevel.DEBUG.name else logging.INFO

    # get log folder from config
    log_dir = ap.dic_config.get('INIT_LOG_DIR')
    # initiate log dir if not existing
    make_dir(log_dir)

    file_handler = BatchAndRotatingHandler(
        log_dir,
        is_main,
        when='midnight',
        max_bytes=ROTATE_BY_SIZE,
        backup_count=BACKUP_COUNT_FOR_SIZE_ROTATED,
        encoding='utf8',
        delay=True,
        at_time=dtime(0, 0, 0),
        rotate_by_job=True,
    )
    file_handler.setLevel(default_logger_level)
    file_handler.setFormatter(formatter)
    file_handler.set_base_dir(log_dir)

    # handle rotate log file by file-size
    # file_handler.set_rotator(size=1000)
    logger.addHandler(file_handler)

    # write log into console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)


def log_execution(prefix='', logging_exception=True):
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
            start_dt = datetime.utcnow()
            start = perf_counter()

            log_args = str(args)
            log_kwargs = str(kwargs)
            try:
                logger.info(f'{prefix}{fn.__name__}; START; {log_args}; {log_kwargs}')
                result = fn(*args, **kwargs)
            except Exception as e:
                if logging_exception:
                    logger.exception(e)
                raise e
            finally:
                end = perf_counter()
                count_time = end - start
                log_func = logger.info if count_time >= 1 else logger.debug
                log_func(
                    '{0}Function: {1}; START: {2}; ExecTime: {3:.6f}s;'.format(
                        prefix,
                        fn.__name__,
                        start_dt,
                        end - start,
                    ),
                )
            return result

        return wrapper

    return decorator


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
