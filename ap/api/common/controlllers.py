from flask import Blueprint, render_template, request, Response, jsonify

from ap.api.trace_data.services.csv_export import gen_csv_data
from ap.common.services import csv_content
from ap.common.services.request_time_out_handler import api_request_threads
from ap.common.services.form_env import parse_request_params, parse_multi_filter_into_one
from ap.api.common.services.services import update_draw_data_trace_log
from ap.api.common.services.plot_view import gen_graph_plot_view

api_common_blueprint = Blueprint(
    'api_common',
    __name__,
    url_prefix='/ap/api/common'
)


@api_common_blueprint.route('/abort_process', methods=['GET'])
def abort_process():
    """
        Kill process by thread id
    :return: {}
    """
    thread_id = request.args.get('thread_id')
    api_request_threads.append(thread_id)
    return {}, 200


@api_common_blueprint.route('/draw_plot_excuted_time', methods=['GET'])
def save_draw_plot_executed_time():
    """
        update draw chart exe time
    :return: {}
    """
    dataset_id = request.args.get('dataset_id')
    executed_time = request.args.get('executed_time')
    if not dataset_id:
        return {}, 200

    update_draw_data_trace_log(dataset_id, executed_time)

    return {}, 200


@api_common_blueprint.route('/plot_view')
def plot_view():
    dic_form = parse_request_params(request)

    dic_param, stats_table = gen_graph_plot_view(dic_form)

    output_dict = stats_table
    return render_template("plot_view/plot_view.html", **output_dict)


@api_common_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    csv_str = gen_csv_data(dic_param)
    csv_filename = csv_content.gen_csv_fname()

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/csv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response


@api_common_blueprint.route('/tsv_export', methods=['GET'])
def tsv_export():
    """tsv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_param = parse_multi_filter_into_one(dic_form)
    csv_str = gen_csv_data(dic_param, delimiter='\t')
    csv_filename = csv_content.gen_csv_fname("tsv")

    response = Response(csv_str.encode("utf-8-sig"), mimetype="text/tsv",
                        headers={
                            "Content-Disposition": "attachment;filename={}".format(csv_filename),
                        })
    response.charset = "utf-8-sig"

    return response
