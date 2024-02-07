#!/usr/bin/python3
# -*- coding: utf-8 -*-
# Author: Masato Yasuda (2019/04/10)

import logging
import os
import sqlite3
import traceback
from datetime import datetime

from dateutil import tz

from ap.common.common_utils import strip_all_quote

logger = logging.getLogger(__name__)


class SQLite3:
    def __init__(self, dbname, isolation_level=None):
        # from ap import SQLITE_CONFIG_DIR, dic_config

        # self.dbname = os.path.join(
        #     dic_config[SQLITE_CONFIG_DIR], dbname or ''
        # )  # sqliteで言うdbnameはファイル名/
        self.dbname = dbname
        self.is_connected = False
        self.connection = None
        self.cursor = None
        self.isolation_level = isolation_level

    def dump(self):
        print('===== DUMP RESULT =====')
        print('DB Type: SQLite3')
        print('self.dbname: {}'.format(self.dbname))
        print('self.isolation_level: {}'.format('IMMEDIATE' if self.isolation_level else None))
        print('self.is_connected: {}'.format(self.is_connected))
        print('=======================')

    def connect(self):
        try:
            if self.isolation_level:
                self.connection = sqlite3.connect(
                    self.dbname, timeout=60 * 5, isolation_level='IMMEDIATE'
                )
            else:
                self.connection = sqlite3.connect(self.dbname, timeout=60 * 5)

            self.is_connected = True
            self.cursor = self.connection.cursor()
            self.dump()
            return self.connection
        except Exception:
            print('Cannot connect to db')
            print('>>> traceback <<<')
            traceback.print_exc()
            print('>>> end of traceback <<<')
            return False

    def is_sqlite(self):
        """Check if dbname is actually a SQLite database file.

        Returns:
            boolean -- True if the file is SQLite database file, False otherwise.
        """
        if os.path.isfile(self.dbname):
            if os.path.getsize(self.dbname) > 100:
                with open(self.dbname, 'r', encoding='ISO-8859-1') as f:
                    header = f.read(100)
                    if header.startswith('SQLite format'):
                        return True

    def disconnect(self):
        if not self._check_connection():
            return False
        self.cursor.close()
        self.connection.close()
        self.is_connected = False

    def create_table(self, tblname, valtypes):
        if not self._check_connection():
            return False
        sql = 'create table {0:s}('.format(tblname)
        for idx, val in enumerate(valtypes):
            if idx > 0:
                sql += ','

            sql += val['name'] + ' ' + val['type']
        sql += ')'
        print(sql)
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        print(tblname + ' created!')

    # 作成済みのテーブルを配列として返す
    def list_tables(self):
        if not self._check_connection():
            return False

        # https://monjudoh.hatenablog.com/entry/20090916/1253104594
        sql = "select name from sqlite_master where type = 'table'"
        cur = self.connection.cursor()

        results = []
        for row in cur.execute(sql):
            results.append(row[0])
        return results

    def list_tables_and_views(self):
        if not self._check_connection():
            return False

        # https://monjudoh.hatenablog.com/entry/20090916/1253104594
        sql = "select name from sqlite_master where type = 'table' or type = 'view' "
        cur = self.connection.cursor()

        results = []
        for row in cur.execute(sql):
            results.append(row[0])
        return results

    def drop_table(self, tblname):
        if not self._check_connection():
            return False

        sql = 'drop table if exists ' + tblname
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        print(tblname + ' dropped!')

    # テーブルのカラムのタイプを辞書の配列として返す
    # columns:
    #  name => カラム名,
    #  type => カラムタイプ
    def list_table_columns(self, tblname):
        if not self._check_connection():
            return False
        # http://o.inchiki.jp/obbr/4
        sql = 'PRAGMA TABLE_INFO({})'.format(tblname)
        cur = self.connection.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        results = []

        for row in rows:
            results.append({'name': row[1], 'type': row[2]})
        return results

    def get_data_type_by_colname(self, tbl, col_name):
        col_name = strip_all_quote(col_name)
        cols = self.list_table_columns(tbl)
        data_type = [col['type'] for col in cols if col['name'] == col_name]
        return data_type[0] if data_type else None

    # list_table_columnsのうちcolumn nameだけ必要な場合
    def list_table_colnames(self, tblname):
        if not self._check_connection():
            return False
        columns = self.list_table_columns(tblname)
        colnames = []
        for column in columns:
            colnames.append(column['name'])
        return colnames

    def is_column_existing(self, tblname, col_name):
        col_name = strip_all_quote(col_name)
        cols = self.list_table_columns(tblname)
        return col_name in [col['name'] for col in cols]

    def insert_table_records(self, tblname, names, values):
        if not self._check_connection():
            return False

        sql = 'insert into {0:s}'.format(tblname)

        # Generate column names field
        sql += '('
        for idx, name in enumerate(names):
            if idx > 0:
                sql += ','
            sql += name
        sql += ') '

        # Generate values field
        sql += 'values '
        for idx1, value in enumerate(values):
            if idx1 > 0:
                sql += ','
            sql += '('
            for idx2, name in enumerate(names):
                if idx2 > 0:
                    sql += ','
                sql += "'" + str(value[name]) + "'"
            sql += ')'

        # print(sql)
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print('Dummy data was inserted to {}!'.format(tblname))

    # SQLをそのまま実行。
    # cols, rows = db1.run_sql("select * from tbl01")
    # という形で呼び出す
    def run_sql(self, sql, row_is_dict=True, params=None):
        if not self._check_connection():
            return False
        cur = self.connection.cursor()
        print(sql)
        if not params:
            cur.execute(sql)
        else:
            # convert datetime type to str
            _params = [
                p.strftime('%Y-%m-%dT%H:%M:%S.%fZ') if isinstance(p, datetime) else p
                for p in params
            ]
            print(_params)
            cur.execute(sql, _params)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        if not cur.description:
            return ([], [])

        cols = [column[0] for column in cur.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        if row_is_dict:
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            rows = cur.fetchall()

        cur.close()
        return (cols, rows)

    def fetch_many(self, sql, size=10_000, params=None):
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        print(sql)
        if params:
            print(params)
            cur.execute(sql, params)
        else:
            cur.execute(sql)

        cols = [column[0] for column in cur.description]
        yield cols
        while True:
            rows = cur.fetchmany(size)
            if not rows:
                break

            yield rows

        cur.close()

    def execute_sql(self, sql, params=None, return_value: str = None):
        """For executing any query requires commit action
        :param sql: SQL to be executed
        :return: Execution result
        """
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        print(sql)
        if not params:
            res = cur.execute(sql)
        else:
            _params = [
                p.strftime('%Y-%m-%dT%H:%M:%S.%fZ') if isinstance(p, datetime) else p
                for p in params
            ]
            print(_params)
            cur.execute(sql, _params)

        if not return_value:
            return_value = 'rowcount'  # todo draft
        affected_rows = getattr(cur, return_value)
        cur.close()
        self.connection.commit()

        return affected_rows  # changed from return res ot affected rows

    def execute_sql_in_transaction(self, sql, rows):
        """For executing any query requires commit action
        :param sql: SQL to be executed
        :param rows: data
        :return: Execution result
        """
        self.cursor.executemany(sql, rows)

    # 現時点ではSQLをそのまま実行するだけ
    def select_table(self, sql):
        return self.run_sql(sql)

    def get_timezone(self):
        try:
            return tz.tzlocal()
        except:
            return None

    # private functions

    def _check_connection(self):
        if self.is_connected:
            return True
        # 接続していないなら
        print('Connection is not Initialized. Please run connect() to connect to DB')
        return False

    def is_timezone_hold_column(self, tbl, col):
        # data_type = self.get_data_type_by_colname(tbl, col)
        # return True if data_type in [] else False
        return False

    def bulk_insert(self, tblname, columns, rows, is_replace=False, parameter_marker=None):
        """
        insert bulk data to db ( best performance )
        :param tblname:
        :param columns:
        :param rows:
        :param is_replace:fac
        :return:
        """
        if not self._check_connection():
            return False

        cols = ','.join(columns)
        if not parameter_marker:
            parameter_marker = '?'
        params = ','.join([parameter_marker] * len(columns))

        or_replace_str = ''
        if is_replace:
            or_replace_str = 'OR REPLACE'

        sql = f'INSERT {or_replace_str} INTO {tblname} ({cols}) VALUES ({params})'
        print(sql)

        cur = self.connection.cursor()
        cur.executemany(sql, rows)
        cur.close()

        return True

    @staticmethod
    def gen_bulk_insert_sql(tblname, columns):
        cols = ','.join(columns)
        params = ','.join(['?'] * len(columns))
        sql = f'INSERT INTO {tblname} ({cols}) VALUES ({params})'

        return sql
