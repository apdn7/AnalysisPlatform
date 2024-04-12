import datetime as dt

from apscheduler.triggers import interval
from pytz import utc

from ap.common.common_utils import get_data_path
from ap.common.constants import JobType
from ap.common.logger import (
    CLEAN_ZIP_INTERVAL,
    ZIP_LOG_INTERVAL,
    ZipFileHandler,
)
from ap.common.scheduler import scheduler

# @scheduler_app_context
# def clean_old_data_job(_job_id=None, _job_name=None, *args, **kwargs):
#     """scheduler job to delete process from db
#
#     Keyword Arguments:
#         _job_id {[type]} -- [description] (default: {None})
#         _job_name {[type]} -- [description] (default: {None})
#     """
#     gen = clean_old_files(*args, **kwargs)
#     send_processing_info(gen, JobType.CLEAN_DATA, is_check_disk=False)


# @log_execution_time()
# def clean_old_files(folder=None, num_day_ago=30):
#     """Delete old files in a folder
#     Arguments:
#         prefix {[type]} -- [file prefix]
#         postfix {[type]} -- [file postfix]
#
#     Keyword Arguments:
#         db_id {[type]} -- [description] (default: {None})
#     Yields:
#         [type] -- [description]
#     """
#     percent = 0
#     yield percent
#
#     cleanup_unused_exe_folder()
#
#     if not folder:
#         yield 100
#         return
#
#     files = get_files_of_last_n_days(folder, num_day_ago=num_day_ago, subdirectory=True)
#     percent_step = round(100 / (len(files) + 1))
#     for file in files:
#         try:
#             os.remove(file)
#         except Exception:
#             pass
#         percent = percent + percent_step
#         yield percent
#
#     yield 100


# @log_execution_time()
# def get_files_of_last_n_days(directory, num_day_ago=30, subdirectory=False, extension=None):
#     """get file in folder
#
#     Arguments:
#         directory {[type]} -- [description]
#         num_days {int} -- [description] (default: {1})
#         subdirectory {int} -- [description]
#         extension {string} -- [use created_time or modified_time] (default: {False})
#
#     Keyword Arguments:
#
#     Returns:
#         output_files [type] -- [files to be cleaned]
#     """
#     now = dt.datetime.utcnow()
#     n_days_ago = now - dt.timedelta(days=num_day_ago)
#
#     output_files = []
#     if not directory:
#         return output_files
#
#     root_folder = True
#     for root, dirs, files in os.walk(directory):
#         # limit depth of recursion
#         if subdirectory is False and root_folder is False:
#             break
#
#         # list files
#         for file in files:
#             if extension and not file.endswith(extension):
#                 continue
#
#             abs_file_name = os.path.join(root, file)
#             st = os.stat(abs_file_name)
#
#             time_of_file = dt.datetime.fromtimestamp(st.st_mtime)
#             if time_of_file <= n_days_ago:
#                 output_files.append(abs_file_name)
#
#         root_folder = False
#
#     return output_files


# @log_execution_time()
# def get_folders_of_last_n_days(directory, num_day_ago=30, startswith=None):
#     """get file in folder
#
#     Arguments:
#         directory {[type]} -- [description]
#         num_days {int} -- [description] (default: {1})
#         startswith {string} -- [use created_time or modified_time] (default: {False})
#
#     Keyword Arguments:
#
#     Returns:
#         output_files [type] -- [files to be cleaned]
#     """
#     now = dt.datetime.utcnow()
#     n_days_ago = now - dt.timedelta(days=num_day_ago)
#
#     output_folders = []
#     if not directory:
#         return output_folders
#
#     for root, folders, files in os.walk(directory):
#         # list dirs
#         for folder in folders:
#             if startswith and not folder.startswith(startswith):
#                 continue
#
#             abs_folder_name = os.path.join(root, folder)
#             st = os.stat(abs_folder_name)
#
#             time_of_file = dt.datetime.fromtimestamp(st.st_mtime)
#             if time_of_file <= n_days_ago:
#                 output_folders.append(abs_folder_name)
#
#         break
#
#     return output_folders


def add_job_zip_all_previous_log_files():
    log_path = get_data_path(is_log=True)
    interval_trigger = interval.IntervalTrigger(seconds=ZIP_LOG_INTERVAL, timezone=utc)
    scheduler.add_job(
        JobType.ZIP_LOG.name,
        ZipFileHandler.zip_all_previous_files,
        trigger=interval_trigger,
        replace_existing=True,
        next_run_time=dt.datetime.now().astimezone(utc),
        kwargs={'path': log_path},
    )


def add_job_delete_old_zipped_log_files():
    log_path = get_data_path(is_log=True)
    interval_trigger = interval.IntervalTrigger(seconds=CLEAN_ZIP_INTERVAL, timezone=utc)
    scheduler.add_job(
        JobType.CLEAN_ZIP.name,
        ZipFileHandler.delete_old_zipped_files,
        trigger=interval_trigger,
        replace_existing=True,
        next_run_time=dt.datetime.now().astimezone(utc),
        kwargs={'path': log_path},
    )
