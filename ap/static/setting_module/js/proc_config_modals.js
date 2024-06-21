/* eslint-disable no-unused-vars,no-use-before-define */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable guard-for-in */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */

const HTTP_RESPONSE_CODE_500 = 500;
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
let setDatetimeSelected = false;
let prcPreviewData;
let isClickPreview = false;
let allProcessColumns = []
let errCells = [];
let dataGroupType = {};
let checkOnFocus = true;
let dateTimeColumnGenerated = false;
let currentProcessId = null;
let currentProcess = null;
let currentProcessName = null;
let currentProcessNameLocal = null;
let procDsSelected = null;
let childProcData = null;
let baseProcObj = null;
let baseProcDataCols = null;

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
    comment: $('#procSettingModal input[name=comment]'),
        isShowFileName: $('#procSettingModal input[name=isShowFileName]'),
    databases: $('#procSettingModal select[name=databaseName]'),
    databasesMergeMode: $('#procSettingMergeModeModal select[name=databaseName]'),
    mergeProcComment: $('#procSettingMergeModeModal input#mergeProcComment'),
    tables: $('#procSettingModal select[name=tableName]'),
    showRecordsBtn: $('#procSettingModal button[name=showRecords]'),
    showPreviewBtnToMerge: $('#procSettingMergeModeModal button[name=showRecords]'),
    latestDataHeader: $('#procSettingModal table[name=latestDataTable] thead'),
    latestDataBody: $('#procSettingModal table[name=latestDataTable] tbody'),
    processColumnsTableBody: $(
        '#procSettingModal table[name=processColumnsTable] tbody',
    ),
    processColumnsTable: $(
        '#procSettingModal table[name=processColumnsTable]',
    ),
    processColumnsSampleDataTable: $(
        '#procSettingModal table[name=processColumnsTableSampleData]',
    ),
    processColumnsSampleDataTableBody: $(
        '#procSettingModal table[name=processColumnsTableSampleData] tbody',
    ),
    processColumnsTableId: 'processColumnsTable',
    okBtn: $('#procSettingModal button[name=okBtn]'),
    mergeModeConfirmtBtn: $('#procSettingMergeModeModal button[name=okBtn]'),
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
    operator: 'operator',
    coef: 'coef',
    lineName: 'lineName',
    lineNo: 'lineNo',
    equiptName: 'equiptName',
    equiptNo: 'equiptNo',
    partName: 'partName',
    partNo: 'partNo',
    intCat: 'intCat',
    columnType: 'columnType',
    procsMasterName: 'processName',
    procsMasterInfo: 'procInfo',
    procsComment: 'comment',
    procsdbName: 'databaseName',
    procsTableName: 'tableName',
    isDummyDatetime: 'isDummyDatetime',
    columnNameInput:
        '#procSettingModal table[name=processColumnsTable] input[name="columnName"]',
    systemNameInput:
        '#procSettingModal table[name=processColumnsTable] input[name="systemName"]',
    masterNameInput:
        '#procSettingModal table[name=processColumnsTable] input[name="shownName"]',
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
    procSettingModalCopyAllBtn: '#procSettingModalCopyAllBtn',
    procSettingModalPasteAllBtn: '#procSettingModalPasteAllBtn',
    settingContent: '#procSettingContent',
    prcSM: '#prcSM',
    autoSelectAllColumn: '#autoSelectAllColumn',
    refactorProcSetting: '#refactorProcSetting',
    autoSelect: '#autoSelect',
    checkColsContextMenu: '#checkColsContextMenu',
    createOrUpdateProcCfgBtn: $('#createOrUpdateProcCfgBtn'),
    createMergeProcCfgBtn: $('#createOrUpdateChildProcCfgBtn'),
    dbTableList: '#dbTableList',
    fileInputPreview: '#fileInputPreview',
    fileName: $('#procSettingModal input[name=fileName]'),
    dataGroupTypeClassName: 'data-type-selection',
    dataTypeSelection: 'dataTypeSelection',
    sampleDataColumnClassName: 'sample-data-column',
    mainDate: 'mainDate',
    mainTime: 'mainTime',
    // Merge mode element
    parentProcessColumnsTableBody: '#procSettingMergeModeModal table[name=parentProcessCols] tbody',
    processColumnsMergeModeBaseTableBody: '#procSettingMergeModeModal table[name=processColumnsTableBaseData] tbody',
    processColumnsMergeModeChildTableBody: '#procSettingMergeModeModal table[name=processColumnsTableSampleData] tbody',
    processColumnsMergeModeChildTableRow: '#procSettingMergeModeModal table[name=processColumnsTableSampleData] tbody > tr',
    parentColumnSystemName: '.parent-column-system-name',
    processColumnsMergeModeTableBody: '#procSettingMergeModeModal table[name=processColumnsTable] tbody',
    processColumnsMergeModeTableSelectOption: '#procSettingMergeModeModal table[name=processColumnsTable] tbody select',
    mergeModeTableChild: '.merge-mode-tables-child',
    mergeModeTableBase: '.merge-mode-tables-base',
};

const procModali18n = {
    emptyShownName: '#i18nEmptyShownName',
    useEnglishName: '#i18nUseEnglishName',
    noMasterName: '#validateNoMasterName',
    duplicatedSystemName: '#validateDuplicatedSystem',
    noEnglishName: '#validateNoEnglishName',
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
    i18nCopyToFiltered: '#i18nCopyToFiltered',
    i18nColumnRawName: '#i18nColumnRawName',
    i18nSampleData: '#i18nSampleData',
    i18nSpecial: '#i18nSpecial',
    i18nFilterSystem: '#i18nFilterSystem',
    i18nMultiset: '#i18nMultiset',
    i18nDatatype: '#i18nDatatype',
    noDatetimeCol: $('#i18nNoDatetimeCol').text(),
    i18nMainDate: '#i18nMainDate',
    i18nMainTime: '#i18nMainTime',
};

const isJPLocale = docCookies.isJaLocale();
const translateToEng = async (text) => {
    const result = await fetchData(
        '/ap/api/setting/to_eng',
        JSON.stringify({colname: text}),
        'POST');
    return result;
};

const setProcessName = (dataRowID = null) => {
    const procDOM = $(`#tblProcConfig tr[data-rowid=${dataRowID}]`);

    const procNameInput = procModalElements.proc.val();

    if (userEditedProcName && procNameInput) {
        return;
    }

    const dsNameSelection = getSelectedOptionOfSelect(procModalElements.databases).text();
    const tableNameSelection = getSelectedOptionOfSelect(procModalElements.tables).text();

    // get setting information from outside card
    const settingProcName = procDOM.find('input[name="processName"]')[0];
    // const settingDSName = procDOM.find('select[name="databaseName"]')[0];
    const settingTableName = procDOM.find('select[name="tableName"]')[0];

    // add new proc row
    let firstGenerated = false;
    if (dataRowID && settingProcName && !procNameInput) {
        procModalElements.proc.val($(settingProcName).val());
        firstGenerated = true;
    }

    // when user change ds or table, and empty process name
    // || !userEditedProcName
    // if (!procModalElements.proc.val()) {
    // if (!userEditedProcName) {
    if ((!firstGenerated && !userEditedProcName) || !procModalElements.proc.val()) {
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
        translateToEng(combineProcName).then(res => {
            if (res.data) {
                procModalElements.proc.val(res.data);
            } else {
                procModalElements.proc.val(combineProcName);
            }
        })

    }

    if (!procModalCurrentProcId) {
        // remove selected table
        // $(`table[name=${procModalElements.processColumnsTable}] tbody`).empty();
        procModalElements.showRecordsBtn.trigger('click');
    }
};

