/* eslint-disable no-unused-vars */
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

const ARRAY_ANS = ['a', 'n', 's'];
const ARRAY_BK = ['b', 'k'];
const ARRAY_CT = ['c', 't'];
let /** @type {function(): void} */ removeAllSyncEvents;

const functionConfigElements = {
    /** @type HTMLSelectElement */
    functionSettingModal: document.getElementById('functionSettingModal'),
    /** @type HTMLSelectElement */
    functionNameElement: document.getElementById('functionName'),
    /** @type HTMLSpanElement */
    outputElement: document.querySelector('#functionOutput span'),
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
    /** @type HTMLTableElement */
    sampleDataElement: document.getElementById('functionSampleData'),
    /** @type HTMLTableElement */
    functionTableElement: document.getElementById('functionTable'),
    /** @type HTMLSpanElement */
    totalCheckedFunctionColumnsElement: document.getElementById('totalCheckedFunctionColumns'),
    /** @type HTMLSpanElement */
    totalFunctionColumnsElement: document.getElementById('totalFunctionColumns'),
    /** @type HTMLSpanElement */
    functionUserSettingTableModal: document.getElementById('functionUserSettingModal'),
    /** @type HTMLSpanElement */
    functionUserSettingTableBody: document.querySelector('#functionUserSettingModal table[id=functionUserSettingTable] tbody'),
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
    copyAllBtn: document.getElementById('functionConfigModalCopyAllBtn'),
    /** @type HTMLButtonElement */
    pasteAllBtn: document.getElementById('functionConfigModalPasteAllBtn'),
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
        // format function sample data
        this.sampleDatas = sampleDatas.map(val => applySignificantDigit(val));
        this.isChecked = isChecked;
        this.isMeFunction = functionName.startsWith('me.');
        /** @type ?number */
        this.processColumnId = !(isNaN(processColumnId) || processColumnId == null || processColumnId === '')
            ? parseInt(processColumnId, 10)
            : null;
        /** @type ?number */
        this.functionColumnId = !(isNaN(functionColumnId) || functionColumnId == null || functionColumnId === '')
            ? parseInt(functionColumnId, 10)
            : null;
        /** @type ?number */
        this.functionId = !(isNaN(functionId) || functionId == null || functionId === '')
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
    }

    /**
     * Compare this function object is equal to input function object
     * @param {FunctionInfo} functionInfo - an input function object
     * @return {boolean} true is equal, otherwise
     */
    isEqual(functionInfo) {
        return (
            this.functionName === functionInfo.functionName
            && this.output === functionInfo.output
            && this.systemName === functionInfo.systemName
            && this.japaneseName === functionInfo.japaneseName
            && this.localName === functionInfo.localName
            && this.coeANS === functionInfo.coeANS
            && this.coeBK === functionInfo.coeBK
            && this.coeCT === functionInfo.coeCT
            && this.note === functionInfo.note
            && this.isMeFunction === functionInfo.isMeFunction
            && this.processColumnId === functionInfo.processColumnId
            && this.functionColumnId === functionInfo.functionColumnId
            && this.functionId === functionInfo.functionId
            && this.varX === functionInfo.varX
            && this.varY === functionInfo.varY
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
            varX = selectedVarXElement.value.trim();
            varXName = selectedVarXElement.textContent.trim();
            if (functionName.startsWith('me.')) { // In case of function me, process id will be id of varX
                processColumnId = varX;
            }
        }

        const selectedVarYElement = functionConfigElements.varYElement.querySelector('option:checked');
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

        const resultColumns = functionConfigElements
            .sampleDataElement.lastElementChild.querySelectorAll('td:first-child');
        const sampleDatas = [...resultColumns].map(element => element.textContent.trim());

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
        const columnFunctionName = rowElement.querySelector(`td.column-function-name`);
        const processColumnId = columnFunctionName.dataset.processColumnId;
        const functionColumnId = columnFunctionName.dataset.functionColumnId;
        const functionId = columnFunctionName.dataset.functionId;
        const functionName = columnFunctionName.querySelector('label').textContent.trim();
        const isChecked = columnFunctionName.querySelector('input').checked;
        const systemName = rowElement.querySelector(`td.column-system-name input`).value.trim();
        const japaneseName = rowElement.querySelector(`td.column-japanese-name input`).value.trim();
        const localName = rowElement.querySelector(`td.column-local-name input`).value.trim();
        const columnVarX = rowElement.querySelector(`td.column-var-x`);
        const varXName = columnVarX.textContent.trim();
        const varX = columnVarX.dataset.varX;
        const columnVarY = rowElement.querySelector(`td.column-var-y`);
        const varYName = columnVarY.textContent.trim();
        const varY = columnVarY.dataset.varY;
        const coeANS = rowElement.querySelector('td.column-coe-ans input').value.trim();
        const coeBK = rowElement.querySelector('td.column-coe-bk input').value.trim();
        const coeCT = rowElement.querySelector('td.column-coe-ct input').value.trim();
        const note = rowElement.querySelector('td.column-note input').value.trim();
        const output = rowElement.querySelector(`td.column-output`).dataset.rawDataType;
        const sampleDatas = [...rowElement.querySelectorAll('td.column-sample-data')].map(cell => cell.textContent.trim());

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
        functionConfigElements.varXElement.value = String(this.varX);
        $(functionConfigElements.varXElement).change();
        functionConfigElements.varYElement.value = String(this.varY);
        $(functionConfigElements.varYElement).change();
        functionConfigElements.coeANSElement.value = String(this.coeANS);
        functionConfigElements.coeBKElement.value = String(this.coeBK);
        functionConfigElements.coeCTElement.value = String(this.coeCT);
        functionConfigElements.noteElement.value = String(this.note);
        this.sampleDatas.forEach((sampleData, index) => {
            const cell = functionConfigElements.sampleDataElement.lastElementChild
                .querySelector(`tr:nth-child(${index + 1}) td:first-child`);
            cell.textContent = sampleData;
        });
    }

    /**
     * Reset invalid status of all inputs
     */
    static resetInvalidStatus() {
        functionConfigElements
            .functionSettingModal
            .querySelectorAll('.column-name-invalid')
            .forEach(el => el.classList.remove(BORDER_RED_CLASS));
    }

    /**
     * Handle select/unselect a row of table
     * @param {HTMLTableRowElement} rowElement - a select row HTML
     * @param {?HTMLTableRowElement=} previousRowElement - a previous selected row HTML
     */
    static selectRowHandler(rowElement, previousRowElement = null) {
        removeAllSyncEvents();
        if (previousRowElement != null) {
            previousRowElement.classList.remove('selected');
        }

        rowElement.classList.add('selected');
        const functionInfo = FunctionInfo.collectFunctionInfoByRow(rowElement);
        functionInfo.fillInputFunctionInfo();
        FunctionInfo.resetInvalidStatus();
        FunctionInfo.hideChangeMark();
    }

    /**
     * Sync sample data from config to table
     */
    static syncSampleDataToTable() {
        const selectedRow = functionConfigElements.functionTableElement.lastElementChild
            .querySelector('tr.selected');
        if (!selectedRow) {
            return;
        }
        const configSampleDataNodes = functionConfigElements.sampleDataElement.querySelectorAll('tbody>tr');
        const configSampleData = Array.from(configSampleDataNodes).map(node => node.firstElementChild.innerHTML);
        const tableSampleDataNodes = selectedRow.querySelectorAll('td.column-sample-data ');
        tableSampleDataNodes.forEach(
            (node, index) => {
                node.innerHTML = configSampleData[index];
            }
        );
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
        const selectedRowElement = rowElement.parentElement.querySelector('tr.selected');
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
            functionConfigElements.confirmSwitchEditingRow.dataset.index = rowElement.dataset.index;
            functionConfigElements.confirmSwitchEditingRow.dataset.previousIndex = selectedRowElement.dataset.index;
            $(functionConfigElements.functionConfigConfirmSwitchEditingRowModal).modal('show');
        } else {
            // in case non-exist select row
            FunctionInfo.selectRowHandler(rowElement);
        }
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
        totalCheckedColumns = checkBoxElement.checked ? totalCheckedColumns + 1 : totalCheckedColumns - 1
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
        return [...new Set(
            [...functionConfigElements
                .functionTableElement
                .lastElementChild
                .querySelectorAll('.row-invalid, .column-name-invalid')
            ].map(invalidTarget => invalidTarget instanceof HTMLTableRowElement
                ? invalidTarget
                : invalidTarget.closest('tr'))
        )];
    }

    /**
     * Update status check/uncheck of Error checkbox
     *
     * If it is checked, all invalid rows are checked. Otherwise.
     */
    static updateStatusErrorCheckbox() {
        const invalidRows = FunctionInfo.getInvalidRows();
        const invalidCheckedRows =
            invalidRows.filter(r => r.querySelector('input[name="columnName"]').checked);
        const allCheckedRows = functionConfigElements
            .functionTableElement
            .lastElementChild
            .querySelectorAll('input[name="columnName"]:checked');
        functionConfigElements.selectErrorFunctionColumns.checked = (
            invalidRows.length === invalidCheckedRows.length
            && invalidRows.length !== 0
            && allCheckedRows.length === invalidCheckedRows.length
        );
    }

    /**
     * Add a new row into Function table
     */
    addNewFunctionRow() {
        const {hasANS, hasBK, hasCT} = FunctionInfo.hasParams(this.functionId);
        const index = this.index;

        const newRowHtml = (
            `<tr data-index="${index}" checked="${this.isChecked ? 'checked' : ''}">`
            + `<td class="column-order text-center show-raw-text row-item" title="index">${index}</td>`
            + '<td class="column-function-name show-raw-text" title="is_checked"'
            + ` data-process-column-id="${this.processColumnId ?? ''}"`
            + ` data-function-column-id="${this.functionColumnId ?? ''}"`
            + ` data-function-id="${this.functionId ?? ''}">`
            + '<div class="custom-control custom-checkbox">'
            + '<input type="checkbox" class="check-item custom-control-input col-checkbox already-convert-hankaku"'
            + ` name="columnName" id="checkbox-column-${index}" ${this.isChecked ? 'checked' : ''}>`
            + `<label class="custom-control-label row-item for-search" for="checkbox-column-${index}"`
            + ` >${this.functionName ?? ''}</label>`
            + '</div>'
            + '</td>'
            + `<td class="column-system-name row-item" title="name_en">`
            + `<input type="text" name="name_en" class="form-control row-item" value="${this.systemName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>`
            + '</td>'
            + '<td class="column-japanese-name row-item" title="name_jp">'
            + `<input type="text" name="name_jp" class="form-control row-item" value="${this.japaneseName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>`
            + '</td>'
            + '<td class="column-local-name row-item" title="name_local">'
            + `<input type="text" name="name_local" class="form-control row-item" value="${this.localName ?? ''}" ${this.isMeFunction ? 'disabled' : ''}>`
            + '</td>'
            + `<td class="column-var-x row-item show-raw-text" title="x" data-var-x="${this.varX ?? ''}">${this.varXName ?? ''}</td>`
            + `<td class="column-var-y row-item show-raw-text" title="y" data-var-y="${this.varY ?? ''}">${this.varYName ?? ''}</td>`
            + `<td class="column-coe-ans row-item" title="a_n_s">`
            + `<input type="text" name="a_n_s" class="form-control row-item" value="${this.coeANS ?? ''}" ${!hasANS ? 'disabled' : ''}>`
            + '</td>'
            + `<td class="column-coe-bk row-item" title="b_k">`
            + `<input type="text" name="b_k" class="form-control row-item" value="${this.coeBK ?? ''}" ${!hasBK ? 'disabled' : ''}>`
            + '</td>'
            + `<td class="column-coe-ct row-item" title="c_t">`
            + `<input type="text" name="c_t" class="form-control row-item" value="${this.coeCT ?? ''}" ${!hasCT ? 'disabled' : ''}>`
            + '</td>'
            + `<td class="column-note row-item" title="note">`
            + `<input type="text" name="note" class="form-control row-item" value="${this.note ?? ''}">`
            + '</td>'
            + `<td class="column-output row-item show-raw-text" title="output" data-raw-data-type="${this.output ?? ''}">${FunctionInfo.getLabelRawDataType(this.output ?? '')}</td>`
            + `<td class="column-sample-data row-item show-raw-text" title="sample_data">${(this.sampleDatas[0] ?? '')}</td>`
            + `<td class="column-sample-data row-item show-raw-text" title="sample_data">${(this.sampleDatas[1] ?? '')}</td>`
            + `<td class="column-sample-data row-item show-raw-text" title="sample_data">${(this.sampleDatas[2] ?? '')}</td>`
            + `<td class="column-sample-data row-item show-raw-text" title="sample_data">${(this.sampleDatas[3] ?? '')}</td>`
            + `<td class="column-sample-data row-item show-raw-text" title="sample_data">${(this.sampleDatas[4] ?? '')}</td>`
            + '</tr>'
        );

        /** @type HTMLTableRowElement */
        const rowElement = htmlToElement(newRowHtml);
        rowElement.addEventListener('click', FunctionInfo.rowClickEvent);
        rowElement
            .querySelector('input[name="columnName"]')
            .addEventListener('change', FunctionInfo.changeSelectionStatusEvent);

        functionConfigElements.functionTableElement.lastElementChild.append(rowElement);

        // Set number of total records
        const totalColumns = parseInt(functionConfigElements.totalFunctionColumnsElement.textContent, 10);
        functionConfigElements.totalFunctionColumnsElement.textContent = String(totalColumns + 1);

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
        const {hasANS, hasBK, hasCT} = FunctionInfo.hasParams(this.functionId);
        const rowElement = functionConfigElements.functionTableElement.lastElementChild
            .querySelector(`tr[data-index="${this.index}"]`);
        const columnFunctionName = rowElement.querySelector(`td.column-function-name`);
        columnFunctionName.dataset.processColumnId = this.processColumnId;
        columnFunctionName.dataset.functionColumnId = this.functionColumnId;
        columnFunctionName.dataset.functionId = this.functionId;
        columnFunctionName.querySelector('label').textContent = this.functionName;

        rowElement.querySelector('td.column-system-name input').value = this.systemName;
        rowElement.querySelector('td.column-japanese-name input').value = this.japaneseName;
        rowElement.querySelector('td.column-local-name input').value = this.localName;

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
        const columnOutput = rowElement.querySelector(`td.column-output`)
        columnOutput.dataset.rawDataType = this.output;
        columnOutput.textContent = FunctionInfo.getLabelRawDataType(this.output);

        /** @type {NodeListOf<HTMLTableCellElement>} */
        const sampleCells = rowElement.querySelectorAll(`td.column-sample-data`);
        this.sampleDatas.forEach((data, index) => {
            sampleCells[index].textContent = data;
        });
    }

    /**
     * Remove a function row on table
     * @param {HTMLTableRowElement} rowElement - a function row HTML
     */
    static deleteFunctionRow(rowElement) {
        // Remove all events
        rowElement.removeEventListener('click', FunctionInfo.rowClickEvent);
        const checkboxElement = rowElement.querySelector('input[name="columnName"]');
        checkboxElement.removeEventListener('change', FunctionInfo.changeSelectionStatusEvent);
        const processColumnId = rowElement.querySelector(`td.column-function-name`).dataset.processColumnId;

        // Update number of checked records and total records
        const totalColumns = parseInt(functionConfigElements.totalFunctionColumnsElement.textContent, 10) - 1;
        functionConfigElements.totalFunctionColumnsElement.textContent = String(
            totalColumns < 0 ? 0 : totalColumns
        );
        if (checkboxElement.checked) {
            const selectedColumns = parseInt(functionConfigElements.totalCheckedFunctionColumnsElement.textContent, 10) - 1;
            functionConfigElements.totalCheckedFunctionColumnsElement.textContent = String(
                selectedColumns < 0 ? 0 : selectedColumns
            );
        }

        // Update status of checkbox
        if (
            functionConfigElements.selectAllFunctionColumns.checked
            && functionConfigElements.totalCheckedFunctionColumnsElement.textContent !== functionConfigElements.totalFunctionColumnsElement.textContent
            || functionConfigElements.totalFunctionColumnsElement.textContent.trim() === '0'
        ) {
            functionConfigElements.selectAllFunctionColumns.checked = false;
        }

        if (rowElement.classList.contains('selected')) {
            FunctionInfo.resetStatusOfEditingFunction(rowElement);
        }

        // Remove in X & Y select boxes
        [functionConfigElements.varXElement, functionConfigElements.varYElement].forEach(selectElement => {
            const isTargetOption = String(selectElement.value) === String(processColumnId);
            $(selectElement).find(`option[value="${processColumnId}"]`).remove();
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
        const funcDef = allMasterFunction.find(func => func.id === functionId);
        const hasANS = ARRAY_ANS.some(c => funcDef.coefs.includes(c));
        const hasBK = ARRAY_BK.some(c => funcDef.coefs.includes(c));
        const hasCT = ARRAY_CT.some(c => funcDef.coefs.includes(c));
        return {hasANS, hasBK, hasCT};
    }

    /**
     * Collect all function info in table
     * @param {boolean} isCollectOnlyCheckedRows - true: collect only checked rows, otherwise
     * @return {FunctionInfo[]} - a list of FunctionInfo objects
     */
    static collectAllFunctionRows(isCollectOnlyCheckedRows = false) {
        const result = [];
        [...functionConfigElements.functionTableElement.lastElementChild.children].forEach((row) => {
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
            dictSampleData[colId] = collectSampleData(colId);
        }
        return fetch('/ap/api/setting/function_config/get_function_infos', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                process_id: parseInt(processId, 10),
                dic_sample_data: dictSampleData
            }),
        })
            .then(response => response.clone().json())
            .then((/** @type {{functionData: {}}} */responseData) =>
                responseData
                    .functionData
                    .map(funcData => ({
                        ...funcData,
                        coeANS: funcData.a || funcData.n || funcData.s,
                        coeBK: funcData.b || funcData.k,
                        coeCT: funcData.c || funcData.t,
                    }))
            );
    }

    /**
     * Load function list on table & load function list
     * @param {Array.<Object>} functionData - list of functionData objects from functionInfosAPI
     */
    static loadFunctionListTableAndInitDropDown(functionData) {
        functionData
            .map(data => new FunctionInfo(data))
            .forEach(functionInfo => functionInfo.addNewFunctionRow());
        FunctionInfo.initDropdownFunctionName();
    }

    /**
     * Remove all rows of Function table
     */
    static removeAllFunctionRows() {
        [...functionConfigElements.functionTableElement.lastElementChild.children].forEach(
            /**
             * Remove event listener and row
             * @param {HTMLTableRowElement} row - a function row HTML
             */
            row => FunctionInfo.deleteFunctionRow(row)
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
        if (isResetFuncName) {
            [...functionConfigElements.functionNameElement.children].forEach(option => option.remove());
            $(functionConfigElements.functionNameElement).empty();
        }
        functionConfigElements.functionNameElement.dataset.index = '';
        functionConfigElements.functionNameElement.dataset.processColumnId = '';
        functionConfigElements.functionNameElement.dataset.functionColumnId = '';
        functionConfigElements.functionNameElement.dataset.dataType = '';
        FunctionInfo.setOutputDataType('');
        functionConfigElements.systemNameElement.value = '';
        functionConfigElements.systemNameElement.dataset.originGeneratedName = '';
        $(functionConfigElements.systemNameElement).removeClass(BORDER_RED_CLASS);
        functionConfigElements.japaneseNameElement.value = '';
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName = '';
        $(functionConfigElements.japaneseNameElement).removeClass(BORDER_RED_CLASS);
        functionConfigElements.localNameElement.value = '';
        functionConfigElements.localNameElement.dataset.originGeneratedName = '';
        $(functionConfigElements.localNameElement).removeClass(BORDER_RED_CLASS);

        $(functionConfigElements.varXElement).val('').change();
        $(functionConfigElements.varYElement).val('').change();
        [...functionConfigElements.varXElement.children].forEach(option => option.remove());
        [...functionConfigElements.varYElement.children].forEach(option => option.remove());
        functionConfigElements.coeANSElement.value = '';
        functionConfigElements.coeANSElement.required = false;
        $(functionConfigElements.coeANSElement).removeClass(BORDER_RED_CLASS);
        functionConfigElements.coeBKElement.value = '';
        functionConfigElements.coeBKElement.required = false;
        $(functionConfigElements.coeBKElement).removeClass(BORDER_RED_CLASS);
        functionConfigElements.coeCTElement.value = '';
        functionConfigElements.coeCTElement.required = false;
        $(functionConfigElements.coeCTElement).removeClass(BORDER_RED_CLASS);
        functionConfigElements.noteElement.value = '';
        functionConfigElements.sampleDataElement.lastElementChild.querySelectorAll('td')
            .forEach(td => td.textContent = '');

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
            selectedRow = functionConfigElements.functionTableElement.lastElementChild.querySelector('tr.selected');
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
        const showSerial = selectedFunction.getAttribute('show-serial') === 'true';

        const getTypes = (attributeName) => {
            let types = selectedFunction.getAttribute(attributeName).trim();
            types = types.split(SEPARATOR_CHAR);
            return types;
        }
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
            const $existOption = $varElement.find(`option[value="${columnId}"]`);
            if (supportTypes.includes(columnRawDataType) && $existOption.length === 0) {
                $varElement.append($('<option/>', newOption));
            } else if (!supportTypes.includes(columnRawDataType) && $existOption.length > 0) {
                $existOption.remove();
                if (columnId === selectedValue[keySelectedValue]) {
                    selectedValue[keySelectedValue] = '';
                }
            }
        }

        const removeOptions = (columnId, $varElement) => {
            $varElement.find(`option[value="${columnId}"]`).remove()
        }

        const normalColumns = currentProcDataCols
            .filter((col) => {
                const shouldSkipSerial = !showSerial && col.is_serial_no;
                return !shouldSkipSerial;
            });

        // remove previously added ignored columns
        const ignoreNormalColumns = currentProcDataCols.filter((col) => !showSerial && col.is_serial_no);

        ignoreNormalColumns
            .forEach((c) => {
                removeOptions(c.id, $varXElement);
                removeOptions(c.id, $varYElement);
            });

        const allFunctionInfos = FunctionInfo.collectAllFunctionRows();

        // if we are editing a row, we must exclude self and parents
        const ignoreFunctionColumns = [];
        const selectedRow = functionConfigElements.functionTableElement.lastElementChild.querySelector('tr.selected');
        if (selectedRow) {
            const selectedFunctionInfo = FunctionInfo.collectFunctionInfoByRow(selectedRow);
            ignoreFunctionColumns.push(selectedFunctionInfo.functionColumnId);
        }

        // remove all ignored function columns
        ignoreFunctionColumns.forEach((columnId) => {
            removeOptions(columnId, $varXElement);
            removeOptions(columnId, $varYElement);
        });

        const functionColumns = allFunctionInfos
            .filter(col => !col.isMeFunction && !ignoreFunctionColumns.includes(col.functionColumnId))
            .map((col) => {
                return {
                    'id': col.processColumnId,
                    'column_raw_name': col.systemName,
                    'raw_data_type': col.output,
                    'data_type': col.output,
                    'column_type': masterDataGroup.GENERATED_EQUATION,
                    'name_en': col.systemName,
                    'name_jp': col.japaneseName,
                    'name_local': col.localName,
                };
            });

        [...normalColumns, ...functionColumns].forEach((col) => {
            const options = {
                value: col.id,
                text: col.column_raw_name,
                'raw-data-type': col.data_type,
                'column-type': col.column_type,
                'name-sys': col.name_en,
                'name-jp': col.name_jp || '',
                'name-local': col.name_local || '',
            };

            updateOptions(col.id, col.data_type, $varXElement, xTypes, options, 'varXElement');
            updateOptions(col.id, col.data_type, $varYElement, yTypes, options, 'varYElement');
        });

        $varXElement.val(selectedValue['varXElement']).change();
        $varYElement.val(selectedValue['varYElement']).change();
    }

    /**
     * Initialize select2 for selection of Function Name
     */
    static initDropdownFunctionName() {
        const $functionNameElement = $(functionConfigElements.functionNameElement);

        const getMatchingParam = coefs => funcCoefs => coefs.find(e => funcCoefs.includes(e));
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

            $functionNameElement.append($('<option/>', {
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
                'function_name_en': func.function_name_en || '',
                'function_name_jp': func.function_name_jp || '',
                'description_en': func.description_en || '',
                'description_jp': func.description_jp || '',
                'output-data-type': '', // will be defined after calculating sample data
            }));
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
                label = document.getElementById(DataTypes.BIG_INT.i18nLabelID).textContent.trim();
                break;
            case DataTypes.INTEGER.name:
                label = document.getElementById(DataTypes.INTEGER.exp).textContent.trim();
                break;
            case DataTypes.TEXT.name:
                label = document.getElementById(DataTypes.TEXT.i18nLabelID).textContent.trim();
                break;
            case DataTypes.REAL.name:
                label = document.getElementById(DataTypes.REAL.i18nLabelID).textContent.trim();
                break;
            case DataTypes.DATETIME.name:
                label = document.getElementById(DataTypes.DATETIME.i18nLabelID).textContent.trim();
                break;
            case DataTypes.CATEGORY.name:
                label = document.getElementById(DataTypes.CATEGORY.i18nLabelID).textContent.trim();
                break;
            case DataTypes.BOOLEAN.name:
                label = document.getElementById(DataTypes.BOOLEAN.i18nLabelID).textContent.trim();
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
            case document.getElementById(DataTypes.BIG_INT.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.BIG_INT.bs_value;
                break;
            case document.getElementById(DataTypes.INTEGER.exp).textContent.trim():
                rawDataType = DataTypes.INTEGER.bs_value;
                break;
            case document.getElementById(DataTypes.SMALL_INT.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.SMALL_INT.bs_value;
                break;
            case document.getElementById(DataTypes.TEXT.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.TEXT.bs_value;
                break;
            case document.getElementById(DataTypes.REAL.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.REAL.bs_value;
                break;
            case document.getElementById(DataTypes.DATETIME.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.DATETIME.bs_value;
                break;
            case document.getElementById(DataTypes.CATEGORY.i18nLabelID).textContent.trim():
                rawDataType = DataTypes.CATEGORY.bs_value;
                break;
            case document.getElementById(DataTypes.BOOLEAN.i18nLabelID).textContent.trim():
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
        functionConfigElements.outputElement.innerHTML = FunctionInfo.getLabelRawDataType(rawDataType);
        functionConfigElements.outputElement.dataset.rawDataType = rawDataType;
    }

    /**
     * Set label for output data type of selected function
     * @param {string} labelDataType - a label data type string
     * @deprecated
     */
    static setOutputDataTypeByLabel(labelDataType) {
        functionConfigElements.outputElement.innerHTML = labelDataType;
        functionConfigElements.outputElement.dataset.rawDataType = FunctionInfo.getRawDataTypeByLabel(labelDataType);
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
            isValidColumnName = (
                inputFunctionInfo.output !== ''
                && (isMeFunction || (!isMeFunction && validateFunctionColumnName(inputFunctionInfo)))
            )
        } else {
            inputFunctionInfo = FunctionInfo.collectInputFunctionInfo();
        }
        const selectedFunction = functionConfigElements.functionNameElement.querySelector('option:checked');
        const isHasVarX = !functionConfigElements.varXElement.disabled;
        const isHasVarY = !functionConfigElements.varYElement.disabled;
        const isInvalidCoeANS = functionConfigElements.coeANSElement.classList.contains(BORDER_RED_CLASS);
        const isInvalidCoeBK = functionConfigElements.coeBKElement.classList.contains(BORDER_RED_CLASS);
        const isInvalidCoeCT = functionConfigElements.coeCTElement.classList.contains(BORDER_RED_CLASS);

        const isInvalidParams = selectedFunction == null
            || (isHasVarX && inputFunctionInfo.varX == null)
            || (isHasVarY && inputFunctionInfo.varY == null)
            || (functionConfigElements.coeANSElement.required && inputFunctionInfo.coeANS === '') || isInvalidCoeANS
            || (functionConfigElements.coeBKElement.required && inputFunctionInfo.coeBK === '') || isInvalidCoeBK
            || (functionConfigElements.coeCTElement.required && inputFunctionInfo.coeCT === '') || isInvalidCoeCT;

        if (isValidateAll) {
            return isValidColumnName && !isInvalidParams
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
                $(functionConfigElements.coeANSElement).addClass(BORDER_RED_CLASS);
            } else if (ARRAY_BK.includes(error.field)) {
                $(functionConfigElements.coeBKElement).addClass(BORDER_RED_CLASS);
            } else if (ARRAY_CT.includes(error.field)) {
                $(functionConfigElements.coeCTElement).addClass(BORDER_RED_CLASS);
            }
        }
    }

    /**
     * Update index and order of all function columns in table
     */
    static updateIndexRowsInTable() {
        [...functionConfigElements.functionTableElement.lastElementChild.children].forEach((tr, i) => {
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
    const rows = [...functionConfigElements.functionTableElement.lastElementChild.children];
    searchByValueOfTable(event, rows);
}

/**
 * Handle select rows that shown in filter
 * @param {PointerEvent} event - an event
 * @param {?boolean} isChecked - a flag to set status for checkboxes
 */
function setFilterButtonHandler(event, isChecked = true) {
    [...functionConfigElements.functionTableElement.lastElementChild.children]
        .forEach((row) => {
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
            message: 'Please input missing fields before creating new function.',
            is_error: true,
        });

        procModalElements.procModal.scrollTop(0);
        return;
    } else {
        hideAlertMessages();
    }

    const selectedFunction = functionConfigElements.functionTableElement.lastElementChild.querySelector('tr.selected');
    if (selectedFunction == null) {
        inputFunctionInfo.index = functionConfigElements.functionTableElement.lastElementChild.childElementCount + 1;
        inputFunctionInfo.isChecked = functionConfigElements.selectAllFunctionColumns.checked;
        inputFunctionInfo.functionColumnId = inputFunctionInfo.functionColumnId ?? FunctionInfo.getNewFunctionColumnId();
        inputFunctionInfo.processColumnId = inputFunctionInfo.processColumnId ?? FunctionInfo.getNewProcessColumnId();
        inputFunctionInfo.addNewFunctionRow();
    } else {
        inputFunctionInfo.updateFunctionRow();
        selectedFunction.classList.remove('selected');
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
    [...functionConfigElements.functionUserSettingTableBody.children].forEach(row => row.remove());
    const functionInfos = FunctionInfo.collectAllFunctionRows();
    let existFunctionParams = [];
    let htmlRows = '';
    functionInfos.forEach((functionInfo) => {
        const currentParams = [functionInfo.functionId, functionInfo.functionName, functionInfo.coeANS, functionInfo.coeBK, functionInfo.coeCT];
        if (!existFunctionParams.some(a => currentParams.every((v, i) => v === a[i]))) {
            existFunctionParams.push(currentParams);
            htmlRows += (
                `<tr onclick="copyFunctionHandle(this)">`
                + `<td class="sample-data show-raw-text" name="functionId" value="${functionInfo.functionId}" title="functionName">${functionInfo.functionName}</td>`
                + `<td class="sample-data show-raw-text" name="coeANS" title="coeANS">${functionInfo.coeANS}</td>`
                + `<td class="sample-data show-raw-text" name="coeBK" title="coeBK">${functionInfo.coeBK}</td>`
                + `<td class="sample-data show-raw-text" name="coeCT" title="coeCT">${functionInfo.coeCT}</td>`
                + `<td class="sample-data show-raw-text" name="note" title="note">${functionInfo.note}</td>`
                + '</tr>'
            );
        }
    });
    functionConfigElements.functionUserSettingTableBody.innerHTML = htmlRows;
    $(functionConfigElements.functionUserSettingTableModal).modal('show');
}

const validateFunctionColumnName = (inputFunctionInfo) => {
    if (isEmpty(inputFunctionInfo.systemName)) {
        $(functionConfigElements.systemNameElement).addClass(BORDER_RED_CLASS);
        return false;
    }

    let [systemNames, japaneseNames, localNames, ,] = getCheckedRowValues();
    FunctionInfo
        .collectAllFunctionRows()
        .filter(functionInfo => (
            Number(functionInfo.functionColumnId) !== Number(inputFunctionInfo.functionColumnId)
            && !functionInfo.isMeFunction
        ))
        .forEach(functionInfo => {
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
        let isValid = true;
        if (isArrayDuplicated(names.filter(name => !isEmpty(name)))) {
            // add red border to duplicated input
            $(inputElement).addClass(BORDER_RED_CLASS);
            isValid = false;
        } else {
            $(inputElement).removeClass(BORDER_RED_CLASS);
        }

        return isValid;
    }

    const isValidSystemName = setBorderInput(systemNames, functionConfigElements.systemNameElement);
    const isValidJapaneseName = setBorderInput(japaneseNames, functionConfigElements.japaneseNameElement);
    const isValidLocalName = setBorderInput(localNames, functionConfigElements.localNameElement);
    return isValidSystemName && isValidJapaneseName && isValidLocalName;
}

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
    // Expand input function info area
    $(functionConfigElements.collapseFunctionConfig).collapse('show');
    const isShowInJP = document.getElementById('select-language').value === 'ja';
    FunctionInfo.resetStatusOfEditingFunction();
    let functionContent = '';
    allMasterFunction.forEach((func) => {
        functionContent += (
            `<tr onclick="selectFunction(this)">`
            + `<td class="sample-data show-raw-text" name="functionId" title="Id">${func.id}</td>`
            + `<td class="sample-data show-raw-text" name="functionType"  title="Fucntion">${func.function_type}</td>`
            + `<td class="sample-data show-raw-text" name="functionDescription"  title="Description">${isShowInJP ? func.description_jp : func.description_en}</td>`
            + '</tr>'
        );
    });
    $('#functionDetails').append(functionContent);
    $('#functionDetailModal').modal('show');
}

/**
 * Show Delete Function Confirmation Dialog
 * @param {PointerEvent} event
 */
function showDeleteFunctionConfirmation(event) {
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach(row => row.remove());
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
            if (deletingProcessColumnIds.has(functionInfo.varX) || deletingProcessColumnIds.has(functionInfo.varY)) {
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
        .filter((functionInfo) => deletingFunctionColumnIds.has(functionInfo.functionColumnId))
        .forEach(function (functionInfo, index) {
            htmlRows += (
                `<tr>`
                + `<td class="sample-data show-raw-text" name="index" title="index" data-is-me-function="${functionInfo.isMeFunction}" data-process-column-id="${functionInfo.processColumnId}" data-function-column-id="${functionInfo.functionColumnId}">${index + 1}</td>`
                + `<td class="sample-data show-raw-text" name="systemName" title="systemName">${functionInfo.systemName}</td>`
                + `<td class="sample-data show-raw-text" name="japaneseName" title="japaneseName">${functionInfo.japaneseName}</td>`
                + `<td class="sample-data show-raw-text" name="localName" title="localName">${functionInfo.localName}</td>`
                + `<td class="sample-data show-raw-text" name="varXName" title="varXName" data-var-x-id="${functionInfo.varX}">${functionInfo.varXName}</td>`
                + `<td class="sample-data show-raw-text" name="varYName" title="varYName" data-var-y-id="${functionInfo.varY}">${functionInfo.varYName}</td>`
                + '</tr>'
            );
        });
    functionConfigElements.deleteFunctionColumnTableBody.innerHTML = htmlRows;
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
        functions: functions
    }

    loadingShowImmediately();
    fetch('api/setting/function_config', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then((res) => {
            if (res.hasOwnProperty('cfg_col_ids')) {
                hideAlertMessages();
                FunctionInfo.removeAllFunctionRows();
                FunctionInfo.resetStatusOfEditingFunction();
                FunctionInfo.resetInputFunctionInfo();
                FunctionInfo
                    .getAllFunctionInfosApi(procId, res.cfg_col_ids)
                    .then(FunctionInfo.loadFunctionListTableAndInitDropDown)
            } else {
                const errorResponses = res;
                const setErrorMsgs = new Set();
                for (const [functionColumnId, rowErrors] of Object.entries(errorResponses)) {
                    const row = functionConfigElements
                        .functionTableElement
                        .lastElementChild
                        .querySelector(`tr td[data-function-column-id='${functionColumnId}']`)
                        .parentNode;

                    // Reset the 'invalid' class from each element
                    row
                        .querySelectorAll('.column-name-invalid')
                        .forEach(element => element.classList.remove(BORDER_RED_CLASS));

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
                            errorMsg = $(procModali18n.duplicatedJapaneseName).text() || ''
                        } else if (fieldName === 'name_en') {
                            errorMsg = $(procModali18n.duplicatedSystemName).text() || '';
                        } else if (fieldName === 'name_local') {
                            errorMsg = $(procModali18n.duplicatedLocalName).text() || '';
                        } else {
                            errorMsg = rowError['msg'];
                        }

                        // Set class invalid to border red error targets
                        if (!fieldName) {
                            $(row).addClass('row-invalid');
                        } else {
                            const inputEle = row.querySelector(`input[name="${fieldName}"]`);
                            $(inputEle).addClass(BORDER_RED_CLASS);
                        }
                        setErrorMsgs.add(errorMsg);
                    }
                }

                // Show toast error messages
                const errorMsgs = Array.from(setErrorMsgs) || [];
                if (errorMsgs.length > 0) {
                    const messageStr = Array.from(errorMsgs).join('<br>');
                    displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                        message: messageStr,
                        is_error: true,
                        is_warning: false,
                    });
                }
            }
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
                displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                    message: messageStr,
                    is_error: true,
                    is_warning: false,
                });
            }
        });
    FunctionInfo.resetInputFunctionInfo(true, false);
    FunctionInfo.resetStatusOfEditingFunction();
    FunctionInfo.updateStatusErrorCheckbox();
    FunctionInfo.initDropdownFunctionName();
    loadingHide();
}

