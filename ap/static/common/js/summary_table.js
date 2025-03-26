const calculateSummaryData = (summaries = {}, summaryIdx = 0, isHideNonePoint = false) => {
    const summary = summaries[summaryIdx] || {};

    const summaryData = {
        // count
        ntotal: getNode(summary, ['count', 'ntotal'], 0) || 0,
        countUnlinked: getNode(summary, ['count', 'count_unlinked'], 0) || 0,
        p: getNode(summary, ['count', 'p'], '0') || '0',
        pMinus: getNode(summary, ['count', 'p_minus'], '0') || '0',
        pPlus: getNode(summary, ['count', 'p_plus'], '0') || '0',
        pn: getNode(summary, ['count', 'pn'], '0') || '0',
        pnMinus: getNode(summary, ['count', 'pn_minus'], '0') || '0',
        pnPlus: getNode(summary, ['count', 'pn_plus'], '0') || '0',
        pnProc: getNode(summary, ['count', 'pn_proc'], '0') || '0',
        pnProcPlus: getNode(summary, ['count', 'pn_proc_plus'], '0') || '0',
        pnProcMinus: getNode(summary, ['count', 'pn_proc_minus'], '0') || '0',
        pProc: getNode(summary, ['count', 'p_proc'], '0') || '0',
        pProcPlus: getNode(summary, ['count', 'p_proc_plus'], '0') || '0',
        pProcMinus: getNode(summary, ['count', 'p_proc_minus'], '0') || '0',
        pNA: getNode(summary, ['count', 'p_na'], '0') || '0',
        pnNA: getNode(summary, ['count', 'pn_na'], '0') || '0',
        pNaN: getNode(summary, ['count', 'p_nan'], '0') || '0',
        pnNaN: getNode(summary, ['count', 'pn_nan'], '0') || '0',
        pInf: getNode(summary, ['count', 'p_inf'], '0') || '0',
        pnInf: getNode(summary, ['count', 'pn_inf'], '0') || '0',
        pNegInf: getNode(summary, ['count', 'p_neg_inf'], '0') || '0',
        pnNegInf: getNode(summary, ['count', 'pn_neg_inf'], '0') || '0',
        pTotal: getNode(summary, ['count', 'p_total'], '0') || '0',
        pnTotal: getNode(summary, ['count', 'pn_total'], '0') || '0',
        linkedPct: getNode(summary, ['count', 'linked_pct'], '0') || '0',
        noLinkedPct: getNode(summary, ['count', 'no_linked_pct'], '0') || '0',
        //  basic-statistics
        nStats: getNode(summary, ['basic_statistics', 'n_stats'], '-') || '-',
        cp: getNode(summary, ['basic_statistics', 'Cp'], '-') || '-',
        cpk: getNode(summary, ['basic_statistics', 'Cpk'], '-') || '-',
        maxValue: getNode(summary, ['basic_statistics', 'Max'], '0') || '0',
        maxValueOrg: getNode(summary, ['basic_statistics', 'max_org'], '0') || '0',
        minValue: getNode(summary, ['basic_statistics', 'Min'], '0') || '0',
        minValueOrg: getNode(summary, ['basic_statistics', 'min_org'], '0') || '0',
        bsAverage: getNode(summary, ['basic_statistics', 'average'], '0') || '0',
        sigma: getNode(summary, ['basic_statistics', 'sigma'], '0') || '0',
        sigma3: getNode(summary, ['basic_statistics', 'sigma_3'], '0') || '0',
        tnStats: getNode(summary, ['basic_statistics', 't_n_stats'], '-') || '-',
        tcp: getNode(summary, ['basic_statistics', 't_cp'], '-') || '-',
        tcpk: getNode(summary, ['basic_statistics', 't_Cpk'], '-') || '-',
        tmaxValue: getNode(summary, ['basic_statistics', 't_max'], '0') || '0',
        tminValue: getNode(summary, ['basic_statistics', 't_min'], '0') || '0',
        tbsAverage: getNode(summary, ['basic_statistics', 't_average'], '0') || '0',
        tsigma: getNode(summary, ['basic_statistics', 't_sigma'], '0') || '0',
        tsigma3: getNode(summary, ['basic_statistics', 't_sigma_3'], '0') || '0',
        // non-parametric
        median: getNode(summary, ['non_parametric', 'median'], '0') || '0',
        p5: getNode(summary, ['non_parametric', 'p5'], '0') || '0',
        p25Q1: getNode(summary, ['non_parametric', 'p25'], '0') || '0',
        p25Q1Org: getNode(summary, ['non_parametric', 'p25_org'], '0') || '0',
        p75Q3: getNode(summary, ['non_parametric', 'p75'], '0') || '0',
        p75Q3Org: getNode(summary, ['non_parametric', 'p75_org'], '0') || '0',
        p95: getNode(summary, ['non_parametric', 'p95'], '0') || '0',
        numOverLower: getNode(summary, ['non_parametric', 'num_over_lower'], '0') || '0',
        numOverUpper: getNode(summary, ['non_parametric', 'num_over_upper'], '0') || '0',
        iqr: getNode(summary, ['non_parametric', 'iqr'], '-') || '-',
        niqr: getNode(summary, ['non_parametric', 'niqr'], '-') || '-',
        mode: getNode(summary, ['non_parametric', 'mode'], '0') || '0',
    };

    if (isHideNonePoint) {
        let nTotal = summaryData.ntotal;
        if (nTotal > 0) {
            const nNA = summaryData.pnNA;
            nTotal = nTotal - nNA;
            summaryData.ntotal = nTotal;
            summaryData.pNA = 0;
            summaryData.pTotal = 0;
            summaryData.pnTotal = 0;
            summaryData.pnNA = 0;
        }
    }

    return summaryData;
};

