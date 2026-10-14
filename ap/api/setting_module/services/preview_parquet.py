from __future__ import annotations

import json
import re
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from filelock import FileLock
from loguru import logger

from ap.api.setting_module.services.preview_data import (
    PreviewDataset,
    PreviewMetadata,
    PreviewProcessingStage,
    PreviewRequestContext,
    PreviewSourceKind,
    PreviewStorageError,
    build_datasource_location_fingerprint,
)
from ap.common.constants import PREVIEW_SCHEMA_VERSION
from ap.common.path_utils import get_preview_data_file_folder, get_preview_data_path

_FINGERPRINT_PATTERN = re.compile(r'[0-9a-f]{64}\Z')
_PENDING_PREVIEW_TOKEN_PATTERN = re.compile(r'[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}\Z')
_FINGERPRINT_PREFIX_LENGTH = 16
# Wide previews embed field metadata in the serialized Arrow schema.
_THRIFT_STRING_SIZE_LIMIT = 256 * 1024 * 1024
_FILE_METADATA_PREFIX = 'ap.preview.'
_COLUMN_METADATA_PREFIX = 'ap.preview.col.'
_NON_PERSISTED_COLUMN_METADATA = frozenset({'fail_limit'})
_COLUMN_METADATA_PAYLOAD_KEY = f'{_COLUMN_METADATA_PREFIX}metadata'.encode()
_FILE_BOOLEAN_KEYS = frozenset({'cols_duplicated', 'has_ct_col', 'is_rdb', 'is_refresh_preview'})
_FILE_INTEGER_KEYS = frozenset(
    {
        'schema_version',
        'data_source_id',
        'process_id',
        'row_count',
        'column_count',
        'dummy_datetime_idx',
        'file_name_col_idx',
        'previewed_file_count',
        'legacy_migrated',
    },
)


def get_datasource_preview_path(context: PreviewRequestContext, fingerprint: str) -> Path:
    """Return the stable Parquet path for a registered datasource preview."""
    data_source_id = _require_identifier(context.data_source_id, 'data_source_id')
    _validate_fingerprint(fingerprint)
    folder = Path(get_preview_data_file_folder(data_source_id))
    return folder / f'datasource_{fingerprint[:_FINGERPRINT_PREFIX_LENGTH]}.parquet'


def get_process_preview_path(data_source_id: int, process_id: int) -> Path:
    """Return the stable Parquet path for a registered Process preview."""
    data_source_id = _require_identifier(data_source_id, 'data_source_id')
    process_id = _require_identifier(process_id, 'process_id')
    folder = Path(get_preview_data_file_folder(data_source_id))
    return folder / f'process_{process_id}.parquet'


def get_pending_preview_path(preview_token: str) -> Path:
    """Return the pending-preview path for a server-generated UUID4 hex token."""
    if not _PENDING_PREVIEW_TOKEN_PATTERN.fullmatch(preview_token):
        raise ValueError('preview_token must be a UUID4 hexadecimal string')
    return Path(get_preview_data_path()) / '_pending' / f'{preview_token}.parquet'


def get_generation_preview_path(context: PreviewRequestContext) -> Path:
    """Return the stable current-response snapshot path for a preview context."""
    if context.data_source_id is not None:
        folder = Path(get_preview_data_file_folder(_require_identifier(context.data_source_id, 'data_source_id')))
    else:
        folder = Path(get_preview_data_path()) / '_current'
    if context.process_id is not None:
        return folder / f'current_process_{_require_identifier(context.process_id, "process_id")}.parquet'
    if context.data_source_id is not None:
        return folder / f'current_datasource_{context.data_source_id}.parquet'
    fingerprint = build_datasource_location_fingerprint(context)
    return folder / f'current_request_{fingerprint[:_FINGERPRINT_PREFIX_LENGTH]}.parquet'


