"""Local-only samples for Process Link configuration."""

from __future__ import annotations

from typing import Any

from ap.api.setting_module.services.preview_data import PreviewRequestContext
from ap.api.setting_module.services.preview_resolver import resolve_preview_dataset
from ap.api.setting_module.services.v2_etl_services import is_v2_data_source
from ap.api.trace_data.services.proc_link import get_first_valid_value_for_proc_link_preview
from ap.common.constants import MasterDBType
from ap.setting_module.models import CfgProcess


def resolve_proc_link_preview(process: CfgProcess) -> dict[str, Any]:
    """Return local linking samples keyed by string Process column IDs."""
    linking_columns = process.get_linking_columns()
    linking_column_names = tuple(column.column_name for column in linking_columns)
    if not linking_column_names:
        return {}

    linking_column_ids = tuple(str(column.id) for column in linking_columns)
    context = _build_proc_link_preview_context(process, linking_columns)
    dataset = resolve_preview_dataset(
        context,
        projected_columns=linking_column_names,
        include_main_date_time=True,
        include_transaction_functions=True,
        dependency_raw_column_names=tuple(context.import_filter),
    )
    if dataset is None or dataset.dataframe.empty:
        return dict.fromkeys(linking_column_ids)

    samples = get_first_valid_value_for_proc_link_preview(
        dataset.dataframe.reindex(columns=linking_column_names),
    )
    if samples.empty:
        return dict.fromkeys(linking_column_ids)
    samples_by_name = samples.iloc[0].to_dict()
    return {str(column.id): samples_by_name[column.column_name] for column in linking_columns}


def _build_proc_link_preview_context(process: CfgProcess, linking_columns: list[Any]) -> PreviewRequestContext:
    """Build the persisted Process context required for a local preview lookup."""
    data_source = process.data_source
    csv_detail = getattr(data_source, 'csv_detail', None)
    web_detail = getattr(data_source, 'web_detail', None)
    master_type = MasterDBType.__members__.get(process.master_type)
    import_filter = {
        column.column_raw_name: column.filter for column in process.columns if column.column_raw_name and column.filter
    }
    return PreviewRequestContext(
        data_source_id=process.data_source_id,
        process_id=process.id,
        table_name=process.table_name,
        file_name=process.file_name
        or (csv_detail.directory if csv_detail and getattr(csv_detail, 'is_file_path', False) else None),
        directory=getattr(csv_detail, 'directory', None),
        process_factid=process.process_factid,
        master_type=master_type,
        etl_func=(getattr(csv_detail, 'etl_func', None) or process.get_etl_func() or ''),
        import_filter=import_filter,
        api_url=getattr(web_detail, 'url', None),
        encoding=getattr(csv_detail, 'encoding', None),
        auto_encoding=getattr(csv_detail, 'auto_encoding', None),
        delimiter=getattr(csv_detail, 'delimiter', None),
        is_v2_datasource=is_v2_data_source(ds_type=getattr(data_source, 'type', None)),
        filtered_process_name=getattr(csv_detail, 'process_name', None),
        requested_column_names=tuple(column.column_name for column in linking_columns),
        requested_raw_column_names=tuple(column.column_raw_name or column.column_name for column in linking_columns),
        refresh_preview=False,
    )
