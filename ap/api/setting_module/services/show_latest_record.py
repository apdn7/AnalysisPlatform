from __future__ import annotations

import json
import os
import re
from contextlib import suppress
from itertools import chain
from typing import Any

import numpy as np
import pandas as pd
from loguru import logger

from ap.api.common.services.file_reader import StructuredFileReader
from ap.api.efa.services.etl import df_transform
from ap.api.setting_module.services.archive_handler import cleanup_temp_files, expand_archive_sources_to_temp_files
from ap.api.setting_module.services.csv_import import (
    convert_csv_timezone,
    gen_dummy_header,
)
from ap.api.setting_module.services.data_import import (
    NA_VALUES,
    PANDAS_DEFAULT_NA,
    validate_data,
    validate_datetime,
)
from ap.api.setting_module.services.equations import get_all_normal_columns_for_functions
from ap.api.setting_module.services.master_data_transform_pattern import ColumnRawNameRule
from ap.api.setting_module.services.software_workshop_etl_services import (
    POSTGRES_SOFTWARE_WORKSHOP_DEF,
)
from ap.api.setting_module.services.v2_etl_services import (
    get_df_v2_process_single_file,
    get_preview_processes_v2,
    get_v2_datasource_type_from_file,
    get_vertical_df_v2_process_single_file,
    is_v2_data_source,
    rename_abnormal_history_col_names,
    rename_sub_part_no,
)
from ap.api.setting_module.services.web_api import WebAPI
from ap.common.common_utils import (
    WebAuthenticationType,
    convert_eu_decimal_series,
    convert_numeric_by_type,
    get_csv_delimiter,
    is_ja_locale,
)
from ap.common.constants import (
    ARCHIVE_MAX_FILES_DEFAULT,
    COL_DATA_TYPE,
    DATA_TYPE_ESTIMATION_LIMIT,
    DATE_FORMAT_SIMPLE,
    DATETIME_DUMMY,
    EMPTY_STRING,
    FILE_NAME,
    FORMULA,
    HALF_WIDTH_SPACE,
    IS_JUDGE,
    JUDGE_AVAILABLE,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    RE_ID_PATTERN,
    RE_SERIAL_PATTERN,
    REVERSED_WELL_KNOWN_COLUMNS,
    SOFTWARE_WORKSHOP_SHOW_MISSING_COLUMNS_ON_PREVIEW,
    SUB_PART_NO_DEFAULT_SUFFIX,
    SUB_PART_NO_PREFIX,
    SUB_PART_NO_SUFFIX,
    UNDER_SCORE,
    V2_PREVIEW_LIMIT,
    CSVExtTypes,
    DataColumnType,
    DataGroupType,
    DataType,
    DBType,
    DefinedLabel,
    MasterDBType,
    ProcessColumnConst,
)
from ap.common.log import log_execution_time
from ap.common.memoize import CustomCache
from ap.common.path_utils import (
    check_exist,
    filter_files_by_select_condition,
    get_preview_data_file_folder,
    get_sorted_files,
    get_sorted_files_by_size,
    make_dir_from_file_path,
)
from ap.common.pydn.dblib import mssqlserver, oracle
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.common.services.csv_content import (
    get_delimiter_encoding,
)
from ap.common.services.csv_header_wrapr import (
    convert_wellknown_col_name,
    gen_colsname_for_duplicated,
)
from ap.common.services.data_type import gen_data_types
from ap.common.services.http_content import orjson_dumps
from ap.common.services.jp_to_romaji_utils import change_duplicated_columns, to_romaji, to_romaji_en
from ap.common.services.normalization import (
    ColumnRenamer,
    normalize_big_rows,
    normalize_list,
    normalize_str,
    unicode_normalize,
)
from ap.common.timezone_utils import gen_dummy_datetime, gen_dummy_datetime_data
from ap.conversion_formula import JudgeFormula
from ap.conversion_formula.judge import JUDGE_NAME_REGEX
from ap.equations.utils import get_function_class_by_id
from ap.etl.transform import TransformData
from ap.etl.transform.pipeline import (
    software_workshop_postgres_history_transform_pipeline,
    software_workshop_postgres_measurement_transform_pipeline,
    software_workshop_snowflake_history_transform_pipeline,
    software_workshop_snowflake_measurement_transform_pipeline,
)
from ap.import_filter.utils import get_import_filter_for_preview, get_preview_df_with_filter
from ap.setting_module.models import (
    CfgDataSource,
    CfgProcess,
    CfgProcessColumn,
    MUnit,
    make_session,
)
from ap.setting_module.schemas import VisualizationSchema
from ap.setting_module.services.process_config import get_process_columns
from ap.trace_data.transaction_model import TransactionData


