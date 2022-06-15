/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes
const MAX_END_PROC = 7;
const MIN_END_PROC = 2;
const CONTOUR_MAX = 10000;
let tabID = null;
let is_sse_listening = false;
let lastestFormData = null;
let resultData = null;

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    NO_FILTER: 'NO_FILTER',
    showOutliersDivID: '#showOutlier',
    i18nShowOutliers: $('#i18nShowOutliers').text(),
    i18nHideOutliers: $('#i18nHideOutliers').text(),
    i18nMSPCorr: $('#i18nMSPCorr').text(),
    i18nPartialCorr: $('#i18nPartialCorr').text(),
    switchContour: $('#showContourInput'),
};

const i18n = {
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    warning: $('#i18nWarning').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    warningTitle: $('#i18nWarningTitle').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    highSpeedMsg: $('#i18nHighSpeed').text(),
    hideContourMsg: $('#i18nHideContourMSG').text(),
};

const CONST = {
    RED: 'rgba(255,0,0,1)',
    BLUE: 'rgba(101, 197, 241, 1)',
    COLOR_NORMAL: '#89b368',
};

let mspData;

const checkDisableScatterBtn = (id = 'end-proc-row') => {
    // other screen may not have this object
    if (typeof formElements === 'undefined') {
        return;
    }

    // other screen may not have this object
    if (typeof formElements.scatterBtn === 'undefined') {
        return;
    }

    const SCATTER_MAX_NUM = 7;
    const SCATTER_MIN_NUM = 2;
    const checkedItems = $(`#${id}`).find('input[type="checkbox"][value!=All]:checked').length;
    if (checkedItems > SCATTER_MAX_NUM || checkedItems < SCATTER_MIN_NUM) {
        // $(formElements.scatterBtn).attr('disabled', true);
        // $(formElements.scatterBtn).css('cursor', 'not-allowed');
        return false; // form data is NG
    }
    // $(formElements.scatterBtn).attr('disabled', false);
    // $(formElements.scatterBtn).css('cursor', 'default');
    return true; // form data is OK
};


$(() => {
    // generate tab ID
    while (tabID === null || sessionStorage.getItem(tabID)) {
        tabID = Math.random();
    }
    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, false, false, true);
    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // validation
    initValidation(formElements.formID);

    initializeDateTimeRangePicker();

    // drag drop
    $('.ui-sortable').sortable({
        update(event, ui) {
            // redraw scatter plots
            if (resultData === null) {
                return;
            }
            loadingShow(true);
            const newCols = [];
            const newPlots = [];
            $('#sctr-card>div').each(function () {
                const pos = $(this).data('pos');
                newCols.push(resultData.array_plotdata[pos]);
                newPlots.push(resultData.ARRAY_FORMVAL[pos]);
            });
            resultData.array_plotdata = newCols;
            resultData.ARRAY_FORMVAL = newPlots;
            multipleScatterPlot(resultData);
            loadingHide();
        },
    });
});

const loading = $('.loading');

