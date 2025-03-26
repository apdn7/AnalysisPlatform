const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 32;
const MAX_NUMBER_OF_SENSOR = 8;
const MIN_NUMBER_OF_SENSOR = 0;

const dicTabs = {
    '#byVarCompare': 'var',
    '#byTermCompare': 'term',
    '#byCyclicTerm': 'cyclicTerm',
};
let currentTraceDataVar;
let currentTraceDataTerm;
let currentTraceDataCyclicTerm;
const stpScaleOption = {
    xAxis: null,
    yAxis: null,
};
const graphStore = new GraphStore();

const eles = {
    varTabPrefix: 'var',
    termTabPrefix: 'directTerm',
    cyclicTermTabPrefix: 'cyclicTerm',
    formID: 'CategoricalPlotForm',
    mainFormId: '#categoricalPlotForm',
    varFormID: '#varCategoricalPlotForm',
    termFormID: '#termCategoricalPlotForm',
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcReg: /cond_proc/g,
    condProcProcessDiv: 'CondProcProcessDiv',
    condProcPartno: 'condProcPartno',
    categoryPlotTime: '.category-plot-time',
    categoryVariableSelect: 'CategoryVariableSelect',
    categoryPlotCards: 'CatePlotCards',
    histScale: 'HistScale',
    frequencyScale: 'FrequencyScale',
    condMachinePartnoDiv: 'CondMachinePartnoDiv',
    endProcProcess: 'EndProcProcess',
    endProcProcessDiv: 'EndProcProcessDiv',
    endProcVal: 'EndProcVal',
    endProcValDiv: 'EndProcValDiv',
    startDate: 'StartDate',
    startTime: 'StartTime',
    endDate: 'EndDate',
    endTime: 'EndTime',
    DateTimeDivName: 'DateTime',
    DateTimeEleName: 'DateTimeElement',
    termBtnAddDateTime: '#termBtnAddDateTime',
    termBtnAddVariable: '#termBtnAddVariable',
    termBtnAddCondProc: '#termbtn-add-cond-proc',
    varBtnAddCondProc: '#varbtn-add-cond-proc',
    dateTimeCloseBtn: 'DateTimeCloseBtn',
    VariableCloseBtn: 'VariableCloseBtn',
    categoryVariableName: 'categoryVariable',
    categoryValueMulti: 'categoryValueMulti',
    histograms: 'Histograms',
    plotInfoId: 'PlotDetailInfomation',
    termCondProcRow: 'term-cond-proc-row',
    traceTime: 'TraceTime',
    recentTimeInterval: 'recentTimeInterval',
    scatterPlotCards: 'ScatterPlotCards',
    summaryOption: 'SummaryOption',
    machineID: 'machine-id',
    lineList: 'line-list',
    checkBoxs: 'input[name=GET02_VALS_SELECT1][type=checkbox][value!=All]',
    varShowGraphBtn: '#varShowGraphBtn',
    stratifiedVarTabs: '#stratifiedVarTabs',
    cyclicTermTabs: '#stratifiedCyclicTermTabs',
    showValueKey: 'GET02_VALS_SELECT1',
    stratifiedVarsKey: 'categoryValueMulti1',
    currentscaleOption: '#currentscaleOption',
    histActiveTab: 'a.nav-link.active.tab-name',
    varCategoryItems: 'catItems',
    varProcItems: 'procItems',
    endProcCate: 'end_proc_cate',
    stratifiedTabs: '.stratifiedTabs',
};

const formElements = {
    NO_FILTER: 'NO_FILTER',
    BY_VAR: 'var',
    BY_TERM: 'term',
    BY_CYCLIC: 'cyclicTerm',
    SCALE_DEFAULT_OPTION: 1,
    endProcSelectedItem: '#end-proc-row select',
    condProcSelectedItem: '#varcond-proc-row select',
};