// reload tables after change
const loadTables = (databaseId, dataRowID = null, selectedTbl = null) => {
    // if new row have process name, set new process name in modal
    if (!databaseId) {
        setProcessName(dataRowID);
        return;
    }
    if (isEmpty(databaseId)) return;
    procModalElements.tables.empty();
    procModalElements.tables.prop('disabled', false);
    clearProcModalColumnTable();

    const isHiddenFileInput = $(procModalElements.fileInputPreview).hasClass('hide');
    const isHiddenDbTble = $(procModalElements.dbTableList).hasClass('hide');

    $.ajax({
        url: `api/setting/database_table/${databaseId}`,
        method: 'GET',
        cache: false,
    }).done((res) => {
        if (['v2', 'csv'].includes(res.ds_type.toLowerCase())) {
            procModalElements.tables.empty();
            procModalElements.tables.prop('disabled', true);
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
            res.tables.forEach((tbl) => {
                const options = {
                    value: tbl,
                    text: tbl,
                };
                if (selectedTbl && tbl === selectedTbl) {
                    options.selected = 'selected';
                }
                procModalElements.tables.append(
                    $('<option/>', options),
                );
            });

            if (!procModalCurrentProcId && selectedTbl) {
                setProcessName(dataRowID);
            }
            // hide 'fileName' input if there is DB datasource
            if (isHiddenDbTble) {
                toggleDBTableAndFileName();
            }
        }

        if (!selectedTbl) {
            procModalElements.tables.val('');
        }

    });
};
const toggleDBTableAndFileName = () => {
    $(procModalElements.dbTableList).toggleClass('hide');
    $(procModalElements.fileInputPreview).toggleClass('hide');
};
// load current proc name, database name and tables name
// eslint-disable-next-line no-unused-vars
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
            procModalElements.databases.append(
                $('<option/>', options),
            );
        });

        if (!currentDs) {
            procModalElements.databases.val('');
        }

        const selectedDbInfo = dbInfo.filter(db => Number(db.id) === Number(currentDs))[0];

        // hide 'table' dropdown if there is CSV datasource
        const isHiddenFileInput = $(procModalElements.fileInputPreview).hasClass('hide');
        const isHiddenDbTble = $(procModalElements.dbTableList).hasClass('hide');
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
            procModalElements.databases.prop('disabled', true)
            return;
        }
        procModalElements.databases.prop('disabled', false)

        if (currentDs) {
            if (![DB.DB_CONFIGS.CSV.type.toLowerCase(), DB.DB_CONFIGS.V2.type.toLowerCase()].includes(selectedDbInfo.type.toLowerCase()) || dbsId) {
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

            procModalElements.tables.prop('disabled', true);
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

// generate 5 records and their header
const genColumnWithCheckbox = (cols, rows, dummyDatetimeIdx) => {
    let header = '';
    let datas = '';
    let dataTypeSelections = '';
    const colTypes = [];

    const intlabel = $(`#${DataTypes.INTEGER.i18nLabelID}`).text();
    const strlabel = $(`#${DataTypes.STRING.i18nLabelID}`).text();
    const dtlabel = $(`#${DataTypes.DATETIME.i18nLabelID}`).text();
    const reallabel = $(`#${DataTypes.REAL.i18nLabelID}`).text();
    const realSepLabel = $(`#${DataTypes.REAL_SEP.i18nLabelID}`).text();
    const intSepLabel = $(`#${DataTypes.INTEGER_SEP.i18nLabelID}`).text();
    const euRealSepLabel = $(`#${DataTypes.EU_REAL_SEP.i18nLabelID}`).text();
    const euIntSepLabel = $(`#${DataTypes.EU_INTEGER_SEP.i18nLabelID}`).text();

    const getColType = (col) => {
        const orgColType = getColDataType(col.column_name);
        const colType = orgColType ? orgColType : col.data_type;
        return colType;
    };

    let isRemoveDummyDatetime = cols.filter(col => {
        const colType = getColType(col);
        if (colType === DataTypes.DATETIME.name) {
            return true
        }
        return false
    }).length > 1 && dummyDatetimeIdx !== null;

    cols.forEach((col, i) => {
        let isNull = true;
        const colDataType = getColType(col);
        const isDummyDatetimeCol = dummyDatetimeIdx === i;
        rows.forEach((row) => {
            if (!isEmpty(row[col.column_name])) {
                isNull = false;
            }
        });
        header += `
        <th class="${isDummyDatetimeCol ? 'dummyDatetimeCol' : ''}">
            <div class="custom-control custom-checkbox">
                <input type="checkbox" onChange="selectTargetCol(this)" ${getColDataType(col.column_name) ? 'checked' : ''}
                    class="check-item custom-control-input col-checkbox" value="${col.column_name}"
                    id="checkbox-${col.name_en}" data-type="${col.data_type}" data-romaji="${col.name_en}"
                    data-isnull="${isNull}" data-col-index="${i}" data-is-dummy-datetime="${isDummyDatetimeCol}" data-name-jp="${col.name_jp || ''}" data-name-local="${col.name_local || ''}">
                <label class="custom-control-label" for="checkbox-${col.name_en}">${col.column_name}</label>
            </div>
        </th>`;

        const checkedColType = (type) => {
            if (type === colDataType) {
                return ' selected="selected"';
            }
            return '';
        };

        colTypes.push(DataTypes[colDataType].value);

        dataTypeSelections += `<td class="${isDummyDatetimeCol ? 'dummyDatetimeCol' : ''}">
            <select id="col-${i}" class="form-control csv-datatype-selection"
                onchange="parseDataType(this, ${i})" onfocus="storePreviousValue(this)">  <!-- B-Sprint36+80 #5 -->
                <option value="${DataTypes.REAL.value}"${checkedColType(DataTypes.REAL.name)}>${reallabel}</option>
                <option value="${DataTypes.INTEGER.value}"${checkedColType(DataTypes.INTEGER.name)} ${col.is_big_int ? 'disabled' : ''}>${intlabel}</option>
                <option value="${DataTypes.STRING.value}"${checkedColType(DataTypes.STRING.name)}>${strlabel}</option>
                <option value="${DataTypes.DATETIME.value}"${checkedColType(DataTypes.DATETIME.name)}>${dtlabel}</option>
                <option value="${DataTypes.REAL_SEP.value}"${checkedColType(DataTypes.REAL_SEP.name)}>${realSepLabel}</option>
                <option value="${DataTypes.INTEGER_SEP.value}"${checkedColType(DataTypes.INTEGER_SEP.name)}>${intSepLabel}</option>
                <option value="${DataTypes.EU_REAL_SEP.value}"${checkedColType(DataTypes.EU_REAL_SEP.name)}>${euRealSepLabel}</option>
                <option value="${DataTypes.EU_INTEGER_SEP.value}"${checkedColType(DataTypes.EU_INTEGER_SEP.name)}>${euIntSepLabel}</option>
                <option data-all="all">${copyToAllColumnLabel}</option>
            </select>
            <input id="dataTypeTemp-${i}" value="${DataTypes[colDataType].value}" hidden disabled>
        </td>`;
        // const selectedVal = $(`#col-${i}`).value();
        // changeBackgroundColor(selectedVal);
    });

    procModalElements.latestDataHeader.empty();
    procModalElements.latestDataHeader.html(`<tr>${header}</tr><tr>${dataTypeSelections}</tr>`);

    rows.forEach((row) => {
        let data = '';
        cols.forEach((col, i) => {
            let val;
            const columnColor = dummyDatetimeIdx === i ? ' dummy_datetime_col' : '';
            if (col.is_get_date) {
                val = parseDatetimeStr(row[col.column_name]);
            } else {
                val = row[col.column_name];
                if (col.data_type === DataTypes.INTEGER.name) {
                    val = parseIntData(val);
                } else if (col.data_type === DataTypes.REAL.name) {
                    val = parseFloatData(val);
                }
            }
            const isKSep = [DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(getColType(col));
            data += `<td style="color: ${isKSep ? 'orange' : ''}" is-big-int="${col.is_big_int ? 1 : 0}" data-original="${row[col.column_name] || ''}" class="${columnColor}"> ${val || ''} </td>`;
        });
        datas += `<tr>${data}</tr>`;
    });
    // const dataTypeSel = `<tr>${dataTypeSelections.join('')}</tr>`;
    procModalElements.latestDataBody.empty();
    if (datas.length) {
        // procModalElements.latestDataBody.append(dataTypeSel);
        procModalElements.latestDataBody.html(datas);
    }

    if (isRemoveDummyDatetime) {
        procModalElements.latestDataTable.find('.dummyDatetimeCol').remove();
        procModalElements.latestDataTable.find('.dummy_datetime_col').remove();
    }

    parseEUDataTypeInFirstTimeLoad();

    showConfirmKSepDataModal(colTypes);

    showConfirmSameAndNullValueInColumn(cols);
};

const clearProcModalColumnTable = () => {
    procModalElements.processColumnsTableBody.html('');
    procModalElements.processColumnsSampleDataTableBody.html('');
};

const generateProcessList = (cols, rows, dummyDatetimeIdx, fromRegenerate = false, force = false, autoCheckSerial = false) => {
    if (!cols || !cols.length) {
        clearProcModalColumnTable()
        return;
    }

    if (!fromRegenerate && Object.values(dicProcessCols).length) {
        // reassign column_type
        cols = cols.map(col => {
            const columnRawName = dicProcessCols[col.column_name] ? dicProcessCols[col.column_name]['column_raw_name'] || col['column_raw_name'] : col['column_raw_name'];
            return {
                ...col,
                ...dicProcessCols[col.column_name],
                column_raw_name: columnRawName,
            }
        })
    }

    // sort columns by column_type
    const sortedCols = [...cols];
    // const sortedCols = [...cols].sort((a, b) => { return a.column_type - b.column_type});
    // if (fromRegenerate && JSON.stringify(cols) === JSON.stringify(sortedCols) && !force) return;

    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
    let hasMainSerialCol = false;


    // case rows = [] -> no data for preview
    if (rows.length == 0) {
        rows = Array(10).fill({});
    }

    const colTypes = [];

    let checkedTotal = 0;

    const convertColumnTypeToAttrKey = (columnType = 99) => {
        const col = {};
        switch (columnType) {
            case dataGroupType['MAIN_SERIAL']:
                col.is_serial_no = false;
                col.is_main_serial_no = true;
                return col;
            case dataGroupType['SERIAL']:
                col.is_serial_no = true;
                col.is_main_serial_no = false;
                return col;
            case dataGroupType['LINE_NAME']:
                col.is_line_name = true;
                return col;
            case dataGroupType['LINE_NO']:
                col.is_line_no = true;
                return col;
            case dataGroupType['EQ_NAME']:
                col.is_eq_name = true;
                return col;
            case dataGroupType['EQ_NO']:
                col.is_eq_no = true;
                return col;
            case dataGroupType['PART_NAME']:
                col.is_part_name = true;
                return col;
            case dataGroupType['PART_NO']:
                col.is_part_no = true;
                return col;
            case dataGroupType['ST_NO']:
                col.is_st_no = true;
                return col;
            case dataGroupType['INT_CATE']:
                col.is_int_cat = true;
                return col;
            case dataGroupType['MAIN_DATE']:
                col.is_main_date = true;
                return col;
            case dataGroupType['MAIN_TIME']:
                col.is_main_time = true;
                return col;
            default:
                return col;
        }

    };

    const isRegisterProc = !_.isEmpty(dicProcessCols);

    let tableContent = '';
    let sampleContent = '';
    const dataTypeObjs = [];

    sortedCols.forEach((col, i) => {
        const column_raw_name = col.column_raw_name;
        const registerCol = dicProcessCols[col.column_name];
        col = fromRegenerate ? col : (registerCol || col);
        if (!col.name_en) {
            col.name_en = col.romaji;
        }
        if (!col.column_raw_name) {
            col.column_raw_name = column_raw_name;
        }
        const isChecked = fromRegenerate ? col.is_checked : !!registerCol;
        // check valid columns if add new process also
        if (isChecked) {
            checkedTotal++;
        }
        const isDummyDatetimeCol = dummyDatetimeIdx === i;
        const isDummyDatetime = col.is_dummy_datetime ? true : false;
        // if v2 col_name is シリアルNo -> auto check
        if ((!registerCol && !fromRegenerate) || autoCheckSerial) {
            const isSerial = /^.*シリアル|serial.*$/.test(col.column_name.toString().toLowerCase()) && [DataTypes.STRING.name, DataTypes.INTEGER.name].includes(col.data_type);
            if (isSerial && hasMainSerialCol) {
                col.is_serial_no = true;
            }

            if (isSerial && !hasMainSerialCol) {
                col.is_main_serial_no = true;
                hasMainSerialCol = true;
            }
        }

        // convert column_type to attr key
        col = {
            ...col,
            ...convertColumnTypeToAttrKey(col.column_type),
        }

        colTypes.push(DataTypes[col.data_type].value);

        const checkedAtr = isChecked ? 'checked=checked' : '';

        const isNumeric = isNumericDatatype(col.data_type);
        const [numericOperators, textOperators, coefHTML] = createOptCoefHTML(col.operator, col.coef, isNumeric, checkedAtr);

        const dataTypeObject = {
            ...col,
            value: col.data_type,
            checked: checkedAtr,
            isRegisteredCol: !!registerCol,
            isRegisterProc
        };
        let getKey = '';
        for (const attr of DataTypeAttrs) {
            if (dataTypeObject[attr]) {
                getKey = attr;
                break;
            }
        }

        const isFixedName = fixedNameAttrs.includes(getKey);
        const rowHtml = `
               <tr>
                                <td class="text-center show-raw-text row-item column-number" ${checkedAtr}
                                    title="index" data-column-id="${col.id}" data-col-idx="${i}">${i + 1}</td>
                                <td class="show-raw-text column-raw-name" title="is_checked">
                                    <div class="custom-control custom-checkbox">
                                        <input type="checkbox"
                                               class="check-item custom-control-input col-checkbox"
                                               onchange="handleChangeProcessColumn(this, ${isRegisterProc})"
                                               name="${procModalElements.columnName}"
                                               value="${col.column_name ?? ''}"
                                               is-show="${col.is_show ?? ''}"
                                               id="checkbox-${col.column_name}_${i}" 
                                               data-id="${col.id ?? ''}"
                                               data-column_name="${col.column_name ?? ''}"
                                               data-bridge_column_name="${col.bridge_column_name ?? ''}"
                                               data-column_raw_name="${col.column_raw_name ?? ''}"
                                               data-name="${col.name ?? ''}"
                                               data-data_type="${col.data_type ?? ''}"
                                               data-raw_data_type="${col.data_type ?? ''}"
                                               data-operator="${col.operator ?? ''}"
                                               data-coef="${col.coef ?? ''}"
                                               data-column_type="${col.column_type ?? ''}"
                                               data-is_auto_increment="${col.is_auto_increment ?? false}"
                                               data-is_serial_no="${col.is_serial_no ?? false}"
                                               data-is_get_date="${col.is_get_date ?? false}"
                                               data-is_linking_column="${col.is_linking_column ?? false}"
                                               data-is_dummy_datetime="${col.is_dummy_datetime ?? false}"
                                               data-master_type="${col.master_type ?? ''}"
                                               ${checkedAtr} ${col.is_master_col === true ? 'disabled' : ''}>
                                        <label class="custom-control-label row-item for-search" for="checkbox-${col.column_name}_${i}" ${checkedAtr}>${col.column_raw_name || col.column_name}</label>
                                        <input id="isDummyDatetime${col.column_name}" type="hidden" name="${procModalElements.isDummyDatetime}"
                                        value="${isDummyDatetime}">
                                        <input name="${procModalElements.columnRawName}" type="hidden" value="${col.column_raw_name}">
                                    </div>
                                </td>
                                <td class="column-date-type" title="raw_data_type">
                                    ${DataTypeSelection.generateHtml(i, dataTypeObject, getKey)}
                                </td>
                                <td class="column-system-name" title="name_en">
                                    <input type="text" name="${procModalElements.systemName}" class="form-control row-item" old-value="${isFixedName ? (col.old_system_name || col.name_en || col.column_name) : ''}" value="${col.name_en}" ${checkedAtr} ${isFixedName ? 'disabled' : ''}>
                                </td>
                                <td class="column-japanese-name" title="name_jp">
                                    <input type="text" name="${procModalElements.japaneseName}" class="form-control row-item" onchange="handleEmptySystemNameJP(this, procModalElements.systemName)" old-value="${isFixedName ? (col.old_name_jp || col.name_jp || '') : ''}" value="${col.name_jp ?? ''}" ${checkedAtr} ${isFixedName ? 'disabled' : ''}>
                                </td>
                                <td class="column-local-name" title="name_local">
                                    <input type="text" name="${procModalElements.localName}" class="form-control row-item" onchange="handleEmptySystemName(this, procModalElements.systemName)" value="${col.name_local || ''}" ${checkedAtr}>
                                </td>
                                <td class="column-format" title="format">
                                    <select name="${procModalElements.operator}" class="form-control row-item" ${checkedAtr}>
                                        <option value="">---</option>
                                        ${isNumeric ? numericOperators : textOperators}
                                    </select>
                                </td>
                                <td>
                                    ${coefHTML}
                                </td>
                            </tr>
        `;

        tableContent += rowHtml;
        sampleContent += `<tr>${generateSampleData(rows, dummyDatetimeIdx, col, i, checkedAtr).join('')}</tr>`;
        dataTypeObjs.push(dataTypeObject);
    });

    procModalElements.processColumnsTableBody.html(tableContent);
    procModalElements.processColumnsSampleDataTableBody.html(sampleContent);
    DataTypeSelection.showDataTypeModal();
    let totalColumns = 0;
    for (const column of sortedCols) {
        if (column.is_show) {
            totalColumns++;
        }
    }
    showTotalCheckedColumns(totalColumns, checkedTotal);
    parseEUDataTypeInFirstTimeLoad();

    if (!fromRegenerate) {
        showConfirmSameAndNullValueInColumn(sortedCols);
        showConfirmKSepDataModal(colTypes);
    }
    handleScrollSampleDataTable();
    handleHoverProcessColumnsTableRow();
    validateSelectedColumnInput();
};

const generatedDateTimeSampleData = (dateColId, timeColId) => {
    const dateSampleData = collectSampleData(dateColId, true)
    const timeSampleData = collectSampleData(timeColId, true)
    let generatedDateTimeSampleData = []
    dateSampleData.forEach((data, i) => {
        generatedDateTimeSampleData.push(`${data} ${timeSampleData[i]}`)
    })
    return generatedDateTimeSampleData;
};

const showTotalCheckedColumns = (totalColumns, totalCheckedColumn) => {
    procModalElements.totalCheckedColumnsContent.show();
    procModalElements.totalColumns.text(totalColumns);
    setTotalCheckedColumns(totalCheckedColumn);

    procModalElements.searchInput.val('');
};

const setTotalCheckedColumns = (totalCheckedColumns = 0) => {
    procModalElements.totalCheckedColumns.text(totalCheckedColumns);
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
    procModalElements.comment.val('');
    procModalElements.databases.html('');
    procModalElements.tables.html('');
    procModalElements.tables.prop('disabled', false);

    procModalElements.totalCheckedColumnsContent.hide();
    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
    procModalElements.fileName.val('');
};

const handleChangeProcessColumn = (ele, isRegisterProc) => {
    const isChecked = ele.checked;
    const isDummyDatetimeCol = $(ele).attr('data-is-dummy-datetime') === 'true';
    const isFileNameCol = $(ele).attr('data-column_name') === 'FileName';
    const rowIndex = $(ele).closest('tr').index();
    const sampleDataRow = procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${rowIndex})`);
    if (isChecked) {
        $(ele).closest('tr').find('.row-item').attr('checked', 'checked');
        sampleDataRow.find('.row-item').attr('checked', 'checked');
    } else {
        $(ele).closest('tr').find('.row-item').removeAttr('checked');
        sampleDataRow.find('.row-item').removeAttr('checked');
    }
    if (isFileNameCol) {
        procModalElements.isShowFileName.prop("checked", isChecked);
    }

    if (!isRegisterProc && !isChecked && isDummyDatetimeCol) {
        // remove dummy datetime if uncheck this column
        $(ele).closest('tr').remove();
        sampleDataRow.remove();
        prcPreviewData.dummy_datetime_idx = null;
        sortProcessColumns(true);
    }

    // checkDateAndTimeChecked();
    const checkedTotal = $('input.col-checkbox:checked[is-show="true"]').length;
    setTotalCheckedColumns(checkedTotal);
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
    let formatStr = TIME_FORMAT_TZ
    if (millis) {
        formatStr = TIME_FORMAT_TZ + millis + ' Z';
    }
    // today
    _today = new Date();
    _today = _today.toISOString().split('T').shift();
    timeStr = moment(_today + ' ' + timeStr)
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
        if (col.check_same_value.is_same && !col.check_same_value.is_null) {
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
        if ($(this).is(':checked')) { // disable serial as the same row
            $(this).closest('tr').find(`input:checkbox[name="${procModalElements.serial}"]`).attr('disabled', true);
        }
    });
    $(`table[name=processColumnsTable] input:checkbox[name="${procModalElements.auto_increment}"]`).each(function disable() {
        $(this).attr('disabled', true);
    });
};

// validation checkboxes of selected columns
const validateCheckBoxesAll = () => {
    $(
        `table[name=processColumnsTable] input:checkbox[name="${procModalElements.serial}"]`,
    ).each(function validateSerial() {
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
    });
};


const showResetDataLink = (boxElement) => {
    const currentProcId = procModalElements.procID.val() || null;
    if (!currentProcId) {
        return;
    }
    currentAsLinkIdBox = boxElement;
    $(procModalElements.warningResetDataLinkModal).modal('show');
};


const validateAllCoefs = () => {
    $(`#processColumnsTable tr input[name="${procModalElements.coef}"]:not(.text)`).each(function validate() {
        validateNumericInput($(this));
    });
};


const validateSelectedColumnInput = () => {
    validateCheckBoxesAll();
    handleEnglishNameChange($(procModalElements.systemNameInput));
    addAttributeToElement();
    validateAllCoefs();
    validateFixedColumns();
    updateTableRowNumber(null, $('table[name=selectedColumnsTable]'));
};

const createOptCoefHTML = (operator, coef, isNumeric, checkedAtr = '') => {
    const operators = ['+', '-', '*', '/'];
    let numericOperators = '';
    operators.forEach((opr) => {
        const selected = (operator === opr) ? ' selected="selected"' : '';
        numericOperators += `<option value="${opr}" ${selected}>${opr}</option>`;
    });
    const selected = (operator === 'regex') ? ' selected="selected"' : '';
    const textOperators = `<option value="regex" ${selected}>${i18n.validLike}</option>`;
    let coefHTML = `<input name="coef" class="form-control row-item" type="text" value="${coef || ''}" ${checkedAtr}>`;
    if (!isNumeric) {
        coefHTML = `<input name="coef" class="form-control text row-item" type="text" value="${coef || ''}" ${checkedAtr}>`;
    }
    return [numericOperators, textOperators, coefHTML];
};

