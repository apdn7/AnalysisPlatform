let isSSEListening = false;

let longPollingData = {
    formData: null, // javascript FormData obj
    callbackFuncName: null, // string
    callbackParams: [], // []
};

let activePollingRequestPromise = null;
let hasQueuedPollingRequest = false;

const isPromiseLike = (value) => value && typeof value.then === 'function';

const runQueuedPollingRequest = () => {
    if (!hasQueuedPollingRequest) {
        return;
    }
    hasQueuedPollingRequest = false;
    handleSourceListener();
};

const registerActivePollingRequest = (requestPromise) => {
    if (!isPromiseLike(requestPromise)) {
        return;
    }

    activePollingRequestPromise = Promise.resolve(requestPromise).finally(() => {
        activePollingRequestPromise = null;
        runQueuedPollingRequest();
    });
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
    const isAutoUpdate = shouldChartBeRefreshed(longPollingData.formData || new FormData());
    if (isAutoUpdate) {
        showDateTimeRangeValue();
    }

    if (isAutoUpdate && longPollingData.callbackFuncName) {
        if (activePollingRequestPromise) {
            hasQueuedPollingRequest = true;
            return;
        }

        isSSEListening = true;
        const callbackResult = longPollingData.callbackFuncName(...longPollingData.callbackParams);
        registerActivePollingRequest(callbackResult);
    }
};

const setPollingData = (formData, callbackFunc, params, requestPromise = null) => {
    longPollingData = {
        formData,
        callbackFuncName: callbackFunc,
        callbackParams: params,
    };

    // Optional hook: caller can pass the in-flight request promise explicitly.
    registerActivePollingRequest(requestPromise);
};
