import json
import timeit

from flask import Blueprint, request

from ap.api.common.services.show_graph_jump_function import get_graph_context_param
from ap.api.multi_axis_plot.services import (
    MAP_DATA_POINT_NTH,
    MAP_DATA_POINT_SHOW_LABELS,
    MAP_DATA_POINT_WINDOW_SIZE,
    gen_map_data,
)
from ap.common.services.http_content import orjson_dumps
from ap.common.trace_data_log import EventType

api_map_blueprint = Blueprint('api_map', __name__, url_prefix='/ap/api/map')


@api_map_blueprint.route('/plot', methods=['POST'])
def map_tracing():
    """[summary]
    Returns:
        [type] -- [description]
    """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    dic_form['layout'] = json.loads(request.form.get('layout', '{}'))
    graph_context = get_graph_context_param(dic_form, EventType.MAP)
    for key in (MAP_DATA_POINT_NTH, MAP_DATA_POINT_WINDOW_SIZE, MAP_DATA_POINT_SHOW_LABELS):
        if key in dic_form:
            graph_context.dic_param[key] = dic_form[key]

    data = gen_map_data(graph_context.graph_param, graph_context.dic_param, graph_context.df)

    stop = timeit.default_timer()
    data['backend_time'] = stop - start
    return orjson_dumps(data), 200
