const calculateSummaryData = (arrayPlotdata = {}, summaryIdx = 0) => {
    const summaries = arrayPlotdata.summaries[summaryIdx] || {};

    const summaryData = {
        // count
        ntotal: getNode(summaries, ['count', 'ntotal'], 0) || 0,
        countUnlinked: getNode(summaries, ['count', 'count_unlinked'], 0) || 0,
        p: getNode(summaries, ['count', 'p'], '0') || '0',
        pMinus: getNode(summaries, ['count', 'p_minus'], '0') || '0',
        pPlus: getNode(summaries, ['count', 'p_plus'], '0') || '0',
        pn: getNode(summaries, ['count', 'pn'], '0') || '0',
        pnMinus: getNode(summaries, ['count', 'pn_minus'], '0') || '0',
        pnPlus: getNode(summaries, ['count', 'pn_plus'], '0') || '0',
        pnProc: getNode(summaries, ['count', 'pn_proc'], '0') || '0',
        pnProcPlus: getNode(summaries, ['count', 'pn_proc_plus'], '0') || '0',
        pnProcMinus: getNode(summaries, ['count', 'pn_proc_minus'], '0') || '0',
        pProc: getNode(summaries, ['count', 'p_proc'], '0') || '0',
        pProcPlus: getNode(summaries, ['count', 'p_proc_plus'], '0') || '0',
        pProcMinus: getNode(summaries, ['count', 'p_proc_minus'], '0') || '0',
        pNA: getNode(summaries, ['count', 'p_na'], '0') || '0',
        pnNA: getNode(summaries, ['count', 'pn_na'], '0') || '0',
        pNaN: getNode(summaries, ['count', 'p_nan'], '0') || '0',
        pnNaN: getNode(summaries, ['count', 'pn_nan'], '0') || '0',
        pInf: getNode(summaries, ['count', 'p_inf'], '0') || '0',
        pnInf: getNode(summaries, ['count', 'pn_inf'], '0') || '0',
        pNegInf: getNode(summaries, ['count', 'p_neg_inf'], '0') || '0',
        pnNegInf: getNode(summaries, ['count', 'pn_neg_inf'], '0') || '0',
        pTotal: getNode(summaries, ['count', 'p_total'], '0') || '0',
        pnTotal: getNode(summaries, ['count', 'pn_total'], '0') || '0',
        linkedPct: getNode(summaries, ['count', 'linked_pct'], '0') || '0',
        noLinkedPct: getNode(summaries, ['count', 'no_linked_pct'], '0') || '0',
        //  basic-statistics
        nStats: getNode(summaries, ['basic_statistics', 'n_stats'], '-') || '-',
        cp: getNode(summaries, ['basic_statistics', 'Cp'], '-') || '-',
        cpk: getNode(summaries, ['basic_statistics', 'Cpk'], '-') || '-',
        maxValue: getNode(summaries, ['basic_statistics', 'Max'], '0') || '0',
        maxValueOrg: getNode(summaries, ['basic_statistics', 'max_org'], '0') || '0',
        minValue: getNode(summaries, ['basic_statistics', 'Min'], '0') || '0',
        minValueOrg: getNode(summaries, ['basic_statistics', 'min_org'], '0') || '0',
        bsAverage: getNode(summaries, ['basic_statistics', 'average'], '0') || '0',
        sigma: getNode(summaries, ['basic_statistics', 'sigma'], '0') || '0',
        sigma3: getNode(summaries, ['basic_statistics', 'sigma_3'], '0') || '0',
        tnStats: getNode(summaries, ['basic_statistics', 't_n_stats'], '-') || '-',
        tcp: getNode(summaries, ['basic_statistics', 't_cp'], '-') || '-',
        tcpk: getNode(summaries, ['basic_statistics', 't_Cpk'], '-') || '-',
        tmaxValue: getNode(summaries, ['basic_statistics', 't_max'], '0') || '0',
        tminValue: getNode(summaries, ['basic_statistics', 't_min'], '0') || '0',
        tbsAverage: getNode(summaries, ['basic_statistics', 't_average'], '0') || '0',
        tsigma: getNode(summaries, ['basic_statistics', 't_sigma'], '0') || '0',
        tsigma3: getNode(summaries, ['basic_statistics', 't_sigma_3'], '0') || '0',
        // non-parametric
        median: getNode(summaries, ['non_parametric', 'median'], '0') || '0',
        p5: getNode(summaries, ['non_parametric', 'p5'], '0') || '0',
        p25Q1: getNode(summaries, ['non_parametric', 'p25'], '0') || '0',
        p25Q1Org: getNode(summaries, ['non_parametric', 'p25_org'], '0') || '0',
        p75Q3: getNode(summaries, ['non_parametric', 'p75'], '0') || '0',
        p75Q3Org: getNode(summaries, ['non_parametric', 'p75_org'], '0') || '0',
        p95: getNode(summaries, ['non_parametric', 'p95'], '0') || '0',
        numOverLower: getNode(summaries, ['non_parametric', 'num_over_lower'], '0') || '0',
        numOverUpper: getNode(summaries, ['non_parametric', 'num_over_upper'], '0') || '0',
        iqr: getNode(summaries, ['non_parametric', 'iqr'], '-') || '-',
        niqr: getNode(summaries, ['non_parametric', 'niqr'], '-') || '-',
        mode: getNode(summaries, ['non_parametric', 'mode'], '0') || '0',
    };

    return summaryData;
};

