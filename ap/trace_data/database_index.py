import hashlib
from abc import ABC
from dataclasses import dataclass
from typing import List, Set, Union

from ap.common.common_utils import gen_sql_cast_text_no_as
from ap.common.constants import RawDataTypeDB


def strip_off_parenthesis(s: str) -> str:
    s = s.strip()
    while s.startswith('(') and s.endswith(')'):
        s = s[1:-1].strip()
    return s


class DBIndex(ABC):
    @classmethod
    def from_str(cls, s: str) -> 'DBIndex':
        raise NotImplementedError

    def __str__(self) -> str:
        raise NotImplementedError


class SingleIndex(DBIndex):
    def __init__(self, col: str):
        self.col = col.strip()

    @classmethod
    def from_str(cls, s: str) -> 'SingleIndex':
        s = strip_off_parenthesis(s)
        return cls(s)

    def __str__(self) -> str:
        return self.col

    def __eq__(self, other: 'SingleIndex') -> bool:
        return str(self) == str(other)


class CastTextIndex(DBIndex):
    def __init__(self, col: str):
        self.col = col.strip()

    @classmethod
    def from_str(cls, s: str) -> Union[SingleIndex, 'CastTextIndex']:
        """
        Convert from string
        E.g:
            column_name or (column_name) -> SingleIndex
            CAST(column_name as text) or (CAST(column_name as text)) -> CastTextIndex
        """
        s = strip_off_parenthesis(s)
        if s.startswith('CAST('):
            s = strip_off_parenthesis(s.lstrip('CAST'))
            if s.endswith('AS TEXT'):
                s = strip_off_parenthesis(s.split('AS TEXT')[0])
                return cls(s)
        return SingleIndex.from_str(s)

    def __str__(self) -> str:
        return gen_sql_cast_text_no_as(self.col.strip())


class SubstrIndex(DBIndex):
    def __init__(self, index: Union[SingleIndex, CastTextIndex], substr_from: int, substr_to: int):
        self.inner = index
        self.substr_from = substr_from
        self.substr_to = substr_to

    @classmethod
    def from_str(cls, s: str) -> Union['SingleIndex', 'CastTextIndex', 'SubstrIndex']:
        """
        Convert from string
        E.g:
            SUBSTR(column_name, 1, 2), etc -> SubstrIndex
            SUBSTR(CAST(column_name as text), 1, 2) -> SubstrIndex
        """
        s = strip_off_parenthesis(s)
        if not s.startswith('SUBSTR'):
            return CastTextIndex.from_str(s)
        s = s.strip('SUBSTR')

        assert s.startswith('(') and s.endswith(')')
        s = strip_off_parenthesis(s)

        full_col_name, substr_from, distance = s.split(',')
        index = CastTextIndex.from_str(full_col_name)

        return cls(
            index,
            int(substr_from),
            int(substr_from) + int(distance) - 1,
        )

    def __str__(self) -> str:
        distance = self.substr_to - self.substr_from + 1
        return f'SUBSTR({self.inner}, {self.substr_from}, {distance})'


class MultipleIndexes(DBIndex):
    def __init__(self, indexes: List[Union[SingleIndex, CastTextIndex, SubstrIndex]]):
        if len(indexes) == 0:
            raise ValueError('indexes must not empty')
        self.indexes = indexes

    def __len__(self) -> int:
        return len(self.indexes)

    def __getitem__(self, item: int) -> Union[SingleIndex, CastTextIndex, SubstrIndex]:
        return self.indexes[item]

    @classmethod
    def from_str(cls, s: str) -> 'MultipleIndexes':
        """
        convert from str
        E.g:
            (col1, col2)
            (col1, CAST(col2 as text))
            (col1, SUBSTR(col2, 1, 5))
            (col1, SUBSTR(CAST(col2 as text), 1, 5)
            (col1, col2, CAST(col3 as text), SUBSTR(col4, 1, 5), SUBSTR(CAST(col5 as text), 2, 6))
        """
        all_indexes: List[Union[SingleIndex, CastTextIndex, SubstrIndex]] = []

        # remove redundant start string
        s = s[s.find('(') :]

        s = strip_off_parenthesis(s)
        tokens = s.split(',')
        tokens = [token.strip() for token in tokens]

        i = 0
        while i < len(tokens):
            token = strip_off_parenthesis(tokens[i])
            if token.strip(' (').startswith('SUBSTR'):
                string_token = ','.join(tokens[i : i + 3])
                i += 3
            else:
                string_token = tokens[i]
                i += 1
            string_token = strip_off_parenthesis(string_token)
            index = SubstrIndex.from_str(string_token)
            all_indexes.append(index)

        return cls(all_indexes)

    def __str__(self) -> str:
        index_str = ','.join((str(index) for index in self.indexes))
        return f'({index_str})'

    def sort_from(self, start_index: int):
        self.indexes[start_index:] = sorted(self.indexes[start_index:], key=lambda index: str(index))

    def to_idx(self, prefix: str = '', suffix: str = '') -> str:
        s = f'{prefix}_{self}_{suffix}'.encode('utf-8')
        hashed = hashlib.sha1(s).hexdigest()
        return f'idx_{hashed}'

    def __hash__(self) -> int:
        return hash(str(self))

    @property
    def __to_set_str(self) -> Set[str]:
        return {str(col) for col in self.indexes}

    def __eq__(self, other: 'MultipleIndexes') -> bool:
        return self.__to_set_str == other.__to_set_str

    def __ge__(self, other: 'MultipleIndexes') -> bool:
        return self.__to_set_str >= other.__to_set_str

    def __gt__(self, other: 'MultipleIndexes') -> bool:
        return self.__to_set_str > other.__to_set_str

    def __le__(self, other: 'MultipleIndexes') -> bool:
        return self.__to_set_str <= other.__to_set_str

    def __lt__(self, other: 'MultipleIndexes') -> bool:
        return self.__to_set_str < other.__to_set_str


@dataclass
class ColumnInfo:
    bridge_column_name: str
    column_type: int
    data_type: str
    substr_from: int
    substr_to: int

    def is_good_key(self) -> bool:
        if not self.substr_from and not self.substr_to:
            return False
        if self.substr_from >= self.substr_to:
            return False
        return True

    def is_bad_key(self) -> bool:
        return not self.is_good_key()

    def is_substr_key(self):
        return self.is_good_key()

    def is_text(self):
        return RawDataTypeDB.is_text_data_type(self.data_type)

    def to_substr_index(self) -> SubstrIndex:
        inner = self.to_cast_text_index() if not self.is_text() else self.to_single_index()
        return SubstrIndex(inner, self.substr_from, self.substr_to)

    def to_cast_text_index(self) -> CastTextIndex:
        return CastTextIndex(self.bridge_column_name)

    def to_single_index(self) -> SingleIndex:
        return SingleIndex(self.bridge_column_name)


def add_multiple_indexes_to_set(
    set_multiple_indexes: Set[MultipleIndexes],
    multiple_indexes: MultipleIndexes,
) -> None:
    """Add multiple indexes to the set if it's not subset of any others"""
    if not any(multiple_indexes <= other for other in set_multiple_indexes):
        set_multiple_indexes.add(multiple_indexes)
