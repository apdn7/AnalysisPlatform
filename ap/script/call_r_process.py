from ap import app_source, AppSource, is_internal_version
from ap.common.common_utils import safe_import
from ap.common.path_utils import get_data_path, get_wrapr_path

def call_r_process():
    dir_out = get_data_path()
    dir_wrapr = get_wrapr_path()
    dic_task = dict(func="hello_world", file="hello_world.r")

    wrapr_utils = safe_import('user.scripts_r.wrapr.wrapr_utils') if is_internal_version else None

    try:
        pipe = wrapr_utils.RPipeline(dir_wrapr, dir_out)
        pipe.run({}, [dic_task])
    except Exception as e:
        pass
