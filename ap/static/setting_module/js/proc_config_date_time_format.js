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

const handleProcDatetimeFormatCheckbox = async () => {
    await showProcDatetimeFormatSampleData();
};

const handleProcDatetimeFormatInput = async () => {
    // automatically enable checkbox if it was not enabled
    const inputValue = procModalElements.procDateTimeFormatInput.val().trim();
    if (inputValue.length) {
        procModalElements.procDateTimeFormatCheckbox.prop('checked', true);
    }
    await showProcDatetimeFormatSampleData();
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showProcDatetimeFormatSampleData = async (...rows) => {
    const condition = displayDatetimeFormatCondition();
    // apply format for all rows if it is undefined
    const appliedRows = rows.length === 0 ? collectDatetimeRows() : rows;

    if (condition.showRawData) {
        showRawFormatDatetimeData(...appliedRows);
    } else if (condition.showFormatData) {
        await showInputFormatDatetimeData(...appliedRows);
    } else {
        notifyInvalidFormat();
    }
};

const displayDatetimeFormatCondition = () => {
    // if checkbox is checked:
    //   - if format is provided: show format by input
    //   - if format is not provided: auto format
    // else:
    //  - show raw data

    const result = {
        showRawData: false,
        showFormatData: false,
    };
    const formatIsChecked = procModalElements.procDateTimeFormatCheckbox.is(':checked');
    const formatIsEmpty = procModalElements.procDateTimeFormatInput?.val()?.trim().length === 0;

    if (!formatIsChecked) {
        result.showRawData = true;
    } else {
        result.showFormatData = true;
    }

    return result;
};

/**
 * Collect datetime rows
 * @return {{dataTypeDropdownElement: HTMLDivElement, colIdx: String, dataType: String}[]}
 */
const collectDatetimeRows = () =>
    procModalElements.processColumnsTableBody
        .find('td.column-date-type span[name="dataType"]')
        .each((_idx, ele) => ele.setAttribute('colidx', _idx))
        .toArray()
        .filter((ele) =>
            [DataTypes.DATETIME.name, DataTypes.DATE.name, DataTypes.TIME.name].includes(ele.getAttribute('value')),
        )
        .map((ele, _id) => ({
            dataType: ele.getAttribute('value'),
            // colIdx: ele.closest('tr').querySelector('td[title="index"]').dataset.colIdx,
            colIdx: ele.getAttribute('colidx'),
            dataTypeDropdownElement: ele.closest('div.config-data-type-dropdown'),
        }));

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showRawFormatDatetimeData = (...rows) => {
    for (const { colIdx, dataTypeDropdownElement } of rows) {
        if (dataTypeDropdownElement) {
            // Sprint 245 requirement: Display comma instead of dot
            // E.g: 2024-01-01 01:01:00,123 -> 2024-01-01 01:01:00.123
            // original data should be kept for datetime format
            getSampleDataByDropdownElement(dataTypeDropdownElement).forEach((e) => {
                const commaBetweenNumbersRegex = /(?<=\d),(?=\d)/;
                e.innerText = e.dataset.original.replace(commaBetweenNumbersRegex, '.');
            });
        } else {
            getSampleDataByIndex(colIdx).forEach((e) => (e.innerText = e.dataset.original));
        }
    }
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showInputFormatDatetimeData = async (...rows) => {
    let inputFormat = procModalElements.procDateTimeFormatInput.val().trim();
    let mainDateIdx = '';
    let mainTimeIdx = '';

    for (const { dataType, colIdx, dataTypeDropdownElement } of rows) {
        switch (dataType) {
            case DataTypes.DATETIME.name:
                break;
            case DataTypes.DATE.name:
                mainDateIdx = colIdx;
                break;
            case DataTypes.TIME.name:
                mainTimeIdx = colIdx;
                break;
            default:
                break;
        }

        const spanEle = dataTypeDropdownElement.querySelector('button>span[name="dataType"]');
        const isGeneratedMainDatetimeColumn = spanEle.closest('tr').classList.contains('is-generated-datetime');
        const sampleDataElements = dataTypeDropdownElement
            ? getSampleDataByDropdownElement(dataTypeDropdownElement)
            : getSampleDataByIndex(colIdx);
        let data = [];
        if (isGeneratedMainDatetimeColumn) {
            // get data of main::Date, main::Time
            if (mainDateIdx && mainTimeIdx) {
                const mainDateElements = getSampleDataByIndex(mainDateIdx);
                const mainDateData = mainDateElements.map((e) => e.innerText);
                const mainTimeElements = getSampleDataByIndex(mainTimeIdx);
                const mainTimeData = mainTimeElements.map((e) => e.innerText);
                data = _.zip(mainDateData, mainTimeData).map(([dateData, timeData]) => dateData + ' ' + timeData);
            }
            inputFormat = '';
        } else {
            data = sampleDataElements.map((e) => e.dataset.original);
        }
        const formattedData = await parseProcDatetimeInputFormat(dataType, data, isGeneratedMainDatetimeColumn);

        _.zip(sampleDataElements, formattedData).forEach(([ele, data]) => {
            ele.innerText = data;
        });
    }
};

const notifyInvalidFormat = () => showToastrMsg('Invalid datetime format!!!', MESSAGE_LEVEL.ERROR);

/**
 * @param colIdx
 */
const getSampleDataByIndex = (colIdx) =>
    procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${colIdx}) .sample-data`).toArray();

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
