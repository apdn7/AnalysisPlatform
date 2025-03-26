import os

import numpy as np
import pandas as pd
import unicodedata
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from ap.common.pydn.dblib import sqlite

from ap.common.common_utils import get_dummy_data_path, create_sa_engine_for_migration
from ap.common.services.normalization import NORMALIZE_FORM_NFKC


def migrate_m_unit_data(app_db_src):
    engine = create_sa_engine_for_migration('sqlite:///' + app_db_src)

    # check table before run migrate
    # ins = inspect(engine)
    # is_m_unit_existing = 'm_unit' in ins.get_table_names()
    # if is_m_unit_existing:
    #     # skip in case of table is already existing
    #     return

    from ap.setting_module.models import MUnit

    with engine.connect() as conn:
        session = Session(bind=conn)
        m_units_count = conn.execute(text('select count(*) from m_unit')).fetchone()[0]
        if m_units_count > 0:
            session.execute(text('delete from m_unit where 1=1;'))
            session.commit()
            session.close()

    with engine.connect() as conn:
        session = Session(bind=conn)

        m_unit_data = os.path.join(get_dummy_data_path(), 'm_unit.tsv')

        records = (
            pd.read_csv(m_unit_data, sep='\t', index_col=False).replace({pd.NA: None, np.nan: None}).to_dict('records')
        )
        # add new records
        for r in records:
            session.merge(MUnit(**r))
        session.commit()
        session.close()
