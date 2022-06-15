import json
from contextlib import contextmanager
from typing import Union, List, Dict

from flask import g
from sqlalchemy import func, and_, or_, event, Index
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import load_only

from histview2 import Session
from histview2 import db
from histview2.common.common_utils import get_current_timestamp, dict_deep_merge
from histview2.common.constants import JobStatus, FlaskGKey, CsvDelimiter, DataType, CfgConstantType, \
    EFA_HEADER_FLAG, DiskUsageStatus, DEFAULT_WARNING_DISK_USAGE, DEFAULT_ERROR_DISK_USAGE
from histview2.common.constants import RelationShip
from histview2.common.cryptography_utils import decrypt_pwd
from histview2.common.memoize import set_all_cache_expired
from histview2.common.services.normalization import model_normalize
from histview2.common.trace_data_log import Location, ReturnCode, LogLevel
from histview2.setting_module.forms import DataSourceCsvForm, ProcessCfgForm


@contextmanager
def make_session():
    try:
        session = g.setdefault(FlaskGKey.APP_DB_SESSION, Session())
    except Exception:
        # for unit test
        session = Session()

    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e


class JobManagement(db.Model):  # TODO change to new modal and edit job
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_job_management'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)

    job_type = db.Column(db.Text())
    db_code = db.Column(db.Text())
    db_name = db.Column(db.Text())
    process_id = db.Column(db.Integer())
    process_name = db.Column(db.Text())

    start_tm = db.Column(db.Text(), default=get_current_timestamp)
    end_tm = db.Column(db.Text())
    status = db.Column(db.Text())
    done_percent = db.Column(db.Float(), default=0)
    duration = db.Column(db.Float(), default=0)
    error_msg = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    csv_imports = db.relationship('CsvImport', lazy='dynamic')
    gen_global = db.relationship('GenGlobalId', lazy='dynamic')

    @classmethod
    def check_new_jobs(cls, from_job_id, target_job_types):
        out = cls.query.options(load_only(cls.id))
        return out.filter(cls.id > from_job_id).filter(cls.job_type.in_(target_job_types)).first()

    @classmethod
    def get_last_job_id_by_jobtype(cls, job_type):
        out = cls.query.options(load_only(cls.id))
        return out.filter(cls.job_type == job_type).order_by(cls.id.desc()).first()

    @classmethod
    def get_last_job_of_process(cls, proc_id, job_type):
        out = cls.query.options(load_only(cls.id))
        return out.filter(cls.process_id == proc_id).filter(cls.job_type == job_type).order_by(cls.id.desc()).first()

    @classmethod
    def get_error_jobs(cls, job_id):
        infos = cls.query.filter(cls.id == job_id).filter(cls.status != str(JobStatus.DONE))
        return infos.all()


