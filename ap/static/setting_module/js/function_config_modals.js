/**
 * @file Contain all common functions to serve handling functions that relate to page.
 * @author Nguyen Huu Tuan <tuannh@fpt.com>
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 */

const FUNCTION_TABLE_CONTAINER = 'processColumnsTable_functionTable';
const SEPARATOR_CHAR = ',';
const DEFAULT_VALUE_PREFIX = 'default-value-';
const REQUIRED_VALUE_PREFIX = 'required-';
const IS_NUMBER_ATTR = 'is-number';

const CLASSES_FUNCTION = 'sample-data show-raw-text';
const ARRAY_ANS = ['a', 'n', 's'];
const ARRAY_BK = ['b', 'k'];
const ARRAY_CT = ['c', 't'];
const NUMERIC_TYPES = [
    DataTypes.REAL.name,
    DataTypes.INTEGER.name,
    DataTypes.EU_REAL_SEP.name,
    DataTypes.REAL_SEP.name,
    DataTypes.INTEGER_SEP.name,
    DataTypes.EU_INTEGER_SEP.name,
];
let selectedFunctionColumnInfo = null;
let mainSerialFunctionColumnInfo = null;
let dbFunctionCols = [];
let /** @type {function(): void} */ removeAllSyncEvents;

const functionConfigElements = {
    /** @type HTMLSelectElement */
    functionSettingModal: document.getElementById('functionSettingModal'),
    /** @type HTMLSelectElement */
    confirmCheckIsMainSerialModal: document.getElementById('confirmCheckIsMainSerialModal'),
    /** @type HTMLSelectElement */
    confirmChangeIsMainSerialFunctionColumnModal: document.getElementById(
        'confirmChangeIsMainSerialFunctionColumnModal',
    ),
    /** @type HTMLSelectElement */
    confirmReloadFunctionColumnModal: document.getElementById('confirmReloadFunctionColumnModal'),
    /** @type HTMLSelectElement */
    confirmUncheckMainSerialFunctionColumnModal: document.getElementById('confirmUncheckMainSerialFunctionColumnModal'),
    /** @type HTMLSelectElement */
    confirmAnyChangeDefinitionMainSerialFunctionColumnModal: document.getElementById(
        'confirmAnyChangeDefinitionMainSerialFunctionColumnModal',
    ),
    /** @type HTMLSelectElement */
    functionNameElement: document.getElementById('functionName'),
    /** @type HTMLTableElement */
    functionDetailsElement: document.getElementById('functionDetails'),
    /** @type HTMLSpanElement */
    outputElement: document.querySelector('#functionOutput span'),
    /** @type HTMLSpanElement */
    isMainSerialCheckboxElement: document.querySelector('#is_main_serial'),
    /** @type HTMLInputElement */
    systemNameElement: document.querySelector('#functionColumnSystemName input'),
    /** @type HTMLInputElement */
    japaneseNameElement: document.querySelector('#functionColumnJapaneseName input'),
    /** @type HTMLInputElement */
    localNameElement: document.querySelector('#functionColumnLocalName input'),
    /** @type HTMLSelectElement */
    varXElement: document.querySelector('#functionVarX select'),
    /** @type HTMLSelectElement */
    varXLabelElement: document.querySelector('#functionVarX label'),
    /** @type HTMLSelectElement */
    varYElement: document.querySelector('#functionVarY select'),
    /** @type HTMLInputElement */
    varYLabelElement: document.querySelector('#functionVarY label'),
    /** @type HTMLInputElement */
    coeANSElement: document.querySelector('#functionCoeANS input[name="functionCoeANS"]'),
    /** @type HTMLLabelElement */
    coeANSLabelElement: document.querySelector('#functionCoeANS label'),
    /** @type HTMLInputElement */
    coeBKElement: document.querySelector('#functionCoeBK input[name="functionCoeBK"]'),
    /** @type HTMLLabelElement */
    coeBKLabelElement: document.querySelector('#functionCoeBK label'),
    /** @type HTMLInputElement */
    coeCTElement: document.querySelector('#functionCoeCT input[name="functionCoeCT"]'),
    /** @type HTMLLabelElement */
    coeCTLabelElement: document.querySelector('#functionCoeCT label'),
    /** @type HTMLTextAreaElement */
    noteElement: document.querySelector('#functionNote textarea'),
    /** @type HTMLInputElement */
    xSampleDataLabel: document.querySelector('#functionSampleData th[name="xSampleData"]'),
    /** @type HTMLInputElement */
    helperMessageElement: document.getElementById('functionMessageHelper'),
    /** @type {HTMLTableElement & {result: string[]}} */
    sampleDataElement: document.getElementById('functionSampleData'),
    /** @type {function(): HTMLTableElement | null} */
    functionTableElement: () => document.querySelector('#processColumnsTable_functionTable table.jexcel'),
    /** @type HTMLSpanElement */
    totalCheckedFunctionColumnsElement: document.getElementById('totalCheckedFunctionColumns'),
    /** @type HTMLSpanElement */
    totalFunctionColumnsElement: document.getElementById('totalFunctionColumns'),
    /** @type HTMLSpanElement */
    functionUserSettingTableModal: document.getElementById('functionUserSettingModal'),
    /** @type HTMLSpanElement */
    functionUserSettingTableBody: document.querySelector(
        '#functionUserSettingModal table[id=functionUserSettingTable] tbody',
    ),
    /** @type HTMLInputElement */
    selectAllFunctionColumns: document.getElementById('selectAllFunctionColumns'),
    /** @type HTMLInputElement */
    selectErrorFunctionColumns: document.getElementById('selectErrorFunctionColumns'),
    /** @type HTMLDivElement */
    functionConfigConfirmSwitchEditingRowModal: document.getElementById('functionConfigConfirmSwitchEditingRowModal'),
    /**
     * In first load, i element will be changed to svg element
     * @type {function(): HTMLOrSVGElement}
     * */
    settingChangeMark: () => document.getElementById('functionSettingChangeMark'),
    /** @type HTMLDivElement */
    collapseFunctionConfig: document.getElementById('collapseFunctionConfig'),

    /** @type HTMLInputElement */
    searchInput: document.getElementById('functionConfigModalSearchInput'),
    /** @type HTMLButtonElement */
    setFilterBtn: document.getElementById('functionConfigModalSetFilterBtn'),
    /** @type HTMLButtonElement */
    resetBtn: document.getElementById('functionConfigModalResetBtn'),
    /** @type HTMLButtonElement */
    newBtn: document.getElementById('functionConfigModalNewBtn'),
    /** @type HTMLButtonElement */
    copyBtn: document.getElementById('functionConfigModalCopyBtn'),
    /** @type HTMLButtonElement */
    setBtn: document.getElementById('functionConfigModalSetBtn'),
    /** @type HTMLButtonElement */
    deleteBtn: document.getElementById('functionConfigModalDeleteBtn'),
    /** @type HTMLButtonElement */
    downloadAllBtn: document.getElementById('functionConfigModalDownloadAllBtn'),
    /** @type HTMLButtonElement */
    copyAllBtn: document.getElementById('functionConfigModalCopyAllBtn'),
    /** @type HTMLButtonElement */
    pasteAllBtn: document.getElementById('functionConfigModalPasteAllBtn'),
    /** @type HTMLButtonElement */
    downloadSampleDataBtn: document.getElementById('downloadFunctionDataSampleBtn'),
    /** @type HTMLButtonElement */
    appySignifiCheckbox: document.getElementById('signifiCheckbox'),
    /** @type HTMLButtonElement */
    copySampleDataBtn: document.getElementById('copyFunctionDataSampleBtn'),
    /** @type HTMLButtonElement */
    registerBtn: document.getElementById('functionConfigModalRegisterBtn'),
    /** @type HTMLButtonElement */
    reloadBtn: document.getElementById('reloadFunctionBtn'),
    /** @type HTMLAnchorElement */
    confirmSwitchEditingRow: document.getElementById('confirmSwitchEditingRow'),
    /** @type HTMLInputElement */
    searchFunctionNameInput: document.getElementById('functionSearchFunctionNameInput'),
    functionNameTableElement: document.getElementById('functionNameDetails'),
    existFunctionSearchInput: document.getElementById('existFunctionSearchInput'),
    functionUserSettingTableElement: document.getElementById('functionUserSettingTable'),
    /** @type HTMLInputElement */
    deleteFunctionColumnTableBody: document.getElementById('deleteFunctionColumn'),
    deleteFunctionColumnTableElement: document.getElementById('deleteFunctionColumnTable'),
    removeInputSearch: document.getElementsByClassName('function-remove-search'),
    /** @type HTMLBodyElement */
    functionTableBody: document.querySelector('#processColumnsTable_functionTable table.jexcel tbody'),
};

/**
 * Convert string HTML to element instance of HTML
 * @param {string} html - a string HTML of element
 * @return {HTMLElement} an element HTML
 */
function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

/**
 * @typedef {Object} FunctionInfoDict
 * @property {string} functionName - name of function
 * @property {string} output - data type of function column
 * @property {string} systemName - function name by system
 * @property {string} japaneseName - function name by japanese
 * @property {string} localName - function name by local
 * @property {string} varXName - name of X column
 * @property {string} varYName - name of Y column
 * @property {string} coeANS - argument of a, n, s
 * @property {string} coeBK - argument of b, k
 * @property {string} coeCT - argument of c, t
 * @property {string} a - argument of a
 * @property {string} b - argument of b
 * @property {string} c - argument of c
 * @property {string} n - argument of n
 * @property {string} k - argument of k
 * @property {string} s - argument of s
 * @property {string} t - argument of t
 * @property {string} note - note of function
 * @property {string[]} sampleDatas - sample data
 * @property {?boolean} isChecked - true: function is checked, otherwise
 * @property {?boolean} isMainSerialNo - true: function is main::Serial, otherwise
 * @property {?boolean} isMeFunction - true: function is me function, otherwise
 * @property {?string} shownName - shown name of function column
 * @property {?number|string} processColumnId - id of process column
 * @property {?number|string} functionColumnId - id of function column
 * @property {?number|string} functionId - id of function
 * @property {{processColumnId: ?number|string, functionColumnId: ?number|string}} varX - id of X column
 * @property {?{processColumnId: ?number|string, functionColumnId: ?number|string}} varY - id of Y column
 * @property {?number|string} index - row Index in Function Table
 */

/**
 * @class
 * @classdesc A class that contains all information of function columns and helper functions
 * @property {string} functionName - name of function
 * @property {string} output - data type of function column
 * @property {string} systemName - function name by system
 * @property {string} japaneseName - function name by japanese
 * @property {string} localName - function name by local
 * @property {string} varXName - name of X column
 * @property {string} varYName - name of Y column
 * @property {string} coeANS - argument of a, n, s
 * @property {string} coeBK - argument of b, k
 * @property {string} coeCT - argument of c, t
 * @property {string} note - note of function
 * @property {string[]} sampleDatas - sample data
 * @property {?boolean} isChecked - true: function is checked, otherwise
 * @property {?number|string} processColumnId - id of process column
 * @property {?number|string} functionColumnId - id of function column
 * @property {?number|string} functionId - id of function
 * @property {{processColumnId: ?number|string, functionColumnId: ?number|string}} varX - id of X column
 * @property {{processColumnId: ?number|string, functionColumnId: ?number|string}} varY - id of Y column
 * @property {?number|string} index - row Index in Function Table
 */
class FunctionInfo {
    /**
     * New process column id. That will be decrease for each time be called
     * @type {number}
     */
    static #newProcessColumnId = -10000; // set -10000 because to avoid duplication with the id column
    /**
     * New function column id. That will be decrease for each time be called
     * @type {number}
     */
    static #newFunctionColumnId = -1;
    /**
     * Get New process column id.
     * @return {number} New process column id
     */
    static getNewProcessColumnId = () => this.#newProcessColumnId--;
    /**
     * Get New function column id.
     * @return {number} New function column id.
     */
    static getNewFunctionColumnId = () => this.#newFunctionColumnId--;

    /**
     * Constructor
     * @param {FunctionInfoDict | {}} functionInfoDict - function information
     * @constructor
     * @return {FunctionInfo}
     */
    constructor(functionInfoDict = {}) {
        const {
            functionName = '',
            output = '',
            isMainSerialNo = false,
            systemName = '',
            japaneseName = '',
            localName = '',
            varXName = '',
            varYName = '',
            coeANS = '',
            coeBK = '',
            coeCT = '',
            note = '',
            sampleDatas = [],
            isChecked = false,
            processColumnId = null,
            functionColumnId = null,
            functionId = null,
            varX = null,
            varY = null,
            index = null,
            shownName = '',
        } = functionInfoDict;

        this.functionName = functionName;
        this.isMainSerialNo = String(isMainSerialNo) === 'true';
        this.output = output;
        this.systemName = systemName;
        this.japaneseName = japaneseName;
        this.localName = localName;
        this.shownName = isJPLocale ? this.japaneseName : this.localName || this.systemName;
        this.varXName = varXName;
        this.varYName = varYName;
        this.coeANS = coeANS;
        this.coeBK = coeBK;
        this.coeCT = coeCT;
        this.note = note;
        this.sampleDatas = sampleDatas;
        this.isChecked = isChecked;
        this.isMeFunction = functionName.startsWith('me.');
        this.processColumnId = FunctionInfo.parseValueToInt(processColumnId);
        this.functionColumnId = FunctionInfo.parseValueToInt(functionColumnId);
        this.functionId = FunctionInfo.parseValueToInt(functionId);
        this.index = FunctionInfo.parseValueToInt(index);
        this.varX = FunctionInfo.parseObjectValuesToInt(varX);
        this.varY = FunctionInfo.parseObjectValuesToInt(varY);
    }

    /**
     * @param {?number|string} value
     * @return ?number
     */
    static parseValueToInt = (value) => (isNaN(value) || value == null || value === '' ? null : parseInt(value, 10));

    /**
     * Parse all object values to integer
     * @param {object} obj
     * @return {Object.<string, ?number>}
     */
    static parseObjectValuesToInt = (obj) => _.mapValues(obj, FunctionInfo.parseValueToInt);

    /**
     * Format sample data
     * @return {(float|string|undefined)[]} - a list contains formated data
     */
    formatedSampleDatas() {
        return this.sampleDatas.map((val) => {
            let formatedValue;
            try {
                if (!/^-?\d*\.?\d*$/.test(val) || val == null || val === '') {
                    return '';
                }

                const numberStr = val.includes('.') ? parseFloat(val) : parseInt(val);
                formatedValue = applySignificantDigit(numberStr);
            } catch (e) {
                formatedValue = val;
            }
            return formatedValue ?? '';
        });
    }

    /**
     * Check if current function is empty
     * @return {boolean}
     */
    isEmpty() {
        const functionIsEmpty = this.functionId == null || isNaN(this.functionId);
        const outputIsEmpty = this.output === '';
        const nameIsEmpty = this.systemName == '' && this.japaneseName === '' && this.localName === '';
        const varXIsEmpty = this.varX == null || isNaN(this.varX);
        const varYIsEmpty = this.varY == null || isNaN(this.varY);
        const coeIsEmpty = this.coeANS === '' && this.coeBK === '' && this.coeCT == '';
        const noteIsEmpty = this.note === '';
        return (
            functionIsEmpty && outputIsEmpty && nameIsEmpty && varXIsEmpty && varYIsEmpty && coeIsEmpty && noteIsEmpty
        );
    }

    /**
     * Compare this function object is equal to input function object
     * @param {FunctionInfo} functionInfo - an input function object
     * @return {boolean} true is equal, otherwise
     */
    isEqual(functionInfo) {
        // sometimes, varX and varY is missing, we need to manually convert them here
        const convertVar = (functionVar) =>
            FunctionInfo.parseObjectValuesToInt({
                processColumnId: functionVar.processColumnId,
                functionColumnId: functionVar.functionColumnId,
            });
        return (
            this.functionName === functionInfo.functionName &&
            // we don't check output because this is not something user can modify
            // this.output === functionInfo.output &&
            this.systemName === functionInfo.systemName &&
            this.japaneseName === functionInfo.japaneseName &&
            this.localName === functionInfo.localName &&
            this.coeANS === functionInfo.coeANS &&
            this.coeBK === functionInfo.coeBK &&
            this.coeCT === functionInfo.coeCT &&
            this.note === functionInfo.note &&
            this.isMeFunction === functionInfo.isMeFunction &&
            this.processColumnId === functionInfo.processColumnId &&
            this.functionColumnId === functionInfo.functionColumnId &&
            this.functionId === functionInfo.functionId &&
            _.isEqual(convertVar(this.varX), convertVar(functionInfo.varX)) &&
            _.isEqual(convertVar(this.varY), convertVar(functionInfo.varY))
        );
    }

