/**
 * @file Base of JSpreadsheet functions for Filter Config table.
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 * @contributor Nguyen Huu Tuan <tuannh@fpt.com>
 * @contributor Pham Minh Hoang <hoangpm6@fpt.com>
 */
const FILTER_CONFIG_COLUMNS = {
    id: 'id',
    process_id: 'process_id',
    column_id: 'column_id',
    column_name: 'column_name',
    filter_function: 'filter_function',
    filter_id: 'filter_id',
    value: 'value',
    filter_from_pos: 'filter_from_pos',
    order: 'order',
    delete_button: 'delete_button',
};
const conditionFormula = {
    andSearch: { value: 'AND_SEARCH', i18n: $('#filterAndSearch').text() },
    orSearch: { value: 'OR_SEARCH', i18n: $('#filterOrSearch').text() },
    substring: { value: 'SUBSTRING', i18n: $('#i18nPartialMatch').text() },
    matches: { value: 'MATCHES', i18n: $('#filterMatches').text() },
    startswith: { value: 'STARTSWITH', i18n: $('#filterStartsWith').text() },
    endswith: { value: 'ENDSWITH', i18n: $('#filterEndsWith').text() },
    contains: { value: 'CONTAINS', i18n: $('#filterContains').text() },
    regex: { value: 'REGEX', i18n: $('#filterRegex').text() },
};
const filterConditionElements = {
    addImportConditionBtn: '#procSettingModal [name=addImportCondition]',
    importFilterTable: 'importFilterTable',
};
const MAX_IMPORT_FILTER_CONDITION = 3;
const FILTER_TYPE = {
    tagInput: 0,
    singleSelect: 1,
    multipleSelect: 2,
};
const SEMICOLON_CHAR = ';';
/**
 * @param {any} element
 */
const spreadsheetFilterConfig = (element) => {
    return new SpreadSheetFilterConfig(element);
};

const setStatusButton = () => {
    const numImportCondition = $(`#${filterConditionElements.importFilterTable} tbody tr`).length;
    const isMaxCondition = numImportCondition >= MAX_IMPORT_FILTER_CONDITION;
    $(filterConditionElements.addImportConditionBtn).prop('disabled', isMaxCondition);
};

class SpreadSheetFilterConfig {
    /**
     * Internal constructor, outer should never call this.
     * @param {any} element
     */
    constructor(element) {
        this.table = jspreadsheetTable(element);
        // this.tableId = this.table.table.el.id;
    }

    /**
     * @param {string} tableId
     * @param {Object.<string, any>[]}data
     * @param {boolean} registerByFile - is this register by file?
     * @returns {SpreadSheetProcessConfig}
     */
    static create(tableId, data, { importFilter = true } = {}) {
        const options = SpreadSheetFilterConfig.options({ importFilter });
        const table = JspreadSheetTable.createTable(
            tableId,
            options.columns,
            data,
            [],
            options.customEvents,
            options.customOptions,
        );
    }

    /**
     * Check whether this spreadsheet is valid
     * @return {boolean}
     */
    isValid() {
        return this.table.isValid();
    }

