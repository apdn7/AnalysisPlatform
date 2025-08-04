/**
 * @file Contains helper functions that serve for data type dropdown.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Class contains all helper functions that serves for data type dropdown menu control
 */
class DataTypeDropdown_Helper extends DataTypeDropdown_Constant {
    /**
     * Show DataType Modal
     * @param {Event} event - an HTML object of dropdown
     */
    static showDataTypeModal(event) {
        const dataTypeDropdownElement = /** @type HTMLDivElement */ event.currentTarget.closest(
            'div.config-data-type-dropdown',
        );
        DataTypeDropdown_Controller.init(dataTypeDropdownElement);
        DataTypeDropdown_Controller.hideAllDropdownMenu();

        // Calculate position to show dropdown menu
        const $dropdownEl = $(dataTypeDropdownElement).find('.data-type-selection');
        $dropdownEl.show(); // need show to get exactly height of child element
        const dropdownHeight = $dropdownEl.find('.data-type-selection-left').height();
        const windowHeight = $(window).height();
        const left = event.clientX || dataTypeDropdownElement.getClientRects()[0].x;
        let top = event.clientY || dataTypeDropdownElement.getClientRects()[0].y + 26;
        if (top + dropdownHeight > windowHeight) {
            top -= top + dropdownHeight - windowHeight;
        }
        $dropdownEl.css({
            position: 'fixed',
            top: top,
            left: left,
            display: 'flex',
            zIndex: '99999',
        });
    }

    /**
     * Initialize
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param options - Option for dropdown initialization
     * @param {boolean} options.resetDefaultInput - Whether to reset inputs (nameEn, nameJp, etc.) to theirs default values
     */
    static init(dataTypeDropdownElement, options = { resetDefaultInput: true }) {
        const $dataTypeDropdownElement = $(dataTypeDropdownElement);
        $dataTypeDropdownElement.find('ul li').removeClass('active');

        const showValueOption = this.getShowValueElement(dataTypeDropdownElement);
        const rawDataType = showValueOption.getAttribute('value');
        let attrKey = showValueOption.dataset.attrKey;
        const isRegisteredCol = showValueOption.getAttribute('is-registered-col') === 'true';
        const isBigInt = showValueOption.getAttribute('is-big-int') === 'true';
        const selectOption = this.getOptionByAttrKey(dataTypeDropdownElement, rawDataType, attrKey);
        const parentDropdownEle = $dataTypeDropdownElement.closest('td');
        const isInitialize = parentDropdownEle.attr('is-initialize') === 'true';
        selectOption.addClass('active');

        this.setValueToShowValueElement(dataTypeDropdownElement, rawDataType, selectOption.text(), attrKey);

        // if (options.resetDefaultInput) {
        //     this.setDefaultNameAndDisableInput(dataTypeDropdownElement, attrKey);
        // }

        this.disableOtherDataType(
            dataTypeDropdownElement,
            isRegisteredCol || isBigInt,
            rawDataType,
            attrKey,
            isInitialize,
        );

        if (currentProcess?.is_show_file_name != null && !isInitialize) {
            // data of process imported
            this.disableDatetimeMainItem(dataTypeDropdownElement);
        }

        // exist column judge then disable for others
        if (currentProcess?.columns.find((col) => col.is_judge) && !isInitialize) {
            this.disableJudgeItem(dataTypeDropdownElement);
        }

        // if (isInitialize) {
        //     this.enableDataType(dataTypeDropdownElement);
        // }
    }

    /**
     * Only trigger event when element is not disabled
     * @param {function(Event): void} func
     * @return {inner}
     */
    static eventWrapper(func) {
        function inner(event) {
            const htmlElement = /** @type HTMLElement */ event.currentTarget || event;
            if (htmlElement.getAttribute('disabled')) return;
            func.call(this, event);
        }

        return inner;
    }

    /**
     * Check data type is allow to edit format or not
     * @param {string} dataType - a data type string
     * @return {boolean} - true: allow format, false: not allow to edit format
     */
    static isDataTypeAllowFormat = (dataType) => {
        return this.AllowFormatingDataType.includes(dataType);
    };

    /**
     * Hide all data type dropdown on UI
     * @param {function(): void} callback
     */
    static hideAllDropdownMenu(callback = DataTypeDropdown_Helper.hideAllDropdownMenu.callback) {
        $('.data-type-selection').hide();
        (callback ?? (() => {}))();
    }

    /**
     * Get Show Value Element
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @return {HTMLElement}
     */
    static getShowValueElement(dataTypeDropdownElement) {
        return dataTypeDropdownElement.querySelector(`span[name="${this.ElementNames.dataType}"]`);
    }

    /**
     * Get Option By Attribute Key
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} value - value of option
     * @param {string} attrKey - attrKey of option
     * @return {jQuery}
     */
    static getOptionByAttrKey(dataTypeDropdownElement, value, attrKey) {
        return $(dataTypeDropdownElement)
            .find(`ul li[value=${value}]${attrKey ? `[${attrKey}]` : '[only-datatype]'}`)
            .first();
    }

