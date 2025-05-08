const HTTP_RESPONSE_CODE_500 = 500;
const SAMPLE_DATA_KEY = 'sample_data';
const FALSE_VALUES = new Set(['', 0, '0', false, 'false', 'FALSE', 'f', 'F']);
// current selected process id, data source and table name
let procModalCurrentProcId = null;
const currentProcessTableName = null;
const currentProcessDataSource = null;
let currentAsLinkIdBox = null;
let currentProcColumns = null;
let currentProcDataCols = [];
let userEditedProcName = false;
let userEditedDSName = false;
let prcPreviewData;

let prcRawDataWith1000Data = {};
let prcPreviewWith1000Data = {};
let prcPreviewDataOfFunctionColumn = {};
let isClickPreview = false;
let isClickPreviewMergeMode = false;
let allProcessColumns = [];
let currentLatestProcDataCols = [];
let errCells = [];
let dataGroupType = {};
let checkOnFocus = true;
let currentProcessId = null;
let currentProcess = null;
let currentProcessName = null;
let currentProcessNameLocal = null;
let procDsSelected = null;
let childProcData = null;
let baseProcObj = null;
let baseProcDataCols = null;
const DATA_IGNORE_CHANGE = 'ignore_change';

const procModalElements = {
    procModal: $('#procSettingModal'),
    procMergeModeModal: $('#procSettingMergeModeModal'),
    procModalBody: $('#procSettingModalBody'),
    procPreviewSection: $('#procPreviewSection'),
    procSettingContent: $('#procSettingContent'),
    proc: $('#procSettingModal input[name=processName]'),
    procNameMergeMode: $('#procSettingMergeModeModal input[name=processName]'),
    procJapaneseName: $('#procSettingModal input[name=processJapaneseName]'),
    procLocalName: $('#procSettingModal input[name=processLocalName]'),
    comment: $('#procSettingModal input[name=cfgProcComment]'),
    isShowFileName: $('#procSettingModal input[name=isShowFileName]'),
    databases: $('#procSettingModal select[name=databaseName]'),
    databasesMergeMode: $('#procSettingMergeModeModal select[name=databaseName]'),
    mergeProcComment: $('#procSettingMergeModeModal input#mergeProcComment'),
    tables: $('#procSettingModal select[name=tableName]'),
    optionalFunctions: $('#procSettingModal select[name=cfgOptionalFunction]'),
    childOptionalFunctions: $('#mergeModeModalBody select[name=cfgOptionalFunctionChild]'),
    showRecordsBtn: $('#procSettingModal button[name=showRecords]'),
    etlFuncWarningMark: $('#procSettingModal #optional-func-warning-mark'),
    childEtlFuncWarningMark: $('#mergeModeModalBody #optional-func-warning-mark'),
    btnFuncWarningMark: $('.btn-warning-mark'),
    showPreviewBtnToMerge: $('#procSettingMergeModeModal button[name=showRecords]'),
    latestDataHeader: $('#procSettingModal table[name=latestDataTable] thead'),
    latestDataBody: $('#procSettingModal table[name=latestDataTable] tbody'),
    processColumnsTableBody: $('#procSettingModal table[name=processColumnsTable] tbody'),
    processColumnsTable: $('#procSettingModal table[name=processColumnsTable]'),
    processColumnsSampleDataTable: $('#procSettingModal table[name=processColumnsTableSampleData]'),
    processColumnsSampleDataTableBody: $('#procSettingModal table[name=processColumnsTableSampleData] tbody'),
    processColumnsTableId: 'processColumnsTable',
    okBtn: $('#procSettingModal button[name=okBtn]'),
    mergeModeConfirmtBtn: $('#procSettingMergeModeModal button[name=okBtn]'),

    // init initial process
    initializeProcessBtn: $('button[name="initializeProcess"]'),
    confirmInitializeModal: '#confirmInitializedProcess',
    confirmInitializeProcBtn: 'button[name="initProcConfirm"]',

    reRegisterBtn: $('#procSettingModal button[name=reRegisterBtn]'),
    confirmImportDataBtn: $('#confirmImportDataBtn'),
    confirmReRegisterProcBtn: $('#confirmReRegisterProcBtn'),
    revertChangeAsLinkIdBtn: $('#revertChangeAsLinkIdBtn'),
    confirmImportDataModal: $('#confirmImportDataModal'),
    confirmReRegisterProcModal: $('#confirmReRegisterProcModal'),
    warningResetDataLinkModal: $('#warningResetDataLinkModal'),
    procConfigConfirmSwitchModal: $('#procConfigConfirmSwitchModal'),
    totalColumns: $('#totalColumns'),
    totalCheckedColumns: $('#totalCheckedColumn'),
    totalCheckedColumnsContent: $('.total-checked-columns'),
    searchInput: $('#processConfigModalSearchInput'),
    searchSetBtn: $('#processConfigModalSetBtn'),
    searchResetBtn: $('#processConfigModalResetBtn'),
    confirmDataTypeModal: '#confirmChangeKSepDataTypeModal',
    confirmNullValue: '#confirmNullValueInColumnModal',
    confirmSameValue: '#confirmSameValueInColumnModal',
    confirmMergeMode: '#confirmMergeModeModal',
    removeFuncInputSearch: '.function-remove-search',
    dateTime: 'dateTime',
    serial: 'serial',
    mainSerial: 'mainSerial',
    order: 'order',
    dataType: 'dataType',
    auto_increment: 'auto_increment',
    columnName: 'columnName',
    columnRawName: 'columnRawName',
    englishName: 'englishName',
    systemName: 'systemName',
    shownName: 'shownName',
    japaneseName: 'japaneseName',
    localName: 'localName',
    unit: 'unit',
    operator: 'operator',
    coef: 'coef',
    lineName: 'lineName',
    lineNo: 'lineNo',
    equiptName: 'equiptName',
    equiptNo: 'equiptNo',
    partName: 'partName',
    partNo: 'partNo',
    judgeNo: 'judgeNo',
    intCat: 'intCat',
    columnType: 'columnType',
    procsMasterName: 'processName',
    procsMasterInfo: 'procInfo',
    procsComment: 'comment',
    procsdbName: 'databaseName',
    procsTableName: 'tableName',
    isDummyDatetime: 'isDummyDatetime',
    isFileName: 'isFileName',
    columnNameInput: '#procSettingModal table[name=processColumnsTable] input[name="columnName"]',
    systemNameInput: '#procSettingModal table[name=processColumnsTable] input[name="systemName"]',
    masterNameInput: '#procSettingModal table[name=processColumnsTable] input[name="shownName"]',
    latestDataTable: $('#procSettingModal table[name=latestDataTable]'),
    msgProcNameAlreadyExist: '#i18nAlreadyExist',
    msgProcNameBlank: '#i18nProcNameBlank',
    msgGenDateTime: '#i18nGenDateTimeNotification',
    msgSelectDateAndTime: '#i18nRequestSelectDateAndTime',
    msgModal: '#msgModal',
    msgContent: '#msgContent',
    msgConfirmBtn: '#msgConfirmBtn',
    selectAllSensor: '#selectAllSensor',
    alertMessage: '#alertMsgProcessColumnsTable',
    alertProcessNameErrorMsg: '#alertProcessNameErrorMsg',
    alertErrMsgContent: '#alertProcessNameErrorMsg-content',
    selectAllColumn: '#selectAllColumn',
    procID: $('#procSettingModal input[name=processID]'),
    dsID: $('#procSettingModal input[name=processDsID]'),
    formId: '#procCfgForm',
    mergeProcFormId: '#mergeProcForm',
    changeModeBtn: '#prcEditMode',
    confirmSwitchButton: '#confirmSwitch',
    procSettingModalDownloadAllBtn: '#procSettingModalDownloadAllBtn',
    procSettingModalCopyAllBtn: 'copyProcessConfig',
    procSettingModalPasteAllBtn: 'pasteProcessConfig',
    settingContent: '#procSettingContent',
    prcSM: '#prcSM',
    autoSelectAllColumn: '#autoSelectAllColumn',
    refactorProcSetting: '#refactorProcSetting',
    autoSelect: '#autoSelect',
    checkColsContextMenu: '#checkColsContextMenu',
    createOrUpdateProcCfgBtn: $('#createOrUpdateProcCfgBtn'),
    createMergeProcCfgBtn: $('#createOrUpdateChildProcCfgBtn'),
    dbTableList: '#dbTableList',
    grTableDropdown: '.group-table-dropdown',
    fileInputPreview: '#fileInputPreview',
    fileName: $('#procSettingModal input[name=fileName]'),
    dataGroupTypeClassName: 'data-type-selection',
    dataTypeSelection: 'dataTypeSelection',
    sampleDataColumnClassName: 'sample-data-column',
    mainDate: 'mainDate',
    mainTime: 'mainTime',
    procDateTimeFormatCheckbox: $('#procDateTimeFormatCheckbox input[name="toggleProcDatetimeFormat"]'),
    procDateTimeFormatInput: $('#procDateTimeFormatInput input[name="procDatetimeFormat"]'),
    // Merge mode element
    parentProcessColumnsTableBody: '#procSettingMergeModeModal table[name=parentProcessCols] tbody',
    processColumnsMergeModeBaseTableBody: '#procSettingMergeModeModal table[name=processColumnsTableBaseData] tbody',
    processColumnsMergeModeChildTableBody: '#procSettingMergeModeModal table[name=processColumnsTableSampleData] tbody',
    processColumnsMergeModeChildTableRow:
        '#procSettingMergeModeModal table[name=processColumnsTableSampleData] tbody > tr',
    parentColumnSystemName: '.parent-column-system-name',
    processColumnsMergeModeTableBody: '#procSettingMergeModeModal table[name=processColumnsTable] tbody',
    processColumnsMergeModeTableSelectOption: '#procSettingMergeModeModal table[name=processColumnsTable] tbody select',
    mergeModeTableRow: '#mergeModeSettingContent table tr',
    mergeModeTableChild: '.merge-mode-tables-child',
    mergeModeTableBase: '.merge-mode-tables-base',
    mergeModeTables: $('#procSettingMergeModeModal select[name=childTableName]'),
    mergeModeInputComment: $('#procSettingMergeModeModal input[name=cfgProcComment]'),
    mergeProcSearchInput: $('#procSettingMergeModeModal input#mergeProcSearchInput'),
    generatedDateTimeColumnName: 'DatetimeGenerated',
    collapseFunctionConfigID: '#functionSettingWithCollapse',
    alertReferenceFileErrorID: '#alertReferenceFileErrorMsg',
    alertProcessConfigErrorID: '#alertProcessConfigErrorMsg',
    alertProcessConfigMergeModeErrorMsg: '#alertProcessConfigMergeModeErrorMsg',
    // Import condition
    importConditionArea: '#importConditionArea',
    procConfigTableName: 'processColumnsTable',
    /**
     * In first load, i element will be changed to svg element
     * @type {function(): HTMLOrSVGElement}
     * */
    settingChangeMark: () => document.getElementById('procSettingChangeMark'),
};

const procModali18n = {
    emptyShownName: '#i18nEmptyShownName',
    useEnglishName: '#i18nUseEnglishName',
    noMasterName: '#validateNoMasterName',
    duplicatedSystemName: '#validateDuplicatedSystem',
    noEnglishName: '#validateNoEnglishName',
    msgErrorNoGetdate: '#i18nErrorNoGetdate',
    duplicatedJapaneseName: '#validateDuplicatedJapaneseName',
    duplicatedLocalName: '#validateDuplicatedLocalName',
    duplicatedMasterName: '#validateDuplicatedMaster',
    noZeroCoef: '#validateCoefErrMsgNoZero',
    emptyCoef: '#validateCoefErrMsgEmptyCoef',
    needOperator: '#validateCoefErrMsgNeedOperator',
    settingMode: '#filterSettingMode',
    editMode: '#filterEditMode',
    copyToAllBelow: '#i18nCopyToAllBelow',
    i18nMainDatetime: '#i18nMainDatetime',
    i18nMainSerialInt: '#i18nMainSerialInt',
    i18nMainSerialStr: '#i18nMainSerialStr',
    i18nDatetimeKey: '#i18nDatetimeKey',
    i18nSerialInt: '#i18nSerialInt',
    i18nSerialStr: '#i18nSerialStr',
    i18nLineNameStr: '#i18nLineNameStr',
    i18nLineNoInt: '#i18nLineNoInt',
    i18nEqNameStr: '#i18nEqNameStr',
    i18nEqNoInt: '#i18nEqNoInt',
    i18nPartNameStr: '#i18nPartNameStr',
    i18nPartNoInt: '#i18nPartNoInt',
    i18nStNoInt: '#i18nStNoInt',
    i18nJudgeNo: '#i18nJudgeNo',
    i18nCopyToFiltered: '#i18nCopyToFiltered',
    i18nColumnRawName: '#i18nColumnRawName',
    i18nJapaneseName: '#i18nJapaneseName',
    i18nLocalName: '#i18nLocalName',
    i18nUnit: '#i18nUnit',
    i18nSampleData: '#i18nSampleData',
    i18nSpecial: '#i18nSpecial',
    i18nFilterSystem: '#i18nFilterSystem',
    i18nMultiset: '#i18nMultiset',
    i18nDatatype: '#i18nDatatype',
    noDatetimeCol: $('#i18nNoDatetimeCol').text(),
    i18nMainDate: '#i18nMainDate',
    i18nMainTime: '#i18nMainTime',
    i18nRealSep: $('#' + DataTypes.REAL_SEP.i18nLabelID).text(),
    i18nIntSep: $('#' + DataTypes.INTEGER_SEP.i18nLabelID).text(),
    i18nEuRealSep: $('#' + DataTypes.EU_REAL_SEP.i18nLabelID).text(),
    i18nEuIntSep: $('#' + DataTypes.EU_INTEGER_SEP.i18nLabelID).text(),
    i18nDataTypeMainDatetimeHover: '#i18nDataTypeMainDatetimeHover',
    i18nDatatypeMainDateHover: '#i18nDatatypeMainDateHover',
    i18nDataTypeMainTimeHover: '#i18nDataTypeMainTimeHover',
    i18nDataTypeMainSerialIntHover: '#i18nDataTypeMainSerialIntHover',
    i18nDataTypeMainSerialStringHover: '#i18nDataTypeMainSerialStringHover',
    i18nDataTypeDatetimeKeyHover: '#i18nDataTypeDatetimeKeyHover',
    i18nDataTypeSerialIntHover: '#i18nDataTypeSerialIntHover',
    i18nDataTypeSerialStringHover: '#i18nDataTypeSerialStringHover',
    i18nDataTypeLineNameStrHover: '#i18nDataTypeLineNameStrHover',
    i18nDataTypeLineNoIntHover: '#i18nDataTypeLineNoIntHover',
    i18nDataTypeEqNameStrHover: '#i18nDataTypeEqNameStrHover',
    i18nDataTypeEqNoIntHover: '#i18nDataTypeEqNoIntHover',
    i18nDataTypePartNameStrHover: '#i18nDataTypePartNameStrHover',
    i18nDataTypePartNoIntHover: '#i18nDataTypePartNoIntHover',
    i18nDataTypeStNoIntHover: '#i18nDataTypeStNoIntHover',
    i18nDataTypeJudgeHover: '#i18nDataTypeJudgeHover',
    i18nCheckIsMainSerialMsg: '#i18nCheckIsMainSerialMsg',
    i18nChangeMainSerialFunctionColumnMsg: '#i18nChangeMainSerialFunctionColumnMsg',
    i18nInvalidFilePathMessage: '#i18nInvalidFilePathMsg',
    i18nInitializeProcessSuccess: $('#i18nInitializeProcessSuccess').text(),
    i18nInitializeProcessError: $('#i18nInitializeProcessError').text(),
};

const COLUMN_IS_CHECKED_NAME = 'is_checked';

// If you add new column to this.
// Please keep this order in sync with `genProcessColumnTable()`
const PROCESS_COLUMNS = {
    id: 'id',
    process_id: 'process_id',
    column_name: 'column_name',
    is_checked: COLUMN_IS_CHECKED_NAME,
    column_raw_name: 'column_raw_name',
    data_type: 'data_type',
    shown_data_type: 'shown_data_type',
    column_type: 'column_type',
    name_en: 'name_en',
    name_jp: 'name_jp',
    name_local: 'name_local',
    unit: 'unit',
    raw_data_type: 'raw_data_type',
    is_serial_no: 'is_serial_no',
    is_get_date: 'is_get_date',
    is_file_name: 'is_file_name',
    is_auto_increment: 'is_auto_increment',
    is_dummy_datetime: 'is_dummy_datetime',
    is_generated_datetime: 'is_generated_datetime',
    is_null: 'is_null',
};

const isJPLocale = docCookies.isJaLocale();
const translateToEng = async (text) => {
    const result = await fetchData('/ap/api/setting/to_eng', JSON.stringify({ colname: text }), 'POST');
    return result;
};

