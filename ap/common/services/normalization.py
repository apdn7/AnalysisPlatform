import re
import unicodedata
from enum import Enum
from typing import ClassVar

import pandas as pd
from pandas import DataFrame, Series
from pydantic import BaseModel

from ap.common.constants import EMPTY_STRING, ENCODING_ASCII, DataColumnType, DataType
from ap.common.log import log_execution_time
from ap.common.services.data_type import convert_df_str_to_others

NORMALIZE_FORM_NFKC = 'NFKC'
NORMALIZE_FORM_NFKD = 'NFKD'
HAN_SPACE = ' '
REPLACE_PAIRS = (('°C', '℃'), ('°F', '℉'))
DIC_IGNORE_NORMALIZATION = {
    'cfg_data_source_csv': [
        'directory',
        'etl_func',
        'process_name',
    ],  # process_name is used by V2, keep original value to extract again
    'cfg_data_source_db': ['host', 'dbname', 'schema', 'username', 'password'],
    'cfg_process_column': ['column_raw_name'],
}

# convert postal mark in string to `post`, done before normalize_str
# this is because normalize_str replaces with T
POSTAL_RE = re.compile(r'[\u3012\u3020\u3036]')

# special case for vietnamese: đ letter
VIETNAMESE_D_RE = re.compile(r'[đĐ]')

# remove space and tab
SYMBOLS_RE = re.compile(r'[\s\t\+\*…・:;!\?\$\&\"\'\`\=\@\#\\\/。、\.,~]')

# replace multi-spaces
MULTI_SPACES_RE = re.compile(r'\s+')

# `[μµ]` in `English Name` should be replaced in to `u`.
# convert u before kakasi applied to keep u instead of M
GREEK_U_RE = re.compile(r'[μµ]')


def convert_irregular(char):
    """
    Except cases:
        ① - ⑩ (9312 - 9321)
    """
    char_code = ord(char)
    shift_number = 10053
    # convert ➊ to 1
    irregular_number_1 = range(10102, 10111)  # ~ 10110
    irregular_number_2 = range(10112, 10121)  # ~ 10120
    irregular_number_3 = range(10122, 10131)  # ~ 10130
    irregular_number_4 = [10111, 10121, 10131]  # ⑩ -> 10
    # 〒〶 to T
    irregular_number_5 = [12306, 12342]

    if char_code in irregular_number_1:
        return chr(char_code - shift_number)
    if char_code in irregular_number_2:
        return chr(char_code - shift_number - 10)
    if char_code in irregular_number_3:
        return chr(char_code - shift_number - 20)
    if char_code in irregular_number_4:
        return '10'
    if char_code in irregular_number_5:
        return 'T'
    return char


def unicode_normalize(text, convert_irregular_chars=True, normalize_form=NORMALIZE_FORM_NFKC):
    # normalize (also replace Full Space to Half Space)
    text = unicodedata.normalize(normalize_form, text)
    # replace multi-spaces
    text = MULTI_SPACES_RE.sub(HAN_SPACE, text)
    # trim space
    text = text.strip()
    # replace ℃
    for replace_from, replace_to in REPLACE_PAIRS:
        text = text.replace(replace_from, replace_to)

    if convert_irregular_chars:
        text = [convert_irregular(char) for char in text]
        text = ''.join(text)

    return text


def normalize_preprocessing(input_str):
    """
    Some special cases need to be handled before normalization,
    so that they are not taken away by unicode_normalize
    :param input_str: input string
    :return:
    """
    normalized_input = input_str
    # convert postal mark in string to `post`, done before normalize_str
    # this is because normalize_str replaces with T
    normalized_input = POSTAL_RE.sub('post', normalized_input)
    # special case for vietnamese: đ letter
    normalized_input = VIETNAMESE_D_RE.sub('d', normalized_input)
    # remove space and tab
    normalized_input = SYMBOLS_RE.sub(EMPTY_STRING, normalized_input)
    return normalized_input


def remove_non_ascii_chars(string, convert_irregular_chars=True):
    from ap.common.services.jp_to_romaji_utils import replace_special_symbols

    normalized_input = normalize_preprocessing(string)

    # pascal case
    normalized_input = normalized_input.title()

    # TODO: Can this go to normalize_preprocessing as well?
    # `[μµ]` in `English Name` should be replaced in to `u`.
    # convert u before kakasi applied to keep u instead of M
    normalized_input = GREEK_U_RE.sub('uu', normalized_input)

    # normalize with NFKD
    normalized_input = normalize_str(
        normalized_input,
        convert_irregular_chars=convert_irregular_chars,
        normalize_form=NORMALIZE_FORM_NFKD,
    )

    normalized_input = replace_special_symbols(normalized_input)

    normalized_string = normalized_input.encode(ENCODING_ASCII, 'ignore').decode()
    return normalized_string


def normalize_str(val, convert_irregular_chars=True, normalize_form=NORMALIZE_FORM_NFKC):
    return unicode_normalize(val, convert_irregular_chars, normalize_form) if isinstance(val, str) else val


