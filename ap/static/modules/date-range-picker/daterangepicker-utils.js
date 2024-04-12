// CLASS NAMES THAT THIS LIBRARY SUPPORT TO RENDER CALENDAR FOR INPUT ELEMENT
const DATETIME_RANGE_PICKER_CLASS = 'DATETIME_RANGE_PICKER'; // Ex: '2022-02-31 00:00~2022-02-31 23:59'
const DATE_RANGE_PICKER_CLASS = 'DATE_RANGE_PICKER'; // Ex: '2022-02-31~2022-02-31'
const DATETIME_PICKER_CLASS = 'DATETIME_PICKER'; // Ex: '2022-02-31 00:00'
const DATE_PICKER_CLASS = 'DATE_PICKER'; // Ex: '2022-02-31'

// CLASS NAMES THAT HIDDEN DATETIME INPUT RELATE TO DATERANGEPICKER
const HIDDEN_START_DATE_CLASS = "START_DATE";
const HIDDEN_START_TIME_CLASS = "START_TIME";
const HIDDEN_END_DATE_CLASS = "END_DATE";
const HIDDEN_END_TIME_CLASS = "END_TIME";

// DATE TIME RULES
const DATETIME_PICKER_SEPARATOR = ` ${COMMON_CONSTANT.EN_DASH} `;
const DATE_SEPARATOR = '-';
const HOUR_SEPARATOR = ':';
const DATETIME_PICKER_FORMAT = `YYYY${DATE_SEPARATOR}MM${DATE_SEPARATOR}DD HH${HOUR_SEPARATOR}mm`;
const DATETIME_PICKER_NO_TIME_FORMAT = `YYYY${DATE_SEPARATOR}MM${DATE_SEPARATOR}DD`;

