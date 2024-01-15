import csv
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, TypeVar, Union

import pandas as pd
from pandas import DataFrame, Series
from pandas.errors import ParserError

from ap.api.efa.services.etl import detect_file_path_delimiter
from ap.api.setting_module.services.show_latest_record import get_info_from_db
from ap.api.setting_module.services.v2_etl_services import (
    build_read_csv_for_v2,
    get_reversed_column_value_from_v2,
    get_v2_datasource_type_from_file,
)
from ap.common.common_utils import detect_encoding, get_csv_delimiter, get_latest_files
from ap.common.constants import (
    DF_CHUNK_SIZE,
    DUMMY_V2_PROCESS_NAME,
    MAXIMUM_PROCESSES_ORDER_FILES,
    REVERSED_WELL_KNOWN_COLUMNS,
    DataGroupType,
    DBType,
)
from ap.common.logger import log_execution_time
from ap.setting_module.models import CfgDataSource

ID = 'id'
PROCESS = 'process'
DATE = 'date'
SERIAL = 'serial'
COUNT = 'count'
ORDER = 'order'
REVERSED_ORDER = 'reversed_order'
SCORE = 'score'

LOG_PREFIX = 'AUTOLINK_'

AUTOLINK_TOTAL_RECORDS_PER_SOURCE = 100000


class SortMethod(Enum):
    CountOrderKeepMax = 1
    CountOrderKeepMean = 2
    CountOrderKeepAll = 3
    CountReversedOrder = 4
    FunctionCountReversedOrder = 5


@log_execution_time(LOG_PREFIX)
def get_processes_id_order(
    list_params: List[Dict[str, Any]],
    method: SortMethod = SortMethod.CountOrderKeepMax,
) -> List[List[int]]:
    autolink = AutoLink.from_list(list_params)
    reader = AutoLinkReader()
    ordered_processes = autolink.get_process_order(reader, method)
    ordered_groups = autolink.smarter_grouping_processes(reader, ordered_processes)
    return ordered_groups


AutoLinkSource = TypeVar('AutoLinkSource', bound='AutoLinkSourceBase')


class AutoLinkSourceBase:
    def __init__(
        self,
        processes: List[str] = [],  # noqa,
        ids: List[int] = [],  # noqa
        dbtype: Optional[str] = None,
        date_col: Optional[str] = None,
        serial_col: Optional[str] = None,
        **kwargs,
    ):
        self.processes = processes
        self.ids = ids
        self._dbtype = dbtype
        self.date_col = date_col
        self.serial_col = serial_col

    @property
    def dbtype(self) -> DBType:
        return DBType.from_str(self._dbtype)

    @classmethod
    def from_dict(cls, _dict: Dict[str, Any]) -> AutoLinkSource:
        return cls(**_dict)

    @property
    def process_id(self) -> int:
        return self.ids[0]

    def get_processes_df(self, reader: 'AutoLinkReader') -> None:
        """This method should be implemented in child class"""
        raise NotImplementedError


