
import re
import shutil
import socket
import sqlite3
import time
from pathlib import Path

import unicodedata
from dotenv import dotenv_values


import os

SCREEN_SHOT_FOLDER = Path('C:/') / 'workspace' / 'CICD' / 'frontend' / 'screenshot'
ROOT_PATH = Path(__file__).parent.parent.parent
INIT_BASIC_CONFIG_FILE = ROOT_PATH / 'init' / 'basic_config.yml'
BASIC_CONFIG_FILE = ROOT_PATH / 'ap' / 'config' / 'basic_config.yml'
E2E_CONFIG_FILE = ROOT_PATH / 'tests' / 'e2e' / 'cypress.config.js'
E2E_INSTANCE_FOLDER = ROOT_PATH / 'tests' / 'e2e' / 'instance'
INSTANCE_FOLDER = ROOT_PATH / 'instance'
AP_BASIC_CONFIG_FILE = ROOT_PATH / 'ap' / 'config' / 'basic_config.yml'
SCREEN_SHOT_FOLDER_LOCAL = ROOT_PATH / 'tests' / 'e2e' / 'cypress' / 'screenshots'
E2E_DATABASE_DIR = E2E_INSTANCE_FOLDER / 'app.sqlite3'
INIT_DATABASE = ROOT_PATH / 'init' / 'app.sqlite3'

from loguru import logger

def clear_old_screenshot_folders() -> None:
    for folder in SCREEN_SHOT_FOLDER.glob('*'):
        if not folder.is_dir():
            continue
        access_time = folder.stat().st_atime
        current_time = time.time()
        one_day = 24 * 60 * 60  # seconds
        if current_time - access_time > one_day:
            shutil.rmtree(folder)


def change_screenshots_folder(screenshots_folder: Path):
    # change this to cypress config
    folder_path = re.escape(screenshots_folder.as_posix())
    with E2E_CONFIG_FILE.open('r+') as f:
        text = f.read()
        text = re.sub(r"screenshotsFolder: .*,", f"screenshotsFolder: '{folder_path}',", text)
        f.seek(0)
        f.write(text)
    logger.info(f"Screenshot folder ('{folder_path}') is updated in '{E2E_CONFIG_FILE}' file.")


def create_screenshot_folder(branch_name: str) -> Path:
    # https://github.com/django/django/blob/cdcd604ef8f650533eff6bd63a517ebb4ffddf96/django/utils/text.py#L452C1-L469C53
    sanitized_name = str(branch_name)
    sanitized_name = unicodedata.normalize("NFKC", sanitized_name)
    sanitized_name = re.sub(r"[^\w\s-]", "", sanitized_name.lower())
    sanitized_name = re.sub(r"[-\s]+", "-", sanitized_name).strip("-_")

    screenshot_folder = SCREEN_SHOT_FOLDER / sanitized_name
    screenshot_folder.mkdir(parents=True, exist_ok=True)
    logger.info(f"Screenshot folder is: '{screenshot_folder}'.")
    return screenshot_folder


def create_screenshot_folder_local() -> Path:
    screenshot_folder = SCREEN_SHOT_FOLDER_LOCAL
    screenshot_folder.mkdir(parents=True, exist_ok=True)
    logger.info(f"Screenshot folder is: '{screenshot_folder}'.")
    return screenshot_folder


def find_unused_port() -> int:
    sock = socket.socket()
    sock.bind(('', 0))
    port = sock.getsockname()[1]
    logger.info(f"Web port is: {port}")
    return port


def change_port_in_basic_config(basic_config_path: Path, new_port: int) -> None:
    with basic_config_path.open('r+') as file:
        content = file.read()
        content = re.sub(r'- port-no: \d+', f'- port-no: {new_port}', content)
        file.seek(0)
        file.write(content)
    logger.info(f"Web port {new_port} is updated in '{basic_config_path}' file.")


def change_port_for_web(port: int | None, is_local: bool = False) -> None:
    if not port:
        return

    if os.path.exists(AP_BASIC_CONFIG_FILE):
        change_port_in_basic_config(AP_BASIC_CONFIG_FILE, port)
    if not is_local or not os.path.exists(AP_BASIC_CONFIG_FILE):
        change_port_in_basic_config(INIT_BASIC_CONFIG_FILE, port)

    with E2E_CONFIG_FILE.open('r+') as f:
        text = f.read()
        text = re.sub(r"baseUrl: 'http://localhost:\d+'", f"baseUrl: 'http://localhost:{port}'", text)
        f.seek(0)
        f.write(text)
    logger.info(f"Web port {port} is updated in '{E2E_CONFIG_FILE}' file.")


