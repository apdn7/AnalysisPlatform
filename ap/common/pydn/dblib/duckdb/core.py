from collections.abc import Iterator
from typing import Any, Union

import duckdb_engine
import pandas as pd
import sqlalchemy as sa
from duckdb import DuckDBPyConnection, DuckDBPyRelation, connect
from sqlalchemy import Select, TextClause

from ap.common.common_utils import convert_sa_sql_to_sa_str
from ap.common.constants import DuckDBDataType


class DuckDB:
    """Base class for DuckDB database connection management."""

    def __init__(self, filename: str, readonly: bool) -> None:
        self.filename = filename
        self.readonly = readonly
        self.connection: DuckDBPyConnection | None = None

    def connect(self) -> DuckDBPyConnection | None:
        self.connection = connect(database=self.filename, read_only=self.readonly)
        # begin the transaction here
        self.connection = self.connection.begin()

        return self.connection

    def commit(self) -> None:
        if self.connection:
            self.connection.commit()

    def rollback(self) -> None:
        if self.connection:
            self.connection.rollback()

    def disconnect(self) -> None:
        if self.connection:
            self.connection.close()
            self.connection = None

    @convert_sa_sql_to_sa_str
    def run_sql(
        self, sql: Union[str, Select, TextClause], params: dict[str, Any] | list[Any] | None = None
    ) -> DuckDBPyConnection:
        if not params:
            return self.connection.execute(sql)
        return self.connection.execute(sql, params)

    def list_tables(self) -> list[str]:
        sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main';"
        return self.run_sql(sql).fetchdf()['table_name'].tolist()

    def fetch_df(
        self, sql: sa.GenerativeSelect | sa.TextClause | str, params: dict[str, Any] | list[Any] | None = None
    ) -> pd.DataFrame:
        return self.run_sql(sql, params).fetchdf()

    def fetch_many_df(
        self,
        sql: sa.GenerativeSelect | sa.TextClause | str,
        params: dict[str, Any] | list[Any] | None = None,
        chunk_size: int = 10_000,
    ) -> Iterator[pd.DataFrame]:
        for chunk in self.run_sql(sql, params).fetch_record_batch(rows_per_batch=chunk_size):
            yield chunk.to_pandas()

    @staticmethod
    def gen_sql_and_params(stmt: sa.Select | sa.TextClause) -> tuple[str, dict[str, Any]]:
        """Convert sqlalchemy statement to duckdb sql and params
        Use `qmark` paramstyle because duckdb accepts `?` param
        """
        compiled_stmt = stmt.compile(
            dialect=duckdb_engine.Dialect(paramstyle='qmark'), compile_kwargs={'render_postcompile': True}
        )
        params = [compiled_stmt.params[pos] for pos in compiled_stmt.positiontup]  # sort params based position
        return compiled_stmt.string, params

    def create_from_df(self, _df: pd.DataFrame, table_name: str) -> DuckDBPyRelation:
        self.connection.execute(f'CREATE TABLE {table_name} AS SELECT * FROM _df')

    def insert_from_df(self, df: pd.DataFrame, table_name: str) -> DuckDBPyRelation:
        column_str = ', '.join(df.columns.tolist())
        self.connection.execute(f'INSERT INTO {table_name} ({column_str}) SELECT {column_str} FROM df')

    def column_types(self, table_name: str) -> dict[str, DuckDBDataType]:
        df = self.run_sql(f'PRAGMA table_info({table_name})').fetch_df()
        names = df['name'].tolist()
        types = df['type'].tolist()
        duckdb_types = list(map(DuckDBDataType, types))
        dict_name_type = dict(zip(names, duckdb_types, strict=False))
        return dict_name_type

    def add_column(self, table: str, column: str, data_type: DuckDBDataType):
        sql = f'ALTER TABLE {table} ADD COLUMN {column} {data_type}'
        self.run_sql(sql)

    def remove_column(self, table: str, column: str):
        sql = f'ALTER TABLE {table} DROP COLUMN {column}'
        self.run_sql(sql)

    def delete_table(self, table_name: str):
        self.run_sql(f'DROP TABLE {table_name}')

    def rename_table(self, old_name: str, new_name: str):
        self.run_sql(f'ALTER TABLE {old_name} RENAME TO {new_name}')

    def copy_table_schema(self, from_table: str, to_table: str):
        """https://duckdb.org/docs/stable/sql/statements/create_table.html#copying-the-schema"""
        self.run_sql(f'CREATE TABLE {to_table} AS FROM {from_table} WITH NO DATA')

    def cast_column_type(self, table: str, column: str, data_type: DuckDBDataType):
        """https://duckdb.org/docs/stable/sql/statements/alter_table#set-data-type"""
        self.run_sql(f'ALTER TABLE {table} ALTER {column} TYPE {data_type}')
