import re
import unicodedata

import pandas as pd
from pandas import DataFrame, Series

from ap.common.logger import log_execution_time
from ap.common.services.data_type import convert_df_str_to_others

NORMALIZE_FORM_NFKC = 'NFKC'
NORMALIZE_FORM_NFKD = 'NFKD'
HAN_SPACE = ' '
REPLACE_PAIRS = (('°C', '℃'), ('°F', '℉'))
DIC_IGNORE_NORMALIZATION = {
    'cfg_data_source_csv': ['directory', 'etl_func'],
    'cfg_data_source_db': ['host', 'dbname', 'schema', 'username', 'password'],
    'cfg_process_column': ['column_raw_name'],
}


def convert_irregular(char):
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
        return chr(char_code - shift_number + 10)
    if char_code in irregular_number_3:
        return chr(char_code - shift_number + 20)
    if char_code in irregular_number_4:
        return '10'
    if char_code in irregular_number_5:
        return 'T'
    return char


def unicode_normalize(text, convert_irregular_chars=True, normalize_form=NORMALIZE_FORM_NFKC):
    # normalize (also replace Full Space to Half Space)
    text = unicodedata.normalize(normalize_form, text)
    # replace multi-spaces
    text = re.sub(r'\s+', HAN_SPACE, text)
    # trim space
    text = text.strip()
    # replace ℃
    for replace_from, replace_to in REPLACE_PAIRS:
        text = text.replace(replace_from, replace_to)

    if convert_irregular_chars:
        text = [convert_irregular(char) for char in text]
        text = ''.join(text)

    return text


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
def normalize_big_rows(rows, headers=None, strip_quote=True, return_dataframe=True):
    df = pd.DataFrame(rows, columns=headers)
    df = df.convert_dtypes()

    for col in df.columns:
        series = convert_df_str_to_others(df[col])
        series_type = series.dtypes.name
        if series_type == 'object':
            df[col] = df[col].fillna('')
            df[col] = df[col].astype(str)
            implement_flag = True
        elif series_type == 'string':
            df[col] = df[col].fillna('')
            implement_flag = True
        else:
            # df[col] = series
            implement_flag = False

        if implement_flag:
            if strip_quote:
                df[col] = df[col].str.strip("'")

            # for preview, show empty if there is NA
            df[col] = normalize_df(df, col)

    if return_dataframe:
        return df

    return df.to_records(index=False).tolist()


def is_ignore_column(table_name, column_name):
    if column_name in DIC_IGNORE_NORMALIZATION.get(table_name, []):
        return True

    return False


def model_normalize(target):
    table_name = target.__class__.__table__.name
    cols = target.__class__.__table__.columns.keys()
    for col in cols:
        if is_ignore_column(table_name, col):
            continue

        val = getattr(target, col)
        new_val = normalize_str(val, convert_irregular_chars=False)
        setattr(target, col, new_val)
