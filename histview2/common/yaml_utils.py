import os
import traceback
from collections import OrderedDict
from itertools import chain, takewhile, zip_longest
from json import dumps, loads
from typing import List

import ruamel.yaml as yaml
from flask import g
from ruamel.yaml import add_constructor, resolver

from histview2 import dic_yaml_config_file
from histview2.common.common_utils import (dict_deep_merge, convert_json_to_ordered_dict, parse_int_value,
                                           guess_data_types, clear_special_char, detect_encoding)
from histview2.common.constants import *
from histview2.common.cryptography_utils import decrypt, encrypt_db_password
from histview2.common.services.jp_to_romaji_utils import to_romaji
from histview2.setting_module.models import CfgDataSource, CfgProcess, CfgDataSourceCSV, CfgProcessColumn, \
    CfgDataSourceDB, CfgCsvColumn, CfgFilter, CfgFilterDetail, CfgVisualization, CfgTrace, CfgTraceKey, make_session


class Singleton(type):
    """ Metaclass that creates a Singleton base type when called.  """

    def __call__(cls, *args, **kwargs):
        try:
            instances = g.setdefault(FlaskGKey.YAML_CONFIG, {})
        except Exception:
            # for unit test
            instances = {}

        if cls not in instances:
            instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)

        return instances[cls]


class YamlConfig:
    """
    Common Config Yaml class
    """

    def __init__(self, fname_config_yaml):
        self.fname_config_yaml = fname_config_yaml
        self.dic_config = self.read_yaml()

    def read_yaml(self):
        # Read YAML and return dic
        # https://qiita.com/konomochi/items/f5f53ba8efa07ec5089b
        # 入力時に順序を保持する
        add_constructor(resolver.BaseResolver.DEFAULT_MAPPING_TAG,
                        lambda loader, node: OrderedDict(loader.construct_pairs(node)))

        # get encoding
        encoding = detect_encoding(self.fname_config_yaml)

        with open(self.fname_config_yaml, "r", encoding=encoding) as f:
            data = yaml.load(f, Loader=yaml.Loader)

        return data

    def write_json_to_yml_file(self, dict_obj):
        # get encoding
        encoding = detect_encoding(self.fname_config_yaml)

        try:
            dict_obj = convert_json_to_ordered_dict(dict_obj)
            with open(self.fname_config_yaml, 'w', encoding=encoding) as outfile:
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
                del (node[key])
                return

            # move current node reference to 1 layer deeper
            node = node.get(key)

    # clear specified key in specified node.
    def clear_specified_parts(self, key_paths):
        if not key_paths:
            return

        for keys in key_paths:
            self.clear_node_by_key_path(keys)


class BasicConfigYaml(YamlConfig, metaclass=Singleton):
    """
    Basic Config Yaml class
    """

    # keywords
    INFO = 'info'
    VERSION = 'version'

    def __init__(self, fname_config_yaml=None):
        if fname_config_yaml:
            super().__init__(fname_config_yaml)
        else:
            super().__init__(dic_yaml_config_file[YAML_CONFIG_BASIC])

    def get_version(self):
        return YamlConfig.get_node(self.dic_config, [self.INFO, self.VERSION], '0')

    def set_version(self, ver):
        self.dic_config[self.INFO][self.VERSION] = ver


