/**
 * @file The class DataFinderBase contains the properties of DataFinder and action functions
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */
class DataFinderBase {
    defaultDateTime = {};
    currentDateRangeEl = null;
    startDate = '';
    endDate = '';
    isDataFinderShowing = false;
    showFromOnly = isCyclicTermTab;
    processId = null;
    currentCalendarType = calenderTypes.month;
    LARGE_DATA = 1000000;

    i18nMsg = {
        i18nLargeDataCountWarningMsg: $('#i18nLargeDataCountWarningMsg').text(),
    };
    constructor(suffix = '', parentDiv = '', fromMainShowGraphPage = false, showFromOnly = false) {
        this.suffix = suffix;
        this.showFromOnly = isCyclicTermTab || showFromOnly;
        this.fromMainShowGraphPage = fromMainShowGraphPage;
        this.id = this.suffix || 'main';
        this.isMainDataFinder = this.id == 'main';
        this.parentDiv = $(`#${parentDiv}`);
        this.dataFinderEls = {
            inputFromId: '#data-finder-from' + this.suffix,
            inputToId: '#data-finder-to' + this.suffix,
            inputFromTo: '#data-finder-input' + this.suffix,
            dataFinderBtn: `button[name=dataFinderBtn${this.suffix}]`,
            startProc: 'select[name=start_proc]', // add start proc name
            endProc: this.fromMainShowGraphPage ? 'select[name^=end_proc' : `select[name=end_proc${this.suffix}`,
            dataFinderInputLabel: '#dataFinderInputLabel' + this.suffix,
            singleMonthCalendarShowYear: '#singleMonthCalendarShowYear' + this.suffix,
            singleMonthCalendarGoToNextYear: '#singleMonthCalendarGoToNextYear' + this.suffix,
            singleMonthCalendarGoToPrevYear: '#singleMonthCalendarGoToPrevYear' + this.suffix,
            singleMonthCalendarBody: '#singleMonthCalendarBody' + this.suffix,
            singleMonthCalendarThisWeek: '#singleMonthCalendarThisWeek' + this.suffix,
            singleDateCalendarShowYearMonth: '#singleDateCalendarShowYearMonth' + this.suffix,
            singleDateCalendarGoToNextMonth: '#singleDateCalendarGoToNextMonth' + this.suffix,
            singleDateCalendarGoToPrevMonth: '#singleDateCalendarGoToPrevMonth' + this.suffix,
            singleDateCalendarBody: '#singleDateCalendarBody' + this.suffix,
            singleDateCalendarThisDate: '#singleDateCalendarThisDate' + this.suffix,
            singleDateCalendar: '.single-date-calendar' + this.suffix,
            singleMonthCalendar: '.single-month-calendar' + this.suffix,
            showSingleYearCalendar: '#showSingleYearCalendar' + this.suffix,
            showSingleMonthCalendar: '#showSingleMonthCalendar' + this.suffix,
            dataFinderMonth: '#data-finder-month' + this.suffix,
            dataFinderWeek: '#data-finder-week' + this.suffix,
            dataFinderCard: '#data-finder-card' + this.suffix,
            monthBtn: `#dataFinderMonthBtn${this.suffix}`,
            yearBtn: `#dataFinderYearBtn${this.suffix}`,
            weekBtn: `#dataFinderWeekBtn${this.suffix}`,
            setValueBtn: `#dataFinderSetValueBtn${this.suffix}`,
            closeModalBtn: `.data-finder-close-btn${this.suffix}`,
            // backBtn: `#dataFinderBackBtn${this.suffix}`,
            allBtn: `#dataFinderSetAll${this.suffix}`,
            last24hBtn: `#dataFinderLast24h${this.suffix}`,
            largeDataWarningMsg: `#dataFinderWarningMsg${this.suffix}`,
        };
    }

