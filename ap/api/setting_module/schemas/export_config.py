from typing import Literal

from dateutil import tz
from pydantic import BaseModel, ConfigDict

from ap.common.constants import ExportCfgEnum
from ap.common.timezone_utils import convert_str_utc_by_timezone
from ap.setting_module.models import CfgExport, CfgExportDetail, CfgExportFilter, CfgExportPeriodic


class ExportPeriodic(BaseModel):
    """Export periodic form"""

    model_config = ConfigDict(from_attributes=True)

    interval_unit: Literal['day', 'hour', 'minute']
    interval_value: int
    start_time: str

    def convert_utc(self, client_timezone):
        """Convert datetime to utc"""
        # convert datetime
        client_timezone = tz.gettz(client_timezone)
        self.start_time = convert_str_utc_by_timezone(client_timezone, self.start_time)

    def to_orm(self, client_timezone):
        """
        Convert pydantic schema to db model with relationship
        Returns:

        """
        self.convert_utc(client_timezone)

        data = self.model_dump()

        # load pure object without relationship
        config = CfgExportPeriodic(**data)

        return config


class ExportFilterDetail(BaseModel):
    """Export filter detail form"""

    model_config = ConfigDict(from_attributes=True)

    process_id: int
    filter_detail_id: int


class ExportDetail(BaseModel):
    """Export config form"""

    model_config = ConfigDict(from_attributes=True)

    process_id: int
    process_column_id: int
    order: int | None = None


class ExportConfigBase(BaseModel):
    """Export config base schema"""

    id: int | None = None
    title: str
    folder_path: str
    main_process_id: int
    created_by: str | None = None
    description: str | None = None


class ExportConfigSave(ExportConfigBase):
    """Export config form"""

    model_config = ConfigDict(from_attributes=True)
    filename_format: str
    client_timezone: str
    remove_exception: bool = False
    remove_abnormal_count: bool = False
    remove_outlier: str | bool
    export_column_name_type: int = 0
    type: Literal['once', 'periodic']
    file_format: Literal['tsv', 'csv']
    duplicated_check_type: Literal['all', 'first', 'last']
    duplicated_check: Literal['auto', 'check', 'silent']
    sub_folder: str | None = None
    filename_identifier: str | None = None
    split_file_by: int | None = None
    periodic_id: int | None = None
    export_from: str | None = None
    export_to: str | None = None
    export_details: list[ExportDetail] = []
    filters: list[ExportFilterDetail] = []
    run_now: bool = False

    def convert_utc(self):
        """Convert datetime to utc"""
        # convert datetime
        client_timezone = tz.gettz(self.client_timezone)
        if self.export_from:
            self.export_from = convert_str_utc_by_timezone(client_timezone, self.export_from)
        if self.export_to:
            self.export_to = convert_str_utc_by_timezone(client_timezone, self.export_to)

    def to_orm(self):
        """
        Convert pydantic schema to db model with relationship
        Returns:

        """
        self.convert_utc()

        data = self.model_dump()

        # split relationship fields
        export_details = data.pop(ExportCfgEnum.DETAILS, [])
        export_filter_details = data.pop(ExportCfgEnum.FILTERS, [])
        data.pop('run_now')

        # load pure object without relationship
        export_config = CfgExport(**data)

        # assign relation field after validate and modal them to db model
        export_config.export_details = [CfgExportDetail(**export_detail) for export_detail in export_details]
        export_config.filters = [
            CfgExportFilter(**export_filter_detail) for export_filter_detail in export_filter_details
        ]

        return export_config


class ExportConfigGet(ExportConfigBase):
    """Export config schema for getting data"""

    cycle_name: str | None = None
    timing: str | None = None
    parameters: str | None = None
    last_run: str | None = None
    last_export_data: str | None = None
    next_run: str | None = None
    updated_at: str | None = None
    main_process_name: str | None = None
    type: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def add_info(cls, export_config) -> 'ExportConfigGet':
        instance = cls.model_validate(export_config)
        return instance


class ExportConfigDetail(ExportConfigSave):
    """Export config schema for showing detail export configuration"""


class ExportSetting(BaseModel):
    """Export config schema for showing detail export setting"""

    export_config: ExportConfigDetail
    export_periodic: ExportPeriodic | None
