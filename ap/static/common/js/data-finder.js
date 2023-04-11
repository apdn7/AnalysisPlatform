/* eslint-disable no-unused-vars,linebreak-style,arrow-body-style */

const calenderTypes = {
    year: 'year',
    month: 'month',
    week: 'week',
};

const WEEKS = 6;
const DAYS = 7;
const HOURS = 24;
const YEARS = 6;
let defaultDateTime = {};
let monthFrom = null;
let monthTo = null;
let weekToStartDate = null;
let weekFromStartDate = null;
const yearSelectedValue = '';
let currentDateRangeEl = null;
let startDate = '';
let endDate = '';
let currentCalendarType = calenderTypes.month;

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekDays2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const colorsData = ['#18324c', '#204465', '#2d5e88', '#3b7aae', '#56b0f4', '#6dc3fd'];
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

let processId = null;

const getColor = (max, count) => {
    const per = Math.round(count / max * 100);
    let newPer = per;
    if (per > 0 && per <= 15) {
        newPer = 1;
    }

    if (per > 15 && per <= 35) {
        newPer = 20;
    }

    if (per > 35 && per <= 50) {
        newPer = 40;
    }

    if (per > 50 && per <= 65) {
        newPer = 60;
    }

    if (per > 65 && per <= 80) {
        newPer = 80;
    }

    if (per > 80 && per <= 100) {
        newPer = 100;
    }

    return colorDic[newPer];
};

const dataFinderEls = {
    inputFromId: '#data-finder-from',
    inputToId: '#data-finder-to',
    inputFromTo: '#data-finder-input',
    dataFinderBtn: '#dataFinderBtn',
    startProc: 'select[name=start_proc]',
};


// Common function block START
const setValueFromToInput = (from = null, to = null, type) => {
    if (from !== null) {
        $(dataFinderEls.inputFromId).val(from);
        $(dataFinderEls.inputFromId).attr(type, from);
    }
    if (to !== null) {
        $(dataFinderEls.inputToId).val(to);
        $(dataFinderEls.inputToId).attr(type, to);
    }

    const date = from && to ? `${from} ${DATETIME_PICKER_SEPARATOR} ${to}` : '';

    $(dataFinderEls.inputFromTo).val(date);
};

const getFromToInputByType = (type) => {
    const fromInput = $(dataFinderEls.inputFromId).attr(type);
    const toInput = $(dataFinderEls.inputToId).attr(type);

    return [fromInput, toInput];
};

