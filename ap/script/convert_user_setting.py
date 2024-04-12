import re

from ap.common.constants import CfgConstantType


def convert_user_setting_url():
    from ap.setting_module.models import make_session, CfgUserSetting, CfgConstant

    if CfgConstant.get_value_by_type_first(CfgConstantType.CONVERTED_USER_SETTING_URL.name):
        return False

    old_app_name = "histview2"
    new_app_name = "ap"
    dic_old_urls = {
        "fpp": ["trace_data"],
        "stp": ["categorical_plot"],
        "rlp": ["ridgeline_plot"],
        "chm": ["heatmap"],
        "msp": ["multiple_scatter_plot"],
        "scp": ["scatter_plot"],
        "pcp": ["parallel_plot"],
        "skd": ["sankey_plot"],
        "cog": ["co_occurrence"],
    }
    print("------------CONVERT USER SETTING URL OF OLD VERSION: START  ------------")

    with make_session() as meta_session:
        user_settings = meta_session.query(CfgUserSetting).order_by(CfgUserSetting.updated_at).all()
        for user_setting in user_settings:
            user_setting.key = re.sub(old_app_name, new_app_name, user_setting.key)
            user_setting.page = re.sub(old_app_name, new_app_name, user_setting.page)
            for url, old_urls in dic_old_urls.items():
                for old_url in old_urls:
                    user_setting.page = re.sub(old_url, url, user_setting.page)

    CfgConstant.create_or_update_by_type(CfgConstantType.CONVERTED_USER_SETTING_URL.name, const_value=1)
    print("------------CONVERT USER SETTING URL OF OLD VERSION: END  ------------")
    return True