@log_execution_time()
def normalize_list(vals):
    series = pd.Series(vals)
    series: Series = normalize_series(series)
    return series.tolist()


@log_execution_time()
def normalize_df(df: DataFrame, col):
    return normalize_series(df[col])


@log_execution_time()
def normalize_series(orig_series):
    # Convert the column to string type
    series = convert_df_str_to_others(orig_series)
    series_type = series.dtypes.name
    if series_type == 'object':
        series = series.astype(pd.StringDtype())
    elif series_type == 'string':
        pass
    else:
        return orig_series

    # Chain string operations
    series = series.str.normalize(NORMALIZE_FORM_NFKC).str.replace(r'\s+', HAN_SPACE, regex=True).str.strip()

    for replace_from, replace_to in REPLACE_PAIRS:
        series = series.str.replace(replace_from, replace_to)

    return series


@log_execution_time()
def normalize_big_rows(rows, headers=None, strip_quote=True, return_dataframe=True, is_show_raw_data=False):
    df = pd.DataFrame(rows, columns=headers)
    df = df.convert_dtypes()

    for col in df.columns:
        series = convert_df_str_to_others(df[col])
        series_type = series.dtypes.name
        if series_type == 'object':
            # df[col] = df[col].fillna('')
            df[col] = df[col].astype(pd.StringDtype())
            implement_flag = True
        elif series_type == 'string':
            # df[col] = df[col].fillna('')
            implement_flag = True
        else:
            # df[col] = series
            implement_flag = False

        if implement_flag:
            if strip_quote:
                df[col] = df[col].str.strip("'")

            # for preview, show empty if there is NA
            if not is_show_raw_data:
                df[col] = normalize_df(df, col)

    if return_dataframe:
        return df

    return df.to_records(index=False).tolist()


def is_ignore_column(table_name, column_name):
    return column_name in DIC_IGNORE_NORMALIZATION.get(table_name, [])


def model_normalize(target):
    table_name = target.__class__.__table__.name
    cols = target.__class__.__table__.columns.keys()
    for col in cols:
        if is_ignore_column(table_name, col):
            continue

        val = getattr(target, col)
        new_val = normalize_str(val, convert_irregular_chars=False)
        setattr(target, col, new_val)


class SystemColMetadata(BaseModel):
    """System column metadata"""

    column_type: int
    name: str
    name_en: str
    name_jp: str
    accept_dtypes: list[DataType]


class FilterSystem(Enum):
    """Filter System Metadata"""

    PROCESS_NAME = SystemColMetadata(
        column_type=DataColumnType.PROCESS_NAME.value,
        name='ProcessName',
        name_en='ProcessName',
        name_jp='プロセス',
        accept_dtypes=[DataType.TEXT],
    )
    PROCESS_NO = SystemColMetadata(
        column_type=DataColumnType.PROCESS_NO.value,
        name='ProcessNo',
        name_en='ProcessNo',
        name_jp='プロセスNo',
        accept_dtypes=[DataType.INTEGER, DataType.INTEGER_SEP, DataType.EU_INTEGER_SEP],
    )
    LINE_NO = SystemColMetadata(
        column_type=DataColumnType.LINE_NO.value,
        name='LineNo',
        name_en='LineNo',
        name_jp='ラインNo',
        accept_dtypes=[DataType.INTEGER, DataType.INTEGER_SEP, DataType.EU_INTEGER_SEP],
    )
    LINE_NAME = SystemColMetadata(
        column_type=DataColumnType.LINE_NAME.value,
        name='LineName',
        name_en='LineName',
        name_jp='ライン名',
        accept_dtypes=[DataType.TEXT],
    )
    PART_NO = SystemColMetadata(
        column_type=DataColumnType.PART_NO.value,
        name='PartNo',
        name_en='PartNo',
        name_jp='品番',
        accept_dtypes=[DataType.INTEGER, DataType.INTEGER_SEP, DataType.EU_INTEGER_SEP],
    )
    PART_NAME = SystemColMetadata(
        column_type=DataColumnType.PART_NAME.value,
        name='PartName',
        name_en='PartName',
        name_jp='品名',
        accept_dtypes=[DataType.TEXT],
    )
    EQ_NAME = SystemColMetadata(
        column_type=DataColumnType.EQ_NAME.value,
        name='EqName',
        name_en='EqName',
        name_jp='設備名',
        accept_dtypes=[DataType.TEXT],
    )
    EQ_NO = SystemColMetadata(
        column_type=DataColumnType.EQ_NO.value,
        name='EqNo',
        name_en='EqNo',
        name_jp='設備No',
        accept_dtypes=[DataType.INTEGER, DataType.INTEGER_SEP, DataType.EU_INTEGER_SEP],
    )
    ST_NO = SystemColMetadata(
        column_type=DataColumnType.ST_NO.value,
        name='StNo',
        name_en='StNo',
        name_jp='ステーションNo',
        accept_dtypes=[DataType.INTEGER, DataType.INTEGER_SEP, DataType.EU_INTEGER_SEP],
    )
    JUDGE = SystemColMetadata(
        column_type=DataColumnType.JUDGE.value,
        name='Judge',
        name_en='Judge',
        name_jp='判定',
        accept_dtypes=[
            DataType.INTEGER,
            DataType.INTEGER_SEP,
            DataType.EU_INTEGER_SEP,
            DataType.TEXT,
            DataType.BOOLEAN,
        ],
    )