def get_latest_records(
    data_source_id,
    table_name,
    file_name=None,
    directory=None,
    limit=5,
    current_process_id: int | None = None,
    is_v2_datasource=False,
    filtered_process_name=None,
    process_factid=None,
    master_type: MasterDBType = None,
    etl_func: str = '',
    import_filter=None,
    api_url: str | None = None,
    ja_locale: bool | None = None,
):
    previewed_files = None
    cols_with_types = []
    delimiter = 'Auto'
    skip_head = None
    n_rows = None
    is_transpose = None
    has_ct_col = True
    dummy_datetime_idx = None
    file_name_col_idx = None
    is_file_checker = False
    data_source: CfgDataSource | None = None
    file_name_include = None
    file_name_exclude = None
    subfolder_include = None
    subfolder_exclude = None

    if ja_locale is None:
        ja_locale = is_ja_locale()

    if data_source_id:
        data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
        if not api_url and data_source.web_detail:
            api_url = data_source.web_detail.url
        if not data_source:
            return None
        is_v2_datasource = is_v2_data_source(ds_type=data_source.type)
        is_csv_or_v2 = data_source.type.lower() in [DBType.CSV.name.lower(), DBType.V2.name.lower()]
        if is_csv_or_v2:
            csv_detail = data_source.csv_detail
            if not filtered_process_name:
                filtered_process_name = csv_detail.process_name or False
            directory = csv_detail.directory
            if not file_name:
                file_name = csv_detail.directory if csv_detail.is_file_path else None
            delimiter = csv_detail.delimiter
            etl_func = csv_detail.etl_func
            skip_head = csv_detail.skip_head
            n_rows = csv_detail.n_rows
            is_transpose = csv_detail.is_transpose
            is_file_checker = csv_detail.is_file_checker
            # File Select Condition (file name / subfolder include-exclude), same as the
            # actual import job and the data-source preview. Without this, sample-data
            # detection here (used e.g. for Process Config column/datetime detection)
            # could pick a file that the configured filter was meant to exclude.
            file_name_include = csv_detail.file_name_include
            file_name_exclude = csv_detail.file_name_exclude
            subfolder_include = csv_detail.subfolder_include
            subfolder_exclude = csv_detail.subfolder_exclude
    else:
        is_csv_or_v2 = True

    if is_csv_or_v2:
        if is_v2_datasource:
            dic_preview = preview_v2_data(
                directory,
                delimiter,
                limit,
                return_df=True,
                process_name=filtered_process_name,
                file_name=file_name,
                show_file_name_column=True,
            )
        else:
            dic_preview = preview_csv_data(
                directory,
                etl_func,
                delimiter,
                limit,
                return_df=True,
                max_records=DATA_TYPE_ESTIMATION_LIMIT,
                file_name=file_name,
                skip_head=skip_head,
                n_rows=n_rows,
                is_transpose=is_transpose,
                show_file_name_column=True,
                current_process_id=current_process_id,
                is_file_checker=is_file_checker,
                encoding=(data_source.csv_detail.encoding if data_source else None),
                file_name_include=file_name_include,
                file_name_exclude=file_name_exclude,
                subfolder_include=subfolder_include,
                subfolder_exclude=subfolder_exclude,
            )
        column_raw_names = dic_preview.get('org_headers')
        headers = normalize_list(dic_preview.get('header'))
        headers = [normalize_str(col) for col in headers]
        data_types = dic_preview.get('dataType')
        has_ct_col = dic_preview.get('has_ct_col')
        dummy_datetime_idx = dic_preview.get('dummy_datetime_idx')
        file_name_col_idx = dic_preview.get('file_name_col_idx')
        same_values = dic_preview.get('same_values')
        is_v2_history = dic_preview.get('v2_type') == DBType.V2_HISTORY.value
        is_gen_cols = dic_preview.get('is_gen_cols')
        if headers and data_types:
            cols_with_types = gen_cols_with_types(
                headers,
                data_types,
                same_values,
                is_v2_history,
                column_raw_names,
                dummy_datetime_idx=dummy_datetime_idx,
                file_name_idx=file_name_col_idx,
                is_gen_cols=is_gen_cols,
                import_filter=import_filter,
                master_type=master_type,
                ja_locale=ja_locale,
            )

        # sort columns
        # sorted(csv_detail.csv_columns, key=lambda c: c.order or c.id)
        # cols = {col.column_name for col in sorted_columns if col.column_name in headers}
        cols = headers

        # get rows
        df_rows = dic_preview.get('content', None)
        previewed_files = dic_preview.get('previewed_files')
    elif api_url:
        authentication_type: WebAuthenticationType = WebAuthenticationType[data_source.web_detail.authentication_type]
        web_api = WebAPI(
            api_url,
            username=data_source.web_detail.username,
            encrypted_password=data_source.web_detail.password,
            authentication_type=authentication_type,
        )
        api_data = web_api.get_data(limit=DATA_TYPE_ESTIMATION_LIMIT)
        cols, df_rows, dict_column_name_and_unit = api_data.cols, api_data.df_rows, api_data.dict_column_name_and_unit
        data_types = [gen_data_types(df_rows[col]) for col in cols]
        same_values = check_same_values_in_df(df_rows, cols)
        if cols and data_types:
            cols_with_types = gen_cols_with_types(
                normalize_list(cols),
                data_types,
                same_values,
                column_raw_name=cols,
                dict_column_name_and_unit=dict_column_name_and_unit,
                ja_locale=ja_locale,
            )
    else:
        if current_process_id is not None:
            proc_cfg: CfgProcess = CfgProcess.get_proc_by_id(int(current_process_id))
            process_factid = process_factid or proc_cfg.process_factid
            master_type = master_type or proc_cfg.master_type
        cols, df_rows, dict_column_name_and_unit = get_info_from_db(
            data_source,
            table_name,
            process_factid=process_factid,
            master_type=master_type,
            sql_limit=DATA_TYPE_ESTIMATION_LIMIT,
        )
        if etl_func:
            df_rows = df_transform(df_rows, etl_func)
            cols = list(df_rows.columns)
        data_types = [gen_data_types(df_rows[col]) for col in cols]
        same_values = check_same_values_in_df(df_rows, cols)
        if cols and data_types:
            cols_with_types = gen_cols_with_types(
                normalize_list(cols),
                data_types,
                same_values,
                column_raw_name=cols,
                dict_column_name_and_unit=dict_column_name_and_unit,
                import_filter=import_filter,
                master_type=master_type,
                ja_locale=ja_locale,
            )

    # change name if romaji cols is duplicated
    cols_with_types, cols_duplicated = change_duplicated_columns(cols_with_types)
    if is_csv_or_v2 and DataType.DATETIME.value not in data_types:
        dummy_datetime_idx = 0
        cols_with_types.insert(
            dummy_datetime_idx,
            {
                'column_name': DATETIME_DUMMY,
                'data_type': DataType.DATETIME.name,
                'romaji': DATETIME_DUMMY,
                'is_date': True,
                'check_same_value': {'is_null': False, 'is_same': False},
                'is_checked': True,
                'is_show': True,
                'is_dummy_datetime': True,
            },
        )
        cols.insert(dummy_datetime_idx, DATETIME_DUMMY)
        if is_valid_list(df_rows):
            df_rows = gen_dummy_datetime(df_rows)

    # filter preview data
    filters = get_import_filter_for_preview(filter_dict=import_filter or {})
    df_rows = get_preview_df_with_filter(df_rows, filters)

    # if DATETIME_DUMMY in cols or DataType.DATETIME.value not in data_types:
    #     dummy_datetime_idx = 0
    #     has_ct_col = False

    labels = [DefinedLabel.get_by_dbtype(DBType[data_source.type])] if data_source else []
    rows = []
    unique_rows_as_category = []
    unique_rows_as_real = []
    unique_rows_as_int = []
    unique_rows_as_int_cat = []
    df_unique_as_category = pd.DataFrame()
    df_unique_as_real = pd.DataFrame()
    df_unique_as_int = pd.DataFrame()
    df_unique_as_int_cat = pd.DataFrame()
    col_names = [col['column_name'] for col in cols_with_types]
    # TODO: How do we make sure col_names and df_rows.columns are in correct order?
    df_rows.columns = col_names
    df_unique_sample_processing = df_rows.copy()
    if is_valid_list(df_rows):
        for index, col in enumerate(df_rows.columns):
            judge_formula = JudgeFormula.detect(df_rows[col])
            cols_with_types[index][IS_JUDGE] = False
            if judge_formula is not None:
                cols_with_types[index][JUDGE_AVAILABLE] = True
                cols_with_types[index][FORMULA] = judge_formula.get_formula()
            else:
                cols_with_types[index][JUDGE_AVAILABLE] = False

        # check is judge
        for index, col in enumerate(df_rows.columns):
            # check name includes Judge or 判定
            # the detected datatype should also be TEXT
            if (
                JUDGE_NAME_REGEX.search(col)
                and cols_with_types[index][JUDGE_AVAILABLE]
                and cols_with_types[index][COL_DATA_TYPE] == DataType.TEXT.name
            ):
                cols_with_types[index][IS_JUDGE] = True
                # force assign boolean datatype to column detected as judge (#676)
                # TODO: should be actually use raw_data_type here? (it was never available in this flow)
                cols_with_types[index][COL_DATA_TYPE] = DataType.BOOLEAN.name
                break

        data_type_by_cols = {}
        for col_data in cols_with_types:
            data_type_by_cols[col_data['column_name']] = col_data['data_type']
        # convert to correct dtypes
        for col in df_rows.columns:
            try:
                if data_type_by_cols[col] in [
                    DataType.INTEGER_SEP.name,
                    DataType.EU_INTEGER_SEP.name,
                    DataType.REAL_SEP.name,
                    DataType.EU_REAL_SEP.name,
                ]:
                    df_unique_sample_processing[col] = convert_eu_decimal_series(
                        df_unique_sample_processing[col],
                        data_type_by_cols[col],
                    )
                df_unique_as_category[col] = parse_unique_as_category(df_unique_sample_processing[col])
                df_unique_as_real[col] = parse_unique_as_real(
                    df_unique_sample_processing[col],
                )
                df_unique_as_int[col] = parse_unique_as_int(
                    df_unique_sample_processing[col],
                )
                df_unique_as_int_cat[col] = parse_unique_as_int_cat(
                    df_unique_sample_processing[col],
                )
                if data_type_by_cols[col] == DataType.INTEGER.name:
                    # TODO: this line always emit errors if our data has empty string!!!!
                    # See: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/138
                    df_rows[col] = df_rows[col].astype('float64').astype('Int64')

                if data_type_by_cols[col] == DataType.TEXT.name:
                    df_rows[col] = df_rows[col].astype(pd.StringDtype())
                    # if original data is boolean, it should be convert to lower string
                    # same as text from sql (true/false), instead of python bool type (True/False)
                    if pd.api.types.is_bool_dtype(df_rows[col]):
                        df_rows[col] = df_rows[col].str.lower()
                    # fill na to '' for string column
                    df_rows[col] = df_rows[col].fillna('')
            except Exception as e:
                logger.exception(e)
                continue

        df_rows[df_rows.select_dtypes(include=['datetime64[ns]']).columns] = df_rows.select_dtypes(
            include=['datetime64[ns]']
        ).astype('string')

        rows = transform_df_to_rows(col_names, df_rows, limit)
        if is_csv_or_v2 and directory and (file_name_col_idx is not None):
            file_name_candidates = get_sorted_files(directory)
            file_name_candidates = filter_files_by_select_condition(
                file_name_candidates,
                directory,
                file_name_include=file_name_include,
                file_name_exclude=file_name_exclude,
                subfolder_include=subfolder_include,
                subfolder_exclude=subfolder_exclude,
            )
            file_name_data = pd.Series([os.path.basename(path) for path in file_name_candidates])
            file_name_col_name = col_names[file_name_col_idx]
            df_unique_as_category[file_name_col_name] = parse_unique_as_category(file_name_data)
            df_unique_as_real[file_name_col_name] = parse_unique_as_real(file_name_data)
            df_unique_as_int[file_name_col_name] = parse_unique_as_int(file_name_data)
            df_unique_as_int_cat[file_name_col_name] = parse_unique_as_int_cat(file_name_data)
        unique_rows_as_category = transform_df_to_rows(col_names, df_unique_as_category, 10)
        unique_rows_as_real = transform_df_to_rows(col_names, df_unique_as_real, 10)
        unique_rows_as_int = transform_df_to_rows(col_names, df_unique_as_int, 10)
        unique_rows_as_int_cat = transform_df_to_rows(col_names, df_unique_as_int_cat, 10)
    is_rdb = not is_csv_or_v2
    return (
        cols_with_types,
        rows,
        cols_duplicated,
        previewed_files,
        has_ct_col,
        dummy_datetime_idx,
        is_rdb,
        file_name_col_idx,
        unique_rows_as_category,
        unique_rows_as_real,
        unique_rows_as_int,
        unique_rows_as_int_cat,
        labels,
    )


def get_sample_from_preview_data(preview_data, columns: list[CfgProcessColumn]):
    link_cols = {col.column_name: str(col.id) for col in columns}
    # make dic use cols for validate and parse sensor value by selected type
    dic_use_cols = {col.column_name: col for col in columns}
    # bind data from preview_data
    df = pd.DataFrame(data=preview_data['rows'])
    # we don't need to pass na values, because the data from `preview_data` is json
    df = validate_data(df, dic_use_cols)
    df = df[list(link_cols.keys())]
    # use column id to get easier from frontend
    df = df.rename(columns=link_cols)
    return df


