import itertools
import logging
from collections.abc import Generator
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from apscheduler.job import Job
from pytz import utc
from sqlalchemy.orm import scoped_session

from ap import log_execution_time, scheduler
from ap.api.setting_module.services.data_import import (
    gen_bulk_insert_sql,
    gen_insert_cycle_values,
    get_insert_params,
    insert_data,
)
from ap.api.setting_module.services.equations import get_all_normal_columns_for_functions
from ap.api.setting_module.services.polling_frequency import add_import_job, add_import_job_params
from ap.api.trace_data.services.proc_link import add_restructure_indexes_job
from ap.common.common_utils import generate_job_id
from ap.common.constants import CacheType, JobType
from ap.common.multiprocess_sharing import EventExpireCache, EventQueue
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.scheduler import scheduler_app_context
from ap.equations.utils import get_function_class_by_id
from ap.setting_module.models import (
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    use_meta_session,
)
from ap.setting_module.services.background_process import JobInfo, send_processing_info
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)


@log_execution_time()
def calculate_data_for_main_serial_function_column(
    df: pd.DataFrame,
    cfg_process: CfgProcess,
    main_serial_cfg_process_column: CfgProcessColumn,
    is_use_column_raw_name: bool = True,
) -> pd.DataFrame:
    """
    Calculate data for function column as ``main::Serial``

    :param pd.DataFrame df: A DataFrame want to be calculated.
    In this df, base columns are required to serve calculating data
    :param CfgProcess cfg_process: A process model object
    :param CfgProcessColumn main_serial_cfg_process_column: A process column model object that is as **main::serial**
    :param bool is_use_column_raw_name: True -> use `column_raw_name`, False -> use `bridge_column_name`
    :return: DataFrame that include column have calculated data
    :rtype: pd.DataFrame
    """

    def _get_column_name(cfg_col: CfgProcessColumn) -> str:
        return cfg_col.column_raw_name if is_use_column_raw_name else cfg_col.bridge_column_name

    def _get_column_by_id(column_id: int) -> Optional[CfgProcessColumn]:
        return next(filter(lambda x: x.id == column_id, cfg_process.columns), None)

    def _add_missing_column(_df: pd.DataFrame, column_name: Optional[str]) -> pd.DataFrame:
        if column_name and column_name not in _df.columns:
            _df[column_name] = np.nan
        return _df

    df_columns = df.columns.tolist()

    # Get component columns that necessary for calculating value
    relation_column_ids = get_all_normal_columns_for_functions([main_serial_cfg_process_column.id], cfg_process.columns)
    relation_column_ids.append(main_serial_cfg_process_column.id)
    relation_cfg_process_column_dict = {_id: _get_column_by_id(_id) for _id in relation_column_ids}
    relation_cfg_process_columns: list[CfgProcessColumn] = list(
        filter(lambda x: x.function_details, relation_cfg_process_column_dict.values()),
    )
    cfg_function_cols = itertools.chain.from_iterable(
        cfg_col.function_details for cfg_col in relation_cfg_process_columns
    )
    sorted_cfg_function_cols = sorted(cfg_function_cols, key=lambda col: col.order)

    # Calculate function data
    for cfg_func_col in sorted_cfg_function_cols:  # type: CfgProcessFunctionColumn
        equation_class = get_function_class_by_id(cfg_func_col.function_id)
        equation = equation_class.from_kwargs(**cfg_func_col.as_dict())

        # Get column_x and column_y
        cfg_col_x: CfgProcessColumn = _get_column_by_id(cfg_func_col.var_x)
        cfg_col_y: Optional[CfgProcessColumn] = _get_column_by_id(cfg_func_col.var_y) if cfg_func_col.var_y else None

        column_x, x_dtype = (
            (_get_column_name(cfg_col_x), cfg_col_x.predict_type) if cfg_col_x else (None, None)
        )  # type: str
        column_y, y_dtype = (
            (_get_column_name(cfg_col_y), cfg_col_y.predict_type) if cfg_col_y else (None, None)
        )  # type: Optional[str]

        df = _add_missing_column(df, column_x)
        df = _add_missing_column(df, column_y)

        cfg_col: CfgProcessColumn = relation_cfg_process_column_dict.get(cfg_func_col.process_column_id)
        df = equation.evaluate(
            df,
            out_col=_get_column_name(cfg_col),
            x_col=column_x,
            y_col=column_y,
            x_dtype=x_dtype,
            y_dtype=y_dtype,
        )

    target_function_column = _get_column_name(main_serial_cfg_process_column)
    if target_function_column not in df_columns:
        df_columns.append(target_function_column)

    return df[df_columns]


