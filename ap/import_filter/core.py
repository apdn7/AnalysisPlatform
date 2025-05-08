from __future__ import annotations

from abc import abstractmethod
from typing import ClassVar, Optional, Union

import pandas as pd
import pydantic
from pydantic import BaseModel

from ap.api.trace_data.services.filter_function_condition import (
    filter_and,
    filter_contains,
    filter_endswith,
    filter_or_values,
    filter_regex,
    filter_startswith,
    filter_substring,
)
from ap.common.constants import COL_DATA_TYPE, COL_NAME, DataType


class ImportFilter(BaseModel):
    data_type: ClassVar[Union[DataType, str]] = None
    column_name: ClassVar[str] = None
    cast_series_value_to_string: Optional[bool] = True
    should_combine_conditions: Optional[bool] = False

    @classmethod
    def from_kwargs(cls, **kwargs) -> 'ImportFilter':
        existed_required_kwargs = {k: v for k, v in kwargs.items() if k in cls.required_coefficients()}
        missing_required_kwargs = {k: None for k in cls.required_coefficients() if k not in existed_required_kwargs}
        optional_kwargs = {k: v for k, v in kwargs.items() if k in cls.optional_coefficients()}
        try:
            instance = cls(**existed_required_kwargs, **missing_required_kwargs, **optional_kwargs)
        except pydantic.ValidationError as exc:
            raise exc

        return instance

    @classmethod
    def all_coefficients(cls) -> set[str]:
        all_properties = cls.model_json_schema().get('properties', {}).keys()
        return set(all_properties)

    @classmethod
    def required_coefficients(cls) -> set[str]:
        return set(cls.model_json_schema().get('required', []))

    @classmethod
    def optional_coefficients(cls) -> set[str]:
        return cls.all_coefficients() - cls.required_coefficients()

    @classmethod
    def cast_series(cls, column_data: pd.Series, data_type: str, force_str=False) -> pd.Series:
        """
        cast series to target type
        @param column_data: series data
        @param data_type: target type
        @param force_str: force str force series to string for partial matching
        """
        series = column_data

        if data_type == DataType.INTEGER.name:
            series = series.astype('Int64')

        if force_str:
            series = series.astype(pd.StringDtype())

        return series

    @classmethod
    def cast_condition_value(cls, condition_value: Union[str, int], data_type: str) -> Union[str, int, float]:
        """
        cast condition value to target type before matching
        """
        value = str(condition_value)
        if data_type == DataType.INTEGER.name:
            value = int(condition_value)
        elif data_type == DataType.REAL.name:
            value = float(condition_value)
        return value

    @abstractmethod
    def do_filter(self, series: pd.Series, value):
        ...

    def filter_by_combine_conditions(self, df: pd.DataFrame, column_name: str, data_type: str) -> pd.DataFrame:
        series = self.cast_series(df[column_name], data_type=data_type, force_str=self.cast_series_value_to_string)
        conditions = [condition.value for condition in self.values]
        filtered_idx = self.do_filter(series, conditions)
        return df[filtered_idx]

    def filter_by_single_condition(self, df: pd.DataFrame, column_name: str, data_type: str) -> pd.DataFrame:
        for condition in self.values:
            series = self.cast_series(df[column_name], data_type=data_type, force_str=self.cast_series_value_to_string)
            condition_value = condition.value
            # cast condition value in case of MATCHES
            if not self.cast_series_value_to_string:
                condition_value = self.cast_condition_value(condition.value, data_type=data_type)
            filtered_idx = self.do_filter(series, condition_value)
            df = df[filtered_idx]
        return df

    def filter(self, df: pd.DataFrame, column_cfg: Union[dict, None] = None) -> pd.DataFrame:
        column_name = column_cfg.get(COL_NAME)
        data_type = column_cfg.get(COL_DATA_TYPE)

        if self.should_combine_conditions:
            return self.filter_by_combine_conditions(df, column_name, data_type)

        return self.filter_by_single_condition(df, column_name, data_type)


class Matches(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list
    cast_series_value_to_string: Optional[bool] = False

    def do_filter(self, series: pd.Series, value):
        return series == value


class Contains(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_contains(series, value)


class EndsWith(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_endswith(series, value)


class StartsWith(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_startswith(series, value)


class Regex(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_regex(series, value)


class Substring(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_substring(series, self.filter_from_position, value)


class AndSearch(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list

    def do_filter(self, series: pd.Series, value):
        return filter_and(series, value)


class OrSearch(ImportFilter):
    column_id: int
    filter_from_position: int
    values: list
    should_combine_conditions: Optional[bool] = True

    def do_filter(self, series: pd.Series, value):
        return filter_or_values(series, value)


FILTER_METHODS_DEFINITION = {
    'MATCHES': Matches,
    'ENDSWITH': EndsWith,
    'STARTSWITH': StartsWith,
    'CONTAINS': Contains,
    'REGEX': Regex,
    'SUBSTRING': Substring,
    'OR_SEARCH': OrSearch,
    'AND_SEARCH': AndSearch,
}
