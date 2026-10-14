from __future__ import annotations

from datetime import UTC, datetime

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
    read_preview,
)
from ap.api.setting_module.services.show_latest_record import create_external_preview
from ap.common.constants import PREVIEW_SCHEMA_VERSION, DataColumnType
from ap.common.pydn.dblib.transaction import TxnDataConnection
from ap.trace_data.transaction_model import TransactionData


def resolve_preview_dataset(
    context: PreviewRequestContext,
    *,
    projected_columns: tuple[str, ...] = (),
    include_main_date_time: bool = False,
    include_transaction_functions: bool = False,
    dependency_raw_column_names: tuple[str, ...] = (),
    generate_if_missing: bool = False,
) -> PreviewDataset | None:
    """Resolve a normal preview, preferring cached local data over the source.

    A registered process reads Internal data, then its Process Parquet, then the
    external source. An unregistered configuration (no ``process_id``) serves its
    cached datasource preview before the external source. ``generate_if_missing``
    permits that external fallback; sample sub-queries leave it unset so they never
    touch the source. ``None`` means there is no usable preview and none was generated.
    Process Link opts into persisted function columns with ``include_transaction_functions``.
    """
    if context.refresh_preview:
        return create_external_preview(context)
    if context.process_id is None:
        # Unregistered configuration screen. Prefer a cached datasource preview.
        if context.data_source_id is None:
            return None
        location_fingerprint = build_datasource_location_fingerprint(context)
        datasource_path = get_datasource_preview_path(context, location_fingerprint)
        try:
            cached_dataset = read_preview(datasource_path, location_fingerprint, columns=projected_columns)
        except PreviewStorageError:
            cached_dataset = None
        if cached_dataset is not None:
            return cached_dataset
        if not generate_if_missing:
            # Sample sub-queries (function/unique) must stay local-only.
            return None
        # First cold open of the main preview: read the source exactly once,
        # generate the preview, and persist it under the location fingerprint so
        # every later normal open reuses the cache. Only Preview Update refreshes.
        return create_external_preview(context)

    try:
        transaction_data = TransactionData(context.process_id)
        full_columns_metadata = transaction_data.get_preview_column_metadata()
        process_columns = _select_process_columns(
            transaction_data,
            projected_columns,
            include_main_date_time=include_main_date_time,
            include_transaction_functions=include_transaction_functions,
            dependency_raw_column_names=dependency_raw_column_names,
        )
        resolved_projected_columns = tuple(column.column_name for column in process_columns)
        bridge_column_names = tuple(column.bridge_column_name for column in process_columns)
        columns_metadata = transaction_data.get_preview_column_metadata(bridge_column_names)
        fingerprint = _build_process_preview_fingerprint(context, full_columns_metadata)
        internal_dataset = _load_internal_preview_dataset(
            context,
            transaction_data,
            bridge_column_names,
            columns_metadata,
            fingerprint,
        )
    except PreviewSourceError:
        raise
    except Exception as error:
        raise PreviewSourceError(f'Unable to load Internal preview for Process {context.process_id}') from error
    if internal_dataset is not None:
        return internal_dataset

    if context.data_source_id is None:
        return None
    preview_path = get_process_preview_path(context.data_source_id, context.process_id)
    parquet_columns = resolved_projected_columns if projected_columns else ()
    try:
        parquet_dataset = read_preview(preview_path, fingerprint, columns=parquet_columns)
    except PreviewStorageError:
        parquet_dataset = None
    if parquet_dataset is not None:
        return parquet_dataset
    if not generate_if_missing:
        return None
    return create_external_preview(context)


def _select_process_columns(
    transaction_data: TransactionData,
    projected_columns: tuple[str, ...],
    *,
    include_main_date_time: bool = False,
    include_transaction_functions: bool = False,
    dependency_raw_column_names: tuple[str, ...] = (),
):
    process_columns = (
        transaction_data.get_preview_process_columns(include_transaction_functions=True)
        if include_transaction_functions
        else transaction_data.get_preview_process_columns()
    )
    if not projected_columns:
        return process_columns
    process_columns_by_name = {column.column_name: column for column in process_columns}
    unknown_columns = set(projected_columns) - set(process_columns_by_name)
    if unknown_columns:
        raise ValueError(f'Unknown Process preview columns: {sorted(unknown_columns)}')
    selected_column_names = list(projected_columns)
    dependency_raw_column_name_set = set(dependency_raw_column_names)
    for column in process_columns:
        is_main_date_or_time = getattr(column, 'column_type', None) in {
            DataColumnType.MAIN_DATE.value,
            DataColumnType.MAIN_TIME.value,
        }
        is_filter_dependency = getattr(column, 'column_raw_name', None) in dependency_raw_column_name_set
        if (include_main_date_time and is_main_date_or_time) or is_filter_dependency:
            selected_column_names.append(column.column_name)
    return [process_columns_by_name[column_name] for column_name in dict.fromkeys(selected_column_names)]


def _load_internal_preview_dataset(
    context: PreviewRequestContext,
    transaction_data: TransactionData,
    bridge_column_names: tuple[str, ...],
    columns_metadata: list[dict],
    fingerprint: str,
) -> PreviewDataset | None:
    with TxnDataConnection(process_id=transaction_data.process_id, readonly_transaction=True) as data_con:
        availability = transaction_data.get_preview_table_availability(data_con)
        if not availability.table_exists or not availability.has_rows:
            return None
        record_limit = transaction_data.get_preview_record_limit(data_con)
        dataframe = transaction_data.get_preview_latest_records(
            data_con,
            limit=record_limit,
            column_names=bridge_column_names,
        )
    dataframe = transaction_data.map_preview_dataframe_to_process_columns(dataframe, bridge_column_names)
    timestamp = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
    dummy_datetime_idx = next(
        (index for index, column in enumerate(columns_metadata) if column.get('is_dummy_datetime')),
        None,
    )
    metadata = PreviewMetadata(
        schema_version=PREVIEW_SCHEMA_VERSION,
        source_kind=PreviewSourceKind.INTERNAL,
        origin_source_kind=PreviewSourceKind.INTERNAL,
        processing_stage=PreviewProcessingStage.IMPORTED,
        fingerprint=fingerprint,
        data_source_id=context.data_source_id,
        process_id=context.process_id,
        created_at=timestamp,
        refreshed_at=timestamp,
        row_count=len(dataframe),
        column_count=len(dataframe.columns),
        columns=columns_metadata,
        cols_duplicated=False,
        previewed_files=None,
        has_ct_col=any(column.get('is_get_date') for column in columns_metadata),
        dummy_datetime_idx=dummy_datetime_idx,
        is_rdb=False,
        file_name_col_idx=None,
    )
    return PreviewDataset(dataframe=dataframe, metadata=metadata)


def _build_process_preview_fingerprint(
    context: PreviewRequestContext,
    columns_metadata: list[dict],
) -> str:
    return build_preview_fingerprint(
        context,
        source_type='process',
        selected_columns=tuple(column['column_name'] for column in columns_metadata),
        process_column_configurations=columns_metadata,
    )