const setProcessName = (dataRowID = null) => {
    const procDOM = $(`#tblProcConfig tr[data-rowid=${dataRowID}]`);
    const procNameInput = procModalElements.proc.val();
    const ignoreRenameProcess = procModalElements.optionalFunctions.data(DATA_IGNORE_CHANGE);

    if (userEditedProcName && procNameInput) {
        procModalElements.showRecordsBtn.trigger('click');
        return;
    }
    const dsSelection = getSelectedOptionOfSelect(procModalElements.databases);
    const dsNameSelection = dsSelection.text();

    const tableNameTemp = getSelectedOptionOfSelect(procModalElements.tables).text();
    const tableNameSelection = tableNameTemp === '---' ? '' : tableNameTemp;

    // get setting information from outside card
    const settingProcName = procDOM.find('input[name="processName"]')[0];
    // const settingDSName = procDOM.find('select[name="databaseName"]')[0];
    const settingTableName = procDOM.find('select[name="tableName"]')[0];

    // add new proc row
    let firstGenerated = false;
    if (dataRowID && settingProcName && !procNameInput) {
        procModalElements.proc.val($(settingProcName).val());

        if (isJPLocale) {
            procModalElements.procJapaneseName.val($(settingProcName).val());
        } else {
            procModalElements.procLocalName.val($(settingProcName).val());
        }
        firstGenerated = true;
    }

    // when user change ds or table, and empty process name
    // || !userEditedProcName
    // if (!procModalElements.proc.val()) {
    // if (!userEditedProcName) {
    if (
        (!ignoreRenameProcess && !firstGenerated && !userEditedProcName) ||
        (!ignoreRenameProcess && !procModalElements.proc.val())
    ) {
        let firstTableName = '';
        if (tableNameSelection) {
            firstTableName = tableNameSelection;
        } else if (settingTableName) {
            firstTableName = $(settingTableName).val();
        }
        let combineProcName = firstTableName ? `${dsNameSelection}_${firstTableName}` : dsNameSelection;
        currentProcessName = combineProcName;
        currentProcessNameLocal = 'en';
        // set default jp and local process name
        if (isJPLocale) {
            procModalElements.procJapaneseName.val(combineProcName);
        } else {
            procModalElements.procLocalName.val(combineProcName);
        }

        translateToEng(combineProcName).then((res) => {
            if (res.data) {
                procModalElements.proc.val(res.data);
            } else {
                procModalElements.proc.val(combineProcName);
            }
        });
    }

    const selectedDsType = dsSelection.attr('type') || null;
    const dsIsDB = selectedDsType && !['V2', 'CSV'].includes(selectedDsType);

    // enable click preview btn when db + dataTable is chosen
    if (!procModalCurrentProcId && dsIsDB && dsNameSelection && tableNameSelection) {
        procModalElements.showRecordsBtn.trigger('click');
    }

    // enable click preview btn when ds is chosen
    if (!procModalCurrentProcId && !dsIsDB && dsNameSelection) {
        // remove selected table
        // $(`table[name=${procModalElements.processColumnsTable}] tbody`).empty();
        procModalElements.showRecordsBtn.trigger('click');
    }
};

// reload tables after change
const loadTables = (databaseId, dataRowID = null, selectedTbl = null) => {
    // if new row have process name, set new process name in modal
    if (!databaseId || isEmpty(databaseId)) {
        setProcessName(dataRowID);
        return;
    }
    procModalElements.tables.empty();
    propGroupTableDropdown(false);
    clearProcModalColumnTable(procModalElements.procConfigTableName);

    const isHiddenFileInput = $(procModalElements.fileInputPreview).hasClass('hide');
    const isHiddenDbTble = $(procModalElements.grTableDropdown).hasClass('hide');

    $.ajax({
        url: `api/setting/database_table/${databaseId}`,
        method: 'GET',
        cache: false,
    }).done((res) => {
        if (['v2', 'csv'].includes(res.ds_type.toLowerCase())) {
            procModalElements.tables.empty();
            propGroupTableDropdown(true);
            if (!procModalCurrentProcId) {
                // new process, should enable file name
                resetIsShowFileName();
                setProcessName(dataRowID);
            }
            // hide 'table' dropdown if there is CSV datasource
            if (isHiddenFileInput) {
                toggleDBTableAndFileName();
            }
        } else if (res.tables) {
            disableIsShowFileName();
            loadTableNameSelectOptions(res, selectedTbl, procModalElements.tables);

            if (!selectedTbl) {
                procModalElements.tables.val('');
            }

            if (!procModalCurrentProcId) {
                setProcessName(dataRowID);
            }
            // hide 'fileName' input if there is DB datasource
            if (isHiddenDbTble) {
                toggleDBTableAndFileName();
            }
        }
    });
};

const loadMergeModeTables = async (databaseId, dataRowID = null, selectedTbl = null) => {
    procModalElements.mergeModeTables.empty().prop('disabled', false);
    procModalElements.childOptionalFunctions.prop('disabled', false);
    if (!databaseId || isEmpty(databaseId)) {
        return;
    }
    const url = `api/setting/database_table/${databaseId}`;
    const res = await fetchData(url, {}, 'GET');

    if (!res.tables) return;
    if (!['v2', 'csv'].includes(res.ds_type.toLowerCase()) && res.tables) {
        loadTableNameSelectOptions(res, selectedTbl, procModalElements.mergeModeTables);
    } else {
        procModalElements.mergeModeTables.empty().prop('disabled', true);
        procModalElements.childOptionalFunctions.val('').prop('disabled', true);
    }
    if (!selectedTbl) {
        procModalElements.mergeModeTables.val('');
    }
};

const loadTableNameSelectOptions = (data, optSelected, elemTbl) => {
    const isSoftwareWorkshop = data.ds_type === DB_CONFIGS.SOFTWARE_WORKSHOP.configs.type;
    const processFactIds = data.process_factids;
    const masterTypes = data.master_types;
    data.tables.forEach(function (tbl, index) {
        const options = {
            value: tbl,
            text: tbl,
            process_fact_id: isSoftwareWorkshop ? processFactIds[index] : '',
            master_type: isSoftwareWorkshop ? masterTypes[index] : '',
        };
        if (optSelected && tbl === optSelected) {
            options.selected = 'selected';
        }
        elemTbl.append($('<option/>', options));
    });
};

const toggleDBTableAndFileName = () => {
    $(procModalElements.grTableDropdown).toggleClass('hide');
    $(procModalElements.fileInputPreview).toggleClass('hide');
};
// load current proc name, database name and tables name

const loadProcModal = async (procId = null, dataRowID = null, dbsId = null) => {
    // set current proc
    procModalCurrentProcId = procId;

    // load databases
    const dbInfo = await getAllDatabaseConfig();

    if (dbInfo) {
        procModalElements.databases.html('');
        let selectedDs = null;
        let selectedTbls = null;
        if (dataRowID) {
            const procDOM = $(`#tblProcConfig tr[data-rowid=${dataRowID}]`);
            const settingDSName = procDOM.find('select[name="databaseName"]')[0];
            const settingTableName = procDOM.find('select[name="tableName"]')[0];

            selectedDs = settingDSName ? $(settingDSName).val() : null;
            selectedTbls = settingTableName ? $(settingTableName).val() : null;
        }
        const currentDs = procModalElements.dsID.val() || dbsId || selectedDs;
        dbInfo.forEach((ds) => {
            const options = {
                type: ds.type,
                value: ds.id,
                text: ds.name,
                title: ds.en_name,
            };
            if (currentDs && ds.id === Number(currentDs)) {
                options.selected = 'selected';
            }
            procModalElements.databases.append($('<option/>', options));
        });

        if (!currentDs) {
            procModalElements.databases.val('');
        }

        const selectedDbInfo = dbInfo.filter((db) => Number(db.id) === Number(currentDs))[0];

        // hide 'table' dropdown if there is CSV datasource
        const isHiddenFileInput = $(procModalElements.fileInputPreview).hasClass('hide');
        const isHiddenDbTble = $(procModalElements.grTableDropdown).hasClass('hide');
        const isCSVDS = selectedDbInfo && ['v2', 'csv'].includes(selectedDbInfo.type.toLowerCase());
        if ((isCSVDS && isHiddenFileInput) || (!isCSVDS && isHiddenDbTble)) {
            toggleDBTableAndFileName();
        }

        // do not enable isShowFileName for non csv-v2 data sources
        if (!isCSVDS) {
            disableIsShowFileName();
        }

        // load default tables
        if (procId) {
            // process is imported, disable procModalElements datasources selection
            procModalElements.databases.prop('disabled', true);
            return;
        }
        procModalElements.databases.prop('disabled', false);

        if (currentDs) {
            if (
                ![DB.DB_CONFIGS.CSV.type.toLowerCase(), DB.DB_CONFIGS.V2.type.toLowerCase()].includes(
                    selectedDbInfo.type.toLowerCase(),
                ) ||
                dbsId
            ) {
                const defaultDSID = selectedDs || selectedDbInfo.id;
                loadTables(defaultDSID, dataRowID, selectedTbls);
            } else {
                procModalElements.databases.trigger('change');
            }
        } else {
            procModalElements.tables.append(
                $('<option/>', {
                    value: '',
                    text: '---',
                }),
            );

            propGroupTableDropdown(true);
            const dataRowId = currentProcItem.attr('data-rowid');
            setProcessName(dataRowId);
            // gen header of spead table
            SpreadSheetProcessConfig.create(procModalElements.procConfigTableName, []);
        }
    }

    addAttributeToElement();
};

const getColDataType = (colName) => {
    return dicOriginDataType[colName] || '';
};

// --- B-Sprint36+80 #5 ---
const storePreviousValue = (element) => {
    element.previousValue = element.value;
};
// --- B-Sprint36+80 #5 ---

const clearProcModalColumnTable = (tableId) => {
    // remove old table
    const spreadsheet = spreadsheetProcConfig(tableId);
    spreadsheet.table.destroyTable();
};

const generateProcessList = async (
    tableId,
    cols,
    rows,
    { fromRegenerate = false, autoCheckSerial = false, registerByFile = false } = {},
) => {
    clearProcModalColumnTable(tableId);
    if (!cols || !cols.length) {
        return;
    }

    if (!fromRegenerate && Object.values(dicProcessCols).length) {
        // reassign column_type
        cols = cols.map((col) => {
            const columnRawName = dicProcessCols[col.column_name]
                ? dicProcessCols[col.column_name]['column_raw_name'] || col['column_raw_name']
                : col['column_raw_name'];
            return {
                ...col,
                ...dicProcessCols[col.column_name],
                column_raw_name: columnRawName,
            };
        });
    }

    // sort columns by column_type
    let sortedCols = [...cols];

    const isRegisterProc = !_.isEmpty(dicProcessCols);

    if (isRegisterProc) {
        const hasDummyDatetime = Object.values(dicProcessCols).some((proc) => proc.column_raw_name === 'DatetimeDummy');

        if (!hasDummyDatetime) {
            Object.keys(sortedCols).forEach((col) => {
                if (sortedCols[col].column_raw_name === 'DatetimeDummy') {
                    delete sortedCols[col];
                }
            });
        }

        const resetOrder = Object.entries(sortedCols).reduce((col, [_, value], index) => {
            col[index] = value;
            return col;
        }, {});

        sortedCols = Object.values(resetOrder);
    }

    // const sortedCols = [...cols].sort((a, b) => { return a.column_type - b.column_type});
    // if (fromRegenerate && JSON.stringify(cols) === JSON.stringify(sortedCols) && !force) return;

    let hasMainSerialCol = false;

    // case rows = [] -> no data for preview
    if (rows.length == 0) {
        rows = Array(10).fill({});
    }

    const colTypes = [];
    let checkedTotal = 0;

    // TODO: check generated datetime
    const generatedDateTime = (key) => rows.some((obj) => Object.keys(obj).includes(key));
    if (generatedDateTime(procModalElements.generatedDateTimeColumnName)) {
        updateGeneratedDateTimeSampleData(rows, sortedCols);
    }
    const dataRows = [];

    sortedCols = _.sortBy(sortedCols, (item) =>
        item.shown_name === procModalElements.generatedDateTimeColumnName ? 0 : 1,
    );

    sortedCols.forEach((col, i) => {
        const column_raw_name = col.column_raw_name;
        const isGeneratedDatetime = column_raw_name === procModalElements.generatedDateTimeColumnName;
        // registerCol will be defined when the column already exists in the DB
        const registerCol = dicProcessCols[col.column_name];
        col = fromRegenerate ? col : registerCol || col;
        col.is_show = true;
        // col.id = registerCol ? registerCol.id : i;
        // for a new process, check for is_checked variable (is_checked is only present in unregistered column)
        // for a registered process, check if it exists in the DB
        col.is_checked = registerCol !== undefined;
        // col.is_checked !== undefined ? col.is_checked : !!registerCol;
        if (!col.name_en) {
            col.name_en = col.romaji;
        }
        if (!col.column_raw_name) {
            col.column_raw_name = column_raw_name;
        }
        // check valid columns if add new process also
        if (col.is_checked) {
            checkedTotal++;
        }
        // convert column type for new process because get columns from latest record
        if (col.id < 0) {
            if (col.is_get_date) {
                col.column_type = masterDataGroup.MAIN_DATETIME;
            } else if (col.is_main_serial_no) {
                col.column_type = masterDataGroup.MAIN_SERIAL;
                col.is_serial_no = true;
            } else if (col.is_serial_no) {
                col.column_type = masterDataGroup.SERIAL;
            }
        }
        if (!col.raw_data_type) {
            col.raw_data_type = col.data_type;
        }

        // convert column_type to attr key
        col = {
            ...col,
            shown_data_type: DataTypeDropdown_Controller.convertColumnTypeAndDataTypeToShownDataType(
                col.column_type,
                col.raw_data_type,
            ),
            is_generated_datetime: isGeneratedDatetime,
            is_null: col.check_same_value ? col.check_same_value.is_null : false,
        };

        colTypes.push(DataTypes[col.raw_data_type].value);

        const dataTypeObject = {
            ...col,
            value: col.raw_data_type,
            isRegisteredCol: !!registerCol,
            isRegisterProc,
            is_main_date: col.column_type === DataTypeDropdown_Controller.DataGroupType.MAIN_DATE,
            is_main_time: col.column_type === DataTypeDropdown_Controller.DataGroupType.MAIN_TIME,
        };
        let getKey = '';
        for (const attr of DataTypeAttrs) {
            if (dataTypeObject[attr]) {
                getKey = attr;
                break;
            }
        }

        const sampleDatas = rows.map((row) => row[col.column_name]);

        const row = {};
        for (const columnName in PROCESS_COLUMNS) {
            row[columnName] = dataTypeObject[columnName];
        }
        sampleDatas.forEach((data, index) => {
            row[`${SAMPLE_DATA_KEY}_${index + 1}`] = data;
        });
        dataRows.push(row);
    });
    const spreadsheet = SpreadSheetProcessConfig.create(tableId, dataRows, { registerByFile });
    spreadsheet.table.takeSnapshotForTracingChanges(SpreadSheetProcessConfig.trackingHeaders());
    // Need this check, so we can know whether we should show change mark for new process.
    spreadsheet.handleChangeMark();

    parseEUDataTypeInFirstTimeLoad();

    if (!fromRegenerate) {
        showConfirmSameAndNullValueInColumn(sortedCols);
        showConfirmKSepDataModal(colTypes);
    }
    handleScrollSampleDataTable(tableId);
    handleHoverProcessColumnsTableRow();
    validateSelectedColumnInput();
    await showProcDatetimeFormatSampleData(spreadsheet);
    // resizeMaxHeightProcColumnTable();

    if (typeof inputMutationObserver !== 'undefined') {
        // inject events for process table's input
        inputMutationObserver.injectEvents();
    }
};

const updateGeneratedDateTimeSampleData = (rows, cols) => {
    const dateCol = cols.find((col) => col.data_type === DataTypes.DATE.name);
    const timeCol = cols.find((col) => col.data_type === DataTypes.TIME.name);
    rows.forEach((row) => {
        if (dateCol && timeCol && !row[procModalElements.generatedDateTimeColumnName]) {
            row[procModalElements.generatedDateTimeColumnName] =
                `${parseDatetimeStr(row[dateCol.column_name], true)} ${parseTimeStr(row[timeCol.column_name])}`;
        }
    });
};

const showTotalCheckedColumns = (ele, totalColumns, totalCheckedColumn) => {
    procModalElements.totalCheckedColumnsContent.show();
    const totalColumnsEle = getTotalColumnElementFromElement(ele);
    const totalCheckedColumnsEle = getTotalCheckedColumnElementFromElement(ele);
    totalColumnsEle.text(totalColumns);
    setTotalCheckedColumns(totalCheckedColumnsEle, totalCheckedColumn);
};

const setTotalCheckedColumns = (totalCheckedColumnsEle, totalCheckedColumns = 0) => {
    totalCheckedColumnsEle.text(totalCheckedColumns);
};

