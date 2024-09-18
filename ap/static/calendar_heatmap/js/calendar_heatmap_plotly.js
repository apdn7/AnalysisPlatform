const funcTitle = {
    'Cycle Time [s]': 'CT [s]',
    'Range (max-min)': 'Range<br><sub>(max-min)</sub>',
    'IQR (Q3-Q1)': 'IQR<br><sub>(Q3-Q1)</sub>',
    'Count/Hour': 'Count<br><sub>(Hour)</sub>',
    'Count/Min': 'Count<br><sub>(Min)</sub>',
};

const getHalfOfScale = (colorScale, firstHalf = false) => {
    const centerIdx = colorScale.length / 2;
    colorScale = colorScale.filter((color, idx) =>
        firstHalf ? idx < centerIdx : idx >= centerIdx - 1,
    );
    return colorScale.map((color, idx) => [
        String(idx / (colorScale.length - 1)),
        color[1],
    ]);
};

const genColorScale = (data, colorOption, commonRange = null) => {
    if (commonRange) {
        data = [commonRange.zmin, commonRange.zmax];
    }
    const minVal = Math.min(...data.filter((i) => i !== null));
    const maxVal = Math.max(...data.filter((i) => i !== null));
    const maxAbsVal = Math.max(
        ...data.filter((i) => i !== null).map((i) => Math.abs(i)),
    );

    let colorScale = colorPallets[colorOption].scale;
    // for blue and blue rev
    if (colorScale) {
        return {
            scale: colorScale,
            zmin: null,
            zmax: null,
        };
    }

    let zmin = -maxAbsVal;
    let zmax = maxAbsVal;
    colorScale = colorPallets[colorOption].isRev
        ? reverseScale(dnJETColorScale)
        : dnJETColorScale;
    if (minVal >= 0) {
        zmin = 0;
        zmax = maxAbsVal;
        colorScale = getHalfOfScale(colorScale);
    } else if (maxVal < 0) {
        zmin = -maxAbsVal;
        zmax = 0;
        colorScale = getHalfOfScale(colorScale, true);
    }

    return {
        scale: colorScale,
        zmin,
        zmax,
    };
};
const createHeatMap = (prop) => {
    const colorScale = genColorScale(
        prop.z,
        prop.colorOption,
        prop.colorScaleCommon,
    );
    const common = {
        family: 'Calibri Light',
        tickSize: 10,
        titleSize: 11,
        bgcolor: '#222222',
        textcolor: '#ffffff',
        primaryColor: '#65c5f1',
    };

    const customFuncTitle = Object.keys(funcTitle).includes(prop.aggFunction)
        ? funcTitle[prop.aggFunction]
        : prop.aggFunction;
    const isChangeSize =
        prop.zFmt.includes('e') || Math.round(prop.zmax) > 1000;

    const heatmapTrace = {
        // name: [],
        type: 'heatmap',
        y: prop.y || [],
        x: prop.x || [],
        zmax: prop.colorScaleCommon ? prop.zmax : colorScale.zmax,
        zmin: prop.colorScaleCommon ? prop.zmin : colorScale.zmin,
        z: prop.z || [],
        inherit: false,
        text: prop.hover || [],
        hoverinfo: 'none',
        colorbar: {
            title: {
                text: customFuncTitle,
                font: 10,
            },
            y: 0.48,
            len: 1.12,
            lenmode: 'fraction',
            thickness: isChangeSize ? 7 : 15,
            thicknessmode: 'pixels',
            tickformat: prop.zFmt.includes('e') ? '.1e' : '',
            ticklen: 2,
            xpad: 6,
            tickfont: {
                size: isChangeSize ? 9 : 10,
            },
        },
        colorscale: colorScale.scale,
        hoverlabel: {
            font: {
                color: common.textcolor,
                size: common.tickSize,
                family: common.family,
                bgcolor: common.bgcolor,
            },
        },
    };
    const data = [heatmapTrace];
    const [_, yMax] = findMinMax(prop.yTickvals);
    const layout = {
        title: {
            text: '',
            font: {
                color: common.primaryColor,
                size: common.titleSize,
                family: common.family,
            },
        },
        plot_bgcolor: common.bgcolor,
        paper_bgcolor: common.bgcolor,
        font: {
            color: common.textcolor,
            family: common.family,
        },
        yaxis: {
            mirror: true,
            ticklen: 0,
            showline: true,
            tickmode: 'array',
            ticktext: prop.yTicktext,
            tickvals: prop.yTickvals.map((y) => y + 0.5),
            tickfont: {
                size: common.tickSize + 1,
                family: common.family,
            },
            range: [0.1, yMax + 1],
        },
        xaxis: {
            title: '',
            mirror: true,
            showline: true,
            tickangle: 0,
            tickmode: 'array',
            ticktext: prop.xTicktext,
            tickvals: prop.xTickvals,
            ticklen: 3,
            tickfont: {
                size: common.tickSize,
                family: common.family,
            },
        },
        zaxis: {
            title: prop.aggFunction,
        },
        autosize: true,
        margin: {
            l: 30,
            r: 0,
            b: 35,
            t: 3,
        },
    };

    const heatmapIconSettings = genPlotlyIconSettings();
    const config = {
        ...heatmapIconSettings,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' }, // responsive histogram
    };

    Plotly.react(prop.canvasId, {
        data,
        layout,
        config,
    });
    const hdPlot = document.getElementById(prop.canvasId);
    const genCHMDataTable = (fromDate, toDate, zValue) => {
        let tblContent = '<tr>';
        tblContent += genTRItems('From', fromDate);
        tblContent += genTRItems('To', toDate);
        tblContent += genTRItems(zValue[0], zValue[1]);
        tblContent += '</tr>';
        return tblContent;
    };
    hdPlot.on('plotly_hover', (data) => {
        const dpIndex = getDataPointIndex(data);
        const itemTextInfo = data.points[0].data.text[dpIndex];
        if (itemTextInfo) {
            const chmText = itemTextInfo.split('<br>');
            const fromDate = chmText[0].split('From: ')[1];
            const toDate = chmText[1].split('To: ')[1];
            const zValue = chmText[2].split(': ');
            const dataTable = genCHMDataTable(fromDate, toDate, zValue);
            genDataPointHoverTable(
                dataTable,
                {
                    x: data.event.pageX - 120,
                    y: data.event.pageY,
                },
                0,
                true,
                prop.canvasId,
                1,
            );
        }
    });

    unHoverHandler(hdPlot);
};
