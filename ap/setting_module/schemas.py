import marshmallow
from marshmallow import fields, post_load
from marshmallow_sqlalchemy.fields import Nested

from ap import ma
from ap.setting_module.models import (
    CfgCsvColumn,
    CfgDataSource,
    CfgDataSourceCSV,
    CfgDataSourceDB,
    CfgFilter,
    CfgFilterDetail,
    CfgOption,
    CfgProcess,
    CfgProcessColumn,
    CfgProcessFunctionColumn,
    CfgRequest,
    CfgTrace,
    CfgTraceKey,
    CfgUserSetting,
    CfgVisualization,
)

EXCLUDE_COLS = ('updated_at', 'created_at')


class CsvColumnSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgCsvColumn
        include_fk = True
        unknown = True
        partial = True
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False)
    data_source_id = fields.Integer(required=False)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgCsvColumn(**data)


class DataSourceDbSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgDataSourceDB
        include_fk = True
        unknown = True
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgDataSourceDB(**data)


class DataSourceCsvSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgDataSourceCSV
        include_fk = True
        unknown = True
        required = False
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False)
    csv_columns = Nested(CsvColumnSchema, many=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgDataSourceCSV(**data)


class DataSourceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgDataSource
        unknown = True
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False, allow_none=True)
    csv_detail = Nested(DataSourceCsvSchema)
    db_detail = Nested(DataSourceDbSchema)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgDataSource(**data)


class FilterDetailSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgFilterDetail
        include_fk = True
        exclude = EXCLUDE_COLS


class ProcessFunctionColumnSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcessFunctionColumn
        include_fk = True
        exclude = EXCLUDE_COLS
        unknown = marshmallow.EXCLUDE

    id = fields.Integer(required=False, allow_none=True)
    function_id = fields.Integer(required=False, allow_none=True)

    var_x = fields.Integer(required=False, allow_none=True)
    var_y = fields.Integer(required=False, allow_none=True)

    a = fields.String(required=False, allow_none=True)
    b = fields.String(required=False, allow_none=True)
    c = fields.String(required=False, allow_none=True)
    n = fields.String(required=False, allow_none=True)
    k = fields.String(required=False, allow_none=True)
    s = fields.String(required=False, allow_none=True)
    t = fields.String(required=False, allow_none=True)

    return_type = fields.String(required=False, allow_none=True)
    note = fields.String(required=False, allow_none=True)
    process_column_id = fields.Integer(required=False, allow_none=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgProcessFunctionColumn(**data)


class ProcessColumnSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcessColumn
        include_fk = True
        exclude = EXCLUDE_COLS
        unknown = marshmallow.EXCLUDE

    id = fields.Integer(required=False, allow_none=True)

    name_jp = fields.String(required=False, allow_none=True)
    name_local = fields.String(required=False, allow_none=True)
    name_en = fields.String(required=False, allow_none=False)
    shown_name = fields.String(required=False, allow_none=True)
    name = fields.String(required=False, allow_none=True)
    is_category = fields.Boolean(required=False, allow_none=True)
    is_int_category = fields.Boolean(required=False, allow_none=True)
    is_linking_column = fields.Boolean(required=False, allow_none=True)

    parent_column = Nested('ProcessColumnSchema', many=False, required=False)
    # This field to sever store function config of this column
    function_details = Nested(ProcessFunctionColumnSchema, many=True, required=False)

    # This field to sever store previous data type and show it on modal fail convert data
    origin_raw_data_type = fields.String(required=False, allow_none=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgProcessColumn(**data)


class FilterSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgFilter
        include_fk = True
        exclude = EXCLUDE_COLS

    filter_details = Nested(FilterDetailSchema, many=True)
    column = Nested(ProcessColumnSchema, many=False)


class VisualizationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgVisualization
        include_fk = True
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False, allow_none=True)
    filter_detail_id = fields.Integer(required=False, allow_none=True)
    control_column = Nested(ProcessColumnSchema, many=False)
    filter_column = Nested(ProcessColumnSchema, many=False)
    filter_detail = Nested(FilterDetailSchema, many=False)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgVisualization(**data)


class TraceKeySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgTraceKey
        include_fk = True
        exclude = EXCLUDE_COLS

    self_column = Nested(ProcessColumnSchema)
    target_column = Nested(ProcessColumnSchema)


class TraceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgTrace
        include_fk = True
        exclude = EXCLUDE_COLS

    trace_keys = Nested(TraceKeySchema, many=True)


class ProcessSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        exclude = ('visualizations',) + EXCLUDE_COLS  # re-open the params if used

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(lambda: DataSourceSchema(only=('id', 'name', 'type', 'csv_detail', 'db_detail')))
    name_en = fields.String(required=False, allow_none=False)
    name_jp = fields.String(required=False, allow_none=True)
    name_local = fields.String(required=False, allow_none=True)
    shown_name = fields.String(required=False, allow_none=True)
    is_show_file_name = fields.Boolean(required=False, allow_none=True)


class ProcessFullSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        exclude = EXCLUDE_COLS

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(DataSourceSchema)
    visualizations = Nested(VisualizationSchema, many=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgProcess(**data)


class ProcessVisualizationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        exclude = ('data_source', 'traces') + EXCLUDE_COLS

    columns = Nested(ProcessColumnSchema, many=True)
    visualizations = Nested(VisualizationSchema, many=True)
    filters = Nested(FilterSchema, many=True)


class ProcessOnlySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        exclude = ('visualizations', 'columns', 'traces', 'filters') + EXCLUDE_COLS  # re-open the params if used

    shown_name = fields.String(required=False, allow_none=False)


class CfgUserSettingSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgUserSetting
        exclude = ['created_at']

    id = fields.Integer(required=False, allow_none=True)
    function = fields.String(required=False, allow_none=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgUserSetting(**data)


class ShowGraphSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        # exclude = ('data_source', 'traces') + EXCLUDE_COLS
        exclude = ('traces', 'comment', 'order') + EXCLUDE_COLS

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True, allow_none=None)
    filters = Nested(FilterSchema, many=True)
    # data_source = Nested(DataSourceSchema, allow_none=None)
    data_source = Nested(DataSourceSchema)
    visualizations = Nested(VisualizationSchema, many=True)
    shown_name = fields.String(required=True, allow_none=False)


class CfgRequestSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgRequest

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgRequest(**data)


class CfgOptionSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgOption

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgOption(**data)