def read_pending_preview(preview_token: str) -> PreviewDataset | None:
    """Read a server-created pending preview using its stored fingerprint."""
    path = get_pending_preview_path(preview_token)
    try:
        with _open_preview_parquet(path) as parquet_file:
            fingerprint = (parquet_file.schema_arrow.metadata or {}).get(f'{_FILE_METADATA_PREFIX}fingerprint'.encode())
    except OSError as error:
        raise PreviewStorageError(f'Unable to read pending Preview Parquet: {path}') from error
    except pa.ArrowException as error:
        raise PreviewStorageError(f'Unable to read pending Preview Parquet: {path}') from error
    if fingerprint is None:
        return None
    try:
        return read_preview(path, fingerprint.decode())
    except UnicodeDecodeError:
        return None


def read_stored_preview(path: Path, columns: tuple[str, ...] = ()) -> PreviewDataset | None:
    """Read a Preview Parquet using the fingerprint stored in its footer.

    Process Preview files have a stable path.  This helper still routes through
    :func:`read_preview`, so schema version, processing stage, row count and
    column metadata are validated before any data is returned.
    """
    try:
        if not path.is_file():
            return None
        with _open_preview_parquet(path) as parquet_file:
            fingerprint = (parquet_file.schema_arrow.metadata or {}).get(f'{_FILE_METADATA_PREFIX}fingerprint'.encode())
    except OSError as error:
        raise PreviewStorageError(f'Unable to read Preview Parquet: {path}') from error
    except pa.ArrowException as error:
        raise PreviewStorageError(f'Unable to read Preview Parquet: {path}') from error
    if fingerprint is None:
        return None
    try:
        return read_preview(path, fingerprint.decode(), columns=columns)
    except UnicodeDecodeError:
        return None


def write_dataframe_to_parquet(dataframe: pd.DataFrame, path: Path) -> None:
    """Write a preview DataFrame directly to a gzip-compressed Parquet file.

    The caller supplies a staging path when replacement must be atomic.  Arrow is
    constructed directly from Pandas so text columns retain their source values.
    """
    _write_arrow_table(dataframe_to_arrow_table(dataframe), path)


def dataframe_to_arrow_table(dataframe: pd.DataFrame, metadata: PreviewMetadata | None = None) -> pa.Table:
    """Convert a preview DataFrame directly to an Arrow table without an index."""
    table = pa.Table.from_pandas(dataframe, preserve_index=False)
    return _attach_preview_metadata(table, metadata) if metadata is not None else table


