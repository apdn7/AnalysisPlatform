import os
import sys

import pandas as pd

from ap.common.logger import log_execution, logger


@log_execution()
def check_sum():
    orig_file = '_original_check_sum_.txt'
    curr_file = '_check_sum_.txt'
    col_name = 'col'
    if os.path.exists(orig_file) and os.path.exists(curr_file):
        orig_check_sum = pd.read_csv(orig_file, names=[col_name])[col_name].sort_values().reset_index(drop=True)
        curr_check_sum = pd.read_csv(curr_file, names=[col_name])[col_name].sort_values()
        filter_check_sum = curr_check_sum[curr_check_sum.isin(orig_check_sum)].reset_index(drop=True)

        if not orig_check_sum.equals(filter_check_sum):
            show_missing_file_count = 10
            try:
                import ctypes

                missing_files = list(set(orig_check_sum) - set(filter_check_sum))
                diff_str = '\n'.join(missing_files[:show_missing_file_count])
                if len(missing_files) > show_missing_file_count:
                    diff_str += '\n...'

                ctypes.windll.user32.MessageBoxW(0, f'File Not Found :\n{diff_str}', 'Information', 0)
            except Exception as e:
                logger.exception(e)

            sys.exit()

    return True