class CsvImport(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_csv_import'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    job_id = db.Column(db.Integer(), db.ForeignKey('t_job_management.id'), index=True)

    process_id = db.Column(db.Integer())
    file_name = db.Column(db.Text())

    start_tm = db.Column(db.Text(), default=get_current_timestamp)
    end_tm = db.Column(db.Text())
    imported_row = db.Column(db.Integer(), default=0)
    status = db.Column(db.Text())
    error_msg = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def get_last_job_id(cls, process_id):
        max_job = cls.query.filter(cls.process_id == process_id).with_entities(func.max(cls.job_id).label('job_id'))
        return max_job

    @classmethod
    def get_last_fatal_import(cls, process_id):
        max_job = cls.get_last_job_id(process_id).subquery()
        csv_imports = cls.query.filter(cls.job_id == max_job.c.job_id,
                                       cls.status.in_([JobStatus.FATAL.name, JobStatus.PROCESSING.name]))
        csv_imports = csv_imports.order_by(cls.id).all()

        return csv_imports

    @classmethod
    def get_by_job_id(cls, job_id):
        csv_imports = cls.query.filter(cls.job_id == job_id)
        return csv_imports.all()

    @classmethod
    def get_error_jobs(cls, job_id):
        csv_imports = cls.query.filter(cls.job_id == job_id).filter(cls.status != str(JobStatus.DONE))
        return csv_imports.all()

    @classmethod
    def get_latest_done_files(cls, process_id):
        csv_files = cls.query.filter(cls.process_id == process_id,
                                     cls.status.in_([JobStatus.DONE.name, JobStatus.FAILED.name]))

        csv_files = csv_files.with_entities(cls.file_name,
                                            func.max(cls.start_tm).label(cls.start_tm.key),
                                            func.max(cls.imported_row).label(cls.imported_row.key))

        csv_files = csv_files.group_by(cls.file_name).all()

        return csv_files


Index(f'ix_t_csv_import_process_id_status_file_name', CsvImport.process_id, CsvImport.status, CsvImport.file_name)


# TODO: remove
class GenGlobalId(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_gen_global_id'

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    job_id = db.Column(db.Integer(), db.ForeignKey('t_job_management.id'), index=True)

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)


class ProcLink(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_proc_link'

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    job_id = db.Column(db.Integer(), db.ForeignKey('t_job_management.id'), index=True)

    process_id = db.Column(db.Integer())
    target_process_id = db.Column(db.Integer())
    matched_count = db.Column(db.Integer(), default=0)

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def delete_all(cls):
        """delete all records
        """
        # cls.query.delete()
        with make_session() as meta_session:
            meta_session.query(cls).delete()

    @classmethod
    def calc_proc_link(cls):
        with make_session() as meta_session:
            output = meta_session.query(cls.process_id, cls.target_process_id,
                                        func.sum(cls.matched_count).label(cls.matched_count.key))
            output = output.group_by(cls.process_id, cls.target_process_id).all()

        return output


class CfgConstant(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_constant'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    type = db.Column(db.Text())
    name = db.Column(db.Text())
    value = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_value_by_type_first(cls, type, parse_val=None):
        output = cls.query.options(load_only(cls.value)).filter(cls.type == type).first()
        if not output:
            return None

        return output.value if not parse_val else parse_val(output.value)

    @classmethod
    def get_value_by_type_name(cls, type, name, parse_val=None):
        output = cls.query.options(load_only(cls.value)).filter(cls.type == type, cls.name == name).first()
        if not output:
            return None

        return output.value if not parse_val else parse_val(output.value)

    @classmethod
    def create_or_update_by_type(cls, const_type=None, const_value=0, const_name=None):
        with make_session() as meta_session:
            constant = None
            if const_type:
                constant = meta_session.query(cls).filter(cls.type == const_type)

                if const_name:
                    constant = constant.filter(cls.name == const_name)

                constant = constant.first()

            if not constant:
                constant = cls(type=const_type, value=const_value, name=const_name)
                meta_session.add(constant)
            else:
                constant.value = const_value

    @classmethod
    def create_or_merge_by_type(cls, const_type=None, const_name=None, const_value=0):
        with make_session() as meta_session:
            constant = meta_session.query(cls).filter(cls.type == const_type, cls.name == const_name).first()
            if not constant:
                constant = cls(type=const_type, name=const_name, value=json.dumps(const_value))
                meta_session.add(constant)
            else:
                # merge new order to old orders
                dic_value = json.loads(constant.value)
                dic_latest_orders = dict_deep_merge(const_value, dic_value)
                constant.value = json.dumps(dic_latest_orders)

    @classmethod
    def get_efa_header_flag(cls, data_source_id):
        efa_header_flag = cls.query.filter(
            cls.type == CfgConstantType.EFA_HEADER_EXISTS.name,
            cls.name == data_source_id
        ).first()

        if efa_header_flag and efa_header_flag.value and efa_header_flag.value == EFA_HEADER_FLAG:
            return True
        return False

    @classmethod
    def get_warning_disk_usage(cls) -> int:
        return cls.get_value_by_type_name(CfgConstantType.DISK_USAGE_CONFIG.name, DiskUsageStatus.Warning.name,
                                          parse_val=int)

    @classmethod
    def get_error_disk_usage(cls) -> int:
        return cls.get_value_by_type_name(CfgConstantType.DISK_USAGE_CONFIG.name, DiskUsageStatus.Full.name,
                                          parse_val=int)

    @classmethod
    def initialize_disk_usage_limit(cls):
        """
        Sets default disk usage limit constants.
            - Warning: 80% (No terminate jobs)
            - Error: 90% (Terminate jobs)

        :return:
        """
        constants_type = CfgConstantType.DISK_USAGE_CONFIG.name
        warning_percent = cls.get_warning_disk_usage()
        if not warning_percent:  # insert of not existing
            warning_percent = DEFAULT_WARNING_DISK_USAGE
            cls.create_or_update_by_type(constants_type, warning_percent,
                                         const_name=DiskUsageStatus.Warning.name)

        error_percent = cls.get_error_disk_usage()
        if not error_percent:  # insert of not existing
            error_percent = DEFAULT_ERROR_DISK_USAGE

            cls.create_or_update_by_type(constants_type, error_percent,
                                         const_name=DiskUsageStatus.Full.name)


class CfgDataSource(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    name = db.Column(db.Text())
    type = db.Column(db.Text())
    comment = db.Column(db.Text())
    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)
    db_detail = db.relationship("CfgDataSourceDB", lazy='subquery', backref="cfg_data_source", uselist=False,
                                cascade='all')
    csv_detail = db.relationship("CfgDataSourceCSV", lazy='subquery', backref="cfg_data_source", uselist=False,
                                 cascade='all')
    processes = db.relationship('CfgProcess', lazy="dynamic", cascade='all')

    @classmethod
    def delete(cls, meta_session, id):
        meta_session.query.filter(cls.id == id).delete()

    @classmethod
    def get_all(cls):
        all_ds = cls.query.order_by(cls.order).all()
        for ds in all_ds:
            db_detail: CfgDataSourceDB = ds.db_detail
            if db_detail and db_detail.hashed:
                db_detail.password = decrypt_pwd(db_detail.password)
        return all_ds

    @classmethod
    def get_all_db_source(cls):
        all_ds = cls.query.filter(cls.type != "CSV").order_by(cls.order).all()
        for ds in all_ds:
            db_detail: CfgDataSourceDB = ds.db_detail
            if db_detail and db_detail.hashed:
                db_detail.password = decrypt_pwd(db_detail.password)
        return all_ds

    @classmethod
    def get_ds(cls, ds_id):
        ds = cls.query.get(ds_id)
        db_detail: CfgDataSourceDB = ds.db_detail
        if db_detail and db_detail.hashed:
            db_detail.password = decrypt_pwd(db_detail.password)
        return ds

    @classmethod
    def update_order(cls, meta_session, data_source_id, order):
        meta_session.query(cls).filter(cls.id == data_source_id).update({cls.order: order})

    # @classmethod
    # def get_detail(cls, id):
    #     ds = cls.query.get(id)
    #     if ds.type == DBType.CSV.value:
    #         return ds.csv_detail
    #
    #     return ds.db_detail

    # @classmethod
    # def get_or_create(cls, meta_session, id):
    #     rec = meta_session.query.get(id)
    #     if not rec:
    #         rec = cls()
    #
    #     return rec


class CfgDataSourceDB(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source_db'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete="CASCADE"), primary_key=True)
    host = db.Column(db.Text())
    port = db.Column(db.Integer())
    dbname = db.Column(db.Text())
    schema = db.Column(db.Text())
    username = db.Column(db.Text())
    password = db.Column(db.Text())
    hashed = db.Column(db.Boolean(), default=False)
    use_os_timezone = db.Column(db.Boolean(), default=False)
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    # @classmethod
    # def save(cls, form: DataSourceDbForm):
    #     if form.id:
    #         row = cls()
    #     else:
    #         row = cls.query.filter(cls.id == form.id)
    #
    #     # create dataSource ins
    #     # TODO pwd encrypt
    #     form.populate_obj(row)
    #
    #     return row

    @classmethod
    def delete(cls, id):
        cls.query.filter(cls.id == id).delete()


class CfgCsvColumn(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_csv_column'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    data_source_id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source_csv.id', ondelete="CASCADE"))
    column_name = db.Column(db.Text())
    data_type = db.Column(db.Text())
    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)


class CfgProcessColumn(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process_column'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete="CASCADE"))
    column_name = db.Column(db.Text())
    english_name = db.Column(db.Text())
    name = db.Column(db.Text())
    data_type = db.Column(db.Text())
    operator = db.Column(db.Text())
    coef = db.Column(db.Text())
    column_type = db.Column(db.Integer())
    is_serial_no = db.Column(db.Boolean(), default=False)
    is_get_date = db.Column(db.Boolean(), default=False)
    is_auto_increment = db.Column(db.Boolean(), default=False)
    order = db.Column(db.Integer())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    # TODO trace key, cfg_filter: may not needed
    # visualizations = db.relationship('CfgVisualization', lazy='dynamic', backref="cfg_process_column", cascade="all")

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def get_by_col_name(cls, proc_id, col_name):
        return cls.query.filter(cls.process_id == proc_id, cls.column_name == col_name).first()

    @classmethod
    def get_by_data_type(cls, proc_id, data_type: DataType):
        return cls.query.filter(cls.process_id == proc_id, cls.data_type == data_type.name).all()

    @classmethod
    def get_by_ids(cls, ids):
        return cls.query.filter(cls.id.in_(ids)).all()

    @classmethod
    def get_serials(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id, cls.is_serial_no == 1).all()

    @classmethod
    def get_all_columns(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id).all()


class CfgProcess(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    name = db.Column(db.Text())
    data_source_id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete="CASCADE"))
    table_name = db.Column(db.Text())
    comment = db.Column(db.Text())

    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    # TODO check fetch all
    columns: List[CfgProcessColumn] = db.relationship('CfgProcessColumn', lazy='joined', backref="cfg_process",
                                                      cascade="all")
    traces = db.relationship('CfgTrace', lazy='dynamic', foreign_keys='CfgTrace.self_process_id', backref="cfg_process",
                             cascade="all")
    filters = db.relationship('CfgFilter', lazy='dynamic', backref="cfg_process", cascade="all")
    visualizations = db.relationship('CfgVisualization', lazy='dynamic', backref="cfg_process", cascade="all")
    data_source = db.relationship('CfgDataSource', lazy='select')

    def get_date_col(self, column_name_only=True):
        """
        get date column
        :param column_name_only:
        :return:
        """
        cols = [col for col in self.columns if col.is_get_date]
        if cols:
            if column_name_only:
                return cols[0].column_name

            return cols[0]

        return None

    def get_auto_increment_col(self, column_name_only=True):
        """
        get auto increment column
        :param column_name_only:
        :return:
        """
        cols = [col for col in self.columns if col.is_auto_increment]
        if cols:
            if column_name_only:
                return cols[0].column_name

            return cols[0]

        return None

    def get_auto_increment_col_else_get_date(self, column_name_only=True):
        """
        get auto increment column
        :param column_name_only:
        :return:
        """
        return self.get_auto_increment_col(column_name_only) or self.get_date_col(column_name_only)

    def get_serials(self, column_name_only=True):
        if column_name_only:
            cols = [col.column_name for col in self.columns if col.is_serial_no]
        else:
            cols = [col for col in self.columns if col.is_serial_no]

        return cols

    def get_order_cols(self, column_name_only=True):
        cols = [col for col in self.columns if col.order or col.is_serial_no]
        if column_name_only:
            cols = [col.column_name for col in cols]

        return cols

    def get_cols(self, col_ids=()):
        cols = [col for col in self.columns if col.id in col_ids]
        return cols

    def get_cols_by_data_type(self, data_type: DataType, column_name_only=True):
        """
        get date column
        :param data_type:
        :param column_name_only:
        :return:
        """
        if column_name_only:
            cols = [col.column_name for col in self.columns if col.data_type == data_type.name]
        else:
            cols = [col for col in self.columns if col.data_type == data_type.name]

        return cols

    @classmethod
    def get_all(cls):
        return cls.query.order_by(cls.order).all()

    @classmethod
    def get_all_ids(cls):
        return cls.query.options(load_only(cls.id)).all()

    @classmethod
    def get_all_order_by_id(cls):
        return cls.query.order_by(cls.id).all()

    @classmethod
    def get_procs(cls, ids):
        return cls.query.filter(cls.id.in_(ids))

    @classmethod
    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def save(cls, meta_session, form: ProcessCfgForm):
        if not form.id.data:
            row = cls()
            meta_session.add(row)
        else:
            row = meta_session.query(cls).get(form.id.data)
            # row.columns = [ProcessColumnsForm]
            # for column in columns:
            #     columObj = CfgProcessColumn(**column)
            #     meta_session.add(columObj)
        # form.populate_obj(row)
        meta_session.commit()
        return row

    @classmethod
    def delete(cls, proc_id):
        # TODO refactor
        with make_session() as meta_session:
            proc = meta_session.query(cls).get(proc_id)
            if not proc:
                return False

            meta_session.delete(proc)

            # delete traces manually
            meta_session.query(CfgTrace).filter(
                or_(CfgTrace.self_process_id == proc_id, CfgTrace.target_process_id == proc_id)
            ).delete()

            # delete linking prediction manually
            meta_session.query(ProcLink).filter(
                or_(ProcLink.process_id == proc_id, ProcLink.target_process_id == proc_id)
            ).delete()

            meta_session.commit()

        return True

    @classmethod
    def update_order(cls, meta_session, process_id, order):
        meta_session.query(cls).filter(cls.id == process_id).update({cls.order: order})


class CfgTraceKey(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_trace_key'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    trace_id = db.Column(db.Integer(), db.ForeignKey('cfg_trace.id', ondelete="CASCADE"))
    # TODO confirm PO delete
    self_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete="CASCADE"))
    self_column_substr_from = db.Column(db.Integer())
    self_column_substr_to = db.Column(db.Integer())

    target_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete="CASCADE"))
    target_column_substr_from = db.Column(db.Integer())
    target_column_substr_to = db.Column(db.Integer())

    order = db.Column(db.Integer())

    self_column = db.relationship('CfgProcessColumn', foreign_keys=[self_column_id], lazy='joined')
    target_column = db.relationship('CfgProcessColumn', foreign_keys=[target_column_id], lazy='joined')

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class CfgTrace(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_trace'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    self_process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete="CASCADE"))
    target_process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete="CASCADE"))
    is_trace_backward = db.Column(db.Boolean(), default=False)

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    trace_keys: List[CfgTraceKey] = db.relationship('CfgTraceKey', lazy='joined', backref="cfg_trace", cascade="all")

    self_process = db.relationship('CfgProcess', foreign_keys=[self_process_id], lazy='joined')
    target_process = db.relationship('CfgProcess', foreign_keys=[target_process_id], lazy='joined')

    @classmethod
    def get_all(cls):
        return cls.query.all()

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def get_cols_between_two(cls, proc_id1, proc_id2):
        trace = cls.query.filter(or_(
            and_(cls.self_process_id == proc_id1, cls.target_process_id == proc_id2),
            and_(cls.self_process_id == proc_id2, cls.target_process_id == proc_id1)
        )).first()

        cols = set()
        if trace:
            [cols.update([key.self_column_id, key.target_column_id]) for key in trace.trace_keys]
        return cols


