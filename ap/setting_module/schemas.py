from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Optional, TypedDict

import marshmallow
import pydantic
from marshmallow import fields, post_load, pre_dump
from marshmallow_sqlalchemy.fields import Nested
from pydantic.alias_generators import to_camel

from ap import ma
from ap.common.constants import DataColumnType, DataType, DBType
from ap.common.cryptography_utils import encrypt
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.setting_module.models import (
    CfgCsvColumn,
    CfgDataSource,
    CfgDataSourceCSV,
    CfgDataSourceDB,
    CfgFilter,
    CfgFilterDetail,
    CfgImportFilter,
    CfgImportFilterDetail,
    CfgOption,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    CfgTrace,
    CfgTraceKey,
    CfgUserSetting,
    CfgVisualization,
    JobManagement,
)

EXCLUDE_COLS = ('updated_at', 'created_at')


class AnyAsBool(fields.Field):
    """Field that serializes string to boolean"""

    def _deserialize(
        self,
        value: Any,
        attr: Optional[str],
        data: Optional[Mapping[str, Any]],
        **kwargs,
    ):
        return bool(value)


class ContextSchemaDict(TypedDict):
    show_graph: bool


class BaseSchema(ma.SQLAlchemyAutoSchema):
    """Base schema with shared definition"""

    # typehint for dictionary
    if TYPE_CHECKING:
        context: ContextSchemaDict

    class Meta:
        """Base meta with shared definition"""

        # allow to include relationships from children models
        include_relationships = True

        # allow to show foreign keys
        include_fk = True

        # load into sqlalchemy models
        load_instance = True

        # allow objects non-existed in database
        transient = True

        # allow missing fields to be parsed as None
        partial = True

        # exclude every unknown fields
        unknown = marshmallow.EXCLUDE
        exclude = EXCLUDE_COLS


class CsvColumnSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgCsvColumn

    id = fields.Integer(allow_none=True)
    data_source_id = fields.Integer(allow_none=True)


class DataSourceDbSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgDataSourceDB

    id = fields.Integer(allow_none=True)

    @post_load
    def make_instance(self, data, **kwargs):
        """Change some data after validation
        See more: <https://github.com/marshmallow-code/marshmallow-sqlalchemy/issues/502#issuecomment-1484628041>
        """
        model = super().make_instance(data)

        # encrypt password
        model.password = encrypt(model.password)
        model.hashed = True
        # avoid blank string
        model.port = model.port or None
        model.schema = model.schema or None

        return model


class DataSourceCsvSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgDataSourceCSV

    id = fields.Integer(allow_none=True)

    csv_columns = fields.Nested('CsvColumnSchema', many=True)


class DataSourceSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgDataSource
        exclude = BaseSchema.Meta.exclude + ('order',)

    id = fields.Integer(allow_none=True)

    csv_detail = fields.Nested('DataSourceCsvSchema', allow_none=True)
    db_detail = fields.Nested('DataSourceDbSchema', allow_none=True)


class FilterDetailSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgFilterDetail


class ProcessFunctionColumnSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcessFunctionColumn

    id = fields.Integer(allow_none=True)
    # hybrid properties go here
    is_me_function = fields.Boolean(dump_only=True)


class ProcessColumnSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcessColumn

    id = fields.Integer(allow_none=True)

    parent_column = fields.Nested('ProcessColumnSchema', allow_none=True)
    # This field to sever store function config of this column
    function_details = fields.Nested('ProcessFunctionColumnSchema', many=True, required=False)

    # import filters
    import_filters = fields.Nested('ImportFiltersSchema', many=True, required=False)

    # This field to sever store previous data type and show it on modal fail convert data
    origin_raw_data_type = fields.String(allow_none=True)

    # if new process
    process_id = fields.Integer(allow_none=True)

    # custom serialize to serialize empty string and others to boolean values
    is_serial_no = AnyAsBool()
    is_get_date = AnyAsBool()
    is_auto_increment = AnyAsBool()
    is_dummy_datetime = AnyAsBool()
    is_file_name = AnyAsBool()

    # hybrid properties go here
    is_main_serial = fields.Boolean(dump_only=True)
    is_function_column = fields.Boolean(dump_only=True)
    is_normal_column = fields.Boolean(dump_only=True)
    is_main_serial_function_column = fields.Boolean(dump_only=True)
    is_transaction_column = fields.Boolean(dump_only=True)
    shown_name = fields.String(dump_only=True)
    is_linking_column = fields.Boolean(dump_only=True)
    bridge_column_name = fields.String(dump_only=True)
    is_category = fields.Boolean(dump_only=True)
    is_int_category = fields.Boolean(dump_only=True)
    is_judge = fields.Boolean(dump_only=True)
    is_me_function_column = fields.Boolean(dump_only=True)
    is_chain_of_me_functions = fields.Boolean(dump_only=True)

    @post_load
    def make_instance(self, data, **kwargs):
        """Change some data after validation
        See more: <https://github.com/marshmallow-code/marshmallow-sqlalchemy/issues/502#issuecomment-1484628041>
        """
        model = super().make_instance(data)

        # transform english name
        if not model.name_en:
            model.name_en = to_romaji(model.column_name)

        # transform data type
        if model.data_type in (DataType.EU_REAL_SEP.name, DataType.REAL_SEP.name):
            model.data_type = DataType.REAL.name
        elif model.data_type in (DataType.EU_INTEGER_SEP.name, DataType.INTEGER_SEP.name):
            model.data_type = DataType.INTEGER.name

        return model

    @pre_dump
    def convert_data_type(self, data: CfgProcessColumn, many, **kwargs):
        data = data.clone()
        show_graph = self.context.get('show_graph', False)
        # convert datatype for show graph
        if show_graph:
            # modify data type based on function columns
            if data.function_details and data.function_details[-1].return_type:
                function_return_type = data.function_details[-1].return_type
                data.data_type = function_return_type

            if data.data_type == DataType.BOOLEAN.name and data.column_type != DataColumnType.JUDGE.value:
                data.column_type = DataColumnType.BOOLEAN.value

            # need to change again, make sure date, time, boolean be converted to text
            if data.data_type in [
                DataType.DATE.name,
                DataType.TIME.name,
                DataType.BOOLEAN.name,
            ]:
                data.data_type = DataType.TEXT.name

            # change data type column from `boolean` or `category` to Int(Cat) (PO requirements)
            if data.data_type == DataType.CATEGORY.name:
                data.data_type = DataType.INTEGER.name
                data.column_type = DataColumnType.INT_CATE.value

        return data


class FilterSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgFilter

    filter_details = fields.Nested('FilterDetailSchema', many=True)
    column = fields.Nested('ProcessColumnSchema', allow_none=True)


class VisualizationSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgVisualization

    id = fields.Integer(allow_none=True)

    control_column = fields.Nested('ProcessColumnSchema')
    filter_column = fields.Nested('ProcessColumnSchema', allow_none=True)
    filter_detail = fields.Nested('FilterDetailSchema', allow_none=True)


class TraceKeySchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgTraceKey

    self_column = fields.Nested('ProcessColumnSchema')
    target_column = fields.Nested('ProcessColumnSchema')


class TraceSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgTrace

    trace_keys = fields.Nested('TraceKeySchema', many=True)


class ProcessSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess
        exclude = ('visualizations',) + EXCLUDE_COLS  # re-open the params if used

    # allow to create new process
    id = fields.Integer(allow_none=True)

    columns = fields.Nested('ProcessColumnSchema', many=True)
    traces = fields.Nested('TraceSchema', many=True)
    filters = fields.Nested('FilterSchema', many=True)
    # TODO(khanhdq): can we omit the lambda here? it is ugly
    data_source = fields.Nested(lambda: DataSourceSchema(only=('id', 'name', 'type', 'csv_detail', 'db_detail')))

    # `order` field will be calculated after loading, need to mark it here
    order = fields.Integer(required=False, allow_none=True)

    # hybrid properties go here
    shown_name = fields.String(dump_only=True)
    is_check_datetime_format = fields.Boolean(dump_only=True)


class ProcessFullSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(DataSourceSchema)
    visualizations = Nested(VisualizationSchema, many=True)
    # hybrid properties go here
    shown_name = fields.String(dump_only=True)


class ProcessVisualizationSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess
        exclude = ('data_source', 'traces') + BaseSchema.Meta.exclude

    columns = fields.Nested('ProcessColumnSchema', many=True)
    visualizations = fields.Nested('VisualizationSchema', many=True)
    filters = fields.Nested('FilterSchema', many=True)


