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
};

// Regex filter for date without time
const DATE_FILTER_REGEX_DICT = {
    FULL_DATE_SEPARATOR_REGEX : /^(\d{4})\/*-* *(\d{2})\/*-* *(\d{2})$/, // '2022-02-31' or '2022/02/31' or '2022-02-31' or '20220231
    SHORT_YEAR_DATE_SEPARATOR_REGEX : /^(\d{2})\/*-* *(\d{2})\/*-* *(\d{2})$/, // '22-02-31' or '22/02/31' or '22-02-31' or '220231'
    NO_YEAR_DATE_SEPARATOR_REGEX : /^()(\d{2})\/*-* *(\d{2})$/, // '02-31' or '02/31' or '02-31' or '0231'
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
            showWeekNumbers: true,
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
                let year = matchObj[1];
                if (year.length === 2) { // in case year is 2 numbers -> add '2000'
                    year = `20${year}`;
                } else if (year === '') { // in case no year -> get current year
                    year = moment().year();
                }

                date = `${year}${DATE_SEPARATOR}${matchObj[2]}${DATE_SEPARATOR}${matchObj[3]}`;

                // check input minutes
                let minutes = matchObj[4];
                if (minutes.length === 1) { // in case year is 1 numbers -> add '0' at first
                    minutes = `0${minutes}`;
                }

                time = `${minutes}${HOUR_SEPARATOR}${matchObj[5]}`;
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
                let year = matchObj[1];
                if (year.length === 2) { // in case year is 2 numbers -> add '2000'
                    year = `20${year}`;
                } else if (year === '') { // in case no year -> get current year
                    year = moment().year();
                }

                date = `${year}${DATE_SEPARATOR}${matchObj[2]}${DATE_SEPARATOR}${matchObj[3]}`;
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
const initializeDateTimeRangePicker = (dtId = null) => {
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

    const initByClassName = (className) => {
        const datetimeRangeControls = $(`input[name="${className}"]`);
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
            }

            // add event for input control
            $(element).keyup(delay(updateDateTimeRangeValue, KEYUP_EVENT_DELAY));
            $(element).change((element) => {
                updateDateTimeRangeValue(element);
            });
        });
    }

    if (dtId) {
        initById(dtId)
    } else {
        initByClassName(DATETIME_RANGE_PICKER_CLASS);
        initByClassName(DATE_RANGE_PICKER_CLASS);
    }
};


/* <h2>Call this function to initialize DateTime picker for all inputs that have name = '${DATETIME_PICKER_CLASS}' or '${DATE_PICKER_CLASS}'</h2><br>
    * <b>Note:</b>
    * - Based on the "is-show-time-picker" attribute of the input tag, it will initialize the date picker with time or not
    */
const initializeDateTimePicker = (dtId = null) => {
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

    const initByClassName = (className) => {
        const datetimeRangeControls = $(`input[name="${className}"]`);
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
        initByClassName(DATETIME_PICKER_CLASS);
        initByClassName(DATE_PICKER_CLASS);
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