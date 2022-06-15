/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(120000); // 3 minutes
const MAX_NUMBER_OF_GRAPH = 32;
const MAX_END_PROC = 8;
is_sse_listening = false;
const dicTabs = { '#byVarCompare': 'var', '#byTermCompare': 'term', '#byCyclicTerm': 'cyclicTerm' };
let currentTraceDataVar;
let currentTraceDataTerm;
let currentTraceDataCyclicTerm;
const scaleOptions = {};

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
    yScaleGroup: '#yScaleGroup',
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
    warningTitle: $('#i18nWarningTitle').text(),
    selectTooManyValue: $('#i18nTooManyValue').text(),
    selectFacet: $('#i18nSelectCatExpBox').text(),
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
    const varEndProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, true, true, true);
    varEndProcItem();

    // for multiple end procs setting
    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        varEndProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // add first condition process
    const varCondProcItem = addCondProc(endProcs.ids, endProcs.names, eles.varTabPrefix, eles.mainFormId.replace('#', ''),
        'varbtn-add-cond-proc');
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
    }, 600);

    // validate and change to default and max value cyclic term
    validateInputByNameWithOnchange(CYCLIC_TERM.WINDOW_LENGTH, CYCLIC_TERM.WINDOW_LENGTH_MIN_MAX);
    validateInputByNameWithOnchange(CYCLIC_TERM.INTERVAL, CYCLIC_TERM.INTERVAL_MIN_MAX);
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
        imgs += `<img src="/histview2/api/stp/image/${e}" style="max-width: 100%">`;
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

            $(`.${eleIdPrefix}.hist-summary-detail`).each(function showUponOption() {
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
    $(`select[name=${prefix}HistScale]`).unbind('change');
    $(`select[name=${prefix}HistScale]`).on('change', function f() {
        // reset summary option
        resetSummaryOption(`${prefix}${eles.summaryOption}`);

        let data = null;
        let sensorID = 0;
        const scaleOption = $(this).children('option:selected').val() || '1';
        sensorID = $(`#${eles.categoryPlotCards}`).find($(eles.histActiveTab)).data('sensor-id');
        if (prefix === eles.varTabPrefix) {
            data = currentTraceDataVar;
        } else if (prefix === eles.cyclicTermTabPrefix) {
            data = currentTraceDataCyclicTerm;
        } else {
            data = currentTraceDataTerm;
        }

        scaleOptions[sensorID] = scaleOption;
        showTabsAndCharts(prefix, data, scaleOption, false, sensorID);
    });
};

const buildHistogramSummariesHTML = (eleIdPrefix, tableIndex, chartOption, generalInfo) => {
    const [nTotalHTML, noLinkedHTML] = genTotalAndNonLinkedHTML(chartOption, generalInfo);

    return `
    <table class="${eleIdPrefix} hist-summary-detail count">
        <tbody>
            <tr>
                <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
                <td>
                    ${nTotalHTML}
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.hoverOutCL}">outCL</span>
                </td>
                <td>
                    <span class="summary-value tooltip-parent">${chartOption.p}% (${chartOption.pn})
                        <span class="tooltip-content">
                            outCL+ : ${chartOption.pPlus}% (${chartOption.pnPlus})<br>
                            outCL- : ${chartOption.pMinus}% (${chartOption.pnMinus})<br>
                        </span>
                    </span>
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.hoverOutAL}">outAL</span>
                </td>
                <td>
                    <span class="summary-value tooltip-parent">${chartOption.pProc}% (${chartOption.pnProc})
                        <span class="tooltip-content">
                            outAL+ : ${chartOption.pProcPlus}% (${chartOption.pnProcPlus})<br>
                            outAL- : ${chartOption.pProcMinus}% (${chartOption.pnProcMinus})<br>
                        </span>
                    </span>
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNA}">P<sub>NA</sub></span></td>
                <td id="average-${tableIndex}">${chartOption.pNA}% (${chartOption.pnNA})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNaN}">P<sub>NaN</sub></span></td>
                <td id="average-${tableIndex}">${chartOption.pNaN}% (${chartOption.pnNaN})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfPlus}">P<sub>Inf+</sub></span></td>
                <td id="average-${tableIndex}">${chartOption.pInf}% (${chartOption.pnInf})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfMinus}">P<sub>Inf-</sub></span></td>
                <td id="average-${tableIndex}">${chartOption.pNegInf}% (${chartOption.pnNegInf})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPTotal}">P<sub>Total</sub></span></td>
                <td id="average-${tableIndex}">${chartOption.pTotal}% (${chartOption.pnTotal})</td>
            </tr>
            ${noLinkedHTML}
        </tbody>
    </table>
    <table class="${eleIdPrefix} hist-summary-detail basic-statistics" >
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                <td>
                    ${isEmpty(chartOption.nStats) ? '-' : chartOption.nStats}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.average}</span></td>
                <td id="arrayNum-${tableIndex}">
                    ${isEmpty(chartOption.bsAverage) ? '-' : chartOption.bsAverage}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">3σ</span></td>
                <td id="stdev-${tableIndex}">
                    ${isEmpty(chartOption.sigma3) ? '-' : chartOption.sigma3}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cp</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.cp) ? '-' : chartOption.cp}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cpk</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.cpk) ? '-' : chartOption.cpk}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">σ</span></td>
                <td id="average-${tableIndex}">
                    ${isEmpty(chartOption.sigma) ? '-' : chartOption.sigma}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.maxValue || 'Max'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.maxValue) ? '-' : chartOption.maxValue}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.minValue || 'Min'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.minValue) ? '-' : chartOption.minValue}
                </td>
            </tr>
        </tbody>
    </table>
    <table class="${eleIdPrefix} hist-summary-detail non-parametric">
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMedian}">${i18nCommon.median || '中央値'}</span></td>
                <td>
                    ${isEmpty(chartOption.median) ? '-' : chartOption.median}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP95}">P95</span></td>
                <td>
                    ${isEmpty(chartOption.p95) ? '-' : chartOption.p95}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP75Q3}">P75 Q3</span></td>
                <td>
                    ${isEmpty(chartOption.p75Q3) ? '-' : chartOption.p75Q3}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP25Q1}">P25 Q1</span></td>
                <td>
                    ${isEmpty(chartOption.p25Q1) ? '-' : chartOption.p25Q1}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP5}">P5</span></td>
                <td>
                    ${isEmpty(chartOption.p5) ? '-' : chartOption.p5}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverIQR}">IQR</span></td>
                <td>
                    ${isEmpty(chartOption.iqr) ? '-' : chartOption.iqr}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverNIQR}">NIQR</span></td>
                <td>
                    ${isEmpty(chartOption.niqr) ? '-' : chartOption.niqr}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.mode}">Mode</span></td>
                <td>
                    ${isEmpty(chartOption.mode) ? '-' : chartOption.mode}
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.overflowPlus}">N<sub>Overflow+</sub></span>
                </td>
                <td>
                    ${isEmpty(chartOption.numOverUpper) ? '-' : chartOption.numOverUpper}
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.overflowMinus}">N<sub>Overflow-</sub></span>
                </td>
                <td>
                    ${isEmpty(chartOption.numOverLower) ? '-' : chartOption.numOverLower}
                </td>
            </tr>
        </tbody>
    </table>`;
};

const calculateSummaryData = (summaries, summaryIdx = 0) => {
    const summary = summaries[summaryIdx || 0] || summaries[0];

    // count statistics
    const ntotal = getNode(summary, ['count', 'ntotal'], 0) || 0;
    const countUnlinked = getNode(summaries, ['count', 'count_unlinked'], 0) || 0;
    const p = getNode(summary, ['count', 'p'], '0') || '0';
    const pMinus = getNode(summary, ['count', 'p_minus'], '0') || '0';
    const pPlus = getNode(summary, ['count', 'p_plus'], '0') || '0';
    const pn = getNode(summary, ['count', 'pn'], '0') || '0';
    const pnMinus = getNode(summary, ['count', 'pn_minus'], '0') || '0';
    const pnPlus = getNode(summary, ['count', 'pn_plus'], '0') || '0';
    const pnProc = getNode(summary, ['count', 'pn_proc'], '0') || '0';
    const pnProcPlus = getNode(summary, ['count', 'pn_proc_plus'], '0') || '0';
    const pnProcMinus = getNode(summary, ['count', 'pn_proc_minus'], '0') || '0';
    const pProc = getNode(summary, ['count', 'p_proc'], '0') || '0';
    const pProcPlus = getNode(summary, ['count', 'p_proc_plus'], '0') || '0';
    const pProcMinus = getNode(summary, ['count', 'p_proc_minus'], '0') || '0';
    const pNA = getNode(summary, ['count', 'p_na'], '0') || '0';
    const pnNA = getNode(summary, ['count', 'pn_na'], '0') || '0';
    const pNaN = getNode(summary, ['count', 'p_nan'], '0') || '0';
    const pnNaN = getNode(summary, ['count', 'pn_nan'], '0') || '0';
    const pInf = getNode(summary, ['count', 'p_inf'], '0') || '0';
    const pnInf = getNode(summary, ['count', 'pn_inf'], '0') || '0';
    const pNegInf = getNode(summary, ['count', 'p_neg_inf'], '0') || '0';
    const pnNegInf = getNode(summary, ['count', 'pn_neg_inf'], '0') || '0';
    const pTotal = getNode(summary, ['count', 'p_total'], '0') || '0';
    const pnTotal = getNode(summary, ['count', 'pn_total'], '0') || '0';
    const linkedPct = getNode(summary, ['count', 'linked_pct'], '0') || '0';
    const noLinkedPct = getNode(summary, ['count', 'no_linked_pct'], '0') || '0';
    // basic-statistics
    const nStats = getNode(summary, ['basic_statistics', 'n_stats'], '-') || '-';
    const cp = getNode(summary, ['basic_statistics', 'Cp'], '-') || '-';
    const cpk = getNode(summary, ['basic_statistics', 'Cpk'], '-') || '-';
    const maxValue = getNode(summary, ['basic_statistics', 'Max'], '0') || '0';
    const maxValueOrg = getNode(summary, ['basic_statistics', 'max_org'], '0') || '0';
    const minValue = getNode(summary, ['basic_statistics', 'Min'], '0') || '0';
    const minValueOrg = getNode(summary, ['basic_statistics', 'min_org'], '0') || '0';
    const bsAverage = getNode(summary, ['basic_statistics', 'average'], '0') || '0';
    const sigma = getNode(summary, ['basic_statistics', 'sigma'], '0') || '0';
    const sigma3 = getNode(summary, ['basic_statistics', 'sigma_3'], '0') || '0';
    // non-parametric
    const median = getNode(summary, ['non_parametric', 'median'], '0') || '0';
    const p5 = getNode(summary, ['non_parametric', 'p5'], '0') || '0';
    const p25Q1 = getNode(summary, ['non_parametric', 'p25'], '0') || '0';
    const p25Q1Org = getNode(summary, ['non_parametric', 'p25_org'], '0') || '0';
    const p75Q3 = getNode(summary, ['non_parametric', 'p75'], '0') || '0';
    const p75Q3Org = getNode(summary, ['non_parametric', 'p75_org'], '0') || '0';
    const p95 = getNode(summary, ['non_parametric', 'p95'], '0') || '0';
    const numOverLower = getNode(summary, ['non_parametric', 'num_over_lower'], '0') || '0';
    const numOverUpper = getNode(summary, ['non_parametric', 'num_over_upper'], '0') || '0';
    const iqr = getNode(summary, ['non_parametric', 'iqr'], '-') || '-';
    const niqr = getNode(summary, ['non_parametric', 'niqr'], '-') || '-';
    const mode = getNode(summary, ['non_parametric', 'mode'], '0') || '0';

    return {
        // count
        ntotal,
        countUnlinked,
        p,
        pMinus,
        pPlus,
        pn,
        pnPlus,
        pnMinus,
        pnProc,
        pnProcPlus,
        pnProcMinus,
        pProc,
        pProcPlus,
        pProcMinus,
        pNA,
        pnNA,
        pNaN,
        pnNaN,
        pInf,
        pnInf,
        pNegInf,
        pnNegInf,
        pTotal,
        pnTotal,
        linkedPct,
        noLinkedPct,
        // basic-statistics
        nStats,
        cp,
        cpk,
        maxValue,
        maxValueOrg,
        minValue,
        minValueOrg,
        bsAverage,
        sigma,
        sigma3,
        // non-parametric
        p95,
        p75Q3,
        p75Q3Org,
        median,
        p25Q1,
        p25Q1Org,
        p5,
        numOverLower,
        numOverUpper,
        iqr,
        niqr,
        mode,
    };
};

const showTabsAndCharts = (eleIdPrefix, data, scaleOption = '1', genTab = true, onlySensorId = null) => {
    let sensors = data.COMMON.GET02_VALS_SELECT || [];
    if (typeof (sensors) === 'string') {
        sensors = [sensors];
    }

    const numSensors = sensors.length;

    // prepare tabs HTML
    if (genTab) {
        let showViewerTab = false;
        if (data.images && data.images.length > 0) {
            showViewerTab = true;
        }
        showResultTabHTMLs(eleIdPrefix, data.ARRAY_FORMVAL, sensors, showViewerTab);
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
        const sensorPlotDatas = eleIdPrefix !== 'directTerm' ? data.array_plotdata[sensor]
            : data.array_plotdata.filter(plot => plot.end_col === Number(sensor));
        if (!sensorPlotDatas) {
            continue;
        }
        const numGraphs = sensorPlotDatas.length;

        // カラム名を取得する。
        const endProc = getEndProcFromFormVal(sensors[sensorIdx], data.ARRAY_FORMVAL);
        const displayColName = getColumnName(endProc, sensor);

        const generalInfo = {
            startProc, endProcName: endProc,
        };

        // /////////////// each histogram ////////////////////
        for (let i = 0; i < numGraphs; i++) {
            // const catValue = sensorPlotDatas[i].cate_name || 'NA';
            const catExpValue = sensorPlotDatas[i].catExpBox || '';
            const categoryValue = catExpValue;
            const termIdx = sensorPlotDatas[i].term_id || 0;

            // get latest thresholds -> show thresholds in scatter, histogram, summary
            const [chartInfos, chartInfosOrg] = getChartInfo(sensorPlotDatas[i]);
            const [latestChartInfo, latestChartInfoIdx] = chooseLatestThresholds(chartInfos, chartInfosOrg);
            const threshHigh = latestChartInfo['thresh-high'];
            const threshLow = latestChartInfo['thresh-low'];
            const prcMax = latestChartInfo['prc-max'];
            const prcMin = latestChartInfo['prc-min'];

            const scaleInfo = getScaleInfo(sensorPlotDatas[i], scaleOption);
            // y_min/max are defined in backend -> get only
            const kdeData = scaleInfo.kde_data;
            const maxY = scaleInfo['y-max'];
            const minY = scaleInfo['y-min'];

            // produce summary data
            const { summaries } = sensorPlotDatas[i];
            const summaryData = calculateSummaryData(summaries, latestChartInfoIdx);

            // create summaries HTMLs
            const summariesHTML = buildHistogramSummariesHTML(eleIdPrefix, i + 1, summaryData, generalInfo);
            const histogramId = `${eleIdPrefix}-${sensor}-${eles.histograms}${i + 1}`;
            const cardHtml = `<div class="${eleIdPrefix} his graph-navi" id="${eles.histograms}${i + 1}">
                <div class="his-content">
                    <div id="${histogramId}" class="hd-plot"
                        style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histHeight};"></div>
                    <div id="${eles.histograms}${i + 1}Summary" class="${eleIdPrefix} hist-summary"
                        style="width: ${GRAPH_CONST.histWidth}; height: ${GRAPH_CONST.histSummaryHeight};">
                        ${summariesHTML}
                    </div>
                </div>
                </div>`;
            tabElement.append(cardHtml);

            const timeCond = data.time_conds[termIdx];
            const histParamObj = {
                tabPrefix: eleIdPrefix,
                canvasId: histogramId,
                xLabel: displayColName,
                yLabelKDE: i18n.yLabelKDE,
                yLabelFreq: i18n.yLabelFreq,
                kdeData,
                sensorName: displayColName,
                categoryValue,
                threshHigh,
                threshLow,
                timeCond,
                minY,
                maxY,
                prcMin,
                prcMax,
                sensorIdx,
            };

            // draw histogram
            HistogramWithDensityCurve($, histParamObj);
        }
        // ////////////////////////////////////
        // report progress
        loadingUpdate(loadingProgressBackend + sensorIdx * ((100 - loadingProgressBackend) / (numSensors || 1)));

        // trigger to fix size of graph
        $('.nav-item').off('click');
        $('.nav-item').on('click', (e) => {
            $(`input[name=${eleIdPrefix}${eles.summaryOption}]:checked`).trigger('change');
        });
    }
};

const setNameWithPrefix = (prefix) => {
    // change name of hist scale select
    $('.scale-dropdown').attr('name', `${prefix}${eles.histScale}`);
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

const bindToChangeSensorItem = () => {
    $('#tabs .nav-link.tab-name').on('click', (e) => {
        let selectedOption;
        const sensorID = $(e.currentTarget).data('sensor-id');
        if (scaleOptions[sensorID]) {
            selectedOption = scaleOptions[sensorID];
        } else {
            selectedOption = formElements.SCALE_DEFAULT_OPTION; // 1 is default option
        }
    });
};
const showGraph = () => {
    const eleIdPrefix = $('select[name=compareType]').val();

    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (!isValid) return;

    // close sidebar
    beforeShowGraphCommon();

    // show loading screen
    loadingShow();

    // reset sumary option
    resetSummaryOption(`${eleIdPrefix}${eles.summaryOption}`);

    // collect form data
    const traceForm = $(eles.mainFormId);
    let formData = new FormData(traceForm[0]);

    formData = transformFacetParams(formData);
    formData = transformDatetimeRange(formData);
    // reformat form data
    formData = reformatFormData(eleIdPrefix, formData);
    formData = transformCategoryVariableParams(formData, procConfigs);

    // validate form
    const validateFlg = isFormDataValid(eleIdPrefix, formData);
    if (validateFlg === 4) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectFacet, i18n.warningTitle);
        return;
    }


    if (validateFlg === 5) {
        loadingHide();
        showToastrMsg(i18n.selectTooManyValue.replace('8', '1'), i18n.warningTitle);
        return;
    }

    if (validateFlg === 1) {
        loadingHide();
        showToastrMsg(i18n.selectTooManyValue, i18n.warningTitle);
        return;
    }
    if (validateFlg !== 0) {
        loadingHide();
        showToastrAnomalGraph();
        return;
    }

    $.ajax({
        url: '/histview2/api/stp/index',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            const t0 = performance.now();
            loadingShow(true);

            // set summary bar for prefix
            setNameWithPrefix(eleIdPrefix);
            // reset scale option
            $(`select[name=${eleIdPrefix}HistScale]`).val(1);
            // show result section
            $('#categoricalPlotArea').show();

            if (res.array_plotdata) {
                if (eleIdPrefix === eles.varTabPrefix) {
                    currentTraceDataVar = res;
                } else if (eleIdPrefix === eles.termTabPrefix) {
                    currentTraceDataTerm = res;
                } else {
                    currentTraceDataCyclicTerm = res;
                }
            }

            // show graphs
            // if (eleIdPrefix === eles.varTabPrefix || eleIdPrefix === eles.cyclicTermTabPrefix) {
            showTabsAndCharts(eleIdPrefix, res, scaleOptionConst.SETTING);

            // Move screen to graph after pushing グラフ表示 button
            $('html, body').animate({
                scrollTop: $(`#${eles.categoryPlotCards}`).offset().top,
            }, 500);

            // check result and show toastr msg
            if (isEmpty(res.array_plotdata) || isEmpty(Object.values(res.array_plotdata)[0])) {
                showToastrAnomalGraph();
            }

            // show limit graphs displayed in one tab message
            if (res.isGraphLimited) {
                showToastrMsg(i18nCommon.limitDisplayedGraphsInOneTab.replace('NUMBER', MAX_NUMBER_OF_GRAPH));
            }

            bindToChangeSensorItem();
            // } else {
            //     // clear old content from card
            //     $('#CatePlotCards').html('');
            //     // show tracedata for term
            //     traceDataChart(eleIdPrefix, res);
            //
            //     // Move screen to graph after pushing グラフ表示 button
            //     $('html, body').animate({
            //         scrollTop: $(`#${eles.categoryPlotCards}`).offset().top,
            //     }, 500);
            //
            //     // check result and show toastr msg
            //     if (isEmpty(res.array_plotdata)) {
            //         showToastrAnomalGraph();
            //     }
            // }

            // show scatter plot tab
            const imgFile = res.images;
            if (imgFile) {
                showScatterPlotImage(imgFile);
            }

            const t1 = performance.now();
            // show processing time at bottom
            drawProcessingTime(t0, t1, res.backend_time, res.actual_record_number);

            // move invalid filter
            setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);
            // if (checkResultExist(res)) {
            //     saveInvalidFilterCaller(true);
            // } else {
            //     saveInvalidFilterCaller();
            // }

            // auto update
            autoUpdate(formData);

            // hide loading inside ajax
            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

            // drag & drop for tables
            $('.ui-sortable').sortable();

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
        afterRequestAction();
    });
};
