import logging
import os
import shutil

from ap.common.constants import AnnounceEvent, CacheType, CfgConstantType, JobType, ProcessStatus
from ap.common.jobs.job_info_schema import DelAllTransactionDataJobInfo, ProcessJobInfo
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventExpireCache, EventQueue, EventRemoveJobs
from ap.common.path_utils import delete_file, gen_sqlite3_file_name, get_data_path, resource_path
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgConstant, CfgDataSource, CfgExport, CfgProcess, JobManagement, make_session
from ap.setting_module.services.background_process import send_processing_info
from ap.setting_module.services.process_config import update_process_status
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)


@log_execution_time()
def delete_proc_cfg_and_relate_jobs(proc_id):
    with make_session() as meta_session:
        # get all processes to be deleted
        deleting_processes = CfgProcess.get_all_parents_and_children_processes(proc_id, session=meta_session)
        # get ids incase sqlalchemy session is dead
        deleting_process_ids = [proc.id for proc in deleting_processes]

        # stop all jobs before deleting
        target_jobs = JobType.jobs_include_process_id()
        for p in deleting_process_ids:
            EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=p))
            remove_export_jobs_by_process_id(p)

        for cfg_process in deleting_processes:
            meta_session.delete(cfg_process)

    delete_pulled_data_folders(deleting_process_ids)

    for p in deleting_process_ids:
        delete_transaction_db_file(p)

    return deleting_process_ids


@log_execution_time()
def remove_export_jobs_by_process_id(process_id):
    try:
        cfg_exports = CfgExport.get_by_process_id(process_id)
        for cfg_export in cfg_exports:
            EventQueue.put(
                EventRemoveJobs(
                    job_types=JobType.jobs_include_export_id(), process_id=process_id, export_id=cfg_export.id
                )
            )
    except Exception as e:
        logger.exception(f'Failed to remove export_jobs for process_id={process_id}: {e}')


@log_execution_time()
def initialize_proc_config(proc_id):
    """Initialize process config"""
    deleting_process_ids = delete_transaction_when_initial_process(proc_id)

    for pid in deleting_process_ids:
        update_process_status(pid, status=ProcessStatus.INITIALIZED)


def delete_transaction_when_initial_process(proc_id):
    """Delete transaction data when initialize a process"""
    # get all processes to be deleted
    deleting_processes = CfgProcess.get_all_parents_and_children_processes(proc_id)
    # get ids incase sqlalchemy session is dead
    deleting_process_ids = [proc.id for proc in deleting_processes]
    # stop all jobs before deleting
    target_jobs = JobType.jobs_include_process_id()

    for p in deleting_process_ids:
        EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=p))

    delete_pulled_data_folders(deleting_process_ids)

    for p in deleting_process_ids:
        delete_transaction_db_file(p)

    return deleting_process_ids


@scheduler_app_context
def delete_transaction_data_job(job_management: JobManagement):
    gen = delete_transaction_data()
    send_processing_info(
        gen,
        job_management=job_management,
    )

    # Reload trace config to update total imported records for all processes
    EventQueue.put(
        EventBackgroundAnnounce(
            event=AnnounceEvent.DEL_TRANSACTION_DATA_BY_LIMIT,
        ),
    )


@scheduler_app_context
def delete_all_transaction_data_job(job_management: JobManagement):
    gen = delete_all_transaction_data(job_management)
    send_processing_info(
        gen,
        job_management=job_management,
    )

    # Reload trace config to update total imported records for all processes
    EventQueue.put(
        EventBackgroundAnnounce(
            event=AnnounceEvent.DEL_TRANSACTION_DATA_BY_LIMIT,
        ),
    )


def delete_all_transaction_data(job_management: JobManagement = None):
    from ap.api.setting_module.services.import_function_column import add_required_jobs_after_update_transaction_table

    yield 0
    processes = CfgProcess.get_all(status=ProcessStatus.REGISTERED)
    job_management.info = DelAllTransactionDataJobInfo(processes=[])
    for idx, process in enumerate(processes):
        initialize_proc_config(process.id)
        update_process_status(process.id, status=ProcessStatus.REGISTERED)
        add_required_jobs_after_update_transaction_table(process)
        job_management.info.processes.append(ProcessJobInfo(id=process.id, name=process.name))
        yield 100 / ((idx + 1) * len(processes))

    job_management.info.info('Delete all transaction data')


def delete_transaction_data():
    # get Import limit
    yield 0
    import_limit = CfgConstant.get_value_by_type_first(CfgConstantType.IMPORT_LIMIT.name, int)
    if not import_limit:
        yield 100
        return

    process_ids: list[int] = CfgProcess.get_all_ids(status=ProcessStatus.REGISTERED)
    for idx, process_id in enumerate(process_ids):
        trans_data = TransactionData(process_id)
        with DbProxy(gen_data_source_of_universal_db(process_id), True) as db_instance:
            trans_data.create_table(db_instance)
            if trans_data.clean_data_with_limit_import(db_instance, import_limit):
                EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))
            yield 100 / ((idx + 1) * len(process_ids))


# @log_execution_time()
# def get_unused_procs():
#     return list({proc.id for proc in Process.get_all_ids()} - {proc.id for proc in CfgProcess.get_all_ids()})


def del_data_source(ds_id):
    """
    Delete data source
    :param ds_id:
    :return:
    """
    with make_session() as meta_session:
        ds = meta_session.query(CfgDataSource).get(ds_id)
        if not ds:
            return

        # delete data
        for proc in ds.processes or []:
            delete_proc_cfg_and_relate_jobs(proc.id)
        meta_session.delete(ds)


def delete_transaction_db_file(proc_id):
    try:
        file_name = gen_sqlite3_file_name(proc_id)
        delete_file(file_name)
    except Exception:
        pass

    return True


def delete_pulled_data_folders(process_ids: list[int]):
    data_folder = get_data_path()
    for process_id in process_ids:
        folder_path = resource_path(data_folder, str(process_id))
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)
            logger.debug('Deleted pulled data folder %s', folder_path)


def del_process_data_from_job_management(ds_id):
    """
    Delete data source
    :param ds_id:
    :return:
    """
    with make_session() as meta_session:
        job_info = meta_session.query(JobManagement).get(ds_id)
        if not job_info:
            return

        # delete data
        meta_session.delete(job_info)
        meta_session.commit()
