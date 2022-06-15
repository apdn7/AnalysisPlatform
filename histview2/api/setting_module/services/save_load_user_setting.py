import re
from collections import defaultdict
from itertools import zip_longest


class UserSettingDetail:
    def __init__(self, dic_vals):
        self.id = dic_vals.get('id')
        self.name = dic_vals.get('name')
        self.value = dic_vals.get('value')
        self.type = dic_vals.get('type')
        self.level = dic_vals.get('level')
        self.genBtnId = dic_vals.get('genBtnId')
        self.checked = dic_vals.get('checked')
        self.isActiveTab = dic_vals.get('isActiveTab')
        self.original_obj = dic_vals

    def convert_to_obj(self):
        dic_vals = {key: val for key, val in self.__dict__.items() if key != 'original_obj' and val is not None}
        return dic_vals

    def is_checkbox_or_radio(self):
        return True if self.type in ('checkbox', 'radio') else False


def transform_settings(mapping_groups):
    dic_output = {}
    for form_name, src_vals, des_vals in mapping_groups:
        vals = transform_setting(src_vals, des_vals)
        vals = [val.convert_to_obj() for val in vals]
        dic_output[form_name] = vals

    return dic_output


def transform_setting(src_vals, des_vals):
    dic_src_checkboxes, dic_src_others = group_by_name(src_vals)
    dic_des_checkboxes, dic_des_others = group_by_name(des_vals)
    checkbox_vals = mapping_checkbox_radio(dic_src_checkboxes, dic_des_checkboxes)
    other_vals = mapping_others(dic_src_others, dic_des_others)

    return other_vals + checkbox_vals


def mapping_checkbox_radio(dic_src, dic_des):
    output_vals = []
    all_keys = list(set(list(dic_src) + list(dic_des)))
    for name in all_keys:
        src_vals = dic_src.get(name, [])
        if not src_vals:
            src_vals = dic_des.get(name, [])

        output_vals.extend(src_vals)

    return output_vals


def get_pair_names(target_name, dic_vals):
    if target_name in dic_vals:
        return dic_vals[target_name]

    target_name = remove_non_str(target_name)
    target_name = target_name.lower()
    for name, vals in dic_vals.items():
        name = remove_non_str(name)
        name = name.lower()
        if vals and 'select' in vals[0].type:
            if name == target_name:
                return vals
        else:
            if name in target_name or target_name in name:
                return vals

    return []


def mapping_others(dic_src, dic_des):
    all_vals = []
    all_keys = list(set(list(dic_src) + list(dic_des)))
    for name in all_keys:
        group_vals = []
        src_vals = get_pair_names(name, dic_src)
        des_vals = get_pair_names(name, dic_des)

        if not src_vals:
            continue

        if not des_vals:
            des_vals = src_vals

        first_des_val = des_vals[0]
        des_id_str, _ = split_str_and_last_number(first_des_val.id)
        des_name_str, _ = split_str_and_last_number(first_des_val.name)
        for src_val, des_val in zip_longest(src_vals, des_vals):
            if src_val is None:
                continue

            src_val: UserSettingDetail
            des_val: UserSettingDetail

            _, src_name_num = split_str_and_last_number(src_val.name)
            _, src_id_num = split_str_and_last_number(src_val.id)
            new_obj = UserSettingDetail(first_des_val.__dict__)
            new_obj.id = des_id_str + src_id_num
            new_obj.name = des_name_str + src_name_num
            new_obj.value = src_val.value
            group_vals.append(new_obj)

        all_vals += group_vals

    return all_vals


def group_by_name(vals):
    dic_checkboxes = defaultdict(list)
    dic_others = defaultdict(list)
    for dic_vals in vals:
        setting = UserSettingDetail(dic_vals)
        if not setting.name:
            continue

        if setting.is_checkbox_or_radio():
            if setting.name == 'cat_filter':
                continue
            dic_checkboxes[setting.name.lower()].append(setting)
        else:
            short_name, _ = split_str_and_last_number(setting.name)
            short_name = short_name.lower()
            dic_others[short_name].append(setting)

    dic_checkboxes = {key: sorted(vals, key=lambda x: x.name) for key, vals in dic_checkboxes.items()}
    dic_others = {key: sorted(vals, key=lambda x: x.name) for key, vals in dic_others.items()}

    return dic_checkboxes, dic_others


def map_form(dic_src_vals, dic_des_vals):
    mapping_groups = []
    if len(dic_src_vals) == len(dic_des_vals):
        names = zip(list(dic_src_vals), list(dic_des_vals))
    else:
        src_active_form = get_active_tab(dic_src_vals)
        names = zip([src_active_form], list(dic_des_vals))

    for src_name, des_name in names:
        mapping_groups.append((des_name, dic_src_vals[src_name], dic_des_vals[des_name]))

    return mapping_groups


def map_form_bk(dic_src_vals, dic_des_vals):
    mapping_groups = []
    if len(dic_src_vals) == len(dic_des_vals):
        names = zip(list(dic_src_vals), list(dic_des_vals))
        for src_name, des_name in names:
            mapping_groups.append((des_name, dic_src_vals[src_name], dic_des_vals[des_name]))
        return mapping_groups

    for form_name, vals in dic_des_vals.items():
        if form_name in dic_src_vals:
            mapping_groups.append((form_name, dic_src_vals[form_name], vals))
        else:
            src_vals = [(len(set(form_name) & set(_form_name)), _vals) for _form_name, _vals in dic_src_vals.items()]
            src_vals = sorted(src_vals, key=lambda x: x[0])[-1]

            mapping_groups.append((form_name, src_vals[1], vals))
    return mapping_groups


def get_active_tab(dic_setting):
    tabs = []
    for form_name, vals in dic_setting.items():
        for dic_item in vals:
            is_active_tab = dic_item.get('isActiveTab', None)
            if is_active_tab is not None:
                tabs.append(is_active_tab)

        if tabs:
            break

    zip_forms = zip(list(dic_setting), tabs)
    for form_name, is_active in zip_forms:
        if is_active:
            return form_name

    return list(dic_setting.keys())[0]


def remove_non_str(val):
    return re.sub(r"[-_\d\s]", '', val)


def split_str_and_last_number(input_str):
    if not input_str:
        return [input_str, '']

    res = re.match(r'^(.*[^0-9])(\d+)$', input_str)
    if res is None:
        return [input_str, '']

    return res[1], res[2]
