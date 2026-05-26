from __future__ import annotations

import dataclasses
import datetime as dt
import enum
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union

import numpy as np
import pandas as pd
import sqlalchemy as sa
from loguru import logger

from ap.common.common_utils import Bound, BoundType, TimeRange, to_pydatetime
from ap.common.constants import DATE_FORMAT_STR_ONLY_DIGIT, LOG_SCALE_THRESHOLD, SQL_DAYS_AGO, BaseEnum
from ap.common.jobs.job_info_schema import PullDataJobInfo
from ap.common.log import log_execution_time
from ap.common.path_utils import get_data_path
from ap.common.pydn.dblib.db_proxy import gen_data_source_of_universal_db
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.common.timezone_utils import detect_timezone
from ap.setting_module.models import CfgProcess, JobManagement
from ap.trace_data.transaction_model import PullHistoryRecord, PullHistoryTable, TransactionData

FETCH_MANY_SIZE = 1_000_000
FILE_CHUNK_SIZE = 20_000


@dataclasses.dataclass
class PullBase(ABC):
    """Base class for pull data"""

    processes: list[CfgProcess]
    pull_data_job_info: PullDataJobInfo = dataclasses.field(default_factory=PullDataJobInfo)
    sql: Union[sa.Select, sa.CompoundSelect] | None = None

    @classmethod
    @abstractmethod
    def get_transaction_data_query(cls, process: CfgProcess, time_range: TimeRange) -> sa.Select: ...

    @abstractmethod
    def get_factory_time_range_per_process(self, factory_db_instance) -> dict[int, TimeRange]: ...

    @abstractmethod
    def save_transaction_data(
        self, data: Union[list[tuple], list[dict]], columns: list[str], job_management: JobManagement
    ): ...

    @classmethod
    def detect_query_datetime_range(
        cls,
        process: CfgProcess,
        factory_time_range: TimeRange,
        pull_history_record: PullHistoryRecord,
    ) -> list[TimeRange]:
        """Given a maximum timerange in factory db, determine the next time ranges to query
        We have 3 time ranges to consider:
        - selected_time_range: this is what user defines in GUI: [pull_from, inf)
        - pulled_time_range: this is what we have pulled so far, this can be empty (incase we havent' pulled anything)
        - factory_time_range: this is the timerange in database

        The time ranges we want must be:
        - in the selected time range
        - in the factory time range
        - not in pulled time range

        Then we must:
        - intersect the selected time range and factory time range
        - different with the pulled time range
        """
        if factory_time_range.min.kind is BoundType.UNBOUNDED or factory_time_range.max.kind is BoundType.UNBOUNDED:
            raise ValueError(f'Invalid time range: `{factory_time_range}` in database for process: {process.id}')

        factory_tzinfo = detect_timezone(factory_time_range.min.value)
        now = dt.datetime.now(factory_tzinfo)

        # get pull_from setting from datasource detail
        if (config_pull_from := process.data_source.db_detail.get_pull_from(factory_tzinfo)) is not None:
            pull_from = config_pull_from
        else:
            # auto guess full from
            pull_from = now - dt.timedelta(days=SQL_DAYS_AGO)
            if pull_from > factory_time_range.max.value:
                pull_from = factory_time_range.max.value - dt.timedelta(days=SQL_DAYS_AGO)

        selected_time_range = TimeRange(min=Bound.included(pull_from), max=Bound.included(now))
        pulled_time_range = pull_history_record.time_range(factory_tzinfo)

        selectable_time_range = selected_time_range.intersect(factory_time_range)
        if selectable_time_range is None:
            # pull from > max factory or now < min factory
            return []

        return selectable_time_range.different(pulled_time_range)

    def get_transaction_data_query_union_all(
        self, factory_db_instance, job_management: JobManagement
    ) -> Union[sa.Select, sa.CompoundSelect] | None:
        sql_selects: list[sa.Select] = []
        job_management.info = self.pull_data_job_info
        process_id_and_factory_time_range = self.get_factory_time_range_per_process(factory_db_instance)
        for process in self.processes:
            factory_time_range = process_id_and_factory_time_range.get(process.id)
            target_info = PullDataJobInfo.PullDataTargetInfo(
                process_id=process.id, import_from=factory_time_range.min.value, import_to=factory_time_range.max.value
            )
            self.pull_data_job_info.pull_targets.append(target_info)
            # table is empty, skip
            if factory_time_range is None or factory_time_range.is_empty():
                logger.warning(f'table for process {process.id} is empty. Please check.')
                continue

            gen_data_source_of_universal_db(process.id)
            trans_data = TransactionData(process)
            with (
                TxnMetaConnection(process_id=process.id) as meta_con,
                TxnDataConnection(process_id=process.id, readonly_transaction=False) as data_con,
            ):
                trans_data.create_table(data_con, meta_con)
                PullHistoryTable.create_table(meta_con, process.id)
                pull_history = PullHistoryTable.get(meta_con, process.id)

            query_time_ranges = self.detect_query_datetime_range(
                process,
                factory_time_range=factory_time_range,
                pull_history_record=pull_history,
            )
            for query_time_range in query_time_ranges:
                sql_select = self.get_transaction_data_query(process, time_range=query_time_range)
                sql_selects.append(sql_select)

        # no new data for pull
        if len(sql_selects) == 0:
            self.sql = None
            return None

        # data source has 1 process
        if len(sql_selects) == 1:
            self.sql = sql_selects[0]

        # data source has many processes, union all of them
        else:
            self.sql = sa.union_all(*sql_selects)

        return self.sql

    @log_execution_time()
    def pull_data(self, factory_db_instance, job_management: JobManagement):
        data = factory_db_instance.fetch_many(self.sql, size=FETCH_MANY_SIZE)
        columns = next(data)
        for ret in data:
            if not ret or len(ret) == 0:
                break

            self.save_transaction_data(ret, columns, job_management=job_management)

    @log_execution_time()
    def save_transaction_data_for_one_process(
        self,
        df: pd.DataFrame,
        process: CfgProcess,
    ):
        """Save pulled transaction data to a file at
        `data/process_id/transaction-mindate-maxdate-currentdate.feather`"""
        data_path = get_data_path()
        date_time_key = process.get_auto_increment_col_else_get_date()
        file_chunks = len(df) // FILE_CHUNK_SIZE + 1

        for i in range(file_chunks):
            start = i * FILE_CHUNK_SIZE
            end = (i + 1) * FILE_CHUNK_SIZE
            chunked_df = df.iloc[start:end]

            min_date = chunked_df[date_time_key].min()
            max_date = chunked_df[date_time_key].max()
            if pd.isna(min_date) or pd.isna(max_date):
                continue

            min_date = to_pydatetime(min_date)
            max_date = to_pydatetime(max_date)
            min_date_str = min_date.strftime(DATE_FORMAT_STR_ONLY_DIGIT)
            max_date_str = max_date.strftime(DATE_FORMAT_STR_ONLY_DIGIT)
            suffix = str(dt.datetime.now().timestamp().real)
            file_name = f'{PullDataType.TRANSACTION.name}-{min_date_str}-{max_date_str}-{suffix}.feather'

            folder_path = os.path.join(data_path, str(process.id))
            Path(folder_path).mkdir(parents=True, exist_ok=True)
            file_path = os.path.join(folder_path, file_name)

            chunked_df.to_feather(file_path)

            self.save_pull_history(process, min_date, max_date)

    @classmethod
    def save_pull_history(cls, process: CfgProcess, min_date: dt.datetime, max_date: dt.datetime):
        """TODO: make use of `TimeRange`"""
        with TxnMetaConnection(process_id=process.id) as meta_con:
            timezone = detect_timezone(min_date)
            PullHistoryTable.create_table(meta_con, process.id)
            pull_history_record = PullHistoryTable.get(meta_con, process.id)
            if pull_history_record.pull_from is None and pull_history_record.pull_to is None:
                pull_history_record.set_pull_from(min_date)
                pull_history_record.set_pull_to(max_date)
            else:
                pull_time_range = pull_history_record.time_range(timezone)
                if pull_time_range.min.value > min_date:
                    pull_history_record.set_pull_from(min_date)
                if pull_time_range.max.value < max_date:
                    pull_history_record.set_pull_to(max_date)
            PullHistoryTable.set(meta_con, process.id, pull_history_record)