const setTotalColumns = (totalColumns = 0) => {
    procModalElements.totalColumns.text(totalColumns);
};

const cleanOldData = () => {
    // clear user editted input flag
    userEditedProcName = false;

    // clear old procInfo
    currentProcColumns = null;
    $(procModalElements.prcSM).html('');
    $(procModalElements.settingContent).removeClass('hide');
    $(procModalElements.prcSM).parent().addClass('hide');

    procModalElements.comment.val('');
    procModalElements.proc.val('');
    procModalElements.procLocalName.val('');
    procModalElements.procJapaneseName.val('');
    procModalElements.procID.val('');
    procModalElements.databases.html('');
    procModalElements.tables.html('');
    procModalElements.tables.prop('disabled', false);
    procModalElements.optionalFunctions.val('');
    procModalElements.optionalFunctions.prop('disabled', false);
    procModalElements.etlFuncWarningMark.hide();
    procModalElements.childEtlFuncWarningMark.hide();

    procModalElements.totalCheckedColumnsContent.hide();
    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
    procModalElements.fileName.val('');

    procModalElements.mergeModeInputComment.val('');
    procModalElements.mergeProcSearchInput.val('');

    procModalElements.procDateTimeFormatCheckbox.prop('checked', false);
    $(procModalElements.procDateTimeFormatInput).val('');
    $(procModalElements.alertReferenceFileErrorID).hide();
    $(procModalElements.alertProcessConfigErrorID).hide();
};

const parseDatetimeStr = (datetimeStr, dateOnly = false) => {
    datetimeStr = trimBoth(String(datetimeStr));
    datetimeStr = convertDatetimePreview(datetimeStr);
    const millis = checkDatetimeHasMilliseconds(datetimeStr);
    let formatStr = dateOnly ? DATE_FORMAT : DATE_FORMAT_TZ;
    if (millis && !dateOnly) {
        formatStr = DATE_FORMAT_WITHOUT_TZ + millis + ' Z';
    }

    datetimeStr = moment(datetimeStr);

    if (!datetimeStr._isValid) {
        return '';
    }
    return datetimeStr.format(formatStr);
};

const parseTimeStr = (timeStr) => {
    timeStr = trimBoth(String(timeStr));
    timeStr = convertDatetimePreview(timeStr);
    const millis = checkDatetimeHasMilliseconds(timeStr);
    let formatStr = TIME_FORMAT_TZ;
    if (millis) {
        formatStr = TIME_FORMAT_TZ + millis + ' Z';
    }
    // today
    _today = new Date();
    _today = _today.toISOString().split('T').shift();
    timeStr = moment(_today + ' ' + timeStr);
    if (!timeStr._isValid) {
        return '';
    }
    return timeStr.format(formatStr);
};

const showConfirmSameAndNullValueInColumn = (cols) => {
    if (currentProcItem.data('proc-id')) return;

    let isSame = false;
    let isNull = false;
    cols.forEach((col, i) => {
        if (!col.is_file_name && col.check_same_value.is_same && !col.check_same_value.is_null) {
            isSame = true;
        }

        if (col.check_same_value.is_null) {
            isNull = true;
        }
    });

    if (isNull) {
        $(procModalElements.confirmNullValue).modal('show');
    }

    if (isSame) {
        $(procModalElements.confirmSameValue).modal('show');
    }
};

const parseEUDataTypeInFirstTimeLoad = () => {
    $('.csv-datatype-selection').each((i, el) => {
        if (CfgProcess_CONST.EU_TYPE_VALUE.includes(Number(el.value))) {
            // change to trigger onclick li element
            // $(el).trigger('change');
            $(el).closest('.config-data-type-dropdown').find('li.active').trigger('click');
        }
    });
};

const showConfirmKSepDataModal = (types) => {
    if (types.includes(DataTypes.REAL_SEP.value) || types.includes(DataTypes.EU_REAL_SEP.value)) {
        $(procModalElements.confirmDataTypeModal).modal('show');

        // scroll to first this
        // const indexOfColumn = types.indexOf(DataTypes.REAL_SEP.value) !== -1 ? types.indexOf(DataTypes.REAL_SEP.value)
        //     : types.indexOf(DataTypes.EU_REAL_SEP.value);

        // const offsetLeft = procModalElements.latestDataHeader.find(`tr th:eq(${indexOfColumn})`).offset().left;
        // procModalElements.latestDataTable.parents().animate({ scrollLeft: offsetLeft });
    }
};

const validateFixedColumns = () => {
    if (isAddNewMode()) {
        return;
    }
    $(`table[name=processColumnsTable] input:checkbox[name="${procModalElements.dateTime}"]`).each(function disable() {
        $(this).attr('disabled', true);
        if ($(this).is(':checked')) {
            // disable serial as the same row
            $(this).closest('tr').find(`input:checkbox[name="${procModalElements.serial}"]`).attr('disabled', true);
        }
    });
    $(`table[name=processColumnsTable] input:checkbox[name="${procModalElements.auto_increment}"]`).each(
        function disable() {
            $(this).attr('disabled', true);
        },
    );
};

// validation checkboxes of selected columns
const validateCheckBoxesAll = () => {
    $(`table[name=processColumnsTable] input:checkbox[name="${procModalElements.serial}"]`).each(
        function validateSerial() {
            $(this).on('change', function f() {
                if ($(this).is(':checked')) {
                    // uncheck datetime at the same row
                    $(this)
                        .closest('tr')
                        .find(`input:checkbox[name="${procModalElements.dateTime}"]`)
                        .prop('checked', false);
                }

                // show warning about resetting trace config
                // todo check reset datalink for new GUI
                showResetDataLink($(this));
            });
        },
    );
};

const showResetDataLink = (boxElement) => {
    const currentProcId = procModalElements.procID.val() || null;
    if (!currentProcId) {
        return;
    }
    currentAsLinkIdBox = boxElement;
    $(procModalElements.warningResetDataLinkModal).modal('show');
};

const validateSelectedColumnInput = () => {
    validateCheckBoxesAll();
    handleEnglishNameChange($(procModalElements.systemNameInput));
    addAttributeToElement();
    validateFixedColumns();
    updateTableRowNumber(null, $('table[name=selectedColumnsTable]'));
};

const changeSelectionCheckbox = (autoSelect = true, selectAll = false) => {
    $(procModalElements.autoSelect).prop('checked', autoSelect);
    $(procModalElements.selectAllSensor).prop('checked', selectAll);
};

const updateSelectAllCheckbox = (tableId) => {
    if (renderedCols) {
        // update select all check box based on current selected columns
        const spreadsheet = spreadsheetProcConfig(tableId);
        const nonReadonlyRows = spreadsheet.nonReadonlyRows();
        const selectedAll = nonReadonlyRows.every((row) => row[PROCESS_COLUMNS.is_checked].data);

        // autoSelectedAll will be false if:
        // - at least one null row is checked
        // - at least one non-null row is not checked
        const autoSelectedAll = nonReadonlyRows.every((row) => {
            const isChecked = row[PROCESS_COLUMNS.is_checked].data;
            const isNull = row[PROCESS_COLUMNS.is_null].data;

            const nullRowIsChecked = isNull && isChecked;
            const nonNullRowIsNotChecked = !isNull && !isChecked;

            return !(nullRowIsChecked || nonNullRowIsNotChecked);
        });

        changeSelectionCheckbox(autoSelectedAll, selectedAll);
    }
};

const handleCheckAutoAndAllSelect = (el, autoSelect = false) => {
    const isChecked = el.checked;
    if (isChecked && autoSelect) {
        changeSelectionCheckbox();
    }

    if (isChecked && !autoSelect) {
        changeSelectionCheckbox(false, true);
    }

    const spreadsheet = getSpreadSheetFromToolsBarElement(el);
    const nonReadonlyRows = spreadsheet.nonReadonlyRows();

    /** @type {HTMLTableCellElement[]} */
    const selectedCells = [];
    if (autoSelect) {
        const nonNullRows = nonReadonlyRows.filter((row) => !row[PROCESS_COLUMNS.is_null].data);
        selectedCells.push(...nonNullRows.map((row) => row[PROCESS_COLUMNS.is_checked].td));
    } else {
        selectedCells.push(...nonReadonlyRows.map((row) => row[PROCESS_COLUMNS.is_checked].td));
    }
    $(selectedCells).find('input[type=checkbox]').prop('checked', isChecked).trigger('change');
};

const preventSelectAll = (preventFlag = false) => {
    // change render flag
    renderedCols = !preventFlag;
    $(procModalElements.selectAllSensor).prop('disabled', preventFlag);
    $(procModalElements.autoSelect).prop('disabled', preventFlag);
};

const updateCurrentDatasource = () => {
    const currentShownTableName = getSelectedOptionOfSelect(procModalElements.tables).val() || null;
    const currentShownDataSouce = procModalElements.databases.val() || null;
    // re-assign datasource id and table of process
    if (currentShownDataSouce) {
        currentProcData.ds_id = Number(currentShownDataSouce);
    }
    if (currentShownTableName) {
        currentProcData.table_name = currentShownTableName;
    }
};

const showLatestRecordsFromPrc = async (json) => {
    dataGroupType = json.data_group_type;
    // genColumnWithCheckbox(json.cols, json.rows, dummyDatetimeIdx);
    const speadSheet = await generateProcessList(procModalElements.procConfigTableName, json.cols, json.rows);
    preventSelectAll(renderedCols);

    // update changed datasource
    updateCurrentDatasource();

    // update select all check box after update column checkboxes
    updateSelectAllCheckbox(procModalElements.procConfigTableName);

    // bind select columns with context menu
    bindSelectColumnsHandler();

    // update columns from process
    currentProcColumns = json.cols;
    if (!procModalCurrentProcId) {
        // remove selected table
        // $(`table[name=${procModalElements.processColumnsTableId}] tbody`).empty();
        // auto click auto select
        $(procModalElements.autoSelect).prop('checked', true).change();
        isClickPreview = false;
        // Default uncheck file name
        procModalElements.isShowFileName.prop('checked', false).trigger('change');
    }
    addEventInToolsBar(procModalElements.procConfigTableName);
};

const addEventInToolsBar = (tableId, fromRegisterByFile = false) => {
    const spreadsheet = spreadsheetProcConfig(tableId);
    const tableEle = spreadsheet.table.table.el;
    // download all columns in proc config table
    const procSettingModalDownloadAllBtn = getDownloadElementFromElement(tableEle);
    procSettingModalDownloadAllBtn.off('click').click(downloadAllProcSettingInfo);
    // copy all columns in proc config table
    const procSettingModalCopyAllBtn = getCopyAllElementFromElement(tableEle);
    procSettingModalCopyAllBtn.off('click').click(copyAllProcSettingInfo);
    // paste all columns to in proc config table
    const procSettingModalPasteAllBtn = getPasteAllElementFromElement(tableEle);
    procSettingModalPasteAllBtn.off('click').click(pasteAllProcSettingInfo);

    initSearchProcessColumnsTable(tableEle, fromRegisterByFile);
};

const addDummyDatetimePrc = async (addCol = true) => {
    if (!addCol) {
        // update content of csv
        prcPreviewData.cols.shift();
        prcPreviewData.dummy_datetime_idx = null;
    }
    await showLatestRecordsFromPrc(prcPreviewData);
    // todo: disable check/uncheck to prevent remove datetime column
    // if (!addCol && dummyCol.length) {
    //     dummyCol.remove();
    // }
    if (addCol) {
        // clear old error message
        $(procModalElements.alertErrMsgContent).html('');
        $(procModalElements.alertProcessNameErrorMsg).hide();
        showToastrMsgNoCTCol(prcPreviewData.has_ct_col);
    } else {
        // clear old alert-top-fixed
        $('.alert-top-fixed').hide();
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: procModali18n.noDatetimeCol,
            is_error: true,
        });
    }
    // disable submit button
    updateBtnStyleWithValidation(procModalElements.createOrUpdateProcCfgBtn, addCol);
};

// get latestRecords
const showLatestRecords = (formData, clearSelectedColumnBody = true) => {
    loading.css('z-index', 9999);
    loading.show();
    $.ajax({
        url: '/ap/api/setting/show_latest_records',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: async (json) => {
            loading.hide();
            if (json.cols_duplicated) {
                showToastrMsg(i18nCommon.colsDuplicated);
            }
            // Display etl function error
            if (json.transform_error) {
                showWarningMark(
                    procModalElements.etlFuncWarningMark,
                    procModalElements.alertProcessConfigErrorID,
                    json.transform_error,
                );
            }
            prcPreviewData = { ...json, rows: json.rows.slice(0, 10) };
            currentLatestProcDataCols = prcPreviewData
                ? prcPreviewData.cols.map((col, index) => {
                      return { ...col, id: -index - 1 };
                  })
                : [];
            prcPreviewData.cols = currentLatestProcDataCols;
            await getProcessPreviewWith1000Data(json.rows);
            FunctionInfo.resetInputFunctionInfo(false, false);
            FunctionInfo.removeAllFunctionRows();
            showToastrMsgFailLimit(prcPreviewData);
            const isEditPrc = currentProcItem.data('proc-id') !== undefined;
            // show gen dummy datetime col for new proces only
            if (!isEditPrc && !prcPreviewData.has_ct_col && !prcPreviewData.is_rdb) {
                showDummyDatetimeModal(prcPreviewData, true);
            } else {
                await showLatestRecordsFromPrc(prcPreviewData).then(() => {
                    // reset history because we add alot history when setting up table.
                    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
                    spreadsheet.table.resetHistory();
                });

                // checkDateAndTimeChecked();
                updateBtnStyleWithValidation(procModalElements.createOrUpdateProcCfgBtn);
            }

            allProcessColumns = prcPreviewData ? prcPreviewData.cols.map((col) => col.column_name) : [];

            initDatetimeFormatCheckboxAndInput();
            // gen import filter table
            GenerateDefaultImportFilterTable(currentProcItem.data('proc-id'));
            if (isInitialize) {
                enableDatetimeDataType();
            }
        },
        error: (e) => {
            if (e.responseJSON?.transform_error) {
                showWarningMark(
                    procModalElements.etlFuncWarningMark,
                    procModalElements.alertProcessConfigErrorID,
                    e.responseJSON.transform_error,
                );
            }
            loading.hide();
            console.log('error', e);
        },
    });
};

const getProcessPreviewWith1000Data = async (rows) => {
    // prcPreviewWith1000Data = json;
    currentProcDataCols = procModalCurrentProcId ? currentProcDataCols : currentLatestProcDataCols;

    // convert data to {col_a: [...], col_b: [...]}
    const json1000 = rows.slice(0, 1000);

    // create obj = {columnName1: id1, ...}
    const columnIdNameObj = currentProcDataCols.reduce((acc, cur) => {
        const columnName = cur?.['column_name'];
        acc[columnName] = cur?.['id'];
        return acc;
    }, {});
    // create obj = {columnName1: id1, ...}
    const dataTypeNameObj = currentProcDataCols.reduce((acc, cur) => {
        const columnName = cur?.['column_name'];
        acc[columnName] = cur?.['data_type'];
        return acc;
    }, {});

    // convert data to {columnId1: [...], columnId2: [...]}
    const dictDataType = {};
    // convert data to {columnId1: [...], columnId2: [...]}
    prcRawDataWith1000Data = json1000?.reduce((acc, curr) => {
        for (let key in curr) {
            let columnId = columnIdNameObj?.[key];
            if (!acc[columnId]) {
                acc[columnId] = [];
            }
            let value = curr[key];
            const dataType = dataTypeNameObj?.[key];
            dictDataType[columnId] = dataType;
            acc[columnId].push(value);
        }
        return acc;
    }, {});
    for (const [columnId, values] of Object.entries(prcRawDataWith1000Data)) {
        const dataType = dictDataType[columnId];
        const parseValues = await parseDataByDataType(dataType, values);
        prcPreviewWith1000Data[columnId] = parseValues;
    }
};

const parseDataByDataType = async (dataType, values, isBigInt = false, isJudge = false) => {
    switch (dataType) {
        case DataTypes.INTEGER.name:
            if (!isBigInt) {
                values = values.map((value) => parseIntData(value));
            }
            break;
        case DataTypes.BOOLEAN.name:
            if (isJudge) {
                values = values.map((value) => parseJudgeData(value));
            } else {
                values = values.map((value) => parseBooleanData(value));
            }
            break;
        case DataTypes.REAL.name:
            values = values.map((value) => parseFloatData(value));
            break;
        case DataTypes.DATETIME.name:
            values = await parseProcDatetimeFormatSampleData(dataType, values);
            break;
        case DataTypes.DATE.name:
            values = await parseProcDatetimeFormatSampleData(dataType, values);
            break;
        case DataTypes.TIME.name:
            values = await parseProcDatetimeFormatSampleData(dataType, values);
            break;
        case DataTypes.REAL_SEP.name:
            values = values.map((value) => {
                value = value.replaceAll(',', '');
                return parseFloatData(value);
            });
            break;
        case DataTypes.INTEGER_SEP.name:
            values = values.map((value) => {
                value = value.replaceAll(',', '');
                return parseIntData(value);
            });
            break;
        case DataTypes.EU_REAL_SEP.name:
            values = values.map((value) => {
                value = value.replaceAll('.', '');
                value = value.replaceAll(',', '.');
                return parseFloatData(value);
            });
            break;
        case DataTypes.EU_INTEGER_SEP.name:
            values = values.map((value) => {
                value = value.replaceAll('.', '');
                value = value.replaceAll(',', '.');
                return parseIntData(value);
            });
            break;
        default:
            values = values.map((value) => trimBoth(String(value)));
            break;
    }
    return values;
};