const changeSelectionCheckbox = (autoSelect = true, selectAll = false) => {
    $(procModalElements.autoSelect).prop('checked', autoSelect);
    $(procModalElements.selectAllSensor).prop('checked', selectAll);
};

const updateSelectAllCheckbox = () => {
    let selectAll = true;
    let autoSelect = true;

    if (renderedCols) {
        // update select all check box based on current selected columns
        $('.col-checkbox').each(function f() {
            const isColChecked = $(this).prop('checked');
            const isNull = $(this).data('isnull');
            if (!isColChecked) {
                selectAll = false;
            }
            if ((isNull && isColChecked) || (!isNull && !isColChecked)) {
                autoSelect = false;
            }
        });
        changeSelectionCheckbox(autoSelect, selectAll);
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

    let checkCols = null;

    if (isChecked) {
        if (autoSelect) {
            checkCols = $('.col-checkbox:not(:checked):not(:disabled):not([data-isnull=true])');
        } else {
            checkCols = $('.col-checkbox:not(:checked):not(:disabled)');
        }
    } else {
        if (autoSelect) {
            checkCols = $('.col-checkbox:checked:not(:disabled):not([data-isnull=true])');
        } else {
            checkCols = $('.col-checkbox:checked:not(:disabled)');
        }
    }

    [...checkCols].forEach((col) => {
        const colCfg = getColCfgInCheckbox(col);
        if (colCfg.is_get_date) {
            setDatetimeSelected = true;
        }
    })
    checkCols.prop('checked', isChecked).trigger('change');
    if (!isChecked) {
        const remainDatetimeCols = $('span[name=dataType][value=DATETIME][checked]').length;
        // reset datetime col selection
        setDatetimeSelected = remainDatetimeCols > 0;
    }
    // validate after selecting all to save time
    validateSelectedColumnInput();
};


const handleShowFileNameColumn = (el) => {
    const isChecked = el.checked;
    const isDisabled = el.disabled;
    let fileNameColumn = null;

    fileNameColumn = $(`.col-checkbox:not(:disabled)[data-column_name="FileName"]`);
    if (isDisabled) {
        fileNameColumn.prop('disabled', true);
    }
    fileNameColumn.prop('checked', isChecked).trigger('change');
}
const getColCfgInCheckbox = (col) => {
    const colDataType = col.getAttribute('data-type');
    const romaji = col.getAttribute('data-romaji');
    const isDummyDatetime = col.getAttribute('data-is-dummy-datetime') === 'true';
    const nameJp = col.getAttribute('data-name-jp') || isJPLocale ? col.value : '';
    const nameLocal = col.getAttribute('data-name-local') || !isJPLocale ? col.value : '';
    const isDatetime = !setDatetimeSelected && DataTypes.DATETIME.name === colDataType;
    const colConfig = {
        is_get_date: isDatetime,
        is_serial_no: false,
        is_auto_increment: false,
        data_type: colDataType,
        column_name: col.value,
        name_en: romaji,
        name_jp: nameJp,
        name_local: nameLocal,
        // name: col.value,
        is_dummy_datetime: isDummyDatetime,
    };

    return colConfig;
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

const showLatestRecordsFromPrc = (json,) => {
    dateTimeColumnGenerated = false;
    dataGroupType = json.data_group_type;
    const dummyDatetimeIdx = json.dummy_datetime_idx;
    // genColumnWithCheckbox(json.cols, json.rows, dummyDatetimeIdx);
    generateProcessList(json.cols, json.rows, dummyDatetimeIdx);
    preventSelectAll(renderedCols);
    // update changed datasource
    updateCurrentDatasource();

    // update select all check box after update column checkboxes
    updateSelectAllCheckbox();

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
    }

    // handle file name column
    handleShowFileNameColumn(procModalElements.isShowFileName[0]);
};

const addDummyDatetimePrc = (addCol = true) => {
    if (!addCol) {
        // update content of csv
        prcPreviewData.cols.shift();
        prcPreviewData.dummy_datetime_idx = null;
    }
    showLatestRecordsFromPrc(prcPreviewData);
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
        success: (json) => {
            loading.hide();
            if (json.cols_duplicated) {
                showToastrMsg(i18nCommon.colsDuplicated);
            }
            prcPreviewData = json;
            showToastrMsgFailLimit(json);
            const isEditPrc = currentProcItem.data('proc-id') !== undefined;
            // show gen dummy datetime col for new proces only
            if (!isEditPrc && !json.has_ct_col && !json.is_rdb) {
                showDummyDatetimeModal(json, true);
            } else {
                showLatestRecordsFromPrc(json);
                // checkDateAndTimeChecked();
                updateBtnStyleWithValidation(procModalElements.createOrUpdateProcCfgBtn);
            }

            allProcessColumns = json ? json.cols.map(col => col.column_name) : [];
        },
        error: (e) => {
            loading.hide();
            console.log('error', e)
        },
    });
};

const clearWarning = () => {
    $(procModalElements.alertMessage).css('display', 'none');
    $('.column-name-invalid').removeClass('column-name-invalid');
};

// validate coefs
const validateCoefOnSave = (coefs, operators) => {
    if (isEmpty(coefs) && isEmpty(operators)) return [];

    const errorMsgs = new Set();
    const coefArray = [].concat(coefs);
    const operatorArray = [].concat(operators);

    if (coefArray && coefArray.includes(0)) {
        errorMsgs.add($(procModali18n.noZeroCoef).text() || '');
    }

    for (i = 0; i < operatorArray.length; i++) {
        if (coefs[i] === '' && ['+', '-', '*', '/', 'regex'].includes(operatorArray[i])) {
            errorMsgs.add($(procModali18n.emptyCoef).text() || '');
        }
        if (coefs[i] !== '' && !['+', '-', '*', '/', 'regex'].includes(operatorArray[i])) {
            errorMsgs.add($(procModali18n.needOperator).text() || '');
        }
    }
    errorMsgs.delete('');
    return Array.from(errorMsgs) || [];
};

const handleEnglishNameChange = (ele) => {
    ["keyup", "change"].forEach((event) => {
        ele.off(event).on(event, (e) => {
            // replace characters which isnot alphabet
            e.currentTarget.value = e.currentTarget.value.replace(/[^\w-]+/g, '');
        });
    });
};


const handleEmptySystemNameJP = async (ele, targetEle) => {
    const systemNameInput = $(ele).parent().siblings().children(`input[name=${targetEle}]`)
    if (!$(systemNameInput).val()) {
        $(systemNameInput).val(await convertEnglishRomaji([$(ele).val()]))
    }
}

const handleEmptySystemName = async (ele, targetEle) => {
    const systemNameInput = $(ele).parent().siblings().children(`input[name=${targetEle}]`)
    if (!$(systemNameInput).val()) {
        const removed = await convertNonAscii([$(ele).val()]);
        $(systemNameInput).val(removed)
    }
}

const englishAndMasterNameValidator = (englishNames = [], japaneseNames = [], localNames = []) => {
    if (isEmpty(englishNames)) return [];

    const nameErrors = new Set();
    const isEmptyEnglishName = []
        .concat(englishNames)
        .some(name => isEmpty(name));
    if (isEmptyEnglishName) {
        nameErrors.add($(procModali18n.noEnglishName).text() || '');
    }

    // const isEmptyJpName = [].concat(japaneseNames).some(name => isEmpty(name)); no required
    // if (isEmptyJpName) {
    //     nameErrors.add($(procModali18n.noMasterName).text() || '');
    // }
    if (isArrayDuplicated(englishNames.filter(name => !isEmpty(name)))) {
        nameErrors.add($(procModali18n.duplicatedSystemName).text() || '');
        // add red border to duplicated input
        showBorderRedForDuplicatedInput('systemName', englishNames)
    }

    if (isArrayDuplicated(japaneseNames.filter(name => !isEmpty(name)))) {
        // duplicated Japanese name checking
        nameErrors.add($(procModali18n.duplicatedJapaneseName).text() || '');
        // add red border to duplicated input
        showBorderRedForDuplicatedInput('japaneseName', japaneseNames)
    }

    if (isArrayDuplicated(localNames.filter(name => !isEmpty(name)))) {
        // duplicated local name checking
        nameErrors.add($(procModali18n.duplicatedLocalName).text() || '');
        // add red border to duplicated input
        showBorderRedForDuplicatedInput('localName', localNames)
    }

    nameErrors.delete('');
    return Array.from(nameErrors) || [];
};


const getDuplicatedValueInArray = (array) => {
    const duplicateValues = array.filter((item, index) => array.indexOf(item) !== index);
    return duplicateValues;
};

const showBorderRedForDuplicatedInput = (inputName, values) => {
    const duplicateValues = getDuplicatedValueInArray(values);
    const inputs = procModalElements.processColumnsTableBody.find(`input[name=${inputName}][checked=checked]`);
    inputs.each((i, el) => {
        if ($(el).val() && duplicateValues.includes($(el).val())) {
            $(el).addClass('column-name-invalid');
        }
    })
};

const checkDuplicateProcessName = (attr = 'data-name-en', isShowMsg = true, errorMsg = $(procModalElements.msgProcNameAlreadyExist).text()) => {
    if (!checkOnFocus) return;
    // get current list of (process-mastername)
    const existingProcIdMasterNames = {};
    $('#tblProcConfig tr').each(function f() {
        const procId = $(this).data('proc-id');
        const rowId = $(this).attr('id');
        if (rowId) {
            const masterName = $(`#${rowId} input[name=processName]`).attr(attr) || '';
            existingProcIdMasterNames[`${procId}`] = masterName;
        }
    });

    let inputEl = procModalElements.proc;
    if (attr === 'data-name-jp') {
        inputEl = procModalElements.procJapaneseName;
    }
    if (attr === 'data-name-local') {
        inputEl = procModalElements.procLocalName;
    }
    // check for duplication
    const beingEditedProcName = inputEl.val();
    const existingMasterNames = Object.values(existingProcIdMasterNames);
    const isEditingSameProc = existingProcIdMasterNames[currentProcItem.data('proc-id')] === beingEditedProcName;
    if (
        beingEditedProcName
        && existingMasterNames.includes(beingEditedProcName)
        && !isEditingSameProc
    ) {
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
    $(procModalElements.procModal).animate({scrollTop: 0}, 'fast');
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

const getSelectedColumnsAsJson = (getSelectedOnly = true) => {
    // get Selected columns
    const getHtmlEleFunc = genJsonfromHTML(
        procModalElements.processColumnsTableBody,
        'selects',
        true,
    );
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('value'), procModalElements.dataType);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_serial_no'), procModalElements.serial);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_auto_increment'), procModalElements.auto_increment);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_get_date'), procModalElements.dateTime);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_main_date'), procModalElements.mainDate);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_main_time'), procModalElements.mainTime);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_main_serial_no'), procModalElements.mainSerial);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_line_name'), procModalElements.lineName);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_line_no'), procModalElements.lineNo);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_eq_name'), procModalElements.equiptName);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_eq_no'), procModalElements.equiptNo);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_part_name'), procModalElements.partName);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_part_no'), procModalElements.partNo);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_st_no'), procModalElements.partNo);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('column_type'), procModalElements.columnType);
    getHtmlEleFunc(procModalElements.dataType, ele => ele.getAttribute('is_int_cat'), procModalElements.intCat);
    getHtmlEleFunc(procModalElements.columnName, ele => ele.value);
    getHtmlEleFunc(procModalElements.columnRawName, ele => ele.value);
    getHtmlEleFunc(procModalElements.systemName);
    getHtmlEleFunc(procModalElements.systemName, ele => ele.getAttribute('old-value'), 'old_system_name');
    getHtmlEleFunc(procModalElements.japaneseName);
    getHtmlEleFunc(procModalElements.localName);
    getHtmlEleFunc(procModalElements.operator);
    getHtmlEleFunc(procModalElements.isDummyDatetime);
    getHtmlEleFunc(procModalElements.columnName, ele => ele.checked, 'isChecked');
    getHtmlEleFunc(procModalElements.japaneseName);
    getHtmlEleFunc(procModalElements.japaneseName, ele => ele.getAttribute('old-value'), 'old_name_jp');

    const selectJson = getHtmlEleFunc(procModalElements.coef);

    return selectJson;
};

const mappingDataGroupType = {
    'is_get_date': 'DATETIME',
    'is_serial_no': 'SERIAL',
    'is_main_serial_no': 'MAIN_SERIAL',
    'is_auto_increment': 'DATETIME_KEY',
    'is_line_name': 'LINE_NAME',
    'is_line_no': 'LINE_NO',
    'is_eq_name': 'EQ_NAME',
    'is_eq_no': 'EQ_NO',
    'is_part_name': 'PART_NAME',
    'is_part_no': 'PART_NO',
    'is_st_no': 'ST_NO',
    'is_int_cat': 'INT_CATE',
    'is_main_date': 'MAIN_DATE',
    'is_main_time': 'MAIN_TIME',
};

