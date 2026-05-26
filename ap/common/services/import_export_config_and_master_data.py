import io
import os.path
import shutil
from datetime import UTC, datetime
from pathlib import Path
from time import sleep
from zipfile import ZIP_DEFLATED, ZipFile

from loguru import logger

from ap import scheduler
from ap.common.constants import (
    PROCESS_QUEUE_FILE_NAME,
    UNDER_SCORE,
)
from ap.common.jobs.jobs import RunningJobs, RunningJobStatus
from ap.common.jobs.utils import kill_all_jobs
from ap.common.log import BASE_FILENAME_FORMAT, get_datetime_from_file, get_datetime_from_zip_log_file
from ap.common.multiprocess_sharing import EventQueue
from ap.common.path_utils import (
    get_config_db_path,
    get_data_path,
    get_files,
    get_instance_path,
    get_preview_data_path,
    get_scheduler_db_path,
    get_transaction_folder_path,
)
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.services.import_export_config_n_data import (
    download_zip_file,
)
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import TransactionData

PREVIEW_DATA_FILE_NAME = 'data_preview.zip'


def zip_preview_folder_to_byte() -> io.BytesIO | None:
    """returns: zip archive"""
    preview_data_path = Path(get_preview_data_path())
    if not preview_data_path.is_dir():
        return None

    archive = io.BytesIO()
    with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as zip_archive:
        for file_path in get_files(preview_data_path.__str__(), extension=['json']):
            _file_path = Path(file_path)
            with (
                zip_archive.open(os.path.join(_file_path.parent.name, _file_path.name), 'w') as file,
                _file_path.open(
                    'rb',
                ) as f,
            ):
                file.write(f.read())

    return archive


def create_archive(data_dir, start_date=None, end_date=None, date_format='%Y-%m-%d %H:%M:%S'):
    """
    Create zip archive containing files (including zip files) filtered by date range.

    Args:
        data_dir (str | Path): target export data path
        start_date (str | None): ex: '2026-03-01 00:00:00'
        end_date (str | None): ex: '2026-03-10 23:59:59'
        date_format (str): datetime format

    Returns:
        BytesIO | None
    """
    data_path = Path(data_dir)

    if not data_path.is_dir():
        return None

    # parse string -> datetime
    start_dt = datetime.strptime(start_date, date_format).replace(tzinfo=UTC) if start_date else None
    end_dt = datetime.strptime(end_date, date_format).replace(tzinfo=UTC) if end_date else None

    archive = io.BytesIO()

    with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as zip_archive:
        for file_path in data_path.rglob('*'):
            if not file_path.is_file():
                continue

            file_time = datetime.fromtimestamp(file_path.stat().st_mtime, tz=UTC)

            if start_dt and file_time < start_dt:
                continue

            if end_dt and file_time >= end_dt:
                continue

            arc_name = file_path.relative_to(data_path)
            zip_archive.write(file_path, arc_name)

    archive.seek(0)

    return archive


def create_archive_log_folder(data_dir, start_date=None, end_date=None, date_format='%Y-%m-%d %H:%M:%S'):
    """
    Create zip archive containing files (including zip files) filtered by date range.

    Args:
        data_dir (str | Path): target export data path
        start_date (str | None): ex: '2026-03-01 00:00:00'
        end_date (str | None): ex: '2026-03-10 23:59:59'
        date_format (str): datetime format

    Returns:
        BytesIO | None
    """
    data_path = Path(data_dir)

    if not data_path.is_dir():
        return None

    # parse string -> datetime
    start_dt = datetime.strptime(start_date, date_format) if start_date else None
    end_dt = datetime.strptime(end_date, date_format) if end_date else None

    archive = io.BytesIO()

    with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as zip_archive:
        for file_path in data_path.rglob('*'):
            if not file_path.is_file():
                continue

            # get datetime from filename
            file_name = file_path.name
            if file_path.suffix == '.zip':
                file_time_start, file_time_end = get_datetime_from_zip_log_file(file_name)
                if not file_time_start or not file_time_end:
                    continue

                # filter
                if start_dt and file_time_end < start_dt:
                    continue

                if end_dt and file_time_start >= end_dt:
                    continue

                # ========================
                # HANDLE NORMAL FILE
                # ========================
            else:
                file_time = get_datetime_from_file(file_name, BASE_FILENAME_FORMAT)

                if not file_time:
                    continue

                if start_dt and file_time < start_dt:
                    continue

                if end_dt and file_time >= end_dt:
                    continue
            arc_name = file_path.relative_to(data_path)
            zip_archive.write(file_path, arc_name)

    archive.seek(0)

    return archive


def export_data():
    export_dbs = (get_config_db_path(), get_scheduler_db_path())
    table_data_s = []
    file_names = []
    for db_path in export_dbs:
        _db_path = Path(db_path.__str__())
        with _db_path.open('rb') as f:
            table_data_s.append(f.read())
            file_names.append(_db_path.name)

    # add preview data into zip file
    zip_preview_byte = zip_preview_folder_to_byte()
    if zip_preview_byte is not None:
        table_data_s.append(zip_preview_byte)
        file_names.append(PREVIEW_DATA_FILE_NAME)

    return download_zip_file('export_file', table_data_s, file_names)


