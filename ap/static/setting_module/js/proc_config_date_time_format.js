const initDatetimeFormatCheckboxAndInput = () => {
    // reset checkbox
    procModalElements.procDateTimeFormatCheckbox.prop('checked', false);
    procModalElements.procDateTimeFormatCheckbox.prop('disabled', false);

    // reset input
    procModalElements.procDateTimeFormatInput.prop('disabled', false);
    procModalElements.procDateTimeFormatInput.attr('placeholder', DATETIME_FORMAT_PLACE_HOLDER);

    // TODO: get format input here
    const shouldDisable = !!currentProcess;
    if (shouldDisable) {
        // TODO: add format input here
        // procModalElements.procDateTimeFormatInput.val(/* datetimeFormat */);
        procModalElements.procDateTimeFormatInput.prop('disabled', true);
        procModalElements.procDateTimeFormatInput.removeAttr('placeholder');
    }

    // default is uncheck, but will check if they have input
    const shouldCheck = currentProcess?.is_check_datetime_format;
    procModalElements.procDateTimeFormatCheckbox.prop('checked', shouldCheck);
    procModalElements.procDateTimeFormatCheckbox.prop('disabled', shouldDisable);
};

const handleProcDatetimeFormatCheckbox = async (element) => {
    const spreadsheet = getSpreadSheetFromToolsBarElement(element);
    await showProcDatetimeFormatSampleData(spreadsheet);
};

const handleProcDatetimeFormatInput = async (element) => {
    // automatically enable checkbox if it was not enabled
    const inputValue = $(element).val().trim();
    const procDateTimeFormatCheckbox = getDatetimeFormatCheckboxFromElement(element);
    if (inputValue.length) {
        procDateTimeFormatCheckbox.prop('checked', true);
    }
    const spreadsheet = getSpreadSheetFromToolsBarElement(element);
    await showProcDatetimeFormatSampleData(spreadsheet);
};

/**
 * @param {SpreadSheetProcessConfig} spreadsheet
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showProcDatetimeFormatSampleData = async (spreadsheet, ...rows) => {
    const el = spreadsheet.table.table.el;
    const condition = displayDatetimeFormatCondition(el);
    // apply format for all rows if it is undefined
    const appliedRows = rows.length === 0 ? collectDatetimeRows(spreadsheet) : rows;

    if (condition.showRawData) {
        showRawFormatDatetimeData(spreadsheet, ...appliedRows);
    } else if (condition.showFormatData) {
        await showInputFormatDatetimeData(spreadsheet, ...appliedRows);
    } else {
        notifyInvalidFormat();
    }
};

const displayDatetimeFormatCondition = (el = null) => {
    // if checkbox is checked:
    //   - if format is provided: show format by input
    //   - if format is not provided: auto format
    // else:
    //  - show raw data

    const result = {
        showRawData: false,
        showFormatData: false,
    };
    let formatIsChecked = false;
    const procDateTimeFormatCheckbox = el
        ? getDatetimeFormatCheckboxFromElement(el)
        : procModalElements.procDateTimeFormatCheckbox;
    if (procDateTimeFormatCheckbox.length) {
        formatIsChecked = procDateTimeFormatCheckbox.is(':checked');
    } else {
        // register by file show data formated
        formatIsChecked = true;
    }

    if (!formatIsChecked) {
        result.showRawData = true;
    } else {
        result.showFormatData = true;
    }

    return result;
};

/**
 * Collect datetime rows
 * @param {SpreadSheetProcessConfig} spreadsheet
 * @return {{dataTypeDropdownElement: HTMLDivElement, colIdx: String, dataType: String}[]}
 */
