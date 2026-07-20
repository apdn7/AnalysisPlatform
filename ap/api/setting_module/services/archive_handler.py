from __future__ import annotations

import contextlib
import io
import os
import queue
import shutil
import tempfile
import threading
import zipfile
from collections.abc import Callable, Generator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import BinaryIO

import py7zr
from loguru import logger

from ap.common.constants import (
    ARCHIVE_DEFAULT_EXTRACTED_FILE_SUFFIX,
    ARCHIVE_EXPANSION_MAX_FILES_DEFAULT,
    ARCHIVE_MAX_FILES_DEFAULT,
    ARCHIVE_NESTED_ZIP_MEMORY_THRESHOLD_DEFAULT,
    ARCHIVE_ROOT_SIGNATURE_PREFIX,
    ARCHIVE_SEVEN_Z_EXTENSION,
    ARCHIVE_SIGNATURE_STATUS_FAILED,
    ARCHIVE_SIGNATURE_STATUS_SUCCESS,
    ARCHIVE_STREAM_READ_CHUNK_SIZE,
    ARCHIVE_STREAMING_PREFETCH_QUEUE_SIZE_DEFAULT,
    ARCHIVE_ZIP_EXTENSION,
    DATE_FORMAT_SIMPLE,
    ROOT_ARCHIVE_FAILED_MSG,
)
from ap.trace_data.transaction_model import (
    ImportProcessedSignatureTable,
    init_processed_signature_table,
)

type TargetExtensions = tuple[str, ...] | set[str] | None
type FilePaths = list[str]
type TempFilePaths = list[str]
type ArchiveExpansionOutput = tuple[FilePaths | list['ExtractedArchiveEntry'], TempFilePaths]
type FileEntryHandler = Callable[['FileEntry'], object | list[object] | None]
type ZipInfoDateTime = tuple[int, int, int, int, int, int]
type ArchiveSignatureCallback = Callable[[str, str], None]
type ArchiveExtractionErrorCallback = Callable[[str, BaseException], None]


@dataclass(frozen=True)
class FileSignature:
    """Identity fields used to deduplicate processed archive members."""

    virtual_path: str
    file_modified_time: str


@dataclass
class FileEntry:
    """Archive member metadata plus materialized temp path."""

    archive_path: str
    root_file_name: str
    file_name: str
    virtual_path: str
    file_modified_time: str
    temp_path: str


@dataclass(frozen=True)
class ExtractedArchiveEntry:
    """Metadata for an extracted archive member stored in a temp file."""

    temp_path: str
    virtual_path: str
    file_name: str
    file_modified_time: str


@dataclass
class _ExtractionProgress:
    extracted_files: int = 0


@dataclass(frozen=True)
class _PrefetchError:
    """Wrapper object to forward producer-side exception to consumer."""

    error: BaseException


def _normalize_extension(extension: str) -> str:
    """Normalize an extension to lowercase and ensure it starts with a dot."""
    ext = extension.strip().lower()
    return ext if ext.startswith('.') else f'.{ext}'


def _normalize_target_extensions(target_extensions: TargetExtensions) -> tuple[str, ...] | None:
    """Normalize all configured extensions for consistent matching."""
    if target_extensions is None:
        return None
    return tuple(_normalize_extension(extension) for extension in target_extensions)


def _matches_target_extension(file_name: str, target_extensions: tuple[str, ...] | None) -> bool:
    """Check whether a file name matches configured target extensions."""
    if target_extensions is None:
        return True
    return file_name.lower().endswith(target_extensions)


def _normalize_virtual_path(base: str, name: str) -> str:
    """Build a stable virtual path representation for nested archive entries."""
    normalized_name = str(PurePosixPath(name))
    return f'{base}!/{normalized_name}' if base else normalized_name


def _is_zip_file(file_name: str | os.PathLike[str]) -> bool:
    """Return True when the file name has .zip extension."""
    return os.fspath(file_name).lower().endswith(ARCHIVE_ZIP_EXTENSION)


