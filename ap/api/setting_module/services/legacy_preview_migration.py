"""One-time conversion of retired Preview JSON files to Process Parquet."""

from __future__ import annotations

from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from ap.api.setting_module.services.legacy_preview import load_legacy_preview_for_migration
from ap.api.setting_module.services.preview_data import (
    PreviewDataset,
    PreviewMetadata,
    PreviewProcessingStage,
    PreviewRequestContext,
    PreviewSourceKind,
)
from ap.api.setting_module.services.preview_parquet import read_preview, write_preview_atomic
from ap.common.constants import PREVIEW_SCHEMA_VERSION
from ap.common.path_utils import get_preview_data_path


def migrate_legacy_preview(
    context: PreviewRequestContext,
    fingerprint: str,
    process_preview_path: Path,
    *,
    columns: tuple[str, ...] = (),
) -> PreviewDataset | None:
    """Migrate the first compatible legacy JSON file for a Process.

    The caller must invoke this only after Internal data and compatible Process
    Parquet have both been found unavailable. JSON is removed only after the
    newly written Parquet is read back successfully.
    """
    for legacy_path in _legacy_preview_paths(context):
        legacy_payload = load_legacy_preview_for_migration(legacy_path)
        dataset = _build_legacy_dataset(legacy_payload, context, fingerprint)
        if dataset is None:
            continue

        write_preview_atomic(process_preview_path, dataset)
        migrated_dataset = read_preview(process_preview_path, fingerprint, columns=columns)
        if migrated_dataset is None:
            return None
        with suppress(OSError):
            legacy_path.unlink()
        return migrated_dataset
    return None


def _legacy_preview_paths(context: PreviewRequestContext) -> tuple[Path, ...]:
    if context.data_source_id is None or context.process_id is None:
        return ()

    folder = Path(get_preview_data_path()) / str(context.data_source_id)
    paths = [folder / f'process_{context.process_id}.json']
    filename_parts = (
        context.data_source_id,
        context.table_name,
        context.process_factid,
        context.master_type,
        context.etl_func,
    )
    datasource_name = '_'.join(str(part) for part in filename_parts if part) + '.json'
    datasource_path = folder / datasource_name
    if datasource_path != paths[0]:
        paths.append(datasource_path)
    return tuple(paths)


def _build_legacy_dataset(
    payload: dict[str, Any] | None,
    context: PreviewRequestContext,
    fingerprint: str,
) -> PreviewDataset | None:
    if payload is None:
        return None
    cols = payload.get('cols')
    rows = payload.get('rows')
    if not isinstance(cols, list) or not isinstance(rows, list):
        return None

    columns = [dict(column) for column in cols if isinstance(column, dict)]
    column_names = [column.get('column_name') for column in columns]
    if len(columns) != len(cols) or any(not isinstance(name, str) or not name for name in column_names):
        return None
    if len(set(column_names)) != len(column_names) or any(not isinstance(row, dict) for row in rows):
        return None

    dataframe = pd.DataFrame(rows, columns=column_names)
    timestamp = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
    return PreviewDataset(
        dataframe=dataframe,
        metadata=PreviewMetadata(
            schema_version=PREVIEW_SCHEMA_VERSION,
            source_kind=PreviewSourceKind.PARQUET,
            origin_source_kind=PreviewSourceKind.EXTERNAL,
            processing_stage=PreviewProcessingStage.PREPARED,
            fingerprint=fingerprint,
            data_source_id=context.data_source_id,
            process_id=context.process_id,
            created_at=timestamp,
            refreshed_at=timestamp,
            row_count=len(dataframe),
            column_count=len(dataframe.columns),
            columns=columns,
            cols_duplicated=bool(payload.get('cols_duplicated', False)),
            previewed_files=_list_or_none(payload.get('previewed_files')),
            has_ct_col=_bool_or_none(payload.get('has_ct_col')),
            dummy_datetime_idx=_int_or_none(payload.get('dummy_datetime_idx')),
            is_rdb=bool(payload.get('is_rdb', False)),
            file_name_col_idx=_int_or_none(payload.get('file_name_col_idx')),
            legacy_migrated=1,
            source_column_names=column_names,
        ),
    )


def _list_or_none(value: object) -> list[str] | None:
    return value if isinstance(value, list) and all(isinstance(item, str) for item in value) else None


def _bool_or_none(value: object) -> bool | None:
    return value if isinstance(value, bool) else None


def _int_or_none(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None