const setDefaultValueOfCalender = (type) => {
    defaultDateTime = getDefaultDateTime();
    if (type === calenderTypes.month) {
        const currentSetDateRange = currentDateRangeEl.val();
        const { startDate, startTime, endDate, endTime } = splitDateTimeRange(currentSetDateRange)
        const [fromInput, toInput] = getFromToInputByType(calenderTypes.year);
        let startDateObj = null;
        let endDateObj = null;
        if (startDate && endDate) {
            startDateObj = getDateObject(moment(startDate));
            endDateObj = getDateObject(moment(endDate));
        }
        if (!fromInput || !toInput) {
            // setMonthFromTo(defaultDateTime.firstDayOfMonth, defaultDateTime.date);
            const firstDate = startDateObj ? startDateObj : defaultDateTime;
            const lastDate = endDateObj ? endDateObj : defaultDateTime;
            const fromDate = startDateObj ? firstDate.date : firstDate.firstDayOfMonth;
            setValueFromToInput(fromDate, lastDate.date, type);
            let prevMonth = firstDate;
            // if from and to is same then - 1
            if (moment(`${firstDate.year}-${firstDate.month}`).isSame(`${lastDate.year}-${lastDate.month}`)) {
                prevMonth = getPrevMonthFromCalendar(firstDate.year, firstDate.month);
            }
            generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
            generateMonthCalender(lastDate.year, lastDate.month, false, true);
        } else {
            const from = `${fromInput}-01`;
            const selectedTo = moment(`${toInput}-01`).endOf('month').format(DATE_FMT);
            const to = moment().isBefore(selectedTo) ? moment().format(DATE_FMT) : selectedTo;
            let fromObj = getDateObject(from);
            let toObj = getDateObject(to);
            // monthFrom = monthFrom === monthTo ? monthFrom - 1 : monthFrom;
            // setMonthFromTo(from, to);
            setValueFromToInput(from, to, type);
            // if from and to is same then - 1
            let prevMonth = fromObj;
            if (moment(`${fromObj.year}-${fromObj.month}`).isSame(`${toObj.year}-${toObj.month}`)) {
                prevMonth = getPrevMonthFromCalendar(fromObj.year, fromObj.month);
            }
            generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
            generateMonthCalender(toObj.year, toObj.month, false, true);
        }
    }

    if (type === calenderTypes.week) {
        // set defaul from to input
        const [fromInput, toInput] = getFromToInputByType(calenderTypes.month);
        const defaultFromInput = `${fromInput} 00:00`;
        // next day of 00:00
        const selectedTo = `${moment(toInput).add(1, 'days').format(DATE_FMT)} 00:00`;
        const defaultToInput = moment().isBefore(selectedTo) ? moment().format(DATE_TIME_FMT) : selectedTo;
        let startOfLastWeek = moment(defaultToInput).subtract(6, 'days').format(DATE_FMT);
        const fromEndDate = moment(fromInput).add(6, 'days').format(DATE_FMT);

        if (moment(startOfLastWeek).isBefore(fromEndDate)) {
            startOfLastWeek = moment(fromEndDate).add(1, 'days').format(DATE_FMT);
        }

        setValueFromToInput(defaultFromInput, defaultToInput, type);
        generateWeekCalender(fromInput);
        generateWeekCalender(startOfLastWeek, false);
    }

    if (type === calenderTypes.year) {
        const [fromInput, toInput] = getFromToInputByType(calenderTypes.month);
        if (!fromInput || !toInput) {
            generateYearCalendar(defaultDateTime.year - YEARS + 1);
            setValueFromToInput('', '', type);
        } else {
            const fromObj = getDateObject(fromInput);
            const toObj = getDateObject(toInput);
            generateYearCalendar(Number(toInput.split('-')[0]) - YEARS + 1);
            setValueFromToInput(`${fromObj.year}-${addZeroToNumber(fromObj.month)}`, `${toObj.year}-${addZeroToNumber(toObj.month)}`, type);
        }
    }
};

const switchCalender = (type) => {
    $('#data-finder-card').show();

    $('.calender-box').hide();

    $(`#data-finder-${type}`).show();

    $('.for-data-finder').hide();
    $(`.for-data-finder-${type}`).show();
    currentCalendarType = type;
};

const addZeroToNumber = (number) => {
    return number.toString().length < 2 ? `0${number}` : number;
};

const getDateObject = (date, isCurrentMonth = false) => {
    if (_.isString(date)) {
        date = moment(date);
    }
    return {
        date: date.format(DATE_FMT),
        dayOfMonth: date.date(),
        isCurrentMonth,
        dayOfWeeks: date.day(),
        weekNo: date.week(),
        month: date.month() + 1,
        year: date.year(),
    };
};

const getDefaultDateTime = () => {
    const today = moment();
    return {
        year: today.year(),
        month: today.month() + 1,
        dayOfMonth: today.date(),
        date: today.format(DATE_FMT),
        now: today.format('HH:MM'),
        firstDayOfMonth: `${today.year()}-${today.month() + 1}-01`,
    };
};

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
// Common function block END


// handling function START
const showDataFinderModal = (e) => {
    currentDateRangeEl = $(e).parent().find('[name=DATETIME_RANGE_PICKER]');
    defaultDateTime = getDefaultDateTime();
    switchCalender(calenderTypes.month);
    setDefaultValueOfCalender(calenderTypes.month);
};