class ProcessTraceSchema(ProcessSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess
        exclude = ('visualizations', 'filters') + EXCLUDE_COLS  # re-open the params if used


class ProcessOnlySchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess
        exclude = ('visualizations', 'columns', 'traces', 'filters') + EXCLUDE_COLS  # re-open the params if used

    shown_name = fields.String(required=False, allow_none=False)


class CfgUserSettingSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgUserSetting
        exclude = ['created_at']

    id = fields.Integer(required=False, allow_none=True)
    function = fields.String(required=False, allow_none=True)
    hashed_owner = fields.String(required=True, allow_none=False)


class ShowGraphSchema(ProcessSchema):
    class Meta(BaseSchema.Meta):
        model = CfgProcess
        exclude = ('comment', 'order') + EXCLUDE_COLS

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(DataSourceSchema)
    visualizations = Nested(VisualizationSchema, many=True)


class CfgOptionSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgOption
        # TODO: why we don't use default exclude here?
        exclude = []

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgOption(**data)


class ProcessColumnExternalAPISchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        load_instance = False
        exclude = []

    id = fields.Integer(required=True)
    shown_name = fields.String(required=True, data_key='name')
    data_type = fields.String(required=True)


class ImportFilterDetailSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgImportFilterDetail
        exclude = []

    id = fields.Integer(required=False, allow_none=True)
    filter_id = fields.Integer(required=False, allow_none=True)


class ImportFiltersSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = CfgImportFilter
        exclude = []

    id = fields.Integer(required=False, allow_none=True)
    column_id = fields.Integer(required=False, allow_none=True)
    filters = Nested('ImportFilterDetailSchema', many=True, required=False)


class JobManagementSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = JobManagement


class BasePydanticModel(pydantic.BaseModel):
    """using pydantic.BaseModel to have a better autocompletion"""

    model_config = pydantic.ConfigDict(from_attributes=True)


class AutolinkInSchema(BasePydanticModel):
    model_config = pydantic.ConfigDict(alias_generator=to_camel)
    process_ids: list[int]


class VisTraceKeyOutSchema(BasePydanticModel):
    self_column_id: int
    target_column_id: int
    self_column_substr_from: Optional[int]
    self_column_substr_to: Optional[int]
    target_column_substr_from: Optional[int]
    target_column_substr_to: Optional[int]
    delta_time: Optional[float]
    cut_off: Optional[float]


class VisTraceOutSchema(BasePydanticModel):
    self_process_id: int
    target_process_id: int
    trace_keys: list[VisTraceKeyOutSchema]


class VisProcessTraceOutSchema(BasePydanticModel):
    id: int
    name: str
    name_en: Optional[str]
    name_jp: Optional[str]
    name_local: Optional[str]
    shown_name: str

    data_source_id: int
    table_name: Optional[str]
    master_type: Optional[str]
    process_factid: Optional[str]
    etl_func: Optional[str]
    traces: list[VisTraceOutSchema]

    # generated data
    datalink_tree_directory: str = ''
    serial_column_id: Optional[int] = None

    @pydantic.computed_field
    @property
    def master(self) -> str:
        return self.shown_name

    @pydantic.computed_field
    @property
    def label(self) -> str:
        return self.shown_name

    @pydantic.model_validator(mode='before')
    @classmethod
    def add_datalink_tree_category(cls, data: Any):
        """Group all processes with the same data source id in front-end for viewing in tree directory"""
        # do not validate if this is not cfg process
        if not isinstance(data, CfgProcess):
            return data

        if data.data_source.type == DBType.V2.name:
            data.datalink_tree_directory = data.data_source.csv_detail.directory
        else:
            data.datalink_tree_directory = str(data.data_source_id)

        return data

    @pydantic.model_validator(mode='before')
    @classmethod
    def add_serial_column_id(cls, data: Any):
        """Whether process has main serial column, this use to validate datalink."""
        # do not validate if this is not cfg process
        if not isinstance(data, CfgProcess):
            return data

        serial_column = data.get_main_serial_col() or data.get_main_serial_function_col()
        if serial_column is not None:
            data.serial_column_id = serial_column.id

        return data
