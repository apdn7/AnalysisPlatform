let isSSEListening = false;

let longPollingData = {
    formData: null, // javascript FormData obj
    callbackFuncName: null, // string
    callbackParams: [], // []
};

const getTraceTime = (formData) => {
    for (const item of formData.entries()) {
        const key = item[0];
        const value = item[1];
        if (/^.*[t|T]raceTime.*/.test(key)) {
            return value;
        }
    }
};

const isAutoUpdate = (formData) => {
    const autoUpdateInterval = formData.get('autoUpdateInterval');
    const traceTimeOption = getTraceTime(formData);

    return !!autoUpdateInterval && traceTimeOption === TRACE_TIME_CONST.RECENT;
};

const shouldChartBeRefreshed = (formData) => {
    if (isAutoUpdate(formData)) {
        return true;
    }
    return false;
};

const handleSourceListener = () => {
    const isAutoUpdate = shouldChartBeRefreshed(
        longPollingData.formData || new FormData(),
    );
    if (isAutoUpdate) {
        showDateTimeRangeValue();
    }

    if (isAutoUpdate && longPollingData.callbackFuncName) {
        isSSEListening = true;
        longPollingData.callbackFuncName(...longPollingData.callbackParams);
    }
};

const setPollingData = (formData, callbackFunc, params) => {
    longPollingData = {
        formData,
        callbackFuncName: callbackFunc,
        callbackParams: params,
    };
};
