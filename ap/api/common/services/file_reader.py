import dataclasses
from typing import Any, overload

import numpy as np
import pandas as pd
from loguru import logger
from pandas.errors import ParserError

from ap.api.efa.services.etl import csv_transform
from ap.api.setting_module.services.data_import import ALL_SYMBOLS
from ap.common.constants import WR_HEADER_NAMES, WR_TYPES, WR_VALUES, CsvDelimiter, Encoding
from ap.common.services import csv_header_wrapr as chw
from ap.common.services.csv_content import EncodingException, check_exception_case, get_delimiter_encoding
from ap.common.services.csv_header_wrapr import add_suffix_if_duplicated
from ap.common.services.normalization import normalize_list


@dataclasses.dataclass
class StructuredFileReader:
    """Base class for structured file reader

    Attributes:
        filenames: list of file names
        encoding: encoding used to read files
        delimiter: delimiter used to separate columns
        headers: list of column names
        data: list of rows of data
        is_valid: whether the file is valid
        is_transpose: whether the file is transposed
        do_normalize: whether to normalize the data
        skip_head: number of rows to skip at the beginning of the file
        skip_tail: number of rows to skip at the end of the file
        max_results: maximum number of results to return
        limit: maximum number of rows to read from the file
        error: error message if any
        preview: whether to preview the data
        is_mismatched_cols: whether the number of columns in the header and data are mismatched
        etl_func: ETL function to apply to the data
        is_file_checker: whether to use file checker to read the file
    """

    filenames: list[str] = dataclasses.field(default_factory=list)
    encoding: str | None = None  # file encoding
    delimiter: str | None = None  # file delimiter
    # Be careful assigning headers — mutable types can cause side effects
    headers: list[str] = dataclasses.field(default_factory=list)  # columns name
    data: list[list[Any]] = dataclasses.field(default_factory=list)  # flatten data
    is_valid: bool = True
    is_transpose: bool = False
    do_normalize: bool = False
    skip_head: int | None = None
    skip_tail: int | None = 0
    # the number of records that will be returned from StructuredFileReader
    max_results: int | None = None
    # the number of records that will be read from a file
    limit: int | None = None
    error: str | None = None
    preview: bool = True
    is_mismatched_cols: bool = False
    etl_func: str | None = None
    is_file_checker: bool = False

    @overload
    def update(
        self,
        *,
        filenames: list[str] = ...,
        headers: list[str] = ...,
        skip_head: int | None = ...,
        max_results: int = ...,
        limit: int = ...,
        error: str = ...,
        is_mismatched_cols: bool = ...,
        is_file_checker: bool = ...,
        skip_tail: int = ...,
        preview: bool = ...,  # to preview/import file_checker data
    ) -> None: ...

    @overload
    def update(self, **kwargs: Any) -> None: ...

    def update(self, **kwargs):
        """Update config of File Reader"""
        for key, value in kwargs.items():
            if not hasattr(self, key):
                raise AttributeError(f'Invalid field: {key}')
            setattr(self, key, value)

    def validate(self):
        """
        Validate a file is normal csv or obfuscated csv.
        obfuscated:
            - header and column length is mismatched
            - trailing comma in file
        if it is obfuscated cases, read data with file-checker
        """
        # Do nothing if the item is already invalid.
        if self.is_valid:
            all_rows_have_trailing_comma = check_exception_case(self.headers, self.data)
            # check column number of header vs data
            same_number_of_rows_and_headers = all(len(row) == len(self.headers) for row in self.data)
            self.is_valid = all_rows_have_trailing_comma or same_number_of_rows_and_headers

    def get_etl_good_file(self):
        """
        Verify that the ETL file is readable with file_checker.
        If the file passes validation, return its metadata.
        """
        csv_file = None
        dic_file_info = None
        is_file_checker = False
        try:
            for file_path in self.filenames:
                check_result = chw.get_file_info_py(file_path)
                if isinstance(check_result, Exception):
                    continue

                dic_file_info, is_empty_file = check_result

                if dic_file_info is None or isinstance(dic_file_info, Exception):
                    continue

                if is_empty_file:
                    continue

                if dic_file_info:
                    is_file_checker = True

                csv_file = file_path
                break
        except IndexError as e:
            logger.exception(e)
            raise e
        return dic_file_info, csv_file, is_file_checker

    def detect_file_delimiter_and_encoding(self, target_file):
        """
        Detect encoding and delimiter for target_file

        If encoding or delimiter is set to auto-detect, attempt to guess the file encoding.
        otherwise, force reading the file using the specified encoding.
        """
        detected_encoding = None
        detected_delimiter = None
        # auto-detect selection
        encoding = None if self.encoding == Encoding.AUTO_DETECT.code else self.encoding
        delimiter = None if self.delimiter == CsvDelimiter.Auto.name else self.delimiter
        if not encoding or not delimiter:
            detected_delimiter, detected_encoding = get_delimiter_encoding(target_file, preview=True)

        self.encoding = encoding or detected_encoding
        self.delimiter = delimiter or detected_delimiter

    def get_params(self):
        """Prepare parameters that will be passed to pandas functions"""
        # pandas params
        return {
            'sep': self.delimiter,
            'encoding': self.encoding,
            'header': None,  # read file without header
            'skiprows': self.skip_head,
            # read file as string to keep original values
            # for example: "0001" -> string instead of integer
            'dtype': pd.StringDtype(),
            'na_values': ALL_SYMBOLS,  # todo: make preview and import same NA symbols
            # 'on_bad_lines': 'skip',
            'skip_blank_lines': True,
        }

    def read_single_file(self, filename, is_transpose=False):
        try:
            params = self.get_params()
            if self.limit is not None:
                params.update({'nrows': self.limit})

            df = pd.read_csv(filename, **params)

            # transpose df
            if is_transpose:
                df = df.T

            # Manually get the header from the file
            # It's the first row in the DataFrame
            # Convert NA to empty
            columns_with_na_as_empty = df.iloc[0].fillna('')
            # Mask empty columns as `col`, then add suffix to avoid duplication before concatenating DataFrames
            # dummy_name_filled_columns = add_suffix_for_same_column_name(
            #     {cid: (col or 'col') for cid, col in enumerate(columns_with_na_as_empty)}
            # )
            no_duplicated_cols, *_ = add_suffix_if_duplicated(list(columns_with_na_as_empty))
            # Remove the original header row (first row) from the DataFrame.
            df = df.iloc[1:]

            # to merge data by columns
            # df.columns = columns
            df.columns = no_duplicated_cols
            # Restore original column names (including empty) after concatenating the dfs
            sanitized_columns = dict(zip(no_duplicated_cols, columns_with_na_as_empty, strict=False))

            return df, sanitized_columns
        except ParserError as e:
            logger.exception(e)
            raise e

    def read_data_from_files(self, filenames=None):
        """Read data from files"""
        column_names = []
        data_detail = []
        sanitized_column_map = {}

        try:
            for file in filenames:
                # read data from one file
                df, sanitized_columns = self.read_single_file(file, is_transpose=self.is_transpose)
                sanitized_column_map = {**sanitized_column_map, **sanitized_columns}
                columns_update = not column_names or len(column_names) < len(df.columns)
                if columns_update:
                    column_names = df.columns

                data_detail.append(df)

            combined_df = pd.DataFrame()
            if data_detail:
                # todo: merge df by column name, not by index
                # Combine multiple DataFrames if they have the same structure.
                combined_df = pd.concat([*data_detail], ignore_index=True)
                # Rename to columns before normalized
                combined_df = combined_df.rename(columns=sanitized_column_map)
                column_names = combined_df.columns.tolist()

            # If reading data with headers in forced mode (normalized column names),
            # use the provided headers.
            if self.headers:
                column_names = self.headers

            if self.skip_tail:
                # skip footer
                combined_df = combined_df.iloc[: -self.skip_tail]

            # fill NA to empty string
            combined_df = combined_df.replace({np.nan: None})
            if self.preview:
                # Display empty in preview table, instead of None
                combined_df = combined_df.fillna('')

            # Convert the entire DataFrame to a list of row-wise lists.
            data_list = combined_df.to_numpy().tolist()

            # Normalize column names (e.g., strip whitespace, lowercase, etc.).
            column_names = normalize_list(column_names) if self.do_normalize else column_names

            if self.max_results:
                data_list = data_list[: self.max_results]

            return column_names, data_list
        except (ParserError, Exception) as e:
            logger.exception(e)
            raise e

    def read_data_from_mismatched_headers(self, target_file):
        """
        Handle obfuscated cases (#22) by reading the data
        and ignoring columns caused by trailing commas.
        """
        try:
            # Try adjusting skip_head to fix column mismatch
            params = self.get_params()
            params = params | {'header': 'infer', 'index_col': False}
            df = pd.read_csv(target_file, **params)
            self.headers = df.columns.tolist()
            self.data = df.to_numpy().tolist()
            self.is_valid = True
            # revert skip_head
            self.update(is_mismatched_cols=True)
            return self.headers, self.data
        except Exception as e:
            logger.exception(e)
            raise e

    def read_data_with_file_checker(self):
        """If the file is obfuscated cases, read data with file-checker"""
        # try to get file which has data to detect data types + get col names
        try:
            dic_file_info, csv_file, is_file_checker = self.get_etl_good_file()
            if not dic_file_info or not csv_file:
                error = 'Cannot get headers_name and data_details for filechecker'
                logger.warning(error)
                # set error to read the file by another type
                self.set_error(error_status=True, message=error)
                return [], []
            self.skip_head = chw.get_skip_head(dic_file_info)
            self.skip_tail = chw.get_skip_tail(dic_file_info)
            self.headers = chw.get_columns_name(dic_file_info)
            etl_headers = chw.get_etl_headers(dic_file_info)
            data_types = chw.get_data_type(dic_file_info)
            self.headers, self.data = self.read_data_normal_file(csv_file)

            # Merge heads with Machine, Line, Process
            if etl_headers[WR_VALUES]:
                self.headers += etl_headers[WR_HEADER_NAMES]
                data_types += etl_headers[WR_TYPES]
                self.data = chw.merge_etl_heads(etl_headers[WR_VALUES], self.data)
            return self.headers, self.data
        except TypeError as e:
            logger.exception(e)
            self.set_error(error_status=True, message=str(e))
            return [], []
        except Exception as e:
            logger.exception(e)
            raise ValueError('Cannot get headers_name and data_details for filechecker') from e

    def read_data_with_etl(self, etl_func):
        """Read data with ETL script"""
        header, data = [], []
        # try to get file which has data to detect data types + get col names
        # todo: verify missing data because etl folder has many file?
        for file_path in self.filenames:
            preview_file_path = csv_transform(file_path, etl_func)
            if preview_file_path and not isinstance(preview_file_path, Exception):
                header, data = self.read_data_normal_file(preview_file_path)
                break
        return header, data

    def set_error(self, error_status=False, message=''):
        self.is_valid = not error_status
        self.error = message
        if error_status and message:
            logger.exception(message)

    def read_data_normal_file(self, target_file: str | None = None) -> tuple[Any, Any]:
        """Read target_file by pandas directly"""
        filenames = [target_file] if target_file else self.filenames

        # detect file delimiter and encoding
        if filenames:
            self.detect_file_delimiter_and_encoding(filenames[0])

        try:
            header_names, data_details = self.read_data_from_files(filenames)
            if data_details:
                # exception case: trailing comma
                all_rows_have_trailing_comma = check_exception_case(header_names, data_details)
                # remove end column because there is trailing comma
                if all_rows_have_trailing_comma:
                    data_details = [row[:-1] for row in data_details]

            self.headers = header_names
            self.data = data_details
            # reset error status
            self.set_error(error_status=False)
            self.validate()
            return self.headers, self.data
        except ParserError as e:
            self.set_error(error_status=True, message=str(e))
            # validate target file
            self.validate()
            return [], []
        except (EncodingException, UnicodeDecodeError, Exception) as e:
            self.set_error(error_status=True, message=str(e))
            raise e

    def read(self, target_file: str | None = None):
        if not target_file:
            target_file = self.filenames[0]

        if self.etl_func:
            # Case 1: Use custom ETL function
            header, data = self.read_data_with_etl(self.etl_func)
            if self.is_valid:
                return header, data

        if self.is_file_checker:
            # Case 2: Already flagged to use file_checker
            header, data = self.read_data_with_file_checker()
            if self.is_valid:
                return header, data

        # Case 3: Try normal read from first file
        header, data = self.read_data_normal_file(target_file=target_file)
        if self.is_valid:
            return header, data

        # Fallback 1: Retry with file_checker (ignore skip_head from GUI)
        self.update(skip_head=None)
        header, data = self.read_data_with_file_checker()
        if self.is_valid:
            # Flag this file for processing by file_checker on the next run.
            self.is_file_checker = True
            return header, data

        # Since skip_head and skip_tail are assigned when trying with file_checker above,
        # they need to be reset before attempting another method.
        self.update(skip_head=None, skip_tail=0)
        # Fallback 2: Retry by verifying whether the CSV file has a header count different from the number of columns.
        # In this case, the file is treated as a normal CSV, but it may be necessary to remove trailing commas
        # or handle mismatched columns.
        header, data = self.read_data_from_mismatched_headers(target_file=target_file)
        return header, data
