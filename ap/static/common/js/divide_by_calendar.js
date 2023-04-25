const WEEK_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let divOffset = '';

const DivideFormatUnit = {
    Minute: 'minute',
    Hour: 'hour',
    Date: 'day',
    Month: 'month',
    Year: 'year',
    Week: 'week'
};

const weekDayOrder = {
    'Mon': 0,
    'Tue': 1,
    'Wed': 2,
    'Thu': 3,
    'Fri': 4,
    'Sat': 5,
    'Sun': 6
}

const DIVIDE_FORMAT_UNIT = {
    yyyymmddHH: DivideFormatUnit.Hour,
    yymmddHH: DivideFormatUnit.Hour,
    mmddHH: DivideFormatUnit.Hour,
    ddHH: DivideFormatUnit.Hour,
    HH: DivideFormatUnit.Hour,
    'yyyy-mm-dd_HH': DivideFormatUnit.Hour,
    'yy-mm-dd_HH': DivideFormatUnit.Hour,
    'mm-dd_HH': DivideFormatUnit.Hour,
    dd_HH: DivideFormatUnit.Hour,
    'yyyy-mm-dd_Fri': DivideFormatUnit.Date,
    'yy-mm-dd_Fri': DivideFormatUnit.Date,
    'mm-dd_Fri': DivideFormatUnit.Date,
    'dd_Fri': DivideFormatUnit.Date,
    'Fri': DivideFormatUnit.Date,

    yyyymmdd: DivideFormatUnit.Date,
    yymmdd: DivideFormatUnit.Date,
    mmdd: DivideFormatUnit.Date,
    dd: DivideFormatUnit.Date,
    'yyyy-mm-dd': DivideFormatUnit.Date,
    'yy-mm-dd': DivideFormatUnit.Date,
    'mm-dd': DivideFormatUnit.Date,

    yyyymm: DivideFormatUnit.Month,
    yymm: DivideFormatUnit.Month,
    mm: DivideFormatUnit.Month,
    'yyyy-mm': DivideFormatUnit.Month,
    'yy-mm': DivideFormatUnit.Month,

    yyyy: DivideFormatUnit.Year,
    yy: DivideFormatUnit.Year,
    'ww': DivideFormatUnit.Week,
    "Www": DivideFormatUnit.Week,
    "Www_mm-dd": DivideFormatUnit.Week
};

let divArrays = [];
let divFromTo = [];
let divFormats = []
let lastFrom = '';

const getDivideFormatUnit = (strDivideFormat) => {
    const isWeekDayIncluded = WEEK_DAY.some(v => strDivideFormat.trim()
        .endsWith(v));

    // TODO: handle this properly
    if (isWeekDayIncluded) {
        return DivideFormatUnit.Date;
    }
    return DIVIDE_FORMAT_UNIT[strDivideFormat];
};

const calculateToDateOfLatest = (dateStr, unit) => {
    let parsedDate = moment(dateStr, DATE_TIME_FMT);
    let firstDay = null;
    switch (unit) {
         case DivideFormatUnit.Hour:
            firstDay = moment(parsedDate.format('YYYY-MM-DD HH:00'));
            break;
        case DivideFormatUnit.Date:
            firstDay = moment(parsedDate.format('YYYY-MM-DD 00:00'));
            break;
        case DivideFormatUnit.Week:
            const monday = moment(parsedDate.clone().weekday(1).format('YYYY-MM-DD 00:00'));
            firstDay = moment(parsedDate.format('YYYY-MM-DD 00:00'));
            if (firstDay.isBefore(monday)) {
                return monday.format(DATE_TIME_FMT);
            } else {
                firstDay = monday.clone();
            }
            break;
        case DivideFormatUnit.Month:
            firstDay = moment(parsedDate.format('YYYY-MM-01 00:00'));
            break;
        case DivideFormatUnit.Year:
            firstDay = moment(parsedDate.format('YYYY-01-01 00:00'));
            break;
     }
     if (parsedDate.isAfter(firstDay)) {
         parsedDate = firstDay.add(1, unit);
     }
     return parsedDate.format(DATE_TIME_FMT)
};

const parseDatetime = (strDate, isLatest, offsetHour, unit) => {
    let parsedDate = moment(strDate, DATE_TIME_FMT);
    if (isLatest) {
        parsedDate.add(offsetHour, 'hour');
    }
    return parsedDate.format(DATE_TIME_FMT);
};

// moment.js have different unit when using `add days` and `set date`.
// So we need to get different format for specific task
const getManipulateFormatUnit = divideFormatUnit => (divideFormatUnit === DivideFormatUnit.Date ? 'days' : divideFormatUnit);

const addOneUnit = (currentDate, unit) => {
    const manipulateFormatUnit = getManipulateFormatUnit(unit);
    return currentDate.clone()
        .add(1, manipulateFormatUnit);
};