const procColumnsData = (selectedJson, getAll = false) => {
    const columnsData = [];
    if (selectedJson.selects.columnName.length) {
        selectedJson.selects.columnName.forEach((v, k) => {
            const isChecked = selectedJson.selects.isChecked[k];
            const dataType = selectedJson.selects.dataType[k];
            const localName = selectedJson.selects.localName[k];
            const japaneseName = selectedJson.selects.japaneseName[k];
            // get old value to set after sort columns
            const oldJPName = selectedJson.selects['old_name_jp'][k];
            const oldSystemName = selectedJson.selects['old_system_name'][k];
            const columnType = Number(selectedJson.selects[procModalElements.columnType][k]);
            const column = {
                column_name: v,
                column_raw_name: selectedJson.selects.columnRawName[k],
                name_en: selectedJson.selects.systemName[k],
                // add system_name column
                data_type: dataType,
                operator: selectedJson.selects.operator[k],
                coef: selectedJson.selects.coef[k],
                column_type: columnType || 99, // data group type
                is_serial_no: selectedJson.selects.serial[k] === 'true' || selectedJson.selects.mainSerial[k] === 'true',
                is_get_date: selectedJson.selects.dateTime[k] === 'true',
                is_auto_increment: selectedJson.selects.auto_increment[k] === 'true',
                is_dummy_datetime: selectedJson.selects.isDummyDatetime[k] === 'true',
                order: CfgProcess_CONST.CATEGORY_TYPES.includes(dataType) ? 1 : 0,
                name_jp: japaneseName || null,
                name_local: localName || null,
            }

            // TODO(khanhdq) check filename column to push them
            if (isChecked && !getAll) {
                columnsData.push(column);
            }
            if (getAll) {
                column.is_checked = isChecked;
                column.old_name_jp = oldJPName;
                column.old_system_name = oldSystemName;
                columnsData.push(column)
            }
        });
    }
    return columnsData;
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

const collectProcCfgData = (columnDataRaws, getAllCol = false) => {
    const procID = procModalElements.procID.val() || null;
    const procEnName = procModalElements.proc.val();
    const procLocalName = procModalElements.procLocalName.val() || null;
    const procJapaneseName = procModalElements.procJapaneseName.val() || null;
    const dataSourceId = getSelectedOptionOfSelect(procModalElements.databases).val() || '';
    const tableName = getSelectedOptionOfSelect(procModalElements.tables).val() || '';
    const comment = procModalElements.comment.val() || null;
    const isShowFileName = procModalElements.isShowFileName.not(":disabled") ? procModalElements.isShowFileName.is(":checked") : null;

    // preview data & data-type predict by file name
    const fileName = procModalElements.fileName.val() || null;
    const procColumns = procColumnsData(columnDataRaws, getAllCol);

    // get uncheck column = all col - uncheck col
    const checkedProcessColumn = procColumns.map(col => col.column_name);
    const unusedColumns = allProcessColumns.filter(colName => !checkedProcessColumn.includes(colName));
    return [{
        id: procID,
        name_en: procEnName,
        name: procEnName,
        data_source_id: dataSourceId,
        table_name: tableName,
        comment,
        columns: procColumns,
        name_jp: procJapaneseName,
        name_local: procLocalName,
        file_name: fileName,
        is_show_file_name: isShowFileName,
    }, unusedColumns];
};

const collectMergeProcCfgData = () => {
    const dataSourceID = procModalElements.databasesMergeMode.val();
    const comment = procModalElements.mergeProcComment.val();
    const baseProcCols = baseProcObj.columns.reduce((o, col) => ({ ...o, [col.column_name]: col}), {});
    const columnLimitation = Object.keys(baseProcCols).length
    const mergeProcColsObj = childProcData.cols.reduce((o, col) => ({...o, [col.column_name]: col}), {});
    const mergedProcCols = Array.from($('#childProcessColumns select[name=merge-mode-column-name]'));
    const mergedCols = [];
    mergedProcCols.forEach((col, idx) => {
         if (idx < columnLimitation) {
             const colName = $(col).find('option:checked').data('col-name');
             const colData = mergeProcColsObj[colName];
             if (colData) {
                const originalCol = baseProcCols[baseProcDataCols[idx].column_name];
                 colData.parent_id = originalCol ? originalCol.id : null;
                 if (colData.parent_id) {
                     mergedCols.push(colData);
                 }
             }
         }
    });
    return {
        id: null,
        data_source_id: dataSourceID,
        name: baseProcObj.name,
        name_en: baseProcObj.name_en,
        name_jp: baseProcObj.name_jp,
        name_local: baseProcObj.name_local,
        comment: comment,
        parent_id: baseProcObj.id,
        columns: mergedCols,
    };
};

const saveProcCfg = (selectedJson=undefined, importData = true, isMergeMode=false) => {
    clearWarning();
    procModalElements.procModal.modal('hide');
    procModalElements.confirmImportDataModal.modal('hide');
    procModalElements.procMergeModeModal.modal('hide');

    let [procCfgData, unusedColumns] = [null, []];
    if (!isMergeMode) {
        [procCfgData, unusedColumns] = collectProcCfgData(selectedJson);
    } else {
        procCfgData = collectMergeProcCfgData();
    }

    if (!procCfgData) {
        // todo : show toarst message
        console.log('Invalid data');
        return;
    }

    const data = {
        proc_config: procCfgData,
        import_data: importData,
        unused_columns: unusedColumns,
    };

    $.ajax({
        url: 'api/setting/proc_config',
        type: 'POST',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json',
    }).done((res) => {
        // sync Vis network
        reloadTraceConfigFromDB();
        isV2ProcessConfigOpening = false;

        // update GUI
        if (res.status !== HTTP_RESPONSE_CODE_500) {
            if (!currentProcItem.length) {
                addProcToTable(res.data.id, res.data.name_en, res.data.name_jp, res.data.name_local, res.data.shown_name, res.data.data_source.id);
            } else {
                $(currentProcItem).find('input[name="processName"]').val(res.data.shown_name)
                    .prop('disabled', true);
                $(currentProcItem).find('input[name="processName"]').attr('data-name-en', res.data.name_en)
                $(currentProcItem).find('input[name="processName"]').attr('data-name-jp', res.data.name_jp)
                $(currentProcItem).find('input[name="processName"]').attr('data-name-local', res.data.name_local)
                $(currentProcItem).find('select[name="databaseName"]').val(res.data.data_source.id)
                    .prop('disabled', true);

                if (!['CSV', 'V2'].includes(res.data.data_source.type)) {
                    $(currentProcItem).find('select[name="tableName"]')
                        .append(`<option value="${res.data.table_name}" selected="selected">${res.data.table_name}</option>`)
                        .prop('disabled', true);
                } else {
                    $(currentProcItem).find('select[name="tableName"]').remove();
                }

                $(currentProcItem).find('textarea[name="comment"]').val(res.data.comment)
                    .prop('disabled', true);
                $(currentProcItem).attr('id', `proc_${res.data.id}`);
                $(currentProcItem).attr('data-proc-id', res.data.id);
                $(currentProcItem).attr('data-ds-id', res.data.data_source_id);
            }
        } else {
            if (res['errorType'] === 'CastError') {
                // Show modal and list down all columns & data that cannot be converted
                const failedCastDataModal = new FailedCastDataModal();
                failedCastDataModal.init(res.data, res.message);
                failedCastDataModal.show();

                // Revert to previous data type
                $(`${procModalElements.formId} td[title="raw_data_type"] div.multi-level-dropdown`).each((i, e) => {
                    const originRawDataType = $(e).find('button.dropdown-toggle a[data-ext-name="data_type"]').data('origin-value');
                    const rawDataType = $(e).find('button.dropdown-toggle a[data-ext-name="data_type"]').data('value');
                    if (originRawDataType !== rawDataType) {
                        setTimeout(() => {
                            const item = $(e).find(`ul.dropdown-menu a[data-value="${originRawDataType}"]`);
                            DataTypeDropdown.itemClick({currentTarget: item.length > 1 ? item[1]: item[0]});
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
    });

    $(`#tblProcConfig #${procModalCurrentProcId}`).data('type', '');
};

const getCheckedRowValues = () => {
    const selectJson = getSelectedColumnsAsJson();

    const SELECT_ROOT = Object.keys(selectJson)[0];
    const operators = [];
    const coefsRaw = [];
    const systemNames = [];
    const japaneseNames = [];
    const localNames = [];


    if (selectJson[SELECT_ROOT].columnName.length) {
        selectJson[SELECT_ROOT].columnName.forEach((v, k) => {
            const isChecked = selectJson[SELECT_ROOT].isChecked[k];
            if (isChecked) {
                operators.push(selectJson[SELECT_ROOT][procModalElements.operator][k]);
                coefsRaw.push(selectJson[SELECT_ROOT][procModalElements.coef][k]);
                systemNames.push(selectJson[SELECT_ROOT][procModalElements.systemName][k]);
                japaneseNames.push(selectJson[SELECT_ROOT][procModalElements.japaneseName][k]);
                localNames.push(selectJson[SELECT_ROOT][procModalElements.localName][k])
            }
        })
    }

    return [systemNames, japaneseNames, localNames, operators, coefsRaw];
};

const runRegisterProcConfigFlow = (edit = false) => {
    clearWarning();

    // validate proc name null
    const validateFlg = validateProcName();
    if (!validateFlg) {
        scrollTopProcModal();
        return;
    }

    // check if date is checked
    const getDateMsgs = [];
    const isMainDateSelected = $('span[name=dataType][checked][is_main_date=true]').length;
    const isMainTimeSelected = $('span[name=dataType][checked][is_main_time=true]').length;
    const isMainDateTimeSelected = $('span[name=dataType][value=DATETIME][checked][is_get_date=true]').length;
    const isValidDatetime = isMainDateTimeSelected || (isMainDateSelected && isMainTimeSelected);
    if (!isValidDatetime) {
        getDateMsgs.push($(csvResourceElements.msgErrorNoGetdate).text());
    }

    const [systemNames, japaneseNames, localNames, operators, coefsRaw] = getCheckedRowValues();

    let coefs = [];
    if (coefsRaw) {
        coefs = coefsRaw.map((coef) => {
            if (coef === '') {
                return '';
            }
            return Number(coef);
        });
    }

    let nameMsgs = englishAndMasterNameValidator(systemNames, japaneseNames, localNames);
    const coefMsgs = validateCoefOnSave(coefs, operators);

    const missingShownName = procModali18n.noMasterName;
    let hasError = true;
    if (nameMsgs.length && nameMsgs.includes(missingShownName)) {
        const emptyShownameMsg = $(procModali18n.emptyShownName).text();
        const useEnglnameMsg = $(procModali18n.useEnglishName).text();
        // show modal to confirm auto filling shown names
        $(procModalElements.msgContent)
            .text(`${emptyShownameMsg}\n${useEnglnameMsg}`);
        $(procModalElements.msgModal).modal('show');
    }
    if (getDateMsgs.length > 0 || nameMsgs.length > 0 || coefMsgs.length > 0) {
        const messageStr = Array.from(getDateMsgs.concat(nameMsgs).concat(coefMsgs)).join('<br>');
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: messageStr,
            is_error: true,
        });
    } else {
        hasError = false;
        // show confirm modal if validation passed
        if (edit) {
            $(procModalElements.confirmReRegisterProcModal).modal('show');
        } else {
            $(procModalElements.confirmImportDataModal).modal('show');
        }
    }

    // scroll to where messages are shown
    if (hasError) {
        const settingContentPos = procModalElements.procSettingContent.offset().top;
        const bodyPos = procModalElements.procModalBody.offset().top;
        procModalElements.procModal.animate({
            scrollTop: settingContentPos - bodyPos,
        }, 'slow');
    }
};

const checkClearColumnsTable = (dsID, tableName) => {
    if (((isEmpty(currentProcData.table_name) && isEmpty(tableName)) || currentProcData.table_name === tableName)
        && currentProcData.ds_id === dsID) {
        return false;
    }
    return true;
};

const zip = (arr, ...arrs) => arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));


const extractSampleData = (sampleData) => {
    // extract sample_data to several columns
    const N_SAMPLE_DATA = 5;
    const samples = [];
    sampleData.forEach((value, i) => {
        var k = i % N_SAMPLE_DATA;
        samples[k] = [...(samples[k] || []), value];
    });
    return samples;
};

const getHorizontalSettingModeRows = () => {
    const selectJson = getHorizontalDataAsJson();
    const SELECT_ROOT = Object.keys(selectJson)[0]; // TODO use common function
    columnNames = selectJson[SELECT_ROOT][procModalElements.columnName] || [''];
    const sourceColNames = selectJson[SELECT_ROOT][procModalElements.columnRawName] || [''];
    const englishName = selectJson[SELECT_ROOT][procModalElements.systemName] || [''];
    const japaneseName = selectJson[SELECT_ROOT][procModalElements.japaneseName] || [''];
    const localName = selectJson[SELECT_ROOT][procModalElements.localName] || [''];
    const dataTypes = selectJson[SELECT_ROOT][procModalElements.dataType] || [''];
    const formats = selectJson[SELECT_ROOT][procModalElements.format] || [''];
    const tmpSampleDatas = selectJson[SELECT_ROOT][procModalElements.sampleData] || [''];
    const sampleDatas = extractSampleData(tmpSampleDatas);

    // let rowData = [columnNames, sourceColNames, shownNames, dataTypes, formats];
    let rowData = [sourceColNames, dataTypes, englishName, japaneseName, localName, formats];
    rowData = [...rowData, ...sampleDatas];
    return zip(...rowData);
};

const convertEnglishRomaji = async (englishNames = []) => {
    const result = await fetch('api/setting/list_to_english', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({'english_names': englishNames}),
    }).then(response => response.clone().json());

    return result.data || [];
};

const convertNonAscii = async (names = []) => {
    const result = await fetch('api/setting/list_normalize_ascii', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({'names': names}),
    }).then(response => response.clone().json());

    return result['data'] || [];
}

/**
 * Copy All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const copyAllProcSettingInfo = (e) => {
    const headerText = [
        ...procModalElements.processColumnsTable.find('thead th'),
        ...procModalElements.processColumnsSampleDataTable.find('thead th'),
    ]
        .map((th) => {
            const columnName = th.innerText.trim();
            if (th.getAttribute('colspan') == null) {
                return columnName;
            }
            const quantity = parseInt(th.getAttribute('colspan'), 10);
            return Array(quantity).fill(columnName).join(TAB_CHAR);
        })
        .join(TAB_CHAR);

    const bodyText = _.zip(
        [...procModalElements.processColumnsTableBody.find('tr')],
        [...procModalElements.processColumnsSampleDataTableBody.find('tr')],
    )
        .map((tr) => {
            const [trColumn, trSampleData] = tr;
            if (trColumn === undefined || trSampleData === undefined) {
                return undefined;
            }
            return [...trColumn.children, ...trSampleData.children].map((td) => {
                const inputEl = td.querySelector('input[type="text"]');
                if (inputEl != null) {
                    return inputEl.value.trim();
                }

                return td.innerText.trim();
            })
                .join(TAB_CHAR)
        })
        .join(NEW_LINE_CHAR);

    const text = [headerText, bodyText].join(NEW_LINE_CHAR);

    navigator.clipboard.writeText(text).then(function () {
        const message = 'Table values copied to clipboard!';
        showToastrMsg(message, MESSAGE_LEVEL.INFO);
    }, function (err) {
        const message = `Failed to copy text: ${err}`;
        showToastrMsg(message, MESSAGE_LEVEL.ERROR);
    });
};

/**
 * parse clipboard string
 * @param {string} copiedText - clipboard string
 * @return {Array.<Array.<string>>}
 */
const transformCopiedTextToTable = (copiedText) => {
    const records = copiedText.replace(/\r\n+$/, "").split('\r\n');
    return records
        .map((rec) => rec.replace(/\t+$/, ""))
        .filter((row) => row !== '')
        .map((row) => row.split('\t'));
};


/**
 * Remove header and validate check
 * @param {Array.<Array.<string>>} table
 * @return {Array.<Array.<string>> | null}
 */
const transformCopiedTable = (table) => {
    if (table.length === 0) {
        return null;
    }

    const headerRow = procModalElements.processColumnsTable
        .find('thead>tr th')
        .toArray()
        .map((el) => el.innerText.trim());

    let newTable = table;

    // should off by one if we have order column
    const hasOrderColumn = table[0].length && table[0][0] === headerRow[0];
    if (hasOrderColumn) {
        newTable = table.map((row) => row.slice(1));
    }

    // user don't copy header rows
    let userHeaderRow = newTable[0];
    let expectedHeaderRow = headerRow.slice(1);
    const hasHeaderRow = _.isEqual(userHeaderRow.slice(0, expectedHeaderRow.length), expectedHeaderRow);
    if (!hasHeaderRow) {
        showToastrMsg('There is no header in copied text. Please also copy header!', MESSAGE_LEVEL.WARN);
        return null;
    }

    return newTable.slice(1);
}

const copyDataToTableAt = (data, table) => (row, col) => {
    const ele = table[row][col];

    if (!ele) {
        return;
    }

    // input
    const input = ele.querySelector('input:enabled:not([type="hidden"])');
    const shouldChangeInput = input && !input.disabled && data[row][col] !== undefined;
    if (shouldChangeInput) {
        input.value = data[row][col];
    }

    // dropdown
    const dropdown = ele.querySelector('.config-data-type-dropdown');
    if (dropdown) {
        const dropdownButton = dropdown.querySelector('button');
        const shouldChangeDatatype = dropdownButton && !dropdownButton.disabled && data[row][col] !== undefined;
        if (!shouldChangeDatatype) {
            return;
        }

        const dropdownItems = dropdown.querySelectorAll('.data-type-selection-box:not(.d-none) .dataTypeSelection:not(.d-none)');
        const newDatatypeElement = Array.from(dropdownItems)
            .find((item) => item.innerText === data[row][col]);


        if (newDatatypeElement) {
            const classPrefix = 'config-data-type-dropdown_';
            const dropdownIdx = dropdown
                .classList
                .entries()
                .map(item => item[1])
                .find(item => item.startsWith(classPrefix))
                .replace(classPrefix, '');
            DataTypeSelection.onClickDataType(dropdownIdx, newDatatypeElement);
        }
    }
};

/**
 * Paste All process setting info
 * @param {jQuery} e - JqueryEvent
 */
const pasteAllProcSettingInfo = (e) => {
    navigator.clipboard.readText().then(function (text) {
        const originalTable = transformCopiedTextToTable(text);
        const tableData = transformCopiedTable(originalTable);
        if (tableData === null) {
            return;
        }

        // get all <td> element but skip the order column
        const oldTableElement = procModalElements.processColumnsTableBody
            .find('tr')
            .toArray()
            .map((tr) => tr.querySelectorAll('td:not([title="index"])'))
            .map(tds => Array.from(tds));

        // warning and abort if we don't have enough rows
        if (oldTableElement.length !== tableData.length) {
            showToastrMsg('Number of records mismatch. Please check and copy again', MESSAGE_LEVEL.WARN);
            return;
        }

        const totalRows = oldTableElement.length;
        const totalColumns = oldTableElement[0].length;
        const copyAt = copyDataToTableAt(tableData, oldTableElement);
        for (let row = 0; row < totalRows; ++row) {
            for (let col = 0; col < totalColumns; ++col) {
                copyAt(row, col);
            }
        }
    });
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

const hideCheckColMenu = (e) => { // later, not just mouse down, + mouseout of menu
    $(procModalElements.checkColsContextMenu).css({display: 'none'});
};

const bindSelectColumnsHandler = () => {
    $('table[name=latestDataTable] thead th').each((i, th) => {
        th.addEventListener('contextmenu', selectAllColsHandler, false);
        th.addEventListener('mouseover', hideCheckColMenu, false);
    });
};

const createProcAndImportData = (event) => {
    const isMergeMode = $(event).data('is-merge-mode');
    $(procModalElements.confirmImportDataModal).modal('hide');

    const selectJson = !isMergeMode ? getSelectedColumnsAsJson() : undefined;

    saveProcCfg(selectJson, true, isMergeMode);


    // save order to local storage
    setTimeout(() => {
        dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
    }, 2000);

    recentEdit(procModalCurrentProcId);

    // show toastr
    showToastr();
    showJobAsToastr();
};

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
        runRegisterProcConfigFlow(edit = false);
    });

    // merge mode
    procModalElements.createMergeProcCfgBtn.click(() => {
        $(procModalElements.confirmImportDataModal).modal('show');
        $(procModalElements.confirmImportDataBtn).data('is-merge-mode', true);
    });

    // confirm Import Data
    // procModalElements.confirmImportDataBtn.click(() => {
    //     $(procModalElements.confirmImportDataModal).modal('hide');
    //
    //     const selectJson = getSelectedColumnsAsJson();
    //     saveProcCfg(selectJson, true);
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


    // re-register process config
    procModalElements.reRegisterBtn.click((e) => {
        // check if e.currentTarget.hasAttributes('data-has-ct')
        const withShowPreview = e.currentTarget.hasAttribute('data-has-ct');
        const hasCTCols = $(e.currentTarget).attr('data-has-ct') === 'true';
        if (withShowPreview && !hasCTCols) {
            return;
        }
        runRegisterProcConfigFlow(edit = true);
    });

    procModalElements.confirmReRegisterProcBtn.click(() => {
        $(procModalElements.confirmReRegisterProcModal).modal('hide');
        const selectJson = getSelectedColumnsAsJson();
        saveProcCfg(selectJson, true);

        // save order to local storage
        setTimeout(() => {
            dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        }, 2000);
        recentEdit(procModalCurrentProcId);
    });

    // load tables to modal combo box
    loadTables(getSelectedOptionOfSelect(procModalElements.databases).val());

    // Databases onchange
    procModalElements.databases.change(() => {
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
        if(isMergeModeProcConfig() && !document.querySelector(procModalElements.confirmMergeMode).deactivate) {
            showModalConfirmMergeMode();
        } else {
            procDsSelected = null;
            hideAlertMessages();
            isClickPreview = true;
            const dsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
            loadTables(dsSelected);
        }
    });

    // Databases onchange merge mode
    procModalElements.databasesMergeMode.change(() => {
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databasesMergeMode).val();
        currentProcessName = procModalElements.procNameMergeMode.val();
        currentProcessNameLocal = 'en';
        mergeModeProcess();
    });

    // Tables onchange
    procModalElements.tables.change(() => {
        hideAlertMessages();
        isClickPreview = true;
        setProcessName();
    });

    procModalElements.proc.on('mouseup', () => {
        userEditedProcName = true;
    });

    // Show records button click event
    procModalElements.showRecordsBtn.click((event) => {
        event.preventDefault();
        const currentShownTableName = getSelectedOptionOfSelect(procModalElements.tables).val() || null;
        const currentShownDataSouce = getSelectedOptionOfSelect(procModalElements.databases).val() || null;
        const clearDataFlg = checkClearColumnsTable(Number(currentShownDataSouce), currentShownTableName);
        const procModalForm = $(procModalElements.formId);
        const formData = new FormData(procModalForm[0]);
        if (!formData.get('tableName') && currentShownTableName) {
            formData.set('tableName', currentShownTableName);
        }
        // set currentProcessId in order to check if we need to show generated column in backend
        formData.set('currentProcessId', procModalCurrentProcId);

        preventSelectAll(true);

        // disable show file name if we are viewing imported process
        if (procModalCurrentProcId) {
            $(procModalElements.isShowFileName).prop('disabled', true);
        }

        // reset select all checkbox when click showRecordsBtn
        $(procModalElements.selectAllColumn).css('display', 'block');
        $(procModalElements.autoSelectAllColumn).css('display', 'block');

        // reset first datetime checked
        setDatetimeSelected = false;
        showLatestRecords(formData, clearDataFlg);
    });

    // Show preview to merge mode
    const showPreviewToMergeProcess = (event) => {
        event.preventDefault();

        preventSelectAll(true);

        // reset first datetime checked
        setDatetimeSelected = false;
        procDsSelected = getSelectedOptionOfSelect(procModalElements.databasesMergeMode).val();
        currentProcessName = procModalElements.procNameMergeMode.val();
        currentProcessNameLocal = 'en';
        mergeModeProcess();
    };
    procModalElements.showPreviewBtnToMerge.click((event) => showPreviewToMergeProcess(event));

    procModalElements.proc.on('focusout', () => {
        checkDuplicateProcessName('data-name-en');
        if(isMergeModeProcConfig()) {
            showModalConfirmMergeMode();
        }
    });
    procModalElements.procJapaneseName.on('focusout', () => {
        checkDuplicateProcessName('data-name-jp')
    });
    procModalElements.procLocalName.on('focusout', () => {
        checkDuplicateProcessName('data-name-local')
    });

    $(procModalElements.revertChangeAsLinkIdBtn).click(() => {
        currentAsLinkIdBox.prop('checked', !currentAsLinkIdBox.prop('checked'));
    });

    $(procModalElements.revertChangeAsLinkIdBtn).click(() => {
        currentAsLinkIdBoxDataTable.prop('checked', !currentAsLinkIdBoxDataTable.prop('checked'));
    });

    // copy all columns in proc config table
    $(procModalElements.procSettingModalCopyAllBtn).off('click').click(copyAllProcSettingInfo);
    // paste all columns to in proc config table
    $(procModalElements.procSettingModalPasteAllBtn).off('click').click(pasteAllProcSettingInfo);

    initSearchProcessColumnsTable();
});

