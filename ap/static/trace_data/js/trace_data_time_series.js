let avoidMultiClickCntTS = 0;
const THIN_DATA_COUNT = 4000;
// limit category label to show as substring
// and three dots ('JP0123...')
const CAT_LABEL_LIMIT = 12;

function YasuTsChart(
    $,
    paramObj,
    chartLabels = null,
    tabID = null,
    xaxis = 'TIME',
) {
    const canvasId = setParam('canvasId', 'chart01');
    const procId = setParam('procId', null);
    let tsData = setParam('tsData', []);
    let plotData = setParam('plotData', []);
    let plotDataMin = setParam('plotDataMin', []);
    let plotDataMax = setParam('plotDataMax', []);
    const beforeRankValues = setParam('beforeRankValues', null);
    const dictIdx2YValue = setParam('dictIdx2YValue', []);
    let plotDataEx = setParam('plotDataEx', []);
    let plotDataExColor = setParam('plotDataExColor', []);
    const minX = setParam('minX', '');
    const maxX = setParam('maxX', '');
    const startPoint = setParam('startPoint', '');
    const endPoint = setParam('endPoint', '');
    const convertFunc = setParam('convertFunc', '');
    const chartInfos = setParam('chartInfos', []);

    const noneIdxs = setParam('noneIdxs', []);
    const unlinkedIdxs = setParam('unlinkedIdxs', []);
    const infIdxs = setParam('infIdxs', []);
    const negInfIdxs = setParam('negInfIdxs', []);
    const slotFrom = setParam('slotFrom', []);
    const slotTo = setParam('slotTo', []);
    const slotCount = setParam('slotCount', []);

    const isCatLimited = setParam('isCatLimited', false);

    // ヒストグラムとY軸の範囲を合わせる
    let minY = setParam('minY', null);
    let maxY = setParam('maxY', null);
    if (minY === null || maxY === null) {
        const [yMin, yMax] = findMinMax(plotData);
        minY = minY === null ? yMin : minY;
        maxY = maxY === null ? yMax : maxY;
    }

    const isThinData = setParam('isThinData', false);

    if (beforeRankValues) {
        minY -= CONST.RESIZE_RANGE_CHART;
        maxY += CONST.RESIZE_RANGE_CHART;
    }

    // NOTE: append start_datetime and end_datetime in GUI to data.
    // data in chart will have 2 more data points compared to original data.
    // tsData = [startPoint, ...tsData, endPoint];
    // plotData = [null, ...plotData, null];
    // if (plotDataMin.length) {
    //     plotDataMin = [null, ...plotDataMin, null];
    // }
    // if (plotDataMax.length) {
    //     plotDataMax = [null, ...plotDataMax, null];
    // }
    //
    // plotDataEx = [null, ...plotDataEx, null];
    // plotDataExColor = [null, ...plotDataExColor, null];

    // // ////////////// プライベート関数の定義 ////////////////////
    function setParam(key, defaultValue) {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    }

    const decimation = {
        enabled: true,
        algorithm: 'min-max',
    };

    let tickConfig = {
        rotation: 0,
    };
    if (xaxis === CONST.XOPT_INDEX) {
        tickConfig = {
            rotation: 0,
        };
    }

    const genXTicks = (isThin) => {
        const ticks = [1];
        // const maxTick = isThin ? THIN_DATA_COUNT : plotData.length;
        const maxTick = plotData.length;
        const tickCount = 8;
        if (maxTick < tickCount) {
            for (let i = 2; i <= maxTick; i++) {
                ticks.push(i);
            }
            return ticks;
        }

        let step = (maxTick / tickCount).toFixed(0);
        const zeroPad = step.length - 1;
        const zeroPadStr = ''.padEnd(zeroPad, '0');
        let checkAllEndZero = true;
        for (let i = 1; i < step.length; i++) {
            if (step[i] !== '0') {
                checkAllEndZero = false;
                break;
            }
        }

        if (!checkAllEndZero) {
            step = String(parseInt(step[0]) + 1);
            step = step + zeroPadStr;
            step = parseInt(step);
        }

        let lastTick = 1;
        for (let i = 1; i <= tickCount; i++) {
            const label = i * step;
            if (label < maxTick && label > lastTick) {
                ticks.push(label);
                lastTick = label;
            }
        }

        if (maxTick - lastTick < step / 2) {
            ticks[ticks.length - 1] = maxTick;
        } else {
            ticks.push(maxTick);
        }

        return ticks;
    };

    // get tooltip of fpp chart
    const getOrCreateTooltip = (chart) => {
        let tooltipEl = chart.canvas.parentNode.querySelector('div');

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.style.width = '230px';
            tooltipEl.style.background = 'rgba(0, 0, 0, 0.7)';
            tooltipEl.style.borderRadius = '3px';
            tooltipEl.style.color = 'white';
            tooltipEl.style.opacity = '1';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.position = 'absolute';
            tooltipEl.style.transform = 'translate(-50%, 0)';
            tooltipEl.style.transition = 'all .1s ease';
            tooltipEl.style.zIndex = '999999';
            tooltipEl.style.fontSize = 'smaller';

            const table = document.createElement('table');
            table.style.margin = '0px';

            tooltipEl.appendChild(table);
            chart.canvas.parentNode.appendChild(tooltipEl);
        }

        return tooltipEl;
    };

    function isOutlierValue(dataIndex, outlierDict) {
        return Object.keys(outlierDict).includes(dataIndex.toString());
    }

    // external handler of tooltip
    const externalTooltipHandler = (context) => {
        // Tooltip Element
        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateTooltip(chart);
        if (!tooltip.dataPoints) return;
        // Hide if no tooltip
        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const dataPoint = tooltip.dataPoints[0];
        const outlierDict = chart.data.datasets[0].dictIdx2YValue;

        // get datapoint value
        const getDatYVal = (dataPoint, dicRankLabels = null, outlierDict) => {
            const datasetIndex = dataPoint.datasetIndex;
            const dataIndex = dataPoint.dataIndex;
            if (datasetIndex === CONST.IRREGULAR_DATASET) {
                if (infIdxs.includes(dataIndex)) {
                    return CONST.INF;
                }
                if (negInfIdxs.includes(dataIndex)) {
                    return CONST.NEG_INF;
                }
                if (noneIdxs.includes(dataIndex)) {
                    return COMMON_CONSTANT.NA;
                }
                if (unlinkedIdxs.includes(dataIndex)) {
                    return CONST.NO_LINKED;
                }
                if (isOutlierValue(dataIndex, outlierDict)) {
                    // Sprint 79 #12: Display actual value if type is OUTLIER
                    // return `${i18n.outlierVal}: ${applySignificantDigit(outlierDict[dataIndex])}`;
                    return applySignificantDigit(outlierDict[dataIndex]);
                }
            }
            const y = dataPoint.parsed.y;
            if (dicRankLabels) {
                const rankLabel = dicRankLabels[y];
                return rankLabel
                    ? `Cat${`0${Number(y)}`.slice(-2)}: ${rankLabel}`
                    : COMMON_CONSTANT.NA;
            }

            return `${applySignificantDigit(y)}`;
        };

        const getDatYMinMaxVal = (dataPoint, dataMin, dataMax, outlierDict) => {
            const datasetIndex = dataPoint.datasetIndex;
            const dataIndex = dataPoint.dataIndex;
            let medVal = dataPoint.parsed.y;
            let minVal = '';
            let maxVal = '';
            const inf = CONST.INF;
            const negInf = CONST.NEG_INF;
            const noLinked = CONST.NO_LINKED;

            if (datasetIndex === CONST.IRREGULAR_DATASET) {
                if (infIdxs.includes(dataIndex)) {
                    medVal = inf;
                }
                if (negInfIdxs.includes(dataIndex)) {
                    medVal = negInf;
                }
                if (noneIdxs.includes(dataIndex)) {
                    medVal = COMMON_CONSTANT.NA;
                }
                if (unlinkedIdxs.includes(dataIndex)) {
                    medVal = noLinked; // TODO which label for unlinked data?
                }
                if (isOutlierValue(dataIndex, outlierDict)) {
                    // Sprint 79 #12: Display actual value if type is OUTLIER
                    // return `${i18n.outlierVal}: ${applySignificantDigit(outlierDict[dataIndex])}`;
                    medVal = applySignificantDigit(outlierDict[dataIndex]);
                }
            }

            if (dataMin) {
                minVal = applySignificantDigit(dataMin[dataIndex]);
            }
            if (dataMax) {
                maxVal = applySignificantDigit(dataMax[dataIndex]);
            }

            if (inf === medVal && inf === minVal && inf === maxVal) {
                minVal = '';
                medVal = '';
            }
            if (negInf === medVal && negInf === minVal && negInf === maxVal) {
                maxVal = '';
                medVal = '';
            }

            if (
                (COMMON_CONSTANT.NA === medVal &&
                    COMMON_CONSTANT.NA === minVal &&
                    COMMON_CONSTANT.NA === maxVal) ||
                medVal === noLinked
            ) {
                minVal = '';
                maxVal = '';
            }

            return [minVal, applySignificantDigit(medVal), maxVal];
        };

        // use showname for Japan locale only
        const filterNameByLocale = (threholdInfo) => {
            const currentLocale = docCookies.getItem('locale');
            if (!threholdInfo['type']) {
                return i18n.default;
            }
            return currentLocale === localeConst.JP
                ? threholdInfo['type']
                : threholdInfo['eng_name'];
        };
        // get threshold of timerange
        const getThresholdInfor = (dataPoint) => {
            const currentTraceData = graphStore.getTraceData();
            const dataIndex = $(`#${canvasId}`).attr('plotdata-index') || 0;

            // not time value in TSP, this time is time of end proc, not time of start proc
            const plotData = currentTraceData.array_plotdata[dataIndex];
            const filterCond = plotData.catExpBox
                ? Array.isArray(plotData.catExpBox)
                    ? plotData.catExpBox
                    : [plotData.catExpBox]
                : null;
            const [chartInfos, chartInfosOrg] = getChartInfo(
                plotData,
                'TIME',
                filterCond,
            );
            const clickedVal =
                currentTraceData.array_plotdata[dataIndex].array_x[
                    dataPoint.dataIndex
                ];
            const [latestChartInfo] = chooseLatestThresholds(
                chartInfos,
                chartInfosOrg,
                clickedVal,
            );
            const threshHigh = latestChartInfo['thresh-high'] || '';
            const threshLow = latestChartInfo['thresh-low'] || '';
            const prcMax = latestChartInfo['prc-max'] || '';
            const prcMin = latestChartInfo['prc-min'] || '';
            const validFrom = latestChartInfo['act-from']
                ? moment(latestChartInfo['act-from']).format(
                      'YYYY-MM-DD HH:mm:ss',
                  )
                : '';
            const validTo = latestChartInfo['act-to']
                ? moment(latestChartInfo['act-to']).format(
                      'YYYY-MM-DD HH:mm:ss',
                  )
                : '';
            const filterCol = filterNameByLocale(latestChartInfo);
            const filterDetail = latestChartInfo['name'] || i18n.default;
            return {
                threshHigh,
                threshLow,
                prcMax,
                prcMin,
                validFrom,
                validTo,
                filterCol,
                filterDetail,
            };
        };

        const currentThreshold = getThresholdInfor(dataPoint, canvasId);

        const getDatTimeObj = (dataPoint) => {
            const currentTraceData = graphStore.getTraceData();
            const datetimeCol =
                currentTraceData.common_info[procId].datetime_col;

            const canvasId = dataPoint.chart.canvas.id;
            const dataIndex = $(`#${canvasId}`).attr('plotdata-index') || 0;
            const x =
                currentTraceData.array_plotdata[dataIndex].array_x[
                    dataPoint.dataIndex
                ];
            if (isEmpty(x)) {
                return { name: '', value: '' };
            }
            const xLabel = formatDateTime(x); // convert to localtime
            return { name: datetimeCol, value: xLabel };
        };
        const getSerialObj = (dataPoint) => {
            const currentTraceData = graphStore.getTraceData();
            const serialColsName =
                currentTraceData.common_info[procId].serial_columns || [];
            if (isEmpty(serialColsName)) {
                return [{ name: '', value: '' }];
            }

            const dataIndex = dataPoint.dataIndex;
            let serials;
            const canvasId = graphStore.getSelectedCanvas();
            const canvasIdx = parseInt(canvasId.substring(5, 8)) - 1; // canvasId = 'chart03' -> canvasIdx = 2
            if (currentTraceData.is_thin_data) {
                serials =
                    currentTraceData.array_plotdata[canvasIdx].serial_data;
            } else {
                serials = currentTraceData.serial_data[procId];
            }
            if (isEmpty(serials)) {
                return [{ name: '', value: '' }];
            }
            let pointSerials = serials[dataIndex];
            if (isEmpty(pointSerials)) {
                return [{ name: '', value: '' }];
            }
            if (typeof pointSerials !== 'object') {
                pointSerials = [pointSerials];
            }
            const serialVal = pointSerials.map((v, i) => {
                return {
                    name: serialColsName[i],
                    value: v || '',
                };
            });
            serialVal.push({ name: '', value: '' });
            return serialVal;
        };

        const checkNA = (val) => {
            return checkTrue(val) ? val : COMMON_CONSTANT.NA;
        };
        const genDataTable = (dataPoint, outlierDict, currentThreshold) => {
            let thresholdTr = '';
            if (plotDataMin.length || plotDataMax.length) {
                const [minVal, medVal, maxVal] = getDatYMinMaxVal(
                    dataPoint,
                    plotDataMin,
                    plotDataMax,
                    outlierDict,
                );
                if (isOutlierValue(dataPoint.dataIndex, outlierDict)) {
                    thresholdTr += genTRItems(i18n.outlierVal, medVal);
                } else {
                    thresholdTr += genTRItems(i18n.medianVal, medVal);
                }
                thresholdTr += genTRItems(i18n.maxVal, maxVal);
                thresholdTr += genTRItems(i18n.minVal, minVal);

                // show from, to N of slot
                if (slotFrom && slotFrom[dataPoint.dataIndex]) {
                    thresholdTr += genTRItems(
                        'From',
                        formatDateTime(slotFrom[dataPoint.dataIndex]),
                    );
                }
                if (slotTo && slotTo[dataPoint.dataIndex]) {
                    thresholdTr += genTRItems(
                        'To',
                        formatDateTime(slotTo[dataPoint.dataIndex]),
                    );
                }
                if (slotCount && slotCount[dataPoint.dataIndex]) {
                    thresholdTr += genTRItems(
                        'N',
                        applySignificantDigit(slotCount[dataPoint.dataIndex]),
                    );
                }
            } else {
                const yVal = getDatYVal(
                    dataPoint,
                    beforeRankValues,
                    outlierDict,
                );
                if (isOutlierValue(dataPoint.dataIndex, outlierDict)) {
                    thresholdTr += genTRItems(i18n.outlierVal, yVal);
                } else {
                    thresholdTr += genTRItems(i18n.value, yVal);
                }

                const datetimeVals = getDatTimeObj(dataPoint);
                const serialVals = getSerialObj(dataPoint);
                thresholdTr += genTRItems(i18n.dateTime, datetimeVals.value);
                serialVals.forEach((serialVal) => {
                    if (serialVal.value) {
                        thresholdTr += genTRItems(i18n.serial, serialVal.value);
                    }
                });
            }

            thresholdTr += genTRItems('', ''); // br

            // filter
            thresholdTr += genTRItems(
                i18n.attribute,
                currentThreshold.filterCol,
                currentThreshold.filterDetail,
            );
            thresholdTr += genTRItems('', ''); // br
            // threshold table
            thresholdTr += genTRItems('', i18n.limit, i18n.procLimit);
            thresholdTr += genTRItems(
                i18n.threshHigh,
                currentThreshold.threshHigh,
                currentThreshold.prcMax,
            );
            thresholdTr += genTRItems(
                i18n.threshLow,
                currentThreshold.threshLow,
                currentThreshold.prcMin,
            );
            thresholdTr += genTRItems('', '');
            // apply time
            thresholdTr += genTRItems(
                i18n.validFrom,
                currentThreshold.validFrom,
            );
            thresholdTr += genTRItems(i18n.validTo, currentThreshold.validTo);
            return thresholdTr;
        };

        const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

        // Display, position, and set styles for font
        tooltipEl.style.opacity = 0;
        // hover information table position
        const canvasOffset = $(`#${chart.canvas.id}`).offset();
        const leftPosition = canvasOffset.left + positionX + tooltip.caretX;
        const topPosition = canvasOffset.top + positionY + tooltip.caretY;
        genDataPointHoverTable(
            genDataTable(dataPoint, outlierDict, currentThreshold),
            { x: leftPosition - 192, y: topPosition },
            0,
            true,
            chart.canvas.id,
        );
    };

    let y_fmt = '';
    const ctx = $(`#${canvasId}`).get(0).getContext('2d');
    const fixTick = 8;
    const config = {
        type: 'line',
        data: {},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            spanGaps: true,
            normalized: true,
            plugins: {
                decimation,
                annotation: {
                    annotations: {},
                },
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: false,
                    position: 'nearest',
                    external: externalTooltipHandler,
                },
                chartAreaBorder: {
                    borderColor: CONST.COLOR_FRAME_BORDER,
                    borderWidth: 2,
                    borderDash: false,
                },
            },
            scales: {
                x: {
                    parsing: false,
                    afterBuildTicks: function (scale) {
                        if (xaxis === 'INDEX') {
                            return;
                        }

                        let xLabels = scale.ticks;
                        if (xLabels.length <= 8) {
                            return;
                        }

                        let step = Math.floor(xLabels.length / fixTick);

                        const idxs = [];
                        let lastTick;
                        for (let i = 0; i <= fixTick; i++) {
                            lastTick = i * step;
                            idxs.push(lastTick);
                        }
                        if (lastTick < xLabels.length - 1) {
                            if (lastTick > xLabels.length - step) {
                                idxs[idxs.length - 1] = xLabels.length - 1;
                            } else {
                                idxs.push(xLabels.length - 1);
                            }
                        }

                        const ticks = [];
                        xLabels.forEach(function (labels, i) {
                            if (idxs.includes(i)) {
                                ticks.push(xLabels[i]);
                            }
                        });
                        scale.ticks = ticks;
                    },
                    beforeTickToLabelConversion: function (scale) {
                        if (xaxis === 'INDEX') {
                            return;
                        }
                        scale._unit = getUnitDateTimeFormat(
                            scale.min,
                            scale.max,
                            scale.ticks.length,
                        );
                    },
                    ticks: {
                        callback: function (value) {
                            if (xaxis === 'INDEX') {
                                const label = this.getLabelForValue(value);
                                if (xTicks.includes(label)) {
                                    return label;
                                } else {
                                    return;
                                }
                            }

                            const newFormat = moment(value, 'MMM YYYY', true);
                            if (newFormat.isValid()) {
                                value = newFormat.format('YYYY-MM');
                            } else {
                                value = value.replace('/', '-');
                            }
                            return value;
                        }, // major: {
                        //     enabled: true,
                        // },
                        // color: (context) => {
                        //     if (context.tick && context.tick.major){
                        //         return "#999";
                        //     }
                        //     return '#555';
                        // },
                        font: {
                            family: 'Calibri Light',
                            size: 12,
                        },
                        maxRotation: tickConfig.rotation,
                        minRotation: tickConfig.rotation, // sampleSize: 8,
                        color: CONST.TICK,
                        align: 'center', //autoSkip: false,
                        // maxtickslimit: 10,
                    },
                    grid: {
                        color: CONST.GRID,
                        drawTicks: false,
                        drawBorder: false,
                    }, // afterTickToLabelConversion: function adjust(context) {
                    //     for (const idx in context.ticks) {
                    //         context.ticks[idx].label = (context.ticks[idx].label || '').padStart(tickConfig.pad, ' ');
                    //     }
                    // },
                },
                y: {
                    display: true,
                    min: minY,
                    max: maxY,
                    font: {
                        family: 'Calibri Light',
                        size: 12,
                    },
                    afterBuildTicks: function (axis) {
                        if (beforeRankValues) {
                            let ticks = [];
                            for (const key of Object.keys(beforeRankValues)) {
                                ticks.push({ value: key });
                            }

                            axis.ticks = [];
                            if (ticks) {
                                ticks = [
                                    {
                                        value: String(
                                            Number(ticks[0].value) - 0.5,
                                        ),
                                    },
                                ].concat(ticks);
                                ticks = ticks.concat([
                                    {
                                        value: String(
                                            Number(
                                                ticks[ticks.length - 1].value,
                                            ) + 0.5,
                                        ),
                                    },
                                ]);
                                axis.ticks = ticks;
                            }

                            // limit 8 ticks
                            let yabels = axis.ticks;
                            if (yabels.length <= fixTick) {
                                return;
                            }

                            let step = Math.floor(yabels.length / fixTick);
                            step = Math.max(2, step);

                            const idxs = [];
                            let lastTick;
                            for (let i = 0; i <= fixTick; i++) {
                                lastTick = i * step;
                                idxs.push(lastTick);
                            }
                            if (lastTick < yabels.length - 1) {
                                if (lastTick > yabels.length - step) {
                                    idxs[idxs.length - 1] = yabels.length - 1;
                                } else {
                                    idxs.push(yabels.length - 1);
                                }
                            }

                            const yticks = [];
                            yabels.forEach(function (labels, i) {
                                if (idxs.includes(i)) {
                                    yticks.push(yabels[i]);
                                }
                            });
                            axis.ticks = yticks;
                            // end limit 8 ticks
                        } else {
                            const ticks = axis.ticks.map((tick) => tick.value);
                            const formatFloat = '^[,][.](\\d+)[f]$';
                            const { sigDigit } = getSigDigitOfArray([
                                minY,
                                maxY,
                            ]);
                            const yTickFmt = getFmtValueOfArray(ticks);
                            const yTickMax = Math.max(...ticks);
                            const yTickMin = Math.min(...ticks);
                            y_fmt = yTickFmt;
                            if (yTickFmt.includes('f')) {
                                const [, sigDigitFmt] =
                                    yTickFmt.match(formatFloat);
                                y_fmt =
                                    sigDigit > Number(sigDigitFmt) &&
                                    yTickMax - yTickMin < 1
                                        ? `,.${sigDigit + 1}f`
                                        : yTickFmt;
                            }
                        }
                        return;
                    },
                    afterTickToLabelConversion: function adjust(context) {
                        const ticks = context.ticks;
                        context.ticks[0].label = '';
                        if (ticks.length)
                            context.ticks[ticks.length - 1].label = '';
                        alignLengthTickLabels(context.ticks);
                    },
                    afterFit: function (scaleInstance) {
                        scaleInstance.width = 60; // sets the width to 100px
                    },
                    ticks: {
                        labelOffset: beforeRankValues ? -10 : 0,
                        mirror: !!beforeRankValues,
                        padding: beforeRankValues ? -37 : 5,
                        maxRotation: 0,
                        minRotation: 0,
                        sampleSize: beforeRankValues
                            ? Object.keys(beforeRankValues).length
                            : 8,
                        color: CONST.TICK,
                        maxTicksLimit: 9,
                        // count: 9, // show max 8 tick labels
                        // show text before ranked instead of ranked value
                        callback: function (value) {
                            if (isCatLimited) return '';

                            // String Ranked label
                            let showVal = applySignificantDigit(
                                value,
                                undefined,
                                y_fmt,
                            );
                            if (beforeRankValues) {
                                showVal = `0${Number(showVal)}`.slice(-2);
                                showVal = showVal.padEnd(5);
                                const onlyVal = beforeRankValues[value];
                                const isNeedToAddDotSymbol =
                                    String(onlyVal).length > CAT_LABEL_LIMIT;
                                if (onlyVal !== undefined) {
                                    showVal = `Cat${showVal}`;
                                    showVal += String(onlyVal).substring(
                                        0,
                                        CAT_LABEL_LIMIT,
                                    );
                                    if (isNeedToAddDotSymbol) {
                                        showVal += '...';
                                    }
                                }
                            } else {
                                // align number to right
                                if (showVal.includes('e')) {
                                    showVal = Number(value).toPrecision(3);
                                }
                            }
                            return showVal;
                        },
                    },
                    grid: {
                        color: CONST.GRID,
                        drawTicks: false,
                        drawBorder: false,
                    },
                },
            },
            onHover(evt, a, chart) {
                const item = chart.getElementsAtEventForMode(
                    evt,
                    'nearest',
                    { intersect: true },
                    false,
                ); // const lastItem = chart.getActiveElements();

                if (item.length) {
                    // save hovered data index
                    const chartCanvasId = chart.canvas.id;
                    const hoveredIndex = item[0].index;
                    const datasetId = item[0].datasetIndex;
                    graphStore.saveHoveredDataPoint(chartCanvasId, {
                        index: hoveredIndex,
                        datasetIndex: datasetId,
                    });
                    graphStore.setSelectedCanvas(chartCanvasId);
                }
            },
            elements: {
                point: {
                    pointStyle(ctx) {
                        if (ctx.datasetIndex === CONST.NORMAL_DATASET) {
                            return 'circle';
                        }
                        return 'rect';
                    },
                },
            },
        },
        plugins: [chartAreaBorder],
    };

    let xTicks = null;
    let xLabels;
    if (xaxis === 'INDEX') {
        xTicks = genXTicks(isThinData);
        xLabels = tsData.map((e, i) => i + 1);
        config.options.scales.x.min = 1;
        // config.options.scales.x.max = isThinData ? THIN_DATA_COUNT : tsData.length;
        config.options.scales.x.max = tsData.length;
    } else {
        xLabels = tsData;
        // xTicks = xTicks.map((e) => xLabels[e - 1])
        config.options.scales.x.type = 'time';
        config.options.scales.x.time = {
            displayFormats: dateTimeDisplayFormat,
        };
        config.options.scales.x.min = new Date(startPoint);
        config.options.scales.x.max = new Date(endPoint);
    }

    const pointColor = isThinData ? CONST.COLOR_THIN : CONST.COLOR_NORMAL;

    const yLabels = isCatLimited ? [] : xLabels;
    const chartData = isCatLimited ? [] : plotData;

    const pointSize =
        plotData.length <= CONST.SMALL_DATA_SIZE
            ? 2.5
            : plotData.length < 1000
              ? 1.5
              : 1;

    config.data = {
        labels: yLabels,
        datasets: [
            {
                label: 'Dataset 1',
                data: chartData,
                backgroundColor: pointColor, // ts chart dot color
                borderColor: pointColor, // link between dot color
                borderWidth: 0.5,
                showLine: beforeRankValues
                    ? false
                    : !(isThinData || plotData.length >= 1000),
                pointRadius: pointSize,
                order: 0,
                pointBackgroundColor: new Array(plotData.length).fill(
                    pointColor,
                ), // stepped: !!beforeRankValues,
                dictIdx2YValue,
            },
            {
                label: 'Dataset 2',
                data: plotDataEx,
                pointBackgroundColor: plotDataExColor,
                type: 'line',
                order: 1,
                showLine: false,
            },
        ],
    };

    if (!isEmpty(minX)) {
        config.options.scales.x.time.min = minX;
    }
    if (!isEmpty(maxX)) {
        config.options.scales.x.time.min = maxX;
    }

    if (!isEmpty(minY)) {
        config.options.scales.y.min = minY;
    }

    if (!isEmpty(maxY)) {
        config.options.scales.y.max = maxY;
    }

    for (const idx in chartInfos) {
        const chartInfo = chartInfos[idx];
        const threshHigh = chartInfo['thresh-high'];
        const threshLow = chartInfo['thresh-low'];
        const prcMax = chartInfo['prc-max'];
        const prcMin = chartInfo['prc-min'];
        const startDateTime = convertFunc(startPoint);
        const endDateTime = convertFunc(endPoint);
        let actFrom = isEmpty(chartInfo['act-from'])
            ? startDateTime
            : convertFunc(chartInfo['act-from']);
        let actTo = isEmpty(chartInfo['act-to'])
            ? endDateTime
            : convertFunc(chartInfo['act-to']);
        if (endDateTime < actFrom || actTo < startDateTime) {
            // out of range
            continue;
        }
        if (actFrom < startDateTime) {
            actFrom = startDateTime;
        }
        if (endDateTime < actTo) {
            actTo = endDateTime;
        }
        if (!isEmpty(threshHigh)) {
            config.options.plugins.annotation.annotations[`ucl-${idx}`] =
                createTSThreshold(threshHigh, CONST.RED, actFrom, actTo);
        }

        if (!isEmpty(threshLow)) {
            config.options.plugins.annotation.annotations[`lcl-${idx}`] =
                createTSThreshold(threshLow, CONST.RED, actFrom, actTo);
        }

        if (!isEmpty(prcMin)) {
            config.options.plugins.annotation.annotations[`lpcl-${idx}`] =
                createTSThreshold(prcMin, CONST.BLUE, actFrom, actTo);
        }

        if (!isEmpty(prcMax)) {
            config.options.plugins.annotation.annotations[`upcl-${idx}`] =
                createTSThreshold(prcMax, CONST.BLUE, actFrom, actTo);
        }
    }

    // error bar chart (draw min,max line)
    if (isThinData && (plotDataMin.length || plotDataMax.length)) {
        config.options.plugins.annotation['drawTime'] = 'beforeDatasetsDraw';
        for (let i = 0; i < plotData.length; i++) {
            const medVal = plotData[i];
            if (medVal === null) {
                continue;
            }
            const minVal = plotDataMin[i] === null ? medVal : plotDataMin[i];
            const maxVal = plotDataMax[i] === null ? medVal : plotDataMax[i];
            if (minVal === maxVal) {
                continue;
            }

            const xPos = xLabels[i];
            config.options.plugins.annotation.annotations['error_bar_' + i] = {
                type: 'line',
                xMin: xPos,
                xMax: xPos,
                yMin: minVal,
                yMax: maxVal,
                backgroundColor: CONST.COLOR_ERROR_BAR,
                borderColor: CONST.COLOR_ERROR_BAR,
                borderWidth: 0.2,
            };
        }
    }

    const stepLineAnnotation = genStepLineAnnotation(
        plotData,
        xLabels,
        pointColor,
    );
    if (!isCatLimited && !_.isEmpty(stepLineAnnotation)) {
        config.options.plugins.annotation.annotations = Object.assign(
            config.options.plugins.annotation.annotations,
            stepLineAnnotation,
        );
    }

    if (isCatLimited) {
        config.options.plugins.annotation.annotations['catLimited'] = {
            type: 'label',
            content: [...i18n.catLimitMsg],
            color: '#65c5f1',
        };
    }

    config.options.onClick = function f(evt, a, cht) {
        timeSeriesOnClick(cht, evt);
    };

    const canvas = $(`#${canvasId}`).get(0);
    const chart = new Chart(ctx, config);
    canvas.addEventListener('contextmenu', rightClickHandler, false);
    canvas.addEventListener('mousedown', handleMouseDown, false);

    function handleMouseDown() {
        // later, not just mouse down, + mouseout of menu
        hideFPPContextMenu();
    }

    function rightClickHandler(e) {
        e.preventDefault();
        e.stopPropagation();

        // show context menu when right click timeseries
        const menu = formElements.menuTS;
        const menuHeight = menu.height();
        const windowHeight = $(window).height();
        const left = e.clientX;
        let top = e.clientY;
        if (windowHeight - top < menuHeight) {
            top -= menuHeight;
        }
        menu.css({
            left: `${left}px`,
            top: `${top}px`,
            display: 'block',
        });

        // save selected canvas
        graphStore.setSelectedCanvas(e.currentTarget.id);

        return false;
    }

    return chart;
}

