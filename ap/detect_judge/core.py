from dataclasses import dataclass
from typing import Union

import pandas as pd

JUDGE_AVAILABLE = 'judge_available'
JUDGE_FORMULA = 'judge_formula'
JUDGE_POSITIVE_VALUE = 'judge_positive_value'
JUDGE_POSITIVE_DISPLAY = 'judge_positive_display'
JUDGE_NEGATIVE_DISPLAY = 'judge_negative_display'


@dataclass(frozen=True)
class JudgeFormula:
    positive: str
    positive_display: str
    negative_display: str

    @classmethod
    def from_formula(cls, formula: str):
        value, display_value = formula.split('=', maxsplit=1)
        pos = value[value.find('~') + 1 : value.find('|')]
        pos_display = display_value.split('|', 1)[0]
        neg_display = display_value.split('|', 1)[-1]
        return cls(positive=pos, positive_display=pos_display, negative_display=neg_display)

    def get_formula(self) -> str:
        formula = f'Pos~{self.positive}|Neg={self.positive_display}|{self.negative_display}'
        return formula


JUDGE_FORMULAS: list[JudgeFormula] = [
    JudgeFormula(positive='OK', positive_display='OK', negative_display='NG'),
    JudgeFormula(positive='Positive', positive_display='Positive', negative_display='Negative'),
    JudgeFormula(positive='Pos', positive_display='Pos', negative_display='Neg'),
    JudgeFormula(positive='P', positive_display='P', negative_display='N'),
    JudgeFormula(positive='Good', positive_display='Good', negative_display='Bad'),
    JudgeFormula(positive='Yes', positive_display='Yes', negative_display='No'),
    JudgeFormula(positive='Pass', positive_display='Pass', negative_display='Failed'),
    JudgeFormula(positive='P', positive_display='P', negative_display='F'),
    JudgeFormula(positive='True', positive_display='True', negative_display='False'),
    JudgeFormula(positive='T', positive_display='T', negative_display='F'),
    JudgeFormula(positive='可', positive_display='可', negative_display='否'),
    JudgeFormula(positive='良', positive_display='良', negative_display='不良'),
    JudgeFormula(positive='はい', positive_display='はい', negative_display='いいえ'),
    JudgeFormula(positive='正', positive_display='正', negative_display='誤'),
    JudgeFormula(positive='有', positive_display='有', negative_display='無'),
    JudgeFormula(positive='あり', positive_display='あり', negative_display='なし'),
    JudgeFormula(positive='On', positive_display='On', negative_display='Off'),
]


def get_judge_formula(series: pd.Series) -> Union[JudgeFormula, None]:
    series = series.dropna()
    try:
        if series.nunique() <= 2:
            for i, judge_formula in enumerate(JUDGE_FORMULAS):
                if judge_formula.positive in [str(val) for val in series.unique()]:
                    return judge_formula

            # try to cast to int to detect judge
            int_series = series.astype(pd.Int8Dtype(), errors='ignore')
            if pd.api.types.is_numeric_dtype(int_series) and 0 <= int_series.max() <= 2:
                return JudgeFormula(positive=str(int_series.max()), positive_display='OK', negative_display='NG')
            return None
        else:
            return None
    except Exception:
        # when series cannot be safely cast to Int
        return None
