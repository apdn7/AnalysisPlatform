/* eslint-disable no-unused-vars,camelcase */
let isSSEListening = false;
let autoUpdateCallBackFunc = null;

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
        isSSEListening = true;
        return true;
    }

    isSSEListening = false;
    return false;
};

const longPolling = (formData, callback) => {
    autoUpdateCallBackFunc = callback;
    const source = openServerSentEvent();
    source.removeEventListener(serverSentEventType.procLink, handleSourceListener, true);
    if (shouldChartBeRefreshed(formData)) {
        source.addEventListener(serverSentEventType.procLink, handleSourceListener, true);
    }
};

const handleSourceListener = () => {
    if (autoUpdateCallBackFunc) {
        autoUpdateCallBackFunc();
    } else {
        $(`${currentFormID} button.show-graph`).click();
    }
};
