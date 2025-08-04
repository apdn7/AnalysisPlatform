/**
 * @file Base of JSpreadsheet functions for Visualization Config table.
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 * @contributor Nguyen Huu Tuan <tuannh@fpt.com>
 * @contributor Pham Minh Hoang <hoangpm6@fpt.com>
 */
const tableId = 'filterConfigTable';
const FILTER_CONFIG_COLUMNS = {
    id: 'id',
    filter_id: 'filter_id',
    process_id: 'process_id',
    column_id: 'column_id',
    name: 'name', // filter_name
    filter_type: 'filter_type',
    filter_condition: 'filter_condition',
    filter_function: 'filter_function',
    filter_from_pos: 'filter_from_pos',
    delete_button: 'delete_button',
    order: 'order',
};
const GraphConfigColumns = {
    control_column_id: 'control_column_id',
    control_column_name: 'control_column_name',
    filter_column_id: 'filter_column_id',
    filter_column_name: 'filter_column_name',
    filter_detail_id: 'filter_detail_id',
    filter_value: 'filter_value',
    lcl: 'lcl',
    ucl: 'ucl',
    lpcl: 'lpcl',
    upcl: 'upcl',
    ymin: 'ymin',
    ymax: 'ymax',
    act_from: 'act_from',
    act_to: 'act_to',
    delete_button: 'delete_button',
    id: 'id',
    order: 'order',
    target: 'target',
    condition: 'condition',
    control_line: 'control_line',
    action_line: 'action_line',
    graph_axis_range: 'graph_axis_range',
    valid: 'valid',
};
const trackingHeaders = [
    GraphConfigColumns.control_column_name,
    GraphConfigColumns.filter_column_name,
    GraphConfigColumns.filter_value,
    GraphConfigColumns.lcl,
    GraphConfigColumns.ucl,
    GraphConfigColumns.lpcl,
    GraphConfigColumns.upcl,
    GraphConfigColumns.ymin,
    GraphConfigColumns.ymax,
    GraphConfigColumns.act_from,
    GraphConfigColumns.act_to,
];

class SpreadSheetVisualizationConfigData {
    constructor(dataObj = {}) {
        const {
            id = null,
            control_column_id = null,
            control_column_name = '',
            filter_column_id = '',
            filter_column_name = '',
            filter_detail_id = null,
            filter_value = '',
            lcl = null,
            ucl = '',
            lpcl = null,
            upcl = null,
            ymin = null,
            ymax = null,
            act_from = null,
            act_to = null,
            order = null,
            delete_button = null,
        } = dataObj;
        this.id = id;
        this.control_column_id = control_column_id || dictColumnName[control_column_name];
        this.control_column_name = control_column_name;
        this.filter_column_id = filter_column_id || dictColumnName[filter_column_name];
        this.filter_column_name = filter_column_name;
        this.filter_detail_id = filter_detail_id || dictFilterCondition[filter_value];
        this.filter_value = filter_value;
        this.lcl = lcl;
        this.ucl = ucl;
        this.lpcl = lpcl;
        this.upcl = upcl;
        this.ymin = ymin;
        this.ymax = ymax;
        this.act_from = act_from ? formatDateTime(act_from, 'YYYY-MM-DD HH:mm') : '';
        this.act_to = act_to ? formatDateTime(act_to, 'YYYY-MM-DD HH:mm') : '';
        this.order = order;
        this.delete_button = delete_button || deleteIcon;
    }
}

/**
 * @param {any} element
 */
const spreadsheetVisualizationConfig = (element) => {
    return new SpreadSheetVisualizationConfig(element);
};

/**
 * SpreadSheetVisualizationConfig
 * @property {JspreadSheetTable} table
 */
class SpreadSheetVisualizationConfig {
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
     * @returns {SpreadSheetVisualizationConfig}
     */
    static create(tableId, data) {
        const options = SpreadSheetVisualizationConfig.options();
        const table = JspreadSheetTable.createTable(
            tableId,
            options.columns,
            data,
            options.nestedHeaders,
            options.customEvents,
            options.customOptions,
        );
        table.addFilter();
        table.takeSnapshotForTracingChanges(trackingHeaders);
        handleSearchFilterInTable(tableId);
        spreadsheetVisualizationConfig(tableId);
    }

    /**
     * collect data from filter config speadsheet
     * @returns {SpreadSheetVisualizationConfigData[]}
     */

