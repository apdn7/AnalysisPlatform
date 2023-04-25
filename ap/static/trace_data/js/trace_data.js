/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();

const MAX_NUMBER_OF_GRAPH = 20;
const MAX_END_PROC = 20;
let tabID = null;
const graphStore = new GraphStore();
let isValid = false;
let xAxisShowSettings;
let availableOrderingSettings = {};
let isShowIndexInGraphArea = false;
let updateOrderCols = false;

const formElements = {
    formID: '#traceDataForm',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    endProcCateSelectedItem: '#end-proc-cate-row select',
    condProcReg: /cond_proc/g,
    NO_FILTER: 'NO_FILTER',
    lastUpdateTimeLabel: '#lastUpdateTimeLabel',
    lastUpdateTime: '#lastUpdateTime',
    histograms: 'Histograms',
    frequencyScale: 'frequencyScale',
    summaryOption: 'summaryOption',
    plotInfoId: 'PlotDetailInfomation',
    histPlotCards: '#hist-cards',
    tsPlotCards: '#plot-cards',
    traceDataTabs: '#traceDataTabs',
    currentscaleOption: '#currentscaleOption',
    yScaleOption: 'select[name=yScaleOption]',
    cateTable: '#cateTable',
    cateTableLabel: '#cateTableLabel',
    cateCard: '#cate-card',
    showScatterPlotSelect: '#showScatterPlotSelect',
    timeSeriestabMenu: '#timeSeriestabMenu',
    startProc: 'select[name=start_proc]',
    xOption: '#xOption',
    serialTable: '#serialTable',
    serialTable2: '#serialTable2',
    btnAddSerial: '#btnAddSerial',
    btnAddSerial2: '#btnAddSerial2',
    serialTableModal: '#xAxisModal',
    serialTableModal2: '#xAxisModal2',
    indexOrderSwitch: '#indexOrderSwitch',
    tsXScale: 'select[name=XAxisOrder]',
    okOrderIndexModal: '#btnXAxisModalOK2',
    cancelOrderIndexModal: '.btnXAxisModalCancel2',
    menuTS: $('#contextMenuTimeSeries'),
    menuScale: $('#contextMenuGraphScale'),
    settingHoverContent: '#settingHoverContent',
    showGraphBtnId: 'showTraceDataGraph',
    histogramTab: '#histogramsTab',
    labelPlotContextMenu: '#showAnchorLabelPlotContextMenu',
    duplicatedSerial: '#duplicatedSerialTemp',
    timeSeriesPlotView: '#timeSeriesPlotView',
};

const i18n = {
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    frequence: $('#i18nFrequence').text(),
    lastUpdateTime: $('#i18nLastUpdateTime').text(),
    SQLLimit: $('#i18nSQLLimit').text(),
    value: $('#i18nValue').text(),
    medianVal: $('#i18nMedianVal').text(),
    outlierVal: $('#i18nOutlierVal').text(),
    maxVal: $('#i18nMaxVal').text(),
    minVal: $('#i18nMinVal').text(),
    count: $('#i18nCount').text(),
    startTime: $('#i18nStartTime').text(),
    endTime: $('#i18nEndTime').text(),
    yLabelKDE: $('#i18nKDE').text() || 'i18nKDE', // TODO
    yLabelFreq: $('#i18nFrequency').text() || 'i18nFrequency',
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    hideNarrowBox: $('#i18nHideNarrowBox').text() || '',
    priority: $('#i18nPriority').text() || '',
    ascending: $('#i18nAscending').text() || '',
    descending: $('#i18nDescending').text() || '',
    nonNARatio: $('#i18nNonNARatio').text() || '',
    variable: $('#i18nVariable').text(),
    process: $('#i18nProcess').text(),
    dateTime: $('#i18nDateTime').text() || '',
    serial: $('#i18nSerial').text() || '',
    filterType: $('#i18nType').text() || '',
    filterName: $('#i18nName').text() || '',
    threshLow: $('#i18nLCL').text() || '',
    threshHigh: $('#i18nUCL').text() || '',
    prcMin: $('#i18nPrcMin').text() || '',
    prcMax: $('#i18nPrcMax').text() || '',
    validFrom: $('#i18nValidFrom').text() || '',
    validTo: $('#i18nValidTo').text() || '',
    default: $('#partNoDefaultName').text() || 'Default',
    timestamp: $('#i18nTimestamp').text() || 'Default',
    index: $('#i18nIndex').text() || 'Default',
    cannotBeDisplayed: $('#i18nCannotBeDisplayed').text() || 'Cannot be displayed',
    thinDataShown: $('#i18nThinDataShown').text(),
    catLimitMsg: $('#i18nCatLimitedMsg').text().split('BREAK_LINE'),
    overUniqueLimitLabel: $('#i18nOverUniqueLimitLabel').text(),
    overUniqueLimitWarning: $('#i18nOverUniqueLimitWarning').text(),
    overUniqueLimitRequest: $('#i18nOverUniqueLimitRequest').text(),
    attribute: $('#i18nAttribute').text(),
    limit: $('#i18nLimit').text(),
    procLimit: $('#i18nProcLimit').text(),
};

const updateIndexInforTable = () => {
    const serialTable = $('#serialTable tbody');
    $('#index-infor-table tbody').empty();
    let indexTbodyDOM = '';
    serialTable.find('tr').each((key, tr) => {
        indexTbodyDOM += '<tr>';
        const tdDOM = $(tr).find('td');
        indexTbodyDOM += `<td>${$(tdDOM[0]).text()}</td>`;
        indexTbodyDOM += `<td>${$(tdDOM[1]).find('select[name="serialProcess"] option:selected').text()}</td>`;
        indexTbodyDOM += `<td>${$(tdDOM[2]).find('select[name="serialColumn"] option:selected').text()}</td>`;
        indexTbodyDOM += `<td>${$(tdDOM[3]).find('select[name="serialOrder"] option:selected').text()}</td>`;
        indexTbodyDOM += '</tr>';
    });
    $('#index-infor-table tbody').append(indexTbodyDOM);
};
const triggerSerialTableEvents = () => {
    $('.index-inform').unbind('mouseenter').on('mouseenter', () => {
        $('.index-inform-content').show();
        updateIndexInforTable();
    });

    $('.index-inform-content').on('mouseleave', () => {
        $('.index-inform-content').hide();
    });
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

    // generate process dropdown data
    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp:  true,
        isRequired: true,
        showLabels: true,
    });
    endProcItem();

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID.replace('#', ''),
        'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $('#btn-add-cond-proc').click(() => {
        condProcItem();
        addAttributeToElement();
    });

    // cardRemovalByClick();

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // on-change x-axis
    setTimeout(() => {
        bindXAxisEvents();
    }, 1000);

    // support floating category table
    scrollCategoryTable.load($(formElements.cateCard));
    $(formElements.timeSeriestabMenu).click((e) => {
        e.preventDefault();
        // reset floating position
        resetCateogryTablePosition();

        // adjust length
        setTimeout(() => {
            adjustCatetoryTableLength();
        }, 200);
    });

    // onChange Y scale function
    onChangeYScale();

     // on select histogam y-scale option
    $(`select[name=${formElements.frequencyScale}]`).off('change');
    $(`select[name=${formElements.frequencyScale}]`).on('change', function (e) {
        const frequencyOption = e.currentTarget.value;
        const scaleOption = $(formElements.yScaleOption).val();

        const currentTraceData = graphStore.getTraceData();
        // TODO: should update than re-draw
        drawHistogramsTab(currentTraceData, scaleOption, false, frequencyOption);
        // updateHistogramWhenChaneScale(scaleOption);
    });

    // set copy clipboard for setting information
    clipboardInit();

    // show index information box
    showIndexInforBox();

    triggerSerialTableEvents();

    // validation required input
    initValidation(formElements.formID);

    initializeDateTimeRangePicker();

    startProcChangeEvents();
    initCustomSelect();
});



