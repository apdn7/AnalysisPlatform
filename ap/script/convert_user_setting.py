import sqlalchemy as sa
import re

from sqlalchemy.orm import scoped_session
from ap.common.constants import CfgConstantType
from loguru import logger


def convert_user_setting_url(conn: scoped_session):
    converted_user_setting = conn.execute(sa.text(
        f"SELECT value "
        f"FROM cfg_constant "
        f"WHERE type = '{CfgConstantType.CONVERTED_USER_SETTING_URL.name}' "
    )).scalar_one_or_none()
    if converted_user_setting == '1':
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
    logger.info("------------CONVERT USER SETTING URL OF OLD VERSION: START  ------------")
    user_settings = conn.execute(sa.text(
        f"SELECT id, key, page "
        f"FROM cfg_user_setting "
        f"ORDER BY updated_at"
    )).mappings().fetchall()
    for user_setting in user_settings:
        key = re.sub(old_app_name, new_app_name, user_setting.key)
        page = re.sub(old_app_name, new_app_name, user_setting.page)
        for url, old_urls in dic_old_urls.items():
            for old_url in old_urls:
                page = re.sub(old_url, url, page)
        conn.execute(sa.text(
            f"UPDATE cfg_user_setting "
            f"SET key = :key, page = :page "
            f"WHERE id = :id"
        ), {
            "key": key,
            "page": page,
            "id": user_setting.id,
        })

    conn.execute(sa.text(
        f"UPDATE cfg_constant "
        f"SET value = :value "
        f"WHERE type = '{CfgConstantType.CONVERTED_USER_SETTING_URL.name}' "
    ), {
        "value": '1',
    })
    logger.info("------------CONVERT USER SETTING URL OF OLD VERSION: END  ------------")
    return True
