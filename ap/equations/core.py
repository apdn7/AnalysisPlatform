from __future__ import annotations

import contextlib
import locale
import re
from abc import abstractmethod
from typing import Any, ClassVar, Optional

import numpy as np
import pandas as pd
import pydantic
from dateutil import tz
from pydantic import BaseModel
from pydantic.functional_validators import field_validator

from ap.common.constants import EMPTY_STRING, MULTIPLE_VALUES_CONNECTOR, DataTypeEncode, RawDataTypeDB
from ap.common.memoize import memoize
from ap.equations.error import INVALID_VALUE_MSG, ErrorField, FunctionFieldError
from ap.setting_module.models import MFunction

BOOLEAN_DICT_VALUES = {
    'true': True,
    'True': True,
    '1': True,
    'false': False,
    'False': False,
    '0': False,
}

FUNCTION_DATE_FORMAT = '%Y-%m-%d'
FUNCTION_TIME_FORMAT = '%H:%M:%S.%f'


class FunctionInfo(BaseModel):
    id: int
    function_type: str
    function_name_en: Optional[str]
    function_name_jp: Optional[str]
    description_en: Optional[str]
    description_jp: Optional[str]
    x_types: list[RawDataTypeDB]
    y_types: list[RawDataTypeDB]
    vars: list[str]
    coefs: list[str]
    required_coefs: list[str]
    optional_coefs: list[str]
    show_serial: bool
    a: Optional[str]
    b: Optional[str]
    c: Optional[str]
    n: Optional[str]
    k: Optional[str]
    s: Optional[str]
    t: Optional[str]

    class Config:
        use_enum_values = True


def cast_value_based_on_series(series: pd.Series, value: Any) -> tuple[Any, bool]:
    """
    @param series:
    @param value:
    @return: cast value (if possible) and boolean result indicated that it is cast to series or not
    """
    if pd.api.types.is_float_dtype(series):
        with contextlib.suppress(ValueError):
            return float(value), True

    if pd.api.types.is_integer_dtype(series):
        with contextlib.suppress(ValueError):
            return int(value), True

    if pd.api.types.is_string_dtype(series):
        with contextlib.suppress(ValueError):
            return str(value), True

    # fallback to the smallest type possible
    for typ in [int, float, str]:
        with contextlib.suppress(ValueError):
            return typ(value), False

    # keep the original type
    return value, False


def try_cast_series_pd_types(series: pd.Series, pd_types: list[pd.ExtensionType]) -> pd.Series | None:
    for dtype in pd_types:
        result_series = series.replace(BOOLEAN_DICT_VALUES) if pd.api.types.is_bool_dtype(dtype) else series
        with contextlib.suppress(TypeError, ValueError, OverflowError):
            return result_series.astype(dtype)
        with contextlib.suppress(TypeError, ValueError, OverflowError):
            return result_series.astype(pd.StringDtype()).astype(dtype)
        with contextlib.suppress(TypeError, ValueError, OverflowError):
            return result_series.convert_dtypes().astype(dtype)
    return None


def try_cast_series(series: pd.Series, raw_data_types: list[RawDataTypeDB | None]) -> pd.Series:
    # TODO: write extension type later
    if pd.api.types.is_object_dtype(series) and RawDataTypeDB.TIME in raw_data_types:
        return pd.to_datetime(series.astype(pd.StringDtype()))

    # cast all possible data types
    pd_types = [
        RawDataTypeDB.get_pandas_dtype(raw_dtype.value) for raw_dtype in raw_data_types if raw_dtype is not None
    ]
    casted_series = try_cast_series_pd_types(series, pd_types)
    if casted_series is None:
        # maybe series is full of empty text, we will replace EMPTY_STRING by None then cast it again
        casted_series = try_cast_series_pd_types(series.replace(EMPTY_STRING, pd.NA), pd_types)

    if casted_series is None and RawDataTypeDB.BOOLEAN in raw_data_types:
        # in case of raw dtype is BOOLEAN but was casted into Int32
        casted_series = try_cast_series_pd_types(series.replace(BOOLEAN_DICT_VALUES), pd_types)

    if casted_series is None:
        raise FunctionFieldError('Cast error').add_error(
            ErrorField(field=None, msg=f'Cannot cast series of type `{series.dtype}` to `{raw_data_types}`'),
        )

    return casted_series


