from ap.common.common_utils import delete_file, gen_sqlite3_file_name
from ap.common.constants import JobType
from ap.common.logger import log_execution_time
from ap.common.scheduler import remove_jobs
from ap.setting_module.models import CfgDataSource, CfgProcess, JobManagement, make_session

# @scheduler_app_context
# def delete_process_job(_job_id=None, _job_name=None, *args, **kwargs):
#     """scheduler job to delete process from db
#
#     Keyword Arguments:
#         _job_id {[type]} -- [description] (default: {None})
#         _job_name {[type]} -- [description] (default: {None})
#     """
#     gen = delete_process(*args, **kwargs)
#     send_processing_info(
#         gen,
#         JobType.DEL_PROCESS,
#         db_code=kwargs.get('db_id'),
#         process_id=kwargs.get('proc_id'),
#         is_check_disk=False,
#     )


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


# @log_execution()
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
    # get all processes to be deleted
    deleting_processes = CfgProcess.get_all_parents_and_children_processes(proc_id)
    # get ids incase sqlalchemy session is dead
    deleting_process_ids = [proc.id for proc in deleting_processes]
    # stop all jobs before deleting
    target_jobs = [JobType.CSV_IMPORT, JobType.FACTORY_IMPORT, JobType.FACTORY_PAST_IMPORT]
    for proc_id in deleting_process_ids:
        remove_jobs(target_jobs, proc_id)

    CfgProcess.batch_delete(deleting_process_ids)

    for proc_id in deleting_process_ids:
        delete_transaction_db_file(proc_id)

    return deleting_process_ids


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
