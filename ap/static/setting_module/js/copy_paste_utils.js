const TAB_CHAR = '\t';
const NEW_LINE_CHAR = '\n';
const getTRDataValues = (tr) => {
    const children = [...(tr?.querySelectorAll('td:not(.d-none)') ?? [])];
    return children.map((td) => {
        const dataOriginAttr = td.dataset.origin;
        if (dataOriginAttr != null) {
            return dataOriginAttr;
        }
        const inputEl = td.querySelector('input[type="text"]');
        if (inputEl != null) {
            return inputEl.value.trim();
        }
        const selectEl = td.querySelector('option:checked');
        if (selectEl != null) {
            return selectEl.text.trim();
        }
        return td.innerText.trim();
    });
};

/**
 * parse clipboard string
 * @param {string} copiedText - clipboard string
 * @return {Array.<Array.<string>>}
 */
const transformCopiedTextToTable = (copiedText) => {
    const records = copiedText.replace(/\r\n+$/, '').split('\r\n');
    return records
        .map((rec) => rec.replace(/\t+$/, ''))
        .filter((row) => row !== '')
        .map((row) => row.split('\t'));
};

const getHeadTextTable = (tableElement) => {
    const headerTexts = [...tableElement.find('thead th')].map((th) => {
        const columnName = th.innerText.trim();
        if (th.getAttribute('colspan') == null) {
            return columnName;
        }
        const quantity = parseInt(th.getAttribute('colspan'), 10);
        return Array(quantity).fill(columnName);
    });
    return headerTexts;
};

function showHideCopyPasteButtons(elements) {
    if (window.isSecureContext) {
        elements.map((ele) => $(ele).show());
    } else {
        elements.map((ele) => $(ele).hide());
    }
}
