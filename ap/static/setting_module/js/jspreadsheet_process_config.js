/**
 * @file Base of JSpreadsheet functions for Process Config table.
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 * @contributor Nguyen Huu Tuan <tuannh@fpt.com>
 * @contributor Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * @param {any} element
 */
const spreadsheetProcConfig = (element) => {
    return new SpreadSheetProcessConfig(element);
};

/**
 * SpreadSheetProcessConfig
 * @property {JspreadSheetTable} table
 */
class SpreadSheetProcessConfig {
    setupPaginationToolbar() {
        const table = this.table.table;
        let toolbar;
        if (table.el.id !== 'processColumnsTable') {
            if (!table.el.id.startsWith('processColumnsTable_') || table.el.querySelector('.spreadsheet-pagination')) {
                return;
            }

            // Each file-preview table keeps its own pager at the native footer position.
            toolbar = document.createElement('div');
            toolbar.className = 'spreadsheet-pagination';
            table.pagination.after(toolbar);
        } else {
            toolbar = document.getElementById('procPaginationToolbar');
            toolbar.classList.remove('d-none');
        }
        table.pagination.style.display = 'none';
        toolbar.onmousedown = (event) => event.stopPropagation();
        table.paginationDropdown.setAttribute('aria-label', document.getElementById('i18nPagination').dataset.pageSize);

        const updatePagination = table.updatePagination.bind(table);
        table.updatePagination = () => {
            updatePagination();
            const rows = (table.options.search || table.options.filters) && table.results ? table.results : table.rows;
            renderProcessPagination(toolbar, {
                compact: true,
                page: table.pageNumber + 1,
                pageSize: table.options.pagination,
                total: rows.length,
                pageSizeControl: table.paginationDropdown,
                onPageChange: (page) => table.page(page - 1),
            });
        };
        table.updatePagination();
    }

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
     * @param {boolean} registerByFile - is this register by file?
     * @returns {SpreadSheetProcessConfig}
     */
    static create(tableId, data, registerByFile = false) {
        const options = SpreadSheetProcessConfig.options({ registerByFile });
        JspreadSheetTable.createTable(tableId, options.columns, data, [], options.customEvents, options.customOptions);

        const spreadsheet = spreadsheetProcConfig(tableId);
        let selectedMode = document.querySelector('input[name="sampleDataDisplayMode"]:checked');
        if (registerByFile) {
            const index = tableId.split('_')[1];
            selectedMode = document.querySelector(`input[name="sampleDataDisplayMode_${index}"]:checked`);
        }
        // parse sample data by datatype
        SpreadSheetProcessConfig.updateSampleDataByDisplayMode(spreadsheet, selectedMode.value);

        return spreadsheet;
    }

