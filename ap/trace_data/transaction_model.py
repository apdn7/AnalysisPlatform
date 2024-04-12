from typing import List, Optional, Set, Union

import sqlalchemy as sa
from pandas import DataFrame

from ap.api.common.services.show_graph_database import DictToClass
from ap.common.common_utils import DATE_FORMAT_SQLITE_STR, gen_data_count_table_name, gen_import_history_table_name
from ap.common.constants import (
    SEQUENCE_CACHE,
    SQL_PARAM_SYMBOL,
    BaseEnum,
    ColumnDTypeToSQLiteDType,
    DataType,
    DuplicateMode,
    JobStatus,
)
from ap.common.pydn.dblib.db_common import gen_insert_col_str
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


class TransactionData:
    id_col_name: str = 'rowid'
    process_id: int = None
    table_name: str = None
    cfg_process: CfgProcess = None
    serial_columns: list[CfgProcessColumn] = None
    getdate_column: CfgProcessColumn = None
    auto_incremental_column: CfgProcessColumn = None
    cfg_process_columns: List[CfgProcessColumn] = None
    select_column_names: List[str] = None
    cfg_filters = None
    show_duplicate: DuplicateMode = None
    actual_record_number: int = None
    unique_serial_number: int = None
    duplicate_serial_number: int = None
    df: DataFrame = None

    def __init__(self, process_id: int):
        self.cfg_process: CfgProcess = CfgProcess.query.get(process_id)
        if not self.cfg_process:
            raise Exception('Not exist process id')

        self.process_id = process_id
        self.table_name = self.cfg_process.bridge_table_name
        self.data_count_table_name = self.cfg_process.data_count_table_name
        self.import_history_table_name = self.cfg_process.import_history_table_name

        self.cfg_process_columns = self.cfg_process.columns
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

    def get_new_columns(self, db_instance: Union[PostgreSQL, Oracle, MySQL, MSSQLServer]) -> List[CfgProcessColumn]:
        sql = f'SELECT * FROM {self.table_name} WHERE 1=2;'
        exist_columns, _ = db_instance.run_sql(sql)
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

    def get_column_dtype(self, db_instance: Union[PostgreSQL, SQLite3], columns):
        columns_type = []
        for col in columns:
            columns_type.append(f'typeof({col}) as {col}')
        columns_type = ','.join(columns_type)
        sql = f"SELECT {columns_type} FROM '{self.table_name}' LIMIT 1;"
        _, list_dict_rows = db_instance.run_sql(sql, row_is_dict=True)
        col_dtypes = list_dict_rows[0] if list_dict_rows else {}
        if not col_dtypes:
            # empty table will return none instead of column data type
            # so it should find and return type from CfgProcessColumn
            for col in self.cfg_process_columns:
                col_dtypes[col.bridge_column_name] = ColumnDTypeToSQLiteDType[col.data_type].value
        return col_dtypes

    def get_data_for_check_duplicate(self, db_instance: Union[PostgreSQL, SQLite3], start_dt, end_dt):
        date_col = self.getdate_column.bridge_column_name
        sql = f'SELECT * FROM {self.table_name} WHERE {date_col} BETWEEN {SQL_PARAM_SYMBOL} AND {SQL_PARAM_SYMBOL}'
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=[start_dt, end_dt])
        return cols, rows

    def create_table(self, db_instance):
        dict_col_with_type = {column.bridge_column_name: column.data_type for column in self.cfg_process_columns}
        table_name = self.table_name
        if table_name in db_instance.list_tables():
            new_columns = self.get_new_columns(db_instance)
            if new_columns:
                dict_new_col_with_type = {column.bridge_column_name: column.data_type for column in new_columns}
                self.add_columns(db_instance, dict_new_col_with_type)
            # TODO: update data type error
            # self.update_data_types(db_instance, dict_col_with_type)
            return table_name

        # self.__create_sequence_table(db_instance)
        sql = f'CREATE TABLE IF NOT EXISTS {self.table_name}'
        sql_col = ''
        for col_name, _data_type in dict_col_with_type.items():
            data_type = DataType.TEXT.name if _data_type == DataType.DATETIME.name else _data_type
            sql_col += f'{col_name} {data_type}, '
        sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace

        # make at least one column if no column of table for testing
        if not sql_col:
            sql_col = 'created_at datetime'

        sql = f'{sql} ({sql_col})'
        db_instance.execute_sql(sql)

        # create data count table
        self.create_data_count_table(db_instance)
        # create import history table
        self.create_import_history_table(db_instance)

        return table_name

    def create_data_count_table(self, db_instance):
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
        db_instance.execute_sql(sql)

        # index
        col_name = DataCountTable.get_date_col()
        sql = f'CREATE INDEX IF NOT EXISTS idx_{col_name} ON {self.data_count_table_name}({col_name})'
        db_instance.execute_sql(sql)
        return table_name

    def create_import_history_table(self, db_instance):
        dict_col_with_type = ImportHistoryTable.to_dict()
        table_name = self.import_history_table_name
        if table_name in db_instance.list_tables():
            return table_name

        sql = f'CREATE TABLE IF NOT EXISTS {table_name}'
        sql_col = ''
        for col_name, data_type in dict_col_with_type.items():
            sql_col += f'{col_name} {data_type}, '
        sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace
        sql = f'{sql} ({sql_col})'
        db_instance.execute_sql(sql)

        # index
        (index_name, index_cols) = ImportHistoryTable.get_indexes()
        index_cols = ','.join(index_cols)
        sql = f'CREATE INDEX IF NOT EXISTS {index_name} ON {self.import_history_table_name}({index_cols})'
        db_instance.execute_sql(sql)

        return table_name

    def __create_sequence_table(self, db_instance):
        sql = f'''
            CREATE SEQUENCE IF NOT EXISTS {self.table_name}_id_seq
            START WITH 1
            INCREMENT BY 1
            CACHE {SEQUENCE_CACHE};
        '''
        db_instance.execute_sql(sql)

    def delete_sequence_table(self, db_instance):
        # sql = f'DROP SEQUENCE {self.table_name}_id_seq CASCADE;'
        sql = f'DROP TABLE IF EXISTS {self.table_name};'
        db_instance.execute_sql(sql)
        db_instance.connection.commit()

    def rename_column(self, df: DataFrame):
        df_columns = list(df.columns)
        rename_columns = self.cfg_process_columns  # column of current version
        dict_rename_col = dict(zip(df_columns, rename_columns))
        df = df.rename(columns=dict_rename_col)
        return df

    def add_default_indexes_column(
        self,
        set_multiple_indexes: Optional[Set[MultipleIndexes]] = None,
    ) -> Set[MultipleIndexes]:
        set_indexes = set_multiple_indexes or set()
        # add default index columns
        data_time = self.getdate_column.bridge_column_name if self.getdate_column else None
        default_indexes = []
        if data_time is not None:
            default_indexes.append(SingleIndex(data_time))
        add_multiple_indexes_to_set(set_indexes, MultipleIndexes(default_indexes))
        return set_indexes

    def __get_table_indexes(self, db_instance) -> Set[MultipleIndexes]:
        """
        get all index columns of process
        """
        # sql = f'''
        #     SELECT indexdef
        #     FROM pg_indexes
        #     WHERE schemaname = 'public' and tablename = '{self.table_name}'
        #     ORDER BY indexdef;
        #     '''
        sql = f'''
            SELECT sql
            FROM sqlite_master
            WHERE type = 'index' AND tbl_name = '{self.table_name}';
        '''
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        table_indexes: Set[MultipleIndexes] = set()
        for col_dat in rows:
            multiple_indexes = MultipleIndexes.from_str(col_dat[0])
            table_indexes.add(multiple_indexes)
        return table_indexes

    def __get_missing_indexes(self, db_instance, new_link_key_indexes: Set[MultipleIndexes]):
        already_indexes = self.__get_table_indexes(db_instance)
        return new_link_key_indexes - already_indexes

    def __get_expired_indexes(self, db_instance, link_key_indexes: Set[MultipleIndexes]):
        """
        get expired indexes to remove
        """
        already_indexes = self.__get_table_indexes(db_instance)
        return already_indexes - link_key_indexes

    def __gen_index_col_name(self, index: MultipleIndexes) -> str:
        """
        generate indexes alias name for column
        """
        return index.to_idx(prefix=self.table_name)

    def create_index(self, db_instance, new_link_key_indexes: Set[MultipleIndexes]):
        """
        create composite indexes
        """
        # get missing indexes
        missing_indexes = self.__get_missing_indexes(db_instance, new_link_key_indexes=new_link_key_indexes)
        for multiple_indexes in missing_indexes:
            index_alias = self.__gen_index_col_name(multiple_indexes)
            sql = f'CREATE INDEX IF NOT EXISTS {index_alias} ON {self.table_name} {multiple_indexes}'
            db_instance.execute_sql(sql)

        return missing_indexes

    def remove_index(self, db_instance, new_link_key_indexes: Set[MultipleIndexes], auto_commit=False):
        """
        remove unused indexes
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

    def __get_link_key_indexes(self) -> Set[MultipleIndexes]:
        """
        get all link_keys of process from CfgTrace
        """
        edges: List[CfgTrace] = CfgTrace.get_traces_of_proc([self.process_id])
        link_key_indexes: Set[MultipleIndexes] = set()

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
        """
        restructure index: add new or remove unused index base on cfg_trace
        """
        # check if process table is already existing
        table_existing = self.is_table_exist(db_instance)
        if table_existing:
            new_link_key_indexes = self.__get_link_key_indexes()

            # remove unused indexes
            self.remove_index(db_instance, new_link_key_indexes=new_link_key_indexes)

            # create (composite) indexes
            self.create_index(db_instance, new_link_key_indexes=new_link_key_indexes)

    def add_columns(self, db_instance, dict_new_col_with_type: dict):
        table = self.table_name
        for column_name, data_type in dict_new_col_with_type.items():
            sql = f'ALTER TABLE {table} ADD COLUMN {column_name} {data_type};'
            db_instance.execute_sql(sql)

        db_instance.connection.commit()

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

    def get_cfg_column_by_name(self, column_name, is_compare_bridge_column_name=True):
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

    def get_cfg_column_by_id(self, column_id) -> Optional[CfgProcessColumn]:
        for cfg_process_column in self.cfg_process_columns:
            if cfg_process_column.id == column_id:
                return cfg_process_column
        return None

    def delete_columns(self, db_instance, column_names: List):
        table = self.table_name
        sql = f'ALTER TABLE {table} '
        for column_name in column_names:
            sql += f'DROP COLUMN IF EXISTS {column_name}, '

        sql = sql.rstrip(', ')
        db_instance.execute_sql(sql)

    def update_data_types(self, db_instance, dict_col_with_type):  # TODO: check can update float to int???
        table_name = self.table_name
        sql = f'ALTER TABLE {table_name} '
        sql_col = ''
        for column_name, data_type in dict_col_with_type.items():
            if column_name != self.getdate_column.bridge_column_name:  # can not update for column get_date
                sql_col += f'ALTER COLUMN {column_name} TYPE {data_type}, '

        sql_col = sql_col.rstrip(', ')  # Remove trailing comma and whitespace
        sql = f'{sql} {sql_col}'
        db_instance.execute_sql(sql)

    def delete_process(self, db_instance):
        table_name = self.table_name
        if table_name in db_instance.list_tables():
            sql = f'DROP TABLE IF EXISTS {self.table_name};'
            db_instance.execute_sql(sql)
            db_instance.connection.commit()

    # def get_transaction_data(
    #         self,
    #         db_instance: Union[PostgreSQL, Oracle, MySQL, MSSQLServer],
    #         params,
    #         select_columns: list[str],
    #         sql_limit: int = SQL_LIMIT,
    # ) -> Union[tuple[list, list], DataFrame]:
    #     column_type_dicts = get_type_all_columns(db_instance, self.table_name)
    #     nullable_int64_columns = get_nullable_int64_columns(
    #         db_instance, self.table_name, list_dict_rows=column_type_dicts
    #     )
    #
    #     _select_columns = [self.id_col_name] + select_columns
    #     _select_columns = [
    #         gen_sql_cast_text(column) if column in nullable_int64_columns else f'"{column}"'
    #         for column in _select_columns
    #     ]
    #     select_columns_sql = ', '.join(_select_columns)
    #     # ↑====== Prepare columns to collect ======↑
    #
    #     # ↓====== Collect data ======↓
    #     param_marker = BridgeStationModel.get_parameter_marker()  # %s
    #     sql = f'''
    #         SELECT {select_columns_sql}
    #         FROM {self.table_name}
    #         WHERE {self.factory_machine_id_col_name} IN {param_marker}
    #             AND {self.prod_part_id_col_name} IN {param_marker}
    #             AND {self.getdate_column.bridge_column_name} >= {param_marker}
    #             AND {self.getdate_column.bridge_column_name} <= {param_marker}
    #         LIMIT {sql_limit};
    #     '''
    #     # params = (start_dt, end_dt)
    #     cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
    #
    #     df = pd.DataFrame(rows, columns=cols, dtype='object')
    #     # df = format_df(df)
    #     # ↑====== Collect data ======↑
    #
    #     # ↓====== Correct data type in dataFrame ======↓
    #     for column_type_dict in column_type_dicts:
    #         column_name = column_type_dict.get('column_name')
    #         if column_name not in cols:
    #             continue
    #
    #         data_type = column_type_dict.get('data_type')
    #         if data_type == 'bigint':
    #             convert_nullable_int64_to_numpy_int64(df, [column_name])
    #             continue
    #         if data_type == 'integer':
    #             if column_name in [self.factory_machine_id_col_name, self.prod_part_id_col_name]:
    #                 df[column_name] = df[column_name].astype('int32')
    #             else:
    #                 df[column_name] = df[column_name].astype(pd.Int32Dtype.name)
    #             continue
    #         if data_type == 'smallint':
    #             df[column_name] = df[column_name].astype(pd.Int16Dtype.name)
    #             continue
    #         if data_type == 'real':
    #             df[column_name] = df[column_name].astype(pd.Float32Dtype.name)
    #             continue
    #         if data_type == 'text':
    #             df[column_name] = df[column_name].astype(pd.StringDtype.name)
    #             continue
    #         if 'timestamp' in data_type:
    #             df[column_name] = df[column_name].astype(np.datetime64.__name__)
    #             continue
    #         if data_type == 'boolean':
    #             df[column_name] = df[column_name].astype('boolean')
    #             continue
    #     # ↑====== Correct data type in dataFrame ======↑
    #
    #     return df

    def get_max_date_time_by_process_id(self, db_instance: Union[PostgreSQL, SQLite3]):
        max_time = 'max_time'
        sql = f'SELECT max({self.getdate_column.bridge_column_name}) as {max_time} FROM {self.table_name}'
        _, rows = db_instance.run_sql(sql, row_is_dict=True)
        return rows[0].get(max_time)

    def get_latest_records_by_process_id(self, db_instance: Union[PostgreSQL, SQLite3], limit=5):
        sql = f'SELECT * FROM {self.table_name} ORDER BY {self.getdate_column.bridge_column_name} LIMIT {limit}'
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)
        return cols, rows

    def get_datetime_value(self, db_instance: Union[PostgreSQL, SQLite3]):
        sql = f'''SELECT {self.getdate_column.bridge_column_name}
        FROM {self.table_name} ORDER BY {self.getdate_column.bridge_column_name} DESC'''
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
            self.getdate_column,
        }

        for column in self.cfg_process_columns:
            column_name = column.bridge_column_name
            if column_name in existed_columns_name:
                continue

            data_type = DataType[column.data_type]
            sql_type = sa.Integer if data_type in [data_type.INTEGER, data_type.REAL] else sa.String
            columns.append(sa.Column(column_name, sql_type))

        return sa.Table(self.table_name, sa.MetaData(), *columns)

    def update_timezone(self, db_instance, tz_offset):
        col = self.getdate_column.bridge_column_name
        sql = f'''UPDATE {self.table_name}
        SET {col} = strftime("{DATE_FORMAT_SQLITE_STR}",DATETIME({col},"{tz_offset}")) || SUBSTR({col},-8) '''
        db_instance.execute_sql(sql)

    def select_distinct_data(self, db_instance, col_name, limit=1000):
        sql = f'SELECT DISTINCT {col_name} FROM {self.table_name} LIMIT {limit}'
        _, rows = db_instance.run_sql(sql, row_is_dict=False)
        vals = sorted([row[0] for row in rows])
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

    def select_data_count(self, db_instance: Union[PostgreSQL, SQLite3], start_date=None, end_date=None):
        datetime_col = DataCountTable.datetime.name
        count_col = DataCountTable.count.name
        sql = f'SELECT {datetime_col}, sum({count_col}) as {count_col} FROM {self.data_count_table_name}'
        params = []
        if start_date and end_date and start_date != end_date:
            sql += f' WHERE {datetime_col} >= {SQL_PARAM_SYMBOL} AND {datetime_col} < {SQL_PARAM_SYMBOL}'
            params = [start_date, end_date]

        sql += f' GROUP BY {datetime_col}'

        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
        return cols, rows

    def get_all_import_history(self, db_instance):
        sql = f'SELECT * FROM {self.import_history_table_name} ORDER BY {ImportHistoryTable.job_id.name}'

        _, rows = db_instance.run_sql(sql)
        return [DictToClass(**dic_row) for dic_row in rows]

    def get_import_history_last_fatal(self, db_instance):
        last_job_sql = f'SELECT MAX(job_id) AS job_id FROM {self.import_history_table_name}'
        sql = f'SELECT * FROM {self.import_history_table_name}'
        sql += f' WHERE job_id=({last_job_sql})'
        sql += f' AND status IN ({SQL_PARAM_SYMBOL}, {SQL_PARAM_SYMBOL});'
        params = [JobStatus.FATAL.name, JobStatus.PROCESSING.name]
        _, data = db_instance.run_sql(sql, params=params)
        data = [DictToClass(**dic_row) for dic_row in data]
        return data

    def get_import_history_latest_done_files(self, db_instance):
        params = [JobStatus.DONE.name, JobStatus.FAILED.name]
        sql = 'SELECT file_name, MAX(start_tm) AS start_tm, MAX(imported_row) AS imported_row'
        sql += f' FROM {self.import_history_table_name}'
        sql += f' WHERE status IN ({SQL_PARAM_SYMBOL}, {SQL_PARAM_SYMBOL})'
        sql += 'GROUP BY file_name;'

        _, data = db_instance.run_sql(sql, params=params)
        data = [DictToClass(**dic_row) for dic_row in data]
        return data

    def get_import_history_first_import(self, db_instance, import_type):
        table_name = self.import_history_table_name
        sql = f''' SELECT * FROM {table_name}
        WHERE import_type = {SQL_PARAM_SYMBOL} AND status IN ({SQL_PARAM_SYMBOL}, {SQL_PARAM_SYMBOL})
        ORDER BY {ImportHistoryTable.created_at.name} ASC LIMIT 1
        '''
        params = [import_type, JobStatus.DONE.name, JobStatus.FAILED.name]
        _, data = db_instance.run_sql(sql, params=params)
        return DictToClass(**data[0]) if len(data) else None

    def get_import_history_last_import(self, db_instance, import_type):
        table_name = self.import_history_table_name
        sql = f''' SELECT * FROM {table_name}
        WHERE import_type = {SQL_PARAM_SYMBOL} AND status IN ({SQL_PARAM_SYMBOL}, {SQL_PARAM_SYMBOL})
        ORDER BY {ImportHistoryTable.created_at.name} DESC LIMIT 1
        '''
        params = [import_type, JobStatus.DONE.name, JobStatus.FAILED.name]
        _, data = db_instance.run_sql(sql, params=params)
        return DictToClass(**data[0]) if len(data) else None

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
        return data[0]['total']


class DataCountTable(BaseEnum):
    datetime = (1, DataType.TEXT.name)
    count = (2, DataType.INTEGER.name)

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


class ImportHistoryTable(BaseEnum):
    # id = (1, DataType.INTEGER.name)
    job_id = (1, DataType.INTEGER.name)
    # csv import
    file_name = (2, DataType.TEXT.name)
    # factory import
    import_type = (3, DataType.TEXT.name)
    import_from = (4, DataType.TEXT.name)
    import_to = (5, DataType.TEXT.name)
    start_tm = (6, DataType.TEXT.name)
    end_tm = (7, DataType.TEXT.name)
    imported_row = (8, DataType.INTEGER.name)
    status = (9, DataType.TEXT.name)
    error_msg = (10, DataType.TEXT.name)
    created_at = (11, DataType.TEXT.name)
    updated_at = (12, DataType.TEXT.name)

    @classmethod
    def to_dict(cls):
        return {col: item.value[1] for col, item in cls.get_items()}

    @classmethod
    def as_obj(cls, dic_input=None):
        dic_vals = {key: None for key in cls.get_keys()} if dic_input is None else dic_input
        output = DictToClass(**dic_vals)

        return output

    @staticmethod
    def get_table_name(proc_id):
        return gen_import_history_table_name(proc_id)

    @classmethod
    def get_indexes(cls):
        return (
            'ix_t_import_history_file_name_created_at',
            (cls.file_name.name, cls.created_at.name),
        )
