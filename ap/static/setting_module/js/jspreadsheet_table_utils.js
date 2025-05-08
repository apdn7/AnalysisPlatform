/**
 * @file Base of JSpreadsheet functions for table.
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 * @contributor Nguyen Huu Tuan <tuannh@fpt.com>
 * @contributor Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * @typedef {Object} ExcelTableCell
 * @property {number} rowIndex
 * @property {number} columnIndex
 * @property {any} data
 * @property {HTMLTableCellElement} td
 */

/**
 * Row information. This is basically an object with keys as headers and values as {@link ExcelTableCell}.
 * @typedef {Object.<string, ExcelTableCell>} ExcelTableRow
 */

/**
 * @typedef {Object} TableHeader
 * @property {string} type
 * @property {string} name
 * @property {string} title
 * @property {number} index
 * @property {boolean?} ignoreCopy
 * @property {boolean?} ignorePaste
 */

/**
 * @typedef {Object} TransactionRecord
 * @property {number} historyIndex
 */

/**
 * @typedef {HTMLTableCellElement & { excelTransactionRecord: TransactionRecord }} HTMLTableCellElementWithTransaction
 */

/**
 * @typedef {Object} TableTracingChanges
 * @property {number} numberOfRows
 * @property {number[]} trackingHeaderIndexes - only tracking those headers, for performance reason
 * @property {Set<string>} changedPositions - a position of changes, in format "x,y". (Because js cannot store array in set)
 * @property {string[][]} originalData
 */

const ROW_UNCHECKED_CLASS_NAME = 'row-unchecked';
const ROW_SELECTED_CLASS_NAME = 'row-selected';
const COLUMN_IS_CHECKED_CLASS_NAME = 'column-is-checked';
const COLUMN_IS_CHECKED_HEADER = 'Selected';
const COLUMN_IS_CHECKED_TITLE = ' ';

/**
 * @param {any} element
 * @return {JspreadSheetTable}
 */
const jspreadsheetTable = (element) => {
    let table = null;

    // Try to construct the table from provided instance.
    if ((table = JspreadSheetTable.fromJspreadsheetInstanceElement(element))) {
        return table;
    }

    // Try to construct the table from table id.
    if (typeof element === 'string' && (table = JspreadSheetTable.fromTableId(element))) {
        return table;
    }

    // Try to construct the table from its child element.
    if ((table = JspreadSheetTable.fromChildElement(element))) {
        return table;
    }

    // Try to construct the table from its instance.
    if ((table = JspreadSheetTable.fromJspreadsheetInstance(element))) {
        return table;
    }

    // Still return the table with empty inner, to avoid error in application code.
    return new JspreadSheetTable(null);
};

/**
 * JspreadSheetTable
 * @property {jspreadsheet.JspreadsheetInstance} table
 * @property {TableHeader[]} headersByIndex
 * @property {Object.<string, TableHeader>} headersByName
 */
class JspreadSheetTable {
    /**
     * Internal constructor.
     * Do not call this directly from outer code.
     * @param {any} inner - inner data structure to handle excel table.
     */
    constructor(inner) {
        /** @type {?jspreadsheet.JspreadsheetInstance} */
        this.table = inner;
        this.tableId = this.table?.el.id;

        /** @type {TableHeader[]} */
        this.headersByIndex = [];
        /** @type {Object.<string, TableHeader>} */
        this.headersByName = {};

        /** @type {boolean} */
        this.loaded = false;

        /** @type {TableTracingChanges} */
        this.tableTracingChanges = {};

        if (this.table) {
            this.headersByIndex = getOrAssign(this.table.table, 'headersByIndex', () => {
                return this.table.options.columns.map((header, index) => ({ ...header, index }));
            });

            this.headersByName = getOrAssign(this.table.table, 'headersByName', () => {
                return Object.fromEntries(this.headersByIndex.map((header) => [header.name, header]));
            });

            this.loaded = getOrAssign(this.table.table, 'loaded', false);
            this.disablePasteExceedNumberOfRows = getOrAssign(
                this.table.table,
                'disablePasteExceedNumberOfRows',
                false,
            );

            this.tableTracingChanges = getOrAssign(this.table.table, 'tableTracingChanges', {});
        }
    }

    /**
     *
     * @param {jspreadsheet.JspreadsheetInstanceElement} instance
     * @return {JspreadSheetTable | null}
     */
    static fromJspreadsheetInstanceElement(instance) {
        if (_.has(instance, 'jspreadsheet')) {
            return new JspreadSheetTable(instance.jspreadsheet);
        }
        if (_.has(instance, 'jexcel')) {
            return new JspreadSheetTable(instance.jexcel);
        }
        return null;
    }

