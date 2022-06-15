import re

import markdown2
from flask import Markup


def markdown_to_html(markdown_file_path):
    extras = ['tables', 'header-ids', 'footnotes', 'code-color',
              'link-pattern', 'markdown-in-html', 'numbering', 'wiki-tables']

    css, html = split_css_html(markdown_file_path)
    html = markdown2.markdown(html, extras=extras)
    return Markup(css), Markup(html)


def split_css_html(about_fpath):
    print('about_fpath', about_fpath)
    regex_css = r'\<style[^>]*>.*\<\/style[ ]*>'

    with open(about_fpath, 'r', encoding='utf-8') as f:
        md = f.read()

    css = re.search(regex_css, md, re.DOTALL)
    if css:
        css = add_about_class(css[0])
    else:
        css = ''

    html = re.sub(r'(\<style[^>]*>)', '<!-- \\1', md)
    html = re.sub(r'(\<\/style[ ]*>)', '\\1 -->', html)

    return css, html


def add_about_class(css):
    output = re.sub(r'(.*{)', '.about \\1', css, re.DOTALL)
    return output
