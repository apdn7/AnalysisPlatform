from __future__ import annotations

import os

from setup_for_e2e_utils import (
    replace_basic_config_file,
    clear_old_screenshot_folders,
    find_unused_port,
    create_screenshot_folder,
    get_web_port,
    create_screenshot_folder_local,
    change_port_for_web,
    change_screenshots_folder,
    copy_init_database_to_instance_folder
)


def setup(branch_name: str | None) -> None:
    if branch_name:
        replace_basic_config_file()
        clear_old_screenshot_folders()
        web_port = find_unused_port()
        screenshots_folder = create_screenshot_folder(branch_name)
    else:
        web_port = get_web_port()
        screenshots_folder = create_screenshot_folder_local()

    change_port_for_web(web_port, is_local=not branch_name)
    change_screenshots_folder(screenshots_folder)
    copy_init_database_to_instance_folder()


if __name__ == '__main__':
    pipe_line_branch_name = os.getenv('CI_COMMIT_REF_NAME')
    merge_request_source_branch = os.getenv('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME')
    branch_name = pipe_line_branch_name or merge_request_source_branch
    setup(branch_name)
