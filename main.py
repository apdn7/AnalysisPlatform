import contextlib
import logging
import os

from ap import SHUTDOWN, create_app, dic_config, get_basic_yaml_obj, get_start_up_yaml_obj, max_graph_config
from ap.common import multiprocess_sharing
from ap.common.constants import ANALYSIS_INTERFACE_ENV, PORT
from ap.common.event_listeners import EventListener
from ap.common.logger import LOG_FORMAT, get_log_handlers, get_log_level, is_enable_log_file
from ap.common.multiprocess_sharing import EventQueue
from ap.common.services.sse import MessageAnnouncer
from ap.script.migrate_cfg_data_source_csv import migrate_skip_head_value

env = os.environ.get(ANALYSIS_INTERFACE_ENV, 'prod')

is_main = __name__ == '__main__'

app = create_app('config.%sConfig' % env.capitalize(), is_main)

basic_config_yaml = get_basic_yaml_obj()
start_up_yaml = get_start_up_yaml_obj()

log_handlers = get_log_handlers(
    log_dir=dic_config.get('INIT_LOG_DIR'),
    log_level=get_log_level(basic_config_yaml),
    enable_log_file=is_enable_log_file(start_up_yaml),
    is_main=is_main,
)

# We set log level debug here to write many log to console.
# However, this setting does not affect to files because we force set them inside handler.
logging.basicConfig(format=LOG_FORMAT, level=logging.DEBUG, handlers=log_handlers)

logger = logging.getLogger(__name__)

if is_main:
    from datetime import datetime

    from ap import scheduler
    from ap.common.backup_db import add_backup_dbs_job
    from ap.common.check_available_port import check_available_port
    from ap.common.clean_expired_request import add_job_delete_expired_request
    from ap.common.clean_old_data import add_job_delete_old_zipped_log_files, add_job_zip_all_previous_log_files
    from ap.common.common_utils import bundle_assets
    from ap.common.constants import APP_DB_FILE, CfgConstantType
    from ap.common.memoize import clear_cache
    from ap.common.trace_data_log import (
        EventAction,
        EventCategory,
        EventType,
        Location,
        send_gtag,
    )
    from ap.script.convert_user_setting import convert_user_setting_url
    from ap.script.disable_terminal_close_button import disable_terminal_close_btn
    from ap.script.hot_fix.fix_db_issues import unlock_db

    multiprocess_sharing.start_sharing_instance_server()

    port = None

    dic_start_up = start_up_yaml.dic_config
    if dic_start_up:
        port = dic_start_up['setting_startup'].get('port', None)

    if not port:
        port = basic_config_yaml.dic_config['info'].get('port-no') or app.config.get(PORT)

    check_available_port(port)

    dic_config[PORT] = int(port)

    # update interrupt jobs by shutdown immediately
    with app.app_context():
        from ap.setting_module.models import JobManagement

        with contextlib.suppress(Exception):
            JobManagement.update_interrupt_jobs()

    logger.debug('SCHEDULER START')

    scheduler.start()

    EventQueue.add_event_listeners(
        EventListener.add_job,
        EventListener.reschedule_job,
        EventListener.remove_job,
        EventListener.run_function,
        EventListener.clear_cache,
        EventListener.background_announce,
        EventListener.shutdown_app,
    )
    EventQueue.start_listening()

    MessageAnnouncer.start_background_cleanup_streamers()

    # Universal DB init
    # init_db(app)

    true_values = [True, 'true', '1', 1]

    # import yaml
    with app.app_context():
        # init cfg_constants for usage_disk
        from ap.api.setting_module.services.polling_frequency import (
            add_idle_mornitoring_job,
            change_polling_all_interval_jobs,
        )
        from ap.api.trace_data.services.proc_link import add_restructure_indexes_job
        from ap.setting_module.models import CfgConstant

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

        # convert_user_setting()
        convert_user_setting_url()
        migrate_skip_head_value()

        CfgConstant.initialize_disk_usage_limit()
        CfgConstant.initialize_max_graph_constants()

        for key, _ in max_graph_config.items():
            max_graph_config[key] = CfgConstant.get_value_by_type_first(key, int)

        add_job_zip_all_previous_log_files()
        add_job_delete_old_zipped_log_files()
        add_idle_mornitoring_job()
        add_restructure_indexes_job()

        interval_sec = CfgConstant.get_value_by_type_first(CfgConstantType.POLLING_FREQUENCY.name, int)
        if interval_sec:
            change_polling_all_interval_jobs(interval_sec, run_now=True)

        # delete req_id created > 24h ago
        add_job_delete_expired_request()

    # TODO : OSS
    # check and update R-Portable folder
    # should_update_r_lib = os.environ.get('UPDATE_R', 'false')
    # if should_update_r_lib and should_update_r_lib.lower() in true_values:
    #     from ap.script.check_r_portable import check_and_copy_r_portable
    #
    #     check_and_copy_r_portable()

    # disable quick edit of terminal to avoid pause
    is_debug = app.config.get('DEBUG')
    if not is_debug:
        try:
            from ap.script.disable_terminal_quickedit import disable_quickedit

            disable_quickedit()
            # from ap.script.hide_exe_root_folder import hide_bundle_folder, heartbeat_bundle_folder
            # heartbeat_bundle_folder()
            # hide_bundle_folder()
        except Exception:
            pass

    # add job when app started
    add_backup_dbs_job()

    # TODO : OSS
    # kick R process
    # from ap.script.call_r_process import call_r_process
    #
    # call_r_process()

    # clear cache
    clear_cache()

    # bundle assets
    with app.app_context():
        bundle_assets(app)

    if not app.config.get('TESTING'):
        # hide close button of cmd
        disable_terminal_close_btn()

    try:
        app.config.update({'app_startup_time': datetime.utcnow()})
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
            serve(app, host='0.0.0.0', port=port, threads=20)
    finally:
        dic_config[SHUTDOWN] = True
        logger.info('End server !!!')
