import timeit

import simplejson
from flask import Blueprint, request

from ap.api.graphical_lasso.services import gen_graphical_lasso
from ap.common.services import http_content
from ap.common.services.form_env import parse_multi_filter_into_one
from ap.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from ap.common.trace_data_log import save_input_data_to_file, EventType, trace_log_params, save_draw_graph_trace

api_gl_blueprint = Blueprint(
    'api_gl',
    __name__,
    url_prefix='/ap/api/gl'
)


@api_gl_blueprint.route('/plot', methods=['POST'])
def graphical_lasso():
    """ [summary]
        Returns:
            [type] -- [description]
        """
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)
    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.GL)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    dic_param = gen_graphical_lasso(dic_param)

    stop = timeit.default_timer()
    dic_param['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    dic_param['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.GL))

    return simplejson.dumps(dic_param, ensure_ascii=False, default=http_content.json_serial, ignore_nan=True)
