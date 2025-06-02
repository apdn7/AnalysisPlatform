import contextlib
import datetime as dt
import logging
import math
import re
from typing import List, Optional

from flask_sqlalchemy.pagination import QueryPagination
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer

from ap import db
from ap.common.common_utils import (
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_FACTORY_DB,
    convert_time,
    generate_job_id,
    get_current_timestamp,
)
from ap.common.constants import (
    ALMOST_COMPLETE_PERCENT,
    COMPLETED_PERCENT,
    ID,
    UNKNOWN_ERROR_TEXT,
    AnnounceEvent,
    CacheType,
    DiskUsageStatus,
    JobStatus,
    JobType,
)
from ap.common.disk_usage import get_disk_capacity_once
from ap.common.logger import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.multiprocess_sharing import (
    EventBackgroundAnnounce,
    EventQueue,
    EventRunFunction,
    RunningJobs,
)
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.error_message_handler import ErrorMessageHandler
from ap.common.timezone_utils import choose_utc_convert_func
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    JobManagement,
    ProcLinkCount,
    make_session,
)
from ap.setting_module.schemas import JobManagementSchema
from ap.trace_data.transaction_model import TransactionData

logger = logging.getLogger(__name__)

previous_disk_status = DiskUsageStatus.Normal


class JobSerializedOutput(BaseModel):
    """Job info to send to front-end"""

    model_config = ConfigDict(coerce_numbers_to_str=True, validate_assignment=True)

    id: int = Field(serialization_alias='job_id')
    job_type: str = ''
    db_code: Optional[int]
    db_name: Optional[str] = Field(serialization_alias='db_master_name')
    process_id: Optional[int] = Field(serialization_alias='proc_id')
    process_name: Optional[str] = Field(serialization_alias='proc_code')

    start_tm: str = ''
    end_tm: Optional[str]
    status: str = ''
    done_percent: float = 0.0
    duration: float = 0.0
    error_msg: Optional[str]
    detail: str = ''
    data_type_error: bool = False

    @field_serializer('duration')
    def round_duration(self, duration: float) -> float:
        return round(duration, 2)

    @computed_field
    def job_name(self) -> str:
        # get job information and send to UI
        return generate_job_id(self.job_type, self.process_id)

    @computed_field()
    def process_master_name(self) -> str:
        return self.process_name


