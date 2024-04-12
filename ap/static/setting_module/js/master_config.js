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
    processList: $('#processList'),
    detailCards: $('#detailCards'),
    loading: $('.loading'),
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
};

let cfgProcess = null;
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
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
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

$(() => {
    $('html, body').animate({ scrollTop: 0 }, 'slow');

    filterElements.processList.on('change', (e) => {
        hideAlertMessages();
        // hide loading screen
        filterElements.loading.show();

        // toggle spreadsheet tables
        $('.sp-container .jexcel').html('');
        if ($('.table-main').hasClass('hide')) {
            $('.sp-container').toggleClass('hide');
            $('.table-main').removeClass('hide');
            $(visualModule.eles.addVisualConfig).removeClass('hide');
        }
        // update process id
        const currentProcessId = $(e.currentTarget).val() || '';

        // get process configuration from YML
        if (!isEmpty(currentProcessId)) {
            setTimeout(async () => {
                await showProcessSettings(currentProcessId); // visible
                filterElements.loading.hide();
                filterElements.detailCards.css('visibility', 'visible');
            }, 50);
        } else {
            filterElements.loading.hide();
        }
        $('.action-time').datepicker();
    });

    // drag & drop for tables
    filterElements.tblConfigBody.sortable({
        helper: dragDropRowInTable.fixHelper,
        update: dragDropRowInTable.updateOrder,
    });

    const configTable = document.getElementById('tblVisualConfig');
    // eslint-disable-next-line no-undef
    resizableGrid(configTable);

    onSearchTableContent('searchMasterConfig', filterElements.tblVisualConfig);
    initSortIcon();
    handleSearchFilterInTable(filterElements.tblVisualConfig);
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
