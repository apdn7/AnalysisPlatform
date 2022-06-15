#!/usr/bin/python3
# -*- coding: utf-8 -*-
# Author: DuyLSK (2019/05/31)

import logging
import re
import traceback

import cx_Oracle

from histview2.common.common_utils import strip_all_quote
from histview2.common.constants import ENCODING_UTF_8

logger = logging.getLogger(__name__)


class Oracle:

    def __init__(self, host, service_name, username, password):
        self.host = host
        self.port = 1521
        self.dbname = service_name
        self.username = username
        self.password = password
        self.is_connected = False

    def dump(self):
        print("===== DUMP RESULT =====")
        print("DB Type: Oracle")
        print("self.host: " + self.host)
        print("self.port: " + str(self.port))
        print("self.dbname: " + self.dbname)
        print("self.username: " + self.username)
        print("self.is_connected: ", self.is_connected)
        print("=======================")

    def connect(self):
        dsn = cx_Oracle.makedsn(self.host, self.port,
                                service_name=self.dbname)
        try:
            self.connection = cx_Oracle.connect(
                user=self.username, password=self.password, dsn=dsn, encoding=ENCODING_UTF_8, nencoding=ENCODING_UTF_8)
            self.is_connected = True
            return self.connection
        except:
            print("Cannot connect to db")
            print('>>> traceback <<<')
            traceback.print_exc()
            print('>>> end of traceback <<<')
            return False

    def disconnect(self):
        if not self._check_connection():
            return False
        self.connection.close()
        self.is_connected = False

    # As of now, create_table, drop_table, and intert_table aren't added
    # because we want to use tables of Oracle as "Read-only"
    def create_table(self, tblname, valtypes):
        if not self._check_connection():
            return False
        sql = "create table {0:s}(".format(tblname)
        for idx, val in enumerate(valtypes):
            if idx > 0:
                sql += ","
            sql += val["name"] + " " + val["type"]
        sql += ")"
        print(sql)
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print(tblname + " created!")

    # テーブル名の配列を取得
    def list_tables(self):
        if not self._check_connection():
            return False
        sql = "select table_name from user_tables"
        cur = self.connection.cursor()
        cur.execute(sql)
        results = []
        rows = cur.fetchall()
        for row in rows:
            results.append(row[0])
        cur.close()
        return results

    def list_tables_and_views(self):
        if not self._check_connection():
            return False
        # Only list tables of default schema (default schema name can be got by "SCHEMA_NAME()")
        sql = 'select view_name as name from user_views union all select table_name as name from user_tables'
        cur = self.connection.cursor()
        cur.execute(sql)
        results = []
        rows = cur.fetchall()
        for row in rows:
            results.append(row[0])
        cur.close()
        return results

    def drop_table(self, tblname):
        if not self._check_connection():
            return False
        sql = "drop table " + tblname
        cur = self.connection.cursor()
        try:
            cur.execute(sql)
            self.connection.commit()
            print(tblname + " dropped!")
        except Exception:
            print(tblname + " is not found!")
        finally:
            cur.close()

    # テーブルのカラムのタイプを辞書の配列として返す(元々はtbl_get_valtypes関数)
    # columns:
    #  name => カラム名,
    #  type => カラムタイプ

    def list_table_columns(self, tblname):
        if not self._check_connection():
            return False
        sql = "select column_id, column_name, data_type "
        sql += "from user_tab_columns "
        sql += "where table_name='{0:s}'".format(tblname)
        cur = self.connection.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        results = []
        for row in rows:
            results.append({
                "name": row[1],
                "type": row[2]
            })
        cur.close()
        return results

    # list_table_columnsのうちcolumn nameだけ必要な場合(元はtbl_get_colnames)
    def list_table_colnames(self, tblname):
        if not self._check_connection():
            return False
        columns = self.list_table_columns(tblname)
        colnames = []
        for column in columns:
            colnames.append(column["name"])
        return colnames

    def divide_data_to_chunks(self, lst_data, n):
        """ Devide a list to chunks of n elements.

        :param lst_data: data needs to be chunked
        :param n: size of chunk
        :return: an array of chunks with max size of n
        """
        for i in range(0, len(lst_data), n):
            yield lst_data[i:i + n]

    def insert_table_records(self, tblname, names, values, add_comma_to_value=True):
        """ Insert one or many records to Oracle DB.

        Note: Please note that
            - TIMESTAMP literal should be in '%Y-%m-%d %H:%M:%S' format.
            - DATE literal should be in '%Y-%m-%d' format.

        :param tblname: Table name
        :param names: Column names
        :param values: records need to be inserted
        :return: None
        """

        if not self._check_connection():
            return False

        # Generate column names field
        col_name = "("
        for idx, name in enumerate(names):
            if idx > 0:
                col_name += ","
            col_name += name
        col_name += ") "

        # Generate values field
        data_chunks = self.divide_data_to_chunks(values, 10_000)

        for chunk in data_chunks:
            sql = "insert all "
            for idx1, value in enumerate(chunk):
                sql += " into {0:s} ".format(tblname) + col_name + " values ("
                for idx2, name in enumerate(names):
                    if idx2 > 0:
                        sql += ","

                    if value[name] in ('', None):
                        sql += 'Null'
                    elif add_comma_to_value:
                        sql += "'" + str(value[name]) + "'"
                    else:
                        sql += str(value[name])

                sql += ")"
            sql += " SELECT 1 FROM dual"
            cur = self._create_cursor_with_date_time_format()
            sql = Oracle.convert_sql(sql)
            cur.execute(sql)
            cur.close()
            print("Inserted {} rows".format(len(chunk)))
        self.connection.commit()

        print("Dummy data was inserted to {0:s}!".format(tblname))

    # SQLをこのまま実行
    # [以下、結果をDict形式で返す方法]
    # https://stackoverflow.com/questions/16519385/
    # output-pyodbc-cursor-results-as-python-dictionary
    # cols, rows = db1.run_sql("select * from tbl01")
    # という形で呼び出す
    def run_sql(self, sql, row_is_dict=True):
        if not self._check_connection():
            return False
        print(sql)
        cur = self._create_cursor_with_date_time_format()
        sql = Oracle.convert_sql(sql)

        cursor = cur.execute(sql)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        cols = [column[0] for column in cursor.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        if row_is_dict:
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            rows = cur.fetchall()

        cursor.close()
        return cols, rows

    def fetch_many(self, sql, size=10_000):
        if not self._check_connection():
            return False

        cur = self._create_cursor_with_date_time_format()
        sql = Oracle.convert_sql(sql)

        cursor = cur.execute(sql)
        cols = [column[0] for column in cursor.description]
        yield cols
        while True:
            rows = cur.fetchmany(size)
            if not rows:
                break

            yield rows

        cursor.close()

    def execute_sql(self, sql):
        """ For executing any query requires commit action
        :param sql: SQL to be executed
        :return: Execution result
        """
        if not self._check_connection():
            return False

        cur = self._create_cursor_with_date_time_format()
        sql = Oracle.convert_sql(sql)
        print(sql)
        try:
            cur.execute(sql)
            self.connection.commit()
        except Exception:
            return False
        finally:
            cur.close()
        return True

    # 現時点ではSQLをそのまま実行するだけ
    def select_table(self, sql):
        return self.run_sql(sql)

    def get_timezone(self):
        try:
            _, rows = self.run_sql('SELECT DBTIMEZONE AS TZOFFSET FROM DUAL')
            return str(rows[0]['TZOFFSET'])

        except Exception as e:
            print(e)

        return None

    # private functions
    def _check_connection(self):
        if self.is_connected:
            return True
        # 接続していないなら
        print("Connection is not Initialized. Please run connect() to connect to DB")
        return False

    def _create_cursor_with_date_time_format(self):
        if not self.is_connected:
            return None
        cur = self.connection.cursor()
        try:
            cur.execute("alter session set nls_date_format = 'YYYY-MM-DD HH24:MI:SS'")
            cur.execute("alter session set nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF3'")
        except:
            pass

        return cur

    @staticmethod
    def convert_sql(sql):
        """convert filter datetime before execute sql

        Arguments:
            sql {[type]} -- [description]

        Returns:
            [type] -- [description]
        """
        timestamp_frm = "'YYYY-MM-DD HH24:MI:SS.FF3'"
        timestamp_z_frm = "'YYYY-MM-DD HH24:MI:SS.FF3TZR'"
        timestamp_tz_frm = "'YYYY-MM-DD HH24:MI:SS.FF3 TZH:TZM'"
        regex_str = r"('\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}.\d{3}')"
        regex_z_str = r"('\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}.\d{3}Z')"
        regex_tz_str = r"('\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}.\d{3}\s[+-]?\d{1,2}:\d{2}')"
        new_sql = re.sub(regex_str, f'TO_TIMESTAMP(\\1,{timestamp_frm})', sql)
        new_sql = re.sub(regex_z_str, f'TO_TIMESTAMP_TZ(\\1,{timestamp_z_frm})', new_sql)
        new_sql = re.sub(regex_tz_str, f'TO_TIMESTAMP_TZ(\\1,{timestamp_tz_frm})', new_sql)
        # new_sql = re.sub(regex_str, f'TO_CHAR(TO_TIMESTAMP(\\1,{timestamp_frm}),{timestamp_frm})', sql)
        return new_sql

    def get_data_type_by_colname(self, tbl, col_name):
        col_name = strip_all_quote(col_name)
        cols = self.list_table_columns(tbl)
        data_type = [col['type'] for col in cols if col['name'] == col_name]
        return data_type[0] if data_type else None

    def is_timezone_hold_column(self, tbl, col):
        data_type = self.get_data_type_by_colname(tbl, col)

        if 'TIME ZONE' in data_type.upper():
            return True

        return False
