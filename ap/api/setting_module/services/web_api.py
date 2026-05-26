from types import SimpleNamespace
from typing import Any

import pandas as pd
from loguru import logger

from ap.common.common_utils import WebAuthenticationType
from ap.common.cryptography_utils import decrypt_pwd
from ap.etl.extract.web_api import WebApiExtractor
from ap.etl.transform import TransformData
from ap.etl.transform.web_api import WebAPITransformer


class WebAPI:
    """Concrete ETL that uses WebAPIExtractor, WebAPITransformer"""

    def __init__(
        self,
        api_url,
        username: str | None = None,
        encrypted_password: str | None = None,
        authentication_type: WebAuthenticationType = WebAuthenticationType.NONE,
    ) -> None:
        self.api_url = api_url
        self.username = username
        self.password = decrypt_pwd(encrypted_password)
        self.authentication_type = authentication_type
        self.extractor = WebApiExtractor(
            api_url=self.api_url,
            username=self.username,
            password=self.password,
            authentication_type=self.authentication_type,
        )
        self.transformer = WebAPITransformer(api_url=self.api_url)
        self.transformer = WebAPITransformer(api_url=self.api_url)

    def check_connection(self):
        """Check Web API connection"""
        data = self.extractor.extract(limit=1)  # parse JSON
        return data

    def get_data(self, limit: int | None = None) -> Any:
        """Get data from Web API"""
        try:
            # extract data from web
            data = self.extractor.extract(limit=limit)
            df = pd.DataFrame(data)
            # transform data
            data_transform = TransformData(df=df)
            df_transform = self.transformer.transform(data_transform).df
            return SimpleNamespace(
                df_rows=df_transform,
                cols=df_transform.columns.tolist(),
                # TODO: handle unit column in web api correctly
                dict_column_name_and_unit={},
            )
        except Exception as e:
            logger.exception(e)
            return SimpleNamespace(df_rows=None, cols=[], dict_column_name_and_unit={})
