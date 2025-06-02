from __future__ import annotations

import hashlib
import json
import unicodedata
from contextlib import contextmanager
from copy import copy
from functools import wraps
from typing import Any, Dict, Generator, List, Optional, Union

import pandas as pd
import sqlalchemy
from flask import g
from flask_babel import get_locale
from sqlalchemy import ForeignKey, asc, desc, event, func, null, or_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import (
    DynamicMapped,
    Mapped,
    RelationshipProperty,
    load_only,
    mapped_column,
    relationship,
    scoped_session,
)
from typing_extensions import Self

from ap import Session, db
from ap.common.common_utils import (
    chunks,
    dict_deep_merge,
    gen_bridge_column_name,
    gen_data_count_table_name,
    gen_import_history_table_name,
    gen_sql_label,
    gen_transaction_table_name,
    get_current_timestamp,
)
from ap.common.constants import (
    DEFAULT_ERROR_DISK_USAGE,
    DEFAULT_NONE_VALUE,
    DEFAULT_WARNING_DISK_USAGE,
    EFA_HEADER_FLAG,
    SQL_IN_MAX,
    VAR_X,
    VAR_Y,
    CacheType,
    CfgConstantType,
    CsvDelimiter,
    CSVExtTypes,
    DataColumnType,
    DataType,
    DBType,
    DiskUsageStatus,
    FlaskGKey,
    FunctionCastDataType,
    JobStatus,
    MasterDBType,
    MaxGraphNumber,
    RawDataTypeDB,
    RelationShip,
    max_graph_number,
)
from ap.common.cryptography_utils import decrypt_pwd
from ap.common.datetime_format_utils import DateTimeFormatUtils
from ap.common.multiprocess_sharing import EventExpireCache, EventQueue
from ap.common.services.http_content import json_dumps
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import NORMALIZE_FORM_NFKC, model_normalize
from ap.common.trace_data_log import Location, LogLevel, ReturnCode

db_timestamp = db.TIMESTAMP


@contextmanager
def make_session() -> Generator[scoped_session]:
    try:
        session: scoped_session = g.setdefault(FlaskGKey.APP_DB_SESSION, Session())
    except Exception:
        # run without Flask context app
        session = Session()

    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e


def use_meta_session(meta_session_argument_name: str = 'meta_session'):
    """Decorator to auto create db instance when no pass it in argument"""

    def decorator(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            meta_session: scoped_session = kwargs.get(meta_session_argument_name)
            if meta_session is None:
                with make_session() as new_meta_session:
                    kwargs[meta_session_argument_name] = new_meta_session
                    return fn(*args, **kwargs)
            else:
                return fn(*args, **kwargs)

        return inner

    return decorator


def use_meta_session_generator(meta_session_argument_name: str = 'meta_session'):
    """Decorator to auto create db instance when no pass it in argument"""

    def decorator(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            meta_session: scoped_session = kwargs.get(meta_session_argument_name)
            if meta_session is None:
                with make_session() as new_meta_session:
                    kwargs[meta_session_argument_name] = new_meta_session
                    return (yield from fn(*args, **kwargs))
            else:
                return (yield from fn(*args, **kwargs))

        return inner

    return decorator


class CommonModel(db.Model):
    __abstract__ = True

    @classmethod
    def from_dict(
        cls,
        dict_object: dict[str, Any],
    ) -> Self:
        dict_object_modified = {}
        for attr in sqlalchemy.inspect(cls).attrs:
            if attr.key not in dict_object:
                continue
            value = dict_object[attr.key]
            if isinstance(value, list):
                dict_object_modified[attr.key] = [
                    attr.entity.class_.from_dict(v.__dict__) if hasattr(v, '__dict__') else v for v in value
                ]
            elif isinstance(attr, RelationshipProperty) and hasattr(value, '__dict__'):
                dict_object_modified[attr.key] = attr.entity.class_.from_dict(value.__dict__)
            else:
                dict_object_modified[attr.key] = value

        return cls(**dict_object_modified)  # noqa

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def get_by_id(cls, id, session=None):
        query = session.query(cls) if session else cls.query
        return query.filter(cls.id == id).first()


class JobManagement(db.Model):  # TODO change to new modal and edit job
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_job_management'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    job_type: Mapped[str]
    # `db_code` is `data_source_id`, but we don't want to make a foreign key for that in the database.
    db_code: Mapped[Optional[int]] = mapped_column(nullable=True)
    db_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    process_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    process_name: Mapped[Optional[str]] = mapped_column(nullable=True)

    start_tm: Mapped[str] = mapped_column(default=get_current_timestamp)
    # end_tm = None: job hasn't done yet
    end_tm: Mapped[Optional[str]] = mapped_column(nullable=True)
    status: Mapped[str]
    done_percent: Mapped[float] = mapped_column(default=0)
    duration: Mapped[float] = mapped_column(default=0)
    error_msg: Mapped[Optional[str]] = mapped_column(nullable=True)

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_last_job_of_process(cls, proc_id, job_type, session: scoped_session = None):
        query = session.query(cls) if session else cls.query
        out = query.options(load_only(cls.id))
        return out.filter(cls.process_id == proc_id).filter(cls.job_type == job_type).order_by(cls.id.desc()).first()

    def set_killed_status_job(self, session: scoped_session = None):
        self.status = JobStatus.KILLED.name
        self.error_msg = "Running job is killed by a stopping job's request."
        (session or JobManagement.query.session).merge(self)

    @classmethod
    def job_sorts(cls, order_method=''):
        sort = desc
        if order_method == 'asc':
            sort = asc
        return {
            'job_id': sort(cls.id),
            'job_name': sort(cls.job_type),
            'db_master_name': sort(cls.db_name),
            'process_master_name': sort(cls.process_name),
            'start_tm': sort(cls.start_tm),
            'duration': sort(cls.duration),
            'progress': sort(cls.done_percent),
            'status': sort(cls.status),
            'detail': sort(cls.error_msg),
        }

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def update_interrupt_jobs(cls):
        with make_session() as meta_session:
            meta_session.query(cls).filter(cls.status == JobStatus.PROCESSING.name).update(
                {cls.status: JobStatus.KILLED.name},
            )


class ProcLinkCount(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_proc_link'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # TODO: do we remove this?
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey('t_job_management.id'), index=True, nullable=True)

    process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    target_process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))

    matched_count: Mapped[int] = mapped_column(default=0)

    process: Mapped['CfgProcess'] = relationship(
        foreign_keys=process_id,
    )
    target_process: Mapped['CfgProcess'] = relationship(
        foreign_keys=target_process_id,
    )
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_all(cls):
        return cls.query.all()

    @classmethod
    def delete_all(cls):
        """delete all records"""
        # cls.query.delete()
        with make_session() as meta_session:
            meta_session.query(cls).delete()

    @classmethod
    def calc_proc_link(cls):
        with make_session() as meta_session:
            output = meta_session.query(
                cls.process_id,
                cls.target_process_id,
                func.sum(cls.matched_count).label(cls.matched_count.key),
            )
            output = output.group_by(cls.process_id, cls.target_process_id).all()

        return output


