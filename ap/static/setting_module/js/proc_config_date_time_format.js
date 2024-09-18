/* eslint-disable no-prototype-builtins */

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
const PROC_CONFIG_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss Z';

// formats for automatically convert datetime
const REGEX_FORMATS_DATETIME = [
    new RegExp(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/), // gui format
    new RegExp(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) \+(\d\d):(\d\d)$/), // with tz
    new RegExp(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}).(\d{6})$/), // wo tz
    new RegExp(
        /^(\d{4})[/\-\s](\d{2})[/\-\s](\d{2})[Tt\s]?(\d{2}):(\d{2}):(\d{2})[Zz]?$/,
    ),
];
const REGEX_GROUP_DATETIME = '$1/$2/$3 $4:$5:$6';

const REGEX_FORMATS_DATE = [
    new RegExp(/^(\d{4})(\d\d)(\d\d)$/), // gui format
    new RegExp(/^(\d{4})-(\d\d)-(\d\d)$/), // with tz
    new RegExp(/^(\d{4})-(\d{2})-(\d{2})$/), // wo tz
    new RegExp(/^(\d{4})[/\-\s](\d{2})[/\-\s](\d{2})$/),
];
const REGEX_GROUP_DATE = '$1/$2/$3';

const REGEX_FORMATS_TIME = [
    new RegExp(/^(\d\d)(\d\d)(\d\d)$/), // gui format
    new RegExp(/^(\d\d):(\d\d):(\d\d)$/), // with tz
    new RegExp(/^(\d{2}):(\d{2}):(\d{2}).(\d{6})$/), // wo tz
    new RegExp(/^(\d{2}):(\d{2}):(\d{2})$/),
];
const REGEX_GROUP_TIME = '$1:$2:$3';

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
    const { is_imported: shouldDisable /* datetime_format: datetimeFormat */ } =
        currentProcess ?? {};
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

const getDatetimeFormat = () => {
    const input = procModalElements.procDateTimeFormatInput.val().trim();
    const format = { datetime: input, date: null, time: null };

    const getStartIndexByCodes = (formatCodes) => {
        const indexes = formatCodes
            .map((code) => input.indexOf(code))
            .filter((index) => index !== -1);
        return indexes.length ? Math.min(...indexes) : null;
    };

    const timeStartIndex = getStartIndexByCodes(HOUR_FORMAT_CODES);
    const dateStartIndex = getStartIndexByCodes(DATE_FORMAT_CODES);

    if (timeStartIndex !== null && dateStartIndex !== null) {
        // These are valid indexes if and only if one of them is zero
        if (timeStartIndex === 0) {
            format.time = format.datetime.slice(0, dateStartIndex).trim();
            format.date = format.datetime.slice(dateStartIndex).trim();
        } else if (dateStartIndex === 0) {
            format.time = format.datetime.slice(timeStartIndex).trim();
            format.date = format.datetime.slice(0, timeStartIndex).trim();
        }
    } else if (timeStartIndex !== null && dateStartIndex === null) {
        format.time = format.datetime.slice(timeStartIndex);
    } else if (timeStartIndex === null && dateStartIndex !== null) {
        format.date = format.datetime.slice(dateStartIndex);
    } else {
        notifyInvalidFormat();
    }

    return format;
};

const handleProcDatetimeFormatCheckbox = () => {
    showProcDatetimeFormatSampleData();
};

