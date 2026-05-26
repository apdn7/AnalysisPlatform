from __future__ import annotations

import datetime as dt
from collections import namedtuple
from collections.abc import Iterator
from datetime import datetime
from functools import cached_property
from typing import Any, Union

import duckdb
import pandas as pd
import sqlalchemy as sa
from loguru import logger
from pandas import DataFrame
from pandas.core.dtypes.base import ExtensionDtype
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import scoped_session
from sqlalchemy.sql.ddl import CreateIndex, CreateTable

from ap.api.common.services.utils import gen_sql_compiled_stmt
from ap.common.common_utils import (
    Bound,
    TimeRange,
    convert_to_datetime,
    convert_to_str,
    gen_data_count_table_name,
    gen_export_history_table_name,
    gen_import_history_table_name,
    gen_pull_history_table_name,
)
from ap.common.constants import (
    DATE_FORMAT_SQLITE_STR,
    SQL_PARAM_SYMBOL,
    BaseEnum,
    DataColumnType,
    DataType,
    DuplicateMode,
    JobStatus,
    JobType,
)
from ap.common.log import log_execution_time
from ap.common.pydn.dblib.duckdb.__init__ import DuckDB
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.common.pydn.dblib.transaction import TxnDataConnection, TxnMetaConnection
from ap.setting_module.models import (
    CfgProcess,
    CfgProcessColumn,
)


