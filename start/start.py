import os
import socket as s
import sys
import webbrowser

from flask import Flask, jsonify, render_template


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

    print(application_path)
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