    /**
     *
     * @param {string} tableId
     * @return {JspreadSheetTable | null}
     */
    static fromTableId(tableId) {
        const element = document.getElementById(tableId);
        return this.fromJspreadsheetInstanceElement(element);
    }

    /**
     *
     * @param {any} element
     * @return {JspreadSheetTable | null}
     */
    static fromChildElement(element) {
        if (typeof element['closest'] === 'function') {
            const instance = element.closest('.jexcel_container');
            return this.fromJspreadsheetInstanceElement(instance);
        }
        return null;
    }

    /**
     *
     * @param {any} element
     * @return {JspreadSheetTable | null}
     */
    static fromJspreadsheetInstance(element) {
        if (
            typeof element === 'object' &&
            typeof element.el === 'object' &&
            element.el.nodeName === 'DIV' &&
            element.el.classList.contains('jexcel_container')
        ) {
            return new JspreadSheetTable(element);
        }
        return null;
    }

    /**
     * Create JSpreadSheet Table
     * @param {string} tableId
     * @param {Object[]} columns
     * @param {Object[]} data
     * @param {*[]} nestedHeaders
     * @param {Object} customEvents
     * @param {Object} customOptions
     * @returns {JspreadSheetTable}
     */
    static createTable(tableId, columns, data, nestedHeaders, customEvents, customOptions = {}) {
        const defaultOptions = {
            data: data || [[]],
            columns: columns,
            nestedHeaders: nestedHeaders,
            allowDeletingAllRows: true,
            columnSorting: false,
            contextMenu: function () {
                return false; // hide context menu
            },
            allowManualInsertRow: false,
            allowManualInsertColumn: false,
            allowManualDeleteRow: false,
            allowManualDeleteColumn: false,
            parseFormulas: false,
        };
        const options = {
            ...defaultOptions,
            ...(customOptions ?? {}),
        };
        const events = {
            ...(customEvents ?? {}),
            /**
             * Custom onchange event to check if the table has changes.
             * We need this because jspreadsheet does not save history for `readonly` columns,
             * while our table also needs to check for `readonly` columns as well.
             * @template T
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord[]} records
             * @param {number} c - column index
             * @param {number} r - row index
             * @param {T} newValue
             * @param {T} oldValue
             */
            onchange: (instance, records, c, r, newValue, oldValue) => {
                const spreadsheet = jspreadsheetTable(instance);
                spreadsheet.recordTracingChanges({ x: c, y: r });

                if (customEvents.onchange != null) {
                    customEvents.onchange(instance, records, c, r, newValue, oldValue);
                }
            },

            /**
             * On insert row event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {number} rowNumber
             * @param {number} numOfRows
             * @param {HTMLTableCellElement[]} rowRecords
             * @param {boolean} insertBefore
             */
            oninsertrow: (instance, rowNumber, numOfRows, rowRecords, insertBefore) => {
                if (customEvents.oninsertrow != null) {
                    customEvents.oninsertrow(instance, rowNumber, numOfRows, rowRecords, insertBefore);
                }

                // In case table is empty, insert first row into table body
                if (rowNumber === -1 && numOfRows === 1) {
                    // add first row
                    const tr = rowRecords[0][0].closest('tr');
                    instance.jexcel.tbody.append(tr);
                }
            },
            /**
             * Do some checks before pasting into our table.
             * - ignore `ignorePaste` columns
             * - ignore rows that exceed numbers of rows.
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {string} data
             * @param {number} x - column index
             * @param {number} y - row index
             * @return {string | boolean} return `false` if we don't allow pasting, otherwise return pasting data
             */
            onbeforepaste: (instance, data, x, y) => {
                const columnIndex = Number(x);
                const rowIndex = Number(y);

                let modifiedData = data;
                if (customEvents.onbeforepaste != null) {
                    modifiedData = customEvents.onbeforepaste(instance, data, columnIndex, rowIndex);
                }

                const spreadsheet = jspreadsheetTable(instance);
                const disabledPasteHeaders = spreadsheet.getHeaders().filter((header) => !!header.ignorePaste);

                let csvData = spreadsheet.table.parseCSV(data, '\t');
                // only modify if we there are data
                if (csvData.length === 0 || csvData[0].length === 0) {
                    return false;
                }

                // Do not allow copying data that exceed the last row
                if (
                    spreadsheet.disablePasteExceedNumberOfRows &&
                    rowIndex + csvData.length >= spreadsheet.numberOfRows()
                ) {
                    // Only retain rows that fit inside table
                    const numberOfRows = spreadsheet.numberOfRows() - rowIndex;
                    csvData = csvData.slice(0, numberOfRows);
                }

                const w = csvData[0].length;
                const h = csvData.length;

                if (disabledPasteHeaders.length > 0) {
                    // Replace all data in disabled paste headers by the default data
                    for (const header of disabledPasteHeaders) {
                        const headerInsidePastedRange = header.index >= columnIndex && header.index < columnIndex + w;
                        if (headerInsidePastedRange) {
                            // replace by original data
                            for (let y = 0; y < h; ++y) {
                                csvData[y][header.index - columnIndex] =
                                    spreadsheet.table.options.data[y + rowIndex][header.index];
                            }
                        }
                    }
                }

                modifiedData = csvData.map((d) => d.join('\t')).join('\n');

                return modifiedData;
            },

            /**
             * On undo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord?} historyRecord
             */
            onundo: (instance, historyRecord) => {
                const spreadsheet = jspreadsheetTable(instance);
                if (historyRecord) {
                    spreadsheet.recordTracingChanges(...historyRecord.records);
                }

                if (customEvents.onundo != null) {
                    customEvents.onundo(instance, historyRecord);
                }
            },

            /**
             * On redo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord | null} historyRecord
             */
            onredo: (instance, historyRecord) => {
                const spreadsheet = jspreadsheetTable(instance);
                if (historyRecord) {
                    spreadsheet.recordTracingChanges(...historyRecord.records);
                }

                if (customEvents.onredo != null) {
                    customEvents.onredo(instance, historyRecord);
                }
            },
        };
        const inner = jspreadsheet(document.getElementById(tableId), {
            ...options,
            ...events,
        });
        if (customEvents.onafterchangerow) {
            /** @type {?function(jspreadsheet.JspreadsheetInstance, number, Object.<string, *>)} */
            inner.options.onafterchangerow = customEvents.onafterchangerow;
        }

        return new JspreadSheetTable(inner);
    }

