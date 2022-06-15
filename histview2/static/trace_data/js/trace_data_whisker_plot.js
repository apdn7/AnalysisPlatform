const whiskerPlot = (ctx, prop) => {
    const left = 0;
    const right = 3;

    let tickConfig = {
        rotation: 0,
    };
    if (xaxis === 'INDEX') {
        tickConfig = {
            rotation: 0,
        };
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        spanGaps: true,
        parsing: false,
        scales: {
            x: {
                min: 0,
                max: 3,
                ticks: {
                    maxRotation: tickConfig.rotation,
                    minRotation: tickConfig.rotation,
                    display: true,
                    color: 'rgba(0,0,0,0)',
                },
                grid: {
                    display: false,
                    drawTicks: false,
                    drawBorder: false,
                },
                title: {
                    display: false,
                    // text: '',
                    // font: {
                    //     family: 'Calibri Light',
                    //     size: 12,
                    //     color: '#fff',
                    // },
                },
                // afterTickToLabelConversion: function adjust(context) {
                //     context.ticks[0].label = '012';
                //     for (const idx in context.ticks) {
                //         context.ticks[idx].label = (context.ticks[idx].label || '').padStart(tickConfig.pad, ' ');
                //     }
                // },
            },
            y: {
                min: prop.minY,
                max: prop.maxY,
                title: {
                    display: false,
                },
                ticks: {
                    minRotation: 0,
                    maxRotation: 0,
                    sampleSize: 8,
                    color: 'rgba(0,0,0,0)',
                    font: {
                        size: 10,
                    },
                },
                grid: {
                    display: false,
                    color: CONST.GRID,
                    drawTicks: false,
                    drawBorder: false,
                },
                // afterTickToLabelConversion: function adjust(context) {
                //     const { ticks } = context;
                //     context.ticks[0].label = '';
                //     if (ticks.length) context.ticks[ticks.length - 1].label = '';
                // },
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            annotation: {
                drawTime: 'afterDraw',
                annotations: {
                    // boxQ1Q3,
                    // boxMax,
                    // boxMin,
                    // q3Max,
                    // q1Min,
                    // boxMedian,
                    // TODO later
                    // boxAverage,
                    // boxAverageSigmaMinus,
                    // boxAverageSigmaPlus,
                },
            },
        },
        events: ['click', 'mousemove', 'enter', 'leave'],
        layout: {
            padding: {
                right: 29,
                left: 3,
            },
        },
    };

    if (!isEmpty(prop.q3_org) && !isEmpty(prop.p100_org)) {
        chartOptions.plugins.annotation.annotations.q3Max = {
            type: 'box',
            xMin: (left + right) / 2,
            xMax: (left + right) / 2,
            yMin: prop.q3_org,
            yMax: prop.p100_org,
            borderColor: '#89b368',
        };
    }

    if (!isEmpty(prop.p0_org) && !isEmpty(prop.q1_org)) {
        chartOptions.plugins.annotation.annotations.q1Min = {
            type: 'box',
            xMin: (left + right) / 2,
            xMax: (left + right) / 2,
            yMin: prop.p0_org,
            yMax: prop.q1_org,
            borderColor: '#89b368',
        };
    }

    if (!isEmpty(prop.q1_org) && !isEmpty(prop.q3_org)) {
        chartOptions.plugins.annotation.annotations.boxQ1Q3 = {
            type: 'box',
            xMin: left,
            xMax: right,
            yMin: prop.q1_org,
            yMax: prop.q3_org,
            backgroundColor: 'rgba(137, 179, 104, 0.2)',
            borderColor: '#89b368',
            click(e) {
                showWhiskerHover(e);
            },
            enter(e) {
                showWhiskerHover(e);
            },
            leave(e) {
                const canvasId = e.chart.canvas.id;
                const hoverElement = $(`#${canvasId}Hover`);
                hoverElement.css('display', 'none');
            },
        };
    }

    if (!isEmpty(prop.median_org)) {
        chartOptions.plugins.annotation.annotations.boxMedian = {
            type: 'box',
            xMin: left,
            xMax: right,
            yMin: prop.median_org,
            yMax: prop.median_org,
            borderColor: '#89b368',
        };
    }

    if (!isEmpty(prop.p100_org)) {
        chartOptions.plugins.annotation.annotations.boxMax = {
            type: 'box',
            xMin: left,
            xMax: right,
            yMin: prop.p100_org,
            yMax: prop.p100_org,
            borderColor: '#89b368',
        };
    }

    if (!isEmpty(prop.p0_org)) {
        chartOptions.plugins.annotation.annotations.boxMin = {
            type: 'box',
            xMin: left,
            xMax: right,
            yMin: prop.p0_org,
            yMax: prop.p0_org,
            borderColor: '#89b368',
        };
    }

    // destroy instance
    try {
        Chart.helpers.each(Chart.instances, (instance) => {
            const { id } = instance;
            const cvasId = instance.canvas.id;
            if (cvasId === ctx.canvas.id) {
                Chart.instances[id].destroy();
            }
        });
    } catch (e) {
        console.log(e);
    }

    const chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    borderWidth: 1,
                    data: [],
                    showLine: false,
                    pointBackgroundColor: '#89b368',
                    pointRadius: 1.5,
                },
            ],
        },
        options: chartOptions,
    });

    // update hover data
    updateHoverData(ctx.canvas.id, prop);

    return chart;
};


