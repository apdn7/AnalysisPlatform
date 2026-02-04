/**
 * @file The class WeekCalendar of DataFinder
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */
class WeekCalender extends DataFinderBase {
    weekToStartDate = null;
    weekFromStartDate = null;
    constructor(suffix = '', parentDiv = '', fromMainShowGraphPage = false, showFromOnly = false) {
        super(suffix, parentDiv, fromMainShowGraphPage, showFromOnly);
    }

    setWeekFromToStartDate = (from, to) => {
        if (from) {
            this.weekFromStartDate = from;
        }
        if (to) {
            this.weekToStartDate = to;
        }
    };

    generateWeekCalender = (startDate, isFrom = true) => {
        if (isFrom) {
            this.setWeekFromToStartDate(startDate, null);
        } else {
            this.setWeekFromToStartDate(null, startDate);
        }
        startDate = moment(startDate).startOf('isoWeek').format(DATE_FMT);
        const startDateMoment = moment(startDate);
        const [tableEl, days, endDate] = this.createWeekTableView(startDateMoment, isFrom);

        let hourCellEls = '';
        for (let row = 0; row < HOURS; row += 1) {
            const hour = `${DataFinderService.addZeroToNumber(row)}:00`;
            for (let col = 0; col < DAYS; col += 1) {
                const currDate = days[col];
                const nextH = row + 1;
                const hoverMsg = `From:&nbsp${currDate.date} ${DataFinderService.addZeroToNumber(row)}:00BRTo:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${currDate.date} ${DataFinderService.addZeroToNumber(nextH)}:00BRCount: 0`;
                hourCellEls += `<div id="week${this.suffix}-${isFrom ? 'from' : 'to'}-${currDate.date}-${row}" hover-data="${hoverMsg}" date="${currDate.date}" hour="${row}" data="${currDate.date} ${hour}" dat="${currDate.date}-${row}"  id="${hour}" class="cell">&nbsp;</div>`;
            }
        }

        tableEl.find('.hour-cells').html(hourCellEls);
        this.initWeekSelectors(tableEl, startDateMoment, isFrom);

        this.fillColorWeekCalender(startDate, endDate, days, isFrom);

        this.rangeCell(calenderTypes.week);
    };

    createWeekTableView = (startDate, from = true) => {
        const id = from ? 'weekTableFrom' + this.suffix : 'weekTableTo' + this.suffix;
        $(`#${id}`).remove();

        const endDate = startDate.clone().add(6, 'days');
        let nextDate = DataFinderService.getDateObject(startDate);
        const days = [];
        let daysEl = '';
        let weekDaysEl = '';
        for (let i = 1; i <= 7; i += 1) {
            days.push(nextDate);
            daysEl += `<th class="p-0">${nextDate.dayOfMonth}</th>`;
            const cl = [0, 6].includes(nextDate.dayOfWeeks) ? 'inactive' : '';
            weekDaysEl += `<th class="${cl} p-0">${weekDays2[nextDate.dayOfWeeks]}</th>`;
            nextDate = DataFinderService.getDateObject(moment(nextDate.date).add(1, 'days'));
        }
        const table = `
        <table id="${id}">
            <thead>
                    <tr>
                        <th></th>
                        <th colspan="7">
                            <div class="calendar-go-to ${from ? 'from' : 'to'}-calendar-go-to${this.suffix}">
                                <button type="button" class="previous-week"><i class="fa fa-angle-left arrow"></i></button>
                                <span class="showSingleCalendar" id="showSingleMonthCalendar${this.suffix}" start-date="${startDate.format(DATE_FMT)}" end-date="${endDate.format(DATE_FMT)}">${startDate.format(DATE_FMT)} ${DATETIME_PICKER_SEPARATOR} ${endDate.format(DATE_FMT)}</span>
                                <button type="button" class="next-week"><i class="fa fa-angle-right arrow"></i></button>
                            </div>
                        </th>
                    </tr>
                    <tr style="font-size: 12px">
                       <th class="hour p-0"></th>
                       ${daysEl}
                    </tr>
                    <tr>
                       <th class="hour p-0"></th>
                       ${weekDaysEl}
                    </tr>
            </thead>
            <tbody>
                <tr>
                   <td class="hour"><span>4:00</span></td>
                   <td class="hour-cells-td" rowspan="6" colspan="7">
                        <div class="hour-cells"></div>
                   </td>
                </tr>
                <tr>
                    <td class="hour"><span>8:00</span></td>
                </tr>
                <tr>
                    <td class="hour"><span>12:00</span></td>
                </tr>
                <tr>
                    <td class="hour"><span>16:00</span></td>
                </tr>
                <tr>
                    <td class="hour"><span>20:00</span></td>
                </tr>
                 <tr>
                    <td class="hour"><span>24:00</span></td>
                </tr>
            </tbody>
        </table>
    `;

        if (from) {
            $('#data-finder-week' + this.suffix).prepend(table);
        } else {
            $('#data-finder-week' + this.suffix).append(table);
        }

        return [$(`#${id}`), days, endDate.format(DATE_FMT)];
    };
    initWeekSelectors = (tableEl, startDate, isFrom) => {
        this.disableWeekArrowButton();
        tableEl.find('.previous-week').on('click', (e) => {
            let previousStartDate = startDate.subtract(7, 'days').format(DATE_FMT);
            if (!isFrom) {
                // check to is greater than from
                const fromEndDate = moment(this.weekFromStartDate).add(6, 'days');
                if (fromEndDate.isAfter(previousStartDate, 'day')) {
                    previousStartDate = fromEndDate.add(1, 'days').format(DATE_FMT);
                }
            }
            this.generateWeekCalender(previousStartDate, isFrom);
            this.disableWeekArrowButton();
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(previousStartDate, isFrom),
                isFrom,
            );
        });

