from datetime import datetime
from typing import Union

from ap.common.common_utils import add_seconds, gen_sqlite3_file_name, set_sqlite_params
from ap.common.constants import MSG_DB_CON_FAILED, MSG_NOT_SUPPORT_DB, DBType
from ap.common.cryptography_utils import decrypt_pwd
from ap.common.pydn.dblib import sqlite
from ap.common.pydn.dblib.mssqlserver import MSSQLServer
from ap.common.pydn.dblib.mysql import MySQL
from ap.common.pydn.dblib.oracle import Oracle
from ap.common.pydn.dblib.postgresql import PostgreSQL
from ap.common.pydn.dblib.sqlite import SQLite3
from ap.setting_module.models import CfgDataSource, CfgDataSourceDB


class DbProxy:
    """
    An interface for client to connect to many type of database
    """

    db_instance: Union[SQLite3, None, PostgreSQL, Oracle, MySQL, MSSQLServer]
    db_basic: CfgDataSource
    db_detail: CfgDataSourceDB
    dic_last_connect_failed_time = {}

    def __init__(
        self,
        data_src,
        is_universal_db=False,
        immediate_isolation_level=False,
        force_connect=False,
        dic_db_files=None,
        proc_id=None,
    ):
        self.dic_db_files = dic_db_files
        self.proc_id = proc_id
        self.is_universal_db = is_universal_db
        self.isolation_level = immediate_isolation_level
        self.force_connect = force_connect
        self.data_src = data_src
        if isinstance(data_src, CfgDataSource):
            self.db_basic = data_src
            self.db_detail = data_src.db_detail
        elif isinstance(data_src, CfgDataSourceDB):
            self.db_basic = data_src.cfg_data_source
            self.db_detail = data_src
        else:
            self.db_basic = CfgDataSource.query.get(data_src)
            self.db_detail = self.db_basic.db_detail

    def check_latest_failed_connection(self):
        last_failed_time = DbProxy.dic_last_connect_failed_time.get(self.db_basic.id)
        if last_failed_time is not None and last_failed_time > add_seconds(seconds=-180):
            raise Exception(MSG_DB_CON_FAILED)

    def add_latest_failed_connection(self):
        DbProxy.dic_last_connect_failed_time[self.db_basic.id] = datetime.utcnow()

    def remove_latest_failed_connection(self):
        DbProxy.dic_last_connect_failed_time.pop(self.db_basic.id, None)

    def __enter__(self):
        if not self.force_connect:
            self.check_latest_failed_connection()

        self.db_instance = self._get_db_instance()

        conn = self.db_instance.connect()
        if conn in (None, False):
            self.add_latest_failed_connection()
            raise Exception(MSG_DB_CON_FAILED)

        # connect successfully, we need reset failed connection
        self.remove_latest_failed_connection()

        if self.is_universal_db and self.isolation_level:
            set_sqlite_params(conn)

        if self.dic_db_files:
            for proc_id, db_file in self.dic_db_files.items():
                if proc_id != self.proc_id:
                    self.db_instance.cursor.execute(f"ATTACH DATABASE '{db_file}' as {proc_id}")

        return self.db_instance

    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        try:
            if self.is_universal_db:
                if _exc_type:
                    self.db_instance.connection.rollback()
                else:
                    self.db_instance.connection.commit()
            else:
                self.db_instance.connection.rollback()
        except Exception as e:
            if self.db_instance.connection is not None:
                self.db_instance.connection.rollback()

            raise e
        finally:
            self.db_instance.disconnect()
        return False

    def _get_db_instance(self):
        db_type = self.db_basic.type.lower()
        if db_type == DBType.SQLITE.value.lower():
            return sqlite.SQLite3(self.db_detail.dbname, isolation_level=self.isolation_level)

        if db_type == DBType.POSTGRESQL.value.lower():
            target_db_class = PostgreSQL
        elif db_type == DBType.ORACLE.value.lower():
            target_db_class = Oracle
        elif db_type == DBType.MYSQL.value.lower():
            target_db_class = MySQL
        elif db_type == DBType.MSSQLSERVER.value.lower():
            target_db_class = MSSQLServer
        elif db_type == DBType.SOFTWARE_WORKSHOP.value.lower():
            target_db_class = PostgreSQL
        else:
            raise Exception(MSG_NOT_SUPPORT_DB)

        password = self.db_detail.password
        if self.db_detail.hashed:
            password = decrypt_pwd(password)

        db_instance = target_db_class(self.db_detail.host, self.db_detail.dbname, self.db_detail.username, password)

        # use custom port or default port
        if self.db_detail.port:
            db_instance.port = int(self.db_detail.port)
        # FIXME: cast port to integer, this is a really bad operation ... we should save integer in db instead
        if db_instance.port is not None:
            db_instance.port = int(db_instance.port)

        if self.db_detail.schema:
            db_instance.schema = self.db_detail.schema

        return db_instance

    @classmethod
    def check_db_connection(cls, data_src, force: bool = False):
        with cls(data_src, force_connect=force) as db_instance:
            if not db_instance.is_connected:
                raise Exception(MSG_DB_CON_FAILED)


def gen_data_source_of_universal_db(proc_id=None):
    """
    create data source cfg object that point to our application universal db
    :return:
    """
    db_src = CfgDataSource()
    db_detail = CfgDataSourceDB()

    db_src.type = DBType.SQLITE.name
    db_src.db_detail = db_detail

    db_detail.dbname = gen_sqlite3_file_name(proc_id)

    return db_src
