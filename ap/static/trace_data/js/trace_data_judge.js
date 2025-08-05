function judgeChart($, paramObj, chartLabels = null, tabID = null, xaxis = 'TIME') {
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
    const judgeData = setParam('judgeData', []);
    const negRatioData = setParam('negRatioData', []);
    const negCumsumData = setParam('negCumsum', []);
    const NGLabel = setParam('NGLabel', 'NG');
    const OKLabel = setParam('OKLabel', 'OK');
    // judge column's density
    const negDensity = setParam('negDensity', undefined);
    let negDensityYMax = negDensity.kde ? Math.max(...negDensity.kde) : undefined;
    let marginYScale = negDensityYMax ? negDensityYMax * 0.1 : 0;
    // margin top for density curve
    negDensityYMax += marginYScale;

    const negDensityXMax = negDensity?.hist_labels[negDensity?.hist_labels.length - 1];

    // ヒストグラムとY軸の範囲を合わせる
    let minY = setParam('minY', null);
    let maxY = setParam('maxY', null);
    if (minY === null || maxY === null) {
        const [yMin, yMax] = findMinMax(plotData);
        minY = minY === null ? yMin : minY;
        maxY = maxY === null ? yMax : maxY;
    }

    const isThinData = setParam('isThinData', false);

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
            // TODO: use another factor instead of dataset index
            if (dicRankLabels && (datasetIndex == 0 || datasetIndex == 1)) {
                const rankLabel = dicRankLabels[y];
                return rankLabel ? rankLabel : COMMON_CONSTANT.NA;
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
                (COMMON_CONSTANT.NA === medVal && COMMON_CONSTANT.NA === minVal && COMMON_CONSTANT.NA === maxVal) ||
                medVal === noLinked
            ) {
                minVal = '';
                maxVal = '';
            }

            return [minVal, applySignificantDigit(medVal), maxVal];
        };

        // use showname for Japan locale only
        const filterNameByLocale = (threholdInfo) => {
            const currentLocale = docCookies.getItem(keyPort('locale'));
            if (!threholdInfo['type']) {
                return i18n.default;
            }
            return currentLocale === localeConst.JP ? threholdInfo['type'] : threholdInfo['eng_name'];
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
            const [chartInfos, chartInfosOrg] = getChartInfo(plotData, 'TIME', filterCond);
            const clickedVal = currentTraceData.array_plotdata[dataIndex].array_x[dataPoint.dataIndex];
            const [latestChartInfo] = chooseLatestThresholds(chartInfos, chartInfosOrg, clickedVal);
            const threshHigh = latestChartInfo['thresh-high'] || '';
            const threshLow = latestChartInfo['thresh-low'] || '';
            const prcMax = latestChartInfo['prc-max'] || '';
            const prcMin = latestChartInfo['prc-min'] || '';
            const validFrom = latestChartInfo['act-from']
                ? moment(latestChartInfo['act-from']).format('YYYY-MM-DD HH:mm:ss')
                : '';
            const validTo = latestChartInfo['act-to']
                ? moment(latestChartInfo['act-to']).format('YYYY-MM-DD HH:mm:ss')
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
            const datetimeCol = currentTraceData.common_info[procId].datetime_col;

            const canvasId = dataPoint.chart.canvas.id;
            const dataIndex = $(`#${canvasId}`).attr('plotdata-index') || 0;
            const x = currentTraceData.array_plotdata[dataIndex].array_x[dataPoint.dataIndex];
            if (isEmpty(x)) {
                return { name: '', value: '' };
            }
            const xLabel = formatDateTime(x); // convert to localtime
            return { name: datetimeCol, value: xLabel };
        };
        const getSerialObj = (dataPoint) => {
            const currentTraceData = graphStore.getTraceData();
            const serialColsName = currentTraceData.common_info[procId].serial_columns || [];
            if (isEmpty(serialColsName)) {
                return [{ name: '', value: '' }];
            }

            const dataIndex = dataPoint.dataIndex;
            let serials;
            const canvasId = graphStore.getSelectedCanvas();
            const canvasIdx = parseInt(canvasId.substring(5, 8)) - 1; // canvasId = 'chart03' -> canvasIdx = 2
            if (currentTraceData.is_thin_data) {
                serials = currentTraceData.array_plotdata[canvasIdx].serial_data;
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

        const genDataTable = (dataPoint, outlierDict, currentThreshold) => {
            let thresholdTr = '';
            const yVal = getDatYVal(dataPoint, beforeRankValues, outlierDict);
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

            thresholdTr += genTRItems('', ''); // br

            // filter
            thresholdTr += genTRItems(i18n.attribute, currentThreshold.filterCol, currentThreshold.filterDetail);
            thresholdTr += genTRItems('', ''); // br
            // threshold table
            thresholdTr += genTRItems('', i18n.limit, i18n.procLimit);
            thresholdTr += genTRItems(i18n.threshHigh, currentThreshold.threshHigh, currentThreshold.prcMax);
            thresholdTr += genTRItems(i18n.threshLow, currentThreshold.threshLow, currentThreshold.prcMin);
            thresholdTr += genTRItems('', '');
            // apply time
            thresholdTr += genTRItems(i18n.validFrom, currentThreshold.validFrom);
            thresholdTr += genTRItems(i18n.validTo, currentThreshold.validTo);
            return thresholdTr;
        };

        const genNegRatioTable = (dataPoint, outlierDict, currentThreshold) => {
            let thresholdTr = '';
            thresholdTr += genTRItems('Neg_Ratio', getDatYVal(dataPoint, beforeRankValues, outlierDict));

            thresholdTr += genTRItems('N_neg', `${dataPoint.raw.n_neg} ${NGLabel}`);
            thresholdTr += genTRItems('N', `${dataPoint.raw.n} ${NGLabel} & ${OKLabel}`);
            thresholdTr += genTRItems(i18n.from, checkAndReturnLocalDateTime(dataPoint.raw.start_date));
            thresholdTr += genTRItems(i18n.to, checkAndReturnLocalDateTime(dataPoint.raw.end_date));
            return thresholdTr;
        };
        const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

        // Display, position, and set styles for font
        tooltipEl.style.opacity = 0;
        // hover information table position
        const canvasOffset = $(`#${chart.canvas.id}`).offset();
        const leftPosition = canvasOffset.left + positionX + tooltip.caretX;
        const topPosition = canvasOffset.top + positionY + tooltip.caretY;
        let dataTable;
        switch (dataPoint.datasetIndex) {
            case 0:
                dataTable = genDataTable(dataPoint, outlierDict, currentThreshold);
                break;
            case 2:
                dataTable = genNegRatioTable(dataPoint, outlierDict, currentThreshold);
                break;
            default:
                dataTable = genDataTable(dataPoint, outlierDict, currentThreshold);
                break;
        }
        genDataPointHoverTable(dataTable, { x: leftPosition - 192, y: topPosition }, 0, true, chart.canvas.id);
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
                        scale._unit = getUnitDateTimeFormat(scale.min, scale.max, scale.ticks.length);
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
                        let ticks = [];
                        for (const key of Object.keys(beforeRankValues)) {
                            ticks.push({ value: key });
                        }

                        axis.ticks = ticks;
                        return;
                    },
                    afterTickToLabelConversion: function adjust(context) {
                        const ticks = context.ticks;
                        alignLengthTickLabels(context.ticks);
                    },
                    afterFit: function (scaleInstance) {
                        scaleInstance.width = 60; // sets the width to 100px
                    },
                    ticks: {
                        labelOffset: 20,
                        mirror: !!beforeRankValues,
                        padding: -45, // TODO: adjust according to label size
                        maxRotation: 0,
                        minRotation: 0,
                        sampleSize: beforeRankValues ? Object.keys(beforeRankValues).length : 8,
                        color: CONST.TICK,
                        callback: function (value) {
                            return parseInt(value) ? NGLabel : '';
                        },
                    },
                    grid: {
                        color: CONST.GRID,
                        drawTicks: false,
                        drawBorder: false,
                    },
                },
                xNegRatio: {
                    // max: negRatioData.length - 1,
                    // min: 0,
                    type: 'linear',
                    position: 'top',
                    display: false,
                },
                yNegRatio: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    min: minY,
                    max: maxY,
                },
                yNegDensity: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    max: negDensityYMax || maxY,
                    min: 0,
                },
                xNegDensity: {
                    type: 'linear',
                    position: 'top',
                    display: false,
                    max: negDensityXMax, // x-axis is idx or datetime
                    min: 0,
                },
                xCumsum: {
                    max: negCumsumData.length - 1,
                    min: 0,
                    type: 'linear',
                    position: 'top',
                    display: false,
                },
                yCumsum: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    min: negCumsumData[0].y,
                    max: negCumsumData[negCumsumData.length - 1].y,
                },
            },
            onHover(evt, a, chart) {
                const item = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false); // const lastItem = chart.getActiveElements();

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

    const judgeRawData = judgeData.map((value, index) => {
        return { x: moment.utc(value.x).toDate(), y: value.y };
    });
    const negRatioChartData = negRatioData.map((value, index) => {
        return {
            x: moment.utc(value.x).toDate(),
            y: value.y,
            n_neg: value.n_neg,
            n: value.n,
            start_date: value.start_date,
            end_date: value.end_date,
        };
    });
    const cumSumChartData = negCumsumData.map((value, index) => {
        return { x: moment.utc(value.x).toDate(), y: value.y };
    });
    const negDensityChartData = negDensity.kde
        .map((value, index) => {
            if (!negRatioData[index]) return null;
            const xValue = negRatioData[index].x;
            return {
                x: moment.utc(xValue).toDate(),
                y: value,
            };
        })
        .filter((i) => i !== null);

    const pointSize = plotData.length <= CONST.SMALL_DATA_SIZE ? 2.5 : plotData.length < 1000 ? 1.5 : 1;
    config.data = {
        datasets: [
            {
                label: 'Dataset 1',
                data: judgeRawData,
                backgroundColor: pointColor, // ts chart dot color
                borderColor: pointColor, // link between dot color
                borderWidth: 0.5,
                showLine: false,
                pointRadius: pointSize,
                order: 0,
                pointBackgroundColor: new Array(plotData.length).fill(pointColor), // stepped: !!beforeRankValues,
                dictIdx2YValue,
                xAxisID: 'x',
                yAxisID: 'y',
            },
            {
                label: 'Dataset 2',
                data: plotDataEx,
                pointBackgroundColor: plotDataExColor,
                type: 'line',
                order: 1,
                showLine: false,
                xAxisID: 'x',
                yAxisID: 'y',
            },
            {
                label: 'Neg Ratio',
                data: negRatioChartData,
                pointBackgroundColor: CONST.COLOR_NORMAL,
                borderColor: CONST.COLOR_NORMAL,
                borderWidth: 0.5,
                type: 'line',
                order: 2,
                showLine: true,
                pointRadius: 0,
                xAxisID: 'x',
                yAxisID: 'yNegRatio',
            },
            {
                label: 'Neg Density',
                data: negDensityChartData,
                pointBackgroundColor: CONST.JUDGE_DENSITY,
                borderColor: CONST.JUDGE_DENSITY,
                borderWidth: 1.5,
                type: 'line',
                order: 3,
                showLine: true,
                pointRadius: 0,
                xAxisID: 'x',
                yAxisID: 'yNegDensity',
            },
            {
                label: 'Neg Cumsum',
                data: negCumsumData,
                pointBackgroundColor: CONST.COLOR_NORMAL,
                borderColor: 'orange',
                borderWidth: 0.5,
                pointRadius: 0,
                type: 'line',
                order: 4,
                showLine: true,
                stepped: true,
                xAxisID: 'x',
                yAxisID: 'yCumsum',
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
        let actFrom = isEmpty(chartInfo['act-from']) ? startDateTime : convertFunc(chartInfo['act-from']);
        let actTo = isEmpty(chartInfo['act-to']) ? endDateTime : convertFunc(chartInfo['act-to']);
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
            config.options.plugins.annotation.annotations[`ucl-${idx}`] = createTSThreshold(
                threshHigh,
                CONST.RED,
                actFrom,
                actTo,
            );
        }

        if (!isEmpty(threshLow)) {
            config.options.plugins.annotation.annotations[`lcl-${idx}`] = createTSThreshold(
                threshLow,
                CONST.RED,
                actFrom,
                actTo,
            );
        }

        if (!isEmpty(prcMin)) {
            config.options.plugins.annotation.annotations[`lpcl-${idx}`] = createTSThreshold(
                prcMin,
                CONST.BLUE,
                actFrom,
                actTo,
            );
        }

        if (!isEmpty(prcMax)) {
            config.options.plugins.annotation.annotations[`upcl-${idx}`] = createTSThreshold(
                prcMax,
                CONST.BLUE,
                actFrom,
                actTo,
            );
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

    const stepLineAnnotation = genStepLineAnnotation(plotData, xLabels, pointColor);
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
