/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-vars */
// eslint-disable-next-line no-unused-vars

const htmlCardId = {
    LINE: 'line',
    MACHINE_ID: '_machine',
    PART_NO: 'partno',
    FILTER_OTHER: 'filter-other',
};

/* eslint-disable no-undef */
const filterElements = {
    processListId: 'processList',
    processList: $('#processList'),
    btnShowAllSettings: $('#btnShowAllFilterSettings'),
    addFilterOther: $('#addFilterOther'),
    filterOthers: `.card[id^="${htmlCardId.FILTER_OTHER}"]`,
    filterTemplate: $(`.card#${htmlCardId.FILTER_OTHER}01`),
    detailCards: $('#detailCards'),
    filterName: 'filterName',
    filterDetailId: 'filterDetailId',
    filterCondition: 'filterCondition',
    startDigit: 'startDigit',
    filterFormula: 'filterConditionFormula',
    filterTitle: 'filterTitle',
    filterId: 'filterId',
    filterDetailParentId: 'filterDetailParentId',
    divLineConfig: '#line',
    divMachineConfig: '#_machine',
    divPartnoConfig: '#partno',
    divOtherConfig: '[name=filterOtherCard]',
};

const filterTypes = {
    LINE: 'LINE',
    MACHINE_ID: 'MACHINE_ID',
    PART_NO: 'PART_NO',
    OTHER: 'OTHER',
};

class FilterStore {
    constructor() {
        this.currentProcessId = null;
        this.selectedProcess = {};
        this.selectedProcConfig = new CfgProcess();
        this.filterColumnData = {};
    }

    setSelectedProcessId(processId) {
        this.currentProcessId = processId;
    }

    getSelectedProcessId() {
        return this.currentProcessId;
    }

    setSelectedProcess(proc) {
        this.selectedProcess = proc;
    }

    getSelectedProcess() {
        return this.selectedProcess;
    }

    setSelectedProcessConfig(procConfig) {
        this.selectedProcConfig = procConfig;
    }

    getSelectedProcessConfig() {
        return this.selectedProcConfig;
    }

    setFilterColumnsData(filterColumnsData) {
        this.filterColumnData = filterColumnsData;
    }
}

const filterStore = new FilterStore();

const getProcessConfigFromDB = async (procId) => {
    if (!procId) return {};
    const json = await fetch(`/histview2/api/setting/proc_filter_config/${procId}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json());
    return [json.data, json.filter_col_data];
};

const loadFilterOthers = (processConfig) => {
    // there is no filter flag
    let noneFilterFlg = true;

    // delete all filter-other XX
    $(`${filterElements.filterOthers}`).remove();
    filterElements.filterTemplate.hide();

    const cfgProcess = filterStore.getSelectedProcessConfig();

    const { filters } = processConfig;
    filters.forEach(async (filterConfig) => {
        if (filterConfig && filterConfig.filter_type === filterTypes.OTHER) {
            const filterId = filterConfig.id;

            // create HTML card ID for filter
            const filterCardId = `${htmlCardId.FILTER_OTHER}${filterId}`;

            // generate HTML + funcs
            const otherFuncs = genSmartHtmlOther(processConfig.id, filterCardId, filterConfig);

            const filterColumnId = filterConfig.column_id;
            await cfgProcess.updateColDataFromUDB(filterColumnId);

            // load settings to UI
            otherFuncs.showSettings(processConfig, filterCardId, filterConfig);

            // single select2
            addAttributeToElement($(otherFuncs.eles.thisCard));
        }
    });

    noneFilterFlg = false;
    if (noneFilterFlg) { // todo for what?
        // add new div
        const otherFuncs = genSmartHtmlOther(processConfig.id);
        otherFuncs.genColumnNameSelectBox(processConfig);
    }
};

const showProcessSettings = async (procId) => {
    const [processConfig, _] = await getProcessConfigFromDB(procId);

    filterStore.setSelectedProcess(processConfig); // TODO remove later
    filterStore.setSelectedProcessConfig(new CfgProcess(processConfig));
    // filterStore.setFilterColumnsData(filterColumnData);
    // // TODO set column data
    const cfgProcess = filterStore.getSelectedProcessConfig();

    if (!isEmpty(processConfig)) {
        // show line setting
        const lineCfgFuncs = filterCfgGenerator(htmlCardId.LINE, filterTypes.LINE);
        lineCfgFuncs.genEvents();
        lineCfgFuncs.showLineSetting(processConfig, cfgProcess).then(() => {
            addAttributeToElement($(lineCfgFuncs.eles.thisCard));
        });

        // show machine setting
        const machineCfgFuncs = filterCfgGenerator(htmlCardId.MACHINE_ID, filterTypes.MACHINE_ID);
        machineCfgFuncs.genEvents();
        machineCfgFuncs.showMachineSetting(processConfig).then(() => {
            addAttributeToElement($(machineCfgFuncs.eles.thisCard));
        });

        // show partno setting
        const partnoFuncs = filterCfgGenerator(htmlCardId.PART_NO, filterTypes.PART_NO);
        partnoFuncs.genEvents();
        partnoFuncs.showPartnoSetting(processConfig).then(() => {
            addAttributeToElement($(partnoFuncs.eles.thisCard));
        });

        // show other filter settings
        loadFilterOthers(processConfig);
        collapseConfig();
    }
};


$(() => {
    $('html, body').animate({ scrollTop: 0 }, 'slow');

    filterElements.btnShowAllSettings.click(() => {
        hideAlertMessages();
        // hide loading screen
        const loading = $('.loading');
        loading.show();
        filterElements.detailCards.css('display', 'none');

        // update process id
        const currentProcessId = filterElements.processList.val() || '';
        filterStore.setSelectedProcessId(currentProcessId);

        if (!isEmpty(currentProcessId)) {
            showProcessSettings(currentProcessId).then(() => {
                loading.hide();
                filterElements.detailCards.css('display', 'unset');
            });
        } else {
            loading.hide();
        }

        // drag & drop for tables
        $('table[id]>tbody').sortable({
            helper: dragDropRowInTable.fixHelper,
            update: updateOrder,
        });
    });

    $(filterElements.divLineConfig)[0].addEventListener('contextmenu', baseRightClickHandler, false);
    $(filterElements.divLineConfig)[0].addEventListener('mouseup', handleMouseUp, false);
    $(filterElements.divMachineConfig)[0].addEventListener('contextmenu', baseRightClickHandler, false);
    $(filterElements.divMachineConfig)[0].addEventListener('mouseup', handleMouseUp, false);
    $(filterElements.divPartnoConfig)[0].addEventListener('contextmenu', baseRightClickHandler, false);
    $(filterElements.divPartnoConfig)[0].addEventListener('mouseup', handleMouseUp, false);
    $(filterElements.divOtherConfig).each(function () {
        this.addEventListener('contextmenu', baseRightClickHandler, false);
        this.addEventListener('mouseup', handleMouseUp, false);
    });

    // Search filter table table
    onSearchTableContent('searchLineFilter', 'tblConfigline');
    onSearchTableContent('searchPartNoFilter', 'tblConfigpartno');
    onSearchTableContent('searchMachineFilter', 'tblConfig_machine');
    onSearchTableContent('searchOther1Filter', 'tblConfigfilter-other01');
});

// update order of tr when drag drop
const updateOrder = (event) => {
    const tblBody = event.target;
    const processId = $(`#${filterElements.processListId}`).val();
    dragDropRowInTable.setItemLocalStorage(tblBody, processId);
    updateTableRowNumber(null, null, tblBody);
};