const datatypeDefaultObject = {
    value: '',
    is_get_date: false,
    is_main_date: false,
    is_main_time: false,
    is_serial_no: false,
    is_main_serial_no: false,
    is_auto_increment: false,
    is_int_cat: false
}

const fixedName = {
    is_get_date: {
        system: 'Datetime',
        japanese: '日時',
    },
    is_main_serial_no: {
        system: 'Serial',
        japanese: 'シリアル',
    },
    is_line_name: {
        system: 'LineName',
        japanese: 'ライン名',
    },
    is_line_no: {
        system: 'LineNo',
        japanese: 'ラインNo',
    },
    is_eq_name: {
        system: 'EqName',
        japanese: '設備名',
    },
    is_eq_no: {
        system: 'EqNo',
        japanese: '設備No',
    },
    is_part_name: {
        system: 'PartName',
        japanese: '品名',
    },
    is_part_no: {
        system: 'PartNo',
        japanese: '品番',
    },
    is_st_no: {
        system: 'StNo',
        japanese: 'StNo',
    },
    is_main_date: {
        system: 'Date',
        japanese: '日付',
    },
    is_main_time: {
        system: 'Time',
        japanese: '時刻',
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

};

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
    'is_int_cat',
    'is_main_date',
    'is_main_time',
];
const allowSelectOneAttrs = [
    'is_get_date',
    'is_main_date',
    'is_main_time',
    'is_main_serial_no',
    'is_line_name',
    'is_line_no',
    'is_eq_name',
    'is_eq_no',
    'is_part_name',
    'is_part_no',
    'is_st_no',
    'is_auto_increment',
    'is_main_date',
    'is_main_time',
];
const unableToReselectAttrs = ['is_get_date', 'is_auto_increment', 'is_main_date', 'is_main_time'];
const fixedNameAttrs = ['is_get_date', 'is_main_serial_no', 'is_line_name', 'is_line_no', 'is_eq_name', 'is_eq_no', 'is_part_name', 'is_part_no', 'is_st_no'];
const highPriorityItems = [...fixedNameAttrs, 'is_auto_increment', 'is_serial_no'];