def get_latest_record_from_preview_file(fp, proc_id, limit=10, import_filter=None):
    dict_data = json.load(fp)
    # If dict_data is a string (JSON string), parse it again
    if isinstance(dict_data, str):
        dict_data = json.loads(dict_data)
    proc_col = get_process_columns(proc_id, show_graph=False)
    cols_org = dict_data.get('cols', [])
    rows_org = dict_data.get('rows', [])

    # check import filter condition
    filtered_cols = {(col['column_raw_name'], col['filter']) for col in cols_org if col.get('filter') is not None}
    import_filter_config = {tuple(import_filter.items())} if import_filter else set()
    new_filter = list(import_filter_config - filtered_cols)

    if new_filter:
        # return None to preview again
        return None

    if not cols_org and not rows_org:
        return dict_data

    df_data = pd.DataFrame(rows_org)
    column_name = [col['column_name'] for col in cols_org]
    data_types = [DataType[col['data_type']].value for col in cols_org]
    dupl_cols = []
    _, df_data_details, org_headers, *_ = add_generated_datetime_column(
        proc_id,
        df_data,
        column_name.copy(),
        column_name.copy(),
        dupl_cols,
        data_types,
    )
    new_cols_name = list(set(org_headers) - set(column_name))
    if new_cols_name:
        col_add = next((col for col in reversed(proc_col) if col.get('column_name') in new_cols_name), None)
        dict_data['cols'].append(col_add)
    dict_data['rows'] = transform_df_to_rows(org_headers, df_data_details, limit)
    return dict_data


# def get_col_type_as_cast(col_type):
#     if col_type == DataType.TEXT.name:
#         return 'str'
#
#     if col_type == DataType.REAL.name:
#         return 'float64'
#
#     if col_type == DataType.INTEGER.name:
#         return 'int64'
#
#     return None


# def gen_data_types_from_factory_type(cols, cols_with_types):
#     dic_col_type = {col.get('name'): guess_data_types(col.get('type')) for col in cols_with_types}
#     return [dic_col_type.get(col) for col in cols]


def get_info_from_db(
    data_source: CfgDataSource,
    table_name: str,
    process_factid: str | None = None,
    sql_limit: int = 2000,
    master_type: MasterDBType = None,
    sort_column: str | None = None,
    sort_order: str = 'ASC',
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    if data_source.type in [
        DBType.POSTGRES_SOFTWARE_WORKSHOP.name,
        DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name,
    ]:
        return get_info_from_db_software_workshop(
            data_source.id,
            process_factid,
            # Previously sql_limit was not forwarded, so Software Workshop
            # always used its default limit of 2000.
            sql_limit=sql_limit,
            master_type=master_type,
            sort_column=sort_column,
            sort_order=sort_order,
        )

    return get_info_from_db_normal(data_source.id, table_name, sql_limit)


@CustomCache.memoize(duration=300)
def get_info_from_db_normal(
    data_source_id: int,
    table_name: str,
    sql_limit: int = 2000,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
    with ReadOnlyDbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], pd.DataFrame(), {}

        if isinstance(db_instance, mssqlserver.MSSQLServer):
            # Cast non-Unicode char/varchar/text columns to NVARCHAR so the
            # pymssql client returns Unicode instead of code-page bytes, which
            # otherwise arrive as mojibake for non-ASCII (e.g. CP932) data.
            mssql_select_columns = db_instance.gen_preview_select_columns(table_name)
            cols, rows = db_instance.run_sql(
                f'select TOP {sql_limit} {mssql_select_columns} from "{table_name}"',
                False,
            )
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                f'select * from "{table_name}" where rownum <= {sql_limit}',
                False,
            )
        else:
            cols, rows = db_instance.run_sql(f'select * from "{table_name}" limit {sql_limit}', False)

    df_rows = normalize_big_rows(rows, cols, strip_quote=False)
    return cols, df_rows, {}