class DBConfigYaml(YamlConfig, metaclass=Singleton):
    """
    DB Config Yaml class
    """

    # keywords
    DB = 'db'
    TYPE = 'type'
    UNIVERSAL_DB = 'universal_db'
    PROC_ID = 'proc_id'
    COLUMN_NAMES = 'column_names'
    UNUSED_COLUMN_NAMES = 'unused_column_names'
    DATA_TYPES = 'data_types'
    DIRECTORY = 'directory'
    MASTER_NAME = 'master-name'
    HOST = 'host'
    DBNAME = 'dbname'
    PORT = 'port'
    SCHEMA = 'schema'
    USERNAME = 'username'
    PASSWORD = 'password'
    HASHED = 'hashed'
    FREQUENCY = 'polling-frequency'
    CSV_SKIP_HEAD = 'skip_head'
    CSV_SKIP_TAIL = 'skip_tail'
    ETL_FUNC = 'etl_func'
    USE_OS_TIMEZONE = 'use_os_timezone'
    DELIMITER = 'delimiter'
    COMMENT = 'comment'

    class PollingFrequency(Enum):
        ONCE = '0'
        HOURLY = '1'
        DAILY = '24'

    def __init__(self, fname_config_yaml=None):
        if fname_config_yaml:
            super().__init__(fname_config_yaml)
        else:
            super().__init__(dic_yaml_config_file[YAML_CONFIG_DB])

        self.db_instance = None

    def decrypt_db_password(self):
        from histview2.common.cryptography_utils import decrypt_db_password

        if not self.dic_config:  # for a rare case, self.dic_config in None for unknown reason
            self.__init__()
        db_config_dumped = dumps(self.dic_config)
        db_config_json = loads(db_config_dumped)
        decoded_db_config_json = decrypt_db_password(db_config_json)

        for key in decoded_db_config_json[DBConfigYaml.DB]:
            db_config = decoded_db_config_json[DBConfigYaml.DB][key]
            if db_config and db_config.get(DBConfigYaml.PASSWORD):
                password = db_config.get(DBConfigYaml.PASSWORD)

                if self.dic_config[DBConfigYaml.DB].get(key):
                    self.dic_config[DBConfigYaml.DB][key][DBConfigYaml.PASSWORD] = password
                    self.dic_config[DBConfigYaml.DB][key][DBConfigYaml.HASHED] = False

    def get_db_master_name(self, db_code):
        try:
            return YamlConfig.get_node(self.dic_config, (DBConfigYaml.DB, db_code, DBConfigYaml.MASTER_NAME)) or db_code
        except Exception:
            return db_code

    def get_comment(self, db_code):
        return YamlConfig.get_node(self.dic_config, (DBConfigYaml.DB, db_code, DBConfigYaml.COMMENT))

    def get_type(self, db_code):
        return YamlConfig.get_node(self.dic_config, (DBConfigYaml.DB, db_code, DBConfigYaml.TYPE))

    def get_csv_folder(self, db_code):
        return YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.DIRECTORY], None)

    def get_dbs(self):
        return [key for key in self.dic_config[YAML_DB].keys()]

    def is_csv(self, db_code):
        if isinstance(db_code, str) \
                and self.get_node(self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.TYPE]) == DBType.CSV.value:
            return True
        else:
            return False

    def get_db_infos(self):
        dbs = self.get_dbs()
        return {
            db: YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db]) for db in dbs
        }

    def get_db_info(self, ds_id):
        dbs = self.get_db_infos()
        return dbs[ds_id]

    def get_csv_procs(self):
        dbs = self.get_dbs()
        return {
            db: YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db,
                                                      DBConfigYaml.UNIVERSAL_DB, DBConfigYaml.PROC_ID])
            for db in dbs if self.is_csv(db)
        }

    def get_proc_ids(self, db_id):
        dbs = self.get_dbs()
        procs = [
            YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db, DBConfigYaml.UNIVERSAL_DB, DBConfigYaml.PROC_ID])
            for db in dbs if db == db_id]
        return procs[0]

    def get_etl_func(self, db_code):
        return YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.ETL_FUNC])

    def get_use_os_timezone(self, db_code):
        return YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.USE_OS_TIMEZONE])

    def get_factory_procs(self):
        dbs = self.get_dbs()
        return {
            db: YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db,
                                                      DBConfigYaml.UNIVERSAL_DB, DBConfigYaml.PROC_ID])
            for db in dbs if not self.is_csv(db)
        }

    def gen_proc_id(self, db_code, proc_code, proc_id):  # TODO support factory only -> need to support csv
        proc_id_node = YamlConfig.get_node(
            self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.UNIVERSAL_DB, DBConfigYaml.PROC_ID])

        if proc_id_node:
            self.dic_config[DBConfigYaml.DB][db_code][DBConfigYaml.UNIVERSAL_DB][DBConfigYaml.PROC_ID][proc_code] \
                = proc_id
            universal_db_node = YamlConfig.get_node(self.dic_config,
                                                    [DBConfigYaml.DB, db_code, DBConfigYaml.UNIVERSAL_DB],
                                                    {})
            return {
                DBConfigYaml.DB:
                    {db_code:
                         {DBConfigYaml.UNIVERSAL_DB: universal_db_node}
                     }
            }
        else:
            return {
                DBConfigYaml.DB:
                    {db_code:
                         {DBConfigYaml.UNIVERSAL_DB:
                              {DBConfigYaml.PROC_ID:
                                   {proc_code: proc_id}
                               }
                          }
                     }
            }

        # return universal_db_node

    def del_db_config(self, db_code):
        if self.get_node(self.dic_config, [DBConfigYaml.DB, db_code]):
            del self.dic_config[DBConfigYaml.DB][db_code]
            self.update_yaml(dict_obj=self.dic_config)

    def del_proc_from_cfg(self, db_code, proc_code):
        db_configs = self.dic_config[DBConfigYaml.DB]
        for code, db_config in db_configs.items():
            if code == db_code \
                    and YamlConfig.get_node(db_configs, [db_code, DBConfigYaml.UNIVERSAL_DB, YAML_PROC_ID, proc_code]):
                del self.dic_config[DBConfigYaml.DB][db_code][DBConfigYaml.UNIVERSAL_DB][YAML_PROC_ID][proc_code]
                break
        self.update_yaml(dict_obj=self.dic_config)

    def run_sql(self, sql, row_is_dict=True):
        res = self.db_instance.run_sql(sql, row_is_dict)
        return res

    def fetch_many(self, sql, size=10_000):
        data = self.db_instance.fetch_many(sql, size)
        if not data:
            yield None

        for row in data:
            yield row

    def self_init_db(self, db_code):
        self.decrypt_db_password()
        self.db_instance = DBConfigYaml.init_db(self.dic_config, db_code)
        return self.db_instance

    @classmethod
    def init_db(cls, dic_config, db_code):
        dic_db_info = cls.get_node(dic_config, [DBConfigYaml.DB, db_code])
        if not dic_db_info:
            return None

        # get port-no from db config yml file.
        port = None
        if DBConfigYaml.PORT in dic_db_info.keys():
            port = parse_int_value(dic_db_info.get(DBConfigYaml.PORT))

        schema = None
        if dic_db_info.get(DBConfigYaml.SCHEMA) is not None:
            schema = dic_db_info.get(DBConfigYaml.SCHEMA)

        if dic_db_info.get(DBConfigYaml.TYPE) == DBType.POSTGRESQL.value:
            from histview2.common.pydn.dblib import postgresql
            db_instance = postgresql.PostgreSQL(dic_db_info.get(DBConfigYaml.HOST),
                                                dic_db_info.get(DBConfigYaml.DBNAME),
                                                dic_db_info.get(DBConfigYaml.USERNAME),
                                                dic_db_info.get(DBConfigYaml.PASSWORD))
            # use custom port or default port
            if port:
                db_instance.port = port

            if schema:
                db_instance.schema = schema

            return db_instance
        elif dic_db_info.get(DBConfigYaml.TYPE) == DBType.ORACLE.value:
            from histview2.common.pydn.dblib import oracle
            db_instance = oracle.Oracle(dic_db_info.get(DBConfigYaml.HOST),
                                        dic_db_info.get(DBConfigYaml.DBNAME),
                                        dic_db_info.get(DBConfigYaml.USERNAME),
                                        dic_db_info.get(DBConfigYaml.PASSWORD))
            # use custom port or default port
            if port:
                db_instance.port = port

            return db_instance
        elif dic_db_info.get(DBConfigYaml.TYPE) == DBType.MYSQL.value:
            from histview2.common.pydn.dblib import mysql
            db_instance = mysql.MySQL(dic_db_info.get(DBConfigYaml.HOST),
                                      dic_db_info.get(DBConfigYaml.DBNAME),
                                      dic_db_info.get(DBConfigYaml.USERNAME),
                                      dic_db_info.get(DBConfigYaml.PASSWORD))
            # use custom port or default port
            if port:
                db_instance.port = port

            return db_instance
        elif dic_db_info.get(DBConfigYaml.TYPE) == DBType.MSSQLSERVER.value:
            from histview2.common.pydn.dblib import mssqlserver
            db_instance = mssqlserver.MSSQLServer(dic_db_info.get(DBConfigYaml.HOST),
                                                  dic_db_info.get(DBConfigYaml.DBNAME),
                                                  dic_db_info.get(DBConfigYaml.USERNAME),
                                                  dic_db_info.get(DBConfigYaml.PASSWORD))
            # use custom port or default port
            if port:
                db_instance.port = port

            if schema:
                db_instance.schema = schema

            return db_instance

        elif dic_db_info.get(DBConfigYaml.TYPE) == DBType.SQLITE.value:
            from histview2.common.pydn.dblib import sqlite
            return sqlite.SQLite3(dic_db_info.get(DBConfigYaml.DBNAME))
        elif dic_db_info.get(DBConfigYaml.TYPE) == DBType.CSV.name and dic_db_info.get(DBConfigYaml.DBNAME):
            from histview2.common.pydn.dblib import sqlite
            return sqlite.SQLite3(dic_db_info.get(DBConfigYaml.DBNAME))
        else:
            return None

    def connect_db(self, db_code):
        if not self.db_instance:
            self.self_init_db(db_code)

        res = self.db_instance.connect()
        return res

    def disconnect_db(self):
        if self.db_instance:
            self.db_instance.disconnect()

    def get_csv_data_types(self, db_code):
        if not self.is_csv(db_code):
            return None

        dic_universal = YamlConfig.get_node(self.dic_config, [DBConfigYaml.DB, db_code, DBConfigYaml.UNIVERSAL_DB], {})
        data_types = dic_universal.get(DBConfigYaml.DATA_TYPES)

        return data_types

    def save_ds_config(self, ds_code, ds_info):
        try:
            dic_db_config = self.dic_config[YAML_DB]
            current_ds_info = dic_db_config.get(ds_code) or {}

            # encrypt password if hashed
            hash_flag = current_ds_info.get(YAML_HASHED)
            if hash_flag and current_ds_info.get(YAML_PASSWORD) is not None:
                current_ds_info[YAML_PASSWORD] = decrypt(current_ds_info.get(YAML_PASSWORD))
                current_ds_info[YAML_HASHED] = False

            # just assign to add new or update
            dic_db_config[ds_code] = dict_deep_merge(ds_info, current_ds_info)

            # encrypt db password
            self.dic_config = encrypt_db_password(self.dic_config)

            # update yaml
            self.update_yaml(self.dic_config)
        except Exception:
            traceback.print_exc()
            return False

        return True