const createTSThreshold = (
    thresholdVal,
    color = CONST.BLUE,
    startPoint = null,
    endPoint = null,
    borderDash = [],
) => ({
    type: 'box',
    scaleID: 'y',
    xMin: startPoint,
    xMax: endPoint,
    yMin: thresholdVal,
    yMax: thresholdVal,
    backgroundColor: color,
    borderColor: color,
    borderWidth: 0.5,
    borderDash,
});

const updateThresholdsOnClick = (canvasId, clickedIdx) => {
    const currentTraceData = graphStore.getTraceData();
    const dataIndex = $(`#${canvasId}`).attr('plotdata-index') || 0;

    // not time value in TSP, this time is time of end proc, not time of start proc
    const plotData = currentTraceData.array_plotdata[dataIndex];
    const filterCond = plotData.catExpBox
        ? Array.isArray(plotData.catExpBox)
            ? plotData.catExpBox
            : [plotData.catExpBox]
        : null;
    const [chartInfos, chartInfosOrg] = getChartInfo(
        plotData,
        'TIME',
        filterCond,
    );
    const clickedVal =
        currentTraceData.array_plotdata[dataIndex].array_x[clickedIdx];
    const [latestChartInfo, latestIndex] = chooseLatestThresholds(
        chartInfos,
        chartInfosOrg,
        clickedVal,
    );
    // from latest chartInfo, update histogram, update scatter plot, update summary
    const threshHigh = latestChartInfo['thresh-high'];
    const threshLow = latestChartInfo['thresh-low'];

    const scaleInfo = getScaleInfo(plotData, scaleOptionConst.SETTING);
    const cfgYMax = latestChartInfo['y-max'] || scaleInfo['y-max'];
    const cfgYMin = latestChartInfo['y-min'] || scaleInfo['y-min'];
    const prcMax = latestChartInfo['prc-max'];
    const prcMin = latestChartInfo['prc-min'];

    // update thresholds
    const sameRowCanvases = $(`#${canvasId}`)
        .closest('div .chart-row')
        .find('canvas');
    sameRowCanvases.each(function f() {
        const canvasId = $(this).attr('id');
        const chartType = $(this).attr('chart-type');
        if (chartType === 'scatter') {
            // update scatter plot of the same row
            const scatterChartObject = graphStore.getScatterById(canvasId);
            if (scatterChartObject) {
                removeThresholdsOfChart(scatterChartObject, CONST.HORIZONTAL);

                if (threshHigh !== null) {
                    scatterChartObject.options.plugins.annotation.annotations.ucl =
                        createHorizonalThreshold(
                            threshHigh,
                            CONST.RED,
                            CONST.UCL,
                        );
                }

                if (threshLow !== null) {
                    scatterChartObject.options.plugins.annotation.annotations.lcl =
                        createHorizonalThreshold(
                            threshLow,
                            CONST.RED,
                            CONST.LCL,
                        );
                }
                if (prcMax !== null) {
                    scatterChartObject.options.plugins.annotation.annotations.upcl =
                        createHorizonalThreshold(
                            prcMax,
                            CONST.BLUE,
                            CONST.UPCL,
                        );
                }
                if (prcMin !== null) {
                    scatterChartObject.options.plugins.annotation.annotations.lpcl =
                        createHorizonalThreshold(
                            prcMin,
                            CONST.BLUE,
                            CONST.LPCL,
                        );
                }

                scatterChartObject.update((mode = 'none'));

                // update next scatter plot thresholds
                const scatterCanvasIds = [];
                $('canvas[chart-type=scatter]').each(function f() {
                    scatterCanvasIds.push($(this).attr('id'));
                });
                const numOfCarts = scatterCanvasIds.length;
                const currentRowIdx = scatterCanvasIds.indexOf(canvasId);
                const prevRowPos = currentRowIdx + 1 - 1 || numOfCarts;
                const prevScatterCanvasId = scatterCanvasIds[prevRowPos - 1];
                const prevScatterChartObject =
                    graphStore.getScatterById(prevScatterCanvasId);
                if (!prevScatterChartObject) {
                    return;
                }

                removeThresholdsOfChart(prevScatterChartObject, CONST.VERTICAL);

                if (threshHigh !== null) {
                    prevScatterChartObject.options.plugins.annotation.annotations.vucl =
                        createVerticalThreshold(
                            threshHigh,
                            CONST.RED,
                            CONST.vUCL,
                        );
                }

                if (threshLow !== null) {
                    prevScatterChartObject.options.plugins.annotation.annotations.vlcl =
                        createVerticalThreshold(
                            threshLow,
                            CONST.RED,
                            CONST.vLCL,
                        );
                }
                if (prcMax !== null) {
                    prevScatterChartObject.options.plugins.annotation.annotations.vupcl =
                        createVerticalThreshold(
                            prcMax,
                            CONST.BLUE,
                            CONST.vUPCL,
                        );
                }
                if (prcMin !== null) {
                    prevScatterChartObject.options.plugins.annotation.annotations.vlpcl =
                        createVerticalThreshold(
                            prcMin,
                            CONST.BLUE,
                            CONST.vLPCL,
                        );
                }

                prevScatterChartObject.update((mode = 'none'));
            }
        }
        // update histogram of the same row
        if (chartType === 'histogram') {
            const histChartObject = graphStore.getHistById(canvasId);
            if (histChartObject) {
                removeThresholdsOfChart(histChartObject);
                if (threshHigh !== null) {
                    histChartObject.options.plugins.annotation.annotations.ucl =
                        createHorizonalThreshold(
                            threshHigh,
                            CONST.RED,
                            CONST.UCL,
                        );
                }

                if (threshLow !== null) {
                    histChartObject.options.plugins.annotation.annotations.lcl =
                        createHorizonalThreshold(
                            threshLow,
                            CONST.RED,
                            CONST.LCL,
                        );
                }
                if (prcMax !== null) {
                    histChartObject.options.plugins.annotation.annotations.upcl =
                        createHorizonalThreshold(
                            prcMax,
                            CONST.BLUE,
                            CONST.UPCL,
                        );
                }
                if (prcMin !== null) {
                    histChartObject.options.plugins.annotation.annotations.lpcl =
                        createHorizonalThreshold(
                            prcMin,
                            CONST.BLUE,
                            CONST.LPCL,
                        );
                }
                histChartObject.update((mode = 'none'));
            }
        }
    });

    // update to show summary corresponding to the click point
    const allSummaries = $(`#${canvasId}`)
        .closest('div .chart-row')
        .find('.summary');
    allSummaries.each(function showHideSummary() {
        if ($(this).hasClass(`summary-${latestIndex}`)) {
            $(this).css('display', 'block');
        } else {
            $(this).css('display', 'none');
        }
    });

    // TODO draw new whisker plot OR just show/hide whisker plot
    if (!plotData.before_rank_values) {
        drawSensorWhisker(dataIndex, plotData, clickedVal, cfgYMin, cfgYMax);
    }
};

