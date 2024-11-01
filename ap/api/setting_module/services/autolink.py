from __future__ import annotations

import contextlib
import csv
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Optional

import numpy as np
import pandas as pd
import pydantic
from pandas import DataFrame, Series
from pandas.errors import ParserError
from pydantic import BaseModel, BeforeValidator

from ap.api.efa.services.etl import detect_file_path_delimiter
from ap.api.setting_module.services.csv_import import convert_datetime_format, merge_is_get_date_from_date_and_time
from ap.api.setting_module.services.data_import import NA_VALUES
from ap.api.setting_module.services.show_latest_record import get_info_from_db
from ap.api.setting_module.services.v2_etl_services import (
    build_read_csv_for_v2,
    get_reversed_column_value_from_v2,
    get_v2_datasource_type_from_file,
)
from ap.common.common_utils import DATE_FORMAT_SIMPLE, detect_encoding, get_latest_files
from ap.common.constants import (
    DF_CHUNK_SIZE,
    DUMMY_V2_PROCESS_NAME,
    MAXIMUM_PROCESSES_ORDER_FILES,
    DataColumnType,
    DataGroupType,
    DBType,
    MasterDBType,
)
from ap.common.logger import log_execution_time
from ap.setting_module.models import CfgDataSource, CfgProcess, CfgProcessColumn

logger = logging.getLogger(__name__)

AUTO_LINK_ID = 'id'
DATE = 'date'
SERIAL = 'serial'
COUNT = 'count'
REVERSED_ORDER = 'reversed_order'
SCORE = 'score'
LOG_PREFIX = 'AUTOLINK_'
AUTOLINK_TOTAL_RECORDS_PER_SOURCE = 100000


class Autolink:
    @classmethod
    @log_execution_time(LOG_PREFIX)
    def get_autolink_groups(cls, request_params: list[dict[str, Any]]) -> list[list[int]]:
        autolink_datas = []

        for param in request_params:
            # We can abstract this into a single function, but this will not enable type hint
            # So just write them here to make it easier to debug
            reader = None
            with contextlib.suppress(pydantic.ValidationError):
                reader = AutolinkCSV.model_validate(param)
                autolink_datas.extend(reader.read())
            with contextlib.suppress(pydantic.ValidationError):
                reader = AutolinkV2.model_validate(param)
                autolink_datas.extend(reader.read())
            with contextlib.suppress(pydantic.ValidationError):
                reader = AutolinkDB.model_validate(param)
                autolink_datas.extend(reader.read())
            if reader is None:
                raise ValueError(f'Invalid param for auto link: {param}')

        autolink_dataframe = pd.concat([data.df for data in autolink_datas])
        if autolink_dataframe.empty:
            return []

        autolink_dataframe = cls._preprocess(autolink_dataframe)
        autolink_groups = cls._group(autolink_dataframe)
        sorted_groups = [cls._sort(autolink_dataframe, group) for group in autolink_groups]
        return sorted_groups

    @staticmethod
    def _preprocess(df: DataFrame) -> DataFrame:
        return (
            df.sort_values(DATE)
            .drop_duplicates(subset=[SERIAL, AUTO_LINK_ID], keep='last')
            # sometimes, serial can be NA
            # See: https://trello.com/c/o1BXSEO0/52-4e-bugfix-auto-link-does-not-work-properly
            # we carefully drop all (SERIAL, AUTO_LINK_ID, DATE) if any of them is NA
            .dropna(how='any')
            .reset_index(drop=True)
        )

    @staticmethod
    def _group(df: DataFrame) -> list[list[int]]:
        """
        Group processes together before sorting.
        A process will be assigned to the same group if its SERIAL existed inside that group
        """

        @dataclass
        class Group:
            process_ids: list[int]
            serials: set[int]

            def isintersect(self, other: Group) -> bool:
                # we might add more logic here, for example: only intersect if they overlap more than 5%?
                return not self.serials.isdisjoint(other.serials)

            def merge(self, other: Group):
                self.process_ids.extend(other.process_ids)
                self.serials |= other.serials

        groups = []
        for process_id, process_dataframe in df.groupby(AUTO_LINK_ID):
            # using set is faster than numpy array, however, the init time is much worse
            group = Group(process_ids=[int(process_id)], serials=set(process_dataframe[SERIAL]))

            # merge intersected groups together and append to old `groups`
            new_group = []
            for existing_group in groups:
                if existing_group.isintersect(group):
                    group.merge(existing_group)
                else:
                    new_group.append(existing_group)
            new_group.append(group)
            groups = new_group

        return [g.process_ids for g in groups]

    @staticmethod
    def _sort(df: DataFrame, group: list[int]) -> list[int]:
        """Sort processes in the same group"""

        # this group needs not be sorted
        if len(group) == 1:
            return group

        df = df[df[AUTO_LINK_ID].isin(group)]
        df = df.reset_index()

        # serial and process id are dropped if they are duplicated
        # Therefore, if multiple serials exist they must belong to different processes
        # Since we are sorting linked processes, we don't want unique serials (because only a single process own them)
        # Hence, we remove non duplicated serials to avoid noise to our score function
        duplicated_serials = df[SERIAL].duplicated(keep=False)
        df = df[duplicated_serials]

        # We accidentally filter out processes in our groups
        # It must be a bug in our group functions
        # Instead of return invalid group, we must raise error here
        process_ids_after_filtered = set(df[AUTO_LINK_ID])
        if process_ids_after_filtered != set(group):
            raise ValueError(f'Process in this group: {group} are not connected, please check `_group` method')

        df[REVERSED_ORDER] = (
            df.sort_values([DATE, AUTO_LINK_ID], ascending=[False, False]).groupby(SERIAL).cumcount() + 1
        )
        # previously, we also calculate score using a much more complicated function,
        # but now just assign them as reversed_order, we keep this assignment here in case something need to be changed
        df[SCORE] = df[REVERSED_ORDER]

        agg_params = {SCORE: 'mean', DATE: 'min'}
        sorted_group = (
            df[[AUTO_LINK_ID, DATE, SCORE]]
            .groupby(AUTO_LINK_ID)
            .agg(agg_params)
            .sort_values([SCORE, DATE, AUTO_LINK_ID], ascending=[False, True, True])
            .index.to_list()
        )

        return sorted_group


