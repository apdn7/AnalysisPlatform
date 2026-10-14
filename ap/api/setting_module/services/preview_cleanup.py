from __future__ import annotations

from ap.api.setting_module.services.preview_parquet import get_process_preview_path
from ap.common.constants import PREVIEW_PROCESS_PARQUET_CLEANUP_THRESHOLD
from ap.setting_module.models import CfgProcess
from ap.trace_data.transaction_model import get_internal_preview_table_availability


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