class CfgConstant(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_constant'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str]
    name: Mapped[Optional[str]] = mapped_column(nullable=True)
    value: Mapped[str]

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_value_by_type_first(cls, type, parse_val=None):
        output = cls.query.options(load_only(cls.value)).filter(cls.type == type).first()
        if not output:
            return None

        if parse_val:
            try:
                return parse_val(output.value)
            except Exception:
                return None
        else:
            return output.value

    @classmethod
    def get_value_by_type_name(cls, type, name, parse_val=None):
        output = cls.query.options(load_only(cls.value)).filter(cls.type == type, cls.name == name).first()
        if not output:
            return None

        if parse_val:
            try:
                return parse_val(output.value)
            except Exception:
                return None
        else:
            return output.value

    @classmethod
    def get_value_by_type_names(cls, const_type, names, parse_val=None):
        output = (
            cls.query.options(load_only(cls.name, cls.value)).filter(cls.type == const_type, cls.name.in_(names)).all()
        )
        return output

    @classmethod
    def get_names_values_by_type(cls, const_type):
        output = cls.query.options(load_only(cls.name, cls.value)).filter(cls.type == const_type).all()
        return output

    @classmethod
    def create_or_update_by_type(cls, const_type=None, const_value=0, const_name=None):
        with make_session() as meta_session:
            constant = None
            if const_type is not None:
                constant = meta_session.query(cls).filter(cls.type == const_type)

                if const_name is not None:
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
                constant = cls(type=const_type, name=const_name, value=json_dumps(const_value))
                meta_session.add(constant)
            else:
                # merge new order to old orders
                dic_value = json.loads(constant.value)
                dic_latest_orders = dict_deep_merge(const_value, dic_value)
                constant.value = json_dumps(dic_latest_orders)

    @classmethod
    def get_efa_header_flag(cls, data_source_id):
        efa_header_flag = cls.query.filter(
            cls.type == CfgConstantType.EFA_HEADER_EXISTS.name,
            cls.name == data_source_id,
        ).first()

        if efa_header_flag and efa_header_flag.value and efa_header_flag.value == EFA_HEADER_FLAG:
            return True
        return False

    @classmethod
    def get_warning_disk_usage(cls) -> int:
        return cls.get_value_by_type_name(
            CfgConstantType.DISK_USAGE_CONFIG.name,
            DiskUsageStatus.Warning.name,
            parse_val=int,
        )

    @classmethod
    def get_error_disk_usage(cls) -> int:
        return cls.get_value_by_type_name(
            CfgConstantType.DISK_USAGE_CONFIG.name,
            DiskUsageStatus.Full.name,
            parse_val=int,
        )

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
            cls.create_or_update_by_type(constants_type, warning_percent, const_name=DiskUsageStatus.Warning.name)

        error_percent = cls.get_error_disk_usage()
        if not error_percent:  # insert of not existing
            error_percent = DEFAULT_ERROR_DISK_USAGE

            cls.create_or_update_by_type(constants_type, error_percent, const_name=DiskUsageStatus.Full.name)

    @classmethod
    def initialize_max_graph_constants(cls):
        for constant in MaxGraphNumber:
            db_constant = CfgConstant.get_value_by_type_first(constant.name, int)
            if not db_constant:
                cls.create_or_update_by_type(
                    constant.name,
                    const_value=max_graph_number[constant.name],
                )


class CfgDataSource(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str]
    type: Mapped[str]
    comment: Mapped[Optional[str]] = mapped_column(nullable=True)
    order: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)
    db_detail: Mapped['CfgDataSourceDB'] = relationship(
        back_populates='cfg_data_source',
        cascade='all, delete, delete-orphan',
    )
    csv_detail: Mapped['CfgDataSourceCSV'] = relationship(
        back_populates='cfg_data_source',
        cascade='all, delete, delete-orphan',
    )
    processes: DynamicMapped[list['CfgProcess']] = relationship(
        back_populates='data_source',
        cascade='all, delete, delete-orphan',
    )

    @classmethod
    def delete(cls, meta_session, id):
        meta_session.query.filter(cls.id == id).delete()

    @classmethod
    def get_all(cls):
        all_ds = cls.query.order_by(cls.order).order_by(asc(cls.id)).all()
        for ds in all_ds:
            db_detail: CfgDataSourceDB = ds.db_detail
            if db_detail and db_detail.hashed:
                db_detail.password = decrypt_pwd(db_detail.password)
            ds.en_name = to_romaji(ds.name)
        return all_ds

    @classmethod
    def get_all_db_source(cls):
        all_ds = cls.query.filter(cls.type != str(CSVExtTypes.CSV.value).upper()).order_by(cls.order).all()
        for ds in all_ds:
            db_detail: CfgDataSourceDB = ds.db_detail
            if db_detail and db_detail.hashed:
                db_detail.password = decrypt_pwd(db_detail.password)
            ds.en_name = to_romaji(ds.name)
        return all_ds

    @classmethod
    def get_ds(cls, ds_id):
        ds = cls.query.get(ds_id)
        db_detail: CfgDataSourceDB = ds.db_detail
        if db_detail and db_detail.hashed:
            db_detail.password = decrypt_pwd(db_detail.password)
        ds.en_name = to_romaji(ds.name)
        return ds

    @classmethod
    def update_order(cls, meta_session, data_source_id, order):
        meta_session.query(cls).filter(cls.id == data_source_id).update({cls.order: order})

    @classmethod
    def check_duplicated_name(cls, dbs_name):
        dbs = cls.query.filter(cls.name == dbs_name).all()
        return len(dbs) != 0

    def is_csv_or_v2(self):
        return self.type in [DBType.CSV.name, DBType.V2.name]

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgDataSource:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgDataSource object without reference to Database
        """
        return_cfg_data_source = CfgDataSource(**self.as_dict())
        return_cfg_data_source.db_detail = self.db_detail.clone() if self.db_detail else None
        return_cfg_data_source.csv_detail = self.csv_detail.clone() if self.csv_detail else None
        return return_cfg_data_source

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
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source_db'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(ForeignKey('cfg_data_source.id', ondelete='CASCADE'), primary_key=True)
    # host can be None, when we use sqlite3
    host: Mapped[Optional[str]] = mapped_column(nullable=True)
    # FIXME: Not sure why we save port as string here. Might need migration
    port: Mapped[Optional[str]] = mapped_column(nullable=True)
    dbname: Mapped[str]
    schema: Mapped[Optional[str]] = mapped_column(nullable=True)
    username: Mapped[Optional[str]] = mapped_column(nullable=True)
    password: Mapped[Optional[str]] = mapped_column(nullable=True)
    hashed: Mapped[bool] = mapped_column(default=False)
    use_os_timezone: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    cfg_data_source: Mapped['CfgDataSource'] = relationship(
        back_populates='db_detail',
    )

    @classmethod
    def delete(cls, id):
        cls.query.filter(cls.id == id).delete()

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgDataSourceDB:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgDataSourceDB object without reference to Database
        """
        return CfgDataSourceDB(**self.as_dict())