class ProcConfigYaml(YamlConfig, metaclass=Singleton):
    """
    Proc Config Yaml class
    """

    def __init__(self, fname_config_yaml=None):
        if fname_config_yaml:
            super().__init__(fname_config_yaml)
        else:
            super().__init__(dic_yaml_config_file[YAML_CONFIG_PROC])

    def get_all_traces(self, proc_name):
        common_keys = [YAML_PROC, proc_name, YAML_TRACE, YAML_TRACE_FORWARD]
        nodes = YamlConfig.get_node(self.dic_config, common_keys)

        return nodes

    def get_proc_master_names(self):
        return [(key, val[YAML_MASTER_NAME]) for key, val in self.dic_config[YAML_PROC].items()]

    def get_proc_master_name(self, proc_name):
        try:
            return YamlConfig.get_node(self.dic_config, (YAML_PROC, proc_name, YAML_MASTER_NAME)) or proc_name
        except Exception:
            return proc_name

    def get_proc_info(self, proc_name):
        return YamlConfig.get_node(self.dic_config, (YAML_PROC, proc_name))

    def get_db_id(self, proc_name):
        """
        get db_id of proc
        """
        return YamlConfig.get_node(self.dic_config, (YAML_PROC, proc_name, YAML_DB))

    def get_checked_columns(self, proc_name, dic_key_is_alias=False):
        output = {}
        keys = (YAML_PROC, proc_name, YAML_CHECKED_COLS)
        checked_cols = self.get_node(self.dic_config, keys)
        if checked_cols:
            dic_key = YAML_COL_NAMES
            if dic_key_is_alias:
                dic_key = YAML_ALIASES

            for i in range(len(checked_cols[YAML_COL_NAMES])):
                output[checked_cols[dic_key or YAML_COL_NAMES][i]] = {
                    YAML_COL_NAMES: checked_cols[YAML_COL_NAMES][i],
                    YAML_ALIASES: checked_cols[YAML_ALIASES][i],
                    YAML_MASTER_NAMES: checked_cols[YAML_MASTER_NAMES][i],
                    YAML_OPERATORS: checked_cols[YAML_OPERATORS][i],
                    YAML_COEFS: checked_cols[YAML_COEFS][i],
                    YAML_DATA_TYPES: checked_cols[YAML_DATA_TYPES][i],
                }

        return output

    # get key_cols aliases
    def get_key_aliases(self, proc_name, key_cols, key_origcols):
        if not key_origcols:
            return key_origcols

        # get key aliases
        checked_cols = self.get_checked_columns(proc_name)
        # checked column not exists
        if not checked_cols:
            return key_cols

        return [checked_cols[oricol][YAML_ALIASES] or col for col, oricol in zip(key_cols, key_origcols)]

    def get_leaf_procs(self, is_traceback=True):
        """
        Get Trace Points
        Returns:
                dictionary - - list start points and end points
        """

        procs = self.dic_config[YAML_PROC]
        trace_direct = YAML_TRACE_BACK
        if not is_traceback:
            trace_direct = YAML_TRACE_FORWARD

        non_leafs = []
        for val in procs.values():
            traces = YamlConfig.get_node(val, [YAML_TRACE, trace_direct])
            if traces:
                non_leafs.append([trace[YAML_PROC] for trace in traces])

        return list(set(procs) - set(chain.from_iterable(non_leafs)))

    def get_substr_match_info(self, start_proc, trace_target_proc, is_traceback=None):
        """ get substr match infor of 2 procs

        Arguments:
            start_proc {[type]} - - [description]
            trace_target_proc {[type]} - - [description]

        Keyword Arguments:
            is_traceback {[type]} - - [description](default: {None})

        Returns:
            [type] - - [description]
        """
        trace_direct = YAML_TRACE_BACK
        if not is_traceback:
            trace_direct = YAML_TRACE_FORWARD

        keys = (YAML_PROC, start_proc, YAML_TRACE, trace_direct)

        trace_infos = self.get_node(self.dic_config, keys)
        if not trace_infos:
            return {}, {}

        trace = None
        for trace_info in trace_infos:
            if trace_info[YAML_PROC] == trace_target_proc:
                trace = trace_info
                break

        if not trace:
            return {}, {}

        self_cols = trace[YAML_TRACE_SELF_COLS]
        target_cols = trace[YAML_TRACE_TARGET_COLS]

        # self-substring key maybe blank , so create an list of empty list
        self_substr = trace.get(YAML_TRACE_MATCH_SELF, [[]] * len(self_cols))
        target_substr = trace.get(YAML_TRACE_MATCH_TARGET, [[]] * len(target_cols))

        self_output = {col: substr for col, substr in zip(self_cols, self_substr) if substr}
        target_output = {col: substr for col, substr in zip(target_cols, target_substr) if substr}
        return self_output, target_output

    # get sub string information for key columns
    @staticmethod
    def get_substr_info(trace, start_proc, end_proc):
        # get substring match information
        dic_start_substr = None
        dic_end_substr = None
        for trace_direct in (True, False):
            dic_start_substr, dic_end_substr \
                = trace.proc_yaml.get_substr_match_info(start_proc, end_proc, trace_direct)
            if dic_start_substr or dic_end_substr:
                break

        dic_col_2_checked_columns = trace.proc_yaml.get_checked_columns(end_proc, False)
        new_dic_end_substr = {}
        for end_orig_col in list(dic_end_substr):
            col_substr = dic_end_substr.get(end_orig_col)
            end_key_col_alias = dic_col_2_checked_columns.get(end_orig_col).get(YAML_ALIASES)
            new_dic_end_substr[end_key_col_alias] = col_substr

        return dic_start_substr, new_dic_end_substr

    @classmethod
    def convert_data_type(cls, dict_yml: dict):
        procs = dict_yml[YAML_PROC]

        for proc_val in procs.values():
            checked_cols = proc_val.get(YAML_CHECKED_COLS, None)
            if not checked_cols:
                continue
            if checked_cols[YAML_DATA_TYPES]:
                checked_cols[YAML_DATA_TYPES] \
                    = [guess_data_types(data_type).name for data_type in checked_cols[YAML_DATA_TYPES]]

    def del_proc_config(self, proc_code):
        if self.get_node(self.dic_config, [YAML_PROC, proc_code]):
            del self.dic_config[YAML_PROC][proc_code]
            self.update_yaml(dict_obj=self.dic_config)

    def get_table_name(self, proc_name):
        proc_yaml_keys = [YAML_PROC, proc_name]
        table_name = self.get_node(self.dic_config, proc_yaml_keys + [YAML_SQL, YAML_FROM])
        return table_name

    def set_trace_edges(self, proc_code, edges=[], is_forward=True):
        direction = YAML_TRACE_FORWARD
        if not is_forward:
            direction = YAML_TRACE_BACK

        if self.get_node(self.dic_config, [YAML_PROC, proc_code]):
            if self.get_node(self.dic_config, [YAML_PROC, proc_code, YAML_TRACE]):
                self.dic_config[YAML_PROC][proc_code][YAML_TRACE][direction] = edges
            else:
                self.dic_config[YAML_PROC][proc_code][YAML_TRACE] = {}
                self.dic_config[YAML_PROC][proc_code][YAML_TRACE][direction] = edges

    def update_alias_in_trace_config(self, dict_yml: dict):
        procs = dict_yml[YAML_PROC] or {}

        def create_new_edges(old_edges, alias_2_colname, colname_2_new_alias):
            new_edges = []
            for edge in old_edges:
                aliases = edge.get(YAML_TRACE_SELF_COLS) or []
                new_self_cols = []
                for alias in aliases:
                    # use column name for reference
                    colname = self.get_node(alias_2_colname, [alias, YAML_COL_NAMES])
                    # get new alias name, if column is uncheck, new_alias is null
                    new_alias = colname_2_new_alias.get(colname)
                    new_self_cols.append(new_alias)
                edge[YAML_TRACE_SELF_COLS] = new_self_cols
                new_edges.append(edge)
            return new_edges

        for proc_code, proc_config in procs.items():
            # get current trace setting from proc_config.yaml
            forward_edges = self.get_node(self.dic_config, [YAML_PROC, proc_code, YAML_TRACE, YAML_TRACE_FORWARD],
                                          []) or []
            backward_edges = self.get_node(self.dic_config, [YAML_PROC, proc_code, YAML_TRACE, YAML_TRACE_BACK],
                                           []) or []
            old_alias_2_colname = self.get_checked_columns(proc_code, dic_key_is_alias=True)

            # get new column settings
            colnames = self.get_node(proc_config, [YAML_CHECKED_COLS, YAML_COL_NAMES], []) or []
            new_aliases = self.get_node(proc_config, [YAML_CHECKED_COLS, YAML_ALIASES], []) or []
            colname_2_new_alias = dict(zip(colnames, new_aliases))

            if forward_edges:
                create_new_edges(forward_edges, old_alias_2_colname, colname_2_new_alias)
            if backward_edges:
                create_new_edges(backward_edges, old_alias_2_colname, colname_2_new_alias)

    # def get_key_aliases(self, proc_id, key_cols, key_origcols):


