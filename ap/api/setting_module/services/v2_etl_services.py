import csv
import logging
import re
from pathlib import Path
from typing import List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from pandas import DataFrame
from pandas.errors import ParserError

from ap.api.trace_data.services.proc_link import add_sensor
from ap.common.common_utils import open_with_zip
from ap.common.constants import (
    ABNORMAL_REVERSED_WELL_KNOWN_COLUMNS,
    ABNORMAL_V2_COLS,
    ABNORMAL_WELL_KNOWN_COLUMNS,
    DF_CHUNK_SIZE,
    REVERSED_WELL_KNOWN_COLUMNS,
    SUB_PART_NO_DEFAULT_NO,
    SUB_PART_NO_DEFAULT_SUFFIX,
    SUB_PART_NO_NAMES,
    WELL_KNOWN_COLUMNS,
    DataGroupType,
    DataType,
    DBType,
    v2_PART_NO_REGEX,
)
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.services.csv_content import gen_data_types, get_metadata
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.normalization import normalize_str
from ap.setting_module.models import (
    CfgDataSourceCSV,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessUnusedColumn,
    crud_config,
    make_session,
)
from ap.setting_module.schemas import ProcessColumnSchema


@log_execution_time()
def predict_v2_data_type(columns, df):
    """
    predict data type for v2 columns
    """
    data_types = [gen_data_types(df[col], is_v2=True) for col in columns]
    return data_types


@log_execution_time()
def add_process_columns(process_id, column_data: list):
    proc_column_schemas = ProcessColumnSchema()
    current_columns = CfgProcessColumn.get_all_columns(process_id)
    with make_session() as meta_session:
        sensors = set()
        for column in column_data:
            proc_column = proc_column_schemas.load(column)
            proc_column.english_name = to_romaji(proc_column.column_name)
            proc_column.name = proc_column.column_name
            proc_column.process_id = process_id
            current_columns.append(proc_column)
            sensors.add(
                (process_id, proc_column.column_name, DataType[proc_column.data_type].value)
            )

        # save columns
        crud_config(
            meta_session=meta_session,
            data=current_columns,
            parent_key_names=CfgProcessColumn.process_id.key,
            key_names=CfgProcessColumn.column_name.key,
            model=CfgProcessColumn,
        )

        add_sensor(sensors)
    return True


def add_remaining_v2_columns(df, process_id):
    remaining_columns = find_remaining_columns(process_id, df.columns)
    if not remaining_columns:
        return False

    data_types = predict_v2_data_type(remaining_columns, df)
    columns = []
    for i, col in enumerate(remaining_columns):
        columns.append(
            {
                'column_name': col,
                'data_type': DataType(data_types[i]).name,
                'predict_type': DataType(data_types[i]).name,
            }
        )

    return add_process_columns(process_id, columns)


@log_execution_time()
def get_datasource_type(process_id):
    proc_cfg: CfgProcess = CfgProcess.query.get(process_id)
    data_src: CfgDataSourceCSV = CfgDataSourceCSV.query.get(proc_cfg.data_source_id)
    if data_src:
        return data_src.cfg_data_source.type
    return None


@log_execution_time()
def is_v2_data_source(ds_type=None, process_id=None):
    ds_type = ds_type or get_datasource_type(process_id)
    if ds_type:
        return ds_type.lower() == DBType.V2.name.lower()
    return False


@log_execution_time()
def get_preview_processes_v2(
    sorted_files: List[str],
    maximum_files: Optional[int] = None,
) -> List[str]:
    found_processes = set()
    sorted_files = sorted_files[:maximum_files]
    for f_name in sorted_files:
        datasource_type, is_abnormal_v2 = get_v2_datasource_type_from_file(f_name)
        if datasource_type not in [DBType.V2, DBType.V2_MULTI, DBType.V2_HISTORY]:
            continue

        process_col_name = get_reversed_column_value_from_v2(
            datasource_type.name, DataGroupType.PROCESS_NAME.value, is_abnormal_v2
        )
        params = build_read_csv_for_v2(f_name, datasource_type, is_abnormal_v2)
        # we only use process_col_name
        params.update(usecols=[process_col_name])
        try:
            with pd.read_csv(f_name, chunksize=DF_CHUNK_SIZE, **params) as reader:
                for df_chunk in reader:
                    unique_processes = df_chunk[process_col_name].dropna().unique()
                    found_processes.update(unique_processes)
        except ParserError:
            with pd.read_csv(
                f_name, chunksize=DF_CHUNK_SIZE, quoting=csv.QUOTE_NONE, **params
            ) as reader:
                for df_chunk in reader:
                    unique_processes = df_chunk[process_col_name].dropna().unique()
                    found_processes.update(unique_processes)
        except Exception:
            logging.error(f"Couldn't read data from {f_name}")
            pass
    return list(found_processes)


