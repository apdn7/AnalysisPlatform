import datetime

from apscheduler.job import Job
from apscheduler.triggers.base import BaseTrigger
from apscheduler.triggers.combining import BaseCombiningTrigger, OrTrigger

RE_TRIGGER_SECONDS = 30


def always_trigger_job(job: Job):
    job.trigger = AlwaysTrigger.combine(job.trigger, seconds=RE_TRIGGER_SECONDS)


def unwrap_always_triggered_job(job: Job):
    job.trigger = AlwaysTrigger.remove(job.trigger)


class AlwaysTrigger(BaseTrigger):
    """The trigger that always schedule the next run after fixed seconds"""

    __slots__ = ('seconds',)

    def __init__(self, seconds: int):
        self.seconds = seconds

    def __getstate__(self):
        return {'seconds': self.seconds}

    def __setstate__(self, state):
        self.seconds = state.get('seconds')

    def get_next_fire_time(self, previous_fire_time, now):
        return now + datetime.timedelta(seconds=self.seconds)

    @classmethod
    def _filter_non_always_triggers(cls, triggers: list[BaseTrigger]) -> list[BaseTrigger]:
        return [t for t in triggers if not isinstance(t, AlwaysTrigger)]

    @classmethod
    def remove(cls, trigger: BaseTrigger) -> BaseTrigger:
        """Revert to normal trigger by removing `AlwaysTrigger` instance"""

        if not isinstance(trigger, BaseCombiningTrigger):
            return trigger

        triggers = cls._filter_non_always_triggers(trigger.triggers)
        if len(triggers) != 1:
            raise ValueError('Only one normal trigger should be combined with `AlwaysTrigger`')

        return triggers[0]

    @classmethod
    def combine(cls, trigger: BaseTrigger, seconds: int) -> OrTrigger:
        """Combine the trigger with `AlwaysTrigger` so that it can always run after fixed seconds
        Do not combine if it already has `AlwaysTrigger`
        """

        if isinstance(trigger, BaseCombiningTrigger):
            triggers = cls._filter_non_always_triggers(trigger.triggers)
            return OrTrigger(triggers=[*triggers, AlwaysTrigger(seconds)])

        return OrTrigger(triggers=[trigger, AlwaysTrigger(seconds)])
