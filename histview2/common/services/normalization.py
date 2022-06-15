import re
import unicodedata

import pandas as pd
from pandas import DataFrame

from histview2.common.logger import log_execution_time

NORMALIZE_FORM = 'NFKC'
ZEN_SPACE = '　'
HAN_SPACE = ' '
REPLACE_PAIRS = (('°C', '℃'), ('°F', '℉'))
DIC_IGNORE_NORMALIZATION = {'cfg_data_source_csv': ['directory', 'etl_func'],
                            'cfg_data_source_db': ['host', 'dbname', 'schema', 'username', 'password']
                            }


def unicode_normalize_nfkc(text):
    # normalize (also replace Full Space to Half Space)
    text = unicodedata.normalize(NORMALIZE_FORM, text)
    # replace multi-spaces
    text = re.sub(r'\s+', HAN_SPACE, text)
    # trim space
    text = text.strip()
    # replace ℃
    for replace_from, replace_to in REPLACE_PAIRS:
        text = text.replace(replace_from, replace_to)

    return text


@log_execution_time()
def normalize_str(val):
    return unicode_normalize_nfkc(val) if isinstance(val, str) else val


@log_execution_time()
def normalize_list(vals):
    return [normalize_str(val) for val in vals]


@log_execution_time()
def normalize_df(df: DataFrame, col):
    if df[col].dtype.name.lower() != 'string':
        df[col] = df[col].astype(str)

    df[col] = df[col].str.normalize(NORMALIZE_FORM)
    df[col] = df[col].str.replace(r'\s+', HAN_SPACE, regex=True)
    df[col] = df[col].str.strip()

    for replace_from, replace_to in REPLACE_PAIRS:
        df[col] = df[col].str.replace(replace_from, replace_to)


@log_execution_time()
def normalize_big_rows(rows, headers=None, strip_quote=True, return_dataframe=True):
    df = pd.DataFrame(rows, columns=headers)
    for col in df.columns:
        if strip_quote:
            df[col] = df[col].str.strip("'")

        normalize_df(df, col)

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
        new_val = normalize_str(val)
        setattr(target, col, new_val)
