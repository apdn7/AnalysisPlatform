/**
 * @file Contains components, functions, and constants for data export.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @contributor ...
 */
const MAX_NUMBER_OF_SENSOR = 100000000;
const MIN_NUMBER_OF_SENSOR = 1;
const ExportConfigItems = {
    formID: '#exportDataForm',
    addCondProcBtnId: 'btn-add-cond-proc',
    addEndProcBtnId: 'btn-add-end-proc',
};

const formElements = {
    endProcSelectedItem: '#end-proc-row select',
    condProcSelectedItem: '#cond-proc-row select',
};

$(() => {
    initProcessDropDown();
    handleLoadExportConfigToGUI();
});

const initProcessDropDown = () => {
    // generate process dropdown data
    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        isRequired: true,
    });
    endProcItem();

    // click even of end proc add button
    document.getElementById(ExportConfigItems.addEndProcBtnId).addEventListener('click', () => {
        endProcItem();
        addAttributeToElement();
    });

    // add first condition process
    const condProcItem = addCondProc(
        endProcs.ids,
        endProcs.names,
        '',
        ExportConfigItems.formID.replace('#', ''),
        ExportConfigItems.addCondProcBtnId,
        false,
        false,
        false,
    );
    condProcItem();

    // click even of condition proc add button
    document.getElementById(ExportConfigItems.addCondProcBtnId).addEventListener('click', () => {
        condProcItem();
        addAttributeToElement();
    });

    initializeDateTimeRangePicker();
};

/**
 *
 * Using in typescript do not remove it
 * @return {{process_id: number, process_column_id: number, order}[]}
 */
const getExportDetails = () => {
    const orderMap = new Map(latestSortColIds.map((v, i) => [v.split('-')[1], i + 1]));
    return latestSortColIds.map((val) => {
        const [processId, colId] = val.split('-');
        return {
            process_id: Number(processId),
            process_column_id: Number(colId),
            order: orderMap.get(colId) || null,
        };
    });
};

/**
 * Using in typescript do not remove it
 * @return {{process_id: number, filter_detail_id: number}[]}
 */
const getExportFilterDetails = () => {
    return [...$('.cond-proc').find('input[type=checkbox].main-checkbox:checked')].map((el) => {
        const _this = $(el);
        const processId = _this.attr('data-proc-id');
        const filterDetail = _this.val();
        return {
            process_id: Number(processId),
            filter_detail_id: Number(filterDetail),
        };
    });
};

/**
 * Using in typescript do not remove it
 * @return {{remove_outlier: (*|jQuery|string|number|string[]|string), remove_exception: (*|jQuery), remove_abnormal_count: (*|jQuery), duplicated_check_type: (*|jQuery|string|number|string[]), duplicated_check: (*|jQuery|string|number|string[]), client_timezone: string | *}}
 */
const getCleansingOption = () => {
    const isRemoveException = $('input[name=isValidateData]').prop('checked');
    const isRemoveOutlier = $('input[name=remove_outlier]').prop('checked');
    const removeOutlierOption = $('select[name=remove_outlier_type]').val();
    const pulsed = $('input[name=abnormal_count]').prop('checked');
    const duplicatedCheckType = $('select[name=duplicated_serial]').val();
    const duplicatedCheck = $('select[name=dup_check]').val();

    return {
        remove_outlier: isRemoveOutlier ? removeOutlierOption : '',
        remove_exception: isRemoveException,
        remove_abnormal_count: pulsed,
        duplicated_check_type: duplicatedCheckType,
        duplicated_check: duplicatedCheck,
        client_timezone: detectLocalTimezone(),
    };
};

/**
 * @param arr
 * @param key
 * @param valueKey
 * @return {[*[],*]}
 */
const groupByProcess = (arr, key, valueKey) => {
    const procs = [];
    const procObj = [...arr].reduce((acc, item) => {
        const k = item[key];
        if (!acc[k]) acc[k] = [];
        acc[k].push(item[valueKey]);
        if (!procs.includes(k)) procs.push(k);
        return acc;
    }, {});

    return [procs, procObj];
};

/**
 *
 * @param exportDetails
 * @return {*[]}
 */
const makeEndProcSettings = (exportDetails) => {
    const settings = [];
    if (!exportDetails.length) {
        settings.push({
            id: `end-proc-process-1`,
            name: `end_proc1`,
            value: '',
            type: 'select-one',
            genBtnId: 'btn-add-end-proc',
        });

        return settings;
    }
    const [endProcs, endProcObj] = groupByProcess(exportDetails, 'process_id', 'process_column_id');

    for (const index in endProcs) {
        const procId = endProcs[index];
        const idx = Number(index) + 1;
        const procCols = endProcObj[procId];
        settings.push({
            id: `end-proc-process-${idx}`,
            name: `end_proc${idx}`,
            value: procId.toString(),
            type: 'select-one',
            genBtnId: 'btn-add-end-proc',
        });

        for (const procColId of procCols) {
            settings.push({
                id: `checkbox-${procColId}end-proc-val-div-${idx}`,
                name: `GET02_VALS_SELECT${idx}`,
                value: procColId.toString(),
                type: 'checkbox',
                checked: true,
            });
        }
    }

    return settings;
};