const buildSummaryResultsHTML = (summaryOption, tableIndex, generalInfo, beforeRankValues = null, stepChartSummary = null, isCTCol = false) => {
    const [nTotalHTML, noLinkedHTML] = genTotalAndNonLinkedHTML(summaryOption, generalInfo);
    const { getProc } = generalInfo;
    const { getVal } = generalInfo;
    const { catExpBox } = generalInfo;
    let catExpBoxHtml = '';

    let CTLabel = '';
    if (isCTCol) {
        CTLabel = `(${DataTypes.DATETIME.short}) [sec]`;
    }

    if (catExpBox) {
        const hasLevel2 = catExpBox.toString().split('|').length === 2;
        catExpBoxHtml = `
        <tr>
            <th colspan="2">
                <span class="prc-name show-detail cat-exp-box" title="${hasLevel2 ? 'Level1 | Level2' : 'Level1'}">${catExpBox}</span>
            </td>
        </tr>`;
    }

    const tableTitle = `
        <thead>
        <tr>
            <th colspan="2">
                <span class="prc-name" title="${getProc}">${getProc}</span>
            </td>
        </tr>
        <tr>
            <th colspan="2">
                <span class="prc-name" title="${getVal}">${getVal} ${CTLabel}</span>
            </td>
        </tr>
        ${catExpBoxHtml}
        </thead>
    `;

    if (beforeRankValues) {
        let stepChartStatHTML = '';
        let stepChartNTotalHTML = `<tr>
            <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
            <td>
                ${nTotalHTML}
            </td>
        </tr>`;
        if (stepChartSummary) {
            let stepChartStatUnLinkedHTML = '';
            const naAfterLinked = stepChartSummary.n_na - summaryOption.countUnlinked;
            if (`${generalInfo.endProcName}` !== `${generalInfo.startProc}`) {
                stepChartStatUnLinkedHTML = `<tr>
                    <td><span class="">N<sub>NoLinked</sub></span></td>
                    <td>${formatNumberWithCommas(summaryOption.countUnlinked)} (${summaryOption.noLinkedPct}%)</td>
                </tr>`;
            }
            const naAfterLinkedPctg = stepChartSummary.n_na_pctg - summaryOption.noLinkedPct;
            stepChartNTotalHTML = `<tr>
                    <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_total) ? '-' : `${formatNumberWithCommas(stepChartSummary.n_total)} (100%)`}
                    </td>
                </tr>`;
            stepChartStatHTML = `<tr>
                    <td><span class="item-name">N</span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n) ? '-' : `${formatNumberWithCommas(stepChartSummary.n)} (${stepChartSummary.n_pctg}%)`}
                    </td>
                </tr>
                <tr>
                    <td><span class="item-name">N<sub>NA</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_na) ? '-' : `${formatNumberWithCommas(naAfterLinked)} (${naAfterLinkedPctg}%)`}
                    </td>
                </tr>
                ${stepChartStatUnLinkedHTML}`;
        }
        return `
        <table class="result count" style="margin-top: 10px;">
            ${tableTitle}
            <tbody>
                ${stepChartNTotalHTML}
                ${stepChartStatHTML}
            </tbody>
        </table>
        <table class="result basic-statistics" style="margin-top: 10px;">
            ${tableTitle}
            <tbody>
                <tr>
                    <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                    <td>
                        ${isEmpty(summaryOption.nStats) ? '-' : formatNumberWithCommas(summaryOption.nStats)}
                    </td>
                </tr>
            </tbody>
        </table>
        <table class="result non-parametric" style="margin-top: 10px;">
            ${tableTitle}
        </table>
        `;
    }

    return `
    <table class="result count" style="margin-top: 10px;">
        ${tableTitle}
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
                    <span class="summary-value tooltip-parent">${summaryOption.p}% (${summaryOption.pn})
                        <span class="tooltip-content">
                            outCL+ : ${summaryOption.pPlus}% (${summaryOption.pnPlus})<br>
                            outCL- : ${summaryOption.pMinus}% (${summaryOption.pnMinus})<br>
                        </span>
                    </span>
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.hoverOutAL}">outAL</span>
                </td>
                <td>
                    <span class="summary-value tooltip-parent">${summaryOption.pProc}% (${summaryOption.pnProc})
                        <span class="tooltip-content">
                            outAL+ : ${summaryOption.pProcPlus}% (${summaryOption.pnProcPlus})<br>
                            outAL- : ${summaryOption.pProcMinus}% (${summaryOption.pnProcMinus})<br>
                        </span>
                    </span>    
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNA}">P<sub>NA</sub></span></td>
                <td id="average-${tableIndex}">${summaryOption.pNA}% (${formatNumberWithCommas(summaryOption.pnNA)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNaN}">P<sub>NaN</sub></span></td>
                <td id="average-${tableIndex}">${summaryOption.pNaN}% (${formatNumberWithCommas(summaryOption.pnNaN)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfPlus}">P<sub>Inf+</sub></span></td>
                <td id="average-${tableIndex}">${summaryOption.pInf}% (${formatNumberWithCommas(summaryOption.pnInf)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfMinus}">P<sub>Inf-</sub></span></td>
                <td id="average-${tableIndex}">${summaryOption.pNegInf}% (${formatNumberWithCommas(summaryOption.pnNegInf)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPTotal}">P<sub>Total</sub></span></td>
                <td id="average-${tableIndex}">${summaryOption.pTotal}% (${formatNumberWithCommas(summaryOption.pnTotal)})</td>
            </tr>
            ${noLinkedHTML}
        </tbody>
    </table>
    <table class="result basic-statistics" style="margin-top: 10px;">
        ${tableTitle}
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                <td>
                    ${isEmpty(summaryOption.nStats) ? '-' : formatNumberWithCommas(summaryOption.nStats)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.average}</span></td>
                <td id="arrayNum-${tableIndex}">
                    ${isEmpty(summaryOption.bsAverage) ? '-' : formatNumberWithCommas(summaryOption.bsAverage)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">3σ</span></td>
                <td id="stdev-${tableIndex}">
                    ${isEmpty(summaryOption.sigma3) ? '-' : formatNumberWithCommas(summaryOption.sigma3)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cp</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.cp) ? '-' : formatNumberWithCommas(summaryOption.cp)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cpk</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.cpk) ? '-' : formatNumberWithCommas(summaryOption.cpk)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">σ</span></td>
                <td id="average-${tableIndex}">
                    ${isEmpty(summaryOption.sigma) ? '-' : formatNumberWithCommas(summaryOption.sigma)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.maxValue || '最大値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.maxValue) ? '-' : formatNumberWithCommas(summaryOption.maxValue)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.minValue || '最小値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.minValue) ? '-' : formatNumberWithCommas(summaryOption.minValue)}
                </td>
            </tr>
        </tbody>
    </table>
    <table class="result non-parametric" style="margin-top: 10px;">
        ${tableTitle}
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMedian}">${i18nCommon.median || '中央値'}</span></td>
                <td id="stdev-${tableIndex}">
                    ${isEmpty(summaryOption.median) ? '-' : formatNumberWithCommas(summaryOption.median)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP95}">P95</span></td>
                <td id="arrayNum-${tableIndex}">
                    ${isEmpty(summaryOption.p95) ? '-' : formatNumberWithCommas(summaryOption.p95)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP75Q3}">P75 Q3</span></td>
                <td id="average-${tableIndex}">
                    ${isEmpty(summaryOption.p75Q3) ? '-' : formatNumberWithCommas(summaryOption.p75Q3)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP25Q1}">P25 Q1</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.p25Q1) ? '-' : formatNumberWithCommas(summaryOption.p25Q1)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP5}">P5</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.p5) ? '-' : formatNumberWithCommas(summaryOption.p5)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverIQR}">IQR</span></td>
                <td>
                    ${isEmpty(summaryOption.iqr) ? '-' : formatNumberWithCommas(summaryOption.iqr)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverNIQR}">NIQR</span></td>
                <td>
                    ${isEmpty(summaryOption.niqr) ? '-' : formatNumberWithCommas(summaryOption.niqr)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMode}">Mode</span></td>
                <td>
                    ${isEmpty(summaryOption.mode) ? '-' : formatNumberWithCommas(summaryOption.mode)}
                </td>
            </tr>
        </tbody>
    </table>`;
};

