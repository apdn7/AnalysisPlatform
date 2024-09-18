const generateCircles = (json) => {
    if (!json) return {};

    // sigma
    const dataSigmaX = getNode(json, ['circles', 'Sigma', 'x']) || [];
    const dataSigmaY = getNode(json, ['circles', 'Sigma', 'y']) || [];
    const dataSigmaText =
        dataSigmaX.map(
            (ele, idx) =>
                `border: Sigma<br />xvar: ${ele}<br />yvar: ${dataSigmaY[idx]}`,
        ) || [];

    // 2sigma
    const data2SigmaX = getNode(json, ['circles', '2Sigma', 'x']) || [];
    const data2SigmaY = getNode(json, ['circles', '2Sigma', 'y']) || [];
    const data2SigmaText =
        data2SigmaX.map(
            (ele, idx) =>
                `border: 2Sigma<br />xvar: ${ele}<br />yvar: ${data2SigmaY[idx]}`,
        ) || [];

    // 3sigma
    const data3SigmaX = getNode(json, ['circles', '3Sigma', 'x']) || [];
    const data3SigmaY = getNode(json, ['circles', '3Sigma', 'y']) || [];
    const data3SigmaText =
        data3SigmaX.map(
            (ele, idx) =>
                `border: 3Sigma<br />xvar: ${ele}<br />yvar: ${data3SigmaY[idx]}`,
        ) || [];

    // Range
    const dataRangeX = getNode(json, ['circles', 'Range', 'x']) || [];
    const dataRangeY = getNode(json, ['circles', 'Range', 'y']) || [];
    const dataRangeText =
        dataRangeX.map(
            (ele, idx) =>
                `border: Range<br />xvar: ${ele}<br />yvar: ${dataRangeY[idx]}`,
        ) || [];

    // Parcentile 0.85
    const dataParcentileX =
        getNode(json, ['circles', 'Percentile85', 'x']) || [];
    const dataParcentileY =
        getNode(json, ['circles', 'Percentile85', 'y']) || [];
    const dataParcentileText =
        dataParcentileX.map(
            (ele, idx) =>
                `border: Percentile 0.85<br />xvar: ${ele}<br />yvar: ${dataParcentileY[idx]}`,
        ) || [];

    // axis label
    const axislab = getNode(json, ['axislab']) || ['PC1', 'PC2'];

    return {
        dataSigmaX,
        dataSigmaY,
        dataSigmaText,
        data2SigmaX,
        data2SigmaY,
        data2SigmaText,
        data3SigmaX,
        data3SigmaY,
        data3SigmaText,
        dataRangeX,
        dataRangeY,
        dataRangeText,
        dataParcentileX,
        dataParcentileY,
        dataParcentileText,
        axislab,
    };
};

