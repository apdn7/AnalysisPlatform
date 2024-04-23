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
let userEditedProcName = false;
let userEditedDSName = false;
let setDatetimeSelected = false;
let prcPreviewData;
let isClickPreview = false;
let allProcessColumns = []
let errCells = [];
let dataGroupType = {};
let checkOnFocus = true;

const procModalElements = {
    procModal: $('#procSettingModal'),
    procModalBody: $('#procSettingModalBody'),
    procSettingContent: $('#procSettingContent'),
    proc: $('#procSettingModal input[name=processName]'),
    procJapaneseName: $('#procSettingModal input[name=processJapaneseName]'),
    procLocalName: $('#procSettingModal input[name=processLocalName]'),
    comment: $('#procSettingModal input[name=comment]'),
    databases: $('#procSettingModal select[name=databaseName]'),
    tables: $('#procSettingModal select[name=tableName]'),
    showRecordsBtn: $('#procSettingModal button[name=showRecords]'),
    latestDataHeader: $('#procSettingModal table[name=latestDataTable] thead'),
    latestDataBody: $('#procSettingModal table[name=latestDataTable] tbody'),
    processColumnsTableBody: $(
        '#procSettingModal table[name=processColumnsTable] tbody',
    ),
    processColumnsTable: $(
        '#procSettingModal table[name=processColumnsTable]',
    ),
     processColumnsSampleDataTableBody: $(
        '#procSettingModal table[name=processColumnsTableSampleData] tbody',
    ),
    processColumnsTableId: 'processColumnsTable',
    okBtn: $('#procSettingModal button[name=okBtn]'),
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
    changeModeBtn: '#prcEditMode',
    confirmSwitchButton: '#confirmSwitch',
    settingContent: '#procSettingContent',
    prcSM: '#prcSM',
    autoSelectAllColumn: '#autoSelectAllColumn',
    autoSelect: '#autoSelect',
    checkColsContextMenu: '#checkColsContextMenu',
    createOrUpdateProcCfgBtn: $('#createOrUpdateProcCfgBtn'),
    dbTableList: '#dbTableList',
    fileInputPreview: '#fileInputPreview',
    fileName: $('#procSettingModal input[name=fileName]'),
    dataGroupTypeClassName: 'data-type-selection',
    dataTypeSelection: 'dataTypeSelection',
    sampleDataColumnClassName: 'sample-data-column'
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
};

