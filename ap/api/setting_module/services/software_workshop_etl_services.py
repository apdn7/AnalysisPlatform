from __future__ import annotations

import pandas as pd
import sqlalchemy as sa

from ap.common.common_utils import add_suffix_for_same_column_name
from ap.common.constants import UNDER_SCORE
from ap.common.logger import log_execution_time
from ap.common.memoize import memoize
from ap.common.pydn.dblib.db_proxy import DbProxy
from ap.setting_module.models import CfgDataSource, CfgProcess

factory_table = sa.Table(
    'fctries',
    sa.MetaData(),
    sa.Column('fctry_id', sa.TEXT),
    sa.Column('fctry_name', sa.TEXT),
)

line_groups_table = sa.Table(
    'line_grps',
    sa.MetaData(),
    sa.Column('fctry_id', sa.TEXT),
    sa.Column('line_grp_id', sa.TEXT),
)

lines_table = sa.Table(
    'lines',
    sa.MetaData(),
    sa.Column('line_id', sa.TEXT),
    sa.Column('line_name', sa.TEXT),
    sa.Column('line_grp_id', sa.TEXT),
)

equips_table = sa.Table(
    'equips',
    sa.MetaData(),
    sa.Column('equip_id', sa.TEXT),
    sa.Column('line_id', sa.TEXT),
)

child_equips_table = sa.Table(
    'child_equips',
    sa.MetaData(),
    sa.Column('child_equip_id', sa.TEXT),
    sa.Column('child_equip_name', sa.TEXT),
    sa.Column('equip_id', sa.TEXT),
)

child_equip_meas_items_table = sa.Table(
    'child_equip_meas_items',
    sa.MetaData(),
    sa.Column('child_equip_id', sa.TEXT),
    sa.Column('meas_item_code', sa.TEXT),
    sa.Column('meas_item_name', sa.TEXT),
)

quality_measurements_table = sa.Table(
    'quality_measurements',
    sa.MetaData(),
    sa.Column('quality_measurement_id', sa.BIGINT),
    sa.Column('child_equip_id', sa.TEXT),
    sa.Column('event_time', sa.TIMESTAMP),
    sa.Column('part_no', sa.TEXT),
    sa.Column('lot_no', sa.TEXT),
    sa.Column('tray_no', sa.TEXT),
    sa.Column('serial_no', sa.TEXT),
)

measurements_table = sa.Table(
    'measurements',
    sa.MetaData(),
    sa.Column('quality_measurement_id', sa.BIGINT),
    sa.Column('code', sa.TEXT),
    sa.Column('unit', sa.TEXT),
    sa.Column('value', sa.REAL),
)

string_measurements_table = sa.Table(
    'string_measurements',
    sa.MetaData(),
    sa.Column('quality_measurement_id', sa.BIGINT),
    sa.Column('code', sa.TEXT),
    sa.Column('unit', sa.TEXT),
    sa.Column('value', sa.TEXT),
)


def get_processes_stmt(limit: int | None = None):
    join_master = (
        sa.join(
            left=child_equips_table,
            right=equips_table,
            onclause=equips_table.c.equip_id == child_equips_table.c.equip_id,
        )
        .join(
            right=lines_table,
            onclause=lines_table.c.line_id == equips_table.c.line_id,
        )
        .join(
            right=line_groups_table,
            onclause=line_groups_table.c.line_grp_id == lines_table.c.line_grp_id,
        )
        .join(
            right=factory_table,
            onclause=factory_table.c.fctry_id == line_groups_table.c.fctry_id,
        )
    )

    stmt = (
        sa.select(
            [
                sa.func.concat(
                    factory_table.c.fctry_name,
                    UNDER_SCORE,
                    lines_table.c.line_name,
                    UNDER_SCORE,
                    child_equips_table.c.child_equip_name,
                ).label(CfgProcess.process_factname.name),
                child_equips_table.c.child_equip_id,
            ],
        )
        .select_from(join_master)
        .order_by(child_equips_table.c.child_equip_id)
        .distinct(child_equips_table.c.child_equip_id)
    )

    if limit is not None:
        stmt = stmt.limit(limit)

    return stmt


def get_code_name_mapping_stmt(process_factid: str):
    stmt = (
        sa.select(
            [
                child_equip_meas_items_table.c.meas_item_code,
                child_equip_meas_items_table.c.meas_item_name,
            ],
        )
        .where(child_equip_meas_items_table.c.child_equip_id == process_factid)
        .order_by(child_equip_meas_items_table.c.meas_item_code)
    )

    return stmt