    /**
     * Return options for constructing table.
     * @param {boolean} registerByFile - is this register by file?
     * @returns {{customEvents: (function(): {onbeforechange: function(*, *, *, *, *): *, updateTable: function(*, *, *, *, *, *, *): void, onload: function(*): void}), columns: [{name: string, type: string},{name: string, type: string},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): *), setValue: (function(*, *): *), createCell: (function(*): *), openEditor: *}, width: string, name: string, type: string, title: string},{width: string, name: string, readOnly: boolean, type: string, title: *},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): string), setValue: *, openEditor: *}, width: string, name: string, options: {}, type: string, title: *},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null], customOptions: {tableOverflow: boolean, copyCompatibility: boolean, tableWidth: string, stripHTMLOnCopy: boolean, freezeColumns: number}}}
     */
    static options({ importFilter = true } = {}) {
        // const processColumns = currentProcess?.columns || currentProcColumns;
        const processColumns = currentProcess?.columns || currentProcColumns || prcPreviewData?.cols;
        const filterColumnSource = processColumns?.map((column) => {
            return {
                id: column.id,
                name: column.name_en,
            };
        });
        const filterValueSource = [].concat(...Object.values(prcPreviewWith1000Data));
        const genDropdownValue = function (instance, cell, c, r, source) {
            let value = instance.jexcel.getValueFromCoords(c - 1, r);
            return prcPreviewWith1000Data[value] || [];
        };
        const filterColumnsName = function (instance, cell, c, r, source) {
            const data = instance.jexcel.getData() || [];
            const otherRows = data.filter((row, index) => index !== r);
            const columnsSelected = otherRows.map((data) => data[2]); // Index = 2: is index of column Original name
            return filterColumnSource.filter((col) => !columnsSelected.includes(col.id.toString()));
        };
        const startDigitOptions = Array.from({ length: 100 }, (_, index) => index + 1);
        const columns = [
            {
                type: 'hidden',
                name: FILTER_CONFIG_COLUMNS.id,
            },
            {
                type: 'hidden',
                name: FILTER_CONFIG_COLUMNS.process_id,
            },
            {
                type: 'dropdown',
                width: '100',
                name: FILTER_CONFIG_COLUMNS.column_id,
                title: $('#i18nColumnRawName').text(),
                // filter: filterColumnsName,
                source: filterColumnSource,
            },
            {
                // type: 'dropdown',
                type: 'text',
                width: '100',
                name: FILTER_CONFIG_COLUMNS.value,
                title: $('#i18nValue').text(),
                // filter: genDropdownValue,
                // source: filterValueSource,
                editor: SpreadSheetFilterConfig.importFilterValueCell(),
            },
            {
                type: 'dropdown',
                width: '100',
                name: FILTER_CONFIG_COLUMNS.filter_function,
                title: $('#i18nFilterType').text(),
                source: Object.entries(conditionFormula).map(([key, obj]) => ({ id: obj.value, name: obj.i18n })),
            },
            {
                type: 'dropdown',
                width: '100',
                name: FILTER_CONFIG_COLUMNS.filter_from_pos,
                title: $('#i18nStartingDigit').text(),
                source: startDigitOptions,
            },
            {
                type: 'hidden',
                name: FILTER_CONFIG_COLUMNS.order,
            },
            {
                type: 'hidden',
                name: FILTER_CONFIG_COLUMNS.filter_id,
            },
            {
                type: 'html',
                width: '35',
                name: FILTER_CONFIG_COLUMNS.delete_button,
                title: ' ',
                readOnly: true,
            },
        ];

        const customOptions = {
            tableOverflow: true,
            tableHeight: 'calc(100vh - 370px)',
            tableWidth: '100%',
            // do not copy HTML
            stripHTMLOnCopy: true,
            // only copy innerText
            copyCompatibility: true,
        };

        const customEvents = {
            onchange: (instance, cell, c, r, value) => {
                const column = instance.jexcel.options.columns[c];
                if (column?.type == 'dropdown') {
                    switch (column.name) {
                        case FILTER_CONFIG_COLUMNS.filter_function:
                            SpreadSheetFilterConfig.onChangeFilterType(instance, cell, c, r, value);
                            break;
                        case FILTER_CONFIG_COLUMNS.filter_from_pos:
                            break;
                        case FILTER_CONFIG_COLUMNS.column_id:
                            SpreadSheetFilterConfig.onChangeColumnOrgName(instance, cell, c, r, value);
                            break;
                        default:
                        // Nothing
                    }
                }
            },
            onbeforeinsertrow: (instance, cell, c, r, value) => {
                if (instance.jexcel.getData().length >= MAX_IMPORT_FILTER_CONDITION) {
                    return false;
                }
            },
            oninsertrow: (instance, rowNumber, numOfRows, rowRecords, insertBefore) => {
                const table = jspreadsheetTable(filterConditionElements.importFilterTable);
                const deleteColIdx = table.getIndexHeaderByName(FILTER_CONFIG_COLUMNS.delete_button);
                const FilterTypeColIdx = table.getIndexHeaderByName(FILTER_CONFIG_COLUMNS.filter_function);
                rowRecords.forEach((row) => {
                    row[deleteColIdx].innerHTML = deleteButton;
                });
                if (rowNumber === -1 && numOfRows === 1) {
                    // add first row
                    const tr = rowRecords[0][0].closest('tr');
                    instance.jexcel.tbody.append(tr);
                }
                rowRecords[0][5].classList.add('disabled-input');
                instance.jexcel.updateCell(FilterTypeColIdx, rowNumber + 1, conditionFormula.matches.value);
                setStatusButton();
            },
            ondeleterow: (instance, rowNumber, numOfRows, rowRecords, rowData, cellAttributes) => {
                setStatusButton();
            },
            onload: (instance) => {
                const theadFirstElementChild = instance.jexcel.thead.firstElementChild.children;
                const tbodyFirstElementChild = instance.jexcel.tbody.firstElementChild.children;
                theadFirstElementChild[5].classList.add('hint-text'); // 5: index of Type filter column
                theadFirstElementChild[5].setAttribute('title', $('#i18nSearchOptions').text());
                tbodyFirstElementChild[6].classList.add('disabled-input');

                instance.jexcel.table.parentElement.setAttribute('style', 'width: 100%;');
                instance.jexcel.table.setAttribute('style', 'width: -webkit-fill-available;');
            },
        };

        return {
            columns,
            customEvents,
            customOptions,
        };
    }
    static onChangeFilterType(instance, cell, c, r, value) {
        const cellStartingDigit = instance.jexcel.getCell([Number(c) + 1, r]);
        if (value === conditionFormula.substring.value) {
            instance.jexcel.updateCell(Number(c) + 1, r, '1');
            cellStartingDigit.classList.remove('disabled-input');
        } else {
            instance.jexcel.updateCell(Number(c) + 1, r, '');
            cellStartingDigit.classList.add('disabled-input');
        }
    }