    /**
     * Set Value To Show Value Element
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} value - value of option
     * @param {string} text - text want to set
     * @param {string} attrKey - attrKey of option
     */
    static setValueToShowValueElement(dataTypeDropdownElement, value, text, attrKey) {
        const showValueEl = this.getShowValueElement(dataTypeDropdownElement);

        if (text) {
            showValueEl.textContent = text;
        }
        for (const attr of DataTypeAttrs) {
            showValueEl.removeAttribute(attr);
        }
        showValueEl.removeAttribute('column_type');
        showValueEl.removeAttribute('data-attr-key');

        if (attrKey) {
            showValueEl.setAttribute(attrKey, 'true');
            showValueEl.setAttribute('data-attr-key', attrKey);
            showValueEl.setAttribute(
                'column_type',
                DataTypeDropdown_Controller.DataGroupType[mappingDataGroupType[attrKey]], // ONLY FOR EDGE SERVER
            );
        }
        showValueEl.setAttribute('value', value);
        showValueEl.setAttribute('data-raw-data-type', value); // For Bridge Station
    }

    /**
     * Set Default Name And Disable Input
     * @param {JspreadSheetTable} table - jspreadsheet table
     * @param {number} columnType - column type of row
     * @param {number} rowIndex - index of row
     */
    static setDefaultNameAndDisableInput(table, columnType, rowIndex) {
        const systemNameColumnIdx = table.getIndexHeaderByName(PROCESS_COLUMNS.name_en);
        const japaneseNameColumnIdx = table.getIndexHeaderByName(PROCESS_COLUMNS.name_jp);
        const localNameColumnIdx = table.getIndexHeaderByName(PROCESS_COLUMNS.name_local);

        const systemNameCell = table.getCellFromCoords(systemNameColumnIdx, rowIndex);
        const japaneseNameCell = table.getCellFromCoords(japaneseNameColumnIdx, rowIndex);
        const localNameCell = table.getCellFromCoords(localNameColumnIdx, rowIndex);
        const oldValSystem = systemNameCell.getAttribute('old-value') || '';
        const oldValJa = japaneseNameCell.getAttribute('old-value') || '';
        const oldValLocal = localNameCell.getAttribute('old-value') || '';
        if (fixedNameColumnTypes.includes(columnType)) {
            // set default value to system and input
            if (!oldValSystem || !oldValJa) {
                systemNameCell.setAttribute('old-value', systemNameCell.textContent);
                japaneseNameCell.setAttribute('old-value', japaneseNameCell.textContent);
                localNameCell.setAttribute('old-value', localNameCell.textContent);
            }

            table.setValueFromCoords(systemNameColumnIdx, rowIndex, fixedName[columnType].system, true);
            systemNameCell.classList.add(READONLY_CLASS, 'disabled');
            table.setValueFromCoords(japaneseNameColumnIdx, rowIndex, fixedName[columnType].japanese, true);
            japaneseNameCell.classList.add(READONLY_CLASS, 'disabled');
            table.setValueFromCoords(localNameColumnIdx, rowIndex, fixedName[columnType].system, true);
            localNameCell.classList.add(READONLY_CLASS, 'disabled');
        } else {
            systemNameCell.classList.remove(READONLY_CLASS, 'disabled');
            japaneseNameCell.classList.remove(READONLY_CLASS, 'disabled');
            localNameCell.classList.remove(READONLY_CLASS, 'disabled');
            // revert to original name
            if (oldValSystem && oldValJa) {
                table.setValueFromCoords(systemNameColumnIdx, rowIndex, oldValSystem, true);
                table.setValueFromCoords(japaneseNameColumnIdx, rowIndex, oldValJa, true);
                table.setValueFromCoords(localNameColumnIdx, rowIndex, oldValLocal, true);
            }
        }
    }

    /**
     * Disable Other DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {boolean} isRegisteredCol - isRegisteredCol
     * @param {string} dataType - data type want to disable
     * @param {string} attrKey - attrKey of option
     */
    static disableOtherDataType(dataTypeDropdownElement, isRegisteredCol = false, dataType, attrKey, isInitialize) {
        if (!isRegisteredCol || isInitialize) return;
        if (this.UnableToReselectAttrs.includes(attrKey)) {
            // disable all option
            $(dataTypeDropdownElement).find(`ul li.dataTypeSelection:not([${attrKey}])`).attr('disabled', true);
        } else {
            // select all other data type option -> add disabled
            let dataTypeAllows = [dataType];
            const indexOrder = this.DataTypeOrder.indexOf(dataType);
            if (indexOrder !== -1) {
                for (let i = indexOrder; i < this.DataTypeOrder.length; i++) {
                    dataTypeAllows.push(this.DataTypeOrder[i]);
                }
            }

            $(dataTypeDropdownElement)
                .find(`ul li.dataTypeSelection`)
                .each((index, liElement) => {
                    const $liElement = $(liElement);
                    let dataType = $liElement.attr('value');
                    if (!dataTypeAllows.includes(dataType)) {
                        $liElement.attr('disabled', String(true));
                    }
                });
        }
    }

