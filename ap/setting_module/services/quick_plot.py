"""Quick Plot upload storage, registration ownership, and retention cleanup."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path, PureWindowsPath

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from flask import current_app, has_app_context
from loguru import logger
from sqlalchemy.orm import scoped_session
from werkzeug.datastructures import FileStorage

from ap.api.setting_module.services.process_delete import del_data_source
from ap.common.common_utils import add_months
from ap.common.constants import (
    DATE_FORMAT_STR,
    QUICK_PLOT_DATA_SOURCE_RETENTION_MONTHS,
    QUICK_PLOT_MAX_FILE_SIZE_BYTES,
    QUICK_PLOT_STALE_PART_HOURS,
    QUICK_PLOT_STREAM_CHUNK_SIZE_BYTES,
    QUICK_PLOT_UPLOAD_RETENTION_MONTHS,
    CSVExtTypes,
    JobType,
)
from ap.common.multiprocess_sharing import EventAddJob, EventQueue
from ap.common.path_utils import get_quick_plot_path
from ap.common.scheduler import scheduler_app_context
from ap.setting_module.models import (
    CfgDataSource,
    CfgQuickPlotDataSource,
    CfgQuickPlotUpload,
    make_session,
)

_CLEANUP_BATCH_SIZE = 500
_MAX_STORED_FILENAME_LENGTH = 180


class QuickPlotUploadError(ValueError):
    """Represent a client-visible Quick Plot upload or association validation error."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        """Initialize an error with the HTTP status expected by the upload endpoint.

        Args:
            message: Safe error detail for the API response.
            status_code: HTTP status code associated with the validation failure.
        """
        # Keep status mapping with the domain error so the controller remains orchestration-only.
        super().__init__(message)
        self.status_code = status_code


def _format_utc(value: datetime) -> str:
    """Format an aware datetime using the metadata database's sortable UTC representation."""
    # Normalize first so every persisted deadline compares lexicographically in the same timezone.
    return value.astimezone(UTC).strftime(DATE_FORMAT_STR)


def _parse_utc(value: str) -> datetime:
    """Parse the metadata database's UTC timestamp representation into an aware datetime."""
    # Attach UTC explicitly because DATE_FORMAT_STR encodes Z but datetime.strptime returns a naive value.
    return datetime.strptime(value, DATE_FORMAT_STR).replace(tzinfo=UTC)


def _canonical_path(path: str | Path) -> Path:
    """Return a normalized absolute path without requiring the target to exist."""
    # realpath resolves junctions and symlinks while normcase enforces Windows case-insensitive comparison.
    return Path(os.path.normcase(Path(path).resolve(strict=False)))


def _validate_filename(original_filename: str) -> str:
    """Validate an untrusted browser basename without modifying its Unicode characters.

    Args:
        original_filename: Filename supplied by the multipart upload.

    Returns:
        The unchanged, validated basename.

    Raises:
        QuickPlotUploadError: If the filename is unsafe, unsupported, or too long.
    """
    if (
        not original_filename
        or original_filename in {'.', '..'}
        or any(character in '<>:"/\\|?*' or ord(character) < 32 for character in original_filename)
        or original_filename.endswith((' ', '.'))
        or PureWindowsPath(original_filename).is_reserved()
    ):
        raise QuickPlotUploadError('A valid file basename is required.')

    extension = Path(original_filename).suffix.lower().lstrip('.')
    supported_extensions = {extension_type.value for extension_type in CSVExtTypes}
    if extension not in supported_extensions:
        raise QuickPlotUploadError('The selected file type is not supported.')

    # Windows counts UTF-16 units; keep room for the timestamp and collision suffix without truncation.
    filename_length = len(original_filename.encode('utf-16-le')) // 2
    if filename_length > _MAX_STORED_FILENAME_LENGTH:
        raise QuickPlotUploadError('The filename is too long. Please shorten it.')
    return original_filename


def _retention_deadline(retained_at: datetime, months: int) -> datetime:
    """Return the Quick Plot retention deadline for production or opt-in development testing.

    Args:
        retained_at: UTC timestamp from which retention begins.
        months: Production calendar-month retention length.

    Returns:
        The production calendar deadline, or a configured minute deadline in development or tests.
    """
    # Restrict short-lived retention to non-production app contexts so production timestamps remain calendar-based.
    test_minutes = None
    if has_app_context() and (current_app.debug or current_app.testing):
        test_minutes = current_app.config.get('QUICK_PLOT_TEST_RETENTION_MINUTES')
    if test_minutes is not None:
        return retained_at + timedelta(minutes=test_minutes)
    return add_months(retained_at, months=months)


