"""Capture errors and build localized GUI payloads without persistence or transport.

Existing imports from ``ap.common.error_hints`` remain the public API.
Database transactions, HTTP status codes and access control belong to callers.
"""

from .catalog import ERROR_HINT_DEFINITIONS, ErrorHintDefinition
from .formatting import format_frame_context
from .hints import ERROR_HINTS, ErrorHint, ErrorHints
from .payloads import ErrorDetailsPayload, ErrorPayload, build_error_payload
from .records import ErrorInfo, ErrorRecord

__all__ = [
    'ERROR_HINTS',
    'ERROR_HINT_DEFINITIONS',
    'ErrorDetailsPayload',
    'ErrorHint',
    'ErrorHintDefinition',
    'ErrorHints',
    'ErrorInfo',
    'ErrorPayload',
    'ErrorRecord',
    'build_error_payload',
    'format_frame_context',
]
