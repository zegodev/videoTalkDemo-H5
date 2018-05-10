#!/usr/bin/env python -u
# coding:utf-8

import os, sys
import shutil
import fnmatch


from zegopy.common import command
from zegopy.common import io
from zegopy.builder import zip_folder


script_path = os.path.dirname(os.path.realpath(__file__))

def upload_file_to_cdn(zip_file):
    #json version
    filename = os.path.basename(zip_file)

    dest_path = "oss://zego-public/downloads/" + filename

    print("dest_path: {0}".format(dest_path))

    upload_command = "ossutilmac64 cp -rf {0} {1}".format(zip_file, dest_path)
    ok, result = command.execute(upload_command)
    if ok != 0:
        raise Exception("upload error")
    else:
        print(result)


def search_file(type):
    # get default folder from /src/static/js/jZego/
    folder = os.path.realpath(os.path.join(script_path, "src", "assets", "lib", "zego"))

    if type == "wx":
        match = "jZego-wx-*.js"
        zip_name = "jZego-wx-SDK.zip"
    elif type == "webrtc":
        match = "jZego-rtc-*.js"
        zip_name = "jZego-rtc-SDK.zip"
    else:
        raise Exception("unknow type")

    # search folder exclude file
    source_files = fnmatch.filter(os.listdir(folder), match)

    dest_files = [os.path.join(folder, item) for item in source_files]
    if len(dest_files) == 0:
        raise Exception("dest files is empty")

    result = zip_folder.zip_folder_list(dest_files, folder, zip_name)
    if result == False:
        raise Exception("zip file error")

    return os.path.join(folder, zip_name)


if __name__ == "__main__":
    
    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument("--type", action='store', help="wx/webrtc")

    arguments = parser.parse_args()

    #upload_file_to_cdn(arguments.file)
    zip_file = search_file(arguments.type)
    upload_file_to_cdn(zip_file)
    