@log_execution_time()
# @CustomCache.memoize(duration=300)
def get_info_from_db_software_workshop(
    data_source_id: int,
    child_equip_id: str,
    sql_limit: int = 2000,
    master_type: MasterDBType = MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT,
    sort_column: str | None = None,
    sort_order: str = 'ASC',
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
    software_workshop_def = data_source.software_workshop_def()

    with ReadOnlyDbProxy(data_source) as db_instance:
        if not db_instance or not child_equip_id:
            return [], pd.DataFrame(), {}
        sql = software_workshop_def.get_transaction_data_query(
            child_equip_id,
            limit=sql_limit,
            master_type=master_type,
            # Push sorting down to the database so LIMIT is applied
            # after ORDER BY, not before it.
            sort_column=sort_column,
            sort_order=sort_order,
        )
        if data_source.type == DBType.POSTGRES_SOFTWARE_WORKSHOP.name:
            db_instance.execute_sql_no_commit('SET LOCAL enable_seqscan = off;')
        cols, rows = db_instance.run_sql(sql, row_is_dict=False)

    df = pd.DataFrame(rows, columns=cols)
    if not df.empty:
        if software_workshop_def.snowflake:
            if master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT:
                pipeline = software_workshop_snowflake_measurement_transform_pipeline(
                    data_source_id=data_source_id,
                    process_factid=child_equip_id,
                    add_missing_columns=SOFTWARE_WORKSHOP_SHOW_MISSING_COLUMNS_ON_PREVIEW,
                )
            elif master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY:
                pipeline = software_workshop_snowflake_history_transform_pipeline(
                    data_source_id=data_source_id, process_factid=child_equip_id
                )
            else:
                raise NotImplementedError(f'Cannot handle master type {master_type} for snowflake data source')
        elif master_type == MasterDBType.SOFTWARE_WORKSHOP_MEASUREMENT:
            pipeline = software_workshop_postgres_measurement_transform_pipeline(
                data_source_id=data_source_id,
                process_factid=child_equip_id,
                add_missing_columns=SOFTWARE_WORKSHOP_SHOW_MISSING_COLUMNS_ON_PREVIEW,
            )
        elif master_type == MasterDBType.SOFTWARE_WORKSHOP_HISTORY:
            pipeline = software_workshop_postgres_history_transform_pipeline()
        else:
            raise NotImplementedError(f'Cannot handle master type {master_type} for postgres data source')

        transformed_data = pipeline.run(TransformData(df=df))
        transform_cols = transformed_data.df.columns.to_list()
        transform_rows = transformed_data.df.to_numpy().tolist()
        df_rows = normalize_big_rows(transform_rows, transform_cols, strip_quote=False)
        return transform_cols, df_rows, transformed_data.name_unit_mapping

    return cols, df, {}


@log_execution_time()
def get_last_distinct_sensor_values(cfg_col_id: int) -> list[Any]:
    cfg_col: CfgProcessColumn = CfgProcessColumn.query.get(cfg_col_id)
    trans_data = TransactionData(cfg_col.process_id)
    if len(cfg_col.function_details):
        return get_function_column_unique_values(cfg_col, trans_data)

    col_name = cfg_col.bridge_column_name
    with TxnDataConnection(process_id=cfg_col.process_id, readonly_transaction=True) as data_con:
        unique_sensor_vals = trans_data.select_distinct_data(data_con, col_name)

    return unique_sensor_vals


def save_master_vis_config(proc_id, cfg_jsons) -> CfgProcess | None:
    vis_schema = VisualizationSchema()

    with make_session() as meta_session:
        proc: CfgProcess = meta_session.query(CfgProcess).get(proc_id or -1)
        if proc:
            proc.visualizations = []
            for cfg_json in cfg_jsons:
                proc.visualizations.append(meta_session.merge(vis_schema.load(cfg_json)))
            proc = meta_session.merge(proc)

            return proc

    return None


def get_result(file_reader, is_file_checker=False):
    """Generate metadata of file with dummy header processing"""
    return (
        *gen_dummy_header(
            file_reader.headers,
            file_reader.data,
            file_reader.skip_head,
        ),
        file_reader.encoding,
        file_reader.skip_tail,
        file_reader.skip_head,
        is_file_checker,
    )


@log_execution_time()
def get_csv_data_from_files(
    sorted_files,
    skip_head: int | None,
    n_rows: int | None,
    is_transpose: bool,
    etl_func,
    csv_delimiter,
    max_records=5,
    is_file_checker=False,
    encoding=None,
):
    file_reader = StructuredFileReader(
        filenames=sorted_files,
        delimiter=csv_delimiter,
        encoding=encoding,
        skip_head=skip_head,
        is_transpose=is_transpose,
        max_results=max_records,
        limit=(n_rows or DATA_TYPE_ESTIMATION_LIMIT),
        etl_func=etl_func,
        is_file_checker=is_file_checker,
    )
    header, data = file_reader.read()
    if not header and not data:
        raise ValueError('Cannot get headers_name and data_details')

    preview_data = get_result(file_reader, is_file_checker=file_reader.is_file_checker)
    return (*preview_data,)


def clean_na_columns(col_data):
    """Clean NA values in df for preview in table"""
    na_values_lowers = [str(val).lower() for val in NA_VALUES]
    if pd.api.types.is_string_dtype(col_data):
        mask = col_data.astype(str).str.lower().isin(na_values_lowers)
        return col_data.where(~mask, '')
    return col_data


def _prioritize_preview_files_with_data(sorted_files: list[str], temp_file_set: set[str]) -> list[str]:
    if not temp_file_set:
        return sorted_files

    temp_files = [file_path for file_path in sorted_files if file_path in temp_file_set]
    other_files = [file_path for file_path in sorted_files if file_path not in temp_file_set]
    temp_files = sorted(temp_files, key=lambda file_path: os.path.getsize(file_path), reverse=True)
    return temp_files + other_files


@log_execution_time()
def preview_csv_data(
    folder_url,
    etl_func,
    csv_delimiter,
    limit,
    return_df=False,
    max_records=5,
    file_name=None,
    skip_head=None,
    n_rows: int | None = None,
    is_transpose: bool = False,
    show_file_name_column=False,
    current_process_id=None,
    is_convert_datetime=False,
    is_file_checker=False,
    is_show_raw_data=False,
    encoding=None,
    file_name_include=None,
    file_name_exclude=None,
    subfolder_include=None,
    subfolder_exclude=None,
):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    temp_files: list[str] = []

    try:
        if not file_name:
            sorted_files = get_sorted_files(folder_url)
            # apply File Select Condition (file name / subfolder include-exclude), same as
            # the actual import job. Not applied when `file_name` is set (a specific file
            # was chosen directly), matching the "disabled in that mode" behavior in the UI.
            sorted_files = filter_files_by_select_condition(
                sorted_files,
                folder_url,
                file_name_include=file_name_include,
                file_name_exclude=file_name_exclude,
                subfolder_include=subfolder_include,
                subfolder_exclude=subfolder_exclude,
            )
            sorted_files = sorted_files[0:5]
        else:
            sorted_files = [file_name]

        previewed_files = sorted_files.copy()
        sorted_files, temp_files = expand_archive_sources_to_temp_files(
            source_files=sorted_files,
            target_extensions={CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value},
            max_files=ARCHIVE_MAX_FILES_DEFAULT,
            include_non_archive_sources=True,
            return_metadata=False,
        )
        temp_file_set = set(temp_files)
        sorted_files = _prioritize_preview_files_with_data(sorted_files, temp_file_set)

        csv_file = ''
        header_names = []
        data_types = []
        data_details = []
        same_values = []
        if not sorted_files:
            return {
                'directory': folder_url,
                'file_name': csv_file,
                'header': header_names,
                'content': [] if return_df else data_details,
                'dataType': data_types,
                'skip_head': skip_head,
                'n_rows': n_rows,
                'is_transpose': is_transpose,
                'skip_tail': 0,
                'previewed_files': previewed_files,
                'same_values': same_values,
                # explicit True so the caller doesn't mistake "no files matched" (this
                # dict has no 'has_ct_col' key otherwise) for "no datetime column found,
                # please confirm a dummy datetime" — the caller must check
                # `previewed_files` emptiness first and show a "no files found" error.
                'has_ct_col': True,
            }

        csv_file = sorted_files[0]
        display_file = previewed_files[0] if csv_file in temp_file_set and previewed_files else csv_file
        preview_file_groups = [sorted_files]
        if temp_file_set and len(sorted_files) > 1:
            preview_file_groups.extend([file_path] for file_path in sorted_files)

        org_header = []
        dummy_header = False
        partial_dummy_header = False
        skip_tail = 0
        skip_head_detected = None
        is_gen_cols = []
        for preview_file_group in preview_file_groups:
            try:
                (
                    org_header,
                    header_names,
                    dummy_header,
                    partial_dummy_header,
                    data_details,
                    is_gen_cols,
                    encoding,
                    skip_tail,
                    skip_head_detected,
                    is_file_checker,
                ) = get_csv_data_from_files(
                    preview_file_group,
                    skip_head=skip_head,
                    n_rows=n_rows,
                    is_transpose=is_transpose,
                    etl_func=etl_func,
                    csv_delimiter=csv_delimiter,
                    max_records=max_records,
                    is_file_checker=is_file_checker,
                    encoding=encoding,
                )
            except Exception:
                logger.exception('Failed to read CSV preview files: {}', preview_file_group)
                continue

            if data_details:
                csv_file = preview_file_group[0]
                break

        # normalize data detail
        df_data_details, org_headers, header_names, dupl_cols, data_types = extract_data_detail(
            header_names,
            data_details,
            org_header,
            is_show_raw_data=is_show_raw_data,
        )
        has_ct_col = True
        dummy_datetime_idx = None
        file_name_col_idx = None
        if df_data_details is not None:
            # sort by datetime
            first_datetime_col_idx = None
            # convert utc
            for col, dtype in zip(header_names, data_types, strict=False):
                if DataType(dtype) in [DataType.DATETIME, DataType.DATE, DataType.TIME]:
                    df_data_details[col] = df_data_details[col].astype(pd.StringDtype())

                if DataType(dtype) is not DataType.DATETIME:
                    continue
                # Convert UTC time
                df_data_details = validate_datetime(
                    df_data_details,
                    col,
                    is_strip=False,
                    add_is_error_col=False,
                    is_convert_datetime=is_convert_datetime,
                )
                # When show sample data on Process Config, it will show raw data of datetime value.
                if is_convert_datetime:
                    df_data_details = convert_csv_timezone(df_data_details, col)
                else:
                    df_data_details[col] = df_data_details[col].astype(pd.StringDtype())
                df_data_details = df_data_details.dropna(subset=[col])

                # if not first_datetime_col_idx:
                #     # first ct column is selected as datetime column
                #     # append datetime to start of list columns
                #     # and sort preview rows by datetime value
                #     df_data_details = df_data_details.sort_values(col)
                #     first_datetime_col_idx = header_names.index(col)

            if DataType.DATETIME.value not in data_types:
                (
                    header_names,
                    df_data_details,
                    org_headers,
                    data_types,
                    dupl_cols,
                    dummy_datetime_idx,
                    is_gen_cols,
                ) = add_dummy_datetime_column(
                    header_names,
                    df_data_details,
                    org_headers,
                    data_types,
                    is_gen_cols=is_gen_cols,
                )
                has_ct_col = False
            elif first_datetime_col_idx:
                header_names = re_order_items_by_datetime_idx(first_datetime_col_idx, header_names)
                data_types = re_order_items_by_datetime_idx(first_datetime_col_idx, data_types)
                org_headers = re_order_items_by_datetime_idx(first_datetime_col_idx, org_headers)
                df_data_details = df_data_details[header_names]

            # add file name
            if show_file_name_column:
                (
                    header_names,
                    df_data_details,
                    org_headers,
                    data_types,
                    dupl_cols,
                    file_name_col_idx,
                    is_gen_cols,
                ) = add_show_file_name_column(
                    header_names,
                    df_data_details,
                    org_headers,
                    data_types,
                    display_file,
                    is_gen_cols,
                )

            # check to add generated datetime column
            if current_process_id is not None:
                # we check datetime column and add this datetime column into details
                (
                    header_names,
                    df_data_details,
                    org_headers,
                    data_types,
                    dupl_cols,
                    is_gen_cols,
                ) = add_generated_datetime_column(
                    current_process_id,
                    df_data_details,
                    org_headers,
                    header_names,
                    dupl_cols,
                    data_types,
                    is_gen_cols,
                )

            same_values = check_same_values_in_df(df_data_details, header_names)

            df_data_details = df_data_details.apply(clean_na_columns)
            if not return_df:
                df_data_details = df_data_details.to_records(index=False).tolist()
        elif not return_df:
            df_data_details = []

        if csv_file:
            csv_file = display_file.replace('/', os.sep)

        has_dupl_cols = False
        if len(dupl_cols) and same_values:
            if dummy_datetime_idx is not None:
                # for dummy datetime column
                dupl_cols = [False, *dupl_cols]
            for key, value in enumerate(same_values):
                is_dupl_col = bool(dupl_cols[key])
                same_values[key]['is_dupl'] = is_dupl_col
                if is_dupl_col:
                    has_dupl_cols = True

        return {
            'directory': folder_url,
            'file_name': csv_file,
            'header': header_names,
            'content': df_data_details[:max_records],
            'dataType': data_types,
            'skip_head': 0 if dummy_header and not skip_head_detected else skip_head_detected,
            'skip_tail': skip_tail,
            'n_rows': n_rows,
            'is_transpose': is_transpose,
            'previewed_files': previewed_files,
            'has_ct_col': has_ct_col,
            'dummy_datetime_idx': dummy_datetime_idx,
            'same_values': [{key: bool(value) for key, value in same_value.items()} for same_value in same_values],
            'has_dupl_cols': False if dummy_header else has_dupl_cols,
            'org_headers': header_names if dummy_header else org_headers,
            'encoding': encoding,
            'is_dummy_header': dummy_header,
            'partial_dummy_header': partial_dummy_header,
            'file_name_col_idx': file_name_col_idx,
            'is_gen_cols': is_gen_cols,
            'is_file_checker': is_file_checker,
        }
    finally:
        cleanup_temp_files(temp_files)


@log_execution_time()
def preview_v2_data(
    folder_url,
    csv_delimiter,
    limit,
    return_df=False,
    process_name=None,
    file_name=None,
    show_file_name_column=False,
    is_show_raw_data=False,
    is_convert_datetime=False,
):
    csv_delimiter = get_csv_delimiter(csv_delimiter)
    sorted_files = get_sorted_files_by_size(folder_url) if not file_name else [file_name]
    encoding = None
    csv_file = ''
    skip_head = None
    skip_tail = 0
    header_names = []
    data_types = []
    data_details = []
    same_values = []
    v2_process_names = []
    if not sorted_files:
        return {
            'file_name': csv_file,
            'header': header_names,
            'content': [] if return_df else data_details,
            'dataType': data_types,
            'skip_head': skip_head,
            'skip_tail': skip_tail,
            'previewed_files': sorted_files,
            'same_values': same_values,
            'encoding': encoding,
        }

    previewed_files = sorted_files.copy()
    temp_files: list[str] = []
    try:
        sorted_files, temp_files = expand_archive_sources_to_temp_files(
            source_files=sorted_files,
            target_extensions={CSVExtTypes.CSV.value, CSVExtTypes.TSV.value, CSVExtTypes.SSV.value},
            max_files=ARCHIVE_MAX_FILES_DEFAULT,
            include_non_archive_sources=True,
            return_metadata=False,
        )
        temp_file_set = set(temp_files)
        sorted_files = _prioritize_preview_files_with_data(sorted_files, temp_file_set)

        if not sorted_files:
            return {
                'file_name': csv_file,
                'header': header_names,
                'content': [] if return_df else data_details,
                'dataType': data_types,
                'skip_head': skip_head,
                'skip_tail': skip_tail,
                'previewed_files': previewed_files,
                'same_values': same_values,
                'encoding': encoding,
            }

        is_abnormal_v2 = None
        datasource_type = None
        if process_name:
            # V2 preview with the largest file
            file_data_idx = 0
            while file_data_idx < len(sorted_files):
                largest_file = sorted_files[file_data_idx]
                try:
                    _, encoding = get_delimiter_encoding(largest_file, preview=True)
                    datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(largest_file)

                    if datasource_type == DBType.V2_HISTORY:
                        data_details = get_df_v2_process_single_file(
                            largest_file,
                            process_name,
                            datasource_type,
                            is_abnormal_v2,
                        )
                    elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
                        data_details = get_vertical_df_v2_process_single_file(
                            largest_file,
                            process_name,
                            datasource_type,
                            is_abnormal_v2,
                            is_en_cols,
                        )
                    else:
                        file_data_idx += 1
                        continue
                except Exception:
                    logger.exception('Failed to preview V2 data file: {}', largest_file)
                    file_data_idx += 1
                    continue

                if largest_file in temp_file_set and previewed_files:
                    csv_file = os.path.basename(previewed_files[0])
                else:
                    csv_file = os.path.basename(largest_file)
                if len(data_details) > 0:
                    break
                file_data_idx += 1

            if isinstance(data_details, pd.DataFrame):
                data_details = data_details[:1000]
                header_names = data_details.columns.tolist()

        if not len(header_names):
            v2_process_names = get_preview_processes_v2(
                sorted_files,
                maximum_files=MAXIMUM_V2_PREVIEW_ZIP_FILES,
            )

            for candidate_file in sorted_files:
                csv_file = candidate_file
                try:
                    candidate_datasource_type, candidate_is_abnormal_v2, candidate_is_en_cols = (
                        get_v2_datasource_type_from_file(csv_file)
                    )
                    if candidate_datasource_type not in [DBType.V2, DBType.V2_MULTI, DBType.V2_HISTORY]:
                        continue

                    datasource_type = candidate_datasource_type
                    is_abnormal_v2 = candidate_is_abnormal_v2
                    is_en_cols = candidate_is_en_cols
                    file_reader = StructuredFileReader(
                        filenames=[csv_file],
                        delimiter=csv_delimiter,
                        max_results=V2_PREVIEW_LIMIT,
                    )
                    header_names, data_details = file_reader.read(target_file=csv_file)
                    encoding = file_reader.encoding
                except Exception:
                    logger.exception('Failed to read V2 preview file: {}', candidate_file)
                    header_names = []
                    data_details = []
                    continue
                if data_details:
                    break

        if not header_names:
            return {
                'file_name': csv_file,
                'v2_processes': v2_process_names,
                'header': header_names,
                'content': [] if return_df else data_details,
                'dataType': data_types,
                'skip_head': skip_head,
                'skip_tail': skip_tail,
                'previewed_files': previewed_files,
                'same_values': same_values,
                'encoding': encoding,
                'is_process_null': not v2_process_names,
            }

        org_headers = header_names.copy()

        if datasource_type == DBType.V2_HISTORY:
            org_headers = [org_header.split(SUB_PART_NO_DEFAULT_SUFFIX)[0] for org_header in org_headers]

        header_names = normalize_list(header_names)

        if process_name:
            data_details, *_ = rename_sub_part_no(pd.DataFrame(data_details), datasource_type)
            header_names = data_details.columns.tolist()

        # get DB Type and check if there is abnormal history
        if is_abnormal_v2 is None and not datasource_type:
            datasource_type, is_abnormal_v2, _ = get_v2_datasource_type_from_file(csv_file)

        header_names = rename_abnormal_history_col_names(datasource_type, header_names, is_abnormal_v2)
        header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
        df_data_details = normalize_big_rows(data_details, header_names, is_show_raw_data=is_show_raw_data)
        data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]
        file_name_col_idx = None
        if show_file_name_column:
            (
                header_names,
                df_data_details,
                org_headers,
                data_types,
                dupl_cols,
                file_name_col_idx,
                _,
            ) = add_show_file_name_column(
                header_names,
                df_data_details,
                org_headers,
                data_types,
                previewed_files[0] if csv_file in temp_file_set and previewed_files else csv_file,
                is_gen_cols=None,
            )

        has_ct_col = True
        dummy_datetime_idx = None
        if df_data_details is not None:
            for col, dtype in zip(header_names, data_types, strict=False):
                if DataType(dtype) is not DataType.DATETIME:
                    continue
                df_data_details = validate_datetime(
                    df_data_details,
                    col,
                    False,
                    False,
                    is_convert_datetime=is_convert_datetime,
                )
                if is_convert_datetime:
                    df_data_details = convert_csv_timezone(df_data_details, col)
                df_data_details = df_data_details.dropna(subset=[col])
                data_types = [gen_data_types(df_data_details[col], is_v2=True) for col in header_names]

            df_data_details = df_data_details[0:limit]
            if DataType.DATETIME.value not in data_types and DATETIME_DUMMY not in df_data_details.columns:
                dummy_datetime_idx = 0
                df_data_details = gen_dummy_datetime(df_data_details)
                data_types.insert(dummy_datetime_idx, DataType.DATETIME.value)
                header_names.insert(dummy_datetime_idx, DATETIME_DUMMY)
                org_headers.insert(dummy_datetime_idx, DATETIME_DUMMY)
                has_ct_col = False

            same_values = check_same_values_in_df(df_data_details, header_names)

            if not return_df:
                df_data_details = df_data_details.to_records(index=False).tolist()
        elif not return_df:
            df_data_details = []

        if csv_file:
            csv_file = csv_file.replace('/', os.sep)

        has_dupl_cols = False
        if len(dupl_cols) and same_values:
            if dummy_datetime_idx is not None:
                # for dummy datetime column
                dupl_cols = [False, *dupl_cols]
            for key, value in enumerate(same_values):
                is_dupl_col = bool(dupl_cols[key])
                same_values[key]['is_dupl'] = is_dupl_col
                if is_dupl_col:
                    has_dupl_cols = True

        # # replace NA in df to empty
        if df_data_details is not None and not isinstance(df_data_details, list):
            df_data_details = df_data_details.astype(pd.StringDtype()).replace(list(PANDAS_DEFAULT_NA), EMPTY_STRING)

        return {
            'file_name': csv_file,
            'v2_processes': v2_process_names,
            'header': header_names,
            'content': df_data_details,
            'dataType': data_types,
            'skip_head': skip_head,
            'skip_tail': skip_tail,
            'previewed_files': previewed_files,
            'has_ct_col': has_ct_col,
            'dummy_datetime_idx': dummy_datetime_idx,
            'same_values': [{key: bool(value) for key, value in same_value.items()} for same_value in same_values],
            'has_dupl_cols': has_dupl_cols,
            'org_headers': org_headers,
            'v2_type': datasource_type.value,
            'encoding': encoding,
            'is_process_null': not v2_process_names,
            'file_name_col_idx': file_name_col_idx,
            'is_gen_cols': [False] * len(header_names),
        }

    finally:
        cleanup_temp_files(temp_files)


