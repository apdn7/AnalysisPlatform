import json
import logging
from datetime import datetime

from flask import Blueprint, Response, redirect, request

from ap.api.external_api.services import (
    ExternalErrorMessage,
    Validation,
    cast_datetime_from_query_string,
    get_end_procs_by_cols,
    get_from_request_data_with_id,
    get_selected_columns_from_trace_data_form,
    get_values_by_parameter_name,
)
from ap.api.setting_module.services.common import save_user_settings
from ap.common.common_utils import API_DATETIME_FORMAT
from ap.common.constants import (
    BOOKMARK_DESCRIPTION,
    BOOKMARK_ID,
    BOOKMARK_TITLE,
    BOOKMARKS,
    CAT_EXP_BOX,
    CATE_PROCS,
    CHECKED,
    COLUMNS,
    CREATED_BY,
    DIC_CAT_FILTERS,
    DIV,
    END_DATE,
    END_DATE_ID,
    END_DATETIME,
    END_TIME_ID,
    END_TM,
    FACET,
    FILTER,
    FIRST_END_PROC,
    FUNCTION,
    GET02_CATE_SELECT,
    LATEST,
    OBJ_VAR,
    OBJECTIVE,
    OD_FILTER,
    OPTION_ID,
    PRIORITY,
    PROCESS_ID,
    PROCESSES,
    RADIO_DEFAULT_INTERVAL,
    RADIO_RECENT_INTERVAL,
    RECENT_TIME_INTERVAL,
    REQ_ID,
    REQUEST_PARAMS,
    SAVE_DATETIME,
    SAVE_GRAPH_SETTINGS,
    START_DATE,
    START_DATE_ID,
    START_DATETIME,
    START_TIME_ID,
    START_TM,
    TRACE_DATA_FORM,
    VALUE,
    PagePath,
)
from ap.common.services.api_exceptions import APIError
from ap.common.services.http_content import json_dumps
from ap.setting_module.models import (
    CfgOption,
    CfgProcess,
    CfgProcessColumn,
    CfgRequest,
    CfgUserSetting,
    make_session,
)
from ap.setting_module.schemas import (
    CfgOptionSchema,
    CfgUserSettingSchema,
    ProcessColumnExternalAPISchema,
    ProcessSchema,
)

logger = logging.getLogger(__name__)

external_api_v1_blueprint = Blueprint('external_api', __name__, url_prefix='/ap/api/v1')


@external_api_v1_blueprint.errorhandler(Exception)
def handler_api_error(e: Exception):
    if isinstance(e, APIError):
        return e.response()
    msg, status = ExternalErrorMessage.internal_error(e)
    return APIError(status_code=status, error_msg=msg).response()


@external_api_v1_blueprint.route('/bookmarks', methods=['GET'])
def get_list_of_bookmarks():
    """
        get list bookmarks
    :return: list of bookmarks
    """

    bookmarks = CfgUserSetting.get_bookmarks()

    user_setting_schema = CfgUserSettingSchema(many=True)
    bookmarks = user_setting_schema.dump(bookmarks)

    for bookmark in bookmarks:
        functions = bookmark[FUNCTION].split('/')
        bookmark[FUNCTION] = functions[-1]

    return Response(json_dumps({BOOKMARKS: bookmarks}), mimetype='application/json')


@external_api_v1_blueprint.route('/processes', methods=['GET'])
def get_list_of_processes():
    """

    :return:
    """

    processes = CfgProcess.get_list_of_process()
    process_schema = ProcessSchema(many=True)
    processes = process_schema.dump(processes)

    return Response(json_dumps({PROCESSES: processes}), mimetype='application/json')


@external_api_v1_blueprint.route('/columns', methods=['GET'])
def get_list_columns_of_processes():
    """

    :return:
    """
    validation = Validation(request)
    validation.columns_of_processes().validate()

    process_ids_str = request.args.get(PROCESS_ID)
    processes = []
    if process_ids_str:
        process_ids = process_ids_str.split(',')
        for proc_id in process_ids:
            columns = CfgProcessColumn.get_all_columns(proc_id)
            columns = ProcessColumnExternalAPISchema(many=True).dump(columns)
            processes.append({'id': proc_id, COLUMNS: columns})

    return Response(json_dumps({PROCESSES: processes}), mimetype='application/json')


