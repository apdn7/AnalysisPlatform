import io
import json
import timeit
from zipfile import ZipFile

import simplejson
from flask import Blueprint, request, jsonify, Response

from ap.analyze.services.sensor_list import get_sensors_incrementally
from ap.api.analyze.services.pca import run_pca, calculate_data_size
from ap.api.trace_data.services.csv_export import split_graph_params, gen_csv_data, make_graph_param, to_csv
from ap.api.trace_data.services.time_series_chart import get_data_from_db, filter_df
from ap.common.constants import *
from ap.common.services import csv_content
from ap.common.services.form_env import parse_multi_filter_into_one, parse_request_params
from ap.common.services.http_content import json_serial
from ap.common.services.import_export_config_n_data import get_dic_form_from_debug_info, \
    set_export_dataset_id_to_dic_param
from ap.common.trace_data_log import is_send_google_analytics, save_input_data_to_file, EventType, \
    save_draw_graph_trace, trace_log_params

api_analyze_module_blueprint = Blueprint(
    'api_analyze_module',
    __name__,
    url_prefix='/ap/api/analyze'
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

    unique_serial_test = dic_data.get(UNIQUE_SERIAL_TEST)
    unique_serial_train = dic_data.get(UNIQUE_SERIAL_TRAIN)
    if unique_serial_train is None or unique_serial_test is None:
        unique_serial = None
    else:
        unique_serial = unique_serial_test + unique_serial_train

    output_dict.update({
        DATAPOINT_INFO: data_point_info,
        SHORT_NAMES: dic_data.get(SHORT_NAMES),
        UNIQUE_SERIAL_TRAIN: dic_data.get(UNIQUE_SERIAL_TRAIN),
        UNIQUE_SERIAL_TEST: dic_data.get(UNIQUE_SERIAL_TEST),
        ACTUAL_RECORD_NUMBER_TRAIN: dic_data.get(ACTUAL_RECORD_NUMBER_TRAIN),
        ACTUAL_RECORD_NUMBER_TEST: dic_data.get(ACTUAL_RECORD_NUMBER_TEST),
        ACTUAL_RECORD_NUMBER: dic_data.get(ACTUAL_RECORD_NUMBER_TRAIN, 0) + dic_data.get(ACTUAL_RECORD_NUMBER_TEST, 0),
        UNIQUE_SERIAL: unique_serial,
        REMOVED_OUTLIER_NAN_TRAIN: dic_data.get(REMOVED_OUTLIER_NAN_TRAIN),
        REMOVED_OUTLIER_NAN_TEST: dic_data.get(REMOVED_OUTLIER_NAN_TEST),
        ARRAY_PLOTDATA: dic_data.get(ARRAY_PLOTDATA),
        CYCLE_IDS: dic_data.get(CYCLE_IDS),
        COMMON: dic_param
    })

    # send google analytics changed flag
    if orig_send_ga_flg and not is_send_google_analytics:
        output_dict.update({'is_send_ga_off': True})

    calculate_data_size(output_dict)

    stop = timeit.default_timer()
    output_dict['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    output_dict['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.PCA))

    output_dict = simplejson.dumps(output_dict, ensure_ascii=False, default=json_serial, ignore_nan=True)
    return output_dict, 200


@api_analyze_module_blueprint.route('/sensor', methods=['GET'])
def pca():
    get_sensors_incrementally()
    output_dict = simplejson.dumps({}, ensure_ascii=False, default=json_serial, ignore_nan=True)
    return output_dict, 200


@api_analyze_module_blueprint.route('/csv_export', methods=['GET'])
def csv_export():
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_params = parse_multi_filter_into_one(dic_form)

    dic_params = split_graph_params(dic_params)

    csv_data = []
    csv_list_name = []
    for i, dic_param in enumerate(dic_params):
        graph_param, dic_proc_cfgs, client_timezone = make_graph_param(dic_param)
        # get data from database
        df, *_ = get_data_from_db(graph_param)
        # if export_type = plot -> use filter
        if dic_param[COMMON]['export_from'] == 'plot':
            dic_cat_filters = json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {})) if isinstance(
                dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str) else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
            df = filter_df(df, dic_cat_filters)
        csv_name = 'train_data' if not i else 'test_data'
        csv_list_name.append('{}.{}'.format(csv_name, 'csv'))
        client_tz = dic_param[COMMON][CLIENT_TIMEZONE]
        csv_df = to_csv(df, dic_proc_cfgs, graph_param, client_timezone=client_timezone)
        csv_data.append(csv_df)

    if len(csv_data) == 1:
        csv_data = csv_data[0]
        csv_filename = csv_content.gen_csv_fname()
        response = Response(csv_data.encode("utf-8-sig"), mimetype="text/csv",
                            headers={
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
    else:
        csv_filename = csv_content.gen_csv_fname('zip')
        outfile = io.BytesIO()
        with ZipFile(outfile, 'w') as zf:
            for name, data in zip(csv_list_name, csv_data):
                zf.writestr(name, data)

        zip_dat = outfile.getvalue()
        response = Response(zip_dat, mimetype="application/octet-stream",
                            headers={
                                "Content-Type": "application/octet-stream",
                                "Content-Disposition": "attachment;filename={}".format(csv_filename),
                            })
    response.charset = "utf-8-sig"
    return response
