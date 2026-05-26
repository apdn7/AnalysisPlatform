import contextlib
import datetime as dt
import math
import re
from typing import Union

from flask_sqlalchemy.pagination import QueryPagination
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer

from ap import db
from ap.common.common_utils import (
    convert_time,
    generate_job_id,
    get_current_timestamp,
)
from ap.common.constants import (
    ALMOST_COMPLETE_PERCENT,
    COMPLETED_PERCENT,
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_FACTORY_DB,
    ID,
    UNKNOWN_ERROR_TEXT,
    AnnounceEvent,
    DBType,
    DiskUsageStatus,
    JobStatus,
    JobType,
)
from ap.common.disk_usage import get_disk_capacity_once
from ap.common.jobs.job_info_schema import JobInfoUnion
from ap.common.jobs.jobs import RunningJobs
from ap.common.log import log_execution_time
from ap.common.multiprocess_sharing import (
    EventBackgroundAnnounce,
    EventQueue,
    EventRunFunction,
)
from ap.common.pydn.dblib.transaction import TxnMetaConnection
from ap.common.services.error_message_handler import ErrorMessageHandler
from ap.common.timezone_utils import choose_utc_convert_func
from ap.setting_module.models import (
    CfgProcess,
    JobManagement,
    ProcLinkCount,
    make_session,
)
from ap.trace_data.transaction_model import TransactionData

previous_disk_status = DiskUsageStatus.Normal


class JobSerializedOutput(BaseModel):
    """Job info to send to front-end"""

    model_config = ConfigDict(coerce_numbers_to_str=True, validate_assignment=True)

    id: int = Field(serialization_alias='job_id')
    job_type: Union[JobType, str] | None
    db_code: int | None
    db_name: str | None = Field(serialization_alias='db_master_name')
    process_id: int | None = Field(serialization_alias='proc_id')
    process_name: str | None = Field(serialization_alias='proc_code')

    start_tm: str = ''
    end_tm: str | None
    status: str = ''
    done_percent: float = 0.0
    duration: float = 0.0
    error_msg: str | None
    detail: str = ''
    data_type_error: bool = False
    info: JobInfoUnion | None

    @field_serializer('duration')
    def round_duration(self, duration: float) -> float:
        return round(duration, 2)

    @computed_field
    def job_name(self) -> str:
        # get job information and send to UI
        return generate_job_id(JobType[self.job_type], process_id=self.process_id, data_source_id=self.db_code)

    @computed_field()
    def process_master_name(self) -> str:
        return self.process_name

    @computed_field()
    def summary(self) -> str | None:
        return self.info.summary if self.info else None

    @computed_field()
    def details(self) -> list[str] | None:
        return self.info.details if self.info else None


def get_all_proc_shown_names():
    return {proc.id: proc.shown_name for proc in CfgProcess.get_all(with_parent=True)}


@log_execution_time()
def get_background_jobs_service(
    page=1,
    per_page=50,
    sort_by='',
    order='',
    ignore_job_types=None,
    error_page=False,
) -> tuple[list[JobSerializedOutput], QueryPagination]:
    """Get background jobs from JobManagement table"""
    jobs = JobManagement.query
    if error_page:
        jobs = jobs.filter(JobManagement.status.in_(JobStatus.failed_statuses()))

    if ignore_job_types:
        jobs = jobs.filter(JobManagement.job_type.notin_(ignore_job_types))

    if sort_by != '':
        sort_by_col = JobManagement.job_sorts(order)
        jobs = jobs.order_by(sort_by_col[sort_by])
    else:
        jobs = jobs.order_by(JobManagement.id.desc())

    jobs = jobs.paginate(page=page, per_page=per_page, error_out=False)
    dic_procs = get_all_proc_shown_names()
    rows: list[JobSerializedOutput] = []
    for _job in jobs.items:
        job = JobSerializedOutput.model_validate(_job.as_dict())

        if not error_page and job.process_id is not None and job.process_id not in dic_procs:
            # do not show deleted process in job normal page -> show only job error page
            continue

        # get process shown name
        proc_name = dic_procs.get(job.process_id)
        if proc_name:
            job.process_name = proc_name

        rows.append(job)

    # TODO get more info from jobs ( next_page, prev_page, total_pages...)
    return rows, jobs


