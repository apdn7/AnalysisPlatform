from __future__ import annotations

import shutil
from pathlib import Path

from ap.api.setting_module.services.preview_parquet import get_process_preview_path
from ap.common.constants import PREVIEW_PROCESS_PARQUET_CLEANUP_THRESHOLD
from ap.common.path_utils import get_preview_data_file_folder
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import get_internal_preview_table_availability


def cleanup_process_preview_after_deletion(data_source_id: int, process_id: int) -> None:
    """Remove process-owned previews only after its metadata deletion commits."""
    preview_path = get_process_preview_path(data_source_id, process_id)
    for path in (
        preview_path,
        preview_path.with_name(f'current_{preview_path.name}'),
        preview_path.with_suffix('.json'),
    ):
        path.unlink(missing_ok=True)


def cleanup_datasource_preview_after_deletion(data_source_id: int) -> None:
    """Remove all datasource previews only after its metadata deletion commits."""
    preview_folder = Path(get_preview_data_file_folder(data_source_id))
    if preview_folder.exists():
        shutil.rmtree(preview_folder)


def cleanup_process_preview_after_data_update(process_id: int) -> bool:
    """Remove stale Process Preview Parquet when Internal data is sufficient.

    Call this only after a successful import or another operation that mutates
    Process transaction data. Preview readers must not invoke it.
    """
    process = CfgProcess.get_proc_by_id(process_id)
    if process is None:
        return False

    availability = get_internal_preview_table_availability(process)
    if not availability.table_exists or availability.row_count <= PREVIEW_PROCESS_PARQUET_CLEANUP_THRESHOLD:
        return False

    preview_path = get_process_preview_path(process.data_source_id, process.id)
    if not preview_path.exists():
        return False
    preview_path.unlink(missing_ok=True)
    return True
