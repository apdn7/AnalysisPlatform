/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_SENSOR = 60;
const graphStore = new GraphStore();
let resData = null;
let selectedThreshold = 0;
let selectedSparsity = 0;
let showProcessName = false;
let showSensorName = true;
let nodePositionData = {};

const formElements = {
    formID: '#traceDataForm',
    btnAddCondProc: '#btn-add-cond-proc',
    radioDefaultInterval: $('#radioDefaultInterval'),
    radioRecentInterval: $('#radioRecentInterval'),
    autoUpdateInterval: $('#autoUpdateInterval'),
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    endProcCateSelectedItem: '#end-proc-cate-row select',
    condProcReg: /cond_proc/g,
    i18nAllSelection: $('#i18nAllSelection').text(),
    i18nNoFilter: $('#i18nNoFilter').text(),
    plotCard: $('#plot-card'),
    plotCardId: '#plot-card',
    graphicalLassoCanvasId: 'graphicalLassoCanvas',
};

const i18n = {
	traceResulLimited: $('#i18nTraceResultLimited').text() || '',
	SQLLimit: $('#i18nSQLLimit').text(),
	allSelection: $('#i18nAllSelection').text(),
    objectiveHoverMsg: $('#i18nGLObjectiveHoverMsg').text(),
};

$(() => {
    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        isRequired: true,
        showObjective: true,
        optionalObjective: true,
        objectiveHoverMsg: i18n.objectiveHoverMsg,
        showStrColumn: true,
        hideStrVariable: true,
        hideCTCol: true,
        showLabels: true,
        labelAsFilter: true,
    });
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

    initValidation(formElements.formID, false);
    initializeDateTimeRangePicker();
});

const graphicalLassoShowGraph = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();

    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        callToBackEndAPI();
    }
};

const collectFromDataGL = (clearOnFlyFilter) => {
    const traceForm = $(formElements.formID);
    let formData = null;
    if (clearOnFlyFilter) {
        formData = new FormData(traceForm[0]);
        formData = genDatetimeRange(formData);
        lastUsedFormData  = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }

    return formData;
};


const callToBackEndAPI = (clearOnFlyFilter = true) => {
    const formData = collectFromDataGL(clearOnFlyFilter);

    showGraphCallApi('/ap/api/gl/plot', formData, REQUEST_TIMEOUT, async (res) => {
        resData = res;
        showGraphicalLasso(res);

        $('html, body').animate({
            scrollTop: $(formElements.plotCardId).offset().top,
        }, 500);
        // show info table
        showInfoTable(res);

        fillDataToFilterModal(res.filter_on_demand, () => {
            callToBackEndAPI(false);
        });

    });
};

const setSparsityValue = (alphas, bestAlphas=0, threshold) => {
    // set maximum value of ticks and input range
    $('#sparsity').attr('max', alphas.length - 1);
    $('.range-ticks').html('');
    // gen dynamic ticks of input range
    alphas.forEach(alpha => {
         $('.range-ticks').append('<span class="tick"></span>');
    });
    const markedValue = alphas.indexOf(Number(bestAlphas));
    // set selected value for inputs (by dummy value)
    // $('#sparsity').attr('value', markedValue);
    // $('#threshold').attr('value', threshold);
    $('#sparsity').val(markedValue);
    $('#threshold').val(threshold);

    // show selected value
    $('#sparsityValue').text(selectedSparsity);
    $('#thresholdValue').text(threshold);
};
const showGraphicalLasso = (res, changedThreshold = null, alpha = null, inCurrentPosition=false) => {
    formElements.plotCard.show();
    $(`#${formElements.graphicalLassoCanvasId}`).empty();
    if (!res.array_plotdata) return;
    const [
        alphas,
        best_alpha,
        threshold,
        dic_nodes,
        dic_edges,
        processNames,
    ] = res.array_plotdata;

    selectedThreshold = changedThreshold !== null ? changedThreshold : threshold;
    selectedSparsity = alpha !== null ? alpha : best_alpha;
    const availableThresholds = Object.keys(dic_nodes);
    setRangeValue(res, 'threshold', null, true);
    setRangeValue(res, 'sparsity', alphas);
    const nodes = dfToList(dic_nodes[selectedSparsity]);
    let edges = dfToList(dic_edges[selectedSparsity]);
    edges = edges.filter((ed) => {
        return Math.abs(ed['size']) >= Number(selectedThreshold);
    });
    // update node labels
    nodes.forEach((node, i) => {
        let label = '';
        const sep = showProcessName && showSensorName ? ' | ' : '';
        if (showProcessName) {
            label += processNames[i];
        }
        label += sep;
        if (showSensorName) {
            label += node.label;
        }
        // update node label
        node.label = label;
        // update node position
        if (inCurrentPosition && Object.keys(nodePositionData).includes(node.id)) {
            node.x = nodePositionData[node.id].x;
            node.y = nodePositionData[node.id].y;
        }
    });
    // convert to json for sigma.js
    const graph_data = {nodes: nodes, edges: edges};

    // set and show default value of sparsity and threshold
    // use best_alphas
    setSparsityValue(alphas, selectedSparsity, selectedThreshold);
    drawGraphicalLassoSigma(formElements.graphicalLassoCanvasId, graph_data);
};

const dfToList = (df) => {
    const keys = Object.keys(df);
    const edges = df[keys[0]].map((value, i) => {
        const res = {};
        for (const key of keys) {
            res[key] = df[key][i]
        }
        return res;
    });

    return edges;
};

const castToStr = (number) => {
    if (number == 1) {
        return '1.0';
    }
    return number;
};
const setRangeValue = (res, rangeId, availableValues = null, isThreshold = false) => {
    const range = $(`#${rangeId}`);
    const valueEl = $(`#${rangeId}Value`);

    range.off('change');
    range.on('change', (e) => {
        let value = Number(e.currentTarget.value);
        if (isThreshold) {
            value = applySignificantDigit(value, 4, '.2f');
            selectedThreshold = castToStr(value);
        } else {
            const originSparsity = resData ? resData.array_plotdata[0] : [];
            value = originSparsity[value] || 0;
            selectedSparsity = castToStr(value);
        }
        valueEl.text(value);
        showGraphicalLasso(res, selectedThreshold, selectedSparsity);
    })
}

const resetSettings = () => {
    // reset node position
    nodePositionData = {};
    showGraphicalLasso(resData, selectedThreshold, selectedSparsity);
};

const updateNodeLabel = () => {
    showProcessName = $('#showProcessNameLabels').is(':checked');
    showSensorName = $('#showSensorNameLabels').is(':checked');
    showGraphicalLasso(resData, selectedThreshold, selectedSparsity, true);
};

const dumpData = (type) => {
    const formData = lastUsedFormData || collectFromDataGL();
    handleExportDataCommon(type, formData);
};
const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};