@log_execution_time()
def check_same_values_in_df(df, cols):
    same_values = []
    for col in cols:
        df_string = df[col].astype(pd.StringDtype())
        is_empty = (df_string == EMPTY_STRING) | df_string.isna()
        is_null = bool(is_empty.all())

        # See: https://docs.astral.sh/ruff/rules/pandas-nunique-constant-series-check/
        # Actually, we don't care NA value here
        value = df[col].dropna().to_numpy()
        is_same = value.shape[0] == 0 or (value[0] == value).all()
        is_same = bool(is_same)

        same_values.append({'is_null': is_null, 'is_same': is_same})

    return same_values


@log_execution_time()
def gen_v2_history_sub_part_no_column(column_name):
    column_name = unicode_normalize(column_name)
    sub_part_no_idxs = re.findall(r'\d+', column_name)
    if sub_part_no_idxs:
        sub_part_no_idx = sub_part_no_idxs[0]
        [_, suffix_name] = column_name.split(sub_part_no_idx)
        if REVERSED_WELL_KNOWN_COLUMNS[DBType.V2_HISTORY.name][DataGroupType.PART_NO.value] == suffix_name:
            return SUB_PART_NO_PREFIX + sub_part_no_idx + SUB_PART_NO_SUFFIX
        return SUB_PART_NO_PREFIX + sub_part_no_idx + to_romaji(suffix_name)
    return to_romaji(column_name)


