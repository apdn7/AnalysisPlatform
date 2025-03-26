from typing import Tuple, Optional, List, Union

from ap.common.logger import logger
from ap.api.efa.services.etl import PyETLInterface
import pandas as pd


class DoNothing(PyETLInterface):
    """
    Template ETL class that does nothing to the data
    """

    def extract(self, fname: str) -> pd.DataFrame:
        """
        Read file.
        Here you can specify what rows/cols to read, etc.
        """
        df = pd.read_csv(fname)
        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms a DataFrame based on provided configurations by processing log strings
        to extract defects data and appending new metrics to the DataFrame.

        Args:
            df (pd.DataFrame): The input DataFrame containing log data.

        Returns:
            pd.DataFrame: The transformed DataFrame with new fields such as defect counts,
                          aggregate defect types, and bounding circle coordinates.

        Raises:
            ValueError: If any required fields as specified in the config schema are missing.
        """
        return df

    class ImportSchema(PyETLInterface.ImportSchema):
        """
        Define assumed schema (if necessary)
        Example
            datetime: str
            product_no: str
            lot_no: int
            serial_no: str
            judgement: Union[str, float]
            logstring: Union[str, float]
        """

        @classmethod
        def schema_definition(cls):
            return cls