const clearWarning = () => {
    $(procModalElements.alertMessage).css('display', 'none');
    $('.column-name-invalid').removeClass('column-name-invalid');
};

const handleEnglishNameChange = (ele) => {
    ['keyup', 'change'].forEach((event) => {
        ele.off(event).on(event, (e) => {
            // replace characters which isnot alphabet
            e.currentTarget.value = correctEnglishName(e.currentTarget.value);
        });
    });
};

const handleEmptySystemNameJP = async (ele, targetEle) => {
    const systemNameInput = $(ele).parent().siblings().children(`input[name=${targetEle}]`);
    if (!$(systemNameInput).val()) {
        $(systemNameInput).val(await convertEnglishRomaji([$(ele).val()]));
        $(systemNameInput)[0].dataset.originalValue = $(systemNameInput).val();
    }
};

const handleEmptySystemName = async (ele, targetEle) => {
    const systemNameInput = $(ele).parent().siblings().children(`input[name=${targetEle}]`);
    if (!$(systemNameInput).val()) {
        const removed = await convertNonAscii([$(ele).val()]);
        $(systemNameInput).val(removed);
    }
};

/**
 * @param {SpreadSheetProcessConfig} spreadsheet
 * @return {string[]} error messages.
 */
const englishAndMasterNameValidator = (spreadsheet) => {
    const checkedRows = spreadsheet.checkedRows();

    if (_.isEmpty(checkedRows)) {
        return [];
    }

    // Object contains duplicated cells.
    /** @type {Object.<string, ExcelTableCell[]>} */
    const englishNames = {};
    /** @type {Object.<string, ExcelTableCell[]>} */
    const japaneseNames = {};
    /** @type {Object.<string, ExcelTableCell[]>} */
    const localNames = {};

    for (const row of checkedRows) {
        const nameEn = row[PROCESS_COLUMNS.name_en];
        const nameJp = row[PROCESS_COLUMNS.name_jp];
        const nameLocal = row[PROCESS_COLUMNS.name_local];
        (englishNames[nameEn.data] || (englishNames[nameEn.data] = [])).push(nameEn);
        (japaneseNames[nameJp.data] || (japaneseNames[nameJp.data] = [])).push(nameJp);
        (localNames[nameLocal.data] || (localNames[nameLocal.data] = [])).push(nameLocal);
    }

    /** @param {Object.<string, ExcelTableCell[]>} obj */
    const showBorderRedClass = (obj) => {
        for (const cell of Object.values(obj).flat()) {
            // Do not add red border if it is readonly, because user cannot modify them.
            if (!cell.td.classList.contains(READONLY_CLASS)) {
                cell.td.classList.add(BORDER_RED_CLASS);
            }
        }
    };

    const nameErrors = new Set();

    const emptiedEnglishNames = _.pickBy(englishNames, (cells, name) => isEmpty(name));

    // Get duplicated cells (do not select those emptied)
    const duplicatedEnglishNames = _.omitBy(englishNames, (cells, name) => cells.length === 1 || isEmpty(name));
    const duplicatedJapaneseNames = _.omitBy(japaneseNames, (cells, name) => cells.length === 1 || isEmpty(name));
    const duplicatedLocalNames = _.omitBy(localNames, (cells, name) => cells.length === 1 || isEmpty(name));

    if (!_.isEmpty(emptiedEnglishNames)) {
        nameErrors.add($(procModali18n.noEnglishName).text() || '');
        showBorderRedClass(emptiedEnglishNames);
    }
    if (!_.isEmpty(duplicatedEnglishNames)) {
        nameErrors.add($(procModali18n.duplicatedSystemName).text() || '');
        showBorderRedClass(duplicatedEnglishNames);
    }
    if (!_.isEmpty(duplicatedJapaneseNames)) {
        nameErrors.add($(procModali18n.duplicatedJapaneseName).text() || '');
        showBorderRedClass(duplicatedJapaneseNames);
    }
    if (!_.isEmpty(duplicatedLocalNames)) {
        nameErrors.add($(procModali18n.duplicatedLocalName).text() || '');
        showBorderRedClass(duplicatedLocalNames);
    }

    nameErrors.delete('');
    return Array.from(nameErrors) || [];
};

const checkDuplicateProcessName = (
    attr = 'data-name-en',
    isShowMsg = true,
    errorMsg = $(procModalElements.msgProcNameAlreadyExist).text(),
) => {
    if (!checkOnFocus) return;
    let inputEl = procModalElements.proc;
    // get current list of (process-mastername)
    let existingProcIdMasterNames = {};
    // in procs list table
    if (processes && !attr) {
        existingProcIdMasterNames = Object.values(processes).map((proc) => proc.name);
    }
    // in modal opening
    if (isEmpty(existingProcIdMasterNames)) {
        $('#tblProcConfig tr').each(function f() {
            const procId = $(this).data('proc-id');
            const rowId = $(this).attr('id');
            if (rowId) {
                const masterName = $(`#${rowId} input[name=processName]`).attr(attr) || '';
                existingProcIdMasterNames[`${procId}`] = masterName;
            }
        });
        if (attr === 'data-name-jp') {
            inputEl = procModalElements.procJapaneseName;
        }
        if (attr === 'data-name-local') {
            inputEl = procModalElements.procLocalName;
        }
    }
    // check for duplication
    const beingEditedProcName = inputEl.val();
    const existingMasterNames = Object.values(existingProcIdMasterNames);
    const isEditingSameProc = existingProcIdMasterNames[currentProcItem.data('proc-id')] === beingEditedProcName;
    if (beingEditedProcName && existingMasterNames.includes(beingEditedProcName) && !isEditingSameProc) {
        if (isShowMsg) {
            // show warning message
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: errorMsg,
                is_error: true,
            });
        }
        inputEl.addClass('column-name-invalid');
        return true;
    } else {
        if (isShowMsg) {
            $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');
        }
        inputEl.removeClass('column-name-invalid');
    }
    return false;
};

const isDuplicatedProcessName = () => {
    const isNameEnDup = checkDuplicateProcessName('data-name-en', false);
    const isNameJpDup = checkDuplicateProcessName('data-name-jp', false);
    const isNameLocalDup = checkDuplicateProcessName('data-name-local', false);

    if (isNameEnDup || isNameJpDup || isNameLocalDup) {
        // show msg
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: $(procModalElements.msgProcNameAlreadyExist).text(),
            is_error: true,
        });
        return true;
    }

    return false;
};

const scrollTopProcModal = () => {
    $(procModalElements.procModal).animate({ scrollTop: 0 }, 'fast');
};

const validateProcName = () => {
    let notBlank = true;
    // get current list of (process-mastername)
    const masterName = procModalElements.proc.val();
    if (!masterName.trim()) {
        // show warning message
        const blankProcessNameMsg = $(procModalElements.msgProcNameBlank).text();
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: blankProcessNameMsg,
            is_error: true,
        });

        // scroll to top
        scrollTopProcModal();

        notBlank = false;
    } else {
        $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');
    }

    const notDuplicated = !isDuplicatedProcessName();

    return notBlank && notDuplicated;
};

const autoFillShownNameToModal = () => {
    $('#processColumnsTable tbody tr').each(function f() {
        const shownName = $(this).find(`input[name="${procModalElements.shownName}"]`).val();
        const columnName = $(this).find(`input[name="${procModalElements.columnName}"]`).val();
        if (isEmpty(shownName)) {
            $(this).find(`input[name="${procModalElements.shownName}"]`).val(columnName);
        }
    });
};

// VALUE IS DIFFERENT IN BRIDGE STATION
const mappingDataGroupType = {
    is_get_date: 'DATETIME',
    is_serial_no: 'SERIAL',
    is_main_serial_no: 'MAIN_SERIAL',
    is_auto_increment: 'DATETIME_KEY',
    is_line_name: 'LINE_NAME',
    is_line_no: 'LINE_NO',
    is_eq_name: 'EQ_NAME',
    is_eq_no: 'EQ_NO',
    is_part_name: 'PART_NAME',
    is_part_no: 'PART_NO',
    is_st_no: 'ST_NO',
    is_judge: 'JUDGE',
    is_int_cat: 'INT_CATE',
    is_main_date: 'MAIN_DATE',
    is_main_time: 'MAIN_TIME',
};

const procColumnsData = (tableId, getAll = false) => {
    const spreadsheet = spreadsheetProcConfig(tableId);
    const json = spreadsheet.table.collectDataTable();

    // Some attributes that we do not want to include when sending to backend.
    const excludeAttributes = [PROCESS_COLUMNS.process_id];

    const procColumnWithoutSampleData = json
        .map((row) => _.pick(row, Object.keys(PROCESS_COLUMNS)))
        .map((row) => _.omit(row, excludeAttributes));

    return (
        procColumnWithoutSampleData
            .map((column) => {
                // TODO: Column filename has `column_type` and `is_auto_increment` with empty string.
                // So we need to manually parse them here. Need to fix this later.
                let column_type = parseInt(column.column_type, 10);
                if (Number.isNaN(column_type)) {
                    column_type = DataTypeDropdown_Controller.DataGroupType.GENERATED;
                }
                const is_auto_increment =
                    typeof column.is_auto_increment === 'boolean'
                        ? column.is_auto_increment
                        : column.is_auto_increment === 'true';

                // exclude processId out of column before sending to backend.
                const procColumnData = {
                    ...column,
                    column_type,
                    is_auto_increment,
                    name_jp: column.name_jp || null,
                    name_local: column.name_local || null,
                    unit: column.unit || null,
                    // TODO: why would we assign `predict_type = column.data_type` here.
                    predict_type: column.data_type,
                    order: CfgProcess_CONST.CATEGORY_TYPES.includes(column.data_type) ? 1 : 0,
                    function_details: [],
                };

                return procColumnData;
            })
            // Only select checked columns, or select all of them if `getAll = true`
            .filter((column) => column.is_checked || getAll)
    );
};

const getSelectedOptionOfSelect = (selectEl) => {
    const selected1 = selectEl.find('option:selected');
    const selected2 = selectEl.find('option[selected=selected]');
    if (selected1.length > 0) {
        return selected1;
    }

    if (selected2.length > 0) {
        return selected2;
    }

    return selected1;
};

const collectProcCfgData = (getAllCol = false) => {
    const procID = procModalElements.procID.val() || null;
    const procEnName = procModalElements.proc.val();
    const procLocalName = procModalElements.procLocalName.val() || null;
    const procJapaneseName = procModalElements.procJapaneseName.val() || null;
    const dataSourceId = getSelectedOptionOfSelect(procModalElements.databases).val() || '';
    const tableName = getSelectedOptionOfSelect(procModalElements.tables).val() || '';
    const optionalFunction = getSelectedOptionOfSelect(procModalElements.optionalFunctions).val() || '';

    const processFactId = getSelectedOptionOfSelect(procModalElements.tables).attr('process_fact_id') || null;
    const masterType = getSelectedOptionOfSelect(procModalElements.tables).attr('master_type') || null;
    const comment = procModalElements.comment.val() || null;
    const isShowFileName = procModalElements.isShowFileName.not(':disabled')
        ? procModalElements.isShowFileName.is(':checked')
        : null;

    // preview data & data-type predict by file name
    const fileName = procModalElements.fileName.val() || null;
    let procColumns = procColumnsData(procModalElements.procConfigTableName, getAllCol);

    // get uncheck column = all col - uncheck col
    const checkedProcessColumn = procColumns.map((col) => col.column_name);
    const dictFunctionColumns = collectFunctionDatasForRegister();
    // collect import filter config
    const importFilterTable = jspreadsheetTable(filterConditionElements.importFilterTable);
    const importFilterRows = importFilterTable.collectDataTable();
    // merge function column into normal column
    for (let procColumn of procColumns) {
        if (dictFunctionColumns[procColumn.id]) {
            procColumn.function_details = dictFunctionColumns[procColumn.id].function_details;
            delete dictFunctionColumns[procColumn.id];
        }
        const importFilterConfigs = importFilterRows.filter(
            (importFilter) => Number(importFilter.column_id) === Number(procColumn.id),
        );
        const importFilters = importFilterConfigs.map((importFilter) => {
            const filterId = importFilter.filter_id;
            let filters = [];
            if (
                [conditionFormula.orSearch.value, conditionFormula.andSearch.value].includes(
                    importFilter.filter_function,
                )
            ) {
                // split value
                const splitValue = importFilter.value.split(';');
                splitValue.map((val) =>
                    filters.push({
                        filter_id: filterId > 0 ? filterId : null,
                        value: val.trim(),
                    }),
                );
            } else {
                filters.push({
                    filter_id: filterId > 0 ? filterId : null,
                    value: importFilter.value,
                });
            }
            return {
                id: importFilter.id > 0 ? importFilter.id : null,
                column_id: procColumn.id > 0 ? procColumn.id : null,
                filter_function: importFilter.filter_function,
                filter_from_position: importFilter.filter_from_pos || null,
                filters: filters,
            };
        });
        procColumn.import_filters = importFilters;
    }
    const functionColumns = Object.values(dictFunctionColumns);
    procColumns = [...procColumns, ...functionColumns];
    procColumns = procColumns.map((col) => {
        return {
            ...col,
            process_id: procID,
        };
    });
    const unusedColumns = allProcessColumns.filter((colName) => !checkedProcessColumn.includes(colName));
    return [
        {
            id: procID,
            name_en: procEnName,
            name: procEnName,
            data_source_id: dataSourceId,
            table_name: tableName,
            etl_func: optionalFunction,
            process_factid: processFactId,
            master_type: masterType,
            comment,
            columns: procColumns,
            name_jp: procJapaneseName,
            name_local: procLocalName,
            file_name: fileName,
            is_show_file_name: isShowFileName,
            is_import: true,
        },
        unusedColumns,
    ];
};

const collectMergeProcCfgData = () => {
    const dataSourceID = procModalElements.databasesMergeMode.val();
    const comment = procModalElements.mergeProcComment.val();
    const tableName = getSelectedOptionOfSelect(procModalElements.mergeModeTables).val() || '';
    const processFactId = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('process_fact_id') || null;
    const masterType = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('master_type') || null;
    const baseProcCols = baseProcObj.columns.reduce((o, col) => ({ ...o, [col.column_name]: col }), {});
    const columnLimitation = Object.keys(baseProcCols).length;
    const mergeProcColsObj = childProcData.cols.reduce((o, col) => ({ ...o, [col.column_name]: col }), {});
    const mergedProcCols = Array.from($('#childProcessColumns select[name=merge-mode-column-name]'));
    const mergedCols = [];
    const optionalFunction = getSelectedOptionOfSelect(procModalElements.childOptionalFunctions).val() || '';
    mergedProcCols.forEach((col, idx) => {
        if (idx < columnLimitation) {
            const colName = $(col).find('option:checked').data('col-name');
            const colData = mergeProcColsObj[colName];
            if (colData) {
                const originalCol = baseProcCols[baseProcDataCols[idx].column_name];
                colData.parent_id = originalCol ? originalCol.id : null;
                if (colData.parent_id) {
                    // child col's datatype must match parent col's datatype
                    colData.data_type = originalCol.data_type;
                    mergedCols.push(colData);
                }
            }
        }
    });
    return {
        id: null,
        data_source_id: dataSourceID,
        name: baseProcObj.name,
        table_name: tableName,
        etl_func: optionalFunction,
        process_factid: processFactId,
        master_type: masterType,
        name_en: baseProcObj.name_en,
        name_jp: baseProcObj.name_jp,
        name_local: baseProcObj.name_local,
        comment: comment,
        parent_id: baseProcObj.id,
        columns: mergedCols,
        is_import: true,
    };
};

