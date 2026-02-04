/**
 * @file The class YearCalendar of DataFinder
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */
class YearCalendar extends DataFinderBase {
    constructor(suffix = '', parentDiv = '', fromMainShowGraphPage = false, showFromOnly = false) {
        super(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
    }
    generateSingleYearCalendar = (year = 2023, month) => {
        const locale = docCookies.getItem(keyPort('locale')) || 'en';
        const showYear = locale === 'ja' ? `${year} 年` : year;
        $(this.dataFinderEls.singleMonthCalendarShowYear).text(showYear);
        $(this.dataFinderEls.singleMonthCalendarBody).empty();
        let html = '';
        for (let i = 0; i <= 11; i++) {
            const utcMonth = i + 1;
            const showMonth = locale === 'ja' ? `${utcMonth}月` : enMonth[i];
            // add suffix
            html += `<div class="single-month-calendar-item single-month-calendar-item${this.suffix} single-calendar-item${utcMonth === month ? ' in-week last-item first-item' : ''}" month="${utcMonth}" year="${year}">${showMonth}</div>`;
        }

        $(this.dataFinderEls.singleMonthCalendarBody).append(html);

        this.initGoToNextPrevYear(year);
    };

    initGoToNextPrevYear = (year) => {
        $(this.dataFinderEls.singleMonthCalendarGoToNextYear).off('click');
        $(this.dataFinderEls.singleMonthCalendarGoToNextYear).on('click', () => {
            const nextYear = year + 1;
            this.generateSingleYearCalendar(nextYear);
        });

        $(this.dataFinderEls.singleMonthCalendarGoToPrevYear).off('click');
        $(this.dataFinderEls.singleMonthCalendarGoToPrevYear).on('click', () => {
            const prevYear = year - 1;
            this.generateSingleYearCalendar(prevYear);
        });

        $('.single-month-calendar-item' + this.suffix).off('click');
        $('.single-month-calendar-item' + this.suffix).on('click', (e) => {
            const _this = $(e.currentTarget);
            const month = Number(_this.attr('month'));
            const year = Number(_this.attr('year'));

            const currentMonthDay = `${year}-${DataFinderService.addZeroToNumber(month)}-01 00:00`;
            const prevMonth = moment(currentMonthDay).subtract(1, 'months');
            const nextMonth = moment(currentMonthDay).add(1, 'months').format(DATE_TIME_FMT);

            this.generateMonthCalender(prevMonth.year(), prevMonth.month() + 1, true, false);
            this.generateMonthCalender(year, month, false, false);

            // set input
            this.setValueFromToInput(currentMonthDay, nextMonth, calenderTypes.month);
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateMonthCalender(prevMonth.year(), prevMonth.month() + 1, true, false),
                true,
            );
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateMonthCalender(year, month, false, false),
                false,
            );
        });