def send_processing_info(
    generator_func,
    job_management: JobManagement,
    after_success_func=None,
    after_success_func_kwargs=None,
    is_check_disk=True,
):
    """Send percent, status to client

    Arguments:
        job_type {JobType} -- [description]
        generator_func {[type]} -- [description]
    """
    # add new job
    job_type: JobType = JobType[job_management.job_type]
    global previous_disk_status
    error_msg_handler = ErrorMessageHandler()

    running_jobs = RunningJobs.get_running_jobs()

    job_output = JobSerializedOutput.model_validate(job_management.as_dict())
    # processing info
    dic_res: dict[int, JobSerializedOutput] = {job_management.id: job_output}
    real_job_id = generate_job_id(
        job_type=job_type, process_id=job_management.process_id, data_source_id=job_management.db_code
    )

    prev_job_info = None
    notify_data_type_error_flg = True
    while True:
        try:
            if is_check_disk and JobType[job_management.job_type] in JobType.jobs_can_increase_disk_usage():
                disk_capacity = get_disk_capacity_once(_job_id=job_management.id)

                if disk_capacity:
                    if previous_disk_status != disk_capacity.disk_status:
                        EventQueue.put(
                            EventBackgroundAnnounce(
                                job_id=job_management.id,
                                data=disk_capacity.to_dict(),
                                event=AnnounceEvent.DISK_USAGE,
                            ),
                        )
                        previous_disk_status = disk_capacity.disk_status

                    if disk_capacity.disk_status == DiskUsageStatus.Full:
                        raise disk_capacity

            job_info = next(generator_func)

            # update job details ( csv_import , gen global...)
            if isinstance(job_info, int):
                # job percent update
                job_management.done_percent = job_info
            elif isinstance(job_info, JobInfo):
                prev_job_info = job_info
                # job percent update
                job_management.done_percent = job_info.percent

                # insert import history
                if not job_info.import_type:
                    job_info.import_type = job_type.name

                if job_type is JobType.CSV_IMPORT and job_info.empty_files:
                    # empty files
                    EventQueue.put(
                        EventBackgroundAnnounce(
                            job_id=job_management.id,
                            data=job_info.empty_files,
                            event=AnnounceEvent.EMPTY_FILE,
                        ),
                    )

                # job err msg
                job_management, job_info = update_job_management_status_n_error(job_management, job_info)

                # Check to interrupt generator
                if job_info.is_safe_interrupt:
                    with RunningJobs.lock():
                        running_job = running_jobs.get(real_job_id)
                        if running_job is None:
                            logger.error(f'send_processing_info: {real_job_id} does not exist in `running_jobs`')
                        elif running_job.wait_to_kill:
                            job_management.status = JobStatus.KILLED
                            job_management = update_job_management(job_management)
                            generator_func.close()
                            logger.info(f'{real_job_id}: killed successfully')
                            break

            elif job_type is JobType.GEN_GLOBAL:
                _, dic_cycle_ids, dic_edge_cnt = job_info
                save_proc_link_count(job_management.id, dic_cycle_ids, dic_edge_cnt)

        except StopIteration:
            job_management = update_job_management(job_management)

            # emit successful import data
            if prev_job_info and prev_job_info.has_record and after_success_func and after_success_func_kwargs:
                EventQueue.put(EventRunFunction(fn=after_success_func, kwargs=after_success_func_kwargs))

            # stop while loop
            break
        except Exception as e:
            # update job status
            db.session.rollback()
            message = error_msg_handler.msg_from_exception(exception=e)
            job_management = update_job_management(job_management, message)
            logger.exception(e)
            break
        finally:
            # notify if data type error greater than 100
            if notify_data_type_error_flg and prev_job_info and prev_job_info.data_type_error_cnt > COMPLETED_PERCENT:
                EventQueue.put(
                    EventBackgroundAnnounce(
                        job_id=job_management.id,
                        data=job_management.db_name,
                        event=AnnounceEvent.DATA_TYPE_ERR,
                    ),
                )

                dic_res[job_management.id].data_type_error = True
                notify_data_type_error_flg = False

            # emit info
            dic_res[job_management.id].done_percent = job_management.done_percent
            dic_res[job_management.id].end_tm = job_management.end_tm
            dic_res[job_management.id].duration = (
                dt.datetime.utcnow() - dt.datetime.strptime(job_management.start_tm, DATE_FORMAT_STR)
            ).total_seconds()
            EventQueue.put(
                EventBackgroundAnnounce(
                    job_id=job_management.id,
                    data={job_id: output.model_dump(by_alias=True) for job_id, output in dic_res.items()},
                    event=AnnounceEvent.JOB_RUN,
                ),
            )

    dic_res[job_management.id].status = job_management.status
    EventQueue.put(
        EventBackgroundAnnounce(
            job_id=job_management.id,
            data={job_id: output.model_dump(by_alias=True) for job_id, output in dic_res.items()},
            event=AnnounceEvent.JOB_RUN,
        ),
    )


