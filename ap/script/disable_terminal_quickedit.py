import msvcrt
import ctypes

from ap.common.logger import log_execution_time

import logging

logger = logging.getLogger(__name__)


@log_execution_time()
def disable_quickedit():
    """
    Disable quickedit mode on Windows terminal. quickedit prevents script to
    run without user pressing keys..
    """
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        device = r"\\.\CONIN$"
        with open(device, "r") as con:
            hCon = msvcrt.get_osfhandle(con.fileno())
            kernel32.SetConsoleMode(hCon, 0x0080)
    except Exception as e:
        logger.info("Cannot disable QuickEdit mode! " + str(e))
        logger.info(
            ".. As a consequence the script might be automatically\
        paused on Windows terminal"
        )