const updateProcessConfig = (res) => {
    procModalElements.procModal.modal('hide');
    procModalElements.confirmImportDataModal.modal('hide');
    procModalElements.procMergeModeModal.modal('hide');
    // sync Vis network
    reloadTraceConfigFromDB();
    isV2ProcessConfigOpening = false;

    // update GUI
    if (res.status !== HTTP_RESPONSE_CODE_500) {
        if (!currentProcItem.length) {
            addProcToTable(
                res.data.id,
                res.data.name_en,
                res.data.name_jp,
                res.data.name_local,
                res.data.shown_name,
                res.data.data_source.id,
            );
        } else {
            // update parent process name
            updateProcessName({ trEl: currentProcItem, res });

            // update name for child process:
            const childProcesses = $(`#tblProcConfig tr[data-proc-parent-id="${res.data.id}"`);
            childProcesses.each((_, child) => {
                updateProcessName({ trEl: child, res });
            });

            // change selectEl to inputEl (databaseName)
            handleChangeSelectToInput({
                element: currentProcItem,
                elName: 'databaseName',
                value: res.data.data_source.name,
            });

            if (!['CSV', 'V2'].includes(res.data.data_source.type)) {
                // change selectEl to inputEl (tableName)
                handleChangeSelectToInput({
                    element: currentProcItem,
                    elName: 'tableName',
                    value: res.data.table_name,
                });
            } else {
                $(currentProcItem).find('select[name="tableName"]').remove();
                // remove span of select2 in td > select[name="tableName"] if DS is CSV/TSV
                $(currentProcItem).find('td').eq(3).empty();
            }

            $(currentProcItem).find('textarea[name="comment"]').val(res.data.comment).prop('disabled', true);
            $(currentProcItem).attr('id', `proc_${res.data.id}`);
            $(currentProcItem).attr('data-proc-id', res.data.id);
            $(currentProcItem).attr('data-ds-id', res.data.data_source_id);
            $(currentProcItem).attr('data-proc-parent-id', res.data.parent_id);
        }
    } else {
        if (res['errorType'] === 'CastError') {
            // Show modal and list down all columns & data that cannot be converted
            const failedCastDataModal = new FailedCastDataModal();
            failedCastDataModal.init(res.data, res.message);
            failedCastDataModal.show();

            // Revert to previous data type
            $(`${procModalElements.formId} td[title="raw_data_type"] div.multi-level-dropdown`).each((i, e) => {
                const originRawDataType = $(e)
                    .find('button.dropdown-toggle a[data-ext-name="data_type"]')
                    .data('origin-value');
                const rawDataType = $(e).find('button.dropdown-toggle a[data-ext-name="data_type"]').data('value');
                if (originRawDataType !== rawDataType) {
                    setTimeout(() => {
                        const item = $(e).find(`ul.dropdown-menu a[data-value="${originRawDataType}"]`);
                        DataTypeDropdown_Controller.itemClick({
                            currentTarget: item.length > 1 ? item[1] : item[0],
                        });
                    }, 1);
                }
            });
        } else {
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: res.message,
                is_error: true,
            });
        }
    }
};

const saveProcCfg = async (isMergeMode = false) => {
    clearWarning();
    let [procCfgData, unusedColumns] = [null, []];
    if (!isMergeMode) {
        [procCfgData, unusedColumns] = collectProcCfgData();
    } else {
        procCfgData = collectMergeProcCfgData();
    }

    if (!procCfgData) {
        // todo : show toarst message
        console.log('Invalid data');
        return;
    }
    // validate main::Serial
    const serialColumns = procCfgData.columns.filter((column) => column.is_serial_no);
    if (serialColumns.length > 1) {
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: 'Duplicated main::Serial column',
            is_error: true,
        });
        return;
    }
    const isCheckedDatetimeFormat = procModalElements.procDateTimeFormatCheckbox[0].checked;
    procCfgData.datetime_format = isCheckedDatetimeFormat
        ? procModalElements.procDateTimeFormatInput.val().trim()
        : null;
    const data = {
        proc_config: procCfgData,
        unused_columns: unusedColumns,
    };

    const res = await postProcConfig(data).catch((errorData) => {
        let messageInfo = genFunctionErrorMessage(errorData.responseJSON);
        if (messageInfo) {
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: messageInfo.message,
                is_error: messageInfo.isError,
                is_warning: messageInfo.isWarning,
            });
        }
    });
    if (res) updateProcessConfig(res);

    // update mutation status of function table
    if (typeof inputMutationObserver !== 'undefined') {
        inputMutationObserver.nodeStatus = [];
    }

    $(`#tblProcConfig #${procModalCurrentProcId}`).data('type', '');
};

/**
 * Call api to update process config
 * @param data
 * @return {Promise<{
 *     status: number,
 *     data: *,
 * }>}
 */
const postProcConfig = (data) =>
    new Promise((resolve, reject) => {
        $.ajax({
            url: 'api/setting/proc_config',
            type: 'POST',
            data: JSON.stringify(data),
            dataType: 'json',
            contentType: 'application/json',
        })
            .done(resolve)
            .fail(reject)
            .then(() => {});
    });

// update name after save proc
const updateProcessName = ({ trEl, res }) => {
    $(trEl).find('input[name="processName"]').val(res.data.shown_name).prop('disabled', true);
    $(trEl).find('input[name="processName"]').attr('data-name-en', res.data.name_en);
    $(trEl).find('input[name="processName"]').attr('data-name-jp', res.data.name_jp);
    $(trEl).find('input[name="processName"]').attr('data-name-local', res.data.name_local);
};

// change select2 to input
const handleChangeSelectToInput = ({ element, elName, value }) => {
    const $newInputEl = $('<input>', {
        type: 'text',
        name: elName,
        class: 'form-control already-convert-hankaku',
        value: value,
        disabled: true,
    });

    // change selectEl => inputEls
    const selectEl = $(element).find(`select[name=${elName}]`);
    $(selectEl).next().remove(); // remove spanEl of select2
    $(selectEl).replaceWith($newInputEl);
};

/**
 * @param {string} processTableId
 * @param {boolean} isFromProcessConfig - Whether we are validating in process config or in register-by-file.
 * - In process config: the message will be shown at the top of the modal
 * - In register by file: the message will be shown at the progress bar.
 *
 * @returns {boolean}
 */
const validateProcessColumn = (processTableId, isFromProcessConfig) => {
    const spreadsheet = spreadsheetProcConfig(processTableId);
    // reset all invalid cells
    const erroredCells = spreadsheet.erroredCells(
        PROCESS_COLUMNS.shown_data_type,
        PROCESS_COLUMNS.name_en,
        PROCESS_COLUMNS.name_jp,
        PROCESS_COLUMNS.name_local,
    );
    // Remove invalid class for all cells.
    for (const cell of erroredCells) {
        cell.td.classList.remove(BORDER_RED_CLASS);
    }

    // check if date is checked
    const getDateMsgs = [];

    // check if main date and main time are selected.
    const mainDateRow = spreadsheet.mainDateRow();
    const mainTimeRow = spreadsheet.mainTimeRow();
    const isMainDateAndMainTimeSelected =
        mainDateRow &&
        mainDateRow[PROCESS_COLUMNS.is_checked].data &&
        mainTimeRow &&
        mainTimeRow[PROCESS_COLUMNS.is_checked].data;

    // check if main datetime is selected.
    const mainDateTimeRow = spreadsheet.mainDateTimeRow();
    const isGetDateSelected = mainDateTimeRow && mainDateTimeRow[PROCESS_COLUMNS.is_checked].data;

    const isValidDatetime = isGetDateSelected || isMainDateAndMainTimeSelected;
    if (!isValidDatetime) {
        getDateMsgs.push($(procModali18n.msgErrorNoGetdate).text());
    }

    // check duplicate column name
    const nameMsgs = englishAndMasterNameValidator(spreadsheet);

    const missingShownName = procModali18n.noMasterName;
    if (nameMsgs.length && nameMsgs.includes(missingShownName) && isFromProcessConfig) {
        const emptyShownameMsg = $(procModali18n.emptyShownName).text();
        const useEnglnameMsg = $(procModali18n.useEnglishName).text();
        // show modal to confirm auto filling shown names
        $(procModalElements.msgContent).text(`${emptyShownameMsg}\n${useEnglnameMsg}`);
        $(procModalElements.msgModal).modal('show');
    }
    if (getDateMsgs.length > 0 || nameMsgs.length > 0) {
        const messageStr = Array.from(getDateMsgs.concat(nameMsgs)).join('<br>');
        if (isFromProcessConfig) {
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: messageStr,
                is_error: true,
            });
        } else {
            addMessengerToProgressBar(messageStr, ICON_STATUS.WARNING);
        }
        return false;
    }
    return true;
};

const runRegisterProcConfigFlow = (edit = false) => {
    clearWarning();

    // validate proc name null
    const validateFlg = validateProcName();
    if (!validateFlg) {
        scrollTopProcModal();
        return;
    }
    const isValid = validateProcessColumn(procModalElements.procConfigTableName, true);

    if (isValid) {
        if (edit) {
            $(procModalElements.confirmReRegisterProcModal).modal('show');
        } else {
            $(procModalElements.confirmImportDataModal).modal('show');
        }
    } else {
        // scroll to where messages are shown
        const settingContentPos = procModalElements.procModalBody.offset().top;
        const bodyPos = procModalElements.procModalBody.offset().top;
        procModalElements.procModal.animate(
            {
                scrollTop: settingContentPos - bodyPos,
            },
            'slow',
        );
    }
};

const checkClearColumnsTable = (dsID, tableName) => {
    if (
        ((isEmpty(currentProcData.table_name) && isEmpty(tableName)) || currentProcData.table_name === tableName) &&
        currentProcData.ds_id === dsID
    ) {
        return false;
    }
    return true;
};

