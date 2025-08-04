/**
 * @file Base of JSpreadsheet functions for Function Config table.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @contributor Duong Quoc Khanh <khanhdq13@fpt.com>
 * @contributor Nguyen Huu Tuan <tuannh@fpt.com>
 */

/**
 * @typedef SpreadSheetFunctionData
 * @property {boolean} isChecked
 * @property {string} functionName
 * @property {string} systemName
 * @property {string} japaneseName
 * @property {string} localName
 * @property {string} varXName
 * @property {string} varYName
 * @property {string} coeANS
 * @property {string} coeBK
 * @property {string} coeCT
 * @property {string} note
 * @property {string} output
 * @property {string} sample_data_1
 * @property {string} sample_data_2
 * @property {string} sample_data_3
 * @property {string} sample_data_4
 * @property {string} sample_data_5
 * @property {?string} index
 * @property {?boolean} isMainSerialNo
 * @property {?boolean} isMeFunction
 * @property {string} shownName
 * @property {number | string} processColumnId
 * @property {number | string} functionId
 * @property {number | string} functionColumnId
 * @property {?string} a
 * @property {?string} b
 * @property {?string} c
 * @property {?string} n
 * @property {?string} k
 * @property {?string} s
 * @property {?string} t
 * @property {string} varXProcessColumnId
 * @property {string} varXFunctionColumnId
 * @property {?string} varYProcessColumnId
 * @property {?string} varYFunctionColumnId
 */

/**
 * @param {any} element
 */
const spreadsheetFuncConfig = (element) => {
    return new SpreadSheetFunctionConfig(element);
};

/**
 * SpreadSheetFunctionConfig
 * @property {JspreadSheetTable} table
 */
class SpreadSheetFunctionConfig {
    /**
     * A dictionary of column names
     * @type {{IsChecked: string, FunctionName: string, SystemName: string, JapaneseName: string, LocalName: string, VarXName: string, VarYName: string, CoeAns: string, CoeBk: string, CoeCt: string, Note: string, Output: string, SampleData1: string, SampleData2: string, SampleData3: string, SampleData4: string, SampleData5: string, Index: string, IsMainSerialNo: string, ProcessColumnId: string, FunctionId: string, FunctionColumnId: string, A: string, B: string, C: string, N: string, K: string, S: string, T: string, VarXProcessColumnId: string, VarXFunctionColumnId: string, VarYProcessColumnId: string, VarYFunctionColumnId: string}}
     */
    static ColumnNames = {
        // shown columns
        IsChecked: COLUMN_IS_CHECKED_NAME,
        FunctionName: 'functionName',
        SystemName: 'systemName',
        JapaneseName: 'japaneseName',
        LocalName: 'localName',
        VarXName: 'varXName',
        VarYName: 'varYName',
        CoeAns: 'coeANS',
        CoeBk: 'coeBK',
        CoeCt: 'coeCT',
        Note: 'note',
        Output: 'output',
        SampleData1: `${SAMPLE_DATA_KEY}_1`,
        SampleData2: `${SAMPLE_DATA_KEY}_2`,
        SampleData3: `${SAMPLE_DATA_KEY}_3`,
        SampleData4: `${SAMPLE_DATA_KEY}_4`,
        SampleData5: `${SAMPLE_DATA_KEY}_5`,

        // hidden columns
        Index: 'index',
        IsMainSerialNo: 'isMainSerialNo',
        IsMeFunction: 'isMeFunction',
        ShownName: 'shownName',
        ProcessColumnId: 'processColumnId',
        FunctionId: 'functionId',
        FunctionColumnId: 'functionColumnId',
        RawOutput: 'rawOutput',
        A: 'a',
        B: 'b',
        C: 'c',
        N: 'n',
        K: 'k',
        S: 's',
        T: 't',
        VarXProcessColumnId: 'varXProcessColumnId',
        VarXFunctionColumnId: 'varXFunctionColumnId',
        VarYProcessColumnId: 'varYProcessColumnId',
        VarYFunctionColumnId: 'varYFunctionColumnId',
    };

