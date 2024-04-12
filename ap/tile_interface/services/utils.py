from ap.common.constants import (
    COLUMN,
    DESCRIPTION,
    ENG,
    EXAMPLE,
    HOVER,
    ICON_PATH,
    LINK_ADD,
    MAX_COL_IN_TILES,
    MAX_COL_IN_USAGE,
    PAGE,
    PNG_PATH,
    ROW,
    TILE_RESOURCE_URL,
    TILES,
    TITLE,
)


def section_infor_with_lang(sections, language, is_usage, master_info):
    title_lang = default_lang = f'{TITLE}_{ENG}'  # en as default language
    hover_current_lang = hover_default_lang = f'{HOVER}_{ENG}'
    eg_lang = eg_default_lang = f'{EXAMPLE}_{ENG}'
    desc_lang = desc_default_lang = f'{DESCRIPTION}_{ENG}'
    if language:
        title_lang = f'{TITLE}_{language}'
        hover_current_lang = f'{HOVER}_{language}'
        eg_lang = f'{EXAMPLE}_{language}'
        desc_lang = f'{DESCRIPTION}_{language}'

    max_cols = MAX_COL_IN_TILES if not is_usage else MAX_COL_IN_USAGE
    for section in sections:
        section[TITLE] = section[title_lang] if title_lang in section else section[default_lang]
        section[EXAMPLE] = (
            section[eg_lang] if eg_lang in section else (section[eg_default_lang] if eg_default_lang in section else '')
        )
        section[ICON_PATH] = TILE_RESOURCE_URL + section[ICON_PATH] if ICON_PATH in section else ''
        tile_rows = 0
        for tile in section[TILES]:
            page = tile[PAGE]
            tile[PNG_PATH] = TILE_RESOURCE_URL + master_info[page][PNG_PATH]
            tile[LINK_ADD] = master_info[page][LINK_ADD] or ''
            current_hover = (
                master_info[page][hover_current_lang]
                if (hover_current_lang in master_info[page])
                else master_info[page][hover_default_lang]
            )
            current_hover = current_hover.replace('"', '&quot;')
            tile[HOVER] = current_hover.replace('\\n', '&#10;')
            if int(tile[ROW]) > tile_rows:
                tile_rows = int(tile[ROW])

        tiles_by_row = [None] * tile_rows
        for i in range(tile_rows):
            row_dat = [None] * max_cols  # maximum cols in row
            rows_index = [i for i, v in enumerate(row_dat)]
            for tile in section[TILES]:
                page = tile[PAGE]
                tile[TITLE] = (
                    master_info[page][title_lang]
                    if title_lang in master_info[page]
                    else master_info[page][default_lang]
                )
                tile[DESCRIPTION] = (
                    tile[desc_lang]
                    if desc_lang in tile
                    else (tile[desc_default_lang] if desc_default_lang in tile else '')
                )
                tile_col = int(tile[COLUMN]) - 1
                tile_row = int(tile[ROW]) - 1
                if tile_col in rows_index and tile_row == i:
                    row_dat[tile_col] = tile

            tiles_by_row[i] = row_dat
        section[TILES] = tiles_by_row
    return sections


def get_tile_master_with_lang(tile_master, current_lang):
    i18n_els = [TITLE, HOVER]
    master_info = {}
    for page in tile_master:
        for ele in i18n_els:
            locale_key = f'{ele}_{current_lang}'
            if locale_key not in tile_master[page]:
                locale_key = f'{ele}_{ENG}'  # default eng
            tile_master[page][ele] = tile_master[page][locale_key]
        master_info[page] = {
            'title': tile_master[page][TITLE],
            'png_path': tile_master[page][PNG_PATH],
            'hover': tile_master[page][HOVER],
            'link_address': tile_master[page][LINK_ADD],
        }

    return master_info
