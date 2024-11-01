import atexit
import multiprocessing
import os
import uuid
from multiprocessing.managers import BaseManager, DictProxy
from queue import Queue
from typing import Any

import filelock

from ap.common.common_utils import get_data_path

# placeholder for sharing event queue between processes
# can store maximum 1_000_000 event at the moment
_event_queue = Queue(maxsize=1_000_000)


def _get_event_queue():
    return _event_queue


# placeholder for sharing running jobs between processes
_dict_running_jobs = {}


def _get_running_jobs():
    return _dict_running_jobs


class CustomManager(BaseManager):
    """Store sharing instances between children processes and parent process
    - For parent process:
        - Start a unique process at `AF_PIPE` address
          See more: <https://docs.python.org/3/library/multiprocessing.html#address-formats>
        - Dump connected address into a file
        - Register new instance for sharing
          See more: <https://docs.python.org/3/library/multiprocessing.html#using-a-remote-manager>

    - For children processes:
        - Connect to `AF_PIPE` address created by parent process
          See more: <https://docs.python.org/3/library/multiprocessing.html#address-formats>
        - Getting sharing instances, we might add more functions to get more sharing instance if we want
            - `get_event_queue()`
            - `get_running_jobs()`
    """

    # instance to keep server run forever without garbage collected
    # we need to free this at the end to avoid memory leaked
    __instance = None

    # before starting application, we need to set an address to let our children process know where to connect
    # however, since our application is multiple processes, we need to lock the file beforehand
    # so that it does not result in race condition or wrong address
    # we use `filelock <https://py-filelock.readthedocs.io/en/latest/index.html>` for that
    __lock_path = os.path.join(get_data_path(), '.multi_process_communication.lock')
    __address_path = os.path.join(get_data_path(), '.multi_process_communication.addr')

    @classmethod
    def _generate_new_address(cls):
        # create unique identifier for address
        unique_identifier = uuid.uuid4().hex

        # fixed unique address use for connecting to multiprocess pipe
        address = rf'\\.\pipe\__custom_manager_address_multi_processes_{os.getpid()}_{unique_identifier}'
        # make sure our uuid does not incorrectly create un-trimmed string
        address = address.strip()

        # lock the file before writing
        with filelock.FileLock(cls.__lock_path), open(cls.__address_path, 'w', encoding='utf-8') as f:
            f.write(address)
        return address

    @classmethod
    def _get_address(cls) -> str:
        # lock the file before writing
        with filelock.FileLock(cls.__lock_path), open(cls.__address_path, encoding='utf-8') as f:
            address = f.read().strip()
        return address

    @classmethod
    def _start_server(cls):
        """This method is only called on main process"""
        if cls.__instance is None:
            if multiprocessing.parent_process() is not None:
                raise RuntimeError('This method should only be called on main process')

            # add some method
            cls.register('_get_event_queue', callable=_get_event_queue)
            cls.register('_get_running_jobs', callable=_get_running_jobs, proxytype=DictProxy)

            cls.__instance = cls(address=cls._generate_new_address())
            cls.__instance.start()

            # make sure to stop server after shutdown
            atexit.register(cls._stop_server)

    @classmethod
    def _connect_server(cls):
        """This method is only called on child process"""
        if cls.__instance is None:
            cls.register('_get_event_queue')
            cls.register('_get_running_jobs')
            cls.__instance = cls(address=cls._get_address())
            cls.__instance.connect()

        if cls.__instance is None:
            raise RuntimeError('Failed to connect to server, please check `')

    @classmethod
    def _stop_server(cls):
        """This method is only called on main process"""
        if cls.__instance is not None:
            if hasattr(cls.__instance, 'shutdown'):
                cls.__instance.shutdown()
            cls.__instance = None

    @classmethod
    def get_event_queue(cls) -> Queue[Any]:
        """This method should be called on child process, needed to get event queue"""
        cls._connect_server()
        return cls.__instance._get_event_queue()

    @classmethod
    def get_running_jobs(cls) -> dict[Any, Any]:
        """This method should be called on child process, needed to get running jobs"""
        cls._connect_server()
        return cls.__instance._get_running_jobs()