@log_execution_time()
@CustomCache.memoize()
def gen_cols_with_types(
    cols,
    data_types,
    same_values,
    is_v2_history=False,
    column_raw_name=[],
    dict_column_name_and_unit={},
    dummy_datetime_idx: int | None = None,
    file_name_idx: int | None = None,
    is_gen_cols=[],
    import_filter=None,
    master_type: MasterDBType | None = None,
    ja_locale: bool | None = None,
):
    cols_with_types = []

    if ja_locale is None:
        ja_locale = is_ja_locale()

    if not len(is_gen_cols):
        is_gen_cols = [False] * len(cols)

    has_is_get_date_col = False
    has_is_serial_no_col = False
    if not column_raw_name:
        column_raw_name = cols
    column_raw_name_normalize = [normalize_str(col) for col in column_raw_name.copy()]

    # see: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/merge_requests/6875
    # we move this logic out of the loop so that we can add suffix AFTER extract unit
    if is_v2_history:
        # v2_history: name_jp use short name 子部品品番 → 子１品番
        mapped_col_names = cols
    else:
        mapped_col_names = []
        for normalized_col, col_name, is_gen_col in zip(column_raw_name_normalize, cols, is_gen_cols, strict=False):
            # when stripped col_raw_name is empty, use col_name (which are generated headers)
            mapped_col_name = col_name if is_gen_col else normalized_col
            mapped_col_names.append(mapped_col_name)

    # extract units before adding suffix
    extracted_col_names, units = [], []
    for mapped_col_name in mapped_col_names:
        column_name_extracted, unit = ColumnRawNameRule.extract_data(mapped_col_name, unit_remove=True)
        if unit:
            # if unit extracted by regex, verify unit by m_unit data again
            valid_unit = MUnit.get_by_unit(unit)

            # if not valid, string normalization applied for column name
            if not valid_unit:
                # set unit be empty
                unit = ''
                column_name_extracted, _ = ColumnRawNameRule.extract_data(mapped_col_name, unit_remove=False)
        extracted_col_names.append(column_name_extracted)
        units.append(unit)

    extracted_col_names_with_suffix, _ = gen_colsname_for_duplicated(extracted_col_names)
    potential_id_cols = []
    column_names_with_suffix, _ = gen_colsname_for_duplicated(cols)
    filter_systems_map = {}

    is_software_workshop = master_type is not None and MasterDBType.is_software_workshop(master_type.name)
    for idx, (
        col_name,
        col_raw_name,
        column_name_extracted,
        unit,
        data_type,
        same_value,
    ) in enumerate(
        zip(
            column_names_with_suffix,
            column_raw_name,
            extracted_col_names_with_suffix,
            units,
            data_types,
            same_values,
            strict=False,
        )
    ):
        extended_cfg = {}
        is_date = False if has_is_get_date_col else DataType(data_type) is DataType.DATETIME
        is_serial_no = (
            DataType(data_type) in [DataType.TEXT, DataType.INTEGER]
            and RE_SERIAL_PATTERN.search(col_name.lower()) is not None
        )
        is_main_serial_no = False
        if is_date:
            has_is_get_date_col = True

        if is_serial_no:
            if has_is_serial_no_col:
                is_serial_no = True
            else:
                is_main_serial_no = True
                is_serial_no = False
                has_is_serial_no_col = True
        # Collect columns with 'id' in name for potential main serial
        elif RE_ID_PATTERN.search(col_name) is not None and DataType(data_type) in [
            DataType.INTEGER,
            DataType.TEXT,
        ]:
            potential_id_cols.append(idx)

        # set Datetime:key & main::Datetime for SOFTWARE_WORKSHOP
        if is_software_workshop:
            if col_name.lower() == POSTGRES_SOFTWARE_WORKSHOP_DEF.event_time:
                is_date, has_is_get_date_col = True, True
                extended_cfg[ProcessColumnConst.COLUMN_TYPE.value] = DataColumnType.DATETIME.value
                extended_cfg[ProcessColumnConst.DATA_TYPE.value] = DataType.DATETIME.name
            elif col_name.lower() == POSTGRES_SOFTWARE_WORKSHOP_DEF.created_at:
                is_date = False
                extended_cfg[ProcessColumnConst.IS_AUTO_INCREMENT.value] = True
                extended_cfg[ProcessColumnConst.COLUMN_TYPE.value] = DataColumnType.DATETIME_KEY.value
                extended_cfg[ProcessColumnConst.DATA_TYPE.value] = DataType.DATETIME.name
            else:
                is_date = False

        # add to output
        if col_name:
            if ja_locale:
                name_local = ''
                name_jp = column_name_extracted
                name_en, is_wellknown_col = convert_wellknown_col_name(name_jp)
                if not is_wellknown_col:
                    name_en = to_romaji(name_en) if not is_v2_history else gen_v2_history_sub_part_no_column(name_en)
            else:
                name_jp = ''
                name_en, is_wellknown_col = convert_wellknown_col_name(column_name_extracted)
                name_local = to_romaji_en(name_en)
                if not is_wellknown_col:
                    name_en = to_romaji(name_en) if not is_v2_history else gen_v2_history_sub_part_no_column(name_en)

            # This is used for name_en on frontend for unregistered process. Therefore it should be name_en
            romaji = name_en
            col_unit = dict_column_name_and_unit.get(col_raw_name, unit)
            filter_expression = import_filter.get(col_raw_name) if import_filter is not None else None

            # support to guest filter system in case of normal csv or not well_known columns
            if not is_wellknown_col or not is_software_workshop:
                guested_dtype = DataType(data_type) if data_type else None
                # detect filter system column
                filter_system_data = ColumnRenamer.get_filter_system_from_col(col_name, guested_dtype)
                # check if data-type of guested filter system column is accepted
                accepted_dtypes = (
                    DataType(data_type) in filter_system_data.accept_dtypes if filter_system_data else False
                )
                # if already has filter system column, skip detect this column as filter_system again
                # it mean keep first column as filter_system if there are so many columns same type
                if filter_system_data and filter_system_data.column_type not in filter_systems_map and accepted_dtypes:
                    filter_systems_map[filter_system_data.column_type] = col_name
                    name_en = filter_system_data.name_en
                    romaji = filter_system_data.name_en
                    name_jp = filter_system_data.name_jp
                    name_local = '' if ja_locale else filter_system_data.name_en
                    extended_cfg[ProcessColumnConst.COLUMN_TYPE.value] = filter_system_data.column_type

                guess_col = ColumnRenamer.get_guess_col(col_name, guested_dtype)

                if guess_col:
                    name_en = guess_col.name_en
                    romaji = guess_col.name_en
                    name_jp = guess_col.name_jp
                    name_local = '' if ja_locale else guess_col.name_en
                    extended_cfg[ProcessColumnConst.COLUMN_TYPE.value] = guess_col.column_type

            cols_with_types.append(
                {
                    'column_name': col_name,
                    'data_type': DataType(data_type).name,
                    'name_en': name_en,  # this is system_name
                    'romaji': romaji,
                    'is_get_date': is_date,
                    'is_serial_no': is_serial_no,
                    'is_main_serial_no': is_main_serial_no,
                    'is_dummy_datetime': dummy_datetime_idx == idx if dummy_datetime_idx is not None else False,
                    'is_file_name': file_name_idx == idx if file_name_idx is not None else False,
                    'check_same_value': same_value,
                    'name_jp': name_jp,
                    'name_local': name_local,
                    'column_raw_name': col_raw_name,
                    'unit': col_unit,
                    'is_checked': not same_value.get('is_null'),
                    'is_show': True,
                    'filter': filter_expression,
                    **extended_cfg,
                },
            )

    # If no main serial number was assigned, check for ID columns
    if not has_is_serial_no_col and potential_id_cols:
        # Assign the first ID column as main serial
        cols_with_types[potential_id_cols[0]]['is_main_serial_no'] = True

    return cols_with_types


@log_execution_time()
def convert_utc_df(df_rows, cols, data_types, data_source):
    for col_name, data_type in zip(cols, data_types, strict=False):
        is_date = DataType(data_type) is DataType.DATETIME
        if not is_date:
            continue

        # convert utc
        # date_val, tzoffset_str, db_timezone = get_tzoffset_of_random_record(data_source, table_name, col_name)

        # use os timezone
        if data_source.db_detail and data_source.db_detail.use_os_timezone:
            pass

        # is_tz_inside, _, time_offset = get_time_info(date_val, db_timezone)

        # Convert UTC time
        df_rows = validate_datetime(df_rows, col_name, False, False)
        df_rows = convert_csv_timezone(df_rows, col_name)
        df_rows = df_rows.dropna(subset=[col_name])

    return df_rows


@log_execution_time()
def transform_df_to_rows(cols, df_rows, limit):
    return [dict(zip(cols, vals, strict=False)) for vals in df_rows[0:limit][cols].to_records(index=False).tolist()]


