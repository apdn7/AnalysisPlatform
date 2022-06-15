### EXPORT
import io
import os
import pickle
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

import pandas as pd
from flask import make_response

from histview2.api.trace_data.services.time_series_chart import get_proc_ids_in_dic_param
from histview2.common.common_utils import get_basename, resource_path, get_export_path, read_pickle_file, set_debug_data
from histview2.common.constants import AbsPath, DIC_FORM_NAME, CONFIG_DB_NAME, DF_NAME, DebugKey, CsvDelimiter, \
    COMMON, IS_EXPORT_MODE, IS_IMPORT_MODE, MemoizeKey, USER_SETTING_NAME
from histview2.common.memoize import set_cache_attr
from histview2.common.services.form_env import bind_dic_param_to_class, parse_multi_filter_into_one
from histview2.common.trace_data_log import get_log_attr, TraceErrKey, EventAction, Target
from histview2.setting_module.models import CfgProcess, DataTraceLog, make_session, CfgProcessColumn, CfgFilter, \
    CfgTrace, CfgVisualization, CfgFilterDetail, CfgTraceKey, CfgUserSetting, CfgDataSource, CfgDataSourceDB, \
    CfgDataSourceCSV, CfgCsvColumn
from histview2.setting_module.schemas import ProcessFullSchema, CfgUserSettingSchema


def export_debug_info(dataset_id, user_setting_id):
    recs = DataTraceLog.get_dataset_id(dataset_id, EventAction.SAVE.value)
    file_dic_form = None
    file_df = None
    for rec in recs:
        if rec.target == Target.TSV.value:
            file_df = rec.dumpfile
        elif rec.target == Target.PICKLE.value:
            file_dic_form = rec.dumpfile

    config_buffer = None
    if file_dic_form:
        dic_form = read_pickle_file(file_dic_form)
        dic_param = parse_multi_filter_into_one(dic_form)
        graph_param = bind_dic_param_to_class(dic_param)
        config_buffer = io.BytesIO()
        config_data = gen_config_json(graph_param)
        pickle.dump(config_data, config_buffer, pickle.HIGHEST_PROTOCOL)

    # user_setting_id
    user_setting_buffer = io.BytesIO()
    user_setting = gen_user_setting_json(user_setting_id)
    pickle.dump(user_setting, user_setting_buffer, pickle.HIGHEST_PROTOCOL)

    # TODO : naming zip file
    response = download_zip_file('export_file', [file_dic_form, file_df, config_buffer, user_setting_buffer],
                                 [f'{DIC_FORM_NAME}.pickle', f'{DF_NAME}.tsv', f'{CONFIG_DB_NAME}.pickle',
                                  f'{USER_SETTING_NAME}.pickle'])
    return response

    # output_file = create_export_file_path('FPP')
    # zip_a_file(output_file, [file_dic_form, file_df, config_buffer], ['dic_form', 'df', 'config_db'])
    # return output_file


def check_if_using_cache(dic_param):
    if dic_param[COMMON].get(IS_EXPORT_MODE) or dic_param[COMMON].get(IS_IMPORT_MODE):
        set_cache_attr(MemoizeKey.STOP_USING_CACHE, True)


def set_export_dataset_id_to_dic_param(dic_param):
    if dic_param[COMMON].get(IS_EXPORT_MODE):
        dic_param[IS_EXPORT_MODE] = get_log_attr(TraceErrKey.DATASET)

    return True


def create_export_file_path(key):
    file_path = resource_path(get_export_path(), key, level=AbsPath.SHOW)
    if not os.path.exists(os.path.dirname(file_path)):
        os.makedirs(os.path.dirname(file_path))

    return file_path


def gen_config_json(graph_param):
    """
    get all process from graph_param then gen its json
    :param graph_param:
    :return:
    """
    process_schema = ProcessFullSchema()
    proc_ids = get_proc_ids_in_dic_param(graph_param)
    processes = CfgProcess.get_procs(proc_ids)
    return process_schema.dump(processes, many=True)


def gen_user_setting_json(user_setting_id):
    """
    get user setting json
    :param user_setting_id:
    :return:
    """

    user_setting = CfgUserSetting.get_by_id(setting_id=user_setting_id)
    user_setting_schema = CfgUserSettingSchema()
    return user_setting_schema.dump(user_setting)


def zip_a_file(zip_file, target_file_paths, target_file_names=None):
    with ZipFile(zip_file, 'w', ZIP_DEFLATED, compresslevel=9) as zipf:
        for idx, target_file in enumerate(target_file_paths):
            if not target_file:
                continue

            if target_file_names:
                file_name = target_file_names[idx]
            else:
                file_name = get_basename(target_file)

            if isinstance(target_file, io.BytesIO):
                zipf.writestr(file_name, target_file.getvalue())
            else:
                zipf.write(target_file, arcname=file_name)

    return True


def download_zip_file(zip_file_name, target_file_paths, target_file_names=None):
    file_obj = io.BytesIO()
    zip_a_file(file_obj, target_file_paths, target_file_names)
    file_obj.seek(0)

    response = make_response(file_obj.read())
    response.headers.set('Content-Type', 'zip')
    # response.headers.set('Content-Disposition', 'attachment', f'filename={zip_file_name}.zip')
    response.headers.set('Content-Disposition', 'attachment', filename=f'{zip_file_name}.zip')
    return response


