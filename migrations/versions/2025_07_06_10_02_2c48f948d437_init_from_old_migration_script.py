"""init from old migration script

Revision ID: 2c48f948d437
Revises:
Create Date: 2025-07-16 10:02:49.981046

"""

from alembic import op

from ap.script.convert_user_setting import convert_user_setting_url
from ap.script.migrate_cfg_data_source_csv import migrate_cfg_data_source_csv, migrate_skip_head_value
from ap.script.migrate_cfg_process import migrate_cfg_process
from ap.script.migrate_cfg_process_column import migrate_cfg_process_column
from ap.script.migrate_csv_datatype import migrate_csv_datatype
from ap.script.migrate_csv_dummy_datetime import migrate_csv_dummy_datetime
from ap.script.migrate_csv_save_graph_settings import migrate_csv_save_graph_settings
from ap.script.migrate_delta_time import migrate_delta_time_in_cfg_trace_key
from ap.script.migrate_process_file_name_column import (
    migrate_cfg_process_add_file_name,
    migrate_cfg_process_column_add_column_raw_dtype,
    migrate_cfg_process_column_add_column_raw_name,
    migrate_cfg_process_column_add_column_type,
    migrate_cfg_process_column_add_parent_id,
    migrate_cfg_process_column_change_all_generated_datetime_column_type,
)

# revision identifiers, used by Alembic.
revision = '2c48f948d437'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    ap_db_sr = op.get_bind().engine.url.database
    conn = op.get_bind()
    # migrate csv datatype
    migrate_csv_datatype(ap_db_sr)
    migrate_csv_dummy_datetime(ap_db_sr)
    migrate_csv_save_graph_settings(ap_db_sr)
    migrate_cfg_data_source_csv(ap_db_sr)
    migrate_cfg_process_add_file_name(ap_db_sr)
    migrate_cfg_process_column_add_column_raw_name(ap_db_sr)
    migrate_cfg_process_column_add_column_raw_dtype(ap_db_sr)
    migrate_cfg_process_column_add_column_type(ap_db_sr)
    migrate_cfg_process_column_add_parent_id(ap_db_sr)
    migrate_cfg_process_column(ap_db_sr)
    migrate_cfg_process(ap_db_sr)
    migrate_cfg_process_column_change_all_generated_datetime_column_type(ap_db_sr)

    # migrate delta_time
    migrate_delta_time_in_cfg_trace_key(ap_db_sr)

    # convert_user_setting()
    convert_user_setting_url(conn)
    migrate_skip_head_value(conn)


def downgrade(): ...
