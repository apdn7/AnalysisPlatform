def get_valid_procs(procs):
    """
    Get valid process to show on selectbox 起点
    Arguments:
        procs {dict}

    Returns:
        dict -- valid process on 起点
    """
    proc_list = []
    filter_info = procs['filter_info']
    proc_master = procs['proc_master']
    ordered_proc_list = procs['proc_list'] or []

    for key in ordered_proc_list:
        if len(filter_info[key]) > 0:
            filter_time = False
            for item in filter_info[key]:
                if item.get('item_info', {}) \
                        and item['item_info'].get('type') \
                        and item['item_info']['type'] == 'datehour-range':
                    filter_time = True
            if filter_time:
                proc_list.append((key, proc_master[key]))

    return proc_list