const endProcCateOnChange = async (count) => {
    const selectedProc = $(`#end-proc-cate-process-${count}`).val();
    const procInfo = procConfigs[selectedProc];

    // remove old elements
    $(`#end-proc-cate-val-${count}`).remove();
    if (procInfo == null) {
        updateSelectedItems(isCategoryItem = true);
        return;
    }
    const ids = [];
    const vals = [];
    const names = [];
    const checkedIds = [];
    await procInfo.updateColumns();
    const columns = procInfo.getColumns();

    // eslint-disable-next-line no-restricted-syntax
    const parentId = `end-proc-cate-val-div-${count}`;
    for (const col of columns) {
        if (CfgProcess_CONST.CATEGORY_TYPES.includes(col.data_type)) {
            ids.push(col.id);
            vals.push(col.column_name);
            names.push(col.name);
        }
    }

    // load machine multi checkbox to Condition Proc.
    if (ids) {
        addGroupListCheckboxWithSearch(
            parentId,
            `end-proc-cate-val-${count}`,
            '',
            ids,
            vals,
            {
                checkedIds,
                name: `GET02_CATE_SELECT${count}`,
                itemNames: names
            }
        );
    }
    updateSelectedItems(isCategoryItem = true);
};

const autoScrollToChart = (milisec = 100) => {
    // Move screen to graph after pushing グラフ表示 button
    loadingHide();
    $('html, body').animate({
        scrollTop: $(formElements.traceDataTabs).offset().top + 15,
    }, milisec);
};

const buildTimeSeriesCardHTML = (chartOption, cssName) => {
    const { index } = chartOption;
    const { endProcName } = chartOption;
    const { sensorName } = chartOption;
    const { getProc } = chartOption;
    const { getVal } = chartOption;
    const { catExpBox } = chartOption;
    const graphCanvasHTML = buildGraphContainerHTML(chartOption);
    const { allSummaryData } = chartOption;
    const { latestChartInfoIdx } = chartOption;
    const { startProc } = chartOption;
    const { beforeRankValues } = chartOption;
    const { stepChartSummary } = chartOption;
    const { isCTCol } = chartOption;

    const generalInfo = {
        getProc, getVal, startProc, endProcName, catExpBox,
    };
    const summaryResultsHTMLs = [];
    allSummaryData.forEach((summaryOption, idx) => {
        const summaryResultsHTML = buildTimeSeriesSummaryResultsHTML(summaryOption, idx, generalInfo, beforeRankValues, stepChartSummary, isCTCol);
        const display = `${latestChartInfoIdx}` === `${idx}` ? 'display:block;' : 'display:none;';
        summaryResultsHTMLs.push(`<div id="summary-${idx}" class="summary summary-${idx}" style="${display} width: calc(100% + 25px);">
                                ${summaryResultsHTML}
                                </div>`);
    });

    const cardHtml = `<div class="row chart-row graph-navi" id="area${index}"
                proc="${endProcName}" sensor="${sensorName}">
                <div class="cursor-hint"></div>
                <div class="${cssName} shadow-sm">
                    <div class="card-body">
                        <span class="btn-anchor"
                            data-pinned="false"
                            onclick="pinTSChart('area${index}');"><i class="fas fa-anchor"></i></span>
                        <div class="d-flex">
                            <div class="summary-col">
                                <div class="row justify-content-center">
                                    <div>
                                        ${summaryResultsHTMLs.join('')}
                                    </div>
                                </div>
                            </div>
                            <div class="col-sm-12 ts-col no-padding">
                                <div class="d-flex">
                                    ${graphCanvasHTML}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    return cardHtml;
};

const cleanOldChartsAndResults = () => {
    graphStore.setClickedPointIndexes(new Set());
    graphStore.destroyAllGraphInstances();

    // clean old htmls
    $(formElements.cateCard).empty();
    $(formElements.cateCard).removeClass('pinned');
    $(formElements.tsPlotCards).empty();
    $(formElements.histPlotCards).empty();
};

const calcContainerWidth = (showScatterPlot = false) => {
    // divide charts spaces if user choose to show scatter plot or not: bootstrap no.col=12
    let cols = {
        timeSeries: 9,
        histogram: 3,
        scatterPlot: 0,
    };

    if (showScatterPlot) {
        cols = {
            timeSeries: 8,
            histogram: 2,
            scatterPlot: 2,
        };
    }
    return cols;
};

const buildGraphContainerHTML = (chartOption) => {
    const { numCards } = chartOption;
    const { endProcName } = chartOption;
    const { sensorName } = chartOption;
    const { index } = chartOption;
    const { tsCanvasId } = chartOption;
    const { histCanvasId } = chartOption;
    const { whiskerCanvasId } = chartOption;
    const { sctrCanvasId } = chartOption;
    const { showScatterPlot } = chartOption;
    const { chartCols } = chartOption;
    const { getVal } = chartOption;
    const { catExpBox } = chartOption;
    const { dicScatterXY } = chartOption;
    const { beforeRankValues } = chartOption;
    const { isCTCol } = chartOption;
    let graphCanvasHTML = '';
    let catExpBoxHTML = '';

    let CTLabel = '';
    if (isCTCol) {
        CTLabel = `(${DataTypes.DATETIME.short}) [sec]`;
    }
    if (checkTrue(catExpBox)) {
        const hasLevel2 = catExpBox.toString().split('|').length === 2;
        catExpBoxHTML = `<span class="show-detail cat-exp-box" title="${hasLevel2 ? 'Level1 | Level2' : 'Level1'}">${catExpBox}</span>`;
    }

    graphCanvasHTML += `
        <div class="tschart-title-parent">
            <div class="tschart-title">
                <span title="${procConfigs[endProcName].name}">${procConfigs[endProcName].name}</span>
                <span title="${getVal}">${getVal} ${CTLabel}</span>
                ${catExpBoxHTML}
             </div>
        </div>
        <div class="row flex-grow-1">
        <div class="col-sm-${chartCols.timeSeries} td-chart-container no-padding time-series"
            id="${tsCanvasId}Outer">
            <canvas id="${tsCanvasId}" chart-type="timeSeries" plotdata-index="${index - 1}" style="" ></canvas>
        </div>`;

    const whiskerCanvasHTML = `
        <canvas id="${whiskerCanvasId}" chart-type="whisker"></canvas>
        <div id="${whiskerCanvasId}Hover" class="whisker-hover" summary-index="-1" style="display: block">
            <div>
                <table>
                    <tbody>
                        <tr>
                          <td>Upper whisker</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Q3 P75</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Median</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Q1 P25</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Lower whisker</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>IQR</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>NIQR</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Mode</td>
                          <td>:</td>
                        </tr>
                    </tbody>
                </table>
                <table>
                    <tbody>
                        <tr>
                          <td>Upper whisker</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>P75</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>P50</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>P25</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Lower whisker</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>IQR</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>NIQR</td>
                          <td>:</td>
                        </tr>
                        <tr>
                          <td>Mode</td>
                          <td>:</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;


    const colSize = chartCols.histogram;

    graphCanvasHTML += `
        <div class="col-sm-${colSize} td-chart-container no-padding">
            <div class="row" style="display: -webkit-box; margin-left: 15px">
                <div class="col-sm-4 no-padding whisker">${whiskerCanvasHTML}</div>
                <div class="col-sm-8 no-padding histogram">
                    <canvas id="${histCanvasId}" chart-type="histogram" plotdata-index="${index - 1}"></canvas>
                </div>
            </div>
        </div>`;
    if (showScatterPlot && dicScatterXY[index - 1]) {
        const [x, y] = dicScatterXY[index - 1];

        // scatter plot container div. y-axis is for sensor_i, x-axis is for the next sensor
        graphCanvasHTML += `
        <div class="col-sm-${chartCols.scatterPlot} td-chart-container no-padding ">
            <canvas id="${sctrCanvasId}" chart-type="scatter"
                class="sctr-plot-ts" x-sensor-idx="${x}" y-sensor-idx="${y}"></canvas>
        </div>
        </div>`;
    }

    return graphCanvasHTML;
};
const produceExceptionArrayY = (plotdata, yMin, yMax, unlinkedIdxs, noneIdxs, infIdxs, negInfIdxs, negOutlierIdxs, outlierIdxs) => {
    const arrayYEx = new Array(plotdata.length).fill(null);
    const plotDataExColor = new Array(plotdata.length).fill(null);

    for (const idx of infIdxs || []) {
        arrayYEx[idx] = yMax;
        plotDataExColor[idx] = CONST.COLOR_INF;
    }

    for (const idx of negInfIdxs || []) {
        arrayYEx[idx] = yMin;
        plotDataExColor[idx] = CONST.COLOR_INF;
    }
    for (const idx of noneIdxs || []) {
        arrayYEx[idx] = yMax;
        plotDataExColor[idx] = CONST.COLOR_NONE;
    }
    for (const idx of outlierIdxs || []) {
        arrayYEx[idx] = plotdata[idx] > yMax ? yMax : plotdata[idx];
        plotDataExColor[idx] = CONST.COLOR_OUTLIER;
    }
    for (const idx of negOutlierIdxs || []) {
        arrayYEx[idx] = plotdata[idx] < yMin ? yMin : plotdata[idx];
        plotDataExColor[idx] = CONST.COLOR_OUTLIER;
    }
    for (const idx of unlinkedIdxs || []) {
        arrayYEx[idx] = yMin;
        plotDataExColor[idx] = CONST.COLOR_UNLINKED;
    }
    return { arrayYEx, plotDataExColor };
};