    /**
     * Init loading animation for Jspreadsheet table
     * @param {string} tableId
     * @return {Element & {
     * show: () => void,
     * hide: () => void,
     * updateProgress: (() => void),
     * }}
     */
    static initLoadingTable(tableId) {
        const tableEl = document.querySelector(`#${tableId}`);
        let loadingEl = document.querySelector(`#${tableId} .loading`);
        if (loadingEl == null) {
            loadingEl = document.createElement('div');
            loadingEl.id = `configProcessLoading-${tableId}`;
            loadingEl.classList.add('loading');
            if (tableEl) {
                tableEl.appendChild(loadingEl);
            }
        }

        // Show loading animation when table data is being loaded
        loadingEl.show = function showLoadingAnimation() {
            loadingEl.style.textAlign = 'center';
            loadingEl.style.alignContent = 'center';
            loadingEl.style.paddingTop = '145px';
            loadingEl.style.paddingLeft = '40px';
            loadingEl.progess = [];
            loadingEl.total = document.querySelectorAll(`#${tableId} table.jexcel tbody tr`).length;
            loadingEl.innerHTML = `${loadingEl.progess.length} / ${loadingEl.total}`;

            loadingEl.style.display = 'block';
            tableEl.style.pointerEvents = 'none';
            loadingEl.startTime = performance.now();
        };

        // Hide loading animation when table data is loaded and rendered
        loadingEl.hide = function hideLoadingAnimation() {
            loadingEl.endTime = performance.now();
            const executionTime = loadingEl.endTime - loadingEl.startTime;
            consoleLogDebug(`Loading time: ${executionTime} milliseconds`);

            loadingEl.style.display = 'none';
            tableEl.style.pointerEvents = 'auto';

            delete loadingEl.progess;
            delete loadingEl.total;
            delete loadingEl.startTime;
            delete loadingEl.endTime;
            loadingEl.innerHTML = '';
        };

        // Update progress of loading columns in table
        loadingEl.updateProgress = function showLoadingAnimation() {
            loadingEl.progess.push(null);
            loadingEl.innerHTML = `${loadingEl.progess.length} / ${loadingEl.total}`;
        };

        return loadingEl;
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
                [PROCESS_COLUMNS.is_serial_no]: (cell) => cell.data,
            }),
        );
    }

    /**
     * @returns {ExcelTableRow | null}
     */
    fileNameRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.is_file_name]: (cell) => cell.data,
            }),
        );
    }

    /**
     * @return {ExcelTableRow | null}
     */
    mainDateRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.column_type]: (cell) => cell.data === masterDataGroup.MAIN_DATE,
            }),
        );
    }

    /**
     * @return {ExcelTableRow | null}
     */
    mainTimeRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.column_type]: (cell) => cell.data === masterDataGroup.MAIN_TIME,
            }),
        );
    }

    /**
     * @return {ExcelTableRow | null}
     */
    mainDateTimeRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.is_get_date]: (cell) => cell.data,
            }),
        );
    }

    /**
     * @return {ExcelTableRow | null}
     */
    dummyDateTimeRow() {
        if (!this.isValid()) {
            return null;
        }
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.is_dummy_datetime]: (cell) => cell.data,
            }),
        );
    }

    /**
     * Get all rows that are checked.
     * @returns {ExcelTableRow[]}
     */
    checkedRows() {
        return this.table.findRows({
            [PROCESS_COLUMNS.is_checked]: (cell) => cell.data,
        });
    }

    /**
     * Get all rows that are not readonly.
     * @returns {ExcelTableRow[]}
     */
    nonReadonlyRows() {
        return this.table.findRows({
            [PROCESS_COLUMNS.is_checked]: (cell) => !cell.td.classList.contains('readonly'),
        });
    }

    getCheckboxRowsForSelection(autoSelect = false, { excludeFileName = true } = {}) {
        const table = this.table.table;
        const isCheckedIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.is_checked);
        const isNullIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.is_null);
        const isFileNameIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.is_file_name);
        const idIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.id);
        const dataTypeIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.data_type);
        const columnTypeIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.column_type);
        const isDummyDatetimeIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.is_dummy_datetime);

        return table.options.data.reduce((rows, rowData, rowIndex) => {
            const td = table.records[rowIndex]?.[isCheckedIndex];
            if (!td || td.classList.contains(READONLY_CLASS) || td.classList.contains('readonly')) {
                return rows;
            }

            if (autoSelect && rowData[isNullIndex]) {
                return rows;
            }

            if (excludeFileName && rowData[isFileNameIndex]) {
                return rows;
            }

            rows.push({
                [PROCESS_COLUMNS.is_checked]: {
                    rowIndex,
                    columnIndex: isCheckedIndex,
                    data: rowData[isCheckedIndex],
                    td,
                },
                [PROCESS_COLUMNS.is_null]: {
                    rowIndex,
                    columnIndex: isNullIndex,
                    data: rowData[isNullIndex],
                    td: table.records[rowIndex]?.[isNullIndex],
                },
                [PROCESS_COLUMNS.is_file_name]: {
                    rowIndex,
                    columnIndex: isFileNameIndex,
                    data: rowData[isFileNameIndex],
                    td: table.records[rowIndex]?.[isFileNameIndex],
                },
                [PROCESS_COLUMNS.id]: {
                    rowIndex,
                    columnIndex: idIndex,
                    data: rowData[idIndex],
                    td: table.records[rowIndex]?.[idIndex],
                },
                [PROCESS_COLUMNS.data_type]: {
                    rowIndex,
                    columnIndex: dataTypeIndex,
                    data: rowData[dataTypeIndex],
                    td: table.records[rowIndex]?.[dataTypeIndex],
                },
                [PROCESS_COLUMNS.column_type]: {
                    rowIndex,
                    columnIndex: columnTypeIndex,
                    data: rowData[columnTypeIndex],
                    td: table.records[rowIndex]?.[columnTypeIndex],
                },
                [PROCESS_COLUMNS.is_dummy_datetime]: {
                    rowIndex,
                    columnIndex: isDummyDatetimeIndex,
                    data: rowData[isDummyDatetimeIndex],
                    td: table.records[rowIndex]?.[isDummyDatetimeIndex],
                },
            });

            return rows;
        }, []);
    }

    getSelectionCheckboxStatus() {
        const rows = this.getCheckboxRowsForSelection(false);
        const selectedAll = rows.every((row) => row[PROCESS_COLUMNS.is_checked].data);
        const autoSelectedAll = rows.every((row) => {
            const isChecked = row[PROCESS_COLUMNS.is_checked].data;
            const isNull = row[PROCESS_COLUMNS.is_null].data;

            return !((isNull && isChecked) || (!isNull && !isChecked));
        });

        return { selectedAll, autoSelectedAll };
    }

    /**
     * Get all rows that are master.
     * @returns {ExcelTableRow[]}
     */
    masterRows() {
        return this.table.findRows({
            [PROCESS_COLUMNS.column_type]: (cell) => isMasterDataColumn(cell.data),
        });
    }

    /**
     * @return {ExcelTableRow | null}
     */
    judgeRow() {
        return _.first(
            this.table.findRows({
                [PROCESS_COLUMNS.is_judge]: (cell) => cell.data,
            }),
        );
    }

    /**
     * @return {ExcelTableRow[]}
     */
    judgeAvailableRows() {
        return this.table.findRows({
            [PROCESS_COLUMNS.judge_available]: (cell) => cell.data,
        });
    }

    /**
     * Get rows by data type.
     * @param {...string} dataTypes
     * @returns {ExcelTableRow[]}
     */
    rowsByDataTypes(...dataTypes) {
        return this.table.findRows({
            [PROCESS_COLUMNS.data_type]: (cell) => dataTypes.includes(cell.data),
        });
    }

    /**
     * Get rows by column type.
     * @param {...number} columnTypes
     * @returns {ExcelTableRow[]}
     */
    rowsByColumnTypes(...columnTypes) {
        return this.table.findRows({
            [PROCESS_COLUMNS.column_type]: (cell) => columnTypes.includes(cell.data),
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
                    header.name !== PROCESS_COLUMNS.is_checked,
            )
            .map((header) => header.name);
    }

    /**
     * Handle before onchange cell
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
        if (header.name === PROCESS_COLUMNS.shown_data_type) {
            value = this.handleChangeDataType(cell, rowIndex, changedValue);
        } else if (header.name === PROCESS_COLUMNS.name_en) {
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
        cell.classList.remove(BORDER_RED_CLASS);
        const header = this.table.getHeaderByIndex(columnIndex);

        if (header.name === PROCESS_COLUMNS.name_jp) {
            this.handleSyncNameJpToEmptyNameEn(rowIndex, newValue);
        } else if (header.name === PROCESS_COLUMNS.name_local) {
            this.handleSyncNameLocalToEmptyNameEn(rowIndex, newValue);
        } else if (header.name === PROCESS_COLUMNS.is_checked) {
            this.handleCheckboxStatus(cell, rowIndex, newValue, oldValue);
        }

        this.updateTooltips(...this.table.getRowsByHeadersAndIndexes(undefined, [rowIndex]));
        this.handleChangeMark();
    }

    /**
     *
     * @param {HTMLTableCellElement} cell
     * @param {number} rowIndex - row index
     * @param {any} value - changed value
     * @returns {any}
     */
    handleChangeDataType(cell, rowIndex, value) {
        const [dataType, columnType] = DataTypeDropdown_Controller.convertShownDataTypeToColumnTypeAndDataType(value);
        const currentRowData = this.table.getRowDataByIndex(rowIndex);
        // check main::Datetime in function col
        if (columnType === masterDataGroup.MAIN_DATETIME && typeof FunctionInfo !== 'undefined') {
            value = handleShowConfirmSelectMainDatetimeInProcessConfig(currentRowData, value, rowIndex);
        }

        // check main serial
        if (columnType === masterDataGroup.MAIN_SERIAL && typeof FunctionInfo !== 'undefined') {
            value = handleShowConfirmSelectMainSerialInProcessConfig(currentRowData, value, rowIndex);
        }

        const [oldDataType, oldColumnType] = DataTypeDropdown_Controller.convertShownDataTypeToColumnTypeAndDataType(
            cell.innerText,
        );

        return DataTypeDropdown_Controller.disableOtherDataType_New(cell, value, currentRowData, oldDataType, dataType);
    }

    /**
     * Convert to romaji if english name is empty.
     * @param {number} rowIndex
     * @param {any} value
     */
    handleSyncNameJpToEmptyNameEn(rowIndex, value) {
        // TODO: need testcase for this.
        const englishNameCell = this.table.getCellByHeaderAndIndex(PROCESS_COLUMNS.name_en, rowIndex);
        if (englishNameCell.data.length === 0) {
            convertEnglishRomaji([value]).then((romanjiName) => {
                this.table.setValueFromCoords(englishNameCell.columnIndex, rowIndex, romanjiName[0]);
                // not sure why we need to set original value here
                englishNameCell.td.dataset.originalValue = romanjiName[0];
            });
        }
    }

    /**
     * Validate formation by regex ^Pos~[^|~=]+\|Neg=[^|~=]+\|[^|~=]+*$ ex: Pos~OK|Neg=OK|NG
     * @param {number} rowIndex
     * @param {string} newValue
     * @return Promise<boolean> - valid or invalid
     */
    async validateFormulation(rowIndex, newValue) {
        const data = this.table.getRowDataByIndex(rowIndex);

        hideAlertMessages();
        const isRegisteredData = data.id > 0 && !isInitialize;
        const response = await validateFormula(newValue, data.column_type, data.data_type, isRegisteredData, data.id);
        if (!response.is_valid) {
            // show messenger and return old value
            this.showErrorMsg(response.msg);
            return false;
        }
        return true;
    }

    showErrorMsg(msgStr) {
        const isRegisterFilePage = window.location.href.includes('register_by_file');
        if (isRegisterFilePage) {
            addMessengerToProgressBar(msgStr, ICON_STATUS.WARNING);
        } else {
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: msgStr,
                is_error: true,
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
        const englishNameCell = this.table.getCellByHeaderAndIndex(PROCESS_COLUMNS.name_en, rowIndex);
        if (englishNameCell.data.length === 0) {
            convertNonAscii([value]).then((asciiName) => {
                this.table.setValueFromCoords(englishNameCell.columnIndex, rowIndex, asciiName[0], true);
            });
        }
    }

    /**
     * Handle Check/Uncheck a process column
     * @param {HTMLTableCellElement} cell
     * @param {number} rowIndex
     * @param {any} newValue
     * @param {any} oldValue
     */
    handleCheckboxStatus(cell, rowIndex, newValue, oldValue) {
        const newValueData = typeof newValue === 'boolean' ? newValue : parseBool(newValue);
        const oldValueData = typeof oldValue === 'boolean' ? oldValue : parseBool(oldValue);

        // turn on or off status for row.
        const tableRowElement = cell.closest('tr');
        tableRowElement.classList.toggle(ROW_UNCHECKED_CLASS_NAME, !newValueData);

        // handle file name
        const rowData = this.table.getRowDataByIndex(rowIndex);
        if (rowData.is_file_name) {
            const showFileNameCheckboxEle = getFileNameCheckboxFromElement(cell);
            if (showFileNameCheckboxEle.length) {
                showFileNameCheckboxEle.prop('checked', newValueData);
            }
        }
        // check handle mainDate mainTime when not register proc
        if (!rowData.is_dummy_datetime && rowData.id < 0) {
            ProcessConfigSection.handleMainDateAndMainTime(this, rowData.data_type, rowData.column_type);
        }
        updateCheckedColumn(this.table, newValueData - oldValueData);
    }

    bulkUpdateCheckboxStatus(rows, isChecked) {
        const table = this.table.table;
        const columnIndex = this.table.getIndexHeaderByName(PROCESS_COLUMNS.is_checked);
        const records = [];
        let checkedColumnDiff = 0;
        let changedMainDateTimeRow = null;

        for (const row of rows) {
            const cell = row[PROCESS_COLUMNS.is_checked];
            const rowIndex = cell.rowIndex;
            const td = cell.td;
            const oldValue = table.options.data[rowIndex][columnIndex];
            const oldValueData = typeof oldValue === 'boolean' ? oldValue : parseBool(oldValue);

            if (oldValueData === isChecked) {
                continue;
            }

            const input = td.querySelector('input[type=checkbox]');
            if (input) {
                input.checked = isChecked;
            }
            table.options.data[rowIndex][columnIndex] = isChecked;
            cell.data = isChecked;
            td.classList.remove(BORDER_RED_CLASS);
            td.closest('tr').classList.toggle(ROW_UNCHECKED_CLASS_NAME, !isChecked);

            records.push({
                x: columnIndex,
                y: rowIndex,
                col: columnIndex,
                row: rowIndex,
                newValue: isChecked,
                oldValue,
            });
            checkedColumnDiff += isChecked ? 1 : -1;

            const isDummyDatetime = row[PROCESS_COLUMNS.is_dummy_datetime].data;
            const id = row[PROCESS_COLUMNS.id].data;
            const columnType = row[PROCESS_COLUMNS.column_type].data;
            const isMainDateTimeType = [
                masterDataGroup.MAIN_DATE,
                masterDataGroup.MAIN_TIME,
                masterDataGroup.MAIN_DATETIME,
            ].includes(columnType);
            if (!isDummyDatetime && id < 0 && isMainDateTimeType) {
                changedMainDateTimeRow = row;
            }
        }

        if (!records.length) {
            return;
        }

        table.setHistory({
            action: 'setValue',
            records,
            selection: table.selectedCell,
        });
        this.table.recordTracingChanges(...records);

        if (changedMainDateTimeRow) {
            ProcessConfigSection.handleMainDateAndMainTime(
                this,
                changedMainDateTimeRow[PROCESS_COLUMNS.data_type].data,
                changedMainDateTimeRow[PROCESS_COLUMNS.column_type].data,
            );
        }

        updateCheckedColumn(this.table, checkedColumnDiff);
        this.handleChangeMark();
    }

    /**
     * Init checkbox status
     * @param {...ExcelTableRow} rows
     */
    loadCheckBoxStatus(...rows) {
        // Init events for all rows.
        for (const row of rows) {
            const cell = row[PROCESS_COLUMNS.is_checked];
            const input = cell.td.querySelector('input[type=checkbox]');
            input.checked = cell.data;
            input.dispatchEvent(new Event('change'));
        }

        /** @param {ExcelTableRow} row */
        const isDisabled = (row) => {
            const columnType = row[PROCESS_COLUMNS.column_type].data;
            const isRegistered = row[PROCESS_COLUMNS.id].data > 0;
            const isRegisteredMainDate = isRegistered && columnType === masterDataGroup.MAIN_DATE;
            const isRegisteredMainTime = isRegistered && columnType === masterDataGroup.MAIN_TIME;
            const isRegisteredMainDatetime = isRegistered && columnType === masterDataGroup.MAIN_DATETIME;

            return isRegisteredMainDate || isRegisteredMainTime || isRegisteredMainDatetime;
        };

        if (typeof isInitialize === 'undefined' || !isInitialize) {
            // Make disabled rows read only.
            for (const disabledRow of rows.filter(isDisabled)) {
                const cell = disabledRow[PROCESS_COLUMNS.is_checked];
                cell.td.classList.add(READONLY_CLASS);
            }
        }
    }

    loadCheckboxStatusRegisterByFile() {
        for (const row of this.nonReadonlyRows()) {
            const cell = row[PROCESS_COLUMNS.is_checked].td;
            const input = cell.querySelector('input[type=checkbox]');

            // Only check rows that are not filename or not null.
            const isFilename = row[PROCESS_COLUMNS.is_file_name].data;
            const isNull = row[PROCESS_COLUMNS.is_null].data;
            input.checked = !(isFilename || isNull);
            input.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Handle show or hide change mark
     */
    handleChangeMark() {
        if (this.isHasChange()) {
            procModalElements.settingChangeMark()?.classList.remove('d-none');
        } else {
            procModalElements.settingChangeMark()?.classList.add('d-none');
        }
    }

    loadTotalCheckedColumns() {
        showTotalCheckedColumns(this.table.table.el, this.table.numberOfRows(), this.checkedRows().length);
    }

    loadHeaderStatus() {
        // Add * into Order column
        const orderCell = this.table.getOrderHeaderElement();
        orderCell.innerHTML = '*';
        this.setHoverInfor(
            document.getElementById('i18nSystemNameHoverMsg').textContent,
            PROCESS_COLUMNS.name_en,
            true,
        );
        this.setHoverInfor(
            document.getElementById('i18nProcessConfigFilterHover').textContent,
            PROCESS_COLUMNS.filter,
            false,
        );

        const formulaHoverMsg = document.getElementById('i18nHoverConversationFormulaMsg').textContent;
        const cell = this.table.getTableHeaderElement(PROCESS_COLUMNS.formula);
        cell.setAttribute('title', formulaHoverMsg);
        cell.classList.add('required'); // add * symbol css class
        cell.innerHTML = `<span class="hint-text">${cell.innerText}</span>`;
        // add icon sort
        const headerSort = [
            PROCESS_COLUMNS.column_raw_name,
            PROCESS_COLUMNS.shown_data_type,
            PROCESS_COLUMNS.name_en,
            PROCESS_COLUMNS.name_jp,
            PROCESS_COLUMNS.name_local,
            PROCESS_COLUMNS.unit,
            PROCESS_COLUMNS.filter,
        ];
        headerSort.forEach((headerName, index) => {
            let tdEle = this.table.getTableHeaderElement(headerName);
            tdEle.innerHTML = `
                    <span>${tdEle.innerHTML}</span>
                    <span id="sortCol-${index}" idx="${index}" class="mr-1 sortCol" title="Sort" >
                        <i id="asc-${index}" class="fa fa-sm fa-play asc" ></i >
                        <i id="desc-${index}" class="fa fa-sm fa-play desc" ></i >
                    </span>`;
        });
    }

    /**
     *
     * @param {string} hoverMsg
     * @param PROCESS_COLUMNS column
     * @param {boolean} isRequired
     */

    setHoverInfor(hoverMsg, column, isRequired = false) {
        // Set hover text for target column
        const cellElement = this.table.getTableHeaderElement(column);
        cellElement.setAttribute('title', hoverMsg);
        cellElement.innerHTML = `<span class="hint-text">${cellElement.innerText}</span>`;
        if (isRequired) {
            cellElement.classList.add('required'); // add * symbol css class
        }
    }

    loadCSS() {
        // Do not show shadow border
        const tableContent = this.table.getTableContentElement();
        tableContent.style.removeProperty('box-shadow');
    }

    addJudgeFormulationClass() {
        const rows = this.judgeAvailableRows();

        if (!rows.length) {
            return;
        }

        rows.forEach((row) => {
            const cell = row[PROCESS_COLUMNS.formula].td;
            cell.classList.add('formula');
        });
    }

    loadIsShowFileNameCheckbox() {
        const fileNameRow = this.fileNameRow();
        // Cannot file filename row, return and do nothing.
        if (!fileNameRow) {
            return;
        }
        const checkboxCell = fileNameRow[PROCESS_COLUMNS.is_checked].td;
        const inputCheckboxCell = checkboxCell.querySelector('input[type=checkbox]');

        const isShowFileName = getFileNameCheckboxFromElement(checkboxCell);
        const showFileNameCheckboxDisabled = isShowFileName.prop('disabled');

        // fileNameRow should be checked if `isShowFileName` is checked
        inputCheckboxCell.checked = isShowFileName.prop('checked');
        inputCheckboxCell.dispatchEvent(new Event('change'));

        // Remove previous assigned events should be removed.
        isShowFileName.off('change');

        if (showFileNameCheckboxDisabled) {
            // Disable checkbox cells
            checkboxCell.classList.add('readonly');

            // Disable column name cells as well;
            const shouldDisableColumnName = [
                PROCESS_COLUMNS.shown_data_type,
                PROCESS_COLUMNS.name_en,
                PROCESS_COLUMNS.name_jp,
            ];
            for (const columnName of shouldDisableColumnName) {
                const td = fileNameRow[columnName].td;
                td.classList.add('readonly');
            }
        }
        // is shown file name checkbox is active, bind events.
        isShowFileName.on('change', (e) => {
            inputCheckboxCell.checked = e.target.checked;
            inputCheckboxCell.dispatchEvent(new Event('change'));
        });

        // add attr for check column file name of test
        checkboxCell.setAttribute('is-file-name', 'true');
    }

    /**
     * Set sample data classes and original value for rows
     * @param {...ExcelTableRow} rows
     */
    updateOriginalValueSampleData(...rows) {
        for (const row of rows) {
            const sampleDataCells = this.table.getSampleDataCellsOfRow(row);

            // set class for dummy column
            const isDummyColumn =
                row[PROCESS_COLUMNS.is_dummy_datetime].data || row[PROCESS_COLUMNS.is_generated_datetime].data;

            // set original value for sample data
            for (const cell of sampleDataCells) {
                const td = cell.td;

                td.classList.add('sample-data');
                td.setAttribute(DATA_ORIGINAL_ATTR, cell.data);
                // Datatype edits and pagination must not change the type of these original samples.
                td.setAttribute('data-original-type', row[PROCESS_COLUMNS.data_type].data);
                if (isDummyColumn) {
                    td.classList.add('dummy_datetime_col');
                }
            }
        }
    }

    updateUniqueSampleDataAttributes(uniqueDataCategory, uniqueDataReal, uniqueDataInt, uniqueDataIntCat, ...rows) {
        if (!uniqueDataCategory.length && !uniqueDataReal.length && !uniqueDataInt.length) return; // old preview data without fields
        rows.forEach((row, i) => {
            const rowDataCategory = uniqueDataCategory[i];
            const rowDataReal = uniqueDataReal[i];
            const rowDataInt = uniqueDataInt[i];
            const rowDataIntCat = uniqueDataIntCat[i];
            const sampleDataCells = this.table.getSampleDataCellsOfRow(row);
            // set unique value attributes for sample data
            sampleDataCells.forEach((cell, i) => {
                const td = cell.td;
                td.setAttribute(
                    UNIQUE_CATEGORY_DATA_ATTR,
                    rowDataCategory[i] === null || rowDataCategory[i] === undefined ? '' : rowDataCategory[i],
                );
                td.setAttribute(
                    UNIQUE_REAL_DATA_ATTR,
                    rowDataReal[i] === null || rowDataReal[i] === undefined ? '' : rowDataReal[i],
                );
                td.setAttribute(
                    UNIQUE_INT_DATA_ATTR,
                    rowDataInt[i] === null || rowDataInt[i] === undefined ? '' : rowDataInt[i],
                );
                td.setAttribute(
                    UNIQUE_INT_CAT_DATA_ATTR,
                    rowDataIntCat[i] === null || rowDataIntCat[i] === undefined ? '' : rowDataIntCat[i],
                );
            });
        });
    }

    static updateSampleDataByDisplayMode(spreadsheet, displayMode) {
        const shownDataTypeIndex = spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type);
        // Search results are not contiguous model rows, so use the indexes rendered by JSpreadsheet.
        [...spreadsheet.table.table.tbody.rows].forEach((row) => {
            const rowIndex = Number(row.dataset.y);
            const shownDataType = spreadsheet.table.getDataFromCoords(shownDataTypeIndex, rowIndex);
            spreadsheet.changeShownDataType(rowIndex, shownDataType, displayMode, { isFirstLoad: true });
        });
        spreadsheet.table.reIndexForSpecialRow(spreadsheet.table);
    }

    /**
     * Add class depend on column name for rows
     * @param {...ExcelTableRow} rows
     */
    updateColumnClassName(...rows) {
        const columnClasses = {
            sample_data_10: ['column-sample-data'],
            sample_data_9: ['column-sample-data'],
            sample_data_8: ['column-sample-data'],
            sample_data_7: ['column-sample-data'],
            sample_data_6: ['column-sample-data'],
            sample_data_5: ['column-sample-data'],
            sample_data_4: ['column-sample-data'],
            sample_data_3: ['column-sample-data'],
            sample_data_2: ['column-sample-data'],
            sample_data_1: ['column-sample-data'],
        };
        columnClasses[PROCESS_COLUMNS.is_checked] = [COLUMN_IS_CHECKED_CLASS_NAME];
        columnClasses[PROCESS_COLUMNS.column_raw_name] = ['column-raw-name'];
        columnClasses[PROCESS_COLUMNS.shown_data_type] = ['column-data-type', 'jexcel_dropdown'];
        columnClasses[PROCESS_COLUMNS.name_en] = ['column-system-name'];
        columnClasses[PROCESS_COLUMNS.name_jp] = ['column-japanese-name'];
        columnClasses[PROCESS_COLUMNS.name_local] = ['column-local-name'];
        columnClasses[PROCESS_COLUMNS.unit] = ['column-unit'];
        columnClasses[PROCESS_COLUMNS.filter] = ['column-filter'];
        columnClasses[PROCESS_COLUMNS.formula] = ['column-formula'];
        columnClasses[PROCESS_COLUMNS.raw_data_type] = ['column-raw-data-type'];

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
     * Update data type hints and full text for potentially truncated names.
     * @param {...ExcelTableRow} rows
     */
    updateTooltips(...rows) {
        for (const row of rows) {
            row.shown_data_type.td.title = dataTypeEventHints;
            for (const name of ['column_raw_name', 'name_en', 'name_jp', 'name_local', 'unit']) {
                row[name].td.title = row[name].data ?? '';
            }
        }
    }

    /**
     * Handle search input in table.
     * @param {string} value
     * @param {string} key
     */
    handleSearchInput(value, key) {
        const searchableHeaders = this.searchableHeaders();
        const table = this.table.table;

        const matchedRows = this.table.findMatchedDataRows(value, searchableHeaders);
        const matchedRowIndexes = matchedRows.map((row) => row[PROCESS_COLUMNS.is_checked].rowIndex);
        const matchedRowIndexSet = new Set(matchedRowIndexes);

        if (key === 'Enter') {
            table.results = null;
            table.rows.forEach((rowElement, rowIndex) => {
                rowElement.classList.toggle('gray', !matchedRowIndexSet.has(rowIndex));
                rowElement.style.display = '';
            });
        } else {
            table.rows.forEach((rowElement) => rowElement.classList.remove('gray'));
            table.results = value ? matchedRowIndexes : null;
            table.options.search = true;
        }

        table.updateResult();
    }

    handleSearchSetButton() {
        const rows = this.searchTargetRows();
        this.bulkUpdateCheckboxStatus(rows, true);
    }

    handleSearchResetButton() {
        const rows = this.searchTargetRows();
        this.bulkUpdateCheckboxStatus(rows, false);
    }

    searchTargetRows() {
        const table = this.table.table;
        const searchResultIndexes = table.results ? new Set(table.results) : null;

        return this.getCheckboxRowsForSelection(false, { excludeFileName: true }).filter((row) => {
            const rowIndex = row[PROCESS_COLUMNS.is_checked].rowIndex;
            const rowElement = row[PROCESS_COLUMNS.is_checked].td.closest('tr');

            if (rowElement.classList.contains('gray')) {
                return false;
            }

            return !searchResultIndexes || searchResultIndexes.has(rowIndex);
        });
    }

    /**
     * Change DataType
     * @param {number} rowIndex
     * @param {string} shownDataType
     * @param {boolean} isChangeHiddenColumn - check change datatype, column type
     */
    changeShownDataType(
        rowIndex,
        shownDataType,
        sampleDataDisplayMode = SAMPLE_DATA_DISPLAY_MODES.RECORDS,
        { isFirstLoad = false } = {},
    ) {
        DataTypeDropdown_Controller.changeShownDataType(this, rowIndex, shownDataType, sampleDataDisplayMode, {
            isFirstLoad,
        });
    }

    /**
     * Check if this table has any changes
     * TODO: see isHasChange implementation in `SpreadSheetProcessConfig` to implement for process name, data source name as well.
     * @return {boolean}
     */
    isHasChange() {
        // if (!currentProcess) {
        //     // New process, always mark as "has changes"
        //     return true;
        // }

        return this.table.isHasChange(SpreadSheetProcessConfig.trackingHeaders());
    }

    /**
     * Headers for tracking changes
     * @returns {(string)[]}
     */
    static trackingHeaders() {
        return [
            PROCESS_COLUMNS.is_checked,
            PROCESS_COLUMNS.column_raw_name,
            PROCESS_COLUMNS.shown_data_type,
            PROCESS_COLUMNS.name_en,
            PROCESS_COLUMNS.name_jp,
            PROCESS_COLUMNS.name_local,
            PROCESS_COLUMNS.unit,
            PROCESS_COLUMNS.filter,
            PROCESS_COLUMNS.formula,
        ];
    }

    static dataTypeDropdownColumn() {
        // JSpreadsheet detaches rows outside the current page from the table
        // DOM. Keep the owning instance separately because `closest()` cannot
        // resolve it from a detached data-type cell.
        const spreadsheetInstances = new WeakMap();

        return {
            // Methods
            bindSpreadsheetInstance: function (cell, instance) {
                spreadsheetInstances.set(cell, instance);
            },
            closeEditor: function (cell, save) {
                if (cell.children.length > 0) {
                    // in case not change data type and out click to close dropdown modal
                    DataTypeDropdown_Controller.hideAllDropdownMenu.callback = undefined;
                    const $dropdown = $(cell.children[0]);
                    const $span = $dropdown.find('button > span');
                    const value = $span.text().trim();
                    $dropdown.remove();
                    cell.innerHTML = value;
                }
                return cell.innerHTML;
            },
            openEditor: function (cell, instance) {
                const $cell = $(cell);
                const idx = $cell.data('y');
                const spreadsheet = spreadsheetProcConfig(instance);
                const rowData = spreadsheet.table.getRowDataByIndex(idx);
                const defaultValue = {
                    text: rowData.shown_data_type,
                    value: rowData.raw_data_type,
                    is_get_date: rowData.is_get_date ?? false,
                    is_main_date: rowData.column_type === masterDataGroup.MAIN_DATE,
                    is_main_time: rowData.column_type === masterDataGroup.MAIN_TIME,
                    is_serial_no: rowData.column_type === masterDataGroup.SERIAL,
                    is_dummy_datetime: rowData.is_dummy_datetime ?? false,

                    is_auto_increment: rowData.is_auto_increment ?? false,
                    is_file_name: rowData.is_file_name ?? false,
                    is_main_serial_no: rowData.column_type === masterDataGroup.MAIN_SERIAL,
                    is_int_cat: rowData.column_type === masterDataGroup.INT_CATE,
                    isRegisteredCol: rowData.id > 0,

                    is_line_name: rowData.column_type === masterDataGroup.LINE_NAME,
                    is_line_no: rowData.column_type === masterDataGroup.LINE_NO,
                    is_eq_name: rowData.column_type === masterDataGroup.EQ_NAME,
                    is_eq_no: rowData.column_type === masterDataGroup.EQ_NO,
                    is_part_name: rowData.column_type === masterDataGroup.PART_NAME,
                    is_part_no: rowData.column_type === masterDataGroup.PART_NO,
                    is_st_no: rowData.column_type === masterDataGroup.ST_NO,
                    is_judge: rowData.column_type === masterDataGroup.JUDGE,
                    is_proc_name: rowData.column_type === masterDataGroup.PROC_NAME,
                };
                let getKey = null;
                Object.entries(defaultValue).forEach((item) => {
                    const [key, value] = item;
                    if (key.startsWith('is_') && value) {
                        getKey = key;
                    }
                });
                const disableDropDownToggle = false;

                // Update cell
                cell.classList.add('editor');
                cell.innerHTML = '';

                // Init dropdown control
                const dropdownHTML = DataTypeDropdown_Controller.generateHtml(
                    idx,
                    defaultValue,
                    getKey,
                    disableDropDownToggle,
                );
                const $dropdown = $(dropdownHTML);
                const dropdown = $dropdown[0];
                $cell.append($dropdown);
                DataTypeDropdown_Controller.injectEvent(dropdown);
                $dropdown.find('button').trigger('click');
                DataTypeDropdown_Controller.hideAllDropdownMenu.callback = () => {
                    DataTypeDropdown_Controller.hideAllDropdownMenu.callback = undefined;
                    const $span = $dropdown.find('button > span');
                    const value = $span.text().trim();
                    $dropdown.remove();

                    spreadsheet.table.startTransaction(cell);

                    cell.innerHTML = value;

                    setTimeout(function () {
                        spreadsheet.table.closeEditor(cell, true);
                    });
                };
            },
            getValue: function (cell) {
                return cell.innerHTML;
            },
            setValue: function (cell, value) {
                if (!i18nDataTypeText.includes(value)) {
                    // set data type string if value not in dropdown option
                    value = DataTypes.STRING.selectionBoxDisplay;
                }
                cell.innerHTML = value;
                const rowIndex = Number(cell.dataset.y);
                const spreadsheet = spreadsheetProcConfig(spreadsheetInstances.get(cell) || cell);
                if (!spreadsheet.isValid()) {
                    throw new Error(`Cannot resolve Process Config spreadsheet for row ${rowIndex + 1}`);
                }
                const sampleDataDisplayMode = getSampleDataDisplayModeElement(spreadsheet.table.table.el).val();
                spreadsheet.changeShownDataType(rowIndex, value, sampleDataDisplayMode);
            },
        };
    }

    /**
     * Return options for constructing table.
     * @param {boolean} registerByFile - is this register by file?
     * @returns {{customEvents: (function(): {onbeforechange: function(*, *, *, *, *): *, updateTable: function(*, *, *, *, *, *, *): void, onload: function(*): void}), columns: [{name: string, type: string},{name: string, type: string},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): *), setValue: (function(*, *): *), createCell: (function(*): *), openEditor: *}, width: string, name: string, type: string, title: string},{width: string, name: string, readOnly: boolean, type: string, title: *},{editor: {getValue: (function(*): *), closeEditor: (function(*, *): string), setValue: *, openEditor: *}, width: string, name: string, options: {}, type: string, title: *},null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null], customOptions: {tableOverflow: boolean, copyCompatibility: boolean, tableWidth: string, stripHTMLOnCopy: boolean, freezeColumns: number}}}
     */
    static options({ registerByFile = false } = {}) {
        const columns = [
            {
                type: 'checkbox',
                width: '22',
                name: PROCESS_COLUMNS.is_checked,
                title: COLUMN_IS_CHECKED_TITLE,
            },
            {
                type: 'text',
                width: '150',
                name: PROCESS_COLUMNS.column_raw_name,
                title: $(procModali18n.i18nColumnRawName).text(),
                readOnly: true,
            },
            {
                type: 'text',
                width: '130',
                name: PROCESS_COLUMNS.shown_data_type,
                title: $(procModali18n.i18nDatatype).text(),
                options: {},
                editor: SpreadSheetProcessConfig.dataTypeDropdownColumn(),
            },
            {
                type: 'text',
                width: '150',
                name: PROCESS_COLUMNS.name_en,
                title: $('#i18nSystemName').text(),
            },
            {
                type: 'text',
                width: '150',
                name: PROCESS_COLUMNS.name_jp,
                title: $(procModali18n.i18nJapaneseName).text(),
            },
            {
                type: 'text',
                width: '150',
                name: PROCESS_COLUMNS.name_local,
                title: $(procModali18n.i18nLocalName).text(),
            },
            {
                type: 'text',
                width: '100',
                name: PROCESS_COLUMNS.unit,
                title: $(procModali18n.i18nUnit).text(),
            },
            {
                type: 'text',
                width: String(PROCESS_CONFIG_FORMULA_WIDTH),
                name: PROCESS_COLUMNS.formula,
                title: $(procModali18n.i18nJudgeFormulaTitle).text(),
            },
            {
                type: 'text',
                width: '100',
                name: PROCESS_COLUMNS.filter,
                title: 'Filter',
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_1',
                title: $(procModali18n.i18nSampleData).text(),
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_2',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_3',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_4',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_5',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_6',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_7',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_8',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_9',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'text',
                width: '160',
                name: 'sample_data_10',
                title: ' ',
                readOnly: true,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.id,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.column_name,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.raw_data_type,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.column_type,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.data_type,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_serial_no,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_get_date,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_file_name,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_auto_increment,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_generated_datetime,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_dummy_datetime,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_null,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.process_id,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.judge_available,
            },
            {
                type: 'hidden',
                name: PROCESS_COLUMNS.is_judge,
            },
        ];

        // get first index of sample data
        const firstSampleDataIndex = columns.findIndex((col) => col.name.startsWith(SAMPLE_DATA_KEY));
        const customOptions = {
            freezeColumns: firstSampleDataIndex,
            tableOverflow: true,
            tableHeight: 'calc(100vh - 370px)',
            tableWidth: '100%',
            pagination: 100,
            paginationOptions: [10, 25, 50, 100],
        };
        if (docCookies.isJaLocale()) {
            customOptions['text'] = {
                showingPage: '{1} 件中 {0} ページを表示',
            };
        }

        let previousPageSize = customOptions.pagination;
        const customEvents = {
            onload: (instance) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                spreadsheet.setupPaginationToolbar();
                const allRows = spreadsheet.table.getRowsByHeadersAndIndexes();
                const shownDataTypeColumnIndex = spreadsheet.table.getIndexHeaderByName(
                    PROCESS_COLUMNS.shown_data_type,
                );
                const shownDataTypeEditor = spreadsheet.table.table.options.columns[shownDataTypeColumnIndex].editor;

                allRows.forEach((row) => {
                    shownDataTypeEditor.bindSpreadsheetInstance(row[PROCESS_COLUMNS.shown_data_type].td, instance);
                });

                spreadsheet.loadCheckBoxStatus(...allRows);
                spreadsheet.loadIsShowFileNameCheckbox();
                spreadsheet.loadTotalCheckedColumns();

                spreadsheet.loadHeaderStatus();
                spreadsheet.table.sortInHeaderColumn();
                spreadsheet.loadCSS();
                spreadsheet.addJudgeFormulationClass();

                spreadsheet.updateOriginalValueSampleData(...allRows);
                spreadsheet.updateColumnClassName(...allRows);
                spreadsheet.updateTooltips(...allRows);

                spreadsheet.table.customCheckbox(...allRows);

                // make sure this table is loaded
                spreadsheet.table.setLoaded();

                // make sure we do not allow pasting rows that exceed the current row numbers
                spreadsheet.table.setDisablePasteExceedNumberOfRows();
            },

            onbeforechange: (instance, cell, c, r, changedValue) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                return spreadsheet.handleBeforeChangeCell(cell, c, r, changedValue);
            },

            onchange: (instance, records, c, r, newValue, oldValue) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                spreadsheet.handleChangeCell(c, r, newValue, oldValue);
            },

            onchangepage: async (instance, index, oldPage) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                spreadsheet.table.setPage(index);
                const displayMode = getDisplayModeFromToolsBarsElement(instance);
                const pageSize = spreadsheet.table.table.options.pagination;
                const pageSizeChanged = pageSize !== previousPageSize;
                previousPageSize = pageSize;
                if (index !== oldPage || pageSizeChanged) {
                    if (displayMode === SAMPLE_DATA_DISPLAY_MODES.UNIQUE) {
                        await ensureUniqueSampleData(spreadsheet);
                    }
                    this.updateSampleDataByDisplayMode(spreadsheet, displayMode);
                }
            },

            onafterchanges: async (instance, records) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                for (const record of records) {
                    const { x: columnIndex, y: rowIndex, newValue: newValue } = record;
                    const cell = spreadsheet.table.getCellFromCoords(columnIndex, rowIndex);
                    spreadsheet.table.closeTransaction(cell);
                    const header = spreadsheet.table.getHeaderByIndex(columnIndex);
                    const rowData = spreadsheet.table.getRowDataByIndex(rowIndex);
                    if (header.name === PROCESS_COLUMNS.formula) {
                        const isValidPattern = await spreadsheet.validateFormulation(rowIndex, newValue);
                        if (isValidPattern) {
                            const sampleDataDisplayMode = getSampleDataDisplayModeElement(
                                spreadsheet.table.table.el,
                            ).val();
                            await parseDataTypeProc(
                                spreadsheet,
                                rowData.data_type,
                                rowIndex,
                                rowData.column_type,
                                sampleDataDisplayMode,
                            );
                        } else {
                            spreadsheet.table.table.undo();
                        }
                    }
                }
                if (!spreadsheet.table.table.isCopyingShownDataType) {
                    spreadsheet.table.reIndexForSpecialRow(spreadsheet.table);
                }
            },

            oninsertrow: (instance, rowNumber, numOfRows, rowRecords, insertBefore) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                const rowIndexes = rowRecords.map((tds) => {
                    const td = _.first(tds);
                    return td.dataset.y;
                });

                const rows = spreadsheet.table.getRowsByHeadersAndIndexes(undefined, rowIndexes);
                const shownDataTypeColumnIndex = spreadsheet.table.getIndexHeaderByName(
                    PROCESS_COLUMNS.shown_data_type,
                );
                const shownDataTypeEditor = spreadsheet.table.table.options.columns[shownDataTypeColumnIndex].editor;
                rows.forEach((row) => {
                    shownDataTypeEditor.bindSpreadsheetInstance(row[PROCESS_COLUMNS.shown_data_type].td, instance);
                });

                spreadsheet.updateOriginalValueSampleData(...rows);
                spreadsheet.updateColumnClassName(...rows);
                spreadsheet.table.customCheckbox(...rows);
                spreadsheet.updateTooltips(...rows);
            },

            /**
             * On undo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord} historyRecord
             */
            onundo: (instance, historyRecord) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                if (historyRecord) {
                    spreadsheet.updateTooltips(...spreadsheet.table.getRowsByHeadersAndIndexes());
                    spreadsheet.handleChangeMark();
                }
            },

            /**
             * On redo event
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {jspreadsheet.HistoryRecord} historyRecord
             */
            onredo: (instance, historyRecord) => {
                const spreadsheet = spreadsheetProcConfig(instance);
                if (historyRecord) {
                    spreadsheet.updateTooltips(...spreadsheet.table.getRowsByHeadersAndIndexes());
                    spreadsheet.handleChangeMark();
                }
            },

            /**
             * Do some check on row moving
             * @param {jspreadsheet.JspreadsheetInstanceElement} instance
             * @param {string} oldIndex
             */
            onmoverow: (instance, oldIndex, newIndex) => {
                const spreadsheet = jspreadsheetTable(instance);
                const { data } = spreadsheet.table.getConfig();

                // return because event insert row also trigger onmoverow
                if (Number(oldIndex) >= data.length - 1) {
                    return;
                }
                // compare oldIndex with special row index if match then undo
                const row = spreadsheet.getRowDataByIndex(newIndex);

                if (checkSpecialRow(row)) {
                    spreadsheet.table.undo();
                }

                spreadsheet.reIndexForSpecialRow(spreadsheet);
            },

            // Use oneditionstart so that styling for cell expansion only happens on edit and not on selecting cells
            // Refer to https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/merge_requests/7219#note_2891669260
            // TODO: Possible improvement: https://gitlab.com/dot-asterisk/biz-app/analysis-interface/analysisinterface/-/issues/175
            oneditionstart: (instance, cell, x, y) => {
                const spreadsheet = jspreadsheetTable(instance);
                spreadsheet.expandWidthForFormulaWhenFocus(spreadsheet, Number(x), Number(y));
            },
        };

        return {
            columns,
            customEvents,
            customOptions,
        };
    }
}

