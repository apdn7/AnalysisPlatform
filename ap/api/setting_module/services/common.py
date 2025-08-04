import json
import logging
from typing import Any
from zoneinfo import ZoneInfo

from dateutil import parser

from ap.common.common_utils import parse_int_value
from ap.common.constants import DATETIME_PICKER, DATETIME_RANGE_PICKER, EN_DASH
from ap.setting_module.models import CfgUserSetting, insert_or_update_config, make_session
from ap.setting_module.schemas import CfgUserSettingSchema

logger = logging.getLogger(__name__)


def is_local_client(req):
    try:
        client_ip = req.environ.get('X-Forwarded-For') or req.remote_addr
        accepted_ips = ['127.0.0.1', 'localhost']
        if client_ip in accepted_ips:
            return True
    except Exception as ex:
        logger.exception(ex)

    return False


def save_user_settings(request_params, exclude_columns=None):
    with make_session() as meta_session:
        cfg_user_setting = parse_user_setting(request_params)
        new_setting = insert_or_update_config(meta_session, cfg_user_setting, exclude_columns=exclude_columns)
        meta_session.commit()
    return new_setting


def parse_user_setting(params):
    setting_id = parse_int_value(params.get('id'))
    title = params.get('title') or ''
    page = params.get('page') or ''
    key = '{}|{}'.format(page, title)  # TODO use page + title for now
    created_by = params.get('created_by') or ''
    priority = parse_int_value(params.get('priority', 0))
    use_current_time = bool(params.get('use_current_time'))
    description = params.get('description') or ''
    share_info = bool(params.get('share_info'))
    save_graph_settings = bool(params.get('save_graph_settings'))
    settings = params.get('settings') or '[]'
    settings = convert_datetime_from_local_to_utc(settings)

    cfg_user_setting = CfgUserSetting(
        **{
            'id': setting_id,
            'key': key,
            'title': title,
            'page': page,
            'created_by': created_by,
            'priority': priority,
            'use_current_time': use_current_time,
            'description': description,
            'share_info': share_info,
            'save_graph_settings': save_graph_settings,
            'settings': settings,
        },
    )

    return cfg_user_setting


def get_all_user_settings():
    user_setting_schema = CfgUserSettingSchema(exclude=[CfgUserSetting.settings.key])
    user_settings = CfgUserSetting.get_all() or []
    # TODO push current page setting to top
    return [user_setting_schema.dump(user_setting) for user_setting in user_settings]


def get_setting(setting_id):
    user_setting_schema = CfgUserSettingSchema()
    user_setting = CfgUserSetting.get_by_id(setting_id) or []
    # TODO push current page setting to top
    return user_setting_schema.dump(user_setting)


def get_page_top_setting(page):
    user_setting_schema = CfgUserSettingSchema()
    user_setting = CfgUserSetting.get_top(page) or []
    return user_setting_schema.dump(user_setting)


def delete_user_setting_by_id(setting_id):
    with make_session() as mss:
        CfgUserSetting.delete_by_id(mss, setting_id)


def is_title_exist(title):
    user_settings = CfgUserSetting.get_by_title(title)
    return bool(user_settings)


def get_datetime_val(datetime_col):
    """
    Gets a random datetime value support to convert UTC
    :return:
    """
    # Check one by one until get well-formatted datetime string
    valid_datetime_idx = datetime_col.first_valid_index()
    datetime_val = datetime_col.loc[valid_datetime_idx] if valid_datetime_idx is not None else None
    return datetime_val


def convert_datetime_from_local_to_utc(settings):
    settings = json.loads(settings)
    timezone = settings.get('timezone', '')
    if not timezone:
        return settings
    form_settings: list[Any] = settings[next(iter(settings))]
    for form_setting in form_settings:
        key_name = form_setting['name'] if 'name' in form_setting else ''
        if key_name and key_name in [DATETIME_RANGE_PICKER, DATETIME_PICKER]:
            time_val = form_setting['value']
            form_setting['value'] = convert_local_to_utc_with_en_dash_full_size(time_val, timezone)

    return json.dumps(settings)


def convert_local_to_utc_with_en_dash_full_size(datetime_value, timezone):
    utc_zone = ZoneInfo('UTC')
    dtsr = '%Y-%m-%dT%H:%M:%SZ'
    timezone = ZoneInfo(timezone)
    if EN_DASH in datetime_value:
        [start_date, end_date] = datetime_value.split(EN_DASH)
        # check valid datetime only to convert
        if len(start_date) > 16 and len(end_date) > 16:
            start_date = parser.parse(start_date).replace(tzinfo=timezone)

            start_date_to_utc = start_date.astimezone(utc_zone).strftime(dtsr)
            end_date = parser.parse(end_date).replace(tzinfo=timezone)
            end_date_to_utc = end_date.astimezone(utc_zone).strftime(dtsr)
            return f'{start_date_to_utc} {EN_DASH} {end_date_to_utc}'
    else:
        start_date = parser.parse(datetime_value).replace(tzinfo=timezone)

        start_date_to_utc = start_date.astimezone(utc_zone).strftime(dtsr)
        return f'{start_date_to_utc}'

    return datetime_value
