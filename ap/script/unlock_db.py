from ap.common.logger import log_execution_time
from ap.common.common_utils import copy_file, delete_file, rename_file
from ap.common.constants import DB_BACKUP_SUFFIX
from ap.setting_module.models import ProcLinkCount

import logging

logger = logging.getLogger(__name__)


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