@log_execution_time()
@memoize()
def get_df_v2_process_single_file(
    v2_file: str, process_name: str, datasource_type=None, is_abnormal_v2=False
) -> DataFrame:
    df = pd.DataFrame()

    if not datasource_type:
        datasource_type, is_abnormal_v2 = get_v2_datasource_type_from_file(v2_file)
    assert datasource_type in [
        DBType.V2,
        DBType.V2_MULTI,
        DBType.V2_HISTORY,
    ], 'We only need to get process from v2'
    process_col_name = get_reversed_column_value_from_v2(
        datasource_type.name, DataGroupType.PROCESS_NAME.value, is_abnormal_v2
    )
    params = build_read_csv_for_v2(v2_file, datasource_type, is_abnormal_v2)
    try:
        with pd.read_csv(v2_file, chunksize=DF_CHUNK_SIZE, **params) as reader:
            for df_chunk in reader:
                df_process = df_chunk[df_chunk[process_col_name] == process_name]
                df_process = df_process.drop_duplicates()
                df = pd.concat([df, df_process])
                df = df.drop_duplicates()
    except ParserError:
        with pd.read_csv(
            v2_file, chunksize=DF_CHUNK_SIZE, quoting=csv.QUOTE_NONE, **params
        ) as reader:
            for df_chunk in reader:
                df_process = df_chunk[df_chunk[process_col_name] == process_name]
                df_process = df_process.drop_duplicates()
                df = pd.concat([df, df_process])
                df = df.drop_duplicates()
    except Exception:
        logging.error(f"Couldn't read data from {v2_file}")
        pass

    # rename abnormal history name
    if is_abnormal_v2:
        df = rename_abnormal_history_col_names_from_df(df, datasource_type)
    return df


@log_execution_time()
@memoize()
def get_df_v2_process_multiple_files(v2_files: List[str], process_name: str) -> DataFrame:
    df = pd.DataFrame()
    for f_name in v2_files:
        df_process = get_df_v2_process_single_file(f_name, process_name)
        df = pd.concat([df, df_process])
        df = df.drop_duplicates()
    return df


@log_execution_time()
def simple_convert_to_v2_vertical(df: DataFrame, datasource_type=None) -> DataFrame:
    if not datasource_type:
        datasource_type, _ = get_v2_datasource_type_from_df(df)
    assert datasource_type in [
        DBType.V2,
        DBType.V2_MULTI,
    ], 'We only need to convert vertical from v2 and v2_multi'

    # TODO: the logic isn't the same as bridge, add more conditions later
    all_columns = WELL_KNOWN_COLUMNS[datasource_type.name].keys()
    quality_id_col = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name].get(
        DataGroupType.QUALITY_ID.value
    )
    quality_name_col = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name].get(
        DataGroupType.QUALITY_NAME.value
    )
    data_value_col = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name].get(
        DataGroupType.DATA_VALUE.value
    )
    unique_cols = [
        col for col in all_columns if col not in [quality_name_col, data_value_col, quality_id_col]
    ]

    quality_name_like_cols = [col for col in df.columns if col.startswith(quality_name_col)]

    data_value_like_cols = []
    for col in df.columns:
        # pandas will add suffix '.' to duplicated columns
        if col == data_value_col or col.startswith(f'{data_value_col}.'):
            data_value_like_cols.append(col)

    assert len(quality_name_like_cols) == len(data_value_like_cols)
    assert len(quality_name_like_cols) > 0

    # we don't need to melt if we don't have multiple quality_name + data_value columns
    if len(quality_name_like_cols) > 1:
        # TODO: use temporary column from constant
        temp_suffix_column = '__t__'
        temp_id_column = '__id__'

        stub_columns_to_be_converted = [quality_name_col, data_value_col]
        # add ".0" since the first columns does not have this suffix
        mapping = {col: f'{col}.0' for col in stub_columns_to_be_converted}
        df = df.rename(columns=mapping)

        # columns to transfer need to be unique, hence we add an unique column
        df[temp_id_column] = df.index

        df = (
            pd.wide_to_long(  # convert from wide to long
                df,
                stubnames=stub_columns_to_be_converted,
                i=unique_cols + [temp_id_column],
                j=temp_suffix_column,
                sep='.',  # pandas use "." to handle duplicated columns
            )
            .reset_index()
            .drop(columns=[temp_id_column, temp_suffix_column])  # remove unused columns
        )

    df = df.drop_duplicates(subset=unique_cols + [quality_name_col])
    df = df.dropna(subset=[quality_name_col])
    df = df.pivot(index=unique_cols, columns=quality_name_col, values=data_value_col)
    return df.reset_index()