    /**
     * @description This function to add all events of click the cell of year, month, week calendars
     * @param type
     */
    rangeCell = (type) => {
        $(`.${type}-calendar${this.suffix} .cell`).off('dblclick');
        $(`.${type}-calendar${this.suffix} .cell`).on('dblclick', (e) => {
            this.handleDblClickCell(e, type);
        });

        $(`.${type}-calendar${this.suffix} .cell`).off('click');
        $(`.${type}-calendar${this.suffix} .cell`).on('click', (e) => {
            this.handleClickCell(e, type);
        });

        $(`.${type}-calendar${this.suffix} .cell`).off('mouseover');
        $(`.${type}-calendar${this.suffix} .cell`).on('mouseover', (e) => {
            this.handleMouseoverCell(e, type);
            this.handleShowHoverMessage(e);
        });

        $(`.${type}-calendar${this.suffix} .cell`).off('mouseleave');
        $(`.${type}-calendar${this.suffix} .cell`).on('mouseleave', function (e) {
            $('.data-finder-hover').css({
                display: 'none',
            });
        });

        $('.data-finder-hover').off('mouseleave');
        $('.data-finder-hover').on('mouseleave', function (e) {
            $(e.currentTarget).css({
                display: 'none',
            });
        });
    };

    /**
     * @description Handle double click to the cell of calendar by type
     * @param e
     * @param type
     */
    handleDblClickCell = (e, type) => {
        const parentClass = `.${type}-calendar${this.suffix}`;
        this.startDate = '';
        this.endDate = '';
        const thisCell = $(e.currentTarget);
        thisCell.closest(parentClass).find('.cell').removeClass('active in-range');
    };

    /**
     * @description Handle Click the cell of calendar by type
     * @param e
     * @param type
     */

    handleClickCell = (e, type) => {
        const parentClass = `.${type}-calendar${this.suffix}`;
        const thisCell = $(e.currentTarget);
        if (this.showFromOnly) {
            // click only to choose date
            thisCell.closest(parentClass).find('.cell').removeClass('active in-range');
            thisCell.addClass('in-range');
            thisCell.addClass('active');
            this.startDate = thisCell.attr('data');
            this.endDate = this.startDate;
            this.setValueFromToInput(this.startDate, this.startDate, type);
            return;
        }
        const searchData = type === calenderTypes.week ? thisCell.attr('dat') : thisCell.attr('data');
        const allSameCell =
            type === calenderTypes.week
                ? thisCell.closest(parentClass).find(`.cell[dat=${searchData}]`)
                : thisCell.closest(parentClass).find(`.cell[data=${searchData}]`);
        if (!this.startDate) {
            allSameCell.addClass('active in-range');
            this.startDate = thisCell.attr('data');
            return;
        }

        if (this.startDate && !this.endDate) {
            this.endDate = thisCell.attr('data');
            allSameCell.addClass('active');
            if (moment(this.startDate).isAfter(this.endDate)) {
                const temp = this.startDate;
                this.startDate = this.endDate;
                this.endDate = temp;
            }
            if (type === calenderTypes.week) {
                this.endDate = moment(this.endDate).add(1, 'hours').format(DATE_TIME_FMT);
            }
            this.setValueFromToInput(this.startDate, this.endDate, type, true);
            return;
        }

        if (this.startDate && this.endDate) {
            this.startDate = '';
            this.endDate = '';
            thisCell.closest(parentClass).find('.cell').removeClass('active in-range');
            thisCell.trigger('click');
        }
    };

    checkDataCountOfRange = async (from, to, type) => {
        // convert local to UTC
        if (!from || !to) return;
        // round value
        const inputVal = this.roundSelectedValue(`${from} ${DATETIME_PICKER_SEPARATOR} ${to}`, type);
        [from, to] = inputVal.split(DATETIME_PICKER_SEPARATOR).map((val) => val.trim());

        const fromUTC = convertLocalToUTC(from);
        const toUTC = convertLocalToUTC(to);

        const { count } = await DataFinderService.getDataCountOfRange(this.processId, fromUTC, toUTC);
        this.setIsShowLargeDataCountWarningMsg(count);
        this.toggleLargeDataWarningMsg();
    };

