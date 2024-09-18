import sqlite3

import pandas as pd

from ap.common.constants import (
    MSG_DB_CON_FAILED,
    UNKNOWN_ERROR_TEXT,
    DataImportErrorTypes,
    ErrorMsgFromDB,
    ErrorMsgText,
)


class ErrorMessageHandler:
    def __init__(self):
        self.msg = UNKNOWN_ERROR_TEXT

    def msg_from_exception(self, exception: Exception):
        exception_message = str(exception)
        # default case
        self.msg = f'{UNKNOWN_ERROR_TEXT} Detail: {exception_message}'
        # known exception types
        if isinstance(exception, KeyError):
            self.msg = f'{ErrorMsgText[DataImportErrorTypes.COL_NOT_FOUND]} Detail: {exception_message}'
        elif isinstance(exception, pd.errors.EmptyDataError):
            self.msg = f'{ErrorMsgText[DataImportErrorTypes.EMPTY_DATA_FILE]} Detail: {exception_message}'
        elif isinstance(exception, sqlite3.OperationalError):
            if ErrorMsgFromDB[DataImportErrorTypes.DB_LOCKED] in exception_message:
                self.msg = f'{ErrorMsgText[DataImportErrorTypes.DB_LOCKED]} Detail: {exception_message}'
            elif ErrorMsgFromDB[DataImportErrorTypes.TABLE_NOT_FOUND] in exception_message:
                self.msg = f'{ErrorMsgText[DataImportErrorTypes.TABLE_NOT_FOUND]} Detail: {exception_message}'
        # custom exceptions
        elif exception_message == MSG_DB_CON_FAILED:
            self.msg = f'{ErrorMsgText[DataImportErrorTypes.DB_CONNECTION_FAILED]} Detail: {exception_message}'

        return self.msg
