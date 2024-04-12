from flask_wtf import FlaskForm
from wtforms import IntegerField, StringField


class DataSourceForm(FlaskForm):
    id = IntegerField()
    name = StringField()
    type = StringField()
    comment = StringField()
    order = IntegerField()
    # db_detail = FormField(DataSourceDbForm)
    # csv_detail = FormField(DataSourceCsvForm)


# class UniversalDBSchema(FlaskForm):
#     column_names = FieldList(StringField())


# class ProcessColumnsForm(FlaskForm):
#     id = IntegerField()
#     process_id = IntegerField()
#     column_name = StringField()
#     english_name = StringField()
#     name = StringField()
#     data_type = StringField()
#     operator = StringField()
#     coef = StringField()
#     column_type = IntegerField()
#     is_serial_no = BooleanField()
#     is_get_date = BooleanField()
#     is_auto_increment = BooleanField()
#     order = IntegerField()


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