const closeCalenderModal = () => {
    $(dataFinderEls.inputFromId).removeAttr('year', 'month', 'week');
    $(dataFinderEls.inputFromId).val('');
    $(dataFinderEls.inputToId).removeAttr('year', 'month', 'week');
    $(dataFinderEls.inputToId).val('');
    $(dataFinderEls.inputFromTo).val('');
    startDate = '';
    endDate = '';
    $('#data-finder-card').hide();
};

const handleGoToCalender = (type) => {
    switchCalender(type);
    setDefaultValueOfCalender(type);
};

const getPrevMonthFromCalendar = (year, month) => {
    let prevMonth = month - 1;
    if (prevMonth) {
        return { year, month: prevMonth }
    }
    return { year: year - 1, month: 12 }
};
const handleBackToCalender = (type) => {
    // get old value and fill input

    switchCalender(type);

    const [fromInput, toInput] = getFromToInputByType(type);
    setValueFromToInput(fromInput, toInput, type);
    if (type === calenderTypes.month) {
        let monthFrom = moment(fromInput).month() + 1;
        const monthTo = moment(toInput).month() + 1;
        // monthFrom = monthTo === monthFrom ? monthFrom - 1 : monthFrom;
        const prevMonth = getPrevMonthFromCalendar(moment(fromInput).year(), monthFrom);
        generateMonthCalender(prevMonth.year, prevMonth.month, true, true);
        generateMonthCalender(moment(toInput).year(), monthTo, false, true);
    }

    if (type === calenderTypes.week) {
        const startOfLastWeek = moment(toInput).subtract(6, 'days').format(DATE_FMT);
        generateWeekCalender(fromInput);
        generateWeekCalender(startOfLastWeek, false);
    }
};

const handleApplyYearInput = (from) => {
    if (from) {
        setValueFromToInput(yearSelectedValue, null, calenderTypes.year);
    } else {
        setValueFromToInput(null, yearSelectedValue, calenderTypes.year);
    }
};

const handleSetValueToDateRangePicker = () => {
    // const [from, to] = getFromToInputByType(calenderTypes.week);
    let inputVal = $(dataFinderEls.inputFromTo).val();
    if (currentCalendarType === calenderTypes.month) {
        // add default start time -> 00:00
        // add default end time -> next day of 00:00
        const d = splitDateTimeRange(inputVal)
        const nextEndDate = moment(d.endDate).add(1, 'days').format(DATE_FMT);
        inputVal = `${d.startDate} 00:00 ${DATETIME_PICKER_SEPARATOR} ${nextEndDate} 00:00`;
    }
    if (currentCalendarType === calenderTypes.year) {
        // add default start date time = first day of this month 00:00
        // add default end date time = end day of this month 24:00
        const d = splitDateTimeRange(inputVal)
        const endDate = moment(`${d.endDate}-01`).endOf('month').format(DATE_FMT);
        const nextEndDate = moment(endDate).add(1, 'days').format(DATE_FMT);
        inputVal = `${d.startDate}-01 00:00 ${DATETIME_PICKER_SEPARATOR} ${nextEndDate} 00:00`
    }
    currentDateRangeEl.val(inputVal).trigger('change');
    closeCalenderModal();
};
// handling function END

// Month calendar function START
const setMonthFromTo = (from, to) => {
    if (from) {
        monthFrom = from;
    }
    if (to) {
        monthTo = to;
    }
};

const createDaysForCurrentMonth = (year, month) => {
    return [...Array(getNumberOfDaysInMonth(year, month))].map((day, index) => {
        const date = moment(`${year}-${month}-${index + 1}`);
        return getDateObject(date, true);
    });
};