    /**
     * Collect all input data of function
     * @return {FunctionInfo} - a dictionary that contain function information
     */
    static collectInputFunctionInfo() {
        const index = functionConfigElements.functionNameElement.dataset.index ?? '';
        let processColumnId = functionConfigElements.functionNameElement.dataset.processColumnId ?? '';
        const functionColumnId = functionConfigElements.functionNameElement.dataset.functionColumnId ?? '';
        const dataType = functionConfigElements.functionNameElement.dataset.dataType ?? '';
        const selectedFunctionElement = functionConfigElements.functionNameElement.querySelector('option:checked');
        let [functionId, functionName] = ['', ''];
        if (selectedFunctionElement != null) {
            functionId = selectedFunctionElement.value.trim();
            functionName = selectedFunctionElement.textContent.trim();
        }

        const [, output] = FunctionInfo.getOutputDataType();
        const systemName = functionConfigElements.systemNameElement.value.trim();
        const japaneseName = functionConfigElements.japaneseNameElement.value.trim();
        const localName = functionConfigElements.localNameElement.value.trim();

        const selectedVarXElement = functionConfigElements.varXElement.querySelector('option:checked');
        let varX;
        let varXName;
        if (selectedVarXElement == null) {
            varX = null;
            varXName = '';
        } else {
            varX = FunctionInfo.getDropDownOptionValue(selectedVarXElement.value);
            varXName = selectedVarXElement.textContent.trim();
            if (functionName.startsWith('me.')) {
                // In case of function me, process id will be id of varX
                processColumnId = varX.processColumnId;
            }
        }

        const selectedVarYElement = functionConfigElements.varYElement.querySelector('option:checked');
        let varY;
        let varYName;
        if (selectedVarYElement == null) {
            varY = null;
            varYName = '';
        } else {
            varY = FunctionInfo.getDropDownOptionValue(selectedVarYElement.value);
            varYName = selectedVarYElement.textContent.trim();
        }

        const coeANS = functionConfigElements.coeANSElement.value.trim();
        const coeBK = functionConfigElements.coeBKElement.value.trim();
        const coeCT = functionConfigElements.coeCTElement.value.trim();
        const note = functionConfigElements.noteElement.value.trim();
        const isMainSerialNo = functionConfigElements.isMainSerialCheckboxElement.checked;

        const sampleDatas = (functionConfigElements.sampleDataElement.result ?? []).map((element) =>
            String(element ?? '').trim(),
        );

        return new FunctionInfo({
            functionName,
            output,
            isMainSerialNo,
            systemName,
            japaneseName,
            localName,
            varXName,
            varYName,
            coeANS,
            coeBK,
            coeCT,
            note,
            sampleDatas,
            isChecked: false,
            processColumnId,
            functionColumnId,
            functionId,
            varX,
            varY,
            index,
        });
    }

    /**
     * Check output is selected as main::Serial or not
     * @param {string} outputDatatype
     * @return {boolean}
     */
    static isMainSerial(outputDatatype) {
        return Object.values(datatypeI18nText['is_main_serial_no']).includes(outputDatatype);
    }

    /**
     * Collect information of a function row
     * @param {HTMLTableRowElement} rowElement - a function info row
     * @return {FunctionInfo} a function info object
     */
    static collectFunctionInfoByRow(rowElement) {
        const spreadSheetFunctionConfig = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const spreadSheetFunctionData = spreadSheetFunctionConfig.table.getRowDataByIndex(rowElement.dataset.y);
        return SpreadSheetFunctionConfig.convertToFunctionInfo(spreadSheetFunctionData);
    }

    /**
     * Fill inputs of function info
     */
    fillInputFunctionInfo() {
        functionConfigElements.functionNameElement.dataset.index = this.index ?? '';
        functionConfigElements.functionNameElement.dataset.processColumnId = this.processColumnId ?? '';
        functionConfigElements.functionNameElement.dataset.functionColumnId = this.functionColumnId ?? '';
        functionConfigElements.functionNameElement.dataset.dataType = this.dataType ?? '';
        functionConfigElements.functionNameElement.value = String(this.functionId);
        $(functionConfigElements.functionNameElement).change();
        FunctionInfo.setOutputDataType(this.output);
        functionConfigElements.systemNameElement.value = this.systemName;
        functionConfigElements.japaneseNameElement.value = this.japaneseName;
        functionConfigElements.localNameElement.value = this.localName;
        $(functionConfigElements.varXElement).val(FunctionInfo.setDropDownOptionValue(this.varX)).change();
        $(functionConfigElements.varYElement).val(FunctionInfo.setDropDownOptionValue(this.varY)).change();
        functionConfigElements.coeANSElement.value = String(this.coeANS);
        functionConfigElements.coeBKElement.value = String(this.coeBK);
        functionConfigElements.coeCTElement.value = String(this.coeCT);
        functionConfigElements.noteElement.value = String(this.note);
        functionConfigElements.isMainSerialCheckboxElement.checked = String(this.isMainSerialNo) === 'true';
    }

    /**
     * Reset invalid status, use the whole functionConfigs if no element is specified
     * @param {HTMLElement | null } element
     */
    static resetInvalidStatus(element = null) {
        const ele = element ?? functionConfigElements.functionSettingModal;
        ele.querySelectorAll(`.${BORDER_RED_CLASS}`).forEach(FunctionInfo.removeInvalidStatus);
    }

    /**
     * Remove invalid status for single element
     * @param {HTMLElement} element
     */
    static removeInvalidStatus(element) {
        element.classList.remove(BORDER_RED_CLASS);
    }

    /**
     * Set invalid status for single element
     * @param {HTMLElement} element
     */
    static setInvalidStatus(element) {
        element.classList.add(BORDER_RED_CLASS);
    }

    /**
     * Check invalid status for single element
     * @param {HTMLElement} element
     * @return boolean
     */
    static isInvalidStatus(element) {
        return element.classList.contains(BORDER_RED_CLASS);
    }

    static clearFunctionOutput() {
        FunctionInfo.clearOutputDatatype();
        FunctionInfo.clearSampleData();
    }

    static clearOutputDatatype() {
        const defaultOutputDatatype = $(functionConfigElements.functionNameElement)
            .find(':selected')
            .attr('output-data-type');
        FunctionInfo.setOutputDataType(defaultOutputDatatype);
    }

    static clearSampleData() {
        functionConfigElements.sampleDataElement.lastElementChild.querySelectorAll('td:first-child').forEach((td) => {
            td.textContent = '';
            td.setAttribute(DATA_ORIGINAL_ATTR, '');
            td.setAttribute(IS_NUMBER_ATTR, false);
        });
    }

    /**
     * Handle select/unselect a row of table
     * @param {HTMLTableRowElement} rowElement - a select row HTML
     * @param {?HTMLTableRowElement=} previousRowElement - a previous selected row HTML
     */
    static selectRowHandler(rowElement, previousRowElement = null) {
        showResultFunction.disabled = true; // add flag to not call api to calculate sample data

        removeAllSyncEvents();
        if (previousRowElement != null) {
            previousRowElement.classList.remove(ROW_SELECTED_CLASS_NAME);
        }

        rowElement.classList.add(ROW_SELECTED_CLASS_NAME);
        const functionInfo = FunctionInfo.collectFunctionInfoByRow(rowElement);
        functionInfo.fillInputFunctionInfo();
        FunctionInfo.resetInvalidStatus();

        // reset flag to allow call api to calculate sample data
        setTimeout(() => {
            showResultFunction.disabled = false;
        }, 50);
    }

    static getSelectedRow() {
        return functionConfigElements.functionTableElement().lastElementChild.querySelector('tr.row-selected');
    }

    /**
     * Fill sample data to function row
     * @param {string[]} sampleData - a list of data
     * @param {boolean} isNumber - a boolean of data type is number
     * @param {HTMLTableRowElement} rowElement - row of table
     */
    static fillSampleDataToFunctionRow(sampleData, isNumber, rowElement) {
        const tableSampleDataNodes = rowElement.querySelectorAll('td.column-sample-data ');
        tableSampleDataNodes.forEach((node, index) => {
            node.innerHTML = formatSignifiValue(sampleData[index], isNumber) ?? '';
            node.setAttribute(DATA_ORIGINAL_ATTR, sampleData[index]);
            node.setAttribute(IS_NUMBER_ATTR, isNumber);
        });
    }

    /**
     * Handle select/unselect a row of table
     * @param {Event} event
     */
    static rowClickEvent(event) {
        // Expand input function info area
        $(functionConfigElements.collapseFunctionConfig).collapse('show');

        /** @type HTMLTableRowElement */
        const rowElement = event.currentTarget;
        /** @type HTMLTableRowElement */
        const selectedRowElement = rowElement.parentElement.querySelector('tr.row-selected');
        if (selectedRowElement === rowElement) {
            // in case re-select row, do nothing
        } else if (selectedRowElement != null) {
            // in case exist selected row
            const inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();
            const selectedFunctionInfo = FunctionInfo.collectFunctionInfoByRow(selectedRowElement);
            if (inputFunctionInfo.isEqual(selectedFunctionInfo)) {
                // in case of nothing change
                FunctionInfo.selectRowHandler(rowElement, selectedRowElement);
                return;
            }

            // show confirmation dialog to change editing other row
            functionConfigElements.confirmSwitchEditingRow.dataset.index = rowElement.dataset.y;
            functionConfigElements.confirmSwitchEditingRow.dataset.previousIndex = selectedRowElement.dataset.y;
            $(functionConfigElements.functionConfigConfirmSwitchEditingRowModal).modal('show');
        } else {
            // in case non-exist select row
            FunctionInfo.selectRowHandler(rowElement);
        }
    }

    /**
     * Handle hover cell to show title
     * @param {Event} event
     */
    static hoverTableCellEvent(event) {
        /** @type HTMLTableCellElement */
        const cellElement = event.currentTarget;
        const labelElement = cellElement.querySelector('label');
        if (labelElement) {
            cellElement.setAttribute('title', labelElement.textContent.trim());
            return;
        }

        const inputElement = cellElement.querySelector('input');
        if (inputElement) {
            cellElement.setAttribute('title', inputElement.value.trim());
            return;
        }

        cellElement.setAttribute('title', cellElement.innerText.trim());
    }

    /**
     * Handle changing selection status of checkbox
     * @param {Event} event
     */
    static changeSelectionStatusEvent(event) {
        /** @type HTMLInputElement */
        const checkBoxElement = event.currentTarget;
        const targetRow = checkBoxElement.closest('tr');
        targetRow.setAttribute('checked', checkBoxElement.checked ? 'checked' : '');

        // Set number of checked records
        let totalCheckedColumns = parseInt(functionConfigElements.totalCheckedFunctionColumnsElement.textContent, 10);
        totalCheckedColumns = checkBoxElement.checked ? totalCheckedColumns + 1 : totalCheckedColumns - 1;
        functionConfigElements.totalCheckedFunctionColumnsElement.textContent = String(totalCheckedColumns);

        const totalColumns = parseInt(functionConfigElements.totalFunctionColumnsElement.textContent, 10);

        // Set status of all selected checkbox
        functionConfigElements.selectAllFunctionColumns.checked = totalColumns === totalCheckedColumns;
        FunctionInfo.updateStatusErrorCheckbox();
    }

    /**
     * Get all invalid rows
     * @return {HTMLTableRowElement[]} - a list of rows
     */
    static getInvalidRows() {
        return [
            ...new Set(
                [
                    ...functionConfigElements
                        .functionTableElement()
                        .lastElementChild.querySelectorAll('.row-invalid, .column-name-invalid'),
                ].map((invalidTarget) =>
                    invalidTarget instanceof HTMLTableRowElement ? invalidTarget : invalidTarget.closest('tr'),
                ),
            ),
        ];
    }

    /**
     * Update status check/uncheck of Error checkbox
     *
     * If it is checked, all invalid rows are checked. Otherwise.
     */
    static updateStatusErrorCheckbox() {
        const invalidRows = FunctionInfo.getInvalidRows();
        const invalidCheckedRows = invalidRows.filter((r) => r.querySelector('input[name="columnName"]').checked);
        const allCheckedRows = functionConfigElements
            .functionTableElement()
            .lastElementChild.querySelectorAll('input[name="columnName"]:checked');
        functionConfigElements.selectErrorFunctionColumns.checked =
            invalidRows.length === invalidCheckedRows.length &&
            invalidRows.length !== 0 &&
            allCheckedRows.length === invalidCheckedRows.length;
    }

    /**
     * Add a new row into Function table
     */
    addNewFunctionRow() {
        // Set number of total records
        const totalColumns = parseInt(functionConfigElements.totalFunctionColumnsElement.textContent, 10);
        functionConfigElements.totalFunctionColumnsElement.textContent = String(totalColumns + 1);

        //Update prc PreviewDataOfFunctionColumn
        setPreviewDataForFunctionColumns(this.functionColumnId, this.sampleDatas);

        // Add row into JSpreadSheet table
        const spreadsheetConfig = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const spreadsheetData = SpreadSheetFunctionConfig.convertToSpreadSheetData(this);
        spreadsheetConfig.table.addNewRow(spreadsheetData);
    }

    /**
     * Update a function row into Function table
     * @param {boolean} isMainSerial
     */
    updateFunctionRow(isMainSerial = false) {
        // update prc PreviewDataOfFunctionColumn
        setPreviewDataForFunctionColumns(this.functionColumnId, this.sampleDatas);

        // Update row into JSpreadSheet table
        const spreadsheetConfig = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const spreadsheetData = SpreadSheetFunctionConfig.convertToSpreadSheetData(this);
        const updateRow = isMainSerial ? spreadsheetConfig.mainSerialRow() : spreadsheetConfig.selectedRow();
        const selectedRowIndex = updateRow[SpreadSheetFunctionConfig.ColumnNames.IsChecked].rowIndex;
        spreadsheetConfig.table.updateRow(selectedRowIndex, spreadsheetData);
    }

    /**
     * Remove a function row on table
     * @param {HTMLTableRowElement} rowElement
     * @param {number} functionColumnId
     */
    static deleteFunctionRow(rowElement, functionColumnId) {
        if (rowElement.classList.contains(ROW_SELECTED_CLASS_NAME)) {
            FunctionInfo.resetStatusOfEditingFunction(rowElement);
        }

        // Remove all events
        const speedSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const deleteRowData = speedSheet.getRowDataByFunctionColumnId(functionColumnId);
        speedSheet.table.removeRowById(deleteRowData.index.rowIndex);

        // Update number of checked records and total records
        const totalColumns = parseInt(functionConfigElements.totalFunctionColumnsElement.textContent, 10) - 1;
        functionConfigElements.totalFunctionColumnsElement.textContent = String(totalColumns < 0 ? 0 : totalColumns);
        if (deleteRowData[SpreadSheetFunctionConfig.ColumnNames.IsChecked].data) {
            const selectedColumns =
                parseInt(functionConfigElements.totalCheckedFunctionColumnsElement.textContent, 10) - 1;
            functionConfigElements.totalCheckedFunctionColumnsElement.textContent = String(
                selectedColumns < 0 ? 0 : selectedColumns,
            );
        }

        // Update status of checkbox
        if (
            (functionConfigElements.selectAllFunctionColumns.checked &&
                functionConfigElements.totalCheckedFunctionColumnsElement.textContent !==
                    functionConfigElements.totalFunctionColumnsElement.textContent) ||
            functionConfigElements.totalFunctionColumnsElement.textContent.trim() === '0'
        ) {
            functionConfigElements.selectAllFunctionColumns.checked = false;
        }

        const dropDownOptionValue = FunctionInfo.setDropDownOptionValue({
            processColumnId: deleteRowData[SpreadSheetFunctionConfig.ColumnNames.ProcessColumnId].data,
            functionColumnId: functionColumnId,
        });

        // Remove in X & Y select boxes
        [functionConfigElements.varXElement, functionConfigElements.varYElement].forEach((selectElement) => {
            const isTargetOption = selectElement.value === dropDownOptionValue;
            $(selectElement).find(`option[value="${dropDownOptionValue}"]`).remove();
            if (isTargetOption) {
                $(selectElement).val('').change();
            }
        });
    }

    /**
     * Get params info of function
     * @param {number} functionId - function Id
     * @return {{hasANS: boolean, hasBK: boolean, hasCT: boolean, funcDef: FunctionDefinition}}
     */
    static hasParams(functionId) {
        const funcDef = allMasterFunction.find((func) => func.id === functionId);
        const hasANS = ARRAY_ANS.some((c) => funcDef.coefs.includes(c));
        const hasBK = ARRAY_BK.some((c) => funcDef.coefs.includes(c));
        const hasCT = ARRAY_CT.some((c) => funcDef.coefs.includes(c));
        return { hasANS, hasBK, hasCT, funcDef };
    }

    /**
     * Collect all function info in table
     * @param {boolean} isCollectOnlyCheckedRows - true: collect only checked rows, otherwise
     * @return {FunctionInfo[]} - a list of FunctionInfo objects
     */
    static collectAllFunctionRows(isCollectOnlyCheckedRows = false) {
        const speadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        let functionRows = speadsheet.table.collectDataTable();
        if (isCollectOnlyCheckedRows) {
            functionRows = functionRows.map((row) => row.is_checked);
        }
        const functionInfos = functionRows.map((functionRow) =>
            SpreadSheetFunctionConfig.convertToFunctionInfo(functionRow),
        );
        return functionInfos;
    }

