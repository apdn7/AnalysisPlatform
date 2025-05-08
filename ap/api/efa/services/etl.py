import importlib.util
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional, Union

import pandas as pd
from pydantic import BaseModel, ValidationError

from ap.common.common_utils import (
    detect_encoding,
    get_base_dir,
    get_etl_path,
    get_temp_path,
    get_user_scripts_path,
    get_wrapr_path,
    make_dir,
    open_with_zip,
)
from ap.common.constants import CfgConstantType, CsvDelimiter
from ap.common.logger import log_execution_time
from ap.common.services.api_exceptions import ErrorMessage, Errors
from ap.common.services.sse import MessageAnnouncer
from ap.script.r_scripts.wrapr import wrapr_utils
from ap.setting_module.models import CfgConstant

FILE = 'etl_spray_shape.R'

UNKNOWN_ERROR_MESSAGE = 'NO OUTPUT FROM R SCRIPT'
NO_DATA_ERROR = 'NoDataError'

logger = logging.getLogger(__name__)


class ETLException(Exception):
    def __init__(
        self,
        status_code: int = 500,
        error_msg: Union[Optional[ErrorMessage], list[ErrorMessage]] = None,
    ) -> None:
        self.errors = Errors()
        self.errors.add_error_message(error_msg=error_msg)
        self.status_code = status_code

    def __str__(self) -> str:
        [err, *_] = self.errors.errors
        return str(err.message)

    def get_message(self) -> str:
        return self.__str__()


class PyETLInterface(ABC):
    class ImportSchema(BaseModel):
        @classmethod
        def schema_definition(cls):
            return cls

    @abstractmethod
    def extract(self, fname: str) -> pd.DataFrame:
        pass

    @abstractmethod
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        pass

    def validate(self, df: pd.DataFrame) -> pd.DataFrame:
        schema = self.ImportSchema.schema_definition()
        if len(schema.model_fields) == 0:
            return df

        validated_data = []
        for _, row in df.iterrows():
            try:
                validated_row = schema(**row.to_dict())
                validated_data.append(validated_row.dict())
            except ValidationError as e:
                logger.debug(f'Validation error: {e}')
                raise e
        return pd.DataFrame(validated_data)