    collectDataTable() {
        const dataRows = this.table.collectDataTable();
        return dataRows.map((rowData) => new SpreadSheetVisualizationConfigData(rowData));
    }

    /**
     * Check whether this spreadsheet is valid
     * @return {boolean}
     */
    isValid() {
        return this.table.isValid();
    }

    /**
     * Get all rows that are not readonly.
     * @returns {ExcelTableRow[]}
     */
    nonReadonlyRows() {
        return this.table.findRows({
            [FILTER_CONFIG_COLUMNS.is_checked]: (cell) => !cell.td.classList.contains('readonly'),
        });
    }

    /**
     * Get all columns needed to be search
     * @return {string[]}
     */
    searchableHeaders() {
        const visibleHeaders = this.table.getVisibleHeaders();
        return visibleHeaders
            .filter(
                (header) =>
                    // Do not search sample data
                    !header.name.startsWith(SAMPLE_DATA_KEY) &&
                    // Do not search `true`, `false` values in `is_checked` cells
                    header.name !== FILTER_CONFIG_COLUMNS.is_checked,
            )
            .map((header) => header.name);
    }

    loadHeaderStatus() {
        // add icon sort
        const spreadsheet = this.table;
        const headerSort = [
            GraphConfigColumns.control_column_name,
            GraphConfigColumns.filter_column_name,
            GraphConfigColumns.filter_value,
            GraphConfigColumns.lcl,
            GraphConfigColumns.ucl,
            GraphConfigColumns.lpcl,
            GraphConfigColumns.upcl,
            GraphConfigColumns.ymin,
            GraphConfigColumns.ymax,
            GraphConfigColumns.act_from,
            GraphConfigColumns.act_to,
        ];
        headerSort.forEach((headerName, index) => {
            let tdEle = spreadsheet.getTableHeaderElement(headerName);
            if ([GraphConfigColumns.control_column_name, GraphConfigColumns.act_from].includes(headerName)) {
                tdEle.classList.add('required');
            }
            tdEle.innerHTML = `
                <span>${tdEle.innerHTML}</span>
                <span id="sortCol-${index}" idx="${index}" class="mr-1 sortCol" title="Sort" >
                    <i id="asc-${index}" class="fa fa-sm fa-play asc" ></i >
                    <i id="desc-${index}" class="fa fa-sm fa-play desc" ></i >
                </span>`;
        });
        spreadsheet.sortInHeaderColumn();
    }

    loadCSS() {
        // Do not show shadow border
        const tableContent = this.table.getTableContentElement();
        tableContent.style.removeProperty('box-shadow');
    }

    /**
     * Add class depend on column name for rows
     * @param {...ExcelTableRow} rows
     */
    updateColumnClassName(...rows) {
        const columnClasses = {};
        columnClasses[GraphConfigColumns.control_column_name] = ['column-control-column-name'];
        columnClasses[GraphConfigColumns.filter_column_name] = ['column-filter-column-name'];
        columnClasses[GraphConfigColumns.filter_value] = ['column-filter-value'];
        columnClasses[GraphConfigColumns.lcl] = ['column-lcl'];
        columnClasses[GraphConfigColumns.ucl] = ['column-ucl'];
        columnClasses[GraphConfigColumns.lpcl] = ['column-lpcl'];
        columnClasses[GraphConfigColumns.upcl] = ['column-upcl'];
        columnClasses[GraphConfigColumns.ymin] = ['column-ymin'];
        columnClasses[GraphConfigColumns.ymax] = ['column-ymax'];
        columnClasses[GraphConfigColumns.act_from] = ['column-act-from'];
        columnClasses[GraphConfigColumns.act_to] = ['column-act-to'];
        columnClasses[GraphConfigColumns.delete_button] = ['column-delete-button', 'jexcel_row'];

        // Set classes into table body cells
        for (const row of rows) {
            Object.entries(columnClasses).forEach(([columnName, classes]) => {
                const cellObj = row[columnName];
                cellObj.td.classList.add(...classes);
            });
        }

        // Set classes into table header cells
        Object.entries(columnClasses).forEach(([columnName, classes]) => {
            const cellElement = this.table.getTableHeaderElement(columnName);
            cellElement.classList.add(...classes);
        });
    }

