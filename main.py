import contextlib
import os
import sys
from datetime import UTC
from pathlib import Path

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from loguru import logger

root = os.path.dirname(Path(__file__).resolve())
if root not in sys.path:
    sys.path.insert(0, root)


from ap import (
    SHUTDOWN,
    create_app,
    dic_config,
    is_internal_version,
    max_graph_config,
)
from ap.common import multiprocess_sharing
from ap.common.cache.handler import CacheHandler
from ap.common.constants import ANALYSIS_INTERFACE_ENV, PORT
from ap.common.event_listeners import EventListener
from ap.common.jobs.executor import mark_finished_job_done
from ap.common.multiprocess_sharing import EventQueue
from ap.common.services.sse import MessageAnnouncer
from ap.configs.schema import BasicConfigYaml, StartUpYaml

env = os.environ.get(ANALYSIS_INTERFACE_ENV, 'prod')

is_main = __name__ == '__main__'

app = create_app(f'config.{env.capitalize()}Config', is_main)

basic_config_yaml = BasicConfigYaml.from_app(app)
start_up_yaml = StartUpYaml.from_app(app)

if is_main:
    from datetime import datetime, timedelta

    from ap import scheduler
    from ap.common.check_available_port import check_available_port
    from ap.common.clean_expired_request import add_job_delete_expired_request
    from ap.common.clean_old_data import add_job_delete_old_zipped_log_files, add_job_zip_all_previous_log_files
    from ap.common.common_utils import bundle_assets
    from ap.common.constants import APP_DB_FILE, CfgConstantType
    from ap.common.db_maintenance import add_backup_dbs_job
    from ap.common.memoize import clear_cache
    from ap.common.trace_data_log import (
        EventAction,
        EventCategory,
        EventType,
        Location,
        send_gtag,
    )
    from ap.script.unlock_db import unlock_db

    python_main_start_time = datetime.now()
    multiprocess_sharing.start_sharing_instance_server()

    port = start_up_yaml.setting_startup.port
    if not port:
        port = basic_config_yaml.info.port_no or app.config.get(PORT)

    check_available_port(port)

    dic_config[PORT] = int(port)

    # update interrupt jobs by shutdown immediately
    with app.app_context():
        from ap.setting_module.models import JobManagement

        with contextlib.suppress(Exception):
            JobManagement.update_interrupt_jobs()

    logger.debug('SCHEDULER START')

    # Mark executed and error jobs as completed
    # We might need to handle EVENT_JOB_MISSED if misfire_grace_time is set
    scheduler.add_listener(mark_finished_job_done, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    EventQueue.add_event_listeners(
        EventListener.add_job,
        EventListener.reschedule_job,
        EventListener.remove_job,
        EventListener.run_function,
        EventListener.clear_cache,
        EventListener.background_announce,
        EventListener.shutdown_app,
        EventListener.kill_job,
    )
    EventQueue.start_listening()

    MessageAnnouncer.start_background_cleanup_streamers()

    true_values = [True, 'true', '1', 1]

    # import yaml
    with app.app_context():
        # init cfg_constants for usage_disk
        from ap.api.setting_module.services.import_function_column import (
            reschedule_update_transaction_table,
        )
        from ap.api.setting_module.services.polling_frequency import (
            add_delete_transaction_data_job,
            add_idle_monitoring_job,
            change_polling_all_interval_jobs,
        )
        from ap.api.trace_data.services.proc_link import proc_link_count_job
        from ap.setting_module.models import CfgConstant
        from ap.trace_data.transaction_model import create_all_transaction_tables

        # unlock db
        try:
            CfgConstant.create_or_update_by_type(
                const_type=CfgConstantType.CHECK_DB_LOCK.name,
                const_value=datetime.now(),
            )
            # raise Exception() # testing db lock
        except Exception as e1:
            logger.exception(e1)
            try:
                unlock_db(dic_config[APP_DB_FILE])
            except Exception as e2:
                logger.exception(e2)

        CfgConstant.initialize_disk_usage_limit()
        CfgConstant.initialize_max_graph_constants()
        CfgConstant.initialize_import_limit()

        for key, _ in max_graph_config.items():
            max_graph_config[key] = CfgConstant.get_value_by_type_first(key, int)

        create_all_transaction_tables()
        reschedule_update_transaction_table()
        add_job_zip_all_previous_log_files()
        add_job_delete_old_zipped_log_files()
        add_idle_monitoring_job()
        change_polling_all_interval_jobs(run_now=True)

        # defer to run this a bit
        proc_link_count_job(is_user_request=True, run_time=datetime.now() + timedelta(seconds=3))

        # delete req_id created > 24h ago
        add_job_delete_expired_request()

        # add job delete limit transaction
        add_delete_transaction_data_job()

    scheduler.start()

    # BRIDGE STATION - Refactor DN & OSS version
    if is_internal_version:
        # check and update R-Portable folder
        should_update_r_lib = os.environ.get('UPDATE_R', 'false')
        if should_update_r_lib and should_update_r_lib.lower() in true_values:
            from ap.script.check_r_portable import check_and_copy_r_portable

            check_and_copy_r_portable(basic_config_yaml.info.r_path)

    # disable quick edit of terminal to avoid pause
    is_debug = app.config.get('DEBUG')
    if not is_debug and sys.platform == 'win32':
        try:
            from ap.script.disable_terminal_quickedit import disable_quickedit

            disable_quickedit()
        except Exception:
            pass

    # add job when app started
    add_backup_dbs_job()

    # BRIDGE STATION - Refactor DN & OSS version
    if is_internal_version:
        # kick R process
        from ap.script.call_r_process import call_r_process

        call_r_process()

    # clear cache
    clear_cache()

    with app.app_context():
        CacheHandler.compute(compute_process=True, compute_process_ids=True, compute_traces=True, periodic=True)

    # bundle assets
    with app.app_context():
        bundle_assets(app)

    if not app.config.get('TESTING') and sys.platform == 'win32':
        from ap.script.disable_terminal_close_button import disable_terminal_close_btn

        # hide close button of cmd
        disable_terminal_close_btn()

    try:
        app.config.update({'app_startup_time': datetime.now(UTC)})
        if env == 'dev':
            logger.info('Development Flask server !!!')
            app.run(host='0.0.0.0', port=port, threaded=True, debug=is_debug, use_reloader=False)
        else:
            from waitress import serve

            logger.info('Production Waitress server !!!')
            with app.app_context():
                # If the result of sending first Gtag is a failure,
                # the environment is deemed as unable to connect to GA
                # GA will no longer be sent after this
                if not send_gtag(
                    ec=EventCategory.APP_START.value,
                    ea=EventType.APP.value + '_lt',
                    el=Location.PYTHON.value + EventAction.START.value,
                ):
                    app.config.update({'IS_SEND_GOOGLE_ANALYTICS': False})
            python_serve_app_time = datetime.now()
            python_startup_time = python_serve_app_time - python_main_start_time
            logger.debug(f'Startup time python: {python_startup_time}')
            serve(app, host='0.0.0.0', port=port, threads=20)
    finally:
        dic_config[SHUTDOWN] = True
        logger.info('End server !!!')