class CfgFilterDetail(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_filter_detail'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    filter_id = db.Column(db.Integer(), db.ForeignKey('cfg_filter.id', ondelete="CASCADE"))
    parent_detail_id = db.Column(db.Integer(), db.ForeignKey(id, ondelete="CASCADE"))
    name = db.Column(db.Text())
    filter_condition = db.Column(db.Text())
    filter_function = db.Column(db.Text())
    filter_from_pos = db.Column(db.Integer())

    order = db.Column(db.Integer())

    parent = db.relationship('CfgFilterDetail', lazy='joined', backref="cfg_children", remote_side=[id], uselist=False)
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    def update_by_dict(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

    @classmethod
    def get_filters(cls, ids):
        return cls.query.filter(cls.id.in_(ids))

    def __eq__(self, other):
        return (isinstance(other, self.__class__) and getattr(other, self.id.key, None) and self.id and
                getattr(other, self.id.key, None) == self.id)

    def __hash__(self):
        return hash(str(self.id))


def get_or_create(db_session, model, **kwargs):
    instance = db_session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance
    else:
        instance = model(**kwargs)
        db_session.add(instance)
        db_session.commit()
        return instance


class CfgFilter(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_filter'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete="CASCADE"))
    name = db.Column(db.Text())
    column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete="CASCADE"))  # TODO confirm PO
    filter_type = db.Column(db.Text())
    parent_id = db.Column(db.Integer(), db.ForeignKey(id, ondelete="CASCADE"),
                          nullable=True)  # TODO check if needed to self ref

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    parent = db.relationship('CfgFilter', lazy='joined', backref="cfg_children", remote_side=[id], uselist=False)
    column = db.relationship('CfgProcessColumn', lazy='joined', backref="cfg_filters", uselist=False)
    filter_details = db.relationship('CfgFilterDetail', lazy='joined', backref="cfg_filter", cascade="all")

    @classmethod
    def delete_by_id(cls, meta_session, filter_id):
        cfg_filter = meta_session.query(cls).get(filter_id)
        if cfg_filter:
            meta_session.delete(cfg_filter)

    @classmethod
    def get_filters(cls, ids):
        return cls.query.filter(cls.id.in_(ids))

    @classmethod
    def get_filter_by_col_id(cls, column_id):
        return cls.query.filter(cls.column_id == column_id).first()

    @classmethod
    def get_by_proc_n_col_ids(cls, proc_ids, column_ids):
        return cls.query.filter(cls.process_id.in_(proc_ids), cls.column_id.in_(column_ids)).all()


class CfgVisualization(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_visualization'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete="CASCADE"))
    # TODO confirm PO
    control_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete="CASCADE"))
    filter_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete="CASCADE"),
                                 nullable=True)
    # filter_column_id = db.Column(db.Integer(), nullable=True)
    filter_value = db.Column(db.Text())
    is_from_data = db.Column(db.Boolean(), default=False)
    filter_detail_id = db.Column(db.Integer(), db.ForeignKey('cfg_filter_detail.id', ondelete="CASCADE"), nullable=True)

    ucl = db.Column(db.Float())
    lcl = db.Column(db.Float())
    upcl = db.Column(db.Float())
    lpcl = db.Column(db.Float())
    ymax = db.Column(db.Float())
    ymin = db.Column(db.Float())

    # TODO check default value, null is OK
    act_from = db.Column(db.Text())
    act_to = db.Column(db.Text())

    order = db.Column(db.Integer())

    control_column = db.relationship('CfgProcessColumn', foreign_keys=[control_column_id], lazy='joined')
    filter_column = db.relationship('CfgProcessColumn', foreign_keys=[filter_column_id], lazy='joined')
    filter_detail = db.relationship('CfgFilterDetail', lazy='joined')

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)
    deleted_at = db.Column(db.Text())

    @classmethod
    def get_filter_ids(cls):
        return db.session.query(cls.filter_detail_id).filter(cls.filter_detail_id > 0)

    @classmethod
    def get_by_control_n_filter_detail_ids(cls, col_id, filter_detail_ids, start_tm, end_tm):
        return cls.query.filter(
            and_(cls.control_column_id == col_id, cls.filter_detail_id.in_(filter_detail_ids), )).filter(
            or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == '')).filter(
            or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == '')).order_by(cls.act_from.desc()).all()

    @classmethod
    def get_sensor_default_chart_info(cls, col_id, start_tm, end_tm):
        # TODO: not deleted, ...
        return cls.query.filter(cls.control_column_id == col_id) \
            .filter(and_(cls.filter_detail_id.is_(None))) \
            .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == '')) \
            .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == '')) \
            .order_by(cls.act_from.desc()).all()

    @classmethod
    def get_by_control_n_filter_col_id(cls, col_id, filter_col_id, start_tm, end_tm):
        # TODO: not deleted, ...
        return cls.query.filter(
            and_(cls.control_column_id == col_id,
                 cls.filter_column_id == filter_col_id,
                 cls.filter_value.is_(None),
                 cls.filter_detail_id.is_(None),
                 )) \
            .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == '')) \
            .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == '')) \
            .order_by(cls.act_from.desc()).all()

    @classmethod
    def get_all_by_control_n_filter_col_id(cls, col_id, filter_col_id, start_tm, end_tm):
        # TODO: not deleted, ...
        return cls.query.filter(
            and_(cls.control_column_id == col_id,
                 cls.filter_column_id == filter_col_id,
                 )) \
            .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == '')) \
            .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == '')) \
            .order_by(cls.act_from.desc()).all()

    @classmethod
    def get_by_filter_detail_id(cls, col_id, filter_detail_id, start_tm, end_tm):
        # TODO: not deleted, ...
        return cls.query.filter(and_(cls.control_column_id == col_id, cls.filter_detail_id == filter_detail_id)) \
            .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == '')) \
            .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == '')) \
            .order_by(cls.act_from.desc()).all()