def _reserve_final_path(root: Path, timestamp: str, validated_filename: str) -> Path:
    """Atomically reserve a collision-free final filename under the Quick Plot root."""
    # Allocate with O_EXCL so concurrent uploads cannot select the same timestamped name.
    source_path = Path(validated_filename)
    collision_index = 0
    while True:
        collision_suffix = '' if collision_index == 0 else f'_{collision_index}'
        candidate = root / f'_{timestamp}_{source_path.stem}{collision_suffix}{source_path.suffix}'
        try:
            descriptor = os.open(candidate, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            collision_index += 1
            continue
        try:
            os.close(descriptor)
        except Exception:
            # Remove a reservation if its descriptor cannot be closed cleanly.
            candidate.unlink(missing_ok=True)
            raise
        return candidate


def store_quick_plot_upload(upload: FileStorage) -> dict[str, str | int]:
    """Stream one multipart file into private storage and persist its retention metadata.

    Args:
        upload: Werkzeug file object for the sole multipart ``file`` field.

    Returns:
        API response fields describing the published upload, with ``server_path`` preserving configured path casing.

    Raises:
        QuickPlotUploadError: If validation or the per-file size limit fails.
        OSError: If private storage cannot be written or atomically published.
    """
    original_filename = upload.filename or ''
    validated_filename = _validate_filename(original_filename)
    root = Path(get_quick_plot_path())
    partial_path: Path | None = None
    final_path: Path | None = None

    try:
        # Create only the fixed server-owned root; clients cannot influence this destination.
        root.mkdir(parents=True, exist_ok=True)
        partial_path = root / f'.{uuid.uuid4().hex}.part'
        size_bytes = 0

        # Stream bounded chunks and read one byte beyond the limit when necessary to enforce absent Content-Length.
        with partial_path.open('xb') as partial_file:
            while True:
                remaining = QUICK_PLOT_MAX_FILE_SIZE_BYTES - size_bytes
                chunk = upload.stream.read(min(QUICK_PLOT_STREAM_CHUNK_SIZE_BYTES, remaining + 1))
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > QUICK_PLOT_MAX_FILE_SIZE_BYTES:
                    raise QuickPlotUploadError('The selected file exceeds the 100 MB limit.', status_code=413)
                partial_file.write(chunk)

            # Flush Python and operating-system buffers before publishing the completed file.
            partial_file.flush()
            os.fsync(partial_file.fileno())

        if size_bytes == 0:
            raise QuickPlotUploadError('The selected file is empty.')

        # Reserve the required timestamped name and atomically replace the reservation with complete content.
        uploaded_at = datetime.now(UTC)
        final_path = _reserve_final_path(root, uploaded_at.strftime('%y%m%d%H%M%S'), validated_filename)
        partial_path.replace(final_path)
        partial_path = None

        # Preserve the configured Windows root casing in both metadata and the client-visible Path field.
        stored_final_path = str(final_path)

        # Persist metadata only after publication; a database failure removes the otherwise orphaned file below.
        upload_id = uuid.uuid4().hex
        file_expires_at = _retention_deadline(uploaded_at, QUICK_PLOT_UPLOAD_RETENTION_MONTHS)
        with make_session() as meta_session:
            meta_session.add(
                CfgQuickPlotUpload(
                    id=upload_id,
                    original_filename=original_filename,
                    stored_filename=final_path.name,
                    stored_path=stored_final_path,
                    size_bytes=size_bytes,
                    uploaded_at=_format_utc(uploaded_at),
                    file_expires_at=_format_utc(file_expires_at),
                )
            )

        return {
            'upload_id': upload_id,
            'original_filename': original_filename,
            'server_path': stored_final_path,
            'size_bytes': size_bytes,
            'file_expires_at': _format_utc(file_expires_at),
        }
    except Exception:
        # Remove both incomplete content and a reserved/published file when any upload stage fails.
        for cleanup_path in (partial_path, final_path):
            if cleanup_path is not None:
                try:
                    cleanup_path.unlink(missing_ok=True)
                except OSError:
                    logger.exception('Failed to remove incomplete Quick Plot file %s', cleanup_path)
        raise


def validate_quick_plot_registration(
    meta_session: scoped_session,
    upload_id: str,
    csv_directory: str | None,
) -> CfgQuickPlotUpload:
    """Validate that an active upload owns the exact canonical registration path.

    Args:
        meta_session: Metadata transaction that will create the datasource mappings.
        upload_id: Opaque upload identifier supplied by the browser.
        csv_directory: File path from ``csv_info.csv_detail.directory``.

    Returns:
        The active upload metadata attached to ``meta_session``.

    Raises:
        QuickPlotUploadError: If the upload is missing, expired, or path-mismatched.
    """
    # Resolve the upload inside the caller's transaction so validation and ownership insertion are atomic.
    upload = meta_session.get(CfgQuickPlotUpload, upload_id)
    if upload is None:
        raise QuickPlotUploadError('The Quick Plot upload is no longer available.')

    # Registration is allowed only before the independent file-retention deadline.
    if _parse_utc(upload.file_expires_at) <= datetime.now(UTC):
        raise QuickPlotUploadError('The Quick Plot upload has expired.')

    # Compare normalized absolute paths and reject missing, moved, or ownership-invalid files.
    stored_path = _canonical_path(upload.stored_path)
    if (
        not isinstance(csv_directory, str)
        or _canonical_path(csv_directory) != stored_path
        or not _is_path_inside_quick_plot_root(stored_path)
        or not stored_path.is_file()
    ):
        raise QuickPlotUploadError('The Quick Plot upload does not match the selected file path.')
    return upload


def associate_quick_plot_data_source(
    meta_session: scoped_session,
    upload: CfgQuickPlotUpload,
    data_source_id: int,
    registered_at: datetime,
) -> None:
    """Associate a newly created datasource with its upload in the caller's metadata transaction."""
    # The unique datasource constraint prevents duplicate ownership rows if this helper is invoked repeatedly.
    existing_mapping = meta_session.query(CfgQuickPlotDataSource.id).filter_by(data_source_id=data_source_id).first()
    if existing_mapping is not None:
        return

    # Datasource retention starts from successful metadata registration, independently of file retention.
    meta_session.add(
        CfgQuickPlotDataSource(
            quick_plot_upload_id=upload.id,
            data_source_id=data_source_id,
            registered_at=_format_utc(registered_at),
            expires_at=_format_utc(
                _retention_deadline(registered_at, QUICK_PLOT_DATA_SOURCE_RETENTION_MONTHS),
            ),
        )
    )


def _record_mapping_cleanup_error(mapping_id: int, error: Exception) -> None:
    """Persist a datasource cleanup failure without discarding its retry mapping."""
    # Reload because the deletion service owns a separate transaction and may have cascaded the mapping already.
    with make_session() as meta_session:
        mapping = meta_session.get(CfgQuickPlotDataSource, mapping_id)
        if mapping is not None:
            mapping.last_error = str(error)[:2000]


def _cleanup_expired_data_sources(now_text: str) -> None:
    """Delete expired Quick Plot datasources through the established deletion service."""
    last_mapping_id = 0
    while True:
        # Read one stable keyset page without retaining ORM objects across deletion transactions.
        with make_session() as meta_session:
            rows = (
                meta_session.query(CfgQuickPlotDataSource.id, CfgQuickPlotDataSource.data_source_id)
                .filter(
                    CfgQuickPlotDataSource.expires_at <= now_text,
                    CfgQuickPlotDataSource.id > last_mapping_id,
                )
                .order_by(CfgQuickPlotDataSource.id)
                .limit(_CLEANUP_BATCH_SIZE)
                .all()
            )
        if not rows:
            break

        # Process each datasource independently so one failure does not block unrelated expired resources.
        for mapping_id, data_source_id in rows:
            last_mapping_id = mapping_id
            try:
                # Missing datasources are already successfully cleaned and only need their mapping removed.
                with make_session() as meta_session:
                    mapping = meta_session.get(CfgQuickPlotDataSource, mapping_id)
                    data_source_exists = meta_session.get(CfgDataSource, data_source_id) is not None
                    if mapping is None:
                        continue
                    if not data_source_exists:
                        meta_session.delete(mapping)
                        continue

                # Reuse the full datasource deletion workflow for processes, jobs, pulled data, and transaction DBs.
                del_data_source(data_source_id)
                with make_session() as meta_session:
                    mapping = meta_session.get(CfgQuickPlotDataSource, mapping_id)
                    if mapping is not None:
                        meta_session.delete(mapping)
            except Exception as error:
                logger.exception('Failed to clean Quick Plot datasource %s', data_source_id)
                _record_mapping_cleanup_error(mapping_id, error)


def _is_path_inside_quick_plot_root(path: str | Path) -> bool:
    """Return whether a canonical path is a child file of the fixed Quick Plot root."""
    root = _canonical_path(get_quick_plot_path())
    candidate = _canonical_path(path)
    try:
        # Require a child path rather than the root itself so cleanup can never remove the shared directory.
        return os.path.commonpath((str(root), str(candidate))) == str(root) and candidate != root
    except ValueError:
        # Paths on different Windows drives cannot share the fixed Quick Plot root.
        return False


def _cleanup_expired_files(now_text: str) -> None:
    """Delete expired uploaded files only when their persisted path is inside the fixed root."""
    last_upload_id = ''
    while True:
        # Read a stable page of uploads whose independent file retention has elapsed.
        with make_session() as meta_session:
            upload_ids = [
                row[0]
                for row in (
                    meta_session.query(CfgQuickPlotUpload.id)
                    .filter(
                        CfgQuickPlotUpload.file_expires_at <= now_text,
                        CfgQuickPlotUpload.id > last_upload_id,
                    )
                    .order_by(CfgQuickPlotUpload.id)
                    .limit(_CLEANUP_BATCH_SIZE)
                    .all()
                )
            ]
        if not upload_ids:
            break

        # Treat an already-missing file as success while preserving unsafe or failed paths for retry diagnosis.
        for upload_id in upload_ids:
            last_upload_id = upload_id
            try:
                with make_session() as meta_session:
                    upload = meta_session.get(CfgQuickPlotUpload, upload_id)
                    if upload is None:
                        continue
                    if not _is_path_inside_quick_plot_root(upload.stored_path):
                        raise ValueError('Refusing to delete a Quick Plot file outside the fixed root.')
                    Path(upload.stored_path).unlink(missing_ok=True)
                    if upload.data_source_mappings:
                        # Preserve ownership metadata until independently retained datasources are removed.
                        upload.last_error = None
                    else:
                        # Remove the metadata immediately after the idempotent file cleanup completes.
                        meta_session.delete(upload)
            except Exception as error:
                logger.exception('Failed to clean Quick Plot upload %s', upload_id)
                with make_session() as meta_session:
                    upload = meta_session.get(CfgQuickPlotUpload, upload_id)
                    if upload is not None:
                        upload.last_error = str(error)[:2000]


def _cleanup_stale_partial_files(now: datetime) -> None:
    """Remove interrupted Quick Plot ``.part`` files older than the safety threshold."""
    root = Path(get_quick_plot_path())
    if not root.is_dir():
        return
    cutoff = now - timedelta(hours=QUICK_PLOT_STALE_PART_HOURS)

    # scandir keeps directory traversal incremental and only accepts direct children with the private suffix.
    with os.scandir(root) as entries:
        for entry in entries:
            if not _is_quick_plot_partial_name(entry.name) or not entry.is_file(follow_symlinks=False):
                continue
            try:
                if datetime.fromtimestamp(entry.stat(follow_symlinks=False).st_mtime, tz=UTC) <= cutoff:
                    Path(entry.path).unlink(missing_ok=True)
            except OSError:
                logger.exception('Failed to remove stale Quick Plot partial file %s', entry.path)


def _is_quick_plot_partial_name(filename: str) -> bool:
    """Return whether a filename matches the private UUID-based upload partial format."""
    # Limit stale cleanup to files this service creates so unrelated ``.part`` files are never removed.
    token = filename[1:-5] if filename.startswith('.') and filename.endswith('.part') else ''
    return len(token) == 32 and all(character in '0123456789abcdef' for character in token)


@scheduler_app_context
def cleanup_quick_plot() -> None:
    """Run the idempotent daily cleanup for expired mappings, files, and stale partials."""
    now = datetime.now(UTC)
    now_text = _format_utc(now)

    # Datasource cleanup runs first so file cleanup can remove unreferenced upload metadata in the same execution.
    _cleanup_expired_data_sources(now_text)
    _cleanup_expired_files(now_text)
    _cleanup_stale_partial_files(now)


def add_quick_plot_cleanup_job(run_now: bool = True, cleanup_interval_seconds: int | None = None) -> bool:
    """Register the singleton production-daily or development-interval cleanup job.

    Args:
        run_now: Run once at startup in addition to the daily schedule.
        cleanup_interval_seconds: Opt-in development/test interval; ``None`` keeps the daily production schedule.

    Returns:
        Always ``True`` after the add-job event is queued.
    """
    # Use a frequent interval only when explicitly configured for development or tests.
    if cleanup_interval_seconds is not None:
        if cleanup_interval_seconds <= 0:
            raise ValueError('Quick Plot cleanup interval must be greater than zero.')
        trigger = IntervalTrigger(seconds=cleanup_interval_seconds, timezone=UTC)
    else:
        # Follow existing maintenance jobs by scheduling 03:00 local time as an explicit UTC trigger.
        local_three_am = datetime.now().astimezone().replace(hour=3, minute=0, second=0, microsecond=0)
        utc_three_am = local_three_am.astimezone(UTC)
        trigger = CronTrigger(
            hour=utc_three_am.hour,
            minute=utc_three_am.minute,
            second=utc_three_am.second,
            timezone=UTC,
        )
    EventQueue.put(
        EventAddJob(
            fn=cleanup_quick_plot,
            job_type=JobType.QUICK_PLOT_CLEANUP,
            trigger=trigger,
            replace_existing=True,
            next_run_time=datetime.now(UTC) if run_now else None,
            max_instances=1,
            coalesce=True,
        )
    )
    return True