    setIsShowLargeDataCountWarningMsg = (dataCount) => {
        if (dataCount >= this.LARGE_DATA) {
            this.isShowLargeDataCountWaringMsg = true;
        } else {
            this.isShowLargeDataCountWaringMsg = false;
        }
    };

    toggleLargeDataWarningMsg = () => {
        if (this.isShowLargeDataCountWaringMsg) {
            $(this.dataFinderEls.largeDataWarningMsg).show();
        } else {
            $(this.dataFinderEls.largeDataWarningMsg).hide();
        }
    };

    /**
     * @description Handle mouse over into the cell
     * @param e
     * @param type
     */
    handleMouseoverCell = (e, type) => {
        const parentClass = `.${type}-calendar${this.suffix}`;
        if (this.startDate && !this.endDate) {
            const thisCell = $(e.currentTarget);
            const selectedDate = calenderTypes.week ? thisCell.attr('date') : thisCell.attr('data');
            const diffType = type === calenderTypes.year ? 'months' : 'days';
            const format = type === calenderTypes.year ? 'YYYY-MM' : DATE_FMT;

            let nextDate = type === calenderTypes.week ? moment(this.startDate).format(DATE_FMT) : this.startDate;
            const diffCount = selectedDate ? moment(selectedDate).diff(nextDate, diffType) : null;
            const isForwardSelection = diffCount < 0;
            const rangeDays = thisCell.closest(parentClass).find('.cell');
            let dates = [...rangeDays].map((el) => $(el).attr('date'));
            dates.push(thisCell.attr('date'));
            dates = uniq(dates);
            rangeDays.removeClass('in-range');

            let startH = Number(moment(this.startDate).format('HH'));
            let endH = isForwardSelection ? 0 : HOURS;
            const modifyDates = [];
            for (let i = 0; i <= Math.abs(diffCount); i += 1) {
                if (dates.includes(nextDate)) {
                    modifyDates.push(nextDate);
                }
                nextDate = diffCount > 0 ? moment(nextDate).add(1, diffType) : moment(nextDate).subtract(1, diffType);
                nextDate = nextDate.format(format);
            }

            modifyDates.forEach((date, i) => {
                if (type === calenderTypes.week) {
                    const isOneDay = modifyDates.length === 1;
                    if (i === modifyDates.length - 1) {
                        endH = Number(moment(thisCell.attr('data')).format('HH')) + 1;
                    }
                    if (isOneDay && startH > endH) {
                        const temp = endH;
                        endH = startH;
                        startH = temp;
                    }
                    if (isForwardSelection) {
                        for (let h = startH; h >= endH; h -= 1) {
                            thisCell.closest(parentClass).find(`.cell[dat=${date}-${h}]`).addClass('in-range');
                        }
                    } else {
                        for (let h = startH; h < endH; h += 1) {
                            thisCell.closest(parentClass).find(`.cell[dat=${date}-${h}]`).addClass('in-range');
                        }
                    }
                } else {
                    thisCell.closest(parentClass).find(`td[data=${date}]`).addClass('in-range');
                }
                startH = isForwardSelection ? HOURS : 0;
            });
        }
    };

    /**
     * @description Handle Show hover messenger of calendar
     * @param e
     */
    handleShowHoverMessage = (e) => {
        const thisCell = $(e.currentTarget);
        const dataFinderHover = $('.data-finder-hover');
        const { top, left } = thisCell.offset();
        let thisWidth = thisCell.width();
        const hoverMsg = thisCell.attr('hover-data');
        const isWeek = thisCell.attr('dat');
        if (isWeek) {
            dataFinderHover.addClass('week');
            thisWidth += 11;
        } else {
            dataFinderHover.removeClass('week');
            thisWidth += 22;
        }
        dataFinderHover.html(hoverMsg.replaceAll('BR', '<br>'));
        dataFinderHover.css({
            top: `${top}px`,
            left: `${left + thisWidth}px`,
            display: 'block',
        });

        // Correct hint position for Backup&Restore Modal
        if ($('#backupAndRestoreModal').length) {
            const isYear = thisCell.attr('id').includes('year');
            const hintLeft = isYear
                ? left + thisCell.closest('tr').width() / 13
                : left + thisCell.closest('tr').width() / 7;
            dataFinderHover.offset({
                top: top,
                left: hintLeft,
            });
        }
    };