const mspTracing = () => {
    const isValid = checkValidations({ min: MIN_END_PROC, max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        formElements.switchContour.prop('checked', false);

        // clear old chart
        $('#sctr-card').html('');

        // show loading screen
        loadingShow();

        let formData = collectFormData(formElements.formID);
        formData = transformDatetimeRange(formData);
        syncTraceDateTime(
            parentId = 'traceDataForm',
            dtNames = {
                START_DATE: 'START_DATE',
                START_TIME: 'START_TIME',
                END_DATE: 'END_DATE',
                END_TIME: 'END_TIME',
            },
            dtValues = {
                START_DATE: formData.get('START_DATE'),
                START_TIME: formData.get('START_TIME'),
                END_DATE: formData.get('END_DATE'),
                END_TIME: formData.get('END_TIME'),
            },
        );

        // convert to UTC datetime to query
        formData = convertFormDateTimeToUTC(formData);

        // set use contour
        const showContourOption = formElements.switchContour.is(':checked') ? 1 : 0;
        formData.set('use_contour', showContourOption);
        lastestFormData = formData;

        // transDatetimeRange(formData);

        scatterTraceData(formData);
    }
};

const shouldChartBeRefreshed = () => {
    if (is_sse_listening) {
        return false;
    }
    const autoUpdateInterval = formElements.autoUpdateInterval.is('checked');
    const timeOption = $('input[name="traceTime"]:checked').val();
    if (autoUpdateInterval && timeOption === TRACE_TIME_CONST.RECENT) {
        is_sse_listening = true;
        return true;
    }
    return false;
};

// TODO merge with function which is called from gui
const callToBackEndAPI = () => {
    if (!checkDisableScatterBtn()) {
        showLimitSensorsToastMsg();
        loadingHide();
        return;
    }

    $.ajax({
        url: '/histview2/api/mullti_scatter/plot',
        data: lastestFormData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            resultData = res;
            const t0 = performance.now();
            loadingShow(true);
            if (res.is_send_ga_off) {
                showGAToastr(true);
            }
            showToastrMsg(i18n.highSpeedMsg, '');
            multipleScatterPlot(res);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);

            // check and do auto-update
            longPolling();

            // hide loading inside ajax
            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

            // export mode
            handleZipExport(res);
        },
        error: (res) => {
            loadingHide();
            errorHandling(res);
            // export mode
            handleZipExport(res);
        },
    }).then(() => {
        loadingHide();
        afterRequestAction();
    });
};

const autoUpdateCharts = () => {
    callToBackEndAPI();
};