    /**
     * Custom checkbox and add event
     * @param {...ExcelTableRow} rows
     */
    customCheckbox(...rows) {
        const handleRowCheckedClass = (rowEle, isChecked) => {
            if (isChecked) {
                rowEle.classList.remove(ROW_UNCHECKED_CLASS_NAME);
            } else {
                rowEle.classList.add(ROW_UNCHECKED_CLASS_NAME);
            }
        };

        // add event row click
        for (const row of rows) {
            const cell = row[COLUMN_IS_CHECKED_NAME].td;
            const checkBoxElement = cell.querySelector('input');
            const rowElement = cell.parentElement;
            checkBoxElement.classList.add('custom-control-input');
            checkBoxElement.id = create_UUID();
            const labelElement = document.createElement('label');
            labelElement.classList.add('custom-control-label');
            labelElement.htmlFor = checkBoxElement.id;
            cell.appendChild(labelElement);
            handleRowCheckedClass(rowElement, checkBoxElement.checked);

            const instance = this;
            checkBoxElement.onchange = function () {
                instance.setValue(cell, checkBoxElement.checked);
                handleRowCheckedClass(rowElement, checkBoxElement.checked);
            };
        }
    }

    /**
     * Make sure this table is loaded.
     */
    setLoaded() {
        this.loaded = true;
        this.table.table.loaded = true;
    }

    /**
     * disable paste exceed number of rows
     * @type {true}
     */
    setDisablePasteExceedNumberOfRows() {
        this.disablePasteExceedNumberOfRows = true;
        this.table.table.disablePasteExceedNumberOfRows = true;
    }

    /**
     * check if this spreadsheet is valid
     * @return {boolean}
     */
    isValid() {
        return this.table !== null;
    }

    /**
     * return current number of rows of this table
     * @return {number}
     */
    numberOfRows() {
        return this.table.tbody.childElementCount;
    }

    /**
     * return current number of columns of this table
     * @return {number}
     */
    numberOfColumns() {
        // Currently do not check if data[0] invalid (empty table)
        return this.table.options.data[0].length;
    }

    /**
     * Whether tracing changes is enabled.
     * @return {boolean}
     */
    enabledTracingChanges() {
        return !_.isEmpty(this.tableTracingChanges);
    }

    /**
     * @param {string[]} trackingHeaders - only tracking those headers, for performance reason
     */
    takeSnapshotForTracingChanges(trackingHeaders) {
        const trackingHeaderIndexes = trackingHeaders.map((header) => this.getIndexHeaderByName(header));

        this.tableTracingChanges = {
            numberOfRows: this.numberOfRows(),
            changedPositions: new Set(),
            trackingHeaderIndexes,
            originalData: structuredClone(this.table.options.data),
        };

        // bind to query later
        this.table.table.tableTracingChanges = this.tableTracingChanges;
    }