const isJPLocale = docCookies.isJaLocale();
const translateToEng = async  (text) => {
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
                setProcessName(dataRowID);
            }
            // hide 'table' dropdown if there is CSV datasource
            if (isHiddenFileInput) {
                toggleDBTableAndFileName();
            }
        } else if (res.tables) {
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
        // load default tables
        if (procId) return;

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
                <option value="${DataTypes.INTEGER.value}"${checkedColType(DataTypes.INTEGER.name)} ${col.is_big_int ? 'disabled': ''}>${intlabel}</option>
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
            data += `<td style="color: ${isKSep ? 'orange' : ''}" is-big-int="${col.is_big_int ? 1 : 0}" data-original="${row[col.column_name] || ''}" class="${columnColor}"> ${val  || ''} </td>`;
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

const generateProcessList = (cols, rows, dummyDatetimeIdx, fromRegenerate = false, force = false, autoCheckSerial = false) => {
    if (!cols || !cols.length) return;

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
    const sortedCols = [...cols].sort((a, b) => { return a.column_type - b.column_type});
    if (fromRegenerate && JSON.stringify(cols) === JSON.stringify(sortedCols) && !force) return;

    procModalElements.processColumnsTableBody.empty();
    procModalElements.processColumnsSampleDataTableBody.empty();
    let hasMainSerialCol = false;


    // case rows = [] -> no data for preview
    if (rows.length == 0) {
        rows = Array(10).fill({});
    }
    const sampleData = (col, i, checkedAtr) => rows.map((row) => {
        const key = col.column_name; //col.column_name ||
        let val;
        const columnColor = dummyDatetimeIdx === i ? ' dummy_datetime_col' : '';
        if (col.is_get_date) {
            val = parseDatetimeStr(row[col.column_name]);
        } else {
            val = row[key];
            if (col.data_type === DataTypes.INTEGER.name) {
                val = parseIntData(val);
            } else if (col.data_type === DataTypes.REAL.name) {
                val = parseFloatData(val);
            }
        }
        const isKSep = [DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(col.data_type);
        return `<td style="color: ${isKSep ? 'orange' : ''}" is-big-int="${col.is_big_int ? 1 : 0}" data-original="${row[col.column_name] || ''}" class="sample-data row-item show-raw-text${columnColor}" ${checkedAtr}> ${!isEmpty(val) ? val : ''} </td>`;
    });
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
        if (isChecked) {
            checkedTotal ++;
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

        const checkedAtr = isChecked ? 'checked=checked': '';

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
                                <td class="text-center show-raw-text row-item" ${checkedAtr}
                                    title="index">${i + 1}
                                </td>
                                <td class="show-raw-text">
                                    <div class="custom-control custom-checkbox">
                                        <input type="checkbox"
                                               class="check-item custom-control-input col-checkbox"
                                               onchange="handleChangeProcessColumn(this, ${isRegisterProc})"
                                               name="${procModalElements.columnName}"
                                                value="${col.column_name}"
                                                id="checkbox-${col.column_name}_${i}" 
                                                data-type="${col.data_type}" 
                                                data-romaji="${col.name_en || col.column_name}"
                                                data-isnull="${col.check_same_value ? col.check_same_value.is_null : false}" 
                                                data-col-index="${i}" 
                                                data-is-dummy-datetime="${isDummyDatetimeCol}" 
                                                data-name-jp="${col.name_jp || ''}" 
                                                data-name-local="${col.name_local || ''}" ${checkedAtr}>
                                        <label class="custom-control-label row-item for-search" for="checkbox-${col.column_name}_${i}" ${checkedAtr}>${col.column_raw_name || col.column_name}</label>
                                        <input id="isDummyDatetime${col.column_name}" type="hidden" name="${procModalElements.isDummyDatetime}"
                                        value="${isDummyDatetime}">
                                        <input name="${procModalElements.columnRawName}" type="hidden" value="${col.column_raw_name}">
                                    </div>
                                </td>
                                <td>
                                    <span>${DataTypeSelection.generateHtml(i, dataTypeObject, getKey)}</span>
                                </td>
                                <td>
                                    <input type="text" name="${procModalElements.systemName}" class="form-control row-item" old-value="${isFixedName ? (col.old_system_name || col.name_en || col.column_name) : ''}" value="${isFixedName ? fixedName[getKey].system : (col.name_en || col.column_name)}" ${checkedAtr} ${isFixedName ? 'disabled': ''}>
                                </td>
                                <td>
                                    <input type="text" name="${procModalElements.japaneseName}" class="form-control row-item" onchange="handleEmptySystemNameJP(this, procModalElements.systemName)" old-value="${isFixedName ? (col.old_name_jp || col.name_jp || '') : ''}" value="${isFixedName ? fixedName[getKey].japanese : (col.name_jp || '')}" ${checkedAtr} ${isFixedName ? 'disabled': ''}>
                                </td>
                                <td>
                                    <input type="text" name="${procModalElements.localName}" class="form-control row-item" onchange="handleEmptySystemName(this, procModalElements.systemName)" value="${col.name_local || ''}" ${checkedAtr}>
                                </td>
                                <td>
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
        sampleContent += `<tr>${sampleData(col, i, checkedAtr).join('')}</tr>`;
        dataTypeObjs.push(dataTypeObject);
    });

    procModalElements.processColumnsTableBody.html(tableContent);
    procModalElements.processColumnsSampleDataTableBody.html(sampleContent);
    DataTypeSelection.showDataTypeModal();

    showTotalCheckedColumns(sortedCols.length, checkedTotal);
    parseEUDataTypeInFirstTimeLoad();

    if (!fromRegenerate) {
        showConfirmSameAndNullValueInColumn(sortedCols);
        showConfirmKSepDataModal(colTypes);
    }
    handleScrollSampleDataTable();
    handleHoverProcessColumnsTableRow();
    validateSelectedColumnInput();
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
    const rowIndex = $(ele).closest('tr').index();
    const sampleDataRow = procModalElements.processColumnsSampleDataTableBody.find(`tr:eq(${rowIndex})`);
    if (isChecked) {
        $(ele).closest('tr').find('.row-item').attr('checked', 'checked');
        sampleDataRow.find('.row-item').attr('checked', 'checked');
    } else {
        $(ele).closest('tr').find('.row-item').removeAttr('checked');
        sampleDataRow.find('.row-item').removeAttr('checked');
    }

    if (!isRegisterProc && !isChecked && isDummyDatetimeCol) {
        // remove dummy datetime if uncheck this column
        $(ele).closest('tr').remove();
        sampleDataRow.remove();
        prcPreviewData.dummy_datetime_idx = null;
        sortProcessColumns(true);
    }

    const checkedTotal = $('input.col-checkbox:checked').length;
    setTotalCheckedColumns(checkedTotal);
};
const parseDatetimeStr = (datetimeStr) => {
    datetimeStr = trimBoth(String(datetimeStr));
    datetimeStr = convertDatetimePreview(datetimeStr);
    const millis = checkDatetimeHasMilliseconds(datetimeStr);
    let formatStr = DATE_FORMAT_TZ
    if (millis) {
        formatStr = DATE_FORMAT_WITHOUT_TZ + millis + ' Z';
    }
    datetimeStr = moment(datetimeStr)
        .format(formatStr);
    if (datetimeStr === 'Invalid date') {
        datetimeStr = '';
    }
    return datetimeStr;
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
};

const createOptCoefHTML = (operator, coef, isNumeric, checkedAtr='') => {
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

const handleCheckAutoAndAllSelect = (el, autoSelect=false) => {
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
            if (!isEditPrc && !json.has_ct_col) {
                showDummyDatetimeModal(json, true);
            } else {
                showLatestRecordsFromPrc(json);

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

const getSelectedColumnsAsJson = () => {
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
    }, unusedColumns];
};

const saveProcCfg = (selectedJson, importData = true) => {
    clearWarning();
    procModalElements.procModal.modal('hide');
    procModalElements.confirmImportDataModal.modal('hide');

    const [procCfgData, unusedColumns] = collectProcCfgData(selectedJson);
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
    if ($('span[name=dataType][value=DATETIME][checked][is_get_date=true]').length === 0) {
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
        displayRegisterMessage(procModalElements.alertMessage, {
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

const showHideModes = (isEditMode) => {
    // show/hide tables
    // change mode name from button
    const settingModeName = $(procModali18n.settingMode).text();
    const editModeName = $(procModali18n.editMode).text();
    if (isEditMode) {
        $(`${procModalElements.changeModeBtn} span`).text(` ${settingModeName}`);
        $(procModalElements.prcSM).parent().removeClass('hide');
        $(procModalElements.settingContent).addClass('hide');
    } else {
        // clear editMode table
        $(procModalElements.prcSM).html('');
        $(`${procModalElements.changeModeBtn} span`).text(` ${editModeName}`);
        $(procModalElements.prcSM).parent().addClass('hide');
        $(procModalElements.settingContent).removeClass('hide');
    }
    // disable register buttons
    $(procModalElements.okBtn).prop('disabled', isEditMode);
};

const resetColor = () => {
    $('table.jexcel td').css('color', 'white');
    $('table.jexcel td:nth-child(2)').css('color', 'gray');
    $('table.jexcel td').css('background-color', '#303030');  // TODO color const
    $('table.jexcel td:nth-last-child(-n+10)').css('color', 'gray');
}

const generateSpreadSheet = () => {
    const getCols = (tableId) => {
        let headerLabels = [];
        let colWidths = [];
        $(`#${tableId}`).find('thead th').each((_, th) => {
            const headerName = $(th).text().trim();
            const colWidth = $(th).width();
            if (headerName) {
                headerLabels.push(headerName);
                colWidths.push(colWidth);
            }
        });
        const orgTableWidth = $(`table#${tableId}`).width();

        // drop no. column
        const numCols = headerLabels.length;
        headerLabels = headerLabels.slice(1, numCols);
        colWidths = colWidths.slice(1, numCols);

        // fix spreadsheet table length
        const totalWidth = colWidths.reduce((acc, v) => acc + v);
        const diff = Math.max(orgTableWidth - totalWidth, 0);
        colWidths[0] = colWidths[0] + diff - 60;

        return { headerLabels, colWidths };
    };
    const tableHeadInfor = getCols(procModalElements.processColumnsTableId);

    // get config data
    const settingModeData = getSettingModeRows();
    // get sample data
    const sampleData = getSampleData();
    const previewData = settingModeData.map((v, i) => v.concat(sampleData.content[i]));

    const dataGroups = $(`.${procModalElements.dataGroupTypeClassName}:eq(0)`)
        .find(`.${procModalElements.dataTypeSelection}`)
        .map(function() {return $(this).text()})
        .get();
    // hide scroll bar
    $('.scroll-content').css('display', 'none');
    jspreadsheet(document.getElementById('prcSM'), {
        data: previewData,
        colHeaders: tableHeadInfor.headerLabels.concat(sampleData.header),
        colWidths: tableHeadInfor.colWidths.concat(sampleData.columnWidth),
        defaultColAlign: 'left',
        columns: [
            { type: 'text', readOnly: true },
            {
                type: 'dropdown',
                source: dataGroups
            },
            { type: 'text'},
            { type: 'text'},
            { type: 'text'},
            { type: 'text'},
            { type: 'text'},
            { type: 'text', readOnly: true}, // sample data
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
            { type: 'text', readOnly: true},
        ],
        ...jspreadsheetCustomHooks(),
    });

    resetColor();
};

const zip = (arr, ...arrs) => arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));
const mapBoolean = v => (v ? true : '');

const getSampleData = () => {
    const sampleRows = Array.from(procModalElements.processColumnsSampleDataTableBody.find('tr'));
    const content = sampleRows.map(tr => Array.from($(tr).find('td')).map(td => $(td).text()));
    const sampleColumns = procModalElements.processColumnsSampleDataTableBody.find('tr:eq(0) td');
    const columnName = $(`.${procModalElements.sampleDataColumnClassName}`).text();
    const header = Array(sampleColumns.length).fill(columnName);
    const columnWidth = Array.from(sampleColumns.map(function() {return $(this).width()}))
    return { header, content, columnWidth };
};
const getSettingModeRows = () => {
    const emptyList = [''];
    const selectJson = getSelectedColumnsAsJson();
    const SELECT_ROOT = Object.keys(selectJson)[0]; // TODO use common function
    const columnRawNames = selectJson[SELECT_ROOT][procModalElements.columnRawName] || emptyList;
    const dataType = $(`span[name=${procModalElements.dataType}]`)
        .map(function(){ return $(this).text()}).get() || emptyList; // main::日時...
    const systemName = selectJson[SELECT_ROOT][procModalElements.systemName] || emptyList;
    const japaneseNames = selectJson[SELECT_ROOT][procModalElements.japaneseName] || emptyList;
    const localNames = selectJson[SELECT_ROOT][procModalElements.localName] || emptyList;
    const operators = selectJson[SELECT_ROOT][procModalElements.operator] || emptyList;
    const coefsRaw = selectJson[SELECT_ROOT][procModalElements.coef] || emptyList;
    return zip(
        columnRawNames,
        dataType,
        systemName,
        japaneseNames,
        localNames,
        operators.map(v => (v === 'regex' ? i18n.validLike : v)),
        coefsRaw,
    );
};

const getDupIndices = (arr, excludes = new Set()) => {
    if (isEmpty(arr) || arr.length < 2) return [];

    // return list of duplicate indices: [idx1, idx2, ...]
    const elementWithIndex = arr.map((x,y) => [x,y]);
    return elementWithIndex
        .filter((el, index) => !excludes.has(el[0]) && arr.indexOf(el[0]) !== index)
        .map(tuple => tuple[1]);
}

const buildDictColWithKey = (procColumns, key='data_type') => {
    const dicCol2Type = {};
    for (let col of procColumns){
        const colName = col['column_name'];
        dicCol2Type[colName] = col[key] || '';
    }
    return dicCol2Type;
}

const checkExcelDataValid = (verticalData, validationColNames, dataTypes, requiredCols=[]) => {
    const validateEmpty = (columnData, dataTypes=[]) => {
        return columnData.map((data, i) => data !== '' ? null : i)
            .filter(data => data !== null);
    };

    const validator = {
        dataType: validateEmpty,
        englishName: (columnData, dataTypes=[]) => {
            const duplicated = getDupIndices(columnData);
            const empty = validateEmpty(columnData);
            return duplicated.concat(empty);
        },
        japaneseName: (columnData, dataTypes=[]) => {
            return getDupIndices(columnData);
        },
        localName: (columnData, dataTypes=[]) => {
            return getDupIndices(columnData);
        },
        operator: (columnData, dataTypes= []) => {
            const invalidCells = [];
            for(let rowIdx in columnData){
                const cellVal = columnData[rowIdx];
                const dataType = dataTypes[rowIdx];
                const isOperatorOK = DataTypes[dataType].operator.includes(cellVal);
                if (!isOperatorOK){
                    invalidCells.push(rowIdx);
                }
            }
            return invalidCells;
        },
        coef: (columnData, dataTypes=[]) => {
            const invalidCoef = (val, idx) => {
                const invalid = numericTypes.has(dataTypes[idx]) && isNaN(val)
                    || `${val}`.trim() && dataTypes[idx] === DataTypes.DATETIME.name;
                if (invalid && numericTypes.has(dataTypes[idx])) {
                    return !THOUSAND_SEP_PATTERN.test(val);
                }
                return invalid;
            }
            const numericTypes = new Set([DataTypes.REAL.name, DataTypes.INTEGER.name])
            // return indexes of invalid items selected
            return columnData.map((val, idx) => [idx, invalidCoef(val, idx)])
                .filter(x => x[1] === true)  // true = invalid
                .map(x => x[0]);
        },
    };

    const convertIdxToExcelCol = (idx) => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUWXYZ';
        if (isEmpty(idx) || idx >= alphabet.length) return '';
        return alphabet[idx];
    };

    let errorTextCells = [];
    let errorCheckboxCells = [];
    let requiredErrorEles = [];
    for (const colIdx in validationColNames) {
        const validationCol = validationColNames[colIdx];
        const validationFunc = validationCol in validator ? validator[validationCol] : null;

        if (!validationFunc) {
            continue;
        }
        const columnData = verticalData[colIdx];
        let invalidRowIds = validationFunc(columnData, dataTypes);
        const invalidCells = invalidRowIds.map(rowIdx => `${convertIdxToExcelCol(colIdx)}${parseInt(rowIdx) + 1}`);
        errorTextCells = errorTextCells.concat(invalidCells);
        if (!requiredCols.length || !requiredCols.includes(validationCol)) {
            continue;
        }
        requiredErrorEles = requiredErrorEles.concat(invalidCells);
    }

    resetColor();

    if (errorTextCells.length || errorCheckboxCells.length) {
        const jexcelDivId = $(procModalElements.prcSM).attr('id');
        colorErrorCells(jexcelDivId, errorTextCells, requiredErrorEles);
        colorErrorCheckboxCells(jexcelDivId, errorCheckboxCells);
        return [false, errorTextCells];
    }
    return [true, []];
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

    return result['data'] || [];
}

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

const getExcelModeData = () => {
    const jexcelDivId = $(procModalElements.prcSM).attr('id');
    const data = document.getElementById(jexcelDivId).jspreadsheet.getData();
    return data;
};

const transpose = matrix => matrix.reduce(
    ($, row) => row.map((_, i) => [...($[i] || []), row[i]]),
    []
)

const normalizeBoolean = (values = []) => {
    return values.map(val => {
        if (typeof(val) === 'boolean'){
            return val;
        } else {
            const normalizedVal = `${val}`.trim().toLowerCase();
            return !FALSE_VALUES.has(normalizedVal);
        }
    });
}

const cleanBooleanVerticalData = (editModeDataVertical, validationColNames, dataTypes) => {
    const dateTimeIdx = validationColNames.indexOf('dateTime');
    const serialIdx = validationColNames.indexOf('serial');
    const autoIncrementIdx = validationColNames.indexOf('auto_increment');

    let asDatetimeVals = normalizeBoolean(editModeDataVertical[dateTimeIdx] || []);
    asDatetimeVals = asDatetimeVals.map((val, idx) => dataTypes[idx] === DataTypes.DATETIME.name? val: false)
    editModeDataVertical[dateTimeIdx] = asDatetimeVals;

    editModeDataVertical[serialIdx] = normalizeBoolean(editModeDataVertical[serialIdx] || []);

    let autoIncrementVals = normalizeBoolean(editModeDataVertical[autoIncrementIdx] || []);
    autoIncrementVals = autoIncrementVals.map((val, idx) => dataTypes[idx] === DataTypes.DATETIME.name? val: false)
    editModeDataVertical[autoIncrementIdx] = autoIncrementVals;

    return editModeDataVertical;
}

const switchMode = (spreadTableDOM, force = false) => {
    const selectJson = getSelectedColumnsAsJson();
    [procCfgData, _] = collectProcCfgData(selectJson);
    let columns = procCfgData.columns;

    const isEditMode = isEmpty($(procModalElements.okBtn).attr('disabled'));
    if (isEditMode) { // go to excel mode

        // hide column setting table
        generateSpreadSheet();
    } else { // convert -> back to setting mode
        let editModeData = getExcelModeData();
        if (force && errCells.length) {
            editModeData = handleErrorCellValue(errCells, editModeData, columns, true);
        }
        let editModeDataVertical = transpose(editModeData);
        const validationColNames = [
            'columnName', 'dataType', 'englishName', 'japaneseName', 'localName', 'operator', 'coef'
        ];
        const requiredCols = ['dataType', 'englishName'];
        const colName2Type = buildDictColWithKey(columns, 'data_type');
        const columnNameIdx = validationColNames.indexOf('columnName');
        const columnNames = editModeDataVertical[columnNameIdx];
        const dataTypes = columnNames.map(col => colName2Type[col] || DataTypes.STRING.name);  // set TEXT as default

        if (force) {
            sendSpreadSheetDataToSetting(editModeDataVertical, validationColNames, dataTypes).then(() => {});
        } else {
            const [isValid, errCellNames] = checkExcelDataValid(editModeDataVertical, validationColNames, dataTypes, requiredCols);
            if (isValid) {
                sendSpreadSheetDataToSetting(editModeDataVertical, validationColNames, dataTypes).then(() => {});
            } else {
                // assign error cells name to revert value
                errCells = errCellNames;
                $(procModalElements.procConfigConfirmSwitchModal).modal('show');
                return;
            }
        }
    }

    showHideModes(isEditMode);
    // reset data
    errCells = [];
};

const updateSettingTable = (updateContent, colNames) => {
    const processSettingTable = procModalElements.processColumnsTableBody;
    const editableColumns = ['dataType', 'systemName', 'japaneseName', 'localName', 'operator', 'coef'];
    colNames = colNames.map(name => name === 'englishName' ? 'systemName' : name);
    editableColumns.forEach(colName => {
        const colIdx = colNames.indexOf(colName);
        processSettingTable.find(`[name=${colName}]`).each((i, eles) => {
            const value = updateContent[i][colIdx];
            if (colName === 'operator') {
                processSettingTable.find(`[name=operator]`).each(ele => {
                    $(ele).find(`option:contains(${value})`).prop('selected', 'selected');
                })
                return;
            }
            $(eles).text(value);
            if (colName !== 'dataType') {
                $(eles).val(value);
            } else {
                const dataSelection = $(eles).closest('.config-data-type-dropdown')
                dataSelection.find('li.dataTypeSelection').removeClass('active');
                if (value) {
                    dataSelection.find('li.dataTypeSelection')
                        .filter(function() {
                            return $(this).text() === value;
                        })
                        .addClass('active');
                }
            }
        });
    });
};
const sendSpreadSheetDataToSetting = async (editModeDataVertical, validationColNames, dataTypes) => {

    // normalize boolean values
    editModeDataVertical = cleanBooleanVerticalData(editModeDataVertical, validationColNames, dataTypes);

    // convert english name to romaji
    const englishNameIdx = validationColNames.indexOf('englishName') || 4;
    const englishNames = editModeDataVertical[englishNameIdx];
    editModeDataVertical[englishNameIdx] = await convertEnglishRomaji(englishNames);

    // remove sample data from excel mode
    editModeDataVertical = editModeDataVertical.slice(0, -10);
    // transpose back to horizontal row
    const convertedEditModeData = transpose(editModeDataVertical);

    // update content of table
    updateSettingTable(convertedEditModeData, validationColNames);
    validateSelectedColumnInput();

    // hide scroll bar
    $('.scroll-content').css('display', 'flex');
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
    $(procModalElements.checkColsContextMenu).css({ display: 'none' });
};

const bindSelectColumnsHandler = () => {
    $('table[name=latestDataTable] thead th').each((i, th) => {
        th.addEventListener('contextmenu', selectAllColsHandler, false);
        th.addEventListener('mouseover', hideCheckColMenu, false);
    });
};

// handle edit-mode data if there are error cells
const handleErrorCellValue = (errCellIDs, editModeData, columnsData, toBlank=false) => {
    const alphabetTblName = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // define column keys to get origin value
    const validateColsName = [
        'column_name',
        'is_get_date',
        'is_serial',
        'is_auto_increment',
        'name_en',
        'name_jp',
        'name_local',
        'operator',
        'coef'
    ];
    errCellIDs.forEach(cellID => {
        // cellID = F4
        let cellValue = '';
        const colIdx = alphabetTblName.indexOf(cellID[0]); // F
        const rowIdx = Number(cellID.substring(1)) - 1; // 3
        if (!toBlank) {
            const colName = validateColsName[colIdx]; // name_jp
            const modifiedRow = editModeData[rowIdx];
            const columnData = columnsData.filter(col => col.column_name === modifiedRow[0]);
            if (columnData.length) {
                // origin value
                cellValue = columnData[0][colName];
            }
        }
        editModeData[rowIdx][colIdx] = cellValue;
    })
    return editModeData;
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
        // check if e.currentTarget.hasAttributes('data-has-ct')
        const withShowPreview = e.currentTarget.hasAttribute('data-has-ct');
        const hasCTCols = $(e.currentTarget).attr('data-has-ct') === 'true';
        if (withShowPreview && !hasCTCols) {
            return;
        }
        runRegisterProcConfigFlow(edit = false);
    });

    // confirm Import Data
    procModalElements.confirmImportDataBtn.click(() => {
        $(procModalElements.confirmImportDataModal).modal('hide');

        const selectJson = getSelectedColumnsAsJson();
        saveProcCfg(selectJson, true);

        // save order to local storage
        setTimeout(() => {
            dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        }, 2000);

        recentEdit(procModalCurrentProcId);

        // show toastr
        showToastr();
        showJobAsToastr();
    });

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
        hideAlertMessages();
        isClickPreview = true;
        const dsSelected = getSelectedOptionOfSelect(procModalElements.databases).val();
        loadTables(dsSelected);
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

        preventSelectAll(true);

        // reset select all checkbox when click showRecordsBtn
        $(procModalElements.selectAllColumn).css('display', 'block');
        $(procModalElements.autoSelectAllColumn).css('display', 'block');

        // reset first datetime checked
        setDatetimeSelected = false;
        showLatestRecords(formData, clearDataFlg);
    });

    procModalElements.proc.on('focusout', () => {checkDuplicateProcessName('data-name-en')});
    procModalElements.procJapaneseName.on('focusout', () => {checkDuplicateProcessName('data-name-jp')});
    procModalElements.procLocalName.on('focusout', () => {checkDuplicateProcessName('data-name-local')});

    $(procModalElements.revertChangeAsLinkIdBtn).click(() => {
        currentAsLinkIdBox.prop('checked', !currentAsLinkIdBox.prop('checked'));
    });

    // change mode in proc config table
    $(procModalElements.changeModeBtn).off('click').click((e) => {
        const spreadTableDOM = $(e.currentTarget).attr('data-sm');

        if (!currentProcColumns) {
            // show latest records
            procModalElements.showRecordsBtn.click();
        }
        switchMode(spreadTableDOM);
    });

    $(procModalElements.confirmSwitchButton).off('click').click((e) => {
        const spreadTableDOM = $(e.currentTarget).attr('data-sm');
        switchMode(spreadTableDOM, true);
    });

    initSearchProcessColumnsTable();
});

