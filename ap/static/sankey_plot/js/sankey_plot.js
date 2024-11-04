const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_SENSOR = 512;
const MIN_NUMBER_OF_SENSOR = 0;
const MAX_SENSORS_LIM = 100;
let tabID = null;
const graphStore = new GraphStore();
const formElements = {
    formID: '#traceDataForm',
    scatterBtn: '#scatter-btn',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    traceTimeOptions: $('input:radio[name="traceTime"]'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcSelectedItem: '#cond-proc-row select',
    endProcCateSelectedItem: '#end-proc-cate-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    NO_FILTER: 'NO_FILTER',
    showOutliersDivID: '#showOutlier',
    i18nShowOutliers: $('#i18nShowOutliers').text(),
    i18nHideOutliers: $('#i18nHideOutliers').text(),
    i18nMSPCorr: $('#i18nMSPCorr').text(),
    plotCard: $('#plot-card'),
    plotCardId: 'plot-card',
    graphContainerId: 'graphContainer',
    barContainerId: 'barContainer',
};

const i18n = {
    total: $('#i18nTotal').text(),
    average: $('#i18nAverage').text(),
    frequence: $('#i18nFrequence').text(),
    gaUnable: $('#i18nGAUnable').text(),
    gaCheckConnect: $('#i18nGACheckConnect').text(),
    traceResulLimited: $('#i18nTraceResultLimited').text() || '',
    SQLLimit: $('#i18nSQLLimit').text(),
    allSelection: $('#i18nAllSelection').text(),
    noFilter: $('#i18nNoFilter').text(),
    machineNo: $('#i18nMachineNo').text(),
    partNo: $('#i18nPartNo').text(),
    selectOver100SensorMsg: $('#i18nSelectOver100SensorMsg').text(),
    objectiveHoverMsg: $('#i18nSkDObjectiveHoverMsg').text(),
    SkDPlotHoverRelationship: $('#i18nSkDPlotHoverRelationship').text(),
    SkDPlotHoverRelationshipPositive: $(
        '#i18nSkDPlotHoverRelationshipPositive',
    ).text(),
    SkDPlotHoverRelationshipNegative: $(
        '#i18nSkDPlotHoverRelationshipNegative',
    ).text(),
    SkDPlotHoverCoefficient: $('#i18nSkDPlotHoverCoefficient').text(),
    SkDPlotHoverVariable: $('#i18nSkDPlotHoverVariable').text(),
    SkDPlotHoverProcess: $('#i18nSkDPlotHoverProcess').text(),
};

const MSG_MAPPING = {
    E_ALL_NA: $('#i18nE01AllNA').text(),
    E_ZERO_VARIANCE: $('#i18nE03ZeroVariance').text(),
};

$(() => {
    // generate tab ID
    while (tabID === null || sessionStorage.getItem(tabID)) {
        tabID = Math.random();
    }

    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        isRequired: true,
        showObjective: true,
        objectiveHoverMsg: i18n.objectiveHoverMsg,
        hideStrVariable: false,
        showFilter: true,
        allowObjectiveForRealOnly: true,
        disableSerialAsObjective: true,
    });
    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(
        endProcs.ids,
        endProcs.names,
        '',
        formElements.formID,
        'btn-add-cond-proc',
    );
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    initValidation(formElements.formID);
    initializeDateTimeRangePicker();
});

const sankeyTraceData = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();

    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        callToBackEndAPI(true);
    }
};

const showSankeyPlot = (plotlyJson) => {
    formElements.plotCard.css('display', 'none');
    $(`#${formElements.graphContainerId}`).html('');
    $(`#${formElements.barContainerId}`).html('');

    showGroupLasso(plotlyJson.sankey_trace);
    showBarGraph(plotlyJson.bar_trace);
    formElements.plotCard.css('display', '');

    $('html, body').animate(
        {
            scrollTop: getOffsetTopDisplayGraph('#plot-card'),
        },
        500,
    );

    window.dispatchEvent(new Event('resize'));
};

