import os

from flask import Blueprint, render_template, send_from_directory
from flask_babel import get_locale

from ap.common.common_utils import resource_path
from ap.common.constants import *
from ap.common.yaml_utils import TileInterfaceYaml, YamlConfig
from ap.tile_interface.services.utils import section_infor_with_lang

tile_interface_blueprint = Blueprint(
    'tile_interface',
    __name__,
    template_folder=os.path.join('..', 'templates', 'tile_interface'),
    static_folder=os.path.join('..', 'static', 'tile_interface'),
    static_url_path=os.path.join(os.sep, 'static', 'tile_interface'),
    url_prefix='/ap',
)


@tile_interface_blueprint.route('/')
@tile_interface_blueprint.route('/tile_interface/<tile_type>')
def tile_interface(tile_type=None):
    current_lang = get_locale()
    if not current_lang:
        return False

    is_usage = tile_type and tile_type == SEARCH_USAGE

    tile_interface_yml = TileInterfaceYaml(tile_type)
    tile_master = TileInterfaceYaml(TILE_MASTER)
    dic_config = tile_interface_yml.dic_config
    master_info = tile_master.dic_config

    sections = YamlConfig.get_node(dic_config, [SECTIONS])
    if sections:
        sections = section_infor_with_lang(
            sections, current_lang, is_usage=is_usage, master_info=master_info
        )

    output_dict = {'title': 'Analysis Platform', 'sections': sections}
    if is_usage:
        return render_template('tile_search_by_use.html', **output_dict)

    return render_template('tile_dashboard.html', **output_dict)


@tile_interface_blueprint.route('/tile_interface/resources/<image>')
def tile_resource(image):
    dir_image = resource_path('ap', 'config', 'image', level=AbsPath.SHOW)
    return send_from_directory(dir_image, image)
