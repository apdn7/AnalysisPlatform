import datetime as dt
import math
import re
import traceback
from typing import List

from ap import PROCESS_QUEUE, ListenNotifyType, db, dic_config
from ap.api.common.services.show_graph_database import DictToClass
from ap.common.common_utils import (
    DATE_FORMAT_STR,
    DATE_FORMAT_STR_FACTORY_DB,
    convert_time,
    get_current_timestamp,
    get_multiprocess_queue_file,
    read_pickle_file,
)
from ap.common.constants import (
    ALMOST_COMPLETE_PERCENT,
    COMPLETED_PERCENT,
    ID,
    UNKNOWN_ERROR_TEXT,
    CacheType,
    DiskUsageStatus,
    JobStatus,
    JobType,
)
from ap.common.disk_usage import get_disk_capacity_once
from ap.common.logger import log_execution_time, logger
from ap.common.memoize import memoize
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.common.services.error_message_handler import ErrorMessageHandler
from ap.common.services.sse import AnnounceEvent
from ap.common.timezone_utils import choose_utc_convert_func
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    JobManagement,
    ProcLinkCount,
    make_session,
)
from ap.trace_data.transaction_model import TransactionData

JOB_ID = 'job_id'
JOB_NAME = 'job_name'
JOB_TYPE = 'job_type'
DB_CODE = 'db_code'
PROC_CODE = 'proc_code'
PROC_ID = 'proc_id'
DB_MASTER_NAME = 'db_master_name'
DONE_PERCENT = 'done_percent'
START_TM = 'start_tm'
END_TM = 'end_tm'
DURATION = 'duration'
STATUS = 'status'
PROCESS_MASTER_NAME = 'process_master_name'
DETAIL = 'detail'
DATA_TYPE_ERR = 'data_type_error'
ERROR_MSG = 'error_msg'
previous_disk_status = DiskUsageStatus.Normal


@memoize(cache_type=CacheType.CONFIG_DATA)
def get_all_proc_shown_names():
    return {proc.id: proc.shown_name for proc in CfgProcess.get_all(with_parent=True)}


@log_execution_time()
def get_background_jobs_service(page=1, per_page=50, sort_by='', order='', ignore_job_types=None, error_page=False):
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

    jobs = jobs.paginate(page, per_page, error_out=False)
    dic_procs = get_all_proc_shown_names()
    rows = []
    for _job in jobs.items:
        dic_job = _job.as_dict()
        job = DictToClass(**dic_job)

        # get job information and send to UI
        job_name = f'{job.job_type}_{job.process_id}' if job.process_id else job.job_type

        if not error_page and job.process_id is not None and job.process_id not in dic_procs:
            # do not show deleted process in job normal page -> show only job error page
            continue

        # get process shown name
        proc_name = dic_procs.get(job.process_id)
        if not proc_name:
            proc_name = job.process_name or ''

        row = {
            JOB_ID: job.id,
            JOB_NAME: job_name,
            JOB_TYPE: job.job_type or '',
            DB_CODE: job.db_code or '',
            DB_MASTER_NAME: job.db_name or '',
            DONE_PERCENT: job.done_percent or 0,
            START_TM: job.start_tm,
            END_TM: job.end_tm or '',
            DURATION: round(job.duration, 2),
            STATUS: str(job.status),
            PROCESS_MASTER_NAME: proc_name,
            DETAIL: '',
            ERROR_MSG: job.error_msg,
        }
        rows.append(row)

    # TODO get more info from jobs ( next_page, prev_page, total_pages...)
    return rows, jobs