    /**
     * Record the tracing changes for further analysis.
     * @param {...{x: number, y: number}} positions - x: column index, y: row index
     */
    recordTracingChanges(...positions) {
        if (!this.enabledTracingChanges()) {
            return;
        }

        const { numberOfRows, changedPositions, trackingHeaderIndexes, originalData } = this.tableTracingChanges;

        const visitedChangedKeys = new Set();

        for (const { x, y } of positions) {
            const columnIndex = Number(x);
            const rowIndex = Number(y);

            // do not track ignored indexes
            if (!trackingHeaderIndexes.includes(columnIndex)) {
                return;
            }

            const changedKey = `${rowIndex},${columnIndex}`;
            if (visitedChangedKeys.has(changedKey)) {
                continue;
            }
            visitedChangedKeys.add(changedKey);
            changedPositions.add(changedKey);

            // Try to delete old key if the new value is the same as the original value.
            // Need to be careful here in case the number of new rows exceeds the number of original rows.
            if (rowIndex < numberOfRows) {
                const newData = this.table.options.data[rowIndex][columnIndex];
                const oldData = originalData[rowIndex][columnIndex];
                if (String(newData) === String(oldData)) {
                    // the new value is changed back to original value, delete the change.
                    changedPositions.delete(changedKey);
                }
            }
        }
    }

    addFilter() {
        // construct a tr element for filtering
        this.customFilter = document.createElement('tr');
        this.customFilter.id = 'filters';
        this.customFilter.classList.add('filter-row');

        const filterElements = this.table.options.columns.map((column, index) => {
            let td = document.createElement('td');

            // only enable filter for those with `customFilter = true`
            if (column.customFilter) {
                const html = `<td data-x=${index} class="search-box">
                    <input class="form-control filterCol" data-col-idx=${index + 1} placeholder="Filter..." />
                </td>`;
                td = $.parseHTML(html)[0];
            }

            // hide filter if column is hidden
            if (column.type == 'hidden') {
                td.style.display = 'none';
            }

            return td;
        });

        this.customFilter.append(
            // the first td element is ID, its filter must be empty
            document.createElement('td'),
            // add other td elements based on defined columns
            ...filterElements,
        );

        // add those elements to the table head
        this.table.thead.appendChild(this.customFilter);
    }

    /**
     * Add New Row
     * @param {Object.<string, *>} data
     */
    addNewRow(data) {
        if (this.table) {
            const headers = this.getHeaders().map((header) => header.name);
            const dictNewRow = headers.reduce((acc, key) => {
                acc[key] = data ? data[key] : '';
                return acc;
            }, {});
            this.table.insertRow(Object.values(dictNewRow));

            if (typeof this.table.options.onafterchangerow == 'function') {
                const rowIndex = this.table.options.data.length - 1;
                this.table.options.onafterchangerow(this.table, rowIndex, dictNewRow);
            }
        }
    }

    /**
     * Update Row
     * @param {number | string} rowIndex - y
     * @param {Object} data - dict updated data of row
     * @param {boolean} force - true: allow set value for readonly cells, otherwise.
     * @param {boolean} allowHidden - true: allow set value for hidden cells, otherwise.
     */
    updateRow(rowIndex, data, force = true, allowHidden = true) {
        if (!this.table) return;

        // Summary data
        const allHeader = allowHidden ? this.getHeaders() : this.getHeaders().filter((h) => h.type !== 'hidden');
        const headers = allHeader.map((header) => header.name);
        const dictNewRow = headers.reduce((acc, key) => {
            acc[key] = data && data[key] != null ? data[key] : '';
            return acc;
        }, {});

        const records = [];
        Object.entries(dictNewRow).forEach(([columnName, value], columnIndex) => {
            // Update and keep history
            const record = this.table.updateCell(columnIndex, rowIndex, value, force);
            // Keep history
            records.push(record);
        });

        if (records.length === 0) return;

        // Update history
        this.table.setHistory({
            action: 'setValue',
            records: records,
        });

        if (typeof this.table.options.onafterchangerow == 'function') {
            this.table.options.onafterchangerow(this.table, rowIndex, dictNewRow);
        }
    }

    /**
     * get data of tableId
     * @return {Object.<string, any[]>[]}
     */
    collectDataTable() {
        return this.table.getJson();
    }

    /**
     * get cell by of rowIndex, columnIndex
     * @param {number} columnIndex - index of column
     * @param {number} rowIndex - index of row
     * @return {HTMLTableCellElement}
     */
    getCellFromCoords(columnIndex, rowIndex) {
        return this.table.getCellFromCoords(columnIndex, rowIndex);
    }

