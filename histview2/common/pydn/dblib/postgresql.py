#!/usr/bin/python3
# -*- coding: utf-8 -*-
# Author: Masato Yasuda (2018/01/04)

import logging
import traceback

import psycopg2
import psycopg2.extras

from histview2.common.common_utils import strip_all_quote

logger = logging.getLogger(__name__)


class PostgreSQL:

    def __init__(self, host, dbname, username, password):
        self.host = host
        self.port = 5432
        self.dbname = dbname
        # postgresqlはdbの下にschemaという概念がある。
        # http://d.hatena.ne.jp/sheeg/20070906/1189083744
        self.schema = None
        self.username = username
        self.password = password
        self.is_connected = False
        self.connection = None

    def dump(self):
        print("===== DUMP RESULT =====")
        print("DB Type: PostgreSQL")
        print("self.host: " + self.host)
        print("self.port: " + str(self.port))
        print("self.dbname: " + self.dbname)
        print("self.username: " + self.username)
        print("self.is_connected: ", self.is_connected)
        print("=======================")

    def connect(self):
        dsn = "host={0:s} ".format(self.host)
        dsn += "port={0:d} ".format(self.port)
        dsn += "dbname={0:s} ".format(self.dbname)
        dsn += "user={0:s} ".format(self.username)
        dsn += "password={0:s}".format(self.password)
        try:
            self.connection = psycopg2.connect(dsn)
            cur = self.connection.cursor()
            self.is_connected = True

            if self.schema:
                cur.execute(
                    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = '{}';".format(self.schema))
                if cur.rowcount:
                    cur.execute("SET search_path TO {0:s}".format(self.schema))
                else:
                    print("Schema is not exists!!!")
                    self.disconnect()
            else:
                # Get current schema
                cur.execute("SELECT current_schema();")
                default_schema = cur.fetchone()
                # Save default schema as constant, use to list current schema's tables
                self.schema = default_schema[0]
            cur.close()
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
        # https://stackoverflow.com/questions/1281875/
        # making-sure-that-psycopg2-database-connection-alive
        self.connection.close()
        self.is_connected = False

    def create_table(self, tblname, colnames):
        if not self._check_connection():
            return False
        sql = "create table {0:s}(".format(tblname)
        for idx, val in enumerate(colnames):
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

    # テーブル名を配列として返す
    def list_tables(self):
        if not self._check_connection():
            return False
        sql = "select table_name from information_schema.tables "
        sql += "where table_type = 'BASE TABLE' and table_schema = '{0:s}'".format(self.schema)
        cur = self.connection.cursor()
        cur.execute(sql)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        cols = [column[0] for column in cur.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        rows = []
        for row in cur.fetchall():
            rows.append(dict(zip(cols, row)))
        cur.close()
        # キーに"table_name"を持つ要素を配列として返す
        return [row["table_name"] for row in rows]

    def list_tables_and_views(self):
        if not self._check_connection():
            return False
        sql = "select table_name from information_schema.tables "
        sql += "where table_schema = '{0:s}'".format(self.schema)
        cur = self.connection.cursor()
        cur.execute(sql)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        cols = [column[0] for column in cur.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        rows = []
        for row in cur.fetchall():
            rows.append(dict(zip(cols, row)))
        cur.close()
        # キーに"table_name"を持つ要素を配列として返す
        return [row["table_name"] for row in rows]

    def drop_table(self, tblname):
        if not self._check_connection():
            return False
        sql = "drop table if exists " + tblname
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

        columns = []
        sql = "select * from information_schema.columns "
        sql += "where table_schema = '{0}' and table_name = '{1}'".format(self.schema, tblname)
        cur = self.connection.cursor()
        cur.execute(sql)
        # cursor.descriptionはcolumnの配列
        # そこから配列名(column[0])を取り出して配列columnsに代入
        cols = [column[0] for column in cur.description]
        # columnsは取得したカラム名、rowはcolumnsをKeyとして持つ辞書型の配列
        # rowは取得したカラムに対応する値が順番にrow[0], row[1], ...として入っている
        # それをdictでまとめてrowsに取得
        rows = []
        for row in cur.fetchall():
            rows.append(dict(zip(cols, row)))
        cur.close()
        results = []

        for row in rows:
            results.append({
                "name": row["column_name"],
                "type": row["data_type"]
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

    # 元はinsert_table関数
    def insert_table_records(self, tblname, names, values, add_comma_to_value=True):
        if not self._check_connection():
            return False

        sql = "insert into {0:s}".format(tblname)

        # Generate column names fields
        sql += "("
        for idx, name in enumerate(names):
            if idx > 0:
                sql += ","
            sql += name
        sql += ") "

        # Generate values field
        if not values:
            return False

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

        # print(sql)
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print("Dummy data was inserted to {}!".format(tblname))

    # SQLをそのまま実行
    # colsとdict形式のrowsを返す
    # cols, rows = db1.run_sql("select * from tbl01")
    # という形で呼び出す
    def run_sql(self, sql, row_is_dict=True):
        if not self._check_connection():
            return False
        cur = self.connection.cursor()
        # https://stackoverflow.com/questions/10252247/
        # how-do-i-get-a-list-of-column-names-from-a-psycopg2-cursor
        # カラム名がRenameされた場合も対応出来る形に処理を変更
        print(sql)
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
        cur.execute(sql)
        cols = [column[0] for column in cur.description]
        yield cols
        while True:
            rows = cur.fetchmany(size)
            if not rows:
                break

            yield rows

        cur.close()

    def execute_sql(self, sql):
        """ For executing any query requires commit action
        :param sql: SQL to be executed
        :return: Execution result
        """
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        # print(sql)
        res = cur.execute(sql)
        cur.close()
        self.connection.commit()

        return res

    # 現時点ではSQLをそのまま実行するだけ
    def select_table(self, sql):
        return self.run_sql(sql)

    def get_timezone(self):
        try:
            _, rows = self.run_sql('show timezone')
            tz_offset = str(rows[0]['TimeZone'])
            return tz_offset
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

    def is_timezone_hold_column(self, tbl, col):
        data_type = self.get_data_type_by_colname(tbl, col)

        if 'WITH TIME ZONE' in data_type.upper():
            return True

        return False
