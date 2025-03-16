import logging
import socket as s
import sys

from ap.common.common_utils import parse_int_value
from ap.common.logger import log_execution_time

logger = logging.getLogger(__name__)


@log_execution_time()
def check_available_port(port):
    port = parse_int_value(port)
    sock = s.socket(s.AF_INET, s.SOCK_STREAM)
    sock.settimeout(5)
    try:
        result = sock.connect_ex(('127.0.0.1', port))
        if not result:
            logger.info(f'Port {port} is not available right now, please check and run again.')
            if os.name == 'nt':
                try:
                    import ctypes

                    ctypes.windll.user32.MessageBoxW(0, 'This port number is already used', 'Information', 0)
                    # os.popen(f'msg %username% Port {port} is not available right now, please check and run again.')
                except Exception as e:
                    logger.exception(e)

            sys.exit()
    except (s.timeout, s.gaierror) as ex:
        logger.error(f'Checking port availability timeout! {ex}')
        # logger.exception(ex)
    except Exception as ex:
        logger.error(f'Checking port availability error! {ex}')
        # logger.exception(ex)
    finally:
        sock.close()

    return True
