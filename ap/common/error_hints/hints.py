"""Resolve catalog entries to plain localized display models."""

from collections.abc import Mapping

from pydantic import BaseModel, ConfigDict

from .catalog import ERROR_HINT_DEFINITIONS, ErrorHintDefinition


class ErrorHint(BaseModel):
    """Localized display snapshot, not the language-neutral record stored in the DB."""

    model_config = ConfigDict(frozen=True, extra='forbid')

    exception: str
    group: str
    name: str
    cause: str
    hint: str


class ErrorHints:
    """Look up hints by exception name or instance, preserving unknown exception names."""

    def __init__(self, definitions: Mapping[str, ErrorHintDefinition]) -> None:
        if '_default' not in definitions:
            raise ValueError('Error hint definitions must include _default')
        self._definitions = definitions

    def get(self, error: str | BaseException) -> ErrorHint:
        """Return plain display strings in the active Babel locale, or English without a context."""
        if isinstance(error, str):
            exception = error
        elif isinstance(error, BaseException):
            exception = type(error).__name__
        else:
            raise TypeError('Expected an exception name or a BaseException instance')

        definition = self._definitions.get(exception, self._definitions['_default'])
        return ErrorHint(
            exception=exception,
            group=str(definition.group),
            name=str(definition.name),
            cause=str(definition.cause),
            hint=str(definition.hint),
        )


ERROR_HINTS = ErrorHints(ERROR_HINT_DEFINITIONS)
