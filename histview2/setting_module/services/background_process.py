import datetime as dt
import math
import re
import traceback

from flask_babel import gettext as _
from sqlalchemy import desc

from histview2.common.common_utils import DATE_FORMAT_STR, DATE_FORMAT_STR_FACTORY_DB, convert_time
from histview2.common.constants import *
from histview2.common.logger import logger, log_execution_time
from histview2.common.scheduler import JobType, dic_running_job
from histview2.common.services.sse import background_announcer, AnnounceEvent
from histview2.common.timezone_utils import choose_utc_convert_func
from histview2.setting_module.models import *
from histview2.setting_module.models import JobManagement, CsvImport, FactoryImport
from histview2.common.disk_usage import get_disk_capacity_once

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


@log_execution_time()
def get_background_jobs_service():
    """
    Get background jobs from JobManagement table
    """

    dic_running_job_keys = set(dic_running_job.keys())
    days_ago = dt.datetime.utcnow() - dt.timedelta(days=1)
    jobs_from_db = JobManagement.query.filter(JobManagement.start_tm > days_ago.strftime(DATE_FORMAT_STR)).order_by(
        desc(JobManagement.id)).all()

    jobs = {}
    for job in jobs_from_db:
        # check and force dangling jobs to be FAILED
        if job.job_type in (JobType.CSV_IMPORT.name, JobType.FACTORY_IMPORT.name, JobType.FACTORY_PAST_IMPORT.name):
            job_running_id = {f'{job.job_type}_{job.process_id}'}
        elif job.job_type == JobType.GEN_GLOBAL.name:
            job_running_id = {f'_{job.job_type}', f'{job.job_type}'}
        else:
            job_running_id = {job.job_type}

        # status is PROCESSING but actually the job is not running -> forced to be FAILED
        if not (job_running_id & dic_running_job_keys) and job.status == JobStatus.PROCESSING.name:
            job.status = JobStatus.FAILED.name
            job.error_msg = FORCED_TO_BE_FAILED

        # get job information and send to UI
        if job.job_type:
            job_name = _(job.job_type)
        else:
            job_name = job.id

        jobs[job.id] = {
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
            PROCESS_MASTER_NAME: job.process_name or '',
            DETAIL: ''
        }

    return jobs


def send_processing_info(generator_func, job_type: JobType, db_code=None, process_id=None, process_name=None,
                         after_success_func=None, is_check_disk=True):
    """ send percent, status to client

    Arguments:
        job_type {JobType} -- [description]
        generator_func {[type]} -- [description]
    """
    # add new job
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
        job.process_name = None
        if process_name:
            data_process: CfgProcess = CfgProcess.query.get(job.process_id)
            job.process_name = data_process.name

        job.status = str(JobStatus.PROCESSING)
        meta_session.add(job)
        meta_session.commit()

        # processing info
        dic_res = {job.id: {
            JOB_ID: job.id,
            JOB_NAME: job.job_type or job.id or '',
            JOB_TYPE: job.job_type,
            DB_CODE: job.db_code or '',
            PROC_CODE: process_name or '',
            PROC_ID: job.process_id or process_id or '',
            DB_MASTER_NAME: job.db_name or '',
            DONE_PERCENT: job.done_percent,
            START_TM: job.start_tm,
            END_TM: job.end_tm,
            DURATION: round(job.duration, 2),
            STATUS: str(job.status),
            PROCESS_MASTER_NAME: job.process_name or '',
            DETAIL: ''
        }}

        # time variable ( use for set start time in csv import)
        anchor_tm = get_current_timestamp()
        prev_job_info = None
        notify_data_type_error_flg = True
        while True:
            try:
                if is_check_disk:
                    disk_capacity = get_disk_capacity_once(_job_id=job.id)
                    if disk_capacity:
                        background_announcer.announce(disk_capacity.to_dict(),
                                                                   AnnounceEvent.DISK_USAGE.name)
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
                    if job_type is JobType.CSV_IMPORT:
                        detail_rec = insert_csv_import_info(job, anchor_tm, job_info)
                        if detail_rec:
                            # update new status
                            meta_session.add(detail_rec)
                            meta_session.commit()
                            anchor_tm = get_current_timestamp()

                        # empty files
                        if job_info.empty_files:
                            background_announcer.announce(job_info.empty_files, AnnounceEvent.EMPTY_FILE.name)

                    elif job_type in (JobType.FACTORY_IMPORT, JobType.FACTORY_PAST_IMPORT):
                        detail_rec = insert_factory_import_info(job, anchor_tm, job_info)
                        if detail_rec:
                            meta_session.add(detail_rec)
                            meta_session.commit()
                            anchor_tm = get_current_timestamp()

                    # job err msg
                    update_job_management_status_n_error(job, job_info)
                else:
                    if job_type is JobType.GEN_GLOBAL:
                        _, dic_cycle_ids, dic_edge_cnt = job_info
                        save_proc_link_history(meta_session, job.id, dic_cycle_ids, dic_edge_cnt)
                        meta_session.commit()

            except StopIteration:
                update_job_management(job)

                # emit successful import data
                if prev_job_info and prev_job_info.has_record:
                    # call gen global id job
                    if after_success_func:
                        proc_link_publish_flg = job_type in (JobType.FACTORY_IMPORT, JobType.CSV_IMPORT)
                        after_success_func(proc_link_publish_flg)

                # stop while loop
                break
            except Exception as e:
                # update job status
                db.session.rollback()
                update_job_management(job, str(e))
                logger.exception(str(e))
                traceback.print_exc()
                break
            finally:
                # notify if data type error greater than 100
                if notify_data_type_error_flg and prev_job_info and prev_job_info.data_type_error_cnt > 100:
                    background_announcer.announce(job.db_name, AnnounceEvent.DATA_TYPE_ERR.name)
                    dic_res[job.id][DATA_TYPE_ERR] = True
                    notify_data_type_error_flg = False

                # emit info
                dic_res[job.id][DONE_PERCENT] = job.done_percent
                dic_res[job.id][END_TM] = job.end_tm
                dic_res[job.id][DURATION] = round((dt.datetime.utcnow() - start_tm).total_seconds(), 2)
                background_announcer.announce(dic_res, AnnounceEvent.JOB_RUN.name)

        dic_res[job.id][STATUS] = str(job.status)
        background_announcer.announce(dic_res, AnnounceEvent.JOB_RUN.name)


