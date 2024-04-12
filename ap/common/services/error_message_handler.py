import sqlite3

import pandas as pd

from ap.common.constants import UNKNOWN_ERROR_TEXT, DataImportErrorTypes, ErrorMsgFromDB, ErrorMsgText


class ErrorMessageHandler:
    def __init__(self):
        self.msg = UNKNOWN_ERROR_TEXT

    def msg_from_exception(self, exception: Exception):
        if isinstance(exception, KeyError):
            self.msg = f'{ErrorMsgText[DataImportErrorTypes.COL_NOT_FOUND]} Detail:{str(exception)}'
        if isinstance(exception, pd.errors.EmptyDataError):
            self.msg = f'{ErrorMsgText[DataImportErrorTypes.EMPTY_DATA_FILE]} Detail:{str(exception)}'
        if isinstance(exception, sqlite3.OperationalError):
            if ErrorMsgFromDB[DataImportErrorTypes.DB_LOCKED] in str(exception):
                self.msg = f'{ErrorMsgText[DataImportErrorTypes.DB_LOCKED]} Detail:{str(exception)}'
            elif ErrorMsgFromDB[DataImportErrorTypes.TABLE_NOT_FOUND] in str(exception):
                self.msg = f'{ErrorMsgText[DataImportErrorTypes.TABLE_NOT_FOUND]} Detail:{str(exception)}'
        return self.msg