class DataTraceLog(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_data_trace_log'

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    date_time = db.Column(db.Text(), default=get_current_timestamp)
    dataset_id = db.Column(db.Text())
    event_type = db.Column(db.Text())
    event_action = db.Column(db.Text())
    target = db.Column(db.Text())
    exe_time = db.Column(db.Integer())
    data_size = db.Column(db.Integer())
    rows = db.Column(db.Integer())
    cols = db.Column(db.Integer())
    dumpfile = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def get_max_id(cls):
        out = cls.query.options(load_only(cls.id)).order_by(cls.id.desc()).first()
        if out:
            return out.id
        else:
            return 0

    @classmethod
    def get_dataset_id(cls, dataset_id, action):
        return cls.query.filter(cls.dataset_id == dataset_id, cls.event_action == action).all()


class AbnormalTraceLog(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_abnormal_trace_log'

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    date_time = db.Column(db.Text(), default=get_current_timestamp)
    dataset_id = db.Column(db.Integer(), autoincrement=True)
    log_level = db.Column(db.Text(), default=LogLevel.ERROR.value)
    event_type = db.Column(db.Text())
    event_action = db.Column(db.Text())
    location = db.Column(db.Text(), default=Location.PYTHON.value)
    return_code = db.Column(db.Text(), default=ReturnCode.UNKNOWN_ERR.value)
    message = db.Column(db.Text())
    dumpfile = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)


class FactoryImport(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_factory_import'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    job_id = db.Column(db.Integer(), db.ForeignKey('t_job_management.id'), index=True)

    process_id = db.Column(db.Integer())
    import_type = db.Column(db.Text())
    import_from = db.Column(db.Text())
    import_to = db.Column(db.Text())

    start_tm = db.Column(db.Text(), default=get_current_timestamp)
    end_tm = db.Column(db.Text())
    imported_row = db.Column(db.Integer(), default=0)

    status = db.Column(db.Text())
    error_msg = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def get_last_import(cls, process_id, import_type, is_first_id=False):
        data = cls.query.filter(cls.process_id == process_id)
        data = data.filter(cls.import_type == import_type)
        data = data.filter(cls.status.in_([str(JobStatus.FAILED), str(JobStatus.DONE)]))
        data = data.order_by(cls.job_id.desc())
        if is_first_id:
            data = data.order_by(cls.id)
        else:
            data = data.order_by(cls.id.desc())

        data = data.first()

        return data

    @classmethod
    def get_first_import(cls, process_id, import_type):
        data = cls.query.filter(cls.process_id == process_id)
        data = data.filter(cls.import_type == import_type)
        data = data.filter(cls.status.in_([str(JobStatus.FAILED), str(JobStatus.DONE)]))
        data = data.order_by(cls.id).first()

        return data

    @classmethod
    def get_error_jobs(cls, job_id):
        infos = cls.query.filter(cls.job_id == job_id).filter(cls.status != str(JobStatus.DONE))
        return infos.all()


class AppLog(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 't_app_log'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    ip = db.Column(db.Text())
    action = db.Column(db.Text())
    description = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)


def insert_or_update_config(meta_session, data: Union[Dict, db.Model],
                            key_names: Union[List, str] = None, model: db.Model = None,
                            parent_obj: db.Model = None, parent_relation_key=None,
                            parent_relation_type=None, exclude_columns=None):
    """

    :param exclude_columns:
    :param meta_session:
    :param data:
    :param key_names:
    :param model:
    :param parent_obj:
    :param parent_relation_key:
    :param parent_relation_type:
    :return:
    """
    excludes = ['created_at', 'updated_at']
    if exclude_columns:
        excludes += exclude_columns

    rec = None

    # get model
    if not model:
        model = data.__class__

    # default primary key is id
    # get primary keys
    primary_keys = [key.name for key in inspect(model).primary_key]

    if not key_names:
        key_names = primary_keys

    # convert to list
    if isinstance(key_names, str):
        key_names = [key_names]

    # query condition by keys
    if isinstance(data, db.Model):
        dict_key = {key: getattr(data, key) for key in key_names}
    else:
        dict_key = {key: data[key] for key in key_names}

    # query by key_names
    if dict_key:
        rec = meta_session.query(model).filter_by(**dict_key).first()

    # create new record
    if not rec:
        rec = model()
        if not parent_obj:
            meta_session.add(rec)
        elif parent_relation_type is RelationShip.MANY:
            objs = getattr(parent_obj, parent_relation_key)
            if objs is None:
                setattr(parent_obj, parent_relation_key, [rec])
            else:
                objs.append(rec)
        else:
            setattr(parent_obj, parent_relation_key, rec)

    if isinstance(data, db.Model):
        dict_data = {key: getattr(data, key) for key in data.__table__.columns.keys()}
    else:
        dict_data = data

    for key, val in dict_data.items():
        # primary keys
        if key in primary_keys and not val:
            continue

        # ignore non-data fields
        if key in excludes:
            continue

        # check if valid columns
        if key not in model.__table__.columns:
            continue

        # avoid update None to primary key_names
        if key in key_names and not val:
            continue

        setattr(rec, key, val)

    return rec


# def update_record(rec, data, model, primary_keys, excludes=('created_at', 'updated_at'), key_names=[]):
#     if isinstance(data, db.Model):
#         dict_data = {key: getattr(data, key) for key in data.__table__.columns.keys()}
#     else:
#         dict_data = data
#
#     for key, val in dict_data.items():
#         # primary keys
#         if key in primary_keys and not val:
#             continue
#
#         # ignore non-data fields
#         if key in excludes:
#             continue
#
#         # check if valid columns
#         if key not in model.__table__.columns:
#             continue
#
#         # avoid update None to primary key_names
#         if key in key_names and not val:
#             continue
#
#         setattr(rec, key, val)
#
#     return rec


def crud_config(meta_session, data: List[Union[Dict, db.Model]], parent_key_names: Union[List, str] = None,
                key_names: Union[List, str] = None, model: db.Model = None,
                parent_obj: db.Model = None, parent_relation_key=None, parent_relation_type=RelationShip.MANY):
    """

    :param meta_session:
    :param data:
    :param parent_key_names:
    :param key_names:
    :param model:
    :param parent_obj:
    :param parent_relation_key:
    :param parent_relation_type:
    :return:
    """
    # get model
    if not model:
        model = data[0].__class__

    # convert to list
    if isinstance(parent_key_names, str):
        parent_key_names = [parent_key_names]

    # get primary keys
    if not key_names:
        key_names = [key.name for key in inspect(model).primary_key]

    if isinstance(key_names, str):
        key_names = [key_names]

    key_names = parent_key_names + key_names

    # query condition by keys
    if parent_key_names:
        # query by key_names
        if not data:
            current_recs = []
            if parent_relation_key:  # assume that relation key was set in model
                current_recs = getattr(parent_obj, parent_relation_key)
        else:
            if isinstance(data[0], db.Model):
                dict_key = {key: getattr(data[0], key) for key in parent_key_names}
            else:
                dict_key = {key: data[0][key] for key in parent_key_names}

            current_recs = meta_session.query(model).filter_by(**dict_key).all()
    else:
        # query all
        current_recs = meta_session.query(model).all()

    # insert or update data
    set_active_keys = set()

    # # container
    # if parent_obj and parent_relation_key:
    #     setattr(parent_obj, parent_relation_key, [] if parent_relation_type else None)

    for row in data:
        if parent_obj and parent_relation_key:
            rec = insert_or_update_config(meta_session, row, key_names,
                                          model=model,
                                          parent_obj=parent_obj,
                                          parent_relation_key=parent_relation_key,
                                          parent_relation_type=parent_relation_type)
        else:
            rec = insert_or_update_config(meta_session, row, key_names, model=model)

        key = tuple(getattr(rec, key) for key in key_names)
        set_active_keys.add(key)

    # delete data
    for current_rec in current_recs:
        key = tuple(getattr(current_rec, key) for key in key_names)
        if key in set_active_keys:
            continue

        meta_session.delete(current_rec)

    return True


class CfgDataSourceCSV(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source_csv'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete="CASCADE"), primary_key=True)
    directory = db.Column(db.Text())
    skip_head = db.Column(db.Integer(), default=0)
    skip_tail = db.Column(db.Integer(), default=0)
    delimiter = db.Column(db.Text(), default=CsvDelimiter.CSV.name)
    etl_func = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)
    # TODO check fetch all
    csv_columns: List[CfgCsvColumn] = db.relationship('CfgCsvColumn', backref="cfg_data_source_csv", lazy='subquery',
                                                      cascade="all")

    def get_column_names_with_sorted(self, key=CfgCsvColumn.id.key):
        """
        get column names that sorted by key
        :param key:
        :return:
        """
        self.csv_columns.sort(key=lambda csv_column: getattr(csv_column, key))
        return [col.column_name for col in self.csv_columns]

    @classmethod
    def save(cls, form: DataSourceCsvForm):
        if form.id:
            row = cls()
        else:
            row = cls.query.filter(cls.id == form.id)

        # create dataSource ins
        form.populate_obj(row)

        return row

    @classmethod
    def delete(cls, id):
        cls.query.filter(cls.id == id).delete()


class CfgUserSetting(db.Model):
    __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_user_setting'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    key = db.Column(db.Text())  # TODO use page_name/page_url + title for now
    title = db.Column(db.Text())
    page = db.Column(db.Text())
    created_by = db.Column(db.Text())
    priority = db.Column(db.Integer())
    use_current_time = db.Column(db.Boolean())
    description = db.Column(db.Text())
    share_info = db.Column(db.Boolean())
    settings = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_all(cls):
        data = cls.query.options(
            load_only(cls.id, cls.key, cls.title, cls.page, cls.created_by, cls.priority, cls.use_current_time,
                      cls.description, cls.share_info, cls.created_at, cls.updated_at))
        data = data.order_by(cls.priority.desc(), cls.updated_at.desc()).all()
        return data

    @classmethod
    def delete_by_id(cls, meta_session, setting_id):
        user_setting = meta_session.query(cls).get(setting_id)
        if user_setting:
            meta_session.delete(user_setting)

    @classmethod
    def get_by_id(cls, setting_id):
        return cls.query.get(setting_id)

    @classmethod
    def get_top(cls, page):
        return cls.query.filter(cls.page == page).order_by(cls.priority.desc(), cls.updated_at.desc()).first()

    @classmethod
    def get_by_title(cls, title):
        return cls.query.filter(cls.title == title).order_by(cls.priority.desc(), cls.created_at.desc()).all()


def get_models():
    all_sub_classes = db.Model.__subclasses__()
    return tuple([_class for _class in all_sub_classes if hasattr(_class, '__tablename__')])


def make_f(model):
    @event.listens_for(model, 'before_insert')
    def before_insert(mapper, connection, target):
        model_normalize(target)

    @event.listens_for(model, 'before_update')
    def before_update(mapper, connection, target):
        model_normalize(target)
        if isinstance(target, (CfgProcess, CfgProcessColumn, CfgFilter, CfgFilterDetail, CfgTrace, CfgTraceKey,
                               CfgVisualization)):
            set_all_cache_expired()


def add_listen_event():
    for model in get_models():
        make_f(model)


# GUI normalization
add_listen_event()
