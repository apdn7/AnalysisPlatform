/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */

// dont rename. must use formElements because some common functions
// are called from component.js. These functions use a formElements variable.
// TODO: fix this.
const formElements = {
    NO_FILTER: 'NO_FILTER',
};

const eles = {
    qContributionChart: '#qContributionChart',
    t2ContributionChart: '#t2ContributionChart',
    pcaBiplotChart: '#pcaBiplotChart',
    recordInfoTable: '#dp-body',
    formID: '#traceDataForm',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcReg: /cond_proc/g,
    NO_FILTER: 'NO_FILTER',
    msgModal: '#msgModal',
    msgContent: '#msgContent',
    msgConfirmBtn: '#msgConfirmBtn',
    selectAll: '#selectAll',
    recentTimeIntervalInput: 'input[name="recentTimeInterval"]',
    btnAddCondProc: '#btn-add-cond-proc',
    pcaConditionTbl: '#pcaConditionTbl',
    spinner: '#spinner',
    pcaConditionTblAllRows: '#pcaConditionTbl>tbody>tr',
};

const showLoading = (divElement = null) => {
    if (!divElement) return;

    const currentContentHeight = divElement.height();
    const loadingHTML = `
        <div style="height: ${currentContentHeight}px;" class="d-flex justify-content-center">
            <div class="spinner-grow text-info" role="status" style="margin: auto;">
            <span class="sr-only">Loading...</span>
            </div>
        </div>`;
    divElement.html(loadingHTML);
};

const hideLoading = (divElement = null) => {
    if (!divElement) return;
    divElement.html('');
};


// A template to visualize clicked data point
const clickedPointTemplate = (xVal, yVal) => ({
    x: [xVal],
    y: [yVal],
    text: [`xvar: ${xVal}<br />yvar: ${yVal}`],
    type: 'scatter',
    mode: 'markers',
    marker: {
        autocolorscale: false,
        color: 'red',
        opacity: 0.8,
        size: 8,
        symbol: 'square',
    },
    hoveron: 'points',
    showlegend: false,
    xaxis: 'x',
    yaxis: 'y',
    hoverinfo: 'text',
    frame: null,
    isSelectedPoint: true,
});

// update Chart from x and y
const addDataPointFromXY = (elementId, orginalDataLen, x, y) => {
    const clickedPointTrace = clickedPointTemplate(x, y);
    if (clickedPointTrace) {
        const chartElement = document.getElementById(elementId);
        const dataLength = chartElement.data.length;
        if (dataLength > orginalDataLen) {
            Plotly.deleteTraces(elementId, dataLength - 1);
        }
        Plotly.addTraces(elementId, clickedPointTrace, chartElement.data.length);
    }
};


/*
    This function is to update clicked data point to timeseries chart: Q & T2
    Args:
        elementId: id of chart
        dataPoint: data of clicked point got from click event
        isStartingChart: to identify if chart in the elementId is origin of the click
*/
const updateTimeSeries = (elementId = null, dataPoint = {}, isStartingChart = true) => {
    // update Chart
    const tsElement = document.getElementById(elementId);
    const tsOriginalDataLength = 2;
    if (isStartingChart) {
        // use x, y directly if the chart originates the click
        const { x, y } = dataPoint.points[0];
        addDataPointFromXY(elementId, tsOriginalDataLength, x, y);
    } else if (!isStartingChart) {
        // find x, y from sampleNo and clickedDataIndex if the chart doesn't originate the click
        const { data } = tsElement;
        const { sampleNo, clickedDataIndex } = dataPoint.points[0];

        for (let idx = 0; idx < data.length; idx++) {
            const trace = data[idx];
            if ((trace.name === 'test')) { // clicked point is in test data
                const dataX = trace.x[clickedDataIndex];
                const dataY = trace.y[clickedDataIndex];
                addDataPointFromXY(elementId, tsOriginalDataLength, dataX, dataY);
                break;
            }
        }
    }
};

