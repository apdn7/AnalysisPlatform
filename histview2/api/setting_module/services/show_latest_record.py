import os
from functools import lru_cache
from itertools import islice

from histview2.api.efa.services.etl import preview_data, detect_file_delimiter
from histview2.api.setting_module.services.csv_import import convert_csv_timezone
from histview2.api.setting_module.services.data_import import strip_special_symbol, validate_datetime
from histview2.api.setting_module.services.factory_import import get_tzoffset_of_random_record
from histview2.common.common_utils import guess_data_types, get_csv_delimiter, get_sorted_files
from histview2.common.constants import DBType, DataType, RelationShip, WR_VALUES, WR_HEADER_NAMES, WR_TYPES
from histview2.common.logger import log_execution_time
from histview2.common.memoize import memoize
from histview2.common.pydn.dblib import mssqlserver, oracle
from histview2.common.pydn.dblib.db_proxy import DbProxy
from histview2.common.services import csv_header_wrapr as chw
from histview2.common.services.csv_content import read_data, gen_data_types, is_normal_csv
from histview2.common.services.jp_to_romaji_utils import to_romaji, change_duplicated_columns
from histview2.common.services.normalization import normalize_list, normalize_big_rows
from histview2.common.timezone_utils import get_time_info
from histview2.setting_module.models import CfgDataSource, CfgProcessColumn, CfgVisualization, \
    make_session, CfgProcess, crud_config
from histview2.setting_module.schemas import VisualizationSchema
from histview2.trace_data.models import Sensor, find_sensor_class


def get_latest_records(data_source_id, table_name, limit):
    blank_output = dict(cols=[], rows=[])
    if not data_source_id:
        return blank_output

    data_source = CfgDataSource.query.get(data_source_id)
    if not data_source:
        return blank_output

    previewed_files = None
    cols_with_types = []
    if data_source.type.lower() == DBType.CSV.name.lower():
        csv_detail = data_source.csv_detail
        dic_preview = preview_csv_data(csv_detail.directory, csv_detail.etl_func, csv_detail.delimiter, limit,
                                       return_df=True)
        headers = dic_preview.get('header')
        data_types = dic_preview.get('dataType')
        if headers and data_types:
            cols_with_types = gen_cols_with_types(headers, data_types)

        # sort columns
        sorted_columns = sorted(csv_detail.csv_columns, key=lambda c: c.order or c.id)
        cols = [col.column_name for col in sorted_columns if col.column_name in headers]

        # get rows
        df_rows = dic_preview.get('content', None)
        previewed_files = dic_preview.get('previewed_files')
    else:
        cols, df_rows = get_info_from_db(data_source, table_name)
        data_types = [gen_data_types(df_rows[col]) for col in cols]
        if cols and data_types:
            cols_with_types = gen_cols_with_types(cols, data_types)
        # format data
        df_rows = convert_utc_df(df_rows, cols, data_types, data_source, table_name)

    # change name if romaji cols is duplicated
    cols_with_types, cols_duplicated = change_duplicated_columns(cols_with_types)
    rows = transform_df_to_rows(cols, df_rows, limit)
    return cols_with_types, rows, cols_duplicated, previewed_files


def gen_data_types_from_factory_type(cols, cols_with_types):
    dic_col_type = {col.get('name'): guess_data_types(col.get('type')) for col in cols_with_types}
    return [dic_col_type.get(col) for col in cols]


@lru_cache(maxsize=20)
def get_info_from_db(data_source, table_name):
    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], []

        sql_limit = 2000
        if isinstance(db_instance, mssqlserver.MSSQLServer):
            cols, rows = db_instance.run_sql("select TOP {}  * from \"{}\"".format(sql_limit, table_name), False)
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                "select * from \"{}\" where rownum <= {}".format(table_name, sql_limit), False)
        else:
            cols, rows = db_instance.run_sql("select * from \"{}\" limit {}".format(table_name, sql_limit), False)

    cols = normalize_list(cols)
    df_rows = normalize_big_rows(rows, cols, strip_quote=False)
    return cols, df_rows