    /**
     * A dictionary of column classes
     * @type {{IsChecked: string, FunctionName: string, SystemName: string, JapaneseName: string, LocalName: string, VarXName: string, VarYName: string, CoeAns: string, CoeBk: string, CoeCt: string, Note: string, Output: string, SampleData1: string, SampleData2: string, SampleData3: string, SampleData4: string, SampleData5: string, Index: string, IsMainSerialNo: string, ProcessColumnId: string, FunctionId: string, FunctionColumnId: string, A: string, B: string, C: string, N: string, K: string, S: string, T: string, VarXProcessColumnId: string, VarXFunctionColumnId: string, VarYProcessColumnId: string, VarYFunctionColumnId: string}}
     */
    static ColumnClasses = (() => {
        const classes = {};
        // shown columns
        classes[this.ColumnNames.IsChecked] = [COLUMN_IS_CHECKED_CLASS_NAME];
        classes[this.ColumnNames.FunctionName] = ['column-function-name'];
        classes[this.ColumnNames.SystemName] = ['column-system-name'];
        classes[this.ColumnNames.JapaneseName] = ['column-japanese-name'];
        classes[this.ColumnNames.LocalName] = ['column-local-name'];
        classes[this.ColumnNames.VarXName] = ['column-var-x'];
        classes[this.ColumnNames.VarYName] = ['column-var-y'];
        classes[this.ColumnNames.CoeAns] = ['column-coe-ans'];
        classes[this.ColumnNames.CoeBk] = ['column-coe-bk'];
        classes[this.ColumnNames.CoeCt] = ['column-coe-ct'];
        classes[this.ColumnNames.Note] = ['column-note'];
        classes[this.ColumnNames.Output] = ['column-output'];
        classes[this.ColumnNames.SampleData1] = ['column-sample-data'];
        classes[this.ColumnNames.SampleData2] = ['column-sample-data'];
        classes[this.ColumnNames.SampleData3] = ['column-sample-data'];
        classes[this.ColumnNames.SampleData4] = ['column-sample-data'];
        classes[this.ColumnNames.SampleData5] = ['column-sample-data'];

        // hidden columns
        classes[this.ColumnNames.Index] = ['column-index'];
        classes[this.ColumnNames.IsMainSerialNo] = ['column-is-main-serial-no'];
        classes[this.ColumnNames.IsMeFunction] = ['column-is-me-function'];
        classes[this.ColumnNames.ShownName] = ['column-shown-name'];
        classes[this.ColumnNames.ProcessColumnId] = ['column-process-column-id'];
        classes[this.ColumnNames.FunctionId] = ['column-function-id'];
        classes[this.ColumnNames.FunctionColumnId] = ['column-function-column-id'];
        classes[this.ColumnNames.RawOutput] = ['column-raw-output'];
        classes[this.ColumnNames.A] = ['column-a'];
        classes[this.ColumnNames.B] = ['column-b'];
        classes[this.ColumnNames.C] = ['column-c'];
        classes[this.ColumnNames.N] = ['column-n'];
        classes[this.ColumnNames.K] = ['column-k'];
        classes[this.ColumnNames.S] = ['column-s'];
        classes[this.ColumnNames.T] = ['column-t'];
        classes[this.ColumnNames.VarXProcessColumnId] = ['column-var-x-process-column-id'];
        classes[this.ColumnNames.VarXFunctionColumnId] = ['column-var-x-function-column-id'];
        classes[this.ColumnNames.VarYProcessColumnId] = ['column-var-y-process-column-id'];
        classes[this.ColumnNames.VarYFunctionColumnId] = ['column-var-y-function-column-id'];
        return classes;
    })();

    /**
     * Mapping elements from function table to function config
     * @return {Object.<string, HTMLInputElement>}
     */
    static columnElements = () => {
        const elements = {};

        elements[this.ColumnNames.SystemName] = functionConfigElements.systemNameElement;
        elements[this.ColumnNames.JapaneseName] = functionConfigElements.japaneseNameElement;
        elements[this.ColumnNames.LocalName] = functionConfigElements.localNameElement;
        elements[this.ColumnNames.VarXName] = functionConfigElements.varXElement;
        elements[this.ColumnNames.VarYName] = functionConfigElements.varYElement;
        elements[this.ColumnNames.CoeAns] = functionConfigElements.coeANSElement;
        elements[this.ColumnNames.CoeBk] = functionConfigElements.coeBKElement;
        elements[this.ColumnNames.CoeCt] = functionConfigElements.coeCTElement;
        elements[this.ColumnNames.Note] = functionConfigElements.noteElement;
        elements[this.ColumnNames.Output] = functionConfigElements.outputElement;

        return elements;
    };

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
     * @param {Object.<string, any>[]} data
     * @returns {SpreadSheetFunctionConfig}
     */
    static create(tableId, data) {
        const options = SpreadSheetFunctionConfig.options();
        const table = JspreadSheetTable.createTable(
            tableId,
            options.columns,
            data,
            [],
            options.customEvents,
            options.customOptions,
        );

        return spreadsheetFuncConfig(tableId);
    }

    /**
     * Check whether this spreadsheet is valid
     * @return {boolean}
     */
    isValid() {
        return this.table.isValid();
    }