    /**
     * Get data from coordinates
     * @param {number} columnIndex
     * @param {number} rowIndex
     * @return {any}
     */
    getDataFromCoords(columnIndex, rowIndex) {
        return this.table.options.data[rowIndex][columnIndex];
    }

    /**
     * Set value from coordinates
     * @param {number} columnIndex
     * @param {number} rowIndex
     * @param {string} value - New value for the cell
     * @param {boolean} force - Update readonly columns
     */
    setValueFromCoords(columnIndex, rowIndex, value, force = false) {
        return this.table.setValueFromCoords(columnIndex, rowIndex, value, force);
    }

    /**
     * sort by column index
     * @param {number} columnIndex - id of table
     * @return {}
     */
    sortBy(columnIndex) {
        return this.table.orderBy(columnIndex);
    }

    /**
     * Not sure why we should set this edition = null,
     * but jspreadsheet set this when using `openEditor` with `checkbox`.
     */
    disableEdition() {
        this.table.edition = null;
    }

    /**
     * setValue of a certain cell.
     * @param {HTMLTableCellElement} cell
     * @param {any} value
     * @param {boolean} force
     */
    setValue(cell, value, force = false) {
        this.table.setValue(cell, value, force);
    }

    /**
     * @param {HTMLTableCellElement} cell
     * @param {any} value
     * @param {boolean} force
     */
    updateCell(cell, value, force = false) {
        this.table.updateCell(cell.dataset.x, cell.dataset.y, value, force);
    }

    /**
     * clear table
     * @return {void}
     */
    destroyTable() {
        if (this.table) {
            this.table.destroy();
        }
    }

    /**
     * Clear all records in table and clear all history
     */
    clearTable() {
        if (!this.table) return;

        _.range(0, this.table.rows.length)
            .reverse()
            .forEach((rowIndex) => {
                this.table.deleteRow(rowIndex);
            });

        this.table.rows = [];
        this.table.results = null;
        this.table.records = [];
        this.resetHistory();
        this.table.tbody.innerHTML = '';
    }

    /**
     * clear table
     * @return {}
     */
    removeSelectedRow() {
        if (this.table) {
            this.table.deleteRow();
        }
    }

    /**
     * remove row by id
     * @return {}
     */
    removeRowById(rowId) {
        if (this.table) {
            this.table.deleteRow(rowId);
        }
    }

    /**
     * copy add data in spreadsheet
     * @param {boolean} excludeOrderColumn - order cell/column will be not copy values
     * @param {boolean} excludeHiddenColumns - hidden cells/columns will be not copy values
     * @return {String}
     */
    copyAll(excludeOrderColumn = true, excludeHiddenColumns = true) {
        let dataText = '';
        try {
            this.table.rows.forEach((rowElement, rowIndex) => {
                let cellData = [];
                rowElement.childNodes.forEach((cellElement, columnIndex) => {
                    if (
                        (excludeOrderColumn && cellElement.classList.contains('jexcel_row')) || // skip order column
                        (excludeHiddenColumns && cellElement.style.display === 'none') // skip hidden columns
                    )
                        return true;

                    cellData.push(this.table.getValue(cellElement, false));
                });

                dataText += (dataText === '' ? '' : '\r\n') + cellData.join(TAB_CHAR);
            });
            this.table.textarea.value = dataText;
            this.table.textarea.select();
            document.execCommand('copy');
            showToastCopyToClipboardSuccessful();
        } catch (e) {
            showToastCopyToClipboardFailed();
        }

        return dataText;

        // USE copy(false) FUNCTION WILL ALSO COPY HIDDEN COLUMNS
        // this.table.copy(false);
    }

    /**
     * Move row
     * @param fromRowIndex {number}
     * @param toRowIndex {number}
     */

    moveRow(fromRowIndex, toRowIndex) {
        this.table.moveRow(fromRowIndex, toRowIndex);
    }

    /**
     * @param {HTMLTableCellElement} cell
     * @param {boolean} save
     */
    closeEditor(cell, save) {
        this.table.closeEditor(cell, save);
    }

    /**
     * search in table
     * @return {}
     */
    search(query) {
        if (this.table) {
            this.table.search(query);
        }
    }