// Regex filter for date with time
const DATETIME_FILTER_REGEX_DICT = {
    FULL_DATETIME_SEPARATOR_REGEX : /^(\d{4})\/*-* *(\d{2})\/*-* *(\d{2}) *(\d{1}|\d{2}):* *(\d{2})$/, // '2022-02-31 00:00' or '2022/02/31 00:00' or '2022-02-3100:00' or '202202310000' or '20220231000'
    SHORT_YEAR_DATETIME_SEPARATOR_REGEX : /^(\d{2})\/*-* *(\d{2})\/*-* *(\d{2}) *(\d{1}|\d{2}):* *(\d{2})$/, // '22-02-31 00:00' or '22/02/31 00:00' or '22-02-3100:00' or '2202310000' or '220231000'
    NO_YEAR_DATETIME_SEPARATOR_REGEX : /^()(\d{2})\/*-* *(\d{2}) *(\d{1}|\d{2}):* *(\d{2})$/, // '02-31 00:00' or '02/31 00:00' or '02-3100:00' or '02310000' or '0231000'
    NUMBER_REGEX: /^\d{1,4}$/,
};

// Regex filter for date without time
const DATE_FILTER_REGEX_DICT = {
    FULL_DATE_SEPARATOR_REGEX : /^(\d{4})\/*-* *(\d{2})\/*-* *(\d{2})$/, // '2022-02-31' or '2022/02/31' or '2022-02-31' or '20220231
    SHORT_YEAR_DATE_SEPARATOR_REGEX : /^(\d{2})\/*-* *(\d{2})\/*-* *(\d{2})$/, // '22-02-31' or '22/02/31' or '22-02-31' or '220231'
    NO_YEAR_DATE_SEPARATOR_REGEX : /^()(\d{2})\/*-* *(\d{2})$/, // '02-31' or '02/31' or '02-31' or '0231'
    NUMBER_REGEX: /^\d{1,4}$/,
};

// PICKER CONFIG
const TIME_PICKER_INCREMENTS = 5; // minutes
const KEYUP_EVENT_DELAY = 2000; // milliseconds
const DEFAULT_START_DATETIME = moment({hour: 7}).format(DATETIME_PICKER_FORMAT);
const DEFAULT_END_DATETIME = moment({hour: 19}).format(DATETIME_PICKER_FORMAT);

const RECENT_DATE_RANGES_LS_KEY = 'recentChosenDateRanges';
const NUMBER_OF_RECENT_DATE_RANGES = 5;
const RECENT_DATES_LS_KEY = 'recentChosenDates';
const NUMBER_OF_RECENT_DATES = 5;

let _i18nDateTimePicker;
let _baseDateTimePickerConfig;
let _recentChosenDateRanges;
let _recentChosenDates;

let currentDateTimePicker = null;
let currentCalender = null;
const ENTER_KEY = 'Enter';


/* <h2>Load i18n, get all words by current language</h2><br>
    * <b>Returns:</b> A dict contain all words of datatimepicker<br>
    */
const getI18nDateTimePicker = () => {
    if (_i18nDateTimePicker == null)
        _i18nDateTimePicker = {
            custom: $('#i18nCustom').text(),
            today: $('#i18nToday').text(),
            yesterday: $('#i18nYesterday').text(),
            last7Days: $('#i18nLast7Days').text(),
            last30Days: $('#i18nLast30Days').text(),
            thisMonth: $('#i18nThisMonth').text(),
            minus1Month: $('#i18nMinus1Month').text(),
            plus3Months: $('#i18nPlus3Months').text(),
            apply: $('#i18nApply').text(),
            weekNo: $('#i18nWeekNo').text(),
            monthNames: $('#i18nMonthNames').text(),
            dayNames: $('#i18nDayNames').text(),
            cancel: $('#i18nCancel').text(),
            from: $('#i18nFrom').text(),
            to: $('#i18nTo').text(),
            dayOf7DaysAgo: $('#i18nDayOf7DaysAgo').text(),
            dayOf30DaysAgo: $('#i18nDayOf30DaysAgo').text(),
            firstDayOfThisMonth: $('#i18nFirstDayOfThisMonth').text(),
            lastDayOfThisMonth: $('#i18nLastDayOfThisMonth').text(),
            minus3Months: $('#i18nMinus3Months').text(),
            // rangesHoverMessage: $('#i18nDaterangepickerRangesHoverMessage').text(),
        };
    return _i18nDateTimePicker;
};


/* <h2>Load Calendar configuration</h2><br>
    * <b>Returns:</b> A dict contain all config of datatimepicker<br>
    */
const getBaseDateTimePickerConfig = () => {
    if (_baseDateTimePickerConfig == null)
        _baseDateTimePickerConfig = {
            startDate: DEFAULT_START_DATETIME,
            endDate: DEFAULT_END_DATETIME,
            autoRoundMinuteInput: false,
            showWeekNumbers: false,
            alwaysShowCalendars: true,
            showDropdowns: true,
            minYear: 1900,
            maxYear: 2100,
            drops: 'down',
            locale: {
                separator: DATETIME_PICKER_SEPARATOR,
                fromLabel: getI18nDateTimePicker().from,
                toLabel: getI18nDateTimePicker().to,
                applyLabel: getI18nDateTimePicker().apply,
                cancelLabel: getI18nDateTimePicker().cancel,
                customRangeLabel: getI18nDateTimePicker().custom,
                weekLabel: getI18nDateTimePicker().weekNo,
                daysOfWeek: getI18nDateTimePicker().dayNames.split('_'),
                monthNames: getI18nDateTimePicker().monthNames.split('_'),
                firstDay: 1
            },
            cancelClass: 'btn-secondary',
            showISOWeekNumbers: true,
            // rangesHoverMessage: getI18nDateTimePicker().rangesHoverMessage
        };
    return _baseDateTimePickerConfig;
};


/* <h2>Split datetime range to paths such as start date, start time, end date, end time.</h2><br>
    * <b>Returns:</b> A dict contain paths of datetime range<br>
    * <b>Parameters:</b>
    * - dateRangeValue - date range value<br>
    * - isShowTimePicker - is time exist on date string?<br>
    * <b>Example:</b> <br>dateRangeValue = '2022/02/20 03:00 - 2022/02/20 03:00'<br>output = {2022/02/20, 03:00, 2022/02/20, 03:00}
    */
const splitDateTimeRange = (dateRangeValue, isShowTimePicker=true) => {
    const datetimeRange = dateRangeValue.trim();
    let datetimeParts = datetimeRange.split(DATETIME_PICKER_SEPARATOR.trim());
    if (datetimeParts.length === 1) {
        // try to split by white space separator
        const splited = datetimeRange.split(' ');
        if (splited.length === 2 &&
            ((isShowTimePicker && splited[0].length >= 7 && splited[1].length >= 7) ||
                (!isShowTimePicker && splited[0].length >= 4 && splited[1].length >= 4))) {
            // in case start date and end date are separated by a white space character
            datetimeParts = splited;
        } else {
            // in case only start datetime exist
            datetimeParts[1] = '';
        }
    }
    datetimeParts.forEach((el, i) => datetimeParts[i] = el.trim());

    const startDateTime = splitDateTime(datetimeParts[0], isShowTimePicker)
    const endDateTime = splitDateTime(datetimeParts[1], isShowTimePicker)

    return {
        startDate: startDateTime.date,
        startTime: startDateTime.time,
        endDate: endDateTime.date,
        endTime: endDateTime.time
    };
};


/* <h2>Split datetime to paths such as date, time.</h2><br>
    * <b>Returns:</b> A dict contain paths of datetime<br>
    * <b>Parameters:</b>
    * - datetimeValue - date time value<br>
    * - isShowTimePicker - is time exist on date string?<br>
    * <b>Example:</b> <br>dateRangeValue = '2022/02/20 03:00'<br>output = {2022/02/20, 03:00}
    */
const splitDateTime = (datetimeValue, isShowTimePicker=true) => {
    let date, time;
    const value = datetimeValue.trim();

    if (isShowTimePicker) {
        const regexKeys = Object.keys(DATETIME_FILTER_REGEX_DICT);
        for (let i = 0; i < regexKeys.length; i++) {
            let matchObj = value.match(DATETIME_FILTER_REGEX_DICT[regexKeys[i]]);
            if (matchObj != null) {
                // check input year
                date = checkDateInput(matchObj)

                // check input minutes
                let minutes = matchObj[4] || '00';
                let sm = matchObj[5] || '00';
                if (minutes.length === 1) { // in case year is 1 numbers -> add '0' at first
                    minutes = `0${minutes}`;
                }

                time = `${minutes}${HOUR_SEPARATOR}${sm}`;
            }
        }

        if (date != null && time != null) { // in case input string match regex patterns
            return { date, time };
        }
    } else {
        const regexKeys = Object.keys(DATE_FILTER_REGEX_DICT);
        for (let i = 0; i < regexKeys.length; i++) {
            let matchObj = value.match(DATE_FILTER_REGEX_DICT[regexKeys[i]]);
            if (matchObj != null) {
                // check input year
                date = checkDateInput(matchObj)
            }
        }

        if (date != null) { // in case input string match regex patterns
            return { date, time: '' };
        }
    }

    const datetimeParts = value !== '' ? value.split(' ') : ['',''];
    date = datetimeParts[0];
    time = isShowTimePicker ? datetimeParts[1] ?? '' : '';

    return { date, time };
};


const checkDateInput = (matchObj) => {
    let year;
    let month;
    let date;
    if (matchObj.length === 1) {
        const value = Number(matchObj[0]);
        if (value >= 1 && value <= 31) {
            year = moment().year();
            month = moment().month() + 1;
            date = value;
        } else if (value >= 101 && value <= 1231) {
            year = moment().year();

            const strVal = matchObj[0];
            const index = strVal.length === 3 ? 1 : 2;
            month = strVal.substring(0,index);
            date = strVal.substring(index);
        } else {
            year = moment().year();
            month = moment().month() + 1;
            date = moment().date();
        }
        return `${year}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${date}`;
    } else {
        year = matchObj[1];
        month = matchObj[2];
        date = matchObj[3];
        if (year.length === 2) { // in case year is 2 numbers -> add '2000'
            year = `20${year}`;
        } else if (year === '') { // in case no year -> get current year
            year = moment().year();
        }
        return `${year}${DATE_SEPARATOR}${month}${DATE_SEPARATOR}${date}`;
    }
}


/* <h2>Combine 4 paths (start date, start time, end date, end time) to one string.<br></h2>
    * <b>Returns:</b> the string of combined datetime<br>
    * <b>Parameters:</b>
    * - splitDate - datetimepicker input<br>
    * - isAddSeparator - is add separator at the end of start date when end date no exist<br>
    */
const combineDateTimeRange = (splitDate, isAddSeparator=true) => {
    let finalValue = splitDate.startDate;
    if (splitDate.startTime !== '') finalValue += ' ' + splitDate.startTime;
    if (isAddSeparator || splitDate.endDate !== '') finalValue += DATETIME_PICKER_SEPARATOR;
    finalValue += splitDate.endDate;
    if (splitDate.endTime !== '') finalValue += ' ' + splitDate.endTime;
    return finalValue;
};


/* <h2>Combine 2 paths (date, time) to one string.<br></h2>
    * <b>Returns:</b> the string of combined datetime<br>
    * <b>Parameters:</b>
    * - splitDate - datetimepicker input<br>
    */
const combineDateTime = (splitDate) => {
    let finalValue = splitDate.date;
    if (splitDate.time !== '') finalValue += ' ' + splitDate.time;
    return finalValue;
};


/* <h2>Update value & 'data-current-val' for hidden element<br></h2>
    * <b>Parameters:</b>
    * - parentDiv - div element that include hidden element<br>
    * - className - class name of input<br>
    * - value - new value<br>
    * <b>Note:</b>
    * - if element have attribute 'is-trigger-change' = True, it will be trigger change event
    */
const updateHiddenDateElement = (parentDiv, className, value) => {
    if (value == null || value === '') return;
    const element = parentDiv.find(`input[name="${className}"]`);
    element.val(value);
    element.attr('data-current-val', value);
    if (element.attr('is-trigger-change') === 'True') element.trigger('change');
}


/* <h2>Update recent chosen date range in local storage<br></h2>
    * <b>Parameters:</b>
    * - splitDate - datetimepicker input<br>
    * - isShowTimePicker - is time exist on date string?<br>
    */
const updateRecentChosenDateRanges = (splitDate, isShowTimePicker) => {
    if (_recentChosenDateRanges == null) {
        _recentChosenDateRanges = {};
    }

    const key = isShowTimePicker ? 'DateTime' : 'Date';
    _recentChosenDateRanges[key] = _recentChosenDateRanges[key] == null ? [] : _recentChosenDateRanges[key];

    let existDate = null;
    for (let i = 0; i < _recentChosenDateRanges[key].length; i++) {
        const datePaths = _recentChosenDateRanges[key][i];
        if (datePaths.startDate == splitDate.startDate && datePaths.startTime == splitDate.startTime &&
            datePaths.endDate == splitDate.endDate && datePaths.endTime == splitDate.endTime) {
            existDate = datePaths;
            break;
        }
    }

    if (existDate == null) {
        _recentChosenDateRanges[key][_recentChosenDateRanges[key].length] = splitDate;
        if (_recentChosenDateRanges[key].length >= NUMBER_OF_RECENT_DATE_RANGES) {
            _recentChosenDateRanges[key] = _recentChosenDateRanges[key].slice(_recentChosenDateRanges[key].length - NUMBER_OF_RECENT_DATE_RANGES, _recentChosenDateRanges[key].length);
        }
    }

    localStorage.setItem(RECENT_DATE_RANGES_LS_KEY, JSON.stringify(_recentChosenDateRanges));
}


/* <h2>Update recent chosen date in local storage<br></h2>
    * <b>Parameters:</b>
    * - splitDate - datetimepicker input<br>
    * - isShowTimePicker - is time exist on date string?<br>
    */
const updateRecentChosenDates = (splitDate, isShowTimePicker) => {
    if (_recentChosenDates == null) {
        _recentChosenDates = {};
    }

    const key = isShowTimePicker ? 'DateTime' : 'Date';
    _recentChosenDates[key] = _recentChosenDates[key] == null ? [] : _recentChosenDates[key];

    let existDate = null;
    for (let i = 0; i < _recentChosenDates[key].length; i++) {
        const datePaths = _recentChosenDates[key][i];
        if (datePaths.date == splitDate.date && datePaths.time == splitDate.time) {
            existDate = datePaths;
            break;
        }
    }

    if (existDate == null) {
        _recentChosenDates[key][_recentChosenDates[key].length] = splitDate;
        if (_recentChosenDates[key].length >= NUMBER_OF_RECENT_DATES) {
            _recentChosenDates[key] = _recentChosenDates[key].slice(_recentChosenDates[key].length - NUMBER_OF_RECENT_DATES, _recentChosenDates[key].length);
        }
    }

    localStorage.setItem(RECENT_DATES_LS_KEY, JSON.stringify(_recentChosenDates));
}


/* <h2>Split Date Time Range value to 4 paths such as start date, start time, end date, end time.<br></h2>
    * <b>Returns:</b> the string of time with HH:MM format<br>
    * <b>Parameters:</b>
    * - element - datetimepicker input<br>
    * - isShowTimePicker - is time exist on date string?<br>
    * <b>Note:</b><br>
    * Beside that, new value will be update on date time range input
    */
const splitDateTimeRangeFunc = (element, isShowTimePicker) => {
    const that = $(element.currentTarget);
    const originInput = that.val();
    const inputDateRange = originInput.trim();
    const splitDate = splitDateTimeRange(inputDateRange, isShowTimePicker);
    let finalValue = '';

    if (splitDate.startDate === '' && splitDate.startDate === '') {
        finalValue = originInput;
    } else {
        const isHaveSeparator = originInput.match(DATETIME_PICKER_SEPARATOR.trim()) != null;
        finalValue = combineDateTimeRange(splitDate, isHaveSeparator);

        // Set value to hidden datetime parts
        const parentDiv = that.parent();
        updateHiddenDateElement(parentDiv, HIDDEN_START_DATE_CLASS, splitDate.startDate);
        updateHiddenDateElement(parentDiv, HIDDEN_START_TIME_CLASS, splitDate.startTime);
        updateHiddenDateElement(parentDiv, HIDDEN_END_DATE_CLASS, splitDate.endDate);
        updateHiddenDateElement(parentDiv, HIDDEN_END_TIME_CLASS, splitDate.endTime);

        updateRecentChosenDateRanges(splitDate, isShowTimePicker);
    }

    // Set value
    that.val(finalValue);
}


/* <h2>Split Date Time value to 2 paths such as date, time.<br></h2>
    * <b>Returns:</b> the string of time with HH:MM format<br>
    * <b>Parameters:</b>
    * - element - datetimepicker input<br>
    * - isShowTimePicker - is time exist on date string?<br>
    * <b>Note:</b><br>
    * Beside that, new value will be update on date time range input
    */
const splitDateTimeFunc = (element, isShowTimePicker) => {
    const that = $(element.currentTarget);
    const originInput = that.val();
    const inputDateRange = originInput.trim();
    const splitDate = splitDateTime(inputDateRange, isShowTimePicker);
    let finalValue = '';

    if (splitDate.date == '') {
        finalValue = originInput;
    } else {
        finalValue = combineDateTime(splitDate);

        // Set value to hidden datetime parts
        const parentDiv = that.parent();
        updateHiddenDateElement(parentDiv, HIDDEN_START_DATE_CLASS, splitDate.date);
        updateHiddenDateElement(parentDiv, HIDDEN_START_TIME_CLASS, splitDate.time);
        updateHiddenDateElement(parentDiv, HIDDEN_END_DATE_CLASS, splitDate.date);
        updateHiddenDateElement(parentDiv, HIDDEN_END_TIME_CLASS, splitDate.time);

        updateRecentChosenDates(splitDate, isShowTimePicker);
    }

    // Set value
    that.val(finalValue);
}


/* <h2>Update calendar UI according to input value</h2><br>
    * <b>Parameters:</b>
    * - element - datetimepicker input<br>
    * - isShowTimePicker - is time exist on date string?<br>
    * <b>Note:</b>
    * - The input value must be true format (include following to timePickerIncrement) that calendar support
    */
const updateCalendarUI = (element, isShowTimePicker) => {
    const that = $(element.currentTarget);
    const calendar = that.data('daterangepicker');
    try {
        calendar.setStartDate = overrideSetStartDate;
        calendar.setEndDate = overrideSetEndDate;
        calendar.renderTimePicker = overrideRenderTimePickerFunction;
        calendar.elementChanged(that);
        calendar.monthOrYearChanged(that);
        if (isShowTimePicker) calendar.timeChanged(that);
    } catch (e) {
        // console.log(e);
    }
}

/* <h2>Call this function to initialize DateTime picker for all inputs that have name = '${DATETIME_RANGE_PICKER_CLASS}' or '${DATE_RANGE_PICKER_CLASS}'</h2><br>
    * <b>Note:</b>
    * - Based on the "is-show-time-picker" attribute of the input tag, it will initialize the date picker with time or not
    */
const initializeDateTimeRangePicker = (dtId = null, isClassName = false) => {
    let ranges = {};
    ranges[`${getI18nDateTimePicker().today}`] = [moment().startOf('day'), moment().endOf('day')];
    ranges[`${getI18nDateTimePicker().yesterday}`] = [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')];
    ranges[`${getI18nDateTimePicker().last7Days}`] = [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')];
    ranges[`${getI18nDateTimePicker().last30Days}`] = [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')];
    ranges[`${getI18nDateTimePicker().thisMonth}`] = [moment().startOf('month'), moment().endOf('month')];
    ranges[`${getI18nDateTimePicker().minus1Month}`] = [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')];
    ranges[`${getI18nDateTimePicker().plus3Months}`] = [moment().subtract(-1, 'month').startOf('month'), moment().subtract(-3, 'month').endOf('month')];
    ranges[`${getI18nDateTimePicker().minus3Months}`] = [moment().subtract(3, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')];

    let baseConfig = $.extend({}, getBaseDateTimePickerConfig());
    baseConfig['linkedCalendars'] = false;
    baseConfig['ranges'] = ranges;

    const updateDateTimeRangeValue = (element) => {
        const isShowTimePicker = $(element.currentTarget).attr('is-show-time-picker') === 'True';
        splitDateTimeRangeFunc(element, isShowTimePicker);
        updateCalendarUI(element, isShowTimePicker);
    };

    const initByClassName = (className, isClassName = false) => {
        const datetimeRangeControls = isClassName ? $(`.${className}`) : $(`input[name="${className}"]`);
        initDateTimePickerInner(datetimeRangeControls);
    };

    const initById = (id) => {
        const datetimeRangeControls = $(`#${id}`);
        initDateTimePickerInner(datetimeRangeControls);
    }

    const initDateTimePickerInner = (datetimeRangeControls) => {
        datetimeRangeControls.each((i, element) => {
            const config = $.extend({}, baseConfig);
            const isShowTimePicker = $(element).attr('is-show-time-picker') === 'True';
            const isSetDefaultValue = $(element).attr('is-set-default-value') === 'True';
            const isShowRecentDates = $(element).attr('is-show-recent-dates') === 'True';

            // Get and set value for date range picker
            const startEndDate = $(element).val();
            const dateObj = splitDateTimeRange(startEndDate, isShowTimePicker);
            if (dateObj.startDate !== '' && dateObj.endDate !== '') {
                const startTime = isShowTimePicker ? ` ${dateObj.startTime}` : '';
                const endTime = isShowTimePicker ? ` ${dateObj.endTime}` : '';
                config.startDate = `${dateObj.startDate}${startTime}`;
                config.endDate = `${dateObj.endDate}${endTime}`;
            }

            if (isShowTimePicker) {
                config['timePicker'] = true;
                config['timePicker24Hour'] = true;
                config['timePickerIncrement'] = TIME_PICKER_INCREMENTS;

                config['locale']['format'] = DATETIME_PICKER_FORMAT;
            } else {
                config['locale']['format'] = DATETIME_PICKER_NO_TIME_FORMAT;
            }

            if (isShowRecentDates) {
                _recentChosenDateRanges = JSON.parse(localStorage.getItem(RECENT_DATE_RANGES_LS_KEY));
                _recentChosenDateRanges = _recentChosenDateRanges == null ? {} : _recentChosenDateRanges;
                let key = isShowTimePicker ? 'DateTime' : 'Date';
                if (_recentChosenDateRanges[key] == null) {
                    _recentChosenDateRanges[key] = [];
                }

                for (let i = 0; i < _recentChosenDateRanges[key].length; i++) {
                    const datePaths = _recentChosenDateRanges[key][i];

                    const startTime = isShowTimePicker ? ` ${datePaths.startTime}` : '';
                    const strStartDate = `${datePaths.startDate}${startTime}`;
                    const endTime = isShowTimePicker ? ` ${datePaths.endTime}` : '';
                    const strEndDate = `${datePaths.endDate}${endTime}`;

                    const objStartDate = moment(strStartDate, DATETIME_PICKER_FORMAT);
                    const objEndDate = moment(strEndDate, DATETIME_PICKER_FORMAT);

                    ranges[`${strStartDate}${DATETIME_PICKER_SEPARATOR}${strEndDate}`] = [objStartDate, objEndDate];
                }
            }

            if (!isSetDefaultValue) {
                config['autoUpdateInput'] = false;
            }

            // initialize date picker
            $(element).daterangepicker(config);

            if (!isSetDefaultValue) {
                $(element).on('apply.daterangepicker', function(ev, picker) {
                    $(this).val(picker.startDate.format(DATETIME_PICKER_FORMAT) + DATETIME_PICKER_SEPARATOR + picker.endDate.format(DATETIME_PICKER_FORMAT));
                    $(this).trigger('change');
                });

                $(element).on('cancel.daterangepicker', function(ev, picker) {
                    $(this).val('');
                });

                $(element).on('change.daterangepicker', function(ev, picker) {
                    // validate time range
                    const oldValue = $(this).attr('old-value');
                    const currentValue = $(this).val();
                    if (!currentValue) return;
                    const [startDt, endDt] = currentValue.split(DATETIME_PICKER_SEPARATOR);
                    if (!moment(startDt).isValid() || !moment(endDt).isValid()) {
                        $(this).val(oldValue)
                    } else {
                        $(this).attr('old-value', currentValue);
                    }
                });
            }

            initShowData(element);

            // add event for input control
            $(element).keyup((event) => {
                delay(updateDateTimeRangeValue, KEYUP_EVENT_DELAY)
                if (event.key == ENTER_KEY) {
                    $(event.target).blur();
                }
            });
            $(element).change((element) => {
                updateDateTimeRangeValue(element);
            });
        });
    }

    if (dtId) {
        initById(dtId)
    } else {
        initByClassName(DATETIME_RANGE_PICKER_CLASS, isClassName);
        initByClassName(DATE_RANGE_PICKER_CLASS, isClassName);
    }
};


/* <h2>Call this function to initialize DateTime picker for all inputs that have name = '${DATETIME_PICKER_CLASS}' or '${DATE_PICKER_CLASS}'</h2><br>
    * <b>Note:</b>
    * - Based on the "is-show-time-picker" attribute of the input tag, it will initialize the date picker with time or not
    */
const initializeDateTimePicker = (dtId = null, isClassName = false, parentEl = null) => {
    let ranges = {};
    ranges[`${getI18nDateTimePicker().today}`] = [moment(), moment()];
    ranges[`${getI18nDateTimePicker().yesterday}`] = [moment().subtract(1, 'days'), moment().subtract(1, 'days')];
    ranges[`${getI18nDateTimePicker().dayOf7DaysAgo}`] = [moment().subtract(6, 'days'), moment().subtract(6, 'days')];
    ranges[`${getI18nDateTimePicker().dayOf30DaysAgo}`] = [moment().subtract(29, 'days'), moment().subtract(29, 'days')];
    ranges[`${getI18nDateTimePicker().firstDayOfThisMonth}`] = [moment().startOf('month'), moment().startOf('month')];
    ranges[`${getI18nDateTimePicker().lastDayOfThisMonth}`] = [moment().endOf('month'), moment().endOf('month')];

    let baseConfig = $.extend({}, getBaseDateTimePickerConfig());
    baseConfig['singleDatePicker'] = true;
    baseConfig['ranges'] = ranges;

    const updateDateTimeValue = (element) => {
        const isShowTimePicker = $(element.currentTarget).attr('is-show-time-picker') === 'True';
        splitDateTimeFunc(element, isShowTimePicker);
        updateCalendarUI(element, isShowTimePicker);
    };

    const initByClassName = (className, isClassName = false, parentEl = null) => {
        const datetimeRangeSelector = isClassName ? `.${className}` : `input[name="${className}"]`;
        const datetimeRangeControls = parentEl ? parentEl.find(datetimeRangeSelector) : $(datetimeRangeSelector);
        initDateTimePickerInner(datetimeRangeControls);
    };

    const initById = (id) => {
        const datetimeRangeControls = $(`#${id}`);
        initDateTimePickerInner(datetimeRangeControls);
    }

    const initDateTimePickerInner = (datetimeRangeControls) => {
        datetimeRangeControls.each((i, element) => {
            const config = $.extend({}, baseConfig);
            const isShowTimePicker = $(element).attr('is-show-time-picker') === 'True';
            const isSetDefaultValue = $(element).attr('is-set-default-value') === 'True';
            const isShowRecentDates = $(element).attr('is-show-recent-dates') === 'True';

            // Get and set value for date picker
            const date = $(element).val();
            const dateObj = splitDateTime(date, isShowTimePicker);
            if (dateObj.date !== '') {
                const time = isShowTimePicker ? ` ${dateObj.time}` : '';
                config.startDate = `${dateObj.date}${time}`;
                config.endDate = config.startDate;
            }

            if (isShowTimePicker) {
                config['timePicker'] = true;
                config['timePicker24Hour'] = true;
                config['timePickerIncrement'] = TIME_PICKER_INCREMENTS;

                config['locale']['format'] = DATETIME_PICKER_FORMAT;
            } else {
                config['locale']['format'] = DATETIME_PICKER_NO_TIME_FORMAT;
            }

            if (isShowRecentDates) {
                _recentChosenDates = JSON.parse(localStorage.getItem(RECENT_DATES_LS_KEY));
                _recentChosenDates = _recentChosenDates == null ? {} : _recentChosenDates;
                let key = isShowTimePicker ? 'DateTime' : 'Date';
                if (_recentChosenDates[key] == null) {
                    _recentChosenDates[key] = [];
                }

                for (let i = 0; i < _recentChosenDates[key].length; i++) {
                    const datePaths = _recentChosenDates[key][i];

                    const time = isShowTimePicker ? ` ${datePaths.time}` : '';
                    const strDate = `${datePaths.date}${time}`;
                    const objDate = moment(strDate, DATETIME_PICKER_FORMAT);

                    ranges[strDate] = [objDate, objDate];
                }
            }

            if (!isSetDefaultValue) {
                config['autoUpdateInput'] = false;
            }

            // initialize date picker
            $(element).daterangepicker(config);

            if (!isSetDefaultValue) {
                $(element).on('apply.daterangepicker', function(ev, picker) {
                    $(this).val(picker.startDate.format(DATETIME_PICKER_FORMAT));
                    $(this).trigger('change');
                });

                $(element).on('cancel.daterangepicker', function(ev, picker) {
                    $(this).val('');
                });
            }

            initShowData(element);

            // add event for input control
            $(element).keyup(delay(updateDateTimeValue, KEYUP_EVENT_DELAY));
            $(element).change((element) => {
                updateDateTimeValue(element);
            });

            // trigger on change in first load
            $(element).trigger('change');
        });
    };

    if (dtId) {
        initById(dtId)
    } else {
        initByClassName(DATETIME_PICKER_CLASS, isClassName, parentEl);
        initByClassName(DATE_PICKER_CLASS, isClassName, parentEl);
    }
};


/* <h2>Execute a function after milliseconds</h2><br>
    * <b>Parameters:</b>
    * - func: function
    * - ms: milliseconds delay
    */
function delay(func, ms) {
    let timer = 0
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(func.bind(this, ...args), ms || 0)
    }
}

let thisCalendar = null;

const initShowData = (element) => {
    $(element).off('click.daterangepicker');
    $(element).on('click.daterangepicker', function(ev, picker) {
        currentDateTimePicker = ev;
        currentCalender = picker;
    })
    $(element).off('show.daterangepicker')
    $(element).on('show.daterangepicker', function(ev, picker) {
        currentDateTimePicker = ev;
        currentCalender = picker;
        if (currentCalender) {
            thisCalendar =  $(currentDateTimePicker.currentTarget).data('daterangepicker');
            thisCalendar.callApi = true;

            thisCalendar.container.find('.drp-calendar').on('mousedown.daterangepicker', 'td.available', function (e) {
                thisCalendar.callApi = false;
                handleShowDataCount(picker, false);
            })
            thisCalendar.container.find('.drp-calendar').on('change.daterangepicker', 'select.yearselect', function (e) {
                thisCalendar.callApi = true;
                thisCalendar.showCalendars();
            })

             thisCalendar.container.find('.drp-calendar').on('change.daterangepicker', 'select.monthselect', function (e) {
                 thisCalendar.callApi = true;
                 thisCalendar.showCalendars();
            })

            thisCalendar.container.find('.drp-calendar').on('click.daterangepicker', '.prev', function (e) {
                thisCalendar.callApi = true;
                thisCalendar.showCalendars();
            })

             thisCalendar.container.find('.drp-calendar').on('click.daterangepicker', '.next', function (e) {
                 thisCalendar.callApi = true;
                 thisCalendar.showCalendars();
            })

             thisCalendar.container.find('.drp-calendar').on('change.daterangepicker', 'select.hourselect,select.minuteselect,select.secondselect,select.ampmselect', function (e) {
                 thisCalendar.callApi = false;
                 thisCalendar.showCalendars();
            })

             thisCalendar.container.find('.ranges').on('click.daterangepicker', 'li', function (e) {
                 thisCalendar.callApi = true;
                 thisCalendar.showCalendars();
            });

        }
        handleShowDataCount(picker, thisCalendar.callApi);
    });
    // drp-calendar right
    $(element).off('showCalendar.daterangepicker')
    $(element).on('showCalendar.daterangepicker', function(ev, picker) {
        const isCallApi = thisCalendar ? thisCalendar.callApi : false;
        handleShowDataCount(picker, isCallApi);
    });

    $(element).off('hide.daterangepicker')
    $(element).on('hide.daterangepicker', function(ev, picker) {
        isCalling = false;
    });
    // $(element).on('change.daterangepicker', function(ev, picker) {
    //     handleShowDataCount(picker);
    // });
};

let resLeft = {};
let resRight = {};

let isCalling = false;

const handleShowDataCount = async (picker, callApi = true) => {
    try {

        if (!picker || !$('.drp-calendar').length) return;
        if (isCalling) {
            return;
        }
        isCalling = true;
        const calendarLeft = picker.leftCalendar.calendar;
        const calendarRight = picker.rightCalendar.calendar;
        const startLeft = moment(calendarLeft[0][0]).format(DATETIME_PICKER_NO_TIME_FORMAT)
        const endLeft = moment(calendarLeft[5][6]).format(DATETIME_PICKER_NO_TIME_FORMAT)
        const startRight = moment(calendarRight[0][0]).format(DATETIME_PICKER_NO_TIME_FORMAT)
        const endRight = moment(calendarRight[5][6]).format(DATETIME_PICKER_NO_TIME_FORMAT)

        // show loading
        const timeShowLoading = 5000 //5s
        const loadingEl = `
            <div class="daterangepicker-loading">
                <span class="loader"></span>
            </div>
        `;
        setTimeout(() => {
            $('.daterangepicker-loading').remove();
            if (isCalling) {
                overRightDateStyle(null, null);
            }
        }, timeShowLoading)

        $('.daterangepicker').append(loadingEl)
        if (processId) {
            if (callApi) {
                resLeft = await getDataByType(startLeft, endLeft, calenderTypes.month);
                resRight = await getDataByType(startRight, endRight, calenderTypes.month);
                overRightDateStyle(resLeft, resRight)
                isCalling = false;
            } else {
                overRightDateStyle(resLeft, resRight)
            }
        }

        // hide loading
        // $('.daterangepicker-loading').remove();
        // isCalling = false;
    } finally {
        $('.daterangepicker-loading').remove();
        isCalling = false;
    }
};

const overRightDateStyle = (resLeft, resRight) => {
    const dataLeft = resLeft && resLeft.data ? resLeft.data.count : null;
    const dataRight = resRight && resRight.data ? resRight.data.count : null;
    let index = 0;
    const leftEl = $('.drp-calendar.left')
    const rightEl = $('.drp-calendar.right')
    for (let r = 0; r <= 5; r += 1) {
        for (let c = 0; c <= 6; c += 1) {
            const rCount = dataRight ? dataRight[index] : 0;
            const lCount = dataLeft ? dataLeft[index] : 0;
            leftEl.find(`td[data-title=r${r}c${c}`).css({
                color: lCount > 0 ? '#fff' : '#555',
            })
            rightEl.find(`td[data-title=r${r}c${c}`).css({
                color: rCount > 0 ? '#fff' : '#555',
            })
            index ++;
        }
    }
};

$(document).on('click', (e)=> {
    if ([...e.target.classList].includes('week') && e.target.closest('.table-condensed')) {
        if (!currentDateTimePicker) return;
        const _this = $(e.target);
        const thisCalendar =  $(currentDateTimePicker.currentTarget).data('daterangepicker');

        const currentTimeTable = $(e.target.closest('.table-condensed'));
        const classes = currentTimeTable.parent().parent().attr('class').split(/\s+/)
        if (classes.includes('single')) return;

        const selectedWeeks = _this.siblings();
        const startDate = getDateFromDateRange(selectedWeeks[0], thisCalendar)
        const endDate = getDateFromDateRange(selectedWeeks[selectedWeeks.length-1], thisCalendar);

        thisCalendar.startDate = null;
        thisCalendar.endDate = null;
        thisCalendar.setStartDate(startDate.clone());
        thisCalendar.setEndDate(endDate.clone());
        thisCalendar.updateView();
        thisCalendar.updateCalendars();
        thisCalendar.updateMonthsInView();

    } else {
        return;
    }
})

const calTime = (thisDatePicker, date) => {
    if (thisDatePicker.timePicker) {
        var hour = parseInt(thisDatePicker.container.find('.left .hourselect').val(), 10);
        if (!thisDatePicker.timePicker24Hour) {
            var ampm = this.container.find('.left .ampmselect').val();
            if (ampm === 'PM' && hour < 12)
                hour += 12;
            if (ampm === 'AM' && hour === 12)
                hour = 0;
        }
        var minute = parseInt(thisDatePicker.container.find('.left .minuteselect').val(), 10);
        if (isNaN(minute)) {
            minute = parseInt(thisDatePicker.container.find('.left .minuteselect option:last').val(), 10);
        }
        var second = thisDatePicker.timePickerSeconds ? parseInt(thisDatePicker.container.find('.left .secondselect').val(), 10) : 0;
        date = date.clone().hour(hour).minute(minute).second(second);
    }
    return date;
};

function getDateFromDateRange (tdEl, thisCalendar) {
    const title = $(tdEl).attr('data-title');
    const row = title.substr(1, 1);
    const col = title.substr(3, 1);
    const cal = $(tdEl).parents('.drp-calendar');
    const date = cal.hasClass('left') ? thisCalendar.leftCalendar.calendar[row][col] : thisCalendar.rightCalendar.calendar[row][col];
    return calTime(thisCalendar, date);
}

const convertUTCToLocaltime = (datetime) => {
    return moment.utc(datetime).local().format(DATE_TIME_FMT);
};

function overrideSetStartDate(startDate) {
    if (typeof startDate === 'string')
        this.startDate = moment(startDate, this.locale.format);

    if (typeof startDate === 'object')
        this.startDate = moment(startDate);

    if (!this.timePicker)
        this.startDate = this.startDate.startOf('day');

    if (this.minDate && this.startDate.isBefore(this.minDate)) {
        this.startDate = this.minDate.clone();
    }

    if (this.maxDate && this.startDate.isAfter(this.maxDate)) {
        this.startDate = this.maxDate.clone();
    }

    if (!this.isShowing)
        this.updateElement();

    this.updateMonthsInView();
};

function overrideSetEndDate(endDate) {
    if (typeof endDate === 'string')
        this.endDate = moment(endDate, this.locale.format);

    if (typeof endDate === 'object')
        this.endDate = moment(endDate);

    if (!this.timePicker)
        this.endDate = this.endDate.endOf('day');

    if (this.endDate.isBefore(this.startDate))
        this.endDate = this.startDate.clone();

    if (this.maxDate && this.endDate.isAfter(this.maxDate))
        this.endDate = this.maxDate.clone();

    if (this.maxSpan && this.startDate.clone().add(this.maxSpan).isBefore(this.endDate))
        this.endDate = this.startDate.clone().add(this.maxSpan);

    this.previousRightTime = this.endDate.clone();

    this.container.find('.drp-selected').html(this.startDate.format(this.locale.format) + this.locale.separator + this.endDate.format(this.locale.format));

    if (!this.isShowing)
        this.updateElement();

    this.updateMonthsInView();
}

const roundMinuteByTimeIncrement = (minute) => {
    const padding = (minute % TIME_PICKER_INCREMENTS) > 0 ? TIME_PICKER_INCREMENTS : 0;
    const roundVal = (Math.floor(minute / TIME_PICKER_INCREMENTS) * TIME_PICKER_INCREMENTS) + padding;
    return roundVal >= 60 ? 60 - TIME_PICKER_INCREMENTS : roundVal;
};

function overrideRenderTimePickerFunction(side) {
    // Don't bother updating the time picker if it's currently disabled
    // because an end date hasn't been clicked yet
    if (side == 'right' && !this.endDate) return;

    var html, selected, minDate, maxDate = this.maxDate;

    if (this.maxSpan && (!this.maxDate || this.startDate.clone().add(this.maxSpan).isBefore(this.maxDate)))
        maxDate = this.startDate.clone().add(this.maxSpan);

    if (side == 'left') {
        selected = this.startDate.clone();
        minDate = this.minDate;
    } else if (side == 'right') {
        selected = this.endDate.clone();
        minDate = this.startDate;

        //Preserve the time already selected
        var timeSelector = this.container.find('.drp-calendar.right .calendar-time');
        if (timeSelector.html() != '') {

            selected.hour(!isNaN(selected.hour()) ? selected.hour() : timeSelector.find('.hourselect option:selected').val());
            selected.minute(!isNaN(selected.minute()) ? selected.minute() : timeSelector.find('.minuteselect option:selected').val());
            selected.second(!isNaN(selected.second()) ? selected.second() : timeSelector.find('.secondselect option:selected').val());

            if (!this.timePicker24Hour) {
                var ampm = timeSelector.find('.ampmselect option:selected').val();
                if (ampm === 'PM' && selected.hour() < 12)
                    selected.hour(selected.hour() + 12);
                if (ampm === 'AM' && selected.hour() === 12)
                    selected.hour(0);
            }

        }

        if (selected.isBefore(this.startDate))
            selected = this.startDate.clone();

        if (maxDate && selected.isAfter(maxDate))
            selected = maxDate.clone();

    }

    //
    // hours
    //

    html = '<select class="hourselect">';

    var start = this.timePicker24Hour ? 0 : 1;
    var end = this.timePicker24Hour ? 23 : 12;

    for (var i = start; i <= end; i++) {
        var i_in_24 = i;
        if (!this.timePicker24Hour)
            i_in_24 = selected.hour() >= 12 ? (i == 12 ? 12 : i + 12) : (i == 12 ? 0 : i);

        var time = selected.clone().hour(i_in_24);
        var disabled = false;
        if (minDate && time.minute(59).isBefore(minDate))
            disabled = true;
        if (maxDate && time.minute(0).isAfter(maxDate))
            disabled = true;

        if (i_in_24 == selected.hour() && !disabled) {
            html += '<option value="' + i + '" selected="selected">' + i + '</option>';
        } else if (disabled) {
            html += '<option value="' + i + '" disabled="disabled" class="disabled">' + i + '</option>';
        } else {
            html += '<option value="' + i + '">' + i + '</option>';
        }
    }

    html += '</select> ';

    //
    // minutes
    //

    html += ': <select class="minuteselect">';

    for (var i = 0; i < 60; i += this.timePickerIncrement) {
        var padded = i < 10 ? '0' + i : i;
        var time = selected.clone().minute(i);
        var minute = roundMinuteByTimeIncrement(selected.minute());

        var disabled = false;
        if (minDate && time.second(59).isBefore(minDate))
            disabled = true;
        if (maxDate && time.second(0).isAfter(maxDate))
            disabled = true;

        if (minute == i && !disabled) {
            html += '<option value="' + i + '" selected="selected">' + padded + '</option>';
        } else if (disabled) {
            html += '<option value="' + i + '" disabled="disabled" class="disabled">' + padded + '</option>';
        } else {
            html += '<option value="' + i + '">' + padded + '</option>';
        }
    }

    html += '</select> ';

    //
    // seconds
    //

    if (this.timePickerSeconds) {
        html += ': <select class="secondselect">';

        for (var i = 0; i < 60; i++) {
            var padded = i < 10 ? '0' + i : i;
            var time = selected.clone().second(i);

            var disabled = false;
            if (minDate && time.isBefore(minDate))
                disabled = true;
            if (maxDate && time.isAfter(maxDate))
                disabled = true;

            if (selected.second() == i && !disabled) {
                html += '<option value="' + i + '" selected="selected">' + padded + '</option>';
            } else if (disabled) {
                html += '<option value="' + i + '" disabled="disabled" class="disabled">' + padded + '</option>';
            } else {
                html += '<option value="' + i + '">' + padded + '</option>';
            }
        }

        html += '</select> ';
    }

    //
    // AM/PM
    //

    if (!this.timePicker24Hour) {
        html += '<select class="ampmselect">';

        var am_html = '';
        var pm_html = '';

        if (minDate && selected.clone().hour(12).minute(0).second(0).isBefore(minDate))
            am_html = ' disabled="disabled" class="disabled"';

        if (maxDate && selected.clone().hour(0).minute(0).second(0).isAfter(maxDate))
            pm_html = ' disabled="disabled" class="disabled"';

        if (selected.hour() >= 12) {
            html += '<option value="AM"' + am_html + '>AM</option><option value="PM" selected="selected"' + pm_html + '>PM</option>';
        } else {
            html += '<option value="AM" selected="selected"' + am_html + '>AM</option><option value="PM"' + pm_html + '>PM</option>';
        }

        html += '</select>';
    }

    this.container.find('.drp-calendar.' + side + ' .calendar-time').html(html);
};