const getNextDivision = (currentDate, unit, isFull=true) => {
    const res = addOneUnit(currentDate, unit);
    if (!isFull && (unit === DivideFormatUnit.Month || unit === DivideFormatUnit.Year)) {
        const expectedDate = currentDate.date() + 1;
        const currentLastDate = res.clone()
            .endOf(DivideFormatUnit.Month)
            .date();
        if (currentLastDate < expectedDate) {
            res.set(DivideFormatUnit.Date, 1);
            res.add(1, DivideFormatUnit.Month);
        } else {
            res.set(DivideFormatUnit.Date, expectedDate);
        }
    }
    return res;
};

const getNewFrom = (from, unit) => {
    return moment(from).format('YYYY-MM-DD '+ divOffset);
};

const getNewTo = (to, unit) => {
    const toDate = moment(to);
    // if current hour > offset : next 1 one + offset
    // if current hour < offset : + offset
    if (unit === DivideFormatUnit.Hour) {
        return toDate.format('YYYY-MM-DD HH:mm');
    } else {
        const fromOffset = Number(divOffset.split(':')[0]) + (Number(divOffset.split(':')[1]) / 60);
        const toHour = toDate.format('HH:mm').split(':');
        const toOffset = Number(toHour[0]) + ( Number(toHour[1]) / 60 );
        if (toOffset > fromOffset) {
            return toDate.add(1, 'day').format('YYYY-MM-DD '+ divOffset);
        } else {
            return toDate.format('YYYY-MM-DD '+ divOffset);
        }

    }
};

const calculateDivisionSet = (from, to, unit, returnObject=false) => {
    const divisionSet = [];
    to = moment(to)
    let current = moment(from).clone();
    if (!returnObject) {
        divisionSet.push(current.format(DATE_TIME_FMT))
    }
    let newCurrent = getNextDivision(current, unit);
    while (newCurrent <= to) {
        divisionSet.push(returnObject ? {
            from: current.format(DATE_TIME_FMT),
            to: newCurrent.format(DATE_TIME_FMT),
        } : newCurrent.format(DATE_TIME_FMT));
        current = newCurrent;
        newCurrent = getNextDivision(current, unit);
    }
    return divisionSet;
};

const transformFormat = (fmtStr) => {
    if (!fmtStr) return '';
    // format has fixed W text:
    const hasW = fmtStr.includes('W');
    if (hasW) {
        fmtStr = fmtStr.slice(1);
    }
    fmtStr = fmtStr.toUpperCase();
    fmtStr = fmtStr.replaceAll('FRI', 'ddd');
    return [fmtStr, hasW]
};

const calcDivNumber = (from, to, unit, divideFormat) => {
    const [format, hasW] = transformFormat(divideFormat);
    to = moment(to).subtract(1, 'minutes').format(DATE_TIME_FMT);
    divFromTo = calculateDivisionSet(from, to, unit);
    divFormats = divFromTo.map(date => moment(date).format(format));
    divArrays = uniq(divFromTo.map(date => moment(date).format(format)));

    if (format === 'ddd') {
        // sort from monday to sunday
        divArrays.sort((a, b) => {
            return weekDayOrder[a] > weekDayOrder[b] ? 1 : -1;
        })
    } else if (format !== 'WW_MM-DD') {
        divArrays.sort();
    }
    if (hasW) {
        divArrays = divArrays.map(d => 'W' + d);
        divFormats = divFormats.map(d => 'W' + d);
    }
    return divArrays.length;
};

const dividedByCalendarDateRange = (fromDate, toDate, strDivideFormat, isLatest, offsetHour) => {
    const divideFormatUnit = getDivideFormatUnit(strDivideFormat);
    let from = fromDate;
    let to = toDate;
    if (!isLatest) {
        divOffset = moment(fromDate).format('HH:mm');
        from = getNewFrom(fromDate, divideFormatUnit);
        to = getNewTo(toDate, divideFormatUnit);
    } else {
        // latest is shift to full hour, day, week, month, year
        const unitLatest = Math.round(moment(to).diff(from, divideFormatUnit)) || 1;
        to = calculateToDateOfLatest(to, divideFormatUnit);
        from = moment(to).subtract(unitLatest, divideFormatUnit).format(DATE_TIME_FMT);
    }
    to = parseDatetime(to, isLatest, offsetHour, divideFormatUnit);
    from = parseDatetime(from, isLatest, offsetHour, divideFormatUnit);
    lastFrom = to;

    const div = calcDivNumber(from, to, divideFormatUnit, strDivideFormat);

    return {
        from,
        to,
        div,
    };
};

const dividedByCalendar = (fromDate, toDate, strDivideFormat, isLatest, offsetHour) => {
    return dividedByCalendarDateRange(fromDate, toDate, strDivideFormat, isLatest, offsetHour);
};