const removeClass = (element) => {
    const colClasses = element.prop('className').split(' ').filter(x => x.startsWith('col-sm'));
    for (const cls of colClasses) {
        element.removeClass(cls);
    }
};

const onChangeSummaryEventHandler = (showScatterPlot) => {
    $('input[name=summaryOption]').on('change', function f() {
        const summaryClass = $(this).val();

        if (summaryClass === 'none') {
            $('.time-series').each(function changeColWidth() {
                removeClass($(this));
                if (!showScatterPlot) {
                    $(this).addClass('col-sm-9');
                } else {
                    $(this).addClass('col-sm-8');
                }
            });

            $('.summary-col').each(function showHideSummary() {
                $(this).removeClass('col-sm-2');
                $(this).css('display', 'none');
            });
            $('.ts-col').each(function changeTSChartWidth() {
                $(this).removeClass('col-sm-10');
                $(this).addClass('col-sm-12');
            });

            $('.tschart-title-parent').show();
        } else {
            $('.time-series').each(function changeColWidth() {
                removeClass($(this));
                if (!showScatterPlot) {
                    $(this).addClass('col-sm-9');
                } else {
                    $(this).addClass('col-sm-8');
                }
            });
            $('.ts-col').each(function changeTSChartWidth() {
                $(this).removeClass('col-sm-12');
                $(this).addClass('time-series-col');
            });
            $('.summary-col').each(function showHideSummary() {
                $(this).css('display', 'block');
            });
            $('.result').each(function showUponOption() {
                $(this).css('display', 'none');
                if ($(this).hasClass(summaryClass)) {
                    $(this).css('display', 'block');
                }
            });
            $('.tschart-title-parent').hide();
        }
        // adjust cate-table length
        // get width of current Time Series chart
        setTimeout(() => {
            adjustCatetoryTableLength();
        }, 500);
    });
};


