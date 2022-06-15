/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const cyclicEles = {
    datetimeFrom: $('#i18nDatetimeFrom').text(),
    datetimeTo: $('#i18nDatetimeTo').text(),
    datetimeRange: $('#i18nDatetimeRange').text(),
    timestamp: $('#i18nTimestamp').text(),
    windowLength: $('#i18nWindowLength').text(),
    windowLengthHover: $('#i18nWindowLengthHover').text(),
    numRL: $('#i18nNumRL').text(),
    numRLHover: $('#i18nNumRLHover').text(),
    interval: $('#i18nInterval').text(),
    intervalHover: $('#i18nIntervalHover').text(),
    formID: 'cyclicTermCategoricalPlotForm',
    cyclicTermDivNum: 'cyclicTermDivNum',
    cyclicTermInterval: 'cyclicTermInterval',
    cyclicTermWindowLength: 'cyclicTermWindowLength',
    START_DATE: 'START_DATE',
    START_TIME: 'START_TIME',
    END_DATE: 'END_DATE',
    END_TIME: 'END_TIME',
};

const addLimitNumSensors = () => {
    // validate number of selected show values
    $(`${eles.checkBoxs}`).each(function f() {
        $(this).on('change', () => {
            const numSelectedCheckBoxes = $(`${eles.checkBoxs}:checked`).length;
            if (numSelectedCheckBoxes < 1) {
                $(eles.varShowGraphBtn).attr('disabled', true);
                $(eles.varShowGraphBtn).css('cursor', 'not-allowed');
            } else {
                $(eles.varShowGraphBtn).attr('disabled', false);
                $(eles.varShowGraphBtn).css('cursor', 'default');
            }
        });
    });
};


// generate HTML for tabs
const generateTabHTML = (eleIdPrefix, arrayFormVal, sensors, showViewer = false) => {
    const genNavItemHTML = (tabId, sensorMasterName, status = '', sensorID = null) => `<li class="nav-item ${status}">
            <a href="#${tabId}" class="nav-link ${status} tab-name" role="tab" data-toggle="tab" data-sensor-id="${sensorID}" data-original-title="${sensorMasterName}"
                >${sensorMasterName}</a>
        </li>`;

    const genTabContentHTML = (tabId, plotCardId, status = '') => `<div class="tab-pane fade show ${status}" id="${tabId}">
        <div class="card cate-plot-cards clearfix ui-sortable" id="${plotCardId}"></div>
    </div>`;

    const navItemHTMLs = [];
    const tabContentHTMLs = [];
    for (let sensorIdx = 0; sensorIdx < sensors.length; sensorIdx++) {
        // カラム名を取得する。
        const endProc = getEndProcFromFormVal(sensors[sensorIdx], arrayFormVal);
        const sensorName = getColumnName(endProc, sensors[sensorIdx]);

        const sensorMasterName = getNode(procConfigs, [endProc, 'value_master', sensorName], sensorName) || sensorName;

        let status = '';
        if (sensorIdx === 0) {
            status = 'active';
        }
        const tabId = `${eleIdPrefix}HistogramsTab-${sensorIdx}`;
        const sensorID = sensors[sensorIdx];
        const navItemHTML = genNavItemHTML(tabId, sensorMasterName, status, sensorID);
        navItemHTMLs.push(navItemHTML);
        const plotCardId = `${eleIdPrefix}CatePlotCards-${sensorIdx}`;
        const tabContentHTML = genTabContentHTML(tabId, plotCardId, status);
        tabContentHTMLs.push(tabContentHTML);
    }
    let viewerNavHTML = '';
    let viewerContentHTML = '';
    if (showViewer) {
        viewerNavHTML = genNavItemHTML(tabId = 'scattersTab', sensorMasterName = i18n.viewerTabName);
        viewerContentHTML = genTabContentHTML(tabId = 'scattersTab', plotCardId = 'varScatterPlotCards');
    }

    const stratifiedVarTabHTML = `<ul id="${eleIdPrefix}Tabs" class="nav nav-tabs justify-content-end" role="tablist" style="margin-top: -35px">
        ${navItemHTMLs.join(' ')}
        ${viewerNavHTML}
    </ul>
    <div id="${eleIdPrefix}TabContent" class="tab-content clearfix">
        ${tabContentHTMLs.join(' ')}
        ${viewerContentHTML}
    </div>`;

    return stratifiedVarTabHTML;
};

const showResultTabHTMLs = (eleIdPrefix, arrayFormVal, sensors, showViewer = false) => {
    const tabHTMLs = generateTabHTML(eleIdPrefix, arrayFormVal, sensors, showViewer);
    const parentEle = `#${eles.categoryPlotCards}`;

    $(parentEle).html();
    $(parentEle).html(tabHTMLs);

    // show tooltip
    $(`${parentEle} [data-toggle="tab"]`).tooltip({
        trigger: 'hover',
        placement: 'top',
        animate: true,
        delay: 100,
        container: 'body',
    });
};

const getEndProcFromFormVal = (sensorId, arrayFormval) => {
    const proc = arrayFormval.filter(proc => proc.GET02_VALS_SELECT.includes(sensorId.toString()));
    return proc[0].end_proc;
};

