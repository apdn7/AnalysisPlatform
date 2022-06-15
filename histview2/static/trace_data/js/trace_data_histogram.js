/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */

/* eslint-disable no-unused-vars */

function YasuHistogram($, paramObj) {
    // 内部変数の初期化
    const canvasId = setParam('canvasId', 'hist01');
    const title = setParam('title', '');
    const beforeRankValues = setParam('beforeRankValues', null);
    const kdeData = setParam('kdeData', []);
    const threshLow = setParam('threshLow', '');
    const threshHigh = setParam('threshHigh', '');
    const prcMin = setParam('prcMin', '');
    const prcMax = setParam('prcMax', '');
    let valMin = setParam('minY', 0);
    let valMax = setParam('maxY', 0);
    const isThinData = setParam('isThinData', false);
    const xAxisOption = setParam('xAxisOption', 'TIME');

    if (beforeRankValues) {
        valMin -= 0.5;
        valMax += 0.5;
    }


    // ////////////// プライベート関数の定義 ////////////////////
    function setParam(key, defaultValue) {
        if (key in paramObj && !isEmpty(paramObj[key])) {
            return paramObj[key];
        }
        return defaultValue;
    }

    // ////////////////////////////////////////////
    const ctx = $(`#${canvasId}`).get(0).getContext('2d');
    const labels = [...kdeData.hist_labels].reverse();
    const counts = [...kdeData.hist_counts].reverse();
    const kdes = [...kdeData.kde].reverse();

    const maxKDE = Math.max(...kdes);
    const maxHist = Math.max(...kdeData.hist_counts);
    const transKDE = kdes.map(i => maxHist * i / maxKDE);

    const data = {
        labels,
        datasets: [
            {
                label: 'Histogram',
                data: counts,
                backgroundColor: '#75955d',
                order: 1,
                xAxisID: 'x2',
                minBarLength: 2,
            },
        ],
    };
    if (!beforeRankValues) {
        // append KDE line if sensor is not categorical variable
        data.datasets.push({
            label: 'KDE2',
            data: transKDE,
            backgroundColor: isThinData ? CONST.COLOR_THIN : '#d07e00',
            borderColor: isThinData ? CONST.COLOR_THIN : '#d07e00',
            type: 'line',
            order: 0,
            xAxisID: 'x2',
            pointRadius: 0,
            borderWidth: 1,
        });
    }

    const config = {
        type: 'bar',
        data,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            spanGaps: true,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false,
                },
                annotation: {
                    annotations: {},
                },
                chartAreaBorder: {
                    borderColor: CONST.COLOR_FRAME_BORDER,
                    borderWidth: 2,
                    borderDash: false,
                },
            },
            scales: {
                x2: {
                    title: {
                        display: false,
                        text: '',
                        font: {
                            family: 'Calibri Light',
                            size: 12,
                            color: '#fff',
                        },
                    },
                    ticks: {
                        minRotation: 0,
                        maxRotation: 0,
                        color: CONST.TICK,
                        beginAtZero: true,
                        align: 'end',
                        font: {
                            family: 'Calibri Light', size: 12,
                        },
                    },
                    grid: {
                        color: CONST.GRID,
                        drawTicks: false,
                        drawBorder: false,
                    },
                    // afterTickToLabelConversion: function adjust(context) {
                    //     const ticks = context.ticks;
                    //     context.ticks[ticks.length - 1].align = 'end';
                    // context.ticks[0].label = '';
                    // if (ticks.length) context.ticks[ticks.length - 1].label = '';
                    // for (const idx in context.ticks) {
                    //     context.ticks[idx].label = (context.ticks[idx].label || '').padStart(8, ' ');
                    // }
                    // },
                },
                y: {
                    display: false,
                    offset: false,
                    grid: {
                        offset: false,
                        color: CONST.GRID,
                        drawTicks: false,
                        drawBorder: false,
                    },
                    afterFit(scaleInstance) {
                        scaleInstance.width = 20;
                    },
                    type: 'linear',
                    position: 'left',
                    min: valMin,
                    max: valMax,
                    reverse: false,
                    ticks: {
                        // minRotation: 0,
                        // maxRotation: 0,
                        sampleSize: beforeRankValues ? Object.keys(beforeRankValues).length : 8,
                        color: CONST.TICK,
                        // show text before ranked instead of ranked value
                        // callback(value, index, values) {
                        //     // String Ranked label
                        //     let showVal;
                        //     if (beforeRankValues) {
                        //         showVal = beforeRankValues[value];
                        //     } else {
                        //         showVal = this.getLabelForValue(value);
                        //     }
                        //     return applySignificantDigit(showVal);
                        // },
                    },
                    // afterBuildTicks(axis) {
                    //     if (beforeRankValues) {
                    //         axis.ticks = [];
                    //         for (const key of Object.keys(beforeRankValues)) {
                    //             axis.ticks.push({ value: key });
                    //         }
                    //     }
                    // },
                },
            },
            events: ['click', 'mousemove'],
            onClick(event) {
                removeAllCrossHair();
            },
            layout: {
                padding: {
                    top: 12,
                },
            },
        },
        plugins: [chartAreaBorder],
    };
    if (xAxisOption === 'INDEX') {
        config.options.scales.x2.ticks.minRotation = 0;
        config.options.scales.x2.ticks.maxRotation = 0;
    }

    if (!isEmpty(threshHigh)) {
        config.options.plugins.annotation.annotations.ucl = createHistHorizonalThreshold(threshHigh, CONST.RED, CONST.UCL);
    }
    if (!isEmpty(threshLow)) {
        config.options.plugins.annotation.annotations.lcl = createHistHorizonalThreshold(threshLow, CONST.RED, CONST.LCL);
    }
    if (!isEmpty(prcMin)) {
        config.options.plugins.annotation.annotations.lpcl = createHistHorizonalThreshold(prcMin, CONST.BLUE, CONST.LPCL);
    }
    if (!isEmpty(prcMax)) {
        config.options.plugins.annotation.annotations.upcl = createHistHorizonalThreshold(prcMax, CONST.BLUE, CONST.UPCL);
    }

    const chart = new Chart(ctx, config);

    const histObj = {
        histLabels: labels,
        histCounts: counts,
        histKDE: kdes,
        title,
        threshHigh,
        threshLow,
        prcMin,
        prcMax,
        minY: valMin,
        maxY: valMax,
    };

    return {
        histObj,
        chartObject: chart,
    };
}

const createHistHorizonalThreshold = (threshHold, color = CONST.RED, id = CONST.UCL, borderDash = []) => ({
    type: 'line',
    id,
    mode: 'horizontal',
    scaleID: 'y',
    value: threshHold,
    borderColor: color,
    borderWidth: 0.7,
    borderDash,
});