const getStartEndPoint = (xAxisOption = 'TIME', timesLength = 20, data = {}) => {
    if (xAxisOption === 'INDEX') {
        return [0, Math.max(20, timesLength)];
    }

    const startDateTime = moment.utc(`${data.COMMON.START_DATE} ${data.COMMON.START_TIME}`).local().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    const endDateTime = moment.utc(`${data.COMMON.END_DATE} ${data.COMMON.END_TIME}`).local().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    return [startDateTime, endDateTime];
};


const convertToIndex = (times, chartInfo, startPoint, endPoint) => {
    const actFrom = chartInfo['act-from'];
    const actTo = chartInfo['act-to'];
    let fromIndex = startPoint;
    if (!isEmpty(actFrom)) {
        fromIndex = binarySearch(times, createDatetime(actFrom), (x, y) => (x - y)) + 1;
    }
    let toIndex = endPoint;
    if (!isEmpty(actTo)) {
        toIndex = binarySearch(times, createDatetime(actTo), (x, y) => (x - y)) + 1;
    }
    const chartInfoCI = _.cloneDeep(chartInfo);
    chartInfoCI['act-from'] = fromIndex;
    chartInfoCI['act-to'] = toIndex;
    return chartInfoCI;
};

const convertChartInfoToIndex = (data) => {
    let times = getNode(data, ['times'], []) || [];
    const [startPoint, endPoint] = getStartEndPoint('INDEX', times.length);
    const len = data.array_plotdata.length;
    times = times.map(x => new Date(x));
    if (!data.array_plotdata) return;
    for (let i = 0; i < len; i++) {
        const chartInfos = data.array_plotdata[i].chart_infos || [];
        const chartInfosOrg = data.array_plotdata[i].chart_infos_org || [];
        data.array_plotdata[i].chart_infos_ci = [];
        data.array_plotdata[i].chart_infos_org_ci = [];
        for (const cIdx in chartInfos) {
            const chartInfo = chartInfos[cIdx];
            const chartInfoCI = convertToIndex(times, chartInfo, startPoint, endPoint);
            data.array_plotdata[i].chart_infos_ci.push(chartInfoCI);

            const chartInfoOrg = chartInfosOrg[cIdx];
            const chartInfoOrgCI = convertToIndex(times, chartInfoOrg, startPoint, endPoint);
            data.array_plotdata[i].chart_infos_org_ci.push(chartInfoOrgCI);
        }
    }
};
const selectScatterXY = (plots) => {
    const dicIdxs = {};
    const validCharts = [];
    for (let i = 0; i < plots.length; i++) {
        if (plots[i].before_rank_values) {
            continue;
        }
        validCharts.push(i);
    }
    for (let i = 0; i < validCharts.length; i++) {
        const idx = validCharts[i];
        dicIdxs[idx] = [validCharts[(i + 1) % validCharts.length], idx];
    }

    return dicIdxs;
};


