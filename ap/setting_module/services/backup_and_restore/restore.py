import pandas as pd

from ap import DATE_FORMAT_STR
from ap.api.setting_module.services.data_import import (
    gen_bulk_insert_sql,
    get_insert_params,
    insert_data,
    save_proc_data_count_multiple_dfs,
)
from ap.common.constants import AnnounceEvent
from ap.common.multiprocess_sharing import EventBackgroundAnnounce, EventQueue
from ap.common.pydn.dblib.db_proxy import DbProxy, gen_data_source_of_universal_db
from ap.setting_module.services.backup_and_restore.backup_file_manager import BackupKey, BackupKeysManager
from ap.setting_module.services.backup_and_restore.duplicated_check import (
    get_df_insert_and_duplicated_ids,
    remove_unused_columns_and_add_missing_columns,
)
from ap.trace_data.transaction_model import TransactionData


def restore_db_data(process_id, start_time, end_time):
    backup_keys_manager = BackupKeysManager(process_id=process_id, start_time=start_time, end_time=end_time)

    # TODO: get min max date in database before running this
    backup_keys = backup_keys_manager.get_backup_keys_by_day()
    total_backup_keys = len(backup_keys)

    if total_backup_keys == 0:
        # nothing to do
        yield 100

    # create transaction outside to avoid looping, we only modify `t_table` so this is fine
    transaction_data = TransactionData(process_id)
    for i, backup_key in enumerate(backup_keys):
        restore_db_data_from_file(transaction_data, backup_keys_manager, backup_key)
        yield (i + 1) * 100 / total_backup_keys

    EventQueue.put(EventBackgroundAnnounce(data=True, event=AnnounceEvent.RESTORE_DATA_FINISHED))


def restore_db_data_from_file(
    transaction_data: TransactionData,
    backup_keys_manager: BackupKeysManager,
    backup_key: BackupKey,
):
    df_file = backup_key.read_file()

    if df_file.empty:
        backup_key.delete_file()
        return

    with DbProxy(
        gen_data_source_of_universal_db(proc_id=transaction_data.process_id),
        True,
        immediate_isolation_level=True,
    ) as db_instance:
        get_date_col = transaction_data.getdate_column.bridge_column_name
        df_file[get_date_col] = pd.to_datetime(df_file[get_date_col])

        is_between = (df_file[get_date_col] >= backup_keys_manager.get_start_time(backup_key)) & (
            df_file[get_date_col] < backup_keys_manager.get_end_time(backup_key)
        )

        df_insert = df_file[is_between]
        if df_insert.empty:
            # nothing to insert
            return

        # get data from db to drop duplicates
        df_from_db: pd.DataFrame = transaction_data.get_transaction_by_time_range(
            db_instance,
            backup_keys_manager.get_start_time(backup_key),
            backup_keys_manager.get_end_time(backup_key),
        )

        # overwrite columns from database to file
        df_insert = remove_unused_columns_and_add_missing_columns(df_insert, df_from_db.columns)

        df_insert = get_df_insert_and_duplicated_ids(
            transaction_data,
            df_insert=df_insert,
            df_old=df_from_db,
        )

        if not df_insert.empty:
            sql_params = get_insert_params(df_insert.columns)
            sql_insert = gen_bulk_insert_sql(transaction_data.table_name, *sql_params)
            # need to convert to correct datetime format before inserting to database
            df_insert[get_date_col] = df_insert[get_date_col].dt.strftime(DATE_FORMAT_STR)
            insert_data(db_instance, sql_insert, df_insert.to_numpy().tolist())

        save_proc_data_count_multiple_dfs(
            db_instance,
            proc_id=backup_key.process_id,
            get_date_col=get_date_col,
            dfs_push_to_db=df_insert,
            dfs_pop_from_file=df_file[is_between],
        )

        df_file_remaining = df_file[~is_between]
        backup_key.write_file(df_file_remaining)