const onChangeHistSummaryEventHandler = () => {
    $('input[name=histSummaryOption]').on('change', function f() {
        let summaryHeight = null;
        const summaryClass = $(this).val();
        const previousOption = $('input[name=histSummaryOption][data-checked=true]');
        if (summaryClass === 'none') {
            $('.hist-summary').each(function showHideSummary() {
                $(this).css('display', 'none');
            });

            if (previousOption.val() && previousOption.val() !== 'none') {
                // rescale histogram
                $('.his .hd-plot').each(function reScaleHistogram() {
                    const histogramId = $(this).attr('id');
                    $(`#${histogramId}`).css('height', GRAPH_CONST.histHeight);
                    Plotly.relayout(histogramId, {});
                });
            }

            // mark this option as checked and remove others
            $(this).attr('data-checked', 'true');
            $('input[name=histSummaryOption]:not(:checked)').removeAttr('data-checked');
        } else {
            $('.hist-summary').each(function showHideSummary() {
                $(this).css('display', 'flex');
                $(this).css('justify-content', 'center');
            });
            $('.hist-summary-detail').each(function showUponOption() {
                $(this).css('display', 'none');
                if ($(this).hasClass(summaryClass)) {
                    $(this).css('display', 'block');
                    const h = $(this).height();
                    summaryHeight = h < summaryHeight ? summaryHeight : h;
                }
            });

            // rescale only when from none -> not-none or not-none -> none to improve performance
            $('.his .hd-plot').each(function reScaleHistogram() {
                const histogramId = $(this).attr('id');
                const chartHeight = `calc(100% - ${summaryHeight + 6}px)`;
                $(`#${histogramId}`).css('height', chartHeight);
                Plotly.relayout(histogramId, {});
            });


            // mark this option as checked and remove others
            $(this).attr('data-checked', 'true');
            $('input[name=histSummaryOption]:not(:checked)').removeAttr('data-checked');
        }
    });
};

