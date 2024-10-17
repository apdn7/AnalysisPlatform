from __future__ import annotations

import re
import os
import shutil
import socket
import time
from pathlib import Path
import unicodedata

SCREEN_SHOT_FOLDER = Path('C:/') / 'workspace' / 'CICD' / 'frontend' / 'screenshot'
ROOT_PATH = Path(__file__).parent.parent.parent
INIT_BASIC_CONFIG_FILE = ROOT_PATH / 'init' / 'basic_config.yml'
BASIC_CONFIG_FILE = ROOT_PATH / 'ap' / 'config' / 'basic_config.yml'
E2E_CONFIG_FILE = ROOT_PATH / 'tests' / 'e2e' / 'cypress.config.js'
E2E_INSTANCE_FOLDER = ROOT_PATH / 'tests' / 'e2e' / 'instance'
INSTANCE_FOLDER = ROOT_PATH / 'instance'
AP_BASIC_CONFIG_FILE = ROOT_PATH / 'ap' / 'config' / 'basic_config.yml'
SCREEN_SHOT_FOLDER_LOCAL = ROOT_PATH / 'tests' / 'e2e' / 'cypress' / 'screenshots'


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
    print(f"Screenshot folder ('{folder_path}') is updated in '{E2E_CONFIG_FILE}' file.")


def create_screenshot_folder(branch_name: str) -> Path:
    # https://github.com/django/django/blob/cdcd604ef8f650533eff6bd63a517ebb4ffddf96/django/utils/text.py#L452C1-L469C53
    sanitized_name = str(branch_name)
    sanitized_name = unicodedata.normalize("NFKC", sanitized_name)
    sanitized_name = re.sub(r"[^\w\s-]", "", sanitized_name.lower())
    sanitized_name = re.sub(r"[-\s]+", "-", sanitized_name).strip("-_")

    screenshot_folder = SCREEN_SHOT_FOLDER / sanitized_name
    screenshot_folder.mkdir(parents=True, exist_ok=True)
    print(f"Screenshot folder is: '{screenshot_folder}'.")
    return screenshot_folder


def create_screenshot_folder_local() -> Path:
    screenshot_folder = SCREEN_SHOT_FOLDER_LOCAL
    screenshot_folder.mkdir(parents=True, exist_ok=True)
    print(f"Screenshot folder is: '{screenshot_folder}'.")
    return screenshot_folder


def find_unused_port() -> int:
    sock = socket.socket()
    sock.bind(('', 0))
    port = sock.getsockname()[1]
    print(f"Web port is: {port}")
    return port


def change_port_in_basic_config(basic_config_path: Path, new_port: int) -> None:
    with basic_config_path.open('r+') as file:
        content = file.read()
        content = re.sub(r'- port-no: \d+', f'- port-no: {new_port}', content)
        file.seek(0)
        file.write(content)
    print(f"Web port {new_port} is updated in '{basic_config_path}' file.")


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
    print(f"Web port {port} is updated in '{E2E_CONFIG_FILE}' file.")


def get_web_port() -> int | None:
    file_path = AP_BASIC_CONFIG_FILE if os.path.exists(AP_BASIC_CONFIG_FILE) else INIT_BASIC_CONFIG_FILE
    with file_path.open('r') as f:
        text = f.read()
        match = re.match(r'.*port-no: (\d+).*', text.replace('\n', ' '))

    port = None
    if match:
        port = int(match.group(1))

    print(f"Web port is: {port}")
    return port


def replace_basic_config_file() -> None:
    shutil.copy(INIT_BASIC_CONFIG_FILE, BASIC_CONFIG_FILE)


def copy_tests_instance_to_instance_folder() -> None:
    if os.path.isdir(INSTANCE_FOLDER):
        shutil.rmtree(INSTANCE_FOLDER)
        print(f"'{INSTANCE_FOLDER}' folder is removed.")

    shutil.copytree(E2E_INSTANCE_FOLDER, INSTANCE_FOLDER)
    print(f"Copied '{E2E_INSTANCE_FOLDER}' folder to '{INSTANCE_FOLDER}' folder")


def setup(branch_name: str | None) -> None:
    if branch_name:
        replace_basic_config_file()
        clear_old_screenshot_folders()
        web_port = find_unused_port()
        screenshots_folder = create_screenshot_folder(branch_name)
    else:
        web_port = get_web_port()
        screenshots_folder = create_screenshot_folder_local()

    change_port_for_web(web_port, is_local=not branch_name)
    change_screenshots_folder(screenshots_folder)
    copy_tests_instance_to_instance_folder()


if __name__ == '__main__':
    pipe_line_branch_name = os.getenv('CI_COMMIT_BRANCH')
    merge_request_source_branch = os.getenv('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME')
    branch_name = pipe_line_branch_name or merge_request_source_branch
    setup(branch_name)
