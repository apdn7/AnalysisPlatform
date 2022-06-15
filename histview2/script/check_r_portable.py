import os
import shutil
import time
import traceback

from loguru import logger

from histview2.common.common_utils import resource_path
from histview2.common.constants import AbsPath, R_PORTABLE, YAML_INFO, YAML_R_PATH, R_LIB_VERSION
from histview2.common.logger import log_execution
from histview2.common.yaml_utils import BasicConfigYaml


def copy_with_update(src, dst, symlinks=False, ignore=None):
    """ Copy with update
    https://stackoverflow.com/questions/1868714/
    how-do-i-copy-an-entire-directory-of-files-into-an-existing-directory-using-pyth
    :param src:
    :param dst:
    :param symlinks:
    :param ignore:
    :return:
    """
    if not os.path.exists(dst):
        os.makedirs(dst)

    # # remove dest folders or files which src doesn't have
    # for item in os.listdir(dst):
    #     s = os.path.join(src, item)
    #     d = os.path.join(dst, item)
    #     if not os.path.exists(s):
    #         try:
    #             if os.path.isdir(d):
    #                 shutil.rmtree(d)
    #             else:
    #                 os.remove(d)
    #         except:
    #             pass

    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            copy_with_update(s, d, symlinks, ignore)
        else:
            # copy only new or newer files
            if not os.path.exists(d) or os.stat(s).st_mtime - os.stat(d).st_mtime > 1:
                shutil.copy2(s, d)


def should_update_r(source_dir, dest_dir):
    try:
        if not os.path.exists(dest_dir):
            return True
        if not os.path.exists(source_dir):
            return False

        src_version_file = os.path.join(source_dir, R_LIB_VERSION)
        dest_version_file = os.path.join(dest_dir, R_LIB_VERSION)
        if not os.path.exists(src_version_file):
            return False
        if not os.path.exists(dest_version_file):
            return True

        with open(src_version_file, 'r') as f:
            src_version = f.read()

        with open(dest_version_file, 'r') as f:
            dest_version = f.read()

        if dest_version < src_version:
            return True
    except:
        traceback.print_exc()

    return False


@log_execution()
def check_and_copy_r_portable():
    basic_config_yml = BasicConfigYaml()
    source = basic_config_yml.get_node(basic_config_yml.dic_config, [YAML_INFO, YAML_R_PATH])
    if not source:
        return

    start = time.time()
    project_dir = resource_path(level=AbsPath.SHOW)
    dest_r_portable_dir = os.path.join(project_dir, R_PORTABLE)
    source_r_portable_dir = os.path.join(source, R_PORTABLE)

    try:
        should_update = should_update_r(source_r_portable_dir, dest_r_portable_dir)
        print('Should update R libraries: ', should_update)
        if should_update:
            print('Copying R libraries from {src} to {dest} ...'.format(src=source_r_portable_dir,
                                                                        dest=dest_r_portable_dir))
            copy_with_update(source_r_portable_dir, dest_r_portable_dir)

            end = time.time()
            print('DONE updating R in {sec} seconds'.format(sec=(end - start)))
            logger.info('DONE updating R in {sec} seconds'.format(sec=(end - start)))
    except Exception as ex:
        traceback.print_exc()
        end = time.time()
        logger.error('ERROR updating R in {sec} seconds. Error: {err}'.format(sec=(end - start), err=ex))