class TransactionData:
    """Main transaction data management class.

    Manages transaction data for a process, including table creation, indexing,
    data import/export, column management, and various data operations.

    Attributes:
        id_col_name: Name of the ID column (default 'rowid').
        process_id: Process ID.
        table_name: Name of the transaction table.
        cfg_process: Configuration process object.
        serial_columns: List of serial number columns.
        getdate_column: Get date column configuration.
        main_date_column: Main date column configuration.
        main_time_column: Main time column configuration.
        auto_incremental_column: Auto-incremental column configuration.
        cfg_process_columns: List of process column configurations.
        select_column_names: List of selected column names.
        cfg_filters: Configuration filters.
        show_duplicate: Duplicate mode setting.
        actual_record_number: Actual number of records.
        unique_serial_number: Number of unique serials.
        duplicate_serial_number: Number of duplicate serials.
        df: DataFrame for data storage.

    Methods:
        get_new_columns: Get new columns not yet in the table.
        count_data: Count total data in the table.
        get_column_dtype: Get column data types.
        get_data_for_check_duplicate: Get data for duplicate checking.
        create_table: Create transaction table and related tables.
        cast_data_type_for_columns: Cast data types for columns.
        cast_data_type: Cast data type for a specific column.
        create_data_count_table: Create data count table.
        create_import_history_table: Create import history table.
        create_export_history_table: Create export history table.
        vacuum_data: Vacuum database.
        clean_data_with_limit_import: Clean data with import limit.
        delete_sequence_table: Delete sequence table.
        rename_sequence_table: Rename sequence table.
        rename_column: Rename DataFrame columns.
        add_default_indexes_column: Add default index columns.
        create_index: Create composite indexes.
        remove_index: Remove unused indexes.
        purge_index: Force remove all indexes.
        drop_index: Drop a specific index.
        get_indexes_by_column_name: Get indexes by column name.
        is_table_exist: Check if table exists.
        re_structure_index: Restructure indexes based on cfg_trace.
        get_table_columns: Get table column names.
        add_columns: Add columns to table.
        get_column_name: Get column name by ID.
        get_column_id: Get column ID by name.
        get_cfg_column_by_name: Get column configuration by name.
        get_bs_col_name_by_column_name: Get bridge column name by column name.
        get_cfg_column_by_id: Get column configuration by ID.
        delete_columns: Delete columns from table.
        update_data_types: Update column data types.
        add_column: Add a single column to table.
        update_and_cast_date_type: Update and cast data type.
        rename_column_name: Rename column name.
        delete_process: Delete process table.
        remove_transaction_by_time_range: Remove transactions by time range.
        get_max_date_time_by_process_id: Get maximum datetime.
        get_min_date_time_by_process_id: Get minimum datetime.
        get_latest_records_by_process_id: Get latest records.
        get_datetime_value: Get datetime values.
        get_column_value_by_id: Get column values by ID.
        table_model: Get SQLAlchemy table model.
        update_timezone: Update timezone for datetime column.
        select_distinct_data: Select distinct data from column.
        select_data: Select data from columns.
        get_ct_range: Get datetime range.
        get_all: Get all data from table.
        get_all_data_by_chunk: Get all data in chunks.
        get_transaction_by_time_range: Get transactions by time range.
        get_data_count_by_time_range: Get data count by time range.
        select_data_count: Select data count.
        get_all_import_history: Get all import history records.
        get_import_history_last_fatal: Get last fatal import history.
        get_import_history_latest_done_files: Get latest done import files.
        get_import_history_first_import: Get first import record.
        get_import_history_last_import: Get last import record.
        get_import_history_error_jobs: Get error jobs from import history.
        get_total_imported_row: Get total imported rows.
        get_sample_data: Get sample data for process linking.
        get_cols_with_types: Get columns with their data types.

    Generated by Duo
    """

    id_col_name: str = 'rowid'
    process_id: int = None
    table_name: str = None
    cfg_process: CfgProcess = None
    serial_columns: list[CfgProcessColumn] = None
    getdate_column: CfgProcessColumn = None
    main_date_column: CfgProcessColumn = None
    main_time_column: CfgProcessColumn = None
    auto_incremental_column: CfgProcessColumn = None
    cfg_process_columns: list[CfgProcessColumn] = None
    select_column_names: list[str] = None
    cfg_filters = None
    show_duplicate: DuplicateMode = None
    actual_record_number: int = None
    unique_serial_number: int = None
    duplicate_serial_number: int = None
    df: DataFrame = None

    def __init__(self, process: Union[int, CfgProcess], meta_session: scoped_session = None) -> None:
        if isinstance(process, CfgProcess):
            process_id = process.id
            self.cfg_process = process
        else:
            process_id = process
            self.cfg_process: CfgProcess = (meta_session.query(CfgProcess) if meta_session else CfgProcess.query).get(
                process_id,
            )
        if not self.cfg_process:
            raise Exception('Not exist process id')

        self.process_id = process_id
        self.table_name = self.cfg_process.bridge_table_name
        self.data_count_table_name = self.cfg_process.data_count_table_name
        self.import_history_table_name = self.cfg_process.import_history_table_name
        self.export_history_table_name = self.cfg_process.export_history_table_name

        self.cfg_process_columns = self.cfg_process.get_transaction_process_columns()
        self.serial_columns = []

        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.is_serial_no:
                self.serial_columns.append(cfg_process_column)
                continue
            if cfg_process_column.is_get_date:
                self.getdate_column = cfg_process_column
                continue
            if cfg_process_column.is_auto_increment:
                self.auto_incremental_column = cfg_process_column
                continue
            if cfg_process_column.column_type == DataColumnType.MAIN_DATE.value:
                self.main_date_column = cfg_process_column
                continue
            if cfg_process_column.column_type == DataColumnType.MAIN_TIME.value:
                self.main_time_column = cfg_process_column
                continue

    def count_data(self, data_con: DuckDB) -> int:
        sql = sa.select(sa.func.count(1)).select_from(sa.table(self.table_name))
        return data_con.run_sql(sql).fetchone()[0] or 0

    @log_execution_time()
    def get_pandas_column_dtypes(self, data_con: DuckDB) -> dict[str, ExtensionDtype]:
        duckdb_dtypes = data_con.column_types(self.table_name)
        return {column_name: duckdb_dtype.to_pandas_type() for column_name, duckdb_dtype in duckdb_dtypes.items()}

    @log_execution_time()
    def get_data_for_check_duplicate(self, data_con: DuckDB, start_dt: str, end_dt: str) -> pd.DataFrame:
        date_col = self.getdate_column.bridge_column_name
        sql = f'SELECT * FROM {self.table_name} WHERE {date_col} BETWEEN {SQL_PARAM_SYMBOL} AND {SQL_PARAM_SYMBOL}'
        return data_con.run_sql(sql, params=[start_dt, end_dt]).fetchdf()

    def create_table(self, data_con: DuckDB, meta_con: SQLite3, auto_commit: bool = True):
        if self.table_name in data_con.list_tables():
            self.sync_columns_to_transaction(data_con)
        else:
            dict_col_with_types = self.get_cfg_column_types()
            sql = f'CREATE TABLE IF NOT EXISTS {self.table_name}'
            sql_col = ''
            for col_name, data_type in dict_col_with_types.items():
                sql_col += f'{col_name} {data_type.duckdb_type()}, '
            sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace
            sql = f'{sql} ({sql_col})'
            data_con.run_sql(sql)

        # create data count table
        self.create_data_count_table(meta_con, auto_commit=auto_commit)
        # create import history table
        self.create_import_history_table(meta_con, auto_commit=auto_commit)
        # create export history table
        self.create_export_history_table(meta_con, auto_commit=auto_commit)

    def create_data_count_table(self, meta_con: SQLite3, auto_commit: bool = True):
        # TODO(khanhdq-duckdb): we should use duckdb for this
        dict_col_with_type = DataCountTable.to_dict()
        table_name = self.data_count_table_name
        if table_name in meta_con.list_tables():
            return table_name

        sql = f'CREATE TABLE IF NOT EXISTS {table_name}'
        sql_col = ''
        for col_name, data_type in dict_col_with_type.items():
            sql_col += f'{col_name} {data_type}, '
        sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace
        sql = f'{sql} ({sql_col})'
        meta_con.execute_sql(sql, auto_commit=auto_commit)

        # index
        col_name = DataCountTable.get_date_col()
        sql = f'CREATE INDEX IF NOT EXISTS idx_{col_name} ON {table_name}({col_name})'
        meta_con.execute_sql(sql, auto_commit=auto_commit)
        return table_name

    def create_import_history_table(self, meta_con: SQLite3, auto_commit: bool = True):
        table_name = self.import_history_table_name
        if table_name in meta_con.list_tables():
            return table_name

        sql = ImportHistoryTable.create_table_sql(self.process_id)
        meta_con.execute_sql(sql, auto_commit=auto_commit)

        sql = ImportHistoryTable.create_index_sql(self.process_id)
        meta_con.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    def create_export_history_table(self, meta_con: SQLite3, auto_commit: bool = True):
        table_name = self.export_history_table_name
        if table_name in meta_con.list_tables():
            return table_name

        sql = ExportHistoryTable.create_table_sql(self.process_id)
        meta_con.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    def clean_data_with_limit_import(self, data_con: DuckDB, meta_con: SQLite3, limit: int) -> int:
        # change created_at to get_date column
        if limit <= 0:
            return 0
        data_count = data_con.run_sql(f'SELECT COUNT(ROWID) AS COUNT FROM {self.table_name}').fetchone()[0]
        delete_row = data_count - limit
        if delete_row <= 0:
            return 0

        from ap.api.setting_module.services.data_import import (
            gen_bulk_insert_sql,
            get_insert_params,
            get_proc_data_count_df,
        )

        get_date_column_name = self.getdate_column.bridge_column_name

        sql = f"""
            DELETE FROM {self.table_name}
            WHERE ROWID IN (
                SELECT ROWID FROM {self.table_name}
                ORDER BY {get_date_column_name}
                ASC LIMIT {delete_row}
            )
            RETURNING {get_date_column_name};
        """
        deleted_records = 0

        for df in data_con.fetch_many_df(sql):
            # TODO: this is duplicated code.
            # TODO: this is inefficient because we returning all the rows from the DELETING.
            # TODO: this is inefficient because we add a lot of negative rows into data_finder,
            #   making query to data finder slow.
            deleted_records += len(df)
            count_df = get_proc_data_count_df(df, get_date_col=get_date_column_name, decrease=True, is_db=True)
            agg_keys = {DataCountTable.count.name: 'sum', DataCountTable.count_file.name: 'sum'}
            aggregated_df = count_df.groupby(DataCountTable.datetime.name).agg(agg_keys).reset_index()
            sql_vals = aggregated_df.to_records(index=False).tolist()
            sql_params = get_insert_params(DataCountTable.get_keys())
            sql_data_count_insert = gen_bulk_insert_sql(DataCountTable.get_table_name(self.process_id), *sql_params)

            meta_con.execute_sql_in_transaction(sql_data_count_insert, sql_vals)

        return deleted_records

    def is_table_exist(self, data_con: DuckDB) -> bool:
        return self.table_name in data_con.list_tables()

    def get_transaction_columns(self, data_con: DuckDB) -> list[str]:
        try:
            df = data_con.run_sql(f'PRAGMA table_info({self.table_name});').fetchdf()
            return df['name'].tolist()
        except duckdb.CatalogException as e:
            logger.exception(e)
            return []

    def sync_columns_to_transaction(self, data_con: DuckDB):
        """During importing, we may have new columns when users change cfg_process.
        We need to:
        - Add new columns to the table if it is missing
        - Remove columns that are not in cfg_process
        """
        (
            current_duckdb_types,  # physical columns in transaction table
            column_types,  # columns in the config
        ) = data_con.column_types(self.table_name), self.get_cfg_column_types()

        # add missing columns (column in config, but not in real table)
        for column_name, data_type in column_types.items():
            if column_name not in current_duckdb_types:
                data_con.add_column(self.table_name, column_name, data_type.duckdb_type())

        # remove redundant columns (columns in the real table, but not in the config)
        for column_name in current_duckdb_types.keys():
            if column_name not in column_types:
                data_con.remove_column(self.table_name, column_name)

        # change column types (columns both exists in config and real table)
        for column_name, data_type in column_types.items():
            if column_name not in current_duckdb_types:
                continue
            current_duckdb_type = current_duckdb_types.get(column_name)
            if current_duckdb_type != data_type.duckdb_type():
                data_con.cast_column_type(self.table_name, column_name, data_type.duckdb_type())

    def get_column_name(self, column_id: int, brs_column_name=True) -> str | None:
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.id == column_id:
                if brs_column_name:
                    return cfg_process_column.bridge_column_name
                return cfg_process_column.column_name
        return None

    def get_cfg_column_by_name(self, column_name, is_compare_bridge_column_name=True) -> CfgProcessColumn | None:
        for cfg_process_column in self.cfg_process_columns:
            compare_name = (
                cfg_process_column.bridge_column_name
                if is_compare_bridge_column_name
                else cfg_process_column.column_name
            )
            if compare_name == column_name:
                return cfg_process_column
        return None

    def get_cfg_column_by_id(self, column_id) -> CfgProcessColumn | None:
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.id == column_id:
                return cfg_process_column
        return None

    def remove_transaction_by_time_range(self, data_con: DuckDB, start_time: dt.datetime, end_time: dt.datetime):
        # TODO: we should use TimeRange
        sql = sa.delete(sa.table(self.table_name)).where(
            sa.column(self.getdate_column.bridge_column_name) >= start_time.strftime(DATE_FORMAT_SQLITE_STR),
            sa.column(self.getdate_column.bridge_column_name) < end_time.strftime(DATE_FORMAT_SQLITE_STR),
        )
        data_con.run_sql(sql)

    def get_max_date_time_by_process_id(self, data_con: DuckDB) -> dt.datetime | str | None:
        sql = sa.select(sa.func.max(sa.column(self.getdate_column.bridge_column_name))).select_from(self.table_model)
        return data_con.run_sql(sql).fetchone()[0]

    def get_min_date_time_by_process_id(self, data_con: DuckDB) -> dt.datetime | str | None:
        sql = sa.select(sa.func.min(sa.column(self.getdate_column.bridge_column_name))).select_from(self.table_model)
        return data_con.run_sql(sql).fetchone()[0]

    def get_ct_range(self, data_con: DuckDB) -> tuple[dt.datetime | str | None, dt.datetime | str | None]:
        sql = sa.select(
            sa.func.min(sa.column(self.getdate_column.bridge_column_name)),
            sa.func.max(sa.column(self.getdate_column.bridge_column_name)),
        ).select_from(sa.table(self.table_name))
        min_time, max_time = data_con.run_sql(sql).fetchone()
        return min_time, max_time

    def get_latest_records_by_process_id(self, data_con: DuckDB, limit: int | None = None) -> pd.DataFrame:
        sql = sa.select(self.table_model).order_by(sa.column(self.getdate_column.bridge_column_name))
        if limit is not None:
            sql = sql.limit(limit)
        return data_con.run_sql(sql).fetchdf()

    @cached_property
    def table_model(self) -> sa.Table:
        # TODO(khanhdq-duckdb): this can be made simpler
        columns = [
            sa.Column(self.id_col_name, sa.Integer),
            sa.Column(self.getdate_column.bridge_column_name, sa.DateTime),
        ]

        existed_columns_name = {
            self.id_col_name,
            self.getdate_column.bridge_column_name,
        }

        for column in self.cfg_process_columns:
            column_name = column.bridge_column_name
            if column_name in existed_columns_name:
                continue
            existed_columns_name.add(column_name)
            data_type = DataType[column.data_type]
            columns.append(sa.Column(column_name, data_type.sqlalchemy_type()))

        return sa.Table(self.table_name, sa.MetaData(), *columns)

    def update_timezone(self, data_con: DuckDB, hour_offset: int):
        col = self.getdate_column.bridge_column_name

        if hour_offset > 0:
            cast_sql = f'CAST({col} AS TIMESTAMP) + INTERVAL {hour_offset} HOUR'
        else:
            cast_sql = f'CAST({col} AS TIMESTAMP) - INTERVAL {-hour_offset} HOUR'

        sql = f"""
UPDATE {self.table_name}
SET {col} = strftime('{DATE_FORMAT_SQLITE_STR}', {cast_sql}) || SUBSTR({col},-8)
"""
        data_con.run_sql(sql)

    def select_distinct_data(self, data_con: DuckDB, col_name: str, limit: int = 1000) -> list[Any]:
        sql = (
            sa.select(sa.distinct(sa.column(col_name)))
            .select_from(sa.table(self.table_name))
            .where(sa.column(col_name).isnot(None))
            .order_by(sa.column(col_name))
            .limit(limit)
        )
        return data_con.fetch_df(sql)[col_name].dropna().tolist()

    def get_all(self, data_con: DuckDB, order_by_time: bool = False) -> pd.DataFrame:
        sql = sa.select(sa.literal_column('*')).select_from(sa.table(self.table_name))
        if order_by_time:
            sql = sql.order_by(sa.column(self.getdate_column.bridge_column_name))
        return data_con.run_sql(sql).fetchdf()

    def get_all_data_by_chunk(self, data_con: DuckDB, chunk_size: int = 1_000_000) -> Iterator[pd.DataFrame]:
        sql = sa.select(sa.literal_column('*')).select_from(sa.table(self.table_name))
        yield from data_con.fetch_many_df(sql=sql, chunk_size=chunk_size)

    def get_transaction_by_time_range(
        self, data_con: DuckDB, start_time: dt.datetime, end_time: dt.datetime, limit=1_000_000
    ) -> pd.DataFrame:
        sql = (
            sa.select(sa.literal_column('*'))
            .select_from(sa.table(self.table_name))
            .where(
                sa.column(self.getdate_column.bridge_column_name) >= start_time.strftime(DATE_FORMAT_SQLITE_STR),
                sa.column(self.getdate_column.bridge_column_name) < end_time.strftime(DATE_FORMAT_SQLITE_STR),
            )
            .limit(limit)
        )
        return data_con.fetch_df(sql)

    def get_data_count_by_time_range(
        self,
        data_con: DuckDB,
        start_date=None,
        end_date=None,
    ):
        """
        Get data count from data_count_table_name by time range
        Args:
            data_con: DuckDB,
            start_date: datetime
            end_date: datetime

        Returns:
            rows: dict
        """
        sql = (
            sa.select(sa.func.count(sa.literal_column('*')))
            .select_from(sa.table(self.table_name))
            .where(
                sa.column(self.getdate_column.bridge_column_name) >= start_date,
                sa.column(self.getdate_column.bridge_column_name) < end_date,
            )
        )
        return data_con.run_sql(sql).fetchone()[0] or 0

    def select_data_count(
        self,
        meta_con: SQLite3,
        start_date: str | None = None,
        end_date: str | None = None,
        count_in_file: bool = False,
    ):
        # TODO(khanhdq-duckdb): we should use TimeRange
        # TODO(khanhdq-duckdb): we should store data count table in duckdb for faster query
        datetime_col = DataCountTable.datetime.name
        count_col = DataCountTable.count_file.name if count_in_file else DataCountTable.count.name
        sql = (
            f'SELECT {datetime_col}, sum({count_col}) as {DataCountTable.count.name} FROM {self.data_count_table_name}'
        )
        params = []
        if start_date and end_date and start_date != end_date:
            sql += f' WHERE {datetime_col} >= {SQL_PARAM_SYMBOL} AND {datetime_col} < {SQL_PARAM_SYMBOL}'
            params = [start_date, end_date]

        sql += f' GROUP BY {datetime_col}'

        cols, rows = meta_con.run_sql(sql, row_is_dict=False, params=params)
        return cols, rows

    def get_all_import_history(self, meta_con: SQLite3) -> list[ImportHistoryTable]:
        table = ImportHistoryTable.table(self.process_id)
        sql = table.select().order_by(table.c.job_id)
        _, rows = meta_con.run_sql(sql)
        return list(map(ImportHistoryTable.model_validate, rows))

    def get_import_history_last_fatal(self, meta_con: SQLite3) -> list[ImportHistoryTable]:
        table = ImportHistoryTable.table(self.process_id)

        sql = table.select().where(
            sa.and_(
                table.c.job_id.in_(sa.select(sa.func.max(table.c.job_id))),
                table.c.status.in_([JobStatus.FATAL.name, JobStatus.PROCESSING.name]),
            ),
        )

        _, rows = meta_con.run_sql(sql)
        return list(map(ImportHistoryTable.model_validate, rows))

    ImportHistoryLatestDone = namedtuple('ImportHistoryLatestDone', ['file_name', 'start_tm', 'imported_row', 'status'])

    def get_import_history_latest_done_files(self, meta_con: SQLite3) -> list[ImportHistoryLatestDone]:
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            sa.select(
                table.c.file_name,
                sa.func.max(table.c.start_tm).label('start_tm'),
                sa.func.max(table.c.imported_row).label('imported_row'),
                sa.func.max(table.c.status).label('status'),
            )
            .where(table.c.status.in_([JobStatus.DONE.name, JobStatus.FAILED.name]))
            .group_by(table.c.file_name)
        )

        _, rows = meta_con.run_sql(stmt)
        return [self.ImportHistoryLatestDone(**row) for row in rows]

    def get_import_history_records(self, meta_con: SQLite3, import_type: str) -> list[ImportHistoryTable]:
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            table.select()
            .where(
                sa.and_(
                    table.c.import_type == import_type,
                    table.c.status.in_([JobStatus.DONE.name, JobStatus.FAILED.name]),
                ),
            )
            .order_by(sa.asc(table.c.created_at))
        )

        _, rows = meta_con.run_sql(stmt)
        return [ImportHistoryRecord.model_validate(row) for row in rows]

    def get_import_history_first_import(self, meta_con: SQLite3, import_type: JobType) -> ImportHistoryTable | None:
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            table.select()
            .where(
                sa.and_(
                    table.c.import_type == import_type.name,
                    table.c.status.in_([JobStatus.DONE.name, JobStatus.FAILED.name]),
                ),
            )
            .order_by(sa.asc(table.c.created_at))
            .limit(1)
        )

        _, rows = meta_con.run_sql(stmt)
        if len(rows):
            return ImportHistoryTable.model_validate(rows[0])
        return None

    def get_import_history_last_import(self, meta_con: SQLite3, import_type: JobType):
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            table.select()
            .where(
                sa.and_(
                    table.c.import_type == import_type.name,
                    table.c.status.in_([JobStatus.DONE.name, JobStatus.FAILED.name]),
                ),
            )
            .order_by(sa.desc(table.c.created_at))
            .limit(1)
        )

        _, rows = meta_con.run_sql(stmt)
        if len(rows):
            return ImportHistoryTable.model_validate(rows[0])
        return None

    def get_import_history_error_jobs(self, meta_con: SQLite3, job_id: str):
        sql = (
            sa.select(sa.literal_column('*'))
            .select_from(sa.table(self.import_history_table_name))
            .where(
                sa.column('job_id') == job_id,
                sa.column('status') != JobStatus.DONE.name,
            )
        )
        _, data = meta_con.run_sql(sql)
        return data

    def get_total_imported_row(self, meta_con: SQLite3, import_type: JobType) -> int:
        sql = (
            sa.select(sa.func.sum(sa.column('imported_row')).label('total'))
            .select_from(sa.table(self.import_history_table_name))
            .where(sa.column('import_type') == import_type.name)
        )
        _, data = meta_con.run_sql(sql)
        return data[0]['total'] or 0

    def get_sample_data(self, data_con: DuckDB, columns: list[CfgProcessColumn], limit=5) -> pd.DataFrame:
        # TODO: remove this, use comon methods
        """
        Get sample data for process link purpose
        return df with column name are cfg_process_column's id
        """
        link_cols = '*'
        if columns:
            link_cols = ','.join([f'{col.bridge_column_name} as "{col.id}"' for col in columns])
        sql = f"""
            SELECT {link_cols}
            FROM {self.table_name}
            ORDER BY {self.getdate_column.bridge_column_name} DESC
            LIMIT {limit};
        """
        return data_con.run_sql(sql).fetchdf()

    def get_cfg_column_types(self) -> dict[str, DataType]:
        """Get physical columns types"""
        return {
            column.bridge_column_name: DataType[column.data_type]
            for column in self.cfg_process_columns
            if column.is_transaction_column
        }

    def get_column_value_by_id(self, data_con: DuckDB, col_id):
        col = self.get_cfg_column_by_id(col_id)
        time_col = self.getdate_column.bridge_column_name
        sql = f'SELECT {col.bridge_column_name} FROM {self.table_name} ORDER BY {time_col} DESC;'
        return data_con.run_sql(sql).fetch_df()[col.bridge_column_name].dropna().tolist()

    def get_datetime_value(self, data_con: DuckDB):
        sql = f"""SELECT {self.getdate_column.bridge_column_name}
        FROM {self.table_name} ORDER BY {self.getdate_column.bridge_column_name} DESC"""
        return data_con.run_sql(sql).fetch_df()[self.getdate_column.bridge_column_name].dropna().tolist()


