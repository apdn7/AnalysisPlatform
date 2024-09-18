const cyclicEles = {
    datetimeFrom: $('#i18nDatetimeFrom').text(),
    datetimeTo: $('#i18nDatetimeTo').text(),
    datetimeRange: $('#i18nDatetimeRange').text(),
    timestamp: $('#i18nTimestamp').text(),
    windowLength: $('#i18nWindowLength').text(),
    numRL: $('#i18nNumRL').text(),
    numRLHover: $('#i18nNumRLHover').text(),
    interval: $('#i18nInterval').text(),
    intervalHover: $('#i18nIntervalHover').text(),
    formID: 'cyclicTermCategoricalPlotForm',
    cyclicTermDivNum: 'cyclicTermDivNum',
    cyclicTermInterval: 'cyclicTermInterval',
    cyclicTermWindowLength: 'cyclicTermWindowLength',
};

const STP_EXPORT_URL = {
    CSV: {
        ext_name: 'csv',
        url: '/ap/api/stp/data_export/csv',
    },
    TSV: {
        ext_name: 'tsv',
        url: '/ap/api/stp/data_export/tsv',
    },
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
const generateTabHTML = (eleIdPrefix, data, sensors, showViewer = false) => {
    const genNavItemHTML = (
        tabId,
        sensorMasterName,
        status = '',
        sensorID = null,
    ) => `<li class="nav-item ${status}">
            <a href="#${tabId}" class="nav-link ${status} tab-name" role="tab" data-toggle="tab" data-sensor-id="${sensorID}" data-original-title="${sensorMasterName}"
                >${sensorMasterName}</a>
        </li>`;

    const catLimitMsgs = $('#i18nCatLimitedMsg')
        .text()
        .split('BREAK_LINE')
        .join('<br>');
    const genTabContentHTML = (
        tabId,
        plotCardId,
        status = '',
    ) => `<div class="tab-pane fade show ${status}" id="${tabId}">
        <div class="card cate-plot-cards clearfix ui-sortable" id="${plotCardId}"></div>
        <div class="overlay-card" id="${plotCardId}-lim">
            <span class="text-center">${catLimitMsgs}</span>
        </div></div>`;

    const navItemHTMLs = [];
    const tabContentHTMLs = [];
    const existPlotData = !_.isEmpty(data.array_plotdata);
    const procNamesSet = new Set();
    for (
        let sensorIdx = 0;
        existPlotData && sensorIdx < sensors.length;
        sensorIdx++
    ) {
        const sensorPlotDatas =
            eleIdPrefix !== 'directTerm'
                ? data.array_plotdata[sensors[sensorIdx]]
                : data.array_plotdata.filter(
                      (plot) => plot.end_col === Number(sensors[sensorIdx]),
                  );
        // カラム名を取得する。
        const { end_proc_name, end_col_name } = sensorPlotDatas[0];
        const sensorMasterName = procNamesSet.has(end_proc_name)
            ? `${end_col_name}`
            : `${end_proc_name}|${end_col_name}`;
        procNamesSet.add(end_proc_name);
        let status = '';
        if (sensorIdx === 0) {
            status = 'active';
        }
        const tabId = `${eleIdPrefix}HistogramsTab-${sensorIdx}`;
        const sensorID = sensors[sensorIdx];
        const navItemHTML = genNavItemHTML(
            tabId,
            sensorMasterName,
            status,
            sensorID,
        );
        navItemHTMLs.push(navItemHTML);
        const plotCardId = `${eleIdPrefix}CatePlotCards-${sensorIdx}`;
        const tabContentHTML = genTabContentHTML(tabId, plotCardId, status);
        tabContentHTMLs.push(tabContentHTML);
    }
    let viewerNavHTML = '';
    let viewerContentHTML = '';
    if (showViewer) {
        viewerNavHTML = genNavItemHTML(
            (tabId = 'scattersTab'),
            (sensorMasterName = i18n.viewerTabName),
        );
        viewerContentHTML = genTabContentHTML(
            (tabId = 'scattersTab'),
            (plotCardId = 'varScatterPlotCards'),
        );
    }

    const stratifiedVarTabHTML = `<ul id="${eleIdPrefix}Tabs" class="nav nav-tabs justify-content-end stp-tab" role="tablist">
        ${navItemHTMLs.join(' ')}
        ${viewerNavHTML}
    </ul>
    <div id="${eleIdPrefix}TabContent" class="tab-content clearfix histogram-tab-content">
        ${tabContentHTMLs.join(' ')}
        ${viewerContentHTML}
    </div>`;

    return stratifiedVarTabHTML;
};

const showResultTabHTMLs = (eleIdPrefix, data, sensors, showViewer = false) => {
    const tabHTMLs = generateTabHTML(eleIdPrefix, data, sensors, showViewer);
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
    const proc = arrayFormval.filter((proc) =>
        proc.GET02_VALS_SELECT.includes(sensorId.toString()),
    );
    return proc[0].end_proc;
};

const isFormDataValid = (eleIdPrefix, formData) => {
    const requiredKeys = ['end_proc'];

    const formKeys = [...formData.keys()];
    for (const chkKey of requiredKeys) {
        const result = formKeys.some((e) => e.startsWith(chkKey));
        if (result === false) {
            return 2;
        }
    }

    return 0;
};

const reformatFormData = (eleIdPrefix, formData) => {
    const formatedFormData = formData;

    // add GET_CATE_VAL
    if (eleIdPrefix === eles.varTabPrefix) {
        const endProcCate = formatedFormData.get('categoryVariable1');
        if (endProcCate) {
            formatedFormData.set('GET02_CATE_SELECT1', endProcCate);
        }
    }

    return formatedFormData;
};

const concatAllArrayY = (tabPrefix, traceData, numChart, sensorID = '') => {
    let arrayPlotdataY = [];
    for (let idx = 0; idx < numChart; idx++) {
        if (tabPrefix === eles.varTabPrefix) {
            arrayPlotdataY = arrayPlotdataY.concat(
                traceData.array_plotdata[sensorID][idx].array_y,
            );
        } else if (tabPrefix === eles.termTabPrefix) {
            arrayPlotdataY = arrayPlotdataY.concat(
                traceData.array_plotdata[idx].array_y,
            );
        }
    }
    arrayPlotdataY = arrayPlotdataY.filter((e) => $.isNumeric(e));
    return arrayPlotdataY;
};

const updateHistogramWhenChaneScale = (
    currentTraceData,
    scaleOption = scaleOptionConst.COMMON,
    sensorID = null,
    tabPrefix = '',
) => {
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
        const scaleInfo = getScaleInfo(
            currentTraceData.array_plotdata[sensorID][i],
            scaleOption,
        );
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
        const dataUpdate = [histogram, kdeDensity];

        const canvasId = `${tabPrefix}-${sensorID}-Histograms${i + 1}`;
        Plotly.update(canvasId, dataUpdate);
    }
};

const dumpData = (exportType, dataSrc) => {
    const formData = lastUsedFormData || collectFormDataFromGUI(true);
    formData.set('export_from', dataSrc);
    if (exportType === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard(STP_EXPORT_URL.TSV.url, formData);
    } else {
        exportData(
            STP_EXPORT_URL[exportType].url,
            STP_EXPORT_URL[exportType].ext_name,
            formData,
        );
    }
};
const handleExportData = (exportType) => {
    showGraphAndDumpData(exportType, dumpData);
};
