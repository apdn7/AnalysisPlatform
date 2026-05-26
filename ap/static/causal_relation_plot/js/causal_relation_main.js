const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_SENSOR = 512;
const MIN_NUMBER_OF_SENSOR = 0;
const graphStore = new GraphStore();

const formElements = {
    formID: '#traceDataForm',
    btnAddCondProc: '#btn-add-cond-proc',
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    condProcSelectedItem: '#cond-proc-row select',
    plotCard: '#plot-card',
    barChartContentId: 'causalBarChartContent',
    visNetworkContentId: 'causalVisNetworkContent',
};

const i18n = {
    objectiveHoverMsg: $('#i18nSkDObjectiveHoverMsg').text(),
};

$(() => {
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
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
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

const causalTraceData = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();

    if (isValid) {
        // close sidebar
        beforeShowGraphCommon();

        callToBackEndAPI(true);
    }
};

const collectFormDataCrP = (clearOnFlyFilter = false, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);
    if (clearOnFlyFilter) {
        formData = genDatetimeRange(formData);
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const callToBackEndAPI = (clearOnFlyFilter = false, autoUpdate = false) => {
    const formData = collectFormDataCrP(clearOnFlyFilter, autoUpdate);

    showGraphCallApi('/ap/api/analyze/crp/index', formData, REQUEST_TIMEOUT, async (res) => {
        if (!res.actual_record_number) {
            showToastrAnomalGraph();
            return;
        }

        showCausalRelationChart(res);

        // render cat, category label filer modal
        fillDataToFilterModal(res.filter_on_demand, () => {
            callToBackEndAPI(false);
        });

        graphStore.setTraceData(_.cloneDeep(res));

        // auto update
        setPollingData(formData, handleSetPollingData, []);

        // show info table
        showInfoTable(res);
    });
};

const showCausalRelationChart = (res) => {
    $(formElements.plotCard).show();
    new CausalRelationBarChart(formElements.barChartContentId, res.dic_bar);
    new CausalNetWork(formElements.visNetworkContentId, res.dic_net);

    $('html, body').animate(
        {
            scrollTop: getOffsetTopDisplayGraph('#plot-card'),
        },
        500,
    );
};

const handleSetPollingData = () => {
    const settings = collectFormDataCrP(false);
    callToBackEndAPI(settings, true);
};

const handleResetVisNetwork = () => {
    const dicNetData = graphStore.getTraceData().dic_net;
    new CausalNetWork(formElements.visNetworkContentId, dicNetData);
};

const handleUpdateNodeLabel = () => {
    handleResetVisNetwork();
};

const dumpData = (type) => {
    const formData = lastUsedFormData || collectFormDataCrP(true);
    handleExportDataCommon(type, formData);
};
const handleExportData = (type) => {
    showGraphAndDumpData(type, dumpData);
};