@external_api_v1_blueprint.route('/bookmark', methods=['POST'])
def save_bookmark():
    """
        Save a bookmark with parameters and options
    :return:
    """

    validation = Validation(request)
    validation.save_bookmark().validate()

    data = json.loads(request.data)

    user_request = CfgRequest.get_by_req_id(data.get('req_id'))
    request_params = json.loads(json.loads(user_request.params).get(REQUEST_PARAMS))
    settings = request_params.get('settings')
    setting_list = settings.get(TRACE_DATA_FORM)
    function = request_params.get(FUNCTION).upper()

    if data.get(OPTION_ID):
        options = CfgOption.get_option(data.get(OPTION_ID)).option
        options = json.loads(options)
        settings['filter'] = {
            DIC_CAT_FILTERS: options.get(OD_FILTER),
        }

    # save_latest is 1 when empty
    save_latest = data.get('save_latest', 1)
    # when save_latest is 0
    if not save_latest:
        default_radio_index = get_from_request_data_with_id(setting_list, RADIO_DEFAULT_INTERVAL)
        recent_radio_index = get_from_request_data_with_id(setting_list, RADIO_RECENT_INTERVAL)
        settings[TRACE_DATA_FORM][default_radio_index][CHECKED] = True
        settings[TRACE_DATA_FORM][recent_radio_index][CHECKED] = False
    bookmark_title = data.get(BOOKMARK_TITLE)
    if not bookmark_title:
        try:
            end_proc_id = settings[TRACE_DATA_FORM][get_from_request_data_with_id(setting_list, FIRST_END_PROC)][VALUE]
            end_proc_name = CfgProcess.get_proc_by_id(end_proc_id).name
            start_date = settings[TRACE_DATA_FORM][get_from_request_data_with_id(setting_list, START_DATE_ID)][VALUE]
            start_time = ''.join(
                settings[TRACE_DATA_FORM][get_from_request_data_with_id(setting_list, START_TIME_ID)][VALUE].split(':'),
            )
            end_date = settings[TRACE_DATA_FORM][get_from_request_data_with_id(setting_list, END_DATE_ID)][VALUE]
            end_time = ''.join(
                settings[TRACE_DATA_FORM][get_from_request_data_with_id(setting_list, END_TIME_ID)][VALUE].split(':'),
            )
            bookmark_title = f'{function}_{end_proc_name}_{start_date}-{start_time}_{end_date}-{end_time}'
        except Exception:
            bookmark_title = f'{function}_{datetime.now().strftime(API_DATETIME_FORMAT)}'

    setting = CfgUserSettingSchema().dump(
        {
            'title': bookmark_title,
            'page': f'/{PagePath[function].value}',
            'created_by': data.get(CREATED_BY, ''),
            'priority': data.get(PRIORITY, 0),
            'use_current_time': data.get(SAVE_DATETIME, 1),
            'share_info': 1,
            'description': data.get(BOOKMARK_DESCRIPTION, ''),
            'save_graph_settings': data.get(SAVE_GRAPH_SETTINGS, 1),
            'settings': json_dumps(settings) or '[]',
        },
    )

    new_setting = save_user_settings(setting)

    return Response(json_dumps({'bookmark_id': new_setting.id}), mimetype='application/json')


@external_api_v1_blueprint.route('/bookmark', methods=['GET'])
def show_graph_with_bookmark():
    """
        Open a show graph page with specify bookmark_id
    :return:
    """
    validation = Validation(request)
    validation.bookmark().validate()

    host_url = request.host_url
    req_params = request.args
    bookmark_id = req_params.get(BOOKMARK_ID)

    # get target page from bookmark
    page = CfgUserSetting.get_page_by_bookmark(int(bookmark_id))

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    target_url = f'{host_url[:-1]}{page}?{request_string}'

    return redirect(target_url)