    /**
     * Handle search input in table.
     * @param {string} value
     * @param {string} key
     */
    handleSearchInput(value, key) {
        const searchableHeaders = this.searchableHeaders();

        const matchedRows = this.table.findMatchedDataRows(value, searchableHeaders);
        const allRows = this.table.getRowsByHeadersAndIndexes();

        const matchedTableRows = $(matchedRows.map(tableRowFromExcelRow));
        const allTableRows = $(allRows.map(tableRowFromExcelRow));

        if (key === 'Enter') {
            // Show all rows and mark them as gray
            allTableRows.show();
            allTableRows.addClass('gray');

            // Remove gray for matches rows
            matchedTableRows.removeClass('gray');
        } else {
            // Hide all rows and remove gray
            allTableRows.hide();
            allTableRows.removeClass('gray');

            // Show matches rows
            matchedTableRows.show();
        }
    }

    /**
     * Check if this table has any changes
     * TODO: see isHasChange implementation in `SpreadSheetVisualizationConfig` to implement for process name, data source name as well.
     * @return {boolean}
     */
    isHasChange() {
        if (!currentProcess) {
            // New process, always mark as "has changes"
            return true;
        }

        return this.table.isHasChange(SpreadSheetVisualizationConfig.trackingHeaders());
    }

    /**
     * paste all data in spreadsheet
     * @param {SpreadSheetVisualizationConfigData []} pasteDataRows - data
     * @param {boolean} excludeHiddenColumn - hidden cell/column will be not copy values
     * @return {String}
     */
    pasteAll(pasteDataRows, excludeHiddenColumn = true, addNewRow = true) {
        const currentTableDataRows = this.collectDataTable();
        currentTableDataRows.forEach((dataRow, index) => {
            if (pasteDataRows[index]) {
                pasteDataRows[index].id = dataRow.id;
            }
        });
        // clear table
        this.table.destroyTable();
        SpreadSheetVisualizationConfig.create(filterElements.graphCfgTableName, pasteDataRows);
    }

