import os
import shutil

from loguru import logger

from ap import db
from ap.common.constants import AnnounceEvent, CacheType, CfgConstantType, JobType, ProcessStatus
from ap.common.jobs.job_info_schema import (
    DelAllTransactionDataJobInfo,
    DelTransactionDataByLimit,
)
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventExpireCache, EventQueue, EventRemoveJobs
from ap.common.path_utils import delete_file, gen_duckdb_file_name, gen_sqlite3_file_name, get_data_path, resource_path
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgConstant, CfgDataSource, CfgExport, CfgProcess, JobManagement, make_session
from ap.setting_module.services.background_process import send_processing_info
from ap.setting_module.services.process_config import update_process_status
from ap.trace_data.transaction_model import TransactionData


@log_execution_time()
def delete_proc_cfg_and_relate_jobs(proc_id):
    with db.session.begin_nested() as transaction_session:
        # get all processes to be deleted
        deleting_processes = CfgProcess.get_all_parents_and_children_processes(
            proc_id, session=transaction_session.session
        )
        # get ids incase sqlalchemy session is dead
        deleting_process_ids = [proc.id for proc in deleting_processes]

        # stop all jobs before deleting
        target_jobs = JobType.jobs_include_process_id()
        for p in deleting_process_ids:
            EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=p))
            remove_export_jobs_by_process_id(p)

        for cfg_process in deleting_processes:
            transaction_session.session.delete(cfg_process)

        transaction_session.commit()

    delete_pulled_data_folders(deleting_process_ids)

    for p in deleting_process_ids:
        delete_transaction_db_file(p)

    return deleting_process_ids


def _build_delete_modal_entry(proc: CfgProcess) -> dict:
    """Describe a process for the delete confirmation modal.

    A merged child always carries its parent's name (the names are kept in sync by
    ``create_or_update_process_cfg``), so the name alone cannot tell the processes of one
    merge group apart. The data source and table are returned as well, matching the columns
    the user already sees in the process config table, so the modal can render a label that
    identifies each process unambiguously.
    """
    data_source = proc.data_source
    return {
        'id': proc.id,
        'name': proc.shown_name,
        'data_source_name': data_source.name if data_source is not None else None,
        'table_name': proc.table_name,
    }


@log_execution_time()
def classify_processes_for_delete(process_ids):
    """Classify selected processes for the bulk-delete confirmation modal.

    From the list of selected process ids (the processes the user ticked to delete),
    build:

    - ``selected_parents``: selected processes that are a merge destination, i.e. that have
      at least one child merged into them. Deleting one removes its whole merge group, so
      the modal warns with them (warning #1).
    - ``selected_children``: selected processes that are merged into a parent (their own
      ``parent_id`` is set). These are deleted alone.
    - ``reload_targets``: parent processes that are NOT part of the deletion but have at
      least one selected child (warning #2). Their already-imported data must be reloaded to
      reflect the child deletion. A parent whose whole group is being deleted (its id is also
      selected) is skipped because there is nothing left to reload.

    Every entry is built by ``_build_delete_modal_entry`` so the modal can distinguish
    same-named processes of a merge group. Ordering follows the selection order and is
    de-duplicated so the modal renders deterministically.
    """
    selected_ids = list(dict.fromkeys(process_ids))
    selected_id_set = set(selected_ids)

    selected_parents = []
    selected_children = []
    reload_targets = []
    seen_reload_parent_ids = set()

    for proc_id in selected_ids:
        proc = CfgProcess.query.get(proc_id)
        if proc is None:
            continue

        parent = CfgProcess.get_parent(proc_id)
        if parent is not None:
            selected_children.append(_build_delete_modal_entry(proc))
            # Only reload a parent that survives the deletion (its group is not fully removed).
            if parent.id not in selected_id_set and parent.id not in seen_reload_parent_ids:
                seen_reload_parent_ids.add(parent.id)
                reload_targets.append(_build_delete_modal_entry(parent))
        elif CfgProcess.get_children(proc_id):
            selected_parents.append(_build_delete_modal_entry(proc))

    return {
        'selected_parents': selected_parents,
        'selected_children': selected_children,
        'reload_targets': reload_targets,
    }