const i18n = {
    yLabelKDE: $('#i18nKDE').text(),
    yLabelFreq: $('#i18nFrequency').text(),
    machineName: $('#i18nMachineNo').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNoName: $('#i18nPartNo').text(),
    partNo: $('#i18nPartNo').text(),
    dateRange: $('#i18nDateRange').text(),
    dateRecent: $('#i18nRecent').text(),
    hours: $('#i18nHour').text(),
    summaryDistribution: $('#i18nSummaryDistribution').text(),
    nNumber: $('#i18nNNumber').text(),
    average: $('#i18nAverage').text(),
    median: $('#i18nMedian').text(),
    ucl: $('#i18nUCL').text(),
    lcl: $('#i18nLCL').text(),
    hour: $('#i18nHour').text(),
    minute: $('#i18nMinute').text(),
    day: $('#i18nDay').text(),
    week: $('#i18nWeek').text(),
    noFilter: $('#i18nNoFilter').text(),
    allSelection: $('#i18nAllSelection').text(),
    viewerTabName: $('#i18nViewer').text(),
    selectFacet: $('#i18nSelectCatExpBox').text(),
    selectFacetVariableDiv: $('#i18nUnselectFacetVariableDivMessage').text(),
};

const loading = $('.loading');

$(() => {
    // tabs switch
    $(document).ready(() => {
        $('#tabs a').click(function f(e) {
            e.preventDefault();
            $(this).tab('show');
        });
    });

    // hide loading screen
    loading.addClass('hide');

    // generate process dropdown data
    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const varEndProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
        showFilter: true,
    });
    varEndProcItem();

    // for multiple end procs setting
    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        varEndProcItem();
        addAttributeToElement();
    });

    // add first condition process
    const varCondProcItem = addCondProc(
        endProcs.ids,
        endProcs.names,
        eles.varTabPrefix,
        eles.mainFormId.replace('#', ''),
        'varbtn-add-cond-proc',
    );
    varCondProcItem();

    // click even of condition proc add button
    $(eles.varBtnAddCondProc).click(() => {
        varCondProcItem();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    // add limit after running load_user_setting
    setTimeout(addLimitNumSensors, 600);

    initValidation(eles.mainFormId);

    initTargetPeriod();
    toggleDisableAllInputOfNoneDisplayEl($('#for-cyclicTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-directTerm'));

    // add limit after running load_user_setting
    setTimeout(() => {
        // add validations for target period
        validateTargetPeriodInput();
        keepValueEachDivision();
    }, 2000);

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.DIV_NUM, { MAX: 32, MIN: 1 });

    initializeDateTimeRangePicker();
    initializeDateTimePicker();
});

const showScatterPlotImage = (fileNames) => {
    const scatterPlotCard = $(`#${eles.varTabPrefix}${eles.scatterPlotCards}`);
    scatterPlotCard.empty();

    if (isEmpty(fileNames)) return;

    let imgs = '';
    fileNames.forEach((e) => {
        imgs += `<img src="/ap/api/stp/image/${e}" style="max-width: 100%">`;
    });
    scatterPlotCard.html(`<div class="shadow-sm" style="text-align:center"> ${imgs} </div>`);
};

const onChangeHistSummaryEventHandler = (eleIdPrefix = '') => {
    $(`input[name=${eleIdPrefix}${eles.summaryOption}]`).unbind('change');
    $(`input[name=${eleIdPrefix}${eles.summaryOption}]`).on('change', function f() {
        let summaryHeight = null;
        const summaryClass = $(this).val();
        const previousOption = $(`input[name=${eleIdPrefix}${eles.summaryOption}][data-checked=true]`);
        if (summaryClass === 'none') {
            $(`.${eleIdPrefix}.hist-summary`).each(function showHideSummary() {
                $(this).css('display', 'none');
            });
            // if (previousOption.val() && previousOption.val() !== 'none') {
            //     // rescale histogram
            //     $(`.${eleIdPrefix}.his .hd-plot`).each(function reScaleHistogram() {
            //         const histogramId = $(this).attr('id');
            //         $(`#${histogramId}`).css('height', GRAPH_CONST.histHeight);
            //         Plotly.relayout(histogramId, {});
            //     });
            // }
            $(`.${eleIdPrefix}.his .hd-plot`).each(function reScaleHistogram() {
                const histogramId = $(this).attr('id');
                $(`#${histogramId}`).css('height', GRAPH_CONST.histHeight);
                Plotly.relayout(histogramId, {});
            });

            // mark this option as checked and remove others
            $(this).attr('data-checked', 'true');
            $(`input[name=${eleIdPrefix}${eles.summaryOption}]:not(:checked)`).removeAttr('data-checked');
        } else {
            $(`.${eleIdPrefix}.hist-summary`).each(function showHideSummary() {
                $(this).css('display', 'flex');
                $(this).css('justify-content', 'center'); // to unify with FPP
            });

            $('.hist-summary-detail').each(function showUponOption() {
                $(this).css('display', 'none');
                if ($(this).hasClass(summaryClass)) {
                    $(this).css('display', 'block');
                    const h = $(this).height();
                    summaryHeight = h < summaryHeight ? summaryHeight : h;
                }
            });

            $(`.${eleIdPrefix}.his .hd-plot`).each(function reScaleHistogram() {
                const histogramId = $(this).attr('id');
                const chartHeight = `calc(${GRAPH_CONST.histHeight} - ${summaryHeight + 6}px)`;
                $(`#${histogramId}`).css('height', chartHeight);
                Plotly.relayout(histogramId, {});
            });

            // mark this option as checked and remove others
            $(this).attr('data-checked', 'true');
            $(`input[name=${eleIdPrefix}${eles.summaryOption}]:not(:checked)`).removeAttr('data-checked');
        }
    });
};

