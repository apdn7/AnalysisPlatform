const consoleLogDebugForFetch = (url = '', option = {}, response = {}, error = {}) => {
    // If you want to show log, you must set DEBUG=true on localStorage first !!!
    if (!window.isDebugMode) return;

    const optionStr = `\n\nOption:\n${JSON.stringify(option)}`;
    const responseStr = Object.keys(response ?? {}).length > 0 ? `\n\nResponse:\n${JSON.stringify(response)}` : '';
    const errorStr = Object.keys(error ?? {}).length > 0 ? `\n\nError:\n${JSON.stringify(error)}` : '';
    consoleLogDebug(`[FETCH] Url=${url}${optionStr}${responseStr}${errorStr}\n\n`);
};

const fetchWithLog = (url = '', option = {}) => {
    return fetch(url, option)
        .then((response) => {
            if (!response.ok) {
                consoleLogDebugForFetch(url, option, undefined, jQuery.extend({}, response));
            } else {
                consoleLogDebugForFetch(url, option, response);
            }

            return response;
        })
        .catch((error) => {
            consoleLogDebugForFetch(url, option, undefined, jQuery.extend({}, error));
        });
};