class AutoLinkSourcePath(AutoLinkSourceBase):
    def __init__(
        self,
        path: Optional[str] = None,
        delimiter: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.path = path
        self._delimiter = delimiter

    @property
    def delimiter(self) -> str:
        return get_csv_delimiter(self._delimiter)

    def get_delimiter(self, file: str) -> str:
        return detect_file_path_delimiter(file, self.delimiter)

    @property
    def files(self) -> List[str]:
        return get_latest_files(self.path)[:MAXIMUM_PROCESSES_ORDER_FILES]

    def get_processes_df(self, reader: 'AutoLinkReader') -> None:
        reader.read_path(self)


class AutoLinkSourceDB(AutoLinkSourceBase):
    def __init__(
        self,
        data_source_id: Optional[int] = None,
        table_name: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.data_source_id = data_source_id
        self.table_name = table_name

    @property
    def cfg_data_source(self) -> CfgDataSource:
        return CfgDataSource.query.get(self.data_source_id)

    def get_processes_df(self, reader: 'AutoLinkReader') -> None:
        reader.read_db(self)


class AutoLinkReader:
    def __init__(self):
        self.df = pd.DataFrame(columns=[ID, DATE, SERIAL])

    @staticmethod
    def drop_duplicates(df: DataFrame) -> DataFrame:
        """
        extract the latest record from same process and same serial
        to remove duplicate record from each process.
        """
        subset = []
        if PROCESS in df.columns:
            subset.append(PROCESS)
        if SERIAL in df.columns:
            subset.append(SERIAL)
        if ID in df.columns:
            subset.append(ID)
        return (
            df.sort_values(DATE).drop_duplicates(subset=subset, keep='last').reset_index(drop=True)
        )

    @log_execution_time(LOG_PREFIX)
    def __read_v2(self, file: Union[Path, str], processes: List[str], ids: List[int]):
        datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(file)
        if datasource_type not in [DBType.V2, DBType.V2_MULTI, DBType.V2_HISTORY]:
            return

        process_col = get_reversed_column_value_from_v2(
            datasource_type.name, DataGroupType.PROCESS_NAME.value, is_abnormal_v2, is_en_cols
        )
        serial_col = get_reversed_column_value_from_v2(
            datasource_type.name, DataGroupType.DATA_SERIAL.value, is_abnormal_v2
        )
        date_col = get_reversed_column_value_from_v2(
            datasource_type.name, DataGroupType.DATA_TIME.value, is_abnormal_v2
        )
        cols = [process_col, serial_col, date_col]

        rename_params = {
            process_col: PROCESS,
            date_col: DATE,
            serial_col: SERIAL,
        }

        # there's case where a single process have multiple ids, we need to handle that as well
        mapping_processes_id: Dict[str, List[int]] = {}
        for process, idx in zip(processes, ids):
            if process not in mapping_processes_id:
                mapping_processes_id[process] = [idx]
            else:
                mapping_processes_id[process].append(idx)

        params = build_read_csv_for_v2(str(file), datasource_type, is_abnormal_v2)
        params.update(usecols=cols)

        try:
            with pd.read_csv(
                file, chunksize=DF_CHUNK_SIZE, nrows=AUTOLINK_TOTAL_RECORDS_PER_SOURCE, **params
            ) as reader:
                for df_chunk in reader:
                    if DUMMY_V2_PROCESS_NAME in mapping_processes_id:
                        df_chunk[process_col] = df_chunk[process_col].fillna(DUMMY_V2_PROCESS_NAME)
                    df_processes = df_chunk[df_chunk[process_col].isin(mapping_processes_id)]
                    df_processes = df_processes.rename(columns=rename_params)

                    replaced_df = pd.DataFrame()
                    for process, ids in mapping_processes_id.items():
                        filtered_df: DataFrame = df_processes[df_processes[PROCESS] == process]
                        for idx in ids:
                            replaced_id_df = filtered_df.copy()
                            replaced_id_df[ID] = replaced_id_df[PROCESS].replace(process, idx)
                            replaced_id_df = replaced_id_df.drop(columns=[PROCESS])
                            replaced_id_df = self.drop_duplicates(replaced_id_df)
                            replaced_df = pd.concat([replaced_df, replaced_id_df])

                    self.df = pd.concat([self.df, replaced_df])
                    self.df = self.drop_duplicates(self.df)
        except ParserError:
            with pd.read_csv(
                file,
                chunksize=DF_CHUNK_SIZE,
                quoting=csv.QUOTE_NONE,
                nrows=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
                **params,
            ) as reader:
                for df_chunk in reader:
                    if DUMMY_V2_PROCESS_NAME in mapping_processes_id:
                        df_chunk[process_col] = df_chunk[process_col].fillna(DUMMY_V2_PROCESS_NAME)
                    df_processes = df_chunk[df_chunk[process_col].isin(mapping_processes_id)]
                    df_processes = df_processes.rename(columns=rename_params)

                    replaced_df = pd.DataFrame()
                    for process, ids in mapping_processes_id.items():
                        filtered_df: DataFrame = df_processes[df_processes[PROCESS] == process]
                        for idx in ids:
                            replaced_id_df = filtered_df.copy()
                            replaced_id_df[ID] = replaced_id_df[PROCESS].replace(process, idx)
                            replaced_id_df = replaced_id_df.drop(columns=[PROCESS])
                            replaced_id_df = self.drop_duplicates(replaced_id_df)
                            replaced_df = pd.concat([replaced_df, replaced_id_df])

                    self.df = pd.concat([self.df, replaced_df])
                    self.df = self.drop_duplicates(self.df)

    @log_execution_time(LOG_PREFIX)
    @lru_cache(512)
    def __read_normal_file(
        self,
        file: Union[Path, str],
        date_col: str,
        serial_col: str,
        delimiter: str,
    ):
        """Write separate read normal file, so we can cache read df"""
        df = pd.DataFrame()
        rename_params = {
            date_col: DATE,
            serial_col: SERIAL,
        }
        encoding = detect_encoding(file)
        try:
            with pd.read_csv(
                file,
                chunksize=DF_CHUNK_SIZE,
                usecols=[date_col, serial_col],
                sep=delimiter,
                nrows=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
                encoding=encoding,
            ) as reader:
                for df_chunk in reader:
                    df_chunk = df_chunk.rename(columns=rename_params)
                    df = pd.concat([df, df_chunk])
                    df = self.drop_duplicates(df)
        except ParserError:
            with pd.read_csv(
                file,
                chunksize=DF_CHUNK_SIZE,
                usecols=[date_col, serial_col],
                sep=delimiter,
                quoting=csv.QUOTE_NONE,
                encoding=encoding,
            ) as reader:
                for df_chunk in reader:
                    df_chunk = df_chunk.rename(columns=rename_params)
                    df = pd.concat([df, df_chunk])
                    df = self.drop_duplicates(df)
        return df

    def read_path(self, source: AutoLinkSourcePath) -> None:
        for file in source.files:
            # v2
            if source.dbtype in [DBType.V2, DBType.V2_MULTI]:
                if len(source.processes) != len(source.ids):
                    raise RuntimeError(
                        'We do not allow number of processes different with ids, '
                        'this must be front-end bug.'
                    )
                self.__read_v2(file, source.processes, source.ids)
                continue

            # normal csv, tsv, etc
            df = self.__read_normal_file(
                file,
                date_col=source.date_col,
                serial_col=source.serial_col,
                delimiter=source.get_delimiter(file),
            )
            df[ID] = source.process_id
            self.df = pd.concat([self.df, df])
            self.df = self.drop_duplicates(self.df)

    def read_db(self, source: AutoLinkSourceDB) -> None:
        cols, df = get_info_from_db(
            source.cfg_data_source,
            source.table_name,
            sql_limit=AUTOLINK_TOTAL_RECORDS_PER_SOURCE,
        )
        assert source.date_col in cols
        assert source.serial_col in cols
        rename_params = {
            source.date_col: DATE,
            source.serial_col: SERIAL,
        }
        df = df[[source.date_col, source.serial_col]].rename(columns=rename_params)
        df[ID] = source.process_id
        self.df = pd.concat([self.df, df])
        self.df = self.drop_duplicates(self.df)


@dataclass
class SortAlgo:
    def sorted_processes(self, df: DataFrame) -> List[str]:
        raise NotImplementedError

    @staticmethod
    def verify(df: DataFrame) -> bool:
        return {ID, DATE, SERIAL} == set(df.columns)

    def get_count_by_serial(self, df: DataFrame) -> DataFrame:
        if not self.verify(df):
            raise NotImplementedError(f'df contains unexpected columns: {df.columns}')
        df = df.reset_index()
        df[COUNT] = df[[DATE, SERIAL]].groupby(SERIAL).transform('count')
        return df


class SortByCountOrderKeep(SortAlgo):
    def _sorted_processes(self, df: DataFrame, loop_count: Optional[int] = None) -> List[int]:
        """
        if loop_count = 1, we just loop 1 time and emit found ordered processes
        if loop_count = None, we loop until we found all processes in dataframe
        """
        df = self.get_count_by_serial(df)

        loop = 0
        ordered_processes = []
        while not df.empty:
            # extract subset which has the biggest count.
            max_count = df[COUNT].max()
            df_count = df[df[COUNT] == max_count]
            df_count[ORDER] = (
                df_count.sort_values([DATE, ID], ascending=[True, False]).groupby(SERIAL).cumcount()
                + 1
            )

            # calculate mean of order against each process
            agg_params = {ORDER: 'mean', DATE: 'min'}
            current_ordered = (
                df_count[[ID, DATE, ORDER]]
                .groupby(ID)
                .agg(agg_params)
                .sort_values([ORDER, DATE, ID], ascending=[True, True, True])
                .index.to_list()
            )
            ordered_processes.extend(current_ordered)

            loop += 1
            if loop_count is not None and loop >= loop_count:
                break
            # remove ordered processes
            df = df[~df[ID].isin(current_ordered)]

        return ordered_processes


class SortByCountOrderKeepMax(SortByCountOrderKeep):
    @log_execution_time(LOG_PREFIX)
    def sorted_processes(self, df: DataFrame) -> List[int]:
        return self._sorted_processes(df, loop_count=1)


class SortByCountOrderKeepAll(SortByCountOrderKeep):
    @log_execution_time(LOG_PREFIX)
    def sorted_processes(self, df: DataFrame) -> List[int]:
        return self._sorted_processes(df, loop_count=None)


class SortByCountOrderKeepMean(SortAlgo):
    @log_execution_time(LOG_PREFIX)
    def sorted_processes(self, df: DataFrame) -> List[str]:
        df = self.get_count_by_serial(df)
        mean = df[COUNT].mean()
        df = df[df[COUNT] >= mean]
        df[ORDER] = (
            df.sort_values([DATE, ID], ascending=[True, False]).groupby(SERIAL).cumcount() + 1
        )

        # calculate mean of order against each process
        agg_params = {ORDER: 'mean', DATE: 'min'}
        return (
            df[[ID, DATE, ORDER]]
            .groupby(ID)
            .agg(agg_params)
            .sort_values([ORDER, DATE, ID], ascending=[True, True, True])
            .index.to_list()
        )


@dataclass
class SortByFunctionCountReversedOrder(SortAlgo):
    kind: str = 'ident'

    def function_count(self, s: Series) -> Series:
        if self.kind == 'ident':
            return s
        if self.kind == 'square':
            return s * s
        if self.kind == 'cube':
            return s * s * s
        if self.kind == 'power_of_two':
            return s.pow(2)

    def _sorted_processes(self, df: DataFrame) -> List[str]:
        df = self.get_count_by_serial(df)
        df[REVERSED_ORDER] = (
            df.sort_values([DATE, ID], ascending=[False, False]).groupby(SERIAL).cumcount() + 1
        )
        df[SCORE] = df[REVERSED_ORDER] * self.function_count(df[COUNT])

        # TODO: should we calculate score by sum or mean?
        agg_params = {SCORE: 'sum', DATE: 'min'}
        return (
            df[[ID, DATE, SCORE]]
            .groupby(ID)
            .agg(agg_params)
            .sort_values([SCORE, DATE, ID], ascending=[False, True, True])
            .index.to_list()
        )

    @log_execution_time(LOG_PREFIX)
    def sorted_processes(self, df: DataFrame) -> List[str]:
        return self._sorted_processes(df)


class SortByCountReversedOrder(SortByFunctionCountReversedOrder):
    @log_execution_time(LOG_PREFIX)
    def sorted_processes(self, df: DataFrame) -> List[str]:
        return super()._sorted_processes(df)


@dataclass
class AutoLink:
    sources: List[AutoLinkSourceBase]

    @classmethod
    def from_list(cls, _list: List[Dict[str, Any]]) -> 'AutoLink':
        sources = []
        for _dict in _list:
            src_base = AutoLinkSourceBase.from_dict(_dict)
            if src_base.dbtype.is_db():
                sources.append(AutoLinkSourceDB.from_dict(_dict))
            else:
                sources.append(AutoLinkSourcePath.from_dict(_dict))
        return cls(sources)

    @log_execution_time(LOG_PREFIX)
    def get_processes_df(self, reader: AutoLinkReader) -> None:
        for source in self.sources:
            source.get_processes_df(reader)

    @staticmethod
    @log_execution_time(LOG_PREFIX)
    def normal_grouping_processes(
        reader: AutoLinkReader, ordered_processes: List[int]
    ) -> List[List[int]]:
        """
        Separate ordered processes into groups of processes which can have same serials between link
        E.g: Suppose we have processes [1,2,3] but 2 can not link with 3 => result: [[1,2],[3]]
        """
        unique_serials: Dict[int, Set] = {}
        for process in ordered_processes:
            unique_serials[process] = set(reader.df[reader.df[ID] == process][SERIAL])

        reversed_ordered_processes = ordered_processes[::-1]
        groups = []
        current_group = []
        while len(reversed_ordered_processes):
            proc = reversed_ordered_processes.pop()
            if not current_group:
                current_group.append(proc)
                continue

            if not unique_serials[proc].isdisjoint(unique_serials[current_group[-1]]):
                current_group.append(proc)
            else:
                groups.append(current_group)
                current_group = [proc]

        if current_group:
            groups.append(current_group)

        return groups

    @staticmethod
    @log_execution_time(LOG_PREFIX)
    def smart_grouping_processes(
        reader: AutoLinkReader, ordered_processes: List[int]
    ) -> List[List[int]]:
        """Same with normal grouping processes
        However, we can find more processes in sorted chain and merge them into groups as well
        We just find if process has the same serial with other, we don't calculate how many intersect serials.
        This method might be a little bit heuristic.
        """
        unique_serials: Dict[int, Set] = {}
        copy_ordered_processes = [p for p in ordered_processes]
        for process in copy_ordered_processes:
            unique_serials[process] = set(reader.df[reader.df[ID] == process][SERIAL])
        groups = []
        while len(copy_ordered_processes):
            current_group = [copy_ordered_processes[0]]
            for process in copy_ordered_processes[1:]:
                if not unique_serials[process].isdisjoint((unique_serials[current_group[-1]])):
                    current_group.append(process)
            for process in current_group:
                copy_ordered_processes.remove(process)
            groups.append(current_group)

        return groups

    @staticmethod
    @log_execution_time(LOG_PREFIX)
    def smarter_grouping_processes(
        reader: AutoLinkReader, ordered_processes: List[int]
    ) -> List[List[int]]:
        """Same with above grouping method, but we loop all over group"""
        unique_serials: Dict[int, Set] = {}
        for process in ordered_processes:
            unique_serials[process] = set(reader.df[reader.df[ID] == process][SERIAL])
        groups = []
        for process in ordered_processes:
            if not groups:
                groups.append([process])
                continue
            index = 0
            inserted = False
            while any(index < len(group) for group in groups):
                for group in groups:
                    if len(group) <= index:
                        continue
                    if not unique_serials[group[index]].isdisjoint(unique_serials[process]):
                        group.append(process)
                        inserted = True
                        break
                if inserted:
                    break
                index += 1
            if not inserted:
                groups.append([process])
        return groups

    @log_execution_time(LOG_PREFIX)
    def get_process_order(
        self,
        reader: AutoLinkReader,
        method: SortMethod = SortMethod.CountOrderKeepMax,
    ) -> List[int]:
        self.get_processes_df(reader)

        if method is SortMethod.CountOrderKeepMax:
            sort_algo = SortByCountOrderKeepMax()
        elif method is SortMethod.CountOrderKeepMean:
            sort_algo = SortByCountOrderKeepMean()
        elif method is SortMethod.CountOrderKeepAll:
            sort_algo = SortByCountOrderKeepAll()
        elif method is SortMethod.CountReversedOrder:
            sort_algo = SortByCountReversedOrder()
        elif method is SortMethod.FunctionCountReversedOrder:
            sort_algo = SortByFunctionCountReversedOrder(kind='cube')
        else:
            raise NotImplementedError(f'{method.name} method is not supported')
        return sort_algo.sorted_processes(reader.df)
