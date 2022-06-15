import json

from flask import Blueprint, request

from histview2.common.pydn.dblib import mssqlserver, oracle
from histview2.common.pydn.dblib.db_proxy import DbProxy
from histview2.common.services import http_content
from histview2.common.services.jp_to_romaji_utils import to_romaji
from histview2.common.services.sse import notify_progress
from histview2.setting_module.models import CfgDataSource

api_table_viewer_blueprint = Blueprint(
    'api_table_viewer',
    __name__,
    url_prefix='/histview2/api/table_viewer'
)


@api_table_viewer_blueprint.route('/column_names', methods=['GET'])
def get_column_names():
    """[summary]
    show_column_names
    Returns:
        [type] -- [description]
    """
    database = request.args.get('database')
    table = request.args.get('table')

    blank_output = json.dumps({
        'cols': [],
        'rows': []
    }, ensure_ascii=False, default=http_content.json_serial)

    data_source = CfgDataSource.query.get(database)
    if not data_source:
        return blank_output

    with DbProxy(data_source) as db_instance:
        if not db_instance or not table:
            return blank_output

        cols = db_instance.list_table_columns(table)
        for col in cols:
            col['romaji'] = to_romaji(col['name'])

    content = {
        'cols': cols,
    }

    return json.dumps(content, ensure_ascii=False, default=http_content.json_serial)


@api_table_viewer_blueprint.route('/table_records', methods=['POST'])
def get_table_records():
    """[summary]
    Show limited records
    Returns:
        [type] -- [description]
    """

    request_data = json.loads(request.data)
    db_code = request_data.get("database_code")
    table_name = request_data.get("table_name")
    sort_column = request_data.get("sort_column")
    sort_order = request_data.get("sort_order") or "DESC"
    limit = request_data.get("limit") or 5

    blank_output = json.dumps({
        'cols': [],
        'rows': []
    }, ensure_ascii=False, default=http_content.json_serial)

    if not db_code or not table_name or sort_order not in ("ASC", "DESC"):
        return blank_output

    data_source = CfgDataSource.query.get(db_code)
    if not data_source:
        return blank_output

    with DbProxy(data_source) as db_instance:
        if not db_instance or not table_name:
            return blank_output

        cols_with_types = db_instance.list_table_columns(table_name)
        for col in cols_with_types:
            col['romaji'] = to_romaji(col['name'])

        cols, rows = query_data(db_instance, table_name, sort_column, sort_order, limit)

    result = {
        'cols': cols_with_types,
        'rows': rows
    }
    return json.dumps(result, ensure_ascii=False, default=http_content.json_serial)


@notify_progress(50)
def query_data(db_instance, table_name, sort_column, sort_order, limit):
    sort_statement = ''
    if sort_column and sort_order:
        sort_statement = "order by \"{}\" {} ".format(sort_column, sort_order)

    if isinstance(db_instance, mssqlserver.MSSQLServer):
        sql = "select TOP {}  * from \"{}\" {} ".format(limit, table_name, sort_statement)
    elif isinstance(db_instance, oracle.Oracle):
        sql = "select * from \"{}\" where rownum <= {} {} ".format(table_name, limit, sort_statement)
    else:
        sql = "select * from \"{}\" {} limit {}".format(table_name, sort_statement, limit)

    cols, rows = db_instance.run_sql(sql=sql)

    return cols, rows
