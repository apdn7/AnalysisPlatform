from functools import lru_cache

from ap import db
from sqlalchemy.sql import func

from ap.common.constants import DBType, ProcessCfgConst, DataType
from ap.common.pydn.dblib.db_proxy import DbProxy
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.setting_module.models import CfgProcess, make_session, CfgDataSource, crud_config, CfgProcessColumn, \
    insert_or_update_config, CfgFilter, CfgVisualization
from ap.setting_module.schemas import ProcessSchema, ProcessOnlySchema, ProcessColumnSchema, FilterSchema, \
    ProcessVisualizationSchema
from ap.trace_data.models import find_cycle_class, find_sensor_class


def get_all_process():
    process = CfgProcess.get_all() or []
    return process


def get_all_process_no_nested():
    process_only_schema = ProcessOnlySchema(many=True)
    processes = CfgProcess.get_all() or []
    return process_only_schema.dump(processes, many=True)


def get_process_cfg(proc_id):
    process_schema = ProcessSchema()
    process = CfgProcess.query.get(proc_id) or {}
    return process_schema.dump(process)


def get_process_columns(proc_id):
    proc_col_schema = ProcessColumnSchema(many=True)
    columns = CfgProcessColumn.query.filter(CfgProcessColumn.process_id == proc_id).all() or []
    return proc_col_schema.dump(columns)


def get_process_filters(proc_id):
    proc_filter_schema = FilterSchema(many=True)
    filters = CfgFilter.query.filter(CfgFilter.process_id == proc_id).all() or []
    return proc_filter_schema.dump(filters)


def get_process_visualizations(proc_id):
    proc_vis_schema = ProcessVisualizationSchema()
    process = CfgProcess.query.get(proc_id) or {}
    return proc_vis_schema.dump(process)


def get_all_visualizations():
    return list(set([cfg.filter_detail_id for cfg in CfgVisualization.get_filter_ids()]))


# def get_all_process_cfg_with_nested():
#     process_schema = ProcessSchema(many=True)
#     processes = CfgProcess.get_all() or []
#     return process_schema.dump(processes, many=True)


def create_or_update_process_cfg(proc_data):
    with make_session() as meta_session:
        # save process config
        process = insert_or_update_config(meta_session=meta_session, data=proc_data,
                                          key_names=CfgProcess.id.key, model=CfgProcess)
        meta_session.commit()

        # create column alchemy object + assign process id
        columns = proc_data[ProcessCfgConst.PROC_COLUMNS.value]
        for proc_column in columns:
            # transform data type
            proc_column.predict_type = proc_column.data_type
            if proc_column.data_type in (DataType.EU_REAL_SEP.name, DataType.REAL_SEP.name):
                proc_column.data_type = DataType.REAL.name
            if proc_column.data_type in (DataType.EU_INTEGER_SEP.name, DataType.INTEGER_SEP.name):
                proc_column.data_type = DataType.INTEGER.name

            proc_column.process_id = process.id
            # transform english name
            proc_column.english_name = to_romaji(proc_column.english_name)

        # save columns
        crud_config(meta_session=meta_session,
                    data=columns,
                    parent_key_names=CfgProcessColumn.process_id.key,
                    key_names=CfgProcessColumn.column_name.key,
                    model=CfgProcessColumn)

    return process


def query_database_tables(db_id):
    with make_session() as mss:
        data_source = mss.query(CfgDataSource).get(db_id)
        if not data_source:
            return None

        output = dict(ds_type=data_source.type, tables=[])
        # return None if CSV
        if data_source.type.lower() == DBType.CSV.name.lower():
            return output

        updated_at = data_source.db_detail.updated_at
        output['tables'] = get_list_tables_and_views(data_source.id, updated_at)

    return output


@lru_cache(maxsize=20)
def get_list_tables_and_views(data_source_id, updated_at=None):
    # updated_at only for cache
    print('database config updated_at:', updated_at, ', so cache can not be used')
    with DbProxy(data_source_id) as db_instance:
        tables = db_instance.list_tables_and_views()

    return tables


def get_ds_tables(ds_id):
    try:
        tables = query_database_tables(ds_id)
        return tables['tables'] or []
    except Exception:
        return []


def get_datasource_and_tables(data_sources):
    tables = []
    ds_objects = {
        'list_ds': [convert2serialize(ds) for ds in data_sources],
        'tables': tables
    }
    return ds_objects


def convert2serialize(obj):
    if isinstance(obj, dict):
        return {k: convert2serialize(v) for k, v in obj.items()}
    elif hasattr(obj, "_ast"):
        return convert2serialize(obj._ast())
    elif not isinstance(obj, str) and hasattr(obj, "__iter__"):
        return [convert2serialize(v) for v in obj]
    elif hasattr(obj, "__dict__"):
        return {
            k: convert2serialize(v)
            for k, v in obj.__dict__.items()
            if not callable(v) and not k.startswith('_')
        }
    else:
        return obj

def get_ct_range(proc_id, columns):
    is_using_dummy_datetime = True in [col['is_get_date'] and col['is_dummy_datetime'] for col in columns]

    if not is_using_dummy_datetime:
        return []

    try:
        cycle_cls = find_cycle_class(proc_id)
        ct_range = db.session.query(cycle_cls.id, cycle_cls.time)\
            .filter(cycle_cls.process_id == proc_id)\
            .with_entities(
                func.min(cycle_cls.time).label('min_time'),
                func.max(cycle_cls.time).label('max_time')
            ).first()
        return list(ct_range)
    except Exception:
        return []