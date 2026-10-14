"""Local-only unique and percentile preview samples."""

from __future__ import annotations

from typing import Any

from ap.api.setting_module.services.preview_data import PreviewRequestContext
from ap.api.setting_module.services.preview_parquet import read_generation_preview
from ap.api.setting_module.services.show_latest_record import build_unique_preview_response
from ap.common.constants import PREVIEW_UNIQUE_COLUMN_BATCH_LIMIT

_UNIQUE_RESPONSE_KEYS = (
    'unique_rows_as_category',
    'unique_rows_as_real',
    'unique_rows_as_int',
    'unique_rows_as_int_cat',
)


class PreviewGenerationMismatch(Exception):
    """The requested generation is no longer the current response snapshot."""


def resolve_unique_preview(
    context: PreviewRequestContext,
    generation: str,
) -> dict[str, list[dict[str, Any]]]:
    """Build unique samples from the exact dataset selected by the main response."""
    requested_columns = tuple(dict.fromkeys(context.requested_column_names))[:PREVIEW_UNIQUE_COLUMN_BATCH_LIMIT]
    dataset = read_generation_preview(context, generation, columns=requested_columns)
    if dataset is None:
        raise PreviewGenerationMismatch
    if not requested_columns:
        return {key: [] for key in _UNIQUE_RESPONSE_KEYS}
    return build_unique_preview_response(dataset)