function timeSeriesOnClick(chart, event) {
    // show vertical line on category table
    showVerticalLineOnClick(event);

    // get clicked position from event
    const eventElement = chart.getElementsAtEventForMode(
        event,
        'nearest',
        { intersect: true },
        false,
    );
    if (!eventElement || eventElement.length < 1) {
        // click outside datapoint
        removeAllCrossHair(true, true, true);
        return;
    }

    const clickPosition = eventElement[0].index;
    if (clickPosition === null) return;

    // get data of clicked point
    const datasetIndex = eventElement[0].datasetIndex;
    const yValue = chart.data.datasets[datasetIndex].data[clickPosition];
    const xValue = chart.data.labels[clickPosition];
    const canvasId = chart.canvas.id;
    const numDataPoints = graphStore.getCountDataPoint();

    avoidMultiClickCntTS += 1;
    const curCnt = avoidMultiClickCntTS;
    if (event.native.detail >= 2) {
        // on DOUBLE CLICK: draw all crosshair line on double click
        setTimeout(() => {
            if (curCnt === avoidMultiClickCntTS) {
                if (numDataPoints < 100000)
                    drawCrossHairOnDoubleClick(clickPosition, canvasId);
            }
        }, 200);
    } else {
        setTimeout(() => {
            if (curCnt === avoidMultiClickCntTS) {
                // on SINGLE CLICK
                if (numDataPoints < 100000)
                    drawCrosshairSingleClick(
                        clickPosition,
                        xValue,
                        yValue,
                        canvasId,
                    );

                // from xValue -> find latest chartInfo
                updateThresholdsAllTSP(clickPosition - 1);
            }
        }, 200);
    }
}

