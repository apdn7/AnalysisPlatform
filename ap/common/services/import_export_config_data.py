from ap.common.constants import CfgConstantType, JobType
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import is_job_running, scheduler
from ap.setting_module.models import CfgConstant, CfgProcess
from ap.trace_data.transaction_model import TransactionData


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


def clear_db_n_data(is_drop_t_process_tables=False):
    truncate_datatables()
    if is_drop_t_process_tables:
        delete_t_process_tables()
    # delete_folder_data()


def reset_is_show_file_name():
    # with BridgeStationModel.get_db_proxy() as db_instance:
    #     _, rows = CfgProcess.get_all_records(db_instance, row_is_dict=True)
    #     ids = [row.get('id') for row in rows]
    #     CfgProcess.bulk_update_by_ids(db_instance, ids, {CfgProcess.Columns.is_show_file_name.name: None})
    return True


def pause_job_running(remove_jobs: bool = True):
    if scheduler.running:
        scheduler.pause()
    if remove_jobs:
        scheduler.remove_all_jobs()
    set_break_job_flag(True)


def set_break_job_flag(is_break: bool):
    # do not allow to set BREAK_JOB=False when we're shutting down application
    if not is_break and is_job_running(job_name=JobType.SHUTDOWN_APP.name):
        return

    CfgConstant.create_or_update_by_type(
        const_type=CfgConstantType.BREAK_JOB.name,
        const_value=is_break,
        const_name=CfgConstantType.BREAK_JOB.name,
    )