const createDaysForPreviousMonth = (year, month, firstDayOfMonth) => {
    const firstDayOfTheMonthWeekday = firstDayOfMonth.dayOfWeeks;

    const previousMonth = moment(`${year}-${month}-01`).subtract(1, 'months');

    // Cover first day of the month being sunday (firstDayOfTheMonthWeekday === 0)
    const visibleNumberOfDaysFromPreviousMonth = firstDayOfTheMonthWeekday ? firstDayOfTheMonthWeekday - 1 : 6;

    const previousMonthLastMondayDayOfMonth = moment(firstDayOfMonth.date).subtract(visibleNumberOfDaysFromPreviousMonth, 'days').date();

    return [...Array(visibleNumberOfDaysFromPreviousMonth)].map((day, index) => {
        const date = moment(`${previousMonth.year()}-${previousMonth.month() + 1}-${previousMonthLastMondayDayOfMonth + index}`);
        return getDateObject(date, false);
    });
};

const createDaysForNextMonth = (year, month, remainingDays) => {
    const nextMonth = moment(`${year}-${month}-01`).add(1, 'months');
    return [...Array(remainingDays)].map((day, index) => {
        const date = moment(`${nextMonth.year()}-${nextMonth.month() + 1}-${index + 1}`);
        return getDateObject(date, false);
    });
};

const getNumberOfDaysInMonth = (year, month) => {
    return moment(`${year}-${month}`).daysInMonth();
};

const createMonthTableView = (year, month, from = true) => {
    // remove old table

    const id = from ? 'monthTableFrom' : 'monthTableTo';
    $(`#${id}`).remove();
    const weekdaysEls = weekDays.map((week, index) => {
        const cl = [5, 6].includes(index) ? 'inactive' : '';
        return `<th style="height: 36.5px" class="${cl}" weekday="${index}">${week}</th>`;
    }).join('');
    const table = `
        <table id="${id}">
             <thead>
                    <tr>
                        <th>${from ? 'From' : 'To'}</th>
                        <th colspan="7">
                            <div class="calendar-go-to ${from ? 'from' : 'to'}-calendar-go-to">
                                <button type="button" class="previous-month"><i class="fa fa-angle-left arrow"></i></button>
                                <span>${year} - ${addZeroToNumber(month)}</span>
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
        $('#data-finder-month').prepend(table);
    } else {
        $('#data-finder-month').append(table);
    }

    return $(`#${id}`);
};

const disableMonthArrowButton = () => {
    if (moment(monthFrom).isSame(moment(monthTo).subtract(1, 'months').format(DATE_FMT), 'month')) {
        $('.from-calendar-go-to .next-month').attr('disabled', true);
        $('.to-calendar-go-to .previous-month').attr('disabled', true);
    } else {
        $('.from-calendar-go-to .next-month').attr('disabled', false);
        $('.to-calendar-go-to .previous-month').attr('disabled', false);
    }
};

const disableWeekArrowButton = () => {
    const fromEndDate = moment(weekFromStartDate).add(6, 'days');

    if (fromEndDate.isSame(moment(weekToStartDate).subtract(1, 'days').format(DATE_FMT), 'day')) {
        $('.from-calendar-go-to .next-week').attr('disabled', true);
        $('.to-calendar-go-to .previous-week').attr('disabled', true);
    } else {
        $('.from-calendar-go-to .next-week').attr('disabled', false);
        $('.to-calendar-go-to .previous-week').attr('disabled', false);
    }
};

const initMonthSelectors = (tableEl, year, month, isFrom) => {
    disableMonthArrowButton();
    tableEl.find('.previous-month').on('click', () => {
        const preMonth = moment(`${year}-${month}-01`).subtract(1, 'months');
        generateMonthCalender(preMonth.year(), preMonth.month() + 1, isFrom);

        disableMonthArrowButton();
    });

    tableEl.find('.next-month').on('click', () => {
        const nextMonth = moment(`${year}-${month}-01`).add(1, 'months');
        generateMonthCalender(nextMonth.year(), nextMonth.month() + 1, isFrom);

        disableMonthArrowButton();
    });
};