@log_execution_time()
def handle_main_serial_function_column(
    db_instance,
    transaction_obj: TransactionData,
    old_main_serial_cfg_process_column: Optional[CfgProcessColumn] = None,
    auto_commit: bool = True,
) -> Generator[float]:
    """
    Handle changing **main::serial** for function column

    :param db_instance: A database instance
    :param TransactionData transaction_obj: A transaction object
    :param Optional[CfgProcessColumn] old_main_serial_cfg_process_column: \
    A process column model object that is as **main::serial** before change
    :param bool auto_commit: True: Each statement of execute_sql it will run commit, Otherwise
    :return: done percent
    :rtype: Generator[float]
    """
    old_main_serial_cfg_process_function_column: Optional[CfgProcessFunctionColumn] = (
        (old_main_serial_cfg_process_column.function_details or [None])[0]
        if old_main_serial_cfg_process_column
        else None
    )

    new_main_serial_cfg_process_column: CfgProcessColumn = next(
        (col for col in transaction_obj.cfg_process.columns if col.is_serial_no),
        None,
    )
    # We ignore function 'me' in this case, therefore there is only one function record for a normal function
    new_main_serial_cfg_function_column: Optional[CfgProcessFunctionColumn] = (
        (new_main_serial_cfg_process_column.function_details or [None])[0]
        if new_main_serial_cfg_process_column
        else None
    )

    if (
        # In case function column is not main::serial
        (old_main_serial_cfg_process_function_column is None and new_main_serial_cfg_function_column is None)
        # In case function column is only changed note
        or (
            old_main_serial_cfg_process_function_column
            and new_main_serial_cfg_function_column
            and old_main_serial_cfg_process_function_column.id == new_main_serial_cfg_function_column.id
            and old_main_serial_cfg_process_function_column.function_id
            == new_main_serial_cfg_function_column.function_id
            and old_main_serial_cfg_process_function_column.var_x == new_main_serial_cfg_function_column.var_x
            and old_main_serial_cfg_process_function_column.var_y == new_main_serial_cfg_function_column.var_y
            and old_main_serial_cfg_process_function_column.a == new_main_serial_cfg_function_column.a
            and old_main_serial_cfg_process_function_column.b == new_main_serial_cfg_function_column.b
            and old_main_serial_cfg_process_function_column.c == new_main_serial_cfg_function_column.c
            and old_main_serial_cfg_process_function_column.n == new_main_serial_cfg_function_column.n
            and old_main_serial_cfg_process_function_column.k == new_main_serial_cfg_function_column.k
            and old_main_serial_cfg_process_function_column.s == new_main_serial_cfg_function_column.s
            and old_main_serial_cfg_process_function_column.t == new_main_serial_cfg_function_column.t
            and old_main_serial_cfg_process_function_column.order == new_main_serial_cfg_function_column.order
            and old_main_serial_cfg_process_function_column.return_type
            == new_main_serial_cfg_function_column.return_type
        )
    ):
        # Do nothing
        yield 100
        return

    # In case change to main::serial normal column or not have main::serial column
    if new_main_serial_cfg_function_column is None:
        # In case main::serial function column is removed
        if old_main_serial_cfg_process_function_column:
            indexes = transaction_obj.get_indexes_by_column_name(
                db_instance,
                old_main_serial_cfg_process_column.bridge_column_name,
            )
            for index in indexes:
                transaction_obj.drop_index(db_instance, index, auto_commit=auto_commit)

            transaction_obj.delete_columns(
                db_instance,
                [old_main_serial_cfg_process_column.bridge_column_name],
                auto_commit=auto_commit,
            )

        yield 100
        return

    yield from insert_data_for_main_serial_function_column(
        db_instance,
        transaction_obj,
        new_main_serial_cfg_process_column,
        auto_commit=auto_commit,
    )