const collectDatetimeRows = (spreadsheet) => {
    const rows = spreadsheet.rowsByDataTypes(DataTypes.DATETIME.name, DataTypes.TIME.name, DataTypes.DATE.name);
    return rows.map((row) => ({
        dataType: row[PROCESS_COLUMNS.data_type].data,
        rowIdx: row[PROCESS_COLUMNS.data_type].rowIndex,
        isGeneratedMainDatetimeColumn: row[PROCESS_COLUMNS.is_generated_datetime].data,
    }));
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showRawFormatDatetimeData = (spreadsheet, ...rows) => {
    for (const { rowIdx, dataTypeDropdownElement } of rows) {
        getSampleDataByIndex(spreadsheet, rowIdx).forEach((e) => {
            // Sprint 245 requirement: Display comma instead of dot
            // E.g: 2024-01-01 01:01:00,123 -> 2024-01-01 01:01:00.123
            // original data should be kept for datetime format
            const commaBetweenNumbersRegex = /(?<=\d),(?=\d)/;
            const newValue = e.dataset.original.replace(commaBetweenNumbersRegex, '.');
            spreadsheet.table.updateCell(e, newValue, true);
        });
    }
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showInputFormatDatetimeData = async (spreadsheet, ...rows) => {
    let mainDateRow = rows.find((row) => row.dataType === DataTypes.DATE.name) || '';
    let mainTimeRow = rows.find((row) => row.dataType === DataTypes.TIME.name) || '';
    let dateTimeRow = rows.filter((row) => row.dataType === DataTypes.DATETIME.name);
    const inputFormatEle = getDatetimeFormatInputFromElement(spreadsheet.table.table.el);
    const inputFormat = inputFormatEle.val().trim();
    rows = [mainTimeRow, mainDateRow, ...dateTimeRow];
    let formatRow = dateTimeRow;
    if (mainDateRow) {
        formatRow.unshift(mainTimeRow);
    }
    if (mainDateRow) {
        formatRow.unshift(mainDateRow);
    }

    for (const { dataType, rowIdx, isGeneratedMainDatetimeColumn } of rows) {
        const sampleDataElements = getSampleDataByIndex(spreadsheet, rowIdx);
        let data = [];
        if (isGeneratedMainDatetimeColumn) {
            // get data of main::Date, main::Time
            if (mainDateRow && mainDateRow) {
                const mainDateElements = getSampleDataByIndex(spreadsheet, mainDateRow.rowIdx);
                const mainDateData = mainDateElements.map((e) => e.innerText);
                const mainTimeElements = getSampleDataByIndex(spreadsheet, mainTimeRow.rowIdx);
                const mainTimeData = mainTimeElements.map((e) => e.innerText);
                data = _.zip(mainDateData, mainTimeData).map(([dateData, timeData]) => dateData + ' ' + timeData);
            }
        } else {
            data = sampleDataElements.map((e) => e.dataset.original);
        }
        const formattedData = await parseProcDatetimeInputFormat(
            inputFormat,
            dataType,
            data,
            isGeneratedMainDatetimeColumn,
        );

        _.zip(sampleDataElements, formattedData).forEach(([ele, data]) => {
            spreadsheet.table.updateCell(ele, data, true);
        });
    }
};

const notifyInvalidFormat = () => showToastrMsg('Invalid datetime format!!!', MESSAGE_LEVEL.ERROR);

/**
 * @param {SpreadSheetProcessConfig} - spreadsheet
 * @param colIdx
 */
const getSampleDataByIndex = (spreadsheet, colIdx) =>
    $(`#${spreadsheet.table.table.el.id}`)
        .find(`tr:eq(${colIdx + 1}) .sample-data`)
        .toArray();

/**
 * @param {HTMLDivElement} dataTypeDropdownElement
 * @return {HTMLTableCellElement[]}
 */
const getSampleDataByDropdownElement = (dataTypeDropdownElement) => {
    const rowIndex = $(dataTypeDropdownElement).closest('tr').index();
    return $(dataTypeDropdownElement)
        .closest('div.proc-config-content')
        .find('table[name="processColumnsTableSampleData"] tbody')
        .find(`tr:eq(${rowIndex}) .sample-data`)
        .toArray();
};
