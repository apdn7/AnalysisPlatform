import os

import numpy as np
import pandas as pd

from ap.common.path_utils import get_dummy_data_path


def system_labels_import(session):
    from ap.setting_module.models import CfgLabel

    system_labels_data = os.path.join(get_dummy_data_path(), 'system_labels.tsv')

    records = (
        pd.read_csv(system_labels_data, sep='\t', index_col=False)
        .replace({pd.NA: None, np.nan: None})
        .to_dict('records')
    )

    for r in records:
        session.merge(CfgLabel(**r))
    session.commit()
    session.close()
