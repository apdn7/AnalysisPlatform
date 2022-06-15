from flask_wtf import FlaskForm
from wtforms import IntegerField, StringField, BooleanField, FormField, FieldList


class DataSourceDbForm(FlaskForm):
    id = IntegerField('dataSourceId')

    host = StringField()
    port = IntegerField()
    dbname = StringField()
    schema = StringField()
    username = StringField()
    password = StringField()
    hashed = BooleanField()
    use_os_timezone = BooleanField()


class DataSourceCsvForm(FlaskForm):
    id = IntegerField('dataSourceId')
    directory = StringField()
    skip_head = IntegerField()
    skip_tail = IntegerField()
    delimiter = StringField()
    etl_func = StringField()


class DataSourceForm(FlaskForm):
    id = IntegerField()
    name = StringField()
    type = StringField()
    comment = StringField()
    order = IntegerField()
    # db_detail = FormField(DataSourceDbForm)
    # csv_detail = FormField(DataSourceCsvForm)


class UniversalDBSchema(FlaskForm):
    column_names = FieldList(StringField())


class DataSourceCsvUpdateSchema(FlaskForm):
    name = StringField('master-name')
    delimiter = StringField()
    universal_db = FormField(UniversalDBSchema)


class Test1(FlaskForm):
    db_201123111328889 = FormField(DataSourceCsvUpdateSchema)


class ProcessColumnsForm(FlaskForm):
    id = IntegerField()
    process_id = IntegerField()
    column_name = StringField()
    english_name = StringField()
    name = StringField()
    data_type = StringField()
    operator = StringField()
    coef = StringField()
    column_type = IntegerField()
    is_serial_no = BooleanField()
    is_get_date = BooleanField()
    is_auto_increment = BooleanField()
    order = IntegerField()


class ProcessCfgForm(FlaskForm):
    id = IntegerField()
    name = StringField('proc_id')
    data_source_id = StringField()
    table_name = StringField()
    comment = StringField()
    order = IntegerField()
    columns = FieldList(FormField(ProcessColumnsForm))


# class DataSourceDbSchema(ma.SQLAlchemyAutoSchema):
#     class Meta:
#         model = CfgDataSourceDB
#
#
# class DataSourceCsvSchema(ma.SQLAlchemyAutoSchema):
#     class Meta:
#         model = CfgDataSourceCSV
#
#
# class DataSourceSchema(ma.SQLAlchemyAutoSchema):
#     class Meta:
#         model = CfgDataSource
#