const makeFilterSetting = async (exportFilters) => {
    const settings = [];

    if (!exportFilters.length) {
        settings.push({
            id: `cond-proc-process-1`,
            name: `cond_proc1`,
            value: '',
            type: 'select-one',
            genBtnId: 'btn-add-cond-proc',
        });
        return settings;
    }
    const [filterProcs, filterProcObj] = groupByProcess(exportFilters, 'process_id', 'filter_detail_id');
    for (const index in filterProcs) {
        const procId = filterProcs[index];
        const idx = Number(index) + 1;
        const filterIds = filterProcObj[procId];
        settings.push({
            id: `cond-proc-process-${idx}`,
            name: `cond_proc${idx}`,
            value: procId.toString(),
            type: 'select-one',
            genBtnId: 'btn-add-cond-proc',
        });
        await procConfigs[procId].updateFilters();
        const procConfig = procConfigs[procId];
        for (const filterId of filterIds) {
            for (const filter of procConfig.filters) {
                const filterType = filter.filter_type;
                for (const filterDetail of filter.filter_details) {
                    if (Number(filterDetail.id) === filterId) {
                        let inputId = '';
                        let inputName = '';
                        if (filterType === 'LINE') {
                            inputId = `checkbox-${filterId}cond-proc-line-div-${idx}`;
                            inputName = `filter-line-machine-id${idx}`;
                        } else if (filterType === 'MACHINE_ID') {
                            inputId = `checkbox-${filterId}cond-proc-machine-div-${idx}`;
                            inputName = `machine_id_multi${idx}`;
                        } else if (filterType === 'PART_NO') {
                            inputId = `checkbox-${filterId}cond-proc-partno-div-${idx}`;
                            inputName = `filter-partno${idx}`;
                        } else if (filterType === 'OTHER') {
                            inputId = `checkbox-${filterId}cond-proc-others-div-${idx}`;
                            inputName = `filter-other-${filterDetail.filter_id}-${idx}`;
                        }

                        settings.push({
                            id: inputId,
                            name: inputName,
                            value: filterId.toString(),
                            type: 'checkbox',
                            checked: true,
                        });
                    }
                }
            }
        }
    }

    return settings;
};

const makeExportUserSettingFromExportConfig = async (exportConfig) => {
    const exportDetails = exportConfig.export_details;
    const exportFilters = exportConfig.filters;
    let mockUserSetting = [
        {
            id: 'start_proc',
            name: 'start_proc',
            value: String(exportConfig.main_process_id || ''),
            type: 'select-one',
        },
        {
            id: '',
            name: 'duplicated_serial',
            value: exportConfig.duplicated_check_type,
            type: 'select-one',
        },
        {
            id: 'outlier-input',
            name: 'remove_outlier',
            type: 'checkbox',
            value: '1',
            checked: !!exportConfig.remove_outlier,
        },
        {
            id: 'exception-input',
            name: 'isValidateData',
            type: 'checkbox',
            value: '1',
            checked: exportConfig.remove_exception,
        },
        {
            id: '',
            name: 'remove_outlier_type',
            type: 'select-one',
            value: exportConfig.remove_outlier || 'O6m',
        },
        {
            id: 'pulsed-input',
            name: 'abnormal_count',
            type: 'checkbox',
            value: '1',
            checked: exportConfig.remove_abnormal_count,
        },
    ];

    const endProcSettings = makeEndProcSettings(exportDetails);
    const filterSettings = await makeFilterSetting(exportFilters);
    mockUserSetting = [...mockUserSetting, ...endProcSettings, ...filterSettings];

    return mockUserSetting;
};

const handleLoadExportConfigToGUI = () => {
    ['EXPORT_CONFIG_ROW_CLICKED', 'EXPORT_CONFIG_RESETTING'].forEach((event) => {
        window.addEventListener(event, async (e) => {
            const exportConfig = e.detail.export_config;
            const exportDetails = exportConfig.export_details;
            const mockUserSetting = await makeExportUserSettingFromExportConfig(exportConfig);
            applyUserSetting(
                {
                    settings: {
                        traceDataForm: mockUserSetting,
                    },
                },
                null,
                true,
            );

            // reassign Latest sort columns
            latestSortColIds = [...exportDetails]
                .sort((a, b) => a.order - b.order)
                .map((item) => `${item.process_id}-${item.process_column_id}`);
        });
    });
};