const traceDataChart = (data, scaleOption = null, clearOnFlyFilter) => {
    if (isEmpty(data)) return;

    const startTime = performance.now();

    // get size of input in bytes
    const sizeOfData = data.data_size;

    // clear old results and charts
    cleanOldChartsAndResults();
    if (!scaleOption) {
        scaleOption = scaleOptionConst.SETTING;
    }
    const isThinData = data.is_thin_data;
    let showScatterPlot;
    if (isThinData) {
        showScatterPlot = false;
        $(formElements.timeSeriesPlotView).hide();
    } else {
        showScatterPlot = $(formElements.showScatterPlotSelect).is(':checked');
        $(formElements.timeSeriesPlotView).show();
    }

    const chartCols = calcContainerWidth(showScatterPlot);

    // update TBLS upon tracing data
    data.TBLS = data.ARRAY_FORMVAL.length;
    // convert time data to local time, local time is applied to all functions
    const times = getNode(data, ['times'], []) || [];
    // data.times = times.map(x => new Date(x)); // array of Date objects, not strings
    data.times = times.map(x => moment.utc(x).toDate()); // convert to localtime

    const xAxisOption = data.COMMON.xOption;
    let [startPoint, endPoint] = getStartEndPoint('TIME', 20, data);
    let convertFunc = createDatetime;
    if (xAxisOption === 'INDEX') {
        [startPoint, endPoint] = getStartEndPoint('INDEX', data.times.length);
        convertFunc = createIndex;
    }
    const dicScatterXY = selectScatterXY(data.array_plotdata);

    const startProc = data.COMMON.start_proc;
    const histObjs = [];
    for (let i = 0; i < data.array_plotdata.length; i++) {
        const formVal = data.ARRAY_FORMVAL[i];
        const formCommon = data.COMMON;
        const arrayY = data.array_plotdata[i].array_y;
        const arrayX = data.array_plotdata[i].array_x;
        const arrayYMin = data.array_plotdata[i].array_y_min;
        const arrayYMax = data.array_plotdata[i].array_y_max;
        const scaleInfo = getScaleInfo(data.array_plotdata[i], scaleOption);
        const unlinkedIdxs = data.array_plotdata[i].unlinked_idxs;
        const noneIdxs = data.array_plotdata[i].none_idxs;
        const infIdxs = data.array_plotdata[i].inf_idxs;
        const negInfIdxs = data.array_plotdata[i].neg_inf_idxs;
        const isCatLimited = data.array_plotdata[i].is_cat_limited || false;

        let beforeRankValues = data.array_plotdata[i].before_rank_values;
        if (beforeRankValues) {
            beforeRankValues = makeDictFrom2Arrays(...beforeRankValues);
        }

        const [dictIdx2YValue, arrayYTS] = buildMapIndex2OutlierYValue(data.array_plotdata[i], scaleInfo);
        const categoryDistributed = beforeRankValues ? data.array_plotdata[i].category_distributed : null;

        // get latest thresholds -> show thresholds in scatter, histogram, summary
        const filterCond = data.array_plotdata[i].catExpBox
            ? (Array.isArray(data.array_plotdata[i].catExpBox)
                ? data.array_plotdata[i].catExpBox : [data.array_plotdata[i].catExpBox])
            : null;
        const [chartInfos, chartInfosOrg] = getChartInfo(data.array_plotdata[i], xAxisOption, filterCond);
        const [latestChartInfo, latestChartInfoIdx] = chooseLatestThresholds(
            chartInfos, chartInfosOrg, null, convertFunc,
        );
        const threshHigh = latestChartInfo['thresh-high'];
        const threshLow = latestChartInfo['thresh-low'];
        const prcMax = latestChartInfo['prc-max'];
        const prcMin = latestChartInfo['prc-min'];

        // y_min/max are defined in backend -> get only
        const kdeData = scaleInfo.kde_data;
        const yMax = scaleOption === scaleOptionConst.THRESHOLD ? scaleInfo['y-max'] + (scaleInfo['y-max'] * 0.1) : scaleInfo['y-max'];
        const yMin = scaleOption === scaleOptionConst.THRESHOLD ? scaleInfo['y-min'] - (scaleInfo['y-min'] * 0.1) : scaleInfo['y-min'];

        const outlierIdxs = scaleInfo.upper_outlier_idxs;
        const negOutlierIdxs = scaleInfo.lower_outlier_idxs;

        // produce exception y-array and color array from y type
        const {
            arrayYEx,
            plotDataExColor,
        } = produceExceptionArrayY(arrayY, yMin, yMax, unlinkedIdxs, noneIdxs, infIdxs, negInfIdxs, negOutlierIdxs, outlierIdxs);

        // マスタが存在するならマスタ情報を適用
        const endProcId = formVal.end_proc;
        const sensorId = formVal.GET02_VALS_SELECT;

        // カラム名を取得する。
        const columnName = getColumnName(endProcId, sensorId);
        let { catExpBox } = data.array_plotdata[i];
        if (catExpBox === null) {
            catExpBox = COMMON_CONSTANT.NA;
        }
        if (typeof (catExpBox) === 'object') {
            catExpBox.map(val => (val === null ? COMMON_CONSTANT.NA : val));
            catExpBox = catExpBox.join(' | ');
        }
        const isCTCol = isCycleTimeCol(endProcId, sensorId);

        const stepChartSummary = data.array_plotdata[i].cat_summary || null;
        const allSummaryData = [];
        for (const summaryIdx in data.array_plotdata[i].summaries) {
            const summaryData = calculateSummaryData(data.array_plotdata[i].summaries, summaryIdx);
            allSummaryData.push(summaryData);
        }


        // get serial for every datapoint
        const chartOption = {
            numCards: data.TBLS,
            index: i + 1, // 1スタート
            tsCanvasId: `chart0${i + 1}`,
            histCanvasId: `hist0${i + 1}`,
            whiskerCanvasId: `whisker0${i + 1}`,
            sctrCanvasId: `sctr0${i + 1}`,
            arrayX: data.times,
            // arrayX: arrayX.map(time => moment.utc(time).toDate()),
            arrayY,
            arrayYMin,
            arrayYMax,
            beforeRankValues,
            arrayYTS,
            arrayYEx,
            dictIdx2YValue,
            plotDataExColor,
            startDate: formCommon.START_DATE,
            startTime: formCommon.START_TIME,
            endDate: formCommon.END_DATE,
            endTime: formCommon.END_TIME,
            endProcName: endProcId,
            sensorName: sensorId,
            getProc: procConfigs[endProcId].name,
            procId: endProcId,
            startProc,
            getVal: columnName,
            catExpBox,
            threshHigh,
            threshLow,
            yMax,
            yMin,
            prcMax,
            prcMin,
            allSummaryData,
            chartCols,
            showScatterPlot,
            chartInfos,
            latestChartInfoIdx,
            dicScatterXY,
            stepChartSummary,
            isCTCol,
        };

        // 起点とターゲット変数工程を比較する。
        // make sure process id is integer number before compare together
        let cardHtml = '';
        if (String(endProcId) === String(startProc)) {
            cardHtml = buildTimeSeriesCardHTML(chartOption, 'card-border-active');
        } else {
            cardHtml = buildTimeSeriesCardHTML(chartOption, 'card');
        }

        // build HTML for each card & append to plot area
        $(formElements.tsPlotCards).append(cardHtml);

        const chartParamObj = {
            canvasId: chartOption.tsCanvasId,
            procId: chartOption.procId,
            tsData: chartOption.arrayX,
            plotData: chartOption.arrayYTS,
            plotDataEx: chartOption.arrayYEx,
            plotDataMin: chartOption.arrayYMin,
            plotDataMax: chartOption.arrayYMax,
            beforeRankValues: chartOption.beforeRankValues,
            dictIdx2YValue: chartOption.dictIdx2YValue,
            plotDataExColor,
            plotLabel: 'センサ値',
            minY: chartOption.yMin,
            maxY: chartOption.yMax,
            chartInfos,
            convertFunc,
            startPoint,
            endPoint,
            isThinData,
            xAxisOption,
            noneIdxs,
            unlinkedIdxs,
            infIdxs,
            negInfIdxs,
            outlierIdxs,
            negOutlierIdxs,
            isCatLimited,
        };

        const histParamObj = {
            canvasId: chartOption.histCanvasId,
            xLabel: i18n.frequence,
            plotData: chartOption.arrayY,
            plotDataEx: chartOption.arrayYEx,
            beforeRankValues: chartOption.beforeRankValues,
            kdeData,
            numBins: 128,
            threshHigh: chartOption.threshHigh,
            threshLow: chartOption.threshLow,
            minY: chartOption.yMin,
            maxY: chartOption.yMax,
            prcMin: chartOption.prcMin,
            prcMax: chartOption.prcMax,
            title: `${procConfigs[endProcId].name} ${columnName}`,
            isThinData,
            categoryDistributed,
            xAxisOption,
            isCatLimited,
        };

        // 今回はAjaxでupdateが必要が無いのでオブジェクトを返さない
        const chartLabels = data.ARRAY_FORMVAL.map(
            fv => `${procConfigs[fv.end_proc].name} ${columnName}`,
        );

        const tsChartObject = YasuTsChart($, chartParamObj, chartLabels, tabID, xaxis = xAxisOption, isStepChart = beforeRankValues);

        const hist = beforeRankValues ? StepBarChart($, histParamObj) : YasuHistogram($, histParamObj);
        histObjs.push(hist.histObj); // TODO need to add comment

        // store just been created graph objects to graph storage
        graphStore.addHistogramObj(chartOption.histCanvasId, hist.chartObject);

        graphStore.addTimeSeriesObj(chartOption.tsCanvasId, tsChartObject);
        graphStore.addHist2TimeSeries(chartOption.histCanvasId, tsChartObject);

        // produce scatter plots
        if (showScatterPlot) {
            const dictCanvas2Scatter = produceScatterPlotCharts(data, scaleOption);
            graphStore.setDctCanvas2Scatter(dictCanvas2Scatter);
        }

        // show summary for latest data point
        const lastDataPointIndex = arrayY.length - 1;
        updateThresholdsOnClick(chartOption.tsCanvasId, lastDataPointIndex);

        // report progress. TODO apply for other pages
        loadingUpdate(loadingProgressBackend + i * ((100 - loadingProgressBackend) / (data.TBLS || 1)));
    }

    // produce categorical table
    produceCategoricalTable(data, options = { chartCols }, clearOnFlyFilter);

    // drag and drop timeseries card to save order + redraw scatter plot
    addTimeSeriesCardSortableEventHandler();

    // add onchange event handlers for summary menu selection
    onChangeSummaryEventHandler(showScatterPlot);

    produceWhiskerPlots(data);

    // draw charts in histogram tab
    drawHistogramsTab(data);

    // TODO add comment
    sessionStorage.setItem(tabID, 'JSON.stringify(histObjs)');

    // send plotting time
    sendGAEvent(startTime, sizeOfData);
};