const isFormDataValid = (eleIdPrefix, formData) => {
    if (eleIdPrefix === 'var' || eleIdPrefix === 'category') {
        const endProcCat = formData.get('end_proc_cate1');
        if (!endProcCat || endProcCat === 'null') {
            return 4;
        }
    }

    // check required keys
    let requiredKeys = ['end_proc', eles.categoryVariableName, eles.categoryValueMulti];
    if (eleIdPrefix === 'directTerm' || eleIdPrefix === 'cyclicTerm') {
        requiredKeys = ['end_proc'];
    }
    const formKeys = [...formData.keys()];
    for (const chkKey of requiredKeys) {
        const result = formKeys.some(e => e.startsWith(chkKey));
        if (result === false) {
            return 2;
        }
    }

    // check endProc = '---'
    const endProc = formData.get('end_proc1');
    if (endProc === '') {
        return 3;
    }

    return 0;
};

const reformatFormData = (eleIdPrefix, formData) => {
    let formatedFormData = formData;

    // add GET_CATE_VAL
    if (eleIdPrefix === eles.varTabPrefix) {
        const endProcCate = formatedFormData.get('categoryVariable1');
        formatedFormData.set('GET02_CATE_SELECT1', endProcCate);
    }

    if (eleIdPrefix === eles.cyclicTermTabPrefix) {
        formatedFormData = chooseCyclicTraceTimeInterval(formatedFormData);
    } else if (eleIdPrefix === eles.varTabPrefix) {
        formatedFormData = chooseTraceTimeIntervals(formatedFormData);
    }
    // convert to UTC datetime to query
    formatedFormData = convertFormDateTimeToUTC(formatedFormData);
    return formatedFormData;
};

const getChartThreshHolds = (tabPrefix, traceData, chartIdx, sensorId = null) => {
    if ([eles.varTabPrefix, eles.cyclicTermTabPrefix].includes(tabPrefix)) {
        const arrayY = traceData.array_plotdata[sensorId][chartIdx].array_y;
        const setYMax = traceData.array_plotdata[sensorId][chartIdx]['y-max'];
        const setYMin = traceData.array_plotdata[sensorId][chartIdx]['y-min'];
        const chartInfos = traceData.array_plotdata[sensorId][chartIdx].chart_infos || [];
        const [latestChartInfo, latestIndex] = chooseLatestThresholds(chartInfos);
        const corrSummary = traceData.array_plotdata[sensorId][chartIdx].summaries[latestIndex] || {};
        return {
            arrayY, setYMax, setYMin, latestChartInfo, corrSummary,
        };
    }
    const arrayY = traceData.array_plotdata[chartIdx].array_y;
    const setYMax = traceData.array_plotdata[chartIdx]['y-max'];
    const setYMin = traceData.array_plotdata[chartIdx]['y-min'];
    const chartInfos = traceData.array_plotdata[chartIdx].chart_infos || [];
    const [latestChartInfo, latestIndex] = chooseLatestThresholds(chartInfos);
    const corrSummary = traceData.array_plotdata[chartIdx].summaries[latestIndex] || {};
    return {
        arrayY, setYMax, setYMin, latestChartInfo, corrSummary,
    };
};

const concatAllArrayY = (tabPrefix, traceData, numChart, sensorID = '') => {
    let arrayPlotdataY = [];
    for (let idx = 0; idx < numChart; idx++) {
        if (tabPrefix === eles.varTabPrefix) {
            arrayPlotdataY = arrayPlotdataY.concat(traceData.array_plotdata[sensorID][idx].array_y);
        } else if (tabPrefix === eles.termTabPrefix) {
            arrayPlotdataY = arrayPlotdataY.concat(traceData.array_plotdata[idx].array_y);
        }
    }
    arrayPlotdataY = arrayPlotdataY.filter(e => $.isNumeric(e));
    return arrayPlotdataY;
};

const updateHistogramWhenChaneScale = (currentTraceData, scaleOption = '1', sensorID = null, tabPrefix = '') => {
    if (tabPrefix === eles.varTabPrefix && !sensorID) {
        return;
    }

    let numChart = 0;
    if ([eles.varTabPrefix, eles.cyclicTermTabPrefix].includes(tabPrefix)) {
        numChart = currentTraceData.array_plotdata[sensorID].length;
    } else {
        numChart = currentTraceData.array_plotdata.length;
    }
    if (!numChart) return;


    for (let i = 0; i < numChart; i++) {
        const scaleInfo = getScaleInfo(currentTraceData.array_plotdata[sensorID][i], scaleOption);
        const kdeData = scaleInfo.kde_data;
        const yMax = scaleInfo['y-max'];
        const yMin = scaleInfo['y-min'];

        const kdeDensity = {
            y: kdeData.hist_labels,
            x: kdeData.kde,
        };

        const histogram = {
            y: kdeData.hist_labels,
            x: kdeData.kde,
            ybins: { end: yMax, size: 128, start: yMin },
        };
        const dataUpdate = [
            histogram,
            kdeDensity,
        ];

        const canvasId = `${tabPrefix}-${sensorID}-Histograms${i + 1}`;
        Plotly.update(canvasId, dataUpdate);
    }
};

const shouldCreateNewSSESource = (formData) => {
    if (is_sse_listening) {
        return false;
    }

    const autoUpdateInterval = formData.get('autoUpdateInterval');
    if (autoUpdateInterval) {
        is_sse_listening = true;
        return true;
    }
    return false;
};

const autoUpdate = (formData) => {
    if (shouldCreateNewSSESource(formData)) {
        const source = openServerSentEvent();
        source.addEventListener(serverSentEventType.procLink, (event) => {
            $(`${eles.mainFormId} button.show-graph`).click();
        }, false);
    }
};