@log_execution_time()
def delete_child_process_and_relate_jobs(proc_id, reload_related_process_data=False):
    """Delete ONLY the selected child process of a merge group.

    Unlike ``delete_proc_cfg_and_relate_jobs`` (which removes the whole merge group),
    this removes just the selected child process config, its jobs, pulled data folder
    and transaction db files. When ``reload_related_process_data`` is True, the parent
    merged process is re-initialized and re-imported so the deleted child's data is
    removed from the already-loaded data (mirrors the "Edit merged process" init_parent
    flow in ``post_proc_config``).
    """
    # Resolve the parent (merged) process before deletion, because the relationship
    # is lost once the child row is removed.
    parent = CfgProcess.get_parent(proc_id)
    parent_id = parent.id if parent else None

    with db.session.begin_nested() as transaction_session:
        cfg_process = transaction_session.session.query(CfgProcess).get(proc_id)
        if cfg_process is None:
            return []

        # stop jobs of this child only before deleting
        EventQueue.put(EventRemoveJobs(job_types=JobType.jobs_include_process_id(), process_id=proc_id))
        remove_export_jobs_by_process_id(proc_id)

        transaction_session.session.delete(cfg_process)
        transaction_session.commit()

    delete_pulled_data_folders([proc_id])
    delete_transaction_db_file(proc_id)

    if reload_related_process_data and parent_id is not None:
        reinitialize_and_reimport_merged_process(parent_id)

    return [proc_id]


@log_execution_time()
def reinitialize_and_reimport_merged_process(parent_id):
    """Re-initialize and re-import a parent merged process and its remaining children.

    Mirrors the "Edit merged process" re-import flow (``post_proc_config`` with
    ``init_parent``): wipe the parent group's transaction data, recreate empty tables,
    then re-queue import jobs so the loaded data reflects the current children.
    """
    # local import to avoid circular import between process_delete and import_function_column
    from ap.api.setting_module.services.import_function_column import add_required_jobs_after_update_transaction_table

    # wipe + recreate empty transaction tables for the parent group
    delete_transaction_when_initial_process(parent_id)

    # re-import parent and remaining children (deleted child already removed)
    for process in CfgProcess.get_all_parents_and_children_processes(parent_id):
        add_required_jobs_after_update_transaction_table(process)


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
        # recreate tables
        trans_data = TransactionData(p)
        with (
            TxnDataConnection(process_id=p, readonly_transaction=False) as data_con,
            TxnMetaConnection(process_id=p) as meta_con,
        ):
            trans_data.create_table(data_con, meta_con)

    return deleting_process_ids


@scheduler_app_context
def delete_transaction_data_job(job_management: JobManagement):
    gen = delete_transaction_data(job_management)
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
        job_management.info.processes.append(
            DelAllTransactionDataJobInfo.ProcessJobInfo(id=process.id, name=process.name)
        )
        yield 100 / ((idx + 1) * len(processes))

    job_management.info.info('Delete all transaction data')


def delete_transaction_data(job_management: JobManagement):
    # get Import limit
    yield 0
    import_limit = CfgConstant.get_value_by_type_first(CfgConstantType.IMPORT_LIMIT.name, int)
    if not import_limit:
        yield 100
        return

    process_ids: list[int] = CfgProcess.get_all_ids(status=ProcessStatus.REGISTERED)
    job_management.info = DelTransactionDataByLimit(processes=[])
    for idx, process_id in enumerate(process_ids):
        trans_data = TransactionData(process_id)
        with (
            TxnMetaConnection(process_id=process_id) as meta_con,
            TxnDataConnection(process_id=process_id, readonly_transaction=False) as data_con,
        ):
            deleted_records = trans_data.clean_data_with_limit_import(data_con, meta_con, import_limit)
            job_management.info.processes.append(
                DelTransactionDataByLimit.DelTransactionProcessJobInfo(
                    id=process_id, name=trans_data.cfg_process.name, deleted_records=deleted_records
                )
            )
            if deleted_records > 0:
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
    deleted_process_ids = []

    with make_session() as meta_session:
        ds = meta_session.query(CfgDataSource).get(ds_id)
        if not ds:
            return None

        # delete data
        for proc in list(ds.processes or []):
            deleted_process_ids.extend(delete_proc_cfg_and_relate_jobs(proc.id))
        meta_session.delete(ds)

    return list(dict.fromkeys(deleted_process_ids))


def del_data_sources(ds_ids):
    deleted_data_source_ids = []
    deleted_process_ids = []
    not_found_data_source_ids = []
    failed_data_source_ids = []

    for ds_id in ds_ids:
        try:
            proc_ids = del_data_source(ds_id)

            if proc_ids is None:
                not_found_data_source_ids.append(ds_id)
                continue

            deleted_data_source_ids.append(ds_id)
            deleted_process_ids.extend(proc_ids)
        except Exception:
            logger.exception('Failed to delete data source %s', ds_id)
            failed_data_source_ids.append(ds_id)

    return {
        'deleted_data_source_ids': deleted_data_source_ids,
        'deleted_process_ids': list(dict.fromkeys(deleted_process_ids)),
        'not_found_data_source_ids': not_found_data_source_ids,
        'failed_data_source_ids': failed_data_source_ids,
    }


def delete_transaction_db_file(proc_id: int):
    delete_file(gen_sqlite3_file_name(proc_id))
    delete_file(gen_duckdb_file_name(proc_id))


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