def get_web_port() -> int | None:
    file_path = AP_BASIC_CONFIG_FILE if os.path.exists(AP_BASIC_CONFIG_FILE) else INIT_BASIC_CONFIG_FILE
    with file_path.open('r') as f:
        text = f.read()
        match = re.match(r'.*port-no: (\d+).*', text.replace('\n', ' '))

    port = None
    if match:
        port = int(match.group(1))

    logger.info(f"Web port is: {port}")
    return port


def replace_basic_config_file() -> None:
    shutil.copy(INIT_BASIC_CONFIG_FILE, BASIC_CONFIG_FILE)


def copy_tests_instance_to_instance_folder() -> None:
    if os.path.isdir(INSTANCE_FOLDER):
        shutil.rmtree(INSTANCE_FOLDER)
        logger.info(f"'{INSTANCE_FOLDER}' folder is removed.")

    shutil.copytree(E2E_INSTANCE_FOLDER, INSTANCE_FOLDER)
    logger.info(f"Copied '{E2E_INSTANCE_FOLDER}' folder to '{INSTANCE_FOLDER}' folder")


def change_root_dir_for_data_sources() -> None:
    # Only handle in case this node is a main node and have data test in C drive
    if os.environ.get('IS_LOCAL_DATA_TEST') != 'true':
        return

    table_name = 'cfg_data_source_csv'
    column_name = 'directory'

    old_string = '\\\\DA-SKY02'
    new_string = 'C:'
    sql_query = f"""
    UPDATE {table_name}
    SET {column_name} = REPLACE({column_name}, ?, ?)
    WHERE {column_name} LIKE '%' || ? || '%';
    """

    conn = None
    try:
        conn = sqlite3.connect(E2E_DATABASE_DIR)
        cursor = conn.cursor()

        cursor.execute(sql_query, (old_string, new_string, old_string))
        conn.commit()

        rows_affected = cursor.rowcount
        print(f"Changed to '${new_string}' in ${table_name} successfully! Affected rows: {rows_affected}")
    except sqlite3.Error as e:
        print(f"SQLite's Error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"Unknow Error: {e}")
    finally:
        if conn:
            conn.close()


def change_database_test_ip_for_data_sources() -> None:
    table_name = 'cfg_data_source_db'
    column_name = 'host'

    new_string = os.environ.get('TEST_HOST')
    if new_string is None:
        env_const = dotenv_values(dotenv_path='./tests/base.env')
        new_string = env_const.get('TEST_HOST')

    sql_query = f"""
    UPDATE {table_name}
    SET {column_name} = ?;
    """

    conn = None
    try:
        conn = sqlite3.connect(E2E_DATABASE_DIR)
        cursor = conn.cursor()

        cursor.execute(sql_query, (new_string,))
        conn.commit()

        rows_affected = cursor.rowcount
        print(f"Changed to '${new_string}' in ${table_name} successfully! Affected rows: {rows_affected}")
    except sqlite3.Error as e:
        print(f"SQLite's Error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"Unknow Error: {e}")
    finally:
        if conn:
            conn.close()

def copy_init_database_to_instance_folder() -> None:
    if not os.path.exists(INSTANCE_FOLDER):
        os.makedirs(INSTANCE_FOLDER)
    if os.path.isdir(INSTANCE_FOLDER):
        for filename in os.listdir(INSTANCE_FOLDER):
            file_path = os.path.join(INSTANCE_FOLDER, filename) # Construct the full file path

            # Check if the item is a file or a link before removing
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.remove(file_path) # Remove the file
                print(f"Removed: {filename}")
            if os.path.isdir(file_path):
                shutil.rmtree(file_path)
                print(f"Removed: {filename}")

    shutil.copy(INIT_DATABASE, INSTANCE_FOLDER)
    logger.info(f"Copied '{INIT_DATABASE}' to '{INSTANCE_FOLDER}' folder")
