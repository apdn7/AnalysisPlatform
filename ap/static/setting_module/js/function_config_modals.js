/**
 * @file Contain all common functions to serve handling functions that relate to page.
 * @author Nguyen Huu Tuan <tuannh@fpt.com>
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Duong Quoc Khanh <khanhdq13@fpt.com>
 */

const SEPARATOR_CHAR = ',';
const DEFAULT_VALUE_PREFIX = 'default-value-';
const REQUIRED_VALUE_PREFIX = 'required-';
const TAB_CHAR = '\t';
const NEW_LINE_CHAR = '\n';
const BORDER_RED_CLASS = 'column-name-invalid';

const CLASSES_FUNCTION = 'sample-data show-raw-text';
const ARRAY_ANS = ['a', 'n', 's'];
const ARRAY_BK = ['b', 'k'];
const ARRAY_CT = ['c', 't'];
let /** @type {function(): void} */ removeAllSyncEvents;

const functionConfigElements = {
    /** @type HTMLSelectElement */
    functionSettingModal: document.getElementById('functionSettingModal'),
    /** @type HTMLSelectElement */
    functionNameElement: document.getElementById('functionName'),
    /** @type HTMLTableElement */
    functionDetailsElement: document.getElementById('functionDetails'),
    /** @type HTMLSpanElement */
    outputElement: document.querySelector('#functionOutput span'),
    /** @type HTMLInputElement */
    systemNameElement: document.querySelector(
        '#functionColumnSystemName input',
    ),
    /** @type HTMLInputElement */
    japaneseNameElement: document.querySelector(
        '#functionColumnJapaneseName input',
    ),
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
    coeANSElement: document.querySelector(
        '#functionCoeANS input[name="functionCoeANS"]',
    ),
    /** @type HTMLLabelElement */
    coeANSLabelElement: document.querySelector('#functionCoeANS label'),
    /** @type HTMLInputElement */
    coeBKElement: document.querySelector(
        '#functionCoeBK input[name="functionCoeBK"]',
    ),
    /** @type HTMLLabelElement */
    coeBKLabelElement: document.querySelector('#functionCoeBK label'),
    /** @type HTMLInputElement */
    coeCTElement: document.querySelector(
        '#functionCoeCT input[name="functionCoeCT"]',
    ),
    /** @type HTMLLabelElement */
    coeCTLabelElement: document.querySelector('#functionCoeCT label'),
    /** @type HTMLTextAreaElement */
    noteElement: document.querySelector('#functionNote textarea'),
    /** @type HTMLInputElement */
    xSampleDataLabel: document.querySelector(
        '#functionSampleData th[name="xSampleData"]',
    ),
    /** @type HTMLInputElement */
    helperMessageElement: document.getElementById('functionMessageHelper'),
    /** @type {HTMLTableElement & {result: string[]}} */
    sampleDataElement: document.getElementById('functionSampleData'),
    /** @type HTMLTableElement */
    functionTableElement: document.getElementById('functionTable'),
    /** @type HTMLSpanElement */
    totalCheckedFunctionColumnsElement: document.getElementById(
        'totalCheckedFunctionColumns',
    ),
    /** @type HTMLSpanElement */
    totalFunctionColumnsElement: document.getElementById(
        'totalFunctionColumns',
    ),
    /** @type HTMLSpanElement */
    functionUserSettingTableModal: document.getElementById(
        'functionUserSettingModal',
    ),
    /** @type HTMLSpanElement */
    functionUserSettingTableBody: document.querySelector(
        '#functionUserSettingModal table[id=functionUserSettingTable] tbody',
    ),
    /** @type HTMLInputElement */
    selectAllFunctionColumns: document.getElementById(
        'selectAllFunctionColumns',
    ),
    /** @type HTMLInputElement */
    selectErrorFunctionColumns: document.getElementById(
        'selectErrorFunctionColumns',
    ),
    /** @type HTMLDivElement */
    functionConfigConfirmSwitchEditingRowModal: document.getElementById(
        'functionConfigConfirmSwitchEditingRowModal',
    ),
    /**
     * In first load, i element will be changed to svg element
     * @type {function(): HTMLOrSVGElement}
     * */
    settingChangeMark: () =>
        document.getElementById('functionSettingChangeMark'),
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
    downloadAllBtn: document.getElementById(
        'functionConfigModalDownloadAllBtn',
    ),
    /** @type HTMLButtonElement */
    copyAllBtn: document.getElementById('functionConfigModalCopyAllBtn'),
    /** @type HTMLButtonElement */
    pasteAllBtn: document.getElementById('functionConfigModalPasteAllBtn'),
    /** @type HTMLButtonElement */
    downloadSampleDataBtn: document.getElementById(
        'downloadFunctionDataSampleBtn',
    ),
    /** @type HTMLButtonElement */
    copySampleDataBtn: document.getElementById('copyFunctionDataSampleBtn'),
    /** @type HTMLButtonElement */
    registerBtn: document.getElementById('functionConfigModalRegisterBtn'),
    /** @type HTMLButtonElement */
    reloadBtn: document.getElementById('reloadFunctionBtn'),
    /** @type HTMLAnchorElement */
    confirmSwitchEditingRow: document.getElementById('confirmSwitchEditingRow'),
    /** @type HTMLInputElement */
    searchFunctionNameInput: document.getElementById(
        'functionSearchFunctionNameInput',
    ),
    functionNameTableElement: document.getElementById('functionNameDetails'),
    existFunctionSearchInput: document.getElementById(
        'existFunctionSearchInput',
    ),
    functionUserSettingTableElement: document.getElementById(
        'functionUserSettingTable',
    ),
    /** @type HTMLInputElement */
    deleteFunctionColumnTableBody: document.getElementById(
        'deleteFunctionColumn',
    ),
    deleteFunctionColumnTableElement: document.getElementById(
        'deleteFunctionColumnTable',
    ),
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
 * @property {?number|string} varX - id of X column
 * @property {?number|string} varY - id of Y column
 * @property {?number|string} index - row Index in Function Table
 */
class FunctionInfo {
    /**
     * New process column id. That will be decrease for each time be called
     * @type {number}
     */
    static #newProcessColumnId = -1;
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
     * @param {{
     *    functionName: string,
     *    output: string,
     *    systemName: string,
     *    japaneseName: string,
     *    localName: string,
     *    varXName: string,
     *    varYName: string,
     *    coeANS: string,
     *    coeBK: string,
     *    coeCT: string,
     *    note: string,
     *    sampleDatas: string[],
     *    isChecked: ?boolean,
     *    processColumnId: ?number|string,
     *    functionColumnId: ?number|string,
     *    functionId: ?number|string,
     *    varX: ?number|string,
     *    varY: ?number|string,
     *    index: ?number|string,
     * }} functionInfo - function information
     * @constructor
     */
    constructor(functionInfo = {}) {
        const {
            functionName = '',
            output = '',
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
        } = functionInfo;

        this.functionName = functionName;
        this.output = output;
        this.systemName = systemName;
        this.japaneseName = japaneseName;
        this.localName = localName;
        this.varXName = varXName;
        this.varYName = varYName;
        this.coeANS = coeANS;
        this.coeBK = coeBK;
        this.coeCT = coeCT;
        this.note = note;
        this.sampleDatas = sampleDatas;
        this.isChecked = isChecked;
        this.isMeFunction = functionName.startsWith('me.');
        /** @type ?number */
        this.processColumnId = !(
            isNaN(processColumnId) ||
            processColumnId == null ||
            processColumnId === ''
        )
            ? parseInt(processColumnId, 10)
            : null;
        /** @type ?number */
        this.functionColumnId = !(
            isNaN(functionColumnId) ||
            functionColumnId == null ||
            functionColumnId === ''
        )
            ? parseInt(functionColumnId, 10)
            : null;
        /** @type ?number */
        this.functionId = !(
            isNaN(functionId) ||
            functionId == null ||
            functionId === ''
        )
            ? parseInt(functionId, 10)
            : null;
        /** @type ?number */
        this.varX = !(isNaN(varX) || varX == null || varX === '')
            ? parseInt(varX, 10)
            : null;
        /** @type ?number */
        this.varY = !(isNaN(varY) || varY == null || varY === '')
            ? parseInt(varY, 10)
            : null;
        /** @type ?number */
        this.index = !(isNaN(index) || index == null || index === '')
            ? parseInt(index, 10)
            : null;

        this.shownName = isJPLocale
            ? this.japaneseName
            : this.localName || this.systemName;
    }

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

                const numberStr = val.includes('.')
                    ? parseFloat(val)
                    : parseInt(val);
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
        const functionIsEmpty =
            this.functionId == null || isNaN(this.functionId);
        const outputIsEmpty = this.output === '';
        const nameIsEmpty =
            this.systemName == '' &&
            this.japaneseName === '' &&
            this.localName === '';
        const varXIsEmpty = this.varX == null || isNaN(this.varX);
        const varYIsEmpty = this.varY == null || isNaN(this.varY);
        const coeIsEmpty =
            this.coeANS === '' && this.coeBK === '' && this.coeCT == '';
        const noteIsEmpty = this.note === '';
        return (
            functionIsEmpty &&
            outputIsEmpty &&
            nameIsEmpty &&
            varXIsEmpty &&
            varYIsEmpty &&
            coeIsEmpty &&
            noteIsEmpty
        );
    }

    /**
     * Compare this function object is equal to input function object
     * @param {FunctionInfo} functionInfo - an input function object
     * @return {boolean} true is equal, otherwise
     */
    isEqual(functionInfo) {
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
            this.varX === functionInfo.varX &&
            this.varY === functionInfo.varY
        );
    }

    /**
     * Collect all input data of function
     * @return {FunctionInfo} - a dictionary that contain function information
     */
    static collectInputFunctionInfo() {
        const index =
            functionConfigElements.functionNameElement.dataset.index ?? '';
        let processColumnId =
            functionConfigElements.functionNameElement.dataset
                .processColumnId ?? '';
        const functionColumnId =
            functionConfigElements.functionNameElement.dataset
                .functionColumnId ?? '';
        const dataType =
            functionConfigElements.functionNameElement.dataset.dataType ?? '';
        const selectedFunctionElement =
            functionConfigElements.functionNameElement.querySelector(
                'option:checked',
            );
        let [functionId, functionName] = ['', ''];
        if (selectedFunctionElement != null) {
            functionId = selectedFunctionElement.value.trim();
            functionName = selectedFunctionElement.textContent.trim();
        }

        const [, output] = FunctionInfo.getOutputDataType();
        const systemName =
            functionConfigElements.systemNameElement.value.trim();
        const japaneseName =
            functionConfigElements.japaneseNameElement.value.trim();
        const localName = functionConfigElements.localNameElement.value.trim();

        const selectedVarXElement =
            functionConfigElements.varXElement.querySelector('option:checked');
        let varX;
        let varXName;
        if (selectedVarXElement == null) {
            varX = null;
            varXName = '';
        } else {
            varX = selectedVarXElement.value.trim();
            varXName = selectedVarXElement.textContent.trim();
            if (functionName.startsWith('me.')) {
                // In case of function me, process id will be id of varX
                processColumnId = varX;
            }
        }

        const selectedVarYElement =
            functionConfigElements.varYElement.querySelector('option:checked');
        let varY;
        let varYName;
        if (selectedVarYElement == null) {
            varY = null;
            varYName = '';
        } else {
            varY = selectedVarYElement.value.trim();
            varYName = selectedVarYElement.textContent.trim();
        }

        const coeANS = functionConfigElements.coeANSElement.value.trim();
        const coeBK = functionConfigElements.coeBKElement.value.trim();
        const coeCT = functionConfigElements.coeCTElement.value.trim();
        const note = functionConfigElements.noteElement.value.trim();

        const sampleDatas = (
            functionConfigElements.sampleDataElement.result ?? []
        ).map((element) => String(element ?? '').trim());

        return new FunctionInfo({
            functionName,
            output,
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
     * Collect information of a function row
     * @param {HTMLTableRowElement} rowElement - a function info row
     * @return {FunctionInfo} a function info object
     */
    static collectFunctionInfoByRow(rowElement) {
        const index = rowElement.dataset.index;
        const columnFunctionName = rowElement.querySelector(
            `td.column-function-name`,
        );
        const processColumnId = columnFunctionName.dataset.processColumnId;
        const functionColumnId = columnFunctionName.dataset.functionColumnId;
        const functionId = columnFunctionName.dataset.functionId;
        const functionName = columnFunctionName
            .querySelector('label')
            .textContent.trim();
        const isChecked = columnFunctionName.querySelector('input').checked;
        const systemName = rowElement
            .querySelector(`td.column-system-name input`)
            .value.trim();
        const japaneseName = rowElement
            .querySelector(`td.column-japanese-name input`)
            .value.trim();
        const localName = rowElement
            .querySelector(`td.column-local-name input`)
            .value.trim();
        const columnVarX = rowElement.querySelector(`td.column-var-x`);
        const varXName = columnVarX.textContent.trim();
        const varX = columnVarX.dataset.varX;
        const columnVarY = rowElement.querySelector(`td.column-var-y`);
        const varYName = columnVarY.textContent.trim();
        const varY = columnVarY.dataset.varY;
        const coeANS = rowElement
            .querySelector('td.column-coe-ans input')
            .value.trim();
        const coeBK = rowElement
            .querySelector('td.column-coe-bk input')
            .value.trim();
        const coeCT = rowElement
            .querySelector('td.column-coe-ct input')
            .value.trim();
        const note = rowElement
            .querySelector('td.column-note input')
            .value.trim();
        const output =
            rowElement.querySelector(`td.column-output`).dataset.rawDataType;
        const sampleDatas = [
            ...rowElement.querySelectorAll('td.column-sample-data'),
        ].map((cell) => cell.textContent.trim());

        return new FunctionInfo({
            functionName,
            output,
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
            isChecked,
            processColumnId,
            functionColumnId,
            functionId,
            varX,
            varY,
            index,
        });
    }

    /**
     * Fill inputs of function info
     */
    fillInputFunctionInfo() {
        functionConfigElements.functionNameElement.dataset.index =
            this.index ?? '';
        functionConfigElements.functionNameElement.dataset.processColumnId =
            this.processColumnId ?? '';
        functionConfigElements.functionNameElement.dataset.functionColumnId =
            this.functionColumnId ?? '';
        functionConfigElements.functionNameElement.dataset.dataType =
            this.dataType ?? '';
        functionConfigElements.functionNameElement.value = String(
            this.functionId,
        );
        $(functionConfigElements.functionNameElement).change();
        FunctionInfo.setOutputDataType(this.output);
        functionConfigElements.systemNameElement.value = this.systemName;
        functionConfigElements.japaneseNameElement.value = this.japaneseName;
        functionConfigElements.localNameElement.value = this.localName;
        functionConfigElements.varXElement.value = String(this.varX);
        $(functionConfigElements.varXElement).change();
        functionConfigElements.varYElement.value = String(this.varY);
        $(functionConfigElements.varYElement).change();
        functionConfigElements.coeANSElement.value = String(this.coeANS);
        functionConfigElements.coeBKElement.value = String(this.coeBK);
        functionConfigElements.coeCTElement.value = String(this.coeCT);
        functionConfigElements.noteElement.value = String(this.note);
    }

    /**
     * Reset invalid status, use the whole functionConfigs if no element is specified
     * @param {HTMLElement | null } element
     */
    static resetInvalidStatus(element = null) {
        const ele = element ?? functionConfigElements.functionSettingModal;
        ele.querySelectorAll(`.${BORDER_RED_CLASS}`).forEach(
            FunctionInfo.removeInvalidStatus,
        );
    }

    /**
     * Remove invalid status for single element
     * @param {HTMLElement} element
     */
    static removeInvalidStatus(element) {
        // TODO: remove invalid status for both jquery and html element
        element.classList.remove(BORDER_RED_CLASS);
    }

    /**
     * Set invalid status for single element
     * @param {HTMLElement} element
     */
    static setInvalidStatus(element) {
        // TODO: set invalid status for both jquery and html element
        element.classList.add(BORDER_RED_CLASS);
    }

    /**
     * Check invalid status for single element
     * @param {HTMLElement} element
     * @return boolean
     */
    static isInvalidStatus(element) {
        // TODO: check invalid status for both jquery and html element
        return element.classList.contains(BORDER_RED_CLASS);
    }

    static clearFunctionOutput() {
        FunctionInfo.clearOutputDatatype();
        FunctionInfo.clearSampleData();
    }

    static clearOutputDatatype() {
        const defaultOutputDatatype = $(
            functionConfigElements.functionNameElement,
        )
            .find(':selected')
            .attr('output-data-type');
        FunctionInfo.setOutputDataType(defaultOutputDatatype);
    }

    static clearSampleData() {
        functionConfigElements.sampleDataElement.lastElementChild
            .querySelectorAll('td:first-child')
            .forEach((td) => (td.textContent = ''));
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
            previousRowElement.classList.remove('selected');
        }

        rowElement.classList.add('selected');
        const functionInfo = FunctionInfo.collectFunctionInfoByRow(rowElement);
        functionInfo.fillInputFunctionInfo();
        FunctionInfo.resetInvalidStatus();
        FunctionInfo.hideChangeMark();

        // reset flag to allow call api to calculate sample data
        setTimeout(() => {
            showResultFunction.disabled = false;
        }, 50);
    }

    /**
     * Fill sample data to selected function row
     * @param {string[]} sampleData - a list of data
     */
    static fillSampleDataToSelectedFunctionRow(sampleData) {
        const selectedRow =
            functionConfigElements.functionTableElement.lastElementChild.querySelector(
                'tr.selected',
            );
        if (!selectedRow) {
            return;
        }

        const tableSampleDataNodes = selectedRow.querySelectorAll(
            'td.column-sample-data ',
        );
        tableSampleDataNodes.forEach((node, index) => {
            node.innerHTML = sampleData[index] ?? '';
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
        const selectedRowElement =
            rowElement.parentElement.querySelector('tr.selected');
        if (selectedRowElement === rowElement) {
            // in case re-select row, do nothing
        } else if (selectedRowElement != null) {
            // in case exist selected row
            const inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();
            const selectedFunctionInfo =
                FunctionInfo.collectFunctionInfoByRow(selectedRowElement);
            if (inputFunctionInfo.isEqual(selectedFunctionInfo)) {
                // in case of nothing change
                FunctionInfo.selectRowHandler(rowElement, selectedRowElement);
                return;
            }

            // show confirmation dialog to change editing other row
            functionConfigElements.confirmSwitchEditingRow.dataset.index =
                rowElement.dataset.index;
            functionConfigElements.confirmSwitchEditingRow.dataset.previousIndex =
                selectedRowElement.dataset.index;
            $(
                functionConfigElements.functionConfigConfirmSwitchEditingRowModal,
            ).modal('show');
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
        targetRow.setAttribute(
            'checked',
            checkBoxElement.checked ? 'checked' : '',
        );

        // Set number of checked records
        let totalCheckedColumns = parseInt(
            functionConfigElements.totalCheckedFunctionColumnsElement
                .textContent,
            10,
        );
        totalCheckedColumns = checkBoxElement.checked
            ? totalCheckedColumns + 1
            : totalCheckedColumns - 1;
        functionConfigElements.totalCheckedFunctionColumnsElement.textContent =
            String(totalCheckedColumns);

        const totalColumns = parseInt(
            functionConfigElements.totalFunctionColumnsElement.textContent,
            10,
        );

        // Set status of all selected checkbox
        functionConfigElements.selectAllFunctionColumns.checked =
            totalColumns === totalCheckedColumns;
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
                    ...functionConfigElements.functionTableElement.lastElementChild.querySelectorAll(
                        '.row-invalid, .column-name-invalid',
                    ),
                ].map((invalidTarget) =>
                    invalidTarget instanceof HTMLTableRowElement
                        ? invalidTarget
                        : invalidTarget.closest('tr'),
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
        const invalidCheckedRows = invalidRows.filter(
            (r) => r.querySelector('input[name="columnName"]').checked,
        );
        const allCheckedRows =
            functionConfigElements.functionTableElement.lastElementChild.querySelectorAll(
                'input[name="columnName"]:checked',
            );
        functionConfigElements.selectErrorFunctionColumns.checked =
            invalidRows.length === invalidCheckedRows.length &&
            invalidRows.length !== 0 &&
            allCheckedRows.length === invalidCheckedRows.length;
    }

    /**
     * Add a new row into Function table
     */
    addNewFunctionRow() {
        const { hasANS, hasBK, hasCT } = FunctionInfo.hasParams(
            this.functionId,
        );
        const index = this.index;
        const newSampleData = this.sampleDatas;

        const newRowHtml =
            `<tr data-index="${index}" checked="${this.isChecked ? 'checked' : ''}">` +
            `<td class="column-order text-center show-raw-text row-item" data-column-title="index">${index}</td>` +
            '<td class="column-function-name show-raw-text" data-column-title="is_checked"' +
            ` data-process-column-id="${this.processColumnId ?? ''}"` +
            ` data-function-column-id="${this.functionColumnId ?? ''}"` +
            ` data-function-id="${this.functionId ?? ''}">` +
            '<div class="custom-control custom-checkbox">' +
            '<input type="checkbox" class="check-item custom-control-input col-checkbox already-convert-hankaku"' +
            ` name="columnName" id="checkbox-column-${index}" ${this.isChecked ? 'checked' : ''}>` +
            `<label class="custom-control-label row-item for-search" for="checkbox-column-${index}"` +
            ` >${this.functionName ?? ''}</label>` +
            '</div>' +
            '</td>' +
            `<td class="column-system-name row-item" data-column-title="name_en">` +
            `<input type="text" name="name_en" class="form-control row-item" value="${this.systemName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>` +
            '</td>' +
            '<td class="column-japanese-name row-item" data-column-title="name_jp">' +
            `<input type="text" name="name_jp" class="form-control row-item" value="${this.japaneseName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>` +
            '</td>' +
            '<td class="column-local-name row-item" data-column-title="name_local">' +
            `<input type="text" name="name_local" class="form-control row-item" value="${this.localName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>` +
            '</td>' +
            `<td class="column-var-x row-item show-raw-text" data-column-title="x" data-var-x="${this.varX ?? ''}">${this.varXName ?? ''}</td>` +
            `<td class="column-var-y row-item show-raw-text" data-column-title="y" data-var-y="${this.varY ?? ''}">${this.varYName ?? ''}</td>` +
            `<td class="column-coe-ans row-item" data-column-title="a_n_s">` +
            `<input type="text" name="a_n_s" class="form-control row-item" value="${this.coeANS ?? ''}" ${!hasANS ? 'disabled' : ''}>` +
            '</td>' +
            `<td class="column-coe-bk row-item" data-column-title="b_k">` +
            `<input type="text" name="b_k" class="form-control row-item" value="${this.coeBK ?? ''}" ${!hasBK ? 'disabled' : ''}>` +
            '</td>' +
            `<td class="column-coe-ct row-item" data-column-title="c_t">` +
            `<input type="text" name="c_t" class="form-control row-item" value="${this.coeCT ?? ''}" ${!hasCT ? 'disabled' : ''}>` +
            '</td>' +
            `<td class="column-note row-item" data-column-title="note">` +
            `<input type="text" name="note" class="form-control row-item" value="${this.note ?? ''}">` +
            '</td>' +
            `<td class="column-output row-item show-raw-text" data-column-title="output" data-raw-data-type="${this.output ?? ''}">${FunctionInfo.getLabelRawDataType(this.output ?? '')}</td>` +
            `<td class="column-sample-data row-item show-raw-text" data-column-title="sample_data">${newSampleData[0] ?? ''}</td>` +
            `<td class="column-sample-data row-item show-raw-text" data-column-title="sample_data">${newSampleData[1] ?? ''}</td>` +
            `<td class="column-sample-data row-item show-raw-text" data-column-title="sample_data">${newSampleData[2] ?? ''}</td>` +
            `<td class="column-sample-data row-item show-raw-text" data-column-title="sample_data">${newSampleData[3] ?? ''}</td>` +
            `<td class="column-sample-data row-item show-raw-text" data-column-title="sample_data">${newSampleData[4] ?? ''}</td>` +
            '</tr>';

        /** @type HTMLTableRowElement */
        const rowElement = htmlToElement(newRowHtml);
        rowElement.addEventListener('click', FunctionInfo.rowClickEvent);
        rowElement
            .querySelector('input[name="columnName"]')
            .addEventListener(
                'change',
                FunctionInfo.changeSelectionStatusEvent,
            );
        rowElement
            .querySelectorAll('td')
            .forEach((cell) =>
                cell.addEventListener(
                    'mouseover',
                    FunctionInfo.hoverTableCellEvent,
                ),
            );

        functionConfigElements.functionTableElement.lastElementChild.append(
            rowElement,
        );

        // Set number of total records
        const totalColumns = parseInt(
            functionConfigElements.totalFunctionColumnsElement.textContent,
            10,
        );
        functionConfigElements.totalFunctionColumnsElement.textContent = String(
            totalColumns + 1,
        );

        //Update prc PreviewDataOfFunctionColumn
        prcPreviewDataOfFunctionColumn[this.processColumnId] = this.sampleDatas;

        // Trigger change event
        if (this.isChecked) {
            setTimeout(() => {
                rowElement
                    .querySelector('input[name="columnName"]')
                    .dispatchEvent(new Event('change'));
            });
        }
    }

    /**
     * Update a function row into Function table
     */
    updateFunctionRow() {
        const { hasANS, hasBK, hasCT } = FunctionInfo.hasParams(
            this.functionId,
        );
        const rowElement =
            functionConfigElements.functionTableElement.lastElementChild.querySelector(
                `tr[data-index="${this.index}"]`,
            );
        const columnFunctionName = rowElement.querySelector(
            `td.column-function-name`,
        );
        columnFunctionName.dataset.processColumnId = this.processColumnId;
        columnFunctionName.dataset.functionColumnId = this.functionColumnId;
        columnFunctionName.dataset.functionId = this.functionId;
        columnFunctionName.querySelector('label').textContent =
            this.functionName;

        rowElement.querySelector('td.column-system-name input').value =
            this.systemName;
        rowElement.querySelector('td.column-japanese-name input').value =
            this.japaneseName;
        rowElement.querySelector('td.column-local-name input').value =
            this.localName;

        const columnVarX = rowElement.querySelector(`td.column-var-x`);
        columnVarX.dataset.varX = this.varX;
        columnVarX.textContent = this.varXName;
        const columnVarY = rowElement.querySelector(`td.column-var-y`);
        columnVarY.dataset.varY = this.varY;
        columnVarY.textContent = this.varYName;

        const inputANS = rowElement.querySelector(`td.column-coe-ans input`);
        inputANS.disabled = !hasANS;
        inputANS.value = this.coeANS;

        const inputBK = rowElement.querySelector(`td.column-coe-bk input`);
        inputBK.disabled = !hasBK;
        inputBK.value = this.coeBK;

        const inputCT = rowElement.querySelector(`td.column-coe-ct input`);
        inputCT.disabled = !hasCT;
        inputCT.value = this.coeCT;

        rowElement.querySelector(`td.column-note input`).value = this.note;
        const columnOutput = rowElement.querySelector(`td.column-output`);
        columnOutput.dataset.rawDataType = this.output;
        columnOutput.textContent = FunctionInfo.getLabelRawDataType(
            this.output,
        );

        /** @type {NodeListOf<HTMLTableCellElement>} */
        const sampleCells = rowElement.querySelectorAll(
            `td.column-sample-data`,
        );

        sampleCells.forEach((cell, index) => {
            console.log('this.sampleDatas[index]', this.sampleDatas[index]);
            if (this.sampleDatas[index]) {
                cell.textContent = this.sampleDatas[index];
            } else {
                cell.textContent = '';
            }
        });

        // this.sampleDatas.forEach((data, index) => {
        //     if(sampleCells[index]) {
        //         sampleCells[index].textContent = data
        //     }
        // });

        // update prc PreviewDataOfFunctionColumn
        prcPreviewDataOfFunctionColumn[this.processColumnId] = this.sampleDatas;
    }

    /**
     * Remove a function row on table
     * @param {HTMLTableRowElement} rowElement - a function row HTML
     */
    static deleteFunctionRow(rowElement) {
        // Remove all events
        rowElement.removeEventListener('click', FunctionInfo.rowClickEvent);
        const checkboxElement = rowElement.querySelector(
            'input[name="columnName"]',
        );
        checkboxElement.removeEventListener(
            'change',
            FunctionInfo.changeSelectionStatusEvent,
        );
        const processColumnId = rowElement.querySelector(
            `td.column-function-name`,
        ).dataset.processColumnId;

        // Update number of checked records and total records
        const totalColumns =
            parseInt(
                functionConfigElements.totalFunctionColumnsElement.textContent,
                10,
            ) - 1;
        functionConfigElements.totalFunctionColumnsElement.textContent = String(
            totalColumns < 0 ? 0 : totalColumns,
        );
        if (checkboxElement.checked) {
            const selectedColumns =
                parseInt(
                    functionConfigElements.totalCheckedFunctionColumnsElement
                        .textContent,
                    10,
                ) - 1;
            functionConfigElements.totalCheckedFunctionColumnsElement.textContent =
                String(selectedColumns < 0 ? 0 : selectedColumns);
        }

        // Update status of checkbox
        if (
            (functionConfigElements.selectAllFunctionColumns.checked &&
                functionConfigElements.totalCheckedFunctionColumnsElement
                    .textContent !==
                    functionConfigElements.totalFunctionColumnsElement
                        .textContent) ||
            functionConfigElements.totalFunctionColumnsElement.textContent.trim() ===
                '0'
        ) {
            functionConfigElements.selectAllFunctionColumns.checked = false;
        }

        if (rowElement.classList.contains('selected')) {
            FunctionInfo.resetStatusOfEditingFunction(rowElement);
        }

        // Remove in X & Y select boxes
        [
            functionConfigElements.varXElement,
            functionConfigElements.varYElement,
        ].forEach((selectElement) => {
            const isTargetOption =
                String(selectElement.value) === String(processColumnId);
            $(selectElement)
                .find(`option[value="${processColumnId}"]`)
                .remove();
            if (isTargetOption) {
                $(selectElement).val('').change();
            }
        });

        // Remove row
        rowElement.remove();
    }

    /**
     * Get params info of function
     * @param {number} functionId - function Id
     * @return {{hasANS: boolean, hasBK: boolean, hasCT: boolean}}
     */
    static hasParams(functionId) {
        const funcDef = allMasterFunction.find(
            (func) => func.id === functionId,
        );
        const hasANS = ARRAY_ANS.some((c) => funcDef.coefs.includes(c));
        const hasBK = ARRAY_BK.some((c) => funcDef.coefs.includes(c));
        const hasCT = ARRAY_CT.some((c) => funcDef.coefs.includes(c));
        return { hasANS, hasBK, hasCT };
    }

    /**
     * Collect all function info in table
     * @param {boolean} isCollectOnlyCheckedRows - true: collect only checked rows, otherwise
     * @return {FunctionInfo[]} - a list of FunctionInfo objects
     */
    static collectAllFunctionRows(isCollectOnlyCheckedRows = false) {
        const result = [];
        [
            ...functionConfigElements.functionTableElement.lastElementChild
                .children,
        ].forEach((row) => {
            const functionInfo = FunctionInfo.collectFunctionInfoByRow(row);
            if (!isCollectOnlyCheckedRows || functionInfo.isChecked) {
                result.push(functionInfo);
            }
        });

        return result;
    }

    /**
     * Call api to backend to get all function infos of target process
     * @param {number|string} processId - a process id
     * @param {number[]} colIds - a list of column ids
     * @return {Promise<{
     *    functionName: string,
     *    output: string,
     *    systemName: string,
     *    japaneseName: string,
     *    localName: string,
     *    varXName: string,
     *    varYName: string,
     *    a: string,
     *    b: string,
     *    c: string,
     *    n: string,
     *    k: string,
     *    s: string,
     *    t: string,
     *    note: string,
     *    sampleDatas: string[],
     *    isChecked: ?boolean,
     *    processColumnId: ?number|string,
     *    functionColumnId: ?number|string,
     *    functionId: ?number|string,
     *    varX: ?number|string,
     *    varY: ?number|string,
     *    index: ?number|string,
     *    dataType: ?number|string,
     *    coeANS: string,
     *    coeBK: string,
     *    coeCT: string,
     * }[]>} - A response object
     */
    static getAllFunctionInfosApi(processId, colIds) {
        const dictSampleData = {};
        for (const colId of colIds) {
            dictSampleData[colId] =
                prcPreviewDataOfFunctionColumn[colId] ||
                prcPreviewWith1000Data[colId];
        }
        return fetch('/ap/api/setting/function_config/get_function_infos', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                process_id: parseInt(processId, 10),
                dic_sample_data: dictSampleData,
            }),
        })
            .then((response) => response.clone().json())
            .then((/** @type {{functionData: {}}} */ responseData) =>
                responseData.functionData?.map((funcData) => {
                    // add functionInfo data to prc-PreviewDataOfFunctionColumn with a key is functionColumnId
                    const { processColumnId, sampleDatas } = funcData;
                    prcPreviewDataOfFunctionColumn[processColumnId] =
                        sampleDatas;

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
     * @param {Array.<Object>} functionData - list of functionData objects from functionInfosAPI
     */
    static loadFunctionListTableAndInitDropDown(functionData) {
        functionData
            ?.map((data) => new FunctionInfo(data))
            ?.forEach((functionInfo) => functionInfo.addNewFunctionRow());
        FunctionInfo.initDropdownFunctionName();
    }

    /**
     * Remove all rows of Function table
     */
    static removeAllFunctionRows() {
        [
            ...functionConfigElements.functionTableElement.lastElementChild
                .children,
        ].forEach(
            /**
             * Remove event listener and row
             * @param {HTMLTableRowElement} row - a function row HTML
             */
            (row) => FunctionInfo.deleteFunctionRow(row),
        );
    }

    /**
     * Show icon function changes
     */
    static showChangeMark() {
        if (
            functionConfigElements
                .settingChangeMark()
                .classList.contains('d-none')
        ) {
            functionConfigElements
                .settingChangeMark()
                .classList.remove('d-none');
        }
    }

    /**
     * Hide icon function changes
     */
    static hideChangeMark() {
        if (
            !functionConfigElements
                .settingChangeMark()
                .classList.contains('d-none')
        ) {
            functionConfigElements.settingChangeMark().classList.add('d-none');
        }
    }

    /**
     * Reset all status, input, selection of Input Function Area
     * @param {boolean} isResetFuncName - is Reset Function Name or not
     * @param {boolean} isResetRowCount - is Reset Row Count or not
     */
    static resetInputFunctionInfo(
        isResetFuncName = true,
        isResetRowCount = true,
    ) {
        if (isResetRowCount) {
            functionConfigElements.selectAllFunctionColumns.checked = false;
            functionConfigElements.selectErrorFunctionColumns.checked = false;
            functionConfigElements.totalCheckedFunctionColumnsElement.textContent =
                String(0);
            functionConfigElements.totalFunctionColumnsElement.textContent =
                String(0);
        }
        $(functionConfigElements.functionNameElement).val('').change();

        // reset previous all invalid status
        FunctionInfo.resetInvalidStatus();

        if (isResetFuncName) {
            [...functionConfigElements.functionNameElement.children].forEach(
                (option) => option.remove(),
            );
            $(functionConfigElements.functionNameElement).empty();
        }
        functionConfigElements.functionNameElement.dataset.index = '';
        functionConfigElements.functionNameElement.dataset.processColumnId = '';
        functionConfigElements.functionNameElement.dataset.functionColumnId =
            '';
        functionConfigElements.functionNameElement.dataset.dataType = '';
        FunctionInfo.setOutputDataType('');
        functionConfigElements.systemNameElement.value = '';
        functionConfigElements.systemNameElement.dataset.originGeneratedName =
            '';
        functionConfigElements.japaneseNameElement.value = '';
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName =
            '';
        functionConfigElements.localNameElement.value = '';
        functionConfigElements.localNameElement.dataset.originGeneratedName =
            '';

        $(functionConfigElements.varXElement).val('').change();
        $(functionConfigElements.varYElement).val('').change();
        [...functionConfigElements.varXElement.children].forEach((option) =>
            option.remove(),
        );
        [...functionConfigElements.varYElement.children].forEach((option) =>
            option.remove(),
        );
        functionConfigElements.coeANSElement.value = '';
        functionConfigElements.coeANSElement.required = false;
        functionConfigElements.coeBKElement.value = '';
        functionConfigElements.coeBKElement.required = false;
        functionConfigElements.coeCTElement.value = '';
        functionConfigElements.coeCTElement.required = false;
        functionConfigElements.noteElement.value = '';
        functionConfigElements.sampleDataElement.lastElementChild
            .querySelectorAll('td')
            .forEach((td) => (td.textContent = ''));

        $(functionConfigElements.varXElement).empty();
        $(functionConfigElements.varYElement).empty();
        FunctionInfo.hideChangeMark();
    }

    /**
     * Reset all inputs and select row
     * @param {?HTMLTableRowElement=} selectedRow - a selected row HTML
     */
    static resetStatusOfEditingFunction(selectedRow = null) {
        removeAllSyncEvents();
        FunctionInfo.resetInputFunctionInfo(false, false);
        if (selectedRow == null) {
            selectedRow =
                functionConfigElements.functionTableElement.lastElementChild.querySelector(
                    'tr.selected',
                );
        }

        if (selectedRow != null) {
            selectedRow.classList.remove('selected');
        }
    }

    /**
     * Initialize select2 for selection of VarX/VarY
     * @param {HTMLOptionElement} selectedFunction - a selected option of Function
     */
    static initDropdownVarXY(selectedFunction) {
        const showSerial =
            selectedFunction.getAttribute('show-serial') === 'true';

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
            columnId,
            columnRawDataType,
            $varElement,
            supportTypes,
            newOption,
            keySelectedValue,
        ) => {
            const $existOption = $varElement.find(
                `option[value="${columnId}"]`,
            );
            if (
                supportTypes.includes(columnRawDataType) &&
                $existOption.length === 0
            ) {
                $varElement.append($('<option/>', newOption));
            } else if (
                !supportTypes.includes(columnRawDataType) &&
                $existOption.length > 0
            ) {
                $existOption.remove();
                if (columnId === selectedValue[keySelectedValue]) {
                    selectedValue[keySelectedValue] = '';
                }
            }
        };

        const removeOptions = (columnId, $varElement) => {
            $varElement.find(`option[value="${columnId}"]`).remove();
        };

        const normalColumns = currentProcDataCols.filter((col) => {
            const shouldSkipSerial = !showSerial && col.is_serial_no;
            return !shouldSkipSerial;
        });

        // remove previously added ignored columns
        const ignoreNormalColumns = currentProcDataCols.filter(
            (col) => !showSerial && col.is_serial_no,
        );

        ignoreNormalColumns.forEach((c) => {
            removeOptions(c.id, $varXElement);
            removeOptions(c.id, $varYElement);
        });

        const allFunctionInfos = FunctionInfo.collectAllFunctionRows();

        // if we are editing a row, we must exclude self and parents
        const ignoreFunctionColumns = [];
        const selectedRow =
            functionConfigElements.functionTableElement.lastElementChild.querySelector(
                'tr.selected',
            );
        if (selectedRow) {
            const selectedFunctionInfo =
                FunctionInfo.collectFunctionInfoByRow(selectedRow);
            ignoreFunctionColumns.push(selectedFunctionInfo.functionColumnId);
        }

        // remove all ignored function columns
        ignoreFunctionColumns.forEach((columnId) => {
            removeOptions(columnId, $varXElement);
            removeOptions(columnId, $varYElement);
        });

        const functionColumns = allFunctionInfos
            .filter(
                (col) => !ignoreFunctionColumns.includes(col.functionColumnId),
            )
            .map((col) => {
                return {
                    id: col.processColumnId,
                    column_raw_name: col.systemName,
                    raw_data_type: col.output,
                    data_type: col.output,
                    column_type: masterDataGroup.GENERATED_EQUATION,
                    name_en: col.systemName,
                    name_jp: col.japaneseName,
                    name_local: col.localName,
                    shown_name: col.shownName,
                };
            });

        [...normalColumns, ...functionColumns].forEach((col) => {
            const options = {
                value: col.id,
                text: col.shown_name || col.column_raw_name,
                'raw-data-type': col.data_type,
                'column-type': col.column_type,
                'name-sys': col.name_en,
                'name-jp': col.name_jp || '',
                'name-local': col.name_local || '',
                title: col.name_en || '',
            };

            updateOptions(
                col.id,
                col.data_type,
                $varXElement,
                xTypes,
                options,
                'varXElement',
            );
            updateOptions(
                col.id,
                col.data_type,
                $varYElement,
                yTypes,
                options,
                'varYElement',
            );
        });

        $varXElement.val(selectedValue['varXElement']).change();
        $varYElement.val(selectedValue['varYElement']).change();
    }

    /**
     * Initialize select2 for selection of Function Name
     */
    static initDropdownFunctionName() {
        const $functionNameElement = $(
            functionConfigElements.functionNameElement,
        );

        const getMatchingParam = (coefs) => (funcCoefs) =>
            coefs.find((e) => funcCoefs.includes(e));
        const getMatchingParamsANS = getMatchingParam(ARRAY_ANS);
        const getMatchingParamsBK = getMatchingParam(ARRAY_BK);
        const getMatchingParamsCT = getMatchingParam(ARRAY_CT);

        $functionNameElement.empty();
        allMasterFunction.forEach((func) => {
            const coeANSLabel = getMatchingParamsANS(func.coefs) || '';
            const coeBKLabel = getMatchingParamsBK(func.coefs) || '';
            const coeCTLabel = getMatchingParamsCT(func.coefs) || '';
            const requiredANS =
                getMatchingParamsANS(func.required_coefs) !== undefined;
            const requiredBK =
                getMatchingParamsBK(func.required_coefs) !== undefined;
            const requiredCT =
                getMatchingParamsCT(func.required_coefs) !== undefined;

            // TODO: remove this value after implementing front-end
            const defaultValueCoeANS = func.a || func.n || func.s;
            const defaultValueCoeBK = func.b || func.k;
            const defaultValueCoeCT = func.c || func.t;

            $functionNameElement.append(
                $('<option/>', {
                    value: func.id,
                    text: func.function_type,
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
                    function_name_en: func.function_name_en || '',
                    function_name_jp: func.function_name_jp || '',
                    description_en: func.description_en || '',
                    description_jp: func.description_jp || '',
                    'output-data-type': '', // will be defined after calculating sample data
                }),
            );
        });

        $functionNameElement.val('').change();
    }

    /**
     * Get label of raw data type
     * @param rawDataType
     * @return {string} - Label of raw data type
     */
    static getLabelRawDataType(rawDataType) {
        let label = '';
        switch (rawDataType) {
            case DataTypes.BIG_INT.name:
                label = document
                    .getElementById(DataTypes.BIG_INT.i18nLabelID)
                    .textContent.trim();
                break;
            case DataTypes.INTEGER.name:
                label = document
                    .getElementById(DataTypes.INTEGER.exp)
                    .textContent.trim();
                break;
            case DataTypes.TEXT.name:
                label = document
                    .getElementById(DataTypes.TEXT.i18nLabelID)
                    .textContent.trim();
                break;
            case DataTypes.REAL.name:
                label = document
                    .getElementById(DataTypes.REAL.i18nLabelID)
                    .textContent.trim();
                break;
            case DataTypes.DATETIME.name:
                label = document
                    .getElementById(DataTypes.DATETIME.i18nLabelID)
                    .textContent.trim();
                break;
            case DataTypes.CATEGORY.name:
                label = document
                    .getElementById(DataTypes.CATEGORY.i18nLabelID)
                    .textContent.trim();
                break;
            case DataTypes.BOOLEAN.name:
                label = document
                    .getElementById(DataTypes.BOOLEAN.i18nLabelID)
                    .textContent.trim();
                break;
        }

        return label;
    }

    /**
     * Get raw data type
     * @param {string} label - a label of data type
     * @return {string} - a raw data type
     */
    static getRawDataTypeByLabel(label) {
        let rawDataType = '';
        switch (label) {
            case document
                .getElementById(DataTypes.BIG_INT.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.BIG_INT.bs_value;
                break;
            case document
                .getElementById(DataTypes.INTEGER.exp)
                .textContent.trim():
                rawDataType = DataTypes.INTEGER.bs_value;
                break;
            case document
                .getElementById(DataTypes.SMALL_INT.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.SMALL_INT.bs_value;
                break;
            case document
                .getElementById(DataTypes.TEXT.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.TEXT.bs_value;
                break;
            case document
                .getElementById(DataTypes.REAL.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.REAL.bs_value;
                break;
            case document
                .getElementById(DataTypes.DATETIME.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.DATETIME.bs_value;
                break;
            case document
                .getElementById(DataTypes.CATEGORY.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.CATEGORY.bs_value;
                break;
            case document
                .getElementById(DataTypes.BOOLEAN.i18nLabelID)
                .textContent.trim():
                rawDataType = DataTypes.BOOLEAN.bs_value;
                break;
        }

        return rawDataType;
    }

    /**
     * Set label for output data type of selected function
     * @param {string} rawDataType - a raw data type string
     */
    static setOutputDataType(rawDataType) {
        functionConfigElements.outputElement.innerHTML =
            FunctionInfo.getLabelRawDataType(rawDataType);
        functionConfigElements.outputElement.dataset.rawDataType = rawDataType;
    }

    /**
     * Set label for output data type of selected function
     * @param {string} labelDataType - a label data type string
     * @deprecated
     */
    static setOutputDataTypeByLabel(labelDataType) {
        functionConfigElements.outputElement.innerHTML = labelDataType;
        functionConfigElements.outputElement.dataset.rawDataType =
            FunctionInfo.getRawDataTypeByLabel(labelDataType);
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
            (
                functionConfigElements.outputElement.dataset.rawDataType ?? ''
            ).trim(),
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
                (isMeFunction ||
                    (!isMeFunction &&
                        validateFunctionColumnName(inputFunctionInfo)));
        } else {
            inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();
        }
        const selectedFunction =
            functionConfigElements.functionNameElement.querySelector(
                'option:checked',
            );
        const isHasVarX = !functionConfigElements.varXElement.disabled;
        const isHasVarY = !functionConfigElements.varYElement.disabled;
        const isInvalidCoeANS = FunctionInfo.isInvalidStatus(
            functionConfigElements.coeANSElement,
        );
        const isInvalidCoeBK = FunctionInfo.isInvalidStatus(
            functionConfigElements.coeBKElement,
        );
        const isInvalidCoeCT = FunctionInfo.isInvalidStatus(
            functionConfigElements.coeCTElement,
        );
        const isInvalidParams =
            selectedFunction == null ||
            (isHasVarX && inputFunctionInfo.varX == null) ||
            (isHasVarY && inputFunctionInfo.varY == null) ||
            (functionConfigElements.coeANSElement.required &&
                inputFunctionInfo.coeANS === '') ||
            isInvalidCoeANS ||
            (functionConfigElements.coeBKElement.required &&
                inputFunctionInfo.coeBK === '') ||
            isInvalidCoeBK ||
            (functionConfigElements.coeCTElement.required &&
                inputFunctionInfo.coeCT === '') ||
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
                FunctionInfo.setInvalidStatus(
                    functionConfigElements.coeANSElement,
                );
            } else if (ARRAY_BK.includes(error.field)) {
                FunctionInfo.setInvalidStatus(
                    functionConfigElements.coeBKElement,
                );
            } else if (ARRAY_CT.includes(error.field)) {
                FunctionInfo.setInvalidStatus(
                    functionConfigElements.coeCTElement,
                );
            }
            showToastrMsg(error.msg, MESSAGE_LEVEL.ERROR);
        }
    }

    /**
     * Update index and order of all function columns in table
     */
    static updateIndexRowsInTable() {
        [
            ...functionConfigElements.functionTableElement.lastElementChild
                .children,
        ].forEach((tr, i) => {
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
    /** @type HTMLTableRowElement[] */
    const rows = [
        ...functionConfigElements.functionTableElement.lastElementChild
            .children,
    ];
    searchByValueOfTable(event, rows);
}

/**
 * Handle select rows that shown in filter
 * @param {PointerEvent} event - an event
 * @param {?boolean} isChecked - a flag to set status for checkboxes
 */
function setFilterButtonHandler(event, isChecked = true) {
    [
        ...functionConfigElements.functionTableElement.lastElementChild
            .children,
    ].forEach((row) => {
        if (!row.classList.contains('gray')) {
            const checkBox = row.querySelector('input[name="columnName"]');
            if (checkBox.checked === isChecked) return; // do nothing if no changes

            checkBox.checked = isChecked;
            setTimeout(() => checkBox.dispatchEvent(new Event('change')));
        }
    });
}

/**
 * Handle unselect rows that shown in filter
 * @param {PointerEvent} event - an event
 * @param {?boolean} isChecked - a flag to set status for checkboxes
 */
function resetButtonHandler(event, isChecked = false) {
    setFilterButtonHandler(event, isChecked);
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

    const selectedFunction =
        functionConfigElements.functionTableElement.lastElementChild.querySelector(
            'tr.selected',
        );
    if (selectedFunction == null) {
        inputFunctionInfo.index =
            functionConfigElements.functionTableElement.lastElementChild
                .childElementCount + 1;

        inputFunctionInfo.isChecked =
            functionConfigElements.selectAllFunctionColumns.checked;

        inputFunctionInfo.functionColumnId =
            inputFunctionInfo.functionColumnId ??
            FunctionInfo.getNewFunctionColumnId();

        inputFunctionInfo.processColumnId =
            inputFunctionInfo.processColumnId ??
            FunctionInfo.getNewProcessColumnId();

        inputFunctionInfo.addNewFunctionRow();
    } else {
        inputFunctionInfo.updateFunctionRow();
        selectedFunction.classList.remove('selected');
    }
    // change data type of column if me.type_convert()
    if (
        inputFunctionInfo.isMeFunction &&
        inputFunctionInfo.functionId === 172
    ) {
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
    [...functionConfigElements.functionUserSettingTableBody.children].forEach(
        (row) => row.remove(),
    );
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
        if (
            !existFunctionParams.some((a) =>
                currentParams.every((v, i) => v === a[i]),
            )
        ) {
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
        .forEach((cell) =>
            cell.addEventListener(
                'mouseover',
                FunctionInfo.hoverTableCellEvent,
            ),
        );
    $(functionConfigElements.functionUserSettingTableModal).modal('show');
}

const validateFunctionColumnName = (inputFunctionInfo) => {
    if (isEmpty(inputFunctionInfo.systemName)) {
        FunctionInfo.setInvalidStatus(functionConfigElements.systemNameElement);
        return false;
    }

    let [systemNames, japaneseNames, localNames] = getCheckedRowValues();
    FunctionInfo.collectAllFunctionRows()
        .filter(
            (functionInfo) =>
                Number(functionInfo.functionColumnId) !==
                    Number(inputFunctionInfo.functionColumnId) &&
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
        const isInValid = isArrayDuplicated(
            names.filter((name) => !isEmpty(name)),
        );
        if (isInValid) {
            FunctionInfo.setInvalidStatus(inputElement);
        } else {
            FunctionInfo.removeInvalidStatus(inputElement);
        }
        return !isInValid;
    };

    const isValidSystemName = setBorderInput(
        systemNames,
        functionConfigElements.systemNameElement,
    );
    const isValidJapaneseName = setBorderInput(
        japaneseNames,
        functionConfigElements.japaneseNameElement,
    );
    const isValidLocalName = setBorderInput(
        localNames,
        functionConfigElements.localNameElement,
    );
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
    FunctionInfo.showChangeMark();
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
    const isShowInJP =
        document.getElementById('select-language').value === 'ja';
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
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach(
        (row) => row.remove(),
    );
    const functionInfos = FunctionInfo.collectAllFunctionRows();

    const deletingFunctionColumnIds = new Set();
    const deletingProcessColumnIds = new Set();
    for (const functionInfo of functionInfos) {
        let deleting = false;

        // determine if this column is being deleted
        if (functionInfo.isChecked) {
            // checked functions should be deleted
            deletingFunctionColumnIds.add(functionInfo.functionColumnId);
            deleting = true;
        } else {
            // unchecked functions but depend on other deleting functions should be deleted as well
            if (
                deletingProcessColumnIds.has(functionInfo.varX) ||
                deletingProcessColumnIds.has(functionInfo.varY)
            ) {
                deletingFunctionColumnIds.add(functionInfo.functionColumnId);
                deleting = true;
            }
        }

        // mark this as deleting function
        if (deleting) {
            deletingProcessColumnIds.add(functionInfo.processColumnId);
        }
    }

    // Add related function columns into table
    let htmlRows = '';
    functionInfos
        .filter((functionInfo) =>
            deletingFunctionColumnIds.has(functionInfo.functionColumnId),
        )
        .forEach(function (functionInfo, index) {
            htmlRows +=
                `<tr>` +
                `<td class="sample-data show-raw-text column-index" name="index" data-column-title="index" data-is-me-function="${functionInfo.isMeFunction}" data-process-column-id="${functionInfo.processColumnId}" data-function-column-id="${functionInfo.functionColumnId}">${index + 1}</td>` +
                `<td class="sample-data show-raw-text column-system-name" name="systemName" data-column-title="systemName">${functionInfo.systemName}</td>` +
                `<td class="sample-data show-raw-text column-japanese-name" name="japaneseName" data-column-title="japaneseName">${functionInfo.japaneseName}</td>` +
                `<td class="sample-data show-raw-text column-local-name" name="localName" data-column-title="localName">${functionInfo.localName}</td>` +
                `<td class="sample-data show-raw-text column-var-x" name="varXName" data-column-title="varXName" data-var-x-id="${functionInfo.varX}">${functionInfo.varXName}</td>` +
                `<td class="sample-data show-raw-text column-var-x" name="varYName" data-column-title="varYName" data-var-y-id="${functionInfo.varY}">${functionInfo.varYName}</td>` +
                '</tr>';
        });
    functionConfigElements.deleteFunctionColumnTableBody.innerHTML = htmlRows;
    functionConfigElements.deleteFunctionColumnTableBody
        .querySelectorAll('td')
        .forEach((cell) =>
            cell.addEventListener(
                'mouseover',
                FunctionInfo.hoverTableCellEvent,
            ),
        );
    $('#deleteFunctionColumnModal').modal('show');
}

/**
 * register Function
 * @param {PointerEvent} event
 */
function registerFunctionInfo(event) {
    const functions = collectFunctionDatasForRegister();
    const procId = procModalElements.procID.val();
    const data = {
        process_id: procId,
        functions: functions,
    };

    loadingShowImmediately();
    fetch('api/setting/function_config', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.json())
        .then((res) => {
            let messageInfo = generateRegisterMessage(
                $('#i18nSavedSuccessfully').text(),
            );
            if (Object.prototype.hasOwnProperty.call(res, 'cfg_col_ids')) {
                hideAlertMessages();
                FunctionInfo.removeAllFunctionRows();
                FunctionInfo.resetStatusOfEditingFunction();
                FunctionInfo.resetInputFunctionInfo();
                FunctionInfo.getAllFunctionInfosApi(
                    procId,
                    res.cfg_col_ids,
                ).then(FunctionInfo.loadFunctionListTableAndInitDropDown);

                // update prc PreviewDataOfFunctionColumn when register
                for (let key in prcPreviewDataOfFunctionColumn) {
                    if (parseInt(key) < 0) {
                        delete prcPreviewDataOfFunctionColumn[key];
                    }
                }
            } else {
                const errorResponses = res;
                const setErrorMsgs = new Set();
                for (const [functionColumnId, rowErrors] of Object.entries(
                    errorResponses,
                )) {
                    const row =
                        functionConfigElements.functionTableElement.lastElementChild.querySelector(
                            `tr td[data-function-column-id='${functionColumnId}']`,
                        ).parentNode;

                    // Reset the 'invalid' status from each element
                    FunctionInfo.resetInvalidStatus(row);

                    // Find error targets and border red it
                    for (const rowError of rowErrors) {
                        let fieldName = rowError['field'];
                        if (ARRAY_ANS.includes(fieldName)) {
                            fieldName = 'a_n_s';
                        } else if (ARRAY_BK.includes(fieldName)) {
                            fieldName = 'b_k';
                        } else if (ARRAY_CT.includes(fieldName)) {
                            fieldName = 'c_t';
                        }
                        let errorMsg;
                        if (fieldName === 'name_jp') {
                            errorMsg =
                                $(
                                    procModali18n.duplicatedJapaneseName,
                                ).text() || '';
                        } else if (fieldName === 'name_en') {
                            errorMsg =
                                $(procModali18n.duplicatedSystemName).text() ||
                                '';
                        } else if (fieldName === 'name_local') {
                            errorMsg =
                                $(procModali18n.duplicatedLocalName).text() ||
                                '';
                        } else {
                            errorMsg = rowError['msg'];
                        }

                        // Set class invalid to border red error targets
                        if (!fieldName) {
                            $(row).addClass('row-invalid');
                        } else {
                            const inputEle = row.querySelector(
                                `input[name="${fieldName}"]`,
                            );
                            FunctionInfo.setInvalidStatus(inputEle);
                        }
                        setErrorMsgs.add(errorMsg);
                    }
                }

                // Show toast error messages
                const errorMsgs = Array.from(setErrorMsgs) || [];
                if (errorMsgs.length > 0) {
                    messageInfo = generateRegisterMessage(
                        Array.from(errorMsgs).join('<br>'),
                        true,
                        false,
                    );
                }
            }
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: messageInfo.message,
                is_error: messageInfo.isError,
                is_warning: messageInfo.isWarning,
            });
        })
        .catch((res) => {
            const errorResponses = res['responseJSON'];
            const setErrorMsgs = new Set();
            if (errorResponses.code === 500) {
                setErrorMsgs.add(errorResponses.message);
            }

            // Show toast error messages
            const errorMsgs = Array.from(setErrorMsgs) || [];
            if (errorMsgs.length > 0) {
                const messageStr = Array.from(errorMsgs).join('<br>');
                displayRegisterMessage(
                    procModalElements.alertProcessNameErrorMsg,
                    {
                        message: messageStr,
                        is_error: true,
                        is_warning: false,
                    },
                );
            }
        });
    FunctionInfo.resetInputFunctionInfo(true, false);
    FunctionInfo.resetStatusOfEditingFunction();
    FunctionInfo.updateStatusErrorCheckbox();
    FunctionInfo.initDropdownFunctionName();
    loadingHide();
}

/**
 * Collect All Function Info
 * @return {string} - a string contains all function info
 */
function collectAllFunctionInfo() {
    const headerText = [
        ...functionConfigElements.functionTableElement.firstElementChild
            .firstElementChild.children,
    ]
        .map((th) => {
            const columnName = th.dataset.columnName.trim();
            if (th.getAttribute('colspan') == null) {
                return columnName;
            }

            const quantity = parseInt(th.getAttribute('colspan'), 10);
            return Array(quantity).fill(columnName).join(TAB_CHAR);
        })
        .join(TAB_CHAR);
    const bodyText = [
        ...functionConfigElements.functionTableElement.lastElementChild
            .children,
    ]
        .map((tr) =>
            [...tr.children]
                .map((td) => {
                    const inputEl = td.querySelector('input[type="text"]');
                    if (inputEl != null) {
                        return inputEl.value.trim();
                    }

                    return td.textContent.trim();
                })
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
    const text = collectAllFunctionInfo();
    const processName = document.getElementById('processName').value.trim();
    const fileName = `${processName}_FunctionSampleData.tsv`;
    downloadText(fileName, text);
    showToastrMsg(
        document.getElementById('i18nStartedTSVDownload').textContent,
        MESSAGE_LEVEL.INFO,
    );
}

/**
 * Copy All Function Info
 * @param {PointerEvent} event
 */
function copyAllFunctionInfo(event) {
    const text = collectAllFunctionInfo();
    navigator.clipboard
        .writeText(text)
        .then(
            showToastCopyToClipboardSuccessful,
            showToastCopyToClipboardFailed,
        );
}

/**
 * Paste All Function Info
 * @param event
 */
function pasteAllFunctionInfo(event) {
    const rawDataTypeTitle = {
        [DataTypes.REAL.name]: $('#' + DataTypes.REAL.i18nLabelID).text(),
        [DataTypes.TEXT.name]: $('#' + DataTypes.TEXT.i18nLabelID).text(),
        [DataTypes.DATETIME.name]: $(
            '#' + DataTypes.DATETIME.i18nLabelID,
        ).text(),
        [DataTypes.INTEGER.name]: $('#' + DataTypes.INTEGER.exp).text(),
        [DataTypes.BIG_INT.name]: $('#' + DataTypes.BIG_INT.i18nLabelID).text(),
        [DataTypes.CATEGORY.name]: $(
            '#' + DataTypes.CATEGORY.i18nLabelID,
        ).text(),
        [DataTypes.BOOLEAN.name]: $('#' + DataTypes.BOOLEAN.i18nLabelID).text(),
        [DataTypes.DATE.name]: $('#' + DataTypes.DATE.i18nLabelID).text(),
        [DataTypes.TIME.name]: $('#' + DataTypes.TIME.i18nLabelID).text(),
    };
    const funcInfos = FunctionInfo.collectAllFunctionRows();
    FunctionInfo.removeAllFunctionRows();
    const dicFuncs = {};
    const dicCols = {};
    for (const colRec of currentProcDataCols) {
        dicCols[colRec.column_raw_name] = colRec.id;
    }
    for (const funcInfo of funcInfos) {
        if (funcInfo.functionColumnId > 0) {
            dicCols[funcInfo.systemName] = funcInfo.processColumnId;
        }
    }
    for (const funRec of allMasterFunction) {
        dicFuncs[funRec.function_type] = funRec.id;
    }
    const mapColumnNameDict = {
        '*': 'index',
        Function: 'functionName',
        'System Name': 'systemName',
        'Japanese Name': 'japaneseName',
        'Local Name': 'localName',
        'X/me': 'varXName',
        Y: 'varYName',
        'a/n/s': 'coeANS',
        'b/k': 'coeBK',
        'c/t': 'coeCT',
        Note: 'note',
        Output: 'output',
        'Sample Data': 'sampleDatas',
    };
    const handleError = (errorMessage) => {
        FunctionInfo.removeAllFunctionRows();
        funcInfos.forEach((funcInfo) => funcInfo.addNewFunctionRow());
        showToastPasteFromClipboardFailed(errorMessage);
    };

    navigator.clipboard.readText().then(function (text) {
        const table = functionConfigElements.functionTableElement;
        let index = 0;
        let newColumnIndex = 0;
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

        // validate header row
        const headerRow = rows[0];
        let isHeaderRowValid = true;
        let errorMessage = null;
        const noHeaderMessage =
            'There is no header in copied text, Please also copy header!';
        const wrongHeaderMessage =
            'Copied text is wrong format, Please correct header!';
        if (headerRow.length === 0) {
            errorMessage = noHeaderMessage;
            isHeaderRowValid = false;
        }
        let hasHeader = false;
        for (const columnName of headerRow) {
            if (mapColumnNameDict[columnName] == null) {
                errorMessage = hasHeader ? wrongHeaderMessage : noHeaderMessage;
                isHeaderRowValid = false;
                break;
            }

            hasHeader = true;
        }
        if (!isHeaderRowValid) {
            handleError(errorMessage);
            return;
        }

        let hasInvalidFunction = false;
        // paste text to table
        for (const row of rows.slice(1)) {
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

            for (
                let columnIndex = 0;
                columnIndex < headerRow.length;
                columnIndex++
            ) {
                const columnName = headerRow[columnIndex];
                if (
                    mapColumnNameDict[columnName] ===
                    mapColumnNameDict['Sample Data']
                ) {
                    params[mapColumnNameDict[columnName]].push(
                        row[columnIndex],
                    );
                } else {
                    params[mapColumnNameDict[columnName]] = row[columnIndex];
                }
            }

            params.functionId = dicFuncs[params.functionName];
            if (params.functionId === undefined) {
                hasInvalidFunction = true;
                continue;
            }
            const existFunctionInfo = funcInfos[index];
            if (existFunctionInfo !== undefined) {
                params.functionColumnId = existFunctionInfo.functionColumnId;
                params.processColumnId = existFunctionInfo.processColumnId;
            }
            index++;
            if (!dicCols[params.systemName]) {
                dicCols[params.systemName] = -index;
                params.functionColumnId = -index;
                params.processColumnId = -index;
            } else if (params.functionName.startsWith('me.')) {
                params.functionColumnId = -index;
                params.processColumnId = dicCols[params.varXName];
            }

            params.index = index;
            params.varX = dicCols[params.varXName];
            params.varY = dicCols[params.varYName];
            if (params.output.length) {
                params.output = Object.keys(rawDataTypeTitle).find(
                    (key) => rawDataTypeTitle[key] === params.output,
                );
            }

            const inputFunctionInfo = new FunctionInfo(params);
            inputFunctionInfo.addNewFunctionRow();
            FunctionInfo.resetStatusOfEditingFunction();
        }

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
    const rows = [
        ...functionConfigElements.functionNameTableElement.lastElementChild
            .children,
    ];
    searchByValueOfTable(event, rows);
}

/**
 * Handle filter rows
 * @param {KeyboardEvent} event
 */
function searchExistFunctionInputHandler(event) {
    const rows = [
        ...functionConfigElements.functionUserSettingTableElement
            .lastElementChild.children,
    ];
    searchByValueOfTable(event, rows);
}

/**
 * Delete function columns in table (only remove HTML)
 */
const handleDeleteFunctionColumns = () => {
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach(
        (tr) => {
            const numberCell = tr.firstElementChild;
            const columnId = numberCell.dataset.functionColumnId;
            delete prcPreviewDataOfFunctionColumn?.[columnId];

            functionConfigElements.functionTableElement.lastElementChild
                .querySelectorAll(
                    `tr td[data-function-column-id='${columnId}']`,
                )
                .forEach((columnFunctionName) => {
                    const rowElement = columnFunctionName.parentElement;
                    FunctionInfo.deleteFunctionRow(rowElement);
                    FunctionInfo.updateIndexRowsInTable();
                });
        },
    );

    closeDelFunctionColsModal();
};

const closeDelFunctionColsModal = () => {
    $('#deleteFunctionColumnModal').modal('hide');
};

/**
 * Set check/uncheck row
 * @param {HTMLTableRowElement} row - a row HTML object
 * @param {boolean} isChecked - status of checkbox
 */
function changeRowSelectStatus(row, isChecked) {
    const element = row.querySelector('td.column-function-name input');
    if (element.checked === isChecked) return;
    element.checked = isChecked;
    // Trigger change event
    setTimeout(() => {
        element.dispatchEvent(new Event('change'));
    });
}

/**
 * Handle checking/unchecking all function columns
 * @param {Event} event - checkbox HTML object
 */
function handleCheckAllFunctionColumns(event) {
    /** @type {HTMLInputElement} */
    const el = event.currentTarget;
    /** @type {HTMLTableRowElement[]} */
    const allRows = [
        ...functionConfigElements.functionTableElement.lastElementChild
            .children,
    ];
    allRows.forEach((row) => changeRowSelectStatus(row, el.checked));
}

/**
 * Handle checking/unchecking error function columns
 * @param {Event} event - checkbox HTML object
 */
function handleCheckErrorFunctionColumns(event) {
    /** @type {HTMLInputElement} */
    const el = event.currentTarget;
    const invalidRows = FunctionInfo.getInvalidRows();
    [
        ...functionConfigElements.functionTableElement.lastElementChild
            .children,
    ].forEach((row) => {
        if (invalidRows.includes(row)) {
            changeRowSelectStatus(row, el.checked);
        } else if (el.checked) {
            changeRowSelectStatus(row, false);
        }
    });
}

/**
 * Handle checking/unchecking error function columns
 * @param {Event} event - checkbox HTML object
 */
const handleShowResultData = delay((event) => {
    checkAnyChanges(event);

    // check all input fill
    const isValid = FunctionInfo.validateInputFunctionInfo(undefined);
    if (isValid && !showResultFunction.disabled) {
        showResultFunction();
    } else {
        clearTimeout(showResultFunction.timeoutID);
    }
}, 100);

/**
 * Replace characters which are not alphabet
 * @param {string} name - a name
 * @return {string} - a name without special characters
 */
const correctEnglishName = (name) =>
    name == null ? name : name.replace(/[^\w-]+/g, '');

/**
 * 1. Replace characters which are not alphabet
 * 2. Check there is any changes between the input function & the exist function
 * @param {Event} event
 */
const handleChangeSystemName = (event) => {
    /** @type HTMLInputElement */
    const targetInput = event.currentTarget;
    targetInput.value = correctEnglishName(targetInput.value);
    checkAnyChanges(event);
};

/**
 * Check any changes in function info.
 * If there are some changes, change icon will be shown. Otherwise
 * @param {Event} event - checkbox HTML object
 */
const checkAnyChanges = (event) => {
    const selectedRow =
        functionConfigElements.functionTableElement.lastElementChild.querySelector(
            'tr.selected',
        );
    if (selectedRow != null) {
        const inputFunction = FunctionInfo.collectInputFunctionInfo();
        const selectedFunction =
            FunctionInfo.collectFunctionInfoByRow(selectedRow);
        if (inputFunction.isEqual(selectedFunction)) {
            FunctionInfo.hideChangeMark();
        } else {
            FunctionInfo.showChangeMark();
        }
    } else {
        const inputFunction = FunctionInfo.collectInputFunctionInfo();
        if (inputFunction.isEmpty()) {
            FunctionInfo.hideChangeMark();
        } else {
            FunctionInfo.showChangeMark();
        }
    }
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
    FunctionInfo.setOutputDataType(
        selectedOption.getAttribute('output-data-type'),
    );
    // Disable input column name if me
    const functionName = selectedOption.text;
    let isMeFunction = functionName.startsWith('me.');
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
        functionConfigElements.varXElement.disabled = false;
        $(functionConfigElements.varXElement)
            .val(functionConfigElements.varXElement.value)
            .change();
    } else {
        functionConfigElements.varXElement.disabled = true;
        $(functionConfigElements.varXElement).val('').change();
    }

    if (isHasYParam) {
        functionConfigElements.varYElement.disabled = false;
        $(functionConfigElements.varYElement)
            .val(functionConfigElements.varYElement.value)
            .change();
    } else {
        functionConfigElements.varYElement.disabled = true;
        $(functionConfigElements.varYElement).val('').change();
    }

    const changeStatusLabel = (attributeName, coeElement, coeLabelElement) => {
        const coeLabel = selectedOption.getAttribute(attributeName);
        const defaultValue =
            selectedOption.getAttribute(
                `${DEFAULT_VALUE_PREFIX}${attributeName}`,
            ) || '';
        const required =
            selectedOption.getAttribute(
                `${REQUIRED_VALUE_PREFIX}${attributeName}`,
            ) === 'true';

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
    changeStatusLabel(
        'coe-a-n-s',
        functionConfigElements.coeANSElement,
        functionConfigElements.coeANSLabelElement,
    );
    changeStatusLabel(
        'coe-b-k',
        functionConfigElements.coeBKElement,
        functionConfigElements.coeBKLabelElement,
    );
    changeStatusLabel(
        'coe-c-t',
        functionConfigElements.coeCTElement,
        functionConfigElements.coeCTLabelElement,
    );

    FunctionInfo.initDropdownVarXY(selectedOption);

    // change helper message
    const isShowInJP =
        document.getElementById('select-language').value === 'ja';
    const fullLengthMsg = isShowInJP
        ? selectedOption.getAttribute('description_jp')
        : selectedOption.getAttribute('description_en');
    // no longer support, change to css to overflow long text
    // const maximumLength = 200;
    // functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg.length > maximumLength ? fullLengthMsg.substring(0, maximumLength) + '...' : fullLengthMsg;
    functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg;
    functionConfigElements.helperMessageElement.title = fullLengthMsg;
};

const validateCoeInput = (event) => {
    const inputValue = event.target.value;
    const coeLabel =
        event.target.parentElement.parentElement.querySelector('label')
            .textContent[0];
    let isValid = true;
    if (['a', 'b', 'c'].includes(coeLabel)) {
        isValid = isNumberOrInf(inputValue);
    } else if (['n', 'k'].includes(coeLabel)) {
        isValid = isInteger(inputValue);
    } else if (['s', 't'].includes(coeLabel)) {
        // since `s` and `t` are string, we might assume they are not valid
        // we also need to check other element (`t` in case `s` or `s` in case `t`)
        // that it needs to be validated as well because there are cases (such as `lookup`)
        // that required both `s` and `t` to be valid
        const otherElement =
            coeLabel === 't'
                ? functionConfigElements.coeANSElement
                : functionConfigElements.coeCTElement;
        const otherElementInvalid =
            otherElement.required && otherElement.value === '';
        if (!otherElementInvalid) {
            FunctionInfo.removeInvalidStatus(otherElement);
        }
    }
    if (event.target.required && inputValue === '') {
        isValid = false;
    }
    if (isValid) {
        FunctionInfo.removeInvalidStatus(event.target);
        handleShowResultData(event);
    } else {
        FunctionInfo.setInvalidStatus(event.target);
    }
};

const isNumberOrInf = (inputValue) => {
    // validate number input only
    if (['', '-inf', 'inf'].includes(inputValue)) {
        return true;
    }
    return !isNaN(inputValue);
};

/**
 * Generate Function Column Names (JP, System, Local)
 * @param {HTMLOptionElement} selectedColumn - an option HTML object
 * @param {HTMLOptionElement} selectedFunction - an option HTML object
 */
function generateFunctionColumnNames(selectedColumn, selectedFunction) {
    // Set default system name if it is new function column (not editing mode)
    const selectedRow =
        functionConfigElements.functionTableElement.lastElementChild.querySelector(
            'tr.selected',
        );
    if (
        selectedRow == null &&
        functionConfigElements.systemNameElement.dataset.originGeneratedName ===
            functionConfigElements.systemNameElement.value &&
        functionConfigElements.japaneseNameElement.dataset
            .originGeneratedName ===
            functionConfigElements.japaneseNameElement.value &&
        functionConfigElements.localNameElement.dataset.originGeneratedName ===
            functionConfigElements.localNameElement.value
    ) {
        const selectedFunctionNameJp =
            selectedFunction.getAttribute('function_name_jp');
        const selectedFunctionNameEn = correctEnglishName(
            selectedFunction.getAttribute('function_name_en'),
        );
        let suffix = '';
        const selectedColumnSystemName = selectedColumn
            .getAttribute('name-sys')
            .trim();
        const selectedColumnJapaneseName = selectedColumn
            .getAttribute('name-jp')
            .trim();
        const selectedColumnLocalName = selectedColumn
            .getAttribute('name-local')
            .trim();
        const searchName =
            `${selectedColumnSystemName}_${selectedFunctionNameEn}`.replaceAll(
                ' ',
                '_',
            );
        const sameColumnNames = [
            ...functionConfigElements.functionTableElement.lastElementChild.querySelectorAll(
                `td.column-system-name input`,
            ),
        ]
            .filter((input) => input.value.includes(searchName))
            .map((input) => input.value.trim());
        const prefix = `${searchName}_`;
        const validSameColumnNames = sameColumnNames
            .filter(
                (name) =>
                    name.includes(prefix) &&
                    name.replace(prefix, '').match(/^\d{2}$/) != null,
            )
            .sort((a, b) => a.localeCompare(b));
        if (validSameColumnNames.length > 0) {
            const lastName =
                validSameColumnNames[validSameColumnNames.length - 1];
            suffix =
                parseInt(
                    lastName.substring(lastName.length - 2, lastName.length),
                    10,
                ) + 1;
            suffix = `_${String(suffix).padStart(2, '0')}`;
        } else if (sameColumnNames.length > 0) {
            suffix = `_01`;
        }

        const updateName = (
            selectedColumnName,
            selectedFunctionName,
            nameElement,
        ) => {
            if (selectedColumnName) {
                nameElement.value =
                    `${selectedColumnName}_${selectedFunctionName}${suffix}`
                        .trim()
                        .replaceAll(' ', '_');
            } else {
                nameElement.value = '';
            }
            nameElement.dataset.originGeneratedName = nameElement.value;
        };

        updateName(
            selectedColumnSystemName,
            selectedFunctionNameEn,
            functionConfigElements.systemNameElement,
        );
        updateName(
            selectedColumnJapaneseName,
            selectedFunctionNameJp,
            functionConfigElements.japaneseNameElement,
        );
        updateName(
            selectedColumnLocalName,
            selectedFunctionNameEn,
            functionConfigElements.localNameElement,
        );
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
    const columnId = selectedColumn.value;
    const columnType = selectedColumn.getAttribute('column-type');
    const selectedFunction =
        functionConfigElements.functionNameElement.selectedOptions[0];
    const isMeFunction = selectedFunction.text.startsWith('me.');
    const isFunctionColSelected =
        $(functionConfigElements.functionTableElement).find('tr.selected')
            .length > 0;

    if (isMeFunction) {
        functionConfigElements.systemNameElement.value =
            selectedColumn.getAttribute('name-sys');
        functionConfigElements.systemNameElement.dataset.originGeneratedName =
            functionConfigElements.systemNameElement.value;
        functionConfigElements.japaneseNameElement.value =
            selectedColumn.getAttribute('name-jp');
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName =
            functionConfigElements.japaneseNameElement.value;
        functionConfigElements.localNameElement.value =
            selectedColumn.getAttribute('name-local');
        functionConfigElements.localNameElement.dataset.originGeneratedName =
            functionConfigElements.localNameElement.value;
    }

    const getSampleDataValues = () => {
        let sampleDataValues = [];

        // case 1: get data from generated function column
        if (Number(columnType) === masterDataGroup.GENERATED_EQUATION) {
            sampleDataValues = collectSampleDataUnique(columnId);
        } else {
            // case 2: function me
            const rows = $(functionConfigElements.functionTableElement)
                .find(`tr td[data-var-x=${columnId}]`)
                .parent();
            if (rows.length) {
                const childrenMeFunctionRows = [];
                for (const row of rows) {
                    const functionName = $(row)
                        .find(`td[data-column-title="is_checked"] label`)
                        .text();
                    if (functionName.startsWith('me.')) {
                        childrenMeFunctionRows.push(row);
                    }
                }
                if (childrenMeFunctionRows.length) {
                    // TODO: fix edit row
                    // case 2.1: select function me => get data from selected row
                    if (isFunctionColSelected) {
                        const selectedFuncColRowEl = $(
                            functionConfigElements.functionTableElement,
                        ).find('tr.selected');
                        const selectedFunctionColId = $(selectedFuncColRowEl)
                            .find('td:nth-child(2)')
                            .data('process-column-id');
                        sampleDataValues = collectSampleDataUnique(
                            selectedFunctionColId,
                        );
                    } else {
                        // case 2.2: get data from the last row of function table column
                        const meFunctionColumnId = $(
                            childrenMeFunctionRows.at(-1),
                        )
                            .find('td:nth-child(2)')
                            .data('process-column-id');
                        sampleDataValues =
                            collectSampleDataUnique(meFunctionColumnId);
                    }
                } else {
                    sampleDataValues = collectSampleDataUnique(columnId);
                }
            } else {
                sampleDataValues = collectSampleDataUnique(columnId);
            }
        }

        return sampleDataValues;
    };

    // check X and Y is enabled or not
    const isDisabledX = functionConfigElements.varXElement.disabled;
    const isDisabledY = functionConfigElements.varYElement.disabled;
    const isCalculatedXAndY = !isDisabledX && !isDisabledY;

    // check value of X and Y
    const xColumnId = functionConfigElements.varXElement.value;
    const yColumnId = functionConfigElements.varYElement.value;
    const isHasXYValue = xColumnId !== '' && yColumnId !== '';

    if (!isCalculatedXAndY) {
        // fill dataY empty
        const dataByX = getSampleDataValues();
        let dataByY = Array(dataByX.length).fill('');
        getUniqueAndSlideData(dataByX, dataByY);
    }
    if (isHasXYValue && isCalculatedXAndY) {
        // map data by ID
        const dataByX = getSampleDataByColumnId(xColumnId);
        const dataByY = getSampleDataByColumnId(yColumnId);
        getUniqueAndSlideData(dataByX, dataByY);
    }

    // Set default system name if it is new function column (not editing mode)
    if (colTableIdx === 2 && !isMeFunction) {
        generateFunctionColumnNames(selectedColumn, selectedFunction);
    }
};

/**
 * Get unique data and slice to 50 data
 * @param {array} dataByX - sample data of column x
 * @param {array} dataByY - sample data of column x
 * @param {int} limit - limit slice
 */
const getUniqueAndSlideData = (dataByX, dataByY, limit = 50) => {
    const mapDataByXY = _.zip(dataByX ?? [], dataByY ?? []);

    // get unique data and slice to 50 data
    const uniqueDataByXY = Array.from(
        new Set(mapDataByXY?.map((item) => JSON.stringify(item))),
    )
        .map((item) => JSON.parse(item))
        .slice(0, 50);

    //sort empty string to last
    uniqueDataByXY.sort((x, y) => {
        const [aX, aY] = x;
        const [bX, bY] = y;

        // check empty value
        const aXIsEmpty = aX === '';
        const bXIsEmpty = bX === '';
        const aYIsEmpty = aY === '';
        const bYIsEmpty = bY === '';

        // x and y not empty
        if (!aXIsEmpty && !aYIsEmpty && (bXIsEmpty || bYIsEmpty)) return -1;
        if (!bXIsEmpty && !bYIsEmpty && (aXIsEmpty || aYIsEmpty)) return 1;

        // x not empty, y empty
        if (!aXIsEmpty && aYIsEmpty && (bXIsEmpty || !bYIsEmpty)) return -1;
        if (!bXIsEmpty && bYIsEmpty && (aXIsEmpty || !aYIsEmpty)) return 1;

        // x empty, y not empty
        if (aXIsEmpty && !aYIsEmpty && (bXIsEmpty || bYIsEmpty)) return -1;
        if (bXIsEmpty && !bYIsEmpty && (aXIsEmpty || aYIsEmpty)) return 1;

        // x and y empty
        if (aXIsEmpty && aYIsEmpty && bXIsEmpty && bYIsEmpty) return 0;

        return 0;
    });
    const [uniqueDataByX, uniqueDataByY] = _.unzip(uniqueDataByXY);

    // re-update data of X and Y with index of X (2) and Y(3) in functionSampleTable data
    _.zip([2, 3], [uniqueDataByX, uniqueDataByY]).forEach(
        ([colTableIdx, renderData]) => {
            renderDataToFunctionSampleData({
                renderData,
                colTableIdx,
            });
        },
    );
};

const renderDataToFunctionSampleData = ({ renderData, colTableIdx }) => {
    const trEls = $(functionConfigElements.sampleDataElement).find(`tbody tr`);
    const tableSampleDataBodyEl = $(
        functionConfigElements.sampleDataElement,
    ).find(`tbody`);
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

    const elements = $(functionConfigElements.sampleDataElement).find(
        `tbody tr td:nth-child(${colTableIdx})`,
    );
    // map data to table
    for (const index of Array(renderData.length).keys()) {
        $(elements[index]).html(renderData[index] ?? '');
    }
};

const getSampleDataByColumnId = (columnId) => {
    // get data in prcPreviewDataOfFunctionColumn if null|undefined => get in prcPreviewWith1000Data
    return (
        prcPreviewDataOfFunctionColumn[columnId] ||
        prcPreviewWith1000Data[columnId]
    );
};

/**
 * Get sample data based on column ids
 * @param {string} columnId
 * @return {string[]} - a list that contains sample data
 */
const collectSampleDataUnique = (columnId) => {
    let data = getSampleDataByColumnId(columnId);
    // return new sampleDataValues with 50 unique data
    return [...new Set(data)].slice(0, 50);
};

/**
 * Get sample data based on column ids
 * @param {number} columnId
 * @return {string[]} - a list that contains sample data
 */
const collectSampleData = (columnId) => {
    const colIdx = procModalElements.processColumnsTableBody
        .find(`td[title="index"][data-column-id="${columnId}"]`)
        .attr('data-col-idx');

    // find originalColName by columnId
    const originalNameColName = procModalElements.processColumnsTableBody
        .find(`td[title="index"][data-column-id="${columnId}"]`)
        .next()
        .find('input')
        .val();

    // find data by originalName
    return getSampleDataByColumnId(columnId);
};

const collectEquationSampleData = (idx) => {
    const elements = $(functionConfigElements.sampleDataElement).find(
        `tbody tr td:nth-child(${idx})`,
    );
    let sampleDataValues = [];
    for (const e of elements) {
        sampleDataValues.push($(e).text());
    }
    return sampleDataValues;
};

/**
 * Show sample datas base on function inputs
 */
const showResultFunction = delay(() => {
    const getValues = (columnId) =>
        (getSampleDataByColumnId(columnId) ?? []).map((v) => String(v ?? ''));
    const xValues = getValues(functionConfigElements.varXElement.value);
    const yValues = getValues(functionConfigElements.varYElement.value);
    const xDataType = $(functionConfigElements.varXElement)
        .find(':selected')
        .attr('raw-data-type');
    const yDataType = $(functionConfigElements.varYElement)
        .find(':selected')
        .attr('raw-data-type');
    const selectedFunction = $(functionConfigElements.functionNameElement).find(
        ':selected',
    );
    const equationId = selectedFunction.val();
    const {
        a = null,
        b = null,
        c = null,
        n = null,
        k = null,
        s = null,
        t = null,
    } = separateArgumentsOfFunction(
        equationId,
        functionConfigElements.coeANSElement.value,
        functionConfigElements.coeBKElement.value,
        functionConfigElements.coeCTElement.value,
    );
    const isAllXValuesEmpty = xValues.every((element) => element === '');
    const isAllYValuesEmpty = yValues.every((element) => element === '');

    const data = {
        X: xValues,
        x_data_type: xDataType,
        Y: yValues,
        y_data_type: yDataType,
        a,
        b,
        c,
        n,
        k,
        s,
        t,
        equation_id: equationId,
    };
    fetch('/ap/api/setting/function_config/sample_data', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.json())
        .then((data) => {
            if (Object.prototype.hasOwnProperty.call(data, 'errors')) {
                loadingHide();
                FunctionInfo.showErrorField(data.errors);
                FunctionInfo.clearFunctionOutput();
            } else {
                /** @type {string[]} */
                const sampleData = jsonParse(data.sample_data);

                // Find result of unique X & Y
                const xYResult = Object.fromEntries(
                    _.zip(_.zip(xValues, yValues), sampleData),
                );
                const uniqueXYResult = Object.fromEntries(
                    _.zip(
                        _.zip(
                            collectEquationSampleData(2),
                            collectEquationSampleData(3),
                        ),
                        [],
                    ),
                );
                for (const xYKey in uniqueXYResult) {
                    uniqueXYResult[xYKey] = xYResult[xYKey] ?? '';
                }
                const resultValues = Object.values(uniqueXYResult);
                functionConfigElements.sampleDataElement.result = sampleData;

                FunctionInfo.setOutputDataType(data.output_type);
                const elements = $(
                    functionConfigElements.sampleDataElement,
                ).find(`tbody tr td:nth-child(1)`);
                for (const index of Array(resultValues.length).keys()) {
                    let val = resultValues[index];
                    if (data.output_type === DataTypes.DATETIME.name) {
                        val = parseDatetimeStr(val);
                    }
                    $(elements[index]).html(applySignificantDigit(val));
                }
                FunctionInfo.fillSampleDataToSelectedFunctionRow(sampleData);
                const isResultsEmpty = resultValues.every(
                    (element) => element === null,
                );

                if (
                    isResultsEmpty &&
                    (!isAllXValuesEmpty || !isAllYValuesEmpty)
                ) {
                    showToastrMsg(
                        $('#i18nAllResultIsEmpty').text(),
                        MESSAGE_LEVEL.WARN,
                    );
                }
            }
        })
        .catch((res) => {
            console.log('Error result function');
            // FunctionInfo.showErrorField(res.responseJSON.errors);
        });
}, 200);

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
    const selectRowElement =
        functionConfigElements.functionTableElement.lastElementChild.querySelector(
            `tr[data-index="${element.dataset.index}"]`,
        );
    const previousSelectedRowElement =
        functionConfigElements.functionTableElement.lastElementChild.querySelector(
            `tr[data-index="${element.dataset.previousIndex}"]`,
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
    const masterFunction = allMasterFunction.find(
        (f) => String(f.id ?? '') === String(functionId ?? ''),
    );
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
    const functions = [];
    FunctionInfo.collectAllFunctionRows().forEach((functionInfo) => {
        const isGetDate = false;
        const isSerial = false;
        const columnType = masterDataGroup.GENERATED_EQUATION;

        if (functionInfo.isMeFunction) {
            functionInfo.processColumnId = functionInfo.varX;
        }

        const dicCfgProcessColumn = {
            id: functionInfo.processColumnId,
            process_id: procModalElements.procID.val(),
            column_name: functionInfo.systemName,
            column_raw_name: functionInfo.systemName,
            name_en: functionInfo.systemName,
            name_jp: functionInfo.japaneseName,
            name_local: functionInfo.localName,
            data_type: functionInfo.output,
            raw_data_type: functionInfo.output,
            column_type: columnType,
            is_get_date: isGetDate,
            is_serial_no: isSerial,
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
            id: functionInfo.functionColumnId,
            process_column_id: functionInfo.processColumnId,
            function_id: functionInfo.functionId,
            var_x: functionInfo.varX,
            var_y: functionInfo.varY,
            return_type: functionInfo.output,
            a,
            b,
            c,
            n,
            k,
            s,
            t,
            note: functionInfo.note,
            is_me_function: functionInfo.isMeFunction,
            process_column: dicCfgProcessColumn,
            order: functionInfo.index,
        };

        functions.push(dicCfgProcessFunctionColumn);
    });

    return functions;
}

/**
 * Reload function infos of current process that have in system
 * @param {PointerEvent} event
 */
function reloadFunctionInfo(event) {
    loadingShowImmediately();
    FunctionInfo.removeAllFunctionRows();
    FunctionInfo.resetInputFunctionInfo();
    FunctionInfo.resetStatusOfEditingFunction();

    const procId = procModalElements.procID.val();
    const allColumnIds = currentProcDataCols.map((col) => col.id);
    FunctionInfo.getAllFunctionInfosApi(procId, allColumnIds)
        .then(FunctionInfo.loadFunctionListTableAndInitDropDown)
        .finally(loadingHide);

    // update prc PreviewDataOfFunctionColumn
    for (let key in prcPreviewDataOfFunctionColumn) {
        if (parseInt(key) < 0) {
            delete prcPreviewDataOfFunctionColumn[key];
        }
    }
}

/**
 * Register change 'class' event for all elements in tbody of {@link functionConfigElements.functionTableElement}.
 * Only handle for inject/remove sync input events.
 */
function syncInputConfigAndTable() {
    /** @type {Array.<{addEvent: function, removeEvent: function}>} **/
    let configAndTableEvents = [];

    const removeAllSyncEvents = () =>
        configAndTableEvents.forEach((v) => v.removeEvent());
    const observer = new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            if (
                mutation.type === 'attributes' &&
                mutation.target.tagName.toLowerCase() === 'tr'
            ) {
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
                        ),
                        // sync without reload
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
                            rowElement.querySelector(
                                'input[name="name_local"]',
                            ),
                            false,
                        ),
                        // sync select dropdown
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

    // only listen for class selected changes
    observer.observe(
        functionConfigElements.functionTableElement.lastElementChild,
        {
            subtree: true,
            attributeOldValue: true,
            attributeFilter: ['class'],
        },
    );

    return removeAllSyncEvents;
}

/**
 * Allow drag and drop rows in function table
 */
function enableDragAndDropFunctionTable() {
    $(functionConfigElements.functionTableElement.lastElementChild).sortable({
        update: (event, ui) => {
            // Update index and order of all function columns in table
            FunctionInfo.updateIndexRowsInTable();
        },
    });
}

/**
 * Disable drag and drop rows in function table
 * @deprecated
 */
function disableDragAndDropFunctionTable() {
    try {
        $(
            functionConfigElements.functionTableElement.lastElementChild,
        ).sortable('destroy');
    } catch (e) {
        console.log(e);
    }
}

/**
 * Collect all records in function sample data table to text
 * @return {string} - a string contains all records
 */
function collectFunctionSampleData() {
    /**
     * Collect values of row
     * @param {NodeListOf<HTMLTableCellElement>} nodeList - list of cells in row
     * @return {string}
     */
    const collectRow = (nodeList) =>
        Array.from(nodeList)
            .map((cell) => cell.textContent.trim())
            .join('\t') + '\n';

    // Extract table headers
    let text = collectRow(
        functionConfigElements.sampleDataElement.querySelectorAll(
            'thead tr th',
        ),
    );

    // Extract table rows
    functionConfigElements.sampleDataElement
        .querySelectorAll('tbody tr')
        .forEach((row) => {
            text += collectRow(row.querySelectorAll('td'));
        });

    return text;
}

/**
 * Download all records in function sample data table
 * @param {PointerEvent} event
 */
function downloadFunctionSampleDataHandler(event) {
    const text = collectFunctionSampleData();
    const processName = document.getElementById('processName').value.trim();
    const functionName =
        document
            .getElementById('functionName')
            .querySelector('option:checked')
            ?.innerHTML?.trim() ?? '';
    const systemName = functionConfigElements.systemNameElement.value.trim();
    const fileName = `${processName}_${functionName}_${systemName}_Result.tsv`;
    downloadText(fileName, text);
    showToastrMsg(
        document.getElementById('i18nStartedTSVDownload').textContent,
        MESSAGE_LEVEL.INFO,
    );
}

/**
 * Copy all records in function sample data table
 * @param {PointerEvent} event
 */
function copyFunctionSampleDataHandler(event) {
    const text = collectFunctionSampleData();

    // Use the Clipboard API to write the HTML to the clipboard
    navigator.clipboard
        .writeText(text)
        .then(
            showToastCopyToClipboardSuccessful,
            showToastCopyToClipboardFailed,
        );
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
 *
 */
(() => {
    // Add events to buttons
    $(functionConfigElements.functionNameElement).on(
        'change',
        changeFunctionNameEvent,
    );
    functionConfigElements.newBtn.addEventListener(
        'click',
        showFunctionDetailsModal,
    );
    functionConfigElements.copyBtn.addEventListener(
        'click',
        showRegisteredFunctionsModal,
    );
    functionConfigElements.setBtn.addEventListener(
        'click',
        addOrUpdateFunctionInfo,
    );
    functionConfigElements.deleteBtn.addEventListener(
        'click',
        showDeleteFunctionConfirmation,
    );
    functionConfigElements.registerBtn.addEventListener(
        'click',
        registerFunctionInfo,
    );
    functionConfigElements.downloadAllBtn.addEventListener(
        'click',
        downloadAllFunctionInfo,
    );
    functionConfigElements.copyAllBtn.addEventListener(
        'click',
        copyAllFunctionInfo,
    );
    functionConfigElements.pasteAllBtn.addEventListener(
        'click',
        pasteAllFunctionInfo,
    );
    functionConfigElements.searchInput.addEventListener(
        'keyup',
        searchInputHandler,
    );
    functionConfigElements.setFilterBtn.addEventListener(
        'click',
        setFilterButtonHandler,
    );
    functionConfigElements.resetBtn.addEventListener(
        'click',
        resetButtonHandler,
    );
    functionConfigElements.reloadBtn.addEventListener(
        'click',
        reloadFunctionInfo,
    );
    functionConfigElements.selectAllFunctionColumns.addEventListener(
        'change',
        handleCheckAllFunctionColumns,
    );
    functionConfigElements.selectErrorFunctionColumns.addEventListener(
        'change',
        handleCheckErrorFunctionColumns,
    );
    $(functionConfigElements.functionNameElement).on(
        'change',
        handleShowResultData,
    );
    $(functionConfigElements.varXElement).on('change', handleShowResultData);
    $(functionConfigElements.varYElement).on('change', handleShowResultData);
    functionConfigElements.coeANSElement.addEventListener(
        'change',
        validateCoeInput,
    );
    functionConfigElements.coeBKElement.addEventListener(
        'change',
        validateCoeInput,
    );
    functionConfigElements.coeCTElement.addEventListener(
        'change',
        validateCoeInput,
    );
    functionConfigElements.systemNameElement.addEventListener(
        'change',
        handleChangeSystemName,
    );
    functionConfigElements.japaneseNameElement.addEventListener(
        'change',
        checkAnyChanges,
    );
    functionConfigElements.localNameElement.addEventListener(
        'change',
        checkAnyChanges,
    );
    functionConfigElements.noteElement.addEventListener(
        'change',
        checkAnyChanges,
    );
    functionConfigElements.searchFunctionNameInput.addEventListener(
        'keyup',
        searchFunctionNameInputHandler,
    );
    functionConfigElements.existFunctionSearchInput.addEventListener(
        'keyup',
        searchExistFunctionInputHandler,
    );
    functionConfigElements.downloadSampleDataBtn.addEventListener(
        'click',
        downloadFunctionSampleDataHandler,
    );
    functionConfigElements.copySampleDataBtn.addEventListener(
        'click',
        copyFunctionSampleDataHandler,
    );

    removeAllSyncEvents = syncInputConfigAndTable();
    setTimeout(enableDragAndDropFunctionTable, 100);
    showHideCopyPasteFunctionConfigButtons();
})();