@log_execution_time()
def insert_data_for_main_serial_function_column(
    db_instance,
    transaction_obj: TransactionData,
    main_serial_cfg_process_column: CfgProcessColumn,
    auto_commit: bool = True,
) -> Generator[float]:
    """
    Insert calculated data for ``main::serial`` for function column into transaction table.

    :param db_instance: A database instance
    :param transaction_obj: A transaction object
    :param main_serial_cfg_process_column: A process column model object that is as **main::serial**
    :param auto_commit: True: Each statement of execute_sql it will run commit, Otherwise
    :return: done percent
    :rtype: Generator[float]
    """
    # Create new table with function column
    new_table_name = f'{transaction_obj.table_name}_calculating'
    transaction_obj.delete_sequence_table(
        db_instance,
        new_table_name,
        auto_commit=auto_commit,
    )  # avoid old session with old columns
    transaction_obj.create_table(db_instance, new_table_name, auto_commit=auto_commit)
    done_percent = 10
    yield done_percent

    # Start - [Calculate function data and insert to new table]
    data = transaction_obj.get_all_data_by_chunk(db_instance)
    if data is None:
        # In case connection failure
        raise Exception('Connection failure !!!')

    transaction_columns = transaction_obj.cfg_process.get_transaction_process_columns()
    column_names = [x.bridge_column_name for x in transaction_columns]
    sql_params = get_insert_params(column_names)
    sql_insert = gen_bulk_insert_sql(new_table_name, *sql_params)
    data_columns = next(data)
    for data_chunk in data:  # type: list[tuple]
        df = pd.DataFrame(data=data_chunk, columns=data_columns)
        df = calculate_data_for_main_serial_function_column(
            df,
            transaction_obj.cfg_process,
            main_serial_cfg_process_column,
            is_use_column_raw_name=False,
        )
        insert_vals = gen_insert_cycle_values(df[column_names])
        is_success = insert_data(db_instance, sql_insert, insert_vals)
        if not is_success:
            raise Exception('Cannot insert calculated data !!!')

        done_percent += 10 if done_percent < 70 else 1 if done_percent < 80 else 0.1 if done_percent < 90 else 0.01
        yield done_percent
    # End - [Calculate function data and insert to new table]

    # Drop old table
    transaction_obj.delete_sequence_table(db_instance, auto_commit=auto_commit)

    # Rename new table back to origin table name
    transaction_obj.rename_sequence_table(
        db_instance,
        new_table_name,
        transaction_obj.table_name,
        auto_commit=auto_commit,
    )
    done_percent = 100
    yield done_percent


@use_meta_session()
def add_new_columns_to_transaction_table(process: CfgProcess, meta_session: scoped_session = None):
    """
    Add new function column as ``main::Serial`` into transaction table directly.

    **NOTE**: this function must be called directly after process config is updated to make sure that show graph
    feature work normally without any exception related to missing columns in transaction table.
    :param int process: a cfg_process object
    :param scoped_session meta_session: a db session
    :return: void
    """
    with DbProxy(gen_data_source_of_universal_db(process.id), True, immediate_isolation_level=True) as db_instance:
        trans_data = TransactionData(process, meta_session=meta_session)
        if trans_data.table_name not in db_instance.list_tables():
            # If transaction is not created yet, do nothing
            return

        new_columns = trans_data.get_new_columns(db_instance, table_name=trans_data.table_name)
        if new_columns:
            dict_new_col_with_type = {column.bridge_column_name: column.data_type for column in new_columns}
            trans_data.add_columns(db_instance, trans_data.table_name, dict_new_col_with_type)


def add_required_jobs_after_update_transaction_table(
    process: CfgProcess = None,
    is_new_process: bool = False,
):
    """
    Add required jobs for ``main::Serial`` to update ``main::Serial``
    :param CfgProcess process: a cfg_process object
    :param bool is_new_process: True if process is created newly, False otherwise
    :return: void
    """
    if not is_new_process:
        # reset cache of transaction data after update
        EventQueue.put(EventExpireCache(cache_type=CacheType.TRANSACTION_DATA))

    # add import data job
    import_params = add_import_job_params(process)
    add_import_job(
        process_id=import_params.process_id,
        process_name=import_params.process_name,
        data_source_id=import_params.data_source_id,
        data_source_type=import_params.data_source_type,
        run_now=True,
        is_user_request=True,
    )

    # create indexes for new table
    add_restructure_indexes_job(process.id)