    /**
     * @returns {ExcelTableRow | null}
     */
    mainSerialRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [SpreadSheetFunctionConfig.ColumnNames.Output]: (cell) => cell.data.startsWith('main::'),
            }),
        );
    }

    /**
     * Get selected row
     * @return {ExcelTableRow | null}
     */
    selectedRow() {
        if (!this.isValid()) {
            return null;
        }

        return _.first(
            this.table.findRows({
                [SpreadSheetFunctionConfig.ColumnNames.Output]: (cell) => {
                    const row = cell.td.closest('tr');
                    return row.classList.contains(ROW_SELECTED_CLASS_NAME);
                },
            }),
        );
    }

    /**
     * Get row excel by row index
     * @param {number} rowIndex
     * @return {ExcelTableRow | null}
     */
    getRowExcelByIndex(rowIndex) {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [SpreadSheetFunctionConfig.ColumnNames.Output]: (cell) => cell.rowIndex === rowIndex,
            }),
        );
    }

    /**
     * @returns {ExcelTableRow | null}
     */
    getRowDataByFunctionColumnId(functionColumnId) {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [SpreadSheetFunctionConfig.ColumnNames.FunctionColumnId]: (cell) => cell.data === functionColumnId,
            }),
        );
    }

    /**
     * Get all rows that are checked.
     * @returns {ExcelTableRow[]}
     */
    checkedRows() {
        return this.table.findRows({
            [SpreadSheetFunctionConfig.ColumnNames.IsChecked]: (cell) => cell.data,
        });
    }

    /**
     * Get all rows that are unchecked.
     * @returns {ExcelTableRow[]}
     */
    uncheckedRows() {
        return this.table.findRows({
            [SpreadSheetFunctionConfig.ColumnNames.IsChecked]: (cell) => !cell.data,
        });
    }

    /**
     * Get all errored rows
     * @returns {ExcelTableRow[]}
     */
    erroredRows() {
        return this.table.getRowsByHeadersAndIndexes().filter((row) => {
            const tableRow = tableRowFromExcelRow(row);
            return tableRow.classList.contains('row-invalid') || tableRow.querySelector(`.${BORDER_RED_CLASS}`) != null;
        });
    }

    /**
     * Get errored cells (cells with `BORDER_RED_CLASS` class name) within headers.
     * @param {...string} headers
     * @return {ExcelTableCell[]}
     */
    erroredCells(...headers) {
        return this.table.findCells(headers, (cell) => cell.td.classList.contains(BORDER_RED_CLASS));
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
                    header.name !== SpreadSheetFunctionConfig.ColumnNames.IsChecked,
            )
            .map((header) => header.name);
    }

    /**
     * Perform sync data from function config to table.
     * @param {string} columnName
     * @param {string} stringValue
     * @param {boolean} recordHistory
     * @Param {boolean} force
     */
    syncDataToSelectedRow(columnName, stringValue, { recordHistory = true, force = false, rowIndex = null } = {}) {
        const selectedRow = rowIndex !== null ? this.getRowExcelByIndex(rowIndex) : this.selectedRow();
        if (selectedRow) {
            const cell = selectedRow[columnName];
            if (String(cell.data) !== stringValue) {
                if (recordHistory) {
                    this.table.setValue(cell.td, stringValue, force);
                } else {
                    this.table.updateCell(cell.td, stringValue, force);
                }
            }
        }
    }

    /**
     * Validate all coefficient related cells and inputs.
     * @return {boolean} true if all inputs are valid, false otherwise.
     */
    allCoeCellAndInputsAreValid() {
        const elements = SpreadSheetFunctionConfig.columnElements();
        let allCoeValid = true;

        for (const columnName of [
            SpreadSheetFunctionConfig.ColumnNames.CoeAns,
            SpreadSheetFunctionConfig.ColumnNames.CoeBk,
            SpreadSheetFunctionConfig.ColumnNames.CoeCt,
        ]) {
            const element = elements[columnName];
            const isValid = isValidCoeInput(element);
            if (!isValid) {
                allCoeValid = false;
            }

            if (isValid) {
                FunctionInfo.removeInvalidStatus(element);
                this.markSelectedCellValid(columnName);
            } else {
                FunctionInfo.setInvalidStatus(element);
                this.markSelectedCellInvalid(columnName);
            }
        }

        return allCoeValid;
    }

    /**
     * Mark a selected cell invalid
     * @param {string} columnName
     */
    markSelectedCellInvalid(columnName) {
        const selectedRow = this.selectedRow();
        if (selectedRow) {
            const cell = selectedRow[columnName];
            cell.td.classList.add(BORDER_RED_CLASS);
        }
    }

    /**
     * Mark a selected cell valid
     * @param {string} columnName
     */
    markSelectedCellValid(columnName) {
        const selectedRow = this.selectedRow();
        if (selectedRow) {
            const cell = selectedRow[columnName];
            cell.td.classList.remove(BORDER_RED_CLASS);
        }
    }

    /**
     * @param {HTMLTableCellElement} cell
     * @param {number} columnIndex
     * @param {number} rowIndex
     * @param {any} changedValue
     * @returns {any}
     */
    handleBeforeChangeCell(cell, columnIndex, rowIndex, changedValue) {
        // normalize all inputs (hankaku to zenkaku and normalization).
        let value = changedValue;
        if (typeof value === 'string') {
            value = stringNormalization(value);
        }

        const header = this.table.getHeaderByIndex(columnIndex);
        if (header.name === SpreadSheetFunctionConfig.ColumnNames.SystemName) {
            // normalize english name
            value = correctEnglishName(value);
        }

        return value;
    }

    /**
     * Handle onchange cell
     * @param {number} columnIndex
     * @param {number} rowIndex
     * @param {any} newValue
     * @param {any} oldValue
     */
    handleChangeCell(columnIndex, rowIndex, newValue, oldValue) {
        const cell = this.table.getCellFromCoords(columnIndex, rowIndex);
        // remove invalid marker
        cell.classList.remove(BORDER_RED_CLASS);

        const header = this.table.getHeaderByIndex(columnIndex);
        if (header.name === SpreadSheetFunctionConfig.ColumnNames.JapaneseName) {
            this.handleSyncNameJpToEmptyNameEn(rowIndex, newValue);
        } else if (header.name === SpreadSheetFunctionConfig.ColumnNames.LocalName) {
            this.handleSyncNameLocalToEmptyNameEn(rowIndex, newValue);
        } else if (header.name === SpreadSheetFunctionConfig.ColumnNames.IsChecked) {
            this.handleCheckboxStatus(cell, rowIndex, newValue);
        }

        // sync data
        this.handleSyncDataToFunctionConfig({ x: columnIndex, y: rowIndex });
        // handle calcu result
        if (
            [
                SpreadSheetFunctionConfig.ColumnNames.CoeAns,
                SpreadSheetFunctionConfig.ColumnNames.CoeBk,
                SpreadSheetFunctionConfig.ColumnNames.CoeCt,
            ].includes(header.name)
        ) {
            showResultFunctionWithoutDelay(rowIndex);
        }

        this.handleChangeMark();
    }

    /**
     * Convert to romaji if english name is empty.
     * @param {number} rowIndex
     * @param {any} value
     */
    handleSyncNameJpToEmptyNameEn(rowIndex, value) {
        // TODO: need testcase for this.
        const englishNameCell = this.table.getCellByHeaderAndIndex(
            SpreadSheetFunctionConfig.ColumnNames.SystemName,
            rowIndex,
        );
        if (englishNameCell.data.length === 0) {
            convertEnglishRomaji([value]).then((romanjiName) => {
                this.table.setValueFromCoords(englishNameCell.columnIndex, rowIndex, romanjiName[0]);
                // not sure why we need to set original value here
                englishNameCell.td.dataset.originalValue = romanjiName[0];
            });
        }
    }

    /**
     * Convert to ascii if english name is empty.
     * @param {number} rowIndex
     * @param {any} value
     */
    handleSyncNameLocalToEmptyNameEn(rowIndex, value) {
        // TODO: need testcase for this
        const englishNameCell = this.table.getCellByHeaderAndIndex(
            SpreadSheetFunctionConfig.ColumnNames.SystemName,
            rowIndex,
        );
        if (englishNameCell.data.length === 0) {
            convertNonAscii([value]).then((asciiName) => {
                this.table.setValueFromCoords(englishNameCell.columnIndex, rowIndex, asciiName[0]);
            });
        }
    }

    /**
     * Handle Check/Uncheck a process function column
     * @param {HTMLTableCellElement} cell
     * @param {number} rowIndex
     * @param {any} newValue
     */
    handleCheckboxStatus(cell, rowIndex, newValue) {
        const newValueData = typeof newValue === 'boolean' ? newValue : parseBool(newValue);
        // Update total checked columns
        updateCheckedFunctionColumn();

        // turn on or off status for row.
        const tableRowElement = cell.closest('tr');
        tableRowElement.classList.toggle(ROW_UNCHECKED_CLASS_NAME, !newValueData);

        // check all
        functionConfigElements.selectAllFunctionColumns.checked =
            this.table.numberOfRows() === totalCheckedFunctionColumns();

        // check error checkboxes
        const erroredRows = this.erroredRows();
        const checkedErrorRows = erroredRows.filter((row) => row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].data);
        functionConfigElements.selectErrorFunctionColumns.checked =
            checkedErrorRows.length > 0 && checkedErrorRows.length === erroredRows.length;
    }

    /**
     * @param {...{x: number, y: number}} positions - x: column index, y: row index
     */
    handleSyncDataToFunctionConfig(...positions) {
        // only sync data from selected row
        const selectedRow = this.selectedRow();

        // Do not sync if there is no selected row.
        if (!selectedRow) {
            return;
        }

        const selectedRowIndex = _.first(_.values(selectedRow)).rowIndex;

        /** @type {Set<number>} */
        const changedColumnIndexes = new Set();

        for (const { x, y } of positions) {
            // Only sync data with rows that have the same index as selected row.
            if (selectedRowIndex === Number(y)) {
                changedColumnIndexes.add(Number(x));
            }
        }

        for (const columnIndex of changedColumnIndexes) {
            // sync data to function config element
            const header = this.table.getHeaderByIndex(columnIndex);
            const element = SpreadSheetFunctionConfig.columnElements()[header.name];
            const cell = this.table.getCellByHeaderAndIndex(header.name, selectedRowIndex);

            const stringValue = String(cell.data);
            if (element && element.value !== stringValue) {
                element.value = stringValue;
                // Dispatch so that we can validate data in input
                element.dispatchEvent(new Event('change'));
            }
        }
    }

    /**
     * Handle show or hide change mark
     */
    handleChangeMark() {
        if (this.isHasChange()) {
            FunctionInfo.showChangeMark();
        } else {
            FunctionInfo.hideChangeMark();
        }
    }

    loadTotalCheckedColumns() {
        showTotalCheckedFunctionColumns(this.table.numberOfRows(), this.checkedRows().length);
    }

    /**
     * Custom Header
     */
    loadHeaderStatus() {
        // Add * into Order column
        const orderCell = this.table.getOrderHeaderElement();
        orderCell.innerHTML = '*';

        // Set hover text for system column
        const hoverTitle = document.getElementById('i18nSystemNameHoverMsg').textContent;
        const systemCell = this.table.getTableHeaderElement(SpreadSheetFunctionConfig.ColumnNames.SystemName);
        systemCell.setAttribute('title', hoverTitle);
        systemCell.classList.add('required'); // add * symbol css class
        systemCell.innerHTML = `<span class="hint-text">${systemCell.innerText}</span>`;
    }

    /**
     * Custom Table Style
     */
    loadCSS() {
        // Do not show shadow border
        const tableContent = this.table.getTableContentElement();
        tableContent.style.removeProperty('box-shadow');
    }

    /**
     * Set sample data classes and original value for rows
     * @param {...ExcelTableRow} rows
     */
    updateOriginalValueSampleData(...rows) {
        for (const row of rows) {
            const sampleDataCells = _.map(
                _.pickBy(row, (cell, headerName) => {
                    return headerName.startsWith(SAMPLE_DATA_KEY);
                }),
                (value) => value,
            );
            const dataType = row.rawOutput.data;
            const isNumber = NUMERIC_TYPES.includes(dataType);

            // set original value and is number for sample data
            for (const cell of sampleDataCells) {
                const td = cell.td;

                td.classList.add('sample-data');
                td.innerText = formatSignifiValue(cell.data, isNumber);
                td.setAttribute(DATA_ORIGINAL_ATTR, cell.data);
                td.setAttribute(IS_NUMBER_ATTR, isNumber);
            }
        }
    }

    /**
     * Add class depend on column name for rows
     * @param {...ExcelTableRow} rows
     */
    updateColumnClassName(...rows) {
        // Set classes into table body cells
        for (const row of rows) {
            Object.entries(SpreadSheetFunctionConfig.ColumnClasses).forEach(([columnName, classes]) => {
                const cellObj = row[columnName];
                cellObj.td.classList.add(...classes);
            });
        }

        // Set classes into table header cells
        Object.entries(SpreadSheetFunctionConfig.ColumnClasses).forEach(([columnName, classes]) => {
            const cellElement = this.table.getTableHeaderElement(columnName);
            cellElement.classList.add(...classes);
        });
    }

    /**
     * Add event for rows
     * @param {...ExcelTableRow} rows
     */
    addEvent(...rows) {
        // add event row click
        for (const row of rows) {
            const rowElement = row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td.closest('tr');
            rowElement.addEventListener('click', FunctionInfo.rowClickEvent);
        }
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
     * Search Set Button Logic
     */
    handleSearchSetButton() {
        const allRows = this.table.getRowsByHeadersAndIndexes();
        for (const row of allRows) {
            const cell = row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td;
            const ele = $(cell);
            const rowEle = cell.closest('tr');
            if (!rowEle.classList.contains('gray') & ele.is(':visible')) {
                ele.find('input[type=checkbox]').prop('checked', true).trigger('change');
            }
        }
    }

    /**
     * Search Reset Button Logic
     */
    handleSearchResetButton() {
        const allRows = this.table.getRowsByHeadersAndIndexes();
        for (const row of allRows) {
            const cell = row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td;
            const ele = $(cell);
            const rowEle = cell.closest('tr');
            if (!rowEle.classList.contains('gray') & ele.is(':visible')) {
                ele.find('input[type=checkbox]').prop('checked', false).trigger('change');
            }
        }
    }

    /**
     * Check if table has changes AND function info has changes.
     * TODO: Should we separate this check? Since table should not handle function info are right?
     * @return {boolean}
     */
    isHasChange() {
        // Doesn't matter if we are selecting a row or not. If the table differs with the database, always show changes.
        if (this.table.isHasChange(SpreadSheetFunctionConfig.trackingHeaders())) {
            return true;
        }

        if (this.selectedRow()) {
            // We are selecting a row, the row info must be present in the function-info area.
            // We can be sure that data is not changed.
            return false;
        } else {
            // We are not selecting a row, check if we are editing function info area.
            const inputFunction = FunctionInfo.collectInputFunctionInfo();
            return !inputFunction.isEmpty();
        }
    }

    /**
     * Get headers for tracking changes
     * @return {string[]}
     */
    static trackingHeaders() {
        return [
            // SpreadSheetFunctionConfig.ColumnNames.IsChecked, // Do not include IsChecked, because it is only used for deleting rows.
            SpreadSheetFunctionConfig.ColumnNames.FunctionName,
            SpreadSheetFunctionConfig.ColumnNames.SystemName,
            SpreadSheetFunctionConfig.ColumnNames.JapaneseName,
            SpreadSheetFunctionConfig.ColumnNames.LocalName,
            SpreadSheetFunctionConfig.ColumnNames.VarXName,
            SpreadSheetFunctionConfig.ColumnNames.VarYName,
            SpreadSheetFunctionConfig.ColumnNames.CoeAns,
            SpreadSheetFunctionConfig.ColumnNames.CoeBk,
            SpreadSheetFunctionConfig.ColumnNames.CoeCt,
            SpreadSheetFunctionConfig.ColumnNames.Note,
            SpreadSheetFunctionConfig.ColumnNames.Output,
        ];
    }

    /**
     * Convert to SpreadSheet Data
     * @param {FunctionInfoDict | FunctionInfo} functionInfoDict
     * @return {SpreadSheetFunctionData}
     */
    static convertToSpreadSheetData(functionInfoDict) {
        const rowData = {};

        rowData[SpreadSheetFunctionConfig.ColumnNames.IsChecked] = functionInfoDict.isChecked;
        rowData[SpreadSheetFunctionConfig.ColumnNames.FunctionName] = functionInfoDict.functionName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.SystemName] = functionInfoDict.systemName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.JapaneseName] = functionInfoDict.japaneseName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.LocalName] = functionInfoDict.localName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarXName] = functionInfoDict.varXName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarYName] = functionInfoDict.varYName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.CoeAns] = functionInfoDict.coeANS;
        rowData[SpreadSheetFunctionConfig.ColumnNames.CoeBk] = functionInfoDict.coeBK;
        rowData[SpreadSheetFunctionConfig.ColumnNames.CoeCt] = functionInfoDict.coeCT;
        rowData[SpreadSheetFunctionConfig.ColumnNames.Note] = functionInfoDict.note;
        rowData[SpreadSheetFunctionConfig.ColumnNames.Output] = FunctionInfo.getLabelRawDataType(
            // update output to upper case because when use copy/paste raw out put changed to lower case
            functionInfoDict.output.toUpperCase(),
            functionInfoDict.isMainSerialNo,
        );
        (functionInfoDict.sampleDatas ?? []).every((sample, idx) => {
            if (idx > 4) return false;
            rowData[SpreadSheetFunctionConfig.ColumnNames[`SampleData${idx + 1}`]] = sample;
            return true;
        });

        rowData[SpreadSheetFunctionConfig.ColumnNames.Index] = functionInfoDict.index;
        rowData[SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo] = functionInfoDict.isMainSerialNo;
        rowData[SpreadSheetFunctionConfig.ColumnNames.IsMeFunction] = functionInfoDict.isMeFunction;
        rowData[SpreadSheetFunctionConfig.ColumnNames.ShownName] = functionInfoDict.shownName;
        rowData[SpreadSheetFunctionConfig.ColumnNames.ProcessColumnId] = functionInfoDict.processColumnId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.FunctionId] = functionInfoDict.functionId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.FunctionColumnId] = functionInfoDict.functionColumnId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.RawOutput] = functionInfoDict.output;
        rowData[SpreadSheetFunctionConfig.ColumnNames.A] = functionInfoDict.a;
        rowData[SpreadSheetFunctionConfig.ColumnNames.B] = functionInfoDict.b;
        rowData[SpreadSheetFunctionConfig.ColumnNames.C] = functionInfoDict.c;
        rowData[SpreadSheetFunctionConfig.ColumnNames.N] = functionInfoDict.k;
        rowData[SpreadSheetFunctionConfig.ColumnNames.K] = functionInfoDict.n;
        rowData[SpreadSheetFunctionConfig.ColumnNames.S] = functionInfoDict.s;
        rowData[SpreadSheetFunctionConfig.ColumnNames.T] = functionInfoDict.t;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarXProcessColumnId] = functionInfoDict.varX.processColumnId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarXFunctionColumnId] = functionInfoDict.varX.functionColumnId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarYProcessColumnId] = functionInfoDict.varY.processColumnId;
        rowData[SpreadSheetFunctionConfig.ColumnNames.VarYFunctionColumnId] = functionInfoDict.varY.functionColumnId;

        return rowData;
    }

    /**
     * Convert to FunctionInfo
     * @param {SpreadSheetFunctionData} spreadsheetFunctionData - SpreadSheet Function Data
     * @return {FunctionInfo}
     */
    static convertToFunctionInfo(spreadsheetFunctionData) {
        const functionInfoDict = {};

        functionInfoDict.isChecked = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.IsChecked];
        functionInfoDict.functionName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.FunctionName];
        functionInfoDict.systemName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SystemName];
        functionInfoDict.japaneseName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.JapaneseName];
        functionInfoDict.localName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.LocalName];
        functionInfoDict.varXName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarXName];
        functionInfoDict.varYName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarYName];
        functionInfoDict.coeANS = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.CoeAns]);
        functionInfoDict.coeBK = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.CoeBk]);
        functionInfoDict.coeCT = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.CoeCt]);
        functionInfoDict.note = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.Note]);
        // update output to upper case because when use copy/paste raw out put changed to lower case
        functionInfoDict.output =
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.RawOutput].toUpperCase();
        functionInfoDict.sampleDatas = [
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SampleData1],
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SampleData2],
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SampleData3],
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SampleData4],
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.SampleData5],
        ];

        functionInfoDict.index = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.Index];
        functionInfoDict.isMainSerialNo = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo];
        functionInfoDict.isMeFunction = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.IsMeFunction];
        functionInfoDict.shownName = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.ShownName];
        functionInfoDict.processColumnId =
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.ProcessColumnId];
        functionInfoDict.functionId = spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.FunctionId];
        functionInfoDict.functionColumnId =
            spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.FunctionColumnId];
        functionInfoDict.a = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.A]);
        functionInfoDict.b = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.B]);
        functionInfoDict.c = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.C]);
        functionInfoDict.k = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.N]);
        functionInfoDict.n = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.K]);
        functionInfoDict.s = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.S]);
        functionInfoDict.t = String(spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.T]);
        functionInfoDict.varX = {
            processColumnId: spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarXProcessColumnId],
            functionColumnId: spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarXFunctionColumnId],
        };
        functionInfoDict.varY = {
            processColumnId: spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarYProcessColumnId],
            functionColumnId: spreadsheetFunctionData[SpreadSheetFunctionConfig.ColumnNames.VarYFunctionColumnId],
        };

        return new FunctionInfo(functionInfoDict);
    }

    /**
     * Set readonly for a/n/s | b/k | c/t cells base on function
     * @param {number} rowIndex
     * @param {?number} functionId
     */
    setReadOnlyFunctionArguments(rowIndex, functionId = this.table.getRowDataByIndex(rowIndex).functionId) {
        // In case if there are some disable params cells -> not allow to paste value in those cells
        const { hasANS, hasBK, hasCT } = FunctionInfo.hasParams(functionId);
        [
            { isAllow: hasANS, columnName: SpreadSheetFunctionConfig.ColumnNames.CoeAns },
            { isAllow: hasBK, columnName: SpreadSheetFunctionConfig.ColumnNames.CoeBk },
            { isAllow: hasCT, columnName: SpreadSheetFunctionConfig.ColumnNames.CoeCt },
        ].forEach(({ isAllow, columnName }) => {
            let columnIndex = Object.values(SpreadSheetFunctionConfig.ColumnNames).indexOf(columnName);
            const ansCell = this.table.getCellFromCoords(columnIndex, rowIndex);
            if (!isAllow) {
                ansCell.classList.add('readonly');
            } else {
                ansCell.classList.remove('readonly');
            }
        });
    }

    /**
     * Return options for constructing table.
     * @return {{columns: [{type: string, width: string, name: string, title: string, editor: {createCell: (function(*): *), closeEditor: (function(*, *): *), openEditor: *, getValue: (function(*): *), setValue: (function(*, *): *)}},{type: string, width: string, name: string, title: string, readOnly: boolean},{type: string, width: string, name: string, title: string},{type: string, width: string, name: string, title: *},{type: string, width: string, name: string, title: *},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null], customEvents: {onbeforechange: (function(*, *, *, *, *): *), onload: customEvents.onload, oninsertrow: customEvents.oninsertrow}, customOptions: {tableOverflow: boolean, tableHeight: string, tableWidth: string, stripHTMLOnCopy: boolean, copyCompatibility: boolean}}}
     */
    static options() {
        const columns = [
            {
                type: 'checkbox',
                width: '22',
                name: this.ColumnNames.IsChecked,
                title: COLUMN_IS_CHECKED_TITLE,
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.FunctionName,
                title: 'Function',
                readOnly: true,
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.SystemName,
                title: 'System',
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.JapaneseName,
                title: $(procModali18n.i18nJapaneseName).text(),
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.LocalName,
                title: $(procModali18n.i18nLocalName).text(),
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.VarXName,
                title: 'X/me',
                readOnly: true,
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.VarYName,
                title: 'Y',
                readOnly: true,
            },
            {
                type: 'text',
                width: '100',
                name: this.ColumnNames.CoeAns,
                title: 'a/n/s',
            },
            {
                type: 'text',
                width: '100',
                name: this.ColumnNames.CoeBk,
                title: 'b/k',
            },
            {
                type: 'text',
                width: '100',
                name: this.ColumnNames.CoeCt,
                title: 'c/t',
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.Note,
                title: 'Note',
            },
            {
                type: 'text',
                width: '150',
                name: this.ColumnNames.Output,
                title: 'Output',
                readOnly: true,
            },
            {
                type: 'text',
                width: '200',
                name: this.ColumnNames.SampleData1,
                title: $(procModali18n.i18nSampleData).text(),
                readOnly: true,
            },
            {
                type: 'text',
                width: '200',
                name: this.ColumnNames.SampleData2,
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '200',
                name: this.ColumnNames.SampleData3,
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '200',
                name: this.ColumnNames.SampleData4,
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '200',
                name: this.ColumnNames.SampleData5,
                title: ' ',
                readOnly: true,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.Index,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.IsMainSerialNo,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.IsMeFunction,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.ShownName,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.ProcessColumnId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.FunctionColumnId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.FunctionId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.RawOutput,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.A,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.B,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.C,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.N,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.K,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.S,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.T,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.VarXProcessColumnId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.VarXFunctionColumnId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.VarYProcessColumnId,
            },
            {
                type: 'hidden',
                name: this.ColumnNames.VarYFunctionColumnId,
            },
        ];

        // get first index of sample data
        const firstSampleDataIndex = columns.findIndex((col) => col.name.startsWith(SAMPLE_DATA_KEY));
        const customOptions = {
            // freezeColumns: firstSampleDataIndex,
            tableOverflow: true,
            tableHeight: 'calc(100vh - 370px)',
            tableWidth: '100%',
        };

        const customEvents = {
            /**
             * Onload event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             */
            onload: (instance) => {
                const spreadsheet = spreadsheetFuncConfig(instance);
                const allRows = spreadsheet.table.getRowsByHeadersAndIndexes();

                spreadsheet.loadHeaderStatus();
                spreadsheet.loadCSS();
                spreadsheet.loadTotalCheckedColumns();

                spreadsheet.updateOriginalValueSampleData(...allRows);
                spreadsheet.updateColumnClassName(...allRows);
                spreadsheet.addEvent(...allRows);
                spreadsheet.table.customCheckbox(...allRows);
                _.range(0, spreadsheet.table.numberOfRows()).forEach((rowIndex) =>
                    spreadsheet.setReadOnlyFunctionArguments(rowIndex),
                );
                // make sure we do not allow pasting rows that exceed the current row numbers
                spreadsheet.table.setDisablePasteExceedNumberOfRows();
            },

            /**
             * Occurs before a column value is changed. If any value is returned, it will be the cell's new value.
             * @param {jspreadsheet.JspreadsheetInstanceElement} element - Root HTML element of this jss instance.
             * @param {HTMLTableCellElement} cell - HTML element that represents the cell being changed.
             * @param {string | number} colIndex - Cell column index being changed.
             * @param {string | number} rowIndex - Cell row index being changed.
             * @param {jspreadsheet.CellValue} newValue - Value being applied to the cell
             * @return {undefined | jspreadsheet.CellValue}
             */
            onbeforechange: (element, cell, colIndex, rowIndex, newValue) => {
                const spreadsheet = spreadsheetFuncConfig(element);
                return spreadsheet.handleBeforeChangeCell(cell, colIndex, rowIndex, newValue);
            },

            /**
             * On change event
             * @template T
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord[]} records
             * @param {number} c - column index
             * @param {number} r - row index
             * @param {T} newValue
             * @param {T} oldValue
             */
            onchange: (instance, records, c, r, newValue, oldValue) => {
                const spreadsheet = spreadsheetFuncConfig(instance);
                spreadsheet.handleChangeCell(c, r, newValue, oldValue);
            },

            /**
             * After row changes
             * @param {jspreadsheet.JspreadsheetInstance} element - Root HTML element of this jss instance.
             * @param {string | number} rowIndex - Cell row index being changed.
             * @param {SpreadSheetFunctionData} rowData - whole data of row
             */
            onafterchangerow: (element, rowIndex, rowData) => {
                const spreadsheet = spreadsheetFuncConfig(element);
                spreadsheet.setReadOnlyFunctionArguments(rowIndex, Number(rowData.functionId));
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
                const spreadsheet = spreadsheetFuncConfig(instance);
                const rowIndexes = rowRecords.map((tds) => {
                    const td = _.first(tds);
                    return td.dataset.y;
                });

                const rows = spreadsheet.table.getRowsByHeadersAndIndexes(undefined, rowIndexes);
                spreadsheet.updateColumnClassName(...rows);
                spreadsheet.updateOriginalValueSampleData(...rows);
                spreadsheet.updateColumnClassName(...rows);
                spreadsheet.addEvent(...rows);
                spreadsheet.table.customCheckbox(...rows);
            },

            /**
             * On undo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord} historyRecord
             */
            onundo: (instance, historyRecord) => {
                const spreadsheet = spreadsheetFuncConfig(instance);
                if (historyRecord) {
                    spreadsheet.handleChangeMark();
                    spreadsheet.handleSyncDataToFunctionConfig(...historyRecord.records);
                }
            },

            /**
             * On redo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord} historyRecord
             */
            onredo: (instance, historyRecord) => {
                const spreadsheet = spreadsheetFuncConfig(instance);
                if (historyRecord) {
                    spreadsheet.handleChangeMark();
                    spreadsheet.handleSyncDataToFunctionConfig(...historyRecord.records);
                }
            },
        };

        return {
            columns,
            customEvents,
            customOptions,
        };
    }
}