    /**
     * check table has change
     * @param {string[]} checkHeaders - columns to be searched
     * @return {boolean}
     */
    isHasChange(checkHeaders) {
        // Uninitialized table or tracing is not enabled.
        if (!this.table || !this.enabledTracingChanges()) {
            return false;
        }

        // the number of rows is not matched
        if (this.tableTracingChanges.numberOfRows !== this.numberOfRows()) {
            return true;
        }

        // Only check columns that are visible to users, to avoid confusion.
        const visibleHeaders = this.getVisibleHeaders().map((h) => h.name);
        const visibleCheckHeaders = _.intersection(visibleHeaders, checkHeaders);
        const checkIndexes = new Set(visibleCheckHeaders.map((headerName) => this.getIndexHeaderByName(headerName)));

        // Create a new array to avoid modifying `Set` inplace.
        const changedPositions = Array.from(this.tableTracingChanges.changedPositions);

        for (const changedKey of changedPositions) {
            const [x, y] = changedKey.split(',');
            const rowIndex = Number(x);
            const columnIndex = Number(y);

            // This column is ignored, don't check it
            if (!checkIndexes.has(columnIndex)) {
                continue;
            }

            // Some changes in the past tried to modify rows that exceed the number of current rows.
            // However, that change isn't visible in the table, so we don't need to check it anymore.
            if (rowIndex >= this.numberOfRows()) {
                this.tableTracingChanges.changedPositions.delete(changedKey);
                continue;
            }

            const sameWithOriginalData =
                this.tableTracingChanges.originalData[rowIndex][columnIndex] ===
                String(this.table.options.data[rowIndex][columnIndex]);

            if (sameWithOriginalData) {
                // even though data is the same, it is recorded in the change lists
                // this could be due to undo / redo operations which does not call `onchange`
                this.tableTracingChanges.changedPositions.delete(changedKey);
            } else {
                return true;
            }
        }

        return false;
    }

    /**
     * reset all history up until now
     */
    resetHistory() {
        if (this.table) {
            this.table.history = [];
            this.table.historyIndex = -1;
        }
    }

    /**
     * get columns of table
     * @return {TableHeader[]}
     */
    getHeaders() {
        return this.headersByIndex;
    }

    /**
     * get column of table
     * @param {number} headerIndex
     * @return {TableHeader}
     */
    getHeaderByIndex(headerIndex) {
        return this.headersByIndex[headerIndex];
    }

    /**
     * get visible headers
     * @return {TableHeader[]}
     */
    getVisibleHeaders() {
        return this.getHeaders().filter((header) => header.type !== 'hidden');
    }

    /**
     * get header name of table
     * @return {}
     */
    getTitleHeaders() {
        const allHeader = this.getHeaders();
        const headers = [];
        allHeader.forEach((header) => {
            if (header.type !== 'hidden' && header.name !== GraphConfigColumns.delete_button) {
                headers.push(header.title);
            }
        });
        return headers;
    }

    /**
     * get column of table
     * @return {}
     */
    getNestedHeaders() {
        return this.table.getConfig().nestedHeaders;
    }

    /**
     * get index by name
     * @param {string} headerName - name of column table
     * @return {number}
     */
    getIndexHeaderByName(headerName) {
        return this.headersByName[headerName].index;
    }

    /**
     * Get all column data by column name
     * @param {string} headerName - name of column table
     * @return {any[]}
     * TODO: should we support nested header?
     */
    getColumnDataByHeaderName(headerName) {
        const columnIndex = this.getIndexHeaderByName(headerName);
        return this.table.getColumnData([columnIndex]);
    }

    /**
     * Get row element by index
     * @param {number} index
     * @return {HTMLTableRowElement}
     */
    getRowElementByIndex(index) {
        if (!this.getHeaders().length) return null;
        return this.getCellFromCoords(0, index).closest('tr');
    }

    /**
     * Get all data from row by index
     * @param {number} index
     * @return {Object.<string, any>}
     */
    getRowDataByIndex(index) {
        const rowData = {};
        for (const header of this.getHeaders()) {
            rowData[header.name] = this.getDataFromCoords(header.index, index);
        }
        return rowData;
    }

    /**
     * Infer provided headers.
     * If headers are not specified, return all headers.
     * If headers are a single string, change it to a list.
     * @param {string[] | string | undefined} headers - infer provided headers
     * @return {string[]}
     */
    inferHeaders(headers) {
        if (typeof headers === 'undefined') {
            return Object.keys(this.headersByName);
        } else if (!Array.isArray(headers)) {
            return [headers];
        } else {
            return headers;
        }
    }

    /**
     * Infer provided rowIndexes.
     * If rowIndexes are not specified, return all rowIndexes.
     * If rowIndexes are a single string, change it to a list.
     * @param {number[] | number | undefined} rowIndexes - infer provided headers
     * @return {number[]}
     */
    inferRowsIndexes(rowIndexes) {
        if (typeof rowIndexes === 'undefined') {
            return _.range(0, this.numberOfRows());
        } else if (!Array.isArray(rowIndexes)) {
            return [rowIndexes];
        } else {
            return rowIndexes;
        }
    }