def get_master_data_stmt(
    process_factid: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = 2000,
):
    join_master = (
        sa.join(
            left=quality_measurements_table,
            right=child_equips_table,
            onclause=child_equips_table.c.child_equip_id == quality_measurements_table.c.child_equip_id,
        )
        .join(
            right=equips_table,
            onclause=equips_table.c.equip_id == child_equips_table.c.equip_id,
        )
        .join(
            right=lines_table,
            onclause=lines_table.c.line_id == equips_table.c.line_id,
        )
        .join(
            right=line_groups_table,
            onclause=line_groups_table.c.line_grp_id == lines_table.c.line_grp_id,
        )
        .join(
            right=factory_table,
            onclause=factory_table.c.fctry_id == line_groups_table.c.fctry_id,
        )
    )

    conditions = []
    if process_factid is not None:
        conditions.append(quality_measurements_table.c.child_equip_id == process_factid)
    if start_date is not None:
        conditions.append(quality_measurements_table.c.event_time >= start_date)
    if end_date is not None:
        conditions.append(quality_measurements_table.c.event_time < end_date)

    stmt = sa.select(
        [
            quality_measurements_table.c.quality_measurement_id,
            quality_measurements_table.c.event_time,
            quality_measurements_table.c.part_no,
            quality_measurements_table.c.lot_no,
            quality_measurements_table.c.tray_no,
            quality_measurements_table.c.serial_no,
            factory_table.c.fctry_id,
            factory_table.c.fctry_name,
            lines_table.c.line_id,
            lines_table.c.line_name,
            child_equips_table.c.child_equip_id,
            child_equips_table.c.child_equip_name,
        ],
    ).select_from(join_master)

    if conditions:
        stmt = stmt.where(sa.and_(*conditions))

    if limit is not None:
        stmt = stmt.limit(limit)

    return stmt


def get_transaction_data_stmt(
    process_factid: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int | None = None,
    sort_by_time: bool = True,
):
    cte = get_master_data_stmt(process_factid, start_date, end_date, limit).cte('master_data')

    measurements_stmt = sa.select(
        [
            cte,
            measurements_table.c.code,
            measurements_table.c.unit,
            # need to cast data to text in order to union
            sa.cast(measurements_table.c.value, sa.sql.sqltypes.TEXT).label(measurements_table.c.value.name),
        ],
    ).select_from(
        sa.join(
            left=cte,
            right=measurements_table,
            onclause=cte.c.quality_measurement_id == measurements_table.c.quality_measurement_id,
        ),
    )

    string_measurements_stmt = sa.select(
        [
            cte,
            string_measurements_table.c.code,
            string_measurements_table.c.unit,
            string_measurements_table.c.value,
        ],
    ).select_from(
        sa.join(
            left=cte,
            right=string_measurements_table,
            onclause=cte.c.quality_measurement_id == string_measurements_table.c.quality_measurement_id,
        ),
    )

    stmt = measurements_stmt.union_all(string_measurements_stmt)
    if sort_by_time:
        stmt = stmt.order_by(stmt.c.event_time)

    return stmt


@memoize(is_save_file=True)
def get_code_name_mapping(data_source_id: int, process_factid: str) -> dict[str, str]:
    data_source = CfgDataSource.query.get(data_source_id)
    with DbProxy(data_source) as db_instance:
        stmt = get_code_name_mapping_stmt(process_factid)
        sql, params = db_instance.gen_sql_and_params(stmt)
        cols, rows = db_instance.run_sql(sql, row_is_dict=False, params=params)
    return dict(rows)


def transform_transaction_data_to_horizontal(software_workshop_vertical_df: pd.DataFrame) -> pd.DataFrame:
    # all master columns in dataframe
    master_columns = [
        factory_table.c.fctry_id.name,
        factory_table.c.fctry_name.name,
        lines_table.c.line_id.name,
        lines_table.c.line_name.name,
        child_equips_table.c.child_equip_id.name,
        child_equips_table.c.child_equip_name.name,
    ]

    # columns for getting unique records
    index_columns = [
        child_equips_table.c.child_equip_id.name,
        quality_measurements_table.c.event_time.name,
        quality_measurements_table.c.serial_no.name,
        quality_measurements_table.c.part_no.name,
    ]

    # horizontal columns in vertical dataframe
    horizontal_columns = [
        quality_measurements_table.c.lot_no.name,
        quality_measurements_table.c.tray_no.name,
    ]

    # all required columns from those columns above. We use this hack to preserve order
    required_columns = list(dict.fromkeys([*master_columns, *index_columns, *horizontal_columns]))

    # columns used for pivoting
    pivot_column = measurements_table.c.code.name
    pivot_value = measurements_table.c.value.name

    df_pivot = (
        # only select required columns, ignore unneeded ones
        software_workshop_vertical_df[[*index_columns, pivot_column, pivot_value]]
        # drop duplicated columns, to make sure pivot can work properly
        .drop_duplicates(subset=[*index_columns, pivot_column], keep='last')
        .pivot(index=index_columns, columns=pivot_column, values=pivot_value)
        .reset_index()
    )

    # merge to get master data
    df_with_master = software_workshop_vertical_df[required_columns].drop_duplicates(subset=index_columns, keep='last')
    df_horizontal = df_pivot.merge(right=df_with_master, on=index_columns)

    # sort vertical columns for better output, we don't want our data being shown as col_03 col_01 col_02
    sorted_vertical_columns = sorted(c for c in df_horizontal.columns if c not in required_columns)
    df_horizontal = df_horizontal[[*required_columns, *sorted_vertical_columns]]

    return df_horizontal


@log_execution_time()
def transform_df_for_software_workshop(df: pd.DataFrame, data_source_id: int, process_factid: str) -> pd.DataFrame:
    df = transform_transaction_data_to_horizontal(df)
    code_name_mapping = get_code_name_mapping(data_source_id, process_factid)
    code_name_mapping = add_suffix_for_same_column_name(code_name_mapping)
    for code in code_name_mapping:
        if code not in df:
            df[code] = None

    df = df.rename(columns=code_name_mapping)
    return df