const datatypeDefaultObject = {
    value: '',
    is_get_date: false,
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
};

const datatypeI18nText = {
    is_get_date: $(procModali18n.i18nMainDatetime).text(),
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
    is_int_cat: DataTypes.INTEGER_CAT.selectionBoxDisplay,
};

const DataTypeAttrs = ['is_get_date', 'is_serial_no', 'is_main_serial_no', 'is_auto_increment', 'is_line_name', 'is_line_no', 'is_eq_name', 'is_eq_no', 'is_part_name', 'is_part_no', 'is_st_no', 'is_int_cat'];
const allowSelectOneAttrs = ['is_get_date', 'is_main_serial_no', 'is_line_name', 'is_line_no', 'is_eq_name', 'is_eq_no', 'is_part_name', 'is_part_no', 'is_st_no', 'is_auto_increment'];
const unableToReselectAttrs = ['is_get_date', 'is_auto_increment'];
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
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).on('click',  (e) => {
            DataTypeSelection.onClickDataType(idx, e);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).off('focus');
        $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection:not([disabled="disabled"])`).on('focus',  (e) => {
            DataTypeSelection.onFocusDataType(idx, e);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.copyToAllBelow:not([disabled="disabled"])`).off('click');
        $(`.config-data-type-dropdown_${idx} ul li.copyToAllBelow:not([disabled="disabled"])`).on('click',  (e) => {
            DataTypeSelection.handleCopyToAllBelow(idx);
            DataTypeSelection.hideDropdownMenu();
        })

        $(`.config-data-type-dropdown_${idx} ul li.copyToFiltered:not([disabled="disabled"])`).off('click');
        $(`.config-data-type-dropdown_${idx} ul li.copyToFiltered:not([disabled="disabled"])`).on('click',  (e) => {
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
            $(`.config-data-type-dropdown_${idx} ul li.dataTypeSelection[data-type!=${dataType}]`).attr('disabled', true);
        }
    },
    hideDropdownMenu: () => {
        $('.data-type-selection').hide();
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
        } else if(englishDataTypes.includes(defaultValue.value)) {
            text = DataTypes[defaultValue.value].selectionBoxDisplay
        }
        else {
            text = $('#' + DataTypes[defaultValue.value].i18nLabelID).text();
        }
        const attrKey = getKey ? `${getKey}="true" column_type=${dataGroupType[mappingDataGroupType[getKey]]} data-attr-key=${getKey}` : '';
        return `
            <div class="config-data-type-dropdown config-data-type-dropdown_${idx}">
                    <button class="btn btn-default dropdown-toggle" type="button">
                        <span class="csv-datatype-selection row-item for-search" ${attrKey} is-registered-col="${defaultValue.isRegisteredCol}" is-big-int="${defaultValue.is_big_int}" data-attr-key="${getKey}" name="${procModalElements.dataType}" id="dataTypeShowValue_${idx}" value="${defaultValue.value}" ${defaultValue.checked}>${text}</span>
                    </button>
                    <div class="data-type-selection">
                        <div class="data-type-selection-content data-type-selection-left">
                            <div class="data-type-selection-box">
                                <span class="data-type-selection-title">${$(procModali18n.i18nSpecial).text()}</span>
                                <ul>
                                    <li class="dataTypeSelection" ${defaultValue.isRegisterProc ? 'disabled=disabled' : ''} is_get_date value="${DataTypes.DATETIME.name}" data-type="${DataTypes.DATETIME.name}">${$(procModali18n.i18nMainDatetime).text()}</li>
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
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.REAL_SEP.name}" data-type="${DataTypes.REAL.name}">${$('#' +DataTypes.REAL_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.INTEGER_SEP.name}" data-type="${DataTypes.INTEGER.name}">${$('#' +DataTypes.INTEGER_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.EU_REAL_SEP.name}" data-type="${DataTypes.REAL.name}">${$('#' +DataTypes.EU_REAL_SEP.i18nLabelID).text()}</li>
                                    <li class="dataTypeSelection" only-datatype value="${DataTypes.EU_INTEGER_SEP.name}" data-type="${DataTypes.INTEGER.name}">${$('#' +DataTypes.EU_INTEGER_SEP.i18nLabelID).text()}</li>
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
        const attrKey = DataTypeSelection.getAttrOfDataTypeItem(e);
        const value = e.currentTarget.getAttribute('value');

        DataTypeSelection.changeDataType(value, e.currentTarget.textContent, attrKey, idx, e.currentTarget);

    },
    changeDataType: (value, text, attrKey, idx, el = null) => {
        DataTypeSelection.setValueToShowValueElement(value, text, attrKey, idx);

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

        if (highPriorityItems.includes(attrKey)) {
            setTimeout(() => {
                sortProcessColumns();
            }, 500);
        }
    },
    onFocusDataType: (idx, e) => {
        storePreviousValue(e.currentTarget)
    },
    getShowValueElement: (idx) => {
        return document.getElementById(`${DataTypeSelection.dataTypeEls.selectValueId}_${idx}`);
    },
    getOptionByAttrKey: (value, attrKey, idx) => {
        return $(`.config-data-type-dropdown_${idx} ul li[value=${value}]${attrKey ? `[${attrKey}]` : '[only-datatype]'}`)
    },
    resetOtherMainAttrKey: (attrKey, idx) => {
        const sameDataTypeEl = procModalElements.processColumnsTableBody.find(`tr:not(:eq(${idx}))`).find(`[name=dataType][${attrKey}]`);
        if (!sameDataTypeEl.length) return;
        [...sameDataTypeEl].forEach(el => {
            const index = $(el).closest('tr').index();
            const dataType = $(el).attr('value');
            DataTypeSelection.init(index);
            $(el).parents('.config-data-type-dropdown').find(`li[value=${dataType}][only-datatype]`).trigger('click');
        });
    },
    setValueToShowValueElement: (value, text, attrKey, idx) => {
        const showValueEl = DataTypeSelection.getShowValueElement(idx);

        showValueEl.textContent = text;
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
            DataTypeSelection.changeDataType(value, optionEl.text(), attrKey, rowIdx, DataTypeSelection.getOptionByAttrKey(value, attrKey, rowIdx)[0]);
        });
    },
    handleCopyToFiltered: (idx) => {
        const [value, attrKey, showValueEl] = DataTypeSelection.getDataOfSelectedOption(idx);
        const optionEl = DataTypeSelection.getOptionByAttrKey(value, attrKey, idx);
        const targetOptionEls = [...procModalElements.processColumnsTableBody.find('tr:not(.gray):visible')];
        targetOptionEls.forEach(el => {
            const rowIdx = el.rowIndex - 1;
            DataTypeSelection.changeDataType(value, optionEl.text(), attrKey, rowIdx, DataTypeSelection.getOptionByAttrKey(value, attrKey, rowIdx)[0]);
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
}

const sortProcessColumns = (force=false) => {
    const selectJson = getSelectedColumnsAsJson();
    const [procCfgData, _] = collectProcCfgData(selectJson, true);
    const columns = procCfgData.columns;

    generateProcessList(columns, prcPreviewData.rows, prcPreviewData.dummy_datetime_idx, true, force);
};

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