class Hist2ConfigYaml(YamlConfig, metaclass=Singleton):
    """
    Histview 2 Config Yaml class
    """

    def __init__(self, fname_config_yaml=None):
        if fname_config_yaml:
            super().__init__(fname_config_yaml)
        else:
            super().__init__(dic_yaml_config_file[YAML_CONFIG_HISTVIEW2])

    def get_date_col(self, proc_name):
        keys = (YAML_PROC, proc_name, YAML_DATE_COL)
        return clear_special_char(self.get_node(self.dic_config, keys))

    def get_serial_col(self, proc_name):
        keys = (YAML_PROC, proc_name, YAML_SERIAL_COL)
        return clear_special_char(self.get_node(self.dic_config, keys))

    def get_auto_increment_col(self, proc_name):
        keys = (YAML_PROC, proc_name, YAML_AUTO_INCREMENT_COL)
        return clear_special_char(self.get_node(self.dic_config, keys))

    def get_filter_column_name(self, proc_name, key):
        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        if key.startswith(FILTER_MACHINE):
            keys = keys + [YAML_FILTER_LINE_MACHINE_ID, YAML_MACHINE_ID, YAML_COL_NAME]
        else:
            keys = keys + [key, YAML_COL_NAME]

        # it will return column-name of filter , or return key if key is a column not a filter.
        return YamlConfig.get_node(self.dic_config, keys, key)

    def get_filter_sql_statement(self, proc_name, key, ids):
        if not ids:
            return None

        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES, key]
        value_master = YamlConfig.get_node(self.dic_config, keys + [YAML_VALUE_MASTER])
        if not value_master:
            return None

        sql_statements = YamlConfig.get_node(self.dic_config, keys + [YAML_SQL_STATEMENTS])
        if not sql_statements:
            sql_statements = YamlConfig.get_node(self.dic_config, keys + [YAML_VALUE_LIST])

        return [val for key, val in zip(value_master, sql_statements) if key in ids]

    def get_vals_from_sql(self, proc_name, node_name=FILTER_PARTNO, list_sqls=tuple()):  # TODO commonize
        if not list_sqls:
            return []

        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES, node_name]
        value_list = YamlConfig.get_node(self.dic_config, keys + [YAML_VALUE_LIST])
        sql_statements = YamlConfig.get_node(self.dic_config, keys + [YAML_SQL_STATEMENTS])
        if not value_list or not sql_statements:
            return []
        return [value for value, sql_statement in zip(value_list, sql_statements) if sql_statement in list_sqls]

    def get_filters(self, proc_name):
        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        return YamlConfig.get_node(self.dic_config, keys)

    def get_filter_value_masters(self, proc_name, key):
        if not key:
            return None

        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES, key]
        value_masters = YamlConfig.get_node(self.dic_config, keys + [YAML_VALUE_MASTER])

        return value_masters

    def get_filter_condition(self, proc_name, key):
        if not key:
            return None

        keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES, key]
        conditions = YamlConfig.get_node(self.dic_config, keys + [YAML_SQL_STATEMENTS])
        if conditions is None:
            conditions = YamlConfig.get_node(self.dic_config, keys + [YAML_VALUE_LIST])

        return conditions

    def get_filter_name_by_column_name(self, proc_name, col_name):
        common_keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        nodes = YamlConfig.get_node(self.dic_config, common_keys)
        for key, dic_val in nodes.items():
            if key.startswith(FILTER_MACHINE):
                node = YamlConfig.get_node(dic_val, [YAML_FILTER_LINE_MACHINE_ID, YAML_MACHINE_ID])
            else:
                node = dic_val

            if node.get(YAML_COL_NAME) == col_name:
                return key

        return None

    def get_all_filters(self, proc_name):
        common_keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        nodes = YamlConfig.get_node(self.dic_config, common_keys)
        return nodes

    def get_all_chart_infos(self, proc_name):
        common_keys = [YAML_PROC, proc_name, YAML_SQL, YAML_SELECT_OTHER_VALUES]
        nodes = YamlConfig.get_node(self.dic_config, common_keys) or {}
        dic_chart_infos = {}
        proc_yaml = ProcConfigYaml()
        checked_columns = proc_yaml.get_checked_columns(proc_name, True)
        for alias_name, node in nodes.items():
            chart_infos = node.get('chart-info')
            if chart_infos:
                col_name = checked_columns[alias_name][YAML_COL_NAMES]
                dic_chart_infos[col_name] = chart_infos

        return dic_chart_infos

    def get_filters_by_column_name(self, proc_name, col_name):
        common_keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        nodes = YamlConfig.get_node(self.dic_config, common_keys)
        for key, dic_val in nodes.items():
            if col_name in (dic_val.get(YAML_COL_NAME), dic_val.get(YAML_ORIG_COL_NAME)):
                return {key: dic_val}

        return None

    def get_machine_filter_by_column_name(self, proc_name, col_name):
        common_keys = [YAML_PROC, proc_name, YAML_SQL, YAML_WHERE_OTHER_VALUES]
        nodes = YamlConfig.get_node(self.dic_config, common_keys)
        for key, dic_val in nodes.items():
            if dic_val.get(YAML_MACHINE_ID):
                if col_name in (dic_val.get(YAML_COL_NAME), dic_val.get(YAML_ORIG_COL_NAME)):
                    return {key: dic_val}

        return None

    def get_filter_name_by_alias_name(self, proc_name, alias_name):
        proc_yaml = ProcConfigYaml()
        checked_cols = proc_yaml.get_checked_columns(proc_name, True)
        dic_col = checked_cols.get(alias_name)
        if not dic_col:
            return None

        col_name = dic_col[YAML_COL_NAMES]
        key = self.get_filter_name_by_column_name(proc_name, col_name)

        return key

    def get_proc(self, proc_name):
        keys = [YAML_PROC, proc_name]
        return YamlConfig.get_node(self.dic_config, keys)

    def del_proc_config(self, proc_code):
        if self.get_node(self.dic_config, [YAML_PROC, proc_code]):
            del self.dic_config[YAML_PROC][proc_code]
            self.update_yaml(dict_obj=self.dic_config)