    /**
     * @description Set From, To value into the input of Calendar
     * @param from
     * @param to
     * @param type
     */
    setValueFromToInput = (from = null, to = null, type, checkDataCount = false) => {
        if (from !== null) {
            $(this.dataFinderEls.inputFromId).val(from);
            $(this.dataFinderEls.inputFromId).attr(type, from);
        }
        if (to !== null) {
            $(this.dataFinderEls.inputToId).val(to);
            $(this.dataFinderEls.inputToId).attr(type, to);
        }

        const date = from && to ? `${from} ${DATETIME_PICKER_SEPARATOR} ${to}` : '';
        const dateRange = this.showFromOnly ? from : date;

        if (!this.isHandlingDataFinderInputChange) {
            $(this.dataFinderEls.inputFromTo).val(dateRange);
            $(this.dataFinderEls.inputFromTo).attr('old-value', dateRange);
        }
        this.syncDataFinderInputRangeToCalendarTypes(dateRange);
        if (checkDataCount) {
            this.checkDataCountOfRange(from, to, type).then();
        }
    };

    clearCalendarSelection = () => {
        Object.values(calenderTypes).forEach((type) => {
            this.syncSelectionToCalendar('', '', type);
            $(this.dataFinderEls.inputFromId).removeAttr(type);
            $(this.dataFinderEls.inputToId).removeAttr(type);
        });
    };

    syncSelectionToCalendar = (from, to, type) => {
        const parentClass = `.${type}-calendar${this.suffix}`;
        const cells = $(`${parentClass} .cell`);
        cells.removeClass('active in-range');

        if (!from) {
            this.startDate = '';
            this.endDate = '';
            return;
        }

        // Programmatic sync should repaint the calendar, not seed the click state machine.
        this.startDate = '';
        this.endDate = '';

        const normalizedTo = this.showFromOnly ? from : to;
        if (type === calenderTypes.week) {
            const inputValue = $(this.dataFinderEls.inputFromTo).val();
            let inputFromMoment = null;
            let inputToMoment = null;
            if (inputValue) {
                const [inputFrom, inputTo] = inputValue
                    .split(DATETIME_PICKER_SEPARATOR)
                    .map((val) => (val ? val.trim() : val));
                inputFromMoment = inputFrom ? this.parseDataFinderInputDateTime(inputFrom) : null;
                inputToMoment = this.showFromOnly
                    ? inputFromMoment
                    : inputTo
                      ? this.parseDataFinderInputDateTime(inputTo)
                      : null;
            }

            const fromMoment =
                inputFromMoment && inputFromMoment.isValid()
                    ? inputFromMoment.clone().startOf('hour')
                    : moment(from, DATE_TIME_FMT).startOf('hour');
            let toMoment =
                inputToMoment && inputToMoment.isValid() ? inputToMoment.clone() : moment(normalizedTo, DATE_TIME_FMT);
            toMoment = this.roundHour(toMoment.format(DATE_TIME_FMT), 'up');
            toMoment = moment(toMoment, DATE_TIME_FMT);
            if (!fromMoment.isValid() || !toMoment.isValid()) {
                return;
            }

            if (!toMoment.isAfter(fromMoment)) {
                toMoment = fromMoment.clone().add(1, 'hours');
            }

            const fromValue = fromMoment.format(DATE_TIME_FMT);
            const toValue = toMoment.format(DATE_TIME_FMT);
            const lastSelectedValue = toMoment.clone().subtract(1, 'hours').format(DATE_TIME_FMT);

            // The calendar renders at most two weeks; iterate those cells instead of every hour in a potentially huge range.
            cells.each((_, el) => {
                const cellValue = el.getAttribute('data');
                if (cellValue >= fromValue && cellValue < toValue) {
                    el.classList.add('in-range');
                }
                if (cellValue === fromValue || cellValue === lastSelectedValue) {
                    el.classList.add('active');
                }
            });
            return;
        }

        const fmt = type === calenderTypes.year ? YEAR_MONTH_FMT : DATE_FMT;
        const fromMoment = moment(from, fmt);
        const toMoment = moment(normalizedTo, fmt);
        if (!fromMoment.isValid() || !toMoment.isValid()) {
            return;
        }

        cells.each((_, el) => {
            const cell = $(el);
            const cellDate = moment(cell.attr('data'), fmt);
            if (cellDate.isBetween(fromMoment, toMoment, undefined, '[]')) {
                cell.addClass('in-range');
            }
            if (cellDate.isSame(fromMoment) || cellDate.isSame(toMoment)) {
                cell.addClass('active');
            }
        });
    };

