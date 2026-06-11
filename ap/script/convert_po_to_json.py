import os
import polib
import json

def convert_po_to_json():
    assets_path = os.path.join('ap', 'translations')
    output_path = os.path.join('ap', 'src', 'shared', 'i18n', 'locales')

    # Ensure the 'output' directory exists
    if not os.path.exists(output_path):
        os.makedirs(output_path)

    for lang in os.listdir(assets_path):
        po_path = os.path.join(
            assets_path,
            lang,
            "LC_MESSAGES",
            "messages.po"
        )

        po = polib.pofile(po_path)
        data = {}

        for entry in po:
            if entry.msgstr.strip():  # ignore empty translations
                data[entry.msgid] = entry.msgstr

        output_file = os.path.join(output_path, f"{lang}.json")

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    convert_po_to_json()