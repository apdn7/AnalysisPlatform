let tabID = null;
const MAX_NUMBER_OF_SENSOR = 6;
const MIN_NUMBER_OF_SENSOR = 1;
const REQUEST_TIMEOUT = setRequestTimeOut();
const isMultiAxisPlotPage = () => !!document.querySelector('[data-component="MultiAxisPlot"]');

const formElements = {
    formID: '#traceDataForm',
    btnAddCondProc: '#btn-add-cond-proc',
    btnAddEndProc: '#btn-add-end-proc',
    userBookmarkBar: '#userBookmarkBar',
    plotContainer: '#plot-card-container',
    endProcSelectedItem: '#end-proc-row select',
    xOption: '#xOption',
    tsXScale: 'select[name=XAxisOrder]',
    serialTable: '#serialTable',
    serialTable2: '#serialTable2',
    btnAddSerial: '#btnAddSerial',
    btnAddSerial2: '#btnAddSerial2',
    serialTableModal: '#xAxisModal',
    serialTableModal2: '#xAxisModal2',
    indexOrderSwitch: '#indexOrderSwitch',
    cancelOrderIndexModal: '.btnXAxisModalCancel2',
    okOrderIndexModal: '#btnXAxisModalOK2',
};

const i18n = {
    ascending: $('#i18nAscending').text() || '',
    descending: $('#i18nDescending').text() || '',
    inputOrder: $('#i18nInputOrder').text() || '',
    originalOrder: $('#i18nOriginalOrder').text() || 'Original order',
    nameAscending: $('#i18nNameAscending').text() || 'Name A -> Z',
    nameDescending: $('#i18nNameDescending').text() || 'Name Z -> A',
    countAscending: $('#i18nCountAscending').text() || 'Count Low -> High',
    countDescending: $('#i18nCountDescending').text() || 'Count High -> Low',
    valueAscending: $('#i18nValueAscending').text() || 'Metric Low -> High',
    valueDescending: $('#i18nValueDescending').text() || 'Metric High -> Low',
    serialAscending: $('#i18nSerialAscending').text() || 'Ascending',
    serialDescending: $('#i18nSerialDescending').text() || 'Descending',
};

let mapDataPointWindow = null;

const applyMapDataPointWindowParams = (formData) => {
    formData.delete('map_data_point_nth');
    formData.delete('map_data_point_window_size');
    formData.delete('map_data_point_show_labels');

    if (!mapDataPointWindow) {
        return;
    }

    formData.set('map_data_point_nth', mapDataPointWindow.nthValue);
    formData.set('map_data_point_window_size', String(mapDataPointWindow.windowSize));
    formData.set('map_data_point_show_labels', mapDataPointWindow.showLabels ? '1' : '0');
};

window.requestMapDataPointWindow = (nthValue, windowSize, showLabels) => {
    mapDataPointWindow = {
        nthValue,
        windowSize,
        showLabels,
    };
    handleSubmit(false, false);
};

const normalizeMultiAxisPlotData = (plotData) => {
    if (!Array.isArray(plotData) || !plotData.length) {
        return [];
    }

    return Array.isArray(plotData[0]) ? plotData : [plotData];
};

const removeTempFormValue = (formData) => {
    ['TermSerialProcess', 'TermSerialColumn', 'TermSerialOrder', 'termcategoryAggregated'].forEach((key) => {
        formData.delete(key);
    });

    return formData;
};

const hasMultiAxisPlotData = (plotDataGroups) =>
    plotDataGroups.some((plotData) => Array.isArray(plotData) && plotData.some((series) => !isEmpty(series.array_y)));

const collectFormDataTrace = (clearOnFlyFilter, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
    let formData = null;
    if (clearOnFlyFilter) {
        formData = collectFormData(formElements.formID);
        // transform facet params
        formData = transformFacetParams(formData);

        // genDatetime of tracing from date-time-range-picker
        formData = genDatetimeRange(formData);

        formData = removeTempFormValue(formData);

        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        // transform cat label filter
        formData = transformCatFilterParams(formData);

        // transform index order
        formData = transformIndexOrderParams(formData, formElements.formID);
        // update category order in case of re-set from on-demand filter
        updateCategoryOrder(formData);
    }

    return formData;
};

