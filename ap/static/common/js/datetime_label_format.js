const dateTimeDisplayFormat = {
    millisecond: 'HH:mm:ss',
    second: 'HH:mm:ss',
    minute: 'HH:mm   ',
    hour: 'DD HH:mm',
    day: 'MM-DD HH',
    month: 'YY-MM-DD',
    year: 'YYYY-MM ',
};

const getUnitDateTimeFormat = (startTime, endTime, tickLength = 1) => {
    let unit = 'millisecond';
    if (tickLength === 0) {
        return unit;
    }
    const start = moment(startTime);
    const end = moment(endTime);
    const distanceTime = moment.duration(end.diff(start), 'milliseconds');
    const offsetTime = moment.duration(
        distanceTime / tickLength,
        'milliseconds',
    );
    if (distanceTime.asYears() >= 1) {
        unit = offsetTime.asYears() >= 1 ? 'year' : 'month';
    } else if (distanceTime.asMonths() >= 1) {
        unit = 'month';
    } else if (distanceTime.asDays() >= 1) {
        unit = offsetTime.asDays() >= 1 ? 'day' : 'hour';
    } else if (distanceTime.asHours() >= 1) {
        unit = 'minute';
    } else {
        unit = 'second';
    }
    return unit;
};

const getDateTimeFormat = (startTime, endTime, tickLength = 1) => {
    const unit = getUnitDateTimeFormat(startTime, endTime, tickLength);
    return dateTimeDisplayFormat[unit];
};
