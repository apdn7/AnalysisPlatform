from loguru import logger

from histview2.common.common_utils import parse_int_value
from histview2.setting_module.models import make_session, CfgUserSetting, insert_or_update_config
from histview2.setting_module.schemas import CfgUserSettingSchema


def is_local_client(req):
    try:
        client_ip = req.environ.get('X-Forwarded-For') or req.remote_addr
        accepted_ips = ['127.0.0.1', 'localhost']
        if client_ip in accepted_ips:
            return True
    except Exception as ex:
        logger.exception(ex)

    return False


def save_user_settings(request_params):
    with make_session() as meta_session:
        cfg_user_setting = parse_user_setting(request_params)
        insert_or_update_config(meta_session, cfg_user_setting)
        meta_session.commit()
    return True


def parse_user_setting(params):
    setting_id = parse_int_value(params.get('id'))
    title = params.get('title') or ''
    page = params.get('page') or ''
    key = '{}|{}'.format(page, title)  # TODO use page + title for now
    created_by = params.get('created_by') or ''
    priority = parse_int_value(params.get('priority')) or 1
    use_current_time = bool(params.get('use_current_time'))
    description = params.get('description') or ''
    share_info = bool(params.get('share_info'))
    settings = params.get('settings') or '[]'

    cfg_user_setting = CfgUserSetting(**{
        'id': setting_id,
        'key': key,
        'title': title,
        'page': page,
        'created_by': created_by,
        'priority': priority,
        'use_current_time': use_current_time,
        'description': description,
        'share_info': share_info,
        'settings': settings,
    })

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
    return True if user_settings else False