@external_api_v1_blueprint.route('/options', methods=['POST'])
def send_a_list_options():
    """

    :return: option_id, req_id
    """
    data = json.loads(request.data)
    req_id = data.get('req_id')

    Validation(request).send_a_list_options().validate()

    try:
        # save odf_filter and return
        cfg_option = CfgOption(option=request.data, req_id=req_id)
        with make_session() as meta_session:
            cfg_option = meta_session.merge(cfg_option)
        return Response(
            json_dumps({'req_id': req_id, 'option_id': cfg_option.id}),
            mimetype='application/json',
        )
    except Exception as e:
        logger.exception(e)
        return Response(json_dumps({}), mimetype='application/json')


@external_api_v1_blueprint.route('/option', methods=['GET'])
def get_option_by_id():
    option_id = request.args.get(OPTION_ID)
    if option_id:
        option = CfgOption.get_option(option_id)
        option_schema = CfgOptionSchema()
        option = option_schema.dump(option)
        return Response(json_dumps({'option': option['option']}), mimetype='application/json')

    return Response(json_dumps({}), mimetype='application/json')


@external_api_v1_blueprint.route('/options', methods=['GET'])
def get_list_of_options():
    """
    Get a list of items for options
    :return:
    """

    # validate req_id
    Validation(request).get_list_options().validate()

    req_id = request.args.get(REQ_ID)
    odf = CfgRequest.get_odf_by_req_id(req_id)
    if odf:
        odf = json.loads(odf)
        return Response(
            json_dumps({'req_id': req_id, 'od_filter': {'columns': odf}}),
            mimetype='application/json',
        )

    return Response(json_dumps({}), mimetype='application/json')


