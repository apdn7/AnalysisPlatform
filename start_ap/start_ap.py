import datetime
import logging
import os
import socket as s
import sys
import time
import webbrowser
from enum import Enum, auto
from threading import Thread

from flask import Flask, jsonify, render_template
from Lib import subprocess
from ruamel import yaml


class StageNames(Enum):
    MAIN = auto()
    PYTHON_EMBEDDED = auto()
    PIP_DOWNLOAD = auto()
    PIP_INSTALL = auto()
    ORACLE_INSTANCE = auto()


class StageErrorCodes(Enum):
    INSUFFICIENT_FREE_SPACE = 100
    PORT_NOT_AVAILABLE = 101
    NETWORK_NOT_AVAILABLE = 102
    PYTHON_EMBEDDED = 200
    PIP_DOWNLOAD = 201
    PIP_INSTALL = 202
    ORACLE_INSTANCE = 210
    TIMEOUT = 999


logger = logging.getLogger(__name__)
with open(r'.\start_ap\startup_errors.yaml', 'rb') as stream:
    startup_stages = yaml.load(stream, Loader=yaml.SafeLoader)
    stream.close()
main_pid = None


def check_available_port(port):
    port = int(port)
    sock = s.socket(s.AF_INET, s.SOCK_STREAM)
    sock.settimeout(5)

    result = False
    try:
        result = sock.connect_ex(('127.0.0.1', port))
    except Exception:
        pass
    finally:
        sock.close()
    return bool(result)


def get_node(dict_obj, key, default_val=None):
    node = dict_obj
    node = node.get(key, default_val)

    return node


def get_app_path():
    """
    get application path
    :return:
    """
    application_path = ''
    if getattr(sys, 'frozen', False):
        application_path = os.path.dirname(sys.executable)
    elif __file__:
        application_path = os.path.dirname(__file__)

    logger.info(application_path)
    return application_path


def open_error_page():
    """
    open static page if the port is unavailable
    :return:
    """
    app_path = get_app_path()
    error_page = f'file:///{app_path}/error.html'
    webbrowser.open_new_tab(error_page)


def get_error():
    """
    get errors from installer
    :errors The Errors ID
    :msg Message in case of could not open and read stage status file
    """
    app_path = get_app_path()
    stage_log = os.path.join(app_path, 'stage_status.log')
    # todo: use yaml to configure error header, message
    # error_config = os.path.join(app_path, 'config', 'startup_error.yaml')
    msg = ''
    error_stage = None
    try:
        # Attempt to open and read the file
        with open(stage_log, 'r') as file:
            error_stage = file.read().rstrip()
            error_stage = str(error_stage)
            file.close()
    except FileNotFoundError:
        # Handle the error
        msg = 'File not found'
    except PermissionError:
        # Handle the permission error
        msg = 'Permission denied'
    finally:
        return error_stage, msg


def create_app():
    if getattr(sys, 'frozen', False):
        template_folder = os.path.join(sys._MEIPASS, 'templates')
        static_folder = os.path.join(sys._MEIPASS, 'static')
        app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
    else:
        app = Flask(__name__)

    @app.route('/')
    def index():
        return render_template('start.html')

    @app.route('/error')
    def error():
        error_id, _ = get_error()
        return render_template('error.html', error_id=error_id)

    @app.route('/stages', methods=['GET'])
    def stages():
        error_id, msg = get_error()
        return jsonify({'status': error_id, 'message': msg}), 200

    @app.route('/timeout_check', methods=['GET'])
    def timeout_check():
        app_path = get_app_path()
        stage_log = os.path.join(app_path, 'stage_start_time.log')
        msg = ''
        try:
            # Attempt to open and read the file
            with open(stage_log, 'rb') as f:
                try:  # catch OSError in case of a one line file
                    f.seek(-2, os.SEEK_END)
                    while f.read(1) != b'\n':
                        f.seek(-2, os.SEEK_CUR)
                except OSError:
                    f.seek(0)
                pid, latest_stage, latest_stage_start_time = f.readline().decode().rstrip().split('-')
                latest_stage_start_time_dt = datetime.datetime.strptime(latest_stage_start_time, '%Y/%m/%d %H:%M:%S.%f')
                f.close()
            if latest_stage == StageNames.MAIN:
                global main_pid
                main_pid = pid
                return jsonify({'status': '', 'message': msg}), 200
            elapsed_time = datetime.datetime.now() - latest_stage_start_time_dt
            stage = get_node(startup_stages, latest_stage)
            stage_timeout = stage.get('timeout', None)
            if stage_timeout and elapsed_time.seconds > stage_timeout:
                subprocess.run(f'taskkill /F /pid {pid}')  # kill download or installation process
                subprocess.run(f'taskkill /F /pid {main_pid}')  # kill main cmd process
                with open('stage_status.log', 'w') as f:
                    f.write(str(StageErrorCodes.TIMEOUT.value))
                    f.close()
                return jsonify({'status': StageErrorCodes.TIMEOUT.value, 'message': msg}), 200
            else:
                return jsonify({'status': '', 'message': msg}), 200

        except FileNotFoundError:
            # Handle the error
            msg = 'File not found'
            return jsonify({'status': '', 'message': msg}), 200
        except PermissionError:
            # Handle the permission error
            msg = 'Permission denied'
            return jsonify({'status': '', 'message': msg}), 200
        except Exception as e:
            return jsonify({'status': '', 'message': str(e)}), 200

    @app.route('/shutdown', methods=['GET'])
    def shutdown():
        def shutdown_app():
            time.sleep(3)
            os._exit(0)

        thread = Thread(target=shutdown_app)
        thread.start()
        return jsonify({'status': '', 'message': 'App shutdown'}), 200

    return app


port = sys.argv[1] if len(sys.argv) > 1 else 5000  # flask default port
# verify available port
is_available_port = check_available_port(port)
if not is_available_port:
    open_error_page()
    sys.exit()

app = create_app()
if __name__ == '__main__':
    app.run(port=port, debug=False)