// initialize process (S255#02)
const initializeProcess = (procId) => {
    return fetch(`api/setting/initialize_proc/${procId}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    }).then((response) => {
        if (response.ok) {
            return response.json();
        }
        throw new Error(procModali18n.i18nInitializeProcessError);
    });
};

// TODO: Does this need to return a list?
const convertEnglishRomaji = async (englishNames = []) => {
    const result = await fetch('api/setting/list_to_english', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ english_names: englishNames }),
    }).then((response) => response.clone().json());

    return result.data || [];
};

const convertNonAscii = async (names = []) => {
    const result = await fetch('api/setting/list_normalize_ascii', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ names: names }),
    }).then((response) => response.clone().json());

    return result['data'] || [];
};

/**
 * Get all text data inside tds, separate by TAB
 * @param {?HTMLTableRowElement} tr
 * @return string[]
 */
const getTRDataValues = (tr) => {
    const children = [...(tr?.children ?? [])];
    return children.map((td) => {
        const dataOriginAttr = td.dataset.origin;
        if (dataOriginAttr != null) {
            return dataOriginAttr;
        }
        const inputEl = td.querySelector('input[type="text"]');
        if (inputEl != null) {
            return inputEl.value.trim();
        }
        return td.innerText.trim();
    });
};

/**
 * Download All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const downloadAllProcSettingInfo = (e) => {
    const ele = e.currentTarget;
    const spreadsheet = getSpreadSheetFromToolsBarElement(ele);
    const text = spreadsheet.table.tableText();
    const processNameEle = getProcessNameElementFromElement(ele); // TODO: Check
    const processName = processNameEle.val().trim();
    const fileName = `${processName}_SampleData.tsv`;
    downloadText(fileName, text);
    showToastrMsg(document.getElementById('i18nStartedTSVDownload').textContent, MESSAGE_LEVEL.INFO);
};

/**
 * Copy All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const copyAllProcSettingInfo = (e) => {
    const ele = e.currentTarget;
    const spreadsheet = getSpreadSheetFromToolsBarElement(ele);
    spreadsheet.table.copyAll();
};

/**
 * parse clipboard string
 * @param {string} copiedText - clipboard string
 * @return {Array.<Array.<string>>}
 */
const transformCopiedTextToTable = (copiedText) => {
    const records = copiedText.replace(/\r\n+$/, '').split('\r\n');
    return records
        .map((rec) => rec.replace(/\t+$/, ''))
        .filter((row) => row !== '')
        .map((row) => row.split('\t'));
};

/**
 * Paste All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const pasteAllProcSettingInfo = (e) => {
    navigator.clipboard.readText().then(function (text) {
        const tableData = transformCopiedTextToTable(text);
        if (tableData === null) {
            return;
        }
        const ele = e.currentTarget;
        const spreadsheet = getSpreadSheetFromToolsBarElement(ele);

        // warning and abort if we don't have enough rows
        if (spreadsheet.table.table.rows.length !== tableData.length) {
            showToastrMsg('Number of records mismatch. Please check and copy again', MESSAGE_LEVEL.WARN);
            return;
        }

        const headers = spreadsheet.table.getHeaders();
        tableData.forEach((rowData, rowIndex) => {
            const spreadsheetData = {};
            rowData.forEach((value, columnIndex) => (spreadsheetData[headers[columnIndex].name] = value));
            spreadsheet.table.updateRow(rowIndex, spreadsheetData, false, false);
        });

        showToastPasteFromClipboardSuccessful();
    }, showToastPasteFromClipboardFailed);
};

const selectAllColsHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // show context menu when right click
    const menu = $(procModalElements.checkColsContextMenu);
    const menuHeight = menu.height();
    const windowHeight = $(window).height();
    const left = e.clientX;
    let top = e.clientY;
    if (windowHeight - top < menuHeight) {
        top -= menuHeight;
    }
    menu.css({
        left: `${left}px`,
        top: `${top}px`,
        display: 'block',
    });

    const targetCol = $(e.currentTarget).find('input').attr('data-col-index');
    if (targetCol !== '') {
        $(menu).attr('data-target-col', targetCol);
    }
    return false;
};

const hideCheckColMenu = (e) => {
    // later, not just mouse down, + mouseout of menu
    $(procModalElements.checkColsContextMenu).css({ display: 'none' });
};

const bindSelectColumnsHandler = () => {
    $('table[name=latestDataTable] thead th').each((i, th) => {
        th.addEventListener('contextmenu', selectAllColsHandler, false);
        th.addEventListener('mouseover', hideCheckColMenu, false);
    });
};

const createProcAndImportData = async (event) => {
    const isMergeMode = $(event).attr('data-is-merge-mode') === 'true';
    $(procModalElements.confirmImportDataModal).modal('hide');
    await saveProcCfg(isMergeMode);

    // save order to local storage
    dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order

    recentEdit(procModalCurrentProcId);

    // show toastr
    showToastr();
    showJobAsToastr();
};

/**
 * Show or Hide Copy & Paste process config buttons base on secure context
 */
function showHideCopyPasteProcessConfigButtons() {
    if (window.isSecureContext) {
        $(`[name=${procModalElements.procSettingModalCopyAllBtn}]`).show();
        $(`[name=${procModalElements.procSettingModalPasteAllBtn}]`).show();
    } else {
        $(`[name=${procModalElements.procSettingModalCopyAllBtn}]`).hide();
        $(`[name=${procModalElements.procSettingModalPasteAllBtn}]`).hide();
    }
}

let renderedCols;

$(() => {
    // workaround to make multiple modal work
    $(document).on('hidden.bs.modal', '.modal', () => {
        if ($('.modal:visible').length) {
            $(document.body).addClass('modal-open');
        }
    });

    // confirm auto fill master name
    $(procModalElements.msgConfirmBtn).click(() => {
        autoFillShownNameToModal();

        $(procModalElements.msgModal).modal('hide');
    });

    // click Import Data
    procModalElements.okBtn.click((e) => {
        runRegisterProcConfigFlow((edit = false));
    });

    // merge mode
    procModalElements.createMergeProcCfgBtn.click(() => {
        $(procModalElements.confirmImportDataModal).modal('show');
    });

    // confirm Import Data
    // procModalElements.confirmImportDataBtn.click(() => {
    //     $(procModalElements.confirmImportDataModal).modal('hide');
    //
    //     const selectJson = getSelectedColumnsAsJson();
    //     saveProcCfg(selectJson);
    //
    //     // save order to local storage
    //     setTimeout(() => {
    //         dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
    //     }, 2000);
    //
    //     recentEdit(procModalCurrentProcId);
    //
    //     // show toastr
    //     showToastr();
    //     showJobAsToastr();
    // });

    // initialize process config
    procModalElements.initializeProcessBtn.click((e) => {
        $('#confirmInitializedProcess').modal('show');
    });

    // Click confirm modal
    $(procModalElements.confirmInitializeProcBtn).click(() => {
        const procId = currentProcItem.data('proc-id');
        $(procModalElements.confirmInitializeModal).modal('hide');
        loading.show();

        // call APIs initialize_process
        initializeProcess(procId)
            .then(() => {
                isInitialize = true;
                loading.hide();
                showToastrMsg(procModali18n.i18nInitializeProcessSuccess, MESSAGE_LEVEL.INFO);

                // hide initialize button
                procModalElements.initializeProcessBtn.hide();
                procModalElements.initializeProcessBtn.attr('data-observer', 'initialized');

                // change re-import to import
                procModalElements.reRegisterBtn.css('display', 'none');
                procModalElements.createOrUpdateProcCfgBtn.css('display', 'block');
                enableDatetimeDataType();
            })
            .catch(() => {
                // hide loading
                loading.hide();
                showToastrMsg(procModali18n.i18nInitializeProcessError, MESSAGE_LEVEL.ERROR);
            });
    });

    // re-register process config
    procModalElements.reRegisterBtn.click((e) => {
        // check if e.currentTarget.hasAttributes('data-has-ct')
        const withShowPreview = e.currentTarget.hasAttribute('data-has-ct');
        const hasCTCols = $(e.currentTarget).attr('data-has-ct') === 'true';
        if (withShowPreview && !hasCTCols) {
            return;
        }
        runRegisterProcConfigFlow((edit = true));
    });

    procModalElements.confirmReRegisterProcBtn.click(async () => {
        $(procModalElements.confirmReRegisterProcModal).modal('hide');
        await saveProcCfg();

        // save order to local storage
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        recentEdit(procModalCurrentProcId);
    });

    // load tables to modal combo box
    loadTables(getSelectedOptionOfSelect(procModalElements.databases).val());

    // Databases onchange
    procModalElements.databases.change(() => {
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
        if (
            isMergeModeFromProcConfig() &&
            !document.querySelector(procModalElements.confirmMergeMode).deactivate &&
            userEditedProcName
        ) {
            showModalConfirmMergeMode();
        } else {
            procDsSelected = null;
            hideAlertMessages();
            isClickPreview = true;
            const dsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
            const dataRowId = currentProcItem.attr('data-rowid');
            loadTables(dsSelected, dataRowId);
        }
        GenerateDefaultImportFilterTable();
    });

    // Databases onchange merge mode
    procModalElements.databasesMergeMode.change(() => {
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databasesMergeMode).val();
        currentProcessName = procModalElements.procNameMergeMode.val();
        mergeModeProcess();
    });

    // Merge mode tables onchange
    procModalElements.mergeModeTables.change(async () => {
        loading.css('z-index', 9999);
        loading.show();
        hideAlertMessages();
        $(procModalElements.childEtlFuncWarningMark).hide();
        isClickPreview = true;
        const procId = currentProcItem.data('proc-id');

        // get process name based on the locale
        const { processName, processNameLocal } = getProcessNameByLocale();

        // get base process id
        let baseProc = getBaseProcessInfo('', processName, processNameLocal);
        const tableName = procModalElements.mergeModeTables.val();
        if (tableName) {
            await loadInfoTableWithMergeMode(procId, baseProc, tableName);
        }
        loading.hide();
    });

    // Tables onchange
    procModalElements.tables.change(() => {
        hideAlertMessages();
        isClickPreview = true;
        setProcessName();
    });

    // Process config optional function onchange
    procModalElements.optionalFunctions.change(() => {
        hideAlertMessages();
        isClickPreview = true;
        procModalElements.optionalFunctions.data(DATA_IGNORE_CHANGE, true);
        setProcessName();
        procModalElements.optionalFunctions.removeData(DATA_IGNORE_CHANGE);
    });

    // Process config (Merge mode) optional function onchange
    procModalElements.childOptionalFunctions.change(() => {
        procModalElements.mergeModeTables.trigger('change');
    });

    procModalElements.proc.on('mouseup', () => {
        userEditedProcName = true;
    });

    // This should not affect the field on register by file page
    let debounceTimer;
    $('#procCfgForm #fileName').on('input', (e) => {
        clearTimeout(debounceTimer);
        $(procModalElements.alertReferenceFileErrorID).hide();
        trimQuotesSpacesAndUpdate(e.target);
        debounceTimer = setTimeout(async () => {
            if (e.target.value) {
                $.ajax({
                    url: csvResourceElements.apiCheckFolderUrl,
                    method: 'POST',
                    data: JSON.stringify({
                        url: e.target.value,
                        isFile: true,
                    }),
                    contentType: 'application/json',
                    success: (res) => {
                        if (res.is_valid) {
                            $(procModalElements.showRecordsBtn).trigger('click');
                        } else {
                            displayRegisterMessage(procModalElements.alertReferenceFileErrorID, {
                                message: $(procModali18n.i18nInvalidFilePathMessage).text(),
                                is_error: true,
                            });
                        }
                    },
                });
            } else {
                $(procModalElements.showRecordsBtn).trigger('click');
            }
        }, 300);
    });

    // Show records button click event
    procModalElements.showRecordsBtn.click(async (event) => {
        event.preventDefault();
        const currentShownTableName = getSelectedOptionOfSelect(procModalElements.tables).val() || null;
        const currentOptionalFunction = getSelectedOptionOfSelect(procModalElements.optionalFunctions).val() || null;
        const currentShownDataSource = getSelectedOptionOfSelect(procModalElements.databases).val() || null;
        const clearDataFlg = checkClearColumnsTable(Number(currentShownDataSource), currentShownTableName);
        const procModalForm = $(procModalElements.formId);
        const formData = new FormData(procModalForm[0]);
        if (!formData.get('tableName') && currentShownTableName) {
            formData.set('tableName', currentShownTableName);
        }
        const processFactId = getSelectedOptionOfSelect(procModalElements.tables).attr('process_fact_id') || '';
        formData.set('processFactId', processFactId);
        const masterType = getSelectedOptionOfSelect(procModalElements.tables).attr('master_type') || '';
        if (masterType) {
            formData.set('masterType', masterType);
        }
        // set currentProcessId in order to check if we need to show generated column in backend
        formData.set('currentProcessId', procModalCurrentProcId);
        // get 1000 records by limit param
        formData.set('limit', 1000);
        // Set etl function
        if (currentOptionalFunction) {
            formData.set('etlFunc', currentOptionalFunction);
        }

        preventSelectAll(true);

        // disable show file name if we are viewing imported process
        if (procModalCurrentProcId) {
            $(procModalElements.isShowFileName).prop('disabled', true);
        }

        // TODO
        // disable datetime format if we are viewing imported process

        // reset select all checkbox when click showRecordsBtn
        $(procModalElements.selectAllColumn).css('display', 'block');
        $(procModalElements.autoSelectAllColumn).css('display', 'block');

        // Hide warning mark
        procModalElements.etlFuncWarningMark.hide();

        // reset first datetime checked
        showLatestRecords(formData, clearDataFlg);
    });

    // Show preview to merge mode
    const showPreviewToMergeProcess = (event) => {
        event.preventDefault();

        preventSelectAll(true);

        // reset first datetime checked
        isClickPreviewMergeMode = true;
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databasesMergeMode).val();

        // get process name based on the locale instead of mergeProcName
        currentProcessName = procModalElements.procNameMergeMode.val();

        currentProcessNameLocal = 'en';
        // Hide warning mark
        procModalElements.childEtlFuncWarningMark.hide();
        mergeModeProcess();
    };
    procModalElements.showPreviewBtnToMerge.click((event) => showPreviewToMergeProcess(event));

    procModalElements.proc.on('focusout', () => {
        checkDuplicateProcessName('data-name-en');
    });
    procModalElements.procJapaneseName.on('focusout', () => {
        checkDuplicateProcessName('data-name-jp');
    });
    procModalElements.procLocalName.on('focusout', () => {
        checkDuplicateProcessName('data-name-local');
    });

    $(procModalElements.revertChangeAsLinkIdBtn).click(() => {
        currentAsLinkIdBox.prop('checked', !currentAsLinkIdBox.prop('checked'));
    });

    $(procModalElements.revertChangeAsLinkIdBtn).click(() => {
        currentAsLinkIdBoxDataTable.prop('checked', !currentAsLinkIdBoxDataTable.prop('checked'));
    });

    showHideCopyPasteProcessConfigButtons();
});

// get process name based on the locale
const getProcessNameByLocale = () => {
    // check current modal displaying is #procModal or #procMergeModeModal
    // 1. Default is option procMergeModeModal (Normal mode)
    const isDisplayProcModal = $(procModalElements.procModal).css('display') !== 'none';
    const isDisplayProcMergeModeModal = $(procModalElements.procMergeModeModal).css('display') !== 'none';

    const processNameLocal = docCookies.getItem(keyPort('locale')) === 'ja' ? 'jp' : 'en';
    // local name || english name
    let processLocalName;
    // jp name || english name
    let processJpName;

    if (isDisplayProcMergeModeModal) {
        processLocalName = $(`#mergeProcLocalName`).val() || $(`#mergeProcName`).val();
        processJpName = $(`#mergeProcJapaneseName`).val() || $(`#mergeProcName`).val();
    }

    if (isDisplayProcModal) {
        processLocalName = $(`#processLocalName`).val() || $(`#processName`).val();
        processJpName = $(`#processJapaneseName`).val() || $(`#processName`).val();
    }

    const processName = processNameLocal === 'en' ? processLocalName : processJpName;
    return { processName, processNameLocal };
};

/**
 * A datatype default object
 * @type DataTypeObject
 */
const datatypeDefaultObject = {
    value: '',
    is_get_date: false,
    is_main_date: false,
    is_main_time: false,
    is_serial_no: false,
    is_main_serial_no: false,
    is_auto_increment: false,
    is_int_cat: false,
};

const fixedName = {
    1: {
        system: 'Datetime',
        japanese: '日時',
    },
    2: {
        system: 'Serial',
        japanese: 'シリアル',
    },
    7: {
        system: 'Date',
        japanese: '日付',
    },
    8: {
        system: 'Time',
        japanese: '時刻',
    },
    20: {
        system: 'LineName',
        japanese: 'ライン名',
    },
    21: {
        system: 'LineNo',
        japanese: 'ラインNo',
    },
    22: {
        system: 'EqName',
        japanese: '設備名',
    },
    23: {
        system: 'EqNo',
        japanese: '設備No',
    },
    24: {
        system: 'PartName',
        japanese: '品名',
    },
    25: {
        system: 'PartNo',
        japanese: '品番',
    },
    26: {
        system: 'StNo',
        japanese: 'StNo',
    },
    76: {
        system: 'Judge',
        japanese: '判定',
    },
};

const datatypeI18nText = {
    is_get_date: $(procModali18n.i18nMainDatetime).text(),
    is_main_date: $(procModali18n.i18nMainDate).text(),
    is_main_time: $(procModali18n.i18nMainTime).text(),
    is_main_serial_no: {
        TEXT: $(procModali18n.i18nMainSerialStr).text(),
        INTEGER: $(procModali18n.i18nMainSerialInt).text(),
    },
    is_serial_no: {
        TEXT: $(procModali18n.i18nSerialStr).text(),
        INTEGER: $(procModali18n.i18nSerialInt).text(),
    },
    is_line_name: $(procModali18n.i18nLineNameStr).text(),
    is_line_no: $(procModali18n.i18nLineNoInt).text(),
    is_eq_name: $(procModali18n.i18nEqNameStr).text(),
    is_eq_no: $(procModali18n.i18nEqNoInt).text(),
    is_part_name: $(procModali18n.i18nPartNameStr).text(),
    is_part_no: $(procModali18n.i18nPartNoInt).text(),
    is_st_no: $(procModali18n.i18nStNoInt).text(),
    is_auto_increment: $(procModali18n.i18nDatetimeKey).text(),
    is_int_cat: $(`#${DataTypes.INTEGER_CAT.i18nLabelID}`).text(),
    is_judge: $(procModali18n.i18nJudgeNo).text(),
};
const i18nDataTypeText = [
    $(procModali18n.i18nMainDatetime).text(),
    $(procModali18n.i18nMainDate).text(),
    $(procModali18n.i18nMainTime).text(),
    $(procModali18n.i18nMainSerialStr).text(),
    $(procModali18n.i18nMainSerialInt).text(),
    $(procModali18n.i18nDatetimeKey).text(),
    $(procModali18n.i18nSerialStr).text(),
    $(procModali18n.i18nSerialInt).text(),
    $(procModali18n.i18nLineNameStr).text(),
    $(procModali18n.i18nLineNoInt).text(),
    $(procModali18n.i18nEqNameStr).text(),
    $(procModali18n.i18nEqNoInt).text(),
    $(procModali18n.i18nPartNameStr).text(),
    $(procModali18n.i18nPartNoInt).text(),
    $(procModali18n.i18nStNoInt).text(),
    $(procModali18n.i18nDatetimeKey).text(),
    $(procModali18n.i18nJudgeNo).text(),
    DataTypes.REAL.selectionBoxDisplay,
    DataTypes.INTEGER.selectionBoxDisplay,
    DataTypes.INTEGER_CAT.selectionBoxDisplay,
    DataTypes.STRING.selectionBoxDisplay,
    DataTypes.BOOLEAN.selectionBoxDisplay,
    DataTypes.DATETIME.selectionBoxDisplay,
    procModali18n.i18nIntSep,
    procModali18n.i18nEuIntSep,
    procModali18n.i18nRealSep,
    procModali18n.i18nEuRealSep,
];

const DataTypeAttrs = [
    'is_get_date',
    'is_main_date',
    'is_main_time',
    'is_serial_no',
    'is_main_serial_no',
    'is_auto_increment',
    'is_line_name',
    'is_line_no',
    'is_eq_name',
    'is_eq_no',
    'is_part_name',
    'is_part_no',
    'is_st_no',
    'is_judge',
    'is_int_cat',
    'is_main_date',
    'is_main_time',
];
const fixedNameColumnTypes = [
    masterDataGroup.MAIN_DATETIME,
    masterDataGroup.MAIN_SERIAL,
    masterDataGroup.LINE_NAME,
    masterDataGroup.LINE_NO,
    masterDataGroup.EQ_NAME,
    masterDataGroup.EQ_NO,
    masterDataGroup.PART_NAME,
    masterDataGroup.PART_NO,
    masterDataGroup.ST_NO,
    masterDataGroup.JUDGE,
];
/**
 *
 * @param {JspreadSheetTable} table
 * @param {number} newColNumber
 */
const reCalculateCheckedColumn = (table, newColNumber) => {
    const tableEle = table.table.el;
    const totalColumns = getTotalColumnElementFromElement(tableEle);
    const currentTotalColumn = totalColumns.text();
    const totalCheckedColumns = getTotalCheckedColumnElementFromElement(tableEle);
    const currentCheckedColumn = totalCheckedColumns.text();
    showTotalCheckedColumns(
        tableEle,
        Number(currentTotalColumn) + newColNumber,
        Number(currentCheckedColumn) + newColNumber,
    );
};

const updateCheckedColumn = (table, newCheckedColumns) => {
    const tableEle = table.table.el;
    const totalColumns = getTotalColumnElementFromElement(tableEle);
    const currentTotalColumn = totalColumns.text();
    const totalCheckedColumns = getTotalCheckedColumnElementFromElement(tableEle);
    const currentCheckedColumn = totalCheckedColumns.text();
    showTotalCheckedColumns(tableEle, Number(currentTotalColumn), Number(currentCheckedColumn) + newCheckedColumns);
};

const initSearchProcessColumnsTable = (tableEle, fromRegisterByFile) => {
    const searchInput = getSearchInputElementFromElement(tableEle);
    const searchSetBtn = getSetElementFromElement(tableEle);
    const searchResetBtn = getResetElementFromElement(tableEle);
    initCommonSearchInput(searchInput);
    if (!fromRegisterByFile) {
        initRemoveSearchInputEvent(procModalElements.removeFuncInputSearch);
    }
    // reset search input
    searchInput.val('');
    searchInput.on('keypress input', function (event) {
        const ele = event.currentTarget;
        const spreadsheet = getSpreadSheetFromToolsBarElement(ele);
        let value = stringNormalization(this.value.toLowerCase());
        spreadsheet.handleSearchInput(value, event.key);
    });

    searchSetBtn.on('click', function (event) {
        const ele = event.currentTarget;
        const spreadsheet = getSpreadSheetFromToolsBarElement(ele);
        spreadsheet.handleSearchSetButton();
    });

    searchResetBtn.on('click', function (event) {
        const ele = event.currentTarget;
        const spreadsheet = getSpreadSheetFromToolsBarElement(ele);
        spreadsheet.handleSearchResetButton();
    });
};

const handleScrollSampleDataTable = (tableId) => {
    const $scrollToLeftSpan = $(`#${tableId}`).parent().find('#sampleDataScrollToLeft');
    const $scrollToLeftOneStepSpan = $(`#${tableId}`).parent().find('#sampleDataScrollToLeftOneStep');
    const $scrollToRightSpan = $(`#${tableId}`).parent().find('#sampleDataScrollToRight');
    const $scrollToRightOneStepSpan = $(`#${tableId}`).parent().find('#sampleDataScrollToRightOneStep');
    const $procConfigContent = $(`#${tableId} .jexcel_content`);

    handleScrollSampleDataTableCore(
        tableId,
        $scrollToLeftSpan,
        $scrollToLeftOneStepSpan,
        $scrollToRightSpan,
        $scrollToRightOneStepSpan,
        $procConfigContent,
    );
};

/**
 * handleScrollSampleDataTableCore
 * @param {string} tableId
 * @param {jQuery} $scrollToLeftSpan
 * @param {jQuery} $scrollToLeftOneStepSpan
 * @param {jQuery} $scrollToRightSpan
 * @param {jQuery} $scrollToRightOneStepSpan
 * @param {jQuery} $procConfigContent
 */