class AutolinkDataProcess:
    DATA_TYPES: dict[str, pd.ExtensionDtype] = {
        SERIAL: pd.StringDtype(),
        DATE: np.datetime64(),
        AUTO_LINK_ID: pd.Int64Dtype(),
    }

    def __init__(self, process_id: int):
        self.process_id = process_id
        self.df = pd.DataFrame(columns=[SERIAL, DATE, AUTO_LINK_ID]).astype(
            self.filter_dict_key_type([SERIAL, DATE, AUTO_LINK_ID]),
        )
        self.cfg_process: CfgProcess = CfgProcess.query.get(self.process_id)

        self.main_date_col: Optional[CfgProcessColumn] = None
        self.main_time_col: Optional[CfgProcessColumn] = None
        self.generated_datetime_col: Optional[CfgProcessColumn] = None
        for column in self.cfg_process.columns if self.cfg_process is not None else []:  # type: CfgProcessColumn
            if column.column_type == DataColumnType.MAIN_DATE.value:
                self.main_date_col = column
            elif column.column_type == DataColumnType.MAIN_TIME.value:
                self.main_time_col = column
            elif column.is_get_date and column.column_type == DataColumnType.DATETIME.value:
                self.generated_datetime_col = column

    def is_generated_datetime(self) -> bool:
        return self.main_date_col is not None and self.main_time_col is not None

    def has_enough_data(self) -> bool:
        return len(self.df) >= AUTOLINK_TOTAL_RECORDS_PER_SOURCE

    def update(self, df: pd.DataFrame, date_col: str, serial_col):
        if (
            self.is_generated_datetime()
            and self.generated_datetime_col is not None
            and date_col == self.generated_datetime_col.column_raw_name
        ):
            convert_datetime_format(
                df,
                {
                    self.main_date_col.column_raw_name: self.main_date_col.data_type,
                    self.main_time_col.column_raw_name: self.main_time_col.data_type,
                },
                self.cfg_process.datetime_format,
            )
            merge_is_get_date_from_date_and_time(
                df,
                date_col,
                self.main_date_col.column_raw_name,
                self.main_time_col.column_raw_name,
            )
        if date_col not in df:
            raise ValueError('No auto link date time')
        if serial_col not in df:
            raise ValueError('No auto link serial')
        df = df[[date_col, serial_col]]
        df = df.rename(columns={date_col: DATE, serial_col: SERIAL})

        df[AUTO_LINK_ID] = self.process_id

        # convert datetime and datetype, make sure df is cleaned before updating
        df = self.convert_datetime(df)
        df = df.astype(self.filter_dict_key_type([SERIAL, DATE]))

        # We just concat here, will drop duplicates later
        self.df = pd.concat([self.df, df])

    @staticmethod
    def convert_datetime(df: DataFrame) -> DataFrame:
        """
        TODO: remove this, use already defined `convert_datetime_format`, this need to wait another MR from TuanLM18
        Convert datetime column to format `%Y-%m-%d %H:%M:%S`
        Args:
            df: [DataFrame] - a dataframe containing datetime column

        Returns: [DataFrame] - a dataframe containing converted datetime column
        """
        from ap.api.setting_module.services.csv_import import datetime_transform

        converted_df = df.copy()

        datetime_series: Series = converted_df[DATE]
        converted_datetime_series: Series = pd.to_datetime(datetime_series, errors='coerce').dt.strftime(
            DATE_FORMAT_SIMPLE,
        )
        non_datetime_series: Series = datetime_series[converted_datetime_series.isna()]
        converted_datetime_series.update(datetime_transform(non_datetime_series.astype(str)))

        converted_df[DATE] = converted_datetime_series
        return converted_df

    @classmethod
    def filter_dict_key_type(cls, columns: list[str] | pd.Index) -> dict[str, pd.ExtensionDtype]:
        return {key: cls.DATA_TYPES[key] for key in columns if key in cls.DATA_TYPES}