const getProcessNameElementFromElement = (element) => {
    const processSectionElement = element.closest('[id^="procSettingModalBody"]');
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="processName"]`);
    return $(fileNameCheckBoxElement);
};
const getTotalCheckedColumnElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="totalCheckedColumn"]`);
    return $(fileNameCheckBoxElement);
};

const getTotalColumnElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="totalColumn"]`);
    return $(fileNameCheckBoxElement);
};

const getSearchInputElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="processConfigModalSearchInput"]`);
    return $(fileNameCheckBoxElement);
};

const getSetElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="processConfigModalSetBtn"]`);
    return $(fileNameCheckBoxElement);
};

const getResetElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement.querySelector(`[id^="processConfigModalResetBtn"]`);
    return $(fileNameCheckBoxElement);
};

const getFileNameCheckboxFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const fileNameCheckBoxElement = processSectionElement?.querySelector(`[id^="isShowFileName"]`);
    return $(fileNameCheckBoxElement);
};

const getDatetimeFormatCheckboxFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const datetimeFormatCheckBoxElement = processSectionElement.querySelector(`[id^="toggleProcDatetimeFormat"]`);
    return $(datetimeFormatCheckBoxElement);
};

const getDatetimeFormatInputFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const datetimeFormatCheckBoxElement = processSectionElement.querySelector(`[id^="procDatetimeFormat"]`);
    return $(datetimeFormatCheckBoxElement);
};

const getDownloadElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const datetimeFormatCheckBoxElement = processSectionElement.querySelector(`[id^="procSettingModalDownloadAllBtn"]`);
    return $(datetimeFormatCheckBoxElement);
};

const getCopyAllElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const datetimeFormatCheckBoxElement = processSectionElement.querySelector(`[id^="procSettingModalCopyAllBtn"]`);
    return $(datetimeFormatCheckBoxElement);
};

const getPasteAllElementFromElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const datetimeFormatCheckBoxElement = processSectionElement.querySelector(`[id^="procSettingModalPasteAllBtn"]`);
    return $(datetimeFormatCheckBoxElement);
};

const getSpreadSheetFromToolsBarElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const speadSheetTableElement = processSectionElement.querySelector(`[id^="processColumnsTable"]`);

    return spreadsheetProcConfig(speadSheetTableElement);
};

const getDisplayModeFromToolsBarsElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const displayModeEl = processSectionElement.querySelector(`[name^="sampleDataDisplayMode"]:checked`);
    return displayModeEl.value;
};

const sortColumnGraphConfig = (containerSelector = 'table') => {
    // handle sort
    $(`${containerSelector} .sortCol`).off('click');
    $(`${containerSelector} .sortCol`).on('click', (el) => {
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
        const containerEl = sortEl.closest(containerSelector);
        const otherSortCols = $(containerEl).find(`.sortCol:not([idx=${idx}])`);
        otherSortCols.removeAttr('clicked');
        otherSortCols.removeClass('asc desc');

        const table = jspreadsheetTable(procModalElements.procConfigTableName);
        table.sortBy(Number(idx));
    });
};

const getSampleDataDisplayModeElement = (element) => {
    const processSectionElement = element.closest(`[id^="procSettingModalBody"]`);
    const sampleDataDisplayModeElement = processSectionElement.querySelector(`[name^="sampleDataDisplayMode"]:checked`);
    return $(sampleDataDisplayModeElement);
};

const validateFormula = async (formula, columnType, dataType, isRegistered = false, columnId = null) => {
    return fetch('/ap/api/setting/formula_validate', {
        method: 'POST',
        body: JSON.stringify({
            formula: formula,
            col_type: columnType,
            data_type: dataType,
            is_registered: isRegistered,
            column_id: columnId,
        }),
    })
        .then((res) => res.json())
        .catch((error) => {
            console.log(error);
            return false;
        });
};
