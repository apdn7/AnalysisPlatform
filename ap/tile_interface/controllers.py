import os

from flask import Blueprint, render_template, send_from_directory
from flask_babel import get_locale

from ap.common.common_utils import resource_path
from ap.common.constants import *
from ap.common.yaml_utils import YamlConfig, TileInterfaceYaml
from ap.tile_interface.services.utils import sectionInforWithLang

tile_interface_blueprint = Blueprint(
    'tile_interface',
    __name__,
    template_folder=os.path.join('..', 'templates', 'tile_interface'),
    static_folder=os.path.join('..', 'static', 'tile_interface'),
    static_url_path=os.path.join(os.sep, 'static', 'tile_interface'),
    url_prefix='/ap'
)


@tile_interface_blueprint.route('/')
@tile_interface_blueprint.route('/tile_interface/<tile_type>')
def tile_interface(tile_type=None):
    current_lang = get_locale()
    if not current_lang:
        return False

    dn7_interface = True
    if tile_type and tile_type != DN7_TILE:
        dn7_interface = False

    tile_interface_yml = TileInterfaceYaml(dn7_interface)
    dic_config = tile_interface_yml.dic_config

    sections = YamlConfig.get_node(dic_config, [SECTIONS])
    if sections:
        sections = sectionInforWithLang(sections, current_lang)

    output_dict = {
        'title': 'Analysis Platform',
        'sections': sections
    }
    return render_template('tile_dashboard.html', **output_dict)


@tile_interface_blueprint.route('/tile_interface/resources/<image>')
def tile_resource(image):
    dir_image = resource_path('ap', 'config', 'image', level=AbsPath.SHOW)
    return send_from_directory(dir_image, image)
