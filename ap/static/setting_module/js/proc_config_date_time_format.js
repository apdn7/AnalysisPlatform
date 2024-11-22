// https://docs.python.org/3.9/library/datetime.html#strftime-and-strptime-format-codes
const HOUR_FORMAT_CODES = ['%H', '%I', '%S', '%M'];
const DATE_FORMAT_CODES = [
    '%a',
    '%A',
    '%w',
    '%d',
    '%b',
    '%B',
    '%m',
    '%y',
    '%Y',
    '%z',
    '%Z',
    '%j',
    '%U',
    '%W',
    '%c',
    '%x',
    '%G',
    '%u',
    '%V',
];

// define new constant to avoid name conflict in utils
const PROC_CONFIG_DATE_FORMAT = 'YYYY-MM-DD';
const PROC_CONFIG_TIME_FORMAT = 'HH:mm:ss';
const PROC_CONFIG_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSSSSS Z';

const initDatetimeFormatCheckboxAndInput = () => {
    // reset checkbox
    procModalElements.procDateTimeFormatCheckbox.prop('checked', false);
    procModalElements.procDateTimeFormatCheckbox.prop('disabled', false);

    // reset input
    procModalElements.procDateTimeFormatInput.prop('disabled', false);
    procModalElements.procDateTimeFormatInput.attr(
        'placeholder',
        DATETIME_FORMAT_PLACE_HOLDER,
    );

    // TODO: get format input here
    const shouldDisable = !!currentProcess;
    if (shouldDisable) {
        // TODO: add format input here
        // procModalElements.procDateTimeFormatInput.val(/* datetimeFormat */);
        procModalElements.procDateTimeFormatInput.prop('disabled', true);
        procModalElements.procDateTimeFormatInput.removeAttr('placeholder');
    }

    // default is uncheck, but will check if they have input
    const shouldCheck = !!procModalElements.procDateTimeFormatInput
        .val()
        .trim();
    procModalElements.procDateTimeFormatCheckbox.prop('checked', shouldCheck);
    procModalElements.procDateTimeFormatCheckbox.prop(
        'disabled',
        shouldDisable,
    );
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
    } else if (condition.showInputFormat || condition.showAutoFormat) {
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
        showAutoFormat: false,
        showInputFormat: false,
    };
    const formatIsChecked =
        procModalElements.procDateTimeFormatCheckbox.is(':checked');
    const formatIsEmpty =
        procModalElements.procDateTimeFormatInput?.val()?.trim().length === 0;

    if (!formatIsChecked) {
        result.showRawData = true;
    } else if (formatIsEmpty) {
        result.showAutoFormat = true;
    } else {
        result.showInputFormat = true;
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
        .toArray()
        .filter((ele) =>
            [
                DataTypes.DATETIME.name,
                DataTypes.DATE.name,
                DataTypes.TIME.name,
            ].includes(ele.getAttribute('value')),
        )
        .map((ele) => ({
            dataType: ele.getAttribute('value'),
            colIdx: ele.closest('tr').querySelector('td[title="index"]').dataset
                .colIdx,
            dataTypeDropdownElement: ele.closest(
                'div.config-data-type-dropdown',
            ),
        }));

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showRawFormatDatetimeData = (...rows) => {
    for (const { colIdx, dataTypeDropdownElement } of rows) {
        if (dataTypeDropdownElement) {
            getSampleDataByDropdownElement(dataTypeDropdownElement).forEach(
                (e) => (e.innerText = e.dataset.original),
            );
        } else {
            getSampleDataByIndex(colIdx).forEach(
                (e) => (e.innerText = e.dataset.original),
            );
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

        const spanEle = dataTypeDropdownElement.querySelector(
            'button>span[name="dataType"]',
        );
        const isGeneratedMainDatetimeColumn = spanEle
            .closest('tr')
            .classList.contains('is-generated-datetime');
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
                _.zip(mainDateData, mainTimeData).forEach(
                    ([dateData, timeData]) => {
                        const mainDateTime = dateData + ' ' + timeData;
                        data.push(mainDateTime);
                    },
                );
            }
            inputFormat = '';
        } else {
            data = sampleDataElements.map((e) => e.dataset.original);
        }
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const formattedData = await fetch('/ap/api/setting/datetime_format', {
            method: 'POST',
            body: JSON.stringify({
                data: data,
                format: inputFormat,
                dataType: dataType,
                tzinfo: timeZone,
            }),
        })
            .then((response) => response.json())
            .catch((res) => {
                console.log('Can not apply format');
            });

        _.zip(sampleDataElements, formattedData).forEach(([ele, data]) => {
            ele.innerText = data;
        });
    }
};

const notifyInvalidFormat = () =>
    showToastrMsg('Invalid datetime format!!!', MESSAGE_LEVEL.ERROR);

/**
 * @param colIdx
 */
const getSampleDataByIndex = (colIdx) =>
    procModalElements.processColumnsSampleDataTableBody
        .find(`tr:eq(${colIdx}) .sample-data`)
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