def validator_dbtype(raw: str) -> DBType:
    dbtype = DBType.from_str(raw)
    if dbtype is None:
        raise ValueError(f'{raw} is not a valid DbType')
    return dbtype


class AutolinkCSV(BaseModel):
    dbtype: Annotated[
        Literal[DBType.CSV],
        BeforeValidator(validator_dbtype),
    ]
    process_id: int
    process_name: str
    date_col: str
    serial_col: str
    path: str
    delimiter: str = 'Auto'

    def read(self) -> list[AutolinkDataProcess]:
        autolink_data = AutolinkDataProcess(self.process_id)
        files = get_latest_files(self.path)[:MAXIMUM_PROCESSES_ORDER_FILES]

        def _read_file(filename: str, read_params: dict[str, Any]):
            with pd.read_csv(filename, **read_params) as reader:
                for df in reader:
                    if autolink_data.has_enough_data():
                        break
                    autolink_data.update(df, self.date_col, self.serial_col)

        # Check self.date_col is generated datetime or not
        using_cols = [self.serial_col]
        if autolink_data.is_generated_datetime():
            using_cols.extend(
                [autolink_data.main_date_col.column_raw_name, autolink_data.main_time_col.column_raw_name],
            )
        else:
            using_cols.insert(0, self.date_col)

        for file in files:
            delimiter = detect_file_path_delimiter(file, self.delimiter)
            encoding = detect_encoding(file)
            params = {
                'chunksize': DF_CHUNK_SIZE,
                'usecols': using_cols,
                'sep': delimiter,
                'nrows': AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
                'encoding': encoding,
                'na_values': NA_VALUES,
                'error_bad_lines': False,
                'skip_blank_lines': True,
                'index_col': False,
            }
            try:
                _read_file(file, params)
            except ParserError:
                params.update({'quoting': csv.QUOTE_NONE})
                _read_file(file, params)

        return [autolink_data]


