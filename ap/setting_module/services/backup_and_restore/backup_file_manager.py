from __future__ import annotations

import contextlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar

import pandas as pd
from pydantic import BaseModel

from ap.common.common_utils import (
    get_backup_data_folder,
    read_parquet_file,
    write_parquet_file,
)
from ap.common.constants import UNDER_SCORE, CsvDelimiter, FileExtension


class BackupKey(BaseModel):
    FIlE_EXTENSION: ClassVar[str] = FileExtension.Parquet.value
    FILE_SEP: ClassVar[str] = CsvDelimiter.TSV.value
    FILE_FORMAT: ClassVar[str] = '%Y%m%d'

    process_id: int
    start_time: datetime
    end_time: datetime

    @classmethod
    def from_file_name(cls, process_id: int, file_name: str) -> 'BackupKey' | None:
        star_time, end_time, *_ = file_name.split(UNDER_SCORE)
        with contextlib.suppress(ValueError):
            start_time = datetime.strptime(star_time, cls.FILE_FORMAT)
            end_time = datetime.strptime(end_time, cls.FILE_FORMAT)
            return BackupKey(process_id=process_id, start_time=start_time, end_time=end_time)
        return None

    @property
    def backup_folder(self):
        return Path(get_backup_data_folder(self.process_id))

    @property
    def filename(self) -> Path:
        min_time = self.start_time.strftime(self.FILE_FORMAT)
        max_time = self.end_time.strftime(self.FILE_FORMAT)
        file_name = f'{min_time}{UNDER_SCORE}{max_time}.{self.FIlE_EXTENSION}'
        return self.backup_folder / file_name

    def make_backup_dir(self):
        self.backup_folder.mkdir(exist_ok=True)

    def delete_file(self):
        self.filename.unlink(missing_ok=True)

    def read_file(self) -> pd.DataFrame:
        if not self.filename.exists():
            return pd.DataFrame()
        return read_parquet_file(str(self.filename))

    def write_file(self, dataframe: pd.DataFrame) -> None:
        if dataframe.empty:
            self.delete_file()
        else:
            self.make_backup_dir()
            write_parquet_file(dataframe, str(self.filename))


class BackupKeysManager(BaseModel):
    """Handle multiple backup keys, each key must not overlap"""

    process_id: int
    start_time: datetime
    end_time: datetime

    def model_post_init(self, __context: Any) -> None:
        # need to add 1 second to end_time
        self.end_time = self.end_time + timedelta(seconds=1)

    def get_start_time(self, backup_key: BackupKey) -> datetime:
        return pd.to_datetime(max(self.start_time, backup_key.start_time), utc=True)

    def get_end_time(self, backup_key: BackupKey) -> datetime:
        return pd.to_datetime(min(self.end_time, backup_key.end_time), utc=True)

    def get_backup_keys_by_day(self) -> list[BackupKey]:
        """Get all non-overlap separated by day backup keys"""
        backup_keys = []

        current_date = self.start_time.date()
        end_date = self.end_time.date()
        while current_date <= end_date:
            next_date = current_date + timedelta(days=1)
            backup_keys.append(
                BackupKey(
                    process_id=self.process_id,
                    start_time=current_date,
                    end_time=next_date,
                ),
            )
            current_date = next_date

        return backup_keys
