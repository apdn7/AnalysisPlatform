const calenderTypes = {
    year: 'year',
    month: 'month',
    week: 'week',
};

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekDays2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const jaWeekDays = ['月', '火', '水', '木', '金', '土', '日'];
const enMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const enFullMonth = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const colorDic = {
    0: '#222222',
    1: '#18324c',
    20: '#204465',
    40: '#2d5e88',
    60: '#3b7aae',
    80: '#56b0f4',
    100: '#6dc3fd',
};
const DATE_FMT = 'YYYY-MM-DD';
const DATE_TIME_FMT = 'YYYY-MM-DD HH:mm';
const YEAR_MONTH_FMT = 'YYYY-MM';

const WEEKS = 6;
const DAYS = 7;
const HOURS = 24;
const YEARS = 6;
const DATA_FINDER_DEFAULT_START_TIME = '07:00';
const DATA_FINDER_DEFAULT_END_TIME = '19:00';

let isCyclicTermTab = false;
let processId = null;

const dataFinderEls = {
    dataFinderBtn: 'button[name=dataFinderBtn]',
    startProc: 'select[name=start_proc]',
};

let mainDataFinder = null;

class DataFinder extends DataFinderBase {
    static dataFinderObj = {};

    constructor(suffix = '', parentDiv = '', fromMainShowGraphPage = false, showFromOnly = false) {
        super(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
        this.weekCalendar = new WeekCalender(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
        this.monthCalendar = new MonthCalender(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
        this.yearCalendar = new YearCalendar(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
        this.parentDiv.html(this.dataFinderElement());
        this.isShowLargeDataCountWaringMsg = false;
        this.defaultDataFinderInputRange = '';

        this.initEventClickButton();
        this.setProcessID();
        this.reloadDataFinder();
    }

    static setDataFinderObj(id, processId) {
        DataFinder.dataFinderObj[id] = processId;
    }

    setProcessID = (e) => {
        if (!e) {
            this.processId = $(this.dataFinderEls.endProc).val();
        } else {
            this.processId = $(e).val();
        }
        if (this.fromMainShowGraphPage) {
            this.processId = processId;
        }
        this.setCalendarProcessId(this.processId);
    };

    setCalendarProcessId(processId) {
        this.processId = processId;
        this.monthCalendar.processId = processId;
        this.weekCalendar.processId = processId;
        this.yearCalendar.processId = processId;
    }

    setCalendarShowFromOnly(showFromOnly) {
        this.showFromOnly = showFromOnly;
        this.monthCalendar.showFromOnly = showFromOnly;
        this.weekCalendar.showFromOnly = showFromOnly;
        this.yearCalendar.showFromOnly = showFromOnly;
    }

    onClickDataFinderButton() {
        this.dataFinderEls.dataFinderBtn = `button[name=dataFinderBtn${this.suffix}]`;
        $(this.dataFinderEls.dataFinderBtn).off('click');
        $(this.dataFinderEls.dataFinderBtn).on('click', async (e) => {
            this.setProcessID();
            const dataFromOnly = $(e.currentTarget).attr('data-from-only') === 'true' || isCyclicTermTab;
            this.setCalendarShowFromOnly(dataFromOnly);
            this.reloadDataFinder();
            await this.showDataFinderModal(e.currentTarget);
        });
    }

    initEventClickButton() {
        $(this.dataFinderEls.yearBtn).on('click', async () => {
            await this.prepareDefaultDataFinderInputRange();
            this.handleGoToCalender(calenderTypes.year, null, null, false);
        });
        $(this.dataFinderEls.monthBtn).on('click', async () => {
            await this.prepareDefaultDataFinderInputRange();
            this.handleGoToCalender(calenderTypes.month, null, null, false);
        });
        $(this.dataFinderEls.weekBtn).on('click', async () => {
            await this.prepareDefaultDataFinderInputRange();
            this.handleGoToCalender(calenderTypes.week, null, null, false);
        });

        // $(this.dataFinderEls.backBtn).on('click', () => {
        //     this.handleBackToCalender(calenderTypes.month);
        // });
        $(this.dataFinderEls.setValueBtn).on('click', () => {
            this.handleSetValueToDateRangePicker();
        });

        $(this.dataFinderEls.closeModalBtn).on('click', () => {
            this.closeCalenderModal();
        });

        this.onClickDataFinderButton();

        $(this.dataFinderEls.endProc).on('change', (e) => {
            this.setProcessID(e.currentTarget);
            this.reloadDataFinder();
        });

        $(this.dataFinderEls.allBtn).on('click', async () => {
            let { max_date_time, min_date_time } = await DataFinderService.getMinMaxRangeOfData(this.processId);
            if (!max_date_time && !min_date_time) {
                return;
            }
            this.currentCalendarType = calenderTypes.week;
            // convert from, to, to local
            Object.values(calenderTypes).forEach((type) => {
                const fmt = this.getFormatDateTimeByCalendarType(type);
                const from = formatDateTime(min_date_time, fmt);
                const to = formatDateTime(max_date_time, fmt);
                this.setValueFromToInput(from, to, type, type == this.currentCalendarType);
            });
            const from = formatDateTime(min_date_time, DATE_TIME_FMT);
            const to = formatDateTime(max_date_time, DATE_TIME_FMT);
            this.handleGoToCalender(this.currentCalendarType, from, to);
        });

        $(this.dataFinderEls.last24hBtn).on('click', async () => {
            const last24hRange = await this.getLast24hDataFinderRange();
            if (!last24hRange) {
                return;
            }

            const [startDateTime, endDateTime] = last24hRange.split(DATETIME_PICKER_SEPARATOR).map((val) => val.trim());
            this.currentCalendarType = calenderTypes.week;
            Object.values(calenderTypes).forEach((type) => {
                const fmt = this.getFormatDateTimeByCalendarType(type);
                const from = moment(startDateTime).format(fmt);
                const to = moment(endDateTime).format(fmt);
                this.setValueFromToInput(from, to, type, type == this.currentCalendarType);
            });
            this.handleGoToCalender(this.currentCalendarType, startDateTime, endDateTime);
        });

        $(this.dataFinderEls.inputFromTo).off('input change');
        $(this.dataFinderEls.inputFromTo).on('input', (e) => {
            clearTimeout(this.dataFinderInputTimer);
            this.dataFinderInputTimer = setTimeout(() => {
                this.handleDataFinderInputChange(e, false);
            }, 200);
        });
        $(this.dataFinderEls.inputFromTo).on('change', (e) => {
            clearTimeout(this.dataFinderInputTimer);
            this.handleDataFinderInputChange(e, true);
        });
    }

    handleDataFinderInputChange = (e, rollbackInvalid = true) => {
        const inputEl = e.currentTarget;
        const fromToValue = inputEl.value;
        const shouldPreserveCaret = !rollbackInvalid;
        const selectionStart = shouldPreserveCaret ? inputEl.selectionStart : null;
        const selectionEnd = shouldPreserveCaret ? inputEl.selectionEnd : null;
        const selectionDirection = shouldPreserveCaret ? inputEl.selectionDirection : null;

        let [from, to] = this.validateRangeOfDatetime(fromToValue);

        if ((!from && !to) || (this.showFromOnly && !from)) {
            if (rollbackInvalid) {
                const oldValue = inputEl.getAttribute('old-value');
                inputEl.value = oldValue;
                this.handleDataFinderInputChange(e, false);
            } else {
                this.clearCalendarSelection();
            }
            return;
        }

        let calendarFrom = from;
        let calendarTo = this.showFromOnly ? from : to;
        if (this.currentCalendarType === calenderTypes.week) {
            if (this.showFromOnly) {
                calendarFrom = this.roundHour(from, 'down');
                calendarTo = calendarFrom;
            } else {
                const roundedRange = this.roundSelectedValue(
                    `${from} ${DATETIME_PICKER_SEPARATOR} ${to}`,
                    this.currentCalendarType,
                    true,
                );
                [calendarFrom, calendarTo] = roundedRange.split(DATETIME_PICKER_SEPARATOR).map((val) => val.trim());
            }
        }

        this.isHandlingDataFinderInputChange = shouldPreserveCaret;
        try {
            this.syncDataFinderInputRangeToCalendarTypes(fromToValue);

            if (this.showFromOnly) {
                this.handleGoToCalender(this.currentCalendarType, calendarFrom, calendarTo);
            } else {
                this.handleGoToCalender(this.currentCalendarType, calendarFrom, calendarTo);
            }
        } finally {
            this.isHandlingDataFinderInputChange = false;
        }

        if (rollbackInvalid) {
            inputEl.value = fromToValue;
            inputEl.setAttribute('old-value', fromToValue);
        } else if (document.activeElement === inputEl && selectionStart !== null && selectionEnd !== null) {
            const nextLength = inputEl.value.length;
            const nextStart = Math.min(selectionStart, nextLength);
            const nextEnd = Math.min(selectionEnd, nextLength);
            inputEl.setSelectionRange(nextStart, nextEnd, selectionDirection || 'none');
        }
        setTimeout(() => {
            this.syncSelectionToCalendar(calendarFrom, calendarTo, this.currentCalendarType);
        }, 0);
    };

    getFormatDateTimeByCalendarType = (type) => {
        let fmt = DATE_FMT;
        switch (type) {
            case calenderTypes.year:
                fmt = YEAR_MONTH_FMT;
                break;
            case calenderTypes.month:
                fmt = DATE_FMT;
                break;
            case calenderTypes.week:
                fmt = DATE_TIME_FMT;
                break;
            default:
                break;
        }

        return fmt;
    };

    validateRangeOfDatetime = (rangeValue) => {
        if (!rangeValue) return [null, null];
        let [from, to] = rangeValue.split(DATETIME_PICKER_SEPARATOR);
        if (!from && !to) return [null, null];
        from = from ? from.trim() : from;
        to = to ? to.trim() : to;
        const fmt = this.getFormatDateTimeByCalendarType(this.currentCalendarType);
        const parseDateTime = (value) => {
            const parsed = moment(value, [DATE_TIME_FMT, DATE_FMT, YEAR_MONTH_FMT], true);
            return parsed.isValid() ? parsed : moment(value, fmt);
        };

        if (this.showFromOnly) {
            const fromMoment = parseDateTime(from);
            return fromMoment.isValid() ? [fromMoment.format(fmt), null] : [null, null];
        }

        const fromMoment = parseDateTime(from);
        const toMoment = parseDateTime(to);
        const isValid = fromMoment.isValid() && toMoment.isValid() && fromMoment.isBefore(toMoment);

        return isValid ? [fromMoment.format(fmt), toMoment.format(fmt)] : [null, null];
    };

    isValidFromToInput = (from, to, fmt) => {
        return moment(from, fmt).isBefore(moment(to, fmt));
    };

    handleGoToCalender = (type, from, to, syncSelection = true) => {
        DataFinderService.addCacheFunctionForBackupRestoreModal(() => this.handleGoToCalender(type));
        this.switchCalender(type);
        this.setDefaultValueOfCalender(type, from, to, syncSelection);
    };

    switchCalender = (type) => {
        // set from to label
        $(this.dataFinderEls.dataFinderInputLabel).text(this.showFromOnly ? 'From' : 'From To');
        $(`#data-finder-card${this.suffix}`).show();

        $(`.calender-box${this.suffix}`).hide();

        $(`#data-finder-${type}${this.suffix}`).show();

        $(`.for-data-finder${this.suffix}`).hide();
        $(`.for-data-finder-${type}${this.suffix}`).show();
        $(`.data-finder-view-btn${this.suffix}`).removeClass('active');
        $(`.data-finder-view-${type}${this.suffix}`).addClass('active');
        this.currentCalendarType = type;
    };

    getDefaultDataFinderInputRange = async (processId = this.processId) => {
        let max_date_time = null;
        try {
            ({ max_date_time } = await DataFinderService.getMinMaxRangeOfData(processId));
        } catch (e) {
            return '';
        }
        if (!max_date_time) {
            return '';
        }

        const lastDataDate = formatDateTime(max_date_time, DATE_FMT);
        return `${lastDataDate} ${DATA_FINDER_DEFAULT_START_TIME}${DATETIME_PICKER_SEPARATOR}${lastDataDate} ${DATA_FINDER_DEFAULT_END_TIME}`;
    };

    getLast24hDataFinderRange = async () => {
        let max_date_time = null;
        try {
            ({ max_date_time } = await DataFinderService.getMinMaxRangeOfData(this.processId));
        } catch (e) {
            return '';
        }
        if (!max_date_time) {
            return '';
        }

        // Last 24h is anchored to the latest available data, not the current time.
        const endDateTime = moment(formatDateTime(max_date_time, DATE_TIME_FMT));
        const startDateTime = endDateTime.clone().subtract(24, 'hours');
        return `${startDateTime.format(DATE_TIME_FMT)}${DATETIME_PICKER_SEPARATOR}${endDateTime.format(DATE_TIME_FMT)}`;
    };

    // Only replace the initial picker default. Keep any range the user already chose.
    isInitialDefaultDateTimeRange = (dateTimeRange) => {
        if (!dateTimeRange) {
            return true;
        }

        const { startDate, startTime, endDate, endTime } = splitDateTimeRange(dateTimeRange);
        const today = moment().format(DATE_FMT);
        return (
            moment(startDate).format(DATE_FMT) === today &&
            moment(endDate).format(DATE_FMT) === today &&
            startTime === DATA_FINDER_DEFAULT_START_TIME &&
            endTime === DATA_FINDER_DEFAULT_END_TIME
        );
    };

    prepareDefaultDataFinderInputRange = async () => {
        const currentDatetimeRangeVal =
            typeof this.currentDateRangeEl == 'object' ? this.currentDateRangeEl.val() : this.currentDateRangeEl;
        this.defaultDataFinderInputRange = this.isInitialDefaultDateTimeRange(currentDatetimeRangeVal)
            ? await this.getDefaultDataFinderInputRange()
            : '';
    };

    // Update only the visible Data Finder input; the external picker is updated after Set.
    setDataFinderInputValue = (rangeValue) => {
        if (!rangeValue) {
            return;
        }

        const { startDate, startTime, endDate, endTime } = splitDateTimeRange(rangeValue);
        const inputValue = this.showFromOnly
            ? `${moment(startDate).format(DATE_FMT)} ${startTime}`
            : `${moment(startDate).format(DATE_FMT)} ${startTime}${DATETIME_PICKER_SEPARATOR}${moment(endDate).format(
                  DATE_FMT,
              )} ${endTime}`;

        $(this.dataFinderEls.inputFromTo).val(inputValue);
        $(this.dataFinderEls.inputFromTo).attr('old-value', inputValue);
        $(this.dataFinderEls.inputFromTo).attr('data-finder-default-input', inputValue);
    };

    hasFullDateTimeRange = (rangeValue) => {
        const { startDate, startTime, endDate, endTime } = splitDateTimeRange(rangeValue);
        if (this.showFromOnly) {
            return Boolean(startDate && startTime);
        }
        return Boolean(startDate && startTime && endDate && endTime);
    };

    shouldKeepDataFinderInputTime = (inputVal) => {
        if (!inputVal || inputVal !== $(this.dataFinderEls.inputFromTo).val()) {
            return false;
        }

        const autoDefault = $(this.dataFinderEls.inputFromTo).attr('data-finder-default-input');
        return inputVal === autoDefault && this.hasFullDateTimeRange(inputVal);
    };

    setDefaultValueOfCalender = (type, from, to, syncSelection = true) => {
        this.defaultDateTime = DataFinderService.getDefaultDateTime();
        let currentDatetimeRangeVal =
            typeof this.currentDateRangeEl == 'object' ? this.currentDateRangeEl.val() : this.currentDateRangeEl;
        const defaultDataFinderInputRange = !from && !to ? this.defaultDataFinderInputRange : '';
        if (defaultDataFinderInputRange) {
            currentDatetimeRangeVal = defaultDataFinderInputRange || currentDatetimeRangeVal;
        }
        if (type === calenderTypes.month) {
            const currentSetDateRange = currentDatetimeRangeVal;
            let { startDate, endDate } = splitDateTimeRange(currentSetDateRange);
            if (!endDate) {
                endDate = moment(startDate).add(1, 'months').format(DATE_FMT);
            }
            let [fromInput, toInput] = this.getFromToInputByType(calenderTypes.year);
            if (from && to) {
                [fromInput, toInput] = [from, to];
            }
            let startDateObj = null;
            let endDateObj = null;
            if (startDate && endDate) {
                startDateObj = DataFinderService.getDateObject(moment(startDate));
                endDateObj = DataFinderService.getDateObject(moment(endDate));
            }
            if (!fromInput || !toInput) {
                // setMonthFromTo(defaultDateTime.firstDayOfMonth, defaultDateTime.date);
                const firstDate = startDateObj ? startDateObj : this.defaultDateTime;
                const lastDate = endDateObj ? endDateObj : this.defaultDateTime;
                const fromDate = startDateObj ? firstDate.date : firstDate.firstDayOfMonth;
                this.setValueFromToInput(fromDate, lastDate.date, type);
                let prevMonth = firstDate;
                // if from and to is same then - 1
                if (moment(`${firstDate.year}-${firstDate.month}`).isSame(`${lastDate.year}-${lastDate.month}`)) {
                    prevMonth = this.getPrevMonthFromCalendar(firstDate.year, firstDate.month);
                }
                this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
                this.monthCalendar.generateMonthCalender(lastDate.year, lastDate.month, false, true);
                DataFinderService.addCacheFunctionForBackupRestoreModal(
                    () => this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true),
                    true,
                );
                DataFinderService.addCacheFunctionForBackupRestoreModal(
                    () => this.monthCalendar.generateMonthCalender(lastDate.year, lastDate.month, false, true),
                    false,
                );
            } else {
                if (!from && !to) {
                    fromInput = `${fromInput}-01`;
                    toInput = `${toInput}-01`;
                }
                const selectedTo = moment(toInput).endOf('month').format(DATE_FMT);
                toInput = moment(toInput).isBefore(selectedTo) ? moment(toInput).format(DATE_FMT) : selectedTo;
                let fromObj = DataFinderService.getDateObject(fromInput);
                let toObj = DataFinderService.getDateObject(toInput);
                // monthFrom = monthFrom === monthTo ? monthFrom - 1 : monthFrom;
                // setMonthFromTo(from, to);
                if (from && to) {
                    this.setValueFromToInput(from, to, type);
                } else {
                    this.setValueFromToInput(fromInput, toInput, type);
                }

                // if from and to is same then - 1
                let prevMonth = fromObj;
                if (moment(`${fromObj.year}-${fromObj.month}`).isSame(`${toObj.year}-${toObj.month}`)) {
                    prevMonth = this.getPrevMonthFromCalendar(fromObj.year, fromObj.month);
                }
                this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
                this.monthCalendar.generateMonthCalender(toObj.year, toObj.month, false, true);
                DataFinderService.addCacheFunctionForBackupRestoreModal(
                    () => this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true),
                    true,
                );
                DataFinderService.addCacheFunctionForBackupRestoreModal(
                    () => this.monthCalendar.generateMonthCalender(toObj.year, toObj.month, false, true),
                    false,
                );
            }
        }

        if (type === calenderTypes.week) {
            // set default from to input
            let [fromInput, toInput] = this.getFromToInputByType(calenderTypes.month);
            let defaultFromInput = '';
            if (from && to) {
                [fromInput, toInput] = [from, to];
                defaultFromInput = `${fromInput}`;
            } else {
                defaultFromInput = `${fromInput} 00:00`;
            }
            if (fromInput && !toInput) {
                toInput = fromInput;
            }
            // next day of 00:00
            const selectedTo = `${moment(toInput).add(1, 'days').format(DATE_FMT)} 00:00`;
            const defaultToInput = moment().isBefore(selectedTo) ? moment().format(DATE_TIME_FMT) : selectedTo;
            let startOfLastWeek = moment(defaultToInput).subtract(6, 'days').format(DATE_FMT);
            const fromEndDate = moment(fromInput).add(6, 'days').format(DATE_FMT);

            if (moment(startOfLastWeek).isBefore(fromEndDate)) {
                startOfLastWeek = moment(fromEndDate).add(1, 'days').format(DATE_FMT);
            }

            if (from && to) {
                this.setValueFromToInput(from, to, type);
            } else {
                this.setValueFromToInput(defaultFromInput, defaultToInput, type);
            }
            this.weekCalendar.generateWeekCalender(fromInput);
            this.weekCalendar.generateWeekCalender(startOfLastWeek, false);
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.weekCalendar.generateWeekCalender(fromInput),
                true,
            );
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.weekCalendar.generateWeekCalender(startOfLastWeek, false),
                false,
            );
        }

        if (type === calenderTypes.year) {
            let [fromInput, toInput] = this.getFromToInputByType(calenderTypes.month);
            if (from && to) {
                [fromInput, toInput] = [from, to];
            }
            if (fromInput && !toInput) {
                toInput = fromInput;
            }
            if (!fromInput && !toInput) {
                this.yearCalendar.generateYearCalendar(this.defaultDateTime.year - YEARS + 1);
                this.setValueFromToInput('', '', type);
            } else {
                const fromObj = DataFinderService.getDateObject(fromInput);
                const toObj = DataFinderService.getDateObject(toInput);
                this.yearCalendar.generateYearCalendar(Number(toInput.split('-')[0]) - YEARS + 1);
                this.setValueFromToInput(
                    `${fromObj.year}-${DataFinderService.addZeroToNumber(fromObj.month)}`,
                    `${toObj.year}-${DataFinderService.addZeroToNumber(toObj.month)}`,
                    type,
                );
            }
        }

        if (syncSelection) {
            const [selectedFrom, selectedTo] = this.getFromToInputByType(type);
            this.syncSelectionToCalendar(selectedFrom, selectedTo, type);
        }

        // The month calendar needs date-only values, so restore the intended 07:00-19:00 text afterward.
        if (defaultDataFinderInputRange) {
            this.setDataFinderInputValue(defaultDataFinderInputRange);
            this.defaultDataFinderInputRange = '';
        }
    };