class GuessColumn(Enum):
    """Metadata and datatype for some columns with predefined names"""

    WAFER_NO = SystemColMetadata(
        column_type=DataColumnType.INT_CATE.value,
        name='Wfno',
        name_en='WaferNo',
        name_jp='ウエハ番号',
        accept_dtypes=[DataType.TEXT, DataType.INTEGER],
    )
    SLOT = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='Slot',
        name_en='Slot',
        name_jp='スロット',
        accept_dtypes=[DataType.TEXT, DataType.INTEGER],
    )
    WAFER_X = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='Wfx',
        name_en='WaferPosX',
        name_jp='ウエハx座標',
        accept_dtypes=[DataType.INTEGER, DataType.REAL],
    )
    WAFER_Y = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='Wfy',
        name_en='WaferPosY',
        name_jp='ウエハy座標',
        accept_dtypes=[DataType.INTEGER, DataType.REAL],
    )
    WAFER_R = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='Wfr',
        name_en='WaferPosR',
        name_jp='ウエハ半径',
        accept_dtypes=[DataType.INTEGER, DataType.REAL],
    )
    CHIP_X = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='chip_x',
        name_en='ChipX',
        name_jp='チップ座標x',
        accept_dtypes=[DataType.INTEGER],
    )
    CHIP_Y = SystemColMetadata(
        column_type=DataColumnType.GENERATED.value,
        name='chip_y',
        name_en='ChipY',
        name_jp='チップ座標y',
        accept_dtypes=[DataType.INTEGER],
    )


class ColumnRenamer:
    """A helper class to detect and rename database/dataframe columns based on patterns."""

    # Internal mapping rules configuration (Hidden from external direct modification)
    # Format: (Regex pattern, Target name)
    __MAPPING_RULES: ClassVar[list[tuple[str, FilterSystem]]] = [
        (r'^(proc|process|工程|工程名)$', FilterSystem.PROCESS_NAME),
        # (r'^(proc|process|工程)(_?no)$', FilterSystem.PROCESS_NO),
        (r'^(line|ライン)(no|番号)$', FilterSystem.LINE_NO),
        (r'^(line|ライン)$', FilterSystem.LINE_NAME),
        (r'^(partno|品番|(part|品番)0\d*)$', FilterSystem.PART_NO),
        (r'^(part|品番)$', FilterSystem.PART_NAME),
        (r'^(eqno|equip_no|equipno|設備no)$', FilterSystem.EQ_NO),
        (r'^(eqname|equip|設備)$', FilterSystem.EQ_NAME),
        (r'^(stno|ステーションno)$', FilterSystem.ST_NO),
        (r'^(judge|判定)$', FilterSystem.JUDGE),
    ]

    __GUESS_COLUMN_MAPPING_RULES: ClassVar[list[tuple[str, GuessColumn]]] = [
        (r'^(?:wf|wafer)_?y$', GuessColumn.WAFER_Y),
        (r'^(?:wf|wafer)_?x$', GuessColumn.WAFER_X),
        (r'^(?:wf|wafer)(?:no)?$', GuessColumn.WAFER_NO),
        (r'^slot(?:no)?$', GuessColumn.SLOT),
        (r'^rad(?:ius)?$', GuessColumn.WAFER_R),
        (r'^chip_?x$', GuessColumn.CHIP_X),
        (r'^chip_?y$', GuessColumn.CHIP_Y),
    ]

    @classmethod
    def __normalize(cls, col_name: str) -> str:
        """Helper method to clean and normalize the input string.

        (Internal use only)
        """
        if not col_name:
            return ''
        return str(col_name).strip().lower()

    @classmethod
    def __match_pattern(cls, cleaned_name: str, dtype: DataType | None = None) -> SystemColMetadata | None:
        """Iterates through rules to find a match.

        (Internal use only)
        """
        for pattern, new_name_obj in cls.__MAPPING_RULES:
            if re.match(pattern, cleaned_name):
                if dtype and dtype not in new_name_obj.value.accept_dtypes:
                    continue
                return new_name_obj.value
        return None

    @classmethod
    def get_filter_system_from_col(cls, column_name, dtype: DataType | None = None) -> SystemColMetadata | None:
        """Detect and get filter system metadata from a column name"""
        cleaned = cls.__normalize(column_name)
        return cls.__match_pattern(cleaned, dtype)

    @classmethod
    def get_guess_col(cls, column_name, dtype: DataType | None = None) -> SystemColMetadata | None:
        """Detect and get filter system metadata from a column name"""
        cleaned = cls.__normalize(column_name)
        for pattern, new_name_obj in cls.__GUESS_COLUMN_MAPPING_RULES:
            if re.match(pattern, cleaned):
                if dtype and dtype not in new_name_obj.value.accept_dtypes:
                    continue
                return new_name_obj.value
        return None