/*
    This function is to update clicked data point to timeseries chart: Q & T2
    Args:
        elementId: id of chart
        dataPoint: data of clicked point got from click event
        isStartingChart: to identify if chart in the elementId is origin of the click
*/
const updateScatter = (elementId = null, dataPoint = {}, isStartingChart = true, jsonDtTest = {}) => {
    // update Chart
    const scatterElement = document.getElementById(elementId);
    const scatterOrginalDataLength = 6;
    if (isStartingChart) {
        // use x, y directly if the chart originates the click
        const { x, y } = dataPoint.points[0];
        addDataPointFromXY(elementId, scatterOrginalDataLength, x, y);
    } else if (!isStartingChart) {
        // find x, y from sampleNo and clickedDataIndex if the chart doesn't originate the click
        const { data } = scatterElement;
        const { sampleNo, clickedDataIndex } = dataPoint.points[0];

        let isReplaced = false;
        for (let idx = 0; idx < data.length; idx++) {
            const trace = data[idx];
            if (trace.name === 'clickedPoint') {
                const dataX = jsonDtTest.data[0].x[clickedDataIndex];
                const dataY = jsonDtTest.data[0].y[clickedDataIndex];
                addDataPointFromXY(elementId, scatterOrginalDataLength, dataX, dataY);
                isReplaced = true;
                break;
            }
        }
        if (!isReplaced) {
            const dataX = jsonDtTest.data[0].x[clickedDataIndex];
            const dataY = jsonDtTest.data[0].y[clickedDataIndex];
            addDataPointFromXY(elementId, scatterOrginalDataLength, dataX, dataY);
        }
    }
};

const updateRecordInfo = (dataInfos = {}, sampleNo = 0) => {
    $('#spID').text(sampleNo);
    const tableInfoEl = '#dp-body';
    const graphElement = $(tableInfoEl);
    showLoading(graphElement);
    let content = `
        <tr>
            <th>${i18n.processName}</th>
            <th>${i18n.shownName}</th>
            <th>${i18n.value}</th>
        </tr >
    `;
    const re = /\d+\_[1,2]$/;
    const reGetDate = /\d+\_[2]$/;
    for (const dataInfo of dataInfos) {
        let [proc, col_name, col_val, col_attr] = dataInfo;
        let bgColorStyle = '';
        if (re.test(col_attr)) {
            bgColorStyle = 'style="color:#56B1F7;"';
        }
        if (reGetDate.test(col_attr)) {
            col_val = moment(col_val).format(DATE_FORMAT_WITHOUT_TZ);
        }
        content += `
            < tr >
                <td ${bgColorStyle}>${proc}</td>
                <td ${bgColorStyle}>${col_name}</td>
                <td ${bgColorStyle}>${col_val}</td>
            </tr > `;
    }
    hideLoading(graphElement);
    $(tableInfoEl).html(content);
};

/*
    Common function to broadcast click event.
    dataPoint: data which is got from the click event
    startingChart: id of chart which originates the click event
*/
const broadcastClickEvent = (dataPoint, startingChart, jsonPCAScoreTest = {}) => {
    // Update time series
    updateTimeSeries(elementId = 'timeSeriesT2', dataPoint, startingChart === 'timeSeriesT2');
    updateTimeSeries(elementId = 'timeSeriesQ', dataPoint, startingChart === 'timeSeriesQ');

    // Update Xtest scatter
    updateScatter(elementId = 'xTest', dataPoint, startingChart === 'xTest', jsonDtTest = jsonPCAScoreTest);

    // Call backend to get jsons for Qcont + T2cont + BiPlot + record info
    const formData = collectInputAsFormData();
    const { sampleNo } = dataPoint.points[0];
    formData.set('sampleNo', sampleNo);
    getPCAPlotsFromBackend(formData, clickOnChart = true, sampleNo);

    // switch to record table
    $('[href="#table-info"]').tab('show');
};

