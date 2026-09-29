const colorPalettes = [
    ['0', '#222222'],
    ['0.000001', '#18324c'],
    ['0.2', '#204465'],
    ['0.4', '#2d5e88'],
    ['0.6', '#3b7aae'],
    ['0.8', '#56b0f4'],
    ['1', '#6dc3fd'],
];

const MAX_HMP_TICKS = 8;

/**
 * Calculate the color range without expanding large datasets into function arguments.
 * @param {Array<unknown>} data - Color values whose null entries are ignored.
 * @returns {{minVal: number, maxVal: number, maxAbsVal: number}} Numeric bounds for the color scale.
 */
const findHeatmapColorRange = (data) => {
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxAbsVal = -Infinity;

    // Process values in one pass to avoid argument limits and temporary arrays for large heatmaps.
    for (const value of data) {
        if (value === null) {
            continue;
        }
        minVal = Math.min(minVal, value);
        maxVal = Math.max(maxVal, value);
        maxAbsVal = Math.max(maxAbsVal, Math.abs(value));
    }

    return { minVal, maxVal, maxAbsVal };
};

/**
 * Build the Plotly color scale and numeric bounds for heatmap color values.
 * @param {Array<number>} data - Flattened heatmap color values.
 * @param {string} colorOption - Selected color palette key.
 * @param {boolean} isDiscreteColor - Whether colors represent discrete values.
 * @param {Array<number>} hmpData - Heatmap plots used to collect discrete colors.
 * @param {{zmin: number, zmax: number}|null} commonRange - Optional shared range.
 * @param {Array<unknown>|null} judgeColorScale - Optional judge-specific scale.
 * @returns {{scale: Array<unknown>, zmin: number|null, zmax: number|null}} Plotly color scale settings.
 */
const genColorScale = (data, colorOption, isDiscreteColor, hmpData, commonRange = null, judgeColorScale = null) => {
    if (commonRange) {
        data = [commonRange.zmin, commonRange.zmax];
    }

    const { minVal, maxVal, maxAbsVal } = findHeatmapColorRange(data);
    let zmin = -maxAbsVal;
    let zmax = maxAbsVal;

    // custom color scale for judge
    if (judgeColorScale) {
        const isOnlyOneColor = judgeColorScale.length === 3;
        // in case: judge only 1 value => zmin: null, zmax: null
        // in case: data has 1 value and judge includes ok, ng => zmin: 0, zmax; 1 || max value
        if (minVal >= 0) {
            zmin = 0;
            zmax = maxVal === minVal && !isOnlyOneColor ? 1 : maxVal;
        } else if (maxVal < 0) {
            zmin = -maxAbsVal;
            zmax = 0;
        }
        return {
            scale: judgeColorScale,
            zmin: isOnlyOneColor ? null : zmin,
            zmax: isOnlyOneColor ? null : zmax,
        };
    }

    let colorScale = colorPallets[colorOption].scale;
    const uniqueColorData = getUniqueColorData(isDiscreteColor, hmpData, data);
    const isString = _.isString(uniqueColorData[0]);

    // If colorScale exists and uniqueColorData is a string
    if (colorScale && isString) {
        return { scale: colorScale, zmin: null, zmax: null };
    }

    if (colorScale) {
        if (minVal >= 0) {
            zmin = 0;
            zmax = maxAbsVal;
        } else if (maxVal < 0) {
            zmin = -maxAbsVal;
            zmax = 0;
        }
        return { scale: colorScale, zmin: zmin, zmax: zmax };
    }

    colorScale = colorPallets[colorOption].isRev ? reverseScale(dnJETColorScale) : dnJETColorScale;

    // Calculate zmin, zmax, and colorScale if needed
    if (minVal >= 0) {
        zmin = 0;
        zmax = maxAbsVal;
        colorScale = getHalfOfScale(colorScale);
    } else if (maxVal < 0) {
        zmin = -maxAbsVal;
        zmax = 0;
        colorScale = getHalfOfScale(colorScale, true);
    }

    return { scale: colorScale, zmin, zmax };
};

