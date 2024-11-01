from ap import scheduler
from ap.common import multiprocess_sharing
from ap.common.memoize import set_all_cache_expired
from ap.common.multiprocess_sharing import (
    Event,
    EventAddJob,
    EventBackgroundAnnounce,
    EventExpireCache,
    EventRemoveJobs,
    EventRescheduleJob,
    EventRunFunction,
    EventShutDown,
)
from ap.common.scheduler import remove_jobs
from ap.common.services.sse import MessageAnnouncer


class EventListener:
    """Listener recipes for event queue.
    Please DO NOT send event from event listeners, to avoid running into event loop.
    """

    @staticmethod
    def add_job(event: Event):
        if isinstance(event, EventAddJob):
            scheduler.add_job(**event.job_params)

    @staticmethod
    def reschedule_job(event: Event):
        if isinstance(event, EventRescheduleJob):
            scheduler.reschedule_job(id=event.job_id, func=event.function, func_params=event.kwargs)

    @staticmethod
    def remove_job(event: Event):
        if isinstance(event, EventRemoveJobs):
            remove_jobs(job_types=event.job_types, process_id=event.process_id)

    @staticmethod
    def run_function(event: Event):
        # FIXME: maybe we don't need this `run_function`?
        if isinstance(event, EventRunFunction):
            event.function(**event.kwargs)

    @staticmethod
    def clear_cache(event: Event):
        if isinstance(event, EventExpireCache):
            set_all_cache_expired(cache_type=event.cache_type)

    @staticmethod
    def background_announce(event: Event):
        if isinstance(event, EventBackgroundAnnounce):
            MessageAnnouncer.announce(event)

    @staticmethod
    def shutdown_app(event: Event):
        if isinstance(event, EventShutDown):
            multiprocess_sharing.stop_sharing_instance_server()
            # TODO: Do more to cleanup resources
