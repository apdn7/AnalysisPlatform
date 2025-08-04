import logging
from datetime import datetime
from typing import Iterable, Optional, Union

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pytz import utc

from ap.common.cache.functions import CacheFunctions
from ap.common.constants import JobType
from ap.common.memoize import OptionalCacheConfig
from ap.common.multiprocess_sharing import EventAddJob, EventQueue

logger = logging.getLogger(__name__)


class CacheJobs(CacheFunctions):
    PERIODICALLY_COMPUTE_CACHE_INTERVAL = 10 * 60
    PERIODICALLY_JOBS = {
        JobType.COMPUTE_PROCESS_CACHE: JobType.PERIODICALLY_COMPUTE_PROCESS_CACHE,
        JobType.COMPUTE_ALL_PROCESS_IDS_CACHE: JobType.PERIODICALLY_COMPUTE_ALL_PROCESSES_CACHE,
        JobType.COMPUTE_ALL_TRACES_CACHE: JobType.PERIODICALLY_COMPUTE_ALL_TRACES_CACHE,
    }

    @classmethod
    def __detect_job_params(
        cls,
        is_periodically: bool,
        job_type: JobType,
    ) -> tuple[JobType, Union[IntervalTrigger, DateTrigger]]:
        if is_periodically:
            output_job_type = cls.PERIODICALLY_JOBS[job_type]
            trigger = IntervalTrigger(seconds=cls.PERIODICALLY_COMPUTE_CACHE_INTERVAL, timezone=utc)
        else:
            output_job_type = job_type
            trigger = DateTrigger(datetime.now().astimezone(utc), timezone=utc)

        return output_job_type, trigger

    @classmethod
    def add_job_compute_cache_for_process_and_card_order(
        cls,
        process_ids: Optional[Iterable[int]] = None,
        optional_cache_config=OptionalCacheConfig(),
        periodic: bool = False,
    ):
        job_type, trigger = cls.__detect_job_params(periodic, JobType.COMPUTE_PROCESS_CACHE)
        job_id_suffix = '_'.join([str(process_id) for process_id in process_ids]) if process_ids else None
        EventQueue.put(
            EventAddJob(
                fn=cls.get_config_process_and_card_order_per_process_job,
                kwargs={'process_ids': process_ids, 'optional_cache_config': optional_cache_config},
                job_type=job_type,
                job_id_suffix=job_id_suffix,
                trigger=trigger,
                replace_existing=True,
                executor='threadpool',
                next_run_time=datetime.now().astimezone(utc),
            ),
        )

    @classmethod
    def add_job_get_all_process_ids(
        cls,
        optional_cache_config=OptionalCacheConfig(),
        periodic: bool = False,
    ):
        job_type, trigger = cls.__detect_job_params(periodic, JobType.COMPUTE_ALL_PROCESS_IDS_CACHE)
        EventQueue.put(
            EventAddJob(
                fn=cls.get_all_process_ids_job,
                kwargs={'optional_cache_config': optional_cache_config},
                job_type=job_type,
                trigger=trigger,
                replace_existing=True,
                executor='threadpool',
                next_run_time=datetime.now().astimezone(utc),
            ),
        )

    @classmethod
    def add_job_compute_cache_for_trace(
        cls,
        optional_cache_config=OptionalCacheConfig(),
        periodic: bool = False,
    ):
        job_type, trigger = cls.__detect_job_params(periodic, JobType.COMPUTE_ALL_TRACES_CACHE)
        EventQueue.put(
            EventAddJob(
                fn=cls.get_traces_graph_config_data_job,
                kwargs={'optional_cache_config': optional_cache_config},
                job_type=job_type,
                trigger=trigger,
                replace_existing=True,
                executor='threadpool',
                next_run_time=datetime.now().astimezone(utc),
            ),
        )
