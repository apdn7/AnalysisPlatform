from ap.common.constants import DataColumnType, FilterFunc
from ap.setting_module.models import CfgFilter, CfgFilterDetail, CfgProcessColumn, make_session

LINE_MACHINE_PART_FILTER_TYPES = {
    DataColumnType.LINE_NAME.value: 'LINE',
    DataColumnType.LINE_NO.value: 'LINE',
    DataColumnType.EQ_NAME.value: 'MACHINE_ID',
    DataColumnType.EQ_NO.value: 'MACHINE_ID',
    DataColumnType.PART_NAME.value: 'PART_NO',
    DataColumnType.PART_NO.value: 'PART_NO',
}


def _make_filter_detail(name: str, selected_value: str) -> CfgFilterDetail:
    return CfgFilterDetail(
        name=name,
        filter_condition=selected_value,
        filter_function=FilterFunc.MATCHES.name,
        filter_from_pos=1,
    )


def _sync_filters_for_column(
    meta_session,
    column: CfgProcessColumn,
    selected_values: list[str],
) -> None:
    normalized_selected_values = [str(selected_value) for selected_value in selected_values]
    existing_filters = list(CfgFilter.get_by_process_column_id(column.id, session=meta_session))
    cfg_filter = existing_filters[0] if existing_filters else None

    if cfg_filter is None and not normalized_selected_values:
        return

    if cfg_filter is None:
        filter_type = LINE_MACHINE_PART_FILTER_TYPES.get(column.column_type, 'OTHER')
        cfg_filter = CfgFilter(
            process_id=column.cfg_process.id,
            column_id=column.id,
            name=column.column_name,
            filter_type=filter_type,
            filter_details=[],
        )
        meta_session.add(cfg_filter)

    for extra_filter in existing_filters[1:]:
        for detail in extra_filter.filter_details:
            cfg_filter.filter_details.append(detail)
        meta_session.delete(extra_filter)

    existing_by_signature: dict[tuple[str, str, str], CfgFilterDetail] = {}
    existing_by_name: dict[str, CfgFilterDetail] = {}
    {
        (
            selected_value,
            selected_value,
            FilterFunc.MATCHES.name,
        )
        for selected_value in normalized_selected_values
    }

    for detail in cfg_filter.filter_details:
        signature = (
            detail.name,
            detail.filter_condition,
            detail.filter_function or FilterFunc.MATCHES.name,
        )
        existing_by_signature[signature] = detail
        existing_by_name[detail.name] = detail

    for selected_value in normalized_selected_values:
        signature = (
            selected_value,
            selected_value,
            FilterFunc.MATCHES.name,
        )

        # Pattern 1:
        # variable + filter name + filter value + filter type from ODF
        # already match an existing registered config, so do nothing.
        if signature in existing_by_signature:
            continue

        # Pattern 3:
        # variable + filter name already exist, but this exact-match value
        # has not been registered yet, so create a new detail with `_exact_match`.
        if selected_value in existing_by_name:
            cfg_filter.filter_details.append(_make_filter_detail(f'{selected_value}_exact_match', selected_value))
        else:
            # Pattern 2:
            # no existing config uses this variable + filter name yet.
            # register a new exact-match detail under the single filter config
            # of this column.
            cfg_filter.filter_details.append(_make_filter_detail(selected_value, selected_value))


def save_selected_filters(filters: dict[int, list[str]]) -> bool:
    """
    Register selected filters in filter config

    Args:
        filters: dict[int, list[str]], key is process column id and value is selected filter detail ids

    Returns:
        status: bool, True if registration is successful
    """
    with make_session() as meta_session:
        for process_column_id, selected_values in filters.items():
            column = CfgProcessColumn.get_by_id(process_column_id, session=meta_session)
            if column is None:
                raise ValueError(f'Process column {process_column_id} does not exist')

            _sync_filters_for_column(meta_session, column, selected_values)

    return True
