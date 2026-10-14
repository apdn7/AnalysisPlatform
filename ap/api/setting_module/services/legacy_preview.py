"""Read-only legacy preview JSON support for the one-time migration path.

Runtime preview requests use Internal data and Preview Parquet exclusively. This
module deliberately keeps legacy JSON parsing separate so PV-40 can consume it
without reintroducing JSON reads into controllers or normal preview services.
"""

from __future__ import annotations

import json
from os import PathLike, fspath
from pathlib import Path
from typing import Any


def load_legacy_preview_for_migration(
    preview_file: str | PathLike[str] | Any,
    *,
    limit: int | None = None,
) -> dict[str, Any] | None:
    """Return one legacy JSON payload only for a future migration operation."""
    preview_path = Path(_resolve_preview_file_path(preview_file))
    if not preview_path.is_file():
        return None

    try:
        payload = json.loads(preview_path.read_text(encoding='utf-8'))
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    if not isinstance(payload, dict):
        return None
    if limit is not None:
        payload['rows'] = payload.get('rows', [])[:limit]
    return payload


def _resolve_preview_file_path(preview_file: str | PathLike[str] | Any) -> str:
    if isinstance(preview_file, (str, PathLike)):
        return fspath(preview_file)
    return fspath(preview_file.name)