const buildHistogramSummariesHTML = (tableIndex, chartOption, generalInfo, beforeRankValues = null, stepChartSummary = null) => {
    const [nTotalHTML, noLinkedHTML] = genTotalAndNonLinkedHTML(chartOption, generalInfo);

    if (beforeRankValues) {
        let stepChartStatHTML = '';
        let stepChartNTotalHTML = `<tr>
            <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
            <td>
                ${nTotalHTML}
            </td>
        </tr>`;
        if (stepChartSummary) {
            let stepChartStatUnLinkedHTML = '';
            const naAfterLinked = stepChartSummary.n_na - chartOption.countUnlinked;
            if (`${generalInfo.endProcName}` !== `${generalInfo.startProc}`) {
                stepChartStatUnLinkedHTML = `<tr>
                    <td><span class="">N<sub>NoLinked</sub></span></td>
                    <td>${chartOption.countUnlinked} (${chartOption.noLinkedPct}%)</td>
                </tr>`;
            }
            const naAfterLinkedPctg = stepChartSummary.n_na_pctg - chartOption.noLinkedPct;
            stepChartNTotalHTML = `<tr>
                    <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_total) ? '-' : `${formatNumberWithCommas(stepChartSummary.n_total)} (100%)`}
                    </td>
                </tr>`;
            stepChartStatHTML = `<tr>
                    <td><span class="item-name">N</span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n) ? '-' : `${formatNumberWithCommas(stepChartSummary.n)} (${stepChartSummary.n_pctg}%)`}
                    </td>
                </tr>
                <tr>
                    <td><span class="item-name">N<sub>NA</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_na) ? '-' : `${naAfterLinked} (${naAfterLinkedPctg}%)`}
                    </td>
                </tr>
                ${stepChartStatUnLinkedHTML}`;
        }
        return `
        <table class="hist-summary-detail count" style="margin-top: 10px;">
            <tbody>
                ${stepChartNTotalHTML}
                ${stepChartStatHTML}
            </tbody>
        </table>
        <table class="hist-summary-detail basic-statistics" style="margin-top: 10px;">
            <tbody>
                <tr>
                    <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                    <td>
                        ${isEmpty(chartOption.nStats) ? '-' : chartOption.nStats}
                    </td>
                </tr>
            </tbody>
        </table>
        <table class="hist-summary-detail non-parametric" style="margin-top: 10px;">
        </table>`;
    }

    return `
    <table class="hist-summary-detail count">
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
    <table class="hist-summary-detail basic-statistics" >
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
                <td><span class="item-name">${i18nCommon.maxValue || '最大値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.maxValue) ? '-' : chartOption.maxValue}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.minValue || '最小値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(chartOption.minValue) ? '-' : chartOption.minValue}
                </td>
            </tr>
        </tbody>
    </table>
    <table class="hist-summary-detail non-parametric">
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
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMode}">Mode</span></td>
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
