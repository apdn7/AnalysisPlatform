from __future__ import annotations

import os
import re
import unicodedata
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime
from itertools import chain
from pathlib import Path
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
    validate_datetime,
)
from ap.api.setting_module.services.equations import get_all_normal_columns_for_functions
from ap.api.setting_module.services.master_data_transform_pattern import ColumnRawNameRule
from ap.api.setting_module.services.preview_data import (
    PreviewDataset,
    PreviewMetadata,
    PreviewProcessingStage,
    PreviewRequestContext,
    PreviewSourceError,
    PreviewSourceKind,
    PreviewStorageError,
    build_datasource_location_fingerprint,
    build_preview_fingerprint,
)
from ap.api.setting_module.services.preview_parquet import (
    get_datasource_preview_path,
    get_process_preview_path,
    read_stored_preview,
    write_preview_atomic,
)
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
    convert_numeric_by_type_core,
    get_csv_delimiter,
    is_int_64,
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
    MAX_SAFE_INTEGER,
    MAXIMUM_V2_PREVIEW_ZIP_FILES,
    PREVIEW_DISPLAY_LIMIT,
    PREVIEW_EXTERNAL_ANALYSIS_LIMIT,
    PREVIEW_SCHEMA_VERSION,
    RE_ID_PATTERN,
    RE_SERIAL_PATTERN,
    REVERSED_WELL_KNOWN_COLUMNS,
    SOFTWARE_WORKSHOP_SHOW_MISSING_COLUMNS_ON_PREVIEW,
    SUB_PART_NO_DEFAULT_SUFFIX,
    SUB_PART_NO_PREFIX,
    SUB_PART_NO_SUFFIX,
    CSVExtTypes,
    DataColumnType,
    DataGroupType,
    DataType,
    DBType,
    MasterDBType,
    ProcessColumnConst,
)
from ap.common.log import log_execution_time
from ap.common.memoize import CustomCache, OptionalCacheConfig
from ap.common.path_utils import (
    filter_files_by_select_condition,
    get_sorted_files,
    get_sorted_files_by_size,
)
from ap.common.pydn.dblib import mssqlserver, oracle
from ap.common.pydn.dblib.db_common import add_double_quote, gen_select_col_str
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.common.services.csv_content import (
    get_delimiter_encoding,
)
from ap.common.services.csv_header_wrapr import (
    convert_wellknown_col_name,
    gen_colsname_for_duplicated,
)
from ap.common.services.data_type import (
    check_data_type,
    convert_df_str_to_others,
    gen_data_types_core,
    gen_data_types_from_prepared,
    prepare_data_type_values,
)
from ap.common.services.jp_to_romaji_utils import change_duplicated_columns, to_romaji, to_romaji_en
from ap.common.services.normalization import (
    NORMALIZE_FORM_NFKC,
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

_PREVIEW_NA_VALUES = frozenset(str(value).lower() for value in NA_VALUES)


def resolve_preview_source(
    current_process_id: int | None,
    refresh_preview: bool,
    *,
    internal_has_rows: bool = False,
    parquet_available: bool = False,
) -> PreviewSourceKind | None:
    """Classify available sources without authorizing generation on a cache miss.

    The main-preview resolver separately opts into external fallback; sample
    sub-queries must not gain that permission from this compatibility helper.
    """
    if refresh_preview or current_process_id is None:
        return PreviewSourceKind.EXTERNAL
    if internal_has_rows:
        return PreviewSourceKind.INTERNAL
    if parquet_available:
        return PreviewSourceKind.PARQUET
    return None


@dataclass
class ExternalPreviewSourceData:
    """Raw external adapter output for the PREPARED-preview pipeline."""

    dataframe: pd.DataFrame
    columns: list[str]
    raw_columns: list[str]
    data_types: list[int] | None
    same_values: list[dict[str, bool]] | None
    previewed_files: list[str] | None
    has_ct_col: bool | None
    dummy_datetime_idx: int | None
    file_name_col_idx: int | None
    is_v2_history: bool
    is_gen_cols: list[bool] | None
    data_source: CfgDataSource | None
    is_csv_or_v2: bool
    master_type: MasterDBType | None
    needs_value_normalization: bool
    file_name_samples: list[str] | None = None
    dict_column_name_and_unit: dict[str, str] = field(default_factory=dict)


def load_external_preview_source_data(context: PreviewRequestContext) -> ExternalPreviewSourceData:
    """Load up to the external analysis limit through the existing source adapters."""
    data_source: CfgDataSource | None = None
    directory = context.directory
    file_name = context.file_name
    delimiter = context.delimiter or 'Auto'
    skip_head = None
    n_rows = None
    is_transpose = False
    is_file_checker = False
    is_v2_datasource = context.is_v2_datasource
    master_type = context.master_type
    api_url = context.api_url
    etl_func = context.etl_func
    filtered_process_name = context.filtered_process_name
    file_name_include = None
    file_name_exclude = None
    subfolder_include = None
    subfolder_exclude = None

    if context.data_source_id is not None:
        data_source = CfgDataSource.query.get(context.data_source_id)
        if data_source is None:
            raise PreviewSourceError(f'Data source does not exist: {context.data_source_id}')
        is_v2_datasource = is_v2_data_source(ds_type=data_source.type)
        is_csv_or_v2 = data_source.type.lower() == DBType.CSV.name.lower() or is_v2_datasource
        if data_source.web_detail and not api_url:
            api_url = data_source.web_detail.url
        if is_csv_or_v2:
            csv_detail = data_source.csv_detail
            directory = csv_detail.directory
            file_name = file_name or (csv_detail.directory if csv_detail.is_file_path else None)
            etl_func = csv_detail.etl_func
            filtered_process_name = filtered_process_name or csv_detail.process_name or False
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

    selected_raw_columns = list(context.requested_raw_column_names)
    if selected_raw_columns and context.process_id is not None:
        for dependency_column in (
            CfgProcessColumn.get_col_main_date(context.process_id),
            CfgProcessColumn.get_col_main_time(context.process_id),
        ):
            if dependency_column and dependency_column.column_raw_name not in selected_raw_columns:
                selected_raw_columns.append(dependency_column.column_raw_name)
    if is_csv_or_v2:
        if is_v2_datasource:
            preview_data = preview_v2_data(
                directory,
                delimiter,
                PREVIEW_EXTERNAL_ANALYSIS_LIMIT,
                return_df=True,
                process_name=filtered_process_name,
                file_name=file_name,
                show_file_name_column=True,
            )
        else:
            preview_data = preview_csv_data(
                directory,
                etl_func,
                delimiter,
                PREVIEW_EXTERNAL_ANALYSIS_LIMIT,
                return_df=True,
                max_records=PREVIEW_EXTERNAL_ANALYSIS_LIMIT,
                file_name=file_name,
                skip_head=skip_head,
                n_rows=n_rows,
                is_transpose=is_transpose,
                show_file_name_column=True,
                current_process_id=context.process_id,
                is_file_checker=is_file_checker,
                encoding=context.encoding,
                auto_encoding=context.auto_encoding,
                fast_preview=True,
                selected_columns=selected_raw_columns,
                file_name_include=file_name_include,
                file_name_exclude=file_name_exclude,
                subfolder_include=subfolder_include,
                subfolder_exclude=subfolder_exclude,
            )
        headers = [normalize_str(column) for column in normalize_list(preview_data.get('header'))]
        return ExternalPreviewSourceData(
            dataframe=preview_data.get('content', pd.DataFrame()),
            columns=headers,
            raw_columns=preview_data.get('org_headers') or [],
            data_types=preview_data.get('dataType'),
            same_values=preview_data.get('same_values'),
            previewed_files=preview_data.get('previewed_files'),
            has_ct_col=preview_data.get('has_ct_col'),
            dummy_datetime_idx=preview_data.get('dummy_datetime_idx'),
            file_name_col_idx=preview_data.get('file_name_col_idx'),
            is_v2_history=preview_data.get('v2_type') == DBType.V2_HISTORY.value,
            is_gen_cols=preview_data.get('is_gen_cols'),
            data_source=data_source,
            is_csv_or_v2=True,
            master_type=master_type,
            needs_value_normalization=bool(preview_data.get('deferred_value_normalization')),
            file_name_samples=preview_data.get('file_name_samples'),
        )

    if api_url:
        authentication_type = WebAuthenticationType[data_source.web_detail.authentication_type]
        web_api = WebAPI(
            api_url,
            username=data_source.web_detail.username,
            encrypted_password=data_source.web_detail.password,
            authentication_type=authentication_type,
        )
        api_data = web_api.get_data(limit=PREVIEW_EXTERNAL_ANALYSIS_LIMIT)
        return ExternalPreviewSourceData(
            dataframe=api_data.df_rows,
            columns=api_data.cols,
            raw_columns=api_data.cols,
            data_types=None,
            same_values=None,
            previewed_files=None,
            has_ct_col=True,
            dummy_datetime_idx=None,
            file_name_col_idx=None,
            is_v2_history=False,
            is_gen_cols=None,
            data_source=data_source,
            is_csv_or_v2=False,
            master_type=master_type,
            needs_value_normalization=False,
            dict_column_name_and_unit=api_data.dict_column_name_and_unit,
        )

    if data_source is None:
        raise PreviewSourceError('A registered datasource is required for an RDB preview')
    if context.process_id is not None:
        process = CfgProcess.get_proc_by_id(context.process_id)
        process_factid = context.process_factid or process.process_factid
        master_type = master_type or process.master_type
    else:
        process_factid = context.process_factid
    rdb_load_kwargs: dict[str, Any] = {
        'process_factid': process_factid,
        'master_type': master_type,
        'sql_limit': PREVIEW_EXTERNAL_ANALYSIS_LIMIT,
        'selected_columns': tuple(selected_raw_columns) if selected_raw_columns and not context.etl_func else None,
    }
    if context.refresh_preview:
        rdb_load_kwargs['optional_cache_config'] = OptionalCacheConfig(override=True)
    columns, dataframe, units = get_info_from_db(data_source, context.table_name, **rdb_load_kwargs)
    return ExternalPreviewSourceData(
        dataframe=dataframe,
        columns=columns,
        raw_columns=columns,
        data_types=None,
        same_values=None,
        previewed_files=None,
        has_ct_col=True,
        dummy_datetime_idx=None,
        file_name_col_idx=None,
        is_v2_history=False,
        is_gen_cols=None,
        data_source=data_source,
        is_csv_or_v2=False,
        master_type=master_type,
        needs_value_normalization=False,
        dict_column_name_and_unit=units,
    )


def load_external_preview_dataset(context: PreviewRequestContext) -> PreviewDataset:
    """Build a full, filtered PREPARED dataset from an external source exactly once."""
    source = load_external_preview_source_data(context)
    dataframe, columns, raw_columns = _prepare_external_preview_dataframe(source, context)
    source_data_types = _get_reusable_source_data_types(source, columns, context)
    if source_data_types is None:
        inference_dataframe = dataframe
        if source.needs_value_normalization:
            inference_dataframe = _normalize_preview_dataframe(dataframe.copy())
            inference_dataframe = inference_dataframe.apply(clean_na_columns)
        data_types, same_values = gen_data_types_and_same_values(inference_dataframe, columns)
    else:
        data_types = source_data_types
        same_values = (
            [dict(same_value) for same_value in source.same_values]
            if source.same_values is not None and len(source.same_values) == len(columns)
            else _check_same_values_with_deferred_normalization(dataframe, columns)
        )
    columns_metadata = gen_cols_with_types(
        normalize_list(columns),  # we might be able to normalize columns at _prepare_external_preview_dataframe
        data_types,
        same_values,
        source.is_v2_history,
        raw_columns,
        source.dict_column_name_and_unit,
        dummy_datetime_idx=source.dummy_datetime_idx,
        file_name_idx=source.file_name_col_idx,
        is_gen_cols=source.is_gen_cols or [],
        import_filter=context.import_filter,
        master_type=source.master_type,
    )
    columns_metadata, cols_duplicated = change_duplicated_columns(columns_metadata)
    dataframe = _filter_external_preview_dataframe(dataframe, source, context)
    prepared_columns = [column['column_name'] for column in columns_metadata]
    dataframe.columns = prepared_columns
    _annotate_preview_judge_columns(dataframe, columns_metadata)
    timestamp = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
    source_type = source.data_source.type if source.data_source is not None else DBType.CSV.name
    metadata = PreviewMetadata(
        schema_version=PREVIEW_SCHEMA_VERSION,
        source_kind=PreviewSourceKind.EXTERNAL,
        origin_source_kind=PreviewSourceKind.EXTERNAL,
        processing_stage=PreviewProcessingStage.PREPARED,
        fingerprint=build_preview_fingerprint(
            context,
            source_type=source_type,
            selected_columns=raw_columns,
        ),
        data_source_id=context.data_source_id,
        process_id=context.process_id,
        created_at=timestamp,
        refreshed_at=timestamp,
        row_count=len(dataframe),
        column_count=len(dataframe.columns),
        columns=columns_metadata,
        cols_duplicated=cols_duplicated,
        previewed_files=source.previewed_files,
        has_ct_col=source.has_ct_col,
        dummy_datetime_idx=source.dummy_datetime_idx,
        is_rdb=not source.is_csv_or_v2,
        file_name_col_idx=source.file_name_col_idx,
        source_column_names=[column['column_name'] for column in columns_metadata],
        file_name_samples=source.file_name_samples,
    )
    return PreviewDataset(dataframe=dataframe, metadata=metadata)


def _get_reusable_source_data_types(
    source: ExternalPreviewSourceData,
    columns: list[str],
    context: PreviewRequestContext,
) -> list[int] | None:
    """Reuse CSV adapter datatypes when later processing cannot change them."""
    is_v2_source = context.is_v2_datasource or (
        source.data_source is not None and is_v2_data_source(ds_type=source.data_source.type)
    )
    if not source.is_csv_or_v2 or is_v2_source or source.data_types is None or len(source.data_types) != len(columns):
        return None

    return list(source.data_types)


def _get_registered_preview_source_column_names(
    context: PreviewRequestContext,
    process_preview_path: Path,
) -> list[str] | None:
    """Load the source-schema baseline from Process Parquet."""
    try:
        stored_dataset = read_stored_preview(process_preview_path)
    except PreviewStorageError:
        logger.exception('Unable to read Process Preview Parquet for process {}', context.process_id)
        stored_dataset = None
    if stored_dataset is not None and stored_dataset.metadata.source_column_names is not None:
        return stored_dataset.metadata.source_column_names
    return None


def create_external_preview(context: PreviewRequestContext) -> PreviewDataset:
    """Prepare and atomically persist one external preview."""
    process_preview_path = None
    registered_source_column_names = None
    if context.process_id is not None and context.data_source_id is not None:
        process_preview_path = get_process_preview_path(context.data_source_id, context.process_id)
        registered_source_column_names = _get_registered_preview_source_column_names(context, process_preview_path)

    dataset = load_external_preview_dataset(context)
    if process_preview_path is not None:
        process_columns = TransactionData(context.process_id).get_preview_column_metadata()
        dataset.metadata.fingerprint = build_preview_fingerprint(
            context,
            source_type='process',
            selected_columns=tuple(column['column_name'] for column in process_columns),
            process_column_configurations=process_columns,
        )
        dataset.metadata.source_column_names = registered_source_column_names or dataset.metadata.source_column_names
        dataset.metadata.is_refresh_preview = context.refresh_preview
        preview_path = process_preview_path
    else:
        location_fingerprint = build_datasource_location_fingerprint(context)
        dataset.metadata.fingerprint = location_fingerprint
        preview_path = get_datasource_preview_path(context, location_fingerprint)
    write_preview_atomic(preview_path, dataset)
    return dataset


def _prepare_external_preview_dataframe(
    source: ExternalPreviewSourceData,
    context: PreviewRequestContext,
) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Apply transformations that precede metadata inference."""
    dataframe = source.dataframe.copy()
    columns = list(source.columns) or list(dataframe.columns)
    if len(columns) == len(dataframe.columns):
        dataframe.columns = columns
    else:
        columns = list(dataframe.columns)

    # CSV/V2 adapters already apply their extraction, ETL, and generated columns.
    # RDB data applies its configured ETL after loading, matching get_latest_records.
    if not source.is_csv_or_v2 and context.etl_func:
        dataframe = df_transform(dataframe, context.etl_func)
        columns = list(dataframe.columns)

    raw_columns = list(source.raw_columns)
    if len(raw_columns) != len(columns):
        raw_columns = columns.copy()
    return dataframe, columns, raw_columns


def _filter_external_preview_dataframe(
    dataframe: pd.DataFrame,
    source: ExternalPreviewSourceData,
    context: PreviewRequestContext,
) -> pd.DataFrame:
    """Apply import filters after metadata inference and finish normalization."""
    filters = get_import_filter_for_preview(filter_dict=context.import_filter or {})
    if source.needs_value_normalization:
        filter_columns = [filter_item.get('column_name') for filter_item in filters]
        dataframe = _normalize_dataframe_columns(dataframe, filter_columns)
        existing_filter_columns = [column for column in filter_columns if column in dataframe.columns]
        if existing_filter_columns:
            dataframe[existing_filter_columns] = dataframe[existing_filter_columns].apply(clean_na_columns)

    dataframe = get_preview_df_with_filter(dataframe, filters)
    if source.needs_value_normalization:
        dataframe = _normalize_preview_dataframe(dataframe.copy())
        dataframe = dataframe.apply(clean_na_columns)

    return dataframe


def _annotate_preview_judge_columns(dataframe: pd.DataFrame, columns_metadata: list[dict[str, Any]]) -> None:
    """Populate Judge detection from the complete filtered analysis sample."""
    for column_metadata in columns_metadata:
        column_name = column_metadata['column_name']
        judge_formula = JudgeFormula.detect(dataframe[column_name])
        column_metadata[IS_JUDGE] = False
        if judge_formula is None:
            column_metadata[JUDGE_AVAILABLE] = False
            continue
        column_metadata[JUDGE_AVAILABLE] = True
        column_metadata[FORMULA] = judge_formula.get_formula()

    for column_metadata in columns_metadata:
        column_name = column_metadata['column_name']
        if (
            JUDGE_NAME_REGEX.search(column_name)
            and column_metadata[JUDGE_AVAILABLE]
            and column_metadata[COL_DATA_TYPE] == DataType.TEXT.name
        ):
            column_metadata[IS_JUDGE] = True
            column_metadata[COL_DATA_TYPE] = DataType.BOOLEAN.name
            break


def build_preview_response(dataset: PreviewDataset, limit: int = PREVIEW_DISPLAY_LIMIT) -> dict[str, Any]:
    """Format display rows without mutating the PREPARED analysis DataFrame."""
    display_limit = max(limit, 0)
    dataframe = _format_preview_response_dataframe(
        dataset.dataframe.head(display_limit).copy(),
        dataset.metadata.columns,
    )
    columns = [column['column_name'] for column in dataset.metadata.columns]
    response_columns = [_to_public_preview_column(column) for column in dataset.metadata.columns]
    return {
        'cols': response_columns,
        'rows': transform_df_to_rows(columns, dataframe, display_limit),
        'cols_duplicated': dataset.metadata.cols_duplicated,
        'previewed_files': dataset.metadata.previewed_files,
        'has_ct_col': dataset.metadata.has_ct_col,
        'dummy_datetime_idx': dataset.metadata.dummy_datetime_idx,
        'is_rdb': dataset.metadata.is_rdb,
        'file_name_col_idx': dataset.metadata.file_name_col_idx,
    }


_PUBLIC_PREVIEW_COLUMN_KEYS = (
    'column_name',
    'column_raw_name',
    'data_type',
    'name_en',
    'name_jp',
    'name_local',
    'romaji',
    'unit',
    'filter',
    'formula',
    'column_type',
    'is_get_date',
    'is_serial_no',
    'is_main_serial_no',
    'is_dummy_datetime',
    'is_file_name',
    'is_auto_increment',
    'check_same_value',
    'is_checked',
    'is_show',
    JUDGE_AVAILABLE,
    IS_JUDGE,
)


def _to_public_preview_column(column: dict[str, Any]) -> dict[str, Any]:
    """Remove persistence-only Process fields at the Preview response boundary."""
    return {key: column[key] for key in _PUBLIC_PREVIEW_COLUMN_KEYS if key in column}


def build_unique_preview_response(dataset: PreviewDataset) -> dict[str, list[dict[str, Any]]]:
    """Build legacy unique/percentile response fields from a prepared dataset."""
    column_names = [column['column_name'] for column in dataset.metadata.columns]
    data_types = {
        column['column_name']: column[COL_DATA_TYPE]
        for column in dataset.metadata.columns
        if column['column_name'] in dataset.dataframe.columns
    }
    unique_by_kind: tuple[dict[str, pd.Series], ...] = ({}, {}, {}, {})
    for column in dataset.metadata.columns:
        column_name = column['column_name']
        if column_name not in dataset.dataframe.columns:
            continue
        series = dataset.dataframe[column_name]
        if column.get('is_file_name') and dataset.metadata.file_name_samples:
            series = pd.Series(dataset.metadata.file_name_samples)
        samples = _calc_unique_samples(series, data_types.get(column_name, DataType.TEXT.name))
        for values_by_column, sample in zip(unique_by_kind, samples, strict=True):
            values_by_column[column_name] = sample

    response_keys = (
        'unique_rows_as_category',
        'unique_rows_as_real',
        'unique_rows_as_int',
        'unique_rows_as_int_cat',
    )
    return {
        response_key: transform_df_to_rows(column_names, pd.DataFrame(values_by_column), 10)
        for response_key, values_by_column in zip(response_keys, unique_by_kind, strict=True)
    }


def _format_preview_response_dataframe(
    dataframe: pd.DataFrame,
    columns_metadata: list[dict[str, Any]],
) -> pd.DataFrame:
    """Apply legacy numeric and string formatting only to a display-frame copy."""
    data_type_by_column = {
        column['column_name']: column[COL_DATA_TYPE]
        for column in columns_metadata
        if column['column_name'] in dataframe.columns
    }
    text_columns = []
    for column_name, data_type in data_type_by_column.items():
        if data_type == DataType.TEXT.name:
            text_columns.append(column_name)

    bool_text_columns = [column for column in text_columns if pd.api.types.is_bool_dtype(dataframe[column])]
    if text_columns:
        dataframe[text_columns] = dataframe[text_columns].astype(pd.StringDtype()).fillna('')
    for column_name in bool_text_columns:
        dataframe[column_name] = dataframe[column_name].str.lower()
    datetime_columns = dataframe.select_dtypes(include=['datetime64[ns]']).columns
    dataframe[datetime_columns] = dataframe[datetime_columns].astype('string')
    return dataframe


def _calc_unique_samples(series: pd.Series, data_type: str) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    series_for_calc = series
    if data_type in [
        DataType.INTEGER_SEP.name,
        DataType.EU_INTEGER_SEP.name,
        DataType.REAL_SEP.name,
        DataType.EU_REAL_SEP.name,
    ]:
        # ``convert_eu_decimal_series`` compares against datatype names. Keep
        # this as a string so separator-formatted values are normalized before
        # category and percentile samples are calculated.
        series_for_calc = convert_eu_decimal_series(series_for_calc, data_type)

    category = parse_unique_as_category(series_for_calc)

    # Keep separate try blocks per output to preserve behavior when one output fails.
    real = pd.Series()
    integer = pd.Series()
    integer_category = pd.Series()

    try:
        numeric, _ = convert_numeric_by_type_core(series_for_calc, DataType.REAL.name)
    except Exception:
        numeric = None

    if numeric is not None:
        try:
            real_numeric = numeric.dropna()
            real = pd.Series(np.percentile(real_numeric.astype(pd.Float64Dtype()), [0, 25, 50, 75, 100]))
        except Exception:
            real = pd.Series()

        try:
            maybe_int = numeric.notna() & numeric.mod(1).eq(0) & is_int_64(numeric)
            int_numeric = numeric.where(maybe_int, np.nan)
        except Exception:
            int_numeric = None
    else:
        int_numeric = None

    if int_numeric is not None:
        try:
            integer_data = int_numeric.dropna()
            integer = pd.Series(np.percentile(integer_data.astype(pd.Int64Dtype()), [0, 25, 50, 75, 100]))
        except Exception:
            integer = pd.Series()

        try:
            integer_category = pd.Series(
                int_numeric.astype(pd.Int64Dtype()).unique(),
            ).reindex(range(10), fill_value=np.nan)
        except Exception:
            integer_category = pd.Series()

    return category, real, integer, integer_category


def gen_data_types_and_same_values(df: pd.DataFrame, cols: list[str]) -> tuple[list[int], list[dict[str, bool]]]:
    data_types = []
    same_values = []
    for col in cols:
        source = df[col]
        prepared, raw_unique = prepare_data_type_values(source)
        data_types.append(gen_data_types_from_prepared(prepared))

        source_string = source.astype(pd.StringDtype())
        is_empty = (source_string == EMPTY_STRING) | source_string.isna()
        is_null = bool(is_empty.all())
        is_same = len(raw_unique) <= 1
        same_values.append({'is_null': is_null, 'is_same': bool(is_same)})

    return data_types, same_values


def _normalize_preview_dataframe(
    df: pd.DataFrame,
    *,
    is_show_raw_data: bool = False,
) -> pd.DataFrame:
    """Normalize a preview-sized dataframe without touching the full inference sample."""
    return normalize_big_rows(
        df,
        list(df.columns),
        is_show_raw_data=is_show_raw_data,
        convert_types=False,
    )


def _is_fast_data_type_candidate_valid(prepared: pd.Series, candidate: int) -> bool:
    """Validate a seed datatype against the full sample using vectorized operations.

    Returning False is intentionally conservative: the caller falls back to the
    existing inference implementation, preserving behavior for ambiguous data.
    """
    if prepared.empty:
        return False

    data_type = DataType(candidate)
    if data_type is DataType.INTEGER:
        numeric = pd.to_numeric(prepared, errors='coerce')
        if numeric.isna().any() or np.isinf(numeric).any():
            return False
        if not numeric.mod(1).eq(0).all():
            return False
        if numeric.abs().gt(MAX_SAFE_INTEGER).any():
            return False

        # Preserve string identity so leading zeroes, explicit plus signs and
        # decimal notation keep the same behavior as check_data_type_series.
        if not numeric.astype('int64').astype(str).equals(prepared.astype(str)):
            return False

        # Exactly 0/1 is classified as BOOLEAN by the legacy implementation.
        return set(numeric.unique()) != {0, 1}

    if data_type is DataType.REAL:
        numeric = pd.to_numeric(prepared, errors='coerce')
        if numeric.isna().any():
            return False
        # Match the legacy MAX_SAFE_INTEGER guard. Values above this limit are
        # kept as TEXT to avoid precision loss when consumed by JavaScript.
        if numeric.gt(MAX_SAFE_INTEGER).any():
            return False
        if np.isinf(numeric).any():
            raw_inf = prepared.astype(str).str.strip().str.lower().isin({'inf', '-inf'})
            return bool(raw_inf[np.isinf(numeric)].all())
        return True

    if data_type is DataType.DATETIME:
        # Pandas accepts short date/time fragments that the legacy inference
        # classifies as TEXT. Keep datetime candidates on the exact fallback.
        return False

    if data_type is DataType.BOOLEAN:
        boolean_values = set(prepared.astype(str).str.strip().str.lower())
        return boolean_values in ({'0', '1'}, {'true', 'false'})

    # Locale-separated numeric formats have nuanced legacy rules; use the
    # compatibility fallback for those relatively uncommon candidates.
    return False


def _infer_data_type_from_full_sample(
    series: pd.Series,
    seed: pd.Series,
    *,
    is_show_raw_data: bool = False,
) -> int:
    """Infer from a small seed and validate against every row in the sample."""
    seed_prepared, _ = prepare_data_type_values(seed)
    candidate = gen_data_types_from_prepared(seed_prepared)

    if DataType(candidate) is DataType.TEXT and not seed_prepared.empty:
        seed_values = set(seed_prepared.astype(str).str.strip().str.lower())
        # A concrete TEXT value is terminal. A mixed non-text seed can also
        # collapse to TEXT, but a later datetime may change that legacy result.
        has_text_value = any(check_data_type(value) is DataType.TEXT for value in seed_prepared)
        seed_is_unconvertible = convert_df_str_to_others(seed_prepared) is seed_prepared
        if not seed_values.issubset({'true', 'false'}) and seed_is_unconvertible and has_text_value:
            return candidate

    prepared, raw_unique = prepare_data_type_values(series)
    if not seed_prepared.empty and _is_fast_data_type_candidate_valid(prepared, candidate):
        return candidate

    # Type inference only depends on distinct values. Normalizing the unique
    # set produces the same result as the full-column fallback while avoiding
    # repeated work for columns containing many duplicate values.
    normalized = _normalize_preview_dataframe(
        raw_unique.to_frame(),
        is_show_raw_data=is_show_raw_data,
    )[series.name]
    return gen_data_types_core(normalized)


def _normalize_dataframe_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Normalize only selected columns used by preview filtering."""
    existing_columns = [column for column in columns if column in df.columns]
    if not existing_columns:
        return df
    normalized = _normalize_preview_dataframe(df[existing_columns])
    df[existing_columns] = normalized
    return df


def _is_constant_series_including_na(series: pd.Series) -> bool:
    """Check whether all values are equal, treating missing values as a value."""
    if series.empty:
        return True

    first_value = series.iloc[0]
    if pd.isna(first_value):
        return bool(series.isna().all())
    return bool(series.notna().all() and series.eq(first_value).all())


# Column label used when flattening probe values into a single-column frame so a
# batched normalization can run in one pass.
PROBE_COLUMN = '__preview_probe__'


def _values_equal_including_na(first: Any, second: Any) -> bool:
    """Equality of two scalars, treating two missing values as equal."""
    first_na = pd.isna(first)
    second_na = pd.isna(second)
    if first_na or second_na:
        return bool(first_na and second_na)
    return bool(first == second)


def _check_same_values_with_deferred_normalization(
    df: pd.DataFrame,
    cols: list[str],
    *,
    is_show_raw_data: bool = False,
) -> list[dict[str, bool]]:
    """Match normalized same-value semantics without normalizing every cell."""
    # Vectorize the null and raw-uniqueness checks across every column at once.
    # Converting each column to string individually scaled with column count and
    # dominated preview runtime for wide datasets.
    df_target = df[cols]
    is_null_by_col = (df_target.isna() | df_target.eq(EMPTY_STRING)).all()
    raw_unique_counts = df_target.nunique(dropna=True)

    # Columns whose raw values already differ are the only collapse candidates.
    not_same_cols = [col for col in cols if raw_unique_counts[col] > 1]
    raw_unique_by_col: dict[str, pd.Series] = {}
    probe_values: list[Any] = []
    for col in not_same_cols:
        raw_unique = df_target[col].dropna().drop_duplicates()
        raw_unique_by_col[col] = raw_unique
        # Keep the first two distinct values as the collapse probe.
        probe_values.extend(raw_unique.to_numpy()[:2])

    # Normalize every probe value in a single flattened pass. Normalization is
    # per-cell, so flattening all columns' two-value probes into one series yields
    # the same per-value result while replacing thousands of per-column string
    # operations with a single vectorized call.
    collapsed_cols = []
    if probe_values:
        normalized_flat = _normalize_preview_dataframe(
            pd.DataFrame({PROBE_COLUMN: pd.Series(probe_values, dtype=pd.StringDtype())}),
            is_show_raw_data=is_show_raw_data,
        )[PROBE_COLUMN]
        normalized_pairs = normalized_flat.to_numpy().reshape(-1, 2)
        collapsed_cols = [
            col
            for col, (first, second) in zip(not_same_cols, normalized_pairs, strict=False)
            if _values_equal_including_na(first, second)
        ]

    # Only the rare columns whose probe collapsed need the full unique set checked.
    same_after_normalization = set()
    if collapsed_cols:
        full_values: list[Any] = []
        segments: list[tuple[str, int, int]] = []
        for col in collapsed_cols:
            raw_unique = raw_unique_by_col[col]
            start = len(full_values)
            full_values.extend(raw_unique.tolist())
            segments.append((col, start, len(full_values)))
        normalized_full = _normalize_preview_dataframe(
            pd.DataFrame({PROBE_COLUMN: pd.Series(full_values, dtype=pd.StringDtype())}),
            is_show_raw_data=is_show_raw_data,
        )[PROBE_COLUMN]
        for col, start, end in segments:
            if _is_constant_series_including_na(normalized_full.iloc[start:end]):
                same_after_normalization.add(col)

    same_values = []
    for col in cols:
        is_same = True if raw_unique_counts[col] <= 1 else col in same_after_normalization
        same_values.append({'is_null': bool(is_null_by_col[col]), 'is_same': is_same})

    return same_values


from ap.setting_module.services.process_config import get_process_columns
from ap.trace_data.transaction_model import TransactionData

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
    selected_columns: tuple[str, ...] | None = None,
    sort_column: str | None = None,
    sort_order: str = 'ASC',
    optional_cache_config: OptionalCacheConfig | None = None,
    refresh_preview: bool = False,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    if data_source.type in [
        DBType.POSTGRES_SOFTWARE_WORKSHOP.name,
        DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name,
    ]:
        return get_info_from_db_software_workshop(
            data_source.id,
            process_factid,
            sql_limit=sql_limit,
            master_type=master_type,
            sort_column=sort_column,
            sort_order=sort_order,
        )
    if refresh_preview:
        optional_cache_config = OptionalCacheConfig(override=True)
    return get_info_from_db_normal(
        data_source.id,
        table_name,
        sql_limit,
        selected_columns=selected_columns,
        optional_cache_config=optional_cache_config,
    )


@CustomCache.memoize(duration=300)
def get_info_from_db_normal(
    data_source_id: int,
    table_name: str,
    sql_limit: int = 2000,
    selected_columns: tuple[str, ...] | None = None,
) -> tuple[list[str], pd.DataFrame, dict[str, str]]:
    data_source: CfgDataSource = CfgDataSource.query.get(data_source_id)
    with ReadOnlyDbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return [], pd.DataFrame(), {}

        select_columns = '*'
        if selected_columns:
            available_columns = [column['name'] for column in db_instance.list_table_columns(table_name)]
            unknown_columns = set(selected_columns) - set(available_columns)
            if unknown_columns:
                raise ValueError(f'Unknown columns requested for preview: {sorted(unknown_columns)}')
            normalized_selected = {normalize_str(column) for column in selected_columns}
            projected_columns = [
                column
                for column in available_columns
                if column in selected_columns or normalize_str(column) in normalized_selected
            ]
            select_columns = gen_select_col_str(projected_columns)
        quoted_table_name = add_double_quote(table_name)

        if isinstance(db_instance, mssqlserver.MSSQLServer):
            # Cast non-Unicode char/varchar/text columns to NVARCHAR so the
            # pymssql client returns Unicode instead of code-page bytes, which
            # otherwise arrive as mojibake for non-ASCII (e.g. CP932) data.
            mssql_select_columns = db_instance.gen_preview_select_columns(
                table_name,
                column_names=projected_columns if selected_columns else None,
            )
            cols, rows = db_instance.run_sql(
                f'select TOP {sql_limit} {mssql_select_columns} from {quoted_table_name}',
                False,
            )
        elif isinstance(db_instance, oracle.Oracle):
            cols, rows = db_instance.run_sql(
                f'select {select_columns} from {quoted_table_name} where rownum <= {sql_limit}',
                False,
            )
        else:
            cols, rows = db_instance.run_sql(
                f'select {select_columns} from {quoted_table_name} limit {sql_limit}',
                False,
            )

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
    selected_columns: list[str] | None = None,
    auto_encoding: bool | None = None,
):
    if is_transpose:
        # Physical rows become sensor columns, so the display-row cap must not limit this read.
        read_limit = n_rows or DATA_TYPE_ESTIMATION_LIMIT
        limit_includes_header = True
    else:
        configured_limits = [value for value in (n_rows, max_records) if value]
        read_limit = min(configured_limits) if configured_limits else DATA_TYPE_ESTIMATION_LIMIT
        limit_includes_header = bool(n_rows and read_limit == n_rows)
    file_reader = StructuredFileReader(
        filenames=sorted_files,
        delimiter=csv_delimiter,
        encoding=encoding,
        auto_encoding=auto_encoding,
        skip_head=skip_head,
        is_transpose=is_transpose,
        max_results=max_records,
        limit=read_limit,
        etl_func=etl_func,
        is_file_checker=is_file_checker,
        encoding_verify_limit=read_limit,
        selected_columns=selected_columns,
        limit_includes_header=limit_includes_header,
    )
    header, data = file_reader.read()
    if not header and not data:
        raise ValueError('Cannot get headers_name and data_details')

    preview_data = list(get_result(file_reader, is_file_checker=file_reader.is_file_checker))
    if max_records:
        # Dummy-header generation restores the first source row to the preview data.
        preview_data[4] = preview_data[4][:max_records]
    if file_reader.projected_dummy_headers:
        preview_data[0] = file_reader.projected_dummy_headers
        preview_data[1] = file_reader.projected_dummy_headers
        preview_data[5] = [True] * len(file_reader.projected_dummy_headers)
    return (*preview_data,)


