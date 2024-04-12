import importlib
import threading
from time import sleep

from ap import PROCESS_QUEUE, SHUTDOWN, ListenNotifyType, dic_config, scheduler
from ap.common.constants import NOTIFY_DELAY_TIME, JobType
from ap.common.logger import logger
from ap.common.memoize import set_all_cache_expired
from ap.common.services.sse import background_announcer


def process_listen_job():
    """
    start job to listen changed from bridge
    :return:
    """
    job_id = f'{JobType.PROCESS_COMMUNICATE.name}'
    listen_thread = threading.Thread(target=listener, kwargs={'_job_id': job_id, '_job_name': job_id})

    # Starting the thread
    listen_thread.start()

    return True


# @scheduler_app_context
def listener(_job_id=None, _job_name=None):
    dic_progress = dic_config[PROCESS_QUEUE][ListenNotifyType.JOB_PROGRESS.name]
    dic_add_job = dic_config[PROCESS_QUEUE][ListenNotifyType.ADD_JOB.name]
    dic_modify_job = dic_config[PROCESS_QUEUE][ListenNotifyType.RESCHEDULE_JOB.name]
    dic_clear_cache = dic_config[PROCESS_QUEUE][ListenNotifyType.CLEAR_CACHE.name]
    # import webbrowser
    # webbrowser.open_new(f'http://localhost:{dic_config[PORT]}')
    while True:
        if dic_config[SHUTDOWN]:
            logger.info('Stop communication loop')
            break

        sleep(NOTIFY_DELAY_TIME)
        add_job_ids = list(dic_add_job.keys()) or []
        for job_id in add_job_ids:
            id, module_name, fn_name, kwargs = dic_add_job.pop(job_id)
            module = importlib.import_module(module_name)
            func = getattr(module, fn_name)
            scheduler.add_job(id, func, **kwargs)

        modify_job_ids = list(dic_modify_job.keys()) or []
        for job_id in modify_job_ids:
            id, module_name, fn_name, func_params = dic_modify_job.pop(job_id)
            module = importlib.import_module(module_name)
            func = getattr(module, fn_name)
            scheduler.reschedule_job(id, func, func_params)

        for _ in range(len(dic_progress)):
            _, (dic_job, job_event) = dic_progress.popitem()
            background_announcer.announce(dic_job, job_event)

        for _ in range(len(dic_clear_cache)):
            cache_type, _ = dic_clear_cache.popitem()
            set_all_cache_expired(cache_type)
    return True
