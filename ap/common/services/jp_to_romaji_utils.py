import collections
import re

import cutlet

from ap.common.constants import EMPTY_STRING, UNDER_SCORE
from ap.common.services.normalization import GREEK_U_RE, normalize_preprocessing, normalize_str

conv = cutlet.Cutlet()

# remove space and other elements after converting to romaji
# cutlet puts space before and after a 'word', so this must be done one more time after romaji conversion
# some words might return ?? due to cutlet's inability to convert some kanjis
SYMBOLS_RE = re.compile(r'[\+\*…・:;!\?\$\&\"\'\`\=\@\#\\\/。、\.,~]')

VERTICAL_BAR_RE = re.compile(r'[\|]')

WHITESPACE_RE = re.compile(r'[\s\t]')

# `[\(\)\[\]<>\{\}【】]` in string in `English Name` should be replaced into `_`.
BRACKETS_RE = re.compile(r'[\(\)\[\]<>\{\}【】]')

# hyphen: remove multi
HYPHEN_MULTI_RE = re.compile(r'-+')
UNDERSCORE_MULTI_RE = re.compile(r'_+')

# under score: remove first , last, multi
START_HYPHEN_UNDERSCORE_RE = re.compile(r'^[_-]')
END_HYPHEN_UNDERSCORE_RE = re.compile(r'[_-]$')

# `[℃°]` in `English Name` should be replaced in to `deg`.
DEG_RE = re.compile(r'[℃°]')

# `℉` in `English Name` should be replaced in to `degF`.
DEGF_RE = re.compile(r'℉')
PERCENT_RE = re.compile(r'%')

# `[Δ, △]` in English Name should be replaced into `d`.
DELTA_RE = re.compile(r'[Δ△]')

# `Ω` in English Name should be replaced into `ohm`.
OHM_RE = re.compile(r'Ω')

# replace for μµ
UU_RE = re.compile(r'Uu|uu')

# `Mm` in English Name should be replaced into `mm`.
MM_RE = re.compile(r'Mm')


def normalized_column_name(input_str, convert_irregular_chars=True):
    normalized_input = input_str

    normalized_input = normalize_preprocessing(normalized_input)
    # normalize (also replace Full Space to Half Space)
    # normalized_input = jaconv.normalize(normalized_input)
    normalized_input = normalize_str(normalized_input, convert_irregular_chars)

    normalized_input = replace_special_symbols(normalized_input)

    # convert to romaji
    # normalized_input = p.do(normalized_input)
    normalized_input = conv.romaji(normalized_input, title=False) if conv else normalized_input
    normalized_input = WHITESPACE_RE.sub(EMPTY_STRING, normalized_input)
    normalized_input = SYMBOLS_RE.sub(EMPTY_STRING, normalized_input)
    return normalized_input


def to_romaji(input_str, convert_irregular_chars=True):
    normalized_input = input_str

    normalized_input = normalized_column_name(normalized_input, convert_irregular_chars)
    normalized_input = VERTICAL_BAR_RE.sub(EMPTY_STRING, normalized_input)

    return normalized_input


def to_romaji_en(input_str) -> str:
    return normalized_column_name(input_str, True)


def replace_special_symbols(input_str):
    normalized_input = input_str

    normalized_input = GREEK_U_RE.sub('u', normalized_input)
    normalized_input = BRACKETS_RE.sub(UNDER_SCORE, normalized_input)

    # hyphen: remove multi
    normalized_input = HYPHEN_MULTI_RE.sub('-', normalized_input)
    normalized_input = UNDERSCORE_MULTI_RE.sub(UNDER_SCORE, normalized_input)

    # under score: remove first , last, multi
    normalized_input = START_HYPHEN_UNDERSCORE_RE.sub(EMPTY_STRING, normalized_input)
    normalized_input = END_HYPHEN_UNDERSCORE_RE.sub(EMPTY_STRING, normalized_input)

    normalized_input = DEG_RE.sub('deg', normalized_input)
    normalized_input = DEGF_RE.sub('degF', normalized_input)
    normalized_input = PERCENT_RE.sub('pct', normalized_input)
    normalized_input = DELTA_RE.sub('d', normalized_input)
    normalized_input = OHM_RE.sub('ohm', normalized_input)
    normalized_input = UU_RE.sub('u', normalized_input)
    normalized_input = MM_RE.sub('mm', normalized_input)

    return normalized_input


# def remove_irregular(input_str):
#     """
#     Use this function to remove irregular string
#     Applied for half-width katakana, number in symbol, and other irregular string
#     Eg: ｶ､①、〒
#     :param input_str: input string
#     :return: string without irregular symbol
#     """
#
#     regular_rule = r'[^\uFF01-\uFF5E\u3041-\u3096\u30A0-\u30FF\u3400-\u4DB5\u4E00-\u9FCB\uF900-\uFA6A0-9a-zA-Z _+-:.]'
#     irregular_str = ('⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
#                      '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
#                      '❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿',
#                      '⓫', '⓬', '⓭', '⓮', '⓯', '⓰', '⓱', '⓲', '⓳', '⓴',
#                      '➀', '➁', '➂', '➃', '➄', '➅', '➆', '➇', '➈', '➉',
#                      '➊', '➋', '➌', '➍', '➎', '➏', '➐', '➑', '➒', '➓',
#                      '⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾')
#     regular_str = ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
#                    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
#                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
#                    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
#                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
#                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
#                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10')
#
#     def convert_irregular(element):
#         if (element in irregular_str):
#             return regular_str[irregular_str.index(element)]
#         return element
#
#     try:
#         # input_str = "GD-I4 調整検査7号あア①〒㋐ｱ"
#         # normalize japanese string
#         input_str = jaconv.h2z(input_str)
#         input_str = jaconv.normalize(input_str)
#         # convert special characters
#         output_str = "".join([convert_irregular(i) for i in input_str])
#         output_str = re.sub(regular_rule, UNDER_SCORE, output_str)
#         # output_str = 'GD-I4 調整検査7号あア1_アア'
#         return output_str
#     except Exception:
#         return input_str


def change_duplicated_columns(columns):
    col_name = [col['romaji'] for col in columns]
    duplicated_items = [item for item, count in collections.Counter(col_name).items() if count > 1]

    idx = 1
    duplicated = False
    if duplicated_items:
        duplicated = True
        for col in columns:
            if col['romaji'] in duplicated_items:
                col['romaji'] += UNDER_SCORE + str(idx)
                idx += 1
    return columns, duplicated