def import_config_and_master(file_path):
    input_zip = ZipFile(file_path)

    file_names = sorted(input_zip.namelist())
    for name in file_names:
        if name in [PREVIEW_DATA_FILE_NAME]:
            with ZipFile(input_zip.open(name)) as f:
                f.extractall(get_preview_data_path())
            continue

        input_zip.extract(name, get_instance_path())


def truncate_datatables():
    trans = [TransactionData(proc_id) for proc_id in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with (
            TxnDataConnection(process_id=tran_data.process_id, readonly_transaction=False) as data_con,
            TxnMetaConnection(process_id=tran_data.process_id) as meta_con,
        ):
            transaction_tbls = [
                tran_data.data_count_table_name,
                tran_data.import_history_table_name,
                tran_data.export_history_table_name,
            ]
            sql = f'DELETE FROM {tran_data.table_name};'
            data_con.run_sql(sql)
            for tbl_name in transaction_tbls:
                sql = f'DELETE FROM {tbl_name};'
                meta_con.run_sql(sql)

    return True


def delete_t_process_tables():
    trans = [TransactionData(proc_id) for proc_id in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with TxnDataConnection(process_id=tran_data.process_id, readonly_transaction=False) as data_con:
            sql = f'DELETE FROM {tran_data.table_name};'
            data_con.run_sql(sql)

    return True


def wait_done_jobs():
    kill_all_jobs()
    while True:
        # Wait for all jobs to stop before clearing database
        running_jobs = RunningJobs.get_running_jobs()
        has_running_jobs = False
        with RunningJobs.lock():
            for job in running_jobs.values():
                if job.status is RunningJobStatus.EXECUTING:
                    has_running_jobs = True
        if not has_running_jobs:
            break
        sleep(1)


def clear_db_n_data(is_drop_t_process_tables=False):
    truncate_datatables()
    if is_drop_t_process_tables:
        delete_t_process_tables()


def pause_job_running(remove_scheduler_jobs: bool = True):
    if scheduler.running:
        scheduler.pause()
    if remove_scheduler_jobs:
        scheduler.remove_all_jobs()


def delete_file_and_folder_by_path(path, ignore_folder=None):
    is_data_path = path == get_data_path()
    for root, dirs, files in os.walk(path):
        if ignore_folder and ignore_folder in root:
            continue

        for file in files:
            if is_data_path and PROCESS_QUEUE_FILE_NAME in file:
                # do not remove process_queue.pkl file, it necessary for multiprocessing management
                continue

            file_path = os.path.join(root, file)
            try:
                os.remove(file_path)
            except OSError as e:
                logger.error(f'File could not be deleted. {e}')

        for dir in dirs:
            dir_path = os.path.join(root, dir)
            if os.path.basename(dir_path) != ignore_folder:
                try:
                    shutil.rmtree(dir_path)
                except OSError as e:
                    logger.error(f'Folder data could not be deleted. {e}')
    return {}, 200


def delete_folder_data(ignore_folder='preview'):
    data_path = get_data_path()
    delete_file_and_folder_by_path(data_path, ignore_folder=ignore_folder)


def clear_event_queue():
    EventQueue.clear()


def pause_event_queue():
    EventQueue.pause()


def resume_event_queue():
    EventQueue.resume()


def backup_instance_folder():
    preview_data_path = get_preview_data_path()
    transaction_folder_path = get_transaction_folder_path()
    config_db_path = get_config_db_path()
    scheduler_db_path = get_scheduler_db_path()
    # rename current files and folders in instance with _ prefix
    for path in [preview_data_path, transaction_folder_path, config_db_path, scheduler_db_path]:
        path_obj = Path(path)
        if path_obj.exists():
            backup_path = Path(get_instance_path()) / (UNDER_SCORE + path_obj.name)
            path_obj.rename(backup_path)


def revert_instance_folder():
    preview_data_path = get_preview_data_path()
    transaction_folder_path = get_transaction_folder_path()
    config_db_path = get_config_db_path()
    scheduler_db_path = get_scheduler_db_path()
    # clear extracted content, delete _ from backup folders
    for path in [preview_data_path, transaction_folder_path, config_db_path, scheduler_db_path]:
        if os.path.exists(path):
            if os.path.isfile(path):
                os.remove(path)
            else:
                shutil.rmtree(path)

        backup_path = Path(get_instance_path()) / (UNDER_SCORE + Path(path).name)
        if backup_path.exists():
            backup_path.rename(path)


def cleanup_backup_data():
    preview_data_path = get_preview_data_path()
    transaction_folder_path = get_transaction_folder_path()
    config_db_path = get_config_db_path()
    scheduler_db_path = get_scheduler_db_path()
    for path in [preview_data_path, transaction_folder_path, config_db_path, scheduler_db_path]:
        # clear backup folders with _ prefix
        backup_path = os.path.join(get_instance_path(), UNDER_SCORE + os.path.basename(os.path.normpath(path)))
        if os.path.exists(backup_path):
            if os.path.isfile(backup_path):
                os.remove(backup_path)
            else:
                shutil.rmtree(backup_path)