    handleSetValueToDateRangePicker = (inputVal = null, closeModal = true) => {
        // const [from, to] = getFromToInputByType(calenderTypes.week);
        if (!inputVal) {
            inputVal = $(this.dataFinderEls.inputFromTo).val();
        }

        // Preserve the auto default 07:00-19:00; date-only calendar selections still use normal rounding.
        if (!this.shouldKeepDataFinderInputTime(inputVal)) {
            inputVal = this.roundSelectedValue(inputVal, this.currentCalendarType, true);
        }

        if (!(typeof this.currentDateRangeEl == 'object')) {
            $('input[name=DATETIME_PICKER]')
                .val(inputVal.split(` ${COMMON_CONSTANT.EN_DASH} `)[0])
                .trigger('change');
        } else {
            this.currentDateRangeEl.val(inputVal).trigger('change');
        }
        if (closeModal) {
            this.closeCalenderModal();
        }
    };

    hideSingleCalendar = () => {
        $(`.single-calendar${this.suffix}`).hide();
    };

    reloadDataFinder() {
        DataFinder.setDataFinderObj(this.id, this.processId);
        this.showDataFinderButton(this.processId, null);
        // reload data finder
        if (this.processId && this.isDataFinderShowing) {
            this.switchCalender(this.currentCalendarType);
            this.setDefaultValueOfCalender(this.currentCalendarType);
        }
    }