class CfgCsvColumn(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_csv_column'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    data_source_id: Mapped[int] = mapped_column(ForeignKey('cfg_data_source_csv.id', ondelete='CASCADE'))
    column_name: Mapped[str]
    data_type: Mapped[Optional[str]] = mapped_column(nullable=True)
    order: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    cfg_data_source_csv: Mapped['CfgDataSourceCSV'] = relationship(
        back_populates='csv_columns',
    )

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgCsvColumn:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgCsvColumn object without reference to Database
        """
        return CfgCsvColumn(**self.as_dict())


class CfgProcessUnusedColumn(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process_unused_column'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    column_name: Mapped[str]

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_all_unused_columns_by_process_id(cls, process_id):
        return [col.column_name for col in cls.query.filter(cls.process_id == process_id).all()]

    @classmethod
    def delete_all_columns_by_proc_id(cls, proc_id, meta_session: scoped_session = None):
        (meta_session.query(cls) if meta_session else cls.query).filter(
            cls.process_id == proc_id,
        ).delete()
        if meta_session:
            meta_session.flush()

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgProcessUnusedColumn:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcessUnusedColumn object without reference to Database
        """
        return CfgProcessUnusedColumn(**self.as_dict())


class CfgProcessColumn(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process_column'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    column_name: Mapped[str]
    # raw name of column, from CSV file or DB table
    column_raw_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(nullable=True)
    name_jp: Mapped[Optional[str]] = mapped_column(nullable=True)
    name_local: Mapped[Optional[str]] = mapped_column(nullable=True)
    data_type: Mapped[str]
    # TODO: can we remove this?
    raw_data_type: Mapped[Optional[str]] = mapped_column(nullable=True)
    column_type: Mapped[Optional[int]]
    is_serial_no: Mapped[bool] = mapped_column(default=False)
    is_get_date: Mapped[bool] = mapped_column(default=False)
    is_dummy_datetime: Mapped[bool] = mapped_column(default=False)
    is_auto_increment: Mapped[bool] = mapped_column(default=False)
    is_file_name: Mapped[bool] = mapped_column(default=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey(id, ondelete='CASCADE'), nullable=True)
    order: Mapped[Optional[int]]
    unit: Mapped[Optional[str]] = mapped_column(nullable=True)
    cfg_process: Mapped['CfgProcess'] = relationship(
        back_populates='columns',
        cascade='all',
    )
    function_details: Mapped[list['CfgProcessFunctionColumn']] = relationship(
        back_populates='cfg_process_column',
        order_by='CfgProcessFunctionColumn.order',
        cascade='all, delete',
    )
    parent_column: Mapped['CfgProcessColumn'] = relationship(
        back_populates='children',
        remote_side=[id],
    )
    children: Mapped[list['CfgProcessColumn']] = relationship(
        back_populates='parent_column',
        cascade='all',
    )
    cfg_filters: Mapped[list['CfgFilter']] = relationship(
        back_populates='column',
        cascade='all, delete',
    )
    import_filters: Mapped[list['CfgImportFilter']] = relationship(
        back_populates='column',
        cascade='all, delete, delete-orphan',
    )

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    # TODO trace key, cfg_filter: may not needed

    def get_shown_name(self):
        try:
            locale = get_locale()
            if not locale:
                return None
            if locale.language == 'ja':
                return self.name_jp if self.name_jp else self.name_en
            else:
                return self.name_local if self.name_local else self.name_en
        except Exception:
            return self.name_jp

    @hybrid_property
    def is_main_serial(self) -> bool:
        return self.is_serial_no

    @hybrid_property
    def is_function_column(self) -> bool:
        return self.column_type == DataColumnType.GENERATED_EQUATION.value

    @hybrid_property
    def is_normal_column(self) -> bool:
        return not self.is_function_column

    @hybrid_property
    def is_main_serial_function_column(self) -> bool:
        return self.is_main_serial and self.is_function_column

    @hybrid_property
    def is_transaction_column(self) -> bool:
        return self.is_normal_column or self.is_main_serial_function_column

    @hybrid_property
    def shown_name(self):
        return self.get_shown_name()

    @hybrid_property
    def is_linking_column(self):
        """
        Checking if a column is linkable
        """

        # Function column is not linkable (except main serial function column)
        is_linkable_column = self.is_main_serial_function_column or (not self.is_function_column)

        # Float column is not linkable
        is_linkable_data_type = self.data_type not in [
            DataType.REAL.name,
            DataType.REAL_SEP.name,
            DataType.EU_REAL_SEP.name,
            DataType.BOOLEAN.name,
        ]

        return is_linkable_column and is_linkable_data_type

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgProcessColumn:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcessColumn object without reference to Database
        """
        return_cfg_column = CfgProcessColumn(**self.as_dict())
        return_cfg_column.function_details = [function_detail.clone() for function_detail in self.function_details]
        return_cfg_column.parent_column = self.parent_column.clone() if self.parent_column else None
        return_cfg_column.import_filters = [import_filter.clone() for import_filter in self.import_filters]
        return return_cfg_column

    # @classmethod
    # def get_by_col_name(cls, proc_id, col_name):
    #     return cls.query.filter(cls.process_id == proc_id, cls.column_name == col_name).first()

    # @classmethod
    # def get_by_data_type(cls, proc_id, data_type: DataType):
    #     return cls.query.filter(cls.process_id == proc_id, cls.data_type == data_type.name).all()

    @hybrid_property
    def bridge_column_name(self):
        return gen_bridge_column_name(self.id, self.column_name)

    @hybrid_property
    def is_category(self):
        return self.data_type == DataType.TEXT.name or self.is_int_category

    @hybrid_property
    def is_int_category(self):
        return (
            self.data_type == DataType.INTEGER.name
            and (self.column_type in DataColumnType.category_int_types() or self.is_serial_no)
            or (
                self.column_type == DataColumnType.GENERATED_EQUATION.value and self.data_type == DataType.CATEGORY.name
            )
        )

    @hybrid_property
    def is_judge(self):
        return self.column_type == DataColumnType.JUDGE.value

    @classmethod
    def get_function_col_ids(cls, process_id):
        recs = (
            cls.query.options(load_only(cls.id))
            .filter(cls.process_id == process_id)
            .filter(cls.column_type == DataColumnType.GENERATED_EQUATION.value)
            .all()
        )
        ids = [rec.id for rec in recs]
        return ids

    @classmethod
    def remove_by_col_ids(cls, ids, session=None):
        query = session.query(cls) if session else cls.query
        query.filter(cls.id.in_(ids)).delete(synchronize_session='fetch')

        return True

    @classmethod
    def get_by_ids(cls, ids):
        return cls.query.filter(cls.id.in_(ids)).all()

    @classmethod
    def get_by_process_id(cls, process_id: str, return_df: bool = False):
        objects = cls.query.filter(cls.process_id == process_id).all()
        if return_df:
            list_dic = [obj.as_dict() for obj in objects]
            df = pd.DataFrame(list_dic, dtype='object').replace({None: DEFAULT_NONE_VALUE}).convert_dtypes()
            return df

        return objects

    @classmethod
    def get_by_id(cls, col_id: int):
        return cls.query.get(col_id)

    @classmethod
    def gen_label_from_col_id(cls, col_id: int):
        col = cls.get_by_id(col_id)
        if not col:
            return None
        col_label = gen_sql_label(col.id, col.column_name)
        return col_label

    def gen_sql_label(self, is_bridge: bool = False) -> str:
        col_name = self.bridge_column_name if is_bridge else self.column_name
        col_label = gen_sql_label(self.id, col_name)
        return col_label

    @hybrid_property
    def is_me_function_column(self):
        return self.is_function_column and any(col.is_me_function for col in self.function_details)

    @hybrid_property
    def is_chain_of_me_functions(self):
        return self.is_function_column and all(col.is_me_function for col in self.function_details)

    def existed_in_transaction_table(self):
        # this if master column, hence it does not exist
        # if self.is_master_data_column(): # ES not support
        #     return False

        # this if not function column, hence it exists
        if not self.is_function_column:
            return True

        # this function column is main::Serial
        if self.is_main_serial_function_column:
            return True

        # this is function column, but it created by a chain of mes
        if self.is_chain_of_me_functions:
            return True

        return False

    @classmethod
    def get_col_main_datetime(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id, cls.is_get_date == 1).first()

    @classmethod
    def get_col_main_date(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id, cls.data_type == DataType.DATE.name).first()

    @classmethod
    def get_col_main_time(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id, cls.data_type == DataType.TIME.name).first()

    @classmethod
    def get_serials(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id, cls.is_serial_no == 1).all()

    @classmethod
    def get_all_columns(cls, proc_id):
        return cls.query.filter(cls.process_id == proc_id).all()

    def is_generate_equation_column(self) -> bool:
        return len(self.function_details) > 0

    @classmethod
    def get_columns_by_process_id(cls, proc_id):
        columns = cls.query.filter(cls.process_id == proc_id).all()
        return [{cls.id.name: col.id, 'name': col.shown_name, cls.data_type.name: col.data_type} for col in columns]

    @classmethod
    def delete_by_ids(cls, ids, session=None):
        key = cls.get_primary_keys()
        for chunk_ids in chunks(ids, SQL_IN_MAX):
            session.query(cls).filter(key.in_(chunk_ids)).delete(synchronize_session='fetch')

        return True

    @classmethod
    def get_primary_keys(cls, first_key_only=True):
        """
        get primary key
        :param cls:
        :param first_key_only:
        :return:
        """
        keys = list(inspect(cls).primary_key)
        if first_key_only:
            return keys[0]

        return keys

    @classmethod
    def get_by_column_types(cls, column_types: list[int], proc_ids: list[int] = None, session=None) -> list:
        query = session.query(cls) if session else cls.query
        if proc_ids:
            return query.filter(cls.column_type.in_(column_types), cls.process_id.in_(proc_ids)).all()
        return query.filter(cls.column_type.in_(column_types)).all()

    @classmethod
    def get_table_name(cls):
        return str(cls.__table__.name)

    @classmethod
    def from_dict(
        cls,
        dict_object: dict[str, Any],
    ) -> Self:
        dict_object_modified = {}
        for attr in sqlalchemy.inspect(cls).attrs:
            if attr.key not in dict_object:
                continue
            value = dict_object[attr.key]
            if isinstance(value, list):
                dict_object_modified[attr.key] = [
                    attr.entity.class_.from_dict(v.__dict__) if hasattr(v, '__dict__') else v for v in value
                ]
            elif isinstance(attr, RelationshipProperty) and hasattr(value, '__dict__'):
                dict_object_modified[attr.key] = attr.entity.class_.from_dict(value.__dict__)
            else:
                dict_object_modified[attr.key] = value

        return cls(**dict_object_modified)  # noqa

    @classmethod
    def get_import_filters_by_col_id(cls, col_id) -> Union[list, None]:
        column = cls.query.get(col_id)
        if not column:
            return None
        return column.import_filters

    @hybrid_property
    def label(self):
        return self.gen_sql_label()


class CfgProcess(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str]  # system_name
    name_jp: Mapped[Optional[str]] = mapped_column(nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(nullable=True)
    name_local: Mapped[Optional[str]] = mapped_column(nullable=True)
    data_source_id: Mapped[int] = mapped_column(ForeignKey('cfg_data_source.id', ondelete='CASCADE'))
    # `table_name` None indicates that we are not importing from database table
    table_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    # flag to determine measurement or history data
    master_type: Mapped[Optional[str]] = mapped_column(nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_show_file_name: Mapped[Optional[bool]] = mapped_column(default=None, nullable=True)
    # `file_name` None indicates that we are not importing from a file
    file_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    process_factid: Mapped[Optional[str]] = mapped_column(nullable=True)
    etl_func: Mapped[Optional[str]] = mapped_column(nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey(id, ondelete='CASCADE'), nullable=True)
    # parent_process_id : Mapped[int]
    is_import: Mapped[Optional[bool]] = mapped_column(default=True)

    datetime_format: Mapped[Optional[str]] = mapped_column(nullable=True)
    order: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    data_source: Mapped['CfgDataSource'] = relationship(
        back_populates='processes',
    )

    columns: Mapped[list['CfgProcessColumn']] = relationship(
        back_populates='cfg_process',
        cascade='all, delete, delete-orphan',
    )
    unused_columns: Mapped[list['CfgProcessUnusedColumn']] = relationship(
        cascade='all, delete, delete-orphan',
    )

    traces: Mapped[list['CfgTrace']] = relationship(
        back_populates='self_process',
        foreign_keys='CfgTrace.self_process_id',
        cascade='all, delete, delete-orphan',
    )
    filters: Mapped[list['CfgFilter']] = relationship(
        back_populates='cfg_process',
        cascade='all, delete, delete-orphan',
    )
    visualizations: Mapped[list['CfgVisualization']] = relationship(
        back_populates='cfg_process',
        cascade='all, delete, delete-orphan',
    )

    @hybrid_property
    def bridge_table_name(self):
        name = gen_transaction_table_name(self.id)
        return name

    @hybrid_property
    def data_count_table_name(self):
        name = gen_data_count_table_name(self.id)
        return name

    @hybrid_property
    def import_history_table_name(self):
        name = gen_import_history_table_name(self.id)
        return name

    @hybrid_property
    def is_measurement(self):
        return self.master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT.name

    @hybrid_property
    def is_check_datetime_format(self) -> bool:
        return self.datetime_format is not None

    @hybrid_property
    def is_import_file_name(self):
        if not self.parent_id:
            return self.is_show_file_name
        else:
            return self.get_parent(self.id).is_show_file_name

    def get_shown_name(self):
        try:
            locale = get_locale()
            if not self.name_en:
                self.name_en = to_romaji(self.name)
            if not locale:
                return None
            if locale.language == 'ja':
                return self.name_jp if self.name_jp else self.name_en
            else:
                return self.name_local if self.name_local else self.name_en
        except Exception:
            return self.name

    @hybrid_property
    def shown_name(self):
        return self.get_shown_name()

    def get_transaction_process_columns(
        self,
        include_main_serial_function_column: bool = True,
    ) -> list[CfgProcessColumn]:
        return [
            col
            for col in self.columns
            if col.is_normal_column or (include_main_serial_function_column and col.is_main_serial_function_column)
        ]

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

    def get_main_serial_col(self):
        return next(
            (col for col in self.columns if col.is_serial_no),
            None,
        )

    def get_main_serial_function_col(self) -> CfgProcessColumn | None:
        return next(
            (col for col in self.columns if col.is_main_serial_function_column),
            None,
        )

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

    def modify_col_name(self, col_id: int, name: str):
        col = self.get_col(col_id)
        if col is not None:
            col.column_name = name
            # TODO: is this correct?
            col.name_en = name
            col.name_jp = name
            col.name_local = name

    def shallow_copy_and_add_new_col(self, col_id: int, dummy_idx=1000000) -> Optional[CfgProcessColumn]:
        col = self.get_col(col_id)
        if col is not None:
            # since we only modify `column_name`, etc. later, shallow copy is fine.
            # if we want to modify something nested, such as `filter`, then we need deepcopy.
            # and since deepcopy doesn't work on sqlalchemy, we need to have another approach ...
            col = copy(col)
            col.id = col_id * dummy_idx
            self.columns.append(col)
            return col
        return None

    def get_serials(self, column_name_only=True):
        if column_name_only:
            cols = [col.column_name for col in self.columns if col.is_serial_no]
        else:
            cols = [col for col in self.columns if col.is_serial_no]

        return cols

    def get_order_cols(
        self,
        column_name_only: bool = True,
        column_id_only: bool = False,
    ) -> Union[list[str], list[int]]:
        cols = [col for col in self.columns if col.is_serial_no or col.data_type in DataType.order_columns()]
        if column_name_only:
            return [col.column_name for col in cols]

        if column_id_only:
            return [col.id for col in cols]

        return cols

    def get_cols(self, col_ids: list[int]) -> list[CfgProcessColumn]:
        col_ids = set(col_ids)
        return [col for col in self.columns if col.id in col_ids]

    def get_col(self, col_id: int) -> Optional[CfgProcessColumn]:
        for col in self.columns:
            if col.id == col_id:
                return col
        return None

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

    def get_time_format(self) -> Optional[str]:
        """
        Extract time format from datetime_format value
        :return: time format
        """
        datetime_format = DateTimeFormatUtils.get_datetime_format(self.datetime_format)
        return datetime_format.time_format

    def get_date_format(self) -> Optional[str]:
        """
        Extract date format from datetime_format value
        :return: date format
        """
        datetime_format = DateTimeFormatUtils.get_datetime_format(self.datetime_format)
        return datetime_format.date_format

    @classmethod
    def get_all(cls, is_import: bool = None, with_parent=False, session: scoped_session = None):
        query = session.query(cls) if session else cls.query
        if not with_parent:
            query = query.filter(cls.parent_id == null())
        if is_import is not None:
            query = query.filter(cls.is_import == is_import)
        return query.order_by(cls.order).all()

    @classmethod
    def get_all_ids(cls, is_import: bool = None, with_parent=False, session: scoped_session = None):
        query = session.query(cls) if session else cls.query
        if not with_parent:
            query = query.filter(cls.parent_id == null())
        if is_import is not None:
            query = query.filter(cls.is_import == is_import)
        return query.options(load_only(cls.id)).all()

    @classmethod
    def get_all_order_by_id(cls):
        return cls.query.order_by(cls.id).all()

    @classmethod
    def get_procs(cls, ids):
        return cls.query.filter(cls.id.in_(ids)).all()

    @classmethod
    def get_proc_by_id(cls, proc_id, session: scoped_session = None) -> CfgProcess | None:
        query = session.query(cls) if session else cls.query
        return query.filter(cls.id == proc_id).first()

    def get_dic_filter_details(self, filter_detail_ids=None) -> dict[int, CfgFilterDetail]:
        dic_filter_details = {}
        for cfg_filter in self.filters:
            for filter_detail in cfg_filter.filter_details:
                if filter_detail is None or filter_detail_ids is None or filter_detail.id in filter_detail_ids:
                    filter_detail.column = cfg_filter.column
                    dic_filter_details[filter_detail.id] = filter_detail

        return dic_filter_details

    def get_filter_cfg_by_col_ids(self, col_ids: list[int]) -> list[CfgFilter]:
        return [filter_cfg for filter_cfg in self.filters if filter_cfg.column_id in col_ids]

    def get_dic_cols_by_ids(self, col_ids: list[int]) -> dict[int, CfgProcessColumn]:
        return {col.id: col for col in self.columns if col.id in col_ids}

    def get_sensor_default_chart_info(self, col_id: int, start_tm: str, end_tm: str) -> list[CfgVisualization]:
        targets = []
        for cfg_visual in self.visualizations:
            if (
                cfg_visual.control_column_id == col_id
                and cfg_visual.filter_detail_id is None
                and (cfg_visual.act_from is None or cfg_visual.act_from < end_tm or cfg_visual.act_from == '')
                and (cfg_visual.act_to is None or cfg_visual.act_to > start_tm or cfg_visual.act_to == '')
            ):
                targets.append(cfg_visual)

        targets.sort(key=lambda obj: obj.act_from, reverse=True)
        return targets

    def get_by_control_n_filter_detail_ids(
        self,
        col_id: int,
        filter_detail_ids: list[int],
        start_tm: str,
        end_tm: str,
    ) -> list[CfgVisualization]:
        targets = []
        for cfg_visual in self.visualizations:
            if (
                cfg_visual.control_column_id == col_id
                and cfg_visual.filter_detail_id in filter_detail_ids
                and (cfg_visual.act_from is None or cfg_visual.act_from < end_tm or cfg_visual.act_from == '')
                and (cfg_visual.act_to is None or cfg_visual.act_to > start_tm or cfg_visual.act_to == '')
            ):
                targets.append(cfg_visual)

        targets.sort(key=lambda obj: obj.act_from, reverse=True)
        return targets

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgProcess:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcess object without reference to Database
        """
        return_cfg_proc = CfgProcess(**self.as_dict())

        # Get data source info
        return_cfg_proc.data_source = self.data_source.clone() if self.data_source else None

        # Get cfg column info
        return_cfg_proc.columns = [cfg_column.clone() for cfg_column in self.columns]

        # Get cfg unused column info
        return_cfg_proc.unused_columns = [cfg_unused_column.clone() for cfg_unused_column in self.unused_columns]

        return return_cfg_proc

    @classmethod
    def get_parent(cls, proc_id: int, session: scoped_session = None) -> CfgProcess | None:
        query = session.query(cls) if session else cls.query
        proc = query.get(proc_id)
        if proc is not None and proc.parent_id is not None:
            return query.filter(cls.id == proc.parent_id).first()
        return None

    @classmethod
    def get_children(cls, proc_id: int, session: scoped_session = None) -> list[CfgProcess]:
        query = session.query(cls) if session else cls.query
        return query.filter(cls.parent_id == proc_id).all()

    @classmethod
    def get_all_parents_and_children_processes(cls, proc_id: int, session: scoped_session = None) -> list[CfgProcess]:
        query = session.query(cls) if session else cls.query
        proc = query.get(proc_id)
        parent = cls.get_parent(proc_id, session=session)
        children = cls.get_children(proc_id, session=session)
        siblings = cls.get_children(parent.id, session=session) if parent is not None else []

        processes = [proc] + [parent] + children + siblings
        return list({process.id: process for process in processes if process is not None}.values())

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
                or_(CfgTrace.self_process_id == proc_id, CfgTrace.target_process_id == proc_id),
            ).delete()

            # delete linking prediction manually
            meta_session.query(ProcLinkCount).filter(
                or_(ProcLinkCount.process_id == proc_id, ProcLinkCount.target_process_id == proc_id),
            ).delete()

        return True

    @classmethod
    def batch_delete(cls, proc_ids):
        with make_session() as meta_session:
            meta_session.query(cls).filter(cls.id.in_(proc_ids)).delete(synchronize_session=False)
            # delete traces manually
            meta_session.query(CfgTrace).filter(
                or_(CfgTrace.self_process_id.in_(proc_ids), CfgTrace.target_process_id.in_(proc_ids)),
            ).delete(
                synchronize_session=False,
            )
            # delete linking prediction manually
            meta_session.query(ProcLinkCount).filter(
                or_(ProcLinkCount.process_id.in_(proc_ids), ProcLinkCount.target_process_id.in_(proc_ids)),
            ).delete(
                synchronize_session=False,
            )

    @classmethod
    def update_order(cls, meta_session, process_id, order):
        meta_session.query(cls).filter(cls.id == process_id).update({cls.order: order})

    @classmethod
    def get_list_of_process(cls):
        processes = cls.query.order_by(cls.id).all()
        return [{cls.id.name: proc.id, cls.name.name: proc.shown_name} for proc in processes]

    @classmethod
    def check_duplicated_name(cls, name_en, name_jp, name_local):
        check_name_en = len(cls.query.filter(cls.name_en == name_en).all()) != 0 if name_en else False
        check_name_jp = len(cls.query.filter(cls.name_jp == name_jp).all()) != 0 if name_jp else False
        check_name_local = len(cls.query.filter(cls.name_local == name_local).all()) != 0 if name_local else False
        return check_name_en, check_name_jp, check_name_local

    def table_name_for_query_datetime(self):
        from ap.api.setting_module.services.software_workshop_etl_services import quality_measurements_table

        if self.data_source.type == DBType.SOFTWARE_WORKSHOP.name:
            return quality_measurements_table.name
        return self.table_name

    def filter_for_query_datetime(self, sql: str) -> str:
        if self.data_source.type == DBType.SOFTWARE_WORKSHOP.name:
            from ap.api.setting_module.services.software_workshop_etl_services import quality_measurements_table

            # software workshop import by process must filter by process name here
            # because this is vertical database
            return f"{sql} WHERE {quality_measurements_table.c.child_equip_id.name} = '{self.process_factid}'"
        return sql

    def get_main_serial_column(self, is_isolation_object: bool = False):
        """
        Find old cfg column as main::Serial
        :param is_isolation_object: True -> create a new object to avoid value will be changed after update config
         due to reference Alchemy model object
        :type is_isolation_object: bool
        :return: a ``CfgProcessColumn`` object as main::Serial or ``None`` if not found
        :rtype: CfgProcessColumn | None
        """
        return next(
            (col.clone() if is_isolation_object else col for col in self.columns if col.is_serial_no),
            None,
        )

    def get_linking_columns(self) -> list[CfgProcessColumn]:
        if self.columns:
            return [column for column in self.columns if column.is_linking_column]
        return []

    def get_import_filters(self) -> list[list[CfgImportFilter]]:
        if self.columns:
            return [column.import_filters for column in self.columns]
        return []

    def get_etl_func(self) -> str | None:
        return self.etl_func or None

    @classmethod
    def update_is_import(cls, meta_session, process_id, is_import):
        meta_session.query(cls).filter(cls.id == process_id).update({cls.is_import: is_import})


class CfgProcessFunctionColumn(db.Model):
    __tablename__ = 'cfg_process_function_column'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    process_column_id: Mapped[int] = mapped_column(ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    function_id: Mapped[int]
    var_x: Mapped[int]
    var_y: Mapped[Optional[int]] = mapped_column(nullable=True)
    return_type: Mapped[str]
    a: Mapped[Optional[str]] = mapped_column(nullable=True)
    b: Mapped[Optional[str]] = mapped_column(nullable=True)
    c: Mapped[Optional[str]] = mapped_column(nullable=True)
    n: Mapped[Optional[str]] = mapped_column(nullable=True)
    k: Mapped[Optional[str]] = mapped_column(nullable=True)
    s: Mapped[Optional[str]] = mapped_column(nullable=True)
    t: Mapped[Optional[str]] = mapped_column(nullable=True)
    note: Mapped[Optional[str]] = mapped_column(nullable=True)
    order: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    cfg_process_column: Mapped['CfgProcessColumn'] = relationship(
        back_populates='function_details',
    )

    @classmethod
    def get_by_id(cls, id, session=None):
        query = session.query(cls) if session else cls.query
        return query.filter(cls.id == id).first()

    @classmethod
    def delete_by_ids(cls, ids, session=None):
        key = cls.get_primary_keys()
        for chunk_ids in chunks(ids, SQL_IN_MAX):
            session.query(cls).filter(key.in_(chunk_ids)).delete(synchronize_session='fetch')

        return True

    @classmethod
    def get_by_process_column_id(cls, process_column_id, session=None) -> list[CfgProcessFunctionColumn]:
        query = session.query(cls) if session else cls.query
        return query.filter(cls.process_column_id == process_column_id).all()

    @hybrid_property
    def is_me_function(self) -> bool:
        return self.process_column_id in [self.var_x, self.var_y]

    @classmethod
    def get_by_process_id(cls, process_id: int, session=None):
        session = session if session else cls.query.session
        cols = [
            CfgProcessFunctionColumn.id.name,
            CfgProcessFunctionColumn.process_column_id.name,
            CfgProcessFunctionColumn.function_id.name,
            CfgProcessFunctionColumn.var_x.name,
            CfgProcessFunctionColumn.var_y.name,
            CfgProcessFunctionColumn.a.name,
            CfgProcessFunctionColumn.b.name,
            CfgProcessFunctionColumn.c.name,
            CfgProcessFunctionColumn.n.name,
            CfgProcessFunctionColumn.k.name,
            CfgProcessFunctionColumn.s.name,
            CfgProcessFunctionColumn.t.name,
            CfgProcessFunctionColumn.return_type.name,
            CfgProcessFunctionColumn.note.name,
            CfgProcessFunctionColumn.order.name,
            CfgProcessFunctionColumn.created_at.name,
            CfgProcessFunctionColumn.updated_at.name,
        ]
        sql = f'''
SELECT
    pfc.{CfgProcessFunctionColumn.id.name}
    , pfc.{CfgProcessFunctionColumn.process_column_id.name}
    , pfc.{CfgProcessFunctionColumn.function_id.name}
    , pfc.{CfgProcessFunctionColumn.var_x.name}
    , pfc.{CfgProcessFunctionColumn.var_y.name}
    , pfc.{CfgProcessFunctionColumn.a.name}
    , pfc.{CfgProcessFunctionColumn.b.name}
    , pfc.{CfgProcessFunctionColumn.c.name}
    , pfc.{CfgProcessFunctionColumn.n.name}
    , pfc.{CfgProcessFunctionColumn.k.name}
    , pfc.{CfgProcessFunctionColumn.s.name}
    , pfc.{CfgProcessFunctionColumn.t.name}
    , pfc.{CfgProcessFunctionColumn.return_type.name}
    , pfc.{CfgProcessFunctionColumn.note.name}
    , 'pfc.{CfgProcessFunctionColumn.order.name}'
    , pfc.{CfgProcessFunctionColumn.created_at.name}
    , pfc.{CfgProcessFunctionColumn.updated_at.name}
FROM {CfgProcessFunctionColumn.get_table_name()} pfc
INNER JOIN {CfgProcessColumn.get_table_name()} pc ON
    pc.{CfgProcessColumn.id.name} = pfc.{CfgProcessFunctionColumn.process_column_id.name}
WHERE
    pc.{CfgProcessColumn.process_id.name} = :1'''
        params = {'1': process_id}
        rows = session.execute(sql, params=params)
        df = pd.DataFrame(rows, columns=cols)

        df = df.convert_dtypes()
        for col in cls.__table__.columns:
            if col.type in (db.Integer, db.BigInteger):
                df[col.name] = df[col.name].astype('Int64')  # all NULL  column
            if col.type in (DataType.REAL,):
                df[col.name] = df[col.name].astype('Float64')  # all NULL  column

        if 'id' in df.columns:
            # In Bridge Station system, all models should have same behavior to publish itseft id column
            df = df.rename(columns={'id': cls.get_foreign_id_column_name()})

        return df

    @classmethod
    def get_all_cfg_col_ids(cls):
        data = cls.query.all()
        cfg_col_ids = []
        for row in data:
            if row.var_x:
                cfg_col_ids.append(row.var_x)

            if row.var_y:
                cfg_col_ids.append(row.var_y)

        return cfg_col_ids

    @classmethod
    def remove_by_col_ids(cls, ids, session=None):
        query = session.query(cls) if session else cls.query
        query.filter(cls.id.in_(ids)).delete(synchronize_session='fetch')

        return True

    @classmethod
    def get_primary_keys(cls, first_key_only=True):
        """
        get primary key
        :param cls:
        :param first_key_only:
        :return:
        """
        keys = list(inspect(cls).primary_key)
        if first_key_only:
            return keys[0]

        return keys

    @classmethod
    def get_table_name(cls):
        return str(cls.__table__.name)

    @classmethod
    def get_foreign_id_column_name(cls) -> str:  # only use for cfg_ and m_
        """
        m_line  ->  line_id

        :return:
        """
        elems = cls.__tablename__.split('_')
        return f"{'_'.join(elems[1:])}_id"

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgProcessFunctionColumn:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcessFunctionColumn object without reference to Database
        """
        return CfgProcessFunctionColumn(**self.as_dict())

    @classmethod
    def from_dict(
        cls,
        dict_object: dict[str, Any],
    ) -> Self:
        dict_object_modified = {}
        for attr in sqlalchemy.inspect(cls).attrs:
            if attr.key not in dict_object:
                continue
            value = dict_object[attr.key]
            if isinstance(value, list):
                dict_object_modified[attr.key] = [
                    attr.entity.class_.from_dict(v.__dict__) if hasattr(v, '__dict__') else v for v in value
                ]
            elif isinstance(attr, RelationshipProperty) and hasattr(value, '__dict__'):
                dict_object_modified[attr.key] = attr.entity.class_.from_dict(value.__dict__)
            else:
                dict_object_modified[attr.key] = value

        return cls(**dict_object_modified)  # noqa


class CfgTraceKey(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_trace_key'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trace_id: Mapped[int] = mapped_column(ForeignKey('cfg_trace.id', ondelete='CASCADE'))
    # TODO confirm PO delete
    self_column_id: Mapped[int] = mapped_column(ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    self_column_substr_from: Mapped[Optional[int]] = mapped_column(nullable=True)
    self_column_substr_to: Mapped[Optional[int]] = mapped_column(nullable=True)

    target_column_id: Mapped[int] = mapped_column(ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    target_column_substr_from: Mapped[Optional[int]] = mapped_column(nullable=True)
    target_column_substr_to: Mapped[Optional[int]] = mapped_column(nullable=True)

    delta_time: Mapped[Optional[float]] = mapped_column(nullable=True)
    cut_off: Mapped[Optional[float]] = mapped_column(nullable=True)

    order: Mapped[Optional[int]] = mapped_column(nullable=True)

    self_column: Mapped['CfgProcessColumn'] = relationship(
        foreign_keys=[self_column_id],
    )
    target_column: Mapped['CfgProcessColumn'] = relationship(
        foreign_keys=[target_column_id],
    )
    cfg_trace: Mapped['CfgTrace'] = relationship(
        back_populates='trace_keys',
        cascade='all',
    )

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def get_by_column_id(cls, column_id: int, session: scoped_session = None) -> list[CfgTraceKey]:
        query = session.query(cls) if session else cls.query
        return query.filter(or_(cls.self_column_id == column_id, cls.target_column_id == column_id)).all()

    def delete(self, session: scoped_session = None):
        session = session if session else CfgTraceKey.query.session
        session.delete(self)

    @classmethod
    def remove_traces(cls, column_id: int, session: scoped_session = None):
        trace_keys = cls.get_by_column_id(column_id, session=session)
        if trace_keys:
            trace_ids = [cfg.id for cfg in trace_keys]
            traces = CfgTrace.get_in_ids(trace_ids, session=session)
            for trace_key in trace_keys:
                trace_key.delete(session=session)
            for trace in traces:
                trace.delete(session=session)


class CfgTrace(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_trace'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    self_process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    target_process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    is_trace_backward: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    trace_keys: Mapped[list['CfgTraceKey']] = relationship(
        back_populates='cfg_trace',
        cascade='all',
        order_by='asc(CfgTraceKey.self_column_id)',
    )

    self_process: Mapped['CfgProcess'] = relationship(
        foreign_keys=[self_process_id],
    )
    target_process: Mapped['CfgProcess'] = relationship(
        foreign_keys=[target_process_id],
    )

    @classmethod
    def get_in_ids(cls, ids: list[int], session: scoped_session = None) -> list[CfgTrace]:
        query = session.query(cls) if session else cls.query
        return query.filter(cls.id.in_(ids)).all()

    def delete(self, session: scoped_session = None):
        session = session if session else CfgTrace.query.session
        session.delete(self)

    @classmethod
    def get_all(cls):
        return cls.query.all()

    @classmethod
    def get_traces_of_proc(cls, proc_ids):
        traces = cls.query.filter(or_(cls.self_process_id.in_(proc_ids), cls.target_process_id.in_(proc_ids))).all()
        return traces

    def is_same_tracing(self, other):
        """
        True if same self process id, target process id, self column id list, target column id list.
        :param other:
        :return:
        """
        if not isinstance(other, CfgTrace):
            return False
        if (self.self_process_id, self.target_process_id) != (
            other.self_process_id,
            other.target_process_id,
        ):
            return False
        if len(self.trace_keys) != len(other.trace_keys):
            return False

        keys = [
            [
                key.self_column_id,
                key.self_column_substr_from,
                key.self_column_substr_to,
                key.target_column_id,
                key.target_column_substr_from,
                key.target_column_substr_to,
            ]
            for key in self.trace_keys
        ]
        other_keys = [
            [
                key.self_column_id,
                key.self_column_substr_from,
                key.self_column_substr_to,
                key.target_column_id,
                key.target_column_substr_from,
                key.target_column_substr_to,
            ]
            for key in other.trace_keys
        ]
        cols = [
            'self_column_id',
            'self_column_substr_from',
            'self_column_substr_to',
            'target_column_id',
            'target_column_substr_from',
            'target_column_substr_to',
        ]

        self_trace_key_df = pd.DataFrame(keys, columns=cols)
        other_trace_key_df = pd.DataFrame(other_keys, columns=cols)
        if not self_trace_key_df.equals(other_trace_key_df):
            return False

        return True


class CfgFilterDetail(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_filter_detail'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filter_id: Mapped[int] = mapped_column(ForeignKey('cfg_filter.id', ondelete='CASCADE'))
    parent_detail_id: Mapped[int] = mapped_column(ForeignKey(id, ondelete='CASCADE'), nullable=True)
    name: Mapped[str]
    filter_condition: Mapped[str]
    filter_function: Mapped[str]
    filter_from_pos: Mapped[Optional[int]] = mapped_column(nullable=True)

    order: Mapped[Optional[int]] = mapped_column(nullable=True)

    parent: Mapped['CfgFilterDetail'] = relationship(
        back_populates='cfg_children',
        remote_side=[id],
    )
    cfg_children: Mapped[list['CfgFilterDetail']] = relationship(
        back_populates='parent',
    )
    cfg_filter: Mapped['CfgFilter'] = relationship(
        back_populates='filter_details',
    )
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    def __hash__(self):
        return hash(str(self.id))


class CfgFilter(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_filter'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(nullable=True)
    filter_type: Mapped[str]
    process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    column_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('cfg_process_column.id', ondelete='CASCADE'),
        nullable=True,
    )  # TODO confirm PO
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey(id, ondelete='CASCADE'), nullable=True)

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    parent: Mapped['CfgFilter'] = relationship(
        back_populates='cfg_children',
        remote_side=[id],
    )
    cfg_children: Mapped[list['CfgFilter']] = relationship(
        back_populates='parent',
    )
    column: Mapped[Optional['CfgProcessColumn']] = relationship(
        back_populates='cfg_filters',
    )
    filter_details: Mapped[list['CfgFilterDetail']] = relationship(
        back_populates='cfg_filter',
        cascade='all, delete, delete-orphan',
    )
    cfg_process: Mapped['CfgProcess'] = relationship(
        back_populates='filters',
    )

    @classmethod
    def delete_by_id(cls, meta_session, filter_id):
        cfg_filter = meta_session.query(cls).get(filter_id)
        if cfg_filter:
            meta_session.delete(cfg_filter)


class CfgVisualization(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_visualization'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    process_id: Mapped[int] = mapped_column(ForeignKey('cfg_process.id', ondelete='CASCADE'))
    # TODO confirm PO
    control_column_id: Mapped[int] = mapped_column(ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    filter_column_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('cfg_process_column.id', ondelete='CASCADE'),
        nullable=True,
    )
    filter_value: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_from_data: Mapped[bool] = mapped_column(default=False)
    filter_detail_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('cfg_filter_detail.id', ondelete='CASCADE'),
        nullable=True,
    )

    ucl: Mapped[Optional[float]] = mapped_column(nullable=True)
    lcl: Mapped[Optional[float]] = mapped_column(nullable=True)
    upcl: Mapped[Optional[float]] = mapped_column(nullable=True)
    lpcl: Mapped[Optional[float]] = mapped_column(nullable=True)
    ymax: Mapped[Optional[float]] = mapped_column(nullable=True)
    ymin: Mapped[Optional[float]] = mapped_column(nullable=True)

    # TODO check default value, null is OK
    act_from: Mapped[Optional[str]] = mapped_column(nullable=True)
    act_to: Mapped[Optional[str]] = mapped_column(nullable=True)

    order: Mapped[int]

    control_column: Mapped['CfgProcessColumn'] = relationship(
        foreign_keys=[control_column_id],
    )
    filter_column: Mapped['CfgProcessColumn'] = relationship(
        foreign_keys=[filter_column_id],
    )
    filter_detail: Mapped['CfgFilterDetail'] = relationship()

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)
    deleted_at: Mapped[Optional[str]] = mapped_column(nullable=True)

    cfg_process: Mapped['CfgProcess'] = relationship(
        back_populates='visualizations',
    )

    @classmethod
    def get_filter_ids(cls):
        return db.session.query(cls.filter_detail_id).filter(cls.filter_detail_id > 0)

    # @classmethod
    # def get_by_control_n_filter_detail_ids(cls, col_id, filter_detail_ids, start_tm, end_tm):
    #     return (
    #         cls.query.filter(
    #             and_(
    #                 cls.control_column_id == col_id,
    #                 cls.filter_detail_id.in_(filter_detail_ids),
    #             )
    #         )
    #         .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == ''))
    #         .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == ''))
    #         .order_by(cls.act_from.desc())
    #         .all()
    #     )

    # @classmethod
    # def get_sensor_default_chart_info(cls, col_id, start_tm, end_tm):
    #     # TODO: not deleted, ...
    #     return (
    #         cls.query.filter(cls.control_column_id == col_id)
    #         .filter(and_(cls.filter_detail_id.is_(None)))
    #         .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == ''))
    #         .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == ''))
    #         .order_by(cls.act_from.desc())
    #         .all()
    #     )

    # @classmethod
    # def get_by_control_n_filter_col_id(cls, col_id, filter_col_id, start_tm, end_tm):
    #     # TODO: not deleted, ...
    #     return (
    #         cls.query.filter(
    #             and_(
    #                 cls.control_column_id == col_id,
    #                 cls.filter_column_id == filter_col_id,
    #                 cls.filter_value.is_(None),
    #                 cls.filter_detail_id.is_(None),
    #             )
    #         )
    #         .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == ''))
    #         .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == ''))
    #         .order_by(cls.act_from.desc())
    #         .all()
    #     )

    # @classmethod
    # def get_all_by_control_n_filter_col_id(cls, col_id, filter_col_id, start_tm, end_tm):
    #     # TODO: not deleted, ...
    #     return (
    #         cls.query.filter(
    #             and_(
    #                 cls.control_column_id == col_id,
    #                 cls.filter_column_id == filter_col_id,
    #             )
    #         )
    #         .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == ''))
    #         .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == ''))
    #         .order_by(cls.act_from.desc())
    #         .all()
    #     )

    # @classmethod
    # def get_by_filter_detail_id(cls, col_id, filter_detail_id, start_tm, end_tm):
    #     # TODO: not deleted, ...
    #     return (
    #         cls.query.filter(and_(cls.control_column_id == col_id, cls.filter_detail_id == filter_detail_id))
    #         .filter(or_(cls.act_from.is_(None), cls.act_from < end_tm, cls.act_from == ''))
    #         .filter(or_(cls.act_to.is_(None), cls.act_to > start_tm, cls.act_to == ''))
    #         .order_by(cls.act_from.desc())
    #         .all()
    #     )


class DataTraceLog(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_data_trace_log'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date_time: Mapped[str] = mapped_column(default=get_current_timestamp)
    dataset_id: Mapped[str]
    event_type: Mapped[str]
    event_action: Mapped[str]
    target: Mapped[str]
    exe_time: Mapped[int]
    data_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    rows: Mapped[Optional[int]] = mapped_column(nullable=True)
    cols: Mapped[Optional[int]] = mapped_column(nullable=True)
    dumpfile: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

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
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_abnormal_trace_log'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date_time: Mapped[str] = mapped_column(default=get_current_timestamp)
    dataset_id: Mapped[int] = mapped_column(autoincrement=True)
    log_level: Mapped[str] = mapped_column(default=LogLevel.ERROR.value)
    event_type: Mapped[str]
    event_action: Mapped[str]
    location: Mapped[str] = mapped_column(default=Location.PYTHON.value)
    return_code: Mapped[str] = mapped_column(default=ReturnCode.UNKNOWN_ERR.value)
    message: Mapped[str]
    dumpfile: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)


class AppLog(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_app_log'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ip: Mapped[str]
    action: Mapped[str]
    description: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)


class CfgDataSourceCSV(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source_csv'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(ForeignKey('cfg_data_source.id', ondelete='CASCADE'), primary_key=True)
    directory: Mapped[str]
    skip_head: Mapped[Optional[int]] = mapped_column(nullable=True)
    skip_tail: Mapped[int] = mapped_column(default=0)
    n_rows: Mapped[Optional[int]] = mapped_column(nullable=True)
    is_transpose: Mapped[bool] = mapped_column(default=False)
    delimiter: Mapped[str] = mapped_column(default=CsvDelimiter.CSV.name)
    etl_func: Mapped[Optional[str]] = mapped_column(nullable=True)
    process_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    dummy_header: Mapped[bool] = mapped_column(default=False)
    is_file_checker: Mapped[bool] = mapped_column(default=False)
    is_file_path: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)
    csv_columns: Mapped[list['CfgCsvColumn']] = relationship(
        back_populates='cfg_data_source_csv',
        cascade='all, delete, delete-orphan',
    )
    cfg_data_source: Mapped['CfgDataSource'] = relationship(
        back_populates='csv_detail',
    )

    def get_column_names_with_sorted(self, key=CfgCsvColumn.id.key):
        """
        get column names that sorted by key
        :param key:
        :return:
        """
        self.csv_columns.sort(key=lambda csv_column: getattr(csv_column, key))
        return [col.column_name for col in self.csv_columns]

    @classmethod
    def delete(cls, id):
        cls.query.filter(cls.id == id).delete()

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def clone(self) -> CfgDataSourceCSV:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgDataSourceCSV object without reference to Database
        """
        return_cfg_data_source_csv = CfgDataSourceCSV(**self.as_dict())
        return_cfg_data_source_csv.csv_columns = [csv_column.clone() for csv_column in self.csv_columns]
        return return_cfg_data_source_csv


class CfgUserSetting(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_user_setting'
    __table_args__ = {'sqlite_autoincrement': True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str]  # TODO use page_name/page_url + title for now
    title: Mapped[str]
    page: Mapped[str]
    created_by: Mapped[str]
    priority: Mapped[int]
    use_current_time: Mapped[bool]
    description: Mapped[str]
    share_info: Mapped[bool]
    save_graph_settings: Mapped[bool]
    settings: Mapped[str]

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @hybrid_property
    def hashed_owner(self):
        created_by = str(self.created_by).encode()
        return hashlib.md5(created_by).hexdigest()

    @classmethod
    def get_all(cls):
        data = cls.query.options(
            load_only(
                cls.id,
                cls.key,
                cls.title,
                cls.page,
                cls.created_by,
                cls.priority,
                cls.use_current_time,
                cls.description,
                cls.share_info,
                cls.created_at,
                cls.updated_at,
            ),
        )
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

    @classmethod
    def get_bookmarks(cls):
        return cls.query.with_entities(
            cls.id,
            cls.priority,
            cls.page.label('function'),
            cls.title,
            cls.created_by,
            cls.description,
            cls.updated_at,
        ).all()

    @classmethod
    def get_page_by_bookmark(cls, bookmark_id):
        return cls.query.filter(cls.id == bookmark_id).first().page


class CfgRequest(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_request'

    id: Mapped[str] = mapped_column(primary_key=True)
    params: Mapped[Optional[str]] = mapped_column(nullable=True)
    odf: Mapped[Optional[str]] = mapped_column(nullable=True)

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    options: Mapped[list['CfgOption']] = relationship(
        back_populates='parent',
        cascade='all, delete, delete-orphan',
    )

    @classmethod
    def save_odf_and_params_by_req_id(cls, session, req_id, odf, params):
        # TODO: fix
        req = cls.query.filter(cls.id == req_id).first()
        if not req:
            req = CfgRequest(id=req_id, odf=odf, params=params)
            session.add(req)
            session.commit()

    @classmethod
    def get_by_req_id(cls, req_id):
        return cls.query.get(req_id)

    @classmethod
    def get_odf_by_req_id(cls, req_id):
        req = cls.query.get(req_id)
        if req:
            return req.odf
        return None

    @classmethod
    def find_all_expired_reqs(cls, time):
        res = cls.query.filter(cls.created_at < time).all()
        return res or []


class CfgOption(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_option'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    option: Mapped[str]
    req_id: Mapped[str] = mapped_column(ForeignKey('cfg_request.id', ondelete='CASCADE'))

    parent: Mapped['CfgRequest'] = relationship(
        back_populates='options',
    )

    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_option(cls, option_id):
        return cls.query.filter(cls.id == option_id).first()

    @classmethod
    def get_options(cls, req_id):
        return cls.query.filter(cls.req_id == req_id).all()

    @classmethod
    def get_option_ids(cls, req_id):
        records = cls.query.options(load_only(cls.id)).filter(cls.req_id == req_id).all()
        ids = [rec.id for rec in records]
        return ids


class MFunction(db.Model):
    __tablename__ = 'm_function'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True)
    function_type: Mapped[str]
    function_name_en: Mapped[str]
    function_name_jp: Mapped[str]
    description_en: Mapped[str]
    description_jp: Mapped[str]
    x_type: Mapped[str]  # r,i,t is real, int, text
    y_type: Mapped[Optional[str]] = mapped_column(nullable=True)
    return_type: Mapped[str]  # r,i,t is real, int, text. 'x' is same as x, 'y' is same as y
    show_serial: Mapped[bool]
    a: Mapped[Optional[str]] = mapped_column(nullable=True)
    b: Mapped[Optional[str]] = mapped_column(nullable=True)
    c: Mapped[Optional[str]] = mapped_column(nullable=True)
    n: Mapped[Optional[str]] = mapped_column(nullable=True)
    k: Mapped[Optional[str]] = mapped_column(nullable=True)
    s: Mapped[Optional[str]] = mapped_column(nullable=True)
    t: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    @hybrid_property
    def is_me_function(self):
        return self.function_type.startswith('me.')

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def get_by_function_type(cls, function_type):
        return cls.query.filter(cls.function_type == function_type).first()

    @classmethod
    def get_by_id(cls, id, session=None):
        query = session.query(cls) if session else cls.query
        return query.filter(cls.id == id).first()

    def has_x(self):
        return self.x_type is not None

    def has_y(self):
        return self.y_type is not None

    def get_variables(self) -> list[str]:
        variables = []
        if self.has_x():
            variables.append(VAR_X)
        if self.has_y():
            variables.append(VAR_Y)
        return variables

    def get_string_x_types(self) -> list[str]:
        return self.x_type.split(',') if self.has_x() else []

    def get_string_y_types(self) -> list[str]:
        return self.y_type.split(',') if self.has_y() else []

    def get_string_return_types(self):
        return self.return_type.split(',') if self.return_type else []

    def get_possible_x_types(self) -> list[RawDataTypeDB]:
        if not self.has_x():
            return []
        x_types = [RawDataTypeDB.get_by_enum_value(dtype) for dtype in self.get_string_x_types()]
        return [dtype for dtype in x_types if dtype is not None]

    def get_possible_y_types(self) -> list[RawDataTypeDB]:
        if not self.has_y():
            return []
        y_types = [RawDataTypeDB.get_by_enum_value(dtype) for dtype in self.get_string_y_types()]
        return [dtype for dtype in y_types if dtype is not None]

    def get_possible_return_type(self) -> RawDataTypeDB | None:
        if not self.return_type:
            return None

        return_types = [RawDataTypeDB.get_by_enum_value(dtype) for dtype in self.get_string_return_types()]
        return_types = [dtype for dtype in return_types if dtype is not None]

        if len(return_types) == 0:
            return None
        if len(return_types) > 1:
            raise ValueError(f'Return type for {self.return_type} is not valid')
        return return_types[0]

    def get_possible_cast_return_types(self) -> list[FunctionCastDataType]:
        return_types = [FunctionCastDataType.get_by_enum_value(dtype) for dtype in self.get_string_return_types()]
        return [dtype for dtype in return_types if dtype is not None]

    def get_x_data_type(self, x_data_type: str | None) -> RawDataTypeDB | None:
        return RawDataTypeDB.get_data_type_for_function(x_data_type, self.get_string_x_types())

    def get_y_data_type(self, y_data_type: str | None) -> RawDataTypeDB | None:
        return RawDataTypeDB.get_data_type_for_function(y_data_type, self.get_string_y_types())

    def get_output_data_type(
        self,
        x_data_type: str | None = None,
        _y_data_type: str | None = None,
        cast_data_type: str | None = None,
    ) -> RawDataTypeDB | None:
        # return type is specified
        possible_return_type = self.get_possible_return_type()
        if possible_return_type is not None:
            return possible_return_type

        # should cast to new type
        possible_cast_return_types = self.get_possible_cast_return_types()
        if FunctionCastDataType.CAST in possible_cast_return_types and cast_data_type:
            return RawDataTypeDB.get_by_enum_value(cast_data_type)

        # same as X
        if FunctionCastDataType.SAME_AS_X in possible_cast_return_types:
            x_data_type = self.get_x_data_type(x_data_type)
            return RawDataTypeDB.get_by_enum_value(x_data_type)

        return None


class MUnit(db.Model):
    __tablename__ = 'm_unit'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    quantity_jp: Mapped[str]
    quantity_en: Mapped[str]
    unit: Mapped[str]
    type: Mapped[Optional[str]] = mapped_column(nullable=True)
    base: Mapped[Optional[int]] = mapped_column(nullable=True)
    conversion: Mapped[Optional[float]] = mapped_column(nullable=True)
    denominator: Mapped[Optional[float]] = mapped_column(nullable=True)
    offset: Mapped[Optional[float]] = mapped_column(nullable=True)
    created_at: Mapped[str] = mapped_column(default=get_current_timestamp)
    updated_at: Mapped[str] = mapped_column(default=get_current_timestamp, onupdate=get_current_timestamp)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    @classmethod
    def _get_unit_with_unicode_normalize(cls, unit) -> MUnit | None:
        filter_value = unicodedata.normalize(NORMALIZE_FORM_NFKC, unit)
        return cls.query.filter(cls.unit == filter_value).first()

    @classmethod
    def get_by_unit(cls, unit) -> MUnit | None:
        result = cls.query.filter(cls.unit == unit).first()
        # if not match, try to use unicodedata normalize for value
        if not result:
            result = cls._get_unit_with_unicode_normalize(unit)

        return result


class CfgImportFilter(CommonModel):
    __tablename__ = 'cfg_import_filter'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    column_id: Mapped[int] = mapped_column(ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    filter_function: Mapped[str] = mapped_column(nullable=False, default='MATCHES')
    filter_from_position: Mapped[Optional[int]] = mapped_column(nullable=True, default=1)

    column: Mapped['CfgProcessColumn'] = relationship(
        back_populates='import_filters',
        cascade='all',
    )

    filters: Mapped[list['CfgImportFilterDetail']] = relationship(
        back_populates='filter',
        cascade='all, delete, delete-orphan',
    )

    def clone(self) -> CfgImportFilter:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcessColumn object without reference to Database
        """
        return_cfg_import_filter = CfgImportFilter(**self.as_dict())
        return_cfg_import_filter.filters = [filter_detail.clone() for filter_detail in self.filters]
        return return_cfg_import_filter


class CfgImportFilterDetail(CommonModel):
    __tablename__ = 'cfg_import_filter_detail'
    __table_args__ = {'sqlite_autoincrement': True}
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    value: Mapped[str] = mapped_column(nullable=True)
    filter_id: Mapped[int] = mapped_column(ForeignKey('cfg_import_filter.id', ondelete='CASCADE'))

    filter: Mapped['CfgImportFilter'] = relationship(
        back_populates='filters',
        cascade='all',
    )

    def clone(self) -> CfgImportFilterDetail:
        """Make isolated object that not link to SQLAlchemy to avoid changes when DB has commit

        :return: A CfgProcessColumn object without reference to Database
        """
        return CfgImportFilterDetail(**self.as_dict())


def insert_or_update_config(
    meta_session,
    data: Union[Dict, db.Model],
    key_names: Union[List, str] = None,
    model: db.Model = None,
    parent_obj: db.Model = None,
    parent_relation_key=None,
    parent_relation_type=None,
    exclude_columns=None,
    autocommit=True,
):
    """

    :param exclude_columns:
    :param meta_session:
    :param data:
    :param key_names:
    :param model:
    :param parent_obj:
    :param parent_relation_key:
    :param parent_relation_type:
    :param autocommit:
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
            meta_session.flush()
        elif parent_relation_type is RelationShip.MANY:
            objs = getattr(parent_obj, parent_relation_key)
            if objs is None:
                setattr(parent_obj, parent_relation_key, [rec])
            else:
                objs.append(rec)
        else:
            setattr(parent_obj, parent_relation_key, rec)

    dict_data = (
        {key: getattr(data, key) for key in data.__table__.columns.keys()} if isinstance(data, db.Model) else data
    )

    for key, val in dict_data.items():
        # primary keys
        if key in primary_keys and not val:
            continue

        # ignore non-data fields
        if key in excludes:
            continue

        # check if valid columns
        if key not in model.__table__.columns.keys():
            continue

        # avoid update None to primary key_names
        if key in key_names and not val:
            continue

        setattr(rec, key, val)

    meta_session.flush()
    if autocommit:
        meta_session.commit()

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


def crud_config(
    meta_session,
    data: List[Union[Dict, db.Model]],
    parent_key_names: Union[List, str] = None,
    key_names: Union[List, str] = None,
    model: db.Model = None,
    parent_obj: db.Model = None,
    parent_relation_key=None,
    parent_relation_type=RelationShip.MANY,
    autocommit=True,
):
    """

    :param meta_session:
    :param data:
    :param parent_key_names:
    :param key_names:
    :param model:
    :param parent_obj:
    :param parent_relation_key:
    :param parent_relation_type:
    :param autocommit:
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
            rec = insert_or_update_config(
                meta_session,
                row,
                key_names,
                model=model,
                parent_obj=parent_obj,
                parent_relation_key=parent_relation_key,
                parent_relation_type=parent_relation_type,
                autocommit=autocommit,
            )
        else:
            rec = insert_or_update_config(meta_session, row, key_names, model=model, autocommit=autocommit)

        key = tuple(getattr(rec, key) for key in key_names)
        set_active_keys.add(key)

    # delete data
    for current_rec in current_recs:
        key = tuple(getattr(current_rec, key) for key in key_names)
        if key in set_active_keys:
            continue

        meta_session.delete(current_rec)
        meta_session.flush()

    meta_session.flush()
    if autocommit:
        meta_session.commit()

    return True


def get_models():
    all_sub_classes = db.Model.__subclasses__()
    return tuple([_class for _class in all_sub_classes if hasattr(_class, '__tablename__')])


def make_f(model):
    list_of_target = (CfgProcess, CfgProcessColumn, CfgFilter, CfgFilterDetail, CfgTrace, CfgTraceKey, CfgVisualization)

    @event.listens_for(model, 'before_insert')
    def before_insert(_mapper, _connection, target):
        model_normalize(target)
        if isinstance(target, list_of_target):
            EventQueue.put(EventExpireCache(cache_type=CacheType.CONFIG_DATA))

    @event.listens_for(model, 'before_update')
    def before_update(_mapper, _connection, target):
        model_normalize(target)
        if isinstance(target, list_of_target):
            EventQueue.put(EventExpireCache(cache_type=CacheType.CONFIG_DATA))


def add_listen_event():
    for model in get_models():
        make_f(model)


# add trigger in CRUD config data
add_listen_event()
