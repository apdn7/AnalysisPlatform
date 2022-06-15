from sqlalchemy import Index, event
from sqlalchemy.orm import load_only, aliased
from sqlalchemy.sql import func

from histview2 import db, dic_config, PARTITION_NUMBER
from histview2.common.common_utils import get_current_timestamp, gen_sql_label, chunks
from histview2.common.constants import DataType
from histview2.common.services.normalization import model_normalize
from histview2.setting_module.models import CfgProcessColumn

SQLITE_DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%f000Z'


class Period(db.Model):
    __tablename__ = 'm_period'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    start_tm = db.Column(db.Text())
    end_tm = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    processes = db.relationship('Process', lazy='subquery', backref="m_period", cascade="all")

    # get period or create new
    @classmethod
    def get_or_create_period(cls, period_id=None):
        if period_id:
            period = cls.query.get(period_id)
        else:
            period = cls.query.filter(cls.end_tm.is_(None)).first()

        if not period:
            now = get_current_timestamp()
            period = cls(start_tm=now)
            db.session.add(period)
            db.session.commit()

        return period


class Process(db.Model):
    __tablename__ = 'm_process'
    __table_args__ = {'sqlite_autoincrement': True}
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    period_id = db.Column(db.Integer(), db.ForeignKey('m_period.id', ondelete="CASCADE"))
    name = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)
    sensors = db.relationship('Sensor', lazy='dynamic', backref="m_process", cascade="all")

    # get proc or create new
    @classmethod
    def get_or_create_proc(cls, proc_id=None, proc_name=None, period_id=None):
        proc = None
        if not period_id:
            period = Period.get_or_create_period()
            period_id = period.id

        if proc_id:
            proc = cls.query.get(proc_id)
        elif proc_name:
            proc = cls.query.filter(cls.period_id == period_id, cls.name == proc_name).first()

        if not proc:
            if proc_id:
                proc = cls(id=proc_id, name=proc_name, period_id=period_id)
            else:
                proc = cls(name=proc_name, period_id=period_id)

            db.session.add(proc)
            db.session.commit()

        return proc

    def delete_proc_detail(self):
        # get sensors
        sensor_ids = [(sensor.id, DataType(sensor.type)) for sensor in self.sensors]

        # delete all sensors' values (int, real, text) of target proc
        for s_id, s_type in sensor_ids:
            sensor_cls = find_sensor_class(s_id, s_type)
            sensor_cls.delete_by_sensor_id(s_id)

        # delete sensors master
        Sensor.delete_by_proc_id(self.id)

        # delete cycles
        cycle_cls = find_cycle_class(self.id)
        cycle_cls.delete_by_proc_id(self.id)

    @classmethod
    def get_all_ids(cls):
        return cls.query.options(load_only(cls.id)).all()


class Global(db.Model):
    __tablename__ = 'm_global'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    name = db.Column(db.Text())
    created_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def delete_all(cls):
        """delete all records
        """
        cls.query.delete()
        db.session.commit()

    @classmethod
    def get_max_id(cls):
        """get max global id
        """
        out = cls.query.options(load_only(cls.id)).order_by(cls.id.desc()).first()

        if not out:
            return 0

        return out.id


class Sensor(db.Model):
    __tablename__ = 'm_sensor'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    process_id = db.Column(db.Integer(), db.ForeignKey('m_process.id', ondelete="CASCADE"), index=True)
    column_name = db.Column(db.Text())
    type = db.Column(db.Integer())
    created_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def get_sensors_by_proc_id(cls, process_id):
        sensors = Sensor.query.filter(Sensor.process_id == process_id)
        return sensors

    @classmethod
    def get_sensor_by_col_name(cls, process_id, col_name):
        sensor = cls.query.filter(cls.process_id == process_id, cls.column_name == col_name).first()
        return sensor

    @classmethod
    def get_sensor_by_col_names(cls, process_id, col_names):
        sensors = cls.query.filter(cls.process_id == process_id, cls.column_name.in_(col_names)).all()
        return sensors

    @classmethod
    def delete_by_proc_id(cls, process_id):
        # Sensor.query.filter(cls.process_id == process_id).delete()
        delete_q = cls.__table__.delete().where(cls.process_id == process_id)
        db.session.execute(delete_q)
        db.session.commit()

    @classmethod
    def get_substring_sensors(cls, process_id, orig_sensor_id, orig_col_name):
        sensors = cls.query.filter(cls.process_id == process_id,
                                   cls.id != orig_sensor_id,
                                   cls.column_name.startswith(orig_col_name)).all()
        return sensors