const DataTypeSelection = {

    dataTypeEls: {
        selectValueId: 'dataTypeShowValue',
    },

    getAttrOfDataTypeItem: (e) => {
        const target = e.currentTarget || e;
        const attrs = target.getAttributeNames().filter(v => DataTypeAttrs.includes(v));
        return attrs.length ? attrs[0] : '';
    },

    init: (idx = 0) => {
        $(`.config-data-type-dropdown_${idx} ul li`).removeClass('active');

        const showValueOption = DataTypeSelection.getShowValueElement(idx);
        const value = showValueOption.getAttribute('value');
        const attrKey = showValueOption.getAttribute('data-attr-key');
        const isRegisteredCol = showValueOption.getAttribute('is-registered-col') === 'true';
        const isBigInt = showValueOption.getAttribute('is-big-int') == 'true';
        const selectOption = DataTypeSelection.getOptionByAttrKey(value, attrKey, idx);

        selectOption.addClass('active');

        DataTypeSelection.setValueToShowValueElement(value, selectOption.text(), attrKey, idx);

        DataTypeSelection.disableOtherDataType(idx, isRegisteredCol || isBigInt, value, attrKey);

        // disable copy function if allow select one item
        DataTypeSelection.disableCopyItem(idx, attrKey);


        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).off('click');
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).on('click', (e) => {
            DataTypeSelection.onClickDataType(idx, e);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).off('focus');
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).on('focus', (e) => {
            DataTypeSelection.onFocusDataType(idx, e);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.copyToAllBelow:not([disabled="disabled"])`).off('click');
        $(`.config-data-type-dropdown_${idx} ul li.copyToAllBelow:not([disabled="disabled"])`).on('click', (e) => {
            DataTypeSelection.handleCopyToAllBelow(idx);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.copyToFiltered:not([disabled="disabled"])`).off('click');
        $(`.config-data-type-dropdown_${idx} ul li.copyToFiltered:not([disabled="disabled"])`).on('click', (e) => {
            DataTypeSelection.handleCopyToFiltered(idx);
            DataTypeSelection.hideDropdownMenu();
        })
    },
    showDataTypeModal: () => {
        $('.config-data-type-dropdown button').off('click');
        $('.config-data-type-dropdown button').on('click', function (e) {
            const index = $(e.currentTarget).closest('tr').index();
            DataTypeSelection.init(index);
            DataTypeSelection.hideDropdownMenu();
            const dropdown = $(e.currentTarget).siblings('.data-type-selection');
            const dropdownHeight = dropdown.height() / 2;
            const windowHeight = $(window).height() - 50;
            const left = e.clientX;
            let top = e.clientY;
            if (top + dropdownHeight > windowHeight) {
                top -= (top + dropdownHeight - windowHeight);
            }
            dropdown.css({
                position: 'fixed',
                top: top,
                left: left,
                display: 'flex',
                zIndex: '999',
            })
        });
    },
    disableOtherDataType: (idx, isRegisteredCol = false, dataType, attrKey) => {
        if (!isRegisteredCol) return;
        if (unableToReselectAttrs.includes(attrKey)) {
            // disable all option
            $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([${attrKey}])`).attr('disabled', true);
        } else {
            // select all other data type option -> add disabled
            let dataTypeAllows = [dataType];
            if ([DataTypes.REAL.name, DataTypes.INTEGER.name].includes(dataType)) {
                dataTypeAllows.push(DataTypes.TEXT.name);
                if ([DataTypes.INTEGER.name].includes(dataType)) {
                    dataTypeAllows.push(DataTypes.REAL.name);
                }
            }
            $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection`).each(function() {
                let dataType = $(this).attr('data-type');
                if (!dataTypeAllows.includes(dataType)) {
                    $(this).attr('disabled', true);
                }
            });
            // $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection[data-type!=${dataType}]`).attr('disabled', true);
        }
    },
    hideDropdownMenu: () => {
        $('.data-type-selection').hide();
    },
    isDataTypeAllowFormat: (dataType) => {
        return [
            DataTypes.SMALL_INT.bs_value,
            DataTypes.SMALL_INT_SEP.bs_value,
            DataTypes.EU_SMALL_INT_SEP.bs_value,

            DataTypes.INTEGER.bs_value,
            DataTypes.INTEGER_SEP.bs_value,
            DataTypes.EU_INTEGER_SEP.bs_value,

            DataTypes.BIG_INT.bs_value,
            DataTypes.BIGINT_SEP.bs_value,
            DataTypes.EU_BIGINT_SEP.bs_value,

            DataTypes.REAL.bs_value,
            DataTypes.REAL_SEP.bs_value,
            DataTypes.EU_REAL_SEP.bs_value,
        ].includes(dataType);
    },
    generateHtml: (idx = 0, defaultValue = datatypeDefaultObject, getKey) => {
        let text = '';
        const englishDataTypes = [
            DataTypes.REAL.name,
            DataTypes.INTEGER.name,
            DataTypes.INTEGER_CAT.name,
            DataTypes.STRING.name,
            DataTypes.DATETIME.name,
            DataTypes.TEXT.name,
        ]
        if (getKey) {
            text = datatypeI18nText[getKey];
            if (_.isObject(text)) {
                text = text[defaultValue.value];
            }
        } else if (englishDataTypes.includes(defaultValue.value)) {
            text = DataTypes[defaultValue.value].selectionBoxDisplay
        } else {
            text = $('#' + DataTypes[defaultValue.value].i18nLabelID).text();
        }
        const attrKey = getKey ? `${getKey}="true" column_type=${dataGroupType[mappingDataGroupType[getKey]]} data-attr-key=${getKey}` : '';
        return `
            <div class="config-data-type-dropdown config-data-type-dropdown_${idx}">
                    <button class="btn btn-default dropdown-toggle" type="button">
                        <span class="csv-datatype-selection row-item for-search" ${attrKey} is-registered-col="${defaultValue.isRegisteredCol}" is-big-int="${defaultValue.is_big_int || false}" data-attr-key="${getKey}" name="${procModalElements.dataType}" id="dataTypeShowValue_${idx}" value="${defaultValue.value}" ${defaultValue.checked}>${text}</span>
                    </button>
                    <div class="data-type-selection">
                        <div class="data-type-selection-content data-type-selection-left">
                            <div class="data-type-selection-box">
                                <span class="data-type-selection-title">${$(procModali18n.i18nSpecial).text()}</span>
                                <ul>
                                    <li class="dataTypeSelection" ${defaultValue.isRegisterProc ? 'disabled=disabled' : ''} is_get_date value="${DataTypes.DATETIME.name}" data-type="${DataTypes.DATETIME.name}">${$(procModali18n.i18nMainDatetime).text()}</li>
                                    <li class="dataTypeSelection" is_main_date value="${DataTypes.DATE.name}" data-type="${DataTypes.DATE.name}">${$(procModali18n.i18nMainDate).text()}</li>
                                    <li class="dataTypeSelection" is_main_time value="${DataTypes.TIME.name}" data-type="${DataTypes.TIME.name}">${$(procModali18n.i18nMainTime).text()}</li>
                                    <li class="dataTypeSelection" is_main_serial_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nMainSerialInt).text()}</li>
                                    <li class="dataTypeSelection" is_main_serial_no value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${$(procModali18n.i18nMainSerialStr).text()}</li>
                                    <li class="dataTypeSelection" is_auto_increment value="${DataTypes.DATETIME.name}" data-type="${DataTypes.DATETIME.name}">${$(procModali18n.i18nDatetimeKey).text()}</li>
                                    <li class="dataTypeSelection" is_serial_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nSerialInt).text()}</li>
                                    <li class="dataTypeSelection" is_serial_no value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${$(procModali18n.i18nSerialStr).text()}</li>
                                </ul>
                            </div>
                            <div class="data-type-selection-box">
                                <span class="data-type-selection-title">${$(procModali18n.i18nFilterSystem).text()}</span>
                                <ul>
                                    <li class="dataTypeSelection" is_line_name value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${$(procModali18n.i18nLineNameStr).text()}</li>
                                    <li class="dataTypeSelection" is_line_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nLineNoInt).text()}</li>
                                    <li class="dataTypeSelection" is_eq_name value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${$(procModali18n.i18nEqNameStr).text()}</li>
                                    <li class="dataTypeSelection" is_eq_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nEqNoInt).text()}</li>
                                    <li class="dataTypeSelection" is_part_name value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${$(procModali18n.i18nPartNameStr).text()}</li>
                                    <li class="dataTypeSelection" is_part_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nPartNoInt).text()}</li>
                                    <li class="dataTypeSelection" is_st_no value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${$(procModali18n.i18nStNoInt).text()}</li>
                                </ul>
                            </div>
                        </div>
                        <div class="data-type-selection-content data-type-selection-right">
                            <div class="data-type-selection-box">
                                <span class="data-type-selection-title">${$(procModali18n.i18nDatatype).text()}</span>
                                <ul>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.REAL.name}" data-type="${DataTypes.REAL.name}">${DataTypes.REAL.selectionBoxDisplay}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${DataTypes.INTEGER.selectionBoxDisplay}</li>
                                    <li class="dataTypeSelection" is_int_cat value="${DataTypes.INTEGER.name}" data-type="${DataTypes.INTEGER.name}">${DataTypes.INTEGER_CAT.selectionBoxDisplay}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.TEXT.name}" data-type="${DataTypes.TEXT.name}">${DataTypes.STRING.selectionBoxDisplay}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.DATETIME.name}" data-type="${DataTypes.DATETIME.name}">${DataTypes.DATETIME.selectionBoxDisplay}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.REAL_SEP.name}" data-type="${DataTypes.REAL.name}">${$('#' + DataTypes.REAL_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.INTEGER_SEP.name}" data-type="${DataTypes.INTEGER.name}">${$('#' + DataTypes.INTEGER_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.EU_REAL_SEP.name}" data-type="${DataTypes.REAL.name}">${$('#' + DataTypes.EU_REAL_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.EU_INTEGER_SEP.name}" data-type="${DataTypes.INTEGER.name}">${$('#' + DataTypes.EU_INTEGER_SEP.i18nLabelID).text()}</li>
                                </ul>
                            </div>
                            <div class="data-type-selection-box">
                                <span class="data-type-selection-title">${$(procModali18n.i18nMultiset).text()}</span>
                                <ul>
                                    <li class="copyToAllBelow copy-item">${$(procModali18n.copyToAllBelow).text()}</li>
                                    <li class="copyToFiltered copy-item">${$(procModali18n.i18nCopyToFiltered).text()}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
        `;
    },
    onClickDataType: (idx, e) => {
        const currentTarget = e.currentTarget || e;
        const attrKey = DataTypeSelection.getAttrOfDataTypeItem(currentTarget);
        const value = currentTarget.getAttribute('value');

        DataTypeSelection.changeDataType(value, currentTarget.textContent, attrKey, idx, currentTarget);

    },
    changeDataType: (value, text, attrKey, idx, el = null) => {
        DataTypeSelection.setValueToShowValueElement(value, text, attrKey, idx);
        // get current datatype
        const beforeDataTypeEle =  document.querySelector(`.config-data-type-dropdown_${idx} ul li.active`);
        const beforeAttrKey = beforeDataTypeEle
            ? DataTypeSelection.getAttrOfDataTypeItem(beforeDataTypeEle)
            : '';

        $(`.config-data-type-dropdown_${idx} ul li`).removeClass('active');

        DataTypeSelection.getOptionByAttrKey(value, attrKey, idx).addClass('active');

        if (allowSelectOneAttrs.includes(attrKey)) {
            // remove attr of others
            DataTypeSelection.resetOtherMainAttrKey(attrKey, idx);
        }

        DataTypeSelection.setDefaultNameAndDisableInput(idx, attrKey);

        // disable copy function if allow select one item
        DataTypeSelection.disableCopyItem(idx, attrKey);

        if (el) {
            parseDataType(el, idx);
        }

        DataTypeSelection.setColumnTypeForMainDateMainTime(idx, attrKey);
        checkDateAndTimeChecked(attrKey, beforeAttrKey);

        // if (highPriorityItems.includes(attrKey)) {
        //     setTimeout(() => {
        //         sortProcessColumns();
        //     }, 500);
        // }
    },
    setColumnTypeForMainDateMainTime: (idx, attrKey) => {
        const isMainDate = 'is_main_date' === attrKey
        const isMainTime = 'is_main_time' === attrKey
        const targetRow = document
            .querySelector(`#processColumnsTable td[data-col-idx="${idx}"]`)
            .parentElement;
        const checkboxColumn = targetRow
            .querySelector('td.column-raw-name input[type="checkbox"]:first-child');

        if (!isMainDate && !isMainTime) {
            const originColumnType = checkboxColumn.getAttribute('origin-column-type');
            if (originColumnType != null && originColumnType !== '') {
                checkboxColumn.dataset['column_type'] = checkboxColumn.getAttribute('origin-column-type');
            } else {
                // do nothing
            }
        } else {
            checkboxColumn.setAttribute('origin-column-type', checkboxColumn.dataset['column_type'] ?? '');
            checkboxColumn.dataset['column_type'] = isMainDate ? masterDataGroup.MAIN_DATE : masterDataGroup.MAIN_TIME;
        }
    },
    onFocusDataType: (idx, e) => {
        storePreviousValue(e.currentTarget)
    },
    getShowValueElement: (idx) => {
        return document.getElementById(`${DataTypeSelection.dataTypeEls.selectValueId}_${idx}`);
    },
    getOptionByAttrKey: (value, attrKey, idx) => {
        return $(`.config-data-type-dropdown_${idx} ul li[value=${value}]${attrKey ? `[${attrKey}]` : '[only-datatype]'}`).first();
    },
    resetOtherMainAttrKey: (attrKey, idx) => {
        const sameDataTypeEl = procModalElements.processColumnsTableBody.find(`tr:not(:eq(${idx}))`).find(`[name=dataType][${attrKey}]`);
        if (!sameDataTypeEl.length) return;
        [...sameDataTypeEl].forEach(el => {
            const index = $(el).closest('tr').index();
            let dataType = $(el).attr('value');
            if ([DataTypes.DATE.name, DataTypes.TIME.name].includes(dataType)) {
                dataType = DataTypes.STRING.name;
            }
            DataTypeSelection.init(index);
            $(el).parents('.config-data-type-dropdown').find(`li[value=${dataType}][only-datatype]`).trigger('click');
        });
    },
    setValueToShowValueElement: (value, text, attrKey, idx) => {
        const showValueEl = DataTypeSelection.getShowValueElement(idx);

        if (text) {
            showValueEl.textContent = text;
        }
        for (const attr of DataTypeAttrs) {
            showValueEl.removeAttribute(attr)
        }
        showValueEl.removeAttribute('column_type');
        showValueEl.removeAttribute('data-attr-key');

        if (attrKey) {
            showValueEl.setAttribute(attrKey, 'true');
            showValueEl.setAttribute('data-attr-key', attrKey);
            showValueEl.setAttribute('column_type', dataGroupType[mappingDataGroupType[attrKey]]);
        }
        showValueEl.setAttribute('value', value);

        DataTypeSelection.setDefaultNameAndDisableInput(idx, attrKey);
    },
    getDataOfSelectedOption: (idx) => {
        const showValueEl = DataTypeSelection.getShowValueElement(idx);
        const attrKey = DataTypeSelection.getAttrOfDataTypeItem(showValueEl);
        const dataType = showValueEl.getAttribute('value');
        return [dataType, attrKey, showValueEl];
    },
    handleCopyToAllBelow: (idx) => {
        const [value, attrKey, showValueEl] = DataTypeSelection.getDataOfSelectedOption(idx);
        const optionEl = DataTypeSelection.getOptionByAttrKey(value, attrKey, idx);
        const targetOptionEls = [...$(showValueEl.closest('tr')).nextAll()];
        targetOptionEls.forEach(el => {
            const rowIdx = el.rowIndex - 1;
            const currentDataType = $(el).find("td[title='raw_data_type'] span[checked='checked']").attr('value');
            if (value === DataTypes.INTEGER.name && currentDataType === DataTypes.INTEGER.name) {
                isCanChangeDataType = true;
            } else if (value === DataTypes.REAL.name &&  [DataTypes.INTEGER.name, DataTypes.REAL.name].includes(currentDataType)) {
                isCanChangeDataType = true;
            } else if (value === DataTypes.TEXT.name) {
                isCanChangeDataType = true;
            } else { // can change data type REAL, INTEGER, TEXT
                isCanChangeDataType = false;
            }
            if (procModalElements.isShowFileName.not(":disabled").length) {
                 isCanChangeDataType = true;
            }
            if (isCanChangeDataType) {
                DataTypeSelection.changeDataType(value, optionEl.text(), attrKey, rowIdx, DataTypeSelection.getOptionByAttrKey(value, attrKey, rowIdx)[0]);
            }
        });
    },
    handleCopyToFiltered: (idx) => {
        const [value, attrKey, showValueEl] = DataTypeSelection.getDataOfSelectedOption(idx);
        const optionEl = DataTypeSelection.getOptionByAttrKey(value, attrKey, idx);
        const targetOptionEls = [...procModalElements.processColumnsTableBody.find('tr:not(.gray):visible')];
        targetOptionEls.forEach(el => {
            const rowIdx = el.rowIndex - 1;
            let isCanChangeDataType = true;
            const currentDataType = $(el).find("td[title='raw_data_type'] span[checked='checked']").attr('value');
            if (value === DataTypes.INTEGER.name && currentDataType === DataTypes.INTEGER.name) {
                isCanChangeDataType = true;
            } else if (value === DataTypes.REAL.name &&  [DataTypes.INTEGER.name, DataTypes.REAL.name].includes(currentDataType)) {
                isCanChangeDataType = true;
            } else if (value === DataTypes.TEXT.name) {
                isCanChangeDataType = true;
            } else { // can change data type REAL, INTEGER, TEXT
                isCanChangeDataType = false;
            }
            if (procModalElements.isShowFileName.not(":disabled").length) {
                 isCanChangeDataType = true;
            }
            if (isCanChangeDataType) {
                DataTypeSelection.changeDataType(value, optionEl.text(), attrKey, rowIdx, DataTypeSelection.getOptionByAttrKey(value, attrKey, rowIdx)[0]);
            }
        });
    },
    setDefaultNameAndDisableInput: (idx, attrKey = '') => {

        const tr = procModalElements.processColumnsTableBody.find(`tr:eq(${idx})`);
        const systemInput = tr.find(`input[name=${procModalElements.systemName}]`);
        const japaneseNameInput = tr.find(`input[name=${procModalElements.japaneseName}]`);
        const localNameInput = tr.find(`input[name=${procModalElements.localName}]`);
        const oldValSystem = systemInput.attr('old-value');
        const oldValJa = japaneseNameInput.attr('old-value');
        if (fixedNameAttrs.includes(attrKey)) {
            // set default value to system and input
            if (!oldValSystem || !oldValJa) {
                systemInput.attr('old-value', systemInput.val());
                japaneseNameInput.attr('old-value', japaneseNameInput.val());
            }
            systemInput.val(fixedName[attrKey].system).prop('disabled', true);
            japaneseNameInput.val(fixedName[attrKey].japanese).prop('disabled', true);
            if (!localNameInput.val()) {
                // fill value of local name only blank, do not disabled.
                localNameInput.val(fixedName[attrKey].system);
            }
        } else {
            if (oldValSystem && oldValJa) {
                systemInput.val(oldValSystem);
                japaneseNameInput.val(oldValJa);
                localNameInput.val('');
            }

            systemInput.prop('disabled', false);
            japaneseNameInput.prop('disabled', false);
        }
    },
    disableCopyItem: (idx, attrKey) => {
        // disable copy function if allow select one item
        if (allowSelectOneAttrs.includes(attrKey)) {
            $(`.config-data-type-dropdown_${idx} ul li.copy-item`).attr('disabled', true);
        } else {
            $(`.config-data-type-dropdown_${idx} ul li.copy-item`).attr('disabled', false);
        }

    },
    disableDatetimeMainItem: (idx) => {
        // disable copy function if allow select one item
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection[is_get_date]`).attr('disabled', true);
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection[is_main_date]`).attr('disabled', true);
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection[is_main_time]`).attr('disabled', true);

    },
    enableDisableFormatText: (idx, rawDataType = '') => {
        const tr = procModalElements.processColumnsTableBody.find(`tr:eq(${idx})`);
        const isAllowFormat = DataTypeSelection.isDataTypeAllowFormat(rawDataType);
        const inputFormat = tr.find(`input[name=${procModalElements.format}]`);
        const inputFormatValue = inputFormat.val();
        if (isAllowFormat) {
            if (inputFormatValue == null || inputFormatValue === '') {
                inputFormat.val(inputFormat[0].previousValue ?? '');
            }
        } else {
            if (!(inputFormatValue == null || inputFormatValue === '')) {
                inputFormat.previousValue = inputFormatValue;
            }
            inputFormat.val('');
        }
        inputFormat.prop('disabled', !isAllowFormat);
    },
    setClassForSelectedItem: (itemValue) => {
        return '';
    },
    addEvents: () => {
        $('.multi-level-dropdown li.dropdown-submenu')
            .off()
            .on("mouseenter", DataTypeSelection.toggleSubMenu)
            .on("mouseleave", DataTypeSelection.toggleSubMenu);

        $('.multi-level-dropdown ul.dropdown-menu > li')
            .off()
            .on('click', DataTypeSelection.itemClick);

        $('.multi-level-dropdown > button > a').each((i, e) => {
            e.value = $(e).data('value');
            e.previousValue = e.value;
        });
    },
    toggleSubMenu: ($obj) => {
        $($obj.currentTarget).find('>ul').toggle();
        $obj.stopPropagation();
        $obj.preventDefault();
    },
    itemClick: (ele) => {
        const $aLiTag = $(ele.currentTarget);
        const $liTag = $aLiTag.parent();
        const idx = $liTag.closest('tr').find('td[title="index"]').attr('data-col-idx');
        const selectValue = $aLiTag.attr('raw-data-type');
        const selectText = $aLiTag.text();
        DataTypeSelection.enableDisableFormatText(idx, selectValue);
        parseDataType_New(ele.currentTarget, idx);
        DataTypeSelection.setValueToShowValueElement(selectValue, selectText, '', idx);
        DataTypeSelection.hideDropdownMenu();
    },
    rawDataTypeTitle: {
        'r': $('#' + DataTypes.REAL.i18nLabelID).text(),
        't': $('#' + DataTypes.TEXT.i18nLabelID).text(),
        'd': $('#' + DataTypes.DATETIME.i18nLabelID).text(),
        'i': $('#' + 'i18nInteger_Int32').text(),
        'b_i': $('#' + DataTypes.BIG_INT.i18nLabelID).text(),
        'T': $('#' + DataTypes.CATEGORY.i18nLabelID).text(),
        'b': $('#' + DataTypes.BOOLEAN.i18nLabelID).text(),
        'date': $('#' + DataTypes.DATE.i18nLabelID).text(),
        'time': $('#' + DataTypes.TIME.i18nLabelID).text(),
    },
    isDataTypeNameAllowFormat: (dataType) => {
        return [
            document.getElementById(DataTypes.SMALL_INT.i18nLabelID),
            document.getElementById(DataTypes.SMALL_INT_SEP.i18nLabelID),
            document.getElementById(DataTypes.EU_SMALL_INT_SEP.i18nLabelID),
            document.getElementById(DataTypes.INTEGER.i18nLabelID),
            document.getElementById(DataTypes.INTEGER_SEP.i18nLabelID),
            document.getElementById(DataTypes.EU_INTEGER_SEP.i18nLabelID),
            document.getElementById(DataTypes.BIG_INT.i18nLabelID),
            document.getElementById(DataTypes.BIGINT_SEP.i18nLabelID),
            document.getElementById(DataTypes.EU_BIGINT_SEP.i18nLabelID),
            document.getElementById(DataTypes.REAL.i18nLabelID),
            document.getElementById(DataTypes.REAL_SEP.i18nLabelID),
            document.getElementById(DataTypes.EU_REAL_SEP.i18nLabelID),
        ]
            .filter(typeElement => typeElement != null)
            .map(typeElement => typeElement.textContent.trim())
            .includes(dataType.trim());
    },
}

const sortProcessColumns = (force = false) => {
    const selectJson = getSelectedColumnsAsJson();
    const [procCfgData,] = collectProcCfgData(selectJson, true);
    const columns = procCfgData.columns;

    generateProcessList(columns, prcPreviewData.rows, prcPreviewData.dummy_datetime_idx, true, force);
};

const checkDateAndTimeChecked = (attrKey, beforeAttrKey='') => {
    const selectJson = getSelectedColumnsAsJson();
    const [procCfgData, _] = collectProcCfgData(selectJson, true);
    const columns = procCfgData.columns;
    let dateColumnChecked = false;
    let timeColumnChecked = false;
    let dateColumnName = "";
    let timeColumnName = "";
    let dateColId = 0;
    let timeColId = 0;

    columns.forEach((col, i) => {
        if(col.data_type === DataTypes.TIME.name && col.is_checked) {
            timeColumnChecked = true;
            timeColId = i;
            timeColumnName = col.column_name;
        }
        if (col.data_type === DataTypes.DATE.name && col.is_checked) {
            dateColumnChecked = true;
            dateColId = i;
            dateColumnName = col.column_name;
        }
    })
    // when only main::Date or main::Time is checked but not the other
    if((timeColumnChecked && !dateColumnChecked) || (!timeColumnChecked && dateColumnChecked)){
        // when there is datetime column already generated, remove it
        if(dateTimeColumnGenerated) {
            const filteredColumns = columns.filter(col => !col.is_get_date);
            generateProcessList(filteredColumns, prcPreviewData.rows, null, true);
            dateTimeColumnGenerated = false;
        }
        if (beforeAttrKey.length || ['is_main_date', 'is_main_time'].includes(attrKey)) {
            $(procModalElements.msgContent)
                .text($(procModalElements.msgSelectDateAndTime).text());
            $(procModalElements.msgModal).modal('show');
        }
    }
    else if (timeColumnChecked && dateColumnChecked && !dateTimeColumnGenerated) {
        // show confirmation modal if it's new process only
        if (!procCfgData.id) {
            $(procModalElements.msgContent)
                .text($(procModalElements.msgGenDateTime).text());
            $(procModalElements.msgModal).modal('show');
        }
        const generatedDateTimeColName = "DatetimeGenerated"
        const generatedDateTimeCol = {
            "column_name": generatedDateTimeColName,
            "column_raw_name": generatedDateTimeColName,
            "name_en": generatedDateTimeColName,
            "data_type": DataTypes.DATETIME.name,
            "operator": null,
            "coef": null,
            "column_type": 99,
            "is_serial_no": false,
            "is_get_date": true,
            "is_auto_increment": false,
            "is_dummy_datetime": false,
            "order": 0,
            "name_jp": generatedDateTimeColName,
            "name_local": null,
            "is_checked": true,
            "old_name_jp": "",
            "old_system_name": ""
        }
        dateTimeColumnGenerated = true;
        columns.push(generatedDateTimeCol)
        const originalRows = prcPreviewData.rows
        const data = generatedDateTimeSampleData(dateColId, timeColId)
        prcPreviewData.rows = originalRows.map((row, i) => {
            row[generatedDateTimeColName] = data[i]
            return row
        })
        generateProcessList(columns, prcPreviewData.rows, null, true)
    }
}

const initSearchProcessColumnsTable = () => {
    initCommonSearchInput(procModalElements.searchInput);
    procModalElements.searchInput.on('keypress input', function (event) {
        const keyCode = event.keyCode
        let value = stringNormalization(this.value.toLowerCase());
        if (keyCode === KEY_CODE.ENTER) {
            const indexs = searchTableContent(procModalElements.processColumnsTableId, value, false);
            procModalElements.processColumnsSampleDataTableBody.find('tr').show();
            procModalElements.processColumnsSampleDataTableBody.find('tr').addClass('gray');
            for (const index of indexs) {
                procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index})`).removeClass('gray');
            }
        } else {
            procModalElements.processColumnsSampleDataTableBody.find('tr').removeClass('gray');
            procModalElements.processColumnsTableBody.find('tr').removeClass('gray');
            const indexs = searchTableContent(procModalElements.processColumnsTableId, value, true);
            procModalElements.processColumnsSampleDataTableBody.find('tr').hide()
            for (const index of indexs) {
                procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index})`).show();
            }
        }
    });

    procModalElements.searchSetBtn.on('click', function () {
        procModalElements.processColumnsTableBody.find('tr:not(.gray) input[name=columnName]:visible').prop('checked', true).trigger('change');
    });

    procModalElements.searchResetBtn.on('click', function () {
        procModalElements.processColumnsTableBody.find('tr:not(.gray) input[name=columnName]:visible').prop('checked', false).trigger('change');
    });
};

const handleScrollSampleDataTable = () => {
    const sampleDataTableWidth = procModalElements.processColumnsSampleDataTableBody.width();
    const sampleDataTableTdWidth = procModalElements.processColumnsSampleDataTableBody.find('td').width();

    $('#sampleDataScrollToLeft').off('click');
    $('#sampleDataScrollToLeft').on('click', function () {
        gotoScroll(0);
    });

    $('#sampleDataScrollToLeftOneStep').off('click');
    $('#sampleDataScrollToLeftOneStep').on('click', function () {
        const currentScrollLeft = parentScrollLeft();
        let offset = currentScrollLeft - sampleDataTableTdWidth;
        gotoScroll(offset);
    });

    $('#sampleDataScrollToRightOneStep').off('click');
    $('#sampleDataScrollToRightOneStep').on('click', function () {
        const currentScrollLeft = parentScrollLeft();
        let offset = currentScrollLeft + sampleDataTableTdWidth;
        gotoScroll(offset);
    });

    $('#sampleDataScrollToRight').off('click');
    $('#sampleDataScrollToRight').on('click', function () {
        gotoScroll(sampleDataTableWidth)
    });

    const parentScrollLeft = () => {
        return $('.proc-config-content').scrollLeft();
    }

    const gotoScroll = (offset) => {
        $('.proc-config-content').animate({
            scrollLeft: offset
        }, 1000);
    };
};

const handleHoverProcessColumnsTableRow = () => {
    procModalElements.processColumnsTableBody.find('tr').off('mouseenter');
    procModalElements.processColumnsTableBody.find('tr').on('mouseenter', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        procModalElements.processColumnsSampleDataTableBody.find('tr').removeClass('hovered');
        procModalElements.processColumnsTableBody.find('tr').removeClass('hovered');
        procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index})`).addClass('hovered');
    });

    procModalElements.processColumnsTableBody.find('tr').off('mouseleave');
    procModalElements.processColumnsTableBody.find('tr').on('mouseleave', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${index})`).removeClass('hovered');
    });


    procModalElements.processColumnsSampleDataTableBody.find('tr').off('mouseenter');
    procModalElements.processColumnsSampleDataTableBody.find('tr').on('mouseenter', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        procModalElements.processColumnsTableBody.find('tr').removeClass('hovered');
        procModalElements.processColumnsSampleDataTableBody.find('tr').removeClass('hovered');
        procModalElements.processColumnsTableBody.find(`tr:eq(${index})`).addClass('hovered');
    });

    procModalElements.processColumnsSampleDataTableBody.find('tr').off('mouseleave');
    procModalElements.processColumnsSampleDataTableBody.find('tr').on('mouseleave', function (e) {
        const tr = $(e.currentTarget);
        const index = tr.index();
        procModalElements.processColumnsTableBody.find(`tr:eq(${index})`).removeClass('hovered');
    });
};

const isDuplicateProcessNameSystemName = () => {
    const isNameEnDup = checkDuplicateProcessName('data-name-en', false);
    removeDuplicateClass("column-name-invalid");
    return isNameEnDup
};

const isMergeModeProcConfig = (dataRowID=undefined) => {
    let listDataSourceName = [];
    let isSameDataSource = false;
    let isDuplicatedProcessName = isDuplicateProcessNameSystemName();
    const allProcesses = Object.keys(processes).map((key) => processes[key]) || [];
    // This currentProcessName is name_en
    currentProcessNameLocal = 'en';
    currentProcessName = procModalElements.proc.val();
    let currentDataSourceName = getSelectedOptionOfSelect(procModalElements.databases).text();

    if (dataRowID) {
        currentProcessName = $(`tr[data-rowId=${dataRowID}] input[name=processName]`).val();
        currentDataSourceName = $(`tr[data-rowId=${dataRowID}] select[name=databaseName]`).find('option:selected').text();
        currentProcessNameLocal = docCookies.getItem('locale') === 'ja' ? 'jp' : 'en';
    }

    if (dataRowID?.includes('proc')) {
        currentProcessName = $(`tr[id=${dataRowID}] input[name=processName]`).val();
        currentDataSourceName = $(`tr[id=${dataRowID}] input[name=databaseName]`).val();
        currentProcessNameLocal = docCookies.getItem('locale') === 'ja' ? 'jp' : 'en';
    }

    isDuplicatedProcessName = isDuplicatedProcessNameDataRow(currentProcessName, undefined, currentProcessNameLocal);
    const listProcessCurrentName = allProcesses.filter(ds => ds.shown_name === currentProcessName);

    if (isEmpty(currentDataSourceName)) {
        return false;
    }

    listProcessCurrentName.filter(ds => listDataSourceName.push(ds?.data_source?.name));

    if (listDataSourceName.indexOf(currentDataSourceName) > -1) {
        isSameDataSource = true;
    }

    return !!(isDuplicatedProcessName && !isSameDataSource);
}

const showModalConfirmMergeMode = () => {
    $(procModalElements.confirmMergeMode).modal('show');
}

const mergeModeProcess = async (procId, dataRowID, baseProc, dbsId) => {
    loading.css('z-index', 9999);
    loading.show();
    clearMergeModeModal();
    $(procModalElements.confirmMergeMode).modal('hide');
    procModalElements.procModal.modal('hide');
    procModalElements.procMergeModeModal.modal('show');
    $('#mergeProcDatasourceName').attr('disabled', false);

    // set current proc
    procModalCurrentProcId = procId;
    if (!baseProc) {
        baseProc = isDuplicatedProcessNameDataRow(currentProcessName, true, currentProcessNameLocal);
    }

    // load databases
    const dbInfo = await getAllDatabaseConfig();
    // filter: exclude datasource of base process
    const filteredDbInfo = dbInfo.filter((ds) => ds.id !== baseProc.data_source_id)
    // value of key 'processName' is always 'baseProc.name_en'
    const procNames = {processName: baseProc.name_en, processJapaneseName: baseProc.name_jp, processLocalName: baseProc.name_local};
    // update name
    Object.entries(procNames).forEach(([name, value]) => {
        procModalElements.procMergeModeModal.find(`input[name=${name}]`).val(value);
        procModalElements.procMergeModeModal.find(`input[name=${name}]`).attr('disabled', 'disabled');
    });
    // get datasource selection
    const database = procModalElements.procMergeModeModal.find('select[name=databaseName]')[0];
    // get current datasource selected
    const selectedDatasourceID = $(`tr[data-rowid=${dataRowID}] select[name=databaseName]`).val() ?? $(`tr[id=${dataRowID}]`).attr('data-ds-id');
    // reset datasource
    $(database).html('');

    if (filteredDbInfo) {
        const selectedDs = database ? ($(database).val() ? $(database).val() : procDsSelected) : null;
        const currentDs = procModalElements.dsID.val() || dbsId || selectedDs;
        filteredDbInfo.forEach((ds) => {
            const options = {
                type: ds.type,
                value: ds.id,
                text: ds.name,
                title: ds.en_name,
            };
            if ((String(options.value) === String(selectedDatasourceID)) ||
                (currentDs && ds.id === Number(currentDs))) {
                options.selected = 'selected';
            }
            $(database).append(
                $('<option/>', options),
            );
        });
        //
        // procModalElements.databasesMergeMode.trigger('change');
    }
    addAttributeToElement();

    // get data for child and parent processes
    const procModalForm = $(procModalElements.procMergeModeModal).find(procModalElements.mergeProcFormId);
    const formDataChildProc = new FormData(procModalForm[0]);
    const formDataParentProc = new FormData();
    formDataParentProc.set("databaseName",baseProc.data_source_id);

    baseProcObj = baseProc;
    const baseProcData = await getLatestRecordsFromApi(formDataParentProc);
    const baseProcColsData = await getProcessColumnsInfo(baseProc.id);
    childProcData = await getLatestRecordsFromApi(formDataChildProc);
    let mergedColumns = [];
    if (procId) {
        // opening modal of a merged proc
        $('#createOrUpdateChildProcCfgBtn').hide();
        $(procModalElements.showPreviewBtnToMerge).hide();
        $('#mergeProcDatasourceName').attr('disabled', true);
        mergedColumns = await getProcessColumnsInfo(procId)
    } else {
        // new merge proc
        $('#createOrUpdateChildProcCfgBtn').show();
        $(procModalElements.showPreviewBtnToMerge).show();
        $('#mergeProcDatasourceName').attr('disabled', false);
    }
    baseProcDataCols = JSON.parse(JSON.stringify(baseProcColsData));

    const dummyDatetimeIdx = baseProcData.dummy_datetime_idx;
    const dummyChildDatetimeIdx = childProcData.dummy_datetime_idx;
    const colsMapping = generateMergeModeColumnMapping(baseProcDataCols, childProcData.cols, mergedColumns);

    if (colsMapping.length > baseProcDataCols.length) {
        baseProcDataCols.push(...Array(colsMapping.length - baseProcDataCols.length).fill({}));
    }

    generateParentProcessTable(baseProcDataCols, baseProcData.rows, dummyDatetimeIdx);
    generateChildProcessColumns(baseProcColsData, colsMapping, childProcData.rows, dummyChildDatetimeIdx);
    generateChildProcessTable(colsMapping, childProcData.rows, dummyChildDatetimeIdx);
    loading.hide()
}

const removeDuplicateClass = (cl) => {
    procModalElements.proc.removeClass(cl);
    procModalElements.procLocalName.removeClass(cl);
    procModalElements.procJapaneseName.removeClass(cl);
}

const isDuplicatedProcessNameDataRow = (procName, procIdReturn = false, nameLocale = 'en') => {
    const existingProcIdMasterNames = {};
    $('#tblProcConfig tbody tr').each(function f() {
        const procId = $(this).data('proc-id');
        const rowId = $(this).attr('id');
        if (rowId) {
            existingProcIdMasterNames[`${procId}`] = $(`#${rowId} input[name=processName]`).data(`name-${nameLocale}`) || '';
        }
    });

    // check for duplication
    const beingEditedProcName = procName;
    const existingMasterNames = Object.values(existingProcIdMasterNames);
    const isEditingSameProc = existingProcIdMasterNames[currentProcItem.data('proc-id')] === beingEditedProcName;
    const isDuplicatedProc = beingEditedProcName
        && existingMasterNames.includes(beingEditedProcName);

    if (procIdReturn) {
        const [baseData] = Object.entries(existingProcIdMasterNames)
            .filter(([id, v]) => v === procName && processes[id] && !processes[id].parent_id);
        if (baseData) {
            const [baseId,] = baseData;
            return processes[baseId];
        }
        return null;
    }

    return isDuplicatedProc;
}

