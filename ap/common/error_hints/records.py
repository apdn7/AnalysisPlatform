"""Capture language-neutral error records and manage per-operation error state."""

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from traceback import TracebackException, extract_stack, format_list
from typing import Self

from pydantic import BaseModel, ConfigDict, Field

from .formatting import format_error_record, format_frame_context
from .hints import ERROR_HINTS, ErrorHint


class ErrorRecord(BaseModel):
    """Serializable original error details without translated hint text or live frames.

    ``filename``, ``line_no`` and ``function`` identify the innermost source-code
    frame, not the input data file. ``call_stack`` is the capture-site stack.
    ``context`` contains nearby source lines for up to four traceback frames.
    ``args`` stores the tuple's text representation, not potentially non-serializable
    argument objects. ``source_file``, ``errno`` and ``strerror`` snapshot the
    exception attributes as text for the diagnostic output.
    """

    model_config = ConfigDict(frozen=True, extra='forbid')

    exception: str
    message: str
    traceback: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    filename: str | None = None
    line_no: int | None = None
    function: str | None = None
    call_stack: str = ''
    context: str = ''
    args: str | None = None
    module: str | None = None
    source_file: str | None = None
    errno: str | None = None
    strerror: str | None = None

    @classmethod
    def capture(cls, error: BaseException) -> Self:
        """Capture the supplied exception, including chained tracebacks, without frame locals.

        Unlike ``traceback.format_exc()``, this also works after leaving the
        ``except`` block, provided the exception still carries its traceback.
        """
        if not isinstance(error, BaseException):
            raise TypeError('Expected a BaseException instance')

        trace = TracebackException.from_exception(error)
        frames = list(enumerate(trace.stack))
        context_frames = frames if len(frames) <= 4 else frames[:2] + frames[-2:]
        last_frame = trace.stack[-1] if trace.stack else None
        source_file = getattr(error, 'filename', None)
        errno = getattr(error, 'errno', None)
        strerror = getattr(error, 'strerror', None)
        return cls(
            exception=type(error).__name__,
            message=str(error),
            traceback=''.join(trace.format(chain=True)),
            filename=Path(last_frame.filename).name if last_frame else None,
            line_no=last_frame.lineno if last_frame else None,
            function=last_frame.name if last_frame else None,
            call_stack=''.join(format_list(extract_stack(limit=4)[:-1])),
            context='\n\n'.join(f'[{index}]:{format_frame_context(frame)}' for index, frame in context_frames),
            args=str(error.args),
            module=type(error).__module__,
            source_file=str(source_file) if source_file is not None else None,
            errno=str(errno) if errno is not None else None,
            strerror=str(strerror) if strerror is not None else None,
        )

    def to_text(self) -> str:
        """Return the notebook's diagnostic layout without writing a file or translating it."""
        return format_error_record(self)

    def get_hint(self) -> ErrorHint:
        """Resolve display text in the current locale without changing the stored record."""
        return ERROR_HINTS.get(self.exception)


@dataclass
class ErrorInfo:
    """Reusable capture state, analogous to ``self.err`` in the example notebook.

    ``capture()`` returns the record to serialize; ``record`` holds the latest
    capture or ``None`` after ``clear()``. No live exception object is retained.
    """

    record: ErrorRecord | None = None

    def clear(self) -> None:
        self.record = None

    def capture(self, error: BaseException) -> ErrorRecord:
        """Replace previous error state and return a record ready for serialization."""
        self.clear()
        self.record = ErrorRecord.capture(error)
        return self.record

    def to_text(self) -> str:
        """Return the latest captured error's text; capturing an error is required first."""
        if self.record is None:
            raise ValueError('No error has been captured')
        return self.record.to_text()
