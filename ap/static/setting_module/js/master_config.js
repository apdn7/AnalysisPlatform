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
    const json = await fetch(
        `/ap/api/setting/proc_config/${procId}/visualizations`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        },
    )
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

const copyAllGraphConfig = (e) => {
    // change editing row to normal
    let editingBtnElements = document.querySelectorAll(
        '#tblVisualConfig td.text-inline button.btn-recent',
    );
    editingBtnElements.forEach((button) => visualModule.editRow(button));
    const text = collectAllGraphConfigInfo();
    navigator.clipboard
        .writeText(text)
        .then(
            showToastCopyToClipboardSuccessful,
            showToastCopyToClipboardFailed,
        );
};

const collectAllGraphConfigInfo = () => {
    let headerTexts = getHeadTextTable(filterElements.tblConfigTable);
    headerTexts = headerTexts.flat();
    const headerCount = filterElements.tblConfigTable.find('thead tr').length;
    const colHeaderLen = headerTexts.length / headerCount;
    const mainHeaderText = headerTexts.slice(0, colHeaderLen).join(TAB_CHAR);
    const subHeaderText = headerTexts
        .slice(colHeaderLen, 2 * colHeaderLen)
        .join(TAB_CHAR);
    const searchHeaderText = headerTexts
        .slice(2 * colHeaderLen, 3 * colHeaderLen)
        .join(TAB_CHAR);

    const bodyText = _.zip([...filterElements.tblConfigBody.find('tr')])
        .map(([trColumn]) => [...getTRDataValues(trColumn)].join(TAB_CHAR))
        .join(NEW_LINE_CHAR);

    return [mainHeaderText, subHeaderText, searchHeaderText, bodyText].join(
        NEW_LINE_CHAR,
    );
};

/**
 * Paste All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const pasteAllGraphConfigInfo = (e) => {
    navigator.clipboard.readText().then(function (text) {
        const originalTable = transformCopiedTextToTable(text);
        const tableData = transformCopiedGraphConfigTable(
            originalTable,
            filterElements.tblConfigTable,
        );
        if (tableData === null) {
            return;
        }

        const tableId = visualModule.eles.tblVisualConfig;
        const settingData = visualModule.getSettingModeData(tableId);
        const mergedConfigRows = visualModule.mergeData(tableData, settingData);
        let tblConfigDOM = '';
        let index = 0;
        for (const configRow of mergedConfigRows) {
            const [_, rowDOM] = visualModule.addConfigRow(
                configRow,
                false,
                true,
                index++,
            );
            tblConfigDOM += rowDOM;
        }
        $(visualModule.eles.tblConfigBody).html(tblConfigDOM);
        showToastPasteFromClipboardSuccessful();
    }, showToastPasteFromClipboardFailed);
};

const transformCopiedGraphConfigTable = (table) => {
    if (table.length === 0) {
        return null;
    }

    let headerTexts = getHeadTextTable(filterElements.tblConfigTable);
    headerTexts = headerTexts.flat();
    const headerCount = filterElements.tblConfigTable.find('thead tr').length;
    const colHeaderLen = headerTexts.length / headerCount;
    const mainHeaderTexts = headerTexts.slice(0, colHeaderLen);

    let newTable = table;
    // user don't copy header rows
    let userHeaderRow = newTable[0];
    const hasHeaderRow = _.isEqual(
        userHeaderRow.slice(0, mainHeaderTexts.length),
        mainHeaderTexts,
    );
    if (!hasHeaderRow) {
        showToastrMsg(
            'There is no header in copied text. Please also copy header!',
            MESSAGE_LEVEL.WARN,
        );
        return null;
    }

    // should off by one if we have order column
    const hasOrderColumn =
        table[0].length && table[0][0] === mainHeaderTexts[0];
    if (hasOrderColumn) {
        newTable = table.map((row) => row.slice(1));
    }

    return newTable.slice(2);
};

const downloadAllMasterConfigInfo = (e) => {
    const text = collectAllGraphConfigInfo();
    const processName = filterElements.processList
        .find(':selected')
        .text()
        .trim();
    const fileName = `${processName}_master_config.tsv`;
    downloadText(fileName, text);
    showToastrMsg(
        document.getElementById('i18nStartedTSVDownload').textContent,
        MESSAGE_LEVEL.INFO,
    );
};
