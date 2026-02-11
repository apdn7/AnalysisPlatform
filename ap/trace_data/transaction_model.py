from __future__ import annotations

import logging
from collections import namedtuple
from datetime import datetime
from typing import Union

import pandas as pd
import sqlalchemy as sa
from pandas import DataFrame
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import scoped_session
from sqlalchemy.sql.ddl import CreateIndex, CreateTable

from ap import log_execution_time
from ap.api.common.services.utils import gen_sql_and_params, gen_sql_compiled_stmt
from ap.common.common_utils import (
    Bound,
    TimeRange,
    convert_to_datetime,
    convert_to_str,
    gen_data_count_table_name,
    gen_export_history_table_name,
    gen_import_history_table_name,
    gen_pull_history_table_name,
    get_type_all_columns,
)
from ap.common.constants import (
    DATE_FORMAT_SQLITE_STR,
    SEQUENCE_CACHE,
    SQL_LIMIT,
    SQL_PARAM_SYMBOL,
    BaseEnum,
    ColumnDTypeToSQLiteDType,
    DataColumnType,
    DataType,
    DuplicateMode,
    JobStatus,
    ProcessCfgConst,
)
from ap.common.pydn.dblib.db_common import gen_insert_col_str
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.pydn.dblib.mssqlserver import MSSQLServer
from ap.common.pydn.dblib.mysql import MySQL
from ap.common.pydn.dblib.oracle import Oracle
from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.setting_module.models import (
    CfgProcess,
    CfgProcessColumn,
    CfgTrace,
    CfgTraceKey,
)
from ap.trace_data.database_index import ColumnInfo, MultipleIndexes, SingleIndex, add_multiple_indexes_to_set

