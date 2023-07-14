/* eslint-disable no-restricted-syntax,guard-for-in */
const COLOR = {
    RED: 'rgba(255,0,0,1)',
    GREEN: '#89b368',
    BLACK: '#222222',
    WHITE: '#ffffff',
    GRID: 'rgba(96,96,96,0.2)',
};

const i18nText = {
    i18nFitted: $('#i18nFitted').text(),
    i18nActual: $('#i18nActual').text(),
    i18nTargetVariable: $('#i18nTargetVariable').text(),
    i18nResiduals: $('#i18nResiduals').text(),
    i18nIndex: $('#i18nIndex').text(),
    i18nActualFittedValues: $('#i18nActualFittedValues').text(),
    i18nConfusionMatrix: $('#i18nConfustionMatrix').text(),
    i18DataCount: $('#i18DataCount').text(),
};

const drawScatterPlot = (canvasID, props, showLine = false) => {
    const data = [{
        x: props.x,
        y: props.y,
        mode: 'markers',
        type: 'scatter',
        marker: {
            color: COLOR.GREEN,
            size: 6,
        },
        hoverinfo: 'none',
        customdata: {
            datetime: props.datetime,
            serials: props.serials,
        }
    }];

    if (showLine) {
        data.push({
            mode: 'lines',
            x: props.rangeX,
            y: props.rangeY,
            line: {
                color: COLOR.RED,
                width: 0.75,
            },
            name: 'y=x',
        });
    }

    const layout = {
        title: {
            text: props.title,
            xref: 'paper',
            x: 0,
            font: {
                size: 14,
                color: COLOR.WHITE,
            },
        },
        xaxis: {
            range: props.rangeX || 'auto',
            title: {
                text: props.titleX,
                font: {
                    size: 12,
                    color: COLOR.WHITE,
                },
            },
            ticklen: 0,
            tickfont: {
                size: 12,
                color: COLOR.WHITE,
            },
            gridcolor: COLOR.GRID,
            tickformat: props.xFmt !== undefined && props.xFmt.includes('e') ? '.1e' : '',
        },
        yaxis: {
            range: props.rangeY || 'auto',
            title: {
                text: props.titleY,
                font: {
                    size: 12,
                    color: 'white',
                },
            },
            ticklen: 0,
            gridcolor: COLOR.GRID,
            tickfont: {
                size: 12,
                color: COLOR.WHITE,
            },
            tickformat: props.yFmt !== undefined && props.yFmt.includes('e') ? '.1e' : '',
        },
        autosize: true,
        margin: 55,
        hoverlabel: {
            bgcolor: COLOR.BLACK,
        },
        font: {
            color: COLOR.WHITE,
            size: 12,
        },
        legend: {
            x: 0.85,
            y: 0.05,
            bgcolor: 'transparent',
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
    };
    
    const config = {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: {width: '100%', height: '100%'},
    };

    const scpPLot = document.getElementById(canvasID);
    
    Plotly.react(canvasID, data, layout, config);
    scpPLot.on('plotly_hover', (data) => {
        const dpIndex = getDataPointIndex(data);
        const dataPoint = data.points[0];
        const xValue = applySignificantDigit(dataPoint.data.x[dpIndex]);
        const yValue = applySignificantDigit(dataPoint.data.y[dpIndex]);
        const datetime = formatDateTime(dataPoint.data.customdata.datetime[dpIndex]);
        const serials = getSerialsText(dpIndex, dataPoint.data.customdata.serials);
        const isHideX = props.hideX;
        const hoverData = []
        if (!isHideX) {
            hoverData.push([props.titleX, applySignificantDigit(xValue, props.xFmt)])
        }
        hoverData.push([props.hoverTitleY, applySignificantDigit(yValue, props.yFmt)])
        hoverData.push(['Datetime', datetime]);
        hoverData.push(...serials);
        const tableData = genHoverDataTable(hoverData);
        const offset = {
                    x: data.event.pageX - 120,
                    y: data.event.pageY,
                };
        genDataPointHoverTable(tableData, offset, null, true, canvasID);
    });

    unHoverHandler(scpPLot);



     const getSerialsText = (idx, serials) => {
        const hasSerial = serials && Object.keys(serials).length > 0;
        let serialText = [];
        if (hasSerial) {
            for (const key of Object.keys(serials)) {
                serialText.push([key, serials[key][idx]])
            }
        }
        return serialText;
    };
};

const updateInformationTable = (dicScp) => {
    if (dicScp.is_classif) {
        $('#target_var').text(dicScp.objectiveVar);
        $('#accuracy').text(applySignificantDigit(dicScp.accuracy));
        $('#precision').text(applySignificantDigit(dicScp.precision));
        $('#recall').text(applySignificantDigit(dicScp.recall));
        $('#roc_auc').text(applySignificantDigit(dicScp.roc_auc));
        $('#pr_auc').text(applySignificantDigit(dicScp.pr_auc));
        $('table#regression-table').hide();
        $('table#classif-table').show();
    } else {
        $('#target-var').text(dicScp.objectiveVar);
        $('#mae').text(applySignificantDigit(dicScp.mae));
        $('#adjusted_r2').text(applySignificantDigit(dicScp.adjusted_r2));
        $('table#regression-table').show();
        $('table#classif-table').hide();
    }
};

const drawConfusionMatrix = (canvasID, classifProps) => {
    const hoverTemplate = `${classifProps.titleX}: %{x}
        <br>${classifProps.titleY}: %{y}
        <br>${classifProps.countTitle}: %{z}<extra></extra>`;
    const data = [
        {
            coloraxis: 'coloraxis',
            name: '0',
            texttemplate: '%{z}',
            x: classifProps.columns,
            y: classifProps.columns,
            z: classifProps.data,
            type: 'heatmap',
            xaxis: 'x',
            yaxis: 'y',
            hovertemplate: hoverTemplate,
        },
    ];
    const layout = {
        template: {
            data: {
                table: [
                    {
                        cells: {
                            fill: {
                                color: '#506784',
                            },
                            line: {
                                color: 'rgb(17,17,17)',
                            },
                        },
                        header: {
                            fill: {
                                color: '#2a3f5f',
                            },
                            line: {
                                color: 'rgb(17,17,17)',
                            },
                        },
                        type: 'table',
                    },
                ],
            },
            layout: {
                annotationdefaults: {
                    arrowcolor: '#f2f5fa',
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
                font: {
                    color: '#f2f5fa',
                },
                hoverlabel: {
                    align: 'left',
                },
                hovermode: 'closest',
                mapbox: {
                    style: 'dark',
                },
                paper_bgcolor: 'rgb(17,17,17)',
                plot_bgcolor: 'rgb(17,17,17)',
                title: {
                    x: 0.05,
                },
                updatemenudefaults: {
                    bgcolor: '#506784',
                    borderwidth: 0,
                },
                xaxis: {
                    automargin: true,
                    gridcolor: '#283442',
                    linecolor: '#506784',
                    ticks: '',
                    title: {
                        standoff: 15,
                    },
                    zerolinecolor: '#283442',
                    zerolinewidth: 2,
                },
                yaxis: {
                    automargin: true,
                    gridcolor: '#283442',
                    linecolor: '#506784',
                    ticks: '',
                    title: {
                        standoff: 15,
                    },
                    zerolinecolor: '#283442',
                    zerolinewidth: 2,
                },
            },
        },
        xaxis: {
            anchor: 'y',
            domain: [
                0.0,
                1.0,
            ],
            scaleanchor: 'y',
            constrain: 'domain',
            title: {
                text: classifProps.titleX,
            },
            side: 'top',
            // tickformat: classifProps.yFmt,
        },
        yaxis: {
            anchor: 'x',
            domain: [
                0.0,
                1.0,
            ],
            autorange: 'reversed',
            constrain: 'domain',
            title: {
                text: classifProps.titleY,
            },
            // tickformat: classifProps.yFmt,
        },
        coloraxis: {
            colorbar: {
                title: {
                    text: classifProps.countTitle,
                },
            },
            // eslint-disable-next-line no-undef
            colorscale: chmColorPalettes,
        },
        title: {
            text: classifProps.title,
        },
    };
    const config = {
        displayModeBar: false,
        responsive: true, // responsive histogram
        useResizeHandler: true, // responsive histogram
        style: {width: '100%', height: '100%'},
    };
    // eslint-disable-next-line no-undef
    Plotly.newPlot(canvasID, data, layout, config);
};

const showScatterPlot = (dicScp) => {
    if (!dicScp || Object.keys.length === 0) return;
    const {
        actual, fitted, residuals, serials, index, times, actual_fmt, fitted_fmt, residuals_fmt
    } = dicScp;
    const [minX, maxX] = findMinMax(actual);
    const [minY, maxY] = findMinMax(fitted);
    
    const commonRange = [Math.min(minX, minY), Math.max(maxX, maxY)];

    const actualFittedProps = {
        x: actual,
        y: fitted,
        title: `${i18nText.i18nActualFittedValues}<br><sup>${i18nText.i18nTargetVariable}: ${dicScp.objectiveVar}</sup>`,
        rangeX: commonRange,
        rangeY: commonRange,
        titleX: i18nText.i18nActual,
        titleY: i18nText.i18nFitted,
        xFmt: actual_fmt,
        yFmt: fitted_fmt,
        datetime: times,
        serials: serials,
        hoverTitleY: i18nText.i18nFitted,
    };
    
    const indexResidualsProps = {
        x: index,
        y: residuals,
        title: `${i18nText.i18nIndex} vs ${i18nText.i18nResiduals}`,
        titleX: i18nText.i18nIndex,
        titleY: `${i18nText.i18nResiduals} (${i18nText.i18nActual} - ${i18nText.i18nFitted})`,
        yFmt: residuals_fmt,
        xFmt: '',
        datetime: times,
        serials: serials,
        hideX: true,
        hoverTitleY: i18nText.i18nResiduals,
    };
    
    updateInformationTable(dicScp);
    if (!dicScp.is_classif) {
        drawScatterPlot('actual-fitted-scp', actualFittedProps, true);
    } else {
        const cmProps = {
            title: `${i18nText.i18nConfusionMatrix}
                <br><sup>${i18nText.i18nTargetVariable}: ${dicScp.objectiveVar}</sup>`,
            titleX: i18nText.i18nFitted,
            titleY: i18nText.i18nActual,
            countTitle: i18nText.i18DataCount,
            xFmt: dicScp.fitted_fmt || '',
            yFmt: dicScp.actual_fmt || '',
            ...dicScp.classif,
        };
        drawConfusionMatrix('actual-fitted-scp', cmProps);
    }
    drawScatterPlot('index-residuals-scp', indexResidualsProps);
};