const handleScrollSampleDataTableCore = (
    tableId,
    $scrollToLeftSpan,
    $scrollToLeftOneStepSpan,
    $scrollToRightSpan,
    $scrollToRightOneStepSpan,
    $procConfigContent,
) => {
    const lenColumnSample = 10;
    $scrollToLeftSpan.off('click');
    $scrollToLeftSpan.on('click', function () {
        gotoScroll(0);
    });

    $scrollToLeftOneStepSpan.off('click');
    $scrollToLeftOneStepSpan.on('click', function () {
        const speadsheet = spreadsheetProcConfig(tableId);
        let sampleDataTableWidth = 0;
        for (let i = 1; i <= lenColumnSample; i++) {
            const sampleDataEle = speadsheet.table.getTableHeaderElement(`sample_data_${i}`);
            sampleDataTableWidth += $(sampleDataEle).width();
        }
        const sampleDataTableTdWidth = sampleDataTableWidth / lenColumnSample;
        const currentScrollLeft = parentScrollLeft();
        let offset = currentScrollLeft - sampleDataTableTdWidth;
        gotoScroll(offset);
    });

    $scrollToRightOneStepSpan.off('click');
    $scrollToRightOneStepSpan.on('click', function () {
        const speadsheet = spreadsheetProcConfig(tableId);
        let sampleDataTableWidth = 0;
        for (let i = 1; i <= lenColumnSample; i++) {
            const sampleDataEle = speadsheet.table.getTableHeaderElement(`sample_data_${i}`);
            sampleDataTableWidth += $(sampleDataEle).width();
        }
        const sampleDataTableTdWidth = sampleDataTableWidth / lenColumnSample;
        const currentScrollLeft = parentScrollLeft();
        let offset = currentScrollLeft + sampleDataTableTdWidth;
        gotoScroll(offset);
    });

    $scrollToRightSpan.off('click');
    $scrollToRightSpan.on('click', function () {
        const speadsheet = spreadsheetProcConfig(tableId);
        let sampleDataTableWidth = 0;
        for (let i = 1; i <= lenColumnSample; i++) {
            const sampleDataEle = speadsheet.table.getTableHeaderElement(`sample_data_${i}`);
            sampleDataTableWidth += $(sampleDataEle).width();
        }
        gotoScroll(sampleDataTableWidth);
    });

    const parentScrollLeft = () => {
        return $procConfigContent.scrollLeft();
    };

    const gotoScroll = (offset) => {
        $procConfigContent.animate(
            {
                scrollLeft: offset,
            },
            1000,
        );
    };
};

/**
 * Handle Hover Process Columns Table Row
 * @param {HTMLBodyElement?} processColumnsTableBody
 * @param {HTMLBodyElement?} processColumnsSampleDataTableBody
 */
const handleHoverProcessColumnsTableRow = (
    processColumnsTableBody = null,
    processColumnsSampleDataTableBody = null,
) => {
    const $processColumnsTableBody = processColumnsTableBody
        ? $(processColumnsTableBody)
        : procModalElements.processColumnsTableBody;
    const $processColumnsSampleDataTableBody = processColumnsSampleDataTableBody
        ? $(processColumnsSampleDataTableBody)
        : procModalElements.processColumnsSampleDataTableBody;

    $processColumnsTableBody.find('tr').off('mouseenter');
    $processColumnsTableBody.find('tr').on('mouseenter', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        $processColumnsSampleDataTableBody.find('tr').removeClass('hovered');
        $processColumnsTableBody.find('tr').removeClass('hovered');
        $processColumnsSampleDataTableBody.find(`tr:eq(${index})`).addClass('hovered');
    });

    $processColumnsTableBody.find('tr').off('mouseleave');
    $processColumnsTableBody.find('tr').on('mouseleave', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        $processColumnsSampleDataTableBody.find(`tr:eq(${index})`).removeClass('hovered');
    });

    $processColumnsSampleDataTableBody.find('tr').off('mouseenter');
    $processColumnsSampleDataTableBody.find('tr').on('mouseenter', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        $processColumnsTableBody.find('tr').removeClass('hovered');
        $processColumnsSampleDataTableBody.find('tr').removeClass('hovered');
        $processColumnsTableBody.find(`tr:eq(${index})`).addClass('hovered');
    });

    $processColumnsSampleDataTableBody.find('tr').off('mouseleave');
    $processColumnsSampleDataTableBody.find('tr').on('mouseleave', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        $processColumnsTableBody.find(`tr:eq(${index})`).removeClass('hovered');
    });
};

// handle hover table  row in table: mergeModeSettingContent
const handleHoverTableRowInMergeMode = () => {
    const mouseEnter = (e) => {
        let index = $(e.currentTarget).index();
        $(procModalElements.mergeModeTableRow)
            .filter(function () {
                return $(this).index() === index;
            })
            .addClass('hovered');
    };
    const mouseLeaver = (e) => {
        $(procModalElements.mergeModeTableRow).removeClass('hovered');
    };
    $(procModalElements.mergeModeTableRow)
        .off('mouseenter', mouseEnter)
        .off('mouseleave', mouseLeaver)
        .on('mouseenter', mouseEnter)
        .on('mouseleave', mouseLeaver);
};

const isDuplicateProcessNameSystemName = () => {
    const isNameEnDup = checkDuplicateProcessName('', false);
    removeDuplicateClass('column-name-invalid');
    return isNameEnDup;
};

const isMergeModeFromProcConfig = () => {
    let listDataSourceName = [];
    let isSameDataSource = false;
    let isDuplicatedSystemName = isDuplicateProcessNameSystemName();
    const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];

    // system name of parent process
    currentProcessName = procModalElements.proc.val();

    let currentDataSourceName = getSelectedOptionOfSelect(procModalElements.databases).text();

    const listProcessCurrentName = allProcesses.filter((ds) => ds['name_en'] === currentProcessName);

    if (isEmpty(currentDataSourceName)) {
        return false;
    }

    listProcessCurrentName.filter((ds) => listDataSourceName.push(ds?.data_source?.name));

    if (listDataSourceName.indexOf(currentDataSourceName) > -1) {
        isSameDataSource = true;
    }

    // data source is DB
    const csvAndV2DsType = [DB_CONFIGS.CSV.configs.type, DB_CONFIGS.V2.configs.type];
    const processDsType = listProcessCurrentName[0]?.data_source?.type;
    const isDatabaseDSource = !csvAndV2DsType.includes(processDsType);

    return !!(isDuplicatedSystemName && !isSameDataSource) || !!(isDuplicatedSystemName && isDatabaseDSource);
};

const showModalConfirmMergeMode = () => {
    $(procModalElements.confirmMergeMode).modal('show');
};

const mergeModeProcess = async (procId, dataRowID, baseProc, dbsId) => {
    loading.css('z-index', 9999);
    loading.show();
    clearMergeModeModal();
    $(procModalElements.confirmMergeMode).modal('hide');
    procModalElements.procModal.modal('hide');
    procModalElements.procMergeModeModal.modal('show');
    $('#mergeProcDatasourceName').attr('disabled', false);
    procModalElements.childEtlFuncWarningMark = $('#mergeModeModalBody #optional-func-warning-mark');
    //set attribute for Ok btn
    $(procModalElements.confirmImportDataBtn).attr('data-is-merge-mode', true);

    // set current proc
    procModalCurrentProcId = procId;

    if (!baseProc) {
        const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];
        baseProc = allProcesses.find((process) => process['name_en'] === currentProcessName);
    }

    let isFactoryDB = false;
    // load databases
    const filteredDbInfo = await getAllDatabaseConfig();

    // value of key 'processName' is always 'baseProc.name_en'
    const procNames = {
        processName: baseProc?.name_en || '',
        processJapaneseName: baseProc?.name_jp || '',
        processLocalName: baseProc?.name_local || '',
    };
    // update name
    Object.entries(procNames).forEach(([name, value]) => {
        procModalElements.procMergeModeModal.find(`input[name="${name}"]`).attr('title', value).val(value);
        procModalElements.procMergeModeModal.find(`input[name="${name}"]`).attr('disabled', 'disabled');
    });
    // get datasource selection
    const database = procModalElements.procMergeModeModal.find('select[name=databaseName]')[0];
    // get current datasource selected
    const selectedDatasourceID =
        $(`tr[data-rowid=${dataRowID}] select[name=databaseName]`).val() ??
        $(`tr[id=${dataRowID}]`).attr('data-ds-id') ??
        $(`tr[data-rowid=${dataRowID}]`).attr('data-ds-id');

    let selectedTblID;

    // check if click preview btn in mergeMode modal
    if (isClickPreviewMergeMode) {
        selectedTblID = procModalElements.mergeModeTables.val();
    } else {
        selectedTblID =
            $(`tr[data-rowid=${dataRowID}] select[name=tableName]`).val() ??
            $(`tr[id=${dataRowID}] input[name=tableName]`).val() ?? // get id when created proc_config
            $(`tr[data-rowid=${dataRowID}] input[name=tableName]`).val();
    }
    // reset datasource
    $(database).html('');

    if (filteredDbInfo) {
        const selectedDs = database
            ? $(database).val()
                ? $(database).val()
                : selectedDatasourceID || procDsSelected
            : null;
        const currentDs = procModalElements.dsID.val() || dbsId || selectedDs;
        filteredDbInfo.forEach((ds) => {
            if (!ds.db_detail && ds.id === baseProc.data_source_id) return;
            const options = {
                type: ds.type,
                value: ds.id,
                text: ds.name,
                title: ds.en_name,
            };
            if (String(options.value) === String(selectedDatasourceID) || (currentDs && ds.id === Number(currentDs))) {
                options.selected = 'selected';
            }
            $(database).append($('<option/>', options));
        });

        // Load tables for merge mode modal
        procModalElements.mergeModeTables.empty();
        if (currentDs) {
            const selectedDbInfo = filteredDbInfo.filter((db) => Number(db.id) === Number(currentDs))[0];
            if (
                ![DB.DB_CONFIGS.CSV.type.toLowerCase(), DB.DB_CONFIGS.V2.type.toLowerCase()].includes(
                    selectedDbInfo.type.toLowerCase(),
                ) ||
                dbsId
            ) {
                const defaultDSID = selectedDs || selectedDbInfo.id;
                isFactoryDB = true;
                await loadMergeModeTables(defaultDSID, dataRowID, selectedTblID);
                procModalElements.childOptionalFunctions.prop('disabled', false);
            } else {
                procModalElements.mergeModeTables.prop('disabled', true);
                procModalElements.childOptionalFunctions.prop('disabled', true);
            }
        } else {
            procModalElements.mergeModeTables.append(
                $('<option/>', {
                    value: '',
                    text: '---',
                }),
            );
            procModalElements.mergeModeTables.prop('disabled', true);
            procModalElements.childOptionalFunctions.prop('disabled', true);
        }
    }

    if (isFactoryDB) {
        procModalElements.childOptionalFunctions.prop('disabled', !!procId);
        if (selectedTblID) {
            await loadInfoTableWithMergeMode(procId, baseProc, selectedTblID);
        }
    } else {
        await loadInfoTableWithMergeMode(procId, baseProc);
        procModalElements.mergeModeTables.attr('disabled', true);
    }
    addAttributeToElement();
    loading.hide();
};

const loadInfoTableWithMergeMode = async (procId, baseProc, tableName) => {
    // get data for child and parent processes
    const procModalForm = $(procModalElements.procMergeModeModal).find(procModalElements.mergeProcFormId);
    const processFactId = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('process_fact_id') || '';
    const masterType = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('master_type') || '';

    const formDataChildProc = new FormData(procModalForm[0]);
    const formDataParentProc = new FormData();
    const [_, baseProcColsData] = await getProcessColumnsInfo(baseProc.id);
    let mergedColumns = [];
    let procInfo = null;
    if (procId) {
        // opening modal of a merged proc
        $('#createOrUpdateChildProcCfgBtn').hide();
        $(procModalElements.showPreviewBtnToMerge).hide();
        $('#mergeProcDatasourceName').attr('disabled', true);
        $('#childTableName').attr('disabled', true);
        [procInfo, mergedColumns] = await getProcessColumnsInfo(procId);
        procModalElements.childOptionalFunctions.val(procInfo.etl_func);
    } else {
        // new merge proc
        $('#createOrUpdateChildProcCfgBtn').show();
        $(procModalElements.showPreviewBtnToMerge).show();
        $('#mergeProcDatasourceName').attr('disabled', false);
        $('#childTableName').attr('disabled', false);
    }
    baseProcDataCols = JSON.parse(JSON.stringify(baseProcColsData));

    formDataParentProc.set('databaseName', baseProc.data_source_id);
    if (baseProc.process_factid) {
        formDataParentProc.set('processFactId', baseProc.process_factid);
    }
    if (baseProc.master_type) {
        formDataParentProc.set('masterType', baseProc.master_type);
    }
    if (baseProc.table_name !== '') {
        formDataParentProc.set('tableName', baseProc.table_name);
        formDataParentProc.set('etlFunc', baseProc.etl_func || '');
    }
    if (tableName) {
        formDataChildProc.set('tableName', tableName);
        formDataChildProc.set('etlFunc', $(procModalElements.childOptionalFunctions).val());
    }
    formDataChildProc.set('processFactId', processFactId);
    if (masterType) {
        formDataChildProc.set('masterType', masterType);
    }
    baseProcObj = baseProc;
    const baseProcData = await getLatestRecordsFromApi(formDataParentProc);
    childProcData = await getLatestRecordsFromApi(formDataChildProc);

    // Display etl function error
    if (childProcData.transform_error) {
        showWarningMark(
            procModalElements.childEtlFuncWarningMark,
            procModalElements.alertProcessConfigMergeModeErrorMsg,
            childProcData.transform_error,
        );
    }

    const dummyDatetimeIdx = baseProcData.dummy_datetime_idx;
    const dummyChildDatetimeIdx = childProcData.dummy_datetime_idx;
    const colsMapping = generateMergeModeColumnMapping(baseProcDataCols, childProcData.cols, mergedColumns);

    if (colsMapping.length > baseProcDataCols.length) {
        baseProcDataCols.push(...Array(colsMapping.length - baseProcDataCols.length).fill({}));
    }

    generateParentProcessTable(baseProcDataCols, baseProcData.rows, dummyDatetimeIdx);
    generateChildProcessColumns(baseProcColsData, colsMapping, childProcData.rows, dummyChildDatetimeIdx);
    generateChildProcessTable(colsMapping, childProcData.rows, dummyChildDatetimeIdx);
    isClickPreviewMergeMode = false;
    handleHoverTableRowInMergeMode();
    if (typeof inputMutationObserver !== 'undefined') {
        // inject events for process table's input
        inputMutationObserver.injectEvents();
    }
};

const removeDuplicateClass = (cl) => {
    procModalElements.proc.removeClass(cl);
    procModalElements.procLocalName.removeClass(cl);
    procModalElements.procJapaneseName.removeClass(cl);
};

const isDuplicatedProcessNameDataRow = (procName, nameLocale = 'en') => {
    const existingProcIdMasterNames = getExistingProcIdMasterNames(nameLocale);
    // check for duplication
    const beingEditedProcName = procName;
    const existingMasterNames = Object.values(existingProcIdMasterNames);

    const isEditingSameProc = existingProcIdMasterNames[currentProcItem?.data('proc-id')] === beingEditedProcName;

    const isDuplicatedProc = beingEditedProcName && existingMasterNames.includes(beingEditedProcName);

    return !isEditingSameProc && isDuplicatedProc;
};
const getExistingProcIdMasterNames = (nameLocale) => {
    const processNameDataKey = nameLocale === 'en' ? 'name-local' : 'name-jp';
    const existingProcIdMasterNames = {};
    $('#tblProcConfig tbody tr').each(function f() {
        const procId = $(this).data('proc-id');
        const rowId = $(this).attr('id');
        const isRowChildProc = !isEmpty($(this).data('proc-parent-id'));
        if (rowId && !isRowChildProc) {
            const rowSelector = `#${rowId} input[name=processName]`;
            // since the UI displays system name when local or JP name is not defined,
            // the check should apply according to the UI
            existingProcIdMasterNames[`${procId}`] =
                $(rowSelector).attr(`data-${processNameDataKey}`) || $(rowSelector).attr('data-name-en');
        }
    });
    return existingProcIdMasterNames;
};

const getBaseProcessInfo = (parentID = '', childProcName, nameLocale) => {
    if (parentID) return processes[parentID];
    // Get all process existing
    const existingProcIdMasterNames = getExistingProcIdMasterNames(nameLocale);
    const [baseData] = Object.entries(existingProcIdMasterNames).filter(
        ([id, v]) => v === childProcName && processes[id] && !processes[id].parent_id,
    );
    if (baseData) {
        const [baseId] = baseData;
        return processes[baseId];
    }
    return null;
};

const getLatestRecordsFromApi = async (formData) => {
    let data = null;
    try {
        await $.ajax({
            url: '/ap/api/setting/show_latest_records',
            data: formData,
            dataType: 'json',
            type: 'POST',
            contentType: false,
            processData: false,
            success: (json) => {
                data = json;
            },
            error: (e) => {
                console.log('error', e);
                data = e.responseJSON;
            },
        });
    } catch (e) {
        data = e.responseJSON;
    }
    return data;
};

