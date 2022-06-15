import timeit

import simplejson
from flask import Blueprint, request, jsonify

from histview2.analyze.services.sensor_list import get_sensors_incrementally
from histview2.api.analyze.services.pca import run_pca, calculate_data_size
from histview2.common.constants import *
from histview2.common.services.form_env import parse_multi_filter_into_one
from histview2.common.services.http_content import json_serial
from histview2.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from histview2.common.trace_data_log import is_send_google_analytics, save_input_data_to_file, EventType

api_analyze_module_blueprint = Blueprint(
    'api_analyze_module',
    __name__,
    url_prefix='/histview2/api/analyze'
)


@api_analyze_module_blueprint.route('/pca', methods=['POST'])
def pca_modelling():
    start = timeit.default_timer()
    dic_form = request.form.to_dict(flat=False)

    if not dic_form.get(START_PROC, None):
        if dic_form.get('end_proc1'):
            dic_form[START_PROC] = dic_form.get('end_proc1')
        else:
            return

    sample_no = dic_form.get('sampleNo')
    if sample_no:
        sample_no = int(sample_no[0]) - 1
    else:
        sample_no = 0

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.PCA)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    # run PCA script
    orig_send_ga_flg = is_send_google_analytics
    dic_data, errors = run_pca(dic_param, sample_no)

    if errors:
        output = simplejson.dumps(dict(json_errors=errors), ensure_ascii=False, default=json_serial)
        return jsonify(output), 400

    plotly_jsons = dic_data[PLOTLY_JSON]
    data_point_info = dic_data[DATAPOINT_INFO]
    output_dict = plotly_jsons

    output_dict.update({
        DATAPOINT_INFO: data_point_info,
        SHORT_NAMES: dic_data.get(SHORT_NAMES),
        IS_RES_LIMITED_TRAIN: dic_data.get(IS_RES_LIMITED_TRAIN),
        IS_RES_LIMITED_TEST: dic_data.get(IS_RES_LIMITED_TEST),
        ACTUAL_RECORD_NUMBER_TRAIN: dic_data.get(ACTUAL_RECORD_NUMBER_TRAIN),
        ACTUAL_RECORD_NUMBER_TEST: dic_data.get(ACTUAL_RECORD_NUMBER_TEST),
        REMOVED_OUTLIER_NAN_TRAIN: dic_data.get(REMOVED_OUTLIER_NAN_TRAIN),
        REMOVED_OUTLIER_NAN_TEST: dic_data.get(REMOVED_OUTLIER_NAN_TEST),
    })

    # send google analytics changed flag
    if orig_send_ga_flg and not is_send_google_analytics:
        output_dict.update({'is_send_ga_off': True})

    calculate_data_size(output_dict)

    stop = timeit.default_timer()
    output_dict['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    output_dict = simplejson.dumps(output_dict, ensure_ascii=False, default=json_serial, ignore_nan=True)
    return output_dict, 200


@api_analyze_module_blueprint.route('/sensor', methods=['GET'])
def pca():
    get_sensors_incrementally()
    output_dict = simplejson.dumps({}, ensure_ascii=False, default=json_serial, ignore_nan=True)
    return output_dict, 200
