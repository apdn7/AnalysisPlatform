from __future__ import annotations

from typing import Any, Literal, Optional

import pydantic
from pydantic import BaseModel

INVALID_VALUE_MSG = 'Invalid value'
MUST_HAVE_THE_SAME_TYPE_MSG = 'X and Y must have the same type'


class ErrorField(BaseModel):
    function_type: Optional[str] = None
    field: Optional[Literal['X', 'Y', 'name_en', 'name_jp', 'name_local', 'a', 'b', 'c', 'n', 'k', 's', 't']] = None
    msg: str


class FunctionFieldError(Exception):
    def __init__(self, msg: str | None = None, *, id: int | None = None, errors: list[ErrorField] = None):
        super().__init__(msg)
        self.errors = errors if errors else []
        self.id = id

    def with_id(self, id: int) -> FunctionFieldError:
        self.id = id
        return self

    def has_error(self) -> bool:
        return len(self.errors) > 0

    def add_error(self, *errors: ErrorField) -> FunctionFieldError:
        self.errors.extend(errors)
        return self

    def parse(self) -> dict[str, Any]:
        return {'id': self.id, 'errors': self.errors}

    def __repr__(self) -> str:
        return '\n'.join(err.msg for err in self.errors)

    def __str__(self) -> str:
        return self.__repr__()

    @classmethod
    def from_pydantic_validation_error(
        cls,
        exc: pydantic.ValidationError,
        function_type: str | None = None,
    ) -> FunctionFieldError:
        function_field_error = FunctionFieldError('Invalid type')
        for err in exc.errors():
            field = err['loc'][0]
            if field in ['a', 'b', 'c']:
                function_field_error.add_error(
                    ErrorField(function_type=function_type, msg='Input should be real number', field=field),
                )
            elif field in ['n', 'k']:
                function_field_error.add_error(
                    ErrorField(function_type=function_type, msg='Input should be integer number', field=field),
                )
            else:
                raise ValueError(f'{field} does not support validation')
        return function_field_error


class FunctionErrors(Exception):
    def __init__(self, msg: str | None = None):
        super().__init__(msg)
        self.function_errors: dict[int, FunctionFieldError] = {}

    def add_function_error(self, *function_errors: FunctionFieldError) -> FunctionErrors:
        for func_error in function_errors:
            if func_error.has_error():
                if func_error.id not in self.function_errors:
                    self.function_errors[func_error.id] = func_error
                else:
                    self.function_errors[func_error.id].add_error(*func_error.errors)
        return self

    def has_error(self) -> bool:
        return len(self.function_errors) > 0

    def parse(self) -> dict[int | None, Any]:
        return {func_id: func.errors for func_id, func in self.function_errors.items()}
