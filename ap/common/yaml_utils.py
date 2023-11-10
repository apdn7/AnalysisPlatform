import os
import traceback
from collections import OrderedDict

import ruamel.yaml as yaml
from ruamel.yaml import add_constructor, resolver

from ap.common.common_utils import (
    check_exist,
    convert_json_to_ordered_dict,
    detect_encoding,
    dict_deep_merge,
)
from ap.common.constants import *

# yaml config files name
YAML_CONFIG_BASIC_FILE_NAME = 'basic_config.yml'
YAML_CONFIG_DB_FILE_NAME = 'db_config.yml'
YAML_CONFIG_PROC_FILE_NAME = 'proc_config.yml'
YAML_CONFIG_AP_FILE_NAME = 'ap_config.yml'
YAML_TILE_MASTER = 'tile_master.yml'
YAML_TILE_INTERFACE_DN7 = 'tile_interface_dn7.yml'
YAML_TILE_INTERFACE_AP = 'tile_interface_analysis_platform.yml'
YAML_TILE_INTERFACE_USAGE = 'tile_interface_search_by_use.yml'
YAML_TILE_JUMP = 'tile_interface_jump.yml'
YAML_START_UP_FILE_NAME = 'startup.yaml'


# class Singleton(type):
#     """ Metaclass that creates a Singleton base type when called.  """
#
#     def __call__(cls, *args, **kwargs):
#         try:
#             instances = g.setdefault(FlaskGKey.YAML_CONFIG, {})
#         except Exception:
#             # for unit test
#             instances = {}
#
#         if cls not in instances:
#             instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
#
#         return instances[cls]


class YamlConfig:
    """
    Common Config Yaml class
    """

    def __init__(self, fname_config_yaml):
        self.fname_config_yaml = fname_config_yaml
        self.dic_config = self.read_yaml() if check_exist(fname_config_yaml) else {}

    def read_yaml(self):
        # Read YAML and return dic
        # https://qiita.com/konomochi/items/f5f53ba8efa07ec5089b
        # 入力時に順序を保持する
        add_constructor(
            resolver.BaseResolver.DEFAULT_MAPPING_TAG,
            lambda loader, node: OrderedDict(loader.construct_pairs(node)),
        )

        # get encoding
        encoding = detect_encoding(self.fname_config_yaml)

        with open(self.fname_config_yaml, 'r', encoding=encoding) as f:
            data = yaml.load(f, Loader=yaml.Loader)

        return data

    def write_json_to_yml_file(self, dict_obj, output_file: str = None):
        # get encoding
        encoding = detect_encoding(self.fname_config_yaml)

        try:
            dict_obj = convert_json_to_ordered_dict(dict_obj)
            with open(
                self.fname_config_yaml if not output_file else output_file, 'w', encoding=encoding
            ) as outfile:
                yaml.dump(dict_obj, outfile, default_flow_style=False, allow_unicode=True)

            return True
        except Exception:
            print('>>> traceback <<<')
            traceback.print_exc()
            print('>>> end of traceback <<<')
            return False

    def update_yaml(self, dict_obj, key_paths=None):
        try:
            self.clear_specified_parts(key_paths)
            updated_obj = dict_deep_merge(dict_obj, self.dic_config)

            self.write_json_to_yml_file(updated_obj)
            return True
        except Exception:
            return False

    def save_yaml(self):
        """
        save yaml object to file
        Notice: This method will save exactly yaml obj to file, so in case many users save the same time, the last one will win.
        so use update_yaml is better in these case. update_yaml only save changed node(key) only.
        :return:
        """

        try:
            self.write_json_to_yml_file(self.dic_config)
            return True
        except Exception:
            return False

    # get node . if node not exist return None (no error)
    @staticmethod
    def get_node(dict_obj, keys, default_val=None):
        node = dict_obj
        for key in keys:
            if not node or not isinstance(node, dict):
                if default_val is None:
                    return node
                else:
                    return default_val

            node = node.get(key, default_val)

        return node

    # clear node by a specified key array
    def clear_node_by_key_path(self, keys):
        node = self.dic_config
        for key in keys:
            # if node is empty, we dont need to care its children
            if not node:
                return

            # use parent node reference to delete its children
            if key == keys[-1] and key in node:
                del node[key]
                return

            # move current node reference to 1 layer deeper
            node = node.get(key)

    # clear specified key in specified node.
    def clear_specified_parts(self, key_paths):
        if not key_paths:
            return

        for keys in key_paths:
            self.clear_node_by_key_path(keys)


class BasicConfigYaml(YamlConfig):
    """
    Basic Config Yaml class
    """

    # keywords
    INFO = 'info'
    VERSION = 'version'

    def __init__(self, file_name):
        super().__init__(file_name)

    def get_version(self):
        return YamlConfig.get_node(self.dic_config, [self.INFO, self.VERSION], '0')

    def set_version(self, ver):
        self.dic_config[self.INFO][self.VERSION] = ver

    def get_node(self, keys, default_val=None):
        return YamlConfig.get_node(self.dic_config, keys, default_val)


def parse_bool_value(value):
    variants = {'true': True, 't': True, '1': True, 'false': False, 'f': False, '0': False}

    if isinstance(value, bool):
        return value
    lower_value = str(value).strip().lower()
    return variants.get(lower_value) or False


class TileInterfaceYaml(YamlConfig):
    """
    Tile Interface Yaml class
    """

    YML_CFG = {
        None: YAML_TILE_INTERFACE_DN7,
        DN7_TILE: YAML_TILE_INTERFACE_DN7,
        AP_TILE: YAML_TILE_INTERFACE_AP,
        SEARCH_USAGE: YAML_TILE_INTERFACE_USAGE,
        TILE_MASTER: YAML_TILE_MASTER,
        TILE_JUMP_CFG: YAML_TILE_JUMP,
    }

    def __init__(self, file_name):
        yml_file_name = self.YML_CFG[file_name]
        file_name = os.path.join('ap', 'config', yml_file_name)
        super().__init__(file_name)