@CustomCache.memoize(cache_type=CacheType.CONFIG_DATA)
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
    """
    Get background jobs from JobManagement table
    """

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
    job_type: JobType,
    db_code=None,
    process_id=None,
    process_name=None,
    after_success_func=None,
    after_success_func_kwargs=None,
    is_check_disk=True,
):
    """send percent, status to client

    Arguments:
        job_type {JobType} -- [description]
        generator_func {[type]} -- [description]
    """
    # add new job
    global previous_disk_status
    error_msg_handler = ErrorMessageHandler()

    running_jobs = RunningJobs.get_running_jobs()

    start_tm = dt.datetime.utcnow()
    with make_session() as meta_session:
        job = JobManagement()
        job.job_type = job_type.name
        job.db_code = db_code

        # datasource_idの代わりに、t_job_managementテーブルにdatasource_nameが保存される。
        if job.db_code is not None:
            data_source = CfgDataSource.get_ds(job.db_code)
            job.db_name = data_source.name

        job.process_id = process_id

        # Yamlの代わりに、データベースからデータを取得する。
        job.process_name = process_name
        if not process_name and job.process_id:
            data_process = CfgProcess.get_proc_by_id(job.process_id)
            if data_process:
                job.process_name = data_process.name

        job.status = str(JobStatus.PROCESSING)
        meta_session.add(job)
        meta_session.flush()
        job_output = JobSerializedOutput.model_validate(job.as_dict())

    # processing info
    dic_res: dict[int, JobSerializedOutput] = {job_output.id: job_output}
    real_job_id = job_output.job_name

    prev_job_info = None
    notify_data_type_error_flg = True
    while True:
        try:
            if is_check_disk:
                disk_capacity = get_disk_capacity_once(_job_id=job_output.id)

                if disk_capacity:
                    if previous_disk_status != disk_capacity.disk_status:
                        EventQueue.put(
                            EventBackgroundAnnounce(
                                job_id=job_output.id,
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
                job_output.done_percent = job_info
            elif isinstance(job_info, JobInfo):
                prev_job_info = job_info
                # job percent update
                job_output.done_percent = job_info.percent

                # insert import history
                if not job_info.import_type:
                    job_info.import_type = job_type.name

                if job_type is JobType.CSV_IMPORT and job_info.empty_files:
                    # empty files
                    EventQueue.put(
                        EventBackgroundAnnounce(
                            job_id=job_output.id,
                            data=job_info.empty_files,
                            event=AnnounceEvent.EMPTY_FILE,
                        ),
                    )

                # job err msg
                job_output, job_info = update_job_management_status_n_error(job_output, job_info)

                # Check to interrupt generator
                if job_info.is_safe_interrupt:
                    with RunningJobs.lock():
                        running_job = running_jobs.get(real_job_id)
                        if running_job is None:
                            logger.error(f'send_processing_info: {real_job_id} does not exist in `running_jobs`')
                        elif running_job.wait_to_kill:
                            job_output.status = JobStatus.KILLED
                            job_output = update_job_management(job_output)
                            generator_func.close()
                            logger.info(f'{real_job_id}: killed successfully')
                            break

            elif job_type is JobType.GEN_GLOBAL:
                _, dic_cycle_ids, dic_edge_cnt = job_info
                save_proc_link_count(job_output.id, dic_cycle_ids, dic_edge_cnt)

        except StopIteration:
            job_output = update_job_management(job_output)

            # emit successful import data
            if prev_job_info and prev_job_info.has_record and after_success_func and after_success_func_kwargs:
                EventQueue.put(EventRunFunction(fn=after_success_func, kwargs=after_success_func_kwargs))

            # stop while loop
            break
        except Exception as e:
            # update job status
            db.session.rollback()
            message = error_msg_handler.msg_from_exception(exception=e)
            job_output = update_job_management(job_output, message)
            logger.exception(e)
            break
        finally:
            # notify if data type error greater than 100
            if notify_data_type_error_flg and prev_job_info and prev_job_info.data_type_error_cnt > COMPLETED_PERCENT:
                EventQueue.put(
                    EventBackgroundAnnounce(
                        job_id=job_output.id,
                        data=job_output.db_name,
                        event=AnnounceEvent.DATA_TYPE_ERR,
                    ),
                )

                dic_res[job_output.id].data_type_error = True
                notify_data_type_error_flg = False

            # emit info
            dic_res[job_output.id].done_percent = job_output.done_percent
            dic_res[job_output.id].end_tm = job_output.end_tm
            dic_res[job_output.id].duration = (dt.datetime.utcnow() - start_tm).total_seconds()
            EventQueue.put(
                EventBackgroundAnnounce(
                    job_id=job_output.id,
                    data={job_id: output.model_dump(by_alias=True) for job_id, output in dic_res.items()},
                    event=AnnounceEvent.JOB_RUN,
                ),
            )

    dic_res[job_output.id].status = job_output.status
    EventQueue.put(
        EventBackgroundAnnounce(
            job_id=job_output.id,
            data={job_id: output.model_dump(by_alias=True) for job_id, output in dic_res.items()},
            event=AnnounceEvent.JOB_RUN,
        ),
    )
    if job_output.job_type == JobType.CSV_IMPORT.name:
        dic_register_progress = {
            'status': job_output.status,
            'process_id': job_output.process_id,
            'is_first_imported': False,
        }
        # TODO: change job id?
        EventQueue.put(
            EventBackgroundAnnounce(
                job_id=job_output.id,
                data=dic_register_progress,
                event=AnnounceEvent.DATA_REGISTER,
            ),
        )


def update_job_management(job_output: JobSerializedOutput, err=None) -> JobSerializedOutput:
    """update job status

    Arguments:
        job {[type]} -- [description]
        done_percent {[type]} -- [description]
    """

    job = JobManagementSchema().load(job_output.model_dump())
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
        job_output = JobSerializedOutput.model_validate(job.as_dict())

    return job_output


class JobInfo:
    job_id: int
    auto_increment_col_timezone: bool
    percent: int
    status: JobStatus
    row_count: int
    committed_count: int
    has_record: bool
    exception: Exception
    empty_files: List[str]
    dic_imported_row: dict
    import_type: str
    import_from: str
    import_to: str
    is_safe_interrupt: bool

    def __init__(self):
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


def format_factory_date_to_meta_data(date_val, is_tz_col):
    if is_tz_col:
        convert_utc_func, _ = choose_utc_convert_func(date_val)
        date_val = convert_utc_func(date_val)
        date_val = date_val.replace('T', ' ')
        regex_str = r'(\.)(\d{3})(\d{3})'
        date_val = re.sub(regex_str, '\\1\\2', date_val)
    else:
        date_val = convert_time(
            date_val,
            format_str=DATE_FORMAT_STR_FACTORY_DB,
            only_millisecond=True,
        )

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
            with DbProxy(
                gen_data_source_of_universal_db(job.process_id),
                True,
                immediate_isolation_level=False,
            ) as db_instance:
                trans_data.create_table(db_instance)
                job_details = trans_data.get_import_history_error_jobs(db_instance, job_id)
        except Exception:
            pass
        if not isinstance(job_details, list):
            job_details = [job_details]

        if job.error_msg:
            job_details = [job] + job_details

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
    job: JobSerializedOutput,
    job_info: JobInfo,
) -> tuple[JobSerializedOutput, JobInfo]:
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
