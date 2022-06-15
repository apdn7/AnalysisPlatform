import json

from flask import Blueprint, request, jsonify

from histview2.api.co_occurrence.services import validate_csv_data, calc_csv_graph_data, add_node_coordinate, \
    filter_edge_by_threshold, calc_pareto
from histview2.api.setting_module.services.csv_import import csv_to_df
from histview2.common.common_utils import get_csv_delimiter
from histview2.common.services import http_content
from histview2.common.yaml_utils import *

api_co_occurrence_blueprint = Blueprint(
    'api_co_occurrence',
    __name__,
    url_prefix='/histview2/api/cog'
)


@api_co_occurrence_blueprint.route('/check_file', methods=['POST'])
def check_file():
    try:
        data = request.json.get('url')
        return jsonify({
            'status': 200,
            'url': data,
            'is_exists': os.path.isfile(data) and os.path.exists(data),
            'dir': os.path.dirname(data)
        })
    except Exception:
        # raise
        return jsonify({
            'status': 500,
        })


@api_co_occurrence_blueprint.route('/show_graph', methods=['POST'])
def show_graph():
    from_file = False
    file = request.files.get('file')
    file_path = request.form.get('url')
    if file:
        file_path = file.read()
        from_file = True

    delimiter = request.form.get('delimiter')
    aggregate_by = request.form.get('aggregate_by')
    threshold = request.form.get('threshold') or 100
    layout = request.form.get('layout')
    aggregate_by = AggregateBy(aggregate_by)

    data_src: CfgDataSourceCSV = CfgDataSourceCSV()
    data_src.delimiter = delimiter

    # csv delimiter
    csv_delimiter = get_csv_delimiter(delimiter)

    # read csv file
    data_first_row = 1
    skip_row = 0
    df = csv_to_df(file_path, data_src, [], data_first_row, skip_row,
                   csv_delimiter, default_csv_param={}, from_file=from_file)

    validate_result = validate_csv_data(df)
    if isinstance(validate_result, Exception):
        return validate_result, 200

    # calc pareto data
    pareto = calc_pareto(df)

    # calc_data
    nodes, edges = calc_csv_graph_data(df, aggregate_by, pareto)
    nodes = add_node_coordinate(nodes, layout=layout)
    edges = filter_edge_by_threshold(edges, threshold)

    result = dict(nodes=nodes, edges=edges, pareto=pareto)
    out_dict = json.dumps(result, ensure_ascii=False, default=http_content.json_serial)
    return out_dict, 200
