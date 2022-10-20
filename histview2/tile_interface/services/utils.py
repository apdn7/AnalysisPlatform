from histview2.common.constants import TILE_RESOURCE_URL


def sectionInforWithLang(sections, language):
    title_lang = default_lang = 'title_en' # en as default language
    hover_current_lang = hover_default_lang = 'hover_en'
    if language:
        title_lang = 'title_' + str(language)
        hover_current_lang = 'hover_' + str(language)

    for section in sections:
        section['title'] = section[title_lang] if title_lang in section else section[default_lang]
        tile_rows = 0
        for tile in section['tiles']:
            tile['png_path'] = TILE_RESOURCE_URL + tile['png_path']
            current_hover = tile[hover_current_lang] if (hover_current_lang in tile) else tile[hover_default_lang]
            current_hover = current_hover.replace('"', '&quot;')
            tile['hover'] = current_hover.replace('\\n', '&#10;')
            if int(tile['row']) > tile_rows:
                tile_rows = int(tile['row'])

        tiles_by_row = [None] * tile_rows
        for i in range(tile_rows):
            row_dat = [None] * 4 # maximum cols in row
            rows_index = [i for i, v in enumerate(row_dat)]
            for tile in section['tiles']:
                tile['title'] = tile[title_lang] if title_lang in tile else tile[default_lang]
                tile_col = int(tile['column']) - 1
                tile_row = int(tile['row']) - 1
                if tile_col in rows_index and tile_row == i:
                    row_dat[tile_col] = tile
            tiles_by_row[i] = row_dat
        section['tiles'] = tiles_by_row
    return sections