class DataCountTable(BaseEnum):
    """Enum-based data count table definition.

    Defines the structure and columns for data count tables used to track
    data counts by datetime.

    Attributes:
        datetime: Datetime column (TEXT type).
        count: Count column (INTEGER type).
        count_file: Count file column (INTEGER type).

    Methods:
        to_dict: Convert enum to dictionary of column names and types.
        get_date_col: Get the date column name.
        get_table_name: Get table name for a process ID.

    Generated by Duo
    """

    datetime = (1, DataType.TEXT.name)
    count = (2, DataType.INTEGER.name)
    count_file = (3, DataType.INTEGER.name)

    @classmethod
    def to_dict(cls):
        return {col: item.value[1] for col, item in cls.get_items()}

    @classmethod
    def get_date_col(cls):
        return cls.datetime.name

    @staticmethod
    def get_table_name(proc_id):
        return gen_data_count_table_name(proc_id)

    # DIC_DATA_COUNT_COLUMNS = dict(datetime=DataType.TEXT.name, count=DataType.INTEGER.name)


class ImportHistoryRecord(BaseModel):
    """Pydantic model for import history records.

    Represents import time range information for tracking data import operations.

    Attributes:
        import_from: Start datetime for import operation.
        import_to: End datetime for import operation.

    Methods:
        time_range: Get TimeRange object from import times.

    Generated by Duo
    """

    import_from: str | None
    import_to: str | None

    def time_range(self, timezone) -> TimeRange:
        return TimeRange(
            min=Bound.included(convert_to_datetime(self.import_from, timezone)),
            max=Bound.included(convert_to_datetime(self.import_to, timezone)),
        )