@log_execution_time()
def get_vertical_df_v2_process_single_file(
    file: str, process_name: str, datasource_type=None, is_abnormal_v2=False
) -> DataFrame:
    df = get_df_v2_process_single_file(file, process_name, datasource_type, is_abnormal_v2)
    df = simple_convert_to_v2_vertical(df, datasource_type)
    return df


@log_execution_time()
def get_vertical_df_v2_process_multiple_files(v2_files: List[str], process_name: str) -> DataFrame:
    df = get_df_v2_process_multiple_files(v2_files, process_name)
    df = simple_convert_to_v2_vertical(df)
    return df


@log_execution_time()
def build_read_csv_for_v2(
    file_path: str, datasource_type: DBType = DBType.V2, is_abnormal_v2=False
):
    from ap.api.setting_module.services.data_import import NA_VALUES

    # copy from bridge's `build_read_csv_params`
    params = {}
    with open_with_zip(file_path, 'rb') as f:
        metadata = get_metadata(f, is_full_scan_metadata=True, default_csv_delimiter=',')
        params.update(metadata)

    must_get_columns = tuple(WELL_KNOWN_COLUMNS[datasource_type.name].keys())
    if is_abnormal_v2:
        must_get_columns = tuple(ABNORMAL_WELL_KNOWN_COLUMNS[datasource_type.name].keys())
    usecols = lambda x: x.startswith(must_get_columns)
    dtype = 'str'
    params.update(
        dict(
            usecols=usecols,
            skipinitialspace=True,
            na_values=NA_VALUES,
            error_bad_lines=False,
            skip_blank_lines=True,
            dtype=dtype,
        )
    )
    return params


@log_execution_time()
def save_unused_columns(process_id, unused_columns):
    is_v2 = is_v2_data_source(process_id=process_id)
    if not is_v2:
        return
    if unused_columns:
        unused_columns = [
            CfgProcessUnusedColumn(process_id=process_id, column_name=name)
            for name in unused_columns
        ]
        with make_session() as meta_session:
            crud_config(
                meta_session=meta_session,
                data=unused_columns,
                parent_key_names=CfgProcessUnusedColumn.process_id.key,
                key_names=CfgProcessUnusedColumn.column_name.key,
                model=CfgProcessUnusedColumn,
            )
    else:
        CfgProcessUnusedColumn.delete_all_columns_by_proc_id(process_id)


@log_execution_time()
def rename_sub_part_no(df: pd.DataFrame, datasource_type=None) -> Tuple[DataFrame, List, List, str]:
    """
    rename sub part-no groups for v2 history
    input:  子部品品番   子部品品番
    output: 子1品番    子2品番
    """

    # convert duplicate name in df
    count = {}
    header_names = []
    for name in df.columns:
        if name in count:
            count[name] += 1
            header_names.append(f'{name}{SUB_PART_NO_DEFAULT_SUFFIX}{count[name]}')
        else:
            count[name] = 0
            header_names.append(f'{name}')
    if not df.size:
        df = pd.DataFrame({}, columns=header_names)

    # define partno column list
    part_no_columns = []
    # check partno is existing in df
    partno = REVERSED_WELL_KNOWN_COLUMNS[DBType.V2.name][DataGroupType.PART_NO.value]
    if partno in header_names:
        part_no_columns.append(partno)

    if not datasource_type:
        datasource_type, _ = get_v2_datasource_type_from_df(df)

    if datasource_type != DBType.V2_HISTORY:
        # v2 measure
        return df, part_no_columns, datasource_type.value if datasource_type is not None else ''

    serial = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][DataGroupType.DATA_SERIAL.value]
    sub_part_no = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][DataGroupType.SUB_PART_NO.value]
    sub_lot_no = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][DataGroupType.SUB_LOT_NO.value]
    sub_tray_no = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][DataGroupType.SUB_TRAY_NO.value]
    sub_serial_no = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][
        DataGroupType.SUB_SERIAL.value
    ]

    update_columns = {}
    # we need to rename serial as well
    if serial in header_names:
        update_columns[serial] = serial.replace(SUB_PART_NO_DEFAULT_NO, '')

    for col_name in header_names:
        # if there is sub_part_no groups
        if (
            sub_part_no in col_name
            or sub_lot_no in col_name
            or sub_tray_no in col_name
            or sub_serial_no in col_name
        ):
            # eg. 子部品品番.1
            splitted_name = col_name.split(SUB_PART_NO_DEFAULT_SUFFIX)
            if len(splitted_name) == 1:
                sub_partno_name = splitted_name[0]
                idx = 1
            else:
                [sub_partno_name, idx] = col_name.split(SUB_PART_NO_DEFAULT_SUFFIX)
                idx = int(idx) + 1

            # new name: 子1品番
            new_col_name = sub_partno_name.replace(SUB_PART_NO_NAMES, str(idx))
            new_col_name = new_col_name.replace(SUB_PART_NO_DEFAULT_NO, '')
            update_columns[col_name] = new_col_name
            # add new column of part_no to handle value later
            if sub_part_no in col_name:
                part_no_columns.append(new_col_name)

    if update_columns:
        df = df.rename(columns=update_columns)
    return df, part_no_columns, datasource_type.value if datasource_type is not None else ''


