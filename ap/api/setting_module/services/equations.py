from __future__ import annotations

from typing import Any, Literal, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from ap.common.constants import ARRAY_X, ARRAY_Y, ID, SAMPLE_DATA
from ap.equations.error import ErrorField, FunctionErrors, FunctionFieldError
from ap.equations.utils import get_function_class_by_id

# if TYPE_CHECKING:
from ap.setting_module.models import CfgProcessColumn, CfgProcessFunctionColumn


class EquationSampleDataResponse(BaseModel):
    sample_data: list[Any]
    output_type: str


class EquationSampleData(BaseModel):
    data_id: Optional[int] = None
    equation_id: Optional[int] = None
    var_x: list[Any] = Field(default=[], alias='X')
    var_y: list[Any] = Field(default=[], alias='Y')
    x_data_type: Optional[str] = None
    y_data_type: Optional[str] = None
    a: Optional[str] = None
    b: Optional[str] = None
    c: Optional[str] = None
    n: Optional[str] = None
    k: Optional[str] = None
    s: Optional[str] = None
    t: Optional[str] = None

    def sample_data(self) -> EquationSampleDataResponse:
        df = pd.DataFrame(
            {
                ARRAY_X: pd.Series(self.var_x),
                ARRAY_Y: pd.Series(self.var_y),
            },
        )
        equation = get_function_class_by_id(equation_id=self.equation_id).from_kwargs(
            **self.model_dump(),
        )
        sample_data = equation.evaluate(
            df,
            out_col=SAMPLE_DATA,
            x_col=ARRAY_X,
            y_col=ARRAY_Y,
            x_dtype=self.x_data_type,
            y_dtype=self.y_data_type,
        )[SAMPLE_DATA]
        output_type = equation.get_output_type(x_data_type=self.x_data_type, y_data_type=self.y_data_type)

        # orjson can't parse infinity
        # https://github.com/ijl/orjson?tab=readme-ov-file#float
        sample_data = sample_data.replace({np.inf: 'inf', -np.inf: '-inf'})

        return EquationSampleDataResponse(sample_data=sample_data.tolist(), output_type=output_type.value)


def get_all_normal_columns_for_functions(
    function_column_ids: list[int],
    all_columns: list[CfgProcessColumn],
) -> list[int]:
    """
    Suppose we have a scenario like this where 4 and 6 is normal column
    1 -> 2, 3
    2 -> 3, 4
    3 -> 4
    5 -> 6

    If we send in function_column_ids = [1]:
    The required columns are [2, 3, 4]
    @return: list of require columns
    """

    visited: set[int] = set()
    remain_function_column_ids = function_column_ids.copy()

    dict_columns = {column.id: column for column in all_columns}

    answer = []
    while remain_function_column_ids:
        function_column_id = remain_function_column_ids.pop()
        if function_column_id in visited:
            continue
        visited.add(function_column_id)

        column = dict_columns.get(function_column_id)

        if column.id not in function_column_ids:
            answer.append(column.id)

        # this column is function column, we need to continue our search
        for function_detail in column.function_details:
            require_columns = [
                function_detail.var_x,
                function_detail.var_y,
            ]
            remain_function_column_ids.extend(col for col in require_columns if col is not None)

    return answer


def is_all_new_functions(funcs):
    if any(func[ID] is not None and func[ID] >= 1 for func in funcs):
        return False

    return True


def remove_all_function_columns(session, proc_id):
    ids = CfgProcessColumn.get_function_col_ids(proc_id)
    if ids:
        CfgProcessColumn.remove_by_col_ids(ids, session)
        CfgProcessFunctionColumn.remove_by_col_ids(ids, session)

    return True


def validate_functions_calculation(process_id: int, validation_errors: FunctionErrors, functions: list[dict[str, Any]]):
    if not functions or process_id is None:
        return

    raw_data_types = {cfg_col.id: cfg_col.data_type for cfg_col in CfgProcessColumn.get_by_process_id(str(process_id))}
    sample_data_x = [None for _ in range(5)]
    sample_data_y = [None for _ in range(5)]

    for function in functions:
        function_id = function.get(CfgProcessFunctionColumn.function_id.key)
        var_x = function.get(CfgProcessFunctionColumn.var_x.key)
        var_y = function.get(CfgProcessFunctionColumn.var_y.key)

        function_column_id = function.get(CfgProcessFunctionColumn.id.key)
        raw_data_type = function.get(CfgProcessFunctionColumn.return_type.key)
        raw_data_types[function_column_id] = raw_data_type

        equation_sample_data = EquationSampleData(
            equation_id=function_id,
            X=sample_data_x,
            Y=sample_data_y,
            x_data_type=raw_data_types.get(var_x),
            y_data_type=raw_data_types.get(var_y),
            **function,
        )
        try:
            equation_sample_data.sample_data()
        except FunctionFieldError as err:
            validation_errors.add_function_error(err.with_id(function_column_id))


