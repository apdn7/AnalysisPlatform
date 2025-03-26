const htmlCardId = {
    LINE: 'line',
    MACHINE_ID: '_machine',
    PART_NO: 'partno',
    FILTER_OTHER: 'filter-other',
};

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
    const json = await fetch(`/ap/api/setting/proc_filter_config/${procId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    }).then((response) => response.clone().json());
    return [json.data, json.filter_col_data];
};

const loadFilterOthers = async (processConfig) => {
    // there is no filter flag
    let noneFilterFlg = true;

    // delete all filter-other XX
    $(`${filterElements.filterOthers}`).remove();
    filterElements.filterTemplate.hide();

    const cfgProcess = filterStore.getSelectedProcessConfig();

    const { filters } = processConfig;
    await filters.forEach(async (filterConfig) => {
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
    if (noneFilterFlg) {
        // todo for what?
        // add new div
        const otherFuncs = genSmartHtmlOther(processConfig.id);
        otherFuncs.genColumnNameSelectBox(processConfig);
    }
};

const showProcessSettings = async (procId) => {
    const [processConfig, _] = await getProcessConfigFromDB(procId);

    filterStore.setSelectedProcess(processConfig); // TODO remove later
    filterStore.setSelectedProcessConfig(new CfgProcess(processConfig));

    const cfgProcess = filterStore.getSelectedProcessConfig();

    if (!isEmpty(processConfig)) {
        // show line setting
        const lineCfgFuncs = filterCfgGenerator(htmlCardId.LINE, filterTypes.LINE);
        lineCfgFuncs.genEvents();
        await lineCfgFuncs.showLineSetting(processConfig, cfgProcess);
        addAttributeToElement($(lineCfgFuncs.eles.thisCard));

        // show machine setting
        const machineCfgFuncs = filterCfgGenerator(htmlCardId.MACHINE_ID, filterTypes.MACHINE);
        machineCfgFuncs.genEvents();
        await machineCfgFuncs.showMachineSetting(processConfig);
        addAttributeToElement($(machineCfgFuncs.eles.thisCard));

        // show partno setting
        const partnoFuncs = filterCfgGenerator(htmlCardId.PART_NO, filterTypes.PART_NO);
        partnoFuncs.genEvents();
        await partnoFuncs.showPartnoSetting(processConfig);
        addAttributeToElement($(partnoFuncs.eles.thisCard));

        // show other filter settings
        await loadFilterOthers(processConfig);
        collapseConfig();
    }
};

$(() => {
    $('html, body').animate({ scrollTop: 0 }, 'slow');

    filterElements.processList.change(async (e) => {
        const currentProcessId = $(e.currentTarget).val() || '';
        hideAlertMessages();
        // hide loading screen
        const loading = $('.loading');
        loading.show();
        filterElements.detailCards.css('display', 'none');

        // update process id
        filterStore.setSelectedProcessId(currentProcessId);

        if (!isEmpty(currentProcessId)) {
            await showProcessSettings(currentProcessId);
            loading.hide();
            filterElements.detailCards.css('display', 'unset');
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

    // show load settings menu
    handleLoadSettingBtns();
});

// update order of tr when drag drop
const updateOrder = (event) => {
    const tblBody = event.target;
    const processId = $(`#${filterElements.processListId}`).val();
    dragDropRowInTable.setItemLocalStorage(tblBody, processId);
    updateTableRowNumber(null, null, tblBody);
};