const generateXTrainScatter = (json) => {
    if (!json) return {};

    // scatter
    const dataScatterX = getNode(json, ['scatter', 'x']) || [];
    const dataScatterY = getNode(json, ['scatter', 'y']) || [];
    const dataScatterText =
        dataScatterX.map(
            (ele, idx) => `'xvar: ${ele}<br />yvar: ${dataScatterY[idx]}'`,
        ) || [];

    const {
        dataSigmaX,
        dataSigmaY,
        dataSigmaText,
        data2SigmaX,
        data2SigmaY,
        data2SigmaText,
        data3SigmaX,
        data3SigmaY,
        data3SigmaText,
        dataRangeX,
        dataRangeY,
        dataRangeText,
        dataParcentileX,
        dataParcentileY,
        dataParcentileText,
        axislab,
    } = generateCircles(json);

    return {
        data: [
            {
                x: dataScatterX,
                y: dataScatterY,
                text: dataScatterText,
                type: 'scatter',
                mode: 'markers',
                marker: {
                    autocolorscale: false,
                    color: 'white',
                    opacity: 0.5,
                    size: 3.02362204724409,
                    symbol: 'circle',
                    line: {
                        width: 1.88976377952756,
                        color: 'rgba(255,255,255,1)',
                    },
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataSigmaX,
                y: dataSigmaY,
                text: dataSigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(204,229,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Sigma',
                legendgroup: 'Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data2SigmaX,
                y: data2SigmaY,
                text: data2SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(153,204,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '2Sigma',
                legendgroup: '2Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data3SigmaX,
                y: data3SigmaY,
                text: data3SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(102,178,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '3Sigma',
                legendgroup: '3Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataRangeX,
                y: dataRangeY,
                text: dataRangeText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(30,144,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Range',
                legendgroup: 'Range',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataParcentileX,
                y: dataParcentileY,
                text: dataParcentileText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(255,52,179,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Parcentile 0.85',
                legendgroup: 'Parcentile 0.85',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [0, 0],
                y: [-3.51416158802218, 3.51416158802218],
                text: 'xintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [-3.5156396748279, 3.50907246263227],
                y: [0, 0],
                text: 'yintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
        ],
        layout: {
            margin: {
                t: 24.8556800885568,
                r: 6.6417600664176,
                b: 36.086896360869,
                l: 33.8729763387298,
            },
            plot_bgcolor: '#222222',
            paper_bgcolor: '#222222',
            font: {
                color: 'rgba(0,0,0,1)',
                family: '',
                size: 13.2835201328352,
            },
            xaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                range: [-3.5156396748279, 3.50907246263227],
                tickmode: 'array',
                ticktext: ['-2', '0', '2'],
                tickvals: [-2, 4.44089209850063e-16, 2],
                categoryorder: 'array',
                categoryarray: ['-2', '0', '2'],
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
                tickangle: 0,
                showline: false,
                linecolor: null,
                linewidth: 0,
                showgrid: false,
                gridcolor: '#444444',
                gridwidth: 0,
                zeroline: false,
                anchor: 'y',
                title: {
                    text: axislab[0],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 14,
                    },
                },
                scaleanchor: 'y',
                scaleratio: 1,
                hoverformat: '.2f',
            },
            yaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                range: [-3.51416158802218, 3.51416158802218],
                tickmode: 'array',
                ticktext: ['-2', '0', '2'],
                tickvals: [-2, 0, 2],
                categoryorder: 'array',
                categoryarray: ['-2', '0', '2'],
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
                tickangle: 0,
                showline: false,
                linecolor: null,
                linewidth: 0,
                showgrid: false,
                gridcolor: '#444444',
                gridwidth: 0,
                zeroline: false,
                anchor: 'x',
                title: {
                    text: axislab[1],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 14,
                    },
                },
                scaleratio: 1,
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
            showlegend: true,
            legend: {
                bgcolor: 'transparent',
                bordercolor: 'transparent',
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 11,
                },
                xanchor: 'right',
                tracegroupgap: 3,
            },
            annotations: [
                {
                    text: 'Guide',
                    x: 1.02,
                    y: 1,
                    showarrow: false,
                    ax: 0,
                    ay: 0,
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                    xref: 'paper',
                    yref: 'paper',
                    textangle: 0,
                    xanchor: 'left',
                    yanchor: 'bottom',
                    legendTitle: true,
                },
            ],
            hovermode: 'closest',
            barmode: 'relative',
            autosize: true,
        },
        config: {
            doubleClick: 'reset',
            showSendToCloud: false,
        },
        source: 'A',
        attrs: {
            '2f6447552f24': {
                x: {},
                y: {},
                type: 'scatter',
            },
            '2f646ad6734': {
                x: {},
                y: {},
                colour: {},
                'x.1': {},
                'y.1': {},
            },
            '2f64404a41b1': {
                xintercept: {},
            },
            '2f64610e1c0': {
                yintercept: {},
            },
        },
        cur_data: '2f6447552f24',
        visdat: {
            '2f6447552f24': ['function (y) ', 'x'],
            '2f646ad6734': ['function (y) ', 'x'],
            '2f64404a41b1': ['function (y) ', 'x'],
            '2f64610e1c0': ['function (y) ', 'x'],
        },
        highlight: {
            on: 'plotly_click',
            persistent: false,
            dynamic: false,
            selectize: false,
            opacityDim: 0.2,
            selected: {
                opacity: 1,
            },
            debounce: 0,
        },
        shinyEvents: [
            'plotly_hover',
            'plotly_click',
            'plotly_selected',
            'plotly_relayout',
            'plotly_brushed',
            'plotly_brushing',
            'plotly_clickannotation',
            'plotly_doubleclick',
            'plotly_deselect',
            'plotly_afterplot',
            'plotly_sunburstclick',
        ],
        base_url: 'https://plot.ly',
    };
};

const generateXTestScatter = (json, jsonTrain) => {
    if (!json) return {};

    // scatter
    const dataScatterX = getNode(json, ['scatter', 'x']) || [];
    const dataScatterY = getNode(json, ['scatter', 'y']) || [];
    const dataScatterText =
        dataScatterX.map(
            (ele, idx) => `'xvar: ${ele}<br />yvar: ${dataScatterY[idx]}'`,
        ) || [];

    const {
        dataSigmaX,
        dataSigmaY,
        dataSigmaText,
        data2SigmaX,
        data2SigmaY,
        data2SigmaText,
        data3SigmaX,
        data3SigmaY,
        data3SigmaText,
        dataRangeX,
        dataRangeY,
        dataRangeText,
        dataParcentileX,
        dataParcentileY,
        dataParcentileText,
        axislab,
    } = generateCircles(jsonTrain);

    return {
        data: [
            {
                x: dataScatterX,
                y: dataScatterY,
                text: dataScatterText,
                type: 'scatter',
                mode: 'markers',
                marker: {
                    autocolorscale: false,
                    color: 'rgba(255,165,0,1)',
                    opacity: 0.5,
                    size: 3.02362204724409,
                    symbol: 'square',
                    line: {
                        width: 1.88976377952756,
                        color: 'rgba(255,165,0,1)',
                    },
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataSigmaX,
                y: dataSigmaY,
                text: dataSigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(204,229,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Sigma',
                legendgroup: 'Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data2SigmaX,
                y: data2SigmaY,
                text: data2SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(153,204,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '2Sigma',
                legendgroup: '2Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data3SigmaX,
                y: data3SigmaY,
                text: data3SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(102,178,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '3Sigma',
                legendgroup: '3Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataRangeX,
                y: dataRangeY,
                text: dataRangeText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(30,144,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Range',
                legendgroup: 'Range',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataParcentileX,
                y: dataParcentileY,
                text: dataParcentileText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(255,52,179,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Parcentile 0.85',
                legendgroup: 'Parcentile 0.85',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [0, 0],
                y: [-3.94029493306541, 3.94029493306541],
                text: 'xintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [-3.94195225524749, 3.9345886914811],
                y: [0, 0],
                text: 'yintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
        ],
        layout: {
            margin: {
                t: 24.8556800885568,
                r: 6.6417600664176,
                b: 36.086896360869,
                l: 33.8729763387298,
            },
            plot_bgcolor: 'rgba(0,0,0,1)',
            paper_bgcolor: 'rgba(26,26,26,1)',
            font: {
                color: 'rgba(0,0,0,1)',
                family: '',
                size: 13.2835201328352,
            },
            xaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                tickmode: 'array',
                ticktext: ['-2', '0', '2'],
                tickvals: [-2, 0, 2],
                categoryorder: 'array',
                categoryarray: ['-2', '0', '2'],
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
                gridcolor: null,
                gridwidth: 0,
                zeroline: false,
                anchor: 'y',
                title: {
                    text: axislab[0],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                },
                scaleanchor: 'y',
                scaleratio: 1,
                hoverformat: '.2f',
            },
            yaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                tickmode: 'array',
                ticktext: ['-2', '0', '2'],
                tickvals: [-2, 0, 2],
                categoryorder: 'array',
                categoryarray: ['-2', '0', '2'],
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
                gridcolor: null,
                gridwidth: 0,
                zeroline: false,
                anchor: 'x',
                title: {
                    text: axislab[1],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                },
                scaleanchor: 'x',
                scaleratio: 1,
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
                bgcolor: 'rgba(26,26,26,1)',
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
        },
        config: {
            doubleClick: 'reset',
            showSendToCloud: false,
        },
        source: 'A',
        attrs: {
            '274714c1e60': {
                x: {},
                y: {},
                type: 'scatter',
            },
            '2746e4841e1': {
                x: {},
                y: {},
                colour: {},
                'x.1': {},
                'y.1': {},
            },
            27471696011: {
                xintercept: {},
            },
            27436716639: {
                yintercept: {},
            },
        },
        cur_data: '274714c1e60',
        visdat: {
            '274714c1e60': ['function (y) ', 'x'],
            '2746e4841e1': ['function (y) ', 'x'],
            27471696011: ['function (y) ', 'x'],
            27436716639: ['function (y) ', 'x'],
        },
        highlight: {
            on: 'plotly_click',
            persistent: false,
            dynamic: false,
            selectize: false,
            opacityDim: 0.2,
            selected: {
                opacity: 1,
            },
            debounce: 0,
        },
        shinyEvents: [
            'plotly_hover',
            'plotly_click',
            'plotly_selected',
            'plotly_relayout',
            'plotly_brushed',
            'plotly_brushing',
            'plotly_clickannotation',
            'plotly_doubleclick',
            'plotly_deselect',
            'plotly_afterplot',
            'plotly_sunburstclick',
        ],
        base_url: 'https://plot.ly',
    };
};

const generateBiplot = (json, jsonTrain, sampleNo = null) => {
    if (!json) return {};

    // scatter
    const dataX = getNode(json, ['x']) || [];
    const dataY = getNode(json, ['y']) || [];

    // vector labels
    const angle = getNode(json, ['angle']) || [];
    const hjust = getNode(json, ['hjust']) || [];
    const varname = getNode(json, ['varname']) || [];
    const sensorHoverText =
        dataX.map(
            (ele, i) =>
                `xvar: ${ele}<br />yvar:  ${dataY[i]}<br />varname: ${varname[i]}<br />angle: ${angle[i]}<br />hjust:  ${hjust[i]}`,
        ) || [];

    const vectorX = [];
    dataX.forEach((x, i) => {
        if (i > 0) vectorX.push(null);
        vectorX.push(0);
        vectorX.push(x);
    });

    const vectorText = [];
    const vectorY = [];
    dataY.forEach((x, i) => {
        if (i > 0) {
            vectorY.push(null);
            vectorText.push(null);
        }
        vectorY.push(0);
        vectorY.push(x);
        vectorText.push(
            `x: 0<br />y: 0<br />xvar: ${dataX[i]}<br />yvar:  ${dataY[i]}`,
        );
        vectorText.push(
            `x: 0<br />y: 0<br />xvar: ${dataX[i]}<br />yvar:  ${dataY[i]}`,
        );
    });

    // clickedPoint
    const clickedPoint = getNode(json, ['clicked_point']) || {
        x: [null],
        y: [null],
    };

    const {
        dataSigmaX,
        dataSigmaY,
        dataSigmaText,
        data2SigmaX,
        data2SigmaY,
        data2SigmaText,
        data3SigmaX,
        data3SigmaY,
        data3SigmaText,
        dataRangeX,
        dataRangeY,
        dataRangeText,
        dataParcentileX,
        dataParcentileY,
        dataParcentileText,
        axislab,
    } = generateCircles(jsonTrain);

    return {
        data: [
            {
                x: dataSigmaX,
                y: dataSigmaY,
                text: dataSigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(204,229,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Sigma',
                legendgroup: 'Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data2SigmaX,
                y: data2SigmaY,
                text: data2SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(153,204,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '2Sigma',
                legendgroup: '2Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: data3SigmaX,
                y: data3SigmaY,
                text: data3SigmaText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(102,178,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: '3Sigma',
                legendgroup: '3Sigma',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataRangeX,
                y: dataRangeY,
                text: dataRangeText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(30,144,255,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Range',
                legendgroup: 'Range',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataParcentileX,
                y: dataParcentileY,
                text: dataParcentileText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.13385826771654,
                    color: 'rgba(255,52,179,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                name: 'Parcentile 0.85',
                legendgroup: 'Parcentile 0.85',
                showlegend: true,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: vectorX,
                y: vectorY,
                text: vectorText,
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(255,192,203,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: dataX.map((x) => x * 2),
                y: dataY.map((y) => y * 2),
                text: varname,
                hovertext: sensorHoverText,
                textfont: {
                    size: 11.3385826771654,
                    color: 'rgba(255,255,255,1)',
                },
                type: 'scatter',
                mode: 'text',
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: clickedPoint.x,
                y: clickedPoint.y,
                text: `xvar: ${clickedPoint.x[0]}<br />yvar: ${clickedPoint.y[0]}`,
                type: 'scatter',
                mode: 'markers',
                marker: {
                    autocolorscale: false,
                    color: 'rgba(255,165,0,1)',
                    opacity: 0.5,
                    size: 11.3385826771654,
                    symbol: 'square',
                    line: {
                        width: 1.88976377952756,
                        color: 'rgba(255,165,0,1)',
                    },
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [0, 0],
                y: [-4.07856844526106, 6.84403868917397],
                text: 'xintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
            {
                x: [-5.82714314845274, 5.83842812409785],
                y: [0, 0],
                text: 'yintercept: 0',
                type: 'scatter',
                mode: 'lines',
                line: {
                    width: 1.88976377952756,
                    color: 'rgba(64,64,64,1)',
                    dash: 'solid',
                },
                hoveron: 'points',
                showlegend: false,
                xaxis: 'x',
                yaxis: 'y',
                hoverinfo: 'text',
                frame: null,
            },
        ],
        layout: {
            margin: {
                t: 38.139200221392,
                r: 6.6417600664176,
                b: 36.086896360869,
                l: 33.8729763387298,
            },
            plot_bgcolor: 'rgba(0,0,0,1)',
            paper_bgcolor: 'rgba(26,26,26,1)',
            font: {
                color: 'rgba(0,0,0,1)',
                family: '',
                size: 13.2835201328352,
            },
            title: {
                text: `Biplot with Index = ${sampleNo || 1}`,
                font: {
                    color: 'rgba(204,229,255,1)',
                    family: '',
                    size: 13.2835201328352,
                },
                x: 0,
                xref: 'paper',
            },
            xaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                tickmode: 'array',
                ticktext: ['-3', '0', '3'],
                tickvals: [-3, 0, 3],
                categoryorder: 'array',
                categoryarray: ['-3', '0', '3'],
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
                gridcolor: null,
                gridwidth: 0,
                zeroline: false,
                anchor: 'y',
                title: {
                    text: axislab[0],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                },
                scaleanchor: 'y',
                scaleratio: 1,
                hoverformat: '.2f',
            },
            yaxis: {
                domain: [0, 1],
                automargin: true,
                type: 'linear',
                autorange: true,
                tickmode: 'array',
                ticktext: ['-4', '-2', '0', '2', '4', '6'],
                tickvals: [-4, -2, 0, 2, 4, 6],
                categoryorder: 'array',
                categoryarray: ['-4', '-2', '0', '2', '4', '6'],
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
                gridcolor: null,
                gridwidth: 0,
                zeroline: false,
                anchor: 'x',
                title: {
                    text: axislab[1],
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                },
                scaleanchor: 'x',
                scaleratio: 1,
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
            showlegend: true,
            legend: {
                bgcolor: 'rgba(26,26,26,1)',
                bordercolor: 'transparent',
                borderwidth: 1.71796707229778,
                font: {
                    color: 'rgba(255,255,255,1)',
                    family: '',
                    size: 10.6268161062682,
                },
                y: 0.940944881889764,
            },
            annotations: [
                {
                    text: 'Guide',
                    x: 1.02,
                    y: 1,
                    showarrow: false,
                    ax: 0,
                    ay: 0,
                    font: {
                        color: 'rgba(255,255,255,1)',
                        family: '',
                        size: 13.2835201328352,
                    },
                    xref: 'paper',
                    yref: 'paper',
                    textangle: -0,
                    xanchor: 'left',
                    yanchor: 'bottom',
                    legendTitle: true,
                },
            ],
            hovermode: 'closest',
            barmode: 'relative',
            autosize: true,
        },
        config: {
            doubleClick: 'reset',
            showSendToCloud: false,
        },
        source: 'A',
        attrs: {
            '27439d70d': {
                x: {},
                y: {},
                colour: {},
                type: 'scatter',
            },
            '2742d6549e2': {
                x: {},
                y: {},
                xend: {},
                yend: {},
            },
            '27465c06157': {
                x: {},
                y: {},
                label: {},
                angle: {},
                hjust: {},
            },
            '2743c634b8': {
                x: {},
                y: {},
            },
            '2745b764c1c': {
                xintercept: {},
            },
            '27461e19c8': {
                yintercept: {},
            },
        },
        cur_data: '27439d70d',
        visdat: {
            '27439d70d': ['function (y) ', 'x'],
            '2742d6549e2': ['function (y) ', 'x'],
            '27465c06157': ['function (y) ', 'x'],
            '2743c634b8': ['function (y) ', 'x'],
            '2745b764c1c': ['function (y) ', 'x'],
            '27461e19c8': ['function (y) ', 'x'],
        },
        highlight: {
            on: 'plotly_click',
            persistent: false,
            dynamic: false,
            selectize: false,
            opacityDim: 0.2,
            selected: {
                opacity: 1,
            },
            debounce: 0,
        },
        shinyEvents: [
            'plotly_hover',
            'plotly_click',
            'plotly_selected',
            'plotly_relayout',
            'plotly_brushed',
            'plotly_brushing',
            'plotly_clickannotation',
            'plotly_doubleclick',
            'plotly_deselect',
            'plotly_afterplot',
            'plotly_sunburstclick',
        ],
        base_url: 'https://plot.ly',
    };
};