class GlobalRelation(db.Model):
    __tablename__ = 't_global_relation'
    global_id = db.Column(db.Integer(), primary_key=True)
    relate_id = db.Column(db.Integer(), primary_key=True)
    created_at = db.Column(db.Text(), default=get_current_timestamp)

    @classmethod
    def delete_all(cls):
        """delete all records
        """
        cls.query.delete()
        db.session.commit()

    @classmethod
    def get_outlier_by_global_ids(cls, global_ids):
        return cls.query.filter(cls.global_id.in_(global_ids)) \
            .with_entities(GlobalRelation) \
            .all()

    @classmethod
    def get_by_ids(cls, global_ids):
        return cls.query.filter(cls.global_id.in_(global_ids)).all()

    @classmethod
    def get_all_relations_by_globals(cls, global_ids, set_done_globals=set()):
        # ignore global_id
        set_done_globals.update(global_ids)

        global_recs = cls.get_by_ids(global_ids)
        if not global_recs:
            return set_done_globals

        # get all relate ids as global ids for next trace (recursion)
        next_global_ids = [rec.relate_id for rec in global_recs if rec.relate_id not in set_done_globals]

        # recursion
        cls.get_all_relations_by_globals(next_global_ids, set_done_globals)
        return set_done_globals

    @classmethod
    def check_exist(cls, global_id, relate_id):
        result = cls.query.options(load_only(cls.global_id))
        return result.filter(cls.global_id == global_id, cls.relate_id == relate_id).first()

    @classmethod
    def get_all(cls):
        data = cls.query.with_entities(cls.global_id, cls.relate_id).all()
        return data


# ###################### TABLE PARTITION ###########################

PARTITION_TABLE = dic_config[PARTITION_NUMBER]
CYCLE_CLASSES = []
SENSOR_INT_CLASSES = []
SENSOR_REAL_CLASSES = []
SENSOR_TEXT_CLASSES = []


class CyclePartition:
    id = None
    global_id = None
    process_id = None
    time = None
    is_outlier = None
    created_at = None

    @classmethod
    def clear_global_id(cls):
        cls.query.update({cls.global_id: None})
        # Global.query.delete()
        db.session.commit()

    @classmethod
    def update_global_id(cls, cycle_id, global_id):
        cls.query.filter(cls.id == cycle_id).update({cls.global_id: global_id})

    @classmethod
    def gen_auto_global_id(cls, proc_id):
        # update cycle that global id is None
        cls.query.filter(cls.process_id == proc_id).filter(cls.global_id.is_(None)).update({cls.global_id: cls.id})

    @classmethod
    def get_none_global_ids(cls, proc_id):
        # get cycle ids (cycle_id, cycle_id as global_id)
        output = cls.query.filter(cls.process_id == proc_id).filter(cls.global_id.is_(None))
        output = output.with_entities(cls.id, cls.id).all()
        return output

    @classmethod
    def count_not_none_global_ids(cls, proc_id):
        output = cls.query.filter(cls.process_id == proc_id).filter(cls.global_id > 0).count()
        return output

    @classmethod
    def count_all(cls, proc_id):
        output = cls.query.filter(cls.process_id == proc_id).count()
        return output

    @classmethod
    def update_time_by_tzoffset(cls, proc_id, tz_offset):
        cls.query.filter(cls.process_id == proc_id).update(
            {cls.time: func.strftime(SQLITE_DATETIME_FORMAT, func.datetime(cls.time, tz_offset))},
            synchronize_session='fetch'
        )

    @classmethod
    def get_outlier_by_cycle_ids(cls, cycle_ids):
        return cls.query.filter(cls.id.in_(cycle_ids)).all()

    @classmethod
    def update_outlier_by_global_ids(cls, global_ids, is_outlier):
        if not global_ids:
            return

        cls.query.filter(cls.global_id.in_(global_ids)).update(
            {cls.is_outlier: is_outlier}, synchronize_session='fetch')

    @classmethod
    def get_global_ids(cls, cycle_ids):
        return cls.query.options(load_only(cls.global_id)).filter(cls.id.in_(cycle_ids), cls.global_id > 0).all()

    @classmethod
    def get_cycles_by_ids(cls, cycle_ids):
        return cls.query.filter(cls.id.in_(cycle_ids)).all()

    @classmethod
    def get_max_id(cls):
        """get max cycle id
        """
        out = cls.query.options(load_only(cls.id)).order_by(cls.id.desc()).first()

        if not out:
            return 0

        return out.id

    @classmethod
    def get_max_time_by_process(cls, proc_id):
        """get max time
        """
        out = cls.query.options(load_only(cls.time)).filter(cls.process_id == proc_id).order_by(
            cls.time.desc()).first()
        if not out:
            return None

        return out.time

    @classmethod
    def get_min_time_by_process(cls, proc_id):
        """get max time
        """
        out = cls.query.options(load_only(cls.time)).filter(cls.process_id == proc_id).order_by(cls.time).first()
        if not out:
            return None

        return out.time

    @classmethod
    def get_ids_by_time(cls, proc_id, filter_time):
        """ get ids by time
        """
        out = cls.query.options(load_only(cls.id)).filter(cls.process_id == proc_id, cls.time == filter_time)

        if not out:
            return []

        return [row.id for row in out]

    @classmethod
    def get_count_by_proc_id(cls, proc_id):
        out = cls.query.with_entities(func.count(1)).filter(cls.process_id == proc_id).scalar()
        return out

    @classmethod
    def delete_by_proc_id(cls, proc_id):
        # cls.query.filter(cls.process_id == proc_id).delete()
        delete_q = cls.__table__.delete().where(cls.process_id == proc_id)
        db.session.execute(delete_q)

    @classmethod
    def get_latest_cycle_ids(cls, proc_id, limit=5):
        """get max time
        """
        rows = cls.query.options(load_only(cls.id))
        rows = rows.filter(cls.process_id == proc_id).order_by(cls.time.desc()).limit(limit).all()
        if not rows:
            return None

        return [row.id for row in rows]