@log_execution_time()
def csv_transform(fname, etl_func, proc_id=None):
    """transform to standard csv"""
    if proc_id:
        csv_base_dir = get_base_dir(fname)
        out_dir = get_etl_path(str(proc_id), csv_base_dir)
        make_dir(out_dir)
    else:
        out_dir = get_temp_path()

    output_fname = None

    if etl_func.endswith('.py'):
        py_etl_path = os.path.join(get_user_scripts_path(), 'py', etl_func)
        if os.path.isfile(py_etl_path):
            module_name = etl_func[:-3]

            spec = importlib.util.spec_from_file_location(module_name, py_etl_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if isinstance(attr, type) and issubclass(attr, PyETLInterface) and attr is not PyETLInterface:
                    # instantiate ETL class
                    etl_instance = attr()

                    df = etl_instance.extract(fname)
                    validated_df = etl_instance.validate(df)
                    transformed_df = etl_instance.transform(validated_df)

                    output_fname = os.path.join(out_dir, f'transformed_{os.path.basename(etl_func)}')
                    transformed_df.to_csv(output_fname, index=False)
                    break

            if not output_fname:
                raise ValueError(f'No valid ETL class found in {etl_func}')

    if output_fname is None:
        output_fname = call_com_read(fname, out_dir)

    return output_fname


@log_execution_time()
def df_transform(df, etl_func):
    """transform factory df to standard df"""
    out_dir = get_temp_path()
    transformed_df = None
    if etl_func.endswith('.py'):
        py_etl_path = os.path.join(get_user_scripts_path(), 'py', etl_func)
        if os.path.isfile(py_etl_path):
            module_name = etl_func[:-3]

            spec = importlib.util.spec_from_file_location(module_name, py_etl_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if isinstance(attr, type) and issubclass(attr, PyETLInterface) and attr is not PyETLInterface:
                    # instantiate ETL class
                    etl_instance = attr()
                    try:
                        validated_df = etl_instance.validate(df)
                        transformed_df = etl_instance.transform(validated_df)
                    except (ValidationError, Exception) as e:
                        error_msg = ErrorMessage(
                            reason=e.__class__.__name__,
                            message=f'Could not transform data by {etl_func}. Detail: {str(e)}',
                        )
                        raise ETLException(error_msg=error_msg)
                    output_fname = os.path.join(out_dir, f'transformed_{os.path.basename(etl_func)}')
                    transformed_df.to_csv(output_fname, index=False)
                    break

            if transformed_df.empty:
                error_msg = ErrorMessage(
                    reason=ValueError.__name__,
                    message=f'No valid ETL class found in {etl_func}',
                )
                raise ETLException(error_msg=error_msg)

    # to do: support transform df by rscript
    # if transformed_df is None:
    #     output_fname = call_com_read(fname, out_dir)

    return transformed_df


@log_execution_time()
def call_com_read(fname, out_dir):
    """call com read func to transform data

    Args:
        fname ([type]): [description]
        out_dir ([type]): [description]

    Returns:
        [type]: [description]
    """
    target_func = 'com_read'

    # define parameters
    dic_data = {}  # filecheckr does not need input data
    dic_task = {'func': target_func, 'file': FILE, 'fpath': fname}

    # define and run pipeline
    try:
        pipe = wrapr_utils.RPipeline(get_wrapr_path(), out_dir, use_pkl=False, verbose=True)
        out = pipe.run(dic_data, [dic_task])
    except Exception as e:
        logger.error(e)
        return e

    if out:
        error = out.get('err', None)
        error_type = out.get('err_type', None)
        if error:
            if error_type == NO_DATA_ERROR:
                return None

            logger.error(error)
            return Exception(error)

        # save latest json string
        json_str = out['results']['pass']
        save_etl_json(FILE, json_str)

        # return
        return out['results']['fname_out']

    return Exception(UNKNOWN_ERROR_MESSAGE)


@log_execution_time()
@MessageAnnouncer.notify_progress(60)
def call_com_view(fname, out_dir):
    """call com view func to export image

    Args:
        fname ([type]): [description]
        out_dir ([type]): [description]

    Returns:
        [type]: [description]
    """
    target_func = 'com_view'

    # get json string
    json_str = load_etl_json(FILE)

    # define parameters
    dic_data = {}
    dic_task = {'func': target_func, 'file': FILE, 'fpath': fname, 'pass': json_str}

    # define and run pipeline
    try:
        pipe = wrapr_utils.RPipeline(get_wrapr_path(), out_dir, use_pkl=False, verbose=True)
        out = pipe.run(dic_data, [dic_task])
    except Exception as e:
        logger.exception(e)
        return e

    if out:
        error = out.get('err', None)
        if error:
            logger.error(error)
            return Exception(error)

        return out['results']['fname_out']

    return Exception(UNKNOWN_ERROR_MESSAGE)


@log_execution_time()
def save_etl_json(script_fname, json_str):
    CfgConstant.create_or_update_by_type(
        const_type=CfgConstantType.ETL_JSON.name,
        const_value=json_str,
        const_name=script_fname,
    )


@log_execution_time()
def load_etl_json(script_fname):
    # get json string
    json_str = CfgConstant.get_value_by_type_name(CfgConstantType.ETL_JSON.name, script_fname, str)
    return json_str


@log_execution_time()
def detect_file_path_delimiter(file_path, default_delimiter, with_encoding=False):
    encoding = detect_encoding(file_path)
    with open_with_zip(file_path, 'r', encoding=encoding) as f:
        if with_encoding:
            return detect_file_stream_delimiter(f, default_delimiter, encoding=encoding), encoding
        return detect_file_stream_delimiter(f, default_delimiter, encoding=encoding)


def detect_file_stream_delimiter(file_stream, default_delimiter, encoding=None):
    white_list = [CsvDelimiter.CSV.value, CsvDelimiter.TSV.value, CsvDelimiter.SMC.value]
    candidates = []

    for i in range(200):
        try:
            line = file_stream.readline()
            if isinstance(line, bytes):
                line = line.decode(encoding)
        except StopIteration:
            break

        if line:
            _, row_delimiter = max([(len(line.split(split_char)), split_char) for split_char in white_list])
            candidates.append(row_delimiter)

    if candidates:
        good_delimiter = max(candidates, key=candidates.count)
        if good_delimiter is not None:
            return good_delimiter

    file_stream.seek(0)

    return default_delimiter