const getUniqueColorData = (isDiscreteColor, hmpData, data) => {
    let discreteColors = false;
    if (isDiscreteColor) {
        discreteColors = [];
        hmpData.forEach((plot) => {
            const colorsVal = _.flatten(
                plot.map((i) => {
                    let colorValues = [];
                    if (i && i.colors_encode) {
                        colorValues = Object.values(i.colors_encode);
                    } else if (i) {
                        colorValues = i.colors;
                    }
                    return colorValues;
                }),
            );
            discreteColors = [...discreteColors, ...colorsVal];
        });
        discreteColors = Array.from(new Set(discreteColors));
        discreteColors.sort((a, b) => b - a);
    }

    return !discreteColors ? data.filter(onlyUniqueFilter) : discreteColors;
};

const getHalfOfScale = (colorScale, firstHalf = false) => {
    const centerIdx = colorScale.length / 2;
    colorScale = colorScale.filter((color, idx) => (firstHalf ? idx < centerIdx : idx >= centerIdx - 1));
    return colorScale.map((color, idx) => [String(idx / (colorScale.length - 1)), color[1]]);
};

const filterEvenly = (list, t) => {
    if (t <= 0) return [];
    if (list.length <= t) return [...list];

    // Calculate step size using ceiling division
    const step = Math.ceil(list.length / t);
    const result = [];

    // Jump directly by step size to keep time complexity at O(k)
    for (let i = 0; i < list.length; i += step) {
        result.push(list[i]);
    }

    return result;
};

const generateHeatmapPlot = (prop, option, zoomRange) => {
    prop.org_array_x = [...prop.array_x];
    prop.org_array_y = [...prop.array_y];
    let xRange = null;
    let yRange = null;
    if (zoomRange) {
        if (!zoomRange['xaxis.autorange']) {
            xRange =
                zoomRange['xaxis.range[0]'] && zoomRange['xaxis.range[1]']
                    ? [zoomRange['xaxis.range[0]'], zoomRange['xaxis.range[1]']]
                    : null;
            yRange =
                zoomRange['yaxis.range[0]'] && zoomRange['yaxis.range[1]']
                    ? [zoomRange['yaxis.range[0]'], zoomRange['yaxis.range[1]']]
                    : null;
        }
    }

    // add prefix to change int to str type
    const isXIntType = option.xDataType === DataTypes.INTEGER.name || !isEmpty(Number(prop.array_x[0]));
    const isYIntType = option.yDataType === DataTypes.INTEGER.name || !isEmpty(Number(prop.array_y[0]));
    option.isXIntType = isXIntType;
    option.isYIntType = isYIntType;

    if (isXIntType) {
        const orgArrayX = [...prop.array_x];
        prop.array_x = orgArrayX.map((val) => `${STR_PREFIX}${val}`);
        prop.org_array_x = orgArrayX;
    }

    if (isYIntType) {
        const orgArrayY = [...prop.array_y];
        prop.array_y = orgArrayY.map((val) => `${STR_PREFIX}${val}`);
        prop.org_array_y = orgArrayY;
    }

    const data = [
        {
            x: prop.array_x,
            y: prop.array_y,
            z: prop.array_z,
            type: 'heatmap',
            showscale: false,
            hoverongaps: true,
            uirevision: true,
            hoverinfo: 'none',
            colorscale: prop.colorScale,
            zmax: prop.zmax,
            // zmin: prop.zmin - 1,
            zmin: prop.zmin,
            customdata: {
                origin: {
                    x: prop.org_array_x || prop.array_x,
                    y: prop.org_array_y || prop.array_y,
                },
            },
        },
    ];

    const layout = {
        plot_bgcolor: '#222222',
        paper_bgcolor: 'transparent',
        autosize: true,
        margin: {
            r: 0,
            l: prop.isShowY ? 33 : 0,
            t: 0,
            b: prop.isShowX ? 25 : 0,
        },
        yaxis: {
            ticklen: 0,
            showline: false,
            zeroline: false,
            showgrid: false,
            tickmode: 'array',
            ticktext: filterEvenly(prop.org_array_y, MAX_HMP_TICKS),
            tickvals: filterEvenly(prop.array_y, MAX_HMP_TICKS),
            tickfont: {
                size: 8,
                color: 'white',
            },
            range: yRange,
        },
        xaxis: {
            showline: false,
            showgrid: false,
            zeroline: false,
            tickangle: 0,
            tickmode: 'array',
            ticktext: filterEvenly(prop.org_array_x, MAX_HMP_TICKS),
            tickvals: filterEvenly(prop.array_x, MAX_HMP_TICKS),
            ticklen: 0,
            tickfont: {
                size: 8,
                color: 'white',
            },
            range: xRange,
        },
        hoverlabel: {
            align: 'left',
            bgcolor: '#222',
            bordercolor: '#222',
            font: {
                color: '#fff',
                size: 10,
            },
        },
        hovermode: 'closest',
    };

    if (isXIntType && isYIntType && prop.heatmap_matrix) {
        data[0].x = prop.heatmap_matrix.x;
        data[0].y = prop.heatmap_matrix.y;
        data[0].z = prop.heatmap_matrix.z;
        // data[0].xgap = 3;
        // data[0].ygap = 3;
        layout.xaxis.ticktext = filterEvenly(prop.heatmap_matrix.x, MAX_HMP_TICKS);
        layout.xaxis.tickvals = filterEvenly(prop.heatmap_matrix.x, MAX_HMP_TICKS);
        layout.yaxis.ticktext = filterEvenly(prop.heatmap_matrix.y, MAX_HMP_TICKS);
        layout.yaxis.tickvals = filterEvenly(prop.heatmap_matrix.y, MAX_HMP_TICKS);
    }
    data[0].xgap = 3;
    data[0].ygap = 3;

    const config = {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: { width: '100%', height: '100%' },
    };

    Plotly.react(prop.canvasId, data, layout, config);
};

