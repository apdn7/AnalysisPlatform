from __future__ import annotations

from typing import TYPE_CHECKING

from ap.equations.core import EQUATION_DEFINITION, FunctionInfo
from ap.setting_module.models import MFunction

if TYPE_CHECKING:
    from ap.equations.core import BaseFunction


def get_function_class_by_function_type(string: str) -> type[BaseFunction]:
    equation = MFunction.query.filter(MFunction.function_type == string).one()
    return get_function_class_by_id(equation.id)


def get_function_class_by_id(equation_id: int) -> type[BaseFunction]:
    equation_class = EQUATION_DEFINITION.get(equation_id, None)
    if equation_class is None:
        raise KeyError(f'{equation_id} is not a valid function')
    return equation_class


def get_all_functions_info() -> list[FunctionInfo]:
    results = []
    for equation in MFunction.query.order_by(MFunction.id.asc()).all():
        equation_class = get_function_class_by_id(equation.id)
        equation_dict = equation.as_dict()
        function_info = FunctionInfo(
            **equation_dict,
            x_types=equation.get_possible_x_types(),
            y_types=equation.get_possible_y_types(),
            vars=equation.get_variables(),
            coefs=equation_class.all_coefficients(),
            required_coefs=equation_class.required_coefficients(),
            optional_coefs=equation_class.optional_coefficients(),
        )
        results.append(function_info)
    return results