    static onChangeColumnOrgName(instance, cell, c, r, value) {
        const columnName = jspreadsheet.getColumnNameFromId([c - 1, r]);
        instance.jexcel.setValue(columnName, value);
    }

    static findFilterCondType = (formula) => {
        if ([conditionFormula.andSearch.value, conditionFormula.orSearch.value].includes(formula)) {
            return 2;
        }
        if ([conditionFormula.matches.value, conditionFormula.contains.value].includes(formula)) {
            return 1;
        }
        return 0;
    };

    static importFilterValueCell() {
        const genInputTagHTLM = (values = []) => {
            const valueJoined = values.join(' ');
            return `<input class="form-control" type="text" value="${valueJoined}" 
                        style="max-height: 28px; background-color: #3c3c3c !important; padding: 4px"
                    >`;
        };
        const genSelectTagHTLM = (isMultipleSelect2, values = []) => {
            const valueJoined = values.join(' ');
            const elmAttr = isMultipleSelect2 ? 'multiple="multiple"' : '';
            let options = valueJoined ? `<option value="${valueJoined}">${valueJoined}</option>` : ``;
            if (isMultipleSelect2 && values.length > 1) {
                options = values.map((val) => `<option value="${val}">${val}</option>`);
            }
            return `<select name="filterValueSelect2" class="config-value-column-dropdown" 
                        style="max-height: 28px; background-color: #3c3c3c !important" 
                        ${elmAttr}>
                        ${options}
                    </select>`;
        };
        const genValueCellHTML = (filterType, values) => {
            let cellHTML = '';
            switch (filterType) {
                case FILTER_TYPE.multipleSelect:
                    // Type multiple dropdown
                    cellHTML = genSelectTagHTLM('multiple= "multiple"', values);
                    break;
                case FILTER_TYPE.tagInput:
                    // Type input
                    cellHTML = genInputTagHTLM(values);
                    break;
                default:
                    // Single dropdown
                    cellHTML = genSelectTagHTLM('', values);
                    break;
            }
            return cellHTML;
        };
        const handlerOpenEditor = (cell, configValueElm, select2Type, selectedValues) => {
            const allValues = $(`${configValueElm} option`)
                .map(function () {
                    return $(this).val();
                })
                .get();
            $(configValueElm).select2(genSelect2Param(select2Type));
            $(configValueElm).select2('open');
            $(cell).children().trigger('focus').val(selectedValues);
            $(cell).find('textarea').trigger('focus');
            $(configValueElm).val(allValues).trigger('change');
        };
        return {
            // Methods
            closeEditor: function (cell, save) {
                const isMultipleDropdown = $(cell.children[0])[0].hasAttribute('multiple');
                let value = $(cell.children[0]).val();
                if (isMultipleDropdown) {
                    value = value.join(`${SEMICOLON_CHAR} `);
                }
                cell.innerHTML = value;
                return value;
            },
            openEditor: function (cell, instance) {
                const selectedValues = cell.innerHTML;
                cell.innerHTML = '';
                const $cell = $(cell);
                const row = $cell.data('y');
                const speadsheet = spreadsheetFilterConfig(cell);
                const rowData = speadsheet.table.getRowDataByIndex(Number(row));
                const typeFilter = rowData.filter_function;
                const select2Type = SpreadSheetFilterConfig.findFilterCondType(typeFilter);
                const dropdownHTML = genValueCellHTML(select2Type, selectedValues.split(SEMICOLON_CHAR));
                const $dropdown = $(dropdownHTML);
                $cell.append($dropdown);
                handlerOpenEditor(cell, '.config-value-column-dropdown', select2Type, selectedValues);
            },
            getValue: function (cell) {
                // Nothing
            },
            setValue: function (cell, value) {
                // Nothing
            },
        };
    }
}

const deleteImportFilterRow = (ele, tableId) => {
    // get number of row
    const numberIndex = ele.closest('td').getAttribute('data-y');
    const table = jspreadsheetTable(tableId);
    table.removeRowById(numberIndex);
};

const deleteButton = `<button type="button" onclick="deleteImportFilterRow(this, '${filterConditionElements.importFilterTable}')" class="btn btn-secondary icon-btn-xs">
                                <i class="fas fa-trash-alt" style="font-size: 12px"></i>
                            </button>`;

$(() => {
    $(filterConditionElements.addImportConditionBtn).click(() => {
        const table = jspreadsheetTable(filterConditionElements.importFilterTable);
        table.addNewRow([]);
        if ($(`#${filterConditionElements.importFilterTable} tbody tr`).length >= MAX_IMPORT_FILTER_CONDITION) {
            $(filterConditionElements.addImportConditionBtn).prop('disabled', true);
        }
    });
});
