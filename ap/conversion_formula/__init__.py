from ap.common.constants import DataColumnType, DataType, FormulaType
from ap.conversion_formula.core import ConversionFormula
from ap.conversion_formula.date import DateFormula
from ap.conversion_formula.datetime import DatetimeFormula
from ap.conversion_formula.judge import JudgeFormula
from ap.conversion_formula.time import TimeFormula


def gen_formula_type(col_type: int | None, data_type: str | None) -> FormulaType | None:
    if col_type is None or data_type is None:
        return None

    try:
        column_type = DataColumnType(col_type)
        parsed_data_type = DataType[data_type]
    except (ValueError, KeyError):
        return None
    match (column_type, parsed_data_type):
        case (None, _) | (_, None):
            return None
        case (DataColumnType.JUDGE, DataType.BOOLEAN | DataType.TEXT):
            # Since Judge column should be cast to bool before save into db,
            # do not care the case of Integer as Judge
            return FormulaType.JUDGE
        case (_, DataType.DATETIME):
            return FormulaType.DATETIME
        case (_, DataType.DATE):
            return FormulaType.DATE
        case (_, DataType.TIME):
            return FormulaType.TIME
        case (_, _):
            return None


def conversion_formula(
    col_type: int | None,
    data_type: str | None,
    formula: str,
) -> ConversionFormula | None:
    # if not provide formula then return None
    if not formula:
        return None
    formula_type = gen_formula_type(col_type, data_type)
    match formula_type:
        case None:
            return None
        case FormulaType.JUDGE:
            return JudgeFormula.from_formula(formula)
        case FormulaType.DATETIME:
            return DatetimeFormula.from_formula(formula)
        case FormulaType.DATE:
            return DateFormula.from_formula(formula)
        case FormulaType.TIME:
            return TimeFormula.from_formula(formula)
        case _:
            raise NotImplementedError(formula_type)