    /**
     * Get {@link ExcelTableCell} elements from table.
     * @param {string[] | string | undefined} headers - specified headers.
     * @param {number[] | number | undefined} rowIndexes - which rows to select.
     * @returns {ExcelTableRow[]} Table cells for columns.
     */
    getRowsByHeadersAndIndexes(headers = undefined, rowIndexes = undefined) {
        const arrayHeaders = this.inferHeaders(headers);
        const arrayRowIndexes = this.inferRowsIndexes(rowIndexes);
        const headersAndIndexes = _.zip(
            arrayHeaders,
            arrayHeaders.map((header) => this.getIndexHeaderByName(header)),
        );

        return arrayRowIndexes.map((rowIndex) => {
            const rowCellData = headersAndIndexes.reduce((acc, [headerName, headerIndex]) => {
                const td = this.getCellFromCoords(headerIndex, rowIndex);
                const data = this.getDataFromCoords(headerIndex, rowIndex);
                return {
                    ...acc,
                    [headerName]: {
                        rowIndex,
                        columnIndex: headerIndex,
                        data,
                        td,
                    },
                };
            }, {});

            return rowCellData;
        });
    }

    /**
     * Get a {@link ExcelTableCell} element from table.
     * @param {string} header - specified headers.
     * @param {number} rowIndex - which rows to select.
     * @returns {ExcelTableCell} Table cell.
     */
    getCellByHeaderAndIndex(header, rowIndex) {
        const rows = this.getRowsByHeadersAndIndexes(header, rowIndex);
        return _.first(rows)[header];
    }

    /**
     * Get multiple {@link ExcelTableRow} from table that satisfy predicate list.
     * Select all (or any, depends on `matchAll`) rows that satisfy predicate checks.
     *
     * If no predicates are specified, get all rows.
     * @param {Object.<string, function(ExcelTableCell): boolean>?} predicates - object: header - (per-cell) condition.
     * @param {boolean} matchAll - whether to match all predicates or match any of them.
     * @returns {ExcelTableRow[]}
     */
    findRows(predicates = undefined, { matchAll = true } = {}) {
        // Return all rows if no predicates are specified.
        if (_.isEmpty(predicates)) {
            return this.getRowsByHeadersAndIndexes();
        }

        /** @param {ExcelTableRow} row */
        const shouldSelectRow = (row) => {
            if (matchAll) {
                return Object.entries(predicates).every(([header, predicate]) => predicate(row[header]));
            } else {
                return Object.entries(predicates).some(([header, predicate]) => predicate(row[header]));
            }
        };

        /** @param {ExcelTableRow} row */
        const rowIndex = (row) => {
            return _.first(Object.values(row)).rowIndex;
        };

        const rowsForCheckingConditions = this.getRowsByHeadersAndIndexes(Object.keys(predicates), undefined);
        const selectedIndexes = rowsForCheckingConditions.filter(shouldSelectRow).map(rowIndex);
        return this.getRowsByHeadersAndIndexes(undefined, selectedIndexes);
    }

    /**
     * Get all {@link ExcelTableCell} from table that satisfy predicate.
     *
     * @param {string | string[] | undefined} headers
     * @param {function(ExcelTableCell): boolean} predicate.
     * @returns {ExcelTableCell[]}
     */
    findCells(headers, predicate) {
        return this.getRowsByHeadersAndIndexes(headers).flatMap((row) => _.values(row).filter(predicate));
    }

    /**
     * @param {string} searchString
     * @param {string[]} searchHeaders
     * @return {ExcelTableRow[]}
     */
    findMatchedDataRows(searchString, searchHeaders) {
        // Only search visible headers to avoid confusion.
        const visibleHeaders = this.getVisibleHeaders().map((h) => h.name);
        const headers = _.intersection(visibleHeaders, searchHeaders);

        const searchRegex = makeRegexForSearchCondition(searchString);
        const regex = new RegExp(searchRegex.toLowerCase(), 'i');

        /** @param {ExcelTableCell} cell */
        const isCellMatched = (cell) => {
            const value = cell.data;
            const strValue = _.isNull(value) ? '' : String(value);
            return regex.test(strValue);
        };

        const headerAndPredicates = headers.map((header) => [header, isCellMatched]);
        const predicates = Object.fromEntries(headerAndPredicates);

        return this.findRows(predicates, { matchAll: false });
    }

    /**
     * @param {string} headerName
     * @return {HTMLTableCellElement}
     */
    getTableHeaderElement(headerName) {
        const headerIndex = this.getIndexHeaderByName(headerName);
        return this.table.headers[headerIndex];
    }

    /**
     * @returns {HTMLTableCellElement}
     */
    getOrderHeaderElement() {
        return this.table.thead.querySelector('td.jexcel_selectall');
    }