/**
 * Copy All Function Info
 * @param {PointerEvent} event
 */
function copyAllFunctionInfo(event) {
    let text = "";
    const headerText = [...functionConfigElements.functionTableElement.firstElementChild.firstElementChild.children]
        .map(th => {
            const columnName = th.dataset.columnName.trim();
            if (th.getAttribute('colspan') == null) {
                return columnName;
            }

            const quantity = parseInt(th.getAttribute('colspan'), 10);
            return Array(quantity).fill(columnName).join(TAB_CHAR);
        })
        .join(TAB_CHAR);
    const bodyText = [...functionConfigElements.functionTableElement.lastElementChild.children]
        .map(tr => [...tr.children]
            .map(td => {
                const inputEl = td.querySelector('input[type="text"]');
                if (inputEl != null) {
                    return inputEl.value.trim();
                }

                return td.textContent.trim();
            })
            .join(TAB_CHAR)
        )
        .join(NEW_LINE_CHAR);
    text = [headerText, bodyText].join(NEW_LINE_CHAR);

    let message = '';
    navigator.clipboard.writeText(text).then(function () {
        message = 'Table values copied to clipboard!';
        console.log(message);
        showToastrMsg(message, MESSAGE_LEVEL.INFO);
    }, function (err) {
        message = `Failed to copy text: ${err}`;
        console.error(message);
        showToastrMsg(message, MESSAGE_LEVEL.ERROR);
    });
}