const getChartInforIndex = (plotData, clickedVal) => {
    const chartInfosY = plotData.chart_infos || [];
    const chartInfosYOrg = plotData.chart_infos_org || [];
    const [latestChartInfoY, idx] = chooseLatestThresholds(chartInfosY, chartInfosYOrg, clickedVal);
    return idx;
};

const genProp = (plotData, chartInforIndex = null, cfgYMin = null, cfgYMax = null) => {
    const nonParametric = getNode(plotData.summaries[chartInforIndex], ['non_parametric']) || {};
    const stats = getNode(plotData.summaries[chartInforIndex], ['basic_statistics']) || {};

    let yMax = cfgYMax;
    let yMin = cfgYMin;
    if (yMax === null) {
        yMax = nonParametric.upper_range;
    }
    if (yMin === null) {
        yMin = nonParametric.lower_range;
    }
    return {
        minY: yMin,
        maxY: yMax,
        lowerRange: nonParametric.lower_range,
        upperRange: nonParametric.upper_range,
        p0: nonParametric.whisker_lower,
        p0_org: nonParametric.whisker_lower_org,
        p100: nonParametric.whisker_upper,
        p100_org: nonParametric.whisker_upper_org,
        left: 1,
        right: 2,
        q1: nonParametric.p25,
        q1_org: nonParametric.p25_org,
        q3: nonParametric.p75,
        q3_org: nonParametric.p75_org,
        iqr: nonParametric.iqr,
        niqr: nonParametric.niqr,
        median: nonParametric.median,
        median_org: nonParametric.median_org,
        mode: nonParametric.mode,
        average: stats.average,
        t_average: stats.t_average,
        sigma: stats.sigma,
        avg_p_3sigma: stats.avg_p_3sigma,
        avg_p_sigma: stats.avg_p_sigma,
        avg_m_sigma: stats.avg_m_sigma,
        avg_m_3sigma: stats.avg_m_3sigma,
        t_avg_p_3sigma: stats.t_avg_p_3sigma,
        t_avg_p_sigma: stats.t_avg_p_sigma,
        t_avg_m_sigma: stats.t_avg_m_sigma,
        t_avg_m_3sigma: stats.t_avg_m_3sigma,
    };
};

const showWhiskerHover = (e) => {
    // hide all before show new
    hideAllWhiskerHover();

    // show hover
    const canvasId = e.chart.canvas.id;
    const rec = $(`#${canvasId}`)[0].getBoundingClientRect();
    const hoverElement = $(`#${canvasId}Hover`);
    hoverElement.css('left', rec.x + rec.width - 35);
    hoverElement.css('top', rec.y);
    hoverElement.css('display', 'block');
    hoverElement.css('visibility', 'visible');
    hoverElement.css('opacity', '1');
    // #s120b14 todo pin from mouse position to use copy button
};

const hideAllWhiskerHover = () => {
    $('.whisker-hover').css('display', 'none');
};

const produceWhiskerPlots = (data) => {
    if (!data.array_plotdata.length) return;

    const plotDatas = data.array_plotdata;
    for (const sensorIdx in plotDatas) {
        const plotData = plotDatas[sensorIdx];
        if (!plotData.before_rank_values) {
            drawSensorWhisker(sensorIdx, plotData, null);
        }
    }

    $('.whisker').on('mouseout', (e) => {
        const isOnHoverPopup = $(e.target).closest('.whisker-hover');
        if (!isOnHoverPopup) {
            hideAllWhiskerHover();
        }
    });
    $('.whisker-hover').on('mouseleave', (e) => {
        hideAllWhiskerHover();
    });
};