@log_execution_time()
def find_remaining_columns(process_id, all_columns):
    """
    Get new columns of V2 process that are not in unused columns and used columns
    :param process_id:
    :param all_columns:
    :return: remaining column that need to import
    """
    unused_columns = CfgProcessUnusedColumn.get_all_unused_columns_by_process_id(process_id)

    import_columns = [col.column_name for col in CfgProcessColumn.get_all_columns(process_id)]
    used_columns = unused_columns + import_columns
    return [col for col in all_columns if col not in used_columns]


def get_v2_datasource_type_from_file(v2_file: Union[Path, str]) -> Optional[DBType]:
    """Check if this file is v2, v2 multi or v2 history"""
    df = pd.read_csv(v2_file, nrows=1)
    return get_v2_datasource_type_from_df(df)


def get_v2_datasource_type_from_df(df: DataFrame) -> Tuple[Optional[DBType], bool]:
    columns = set(col.strip() for col in df.columns)
    is_abnormal = False
    for datasource_type in [DBType.V2_HISTORY, DBType.V2, DBType.V2_MULTI]:
        must_exist_columns = set(WELL_KNOWN_COLUMNS[datasource_type.name].keys())
        abnormal_must_exist_columns = set(ABNORMAL_WELL_KNOWN_COLUMNS[datasource_type.name].keys())
        if columns >= must_exist_columns:
            return datasource_type, is_abnormal

        if columns >= abnormal_must_exist_columns:
            is_abnormal = True
            return datasource_type, is_abnormal
    return None, is_abnormal


@log_execution_time()
def transform_partno_value(df: pd.DataFrame, partno_columns: List) -> pd.DataFrame:
    """
    tranform part-no value to import data
    input: JP1234567890
    output: 7890
    """
    if df.empty:
        return df

    if partno_columns:
        r = re.compile(v2_PART_NO_REGEX)
        for column in partno_columns:
            df[column] = np.vectorize(
                lambda x: x[-4:] if type(x) == str and bool(r.match(x)) else x
            )(df[column])
    return df


@log_execution_time()
def prepare_to_import_v2_df(
    df: DataFrame, process_id: int, datasource_type=None
) -> Tuple[DataFrame, bool]:
    """
    :return: transformed dataframe, has_new_columns
    """
    if not datasource_type:
        datasource_type, _ = get_v2_datasource_type_from_df(df)

    col_names = {col: normalize_str(col) for col in df.columns}
    df = df.rename(columns=col_names)
    df, part_no_cols, *_ = rename_sub_part_no(df, datasource_type)
    df = transform_partno_value(df, part_no_cols)

    # we just need to find remaining columns on long dataset
    has_remaining_cols = False
    if datasource_type in [DBType.V2, DBType.V2_MULTI]:
        has_remaining_cols = add_remaining_v2_columns(df.iloc[:1000], process_id)
    return df, has_remaining_cols


def get_reversed_column_value_from_v2(datasource_type, reversed_column_name, is_abnormal_v2):
    """
    :return: v2 normal column name
    """
    if is_abnormal_v2:
        return ABNORMAL_REVERSED_WELL_KNOWN_COLUMNS[datasource_type][reversed_column_name]

    return REVERSED_WELL_KNOWN_COLUMNS[datasource_type][reversed_column_name]


def rename_abnormal_history_col_names(datasource_type, headers, is_abnormal_v2):
    """
    :return: v2 normal columns from abnormal headers
    """
    rename_headers = []

    if not is_abnormal_v2:
        return headers

    for col_name in headers:
        if col_name in ABNORMAL_V2_COLS.keys():
            abnormal_value = ABNORMAL_V2_COLS[col_name]
            col_name = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][abnormal_value]
        rename_headers.append(col_name)
    return rename_headers


def rename_abnormal_history_col_names_from_df(df, datasource_type):
    """
    :return: df with normal headers
    """
    rename_headers = {}
    headers = df.columns.to_list()
    for col_name in headers:
        if col_name in ABNORMAL_V2_COLS.keys():
            abnormal_value = ABNORMAL_V2_COLS[col_name]
            rename_col = REVERSED_WELL_KNOWN_COLUMNS[datasource_type.name][abnormal_value]
            rename_headers[col_name] = rename_col
    # return rename_headers
    if len(rename_headers.keys()):
        df.rename(columns=rename_headers, inplace=True)
    return df