def clean_na_columns(col_data):
    """Clean NA values in df for preview in table"""
    if pd.api.types.is_string_dtype(col_data):
        mask = np.fromiter(
            (str(value).lower() in _PREVIEW_NA_VALUES for value in col_data.array),
            dtype=bool,
            count=len(col_data),
        )
        if mask.any():
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
    fast_preview=False,
    selected_columns: list[str] | None = None,
    file_name_include=None,
    file_name_exclude=None,
    subfolder_include=None,
    subfolder_exclude=None,
    auto_encoding: bool | None = None,
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
            file_name_samples = [os.path.basename(path) for path in sorted_files[:PREVIEW_DISPLAY_LIMIT]]
            sorted_files = sorted_files[0:5]
        else:
            sorted_files = [file_name]
            file_name_samples = [os.path.basename(file_name)]

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
                'file_name_samples': file_name_samples,
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
                    auto_encoding=auto_encoding,
                    selected_columns=selected_columns,
                )
            except Exception:
                logger.exception('Failed to read CSV preview files: {}', preview_file_group)
                continue

            if data_details:
                csv_file = preview_file_group[0]
                break

        # Keep deferred normalization internal to dataframe-based preview callers.
        # List callers expect preview_csv_data to return fully normalized values.
        use_fast_inference = bool(fast_preview and return_df)
        inference_limit = min(limit, PREVIEW_DISPLAY_LIMIT) if use_fast_inference else limit

        # normalize data detail
        df_data_details, org_headers, header_names, dupl_cols, data_types = extract_data_detail(
            header_names,
            data_details,
            org_header,
            is_show_raw_data=is_show_raw_data,
            fast_preview=use_fast_inference,
            preview_limit=inference_limit,
        )
        needs_value_normalization = use_fast_inference
        has_ct_col = True
        dummy_datetime_idx = None
        file_name_col_idx = None
        if df_data_details is not None:
            # The full frame is already normalized when it fits inside the inference seed.
            needs_value_normalization = use_fast_inference and len(df_data_details) > inference_limit
            if needs_value_normalization:
                # Downstream datetime validation and generated columns consume
                # normalized values, as they did before the inference seed was capped.
                df_data_details = _normalize_preview_dataframe(
                    df_data_details,
                    is_show_raw_data=is_show_raw_data,
                )
                needs_value_normalization = False
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

            if use_fast_inference:
                same_values = _check_same_values_with_deferred_normalization(
                    df_data_details,
                    header_names,
                    is_show_raw_data=is_show_raw_data,
                )
            else:
                same_values = check_same_values_in_df(df_data_details, header_names)

            if not needs_value_normalization:
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
            'file_name_samples': file_name_samples,
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
            'deferred_value_normalization': needs_value_normalization,
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
    file_name_samples = [
        os.path.basename(path)
        for path in (get_sorted_files(folder_url) if not file_name else sorted_files)[:PREVIEW_DISPLAY_LIMIT]
    ]
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
            'file_name_samples': file_name_samples,
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
                'file_name_samples': file_name_samples,
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
                data_details = data_details[:limit]
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
                        max_results=min(limit, PREVIEW_EXTERNAL_ANALYSIS_LIMIT),
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
        data_types = [gen_data_types_core(df_data_details[col], is_v2=True) for col in header_names]
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
                data_types = [gen_data_types_core(df_data_details[col], is_v2=True) for col in header_names]

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
            'file_name_samples': file_name_samples,
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
        column = df[col]
        # See: https://docs.astral.sh/ruff/rules/pandas-nunique-constant-series-check/
        # Actually, we don't care NA value here
        # Filter before converting: nullable integers would otherwise become floats
        # and distinct large integers could compare equal.
        values = column.array
        value = values[~pd.isna(values)].to_numpy()
        if isinstance(column.dtype, pd.StringDtype):
            is_null = bool((value == EMPTY_STRING).all())
        elif pd.api.types.is_numeric_dtype(column.dtype):
            is_null = value.size == 0
        else:
            df_string = column.astype(pd.StringDtype())
            is_null = bool(((df_string == EMPTY_STRING) | df_string.isna()).all())
        is_same = value.shape[0] == 0 or (value[0] == value).all()

        same_values.append({'is_null': is_null, 'is_same': bool(is_same)})

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
    extracted_units_by_col = []
    for mapped_col_name in mapped_col_names:
        column_name_extracted, unit = ColumnRawNameRule.extract_data(mapped_col_name)
        extracted_units_by_col.append((mapped_col_name, column_name_extracted, unit))

    extracted_units = {unit for *_col_names, unit in extracted_units_by_col if unit}
    normalized_units = {unicodedata.normalize(NORMALIZE_FORM_NFKC, unit) for unit in extracted_units}
    unit_candidates = extracted_units | normalized_units
    valid_units = (
        {unit for (unit,) in MUnit.query.with_entities(MUnit.unit).filter(MUnit.unit.in_(unit_candidates)).all()}
        if unit_candidates
        else set()
    )

    extracted_col_names, units = [], []
    for mapped_col_name, column_name_extracted, unit in extracted_units_by_col:
        resolved_col_name = column_name_extracted
        resolved_unit = unit
        if resolved_unit:
            normalized_unit = unicodedata.normalize(NORMALIZE_FORM_NFKC, resolved_unit)
            if resolved_unit not in valid_units and normalized_unit not in valid_units:
                resolved_unit = ''
                resolved_col_name, _ = ColumnRawNameRule.extract_data(mapped_col_name, unit_remove=False)
        extracted_col_names.append(resolved_col_name)
        units.append(resolved_unit)

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
def extract_data_detail(
    header_names,
    data_details,
    org_header=None,
    is_show_raw_data=False,
    fast_preview=False,
    preview_limit=10,
):
    org_headers = org_header or header_names.copy()
    # normalization
    header_names = normalize_list(header_names)
    header_names = [normalize_str(col) for col in header_names]
    header_names, dupl_cols = gen_colsname_for_duplicated(header_names)
    if fast_preview:
        # Keep the inference frame as a single object block. ``convert_dtypes``
        # splits it into one nullable ExtensionArray block per column, which makes
        # the head writeback and per-column reads scale with column count. Type
        # inference below reads unique string values, so the nullable dtypes add
        # cost without changing the inferred types.
        df_data_details = pd.DataFrame(data_details, columns=header_names)

        normalized_seed = _normalize_preview_dataframe(
            df_data_details.head(preview_limit).copy(),
            is_show_raw_data=is_show_raw_data,
        )
        if not normalized_seed.empty:
            # ``.loc[index, column_labels] = frame`` aligns the RHS on both axes.
            # With thousands of preview columns that per-label alignment dominates
            # runtime. The seed shares the frame's row positions and column order,
            # so assign positionally with a raw ndarray to skip alignment while
            # producing the same head-normalized values.
            df_data_details.iloc[: len(normalized_seed)] = normalized_seed.to_numpy()

        data_types = [
            _infer_data_type_from_full_sample(
                df_data_details[col],
                normalized_seed[col],
                is_show_raw_data=is_show_raw_data,
            )
            for col in header_names
        ]
    else:
        df_data_details = normalize_big_rows(
            data_details,
            header_names,
            is_show_raw_data=is_show_raw_data,
        )
        data_types = [gen_data_types_core(df_data_details[col]) for col in header_names]
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


