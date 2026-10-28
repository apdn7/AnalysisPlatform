"""Format captured diagnostic text and source-frame context."""

from __future__ import annotations

from linecache import getline
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from traceback import FrameSummary

    from .records import ErrorRecord


def format_frame_context(frame: FrameSummary, context: int = 2) -> str:
    """Format a source frame with nearby lines; unavailable source leaves only the header."""
    if context < 0:
        raise ValueError('Source context must not be negative')

    lines = [f'File "{Path(frame.filename).name}", line {frame.lineno}, in {frame.name}']
    if frame.lineno is not None:
        for line_no in range(max(1, frame.lineno - context), frame.lineno + context + 1):
            source = getline(frame.filename, line_no)
            if source:
                marker = '---->' if line_no == frame.lineno else '     '
                lines.append(f'{marker} {line_no:4} {source.rstrip()}')
    return '\n'.join(lines)


def format_error_record(record: ErrorRecord) -> str:
    """Return the notebook's diagnostic layout without I/O or translation."""
    return (
        f'Location   : File: {record.filename}  Func: {record.function}  Line: {record.line_no}\n'
        f'Time       : {record.occurred_at:%Y-%m-%d %H:%M:%S}\n'
        f'Exception  : {record.exception}\n'
        f'Message    : {record.message}\n'
        f'Args       : {record.args}\n'
        f'Module     : {record.module}\n'
        f'File       : {record.source_file}\n'
        f'Errno      : {record.errno}\n'
        f'StrError   : {record.strerror}\n'
        f'Call stack :\n{record.call_stack or ""}\n'
        f'Context    :\n{record.context or ""}\n\n'
        f'Traceback  :\n{record.traceback or "<no traceback>"}'
    )