    showDataFinderButton = (processId, btnParent) => {
        const btn = btnParent ? btnParent.find(this.dataFinderEls.dataFinderBtn) : $(this.dataFinderEls.dataFinderBtn);
        if (processId) {
            btn.show();
        } else {
            btn.hide();
        }
    };

    // handleBackToCalender = (type) => {
    //     // get old value and fill input
    //     this.switchCalender(type);
    //
    //     const [fromInput, toInput] = this.getFromToInputByType(type);
    //     this.setValueFromToInput(fromInput, toInput, type);
    //     if (type === calenderTypes.month) {
    //         let monthFrom = moment(fromInput).month() + 1;
    //         const monthTo = moment(toInput).month() + 1;
    //         // monthFrom = monthTo === monthFrom ? monthFrom - 1 : monthFrom;
    //         const prevMonth = this.getPrevMonthFromCalendar(moment(fromInput).year(), monthFrom);
    //         this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
    //         this.monthCalendar.generateMonthCalender(moment(toInput).year(), monthTo, false, true);
    //         DataFinderService.addCacheFunctionForBackupRestoreModal(
    //             () => this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true),
    //             true,
    //         );
    //         DataFinderService.addCacheFunctionForBackupRestoreModal(
    //             () => this.monthCalendar.generateMonthCalender(moment(toInput).year(), monthTo, false, true),
    //             false,
    //         );
    //     }
    //
    //     if (type === calenderTypes.week) {
    //         const startOfLastWeek = moment(toInput).subtract(6, 'days').format(DATE_FMT);
    //         this.weekCalendar.generateWeekCalender(fromInput);
    //         this.weekCalendar.generateWeekCalender(startOfLastWeek, false);
    //         DataFinderService.addCacheFunctionForBackupRestoreModal(
    //             () => this.weekCalendar.generateWeekCalender(fromInput),
    //             true,
    //         );
    //         DataFinderService.addCacheFunctionForBackupRestoreModal(
    //             () => this.weekCalendar.generateWeekCalender(startOfLastWeek, false),
    //             false,
    //         );
    //     }
    // };