const updateThresholdsAllTSP = (clickIdx) => {
    const canvasIds = graphStore.getAllTimeSeriesCanvasIds();
    for (const canvasId of canvasIds) {
        updateThresholdsOnClick(canvasId, clickIdx);
    }
};

// hide graphscale menu
const hideGraphScaleMenu = () => {
    $('#contextMenuGraphScale').hide();
};

const showGraphScaleMenu = (menuItem) => {
    const optionElement = $(menuItem);
    const offset = optionElement.offset();
    const menuTS = formElements.menuTS; // TODO
    const offsetTS = menuTS.offset();
    const width = menuTS.width();
    const menuGraphScale = formElements.menuScale;
    const menuTSTop = parseInt(menuTS.css('top'));
    const windowHeight = $(window).height();
    const menuHeight = menuGraphScale.height();
    let top = offset.top - offsetTS.top + menuTSTop;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight - optionElement.outerHeight();
    }
    menuGraphScale.css({
        left: `${offset.left + width}px`,
        top: `${top}px`,
        display: 'block',
    });
};

let menuItemOffset = {};
const saveOffset = (menuItem = null) => {
    menuItemOffset = $(menuItem).offset();
};

const handleSelectTSMenuItem = (selectedItem = 'click', menuItem = null) => {
    if (selectedItem === 'graphScale') {
        showGraphScaleMenu(menuItem);
        return;
    }

    if (selectedItem === 'showSettingInfor') {
        const filterInfoTable = $(formElements.settingHoverContent);
        filterInfoTable.css({
            display: 'block',
        });
        filterInfoTable.offset({
            top: menuItemOffset.top, // TODO fix case clicking at bottom
            left: menuItemOffset.left,
        });
    }

    const selectedCanvasId = graphStore.getSelectedCanvas();
    if (!selectedCanvasId) {
        hideFPPContextMenu();
        return;
    }

    const tsChartObject = graphStore.getTimeSeriesById(selectedCanvasId);
    const lastHoveredDataPoint =
        graphStore.getLastHoveredDataPoint(selectedCanvasId);
    if (!lastHoveredDataPoint) {
        hideFPPContextMenu();
        return;
    }

    const { index: clickPosition, datasetIndex } = lastHoveredDataPoint;
    const yValue =
        tsChartObject.data.datasets[datasetIndex].data[clickPosition];
    const xValue = tsChartObject.data.labels[clickPosition];

    switch (selectedItem) {
        case 'click': {
            drawCrosshairSingleClick(
                clickPosition,
                xValue,
                yValue,
                selectedCanvasId,
            );
            break;
        }
        case 'doubleClick': {
            drawCrossHairOnDoubleClick(clickPosition, selectedCanvasId);
            break;
        }
        case 'showPlotView': {
            const currentTraceData = graphStore.getTraceData();
            const isThinData = currentTraceData.is_thin_data;
            let cycleId;
            if (isThinData) {
                cycleId =
                    graphStore.getArrayPlotData(selectedCanvasId).cycle_ids[
                        clickPosition
                    ];
            } else {
                cycleId = currentTraceData.cycle_ids[clickPosition];
            }
            // const xTime = graphStore.getArrayPlotData(selectedCanvasId).array_x[clickPosition];
            let xTime = currentTraceData.times[clickPosition];

            const formDat = lastUsedFormData || null;
            let queryString = genQueryStringFromFormData(formDat);
            // queryString = queryString.concat(`&time=${moment(xTime).toISOString()}`);
            queryString = queryString.concat(`&time=${xTime}`);
            queryString = queryString.concat(`&cycle_id=${cycleId}`);
            const row = $(`#${selectedCanvasId}`).closest('.row.chart-row');
            const sensorId = row.length ? row.attr('sensor') : null;
            queryString = queryString.concat(`&sensor_id=${sensorId}`);

            showPlotView(queryString);
            break;
        }
        default:
    }

    hideFPPContextMenu();
};

