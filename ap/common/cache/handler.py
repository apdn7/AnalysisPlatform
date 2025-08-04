import logging
from typing import Iterable, Optional

from ap.common.cache.jobs import CacheJobs
from ap.common.memoize import OptionalCacheConfig

logger = logging.getLogger(__name__)


class CacheHandler(CacheJobs):
    @classmethod
    def compute(
        cls,
        process_ids: Optional[Iterable[int]] = None,
        compute_process: bool = False,
        compute_process_ids: bool = False,
        compute_traces: bool = False,
        periodic: bool = False,
    ):
        if compute_process:
            cls.add_job_compute_cache_for_process_and_card_order(
                process_ids=process_ids,
                optional_cache_config=OptionalCacheConfig(override=True),
                periodic=periodic,
            )

        if compute_process_ids:
            cls.add_job_get_all_process_ids(
                optional_cache_config=OptionalCacheConfig(override=True),
                periodic=periodic,
            )

        if compute_traces:
            cls.add_job_compute_cache_for_trace(
                optional_cache_config=OptionalCacheConfig(override=True),
                periodic=periodic,
            )
