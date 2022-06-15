// eslint-disable-next-line no-unused-vars
const scatterChart = (ctx, data, prop) => {
    const [minX, maxX] = findMinMax(prop.xAxes);
    const [minY, maxY] = findMinMax(prop.yAxes);
    // build scatter plot options
    const chartOptions = {
        maintainAspectRatio: false,
        scales: {
            xAxes: [
                {
                    gridLines: {
                        color: '#3c3c3c',
                        zeroLineColor: '#3c3c3c',
                    },
                    ticks: {
                        fontColor: '#fff',
                        maxTicksLimit: 12,
                        maxRotation: 50,
                        minRotation: 15,
                        min: minX,
                        max: maxX,
                    },
                    beforeTickToLabelConversion(scaleInstance) {
                        if (prop.xAxes.length > 0) {
                            scaleInstance.ticks = scaleInstance.ticks.map(t => prop.xAxes.find(e => e >= t));
                        }
                    },
                },
            ],
            yAxes: [
                {
                    gridLines: {
                        color: '#3c3c3c',
                        zeroLineColor: '#3c3c3c',
                    },
                    ticks: {
                        fontColor: '#fff',
                        maxTicksLimit: 12,
                        maxRotation: 50,
                        minRotation: 15,
                        min: minY,
                        max: maxY,
                    },
                    beforeTickToLabelConversion(scaleInstance) {
                        if (prop.yAxes.length > 0) {
                            scaleInstance.ticks = scaleInstance.ticks.map(t => prop.yAxes.find(e => e >= t));
                        }
                    },
                },
            ],
        },
        title: {
            display: false,
            text: 'Chart.js Scatter Chart',
            fontColor: '#65c5f1',
        },
        legend: {
            display: false,
        },
        annotation: {
            annotations: [],
        },
    };

    const { procThresholds, uclThresholds } = prop;

    // procThresholds.xMin
    if (!isEmpty(procThresholds.xMin)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'vertical',
            scaleID: 'x-axis-1',
            value: procThresholds.xMin,
            borderColor: CONST.BLUE,
            borderWidth: 0.5,
        });
    }

    // procThresholds.xMax
    if (!isEmpty(procThresholds.xMax)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'vertical',
            scaleID: 'x-axis-1',
            value: procThresholds.xMax,
            borderColor: CONST.BLUE,
            borderWidth: 0.5,
        });
    }

    // procThresholds.yMin
    if (!isEmpty(procThresholds.yMin)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y-axis-1',
            value: procThresholds.yMin,
            borderColor: CONST.BLUE,
            borderWidth: 0.5,
        });
    }

    // procThresholds.yMax
    if (!isEmpty(procThresholds.yMax)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y-axis-1',
            value: procThresholds.yMax,
            borderColor: CONST.BLUE,
            borderWidth: 0.5,
        });
    }

    // draw line annotation
    if (!isEmpty(uclThresholds.xMin)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'vertical',
            scaleID: 'x-axis-1',
            value: uclThresholds.xMin,
            borderColor: CONST.RED,
            borderWidth: 0.5,
        });
    }

    if (!isEmpty(uclThresholds.xMax)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'vertical',
            scaleID: 'x-axis-1',
            value: uclThresholds.xMax,
            borderColor: CONST.RED,
            borderWidth: 0.5,
        });
    }

    if (!isEmpty(uclThresholds.yMin)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y-axis-1',
            value: uclThresholds.yMin,
            borderColor: CONST.RED,
            borderWidth: 0.5,
        });
    }

    if (!isEmpty(uclThresholds.yMax)) {
        chartOptions.annotation.annotations.push({
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y-axis-1',
            value: uclThresholds.yMax,
            borderColor: CONST.RED,
            borderWidth: 0.5,
        });
    }

    // create scatter plot instance
    let outputChart;
    try {
        outputChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Scatter Dataset',
                        showLine: false,
                        pointBackgroundColor: '#89b368',
                        data,
                    },
                ],
            },
            options: chartOptions,
        });
    } catch (error) {
        console.log(error);
    }
    return outputChart;
};
