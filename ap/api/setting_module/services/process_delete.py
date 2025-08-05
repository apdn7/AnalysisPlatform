from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventQueue, EventRemoveJobs
from ap.common.path_utils import delete_file, gen_sqlite3_file_name
from ap.setting_module.models import CfgDataSource, CfgProcess, JobManagement, make_session
from ap.setting_module.services.process_config import update_is_import_column

# @log_execution_time()
# def delete_process():
#     """
#     delete processes
#     :return:
#     """
#     yield 0
#
#     missing_procs = get_unused_procs()
#
#     if missing_procs:
#         proc_id = missing_procs[0]
#         proc = Process.query.get(proc_id)
#         proc.delete_proc_detail()
#         db.session.delete(proc)
#         db.session.commit()
#
#     yield 100


# @log_execution_time()
# def add_del_proc_job():
#     missing_procs = get_unused_procs()
#
#     if not missing_procs:
#         return
#
#     scheduler.add_job(
#         JobType.DEL_PROCESS.name,
#         delete_process_job,
#         trigger=DateTrigger(run_date=datetime.now().astimezone(utc), timezone=utc),
#         replace_existing=True,
#         kwargs={'_job_id': JobType.DEL_PROCESS.name, '_job_name': JobType.DEL_PROCESS.name},
#     )


@log_execution_time()
def delete_proc_cfg_and_relate_jobs(proc_id):
    with make_session() as meta_session:
        # get all processes to be deleted
        deleting_processes = CfgProcess.get_all_parents_and_children_processes(proc_id, session=meta_session)
        # get ids incase sqlalchemy session is dead
        deleting_process_ids = [proc.id for proc in deleting_processes]

        # stop all jobs before deleting
        target_jobs = [
            JobType.CSV_IMPORT,
            JobType.FACTORY_IMPORT,
            JobType.FACTORY_PAST_IMPORT,
            JobType.RESTRUCTURE_INDEXES,
            JobType.USER_BACKUP_DATABASE,
            JobType.USER_RESTORE_DATABASE,
            JobType.UPDATE_TRANSACTION_TABLE,
        ]
        for proc_id in deleting_process_ids:
            EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=proc_id))

        for cfg_process in deleting_processes:
            meta_session.delete(cfg_process)

    for proc_id in deleting_process_ids:
        delete_transaction_db_file(proc_id)

    return deleting_process_ids


@log_execution_time()
def initialize_proc_config(proc_id):
    # get all processes to be deleted
    deleting_processes = CfgProcess.get_all_parents_and_children_processes(proc_id)
    # get ids incase sqlalchemy session is dead
    deleting_process_ids = [proc.id for proc in deleting_processes]
    # stop all jobs before deleting
    target_jobs = [
        JobType.CSV_IMPORT,
        JobType.FACTORY_IMPORT,
        JobType.FACTORY_PAST_IMPORT,
        JobType.RESTRUCTURE_INDEXES,
        JobType.USER_BACKUP_DATABASE,
        JobType.USER_RESTORE_DATABASE,
        JobType.UPDATE_TRANSACTION_TABLE,
    ]

    for proc_id in deleting_process_ids:
        EventQueue.put(EventRemoveJobs(job_types=target_jobs, process_id=proc_id))

    for proc_id in deleting_process_ids:
        delete_transaction_db_file(proc_id)
        update_is_import_column(proc_id, is_import=False)


# @log_execution_time()
# def get_unused_procs():
#     return list({proc.id for proc in Process.get_all_ids()} - {proc.id for proc in CfgProcess.get_all_ids()})


def del_data_source(ds_id):
    """
    delete data source
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


def del_process_data_from_job_management(ds_id):
    """
    delete data source
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