    /**
     * Collect main serial function info in table
     * @return {FunctionInfo}
     */
    static getMainSerialFunctionColumnRow() {
        const allFunctionCols = FunctionInfo.collectAllFunctionRows();
        return allFunctionCols.find((col) => col.isMainSerialNo);
    }

    /**
     * Call api to backend to get all function infos of target process
     * @param {number|string} processId - a process id
     * @param {number[]} colIds - a list of column ids
     * @return {Promise<FunctionInfoDict[]>} - A response object
     */
    static getAllFunctionInfosApi(processId, colIds) {
        const dictSampleData = {};
        for (const colId of colIds) {
            dictSampleData[colId] = getSampleDataByFunctionColumnIdOrColumnId({
                processColumnId: colId,
            });
        }
        return fetch('/ap/api/setting/function_config/get_function_infos', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                process_id: parseInt(processId, 10),
                dic_sample_data: dictSampleData,
            }),
        })
            .then((response) => response.clone().json())
            .then((response) => {
                // Reset dict that contains sample data of function columns
                prcPreviewDataOfFunctionColumn = {};
                return response;
            })
            .then((/** @type {{functionData: FunctionInfoDict[]}} */ responseData) =>
                responseData.functionData?.map((funcData) => {
                    // add functionInfo data to prc-PreviewDataOfFunctionColumn with a key is functionColumnId
                    const { functionColumnId, sampleDatas } = funcData;
                    setPreviewDataForFunctionColumns(functionColumnId, sampleDatas);
                    return {
                        ...funcData,
                        coeANS: funcData.a || funcData.n || funcData.s,
                        coeBK: funcData.b || funcData.k,
                        coeCT: funcData.c || funcData.t,
                    };
                }),
            );
    }

    /**
     * Load function list on table & load function list
     * @param {Array.<FunctionInfoDict>} functionData - list of functionData objects from functionInfosAPI
     */
    static loadFunctionListTableAndInitDropDown(functionData) {
        dbFunctionCols = functionData;
        // show modal confirm if exist main::Serial in process config
        const isExitsMainSerial = isSelectedMainSerialInProcessConfig();
        if (isExitsMainSerial) {
            const mainSerialFuncCol = functionData?.find((col) => col.isMainSerialNo);
            if (mainSerialFuncCol) {
                $(functionConfigElements.confirmReloadFunctionColumnModal).modal('show');
                return;
            }
        }
        FunctionInfo.removeAllFunctionRows();
        FunctionInfo.initDropdownFunctionName();
        if (typeof inputMutationObserver !== 'undefined') {
            // inject events for process table's input
            inputMutationObserver.injectEvents();
        }

        // Convert to Spreadsheet data before init table
        spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER).table.destroyTable();
        const spreadsheetData = functionData.map((data) => SpreadSheetFunctionConfig.convertToSpreadSheetData(data));
        const spreadsheet = SpreadSheetFunctionConfig.create(FUNCTION_TABLE_CONTAINER, spreadsheetData);
        mainSerialFunctionColumnInfo = spreadsheetData.find((data) => data.isMainSerialNo);
        spreadsheet.table.takeSnapshotForTracingChanges(SpreadSheetFunctionConfig.trackingHeaders());
    }

    /**
     * Destroy Function table
     */
    static destroyTable() {
        const spreadSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadSheet.table.destroyTable();
    }

    /**
     * Remove all rows of Function table
     */
    static removeAllFunctionRows() {
        const excelTable = functionConfigElements.functionTableElement();
        if (excelTable == null) return;
        [...excelTable.lastElementChild.children].forEach(
            /**
             * Remove event listener and row
             * @param {HTMLTableRowElement} row - a function row HTML
             */ (row) => {
                const functionColumnIdElement = row.querySelector('td.column-function-column-id');
                const functionColumnId = parseInt(functionColumnIdElement.textContent);
                FunctionInfo.deleteFunctionRow(row, functionColumnId);
            },
        );
    }

    /**
     * Show icon function changes
     */
    static showChangeMark() {
        if (functionConfigElements.settingChangeMark().classList.contains('d-none')) {
            functionConfigElements.settingChangeMark().classList.remove('d-none');
        }
    }

    /**
     * Hide icon function changes
     */
    static hideChangeMark() {
        if (!functionConfigElements.settingChangeMark().classList.contains('d-none')) {
            functionConfigElements.settingChangeMark().classList.add('d-none');
        }
    }

    /**
     * Reset all status, input, selection of Input Function Area
     * @param {boolean} isResetFuncName - is Reset Function Name or not
     * @param {boolean} isResetRowCount - is Reset Row Count or not
     */
    static resetInputFunctionInfo(isResetFuncName = true, isResetRowCount = true) {
        if (isResetRowCount) {
            functionConfigElements.selectAllFunctionColumns.checked = false;
            functionConfigElements.selectErrorFunctionColumns.checked = false;
            functionConfigElements.totalCheckedFunctionColumnsElement.textContent = String(0);
            functionConfigElements.totalFunctionColumnsElement.textContent = String(0);
        }
        $(functionConfigElements.functionNameElement).val('').change();

        // reset previous all invalid status
        FunctionInfo.resetInvalidStatus();

        if (isResetFuncName) {
            [...functionConfigElements.functionNameElement.children].forEach((option) => option.remove());
            $(functionConfigElements.functionNameElement).empty();
        }
        functionConfigElements.functionNameElement.dataset.index = '';
        functionConfigElements.functionNameElement.dataset.processColumnId = '';
        functionConfigElements.functionNameElement.dataset.functionColumnId = '';
        functionConfigElements.functionNameElement.dataset.dataType = '';
        FunctionInfo.setOutputDataType('');
        functionConfigElements.systemNameElement.value = '';
        functionConfigElements.systemNameElement.dataset.originGeneratedName = '';
        functionConfigElements.japaneseNameElement.value = '';
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName = '';
        functionConfigElements.localNameElement.value = '';
        functionConfigElements.localNameElement.dataset.originGeneratedName = '';

        functionConfigElements.searchInput.value = '';
        functionConfigElements.searchFunctionNameInput.value = '';

        $(functionConfigElements.varXElement).val('').change();
        $(functionConfigElements.varYElement).val('').change();
        [...functionConfigElements.varXElement.children].forEach((option) => option.remove());
        [...functionConfigElements.varYElement.children].forEach((option) => option.remove());
        functionConfigElements.coeANSElement.value = '';
        functionConfigElements.coeANSElement.required = false;
        functionConfigElements.coeBKElement.value = '';
        functionConfigElements.coeBKElement.required = false;
        functionConfigElements.coeCTElement.value = '';
        functionConfigElements.coeCTElement.required = false;
        functionConfigElements.noteElement.value = '';
        functionConfigElements.sampleDataElement.lastElementChild.querySelectorAll('td').forEach((td) => {
            td.textContent = '';
            td.setAttribute(DATA_ORIGINAL_ATTR, '');
        });

        $(functionConfigElements.varXElement).empty();
        $(functionConfigElements.varYElement).empty();
    }

    /**
     * Reset all inputs and select row
     * @param {?HTMLTableRowElement=} selectedRow - a selected row HTML
     */
    static resetStatusOfEditingFunction(selectedRow = null) {
        removeAllSyncEvents();
        FunctionInfo.resetInputFunctionInfo(false, false);
        if (selectedRow == null) {
            selectedRow = this.getSelectedRow();
        }

        if (selectedRow != null) {
            selectedRow.classList.remove(ROW_SELECTED_CLASS_NAME);
        }
    }

    /**
     * Create a unique dropdown value for X and Y based on functionColumnId and processColumnId
     * @param {number | string} functionColumnId
     * @param {number | string} processColumnId
     * @returns {string}
     */
    static setDropDownOptionValue = (
        { processColumnId, functionColumnId } = {
            processColumnId: null,
            functionColumnId: null,
        },
    ) => {
        if (functionColumnId == null && processColumnId == null) {
            return '';
        }

        const processColumnIdString = processColumnId != null ? processColumnId.toString() : '';
        const functionColumnIdString = functionColumnId != null ? functionColumnId.toString() : '';
        return `${processColumnIdString}_${functionColumnIdString}`;
    };

    /** Extract functionColumnId and processColumnId from dropdown option value
     * @param {string} value
     * @returns {{processColumnId: ?number, functionColumnId: ?number}}
     */
    static getDropDownOptionValue = (value) => {
        let processColumnId = null;
        let functionColumnId = null;

        const values = value.trim().split('_');
        if (values.length === 2) {
            processColumnId = values[0];
            functionColumnId = values[1];
        }
        return FunctionInfo.parseObjectValuesToInt({
            processColumnId,
            functionColumnId,
        });
    };

    static getVarXId = () => FunctionInfo.getDropDownOptionValue(functionConfigElements.varXElement.value);
    static getVarYId = () => FunctionInfo.getDropDownOptionValue(functionConfigElements.varYElement.value);

    /**
     * Initialize select2 for selection of VarX/VarY
     * @param {HTMLOptionElement} selectedFunction - a selected option of Function
     */
    static initDropdownVarXY(selectedFunction) {
        const showSerial = selectedFunction.getAttribute('show-serial') === 'true';

        const getTypes = (attributeName) => {
            let types = selectedFunction.getAttribute(attributeName).trim();
            types = types.split(SEPARATOR_CHAR);
            return types;
        };
        const xTypes = getTypes('x-types');
        const yTypes = getTypes('y-types');

        const $varXElement = $(functionConfigElements.varXElement);
        const $varYElement = $(functionConfigElements.varYElement);

        const selectedValue = {
            varXElement: $varXElement.find('option:checked').val(),
            varYElement: $varYElement.find('option:checked').val(),
        };
        const updateOptions = (
            processColumnId,
            functionColumnId,
            columnRawDataType,
            $varElement,
            supportTypes,
            newOption,
            keySelectedValue,
        ) => {
            const dropDownOptionValue = FunctionInfo.setDropDownOptionValue({
                processColumnId,
                functionColumnId,
            });
            const $existOption = $varElement.find(`option[value=${dropDownOptionValue}]`);
            if (supportTypes.includes(columnRawDataType) && $existOption.length === 0) {
                $varElement.append($('<option/>', newOption));
            } else if (!supportTypes.includes(columnRawDataType) && $existOption.length > 0) {
                $existOption.remove();
                if (processColumnId === selectedValue[keySelectedValue]) {
                    selectedValue[keySelectedValue] = '';
                }
            }
        };

        const removeOptions = (processColumnId, functionColumnId, $varElement) => {
            const dropDownOptionValue = FunctionInfo.setDropDownOptionValue({
                processColumnId,
                functionColumnId,
            });
            $varElement.find(`option[value="${dropDownOptionValue}"]`).remove();
        };

        const { shouldSelectDropDowns, shouldIgnoreDropDowns } = FunctionInfo.getDropDownOptionsForXY(showSerial);

        shouldSelectDropDowns.forEach((col) => {
            const options = {
                'value': FunctionInfo.setDropDownOptionValue({
                    processColumnId: col.id,
                    functionColumnId: col.function_column_id,
                }),
                'text': col.shown_name || col.column_raw_name,
                'raw-data-type': col.data_type,
                'column-type': col.column_type,
                'name-sys': col.name_en,
                'name-jp': col.name_jp || '',
                'name-local': col.name_local || '',
                'title': col.name_en || '',
            };

            updateOptions(col.id, col.function_column_id, col.data_type, $varXElement, xTypes, options, 'varXElement');
            updateOptions(col.id, col.function_column_id, col.data_type, $varYElement, yTypes, options, 'varYElement');
        });

        shouldIgnoreDropDowns.forEach((c) => {
            removeOptions(c.id, c.function_column_id, $varXElement);
            removeOptions(c.id, c.function_column_id, $varYElement);
        });

        $varXElement.val(selectedValue['varXElement']).change();
        $varYElement.val(selectedValue['varYElement']).change();
    }

    /**
     * Get all dropdown for var x and var y
     * We must:
     * - Do not select serial columns if this function ignore serial columns
     * - If me function exist, only show the latest me function columns
     * However, if we are selecting a row:
     * - If this row is not me function column, we simply ignore it
     * - If this row is me function column, we must select the PREVIOUS one, and ignore others
     *   Need to note that, if there is only one me function column in the chain
     *   E.g. Serial -> me.substr(Serial). We will show Serial (which is a normal column)
     * @param {boolean} showSerial
     */
    static getDropDownOptionsForXY = (showSerial) => {
        const functionInfoToNormalColumnDesc = (col) => ({
            id: col.processColumnId,
            function_column_id: col.functionColumnId,
            column_raw_name: col.systemName,
            raw_data_type: col.output,
            data_type: col.output,
            column_type: masterDataGroup.GENERATED_EQUATION,
            name_en: col.systemName,
            name_jp: col.japaneseName,
            name_local: col.localName,
            shown_name: col.shownName,
            is_me: col.isMeFunction,
        });

        // need to parse column id and function column id to integer before comparing
        const parseIntColumnDesc = (col) => {
            const parsedIntColumns = FunctionInfo.parseObjectValuesToInt({
                id: col.id,
                function_column_id: col.function_column_id,
            });
            return { ...col, ...parsedIntColumns };
        };

        if (currentProcDataCols.length === 0) {
            currentProcDataCols = currentLatestProcDataCols;
        }
        const allNormalColumns = [...currentProcDataCols];
        const allFunctionColumns = FunctionInfo.collectAllFunctionRows().map(functionInfoToNormalColumnDesc);
        const allColumns = [...allNormalColumns, ...allFunctionColumns].map(parseIntColumnDesc);

        // we traverse and select columns from allColumns
        // we prefer select columns appear later (since this might be me column)
        // ONLY 1 process column id should be selected
        let selectedColumns = [];
        const addOrModifySelectedColumn = (column) => {
            if (column == null || column.id == null) {
                return;
            }
            // overwrite column id if existed, otherwise add new
            const index = selectedColumns.findIndex((col) => col.id === column.id);
            if (index > -1) {
                selectedColumns[index] = column;
            } else {
                selectedColumns.push(column);
            }
        };

        allColumns.forEach(addOrModifySelectedColumn);

        // ignore serial columns if needed
        selectedColumns = selectedColumns.filter((column) => {
            const shouldIgnoreSerial = !showSerial && (column.is_serial_no || column.is_main_serial_no);
            return !shouldIgnoreSerial;
        });

        // ignore currently clicked row
        const currentlyClickedFunctionRow = this.getSelectedRow();
        if (currentlyClickedFunctionRow) {
            const currentlyClickedFunctionInfo = FunctionInfo.collectFunctionInfoByRow(currentlyClickedFunctionRow);
            if (!currentlyClickedFunctionInfo.isMeFunction) {
                // greedily ignore non me function column
                selectedColumns = selectedColumns.filter(
                    (col) => col.id !== currentlyClickedFunctionInfo.processColumnId,
                );
            }
            // reselect varX and varY for clicked column
            // find these column inside `allColumns`
            const findVarInAllColumns = (rawColumn) => {
                const normalizedCol = parseIntColumnDesc(functionInfoToNormalColumnDesc(rawColumn));
                return allColumns.find(
                    (col) => col.id === normalizedCol.id && col.function_column_id === normalizedCol.function_column_id,
                );
            };
            const varX = findVarInAllColumns(currentlyClickedFunctionInfo.varX);
            const varY = findVarInAllColumns(currentlyClickedFunctionInfo.varY);
            addOrModifySelectedColumn(varX);
            addOrModifySelectedColumn(varY);
        }

        const isSelect = (column) =>
            selectedColumns.some((col) => col.id === column.id && col.function_column_id === column.function_column_id);

        const shouldSelectDropDowns = allColumns.filter(isSelect);
        const shouldIgnoreDropDowns = allColumns.filter((column) => !isSelect(column));

        return { shouldSelectDropDowns, shouldIgnoreDropDowns };
    };

    /**
     * Initialize select2 for selection of Function Name
     */
    static initDropdownFunctionName() {
        const $functionNameElement = $(functionConfigElements.functionNameElement);

        const getMatchingParam = (coefs) => (funcCoefs) => coefs.find((e) => funcCoefs.includes(e));
        const getMatchingParamsANS = getMatchingParam(ARRAY_ANS);
        const getMatchingParamsBK = getMatchingParam(ARRAY_BK);
        const getMatchingParamsCT = getMatchingParam(ARRAY_CT);

        $functionNameElement.empty();
        allMasterFunction.forEach((func) => {
            const coeANSLabel = getMatchingParamsANS(func.coefs) || '';
            const coeBKLabel = getMatchingParamsBK(func.coefs) || '';
            const coeCTLabel = getMatchingParamsCT(func.coefs) || '';
            const requiredANS = getMatchingParamsANS(func.required_coefs) !== undefined;
            const requiredBK = getMatchingParamsBK(func.required_coefs) !== undefined;
            const requiredCT = getMatchingParamsCT(func.required_coefs) !== undefined;

            // TODO: remove this value after implementing front-end
            const defaultValueCoeANS = func.a || func.n || func.s;
            const defaultValueCoeBK = func.b || func.k;
            const defaultValueCoeCT = func.c || func.t;

            $functionNameElement.append(
                $('<option/>', {
                    'value': func.id,
                    'text': func.function_type,
                    'var-x': func.vars.includes('X'),
                    'var-y': func.vars.includes('Y'),
                    'coe-a-n-s': coeANSLabel,
                    'coe-b-k': coeBKLabel,
                    'coe-c-t': coeCTLabel,
                    'required-coe-a-n-s': requiredANS,
                    'required-coe-b-k': requiredBK,
                    'required-coe-c-t': requiredCT,
                    'x-types': func.x_types.join(SEPARATOR_CHAR),
                    'y-types': func.y_types.join(SEPARATOR_CHAR),
                    'show-serial': func.show_serial,
                    'default-value-coe-a-n-s': defaultValueCoeANS,
                    'default-value-coe-b-k': defaultValueCoeBK,
                    'default-value-coe-c-t': defaultValueCoeCT,
                    'function_name_en': func.function_name_en || '',
                    'function_name_jp': func.function_name_jp || '',
                    'description_en': func.description_en || '',
                    'description_jp': func.description_jp || '',
                    'output-data-type': '', // will be defined after calculating sample data
                }),
            );
        });

        $functionNameElement.val('').change();
    }

    /**
     * Get label of raw data type
     * @param rawDataType
     * @param isMainSerialNo
     * @return {string} - Label of raw data type
     */
    static getLabelRawDataType(rawDataType, isMainSerialNo = false) {
        let label = '';
        switch (rawDataType) {
            case DataTypes.BIG_INT.name:
                label = document.getElementById(DataTypes.BIG_INT.i18nLabelID).textContent.trim();
                break;
            case DataTypes.INTEGER.name:
                label = isMainSerialNo
                    ? datatypeI18nText['is_main_serial_no'].INTEGER
                    : DataTypes.INTEGER.selectionBoxDisplay;
                break;
            case DataTypes.TEXT.name:
                label = isMainSerialNo
                    ? datatypeI18nText['is_main_serial_no'].TEXT
                    : DataTypes.STRING.selectionBoxDisplay;
                break;
            case DataTypes.REAL.name:
                label = DataTypes.REAL.selectionBoxDisplay;
                break;
            case DataTypes.DATETIME.name:
                label = DataTypes.DATETIME.selectionBoxDisplay;
                break;
            case DataTypes.CATEGORY.name:
                // Show "main::Serial:Int" for Int(Cat) as main::Serial
                // link: https://trello.com/c/Y1TSFnPk/189-03b-change-content-of-tooltip-message-when-hover-on-mainserial-checkbox
                label = isMainSerialNo
                    ? datatypeI18nText['is_main_serial_no'].INTEGER
                    : DataTypes.INTEGER_CAT.selectionBoxDisplay;
                break;
            case DataTypes.BOOLEAN.name:
                label = DataTypes.BOOLEAN.selectionBoxDisplay;
                break;
        }

        return label;
    }

    /**
     * Set label for output data type of selected function
     * @param {string} rawDataType - a raw data type string
     * @param {boolean} isMainSerialNo - is main serial
     */
    static setOutputDataType(rawDataType, isMainSerialNo = false) {
        functionConfigElements.outputElement.innerHTML = FunctionInfo.getLabelRawDataType(rawDataType, isMainSerialNo);
        functionConfigElements.outputElement.dataset.rawDataType = rawDataType;
        // enable/disable checkbox main serial
        if ([DataTypes.INTEGER.name, DataTypes.CATEGORY.name, DataTypes.STRING.name].includes(rawDataType)) {
            functionConfigElements.isMainSerialCheckboxElement.disabled = false;
        } else {
            functionConfigElements.isMainSerialCheckboxElement.checked = false;
            functionConfigElements.isMainSerialCheckboxElement.disabled = true;
        }
        functionConfigElements.outputElement.dispatchEvent(new Event('change'));
    }

    /**
     * Get data type info
     * @return {string[]} - a tuple of below values:
     * - item [0]: Raw data type
     * - item [1]: Label of data type
     */
    static getOutputDataType() {
        return [
            functionConfigElements.outputElement.innerHTML.trim(),
            (functionConfigElements.outputElement.dataset.rawDataType ?? '').trim(),
        ];
    }

    /**
     * Validate input function info
     * @return {boolean} - true is valid, false is invalid
     */
    static validateInputFunctionInfo(inputFunctionInfo) {
        let isMeFunction;
        let isValidateAll = inputFunctionInfo !== undefined;
        let isValidColumnName = true;
        if (isValidateAll) {
            isMeFunction = inputFunctionInfo.isMeFunction;
            isValidColumnName =
                inputFunctionInfo.output !== '' &&
                (isMeFunction || (!isMeFunction && validateFunctionColumnName(inputFunctionInfo)));
        } else {
            inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();
        }
        const selectedFunction = functionConfigElements.functionNameElement.querySelector('option:checked');
        const isHasVarX = !functionConfigElements.varXElement.disabled;
        const isHasVarY = !functionConfigElements.varYElement.disabled;
        const isInvalidCoeANS = FunctionInfo.isInvalidStatus(functionConfigElements.coeANSElement);
        const isInvalidCoeBK = FunctionInfo.isInvalidStatus(functionConfigElements.coeBKElement);
        const isInvalidCoeCT = FunctionInfo.isInvalidStatus(functionConfigElements.coeCTElement);
        const isInvalidParams =
            selectedFunction == null ||
            (isHasVarX && _.isEmpty(inputFunctionInfo.varX)) ||
            (isHasVarY && _.isEmpty(inputFunctionInfo.varY)) ||
            (functionConfigElements.coeANSElement.required && inputFunctionInfo.coeANS === '') ||
            isInvalidCoeANS ||
            (functionConfigElements.coeBKElement.required && inputFunctionInfo.coeBK === '') ||
            isInvalidCoeBK ||
            (functionConfigElements.coeCTElement.required && inputFunctionInfo.coeCT === '') ||
            isInvalidCoeCT;

        if (isValidateAll) {
            return isValidColumnName && !isInvalidParams;
        } else {
            return !isInvalidParams;
        }
    }

    /**
     * Correctly show border for error fields
     *  @param {Array.<{msg: String, field: String}>} errorsResponse
     */
    static showErrorField(errorsResponse) {
        for (const error of errorsResponse) {
            if (ARRAY_ANS.includes(error.field)) {
                FunctionInfo.setInvalidStatus(functionConfigElements.coeANSElement);
            } else if (ARRAY_BK.includes(error.field)) {
                FunctionInfo.setInvalidStatus(functionConfigElements.coeBKElement);
            } else if (ARRAY_CT.includes(error.field)) {
                FunctionInfo.setInvalidStatus(functionConfigElements.coeCTElement);
            }
            showToastrMsg(error.msg, MESSAGE_LEVEL.ERROR);
        }
    }

    /**
     * Update index and order of all function columns in table
     */
    static updateIndexRowsInTable() {
        [...functionConfigElements.functionTableElement().lastElementChild.children].forEach((tr, i) => {
            const index = i + 1;
            tr.dataset.index = index;
            tr.firstElementChild.textContent = String(index);
        });
    }
}

