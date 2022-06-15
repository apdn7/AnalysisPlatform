import collections
import re
from functools import lru_cache

import cutlet

from histview2.common.services.normalization import normalize_str

conv = cutlet.Cutlet()


@lru_cache(maxsize=1000)
def to_romaji(input_str):
    normalized_input = input_str
    # normalize (also replace Full Space to Half Space)
    # normalized_input = jaconv.normalize(normalized_input)
    normalized_input = normalize_str(normalized_input)

    # `[μµ]` in `English Name` should be replaced in to `u`.
    # convert u before kakasi applied to keep u instead of M
    normalized_input = re.sub(r'[μµ]', 'uu', normalized_input)

    # convert to romaji
    # normalized_input = p.do(normalized_input)
    normalized_input = conv.romaji(normalized_input, title=True)

    # snake to camel
    # normalized_input = normalized_input.title()

    # remove space and tab
    normalized_input = re.sub(r'[\s\t\+\*…・:;!\?\$\&\"\'\`\=\@\#\\\/。、\.,~\|]', '', normalized_input)

    # `[\(\)\[\]<>\{\}【】]` in string in `English Name` should be replaced into `_`.
    normalized_input = re.sub(r'[\(\)\[\]<>\{\}【】]', '_', normalized_input)

    # hyphen: remove last, multi
    normalized_input = re.sub(r'-+', '-', normalized_input)
    normalized_input = re.sub(r'_+', '_', normalized_input)

    # under score: remove first , last, multi
    normalized_input = re.sub(r'^[_-]', '', normalized_input)
    normalized_input = re.sub(r'[_-]$', '', normalized_input)

    # `[℃°]` in `English Name` should be replaced in to `deg`.
    normalized_input = re.sub(r'[℃°]', 'deg', normalized_input)

    # `℉` in `English Name` should be replaced in to `degF`.
    normalized_input = re.sub(r'℉', 'degF', normalized_input)
    normalized_input = re.sub(r'%', 'pct', normalized_input)

    # `[Δ, △]` in English Name should be replaced into `d`.
    normalized_input = re.sub(r'[Δ△]', 'd', normalized_input)

    # `Ω` in English Name should be replaced into `ohm`.
    normalized_input = re.sub(r'Ω', 'ohm', normalized_input)

    # convert postal mark in string to `_`
    normalized_input = re.sub(r'[\u3012\u3020\u3036]', 'post', normalized_input)

    # # replace for μµ
    normalized_input = re.sub(r'Uu|uu', 'u', normalized_input)

    # `Mm` in English Name should be replaced into `mm`.
    normalized_input = re.sub(r'Mm', 'mm', normalized_input)

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
#         output_str = re.sub(regular_rule, '_', output_str)
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
                col['romaji'] += "_" + str(idx)
                idx += 1
    return columns, duplicated