    /**
     * Enable DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static enableDataType(dataTypeDropdownElement) {
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection`).attr('disabled', false);
    }

    /**
     * Disable Other DataType
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {boolean} isRegisteredCol - isRegisteredCol
     * @param {string} dataType - data type want to disable
     * @param {string} attrKey - attrKey of option
     */
    // TODO: refactor
    static disableOtherDataType_New(cell, value, rowData, oldDataType, newDataType) {
        if ((typeof isInitialize !== 'undefined' && isInitialize) || rowData.id < 0) return value;
        const unableToReselectAttrs = [
            masterDataGroup.MAIN_TIME,
            masterDataGroup.MAIN_DATE,
            masterDataGroup.MAIN_DATETIME,
            masterDataGroup.DATETIME_KEY,
            masterDataGroup.JUDGE,
        ];

        if (unableToReselectAttrs.includes(rowData.column_type)) {
            // return old value
            value = cell.innerText;
        } else {
            // select all other data type option -> add disabled
            let dataTypeAllows = [oldDataType];
            const indexOrder = this.DataTypeOrder.indexOf(oldDataType);
            if (indexOrder !== -1) {
                for (let i = indexOrder; i < this.DataTypeOrder.length; i++) {
                    dataTypeAllows.push(this.DataTypeOrder[i]);
                }
            }
            if (!dataTypeAllows.includes(newDataType)) {
                value = cell.innerText;
            }
        }
        return value;
    }

