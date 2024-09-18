import re
from typing import Union

import pandas as pd
from pandas._libs.missing import NAType

from ap.common.constants import EMPTY_STRING, HALF_WIDTH_SPACE

REMOVE_CHARACTERS_PATTERN = r'\\+[nrt]'


class RegexRule:
    regex_dict = None

    @classmethod
    def extract_data(cls, *args, **kwargs) -> Union[tuple, str, None, NAType]:
        raise NotImplementedError('Method not implemented!')

    # @classmethod
    # def pattern_regexes(cls, data: str, **extend_args) -> Union[tuple, str, None, NAType]:
    #     for pattern_no, regex in cls.regex_dict.items():
    #         result = cls.extract_data(data, regex, pattern_no, **extend_args)
    #         if result is None:
    #             continue
    #         return result
    #     return None

    @classmethod
    def is_not_data(cls, data: str) -> bool:
        return pd.isnull(data) or data is None


class ColumnRawNameRule(RegexRule):
    # V2					                                eFA
    # 計測項目ID	          計測項目名				            DATA_ID	 DATA_NAME
    # LNSCXX4302_M00022	  △q/△SP荷重 [mm3/str/N]				DIC14028	 7孔Z軸補正量指令値
    # LNSCXX4302_M00042	  △q/△SP荷重 [mm3/str/N]				DIC14128	 7孔Z軸補正量指令値

    # In abnormal case
    # No    計測項目名	                              data name                     unit
    # ①    AJP圧入荷重[N](最終荷重)                ->   AJP圧入荷重 最終荷重              N
    # ②    SPバネ定数[N]]                         ->  SPバネ定数                        N
    #      切込み終了時荷重（ﾛｰﾗ①実測）[N            ->  切込み終了時荷重（ﾛｰﾗ①実測）         N
    # ③    ﾀｰﾐﾅﾙ位置寸法 Ｌ側 [m m ]               ->  ﾀｰﾐﾅﾙ位置寸法 Ｌ側                  m m
    # ④    調整荷重（調整終了点）（ﾛｰﾗ②実測）[N]     ->  調整荷重（調整終了点）（ﾛｰﾗ②実測）      N
    # ④    AJP圧入荷重[N][mm](最終荷重)             ->  AJP圧入荷重 最終荷重           N

    regex_dict = {
        'pattern_1': r'^([^\[\]]*)[\[\s]*([^\[\]]*)[\]\s]*([^\[\]]*)$',
        'pattern_2': r'^([^\[\]]+)[\[\s]*([^\[\]]*)[\]\s]*[\[\s]*([^\[\]]*)[\]\s]*([^\[\]]*)$',
    }

    @classmethod
    def extract_data(cls, data: str):
        column_name = data
        unit = EMPTY_STRING
        suffix_data_name = EMPTY_STRING
        if cls.is_not_data(data):
            return data, unit

        data = re.sub(r'\\+[nrt]|\(?±\)?', EMPTY_STRING, data)
        is_match = False
        for pattern_no, regex in cls.regex_dict.items():
            match = re.search(regex, data)
            if not match or is_match:
                continue
            is_match = True
            if pattern_no == 'pattern_1':
                column_name, unit, suffix_data_name = match.groups()
            else:
                column_name, unit, _, suffix_data_name = match.groups()

        if not is_match:
            return data, unit

        column_name = column_name.strip()
        if len(suffix_data_name) != 0:
            column_name += f'{HALF_WIDTH_SPACE}{suffix_data_name}'

        # 4. Replace any bracket.
        # 4-1. Replace "\s?[(\[]\s?" to "("
        column_name = re.sub(r'\s?[(\[【「『〖〚〘｟〔]\s?', '(', column_name)
        # 4-2. Replace "\s?[)\]" to ")"
        column_name = re.sub(r'\s?[)\]】」』〗〛〙｠〕]\s?', ')', column_name)

        # handle case 'μm' and 'µm'
        unit = unit.replace('μ', 'µ').replace('KPa', 'kPa').replace('cm^3/min', 'cm3/min').strip()

        # 4-3. Remove "()"
        column_name = re.sub(r'[()]', HALF_WIDTH_SPACE, column_name)
        column_name = re.sub(r'\s+', HALF_WIDTH_SPACE, column_name)

        # 5. Replace `No.`=> `No` by removing `.`
        column_name = column_name.replace('No.', 'No')
        column_name = column_name.replace(';', ':')  # Cover case 管理マスタ値1;指示値 & 管理マスタ値1:指示値

        # Remove 計測値:|measurement.
        measurement_removes = ['計測値:', '加工値:', '加工条件:', '加工条件値:', 'その他:', 'measurement.']
        column_name = re.sub('|'.join(map(re.escape, measurement_removes)), EMPTY_STRING, column_name)

        # 6. Strip
        column_name = column_name.strip()

        return column_name, unit
