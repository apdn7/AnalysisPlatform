const HTTP_RESPONSE_CODE_500 = 500;
const SAMPLE_DATA_KEY = 'sample_data';
const FALSE_VALUES = new Set(['', 0, '0', false, 'false', 'FALSE', 'f', 'F']);
const NUMERIC_TYPES = [
    DataTypes.REAL.name,
    DataTypes.INTEGER.name,
    DataTypes.EU_REAL_SEP.name,
    DataTypes.REAL_SEP.name,
    DataTypes.INTEGER_SEP.name,
    DataTypes.EU_INTEGER_SEP.name,
];
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
let latestRecordsFormData = null;
let latestRecordsPreviewGeneration = null;
let procSampleDataLength = {};

// Mirrors PreviewProcessingStage.IMPORTED returned by the preview APIs
const PREVIEW_PROCESSING_STAGE_IMPORTED = 'imported';
let prcRawDataWith1000Data = {};
let prcPreviewWith1000Data = {};
let prcPreviewDataOfFunctionColumn = {};
// Process column ids whose raw samples came from IMPORTED (already datetime-formatted) data
let importedSampleProcessColumnIds = new Set();
let functionSampleBatchByProcessColumnId = new Map();
let functionSampleRequestId = 0;
let uniqueSampleDataByColumn = {};
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
let isEnableFormulaForDs = false;
let childProcData = null;
let baseProcObj = null;
let baseProcDataCols = null;
let selectedFunctionNameEle = '';
/** @type {function(): Promise} */
let showRecordsBtnFunc;

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
    comment: $('#procSettingModal textarea[name=cfgProcComment]'),
    label: $('#procSettingModal select[id=cfgProcLabel]'),
    isShowFileName: $('#procSettingModal input[name=isShowFileName]'),
    databases: $('#procSettingModal select[name=databaseName]'),
    databasesMergeMode: $('#procSettingMergeModeModal select[name=databaseName]'),
    mergeProcComment: $('#procSettingMergeModeModal textarea#mergeProcComment'),
    tables: $('#procSettingModal select[name=tableName]'),
    optionalFunctions: $('#procSettingModal select[name=cfgOptionalFunction]'),
    childOptionalFunctions: $('#mergeModeModalBody select[name=cfgOptionalFunctionChild]'),
    showRecordsBtn: $('#procSettingModal button[name=showRecords]'),
    previewUpdateBtn: $('#procSettingModal button[name=previewUpdate]'),
    confirmPreviewUpdateModal: $('#confirmPreviewUpdateModal'),
    confirmPreviewUpdateBtn: $('#confirmPreviewUpdateModal button[name=confirmPreviewUpdate]'),
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
    reRegisterChildProcBtn: $('#procSettingMergeModeModal button[name=reRegisterChildProcBtn]'),
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
    alertColumnNameModifiedWarningMsg: '#alertColumnNameModifiedWarningMsg',
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
    filterColumnClassName: '.column-filter',
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
    mergeModeLabel: $('#procSettingMergeModeModal select[id=cfgProcLabelMergeMode]'),
    mergeModeInputComment: $('#procSettingMergeModeModal textarea[name=cfgProcComment]'),
    mergeProcSearchInput: $('#procSettingMergeModeModal input#mergeProcSearchInput'),
    generatedDateTimeColumnName: 'DatetimeGenerated',
    collapseFunctionConfigID: '#functionSettingWithCollapse',
    functionConfigTableID: 'processColumnsTable_functionTable',
    alertReferenceFileErrorID: '#alertReferenceFileErrorMsg',
    alertProcessConfigErrorID: '#alertProcessConfigErrorMsg',
    alertProcessConfigMergeModeErrorMsg: '#alertProcessConfigMergeModeErrorMsg',
    procConfigTableName: 'processColumnsTable',
    /**
     * In first load, i element will be changed to svg element
     * @type {function(): HTMLOrSVGElement}
     * */
    settingChangeMark: () => document.getElementById('procSettingChangeMark'),
    sampleDataDisplayRecordsRadio: $('#sampleDataRecords'),
    // for merge mode modals
    confirmMergeProcReRegisterBtn: $('#confirmMergeProcReRegisterBtn'),
    confirmMergeProcReRegisterModal: $('#confirmMergeProcReRegisterModal'),
    processLabelsField: $('#cfgProcLabel'),
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
    i18nEnglishName: '#i18nEnglishName',
    i18nJapaneseName: '#i18nJapaneseName',
    i18nLocalName: '#i18nLocalName',
    i18nUnit: '#i18nUnit',
    i18nJudgeFormulaTitle: '#i18nJudgeFormulaTitle',
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
    i18nProcessRegisterFailedMsg: '#i18nProcessRegisterFailedMsg',
    i18nMsgErrorUncheckColumn: '#i18nErrorUncheckColumn',
    i18nloadTablesFailedMsg: $('#i18nloadTablesFailedMsg').text(),
    i18nDataTypeEventsHint: '#i18nDataTypeEventsHint',
    i18nDataTypeProcNameStrHover: '#i18nDataTypeProcNameStrHover',
    i18nProcNameStr: '#i18nProcNameStr',
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
    formula: 'formula',
    raw_data_type: 'raw_data_type',
    is_serial_no: 'is_serial_no',
    is_get_date: 'is_get_date',
    is_file_name: 'is_file_name',
    is_auto_increment: 'is_auto_increment',
    is_dummy_datetime: 'is_dummy_datetime',
    is_generated_datetime: 'is_generated_datetime',
    is_null: 'is_null',
    filter: 'filter',
    is_judge: 'is_judge',
    judge_available: 'judge_available',
};

const isJPLocale = docCookies.isJaLocale();
const translateToEng = async (text) => {
    const result = await fetchData('/ap/api/setting/to_eng', JSON.stringify({ colname: text }), 'POST');
    return result;
};

const updateProcessPreviewButtons = (referenceFileValid = true) => {
    const selectedSource = getSelectedOptionOfSelect(procModalElements.databases);
    const sourceType = selectedSource.attr('type')?.toLowerCase();
    const needsTable = sourceType && ![...DB_CONFIG_CSV_TYPES, DB.DB_CONFIGS.WEB_API.type].includes(sourceType);
    const canPreview = Boolean(
        referenceFileValid && selectedSource.val() && (!needsTable || procModalElements.tables.val()),
    );
    procModalElements.showRecordsBtn.prop('disabled', !canPreview);
    procModalElements.previewUpdateBtn.prop('disabled', !canPreview || !procModalCurrentProcId);
};

const invalidateProcessPreview = () => {
    prcPreviewData = null;
    latestRecordsFormData = null;
    latestRecordsPreviewGeneration = null;
    currentProcColumns = null;
    currentProcDataCols = [];
    currentLatestProcDataCols = [];
    clearDerivedSampleCaches();
    clearProcModalColumnTable(procModalElements.procConfigTableName);
    updateProcessPreviewButtons();
};

const clearDerivedSampleCaches = () => {
    prcRawDataWith1000Data = {};
    prcPreviewWith1000Data = {};
    prcPreviewDataOfFunctionColumn = {};
    importedSampleProcessColumnIds = new Set();
    functionSampleBatchByProcessColumnId = new Map();
    functionSampleRequestId += 1;
    uniqueSampleDataByColumn = {};
};

