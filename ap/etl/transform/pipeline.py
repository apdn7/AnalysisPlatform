from ap.api.setting_module.services.software_workshop_etl_services import (
    POSTGRES_SOFTWARE_WORKSHOP_DEF,
    SNOWFLAKE_SOFTWARE_WORKSHOP_DEF,
)
from ap.etl.transform import TransformPipeline
from ap.etl.transform.software_workshop import (
    SoftwareWorkshopJsonTransformer,
    SoftwareWorkshopReplaceCodeToNameTransformer,
    SoftwareWorkshopReplaceCodeToNameTransformerLocal,
    SoftwareWorkshopSnowflakeAddMasterDataTransformer,
    SoftwareWorkshopSnowflakeAddMasterDataTransformerLocal,
)
from ap.etl.transform.v2 import V2HistoryTransformer, V2MeasurementTransformer


def software_workshop_snowflake_measurement_transform_pipeline(
    *, data_source_id: int, process_factid: str, add_missing_columns: bool
):
    return TransformPipeline(
        SoftwareWorkshopJsonTransformer(
            expected_json_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.measurements,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.string_measurements,
            ],
            expected_columns_from_json=['code', 'value', 'unit'],
        ),
        SoftwareWorkshopSnowflakeAddMasterDataTransformer(
            data_source_id=data_source_id,
            process_factid=process_factid,
        ),
        SoftwareWorkshopReplaceCodeToNameTransformer(
            software_workshop_def=SNOWFLAKE_SOFTWARE_WORKSHOP_DEF,
            data_source_id=data_source_id,
            process_factid=process_factid,
            code='code',
            add_missing_columns=add_missing_columns,
        ),
        V2MeasurementTransformer(
            master_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_name,
            ],
            index_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.event_time,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.serial_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            horizontal_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.lot_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.tray_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.created_at,
            ],
            name_column='code',
            value_column='value',
            unit_column='unit',
        ),
    )


def software_workshop_snowflake_measurement_transform_pipeline_local(*, process_id: int):
    return TransformPipeline(
        SoftwareWorkshopJsonTransformer(
            expected_json_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.measurements,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.string_measurements,
            ],
            expected_columns_from_json=['code', 'value', 'unit'],
        ),
        SoftwareWorkshopSnowflakeAddMasterDataTransformerLocal(process_id=process_id),
        SoftwareWorkshopReplaceCodeToNameTransformerLocal(
            process_id=process_id,
            code='code',
            meas_item_code=SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.meas_item_code,
            meas_item_name=SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.meas_item_name,
        ),
        V2MeasurementTransformer(
            master_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_name,
            ],
            index_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.event_time,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.serial_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            horizontal_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.lot_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.tray_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.created_at,
            ],
            name_column='code',
            value_column='value',
            unit_column='unit',
        ),
    )


def software_workshop_snowflake_history_transform_pipeline(*, data_source_id: int, process_factid: str):
    return TransformPipeline(
        SoftwareWorkshopJsonTransformer(
            expected_json_columns=[SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.components],
            expected_columns_from_json=['part_no', 'lot_no', 'tray_no', 'serial_no'],
        ),
        SoftwareWorkshopSnowflakeAddMasterDataTransformer(
            data_source_id=data_source_id,
            process_factid=process_factid,
        ),
        V2HistoryTransformer(
            index_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.event_time,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.serial_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            sub_part_no_column='part_no',
            sub_lot_no_column='lot_no',
            sub_tray_no_column='tray_no',
            sub_serial_no_column='serial_no',
        ),
    )


def software_workshop_snowflake_history_transform_pipeline_local(*, process_id: int):
    return TransformPipeline(
        SoftwareWorkshopJsonTransformer(
            expected_json_columns=[SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.components],
            expected_columns_from_json=['part_no', 'lot_no', 'tray_no', 'serial_no'],
        ),
        SoftwareWorkshopSnowflakeAddMasterDataTransformerLocal(process_id=process_id),
        V2HistoryTransformer(
            index_columns=[
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.factory_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.line_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.child_equip_name,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.event_time,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.serial_no,
                SNOWFLAKE_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            sub_part_no_column='part_no',
            sub_lot_no_column='lot_no',
            sub_tray_no_column='tray_no',
            sub_serial_no_column='serial_no',
        ),
    )


def software_workshop_postgres_measurement_transform_pipeline(
    *, data_source_id: int, process_factid: str, add_missing_columns: bool
):
    return TransformPipeline(
        # TODO: add more transformer to this
        SoftwareWorkshopReplaceCodeToNameTransformer(
            software_workshop_def=POSTGRES_SOFTWARE_WORKSHOP_DEF,
            data_source_id=data_source_id,
            process_factid=process_factid,
            code='code',
            add_missing_columns=add_missing_columns,
        ),
        V2MeasurementTransformer(
            master_columns=[
                POSTGRES_SOFTWARE_WORKSHOP_DEF.factory_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.factory_name,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.line_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.line_name,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.child_equip_name,
            ],
            index_columns=[
                POSTGRES_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.event_time,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.serial_no,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            horizontal_columns=[
                POSTGRES_SOFTWARE_WORKSHOP_DEF.lot_no,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.tray_no,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.created_at,
            ],
            name_column='code',
            value_column='value',
            unit_column='unit',
        ),
    )


def software_workshop_postgres_history_transform_pipeline():
    return TransformPipeline(
        V2HistoryTransformer(
            index_columns=[
                POSTGRES_SOFTWARE_WORKSHOP_DEF.factory_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.factory_name,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.line_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.line_name,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.child_equip_id,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.child_equip_name,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.event_time,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.serial_no,
                POSTGRES_SOFTWARE_WORKSHOP_DEF.part_no,
            ],
            sub_part_no_column='sub_part_no',
            sub_lot_no_column='sub_lot_no',
            sub_tray_no_column='sub_tray_no',
            sub_serial_no_column='sub_serial_no',
        ),
    )
