/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes
const MAX_END_PROC = 60;
let tabID = null;
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
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, true, false, false, true, false, true);
    endProcItem();

    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem();
        updateSelectedItems();
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $('#userBookmarkBar').show();

    initValidation(formElements.formID);
    initializeDateTimeRangePicker();
});

const endProcExplanatoryOnChange = async (count) => {
    const selectedProc = $(`#end-proc-cate-process-${count}`).val();
    const procInfo = procConfigs[selectedProc];

    // remove old elements
    $(`#end-proc-cate-val-${count}`).remove();
    if (procInfo == null) {
        updateSelectedItems(isCategoryItem = true);
        return;
    }
    const ids = [];
    const vals = [];
    const names = [];
    const checkedIds = [];
    await procInfo.updateColumns(); // TODO refactor
    const columns = procInfo.getColumns();

    // eslint-disable-next-line no-restricted-syntax
    const parentId = `end-proc-cate-val-div-${count}`;
    for (const col of columns) {
        if (CfgProcess_CONST.NUMERIC_TYPES.includes(col.data_type)) {
            ids.push(col.id);
            vals.push(col.column_name);
            names.push(col.name);
            // checkedIds.push(col.id);
        }
    }

    // load machine multi checkbox to Condition Proc.
    if (ids) {
        addGroupListCheckboxWithSearch(parentId, `end-proc-cate-val-${count}`, '',
            ids, vals, checkedIds, `GET02_CATE_SELECT${count}`, noFilter = false, names, null, null, null, null, true);
    }
    updateSelectedItems(isCategoryItem = true);
    onchangeRequiredInput();
};

const sankeyTraceData = () => {
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();

    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        callToBackEndAPI();
    }
};


const showSankeyPlot = (plotlyJson) => {
    formElements.plotCard.css('display', 'none');
    $(`#${formElements.graphContainerId}`).html('');
    $(`#${formElements.barContainerId}`).html('');

    showGroupLasso(plotlyJson.sankey_trace);
    showBarGraph(plotlyJson.bar_trace);
    formElements.plotCard.css('display', '');

    $('html, body').animate({
        scrollTop: formElements.plotCard.offset().top,
    }, 500);

    window.dispatchEvent(new Event('resize'));
};

const showBarGraph = (barJson) => {
    if (isEmpty(barJson.x)) {
        return;
    }

    const trace = {
        x: barJson.x || [],
        y: barJson.y || [],
        text: barJson.text || [],
        orientation: 'h',
        marker: {
            color: barJson.marker_color || [],
        },
        hovertemplate: '%{text}',
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
            r: 10,
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
            diverging: [[0, '#8e0152'], [0.1, '#c51b7d'], [0.2, '#de77ae'], [0.3, '#f1b6da'], [0.4, '#fde0ef'], [0.5, '#f7f7f7'], [0.6, '#e6f5d0'], [0.7, '#b8e186'], [0.8, '#7fbc41'], [0.9, '#4d9221'], [1, '#276419']],
            sequential: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'], [0.3333333333333333, '#9c179e'], [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'], [0.6666666666666666, '#ed7953'], [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
            sequentialminus: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'], [0.3333333333333333, '#9c179e'], [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'], [0.6666666666666666, '#ed7953'], [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
        },
        colorway: ['#636efa', '#EF553B', '#00cc96', '#ab63fa', '#FFA15A', '#19d3f3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'],
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

    const data = [{
        arrangement: sankeyJson.arrangement || 'snap',
        link: {
            color: linkJson.color || [],
            source: linkJson.source || [],
            target: linkJson.target || [],
            value: linkJson.value || [],
            label: linkJson.source.map(() => 'Connection strength:') || [],
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
        },
        type: 'sankey',
        valueformat: '.2f',
    }];

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
            l: 15,
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
            diverging: [[0, '#8e0152'], [0.1, '#c51b7d'], [0.2, '#de77ae'], [0.3, '#f1b6da'], [0.4, '#fde0ef'], [0.5, '#f7f7f7'], [0.6, '#e6f5d0'], [0.7, '#b8e186'], [0.8, '#7fbc41'], [0.9, '#4d9221'], [1, '#276419']],
            sequential: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'], [0.3333333333333333, '#9c179e'], [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'], [0.6666666666666666, '#ed7953'], [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
            sequentialminus: [[0.0, '#0d0887'], [0.1111111111111111, '#46039f'], [0.2222222222222222, '#7201a8'], [0.3333333333333333, '#9c179e'], [0.4444444444444444, '#bd3786'], [0.5555555555555556, '#d8576b'], [0.6666666666666666, '#ed7953'], [0.7777777777777778, '#fb9f3a'], [0.8888888888888888, '#fdca26'], [1.0, '#f0f921']],
        },
        colorway: ['#636efa', '#EF553B', '#00cc96', '#ab63fa', '#FFA15A', '#19d3f3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'],
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

    Plotly.newPlot(formElements.graphContainerId, data, layout, { // TODO container id
        modeBarButtonsToRemove: [ // sankey icon setting is different from others
            'lasso2d',
            'hoverClosestCartesian', 'hoverCompareCartesian',
            'toggleSpikelines', 'sendDataToCloud',
        ],
        displaylogo: false,
        responsive: true,
        useResizeHandler: true,
        style: { width: '100%', height: '100%' },
    });
};

const collectFormDataSkD = () => {
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);
    formData = genDatetimeRange(formData);
    return formData;
};

const callToBackEndAPI = () => {
    const formData = collectFormDataSkD();

    showGraphCallApi('/ap/api/skd/index', formData, REQUEST_TIMEOUT, async (res) => {
        if (res.errors) {
            showErrorToastr(res.errors);
            loadingHide();
            return;
        }

        showSankeyPlot(res.plotly_data);

        showScatterPlot(res.dic_scp, {});

        // show info table
        showInfoTable(res);
    });
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

const handleExportData = (type) => {
    const formData = collectFormDataSkD();
    handleExportDataCommon(type, formData);
};
