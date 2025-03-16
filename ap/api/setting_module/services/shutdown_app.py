import logging
import os
from time import sleep

from flask import request

from ap.common.constants import AnnounceEvent
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventQueue, EventShutDown

logger = logging.getLogger(__name__)


@log_execution_time()
def shut_down_app():
    logger.info('///////////// SHUTDOWN APP ///////////')
    EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.SHUT_DOWN))
    EventQueue.put(EventShutDown())
    logging.shutdown()
    sleep(5)

    shutdown_function = request.environ.get('werkzeug.server.shutdown')
    if shutdown_function is not None:
        shutdown_function()

    os._exit(0)
