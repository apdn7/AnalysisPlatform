import csv
import os
import re

import numpy as np
import pandas as pd
from pandas import DataFrame

from ap.common.common_utils import detect_encoding
from ap.common.pydn.dblib import oracle

import logging

logger = logging.getLogger(__name__)


TBL_DEF_FILE = "E:\\Transfer\\Transfer\\FPT_ETL_Project\\02. Document\\01_From Denso\\tables_oracle.txt"
DATA_FOLDER = "E:\\Transfer\\Transfer\\Gasoline_eFA"
TBL_MONTHS = ["201909", "202004"]
MAX_RECORD_PER_TBL = 1_000_000


# ########## DROPS AND CREATE TABLES################
def connect_oracle():
    # db = oracle.Oracle(host="localhost", service_name="ORACLE", username="rainbow", password="rainbow_7")
    # db = oracle.Oracle(host="localhost", service_name="ORCL", username="system", password="rainbow_7")
    db = oracle.Oracle(host="localhost", service_name="ORACLE", username="PDBADMIN", password="rainbow_7")
    db.port = 1522
    connection = db.connect()
    db.dump()
    return db, connection


def read_ddl(fpath, partitions):
    regex_table_yyyymm = r"TABLE_NAME:\s*(\w+)_(\d{6})"
    regex_table = r"TABLE_NAME:\s*(\w+)"
    regex_column = r"^\s(\w+)\s*\,\s*(\w+)"
    logger.info(fpath)
    dic_ddl = {}
    columns = []

    # get encoding
    encoding = detect_encoding(fpath)

    with open(fpath, "r", encoding=encoding) as f:
        for line in f.readlines():
            # get table name
            match = re.search(regex_table_yyyymm, line)
            if match and match.group(1) and match.group(2):
                columns = []
                for partition in partitions:
                    table = match.group(1) + "_" + partition
                    dic_ddl[table] = columns
                continue

            match = re.search(regex_table, line)
            if match and match.group(1):
                columns = []
                table = match.group(1)
                dic_ddl[table] = columns
                continue

            # get columns
            match = re.search(regex_column, line)
            if match and match.group(1) and match.group(2):
                data_type = match.group(2)
                if "char" in data_type.lower():
                    data_type = add_col_len(data_type)
                columns.append((match.group(1), data_type))

    return dic_ddl


def add_col_len(data_type, char_len=2000):
    return f"{data_type}({char_len})"


def create_table_sql(dic_ddl):
    create_table_str = "CREATE TABLE {}({})"
    for table, columns in dic_ddl.items():
        yield create_table_str.format(table, ",".join([" ".join(col) for col in columns]))


def exe_create_table(sqls):
    db, *_ = connect_oracle()
    try:
        for sql in sqls:
            db.execute_sql(sql)
    finally:
        db.disconnect()


def exe_drop_all_tables(tbls):
    db, *_ = connect_oracle()
    try:
        for tbl in tbls:
            db.drop_table(tbl)
    finally:
        db.disconnect()


# ########## IMPORT DATA ################


def read_data(f_name, max_rec=None, delimiter="\t"):
    count = 0

    # get encoding
    encoding = detect_encoding(f_name)

    with open(f_name, "r", encoding=encoding) as f:
        for line in csv.reader(f, delimiter=delimiter):
            if max_rec and count >= max_rec:
                logger.info("MAX RECORDS!")
                break

            yield line
            count += 1


def run_insert_chunk(conn, tbl_name, headers, rows):
    vals_str = ",".join([f":{col}" for col in headers])
    cols_str = ",".join(headers)
    sql_str = f"INSERT INTO {tbl_name}({cols_str}) values({vals_str})"

    with conn.cursor() as cursor:
        # execute the insert statement
        cursor.executemany(sql_str, rows)
        # commit work
        conn.commit()


def insert_all_files(folder_path):
    data_dir = os.path.join(DATA_FOLDER, folder_path)
    files = os.listdir(data_dir)
    db, conn = connect_oracle()
    for f_name in files:
        insert_file(db, conn, data_dir, f_name)

    db.disconnect()


def insert_file(db, conn, data_dir, f_name):
    table_name = f_name[0:-4]
    logger.info("FILE:", f_name)
    f_path = os.path.join(data_dir, f_name)
    df = read_df(f_path)
    if df is None:
        logger.info(f"{table_name} : No data !!!")
        return False

    table_cols = db.list_table_columns(table_name)
    valid_cols = []
    for dic_col in table_cols:
        if dic_col["name"] in df.columns:
            valid_cols.append(dic_col)
            if "date" in str(dic_col["type"]).lower():
                df[dic_col["name"]] = pd.to_datetime(df[dic_col["name"]])

    valid_col_names = [col["name"] for col in valid_cols]

    try:
        run_insert_chunk(conn, table_name, valid_col_names, df[valid_col_names].to_numpy().tolist())
    except Exception as e:
        logger.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Insert error in table :", table_name)
        logger.info(e)

    return True


def read_df(f_path):
    # get encoding
    encoding = detect_encoding(f_path)

    df: DataFrame = pd.read_csv(
        f_path,
        sep="\t",
        skipinitialspace=True,
        on_bad_lines='skip',
        encoding=encoding,
        skip_blank_lines=True,
        skiprows=1,
        nrows=MAX_RECORD_PER_TBL,
    )

    df.drop(df.tail(1).index, inplace=True)
    if not len(df):
        return None

    for col in df.columns:
        if df[col].dtype.name in ["object", "string", "str"]:
            idxs = df[col].notna()
            df.loc[idxs, col] = df.loc[idxs, col].astype(str).str.replace("'", "", regex=False)

    df = df.replace({np.nan: None})

    return df


# ########## MAIN ################
if __name__ == "__main__":
    # create tables
    dic_ddl = read_ddl(TBL_DEF_FILE, TBL_MONTHS)
    exe_drop_all_tables(dic_ddl.keys())
    sql = create_table_sql(dic_ddl)
    exe_create_table(sql)

    # insert data
    for folder in TBL_MONTHS:
        # insert_df(folder)
        insert_all_files(folder)

    logger.info("DONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