class ImportHistoryTable(BaseModel):
    """Pydantic model for import history.

    Represents import history records for tracking data import operations,
    including CSV and factory imports.

    Attributes:
        job_id: Job ID for the import operation.
        import_type: Type of import (CSV, factory, etc.).
        file_name: Name of imported file (for CSV imports).
        import_from: Start datetime for factory imports.
        import_to: End datetime for factory imports.
        imported_row: Number of rows imported.
        status: Import status.
        error_msg: Error message if import failed.
        start_tm: Start time of import.
        end_tm: End time of import.
        created_at: Record creation timestamp.
        updated_at: Record update timestamp.

    Methods:
        get_table_name: Get table name for a process ID.
        table: Get SQLAlchemy table object.
        create_table_sql: Generate CREATE TABLE SQL statement.
        create_index_sql: Generate CREATE INDEX SQL statement.

    Generated by Duo
    """

    job_id: int | None
    import_type: str | None
    # csv import
    file_name: str | None
    # factory import
    import_from: str | None
    import_to: str | None
    imported_row: int | None
    status: str
    error_msg: str | None
    start_tm: str
    end_tm: str
    created_at: str | None
    updated_at: str | None

    @classmethod
    def get_table_name(cls, proc_id: int) -> str:
        return gen_import_history_table_name(proc_id)

    @classmethod
    def table(cls, proc_id: int):
        return sa.Table(
            cls.get_table_name(proc_id),
            sa.MetaData(),
            sa.Column('job_id', sa.Integer),
            sa.Column('import_type', sa.Text),
            sa.Column('file_name', sa.Text),
            sa.Column('import_from', sa.Text),
            sa.Column('import_to', sa.Text),
            sa.Column('start_tm', sa.Text),
            sa.Column('end_tm', sa.Text),
            sa.Column('imported_row', sa.Integer),
            sa.Column('status', sa.Text),
            sa.Column('error_msg', sa.Text),
            sa.Column('created_at', sa.Text),
            sa.Column('updated_at', sa.Text),
        )

    @classmethod
    def create_table_sql(cls, proc_id: int) -> str:
        table = cls.table(proc_id)
        create_table_stmt = CreateTable(table, if_not_exists=True)
        sqlite3_compiled_stmt = gen_sql_compiled_stmt(create_table_stmt)
        return sqlite3_compiled_stmt.string

    @classmethod
    def create_index_sql(cls, proc_id: int) -> str:
        table = cls.table(proc_id)
        index = sa.Index('ix_t_import_history_file_name_created_at', table.c.file_name, table.c.created_at)
        create_index_stmt = CreateIndex(index, if_not_exists=True)
        sqlite3_compiled_stmt = gen_sql_compiled_stmt(create_index_stmt)
        return sqlite3_compiled_stmt.string

    @classmethod
    def get_import_history(cls, process_id: int) -> ImportHistoryRecord | None:
        table = cls.table(process_id)
        sql = sa.select(
            sa.func.min(table.c.import_from).label('import_from'),
            sa.func.max(table.c.import_to).label('import_to'),
        ).select_from(table)
        with TxnMetaConnection(process_id=process_id) as meta_con:
            _, rows = meta_con.run_sql(sql)
        output = ImportHistoryRecord.model_validate(rows[0]) if rows and rows[0]['import_from'] is not None else None

        return output