    /**
     * Return options for constructing table.
     * @returns {{customEvents: (function(): {onbeforechange: function(*, *, *, *, *): *, updateTable: function(*, *, *, *, *, *, *): void, onload: function(*): void}), columns: [{name: string, type: string},{name: string, type: string},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): *), setValue: (function(*, *): *), createCell: (function(*): *), openEditor: *}, width: string, name: string, type: string, title: string},{width: string, name: string, readOnly: boolean, type: string, title: *},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): string), setValue: *, openEditor: *}, width: string, name: string, options: {}, type: string, title: *},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null], customOptions: {tableOverflow: boolean, copyCompatibility: boolean, tableWidth: string, stripHTMLOnCopy: boolean, freezeColumns: number}, nestedHeaders}}
     */
    static options() {
        const customColumn = {
            // Methods
            closeEditor: function (cell, save) {
                const input = cell.children[0];
                return input != null ? input.value : cell.innerHTML;
            },
            openEditor: function (cell) {
                // Create input
                const element = document.createElement('input');

                // add class DATETIME_PICKER
                element.classList.add('DATETIME_PICKER');
                element.setAttribute('is-show-time-picker', 'True');
                element.setAttribute('autocomplete', 'off');
                element.value = cell.innerHTML;
                const $element = $(element);

                // Update cell
                cell.classList.add('editor');
                cell.innerHTML = '';
                cell.appendChild(element);
                const $cell = $(cell);

                // Init picker and show popup
                initializeDateTimePicker(null, true, $cell);
                const pickerObject = $element.data('daterangepicker');
                const $pickerElement = $('div.daterangepicker');
                $pickerElement.appendTo($cell);
                const nativeMoveFn = pickerObject.move;
                let calledTime = 0;
                pickerObject.move = () => {
                    // This function will be called 2 times by native library to calculate axis of picker to show.
                    // Therefore, we must stop calling this function from 3 times and keep position of picker
                    if (calledTime > 1) return;
                    nativeMoveFn.call(pickerObject);
                    const offset = $pickerElement.offset();
                    offset.top -= 220;
                    $pickerElement.offset(offset);
                    calledTime += 1;
                    if (calledTime === 2) {
                        // unset left (only set right: 0px - by default) to display date-range-picker in one line
                        $pickerElement.css('left', 'unset');
                        // after the second called, the picker need to be shown fully in table
                        $pickerElement[0].scrollIntoView();
                    }
                };
                pickerObject.show();

                $element.on('click', () => pickerObject.show.call(pickerObject)); // force to show picker again if user on click in input element
                $element.on('apply.daterangepicker', function (ev, picker) {
                    const time = picker.startDate.format(DATETIME_PICKER_FORMAT);
                    element.value = time;
                    cell.innerHTML = time;
                    setTimeout(function () {
                        cell.closest('div.jexcel_container').jexcel.closeEditor(cell, true);
                    });
                });

                // Focus on the element
                element.focus();
            },
            getValue: function (cell) {
                return cell.innerHTML;
            },
            setValue: function (cell, value) {
                cell.innerHTML = value;
            },
        };
        const dropdownFilter = function (instance, cell, c, r, source) {
            const spreadsheet = spreadsheetVisualizationConfig(instance);
            const filterColumnIndex = spreadsheet.table.getIndexHeaderByName(GraphConfigColumns.filter_column_name);
            const filterColumnName = spreadsheet.table.getDataFromCoords(filterColumnIndex, r);
            return dictFilterDetail[filterColumnName] || [];
        };

        const columns = [
            {
                type: 'dropdown',
                width: '250',
                name: GraphConfigColumns.control_column_name,
                title: $('#i18nVariableName').text(),
                source: targetColumnSource,
                autocomplete: true,
                customFilter: true,
            },

            {
                type: 'dropdown',
                width: '250',
                name: GraphConfigColumns.filter_column_name,
                title: $('#i18nVariableName').text(),
                source: filterColumnSource,
                autocomplete: true,
                customFilter: true,
            },
            {
                type: 'dropdown',
                width: '150',
                name: GraphConfigColumns.filter_value,
                title: $('#i18nValue').text(),
                source: allFilterDetailSource,
                filter: dropdownFilter,
                autocomplete: true,
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.lcl,
                title: $('#i18nLower').text(),
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.ucl,
                title: $('#i18nUpper').text(),
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.lpcl,
                title: $('#i18nLower').text(),
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.upcl,
                title: $('#i18nUpper').text(),
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.ymin,
                title: $('#i18nMinValue').text(),
                customFilter: true,
            },
            {
                type: 'numeric',
                width: '100',
                name: GraphConfigColumns.ymax,
                title: $('#i18nMaxValue').text(),
                customFilter: true,
            },
            {
                type: 'text',
                width: '220',
                name: GraphConfigColumns.act_from,
                title: $('#i18nDatetimeFrom').text(),
                options: { format: 'YYYY-MM-DD HH:mm', time: true },
                editor: customColumn,
                customFilter: true,
            },
            {
                type: 'text',
                width: '220',
                name: GraphConfigColumns.act_to,
                title: $('#i18nDatetimeTo').text(),
                options: { format: 'YYYY-MM-DD HH:mm', time: true },
                editor: customColumn,
                customFilter: true,
            },
            {
                type: 'html',
                width: '30',
                name: GraphConfigColumns.delete_button,
                title: ' ',
                readOnly: true,
            },
            {
                type: 'hidden',
                name: GraphConfigColumns.control_column_id,
            },
            {
                type: 'hidden',
                name: GraphConfigColumns.filter_column_id,
            },
            {
                type: 'hidden',
                name: GraphConfigColumns.filter_detail_id,
            },
            {
                type: 'hidden',
                name: GraphConfigColumns.id,
            },
            {
                type: 'hidden',
                name: GraphConfigColumns.order,
            },
        ];
        const nestedHeaders = [
            [
                {
                    title: $('#i18nTarget').text(),
                    name: GraphConfigColumns.target,
                    colspan: '1',
                },
                {
                    title: $('#i18nCondition').text(),
                    colspan: '2',
                    name: GraphConfigColumns.condition,
                },
                {
                    title: $('#i18nControlLine').text(),
                    colspan: '2',
                    name: GraphConfigColumns.control_line,
                },
                {
                    title: $('#i18nActionLine').text(),
                    colspan: '2',
                    name: GraphConfigColumns.action_line,
                },
                {
                    title: $('#i18nGraphAxisRange').text(),
                    colspan: '2',
                    name: GraphConfigColumns.graph_axis_range,
                },
                {
                    title: $('#i18nValid').text(),
                    colspan: '2',
                    name: GraphConfigColumns.valid,
                },
                {
                    title: ' ',
                    colspan: '1',
                    name: GraphConfigColumns.delete_button,
                },
            ],
        ];

        // get first index of sample data
        const customOptions = {
            // tableOverflow: true,
            // tableHeight: 'calc(100vh - 370px)',
            // tableWidth: '100%',
        };

        const customEvents = {
            onbeforechange: (instance, cell, c, r, value) => {
                const spreadsheet = jspreadsheetTable(instance);
                const header = spreadsheet.getHeaderByIndex(c);
                let formatValue = stringNormalization(value);
                if (
                    [
                        GraphConfigColumns.lcl,
                        GraphConfigColumns.ucl,
                        GraphConfigColumns.lpcl,
                        GraphConfigColumns.upcl,
                        GraphConfigColumns.ymin,
                        GraphConfigColumns.ymax,
                    ].includes(header.name)
                ) {
                    // paste float
                    formatValue = parseFloat(formatValue);
                    if (isNaN(formatValue)) {
                        formatValue = '';
                    }
                } else if ([GraphConfigColumns.act_from, GraphConfigColumns.act_to].includes(header.name)) {
                    formatValue = formatDateTime(formatValue, 'YYYY-MM-DD HH:mm', {
                        withMillisecs: true,
                        isLocalTime: true,
                    });
                    if (formatValue === 'Invalid date') {
                        formatValue = '';
                    }
                }
                return formatValue;
            },
            onchange: (instance, cell, c, r, value) => {
                const spreadsheet = jspreadsheetTable(instance);
                const header = spreadsheet.getHeaderByIndex(c);
                let fillId = null;
                if (header.name == GraphConfigColumns.control_column_name) {
                    fillId = dictColumnName[value];
                    const filterControlColumnIdCell = spreadsheet.getCellByHeaderAndIndex(
                        GraphConfigColumns.control_column_id,
                        r,
                    ).td;
                    spreadsheet.updateCell(filterControlColumnIdCell, fillId, true);
                } else if (header.name == GraphConfigColumns.filter_value) {
                    fillId = dictFilterCondition[value];
                    const filterDetailIdCell = spreadsheet.getCellByHeaderAndIndex(
                        GraphConfigColumns.filter_detail_id,
                        r,
                    ).td;
                    spreadsheet.updateCell(filterDetailIdCell, fillId, true);
                } else if (header.name == GraphConfigColumns.filter_column_name) {
                    fillId = dictColumnName[value];
                    const filterColumnIdCell = spreadsheet.getCellByHeaderAndIndex(
                        GraphConfigColumns.filter_column_id,
                        r,
                    ).td;
                    spreadsheet.updateCell(filterColumnIdCell, fillId, true);
                    // set filter value is empty
                    const filterValueCell = spreadsheet.getCellByHeaderAndIndex(GraphConfigColumns.filter_value, r).td;
                    spreadsheet.updateCell(filterValueCell, '', true);
                }
            },
            oninsertrow: (instance, rowNumber, numOfRows, rowRecords, insertBefore) => {
                rowRecords.forEach((row) => {
                    const table = jspreadsheetTable(filterElements.graphCfgTableName);
                    const deleteColIdx = table.getIndexHeaderByName(GraphConfigColumns.delete_button);
                    row[deleteColIdx].innerHTML = deleteIcon;
                });
                const rowIndexes = rowRecords.map((tds) => {
                    const td = _.first(tds);
                    return td.dataset.y;
                });
                const spreadsheet = spreadsheetVisualizationConfig(instance);
                const allRows = spreadsheet.table.getRowsByHeadersAndIndexes(undefined, rowIndexes);
                spreadsheet.updateColumnClassName(...allRows);
            },
            onload: (instance) => {
                const firstElementChild = instance.jexcel.thead.firstElementChild.children;
                firstElementChild[1].classList.add('hint-text'); // 1: index of target column
                firstElementChild[1].setAttribute('title', $('#i18nTargetHoverMsg').text());
                firstElementChild[2].classList.add('hint-text');
                firstElementChild[2].setAttribute('title', $('#i18nConditionHoverMsg').text());
                firstElementChild[3].classList.add('hint-text', 'red');
                firstElementChild[3].setAttribute('title', $('#i18nThresholdConfigHoverMsg').text());
                firstElementChild[4].classList.add('hint-text', 'blue');
                firstElementChild[4].setAttribute('title', $('#i18nProcessThresholdHoverMsg').text());
                firstElementChild[6].classList.add('hint-text');
                firstElementChild[6].setAttribute('title', $('#i18nValidHoverMsg').text());
                const spreadsheet = spreadsheetVisualizationConfig(instance);
                const allRows = spreadsheet.table.getRowsByHeadersAndIndexes();
                spreadsheet.updateColumnClassName(...allRows);
                spreadsheet.loadCSS();
                // add icon sort
                spreadsheet.loadHeaderStatus();
            },
        };

        return {
            columns,
            nestedHeaders,
            customEvents,
            customOptions,
        };
    }
}