def validate_functions_empty_system_name(validation_errors: FunctionErrors, functions: list[dict[str, Any]]):
    invalid_function_column_ids: list[int] = []
    for function in functions:
        process_column = function.get('process_column')
        name_en = process_column.get(CfgProcessColumn.name_en.key)
        if not name_en:
            invalid_function_column_ids.append(function.get('id'))
    if invalid_function_column_ids:
        validation_errors.add_function_error(
            *(
                FunctionFieldError(
                    id=function_column_id,
                    errors=[ErrorField(field=CfgProcessColumn.name_en.key, msg='System name is empty')],
                )
                for function_column_id in invalid_function_column_ids
            ),
        )


def validate_duplicated_function_name_for_key(
    key: Literal['name_en', 'name_jp', 'name_local'],
    functions: list[dict[str, Any]],
    cfg_process_columns: list[CfgProcessColumn],
):
    invalid_function_column_ids: list[int] = []

    normal_name_columns = {getattr(c, key) for c in cfg_process_columns}

    # key: name, value: list of function column ids
    function_name_columns_dict: dict[str, list[int]] = {}
    for function in functions:
        process_column = function.get('process_column')
        if not process_column:
            continue

        # skip me function
        if function.get('is_me_function'):
            continue

        function_column_id = function.get('id')
        name = process_column.get(key)
        # do not validate empty name
        if not name:
            continue

        if name in normal_name_columns:
            invalid_function_column_ids.append(function_column_id)
        else:
            if name not in function_name_columns_dict:
                function_name_columns_dict[name] = []
            function_name_columns_dict[name].append(function_column_id)

    for duplicated_ids in function_name_columns_dict.values():
        if len(duplicated_ids) > 1:
            invalid_function_column_ids.extend(duplicated_ids)

    return list(set(invalid_function_column_ids))


def validate_functions_duplicated_names(
    process_id: int,
    validation_errors: FunctionErrors,
    functions: list[dict[str, Any]],
):
    if not functions or process_id is None:
        return

    cfg_process_columns = CfgProcessColumn.get_by_process_id(str(process_id))
    cfg_process_columns = [cfg_col for cfg_col in cfg_process_columns if not cfg_col.is_generate_equation_column()]

    for key in [CfgProcessColumn.name_en.key, CfgProcessColumn.name_jp.key, CfgProcessColumn.name_local.key]:
        invalid_function_column_ids = validate_duplicated_function_name_for_key(key, functions, cfg_process_columns)
        validation_errors.add_function_error(
            *(
                FunctionFieldError(id=function_column_id, errors=[ErrorField(field=key, msg=f'Duplicated {key}')])
                for function_column_id in invalid_function_column_ids
            ),
        )


def validate_functions_define_by_undefined_columns(validation_errors: FunctionErrors, functions: list[dict[str, Any]]):
    seen_process_column_ids = set()
    invalid_function_column_ids = set()

    for function in functions:
        column_id = function.get(CfgProcessFunctionColumn.process_column_id.key)
        var_x = function.get(CfgProcessFunctionColumn.var_x.key)
        var_y = function.get(CfgProcessFunctionColumn.var_y.key)

        for id in [var_x, var_y]:
            # column with var_x, var_y that depends on other undefined columns
            # this must be a bug
            # new columns are those with id < 0
            if id is not None and id < 0 and id not in seen_process_column_ids:
                invalid_function_column_ids.add(column_id)
                break

        seen_process_column_ids.add(column_id)

    if invalid_function_column_ids:
        validation_errors.add_function_error(
            *(
                FunctionFieldError(
                    id=function_column_id,
                    errors=[ErrorField(field=None, msg='Function column is defined using undefined columns')],
                )
                for function_column_id in invalid_function_column_ids
            ),
        )


def validate_functions(process_id: int, functions: list[dict[str, Any]]):
    validation_errors = FunctionErrors()
    validate_functions_calculation(process_id, validation_errors, functions)
    validate_functions_empty_system_name(validation_errors, functions)
    validate_functions_duplicated_names(process_id, validation_errors, functions)
    validate_functions_define_by_undefined_columns(validation_errors, functions)

    if validation_errors.has_error():
        raise validation_errors
