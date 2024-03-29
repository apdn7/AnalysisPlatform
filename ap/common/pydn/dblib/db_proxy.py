from typing import Union

from ap import dic_config, set_sqlite_params
from ap.common.constants import UNIVERSAL_DB_FILE, DBType
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

    def __init__(self, data_src, is_universal_db=False, immediate_isolation_level=False):
        self.is_universal_db = is_universal_db
        self.isolation_level = immediate_isolation_level
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

    def __enter__(self):
        self.db_instance = self._get_db_instance()
        conn = self.db_instance.connect()
        if self.is_universal_db and self.isolation_level:
            set_sqlite_params(conn)
        return self.db_instance

    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        try:
            if _exc_type:
                self.db_instance.connection.rollback()
            else:
                self.db_instance.connection.commit()

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
        else:
            return None

        password = self.db_detail.password
        if self.db_detail.hashed:
            password = decrypt_pwd(password)

        db_instance = target_db_class(
            self.db_detail.host, self.db_detail.dbname, self.db_detail.username, password
        )

        # use custom port or default port
        if self.db_detail.port:
            db_instance.port = self.db_detail.port

        if self.db_detail.schema:
            db_instance.schema = self.db_detail.schema

        return db_instance


def gen_data_source_of_universal_db():
    """
    create data source cfg object that point to our application universal db
    :return:
    """
    db_src = CfgDataSource()
    db_detail = CfgDataSourceDB()

    db_src.type = DBType.SQLITE.name
    db_src.db_detail = db_detail

    db_detail.dbname = dic_config[UNIVERSAL_DB_FILE]

    return db_src
