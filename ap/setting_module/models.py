from __future__ import annotations

import json
from contextlib import contextmanager
from functools import wraps
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import sqlalchemy
from flask import g
from flask_babel import get_locale
from sqlalchemy import asc, desc, event, func, null, or_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import RelationshipProperty, load_only, scoped_session
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
from ap.common.memoize import set_all_cache_expired
from ap.common.services.http_content import json_dumps
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import model_normalize
from ap.common.trace_data_log import Location, LogLevel, ReturnCode

db_timestamp = db.TIMESTAMP


@contextmanager
def make_session():
    try:
        session = g.setdefault(FlaskGKey.APP_DB_SESSION, Session())
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


def use_meta_session_generator(meta_session_argument_name: str = 'db_instance'):
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
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_last_job_of_process(cls, proc_id, job_type):
        out = cls.query.options(load_only(cls.id))
        return out.filter(cls.process_id == proc_id).filter(cls.job_type == job_type).order_by(cls.id.desc()).first()

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

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    job_id = db.Column(db.Integer(), db.ForeignKey('t_job_management.id'), index=True)

    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    target_process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    matched_count = db.Column(db.Integer(), default=0)

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    process = db.relationship('CfgProcess', foreign_keys=[process_id], lazy='joined')
    target_process = db.relationship('CfgProcess', foreign_keys=[target_process_id], lazy='joined')

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
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    name = db.Column(db.Text())
    type = db.Column(db.Text())
    comment = db.Column(db.Text())
    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)
    db_detail = db.relationship(
        'CfgDataSourceDB',
        lazy='subquery',
        backref='cfg_data_source',
        uselist=False,
        cascade='all',
    )
    csv_detail = db.relationship(
        'CfgDataSourceCSV',
        lazy='subquery',
        backref='cfg_data_source',
        uselist=False,
        cascade='all',
    )
    processes = db.relationship('CfgProcess', lazy='dynamic', cascade='all')

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
    id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete='CASCADE'), primary_key=True)
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
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_csv_column'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    data_source_id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source_csv.id', ondelete='CASCADE'))
    column_name = db.Column(db.Text())
    data_type = db.Column(db.Text())
    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)