/**
 * Handle filter rows
 * @param {KeyboardEvent} event
 */
function searchInputHandler(event) {
    const spreadSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const searchValue = stringNormalization(event.currentTarget.value.trim().toLowerCase());
    spreadSheet.handleSearchInput(searchValue, event.key);
}

/**
 * Handle select rows that shown in filter
 */
function setFilterButtonHandler() {
    const spreadSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadSheet.handleSearchSetButton();
}

/**
 * Handle unselect rows that shown in filter
 */
function resetButtonHandler() {
    const spreadSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadSheet.handleSearchResetButton();
}

/**
 * Add new row into Function table
 * @param {PointerEvent} event
 */
function addOrUpdateFunctionInfo(event) {
    const inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();

    let isValid = FunctionInfo.validateInputFunctionInfo(inputFunctionInfo);
    if (!isValid) {
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: 'Please check error fields before creating new function.',
            is_error: true,
        });

        procModalElements.procModal.scrollTop(0);
        return;
    } else {
        hideAlertMessages();
    }

    const selectedFunction = FunctionInfo.getSelectedRow();
    if (selectedFunction == null) {
        inputFunctionInfo.index = functionConfigElements.functionTableElement().lastElementChild.childElementCount + 1;

        inputFunctionInfo.isChecked = functionConfigElements.selectAllFunctionColumns.checked;

        inputFunctionInfo.functionColumnId =
            inputFunctionInfo.functionColumnId ?? FunctionInfo.getNewFunctionColumnId();

        inputFunctionInfo.processColumnId = inputFunctionInfo.processColumnId ?? FunctionInfo.getNewProcessColumnId();

        inputFunctionInfo.addNewFunctionRow();
    } else {
        inputFunctionInfo.updateFunctionRow();
        selectedFunction.classList.remove(ROW_SELECTED_CLASS_NAME);
    }
    // change data type of column if me.type_convert()
    if (inputFunctionInfo.isMeFunction && inputFunctionInfo.functionId === 172) {
        for (let col of currentProcDataCols) {
            if (col.id === Number(inputFunctionInfo.varX)) {
                col.data_type = inputFunctionInfo.output;
            }
        }
    }
    FunctionInfo.resetInputFunctionInfo(false, false);
}

/**
 * Show registered functions to prepare to copy
 * @param {PointerEvent} event
 */
function showRegisteredFunctionsModal(event) {
    // Expand input function info area
    $(functionConfigElements.collapseFunctionConfig).collapse('show');

    FunctionInfo.resetStatusOfEditingFunction();
    [...functionConfigElements.functionUserSettingTableBody.children].forEach((row) => row.remove());
    const functionInfos = FunctionInfo.collectAllFunctionRows();
    let existFunctionParams = [];
    let htmlRows = '';
    functionInfos.forEach((functionInfo) => {
        const currentParams = [
            functionInfo.functionId,
            functionInfo.coeANS,
            functionInfo.coeBK,
            functionInfo.coeCT,
            functionInfo.note,
        ];
        if (!existFunctionParams.some((a) => currentParams.every((v, i) => v === a[i]))) {
            existFunctionParams.push(currentParams);
            htmlRows +=
                `<tr onclick="copyFunctionHandle(this)">` +
                `<td class="sample-data show-raw-text" name="functionId" value="${functionInfo.functionId}" data-column-title="functionName">${functionInfo.functionName}</td>` +
                `<td class="sample-data show-raw-text" name="coeANS" data-column-title="coeANS">${functionInfo.coeANS}</td>` +
                `<td class="sample-data show-raw-text" name="coeBK" data-column-title="coeBK">${functionInfo.coeBK}</td>` +
                `<td class="sample-data show-raw-text" name="coeCT" data-column-title="coeCT">${functionInfo.coeCT}</td>` +
                `<td class="sample-data show-raw-text" name="note" data-column-title="note">${functionInfo.note}</td>` +
                '</tr>';
        }
    });
    functionConfigElements.functionUserSettingTableBody.innerHTML = htmlRows;
    functionConfigElements.functionUserSettingTableBody
        .querySelectorAll('td')
        .forEach((cell) => cell.addEventListener('mouseover', FunctionInfo.hoverTableCellEvent));
    $(functionConfigElements.functionUserSettingTableModal).modal('show');
}

const validateFunctionColumnName = (inputFunctionInfo) => {
    if (isEmpty(inputFunctionInfo.systemName)) {
        FunctionInfo.setInvalidStatus(functionConfigElements.systemNameElement);
        return false;
    }

    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const checkedRows = spreadsheet.checkedRows();
    let systemNames = checkedRows.map((cell) => cell[PROCESS_COLUMNS.name_en].data);
    let japaneseNames = checkedRows.map((cell) => cell[PROCESS_COLUMNS.name_jp].data);
    let localNames = checkedRows.map((cell) => cell[PROCESS_COLUMNS.name_local].data);

    FunctionInfo.collectAllFunctionRows()
        .filter(
            (functionInfo) =>
                Number(functionInfo.functionColumnId) !== Number(inputFunctionInfo.functionColumnId) &&
                !functionInfo.isMeFunction,
        )
        .forEach((functionInfo) => {
            systemNames.push(functionInfo.systemName);
            japaneseNames.push(functionInfo.japaneseName);
            localNames.push(functionInfo.localName);
        });
    systemNames = [...new Set(systemNames), inputFunctionInfo.systemName];
    japaneseNames = [...new Set(japaneseNames), inputFunctionInfo.japaneseName];
    localNames = [...new Set(localNames), inputFunctionInfo.localName];

    /**
     * Set Border Input if it duplicate
     * @param {string[]} names - a list of names to check duplicate
     * @param {HTMLInputElement} inputElement - a input HTML
     */
    const setBorderInput = (names, inputElement) => {
        const isInValid = isArrayDuplicated(names.filter((name) => !isEmpty(name)));
        if (isInValid) {
            FunctionInfo.setInvalidStatus(inputElement);
        } else {
            FunctionInfo.removeInvalidStatus(inputElement);
        }
        return !isInValid;
    };

    const isValidSystemName = setBorderInput(systemNames, functionConfigElements.systemNameElement);
    const isValidJapaneseName = setBorderInput(japaneseNames, functionConfigElements.japaneseNameElement);
    const isValidLocalName = setBorderInput(localNames, functionConfigElements.localNameElement);
    return isValidSystemName && isValidJapaneseName && isValidLocalName;
};

const copyFunctionHandle = (el) => {
    FunctionInfo.resetInputFunctionInfo(false, false);
    const functionInfo = new FunctionInfo();
    functionInfo.functionId = $(el).find('td[name="functionId"]').attr('value');
    functionInfo.coeANS = $(el).find('td[name="coeANS"]').text().trim();
    functionInfo.coeBK = $(el).find('td[name="coeBK"]').text().trim();
    functionInfo.coeCT = $(el).find('td[name="coeCT"]').text().trim();
    functionInfo.note = $(el).find('td[name="note"]').text().trim();
    functionInfo.fillInputFunctionInfo();
    FunctionInfo.resetInvalidStatus();
    $(functionConfigElements.functionUserSettingTableModal).modal('hide');
};

/**
 * Show Modal all Functions to prepare to create a new function column
 * @param {PointerEvent} event
 */
function showFunctionDetailsModal(event) {
    // Empty function details table
    $(functionConfigElements.functionDetailsElement).empty();
    // Expand input function info area
    $(functionConfigElements.collapseFunctionConfig).collapse('show');
    const isShowInJP = document.getElementById('select-language').value === 'ja';
    FunctionInfo.resetStatusOfEditingFunction();
    let functionContent = '';
    allMasterFunction.forEach((func) => {
        functionContent +=
            `<tr onclick="selectFunction(this)">` +
            `<td class="sample-data show-raw-text" name="functionId" data-column-title="Id">${func.id}</td>` +
            `<td class="sample-data show-raw-text" name="functionType" data-column-title="Fucntion">${func.function_type}</td>` +
            `<td class="sample-data show-raw-text" name="functionDescription" data-column-title="Description">${isShowInJP ? func.description_jp : func.description_en}</td>` +
            '</tr>';
    });
    $(functionConfigElements.functionDetailsElement).append(functionContent);
    $('#functionDetailModal').modal('show');
}

/**
 * Show Delete Function Confirmation Dialog
 * @param {PointerEvent} event
 */
