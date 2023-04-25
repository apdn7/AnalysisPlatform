/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_END_PROC = 7;
const MIN_END_PROC = 2;
let tabID = null;
let resultData = null;
const graphStore = new GraphStore();
let xScaleOption = scaleOptionConst.SETTING;
let yScaleOption = scaleOptionConst.SETTING;

const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
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
    selectRemoveOutlierInChart: $('select[name=remove_outliers]'),
    showHeatmapInput: $('#showHeatmapInput'),
    xScale: $('select[name=XScaleOption]'),
    yScale: $('select[name=YScaleOption]'),
};

const i18n = {
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    hideContourMsg: $('#i18nHideContourMSG').text(),
    default: $('#partNoDefaultName').text() || 'Default',
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
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        isRequired: true,
    });
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
            // with show heatmap
            const showHeatmap = formElements.showHeatmapInput.is(':checked') ? 1 : 0;
            resultData.show_heatmap = showHeatmap;
            const isCurrentShowContour = formElements.switchContour.is(':checked');
            if (isCurrentShowContour) {
                lastUsedFormData.set('new_array_formval', JSON.stringify(newPlots))
                scatterTraceData(lastUsedFormData);
            } else {
                lastUsedFormData.delete('new_array_formval')
                multipleScatterPlot(resultData, false);
                loadingHide();
            }
        },
    });
});

const loading = $('.loading');

const collectFormDataMSP = () => {
    let formData = collectFormData(formElements.formID);
    formData = genDatetimeRange(formData);
    return formData;
};

const mspTracing = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ min: MIN_END_PROC, max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        formElements.switchContour.prop('checked', false);
        formElements.xScale.val(scaleOptionConst.SETTING);
        formElements.yScale.val(scaleOptionConst.SETTING);

        // clear old chart
        $('#sctr-card').html('');

        const formData = collectFormDataMSP();

        // set default remove_outliers
        formElements.selectRemoveOutlierInChart.val(formData.get('remove_outlier'));

        // set use contour
        const showContourOption = formElements.switchContour.is(':checked') ? 1 : 0;
        formData.set('use_contour', showContourOption);
        lastUsedFormData = formData;
        scatterTraceData(formData, true);
    }
};

const calculateMaxCorr = (data) => {
    const corr = data.corrs && data.corrs.corr;
    const corrArr = [0];
    if (corr && Object.keys(corr).length > 0) {
        for (const id in corr) {
            if (corr[id] && Object.keys(corr[id]).length > 0) {
                for (const id2 in corr[id]) {
                    if (id !== id2) {
                        corrArr.push(Math.abs(Number(corr[id][id2])));
                    }
                }
            }
        }
    }
    return Math.max(...corrArr);
};

