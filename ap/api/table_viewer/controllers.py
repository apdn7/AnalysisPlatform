import json

import pandas as pd
from flask import Blueprint, request

from ap.api.efa.services.etl import detect_file_path_delimiter
from ap.api.setting_module.services.show_latest_record import get_csv_data_from_files, get_info_from_db
from ap.api.setting_module.services.v2_etl_services import (
    get_df_v2_process_single_file,
    get_v2_datasource_type_from_file,
    get_vertical_df_v2_process_single_file,
)
from ap.common.common_utils import get_csv_delimiter
from ap.common.constants import DBType, MasterDBType
from ap.common.path_utils import get_latest_files, get_sorted_files_by_size
from ap.common.pydn.dblib import mssqlserver, oracle
from ap.common.pydn.dblib.db_proxy_read_only import ReadOnlyDbProxy
from ap.common.services.csv_content import get_delimiter_encoding
from ap.common.services.csv_header_wrapr import add_suffix_if_duplicated
from ap.common.services.http_content import json_dumps
from ap.common.services.jp_to_romaji_utils import to_romaji
from ap.common.services.sse import MessageAnnouncer
from ap.setting_module.models import CfgDataSource, CfgProcess

api_table_viewer_blueprint = Blueprint('api_table_viewer', __name__, url_prefix='/ap/api/table_viewer')


@api_table_viewer_blueprint.route('/column_names', methods=['GET'])
def get_column_names():
    """[summary]
    show_column_names
    Returns:
        [type] -- [description]
    """
    database = request.args.get('database')
    table = request.args.get('table')

    blank_output = json_dumps({'cols': [], 'rows': []})

    data_source = CfgDataSource.query.get(database)
    if not data_source:
        return blank_output

    with ReadOnlyDbProxy(data_source) as db_instance:
        if not db_instance or not table:
            return blank_output

        cols = db_instance.list_table_columns(table)
        for col in cols:
            col['romaji'] = to_romaji(col['name'])

    content = {
        'cols': cols,
    }

    return json_dumps(content)


@api_table_viewer_blueprint.route('/table_records', methods=['POST'])
def get_table_records():
    """[summary]
    Show limited records
    Returns:
        [type] -- [description]
    """
    request_data = json.loads(request.data)
    db_code = request_data.get('database_code')
    table_name = request_data.get('table_name')
    sort_column = request_data.get('sort_column')
    sort_order = request_data.get('sort_order') or 'DESC'
    proc_id = request_data.get('proc_id')
    limit = request_data.get('limit') or 5

    blank_output = json_dumps({'cols': [], 'rows': []})

    if not db_code or sort_order not in ('ASC', 'DESC'):
        return blank_output

    data_source = CfgDataSource.query.get(db_code)
    if not data_source:
        return blank_output

    if data_source.type == DBType.CSV.name:
        csv_detail = data_source.csv_detail
        cols_with_types, rows = get_csv_data(csv_detail, sort_column, sort_order, int(limit))
    elif data_source.type == DBType.V2.name:
        cols_with_types, rows = get_v2_data(data_source.csv_detail, sort_column, sort_order, int(limit))

    elif data_source.type in [
        DBType.SNOWFLAKE.name,
        DBType.POSTGRES_SOFTWARE_WORKSHOP.name,
        DBType.SNOWFLAKE_SOFTWARE_WORKSHOP.name,
    ]:
        cols_with_types, rows = get_sw_data(
            data_source, table_name, sort_column, sort_order, int(limit), proc_id=proc_id
        )

    else:
        with ReadOnlyDbProxy(data_source) as db_instance:
            if not db_instance or not table_name:
                return blank_output

            cols_with_types = db_instance.list_table_columns(table_name)
            for col in cols_with_types:
                col['romaji'] = to_romaji(col['name'])

            cols, rows = query_data(db_instance, table_name, sort_column, sort_order, limit)

    result = {'cols': cols_with_types, 'rows': rows}
    return json_dumps(result)


@MessageAnnouncer.notify_progress(50)
def query_data(db_instance, table_name, sort_column, sort_order, limit):
    sort_statement = ''
    if sort_column and sort_order:
        sort_statement = f'order by "{sort_column}" {sort_order} '

    if isinstance(db_instance, mssqlserver.MSSQLServer):
        # Cast non-Unicode char/varchar/text columns to NVARCHAR so the client
        # returns Unicode instead of code-page bytes (mojibake for non-ASCII,
        # e.g. CP932, data).
        select_columns = db_instance.gen_preview_select_columns(table_name)
        sql = f'select TOP {limit} {select_columns} from "{table_name}" {sort_statement} '
    elif isinstance(db_instance, oracle.Oracle):
        sql = f'select * from "{table_name}" where rownum <= {limit} {sort_statement} '
    else:
        sql = f'select * from "{table_name}" {sort_statement} limit {limit}'

    cols, rows = db_instance.run_sql(sql=sql)

    return cols, rows