function showDeleteFunctionConfirmation(event) {
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach((row) => row.remove());
    const functionInfos = FunctionInfo.collectAllFunctionRows();

    // reverse mapping from varX and varY to functionColumnId
    const varToFunctionColumnId = functionInfos.reduce((acc, currentValue) => {
        const xKey = currentValue.varX.functionColumnId;
        const yKey = currentValue.varY.functionColumnId;
        for (const key of [xKey, yKey]) {
            if (key != null) {
                (acc[key] || (acc[key] = [])).push(currentValue.functionColumnId);
            }
        }
        return acc;
    }, {});

    let processingFunctionColumnIds = functionInfos
        .filter((info) => info.isChecked)
        .map((functionInfo) => functionInfo.functionColumnId);
    const deletingFunctionColumnIds = new Set();
    while (processingFunctionColumnIds.length > 0) {
        const functionColumnId = processingFunctionColumnIds.shift();
        if (deletingFunctionColumnIds.has(functionColumnId)) {
            continue;
        }
        deletingFunctionColumnIds.add(functionColumnId);
        const shouldDeleteFunctionColumnIds = varToFunctionColumnId[functionColumnId] ?? [];
        processingFunctionColumnIds = processingFunctionColumnIds.concat(shouldDeleteFunctionColumnIds);
    }

    // Add related function columns into table
    const deletingFunctionInfos = functionInfos.filter((functionInfo) =>
        deletingFunctionColumnIds.has(functionInfo.functionColumnId),
    );
    functionConfigElements.deleteFunctionColumnTableBody.innerHTML = deletingFunctionInfos.reduce(
        (htmlRows, functionInfo, index) =>
            htmlRows +
            `<tr>` +
            `<td class="sample-data show-raw-text column-index" name="index" data-column-title="index" data-is-me-function="${functionInfo.isMeFunction}" data-process-column-id="${functionInfo.processColumnId}" data-function-column-id="${functionInfo.functionColumnId}">${index + 1}</td>` +
            `<td class="sample-data show-raw-text column-system-name" name="systemName" data-column-title="systemName">${functionInfo.systemName}</td>` +
            `<td class="sample-data show-raw-text column-japanese-name" name="japaneseName" data-column-title="japaneseName">${functionInfo.japaneseName}</td>` +
            `<td class="sample-data show-raw-text column-local-name" name="localName" data-column-title="localName">${functionInfo.localName}</td>` +
            `<td class="sample-data show-raw-text column-var-x" name="varXName" data-column-title="varXName" data-var-x-id="${functionInfo.varX}">${functionInfo.varXName}</td>` +
            `<td class="sample-data show-raw-text column-var-x" name="varYName" data-column-title="varYName" data-var-y-id="${functionInfo.varY}">${functionInfo.varYName}</td>` +
            '</tr>',
        '',
    );

    functionConfigElements.deleteFunctionColumnTableBody
        .querySelectorAll('td')
        .forEach((cell) => cell.addEventListener('mouseover', FunctionInfo.hoverTableCellEvent));
    $('#deleteFunctionColumnModal').modal('show');
}

function genFunctionErrorMessage(errorResponses) {
    const setErrorMsgs = new Set();
    for (const [functionColumnId, rowErrors] of Object.entries(errorResponses)) {
        const speadSheetFunctionColumn = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const errorRowData = speadSheetFunctionColumn.getRowDataByFunctionColumnId(Number(functionColumnId));
        const row = errorRowData[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td.closest('tr');

        // Reset the 'invalid' status from each element
        FunctionInfo.resetInvalidStatus(row);

        // Find error targets and border red it
        for (const rowError of rowErrors) {
            let fieldName = rowError['field'];
            if (ARRAY_ANS.includes(fieldName)) {
                fieldName = SpreadSheetFunctionConfig.ColumnNames.CoeAns;
            } else if (ARRAY_BK.includes(fieldName)) {
                fieldName = SpreadSheetFunctionConfig.ColumnNames.CoeBk;
            } else if (ARRAY_CT.includes(fieldName)) {
                fieldName = SpreadSheetFunctionConfig.ColumnNames.CoeCt;
            }
            let errorMsg;
            if (fieldName === 'name_jp') {
                errorMsg = $(procModali18n.duplicatedJapaneseName).text() || '';
                fieldName = SpreadSheetFunctionConfig.ColumnNames.JapaneseName;
            } else if (fieldName === 'name_en') {
                errorMsg = $(procModali18n.duplicatedSystemName).text() || '';
                fieldName = SpreadSheetFunctionConfig.ColumnNames.SystemName;
            } else if (fieldName === 'name_local') {
                errorMsg = $(procModali18n.duplicatedLocalName).text() || '';
                fieldName = SpreadSheetFunctionConfig.ColumnNames.LocalName;
            } else {
                errorMsg = rowError['msg'];
            }

            // Set class invalid to border red error targets
            if (!fieldName) {
                $(row).addClass('row-invalid');
            } else {
                const tdEle = errorRowData[fieldName].td;
                FunctionInfo.setInvalidStatus(tdEle);
            }
            setErrorMsgs.add(errorMsg);
        }
    }

    // Show toast error messages
    const errorMsgs = Array.from(setErrorMsgs) || [];
    if (errorMsgs.length > 0) {
        const messageInfo = generateRegisterMessage(Array.from(errorMsgs).join('<br>'), true, false);
        return messageInfo;
    } else {
        return;
    }
}

/**
 * Collect All Function Info
 * @return {string} - a string contains all function info
 */
function collectAllFunctionInfo() {
    const shownColumnClasses = [
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.FunctionName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SystemName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.JapaneseName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.LocalName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.VarXName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.VarYName],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.CoeAns],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.CoeBk],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.CoeCt],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.Note],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.Output],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SampleData1],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SampleData2],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SampleData3],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SampleData4],
        SpreadSheetFunctionConfig.ColumnClasses[SpreadSheetFunctionConfig.ColumnNames.SampleData5],
    ];
    const predicateFilter = (td) => {
        const matched = shownColumnClasses.find((value) => td.classList.contains(value));
        return matched != null;
    };

    const headerText = [
        ...functionConfigElements.functionTableElement().querySelector('thead').firstElementChild.children,
    ]
        .filter(predicateFilter)
        .map((td) => {
            const columnName = td.innerText.trim();
            if (td.getAttribute('colspan') == null) {
                return columnName;
            }

            const quantity = parseInt(td.getAttribute('colspan'), 10);
            return Array(quantity).fill(columnName).join(TAB_CHAR);
        })
        .join(TAB_CHAR);
    const bodyText = [...functionConfigElements.functionTableElement().querySelector('tbody').children]
        .map((tr) =>
            [...tr.children]
                .filter(predicateFilter)
                .map((td) => td.innerText.trim())
                .join(TAB_CHAR),
        )
        .join(NEW_LINE_CHAR);
    return [headerText, bodyText].join(NEW_LINE_CHAR);
}

/**
 * Download All Function Info
 * @param {PointerEvent} event
 */
function downloadAllFunctionInfo(event) {
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const text = spreadsheet.table.tableText();
    const processName = document.getElementById('processName').value.trim();
    const fileName = `${processName}_FunctionSampleData.tsv`;
    downloadText(fileName, text);
    showToastrMsg(document.getElementById('i18nStartedTSVDownload').textContent, MESSAGE_LEVEL.INFO);
}

/**
 * Copy All Function Info
 * @param {PointerEvent} event
 */
function copyAllFunctionInfo(event) {
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.table.copyAll();
}

/**
 * Paste All Function Info
 * @param event
 */
function pasteAllFunctionInfo(event) {
    const rawDataTypeTitle = {
        [DataTypes.REAL.name]: [DataTypes.REAL.selectionBoxDisplay],
        [DataTypes.TEXT.name]: [DataTypes.TEXT.selectionBoxDisplay, datatypeI18nText['is_main_serial_no'].TEXT],
        [DataTypes.DATETIME.name]: [DataTypes.DATETIME.selectionBoxDisplay],
        [DataTypes.INTEGER.name]: [
            DataTypes.INTEGER.selectionBoxDisplay,
            datatypeI18nText['is_main_serial_no'].INTEGER,
        ],
        [DataTypes.BIG_INT.name]: [DataTypes.BIG_INT.selectionBoxDisplay],
        [DataTypes.CATEGORY.name]: [
            DataTypes.INTEGER_CAT.selectionBoxDisplay,
            datatypeI18nText['is_main_serial_no'].INTEGER,
        ],
        [DataTypes.BOOLEAN.name]: [DataTypes.BOOLEAN.selectionBoxDisplay],
        [DataTypes.DATE.name]: [DataTypes.DATE.selectionBoxDisplay],
        [DataTypes.TIME.name]: [DataTypes.TIME.selectionBoxDisplay],
    };
    const funcInfos = FunctionInfo.collectAllFunctionRows();
    FunctionInfo.removeAllFunctionRows();
    FunctionInfo.resetStatusOfEditingFunction();
    const dicFuncs = {};
    const dicCols = {};
    for (const colRec of currentProcDataCols) {
        dicCols[colRec.shown_name] = colRec.id;
    }
    for (const funcInfo of funcInfos) {
        if (funcInfo.functionColumnId > 0) {
            dicCols[funcInfo.systemName] = funcInfo.processColumnId;
        }
    }
    for (const funRec of allMasterFunction) {
        dicFuncs[funRec.function_type] = funRec.id;
    }
    const columnNames = [
        'isChecked',
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
        'sampleDatas',
        'sampleDatas',
        'sampleDatas',
        'sampleDatas',
        'sampleDatas',
    ];
    const spreadsheetConfig = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const handleError = (errorMessage) => {
        FunctionInfo.removeAllFunctionRows();
        funcInfos.forEach((funcInfo, rowIndex) => {
            funcInfo.addNewFunctionRow();
            spreadsheetConfig.handleChangeCell(0, rowIndex, funcInfo.isChecked, undefined);
        });
        showToastPasteFromClipboardFailed(errorMessage);
    };

    navigator.clipboard.readText().then(function (text) {
        let index = 0;
        const records = text.replace(/\r\n+$/, '').split('\r\n');
        const rows = [];
        for (const rec of records) {
            let row = rec.replace(/\t+$/, '');
            if (row.trim() === '') {
                continue;
            }

            rows.push(row.split('\t'));
        }

        if (rows.length === 0) {
            return;
        }

        prcPreviewDataOfFunctionColumn = {};
        const pastedFunctions = [];
        let hasInvalidFunction = false;
        // paste text to table
        rows.forEach((row) => {
            const params = {
                functionName: '',
                output: '',
                systemName: '',
                japaneseName: '',
                localName: '',
                varXName: '',
                varYName: '',
                coeANS: '',
                coeBK: '',
                coeCT: '',
                note: '',
                sampleDatas: [],
                isChecked: false,
                processColumnId: null,
                functionColumnId: null,
                functionId: null,
                varX: null,
                varY: null,
                index: null,
            };

            for (let columnIndex = 0; columnIndex < columnNames.length; columnIndex++) {
                const columnName = columnNames[columnIndex];
                if (columnName === 'sampleDatas') {
                    params[columnName].push(row[columnIndex]);
                } else {
                    params[columnName] = row[columnIndex];
                }
            }

            // Only allow pasting non-readonly cells on old rows
            const existFunctionInfo = funcInfos[index];
            if (existFunctionInfo != null) {
                // keep value of readonly cells for old rows
                params.functionName = existFunctionInfo.functionName;
                params.output = existFunctionInfo.output;
                params.varXName = existFunctionInfo.varXName;
                params.varYName = existFunctionInfo.varYName;
                params.sampleDatas = existFunctionInfo.sampleDatas;
                params.index = existFunctionInfo.index;

                // Set previous id (exist id) to new row, this logic serve modify exist function column instead
                //  removing the old one to create new one
                params.functionColumnId = existFunctionInfo.functionColumnId;
                params.processColumnId = existFunctionInfo.processColumnId;

                if (existFunctionInfo.isMeFunction) {
                    // In case 3 cells of names are disabled -> not allow to paste value in those cells
                    params.japaneseName = existFunctionInfo.japaneseName;
                    params.systemName = existFunctionInfo.systemName;
                    params.localName = existFunctionInfo.localName;
                }
            }

            params.functionId = dicFuncs[params.functionName];
            if (params.functionId === undefined) {
                // In case input function is invalid, skip this row
                hasInvalidFunction = true;
                return true;
            }

            // In case if there are some disable params cells -> not allow to paste value in those cells
            const { hasANS, hasBK, hasCT, funcDef } = FunctionInfo.hasParams(params.functionId);
            let [isValidANS, isValidBK, isValidCT] = [true, true, true];
            if (!hasANS) {
                params.coeANS = null;
            } else {
                // validate 【a/n/s】 cell
                if (funcDef.coefs.includes('a')) {
                    isValidANS = isNumberOrInf(params.coeANS);
                } else if (funcDef.coefs.includes('n')) {
                    isValidANS = isInteger(params.coeANS);
                }
            }
            if (!hasBK) {
                params.coeBK = null;
            } else {
                // validate 【b/k】 cell
                if (funcDef.coefs.includes('b')) {
                    isValidBK = isNumberOrInf(params.coeBK);
                } else if (funcDef.coefs.includes('k')) {
                    isValidBK = isInteger(params.coeBK);
                }
            }
            if (!hasCT) {
                params.coeCT = null;
            } else {
                // validate 【c/t】 cell
                if (funcDef.coefs.includes('c')) {
                    isValidCT = isNumberOrInf(params.coeCT);
                }
            }

            const newId = index + 1; // increase to avoid case of negative zero
            if (!dicCols[params.systemName]) {
                // In case process column not exist
                dicCols[params.systemName] = -newId;
                params.functionColumnId = -newId;
                params.processColumnId = -newId;
            } else if (params.functionName.startsWith('me.')) {
                // In case me function, always set new id
                params.functionColumnId = -newId;
                params.processColumnId = dicCols[params.varXName];
            } else if (params.processColumnId == null) {
                // In case process column exist and this is new function row, get process column id and
                //  set new function column id
                params.processColumnId = dicCols[params.systemName];
                params.functionColumnId = -newId;
            }

            params.index = index;
            const xFuncCol = pastedFunctions.findLast((func) => func.systemName === params.varXName) ?? {};
            params.varX = FunctionInfo.parseObjectValuesToInt({
                processColumnId: dicCols[params.varXName] ?? xFuncCol.processColumnId,
                functionColumnId: xFuncCol.functionColumnId,
            });
            const yFuncCol = pastedFunctions.findLast((func) => func.systemName === params.varYName) ?? {};
            params.varY = FunctionInfo.parseObjectValuesToInt({
                processColumnId: dicCols[params.varYName] ?? yFuncCol.processColumnId,
                functionColumnId: yFuncCol.functionColumnId,
            });
            if (params.output.length) {
                let isMainSerialNo = false;
                Object.keys(rawDataTypeTitle).find((key) => {
                    if (rawDataTypeTitle[key].includes(params.output.trim())) {
                        if (FunctionInfo.isMainSerial(params.output)) {
                            isMainSerialNo = true;
                        }
                        return true;
                    }

                    return false;
                });
                params.isMainSerialNo = isMainSerialNo;
            }

            const inputFunctionInfo = new FunctionInfo(params);
            inputFunctionInfo.addNewFunctionRow();
            // Trigger checkbox event
            spreadsheetConfig.handleChangeCell(columnNames.indexOf('isChecked'), index, params.isChecked, undefined);
            // Add border red to invalid cells
            [
                {
                    columnIndex: columnNames.indexOf(SpreadSheetFunctionConfig.ColumnNames.CoeAns),
                    isValid: isValidANS,
                },
                {
                    columnIndex: columnNames.indexOf(SpreadSheetFunctionConfig.ColumnNames.CoeBk),
                    isValid: isValidBK,
                },
                {
                    columnIndex: columnNames.indexOf(SpreadSheetFunctionConfig.ColumnNames.CoeCt),
                    isValid: isValidCT,
                },
            ].forEach(({ columnIndex, isValid }) => {
                if (isValid) return true;
                const targetCell = spreadsheetConfig.table.table.rows[index].querySelector(
                    `td[data-x="${columnIndex}"]`,
                );
                targetCell.classList.add(BORDER_RED_CLASS);
            });

            pastedFunctions.push(inputFunctionInfo);
            showResultFunctionWithoutDelay(index);
            index += 1;
        });

        updateCheckedFunctionColumn();
        showToastPasteFromClipboardSuccessful();
        if (hasInvalidFunction) {
            message = 'There are some invalid functions in copied text!';
            console.warn(message);
            showToastrMsg(message, MESSAGE_LEVEL.WARN);
        }
    }, handleError);
}

/**
 * Handle filter rows
 * @param {KeyboardEvent} event
 */
function searchFunctionNameInputHandler(event) {
    const rows = [...functionConfigElements.functionNameTableElement.lastElementChild.children];
    searchByValueOfTable(event, rows);
}

/**
 * Handle filter rows
 * @param {KeyboardEvent} event
 */
function searchExistFunctionInputHandler(event) {
    const rows = [...functionConfigElements.functionUserSettingTableElement.lastElementChild.children];
    searchByValueOfTable(event, rows);
}

/**
 * Delete function columns in table (only remove HTML)
 */
const handleDeleteFunctionColumns = () => {
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach((tr) => {
        const numberCell = tr.firstElementChild;
        const functionColumnId = numberCell.dataset.functionColumnId;
        deleteFunctionSampleData(functionColumnId);

        functionConfigElements
            .functionTableElement()
            .lastElementChild.querySelectorAll('tr td.column-function-column-id')
            .forEach((td) => {
                if (td.innerText !== `${functionColumnId != null ? functionColumnId : ''}`) return;
                FunctionInfo.deleteFunctionRow(td.parentElement, Number(functionColumnId));
            });
    });
    // update table mutation in records
    if (
        functionConfigElements.deleteFunctionColumnTableBody.children.length &&
        functionConfigElements.functionTableBody
    ) {
        functionConfigElements.functionTableBody.setAttribute('data-mutation', true);
    }

    closeDelFunctionColsModal();
};

const closeDelFunctionColsModal = () => {
    $('#deleteFunctionColumnModal').modal('hide');
};

/**
 * Handle checking/unchecking all function columns
 * @param {Event} event - checkbox HTML object
 */