const getLatestRecordsFromApi = async (formData) => {
    let data = null;
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
            console.log('error', e)
            data = null;
        },
    });
    return data;
}

const getProcessColumnsInfo = async (procId) => {
    let data = null;
    await $.ajax({
        url: `api/setting/proc_config/${procId}`,
        type: 'GET',
        cache: false,
        success: (json) => {
            data = json.data.columns;
        },
        error: (e) => {
            console.log('error', e)
            data = null;
        },
    });
    return data;
}

const generateParentProcessTable = (cols, rows, dummyDatetimeIdx) => {
    // generate row htmls here
    let tableContent = ``
    let sampleContent = ``;
    cols.forEach((col,i) => {
        const col_raw_name = col.column_raw_name || '';
        const col_en_name = col.name_en || '';
        const col_jp_name = col.name_jp || '';
        const col_data_type = col.data_type || '';
        const col_id = col.id || '';
        const col_name = col.column_name || '';

        const rowHtml = `
            <tr>
                <td class="text-center show-raw-text row-item column-number" 
                    data-column-id="${col_id}" data-col-idx="${i}">${i + 1}</td>
                <td class="parent-column-system-name">
                    ${col_raw_name || col_name}
                </td>
                <td class="parent-column-japanese-name">
                    ${col_jp_name}
                </td>
                <td class="parent-column-local-name">
                    ${col_en_name}
                </td>
                <td class="parent-column-data-type">
                    ${col_data_type}
                </td>
                <td class="parent-column-raw-name">
                    ${col_raw_name}
                </td>
            </tr>
        `
        tableContent += rowHtml

        // generate sample data
        const checkedAtr = 'checked=checked';
        sampleContent += `<tr>${generateSampleData(rows, dummyDatetimeIdx, col,i, checkedAtr).join('')}</tr>`;
    })

    $(procModalElements.parentProcessColumnsTableBody).html(tableContent)
    $(procModalElements.processColumnsMergeModeBaseTableBody).html(sampleContent);

}

