import io
import logging
import os.path
import shutil
from pathlib import Path
from time import sleep
from typing import Optional
from zipfile import ZIP_DEFLATED, ZipFile

from flask import current_app

from ap import scheduler
from ap.common.constants import (
    APP_DB_FILE,
    PROCESS_QUEUE_FILE_NAME,
)
from ap.common.jobs.jobs import RunningJobs, RunningJobStatus
from ap.common.jobs.utils import kill_all_jobs
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
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.import_export_config_n_data import (
    download_zip_file,
)
from ap.script.migrate_cfg_data_source_csv import migrate_cfg_data_source_csv
from ap.script.migrate_cfg_process import migrate_cfg_process
from ap.script.migrate_cfg_process_column import migrate_cfg_process_column
from ap.script.migrate_csv_datatype import migrate_csv_datatype
from ap.script.migrate_csv_dummy_datetime import migrate_csv_dummy_datetime
from ap.script.migrate_csv_save_graph_settings import migrate_csv_save_graph_settings
from ap.script.migrate_delta_time import migrate_delta_time_in_cfg_trace_key
from ap.script.migrate_m_function import migrate_m_function_data
from ap.script.migrate_m_unit import migrate_m_unit_data
from ap.script.migrate_process_file_name_column import (
    migrate_cfg_process_add_file_name,
    migrate_cfg_process_column_add_column_raw_dtype,
    migrate_cfg_process_column_add_column_raw_name,
    migrate_cfg_process_column_add_column_type,
    migrate_cfg_process_column_add_parent_id,
    migrate_cfg_process_column_change_all_generated_datetime_column_type,
)
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import TransactionData

PREVIEW_DATA_FILE_NAME = 'data_preview.zip'

logger = logging.getLogger(__name__)


def zip_preview_folder_to_byte() -> Optional[io.BytesIO]:
    """
    returns: zip archive
    """
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
            with ZipFile(input_zip.open(name)) as file_path:
                file_path.extractall(get_preview_data_path())
            continue

        input_zip.extract(name, get_instance_path())


def truncate_datatables():
    trans = [TransactionData(proc.id) for proc in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with DbProxy(gen_data_source_of_universal_db(tran_data.process_id), True) as db_instance:
            transaction_tbls = [
                tran_data.table_name,
                tran_data.data_count_table_name,
                tran_data.import_history_table_name,
            ]
            for tbl_name in transaction_tbls:
                sql = f'DELETE FROM {tbl_name};'
                db_instance.run_sql(sql)

    return True


def delete_t_process_tables():
    trans = [TransactionData(proc.id) for proc in CfgProcess.get_all_ids()]
    for i, tran_data in enumerate(trans):
        with DbProxy(gen_data_source_of_universal_db(tran_data.process_id), True) as db_instance:
            sql = f'DELETE FROM {tran_data.table_name};'
            db_instance.run_sql(sql)

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
        if os.path.exists(path):
            os.rename(path, os.path.join(get_instance_path(), '_' + os.path.basename(os.path.normpath(path))))


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
        backup_path = os.path.join(get_instance_path(), '_' + os.path.basename(os.path.normpath(path)))
        if os.path.exists(backup_path):
            os.rename(backup_path, path)


def cleanup_backup_data():
    preview_data_path = get_preview_data_path()
    transaction_folder_path = get_transaction_folder_path()
    config_db_path = get_config_db_path()
    scheduler_db_path = get_scheduler_db_path()
    for path in [preview_data_path, transaction_folder_path, config_db_path, scheduler_db_path]:
        # clear backup folders with _ prefix
        backup_path = os.path.join(get_instance_path(), '_' + os.path.basename(os.path.normpath(path)))
        if os.path.exists(backup_path):
            if os.path.isfile(backup_path):
                os.remove(backup_path)
            else:
                shutil.rmtree(backup_path)


def run_migrations():
    migrate_csv_datatype(current_app.config.get(APP_DB_FILE))
    migrate_csv_dummy_datetime(current_app.config.get(APP_DB_FILE))
    migrate_csv_save_graph_settings(current_app.config.get(APP_DB_FILE))
    migrate_cfg_data_source_csv(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_add_file_name(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column_add_column_raw_name(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column_add_column_raw_dtype(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column_add_column_type(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column_add_parent_id(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process_column_change_all_generated_datetime_column_type(current_app.config.get(APP_DB_FILE))
    migrate_cfg_process(current_app.config.get(APP_DB_FILE))

    # migrate function data
    migrate_m_function_data(current_app.config.get(APP_DB_FILE))
    # migrate delta_time
    migrate_delta_time_in_cfg_trace_key(current_app.config.get(APP_DB_FILE))
    # migrate units data
    migrate_m_unit_data(current_app.config.get(APP_DB_FILE))
