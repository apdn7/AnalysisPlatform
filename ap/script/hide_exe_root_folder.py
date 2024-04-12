import ctypes
import os
import sys

from ap.common.common_utils import resource_path
from ap.common.constants import AbsPath


# def hide_bundle_folder():
#     if not getattr(sys, "frozen", False):
#         return
#
#     file_attribute_hidden = 0x02
#     current_app_folder = resource_path(level=AbsPath.HIDE)
#     root_folder = os.path.dirname(current_app_folder)
#     ret = ctypes.windll.kernel32.SetFileAttributesW(root_folder, file_attribute_hidden)
#     if ret:
#         print("attribute set to Hidden")


# def heartbeat_bundle_folder():
#     file_ext = ".temp"
#     current_app_folder = resource_path(level=AbsPath.HIDE)
#     print("current_app_folder:", current_app_folder)
#     current_file = f"{current_app_folder}{file_ext}"
#     try:
#         with open(current_file, "w"):
#             pass
#     except Exception:
#         print("can not make .temp file")
#         pass
#
#     return current_app_folder, current_file, file_ext
