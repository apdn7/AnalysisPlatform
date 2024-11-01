import importlib
from functools import cached_property
from types import FunctionType
from typing import Annotated, Any, Callable, Union

from pydantic import BaseModel, BeforeValidator, Field


# Because we cannot pickle `function`, we need to translate them into module and name
class _Function(BaseModel):
    qualname: str
    module: str


def validator_function(fn: Union[FunctionType, Callable]) -> _Function:
    """Convert normal function into string, so that we can pickle when putting into message queues"""
    return _Function(module=fn.__module__, qualname=fn.__qualname__)


class EventBaseFunction(BaseModel):
    """Since we cannot pickle function to send into PIPE, we need to separate them here,
    fn is just a `_Function` containing location of the real function (where it is defined, what its name)
    """

    fn: Annotated[Union[_Function, Callable], BeforeValidator(validator_function)]
    kwargs: dict[str, Any] = Field(default_factory=dict)

    # cache to avoid calling importlib multiple times
    @cached_property
    def function(self):
        """The real function signature from our code, need to dynamically import them before use
        See more: `python doc <https://docs.python.org/3/library/importlib.html#approximating-importlib-import-module>`
        """

        # we can import module without any trouble
        module = importlib.import_module(self.fn.module)

        # need to get correct item from qualname
        # currently, we only allow 2 type of function
        # simple function: `fn`
        # classmethod function: `classname.fn`

        # check if we are handling class method here
        # if we have classmethod, this will be:
        # - classname, '.', function
        # otherwise
        # - '', '', function

        cls_name, _, fn_name = self.fn.qualname.rpartition('.')

        # no class method, just get function
        if cls_name == '':
            method = getattr(module, fn_name)
        else:
            if '.' in cls_name:
                raise RuntimeError(f'Only support class method for now, please check {self.fn} again')

            cls = getattr(module, cls_name)
            method = getattr(cls, fn_name)

        if method is None:
            raise RuntimeError(f'No method found for {self.fn}')

        return method
