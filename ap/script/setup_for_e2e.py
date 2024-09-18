import re
import os
import shutil
import socket
import sys
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


def clear_old_screenshot_folders():
    for folder in SCREEN_SHOT_FOLDER.glob('*'):
        if not folder.is_dir():
            continue
        access_time = folder.stat().st_atime
        current_time = time.time()
        one_day = 24 * 60 * 60  # seconds
        if current_time - access_time > one_day:
            shutil.rmtree(folder)


def create_screenshot_folder(branch_name: str):
    # https://github.com/django/django/blob/cdcd604ef8f650533eff6bd63a517ebb4ffddf96/django/utils/text.py#L452C1-L469C53
    sanitized_name = str(branch_name)
    sanitized_name = unicodedata.normalize("NFKC", sanitized_name)
    sanitized_name = re.sub(r"[^\w\s-]", "", sanitized_name.lower())
    sanitized_name = re.sub(r"[-\s]+", "-", sanitized_name).strip("-_")

    screenshot_folder = SCREEN_SHOT_FOLDER / sanitized_name
    screenshot_folder.mkdir(parents=True, exist_ok=True)
    print(f"Screenshot folder is: {screenshot_folder}")

    # change this to cypress config
    with E2E_CONFIG_FILE.open('r+') as f:
        text = f.read()
        text = re.sub(
            r"screenshotsFolder: .*,", re.escape(f"screenshotsFolder:'{screenshot_folder.as_posix()}',"), text
        )
        f.seek(0)
        f.write(text)


def find_unused_port() -> int:
    sock = socket.socket()
    sock.bind(('', 0))
    return sock.getsockname()[1]


def change_port_for_web() -> None:
    unused_port = find_unused_port()
    with INIT_BASIC_CONFIG_FILE.open('r+') as f:
        text = f.read()
        text = re.sub(r'- port-no: \d+', f'- port-no: {unused_port}', text)
        f.seek(0)
        f.write(text)

    with E2E_CONFIG_FILE.open('r+') as f:
        text = f.read()
        text = re.sub(r"baseUrl: 'http://localhost:\d+'", f"baseUrl: 'http://localhost:{unused_port}'", text)
        f.seek(0)
        f.write(text)


def replace_basic_config_file() -> None:
    shutil.copy(INIT_BASIC_CONFIG_FILE, BASIC_CONFIG_FILE)


def copy_tests_instance_to_instance_folder() -> None:
    if os.path.isdir(INSTANCE_FOLDER):
        shutil.rmtree(INSTANCE_FOLDER)

    shutil.copytree(E2E_INSTANCE_FOLDER, INSTANCE_FOLDER)


def setup(branch_name: str) -> None:
    clear_old_screenshot_folders()
    create_screenshot_folder(branch_name)
    change_port_for_web()
    replace_basic_config_file()
    copy_tests_instance_to_instance_folder()


if __name__ == '__main__':
    branch_name = sys.argv[1]
    setup(branch_name)
