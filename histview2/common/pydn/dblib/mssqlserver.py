#!/usr/bin/python3
# -*- coding: utf-8 -*-
# Author: Masato Yasuda (2018/01/04)

import traceback

from dateutil import parser
from pymssql import connect as mssqlconnect

from histview2.common.common_utils import strip_all_quote


# import pyodbc


class MSSQLServer:

    def __init__(self, host, dbname, username, password):
        self.host = host
        self.port = 1433
        self.dbname = dbname
        self.username = username
        self.password = password
        self._schema = None
        self._schema_withdot = ''
        self.is_connected = False
        self.connection = None
        self._table_views = None

    @property
    def schema(self):
        return self._schema

    @schema.setter
    def schema(self, value):
        if value:
            self._schema = value
            self._schema_withdot = f'"{value}".'
        else:
            self._schema = None
            self._schema_withdot = ''

    def dump(self):
        print("===== DUMP RESULT =====")
        print("DB Type: MS SQL Server")
        print("self.host: " + self.host)
        print("self.port: " + str(self.port))
        print("self.dbname: " + self.dbname)
        print("self.username: " + self.username)
        print("self.schema: " + str(self.schema or ''))
        print("self.is_connected: ", self.is_connected)
        print("=======================")

    def connect(self):
        # dsn = "Driver={{ODBC Driver 17 for SQL Server}};Server={0:s};".format(self.host)
        # dsn += "Database={0:s};".format(self.dbname)
        # dsn += "PORT={0:d};".format(self.port)
        # dsn += "ClientCharset=UTF-8;"
        # dsn += "UID={0:s};".format(self.username)
        # dsn += "PWD={0:s}".format(self.password)
        # dsn += ';Trusted_Connection=No;'
        try:
            # self.connection = pyodbc.connect(dsn)
            self.connection = mssqlconnect(self.host, self.username, self.password, self.dbname,
                                           port=self.port, login_timeout=3)

            # if alredy use default schema , set to None to avoid replace schema
            self.is_connected = True
            if self.schema:
                if self.schema == self.get_default_schema():
                    self.schema = None

                if self.schema:
                    schemas = self.get_all_schema()
                    self.is_connected = self._schema in schemas

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

    def get_default_schema(self):
        if not self._check_connection():
            return None

        cur = self.connection.cursor()
        cur.execute('select SCHEMA_NAME()')
        rows = cur.fetchall()
        cur.close()
        return rows[0][0]

    def get_all_schema(self):
        cur = self.connection.cursor()
        cur.execute('select schema_name from information_schema.schemata')
        rows = cur.fetchall()
        rows = [col[0] for col in rows]
        print('rows', rows)
        cur.close()
        return rows

    # As of now, create_table, drop_table, and intert_table aren't added
    # because we want to use tables of MS SQL Server as "Read-only"
    def create_table(self, tblname, valtypes):
        if not self._check_connection():
            return False
        sql = f'create table {self._schema_withdot}{tblname} ('

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
        # Only list tables of default schema (default schema name can be got by "SCHEMA_NAME()")
        schema = f"'{self._schema}'" if self._schema else 'SCHEMA_NAME()'
        sql = f"select name from sys.objects where type='U' and SCHEMA_NAME(schema_id)={schema}"
        print('sql', sql)
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
        schema = f"'{self._schema}'" if self._schema else 'SCHEMA_NAME()'
        sql = f"select name from sys.objects where SCHEMA_NAME(schema_id)={schema} and (type='U' or type='V')"
        print('sql', sql)
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
        sql = f'drop table if exists {self._schema_withdot}{tblname}'
        cur = self.connection.cursor()
        cur.execute(sql)
        cur.close()
        self.connection.commit()
        print(tblname + " dropped!")

    # テーブルのカラムのタイプを辞書の配列として返す(元々はtbl_get_valtypes関数)
    # columns:
    #  name => カラム名,
    #  type => カラムタイプ
    def list_table_columns(self, tblname):
        if not self._check_connection():
            return False

        schema = f"'{self._schema}'" if self._schema else 'SCHEMA_NAME()'
        sql = f"""select o.name table_name,c.name column_name,type_name(c.user_type_id) column_type
                 from sys.columns c 
                 inner join sys.objects o on c.object_id = o.object_id 
                 where SCHEMA_NAME(o.schema_id)={schema} and o.name=N'{tblname}'"""
        print('sql', sql)

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

    def get_data_type_by_colname(self, tbl, col_name):
        col_name = strip_all_quote(col_name)
        cols = self.list_table_columns(tbl)
        data_type = [col['type'] for col in cols if col['name'] == col_name]
        return data_type[0] if data_type else None

    # list_table_columnsのうちcolumn nameだけ必要な場合(元はtbl_get_colnames)
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

        sql_template = f'insert into {self._schema_withdot}{tblname}'

        # Generate column names fields
        sql_template += "("
        for idx, name in enumerate(names):
            if idx > 0:
                sql_template += ","
            sql_template += name
        sql_template += ") "

        # Generate values field
        sql_template += "values "
        sql = sql_template
        end_index = len(values) - 1
        start_batch = True
        for idx1, value in enumerate(values):
            if not start_batch:
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

            start_batch = False

            if idx1 > 0 and (idx1 % 999 == 0 or idx1 == end_index):
                cur = self.connection.cursor()
                sql = self._add_schema_to_sql(sql)
                cur.execute(sql)
                cur.close()
                self.connection.commit()
                sql = sql_template
                start_batch = True
        print("Dummy data was inserted to " + tblname)

    # SQLをこのまま実行
    # [以下、結果をDict形式で返す方法]
    # https://stackoverflow.com/questions/16519385/
    # output-pyodbc-cursor-results-as-python-dictionary
    # cols, rows = db1.run_sql("select * from tbl01")
    # という形で呼び出す
    def run_sql(self, sql, row_is_dict=True):
        if not self._check_connection():
            return False
        cur = self.connection.cursor()
        sql = self._add_schema_to_sql(sql)
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
        sql = self._add_schema_to_sql(sql)
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
            rows = self.run_sql('SELECT SYSDATETIMEOFFSET() AS SYSDATETIME')
            sys_dt_str = rows[1][0]['SYSDATETIME']
            sys_datetime = parser.parse(sys_dt_str)
            return sys_datetime.tzinfo
        except:
            return None

    # private functions
    def _check_connection(self):
        if self.is_connected:
            return True
        # 接続していないなら
        print("Connection is not Initialized. Please run connect() to connect to DB")
        return False

    def execute_sql(self, sql):
        """ For executing any query requires commit action
        :param sql: SQL to be executed
        :return: Execution result
        """
        if not self._check_connection():
            return False

        cur = self.connection.cursor()
        sql = self._add_schema_to_sql(sql)
        res = cur.execute(sql)
        cur.close()
        self.connection.commit()

        return res

    def _add_schema_to_sql(self, sql):
        """
        add schema to sql
        """
        if not self._schema:
            return sql

        if not self._table_views:
            self._table_views = self.list_tables_and_views()

        print('tables', self._table_views)

        for table in self._table_views:
            sql = sql.replace(f'"{table}"', f'{self._schema_withdot}"{table}"')

        return sql

    def is_timezone_hold_column(self, tbl, col):
        data_type = self.get_data_type_by_colname(tbl, col)

        if data_type and 'DATETIMEOFFSET' in data_type.upper():
            return True

        return False