const generateChildProcessTable = (cols, rows, dummyDatetimeIdx) => {
    // generate row htmls here
    let sampleContent = ``;
    cols.forEach((col,i) => {
        const checkedAtr = 'checked=checked';
        sampleContent += `<tr column-name="${col.column_name || col.column_raw_name || ''}">${generateSampleData(rows, dummyDatetimeIdx, col,i, checkedAtr).join('')}</tr>`;
    });
    // generate sample data
    $(procModalElements.processColumnsMergeModeChildTableBody).html(sampleContent);
}

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
        return `<td style="color: ${isKSep ? 'orange' : ''}" is-big-int="${col.is_big_int ? 1 : 0}" data-original="${row[col.column_name] || ''}" class="sample-data row-item show-raw-text${columnColor}" ${checkedAtr}> ${!isEmpty(val) ? val : ''} </td>`;
    });
}

const generateMergeModeColumnMapping = (baseCols, childCols, mergedColumns= []) => {
    const baseColumnsName = baseCols.map(item => item.column_name || item.column_raw_name);
    const dictMergedCol = {};
    mergedColumns.forEach((col) =>{
        const childMergedCol = col.column_name || col.column_raw_name;
        const parentMergedCol = col.parent_column.column_name || col.parent_column.column_raw_name;
        dictMergedCol[parentMergedCol] = childMergedCol;
    })
    const cloneChildCols = JSON.parse(JSON.stringify(childCols));
    const colsMappingIndex = [];
    const colsMapping = baseColumnsName.map(key => {
        const mapCol = dictMergedCol[key] || key;
        const index = childCols.findIndex(item => item.column_name === mapCol || item.column_raw_name === mapCol);
        if (index === -1) {
            return {};
        }
        colsMappingIndex.push(index)
        return childCols[index];
    });
    colsMappingIndex.sort((a, b) => b - a);
    const childNoMapping = cloneChildCols.filter((_, index) => !colsMappingIndex.includes(index));
    return [...colsMapping, ...childNoMapping];
}

const generateChildProcessColumns = (baseCols, cols, rows, dummyChildDatetimeIdx) => {
    let tableContent = ``;
    const colsName = cols.filter(item => Object.keys(item).length > 0).map(e => e.column_name || e.column_raw_name);
    cols.forEach((col, i) => {
        const col_raw_name = col.column_raw_name || '';
        const col_name = col.column_name || '';
        const showName = col_name || col_raw_name;
        const options = colsName.map(function(option, i) {
            if (option === showName) {
                return `<option value="${option}" selected="selected" data-col-name="${ option }">${option}</option>`
            } else {
                return `<option value="${option}" data-col-name="${ option }">${option}</option>`
            }
        });
        const tableOptions = ['<option value="">---</option>', ...options].join('');
        let tdHtml = `<td class='column-format'>
                                <select name='merge-mode-column-name' org-selected='${showName}' old-selected='${showName}' class='form-control' onchange='changeMergeColumnOption(this, ${dummyChildDatetimeIdx})'>
                                    ${tableOptions}
                                </select>
                            </td>`;
        if (i >= baseCols.length) {
            tdHtml = `<td class='column-format' style='padding: 0 8px;' column-name='${showName}'>
                        ${showName}
                      </td>`;
        }
        const rowHtml =`<tr>${tdHtml}</tr>`;
        tableContent += rowHtml;
    })
    $(procModalElements.processColumnsMergeModeTableBody).html(tableContent);
}

const changeMergeColumnOption = (elem, dummyDatetimeIdx) => {
    const currentOptionValue = $(elem).val();
    const oldSelected = $(elem).attr('old-selected');
    const currentRowIndex = $(elem).closest('tr').index();
    const checkedAtr = 'checked=checked';
    const baseCols = baseProcDataCols.filter(baseProc => Object.keys(baseProc).length !== 0);
    const cols = generateMergeModeColumnMapping(baseCols, childProcData.cols);
    const rows = childProcData.rows ;
    const colOldIndex = cols.findIndex(col => col.column_name === oldSelected || col.column_raw_name === oldSelected)
    $(elem).attr('old-selected', currentOptionValue);
    if (currentOptionValue === '') {
        $(procModalElements.processColumnsMergeModeChildTableRow).eq(currentRowIndex).attr('column-name', '').find('td').text('')
        if (oldSelected && colOldIndex !== -1) {
            createNewMergeModeTableRow(rows, dummyDatetimeIdx, cols[colOldIndex], colOldIndex, checkedAtr);
        }
        return;
    }
    const optionsSameValue = $(procModalElements.processColumnsMergeModeTableSelectOption).not(elem)
        .find(`option[value=${currentOptionValue}]:selected`);
    const tdSameValue = $(procModalElements.processColumnsMergeModeTableBody).not(elem)
        .find(`td[column-name=${currentOptionValue}]`);
    if (optionsSameValue.length) {
        optionsSameValue.closest('select').val('');
        const rowsChildSampleDataMapping = $(procModalElements.processColumnsMergeModeChildTableBody).find(`tr[column-name=${currentOptionValue}]`);
        rowsChildSampleDataMapping.attr('column-name', '').find('td').text('');
    }
    if(tdSameValue.length) {
        $(procModalElements.parentProcessColumnsTableBody+' tr:last').remove();
        $(procModalElements.processColumnsMergeModeChildTableBody+' tr').eq(tdSameValue.closest('tr').index()).remove();
        $(procModalElements.processColumnsMergeModeBaseTableBody+' tr:last').remove();
        tdSameValue.closest('tr').remove();
    }

    const colIndex = cols.findIndex(elem => elem.column_name === currentOptionValue || elem.column_raw_name === currentOptionValue);
    const sampleData = `<tr column-name="${currentOptionValue}">${generateSampleData(rows, dummyDatetimeIdx, cols[colIndex], colIndex, checkedAtr).join('')}</tr>`;
    $(procModalElements.processColumnsMergeModeChildTableRow).eq(currentRowIndex).after(sampleData);
    $(procModalElements.processColumnsMergeModeChildTableRow).eq(currentRowIndex).remove();
    if (oldSelected && colOldIndex !== -1) {
        createNewMergeModeTableRow(rows, dummyDatetimeIdx, cols[colOldIndex], colOldIndex, checkedAtr);
    }
}

const createNewMergeModeTableRow = (rows, dummyDatetimeIdx, col, colIndex, checkedAtr) => {
    const columnName = col.column_name || col.column_raw_name || '';
    if (!columnName || $(procModalElements.processColumnsMergeModeChildTableRow+`[column-name=${columnName}]`).length) return;
    const sampleData = `<tr column-name="${columnName}">${generateSampleData(rows, dummyDatetimeIdx, col, colIndex, checkedAtr).join('')}</tr>`;
    const parentProcessNo = $(procModalElements.parentProcessColumnsTableBody).find(`tr`).length + 1;
    const emptyParentProcessRow = `
        <tr>
            <td class="text-center show-raw-text row-item column-number" data-column-id="" data-col-idx="">${parentProcessNo}</td>
            <td class="parent-column-system-name">
            </td>
            <td class="parent-column-japanese-name">
            </td>
            <td class="parent-column-local-name">
            </td>
            <td class="parent-column-data-type">
            </td>
            <td class="parent-column-raw-name">
            </td>
        </tr>`
    const cloneBaseDataRow =  $(procModalElements.processColumnsMergeModeBaseTableBody).find(`tr:last`).clone();

    cloneBaseDataRow.find('td').attr('data-original', '').text('');

    $(procModalElements.processColumnsMergeModeTableBody).append(`<tr><td class='column-format' style='padding: 0 8px;' column-name = '${columnName}'>${columnName}</td></tr>`);
    $(procModalElements.parentProcessColumnsTableBody).append(emptyParentProcessRow);
    $(procModalElements.processColumnsMergeModeChildTableBody).append(sampleData);
    $(procModalElements.processColumnsMergeModeBaseTableBody).append(cloneBaseDataRow);
}

const clearMergeModeModal = () => {
    $(procModalElements.parentProcessColumnsTableBody).empty();
    $(procModalElements.processColumnsMergeModeTableBody).empty();
    $(procModalElements.processColumnsMergeModeBaseTableBody).empty();
    $(procModalElements.processColumnsMergeModeChildTableBody).empty();
    // clear baseProcData
    childProcData = null;
    baseProcObj = null;
    baseProcDataCols = null;
}

$(procModalElements.mergeModeTableChild).on('scroll', function () {
    $(procModalElements.mergeModeTableBase).scrollLeft($(this).scrollLeft());
});

$(procModalElements.mergeModeTableBase).on('scroll', function () {
    $(procModalElements.mergeModeTableChild).scrollLeft($(this).scrollLeft());
});