def get_filter_col_data(proc_config: dict):
    filter_cfgs = proc_config.get('filters') or []
    cfg_col_ids = [filter_cfg.get('column_id') for filter_cfg in filter_cfgs]
    if not cfg_col_ids:
        return {}
    sensor_data = {}
    for col_id in cfg_col_ids:
        sensor_data[col_id] = get_distinct_sensor_values(col_id)
    return sensor_data


@memoize()
def get_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    if not cfg_col:
        return []
    sensor = Sensor.get_sensor_by_col_name(cfg_col.process_id, cfg_col.column_name)
    sensor_vals = []
    if sensor:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type))
        sensor_vals = sensor_val_cls.get_distinct_values(cfg_col.column_name, limit=1000)
        sensor_vals = [sensor_val.value for sensor_val in sensor_vals]
    return sensor_vals


@memoize()
def get_last_distinct_sensor_values(cfg_col_id):
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    if not cfg_col:
        return []
    sensor = Sensor.get_sensor_by_col_name(cfg_col.process_id, cfg_col.column_name)
    unique_sensor_vals = set()
    if sensor:
        sensor_val_cls = find_sensor_class(sensor.id, DataType(sensor.type))
        sensor_vals = sensor_val_cls.get_last_distinct_values(cfg_col.column_name, limit=10000)
        unique_sensor_vals = set([sensor_val.value for sensor_val in sensor_vals][:1000])
        unique_sensor_vals = sorted(unique_sensor_vals)
    return list(unique_sensor_vals)


def save_master_vis_config(proc_id, cfg_jsons):
    vis_schema = VisualizationSchema()

    with make_session() as meta_session:
        proc: CfgProcess = meta_session.query(CfgProcess).get(proc_id or -1)
        if proc:
            cfg_vis_data = []
            for cfg_json in cfg_jsons:
                cfg_vis_data.append(vis_schema.load(cfg_json))
            crud_config(meta_session=meta_session,
                        data=cfg_vis_data,
                        model=CfgVisualization,
                        key_names=CfgVisualization.id.key,
                        parent_key_names=CfgVisualization.process_id.key,
                        parent_obj=proc,
                        parent_relation_key=CfgProcess.visualizations.key,
                        parent_relation_type=RelationShip.MANY)


@log_execution_time()
def preview_csv_data(folder_url, etl_func, csv_delimiter, limit, return_df=False):
    df_data_details = None
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files(folder_url)
    sorted_files = sorted_files[0:5]

    csv_file = ''
    skip_head = 0
    skip_tail = 0
    header_names = []
    data_types = []
    data_details = []
    if not sorted_files:
        return {
            'file_name': csv_file,
            'header': header_names,
            'content': [] if return_df else data_details,
            'dataType': data_types,
            'skip_head': skip_head,
            'skip_tail': skip_tail,
            'previewed_files': sorted_files,
        }

    csv_file = sorted_files[0]

    # call efa etl
    has_data_file = None
    if etl_func:
        # try to get file which has data to detect data types + get col names
        for file_path in sorted_files:
            preview_file_path = preview_data(file_path)
            if preview_file_path and not isinstance(preview_file_path, Exception):
                has_data_file = True
                csv_file = preview_file_path
                csv_delimiter = detect_file_delimiter(csv_file, csv_delimiter)
                break

    if (etl_func and has_data_file) or is_normal_csv(csv_file, csv_delimiter):
        for i in range(2):
            data = None
            try:
                data = read_data(csv_file, delimiter=csv_delimiter, do_normalize=False)
                header_names = next(data)

                # strip special symbols
                if i == 0:
                    data = strip_special_symbol(data)

                # get 5 rows
                data_details = list(islice(data, 1000))
            finally:
                if data:
                    data.close()

            if data_details:
                break

        # normalization
        header_names = normalize_list(header_names)
        df_data_details = normalize_big_rows(data_details, header_names)
        data_types = [gen_data_types(df_data_details[col]) for col in header_names]
    else:
        # try to get file which has data to detect data types + get col names
        dic_file_info, csv_file = get_etl_good_file(sorted_files)
        if dic_file_info and csv_file:
            skip_head = chw.get_skip_head(dic_file_info)
            skip_tail = chw.get_skip_tail(dic_file_info)
            header_names = chw.get_columns_name(dic_file_info)
            etl_headers = chw.get_etl_headers(dic_file_info)
            data_types = chw.get_data_type(dic_file_info)
            for i in range(2):
                data = None
                try:
                    data = read_data(csv_file, headers=header_names, skip_head=skip_head, delimiter=csv_delimiter,
                                     do_normalize=False)
                    # non-use header
                    next(data)

                    # strip special symbols
                    if i == 0:
                        data = strip_special_symbol(data)

                    # get 5 rows
                    data_details = list(islice(data, limit + skip_tail))
                    data_details = data_details[:len(data_details) - skip_tail]
                finally:
                    if data:
                        data.close()

                if data_details:
                    break

            # Merge heads with Machine, Line, Process
            if etl_headers[WR_VALUES]:
                header_names += etl_headers[WR_HEADER_NAMES]
                data_types += etl_headers[WR_TYPES]
                data_details = chw.merge_etl_heads(etl_headers[WR_VALUES], data_details)

            header_names = normalize_list(header_names)
            df_data_details = normalize_big_rows(data_details, header_names)

    if df_data_details is not None:
        # convert utc
        for col, dtype in zip(header_names, data_types):
            if DataType(dtype) is not DataType.DATETIME:
                continue
            # Convert UTC time
            validate_datetime(df_data_details, col, False, False)
            convert_csv_timezone(df_data_details, col)
            df_data_details.dropna(subset=[col], inplace=True)

        df_data_details = df_data_details[0:5]
        if not return_df:
            df_data_details = df_data_details.to_records(index=False).tolist()
    else:
        if not return_df:
            df_data_details = []

    if csv_file:
        csv_file = csv_file.replace('/', os.sep)

    return {
        'file_name': csv_file,
        'header': header_names,
        'content': df_data_details,
        'dataType': data_types,
        'skip_head': skip_head,
        'skip_tail': skip_tail,
        'previewed_files': sorted_files,
    }


