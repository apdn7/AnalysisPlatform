const setStatusOfMainDatetimeCheckBox = (disabled = undefined, isChecked = undefined) => {
    if (isChecked !== undefined) {
        functionConfigElements.isMainDatetimeCheckboxElement.checked = isChecked;
    }
    if (disabled !== undefined) {
        functionConfigElements.isMainDatetimeCheckboxElement.disabled = disabled;
    }
};

const toggleStatusMainDatetimeCheckbox = (dataType) => {
    const isDatetimeType = [DataTypes.DATETIME.name].includes(dataType);
    const isDbSource = !!(prcPreviewData && prcPreviewData.is_rdb);
    const isInitializeProc = currentProcessId && isInitialize;

    // isInitialize
    if (isInitializeProc) {
        if (isDatetimeType && !isDbSource) {
            setStatusOfMainDatetimeCheckBox(false, undefined);
        } else {
            setStatusOfMainDatetimeCheckBox(true, false);
        }
        return;
    }
    // detail
    if (currentProcessId) {
        if (isDatetimeType && !isDbSource) {
            setStatusOfMainDatetimeCheckBox(true, undefined);
        } else {
            setStatusOfMainDatetimeCheckBox(true, false);
        }
        return;
    }
    // create new
    if (isDatetimeType && !isDbSource) {
        setStatusOfMainDatetimeCheckBox(false, undefined);
    } else {
        setStatusOfMainDatetimeCheckBox(true, false);
    }
};

const handlerClickIsMainDatetimeFunctionColumn = (e) => {
    const isChecked = e.checked;

    if (isChecked) {
        // todo check validation
        // show modal confirm if main::Datetime column is selected
        const isMainDatetimeSelected = isSelectedMainDatetimeInProcessConfig();
        // check function column has selected main:Datetime
        const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
        const mainDatetimeFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainDatetime);
        if (isMainDatetimeSelected || mainDatetimeFunctionCol) {
            $(functionConfigElements.confirmCheckIsMainDatetimeModal).modal('show');
        }
    } else {
        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainDatetime, '', {
            recordHistory: false,
            force: true,
        });
    }

    handleChangeFunctionOutput();
};

const handlerConfirmMainDatetime = () => {
    changeMainDatetimeToDatetime();
    handlerConfirmChangeMainDatetimeFunctionCol();
    removeDummyDatetimeColumn();
    $(functionConfigElements.confirmCheckIsMainDatetimeModal).modal('hide');
    const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
    spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainDatetime, true, {
        recordHistory: false,
        force: true,
    });
    handleChangeFunctionOutput();
};

const handlerCancelMainDatetime = () => {
    setStatusOfMainDatetimeCheckBox(false, false);
    $(functionConfigElements.confirmCheckIsMainDatetimeModal).modal('hide');
};

const changeMainDatetimeToDatetime = () => {
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const mainDatetimeRow = spreadsheet.mainDateTimeRow();
    if (mainDatetimeRow) {
        const shownDataTypeCell = mainDatetimeRow[PROCESS_COLUMNS.shown_data_type];
        spreadsheet.table.setValueFromCoords(
            shownDataTypeCell.columnIndex,
            shownDataTypeCell.rowIndex,
            DataTypes.DATETIME.selectionBoxDisplay,
            true,
        );
    }
};

const handlerConfirmChangeMainDatetimeFunctionCol = () => {
    const functionColumnInfos = FunctionInfo.collectAllFunctionRows();
    const mainDatetimeFunctionCol = functionColumnInfos.find((functionCol) => functionCol.isMainDatetime);
    if (mainDatetimeFunctionCol) {
        // change is main datetime col to normal col
        mainDatetimeFunctionCol.isMainDatetime = false;
        mainDatetimeFunctionCol.updateFunctionRow(false, true);
    }
};

const handlerConfirmUncheckMainDatetimeFunctionCol = () => {
    functionConfigElements.isMainDatetimeCheckboxElement.checked = false;
    const mainDatetimeFunctionCol = FunctionInfo.getMainDatetimeFunctionColumnRow();
    if (mainDatetimeFunctionCol) {
        const spreadsheet = spreadsheetFuncConfig(FUNCTION_TABLE_CONTAINER);
        spreadsheet.syncDataToSelectedRow(SpreadSheetFunctionConfig.ColumnNames.IsMainDatetime, '', {
            recordHistory: false,
            force: true,
            rowIndex: mainDatetimeFunctionCol.index - 1,
        });
        handleChangeFunctionOutput(mainDatetimeFunctionCol.index - 1, mainDatetimeFunctionCol.output);
    }

    // process config change to main::Serial
    const text = functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal.getAttribute('change-text');
    const rowIndex = Number(
        functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal.getAttribute('change-row-index'),
    );

    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const columnIndex = spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type);
    spreadsheet.table.setValueFromCoords(columnIndex, rowIndex, text, true);

    $(functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal).modal('hide');
};

/**
 * @description Handle show confirm modal if selected data type is main::Datetime and function column has main::Datetime col
 * @param currentRowData
 * @param value
 * @param rowIndex
 * @return {string|*} value
 */

const handleShowConfirmSelectMainDatetimeInProcessConfig = (currentRowData, value, rowIndex) => {
    const isMainDatetimeFunctionChecked = functionConfigElements.isMainDatetimeCheckboxElement.checked;
    const mainDatetimeFunctionCol = FunctionInfo.getMainDatetimeFunctionColumnRow();

    if (isMainDatetimeFunctionChecked || mainDatetimeFunctionCol) {
        $(functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal).modal('show');

        functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal.setAttribute('change-text', value);
        functionConfigElements.confirmUncheckMainDatetimeFunctionColumnModal.setAttribute('change-row-index', rowIndex);
        // In case show modal confirm -> not changed
        value = currentRowData.shown_data_type;
    }

    return value;
};

const removeDummyDatetimeColumn = () => {
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const dummyDatetimeRow = spreadsheet.dummyDateTimeRow();
    if (dummyDatetimeRow) {
        ProcessConfigSection.removeDummyDatetimeColumn(spreadsheet.table);
        spreadsheet.table.reIndexForSpecialRow(spreadsheet.table);
    }
};
