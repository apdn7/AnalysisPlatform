from typing import List

from histview2.common.common_utils import copy_file, delete_file, rename_file
from histview2.common.constants import DB_BACKUP_SUFFIX
from histview2.common.logger import log_execution


@log_execution()
def fix_blank_string_port():
    """
    update blank string port to None
    :return:
    """
    try:
        print('------------HOT FIX BLANK PORT: START  ------------')
        from histview2.setting_module.models import make_session, CfgDataSourceDB
        with make_session() as meta_session:
            db_details: List[CfgDataSourceDB] = meta_session.query(CfgDataSourceDB).all()
            for db_detail in db_details:
                if db_detail.port is None or isinstance(db_detail.port, int):
                    continue
                if str(db_detail.port).strip() == '':
                    db_detail.port = None
        print('------------HOT FIX BLANK PORT: END  ------------')
    except Exception:
        pass


@log_execution()
def unlock_db(db_path):
    """
    unlock db
    :param db_path:
    :return:
    """
    try:
        print('------------UNLOCK DB: START  ------------', db_path)
        tmp = db_path + DB_BACKUP_SUFFIX
        delete_file(tmp)
        rename_file(db_path, tmp)
        copy_file(tmp, db_path)
        print('------------UNLOCK DB: END  ------------')
    except Exception:
        print("Can not unlock db. Some processes are using database file.")


def reset_import_history(app):
    try:
        print('------------RESET IMPORT HISTORY: START  ------------')
        with app.app_context():
            from histview2.setting_module.models import make_session, CsvImport, FactoryImport, JobManagement
            with make_session() as meta_session:
                meta_session.query(CsvImport).delete()
                meta_session.query(FactoryImport).delete()
                meta_session.query(JobManagement).delete()
        print('------------RESET IMPORT HISTORY: END  ------------')
    except Exception:
        print("Try to reset import history , but tables are not exist")