def get_data_encoding_type_from_series(series: pd.Series) -> DataTypeEncode:
    if pd.api.types.is_int64_dtype(series):
        return DataTypeEncode.BIG_INT
    if pd.api.types.is_integer_dtype(series):
        return DataTypeEncode.INTEGER
    if pd.api.types.is_float_dtype(series):
        return DataTypeEncode.REAL
    if pd.api.types.is_string_dtype(series):
        return DataTypeEncode.TEXT
    return DataTypeEncode.NULL


class BaseFunction(BaseModel):
    EXCLUDE_VARS: ClassVar[list[str]] = ['type_cast']
    type_cast: Optional[str] = None

    @classmethod
    def from_kwargs(cls, **kwargs) -> 'BaseFunction':
        existed_required_kwargs = {k: v for k, v in kwargs.items() if k in cls.required_coefficients()}
        missing_required_kwargs = {k: None for k in cls.required_coefficients() if k not in existed_required_kwargs}
        optional_kwargs = {k: v for k, v in kwargs.items() if k in cls.optional_coefficients()}
        try:
            instance = cls(**existed_required_kwargs, **missing_required_kwargs, **optional_kwargs)
        except pydantic.ValidationError as exc:
            raise FunctionFieldError.from_pydantic_validation_error(exc, cls.function_type()) from exc

        return instance

    @field_validator('*', mode='before')  # noqa
    @classmethod
    def validate_empty_string(cls, value: str) -> str | None:
        if isinstance(value, str) and value.strip() == EMPTY_STRING:
            return None
        return value

    @classmethod
    def all_coefficients(cls) -> set[str]:
        all_properties = cls.model_json_schema().get('properties', {}).keys()
        return {coef for coef in all_properties if coef not in cls.EXCLUDE_VARS}

    @classmethod
    def required_coefficients(cls) -> set[str]:
        return set(cls.model_json_schema().get('required', []))

    @classmethod
    def optional_coefficients(cls) -> set[str]:
        return cls.all_coefficients() - cls.required_coefficients()

    @classmethod
    def get_vars(cls) -> list[str]:
        return cls.get_function_orm().get_variables()

    @classmethod
    @memoize()
    def get_function_orm(cls) -> MFunction | None:
        for function_id, klass in EQUATION_DEFINITION.items():
            if klass == cls:
                return MFunction.query.get(function_id)
        return None

    @classmethod
    def function_type(cls) -> str | None:
        function_orm = cls.get_function_orm()
        if function_orm is not None:
            return function_orm.function_type
        return None

    def set_type_cast(self, type_cast: str) -> None:
        self.type_cast = type_cast

    @abstractmethod
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        ...

    def get_output_type_cast(self) -> str | None:
        type_cast = self.type_cast if self.type_cast is not None else getattr(self, 't', None)

        # TODO: must preprocess `type_cast` to match with RawDataTypeDB
        if type_cast is None:
            return None

        output_type_cast = type_cast.strip()  # type: str
        if output_type_cast == DataTypeEncode.REAL.value:
            return RawDataTypeDB.REAL.value

        # TODO: check if return bigint or smallint
        if output_type_cast == DataTypeEncode.BIG_INT.value:
            return RawDataTypeDB.BIG_INT.value

        if output_type_cast == DataTypeEncode.INTEGER.value:
            return RawDataTypeDB.INTEGER.value

        if output_type_cast == DataTypeEncode.TEXT.value:
            return RawDataTypeDB.TEXT.value

        if output_type_cast == DataTypeEncode.CATEGORY.value:
            return RawDataTypeDB.CATEGORY.value

        # do not support other types
        return None

    def get_output_type(self, x_data_type: str | None = None, y_data_type: str | None = None) -> RawDataTypeDB:
        output_type_cast = self.get_output_type_cast()
        output_data_type = self.get_function_orm().get_output_data_type(x_data_type, y_data_type, output_type_cast)
        if output_data_type is None:
            raise FunctionFieldError('Get output error').add_error(
                ErrorField(
                    function_type=self.function_type(),
                    field=None,
                    msg=f'Cannot get output type for function: {self.__class__.__name__} '
                    f'with variables: {self.__dict__}',
                ),
            )
        return output_data_type

    def evaluate(
        self,
        df: pd.DataFrame,
        out_col: str,
        x_col: str | None = None,
        y_col: str | None = None,
        x_dtype: str | None = None,
        y_dtype: str | None = None,
    ):
        if df.empty:
            result_series = pd.Series([])
        else:
            m_function = self.get_function_orm()

            series_x = None
            if m_function.has_x():
                if x_col is None:
                    raise FunctionFieldError('Missing var').add_error(
                        ErrorField(function_type=self.function_type(), field='X', msg='Missing X'),
                    )

                possible_types = (
                    [m_function.get_x_data_type(x_data_type=x_dtype)]
                    if x_dtype is not None
                    else m_function.get_possible_x_types()
                )
                series_x = try_cast_series(df[x_col], possible_types)

            series_y = None
            if m_function.has_y():
                if y_col is None:
                    raise FunctionFieldError('Missing var').add_error(
                        ErrorField(function_type=self.function_type(), field='Y', msg='Missing Y'),
                    )

                possible_types = (
                    [m_function.get_y_data_type(y_data_type=y_dtype)]
                    if y_dtype is not None
                    else m_function.get_possible_y_types()
                )
                series_y = try_cast_series(df[y_col], possible_types)

            result_series = self.eval_to_series(series_x=series_x, series_y=series_y)

        raw_output_type = self.get_output_type(x_data_type=x_dtype, y_data_type=y_dtype)
        output_dtype = RawDataTypeDB.get_pandas_dtype(raw_output_type.value)
        result_series = result_series.convert_dtypes().astype(output_dtype)

        # must change null string to NA
        if raw_output_type == RawDataTypeDB.TEXT:
            result_series = result_series.replace(to_replace=EMPTY_STRING, value=pd.NA)

        df[out_col] = result_series

        return df