const showBarGraph = (barJson) => {
    if (isEmpty(barJson.x)) {
        return;
    }

    function wraptext(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength) + '...';
    }

    const wrappedLabels = barJson.y?.map((label) => wraptext(label, 19));

    const trace = {
        x: barJson.x || [],
        y: barJson.y || [],
        text: barJson.text.map((number) => applySignificantDigit(number)) || [],
        customdata: barJson.y,
        orientation: 'h',
        marker: {
            color: barJson.marker_color || [],
        },
        hovertemplate: '%{customdata}<br>' + '%{text}<br><extra></extra>',
        type: 'bar',
        insidetextanchor: 'start',
        insidetextfont: {
            color: '#65c5f1',
        },
    };

    const data = [trace];

    const layout = {
        font: {
            size: 12,
            color: '#65c5f1',
        },
        plot_bgcolor: '#303030',
        paper_bgcolor: '#303030',
        margin: {
            t: 10,
            r: 0,
            b: 10,
            l: 10,
        },
        // autosize: true,
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
        colorscale: {
            diverging: [
                [0, '#8e0152'],
                [0.1, '#c51b7d'],
                [0.2, '#de77ae'],
                [0.3, '#f1b6da'],
                [0.4, '#fde0ef'],
                [0.5, '#f7f7f7'],
                [0.6, '#e6f5d0'],
                [0.7, '#b8e186'],
                [0.8, '#7fbc41'],
                [0.9, '#4d9221'],
                [1, '#276419'],
            ],
            sequential: [
                [0.0, '#0d0887'],
                [0.1111111111111111, '#46039f'],
                [0.2222222222222222, '#7201a8'],
                [0.3333333333333333, '#9c179e'],
                [0.4444444444444444, '#bd3786'],
                [0.5555555555555556, '#d8576b'],
                [0.6666666666666666, '#ed7953'],
                [0.7777777777777778, '#fb9f3a'],
                [0.8888888888888888, '#fdca26'],
                [1.0, '#f0f921'],
            ],
            sequentialminus: [
                [0.0, '#0d0887'],
                [0.1111111111111111, '#46039f'],
                [0.2222222222222222, '#7201a8'],
                [0.3333333333333333, '#9c179e'],
                [0.4444444444444444, '#bd3786'],
                [0.5555555555555556, '#d8576b'],
                [0.6666666666666666, '#ed7953'],
                [0.7777777777777778, '#fb9f3a'],
                [0.8888888888888888, '#fdca26'],
                [1.0, '#f0f921'],
            ],
        },
        colorway: [
            '#636efa',
            '#EF553B',
            '#00cc96',
            '#ab63fa',
            '#FFA15A',
            '#19d3f3',
            '#FF6692',
            '#B6E880',
            '#FF97FF',
            '#FECB52',
        ],
        geo: {
            bgcolor: 'rgb(17,17,17)',
            lakecolor: 'rgb(17,17,17)',
            landcolor: 'rgb(17,17,17)',
            showlakes: true,
            showland: true,
            subunitcolor: '#506784',
        },
        hoverlabel: {
            align: 'left',
        },
        hovermode: 'closest',
        mapbox: {
            style: 'dark',
        },
        polar: {
            angularaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            bgcolor: 'rgb(17,17,17)',
            radialaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
        },
        scene: {
            xaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
            yaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
            zaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
        },
        shapedefaults: {
            line: {
                color: '#f2f5fa',
            },
        },
        sliderdefaults: {
            bgcolor: '#C8D4E3',
            bordercolor: 'rgb(17,17,17)',
            borderwidth: 1,
            tickwidth: 0,
        },
        ternary: {
            aaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            baxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            bgcolor: 'rgb(17,17,17)',
            caxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
        },
        title: {
            x: 0.05,
        },
        updatemenudefaults: {
            bgcolor: '#506784',
            borderwidth: 0,
        },
        xaxis: {
            automargin: true,
            autorange: 'reversed',
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
            autorange: 'reversed',
            gridcolor: '#283442',
            linecolor: '#506784',
            ticks: '',
            title: {
                standoff: 15,
            },
            zerolinecolor: '#283442',
            zerolinewidth: 2,
            tickvals: barJson.y || [],
            ticktext: wrappedLabels,
        },
    };

    Plotly.newPlot(formElements.barContainerId, data, layout, {
        ...genPlotlyIconSettings(),
        displaylogo: false,
        responsive: true,
        useResizeHandler: true,
        style: { width: '100%', height: '100%' },
    });
};