class SensorTypePartition:
    cycle_id = None
    sensor_id = None
    value = None
    created_at = None

    @classmethod
    def get_first_records(cls, sensor_name, limit=None, coef_col=None):
        """get first n records

        Arguments:
            sensor_id {[type]} -- [description]

        Keyword Arguments:
            limit {[type]} -- [description] (default: {None})
        """

        sensor_val = cls.value if coef_col is None else coef_col
        data = db.session.query(sensor_val).join(Sensor).filter(Sensor.column_name == sensor_name)

        if limit:
            data = data.limit(limit)

        return data.all()

    @classmethod
    def get_distinct_values(cls, sensor_name, limit=None, coef_col=None):
        """get first n records

        Arguments:
            sensor_id {[type]} -- [description]

        Keyword Arguments:
            limit {[type]} -- [description] (default: {None})
        """

        sensor_val = cls.value if coef_col is None else coef_col
        data = db.session.query(sensor_val).join(Sensor).filter(Sensor.column_name == sensor_name).group_by(sensor_val)
        # todo order by created_at, desc
        if limit:
            data = data.limit(limit)

        return data.all()

    @classmethod
    def get_last_distinct_values(cls, sensor_name, limit=10000, coef_col=None):
        """get first n records

        Arguments:
            sensor_id {[type]} -- [description]

        Keyword Arguments:
            limit {[type]} -- [description] (default: {None})
        """

        sensor_val = cls.value if coef_col is None else coef_col
        data = db.session.query(sensor_val).join(Sensor) \
            .filter(Sensor.column_name == sensor_name) \
            .order_by(Sensor.created_at.desc()) \
            .limit(limit)

        return data.all()

    @classmethod
    def coef(cls, cfg_col_id, is_set_label=True):  # TODO double check after coding trace data backend
        """calc coef

        Arguments:
            proc_id {[type]} -- [description]
            col_name {[type]} -- [description]

        Keyword Arguments:
            is_set_label {bool} -- [description] (default: {True})

        Returns:
            [type] -- [description]
        """

        cfg_column = CfgProcessColumn.query.get(cfg_col_id)
        ope = cfg_column.operator
        coef = cfg_column.coef
        col_name = cfg_column.column_name

        if ope and coef:
            sensor_val_col = cls.convert_operator(cls.value, ope, coef)
        else:
            sensor_val_col = cls.value

        # set label
        if is_set_label:
            sensor_val_col = sensor_val_col.label(gen_sql_label(cfg_col_id, col_name))
        else:
            sensor_val_col = sensor_val_col.label('value')

        return sensor_val_col

    @staticmethod
    def convert_operator(obj, operator, coef):
        """ convert operator

        Arguments:
            obj {[type]} -- [description]
            operator {[type]} -- [description]
            coef {[type]} -- [description]

        Returns:
            [type] -- [description]
        """
        try:
            dic_operator = {
                '*': obj.__mul__,
                '/': obj.__div__,
                '+': obj.__add__,
                '-': obj.__sub__,
            }
            func = dic_operator[operator]
            return func(coef)
        except Exception:
            return obj

    @classmethod
    def delete_by_sensor_id(cls, sensor_id):
        delete_q = cls.__table__.delete().where(cls.sensor_id == sensor_id)
        db.session.execute(delete_q)

    @classmethod
    def update_time_by_tzoffset(cls, proc_id, sensor_id, tz_offset):
        cycle_cls = find_cycle_class(proc_id)
        cycle_ids = db.session.query(cycle_cls.id).filter(cycle_cls.process_id == proc_id).all()
        # no data
        if not cycle_ids:
            return False

        cycle_ids = [cycle.id for cycle in cycle_ids]

        for ids in chunks(cycle_ids, 998):
            cls.query.filter(cls.cycle_id.in_(ids)).filter(cls.sensor_id == sensor_id).update(
                {cls.value: func.strftime(SQLITE_DATETIME_FORMAT, func.datetime(cls.value, tz_offset))},
                synchronize_session='fetch'
            )

        return True