function handleCheckAllFunctionColumns(event) {
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);

    /** @type {HTMLInputElement} */
    const el = event.currentTarget;
    const needChangedRows = el.checked ? spreadsheet.uncheckedRows() : spreadsheet.checkedRows();
    const checkboxes = $(
        needChangedRows.map((row) =>
            row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td.querySelector('input[type=checkbox]'),
        ),
    );

    checkboxes.prop('checked', el.checked).trigger('change');
}

/**
 * Handle checking/unchecking error function columns
 * @param {Event} event - checkbox HTML object
 */
function handleCheckErrorFunctionColumns(event) {
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const erroredRows = spreadsheet.erroredRows();

    /** @type {HTMLInputElement} */
    const el = event.currentTarget;

    const needChangedRows = erroredRows.filter(
        (row) => row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].data !== el.checked,
    );
    const checkboxes = $(
        needChangedRows.map((row) =>
            row[SpreadSheetFunctionConfig.ColumnNames.IsChecked].td.querySelector('input[type=checkbox]'),
        ),
    );

    checkboxes.prop('checked', el.checked).trigger('change');
}

/**
 * @param {Event} event
 */
const handleShowResultData = delay(() => {
    // check all input fill
    const isValid = FunctionInfo.validateInputFunctionInfo(undefined);
    if (isValid && !showResultFunction.disabled) {
        showResultFunction();
    } else {
        clearTimeout(showResultFunction.timeoutID);
    }
}, 100);

const handleChangeFunctionNameOrVarXY = () => {
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.handleChangeMark();
    handleShowResultData();
};

/**
 * Change table output based on function output
 */
const handleChangeFunctionOutput = (rowIndex = null, rawDataType = null) => {
    // if has rowIndex get data in table
    rawDataType = rawDataType !== null ? rawDataType : functionConfigElements.outputElement.dataset.rawDataType;
    const isMainSerialNo = rowIndex !== null ? false : functionConfigElements.isMainSerialCheckboxElement.checked;

    const dataType = FunctionInfo.getLabelRawDataType(rawDataType, isMainSerialNo);

    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.RawOutput, rawDataType, {
        recordHistory: false,
        force: true,
        rowIndex: rowIndex,
    });
    spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.Output, dataType, {
        recordHistory: false,
        force: true,
        rowIndex: rowIndex,
    });
};

/**
 * Change function input for coefficient elements.
 * @param {string} columnName - column name for changing coef input, from {@link SpreadSheetFunctionConfig.ColumnNames}
 * @returns {(function(Event): void)}
 */
const handleChangeFunctionConfigCoeInput = (columnName) => {
    const changeInputFunction = handleChangeFunctionConfigInput(columnName);

    return (event) => {
        // Call `handleChangeFunctionConfigInput` to sync data
        changeInputFunction(event);

        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const isValid = spreadsheet.allCoeCellAndInputsAreValid();
        // if editing selected row, when sync data -> handleShowResultData
        const selectedRow = spreadsheet.selectedRow();
        if (isValid && !selectedRow) {
            handleShowResultData();
        }
    };
};

/**
 * Change function config element should sync to correct input box.
 * @param {string} columnName - column name for changing input, from {@link SpreadSheetFunctionConfig.ColumnNames}
 * @returns {(function(Event): void)}
 */
const handleChangeFunctionConfigInput = (columnName) => {
    /**
     * Some value need to be pre-process here.
     * @param {string} value
     * @return {string}
     */
    const preProcessValue = (value) => {
        let preProcessedValue = value;
        if (columnName === SpreadSheetFunctionConfig.ColumnNames.SystemName) {
            preProcessedValue = correctEnglishName(preProcessedValue);
        }
        return preProcessedValue;
    };

    return (event) => {
        /** @type HTMLInputElement */
        const targetInput = event.currentTarget;
        targetInput.value = preProcessValue(targetInput.value);
        if (
            mainSerialFunctionColumnInfo &&
            [
                SpreadSheetFunctionConfig.ColumnNames.CoeAns,
                SpreadSheetFunctionConfig.ColumnNames.CoeBk,
                SpreadSheetFunctionConfig.ColumnNames.CoeCt,
            ].includes(columnName)
        ) {
            showModalAnyChangesInDefinitionMainSerialFunctionColumn(columnName, targetInput.value, true);
        }
        // Remove invalid border incase this input was marked as error before.
        FunctionInfo.removeInvalidStatus(targetInput);

        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(columnName, targetInput.value);

        // explicitly handle change mark, incase we don't select any row, but changing for new function column.
        spreadsheet.handleChangeMark();
    };
};

/**
 * Handle changing function name
 * @param {JQuery.Event | Event} event - checkbox HTML object
 */
const changeFunctionNameEvent = (event) => {
    /** @type {HTMLSelectElement} */
    const el = event.currentTarget;

    FunctionInfo.clearSampleData();
    FunctionInfo.resetInvalidStatus();

    // Clear X column of sample data
    $(functionConfigElements.varXElement).val('').change();
    $(functionConfigElements.varYElement).val('').change();

    if (el.selectedOptions == null || el.selectedOptions.length === 0) {
        functionConfigElements.varXElement.disabled = true;
        $(functionConfigElements.varXElement).val('').change();
        functionConfigElements.varYElement.disabled = true;
        $(functionConfigElements.varYElement).val('').change();

        functionConfigElements.coeANSElement.value = '';
        functionConfigElements.coeANSElement.disabled = true;
        functionConfigElements.coeANSElement.required = false;
        functionConfigElements.coeANSLabelElement.innerHTML = '';

        functionConfigElements.coeBKElement.value = '';
        functionConfigElements.coeBKElement.disabled = true;
        functionConfigElements.coeBKElement.required = false;
        functionConfigElements.coeBKLabelElement.innerHTML = '';

        functionConfigElements.coeCTElement.value = '';
        functionConfigElements.coeCTElement.disabled = true;
        functionConfigElements.coeCTElement.required = false;
        functionConfigElements.coeCTLabelElement.innerHTML = '';

        functionConfigElements.helperMessageElement.innerHTML = '';
        functionConfigElements.helperMessageElement.title = '';

        return;
    }

    //change output data type
    const selectedOption = el.selectedOptions[0];
    FunctionInfo.setOutputDataType(selectedOption.getAttribute('output-data-type'));
    // Disable input column name if me
    const functionName = selectedOption.text;
    let isMeFunction = functionName.startsWith('me.');
    // TODO: implement for me function
    if (isMeFunction) {
        functionConfigElements.isMainSerialCheckboxElement.checked = false;
        functionConfigElements.isMainSerialCheckboxElement.disable = true;
    }
    functionConfigElements.systemNameElement.disabled = isMeFunction;
    functionConfigElements.japaneseNameElement.disabled = isMeFunction;
    functionConfigElements.localNameElement.disabled = isMeFunction;

    const isHasXParam = selectedOption.getAttribute('var-x') === 'true';
    const isHasYParam = selectedOption.getAttribute('var-y') === 'true';
    if (isHasXParam) {
        if (isMeFunction) {
            // change label X to me
            functionConfigElements.varXLabelElement.innerHTML = 'me:';
            functionConfigElements.xSampleDataLabel.innerHTML = 'me';
        } else {
            functionConfigElements.varXLabelElement.innerHTML = 'X:';
            functionConfigElements.xSampleDataLabel.innerHTML = 'X';
        }
        $(functionConfigElements.varXElement).select2({ disabled: false });
        $(functionConfigElements.varXElement).val(functionConfigElements.varXElement.value).change();
    } else {
        $(functionConfigElements.varXElement).select2({ disabled: true });
        $(functionConfigElements.varXElement).val('').change();
    }

    if (isHasYParam) {
        $(functionConfigElements.varYElement).select2({ disabled: false });
        $(functionConfigElements.varYElement).val(functionConfigElements.varYElement.value).change();
    } else {
        $(functionConfigElements.varYElement).select2({ disabled: true });
        $(functionConfigElements.varYElement).val('').change();
    }

    const changeStatusLabel = (attributeName, coeElement, coeLabelElement) => {
        const coeLabel = selectedOption.getAttribute(attributeName);
        const defaultValue = selectedOption.getAttribute(`${DEFAULT_VALUE_PREFIX}${attributeName}`) || '';
        const required = selectedOption.getAttribute(`${REQUIRED_VALUE_PREFIX}${attributeName}`) === 'true';

        if (coeLabel.length === 0) {
            coeElement.value = '';
            coeElement.disabled = true;
            coeElement.required = false;
        } else {
            coeElement.value = defaultValue;
            coeElement.disabled = false;
            coeElement.required = required;
        }
        coeLabelElement.innerHTML = coeLabel !== '' ? `${coeLabel}:` : coeLabel;
    };

    // change label
    changeStatusLabel('coe-a-n-s', functionConfigElements.coeANSElement, functionConfigElements.coeANSLabelElement);
    changeStatusLabel('coe-b-k', functionConfigElements.coeBKElement, functionConfigElements.coeBKLabelElement);
    changeStatusLabel('coe-c-t', functionConfigElements.coeCTElement, functionConfigElements.coeCTLabelElement);

    FunctionInfo.initDropdownVarXY(selectedOption);

    // change helper message
    const isShowInJP = document.getElementById('select-language').value === 'ja';
    const fullLengthMsg = isShowInJP
        ? selectedOption.getAttribute('description_jp')
        : selectedOption.getAttribute('description_en');
    // no longer support, change to css to overflow long text
    // const maximumLength = 200;
    // functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg.length > maximumLength ? fullLengthMsg.substring(0, maximumLength) + '...' : fullLengthMsg;
    functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg;
    functionConfigElements.helperMessageElement.title = fullLengthMsg;
};

/**
 * Check if coefficient input is invalid
 * @param {HTMLInputElement} coeElement
 * @returns {boolean} - true if valid otherwise false
 */
const isValidCoeInput = (coeElement) => {
    const inputValue = coeElement.value;
    let isValid = true;

    const coeLabel = coeElement.parentElement.parentElement.querySelector('label').textContent[0];
    if (['a', 'b', 'c'].includes(coeLabel)) {
        isValid = isNumberOrInf(inputValue);
    } else if (['n', 'k'].includes(coeLabel)) {
        isValid = isInteger(inputValue);
    }

    // input is required
    if (coeElement.required && inputValue === '') {
        isValid = false;
    }

    return isValid;
};

const isNumberOrInf = (inputValue) => {
    // validate number input only
    if (['', '-inf', 'inf'].includes(inputValue)) {
        return true;
    }
    return !isNaN(Number(inputValue));
};

/**
 * Generate Function Column Names (JP, System, Local)
 * @param {HTMLOptionElement} selectedColumn - an option HTML object
 * @param {HTMLOptionElement} selectedFunction - an option HTML object
 */
function generateFunctionColumnNames(selectedColumn, selectedFunction) {
    // Set default system name if it is new function column (not editing mode)
    const selectedRow = FunctionInfo.getSelectedRow();
    if (
        selectedRow == null &&
        functionConfigElements.systemNameElement.dataset.originGeneratedName ===
            functionConfigElements.systemNameElement.value &&
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName ===
            functionConfigElements.japaneseNameElement.value &&
        functionConfigElements.localNameElement.dataset.originGeneratedName ===
            functionConfigElements.localNameElement.value
    ) {
        const selectedFunctionNameJp = selectedFunction.getAttribute('function_name_jp');
        const selectedFunctionNameEn = correctEnglishName(selectedFunction.getAttribute('function_name_en'));
        let suffix = '';
        const selectedColumnSystemName = selectedColumn.getAttribute('name-sys').trim();
        const selectedColumnJapaneseName = selectedColumn.getAttribute('name-jp').trim();
        const selectedColumnLocalName = selectedColumn.getAttribute('name-local').trim();
        const searchName = `${selectedColumnSystemName}_${selectedFunctionNameEn}`.replaceAll(' ', '_');
        const spreadSheetFunctionColumn = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        const systemColumnNames = spreadSheetFunctionColumn.table.getColumnDataByHeaderName(
            SpreadSheetFunctionConfig.ColumnNames.SystemName,
        );
        const sameColumnNames = systemColumnNames.filter((systemColumnName) => systemColumnName.includes(searchName));
        const prefix = `${searchName}_`;
        const validSameColumnNames = sameColumnNames
            .filter((name) => name.includes(prefix) && name.replace(prefix, '').match(/^\d{2}$/) != null)
            .sort((a, b) => a.localeCompare(b));
        if (validSameColumnNames.length > 0) {
            const lastName = validSameColumnNames[validSameColumnNames.length - 1];
            suffix = parseInt(lastName.substring(lastName.length - 2, lastName.length), 10) + 1;
            suffix = `_${String(suffix).padStart(2, '0')}`;
        } else if (sameColumnNames.length > 0) {
            suffix = `_01`;
        }

        const updateName = (selectedColumnName, selectedFunctionName, nameElement) => {
            if (selectedColumnName) {
                nameElement.value = `${selectedColumnName}_${selectedFunctionName}${suffix}`
                    .trim()
                    .replaceAll(' ', '_');
            } else {
                nameElement.value = '';
            }
            nameElement.dataset.originGeneratedName = nameElement.value;
        };

        updateName(selectedColumnSystemName, selectedFunctionNameEn, functionConfigElements.systemNameElement);
        updateName(selectedColumnJapaneseName, selectedFunctionNameJp, functionConfigElements.japaneseNameElement);
        updateName(selectedColumnLocalName, selectedFunctionNameEn, functionConfigElements.localNameElement);
    }
}

const changeFunctionColumnName = (el, colTableIdx) => {
    // Clear sample data if no select any column
    if (el.selectedOptions == null || el.selectedOptions.length === 0) {
        functionConfigElements.sampleDataElement
            .querySelectorAll(`tbody tr td:nth-child(${colTableIdx})`)
            .forEach((td) => (td.textContent = ''));
        return;
    }

    // Get sample data of selected column
    const selectedColumn = el.selectedOptions[0];
    const { processColumnId, functionColumnId } = FunctionInfo.getDropDownOptionValue(selectedColumn.value);
    const columnType = selectedColumn.getAttribute('column-type');
    const selectedFunction = functionConfigElements.functionNameElement.selectedOptions[0];
    const isMeFunction = selectedFunction.text.startsWith('me.');
    const isFunctionColSelected =
        $(functionConfigElements.functionTableElement()).find(`tr.${ROW_SELECTED_CLASS_NAME}`).length > 0;

    if (isMeFunction) {
        functionConfigElements.systemNameElement.value = selectedColumn.getAttribute('name-sys');
        functionConfigElements.systemNameElement.dataset.originGeneratedName =
            functionConfigElements.systemNameElement.value;
        functionConfigElements.japaneseNameElement.value = selectedColumn.getAttribute('name-jp');
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName =
            functionConfigElements.japaneseNameElement.value;
        functionConfigElements.localNameElement.value = selectedColumn.getAttribute('name-local');
        functionConfigElements.localNameElement.dataset.originGeneratedName =
            functionConfigElements.localNameElement.value;
    }

    // check X and Y is enabled or not
    const isDisabledX = functionConfigElements.varXElement.disabled;
    const isDisabledY = functionConfigElements.varYElement.disabled;
    const isCalculatedXAndY = !isDisabledX && !isDisabledY;

    // check value of X and Y
    const varXId = FunctionInfo.getVarXId();
    const varYId = FunctionInfo.getVarYId();
    const isHasXYValue =
        (varXId.processColumnId != null || varXId.functionColumnId != null) &&
        (varYId.processColumnId != null || varYId.functionColumnId != null);

    const xDataType = functionConfigElements.varXElement.selectedOptions[0].getAttribute('raw-data-type');
    let yDataType = '';
    if (isHasXYValue) {
        yDataType = functionConfigElements.varYElement.selectedOptions[0].getAttribute('raw-data-type');
    }

    if (!isCalculatedXAndY) {
        // fill dataY empty
        const dataByX = getSampleDataX();
        const originalDataByX = getSampleDataX({ isRawData: true });
        let dataByY = Array(dataByX.length).fill('');
        let originalDataByY = Array(dataByX.length).fill('');
        getUniqueAndSlideData(dataByX, dataByY, xDataType, yDataType, originalDataByX, originalDataByY, false);
    }
    if (isHasXYValue && isCalculatedXAndY) {
        // map data by ID
        const dataByX = getSampleDataX();
        const dataByY = getSampleDataY();
        const originalDataByX = getSampleDataX({ isRawData: true });
        const originalDataByY = getSampleDataY({ isRawData: true });
        getUniqueAndSlideData(dataByX, dataByY, xDataType, yDataType, originalDataByX, originalDataByY, true);
    }

    // Set default system name if it is new function column (not editing mode)
    if (colTableIdx === 2 && !isMeFunction) {
        generateFunctionColumnNames(selectedColumn, selectedFunction);
    }
    if (functionConfigElements.isMainSerialCheckboxElement.checked && !isCanCheckMainSerial()) {
        // show message
        showToastrMsg($('#i18nSkipMainSerialFunctionMsg').text(), MESSAGE_LEVEL.WARN);
        // uncheck
        functionConfigElements.isMainSerialCheckboxElement.checked = false;
        //disable
        functionConfigElements.isMainSerialCheckboxElement.disabled = true;
    }
};

