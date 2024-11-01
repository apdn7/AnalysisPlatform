from ap.common.logger import log_execution_time
from ap.common.common_utils import copy_file, delete_file, rename_file
from ap.common.constants import DB_BACKUP_SUFFIX
from ap.setting_module.models import ProcLinkCount

import logging

logger = logging.getLogger(__name__)


# @log_execution_time()
# def fix_blank_string_port():
#     """
#     update blank string port to None
#     :return:
#     """
#     try:
#         logger.info("------------HOT FIX BLANK PORT: START  ------------")
#         from ap.setting_module.models import make_session, CfgDataSourceDB
#
#         with make_session() as meta_session:
#             db_details: List[CfgDataSourceDB] = meta_session.query(CfgDataSourceDB).all()
#             for db_detail in db_details:
#                 if db_detail.port is None or isinstance(db_detail.port, int):
#                     continue
#                 if str(db_detail.port).strip() == "":
#                     db_detail.port = None
#         logger.info("------------HOT FIX BLANK PORT: END  ------------")
#     except Exception:
#         pass


@log_execution_time()
def unlock_db(db_path):
    """
    unlock db
    :param db_path:
    :return:
    """
    try:
        logger.info("------------UNLOCK DB: START  ------------", db_path)
        tmp = db_path + DB_BACKUP_SUFFIX
        delete_file(tmp)
        rename_file(db_path, tmp)
        copy_file(tmp, db_path)
        logger.info("------------UNLOCK DB: END  ------------")
    except Exception:
        logger.info("Can not unlock db. Some processes are using database file.")


def reset_import_history(app):
    try:
        logger.info("------------RESET IMPORT HISTORY: START  ------------")
        with app.app_context():
            from ap.setting_module.models import (
                make_session,
                JobManagement,
            )

            with make_session() as meta_session:
                meta_session.query(JobManagement).delete()
                meta_session.query(ProcLinkCount).delete()

        logger.info("------------RESET IMPORT HISTORY: END  ------------")
    except Exception:
        logger.info("Try to reset import history , but tables are not exist")