const updateGraphScale = (scaleOption = '1') => {
    const currentTraceData = graphStore.getTraceData();
    const numChart = currentTraceData.array_plotdata.length;
    // set common max min

    for (let i = 0; i < numChart; i++) {
        const plotData = currentTraceData.array_plotdata[i];
        const formVal = currentTraceData.ARRAY_FORMVAL[i];
        // マスタが存在するならマスタ情報を適用
        const endProcId = formVal.end_proc;
        const sensorId = formVal.GET02_VALS_SELECT;

        const isHideNonePoint = isHideNoneDataPoint(
            endProcId,
            sensorId,
            currentTraceData.COMMON.remove_outlier,
        );
        const beforeRankValues = plotData.before_rank_values;
        if (beforeRankValues) {
            continue;
        }

        const arrayY = plotData.array_y;
        const unlinkedIdxs = plotData.unlinked_idxs;
        // this place
        const noneIdxs = isHideNonePoint ? [] : plotData.none_idxs;
        const infIdxs = plotData.inf_idxs;
        const negInfIdxs = plotData.neg_inf_idxs;

        const scaleInfo = getScaleInfo(plotData, scaleOption);

        const [minY, maxY] = calMinMaxYScale(
            scaleInfo['y-min'],
            scaleInfo['y-max'],
            scaleOption,
        );
        const outlierIdxs = scaleInfo.upper_outlier_idxs;
        const negOutlierIdxs = scaleInfo.lower_outlier_idxs;
        const kdeDat = scaleInfo.kde_data;

        const [dictIdx2YValue, arrayYTS] = buildMapIndex2OutlierYValue(
            plotData,
            scaleInfo,
        );
        const { arrayYEx, plotDataExColor } = produceExceptionArrayY(
            arrayY,
            minY,
            maxY,
            unlinkedIdxs,
            noneIdxs,
            infIdxs,
            negInfIdxs,
            negOutlierIdxs,
            outlierIdxs,
            beforeRankValues,
        );

        updateScales(
            i + 1,
            minY,
            maxY,
            kdeDat,
            arrayYEx,
            plotDataExColor,
            arrayYTS,
            dictIdx2YValue,
        );
    }
};