def is_supported_archive_path(file_name: str | os.PathLike[str]) -> bool:
    """Return True when the file name is a supported archive type."""
    lower_name = os.fspath(file_name).lower()
    return lower_name.endswith((ARCHIVE_ZIP_EXTENSION, ARCHIVE_SEVEN_Z_EXTENSION))


def _normalize_archive_member_name(name: str) -> str:
    """Normalize archive member path separators and remove leading roots."""
    normalized_name = str(PurePosixPath(name.replace('\\', '/')))
    normalized_name = normalized_name.removeprefix('./')
    normalized_name = normalized_name.removeprefix('/')
    return normalized_name


def _is_safe_archive_member_name(name: str) -> bool:
    """Return True when an archive member name is safe to extract."""
    normalized_path = PurePosixPath(name.replace('\\', '/'))
    if normalized_path.is_absolute():
        return False
    return all(part not in ('', '.', '..') and ':' not in part for part in normalized_path.parts)


def _file_mtime_to_str(file_path: str) -> str:
    """Format file mtime as a UTC timestamp string used by signatures."""
    return datetime.fromtimestamp(os.path.getmtime(file_path), tz=UTC).strftime(DATE_FORMAT_SIMPLE)


def build_archive_root_signature(archive_path: str) -> FileSignature | None:
    """Build root-archive signature from archive path and updated time."""
    try:
        file_modified_time = _file_mtime_to_str(archive_path)
    except Exception:
        return None
    return FileSignature(
        virtual_path=f'{ARCHIVE_ROOT_SIGNATURE_PREFIX}{archive_path}',
        file_modified_time=file_modified_time,
    )


def _zip_datetime_to_str(date_time: ZipInfoDateTime) -> str:
    """Format a zip member datetime tuple to a stable timestamp string."""
    return (
        f'{date_time[0]:04d}-{date_time[1]:02d}-{date_time[2]:02d} '
        f'{date_time[3]:02d}:{date_time[4]:02d}:{date_time[5]:02d}'
    )