class LinearFunction(BaseFunction):
    a: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * series_x + self.c


class LinearCombination(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * series_x + self.b * series_y + self.c


class Production(BaseFunction):
    a: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * series_x * series_y + self.c


class Ratio(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * series_x / (self.b * series_y) + self.c


class ExpTransform(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * series_x * (10 ** (series_y - self.b)) + self.c


class PowTransform(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * (series_x**self.b) + self.c


class LogTransform(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return self.a * np.log10(series_x - self.b) + self.c


class HexToDec(BaseFunction):
    @staticmethod
    def _convert(value: str | None) -> int | None:
        try:
            return int(value, base=16)
        except (ValueError, TypeError):
            return pd.NA

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.apply(self._convert)


class HexToBin(BaseFunction):
    @staticmethod
    def _convert(value: str | None) -> str | None:
        try:
            return bin(int(value, base=16))[2:]
        except (ValueError, TypeError):
            return pd.NA

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.apply(self._convert)


class HexToLogical(BaseFunction):
    n: int

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = HexToDec().eval_to_series(series_x=series_x, series_y=series_y)
        nth_bit = 2 ** (int(self.n) - 1)
        is_na = result.isna()
        result.loc[~is_na] = (result[~is_na] & nth_bit) != 0
        return result


class RadiusPosition(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        x_minus_a = series_x - self.a
        y_minus_b = series_y - self.b
        return np.sqrt(x_minus_a * x_minus_a + y_minus_b * y_minus_b) / self.c


class AngularPosition(BaseFunction):
    a: float
    b: float
    c: float

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return np.arctan2(series_y - self.b, series_x - self.a) * 180 / np.pi - self.c


class StringExtraction(BaseFunction):
    n: int
    k: int
    t: str

    def custom_validate(self):
        required_ts = [
            DataTypeEncode.TEXT.value,
            DataTypeEncode.CATEGORY.value,
        ]
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()
        self.set_type_cast(self.t)

        start = self.n
        if start > 0:
            start -= 1

        stop = None if self.k == -1 else self.k
        if stop is not None and stop < 0:
            stop += 1

        result = series_x.astype(pd.StringDtype()).str.slice(start=start, stop=stop)

        type_converter = TypeConvert.from_kwargs(t=self.type_cast)
        return type_converter.eval_to_series(series_x=result)


class CategoryGeneration(BaseFunction):
    s: str
    t: str

    def count_curly_brace_pairs_in_s(self) -> int:
        pattern = r'\{[^\{\}]*\}'
        matches = re.findall(pattern, self.s)
        return len(matches)

    def custom_validate(self):
        error = FunctionFieldError(INVALID_VALUE_MSG)

        # validate number of argument format fields in s
        if self.count_curly_brace_pairs_in_s() != 2:
            error.add_error(
                ErrorField(
                    function_type=self.function_type(),
                    field='s',
                    msg='Invalid format, s must have 2 fields for X and Y',
                ),
            )

        # validate type t
        required_ts = [
            DataTypeEncode.TEXT.value,
            DataTypeEncode.CATEGORY.value,
        ]
        if self.t.strip() not in required_ts:
            raise error.add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

        if error.has_error():
            raise error

    def apply_format(self, x: Any, y: Any) -> str | None:
        """
        This function is slow because we use lambda instead of vectorization
        Try to parse x, y as empty string if it is None.
        However, in case the format is specified for number (e.g: {:02d}), we can only return None if x or y is None
        """
        with contextlib.suppress(TypeError, ValueError):
            x = EMPTY_STRING if pd.isna(x) else x
            y = EMPTY_STRING if pd.isna(y) else y
            return self.s.format(x, y)

        return None

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()
        self.set_type_cast(self.t)

        result = pd.Series([self.apply_format(x, y) for x, y in zip(series_x, series_y)])
        type_converter = TypeConvert.from_kwargs(t=self.type_cast)
        return type_converter.eval_to_series(series_x=result)


class Datetime(BaseFunction):
    s: str

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return pd.to_datetime(series_x, format=self.s, errors='coerce')


class DatetimeFromDateAndTime(BaseFunction):
    s: Optional[str] = None
    t: Optional[str] = None

    def custom_validate(self, is_x_string: bool, is_y_string: bool):
        function_field_error = FunctionFieldError(INVALID_VALUE_MSG)
        if is_x_string and not self.s:
            function_field_error.add_error(
                ErrorField(function_type=self.function_type(), field='s', msg='Missing s format for string column'),
            )
        if is_y_string and not self.t:
            function_field_error.add_error(
                ErrorField(function_type=self.function_type(), field='t', msg='Missing t format for string column'),
            )
        if function_field_error.has_error():
            raise function_field_error

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        is_x_string = not pd.api.types.is_datetime64_any_dtype(series_x)
        is_y_string = not pd.api.types.is_datetime64_any_dtype(series_y)

        self.custom_validate(is_x_string, is_y_string)

        date_format = self.s if is_x_string and self.s else FUNCTION_DATE_FORMAT
        time_format = self.t if is_y_string and self.t else FUNCTION_TIME_FORMAT

        result_format = f'{date_format}{time_format}'

        # extract date format
        if not is_x_string:
            series_x = series_x.dt.strftime(date_format)

        # extract time format
        if not is_y_string:
            series_y = series_y.dt.strftime(time_format)

        return pd.to_datetime(series_x + series_y, format=result_format, exact=True, errors='coerce').dt.tz_localize(
            tz.tzlocal(),
        )


class DateExtraction(BaseFunction):
    s: str

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.dt.strftime(self.s).astype(pd.StringDtype())
        # try to cast result to integer
        with contextlib.suppress(ValueError, TypeError):
            result = result.astype(pd.Int64Dtype())
        self.set_type_cast(get_data_encoding_type_from_series(result).value)
        return result


class TimeframeExtraction(BaseFunction):
    a: float
    b: float

    @staticmethod
    def _interval_to_label(left: int, right: int) -> str:
        mid_night = 24 * 60

        # exceed 1 day
        if left > mid_night:
            left -= mid_night
            right -= mid_night

        def minute_to_string(minute: float) -> str:
            h = int(minute) // 60
            m = int(minute) % 60
            return f'{h:02d}:{m:02d}'

        return f'{minute_to_string(left)}-{minute_to_string(right)}'

    def custom_validate(self):
        function_field_error = FunctionFieldError(INVALID_VALUE_MSG)
        if self.a < 0 or self.a >= 24:
            function_field_error.add_error(
                ErrorField(function_type=self.function_type(), field='a', msg='Value of a must be between 0 and 24'),
            )
        if self.b < 0.5 or self.b >= 24:
            function_field_error.add_error(
                ErrorField(function_type=self.function_type(), field='b', msg='Value of b must be between 0.5 and 24'),
            )
        if function_field_error.has_error():
            raise function_field_error

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        # calculate bins by minutes
        shift_a_day = 24 * 60
        start = self.a * 60  # convert to minutes
        end = start + shift_a_day  # the next day (by minutes)
        freq = self.b * 60  # convert to minute
        bins = np.arange(start, end, freq)
        if end != bins[-1]:
            bins = np.append(bins, end)

        # calculate minutes in each record
        time_data = series_x.dt.hour * 60 + series_x.dt.minute

        # handle edge case where the hour indicated is out of range
        # for example: start = 9.5 but [hour] we looking for is 1.5 => need to shift it to correct time range
        invalid_index = time_data < start
        time_data.loc[invalid_index] = time_data[invalid_index] + shift_a_day

        # cut and rename to correct category
        labels = [self._interval_to_label(left, right) for left, right in zip(bins[:-1], bins[1:])]
        result = pd.cut(time_data, bins=bins, labels=labels)

        return result


class WeekdayExtraction(BaseFunction):
    n: int

    def custom_validate(self):
        if self.n < 0 or self.n > 3:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='n', msg='Value of a must be between 0 and 3'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        use_japanese_locale = self.n >= 2

        current_locale = locale.getlocale(locale.LC_TIME)

        if use_japanese_locale:
            locale.setlocale(locale.LC_TIME, 'ja_JP')

        result = series_x.dt.strftime('%a') if self.n % 2 == 0 else series_x.dt.strftime('%A')

        # set back current locale
        if use_japanese_locale:
            locale.setlocale(locale.LC_TIME, current_locale)

        return result


class WeekNumExtraction(BaseFunction):
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.dt.isocalendar().week


class DayExtraction(BaseFunction):
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.dt.day


class MonthExtraction(BaseFunction):
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.dt.month


class YearExtraction(BaseFunction):
    n: int

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        year = series_x.dt.year
        if self.n == 0:
            return year
        return year % 100


class LogicalEqual(BaseFunction):
    s: str
    t: str

    def custom_validate(self):
        required_ts = ['==', '!=']
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(
                    function_type=self.function_type(),
                    field='t',
                    msg=f'Value of t must in {required_ts}',
                ),
            )

    def _logical_equal(self, series: pd.Series, value: str) -> pd.Series:
        s, _ = cast_value_based_on_series(series, value)
        result = series == s if self.t.strip() == '==' else series != s
        return result

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()
        result = pd.Series(False, index=series_x.index)
        for value in self.s.split(MULTIPLE_VALUES_CONNECTOR):
            result = result | self._logical_equal(series_x, value)

        return result


class LogicalNotEqual(BaseFunction):
    s: str
    t: str

    def custom_validate(self):
        required_ts = ['>', '<', '>=', '<=']
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        s, _ = cast_value_based_on_series(series_x, self.s)

        t = self.t.strip()

        result = None
        if t == '>':
            result = series_x > s
        elif t == '<':
            result = series_x < s
        elif t == '>=':
            return series_x >= s
        elif t == '<=':
            return series_x <= s

        return result


class LogicalOr(BaseFunction):
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        is_na = series_x.isna() | series_y.isna()
        result = series_x.astype(pd.BooleanDtype()) | series_y.astype(pd.BooleanDtype())
        result.loc[is_na] = pd.NA
        return result


class LogicalAnd(BaseFunction):
    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        is_na = series_x.isna() | series_y.isna()
        result = series_x.astype(pd.BooleanDtype()) & series_y.astype(pd.BooleanDtype())
        result.loc[is_na] = pd.NA
        return result


class RegexExtraction(BaseFunction):
    s: str
    t: Optional[str]

    def custom_validate(self):
        try:
            regex = re.compile(self.s, flags=0)
        except re.error as exc:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='s', msg='Invalid regex'),
            ) from exc

        # extracting groups must be present
        if regex.groups == 0:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='s', msg='Regex must provide capture groups'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        extracted_x = series_x.astype(pd.StringDtype()).str.extract(self.s)

        columns = extracted_x.columns
        # always convert to string when we have multiple groups:
        if len(columns) > 1:
            self.set_type_cast(DataTypeEncode.TEXT.value)
        elif self.t:
            self.set_type_cast(self.t)
        else:
            self.set_type_cast(get_data_encoding_type_from_series(series_x).value)

        result = extracted_x[columns[0]]
        for col in columns[1:]:
            result = result + MULTIPLE_VALUES_CONNECTOR + extracted_x[col]

        type_converter = TypeConvert.from_kwargs(t=self.type_cast)
        return type_converter.eval_to_series(series_x=result)


class RegexRemoval(BaseFunction):
    s: str
    t: Optional[str]

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.astype(pd.StringDtype())
        for pat in self.s.split(MULTIPLE_VALUES_CONNECTOR):
            result = result.str.replace(pat, EMPTY_STRING, regex=True)

        # keep original type if `self.t` is not defined
        self.set_type_cast(self.t if self.t else get_data_encoding_type_from_series(series_x).value)

        type_converter = TypeConvert.from_kwargs(t=self.type_cast)
        return type_converter.eval_to_series(series_x=result)


class RegexReplacement(BaseFunction):
    s: str
    t: str

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        return series_x.astype(pd.StringDtype()).str.replace(self.s, self.t, regex=True)


class Merge(BaseFunction):
    t: str

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.combine_first(series_y)

        # keep original type if `self.t` is not defined
        self.set_type_cast(self.t if self.t else get_data_encoding_type_from_series(series_x).value)

        type_converter = TypeConvert.from_kwargs(t=self.type_cast)
        return type_converter.eval_to_series(series_x=result)


class Lookup(BaseFunction):
    s: str
    t: str

    def custom_validate(self):
        values = self.s.split(MULTIPLE_VALUES_CONNECTOR)
        replace_values = self.t.split(MULTIPLE_VALUES_CONNECTOR)
        error_msg = (
            f'{self.s} and {self.t} must have the same number of values connected by {MULTIPLE_VALUES_CONNECTOR}'
        )
        if len(values) != len(replace_values):
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='s', msg=error_msg),
                ErrorField(function_type=self.function_type(), field='t', msg=error_msg),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        values = self.s.split(MULTIPLE_VALUES_CONNECTOR)
        replace_values = self.t.split(MULTIPLE_VALUES_CONNECTOR)
        dict_replace = dict(zip(values, replace_values))

        result = series_x.astype(pd.StringDtype())

        # handle special boolean case
        if pd.api.types.is_bool_dtype(series_x):
            true_keys = [k for k, v in BOOLEAN_DICT_VALUES.items() if v]
            false_keys = [k for k, v in BOOLEAN_DICT_VALUES.items() if not v]

            truth_values = [dict_replace.get(k) for k in true_keys]
            false_values = [dict_replace.get(k) for k in false_keys]

            if truth_values:
                result[series_x] = truth_values[0]
            if false_values:
                result[~series_x] = false_values[0]
            return result

        return result.replace(dict_replace)


class TypeConvert(BaseFunction):
    t: str

    def custom_validate(self):
        if self.t is None:
            return None

        required_ts = [
            DataTypeEncode.REAL.value,
            DataTypeEncode.INTEGER.value,
            DataTypeEncode.TEXT.value,
            DataTypeEncode.CATEGORY.value,
            DataTypeEncode.BIG_INT.value,
        ]
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        self.set_type_cast(self.t)

        type_cast = self.get_output_type_cast()
        pd_type = RawDataTypeDB.get_pandas_dtype(type_cast)

        if pd.api.types.is_numeric_dtype(pd_type):
            casted_x = pd.to_numeric(series_x, errors='coerce')

            if pd.api.types.is_float_dtype(pd_type):
                return casted_x

            # replace float data as NA
            float_index = (np.floor(casted_x) - casted_x) != 0
            casted_x.loc[float_index] = pd.NA

            return casted_x

        # dtype is string
        return series_x.astype(pd_type)


class Shift(BaseFunction):
    s: str
    t: str

    def custom_validate(self):
        try:
            int(self.t)
        except ValueError:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(
                    function_type=self.function_type(),
                    field='t',
                    msg=f'Only accept integer value for t, received `{self.t}` instead',
                ),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        s, convertible = cast_value_based_on_series(series_x, self.s)

        t = int(self.t)

        # no need to cast type
        if convertible:
            result = series_x.shift(t, fill_value=s)
        else:
            if isinstance(s, float):
                casted_series = series_x.astype(pd.Float64Dtype())
            elif isinstance(s, str):
                casted_series = series_x.astype(pd.StringDtype())
            else:
                raise NotImplementedError(f'Cannot cast `s` of type {type(s)}')

            result = casted_series.shift(t, fill_value=s)

        self.set_type_cast(get_data_encoding_type_from_series(result).value)

        return result


class FillNa(BaseFunction):
    s: Optional[str] = None
    t: str

    def custom_validate(self):
        required_ts = ['c', 'b', 'f', 'bc', 'fc', 'bf', 'fb']
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

        if 'c' in self.t.strip() and self.s is None:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(
                    function_type=self.function_type(),
                    field='s',
                    msg='Must provide s when fillna using constant',
                ),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()

        for fill_method in self.t.strip():
            if fill_method == 'b':
                series_x = series_x.fillna(method='ffill')
            elif fill_method == 'f':
                series_x = series_x.fillna(method='bfill')
            elif fill_method == 'c':
                s, convertible = cast_value_based_on_series(series_x, self.s)
                if not convertible:
                    raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                        ErrorField(
                            function_type=self.function_type(),
                            field='s',
                            msg=f'Cannot cast `s` of type {type(s)}',
                        ),
                    )

                series_x = series_x.fillna(s)

        self.set_type_cast(get_data_encoding_type_from_series(series_x).value)

        return series_x


class NumberRemoval(BaseFunction):
    a: float
    b: Optional[float] = None
    c: Optional[float] = None

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.copy()
        if self.a is not None:
            result.loc[result == float(self.a)] = pd.NA
        if self.b is not None:
            result.loc[result == float(self.b)] = pd.NA
        if self.c is not None:
            result.loc[result == float(self.c)] = pd.NA

        return result


class RangeRemoval(BaseFunction):
    a: Optional[float] = None
    b: Optional[float] = None

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.copy()
        result.loc[(result >= float(self.a)) & (result <= float(self.b))] = pd.NA
        return result


class OutOfRangeRemoval(BaseFunction):
    a: Optional[float] = None
    b: Optional[float] = None

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        result = series_x.copy()
        result.loc[(result < float(self.a)) | (result > float(self.b))] = pd.NA
        return result


class StringRemoval(BaseFunction):
    s: str
    t: str

    def custom_validate(self):
        required_ts = [
            DataTypeEncode.TEXT.value,
            DataTypeEncode.CATEGORY.value,
        ]
        if self.t.strip() not in required_ts:
            raise FunctionFieldError(INVALID_VALUE_MSG).add_error(
                ErrorField(function_type=self.function_type(), field='t', msg=f'Value of t must in {required_ts}'),
            )

    def eval_to_series(
        self,
        *,
        series_x: pd.Series | None = None,
        series_y: pd.Series | None = None,
    ) -> pd.Series | np.NDArray:
        self.custom_validate()
        self.set_type_cast(self.t)

        result = series_x.copy()
        if self.s is not None:
            result.loc[result == self.s] = pd.NA

        type_convert = TypeConvert.from_kwargs(t=self.type_cast)
        return type_convert.eval_to_series(series_x=result)


EQUATION_DEFINITION = {
    10: LinearFunction,
    11: LinearCombination,
    12: Production,
    13: Ratio,
    14: ExpTransform,
    15: PowTransform,
    16: LogTransform,
    20: HexToDec,
    21: HexToBin,
    22: HexToLogical,
    28: RadiusPosition,
    29: AngularPosition,
    30: StringExtraction,
    32: CategoryGeneration,
    40: Datetime,
    41: DatetimeFromDateAndTime,
    42: DateExtraction,
    43: TimeframeExtraction,
    44: WeekdayExtraction,
    45: WeekNumExtraction,
    46: DayExtraction,
    47: MonthExtraction,
    48: YearExtraction,
    50: LogicalEqual,
    51: LogicalNotEqual,
    55: LogicalOr,
    56: LogicalAnd,
    60: RegexExtraction,
    61: RegexRemoval,
    62: RegexReplacement,
    70: Merge,
    71: Lookup,
    72: TypeConvert,
    80: Shift,
    90: FillNa,
    120: NumberRemoval,
    121: RangeRemoval,
    122: OutOfRangeRemoval,
    130: StringExtraction,
    131: StringRemoval,
    160: RegexExtraction,
    161: RegexRemoval,
    162: RegexReplacement,
    170: Merge,
    171: Lookup,
    172: TypeConvert,
    190: FillNa,
}
