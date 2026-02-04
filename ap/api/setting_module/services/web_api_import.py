from __future__ import annotations

import logging
from collections.abc import Generator

from ap.api.setting_module.services.data_import import (
    data_pre_processing,
    gen_error_output_df,
    gen_import_job_info,
    get_df_first_n_last,
    import_data,
    write_error_import,
    write_error_trace,
)
from ap.api.setting_module.services.web_api import WebAPI
from ap.api.trace_data.services.proc_link import add_gen_proc_link_job, finished_transaction_import
from ap.common.common_utils import WebAuthenticationType
from ap.common.cryptography_utils import decrypt_pwd
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgProcess, JobManagement
from ap.setting_module.services.background_process import (
    JobInfo,
    send_processing_info,
)
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)


@scheduler_app_context
def import_web_api_job(
    process_id: int,
    job_management: JobManagement,
    is_user_request: bool = False,
):
    """Scheduler job import web api data"""
    gen = import_web_api(process_id)
    send_processing_info(
        gen,
        job_management=job_management,
        after_success_func=finished_transaction_import,
        after_success_func_kwargs={'process_id': process_id, 'is_user_request': is_user_request, 'publish': True},
    )
    add_gen_proc_link_job(process_id=process_id, is_user_request=True, publish=True)


def import_web_api(process_id: int) -> Generator:
    yield 0
    proc_cfg: CfgProcess = CfgProcess.get_proc_by_id(process_id)
    if not proc_cfg:
        return

    # check db connection
    # DbProxy.check_db_connection(proc_cfg.data_source.db_detail)

    trans_data = TransactionData(proc_cfg)
    with DbProxy(gen_data_source_of_universal_db(proc_cfg.id), True) as db_instance:
        trans_data.create_table(db_instance)

    # columns info
    transaction_columns = proc_cfg.get_transaction_process_columns()
    dic_use_cols = {col.column_name: col for col in transaction_columns}

    # get date time column
    get_date_col = proc_cfg.get_date_col()

    api_url = proc_cfg.data_source.web_detail.url
    username = proc_cfg.data_source.web_detail.username
    password = decrypt_pwd(proc_cfg.data_source.web_detail.password)
    authentication_type: WebAuthenticationType = WebAuthenticationType[
        proc_cfg.data_source.web_detail.authentication_type
    ]

    web_api = WebAPI(api_url, username=username, password=password, authentication_type=authentication_type)
    df = web_api.get_data().df_rows

    # data pre-processing
    df, df_error = data_pre_processing(
        df,
        orig_df=df,
        dic_use_cols=dic_use_cols,
        exclude_cols=[get_date_col],
        get_date_col=get_date_col,
    )
    df_error_cnt = len(df_error)
    if df_error_cnt:
        factory_data_name = f'{proc_cfg.id}_{proc_cfg.name}'
        df_error_trace = gen_error_output_df(
            factory_data_name,
            dic_use_cols,
            get_df_first_n_last(df_error),
            df_error.head(),
        )
        write_error_trace(df_error_trace, proc_cfg.name)
        write_error_import(df_error, proc_cfg.name)

    job_info = JobInfo()
    job_info.target = proc_cfg.name
    if len(df):
        save_res = import_data(df, proc_cfg, get_date_col, job_info)
        gen_import_job_info(job_info, save_res, err_cnt=df_error_cnt)

    yield 100
