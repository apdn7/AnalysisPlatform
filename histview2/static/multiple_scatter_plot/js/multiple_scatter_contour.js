const getColName = (procId, colId) => {
    const column = procConfigs[procId].getColumnById(colId) || {};
    return column.name || colId;
};

const genScatterOutlierTrace = (sctData, isShowContour = false, procName = null) => {
    let colNameX = getColName(sctData.proc_id_x, sctData.col_id_x);
    // colNameX = shortenName(colNameX);
    let colNameY = getColName(sctData.proc_id_y, sctData.col_id_y);
    // colNameY = shortenName(colNameY);
    if (procName && sctData.proc_id_x !== sctData.proc_id_y) {
        colNameX = `${colNameX}@${procName[sctData.proc_id_x]}`;
        colNameY = `${colNameY}@${procName[sctData.proc_id_y]}`;
    }
    const scatterData = sctData.scatter_data;
    const textHover = () => {
        const text = scatterData.x.map((item, i) => {
            const xValue = applySignificantDigit(item);
            const yValue = applySignificantDigit(scatterData.y[i]);
            return `${colNameX}: ${xValue}<br>${colNameY}: ${yValue}<extra></extra>`;
        });
        return text;
    };
    const scatterTrace = {
        mode: 'markers',
        type: 'scatter',
        x: scatterData.x,
        y: scatterData.y,
        marker: {
            color: isShowContour ? '#cccccc' : CONST.COLOR_NORMAL,
            size: 3.5,
        },
        // hovertemplate: `${colNameX}: %{customdata[0][0]}<br>${colNameY}: %{customdata[0][1]}<extra></extra>`,
        hoverlabel: {
            bgcolor: '#444',
        },
        hovertemplate: '%{text}',
        text: textHover(),
    };
    return scatterTrace;
};

const genContourTrace = (sctData) => {
    let colNameX = getColName(sctData.proc_id_x, sctData.col_id_x);
    colNameX = shortenName(colNameX);
    let colNameY = getColName(sctData.proc_id_y, sctData.col_id_y);
    colNameY = shortenName(colNameY);

    const contourData = sctData.contour_data;
    const contourTrace = {
        contours: {
            coloring: 'heatmap',
        },
        line: {
            width: 0.5,
        },
        type: 'contour',
        x: contourData.x,
        y: contourData.y,
        z: contourData.z,
        hovertemplate: `${colNameX}: %{x}<br>${colNameY}: %{y}<br>Density: %{z}<extra></extra>`,
        ncontours: 25,
        showscale: false,
        colorbar: {
            outlinewidth: 0,
            ticks: '',
        },
        colorscale: [[0.0, 'rgba(42,50,30,0.05)'], [0.1111111111111111, 'rgba(58,72,40,0.4)'], [0.2222222222222222, 'rgba(58, 72, 40, 0.6)'],
            [0.3333333333333333, 'rgba(63, 79, 44, 0.7)'], [0.4444444444444444, 'rgba(74, 93, 53, 0.8)'], [0.5555555555555556, 'rgba(80, 103, 59, 0.9)'],
            [0.6666666666666666, '#5a7343'], [0.7777777777777778, '#64814b'], [0.8888888888888888, '#85ab64'], [1.0, '#9ed66e']],
    };
    return contourTrace;
};


const getScatterContourData = (cId, scatterContourData) => {
    const rowIdx = cId[1];
    const colIdx = cId[2];
    return scatterContourData[`${rowIdx}-${colIdx}`];
};