    showDataFinderModal = async (e) => {
        DataFinderService.addCacheFunctionForBackupRestoreModal(() => this.showDataFinderModal(e));
        this.isDataFinderShowing = true;
        this.currentDateRangeEl = $(e).parent().find('[name^=DATETIME]');

        if (!this.currentDateRangeEl.get().length) {
            this.currentDateRangeEl = $(e).parent().find('.DATETIME_PICKER');
        }

        if (!this.currentDateRangeEl.get().length) {
            this.currentDateRangeEl = $('#datetimeRangeShowValue').text();
        }
        this.defaultDateTime = DataFinderService.getDefaultDateTime();
        await this.prepareDefaultDataFinderInputRange();
        this.switchCalender(calenderTypes.month);
        this.setDefaultValueOfCalender(calenderTypes.month);
        // hide button all in case of select from only
        if (!this.isMainDataFinder) {
            $(this.dataFinderEls.allBtn).hide();
        }
    };

    dataFinderElement() {
        return `
                        <div id="data-finder-modal" class="data-finder position-relative">
        <span class="data-finder-close data-finder-close-btn${this.suffix}"><i class="fa fa-times"></i></span>
        <div class="data-finder-calendar">
            <div id="data-finder-year${this.suffix}" class="calender-box year-calendar calender-box${this.suffix} year-calendar${this.suffix}" style="display: none"></div>
            <div id="data-finder-month${this.suffix}" class="calender-box month-calendar calender-box${this.suffix} month-calendar${this.suffix}"></div>
            <div id="data-finder-week${this.suffix}" class="calender-box week-calendar calender-box${this.suffix} week-calendar${this.suffix}" style="display: none"></div>
        </div>
        <div class="data-finder-action">
            <input name="data-finder-from" id="data-finder-from${this.suffix}" class="form-control" type="text" hidden />
            <input name="data-finder-from" id="data-finder-to${this.suffix}" class="form-control" type="text" hidden />
            <div class="action">
                <div class="data-finder-mode-actions">
                    <button
                        type="button"
                        id="dataFinderYearBtn${this.suffix}"
                        class="btn btn-sm btn-secondary data-finder-view-btn data-finder-view-btn${this.suffix} data-finder-view-year${this.suffix}"
                    >
                        Year
                    </button>
                    <button
                        type="button"
                        id="dataFinderMonthBtn${this.suffix}"
                        class="btn btn-sm btn-secondary data-finder-view-btn data-finder-view-btn${this.suffix} data-finder-view-month${this.suffix}"
                    >
                        Month
                    </button>
                    <button
                        type="button"
                        id="dataFinderWeekBtn${this.suffix}"
                        class="btn btn-sm btn-secondary data-finder-view-btn data-finder-view-btn${this.suffix} data-finder-view-week${this.suffix}"
                    >
                        Week
                    </button>
                </div>
                <div class="data-finder-range-actions">
                    <button type="button" id="dataFinderSetAll${this.suffix}" class="btn btn-sm btn-secondary data-finder-all-btn${this.suffix}">
                        Full Data Range
                    </button>
                    <button type="button" id="dataFinderLast24h${this.suffix}" class="btn btn-sm btn-secondary">
                        Last 24h
                    </button>
                </div>
                <div class="data-finder-input-wrap">
                    <label id="dataFinderInputLabel${this.suffix}" for="data-finder-input${this.suffix}">From To</label>
                    <div class="form-group">
                        <input
                            name="data-finder-input"
                            id="data-finder-input${this.suffix}"
                            class="form-control"
                            placeholder="マップをクリックしてください"
                            type="text"
                        />
                    </div>
                </div>
                <div class="data-finder-submit-actions">
                    <button type="button" id="dataFinderCloseModalBtn${this.suffix}" class="btn btn-sm btn-secondary data-finder-cancel-btn data-finder-close-btn${this.suffix}">
                        Cancel
                    </button>
                    <button
                        type="button"
                        id="dataFinderSetValueBtn${this.suffix}"
                        class="btn btn-sm btn-primary for-data-finder for-data-finder${this.suffix} for-data-finder-week${this.suffix} for-data-finder-month${this.suffix} for-data-finder-year${this.suffix}"
                    >
                        Set
                    </button>
                </div>
                <div class="data-finder-warning-msg hide" id="dataFinderWarningMsg${this.suffix}">
                    <p>${this.i18nMsg.i18nLargeDataCountWarningMsg}</p>
                </div>
            </div>
        </div>
    </div>
    <div class="single-month-calendar single-month-calendar${this.suffix} single-calendar single-calendar${this.suffix} position-fixed" style="display: none">
        <div class="single-month-calendar-header single-calendar-header">
            <div class="single-month-calendar-title single-calendar-title" id="singleMonthCalendarShowYear${this.suffix}"></div>
            <div class="single-month-calendar-action single-calendar-action">
                <i class="fa fa-arrow-up" id="singleMonthCalendarGoToNextYear${this.suffix}"></i>
                <i class="fa fa-arrow-down" id="singleMonthCalendarGoToPrevYear${this.suffix}"></i>
            </div>
        </div>
        <div class="single-month-calendar-body single-calendar-body" id="singleMonthCalendarBody${this.suffix}"></div>
        <div class="single-month-calendar-bottom single-calendar-bottom">
            <div class="action" id="singleMonthCalendarThisWeek${this.suffix}">{{ _('This week') }}</div>
        </div>
    </div>

    <div class="single-date-calendar single-date-calendar${this.suffix} ingle-calendar single-calendar${this.suffix} position-fixed" style="display: none">
        <div class="single-date-calendar-header single-calendar-header">
            <div class="single-date-calendar-title single-calendar-title" id="singleDateCalendarShowYearMonth${this.suffix}"></div>
            <div class="single-date-calendar-action single-calendar-action">
                <i class="fa fa-arrow-up" id="singleDateCalendarGoToNextMonth${this.suffix}"></i>
                <i class="fa fa-arrow-down" id="singleDateCalendarGoToPrevMonth${this.suffix}"></i>
            </div>
        </div>
        <div class="single-date-calendar-body single-calendar-body" id="singleDateCalendarBody${this.suffix}"></div>
        <div class="single-date-calendar-bottom single-calendar-bottom">
            <div class="action" id="singleDateCalendarThisDate${this.suffix}">{{ _('Today') }}</div>
        </div>
    </div>
        `;
    }

    getPrevMonthFromCalendar = (year, month) => {
        let prevMonth = month - 1;
        if (prevMonth) {
            return { year, month: prevMonth };
        }
        return { year: year - 1, month: 12 };
    };
}

$(() => {
    setTimeout(() => {
        DataFinderService.setProcessID();
        $(dataFinderEls.startProc).on('change', (e) => {
            DataFinderService.setProcessID();
            setColorRelativeStartEndProc();
            checkIfProcessesAreLinked();
        });
    }, 2000);

    mainDataFinder = new DataFinder('', 'data-finder-div', true);

    let $wrapper;
    if ($('#backupAndRestoreModal').length) {
        $wrapper = $('#data-finder-card');
    } else {
        $wrapper = $('body');
    }
    $wrapper.append('<div class="data-finder-hover" style="display: none"></div>');
});