def update_job_management(job: JobManagement, err=None) -> JobSerializedOutput:
    """Update job status

    Arguments:
        job {[type]} -- [description]
        done_percent {[type]} -- [description]
    """
    with make_session() as meta_session:
        if (
            not err
            and not job.error_msg
            and (
                job.done_percent == COMPLETED_PERCENT or job.status in (JobStatus.PROCESSING.name, JobStatus.DONE.name)
            )
        ):
            job.status = JobStatus.DONE.name
            job.done_percent = 100
            job.error_msg = None
        else:
            if job.status == JobStatus.FATAL:
                job.status = JobStatus.FATAL.name
            elif job.status == JobStatus.KILLED:
                job.status = JobStatus.KILLED.name
            else:
                job.status = JobStatus.FAILED.name
            job.error_msg = err or job.error_msg or UNKNOWN_ERROR_TEXT

        job.duration = (dt.datetime.utcnow() - dt.datetime.strptime(job.start_tm, DATE_FORMAT_STR)).total_seconds()
        job.end_tm = get_current_timestamp()

        job = meta_session.merge(job)

    return job


class JobInfo:
    """Job information container for background job processing.

    Tracks the progress, status, and metadata of background jobs during execution.

    Attributes:
        job_id: ID of the job.
        auto_increment_col_timezone: Whether auto-increment column has timezone.
        percent: Completion percentage of the job.
        status: Current job status.
        row_count: Number of rows processed.
        committed_count: Number of rows committed to database.
        has_record: Whether the job has processed any records.
        exception: Exception encountered during processing.
        empty_files: List of empty file names.
        dic_imported_row: Dictionary of imported row metadata.
        import_type: Type of import operation.
        import_from: Import start timestamp.
        import_to: Import end timestamp.
        is_safe_interrupt: Whether the job can be safely interrupted.
        target: Target of the job processing.
        first_cycle_time: First cycle timestamp.
        last_cycle_time: Last cycle timestamp.
        has_error: Whether the job encountered errors.
        data_type_error_cnt: Count of data type errors.
        start_tm: Job start time.
        end_tm: Job end time.

    Methods:
        calc_percent: Calculate completion percentage based on row count and total.
        interruptible: Context manager to mark safe interrupt points.

    Generated by Duo
    """

    job_id: int
    auto_increment_col_timezone: bool
    percent: int
    status: JobStatus
    row_count: int
    committed_count: int
    has_record: bool
    exception: Exception
    empty_files: list[str]
    dic_imported_row: dict
    import_type: str
    import_from: str
    import_to: str
    is_safe_interrupt: bool

    def __init__(self) -> None:
        self.job_id = None
        self.target = None
        self.percent = 0
        self.status = JobStatus.PROCESSING
        self.row_count = 0
        self.first_cycle_time = None
        self.last_cycle_time = None
        self.auto_increment_col_timezone = False
        self.empty_files = None

        # private (per chunk in one csv file)
        self._exception = None
        self._committed_count = 0
        self._err_msg = None
        self.start_tm = None
        self.end_tm = None

        # 累計(Cumulative for all files in a job)
        self.has_record = False
        self.has_error = None
        self.data_type_error_cnt = 0

        # meta data for target files in chunk
        self.dic_imported_row = None
        self.import_type = None
        self.import_from = None
        self.import_to = None

        # serve to determine the time that job can be stopped without missing data
        self.is_safe_interrupt = False

    @property
    def committed_count(self):
        return self._committed_count

    @committed_count.setter
    def committed_count(self, val: int):
        if val:
            self.has_record = True

        self._committed_count = val

    @property
    def err_msg(self):
        return self._err_msg

    @err_msg.setter
    def err_msg(self, val: str):
        if val:
            self.has_error = True

        self._err_msg = val or None

    @property
    def exception(self):
        return self._exception

    @exception.setter
    def exception(self, val: Exception):
        if val:
            self.has_error = True

        self._exception = val or None

    def calc_percent(self, row_count, total):
        percent = row_count * COMPLETED_PERCENT / total
        percent = math.floor(percent)
        if percent >= COMPLETED_PERCENT:
            percent = ALMOST_COMPLETE_PERCENT

        self.percent = percent

    @contextlib.contextmanager
    def interruptible(self, is_safe_interrupt: bool = True):
        self.is_safe_interrupt = is_safe_interrupt
        yield self
        self.is_safe_interrupt = False