const onChangeHistScale = (prefix) => {
    $(`select[name=${prefix}${eles.histScale}]`).unbind('change');
    $(`select[name=${prefix}${eles.histScale}]`).on('change', function f() {
        setScaleOption(prefix);
        rerenderHistogram(prefix);
    });

    $(`select[name=${prefix}${eles.frequencyScale}]`).unbind('change');
    $(`select[name=${prefix}${eles.frequencyScale}]`).on('change', (e) => {
        setScaleOption(prefix);
        rerenderHistogram(prefix);
    });
};

const rerenderHistogram = (prefix) => {
    let data = null;
    if (prefix === eles.varTabPrefix) {
        data = currentTraceDataVar;
    } else if (prefix === eles.cyclicTermTabPrefix) {
        data = currentTraceDataCyclicTerm;
    } else {
        data = currentTraceDataTerm;
    }

    setScaleOption(prefix);

    showTabsAndCharts(prefix, data, false, null);
};

const showTabsAndCharts = (eleIdPrefix, data, genTab = true, onlySensorId = null) => {
    if (data == null) return;
    let sensors = [];
    data.ARRAY_FORMVAL.forEach((arrayFormval) => {
        sensors = [...sensors, ...arrayFormval.GET02_VALS_SELECT.map((val) => Number(val))];
    });
    if (typeof sensors === 'string') {
        sensors = [sensors];
    }

    const numSensors = sensors.length;

    const scaleOption = stpScaleOption.yAxis;
    const frequencyOption = stpScaleOption.xAxis;

    // prepare tabs HTML
    if (genTab) {
        let showViewerTab = false;
        if (data.images && data.images.length > 0) {
            showViewerTab = true;
        }
        showResultTabHTMLs(eleIdPrefix, data, sensors, showViewerTab);
    }

    // /////////////// each sensor ////////////////////
    const startProc = data.COMMON.start_proc;
    for (let sensorIdx = 0; sensorIdx < numSensors; sensorIdx++) {
        if (onlySensorId !== null && onlySensorId !== Number(sensors[sensorIdx])) {
            continue;
        }
        const tabId = `#${eleIdPrefix}${eles.categoryPlotCards}-${sensorIdx}`;
        const tabElement = $(tabId);
        tabElement.empty();
        tabElement.css('display', 'block');

        const sensor = sensors[sensorIdx];
        const sensorPlotDatas =
            eleIdPrefix !== 'directTerm'
                ? data.array_plotdata[sensor]
                : data.array_plotdata.filter((plot) => plot.end_col === Number(sensor));
        if (!sensorPlotDatas) {
            continue;
        }
        const numGraphs = sensorPlotDatas.length;
        // カラム名を取得する。
        const displayColName = sensorPlotDatas[0].end_col_name;
        const endProcName = sensorPlotDatas[0].end_proc_name;
        const isCategory = sensorPlotDatas[0] ? sensorPlotDatas[0].is_category : false;
        const allGroupNames = isCategory ? getAllGroupOfSensor(sensorPlotDatas) : [];
        const generalInfo = {
            startProc,
            endProcName: endProcName,
        };
        const isCatLimited = sensorPlotDatas[0] ? sensorPlotDatas[0].is_cat_limited : false;
        if (isCatLimited) {
            tabElement.closest('.tab-pane').find('.overlay-card').css('display', 'grid');
        }
        // /////////////// each histogram ////////////////////
        for (let i = 0; i < numGraphs; i++) {
            const catExpValue = sensorPlotDatas[i].catExpBox;
            const termIdx = sensorPlotDatas[i].term_id || 0;
            const beforeRankValues = sensorPlotDatas[i].before_rank_values;
            const stepChartSummary = sensorPlotDatas[i].cat_summary || null;
            const catExpBoxCols = [data.COMMON.catExpBox1, data.COMMON.catExpBox2].filter((c) => c);
            const filterCond = catExpBoxCols.length > 0 ? catExpValue.toString().split(' | ') : null;
            // get latest thresholds -> show thresholds in scatter, histogram, summary
            const [chartInfos, chartInfosOrg] = getChartInfo(sensorPlotDatas[i], 'TIME', filterCond);
            const [latestChartInfo, latestChartInfoIdx] = chooseLatestThresholds(chartInfos, chartInfosOrg);

            const scaleInfo = getScaleInfo(sensorPlotDatas[i], scaleOption);
            // y_min/max are defined in backend -> get only
            const kdeData = scaleInfo.kde_data;
            const [minY, maxY] = calMinMaxYScale(scaleInfo['y-min'], scaleInfo['y-max'], scaleOption);
            const maxX = frequencyOption === frequencyOptions.COMMON ? scaleInfo['x-max'] : null;
            const minX = frequencyOption === frequencyOptions.COMMON ? scaleInfo['x-min'] : null;

            // produce summary data
            const { summaries, end_col, end_proc_id } = sensorPlotDatas[i];
            const isHideNonePoint = isHideNoneDataPoint(end_proc_id, end_col, data.COMMON.remove_outlier);
            const summaryData = calculateSummaryData(summaries, latestChartInfoIdx, isHideNonePoint);

            const isShowDate = eleIdPrefix !== eles.varTabPrefix;
            const timeCond = data.time_conds[termIdx];

            const chartTitle = buildSummaryChartTitle(
                catExpValue,
                catExpBoxCols,
                sensorPlotDatas[i].catExpBoxName,
                isShowDate,
                timeCond,
                true,
            );

            // create summaries HTMLs
            const summariesHTML = buildSummaryResultsHTML(
                summaryData,
                i + 1,
                generalInfo,
                beforeRankValues,
                stepChartSummary,
            );
            const histogramId = `${eleIdPrefix}-${sensor}-${eles.histograms}${i + 1}`;
            const fromStartPrcClass =
                String(sensorPlotDatas[i].end_proc_id) === String(startProc) ? ' card-active' : '';
            const cardHtml = `<div class="${eleIdPrefix} his graph-navi" id="${eles.histograms}${i + 1}">
                <div class="his-content${fromStartPrcClass}">
                    ${chartTitle}
                    <div id="${histogramId}" class="hd-plot"
                        style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histHeight};"></div>
                    <div id="${eles.histograms}${i + 1}Summary" class="${eleIdPrefix} hist-summary"
                        style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histSummaryHeight};">
                        ${summariesHTML}
                    </div>
                </div>
                </div>`;
            tabElement.append(cardHtml);

            let yTitle = `${displayColName} | ${endProcName}`;
            const canvasHeight = $(`#${histogramId}`).height();
            yTitle = trimTextLengthByPixel(yTitle, canvasHeight - 100, 10);

            const plotData = sensorPlotDatas[i];
            const histParamObj = {
                tabPrefix: eleIdPrefix,
                canvasId: histogramId,
                xLabel: displayColName,
                yLabelKDE: i18n.yLabelKDE,
                yLabelFreq: i18n.yLabelFreq,
                kdeData,
                sensorName: displayColName,
                minY,
                maxY,
                maxX,
                minX,
                sensorIdx,
                yTitle: yTitle,
                chartInfos: latestChartInfo,
                beforeRankValues,
                plotData,
                isCatLimited: plotData.is_cat_limited,
                allGroupNames: plotData.is_cat_limited ? [] : allGroupNames,
                labelFmt: scaleInfo.label_fmt,
            };

            // draw histogram
            HistogramWithDensityCurve($, histParamObj);
        }
        // ////////////////////////////////////
        // report progress
        loadingUpdate(loadingProgressBackend + sensorIdx * ((100 - loadingProgressBackend) / (numSensors || 1)));
    }

    checkSummaryOption(`${eleIdPrefix}${eles.summaryOption}`);

    // Init filter modal
    fillDataToFilterModal(data.filter_on_demand, () => {
        showGraph(false);
    });
};

