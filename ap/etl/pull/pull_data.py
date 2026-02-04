from __future__ import annotations

import datetime as dt
import logging

from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pytz import utc

from ap.api.setting_module.services.import_data import add_import_transaction_data_job
from ap.common.constants import DBType, JobType, MasterDBType, ProcessStatus
from ap.common.logger import log_execution_time
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.scheduler import scheduler_app_context
from ap.etl.pull.common import PullBase
from ap.etl.pull.others import PullOthers
from ap.etl.pull.software_workshop_history import PullSoftwareWorkshopHistory
from ap.etl.pull.software_workshop_measurement import PullSoftwareWorkshopMeasurement
from ap.setting_module.models import CfgDataSource, CfgProcess, JobManagement
from ap.setting_module.services.background_process import send_processing_info

logger = logging.getLogger(__name__)


def group_pull_instances(processes: list[CfgProcess]) -> list[PullBase]:
    """Group multiple pull instances to pull just one time for efficiency and cost saving"""
    # Add more group as you see fit
    software_workshop_measurement_processes: list[CfgProcess] = []
    software_workshop_history_processes: list[CfgProcess] = []
    other_processes: list[CfgProcess] = []

    for process in processes:
        if process.data_source.type in [DBType.SNOWFLAKE.name, DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name]:
            if process.master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name:
                software_workshop_measurement_processes.append(process)
            elif process.master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY.name:
                software_workshop_history_processes.append(process)
            elif process.master_type in [MasterDBType.OTHERS.name, None]:
                other_processes.append(process)
            else:
                raise NotImplementedError(f'Unsupported pull for process `{process.id}`')
        else:
            raise NotImplementedError(f'Unsupported pull for process `{process.id}`')

    pull_instances: list[PullBase] = []

    if software_workshop_measurement_processes:
        pull_instances.append(PullSoftwareWorkshopMeasurement(processes=software_workshop_measurement_processes))
    if software_workshop_history_processes:
        pull_instances.append(PullSoftwareWorkshopHistory(processes=software_workshop_history_processes))

    if other_processes:
        # pull others separately, we can group them if they are the same table? But this is unnecessary.
        pull_instances.extend(PullOthers(processes=[p]) for p in other_processes)

    return pull_instances


@log_execution_time()
def pull_transaction_data(data_source_id: int):
    yield 1

    data_source: CfgDataSource = CfgDataSource.get_by_id(id=data_source_id)
    processes: list[CfgProcess] = CfgProcess.get_by_data_source_id_and_status(
        data_source_id=data_source_id,
        status=ProcessStatus.REGISTERED,
    )
    """Only get registered processes to pull data.
    Another processes do nothing because no have columns or not registered
    """
    if len(processes) == 0:
        # no processes
        yield 100
        return

    pull_instances = group_pull_instances(processes)

    with ReadOnlyDbProxy(data_source) as factory_db_instance:
        for pull_instance in pull_instances:
            sql = pull_instance.get_transaction_data_query_union_all(factory_db_instance)

            # no new data for pulling
            if sql is None:
                continue

            pull_instance.pull_data(factory_db_instance)
    yield 99

    for process in processes:
        add_import_transaction_data_job(process)
    yield 100


@scheduler_app_context
def pull_transaction_data_job(data_source_id: int, job_management: JobManagement):
    gen = pull_transaction_data(data_source_id)
    send_processing_info(
        gen,
        job_management=job_management,
    )


def add_pull_transaction_data_job(data_source_id: int):
    db: CfgDataSource = CfgDataSource.get_by_id(data_source_id)
    interval_sec = db.polling_frequency
    if interval_sec:
        trigger = IntervalTrigger(seconds=interval_sec, timezone=utc)
    else:
        trigger = DateTrigger(dt.datetime.now().astimezone(utc), timezone=utc)
    next_run_time = dt.datetime.now().astimezone(utc)

    EventQueue.put(
        EventAddJob(
            fn=pull_transaction_data_job,
            job_type=JobType.PULL_DATA,
            data_source_id=data_source_id,
            replace_existing=True,
            trigger=trigger,
            next_run_time=next_run_time,
            executor='threadpool',
            max_instances=1,
        ),
    )