const multipleScatterPlot = (data) => {
    const sensors = data.array_plotdata;
    mspData = data.scatter_contour;

    // calculate chart dimensions
    const plotDataCount = sensors.length;
    const canvasSize = 100 / plotDataCount;
    const startProc = data.COMMON.start_proc;

    $('#sctr-card').html('');
    sensors.forEach((_pd, k) => {
        let row = `<div class="chart-row" data-pos=${k}>`;
        const endProc = _pd.end_proc_id;
        for (let i = 0; i < plotDataCount; i++) {
            const ri = i + 1;
            const rk = k + 1;
            if (i === k) {
                if (String(endProc) === String(startProc)) {
                    row += `<div class="hist-item chart-column-border graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="hist-${rk}-${ri}" style="width: 99%;height: 100%"></div></div>`;
                } else {
                    row += `<div class="hist-item chart-column graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="hist-${rk}-${ri}" style="width: 99%;height: 100%"></div></div>`;
                }
            } else if (i > k) {
                row += `<div class="coef-item chart-column graph-navi p-2 d-flex flex-column justify-content-center align-items-center"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <p class="coef-text m-0" id="coef-${rk}-${ri}"></p></div>`;
            } else if (i < k) {
                row += `<div class="sctr-item chart-column graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="sctr-${rk}-${ri}" style="width: 99%;height: 100%"></div></div>`;
            }
        }
        row += '</div>';
        $('#sctr-card').append(row);
    });

    const graphCfg = {
        ...genPlotlyIconSettings(),
        responsive: true, // responsive
        useResizeHandler: true, // responsive
        style: { width: '100%', height: '100%' }, // responsive
    };


    // Histogram Chart
    $('.hist-item div').each((k, his) => {
        const hisChartID = $(his).attr('id');
        const cId = hisChartID.split('-');
        const ypd = Number(cId[1]) - 1;
        const scaleInfo = getScaleInfo(sensors[ypd], scaleOptionConst.SETTING);
        const xrange = [scaleInfo['y-min'], scaleInfo['y-max']];
        const { uclThresholds, procThresholds } = getThresholdData(cId, data, scaleOptionConst.SETTING);

        const procId = data.ARRAY_FORMVAL[k].end_proc;
        const colId = data.ARRAY_FORMVAL[k].GET02_VALS_SELECT;
        const procInfo = procConfigs[procId];
        const procName = procInfo.name;
        const colName = procInfo.getColumnById(colId).name;
        const chartLabel = `${procName} ${colName}`;

        const histTrace = genHistogramTrace(sensors[ypd]);
        const gridlayout = {
            bargroupgap: 0.1,
            title: {
                text: chartLabel,
                font: {
                    size: 11,
                    color: '#65c5f1',
                },
                xref: 'paper',
                x: 0.5,
            },
        };
        const histLayout = { ...genHistogramLayout(xrange), ...gridlayout };

        const maxHistNum = Math.max(...sensors[ypd].scale_setting.kde_data.hist_counts);
        const layoutWithThresholds = addHistogramThresholds(
            uclThresholds,
            procThresholds,
            histLayout,
            maxHistNum,
            sensors[ypd].scale_setting.kde_data.hist_labels,
        );

        Plotly.react(hisChartID, histTrace, layoutWithThresholds, graphCfg);
    });

    // Correlation COEF
    $('.coef-item p').each((_k, corrDom) => {
        const cId = $(corrDom).attr('id').split('-');
        const corr = getCorrFromDat(cId, data);
        const corrInfor = `<span>${formElements.i18nMSPCorr}: ${corr.corr}</span>
            <span>${formElements.i18nPartialCorr}: ${corr.pcorr || 0}</span>
            <span>N: ${formatNumberWithCommas(corr.ntotal)}</span>`;
        $(corrDom).html(corrInfor);
    });

    loadingUpdate(80);

    // Scatter Plot
    const scatterContourData = data.scatter_contour || [];

    const defaultShowContour = data.actual_record_number >= CONTOUR_MAX;
    formElements.switchContour.attr('disabled', defaultShowContour);
    if (defaultShowContour) {
        formElements.switchContour.prop('checked', true);
    }

    const showContourOption = formElements.switchContour.is(':checked');

    $('.sctr-item div').each((k, sct) => { // TODO 112 #8
        const sctChartID = $(sct).attr('id');
        const cId = sctChartID.split('-');
        const sctData = getScatterContourData(cId, scatterContourData);
        const {
            uclThresholds, procThresholds, rowRange, colRange,
        } = getThresholdData(cId, data, scaleOptionConst.SETTING); // TODO 112 #8

        const scatterTrace = genScatterOutlierTrace(sctData, showContourOption, data.proc_name);
        let sctTraces = [scatterTrace];
        if (showContourOption) {
            const contourTrace = genContourTrace(sctData);
            sctTraces = [contourTrace, scatterTrace];
        }
        let sctLayout = genScatterContourLayout();
        sctLayout = addScatterThresholds(sctLayout, uclThresholds, procThresholds, rowRange, colRange);
        sctLayout = addAxisRange(sctLayout, rowRange, colRange);
        sctLayout.xaxis.ticklen = 0;
        sctLayout.yaxis.ticklen = 0;

        Plotly.react(sctChartID, sctTraces, sctLayout, graphCfg);
    });

    // trigger resize window
    window.dispatchEvent(new Event('resize'));

    $('#sctr-card').show();
    $('#showContour').show();

    $('html, body').animate({
        scrollTop: $('#sctr-card').offset().top,
    }, 1500);
};

const scatterTraceData = (formData, isShowMessage = true) => {
    if (!checkDisableScatterBtn()) {
        showLimitSensorsToastMsg();
        loadingHide();
        return;
    }
    $.ajax({
        url: '/histview2/api/msp/plot',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            resultData = res;
            const t0 = performance.now();
            loadingShow(true);

            if (res.is_send_ga_off) {
                showGAToastr(true);
            }
            // Hide loading screen
            loading.addClass('hide');
            $('#plot-cards').empty();

            // check result and show toastr msg
            if (isEmpty(res.array_plotdata)) {
                showToastrAnomalGraph();
            }

            if (res.actual_record_number > SQL_LIMIT) {
                showToastrMsg(i18n.SQLLimit, i18n.warningTitle);
            }

            // show toastr to inform result was truncated upto 5000
            if (res.is_res_limited) {
                showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'), i18n.warningTitle);
            }

            if (isShowMessage) {
                showToastrMsg(i18n.highSpeedMsg, '');
            }
            multipleScatterPlot(res);

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);
            // check and do auto-update
            longPolling();

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);

            if (res.actual_record_number >= CONTOUR_MAX) {
                showToastrMsg(i18n.hideContourMsg, i18n.warningTitle);
            }

            // hide loading inside ajax
            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

            // export mode
            handleZipExport(res);
        },
        error: (res) => {
            // Hide loading screen
            loadingHide();
            errorHandling(res);

            // export mode
            handleZipExport(res);
        },
    }).then(() => {
        loadingHide();
        afterRequestAction();
    });
    $('#plot-cards').empty();
};

