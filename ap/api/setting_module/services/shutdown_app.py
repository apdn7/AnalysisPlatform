import os
from time import sleep

from flask import request
from loguru import logger

from ap.common.constants import AnnounceEvent
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventQueue, EventShutDown
from ap.script.disable_terminal_close_button import close_terminal


@log_execution_time()
def shut_down_app():
    logger.info('///////////// SHUTDOWN APP ///////////')
    EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.SHUT_DOWN))
    EventQueue.put(EventShutDown())
    logger.remove()
    sleep(5)

    # close terminal
    close_terminal()

    shutdown_function = request.environ.get('werkzeug.server.shutdown')
    if shutdown_function is not None:
        shutdown_function()

    os._exit(0)
