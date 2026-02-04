"""
Summarized by AI

This script performance tests concurrent data fetching from PostgreSQL, Oracle, MySQL, and SQL Server.
It spawns multiple worker processes per database that execute SELECT *,
fetch data in 10k-row chunks using fetchmany(),
write chunks to temporary files, then immediately delete them.

PostgreSQL and MySQL use optimized server-side/streaming cursors.
Progress is tracked with tqdm.
"""

import os
import tempfile
from concurrent.futures import ProcessPoolExecutor

from pymysql.cursors import SSCursor
from tqdm import tqdm

import psycopg2  # PostgreSQL
import oracledb  # Oracle
import pymysql  # MySQL
import pymssql  # SQL Server


# -------------------------------------------------------------------
# Database connection configuration
# -------------------------------------------------------------------
DB_CONFIG = {
    'postgres': {
        'type': 'postgres',
        'connect': lambda: psycopg2.connect(
            host='192.168.1.58',
            port=5432,
            user='postgres',
            password='rainbow_7',
            database='postgres',
        ),
        'table': 'test_table',
        'pool_size': 5,
    },
    'oracle': {
        'type': 'oracle',
        'connect': lambda: oracledb.connect(
            user='oracle_user',
            password='rainbow_7',
            dsn=oracledb.makedsn('192.168.1.58', 1524, service_name='ORACLE'),
        ),
        'table': 'TEST_TABLE',
        'pool_size': 10,
    },
    'mysql': {
        'type': 'mysql',
        'connect': lambda: pymysql.connect(
            host='192.168.1.58',
            user='mysql',
            password='rainbow_7',
            db='mysql',
            port=3306,
            charset='utf8',
        ),
        'table': 'test_table',
        'pool_size': 5,
    },
    'mssql': {
        'type': 'mssql',
        'connect': lambda: pymssql.connect(
            server='192.168.1.58',
            user='SA',
            password='rainbow_7',
            database='master',
            port=1433,
        ),
        'table': 'dbo.test_table',
        'pool_size': 5,
    },
}


def worker_postgres_with_server_side_cursor(db_key):
    """Executes SELECT * using a named server-side cursor with itersize=2000."""
    print(f'[{db_key}] Worker starting...')

    conn = DB_CONFIG[db_key]['connect']()
    # Create a named cursor for server-side cursor functionality
    cursor = conn.cursor(name=f'server_side_cursor_{os.getpid()}')
    cursor.itersize = 2000

    cursor.execute(f'SELECT * FROM {DB_CONFIG[db_key]["table"]}')

    fetch_size = 10_000
    chunk_id = 0

    # tqdm without total because we may not know row count upfront
    pbar = tqdm(desc=f'[{db_key}] Chunks', unit='chunk')

    while True:
        rows = cursor.fetchmany(fetch_size)
        if not rows:
            break

        # Create a temp file
        fd, path = tempfile.mkstemp(prefix=f'{db_key}_chunk_{chunk_id}_', suffix='.txt')
        os.close(fd)

        # Write rows to file
        with open(path, 'w', encoding='utf8') as f:
            for row in rows:
                f.write(str(row) + '\n')

        # Delete file immediately
        os.remove(path)

        chunk_id += 1
        pbar.update(1)  # one chunk processed

    pbar.close()
    cursor.close()
    conn.close()
    print(f'[{db_key}] Worker finished.')


def worker_mysql_with_streaming_cursor(db_key):
    """Executes SELECT * using a named server-side cursor with itersize=2000."""
    print(f'[{db_key}] Worker starting...')

    conn = DB_CONFIG[db_key]['connect']()
    cursor = conn.cursor(SSCursor)

    cursor.execute(f'SELECT * FROM {DB_CONFIG[db_key]["table"]}')

    fetch_size = 10_000
    chunk_id = 0

    # tqdm without total because we may not know row count upfront
    pbar = tqdm(desc=f'[{db_key}] Chunks', unit='chunk')

    while True:
        rows = cursor.fetchmany(fetch_size)
        if not rows:
            break

        # Create a temp file
        fd, path = tempfile.mkstemp(prefix=f'{db_key}_chunk_{chunk_id}_', suffix='.txt')
        os.close(fd)

        # Write rows to file
        with open(path, 'w', encoding='utf8') as f:
            for row in rows:
                f.write(str(row) + '\n')

        # Delete file immediately
        os.remove(path)

        chunk_id += 1
        pbar.update(1)  # one chunk processed

    pbar.close()
    cursor.close()
    conn.close()
    print(f'[{db_key}] Worker finished.')


# -------------------------------------------------------------------
# Worker function for multiprocessing
# -------------------------------------------------------------------
def worker_task(db_key):
    """Executes SELECT *, dumps rows in chunks of 10k to temporary files with progress."""
    print(f'[{db_key}] Worker starting...')

    conn = DB_CONFIG[db_key]['connect']()
    cursor = conn.cursor()

    cursor.execute(f'SELECT * FROM {DB_CONFIG[db_key]["table"]}')

    fetch_size = 10_000
    chunk_id = 0

    # tqdm without total because we may not know row count upfront
    pbar = tqdm(desc=f'[{db_key}] Chunks', unit='chunk')

    while True:
        rows = cursor.fetchmany(fetch_size)
        if not rows:
            break

        # Create a temp file
        fd, path = tempfile.mkstemp(prefix=f'{db_key}_chunk_{chunk_id}_', suffix='.txt')
        os.close(fd)

        # Write rows to file
        with open(path, 'w', encoding='utf8') as f:
            for row in rows:
                f.write(str(row) + '\n')

        # Delete file immediately
        os.remove(path)

        chunk_id += 1
        pbar.update(1)  # one chunk processed

    pbar.close()
    cursor.close()
    conn.close()
    print(f'[{db_key}] Worker finished.')


def run_all_databases():
    total_pool_size = sum(d['pool_size'] for d in DB_CONFIG.values())

    with ProcessPoolExecutor(max_workers=total_pool_size) as executor:
        for db_key in DB_CONFIG:
            print(f'=== Starting multiprocessing for {db_key} ===')
            for _ in range(DB_CONFIG[db_key]['pool_size']):
                if db_key == 'postgres':
                    executor.submit(worker_postgres_with_server_side_cursor, db_key)
                elif db_key == 'mysql':
                    executor.submit(worker_mysql_with_streaming_cursor, db_key)
                else:
                    executor.submit(worker_task, db_key)


if __name__ == '__main__':
    run_all_databases()
