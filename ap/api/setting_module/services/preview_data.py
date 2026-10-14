from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import Enum, StrEnum
from hashlib import sha256
from typing import Any

import pandas as pd

from ap.common.constants import PREVIEW_SCHEMA_VERSION, MasterDBType


class PreviewSourceKind(StrEnum):
    """Physical source used to provide preview data."""

    INTERNAL = 'internal'
    PARQUET = 'parquet'
    EXTERNAL = 'external'


class PreviewProcessingStage(StrEnum):
    """Processing completed before the preview dataset is made available."""

    IMPORTED = 'imported'
    PREPARED = 'prepared'


class PreviewSourceError(Exception):
    """Raised when a configured Internal or external preview source fails."""


class PreviewStorageError(Exception):
    """Raised when an expected Preview Parquet cannot be read or written."""


@dataclass(frozen=True)
class PreviewRequestContext:
    """Configuration and request intent needed to resolve a preview dataset."""

    data_source_id: int | None
    process_id: int | None
    table_name: str | None
    file_name: str | None
    directory: str | None
    process_factid: str | None
    master_type: MasterDBType | None
    etl_func: str
    import_filter: dict[str, Any]
    api_url: str | None
    encoding: str | None
    delimiter: str | None
    is_v2_datasource: bool
    filtered_process_name: str | None
    requested_column_names: tuple[str, ...]
    requested_raw_column_names: tuple[str, ...]
    refresh_preview: bool
    auto_encoding: bool | None = None


def parse_refresh_preview(value: Any) -> bool:
    """Return true only for the form value ``true``, case-insensitively."""
    return isinstance(value, str) and value.casefold() == 'true'


def build_preview_fingerprint(
    context: PreviewRequestContext,
    *,
    source_type: str,
    source_settings: Mapping[str, Any] | None = None,
    selected_columns: Sequence[str] | None = None,
    process_column_configurations: Sequence[Mapping[str, Any]] = (),
    generated_datetime_dependencies: Mapping[str, Any] | Sequence[Any] = (),
    inferred_columns: Sequence[Mapping[str, Any]] = (),
) -> str:
    """Build a stable SHA-256 fingerprint for prepared preview configuration.

    ``inferred_columns`` is supplied only after the initial external analysis;
    registered Process callers instead supply committed column configuration.
    """
    payload = {
        'preview_schema_version': PREVIEW_SCHEMA_VERSION,
        'source': {
            'type': source_type,
            'data_source_id': context.data_source_id,
            'process_id': context.process_id,
            'table_name': context.table_name,
            'file_name': context.file_name,
            'directory': context.directory,
            'process_factid': context.process_factid,
            'master_type': context.master_type,
            'api_url': context.api_url,
            'is_v2_datasource': context.is_v2_datasource,
            'settings': dict(source_settings or {}),
        },
        'processing': {
            'etl_func': context.etl_func,
            'import_filter': context.import_filter,
            'encoding': context.encoding,
            'delimiter': context.delimiter,
            'filtered_process_name': context.filtered_process_name,
            'generated_datetime_dependencies': generated_datetime_dependencies,
        },
        'selected_columns': tuple(
            selected_columns
            if selected_columns is not None
            else context.requested_raw_column_names or context.requested_column_names
        ),
        'process_column_configurations': tuple(process_column_configurations),
        'inferred_columns': tuple(inferred_columns),
    }
    digest = sha256()
    _hash_typed_value(digest, payload)
    return digest.hexdigest()


def build_datasource_location_fingerprint(context: PreviewRequestContext) -> str:
    """Build a request-only fingerprint that locates a datasource preview.

    Unlike :func:`build_preview_fingerprint`, this deliberately excludes any
    column information discovered by reading the source, so a cold (non-refresh)
    open can recompute the same value without touching the external database.
    It is process-independent, so the unregistered configuration screen and the
    registration-time promotion resolve the same cached datasource preview.
    """
    payload = {
        'preview_schema_version': PREVIEW_SCHEMA_VERSION,
        'kind': 'datasource-location',
        'data_source_id': context.data_source_id,
        'table_name': context.table_name,
        'file_name': context.file_name,
        'directory': context.directory,
        'process_factid': context.process_factid,
        'master_type': context.master_type,
        'api_url': context.api_url,
        'etl_func': context.etl_func,
        'import_filter': context.import_filter,
        'delimiter': context.delimiter,
    }
    digest = sha256()
    _hash_typed_value(digest, payload)
    return digest.hexdigest()


def _hash_typed_value(digest: Any, value: Any) -> None:
    if value is None:
        _hash_token(digest, b'none')
    elif isinstance(value, Enum):
        enum_type = f'{type(value).__module__}.{type(value).__qualname__}'.encode()
        _hash_token(digest, b'enum', enum_type, str(value.value).encode())
    elif isinstance(value, bool):
        _hash_token(digest, b'bool', b'1' if value else b'0')
    elif isinstance(value, int):
        _hash_token(digest, b'int', str(value).encode())
    elif isinstance(value, float):
        _hash_token(digest, b'float', value.hex().encode())
    elif isinstance(value, str):
        _hash_token(digest, b'str', value.encode())
    elif isinstance(value, bytes):
        _hash_token(digest, b'bytes', value)
    elif isinstance(value, Mapping):
        if not all(isinstance(key, str) for key in value):
            raise TypeError('Preview fingerprint dictionaries must use string keys')
        _hash_token(digest, b'dict', str(len(value)).encode())
        for key in sorted(value):
            _hash_typed_value(digest, key)
            _hash_typed_value(digest, value[key])
    elif isinstance(value, list):
        _hash_token(digest, b'list', str(len(value)).encode())
        for item in value:
            _hash_typed_value(digest, item)
    elif isinstance(value, tuple):
        _hash_token(digest, b'tuple', str(len(value)).encode())
        for item in value:
            _hash_typed_value(digest, item)
    else:
        raise TypeError(f'Unsupported Preview fingerprint value: {type(value).__qualname__}')


def _hash_token(digest: Any, *parts: bytes) -> None:
    for part in parts:
        digest.update(len(part).to_bytes(8, byteorder='big'))
        digest.update(part)


@dataclass
class PreviewMetadata:
    """Metadata describing a prepared preview dataset."""

    schema_version: int
    source_kind: PreviewSourceKind
    origin_source_kind: PreviewSourceKind
    processing_stage: PreviewProcessingStage
    fingerprint: str
    data_source_id: int | None
    process_id: int | None
    created_at: str
    refreshed_at: str
    row_count: int
    column_count: int
    columns: list[dict[str, Any]]
    cols_duplicated: bool
    previewed_files: list[str] | None
    has_ct_col: bool | None
    dummy_datetime_idx: int | None
    is_rdb: bool
    file_name_col_idx: int | None
    legacy_migrated: int = 0
    # Datasource schema captured before a Process preview is narrowed or renamed.
    source_column_names: list[str] | None = None
    # A refresh keeps the registered schema baseline until the Process is re-registered.
    is_refresh_preview: bool = False
    file_name_samples: list[str] | None = None
    generation: str | None = None


@dataclass
class PreviewDataset:
    """The full analysis DataFrame and its preview lifecycle metadata."""

    dataframe: pd.DataFrame
    metadata: PreviewMetadata