def gen_partition_tables():
    """
    create 100 classes for partition tables
    :return:
    """
    # Cycle Table
    for partition_idx in range(PARTITION_TABLE):
        idx_str = str(partition_idx).zfill(len(str(PARTITION_TABLE)))

        table_name = f't_cycle_{idx_str}'
        cls_name = f'Cycle{idx_str}'
        cls = type(cls_name, (db.Model, CyclePartition),
                   {'__tablename__': table_name,
                    'id': db.Column(db.Integer(), primary_key=True),
                    'global_id': db.Column(db.Integer()),
                    'process_id': db.Column(db.Integer()),
                    'time': db.Column(db.Text()),
                    'is_outlier': db.Column(db.Integer(), default=0),
                    'created_at': db.Column(db.Text(), default=get_current_timestamp)
                    })

        Index(f'ix_t_cycle_time_{idx_str}', cls.time, cls.process_id)
        Index(f'ix_t_cycle_global_id_{idx_str}', cls.global_id, cls.process_id)
        CYCLE_CLASSES.append(cls)

        # SensorType Table
        table_names = ('int', 'real', 'text')
        class_names = ('Int', 'Real', 'Text')
        value_col_data_types = (db.Integer, db.FLOAT, db.Text)
        sensor_classes = (SENSOR_INT_CLASSES, SENSOR_REAL_CLASSES, SENSOR_TEXT_CLASSES)
        for _table_name, _class_name, _data_type, _sensor_classes in zip(table_names, class_names, value_col_data_types,
                                                                         sensor_classes):
            table_name = f't_sensor_type_{_table_name}_{idx_str}'
            cls_name = f'SensorType{_class_name}{idx_str}'
            cls = type(cls_name, (db.Model, SensorTypePartition),
                       {'__tablename__': table_name,
                        'cycle_id': db.Column(db.Integer(), primary_key=True),
                        'sensor_id': db.Column(db.Integer(), db.ForeignKey('m_sensor.id', ondelete="CASCADE"),
                                               primary_key=True),
                        'value': db.Column(_data_type()),
                        })
            _sensor_classes.append(cls)


# create table partition
gen_partition_tables()
Cycle: CyclePartition = CYCLE_CLASSES[0]
SensorType: SensorTypePartition = SENSOR_INT_CLASSES[0]


def find_cycle_class(process_id) -> CyclePartition:
    """
    get partition class of cycle
    :param process_id:
    :return:
    """
    idx = int(process_id) % PARTITION_TABLE
    return CYCLE_CLASSES[idx]


def find_sensor_class(sensor_id, data_type: DataType = None, auto_alias=False) -> SensorTypePartition:
    """ get partition class of sensor value

    Arguments:
        data_type {DataType} -- [description]

    Returns:
        [type] -- [description]
    """
    idx = sensor_id % PARTITION_TABLE
    if not data_type:
        sensor = Sensor.query.get(sensor_id)
        s_type = DataType(sensor.type)
    elif isinstance(data_type, DataType):
        s_type = data_type
    else:
        s_type = DataType(data_type)

    if s_type is DataType.INTEGER:
        sensor_classes = SENSOR_INT_CLASSES
    elif s_type is DataType.REAL:
        sensor_classes = SENSOR_REAL_CLASSES
    else:
        sensor_classes = SENSOR_TEXT_CLASSES

    target_cls = sensor_classes[idx]

    if auto_alias:
        target_cls = aliased(target_cls)

    return target_cls


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


def add_listen_event():
    for model in get_models():
        make_f(model)


# GUI normalization
add_listen_event()
