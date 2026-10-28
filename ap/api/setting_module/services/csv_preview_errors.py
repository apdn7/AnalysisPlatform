"""Persist the latest Show outcome on each explicit datasource save."""

from copy import deepcopy
from functools import wraps
from secrets import compare_digest, token_urlsafe
from time import perf_counter
from typing import Any, Literal, Self
from uuid import uuid4

from flask import current_app, jsonify, make_response, request
from flask import session as browser_session
from flask_babel import gettext as _
from itsdangerous import BadData, URLSafeSerializer
from loguru import logger
from pydantic import BaseModel, Field, model_validator

from ap.common.common_utils import get_current_timestamp
from ap.common.constants import DATE_FORMAT_STR, JobType
from ap.common.error_hints import ErrorRecord, build_error_payload
from ap.common.jobs.job_info_schema import CsvPreviewJobInfo
from ap.setting_module.models import CfgDataSource, JobManagement


class PendingCsvPreview(BaseModel):
    """Language-neutral preview outcome authenticated by the application."""

    preview_id: str
    owner: str
    status: Literal['DONE', 'FAILED'] = 'FAILED'
    error_record: ErrorRecord | None = None
    source_path: str | None = None
    stage: str
    start_tm: str
    duration: float = Field(ge=0, allow_inf_nan=False)
    end_tm: str | None = None
    previewed_files: list[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_outcome(self) -> Self:
        if (self.status == 'FAILED') != (self.error_record is not None):
            raise ValueError('Only failed previews must contain an error record')
        if self.status == 'DONE' and not self.end_tm:
            raise ValueError('Successful previews require an end timestamp')
        return self


def _preview_serializer() -> URLSafeSerializer:
    return URLSafeSerializer(current_app.secret_key, salt='csv-preview-errors-v1')


def initialize_csv_preview_owner() -> str:
    return browser_session.setdefault('csv_preview_owner', token_urlsafe(32))


def prepare_csv_preview_save(data: dict) -> tuple[dict, list[tuple[str, PendingCsvPreview]]]:
    """Copy configuration and authenticate every pending outcome before writes."""
    config = deepcopy(data)
    tokens = []
    for key in ('preview_tokens', 'preview_error_tokens'):
        submitted = config.pop(key, [])
        if not isinstance(submitted, list) or any(not isinstance(token, str) for token in submitted):
            raise ValueError(f'{key} must be an array of signed strings')
        tokens.extend(submitted)
    pending = []
    for token in dict.fromkeys(tokens):
        try:
            captured = PendingCsvPreview.model_validate(_preview_serializer().loads(token))
        except (BadData, ValueError, TypeError) as error:
            raise ValueError('Invalid CSV preview error token') from error
        owner = browser_session.get('csv_preview_owner')
        if not isinstance(owner, str) or not compare_digest(captured.owner, owner):
            raise ValueError('CSV preview error token belongs to a different session')
        pending.append((token, captured))
    return config, pending


def _job_history(job: JobManagement) -> dict:
    return {
        'job_id': job.id,
        'db_code': job.db_code,
        'process_master_name': job.process_name if job.process_id is not None else None,
        'start_tm': job.start_tm,
        'duration': round(job.duration, 2),
        'status': job.status,
        'previewed_files': job.info.previewed_files,
    }


class CsvPreviewValidationFailure(Exception):
    """Carry a validation error without fabricating an I/O traceback."""

    def __init__(self, error: Exception, body: dict, status: int) -> None:
        super().__init__(str(error))
        self.error = error
        self.body = body
        self.status = status


def preview_validation_response(error: Exception, body: dict, status: int = 200):
    """Keep legacy validation responses unchanged unless Show requested tracking."""
    if 'preview_context' in (request.get_json(silent=True) or {}):
        raise CsvPreviewValidationFailure(error, body, status)
    return jsonify(body), status


def save_csv_preview_outcomes(
    session,
    source: CfgDataSource,
    pending: list[tuple[str, PendingCsvPreview]],
) -> list[dict]:
    """Insert the latest preview on every save in the datasource transaction."""
    if not pending:
        return []
    _, latest = max(enumerate(pending), key=lambda entry: (entry[1][1].start_tm, entry[0]))
    pending = [latest]
    session.flush()
    if source.id is None or session.get(CfgDataSource, source.id) is not source:
        raise ValueError('CSV preview errors require a saved datasource')
    results = []
    for token, captured in pending:
        end_tm = captured.end_tm
        if not end_tm and captured.error_record is not None:
            end_tm = captured.error_record.occurred_at.strftime(DATE_FORMAT_STR)
        job = JobManagement(
            job_type=JobType.CSV_PREVIEW.name,
            db_code=source.id,
            db_name=source.name,
            process_name=None,
            start_tm=captured.start_tm,
            end_tm=end_tm,
            status=captured.status,
            done_percent=100 if captured.status == 'DONE' else 0,
            duration=round(captured.duration, 6),
            info=CsvPreviewJobInfo(
                error_record=captured.error_record,
                source_path=captured.source_path,
                source_name=source.name,
                stage=captured.stage,
                preview_id=captured.preview_id,
                previewed_files=captured.previewed_files,
            ),
        )
        session.add(job)
        session.flush()
        result = {
            'preview_token': token,
            'load_history': _job_history(job),
            'preview_persisted': True,
        }
        if captured.error_record is not None:
            result.update(build_error_payload(captured.error_record, error_id=job.id).model_dump(mode='json'))
            result['error_persisted'] = True
        results.append(result)
    return results


def _pending_preview_payload(
    data: dict,
    stage: str,
    start_tm: str,
    started: float,
    *,
    record: ErrorRecord | None = None,
    previewed_files: list[str] | None = None,
) -> dict:
    context = data.get('preview_context')
    source_id = context.get('db_code') if isinstance(context, dict) else None
    source_id = source_id if type(source_id) is int and source_id > 0 else None
    source_path = data.get('url', data.get('path'))
    captured = PendingCsvPreview(
        preview_id=uuid4().hex,
        owner=initialize_csv_preview_owner(),
        status='FAILED' if record is not None else 'DONE',
        error_record=record,
        source_path=source_path if isinstance(source_path, str) else None,
        stage=stage,
        start_tm=start_tm,
        end_tm=record.occurred_at.strftime(DATE_FORMAT_STR) if record else get_current_timestamp(),
        duration=perf_counter() - started,
        previewed_files=previewed_files or [],
    )
    result = {
        'load_history': {
            'job_id': None,
            'db_code': source_id,
            'process_master_name': None,
            'start_tm': start_tm,
            'duration': round(captured.duration, 2),
            'status': captured.status,
            'previewed_files': captured.previewed_files,
        },
        'preview_persisted': False,
        'preview_token': _preview_serializer().dumps(captured.model_dump(mode='json')),
    }
    if record is not None:
        result.update(build_error_payload(record).model_dump(mode='json'))
        result['error_persisted'] = False
    return result


def track_csv_preview(handler):
    """Track only requests explicitly originating from the Show button."""

    @wraps(handler)
    def wrapped(*args: Any, **kwargs: Any):
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or 'preview_context' not in data:
            return handler(*args, **kwargs)

        start_tm, started = get_current_timestamp(), perf_counter()
        context = data['preview_context']
        try:
            if not isinstance(context, dict):
                raise ValueError('preview_context must be an object')
            source_id = context.get('db_code')
            if source_id is not None and (type(source_id) is not int or source_id <= 0):
                raise ValueError('preview_context.db_code must be a positive integer or null')
            if context.get('db_name') is not None and not isinstance(context['db_name'], str):
                raise ValueError('preview_context.db_name must be a string or null')
            result = handler(*args, **kwargs)
            if handler.__name__ == 'get_csv_resources':
                response = make_response(result)
                if 200 <= response.status_code < 300:
                    body = response.get_json()
                    body.update(
                        _pending_preview_payload(
                            data,
                            handler.__name__,
                            start_tm,
                            started,
                            previewed_files=body['previewed_files'],
                        )
                    )
                    response.set_data(current_app.json.dumps(body))
                return response
            return result
        except CsvPreviewValidationFailure as failure:
            error, body, status = failure.error, failure.body, failure.status
        except Exception as failure:
            error = failure
            body = {'err_msg': _('Error Msg Common'), 'is_valid': False, 'status': 500}
            status = 500
            logger.exception('CSV Show preview failed at {}', handler.__name__)

        record = ErrorRecord.capture(error)
        body.update(_pending_preview_payload(data, handler.__name__, start_tm, started, record=record))
        return jsonify(body), status

    return wrapped
