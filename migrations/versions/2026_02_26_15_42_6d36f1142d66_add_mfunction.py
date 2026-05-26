"""add mfunction

Revision ID: 6d36f1142d66
Revises: 49b1b6cb43d3
Create Date: 2026-02-26 15:42:35.448887

"""

import os

import numpy as np
import pandas as pd
import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

from ap.common.path_utils import get_dummy_data_path

# revision identifiers, used by Alembic.
revision = '6d36f1142d66'
down_revision = '49b1b6cb43d3'
branch_labels = None
depends_on = None


def upgrade():
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


def downgrade():
    pass