const handleProcDatetimeFormatInput = () => {
    // automatically enable checkbox if it was not enabled
    const inputValue = procModalElements.procDateTimeFormatInput.val().trim();
    if (inputValue.length) {
        procModalElements.procDateTimeFormatCheckbox.prop('checked', true);
    }
    showProcDatetimeFormatSampleData();
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showProcDatetimeFormatSampleData = (...rows) => {
    const condition = displayDatetimeFormatCondition();
    // apply format for all rows if it is undefined
    const appliedRows = rows.length === 0 ? collectDatetimeRows() : rows;

    if (condition.showRawData) {
        showRawFormatDatetimeData(...appliedRows);
    } else if (condition.showInputFormat) {
        showInputFormatDatetimeData(...appliedRows);
    } else if (condition.showAutoFormat) {
        showAutoFormatDatetimeData(...appliedRows);
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
const showInputFormatDatetimeData = (...rows) => {
    const format = getDatetimeFormat();
    for (const { dataType, colIdx, dataTypeDropdownElement } of rows) {
        let inputFormat = null;
        let outputFormat = null;
        switch (dataType) {
            case DataTypes.DATETIME.name:
                inputFormat = format.datetime;
                outputFormat = PROC_CONFIG_DATETIME_FORMAT;
                break;
            case DataTypes.DATE.name:
                inputFormat = format.date;
                outputFormat = PROC_CONFIG_DATE_FORMAT;
                break;
            case DataTypes.TIME.name:
                inputFormat = format.time;
                outputFormat = PROC_CONFIG_TIME_FORMAT;
                break;
            default:
                break;
        }

        if (inputFormat === null) {
            notifyInvalidFormat();
        } else {
            const spanEle = dataTypeDropdownElement.querySelector(
                'button>span[name="dataType"]',
            );
            const isGeneratedMainDatetimeColumn =
                spanEle.getAttribute('is_get_date')?.trim()?.toLowerCase() ===
                    String(true) &&
                spanEle
                    .getAttribute('is-registered-col')
                    ?.trim()
                    ?.toLowerCase() === String(true);
            if (isGeneratedMainDatetimeColumn) {
                inputFormat = `${format.date} ${format.time}`;
            }

            (dataTypeDropdownElement
                ? getSampleDataByDropdownElement(dataTypeDropdownElement)
                : getSampleDataByIndex(colIdx)
            ).forEach((e) => {
                const momentFormat = strftimeToMomentFormat(inputFormat);
                const momentDate = moment(
                    e.dataset.original,
                    momentFormat,
                    true,
                );
                e.innerText = momentDate.isValid()
                    ? momentDate.format(outputFormat)
                    : '';
            });
        }
    }
};

/**
 * @param {Object.<colIdx: String, dataType: String, dataTypeDropdownElement: HTMLDivElement>} rows
 */
const showAutoFormatDatetimeData = (...rows) => {
    for (const { dataType, colIdx, dataTypeDropdownElement } of rows) {
        let formats = null;
        let outputFormat = null;
        let outputGroup = null;

        switch (dataType) {
            case DataTypes.DATETIME.name:
                formats = REGEX_FORMATS_DATETIME;
                outputFormat = PROC_CONFIG_DATETIME_FORMAT;
                outputGroup = REGEX_GROUP_DATETIME;
                break;
            case DataTypes.DATE.name:
                formats = REGEX_FORMATS_DATE;
                outputFormat = PROC_CONFIG_DATE_FORMAT;
                outputGroup = REGEX_GROUP_DATE;
                break;
            case DataTypes.TIME.name:
                formats = REGEX_FORMATS_TIME;
                outputFormat = PROC_CONFIG_TIME_FORMAT;
                outputGroup = REGEX_GROUP_TIME;
                break;
            default:
                break;
        }

        if (formats === null) {
            continue;
        }

        const elements = dataTypeDropdownElement
            ? getSampleDataByDropdownElement(dataTypeDropdownElement)
            : getSampleDataByIndex(colIdx);
        const trimmedData = elements.map((e) => trimBoth(e.dataset.original));
        const correctFormat = formats.find((format) =>
            trimmedData.every((v) => v.match(format) !== null),
        );
        if (correctFormat === null) {
            notifyInvalidDatetime();
            elements.forEach((ele) => (ele.innerText = ''));
        } else {
            elements.forEach((ele) => {
                const originalData = trimBoth(ele.dataset.original);
                const replacedByGroup = originalData.replace(
                    correctFormat,
                    outputGroup,
                );
                const momentDate = moment(replacedByGroup, outputFormat);
                ele.innerText = momentDate.isValid()
                    ? momentDate.format(outputFormat)
                    : '';
            });
        }
    }
};

const notifyInvalidDatetime = () =>
    showToastrMsg(
        'Can not convert to DATETIME type!!!<br>Please check data format',
        MESSAGE_LEVEL.ERROR,
    );

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

/**
 * @param {String} format - strftime format
 * @return {String} moment format
 */
const strftimeToMomentFormat = (format) => {
    // https://github.com/benjaminoakes/moment-strftime
    // https://docs.python.org/3.9/library/datetime.html#strftime-and-strptime-format-codes
    // https://pandas.pydata.org/docs/reference/api/pandas.Series.dt.strftime.html
    const replacements = {
        a: 'ddd',
        A: 'dddd',
        b: 'MMM',
        B: 'MMMM',
        c: 'lll',
        d: 'DD',
        '-d': 'D',
        e: 'D',
        F: 'YYYY-MM-DD',
        H: 'HH',
        '-H': 'H',
        I: 'hh',
        '-I': 'h',
        j: 'DDDD',
        '-j': 'DDD',
        k: 'H',
        l: 'h',
        m: 'MM',
        '-m': 'M',
        M: 'mm',
        '-M': 'm',
        p: 'A',
        P: 'a',
        S: 'ss',
        '-S': 's',
        u: 'E',
        w: 'd',
        W: 'WW',
        x: 'll',
        X: 'LTS',
        y: 'YY',
        Y: 'YYYY',
        z: 'ZZ',
        Z: 'z',
        f: 'SSS',
        '%': '%',
    };

    const tokens = format.split(/(%-?.)/);
    return tokens
        .map((token) => {
            // Replace strftime tokens with moment formats
            if (
                token[0] === '%' &&
                replacements.hasOwnProperty(token.slice(1))
            ) {
                return replacements[token.slice(1)];
            }
            // Escape non-token strings to avoid accidental formatting
            return token.length > 0 ? `[${token}]` : token;
        })
        .join('');
};
