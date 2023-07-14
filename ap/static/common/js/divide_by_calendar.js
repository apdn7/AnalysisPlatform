const WEEK_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let divOffset = '';
const FISCAL_START_MONTH = Number(localStorage.getItem('fiscalYear')) || 4;
const WEEK_FORMAT = 'K'

const DivideFormatUnit = {
    Minute: 'minute',
    Hour: 'hour',
    Date: 'day',
    Month: 'month',
    Year: 'year',
    Week: 'week',
    FYQuarter: 'quarter',
    FYHalf: 'half',
    FYMonth: 'fy_month',
    FYYear: 'fy_year',

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

const SPECIAL_FORMAT = {
    "ffffh": "ffff00h",
    "ffffq": 'ffff00q',
    "ffh": 'ff00h',
    "ffq": 'ff00q',
    "ffff": "ffff",
    "ff": "ff",
    "h": 'h',
    "q": 'q',
    "ffffmm": 'ffffmm',
    "ffmm": 'ffmm',
    "FY2022H1": "FYYYYYH1",
    "FY2022Q1": "FYYYYYQ1",
    "FY22H1": "FYYYH1",
    "FY22Q1": "FYYYQ1",
    "FY2022": "FYYYYY",
    "FY2022-mm": "FYYYYY-mm",
    "FY22-mm": "FYYY-mm",
    "FY22": "FYYY",
    "H1": 'H1',
    "Q1": "Q1",
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
    "Www_mm-dd": DivideFormatUnit.Week,
    "yyyy_Www": DivideFormatUnit.Week,
    "yyyy_Www_mm-dd": DivideFormatUnit.Week,
    "yy_Www": DivideFormatUnit.Week,
    "yy_Www_mm-dd": DivideFormatUnit.Week,

    // Fiscal Year
    "ffffh": DivideFormatUnit.FYHalf,
    "ffffq": DivideFormatUnit.FYQuarter,
    "ffh": DivideFormatUnit.FYHalf,
    "ffq": DivideFormatUnit.FYQuarter,
    "ffff": DivideFormatUnit.FYYear,
    "ff": DivideFormatUnit.FYYear,
    "h": DivideFormatUnit.FYHalf,
    "q": DivideFormatUnit.FYQuarter,
    "ffffmm": DivideFormatUnit.FYMonth,
    "ffmm": DivideFormatUnit.FYMonth,
    "FY2022H1": DivideFormatUnit.FYHalf,
    "FY2022Q1": DivideFormatUnit.FYQuarter,
    "FY22H1": DivideFormatUnit.FYHalf,
    "FY22Q1": DivideFormatUnit.FYQuarter,
    "FY2022": DivideFormatUnit.FYYear,
    "FY22": DivideFormatUnit.FYYear,
    "H1": DivideFormatUnit.FYHalf,
    "Q1": DivideFormatUnit.FYQuarter,
    "FY2022-mm": DivideFormatUnit.FYMonth,
    "FY22-mm": DivideFormatUnit.FYMonth,
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
    if (isLatest && unit !== DivideFormatUnit.Hour) {
        parsedDate.add(offsetHour, 'hour');
    }
    return parsedDate.format(DATE_TIME_FMT);
};

// moment.js have different unit when using `add days` and `set date`.
// So we need to get different format for specific task
const getManipulateFormatUnit = divideFormatUnit => (divideFormatUnit === DivideFormatUnit.Date ? 'days' : divideFormatUnit);

const addOneUnit = (currentDate, unit, step) => {
    const manipulateFormatUnit = getManipulateFormatUnit(unit);
    return currentDate.clone()
        .add(step, manipulateFormatUnit);
};

const getNextDivision = (currentDate, unit, step=1, isFull=true) => {
    const res = addOneUnit(currentDate, unit, step);
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

const calculateDivisionSet = (from, to, unit, step= 1, returnObject=false) => {
    const divisionSet = [];
    to = moment(to)
    let current = moment(from).clone();
    if (!returnObject) {
        divisionSet.push(current.format(DATE_TIME_FMT))
    }
    let newCurrent = getNextDivision(current, unit, step);
    while (newCurrent <= to) {
        divisionSet.push(returnObject ? {
            from: current.format(DATE_TIME_FMT),
            to: newCurrent.format(DATE_TIME_FMT),
        } : newCurrent.format(DATE_TIME_FMT));
        current = newCurrent;
        newCurrent = getNextDivision(current, unit, step);
    }
    return divisionSet;
};

const transformFormat = (fmtStr) => {
    if (!fmtStr) return '';
    // format has fixed W text:
    const hasW = fmtStr.includes('W');
    if (hasW) {
        fmtStr = fmtStr.replaceAll('W', WEEK_FORMAT);
    }
    fmtStr = fmtStr.toUpperCase();
    fmtStr = fmtStr.replaceAll('FRI', 'ddd');
    return [fmtStr, hasW]
};

const sliceFYWithExpectDate = (from, to, divs, divFormats) => {
    let fromDivIdx = 0
    let toDivIdx = divs.length;

    for (const i in divFormats) {
        const div = divs[i];
        const nextDiv = divs[Number(i) + 1]
        if (moment(from).isSameOrAfter(div) && moment(from).isBefore(nextDiv)) {
           fromDivIdx = Number(i);
        }

        if (moment(to).isSameOrAfter(div) && moment(to).isBefore(nextDiv)) {
           toDivIdx = Number(i);
        }
    }

    let newDivs = [];
    let newDivFormats = [];
    newDivs.push(from)
    newDivFormats.push(divFormats[fromDivIdx])
    for (let i = fromDivIdx + 1; i < toDivIdx; i++) {
        newDivs.push(divs[i]);
        newDivFormats.push(divFormats[i])
    }
    if (toDivIdx !== divs.length) {
        newDivs.push(to);
    }

    return [newDivs, newDivFormats]

}

const getSpecialFYFormat = (targetDate, fmt) => {
    const [divs, divFormats] = getFYDivAndFormatDivs(targetDate, null, fmt);
    return divFormats[0];
};


const getNextDateOfCurrentDate = (targetDate, fmt) => {
    const [divs, divFormats] = getFYDivAndFormatDivs(targetDate, null, fmt);
    return moment(divs[1]).format('YYYY-MM-DD 00:00');
}

const getFYDivAndFormatDivs = (fromDate, toDate=null, fmtstr='') => {
    const FYUnit = DIVIDE_FORMAT_UNIT[fmtstr];

    let [startDateOfYear, endDateOfYear] = calcDateRangeOfFiscalYear(fromDate, toDate);
    // get unit
    const to = moment(endDateOfYear).subtract(1, 'minutes').format(DATE_TIME_FMT);
    let divs = []
    let format_divs = []

    const getCurrentFY = (date) => {
       return moment(date);
    }

    const { step, divOfYear, unit } = getFYDivOfYearAndStep(fmtstr);
    divs = calculateDivisionSet(startDateOfYear, to, unit, step);

    fmtstr = SPECIAL_FORMAT[fmtstr]

    let fisYear = getCurrentFY(divs[0]);
    fmtstr = fmtstr.toUpperCase();
    // const numberOfF = (fmtstr.match(new RegExp("f", "g")) || []).length

    const hasHaft = fmtstr.includes('H');
    const haftFmt = fmtstr.includes('H1') ? 'H' : '';
    const hasQ = fmtstr.includes('Q');
    const quarterFmt = fmtstr.includes('Q1') ? 'Q' : '';
    const hasFY = fmtstr.includes('FY');

    const addSpecialChar = (fmt, step) => {
        if (hasQ) {
            fmt = fmt + quarterFmt + `${step}`;
        }

        if (hasFY) {
            fmt = 'FY' + fmt;
        }
        if (hasHaft) {
            fmt = fmt + haftFmt + `${step}`
        }

        return fmt;
    }

    fmtstr = fmtstr.replaceAll('FY', '');
    fmtstr = fmtstr.replaceAll('H1', '');
    fmtstr = fmtstr.replaceAll('H', '');
    fmtstr = fmtstr.replaceAll('Q1', '');
    fmtstr = fmtstr.replaceAll('Q', '');
    fmtstr = fmtstr.replaceAll('F', 'Y');
    let index = 1;
    for (const div of divs) {
        if (index > divOfYear) {
            index = 1;
            fisYear = getCurrentFY(div);
        }

        let fmt;
        if ([DivideFormatUnit.FYQuarter, DivideFormatUnit.FYHalf, DivideFormatUnit.FYYear].includes(FYUnit)) {
            fmt = fmtstr ? fisYear.format(fmtstr) : '';
            fmt = addSpecialChar(fmt, index)
        } else {
            fmt = fmtstr ? moment(div).format(fmtstr) : '';
            fmt = addSpecialChar(fmt, index)
        }
        format_divs.push(fmt)
        index += 1;
    }
    divs.push(endDateOfYear)

    return sliceFYWithExpectDate(fromDate, toDate || endDateOfYear, divs, format_divs)
};

const getFYDivOfYearAndStep = (strFormat) => {
    let divOfYear = 1;
    let step = 1;
    let unit = DivideFormatUnit.Year;
    const FYUnit = DIVIDE_FORMAT_UNIT[strFormat];
     if (FYUnit === DivideFormatUnit.FYQuarter) {
        divOfYear = 4;
        step = 3;
        unit = DivideFormatUnit.Month;
    } else if (FYUnit === DivideFormatUnit.FYHalf) {
        divOfYear = 2;
        step = 6;
        unit = DivideFormatUnit.Month;
    } else if (FYUnit === DivideFormatUnit.FYYear) {
        divOfYear = 1;
        step = 1;
        unit = DivideFormatUnit.Year;
    } else if (FYUnit === DivideFormatUnit.FYMonth) {
        divOfYear = 12;
        step = 1;
        unit = DivideFormatUnit.Month;
    }

     return {step, unit, divOfYear};
};

const calcDivNumber = (from, to, unit, divideFormat) => {
    const isFYFormat = getIsFYFormat(divideFormat);
    if (isFYFormat) {
        [divFromTo, divFormats] = getFYDivAndFormatDivs(from, to, divideFormat);
        divFromTo = divFromTo.filter(e => e)
        divFormats = divFormats.filter(e => e)
        divArrays = uniq(divFormats);
    } else {
        const [format, hasW] = transformFormat(divideFormat);
        to = moment(to).subtract(1, 'minutes').format(DATE_TIME_FMT);
        divFromTo = calculateDivisionSet(from, to, unit);
        divFormats = divFromTo.map(date => moment(date).format(format));
        divArrays = uniq(divFromTo.map(date => moment(date).format(format)));
        divFromTo.push(lastFrom)

        if (format === 'ddd') {
            // sort from monday to sunday
            divArrays.sort((a, b) => {
                return weekDayOrder[a] > weekDayOrder[b] ? 1 : -1;
            })
        } else if (format !== 'WW_MM-DD') {
            divArrays.sort();
        }
        if (hasW) {
            divArrays = divArrays.map(d => d.replace(WEEK_FORMAT, 'W'));
            divFormats = divFormats.map(d => d.replace(WEEK_FORMAT, 'W'));
        }
    }
    return divArrays.length;
};

const dividedByCalendarDateRange = (fromDate, toDate, strDivideFormat, isLatest, offsetHour) => {
    const divideFormatUnit = getDivideFormatUnit(strDivideFormat);
    if (!divideFormatUnit) return ;
    let from = fromDate;
    let to = toDate;
    if (!isLatest) {
        divOffset = moment(fromDate).format('HH:mm');
        from = getNewFrom(fromDate, divideFormatUnit);
        to = getNewTo(toDate, divideFormatUnit);
    } else {

        const isFYFormat = getIsFYFormat(strDivideFormat);
         const { step, unit } = getUnitAndStepOfStrFormat(strDivideFormat);
        // latest is shift to full hour, day, week, month, year
        let actualStep = Math.round(moment(to).diff(from, unit)) || 1;
         // get next date of step unit
        if (isFYFormat) {
            to = getNextDateOfCurrentDate(to, strDivideFormat);
            if (actualStep < step) {
                actualStep = step;
            }
        } else {
            to = calculateToDateOfLatest(to, divideFormatUnit);
        }
        from = moment(to).subtract(actualStep, unit).format(DATE_TIME_FMT);
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

const getUnitAndStepOfStrFormat = (strFormat) => {
    const isFYFormat = getIsFYFormat(strFormat);
    let result = { step: 1, unit:  getDivideFormatUnit(strFormat)}

    if (isFYFormat) {
        result = getFYDivOfYearAndStep(strFormat);
    }

    return result;
};

const getIsFYFormat = (strFormat) => {
    return !!SPECIAL_FORMAT[strFormat];
};

const getFiscalYearStartMonth = () => {
    fetchData('/ap/api/setting/get_fiscal_year_default', {}, 'GET').then((res) => {
        const fy = res.fiscal_year_start_month;
        if (fy) {
            localStorage.setItem('fiscalYear', fy);
        }
    });
};

const calcDateRangeOfFiscalYear = (fromDate, toDate = null) => {
    const currentFromYear = moment(fromDate).format('YYYY');
    const currentFromMonth = Number(moment(fromDate).format('MM'));
    const currentHour = moment(fromDate).format('HH:mm')
    let startDate = moment(`${currentFromYear}-${FISCAL_START_MONTH}-01 ${currentHour}`);
    if (currentFromMonth < Number(FISCAL_START_MONTH)) {
        startDate = startDate.subtract(1, 'y');
    }

    let endOfStartDate = startDate.clone().add(1, 'y');
    if (toDate) {
         while (moment(toDate).isAfter(endOfStartDate)) {
            endOfStartDate = endOfStartDate.add(1, 'y');
        }
    }

    return [startDate.format(DATE_TIME_FMT), endOfStartDate.format(DATE_TIME_FMT)]
};

const dividedByCalendar = (fromDate, toDate, strDivideFormat, isLatest, offsetHour) => {
    return dividedByCalendarDateRange(fromDate, toDate, strDivideFormat, isLatest, offsetHour);
};