const makeHeatmapHoverInfoBox = (prop, xVal, yVal, option, x, y, pointIndex, isUseOriginalColorValue = false) => {
    if (!prop) return;
    const [i, j] = pointIndex;
    const numberOfData = option.isShowNumberOfData ? prop.h_label : null;
    const facet = option.isShowFacet
        ? `Lv1 = ${prop.v_label.toString().split('|')[0]} ${option.hasLv2 ? `, Lv2 = ${prop.v_label.toString().split('|')[1] || prop.h_label}` : ''}`
        : null;
    const div = option.isShowDiv ? prop.h_label : null;
    let hoverData = prop.orig_array_z
        ? {
              data_no: numberOfData,
              facet,
              category: div,
              ratio: `${prop.array_z[i][j] || COMMON_CONSTANT.NA}%`,
              n_total: prop.n_total,
              from: formatDateTime(prop.time_min),
              to: formatDateTime(prop.time_max),
              n: prop.orig_array_z[i][j] || COMMON_CONSTANT.NA,
          }
        : {
              data_no: numberOfData,
              facet,
              category: div,
              color: prop.array_z[i][j],
              colorName: option.colorName || '',
              n_total: prop.n_total,
              from: formatDateTime(prop.time_min),
              to: formatDateTime(prop.time_max),
          };
    hoverData.xVal = prop.array_x[j];
    hoverData.xName = option.x_name || '';
    hoverData.yName = option.y_name || '';
    hoverData.yVal = prop.array_y[i];
    hoverData.agg_value = !isEmpty(prop.array_z[i][j]) ? prop.array_z[i][j] : COMMON_CONSTANT.NA;
    if (prop.colors_encode && isUseOriginalColorValue) {
        // isUseOriginalColorValue: the color is selected with last/first
        hoverData.agg_value = prop.colors_encode[prop.array_z[i][j]] || hoverData.agg_value;
    }
    hoverData.agg_func = option.color_bar_title || option.colorName;
    showSCPDataTable(
        hoverData,
        {
            x: x - 55,
            y: y,
        },
        option.canvas_id,
        option.chartType || 'heatmap',
    );
};