def update_job_management(job, err=None):
    """ update job status

    Arguments:
        job {[type]} -- [description]
        done_percent {[type]} -- [description]
    """

    if not err and not job.error_msg and (
            job.done_percent == 100 or job.status in (JobStatus.PROCESSING.name, JobStatus.DONE.name)):
        job.status = JobStatus.DONE.name
        job.done_percent = 100
        job.error_msg = None
    else:
        job.status = job.status or JobStatus.FAILED.name
        job.error_msg = err or job.error_msg or 'An unidentified error has occurred'

    job.duration = round(
        (dt.datetime.utcnow() - dt.datetime.strptime(job.start_tm, DATE_FORMAT_STR)).total_seconds(), 2)
    job.end_tm = get_current_timestamp()


def insert_csv_import_info(job, start_tm, dic_detail):
    """ insert csv import information

    Arguments:
        job {[type]} -- [description]
        file_name {[type]} -- [description]
        imported_row {[type]} -- [description]
        error_msg {[type]} -- [description]
    """

    csv_import_mana = CsvImport()
    csv_import_mana.job_id = job.id
    csv_import_mana.process_id = job.process_id
    csv_import_mana.status = str(dic_detail.status)
    csv_import_mana.file_name = dic_detail.target
    csv_import_mana.imported_row = dic_detail.committed_count
    csv_import_mana.error_msg = dic_detail.err_msg
    csv_import_mana.start_tm = job.start_tm or start_tm
    csv_import_mana.end_tm = job.end_tm or get_current_timestamp()

    return csv_import_mana


def insert_factory_import_info(job, start_tm, dic_detail):
    """ insert csv import information

    Arguments:
        job {[type]} -- [description]
        file_name {[type]} -- [description]
        imported_row {[type]} -- [description]
        error_msg {[type]} -- [description]
    """

    import_frm = format_factory_date_to_meta_data(dic_detail.first_cycle_time, dic_detail.auto_increment_col_timezone)
    import_to = format_factory_date_to_meta_data(dic_detail.last_cycle_time, dic_detail.auto_increment_col_timezone)

    fac_import_mana = FactoryImport()
    fac_import_mana.job_id = job.id
    fac_import_mana.process_id = job.process_id
    fac_import_mana.import_type = job.job_type
    fac_import_mana.import_from = import_frm
    fac_import_mana.import_to = import_to
    fac_import_mana.status = str(dic_detail.status)
    fac_import_mana.imported_row = dic_detail.committed_count
    fac_import_mana.error_msg = dic_detail.err_msg
    fac_import_mana.start_tm = job.start_tm or start_tm
    fac_import_mana.end_tm = job.end_tm or get_current_timestamp()

    return fac_import_mana


class JobInfo:
    auto_increment_col_timezone: bool
    percent: int
    status: JobStatus
    row_count: int
    committed_count: int
    has_record: bool
    exception: Exception
    empty_files: List[str]

    def __init__(self):
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
        percent = row_count * 100 / total
        percent = math.floor(percent)
        if percent >= 100:
            percent = 99

        self.percent = percent


def format_factory_date_to_meta_data(date_val, is_tz_col):
    if is_tz_col:
        convert_utc_func, _ = choose_utc_convert_func(date_val)
        date_val = convert_utc_func(date_val)
        date_val = date_val.replace('T', ' ')
        regex_str = r"(\.)(\d{3})(\d{3})"
        date_val = re.sub(regex_str, f'\\1\\2', date_val)
    else:
        date_val = convert_time(date_val, format_str=DATE_FORMAT_STR_FACTORY_DB, only_milisecond=True)

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
    if job:
        if job.job_type == JobType.CSV_IMPORT.name:
            job_details = CsvImport.get_error_jobs(job_id=job_id)
        else:
            job_details = FactoryImport.get_error_jobs(job_id=job_id)

        if job.error_msg:
            job_details = [job] + job_details

        for job_detail in job_details:
            job_details_as_dict[job_detail.id] = row2dict(job_detail)

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


def save_proc_link_history(meta_session, job_id, dic_cycle_ids, dic_edge_cnt):
    for (start_proc_id, end_proc_id), matched_cnt in dic_edge_cnt.items():
        proc_link_hist = ProcLink()
        proc_link_hist.job_id = job_id
        proc_link_hist.process_id = start_proc_id
        proc_link_hist.target_process_id = end_proc_id
        proc_link_hist.matched_count = matched_cnt
        meta_session.add(proc_link_hist)

    # save process matched count to db
    for proc_id, cycle_ids in dic_cycle_ids.items():
        proc_link_hist = ProcLink()
        proc_link_hist.job_id = job_id
        proc_link_hist.process_id = proc_id
        proc_link_hist.matched_count = len(cycle_ids)
        meta_session.add(proc_link_hist)

    return meta_session


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