// get correlation between 2 variables
const getCorrFromDat = (cId, data) => {
    const ri = cId[cId.length - 1] - 1;
    const rk = cId[cId.length - 2] - 1;
    const colID = data.array_plotdata[ri].end_col_id;
    const rowID = data.array_plotdata[rk].end_col_id;
    return {
        corr: data.corrs.corr[colID] ? data.corrs.corr[colID][rowID] : 0,
        pcorr: data.corrs.pcorr[colID] ? data.corrs.pcorr[colID][rowID] : 0,
        ntotal: data.corrs.pcorr[colID] ? data.corrs.ntotals[colID] : 0,
        length: data.actual_record_number,
    };
};

const getPlotData = (cId, data) => {
    const ri = cId[cId.length - 1];
    const rk = cId[cId.length - 2];
    return {
        xArr: data.array_plotdata[ri - 1].array_y,
        yArr: data.array_plotdata[rk - 1].array_y,
    };
};

const getThresholdData = (cId, data, scaleInfo) => {
    const ri = cId[cId.length - 1];
    const rk = cId[cId.length - 2];
    const iDataIdx = parseInt(ri) - 1;
    const kDataIdx = parseInt(rk) - 1;

    const rowData = data.array_plotdata[iDataIdx];
    const colData = data.array_plotdata[kDataIdx];

    const iChartInfos = rowData.chart_infos || [];
    const iChartInfosOrg = rowData.chart_infos_org || [];
    const kChartInfos = colData.chart_infos || [];
    const kChartInfosOrg = colData.chart_infos_org || [];
    const [iChartInfo, _1] = chooseLatestThresholds(iChartInfos, iChartInfosOrg);
    const [kChartInfo, _2] = chooseLatestThresholds(kChartInfos, kChartInfosOrg);
    const xScaleOption = getScaleInfo(rowData, scaleInfo);
    const yScaleOption = getScaleInfo(colData, scaleInfo);


    return {
        procThresholds: {
            xMin: iChartInfo['prc-min'],
            xMax: iChartInfo['prc-max'],
            yMin: kChartInfo['prc-min'],
            yMax: kChartInfo['prc-max'],
        },
        uclThresholds: {
            xMin: iChartInfo['thresh-low'],
            xMax: iChartInfo['thresh-high'],
            yMin: kChartInfo['thresh-low'],
            yMax: kChartInfo['thresh-high'],
        },
        rowRange: {
            rowMin: xScaleOption['y-min'],
            rowMax: xScaleOption['y-max'],
        },
        colRange: {
            colMin: yScaleOption['y-min'],
            colMax: yScaleOption['y-max'],
        },
    };
};

const longPolling = () => {
    if (shouldChartBeRefreshed()) {
        const source = openServerSentEvent();
        source.addEventListener(serverSentEventType.procLink, (event) => {
            autoUpdateCharts();
        }, false);
    }
};

const showContour = () => {
    // show loading screen
    loadingShow();
    const showContourOption = formElements.switchContour.is(':checked') ? 1 : 0;
    const formData = lastestFormData;
    formData.set('use_contour', showContourOption);
    scatterTraceData(formData, false);
};

const shortenName = (name, byteLimit = 10) => {
    let trimmedName = '';
    let countByte = 0;
    for (const char of name) {
        const { size } = new Blob([char]);
        if (countByte + size <= byteLimit) {
            trimmedName += char;
            countByte += size;
        } else {
            break;
        }
    }
    trimmedName += '...';
    return trimmedName;
};
