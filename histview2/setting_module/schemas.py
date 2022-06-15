from marshmallow import post_load, fields
from marshmallow_sqlalchemy.fields import Nested

from histview2 import ma
from histview2.setting_module.models import CfgDataSourceDB, CfgDataSourceCSV, CfgDataSource, CfgProcess, \
    CfgCsvColumn, CfgTrace, CfgTraceKey, CfgProcessColumn, CfgFilter, CfgFilterDetail, CfgVisualization, CfgUserSetting


class CsvColumnSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgCsvColumn
        include_fk = True
        unknown = True
        partial = True

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

    id = fields.Integer(required=False)
    csv_columns = Nested(CsvColumnSchema, many=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgDataSourceCSV(**data)


class DataSourceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgDataSource
        unknown = True

    id = fields.Integer(required=False, allow_none=True)
    csv_detail = Nested(DataSourceCsvSchema)
    db_detail = Nested(DataSourceDbSchema)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgDataSource(**data)


class TraceKeySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgTraceKey
        include_fk = True


class TraceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgTrace
        include_fk = True

    trace_keys = Nested(TraceKeySchema, many=True)


class FilterDetailSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgFilterDetail
        include_fk = True


class FilterSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgFilter
        include_fk = True

    filter_details = Nested(FilterDetailSchema, many=True)


class VisualizationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgVisualization
        include_fk = True

    id = fields.Integer(required=False, allow_none=True)
    filter_detail_id = fields.Integer(required=False, allow_none=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgVisualization(**data)


class ProcessColumnSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcessColumn

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgProcessColumn(**data)


class ProcessSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        exclude = ("visualizations",)  # re-open the params if used

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(lambda: DataSourceSchema(only=("id", "name")))


class ProcessFullSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True

    id = fields.Integer(required=False, allow_none=True)
    columns = Nested(ProcessColumnSchema, many=True)
    traces = Nested(TraceSchema, many=True)
    filters = Nested(FilterSchema, many=True)
    data_source = Nested(DataSourceSchema)
    visualizations = Nested(VisualizationSchema, many=True)


class ProcessVisualizationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        include_fk = True
        include_relationships = True
        exclude = ("data_source", "traces")

    columns = Nested(ProcessColumnSchema, many=True)
    visualizations = Nested(VisualizationSchema, many=True)
    filters = Nested(FilterSchema, many=True)


class ProcessOnlySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgProcess
        exclude = ("visualizations", "columns", "traces", "filters")  # re-open the params if used


class CfgUserSettingSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = CfgUserSetting

    id = fields.Integer(required=False, allow_none=True)

    @post_load
    def make_obj(self, data, **kwargs):
        return CfgUserSetting(**data)