/**
 * Paste All Function Info
 * @param event
 */
function pasteAllFunctionInfo(event) {
    const rawDataTypeTitle = {
        'r': $('#' + DataTypes.REAL.i18nLabelID).text(),
        't': $('#' + DataTypes.TEXT.i18nLabelID).text(),
        'd': $('#' + DataTypes.DATETIME.i18nLabelID).text(),
        'i': $('#' + DataTypes.INTEGER.exp).text(),
        'b_i': $('#' + DataTypes.BIG_INT.i18nLabelID).text(),
        'T': $('#' + DataTypes.CATEGORY.i18nLabelID).text(),
        'b': $('#' + DataTypes.BOOLEAN.i18nLabelID).text(),
        'date': $('#' + DataTypes.DATE.i18nLabelID).text(),
        'time': $('#' + DataTypes.TIME.i18nLabelID).text(),
    }
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
        'Function': 'functionName',
        'System Name': 'systemName',
        'Japanese Name': 'japaneseName',
        'Local Name': 'localName',
        'X/me': 'varXName',
        'Y': 'varYName',
        'a/n/s': 'coeANS',
        'b/k': 'coeBK',
        'c/t': 'coeCT',
        'Note': 'note',
        'Output': 'output',
        'Sample Data': 'sampleDatas',
    }
    const handleError = (errorMessage) => {
        FunctionInfo.removeAllFunctionRows();
        funcInfos.forEach(funcInfo => funcInfo.addNewFunctionRow());

        const errMessage = `Failed to paste text: ${errorMessage}`;
        console.error(errMessage);
        showToastrMsg(errMessage, MESSAGE_LEVEL.ERROR);
    }

    navigator.clipboard.readText().then(function (text) {
        const table = functionConfigElements.functionTableElement;
        let index = 0;
        let newColumnIndex = 0;
        const records = text.replace(/\r\n+$/, "").split('\r\n');
        const rows = [];
        for (const rec of records) {
            let row = rec.replace(/\t+$/, "");
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
        const noHeaderMessage = 'There is no header in copied text, Please also copy header!';
        const wrongHeaderMessage = 'Copied text is wrong format, Please correct header!';
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

            for (let columnIndex = 0; columnIndex < headerRow.length; columnIndex++) {
                const columnName = headerRow[columnIndex];
                if (mapColumnNameDict[columnName] === mapColumnNameDict['Sample Data']) {
                    params[mapColumnNameDict[columnName]].push(row[columnIndex]);
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
                params.output = Object.keys(rawDataTypeTitle).find(key => rawDataTypeTitle[key] === params.output);
            }

            const inputFunctionInfo = new FunctionInfo(params);
            inputFunctionInfo.addNewFunctionRow();
            FunctionInfo.resetStatusOfEditingFunction();
        }

        let message = "Table values pasted from clipboard!";
        console.info(message);
        showToastrMsg(message, MESSAGE_LEVEL.INFO);
        if (hasInvalidFunction) {
            message = "There are some invalid functions in copied text!";
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
    [...functionConfigElements.deleteFunctionColumnTableBody.children].forEach(tr => {
        const numberCell = tr.firstElementChild;
        const columnId = numberCell.dataset.functionColumnId;
        functionConfigElements
            .functionTableElement
            .lastElementChild
            .querySelectorAll(`tr td[data-function-column-id='${columnId}']`)
            .forEach((columnFunctionName) => {
                const rowElement = columnFunctionName.parentElement;
                FunctionInfo.deleteFunctionRow(rowElement);
                FunctionInfo.updateIndexRowsInTable();
            });
    });

    closeDelFunctionColsModal();
};

const closeDelFunctionColsModal = () => {
    $('#deleteFunctionColumnModal').modal('hide');
};

/**
 * Search Rows By Value Of Table
 * @param {KeyboardEvent} event - a keyboard event
 * @param {HTMLTableRowElement[]} rows - list of rows in searching table
 */
const searchByValueOfTable = (event, rows) => {
    const filterValue = stringNormalization(event.currentTarget.value.trim().toLowerCase());
    if (filterValue === '') { // In case of non filter
        rows.forEach(row => {
            row.classList.remove('gray');
            row.style.display = '';
        });

        return;
    }

    // Search rows that include searching value
    const newValue = makeRegexForSearchCondition(filterValue).toLowerCase();
    let regex = null;
    try {
        regex = new RegExp(newValue.toLowerCase(), 'i');
    } catch {
        regex = { test: (v) => false };
    }
    const mappedRows = rows.filter(row => {
        const firstMappedColumn = [...row.querySelectorAll('td')]
            .find(col => {
                const text = (col.childElementCount && col.firstElementChild.tagName === 'INPUT'
                    ? col.firstElementChild.value
                    : col.textContent).trim().toLowerCase();
                return regex.test(text) || text.includes(filterValue);
            });
        return firstMappedColumn != null;
    });

    // Make un-mapped rows gray/invisible. Otherwise
    if (event.key === "Enter") { // In case of Enter
        rows.forEach(row => {
            if (!mappedRows.includes(row)) {
                row.classList.add('gray');
            } else {
                row.classList.remove('gray');
            }

            row.style.display = '';
        });
    } else { // In case of searching
        rows.forEach(row => {
            if (!mappedRows.includes(row)) {
                row.classList.add('gray');
                row.style.display = 'none';
            } else {
                row.classList.remove('gray');
                row.style.display = '';
            }
        });
    }
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
        ...functionConfigElements
            .functionTableElement
            .lastElementChild
            .children
    ];
    allRows.forEach(row => changeRowSelectStatus(row, el.checked));
}

/**
 * Handle checking/unchecking error function columns
 * @param {Event} event - checkbox HTML object
 */
function handleCheckErrorFunctionColumns(event) {
    /** @type {HTMLInputElement} */
    const el = event.currentTarget;
    const invalidRows = FunctionInfo.getInvalidRows();
    [...functionConfigElements.functionTableElement.lastElementChild.children].forEach(row => {
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
const handleShowResultData = (event) => {
    checkAnyChanges(event);

    // check all input fill
    const isValid = FunctionInfo.validateInputFunctionInfo();
    if (isValid) {
        setTimeout(showResultFunction, 200);
    }
};

/**
 * Replace characters which are not alphabet
 * @param {string} name - a name
 * @return {string} - a name without special characters
 */
const correctEnglishName = (name) => name == null ? name : name.replace(/[^\w-]+/g, '');

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
    const selectedRow = functionConfigElements.functionTableElement.lastElementChild
        .querySelector('tr.selected');
    if (selectedRow != null) {
        const inputFunction = FunctionInfo.collectInputFunctionInfo();
        const selectedFunction = FunctionInfo.collectFunctionInfoByRow(selectedRow);
        if (inputFunction.isEqual(selectedFunction)) {
            FunctionInfo.hideChangeMark();
        } else {
            FunctionInfo.showChangeMark();
        }
    } else {
        const inputFunction = FunctionInfo.collectInputFunctionInfo();
        if (
            inputFunction.functionId != null && !isNaN(inputFunction.functionId)
            || inputFunction.output !== ''
            || inputFunction.systemName !== ''
            || inputFunction.japaneseName !== ''
            || inputFunction.localName !== ''
            || inputFunction.varX != null && !isNaN(inputFunction.varX)
            || inputFunction.varY != null && !isNaN(inputFunction.varY)
            || inputFunction.coeANS !== ''
            || inputFunction.coeBK !== ''
            || inputFunction.coeCT !== ''
            || inputFunction.note !== ''
        ) {
            FunctionInfo.showChangeMark();
        } else {
            FunctionInfo.hideChangeMark();
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

    // Clear sample data result
    functionConfigElements.sampleDataElement.lastElementChild
        .querySelectorAll('td:first-child')
        .forEach(td => td.textContent = '');
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
        $(functionConfigElements.varXElement).val(functionConfigElements.varXElement.value).change();
    } else {
        functionConfigElements.varXElement.disabled = true;
        $(functionConfigElements.varXElement).val('').change();
    }

    if (isHasYParam) {
        functionConfigElements.varYElement.disabled = false;
        $(functionConfigElements.varYElement).val(functionConfigElements.varYElement.value).change();
    } else {
        functionConfigElements.varYElement.disabled = true;
        $(functionConfigElements.varYElement).val('').change();
    }

    const changeStatusLabel = (attributeName, coeElement, coeLabelElement) => {
        const coeLabel = selectedOption.getAttribute(attributeName);
        const defaultValue = selectedOption.getAttribute(`${DEFAULT_VALUE_PREFIX}${attributeName}`) || '';
        const required = selectedOption.getAttribute(`${REQUIRED_VALUE_PREFIX}${attributeName}`) === "true";

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
    const fullLengthMsg = isShowInJP ? selectedOption.getAttribute('description_jp') : selectedOption.getAttribute('description_en');
    // no longer support, change to css to overflow long text
    // const maximumLength = 200;
    // functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg.length > maximumLength ? fullLengthMsg.substring(0, maximumLength) + '...' : fullLengthMsg;
    functionConfigElements.helperMessageElement.innerHTML = fullLengthMsg;
    functionConfigElements.helperMessageElement.title = fullLengthMsg;
};

const validateCoeInput = (event) => {
    const inputValue = event.target.value;
    const coeLabel = event.target.parentElement.parentElement.querySelector('label').textContent[0];
    let isValid = true;
    if (['a', 'b', 'c'].includes(coeLabel)) {
        isValid = isNumberOrInf(inputValue);
    } else if (['n', 'k'].includes(coeLabel)) {
        isValid = isInteger(inputValue);
    }
    if (event.target.required && inputValue === '') {
        isValid = false;
    }
    if (isValid) {
        $(event.target).removeClass(BORDER_RED_CLASS);
        handleShowResultData(event);
    } else {
        $(event.target).addClass(BORDER_RED_CLASS);
    }
}

const isNumberOrInf = (inputValue) => {
    // validate number input only
    if (['', '-inf', 'inf'].includes(inputValue)) {
        return true;
    }
    return !isNaN(inputValue);
}

/**
 * Generate Function Column Names (JP, System, Local)
 * @param {HTMLOptionElement} selectedColumn - an option HTML object
 * @param {HTMLOptionElement} selectedFunction - an option HTML object
 */
function generateFunctionColumnNames(selectedColumn, selectedFunction) {
    // Set default system name if it is new function column (not editing mode)
    const selectedRow = functionConfigElements
        .functionTableElement
        .lastElementChild
        .querySelector('tr.selected');
    if (
        selectedRow == null
        && functionConfigElements.systemNameElement.dataset.originGeneratedName === functionConfigElements.systemNameElement.value
        && functionConfigElements.japaneseNameElement.dataset.originGeneratedName === functionConfigElements.japaneseNameElement.value
        && functionConfigElements.localNameElement.dataset.originGeneratedName === functionConfigElements.localNameElement.value
    ) {
        const selectedFunctionNameJp = selectedFunction.getAttribute('function_name_jp');
        const selectedFunctionNameEn = correctEnglishName(selectedFunction.getAttribute('function_name_en'));
        let suffix = '';
        const selectedColumnSystemName = selectedColumn.getAttribute('name-sys').trim();
        const selectedColumnJapaneseName = selectedColumn.getAttribute('name-jp').trim();
        const selectedColumnLocalName = selectedColumn.getAttribute('name-local').trim();
        const searchName = `${selectedColumnSystemName}_${selectedFunctionNameEn}`.replaceAll(' ', '_');
        const sameColumnNames = [
            ...functionConfigElements
                .functionTableElement
                .lastElementChild
                .querySelectorAll(`td.column-system-name input`)
        ]
            .filter(input => input.value.includes(searchName))
            .map(input => input.value.trim());
        const prefix = `${searchName}_`;
        const validSameColumnNames = sameColumnNames
            .filter(name => name.includes(prefix) && name.replace(prefix, '').match(/^\d{2}$/) != null)
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
                nameElement.value =
                    `${selectedColumnName}_${selectedFunctionName}${suffix}`
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
            .forEach(td => td.textContent = '');

        return;
    }

    // Get sample data of selected column
    const selectedColumn = el.selectedOptions[0];
    const columnId = selectedColumn.value;
    const columnType = selectedColumn.getAttribute('column-type');
    const selectedFunction = functionConfigElements.functionNameElement.selectedOptions[0];
    const isMeFunction = selectedFunction.text.startsWith('me.');
    if (isMeFunction) {
        functionConfigElements.systemNameElement.value = selectedColumn.getAttribute('name-sys');
        functionConfigElements.systemNameElement.dataset.originGeneratedName = functionConfigElements.systemNameElement.value;
        functionConfigElements.japaneseNameElement.value = selectedColumn.getAttribute('name-jp');
        functionConfigElements.japaneseNameElement.dataset.originGeneratedName = functionConfigElements.japaneseNameElement.value;
        functionConfigElements.localNameElement.value = selectedColumn.getAttribute('name-local');
        functionConfigElements.localNameElement.dataset.originGeneratedName = functionConfigElements.localNameElement.value;
    }
    let sampleDataValues = [];
    if (Number(columnType) === masterDataGroup.GENERATED_EQUATION) {
        const row = $(functionConfigElements.functionTableElement).find(`tr td[data-process-column-id=${columnId}]`).parent().last();
        sampleDataValues = [...row.find('td.column-sample-data')]
            .map(dataEl => dataEl.textContent.trim());
    } else {
        const rows = $(functionConfigElements.functionTableElement).find(`tr td[data-var-x=${columnId}]`).parent();
        if (rows.length) {
            const childrenMeFunctionRows = [];
            for (const row of rows) {
                const functionName = $(row).find(`td[title="is_checked"] label`).text();
                if (functionName.startsWith('me.')) {
                    childrenMeFunctionRows.push(row);
                }
            }
            if (childrenMeFunctionRows.length) {
                sampleDataValues = [...$(childrenMeFunctionRows.at(-1)).find('td.column-sample-data')]
                    .map(dataEl => dataEl.textContent.trim());
            } else {
                sampleDataValues = collectSampleData(columnId);
            }
        } else {
            sampleDataValues = collectSampleData(columnId);
        }
    }
    const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(${colTableIdx})`);
    for (const index of Array(5).keys()) {
        $(elements[index]).html(sampleDataValues[index]);
    }

    // Set default system name if it is new function column (not editing mode)
    if (colTableIdx === 2 && !isMeFunction) {
        generateFunctionColumnNames(selectedColumn, selectedFunction);
    }
};

/**
 * Get sample data based on column ids
 * @param {number} columnId
 * @return {string[]} - a list that contains sample data
 */
const collectSampleData = (columnId) => {
    const colIdx =
        procModalElements.processColumnsTableBody.find(`td[title="index"][data-column-id="${columnId}"]`).attr('data-col-idx');
    const vals = [...procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${colIdx}) .sample-data`)].map(el => $(el));
    let sampleDataValues = [];
    for (const e of vals) {
        let val = e.text().trim();
        sampleDataValues.push(val);
    }
    return sampleDataValues;
};

const collectEquationSampleData = (idx) => {
    const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(${idx})`);
    let sampleDataValues = [];
    for (const e of elements) {
        sampleDataValues.push($(e).text());
    }
    return sampleDataValues;
};

/**
 * Show sample datas base on function inputs
 */
const showResultFunction = () => {
    const xValues = collectEquationSampleData(2);
    const yValues = collectEquationSampleData(3);
    const xDataType = $(functionConfigElements.varXElement).find(':selected').attr('raw-data-type');
    const yDataType = $(functionConfigElements.varYElement).find(':selected').attr('raw-data-type');
    const selectedFunction = $(functionConfigElements.functionNameElement).find(":selected");
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
        equation_id: equationId
    };
    loadingShowImmediately();
    fetch('/ap/api/setting/function_config/sample_data', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then((data) => {
            if (data.hasOwnProperty('errors')) {
                loadingHide();
                FunctionInfo.showErrorField(data.errors);
            } else {
                const resultValues = jsonParse(data.sample_data);
                FunctionInfo.setOutputDataType(data.output_type);
                const elements = $(functionConfigElements.sampleDataElement).find(`tbody tr td:nth-child(1)`);
                for (const index of Array(5).keys()) {
                    let val = resultValues[index];
                    if (data.output_type === DataTypes.DATETIME.name) {
                        val = parseDatetimeStr(val);
                    }
                    $(elements[index]).html(applySignificantDigit(val));
                }
                loadingHide();
                FunctionInfo.syncSampleDataToTable()
            }
        })
        .catch((res) => {
            console.log("Error result function");
            loadingHide();
            // FunctionInfo.showErrorField(res.responseJSON.errors);
        });
};

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
    const selectRowElement = functionConfigElements.functionTableElement.lastElementChild
        .querySelector(`tr[data-index="${element.dataset.index}"]`);
    const previousSelectedRowElement = functionConfigElements.functionTableElement.lastElementChild
        .querySelector(`tr[data-index="${element.dataset.previousIndex}"]`);
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
    }
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
    }
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
    const masterFunction = allMasterFunction.find(f => String(f.id ?? '') === String(functionId ?? ''));
    const {
        a = null,
        b = null,
        c = null,
        n = null,
        k = null,
        s = null,
        t = null,
    } = Object.fromEntries((masterFunction ?? {'coefs': []}).coefs.map(argumentLabel => {
        let value = null;
        if (ARRAY_ANS.includes(argumentLabel)) {
            value = coeANS;
        } else if (ARRAY_BK.includes(argumentLabel)) {
            value = coeBK;
        } else if (ARRAY_CT.includes(argumentLabel)) {
            value = coeCT;
        }
        return [argumentLabel, value];
    }));
    return {a, b, c, n, k, s, t};
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
            order: functionInfo.index
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
    const allColumnIds = currentProcDataCols.map(col => col.id);
    FunctionInfo
        .getAllFunctionInfosApi(procId, allColumnIds)
        .then(FunctionInfo.loadFunctionListTableAndInitDropDown)
        .finally(loadingHide);
}

/**
 * Register change 'class' event for all elements in tbody of {@link functionConfigElements.functionTableElement}.
 * Only handle for inject/remove sync input events.
 */
function syncInputConfigAndTable() {
    /** @type {Array.<{addEvent: function, removeEvent: function}>} **/
    let configAndTableEvents = []

    const removeAllSyncEvents = () => configAndTableEvents.forEach(v => v.removeEvent());

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
                        syncInputConfigAndTableEvents(functionConfigElements.coeANSElement, rowElement.querySelector('input[name="a_n_s"]'), true),
                        syncInputConfigAndTableEvents(functionConfigElements.coeBKElement, rowElement.querySelector('input[name="b_k"]'), true),
                        syncInputConfigAndTableEvents(functionConfigElements.coeCTElement, rowElement.querySelector('input[name="c_t"]'), true),
                        // sync without reload
                        syncInputConfigAndTableEvents(functionConfigElements.noteElement, rowElement.querySelector('input[name="note"]'), false),
                        syncInputConfigAndTableEvents(functionConfigElements.systemNameElement, rowElement.querySelector('input[name="name_en"]'), false),
                        syncInputConfigAndTableEvents(functionConfigElements.japaneseNameElement, rowElement.querySelector('input[name="name_jp"]'), false),
                        syncInputConfigAndTableEvents(functionConfigElements.localNameElement, rowElement.querySelector('input[name="name_local"]'), false),
                        // sync select dropdown
                        syncSelectConfigAndTableEvents(functionConfigElements.varXElement, rowElement.querySelector('td.column-var-x')),
                        syncSelectConfigAndTableEvents(functionConfigElements.varYElement, rowElement.querySelector('td.column-var-y')),
                    ];
                    // apply new events
                    configAndTableEvents.forEach(e => e.addEvent());
                }
            }
        }
    });

    // only listen for class selected changes
    observer.observe(functionConfigElements.functionTableElement.lastElementChild, {
        subtree: true,
        attributeOldValue: true,
        attributeFilter: ['class'],
    });

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
        $(functionConfigElements.functionTableElement.lastElementChild).sortable("destroy");
    } catch (e) {
        console.log(e);
    }
}

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
    functionConfigElements.registerBtn.addEventListener('click', registerFunctionInfo);
    functionConfigElements.copyAllBtn.addEventListener('click', copyAllFunctionInfo);
    functionConfigElements.pasteAllBtn.addEventListener('click', pasteAllFunctionInfo);
    functionConfigElements.searchInput.addEventListener('keyup', searchInputHandler);
    functionConfigElements.setFilterBtn.addEventListener('click', setFilterButtonHandler);
    functionConfigElements.resetBtn.addEventListener('click', resetButtonHandler);
    functionConfigElements.reloadBtn.addEventListener('click', reloadFunctionInfo);
    functionConfigElements.selectAllFunctionColumns.addEventListener('change', handleCheckAllFunctionColumns);
    functionConfigElements.selectErrorFunctionColumns.addEventListener('change', handleCheckErrorFunctionColumns);
    $(functionConfigElements.functionNameElement).on('change', handleShowResultData);
    $(functionConfigElements.varXElement).on('change', handleShowResultData);
    $(functionConfigElements.varYElement).on('change', handleShowResultData);
    functionConfigElements.coeANSElement.addEventListener('change', validateCoeInput);
    functionConfigElements.coeBKElement.addEventListener('change', validateCoeInput);
    functionConfigElements.coeCTElement.addEventListener('change', validateCoeInput);
    functionConfigElements.systemNameElement.addEventListener('change', handleChangeSystemName);
    functionConfigElements.japaneseNameElement.addEventListener('change', checkAnyChanges);
    functionConfigElements.localNameElement.addEventListener('change', checkAnyChanges);
    functionConfigElements.noteElement.addEventListener('change', checkAnyChanges);
    functionConfigElements.searchFunctionNameInput.addEventListener('keyup', searchFunctionNameInputHandler);
    functionConfigElements.existFunctionSearchInput.addEventListener('keyup', searchExistFunctionInputHandler);

    removeAllSyncEvents = syncInputConfigAndTable();
    setTimeout(enableDragAndDropFunctionTable, 100);
})();