const isHideNoneDataPoint = (procId, colId, isRemoveOutlier) => {
    const col = procConfigs[procId].getColumnById(colId) || {};
    const isCTCol = isCycleTimeCol(procId, colId);

    const isHideNonePoint =
        (Boolean(isRemoveOutlier) &&
            [DataTypes.REAL.name, DataTypes.INTEGER.name, DataTypes.TEXT.name].includes(col.data_type)) ||
        isCTCol;
    return isHideNonePoint;
};

const buildSummaryResultsHTML = (
    summaryOption,
    tableIndex,
    generalInfo,
    beforeRankValues = null,
    stepChartSummary = null,
) => {
    const [nTotalHTML, noLinkedHTML] = genTotalAndNonLinkedHTML(summaryOption, generalInfo);

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
                    <td>${applySignificantDigit(summaryOption.countUnlinked)} (${applySignificantDigit(summaryOption.noLinkedPct)}%)</td>
                </tr>`;
            }
            const naAfterLinkedPctg = stepChartSummary.n_na_pctg - summaryOption.noLinkedPct;
            stepChartNTotalHTML = `<tr>
                    <td><span class="hint-text" title="${i18nCommon.hoverNTotal}">N<sub>total</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_total) ? '-' : `${applySignificantDigit(stepChartSummary.n_total)} (100%)`}
                    </td>
                </tr>`;
            stepChartStatHTML = `<tr>
                    <td><span class="item-name">N</span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n) ? '-' : `${applySignificantDigit(stepChartSummary.n)} (${stepChartSummary.n_pctg}%)`}
                    </td>
                </tr>
                <tr>
                    <td><span class="item-name">N<sub>NA</sub></span></td>
                    <td>
                        ${isEmpty(stepChartSummary.n_na) ? '-' : `${applySignificantDigit(naAfterLinked)} (${naAfterLinkedPctg}%)`}
                    </td>
                </tr>
                ${stepChartStatUnLinkedHTML}`;
        }
        return `
        <table class="hist-summary-detail result count" style="margin-top: 10px;">
            <tbody>
                ${stepChartNTotalHTML}
                ${stepChartStatHTML}
            </tbody>
        </table>
        <table class="hist-summary-detail result basic-statistics" style="margin-top: 10px;">
            <tbody>
                <tr>
                    <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                    <td>
                        ${isEmpty(summaryOption.nStats) ? '-' : applySignificantDigit(summaryOption.nStats)}
                    </td>
                </tr>
            </tbody>
        </table>
        <table class="hist-summary-detail result non-parametric" style="margin-top: 10px;">
        </table>
        `;
    }

    return `
    <table class="hist-summary-detail result count" style="margin-top: 10px;">
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
                    <span class="summary-value tooltip-parent">${applySignificantDigit(summaryOption.p)}% (${applySignificantDigit(summaryOption.pn)})
                        <span class="tooltip-content">
                            outCL+ : ${applySignificantDigit(summaryOption.pPlus)}% (${applySignificantDigit(summaryOption.pnPlus)})<br>
                            outCL- : ${applySignificantDigit(summaryOption.pMinus)}% (${applySignificantDigit(summaryOption.pnMinus)})<br>
                        </span>
                    </span>
                </td>
            </tr>
            <tr>
                <td>
                    <span class="item-name hint-text" title="${i18nCommon.hoverOutAL}">outAL</span>
                </td>
                <td>
                    <span class="summary-value tooltip-parent">${applySignificantDigit(summaryOption.pProc)}% (${applySignificantDigit(summaryOption.pnProc)})
                        <span class="tooltip-content">
                            outAL+ : ${applySignificantDigit(summaryOption.pProcPlus)}% (${applySignificantDigit(summaryOption.pnProcPlus)})<br>
                            outAL- : ${applySignificantDigit(summaryOption.pProcMinus)}% (${applySignificantDigit(summaryOption.pnProcMinus)})<br>
                        </span>
                    </span>    
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNA}">P<sub>NA</sub></span></td>
                <td id="average-${tableIndex}">${applySignificantDigit(summaryOption.pNA)}% (${applySignificantDigit(summaryOption.pnNA)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPNaN}">P<sub>NaN</sub></span></td>
                <td id="average-${tableIndex}">${applySignificantDigit(summaryOption.pNaN)}% (${applySignificantDigit(summaryOption.pnNaN)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfPlus}">P<sub>Inf+</sub></span></td>
                <td id="average-${tableIndex}">${applySignificantDigit(summaryOption.pInf)}% (${applySignificantDigit(summaryOption.pnInf)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPInfMinus}">P<sub>Inf-</sub></span></td>
                <td id="average-${tableIndex}">${applySignificantDigit(summaryOption.pNegInf)}% (${applySignificantDigit(summaryOption.pnNegInf)})</td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverPTotal}">P<sub>Total</sub></span></td>
                <td id="average-${tableIndex}">${applySignificantDigit(summaryOption.pTotal)}% (${applySignificantDigit(summaryOption.pnTotal)})</td>
            </tr>
            ${noLinkedHTML}
        </tbody>
    </table>
    <table class="hist-summary-detail result basic-statistics" style="margin-top: 10px;">
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverN}">N</span></td>
                <td>
                    ${isEmpty(summaryOption.nStats) ? '-' : applySignificantDigit(summaryOption.nStats)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.average}</span></td>
                <td id="arrayNum-${tableIndex}">
                    ${isEmpty(summaryOption.bsAverage) ? '-' : applySignificantDigit(summaryOption.bsAverage)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">3σ</span></td>
                <td id="stdev-${tableIndex}">
                    ${isEmpty(summaryOption.sigma3) ? '-' : applySignificantDigit(summaryOption.sigma3)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cp</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.cp) ? '-' : applySignificantDigit(summaryOption.cp)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">Cpk</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.cpk) ? '-' : applySignificantDigit(summaryOption.cpk)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">σ</span></td>
                <td id="average-${tableIndex}">
                    ${isEmpty(summaryOption.sigma) ? '-' : applySignificantDigit(summaryOption.sigma)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.maxValue || '最大値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.maxValue) ? '-' : applySignificantDigit(summaryOption.maxValue)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name">${i18nCommon.minValue || '最小値'}</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.minValue) ? '-' : applySignificantDigit(summaryOption.minValue)}
                </td>
            </tr>
        </tbody>
    </table>
    <table class="hist-summary-detail result non-parametric" style="margin-top: 10px;">
        <tbody>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMedian}">${i18nCommon.median || '中央値'}</span></td>
                <td id="stdev-${tableIndex}">
                    ${isEmpty(summaryOption.median) ? '-' : applySignificantDigit(summaryOption.median)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP95}">P95</span></td>
                <td id="arrayNum-${tableIndex}">
                    ${isEmpty(summaryOption.p95) ? '-' : applySignificantDigit(summaryOption.p95)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP75Q3}">P75 Q3</span></td>
                <td id="average-${tableIndex}">
                    ${isEmpty(summaryOption.p75Q3) ? '-' : applySignificantDigit(summaryOption.p75Q3)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP25Q1}">P25 Q1</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.p25Q1) ? '-' : applySignificantDigit(summaryOption.p25Q1)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverP5}">P5</span></td>
                <td id="ucl-${tableIndex}">
                    ${isEmpty(summaryOption.p5) ? '-' : applySignificantDigit(summaryOption.p5)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverIQR}">IQR</span></td>
                <td>
                    ${isEmpty(summaryOption.iqr) ? '-' : applySignificantDigit(summaryOption.iqr)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverNIQR}">NIQR</span></td>
                <td>
                    ${isEmpty(summaryOption.niqr) ? '-' : applySignificantDigit(summaryOption.niqr)}
                </td>
            </tr>
            <tr>
                <td><span class="item-name hint-text" title="${i18nCommon.hoverMode}">Mode</span></td>
                <td>
                    ${isEmpty(summaryOption.mode) ? '-' : applySignificantDigit(summaryOption.mode)}
                </td>
            </tr>
        </tbody>
    </table>`;
};