const setXOption = (value = null) => {
    const selectedOptionValue = value || $('#xOption').siblings('.dn-custom-select--select').attr('data-value');
    window.setMapXOption?.(selectedOptionValue);

    for (const selector of [formElements.xOption, formElements.tsXScale]) {
        const selectElement = $(selector);
        selectElement.data('change-val-only', true).val(selectedOptionValue);
        selectElement[0]?.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

const getYAxisOption = () =>
    $('#yAxisOption').siblings('.dn-custom-select--select').attr('data-value') || $('#yAxisOption').val();

const multiAxisTraceData = (clearOnFlyFilter, autoUpdate = false) => {
    if (clearOnFlyFilter) {
        mapDataPointWindow = null;
    }
    // set xOption value
    setXOption();
    const formData = collectFormDataTrace(clearOnFlyFilter);
    applyMapDataPointWindowParams(formData);
    const layoutData = collectLayout();
    layoutData.y_axis_mode = getYAxisOption();
    formData.set('layout', JSON.stringify(layoutData));

    const requestPromise = showGraphCallApi('/ap/api/map/plot', formData, REQUEST_TIMEOUT, async (res) => {
        convertChartInfoToIndex(res);
        if (res.is_send_ga_off) {
            showGAToastr(true);
        }

        // sync available ordering columns for xAxisModal2's Column dropdown
        availableOrderingSettings = res.COMMON.available_ordering_columns || {};
        for (const procId in availableOrderingSettings) {
            const procInfo = procConfigs[procId];
            if (!procInfo) continue;
            const serialDateTimeColId = procInfo?.columns
                .filter((col) => col.is_serial_no || col.is_get_date)
                .map((col) => col.id);
            serialDateTimeColId.forEach((columnId) => {
                if (availableOrderingSettings[procId].indexOf(columnId) < 0) {
                    availableOrderingSettings[procId].push(columnId);
                }
            });
            availableOrderingSettings[procId].sort((a, b) => a - b);
        }

        // check result and show toastr msg
        const normalizedPlotDataGroups = normalizeMultiAxisPlotData(res.array_plotdata);
        const isWaitingForDataPointWindow = Boolean(res.map_data_point_limit_exceeded || res.map_lab_limit_exceeded);

        if (!isWaitingForDataPointWindow && !hasMultiAxisPlotData(normalizedPlotDataGroups)) {
            showToastrAnomalGraph();
        }

        if (window.setMapPlotData) {
            window.setMapPlotData(res.array_plotdata || [], res.show_process_name || false, {
                dataPointLimitExceeded: res.map_data_point_limit_exceeded,
                labLimitExceeded: res.map_lab_limit_exceeded,
                actualRecordNumber: res.actual_record_number,
                divSize: res.div_size,
                numPrimaries: res.num_primaries,
                divOrientation: res.div_orientation,
            });
        }

        initIndexModal();
        setXOption();

        if (clearOnFlyFilter) {
            initTableValue();
        }

        showInfoTable(res);

        // render filter modal
        fillDataToFilterModal(res.filter_on_demand, () => {
            handleSubmit(false, false);
        });

        if (!autoUpdate) {
            autoScrollToChart(100, formElements.plotContainer);
        }

        // show toastr to inform result was truncated upto 5000
        if (res.is_res_limited) {
            showToastrMsg(i18n.traceResulLimited.split('BREAK_LINE').join('<br>'));
        }

        setPollingData(formData, handleSetPollingData, [], requestPromise);
    });

    return requestPromise;
};

const handleSetPollingData = () => {
    collectFormDataTrace(false);
    return handleSubmit(false, true);
};

const MAP_MISSING_XY_BLINK_TARGET = '.title-col.layout-col';

const hasSelectedMapEndProc = () => {
    const formData = collectFormData(formElements.formID);
    for (const [key, value] of formData.entries()) {
        if (/^GET02_VALS_SELECT/.test(key) && value && value !== 'All') {
            return true;
        }
    }
    return false;
};

// Any of these counts as "X axis selected" — LabX/ColorX/ColorImbX are all X-axis-linked values.
const MAP_X_AXIS_KEYS = ['x_axis', 'lab_x', 'color_x', 'color_imb_x'];

const hasSelectedMapXAxis = () => {
    const layout = collectLayout();
    return MAP_X_AXIS_KEYS.some((key) => layout[key]);
};

// Blinks the "Layout" column header label continuously while X-axis or every End Proc (primary
// variable) checkbox is missing, and stops automatically once both are selected.
const updateMapMissingXYBlink = () => {
    const isMissing = !hasSelectedMapXAxis() || !hasSelectedMapEndProc();
    $(MAP_MISSING_XY_BLINK_TARGET).toggleClass('blink', isMissing);
};

// Number of primary subplots the current layout draws. Div sizing must use this instead of the
// number of checked End Proc variables: X axis / Lab / Color are checked columns too, so counting
// checkboxes over-counts the primaries and makes Div2/Div3/Div6 unusable.
const getMapPrimaryCount = () => {
    const subPlots = collectLayout().sub_plots || [];
    return new Set(subPlots.map((subPlot) => subPlot.order)).size;
};

// Keep in sync with _resolve_map_div_size() in ap/api/multi_axis_plot/services.py: a Div size is
// usable only while (div_size x primary count) fits within MAX_NUMBER_OF_SENSOR sub-plots.
const updateMapDivSizeOptions = () => {
    const primaryCount = getMapPrimaryCount();
    $(`select[name=catExpBox] option[value="${facetLevels.DIV}"][data-div-size]`).each((_, opt) => {
        const $opt = $(opt);
        const divSize = Number($opt.attr('data-div-size')) || MAX_NUMBER_OF_SENSOR;
        const isDisabled = primaryCount > Math.floor(MAX_NUMBER_OF_SENSOR / divSize);
        const wasSelected = $opt.is(':selected');
        $opt.prop('disabled', isDisabled);
        // A disabled option keeps being selected and would still be submitted, so the backend
        // would silently ignore the requested Div size. Clear it to keep both sides consistent.
        if (isDisabled && wasSelected) {
            const selectElement = $opt.closest('select');
            selectElement.val('');
            selectElement[0]?.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
};

// Called from the shared End Proc component (components.js) after a variable check changes.
window.updateMapDivSizeOptions = updateMapDivSizeOptions;

const mapTracing = () => {
    requestStartedAt = performance.now();
    const isValid = checkValidations(
        {
            min: MIN_NUMBER_OF_SENSOR,
            max: MAX_NUMBER_OF_SENSOR,
        },
        formElements.formID,
    );
    updateStyleOfInvalidElements();
    updateMapMissingXYBlink();

    if (!isValid || !hasSelectedMapXAxis()) return false;

    // close sidebar
    beforeShowGraphCommon();

    $(formElements.plotContainer).show();

    removeHoverInfo();

    return multiAxisTraceData(true);
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
        showCatExp: true,
        isRequired: true,
        showLayout: isMultiAxisPlotPage(),
        showLabel: false,
        showFilter: true,
        hasDiv: true,
        divSizeOptions: true,
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
    $(formElements.btnAddEndProc).click(() => {
        endProcItem(() => {});
        addAttributeToElement();
    });

    // Load userBookmarkBar
    $(formElements.userBookmarkBar).show();

    initializeDateTimeRangePicker();
    initializeDateTimePicker();

    // show index information box
    showIndexInforBox();

    // validation required input
    initValidation(formElements.formID);

    triggerSerialTableEvents();
    handleOnChangeLayout();

    // Missing X/Y blink: re-check whenever an End Proc (primary variable) checkbox changes.
    $(document).on('change', 'input[name^="GET02_VALS_SELECT"]', () => {
        updateMapMissingXYBlink();
    });
});

const handleSubmit = (clearOnFlyFilter = false, autoUpdate = false) => {
    return multiAxisTraceData(clearOnFlyFilter, autoUpdate);
};

const getStartEndPoint = (xAxisOption = 'TIME', timesLength = 20, data = {}) => {
    if (xAxisOption === 'INDEX') {
        return [0, Math.max(20, timesLength)];
    }

    const startDateTime = moment
        .utc(`${data.COMMON.START_DATE} ${data.COMMON.START_TIME}`)
        .local()
        .format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    const endDateTime = moment
        .utc(`${data.COMMON.END_DATE} ${data.COMMON.END_TIME}`)
        .local()
        .format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    return [startDateTime, endDateTime];
};

const clampChartInfoIndex = (index, lastIndex) => Math.max(0, Math.min(index, lastIndex));

const convertToIndex = (times, chartInfo, startPoint, endPoint) => {
    const actFrom = chartInfo['act-from'];
    const actTo = chartInfo['act-to'];
    const lastIndex = Math.max(times.length - 1, 0);
    let fromIndex = startPoint;
    if (!isEmpty(actFrom)) {
        fromIndex = binarySearch(times, createDatetime(actFrom), (x, y) => x - y) + 1;
    }
    let toIndex = endPoint;
    if (!isEmpty(actTo)) {
        toIndex = binarySearch(times, createDatetime(actTo), (x, y) => x - y) + 1;
    }
    const chartInfoCI = _.cloneDeep(chartInfo);
    chartInfoCI['is-out-of-range'] = fromIndex > lastIndex || toIndex < 0 || fromIndex > toIndex;
    chartInfoCI['act-from'] = clampChartInfoIndex(fromIndex, lastIndex);
    chartInfoCI['act-to'] = clampChartInfoIndex(toIndex, lastIndex);
    return chartInfoCI;
};

const convertChartInfoToIndex = (data) => {
    let times = getNode(data, ['times'], []) || [];
    const [startPoint, endPoint] = getStartEndPoint('INDEX', times.length - 1);
    const group = data.array_plotdata.length;
    times = times.map((x) => new Date(x));
    if (!data.array_plotdata) return;
    for (let i = 0; i < group; i++) {
        const plotData = data.array_plotdata[i];
        for (let j = 0; j < plotData.length; j++) {
            const chartInfos = plotData[j].chart_infos || [];
            const chartInfosOrg = plotData[j].chart_infos_org || [];
            data.array_plotdata[i][j].chart_infos_ci = [];
            data.array_plotdata[i][j].chart_infos_org_ci = [];
            for (const cIdx in chartInfos) {
                const chartInfo = chartInfos[cIdx];
                const chartInfoCI = convertToIndex(times, chartInfo, startPoint, endPoint);
                data.array_plotdata[i][j].chart_infos_ci.push(chartInfoCI);

                const chartInfoOrg = chartInfosOrg[cIdx];
                const chartInfoOrgCI = convertToIndex(times, chartInfoOrg, startPoint, endPoint);
                data.array_plotdata[i][j].chart_infos_org_ci.push(chartInfoOrgCI);
            }
        }
    }
};

const handleOnChangeLayout = () => {
    document.addEventListener('layoutchange', (e) => {
        if (isSettingLoading) return;
        const { value } = e.detail;
        const xKeys = MAP_X_AXIS_KEYS;
        setTimeout(() => {
            const layout = collectLayout();
            const { x_axis, lab_x, color_x, color_imb_x } = layout;
            const xAxis = [x_axis, lab_x, color_x, color_imb_x].filter((x) => x);
            if (layout.x_datatype === 'CAT' && xKeys.includes(value)) {
                setXOption('INDEX');
                const style = {
                    width: '650px',
                    maxWidth: '70%',
                    marginTop: '350px',
                };
                $(formElements.xOption)[0]?.dispatchEvent(new Event('change', { bubbles: true }));
                checkAndShowModal(formElements.serialTable, xAxis[0], style);
            }
            updateMapMissingXYBlink();
            updateMapDivSizeOptions();
        }, 500);
    });
};
