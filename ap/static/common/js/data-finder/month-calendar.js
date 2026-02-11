/**
 * @file The class MonthCalendar of DataFinder
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */
class MonthCalender extends DataFinderBase {
    monthFrom = null;
    monthTo = null;
    constructor(suffix = '', parentDiv = '', fromMainShowGraphPage = false, showFromOnly = false) {
        super(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
    }
    setMonthFromTo = (from, to) => {
        if (from) {
            this.monthFrom = from;
        }
        if (to) {
            this.monthTo = to;
        }
    };
    generateMonthCalender = (year, month, isFrom = true, useFromInput = false) => {
        if (isFrom) {
            this.setMonthFromTo(`${year}-${month}`, null);
        } else {
            this.setMonthFromTo(null, `${year}-${month}`);
        }
        const tableEl = this.createMonthTableView(year, month, isFrom);

        const days = this.getDaysOfMonth(year, month);

        let dayIndex = 0;
        const tbody = tableEl.find('tbody');
        for (let row = 1; row <= WEEKS; row += 1) {
            let tds = days[dayIndex] ? `<td class="week">${days[dayIndex].weekNo}</td>` : '';
            for (let col = 1; col <= DAYS; col += 1) {
                const currDate = days[dayIndex];
                const hoverMsg = `Date: ${currDate.date}BRCount: 0`;
                tds += currDate
                    ? `<td id="month${this.suffix}-${isFrom ? 'from' : 'to'}-${currDate.date}" hover-data="${hoverMsg}" data="${currDate.date}" date="${currDate.date}" class="${!currDate.isCurrentMonth ? 'inactive' : ''} cell">${currDate.dayOfMonth}</td>`
                    : '';
                dayIndex += 1;
            }

            const tr = `<tr>${tds}</tr>`;
            tbody.append(tr);
        }

        this.initMonthSelectors(tableEl, year, month, isFrom);

        const firstDate = days[0].date;
        const lastDate = days[days.length - 1].date;

        this.fillColorMonthCalender(firstDate, lastDate, isFrom);
        this.rangeCell(calenderTypes.month);
    };
    createMonthTableView = (year, month, from = true) => {
        // remove old table

        const id = from ? 'monthTableFrom' + this.suffix : 'monthTableTo' + this.suffix;
        $(`#${id}`).remove();
        const weekdaysEls = weekDays
            .map((week, index) => {
                const cl = [5, 6].includes(index) ? 'inactive' : '';
                return `<th style="height: 36.5px" class="${cl}" weekday="${index}">${week}</th>`;
            })
            .join('');
        const table = `
        <table id="${id}">
             <thead>
                    <tr>
                        <th></th>
                        <th colspan="7">
                            <div class="calendar-go-to ${from ? 'from' : 'to'}-calendar-go-to${this.suffix}">
                                <button type="button" class="previous-month"><i class="fa fa-angle-left arrow"></i></button>
                                <span class="showSingleCalendar" year="${year}" month="${month}" id="showSingleYearCalendar${this.suffix}">${year} - ${DataFinderService.addZeroToNumber(month)}</span>
                                <button type="button" class="next-month"><i class="fa fa-angle-right arrow"></i></button>
                            </div>
                        </th>
                    </tr>
                    <tr>
                        <th style="height: 36.5px" class="week"></th>
                        ${weekdaysEls}
                    </tr>
             </thead>
             <tbody>
                
            </tbody>
        </table>
    `;

        if (from) {
            $(this.dataFinderEls.dataFinderMonth).prepend(table);
        } else {
            $(this.dataFinderEls.dataFinderMonth).append(table);
        }

        return $(`#${id}`);
    };
    initMonthSelectors = (tableEl, year, month, isFrom) => {
        this.disableMonthArrowButton();
        tableEl.find('.previous-month').on('click', (e) => {
            const preMonth = moment(`${year}-${month}-01`).subtract(1, 'months');
            this.generateMonthCalender(preMonth.year(), preMonth.month() + 1, isFrom);

            this.disableMonthArrowButton();
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateMonthCalender(preMonth.year(), preMonth.month() + 1, isFrom),
                isFrom,
            );
        });

        tableEl.find('.next-month').on('click', (e) => {
            const nextMonth = moment(`${year}-${month}-01`).add(1, 'months');
            this.generateMonthCalender(nextMonth.year(), nextMonth.month() + 1, isFrom);

            this.disableMonthArrowButton();
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateMonthCalender(nextMonth.year(), nextMonth.month() + 1, isFrom),
                isFrom,
            );
        });

