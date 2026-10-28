"""Build shared GUI payloads without persistence, HTTP or event transport side effects."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, StrictInt, StrictStr

from .hints import ERROR_HINTS, ErrorHint, ErrorHints
from .records import ErrorRecord


class ErrorDetailsPayload(BaseModel):
    """Error data for display; id is supplied only when known by the caller."""

    model_config = ConfigDict(frozen=True, extra='forbid')

    id: StrictInt | StrictStr | None = None
    exception: str
    message: str
    occurred_at: datetime
    hint: ErrorHint
    details_text: str | None = None


class ErrorPayload(BaseModel):
    """Transport-neutral error envelope shared by API and background-event callers."""

    model_config = ConfigDict(frozen=True, extra='forbid')

    error: ErrorDetailsPayload


def build_error_payload(
    record: ErrorRecord,
    *,
    error_id: int | str | None = None,
    include_details: bool = True,
    hints: ErrorHints = ERROR_HINTS,
) -> ErrorPayload:
    """Build a display snapshot from an existing record without capturing or saving again.

    Full original details are included by default. Callers must check access
    before sending the result. With ``include_details=False``, the original
    message is replaced by the localized hint name and diagnostic text is omitted.
    HTTP status codes and persistence failures remain the caller's responsibility.
    """
    if not isinstance(record, ErrorRecord):
        raise TypeError('Expected an ErrorRecord instance')
    if not isinstance(include_details, bool):
        raise TypeError('include_details must be a bool')

    hint = hints.get(record.exception)
    return ErrorPayload(
        error=ErrorDetailsPayload(
            id=error_id,
            exception=record.exception,
            message=record.message if include_details else hint.name,
            occurred_at=record.occurred_at,
            hint=hint,
            details_text=record.to_text() if include_details else None,
        ),
    )