    /**
     * @returns {HTMLDivElement}
     */
    getTableContentElement() {
        return this.table.content;
    }

    /**
     * Start a transaction, all changes happen between the transaction will be considered as a single change.
     * @param {HTMLTableCellElementWithTransaction | HTMLTableCellElement} cell
     */
    startTransaction(cell) {
        /** @type {TransactionRecord} */
        cell.excelTransactionRecord = {
            historyIndex: this.table.historyIndex,
        };
    }

    /**
     * Close a transaction, all changes happen between the transaction will be considered as a single change.
     * @param {HTMLTableCellElementWithTransaction | HTMLTableCellElement} cell
     * @return {boolean} - whether this cell contains transaction.
     */
    closeTransaction(cell) {
        const transactionRecord = cell.excelTransactionRecord;

        if (transactionRecord) {
            this.compressHistory(transactionRecord.historyIndex + 1, this.table.historyIndex + 1);
        }

        // assign to null
        cell.excelTransactionRecord = null;
    }

    /**
     * Compress transaction in [from; to)
     * @param {number} from
     * @param {number} to
     * @return {HistoryRecord | null}
     */
    compressHistory(from, to) {
        const changes = this.table.history.slice(from, to);

        // No changes.
        if (changes.length === 0) {
            return null;
        }

        // Only handle changes with the same action
        const action = changes[0].action;
        const isSameAction = changes.every((change) => change.action === action);
        if (!isSameAction) {
            console.error('cannot compress history with different actions at the moment');
            return null;
        }

        const records = changes.flatMap((change) => change.records);

        // The compressed change is the same with the lasted change metadata (action, selectedCells, etc),
        // only the records are different.
        const compressedChange = this.table.history[to - 1];
        compressedChange.records = records;

        // Change history index to `from` and modify its history data to store the compressed change.
        this.table.historyIndex = from;
        this.table.history[from] = compressedChange;
    }

    /**
     * Collect all Process Setting to text for copy / download
     * @param {?string[]} excludeHeaders - a list of column headers that will not be collected data
     * @return {string} - a string contains all process setting info
     */
    tableText(excludeHeaders = []) {
        const visibleHeaders = this.getVisibleHeaders().map((h) => h.name);
        const headers = _.difference(visibleHeaders, excludeHeaders);

        const headerElements = headers.map((h) => this.getTableHeaderElement(h));
        const headerData = headerElements.map((h, columnIndex) => {
            return h.classList.contains(COLUMN_IS_CHECKED_CLASS_NAME) ? COLUMN_IS_CHECKED_HEADER : h.innerText;
        });
        const orderHeaderCell = this.table.headerContainer.firstElementChild;
        headerData.unshift(orderHeaderCell.innerHTML);
        const headerText = headerData.join(TAB_CHAR);

        const rows = this.getRowsByHeadersAndIndexes(headers);
        const orderBodyCells = this.table.rows.map((tr) => tr.firstElementChild);
        const bodyText = rows
            .map((row, rowIndex) => {
                const rowData = headers.map((h) => row[h].data);
                rowData.unshift(orderBodyCells[rowIndex].innerText.trim());
                return rowData.join(TAB_CHAR);
            })
            .join(NEW_LINE_CHAR);

        return [headerText, bodyText].join(NEW_LINE_CHAR);
    }

    /**
     * Handle sort event in header column
     */
    sortInHeaderColumn() {
        // handle sort
        const tableId = this.tableId;

        $(`#${tableId} .sortCol`).off('click');
        $(`#${tableId} .sortCol`).on('click', (el) => {
            el.stopPropagation();
            let asc = true;
            const sortEl = $(el.target.closest('.sortCol'));
            const isFirstClick = sortEl.attr('clicked');
            if (isFirstClick) {
                asc = false;
                sortEl.removeAttr('clicked');
            } else {
                sortEl.attr('clicked', '0');
            }

            const idx = sortEl.closest('td').attr('data-x');

            if (asc) {
                sortEl.removeClass('desc');
                sortEl.addClass('asc');
            } else {
                sortEl.removeClass('asc');
                sortEl.addClass('desc');
            }

            // Reset sort status in other cols
            const otherSortCols = $(`#${tableId}`).find(`td:not([data-x=${idx}]) .sortCol`);
            otherSortCols.removeAttr('clicked');
            otherSortCols.removeClass('asc desc');
            this.sortBy(Number(idx));
        });
    }
}

/**
 *  @param {ExcelTableRow} row
 *  @return {HTMLTableRowElement}
 */
const tableRowFromExcelRow = (row) => {
    const cell = _.first(Object.values(row));
    const td = cell.td;
    return td.closest('tr');
};
