from histview2.common.constants import CfgFilterType, RelationShip
from histview2.setting_module.models import CfgFilter, CfgFilterDetail, make_session, get_or_create, CfgProcess, \
    insert_or_update_config, crud_config


def get_filter_request_data(params):
    process_id = params.get('processId')
    filter_id = ''.join(params.get('filterId') or [])
    filter_type = params.get('filterType')
    filter_name = params.get('filterName')
    column_id = params.get('columnName') or None
    filter_parent_detail_ids = params.get('filterDetailParentIds') or []
    filter_detail_ids = params.get('fitlerDetailIds') or []
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

    return [process_id, filter_id, filter_type, column_id,
            filter_detail_ids, filter_detail_conds, filter_detail_names,
            filter_parent_detail_ids, filter_detail_functions, filter_detail_start_froms, filter_name]


def save_filter_config(params):
    [process_id, filter_id, filter_type, column_id,
     filter_detail_ids, filter_detail_conds, filter_detail_names, filter_parent_detail_ids,
     filter_detail_functions, filter_detail_start_froms, filter_name] = get_filter_request_data(params)

    with make_session() as meta_session:
        cfg_filter = CfgFilter(**{
            'id': int(filter_id) if filter_id else None,
            'process_id': process_id,
            'name': filter_name,
            'column_id': column_id,
            'filter_type': filter_type,
        })
        cfg_filter = insert_or_update_config(meta_session, cfg_filter)
        meta_session.commit()

        filter_id = cfg_filter.id  # to return to frontend (must)

        # crud filter details
        num_details = len(filter_detail_conds)
        filter_details = []
        for idx in range(num_details):
            filter_detail = CfgFilterDetail(**{
                'id': int(filter_detail_ids[idx]) if filter_detail_ids[idx] else None,
                'filter_id': cfg_filter.id,
                'name': filter_detail_names[idx],
                'parent_detail_id': filter_parent_detail_ids[idx] or None,
                'filter_condition': filter_detail_conds[idx],
                'filter_function': filter_detail_functions[idx] or None,
                'filter_from_pos': filter_detail_start_froms[idx] or None,
            })
            filter_details.append(filter_detail)

        crud_config(meta_session=meta_session,
                    data=filter_details,
                    model=CfgFilterDetail,
                    key_names=CfgFilterDetail.id.key,
                    parent_key_names=CfgFilterDetail.filter_id.key,
                    parent_obj=cfg_filter,
                    parent_relation_key=CfgFilter.filter_details.key,
                    parent_relation_type=RelationShip.MANY)
    return filter_id


def delete_cfg_filter_from_db(filter_id):
    with make_session() as mss:
        CfgFilter.delete_by_id(mss, filter_id)
