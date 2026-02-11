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

    initEventClickButton() {
        $(this.dataFinderEls.yearBtn).on('click', () => {
            this.handleGoToCalender(calenderTypes.year);
        });
        $(this.dataFinderEls.monthBtn).on('click', () => {
            this.handleGoToCalender(calenderTypes.month);
        });
        $(this.dataFinderEls.weekBtn).on('click', () => {
            this.handleGoToCalender(calenderTypes.week);
        });

        $(this.dataFinderEls.backBtn).on('click', () => {
            this.handleBackToCalender(calenderTypes.month);
        });
        $(this.dataFinderEls.setValueBtn).on('click', () => {
            this.handleSetValueToDateRangePicker();
        });

        $(this.dataFinderEls.closeModalBtn).on('click', () => {
            this.closeCalenderModal();
        });
        $(this.dataFinderEls.dataFinderBtn).on('click', (e) => {
            this.setProcessID();
            this.reloadDataFinder();
            this.showDataFinderModal(e.currentTarget);
        });
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

        $(this.dataFinderEls.inputFromTo).on('change', (e) => {
            const fromToValue = e.currentTarget.value;

            const [from, to] = this.validateRangeOfDatetime(fromToValue);

            if ((!from && !to) || (this.showFromOnly && !from)) {
                const oldValue = e.currentTarget.getAttribute('old-value');
                e.currentTarget.value = oldValue;
                return;
            }

            if (this.showFromOnly) {
                this.handleGoToCalender(this.currentCalendarType, from, from);
            } else {
                this.handleGoToCalender(this.currentCalendarType, from, to);
            }
        });
    }

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
        const fmt = this.getFormatDateTimeByCalendarType(this.currentCalendarType);

        if (this.showFromOnly) {
            const isValid = moment(from, fmt).isValid();
            return isValid ? [from, null] : [null, null];
        }

        const isValid =
            moment(from, fmt).isValid() && moment(from, fmt).isValid() && this.isValidFromToInput(from, to, fmt);

        return isValid ? [from.trim(), to.trim()] : [null, null];
    };

    isValidFromToInput = (from, to, fmt) => {
        return moment(from, fmt).isBefore(moment(to, fmt));
    };

    handleGoToCalender = (type, from, to) => {
        DataFinderService.addCacheFunctionForBackupRestoreModal(() => this.handleGoToCalender(type));
        this.switchCalender(type);
        this.setDefaultValueOfCalender(type, from, to);
    };

    switchCalender = (type) => {
        // set from to label
        $(this.dataFinderEls.dataFinderInputLabel).text(this.showFromOnly ? 'From' : 'From To');
        $(`#data-finder-card${this.suffix}`).show();

        $(`.calender-box${this.suffix}`).hide();

        $(`#data-finder-${type}${this.suffix}`).show();

        $(`.for-data-finder${this.suffix}`).hide();
        $(`.for-data-finder-${type}${this.suffix}`).show();
        this.currentCalendarType = type;
    };

    setDefaultValueOfCalender = (type, from, to) => {
        this.defaultDateTime = DataFinderService.getDefaultDateTime();
        const currentDatetimeRangeVal =
            typeof this.currentDateRangeEl == 'object' ? this.currentDateRangeEl.val() : this.currentDateRangeEl;
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
                toInput = moment().isBefore(selectedTo) ? moment().format(DATE_FMT) : selectedTo;
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
    };

    handleSetValueToDateRangePicker = (inputVal = null, closeModal = true) => {
        // const [from, to] = getFromToInputByType(calenderTypes.week);
        if (!inputVal) {
            inputVal = $(this.dataFinderEls.inputFromTo).val();
        }

        inputVal = this.roundSelectedValue(inputVal, this.currentCalendarType, true);

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

    handleBackToCalender = (type) => {
        // get old value and fill input
        this.switchCalender(type);

        const [fromInput, toInput] = this.getFromToInputByType(type);
        this.setValueFromToInput(fromInput, toInput, type);
        if (type === calenderTypes.month) {
            let monthFrom = moment(fromInput).month() + 1;
            const monthTo = moment(toInput).month() + 1;
            // monthFrom = monthTo === monthFrom ? monthFrom - 1 : monthFrom;
            const prevMonth = this.getPrevMonthFromCalendar(moment(fromInput).year(), monthFrom);
            this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
            this.monthCalendar.generateMonthCalender(moment(toInput).year(), monthTo, false, true);
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.monthCalendar.generateMonthCalender(prevMonth.year, prevMonth.month, true, true),
                true,
            );
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.monthCalendar.generateMonthCalender(moment(toInput).year(), monthTo, false, true),
                false,
            );
        }

        if (type === calenderTypes.week) {
            const startOfLastWeek = moment(toInput).subtract(6, 'days').format(DATE_FMT);
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
    };

    showDataFinderModal = (e) => {
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
                <div class="action-offset">
                    <label id="dataFinderInputLabel${this.suffix}" for="data-finder-input${this.suffix}">From To</label>
                </div>
                <div class="flex-grow-1">
                    <div class="form-group">
                        <input
                            name="data-finder-input"
                            id="data-finder-input${this.suffix}"
                            class="form-control"
                            placeholder="マップをクリックしてください"
                            type="text"
                        />
                    </div>

                    <div class="action-button">
                        <div class="action-button-group">
                            <button
                                type="button"
                                id="dataFinderBackBtn${this.suffix}"
                                class="btn btn-sm btn-secondary for-data-finder for-data-finder${this.suffix} for-data-finder-week${this.suffix}"
                            >
                                Month
                            </button>
                            <button
                                type="button"
                                id="dataFinderYearBtn${this.suffix}"
                                class="btn btn-sm btn-secondary for-data-finder for-data-finder${this.suffix} for-data-finder-month${this.suffix}"
                            >
                                Year
                            </button>
                        </div>
                        <div class="action-button-group">
                            <button type="button" id="dataFinderCloseModalBtn${this.suffix}" class="btn btn-sm btn-secondary data-finder-close-btn${this.suffix}">
                                Cancel
                            </button>
                        </div>
                        <div class="action-button-group d-flex">
                            <button
                                type="button"
                                id="dataFinderMonthBtn${this.suffix}"
                                style="margin-right: 8px"
                                class="btn btn-sm btn-primary for-data-finder for-data-finder${this.suffix} for-data-finder-year${this.suffix}"
                            >
                                Month
                            </button>
                            <button
                                type="button"
                                id="dataFinderWeekBtn${this.suffix}"
                                style="margin-right: 8px"
                                class="btn btn-sm btn-primary for-data-finder for-data-finder${this.suffix} for-data-finder-month${this.suffix}"
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                id="dataFinderSetValueBtn${this.suffix}"
                                class="btn btn-sm btn-primary for-data-finder for-data-finder${this.suffix} for-data-finder-week${this.suffix} for-data-finder-month${this.suffix} for-data-finder-year${this.suffix}"
                            >
                                Set
                            </button>
                        </div>
                    </div>
                    <div class="all-button-wrap">
                        <button type="button" id="dataFinderSetAll${this.suffix}" class="btn btn-sm btn-secondary data-finder-all-btn${this.suffix}">
                         All
                        </button>
                    </div>
                    <div class="data-finder-warning-msg hide" id="dataFinderWarningMsg${this.suffix}">
                        <p>${this.i18nMsg.i18nLargeDataCountWarningMsg}</p>
                    </div>
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