class PullHistoryRecord(BaseModel):
    """Pydantic model for pull history records.

    Represents a pull history record tracking data pull operations with
    time range information.

    Attributes:
        id: Record ID (default 1).
        pull_from: Start datetime for pull operation.
        pull_to: End datetime for pull operation.

    Methods:
        set_pull_from: Set pull_from datetime value.
        set_pull_to: Set pull_to datetime value.
        time_range: Get TimeRange object from pull times.

    Generated by Duo
    """

    id: int = 1
    pull_from: str | None
    pull_to: str | None

    def set_pull_from(self, value: datetime):
        self.pull_from = convert_to_str(value)

    def set_pull_to(self, value: datetime):
        self.pull_to = convert_to_str(value)

    def time_range(self, timezone) -> TimeRange:
        return TimeRange(
            min=Bound.included(convert_to_datetime(self.pull_from, timezone)),
            max=Bound.included(convert_to_datetime(self.pull_to, timezone)),
        )


class PullHistoryTable:
    """Pull history table management.

    Manages pull history table operations including table creation,
    record retrieval, and record updates.

    Methods:
        get_table_name: Get table name for a process ID.
        table: Get SQLAlchemy table object.
        create_table_sql: Generate CREATE TABLE SQL statement.
        create_table: Create pull history table.
        get: Get pull history record for a process.
        set: Set/update pull history record for a process.

    Generated by Duo
    """

    @classmethod
    def get_table_name(cls, process_id: int) -> str:
        return gen_pull_history_table_name(process_id)

    @classmethod
    def table(cls, process_id: int):
        return sa.Table(
            cls.get_table_name(process_id),
            sa.MetaData(),
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('pull_from', sa.Text, nullable=False),
            sa.Column('pull_to', sa.Text, nullable=False),
        )

    @classmethod
    def create_table_sql(cls, process_id: int) -> str:
        table = cls.table(process_id)
        create_table_stmt = CreateTable(table, if_not_exists=True)
        sqlite3_compiled_stmt = gen_sql_compiled_stmt(create_table_stmt)
        return sqlite3_compiled_stmt.string

    @classmethod
    def create_table(cls, meta_con: SQLite3, process_id: int, auto_commit: bool = True):
        table_name = cls.get_table_name(process_id)
        if table_name in meta_con.list_tables():
            return table_name

        sql = cls.create_table_sql(process_id)
        meta_con.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    @classmethod
    def get(cls, meta_con: SQLite3, process_id: int) -> PullHistoryRecord | None:
        _, rows = meta_con.run_sql(sa.select(cls.table(process_id)))
        return next(map(PullHistoryRecord.model_validate, rows), PullHistoryRecord(pull_from=None, pull_to=None))

    @classmethod
    def set(cls, meta_con: SQLite3, process_id: int, record: PullHistoryRecord):
        table = cls.table(process_id)
        upsert_stmt = sa.sql.text(
            f"""
INSERT OR REPLACE INTO {table.name}
({table.c.id.name}, {table.c.pull_from.name}, {table.c.pull_to.name}) VALUES
(:{table.c.id.name}, :{table.c.pull_from.name}, :{table.c.pull_to.name})
"""
        ).bindparams(id=record.id, pull_from=record.pull_from, pull_to=record.pull_to)
        meta_con.run_sql(upsert_stmt)


