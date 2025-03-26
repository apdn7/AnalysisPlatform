from ap.setting_module.models import (
    CfgFilter,
    CfgFilterDetail,
    make_session,
)


def get_filter_request_data(params):
    process_id = params.get('processId')
    filter_id = params.get('filterId') or None
    filter_type = params.get('filterType')
    filter_name = params.get('filterName')
    column_id = params.get('columnName') or None
    filter_parent_detail_ids = params.get('filterDetailParentIds') or []
    filter_detail_ids = params.get('filterDetailIds') or []
    filter_detail_conds = params.get('filterConditions') or []
    filter_detail_names = params.get('filterDetailNames') or []
    filter_detail_functions = params.get('filterFunctions') or []
    filter_detail_start_froms = params.get('filterStartFroms') or []

    if not filter_parent_detail_ids:
        filter_parent_detail_ids = [None] * len(filter_detail_ids)
    if not filter_detail_functions:
        filter_detail_functions = [None] * len(filter_detail_ids)
    if not filter_detail_start_froms:
        filter_detail_start_froms = [None] * len(filter_detail_ids)

    return [
        process_id,
        filter_id,
        filter_type,
        column_id,
        filter_detail_ids,
        filter_detail_conds,
        filter_detail_names,
        filter_parent_detail_ids,
        filter_detail_functions,
        filter_detail_start_froms,
        filter_name,
    ]


def save_filter_config(params):
    [
        process_id,
        filter_id,
        filter_type,
        column_id,
        filter_detail_ids,
        filter_detail_conds,
        filter_detail_names,
        filter_parent_detail_ids,
        filter_detail_functions,
        filter_detail_start_froms,
        filter_name,
    ] = get_filter_request_data(params)

    with make_session() as meta_session:
        cfg_filter = CfgFilter(
            **{
                'id': int(filter_id) if filter_id else None,
                'process_id': process_id,
                'name': filter_name,
                'column_id': column_id,
                'filter_type': filter_type,
            },
        )
        filter_details = []
        for idx in range(len(filter_detail_conds)):
            filter_detail = CfgFilterDetail(
                **{
                    'id': int(filter_detail_ids[idx]) if filter_detail_ids[idx] else None,
                    'filter_id': cfg_filter.id,
                    'name': filter_detail_names[idx],
                    'parent_detail_id': filter_parent_detail_ids[idx] or None,
                    'filter_condition': filter_detail_conds[idx],
                    'filter_function': filter_detail_functions[idx] or None,
                    'filter_from_pos': filter_detail_start_froms[idx] or None,
                },
            )
            filter_details.append(filter_detail)

        cfg_filter.filter_details = filter_details
        cfg_filter = meta_session.merge(cfg_filter)

    return cfg_filter.id


def delete_cfg_filter_from_db(filter_id):
    with make_session() as mss:
        CfgFilter.delete_by_id(mss, filter_id)
