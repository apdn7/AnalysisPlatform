from __future__ import annotations

import inspect
import logging
from functools import wraps
from typing import Any

from ap import close_sessions, dic_config, scheduler
from ap.common.constants import PROCESS_QUEUE, ListenNotifyType
from ap.common.logger import log_execution_time

logger = logging.getLogger(__name__)

# RESCHEDULE_SECONDS
RESCHEDULE_SECONDS = 30

# max concurrent importing jobs
MAX_CONCURRENT_JOBS = 10


@log_execution_time(logging_exception=True)
def scheduler_app_context(fn):
    """application context decorator for background task(scheduler)

    Arguments:
        fn {function} -- [description]

    Returns:
        [type] -- [description]
    """

    @wraps(fn)
    def inner(*args, **kwargs):
        if len(args):
            raise RuntimeError(
                'Function running in scheduler should never have passed `args`.'
                'Please remove those `args` when you add job in `scheduler`',
            )

        # TODO: Refactor that do not use scheduler.app, replace to call make_session instead of using db session
        #  because db.get_app() will throw error due to app not initialize yet
        flask_app = scheduler.app
        with flask_app.app_context():
            job_id = kwargs.get('_job_id')
            logger.info(f'--------{job_id} START---------')

            try:
                # FIXME: remove this function after 3 release. (Current release: 4.7.4v240)
                # We refactored our scheduler.
                # To avoid breaking changes that users' schedulers don't work,
                # we convert params from old scheduler to new scheduler.
                # This function should be delete in 3 release later.
                # When every user has new scheduler params in their database.
                new_scheduler_kwargs = convert_kwargs_from_old_scheduler(kwargs)

                acceptable_kwargs = filter_kwargs_for_function(fn, new_scheduler_kwargs)
                result = fn(**acceptable_kwargs)
                logger.info(f'--------{job_id} END-----------')
            except Exception as e:
                raise e
            finally:
                # rollback and close session to avoid database locked.
                close_sessions()

            return result

    return inner


def convert_kwargs_from_old_scheduler(kwargs: dict[str, Any]) -> dict[str, Any]:
    """We don't want to create breaking changes for users, so we want to convert old kwargs in old scheduler
    This functions should be removed later: like 3 releases after that.
    """
    mapping_keys = {
        '_job_id': 'job_id',
        '_job_name': 'job_name',
        '_db_id': 'data_source_id',
        '_proc_id': 'process_id',
        '_proc_name': 'process_name',
        'proc_id': 'process_id',
    }

    new_kwargs_added = False

    new_kwargs = kwargs.copy()
    for old_key, new_key in mapping_keys.items():
        if old_key not in kwargs:  # There is no key to map.
            continue
        if new_kwargs.get(new_key) is not None:  # new_key's already existed
            continue
        new_kwargs[new_key] = kwargs[old_key]
        new_kwargs_added = True

    if new_kwargs_added:
        logger.warning('Converting from old scheduler to new scheduler')

    return new_kwargs


def filter_kwargs_for_function(function, kwargs: dict[str, Any]) -> dict[str, Any]:
    """Find all acceptable keyword arguments for a function
    If this function contains `**kwargs` we return all remaining
    If this function does not contain `**kwargs`, we must return correct arguments for them
    Please see: <https://docs.python.org/3/library/inspect.html#inspect.Parameter.kind> on how signature works
    """
    signature = inspect.signature(function)

    # function can contain all kwargs
    if any(p.kind == p.VAR_KEYWORD for p in signature.parameters.values()):
        return kwargs

    # function does contain kwargs, we return key that only exist in that
    acceptable_keys = {p.name for p in signature.parameters.values()}
    reduced_kwargs = {k: v for k, v in kwargs.items() if k in acceptable_keys}

    # delete signature
    del signature

    return reduced_kwargs


def is_job_running(job_id=None, job_name=None):
    dic_jobs = dic_config[PROCESS_QUEUE][ListenNotifyType.RUNNING_JOB.name]
    if job_id:
        return job_id in dic_jobs

    if job_name:
        return job_name in list(dic_jobs.values())

    return False