const updateScales = (
    row,
    newMin,
    newMax,
    kdeDat,
    arrayYEx,
    plotDataExColor,
    arrayYTS,
    dictIdx2YValue,
) => {
    const createCanvasId = (graphType, row) => graphType + `${row}`;
    const updateMinMaxY = (chartObject, minY, maxY, kdeDat = null) => {
        if (isEmpty(chartObject)) return;
        chartObject.options.scales.y.min = minY;
        chartObject.options.scales.y.max = maxY;
        if (kdeDat && kdeDat.kde) {
            const kdeObj = getTransKDE(kdeDat);
            chartObject.data.labels = kdeObj.hisLabels;
            chartObject.data.datasets[0].data = kdeObj.histCounts;
            chartObject.data.datasets[1].data = kdeObj.transKDE;
        }
        chartObject.update();
    };
    const tsChartObject = graphStore.getTimeSeriesById(
        createCanvasId('chart0', row),
    );
    const histChartObject = graphStore.getHistById(
        createCanvasId('hist0', row),
    );
    const whiskerChartObject = graphStore.getWhiskerById(
        createCanvasId('whisker0', row),
    );
    const scatterChartObject = graphStore.getScatterById(
        createCanvasId('sctr0', row),
    );

    if (tsChartObject) {
        tsChartObject.data.datasets[0].data = arrayYTS;
        tsChartObject.data.datasets[0].dictIdx2YValue = dictIdx2YValue;
        tsChartObject.data.datasets[1].data = arrayYEx;
        tsChartObject.data.datasets[1].pointBackgroundColor = plotDataExColor;
        updateMinMaxY(tsChartObject, newMin, newMax);
    }

    updateMinMaxY(histChartObject, newMin, newMax, kdeDat); // TODO update minX, maxX for histogram
    updateMinMaxY(whiskerChartObject, newMin, newMax);
    updateMinMaxY(scatterChartObject, newMin, newMax);
};

const handleGraphScaleClick = (option = '1') => {
    hideFPPContextMenu();
    updateGraphScale(option);
    $('select[name=tsScaleY]').val(option);
};

const hideFPPContextMenu = () => {
    // hideGraphScaleMenu();
    $('.context-menu').css({ display: 'none' });
    $('.context-menu-2nd').css({ display: 'none' });
};

const deleteThisRow = (self, isGraphArea) => {
    const tableId = isGraphArea
        ? formElements.serialTable2
        : formElements.serialTable;
    $(self).closest('tr').remove();
    updateCurrentSelectedProcessSerial(name.serial);

    if (isGraphArea) {
        initSelect();
        disableUnselectedOption(selectedSerials, name.serial);
        disableUnselectedOption(selectedProcess, name.process);
    } else {
        updatePriorityAndDisableSelected(tableId);
    }
};

const htmlOrderColRowTemplate = (
    priority,
    processSelectHTML,
    serialSelectHTML,
    orderSelectHTML,
    isGraphArea,
) => `<tr>
        <td ${dragDropRowInTable.DATA_ORDER_ATTR}>${priority}</td>
        <td>
            ${processSelectHTML}
        </td>
        <td>
            ${serialSelectHTML}
        </td>
        <td>
            ${orderSelectHTML}
        </td>
        <td>
            <button onclick="deleteThisRow(this, ${isGraphArea})" type="button" class="btn btn-secondary icon-btn btn-right">
                <i class="fas fa-trash-alt icon-secondary"></i>
            </button>
        </td>
    </tr>`;

const buildProcessColumnHTML = (selectedProcId, name = 'serialProcess') => {
    const procOptions = [];
    for (const procId in procConfigs) {
        const selected =
            Number(procId) === Number(selectedProcId) ? 'selected' : '';
        const option = `<option value="${procId}" ${selected} title="${procConfigs[procId].name_en}">${procConfigs[procId].shown_name || procId}</option>`;
        procOptions.push(option);
    }
    return `
        <select class="form-control select2-selection--single select-n-columns" 
            name="${name}" data-gen-btn="${formElements.btnAddSerial.replace('#', '')}">
            ${procOptions.join('')}
        </select>`;
};