    /**
     * Check raw_data to enable or disable judge
     * @param {HTMLElement} ele
     */
    static disableOrEnableJudge(ele) {
        const index = $(ele).closest('tr').index();
        const vals = [...procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index}) .sample-data`)].map(
            (el) => $(el),
        );
        const attrName = DATA_ORIGINAL_ATTR;
        let countIllegal = 0;
        for (const e of vals) {
            let val = e.attr(attrName);
            if (!this.isBooleanValue(val)) {
                countIllegal++;
            }
        }
        const optionSelectJudge = $(ele).closest('tr').find('.data-type-selection').find(`li[is_judge]`);
        if (countIllegal > 0) {
            optionSelectJudge.attr('disabled', true);
        } else {
            optionSelectJudge.attr('disabled', false);
        }
    }

    /**
     * Check is boolean
     * @param {HTMLElement} val
     */
    static isBooleanValue(val) {
        return (
            typeof val === 'boolean' ||
            (typeof val === 'string' && ['0', '1', 'true', 'false'].includes(val.toLowerCase())) ||
            (typeof val === 'number' && [0, 1].includes(val))
        );
    }

    /**
     * Disable Datetime Main Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static disableDatetimeMainItem(dataTypeDropdownElement) {
        // disable copy function if allow select one item
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_get_date]`).attr('disabled', true);
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_main_date]`).attr('disabled', true);
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_main_time]`).attr('disabled', true);
    }

    /**
     * Disable Judge Item
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static disableJudgeItem(dataTypeDropdownElement) {
        $(dataTypeDropdownElement).find(`ul li.dataTypeSelection[is_judge]`).attr('disabled', true);
    }

    /**
     * onClick Data Type
     * @param {Event|HTMLLIElement} event
     */
    static onClickDataType(event) {
        const currentTarget = /** @type HTMLLIElement */ event.currentTarget || event;
        const dataTypeDropdownElement = /** @type HTMLDivElement */ currentTarget.closest(
            'div.config-data-type-dropdown',
        );
        const attrKey = DataTypeDropdown_Helper.getAttrOfDataTypeItem(currentTarget);
        const value = currentTarget.innerText;

        const spanElement = dataTypeDropdownElement.querySelector('button > span');
        spanElement.innerText = value;
        spanElement.setAttribute('value', value);
        spanElement.setAttribute('title', value);
        spanElement.removeAttribute('column_type');
    }

    /**
     * Get Attribute Key Of DataType Item
     * @param column
     * @return {string|string}
     */
    static getAttrKeyOfDataTypeItem(column) {
        for (const attr of this.ColumnTypeAttrs) {
            if (column[attr]) return attr;
        }

        return '';
    }

    /**
     * Get Attribute Of DataType Item
     * @param {HTMLElement | Event} event
     * @return {string|string}
     */
    static getAttrOfDataTypeItem(event) {
        const target = /** @type HTMLElement */ event.currentTarget || event;
        const attrs = target.getAttributeNames().filter((v) => this.ColumnTypeAttrs.includes(v));
        return attrs.length ? attrs[0] : '';
    }

    /**
     * Change DataType
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {number} rowIndex
     * @param {string} shownDataType
     * @param {boolean} isChangeHiddenColumn - check change datatype, column type
     */
    static changeShownDataType(
        spreadsheet,
        rowIndex,
        shownDataType,
        sampleDataDisplayMode = 'records',
        { isFirstLoad = false } = {},
    ) {
        const table = spreadsheet.table;
        const [dataType, columnType] = this.convertShownDataTypeToColumnTypeAndDataType(shownDataType);

        this.isAllowChangeDataType(true);

        // show modal confirm when change other datatype to Judge
        this.showConfirmModalWhenChangeDatatypeToJudge(
            spreadsheet,
            table,
            rowIndex,
            dataType,
            columnType,
            shownDataType,
            sampleDataDisplayMode,
            isFirstLoad,
        );

        if (!this.isAllowChange) return;

        this.handleChangeDatatype(
            spreadsheet,
            dataType,
            rowIndex,
            columnType,
            shownDataType,
            sampleDataDisplayMode,
            isFirstLoad,
        );
    }

    /**
     * Change DataType handle for reuse function
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {text} dataType
     * @param {number} rowIndex
     * @param {number} columnType
     * @param {string} shownDataType
     * @param {string} sampleDataDisplayMode
     * @param {boolean} isFirstLoad
     * @param parseData
     */
    static handleChangeDatatype(
        spreadsheet,
        dataType,
        rowIndex,
        columnType,
        shownDataType,
        sampleDataDisplayMode,
        isFirstLoad,
        parseData = true,
    ) {
        const table = spreadsheet.table;
        const beforeRowData = spreadsheet.table.getRowDataByIndex(rowIndex);
        const beforeColumnType = beforeRowData.column_type;
        // this.handleCheckDuplicateMainSerial(procConfigTable, rowIndex, shownDataType, dataType, columnType);
        // change data type
        this.changeDataType(table, dataType, rowIndex);
        // change column typ
        this.changeColumnType(table, columnType, rowIndex);
        this.disableShownDataType(table, columnType, rowIndex);
        // this.setValueToShowValueElement(dataTypeDropdownElement, value, text, attrKey); // TODO: check not use
        this.setDefaultNameAndDisableInput(table, columnType, rowIndex);

        // toggle input unit for cell if numeric data type
        this.toggleUnitInput(table, dataType, rowIndex, isFirstLoad);

        this.toggleFormulaInput(table, columnType, rowIndex, isFirstLoad);

        // disable data type column not input format
        // this.enableDisableFormatText(dataTypeDropdownElement, value); // ES not use
        this.resetOtherMainAttrKey(spreadsheet, shownDataType, rowIndex);

        // Do not parse before changing the data type for judgment.
        // Sample data should be parsed only after the formulation is displayed.
        if (parseData) {
            this.parseDataType(spreadsheet, dataType, rowIndex, columnType, sampleDataDisplayMode);
        }

        if ([masterDataGroup.MAIN_DATETIME].includes(columnType)) {
            // remove dummy datetime
            const dummyDatetimeRow = spreadsheet.dummyDateTimeRow();
            if (dummyDatetimeRow && !isFirstLoad) {
                ProcessConfigSection.removeDummyDatetimeColumn(spreadsheet.table);
            }
        }
        if (!isFirstLoad) {
            ProcessConfigSection.handleMainDateAndMainTime(spreadsheet, dataType, columnType, beforeColumnType);
        }
        // reindexing rows
        spreadsheet.table.reIndexForSpecialRow(spreadsheet.table);
    }

    /**
     * Change to normal data type for the another columns have same data type with main attribute key
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {string} shownDataType - column type
     * @param {number} currentRowIndex - main attribute key
     */
    static resetOtherMainAttrKey(spreadsheet, shownDataType, currentRowIndex) {
        const [currentRowDataType, currentRowColumnType] =
            this.convertShownDataTypeToColumnTypeAndDataType(shownDataType);

        // Do not check if this column type does not need to be unique.
        if (!this.AllowSelectOneAttrs.includes(currentRowColumnType)) {
            return;
        }

        const sameColumnTypeIndexes = spreadsheet
            .rowsByColumnTypes(currentRowColumnType)
            .map((row) => _.first(_.values(row)).rowIndex)
            .filter((rowIndex) => rowIndex !== currentRowIndex);

        // Change to normal data type for another columns have same data type with main attribute key
        sameColumnTypeIndexes.forEach((index) => this.changeToNormalDataType(spreadsheet.table, index));
    }

    /**
     * Change to normal data type for another columns have same data type with main attribute key
     * @param {JspreadSheetTable} table
     * @param {number} rowIndex - index of row
     */
    static changeToNormalDataType(table, rowIndex) {
        const rowData = table.getRowDataByIndex(rowIndex);
        const dataType = rowData[PROCESS_COLUMNS.raw_data_type];
        const normalShownDataType = this.convertColumnTypeAndDataTypeToShownDataType(
            masterDataGroup.GENERATED,
            dataType,
        );
        const shownDataTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type);
        table.setValueFromCoords(shownDataTypeIndex, rowIndex, normalShownDataType, true);
    }

    /**
     * Enable Disable Format Text
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} rawDataType - raw data type
     */
    static enableDisableFormatText(dataTypeDropdownElement, rawDataType = '') {
        const $tr = $(dataTypeDropdownElement).closest('tr');
        const isAllowFormat = this.isDataTypeAllowFormat(rawDataType);
        const $inputFormat = $tr.find(`input[name=${procModalElements.format}]`);
        const inputFormatValue = $inputFormat.val();
        if (isAllowFormat) {
            if (inputFormatValue == null || inputFormatValue === '') {
                $inputFormat.val($inputFormat[0]?.previousValue ?? '');
            }
        } else {
            if (!(inputFormatValue == null || inputFormatValue === '')) {
                $inputFormat.previousValue = inputFormatValue;
            }
            $inputFormat.val('');
        }
        $inputFormat.prop('disabled', !isAllowFormat);
    }

    /**
     * Set Column Type For Main Date Main Time
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @param {string} attrKey
     */
    static setColumnTypeForMainDateMainTime(dataTypeDropdownElement, attrKey) {
        const isMainDate = 'is_main_date' === attrKey;
        const isMainTime = 'is_main_time' === attrKey;
        const targetRow = dataTypeDropdownElement.closest('tr');
        const checkboxColumn = targetRow.querySelector('td.column-raw-name input[type="checkbox"]:first-child');

        if (!isMainDate && !isMainTime) {
            const originColumnType = checkboxColumn.getAttribute('origin-column-type');
            if (originColumnType != null && originColumnType !== '') {
                checkboxColumn.dataset['column_type'] = checkboxColumn.getAttribute('origin-column-type');
            } else {
                // do nothing
            }
        } else {
            checkboxColumn.setAttribute('origin-column-type', checkboxColumn.dataset['column_type'] ?? '');
            checkboxColumn.dataset['column_type'] = isMainDate
                ? DataTypeDropdown_Controller.DataGroupType.MAIN_DATE // ONLY FOR EDGE SERVER
                : DataTypeDropdown_Controller.DataGroupType.MAIN_TIME; // ONLY FOR EDGE SERVER
        }
    }

    /**
     * Disable cell in data type column
     * @param {JspreadSheetTable} table - jspreadsheet table
     * @param {number} columnType - column type
     * @param {number} rowIndex - index of row
     */
    static disableShownDataType(table, columnType, rowIndex, isInitialize = true) {
        // disable main datetime if process saved
        if (
            !isInitialize &&
            currentProcess &&
            [masterDataGroup.MAIN_DATETIME, masterDataGroup.MAIN_DATE, masterDataGroup.MAIN_TIME].includes(columnType)
        ) {
            const shownDataTypeColumnIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type);
            const disableCell = table.getCellFromCoords(shownDataTypeColumnIndex, rowIndex);
            disableCell.classList.add('readonly', 'disabled');
        }
    }

    /**
     * Change Data Type of row
     * @param {JspreadSheetTable} table - jspreadsheet table
     * @param {string} newRawDataType
     * @param {integer} rowIndex
     */
    static changeDataType(table, newRawDataType, rowIndex) {
        const rawDataTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.raw_data_type);
        table.setValueFromCoords(rawDataTypeIndex, rowIndex, newRawDataType);
        const dataTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.data_type);
        const dictConvertDataType = {
            REAL_SEP: DataTypes.REAL.name,
            EU_REAL_SEP: DataTypes.REAL.name,
            INTEGER_SEP: DataTypes.INTEGER.name,
            EU_INTEGER_SEP: DataTypes.INTEGER.name,
        };
        const newDataType = dictConvertDataType[newRawDataType] || newRawDataType;
        table.setValueFromCoords(dataTypeIndex, rowIndex, newDataType);
    }

    /**
     * Disable Unit cell of row
     * @param {JspreadSheetTable} table - jspreadsheet table
     * @param {string} newDataType
     * @param {integer} rowIndex
     * @param {boolean} isFirstLoad
     */
    static toggleUnitInput(table, newDataType, rowIndex, isFirstLoad) {
        const unitTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.unit);
        const unitCell = table.getCellFromCoords(unitTypeIndex, rowIndex);
        const dataTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.data_type);
        const dataTypeCell = table.getCellFromCoords(dataTypeIndex, rowIndex);
        // on first load data
        if (isFirstLoad) {
            if (!NUMERIC_TYPES.includes(newDataType)) {
                unitCell.classList.add(READONLY_CLASS, 'disabled');
                unitCell.setAttribute('old-value', unitCell.innerText);
                table.setValueFromCoords(unitTypeIndex, rowIndex, '', true);
            }
        }
        // on change data type
        else {
            const oldDataType = dataTypeCell.getAttribute('old-value');
            if (NUMERIC_TYPES.includes(oldDataType) && NUMERIC_TYPES.includes(newDataType)) {
                table.setValueFromCoords(unitTypeIndex, rowIndex, unitCell.innerText, true);
            } else if (!NUMERIC_TYPES.includes(oldDataType) && NUMERIC_TYPES.includes(newDataType)) {
                table.setValueFromCoords(unitTypeIndex, rowIndex, unitCell.getAttribute('old-value') || '', true);
                unitCell.classList.remove(READONLY_CLASS, 'disabled');
            } else if (NUMERIC_TYPES.includes(oldDataType) && !NUMERIC_TYPES.includes(newDataType)) {
                unitCell.setAttribute('old-value', unitCell.innerText);
                table.setValueFromCoords(unitTypeIndex, rowIndex, '', true);
                unitCell.classList.add(READONLY_CLASS, 'disabled');
            }
        }
        dataTypeCell.setAttribute('old-value', dataTypeCell.innerText);
    }

    /**
     * Disable and remove disable input judge formula
     * @param {JspreadSheetTable} table
     * @param {number} columnType
     * @param {number} rowIndex
     * @param {boolean} isFirstLoad
     * @param {boolean} force -> force to enable
     *
     */
    static toggleFormulaInput(table, columnType, rowIndex, isFirstLoad, force = false) {
        const formulaColumnIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.judge_formula);
        const formulaCell = table.getCellFromCoords(formulaColumnIndex, rowIndex);
        const isJudge = table.getCellByHeaderAndIndex(PROCESS_COLUMNS.is_judge, rowIndex).data;
        const isJudgeAvailable = table.getCellByHeaderAndIndex(PROCESS_COLUMNS.judge_available, rowIndex).data;
        // const columnType = table.getCellByHeaderAndIndex(PROCESS_COLUMNS.column_type, rowIndex);
        const isAcceptJudge = force || isFirstLoad ? isJudge : isJudgeAvailable;
        if (isAcceptJudge) {
            // enable input formula in this row
            formulaCell.classList.remove(READONLY_CLASS, 'disabled', 'text-hide');
        } else {
            // disable index formula other row
            formulaCell.classList.add(READONLY_CLASS, 'disabled', 'text-hide');
        }
    }

    /**
     * Change Column Type
     * @param {JspreadSheetTable} table - jspreadsheet table
     * @param {number} columnType
     * @param {number} rowIndex
     */
    static changeColumnType(table, columnType, rowIndex) {
        const columnTypeIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.column_type);
        table.setValueFromCoords(columnTypeIndex, rowIndex, columnType);
        // change is main serial
        const isGetDateColumnIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.is_get_date);
        table.setValueFromCoords(isGetDateColumnIndex, rowIndex, columnType === masterDataGroup.MAIN_DATETIME);
        // change is main serial
        const isMainSerialColumnIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.is_serial_no);
        table.setValueFromCoords(isMainSerialColumnIndex, rowIndex, columnType === masterDataGroup.MAIN_SERIAL);

        // change is auto increment
        const isAutoIncrement = table.getIndexHeaderByName(PROCESS_COLUMNS.is_auto_increment);
        table.setValueFromCoords(isAutoIncrement, rowIndex, columnType === masterDataGroup.DATETIME_KEY);

        const isJudge = table.getIndexHeaderByName(PROCESS_COLUMNS.is_judge);
        table.setValueFromCoords(isJudge, rowIndex, columnType === masterDataGroup.JUDGE);
    }

    /**
     * Parse DataType
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {string} dataType - new dataType
     * @param {number} rowIndex - rowIndex
     * @param {number} columnType - column type
     * @param sampleDataDisplayMode
     */
    static parseDataType(spreadsheet, dataType, rowIndex, columnType, sampleDataDisplayMode) {
        parseDataTypeProc(spreadsheet, dataType, rowIndex, columnType, sampleDataDisplayMode);
    }

    /**
     * onFocus DataType
     * @param {Event} e
     */
    static onFocusDataType(e) {
        const element = /** @type HTMLLIElement */ e.currentTarget;
        element.previousValue = element.value;
    }

    /**
     * Get Data Of Selected Option
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     * @return {(string|string|string|HTMLElement)[]}
     */
    static getDataOfSelectedOption(dataTypeDropdownElement) {
        const showValueEl = this.getShowValueElement(dataTypeDropdownElement);
        const attrKey = this.getAttrOfDataTypeItem(showValueEl);
        const dataType = showValueEl.dataset.rawDataType;
        return [dataType, attrKey, showValueEl];
    }

    /**
     * Set Value For Items
     * @param {HTMLDivElement} dataTypeDropdownElement - an HTML object of dropdown
     */
    static setValueForItems(dataTypeDropdownElement) {
        const aElements =
            /** @type NodeListOf<HTMLSpanElement> */
            dataTypeDropdownElement.querySelectorAll('button > span');
        aElements.forEach((aElement) => {
            aElement.value = aElement.dataset.value;
            aElement.previousValue = aElement.value;
        });
    }

    /**
     * Translate Datatype Name
     * @param {Readonly<DataTypeObject> | DataTypeObject} defaultValue
     * @param {string} getKey
     * @return {string} - a name of data type
     */
    static translateDatatypeName(defaultValue = this.DataTypeDefaultObject, getKey) {
        let text = '';
        const englishDataTypes = [
            DataTypes.REAL.name,
            DataTypes.INTEGER.name,
            DataTypes.INTEGER_CAT.name,
            DataTypes.STRING.name,
            DataTypes.DATETIME.name,
            DataTypes.TEXT.name,
            DataTypes.BOOLEAN.name,
        ];
        if (getKey) {
            text = datatypeI18nText[getKey];
            if (_.isObject(text)) {
                text = text[defaultValue.value];
            }
        } else if (englishDataTypes.includes(defaultValue.value)) {
            text = DataTypes[defaultValue.value].selectionBoxDisplay;
        } else {
            text = $('#' + DataTypes[defaultValue.value].i18nLabelID).text();
        }
        return text;
    }

    /**
     * Convert Column Type and DataType To Show Data Type
     * @public
     * @param {number} columnType - column type
     * @return {string} - column attribute dict
     */
    static convertColumnTypeAndDataTypeToShownDataType(columnType, dataType) {
        let col = DataTypes.STRING.selectionBoxDisplay;
        // Because judge is can use by several datatype than only check by datatype
        if (columnType === masterDataGroup.JUDGE) {
            col = $(procModali18n.i18nJudgeNo).text();
            return col;
        }
        if (dataType === DataTypes.DATETIME.name) {
            if (columnType === masterDataGroup.MAIN_DATETIME) {
                col = $(procModali18n.i18nMainDatetime).text();
            } else if (columnType === masterDataGroup.DATETIME_KEY) {
                col = $(procModali18n.i18nDatetimeKey).text();
            } else {
                col = DataTypes.DATETIME.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.INTEGER.name) {
            if (columnType === masterDataGroup.MAIN_SERIAL) {
                col = $(procModali18n.i18nMainSerialInt).text();
            } else if (columnType === masterDataGroup.SERIAL) {
                col = $(procModali18n.i18nSerialInt).text();
            } else if (columnType === masterDataGroup.PART_NO) {
                col = $(procModali18n.i18nPartNoInt).text();
            } else if (columnType === masterDataGroup.LINE_NO) {
                col = $(procModali18n.i18nLineNoInt).text();
            } else if (columnType === masterDataGroup.EQ_NO) {
                col = $(procModali18n.i18nEqNoInt).text();
            } else if (columnType === masterDataGroup.ST_NO) {
                col = $(procModali18n.i18nStNoInt).text();
            } else if (columnType === masterDataGroup.INT_CATE) {
                col = DataTypes.INTEGER_CAT.selectionBoxDisplay;
            } else {
                col = DataTypes.INTEGER.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.INTEGER_SEP.name) {
            col = procModali18n.i18nIntSep;
        } else if (dataType === DataTypes.EU_INTEGER_SEP.name) {
            col = procModali18n.i18nEuIntSep;
        }
        if (dataType === DataTypes.STRING.name) {
            if (columnType === masterDataGroup.MAIN_SERIAL) {
                col = $(procModali18n.i18nMainSerialStr).text();
            } else if (columnType === masterDataGroup.SERIAL) {
                col = $(procModali18n.i18nSerialStr).text();
            } else if (columnType === masterDataGroup.PART_NAME) {
                col = $(procModali18n.i18nPartNameStr).text();
            } else if (columnType === masterDataGroup.LINE_NAME) {
                col = $(procModali18n.i18nLineNameStr).text();
            } else if (columnType === masterDataGroup.EQ_NAME) {
                col = $(procModali18n.i18nEqNameStr).text();
            } else {
                col = DataTypes.STRING.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.DATE.name) {
            if (columnType === masterDataGroup.MAIN_DATE) {
                col = $(procModali18n.i18nMainDate).text();
            } else {
                col = DataTypes.DATE.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.TIME.name) {
            if (columnType === masterDataGroup.MAIN_TIME) {
                col = $(procModali18n.i18nMainTime).text();
            } else {
                col = DataTypes.TIME.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.BOOLEAN.name) {
            if (columnType === masterDataGroup.JUDGE) {
                col = $(procModali18n.i18nJudgeNo).text();
            } else {
                col = DataTypes.BOOLEAN.selectionBoxDisplay;
            }
        }
        if (dataType === DataTypes.REAL.name) {
            col = DataTypes.REAL.selectionBoxDisplay;
        } else if (dataType === DataTypes.REAL_SEP.name) {
            col = procModali18n.i18nRealSep;
        } else if (dataType === DataTypes.EU_REAL_SEP.name) {
            col = procModali18n.i18nEuRealSep;
        }
        return col;
    }

    /**
     * Convert Column Type and DataType To Shown Data Type
     * @public
     * @param {String} - shown data type
     */
    static convertShownDataTypeToColumnTypeAndDataType(shownDataType) {
        switch (shownDataType) {
            // master data type
            case $(procModali18n.i18nMainDatetime).text():
                return [DataTypes.DATETIME.name, masterDataGroup.MAIN_DATETIME];
            case $(procModali18n.i18nDatetimeKey).text():
                return [DataTypes.DATETIME.name, masterDataGroup.DATETIME_KEY];
            case $(procModali18n.i18nMainSerialInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.MAIN_SERIAL];
            case $(procModali18n.i18nSerialInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.SERIAL];
            case $(procModali18n.i18nPartNoInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.PART_NO];
            case $(procModali18n.i18nLineNoInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.LINE_NO];
            case $(procModali18n.i18nEqNoInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.EQ_NO];
            case $(procModali18n.i18nStNoInt).text():
                return [DataTypes.INTEGER.name, masterDataGroup.ST_NO];
            case $(procModali18n.i18nMainSerialStr).text():
                return [DataTypes.STRING.name, masterDataGroup.MAIN_SERIAL];
            case $(procModali18n.i18nSerialStr).text():
                return [DataTypes.STRING.name, masterDataGroup.SERIAL];
            case $(procModali18n.i18nPartNameStr).text():
                return [DataTypes.STRING.name, masterDataGroup.PART_NAME];
            case $(procModali18n.i18nLineNameStr).text():
                return [DataTypes.STRING.name, masterDataGroup.LINE_NAME];
            case $(procModali18n.i18nEqNameStr).text():
                return [DataTypes.STRING.name, masterDataGroup.EQ_NAME];
            case $(procModali18n.i18nMainDate).text():
                return [DataTypes.DATE.name, masterDataGroup.MAIN_DATE];
            case $(procModali18n.i18nMainTime).text():
                return [DataTypes.TIME.name, masterDataGroup.MAIN_TIME];
            case $(procModali18n.i18nJudgeNo).text():
                return [DataTypes.BOOLEAN.name, masterDataGroup.JUDGE];
            // normal data type
            case DataTypes.DATETIME.selectionBoxDisplay:
                return [DataTypes.DATETIME.name, masterDataGroup.GENERATED];
            case DataTypes.STRING.selectionBoxDisplay:
                return [DataTypes.STRING.name, masterDataGroup.GENERATED];
            case DataTypes.INTEGER_CAT.selectionBoxDisplay:
                return [DataTypes.INTEGER.name, masterDataGroup.INT_CATE];
            case procModali18n.i18nIntSep:
                return [DataTypes.INTEGER_SEP.name, masterDataGroup.GENERATED];
            case procModali18n.i18nEuIntSep:
                return [DataTypes.EU_INTEGER_SEP.name, masterDataGroup.GENERATED];
            case DataTypes.INTEGER.selectionBoxDisplay:
                return [DataTypes.INTEGER.name, masterDataGroup.GENERATED];
            case DataTypes.BOOLEAN.selectionBoxDisplay:
                return [DataTypes.BOOLEAN.name, masterDataGroup.GENERATED];
            case procModali18n.i18nRealSep:
                return [DataTypes.REAL_SEP.name, masterDataGroup.GENERATED];
            case procModali18n.i18nEuRealSep:
                return [DataTypes.EU_REAL_SEP.name, masterDataGroup.GENERATED];
            case DataTypes.REAL.selectionBoxDisplay:
                return [DataTypes.REAL.name, masterDataGroup.GENERATED];
            default:
                return [DataTypes.STRING.name, masterDataGroup.GENERATED];
        }
    }

    /**
     * show modal selectJudgeDataTypeConfirmModal when change unaccept to change Judge datatype
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {JspreadSheetTable} table
     * @param {number} rowIndex
     * @param {string} datatype
     * @param {number} columnType
     * @param {string} shownDataType
     * @param {string} sampleDataDisplayMode
     * @param {boolean} isFirstLoad
     */
    static showConfirmModalWhenChangeDatatypeToJudge(
        spreadsheet,
        table,
        rowIndex,
        datatype,
        columnType,
        shownDataType,
        sampleDataDisplayMode,
        isFirstLoad,
    ) {
        const $judgeConfirmModal = $('#selectJudgeDataTypeConfirmModal');
        if (isFirstLoad || columnType !== masterDataGroup.JUDGE) return;
        const isJudgeAvailable = table.getCellByHeaderAndIndex(PROCESS_COLUMNS.judge_available, rowIndex).data;
        if (!isJudgeAvailable) {
            this.isAllowChangeDataType(false);
            $judgeConfirmModal.modal('show');
            this.handleOnClickConfirmChangeJudgeDataTypeOKBtn(
                $judgeConfirmModal,
                spreadsheet,
                table,
                rowIndex,
                datatype,
                columnType,
                shownDataType,
                sampleDataDisplayMode,
                isFirstLoad,
            );
            this.handleOnClickConfirmChangeJudgeDataTypeCancelBtn($judgeConfirmModal, table, rowIndex);
        }
    }

    /**
     * set allow change datatype -> if is false do not change data type anymore
     * @param {boolean} isAllowChange
     * @return {boolean} isAllowChange
     */
    static isAllowChangeDataType(isAllowChange) {
        this.isAllowChange = isAllowChange;
    }

    /**
     * On click OK button of confirm change Judge type Modal
     * @param judgeConfirmModal
     * @param {SpreadSheetProcessConfig} spreadsheet
     * @param {JspreadSheetTable} table
     * @param {number} rowIndex
     * @param {string} dataType
     * @param {number} columnType
     * @param {string} shownDataType
     * @param {string} sampleDataDisplayMode
     * @param {boolean} isFirstLoad
     */
    static handleOnClickConfirmChangeJudgeDataTypeOKBtn(
        judgeConfirmModal,
        spreadsheet,
        table,
        rowIndex,
        dataType,
        columnType,
        shownDataType,
        sampleDataDisplayMode,
        isFirstLoad,
    ) {
        // Enter the conversion formula “Pos~1|Neg=OK|NG” in the Formula column
        const $OkBtn = judgeConfirmModal.find('button[name=OK]');
        $OkBtn.off('click');
        $OkBtn.on('click', () => {
            const columnIndex = table.getIndexHeaderByName(PROCESS_COLUMNS.judge_formula);
            this.handleChangeDatatype(
                spreadsheet,
                dataType,
                rowIndex,
                columnType,
                shownDataType,
                sampleDataDisplayMode,
                isFirstLoad,
                false,
            );
            this.toggleFormulaInput(table, columnType, rowIndex, false, true);
            table.setValueFromCoords(columnIndex, rowIndex, 'Pos~1|Neg=OK|NG', true);
            judgeConfirmModal.modal('hide');
        });
    }

    /**
     * On click Cancel button of changing judge type Modal
     * @param judgeConfirmModal
     * @param {JspreadSheetTable} table
     * @param {number} rowIndex
     */
    static handleOnClickConfirmChangeJudgeDataTypeCancelBtn(judgeConfirmModal, table, rowIndex) {
        // revert to original datatype
        const $cancelBtn = judgeConfirmModal.find('button[name=Cancel]');
        $cancelBtn.off('click');
        $cancelBtn.on('click', () => {
            this.changeToNormalDataType(table, rowIndex);
            judgeConfirmModal.modal('hide');
        });
    }
}