const genScatterContourLayout = () => {
    const layout = {
        annotationdefaults: {
            arrowcolor: '#2a3f5f',
            arrowhead: 0,
            arrowwidth: 1,
        },
        autotypenumbers: 'strict',
        coloraxis: {
            colorbar: {
                outlinewidth: 0,
                ticks: '',
            },
        },
        colorscale: { // TODO no need
            diverging: [[0, '#8e0152'], [0.1, '#c51b7d'], [0.2, '#de77ae'], [0.3, '#f1b6da'], [0.4, '#fde0ef'], [0.5, '#f7f7f7'],
                [0.6, '#e6f5d0'], [0.7, '#b8e186'], [0.8, '#7fbc41'], [0.9, '#4d9221'], [1, '#276419']],
            sequential: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'], [0.3333333333333333, '#9c179e'],
                [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'], [0.6666666666666666, '#ed7953'],
                [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
            sequentialminus: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'],
                [0.3333333333333333, '#9c179e'], [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'],
                [0.6666666666666666, '#ed7953'], [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
        },
        colorway: ['#636efa', '#EF553B', '#00cc96', '#ab63fa', '#FFA15A', '#19d3f3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'],
        font: {
            size: 11,
            color: 'white',
        },
        geo: {
            bgcolor: 'white',
            lakecolor: 'white',
            landcolor: '#E5ECF6',
            showlakes: true,
            showland: true,
            subunitcolor: 'white',
        },
        hoverlabel: {
            align: 'left',
        },
        hovermode: 'closest',
        mapbox: {
            style: 'light',
        },
        paper_bgcolor: '#222222',
        plot_bgcolor: '#222222',
        polar: {
            angularaxis: {
                gridcolor: 'white',
                linecolor: 'white',
                ticks: '',
            },
            bgcolor: '#E5ECF6',
            radialaxis: {
                gridcolor: 'white',
                linecolor: 'white',
                ticks: '',
            },
        },
        scene: {
            xaxis: {
                backgroundcolor: '#E5ECF6',
                gridcolor: 'white',
                // "gridwidth": 2,
                linecolor: 'white',
                showbackground: true,
                ticks: '',
                zerolinecolor: 'white',
            },
            yaxis: {
                backgroundcolor: '#E5ECF6',
                gridcolor: 'white',
                // "gridwidth": 2,
                linecolor: 'white',
                showbackground: true,
                ticks: '',
                zerolinecolor: 'white',
            },
            zaxis: {
                backgroundcolor: '#E5ECF6',
                gridcolor: 'white',
                // "gridwidth": 2,
                linecolor: 'white',
                showbackground: true,
                ticks: '',
                zerolinecolor: 'white',
            },
        },
        shapedefaults: {
            line: {
                color: '#2a3f5f',
            },
        },
        ternary: {
            aaxis: {
                gridcolor: 'white',
                linecolor: 'white',
                ticks: '',
            },
            baxis: {
                gridcolor: 'white',
                linecolor: 'white',
                ticks: '',
            },
            bgcolor: '#E5ECF6',
            caxis: {
                gridcolor: 'white',
                linecolor: 'white',
                ticks: '',
            },
        },
        title: {
            x: 0.05,
        },
        xaxis: {
            automargin: true,
            gridcolor: '#303030',
            linecolor: '#303030',
            autotick: true,
            // nticks: 9,
            title: {
                standoff: 15,
            },
            zerolinecolor: '#303030',
            zerolinewidth: 2,
            tickfont: {
                size: 11,
            },
        },
        yaxis: {
            automargin: true,
            gridcolor: '#303030',
            linecolor: '#303030',
            title: {
                standoff: 15,
            },
            zerolinecolor: '#303030',
            zerolinewidth: 2,
            autotick: true,
            // nticks: 9,
            tickfont: {
                size: 11,
            },
        },
        margin: {
            l: 40,
            r: 15,
            b: 15,
            t: 20,
            // pad: 5,
        },
    };
    return layout;
};


const addScatterThresholds = (layout, uclThresholds, procThresholds, rowRange, colRange) => {
    layout.shapes = [];
    // procThresholds.xMin
    if (!isEmpty(procThresholds.xMin)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: procThresholds.xMin,
            y0: colRange.colMin,
            x1: procThresholds.xMin,
            y1: colRange.colMax,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }

    // procThresholds.xMax
    if (!isEmpty(procThresholds.xMax)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: procThresholds.xMax,
            y0: colRange.colMin,
            x1: procThresholds.xMax,
            y1: colRange.colMax,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }

    // procThresholds.yMin
    if (!isEmpty(procThresholds.yMin)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            y0: procThresholds.yMin,
            x0: rowRange.rowMin,
            y1: procThresholds.yMin,
            x1: rowRange.rowMax,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }

    // procThresholds.yMax
    if (!isEmpty(procThresholds.yMax)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            y0: procThresholds.yMax,
            x0: rowRange.rowMin,
            y1: procThresholds.yMax,
            x1: rowRange.rowMax,
            line: {
                color: CONST.BLUE,
                width: 0.75,
            },
        });
    }

    // draw line annotation
    if (!isEmpty(uclThresholds.xMin)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: uclThresholds.xMin,
            y0: colRange.colMin,
            x1: uclThresholds.xMin,
            y1: colRange.colMax,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }

    if (!isEmpty(uclThresholds.xMax)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: uclThresholds.xMax,
            y0: colRange.colMin,
            x1: uclThresholds.xMax,
            y1: colRange.colMax,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }

    if (!isEmpty(uclThresholds.yMin)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: rowRange.rowMin,
            y0: uclThresholds.yMin,
            x1: rowRange.rowMax,
            y1: uclThresholds.yMin,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }

    if (!isEmpty(uclThresholds.yMax)) {
        layout.shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'y',
            x0: rowRange.rowMin,
            y0: uclThresholds.yMax,
            x1: rowRange.rowMax,
            y1: uclThresholds.yMax,
            line: {
                color: CONST.RED,
                width: 0.75,
            },
        });
    }

    return layout;
};

const addAxisRange = (layout, rowRange, colRange) => {
    layout.yaxis.range = [colRange.colMin, colRange.colMax];
    layout.xaxis.range = [rowRange.rowMin, rowRange.rowMax];
    return layout;
};