const contributionChartLayout = (objData, type = 't2', sampleNo = null,
    chartConfig = {}, shortName=null) => {
    const getShortNameVar = (varName) => {
        const shortKey = Object.keys(shortName).filter(keyName => keyName.includes(varName)) || null;
        if (shortKey) {
            return shortName[shortKey];
        }
        return '';
};
    const textVar = objData.Ratio.map((v, k) => getShortNameVar(objData.Var[k])).reverse();
    const layout = {
        margin: {
            t: 38.139200221392,
            r: 6.6417600664176,
            b: 36.086896360869,
            l: 76.3802407638024,
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        font: {
            color: 'rgba(0,0,0,1)',
            family: '',
            size: 13.2835201328352,
        },
        title: {
            text: `${type.toUpperCase()} Contribution of Sample No. ${sampleNo || 1}`,
            font: {
                color: 'rgba(204,229,255,1)',
                family: '',
                size: 13.2835201328352,
            },
            x: 0,
            xref: 'paper',
        },
        xaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: false,
            range: [
                -0.0486537209559121,
                1.05 * Math.max(...objData.Ratio.map(x => Math.abs(x))),
            ],
            tickmode: 'array',
            categoryorder: 'array',
            nticks: null,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -30,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'y',
            title: {
                text: type === 't2' ? '|Ratio|' : 'Ratio',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        yaxis: {
            domain: [
                0,
                1,
            ],
            automargin: true,
            type: 'linear',
            autorange: true,
            tickmode: 'array',
            ticktext: textVar,
            tickvals: textVar.map((v, i) => i + 1),
            categoryorder: 'array',
            categoryarray: textVar,
            nticks: null,
            ticks: 'outside',
            tickcolor: 'rgba(51,51,51,1)',
            ticklen: 3.3208800332088,
            tickwidth: 0.301898184837164,
            showticklabels: true,
            tickfont: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
            tickangle: -0,
            showline: false,
            linecolor: null,
            linewidth: 0,
            showgrid: false,
            gridcolor: '#444444',
            gridwidth: 0,
            zeroline: false,
            anchor: 'x',
            title: {
                text: 'Item Name (Variables)',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
            },
            hoverformat: '.2f',
        },
        shapes: [
            {
                type: 'rect',
                fillcolor: null,
                line: {
                    color: null,
                    width: 0,
                    linetype: [],
                },
                yref: 'paper',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: 0,
                y1: 1,
            },
        ],
        showlegend: false,
        legend: {
            bgcolor: '#222222',
            bordercolor: 'transparent',
            borderwidth: 1.71796707229778,
            font: {
                color: 'rgba(255,255,255,1)',
                family: '',
                size: 10.6268161062682,
            },
        },
        hovermode: 'closest',
        barmode: 'relative',
        autosize: true,
    };
    return layout;
};

const genContributionChartData = (objData, type = 't2', dpInfo=null) => {
    const colorScale = {
        t2: [
            [0, '#51A5E1'],
            [0.0526315789473684, '#4B9ACB'],
            [0.105263157894737, '#458EB5'],
            [0.157894736842105, '#3F83A0'],
            [0.210526315789474, '#39788B'],
            [0.263157894736842, '#336D77'],
            [0.315789473684211, '#2C6263'],
            [0.368421052631579, '#245850'],
            [0.421052631578947, '#1C4D3D'],
            [0.473684210526316, '#13432B'],
            [0.526315789473684, '#195337'],
            [0.578947368421053, '#1F6343'],
            [0.631578947368421, '#267450'],
            [0.684210526315789, '#2C865D'],
            [0.736842105263158, '#33986A'],
            [0.789473684210526, '#3AAA78'],
            [0.842105263157895, '#40BD86'],
            [0.894736842105263, '#48D094'],
            [0.947368421052632, '#4FE3A2'],
            [1, '#56F7B1'],
        ],
        q: [
            [0, '#132B43'],
            [0.0526315789473684, '#16314B'],
            [0.105263157894737, '#193754'],
            [0.157894736842105, '#1D3E5C'],
            [0.210526315789474, '#204465'],
            [0.263157894736842, '#234B6E'],
            [0.315789473684211, '#275277'],
            [0.368421052631579, '#2A5980'],
            [0.421052631578947, '#2E608A'],
            [0.473684210526316, '#316793'],
            [0.526315789473684, '#356E9D'],
            [0.578947368421053, '#3875A6'],
            [0.631578947368421, '#3C7CB0'],
            [0.684210526315789, '#3F83BA'],
            [0.736842105263158, '#438BC4'],
            [0.789473684210526, '#4792CE'],
            [0.842105263157895, '#4B9AD8'],
            [0.894736842105263, '#4EA2E2'],
            [0.947368421052632, '#52A9ED'],
            [1, '#56B1F7'],
        ],
    };
    const convertRange = (ranger) => {
        const X = Math.max(...ranger);
        const M = Math.min(...ranger);
        const absX = Math.abs(X);
        const absM = Math.abs(M);
        const t = colorScale[type].length - 1;
        const binVolume = (x) => {
            if (type === 't2') {
                return 2 * x / t;
            }
            if (absX !== absM) {
                return (absX - absM) / t;
            }
            return 2 * absX / t;
        };
        return absM >= absX ? {
            min: M,
            max: -1 * M,
            binVol: binVolume(absM),
        } : {
            min: type === 't2' ? -1 * X : absM,
            max: type === 't2' ? X : absX,
            binVol: binVolume(absX),
        };
    };
    const cr = convertRange(objData.Ratio);
    const markerColor = (i) => {
        const r = cr.binVol !== 0 ? Math.round((i - cr.min) / cr.binVol) : 0;
        return colorScale[type][r][1];
    };

    const rRanger = () => {
        const r = [cr.min, cr.max];
        const s = (cr.max - cr.min) / 4;
        let subRange = [...Array(3).keys()].map(x => cr.min + ((x + 1) * s));
        subRange = subRange.concat(r);
        const tVals = Array.from(new Set(subRange.sort((a, b) => a - b)));
        const ratioConvertor = (ranger) => {
            const minR = Math.min(...ranger);
            const maxR = Math.max(...ranger);
            const sR = (maxR - minR) / 100;
            return ranger.map(i => 0.01 * (i - minR) / sR);
        };
        return {
            ticktext: tVals.map(x => x.toFixed(1)),
            tickvals: ratioConvertor(tVals),
        };
    };
    const getFullNameVar = (varName) => {
        let distributionName = '';
        let procName = '';
        let colName = '';
        if (dpInfo) {
            const rowInfo = dpInfo.filter(row => varName.toLowerCase() === row[1]);
            if (rowInfo.length) {
                [[procName, colName]] = rowInfo;
                distributionName = `${procName}-${colName}<br />`;
            }
        }
        return distributionName;
    };
    const retData = objData.Ratio.map((v, k) => {
        const varFullName = getFullNameVar(objData.Var[k]);
        return {
        orientation: 'h',
        width: 0.9,
        base: 0,
        x: [
            Math.abs(v),
        ],
        y: [
            objData.Ratio.length - k,
        ],
        hovertext: `${varFullName}reorder(Var, abs(Ratio)): ${objData.Var[k]}<br />abs(Ratio): ${
            applySignificantDigit(Math.abs(v))
        }<br />Ratio: ${
            applySignificantDigit(v)
        }`,
        type: 'bar',
        marker: {
            autocolorscale: false,
            color: markerColor(v),
            line: {
                width: 1.88976377952756,
                color: 'transparent',
            },
        },
        showlegend: false,
        xaxis: 'x',
        yaxis: 'y',
        hoverinfo: 'text',
        frame: null,
    };
    });

    const ratioChart = {
        x: [
            1,
        ],
        y: [
            0,
        ],
        name: '99_d31a3926dd854cda0f79a49b4456c467',
        type: 'scatter',
        mode: 'markers',
        opacity: 0,
        hoverinfo: 'skip',
        showlegend: false,
        marker: {
            color: [
                0,
                1,
            ],
            colorscale: colorScale[type],
            colorbar: {
                bgcolor: 'transparent',
                bordercolor: 'transparent',
                borderwidth: 1.71796707229778,
                thickness: 10,
                title: 'Ratio',
                titlefont: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
                tickmode: 'array',
                ticktext: rRanger().ticktext,
                tickvals: rRanger().tickvals,
                tickfont: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 10.6268161062682,
                },
                ticklen: 2,
                len: 0.5,
            },
        },
        xaxis: 'x',
        yaxis: 'y',
        frame: null,
    };
    retData.push(ratioChart);
    return retData;
};