const showGroupLasso = (sankeyJson) => {
    const linkJson = sankeyJson.link || {};
    const nodeJson = sankeyJson.node || {};

    if (isEmpty(linkJson.source) || isEmpty(nodeJson.x)) {
        showToastrAnomalGraph();
        return;
    }

    const getRelationshipLabel = (relationship) => {
        if (relationship === 'negative') {
            return i18n.SkDPlotHoverRelationshipNegative;
        } else if (relationship === 'positive') {
            return i18n.SkDPlotHoverRelationshipPositive;
        } else {
            return '';
        }
    };
    // ############################# hover template for node of sankey - start
    const nodeLabel = nodeJson?.label;
    const linkValue = linkJson?.value;
    const linkTarget = linkJson?.target;
    const linkTargetSet = [...new Set(linkTarget)];

    const nodeValue = [];
    const incoming = [];
    const outgoing = [];

    const objectiveVarIndex = nodeLabel.length - 1;
    nodeLabel.forEach((_, nodeIndex) => {
        if (!nodeLabel || !linkValue || !linkTarget) return;
        if (!linkTarget.includes(nodeIndex)) {
            // Case1: not in linkTarget: incoming: 0, outgoing: 1, value: its value
            incoming.push(0);
            outgoing.push(1);
            nodeValue.push(linkValue[nodeIndex]);
        } else if (objectiveVarIndex === nodeIndex) {
            // Case3: for objective_index (the last index in LinkTarget) => incoming: size of set of linkTarget (not include objectiveIndex), outgoing: 0, value: sum of case 1
            const incomingValue = new Set(
                linkTarget.filter((n) => n !== objectiveVarIndex),
            ).size;
            const value = linkValue.reduce(
                (sum, value, nodeIndex) =>
                    linkTargetSet.includes(nodeIndex) ? sum : sum + value,
                0,
            );
            incoming.push(incomingValue);
            outgoing.push(0);
            nodeValue.push(value);
        } else {
            // Case2: for remaining case => calculate base on link_target and its nodeIndex to get incoming: count its index in linkTarget, outgoing: 1 and value: sum of
            let value = 0;
            linkTarget.forEach((targetValue, targetIndex) => {
                if (targetValue === nodeIndex) {
                    value += linkValue[targetIndex];
                }
            });
            incoming.push(linkTarget.filter((n) => n === nodeIndex).length);
            outgoing.push(1);
            nodeValue.push(value);
        }
    });
    // ############################# hover template for node of sankey - end

    const data = [
        {
            arrangement: sankeyJson.arrangement || 'snap',
            link: {
                color: linkJson.color || [],
                source: linkJson.source || [],
                target: linkJson.target || [],
                value: linkJson.value || [],
                relationship: linkJson.relationship || [],
                label: linkJson.source.map(() => 'Connection strength:') || [],
                hovertemplate:
                    `<b>${i18n.SkDPlotHoverRelationship}:</b> %{customdata[0]}<br>` +
                    `<b>${i18n.SkDPlotHoverCoefficient}:</b> %{customdata[1]}<br>` +
                    `<b>${i18n.SkDPlotHoverVariable}:</b> %{source.label} <br>` +
                    `<b>${i18n.SkDPlotHoverProcess}:</b> %{target.label} <br>` +
                    '<extra></extra>',
                customdata: linkJson?.relationship?.map((relation, index) => [
                    getRelationshipLabel(relation),
                    applySignificantDigit(linkJson.value[index]),
                ]),
            },
            node: {
                color: nodeJson.color || [],
                label: nodeJson.label || [],
                line: {
                    width: 0.2,
                    color: '#222',
                },
                pad: 10,
                thickness: 20,
                x: nodeJson.x || [],
                y: nodeJson.y || [],
                hovertemplate:
                    `%{customdata[0]}<br>` +
                    `<b>Incoming flow count:</b> %{customdata[1]} <br>` +
                    `<b>Outgoing flow count:</b> %{customdata[2]} <br>` +
                    '<extra>%{customdata[3]}</extra>',
                customdata: nodeJson.label.map((label, index) => [
                    label,
                    incoming[index],
                    outgoing[index],
                    applySignificantDigit(nodeValue[index]),
                ]),
            },
            type: 'sankey',
            valueformat: '.2f',
        },
    ];

    const layout = {
        title: '',
        font: {
            size: 12,
            color: '#65c5f1',
        },
        plot_bgcolor: '#303030',
        paper_bgcolor: '#303030',
        margin: {
            t: 15,
            r: 15,
            b: 50,
            l: 0,
        },
        autosize: true,
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
        colorscale: {
            diverging: [
                [0, '#8e0152'],
                [0.1, '#c51b7d'],
                [0.2, '#de77ae'],
                [0.3, '#f1b6da'],
                [0.4, '#fde0ef'],
                [0.5, '#f7f7f7'],
                [0.6, '#e6f5d0'],
                [0.7, '#b8e186'],
                [0.8, '#7fbc41'],
                [0.9, '#4d9221'],
                [1, '#276419'],
            ],
            sequential: [
                [0.0, '#0d0887'],
                [0.1111111111111111, '#46039f'],
                [0.2222222222222222, '#7201a8'],
                [0.3333333333333333, '#9c179e'],
                [0.4444444444444444, '#bd3786'],
                [0.5555555555555556, '#d8576b'],
                [0.6666666666666666, '#ed7953'],
                [0.7777777777777778, '#fb9f3a'],
                [0.8888888888888888, '#fdca26'],
                [1.0, '#f0f921'],
            ],
            sequentialminus: [
                [0.0, '#0d0887'],
                [0.1111111111111111, '#46039f'],
                [0.2222222222222222, '#7201a8'],
                [0.3333333333333333, '#9c179e'],
                [0.4444444444444444, '#bd3786'],
                [0.5555555555555556, '#d8576b'],
                [0.6666666666666666, '#ed7953'],
                [0.7777777777777778, '#fb9f3a'],
                [0.8888888888888888, '#fdca26'],
                [1.0, '#f0f921'],
            ],
        },
        colorway: [
            '#636efa',
            '#EF553B',
            '#00cc96',
            '#ab63fa',
            '#FFA15A',
            '#19d3f3',
            '#FF6692',
            '#B6E880',
            '#FF97FF',
            '#FECB52',
        ],
        geo: {
            bgcolor: 'rgb(17,17,17)',
            lakecolor: 'rgb(17,17,17)',
            landcolor: 'rgb(17,17,17)',
            showlakes: true,
            showland: true,
            subunitcolor: '#506784',
        },
        hoverlabel: {
            align: 'left',
        },
        hovermode: 'closest',
        mapbox: {
            style: 'dark',
        },
        polar: {
            angularaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            bgcolor: 'rgb(17,17,17)',
            radialaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
        },
        scene: {
            xaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
            yaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
            zaxis: {
                backgroundcolor: 'rgb(17,17,17)',
                gridcolor: '#506784',
                gridwidth: 2,
                linecolor: '#506784',
                showbackground: true,
                ticks: '',
                zerolinecolor: '#C8D4E3',
            },
        },
        shapedefaults: {
            line: {
                color: '#f2f5fa',
            },
        },
        sliderdefaults: {
            bgcolor: '#C8D4E3',
            bordercolor: 'rgb(17,17,17)',
            borderwidth: 1,
            tickwidth: 0,
        },
        ternary: {
            aaxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            baxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
            bgcolor: 'rgb(17,17,17)',
            caxis: {
                gridcolor: '#506784',
                linecolor: '#506784',
                ticks: '',
            },
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
                standoff: 2,
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
                standoff: 2,
            },
            zerolinecolor: '#283442',
            zerolinewidth: 2,
        },
    };

    Plotly.newPlot(formElements.graphContainerId, data, layout, {
        // TODO container id
        modeBarButtonsToRemove: [
            // sankey icon setting is different from others
            'lasso2d',
            'hoverClosestCartesian',
            'hoverCompareCartesian',
            'toggleSpikelines',
            'sendDataToCloud',
        ],
        displaylogo: false,
        responsive: true,
        useResizeHandler: true,
        style: { width: '100%', height: '100%' },
    });
};

