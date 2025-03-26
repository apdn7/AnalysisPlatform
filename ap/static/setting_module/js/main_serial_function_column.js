/**
 *  Handler show message when click
 */
const handlerClickIsMainSerialFunctionColumn = (el) => {
    const isChecked = el.checked;
    if (isChecked) {
        if (functionConfigElements.functionNameElement.selectedOptions) {
            const isValid = isCanCheckMainSerial();
            if (!isValid) {
                // show message
                showToastrMsg($('#i18nSkipMainSerialFunctionMsg').text(), MESSAGE_LEVEL.WARN);
                // uncheck
                functionConfigElements.isMainSerialCheckboxElement.checked = false;
                //disable
                functionConfigElements.isMainSerialCheckboxElement.disabled = true;
                return;
            }
        }
        // check process config has column selected main:serial
        const isMainSerialSelected = isSelectedMainSerialInProcessConfig();
        if (isMainSerialSelected) {
            $(functionConfigElements.confirmCheckIsMainSerialModal).modal('show');
            return;
        }
        // check function column has selected main:serial
        const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
        const mainSerialFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainSerialNo);
        if (mainSerialFunctionCol) {
            // show modal confirm
            $(functionConfigElements.confirmChangeIsMainSerialFunctionColumnModal).modal('show');
            return;
        }
        updateEditingMainSerialFunctionColumn();
    } else {
        updateEditingMainSerialFunctionColumn();
    }
};
/**
 * check function column can check main::Serial
 * if fill.na or me function: skip
 * if column varX, varY create from fill.na or me function: skip
 * @returns {boolean}
 */

const isCanCheckMainSerial = () => {
    // skip fill.na and me function
    const skipFunctionIds = [90, 120, 121, 122, 130, 131, 160, 161, 162, 170, 171, 172, 190];
    const inputFunctionColumn = FunctionInfo.collectInputFunctionInfo();
    if (skipFunctionIds.includes(inputFunctionColumn.functionId)) {
        return false;
    }
    let isValid = true;
    const allFunctionColumns = FunctionInfo.collectAllFunctionRows();
    const dictColumns = allFunctionColumns.reduce((acc, column) => {
        acc[column.functionColumnId] = column;
        return acc;
    }, {});
    let visited = new Set();
    let remainFunctionColumnIds = [inputFunctionColumn.varX?.functionColumnId];
    remainFunctionColumnIds.push(inputFunctionColumn.varY?.functionColumnId);
    while (remainFunctionColumnIds.length) {
        const functionColumnId = remainFunctionColumnIds.pop();
        if (!functionColumnId) continue;
        if (!visited.has(functionColumnId)) {
            visited.add(functionColumnId);
            const column = dictColumns[functionColumnId];
            if (!column) continue;
            if (functionColumnId && skipFunctionIds.includes(column.functionId)) {
                isValid = false;
                break;
            }
            remainFunctionColumnIds.push(column.varX?.functionColumnId);
            remainFunctionColumnIds.push(inputFunctionColumn.varY?.functionColumnId);
        }
    }
    return isValid;
};

const handlerConfirmMainSerial = () => {
    changeMainSerialToSerial();
    $(functionConfigElements.confirmCheckIsMainSerialModal).modal('hide');
    updateEditingMainSerialFunctionColumn();
};

const changeMainSerialToSerial = () => {
    // change main::Serial:Int"/"main::Serial:Str in process config-> Serial:Int"/"Serial:St
    const mainSerialEle = document.querySelector('span[name=dataType][checked][is_main_serial_no=true]');
    const anotherDataTypeDropdownElement = mainSerialEle.closest('div.config-data-type-dropdown');
    let dataType = mainSerialEle.getAttribute('value');
    DataTypeDropdown_Helper.init(anotherDataTypeDropdownElement);
    $(anotherDataTypeDropdownElement).find(`li[is_serial_no][value=${dataType}]`).trigger('click');
};

const handlerConfirmChangeMainSerialFunctionCol = () => {
    const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
    const mainSerialFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainSerialNo);
    if (mainSerialFunctionCol) {
        // change is main serial col to normal col
        mainSerialFunctionCol.isMainSerialNo = false;
        mainSerialFunctionCol.updateFunctionRow();
    }
    $(functionConfigElements.confirmChangeIsMainSerialFunctionColumnModal).modal('hide');
    updateEditingMainSerialFunctionColumn();
};

const handlerCancelMainSerial = () => {
    functionConfigElements.isMainSerialCheckboxElement.checked = false;
    $(functionConfigElements.confirmCheckIsMainSerialModal).modal('hide');
};

