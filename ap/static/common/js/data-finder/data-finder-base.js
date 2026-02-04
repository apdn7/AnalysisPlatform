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
            backBtn: `#dataFinderBackBtn${this.suffix}`,
            allBtn: `#dataFinderSetAll${this.suffix}`,
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
        thisCell.closest(parentClass).find('.cell').removeClass('in-range');
        thisCell.closest(parentClass).find('.cell').removeClass('active');
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
            thisCell.closest(parentClass).find('.cell').removeClass('in-range');
            thisCell.closest(parentClass).find('.cell').removeClass('active');
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
            thisCell.closest(parentClass).find('.cell').removeClass('in-range');
            thisCell.closest(parentClass).find('.cell').removeClass('active');
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

        $(this.dataFinderEls.inputFromTo).val(dateRange);
        $(this.dataFinderEls.inputFromTo).attr('old-value', dateRange);
        if (checkDataCount) {
            this.checkDataCountOfRange(from, to, type).then();
        }
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
        const startDate = isFullFormat ? moment(d.startDate).format(DATE_TIME_FMT) : d.startDate;

        if (!d?.endDate) {
            return `${startDate}`;
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
