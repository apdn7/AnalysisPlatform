"""munit and mfunction

Revision ID: ebaa22873218
Revises: 5db269a8c04b
Create Date: 2025-09-10 11:34:41.320605

"""

import os

import numpy as np
import pandas as pd
import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

from ap.common.path_utils import get_dummy_data_path

# revision identifiers, used by Alembic.
revision = 'ebaa22873218'
down_revision = '5db269a8c04b'
branch_labels = None
depends_on = None


def munit_upgrade():
    from ap.setting_module.models import MUnit

    # delete old data
    op.execute(sa.text('delete from m_unit where 1=1;'))

    m_unit_data = os.path.join(get_dummy_data_path(), 'm_unit.tsv')

    records = (
        pd.read_csv(m_unit_data, sep='\t', index_col=False).replace({pd.NA: None, np.nan: None}).to_dict('records')
    )

    session = orm.Session(bind=op.get_bind())
    for r in records:
        session.merge(MUnit(**r))
    session.commit()
    session.close()


def mfunction_upgrade():
    from ap.setting_module.models import MFunction

    # delete old data
    op.execute(sa.text('delete from m_function where 1=1;'))

    m_function_file = os.path.join(get_dummy_data_path(), '19.m_function.tsv')

    dtypes = {
        'a': pd.StringDtype(),
        'b': pd.StringDtype(),
        'c': pd.StringDtype(),
        'n': pd.StringDtype(),
        'k': pd.StringDtype(),
        's': pd.StringDtype(),
        't': pd.StringDtype(),
        'function_name_en': pd.StringDtype(),
        'function_name_jp': pd.StringDtype(),
    }
    records = (
        pd.read_csv(m_function_file, sep='\t', index_col=False, dtype=dtypes)
        .replace({pd.NA: None, np.nan: None})
        .to_dict('records')
    )
    session = orm.Session(bind=op.get_bind())
    for r in records:
        session.merge(MFunction(**r))
    session.commit()
    session.close()


def fix_migration_cfg_process_function_columns():
    # fix order should not be None
    # FIXME: None column should be assigned order from low to high based on id
    conn = op.get_bind()
    ids = conn.execute(sa.text('SELECT id FROM cfg_process_function_column WHERE "order" is NULL')).scalars().all()
    for index, row_id in enumerate(ids):
        op.execute(sa.text(f'UPDATE cfg_process_function_column SET "order" = {index} WHERE id = {row_id}'))


def upgrade():
    munit_upgrade()
    mfunction_upgrade()


def downgrade():
    pass