const generateMonthCalender = (year, month, isFrom = true, useFromInput = false) => {
    if (isFrom) {
        setMonthFromTo(`${year}-${month}`, null);
    } else {
        setMonthFromTo(null, `${year}-${month}`);
    }
    const tableEl = createMonthTableView(year, month, isFrom);
    const currentMonthDays = createDaysForCurrentMonth(year, month);
    const previousMonthDays = createDaysForPreviousMonth(year, month, currentMonthDays[0]);
    const remainingDays = 42 - (currentMonthDays.length + previousMonthDays.length);
    const nextMonthDays = createDaysForNextMonth(year, month, remainingDays);

    const days = [...previousMonthDays, ...currentMonthDays, ...nextMonthDays];
    let dayIndex = 0;
    const tbody = tableEl.find('tbody');
    for (let row = 1; row <= WEEKS; row += 1) {
        let tds = days[dayIndex] ? `<td class="week">${days[dayIndex].weekNo}</td>` : '';
        for (let col = 1; col <= DAYS; col += 1) {
            const currDate = days[dayIndex];
            const hoverMsg = `Date: ${currDate.date}BRCount: 0`;
            tds += currDate ? `<td id="month-${isFrom ? 'from' : 'to'}-${currDate.date}" hover-data="${hoverMsg}" data="${currDate.date}" date="${currDate.date}" class="${!currDate.isCurrentMonth ? 'inactive' : ''} cell">${currDate.dayOfMonth}</td>` : '';
            dayIndex += 1;
        }

        const tr = `<tr>${tds}</tr>`;
        tbody.append(tr);
    }

    initMonthSelectors(tableEl, year, month, isFrom);

    const firstDate = days[0].date;
    const lastDate = days[days.length - 1].date;

    fillColorMonthCalender(firstDate, lastDate, isFrom);
    rangeCell(calenderTypes.month);
};

const fillColorMonthCalender = async (from, to, isFrom) => {
    const { data, max_val } = await getDataByType(from, to, calenderTypes.month);
    if (!data) return;
    const { count } = data;
    let nextDate = moment(from);
    const days = Math.abs(nextDate.diff(to, 'days')) + 1;
    [...Array(days)].forEach((_, i) => {
        const c = count[i];
        const dateStr = getDateObject(nextDate).date;
        const id = isFrom ? `month-from-${dateStr}` : `month-to-${dateStr}`;
        const color = getColor(max_val, c);
        $(`#${id}`).css({
            backgroundColor: color,
        });
        const hoverMsg = `Date: ${dateStr}BRCount: ${c}`;
        $(`#${id}`).attr('hover-data', hoverMsg);

        nextDate = nextDate.add(1, 'days');
    });
};
// Month calendar function END

// Week calendar function START
const setWeekFromToStartDate = (from, to) => {
    if (from) {
        weekFromStartDate = from;
    }
    if (to) {
        weekToStartDate = to;
    }
};

const createWeekTableView = (startDate, from = true) => {
    const id = from ? 'weekTableFrom' : 'weekTableTo';
    $(`#${id}`).remove();

    const endDate = startDate.clone().add(6, 'days');
    let nextDate = getDateObject(startDate);
    const days = [];
    let daysEl = '';
    let weekDaysEl = '';
    for (let i = 1; i <= 7; i += 1) {
        days.push(nextDate);
        daysEl += `<th class="p-0">${nextDate.dayOfMonth}</th>`;
        const cl = [0, 6].includes(nextDate.dayOfWeeks) ? 'inactive' : '';
        weekDaysEl += `<th class="${cl} p-0">${weekDays2[nextDate.dayOfWeeks]}</th>`;
        nextDate = getDateObject(moment(nextDate.date).add(1, 'days'));
    }
    const table = `
        <table id="${id}">
            <thead>
                    <tr>
                        <th>${from ? 'From' : 'To'}</th>
                        <th colspan="7">
                            <div class="calendar-go-to ${from ? 'from' : 'to'}-calendar-go-to">
                                <button type="button" class="previous-week"><i class="fa fa-angle-left arrow"></i></button>
                                <span>${startDate.format(DATE_FMT)} ${DATETIME_PICKER_SEPARATOR} ${endDate.format(DATE_FMT)}</span>
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
        $('#data-finder-week').prepend(table);
    } else {
        $('#data-finder-week').append(table);
    }

    return [$(`#${id}`), days, endDate.format(DATE_FMT)];
};

