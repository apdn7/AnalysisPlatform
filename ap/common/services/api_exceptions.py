from __future__ import annotations

import dataclasses
from typing import TYPE_CHECKING, Any, List, Optional, Union

from flask import Response, jsonify

if TYPE_CHECKING:
    from werkzeug.exceptions import HTTPException


@dataclasses.dataclass
class ErrorMessage:
    reason: str
    message: str


@dataclasses.dataclass
class Errors:
    errors: list[ErrorMessage] = dataclasses.field(default_factory=list)

    def add_error_message(
        self,
        *,
        error_msg: Union[Optional[ErrorMessage], List[ErrorMessage]] = None,
    ) -> None:
        if error_msg is None:
            return
        if isinstance(error_msg, ErrorMessage):
            self.errors.append(error_msg)
        elif isinstance(error_msg, list):
            for err in error_msg:
                if not isinstance(error_msg, ErrorMessage):
                    raise RuntimeError(
                        'Invalid usage: `error_msg` must be a list of `ErrorMessage`',
                    )
                self.errors.append(err)

    def __len__(self) -> int:
        return len(self.errors)

    def clear(self):
        self.errors = []

    def has_error(self) -> bool:
        return len(self) > 0

    def render(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


class APIError(Exception):
    def __init__(
        self,
        status_code: int = 500,
        error_msg: Union[Optional[ErrorMessage], List[ErrorMessage]] = None,
    ) -> None:
        self.errors = Errors()
        self.errors.add_error_message(error_msg=error_msg)
        self.status_code = status_code

    def with_status(self, status_code: int) -> 'APIError':
        self.status_code = status_code
        return self

    def add_error(
        self,
        error_msg: Union[Optional[ErrorMessage], List[ErrorMessage]] = None,
    ) -> 'APIError':
        self.errors.add_error_message(error_msg=error_msg)
        return self

    def has_errors(self) -> bool:
        return self.errors.has_error()

    @property
    def description(self) -> dict[str, Any]:
        return self.errors.render()

    def response(self) -> Response:
        response = jsonify(self.description)
        response.status_code = self.status_code
        return response

    def check_error(self) -> None:
        if self.has_errors():
            raise self

    @classmethod
    def from_http_error(cls, e: HTTPException) -> APIError:
        return cls(
            status_code=e.code,
            error_msg=ErrorMessage(reason=e.description, message=e.description),
        )