    /**
     * @description Get From, To datetime value from input of calendar
     * @param type
     * @return {[string, string]}
     */

    getFromToInputByType = (type) => {
        const fromInput = $(this.dataFinderEls.inputFromId).attr(type);
        const toInput = $(this.dataFinderEls.inputToId).attr(type);

        return [fromInput, toInput];
    };

    setFromToInputAttrByType = (from, to, type) => {
        $(this.dataFinderEls.inputFromId).attr(type, from);
        $(this.dataFinderEls.inputToId).attr(type, to);
    };

    parseDataFinderInputDateTime = (value) => {
        const parsed = moment(value, [DATE_TIME_FMT, DATE_FMT, YEAR_MONTH_FMT], true);
        return parsed.isValid() ? parsed : moment(value);
    };

    getInclusiveToMomentForDateBasedCalendars = (rangeValue, toMoment) => {
        const { endTime } = splitDateTimeRange(rangeValue);
        const hasExplicitEndTime = Boolean(endTime);
        const isStartOfDay = toMoment.clone().startOf('day').isSame(toMoment);

        // Week selection keeps exclusive "to" (next day 00:00), while month/year need inclusive end date.
        if (hasExplicitEndTime && isStartOfDay) {
            return toMoment.clone().subtract(1, 'days');
        }

        return toMoment.clone();
    };

    syncDataFinderInputRangeToCalendarTypes = (rangeValue = $(this.dataFinderEls.inputFromTo).val()) => {
        if (!rangeValue) {
            return false;
        }

        let [from, to] = rangeValue.split(DATETIME_PICKER_SEPARATOR).map((val) => (val ? val.trim() : val));
        if (!from || (!this.showFromOnly && !to)) {
            return false;
        }

        const fromMoment = this.parseDataFinderInputDateTime(from);
        const toMoment = this.showFromOnly ? fromMoment.clone() : this.parseDataFinderInputDateTime(to);
        if (!fromMoment.isValid() || !toMoment.isValid() || (!this.showFromOnly && !fromMoment.isBefore(toMoment))) {
            return false;
        }

        const weekFrom = this.roundHour(fromMoment.format(DATE_TIME_FMT), 'down');
        const weekTo = this.roundHour(toMoment.format(DATE_TIME_FMT), 'up');
        const monthYearToMoment = this.getInclusiveToMomentForDateBasedCalendars(rangeValue, toMoment);
        this.setFromToInputAttrByType(weekFrom, weekTo, calenderTypes.week);
        this.setFromToInputAttrByType(
            fromMoment.format(DATE_FMT),
            monthYearToMoment.format(DATE_FMT),
            calenderTypes.month,
        );
        this.setFromToInputAttrByType(
            fromMoment.format(YEAR_MONTH_FMT),
            monthYearToMoment.format(YEAR_MONTH_FMT),
            calenderTypes.year,
        );

        return true;
    };