def build_representative_preview_sample(
    dataframe: pd.DataFrame,
    columns_metadata: list[dict[str, Any]],
) -> pd.DataFrame:
    """Keep one representative row per non-main column combination.

    Main time/serial columns remain in the result but are deliberately omitted
    from the duplicate key for representative samples, so differing timestamps
    or serial values alone do not prevent equivalent source rows from
    collapsing. Analysis snapshots and normal display rows retain duplicates
    to preserve response and percentile parity.
    """
    main_column_types = {
        DataColumnType.DATETIME.value,
        DataColumnType.MAIN_DATE.value,
        DataColumnType.MAIN_TIME.value,
        DataColumnType.MAIN_SERIAL.value,
    }
    duplicate_key_columns = [
        column['column_name']
        for column in columns_metadata
        if column['column_name'] in dataframe.columns and not _is_main_preview_column(column, main_column_types)
    ]
    if not duplicate_key_columns:
        return dataframe
    return dataframe.drop_duplicates(subset=duplicate_key_columns, keep='first').reset_index(drop=True)


def _is_main_preview_column(column: dict[str, Any], main_column_types: set[int]) -> bool:
    return bool(
        column.get('is_get_date')
        or column.get('is_dummy_datetime')
        or column.get('is_main_datetime')
        or column.get('is_main_date')
        or column.get('is_main_time')
        or column.get('is_main_serial_no')
        or column.get('is_main_serial')
        or column.get(ProcessColumnConst.COLUMN_TYPE.value) in main_column_types
    )


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
        data, _ = convert_numeric_by_type_core(data, DataType.REAL.name)
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
        data, _ = convert_numeric_by_type_core(data, DataType.INTEGER.name)
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
        data, _ = convert_numeric_by_type_core(data, DataType.INTEGER.name)
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
    if data_source.type == DBType.WEB_API.name:
        # WebAPI.get_data() performs the authenticated validation and fetch in one request.
        return True
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