/**
 * Get unique data and slice to 50 data
 * @param {array} dataByX - sample data of column x
 * @param {array} dataByY - sample data of column y
 * @param {array} originalDataByX - raw data of column x
 * @param {array} originalDataByY - raw data of column y
 * @param {string} xDataType - data type of column x
 * @param {string} yDataType - data type of column y
 * @param {boolean} isBothXY
 * @param {int} limit - limit slice
 */
const getUniqueAndSlideData = (
    dataByX,
    dataByY,
    xDataType,
    yDataType,
    originalDataByX,
    originalDataByY,
    isBothXY = false,
    limit = 50,
) => {
    const mapDataByXY = _.zip(dataByX ?? [], dataByY ?? []);
    const mapOriginalDataByXY = _.zip(originalDataByX ?? [], originalDataByY ?? []);

    // get unique data and slice to 50 date
    const uniqueDataByXY = [...new Set(mapDataByXY.map((item) => JSON.stringify(item)))]
        .map((item) => JSON.parse(item))
        .slice(0, limit);
    const uniqueOriginDataByXY = uniqueDataByXY.map(
        (item) => mapOriginalDataByXY[mapDataByXY.findIndex((x) => JSON.stringify(x) === JSON.stringify(item))],
    );

    const [uniqueDataByX, uniqueDataByY] = sortEmptyStringDataXY(isBothXY, uniqueDataByXY);
    const [uniqueOriginalDataByX, uniqueOriginDataByY] = sortEmptyStringDataXY(isBothXY, uniqueOriginDataByXY);

    // re-update data of X and Y with index of X (2) and Y(3) in functionSampleTable data
    _.zip(
        [2, 3],
        [xDataType, yDataType],
        [uniqueDataByX, uniqueDataByY],
        [uniqueOriginalDataByX, uniqueOriginDataByY],
    ).forEach(([colTableIdx, dataType, renderData, originalData]) => {
        renderDataToFunctionSampleData({
            renderData,
            originalData,
            dataType,
            colTableIdx,
        });
    });
};

const sortEmptyStringDataXY = (isBothXY, uniqueDataByXY) => {
    //Sort empty string to last
    //1. 1st row: Both x and y are not NA
    //2. 2nd row: first record where x is empty and y is not empty
    //3. 3rd row: first record where x not empty and y is empty
    //4. 4th row and on: both X and Y are not NA, unique
    let firstRowIndex;
    let secondIndex;
    let threeRowIndex;
    let otherRowIndexes = [];

    if (isBothXY) {
        // Find indices
        uniqueDataByXY.forEach((item, index) => {
            const x = item[0];
            const y = item[1];
            // 1st row: Both x and y are not NA
            if (x !== '' && y !== '' && firstRowIndex === undefined) {
                firstRowIndex = index;
                return;
            }
            // 2nd row: first record where x is empty and y is not empty
            if (x === '' && y !== '' && secondIndex === undefined) {
                secondIndex = index;
                return;
            }
            // 3rd row: first record where x not empty and y is empty
            if (x !== '' && y === '' && threeRowIndex === undefined) {
                threeRowIndex = index;
                return;
            }
            // 4th row and on: both X and Y are not NA, unique
            if (x !== '' && y !== '' && firstRowIndex !== undefined) {
                otherRowIndexes.push(index);
            }
        });
    } else {
        // Find indices
        uniqueDataByXY.forEach((item, index) => {
            const x = item[0];
            // 4th row and on: both X and Y are not NA, unique
            if (x !== '') {
                otherRowIndexes.push(index);
            }
        });
    }

    const sortedUniqueDataByXY = [
        uniqueDataByXY[firstRowIndex],
        uniqueDataByXY[secondIndex],
        uniqueDataByXY[threeRowIndex],
        ...uniqueDataByXY.filter((_, index) => otherRowIndexes.includes(index)),
    ];

    return _.unzip(sortedUniqueDataByXY);
};

const renderDataToFunctionSampleData = ({ renderData, originalData, dataType, colTableIdx }) => {
    const trEls = $(functionConfigElements.sampleDataElement).find(`tbody tr`);
    const tableSampleDataBodyEl = $(functionConfigElements.sampleDataElement).find(`tbody`);
    let tableRow = $(`<tr>
        <td class="sample-data show-raw-text"></td>
        <td class="sample-data show-raw-text"></td>
        <td class="sample-data show-raw-text"></td>
    </tr>`);

    // render data to table
    if (trEls.length <= renderData.length) {
        // add data
        const numberOfRowsToAdd = renderData.length - trEls.length;
        for (let i = 0; i < numberOfRowsToAdd; i++) {
            tableSampleDataBodyEl.append(tableRow.clone());
        }
    } else {
        // remove row
        const numberOfRowsToRemove = trEls.length - renderData.length;
        trEls.slice(-numberOfRowsToRemove).remove();
    }

    const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(${colTableIdx})`);
    // map data to table
    const isNumber = NUMERIC_TYPES.includes(dataType);
    _.zip(elements, renderData, originalData).forEach(([ele, value, originalData]) => {
        $(ele).html(formatSignifiValue(value, isNumber));
        $(ele).attr(DATA_ORIGINAL_ATTR, originalData);
        $(ele).attr(IS_NUMBER_ATTR, isNumber);
    });
};

const setPreviewDataForFunctionColumns = (functionColumnId, sampleDatas) => {
    prcPreviewDataOfFunctionColumn[functionColumnId] = sampleDatas;
};

/**
 * @param {?number|string} functionColumnId
 * @param {?number|string} processColumnId
 * @param {boolean} isRawData
 * @returns string[]
 */
const getSampleDataByFunctionColumnIdOrColumnId = (
    { functionColumnId, processColumnId, isRawData } = {
        functionColumnId: null,
        processColumnId: null,
        isRawData: false,
    },
) => {
    // get data in prcPreviewDataOfFunctionColumn if null|undefined => get in prcPreviewWith1000Data
    // TODO: parse to int
    if (isRawData) {
        return prcPreviewDataOfFunctionColumn[functionColumnId] || prcRawDataWith1000Data[processColumnId];
    }
    return prcPreviewDataOfFunctionColumn[functionColumnId] || prcPreviewWith1000Data[processColumnId];
};

const getSampleDataX = ({ isRawData } = { isRawData: false }) =>
    getSampleDataByFunctionColumnIdOrColumnId({
        ...FunctionInfo.getVarXId(),
        isRawData: isRawData,
    });
const getSampleDataY = ({ isRawData } = { isRawData: false }) =>
    getSampleDataByFunctionColumnIdOrColumnId({
        ...FunctionInfo.getVarYId(),
        isRawData: isRawData,
    });

const deleteNewlyAddedFunctionColumnSampleData = () => {
    const newlyAddedFunctionColumnIds = Object.keys(prcPreviewDataOfFunctionColumn).filter(
        (functionColumnId) => parseInt(functionColumnId) < 0,
    );
    newlyAddedFunctionColumnIds.forEach(deleteFunctionSampleData);
};

const deleteFunctionSampleData = (functionColumnId) => {
    delete prcPreviewDataOfFunctionColumn?.[functionColumnId];
};
/**
 * Get sample data based on function column id or column id
 * @param {?number|string} functionColumnId
 * @param {?number|string} processColumnId
 * @return {string[]} - a list that contains sample data
 */
const collectSampleDataUnique = ({ functionColumnId, processColumnId }) => {
    const data = getSampleDataByFunctionColumnIdOrColumnId({
        functionColumnId,
        processColumnId,
    });
    // return new sampleDataValues with 50 unique data
    return [...new Set(data)].slice(0, 50);
};

const collectEquationOriginSampleData = (idx) => {
    const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(${idx})`);
    let sampleDataValues = [];
    for (const e of elements) {
        sampleDataValues.push(e.getAttribute(DATA_ORIGINAL_ATTR));
    }
    return sampleDataValues;
};

/**
 * Show sample datas base on function inputs
 */