def _copy_stream_to_temp_file(src: BinaryIO, suffix: str) -> str:
    """Copy a binary stream to a temporary file and return its path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        shutil.copyfileobj(src, tmp_file, length=ARCHIVE_STREAM_READ_CHUNK_SIZE)
        return tmp_file.name


def _move_or_copy_file_to_temp_path(extracted_path: str, suffix: str) -> str:
    """Move extracted file to temp path, fallback to copy when move fails."""
    tmp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(tmp_fd)
    try:
        Path(extracted_path).replace(temp_path)
    except OSError:
        with open(extracted_path, 'rb') as src, open(temp_path, 'wb') as dst:
            shutil.copyfileobj(src, dst)
    return temp_path


def _copy_zip_member_to_temp_archive(zip_file: zipfile.ZipFile, info: zipfile.ZipInfo, suffix: str) -> str:
    """Materialize a nested archive member from zip into a temporary file."""
    with zip_file.open(info, 'r') as nested_src:
        return _copy_stream_to_temp_file(nested_src, suffix=suffix)


def _remove_file_if_exists(file_path: str) -> None:
    """Remove a file when present, ignore missing path."""
    if os.path.exists(file_path):
        os.remove(file_path)


def _cleanup_unconsumed_prefetch_items(
    item_queue: queue.Queue[ExtractedArchiveEntry | _PrefetchError | object],
    done_sentinel: object,
) -> None:
    """Delete temp files that were prefetched but never yielded to the consumer."""
    while True:
        try:
            item = item_queue.get_nowait()
        except queue.Empty:
            return
        if item is done_sentinel or isinstance(item, _PrefetchError):
            continue
        if isinstance(item, ExtractedArchiveEntry):
            _remove_file_if_exists(item.temp_path)


def _resolve_safe_extracted_member_path(extract_dir: str, relative_member_path: str) -> Path | None:
    """Return member path only when it stays inside the extraction directory."""
    extract_root = Path(extract_dir).resolve()
    candidate = extract_root.joinpath(*PurePosixPath(relative_member_path).parts).resolve()
    if not candidate.is_relative_to(extract_root):
        return None
    return candidate


def _get_7z_member_modified_time(file_info: object, fallback_file_path: str) -> str:
    """Read preferred 7z timestamp fields and fallback to extracted temp mtime."""
    for attr_name in ('lastwritetime', 'creationtime'):
        timestamp = getattr(file_info, attr_name, None)
        if timestamp is not None:
            with contextlib.suppress(Exception):
                return timestamp.strftime(DATE_FORMAT_SIMPLE)
    return _file_mtime_to_str(fallback_file_path)


def _iter_archive_entries_recursive(
    archive_path: str,
    base_virtual_path: str,
    target_extensions: tuple[str, ...] | None,
    max_files: int,
    nested_zip_memory_threshold: int,
    progress: _ExtractionProgress,
    archive_signature_callback: ArchiveSignatureCallback | None = None,
    archive_extraction_error_callback: ArchiveExtractionErrorCallback | None = None,
) -> Generator[ExtractedArchiveEntry, None, None]:
    """Dispatch recursive extraction based on archive type."""
    if progress.extracted_files >= max_files:
        return

    if _is_zip_file(archive_path):
        with zipfile.ZipFile(archive_path, 'r') as root_zip:
            yield from _iter_zip_entries_recursive(
                zip_file=root_zip,
                base_virtual_path=base_virtual_path,
                target_extensions=target_extensions,
                max_files=max_files,
                nested_zip_memory_threshold=nested_zip_memory_threshold,
                progress=progress,
                archive_signature_callback=archive_signature_callback,
                archive_extraction_error_callback=archive_extraction_error_callback,
            )
        return

    yield from _iter_7z_entries_recursive(
        archive_path=archive_path,
        base_virtual_path=base_virtual_path,
        target_extensions=target_extensions,
        max_files=max_files,
        nested_zip_memory_threshold=nested_zip_memory_threshold,
        progress=progress,
        archive_signature_callback=archive_signature_callback,
        archive_extraction_error_callback=archive_extraction_error_callback,
    )


def _iter_nested_archive_from_zip_member(
    zip_file: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    nested_virtual_path: str,
    target_extensions: tuple[str, ...] | None,
    max_files: int,
    nested_zip_memory_threshold: int,
    progress: _ExtractionProgress,
    archive_signature_callback: ArchiveSignatureCallback | None = None,
    archive_extraction_error_callback: ArchiveExtractionErrorCallback | None = None,
) -> Generator[ExtractedArchiveEntry, None, None]:
    """Iterate entries from a nested archive found inside a zip member."""
    if _is_zip_file(info.filename) and info.file_size <= nested_zip_memory_threshold:
        with zip_file.open(info, 'r') as nested_stream:
            nested_bytes = nested_stream.read()
        with zipfile.ZipFile(io.BytesIO(nested_bytes), 'r') as nested_zip:
            yield from _iter_zip_entries_recursive(
                zip_file=nested_zip,
                base_virtual_path=nested_virtual_path,
                target_extensions=target_extensions,
                max_files=max_files,
                nested_zip_memory_threshold=nested_zip_memory_threshold,
                progress=progress,
                archive_signature_callback=archive_signature_callback,
                archive_extraction_error_callback=archive_extraction_error_callback,
            )
        return

    nested_archive_suffix = ARCHIVE_ZIP_EXTENSION if _is_zip_file(info.filename) else ARCHIVE_SEVEN_Z_EXTENSION
    nested_archive_temp_path = _copy_zip_member_to_temp_archive(
        zip_file=zip_file,
        info=info,
        suffix=nested_archive_suffix,
    )
    try:
        yield from _iter_archive_entries_recursive(
            archive_path=nested_archive_temp_path,
            base_virtual_path=nested_virtual_path,
            target_extensions=target_extensions,
            max_files=max_files,
            nested_zip_memory_threshold=nested_zip_memory_threshold,
            progress=progress,
            archive_signature_callback=archive_signature_callback,
            archive_extraction_error_callback=archive_extraction_error_callback,
        )
    finally:
        _remove_file_if_exists(nested_archive_temp_path)


def _iter_zip_entries_recursive(
    zip_file: zipfile.ZipFile,
    base_virtual_path: str,
    target_extensions: tuple[str, ...] | None,
    max_files: int,
    nested_zip_memory_threshold: int,
    progress: _ExtractionProgress,
    archive_signature_callback: ArchiveSignatureCallback | None = None,
    archive_extraction_error_callback: ArchiveExtractionErrorCallback | None = None,
) -> Generator[ExtractedArchiveEntry, None, None]:
    """Iterate matching entries from a zip file, including nested archives."""
    for info in zip_file.infolist():
        if progress.extracted_files >= max_files:
            return
        if info.is_dir():
            continue

        member_rel_path = _normalize_archive_member_name(info.filename)
        member_file_name = os.path.basename(member_rel_path)
        member_virtual_path = _normalize_virtual_path(base_virtual_path, member_rel_path)

        if is_supported_archive_path(member_file_name):
            if archive_signature_callback is not None:
                archive_signature_callback(member_virtual_path, _zip_datetime_to_str(info.date_time))
            try:
                yield from _iter_nested_archive_from_zip_member(
                    zip_file=zip_file,
                    info=info,
                    nested_virtual_path=member_virtual_path,
                    target_extensions=target_extensions,
                    max_files=max_files,
                    nested_zip_memory_threshold=nested_zip_memory_threshold,
                    progress=progress,
                    archive_signature_callback=archive_signature_callback,
                    archive_extraction_error_callback=archive_extraction_error_callback,
                )
            except Exception as ex:
                if archive_extraction_error_callback is not None:
                    archive_extraction_error_callback(member_virtual_path, ex)
            continue

        if not _matches_target_extension(member_file_name, target_extensions):
            continue

        suffix = Path(member_file_name).suffix or ARCHIVE_DEFAULT_EXTRACTED_FILE_SUFFIX
        with zip_file.open(info, 'r') as src:
            temp_path = _copy_stream_to_temp_file(src, suffix=suffix)

        progress.extracted_files += 1
        yield ExtractedArchiveEntry(
            temp_path=temp_path,
            virtual_path=member_virtual_path,
            file_name=member_file_name,
            file_modified_time=_zip_datetime_to_str(info.date_time),
        )


def _iter_7z_entries_recursive(
    archive_path: str,
    base_virtual_path: str,
    target_extensions: tuple[str, ...] | None,
    max_files: int,
    nested_zip_memory_threshold: int,
    progress: _ExtractionProgress,
    archive_signature_callback: ArchiveSignatureCallback | None = None,
    archive_extraction_error_callback: ArchiveExtractionErrorCallback | None = None,
) -> Generator[ExtractedArchiveEntry, None, None]:
    """Iterate matching entries from a 7z file, including nested archives."""
    with py7zr.SevenZipFile(archive_path, 'r') as archive:
        file_infos = [file_info for file_info in archive.list() if file_info.is_file]
        for file_info in file_infos:
            if progress.extracted_files >= max_files:
                return

            member_rel_path = _normalize_archive_member_name(file_info.filename)
            member_file_name = os.path.basename(member_rel_path)
            member_virtual_path = _normalize_virtual_path(base_virtual_path, member_rel_path)

            if not _is_safe_archive_member_name(file_info.filename):
                continue

            if not is_supported_archive_path(member_file_name) and not _matches_target_extension(
                member_file_name, target_extensions
            ):
                continue

            with tempfile.TemporaryDirectory() as extract_dir:
                archive.reset()
                archive.extract(path=extract_dir, targets=[file_info.filename])

                extracted_path = _resolve_safe_extracted_member_path(extract_dir, member_rel_path)
                if extracted_path is None or not extracted_path.is_file():
                    continue

                if is_supported_archive_path(member_file_name):
                    if archive_signature_callback is not None:
                        archive_signature_callback(
                            member_virtual_path,
                            _get_7z_member_modified_time(file_info, str(extracted_path)),
                        )
                    try:
                        yield from _iter_archive_entries_recursive(
                            archive_path=str(extracted_path),
                            base_virtual_path=member_virtual_path,
                            target_extensions=target_extensions,
                            max_files=max_files,
                            nested_zip_memory_threshold=nested_zip_memory_threshold,
                            progress=progress,
                            archive_signature_callback=archive_signature_callback,
                            archive_extraction_error_callback=archive_extraction_error_callback,
                        )
                    except Exception as ex:
                        if archive_extraction_error_callback is not None:
                            archive_extraction_error_callback(member_virtual_path, ex)
                    continue

                suffix = Path(member_file_name).suffix or ARCHIVE_DEFAULT_EXTRACTED_FILE_SUFFIX
                temp_path = _move_or_copy_file_to_temp_path(str(extracted_path), suffix=suffix)

            progress.extracted_files += 1
            yield ExtractedArchiveEntry(
                temp_path=temp_path,
                virtual_path=member_virtual_path,
                file_name=member_file_name,
                file_modified_time=_get_7z_member_modified_time(file_info, temp_path),
            )


def expand_archive_sources_to_temp_files(
    source_files: FilePaths,
    target_extensions: set[str] | None,
    max_files: int = ARCHIVE_EXPANSION_MAX_FILES_DEFAULT,
    nested_zip_memory_threshold: int = ARCHIVE_NESTED_ZIP_MEMORY_THRESHOLD_DEFAULT,
    include_non_archive_sources: bool = True,
    return_metadata: bool = False,
) -> ArchiveExpansionOutput:
    """Expand ZIP/7z sources into importable files.

    Returns:
    - `FilePaths` or `list[ExtractedArchiveEntry]`: Expanded import targets.
    - `TempFilePaths`: Temporary files to clean up.
    """
    normalized_extensions = _normalize_target_extensions(target_extensions)
    expanded_files: FilePaths = []
    extracted_entries: list[ExtractedArchiveEntry] = []
    temp_files: TempFilePaths = []
    progress = _ExtractionProgress()

    for source_path in source_files:
        if not is_supported_archive_path(source_path):
            if include_non_archive_sources:
                expanded_files.append(source_path)
            continue

        try:
            for extracted_entry in _iter_archive_entries_recursive(
                archive_path=source_path,
                base_virtual_path=os.path.basename(source_path),
                target_extensions=normalized_extensions,
                max_files=max_files,
                nested_zip_memory_threshold=nested_zip_memory_threshold,
                progress=progress,
            ):
                temp_files.append(extracted_entry.temp_path)
                if return_metadata:
                    extracted_entries.append(extracted_entry)
                else:
                    expanded_files.append(extracted_entry.temp_path)
        except Exception:
            logger.exception('Failed to expand archive source: {}', source_path)
            continue

    if return_metadata:
        return extracted_entries, temp_files
    return expanded_files, temp_files


def cleanup_temp_files(temp_files: TempFilePaths) -> None:
    """Delete temporary files generated during archive expansion."""
    for temp_file in temp_files:
        _remove_file_if_exists(temp_file)


class RecursiveArchiveProcessor:
    """Process files recursively inside archive and store processed signatures in sqlite.

    Behavior:
    - Walk archive recursively and extract supported member files to temp paths
    - Insert success/failed signatures for root + nested archive files
    - Support zip/7z and nested archives

    Signature key:
    - virtual_path
    - file_modified_time
    """

    def __init__(
        self,
        process_id: int,
        job_id: int | None,
        archive_path: str,
        target_extensions: set[str] | None = None,
        max_files: int = ARCHIVE_MAX_FILES_DEFAULT,
        nested_zip_memory_threshold: int = ARCHIVE_NESTED_ZIP_MEMORY_THRESHOLD_DEFAULT,
        streaming_prefetch_queue_size: int = ARCHIVE_STREAMING_PREFETCH_QUEUE_SIZE_DEFAULT,
    ) -> None:
        self.process_id = process_id
        self.job_id = job_id
        self.archive_path = archive_path
        self.root_file_name = os.path.basename(archive_path)
        self.target_extensions = _normalize_target_extensions(target_extensions)
        self.max_files = max_files
        self.nested_zip_memory_threshold = nested_zip_memory_threshold
        self.streaming_prefetch_queue_size = max(1, streaming_prefetch_queue_size)
        self.temp_files: TempFilePaths = []
        self._discovered_archive_signatures: dict[str, FileSignature] = {}
        self._failed_archive_virtual_paths: set[str] = set()
        self._root_archive_virtual_path: str | None = None
        self._streaming_tracking_active = False
        self._streaming_exhausted = False
        self._streaming_pending_entries = 0
        self._streaming_failed = False
        self._streamed_entry_count = 0
        self._archive_signatures_marked = False

    def initialize(self) -> None:
        """Create processed signature table + indexes if not exists."""
        init_processed_signature_table(self.process_id)

    def process(self, file_handler: FileEntryHandler) -> None:
        """Extract archive members and process each member with the provided handler."""
        self._initialize_processing()

        for extracted_entry in self._iter_extracted_entries():
            entry = self._prepare_entry_for_processing(extracted_entry)
            self._process_single_file(entry=entry, file_handler=file_handler)

    def process_streaming(
        self,
        file_handler: FileEntryHandler,
    ) -> tuple[int, list[object]]:
        """Process archive members one-by-one.

        Returns:
            A tuple:
            - Number of matched target files found inside archive
            - Non-None handler outputs collected during traversal
        """
        self._initialize_processing()
        matched_files = 0
        handler_outputs: list[object] = []

        for extracted_entry in self._iter_extracted_entries_with_prefetch():
            matched_files += 1
            entry = self._prepare_entry_for_processing(extracted_entry)
            self._run_file_handler(
                entry=entry,
                file_handler=file_handler,
                handler_outputs=handler_outputs,
            )

        return matched_files, handler_outputs

    def iter_streaming_entries(self) -> Generator[FileEntry, None, None]:
        """Yield unprocessed archive members as temp files, one entry at a time."""
        self._initialize_processing()
        self._begin_streaming_tracking()
        completed = False
        try:
            for extracted_entry in self._iter_extracted_entries_with_prefetch():
                entry = self._prepare_entry_for_processing(extracted_entry)
                self._streaming_pending_entries += 1
                self._streamed_entry_count += 1
                yield entry
            completed = True
        except GeneratorExit:
            self._streaming_failed = True
            raise
        except Exception:
            self._streaming_failed = True
            raise
        finally:
            self._streaming_exhausted = completed
            if completed:
                self._try_finalize_archive_signatures()

    def _initialize_processing(self) -> None:
        self.initialize()
        self.temp_files = []

    def _iter_extracted_entries(self) -> Generator[ExtractedArchiveEntry, None, None]:
        """Yield extracted entries from root archive with configured limits."""
        yield from _iter_archive_entries_recursive(
            archive_path=self.archive_path,
            base_virtual_path=self.root_file_name,
            target_extensions=self.target_extensions,
            max_files=self.max_files,
            nested_zip_memory_threshold=self.nested_zip_memory_threshold,
            progress=_ExtractionProgress(),
            archive_signature_callback=self._register_discovered_archive_signature,
            archive_extraction_error_callback=self._on_archive_extraction_error,
        )

    def _iter_extracted_entries_with_prefetch(self) -> Generator[ExtractedArchiveEntry, None, None]:
        """Yield extracted entries while prefetching extraction in a background thread."""
        # NOTE:
        # Prefetch does not reduce time-to-first-entry: consumer still waits for
        # the first extracted item.
        # It improves steady-state throughput by pipelining:
        # - producer thread extracts next entries
        # - consumer thread processes current entry
        # Net gain appears only when processing and extraction can overlap enough
        # to amortize queue/thread overhead.
        # Easy timeline (3 entries, extract=100ms, process=80ms):
        # - No prefetch:
        #   t=100 E1 ready -> t=180 P1 done -> t=280 E2 ready -> t=360 P2 done
        #   -> t=460 E3 ready -> t=540 P3 done
        # - With prefetch:
        #   t=100 E1 ready (same first-item wait), start P1 while extracting E2
        #   -> t=180 P1 done, E2 already waiting
        #   -> t=260 P2 done, E3 already waiting
        #   -> t=340 P3 done (+queue/thread overhead)
        if self.streaming_prefetch_queue_size <= 1:
            yield from self._iter_extracted_entries()
            return

        item_queue: queue.Queue[ExtractedArchiveEntry | _PrefetchError | object] = queue.Queue(
            maxsize=self.streaming_prefetch_queue_size,
        )
        stop_event = threading.Event()
        done_sentinel = object()

        def _producer() -> None:
            try:
                for extracted_entry in self._iter_extracted_entries():
                    if stop_event.is_set():
                        break
                    while not stop_event.is_set():
                        try:
                            item_queue.put(extracted_entry, timeout=0.2)
                            break
                        except queue.Full:
                            continue
            except BaseException as ex:
                if not stop_event.is_set():
                    while not stop_event.is_set():
                        try:
                            item_queue.put(_PrefetchError(ex), timeout=0.2)
                            break
                        except queue.Full:
                            continue
            finally:
                while True:
                    try:
                        item_queue.put(done_sentinel, timeout=0.2)
                        break
                    except queue.Full:
                        if stop_event.is_set():
                            break

        producer_thread = threading.Thread(target=_producer, daemon=True, name='archive-entry-prefetch')
        producer_thread.start()
        try:
            while True:
                item = item_queue.get()
                if item is done_sentinel:
                    break
                if isinstance(item, _PrefetchError):
                    raise item.error
                yield item
        finally:
            stop_event.set()
            producer_thread.join(timeout=1.0)
            _cleanup_unconsumed_prefetch_items(item_queue, done_sentinel)

    def _prepare_entry_for_processing(
        self,
        extracted_entry: ExtractedArchiveEntry,
    ) -> FileEntry:
        """Build processing models for extracted entries.

        Archive-level dedup is handled by root archive signature checks.
        Member CSV files are always returned for processing once archive is selected.
        """
        entry = FileEntry(
            archive_path=self.archive_path,
            root_file_name=self.root_file_name,
            file_name=extracted_entry.file_name,
            virtual_path=extracted_entry.virtual_path,
            file_modified_time=extracted_entry.file_modified_time,
            temp_path=extracted_entry.temp_path,
        )
        self.temp_files.append(entry.temp_path)
        return entry

    def _process_single_file(
        self,
        entry: FileEntry,
        file_handler: FileEntryHandler,
    ) -> None:
        """Process one extracted file with the provided handler."""
        self._run_file_handler(
            entry=entry,
            file_handler=file_handler,
            handler_outputs=None,
        )

    def _run_file_handler(
        self,
        entry: FileEntry,
        file_handler: FileEntryHandler,
        handler_outputs: list[object] | None,
    ) -> None:
        """Execute handler for one extracted member.

        Member-level signatures are not persisted; archive-level status is tracked
        when using streaming flow (`iter_streaming_entries` + `mark_*`).
        """
        result = file_handler(entry)
        if handler_outputs is not None:
            if isinstance(result, list):
                handler_outputs.extend(result)
            elif result is not None:
                handler_outputs.append(result)

    def mark_success(self, entry: FileEntry) -> None:
        """Record successful processing completion for streaming bookkeeping."""
        self._on_streamed_entry_finalized(entry=entry, success=True)

    def mark_failed(self, entry: FileEntry, _error_msg: str) -> None:
        """Record failed processing completion for streaming bookkeeping."""
        self._on_streamed_entry_finalized(entry=entry, success=False)

    def _insert_signature_record(
        self,
        signature: FileSignature,
        file_name: str | None,
        virtual_path: str,
        status: str,
        error_msg: str | None,
    ) -> None:
        """Insert a signature record with a specific status into metadata DB."""
        ImportProcessedSignatureTable.insert_status_record(
            process_id=self.process_id,
            job_id=self.job_id,
            file_name=file_name or self.root_file_name,
            virtual_path=virtual_path,
            file_modified_time=signature.file_modified_time,
            status=status,
            error_msg=error_msg,
        )

    def _begin_streaming_tracking(self) -> None:
        root_signature = build_archive_root_signature(self.archive_path)
        self._discovered_archive_signatures = {}
        self._failed_archive_virtual_paths = set()
        self._root_archive_virtual_path = None
        if root_signature is not None:
            self._discovered_archive_signatures[root_signature.virtual_path] = root_signature
            self._root_archive_virtual_path = root_signature.virtual_path
        self._streaming_tracking_active = True
        self._streaming_exhausted = False
        self._streaming_pending_entries = 0
        self._streaming_failed = False
        self._streamed_entry_count = 0
        self._archive_signatures_marked = False

    def _register_discovered_archive_signature(self, virtual_path: str, file_modified_time: str) -> None:
        self._discovered_archive_signatures[virtual_path] = FileSignature(
            virtual_path=virtual_path,
            file_modified_time=file_modified_time,
        )

    def _on_archive_extraction_error(self, virtual_path: str, _error: BaseException) -> None:
        if self._streaming_tracking_active:
            self._streaming_failed = True
            self._failed_archive_virtual_paths.add(virtual_path)

    def _on_streamed_entry_finalized(self, entry: FileEntry, success: bool) -> None:
        if not self._streaming_tracking_active:
            return
        if self._streaming_pending_entries > 0:
            self._streaming_pending_entries -= 1
        if not success:
            self._streaming_failed = True
            self._mark_containing_archives_failed(entry)
        self._try_finalize_archive_signatures()

    def _mark_containing_archives_failed(self, entry: FileEntry) -> None:
        """Mark nested archive signatures that contain a failed streamed member."""
        for virtual_path in self._discovered_archive_signatures:
            if virtual_path == self._root_archive_virtual_path:
                continue
            if entry.virtual_path.startswith(f'{virtual_path}!/'):
                self._failed_archive_virtual_paths.add(virtual_path)

    def _try_finalize_archive_signatures(self) -> None:
        if not self._streaming_tracking_active:
            return
        if self._archive_signatures_marked:
            return
        if not self._streaming_exhausted or self._streaming_pending_entries > 0:
            return
        if not self._discovered_archive_signatures:
            return
        if self._streamed_entry_count == 0 and not self.temp_files and not self._streaming_failed:
            return

        for signature in self._discovered_archive_signatures.values():
            is_failed = signature.virtual_path in self._failed_archive_virtual_paths or (
                signature.virtual_path == self._root_archive_virtual_path and self._streaming_failed
            )
            status = ARCHIVE_SIGNATURE_STATUS_FAILED if is_failed else ARCHIVE_SIGNATURE_STATUS_SUCCESS
            error_msg = ROOT_ARCHIVE_FAILED_MSG if is_failed else None
            self._insert_signature_record(
                signature=signature,
                file_name=self.root_file_name,
                virtual_path=signature.virtual_path,
                status=status,
                error_msg=error_msg,
            )
        self._archive_signatures_marked = True