const sendGAEvent = (startTime, sizeOfData) => {
    // send plotting time
    const endTime = performance.now();
    gtag('event', 'TSP_et', {
        event_category: 'ExecTime',
        event_label: 'JsPlot',
        value: endTime - startTime,
    });

    // send data size
    gtag('event', 'TSP_ds', {
        event_category: 'InputData',
        event_label: 'JsPlot',
        value: sizeOfData,
    });
};


// build histogram tab
const drawHistogramsTab = (data, scaleOption = '1', isReset = true, frequencyOption = frequencyOptions.AUTO) => {
    $(formElements.histPlotCards).empty();
    $(formElements.histPlotCards).css('display', 'block');

    const isThinData = data.is_thin_data;
    const startProc = data.COMMON.start_proc;
    const numChart = data.array_plotdata.length;
    for (let i = 0; i < numChart; i++) {
        const formVal = data.ARRAY_FORMVAL[i];
        const beforeRankValues = data.array_plotdata[i].before_rank_values;
        const plotdata = data.array_plotdata[i] || {};
        const filterCond = data.array_plotdata[i].catExpBox
            ? (Array.isArray(data.array_plotdata[i].catExpBox)
                ? data.array_plotdata[i].catExpBox : [data.array_plotdata[i].catExpBox])
            : null;
        const [chartInfos, chartInfosOrg] = getChartInfo(data.array_plotdata[i], 'TIME', filterCond);
        const [latestChartInfo, latestChartInfoIdx] = chooseLatestThresholds(chartInfos, chartInfosOrg);

        const scaleInfo = getScaleInfo(data.array_plotdata[i], scaleOption);
        // y_min/max are defined in backend -> get only
        const kdeData = scaleInfo.kde_data;
        const [minY, maxY] = calMinMaxYScale(scaleInfo['y-min'], scaleInfo['y-max'], scaleOption)
        const minX = frequencyOption === frequencyOptions.COMMON ? scaleInfo['x-min'] : null;
        const maxX = frequencyOption === frequencyOptions.COMMON ? scaleInfo['x-max'] : null;

        const endProcName = formVal.end_proc;
        const getVal = formVal.GET02_VALS_SELECT;
        let { catExpBox } = plotdata;
        if (catExpBox === null) {
            catExpBox = COMMON_CONSTANT.NA;
        }
        if (typeof (catExpBox) === 'object') {
            catExpBox.map(val => (val === null ? COMMON_CONSTANT.NA : val));
            catExpBox = catExpBox.join(' | ');
        }

        // カラム名を取得する。
        const historyColumnName = getColumnName(endProcName, getVal);

        const stepChartSummary = data.array_plotdata[i].cat_summary || null;

        // create summaries HTMLs
        const summaryData = calculateSummaryData(plotdata.summaries, latestChartInfoIdx);
        const sensorType = procConfigs[plotdata.end_proc_id].dicColumns[plotdata.end_col_id].data_type;
        const allGroupNames = sensorType === DataTypes.TEXT.name
            ? getAllGroupOfSensor(data.array_plotdata.filter(
                plot => plot.end_col_id === plotdata.end_col_id
            )) : [];

        const isLimitCat = plotdata.is_cat_limited || (sensorType === DataTypes.TEXT.name && allGroupNames.id.length >= 29);
        const generalInfo = {
            getVal, startProc, endProcName,
        };
        const summariesHTML = buildSummaryResultsHTML(summaryData, i + 1, generalInfo, beforeRankValues, stepChartSummary);

        const catExpBoxCols = [data.COMMON['catExpBox1'], data.COMMON['catExpBox2']].filter(c => c);

        const chartTitle = buildSummaryChartTitle(catExpBox, catExpBoxCols, plotdata.catExpBoxName, false, {}, true);

        // create histogram HTMLs
        const hisCardBorder = (String(endProcName) === String(startProc)) ? 'his-active' : '';
        const cardHtml = `<div class="his graph-navi position-relative">
            <div class="his-content ${hisCardBorder}">
                 ${chartTitle}
                <div id="${formElements.histograms}${i + 1}" class="hd-plot"
                    style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histHeight};"></div>
                <div id="${formElements.histograms}${i + 1}Summary" class="hist-summary"
                    style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histSummaryHeight};">
                    ${summariesHTML}
                </div>
            </div>
            <div class="limitCatMessage" id="${formElements.histograms}${i + 1}message">${i18n.catLimitMsg}</div>
        </div>`;
        $(formElements.histPlotCards).append(cardHtml);

        const procName = procConfigs[endProcName].name;

        const histParam = {
            canvasId: `${formElements.histograms}${i + 1}`,
            // kdeData: !beforeRankValues ? kdeData : [],
            kdeData,
            plotdata,
            beforeRankValues,
            isThinData,
            minY,
            maxY,
            minX,
            maxX,
            yTitle: `${historyColumnName} | ${procName}`,
            chartInfos: latestChartInfo,
            isCatLimited: isLimitCat,
            allGroupNames: isLimitCat ? [] : allGroupNames,
            labelFmt: scaleInfo.label_fmt,
        };
        HistogramWithDensityCurve($, histParam);
    }
    
    // Init filter modal
    const {catExpBox, category_data, cat_on_demand} = data;
    fillDataToFilterModal(catExpBox, category_data, cat_on_demand, [], [], handleSubmit);
    checkSummaryOption(formElements.summaryOption);
};