# IMPORT
def import_user_setting_db(zip_file):
    user_setting = extract_one_file(zip_file, f'{USER_SETTING_NAME}.pickle')
    user_setting = pickle.loads(user_setting)
    clear_config_db([CfgUserSetting])
    insert_data_to_table(CfgUserSetting, user_setting)

    return user_setting


def get_dic_form_from_debug_info(dic_param):
    # check if using cache or not (export mode)
    check_if_using_cache(dic_param)

    filename = dic_param[COMMON].get(IS_IMPORT_MODE)
    debug_info_file = get_zip_full_path(filename)
    if debug_info_file:
        dic_form = get_dic_form(debug_info_file)
        dic_param = parse_multi_filter_into_one(dic_form)
        dic_param[COMMON][IS_EXPORT_MODE] = None

    return dic_param


def get_dic_form(zip_file):
    dic_form = extract_one_file(zip_file, f'{DIC_FORM_NAME}.pickle')
    dic_form = pickle.loads(dic_form)

    df = extract_one_file(zip_file, f'{DF_NAME}.tsv')
    df = pd.read_csv(io.BytesIO(df), sep=CsvDelimiter.TSV.value)
    set_debug_data(DebugKey.GET_DATA_FROM_DB.name, df)
    set_debug_data(DebugKey.IS_DEBUG_MODE.name, True)

    return dic_form


def get_data_source_info(config_db):
    dic_ds = {}
    dic_ds_db = {}
    dic_ds_csv = {}
    dic_csv_col = {}
    for proc in config_db:
        ds = proc[CfgProcess.data_source.key]
        ds_id = ds[CfgDataSource.id.key]

        # already exist
        if ds_id in dic_ds:
            continue

        # add data source
        dic_ds[ds_id] = ds

        # add data source db
        ds_db = ds.get(CfgDataSource.db_detail.key)
        if ds_db:
            dic_ds_db[ds_id] = ds_db

        # add data source csv
        ds_csv = ds.get(CfgDataSource.csv_detail.key)
        if ds_csv:
            dic_ds_csv[ds_id] = ds_csv
            dic_csv_col[ds_id] = ds_csv[CfgDataSourceCSV.csv_columns.key]

    return dic_ds, dic_ds_db, dic_ds_csv, dic_csv_col


def import_config_db(zip_file):
    data_source_tables = [CfgDataSource, CfgDataSourceDB, CfgDataSourceCSV, CfgCsvColumn]
    process_tables = [CfgProcess, CfgProcessColumn, CfgFilter, CfgFilterDetail, CfgTrace, CfgTraceKey, CfgVisualization]

    # clear db first
    clear_config_db(reversed(process_tables))
    clear_config_db(reversed(data_source_tables))

    config_db = extract_one_file(zip_file, f'{CONFIG_DB_NAME}.pickle')
    config_db = pickle.loads(config_db)
    # insert data source
    data_source_data = get_data_source_info(config_db)
    for ds_table, dic_data in zip(data_source_tables, data_source_data):
        for values in dic_data.values():
            insert_data_to_table(ds_table, values)

    # insert process
    insert_data_to_table(CfgProcess, config_db)
    for cfg_process in config_db:
        cfg_columns = cfg_process[CfgProcess.columns.key]
        for col in cfg_columns:
            col[CfgProcessColumn.process_id.key] = cfg_process[CfgProcess.id.key]

        cfg_filters = cfg_process[CfgProcess.filters.key]
        cfg_traces = cfg_process[CfgProcess.traces.key]
        cfg_visuals = cfg_process[CfgProcess.visualizations.key]

        # columns
        insert_data_to_table(CfgProcessColumn, cfg_columns)

        # filter & detail
        insert_data_to_table(CfgFilter, cfg_filters)
        for cfg_filter in cfg_filters:
            insert_data_to_table(CfgFilterDetail, cfg_filter[CfgFilter.filter_details.key])
        # trace & trace key
        insert_data_to_table(CfgTrace, cfg_traces)
        for cfg_trace in cfg_traces:
            insert_data_to_table(CfgTraceKey, cfg_trace[CfgTrace.trace_keys.key])
        # visualize
        insert_data_to_table(CfgVisualization, cfg_visuals)

    return config_db


def clear_config_db(models):
    with make_session() as meta_session:
        for model in models:
            meta_session.query(model).delete()

    return True


def insert_data_to_table(model, records):
    if not records:
        return False

    # insert data
    with make_session() as meta_session:
        meta_session.execute(model.__table__.insert(), records)

    return True


def extract_zip(zip_file):
    input_zip = ZipFile(zip_file)
    return {Path(name).stem: input_zip.read(name) for name in input_zip.namelist()}


def extract_one_file(zip_file, file_name):
    input_zip = ZipFile(zip_file)
    return input_zip.read(file_name)


def get_zip_full_path(filename):
    if not filename:
        return None

    return os.path.join(get_export_path(), get_basename(filename))
