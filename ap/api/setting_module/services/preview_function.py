"""Local-only sample rows for Process function-column inputs."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from ap.api.setting_module.services.preview_data import PreviewProcessingStage, PreviewRequestContext
from ap.api.setting_module.services.preview_resolver import resolve_preview_dataset
from ap.common.constants import PREVIEW_FUNCTION_SAMPLE_LIMIT


@dataclass(frozen=True)
class FunctionPreviewSamples:
    """Function input samples and the processing stage they were read at.

    IMPORTED samples already had the Process datetime format applied during import,
    so callers must not apply it again.
    """

    samples: dict[str, list[Any]] = field(default_factory=dict)
    processing_stage: PreviewProcessingStage | None = None


def resolve_function_preview(
    context: PreviewRequestContext,
    *,
    limit: int = PREVIEW_FUNCTION_SAMPLE_LIMIT,
) -> FunctionPreviewSamples:
    """Return requested function inputs from Internal data or Preview Parquet only."""
    requested_columns = tuple(dict.fromkeys(context.requested_column_names))
    if not requested_columns:
        return FunctionPreviewSamples()

    local_context = replace(context, requested_column_names=requested_columns, refresh_preview=False)
    dataset = resolve_preview_dataset(
        local_context,
        projected_columns=requested_columns,
        include_main_date_time=True,
        dependency_raw_column_names=tuple(
            column_name for column_name in context.import_filter if isinstance(column_name, str) and column_name
        ),
    )
    if dataset is None:
        return FunctionPreviewSamples()

    sample_limit = min(max(limit, 0), PREVIEW_FUNCTION_SAMPLE_LIMIT)
    return FunctionPreviewSamples(
        samples={
            column_name: dataset.dataframe[column_name].head(sample_limit).tolist()
            for column_name in requested_columns
            if column_name in dataset.dataframe.columns
        },
        processing_stage=dataset.metadata.processing_stage,
    )
