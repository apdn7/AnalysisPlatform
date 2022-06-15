const generateViolinPlot = (prop, zoomRange) => {
    let xRange = null;
    let yRange = null;
    if (zoomRange) {
        if (!zoomRange['xaxis.autorange']) {
            xRange = zoomRange['xaxis.range[0]'] && zoomRange['xaxis.range[1]'] ? [zoomRange['xaxis.range[0]'], zoomRange['xaxis.range[1]']] : null;
            yRange = zoomRange['yaxis.range[0]'] && zoomRange['yaxis.range[1]'] ? [zoomRange['yaxis.range[0]'], zoomRange['yaxis.range[1]']] : null;
        }
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
            color: 'transparent', width: 1,
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
    let data = [];
    if (prop.isHorizontal) {
        data = prop.uniqueColors.map((key) => {
            const index = prop.array_y.indexOf(key);
            return {
                ...dataCommon,
                x: prop.array_x[index],
                y0: key,
                name: key,
                line: {
                    color: prop.isHideHover ? 'transparent' : prop.styles.filter(style => style.target === key)[0].value.line.color,
                    width: 0.5,
                },

            };
        });
    } else {
        data = prop.uniqueColors.map((key) => {
            const index = prop.array_x.indexOf(key);
            return {
                ...dataCommon,
                x0: key,
                y: prop.array_y[index],
                name: key,
                line: {
                    color: prop.isHideHover ? 'transparent' : prop.styles.filter(style => style.target === key)[0].value.line.color,
                    width: 0.5,
                },

            };
        });
    }

    const xChartRange = xRange || (prop.isHorizontal ? prop.scale : [-0.5, prop.uniqueColors.length - 0.5]);
    const yChartRange = yRange || (!prop.isHorizontal ? prop.scale : [-0.5, prop.uniqueColors.length - 0.5]);
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
                size: 8, color: 'white',
            },
            range: yRange || (!prop.isHorizontal ? prop.scale : null),
            ticks: {
                align: 'top',
            },
        },
        xaxis: {
            showline: true,
            showgrid: true,
            zeroline: true,
            ticklen: 0,
            tickfont: {
                size: 8, color: 'white',
            },
            range: xRange || (prop.isHorizontal ? prop.scale : null),
        },
    };
    genThresholds(layout, prop, { xaxis: 'x', yaxis: 'y' }, xChartRange, yChartRange);


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
    if (!prop || !prop.summaries[key]) return;
    const sumaries = prop.summaries[key][0];
    const numberOfData = option.isShowNumberOfData ? `Number of data: ${prop.h_label}<br>` : '';
    const facet = option.isShowFacet ? `Facet: Lv1 = ${prop.v_label.toString().split('|')[0]} ${option.hasLv2 ? `, Lv2 = ${prop.v_label.toString().split('|')[1] || prop.h_label}` : ''}<br>` : '';
    const div = option.isShowDiv ? `Category: ${prop.h_label}<br>` : '';
    const res = `
        <div class="scp-hover-info position-absolute" style="top: ${y}px; left: ${x}px; z-index: 9;">
        Fig info<br>
        ${numberOfData}
        ${facet}
        ${div}
        Time range: <br>
        ${formatDateTime(prop.time_min)} ${COMMON_CONSTANT.EN_DASH} ${formatDateTime(prop.time_max)}<br>
        N: ${prop.n_total}
        <br>
        <br>
        Violin info<br>
        ${prop.isHorizontal ? option.yName : option.xName}: ${key}<br>
        Upper whisker: ${sumaries.non_parametric.whisker_upper}<br>
        Q3 P75: ${sumaries.non_parametric.p75}<br>
        Median: ${sumaries.non_parametric.median}<br>
        Q1 P25: ${sumaries.non_parametric.p25}<br>
        Lower whisker: ${sumaries.non_parametric.whisker_lower}<br>
        IQR: ${sumaries.non_parametric.iqr}<br>
        NIQR: ${sumaries.non_parametric.niqr}<br>
        Mode: ${sumaries.non_parametric.mode}<br>
        Average: ${sumaries.basic_statistics.average}<br>
        N: ${sumaries.count.ntotal}<br>
        </div>
    `;

    $('body').append(res);
    const thisWidth = $('.scp-hover-info').width();
    if ((thisWidth + x) >= (window.innerWidth - 100)) {
        $('.scp-hover-info').css({
            left: `${x - thisWidth / 2}px`,
        });
    }
};
