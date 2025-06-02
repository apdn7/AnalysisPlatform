import json
import timeit

from flask import Blueprint, current_app, request

from ap.analyze.services.sensor_list import get_sensors_incrementally
from ap.api.analyze.services.pca import calculate_data_size, run_pca
from ap.api.common.services.show_graph_database import get_config_data
from ap.api.common.services.show_graph_services import filter_df, get_data_from_db
from ap.api.trace_data.services.csv_export import (
    make_graph_param,
    split_graph_params,
    to_csv,
)
from ap.common.constants import (
    ACTUAL_RECORD_NUMBER,
    ACTUAL_RECORD_NUMBER_TEST,
    ACTUAL_RECORD_NUMBER_TRAIN,
    ARRAY_PLOTDATA,
    COMMON,
    CYCLE_IDS,
    DATAPOINT_INFO,
    DIC_CAT_FILTERS,
    FILTER_ON_DEMAND,
    PLOTLY_JSON,
    REMOVED_OUTLIER_NAN_TEST,
    REMOVED_OUTLIER_NAN_TRAIN,
    REMOVED_OUTLIERS,
    SHORT_NAMES,
    START_PROC,
    UNIQUE_SERIAL,
    UNIQUE_SERIAL_TEST,
    UNIQUE_SERIAL_TRAIN,
    CSVExtTypes,
    DataExportMode,
)
from ap.common.services.csv_content import zip_file_to_response
from ap.common.services.form_env import (
    bind_dic_param_to_class,
    parse_multi_filter_into_one,
    parse_request_params,
)
from ap.common.services.http_content import orjson_dumps
from ap.common.services.import_export_config_n_data import (
    get_dic_form_from_debug_info,
    set_export_dataset_id_to_dic_param,
)
from ap.common.trace_data_log import (
    EventType,
    save_draw_graph_trace,
    save_input_data_to_file,
    trace_log_params,
)

api_analyze_module_blueprint = Blueprint('api_analyze_module', __name__, url_prefix='/ap/api/analyze')


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
    sample_no = int(sample_no[0]) - 1 if sample_no else 0

    # save dic_form to pickle (for future debug)
    save_input_data_to_file(dic_form, EventType.PCA)

    dic_param = parse_multi_filter_into_one(dic_form)

    # check if we run debug mode (import mode)
    dic_param = get_dic_form_from_debug_info(dic_param)

    # run PCA script
    orig_send_ga_flg = current_app.config.get('IS_SEND_GOOGLE_ANALYTICS')
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param, is_train_data=True)
    dic_data, errors = run_pca(graph_param, dic_param, sample_no)

    if errors:
        output = orjson_dumps({'json_errors': errors})
        return output, 400

    plotly_jsons = dic_data[PLOTLY_JSON]
    data_point_info = dic_data[DATAPOINT_INFO]
    output_dict = plotly_jsons

    unique_serial_test = dic_data.get(UNIQUE_SERIAL_TEST)
    unique_serial_train = dic_data.get(UNIQUE_SERIAL_TRAIN)
    if unique_serial_train is None or unique_serial_test is None:
        unique_serial = None
    else:
        unique_serial = unique_serial_test + unique_serial_train

    output_dict.update(
        {
            DATAPOINT_INFO: data_point_info,
            SHORT_NAMES: dic_data.get(SHORT_NAMES),
            UNIQUE_SERIAL_TRAIN: dic_data.get(UNIQUE_SERIAL_TRAIN),
            UNIQUE_SERIAL_TEST: dic_data.get(UNIQUE_SERIAL_TEST),
            ACTUAL_RECORD_NUMBER_TRAIN: dic_data.get(ACTUAL_RECORD_NUMBER_TRAIN),
            ACTUAL_RECORD_NUMBER_TEST: dic_data.get(ACTUAL_RECORD_NUMBER_TEST),
            ACTUAL_RECORD_NUMBER: dic_data.get(ACTUAL_RECORD_NUMBER_TRAIN, 0)
            + dic_data.get(ACTUAL_RECORD_NUMBER_TEST, 0),
            UNIQUE_SERIAL: unique_serial,
            REMOVED_OUTLIER_NAN_TRAIN: dic_data.get(REMOVED_OUTLIER_NAN_TRAIN),
            REMOVED_OUTLIER_NAN_TEST: dic_data.get(REMOVED_OUTLIER_NAN_TEST),
            ARRAY_PLOTDATA: dic_data.get(ARRAY_PLOTDATA),
            CYCLE_IDS: dic_data.get(CYCLE_IDS),
            COMMON: dic_param,
            FILTER_ON_DEMAND: dic_data.get(FILTER_ON_DEMAND),
            REMOVED_OUTLIERS: dic_data.get(REMOVED_OUTLIERS, None),
        },
    )

    # send Google Analytics changed flag
    if orig_send_ga_flg and not current_app.config.get('IS_SEND_GOOGLE_ANALYTICS'):
        output_dict.update({'is_send_ga_off': True})

    calculate_data_size(output_dict)

    stop = timeit.default_timer()
    output_dict['backend_time'] = stop - start

    # export mode ( output for export mode )
    set_export_dataset_id_to_dic_param(dic_param)

    output_dict['dataset_id'] = save_draw_graph_trace(vals=trace_log_params(EventType.PCA))

    output_dict = orjson_dumps(output_dict)
    return output_dict, 200


@api_analyze_module_blueprint.route('/sensor', methods=['GET'])
def pca():
    get_sensors_incrementally()
    output_dict = orjson_dumps({})
    return output_dict, 200


@api_analyze_module_blueprint.route('/data_export/<export_type>', methods=['GET'])
def data_export(export_type):
    """csv export

    Returns:
        [type] -- [description]
    """
    dic_form = parse_request_params(request)
    dic_params = parse_multi_filter_into_one(dic_form)
    dic_proc_cfgs, trace_graph, dic_card_orders = get_config_data()
    dic_params = split_graph_params(dic_params)

    csv_data = []
    csv_list_name = []
    for i, dic_param in enumerate(dic_params):
        graph_param = bind_dic_param_to_class(dic_proc_cfgs, trace_graph, dic_card_orders, dic_param)
        graph_param, client_timezone = make_graph_param(graph_param, dic_param)
        # get data from database
        df, *_ = get_data_from_db(graph_param)
        # if export_type = plot -> use filter
        if dic_param[COMMON]['export_from'] == DataExportMode.PLOT.value:
            dic_cat_filters = (
                json.loads(dic_param[COMMON].get(DIC_CAT_FILTERS, {}))
                if isinstance(dic_param[COMMON].get(DIC_CAT_FILTERS, {}), str)
                else dic_param[COMMON].get(DIC_CAT_FILTERS, {})
            )
            df = filter_df(graph_param.dic_proc_cfgs, df, dic_cat_filters)
        csv_name = 'train_data' if not i else 'test_data'
        csv_list_name.append('{}.{}'.format(csv_name, CSVExtTypes.CSV.value))
        csv_df = to_csv(df, graph_param, client_timezone=client_timezone)
        csv_data.append(csv_df)

    response = zip_file_to_response(csv_data, csv_list_name, export_type=export_type)
    return response