const getProcessColumnsInfo = async (procId) => {
    let data = null;
    let columns = null;
    await $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success: (json) => {
            data = json.data;
            columns = data.columns.filter((col) => !col.function_details.length);
        },
        error: (e) => {
            console.log('error', e);
            data = null;
            columns = null;
        },
    });
    return [data, columns];
};

const generateParentProcessTable = (cols, rows, dummyDatetimeIdx) => {
    // generate row htmls here
    let tableContent = ``;
    let sampleContent = ``;
    cols.forEach((col, i) => {
        const getKey = DataTypeDropdown_Controller.getAttrKeyOfDataTypeItem(col);
        const col_raw_name = col.column_raw_name || '';
        const col_en_name = col.name_en || '';
        const col_jp_name = col.name_jp || '';
        const col_data_type = !isEmpty(col)
            ? DataTypeDropdown_Controller.translateDatatypeName({ ...col, value: col.data_type }, getKey)
            : '';
        const col_id = col.id || '';
        const col_name = col.column_name || '';

        const rowHtml = `
            <tr>
                <td class="text-center show-raw-text row-item column-number" 
                    data-column-id="${col_id}" data-col-idx="${i}">${i + 1}</td>
                <td class="show-raw-text parent-column-system-name" title="${col_raw_name || col_name}">
                    ${col_raw_name || col_name}
                </td>
                <td class="show-raw-text parent-column-japanese-name" title="${col_jp_name}">
                    ${col_jp_name}
                </td>
                <td class="show-raw-text parent-column-local-name" title="${col_en_name}">
                    ${col_en_name}
                </td>
                <td class="show-raw-text parent-column-data-type" title="${col_data_type}">
                    ${col_data_type}
                </td>
                <td class="show-raw-text parent-column-raw-name" title="${col_raw_name}">
                    ${col_raw_name}
                </td>
            </tr>
        `;
        tableContent += rowHtml;

        // generate sample data
        const checkedAtr = 'checked=checked';
        sampleContent += `<tr>${generateSampleData(rows, dummyDatetimeIdx, col, i, checkedAtr).join('')}</tr>`;
    });

    $(procModalElements.parentProcessColumnsTableBody).html(tableContent);
    $(procModalElements.processColumnsMergeModeBaseTableBody).html(sampleContent);
};

const generateChildProcessTable = (cols, rows, dummyDatetimeIdx) => {
    // generate row htmls here
    let sampleContent = ``;
    cols.forEach((col, i) => {
        const checkedAtr = 'checked=checked';
        sampleContent += `<tr column-name="${col.column_name || col.column_raw_name || ''}">${generateSampleData(rows, dummyDatetimeIdx, col, i, checkedAtr).join('')}</tr>`;
    });
    // generate sample data
    $(procModalElements.processColumnsMergeModeChildTableBody).html(sampleContent);
};

const generateSampleData = (rows, dummyDatetimeIdx, col, i, checkedAtr) => {
    // parent and child processes are likely to generate the same way
    return rows.map((row) => {
        const key = col.column_name; //col.column_name ||
        let val;
        const columnColor = dummyDatetimeIdx === i ? ' dummy_datetime_col' : '';
        switch (col.data_type) {
            case DataTypes.DATETIME.name:
                val = parseDatetimeStr(row[col.column_name]);
                break;
            case DataTypes.DATE.name:
                val = parseDatetimeStr(row[col.column_name], true);
                break;
            case DataTypes.TIME.name:
                val = parseTimeStr(row[col.column_name]);
                break;
            case DataTypes.INTEGER.name:
                val = row[key];
                val = parseIntData(val);
                break;
            case DataTypes.REAL.name:
                val = row[key];
                val = parseFloatData(val);
                break;
            default:
                val = row[key];
        }
        const isKSep = [DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(col.data_type);
        return `<td style="color: ${isKSep ? 'orange' : ''}" data-original="${row[col.column_name] || ''}" class="sample-data row-item show-raw-text${columnColor}" ${checkedAtr}> ${!isEmpty(val) ? val : ''} </td>`;
    });
};

const generateMergeModeColumnMapping = (baseCols, childCols, mergedColumns = []) => {
    const baseColumnsName = baseCols.map((item) => item.column_name || item.column_raw_name);
    const dictMergedCol = {};
    mergedColumns.forEach((col) => {
        const childMergedCol = col.column_name || col.column_raw_name;
        const parentMergedCol = col.parent_column.column_name || col.parent_column.column_raw_name;
        dictMergedCol[parentMergedCol] = childMergedCol;
    });
    const cloneChildCols = JSON.parse(JSON.stringify(childCols));
    const colsMappingIndex = [];
    const colsMapping = baseColumnsName.map((key) => {
        const mapCol = dictMergedCol[key] || key;
        const index = childCols.findIndex((item) => item.column_name === mapCol || item.column_raw_name === mapCol);
        if (index === -1) {
            return {};
        }
        colsMappingIndex.push(index);
        return childCols[index];
    });
    colsMappingIndex.sort((a, b) => b - a);
    const childNoMapping = cloneChildCols.filter((_, index) => !colsMappingIndex.includes(index));
    return [...colsMapping, ...childNoMapping];
};

const generateChildProcessColumns = (baseCols, cols, rows, dummyChildDatetimeIdx) => {
    let tableContent = ``;
    const colsName = cols.filter((item) => Object.keys(item).length > 0).map((e) => e.column_name || e.column_raw_name);
    cols.forEach((col, i) => {
        const col_raw_name = col.column_raw_name || '';
        const col_name = col.column_name || '';
        const showName = col_name || col_raw_name;
        const options = colsName.map(function (option, i) {
            if (option === showName) {
                return `<option value="${option}" selected="selected" data-col-name="${option}">${option}</option>`;
            } else {
                return `<option value="${option}" data-col-name="${option}">${option}</option>`;
            }
        });
        const tableOptions = ['<option value="">---</option>', ...options].join('');
        let tdHtml = `<td class='column-format'>
                                <select name='merge-mode-column-name' org-selected='${showName}' old-selected='${showName}' class='form-control' data-observer='${showName}' onchange='changeMergeColumnOption(this, ${dummyChildDatetimeIdx})'>
                                    ${tableOptions}
                                </select>
                            </td>`;
        if (i >= baseCols.length) {
            tdHtml = `<td class='column-format' style='padding: 0 8px;' column-name='${showName}' title="${showName}">
                        ${showName}
                      </td>`;
        }
        const rowHtml = `<tr>${tdHtml}</tr>`;
        tableContent += rowHtml;
    });
    $(procModalElements.processColumnsMergeModeTableBody).html(tableContent);
};

const changeMergeColumnOption = (elem, dummyDatetimeIdx) => {
    const currentOptionValue = $(elem).val();
    const oldSelected = $(elem).attr('old-selected');
    const currentRowIndex = $(elem).closest('tr').index();
    const checkedAtr = 'checked=checked';
    const baseCols = baseProcDataCols.filter((baseProc) => Object.keys(baseProc).length !== 0);
    const cols = generateMergeModeColumnMapping(baseCols, childProcData.cols);
    const rows = childProcData.rows;
    const colOldIndex = cols.findIndex((col) => col.column_name === oldSelected || col.column_raw_name === oldSelected);
    $(elem).attr('old-selected', currentOptionValue);
    if (currentOptionValue === '') {
        $(procModalElements.processColumnsMergeModeChildTableRow)
            .eq(currentRowIndex)
            .attr('column-name', '')
            .find('td')
            .text('');
        if (oldSelected && colOldIndex !== -1) {
            createNewMergeModeTableRow(rows, dummyDatetimeIdx, cols[colOldIndex], colOldIndex, checkedAtr);
        }
        handleHoverTableRowInMergeMode();
        return;
    }
    const optionsSameValue = $(procModalElements.processColumnsMergeModeTableSelectOption)
        .not(elem)
        .find(`option[value="${currentOptionValue}"]:selected`);
    const tdSameValue = $(procModalElements.processColumnsMergeModeTableBody)
        .not(elem)
        .find(`td[column-name="${currentOptionValue}"]`);
    if (optionsSameValue.length) {
        optionsSameValue.closest('select').val('');
        const rowsChildSampleDataMapping = $(procModalElements.processColumnsMergeModeChildTableBody).find(
            `tr[column-name="${currentOptionValue}"]`,
        );
        rowsChildSampleDataMapping.attr('column-name', '').find('td').text('');
    }
    if (tdSameValue.length) {
        $(procModalElements.parentProcessColumnsTableBody + ' tr:last').remove();
        $(procModalElements.processColumnsMergeModeChildTableBody + ' tr')
            .eq(tdSameValue.closest('tr').index())
            .remove();
        $(procModalElements.processColumnsMergeModeBaseTableBody + ' tr:last').remove();
        tdSameValue.closest('tr').remove();
    }

    const colIndex = cols.findIndex(
        (elem) => elem.column_name === currentOptionValue || elem.column_raw_name === currentOptionValue,
    );
    const sampleData = `<tr column-name="${currentOptionValue}">${generateSampleData(rows, dummyDatetimeIdx, cols[colIndex], colIndex, checkedAtr).join('')}</tr>`;
    $(procModalElements.processColumnsMergeModeChildTableRow).eq(currentRowIndex).after(sampleData);
    $(procModalElements.processColumnsMergeModeChildTableRow).eq(currentRowIndex).remove();
    if (oldSelected && colOldIndex !== -1) {
        createNewMergeModeTableRow(rows, dummyDatetimeIdx, cols[colOldIndex], colOldIndex, checkedAtr);
    }
    handleHoverTableRowInMergeMode();
};

const createNewMergeModeTableRow = (rows, dummyDatetimeIdx, col, colIndex, checkedAtr) => {
    const columnName = col.column_name || col.column_raw_name || '';
    if (
        !columnName ||
        $(procModalElements.processColumnsMergeModeChildTableRow + `[column-name="${columnName}"]`).length
    )
        return;
    const sampleData = `<tr column-name="${columnName}">${generateSampleData(rows, dummyDatetimeIdx, col, colIndex, checkedAtr).join('')}</tr>`;
    const parentProcessNo = $(procModalElements.parentProcessColumnsTableBody).find(`tr`).length + 1;
    const emptyParentProcessRow = `
        <tr>
            <td class="text-center show-raw-text row-item column-number" data-column-id="" data-col-idx="">${parentProcessNo}</td>
            <td class="show-raw-text parent-column-system-name">
            </td>
            <td class="show-raw-text parent-column-japanese-name">
            </td>
            <td class="show-raw-text parent-column-local-name">
            </td>
            <td class="show-raw-text parent-column-data-type">
            </td>
            <td class="show-raw-text parent-column-raw-name">
            </td>
        </tr>`;
    const cloneBaseDataRow = $(procModalElements.processColumnsMergeModeBaseTableBody).find(`tr:last`).clone();

    cloneBaseDataRow.find('td').attr(DATA_ORIGINAL_ATTR, '').text('');

    $(procModalElements.processColumnsMergeModeTableBody).append(
        `<tr><td class='column-format' style='padding: 0 8px;' column-name = '${columnName}' title="${columnName}">${columnName}</td></tr>`,
    );
    $(procModalElements.parentProcessColumnsTableBody).append(emptyParentProcessRow);
    $(procModalElements.processColumnsMergeModeChildTableBody).append(sampleData);
    $(procModalElements.processColumnsMergeModeBaseTableBody).append(cloneBaseDataRow);
};

const clearMergeModeModal = () => {
    $(procModalElements.parentProcessColumnsTableBody).empty();
    $(procModalElements.processColumnsMergeModeTableBody).empty();
    $(procModalElements.processColumnsMergeModeBaseTableBody).empty();
    $(procModalElements.processColumnsMergeModeChildTableBody).empty();
    $(procModalElements.childOptionalFunctions).val('').prop('disabled', true);
    $(procModalElements.childOptionalFunctions).hide();
    // clear baseProcData
    childProcData = null;
    baseProcObj = null;
    baseProcDataCols = null;
};

const resizeMaxHeightProcColumnTable = () => {
    const elementFunction = document.getElementById('functionSettingWithCollapse');
    const functionAreaRect = elementFunction.getBoundingClientRect();
    const screenHeight = window.innerHeight;
    if (functionAreaRect.bottom > screenHeight) {
        const functionAreaHidden = Math.ceil(functionAreaRect.bottom - screenHeight);
        const maxHeightColumnTable = `calc(100vh - ${370 + functionAreaHidden}px`;
        $('#procSettingContent .proc-config-content').css('max-height', maxHeightColumnTable);
    }
};

const GenerateDefaultImportFilterTable = (procId) => {
    const columnsImportFilters =
        currentProcDataCols
            .filter((proc) => proc.import_filters?.length)
            .map((proc) => proc.import_filters)
            .flat() || [];
    let filterData = [
        {
            id: null,
            process_id: null,
            column_id: null,
            filter_function: conditionFormula.matches.value,
            value: '',
            order: 1,
            filter_id: null,
            delete_button: deleteButton,
        },
    ];
    if (procId && columnsImportFilters.length) {
        filterData = columnsImportFilters.map((item, index) => {
            const isFilterMatches = item.filter_function === 'SUBSTRING';
            return {
                id: item.id,
                process_id: procId,
                column_id: item.column_id,
                filter_function: item.filter_function,
                value: item.filters.map((e) => e.value).join(';'),
                order: index + 1,
                filter_id: item.filters[0].filter_id,
                filter_from_pos: isFilterMatches ? item.filter_from_position : '',
                delete_button: deleteButton,
            };
        });
    }
    // clear table
    const table = jspreadsheetTable(filterConditionElements.importFilterTable);
    table.destroyTable();
    const spreadsheet = SpreadSheetFilterConfig.create(filterConditionElements.importFilterTable, filterData, {
        importFilter: true,
    });
    $(filterConditionElements.addImportConditionBtn).prop('disabled', false);
    if (procId) {
        $(filterConditionElements.addImportConditionBtn).prop('disabled', true);
        $(`#${filterConditionElements.importFilterTable} tbody td`).addClass('disabled-input');
    }
};

const isSelectedMainSerialInProcessConfig = () => {
    // check process config has column selected main:serial
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const mainSerialRow = spreadsheet.mainSerialRow();
    return mainSerialRow && mainSerialRow[PROCESS_COLUMNS.is_checked].data;
};

$(`${procModalElements.mergeModeTableChild} table tbody`).on('scroll', function () {
    $(`${procModalElements.mergeModeTableBase} table tbody`).scrollLeft($(this).scrollLeft());
});

$(`${procModalElements.mergeModeTableBase} table tbody`).on('scroll', function () {
    $(`${procModalElements.mergeModeTableChild} table tbody`).scrollLeft($(this).scrollLeft());
});

$(procModalElements.collapseFunctionConfigID).on('shown.bs.collapse', function (event) {
    const elmFunction = document.querySelector(procModalElements.collapseFunctionConfigID);
    elmFunction.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
});

const addStateInitialize = () => {
    const columnDataType = $('.column-data-type');
    columnDataType.attr('is-initialize', 'true');
    columnDataType.removeClass('disabled');
};

const enableDummyDateTimeOrDateTimeGeneratedChecked = () => {
    if (typeof spreadsheetProcConfig != 'undefined') {
        const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
        const dummyDateTimeRow = spreadsheet.dummyDateTimeRow();
        const generatedDateTimeRow = spreadsheet.rowsByDataTypes(
            DataTypes.DATETIME.name,
            DataTypes.TIME.name,
            DataTypes.DATE.name,
        );

        if (dummyDateTimeRow) {
            removeClassReadOnly(dummyDateTimeRow, spreadsheet);
        }

        if (generatedDateTimeRow) {
            generatedDateTimeRow.forEach((row) => {
                removeClassReadOnly(row, spreadsheet);
            });
        }
    }
};

const removeClassReadOnly = (row, spreadsheet) => {
    const rowIndex = row.is_checked.rowIndex;
    const colIndex = row.is_checked.columnIndex;
    const eleIsCheck = spreadsheet.table.getCellFromCoords(colIndex, rowIndex);
    eleIsCheck.classList.remove(READONLY_CLASS, 'disabled');
};

const enableDatetimeDataType = () => {
    addStateInitialize();
    // reset checkbox
    procModalElements.procDateTimeFormatCheckbox.prop('checked', false);
    procModalElements.procDateTimeFormatCheckbox.prop('disabled', false);

    // reset input
    procModalElements.procDateTimeFormatInput.prop('disabled', false);
    procModalElements.procDateTimeFormatInput.attr('placeholder', DATETIME_FORMAT_PLACE_HOLDER);

    // Enable "Import condition"
    $(`#${filterConditionElements.importFilterTable} tbody td`).removeClass('disabled-input');
    setStatusButton();
    // enableDummyDateTimeOrDateTimeGeneratedChecked();
};