const showResultFunctionWithoutDelay = (rowIndex = null) => {
    const getValues = (element, selection = {}) => {
        selection = element ? FunctionInfo.getDropDownOptionValue(element.value) : selection;
        const sampleDatas =
            getSampleDataByFunctionColumnIdOrColumnId({
                ...selection,
                isRawData: true,
            }) ?? [];
        return sampleDatas.map((v) => String(v ?? ''));
    };
    let data = {};
    let xRawValues;
    let yRawValues;
    let xDataType;
    let yDataType;
    let equationId;
    let coeANS;
    let coeBK;
    let coeCT;

    // get datetime format to convert
    const datetimeFormat = procModalElements.procDateTimeFormatInput.val().trim();
    const isDatetimeFormat = procModalElements.procDateTimeFormatCheckbox.is(':checked');

    if (rowIndex !== null) {
        // const rowData = speadSheet.table.getRowDataByIndex(rowIndex);
        const functionColumns = FunctionInfo.collectAllFunctionRows();
        const rowData = functionColumns.splice(rowIndex, 1)[0];
        const processColumns = currentProcDataCols;
        xRawValues = getValues(null, rowData.varX);
        yRawValues = getValues(null, rowData.varY);
        const xColumn =
            processColumns.find((col) => Number(col.id) === Number(rowData.varX.processColumnId)) ||
            functionColumns.find((col) => Number(col.varX.processColumnId) === Number(rowData.varX.processColumnId));
        xDataType = xColumn?.data_type;
        const yColumn =
            processColumns.find((col) => Number(col.id) === Number(rowData.varY?.processColumnId)) ||
            functionColumns.find((col) => Number(col.varY?.processColumnId) === Number(rowData.varY?.processColumnId));
        yDataType = yColumn?.data_type;
        equationId = rowData.functionId;
        coeANS = rowData.coeANS;
        coeBK = rowData.coeBK;
        coeCT = rowData.coeCT;
    } else {
        // TODO(khanhdq): use getSampleDataX() and getSampleDataY() here
        xRawValues = getValues(functionConfigElements.varXElement);
        yRawValues = getValues(functionConfigElements.varYElement);
        xDataType = $(functionConfigElements.varXElement).find(':selected').attr('raw-data-type');
        yDataType = $(functionConfigElements.varYElement).find(':selected').attr('raw-data-type');
        const selectedFunction = $(functionConfigElements.functionNameElement).find(':selected');
        equationId = selectedFunction.val();
        coeANS = functionConfigElements.coeANSElement.value;
        coeBK = functionConfigElements.coeBKElement.value;
        coeCT = functionConfigElements.coeCTElement.value;
    }
    const {
        a = null,
        b = null,
        c = null,
        n = null,
        k = null,
        s = null,
        t = null,
    } = separateArgumentsOfFunction(equationId, coeANS, coeBK, coeCT);

    const speadSheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const selectedRow = speadSheet.selectedRow();
    const selectedRowIndex = selectedRow ? _.first(_.values(selectedRow)).rowIndex : null;
    data = {
        X: xRawValues,
        x_data_type: xDataType,
        Y: yRawValues,
        y_data_type: yDataType,
        a,
        b,
        c,
        n,
        k,
        s,
        t,
        equation_id: equationId,
        datetime_format: datetimeFormat,
        is_datetime_format: isDatetimeFormat,
    };
    const isAllXValuesEmpty = xRawValues.every((element) => element === '');
    const isAllYValuesEmpty = yRawValues.every((element) => element === '');
    fetch('/ap/api/setting/function_config/sample_data', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.json())
        .then((data) => {
            const isChangeConfig = Number(selectedRowIndex) === Number(rowIndex) || !rowIndex; // is input new function or edit function column
            if (Object.prototype.hasOwnProperty.call(data, 'errors')) {
                loadingHide();
                if (isChangeConfig) {
                    FunctionInfo.showErrorField(data.errors);
                    FunctionInfo.clearFunctionOutput();
                } else {
                    for (const error of data.errors) {
                        const selectRowExcel = speadSheet.getRowExcelByIndex(rowIndex);
                        let columnName;
                        if (ARRAY_ANS.includes(error.field)) {
                            columnName = SpreadSheetFunctionConfig.ColumnNames.CoeAns;
                        } else if (ARRAY_BK.includes(error.field)) {
                            columnName = SpreadSheetFunctionConfig.ColumnNames.CoeBk;
                        } else if (ARRAY_CT.includes(error.field)) {
                            columnName = SpreadSheetFunctionConfig.ColumnNames.CoeCt;
                        }
                        const cell = selectRowExcel[columnName];
                        cell.td.classList.add(BORDER_RED_CLASS);
                    }
                }
            } else {
                const sampleData = jsonParse(data.sample_data);
                const isNumber = NUMERIC_TYPES.includes(data.output_type);
                if (isChangeConfig) {
                    // fill data in input
                    /** @type {string[]} */
                    // const { xValues, yValues } = getXYValues();
                    const xValues = getSampleDataX({ isRawData: true }) || [];
                    const yValues = getSampleDataY({ isRawData: true }) || [];
                    // Find result of unique X & Y
                    const xYResult = Object.fromEntries(_.zip(_.zip(xValues, yValues), sampleData));
                    const uniqueXYResult = Object.fromEntries(
                        _.zip(_.zip(collectEquationOriginSampleData(2), collectEquationOriginSampleData(3)), []),
                    );
                    for (const xYKey in uniqueXYResult) {
                        uniqueXYResult[xYKey] = xYResult[xYKey] ?? '';
                    }
                    const resultValues = Object.values(uniqueXYResult);
                    functionConfigElements.sampleDataElement.result = sampleData;

                    FunctionInfo.setOutputDataType(data.output_type);
                    const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(1)`);
                    for (const index of Array(resultValues.length).keys()) {
                        let val = resultValues[index];
                        $(elements[index]).attr(DATA_ORIGINAL_ATTR, val);
                        $(elements[index]).attr(IS_NUMBER_ATTR, isNumber);
                        if (data.output_type === DataTypes.DATETIME.name) {
                            val = parseDatetimeStr(val);
                        }
                        val = formatSignifiValue(val, isNumber);
                        $(elements[index]).html(val);
                    }
                    const isResultsEmpty = resultValues.every((element) => element === null);

                    if (isResultsEmpty && (!isAllXValuesEmpty || !isAllYValuesEmpty)) {
                        showToastrMsg($('#i18nAllResultIsEmpty').text(), MESSAGE_LEVEL.WARN);
                    }
                }
                // fill in table
                if (rowIndex !== null || selectedRowIndex) {
                    const fillRowIndex = selectedRowIndex || rowIndex;
                    const rowElement = speadSheet.table.getRowElementByIndex(fillRowIndex);
                    FunctionInfo.fillSampleDataToFunctionRow(sampleData, isNumber, rowElement);
                    handleChangeFunctionOutput(isChangeConfig ? null : rowIndex, data.output_type);
                }
            }
        })
        .catch((res) => {
            console.log('Error result function');
            // FunctionInfo.showErrorField(res.responseJSON.errors);
        });
};

const showResultFunction = delay(showResultFunctionWithoutDelay, 200);

const selectFunction = (el) => {
    const functionId = $(el).find('td[name="functionId"]').text();
    FunctionInfo.resetInputFunctionInfo(false, false);
    $(functionConfigElements.functionNameElement).val(functionId).change();
    $('#functionDetailModal').modal('hide');
};

const closeFunctionDetailModal = (element) => {
    const modal = element.closest('.modal');
    $(modal).modal('hide');
};

const closeFunctionUserSettingModal = (element) => {
    const modal = element.closest('.modal');
    $(modal).modal('hide');
};

/**
 * Close Function Confirm Switch Editing Row Modal
 * @param {HTMLAnchorElement} element
 */
const closeFunctionConfirmSwitchEditingRowModal = (element) => {
    const modal = element.closest('.modal');
    $(modal).modal('hide');
};

/**
 * Ok Function Confirm Switch Editing Row Modal
 * @param {HTMLAnchorElement} element
 */
const okFunctionConfirmSwitchEditingRowModal = (element) => {
    const speadSheetFunctionColumn = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const selectRowElement = speadSheetFunctionColumn.table.getRowElementByIndex(Number(element.dataset.index));
    const previousSelectedRowElement = speadSheetFunctionColumn.table.getRowElementByIndex(
        Number(element.dataset.previousIndex),
    );
    FunctionInfo.selectRowHandler(selectRowElement, previousSelectedRowElement);
    closeFunctionConfirmSwitchEditingRowModal(element);
};

/**
 * Sync input between config and table with reload supported
 * @param {HTMLInputElement} configInput
 * @param {HTMLInputElement} tableInput
 * @param {boolean} reload
 */
const syncInputConfigAndTableEvents = (configInput, tableInput, reload) => {
    function syncTableToConfig() {
        configInput.value = tableInput.value;
        if (reload) {
            showResultFunction();
        }
    }

    function syncConfigToTable() {
        tableInput.value = configInput.value;
        if (reload) {
            showResultFunction();
        }
    }

    function addEvent() {
        tableInput.addEventListener('change', syncTableToConfig, true);
        configInput.addEventListener('change', syncConfigToTable, true);
    }

    function removeEvent() {
        tableInput.removeEventListener('change', syncTableToConfig, true);
        configInput.removeEventListener('change', syncConfigToTable, true);
    }

    return {
        addEvent,
        removeEvent,
    };
};

/**
 * Sync select between config and table with reload supported
 * @param {HTMLSelectElement} configSelect
 * @param {HTMLTableDataCellElement} cell
 */
const syncSelectConfigAndTableEvents = (configSelect, cell) => {
    const ele = $(configSelect);

    function syncConfigToTable() {
        // check edit main serial function column
        const isChange = showModalAnyChangesInDefinitionMainSerialFunctionColumn(null, true);
        if (isChange) return;
        const option = ele.find('option:checked');
        if (option.length) {
            cell.innerHTML = option.text();
        }
    }

    function addEvent() {
        ele.on('change', syncConfigToTable);
    }

    function removeEvent() {
        ele.off('change', syncConfigToTable);
    }

    return {
        addEvent,
        removeEvent,
    };
};

/**
 * Detect and separate specific arguments of function
 * @param {string|number} functionId
 * @param {string} coeANS
 * @param {string} coeBK
 * @param {string} coeCT
 * @return {{
 *    a: string|null,
 *    b: string|null,
 *    c: string|null,
 *    s: string|null,
 *    t: string|null,
 *    k: string|null,
 *    n: string|null,
 * }}
 */
function separateArgumentsOfFunction(functionId, coeANS, coeBK, coeCT) {
    const masterFunction = allMasterFunction.find((f) => String(f.id ?? '') === String(functionId ?? ''));
    const {
        a = null,
        b = null,
        c = null,
        n = null,
        k = null,
        s = null,
        t = null,
    } = Object.fromEntries(
        (masterFunction ?? { coefs: [] }).coefs.map((argumentLabel) => {
            let value = null;
            if (ARRAY_ANS.includes(argumentLabel)) {
                value = coeANS;
            } else if (ARRAY_BK.includes(argumentLabel)) {
                value = coeBK;
            } else if (ARRAY_CT.includes(argumentLabel)) {
                value = coeCT;
            }
            return [argumentLabel, value];
        }),
    );
    return { a, b, c, n, k, s, t };
}

/**
 * Collect Function Datas For Registering
 * @return {*[]} - a list of dictionary
 */
function collectFunctionDatasForRegister() {
    const dictProcessFunctionColumn = {};
    FunctionInfo.collectAllFunctionRows().forEach((functionInfo) => {
        const isGetDate = false;
        const isSerial = functionInfo.isMainSerialNo;
        const columnType = masterDataGroup.GENERATED_EQUATION;

        if (functionInfo.isMeFunction) {
            functionInfo.processColumnId = functionInfo.varX.processColumnId;
        }

        const dicCfgProcessColumn = {
            id: functionInfo.processColumnId || null,
            process_id: procModalElements.procID.val() || null,
            column_name: functionInfo.systemName,
            column_raw_name: functionInfo.systemName,
            name_en: functionInfo.systemName,
            name_jp: functionInfo.japaneseName,
            name_local: functionInfo.localName,
            data_type: functionInfo.output,
            predict_type: functionInfo.output,
            raw_data_type: functionInfo.output,
            order: CfgProcess_CONST.CATEGORY_TYPES.includes(functionInfo.output) ? 1 : 0,
            column_type: columnType,
            is_get_date: isGetDate,
            is_serial_no: isSerial,
            function_details: [],
        };

        const {
            a = null,
            b = null,
            c = null,
            n = null,
            k = null,
            s = null,
            t = null,
        } = separateArgumentsOfFunction(
            functionInfo.functionId,
            functionInfo.coeANS,
            functionInfo.coeBK,
            functionInfo.coeCT,
        );

        const dicCfgProcessFunctionColumn = {
            id: functionInfo.functionColumnId || null,
            process_column_id: functionInfo.processColumnId || null,
            function_id: functionInfo.functionId,
            var_x: functionInfo.varX.processColumnId,
            var_y: functionInfo.varY.processColumnId,
            return_type: functionInfo.output,
            a,
            b,
            c,
            n,
            k,
            s,
            t,
            note: functionInfo.note,
            // is_me_function: functionInfo.isMeFunction,
            // process_column: dicCfgProcessColumn,
            order: functionInfo.index,
        };
        if (dictProcessFunctionColumn[dicCfgProcessColumn.id]) {
            const column = dictProcessFunctionColumn[dicCfgProcessColumn.id];
            column.function_details.push(dicCfgProcessFunctionColumn);
        } else {
            dicCfgProcessColumn.function_details.push(dicCfgProcessFunctionColumn);
            dictProcessFunctionColumn[dicCfgProcessColumn.id] = dicCfgProcessColumn;
        }
    });

    return dictProcessFunctionColumn;
}

/**
 * Reload function infos of current process that have in system
 * @param {PointerEvent} event
 */
function reloadFunctionInfo(event) {
    loadingShowImmediately();
    FunctionInfo.resetInputFunctionInfo();
    FunctionInfo.resetStatusOfEditingFunction();

    const procId = procModalElements.procID.val();
    const allColumnIds = currentProcDataCols.map((col) => col.id);
    FunctionInfo.getAllFunctionInfosApi(procId, allColumnIds)
        .then(FunctionInfo.loadFunctionListTableAndInitDropDown)
        .finally(loadingHide);

    deleteNewlyAddedFunctionColumnSampleData();
}

/**
 * Register change 'class' event for all elements in tbody of {@link functionConfigElements.functionTableElement()}.
 * Only handle for inject/remove sync input events.
 */
function syncInputConfigAndTable() {
    /** @type {Array.<{addEvent: function, removeEvent: function}>} **/
    let configAndTableEvents = [];

    const removeAllSyncEvents = () => configAndTableEvents.forEach((v) => v.removeEvent());
    const observer = new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.target.tagName.toLowerCase() === 'tr') {
                if (mutation.oldValue === 'selected') {
                    // remove old events
                    removeAllSyncEvents();
                } else if (mutation.target.classList.contains('selected')) {
                    const rowElement = mutation.target;
                    configAndTableEvents = [
                        // sync with reload
                        syncInputConfigAndTableEvents(
                            functionConfigElements.coeANSElement,
                            rowElement.querySelector('input[name="a_n_s"]'),
                            true,
                        ),
                        syncInputConfigAndTableEvents(
                            functionConfigElements.coeBKElement,
                            rowElement.querySelector('input[name="b_k"]'),
                            true,
                        ),
                        syncInputConfigAndTableEvents(
                            functionConfigElements.coeCTElement,
                            rowElement.querySelector('input[name="c_t"]'),
                            true,
                        ), // sync without reload
                        syncInputConfigAndTableEvents(
                            functionConfigElements.noteElement,
                            rowElement.querySelector('input[name="note"]'),
                            false,
                        ),
                        syncInputConfigAndTableEvents(
                            functionConfigElements.systemNameElement,
                            rowElement.querySelector('input[name="name_en"]'),
                            false,
                        ),
                        syncInputConfigAndTableEvents(
                            functionConfigElements.japaneseNameElement,
                            rowElement.querySelector('input[name="name_jp"]'),
                            false,
                        ),
                        syncInputConfigAndTableEvents(
                            functionConfigElements.localNameElement,
                            rowElement.querySelector('input[name="name_local"]'),
                            false,
                        ), // sync select dropdown
                        syncSelectConfigAndTableEvents(
                            functionConfigElements.varXElement,
                            rowElement.querySelector('td.column-var-x'),
                        ),
                        syncSelectConfigAndTableEvents(
                            functionConfigElements.varYElement,
                            rowElement.querySelector('td.column-var-y'),
                        ),
                    ];
                    // apply new events
                    configAndTableEvents.forEach((e) => e.addEvent());
                }
            }
        }
    });

    if (functionConfigElements.functionTableElement()?.lastElementChild == null) return removeAllSyncEvents;

    // only listen for class selected changes
    observer.observe(functionConfigElements.functionTableElement()?.lastElementChild, {
        subtree: true,
        attributeOldValue: true,
        attributeFilter: ['class'],
    });

    return removeAllSyncEvents;
}

/**
 * Collect all records in function sample data table to text
 * @return {string} - a string contains all records
 */
function collectFunctionSampleData() {
    // Extract table headers
    let headerText = [...functionConfigElements.sampleDataElement.querySelectorAll('thead tr th')]
        .map((cell) => cell.textContent.trim())
        .join(TAB_CHAR);

    // Extract table rows
    const bodyText = [...functionConfigElements.sampleDataElement.querySelectorAll('tbody tr')]
        .map((tr) => getTRDataValues(tr).join(TAB_CHAR))
        .join(NEW_LINE_CHAR);

    return [headerText, bodyText].join(NEW_LINE_CHAR);
}

/**
 * Show/hide data with format signifi
 */
function applySignifiDataHandler() {
    // get row of function column
    const functionColumnRows = functionConfigElements.functionTableElement().querySelectorAll('tbody tr');
    const sampleDataElements = Array.from(functionColumnRows).flatMap((row) =>
        Array.from(row.querySelectorAll('.column-sample-data')),
    );
    const previewSampleDataElements = [1, 2, 3].flatMap((colIndex) =>
        Array.from(functionConfigElements.sampleDataElement.querySelectorAll(`tbody tr td:nth-child(${colIndex})`)),
    );
    const formatElements = [...sampleDataElements, ...previewSampleDataElements];
    formatElements.forEach((row) => {
        const isNumber = row.getAttribute(IS_NUMBER_ATTR) === 'true';
        const originValue = row.getAttribute(DATA_ORIGINAL_ATTR);
        row.textContent = formatSignifiValue(originValue, isNumber);
    });
}

/**
 *  Format data with signifi
 * @param {string || number} value - origin value
 * @param {boolean} isNumber - check number or string
 */
const formatSignifiValue = (value, isNumber) => {
    const isApplySignifi = functionConfigElements.appySignifiCheckbox.checked;
    if (isNumber && value) {
        value = Number(value);
    }
    return (isApplySignifi ? applySignificantDigit(value) : value) ?? '';
};

/**
 * Download all records in function sample data table
 * @param {PointerEvent} event
 */
function downloadFunctionSampleDataHandler(event) {
    const text = collectFunctionSampleData();
    const processName = document.getElementById('processName').value.trim();
    const functionName =
        document.getElementById('functionName').querySelector('option:checked')?.innerHTML?.trim() ?? '';
    const systemName = functionConfigElements.systemNameElement.value.trim();
    const fileName = `${processName}_${functionName}_${systemName}_Result.tsv`;
    downloadText(fileName, text);
    showToastrMsg(document.getElementById('i18nStartedTSVDownload').textContent, MESSAGE_LEVEL.INFO);
}

/**
 * Copy all records in function sample data table
 * @param {PointerEvent} event
 */
function copyFunctionSampleDataHandler(event) {
    const text = collectFunctionSampleData();

    // Use the Clipboard API to write the HTML to the clipboard
    navigator.clipboard.writeText(text).then(showToastCopyToClipboardSuccessful, showToastCopyToClipboardFailed);
}

/**
 * Show or Hide Copy & Paste function config buttons base on secure context
 */
function showHideCopyPasteFunctionConfigButtons() {
    if (window.isSecureContext) {
        $(functionConfigElements.copySampleDataBtn).show();
        $(functionConfigElements.copyAllBtn).show();
        $(functionConfigElements.pasteAllBtn).show();
    } else {
        $(functionConfigElements.copySampleDataBtn).hide();
        $(functionConfigElements.copyAllBtn).hide();
        $(functionConfigElements.pasteAllBtn).hide();
    }
}

/**
 *  Reset function config default values if needed
 */
const functionConfigResetDefaultValues = () => {
    functionConfigElements.appySignifiCheckbox.checked = true;
};

/**
 *
 */
const updateCheckedFunctionColumn = () => {
    showTotalCheckedFunctionColumns(totalFunctionColumns(), totalCheckedFunctionColumns());
};

/**
 * @param {number} totalColumns
 * @param {number} totalCheckedColumn
 */
const showTotalCheckedFunctionColumns = (totalColumns, totalCheckedColumn) => {
    functionConfigElements.totalFunctionColumnsElement.textContent = String(totalColumns);
    functionConfigElements.totalCheckedFunctionColumnsElement.textContent = String(totalCheckedColumn);
    functionConfigElements.searchInput.textContent = '';
};

/**
 * @return {number}
 */
const totalCheckedFunctionColumns = () => {
    const totalChecked = _.filter(
        functionConfigElements.functionTableElement().querySelectorAll('tbody tr'),
        (tr) => tr.querySelector('td.column-is-checked input').checked,
    ).length;
    return Number.isNaN(totalChecked) ? 0 : totalChecked;
};

/**
 * @return {number}
 */
const totalFunctionColumns = () => {
    const totalColumns = functionConfigElements.functionTableElement().querySelectorAll('tbody tr').length;
    return Number.isNaN(totalColumns) ? 0 : totalColumns;
};

/**
 *
 */
(() => {
    // Add events to buttons
    $(functionConfigElements.functionNameElement).on('change', changeFunctionNameEvent);
    functionConfigElements.newBtn.addEventListener('click', showFunctionDetailsModal);
    functionConfigElements.copyBtn.addEventListener('click', showRegisteredFunctionsModal);
    functionConfigElements.setBtn.addEventListener('click', addOrUpdateFunctionInfo);
    functionConfigElements.deleteBtn.addEventListener('click', showDeleteFunctionConfirmation);
    // functionConfigElements.registerBtn.addEventListener(
    //     'click',
    //     registerFunctionInfo,
    // );
    functionConfigElements.downloadAllBtn.addEventListener('click', downloadAllFunctionInfo);
    functionConfigElements.copyAllBtn.addEventListener('click', copyAllFunctionInfo);
    functionConfigElements.pasteAllBtn.addEventListener('click', pasteAllFunctionInfo);
    functionConfigElements.searchInput.addEventListener('keyup', searchInputHandler);
    functionConfigElements.setFilterBtn.addEventListener('click', setFilterButtonHandler);
    functionConfigElements.resetBtn.addEventListener('click', resetButtonHandler);
    functionConfigElements.reloadBtn.addEventListener('click', reloadFunctionInfo);
    functionConfigElements.selectAllFunctionColumns.addEventListener('change', handleCheckAllFunctionColumns);
    functionConfigElements.selectErrorFunctionColumns.addEventListener('change', handleCheckErrorFunctionColumns);
    $(functionConfigElements.functionNameElement).on('change', handleChangeFunctionNameOrVarXY);
    $(functionConfigElements.varXElement).on('change', handleChangeFunctionNameOrVarXY);
    $(functionConfigElements.varYElement).on('change', handleChangeFunctionNameOrVarXY);
    functionConfigElements.outputElement.addEventListener('change', handleChangeFunctionOutput);
    functionConfigElements.coeANSElement.addEventListener(
        'change',
        handleChangeFunctionConfigCoeInput(SpreadSheetFunctionConfig.ColumnNames.CoeAns),
    );
    functionConfigElements.coeBKElement.addEventListener(
        'change',
        handleChangeFunctionConfigCoeInput(SpreadSheetFunctionConfig.ColumnNames.CoeBk),
    );
    functionConfigElements.coeCTElement.addEventListener(
        'change',
        handleChangeFunctionConfigCoeInput(SpreadSheetFunctionConfig.ColumnNames.CoeCt),
    );
    functionConfigElements.systemNameElement.addEventListener(
        'change',
        handleChangeFunctionConfigInput(SpreadSheetFunctionConfig.ColumnNames.SystemName),
    );
    functionConfigElements.japaneseNameElement.addEventListener(
        'change',
        handleChangeFunctionConfigInput(SpreadSheetFunctionConfig.ColumnNames.JapaneseName),
    );
    functionConfigElements.localNameElement.addEventListener(
        'change',
        handleChangeFunctionConfigInput(SpreadSheetFunctionConfig.ColumnNames.LocalName),
    );
    functionConfigElements.noteElement.addEventListener(
        'change',
        handleChangeFunctionConfigInput(SpreadSheetFunctionConfig.ColumnNames.Note),
    );
    functionConfigElements.searchFunctionNameInput.addEventListener('keyup', searchFunctionNameInputHandler);
    functionConfigElements.existFunctionSearchInput.addEventListener('keyup', searchExistFunctionInputHandler);
    functionConfigElements.downloadSampleDataBtn.addEventListener('click', downloadFunctionSampleDataHandler);
    functionConfigElements.appySignifiCheckbox.addEventListener('change', applySignifiDataHandler);
    functionConfigElements.copySampleDataBtn.addEventListener('click', copyFunctionSampleDataHandler);

    removeAllSyncEvents = syncInputConfigAndTable();
    showHideCopyPasteFunctionConfigButtons();
})();
