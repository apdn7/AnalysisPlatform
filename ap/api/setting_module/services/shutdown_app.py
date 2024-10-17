import logging
import os
from time import sleep

from flask import request

from ap import SHUTDOWN, dic_config
from ap.common.logger import log_execution_time
from ap.common.services.sse import AnnounceEvent, background_announcer
from ap.script.disable_terminal_close_button import close_terminal


@log_execution_time()
def shut_down_app():
    print('///////////// SHUTDOWN APP ///////////')
    background_announcer.announce(True, AnnounceEvent.SHUT_DOWN.name)
    dic_config[SHUTDOWN] = True
    logging.shutdown()
    sleep(5)

    # close terminal
    close_terminal()

    shutdown_function = request.environ.get('werkzeug.server.shutdown')
    if shutdown_function is not None:
        shutdown_function()

    os._exit(0)
