const generateViolinPlot = (prop, zoomRange, option) => {
    const resamplingColor = 'rgb(52, 169, 234)';
    let xRange = null;
    let yRange = null;
    if (zoomRange) {
        if (!zoomRange['xaxis.autorange']) {
            xRange = zoomRange['xaxis.range[0]'] && zoomRange['xaxis.range[1]'] ? [zoomRange['xaxis.range[0]'], zoomRange['xaxis.range[1]']] : null;
            yRange = zoomRange['yaxis.range[0]'] && zoomRange['yaxis.range[1]'] ? [zoomRange['yaxis.range[0]'], zoomRange['yaxis.range[1]']] : null;
        }
    }

    prop.org_array_x = [...prop.array_x];
    prop.org_array_y = [...prop.array_y];
    // add prefix to change int to str type
    const isXIntType = option.xDataType === DataTypes.INTEGER.name || option.xDataType === DataTypes.STRING.name && Number(prop.array_x[0]) !== NaN;
    const isYIntType = option.yDataType === DataTypes.INTEGER.name || option.yDataType === DataTypes.STRING.name && Number(prop.array_y[0]) !== NaN;
    option.isXIntType = isXIntType;
    option.isYIntType = isYIntType;
    if (isXIntType) {
        const orgArrayX = [...prop.array_x];
        prop.array_x = orgArrayX.map(val => `${STR_PREFIX}${val}`);
        prop.org_array_x = orgArrayX;
    }

    if (isYIntType) {
        const orgArrayY = [...prop.array_y];
        prop.array_y = orgArrayY.map(val => `${STR_PREFIX}${val}`);
        prop.org_array_y = orgArrayY;
    }

    const dataCommon = {
        type: 'violin',
        box: {
            visible: true,
            fillcolor: !prop.isHideHover ? '#222222' : 'transparent',
            line: {
                color: !prop.isHideHover ? '#ffffff' : 'transparent',
            },
        },
        line: {
            color: prop.is_resampling ? resamplingColor : 'transparent',
            width: 1,
        },
        meanline: {
            visible: true,
            width: 1,
        },
        marker: {
            line: {
                color: !prop.isHideHover ? '#ffffff' : 'transparent',
            },
        },
        points: false,
        opacity: 1,
        // fillcolor: 'transparent',
        // hoverinfo: prop.isHideHover ? 'skip' : 'none',
        hoverinfo: 'none',
        showlegend: false,
        spanmode: 'manual',
    };
    
    let kdeLineWidth = 0.5;
    // let boxFillColor = '';
    if (prop.is_resampling) {
        dataCommon.box.fillcolor = resamplingColor;
        dataCommon.box.line.width = 1;
        dataCommon.meanline.color = 'white';
        kdeLineWidth = 2;
    }
    let data = [];
    if (prop.isHorizontal) {
        data = prop.uniqueColors.map((key) => {
            const index = prop.org_array_y.indexOf(key);
            let orgLineColor = prop.isHideHover ? 'transparent'
                : prop.styles.filter(style => style.target === key)[0].value.line.color;
            const lineColor = prop.is_resampling ? resamplingColor : orgLineColor;
            key = isYIntType ? `${STR_PREFIX}${key}` : key;
            return {
                ...dataCommon,
                x: prop.array_x[index],
                y0: key,
                name: key,
                line: {
                    color: lineColor,
                    width: kdeLineWidth,
                },
                fillcolor: orgLineColor,
            };
        });
    } else {
        data = prop.uniqueColors.map((key) => {
            const index = prop.org_array_x.indexOf(key);
            let orgLineColor = prop.isHideHover ? 'transparent'
                : prop.styles.filter(style => style.target === key)[0].value.line.color;
            const lineColor = prop.is_resampling ? resamplingColor : orgLineColor;
             key = isXIntType ? `${STR_PREFIX}${key}` : key;
            return {
                ...dataCommon,
                x0: key,
                y: prop.array_y[index],
                name: key,
                line: {
                    color: lineColor,
                    width: kdeLineWidth,
                },
                fillcolor: orgLineColor,
            };
        });
    }

    const xChartRange = xRange || [-0.5, prop.uniqueColors.length - 0.5];
    const yChartRange = yRange || [-0.5, prop.uniqueColors.length - 0.5];

    // eslint-disable-next-line no-undef
    const lines = !prop.isHideHover ? genThresholds(prop.x_threshold, prop.y_threshold, { xaxis: 'x', yaxis: 'y' }, xChartRange, yChartRange)
        : [];

    const layout = {
        title: '',
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        autosize: true,
        margin: {
            r: 0, l: prop.isShowY ? 33 : 0, t: 0, b: prop.isShowX ? 25 : 0,
        },
        yaxis: {
            ticklen: 0,
            showline: true,
            tickmode: 'array',
            showgrid: true, // showticklabels: true || prop.isShowY,
            tickfont: {
                size: option.yFmt.includes('e') ? 7 : 8,
                color: 'white',
            },
            range: yRange || prop.rangeScaleY,
            ticks: {
                align: 'top',
            },
            tickformat: option.yFmt.includes('e') ? '.1e' : '',
        },
        xaxis: {
            showline: true,
            showgrid: true,
            zeroline: true,
            ticklen: 0,
            tickfont: {
                size: 8, color: 'white',
            },
            tickformat: option.xFmt.includes('e') ? '.1e' : '',
            range: xRange || prop.rangeScaleX,
        },
        shapes: lines,
    };

    if (prop.isHorizontal) {
        layout.yaxis.ticktext = prop.org_array_y
        layout.yaxis.tickvals = prop.array_y
    } else {
        layout.xaxis.ticktext = prop.org_array_x
        layout.xaxis.tickvals = prop.array_x
    }

    const config = {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' },
    };

    // set default range axes
    $(`#${prop.canvasId}`).attr('data-default-axes', JSON.stringify(prop.scale));
    $(`#${prop.canvasId}`).attr('data-is-horizontal', prop.isHorizontal);

    Plotly.react(prop.canvasId, data, layout, config);
};

const makeHoverInfoBox = (prop, key, option, x, y) => {
    if (option.isXIntType || option.isYIntType) {
         key = key.replace(STR_PREFIX, '')
    }
    if (!prop || !prop.summaries[key]) return;
    const sumaries = prop.summaries[key][0];
    const numberOfData = option.isShowNumberOfData ? prop.h_label : null;
    const facet = option.isShowFacet
        ? `Lv1 = ${
            prop.v_label.toString().split('|')[0]
        } ${
            option.hasLv2
                ? `, Lv2 = ${
                    prop.v_label.toString().split('|')[1] || prop.h_label}`
                : ''
        }`
        : null;
    const div = option.isShowDiv ? prop.h_label : '';
    showSCPDataTable(
        {
            data_no: numberOfData,
            facet,
            category: div,
            proc_no: {
                name: `${prop.isHorizontal ? option.yName : option.xName}`,
                value: key,
            },
            upper: sumaries.non_parametric.whisker_upper,
            q3: sumaries.non_parametric.p75,
            med: sumaries.non_parametric.median,
            q1: sumaries.non_parametric.p25,
            lower: sumaries.non_parametric.whisker_lower,
            iqr: sumaries.non_parametric.iqr,
            niqr: sumaries.non_parametric.niqr,
            mode: sumaries.non_parametric.mode,
            avg: sumaries.basic_statistics.average,
            n: sumaries.count.ntotal,
            from: formatDateTime(prop.time_min),
            to: formatDateTime(prop.time_max),
            n_total: prop.n_total,
        }, {
            x: x - 55,
            y: y,
        },
        option.canvas_id,
        'violin',
    );
};