def write_preview_atomic(path: Path, dataset: PreviewDataset) -> None:
    """Atomically replace a Preview Parquet only after its temporary file validates."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f'{path.name}.{uuid4().hex}.tmp')
    table = dataframe_to_arrow_table(dataset.dataframe, dataset.metadata)

    try:
        with FileLock(f'{path}.lock', timeout=30):
            _write_arrow_table(table, temporary_path)
            _validate_parquet_file(temporary_path, table)
            temporary_path.replace(path)
    except Exception:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            logger.exception('Unable to remove temporary Preview Parquet: {}', temporary_path)
        raise


def write_generation_preview(
    context: PreviewRequestContext,
    dataset: PreviewDataset,
    generation: str,
) -> Path:
    """Atomically publish the dataset selected for one main-preview response."""
    _validate_generation(generation)
    path = get_generation_preview_path(context)
    write_preview_atomic(path, replace(dataset, metadata=replace(dataset.metadata, generation=generation)))
    return path


def read_generation_preview(
    context: PreviewRequestContext,
    generation: str,
    columns: tuple[str, ...] = (),
) -> PreviewDataset | None:
    """Read one matching generation from a single open Parquet handle."""
    _validate_generation(generation)
    path = get_generation_preview_path(context)
    try:
        if not path.is_file():
            return None
        with (
            pa.BufferReader(path.read_bytes()) as source,
            pq.ParquetFile(source, thrift_string_size_limit=_THRIFT_STRING_SIZE_LIMIT) as parquet_file,
        ):
            raw_metadata = parquet_file.schema_arrow.metadata or {}
            stored_generation = raw_metadata.get(f'{_FILE_METADATA_PREFIX}generation'.encode())
            fingerprint = raw_metadata.get(f'{_FILE_METADATA_PREFIX}fingerprint'.encode())
            if stored_generation is None or fingerprint is None or stored_generation.decode() != generation:
                return None
            metadata = _deserialize_preview_metadata(
                parquet_file,
                fingerprint.decode(),
                columns,
                allowed_processing_stages=(PreviewProcessingStage.PREPARED, PreviewProcessingStage.IMPORTED),
            )
            if metadata is None or metadata.generation != generation:
                return None
            table = parquet_file.read(columns=list(columns) or None)
    except (OSError, pa.ArrowException) as error:
        raise PreviewStorageError(f'Unable to read generation Preview Parquet: {path}') from error
    except UnicodeDecodeError:
        return None
    return PreviewDataset(dataframe=table.to_pandas(), metadata=metadata)


def rewrite_process_preview(
    source_dataset: PreviewDataset,
    path: Path,
    *,
    data_source_id: int,
    process_id: int,
    fingerprint: str,
    columns: list[dict[str, object]],
) -> PreviewDataset:
    """Rewrite a datasource or pending preview into a Process-specific Parquet."""
    _require_identifier(data_source_id, 'data_source_id')
    _require_identifier(process_id, 'process_id')
    _validate_fingerprint(fingerprint)

    source_columns_by_name = {column['column_name']: column for column in source_dataset.metadata.columns}
    source_columns_by_raw_name: dict[str, list[dict[str, object]]] = {}
    for source_column in source_dataset.metadata.columns:
        source_column_key = source_column.get('column_raw_name') or source_column['column_name']
        source_columns_by_raw_name.setdefault(source_column_key, []).append(source_column)

    used_source_column_names: set[str] = set()
    source_column_names = []
    process_columns = []
    for column in columns:
        source_column_key = column.get('column_raw_name') or column['column_name']
        source_column = source_columns_by_name.get(column['column_name'])
        if source_column is not None and source_column['column_name'] in used_source_column_names:
            source_column = None
        if source_column is None:
            source_column = next(
                (
                    candidate
                    for candidate in source_columns_by_raw_name.get(source_column_key, [])
                    if candidate['column_name'] not in used_source_column_names
                ),
                None,
            )
        if source_column is None:
            raise ValueError(f'Preview data is missing Process column: {column["column_name"]}')
        source_column_names.append(source_column['column_name'])
        used_source_column_names.add(source_column['column_name'])
        process_columns.append({**source_column, **column})

    dataframe = source_dataset.dataframe.loc[:, source_column_names].copy()
    dataframe.columns = [column['column_name'] for column in columns]
    timestamp = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
    process_dataset = PreviewDataset(
        dataframe=dataframe,
        metadata=PreviewMetadata(
            schema_version=source_dataset.metadata.schema_version,
            source_kind=PreviewSourceKind.PARQUET,
            origin_source_kind=source_dataset.metadata.origin_source_kind,
            processing_stage=PreviewProcessingStage.PREPARED,
            fingerprint=fingerprint,
            data_source_id=data_source_id,
            process_id=process_id,
            created_at=timestamp,
            refreshed_at=timestamp,
            row_count=len(dataframe),
            column_count=len(dataframe.columns),
            columns=process_columns,
            cols_duplicated=source_dataset.metadata.cols_duplicated,
            previewed_files=source_dataset.metadata.previewed_files,
            has_ct_col=any(column.get('is_get_date') for column in process_columns),
            dummy_datetime_idx=next(
                (index for index, column in enumerate(process_columns) if column.get('is_dummy_datetime')),
                None,
            ),
            is_rdb=source_dataset.metadata.is_rdb,
            file_name_col_idx=next(
                (index for index, column in enumerate(process_columns) if column.get('is_file_name')),
                None,
            ),
            source_column_names=(
                [column['column_name'] for column in source_dataset.metadata.columns]
                if source_dataset.metadata.is_refresh_preview
                else source_dataset.metadata.source_column_names
                or [column['column_name'] for column in source_dataset.metadata.columns]
            ),
            is_refresh_preview=False,
            file_name_samples=source_dataset.metadata.file_name_samples,
        ),
    )
    write_preview_atomic(path, process_dataset)
    return process_dataset


def read_preview(
    path: Path,
    expected_fingerprint: str,
    columns: tuple[str, ...] = (),
) -> PreviewDataset | None:
    """Read a compatible Preview Parquet, or return ``None`` for a cache miss."""
    try:
        if not path.is_file():
            return None
        with _open_preview_parquet(path) as parquet_file:
            metadata = _deserialize_preview_metadata(parquet_file, expected_fingerprint, columns)
            if metadata is None:
                return None
            table = parquet_file.read(columns=list(columns) or None)
    except OSError as error:
        raise PreviewStorageError(f'Unable to read Preview Parquet: {path}') from error
    except pa.ArrowException as error:
        raise PreviewStorageError(f'Unable to read Preview Parquet: {path}') from error

    return PreviewDataset(dataframe=table.to_pandas(), metadata=metadata)


@contextmanager
def _open_preview_parquet(path: Path) -> Iterator[pq.ParquetFile]:
    # Own the source so it closes even if ParquetFile initialization raises.
    with (
        path.open('rb') as source,
        pq.ParquetFile(source, thrift_string_size_limit=_THRIFT_STRING_SIZE_LIMIT) as parquet_file,
    ):
        yield parquet_file


def _write_arrow_table(table: pa.Table, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, compression='gzip')


def _validate_parquet_file(path: Path, expected_table: pa.Table) -> None:
    with _open_preview_parquet(path) as parquet_file:
        file_metadata = parquet_file.metadata
        if file_metadata is None or file_metadata.metadata is None:
            raise ValueError('Preview Parquet metadata is missing')
        if file_metadata.num_rows != expected_table.num_rows:
            raise ValueError('Preview Parquet row count does not match the source DataFrame')
        if file_metadata.num_columns != expected_table.num_columns:
            raise ValueError('Preview Parquet column count does not match the source DataFrame')
        if not parquet_file.schema_arrow.equals(expected_table.schema, check_metadata=True):
            raise ValueError('Preview Parquet schema does not match the source DataFrame')


def _deserialize_preview_metadata(
    parquet_file: pq.ParquetFile,
    expected_fingerprint: str,
    requested_columns: tuple[str, ...],
    allowed_processing_stages: tuple[PreviewProcessingStage, ...] = (PreviewProcessingStage.PREPARED,),
) -> PreviewMetadata | None:
    try:
        schema = parquet_file.schema_arrow
        raw_metadata = schema.metadata or {}
        values = _deserialize_file_metadata(raw_metadata)
        if values is None:
            return None
        if values['schema_version'] != PREVIEW_SCHEMA_VERSION or values['fingerprint'] != expected_fingerprint:
            return None
        if values['source_kind'] != PreviewSourceKind.PARQUET.value:
            return None
        if values['processing_stage'] not in {stage.value for stage in allowed_processing_stages}:
            return None
        if (
            parquet_file.metadata is None
            or parquet_file.metadata.num_rows != values['row_count']
            or parquet_file.metadata.num_columns != values['column_count']
        ):
            return None

        schema_names = schema.names
        schema_name_set = set(schema_names)
        field_names = list(requested_columns) if requested_columns else schema_names
        field_name_set = set(field_names)
        if len(field_name_set) != len(field_names) or not field_name_set.issubset(schema_name_set):
            return None
        fields = [schema.field(name) for name in field_names]
        columns = [_deserialize_column_metadata(field) for field in fields]
        return PreviewMetadata(
            schema_version=values['schema_version'],
            source_kind=PreviewSourceKind.PARQUET,
            origin_source_kind=PreviewSourceKind(values['origin_source_kind']),
            processing_stage=PreviewProcessingStage(values['processing_stage']),
            fingerprint=values['fingerprint'],
            data_source_id=values.get('data_source_id'),
            process_id=values.get('process_id'),
            created_at=values['created_at'],
            refreshed_at=values['refreshed_at'],
            row_count=values['row_count'],
            column_count=values['column_count'],
            columns=columns,
            cols_duplicated=values['cols_duplicated'],
            previewed_files=values['previewed_files'],
            has_ct_col=values.get('has_ct_col'),
            dummy_datetime_idx=values.get('dummy_datetime_idx'),
            is_rdb=values['is_rdb'],
            file_name_col_idx=values.get('file_name_col_idx'),
            legacy_migrated=values.get('legacy_migrated', 0),
            source_column_names=values.get('source_column_names'),
            is_refresh_preview=values.get('is_refresh_preview', False),
            file_name_samples=values.get('file_name_samples'),
            generation=values.get('generation'),
        )
    except (KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def _deserialize_file_metadata(raw_metadata: dict[bytes, bytes]) -> dict[str, object] | None:
    required_keys = frozenset(
        {
            'schema_version',
            'source_kind',
            'origin_source_kind',
            'processing_stage',
            'fingerprint',
            'created_at',
            'refreshed_at',
            'row_count',
            'column_count',
            'cols_duplicated',
            'is_rdb',
        },
    )
    values: dict[str, object] = {}
    for key, value in raw_metadata.items():
        decoded_key = key.decode()
        if not decoded_key.startswith(_FILE_METADATA_PREFIX):
            continue
        name = decoded_key.removeprefix(_FILE_METADATA_PREFIX)
        if name.startswith('previewed_file.'):
            continue
        decoded_value = _decode_file_metadata_value(name, value)
        if decoded_value is None:
            return None
        values[name] = decoded_value
    if not required_keys.issubset(values) or any(values[key] is None for key in required_keys):
        return None

    previewed_file_count = values.get('previewed_file_count')
    if previewed_file_count is None:
        values['previewed_files'] = None
    elif not isinstance(previewed_file_count, int) or previewed_file_count < 0:
        return None
    else:
        previewed_files = []
        for index in range(previewed_file_count):
            key = f'{_FILE_METADATA_PREFIX}previewed_file.{index}'.encode()
            if key not in raw_metadata:
                return None
            previewed_files.append(raw_metadata[key].decode())
        values['previewed_files'] = previewed_files
    return values


def _decode_file_metadata_value(name: str, value: bytes) -> str | int | bool | list[str] | None:
    decoded_value = value.decode()
    if name in {'source_column_names', 'file_name_samples'}:
        try:
            string_values = json.loads(decoded_value)
        except json.JSONDecodeError:
            return None
        if not isinstance(string_values, list) or not all(isinstance(item, str) for item in string_values):
            return None
        return string_values
    if name in _FILE_BOOLEAN_KEYS:
        return _decode_boolean(decoded_value)
    if name in _FILE_INTEGER_KEYS:
        return _decode_integer(decoded_value)
    return decoded_value


def _deserialize_column_metadata(field: pa.Field) -> dict[str, object]:
    raw_field_metadata = field.metadata or {}
    payload = raw_field_metadata.get(_COLUMN_METADATA_PAYLOAD_KEY)
    if payload is None:
        raise ValueError('Preview column metadata payload is missing')
    decoded = json.loads(payload.decode())
    if not isinstance(decoded, dict) or not all(isinstance(key, str) for key in decoded):
        raise ValueError('Preview column metadata payload must be a JSON object with string keys')
    return decoded


def _decode_boolean(value: str) -> bool | None:
    if value == '1':
        return True
    if value == '0':
        return False
    return None


def _decode_integer(value: str) -> int | None:
    try:
        return int(value)
    except ValueError:
        return None


def _attach_preview_metadata(table: pa.Table, metadata: PreviewMetadata) -> pa.Table:
    if metadata.row_count != table.num_rows:
        raise ValueError('Preview metadata row count does not match the source DataFrame')
    if metadata.column_count != table.num_columns:
        raise ValueError('Preview metadata column count does not match the source DataFrame')
    if len(metadata.columns) != table.num_columns:
        raise ValueError('Preview metadata must describe every source DataFrame column')

    schema_metadata = dict(table.schema.metadata or {})
    schema_metadata.update(_serialize_file_metadata(metadata))
    fields = [
        field.with_metadata(_serialize_column_metadata(field_metadata))
        for field, field_metadata in zip(table.schema, metadata.columns, strict=True)
    ]
    schema = pa.schema(fields, metadata=schema_metadata)
    return pa.Table.from_arrays(table.columns, schema=schema)


def _serialize_file_metadata(metadata: PreviewMetadata) -> dict[bytes, bytes]:
    values: dict[str, str | int | bool | None] = {
        'schema_version': metadata.schema_version,
        'source_kind': PreviewSourceKind.PARQUET.value,
        'origin_source_kind': metadata.origin_source_kind.value,
        'processing_stage': metadata.processing_stage.value,
        'fingerprint': metadata.fingerprint,
        'data_source_id': metadata.data_source_id,
        'process_id': metadata.process_id,
        'created_at': metadata.created_at,
        'refreshed_at': metadata.refreshed_at,
        'row_count': metadata.row_count,
        'column_count': metadata.column_count,
        'cols_duplicated': metadata.cols_duplicated,
        'has_ct_col': metadata.has_ct_col,
        'dummy_datetime_idx': metadata.dummy_datetime_idx,
        'is_rdb': metadata.is_rdb,
        'file_name_col_idx': metadata.file_name_col_idx,
        'is_refresh_preview': metadata.is_refresh_preview,
        'generation': metadata.generation,
    }
    if metadata.previewed_files is not None:
        values['previewed_file_count'] = len(metadata.previewed_files)
    if metadata.legacy_migrated:
        values['legacy_migrated'] = metadata.legacy_migrated

    serialized = {
        f'{_FILE_METADATA_PREFIX}{key}'.encode(): _encode_metadata_value(value)
        for key, value in values.items()
        if value is not None
    }
    if metadata.previewed_files is not None:
        serialized.update(
            {
                f'{_FILE_METADATA_PREFIX}previewed_file.{index}'.encode(): previewed_file.encode()
                for index, previewed_file in enumerate(metadata.previewed_files)
            },
        )
    if metadata.source_column_names is not None:
        serialized[f'{_FILE_METADATA_PREFIX}source_column_names'.encode()] = json.dumps(
            metadata.source_column_names,
            ensure_ascii=False,
            separators=(',', ':'),
            sort_keys=True,
        ).encode()
    if metadata.file_name_samples is not None:
        serialized[f'{_FILE_METADATA_PREFIX}file_name_samples'.encode()] = json.dumps(
            metadata.file_name_samples,
            ensure_ascii=False,
            separators=(',', ':'),
        ).encode()
    return serialized


def _serialize_column_metadata(column_metadata: dict[str, object]) -> dict[bytes, bytes]:
    persisted_metadata = {
        key: value for key, value in column_metadata.items() if key not in _NON_PERSISTED_COLUMN_METADATA
    }
    serialized: dict[bytes, bytes] = {
        _COLUMN_METADATA_PAYLOAD_KEY: json.dumps(
            persisted_metadata,
            ensure_ascii=False,
            separators=(',', ':'),
            sort_keys=True,
        ).encode(),
    }
    for key, value in persisted_metadata.items():
        if key == 'check_same_value' and isinstance(value, dict):
            for nested_key, nested_value in value.items():
                _add_scalar_metadata(serialized, f'{key}.{nested_key}', nested_value)
            continue
        _add_scalar_metadata(serialized, key, value)
    return serialized


def _add_scalar_metadata(serialized: dict[bytes, bytes], key: str, value: object) -> None:
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return
    if not isinstance(value, (str, bool, int)) or isinstance(value, bytes):
        return
    serialized[f'{_COLUMN_METADATA_PREFIX}{key}'.encode()] = _encode_metadata_value(value)


def _encode_metadata_value(value: str | int | bool) -> bytes:
    if isinstance(value, bool):
        return b'1' if value else b'0'
    return str(value).encode()


def _require_identifier(value: int | None, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f'{name} must be a positive integer')
    return value


def _validate_fingerprint(fingerprint: str) -> None:
    if not _FINGERPRINT_PATTERN.fullmatch(fingerprint):
        raise ValueError('fingerprint must be a lowercase SHA-256 hexadecimal digest')


def _validate_generation(generation: str) -> None:
    if not _PENDING_PREVIEW_TOKEN_PATTERN.fullmatch(generation):
        raise ValueError('generation must be a UUID4 hexadecimal string')