const drawSensorWhisker = (sensorIdx, plotData, clickedVal = null, cfgYMin = null, cfgYMax = null) => {
    const canvasId = `whisker0${parseInt(sensorIdx) + 1}`;
    const canvasElement = $(`#${canvasId}`);
    const chartInforIndex = getChartInforIndex(plotData, clickedVal);
    if (!shouldUpdateWhisker(canvasElement, chartInforIndex)) {
        return;
    }
    const prop = genProp(plotData, chartInforIndex, cfgYMin, cfgYMax);
    const ctx = canvasElement.get(0).getContext('2d');
    const chart = whiskerPlot(ctx, prop);
    graphStore.addWhiskerObj(canvasId, chart);
};

const shouldUpdateWhisker = (canvasElement, chartInforIndex) => {
    if (`${canvasElement.attr('summary-index')}` === `${chartInforIndex}`) {
        return false;
    }
    canvasElement.attr('summary-index', chartInforIndex);
    return true;
};

const updateHoverData = (canvasId, prop) => {
    const hoverId = `${canvasId}Hover`;
    const withOutlierLabel = $('#i18nWithOutlier').text();
    const woOutlierLabel = $('#i18nWOOutlier').text();
    const hoverHTML = `<div>
        <div class="tbl-group" style="max-width: 200px;">
            <button class="btn clipboard" data-clipboard-target="#${canvasId}ParamTbl" title="Copy to Clipboard">
                <i class="fa fa-copy" aria-hidden="true"></i>
            </button>
            <table id="${canvasId}ParamTbl">
                <tbody>
                    <tr>
                      <td nowrap>Upper range</td>
                      <td>${prop.upperRange}</td>
                    </tr>
                    <tr>
                      <td>Upper whisker</td>
                      <td>${prop.p100}</td>
                    </tr>
                    <tr>
                      <td>Q3 P75</td>
                      <td>${prop.q3}</td>
                    </tr>
                    <tr>
                      <td>Median</td>
                      <td>${prop.median}</td>
                    </tr>
                    <tr>
                      <td>Q1 P25</td>
                      <td>${prop.q1}</td>
                    </tr>
                    <tr>
                      <td>Lower whisker</td>
                      <td>${prop.p0}</td>
                    </tr>
                    <tr>
                      <td>Lower range</td>
                      <td>${prop.lowerRange}</td>
                    </tr>
                    <tr>
                      <td>IQR</td>
                      <td>${prop.iqr}</td>
                    </tr>
                    <tr>
                      <td>NIQR</td>
                      <td>${prop.niqr}</td>
                    </tr>
                    <tr>
                      <td>Mode</td>
                      <td>${prop.mode}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="tbl-group">
            <button class="btn clipboard" data-clipboard-target="#${canvasId}NonParamTbl" title="Copy to Clipboard">
                <i class="fa fa-copy" aria-hidden="true"></i>
            </button>
            <table id="${canvasId}NonParamTbl">
                <thead>
                    <th></th>
                    <th nowrap>${woOutlierLabel}</thn>
                    <th nowrap>${withOutlierLabel}</th>
                </thead>
                <tbody>
                    <tr>
                      <td nowrap>Average +3σ</td>
                      <td>${prop.t_avg_p_3sigma}</td>
                      <td>${prop.avg_p_3sigma}</td>
                    </tr>
                    <tr>
                      <td>Average +σ</td>
                      <td>${prop.t_avg_p_sigma}</td>
                      <td>${prop.avg_p_sigma}</td>
                    </tr>
                    <tr>
                      <td>Average</td>
                      <td>${prop.t_average}</td>
                      <td>${prop.average}</td>
                    </tr>
                    <tr>
                      <td>Average -σ</td>
                      <td>${prop.t_avg_m_sigma}</td>
                      <td>${prop.avg_m_sigma}</td>
                    </tr>
                    <tr>
                      <td>Average -3σ</td>
                      <td>${prop.t_avg_m_3sigma}</td>
                      <td>${prop.avg_m_3sigma}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
    </div>
`;

    $(`#${hoverId}`).html(hoverHTML);
};