class ExportHistoryRecord(BaseModel):
    """Pydantic model for export history.

    Represents export history records tracking data export operations.

    Attributes:
        export_id: Export operation ID.
        export_from: Start datetime for export.
        export_to: End datetime for export.
        exported_rows: Number of rows exported.
        export_file_path: Path to exported file.

    Generated by Duo
    """

    # job_id: Optional[int]
    export_id: int
    export_from: str
    export_to: str
    exported_rows: int | None
    export_file_path: str | None


class ExportHistoryTable:
    """Export history table management.

    Manages export history table operations including table creation,
    record insertion, and export range queries.

    Methods:
        get_table_name: Get table name for a process ID.
        table: Get SQLAlchemy table object.
        insert: Insert export history record.
        exported_range: Get exported time range for an export ID.
        create_table_sql: Generate CREATE TABLE SQL statement.

    Generated by Duo
    """

    @classmethod
    def get_table_name(cls, proc_id: int) -> str:
        return gen_export_history_table_name(proc_id)

    @classmethod
    def table(cls, proc_id: int):
        return sa.Table(
            cls.get_table_name(proc_id),
            sa.MetaData(),
            # TODO: we don't know how to store job_id here atm.
            #  t_job_management must have `export_id` so that we can query them when running job. But should we do that?
            #  just store raw record at the moment
            # sa.Column('job_id', sa.Integer),
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('export_id', sa.Integer),
            sa.Column('export_from', sa.Text),
            sa.Column('export_to', sa.Text),
            sa.Column('exported_rows', sa.Integer),
            sa.Column('export_file_path', sa.Text),
            sa.Column('created_at', sa.Text, server_default=func.now()),
        )

    @classmethod
    def insert(cls, meta_con: SQLite3, proc_id: int, record: ExportHistoryRecord):
        table = cls.table(proc_id)
        stmt = table.insert().values(**record.model_dump())
        meta_con.run_sql(stmt)

    @classmethod
    def exported_range(cls, meta_con: SQLite3, proc_id: int, export_id: int) -> TimeRange:
        """Get the maximum export to from export history table"""
        table = cls.table(proc_id)
        stmt = sa.select(sa.func.min(table.c.export_from), sa.func.max(table.c.export_to)).where(
            table.c.export_id == export_id
        )
        _, rows = meta_con.run_sql(stmt, row_is_dict=False)
        min_ts, max_ts = rows[0]
        return TimeRange(min=Bound.included(min_ts), max=Bound.included(max_ts))

    @classmethod
    def create_table_sql(cls, proc_id: int) -> str:
        table = cls.table(proc_id)
        create_table_stmt = CreateTable(table, if_not_exists=True)
        sqlite3_compiled_stmt = gen_sql_compiled_stmt(create_table_stmt)
        return sqlite3_compiled_stmt.string


def create_all_transaction_tables():
    processes: list[CfgProcess] = CfgProcess.get_all()
    for process in processes:
        with (
            TxnMetaConnection(process_id=process.id) as meta_conn,
            TxnDataConnection(process_id=process.id, readonly_transaction=False) as data_con,
        ):
            trans = TransactionData(process)
            trans.create_table(data_con, meta_conn)