def send_processing_info(
    generator_func,
    job_type: JobType,
    db_code=None,
    process_id=None,
    process_name=None,
    after_success_func=None,
    is_check_disk=True,
    **kwargs,
):
    """send percent, status to client

    Arguments:
        job_type {JobType} -- [description]
        generator_func {[type]} -- [description]
    """
    # add new job
    global previous_disk_status
    process_queue = read_pickle_file(get_multiprocess_queue_file())
    dic_config[PROCESS_QUEUE] = process_queue
    dic_progress = process_queue[ListenNotifyType.JOB_PROGRESS.name]
    error_msg_handler = ErrorMessageHandler()

    start_tm = dt.datetime.utcnow()
    with make_session() as meta_session:
        job = JobManagement()
        job.job_type = job_type.name
        job.db_code = db_code

        # datasource_idの代わりに、t_job_managementテーブルにdatasource_nameが保存される。
        if job.db_code is not None:
            data_source: CfgDataSource = CfgDataSource.query.get(job.db_code)
            job.db_name = data_source.name

        job.process_id = process_id

        # Yamlの代わりに、データベースからデータを取得する。
        job.process_name = process_name
        if not process_name:
            data_process: CfgProcess = CfgProcess.query.get(job.process_id)
            if data_process:
                job.process_name = data_process.name

        job.status = str(JobStatus.PROCESSING)
        meta_session.add(job)
        meta_session.commit()
        job = DictToClass(**job.as_dict())

    # processing info
    dic_res = {
        job.id: {
            JOB_ID: job.id,
            JOB_NAME: f'{job.job_type}_{job.process_id}' if job.process_id else job.job_type,
            JOB_TYPE: job.job_type,
            DB_CODE: job.db_code or '',
            PROC_CODE: job.process_name or '',
            PROC_ID: job.process_id or process_id or '',
            DB_MASTER_NAME: job.db_name or '',
            DONE_PERCENT: job.done_percent,
            START_TM: job.start_tm,
            END_TM: job.end_tm,
            DURATION: round(job.duration, 2),
            STATUS: str(job.status),
            PROCESS_MASTER_NAME: job.process_name or '',
            DETAIL: '',
        },
    }

    prev_job_info = None
    notify_data_type_error_flg = True
    while True:
        try:
            if is_check_disk:
                disk_capacity = get_disk_capacity_once(_job_id=job.id)

                if disk_capacity:
                    if previous_disk_status != disk_capacity.disk_status:
                        # background_announcer.announce(disk_capacity.to_dict(), AnnounceEvent.DISK_USAGE.name)
                        dic_progress[job.id] = (disk_capacity.to_dict(), AnnounceEvent.DISK_USAGE.name)
                        previous_disk_status = disk_capacity.disk_status

                    if disk_capacity.disk_status == DiskUsageStatus.Full:
                        raise disk_capacity

            job_info = next(generator_func)

            # update job details ( csv_import , gen global...)
            if isinstance(job_info, int):
                # job percent update
                job.done_percent = job_info
            elif isinstance(job_info, JobInfo):
                prev_job_info = job_info
                # job percent update
                job.done_percent = job_info.percent
                # update job details (csv_import...)

                # insert import history
                if not job_info.import_type:
                    job_info.import_type = job_type.name

                if job_type is JobType.CSV_IMPORT and job_info.empty_files:
                    # empty files
                    # background_announcer.announce(job_info.empty_files, AnnounceEvent.EMPTY_FILE.name,)
                    # process_queue.put_nowait((job_info.empty_files, AnnounceEvent.EMPTY_FILE.name))
                    # process_queue.send((job_info.empty_files, AnnounceEvent.EMPTY_FILE.name))
                    dic_progress[job.id] = (job_info.empty_files, AnnounceEvent.EMPTY_FILE.name)

                # job err msg
                update_job_management_status_n_error(job, job_info)
            elif job_type is JobType.GEN_GLOBAL:
                _, dic_cycle_ids, dic_edge_cnt = job_info
                save_proc_link_count(job.id, dic_cycle_ids, dic_edge_cnt)

        except StopIteration:
            job = update_job_management(job)

            # emit successful import data
            if prev_job_info and prev_job_info.has_record and after_success_func:
                proc_link_publish_flg = job_type in (
                    JobType.FACTORY_IMPORT,
                    JobType.CSV_IMPORT,
                )
                after_success_func(publish=proc_link_publish_flg)

            # stop while loop
            break
        except Exception as e:
            # update job status
            db.session.rollback()
            message = error_msg_handler.msg_from_exception(exception=e)
            job = update_job_management(job, message)
            logger.exception(str(e))
            traceback.print_exc()
            break
        finally:
            # notify if data type error greater than 100
            if notify_data_type_error_flg and prev_job_info and prev_job_info.data_type_error_cnt > COMPLETED_PERCENT:
                # background_announcer.announce(job.db_name, AnnounceEvent.DATA_TYPE_ERR.name)
                # process_queue.put_nowait((job.db_name, AnnounceEvent.DATA_TYPE_ERR.name))
                # process_queue.send((job.db_name, AnnounceEvent.DATA_TYPE_ERR.name))
                dic_progress[job.id] = (job.db_name, AnnounceEvent.DATA_TYPE_ERR.name)

                dic_res[job.id][DATA_TYPE_ERR] = True
                notify_data_type_error_flg = False

            # emit info
            dic_res[job.id][DONE_PERCENT] = job.done_percent
            dic_res[job.id][END_TM] = job.end_tm
            dic_res[job.id][DURATION] = round((dt.datetime.utcnow() - start_tm).total_seconds(), 2)
            # background_announcer.announce(dic_res, AnnounceEvent.JOB_RUN.name)
            # process_queue.put_nowait((dic_res, AnnounceEvent.JOB_RUN.name))
            # process_queue.send((dic_res, AnnounceEvent.JOB_RUN.name))
            dic_progress[job.id] = (dic_res, AnnounceEvent.JOB_RUN.name)

    dic_res[job.id][STATUS] = str(job.status)
    # background_announcer.announce(dic_res, AnnounceEvent.JOB_RUN.name)
    # process_queue.put_nowait((dic_res, AnnounceEvent.JOB_RUN.name))
    # process_queue.send((dic_res, AnnounceEvent.JOB_RUN.name))
    dic_progress[job.id] = (dic_res, AnnounceEvent.JOB_RUN.name)
    if job.job_type == JobType.CSV_IMPORT.name:
        dic_register_progress = {
            'status': job.status,
            'process_id': job.process_id,
            'is_first_imported': False,
        }
        dic_progress[job.id] = (dic_register_progress, AnnounceEvent.DATA_REGISTER.name)


def update_job_management(job, err=None):
    """update job status

    Arguments:
        job {[type]} -- [description]
        done_percent {[type]} -- [description]
    """
    with make_session() as meta_session:
        job = JobManagement(**job.__dict__)
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
            job.status = JobStatus.FATAL.name if job.status == JobStatus.FATAL else JobStatus.FAILED.name
            job.error_msg = err or job.error_msg or UNKNOWN_ERROR_TEXT

        job.duration = round(
            (dt.datetime.utcnow() - dt.datetime.strptime(job.start_tm, DATE_FORMAT_STR)).total_seconds(),
            2,
        )
        job.end_tm = get_current_timestamp()

        meta_session.merge(job)
        job = DictToClass(**job.as_dict())

    return job


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


def update_job_management_status_n_error(job, job_info: JobInfo):
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