const generateWeekCalender = (startDate, isFrom = true) => {
    if (isFrom) {
        setWeekFromToStartDate(startDate, null);
    } else {
        setWeekFromToStartDate(null, startDate);
    }
    const startDateMoment = moment(startDate);
    const [tableEl, days, endDate] = createWeekTableView(startDateMoment, isFrom);

    let hourCellEls = '';
    for (let row = 0; row < HOURS; row += 1) {
        const hour = `${addZeroToNumber(row)}:00`;
        for (let col = 0; col < DAYS; col += 1) {
            const currDate = days[col];
            const nextH = row + 1;
            const hoverMsg = `From:&nbsp${currDate.date} ${addZeroToNumber(row)}:00BRTo:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${currDate.date} ${addZeroToNumber(nextH)}:00BRCount: 0`;
            hourCellEls += `<div id="week-${isFrom ? 'from' : 'to'}-${currDate.date}-${row}" hover-data="${hoverMsg}" date="${currDate.date}" hour="${row}" data="${currDate.date} ${hour}" dat="${currDate.date}-${row}"  id="${hour}" class="cell">&nbsp;</div>`;
        }
    }

    tableEl.find('.hour-cells').html(hourCellEls);
    initWeekSelectors(tableEl, startDateMoment, isFrom);

    fillColorWeekCalender(startDate, endDate, days, isFrom);

    rangeCell(calenderTypes.week);
};

const fillColorWeekCalender = async (fromDate, toDate, days, isFrom) => {
    const { data, max_val } = await getDataByType(fromDate, toDate, calenderTypes.week);
    if (!data) return;
    let nextDate = moment(fromDate);
    const daysNumber = Math.abs(nextDate.diff(toDate, 'days')) + 1;
    [...Array(daysNumber)].forEach((_, i) => {
        const currDate = getDateObject(nextDate).date;
        for (let h = 0; h < HOURS; h += 1) {
            const count = data[currDate] ? data[currDate].count[h] : 0;
            const color = getColor(max_val, count);
            const id = isFrom ? `week-from-${currDate}-${h}` : `week-to-${currDate}-${h}`;
            $(`#${id}`).css({
                backgroundColor: color,
            });
            const nextH = h + 1;
            const hoverMsg = `From:&nbsp;${currDate} ${addZeroToNumber(h)}:00BRTo:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${currDate} ${addZeroToNumber(nextH)}:00BRCount: ${count}`;
            $(`#${id}`).attr('hover-data', hoverMsg);
        }
        nextDate = nextDate.add(1, 'days');
    });
};

const initWeekSelectors = (tableEl, startDate, isFrom) => {
    disableWeekArrowButton();
    tableEl.find('.previous-week').on('click', () => {
        let previousStartDate = startDate.subtract(7, 'days').format(DATE_FMT);
        if (!isFrom) {
            // check to is greater than from
            const fromEndDate = moment(weekFromStartDate).add(6, 'days');
            if (fromEndDate.isAfter(previousStartDate, 'day')) {
                previousStartDate = fromEndDate.add(1, 'days').format(DATE_FMT);
            }
        }
        generateWeekCalender(previousStartDate, isFrom);
        disableWeekArrowButton();
    });

    tableEl.find('.next-week').on('click', () => {
        let nextStartDate = startDate.add(7, 'days').format(DATE_FMT);
        if (isFrom) {
            // check from is smaller than to
            const nextEndDate = moment(nextStartDate).add('6', 'days');
            if (moment(nextEndDate).isAfter(weekToStartDate, 'day')) {
                nextStartDate = moment(weekToStartDate).subtract(7, 'days').format(DATE_FMT);
            }
        }
        generateWeekCalender(nextStartDate, isFrom);
        disableWeekArrowButton();
    });
};
// Weel calendar function END

