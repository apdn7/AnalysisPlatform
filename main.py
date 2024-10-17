import contextlib
import os

from ap import MAIN_THREAD, SHUTDOWN, create_app, max_graph_config
from ap.common.constants import ANALYSIS_INTERFACE_ENV, PORT, PROCESS_QUEUE
from ap.common.logger import logger, set_log_config
from ap.common.services.notify_listen import process_listen_job
from ap.script.migrate_cfg_data_source_csv import migrate_skip_head_value

env = os.environ.get(ANALYSIS_INTERFACE_ENV, 'prod')

is_main = __name__ == '__main__'

app = create_app('config.%sConfig' % env.capitalize(), is_main)

set_log_config(is_main)

if is_main:
    from datetime import datetime

    from ap import dic_config, get_basic_yaml_obj, get_start_up_yaml_obj, scheduler
    from ap.common.backup_db import add_backup_dbs_job
    from ap.common.check_available_port import check_available_port
    from ap.common.clean_expired_request import add_job_delete_expired_request
    from ap.common.clean_old_data import add_job_delete_old_zipped_log_files, add_job_zip_all_previous_log_files
    from ap.common.common_utils import bundle_assets, init_process_queue
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

    port = None

    # delete scheduler db file because of old process queue inside
    # try:
    #     delete_file(app.config['SCHEDULER_FULL_PATH'])
    # except Exception as e:
    #     # reuse the scheduler file
    #     logger.exception(e)
    # main params
    dic_start_up = get_start_up_yaml_obj().dic_config
    if dic_start_up:
        port = get_start_up_yaml_obj().dic_config['setting_startup'].get('port', None)

    if not port:
        basic_config_yaml = get_basic_yaml_obj()
        port = basic_config_yaml.dic_config['info'].get('port-no') or app.config.get(PORT)

    check_available_port(port)

    dic_config[PORT] = int(port)

    # processes queue
    dic_config[MAIN_THREAD] = True
    dic_config[PROCESS_QUEUE] = init_process_queue()

    # update interrupt jobs by shutdown immediately
    with app.app_context():
        from ap.setting_module.models import JobManagement

        with contextlib.suppress(Exception):
            JobManagement.update_interrupt_jobs()

    print('SCHEDULER START!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')

    scheduler.start()
    process_listen_job()

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
            print('Development Flask server !!!')
            # use_reloader=False to avoid scheduler load twice
            app.run(host='0.0.0.0', port=port, threaded=True, debug=is_debug, use_reloader=False)
            # app.run(host="0.0.0.0", port=port, threaded=True, debug=is_debug)
        else:
            from waitress import serve

            print('Production Waitress server !!!')
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
        print('End server!!!')
