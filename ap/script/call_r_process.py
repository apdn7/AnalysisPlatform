from ap.script.r_scripts.wrapr import wrapr_utils
from ap.common.common_utils import get_data_path, get_wrapr_path


def call_r_process():
    dir_out = get_data_path()
    dir_wrapr = get_wrapr_path()
    dic_task = dict(func="hello_world", file="hello_world")

    try:
        pipe = wrapr_utils.RPipeline(dir_wrapr, dir_out)
        pipe.run({}, [dic_task])
    except Exception as e:
        pass