@log_execution_time()
def gen_preview_data_check_dict(rows, previewed_files, import_filter=None):
    dic_preview_limit = {}
    file_path = previewed_files[0] if previewed_files else ''
    file_name = ''
    folder_path = ''
    if file_path:
        file_name = os.path.basename(file_path)
        folder_path = os.path.dirname(file_path)

    dic_preview_limit['reach_fail_limit'] = bool(not rows and previewed_files and not import_filter)
    dic_preview_limit['file_name'] = file_name
    dic_preview_limit['folder'] = folder_path
    return dic_preview_limit


def is_valid_list(df_rows):
    return (isinstance(df_rows, list) and len(df_rows)) or (isinstance(df_rows, pd.DataFrame) and not df_rows.empty)


@log_execution_time()
def gen_v2_columns_with_types(v2_datasrc):
    v2_columns = []
    v2_csv_detail = v2_datasrc.get('csv_detail')
    csv_delimiter = get_csv_delimiter(v2_csv_detail.get('delimiter'))
    v2_data_preview = preview_v2_data(
        v2_csv_detail.get('directory'),
        csv_delimiter,
        limit=5,
        return_df=True,
        process_name=v2_csv_detail.get('process_name'),
        file_name=v2_csv_detail.get('directory') if v2_csv_detail.get('is_file_path') else None,
    )
    for i, column in enumerate(v2_data_preview.get('header')):
        data_type = int(v2_data_preview.get('dataType')[i])
        v2_columns.append({'column_name': column, 'data_type': DataType(data_type).name, 'order': i})
    return v2_columns


@log_execution_time()
def re_order_items_by_datetime_idx(datetime_idx: int, items: list) -> list:
    new_column_ordered = [items[datetime_idx]]
    new_column_ordered += [col for (i, col) in enumerate(items) if i != datetime_idx]
    return new_column_ordered


@log_execution_time()
def extract_data_detail(header_names, data_details, org_header=None, is_show_raw_data=False):
    org_headers = org_header or header_names.copy()
    # normalization
    header_names = normalize_list(header_names)
    header_names = [normalize_str(col) for col in header_names]
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    df_data_details = normalize_big_rows(data_details, header_names, is_show_raw_data=is_show_raw_data)
    data_types = [gen_data_types(df_data_details[col]) for col in header_names]
    return df_data_details, org_headers, header_names, dupl_cols, data_types


def add_new_column_with_data(
    header_names,
    df_data_details,
    org_headers,
    data_types,
    index,
    data,
    new_data_type,
    new_col_name,
    is_gen_cols=None,
):
    df_cols = df_data_details.columns.tolist()
    header_names.insert(index, new_col_name)
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    suffix_header_names = header_names.copy()
    new_col = suffix_header_names.pop(index)
    rename_cols = dict(zip(df_cols, suffix_header_names, strict=False))
    df_data_details = df_data_details.rename(columns=rename_cols)
    org_headers.insert(index, new_col_name)
    data_types.insert(index, new_data_type)
    df_data_details.insert(loc=index, column=new_col, value=data)
    if is_gen_cols:
        is_gen_cols.insert(index, False)
    return header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols


def add_show_file_name_column(header_names, df_data_details, org_headers, data_types, file_path, is_gen_cols=None):
    file_name_col_idx = len(header_names)
    file_name = os.path.basename(file_path)
    data = [file_name] * len(df_data_details)
    data_type = DataType.TEXT.value
    header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols = add_new_column_with_data(
        header_names,
        df_data_details,
        org_headers,
        data_types,
        file_name_col_idx,
        data,
        data_type,
        FILE_NAME,
        is_gen_cols,
    )
    return header_names, df_data_details, org_headers, data_types, dupl_cols, file_name_col_idx, is_gen_cols


def add_dummy_datetime_column(header_names, df_data_details, org_headers, data_types, is_gen_cols=None):
    dummy_datetime_col_idx = 0
    data = gen_dummy_datetime_data(df_data_details)
    data = data.strftime(DATE_FORMAT_SIMPLE)  # get raw string of datetime to show on sample data preview
    data_type = DataType.DATETIME.value
    header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols = add_new_column_with_data(
        header_names,
        df_data_details,
        org_headers,
        data_types,
        dummy_datetime_col_idx,
        data,
        data_type,
        DATETIME_DUMMY,
        is_gen_cols,
    )
    return header_names, df_data_details, org_headers, data_types, dupl_cols, dummy_datetime_col_idx, is_gen_cols


def add_generated_datetime_column(
    current_process_id: int,
    df_data_details,
    org_headers,
    header_names,
    dupl_cols,
    data_types,
    is_gen_cols=None,
):
    # get datetime column
    main_datetime_col = CfgProcessColumn.get_col_main_datetime(current_process_id)
    main_date_col = CfgProcessColumn.get_col_main_date(current_process_id)
    main_time_col = CfgProcessColumn.get_col_main_time(current_process_id)

    if main_date_col and main_time_col:
        column_name = main_datetime_col.column_name
        if column_name not in header_names:
            index = len(df_data_details.columns)
            # TODO: add sample data for datetime column
            data = [None] * len(df_data_details)
            data_type = DataType.DATETIME.value
            header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols = add_new_column_with_data(
                header_names,
                df_data_details,
                org_headers,
                data_types,
                index,
                data,
                data_type,
                column_name,
                is_gen_cols,
            )

            # add sample data for datetime column
            df_data_details[column_name] = None
            proc_col = get_process_columns(current_process_id, show_graph=False)
            column_main_date_name = next(
                (col['column_name'] for col in proc_col if col.get('column_type') == DataColumnType.MAIN_DATE.value),
                None,
            )
            column_main_time_name = next(
                (col['column_name'] for col in proc_col if col.get('column_type') == DataColumnType.MAIN_TIME.value),
                None,
            )
            if column_main_date_name and column_main_time_name:
                df_data_details[column_name] = (
                    df_data_details[column_main_date_name].astype(str)
                    + HALF_WIDTH_SPACE
                    + df_data_details[column_main_time_name].astype(str)
                )

    return header_names, df_data_details, org_headers, data_types, dupl_cols, is_gen_cols


def save_preview_ds_file(
    data_source_id: int,
    data: dict,
    table_name: str | None = None,
    process_factid: str | None = None,
    master_type: MasterDBType | None = None,
    etl_func: str | None = None,
) -> None:
    """Save datasource preview data to JSON file."""
    # Generate preview file path based on parameters
    sample_data_file = gen_latest_record_result_file_path(
        data_source_id,
        table_name=table_name,
        process_factid=process_factid,
        master_type=master_type,
        etl_func=etl_func,
    )

    # Create directory if it doesn't exist
    make_dir_from_file_path(sample_data_file)

    try:
        # Write preview data to JSON file
        with open(sample_data_file, 'wb') as outfile:
            data = orjson_dumps(data)
            outfile.write(data)
    except Exception as e:
        # Log exception if file write fails
        logger.exception(f'Failed to save preview file: {sample_data_file}', exc_info=e)


def save_preview_process_file(
    data_source_id: int,
    process_id: int,
    table_name: str | None = None,
    process_factid: str | None = None,
    master_type: MasterDBType | None = None,
    etl_func: str | None = None,
) -> None:
    """Copy datasource preview data to process-specific preview file."""
    # Generate datasource preview file path
    ds_preview_file = gen_latest_record_result_file_path(
        data_source_id=data_source_id,
        table_name=table_name,
        process_factid=process_factid,
        master_type=master_type,
        etl_func=etl_func,
    )

    # Generate process preview file path
    sample_data_path = get_preview_data_file_folder(data_source_id)
    process_preview_file = os.path.join(sample_data_path, f'process_{process_id}.json')

    # Check if datasource preview file exists
    if not os.path.exists(ds_preview_file):
        logger.warning(f'No datasource preview to copy: {ds_preview_file}')
        return

    try:
        # Read data from datasource preview file
        with open(ds_preview_file, encoding='utf-8') as infile:
            data = json.load(infile)

        # Write data to process preview file
        with open(process_preview_file, 'wb') as outfile:
            data = orjson_dumps(data)
            outfile.write(data)

        logger.info(f'Process preview saved (copied): {process_preview_file}')

    except Exception as e:
        # Log exception if file copy fails
        logger.exception(f'Copy failed for process {process_id}', exc_info=e)


def get_preview_data_files(
    data_source_id: int,
    table_name: str | None = None,
    process_factid: str | None = None,
    master_type: MasterDBType | None = None,
    etl_func: str | None = None,
    process_id: int | None = None,
) -> str | None:
    """
    Get the preview data file path with priority order:
    1. If process_id is provided → check process_{process_id}.json first
    2. If not found or no process_id → fallback to the latest datasource preview file
       (generated by gen_latest_record_result_file_path)

    Returns: full file path (str) if found, else None
    """
    folder_path = get_preview_data_file_folder(data_source_id)

    if not check_exist(folder_path):
        return None

    # Priority 1: If a process_id is available, check the process file first.
    if process_id is not None:
        proc_preview_file = os.path.join(folder_path, f'process_{process_id}.json')
        if os.path.isfile(proc_preview_file):
            return proc_preview_file

    # Priority 2: Fallback to the shared datasource preview file.
    ds_preview_file = gen_latest_record_result_file_path(
        data_source_id,
        table_name=table_name,
        process_factid=process_factid,
        master_type=master_type,
        etl_func=etl_func,
    )

    # Check if the file exists.
    if os.path.isfile(ds_preview_file):
        return ds_preview_file

    return None