logger = logging.getLogger(__name__)


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

    def get_new_columns(
        self,
        db_instance: Union[PostgreSQL, Oracle, MySQL, MSSQLServer],
        table_name: str | None = None,
    ) -> list[CfgProcessColumn]:
        table_name = table_name or self.table_name
        exist_columns = self.get_table_columns(db_instance, table_name)
        new_columns = []
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.bridge_column_name not in exist_columns:
                new_columns.append(cfg_process_column)
        return new_columns

    def count_data(self, db_instance: Union[PostgreSQL, SQLite3]):
        # sql = f'SELECT COUNT(1) FROM {self.table_name}'
        sql = f'SELECT SUM({DataCountTable.count.name}) FROM {self.data_count_table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        return rows[0][0] or 0

    @log_execution_time()
    def get_column_dtype(self, db_instance: Union[PostgreSQL, SQLite3], columns):
        sql = f"PRAGMA table_info('{self.table_name}')"
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        df = pd.DataFrame(rows, columns=cols)
        col_dtypes = {col: df.loc[df['name'] == col, 'type'].iloc[0].lower() for col in columns}
        if not col_dtypes:
            # empty table will return none instead of column data type
            # so it should find and return type from CfgProcessColumn
            for col in self.cfg_process_columns:
                col_dtypes[col.bridge_column_name] = ColumnDTypeToSQLiteDType[col.data_type].value
        return col_dtypes

    @log_execution_time()
    def get_data_for_check_duplicate(self, db_instance: Union[PostgreSQL, SQLite3], start_dt, end_dt):
        date_col = self.getdate_column.bridge_column_name
        sql = f'SELECT * FROM {self.table_name} WHERE {date_col} BETWEEN {SQL_PARAM_SYMBOL} AND {SQL_PARAM_SYMBOL}'
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=[start_dt, end_dt])
        return cols, rows

    def create_table(self, db_instance, table_name: str | None = None, auto_commit: bool = True):
        dict_col_with_types = self.get_cols_with_types()
        table_name = table_name or self.table_name
        if table_name in db_instance.list_tables():
            new_columns = self.get_new_columns(db_instance, table_name=table_name)
            if new_columns:
                dict_new_col_with_type = {column.bridge_column_name: column.data_type for column in new_columns}
                self.add_columns(db_instance, self.table_name, dict_new_col_with_type, auto_commit=auto_commit)
            # TODO: Update data-type only when needed (add condition)
            self.update_data_types(db_instance, dict_col_with_types, auto_commit=auto_commit)
        else:
            # self.__create_sequence_table(db_instance)
            sql = f'CREATE TABLE IF NOT EXISTS {table_name}'
            sql_col = ''
            for col_name, _data_type in dict_col_with_types.items():
                data_type = (
                    DataType.TEXT.name
                    if _data_type in [DataType.DATETIME.name, DataType.DATE.name, DataType.TIME.name]
                    else DataType.INTEGER.name
                    if _data_type == DataType.CATEGORY.name
                    else _data_type
                )
                sql_col += f'{col_name} {data_type}, '
            sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace

            # make at least one column if no column of table for testing
            if not sql_col:
                sql_col = 'created_at datetime'

            sql = f'{sql} ({sql_col})'
            db_instance.execute_sql(sql, auto_commit=auto_commit)

        # create data count table
        self.create_data_count_table(db_instance, auto_commit=auto_commit)
        # create import history table
        self.create_import_history_table(db_instance, auto_commit=auto_commit)
        # create export history table
        self.create_export_history_table(db_instance, auto_commit=auto_commit)

        return table_name

    def cast_data_type_for_columns(
        self,
        db_instance,
        transaction_data_obj,
        process: CfgProcess,
        proc_data: dict,
    ):
        """
        Do change data type for request columns
        :param db_instance: a database instance of PostgreSQL instance
        :param process: a process object
        :param proc_data: a dictionary with process columns data
        :return: True, None if all columns changed successfully otherwise return False and list of failed change columns
        """
        db_columns: list[CfgProcessColumn] = process.columns
        request_columns: list[CfgProcessColumn] = proc_data[ProcessCfgConst.PROC_COLUMNS.value]
        failed_change_columns: list[CfgProcessColumn] = []
        if self.table_name not in db_instance.list_tables():
            # In case of non-exist table, do nothing
            return True, None

        # transaction_data_obj = TransactionData(process.id)
        # if not transaction_data_obj.is_exist_data(db_instance):
        #     return True, None

        # cat_counts = transaction_data_obj.get_count_by_category(db_instance)
        # dic_cat_count = {_dic_cat['data_id']: _dic_cat for _dic_cat in cat_counts}
        dic_db_cols = {col.column_name: col for col in db_columns}  # TODO: Use id
        for request_column in request_columns:
            column = dic_db_cols.get(request_column.column_name)
            if column is None:
                continue

            # Filter out un-change columns
            if request_column.data_type == column.data_type:
                continue

            is_success = self.cast_data_type(
                db_instance,
                transaction_data_obj,
                column.bridge_column_name,
                request_column.data_type,
            )

            if not is_success:
                request_column.origin_raw_data_type = column.data_type
                failed_change_columns.append(request_column)

            # Must roll back and commit every loop to keep session alive for next loop or process later
            if failed_change_columns:
                db_instance.connection.rollback()

        if failed_change_columns:
            return False, failed_change_columns
        else:
            return True, None

    def cast_data_type(
        self,
        db_instance,
        transaction_data_obj,
        column_name: str,
        new_data_type: str,
    ) -> bool:  # TODO: check can update float to int???
        """
        Change data type of column in table t_process_...
        :param db_instance: a database instance
        :param column_name: a column name
        :param new_data_type: new data type dict_data_type_db
        :return: True if success, False otherwise
        """
        if column_name == self.getdate_column.bridge_column_name:  # can not update for column get_date
            return True

        dict_convert_date_type_db_to_pandas = {
            DataType.INTEGER.name: 'int',
            DataType.REAL.name: 'float',
            DataType.TEXT.name: 'string',
            DataType.DATETIME.name: 'string',
            DataType.REAL_SEP.name: 'float',
            DataType.INTEGER_SEP.name: 'float',
            DataType.EU_REAL_SEP.name: 'float',
            DataType.EU_INTEGER_SEP.name: 'int',
            DataType.K_SEP_NULL.name: 'float',
            DataType.BOOLEAN.name: 'boolean',
            DataType.DATE.name: 'string',
            DataType.TIME.name: 'string',
            DataType.CATEGORY.name: 'int',
        }
        distinct_values = transaction_data_obj.select_distinct_data(db_instance, column_name, SQL_LIMIT)
        series_distinct_value = pd.Series(distinct_values)
        as_type = dict_convert_date_type_db_to_pandas.get(new_data_type, 'string')
        try:
            series_distinct_value.astype(as_type)
        except Exception as e:
            logger.error(e)
            return False

        return True

    def create_data_count_table(self, db_instance, auto_commit: bool = True):
        dict_col_with_type = DataCountTable.to_dict()
        table_name = self.data_count_table_name
        if table_name in db_instance.list_tables():
            return table_name

        sql = f'CREATE TABLE IF NOT EXISTS {table_name}'
        sql_col = ''
        for col_name, data_type in dict_col_with_type.items():
            sql_col += f'{col_name} {data_type}, '
        sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace
        sql = f'{sql} ({sql_col})'
        db_instance.execute_sql(sql, auto_commit=auto_commit)

        # index
        col_name = DataCountTable.get_date_col()
        sql = f'CREATE INDEX IF NOT EXISTS idx_{col_name} ON {table_name}({col_name})'
        db_instance.execute_sql(sql, auto_commit=auto_commit)
        return table_name

    def create_import_history_table(self, db_instance, auto_commit: bool = True):
        table_name = self.import_history_table_name
        if table_name in db_instance.list_tables():
            return table_name

        sql = ImportHistoryTable.create_table_sql(self.process_id)
        db_instance.execute_sql(sql, auto_commit=auto_commit)

        sql = ImportHistoryTable.create_index_sql(self.process_id)
        db_instance.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    def create_export_history_table(self, db_instance, auto_commit: bool = True):
        table_name = self.export_history_table_name
        if table_name in db_instance.list_tables():
            return table_name

        sql = ExportHistoryTable.create_table_sql(self.process_id)
        db_instance.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    @staticmethod
    def vacuum_data(db_instance):
        db_instance.execute_sql('VACUUM;')

    def clean_data_with_limit_import(self, db_instance, limit: int) -> bool:
        # change created_at to get_date column
        if limit <= 0:
            return False
        data_count = db_instance.run_sql(f'SELECT COUNT(ROWID) AS COUNT FROM {self.table_name}')[1][0]['COUNT']
        delete_row = data_count - limit
        if delete_row <= 0:
            return False

        from ap.api.setting_module.services.data_import import (
            gen_bulk_insert_sql,
            get_insert_params,
            get_proc_data_count_df,
            insert_data,
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

        cols, rows = db_instance.run_sql(sql)

        # TODO: this is duplicated code.
        # TODO: this is inefficient because we returning all the rows from the DELETING.
        # TODO: this is inefficient because we add a lot of negative rows into data_finder,
        #   making query to data finder slow.
        df = pd.DataFrame(rows, columns=cols)
        count_df = get_proc_data_count_df(df, get_date_col=get_date_column_name, decrease=True, is_db=True)
        agg_keys = {DataCountTable.count.name: 'sum', DataCountTable.count_file.name: 'sum'}
        aggregated_df = count_df.groupby(DataCountTable.datetime.name).agg(agg_keys).reset_index()
        sql_vals = aggregated_df.to_records(index=False).tolist()
        sql_params = get_insert_params(DataCountTable.get_keys())
        sql_insert = gen_bulk_insert_sql(DataCountTable.get_table_name(self.process_id), *sql_params)

        insert_data(db_instance, sql_insert, sql_vals)

        return True

    def __create_sequence_table(self, db_instance):
        sql = f"""
            CREATE SEQUENCE IF NOT EXISTS {self.table_name}_id_seq
            START WITH 1
            INCREMENT BY 1
            CACHE {SEQUENCE_CACHE};
        """
        db_instance.execute_sql(sql)

    def delete_sequence_table(self, db_instance, table_name: str | None = None, auto_commit: bool = True):
        table_name = table_name or self.table_name
        # sql = f'DROP SEQUENCE {self.table_name}_id_seq CASCADE;'
        sql = f'DROP TABLE IF EXISTS {table_name};'
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    @staticmethod
    def rename_sequence_table(db_instance, old_table_name: str, new_table_name: str, auto_commit: bool = True):
        sql = f'ALTER TABLE {old_table_name} RENAME TO {new_table_name};'
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    def rename_column(self, df: DataFrame):
        df_columns = list(df.columns)
        rename_columns = self.cfg_process_columns  # column of current version
        dict_rename_col = dict(zip(df_columns, rename_columns, strict=False))
        df = df.rename(columns=dict_rename_col)
        return df

    def add_default_indexes_column(
        self,
        set_multiple_indexes: set[MultipleIndexes] | None = None,
    ) -> set[MultipleIndexes]:
        set_indexes = set_multiple_indexes or set()
        # add default index columns
        data_time = self.getdate_column.bridge_column_name if self.getdate_column else None
        default_indexes = []
        if data_time is not None:
            default_indexes.append(SingleIndex(data_time))
        add_multiple_indexes_to_set(set_indexes, MultipleIndexes(default_indexes))
        return set_indexes

    def __get_table_indexes(self, db_instance) -> set[MultipleIndexes]:
        """Get all index columns of process"""
        # sql = f'''
        #     SELECT indexdef
        #     FROM pg_indexes
        #     WHERE schemaname = 'public' and tablename = '{self.table_name}'
        #     ORDER BY indexdef;
        #     '''
        sql = f"""
            SELECT sql
            FROM sqlite_master
            WHERE type = 'index' AND tbl_name = '{self.table_name}';
        """
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        table_indexes: set[MultipleIndexes] = set()
        for col_dat in rows:
            multiple_indexes = MultipleIndexes.from_str(col_dat[0])
            table_indexes.add(multiple_indexes)
        return table_indexes

    def __get_missing_indexes(self, db_instance, new_link_key_indexes: set[MultipleIndexes]):
        already_indexes = self.__get_table_indexes(db_instance)
        return new_link_key_indexes - already_indexes

    def __get_expired_indexes(self, db_instance, link_key_indexes: set[MultipleIndexes]):
        """Get expired indexes to remove"""
        already_indexes = self.__get_table_indexes(db_instance)
        return already_indexes - link_key_indexes

    def __gen_index_col_name(self, index: MultipleIndexes) -> str:
        """Generate indexes alias name for column"""
        return index.to_idx(prefix=self.table_name)

    def create_index(self, db_instance, new_link_key_indexes: set[MultipleIndexes], auto_commit: bool = True):
        """Create composite indexes"""
        # get missing indexes
        missing_indexes = self.__get_missing_indexes(db_instance, new_link_key_indexes=new_link_key_indexes)
        for multiple_indexes in missing_indexes:
            index_alias = self.__gen_index_col_name(multiple_indexes)
            sql = f'CREATE INDEX IF NOT EXISTS {index_alias} ON {self.table_name} {multiple_indexes}'
            db_instance.execute_sql(sql, auto_commit=auto_commit)

        return missing_indexes

    def remove_index(self, db_instance, new_link_key_indexes: set[MultipleIndexes], auto_commit=False):
        """
        Remove unused indexes
        in case of import data, remove before import
        after that, import data then create indexes again
        """
        # retrieve unused indexes
        expired_indexes = self.__get_expired_indexes(db_instance, link_key_indexes=new_link_key_indexes)
        # remove unused indexes
        try:
            for multiple_indexes in expired_indexes:
                # drop index, sub index on partition will be removed too
                # column is index_alias
                sql = f'DROP INDEX IF EXISTS {self.__gen_index_col_name(multiple_indexes)};'
                db_instance.execute_sql(sql)
            if auto_commit:
                db_instance.connection.commit()
        except Exception as e:
            db_instance.connection.rollback()
            raise e

        return expired_indexes

    def purge_index(self, db_instance, auto_commit: bool = True):
        """Force remove all indexes (use for delete column)"""
        # retrieve unused indexes
        multiple_indexes = self.__get_link_key_indexes()
        # remove unused indexes
        try:
            for multiple_indexes in multiple_indexes:
                self.drop_index(db_instance, self.__gen_index_col_name(multiple_indexes), auto_commit=auto_commit)
        except Exception as e:
            db_instance.connection.rollback()
            raise e

    @staticmethod
    def drop_index(db_instance, index: str, auto_commit: bool = True):
        sql = f'DROP INDEX IF EXISTS {index};'
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    def get_indexes_by_column_name(self, db_instance, column_name: str):
        sql = f"""SELECT name
FROM sqlite_master
WHERE type = 'index'
  and tbl_name = '{self.table_name}'
  and sql like '%{column_name}%';
"""
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        return [row[0] for row in rows] if rows else []

    def __get_link_key_indexes(self) -> set[MultipleIndexes]:
        """Get all link_keys of process from CfgTrace"""
        edges: list[CfgTrace] = CfgTrace.get_traces_of_proc([self.process_id])
        link_key_indexes: set[MultipleIndexes] = set()

        for trace in edges:
            # indexes = [SingleIndex(self.getdate_column.bridge_column_name)]
            indexes = []

            is_swap = trace.self_process_id != self.process_id
            trace_key: CfgTraceKey
            for trace_key in trace.trace_keys:
                self_info = ColumnInfo(
                    bridge_column_name=trace_key.self_column.bridge_column_name,
                    column_type=trace_key.self_column.column_type,
                    data_type=trace_key.self_column.data_type,
                    substr_from=trace_key.self_column_substr_from,
                    substr_to=trace_key.self_column_substr_to,
                )

                target_info = ColumnInfo(
                    bridge_column_name=trace_key.target_column.bridge_column_name,
                    column_type=trace_key.target_column.column_type,
                    data_type=trace_key.target_column.data_type,
                    substr_from=trace_key.target_column_substr_from,
                    substr_to=trace_key.target_column_substr_to,
                )

                if is_swap:
                    self_info, target_info = target_info, self_info

                # we cast it to substr any way if it's need to
                if self_info.is_substr_key():
                    index = self_info.to_substr_index()
                else:
                    index_should_be_text = target_info.is_substr_key() or target_info.is_text()
                    if index_should_be_text and not self_info.is_text():
                        index = self_info.to_cast_text_index()
                    else:
                        index = self_info.to_single_index()
                indexes.append(index)

            if not indexes:
                continue

            multiple_indexes = MultipleIndexes(indexes)

            # don't short date_time index, datetime index should always be the first one
            multiple_indexes.sort_from(start_index=0)
            add_multiple_indexes_to_set(link_key_indexes, multiple_indexes)

        # add default index columns
        link_key_indexes = self.add_default_indexes_column(link_key_indexes)

        return link_key_indexes

    def is_table_exist(self, db_instance):
        sql = f"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '{self.table_name}'"
        _, row = db_instance.run_sql(sql, row_is_dict=False)
        return len(row)

    def re_structure_index(self, db_instance):
        """Restructure index: add new or remove unused index base on cfg_trace"""
        # check if process table is already existing
        table_existing = self.is_table_exist(db_instance)
        if table_existing:
            new_link_key_indexes = self.__get_link_key_indexes()

            # remove unused indexes
            self.remove_index(db_instance, new_link_key_indexes=new_link_key_indexes)

            # create (composite) indexes
            self.create_index(db_instance, new_link_key_indexes=new_link_key_indexes)

    @staticmethod
    def get_table_columns(db_instance, table_name: str):
        sql = f'SELECT * FROM {table_name} WHERE 1=2;'
        exist_columns, _ = db_instance.run_sql(sql)
        return exist_columns

    @staticmethod
    def add_columns(db_instance, table_name: str, dict_col_with_type: dict[str, str], auto_commit: bool = True):
        exist_columns = TransactionData.get_table_columns(db_instance, table_name)
        for column_name, _data_type in dict_col_with_type.items():
            if column_name in exist_columns:
                continue

            data_type = DataType.correct_data_type(_data_type)
            TransactionData.add_column(db_instance, table_name, column_name, data_type, auto_commit=auto_commit)

    def get_column_name(self, column_id, brs_column_name=True):
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.id == column_id:
                if brs_column_name:
                    return cfg_process_column.bridge_column_name
                return cfg_process_column.column_name

    def get_column_id(self, column_name, is_compare_bridge_column_name=True):
        for cfg_process_column in self.cfg_process_columns:
            compare_name = (
                cfg_process_column.bridge_column_name
                if is_compare_bridge_column_name
                else cfg_process_column.column_name
            )
            if compare_name == column_name:
                return cfg_process_column.id

    def get_cfg_column_by_name(self, column_name, is_compare_bridge_column_name=True) -> CfgProcessColumn | None:
        for cfg_process_column in self.cfg_process_columns:
            compare_name = (
                cfg_process_column.bridge_column_name
                if is_compare_bridge_column_name
                else cfg_process_column.column_name
            )
            if compare_name == column_name:
                return cfg_process_column

    def get_bs_col_name_by_column_name(self, column_name):
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.column_name == column_name:
                return cfg_process_column.bridge_column_name

    def get_cfg_column_by_id(self, column_id) -> CfgProcessColumn | None:
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.id == column_id:
                return cfg_process_column
        return None

    def delete_columns(self, db_instance, column_names: list, auto_commit: bool = True):
        table = self.table_name
        exist_columns = self.get_table_columns(db_instance, table)
        delete_columns = [column_name for column_name in column_names if column_name in exist_columns]
        if not delete_columns:
            return

        # In SQLite, we cannot drop multi columns in one query statement
        sql = f'ALTER TABLE {table} DROP COLUMN {{}}'
        for column_name in delete_columns:
            db_instance.execute_sql(sql.format(column_name), auto_commit=auto_commit)

    def update_data_types(self, db_instance, dict_col_with_type, auto_commit: bool = True):
        current_dict_col_with_type = get_type_all_columns(db_instance, self.table_name)
        new_data_types = {}
        for column_name, data_type in dict_col_with_type.items():
            current_data_type = current_dict_col_with_type.get(column_name)
            new_data_type = data_type if data_type != DataType.DATETIME.name else DataType.TEXT.name
            datetime_col_name = self.getdate_column.bridge_column_name if self.getdate_column else None
            if (
                column_name and column_name != datetime_col_name and new_data_type != current_data_type
            ):  # can not update for column get_date
                new_data_type = DataType.correct_data_type(new_data_type)
                new_data_types[column_name] = new_data_type

        if new_data_types:
            self.purge_index(db_instance, auto_commit=auto_commit)
            for column_name, new_data_type in new_data_types.items():
                new_column_name = f'{column_name}_{datetime.now().strftime("%Y%m%d%H%M%S")}'
                self.add_column(db_instance, self.table_name, new_column_name, new_data_type, auto_commit=auto_commit)
                self.update_and_cast_date_type(
                    db_instance,
                    column_name,
                    new_column_name,
                    new_data_type,
                    auto_commit=auto_commit,
                )
                self.delete_columns(db_instance, [column_name], auto_commit=auto_commit)
                # self.rename_column_name(
                #     db_instance,
                #     column_name,
                #     f'{new_column_name}_1',
                # )  # TODO: remove if update version sqlite
                self.rename_column_name(db_instance, new_column_name, column_name, auto_commit=auto_commit)
            self.create_index(db_instance, self.__get_link_key_indexes())

    @staticmethod
    def add_column(db_instance, table_name: str, new_column_name: str, data_type: str, auto_commit: bool = True):
        sql = f"""
        ALTER TABLE {table_name} ADD COLUMN {new_column_name} {data_type}
        """
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    def update_and_cast_date_type(
        self,
        db_instance,
        old_column_name,
        new_column_name,
        new_data_type,
        auto_commit: bool = True,
    ):
        sql = f'UPDATE {self.table_name} SET {new_column_name} = CAST({old_column_name} AS {new_data_type}) WHERE 1=1'
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    def rename_column_name(self, db_instance, old_column_name, new_column_name, auto_commit: bool = True):
        sql = f"""
        ALTER TABLE {self.table_name} RENAME COLUMN {old_column_name} TO {new_column_name};
        """
        db_instance.execute_sql(sql, auto_commit=auto_commit)

    def delete_process(self, db_instance):
        table_name = self.table_name
        if table_name in db_instance.list_tables():
            sql = f'DROP TABLE IF EXISTS {self.table_name};'
            db_instance.execute_sql(sql)
            db_instance.connection.commit()

    def remove_transaction_by_time_range(self, db_instance: Union[SQLite3], start_time, end_time):
        sql = f"""
            DELETE
            FROM {self.table_name}
            WHERE  {self.getdate_column.bridge_column_name} >= {SQL_PARAM_SYMBOL}
                AND {self.getdate_column.bridge_column_name} < {SQL_PARAM_SYMBOL}
        """
        params = [start_time, end_time]
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
        df = pd.DataFrame(rows, columns=cols, dtype='object')
        return df

    def get_max_date_time_by_process_id(self, db_instance: Union[PostgreSQL, SQLite3]):
        max_time = 'max_time'
        sql = f'SELECT max({self.getdate_column.bridge_column_name}) as {max_time} FROM {self.table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=True)
        return rows[0].get(max_time)

    def get_min_date_time_by_process_id(self, db_instance: Union[PostgreSQL, SQLite3]):
        min_time = 'min_time'
        sql = f'SELECT min({self.getdate_column.bridge_column_name}) as {min_time} FROM {self.table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=True)
        return rows[0].get(min_time)

    def get_latest_records_by_process_id(self, db_instance: Union[PostgreSQL, SQLite3], limit=5):
        sql = f'SELECT * FROM {self.table_name} ORDER BY {self.getdate_column.bridge_column_name} LIMIT {limit}'
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        return cols, rows

    def get_datetime_value(self, db_instance: Union[PostgreSQL, SQLite3]):
        sql = f"""SELECT {self.getdate_column.bridge_column_name}
        FROM {self.table_name} ORDER BY {self.getdate_column.bridge_column_name} DESC"""
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        return list(sum(rows, ()))

    def get_column_value_by_id(self, db_instance: Union[PostgreSQL, SQLite3], col_id):
        col = self.get_cfg_column_by_id(col_id)
        time_col = self.getdate_column.bridge_column_name
        sql = f'SELECT {col.bridge_column_name} FROM {self.table_name} ORDER BY {time_col} DESC'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        return list(sum(rows, ()))

    # def get_transaction_distinct_values(
    #         self,
    #         db_instance: Union[PostgreSQL, Oracle, MySQL, MSSQLServer],
    #         cfg_process_col: CfgProcessColumn,
    #         sql_limit: int = 10000,
    # ):
    #     sql = f'''
    #         SELECT DISTINCT SUB.{cfg_process_col.bridge_column_name}
    #         FROM (SELECT {cfg_process_col.bridge_column_name}
    #               FROM {self.table_name}
    #               LIMIT {sql_limit}) SUB;
    #     '''
    #     cols, rows = db_instance.run_sql(sql, row_is_dict=False)
    #     rows = list(map(lambda x: x[0], rows))
    #     if cfg_process_col.raw_data_type in [
    #         RawDataTypeDB.CATEGORY_TEXT.value,
    #         RawDataTypeDB.CATEGORY_INTEGER.value,
    #     ]:
    #         m_column_group = MColumnGroup.get_by_data_ids([cfg_process_col.id])
    #         if not m_column_group:
    #             return []
    #         group_id = m_column_group[0].group_id
    #         values = []
    #         for chunk_rows in chunks(rows, THIN_DATA_CHUNK):
    #             dic_conditions = {
    #                 SemiMaster.Columns.factor.name: [(SqlComparisonOperator.IN, tuple(chunk_rows))],
    #                 SemiMaster.Columns.group_id.name: group_id,
    #             }
    #             _, _rows = SemiMaster.select_records(
    #                 db_instance,
    #                 dic_conditions=dic_conditions,
    #                 row_is_dict=False,
    #                 select_cols=[SemiMaster.Columns.value_text.name],
    #             )
    #             values.extend(list(map(lambda x: x[0], _rows)))
    #         rows = values
    #
    #     return rows

    @property
    def table_model(self) -> sa.Table:
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

    def update_timezone(self, db_instance, tz_offset):
        col = self.getdate_column.bridge_column_name
        sql = f"""UPDATE {self.table_name}
        SET {col} = strftime("{DATE_FORMAT_SQLITE_STR}",DATETIME({col},"{tz_offset}")) || SUBSTR({col},-8) """
        db_instance.execute_sql(sql)

    def select_distinct_data(self, db_instance, col_name, limit=1000):
        sql = f'SELECT DISTINCT {col_name} FROM {self.table_name} ORDER BY {col_name} ASC LIMIT {limit}'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        vals = [row[0] for row in rows if row[0] is not None]
        return vals

    def select_data(self, db_instance, col_names, limit=1000):
        cols_str = gen_insert_col_str(col_names)
        sql = f'SELECT {cols_str} FROM {self.table_name} LIMIT {limit}'
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        vals = sorted({row[0] for row in rows})
        return vals

    def get_ct_range(self, db_instance):
        # TODO get from data count for better performance
        time_col = self.getdate_column.bridge_column_name
        sql = f'SELECT MIN({time_col}) as min_time, MAX({time_col}) as max_time FROM {self.table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        min_time = rows[0][0]
        max_time = rows[0][1]
        return min_time, max_time

    def get_all(self, db_instance: Union[PostgreSQL, SQLite3], order_by_time=False):
        sql = f'SELECT * FROM {self.table_name}'
        if order_by_time:
            sql = f'{sql} ORDER BY {self.getdate_column.bridge_column_name}'

        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        return cols, rows

    def get_all_data_by_chunk(self, db_instance: Union[PostgreSQL, SQLite3], chunk_size=1_000_000):
        sql = f'SELECT * FROM {self.table_name}'
        data = db_instance.fetch_many(sql, size=chunk_size)
        if not data:
            return None

        yield from data

    def get_transaction_by_time_range(self, db_instance: Union[SQLite3], start_time, end_time, limit=1_000_000):
        sql = f"""
            SELECT *
            FROM {self.table_name}
            WHERE  {self.getdate_column.bridge_column_name} >= {SQL_PARAM_SYMBOL}
                AND {self.getdate_column.bridge_column_name} < {SQL_PARAM_SYMBOL}
            LIMIT {limit};
        """
        params = [start_time, end_time]
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
        df = pd.DataFrame(rows, columns=cols, dtype='object')
        return df

    def get_data_count_by_time_range(
        self,
        db_instance: Union[PostgreSQL, SQLite3],
        start_date=None,
        end_date=None,
    ):
        """
        Get data count from data_count_table_name by time range
        Args:
            db_instance: DBInstance
            start_date: datetime
            end_date: datetime

        Returns:
            rows: dict
        """
        sql = f"""
                    SELECT count(*) as {DataCountTable.count.name}
                    FROM {self.table_name}
                    WHERE  {self.getdate_column.bridge_column_name} >= {SQL_PARAM_SYMBOL}
                        AND {self.getdate_column.bridge_column_name} < {SQL_PARAM_SYMBOL};
                """
        params = [start_date, end_date]
        _, [count, *_] = db_instance.run_sql(sql, params=params)
        return count

    def select_data_count(
        self,
        db_instance: Union[PostgreSQL, SQLite3],
        start_date=None,
        end_date=None,
        count_in_file: bool = False,
    ):
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

        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
        return cols, rows

    def get_all_import_history(self, db_instance) -> list[ImportHistoryTable]:
        table = ImportHistoryTable.table(self.process_id)

        stmt = table.select().order_by(table.c.job_id)

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql)
        return list(map(ImportHistoryTable.model_validate, rows))

    def get_import_history_last_fatal(self, db_instance) -> list[ImportHistoryTable]:
        table = ImportHistoryTable.table(self.process_id)

        stmt = table.select().where(
            sa.and_(
                table.c.job_id.in_(sa.select(sa.func.max(table.c.job_id))),
                table.c.status.in_([JobStatus.FATAL.name, JobStatus.PROCESSING.name]),
            ),
        )

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params)
        return list(map(ImportHistoryTable.model_validate, rows))

    ImportHistoryLatestDone = namedtuple('ImportHistoryLatestDone', ['file_name', 'start_tm', 'imported_row', 'status'])

    def get_import_history_latest_done_files(self, db_instance) -> list[ImportHistoryLatestDone]:
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

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params)
        return [self.ImportHistoryLatestDone(**row) for row in rows]

    def get_import_history_records(self, db_instance, import_type: str) -> list[ImportHistoryTable]:
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

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params)
        return [ImportHistoryRecord.model_validate(row) for row in rows]

    def get_import_history_first_import(self, db_instance, import_type: str) -> ImportHistoryTable | None:
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            table.select()
            .where(
                sa.and_(
                    table.c.import_type == import_type,
                    table.c.status.in_([import_type, JobStatus.DONE.name, JobStatus.FAILED.name]),
                ),
            )
            .order_by(sa.asc(table.c.created_at))
            .limit(1)
        )

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params)
        if len(rows):
            return ImportHistoryTable.model_validate(rows[0])
        return None

    def get_import_history_last_import(self, db_instance, import_type):
        table = ImportHistoryTable.table(self.process_id)

        stmt = (
            table.select()
            .where(
                sa.and_(
                    table.c.import_type == import_type,
                    table.c.status.in_([import_type, JobStatus.DONE.name, JobStatus.FAILED.name]),
                ),
            )
            .order_by(sa.desc(table.c.created_at))
            .limit(1)
        )

        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params)
        if len(rows):
            return ImportHistoryTable.model_validate(rows[0])
        return None

    def get_import_history_error_jobs(self, db_instance, job_id):
        table_name = self.import_history_table_name
        sql = f' SELECT * FROM {table_name} WHERE job_id = {SQL_PARAM_SYMBOL} AND status != {SQL_PARAM_SYMBOL}'
        params = [job_id, JobStatus.DONE.name]
        _, data = db_instance.run_sql(sql, params=params)
        return data

    def get_total_imported_row(self, db_instance, import_type):
        table_name = self.import_history_table_name
        sql = f' SELECT SUM(imported_row) AS total FROM {table_name} WHERE import_type = {SQL_PARAM_SYMBOL}'
        params = [import_type]
        _, data = db_instance.run_sql(sql, params=params)
        return data[0]['total'] or 0

    def get_sample_data(self, db_instance: Union[SQLite3], columns: list, limit=5) -> pd.DataFrame:
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
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        df = pd.DataFrame(rows, columns=cols, dtype='object')
        return df

    def get_cols_with_types(self):
        return {column.bridge_column_name: column.data_type for column in self.cfg_process_columns}


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
        stmt = sa.select(
            sa.func.min(table.c.import_from).label('import_from'),
            sa.func.max(table.c.import_to).label('import_to'),
        ).select_from(table)
        sql, params = gen_sql_and_params(stmt)
        with DbProxy(gen_data_source_of_universal_db(process_id), True) as db_instance:
            _, rows = db_instance.run_sql(sql)
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
    def create_table(cls, db_instance, process_id: int, auto_commit: bool = True):
        table_name = cls.get_table_name(process_id)
        if table_name in db_instance.list_tables():
            return table_name

        sql = cls.create_table_sql(process_id)
        db_instance.execute_sql(sql, auto_commit=auto_commit)

        return table_name

    @classmethod
    def get(cls, db_instance, process_id: int) -> PullHistoryRecord | None:
        table = cls.table(process_id)
        stmt = table.select()
        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql)
        return next(map(PullHistoryRecord.model_validate, rows), PullHistoryRecord(pull_from=None, pull_to=None))

    @classmethod
    def set(cls, db_instance, process_id: int, record: PullHistoryRecord):
        table = cls.table(process_id)
        upsert_stmt = sa.sql.text(
            f"""
INSERT OR REPLACE INTO {table.name}
({table.c.id.name}, {table.c.pull_from.name}, {table.c.pull_to.name}) VALUES
(:{table.c.id.name}, :{table.c.pull_from.name}, :{table.c.pull_to.name})
"""
        ).bindparams(id=record.id, pull_from=record.pull_from, pull_to=record.pull_to)
        sql, params = gen_sql_and_params(upsert_stmt)
        db_instance.run_sql(sql, params=params)


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
    def insert(cls, db_instance, proc_id: int, record: ExportHistoryRecord):
        table = cls.table(proc_id)
        stmt = table.insert().values(**record.model_dump())
        sql, params = gen_sql_and_params(stmt)
        db_instance.run_sql(sql, params=params)

    @classmethod
    def exported_range(cls, db_instance, proc_id: int, export_id: int) -> TimeRange:
        """Get the maximum export to from export history table"""
        table = cls.table(proc_id)
        stmt = sa.select(sa.func.min(table.c.export_from), sa.func.max(table.c.export_to)).where(
            table.c.export_id == export_id
        )
        sql, params = gen_sql_and_params(stmt)
        _, rows = db_instance.run_sql(sql, params=params, row_is_dict=False)
        min_ts, max_ts = rows[0]
        return TimeRange(min=Bound.included(min_ts), max=Bound.included(max_ts))

    @classmethod
    def create_table_sql(cls, proc_id: int) -> str:
        table = cls.table(proc_id)
        create_table_stmt = CreateTable(table, if_not_exists=True)
        sqlite3_compiled_stmt = gen_sql_compiled_stmt(create_table_stmt)
        return sqlite3_compiled_stmt.string