const setNameWithPrefix = (prefix) => {
    // change name of hist scale select
    $('.y-axis-scale').attr('name', `${prefix}${eles.histScale}`);

    $('.frequency-scale').attr('name', `${prefix}${eles.frequencyScale}`);
    // change name of summary option
    $(`.${eles.summaryOption}`).attr('name', `${prefix}${eles.summaryOption}`);

    // bind change events for summary select menu
    onChangeHistSummaryEventHandler(eles.varTabPrefix);
    onChangeHistSummaryEventHandler(eles.cyclicTermTabPrefix);
    onChangeHistSummaryEventHandler(eles.termTabPrefix);
    onChangeHistScale(eles.varTabPrefix);
    onChangeHistScale(eles.cyclicTermTabPrefix);
    onChangeHistScale(eles.termTabPrefix);
};

const resetSetting = (eleIdPrefix) => {
    resetSummaryOption(`${eleIdPrefix}${eles.summaryOption}`);

    $(`select[name=${eleIdPrefix}${eles.frequencyScale}]`).val(frequencyOptions.COMMON);

    $(`select[name=${eleIdPrefix}HistScale]`).val(scaleOptionConst.COMMON);
};

const showMessageIfFacetNotSelected = (res) => {
    if (res.COMMON.catExpBox1 || res.COMMON.catExpBox2) return;
    showToastrMsg(i18n.selectFacetVariableDiv, MESSAGE_LEVEL.INFO);
};