// const updateHistogramWhenChaneScale = (scaleOption = '1') => {
//     const currentTraceData = graphStore.getTraceData();
//     const numChart = currentTraceData.array_plotdata.length;
//
//     // set common max min
//     // let commonMaxY = null;
//     // let commonMinY = null;
//     // if (scaleOption === '2') {
//     //     let arrayPlotdataY = [];
//     //     for (let idx = 0; idx < numChart; idx++) {
//     //         if (currentTraceData.array_plotdata[idx].before_rank_values === null) {
//     //             arrayPlotdataY = arrayPlotdataY.concat(currentTraceData.array_plotdata[idx].array_y);
//     //         }
//     //     }
//     //     arrayPlotdataY = arrayPlotdataY.filter(e => $.isNumeric(e));
//     //     [commonMinY, commonMaxY] = findMinMax(arrayPlotdataY);
//     // }
//
//
//     for (let i = 0; i < numChart; i++) {
//         const plotData = currentTraceData.array_plotdata[i];
//         const beforeRankValues = plotData.before_rank_values;
//         if (beforeRankValues) {
//             continue;
//         }
//
//         // const arrayY = plotData.array_y;
//         // const setYMax = plotData['y-max'];
//         // const setYMin = plotData['y-min'];
//         // const convertedChartInfos = plotData.chart_infos;
//         // const [latestChartInfo, latestIndex] = chooseLatestThresholds(convertedChartInfos) || {};
//         // const corrSummary = plotData.summaries[latestIndex] || {};
//         // const [minY, maxY, globalRange, customBinSize] = createHistogramParamsTraceData(scaleOption, arrayY, setYMin, setYMax, commonMinY, commonMaxY, latestChartInfo, corrSummary);
//
//         const scaleInfo = getScaleInfo(plotData, scaleOption);
//         const kdeData = scaleInfo.kde_data;
//         let yMax = scaleInfo['y-max'];
//         const yMin = scaleInfo['y-min'];
//
//         yMax = yMax * 105 / 100;
//
//         const kdeDensity = {
//             y: kdeData.hist_labels,
//             x: kdeData.kde,
//             mode: 'lines',
//             name: 'KDE',
//             line: {
//                 shape: 'spline',
//                 width: 1,
//             },
//             type: 'scatter',
//             orientation: 'h',
//             xaxis: 'x2',
//             // marker: {
//             //     color: isThinData ? CONST.COLOR_THIN : '#d07e00',
//             // },
//             hoverinfo: 'none',
//         };
//
//         const histogram = {
//             // y: kdeData.hist_counts,
//             // x: kdeData.hist_labels,
//             y: kdeData.hist_labels,
//             x: kdeData.hist_counts,
//             histfunc: 'sum',
//             orientation: 'h',
//             marker: {
//                 color: '#89b368',
//                 line: {
//                     color: '#89b368',
//                     width: 0.2,
//                 },
//             },
//             name: '',
//             opacity: 0.75,
//             type: 'histogram',
//             autobiny: false,
//             ybins: { end: yMax, size: 128, start: yMin },
//             hovertemplate: '%{x}',
//         };
//         const dataUpdate = [
//             histogram,
//             kdeDensity,
//         ];
//
//
//         // const layoutUpdate = {
//         //     yaxis: {
//         //         gridcolor: '#444444',
//         //         tickfont: {
//         //             color: 'rgba(255,255,255,1)',
//         //             size: 8,
//         //         },
//         //         spikemode: 'across',
//         //         spikethickness: 1,
//         //         spikedash: 'solid',
//         //         spikecolor: 'rgb(255, 0, 0)',
//         //         // range: globalRange,
//         //     },
//         // };
//
//         const canvasId = `${formElements.histograms}${i + 1}`;
//
//         Plotly.update(canvasId, dataUpdate);
//         // Plotly.update(canvasId, dataUpdate, layoutUpdate, [0]);
//     }
// };

const loading = $('.loading');

