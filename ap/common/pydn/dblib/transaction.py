from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable

from ap.common.path_utils import gen_duckdb_file_name, gen_sqlite3_file_name
from ap.common.pydn.dblib.duckdb import DuckDB
from ap.common.pydn.dblib.duckdb.lock import DuckDBLock
from ap.common.pydn.dblib.sqlite import SQLite3


class TxnMetaConnection:
    """Context manager for SQLite3 metadata database transactions."""

    def __init__(self, *, process_id: int) -> None:
        self.process_id = process_id
        self.db_filename = gen_sqlite3_file_name(process_id)
        self.db_instance: SQLite3 | None = None

    def __enter__(self) -> SQLite3 | None:
        """Enter transaction"""
        instance = SQLite3(self.db_filename)
        if instance.connect() is None:
            return None

        self.db_instance = instance
        return self.db_instance

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit transaction"""
        try:
            if exc_type:
                self.db_instance.connection.rollback()
            else:
                self.db_instance.connection.commit()
        except Exception as e:
            if self.db_instance is not None:
                self.db_instance.connection.rollback()
            raise e
        finally:
            self.db_instance.connection.close()


class TxnDataConnectionLock(ABC):
    """Base class for transaction data connection"""

    db_instance: DuckDB
    lock: DuckDBLock

    @abstractmethod
    def connect(self) -> DuckDB | None:
        """Connect to transaction data. Return None if failed to connect, otherwise return the db_instance"""

    def __enter__(self) -> DuckDB | None:
        """Enter transaction"""
        # take the lock
        self.lock.acquire()
        try:
            return self.connect()
        except Exception as e:
            self.db_instance.disconnect()
            # ensure failed connection should not leave database in `locked` state
            self.lock.release()
            raise e

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit transaction"""
        try:
            if exc_type:
                self.db_instance.rollback()
            else:
                self.db_instance.commit()
        except Exception as e:
            self.db_instance.rollback()
            raise e
        finally:
            self.db_instance.disconnect()
            self.lock.release()


class TxnDataConnection(TxnDataConnectionLock):
    """Context manager for single process"""

    def __init__(self, *, process_id: int, readonly_transaction: bool) -> None:
        self.db_instance = DuckDB(gen_duckdb_file_name(process_id), readonly_transaction)
        self.lock = DuckDBLock([process_id])

    def connect(self) -> DuckDB | None:
        if self.db_instance.connect() is None:
            return None
        return self.db_instance


class TxnMultiDataConnection(TxnDataConnectionLock):
    """Context manager for multiple DuckDB files"""

    def __init__(self, process_ids: Iterable[int]) -> None:
        self.process_ids = sorted(set(process_ids))
        self.db_instance = DuckDB(':memory:', False)
        self.lock = DuckDBLock(self.process_ids)

    def connect(self) -> DuckDB | None:
        if self.db_instance.connect() is None:
            return None
        self.attach_dbs()
        return self.db_instance

    def attach_dbs(self) -> None:
        sqls: list[str] = []
        db_names: list[str] = []
        for process_id in self.process_ids:
            db_name = f'proc_{process_id}'
            db_file = gen_duckdb_file_name(process_id)

            sqls.append(f"ATTACH '{db_file}' AS {db_name} (READ_ONLY);")
            db_names.append(db_name)

        db_names_search_path = ','.join(db_names)
        sqls.append(f"SET search_path = '{db_names_search_path}';")

        self.db_instance.run_sql('\n'.join(sqls))