const setProcessName = async (dataRowID = null) => {
    updateProcessPreviewButtons();
    const procDOM = $(`#tblProcConfig tr[data-rowid=${dataRowID}]`);
    const procNameInput = procModalElements.proc.val();
    const ignoreRenameProcess = procModalElements.optionalFunctions.data(DATA_IGNORE_CHANGE);

    if (userEditedProcName && procNameInput) {
        invalidateProcessPreview();
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

    const selectedDsType = dsSelection.attr('type') || null;
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
        let combineProcName = '';
        // software workshop does not put datasource name into process name when selecting table
        if (
            [
                DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs.type,
                DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type,
            ].includes(selectedDsType)
        ) {
            combineProcName = firstTableName ? `${firstTableName}` : dsNameSelection;
        } else {
            combineProcName = firstTableName ? `${dsNameSelection}_${firstTableName}` : dsNameSelection;
        }
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

    const dsIsDB =
        selectedDsType &&
        ![DB_CONFIGS.CSV.configs.type, DB_CONFIGS.V2.configs.type, DB_CONFIGS.WEB.configs.type].includes(
            selectedDsType,
        );

    const canPreview = (dsIsDB && dsNameSelection && tableNameSelection) || (!dsIsDB && dsNameSelection);
    if (!procModalCurrentProcId && canPreview) {
        invalidateProcessPreview();
        // Load the datasource preview once on a cold open. This is a normal
        // (non-refresh) request: the backend serves a cached datasource preview when
        // one exists and otherwise reads the source exactly once to generate and cache
        // it. Preview Update remains the only path that force-refreshes from the source.
        await loadProcessPreview(false);
    }
};

// --- Table-based data source general-info layout ---------------------------
// Every data source that exposes the テーブル名 / オプション機能 block (i.e. any
// table-based source: regular DB, Snowflake, Software Workshop, ... - anything
// that is NOT CSV and NOT Web API) uses a rearranged general-info block: the
// source column stacks データソース -> テーブル名 / オプション機能 / Show ->
// ラベル / Preview Update, leaving only コメント in the comment column.
// An unselected source uses the same layout, with the source-dependent controls disabled.
// CSV keeps its own server-rendered layout; Web API shows neither block. The
// single field instances are physically relocated (never duplicated) so element
// IDs stay unique; a hidden anchor remembers each field's home position so the
// default layout is restored for CSV / Web API. Relocation is idempotent across
// repeated modal opens / data source switches.
let procInfoLayoutAnchored = false;

const anchorProcInfoField = ($node, key) => {
    if (!$node.length || $node.attr('data-proc-home')) return;
    $node.attr('data-proc-home', key);
    // [hidden] -> display:none, so the anchor never participates in flex/grid layout.
    $(`<span class="proc-info-home-anchor" data-proc-home-for="${key}" hidden></span>`).insertBefore($node);
};

const ensureProcInfoLayoutAnchors = () => {
    if (procInfoLayoutAnchored) return;
    const $info = $('#processGeneralInfo');
    if (!$info.length) return;
    anchorProcInfoField($info.find('button[name=showRecords]').first(), 'showBtn');
    anchorProcInfoField($info.find('button[name=previewUpdate]').first(), 'previewBtn');
    anchorProcInfoField($info.find('.proc-table-name-row').first(), 'tableRow');
    anchorProcInfoField($info.find('.proc-optional-function-label-wrap').first(), 'optLabel');
    anchorProcInfoField($info.find('.proc-optional-function-col').first(), 'optCol');
    // ラベル row = the .form-group.row wrapper that holds #cfgProcLabel (keeps the
    // select2 markup that lives next to the <select> intact when relocated).
    anchorProcInfoField($('#cfgProcLabel').closest('.form-group.row'), 'labelRow');
    procInfoLayoutAnchored = true;
};

const restoreProcInfoField = (key) => {
    const $node = $(`[data-proc-home="${key}"]`).first();
    const $anchor = $(`.proc-info-home-anchor[data-proc-home-for="${key}"]`).first();
    if ($node.length && $anchor.length) $anchor.after($node);
};

const applyProcInfoLayoutForTableDataSource = (isTableDataSource) => {
    const $info = $('#processGeneralInfo');
    if (!$info.length) return;

    if (isTableDataSource) {
        ensureProcInfoLayoutAnchors();
        $info.addClass('proc-table-ds-layout');

        const $sourceCol = $info.find('.proc-general-info-source-col').first();
        const $tableRow = $(`[data-proc-home="tableRow"]`).first();
        const $labelRow = $(`[data-proc-home="labelRow"]`).first();

        // Move the existing nodes, including Select2 markup and bound handlers.
        // Keep the label row last so repeated opens/switches preserve all three rows.
        $labelRow.before($tableRow);
        $tableRow.append($(`[data-proc-home="optLabel"]`).first());
        $tableRow.append($(`[data-proc-home="optCol"]`).first());
        $tableRow.append($(`[data-proc-home="showBtn"]`).first());
        $sourceCol.append($labelRow);
        $labelRow.find('.proc-preview-row').append($(`[data-proc-home="previewBtn"]`).first());
    } else if ($info.hasClass('proc-table-ds-layout')) {
        $info.removeClass('proc-table-ds-layout');
        // Restore the table row first: it carries optCol's anchor back to its home.
        restoreProcInfoField('tableRow');
        restoreProcInfoField('optCol');
        restoreProcInfoField('optLabel');
        // labelRow first (carries previewBtn's anchor), then the Preview Update button.
        restoreProcInfoField('labelRow');
        restoreProcInfoField('previewBtn');
        restoreProcInfoField('showBtn');
    }
};

// reload tables after change
const loadTables = async (databaseId, dataRowID = null, selectedTbl = null) => {
    // if new row have process name, set new process name in modal
    if (!databaseId || isEmpty(databaseId)) {
        procModalElements.tables.empty();
        procModalElements.fileName.prop('disabled', false);
        applyProcInfoLayoutForTableDataSource(true);
        $(procModalElements.fileInputPreview).hide();
        $(procModalElements.grTableDropdown).show();
        propGroupTableDropdown(true);
        await setProcessName(dataRowID);
        return;
    }
    procModalElements.tables.empty();
    updateProcessPreviewButtons();
    propGroupTableDropdown(false);
    clearProcModalColumnTable(procModalElements.procConfigTableName);

    // const isHiddenFileInput = $(procModalElements.fileInputPreview).hasClass('hide');
    // const isHiddenDbTble = $(procModalElements.grTableDropdown).hasClass('hide');

    const loadingObj = loadingHandler();

    try {
        loadingObj.show();
        const res = await $.ajax({
            url: `api/setting/database_table/${databaseId}`,
            method: 'GET',
            cache: false,
        });

        // Rearrange the general-info block for any table-based data source (shows
        // the テーブル名 dropdown); restore the default layout for CSV / Web API.
        const dsTypeLower = res.ds_type.toLowerCase();
        // Web API keeps the reference row for alignment but cannot use a local file.
        procModalElements.fileName.prop('disabled', dsTypeLower === DB.DB_CONFIGS.WEB_API.type);
        const isTableBasedDs =
            !!res.tables && !DB_CONFIG_CSV_TYPES.includes(dsTypeLower) && dsTypeLower !== DB.DB_CONFIGS.WEB_API.type;
        applyProcInfoLayoutForTableDataSource(isTableBasedDs);

        // Update visibility before awaiting the preview so restored fields cannot
        // flash in their home positions while the request is pending.
        if (DB_CONFIG_CSV_TYPES.includes(res.ds_type.toLowerCase())) {
            // enable formula input
            isEnableFormulaForDs = true;
            procModalElements.tables.empty();
            propGroupTableDropdown(true);
            // hide 'table' dropdown if there is CSV datasource
            $(procModalElements.fileInputPreview).show();
            $(procModalElements.grTableDropdown).hide();
            if (!procModalCurrentProcId) {
                // new process, should enable file name
                resetIsShowFileName();
                await setProcessName(dataRowID);
            }
        } else if (res.ds_type.toLowerCase() === DB.DB_CONFIGS.WEB_API.type) {
            isEnableFormulaForDs = false;
            disableIsShowFileName();

            // Preserve the preview row when reference files do not apply.
            $(procModalElements.fileInputPreview).show();
            $(procModalElements.grTableDropdown).hide();
            if (!procModalCurrentProcId) {
                await setProcessName(dataRowID);
            }
        } else if (res.tables) {
            isEnableFormulaForDs = false;
            disableIsShowFileName();
            loadTableNameSelectOptions(res, selectedTbl, procModalElements.tables);

            if (!selectedTbl) {
                procModalElements.tables.val('');
            }

            $(procModalElements.fileInputPreview).hide();
            $(procModalElements.grTableDropdown).show();
            if (!procModalCurrentProcId) {
                await setProcessName(dataRowID);
            }
        }
    } catch (e) {
        showToastrMsg(procModali18n.i18nloadTablesFailedMsg, MESSAGE_LEVEL.ERROR);
    } finally {
        updateProcessPreviewButtons();
        loadingObj.hide();
    }
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
    const isSoftwareWorkshop = data?.ds_type === DB_CONFIGS.POSTGRES_SOFTWARE_WORKSHOP.configs.type;
    const isSWSnowflake = data?.ds_type === DB_CONFIGS.SNOWFLAKE_SOFTWARE_WORKSHOP.configs.type;
    const processFactIds = data?.process_factids;
    const masterTypes = data?.master_types;
    data?.tables.forEach(function (tbl, index) {
        const options = {
            value: tbl,
            text: tbl,
            process_fact_id: isSoftwareWorkshop || isSWSnowflake ? processFactIds[index] : '',
            master_type: isSoftwareWorkshop || isSWSnowflake ? masterTypes[index] : '',
        };
        if (optSelected && tbl === optSelected) {
            options.selected = 'selected';
        }
        elemTbl.append($('<option/>', options));
    });
};

// load current proc name, database name and tables name

// const displayDataSourceFieldsByType = (datasourceType) => {
//     if([])
// }

const loadProcModal = async (procId = null, dataRowID = null, dbsId = null) => {
    // set current proc
    procModalCurrentProcId = procId;
    procModalElements.showRecordsBtn.prop('disabled', true);
    procModalElements.previewUpdateBtn.prop('disabled', true);

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

        const isCSVDS = selectedDbInfo && DB_CONFIG_CSV_TYPES.includes(selectedDbInfo.type.toLowerCase());
        const isWebApiDS = selectedDbInfo && selectedDbInfo.type.toLowerCase() === DB.DB_CONFIGS.WEB_API.type;
        procModalElements.fileName.prop('disabled', Boolean(isWebApiDS));

        // Set the data source fields (File name vs Table Name/Optional function) directly
        // for the current open. Do NOT defer this to `shown.bs.modal`: the modal is shown
        // earlier (inside getProcInfo) and its fade transition often completes before this
        // async loadProcModal finishes, so a handler registered here would fire one open
        // late and display the previously opened process's field type. Setting display
        // synchronously here is deterministic and works whether or not the modal is
        // already visible.
        if (isWebApiDS) {
            $(procModalElements.fileInputPreview).show();
            $(procModalElements.grTableDropdown).hide();
        } else if (isCSVDS) {
            $(procModalElements.fileInputPreview).show();
            $(procModalElements.grTableDropdown).hide();
        } else if (!selectedDbInfo) {
            // Default to the DB layout; the empty-source branch below disables its controls.
            $(procModalElements.fileInputPreview).hide();
            $(procModalElements.grTableDropdown).show();
        } else {
            $(procModalElements.fileInputPreview).hide();
            $(procModalElements.grTableDropdown).show();
        }

        // Unselected and table-based sources share the DB layout. CSV / Web API
        // restore their own layout when a source is chosen.
        applyProcInfoLayoutForTableDataSource(!isCSVDS && !isWebApiDS);
        updateProcessPreviewButtons();

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
                ![DB.DB_CONFIGS.CSV.type, DB.DB_CONFIGS.V2.type, DB.DB_CONFIGS.WEB_API.type].includes(
                    selectedDbInfo.type.toLowerCase(),
                ) ||
                dbsId
            ) {
                const defaultDSID = selectedDs || selectedDbInfo.id;
                await loadTables(defaultDSID, dataRowID, selectedTbls);
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
            await setProcessName(dataRowId);
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
    if (tableId === 'processColumnsTable') {
        document.getElementById('procPaginationPages').replaceChildren();
        document.getElementById('procPaginationToolbar').classList.add('d-none');
    }
    // remove old table
    const spreadsheet = spreadsheetProcConfig(tableId);
    spreadsheet.table.destroyTable();
};

const generateProcessList = async (
    tableId,
    cols,
    rows,
    uniqueDataCategory,
    uniqueDataReal,
    uniqueDataInt,
    uniqueDataIntCat,
    { fromRegenerate = false, autoCheckSerial = false, registerByFile = false } = {},
) => {
    clearProcModalColumnTable(tableId);
    if (!cols || !cols.length) {
        return;
    }

    procSampleDataLength[tableId] = rows.length;

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
                judge_available: col.judge_available,
                filter: col.filter,
                formula: col.formula,
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

    const hasMainDate = cols.filter((col) => col.column_type == masterDataGroup.MAIN_DATE).length > 0;
    const hasMainTime = cols.filter((col) => col.column_type == masterDataGroup.MAIN_TIME).length > 0;
    const uniqueDataCategoryRows = [];
    const uniqueDataRealRows = [];
    const uniqueDataIntRows = [];
    const uniqueDataIntCatRows = [];
    let dataRows = [];

    if (hasMainTime && hasMainDate) {
        sortedCols = _.sortBy(sortedCols, (item) => !item.is_get_date);
    }

    sortedCols.forEach((col, i) => {
        // TODO: there are a lot of complicated if-else logic here between registered and unregistered. Can we separate them somehow?
        const column_raw_name = col.column_raw_name;
        const isGeneratedDatetime = hasMainDate && hasMainTime && col.is_get_date;
        // get judge_available result from show_latest_record before col is replaced by registerCol
        const judge_available = col.judge_available;
        const predictedFormula = col.formula; // predicted formula from show_latest_record
        const filter = col.filter;
        // registerCol will be defined when the column already exists in the DB
        const registerCol = dicProcessCols[col.column_name];
        col = fromRegenerate ? col : registerCol || col;
        col.judge_available = judge_available;
        // prioritize registered formula
        // when registered formula is empty, fill with predicted formula (to be used when changing to Judge column type)
        col.formula = registerCol ? registerCol.formula || predictedFormula : predictedFormula;
        col.is_show = true;

        // apply filter from spreadsheet not from registerCol
        col.filter = filter;
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
            } else if (col.is_judge) {
                col.column_type = masterDataGroup.JUDGE;
            } else {
                if (!col.column_type || !isMasterDataColumn(col.column_type)) {
                    // currently it is safe to do this, as BOOLEAN still has GENERATED column_type
                    col.column_type = masterDataGroup.GENERATED;
                }
                // if it is master data column (filter system), do not change column type
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

    // update index for special case
    dataRows = updateIndexForSpecialRow(dataRows);
    uniqueDataCategory = uniqueDataCategory || [];
    uniqueDataReal = uniqueDataReal || [];
    uniqueDataInt = uniqueDataInt || [];
    uniqueDataIntCat = uniqueDataIntCat || [];
    dataRows.forEach((dataRow) => {
        uniqueDataCategoryRows.push(uniqueDataCategory.map((data) => data[dataRow.column_name]));
        uniqueDataRealRows.push(uniqueDataReal.map((data) => data[dataRow.column_name]));
        uniqueDataIntRows.push(uniqueDataInt.map((data) => data[dataRow.column_name]));
        uniqueDataIntCatRows.push(uniqueDataIntCat.map((data) => data[dataRow.column_name]));
    });

    const spreadsheet = SpreadSheetProcessConfig.create(tableId, dataRows, registerByFile);
    spreadsheet.updateUniqueSampleDataAttributes(
        uniqueDataCategoryRows,
        uniqueDataRealRows,
        uniqueDataIntRows,
        uniqueDataIntCatRows,
        ...spreadsheet.table.getRowsByHeadersAndIndexes(),
    );

    spreadsheet.table.takeSnapshotForTracingChanges(SpreadSheetProcessConfig.trackingHeaders());
    // Need this check, so we can know whether we should show change mark for new process.
    spreadsheet.handleChangeMark();

    parseEUDataTypeInFirstTimeLoad();

    if (!fromRegenerate) {
        showConfirmSameAndNullValueInColumn(sortedCols);
    }

    if (!isRegisterProc) {
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

const cloneFormData = (formData) => {
    const clonedFormData = new FormData();
    for (const [key, value] of formData.entries()) {
        clonedFormData.append(key, value);
    }
    return clonedFormData;
};

const refreshLatestRecordsGeneration = async (formData) => {
    let refreshed = false;
    try {
        await $.ajax({
            url: '/ap/api/setting/show_latest_records',
            data: cloneFormData(formData),
            dataType: 'json',
            type: 'POST',
            contentType: false,
            processData: false,
            success: (_json, _textStatus, jqXHR) => {
                latestRecordsPreviewGeneration = jqXHR.getResponseHeader('X-Preview-Generation');
                refreshed = Boolean(latestRecordsPreviewGeneration);
            },
            error: (error) => console.log('error', error),
        });
    } catch (error) {
        console.log('error', error);
    }
    return refreshed;
};

const UNIQUE_SAMPLE_COLUMN_BATCH_SIZE = 100;
const UNIQUE_SAMPLE_RESPONSE_KEYS = [
    'unique_rows_as_category',
    'unique_rows_as_real',
    'unique_rows_as_int',
    'unique_rows_as_int_cat',
];

const getUniqueSampleDataFromApi = async (formData) => {
    const result = { data: null, status: null };
    try {
        await $.ajax({
            url: '/ap/api/setting/show_latest_records_unique_sample',
            data: formData,
            dataType: 'json',
            type: 'POST',
            contentType: false,
            processData: false,
            success: (json, _textStatus, jqXHR) => {
                result.data = json;
                result.status = jqXHR.status;
            },
            error: (e) => {
                console.log('error', e);
                result.data = e.responseJSON;
                result.status = e.status;
            },
        });
    } catch (e) {
        result.data = e.responseJSON;
        result.status = e.status;
    }
    return result;
};

const mergeUniqueSampleData = (target, source) => {
    UNIQUE_SAMPLE_RESPONSE_KEYS.forEach((responseKey) => {
        (source?.[responseKey] || []).forEach((row, index) => {
            target[responseKey][index] = { ...target[responseKey][index], ...row };
        });
    });
    return target;
};

const mergeUniqueSampleDataByColumn = (source) => {
    UNIQUE_SAMPLE_RESPONSE_KEYS.forEach((responseKey) => {
        (source?.[responseKey] || []).forEach((row, index) => {
            Object.entries(row).forEach(([columnName, values]) => {
                const cachedValues = [...(uniqueSampleDataByColumn[columnName]?.[responseKey] || [])];
                cachedValues[index] = values;
                uniqueSampleDataByColumn[columnName] = {
                    ...uniqueSampleDataByColumn[columnName],
                    [responseKey]: cachedValues,
                };
            });
        });
    });
};

const getRenderedProcessRows = (spreadsheet) => {
    const rowIndexes = [...spreadsheet.table.table.tbody.rows]
        .map((row) => Number(row.dataset.y))
        .filter(Number.isInteger);
    return spreadsheet.table.getRowsByHeadersAndIndexes(undefined, rowIndexes);
};

const getMissingUniqueSampleColumns = (spreadsheet) => {
    const cachedColumnNames = new Set(Object.keys(uniqueSampleDataByColumn));

    const columnRawNames = {};
    const columnNames = [];
    getRenderedProcessRows(spreadsheet).forEach((row) => {
        const columnName = row[PROCESS_COLUMNS.column_name]?.data;
        if (!columnName || cachedColumnNames.has(columnName) || columnNames.includes(columnName)) return;
        columnNames.push(columnName);
        columnRawNames[columnName] = row[PROCESS_COLUMNS.column_raw_name]?.data || columnName;
    });
    return { columnNames, columnRawNames };
};

const getUniqueSampleDataInBatchesOnce = async (formData, columnNames, columnRawNames, previewGeneration) => {
    const mergedData = Object.fromEntries(UNIQUE_SAMPLE_RESPONSE_KEYS.map((responseKey) => [responseKey, []]));
    for (let start = 0; start < columnNames.length; start += UNIQUE_SAMPLE_COLUMN_BATCH_SIZE) {
        const batchColumnNames = columnNames.slice(start, start + UNIQUE_SAMPLE_COLUMN_BATCH_SIZE);
        const batchColumnRawNames = Object.fromEntries(
            batchColumnNames.map((columnName) => [columnName, columnRawNames[columnName] || columnName]),
        );
        const batchFormData = cloneFormData(formData);
        batchFormData.set('columnNames', JSON.stringify(batchColumnNames));
        batchFormData.set('columnRawNames', JSON.stringify(batchColumnRawNames));
        batchFormData.set('previewGeneration', previewGeneration);
        const batchResult = await getUniqueSampleDataFromApi(batchFormData);
        if (batchResult.status !== 200) return batchResult;
        mergeUniqueSampleData(mergedData, batchResult.data);
    }
    return { data: mergedData, status: 200 };
};

const getUniqueSampleDataInBatches = async (formData, columnNames, columnRawNames) => {
    const previewGeneration = latestRecordsPreviewGeneration;
    let result = await getUniqueSampleDataInBatchesOnce(formData, columnNames, columnRawNames, previewGeneration);
    if (result.status === 409 && (await refreshLatestRecordsGeneration(formData))) {
        const retryGeneration = latestRecordsPreviewGeneration;
        result = await getUniqueSampleDataInBatchesOnce(formData, columnNames, columnRawNames, retryGeneration);
    }
    return result.status === 200 ? result.data : null;
};

const hasUniqueSampleData = (data) => {
    return Boolean(
        data &&
        (data.unique_rows_as_category?.length ||
            data.unique_rows_as_real?.length ||
            data.unique_rows_as_int?.length ||
            data.unique_rows_as_int_cat?.length),
    );
};

const ensureUniqueSampleData = async (spreadsheet) => {
    if (!latestRecordsFormData) {
        return false;
    }

    const { columnNames, columnRawNames } = getMissingUniqueSampleColumns(spreadsheet);
    if (!columnNames.length) return Object.keys(uniqueSampleDataByColumn).length > 0;

    const loadingObj = loadingHandler('#configLoadingScreen');
    loadingObj.show();
    let uniqueSampleData = null;
    try {
        const formData = cloneFormData(latestRecordsFormData);
        if (formData.get('isV2Datasource') === 'true') {
            const sectionElement = spreadsheet.table.table.el.closest('[id^="procSettingModalBody_"]');
            const processOriginNameElement = sectionElement?.querySelector('input[name="processOriginName"]');
            if (processOriginNameElement?.value) {
                formData.set('filteredProcessName', processOriginNameElement.value);
            }
        }
        uniqueSampleData = await getUniqueSampleDataInBatches(formData, columnNames, columnRawNames);
    } finally {
        loadingObj.hide();
    }

    if (!hasUniqueSampleData(uniqueSampleData)) {
        return false;
    }

    mergeUniqueSampleDataByColumn(uniqueSampleData);

    const rows = getRenderedProcessRows(spreadsheet);
    const uniqueDataCategoryRows = [];
    const uniqueDataRealRows = [];
    const uniqueDataIntRows = [];
    const uniqueDataIntCatRows = [];
    rows.forEach((row) => {
        const columnName = row[PROCESS_COLUMNS.column_name].data;
        const cachedData = uniqueSampleDataByColumn[columnName] || {};
        uniqueDataCategoryRows.push(cachedData.unique_rows_as_category || []);
        uniqueDataRealRows.push(cachedData.unique_rows_as_real || []);
        uniqueDataIntRows.push(cachedData.unique_rows_as_int || []);
        uniqueDataIntCatRows.push(cachedData.unique_rows_as_int_cat || []);
    });
    spreadsheet.updateUniqueSampleDataAttributes(
        uniqueDataCategoryRows,
        uniqueDataRealRows,
        uniqueDataIntRows,
        uniqueDataIntCatRows,
        ...rows,
    );
    return true;
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

const updateIndexForSpecialRow = (dataRows) => {
    //sort remove index case to top
    return [...dataRows.filter((row) => checkSpecialRow(row)), ...dataRows.filter((row) => !checkSpecialRow(row))];
};

const cleanOldData = () => {
    // clear user editted input flag
    userEditedProcName = false;
    clearDerivedSampleCaches();

    // clear old procInfo
    currentProcColumns = null;
    $(procModalElements.prcSM).html('');
    $(procModalElements.settingContent).removeClass('hide');
    $(procModalElements.prcSM).parent().addClass('hide');

    procModalElements.comment.val('');
    procModalElements.label.val([]).trigger('change');
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
    procModalElements.mergeModeLabel.val([]).trigger('change');
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
        const { selectedAll, autoSelectedAll } = spreadsheet.getSelectionCheckboxStatus();

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
    const selectedRows = spreadsheet.getCheckboxRowsForSelection(autoSelect);
    spreadsheet.bulkUpdateCheckboxStatus(selectedRows, isChecked);
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
    const speadSheet = await generateProcessList(
        procModalElements.procConfigTableName,
        json.cols,
        json.rows,
        json.unique_rows_as_category,
        json.unique_rows_as_real,
        json.unique_rows_as_int,
        json.unique_rows_as_int_cat,
    );
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
        // Default uncheck file name if not disabled
        if (!procModalElements.isShowFileName.prop('disabled')) {
            procModalElements.isShowFileName.prop('checked', false).trigger('change');
        }
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
/* prettier-ignore */
const showLatestRecords = (formData, clearSelectedColumnBody = true) => new Promise((resolve) => {
    const loadingObj = loadingHandler();
    loadingObj.show();
    hideAlertMessages();
    $.ajax({
        url: '/ap/api/setting/show_latest_records',
        data: formData,
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: async (json, _textStatus, jqXHR) => {
            // A failed refresh must leave the current preview and its sample context intact.
            latestRecordsFormData = cloneFormData(formData);
            // Generation retries and lazy samples must never replay a confirmed external refresh.
            latestRecordsFormData.delete('refreshPreview');
            latestRecordsPreviewGeneration = jqXHR.getResponseHeader('X-Preview-Generation');
            loadingObj.hide();
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
            if (!isEmpty(json.message)) {
                // if column name was modified from datasource
                displayRegisterMessage(procModalElements.alertColumnNameModifiedWarningMsg, {
                    message: json.message,
                    is_warning: true,
                });
            }
            clearDerivedSampleCaches();
            prcPreviewData = { ...json, rows: json.rows.slice(0, 10) };
            currentLatestProcDataCols = prcPreviewData
                ? prcPreviewData.cols.map((col, index) => {
                      return { ...col, id: -index - 1 };
                  })
                : [];
            prcPreviewData.cols = currentLatestProcDataCols;
            if (!currentProcess) {
                // show predict labels
                procModalElements.label.val(prcPreviewData.labels).trigger('change');
            }
            if (json.is_legacy_preview) {
                prcPreviewWith1000Data = {};
                prcPreviewDataOfFunctionColumn = {};
            } else {
                await getProcessPreviewWith1000Data(json.rows, isImportedPreviewStage(json.processing_stage));
            }
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
            if (isInitialize) {
                enableColumnAfterInitialize();
            }
            resolve();
        },
        error: (e) => {
            let errorResponse = e.responseJSON;
            if (!errorResponse && e.responseText) {
                try {
                    errorResponse = JSON.parse(e.responseText);
                } catch (_error) {
                    errorResponse = null;
                }
            }
            if (errorResponse?.transform_error) {
                showWarningMark(
                    procModalElements.etlFuncWarningMark,
                    procModalElements.alertProcessConfigErrorID,
                    errorResponse.transform_error,
                );
            }
            if (!isEmpty(errorResponse?.message)) {
                displayRegisterMessage(procModalElements.alertColumnNameModifiedWarningMsg, {
                    message: errorResponse.message,
                    is_warning: true,
                });
            }
            loadingObj.hide();
            console.log('error', e);
            resolve();
        },
    });
});

const loadProcessPreview = async (refreshPreview = false) => {
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
    // Set currentProcessId in order to include registered Process configuration.
    if (procModalCurrentProcId) {
        formData.set('currentProcessId', procModalCurrentProcId);
    }
    formData.set('limit', 10);
    if (currentOptionalFunction) {
        formData.set('etlFunc', currentOptionalFunction);
    }
    formData.set('filter', JSON.stringify(getFilterExpression()));
    if (refreshPreview) {
        formData.set('refreshPreview', 'true');
    }
    preventSelectAll(true);

    if (procModalCurrentProcId) {
        $(procModalElements.isShowFileName).prop('disabled', true);
    }

    $(procModalElements.selectAllColumn).css('display', 'block');
    $(procModalElements.autoSelectAllColumn).css('display', 'block');
    procModalElements.etlFuncWarningMark.hide();
    resetSampleDataDisplayModeRadio();
    await showLatestRecords(formData, clearDataFlg);
};

const loadLocalProcessPreview = async () => loadProcessPreview(false);

const getProcessPreviewWith1000Data = async (rows, isImportedData = false) => {
    // prcPreviewWith1000Data = json;
    currentProcDataCols = procModalCurrentProcId ? currentProcDataCols : currentLatestProcDataCols;

    // convert data to {col_a: [...], col_b: [...]}
    const json1000 = [...rows];

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
        setSampleDataImported(columnId, isImportedData);
        const parseValues = await parseDataByDataType(dataType, values, false, false, isImportedData);
        prcPreviewWith1000Data[columnId] = parseValues;
    }
};

const isImportedPreviewStage = (processingStage) => processingStage === PREVIEW_PROCESSING_STAGE_IMPORTED;

const setSampleDataImported = (processColumnId, isImportedData) => {
    if (isImportedData) {
        importedSampleProcessColumnIds.add(Number(processColumnId));
    } else {
        importedSampleProcessColumnIds.delete(Number(processColumnId));
    }
};

const isSampleDataImported = (processColumnId) => importedSampleProcessColumnIds.has(Number(processColumnId));

const parseDataByDataType = async (dataType, values, isBigInt = false, isJudge = false, isImportedData = false) => {
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
            values = await parseProcDatetimeFormatSampleData(dataType, values, isImportedData);
            break;
        case DataTypes.DATE.name:
            values = await parseProcDatetimeFormatSampleData(dataType, values, isImportedData);
            break;
        case DataTypes.TIME.name:
            values = await parseProcDatetimeFormatSampleData(dataType, values, isImportedData);
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
            values = values.map((value) => (value === null ? '' : trimBoth(String(value))));
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
    const systemNameInput = $(ele).closest('[name="processGeneralInfo"]').find(`input[name=${targetEle}]`);
    if (!$(systemNameInput).val()) {
        $(systemNameInput).val(await convertEnglishRomaji([$(ele).val()]));
        $(systemNameInput)[0].dataset.originalValue = $(systemNameInput).val();
    }
};

const handleEmptySystemName = async (ele, targetEle) => {
    const systemNameInput = $(ele).closest('[name="processGeneralInfo"]').find(`input[name=${targetEle}]`);
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
        nameErrors.add(
            `${$(procModali18n.duplicatedSystemName).text() || ''} (${_.escape(Object.keys(duplicatedEnglishNames).join(', '))})`,
        );
        showBorderRedClass(duplicatedEnglishNames);
    }
    if (!_.isEmpty(duplicatedJapaneseNames)) {
        nameErrors.add(
            `${$(procModali18n.duplicatedJapaneseName).text() || ''} (${_.escape(Object.keys(duplicatedJapaneseNames).join(', '))})`,
        );
        showBorderRedClass(duplicatedJapaneseNames);
    }
    if (!_.isEmpty(duplicatedLocalNames)) {
        nameErrors.add(
            `${$(procModali18n.duplicatedLocalName).text() || ''} (${_.escape(Object.keys(duplicatedLocalNames).join(', '))})`,
        );
        showBorderRedClass(duplicatedLocalNames);
    }

    nameErrors.delete('');
    return Array.from(nameErrors) || [];
};

const checkDuplicateProcessName = async (
    isShowMsg = true,
    checkNameEn = true,
    checkNameJP = true,
    checkNameLocal = true,
) => {
    if (!checkOnFocus) return;
    const procId = currentProcItem.data('proc-id') || null;
    const nameEnInput = procModalElements.proc;
    const nameJpInput = procModalElements.procJapaneseName;
    const nameLocalInput = procModalElements.procLocalName;
    const data = {
        name_en: checkNameEn ? nameEnInput.val() : '',
        name_jp: checkNameJP ? nameJpInput.val() : '',
        name_local: checkNameLocal ? nameLocalInput.val() : '',
        process_id: procId,
    };

    const isDuplicated = await checkDuplicatedProcessNameFromDB(
        data.name_en,
        data.name_jp,
        data.name_local,
        data.process_id,
    );
    const [is_duplicated_en, is_duplicated_jp, is_duplicated_local] = isDuplicated;
    const isValid = isDuplicated.every((val) => !val);
    showMsgCheckDuplicatedProcessName(is_duplicated_en, isShowMsg, nameEnInput);
    showMsgCheckDuplicatedProcessName(is_duplicated_jp, isShowMsg, nameJpInput);
    showMsgCheckDuplicatedProcessName(is_duplicated_local, isShowMsg, nameLocalInput);
    return isValid;
};

const showMsgCheckDuplicatedProcessName = (isDuplicated, isShowMsg, elementInput) => {
    const errorMsg = $(procModalElements.msgProcNameAlreadyExist).text();
    if (isDuplicated) {
        if (isShowMsg) {
            displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
                message: errorMsg,
                is_error: true,
            });
        }
        elementInput.addClass('column-name-invalid');
    } else {
        if (isShowMsg) {
            $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');
        }
        elementInput.removeClass('column-name-invalid');
    }
};

const isDuplicatedProcessName = async () => {
    const isValid = await checkDuplicateProcessName(false);
    if (!isValid) {
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

const validateProcName = async () => {
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

    const notDuplicated = !(await isDuplicatedProcessName());

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
    is_proc_no: 'PROC_NO',
    is_proc_name: 'PROC_NAME',
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
            .map((column, index) => {
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
                    order: index,
                    function_details: [],
                    formula:
                        (isJudgeFormula(column_type) || isDatetimeFormula(column.data_type, column_type)) &&
                        column.formula
                            ? column.formula
                            : null,
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

    // collect labels of process

    // get labels
    const labels = procModalElements.label.select2('data').map((option) => option.text);

    // get uncheck column = all col - uncheck col
    const checkedProcessColumn = procColumns.map((col) => col.column_name);
    const dictFunctionColumns = collectFunctionDatasForRegister();
    // merge function column into normal column
    for (let procColumn of procColumns) {
        if (dictFunctionColumns[procColumn.id]) {
            procColumn.function_details = dictFunctionColumns[procColumn.id].function_details;
            delete dictFunctionColumns[procColumn.id];
        }
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
        },
        unusedColumns,
        labels,
    ];
};

const collectMergeProcCfgData = () => {
    const dataSourceID = procModalElements.databasesMergeMode.val();
    const comment = procModalElements.mergeProcComment.val();
    const labels = procModalElements.mergeModeLabel.select2('data').map((option) => option.text);
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
                    mergedCols.push(colData);
                }
            }
        }
    });
    return [
        {
            id: procModalCurrentProcId,
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
        },
        labels,
    ];
};

const updateProcessConfig = (res) => {
    procModalElements.procModal.modal('hide');
    procModalElements.confirmImportDataModal.modal('hide');
    procModalElements.procMergeModeModal.modal('hide');
    // sync Vis network
    // bulk register can lead to a lot of reloads, we should not let it reload after bulk register at the moment
    if (!res?.bulk_register) {
        reloadTraceConfigFromDB(true);
    }
    $(procModalElements.procModal).on('hidden.bs.modal', () => {
        isV2ProcessConfigOpening = false;
    });

    // update GUI
    if (res.status !== HTTP_RESPONSE_CODE_500) {
        if (res?.bulk_register || !currentProcItem?.length) {
            // process has been registered on backend, enable edit and delete buttons
            const targetProcRow = $(`tr[name="procInfo"][data-proc-id=${res.data.id}]`);
            targetProcRow.find('button.proc-show-detail-btn').prop('disabled', false);
            targetProcRow.find('button.proc-delete-btn').prop('disabled', false);
            targetProcRow.find('.proc-select-checkbox').prop('disabled', false);

            // In case register process failed, show triangle icon. Otherwise, remove icon
            const processStatusDiv = targetProcRow.find('.process-status');
            processStatusDiv.empty();
            processStatusDiv.removeProp('data-status');
            if (res.process_status === 3) {
                const message = $(procModali18n.i18nProcessRegisterFailedMsg).text();
                processStatusDiv.html(
                    '<div class="align-middle text-center" data-st="spinner fa-spin">\n' +
                        '    <div\n' +
                        '        class=""\n' +
                        '        data-toggle="tooltip"\n' +
                        '        data-placement="top"\n' +
                        `        title="${message}\n${res.error_message}"\n` +
                        '    >\n' +
                        '        <i\n' +
                        '            class="fas fa-triangle-exclamation yellow status-i"\n' +
                        '        ></i>\n' +
                        '    </div>\n' +
                        '</div>',
                );
            }
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
                $(currentProcItem).find('td').eq(4).empty();
            }

            $(currentProcItem).find('textarea[name="comment"]').val(res.data.comment).prop('disabled', true);
            $(currentProcItem)
                .find('div.process-labels')
                .html(
                    res.data.labels
                        .map((label) => (label.name ? `<span class="process-label">${label.name}</span>` : ''))
                        .join(''),
                );
            $(currentProcItem).attr('id', `proc_${res.data.id}`);
            $(currentProcItem).attr('data-proc-id', res.data.id);
            $(currentProcItem).attr('data-ds-id', res.data.data_source_id);
            $(currentProcItem).attr('data-proc-parent-id', res.data.parent_id);
            $(currentProcItem).attr('data-test-id', res.data.shown_name);
            $(currentProcItem).find('.proc-select-checkbox').prop('disabled', false).attr('data-proc-id', res.data.id);

            //show new labels
            const isShowAllLabel = isShowAllLabelsInUse();
            res.data.labels?.forEach((label) => {
                addLabelIfNotExist(label.name);
                if (!isShowAllLabel) {
                    activateLabel(label.name);
                }
            });
            showAllLabelsInUse();
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

const saveProcCfg = async (isMergeMode = false, init_parent = false) => {
    clearWarning();
    let [procCfgData, unusedColumns, labels] = [null, [], []];
    if (!isMergeMode) {
        [procCfgData, unusedColumns, labels] = collectProcCfgData();
    } else {
        [procCfgData, labels] = collectMergeProcCfgData();
    }

    if (!procCfgData) {
        // todo : show toarst message
        console.log('Invalid data');
        return false;
    }
    // validate main::Serial
    const serialColumns = procCfgData.columns.filter(
        (column) => column.column_type === DataTypeDropdown_Controller.DataGroupType.MAIN_SERIAL,
    );
    if (serialColumns.length > 1) {
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: 'Duplicated main::Serial column',
            is_error: true,
        });
        return false;
    }
    const isCheckedDatetimeFormat = procModalElements.procDateTimeFormatCheckbox[0].checked;
    procCfgData.datetime_format = isCheckedDatetimeFormat
        ? procModalElements.procDateTimeFormatInput.val().trim()
        : null;
    const data = {
        proc_config: procCfgData,
        unused_columns: unusedColumns,
        init_parent: init_parent, // for merge mode only
        labels: labels,
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
    return true;
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
    $(trEl).find('input[name="processName"]').closest('td').attr('title', res.data.shown_name);
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
    $(element)
        .find(`input[name=${elName}]`)
        .closest('td')
        .attr('title', value ?? '');
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

    // check if main datetime is selected.
    const mainDateTimeRow = spreadsheet.mainDateTimeRow();
    const isGetDateSelected = mainDateTimeRow && mainDateTimeRow[PROCESS_COLUMNS.is_checked].data;

    const isFunctionConfigAvailable =
        document.querySelectorAll(`[id^="${procModalElements.functionConfigTableID}"]`).length != 0;
    let hasMainDatetimeFunctionColumn = false;

    if (isFunctionConfigAvailable) {
        hasMainDatetimeFunctionColumn =
            Object.values(collectFunctionDatasForRegister()).filter((col) => col.is_get_date).length > 0;
    }

    const isValidDatetime = isGetDateSelected || hasMainDatetimeFunctionColumn;
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

const runRegisterProcConfigFlow = async (edit = false) => {
    clearWarning();

    // validate proc name null
    const validateFlg = await validateProcName();
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
 * Paste All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const pasteAllProcSettingInfo = (e) => {
    navigator.clipboard
        .readText()
        .then(async function (text) {
            const tableData = transformCopiedTextToTable(text, true);
            const spreadsheet = getSpreadSheetFromToolsBarElement(e.currentTarget);
            const visibleHeaders = spreadsheet.table.getVisibleHeaders();

            // Reject malformed clipboard data before changing any rows.
            if (
                spreadsheet.table.numberOfRows() !== tableData.length ||
                tableData.some((row) => row.length !== visibleHeaders.length)
            ) {
                showToastrMsg('Number of records mismatch. Please check and copy again', MESSAGE_LEVEL.WARN);
                return;
            }

            const jspreadsheet = spreadsheet.table.table;
            if (jspreadsheet.isCopyingShownDataType) return;

            const data = jspreadsheet.options.data;
            const indexes = {
                shownDataType: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.shown_data_type),
                columnType: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.column_type),
                dataType: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.data_type),
                id: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.id),
                isDummyDatetime: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.is_dummy_datetime),
                nameEn: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.name_en),
                nameJp: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.name_jp),
                nameLocal: spreadsheet.table.getIndexHeaderByName(PROCESS_COLUMNS.name_local),
            };
            const clipboardIndexes = {
                shownDataType: visibleHeaders.findIndex((header) => header.name === PROCESS_COLUMNS.shown_data_type),
                nameEn: visibleHeaders.findIndex((header) => header.name === PROCESS_COLUMNS.name_en),
                nameJp: visibleHeaders.findIndex((header) => header.name === PROCESS_COLUMNS.name_jp),
                nameLocal: visibleHeaders.findIndex((header) => header.name === PROCESS_COLUMNS.name_local),
            };
            const sampleDataDisplayMode = getSampleDataDisplayModeElement(jspreadsheet.el).val();
            const normalizeClipboardValue = (value) => (typeof value === 'string' ? stringNormalization(value) : value);
            const japaneseConversionPlan = [];
            const localConversionPlan = [];

            tableData.forEach((clipboardRow, rowIndex) => {
                // Explicit valid English clipboard intent wins even when a JP/local value also changes.
                const englishValue = correctEnglishName(normalizeClipboardValue(clipboardRow[clipboardIndexes.nameEn]));
                if (String(englishValue).length > 0) return;

                const rowData = data[rowIndex];
                const japaneseValue = normalizeClipboardValue(clipboardRow[clipboardIndexes.nameJp]);
                const localValue = normalizeClipboardValue(clipboardRow[clipboardIndexes.nameLocal]);
                const englishBlanked = String(rowData[indexes.nameEn]).length > 0;
                const japaneseChanged = String(rowData[indexes.nameJp]) !== String(japaneseValue);
                const localChanged = String(rowData[indexes.nameLocal]) !== String(localValue);

                if (String(japaneseValue).length > 0 && (japaneseChanged || (englishBlanked && !localChanged))) {
                    japaneseConversionPlan.push({ rowIndex, value: japaneseValue });
                } else if (String(localValue).length > 0 && (localChanged || englishBlanked)) {
                    localConversionPlan.push({ rowIndex, value: localValue });
                }
            });

            let hasChange = false;
            let reconciliationValues = null;
            const previousIgnoreHistory = jspreadsheet.ignoreHistory;
            const previousIgnoreEvents = jspreadsheet.ignoreEvents;
            const previousCopyingShownDataType = jspreadsheet.isCopyingShownDataType;
            const previousPointerEvents = jspreadsheet.el.style.pointerEvents;

            jspreadsheet.ignoreHistory = true;
            // Bulk mode prevents datatype transitions from scheduling per-row parsing and reconciliation.
            jspreadsheet.isCopyingShownDataType = true;
            jspreadsheet.el.style.pointerEvents = 'none';
            try {
                // Finish all fallible work before datatype staging mutates jspreadsheet.options.data.
                const [convertedJapaneseNames, convertedLocalNames] = await Promise.all([
                    japaneseConversionPlan.length
                        ? convertEnglishRomaji(japaneseConversionPlan.map(({ value }) => value))
                        : [],
                    localConversionPlan.length ? convertNonAscii(localConversionPlan.map(({ value }) => value)) : [],
                ]);
                if (
                    convertedJapaneseNames.length !== japaneseConversionPlan.length ||
                    convertedLocalNames.length !== localConversionPlan.length
                ) {
                    throw new Error('Name conversion returned an unexpected number of results');
                }

                // Apply native cell updates without per-cell name conversion and change tracking.
                jspreadsheet.ignoreEvents = true;
                for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
                    const rowData = data[rowIndex];
                    const clipboardRow = tableData[rowIndex];
                    const shownDataTypeCell = spreadsheet.table.getCellFromCoords(indexes.shownDataType, rowIndex);

                    // Other pages have not loaded their datatype-dependent readonly state yet.
                    spreadsheet.changeShownDataType(rowIndex, rowData[indexes.shownDataType], sampleDataDisplayMode, {
                        isFirstLoad: true,
                    });

                    // Datatype owns the readonly state of later columns, so transition it before loading those values.
                    if (!shownDataTypeCell.classList.contains(READONLY_CLASS)) {
                        const oldShownDataType = rowData[indexes.shownDataType];
                        const beforeColumnType = rowData[indexes.columnType];
                        const shownDataType = spreadsheet.handleBeforeChangeCell(
                            shownDataTypeCell,
                            indexes.shownDataType,
                            rowIndex,
                            clipboardRow[clipboardIndexes.shownDataType],
                        );
                        if (String(oldShownDataType) !== String(shownDataType)) {
                            jspreadsheet.updateCell(indexes.shownDataType, rowIndex, shownDataType);
                            hasChange = true;
                            const columnType = rowData[indexes.columnType];
                            const mainDateTimeTypes = [
                                masterDataGroup.MAIN_DATE,
                                masterDataGroup.MAIN_TIME,
                                masterDataGroup.MAIN_DATETIME,
                            ];
                            if (
                                mainDateTimeTypes.includes(beforeColumnType) ||
                                mainDateTimeTypes.includes(columnType)
                            ) {
                                const shouldPrioritizeMainDatetime =
                                    columnType === masterDataGroup.MAIN_DATETIME &&
                                    reconciliationValues?.[1] !== masterDataGroup.MAIN_DATETIME;
                                if (!reconciliationValues || shouldPrioritizeMainDatetime) {
                                    reconciliationValues = [rowData[indexes.dataType], columnType, beforeColumnType];
                                }
                            }
                        }
                    }

                    for (let visibleColumnIndex = 0; visibleColumnIndex < visibleHeaders.length; visibleColumnIndex++) {
                        const header = visibleHeaders[visibleColumnIndex];
                        if (header.name === PROCESS_COLUMNS.shown_data_type) continue;

                        const cell = spreadsheet.table.getCellFromCoords(header.index, rowIndex);
                        if (cell.classList.contains(READONLY_CLASS)) continue;

                        const oldValue = rowData[header.index];
                        let value = spreadsheet.handleBeforeChangeCell(
                            cell,
                            header.index,
                            rowIndex,
                            clipboardRow[visibleColumnIndex],
                        );
                        if (header.name === PROCESS_COLUMNS.is_checked) {
                            value = value === true || value === 1 || String(value).toLowerCase() === 'true';
                        }
                        if (String(oldValue) === String(value)) continue;

                        jspreadsheet.updateCell(header.index, rowIndex, value);
                        hasChange = true;

                        if (
                            header.name === PROCESS_COLUMNS.is_checked &&
                            !rowData[indexes.isDummyDatetime] &&
                            rowData[indexes.id] < 0 &&
                            [masterDataGroup.MAIN_DATE, masterDataGroup.MAIN_TIME].includes(rowData[indexes.columnType])
                        ) {
                            if (reconciliationValues?.[1] !== masterDataGroup.MAIN_DATETIME) {
                                reconciliationValues = [
                                    rowData[indexes.dataType],
                                    rowData[indexes.columnType],
                                    rowData[indexes.columnType],
                                ];
                            }
                        }
                    }
                }

                japaneseConversionPlan.forEach(({ rowIndex, value }, index) => {
                    const rowData = data[rowIndex];
                    const convertedName = correctEnglishName(convertedJapaneseNames[index]);
                    if (
                        String(rowData[indexes.nameEn]).length === 0 &&
                        String(rowData[indexes.nameJp]) === String(value) &&
                        String(rowData[indexes.nameEn]) !== String(convertedName)
                    ) {
                        jspreadsheet.updateCell(indexes.nameEn, rowIndex, convertedName);
                        hasChange = true;
                    }
                });
                localConversionPlan.forEach(({ rowIndex, value }, index) => {
                    const rowData = data[rowIndex];
                    const convertedName = correctEnglishName(convertedLocalNames[index]);
                    if (
                        String(rowData[indexes.nameEn]).length === 0 &&
                        String(rowData[indexes.nameLocal]) === String(value) &&
                        String(rowData[indexes.nameEn]) !== String(convertedName)
                    ) {
                        jspreadsheet.updateCell(indexes.nameEn, rowIndex, convertedName);
                        hasChange = true;
                    }
                });

                if (hasChange) {
                    jspreadsheet.isCopyingShownDataType = false;
                    // Reconciliation can insert rows, which need the normal row initialization events.
                    jspreadsheet.ignoreEvents = previousIgnoreEvents;
                    if (reconciliationValues) {
                        ProcessConfigSection.handleMainDateAndMainTime(spreadsheet, ...reconciliationValues);
                    }
                    jspreadsheet.ignoreEvents = true;
                    spreadsheet.table.reIndexForSpecialRow(spreadsheet.table);
                    spreadsheet.loadTotalCheckedColumns();
                    spreadsheet.table.recordBulkChange();
                    spreadsheet.handleChangeMark();
                    // Refresh visible samples now; page navigation parses the remaining rows.
                    await Promise.all(
                        [...jspreadsheet.tbody.rows].map((row) => {
                            const rowIndex = Number(row.dataset.y);
                            const rowData = spreadsheet.table.getRowDataByIndex(rowIndex);
                            return parseDataTypeProc(
                                spreadsheet,
                                rowData.raw_data_type,
                                rowIndex,
                                rowData.column_type,
                                sampleDataDisplayMode,
                            );
                        }),
                    );
                }
            } finally {
                jspreadsheet.ignoreHistory = previousIgnoreHistory;
                jspreadsheet.ignoreEvents = previousIgnoreEvents;
                jspreadsheet.isCopyingShownDataType = previousCopyingShownDataType;
                jspreadsheet.el.style.pointerEvents = previousPointerEvents;
                if (hasChange) {
                    spreadsheet.table.resetHistory();
                }
            }

            showToastPasteFromClipboardSuccessful();
        })
        .catch(showToastPasteFromClipboardFailed);
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