def gen_latest_record_result_file_path(
    data_source_id: int,
    table_name: str | None = None,
    process_factid: str | None = None,
    master_type: MasterDBType | None = None,
    etl_func: str | None = None,
) -> str:
    """Generate file path for preview data based on parameters.

    Args:
        data_source_id: ID of the data source (required)
        table_name: Name of the table (optional)
        process_factid: Process fact ID (optional)
        master_type: Master database type (optional)
        etl_func: ETL function name (optional)

    Returns:
        str: Full file path for the preview data JSON file
    """
    sample_data_path = get_preview_data_file_folder(data_source_id)
    file_partials = [
        str(data_source_id),
        table_name,
        process_factid,
        master_type,
        etl_func,
    ]
    file_name = UNDER_SCORE.join([p for p in file_partials if p])
    file_name = f'{file_name}.json'
    sample_data_file = os.path.join(sample_data_path, file_name)
    return sample_data_file


def parse_unique_as_category(data):
    """
    Calculate unique values as category (string)
    :param data: Pandas Series
    :return: Series with maximum 10 unique string values
    """
    try:
        data = pd.Series(data.astype(pd.StringDtype()).unique())
        return data.reindex(range(10), fill_value='')
    except Exception:
        return pd.Series()


def parse_unique_as_real(data):
    """
    Calculate percentile as real, must convert to numeric according to AP's rules
    :param data: Pandas Series
    :return: Series with 5 percentile values
    """
    try:
        data, _ = convert_numeric_by_type(data, DataType.REAL.name)
        data = data.dropna()
        return pd.Series(np.percentile(data.astype(pd.Float64Dtype()), [0, 25, 50, 75, 100]))
    except Exception:
        return pd.Series()


def parse_unique_as_int(data):
    """
    Calculate percentile as integer, must convert to numeric according to AP's rules (1.1 -> NA)
    :param data: Pandas Series
    :return: Series with 5 percentile values
    """
    try:
        data, _ = convert_numeric_by_type(data, DataType.INTEGER.name)
        data = data.dropna()
        return pd.Series(np.percentile(data.astype(pd.Int64Dtype()), [0, 25, 50, 75, 100]))
    except Exception:
        return pd.Series()


def parse_unique_as_int_cat(data):
    """
    Calculate unique values as category integer
    :param data: Pandas Series
    :return: Series with maximum 10 unique int cat values
    """
    try:
        data, _ = convert_numeric_by_type(data, DataType.INTEGER.name)
        data = pd.Series(data.astype(pd.Int64Dtype()).unique())
        return data.reindex(range(10), fill_value=np.nan)
    except Exception:
        return pd.Series()


def check_datasource_connection(data_source: CfgDataSource):
    if data_source.is_csv_or_v2():
        data_source_csv_detail = data_source.csv_detail
        if data_source_csv_detail.is_file_path:
            connection_result = os.path.isfile(data_source_csv_detail.directory)
        else:
            connection_result = len(get_sorted_files(data_source_csv_detail.directory)) > 0
        if not connection_result:
            raise FileNotFoundError('File not found')
        return connection_result
    else:
        db_instance = ReadOnlyDbProxy(data_source)
        connection_result = db_instance.check_db_connection(data_source)
        return connection_result


def get_function_column_unique_values(cfg_col, trans_data) -> list:
    """Retrieve sorted unique values for a function-based process column.

    Resolves all dependent normal and function columns for the given column,
    fetches the raw transaction data, evaluates the function chain, and returns
    the distinct non-null values of the resulting column.

    Args:
        cfg_col (CfgProcessColumn): The function column.
        trans_data (TransactionData): Transaction data object providing the table name.

    Returns:
        list: Sorted list of unique non-null values for the function column.
              Returns an empty list if no normal columns are found or the result
              column is absent from the evaluated DataFrame.
    """
    relation_cfg_cols, relation_normal_cols, sorted_cfg_function_cols = _get_relation_cols(cfg_col)
    if not relation_normal_cols:
        return []

    df = _fetch_raw_data(trans_data, relation_normal_cols)
    df = _evaluate_function_columns(df, relation_cfg_cols, sorted_cfg_function_cols)

    result_col = cfg_col.bridge_column_name
    if result_col not in df.columns:
        return []

    return _get_limited_distinct_values(df[result_col], limit=1000)


def _get_relation_cols(cfg_col: CfgProcessColumn) -> tuple[dict, list, list]:
    """Resolve all columns related to a function column, separated by type.

    Traverses the column dependency graph to collect all normal (non-function)
    columns and function detail columns that are required to evaluate the given
    function column. Function detail columns are sorted by their execution order.

    Args:
        cfg_col (CfgProcessColumn): The target function column to resolve dependencies for.

    Returns:
        tuple[dict, list, list]: A 3-tuple containing:
            - relation_cfg_cols (dict): Mapping of column ID to CfgProcessColumn for all
              related columns (both normal and function columns).
            - relation_normal_cols (list): List of CfgProcessColumn objects that are plain
              transaction columns (no function details).
            - sorted_cfg_function_cols (list): List of function detail objects sorted
              ascending by their ``order`` attribute, representing the evaluation sequence.
    """
    relation_column_ids = get_all_normal_columns_for_functions([cfg_col.id], cfg_col.cfg_process.columns)
    relation_column_ids.append(cfg_col.id)
    relation_cfg_cols = {col.id: col for col in cfg_col.cfg_process.columns if col.id in relation_column_ids}

    relation_normal_cols = [
        col for col in relation_cfg_cols.values() if not col.function_details and col.is_transaction_column
    ]
    sorted_cfg_function_cols = sorted(
        chain.from_iterable(col.function_details for col in relation_cfg_cols.values() if col.function_details),
        key=lambda col: col.order,
    )
    return relation_cfg_cols, relation_normal_cols, sorted_cfg_function_cols


def _fetch_raw_data(trans_data: TransactionData, normal_cols: list) -> pd.DataFrame:
    """Fetch raw transaction data for the specified normal columns from the database.

    Opens a read-only transaction connection for the given process and executes
    a SELECT query to retrieve only the bridge columns corresponding to the
    provided normal column configurations.

    Args:
        trans_data (TransactionData): Transaction data object of the process.
        normal_cols (list): List of CfgProcessColumn objects representing the columns
            to select; their ``bridge_column_name`` attributes are used as column names.

    Returns:
        pd.DataFrame: A DataFrame containing the fetched rows with bridge column names
            as column headers.
    """
    col_names = [col.bridge_column_name for col in normal_cols]
    with TxnDataConnection(process_id=trans_data.process_id, readonly_transaction=True) as data_con:
        return trans_data.select_columns(data_con=data_con, column_names=col_names, limit=1000, is_distinct=True)


def _get_limited_distinct_values(data: pd.Series, limit: int = 1000) -> list[Any]:
    """Extract sorted distinct non-null values with a hard limit."""
    unique_vals = pd.Series(pd.unique(data.dropna())).tolist()
    unique_vals = unique_vals[:limit]
    with suppress(TypeError):
        unique_vals = sorted(unique_vals)
    return unique_vals


def _evaluate_function_columns(
    df: pd.DataFrame,
    relation_cfg_cols: dict,
    sorted_cfg_function_cols: list,
) -> pd.DataFrame:
    """Apply function column equations sequentially to the DataFrame.

    Missing input columns are filled with NaN before evaluation.

    Args:
        df (pd.DataFrame): The input DataFrame containing raw transaction data.
        relation_cfg_cols (dict): Mapping of column ID to CfgProcessColumn for all
            related columns, used to resolve input and output column metadata.
        sorted_cfg_function_cols (list): Ordered list of function detail objects
            (sorted by ``order``) that define the equations to evaluate.

    Returns:
        pd.DataFrame: The DataFrame with all function column results appended or
            updated as new columns.
    """
    for cfg_func_col in sorted_cfg_function_cols:
        equation_class = get_function_class_by_id(cfg_func_col.function_id)
        equation = equation_class.from_kwargs(**cfg_func_col.as_dict())

        cfg_col_x = relation_cfg_cols.get(cfg_func_col.var_x)
        cfg_col_y = relation_cfg_cols.get(cfg_func_col.var_y)

        column_x, x_dtype = (cfg_col_x.bridge_column_name, cfg_col_x.raw_data_type) if cfg_col_x else (None, None)
        column_y, y_dtype = (cfg_col_y.bridge_column_name, cfg_col_y.raw_data_type) if cfg_col_y else (None, None)

        if column_x and column_x not in df.columns:
            df[column_x] = np.nan
        if column_y and column_y not in df.columns:
            df[column_y] = np.nan

        output_cfg_col = relation_cfg_cols.get(cfg_func_col.process_column_id)
        if output_cfg_col is None:
            logger.warning(
                f'Skip evaluating function column: output config column not found '
                f'(process_column_id={cfg_func_col.process_column_id}, function_id={cfg_func_col.function_id})'
            )
            continue

        df = equation.evaluate(
            df,
            out_col=output_cfg_col.bridge_column_name,
            x_col=column_x,
            y_col=column_y,
            x_dtype=x_dtype,
            y_dtype=y_dtype,
        )

    return df
