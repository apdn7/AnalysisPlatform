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
        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo, true, {
            recordHistory: false,
            force: true,
        });
        if (mainSerialFunctionColumnInfo) mainSerialFunctionColumnInfo.isMainSerialNo = true;
    } else {
        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo, '', {
            recordHistory: false,
            force: true,
        });
        if (mainSerialFunctionColumnInfo) mainSerialFunctionColumnInfo.isMainSerialNo = false;
    }

    handleChangeFunctionOutput();
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
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo, true, {
        recordHistory: false,
        force: true,
    });
    handleChangeFunctionOutput();
};

const changeMainSerialToSerial = () => {
    // change main::Serial:Int"/"main::Serial:Str in process config-> Serial:Int"/"Serial:Str
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const mainSerialRow = spreadsheet.mainSerialRow();
    if (mainSerialRow) {
        const shownDataType = DataTypeDropdown_Controller.convertColumnTypeAndDataTypeToShownDataType(
            masterDataGroup.SERIAL,
            mainSerialRow[PROCESS_COLUMNS.data_type].data,
        );
        const shownDataTypeCell = mainSerialRow[PROCESS_COLUMNS.shown_data_type];
        spreadsheet.table.setValueFromCoords(
            shownDataTypeCell.columnIndex,
            shownDataTypeCell.rowIndex,
            shownDataType,
            true,
        );
    }
};

const handlerConfirmChangeMainSerialFunctionCol = () => {
    const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
    const mainSerialFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainSerialNo);
    if (mainSerialFunctionCol) {
        // change is main serial col to normal col
        mainSerialFunctionCol.isMainSerialNo = false;
        mainSerialFunctionCol.updateFunctionRow(true);
    }
    // updateEditingMainSerialFunctionColumn();
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo, true, {
        recordHistory: false,
        force: true,
    });
    handleChangeFunctionOutput();

    $(functionConfigElements.confirmChangeIsMainSerialFunctionColumnModal).modal('hide');
};

const handlerCancelMainSerial = () => {
    functionConfigElements.isMainSerialCheckboxElement.checked = false;
    $(functionConfigElements.confirmCheckIsMainSerialModal).modal('hide');
};

const handlerConfirmChangeDefinitionMainSerialFunctionCol = () => {
    $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).modal('hide');
    // confirm change, reset main serial function column
    mainSerialFunctionColumnInfo = null;
};
const handlerCancelChangeDefinitionMainSerialFunctionCol = () => {
    // Undo
    const speadSheetFunctionColumn = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    speadSheetFunctionColumn.table.table.undo();
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
        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainSerialNo, '', {
            recordHistory: false,
            force: true,
            rowIndex: mainSerialFunctionCol.index - 1,
        });
        handleChangeFunctionOutput(mainSerialFunctionCol.index - 1, mainSerialFunctionCol.output);
    }
    // process config change to main::Serial
    const text = functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.getAttribute('change-text');
    const rowIndex = Number(
        functionConfigElements.confirmUncheckMainSerialFunctionColumnModal.getAttribute('change-row-index'),
    );

    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const columnIndex = spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type);
    spreadsheet.table.setValueFromCoords(columnIndex, rowIndex, text, true);
    $(functionConfigElements.confirmUncheckMainSerialFunctionColumnModal).modal('hide');
};

const updateEditingMainSerialFunctionColumn = () => {
    // sign to table config
    const functionColumnInfo = FunctionInfo.collectInputFunctionInfo();
    const selectedRow = functionConfigElements
        .functionTableElement()
        .lastElementChild.querySelector(`tr.${ROW_SELECTED_CLASS_NAME}`);
    if (selectedRow) {
        const selectedFunctionColumn = FunctionInfo.collectFunctionInfoByRow(selectedRow);
        if (Number(functionColumnInfo.functionColumnId) === Number(selectedFunctionColumn.functionColumnId)) {
            functionColumnInfo.updateFunctionRow();
        }
    }
};

const showModalAnyChangesInDefinitionMainSerialFunctionColumn = (columnName, newValue) => {
    const speadSheetFunctionColumn = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    const selectedRow = speadSheetFunctionColumn.selectedRow();
    if (
        selectedRow?.functionColumnId.data === mainSerialFunctionColumnInfo.functionColumnId &&
        mainSerialFunctionColumnInfo[columnName] != newValue
    ) {
        $(functionConfigElements.confirmAnyChangeDefinitionMainSerialFunctionColumnModal).modal('show');
    }
};