class PullDataType(BaseEnum):
    """Enumeration of data types that can be pulled from factory databases.

    Defines the different categories of data available for extraction.

    Attributes:
        MASTER: Master data type.
        CODE: Code mapping data type.
        TRANSACTION: Transaction/measurement data type.

    Generated by Duo.
    """

    MASTER = enum.auto()
    CODE = enum.auto()
    TRANSACTION = enum.auto()


def should_use_log_scale(data: pd.Series) -> bool:
    """Determine if log scale should be used for sensor visualization in GUI.

    Uses IQR (Interquartile Range) ratio to decide if log scale is appropriate.
    Log scale is recommended when the data spans multiple orders of magnitude.

    Args:
        data: Series of numeric data to analyze (can be Series, array, or list)

    Returns:
        True if log scale is recommended, False otherwise
    """
    # Convert to pandas Series for easier handling
    series = pd.Series(data)

    if series.empty:
        return False

    # Remove NA/None values
    series = series.dropna()

    if len(series) == 0:
        return False

    # if data is datetime return False
    if pd.api.types.is_datetime64_any_dtype(series):
        return False

    # if not (all data is > 0) return False
    if not (series > 0).all():
        return False

    # compute IQR of data
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)

    # this statement is equal to IQR(log10(X))
    log_iqr_ratio = np.log10(q3 / q1)

    # if log10(q3/q1) >= 1 use log-scale for visualization
    # Convert to Python bool to ensure consistent return type
    return bool(log_iqr_ratio >= LOG_SCALE_THRESHOLD)