const collectFormDataFromGUI = (clearOnFlyFilter, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);

    const eleIdPrefix = $('select[name=compareType]').val();
    // collect form data
    if (clearOnFlyFilter) {
        formData = transformFacetParams(formData);
        // reformat form data
        formData = reformatFormData(eleIdPrefix, formData);
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;

        resetCheckedCats();
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const showGraph = (clearOnFlyFilter = true, autoUpdate = false) => {
    requestStartedAt = performance.now();
    const eleIdPrefix = $('select[name=compareType]').val();

    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();
    if (!isValid) return;

    // close sidebar
    beforeShowGraphCommon(clearOnFlyFilter);

    if (clearOnFlyFilter) {
        // reset sumary option
        resetSetting(eleIdPrefix);
    }

    const formData = collectFormDataFromGUI(clearOnFlyFilter, autoUpdate);
    showGraphCallApi('/ap/api/stp/index', formData, REQUEST_TIMEOUT, async (res) => {
        // set summary bar for prefix
        setNameWithPrefix(eleIdPrefix);

        // show result section
        $('#categoricalPlotArea').show();

        if (!_.isEmpty(res.array_plotdata)) {
            graphStore.setTraceData(_.cloneDeep(res));
            if (eleIdPrefix === eles.varTabPrefix) {
                currentTraceDataVar = res;
                showMessageIfFacetNotSelected(res);
            } else if (eleIdPrefix === eles.termTabPrefix) {
                currentTraceDataTerm = res;
            } else {
                currentTraceDataCyclicTerm = res;
            }
        }

        setScaleOption(eleIdPrefix);

        // show graphs
        // if (eleIdPrefix === eles.varTabPrefix || eleIdPrefix === eles.cyclicTermTabPrefix) {
        showTabsAndCharts(eleIdPrefix, res);

        // show info table
        showInfoTable(res);

        // Move screen to graph after pushing グラフ表示 button
        if (!autoUpdate) {
            $('html, body').animate(
                {
                    scrollTop: getOffsetTopDisplayGraph(`#${eles.categoryPlotCards}`),
                },
                500,
            );
        }

        // check result and show toastr msg
        if (isEmpty(res.array_plotdata) || isEmpty(Object.values(res.array_plotdata)[0])) {
            showToastrAnomalGraph();
        }

        // show limit graphs displayed in one tab message
        if (res.isGraphLimited) {
            showToastrMsg(i18nCommon.limitDisplayedGraphsInOneTab.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
        }

        // show scatter plot tab
        const imgFile = res.images;
        if (imgFile) {
            showScatterPlotImage(imgFile);
        }
        setPollingData(formData, showGraph, [false, true]);

        // drag & drop for tables
        $('.ui-sortable').sortable();
    });
};

const setScaleOption = (prefix) => {
    stpScaleOption.yAxis = $(`select[name=${prefix}${eles.histScale}]`).val();
    stpScaleOption.xAxis = $(`select[name=${prefix}${eles.frequencyScale}]`).val();
};