@log_execution_time()
def get_etl_good_file(sorted_files):
    csv_file = None
    dic_file_info = None
    for file_path in sorted_files:
        check_result = chw.get_file_info_py(file_path)
        if isinstance(check_result, Exception):
            continue

        dic_file_info, is_empty_file = check_result

        if dic_file_info is None:
            continue

        if is_empty_file:
            continue

        csv_file = file_path
        break

    return dic_file_info, csv_file


@log_execution_time()
def gen_cols_with_types(cols, data_types):
    cols_with_types = []
    for col_name, data_type in zip(cols, data_types):
        is_date = DataType(data_type) is DataType.DATETIME

        # add to output
        if col_name:
            cols_with_types.append({
                "name": col_name,
                "type": DataType(data_type).name,
                'romaji': to_romaji(col_name),
                'is_date': is_date,
            })

    return cols_with_types


@log_execution_time()
def convert_utc_df(df_rows, cols, data_types, data_source, table_name):
    for col_name, data_type in zip(cols, data_types):
        is_date = DataType(data_type) is DataType.DATETIME
        if not is_date:
            continue

        # convert utc
        date_val, tzoffset_str, db_timezone = get_tzoffset_of_random_record(data_source, table_name, col_name)

        # use os timezone
        if data_source.db_detail.use_os_timezone:
            db_timezone = None

        is_tz_inside, _, time_offset = get_time_info(date_val, db_timezone)

        # Convert UTC time
        validate_datetime(df_rows, col_name, False, False)
        convert_csv_timezone(df_rows, col_name)
        df_rows.dropna(subset=[col_name], inplace=True)

    return df_rows


def transform_df_to_rows(cols, df_rows, limit):
    return [dict(zip(cols, vals)) for vals in df_rows[0:limit][cols].to_records(index=False).tolist()]


@log_execution_time()
def gen_preview_data_check_dict(rows, previewed_files):
    dic_preview_limit = {}
    file_path = previewed_files[0] if previewed_files else ''
    file_name = ''
    folder_path = ''
    if file_path:
        file_name = os.path.basename(file_path)
        folder_path = os.path.dirname(file_path)

    dic_preview_limit['reach_fail_limit'] = True if not rows and previewed_files else False
    dic_preview_limit['file_name'] = file_name
    dic_preview_limit['folder'] = folder_path
    return dic_preview_limit