def parse_bool_value(value):
    variants = {'true': True, 't': True, '1': True, 'false': False, 'f': False, '0': False}

    if isinstance(value, bool):
        return value
    lower_value = str(value).strip().lower()
    return variants.get(lower_value) or False


class TransformYamlToDb:
    db_yaml: DBConfigYaml
    proc_yaml: ProcConfigYaml
    histview2_yaml: Hist2ConfigYaml
    data_source_cfgs: List[CfgDataSource]

    def __init__(self):
        self.data_source_cfgs = []

    @staticmethod
    def is_db_config_data_exists():
        return CfgDataSource.query.first()

    @staticmethod
    def is_yaml_config_exists():
        """
        Check if specified file is exists, return false if one of them is not exists.
        Arguments:
            dic_yaml_config_file {dict} list of all yaml file path.
        Returns:
            True if all of file are exist
        """
        yaml_keys = [YAML_CONFIG_BASIC, YAML_CONFIG_DB, YAML_CONFIG_PROC, YAML_CONFIG_HISTVIEW2]
        for key, file_path in dic_yaml_config_file.items():
            if key in yaml_keys:
                if not os.path.exists(file_path):
                    return False

        return True

    def __load_yaml(self):
        self.db_yaml = DBConfigYaml()
        self.proc_yaml = ProcConfigYaml()
        self.histview2_yaml = Hist2ConfigYaml()
        self.data_source_cfgs = []

    def transform(self):
        if not self.is_yaml_config_exists():
            return

        if self.is_db_config_data_exists():
            return

        self.import_to_db()

        # save
        with make_session() as meta_session:
            print('YAML Transform: START')
            for ds in self.data_source_cfgs:
                print(ds.__dict__)
                meta_session.add(ds)

        with make_session() as meta_session:
            data_source_cfgs = meta_session.query(CfgDataSource).all()
            print('Number of data source:', len(data_source_cfgs))
            proc_cfgs = meta_session.query(CfgProcess).all()
            print('Number of process:', len(proc_cfgs))

        print('YAML Transform: DONE!!!')

    def import_to_db(self):
        self.__load_yaml()

        dic_proc_columns = {}
        data_sources = self.get_data_sources() or []
        for ds_id in data_sources:
            # ds
            is_csv = self.db_yaml.is_csv(ds_id)
            data_src_cfg = self.set_data_source(ds_id)
            self.data_source_cfgs.append(data_src_cfg)

            # csv ds
            if is_csv:
                ds_detail_cfg = self.set_csv_data_source(ds_id)
                data_src_cfg.csv_detail = ds_detail_cfg
                csv_columns = self.set_csv_columns(ds_id)
                ds_detail_cfg.csv_columns = csv_columns
            else:
                ds_detail_cfg = self.set_db_data_source(ds_id)
                data_src_cfg.db_detail = ds_detail_cfg

            # process
            data_src_cfg.processes = []
            dic_procs = self.get_process_ids(ds_id) or {}
            for proc_id, proc_new_id in dic_procs.items():
                proc_cfg = self.set_process(proc_id, proc_new_id)

                # there is no proc in proc yaml
                if not proc_cfg:
                    continue

                data_src_cfg.processes.append(proc_cfg)

                # checked columns
                dic_checked_columns = self.get_columns(proc_id) or {}

                # serials
                serial_cols = [s.split()[0] for s in self.histview2_yaml.get_serial_col(proc_id) if s]

                # get date
                date_col = self.histview2_yaml.get_date_col(proc_id)
                date_col = date_col.split()[0]

                # auto_incremental_col
                auto_incremental_col = self.histview2_yaml.get_auto_increment_col(proc_id)

                # column_type
                dic_columns = {}
                dic_proc_columns[proc_id] = (proc_cfg, dic_columns)
                for col_name, col_info in dic_checked_columns.items():
                    column_cfg = self.set_process_column(col_name, col_info, date_col, serial_cols,
                                                         auto_incremental_col)

                    proc_cfg.columns.append(column_cfg)
                    dic_columns[col_name] = column_cfg

                # filters and filter details
                dic_chart_infos = {}
                filters = self.histview2_yaml.get_all_filters(proc_id) or {}
                for filter_type, filter_info in filters.items():
                    col_name = filter_info.get('orig_column') or filter_info.get('column_name')
                    # line, part no, other
                    filter_type = self.get_filter_type(filter_type)
                    if not filter_type:
                        continue

                    filter_cfg, dic_chart_info_key = self.set_filter(filter_type, filter_info)
                    dic_chart_infos.update(dic_chart_info_key)
                    if col_name:
                        filter_cfg.column = dic_columns.get(col_name)

                    proc_cfg.filters.append(filter_cfg)

                    # machine
                    if filter_type == CfgFilterType.LINE.name:
                        machine_info = filter_info.get('machine-id')
                        filter_machine_cfg = self.set_machine_filter(filter_type, machine_info, filter_cfg)
                        if filter_machine_cfg:
                            machine_col_name = machine_info.get('orig_column') or machine_info.get('column_name')
                            if machine_col_name:
                                filter_machine_cfg.column = dic_columns.get(machine_col_name)

                            proc_cfg.filters.append(filter_machine_cfg)
                            filter_machine_cfg.parent = filter_cfg

                # visualization( chart infos)
                dic_charts = self.histview2_yaml.get_all_chart_infos(proc_id) or {}
                for col_name, chart_infos in dic_charts.items():
                    visual_cfgs = self.set_visualization(chart_infos, dic_columns.get(col_name), dic_chart_infos)
                    for visual_cfg in visual_cfgs:
                        proc_cfg.visualizations.append(visual_cfg)

        # trace
        self.set_trace(dic_proc_columns)

    def get_data_sources(self):
        return self.db_yaml.get_db_infos()

    def get_process_ids(self, ds_id):
        dic_procs = self.db_yaml.get_proc_ids(ds_id)
        return dic_procs

    def get_columns(self, proc_id):
        return self.proc_yaml.get_checked_columns(proc_id)

    def get_traces(self, proc_id):
        # traces
        dic_traces = self.proc_yaml.get_all_traces(proc_id) or {}
        for target_proc, dic_trace in dic_traces.items():
            pass

    def set_data_source(self, ds_id):
        db_info = self.db_yaml.get_db_info(ds_id)

        data_src_cfg = CfgDataSource()
        data_src_cfg.name = db_info.get('master-name')
        data_src_cfg.comment = db_info.get('comment')
        db_type = db_info.get('type')
        if db_type:
            data_src_cfg.type = DBType(db_type).name
        return data_src_cfg

    def set_csv_data_source(self, ds_id):
        db_info = self.db_yaml.get_db_info(ds_id)

        ds_csv = CfgDataSourceCSV()

        ds_csv.etl_func = db_info.get('etl_func')
        ds_csv.delimiter = db_info.get('delimiter')
        ds_csv.directory = db_info.get('directory')
        ds_csv.skip_head = parse_int_value(db_info.get('skip_head'))
        ds_csv.skip_tail = parse_int_value(db_info.get('skip_tail'))
        ds_csv.csv_columns = []

        return ds_csv

    def set_db_data_source(self, ds_id):
        db_info = self.db_yaml.get_db_info(ds_id)

        ds_db = CfgDataSourceDB()
        ds_db.host = db_info.get('host')
        ds_db.port = db_info.get('port') or None
        ds_db.dbname = db_info.get('dbname')
        ds_db.schema = db_info.get('schema') or None
        ds_db.username = db_info.get('username')
        ds_db.password = db_info.get('password')
        ds_db.hashed = parse_bool_value(db_info.get('hashed'))
        ds_db.use_os_timezone = parse_bool_value(db_info.get('use_os_timezone'))

        return ds_db

    def set_csv_columns(self, ds_id):
        proc_info = self.db_yaml.get_db_info(ds_id)
        universal_info = proc_info.get('universal_db')

        column_names = universal_info.get('column_names')
        data_types = universal_info.get('data_types')

        csv_columns = []
        if column_names:
            for col_name, data_type in zip(column_names, data_types):
                csv_column = CfgCsvColumn()
                csv_column.column_name = col_name
                csv_column.data_type = data_type
                csv_columns.append(csv_column)

        return csv_columns

    def set_process(self, proc_id, proc_new_id):
        proc_info = self.proc_yaml.get_proc_info(proc_id)
        if not proc_info:
            return None

        proc_cfg = CfgProcess()

        proc_cfg.id = proc_new_id
        proc_cfg.name = proc_info['master-name']
        proc_cfg.table_name = clear_special_char(proc_info['sql']['from'])
        proc_cfg.comment = proc_info['comment']
        proc_cfg.columns = []
        proc_cfg.filters = []
        proc_cfg.visualizations = []

        return proc_cfg

    @staticmethod
    def set_process_column(col_name, col_info, get_date, serials, auto_incremental_col):
        column_cfg = CfgProcessColumn()

        column_cfg.column_name = col_name
        column_cfg.name = col_info['master-names']
        column_cfg.english_name = to_romaji(col_info['alias-names'])
        column_cfg.operator = col_info['operators']
        column_cfg.coef = col_info['coefs']
        column_cfg.data_type = col_info['data-types']

        column_cfg.is_get_date = 0
        if col_name == get_date:
            column_cfg.is_get_date = 1

        column_cfg.is_auto_increment = 0
        if col_name == auto_incremental_col:
            column_cfg.is_auto_increment = 1

        column_cfg.is_serial_no = 0
        if col_name in serials:
            column_cfg.is_serial_no = 1

        return column_cfg

    def set_trace(self, dic_proc_columns):
        for proc_id, (proc_cfg, dic_columns) in dic_proc_columns.items():
            checked_cols = self.proc_yaml.get_checked_columns(proc_id, True)
            traces = self.proc_yaml.get_all_traces(proc_id) or []
            proc_cfg.traces = []
            for dic_trace in traces:
                # self
                self_proc_cfg = proc_cfg
                self_col_cfgs = [dic_columns[checked_cols[col][YAML_COL_NAMES]] for col in
                                 dic_trace['self-alias-columns']]

                self_substrs = dic_trace.get('self-substr')
                if self_substrs is None:
                    self_substrs = [[]] * len(self_col_cfgs)

                # target
                tar_proc_id = dic_trace.get('proc')
                tar_proc_cfg, dic_tar_columns = dic_proc_columns.get(tar_proc_id)
                if not tar_proc_cfg or not dic_tar_columns:
                    continue

                tar_col_cfgs = [dic_tar_columns[col] for col in dic_trace['target-orig-columns']]
                tar_substrs = dic_trace.get('target-substr')
                if tar_substrs is None:
                    tar_substrs = [[]] * len(tar_col_cfgs)

                # save to db
                trace_cfg = CfgTrace()
                proc_cfg.traces.append(trace_cfg)

                trace_cfg.self_process = self_proc_cfg
                trace_cfg.target_process = tar_proc_cfg
                trace_cfg.trace_keys = []
                for self_col, self_sub, tar_col, tar_sub in zip(self_col_cfgs, self_substrs, tar_col_cfgs, tar_substrs):
                    trace_key_cfg = CfgTraceKey()
                    trace_cfg.trace_keys.append(trace_key_cfg)

                    # self
                    trace_key_cfg.self_column = self_col
                    if self_sub:
                        trace_key_cfg.self_column_substr_from = self_sub[0]
                        trace_key_cfg.self_column_substr_to = self_sub[1]

                    # target
                    trace_key_cfg.target_column = tar_col
                    if tar_sub:
                        trace_key_cfg.target_column_substr_from = tar_sub[0]
                        trace_key_cfg.target_column_substr_to = tar_sub[1]

        return None

    def set_machine_filter(self, filter_type, machine_info, filter_cfg: CfgFilter):
        if not machine_info:
            return None

        machine_cfg = CfgFilter()
        machine_cfg.filter_type = CfgFilterType.MACHINE_ID.name

        # detail
        machine_cfg.filter_details = []
        dic_details = machine_info.get('line-list') or {}
        for line_detail_id, detail_info in dic_details.items():
            value_list = detail_info.get('value_list')
            value_masters = detail_info.get('value_masters')
            detail_cfgs, _ = self.set_filter_details(None, value_list, value_masters)
            for detail_cfg in detail_cfgs:
                parents = list(filter(lambda x: x.filter_condition == line_detail_id, filter_cfg.filter_details))
                detail_cfg.parent = parents[0]
                machine_cfg.filter_details.append(detail_cfg)

        return machine_cfg

    def set_filter(self, filter_type, filter_info):
        filter_cfg = CfgFilter()

        filter_cfg.filter_type = filter_type
        sql_statements = filter_info.get('sql_statements')
        value_list = filter_info.get('value_list')
        value_masters = filter_info.get('value_masters')
        filter_details, dic_chart_info_key = self.set_filter_details(sql_statements, value_list, value_masters)
        filter_cfg.filter_details = filter_details

        return filter_cfg, dic_chart_info_key

    @staticmethod
    def gen_filter_info_from_sql_statement(sql_statement: str):
        value = sql_statement.lstrip('_').lstrip('%').lstrip(SQL_REGEX_PREFIX).rstrip('%')

        filter_position = None
        if sql_statement.startswith('_') and sql_statement.endswith('%'):
            filter_function = FilterFunc.SUBSTRING.name
            filter_position = len(list(takewhile(lambda c: c == '_', sql_statement))) + 1
            value = sql_statement.lstrip('_').rstrip('%')
        elif sql_statement.startswith(SQL_REGEX_PREFIX):
            filter_function = FilterFunc.REGEX.name
            value = sql_statement.lstrip(SQL_REGEX_PREFIX)
        elif sql_statement.startswith('%') and sql_statement.endswith('%'):
            filter_function = FilterFunc.CONTAINS.name
            value = sql_statement.lstrip('%').rstrip('%')
        elif sql_statement.startswith('%'):
            filter_function = FilterFunc.ENDSWITH.name
            value = sql_statement.lstrip('%')
        elif sql_statement.endswith('%'):
            filter_function = FilterFunc.STARTSWITH.name
            value = sql_statement.rstrip('%')
        else:
            filter_function = FilterFunc.MATCHES.name
            value = sql_statement

        return value, filter_function, filter_position

    def set_filter_details(self, sql_statements, value_list, value_masters):
        detail_cfgs = []
        dic_chart_info_key = {}
        for statement, filter_old_id, name in zip_longest(sql_statements or [], value_list or [], value_masters or []):
            detail_cfg = CfgFilterDetail()
            detail_cfg.name = name
            if statement:
                value, func, pos = self.gen_filter_info_from_sql_statement(statement)
            else:
                value = filter_old_id
                func = FilterFunc.MATCHES.name
                pos = None

            detail_cfg.filter_condition = value
            detail_cfg.filter_function = func
            detail_cfg.filter_from_pos = pos
            # TODO: check visualization exist and add
            detail_cfgs.append(detail_cfg)

            # for chart info
            dic_chart_info_key[filter_old_id] = detail_cfg

        return detail_cfgs, dic_chart_info_key

    @staticmethod
    def set_visualization(dic_chart_infos, control_column, dic_cfg_details):
        visual_cfgs = []
        for key, chart_info in dic_chart_infos.items():
            visual_cfg = CfgVisualization()
            visual_cfg.lcl = chart_info.get('thresh-low')
            visual_cfg.ucl = chart_info.get('thresh-high')
            visual_cfg.lpcl = chart_info.get('prc-min')
            visual_cfg.upcl = chart_info.get('prc-max')
            visual_cfg.ymax = chart_info.get('y-max')
            visual_cfg.ymin = chart_info.get('y-min')
            visual_cfg.control_column = control_column
            filter_detail_cfg = dic_cfg_details.get(key)
            if filter_detail_cfg:
                visual_cfg.filter_detail = filter_detail_cfg
                visual_cfg.filter_column = filter_detail_cfg.cfg_filter.column

            visual_cfgs.append(visual_cfg)
        return visual_cfgs

    @staticmethod
    def get_filter_type(key):
        if 'line' in key:
            return CfgFilterType.LINE.name

        if 'machine' in key:
            return CfgFilterType.MACHINE_ID.name

        if 'partno' in key:
            return CfgFilterType.PART_NO.name

        if 'other' in key:
            return CfgFilterType.OTHER.name

        return None


class TileInterfaceYaml(YamlConfig, metaclass=Singleton):
    """
    Tile Interface Yaml class
    """

    # keywords
    # VERSION = 'version'

    def __init__(self, dn7=True):
        if dn7:
            super().__init__(dic_yaml_config_file[YAML_TILE_INTERFACE_DN7])
        else:
            super().__init__(dic_yaml_config_file[YAML_TILE_INTERFACE_AP])
