import json
import re
from typing import List

from histview2.common.constants import USER_SETTING_VERSION, DataTypeEncode, EN_DASH


def get_setting_item_by_name(settings, key_name):
    setting_items = [item for item in settings if 'name' in item and item['name'] == key_name]
    return setting_items[0] if len(setting_items) > 0 else None


def convert_user_setting():
    """
    Convert user setting from old version
    :return: None
    """
    try:
        print('------------CONVERT USER SETTING VERSION: START  ------------')
        from histview2.setting_module.models import make_session, CfgUserSetting, CfgProcessColumn

        except_key_name = ['All', '']
        apply_data_types = ['TEXT', 'INT']
        with make_session() as meta_session:
            user_settings: List[CfgUserSetting] = meta_session.query(CfgUserSetting).all()

            update_settings = []
            for user_setting in user_settings:
                settings = json.loads(user_setting.settings)
                update_setting = user_setting  # CfgUserSetting model

                if 'version' not in settings or settings['version'] < USER_SETTING_VERSION:
                    # find form-keys from setting
                    form_keys = [key for key in list(settings.keys()) if key != 'version']
                    setting_forms = {
                        'version': USER_SETTING_VERSION
                    }
                    for form_key in form_keys:
                        setting_forms[form_key] = []
                        for setting_item in settings[form_key]:
                            update_setting_item = setting_item
                            if 'name' in setting_item:
                                # check datatype
                                if setting_item['name'].startswith('GET02_VALS_SELECT') and \
                                        setting_item['value'] not in except_key_name:
                                    variable_id = setting_item['value']
                                    data_type_name = 'dataType-{}'.format(variable_id)
                                    has_data_type = get_setting_item_by_name(settings[form_key], data_type_name)

                                    setting_forms[form_key].append(setting_item)
                                    if not has_data_type:
                                        # find sensor
                                        variable = meta_session.query(CfgProcessColumn).get(variable_id)
                                        # Add data type for sensor Str and Int
                                        if variable and variable.data_type in apply_data_types:
                                            data_type_item = {
                                                'id': data_type_name,
                                                'name': '',
                                                'value': DataTypeEncode[variable.data_type].value,
                                                'type': 'text'
                                            }
                                            setting_forms[form_key].append(data_type_item)

                                # update autoupdateinterval
                                if setting_item['name'] == 'autoUpdateInterval':
                                    # setting_forms[form_key].append({
                                    #     'id': 'autoUpdateInterval',
                                    #     'name': 'autoUpdateInterval',
                                    #     'value': '0',
                                    #     'type': 'checkbox',
                                    #     'checked': True if setting_item['value'] == '1' else False,
                                    # })
                                    update_setting_item = {
                                        'id': 'autoUpdateInterval',
                                        'name': 'autoUpdateInterval',
                                        'value': '0',
                                        'type': 'checkbox',
                                        'checked': True if setting_item['value'] == '1' else False,
                                    }

                                # update showScatterPlotSelect
                                if setting_item['name'] == 'showScatterPlotSelect':
                                    # setting_forms[form_key].append({
                                    #     'id': 'showScatterPlotSelect',
                                    #     'name': 'showScatterPlotSelect',
                                    #     'value': '0',
                                    #     'type': 'checkbox',
                                    #     'checked': True if setting_item['value'] == '1' else False,
                                    # })
                                    update_setting_item = {
                                        'id': 'showScatterPlotSelect',
                                        'name': 'showScatterPlotSelect',
                                        'value': '0',
                                        'type': 'checkbox',
                                        'checked': True if setting_item['value'] == '1' else False,
                                    }

                                # convert datetime
                                # DATETIME_RANGE_PICKER
                                if setting_item['name'] == 'DATETIME_RANGE_PICKER':
                                    update_setting_item['value'] = re.sub('[~]', EN_DASH, setting_item['value'])
                                    # setting_item['value'] = re.sub(' - ', EN_DASH, setting_item['value'])
                                # convert category
                                # GET02_CATE_SELECT1: "checkbox-4163end-proc-cate-val-div-1" -> categoryLabel-4163
                            setting_forms[form_key].append(update_setting_item)
                    update_setting.settings = json.dumps(setting_forms)
                    # save setting into DB here
                update_settings.append(update_setting)

        print('------------CONVERT USER SETTING VERSION: END  ------------')
    except Exception as e:
        raise e

    return user_settings


def convert_user_setting_url():
    dic_old_urls = {
        'fpp': ['trace_data'],
        'stp': ['categorical_plot'],
        'rlp': ['ridgeline_plot'],
        'chm': ['heatmap'],
        'msp': ['multiple_scatter_plot'],
        'scp': ['scatter_plot'],
        'pcp': ['parallel_plot'],
        'skd': ['sankey_plot'],
        'cog': ['co_occurrence'],
    }
    print('------------CONVERT USER SETTING URL OF OLD VERSION: START  ------------')
    from histview2.setting_module.models import make_session, CfgUserSetting
    with make_session() as meta_session:
        user_settings = meta_session.query(CfgUserSetting).order_by(CfgUserSetting.updated_at).all()
        for user_setting in user_settings:
            for url, old_urls in dic_old_urls.items():
                for old_url in old_urls:
                    user_setting.page = re.sub(old_url, url, user_setting.page)

    print('------------CONVERT USER SETTING URL OF OLD VERSION: END  ------------')
    return True
