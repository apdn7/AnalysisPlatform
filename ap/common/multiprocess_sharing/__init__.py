from ap.common.jobs.jobs import RunningJob, RunningJobs
from ap.common.multiprocess_sharing.events import (
    Event,
    EventAddJob,
    EventBackgroundAnnounce,
    EventExpireCache,
    EventRemoveJobs,
    EventRescheduleJob,
    EventRunFunction,
    EventShutDown,
)
from ap.common.multiprocess_sharing.manager import CustomManager
from ap.common.multiprocess_sharing.queue import EventQueue


def start_sharing_instance_server():
    CustomManager._start_server()


def stop_sharing_instance_server():
    CustomManager._stop_server()


__all__ = [
    'RunningJob',
    'RunningJobs',
    'Event',
    'EventAddJob',
    'EventRemoveJobs',
    'EventRescheduleJob',
    'EventRunFunction',
    'EventExpireCache',
    'EventBackgroundAnnounce',
    'EventShutDown',
    'EventQueue',
    'start_sharing_instance_server',
    'stop_sharing_instance_server',
]