class AutolinkDB(BaseModel):
    dbtype: Annotated[
        Literal[
            DBType.POSTGRESQL,
            DBType.MSSQLSERVER,
            DBType.SQLITE,
            DBType.ORACLE,
            DBType.MYSQL,
            DBType.SOFTWARE_WORKSHOP,
        ],
        BeforeValidator(validator_dbtype),
    ]
    process_id: int
    process_name: str
    date_col: str
    serial_col: str
    data_source_id: int
    table_name: str

    def read(self) -> list[AutolinkDataProcess]:
        cfg_data_source = CfgDataSource.query.get(self.data_source_id)
        cfg_process = CfgProcess.query.get(self.process_id)
        cols, df, _ = get_info_from_db(
            cfg_data_source,
            self.table_name,
            sql_limit=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
            process_factid=cfg_process.process_factid,
            master_type=MasterDBType[cfg_process.master_type] if cfg_process.master_type else None,
        )
        autolink_data = AutolinkDataProcess(self.process_id)
        autolink_data.update(df, self.date_col, self.serial_col)
        # we do not try to loop until getting enough data from factory database ...
        if not autolink_data.has_enough_data():
            logger.warning(
                f'Autolink data for process {self.process_id}'
                f'does not have {AUTOLINK_TOTAL_RECORDS_PER_SOURCE} records',
            )
        return [autolink_data]


class AutolinkV2(BaseModel):
    dbtype: Annotated[
        Literal[
            DBType.V2,
            DBType.V2_MULTI,
            DBType.V2_HISTORY,
        ],
        BeforeValidator(validator_dbtype),
    ]
    process_ids: list[int]
    process_names: list[str]
    path: str

    def read(self) -> list[AutolinkDataProcess]:
        # there's case where a single process have multiple ids, we need to handle that as well
        mapping_process_ids = defaultdict(list)
        autolink_data_dictionary = {}
        for process, idx in zip(self.process_names, self.process_ids):
            mapping_process_ids[process].append(idx)
            autolink_data_dictionary[idx] = AutolinkDataProcess(idx)

        files = get_latest_files(self.path)[:MAXIMUM_PROCESSES_ORDER_FILES]
        for file in files:
            self.read_v2_file(file, mapping_process_ids, autolink_data_dictionary)

        return list(autolink_data_dictionary.values())

    def read_v2_file(
        self,
        file: str,
        mapping_process_ids: dict[str, list[int]],
        autolink_data_dictionary: dict[int, AutolinkDataProcess],
    ):
        datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(file)
        if datasource_type not in [DBType.V2, DBType.V2_MULTI, DBType.V2_HISTORY]:
            return

        process_col = get_reversed_column_value_from_v2(
            datasource_type.name,
            DataGroupType.PROCESS_NAME.value,
            is_abnormal_v2,
            is_en_cols,
        )
        serial_col = get_reversed_column_value_from_v2(
            datasource_type.name,
            DataGroupType.DATA_SERIAL.value,
            is_abnormal_v2,
        )
        date_col = get_reversed_column_value_from_v2(
            datasource_type.name,
            DataGroupType.DATA_TIME.value,
            is_abnormal_v2,
        )
        cols = [process_col, serial_col, date_col]

        def _read_v2_file(pandas_params: dict[str, Any]):
            with pd.read_csv(
                file,
                chunksize=DF_CHUNK_SIZE,
                nrows=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
                **pandas_params,
            ) as reader:
                for df_chunk in reader:
                    if DUMMY_V2_PROCESS_NAME in mapping_process_ids:
                        df_chunk[process_col] = df_chunk[process_col].fillna(DUMMY_V2_PROCESS_NAME)
                    # filter process which we don't want to autolink
                    df_processes = df_chunk[df_chunk[process_col].isin(mapping_process_ids)]
                    for process_name, df_process in df_processes.groupby(process_col):
                        # We duplicate processes where a single process name have multiple ids
                        for process_id in mapping_process_ids[process_name]:
                            if autolink_data_dictionary[process_id].has_enough_data():
                                continue
                            autolink_data_dictionary[process_id].update(
                                df_process,
                                date_col=date_col,
                                serial_col=serial_col,
                            )

        params = build_read_csv_for_v2(str(file), datasource_type, is_abnormal_v2)
        params.update(usecols=cols)

        try:
            _read_v2_file(params)
        except ParserError:
            params.update({'quoting': csv.QUOTE_NONE})
            _read_v2_file(params)