// Year calendar function START
const createYearTableView = () => {
    const id = 'yearTable';
    $(`#${id}`).remove();

    const th = [...Array(12)].map((month, index) => {
        return `<th>${index + 1}</th>`;
    }).join('');

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

    $('#data-finder-year').append(table);

    return [$(`#${id}`), yearActionEl];
};

const generateYearCalendar = (startYear) => {
    const [tableEl, goToButtons] = createYearTableView();
    let nextYear = startYear;
    let tr = '';
    for (let year = 1; year <= YEARS; year += 1) {
        const dataOfYear = [...Array(12)].map((_, i) => {
            const month = addZeroToNumber(i + 1);
            const hoverMsg = `Month: ${nextYear}-${month}BRCount: 0`;
            return `<td id="year-${nextYear}-${month}" data="${nextYear}-${month}" hover-data="${hoverMsg}" date="${nextYear}-${month}" class="cell"></td>`;
        }).join('');
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

    initYearSelectors(tableEl, startYear);
    fillColorYear(startYear);
    rangeCell(calenderTypes.year);
};

const fillColorYear = async (startYear) => {
    const toYear = startYear + YEARS - 1;
    const { data, max_val } = await getDataByType(startYear.toString(), toYear.toString(), calenderTypes.year);
    if (!data) return;
    let nextYear = startYear;
    for (let year = 1; year <= YEARS; year += 1) {
        [...Array(12)].map((_, i) => {
            const monthCount = data[nextYear] ? data[nextYear].count[i] : 0;
            const color = getColor(max_val, monthCount);
            const month = addZeroToNumber(i + 1);
            const id = `year-${nextYear}-${month}`;
            $(`#${id}`).css({ backgroundColor: color });
            const hoverMsg = `Month: ${nextYear}-${month}BRCount: ${monthCount}`;
            $(`#${id}`).attr('hover-data', hoverMsg);
        });
        nextYear += 1;
    }
};

const initYearSelectors = (tableEl, startYear) => {
    tableEl.find('.previous-year').on('click', () => {
        const previousStartYear = startYear - 1;
        generateYearCalendar(previousStartYear);
    });

    tableEl.find('.next-year').on('click', () => {
        const nextStartYear = startYear + 1;
        generateYearCalendar(nextStartYear);
    });

    tableEl.find('.previous-years').on('click', () => {
        const previousStartYear = startYear - 5;
        generateYearCalendar(previousStartYear);
    });

    tableEl.find('.next-years').on('click', () => {
        const nextStartYear = startYear + 5;
        generateYearCalendar(nextStartYear);
    });
};
// Year calendar function END

// Service
const getDataByType = async (from, to, type = calenderTypes.year, timeout = null) => {
    setProcessID();
    if (!processId) {
        return {};
    }
    const url = '/ap/api/fpp/data_count';

    const data = {
        process_id: processId,
        type,
        from,
        to,
        timezone: detectLocalTimezone(),
    };
    const option = timeout ? { timeout } : {};
    const res = await fetchData(url, JSON.stringify(data), 'POST', option);
    return JSON.parse(res);
};

const showDataFinderButton = (processId) => {
    if (processId) {
        $(dataFinderEls.dataFinderBtn).show();
    } else {
        $(dataFinderEls.dataFinderBtn).hide();
    }
};

const setProcessID = () => {
    processId = getFirstSelectedProc();
    showDataFinderButton(processId);
};

const rangeCell = (type) => {
    $(`.${type}-calendar .cell`).off('dblclick');
    $(`.${type}-calendar .cell`).on('dblclick', (e) => {
        handleDblClickCell(e, type);
    });

    $(`.${type}-calendar .cell`).off('click');
    $(`.${type}-calendar .cell`).on('click', (e) => {
        handleClickCell(e, type);
    });

    $(`.${type}-calendar .cell`).off('mouseover');
    $(`.${type}-calendar .cell`).on('mouseover', (e) => {
        handleMouseoverCell(e, type);
        handleShowHoverMessage(e);
    });

    $(`.${type}-calendar .cell`).off('mouseleave');
    $(`.${type}-calendar .cell`).on('mouseleave', function (e){
        $('.data-finder-hover').css({
            display: 'none',
        });
    });

    $('.data-finder-hover').off('mouseleave');
    $('.data-finder-hover').on('mouseleave', function (e){
        $(e.currentTarget).css({
            display: 'none',
        });
    });
};

const handleShowHoverMessage = (e) => {
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
};

const handleMouseoverCell = (e, type) => {
    const parentClass = `.${type}-calendar`;
    if (startDate && !endDate) {
        const thisCell = $(e.currentTarget);
        const selectedDate = calenderTypes.week ? thisCell.attr('date') : thisCell.attr('data');
        const diffType = type === calenderTypes.year ? 'months' : 'days';
        const format = type === calenderTypes.year ? 'YYYY-MM' : DATE_FMT;

        let nextDate = type === calenderTypes.week ? moment(startDate).format(DATE_FMT) : startDate;
        const diffCount = selectedDate ? moment(selectedDate).diff(nextDate, diffType) : null;
        const isForwardSelection = diffCount < 0;
        const rangeDays = thisCell.closest(parentClass).find('.cell');
        let dates = [...rangeDays].map(el => $(el).attr('date'));
        dates.push(thisCell.attr('date'));
        dates = uniq(dates);
        rangeDays.removeClass('in-range');

        let startH = Number(moment(startDate).format('HH'));
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

const handleClickCell = (e, type) => {
    const parentClass = `.${type}-calendar`;
    const thisCell = $(e.currentTarget);
    const searchData = type === calenderTypes.week ? thisCell.attr('dat') : thisCell.attr('data');
    const allSameCell = type === calenderTypes.week ? thisCell.closest(parentClass).find(`.cell[dat=${searchData}]`) :
            thisCell.closest(parentClass).find(`.cell[data=${searchData}]`);
    if (!startDate) {
        allSameCell.addClass('active in-range');
        startDate = thisCell.attr('data');
        return;
    }

    if (startDate && !endDate) {
        endDate = thisCell.attr('data');
        allSameCell.addClass('active');
        if (moment(startDate).isAfter(endDate)) {
            const temp = startDate;
            startDate = endDate;
            endDate = temp;
        }
        if (type === calenderTypes.week) {
          endDate = moment(endDate).add(1, 'hours').format(DATE_TIME_FMT)
        }
        setValueFromToInput(startDate, endDate, type);
        return;
    }

    if (startDate && endDate) {
        startDate = '';
        endDate = '';
        thisCell.closest(parentClass).find('.cell').removeClass('in-range');
        thisCell.closest(parentClass).find('.cell').removeClass('active');
        thisCell.trigger('click');
    }
};

const handleDblClickCell = (e, type) => {
    const parentClass = `.${type}-calendar`;
    startDate = '';
    endDate = '';
    const thisCell = $(e.currentTarget);
    thisCell.closest(parentClass).find('.cell').removeClass('in-range');
    thisCell.closest(parentClass).find('.cell').removeClass('active');
};

$(() => {
    setTimeout(() => {
        setProcessID();
        $(dataFinderEls.startProc).on('change', (e) => {
            setProcessID();
        });
    }, 2000);

    $('body').append('<div class="data-finder-hover" style="display: none"></div>');
});