// TODO: Remove legacy code. This is no longer used
const bindSelectColumnsHandler = () => {
    $('table[name=latestDataTable] thead th').each((i, th) => {
        th.addEventListener('contextmenu', selectAllColsHandler, false);
        th.addEventListener('mouseover', hideCheckColMenu, false);
    });
};

const createProcAndImportData = async (event) => {
    const isMergeMode = $(event).attr('data-is-merge-mode') === 'true';
    $(procModalElements.confirmImportDataModal).modal('hide');
    const valid = await saveProcCfg(isMergeMode);
    if (!valid) return;

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
        const loadingObj = loadingHandler();
        loadingObj.show();

        // call APIs initialize_process
        initializeProcess(procId)
            .then(() => {
                isInitialize = true;
                loadingObj.hide();
                showToastrMsg(procModali18n.i18nInitializeProcessSuccess, MESSAGE_LEVEL.INFO);

                // hide initialize button
                procModalElements.initializeProcessBtn.hide();
                procModalElements.initializeProcessBtn.attr('data-observer', 'initialized');

                // change re-import to import
                procModalElements.reRegisterBtn.css('display', 'none');
                procModalElements.createOrUpdateProcCfgBtn.css('display', 'block');
                enableColumnAfterInitialize();
                reloadFunctionInfo();
                // After initialization, transaction data does not exist
                // Therefore, we fall back to the datasource's preview cache
                // procModalElements.showRecordsBtn.trigger('click');
            })
            .catch(() => {
                // hide loading
                loadingObj.hide();
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
    // reRegister merge mode
    procModalElements.reRegisterChildProcBtn.click((e) => {
        // check if e.currentTarget.hasAttributes('data-has-ct')
        const withShowPreview = e.currentTarget.hasAttribute('data-has-ct');
        const hasCTCols = $(e.currentTarget).attr('data-has-ct') === 'true';
        if (withShowPreview && !hasCTCols) {
            return;
        }
        // shown confirm modal directly
        $(procModalElements.confirmMergeProcReRegisterModal).modal('show');
    });

    procModalElements.confirmReRegisterProcBtn.on('click', async (e) => {
        $(procModalElements.confirmReRegisterProcModal).modal('hide');
        await saveProcCfg();

        // save order to local storage
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        recentEdit(procModalCurrentProcId);
    });

    procModalElements.confirmMergeProcReRegisterBtn.on('click', async (e) => {
        // get init parent flag
        const isInitParent = $('#initParentData').is(':checked');

        // check merge mode
        await saveProcCfg(true, isInitParent);

        $(procModalElements.confirmMergeProcReRegisterModal).modal('hide');

        // save order to local storage
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        recentEdit(procModalCurrentProcId);
    });

    // Databases onchange
    procModalElements.databases.change(async () => {
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
        const isMergeMode = await isMergeModeFromProcConfig();
        if (
            isMergeMode &&
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
            await loadTables(dsSelected, dataRowId);
        }
        // not available from v4.7.10
        // GenerateDefaultImportFilterTable();
    });

    // Databases onchange merge mode
    procModalElements.databasesMergeMode.change(async () => {
        const loadingObj = loadingHandler();
        loadingObj.show();
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databasesMergeMode).val();
        currentProcessName = procModalElements.procNameMergeMode.val();
        await mergeModeProcess();
        loadingObj.hide();
    });

    // Merge mode tables onchange
    procModalElements.mergeModeTables.change(async () => {
        const loadingObj = loadingHandler();
        loadingObj.show();
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
        loadingObj.hide();
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
        invalidateProcessPreview();
        updateProcessPreviewButtons(false);
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
                            updateProcessPreviewButtons();
                            procModalElements.showRecordsBtn.trigger('click');
                        } else {
                            updateProcessPreviewButtons(false);
                            displayRegisterMessage(procModalElements.alertReferenceFileErrorID, {
                                message: $(procModali18n.i18nInvalidFilePathMessage).text(),
                                is_error: true,
                            });
                        }
                    },
                });
            } else {
                updateProcessPreviewButtons();
                procModalElements.showRecordsBtn.trigger('click');
            }
        }, 300);
    });

    // Show records button click event
    showRecordsBtnFunc = async (event, refreshPreview = false) => {
        event?.preventDefault();
        const button = refreshPreview ? procModalElements.previewUpdateBtn : procModalElements.showRecordsBtn;
        if (button.prop('disabled')) return;
        await loadProcessPreview(refreshPreview);
    };
    procModalElements.showRecordsBtn.click(showRecordsBtnFunc);
    procModalElements.previewUpdateBtn.off('click').on('click', (event) => {
        event.preventDefault();
        if (procModalCurrentProcId && !procModalElements.previewUpdateBtn.prop('disabled')) {
            procModalElements.confirmPreviewUpdateModal.modal('show');
        }
    });
    procModalElements.confirmPreviewUpdateBtn.off('click').on('click', async () => {
        procModalElements.confirmPreviewUpdateModal.modal('hide');
        await showRecordsBtnFunc(null, true);
    });

    // Show preview to merge mode
    const showPreviewToMergeProcess = async (event) => {
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
        await mergeModeProcess();
    };
    procModalElements.showPreviewBtnToMerge.click((event) => showPreviewToMergeProcess(event));

    procModalElements.proc.on('focusout', () => {
        checkDuplicateProcessName(true, true, false, false);
    });
    procModalElements.procJapaneseName.on('focusout', () => {
        checkDuplicateProcessName(true, false, true, false);
    });
    procModalElements.procLocalName.on('focusout', () => {
        checkDuplicateProcessName(true, false, false, true);
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
    19: {
        system: 'ProcName',
        japanese: 'プロセス名',
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

const dataTypeEventHints = $(procModali18n.i18nDataTypeEventsHint).text();

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
    is_proc_name: $(procModali18n.i18nProcNameStr).text(),
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
    $(procModali18n.i18nProcNameStr).text(),
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
    masterDataGroup.MAIN_DATE,
    masterDataGroup.MAIN_TIME,
    masterDataGroup.MAIN_SERIAL,
    masterDataGroup.LINE_NAME,
    masterDataGroup.LINE_NO,
    masterDataGroup.EQ_NAME,
    masterDataGroup.EQ_NO,
    masterDataGroup.PART_NAME,
    masterDataGroup.PART_NO,
    masterDataGroup.ST_NO,
    masterDataGroup.JUDGE,
    masterDataGroup.PROC_NAME,
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
    if (selectedFunctionNameEle) {
        FunctionInfo.initDropdownVarXY(selectedFunctionNameEle);
    }
};

const initSearchProcessColumnsTable = (tableEle, fromRegisterByFile) => {
    const searchInput = getSearchInputElementFromElement(tableEle);
    const searchSetBtn = getSetElementFromElement(tableEle);
    const searchResetBtn = getResetElementFromElement(tableEle);
    let uniqueSampleSearchTimeout;
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
        spreadsheet.table.table.page(0);
        clearTimeout(uniqueSampleSearchTimeout);
        uniqueSampleSearchTimeout = setTimeout(async () => {
            if (getDisplayModeFromToolsBarsElement(ele) !== SAMPLE_DATA_DISPLAY_MODES.UNIQUE) return;
            await ensureUniqueSampleData(spreadsheet);
            SpreadSheetProcessConfig.updateSampleDataByDisplayMode(spreadsheet, SAMPLE_DATA_DISPLAY_MODES.UNIQUE);
        }, 300);
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

    alignSampleDataHeaderControls(tableId);
};

/**
 * Draw the sample-data display-mode switch and the horizontal scroll arrows on the
 * header row of the process columns table (design プロセス設定 改善案: they belong to
 * the サンプルデータ header group, not to the tools bar above the table).
 *
 * Measurement only -- the jspreadsheet-generated header markup is never mutated and
 * the controls stay where they are in the DOM, so the existing lookups
 * (`closest('[id^="procSettingModalBody"]')`) and inline onchange handlers keep
 * working. The measured offsets are published as CSS custom properties on the tools
 * bar, which is the positioning context of both overlays.
 *
 * The switch is pinned to the LEFT EDGE OF THE SAMPLE-DATA AREA rather than following
 * the sample_data_1 cell: every column before it is frozen, so that edge is a fixed x
 * while the sample-data columns scroll underneath it.
 *
 * Safe to call repeatedly - it only writes custom properties.
 * @param {string} tableId - id of the process columns table container
 */
const alignSampleDataHeaderControls = (tableId) => {
    const tableEl = document.getElementById(tableId);
    if (!tableEl) return;

    // Only the process config modal moves these controls onto the header row.
    const toolsBarEl = tableEl.parentElement?.querySelector('.proc-config-tools-bar');
    const headerRowEl = tableEl.querySelector('.jexcel > thead > tr');
    const contentEl = tableEl.querySelector('.jexcel_content');
    if (!toolsBarEl || !headerRowEl || !contentEl) return;

    const firstSampleDataEl = spreadsheetProcConfig(tableEl)?.table?.getTableHeaderElement(`${SAMPLE_DATA_KEY}_1`);
    if (!firstSampleDataEl) return;

    const toolsBarRect = toolsBarEl.getBoundingClientRect();
    const headerRect = headerRowEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();
    // Undo the horizontal scroll instead of reading offsetLeft: offsetLeft depends on
    // which ancestor jspreadsheet happens to position, while `rect.left + scrollLeft`
    // is always the cell's x at scrollLeft === 0, i.e. the left edge of the
    // sample-data area right after the frozen columns.
    const sampleDataLeft = firstSampleDataEl.getBoundingClientRect().left + contentEl.scrollLeft;
    // Never let a stale/odd measurement push the switch outside the table, where the
    // modal body's `overflow: hidden` would silently clip it away.
    const clampedSampleDataLeft = Math.min(Math.max(sampleDataLeft, contentRect.left), contentRect.right - 200);

    toolsBarEl.style.setProperty('--pc-header-top', `${headerRect.top - toolsBarRect.top}px`);
    toolsBarEl.style.setProperty('--pc-header-height', `${headerRect.height}px`);
    toolsBarEl.style.setProperty('--pc-sample-data-left', `${clampedSampleDataLeft - toolsBarRect.left}px`);
    toolsBarEl.style.setProperty('--pc-arrows-right', `${toolsBarRect.right - contentRect.right}px`);
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

const isDuplicateProcessNameSystemName = async () => {
    const isValid = await checkDuplicateProcessName(false, true, false, false);
    removeDuplicateClass('column-name-invalid');
    return !isValid;
};

const isMergeModeFromProcConfig = async () => {
    let listDataSourceName = [];
    let isSameDataSource = false;
    let isDuplicatedSystemName = await isDuplicateProcessNameSystemName();
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
    const loadingObj = loadingHandler();
    loadingObj.show();
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
    loadingObj.hide();
};

const loadInfoTableWithMergeMode = async (procId, baseProc, tableName) => {
    // get data for child and parent processes
    const procModalForm = $(procModalElements.procMergeModeModal).find(procModalElements.mergeProcFormId);
    const processFactId = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('process_fact_id') || '';
    const masterType = getSelectedOptionOfSelect(procModalElements.mergeModeTables).attr('master_type') || '';

    const formDataChildProc = new FormData(procModalForm[0]);
    const formDataParentProc = new FormData();
    const [_, baseProcColsData] = await getProcessColumnsInfo(baseProc.id);
    baseProc['columns'] = baseProcColsData;
    let mergedColumns = [];
    let procInfo = null;
    if (procId) {
        // opening modal of a merged proc
        $('#createOrUpdateChildProcCfgBtn').hide();
        procModalElements.reRegisterChildProcBtn.show();
        $(procModalElements.showPreviewBtnToMerge).hide();
        $('#mergeProcDatasourceName').attr('disabled', true);
        $('#childTableName').attr('disabled', true);
        [procInfo, mergedColumns] = await getProcessColumnsInfo(procId);
        procModalElements.childOptionalFunctions.val(procInfo.etl_func);
        procModalElements.mergeModeLabel.val(procInfo.labels.map((l) => l.name)).trigger('change');
        procModalElements.mergeModeInputComment.val(procInfo.comment);
    } else {
        // new merge proc
        $('#createOrUpdateChildProcCfgBtn').show();
        procModalElements.reRegisterChildProcBtn.hide();
        $(procModalElements.showPreviewBtnToMerge).show();
        $('#mergeProcDatasourceName').attr('disabled', false);
        $('#childTableName').attr('disabled', false);
        // set labels from parent labels for default;
        procModalElements.mergeModeLabel.val(baseProc.labels.map((l) => l.name)).trigger('change');
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
    const colsMapping = generateMergeModeColumnMapping(baseProcDataCols, childProcData.cols, mergedColumns, !procId);

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

/**
 * Generate mapping between base process columns and child process columns for Merge Mode.
 * @param baseCols
 * @param childCols
 * @param mergedColumns
 * @param isAutoMerge - If true, the system automatically maps child columns to parent columns based on matching names
 *                      if no saved configuration is found in the database.
 *                    - If false, the system only uses mappings explicitly saved in the database.
 *                    - Use isAutoMerge = true when registering a NEW process.
 *                    - Use isAutoMerge = false when viewing DETAILS of an existing process to avoid unwanted auto-mapping of new columns.
 * @returns {*[]}
 */
const generateMergeModeColumnMapping = (baseCols, childCols, mergedColumns = [], isAutoMerge = true) => {
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
        const mapCol = dictMergedCol[key] || (isAutoMerge ? key : null);
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
    const cols = generateMergeModeColumnMapping(baseCols, childProcData.cols, [], !procModalCurrentProcId);
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

const isSelectedMainSerialInProcessConfig = () => {
    // check process config has column selected main:serial
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const mainSerialRow = spreadsheet.mainSerialRow();
    return mainSerialRow && mainSerialRow[PROCESS_COLUMNS.is_checked].data;
};

const isSelectedMainDatetimeInProcessConfig = () => {
    // check process config has column selected main:Datetime
    const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
    const mainDatetimeRow = spreadsheet.mainDateTimeRow();
    return mainDatetimeRow && mainDatetimeRow[PROCESS_COLUMNS.is_checked].data;
};

$(() => {
    initLabelSelectionTags();

    // Delegate so Select2 reinitialization cannot remove the modal-only sizing.
    // Its dropdown lives under body, so scope popup CSS with a separate class.
    procModalElements.procModal
        .off('.procConfigDropdown', 'select')
        .on('select2:opening.procConfigDropdown', 'select', function () {
            const select2 = $(this).data('select2');
            select2.options.set('dropdownAutoWidth', true);
            select2.$dropdown.addClass('proc-config-dropdown');
        })
        .on('select2:open.procConfigDropdown', 'select', function () {
            const select2El = $(this);
            const resizeDropdown = () => resizeListOptionSelect2({ select2El });
            resizeDropdown();
            // Bind after Select2's own positioning listener so the cap uses its new left edge.
            $(window).off('resize.procConfigDropdown').on('resize.procConfigDropdown', resizeDropdown);
        })
        .on('select2:close.procConfigDropdown', 'select', function () {
            $(window).off('resize.procConfigDropdown');
        });
    procModalElements.procModal
        .off('hidden.bs.modal.procConfigDropdown')
        .on('hidden.bs.modal.procConfigDropdown', () => {
            $(window).off('resize.procConfigDropdown');
        });

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

    // The sample-data header overlays are positioned from measured geometry, so they
    // must be re-measured whenever that geometry can change. Namespaced + `off` first
    // so reopening the modal cannot stack duplicate handlers.
    const reAlignSampleDataHeaderControls = () => alignSampleDataHeaderControls(procModalElements.procConfigTableName);
    $(window)
        .off('resize.procConfigSampleDataHeader')
        .on('resize.procConfigSampleDataHeader', reAlignSampleDataHeaderControls);
    procModalElements.procModal
        .off('shown.bs.modal.procConfigSampleDataHeader')
        .on('shown.bs.modal.procConfigSampleDataHeader', reAlignSampleDataHeaderControls);
});

const addStateInitialize = () => {
    const columnDataType = $('.column-data-type');
    columnDataType.attr('is-initialize', 'true');
    columnDataType.removeClass('disabled');
    columnDataType.removeClass(READONLY_CLASS);
    // enable checkbox
    $('.column-is-checked').removeClass(READONLY_CLASS);
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

const enableDatetimeFormulaAfterInitialize = () => {
    if (typeof spreadsheetProcConfig != 'undefined') {
        const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
        const rows = spreadsheet.rowsByDataTypes(DataTypes.DATETIME.name, DataTypes.TIME.name, DataTypes.DATE.name);
        if (rows) {
            rows.forEach((row) => {
                const rowIndex = row.formula.rowIndex;
                const colIndex = row.formula.columnIndex;
                const eleIsCheck = spreadsheet.table.getCellFromCoords(colIndex, rowIndex);
                eleIsCheck.classList.remove(READONLY_CLASS, 'disabled');
            });
        }
    }
};

const enableColumnAfterInitialize = () => {
    addStateInitialize();

    enableDatetimeDataType();

    // reset FileName checkbox
    enableFileNameColumn();

    // Enable "Import condition"
    enableDummyDateTimeOrDateTimeGeneratedChecked();

    enableDatetimeFormulaAfterInitialize();
};

const enableDatetimeDataType = () => {
    // reset checkbox
    procModalElements.procDateTimeFormatCheckbox.prop('checked', false);
    procModalElements.procDateTimeFormatCheckbox.prop('disabled', false);

    // reset input
    procModalElements.procDateTimeFormatInput.prop('disabled', false);
    procModalElements.procDateTimeFormatInput.attr('placeholder', DATETIME_FORMAT_PLACE_HOLDER);
};

const enableFileNameColumn = () => {
    if (currentProcess?.data_source.csv_detail) {
        const spreadsheet = spreadsheetProcConfig(procModalElements.procConfigTableName);
        const fileNameRow = spreadsheet.fileNameRow() || {};
        const fileNameId = fileNameRow.id?.data;
        const checkFileNameInFunctionColumn = checkColumnIsInFunctionColumn(fileNameId);

        if (!checkFileNameInFunctionColumn) {
            procModalElements.isShowFileName.prop('disabled', false);
            procModalElements.isShowFileName.prop('checked', false).trigger('change');
        }
    }
};

const getFilterExpression = () => {
    const filter = {};
    if ($(procModalElements.filterColumnClassName).length) {
        const table = spreadsheetProcConfig(procModalElements.procConfigTableName).table;
        $(procModalElements.filterColumnClassName).each((idx, e) => {
            if (idx >= $(procModalElements.filterColumnClassName).length - 1) return;
            const row = table.getRowsByHeadersAndIndexes(undefined, idx)[0];
            if (row.filter.data) {
                filter[row.column_raw_name.data] = row.filter.data;
            }
        });
    } else {
        // on first load registered proc config
        Object.keys(dicProcessCols).forEach((key) => {
            if (dicProcessCols[key].filter) {
                filter[dicProcessCols[key].column_raw_name] = dicProcessCols[key].filter;
            }
        });
    }
    return filter;
};

const initLabelSelectionTags = async () => {
    const selectionTags = $('.selection-tags');
    selectionTags.select2({
        tags: true,
    });

    const labels = await getAllLabelsFromDb();
    labels.forEach((label) => {
        procModalElements.label.append(new Option(label.name, label.name, false, false));
        procModalElements.mergeModeLabel.append(new Option(label.name, label.name, false, false));
    });
};