const resetGraphSetting = () => {
    $(`select[name=${formElements.frequencyScale}]`).val(frequencyOptions.AUTO);
    $(`input[name=${formElements.summaryOption}][value=none]`).prop('checked', true);
    $(formElements.yScaleOption).val(1);
};

const traceDataWithDBChecking = (action) => {
    requestStartedAt = performance.now();

    // clear checked filter category
    resetCheckedCats();

    // continue to trace data or export CSV/TSV
    if (action === 'TRACE-DATA') {
        isValid = checkValidations({ max: MAX_END_PROC });
        updateStyleOfInvalidElements();
        if (!isValid) return;
        // close sidebar
        beforeShowGraphCommon();
        resetGraphSetting();

        handleSubmit(true);
    }
};

const clearTraceResultCards = () => {
    // clear catgory table
    $(formElements.cateCard).html('');
    // clear tscharts
    $(formElements.tsPlotCards).html('');
    // hide ts charts
    $(formElements.traceDataTabs).hide();
};

const handleSubmit = (clearOnFlyFilter = false) => {
    const startTime = runTime();

    traceData(clearOnFlyFilter);

    // send GA events
    const endTime = runTime();
    const traceTime = endTime - startTime;
    gtag('event', 'trace_time', {
        event_category: 'Trace Data',
        event_label: 'Trace Data',
        value: traceTime,
    });
};

const updateCategoryOrder = (formData) => {
    if (updateOrderCols) {
        const xOption = formData.get(name.xOption) || formData.get('xOption');
        formData.delete(name.process);
        formData.delete(name.serial);
        formData.delete(name.order);

        formData.set(name.xOption, xOption);
        updateOrderCols.forEach(orderCol => {
            formData.append(name.process, orderCol.serialProcess);
            formData.append(name.serial, orderCol.serialColumn);
            formData.append(name.order, orderCol.serialOrder);
        });
    }
    updateOrderCols = false;
};

const collectFormDataTrace = (clearOnFlyFilter) => {
    let formData = null;
    if (clearOnFlyFilter) {
        formData = collectFormData(formElements.formID);
        // transform facet params
        formData = transformFacetParams(formData);
        formData = bindCategoryParams(formData);

        // genDatetime of tracing from date-time-range-picker
        formData = genDatetimeRange(formData);

        // remove unused params
        formData = removeUnusedFormParams(formData, true);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        // transform cat label filter
        formData = transformCatFilterParams(formData);

        // transform index order
        formData = transformIndexOrderParams(formData, formElements.formID);
        // update category order in case of re-set from on-demand filter
        updateCategoryOrder(formData);
    }

    return formData;
};

const traceData = (clearOnFlyFilter) => {
    hideAllCrossAnchorInline();
    if (clearOnFlyFilter) {
        clearTraceResultCards();
    }

    let formData = collectFormDataTrace(clearOnFlyFilter);

    loadingUpdate(5);

    formData = handleXSettingOnGUI(formData);

    showGraphCallApi('/ap/api/fpp/index', formData, REQUEST_TIMEOUT, async (res) => {
    
        $(formElements.traceDataTabs).css('display', 'block');
    
        convertChartInfoToIndex(res);
    
        // store trace result
        graphStore.setTraceData(_.cloneDeep(res));
    
        const {catExpBox, category_data, cat_on_demand} = res;

        availableOrderingSettings = res.COMMON.available_ordering_columns;

        // TODO:  lay nhung column va process o res de disable chinh xac hon.
        if (clearOnFlyFilter) {
            const dfProcs = res.COMMON.dfProcs || [];
            const dfCols = res.COMMON.dfColumns || [];
            clearGlobalDict();
            initTableValue(dfProcs, dfCols);
            initGlobalDict(catExpBox);
            initGlobalDict(category_data);
            initGlobalDict(cat_on_demand);
            initDicChecked(getDicChecked());
            initUniquePairList(res.dic_filter);
        }

        const shouldOrderByIndexList = isShowIndexInGraphArea || clearOnFlyFilter;

        const categoryData = shouldOrderByIndexList ? orderCategoryWithOrderSeries(res) : category_data;
        res.category_data = categoryData;

        // draw + show data to graphs
        traceDataChart(res, null, clearOnFlyFilter);

        loadGraphSetings(clearOnFlyFilter);

        showInfoTable(res);

        // render cat, category label filer modal
        fillDataToFilterModal(catExpBox, categoryData, cat_on_demand, [], [], handleSubmit);

        // Move screen to graph after pushing グラフ表示 button
        autoScrollToChart(500);

        // sql limit warining toastr
        // if (res.actual_record_number > SQL_LIMIT) {
        //     showToastrMsg(i18n.SQLLimit);
        // }

        // show toastr to inform result was truncated upto 5000
        if (res.is_res_limited) {
            showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'));
        }

        // show toastr to inform result was truncated upto 5000
        if (res.is_thin_data) {
            showToastrMsg(i18n.thinDataShown);
        }

        // show limit graphs displayed message
        if (res.isGraphLimited) {
            showToastrMsg(i18nCommon.limitDisplayedGraphs.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
        }

        // check and do auto-update
        longPolling(formData, () => {
            handleSubmit(true)
        });

        if ((isEmpty(res.array_plotdata)
                        || isEmpty(res.array_plotdata[0].array_y))
                    && (isEmpty(res.category_data)
                        || isEmpty(res.category_data[0]))) {
            showToastrAnomalGraph();
        }
        isShowIndexInGraphArea = false;
    });
};


const csvExport = async (type) => {
    const formData = lastUsedFormData || collectFormDataTrace(true);
    const queryString = genQueryStringFromFormData(formData);
    const exportType = type === 'tsv_export' ? type : 'csv_export';

    if (queryString && queryString.includes('GET02_VALS_SELECT')) {
        const url = `/ap/api/fpp/${exportType}?${queryString}`;
        const filename = `${generateDefaultNameExport()}.${exportType.substring(0, 3)}`;
        downloadTextFile(url, filename);
    }
    return false;
};

const buildMapIndex2OutlierYValue = (plotdata, scaleInfo) => {
    const dictIdx2YValue = {};
    const arrayYTS = [...plotdata.array_y];
    const idxs = [...scaleInfo.lower_outlier_idxs, ...scaleInfo.upper_outlier_idxs];
    for (const idx of idxs) {
        arrayYTS[idx] = null; // it's outlier value -> clear, not shown as normal data
        dictIdx2YValue[idx] = plotdata.array_y[idx];
    }
    return [dictIdx2YValue, arrayYTS];
};

// eslint-disable-next-line no-unused-vars
const scrollTSChart = (() => {
    jQuery.expr.filters.offscreen = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            (rect.x + rect.width) < 0
            || (rect.y + rect.height) < 0
            || (rect.x > window.innerWidth || rect.y > window.innerHeight)
        );
    };
    const $window = $(window);
    let $stickies;

    const whenScrolling = () => {
        const isScrollOverCategoryTabl = $(window).scrollTop() + 385 < $('#cateArea').offset().top;
        if (isScrollOverCategoryTabl) {
            if ($stickies.find('.btn-anchor').hasClass('pin')
                && $stickies.hasClass('pinChart')) {
                $stickies.removeClass('pinChart');
                $stickies.css({ position: '' });
            }
        } else if ($stickies.find('.btn-anchor').hasClass('pin')) {
            $stickies.addClass('pinChart');
        }
    };
    const load = (stickies) => {
        if (typeof stickies === 'object'
            && stickies instanceof jQuery
            && stickies.length > 0
            && stickies.id !== 'cate-card'
        ) {
            let $originWH = $(document).height();
            $stickies = stickies.each((_, e) => {
                const $thisSticky = $(e).wrap('<div class="">');

                $thisSticky
                    .data('originalPosition', $thisSticky.offset().top)
                    .data('originalHeight', $thisSticky.outerHeight());
            });

            $window.off('scroll.stickies').on('scroll.stickies', () => {
                // re-calc position
                const $newWH = $(document).height();
                if ($newWH !== $originWH) {
                    $stickies = stickies.each((_, e) => {
                        $(e).data('originalPosition', $(e).offset().top);
                    });
                    $originWH = $newWH;
                }

                whenScrolling();
            });
        }
    };
    return {
        load,
    };
})();

