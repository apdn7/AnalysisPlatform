from __future__ import annotations

import codecs
import errno
import io
import os
import stat
from pathlib import Path

from ap.api.efa.services.etl import detect_file_stream_delimiter
from ap.common.common_utils import detect_encoding
from ap.common.constants import CsvDelimiter, CSVExtTypes
from ap.common.path_utils import (
    filter_files_by_select_condition,
    get_csv_source_extensions,
    get_files,
    resolve_csv_custom_extension,
)

CSV_TARGET_FILES_LIMIT = 100
CSV_TARGET_FILES_SAMPLE_BYTES = 64 * 1024


def _matches_delimiter(path: str, delimiter: str) -> bool:
    with open(path, 'rb') as source:
        sample = source.read(CSV_TARGET_FILES_SAMPLE_BYTES)
    if not sample:
        return False
    encoding = detect_encoding(io.BytesIO(sample))
    text = codecs.getincrementaldecoder(encoding)().decode(sample, final=False)
    delimiters = (CsvDelimiter.CSV.value, CsvDelimiter.TSV.value, CsvDelimiter.SMC.value)
    if not any(candidate in text for candidate in delimiters):
        return False
    return detect_file_stream_delimiter(io.StringIO(text), default_delimiter=None) == delimiter


def list_csv_target_files(
    url: str,
    *,
    file_name_include: str | None = None,
    file_name_exclude: str | None = None,
    subfolder_include: str | None = None,
    subfolder_exclude: str | None = None,
    file_type: str | None = None,
    custom_extension: str | None = None,
    etl_func: str | None = None,
) -> tuple[list[str], bool]:
    """List source paths only, before import history, ETL, or archive expansion.

    Directory discovery uses the importer's depth and default suffix rules in Auto mode.
    Explicit file types filter bounded content samples by detected delimiter, excluding
    archives without opening them. Custom suffixes apply only with an optional function;
    they take precedence and do not read contents.
    Single-file sources ignore regex filters.
    Files are relative to the source directory (or the single source's parent), with
    portable `/` separators. Strict discovery prevents silently incomplete results.
    """
    file_type_delimiters = {
        'CSV': CsvDelimiter.CSV.value,
        'TSV': CsvDelimiter.TSV.value,
        'SMC': CsvDelimiter.SMC.value,
    }
    file_type = 'Auto' if file_type is None else file_type
    if file_type != 'Auto' and file_type not in file_type_delimiters:
        raise ValueError('File not valid')
    custom_extension = resolve_csv_custom_extension(custom_extension, etl_func)
    extensions = get_csv_source_extensions(custom_extension=custom_extension)
    source_path = Path(os.path.normpath(url)).absolute()
    source = str(source_path)
    source_stat = source_path.stat()
    if stat.S_ISREG(source_stat.st_mode):
        if not any(source.lower().endswith(extension) for extension in extensions):
            raise ValueError('File not valid')
        candidates = [source]
        root = os.path.dirname(source)
    elif stat.S_ISDIR(source_stat.st_mode):
        root = source
        candidates = filter_files_by_select_condition(
            sorted(
                (
                    path.replace(os.sep, '/')
                    for path in get_files(source, depth_from=1, depth_to=100, extension=extensions, raise_on_error=True)
                ),
                reverse=True,
            ),
            source,
            file_name_include=file_name_include,
            file_name_exclude=file_name_exclude,
            subfolder_include=subfolder_include,
            subfolder_exclude=subfolder_exclude,
        )
    else:
        raise ValueError('File not valid')

    # Peek after all filters, including content detection, so truncation counts matching files.
    peek = []
    for path in candidates:
        if custom_extension is None and file_type != 'Auto':
            if path.lower().endswith((CSVExtTypes.ZIP.value, CSVExtTypes.SEVEN_Z.value)):
                continue
            if not _matches_delimiter(path, file_type_delimiters[file_type]):
                continue
        peek.append(path)
        if len(peek) > CSV_TARGET_FILES_LIMIT:
            break
    for path in peek:
        Path(path).stat()
        if not os.access(path, os.R_OK):
            raise PermissionError(errno.EACCES, 'Access denied', path)
    return (
        [os.path.relpath(path, root).replace(os.sep, '/') for path in peek[:CSV_TARGET_FILES_LIMIT]],
        len(peek) > CSV_TARGET_FILES_LIMIT,
    )