@MessageAnnouncer.notify_progress(50)
def get_v2_data(csv_detail, sort_colum, sort_order, limit):
    sorted_files = get_sorted_files_by_size(csv_detail.directory)
    process_name = csv_detail.process_name
    # V2 preview with the largest file
    file_data_idx = 0
    data_details = []
    while file_data_idx >= 0:
        largest_file = sorted_files[file_data_idx]
        _, encoding = get_delimiter_encoding(largest_file, preview=True)
        datasource_type, is_abnormal_v2, is_en_cols = get_v2_datasource_type_from_file(largest_file)

        if datasource_type == DBType.V2_HISTORY:
            data_details = get_df_v2_process_single_file(
                largest_file,
                process_name,
                datasource_type,
                is_abnormal_v2,
            )
        elif datasource_type in [DBType.V2, DBType.V2_MULTI]:
            data_details = get_vertical_df_v2_process_single_file(
                largest_file,
                process_name,
                datasource_type,
                is_abnormal_v2,
                is_en_cols,
            )
        else:
            raise NotImplementedError

        file_data_idx += 1
        if len(data_details) > 0 or file_data_idx >= len(sorted_files):
            file_data_idx = -1

    data_details = data_details[:limit]
    origin_header_names = data_details.columns.tolist()
    header_names, *_ = add_suffix_if_duplicated(origin_header_names)
    dict_column_name = dict(zip(origin_header_names, header_names, strict=False))
    data_details = data_details.rename(columns=dict_column_name)
    if sort_colum:
        sort_column_raw_name = dict_column_name[sort_colum]
        if sort_column_raw_name and sort_column_raw_name in data_details.columns:
            asc = sort_order == 'ASC'
            data_details = data_details.sort_values(by=[sort_column_raw_name], ascending=asc)
    rows = [
        dict(zip(header_names, vals, strict=False))
        for vals in data_details[header_names].to_records(index=False).tolist()
    ]
    cols = [{'name': col} for col in header_names]

    return cols, rows


@MessageAnnouncer.notify_progress(50)
def get_csv_data(csv_detail, sort_colum, sort_order, limit):
    """Load, normalize, sort, and limit records from the latest CSV file."""
    # Preview the latest configured file so table viewer results follow the current data source.
    latest_file = [csv_detail.directory] if csv_detail.is_file_path else get_latest_files(csv_detail.directory)
    latest_file = latest_file[0:1][0]
    csv_delimiter = get_csv_delimiter(csv_detail.delimiter)
    skip_head = csv_detail.skip_head

    # Detect the file encoding before parsing the configured header and data rows.
    _, encoding = detect_file_path_delimiter(
        latest_file,
        csv_delimiter,
        with_encoding=True,
    )

    # TODO: Should we use preview_csv_data for this instead?
    (_, header_names, _, _, data_details, _, encoding, skip_tail, *_) = get_csv_data_from_files(
        [latest_file],
        skip_head=skip_head,
        n_rows=csv_detail.n_rows,
        is_transpose=csv_detail.is_transpose,
        etl_func=csv_detail.etl_func,
        csv_delimiter=csv_delimiter,
        max_records=None,
    )

    # Use unique display names so every duplicate CSV column remains independently addressable.
    header_names, *_ = add_suffix_if_duplicated(header_names)
    df_data = pd.DataFrame(columns=header_names, data=data_details)

    # The table viewer sends the unique display name, which already matches the DataFrame column.
    if sort_colum:
        asc = sort_order == 'ASC'
        df_data = df_data.sort_values(by=[sort_colum], ascending=asc)

    # Apply the preview limit after sorting so the response contains the requested leading rows.
    df_data = df_data.head(limit)
    cols = df_data.columns
    rows = [dict(zip(cols, vals, strict=False)) for vals in df_data[0:limit][cols].to_records(index=False).tolist()]
    cols = [{'name': col} for col in cols]

    return cols, rows


@MessageAnnouncer.notify_progress(50)
def get_sw_data(data_source, table_name, sort_col, sort_order, limit, proc_id):
    cfg_process: CfgProcess = CfgProcess.get_proc_by_id(int(proc_id))
    df_cols, df_rows, _ = get_info_from_db(
        data_source,
        table_name,
        process_factid=cfg_process.process_factid,
        master_type=MasterDBType[cfg_process.master_type] if cfg_process.master_type else None,
        sql_limit=limit,
        # Sort at database level before applying LIMIT.
        sort_column=sort_col,
        sort_order=sort_order,
    )
    header_names, *_ = add_suffix_if_duplicated(df_cols)

    if sort_col:
        dict_column_name = dict(zip(df_cols, header_names, strict=False))
        sort_column_raw_name = dict_column_name[sort_col]
        if sort_column_raw_name and sort_column_raw_name in df_rows.columns:
            asc = sort_order == 'ASC'
            df_rows = df_rows.sort_values(by=[sort_column_raw_name], ascending=asc)

    rows = [
        dict(zip(header_names, vals, strict=False)) for vals in df_rows[header_names].to_records(index=False).tolist()
    ]
    cols = [{'name': col} for col in header_names]
    return cols, rows