        tableEl.find(this.dataFinderEls.showSingleYearCalendar).on('click', (e) => {
            const _this = $(e.currentTarget);
            const year = Number(_this.attr('year'));
            const month = Number(_this.attr('month'));
            this.generateSingleYearCalendar(year, month);

            // show with this position
            const { clientX, clientY } = e.originalEvent;
            $(this.dataFinderEls.singleMonthCalendar).css({
                display: 'block',
                top: `${clientY + 25}px`,
                left: `${clientX - 45}px`,
                zIndex: 90,
            });
        });
    };
    disableMonthArrowButton = () => {
        if (moment(this.monthFrom).isSame(moment(this.monthTo).subtract(1, 'months').format(DATE_FMT), 'month')) {
            $(`.from-calendar-go-to${this.suffix} .next-month`).attr('disabled', true);
            $(`.to-calendar-go-to${this.suffix} .previous-month`).attr('disabled', true);
        } else {
            $(`.from-calendar-go-to${this.suffix} .next-month`).attr('disabled', false);
            $(`.to-calendar-go-to${this.suffix} .previous-month`).attr('disabled', false);
        }
    };
    generateSingleMonthCalendar = (year = 2023, month = 1, startDate, endDate) => {
        const days = this.getDaysOfMonth(year, month);
        const locale = docCookies.getItem(keyPort('locale')) || 'en';
        const showYearMonth = locale === 'ja' ? `${year}年${month}月` : `${enFullMonth[month - 1]} ${year}`;
        $(this.dataFinderEls.singleDateCalendarShowYearMonth).text(showYearMonth);
        $(this.dataFinderEls.singleDateCalendarBody).empty();

        const showDayList = locale === 'ja' ? jaWeekDays : weekDays;
        let daysHtml = showDayList
            .map(
                (day) =>
                    `<div class="single-date-calendar-item single-date-calendar-item${this.suffix} single-calendar-item date-title">${day}</div>`,
            )
            .join('');

        for (const day of days) {
            let isInThisSelectedWeek = false;
            let firstItem = false;
            let lastItem = false;
            if (startDate && endDate) {
                if (
                    (moment(day.date).isAfter(startDate) && moment(day.date).isBefore(endDate)) ||
                    day.date === startDate ||
                    day.date === endDate
                ) {
                    isInThisSelectedWeek = true;
                }

                if (day.date === startDate) {
                    firstItem = true;
                }
                if (day.date === endDate) {
                    lastItem = true;
                }
            }
            daysHtml += `<div class="single-date-calendar-item single-date-calendar-item${this.suffix} single-calendar-item ${!day.isCurrentMonth ? 'inactive' : ''}${isInThisSelectedWeek ? ' in-week' : ''}${firstItem ? ' first-item' : ''}${lastItem ? ' last-item' : ''}" data="${day.date}">${day.dayOfMonth}</div>`;
        }
        $(this.dataFinderEls.singleDateCalendarBody).append(daysHtml);
        this.initGoToNextPrevMonth(year, month);
    };
    initGoToNextPrevMonth = (year, month) => {
        $(this.dataFinderEls.singleDateCalendarGoToNextMonth).off('click');
        $(this.dataFinderEls.singleDateCalendarGoToNextMonth).on('click', () => {
            const nextMonth = moment(`${year}-${month}-01`).add(1, 'months');
            this.generateSingleMonthCalendar(nextMonth.year(), nextMonth.month() + 1);
        });

        $(this.dataFinderEls.singleDateCalendarGoToPrevMonth).off('click');
        $(this.dataFinderEls.singleDateCalendarGoToPrevMonth).on('click', () => {
            const nextMonth = moment(`${year}-${month}-01`).subtract(1, 'months');
            this.generateSingleMonthCalendar(nextMonth.year(), nextMonth.month() + 1);
        });

        $('.single-date-calendar-item' + this.suffix).off('click');
        $('.single-date-calendar-item' + this.suffix).on('click', (e) => {
            const _this = $(e.currentTarget);
            const date = _this.attr('data');

            const startWeekDate = moment(date).startOf('week').format(DATE_FMT);
            const startOldWeekDate = moment(startWeekDate).subtract(1, 'days').startOf('week').format(DATE_FMT);

            this.generateWeekCalender(startOldWeekDate, true);
            this.generateWeekCalender(startWeekDate, false);

            const from = moment(date).format('YYYY-MM-DD 00:00');
            const to = moment(date).add(8, 'days').format('YYYY-MM-DD 00:00');

            // set input
            this.setValueFromToInput(from, to, calenderTypes.week);
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(startOldWeekDate, true),
                true,
            );
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(startWeekDate, false),
                false,
            );
        });

        $(this.dataFinderEls.singleDateCalendarThisDate).off('click');
        $(this.dataFinderEls.singleDateCalendarThisDate).on('click', (e) => {
            // * Weekly calendar has "今日(En: Today)" button. If user push the button, the app shows daily calendar and input today's "From to" on input box.
            const from = moment().format('YYYY-MM-DD 00:00');
            const to = moment().add(1, 'days').format('YYYY-MM-DD 00:00');

            this.setValueFromToInput(from, to, calenderTypes.week);
            this.setValueFromToInput(from, to, calenderTypes.month);
            this.handleSetValueToDateRangePicker(`${from}${DATETIME_PICKER_SEPARATOR}${to}`, false);
            this.handleBackToCalender('month');
            this.hideSingleCalendar();
        });
    };
    fillColorMonthCalender = async (from, to, isFrom) => {
        const { data, max_val } = await DataFinderService.getDataCountByType(
            this.processId,
            from,
            to,
            calenderTypes.month,
        );
        if (!data) return;
        const { count } = data;
        let nextDate = moment(from);
        const days = Math.abs(nextDate.diff(to, 'days')) + 1;
        [...Array(days)].forEach((_, i) => {
            const c = count[i];
            const dateStr = DataFinderService.getDateObject(nextDate).date;
            const id = isFrom ? `month${this.suffix}-from-${dateStr}` : `month${this.suffix}-to-${dateStr}`;
            const color = DataFinderService.getColor(max_val, c);
            $(`#${id}`).css({
                backgroundColor: color,
            });
            const hoverMsg = `Date: ${dateStr}BRCount: ${applySignificantDigit(c)}`;
            $(`#${id}`).attr('hover-data', hoverMsg);

            nextDate = nextDate.add(1, 'days');
        });
    };
    createDaysForCurrentMonth = (year, month) => {
        return [...Array(this.getNumberOfDaysInMonth(year, month))].map((day, index) => {
            const date = moment(`${year}-${month}-${index + 1}`);
            return DataFinderService.getDateObject(date, true);
        });
    };

    createDaysForPreviousMonth = (year, month, firstDayOfMonth) => {
        const firstDayOfTheMonthWeekday = firstDayOfMonth.dayOfWeeks;

        const previousMonth = moment(`${year}-${month}-01`).subtract(1, 'months');

        // Cover first day of the month being sunday (firstDayOfTheMonthWeekday === 0)
        const visibleNumberOfDaysFromPreviousMonth = firstDayOfTheMonthWeekday ? firstDayOfTheMonthWeekday - 1 : 6;

        const previousMonthLastMondayDayOfMonth = moment(firstDayOfMonth.date)
            .subtract(visibleNumberOfDaysFromPreviousMonth, 'days')
            .date();

        return [...Array(visibleNumberOfDaysFromPreviousMonth)].map((day, index) => {
            const date = moment(
                `${previousMonth.year()}-${previousMonth.month() + 1}-${previousMonthLastMondayDayOfMonth + index}`,
            );
            return DataFinderService.getDateObject(date, false);
        });
    };

    createDaysForNextMonth = (year, month, remainingDays) => {
        const nextMonth = moment(`${year}-${month}-01`).add(1, 'months');
        return [...Array(remainingDays)].map((day, index) => {
            const date = moment(`${nextMonth.year()}-${nextMonth.month() + 1}-${index + 1}`);
            return DataFinderService.getDateObject(date, false);
        });
    };

    getNumberOfDaysInMonth = (year, month) => {
        return moment(`${year}-${month}`).daysInMonth();
    };

    getDaysOfMonth = (year, month) => {
        const currentMonthDays = this.createDaysForCurrentMonth(year, month);
        const previousMonthDays = this.createDaysForPreviousMonth(year, month, currentMonthDays[0]);
        const remainingDays = 42 - (currentMonthDays.length + previousMonthDays.length);
        const nextMonthDays = this.createDaysForNextMonth(year, month, remainingDays);

        const days = [...previousMonthDays, ...currentMonthDays, ...nextMonthDays];
        return days;
    };
}