    /**
     * @description Close main data finder modal div
     */
    closeCalenderModal = () => {
        $(this.dataFinderEls.inputFromId).removeAttr('year', 'month', 'week');
        $(this.dataFinderEls.inputFromId).val('');
        $(this.dataFinderEls.inputToId).removeAttr('year', 'month', 'week');
        $(this.dataFinderEls.inputToId).val('');
        $(this.dataFinderEls.inputFromTo).val('');
        this.startDate = '';
        this.endDate = '';
        $(this.dataFinderEls.dataFinderCard).hide();
        this.isDataFinderShowing = false;
    };

    roundHour = (dateTime, option = 'down') => {
        const rounded = moment(dateTime, DATE_TIME_FMT).startOf('hour');
        if (option === 'up' && moment(dateTime, DATE_TIME_FMT).isAfter(rounded)) {
            rounded.add(1, 'hours');
        }
        return rounded.format(DATE_TIME_FMT);
    };

    buildDateTimeMoment = (dateValue, timeValue = '00:00') => {
        const dateMoment = moment(dateValue, DATE_FMT, true);
        if (!dateMoment.isValid()) {
            const dateTimeMoment = moment(dateValue, DATE_TIME_FMT, true);
            return dateTimeMoment.isValid() ? dateTimeMoment : null;
        }

        const [hourRaw = '00', minuteRaw = '00'] = String(timeValue || '00:00').split(':');
        const hour = Number(hourRaw);
        const minute = Number(minuteRaw);
        if (
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
        ) {
            return dateMoment.clone().startOf('day');
        }

        return dateMoment.clone().set({ hour, minute, second: 0, millisecond: 0 });
    };

    /**
     * Round selected time value based on calendar type and format.
     *
     * @param {string} inputVal - Original time range string (e.g., "2023-01-01 - 2023-02-01").
     * @param {string} calendarType - Current calendar type (month, year, week).
     * @param {boolean} [isFullFormat=false] - Output format flag:
     *      - true: Full format (YYYY-MM-DD HH:mm).
     *      - false: Short format based on calendarType (YYYY-MM-DD or YYYY-MM).
     * @returns {string} Processed time string.
     */
    roundSelectedValue = (inputVal, calendarType, isFullFormat = false) => {
        // If isFullFormat = true -> Always use a full format regard less calendarType
        const d = splitDateTimeRange(inputVal);
        const startMoment = isFullFormat ? this.buildDateTimeMoment(d.startDate, d.startTime) : null;
        let startDate = isFullFormat ? (startMoment ? startMoment.format(DATE_TIME_FMT) : d.startDate) : d.startDate;

        if (calendarType === calenderTypes.week) {
            startDate = this.roundHour(startDate, 'down');
        }

        if (!d?.endDate) {
            return `${startDate}`;
        }

        if (calendarType === calenderTypes.week) {
            const endMoment = this.buildDateTimeMoment(d.endDate, d.endTime);
            const endDate = this.roundHour(
                endMoment ? endMoment.format(DATE_TIME_FMT) : `${d.endDate} ${d.endTime || '00:00'}`,
                'up',
            );
            return `${startDate} ${DATETIME_PICKER_SEPARATOR} ${endDate}`;
        }

        if (calendarType === calenderTypes.month) {
            // add default start time -> 00:00
            // add default end time -> next day of 00:00
            const formatDate = isFullFormat ? DATE_TIME_FMT : DATE_FMT;
            const nextEndDate = moment(d.endDate).add(1, 'days').format(formatDate);
            inputVal = `${startDate} ${DATETIME_PICKER_SEPARATOR} ${nextEndDate}`;
        }
        if (calendarType === calenderTypes.year) {
            // add default start date time = first day of this month 00:00
            // add default end date time = end day of this month 24:00
            const endDate = moment(`${d.endDate}-01`).endOf('month').format(DATE_FMT);
            const formatDate = isFullFormat ? DATE_TIME_FMT : YEAR_MONTH_FMT;
            const nextEndDate = moment(endDate).add(1, 'days').format(formatDate);
            inputVal = `${startDate} ${DATETIME_PICKER_SEPARATOR} ${nextEndDate}`;
        }

        return inputVal;
    };
}