const resetIntabJumping = () => {
    // add graph-navi class back for all carts.
    $('div[id^="area"]').addClass('graph-navi');
};

const removeIntabJumping = (chartDOMId) => {
    $(`#${chartDOMId}`).removeClass('graph-navi');
};

const pinTSChart = (chartDOMId) => {
    const cardEle = $(`#${chartDOMId}`);
    const domWidth = cardEle.parent().width();
    const anchor = cardEle.find('span.btn-anchor');
    const isPinned = anchor.attr('data-pinned');
    // remove all pinned charts and pinned anchors
    const allCardArea = $('div[id^="area"]');
    allCardArea.removeClass('pinChart');
    allCardArea.find('span.btn-anchor').removeClass('pin');
    // reset marker in anchor
    allCardArea.find('span.btn-anchor').attr('data-pinned', false);

    // add graph-navi class back for all carts.
    // remove jumping point of the pinned cart
    // purpose is to let 2 charts into 2 screen when jumping
    resetIntabJumping();
    removeIntabJumping(chartDOMId);

    resetCateogryTablePosition();

    // TODO: unpin ts chart here
    if (isPinned !== 'true') {
        // make pin current chart
        cardEle.toggleClass('pinChart');
        cardEle.find('span.btn-anchor').toggleClass('pin');
        cardEle.find('span.btn-anchor').attr('data-pinned', true);

        // set width for pinned chart
        $('.pinChart').css('width', domWidth);
        // console.log(`pinned chart #${chartDOMId}!`);

        // pin as scroll
        scrollTSChart.load(cardEle);
    } else {
        // check if category table was pinned, return origin situation
        const isCateTablePinned = $(formElements.cateCard).find('.btn-anchor').hasClass('pin');
        if (isCateTablePinned) {
            scrollCategoryTable.load($(formElements.cateCard));
        }
    }

    // remove width + position to make more responsive when unpin
    if (!cardEle.hasClass('pinChart')) {
        cardEle.css({ width: '', position: '' });
    }
};

const setXSettingToFormData = (xSettings, formData) => {
    const keys = Object.keys(xSettings);
    for (key of keys) {
        formData.set(key, xSettings[key]);
    }
    return formData;
};

const handleXSettingOnGUI = (formData = null, xAxisSettings = null) => {
    if (!xAxisShowSettings && xAxisSettings) {
        xAxisShowSettings = xAxisSettings;
        $('#xOption').val(CONST.XOPT_INDEX).change();
        lastSelectedOrder.push(xAxisShowSettings);
    }
    if (formData) {
        if (xAxisShowSettings) {
            setXSettingToFormData(xAxisShowSettings, formData);
        }
        return formData;
    }
    return true;
};

const bindXAxisSettings = (procId, columns) => {
    const hasDummyDatetime = columns.filter(column => column.is_dummy_datetime);
    let xAxisSettings = {
        xOption: CONST.XOPT_TIME,
    };
    if (hasDummyDatetime.length) {
        const serialCols = columns.filter(column => column.is_serial_no || column.order);
        if (serialCols.length) {
            xAxisSettings.xOption = CONST.XOPT_INDEX;
            // get first serial or order column as default
            const serialSettings = {
                serialProcess: Number(procId),
                serialColumn: serialCols[0].id,
                serialOrder: 1,
            };
            xAxisSettings = {...xAxisSettings, ...serialSettings};
            handleXSettingOnGUI(null, serialSettings);
        }
    }
    return xAxisSettings;
};

const startProcChangeEvents = () => {
    const startProcDOM = $(formElements.startProc);
    startProcDOM.off('change').on('change', async (e) => {
        const startProcID = $(e.target).val();
        xAxisShowSettings = null;
        if (!startProcID) return;
        const procInfo = procConfigs[startProcID];
        await procInfo.updateColumns();
        const procColumns = procInfo.getColumns();
        if (procColumns) {
            bindXAxisSettings(startProcID, procColumns);
        }
    });
};

const switchTabOption = (e) => {
    const currentTab = $(e).find('a').attr('href').replace('#', '');
    $('.for-tab').hide();
    $(`.for-${currentTab}`).show();
};

const onChangeYScale = () => {
    // on select histogam y-scale option
    $(formElements.yScaleOption).off('change');
    $(formElements.yScaleOption).on('change', function () {
        const scaleOption = $(this).children('option:selected').val() || 1;
        // update scale of time series
        updateGraphScale(scaleOption);

        const frequencyOption = $(`select[name=${formElements.frequencyScale}]`).val();
        // reset summary seletion
        // resetSummaryOption('histSummaryOption');

        const currentTraceData = graphStore.getTraceData();
        // TODO: should update than re-draw
        drawHistogramsTab(currentTraceData, scaleOption, false, frequencyOption);
        // updateHistogramWhenChaneScale(scaleOption);
    });
};

const dumpData = (type, exportFrom) => {
    const formData = lastUsedFormData || collectFormDataTrace(true);
    formData.set('export_from', exportFrom);
    if (type === EXPORT_TYPE.CSV) {
        exportData('/ap/api/fpp/csv_export', 'csv', formData);
    }

    if (type === EXPORT_TYPE.TSV) {
        exportData('/ap/api/fpp/tsv_export', 'tsv', formData);
    }

    if (type === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard('/ap/api/fpp/tsv_export', formData);
    }
};
const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};