const multipleScatterPlot = (data, clearOnFlyFilter = true) => {
    // save global
    graphStore.setTraceData(_.cloneDeep(data));
    // share global var to base.js
    formDataQueried = lastUsedFormData;
    const sensors = data.array_plotdata;
    const showHeatmap = data.show_heatmap;
    mspData = data.scatter_contour;

    // calculate chart dimensions
    const plotDataCount = sensors.length;
    const canvasSize = 100 / plotDataCount;
    const startProc = data.COMMON.start_proc;
    const maxCorr = calculateMaxCorr(data);

    // update heatmap input
    if (clearOnFlyFilter) {
        formElements.showHeatmapInput.prop('checked', showHeatmap);
        formElements.showHeatmapInput.prop(CONST.DEFAULT_VALUE, showHeatmap);
    }

    $('#sctr-card').html('');
    sensors.forEach((_pd, k) => {
        let row = `<div class="chart-row" data-pos=${k}>`;
        const endProc = _pd.end_proc_id;
        for (let i = 0; i < plotDataCount; i++) {
            const iProcId = sensors[i].end_col_id;
            const kProcId = sensors[k].end_col_id;
            if (i === k) {
                if (String(endProc) === String(startProc)) {
                    row += `<div class="hist-item chart-column-border graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="hist-${kProcId}-${iProcId}" style="width: 99%;height: 100%"></div></div>`;
                } else {
                    row += `<div class="hist-item chart-column graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="hist-${kProcId}-${iProcId}" style="width: 99%;height: 100%"></div></div>`;
                }
            } else if (i > k) {
                row += `<div class="coef-item chart-column graph-navi p-2 d-flex flex-column justify-content-center align-items-center"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <p class="coef-text m-0" id="coef-${kProcId}-${iProcId}"></p></div>`;
            } else if (i < k) {
                row += `<div class="sctr-item chart-column graph-navi"
                    style="width:${canvasSize}%;height:calc(${canvasSize}vh - 1em);">
                    <div class="center" id="sctr-${kProcId}-${iProcId}" style="width: 99%;height: 100%"></div></div>`;
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
        const ypd = Number(cId[1]);
        const plotData = sensors.filter(val => val.end_col_id === ypd)[0];
        const scaleInfo = getScaleInfo(plotData, xScaleOption);
        const xrange = [scaleInfo['y-min'], scaleInfo['y-max']];
        const { xThreshold } = getThresholdData(cId, data, xScaleOption, yScaleOption);

        const procId = data.ARRAY_FORMVAL[k].end_proc;
        const colId = data.ARRAY_FORMVAL[k].GET02_VALS_SELECT;
        const procInfo = procConfigs[procId];
        const procName = procInfo.name;
        const colName = procInfo.getColumnById(colId).name;
        const chartLabel = `${procName} ${colName}`;

        const [histTrace, fmt] = genHistogramTrace(plotData, xScaleOption);
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
        const histLayout = { ...genHistogramLayout(xrange, false, fmt), ...gridlayout };

        const maxHistNum = Math.max(...scaleInfo.kde_data.hist_counts);
        const layoutWithThresholds = addHistogramThresholds(
            histLayout,
            maxHistNum,
            scaleInfo.kde_data.hist_labels,
            xThreshold,
        );

        Plotly.react(hisChartID, histTrace, layoutWithThresholds, graphCfg);
        const histPlot = document.getElementById(hisChartID);
        histPlot.on('plotly_hover', (data) => {
            showInforTbl(data, false, hisChartID);
        });
        unHoverHandler(histPlot);
    });

    // Correlation COEF
    $('.coef-item p').each((_k, corrDom) => {
        const cId = $(corrDom).attr('id').split('-');
        const corr = getCorrFromDat(cId, data);
        const corrValue = corr.corr ? applySignificantDigit(corr.corr) : 0;
        const pcorrValue = corr.pcorr ? applySignificantDigit(corr.pcorr) : 0;
        const corrInfor = `<span>${formElements.i18nMSPCorr}: ${corrValue}</span>
            <span>${formElements.i18nPartialCorr}: ${pcorrValue}</span>
            <span>N: ${applySignificantDigit(corr.ntotal || 0) || 0}</span>`;
        $(corrDom).html(corrInfor);
        const backgroundColor = getColorFromScale(Math.abs(corr.corr), maxCorr);
        $(corrDom).parent().attr(CONST.BGR_COLOR_ATTR, backgroundColor);
        if (showHeatmap) {
            $(corrDom).parent().css('background-color', backgroundColor);
        }
    });

    loadingUpdate(80);

    // Scatter Plot
    const scatterContourData = data.scatter_contour || [];

    const defaultShowContour = data.is_show_contour_only;
    formElements.switchContour.attr('disabled', defaultShowContour);
    formElements.switchContour.attr(CONST.DEFAULT_VALUE, defaultShowContour);
    if (defaultShowContour) {
        formElements.switchContour.prop('checked', true);
    }

    const showContourOption = formElements.switchContour.is(':checked');

    $('.sctr-item div.center').each((k, sct) => {
        const sctChartID = $(sct).attr('id');
        const cId = sctChartID.split('-');
        // background color
        const corr = getCorrFromDat(cId, data);
        const backgroundColor = getColorFromScale(Math.abs(corr.corr), maxCorr);
        const showColor = showHeatmap ? backgroundColor : CONST.BGR_COLOR;
        $(sct).attr(CONST.BGR_COLOR_ATTR, backgroundColor);
        if (showHeatmap) {
            $(sct).css('background-color', backgroundColor);
            $(sct).css('border-color', backgroundColor);
        }

        const sctData = getScatterContourData(cId, scatterContourData);

        const {
            xThreshold, yThreshold, yRange, xRange,
        } = getThresholdData(cId, data, xScaleOption, yScaleOption);
        const cycleIDs = sctData.scatter_data.cycle_ids || [];
        const serials = sctData.scatter_data.serials || [];
        const datetime = sctData.scatter_data.datetime || [];
        const options = {
            serials,
            datetime,
            start_proc_id: Number(data.COMMON.start_proc),
            start_proc_name: data.start_proc,
            thresholds: {
                x: xThreshold,
                y: yThreshold,
            },
        };
        const scatterTrace = genScatterOutlierTrace(sctData, showContourOption,
            data.proc_name, cycleIDs,
            options);
        let sctTraces = [scatterTrace];
        if (showContourOption) {
            const contourTrace = genContourTrace(sctData, options);
            sctTraces = [contourTrace, scatterTrace];
        }

        const scatterData = sctData.scatter_data;
        const {x_fmt, y_fmt} = scatterData;
        let sctLayout = genScatterContourLayout(showColor, x_fmt || '', y_fmt || '');
        sctLayout.shapes = genThresholds(xThreshold, yThreshold, {xaxis: 'x', yaxis: 'y'}, xRange, yRange);
        sctLayout = addAxisRange(sctLayout, xRange, yRange);
        sctLayout.xaxis.ticklen = 0;
        sctLayout.yaxis.ticklen = 0;
        const sctPlot = document.getElementById(sctChartID);
        Plotly.react(sctChartID, sctTraces, sctLayout, graphCfg);
        sctPlot.on('plotly_hover', (data) => {
            const dpIndex = getDataPointIndex(data);
            const dataPoint = data.points[0];
            const xValue = applySignificantDigit(dataPoint.data.x[dpIndex]);
            const yValue = applySignificantDigit(dataPoint.data.y[dpIndex]);
            const zValue = 'z' in dataPoint.data ? applySignificantDigit(dataPoint.data.z[dpIndex]) : null;
            const datetime = dataPoint.data.customdata.datetime[dpIndex];
            const serials = dataPoint.data.customdata.serials.map(serial => serial[dpIndex]) || [];
            const suffixLabel = dataPoint.data.customdata.suffix_label || '';
            const thresholds = dataPoint.data.customdata.thresholds;
            showMSPDataTable(
                {
                    x: xValue,
                    y: yValue,
                    z: zValue,
                    datetime,
                    serial: serials,
                    suffix_label: suffixLabel,
                    thresholds,
                },
                {
                    x: data.event.pageX - 120,
                    y: data.event.pageY,
                },
                sctChartID,
            );
        });

        unHoverHandler(sctPlot);
        showCustomContextMenu(sctPlot);
    });

    // trigger resize window
    window.dispatchEvent(new Event('resize'));

    $('#sctr-card').show();
    $('#showContour').show();

    if (clearOnFlyFilter) {
         $('html, body').animate({
            scrollTop: $('#sctr-card').offset().top,
        }, 1500);
    }
};

const scatterTraceData = (formData, clearOnFlyFilter = false) => {
    if (!checkDisableScatterBtn()) {
        loadingHide();
        return;
    }

    showGraphCallApi('/ap/api/msp/plot', formData, REQUEST_TIMEOUT, async (res) => {
        resultData = res;

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
            showToastrMsg(i18n.SQLLimit);
        }

        // show toastr to inform result was truncated upto 5000
        if (res.is_res_limited) {
            showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'));
        }

        multipleScatterPlot(res);

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        // check and do auto-update
        longPolling(formData, () => {
            scatterTraceData(lastUsedFormData);
        });

        if (res.is_show_contour_only) {
            showToastrMsg(i18n.hideContourMsg);
        }
    });

    $('#plot-cards').empty();
};

// get correlation between 2 variables
const getCorrFromDat = (cId, data) => {
    const [_, colID, rowID] = cId;
    return {
        corr: data.corrs.corr[colID] ? data.corrs.corr[colID][rowID] : 0,
        pcorr: data.corrs.pcorr[colID] ? data.corrs.pcorr[colID][rowID] : 0,
        ntotal: data.corrs.pcorr[colID] ? data.corrs.ntotals[colID][rowID] : 0,
        length: data.actual_record_number,
    };
};

const getThresholdData = (cId, data, xScale, yScale) => {
    // i -> row
    // k -> col
    const rowId = Number(cId[2]);
    const colId = Number(cId[1]);

    const rowData = data.array_plotdata.filter(val => val.end_col_id === rowId)[0];
    const colData = data.array_plotdata.filter(val => val.end_col_id === colId)[0];

    const iChartInfos = rowData.chart_infos || [];
    const iChartInfosOrg = rowData.chart_infos_org || [];
    const kChartInfos = colData.chart_infos || [];
    const kChartInfosOrg = colData.chart_infos_org || [];
    const [iChartInfo, _1] = chooseLatestThresholds(iChartInfos, iChartInfosOrg);
    const [kChartInfo, _2] = chooseLatestThresholds(kChartInfos, kChartInfosOrg);
    const xScaleInfo = getScaleInfo(rowData, xScale);
    const yScaleInfo = getScaleInfo(colData, yScale);

    return {
        xRange: [xScaleInfo['y-min'], xScaleInfo['y-max']],
        yRange: [yScaleInfo['y-min'], yScaleInfo['y-max']],
        xThreshold: iChartInfo,
        yThreshold: kChartInfo,
    };
};

const showContour = () => {
    // show loading screen
    loadingShow();
    const showContourOption = formElements.switchContour.is(':checked') ? 1 : 0;
    const formData = lastUsedFormData;
    const showHeatmap = formElements.showHeatmapInput.is(':checked') ? 1 : 0;
    formData.set('use_contour', showContourOption);
    formData.set('use_heatmap', showHeatmap);
    scatterTraceData(formData);
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

const mspOutlierHandling = (e) => {
    // show loading screen
    loadingShow();

    if (lastUsedFormData) {
        const outlier_handler = $(e).val() || 0;
        lastUsedFormData.set('remove_outlier', outlier_handler);
        scatterTraceData(lastUsedFormData);
    }
};

const showMSPHeatmap = () => {
    // show loading screen
    loadingShow();
    const showHeatmap = formElements.showHeatmapInput.is(':checked');
    setTimeout(() => {
        // update scatter background
        $('.sctr-item div.center').each((k, sct) => {
            const sctChartID = $(sct).attr('id');
            if (sctChartID) {
                const sctPlot = document.getElementById(sctChartID);
                const bgrColor = $(sct).attr(CONST.BGR_COLOR_ATTR) || CONST.BGR_COLOR;
                const paperBgr = !showHeatmap ? CONST.BGR_COLOR : bgrColor;
                Plotly.relayout(sctPlot, {
                    paper_bgcolor: paperBgr,
                });
            }
        });
        // update correlation background
        $('.coef-item').each((_k, corrDom) => {
            const bgrColor = $(corrDom).attr(CONST.BGR_COLOR_ATTR) || CONST.BGR_COLOR;
            const paperBgr = !showHeatmap ? CONST.BGR_COLOR : bgrColor;
            $(corrDom).css(CONST.BGR_COLOR_KEY, paperBgr);
        });
        loadingHide();
    }, 1000);
};

const handleChangeScaleOption = (type = 'x', e) => {
    if (type === 'x') {
        xScaleOption = $(e).val();
    } else {
        yScaleOption = $(e).val();
    }

    if (resultData) {
        multipleScatterPlot(resultData, false);
    }
};

const dumpData = (type) => {
    const formData = collectFormDataMSP();
    handleExportDataCommon(type, formData);
};
const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};