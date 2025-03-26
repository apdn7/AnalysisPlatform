import io
import os.path
import shutil
from time import sleep
from zipfile import ZipFile

from flask import current_app

from ap import scheduler
from ap.common.common_utils import (
    get_config_db_path,
    get_instance_path,
    get_preview_data_path,
    get_scheduler_db_path,
    get_transaction_folder_path,
)
from ap.common.constants import (
    APP_DB_FILE,
    CONFIG_DB,
    PREVIEW_DATA_FOLDER,
    SCHEDULER_DB,
)
from ap.common.jobs.jobs import RunningJobStatus
from ap.common.jobs.utils import kill_all_jobs
from ap.common.multiprocess_sharing import EventQueue, RunningJobs
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

INSTANCE_FILE_NAME = 'instance.zip'


def zip_instance_to_byte() -> io.BytesIO:
    """
    returns: zip archive
    """
    data_folder = get_instance_path()
    file_name_valid = {CONFIG_DB, SCHEDULER_DB}
    if not os.path.exists(data_folder):
        return None

    archive = io.BytesIO()
    with ZipFile(archive, 'w') as zip_archive:
        for root, dirs, files in os.walk(data_folder):
            if PREVIEW_DATA_FOLDER in dirs:
                preview_data_path = os.path.join(root, PREVIEW_DATA_FOLDER)
                for dir_root, dir_dirs, dir_files in os.walk(preview_data_path):
                    for file in dir_files:
                        file_path = os.path.join(dir_root, file)
                        zip_archive.write(file_path, os.path.relpath(file_path, data_folder))

            for file_name in files:
                if file_name in file_name_valid:
                    file_path = os.path.join(root, file_name)
                    zip_archive.write(file_path, os.path.relpath(file_path, data_folder))

    return archive


def pause_job_running(remove_scheduler_jobs: bool = True):
    if scheduler.running:
        scheduler.pause()
    if remove_scheduler_jobs:
        scheduler.remove_all_jobs()


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


def export_data():
    table_data_s = []
    file_names = []

    # zip instance db to byte
    zip_preview_byte = zip_instance_to_byte()
    if zip_preview_byte is not None:
        table_data_s.append(zip_preview_byte)
        file_names.append(INSTANCE_FILE_NAME)

    return download_zip_file('export_file', table_data_s, file_names)


def import_config(file_path):
    input_zip = ZipFile(file_path)
    with ZipFile(input_zip.open(INSTANCE_FILE_NAME)) as file_path:
        file_path.extractall(get_instance_path())


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