def update_transaction_table(
    process: CfgProcess,
    old_main_serial_cfg_process_column: Optional[CfgProcessColumn] = None,
    meta_session: scoped_session = None,
) -> Generator[JobInfo]:
    """
    Update transaction table by doing some points as below:

    #. Delete redundant table columns that not exist in ``cfg_process_column`` table
    #. Remove old ``main::Serial`` column and add new one into transaction table
    #. Insert calculated data of ``main::Serial`` column into transaction table

    :param CfgProcess process: a cfg_process object
    :param Optional[CfgProcessColumn] old_main_serial_cfg_process_column: old cfg process column as ``main::Serial``
    :param scoped_session meta_session: a db session
    :return: a JobInfo
    :rtype: Generator[JobInfo]
    """
    job_info = JobInfo()
    job_info.has_record = True  # trick to execute after_success_func after done generate
    job_info.percent = 0
    yield job_info

    with DbProxy(
        gen_data_source_of_universal_db(process.id),
        True,
        immediate_isolation_level=True,
    ) as db_instance, job_info.interruptible() as job_info:
        auto_commit = False
        trans_data = TransactionData(process, meta_session=meta_session)
        trans_data.create_table(db_instance, auto_commit=auto_commit)
        job_info.percent = 10
        yield job_info

        # delete unused columns
        exist_table_columns = trans_data.get_table_columns(db_instance, trans_data.table_name)
        table_columns_from_cfg = [cfg_column.bridge_column_name for cfg_column in trans_data.cfg_process_columns]
        redundant_table_columns = [
            table_column for table_column in exist_table_columns if table_column not in table_columns_from_cfg
        ]
        if len(redundant_table_columns):
            # Must remove index first before remove column to avoid error
            for column in redundant_table_columns:
                indexes = trans_data.get_indexes_by_column_name(db_instance, column)
                for index in indexes:
                    trans_data.drop_index(db_instance, index, auto_commit=auto_commit)
            trans_data.delete_columns(db_instance, redundant_table_columns, auto_commit=auto_commit)
        job_info.percent = 20
        yield job_info

        for done_percent in handle_main_serial_function_column(
            db_instance,
            trans_data,
            old_main_serial_cfg_process_column,
            auto_commit=auto_commit,
        ):
            job_info.percent = round(20 + 0.8 * done_percent, 2)
            yield job_info


@scheduler_app_context
def update_transaction_table_job(
    process_id: int,
    old_main_serial_cfg_process_column: Optional[CfgProcessColumn] = None,
):
    """
    [Job] Update transaction table by doing some points as below:

    #. Delete redundant table columns that not exist in ``cfg_process_column`` table
    #. Remove old ``main::Serial`` column and add new one into transaction table
    #. Insert calculated data of ``main::Serial`` column into transaction table

    :param int process_id: an id of process
    :param Optional[CfgProcessColumn] old_main_serial_cfg_process_column: old cfg process column as ``main::Serial``
    :return: void
    """
    process = CfgProcess.get_proc_by_id(process_id)
    gen = update_transaction_table(process, old_main_serial_cfg_process_column)
    send_processing_info(
        gen,
        JobType.UPDATE_TRANSACTION_TABLE,
        process_id=process.id,
        is_check_disk=False,
        after_success_func=add_required_jobs_after_update_transaction_table,
        after_success_func_kwargs={'process': process},
    )


def reschedule_update_transaction_table():
    """
    Reschedule all ``UPDATE_TRANSACTION_TABLE`` jobs in APScheduler to recalculate data | recovery killed jobs.

    **NOTE**: Only do this function in start app time
    :return: void
    """
    process_ids: list[int] = [proc.id for proc in CfgProcess.get_all_ids()]
    jobs: list[Job] = scheduler.get_jobs()
    now = datetime.now(utc)
    for process_id in process_ids:
        job_id = generate_job_id(JobType.UPDATE_TRANSACTION_TABLE, process_id)
        for job in jobs:
            if job.id == job_id:
                job.modify(next_run_time=now)
