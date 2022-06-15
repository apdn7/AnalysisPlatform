#!/usr/bin/python3
# -*- coding: utf-8 -*-
# Author: Masato Yasuda (2018/01/04)

import logging
import traceback

import pymysql.cursors

from histview2.common.common_utils import strip_all_quote

logger = logging.getLogger(__name__)


class MySQL:

    def __init__(self, host, dbname, username, password):
        self.host = host
        self.port = 3306
        self.dbname = dbname
        # postgresqlと違い、mysqlにはdbとschemaは同義
        # postgresqlはdbの下にschemaという概念がある。
        # http://d.hatena.ne.jp/sheeg/20070906/1189083744
        self.username = username
        self.password = password
        self.is_connected = False
        self.connection = None

    def dump(self):
        print("===== DUMP RESULT =====")
        print("DB Type: MySQL")
        print("self.host: " + self.host)
        print("self.port: " + str(self.port))
        print("self.dbname: " + self.dbname)
        print("self.username: " + self.username)
        print("self.is_connected: ", self.is_connected)
        print("=======================")

    def connect(self):
        try:
            self.connection = pymysql.connect(host=self.host,
                                              user=self.username,
                                              password=self.password,
                                              db=self.dbname,
                                              port=self.port,
                                              charset='utf8')  # ,
            # cursorclass=pymysql.cursors.DictCursor)
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

    def create_table(self, tblname, valtypes):
        if not self._check_connection():
            return False

        tblname = tblname.strip('\"')
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

    # 作成済みのテーブルを配列として返す
    def list_tables(self):
        if not self._check_connection():
            return False

        sql = "show tables"
        cur = self.connection.cursor()
        cur.execute(sql)
        results = []
        for row in cur.fetchall():
            results.append(row[0])
        return results

    def list_tables_and_views(self):
        if not self._check_connection():
            return False
        # Only list tables of default schema (default schema name can be got by "SCHEMA_NAME()")
        sql = "select table_name from information_schema.tables "
        sql += "where table_schema = '{0:s}'".format(self.dbname)
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
            False

        sql = "drop table if exists " + tblname
        sql = sql.replace('\"', '`')
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print(tblname + " dropped!")

    # テーブルのカラムのタイプを辞書の配列として返す
    # columns:
    #  name => カラム名,
    #  type => カラムタイプ
    def list_table_columns(self, tblname):
        if not self._check_connection():
            return False
        sql = "show columns from " + tblname
        sql = sql.replace('\"', '`')
        cur = self.connection.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        results = []
        for row in rows:
            results.append({
                "name": row[0],
                "type": row[1]
            })
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
            colnames.append(column["name"])
        return colnames

    def insert_table_records(self, tblname, names, values, add_comma_to_value=True):
        if not self._check_connection():
            return False

        sql = "insert into {0:s}".format(tblname)

        # Generate column names field
        sql += "("
        for idx, name in enumerate(names):
            if idx > 0:
                sql += ","
            sql += name
        sql += ") "

        # Generate values field
        sql += "values "
        for idx1, value in enumerate(values):
            if idx1 > 0:
                sql += ","
            sql += "("
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

        sql = sql.replace('\"', '`')
        # print(sql)
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print("Dummy data was inserted to {}!".format(tblname))

    # SQLをそのまま実行。
    # cols, rows = db1.run_sql("select * from tbl01")
    # という形で呼び出す
    def run_sql(self, sql, row_is_dict=True):
        if not self._check_connection():
            return False
        cur = self.connection.cursor()
        sql = sql.replace('\"', '`')
        cur.execute(sql)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        cols = [column[0] for column in cur.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        if row_is_dict:
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            rows = cur.fetchall()

        cur.close()
        return cols, rows

    def fetch_many(self, sql, size=10_000):
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        sql = sql.replace('\"', '`')
        cur.execute(sql)
        cols = [column[0] for column in cur.description]
        yield cols
        while True:
            rows = cur.fetchmany(size)
            if not rows:
                break

            yield rows

        cur.close()

    # 現時点ではSQLをそのまま実行するだけ
    def select_table(self, sql):
        return self.run_sql(sql)

    def get_timezone(self):
        try:
            # rows = self.run_sql('''SELECT @@global.time_zone as server_tz, @@session.time_zone as session_tz''')
            _, rows = self.run_sql('SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP) TZOFFSET')
            tz_offset = str(rows[0]['TZOFFSET'])
            return tz_offset

        except Exception as e:
            print(e)

        return None

    def execute_sql(self, sql):
        """ For executing any query requires commit action
        :param sql: SQL to be executed
        :return: Execution result
        """
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        # print(sql)
        sql = sql.replace('\"', '`')
        print(sql)
        res = cur.execute(sql)
        cur.close()
        self.connection.commit()

        return res

    # private functions

    def _check_connection(self):
        if self.is_connected:
            return True
        # 接続していないなら
        print("Connection is not Initialized. Please run connect() to connect to DB")
        return False

    def is_timezone_hold_column(self, tbl, col):
        # data_type = self.get_data_type_by_colname(tbl, col)
        # return True if data_type in [] else False
        return False
