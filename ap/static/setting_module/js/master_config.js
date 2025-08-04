const globalProcessConfig = {
    apConfig: {},
    procConfig: {},
};
const procKeys = {
    proc: 'proc',
    sql: 'sql',
    from: 'from',
    selectOtherValues: 'select-other-values',
    whereOtherValues: 'where-other-values',
    filterLineMachineId: 'filter-line-machine-id',
    filterPartno: 'filter-partno',
    filterOther: 'filter-other',
    valueList: 'value_list',
    masterList: 'value_masters',
    columnName: 'column_name',
    sqlSkip: 'sql_skip',
    sqlStatements: 'sql_statements',
    type: 'type',
    machineId: 'machine-id',
    lineList: 'line-list',
    deleteItem: 'delete_lines',
    masterName: 'master-name',
};
const filterElements = {
    graphCfgTableName: 'graphConfigTable',
    processList: $('#processList'),
    detailCards: $('#detailCards'),
    loading: $('.loading'),
    tblConfigTable: $('#tblVisualConfig'),
    tblConfigBody: $('#tblVisualConfig tbody'),
    tblVisualConfig: 'tblVisualConfig',
    checkedFilterType: 'input[name^=filterTypeOption]:checked',
    cfgVisualizationId: 'cfgVisualizationId',
    controlColumn: 'controlColumn',
    filterType: 'filterType',
    filterTypeOption: 'filterTypeOption',
    filterColumn: 'filterColumnId',
    filterValue: 'filterValue',
    ucl: 'ucl',
    lcl: 'lcl',
    prcMax: 'prcMax',
    prcMin: 'prcMin',
    ymax: 'ymax',
    ymin: 'ymin',
    actFromDate: 'actFromDate',
    actToDate: 'actToDate',
    modifyGraphConfirmationModal: $('#modifyGraphConfirmationModal'),
};

let cfgProcess = null;
let dictColumnName = {};
let dictFilterCondition = {};
const openWebPageDateTime = moment();

const defaultFilter = {
    DEFAULT: {
        name: 'default',
        i18n: '#partNoDefaultName',
    },
};

const getProcessConfigFromDB = async (procId) => {
    if (!procId) return {};
    const json = await fetch(`/ap/api/setting/proc_config/${procId}/visualizations`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.clone().json())
        .catch((err) => {
            // console.log(err);
        });
    return json.data;
};

const showProcessSettings = async (procId) => {
    const processConfig = await getProcessConfigFromDB(procId);
    cfgProcess = new CfgProcess(processConfig);

    if (!isEmpty(cfgProcess)) {
        // show visualization setting
        visualModule.showSettings(cfgProcess);

        // convert hankaku -> zenkaku every input texts except for csv folder
        addAttributeToElement();
    }
};

let isCheckModify = true;
const saveGraphConfigAllChanges = async () => {
    if (visualModule.validate()) {
        await visualModule.register();
        const nextProcessId = $(filterElements.modifyGraphConfirmationModal).attr('next-process-id');
        isCheckModify = false;
        // trigger change dropdown
        filterElements.processList.val(nextProcessId).change();
    }
};

const discardGraphConfigAllChanges = () => {
    const nextProcessId = $(filterElements.modifyGraphConfirmationModal).attr('next-process-id');
    $(filterElements.modifyGraphConfirmationModal).modal('hide');
    // trigger change dropdown
    isCheckModify = false;
    filterElements.processList.val(nextProcessId).change();
};

$(() => {
    $('html, body').animate({ scrollTop: 0 }, 'slow');
    let previousProcessId = filterElements.processList.val();

    filterElements.processList.on('change', (e) => {
        // update process id
        const currentProcessId = $(e.currentTarget).val() || '';
        const graphConfigTable = jspreadsheetTable(filterElements.graphCfgTableName);
        if (currentProcessId === previousProcessId) return;
        if (isCheckModify && graphConfigTable.table && graphConfigTable.isHasChange(trackingHeaders)) {
            $(filterElements.modifyGraphConfirmationModal).attr('previous-process-id', previousProcessId);
            $(filterElements.modifyGraphConfirmationModal).attr('next-process-id', currentProcessId);
            $(filterElements.modifyGraphConfirmationModal).modal('show');
            filterElements.processList.val(previousProcessId).change();
            return;
        }
        isCheckModify = true;
        hideAlertMessages();
        previousProcessId = currentProcessId;
        // hide loading screen
        filterElements.loading.show();

        // get process configuration from YML
        if (!isEmpty(currentProcessId)) {
            setTimeout(async () => {
                await showProcessSettings(currentProcessId); // visible
                filterElements.loading.hide();
                filterElements.detailCards.css('visibility', 'visible');
                handleSearchFilterInTable(filterElements.graphCfgTableName);
            }, 50);
        } else {
            filterElements.loading.hide();
        }
        $('.action-time').datepicker();
        // clear input in search input
        $('#searchMasterConfig').val('');
    });

    const configTable = document.getElementById(filterElements.graphCfgTableName);

    resizableGrid(configTable);

    onSearchTableContent('searchMasterConfig', filterElements.graphCfgTableName);
    // show load settings menu
    handleLoadSettingBtns();

    setDefaultGraphConfig();
});

const setDefaultGraphConfig = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const procId = urlParams.get('proc_id');
    if (!procId) return;
    filterElements.processList.val(procId).trigger('change');
};