const collectFormDataSkD = (clearOnFlyFilter = false) => {
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);
    if (clearOnFlyFilter) {
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    formData = bindNominalSelection(formData, clearOnFlyFilter);
    return formData;
};

const checkNumberOfSelectedSensor = (fromData) => {
    // show msg when select over 100 sensor
    const sensors = [];
    for (const item of fromData.entries()) {
        const key = item[0];
        const value = item[1];
        if (/GET02_VALS_SELECT/.test(key)) {
            sensors.push(value);
        }
    }

    if (sensors.length > MAX_SENSORS_LIM) {
        showToastrMsg(i18n.selectOver100SensorMsg);
    }
};

const callToBackEndAPI = (clearOnFlyFilter = false, reselectVars = false) => {
    const formData = collectFormDataSkD(clearOnFlyFilter || reselectVars);

    checkNumberOfSelectedSensor(formData);

    showGraphCallApi(
        '/ap/api/skd/index',
        formData,
        REQUEST_TIMEOUT,
        async (res) => {
            if (!res.actual_record_number) {
                showToastrAnomalGraph();
                return;
            }
            if (res.errors && res.errors.length) {
                showErrorToastr(res.errors);
                loadingHide();

                if (clearOnFlyFilter) {
                    // click show graph
                    problematicData = {
                        null_percent: res.null_percent || {},
                        zero_variance: res.err_cols || [],
                        selected_vars: res.selected_vars || [],
                    };
                    reselectCallback = callToBackEndAPI;
                }
                const errors = res.errors || [];
                if (problematicData && errors.length) {
                    showRemoveProblematicColsMdl(problematicData);
                }
                return;
            }

            // render cat, category label filer modal
            fillDataToFilterModal(res.filter_on_demand, () => {
                callToBackEndAPI(false);
            });

            graphStore.setTraceData(_.cloneDeep(res));
            showSankeyPlot(res.plotly_data);

            showScatterPlot(res.dic_scp, {});

            // show info table
            showInfoTable(res);
        },
    );
};

const showErrorToastr = (errors) => {
    if (!errors) {
        return;
    }

    errors.forEach((error) => {
        const msgContent = `<p>${MSG_MAPPING[error] || error}</p>`;
        showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
    });
};

const dumpData = (type) => {
    const formData = lastUsedFormData || collectFormDataSkD(true);
    handleExportDataCommon(type, formData);
};

const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};