const buildColumnHTML = (
    serialCols,
    tableId = formElements.serialTable,
    name = 'serialColumn',
    selectedCol = null,
    selectedProcId,
) => {
    const defaultOption = '<option value="" selected>---</option>';
    const optionHTMLs = [defaultOption];
    const selectedOrderCols = getSelectedOrderCols(tableId, name);
    let alreadySet = false;
    for (const idx in serialCols) {
        const col = serialCols[idx];
        let optionHTML = `<option value="${col.id}" title="${col.name_en}" data-is-get-date="${col.is_get_date}" data-is-serial-no="${col.is_serial_no}" data-selected-proc-id="${selectedProcId}">${col.shown_name}</option>`; // TODO no need, order alphabet
        if (selectedCol) {
            if (col.id === selectedCol) {
                optionHTML = `<option value="${col.id}" title="${col.name_en}" data-is-get-date="${col.is_get_date}" data-is-serial-no="${col.is_serial_no}" data-selected-proc-id="${selectedProcId}" selected>${col.shown_name}</option>`;
                alreadySet = true;
            }
        } else if (!alreadySet && !selectedOrderCols.has(`${col.id}`)) {
            optionHTML = `<option value="${col.id}" title="${col.name_en}" data-is-get-date="${col.is_get_date}" data-is-serial-no="${col.is_serial_no}" data-selected-proc-id="${selectedProcId}">${col.shown_name}</option>`;
            alreadySet = true;
        }
        optionHTMLs.push(optionHTML);
    }
    return `<select data-load-level="2" class="form-control select2-selection--single select-n-columns" name="${name}">${optionHTMLs.join('')}</select>`;
};

const buildOrderHTML = (orderName, selectedOrder = null) => {
    let ascChecked = '';
    let descChecked = '';
    if (selectedOrder === 0) {
        descChecked = 'selected';
    } else {
        ascChecked = 'selected';
    }

    return `<select class="form-control" name="${orderName}">
            <option value="1" ${ascChecked}>${i18n.ascending}</option>
            <option value="0" ${descChecked}>${i18n.descending}</option>
            </select>`;
};

const createOrderColRowHTML = async (
    selectedProcId,
    tableId = formElements.serialTable,
    processName = 'serialProcess',
    serialName = 'serialColumn',
    orderName = 'serialOrder',
    selectedCol = null,
    selectedOrder = null,
    priority = null,
    isGraphArea = false,
) => {
    const calcPriority = () => $(`${tableId} tbody tr`).length + 1;

    // get serial
    const procInfo = procConfigs[selectedProcId];
    await procInfo.updateColumns();
    const columns = procInfo.getColumns();
    const orderCols = [];
    // sort serial & datetime to show first
    const newSortedCols = orderSeriesCols(columns);
    for (const col of newSortedCols) {
        if (
            col.is_serial_no ||
            col.is_get_date ||
            CfgProcess_CONST.CATEGORY_TYPES.includes(col.data_type)
        ) {
            orderCols.push(col);
        }
    }
    const processSelectHTML = buildProcessColumnHTML(
        selectedProcId,
        processName,
    );
    const columnSelectHTML = buildColumnHTML(
        orderCols,
        tableId,
        serialName,
        selectedCol,
        selectedProcId,
    );
    const orderSelectHTML = buildOrderHTML(orderName, selectedOrder);
    return htmlOrderColRowTemplate(
        priority || calcPriority(),
        processSelectHTML,
        columnSelectHTML,
        orderSelectHTML,
        isGraphArea,
    );
};

const getSelectedOrderCols = (
    tableId = formElements.serialTable,
    serialName = 'serialColumn',
) => {
    const numRows = $(`${tableId} tbody tr`).length;
    if (!numRows) return new Set();

    const selectedCols = $(`select[name=${serialName}]`);
    return new Set(
        selectedCols.find(':selected').map(function getVal() {
            return $(this).val();
        }),
    );
};

const disableSelectedSerials = (selectedSerials, name = 'serialColumn') => {
    const serialSelects = $(`select[name=${name}]`);
    serialSelects.each(function disableOption() {
        const selectElement = $(this);
        const selectedVal = selectElement.val();
        const options = [...selectElement.find('option')];

        for (const opt of options) {
            const option = $(opt);
            option.attr('disabled', false);
            const val = option.val();
            const isColSelectedOnSameElement = `${val}` === `${selectedVal}`;
            if (selectedSerials.has(val) && !isColSelectedOnSameElement) {
                option.attr('disabled', true);
            }
        }
    });
};

const disableSelectedOption = (
    tableId = formElements.serialTable,
    serialName = 'serialColumn',
) => {
    const selectedSerials = getSelectedOrderCols(tableId, serialName);
    disableSelectedSerials(selectedSerials, serialName);
};

const updatePriorityAndDisableSelected = (
    tableId = formElements.serialTable,
    serialName = 'serialColumn',
) => {
    updatePriority(tableId);
    disableSelectedOption(tableId, serialName);
};

const bindChangeProcessEvent = (
    tableId = formElements.serialTable,
    processName = 'serialProcess',
    serialName = 'serialColumn',
    callback = null,
) => {
    $(`select[name=${processName}]`).each(function changeProc() {
        const binded = $(this).data('bind-on-change');
        if (!binded) {
            $(this).on('change', async function changeSerialColumn() {
                // prevent bind many times. unbind() doesn't seem work as expected
                $(this).data('bind-on-change', 1);

                const selectedProcId = $(this).val();
                const orderColElement = $(this)
                    .closest('tr')
                    .find(`select[name=${serialName}]`);
                if (isEmpty(selectedProcId)) {
                    // empty proc -> empty column
                    orderColElement.empty().select2({
                        placeholder: `${i18nCommon.search}...`,
                        allowClear: true,
                        width: 'auto',
                        language: {
                            noResults: function () {
                                return i18nCommon.notApplicable;
                            },
                        },
                    });
                    return;
                }

                const procInfo = procConfigs[selectedProcId];
                await procInfo.updateColumns();
                const columns = procInfo.getColumns();

                const selectedVal = orderColElement.val();
                const selectedSerialCols = getSelectedOrderCols(
                    tableId,
                    serialName,
                );
                let alreadyPickedOrderCol = false;
                let defaultOrderCol = '';
                const orderCols = [{ id: '', text: '---', selected: true }];
                // sort serial & datetime to show first
                const newSortedCols = orderSeriesCols(columns);
                for (const col of newSortedCols) {
                    if (
                        col.is_serial_no ||
                        col.is_get_date ||
                        CfgProcess_CONST.CATEGORY_TYPES.includes(col.data_type)
                    ) {
                        const orderObject = {
                            id: col.id,
                            text: col.shown_name,
                            title: col.name_en,
                            'data-is-get-date': col.is_get_date,
                            'data-is-serial-no': col.is_serial_no,
                            'data-selected-proc-id': selectedProcId,
                        };
                        const procData = getProcessColSelected();
                        const currentOption = `${selectedProcId}-${col.id}`;
                        const isColSelectedOnSameElement =
                            `${selectedVal}` === `${col.id}`;
                        const isColSelected =
                            selectedSerialCols.has(col.id) ||
                            selectedSerialCols.has(`${col.id}`);

                        if (!isColSelectedOnSameElement && isColSelected) {
                            orderObject.disabled = true;
                        } else if (
                            !alreadyPickedOrderCol &&
                            !selectedSerials.has(col.id)
                        ) {
                            if (
                                (col.is_get_date || col.is_serial_no) &&
                                procData.includes(selectedProcId)
                            ) {
                                if (
                                    !selectedProcessSerial &&
                                    !selectedProcessSerial.has(currentOption)
                                ) {
                                    defaultOrderCol = col.id;
                                    alreadyPickedOrderCol = true;
                                }
                            }
                        }
                        orderCols.push(orderObject);
                    }
                }

                orderColElement.empty().select2({
                    placeholder: `${i18nCommon.search}...`,
                    allowClear: true,
                    width: 'auto',
                    data: orderCols,
                    language: {
                        noResults: function () {
                            return i18nCommon.notApplicable;
                        },
                    },
                });

                orderColElement
                    .select2()
                    .find('option')
                    .each(function () {
                        const selectElement = $(this);
                        const optionValue = selectElement.val();
                        const orderCol = orderCols.find(
                            (col) => `${col.id}` === `${optionValue}`,
                        );
                        selectElement
                            .attr(
                                'data-is-get-date',
                                orderCol['data-is-get-date'],
                            )
                            .attr(
                                'data-is-serial-no',
                                orderCol['data-is-serial-no'],
                            )
                            .attr(
                                'data-selected-proc-id',
                                orderCol['data-selected-proc-id'],
                            );
                    });

                setSelect2Selection(tableId);

                if (defaultOrderCol) {
                    orderColElement.val(defaultOrderCol).trigger('change');
                }
                if (callback) callback();
            });
        }
    });
};