@external_api_v1_blueprint.route('/dn7', methods=['GET'])
def open_a_page():
    """
    Open a page (with minimum parameters)
    :return:
    """

    Validation(request).dn7().validate()

    function = request.args.get(FUNCTION)
    columns = request.args.get(COLUMNS, '').split(',')

    page = PagePath[function.upper()].value

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    div = request.args.get(DIV, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + div + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{page}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/register/datafile', methods=['GET'])
def register_datafile():
    Validation(request).register_by_file().validate()
    page = PagePath.REGISTER_DATA_FILE.value
    host_url = request.host_url
    request_string = request.query_string.decode('utf-8')
    target_url = f'{host_url}{page}?{request_string}&load_gui_from_url=1'
    return redirect(target_url)


@external_api_v1_blueprint.route('/params', methods=['GET'])
def get_param_by_req_id():
    Validation(request).get_params().validate()
    req_params = request.args

    req_id = req_params.get(REQ_ID, None)

    cfg_request = CfgRequest.get_by_req_id(req_id)
    option_ids = CfgOption.get_option_ids(req_id)
    cfg_request_params = json.loads(cfg_request.params)

    bookmark_id = cfg_request_params.get('bookmark_id', None)
    start_datetime = ''
    end_datetime = ''
    if cfg_request_params.get(START_DATE) and cfg_request_params.get(START_TM):
        start_datetime = f'{cfg_request_params.get(START_DATE)}T{cfg_request_params.get(START_TM)}'
    if cfg_request_params.get(END_DATE) and cfg_request_params.get(END_TM):
        end_datetime = f'{cfg_request_params.get(END_DATE)}T{cfg_request_params.get(END_TM)}'
    # no bookmark id found in params, that means the request was sent to /dn7
    # TODO: May want to change the way form data is sent from frontend so we don't need to parse into integer
    if not bookmark_id:
        setting_params = json.loads(cfg_request_params.get(REQUEST_PARAMS))
        trace_data_form = setting_params['settings'].get(TRACE_DATA_FORM)
        filters = []
        if cfg_request_params.get(CATE_PROCS):
            for proc in cfg_request_params[CATE_PROCS]:
                if proc.get(GET02_CATE_SELECT) and isinstance(proc.get(GET02_CATE_SELECT), list):
                    for col in proc.get(GET02_CATE_SELECT):
                        filters.append(int(col))
                elif proc.get(GET02_CATE_SELECT) and not isinstance(proc.get(GET02_CATE_SELECT), list):
                    filters.append(int(proc.get(GET02_CATE_SELECT)))
        obj_var = cfg_request_params.get(OBJ_VAR, [])
        objective = None
        if len(obj_var):
            objective = int(obj_var[0])
        res = {
            REQ_ID: req_id,
            FUNCTION: setting_params.get(FUNCTION),
            # Different graphs return different keys for columns selected, get columns from UI checkboxes for now
            COLUMNS: get_selected_columns_from_trace_data_form(trace_data_form),
            FACET: get_values_by_parameter_name(cfg_request_params, CAT_EXP_BOX, convert_to_int=True),
            FILTER: filters,
            DIV: int(cfg_request_params.get(DIV)) if cfg_request_params.get(DIV) else None,
            START_DATETIME: start_datetime,
            END_DATETIME: end_datetime,
            LATEST: cfg_request_params.get(RECENT_TIME_INTERVAL),
            OBJECTIVE: objective,
            OPTION_ID: option_ids,
        }
    else:
        res = {
            REQ_ID: req_id,
            BOOKMARK_ID: bookmark_id,
            OPTION_ID: option_ids,
            START_DATETIME: start_datetime,
            END_DATETIME: end_datetime,
            LATEST: cfg_request_params.get(RECENT_TIME_INTERVAL),
        }
    res = {k: v for k, v in res.items() if v}
    return res


@external_api_v1_blueprint.route('/fpp', methods=['GET'])
def open_fpp():
    """
    Open FPP
    """

    Validation(request).fpp().validate()

    host_url = request.host_url

    columns = request.args.get(COLUMNS, '').split(',')
    facet = request.args.get(FACET, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.FPP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/skd', methods=['GET'])
def open_skd():
    """
    Open SkD
    """

    Validation(request).skd().validate()

    host_url = request.host_url

    columns = request.args.get(COLUMNS, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.SKD.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/rlp', methods=['GET'])
def open_rlp():
    """
    Open RLP
    """

    Validation(request).rlp().validate()

    columns = request.args.get(COLUMNS, '').split(',')

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    div = request.args.get(DIV, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + div + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.RLP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/chm', methods=['GET'])
def open_chm():
    """
    Open CHM
    """

    Validation(request).chm().validate()

    columns = request.args.get(COLUMNS, '').split(',')

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.CHM.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/msp', methods=['GET'])
def open_msp():
    """
    Open msp
    """

    Validation(request).msp().validate()

    columns = request.args.get(COLUMNS, '').split(',')

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.MSP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/pcp', methods=['GET'])
def open_pcp():
    """
    Open pcp
    """

    Validation(request).pcp().validate()

    host_url = request.host_url

    columns = request.args.get(COLUMNS, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.PCP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/scp', methods=['GET'])
def open_scp():
    """
    Open scp
    """

    Validation(request).scp().validate()

    host_url = request.host_url

    columns = request.args.get(COLUMNS, '').split(',')
    facet = request.args.get(FACET, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.SCP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/agp', methods=['GET'])
def open_agp():
    """
    Open AgP
    """

    Validation(request).agp().validate()

    columns = request.args.get(COLUMNS, '').split(',')

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    div = request.args.get(DIV, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + div + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.AGP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)


@external_api_v1_blueprint.route('/stp', methods=['GET'])
def open_stp():
    """
    Open StP
    """

    Validation(request).stp().validate()

    columns = request.args.get(COLUMNS, '').split(',')

    host_url = request.host_url

    facet = request.args.get(FACET, '').split(',')
    filter_cols = request.args.get(FILTER, '').split(',')

    columns = columns + facet + filter_cols

    # get end procs from columns
    end_procs = get_end_procs_by_cols(columns)

    request_string = cast_datetime_from_query_string(request.query_string.decode('utf-8'))
    # get target page from bookmark
    target_url = f'{host_url}{PagePath.STP.value}?{request_string}&end_procs={end_procs}&load_gui_from_url=1'

    return redirect(target_url)
