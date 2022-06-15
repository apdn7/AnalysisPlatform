import os
import shutil
from datetime import datetime

from histview2.common.common_utils import resource_path
from histview2.common.logger import log_execution_time, log_execution
from histview2.common.yaml_utils import *

DATA_TYPE = 'data_type'
NAME = 'name'
KEY = 'key'


def check_proc_id(proc_id_info, db_yaml):
    # check if proc_id is old, if not, return
    dbs = YamlConfig.get_node(db_yaml.dic_config, [YAML_DB], {}) or {}

    # check for old proc_id
    for db_code, db_obj in dbs.items():
        proc_id_node = YamlConfig.get_node(db_obj, proc_id_info.get(KEY))
        if proc_id_node and type(proc_id_node).__name__ not in proc_id_info.get(DATA_TYPE):
            return [proc_id_info.get(NAME)]

    return []


def convert_proc_id_node(proc_id_info, db_yaml, proc_yaml):
    # convert to new format for each key -> write to file
    dbs = YamlConfig.get_node(db_yaml.dic_config, [YAML_DB], {}) or {}
    for db_code, db_obj in dbs.items():
        # convert for each db
        proc_id_node = YamlConfig.get_node(db_obj, proc_id_info.get(KEY))
        if proc_id_node and type(proc_id_node).__name__ not in proc_id_info.get(DATA_TYPE):
            procs = YamlConfig.get_node(proc_yaml.dic_config, [YAML_PROC], {})
            for proc_code, proc_obj in procs.items():
                proc_db = YamlConfig.get_node(proc_obj, [YAML_DB], '')
                if proc_db == db_code:
                    new_proc_id_node = {
                        proc_code: parse_int_value(proc_id_node)
                    }
                    universal_db_node = YamlConfig.get_node(db_obj, [YAML_UNIVERSAL_DB])
                    if universal_db_node and type(universal_db_node).__name__ in ('dict', 'ordereddict'):
                        db_yaml.dic_config[YAML_DB][db_code][YAML_UNIVERSAL_DB][YAML_PROC_ID] = new_proc_id_node


def backup_current_yml():
    config_path = resource_path('histview2', 'config')
    bk_folder = 'bk_' + datetime.strftime(datetime.now(), '%Y%m%d_%H%M%S')
    config_bk_path = os.path.join(config_path, bk_folder)
    if not os.path.exists(config_bk_path):
        try:
            os.mkdir(config_bk_path)
            yaml_files = [f for f in os.listdir(config_path) if f.endswith('yml')]
            for yaml_file in yaml_files:
                shutil.copy2(os.path.join(config_path, yaml_file), config_bk_path)
        except Exception:
            traceback.print_exc()


@log_execution()
def check_and_convert_old_yaml():
    # check exist
    if not os.path.exists(dic_yaml_config_file['db']):
        return

    # define keys to check
    proc_id_info = {
        NAME: YAML_PROC_ID,
        KEY: [YAML_UNIVERSAL_DB, YAML_PROC_ID],
        DATA_TYPE: ['dict', 'ordereddict']
    }

    # original yaml
    basic_yaml = BasicConfigYaml()

    # current version
    cur_ver = str(basic_yaml.get_version())

    # new version
    new_ver = str(dic_yaml_config_file[YAML_CONFIG_VERSION])

    # check yaml version
    # TODO: unsafe: '0.10.0' >= '0.9.0' (=False)
    if cur_ver >= new_ver:
        return

    proc_yaml = ProcConfigYaml()
    db_yaml = DBConfigYaml()
    old_node_list = []

    # check for old proc_id nodes
    proc_id_node_old = check_proc_id(proc_id_info, db_yaml)
    if proc_id_node_old:
        old_node_list.extend(proc_id_node_old)

    # check other nodes go here

    # if there is no old node -> return
    if not old_node_list:
        # first release : we need this code to convert 0.0.0 to 1 for some user
        # who already run convert old yaml, but did not update yaml version
        # update yaml version
        basic_yaml.set_version(new_ver)
        basic_yaml.save_yaml()
        return

    # backup yaml files just in case
    backup_current_yml()

    # convert to new format
    for old_node in old_node_list:
        if old_node == YAML_PROC_ID:
            convert_proc_id_node(proc_id_info, db_yaml, proc_yaml)

    # update back to file
    db_yaml.update_yaml(db_yaml.dic_config)

    # update yaml version
    basic_yaml.set_version(new_ver)
    basic_yaml.save_yaml()