const bindChangeOrderColEvent = (
    tableId = formElements.serialTable,
    name = 'serialColumn',
    callback = null,
) => {
    const serialSelectEl = $(`select[name=${name}]`);
    serialSelectEl.on('select2:change', (e) => {
        // catch event select option with select2
        updateCurrentSelectedProcessSerial('TermSerialColumn');
        updateSelectedProcessSerial(true, e);
        disableUnselectedOption(selectedSerials, 'TermSerialColumn');
        enableOptionSelectedValue(e);
        if (callback) {
            callback();
        } else {
            disableSelectedOption(tableId, name);
        }
    });

    serialSelectEl.on('select2:unselecting', (e) => {
        // catch event unselect option with select2
        updateCurrentSelectedProcessSerial('TermSerialColumn');
        updateSelectedProcessSerial(false, e);
        disableUnselectedOption(selectedSerials, 'TermSerialColumn');
    });

    serialSelectEl.off('select2:opening');
    serialSelectEl.on('select2:opening', (e) => {
        // catch event open drop down with select2
        updateCurrentSelectedProcessSerial('TermSerialColumn');
        disableUnselectedOption(selectedSerials, 'TermSerialColumn');
        enableOptionSelectedValue(e);
    });
    const updateSelectedProcessSerial = (isSelect, e) => {
        let serialColDataId;
        const currentElement = $(e.currentTarget);
        const parentElement = currentElement.parents().eq(1);
        const serialProcId = parentElement
            .find(`select[name="TermSerialProcess"] option:selected`)
            .val();
        if (isSelect) {
            serialColDataId = e.params.data.id;
            selectedProcessSerial.add(`${serialProcId}-${serialColDataId}`);
        } else {
            serialColDataId = e.params.args.data.id;
            selectedProcessSerial.delete(`${serialProcId}-${serialColDataId}`);
        }
    };
    const enableOptionSelectedValue = (e) => {
        $(e.currentTarget).find('option:selected').attr('disabled', false);
    };
};

const updateCurrentSelectedProcessSerial = (serialName) => {
    const currentProcessSerial = new Set();
    const serialSelects = $(`select[name=${serialName}]`);
    serialSelects.each(function () {
        const selectElement = $(this);
        const parentElement = selectElement.parents().eq(1);
        const serialProcId = parentElement
            .find(`select[name="TermSerialProcess"] option:selected`)
            .val();
        const serialColDataId = selectElement.find(':selected').val();
        if (serialColDataId) {
            currentProcessSerial.add(`${serialProcId}-${serialColDataId}`);
        }
    });
    selectedProcessSerial = currentProcessSerial;
};

const showIndexOrderingSetting = async (
    tableId = formElements.serialTable,
    processName = 'serialProcess',
    serialName = 'serialColumn',
    orderName = 'serialOrder',
) => {
    // get serial for start proc
    const startProc = getFirstSelectedProc();
    // add to modal
    const serialTableBody = $(`${tableId} tbody`);
    serialTableBody.empty();
    const serialOrderRowHTML = await createOrderColRowHTML(
        startProc,
        tableId,
        processName,
        serialName,
        orderName,
    );
    serialTableBody.html(serialOrderRowHTML);

    // set value of serialColumn is first value
    $(`select[name=${serialName}]`).val(
        $(`select[name=${serialName}] option:nth-child(2)`).val(),
    );

    setSelect2Selection();
    bindChangeProcessEvent(tableId, processName, serialName);
    bindChangeOrderColEvent(tableId, serialName);

    updatePriorityAndDisableSelected(tableId, serialName);
    bindDragNDrop(serialTableBody, tableId, serialName);
};

const bindDragNDrop = (
    serialTableBody,
    tableId = formElements.serialTable,
    serialName = 'serialColumn',
) => {
    // drag & drop for tables
    serialTableBody.sortable({
        helper: dragDropRowInTable.fixHelper,
        update: () => {
            updatePriorityAndDisableSelected(tableId, serialName);
        },
    });
};

const addSerialOrderRow = async (
    tableId = formElements.serialTable,
    processName = 'serialProcess',
    serialName = 'serialColumn',
    orderName = 'serialOrder',
    selectedProc = null,
    selectedCol = null,
    selectedOrder = null,
    priority = null,
    isGraphArea = false,
) => {
    if (!tableId) {
        tableId = formElements.serialTable;
    }
    const startProc = selectedProc ? selectedProc : getFirstSelectedProc();
    const serialTableBody = $(`${tableId} tbody`);
    const serialOrderRowHTML = await createOrderColRowHTML(
        startProc,
        tableId,
        processName,
        serialName,
        orderName,
        selectedCol,
        selectedOrder,
        priority,
        isGraphArea,
    );
    serialTableBody.append(serialOrderRowHTML);
    setSelect2Selection(tableId);
    bindDragNDrop(serialTableBody, tableId, serialName);
};

const showSerialModal = (tableId = formElements.serialTableModal) => {
    $(tableId).modal('show');
};

const checkAndShowModal = (tableId = formElements.serialTable) => {
    const serialTableBody = $(`${tableId} tbody`);
    const numRows = serialTableBody.find('tr').length;

    if (!numRows) {
        showIndexOrderingSetting().then(() => {
            showSerialModal();
        });
    } else {
        bindDragNDrop(serialTableBody, tableId);
        showSerialModal();
    }
};

const bindXAxisEvents = () => {
    // change x-axis for timeseries chart
    $(formElements.xOption).on('change', function f() {
        const changeValOnly = $(this).data('change-val-only') || false;
        if (!changeValOnly) {
            if ($(this).val() === CONST.XOPT_INDEX && !isSettingLoading) {
                checkAndShowModal();
            }
            showIndexInforBox();
            compareSettingChange();
        }
        // reset to show modal
        $('#xOption').data('change-val-only', false);
    });

    $(formElements.btnAddSerial)
        .off('click')
        .on('click', () => {
            addSerialOrderRow().then(() => {
                bindChangeProcessEvent();
                updatePriorityAndDisableSelected();
                setTimeout(() => {
                    // wait select2 to be shown
                    bindChangeOrderColEvent();
                }, 200);
            });
        });
};

const genStepLineAnnotation = (plotData, xLabels, pointColor) => {
    const annotations = {};
    const startPoints = [];
    const endPoints = [];

    for (let i in plotData) {
        i = Number(i);
        let val = plotData[i];
        let nextVal = i < plotData.length - 1 ? plotData[i + 1] : null;
        let prevVal = i > 0 ? plotData[i - 1] : null;

        const pointPosition = Number(xLabels[i]) ? i : xLabels[i];
        // start if prev != val and next == val
        // end if prev == val and next != val
        if (val && nextVal === val && prevVal !== val) {
            startPoints.push([plotData[i], pointPosition]);
            // startPoints.push(Number(i));
        }
        if (val && prevVal === val && nextVal !== val) {
            endPoints.push([plotData[i], pointPosition]);
            // endPoints.push(Number(i));
        }
    }

    if (startPoints.length) {
        for (let i in startPoints) {
            const annoID = `anno${i}`;
            annotations[annoID] = {
                type: 'line',
                yMin: startPoints[i][0],
                yMax: endPoints[i][0],
                xMin: startPoints[i][1],
                xMax: endPoints[i][1],
                borderColor: pointColor,
                borderWidth: 1,
            };
        }
    }
    return annotations;
};

const orderSeriesCols = (columns) => {
    // sort serial & datetime to show first
    const serialCols = columns.filter((col) => col.is_serial_no);
    const datetimeCols = columns.filter((col) => col.is_get_date);
    const normalCols = columns.filter(
        (col) => !col.is_serial_no && !col.is_get_date,
    );

    return [...serialCols, ...datetimeCols, ...normalCols];
};

const getProcessColSelected = () => {
    const formData = collectFormData('#traceDataForm');
    const procData = [];
    const regex = /^end_proc\d+$/;

    for (const item of formData.entries()) {
        const key = item[0];
        const value = item[1];
        if (regex.test(key)) {
            procData.push(value);
        }
    }

    return procData;
};