def format_factory_date_to_meta_data(
    date_val: str | None,
    is_tz_col: bool,
    db_type: str | None = None,
) -> str | None:
    if date_val is None:
        return None

    if is_tz_col:
        convert_utc_func, _ = choose_utc_convert_func(date_val)
        date_val = convert_utc_func(date_val)
        date_val = date_val.replace('T', ' ')

        # store millisecond for mssqlserver and oracle
        if db_type in (DBType.MSSQLSERVER.name, DBType.ORACLE.name):
            regex_str = r'(\.)(\d{3})(\d{3})'
            date_val = re.sub(regex_str, '\\1\\2', date_val)
    # store millisecond for mssqlserver and oracle
    elif db_type in (DBType.MSSQLSERVER.name, DBType.ORACLE.name):
        date_val = convert_time(date_val, format_str=DATE_FORMAT_STR_FACTORY_DB, only_millisecond=True)
    else:
        date_val = convert_time(date_val, format_str=DATE_FORMAT_STR_FACTORY_DB)

    return date_val


@log_execution_time()
def get_job_detail_service(job_id):
    """
    Get all job details of a job
    :param job_id:
    :return:
    """
    job = db.session.query(JobManagement).filter(JobManagement.id == job_id).first()
    job_details_as_dict = {}
    if job and job.process_id:
        job_details = []
        try:
            trans_data = TransactionData(job.process_id)
            with (
                TxnMetaConnection(process_id=job.process_id) as meta_con,
            ):
                job_details = trans_data.get_import_history_error_jobs(meta_con, job_id)
        except Exception:
            pass
        if not isinstance(job_details, list):
            job_details = [job_details]

        if job.error_msg:
            job_details = [job, *job_details]

        for job_detail in job_details:
            job_details_as_dict[job_id] = row2dict(job_detail) if not isinstance(job_detail, dict) else job_detail
            if ID not in job_details_as_dict[job_id]:
                job_details_as_dict[job_id][ID] = job_id
    return job_details_as_dict


@log_execution_time()
def row2dict(row):
    """
    Convert SQLAlchemy returned object to dictionary
    :param row:
    :return:
    """
    object_as_dict = {}
    for column in row.__table__.columns:
        object_as_dict[column.name] = str(getattr(row, column.name))

    return object_as_dict


def save_proc_link_count(job_id, dic_cycle_ids, dic_edge_cnt):
    with make_session() as meta_session:
        for (start_proc_id, end_proc_id), matched_cnt in dic_edge_cnt.items():
            if not matched_cnt:
                continue

            proc_link_hist = ProcLinkCount()
            proc_link_hist.job_id = job_id
            proc_link_hist.process_id = start_proc_id
            proc_link_hist.target_process_id = end_proc_id
            proc_link_hist.matched_count = matched_cnt
            meta_session.add(proc_link_hist)

        # save process matched count to db
        for proc_id, cycle_ids in dic_cycle_ids.items():
            matched_cnt = len(cycle_ids)
            if not matched_cnt:
                continue

            proc_link_hist = ProcLinkCount()
            proc_link_hist.job_id = job_id
            proc_link_hist.process_id = proc_id
            proc_link_hist.matched_count = len(cycle_ids)
            meta_session.add(proc_link_hist)

    return True


def update_job_management_status_n_error(
    job: JobManagement,
    job_info: JobInfo,
) -> tuple[JobManagement, JobInfo]:
    if not job.status or job_info.status.value > JobStatus[job.status].value:
        job.status = job_info.status.name

    if job_info.err_msg:
        if job.error_msg:
            job.error_msg += job_info.err_msg
        else:
            job.error_msg = job_info.err_msg

    # reset job info
    job_info.err_msg = None

    return job, job_info
