import logging
from typing import Optional

from ap.api.common.services.show_graph_database import (
    get_all_process_ids,
    get_config_process_and_card_order_per_process,
    get_traces_graph_config_data,
)
from ap.common.constants import JobType
from ap.common.memoize import OptionalCacheConfig
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import CfgProcess
from ap.setting_module.services.background_process import send_processing_info

logger = logging.getLogger(__name__)


class CacheFunctions:
    @staticmethod
    @scheduler_app_context
    def get_config_process_and_card_order_per_process_job(
        process_ids: Optional[list[int]] = None,
        optional_cache_config=OptionalCacheConfig(),
        job_type: JobType = None,
    ):
        if process_ids is None:
            # Truly get a list of process's id in Database (not in cache) to calculate cache for real processes
            processes = CfgProcess.get_all_ids(with_parent=True)
            process_ids = [process.id for process in processes]

        def generator():
            progress_percent = 0
            yield progress_percent

            increase_step = 100 / len(process_ids)
            for process_id in process_ids:
                logger.debug(f'[COMPUTE_CACHE] process_id: {process_id}')
                get_config_process_and_card_order_per_process(
                    process_id,
                    optional_cache_config=optional_cache_config,
                )
                progress_percent += increase_step
                yield progress_percent

        send_processing_info(generator(), job_type=job_type)

    @staticmethod
    @scheduler_app_context
    def get_all_process_ids_job(optional_cache_config=OptionalCacheConfig(), job_type: JobType = None):
        def generator():
            yield 0
            logger.debug('[COMPUTE_CACHE] get_all_process_ids')
            get_all_process_ids(optional_cache_config=optional_cache_config)
            yield 100

        send_processing_info(generator(), job_type=job_type)

    @staticmethod
    @scheduler_app_context
    def get_traces_graph_config_data_job(
        optional_cache_config=OptionalCacheConfig(),
        job_type: JobType = None,
    ):
        def generator():
            yield 0
            logger.debug('[COMPUTE_CACHE] trace config')
            get_traces_graph_config_data(optional_cache_config=optional_cache_config)
            yield 100

        send_processing_info(generator(), job_type=job_type)
