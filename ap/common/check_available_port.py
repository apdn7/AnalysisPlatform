import socket as s
import sys

from ap.common.common_utils import parse_int_value
from ap.common.logger import log_execution, logger


@log_execution()
def check_available_port(port):
    port = parse_int_value(port)
    sock = s.socket(s.AF_INET, s.SOCK_STREAM)
    sock.settimeout(5)
    try:
        result = sock.connect_ex(('127.0.0.1', port))
        if not result:
            logger.info('Port %d is not available right now, please check and run again.' % (port))
            input('Please type any key to close application\n')
            if input:
                sys.exit()
    except (s.timeout, s.gaierror) as ex:
        logger.error('Checking port availability timeout!', ex)
        # logger.exception(ex)
    except Exception as ex:
        logger.error('Checking port availability error!', ex)
        # logger.exception(ex)
    finally:
        sock.close()