        tableEl.find('.next-week').on('click', (e) => {
            let nextStartDate = startDate.add(7, 'days').format(DATE_FMT);
            if (isFrom) {
                // check from is smaller than to
                const nextEndDate = moment(nextStartDate).add('6', 'days');
                if (moment(nextEndDate).isAfter(this.weekToStartDate, 'day')) {
                    nextStartDate = moment(this.weekToStartDate).subtract(7, 'days').format(DATE_FMT);
                }
            }
            this.generateWeekCalender(nextStartDate, isFrom);
            this.disableWeekArrowButton();
            DataFinderService.addCacheFunctionForBackupRestoreModal(
                () => this.generateWeekCalender(nextStartDate, isFrom),
                isFrom,
            );
        });

        tableEl.find(this.dataFinderEls.showSingleMonthCalendar).on('click', (e) => {
            const _this = $(e.currentTarget);
            const startDate = _this.attr('start-date');
            const endDate = _this.attr('end-date');
            this.generateSingleMonthCalendar(
                Number(startDate.split('-')[0]),
                Number(startDate.split('-')[1]),
                startDate,
                endDate,
            );

            // show with this position
            const { clientX, clientY } = e.originalEvent;
            $(this.dataFinderEls.singleDateCalendar).css({
                display: 'block',
                top: `${clientY + 25}px`,
                left: `${clientX - 45}px`,
                zIndex: 90,
            });
        });
    };

    disableWeekArrowButton = () => {
        const fromEndDate = moment(this.weekFromStartDate).add(6, 'days');

        if (fromEndDate.isSame(moment(this.weekToStartDate).subtract(1, 'days').format(DATE_FMT), 'day')) {
            $(`.from-calendar-go-to${this.suffix} .next-week`).attr('disabled', true);
            $(`.to-calendar-go-to${this.suffix} .previous-week`).attr('disabled', true);
        } else {
            $(`.from-calendar-go-to${this.suffix} .next-week`).attr('disabled', false);
            $(`.to-calendar-go-to${this.suffix} .previous-week`).attr('disabled', false);
        }
    };

    fillColorWeekCalender = async (fromDate, toDate, days, isFrom) => {
        const { data, max_val } = await DataFinderService.getDataCountByType(
            this.processId,
            fromDate,
            toDate,
            calenderTypes.week,
        );
        if (!data) return;
        let nextDate = moment(fromDate);
        const daysNumber = Math.abs(nextDate.diff(toDate, 'days')) + 1;
        [...Array(daysNumber)].forEach((_, i) => {
            const currDate = DataFinderService.getDateObject(nextDate).date;
            for (let h = 0; h < HOURS; h += 1) {
                const count = data[currDate] ? data[currDate].count[h] : 0;
                const color = DataFinderService.getColor(max_val, count);
                const id = isFrom
                    ? `week${this.suffix}-from-${currDate}-${h}`
                    : `week${this.suffix}-to-${currDate}-${h}`;
                $(`#${id}`).css({
                    backgroundColor: color,
                });
                const nextH = h + 1;
                const hoverMsg = `From:&nbsp;${currDate} ${DataFinderService.addZeroToNumber(h)}:00BRTo:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${currDate} ${DataFinderService.addZeroToNumber(nextH)}:00BRCount: ${applySignificantDigit(count)}`;
                $(`#${id}`).attr('hover-data', hoverMsg);
            }
            nextDate = nextDate.add(1, 'days');
        });
    };
}