class CfgProcessUnusedColumn(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process_unused_column'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    column_name = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    @classmethod
    def get_all_unused_columns_by_process_id(cls, process_id):
        return [col.column_name for col in cls.query.filter(cls.process_id == process_id).all()]

    @classmethod
    def delete_all_columns_by_proc_id(cls, proc_id, meta_session: scoped_session = None):
        (meta_session.query(cls) if meta_session else CfgProcessUnusedColumn.query).filter(
            cls.process_id == proc_id,
        ).delete()
        if meta_session:
            meta_session.flush()


class CfgProcessColumn(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process_column'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    column_name = db.Column(db.Text())
    column_raw_name = db.Column(db.Text())  # raw name of column, from CSV file or DB table
    name_en = db.Column(db.Text())
    name_jp = db.Column(db.Text())
    name_local = db.Column(db.Text())
    data_type = db.Column(db.Text())
    raw_data_type = db.Column(db.Text())
    column_type = db.Column(db.Integer())
    predict_type = db.Column(db.Text())
    is_serial_no = db.Column(db.Boolean(), default=False)
    is_get_date = db.Column(db.Boolean(), default=False)
    is_dummy_datetime = db.Column(db.Boolean(), default=False)
    is_auto_increment = db.Column(db.Boolean(), default=False)
    is_file_name = db.Column(db.Boolean(), default=False)
    parent_id = db.Column(db.Integer(), db.ForeignKey(id, ondelete='CASCADE'), nullable=True)
    order = db.Column(db.Integer())
    unit = db.Column(db.Text())
    function_details: list['CfgProcessFunctionColumn'] = db.relationship(
        'CfgProcessFunctionColumn',
        lazy='joined',
        backref='cfg_process_column',
        cascade='all',
        order_by='CfgProcessFunctionColumn.order.asc()',
    )
    parent_column: CfgProcessColumn = db.relationship(
        'CfgProcessColumn',
        remote_side=[id],
        backref='children',
        cascade='all',
    )

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    # This field to sever store function config of this column, it's NOT REAL COLUMN IN TABLE.
    function_config: Optional[dict] = None

    # TODO trace key, cfg_filter: may not needed
    # visualizations = db.relationship('CfgVisualization', lazy='dynamic', backref="cfg_process_column", cascade="all")

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
    def shown_name(self):
        return self.get_shown_name()

    @hybrid_property
    def is_linking_column(self):
        return self.data_type not in [
            DataType.REAL.name,
            DataType.REAL_SEP.name,
            DataType.EU_REAL_SEP.name,
            DataType.BOOLEAN.name,
        ]

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

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
        return self.data_type == DataType.INTEGER.name and (
            self.column_type in DataColumnType.category_int_types() or self.is_serial_no
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
    def is_function_column(self):
        return len(self.function_details) > 0

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


class CfgProcess(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_process'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    name = db.Column(db.Text())  # system_name
    name_jp = db.Column(db.Text())
    name_en = db.Column(db.Text())
    name_local = db.Column(db.Text())
    data_source_id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete='CASCADE'))
    table_name = db.Column(db.Text())
    master_type = db.Column(db.Text())  # flag to determine measurement or history data
    comment = db.Column(db.Text())
    is_show_file_name = db.Column(db.Boolean(), default=None)
    file_name = db.Column(db.Text())
    process_factid = db.Column(db.Text())
    parent_id = db.Column(db.Integer(), db.ForeignKey(id, ondelete='CASCADE'), nullable=True)
    # parent_process_id = db.Column(db.Integer())

    datetime_format = db.Column(db.Text(), default=None)
    order = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    # TODO check fetch all
    columns: List[CfgProcessColumn] = db.relationship(
        'CfgProcessColumn',
        lazy='joined',
        backref='cfg_process',
        cascade='all',
    )
    traces = db.relationship(
        'CfgTrace',
        lazy='dynamic',
        foreign_keys='CfgTrace.self_process_id',
        backref='cfg_process',
        cascade='all',
    )
    filters = db.relationship('CfgFilter', lazy='dynamic', backref='cfg_process', cascade='all')
    visualizations = db.relationship('CfgVisualization', lazy='dynamic', backref='cfg_process', cascade='all')

    data_source = db.relationship('CfgDataSource', lazy='select')

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

    def get_order_cols(self, column_name_only=True, column_id_only=False):
        cols = [
            col
            for col in self.columns
            if col.is_serial_no
            or col.data_type
            in [
                DataType.DATETIME.name,
                DataType.TEXT.name,
                DataType.INTEGER.name,
                DataType.INTEGER_SEP.name,
                DataType.EU_INTEGER_SEP.name,
                DataType.BIG_INT.name,
            ]
        ]
        if column_name_only:
            cols = [col.column_name for col in cols]

        if column_id_only:
            cols = [col.id for col in cols]

        return cols

    def get_cols(self, col_ids=()):
        cols = [col for col in self.columns if col.id in col_ids]
        return cols

    def get_col(self, col_id):
        cols = [col for col in self.columns if col.id == col_id]
        if cols:
            return cols[0]
        else:
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
    def get_all(cls, with_parent=False):
        query = cls.query
        if not with_parent:
            query = query.filter(cls.parent_id == null())
        return query.order_by(cls.order).all()

    @classmethod
    def get_all_ids(cls, with_parent=False):
        query = cls.query
        if not with_parent:
            query = query.filter(cls.parent_id == null())
        return query.options(load_only(cls.id)).all()

    @classmethod
    def get_all_order_by_id(cls):
        return cls.query.order_by(cls.id).all()

    @classmethod
    def get_procs(cls, ids):
        return cls.query.filter(cls.id.in_(ids)).all()

    @classmethod
    def get_proc_by_id(cls, proc_id):
        return cls.query.filter(cls.id == proc_id).first()

    @classmethod
    def get_parent(cls, proc_id: int) -> CfgProcess | None:
        proc = cls.query.get(proc_id)
        if proc is not None and proc.parent_id is not None:
            return cls.query.filter(cls.id == proc.parent_id).first()
        return None

    @classmethod
    def get_children(cls, proc_id: int) -> list[CfgProcess]:
        return cls.query.filter(cls.parent_id == proc_id).all()

    @classmethod
    def get_all_parents_and_children_processes(cls, proc_id: int) -> list[CfgProcess]:
        proc = cls.query.get(proc_id)
        parent = cls.get_parent(proc_id)
        children = cls.get_children(proc_id)
        siblings = cls.get_children(parent.id) if parent is not None else []

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


class CfgProcessFunctionColumn(db.Model):
    __tablename__ = 'cfg_process_function_column'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    function_id = db.Column(db.Integer())
    var_x = db.Column(db.Integer())
    var_y = db.Column(db.Integer())
    a = db.Column(db.Text())
    b = db.Column(db.Text())
    c = db.Column(db.Text())
    n = db.Column(db.Text())
    k = db.Column(db.Text())
    s = db.Column(db.Text())
    t = db.Column(db.Text())
    return_type = db.Column(db.Text())
    note = db.Column(db.Text())
    order = db.Column(db.Integer(), nullable=False)
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

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
            df.rename(columns={'id': cls.get_foreign_id_column_name()}, inplace=True)

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

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    trace_id = db.Column(db.Integer(), db.ForeignKey('cfg_trace.id', ondelete='CASCADE'))
    # TODO confirm PO delete
    self_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    self_column_substr_from = db.Column(db.Integer())
    self_column_substr_to = db.Column(db.Integer())

    target_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    target_column_substr_from = db.Column(db.Integer())
    target_column_substr_to = db.Column(db.Integer())

    delta_time = db.Column(db.Float())
    cut_off = db.Column(db.Float())

    order = db.Column(db.Integer())

    self_column = db.relationship('CfgProcessColumn', foreign_keys=[self_column_id], lazy='joined')
    target_column = db.relationship('CfgProcessColumn', foreign_keys=[target_column_id], lazy='joined')

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class CfgTrace(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_trace'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    self_process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    target_process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    is_trace_backward = db.Column(db.Boolean(), default=False)

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    trace_keys: List[CfgTraceKey] = db.relationship(
        'CfgTraceKey',
        lazy='joined',
        backref='cfg_trace',
        cascade='all',
        order_by='asc(CfgTraceKey.self_column_id)',
    )

    self_process = db.relationship('CfgProcess', foreign_keys=[self_process_id], lazy='joined')
    target_process = db.relationship('CfgProcess', foreign_keys=[target_process_id], lazy='joined')

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

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    filter_id = db.Column(db.Integer(), db.ForeignKey('cfg_filter.id', ondelete='CASCADE'))
    parent_detail_id = db.Column(db.Integer(), db.ForeignKey(id, ondelete='CASCADE'))
    name = db.Column(db.Text())
    filter_condition = db.Column(db.Text())
    filter_function = db.Column(db.Text())
    filter_from_pos = db.Column(db.Integer())

    order = db.Column(db.Integer())

    parent = db.relationship('CfgFilterDetail', lazy='joined', backref='cfg_children', remote_side=[id], uselist=False)
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    def __eq__(self, other):
        return (
            isinstance(other, self.__class__)
            and getattr(other, self.id.key, None)
            and self.id
            and getattr(other, self.id.key, None) == self.id
        )

    def __hash__(self):
        return hash(str(self.id))


class CfgFilter(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_filter'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    name = db.Column(db.Text())
    column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'))  # TODO confirm PO
    filter_type = db.Column(db.Text())
    parent_id = db.Column(
        db.Integer(),
        db.ForeignKey(id, ondelete='CASCADE'),
        nullable=True,
    )  # TODO check if needed to self ref

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    parent = db.relationship('CfgFilter', lazy='joined', backref='cfg_children', remote_side=[id], uselist=False)
    column = db.relationship('CfgProcessColumn', lazy='joined', backref='cfg_filters', uselist=False)
    filter_details = db.relationship('CfgFilterDetail', lazy='joined', backref='cfg_filter', cascade='all')

    @classmethod
    def delete_by_id(cls, meta_session, filter_id):
        cfg_filter = meta_session.query(cls).get(filter_id)
        if cfg_filter:
            meta_session.delete(cfg_filter)


class CfgVisualization(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_visualization'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('cfg_process.id', ondelete='CASCADE'))
    # TODO confirm PO
    control_column_id = db.Column(db.Integer(), db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'))
    filter_column_id = db.Column(
        db.Integer(),
        db.ForeignKey('cfg_process_column.id', ondelete='CASCADE'),
        nullable=True,
    )
    # filter_column_id = db.Column(db.Integer(), nullable=True)
    filter_value = db.Column(db.Text())
    is_from_data = db.Column(db.Boolean(), default=False)
    filter_detail_id = db.Column(db.Integer(), db.ForeignKey('cfg_filter_detail.id', ondelete='CASCADE'), nullable=True)

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
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)
    deleted_at = db.Column(db.Text())

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
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

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
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)


class AppLog(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 't_app_log'
    __table_args__ = {'sqlite_autoincrement': True}

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    ip = db.Column(db.Text())
    action = db.Column(db.Text())
    description = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)


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


class CfgDataSourceCSV(db.Model):
    # __bind_key__ = 'app_metadata'
    __tablename__ = 'cfg_data_source_csv'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), db.ForeignKey('cfg_data_source.id', ondelete='CASCADE'), primary_key=True)
    directory = db.Column(db.Text())
    skip_head = db.Column(db.Integer(), default=None)
    skip_tail = db.Column(db.Integer(), default=0)
    n_rows = db.Column(db.Integer(), nullable=True)
    is_transpose = db.Column(db.Boolean(), nullable=True)
    delimiter = db.Column(db.Text(), default=CsvDelimiter.CSV.name)
    etl_func = db.Column(db.Text())
    process_name = db.Column(db.Text())
    dummy_header = db.Column(db.Boolean(), default=False)
    is_file_path = db.Column(db.Boolean(), nullable=True, default=False)
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)
    # TODO check fetch all
    csv_columns: List[CfgCsvColumn] = db.relationship(
        'CfgCsvColumn',
        backref='cfg_data_source_csv',
        lazy='subquery',
        cascade='all',
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


class CfgUserSetting(db.Model):
    # __bind_key__ = 'app_metadata'
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
    save_graph_settings = db.Column(db.Boolean())
    settings = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

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

    id = db.Column(db.Text(), primary_key=True)
    params = db.Column(db.Text())
    odf = db.Column(db.Text())

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

    options = db.relationship('CfgOption', cascade='all, delete', backref='parent')

    @classmethod
    def save_odf_and_params_by_req_id(cls, session, req_id, odf, params):
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

    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    option = db.Column(db.Text())
    req_id = db.Column(db.Text(), db.ForeignKey('cfg_request.id', ondelete='CASCADE'))

    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

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


# class ProcDataCount(db.Model):
#     __tablename__ = 't_proc_data_count'
#     __table_args__ = {'sqlite_autoincrement': True}
#     id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
#     datetime = db.Column(db.Text(), index=True)
#     process_id = db.Column(db.Integer(), index=True)
#     job_id = db.Column(db.Integer())
#     count = db.Column(db.Integer())
#     created_at = db.Column(db.Text(), default=get_current_timestamp)
#
#     @classmethod
#     def get_procs_count(cls):
#         output = cls.query.with_entities(cls.process_id, func.sum(cls.count).label(cls.count.key))
#         output = output.group_by(cls.process_id).all()
#         return output
#
#     @classmethod
#     def get_by_proc_id(cls, proc_id, start_date, end_date):
#         result = cls.query.with_entities(cls.datetime, cls.count).filter(cls.process_id == proc_id)
#         if start_date != end_date:
#             result = result.filter(cls.datetime >= start_date, cls.datetime < end_date)
#
#         result = result.all()
#         return result
#
#     @classmethod
#     def delete_data_count_by_process_id(cls, proc_id):
#         delete_query = cls.__table__.delete().where(cls.process_id == proc_id)
#         db.session.execute(delete_query)
#         db.session.commit()


class MFunction(db.Model):
    __tablename__ = 'm_function'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True)
    function_type = db.Column(db.Text())
    function_name_en = db.Column(db.Text())
    function_name_jp = db.Column(db.Text())
    description_en = db.Column(db.Text())
    description_jp = db.Column(db.Text())
    x_type = db.Column(db.Text())  # r,i,t is real, int, text
    y_type = db.Column(db.Text())  #
    return_type = db.Column(db.Text())  # r,i,t is real, int, text. 'x' is same as x, 'y' is same as y
    show_serial = db.Column(db.Boolean())
    a = db.Column(db.Text())
    b = db.Column(db.Text())
    c = db.Column(db.Text())
    n = db.Column(db.Text())
    k = db.Column(db.Text())
    s = db.Column(db.Text())
    t = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    updated_at = db.Column(db.Text(), default=get_current_timestamp, onupdate=get_current_timestamp)

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
        # extend integer types
        if RawDataTypeDB.INTEGER in x_types:
            x_types.extend([RawDataTypeDB.BIG_INT])
        return [dtype for dtype in x_types if dtype is not None]

    def get_possible_y_types(self) -> list[RawDataTypeDB]:
        if not self.has_y():
            return []
        y_types = [RawDataTypeDB.get_by_enum_value(dtype) for dtype in self.get_string_y_types()]
        # extend integer types
        if RawDataTypeDB.INTEGER in y_types:
            y_types.extend([RawDataTypeDB.BIG_INT])
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


def get_models():
    all_sub_classes = db.Model.__subclasses__()
    return tuple([_class for _class in all_sub_classes if hasattr(_class, '__tablename__')])


def make_f(model):
    list_of_target = (CfgProcess, CfgProcessColumn, CfgFilter, CfgFilterDetail, CfgTrace, CfgTraceKey, CfgVisualization)

    @event.listens_for(model, 'before_insert')
    def before_insert(_mapper, _connection, target):
        model_normalize(target)
        if isinstance(target, list_of_target):
            set_all_cache_expired(CacheType.CONFIG_DATA)

    @event.listens_for(model, 'before_update')
    def before_update(_mapper, _connection, target):
        model_normalize(target)
        if isinstance(target, list_of_target):
            set_all_cache_expired(CacheType.CONFIG_DATA)


def add_listen_event():
    for model in get_models():
        make_f(model)


# add trigger in CRUD config data
add_listen_event()