        $(this.dataFinderEls.singleMonthCalendarThisWeek).off('click');
        $(this.dataFinderEls.singleMonthCalendarThisWeek).on('click', (e) => {
            const currentDate = moment();
            const startOfThisWeek = currentDate.startOf('isoWeek').format(DATE_TIME_FMT);
            const lastWeek = moment(startOfThisWeek).subtract('7', 'days').format(DATE_TIME_FMT);
            const endOfThisWeek = currentDate.endOf('isoWeek').add(1, 'days').format('YYYY-MM-DD 00:00');
            this.setValueFromToInput(startOfThisWeek, endOfThisWeek, calenderTypes.month);
            this.handleGoToCalender(calenderTypes.week);
            this.generateWeekCalender(startOfThisWeek, false);
            this.generateWeekCalender(lastWeek, true);
            this.setValueFromToInput(startOfThisWeek, endOfThisWeek, calenderTypes.week);
            this.handleSetValueToDateRangePicker(null, false);
            this.hideSingleCalendar();
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(startOfThisWeek, false),
                false,
            );
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(lastWeek, true),
                true,
            );
        });
    };

    generateYearCalendar = (startYear) => {
        DataFinderService.addCacheFunctionForBackupRestoreModal(() => this.generateYearCalendar(startYear));
        const [tableEl, goToButtons] = this.createYearTableView();
        let nextYear = startYear;
        let tr = '';
        for (let year = 1; year <= YEARS; year += 1) {
            const dataOfYear = [...Array(12)]
                .map((_, i) => {
                    const month = DataFinderService.addZeroToNumber(i + 1);
                    const hoverMsg = `Month: ${nextYear}-${month}BRCount: 0`;
                    return `<td id="year${this.suffix}-${nextYear}-${month}" data="${nextYear}-${month}" hover-data="${hoverMsg}" date="${nextYear}-${month}" class="cell"></td>`;
                })
                .join('');
            tr += `
            <tr>
                <td class="year">${nextYear}</td>
                ${dataOfYear}
                ${year === 1 ? goToButtons : ''}
            </tr>
        `;

            nextYear += 1;
        }

        tableEl.find('tbody').append(tr);

        this.initYearSelectors(tableEl, startYear);
        this.fillColorYear(startYear);
        this.rangeCell(calenderTypes.year);
    };

    createYearTableView = () => {
        const id = 'yearTable' + this.suffix;
        $(`#${id}`).remove();

        const th = [...Array(12)]
            .map((month, index) => {
                return `<th>${index + 1}</th>`;
            })
            .join('');

        const table = `
        <table id="${id}">
            <thead>
                <tr>
                    <th class="year"></th>
                    ${th}
                    <th class="no-border"></th>
                </tr>
            </thead>
            <tbody>
                
            </tbody>
        </table>
    `;

        const yearActionEl = `
        <td rowSpan="${YEARS}" class="no-border year-calendar-go-to">
            <span class="arrow-double-up previous-years"><i class="fa fa-angle-double-up arrow"></i></span>
            <span class="arrow-up previous-year"><i class="fa fa-angle-up arrow"></i></span>
            <span class="arrow-down next-year"><i class="fa fa-angle-down arrow"></i></span>
            <span class="arrow-double-down next-years"><i class="fa fa-angle-double-down arrow"></i></span>
        </td>
    `;

        $('#data-finder-year' + this.suffix).append(table);

        return [$(`#${id}`), yearActionEl];
    };

    initYearSelectors = (tableEl, startYear) => {
        tableEl.find('.previous-year').on('click', () => {
            const previousStartYear = startYear - 1;
            this.generateYearCalendar(previousStartYear);
        });

        tableEl.find('.next-year').on('click', () => {
            const nextStartYear = startYear + 1;
            this.generateYearCalendar(nextStartYear);
        });

        tableEl.find('.previous-years').on('click', () => {
            const previousStartYear = startYear - 5;
            this.generateYearCalendar(previousStartYear);
        });

        tableEl.find('.next-years').on('click', () => {
            const nextStartYear = startYear + 5;
            this.generateYearCalendar(nextStartYear);
        });
    };

    fillColorYear = async (startYear) => {
        const toYear = startYear + YEARS - 1;
        const { data, max_val } = await DataFinderService.getDataCountByType(
            this.processId,
            startYear.toString(),
            toYear.toString(),
            calenderTypes.year,
        );
        if (!data) return;
        let nextYear = startYear;
        for (let year = 1; year <= YEARS; year += 1) {
            [...Array(12)].map((_, i) => {
                const monthCount = data[nextYear] ? data[nextYear].count[i] : 0;
                const color = DataFinderService.getColor(max_val, monthCount);
                const month = DataFinderService.addZeroToNumber(i + 1);
                const id = `year${this.suffix}-${nextYear}-${month}`;
                $(`#${id}`).css({ backgroundColor: color });
                const hoverMsg = `Month: ${nextYear}-${month}BRCount: ${applySignificantDigit(monthCount)}`;
                $(`#${id}`).attr('hover-data', hoverMsg);
            });
            nextYear += 1;
        }
    };
}
