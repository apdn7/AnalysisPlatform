from __future__ import annotations

import csv
import logging
import os
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Optional

import numpy as np
import pandas as pd
from pandas import DataFrame
from pandas.errors import ParserError

from ap.api.efa.services.etl import detect_file_path_delimiter
from ap.api.setting_module.services.csv_import import (
    convert_csv_timezone,
    convert_datetime_format,
    merge_is_get_date_from_date_and_time,
)
from ap.api.setting_module.services.data_import import NA_VALUES, convert_df_col_to_utc, convert_df_datetime_to_str
from ap.api.setting_module.services.equations import get_all_normal_columns_for_functions
from ap.api.setting_module.services.factory_import import handle_time_zone
from ap.api.setting_module.services.import_function_column import calculate_data_for_main_serial_function_column
from ap.api.setting_module.services.show_latest_record import get_info_from_db
from ap.api.setting_module.services.v2_etl_services import (
    get_df_v2_process_single_file,
    get_v2_datasource_type_from_file,
    get_vertical_df_v2_process_single_file,
)
from ap.common.common_utils import detect_encoding, get_latest_files
from ap.common.constants import (
    DF_CHUNK_SIZE,
    EMPTY_STRING,
    MAXIMUM_PROCESSES_ORDER_FILES,
    DataColumnType,
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
    def get_autolink_groups(cls, process_ids: list[int]) -> list[list[int]]:
        # each csv process should be in a separated group
        autolink_csv_data: list[AutolinkDataProcess] = []
        # each factory process should be in a separated group
        autolink_db_data: list[AutolinkDataProcess] = []
        # v2 processes with the same directory should be in a same group by directory (requirement)
        autolink_v2_data: dict[str, list[AutolinkDataProcess]] = defaultdict(list)

        for process_id in process_ids:
            autolink_data = AutolinkDataProcess(process_id)

            if not autolink_data.can_run_autolink():
                continue

            if autolink_data.cfg_process.data_source.type == DBType.V2.name:
                autolink_v2_data[autolink_data.cfg_process.data_source.csv_detail.directory].append(autolink_data)
            elif autolink_data.cfg_process.data_source.type == DBType.CSV.name:
                autolink_csv_data.append(autolink_data)
            else:
                autolink_db_data.append(autolink_data)

        autolink_datas: list[CompletedAutolinkDataProcess] = []
        autolink_datas.extend(map(read_autolink_csv, autolink_csv_data))
        autolink_datas.extend(map(read_autolink_db, autolink_db_data))
        for _, data in autolink_v2_data.items():
            autolink_datas.extend(read_autolink_v2(data))

        dataframe_list = [d.data for d in autolink_datas if not d.data.empty]
        if not dataframe_list:
            return []

        autolink_dataframe = pd.concat(dataframe_list)
        autolink_dataframe = cls._preprocess(autolink_dataframe)
        autolink_groups = cls._group(autolink_dataframe)
        sorted_groups = [cls._sort(autolink_dataframe, group) for group in autolink_groups]
        return sorted_groups

    @staticmethod
    def _preprocess(df: DataFrame) -> DataFrame:
        return (
            df.sort_values(DATE)
            .drop_duplicates(subset=[SERIAL, AUTO_LINK_ID], keep='last')
            # sometimes, datetime can be an empty string
            .replace(EMPTY_STRING, pd.NA)
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


@dataclass(frozen=True)
class CompletedAutolinkDataProcess:
    data: pd.DataFrame


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
        self.cfg_process = CfgProcess.get_proc_by_id(self.process_id)
        self.main_date_col: Optional[CfgProcessColumn] = None
        self.main_time_col: Optional[CfgProcessColumn] = None
        self.generated_datetime_col: Optional[CfgProcessColumn] = None
        self.main_datetime_col: Optional[CfgProcessColumn] = None
        self.main_serial_col: Optional[CfgProcessColumn] = None
        for column in self.cfg_process.columns if self.cfg_process is not None else []:  # type: CfgProcessColumn
            if column.column_type == DataColumnType.MAIN_DATE.value:
                self.main_date_col = column
            elif column.column_type == DataColumnType.MAIN_TIME.value:
                self.main_time_col = column
            elif column.is_get_date and column.column_type == DataColumnType.DATETIME.value:
                self.generated_datetime_col = column
                self.main_datetime_col = column
            elif column.is_serial_no:
                self.main_serial_col = column

    def can_run_autolink(self) -> bool:
        """Check whether we can run autolink on this process"""
        # do not run if this is invalid process
        if self.cfg_process is None:
            return False

        # do not run if we don't have serial
        if self.main_serial_col is None:
            return False

        # do not run if we don't have main datetime column, or that column is created from dummy datetime
        if self.main_datetime_col is None:
            return False
        if self.main_datetime_col.is_dummy_datetime:
            return False

        return True

    def is_generated_datetime(self) -> bool:
        return self.main_date_col is not None and self.main_time_col is not None

    def has_enough_data(self) -> bool:
        return len(self.df) >= AUTOLINK_TOTAL_RECORDS_PER_SOURCE

    def calculate_main_serial_function_column(self, df):
        df = calculate_data_for_main_serial_function_column(
            df,
            self.cfg_process,
            self.main_serial_col,
        )
        return df

    def update(self, df: pd.DataFrame):
        if not self.main_datetime_col:
            raise ValueError('No auto link date time')

        if not self.main_serial_col:
            raise ValueError('No auto link date time')

        main_datetime_col = self.main_datetime_col.column_raw_name
        main_serial_col = self.main_serial_col.column_raw_name
        dict_datatype = {
            self.main_datetime_col.column_raw_name: self.main_datetime_col.data_type,
        }
        if self.main_date_col and self.main_time_col:
            dict_datatype[self.main_date_col.column_raw_name] = self.main_date_col.data_type
            dict_datatype[self.main_time_col.column_raw_name] = self.main_time_col.data_type

        df = convert_datetime_format(
            df,
            dict_datatype,
            self.cfg_process.datetime_format,
        )
        if self.is_generated_datetime() and self.generated_datetime_col is not None:
            df = merge_is_get_date_from_date_and_time(
                df,
                main_datetime_col,
                self.main_date_col.column_raw_name,
                self.main_time_col.column_raw_name,
            )
        if main_datetime_col not in df:
            raise ValueError('No auto link date time')
        if main_serial_col not in df:
            raise ValueError('No auto link serial')
        df = df[[main_datetime_col, main_serial_col]]
        df = df.rename(columns={main_datetime_col: DATE, main_serial_col: SERIAL})

        df[AUTO_LINK_ID] = self.process_id

        # convert datetime and datetype, make sure df is cleaned before updating
        df = self.convert_timezone(df)
        df = df.astype(self.filter_dict_key_type([SERIAL, DATE]))

        # We just concat here, will drop duplicates later
        self.df = pd.concat([self.df, df])

    def convert_timezone(self, df: DataFrame) -> DataFrame:
        """
        Convert datetime column timezone
        Args:
            df: [DataFrame] - a dataframe containing datetime column

        Returns: [DataFrame] - a dataframe containing converted datetime column
        """
        if self.cfg_process.data_source.type.lower() in [DBType.CSV.value.lower(), DBType.V2.value.lower()]:
            df = convert_csv_timezone(df, DATE)
        else:
            is_timezone_inside, db_time_zone, utc_offset = handle_time_zone(
                self.cfg_process,
                self.main_datetime_col.column_raw_name,
            )
            df[DATE] = convert_df_col_to_utc(df, DATE, is_timezone_inside, db_time_zone, utc_offset)
            df[DATE] = convert_df_datetime_to_str(df, DATE)

        df[DATE] = df[DATE].fillna(EMPTY_STRING)  # after convert timezone DATE has NA
        return df

    @classmethod
    def filter_dict_key_type(cls, columns: list[str] | pd.Index) -> dict[str, pd.ExtensionDtype]:
        return {key: cls.DATA_TYPES[key] for key in columns if key in cls.DATA_TYPES}

    def completed(self) -> CompletedAutolinkDataProcess:
        return CompletedAutolinkDataProcess(data=self.df)


def read_autolink_csv(autolink_data: AutolinkDataProcess) -> CompletedAutolinkDataProcess:
    # Check self.date_col is generated datetime or not
    cfg_proc: CfgProcess = autolink_data.cfg_process
    main_datetime_col = autolink_data.main_datetime_col
    main_serial_col = autolink_data.main_serial_col
    if not main_datetime_col or not main_serial_col:
        return autolink_data.completed()

    path = cfg_proc.data_source.csv_detail.directory
    files = []
    if os.path.isdir(path):
        files = get_latest_files(path)[:MAXIMUM_PROCESSES_ORDER_FILES]
    elif os.path.isfile(path):
        files = [path]

    if main_serial_col.is_main_serial_function_column:
        # Get component columns that necessary for calculating value
        relation_column_ids = get_all_normal_columns_for_functions([main_serial_col.id], cfg_proc.columns)
        relation_columns: list[CfgProcessColumn] = CfgProcessColumn.get_by_ids(relation_column_ids)
        using_cols = [
            relation_column.column_raw_name
            for relation_column in relation_columns
            if not relation_column.is_function_column
        ]
    else:
        using_cols = [main_serial_col.column_raw_name]

    if autolink_data.is_generated_datetime():
        using_cols.extend(
            [autolink_data.main_date_col.column_raw_name, autolink_data.main_time_col.column_raw_name],
        )
    else:
        using_cols.append(main_datetime_col.column_raw_name)

    for file in files:
        delimiter = detect_file_path_delimiter(file, cfg_proc.data_source.csv_detail.delimiter)
        encoding = detect_encoding(file)
        params = {
            'chunksize': DF_CHUNK_SIZE,
            'usecols': using_cols,
            'sep': delimiter,
            'nrows': AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
            'encoding': encoding,
            'na_values': NA_VALUES,
            'on_bad_lines': 'skip',
            'skip_blank_lines': True,
            'index_col': False,
        }
        try:
            _read_autolink_csv_file(autolink_data, file, params)
        except ParserError:
            params.update({'quoting': csv.QUOTE_NONE})
            _read_autolink_csv_file(autolink_data, file, params)

    return autolink_data.completed()


def _read_autolink_csv_file(
    autolink_data: AutolinkDataProcess,
    filename: str,
    read_params: dict[str, Any],
):
    with pd.read_csv(filename, **read_params) as reader:
        for df in reader:
            if autolink_data.has_enough_data():
                break
            df_auto_link = df
            if autolink_data.main_serial_col.is_main_serial_function_column:
                df_auto_link = autolink_data.calculate_main_serial_function_column(df)
                df_auto_link = df_auto_link[
                    [
                        autolink_data.main_datetime_col.column_raw_name,
                        autolink_data.main_serial_col.column_raw_name,
                    ]
                ]

            autolink_data.update(df_auto_link)


def read_autolink_db(autolink_data: AutolinkDataProcess) -> CompletedAutolinkDataProcess:
    cfg_process: CfgProcess = autolink_data.cfg_process
    cfg_data_source: CfgDataSource = cfg_process.data_source
    main_datetime_col = autolink_data.main_datetime_col
    main_serial_col = autolink_data.main_serial_col
    if not main_datetime_col or not main_serial_col:
        return autolink_data.completed()

    cols, df, _ = get_info_from_db(
        cfg_data_source,
        cfg_process.table_name,
        sql_limit=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
        process_factid=cfg_process.process_factid,
        master_type=MasterDBType[cfg_process.master_type] if cfg_process.master_type else None,
    )
    if main_serial_col.is_main_serial_function_column:
        df = autolink_data.calculate_main_serial_function_column(df)

    autolink_data.update(df)
    # we do not try to loop until getting enough data from factory database ...
    if not autolink_data.has_enough_data():
        logger.warning(
            f'Autolink data for process {autolink_data.process_id}'
            f'does not have enough {AUTOLINK_TOTAL_RECORDS_PER_SOURCE} records',
        )

    return autolink_data.completed()


def read_autolink_v2(autolink_datas: list[AutolinkDataProcess]) -> list[CompletedAutolinkDataProcess]:
    if len(autolink_datas) == 0:
        return []

    cfg_proc: CfgProcess = autolink_datas[0].cfg_process
    path = cfg_proc.data_source.csv_detail.directory
    files = []
    if os.path.isdir(path):
        files = get_latest_files(path)[:MAXIMUM_PROCESSES_ORDER_FILES]
    elif os.path.isfile:
        files = [path]

    for file in files:
        read_autolink_v2_single_file(file, autolink_datas)

    return [d.completed() for d in autolink_datas]


def read_autolink_v2_single_file(file: str, autolink_datas: list[AutolinkDataProcess]):
    datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(file)
    if datasource_type not in [DBType.V2, DBType.V2_MULTI, DBType.V2_HISTORY]:
        return []

    for autolink_data in autolink_datas:
        if autolink_data.has_enough_data() or not autolink_data.cfg_process:
            continue

        data_src = autolink_data.cfg_process.data_source.csv_detail

        if datasource_type == DBType.V2_HISTORY:
            df_one_file = get_df_v2_process_single_file(
                file,
                process_name=data_src.process_name,
                datasource_type=datasource_type,
                is_abnormal_v2=is_abnormal_v2,
            )
        elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
            df_one_file = get_vertical_df_v2_process_single_file(
                file,
                process_name=data_src.process_name,
                datasource_type=datasource_type,
                is_abnormal_v2=is_abnormal_v2,
                is_en_cols=is_en_cols,
            )
        else:
            raise RuntimeError('invalid data source type')

        if autolink_data.main_serial_col.is_main_serial_function_column:
            df_one_file = autolink_data.calculate_main_serial_function_column(
                df_one_file,
            )

        autolink_data.update(df_one_file)

    return autolink_datas