const handlerConfirmChangeDefinitionMainSerialFunctionCol = () => {
    const isSyncConfigToTable =
        $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).attr(
            'sync-config-to-table',
        ) === 'true';
    let selectedRowInfo;
    if (isSyncConfigToTable) {
        // if sync config to table
        selectedRowInfo = FunctionInfo.collectInputFunctionInfo();
        selectedRowInfo.updateFunctionRow();
    } else {
        // if sync table to config
        const selectedRow = functionConfigElements.functionTableElement.lastElementChild.querySelector('tr.selected');
        selectedRowInfo = FunctionInfo.collectFunctionInfoByRow(selectedRow);
        selectedRowInfo.fillInputFunctionInfo();
    }
    $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).modal('hide');
    // update selected function column
    selectedFunctionColumnInfo = selectedRowInfo;
};
const handlerCancelChangeDefinitionMainSerialFunctionCol = () => {
    const isSyncConfigToTable =
        $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).attr(
            'sync-config-to-table',
        ) === 'true';
    // update system name, japanese name before rollback
    const selectedRow = FunctionInfo.collectInputFunctionInfo();
    selectedFunctionColumnInfo.systemName = selectedRow.systemName;
    selectedFunctionColumnInfo.japaneseName = selectedRow.japaneseName;
    selectedFunctionColumnInfo.localName = selectedRow.localName;
    selectedFunctionColumnInfo.note = selectedRow.note;
    if (isSyncConfigToTable) {
        // if sync config to table
        selectedFunctionColumnInfo.fillInputFunctionInfo();
    } else {
        // if sync table to config
        selectedFunctionColumnInfo.updateFunctionRow();
    }
    $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).modal('hide');
};

const handlerConfirmReloadFunctionCol = () => {
    FunctionInfo.removeAllFunctionRows();
    changeMainSerialToSerial();
    dbFunctionCols?.map((data) => new FunctionInfo(data))?.forEach((functionInfo) => functionInfo.addNewFunctionRow());
    FunctionInfo.initDropdownFunctionName();
    $(functionConfigElements.confirmReloadFunctionColumnModal).modal('hide');
};

const handlerConfirmUncheckMainSerialFunctionCol = () => {
    functionConfigElements.isMainSerialCheckboxElement.checked = false;
    // function config: uncheck main::Serial
    const mainSerialFunctionCol = FunctionInfo.getMainSerialFunctionColumnRow();
    if (mainSerialFunctionCol) {
        mainSerialFunctionCol.isMainSerialNo = false;
        mainSerialFunctionCol.updateFunctionRow();
    }
    // process config: change to main::Serial
    const value = functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.getAttribute('change-value');
    const text = functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.getAttribute('change-text');
    const columnIdx =
        functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.getAttribute('change-column-index');
    const changeRow = document.querySelector(`.column-number:not(:disabled)[data-col-idx="${columnIdx}"]`);
    const dataTypeDropdownElement = changeRow.closest('tr').querySelector('div.config-data-type-dropdown');
    const liElement = dataTypeDropdownElement.querySelector(`[value=${value}][is_main_serial_no]`);
    DataTypeDropdown_Helper.changeDataType(dataTypeDropdownElement, value, text, 'is_main_serial_no', liElement);
    $(functionConfigElements.confirmUncheckMainSerialFunctionColumnModal).modal('hide');
};

const updateEditingMainSerialFunctionColumn = () => {
    // sign to table config
    const functionColumnInfo = FunctionInfo.collectInputFunctionInfo();
    const selectedRow = functionConfigElements.functionTableElement.lastElementChild.querySelector('tr.selected');
    if (selectedRow) {
        const selectedFunctionColumn = FunctionInfo.collectFunctionInfoByRow(selectedRow);
        if (Number(functionColumnInfo.functionColumnId) === Number(selectedFunctionColumn.functionColumnId)) {
            functionColumnInfo.updateFunctionRow();
        }
    }
};

const isAnyChangesInDefinitionMainSerialFunctionColumn = (tableInput = null, isSyncConfigToTable = false) => {
    if (selectedFunctionColumnInfo?.isMainSerialNo && selectedFunctionColumnInfo?.functionColumnId > 0) {
        let editingFunctionColumnInfo;
        if (isSyncConfigToTable) {
            editingFunctionColumnInfo = FunctionInfo.collectInputFunctionInfo();
        } else {
            const rowElement = tableInput?.closest('tr');
            editingFunctionColumnInfo = FunctionInfo.collectFunctionInfoByRow(rowElement);
        }
        if (!editingFunctionColumnInfo.isEqualWithSelectedFunctionColumn()) {
            $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).attr(
                'sync-config-to-table',
                isSyncConfigToTable,
            );
            $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).modal('show');
            return true;
        }
    }
    return false;
};
