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
    processGeneralInfo: $('#procSettingModal div[name=processGeneralInfo]'),
    latestDataHeader: $('#procSettingModal table[name=latestDataTable] thead'),
    latestDataBody: $('#procSettingModal table[name=latestDataTable] tbody'),
    seletedColumnsBody: $(
        '#procSettingModal table[name=selectedColumnsTable] tbody',
    ),
    seletedColumns: $(
        '#procSettingModal table[name=selectedColumnsTable] tbody tr[name=selectedColumn]',
    ),
    okBtn: $('#procSettingModal button[name=okBtn]'),
    reRegisterBtn: $('#procSettingModal button[name=reRegisterBtn]'),
    confirmImportDataBtn: $('#confirmImportDataBtn'),
    confirmReRegisterProcBtn: $('#confirmReRegisterProcBtn'),
    revertChangeAsLinkIdBtn: $('#revertChangeAsLinkIdBtn'),
    confirmImportDataModal: $('#confirmImportDataModal'),
    confirmReRegisterProcModal: $('#confirmReRegisterProcModal'),
    warningResetDataLinkModal: $('#warningResetDataLinkModal'),
    procConfigConfirmSwitchModal: $('#procConfigConfirmSwitchModal'),
    confirmDataTypeModal: '#confirmChangeKSepDataTypeModal',
    confirmNullValue: '#confirmNullValueInColumnModal',
    confirmSameValue: '#confirmSameValueInColumnModal',
    dateTime: 'dateTime',
    serial: 'serial',
    order: 'order',
    auto_increment: 'auto_increment',
    columnName: 'columnName',
    englishName: 'englishName',
    shownName: 'shownName',
    japaneseName: 'japaneseName',
    localName: 'localName',
    operator: 'operator',
    coef: 'coef',
    procsMasterName: 'processName',
    procsComment: 'comment',
    procsdbName: 'databaseName',
    procsTableName: 'tableName',
    isDummyDatetime: 'isDummyDatetime',
    coefInput: $(
        '#procSettingModal table[name=selectedColumnsTable] input[name="coef"]',
    ),
    columnNameInput:
        '#procSettingModal table[name=selectedColumnsTable] input[name="columnName"]',
    englishNameInput:
        '#procSettingModal table[name=selectedColumnsTable] input[name="englishName"]',
    masterNameInput:
        '#procSettingModal table[name=selectedColumnsTable] input[name="shownName"]',
    latestDataTable: $('#procSettingModal table[name=latestDataTable]'),
    msgProcNameAlreadyExist: '#i18nAlreadyExist',
    msgProcNameBlank: '#i18nProcNameBlank',
    msgModal: '#msgModal',
    msgContent: '#msgContent',
    msgConfirmBtn: '#msgConfirmBtn',
    selectAllSensor: '#selectAllSensor',
    alertMessage: '#alertMsgSelectedColumnsTable',
    alertProcessNameErrorMsg: '#alertProcessNameErrorMsg',
    alertErrMsgContent: '#alertProcessNameErrorMsg-content',
    selectAllColumn: '#selectAllColumn',
    procID: $('#procSettingModal input[name=processID]'),
    dsID: $('#procSettingModal input[name=processDsID]'),
    formId: '#procCfgForm',
    changeModeBtn: '#prcEditMode',
    confirmSwitchButton: '#confirmSwitch',
    settingContent: '#procSettingContent',
    selectedColumnsTable: 'selectedColumnsTable',
    prcSM: '#prcSM',
    autoSelectAllColumn: '#autoSelectAllColumn',
    autoSelect: '#autoSelect',
    checkColsContextMenu: '#checkColsContextMenu',
    createOrUpdateProcCfgBtn: $('#createOrUpdateProcCfgBtn'),
};

const procModali18n = {
    emptyShownName: '#i18nEmptyShownName',
    useEnglishName: '#i18nUseEnglishName',
    noMasterName: '#validateNoMasterName',
    duplicatedEnglishName: '#validateDuplicatedEnglish',
    noEnglishName: '#validateNoEnglishName',
    duplicatedMasterName: '#validateDuplicatedMaster',
    noZeroCoef: '#validateCoefErrMsgNoZero',
    emptyCoef: '#validateCoefErrMsgEmptyCoef',
    needOperator: '#validateCoefErrMsgNeedOperator',
    settingMode: '#filterSettingMode',
    editMode: '#filterEditMode',
    copyToAllColumn: '#i18nCopyToAllRightColumn',
    noDatetimeCol: $('#i18nNoDatetimeCol').text(),
};

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

    const dsNameSelection = $('#procSettingModal select[name=databaseName] option:selected').text();
    const tableNameSelection = $('#procSettingModal select[name=tableName] option:selected').text();

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
        const isJPLocal = docCookies.isJaLocale();
        if (isJPLocal) {
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
       // $(`table[name=${procModalElements.selectedColumnsTable}] tbody`).empty();
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
        }

        if (!selectedTbl) {
            procModalElements.tables.val('');
        }

    });
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

const validateGetDateCol = () => {
    const [columnNames, columnTypes, orders] = getCsvColumns();
    // Check if there is no get_date
    const nbGetDateCol = columnTypes.filter(col => col === DATETIME).length;

    if (nbGetDateCol === 0) {
        console.log('error');
        const msgErrorNoGetdate = $(csvResourceElements.msgErrorNoGetdate).text();
        displayRegisterMessage(
            csvResourceElements.alertMsgCheckFolder,
            { message: msgErrorNoGetdate, is_error: true },
        );
        return false;
    }

    let isWarning = false;
    let msgWarnManyGetdate = '';
    if (nbGetDateCol > 1) {
        msgWarnManyGetdate = $(csvResourceElements.msgWarnManyGetdate).text();
        const firstGetdateIdx = columnTypes.indexOf(DATETIME);
        const firstGetdate = columnNames[firstGetdateIdx] || '';
        msgWarnManyGetdate = `${msgWarnManyGetdate.replace('{col}', firstGetdate)}\n`;
        isWarning = true;
    }
};

const getColDataType = (colName) => {
    const colInSettingTbl = $('#selectedColumnsTable').find(`input[name="columnName"][value="${colName}"]`);
    const datType = colInSettingTbl ? $(colInSettingTbl[0]).attr('data-type') : '';
    return datType;
};

// --- B-Sprint36+80 #5 ---
const storePreviousValue = (element) => {
    element.previousValue = element.value;
};
// --- B-Sprint36+80 #5 ---

// generate 5 records and their header
const genColumnWithCheckbox = (cols, rows, dummyDatetimeIdx) => {
    const header = [];
    const datas = [];
    const dataTypeSelections = [];
    const colTypes = [];

    const intlabel = $(`#${DataTypes.INTEGER.i18nLabelID}`).text();
    const strlabel = $(`#${DataTypes.STRING.i18nLabelID}`).text();
    const dtlabel = $(`#${DataTypes.DATETIME.i18nLabelID}`).text();
    const reallabel = $(`#${DataTypes.REAL.i18nLabelID}`).text();
    const realSepLabel = $(`#${DataTypes.REAL_SEP.i18nLabelID}`).text();
    const intSepLabel = $(`#${DataTypes.INTEGER_SEP.i18nLabelID}`).text();
    const euRealSepLabel = $(`#${DataTypes.EU_REAL_SEP.i18nLabelID}`).text();
    const euIntSepLabel = $(`#${DataTypes.EU_INTEGER_SEP.i18nLabelID}`).text();
    const copyToAllColumnLabel = $(procModali18n.copyToAllColumn).text();

    const getColType = (col) => {
        const orgColType = getColDataType(col.name);
        const colType = orgColType ? orgColType : col.type;
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
        const isDummyDatetimeCol = dummyDatetimeIdx === i;
        rows.forEach((row) => {
            if (!isEmpty(row[col.name])) {
                isNull = false;
            }
        });
        header.push(`
        <th class="${isDummyDatetimeCol ? 'dummyDatetimeCol' : ''}">
            <div class="custom-control custom-checkbox">
                <input type="checkbox" onChange="selectTargetCol(this)"
                    class="check-item custom-control-input col-checkbox" value="${col.name}"
                    id="checkbox-${col.romaji}" data-type="${col.type}" data-romaji="${col.romaji}"
                    data-isnull="${isNull}" data-col-index="${i}" data-is-dummy-datetime="${isDummyDatetimeCol}" data-name-jp="${col.name_jp || ''}" data-name-local="${col.name_local || ''}">
                <label class="custom-control-label" for="checkbox-${col.romaji}">${col.name}</label>
            </div>
        </th>`);

        const checkedColType = (type) => {
            if (type === getColType(col)) {
                return ' selected="selected"';
            }
            return '';
        };

        const colType = getColType(col);
        colTypes.push(DataTypes[colType].value);

        dataTypeSelections.push(`<td class="${isDummyDatetimeCol ? 'dummyDatetimeCol' : ''}">
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
            <input id="dataTypeTemp-${i}" value="${DataTypes[colType].value}" hidden disabled>
        </td>`);
        // const selectedVal = $(`#col-${i}`).value();
        // changeBackgroundColor(selectedVal);
    });

    procModalElements.latestDataHeader.empty();
    procModalElements.latestDataHeader.append(`
        <tr>${header.join('')}</tr>
        <tr>${dataTypeSelections.join('')}</tr>`);

    rows.forEach((row) => {
        const data = [];
        cols.forEach((col, i) => {
            let val;
            const columnColor = dummyDatetimeIdx === i ? ' dummy_datetime_col' : '';
            if (col.is_date) {
                val = moment(row[col.name]).format(DATE_FORMAT_TZ);
                if (val === 'Invalid date') {
                    val = '';
                }
            } else {
                val = row[col.name];
                if (col.type === DataTypes.INTEGER.name) {
                    val = parseIntData(val);
                } else if (col.type === DataTypes.REAL.name) {
                    val = parseFloatData(val);
                }
            }
            const isKSep = [DataTypes.REAL_SEP.name, DataTypes.EU_REAL_SEP.name].includes(getColType(col));
            data.push(`<td style="color: ${isKSep ? 'orange' : ''}" is-big-int="${col.is_big_int ? 1 : 0}" data-original="${row[col.name]}" class="${columnColor}"> ${val} </td>`);
        });
        datas.push(`<tr>${data.join('')}</tr>`);
    });
    // const dataTypeSel = `<tr>${dataTypeSelections.join('')}</tr>`;
    procModalElements.latestDataBody.empty();
    if (datas.length) {
        // procModalElements.latestDataBody.append(dataTypeSel);
        procModalElements.latestDataBody.append(`${datas.join('')}`);
    }

    if (isRemoveDummyDatetime) {
         procModalElements.latestDataTable.find('.dummyDatetimeCol').remove();
         procModalElements.latestDataTable.find('.dummy_datetime_col').remove();
    }

    parseEUDataTypeInFirstTimeLoad();

    showConfirmKSepDataModal(colTypes);

    showConfirmSameAndNullValueInColumn(cols);
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
            $(el).trigger('change');
        }
    });
};

const showConfirmKSepDataModal = (types) => {
    if (types.includes(DataTypes.REAL_SEP.value) || types.includes(DataTypes.EU_REAL_SEP.value)) {
        $(procModalElements.confirmDataTypeModal).modal('show');

        // scroll to first this
        const indexOfColumn = types.indexOf(DataTypes.REAL_SEP.value) !== -1 ? types.indexOf(DataTypes.REAL_SEP.value)
            : types.indexOf(DataTypes.EU_REAL_SEP.value);

        const offsetLeft = procModalElements.latestDataHeader.find(`tr th:eq(${indexOfColumn})`).offset().left;
        procModalElements.latestDataTable.parents().animate({ scrollLeft: offsetLeft });
    }
};

// only one checkbox will be selected
const validateAutoIncrementCheckBoxes = () => {
    $(
        `table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.auto_increment}"]`,
    ).each(function _() {
        $(this).on('change', function f() {
            if ($(this).is(':checked')) {
                $(
                    `table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.auto_increment}"]`,
                )
                    .not(this)
                    .prop('checked', false);
                // uncheck serial at the same row
            }
        });
    });
};


const validateFixedColumns = () => {
    if (isAddNewMode()) {
        return;
    }
    $(`table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.dateTime}"]`).each(function disable() {
        $(this).attr('disabled', true);
        if ($(this).is(':checked')) { // disable serial as the same row
            $(this).closest('tr').find(`input:checkbox[name="${procModalElements.serial}"]`).attr('disabled', true);
        }
    });
    $(`table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.auto_increment}"]`).each(function disable() {
        $(this).attr('disabled', true);
    });
};

// validation checkboxes of selected columns
const validateCheckBoxesAll = () => {
    $(
        `table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.dateTime}"]`,
    ).each(function validateDateTime() {
        $(this).on('change', function f() {
            if ($(this).is(':checked')) {
                $(
                    `table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.dateTime}"]`,
                )
                    .not(this)
                    .prop('checked', false).trigger('change');
                // uncheck serial at the same row
                $(this)
                    .closest('tr')
                    .find(`input:checkbox[name="${procModalElements.serial}"]`)
                    .prop('checked', false);
            } else {
                if ($(this).attr('is-dummy-datetime') === 'true') {
                    // remove dummydatetime column from table
                    procModalElements.latestDataTable.find('input[data-is-dummy-datetime=true]').prop('checked', false).change();
                    procModalElements.latestDataTable.find('.dummyDatetimeCol').remove();
                    procModalElements.latestDataTable.find('.dummy_datetime_col').remove();
                }
            }
        });
    });

    $(
        `table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.serial}"]`,
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
    $(`#selectedColumnsTable tr input[name="${procModalElements.coef}"]:not('.text')`).each(function validate() {
        validateNumericInput($(this));
    });
};


const validateSelectedColumnInput = () => {
    validateCheckBoxesAll();
    validateAutoIncrementCheckBoxes();
    handleEnglishNameChange();
    addAttributeToElement();
    validateAllCoefs();
    validateFixedColumns();
    updateTableRowNumber(null, $('table[name=selectedColumnsTable]'));
};


const createOptCoefHTML = (operator, coef, isNumeric) => {
    const operators = ['+', '-', '*', '/'];
    let numericOperators = '';
    operators.forEach((opr) => {
        const selected = (operator === opr) ? ' selected="selected"' : '';
        numericOperators += `<option value="${opr}" ${selected}>${opr}</option>`;
    });
    const selected = (operator === 'regex') ? ' selected="selected"' : '';
    const textOperators = `<option value="regex" ${selected}>${i18n.validLike}</option>`;
    let coefHTML = `<input name="coef" class="form-control" type="text" value="${coef || ''}">`;
    if (!isNumeric) {
        coefHTML = `<input name="coef" class="form-control text" type="text" value="${coef || ''}">`;
    }
    return [numericOperators, textOperators, coefHTML];
};

// tick checkbox event
// eslint-disable-next-line no-unused-vars
const selectTargetCol = (col, doValidate = true) => {
    if (col.checked) {
        // add new record
        const isJPLocale = docCookies.isJaLocale();
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
        if (isDatetime) {
            setDatetimeSelected = true;
        }
        procModalElements.seletedColumnsBody.append(genColConfigHTML(colConfig));
        if (doValidate) {
            validateSelectedColumnInput();
        }
    } else {
        // remove record
        $(`#selectedColumnsTable tr[uid="${col.value}"]`).remove();
        const remainDatetimeCols = $('tr[name=selectedColumn]').find('input[data-type=DATETIME]').length;
        // reset datetime col selection
        setDatetimeSelected = remainDatetimeCols > 0;
        updateTableRowNumber(null, $('table[name=selectedColumnsTable]'));
    }

    // update selectAll input
    if (doValidate) {
        updateSelectAllCheckbox();
    }
};

const autoSelectColumnEvent = (selectAllElement) => {
    const isAllChecked = selectAllElement.checked;

    // check selectAll input
    if (isAllChecked) {
        changeSelectionCheckbox();
    }

    $('.col-checkbox').each(function f() {
        const isColChecked = $(this).prop('checked');
        const isDisabledInput = $(this).attr('disabled') !== undefined;
        const isNull = $(this).data('isnull');
        if (!isNull && (!isColChecked || !isAllChecked) && !isDisabledInput) { // select null cols only and select only once
            $(this).prop('checked', isAllChecked);
            selectTargetCol($(this)[0], doValidate = false);
        } else if (isNull && isColChecked && !isDisabledInput) { // if null col is selected -> unselected
            $(this).prop('checked', false);
            selectTargetCol($(this)[0], doValidate = false);
        }
    });

    // validate after selecting all to save time
    validateSelectedColumnInput();
};
const selectAllColumnEvent = (selectAllElement) => {
    const isAllChecked = selectAllElement.checked;

    if (isAllChecked) {
        changeSelectionCheckbox(autoSelect = false, selectAll = true);
    }
    $('.col-checkbox').each(function f() {
        const isDisabledInput = $(this).attr('disabled') !== undefined;
        const isColChecked = $(this).prop('checked');
        if (!isDisabledInput && (!isColChecked || !isAllChecked)) { // select null cols only and select only once
            $(this).prop('checked', isAllChecked);
            selectTargetCol($(this)[0], doValidate = false);
        }
    });

    // validate after selecting all to save time
    validateSelectedColumnInput();
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

// update latest records table by yaml data
const updateLatestDataCheckbox = () => {
    const getHtmlEleFunc = genJsonfromHTML(
        procModalElements.seletedColumnsBody,
        'selects',
        true,
    );
    const selectJson = getHtmlEleFunc(procModalElements.columnName, ele => ele.value);
    const SELECT_ROOT = Object.keys(selectJson)[0];
    const datetimeColSelected = $('tr[name=selectedColumn]').find('input[data-type=DATETIME]');
    const datetimeColName = datetimeColSelected.length ? datetimeColSelected[0].value : undefined;
    if (procModalElements.columnName in selectJson[SELECT_ROOT]
        && selectJson[SELECT_ROOT][procModalElements.columnName]) {
        // eslint-disable-next-line no-restricted-syntax
        for (const colname of selectJson[SELECT_ROOT][procModalElements.columnName]) {
            const isDisabledCol = colname === datetimeColName;
            const currentInput = $(`input[value="${colname}"][data-shown-name!='1']`);
            currentInput.prop('checked', true);
            if (isDisabledCol) {
                currentInput.prop('disabled', true);
                // currentInput.attr('data-is-disabled', true);
            }
        }
    }
};

const preventSelectAll = (preventFlag = false) => {
    // change render flag
    renderedCols = !preventFlag;
    $(procModalElements.selectAllSensor).prop('disabled', preventFlag);
    $(procModalElements.autoSelect).prop('disabled', preventFlag);
};

const updateCurrentDatasource = () => {
    const currentShownTableName = $('select[name=tableName] option[selected=selected]').val() || null;
    const currentShownDataSouce = procModalElements.databases.val() || null;
    // re-assign datasource id and table of process
    if (currentShownDataSouce) {
        currentProcData.ds_id = Number(currentShownDataSouce);
    }
    if (currentShownTableName) {
        currentProcData.table_name = currentShownTableName;
    }
};
const showLatestRecordsFromPrc = (json, clearSelectedColumnBody) => {
    const dummyDatetimeIdx = json.dummy_datetime_idx;
    genColumnWithCheckbox(json.cols, json.rows, dummyDatetimeIdx);
    preventSelectAll(renderedCols);
    if (clearSelectedColumnBody) {
        procModalElements.seletedColumnsBody.empty();
    } else {
        // update column checkboxes from selected columns
        updateLatestDataCheckbox();
    }
    
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
        $(`table[name=${procModalElements.selectedColumnsTable}] tbody`).empty();
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
    showLatestRecordsFromPrc(prcPreviewData, false);
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
            showToastrMsgFailLimit(json);
            const isEditPrc = currentProcItem.data('proc-id') !== undefined;
            // show gen dummy datetime col for new proces only
            if (!isEditPrc && !json.has_ct_col) {
                showDummyDatetimeModal(json, true);
                prcPreviewData = json;
            } else {
                showLatestRecordsFromPrc(json, clearSelectedColumnBody);
                updateBtnStyleWithValidation(procModalElements.createOrUpdateProcCfgBtn);
            }

            allProcessColumns = json ? json.cols.map(col => col.name) : [];
        },
        error: (e) => {
            loading.hide();
            console.log('error', e)
        },
    });
};


// refesh changed target proc on screen
const refreshProcs = (procId, masterName, dbName, tableName, comment) => {
    $(`#${procId} [name=${procModalElements.procsMasterName}]`).val(masterName);
    $(`#${procId} [name=${procModalElements.procsComment}]`).val(comment);
    $(`#${procId} [name=${procModalElements.procsdbName}]`).val(dbName);
    $(`#${procId} [name=${procModalElements.procsTableName}]`).val(tableName);
};

const clearWarning = () => {
    $(procModalElements.alertMessage).css('display', 'none');
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

const handleEnglishNameChange = () => {
    const englishCol = $(procModalElements.englishNameInput);
    englishCol.on('change', (event) => {
        const inputChanged = event.currentTarget.value;
        $.ajax({
            url: '/ap/api/setting/to_eng',
            type: 'POST',
            data: JSON.stringify({ colname: inputChanged }),
            dataType: 'json',
            contentType: 'application/json',
        }).done((res) => {
            event.currentTarget.value = res.data;
        });
    });
};

const englishAndMasterNameValidator = (englishNames = [], japaneseNames = [], localNames = []) => {
    if (isEmpty(englishNames)) return [];

    const nameErrors = new Set();
    const isEmptyEnglishName = []
        .concat(englishNames)
        .some(name => isEmpty(name));
    if (isEmptyEnglishName) {
        nameErrors.add($(procModali18n.noEnglishName).text() || '');
    }

    // const isEmptyShownName = [].concat(shownNames).some(name => isEmpty(name));
    // if (isEmptyShownName) {
    //     nameErrors.add($(procModali18n.noMasterName).text() || '');
    // }
    if (isArrayDuplicated(englishNames)) {
        nameErrors.add($(procModali18n.duplicatedEnglishName).text() || '');
    }

    if (isArrayDuplicated(japaneseNames.filter(name => !isEmpty(name)))) {
        nameErrors.add($(procModali18n.duplicatedMasterName).text() || '');
    }

     if (isArrayDuplicated(localNames.filter(name => !isEmpty(name)))) {
        nameErrors.add($(procModali18n.duplicatedMasterName).text() || '');
    }

    nameErrors.delete('');
    return Array.from(nameErrors) || [];
};


const checkDuplicateMasterName = () => {
    // get current list of (process-mastername)
    const existingProcIdMasterNames = {};
    $('#tblProcConfig tr').each(function f() {
        const procId = $(this).data('proc-id');
        const rowId = $(this).attr('id');
        if (rowId) {
            const masterName = $(`#${rowId} input[name=processName]`).attr('data-name-en') || '';
            existingProcIdMasterNames[`${procId}`] = masterName;
        }
    });

    // check for duplication
    const beingEditedProcName = procModalElements.proc.val();
    const existingMasterNames = Object.values(existingProcIdMasterNames);
    const isEditingSameProc = existingProcIdMasterNames[currentProcItem.data('proc-id')] === beingEditedProcName;
    if (
        beingEditedProcName
        && existingMasterNames.includes(beingEditedProcName)
        && !isEditingSameProc
    ) {
        // show warning message
        const dupProcessNameMsg = $(procModalElements.msgProcNameAlreadyExist).text();
        displayRegisterMessage(procModalElements.alertProcessNameErrorMsg, {
            message: dupProcessNameMsg,
            is_error: true,
        });
        return true;
    } else {
        $(procModalElements.alertProcessNameErrorMsg).css('display', 'none');
    }
    return false;
};

const scrollTopProcModal = () => {
    $(procModalElements.procModal).animate({ scrollTop: 0 }, 'fast');
    $('#processName').focus();
}

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

    const notDuplicated = !checkDuplicateMasterName();

    return notBlank && notDuplicated;
};

const updateProcSettingUI = (procModalCurrentProcessId) => {
    // get process general info
    const procsMasterName = procModalElements.proc.val();
    const procsComment = procModalElements.comment.val();
    const procsdbName = procModalElements.databases
        .find('option:selected')
        .text();
    const procsTableName = procModalElements.tables.val();

    // set process general info to 工程設定
    $(
        `#${procModalCurrentProcessId} input[name=${procModalElements.procsMasterName}]`,
    ).val(procsMasterName);
    $(
        `#${procModalCurrentProcessId} input[name=${procModalElements.procsdbName}]`,
    ).val(procsdbName);
    $(
        `#${procModalCurrentProcessId} input[name=${procModalElements.procsTableName}]`,
    ).val(procsTableName);
    $(
        `#${procModalCurrentProcessId} textarea[name=${procModalElements.procsComment}]`,
    ).val(procsComment);
};

// import factory db to universal db
const importData = (procId) => {
    const data = {
        proc_id: procId,
    };

    fetch('api/setting/import_data', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
};

const autoFillShownNameToModal = () => {
    $('#selectedColumnsTable tbody tr').each(function f() {
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
        procModalElements.seletedColumnsBody,
        'selects',
        true,
    );
    getHtmlEleFunc(procModalElements.dateTime, ele => ele.checked);
    getHtmlEleFunc(procModalElements.serial, ele => ele.checked);
    getHtmlEleFunc(procModalElements.auto_increment, ele => ele.checked);
    getHtmlEleFunc(procModalElements.columnName, ele => ele.value);
    getHtmlEleFunc(
        procModalElements.columnName,
        ele => ele.getAttribute('data-type'),
        'dataType',
    );
    getHtmlEleFunc(procModalElements.englishName);
    getHtmlEleFunc(procModalElements.japaneseName);
    getHtmlEleFunc(procModalElements.localName);
    getHtmlEleFunc(procModalElements.operator);
    getHtmlEleFunc(procModalElements.isDummyDatetime);
    const selectJson = getHtmlEleFunc(procModalElements.coef);

    return selectJson;
};

const procColumnsData = (selectedJson) => {
    const columnsData = [];
    if (selectedJson.selects.columnName.length) {
        selectedJson.selects.columnName.forEach((v, k) => {
            const dataType = selectedJson.selects.dataType[k];
            const localName = selectedJson.selects.localName[k];
            const japaneseName = selectedJson.selects.japaneseName[k];
            columnsData.push({
                column_name: v,
                name_en: selectedJson.selects.englishName[k],
                data_type: dataType,
                operator: selectedJson.selects.operator[k],
                coef: selectedJson.selects.coef[k],
                column_type: null, // duplicate with data_type means?
                is_serial_no: selectedJson.selects.serial[k],
                is_get_date: selectedJson.selects.dateTime[k],
                is_auto_increment: selectedJson.selects.auto_increment[k],
                is_dummy_datetime: selectedJson.selects.isDummyDatetime[k] === 'true',
                order: CfgProcess_CONST.CATEGORY_TYPES.includes(dataType) ? 1 : 0,
                name_jp: japaneseName || null,
                name_local: localName || null,
            });
        });
    }
    return columnsData;
};

const collectProcCfgData = (columnDataRaws) => {
    const procID = procModalElements.procID.val() || null;
    const procEnName = procModalElements.proc.val();
    const procLocalName = procModalElements.procLocalName.val() || null;
    const procJapaneseName = procModalElements.procJapaneseName.val() || null;
    const dataSourceId = procModalElements.databases.find('option:selected').val() || '';
    const tableName = procModalElements.tables.find('option:selected').val() || '';
    const comment = procModalElements.comment.val();
    const procColumns = procColumnsData(columnDataRaws);

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
                addProcToTable(res.data.id, res.data.name, res.data.shown_name, res.data.data_source.id);
            } else {
                $(currentProcItem).find('input[name="processName"]').val(res.data.shown_name)
                .prop('disabled', true);
                 $(currentProcItem).find('input[name="processName"]').attr('data-name-en', res.data.name)
                $(currentProcItem).find('select[name="databaseName"]').val(res.data.data_source.id)
                    .prop('disabled', true);
                $(currentProcItem).find('select[name="tableName"]')
                    .append(`<option value="${res.data.table_name}" selected="selected">${res.data.table_name}</option>`)
                    .prop('disabled', true);
                $(currentProcItem).find('textarea[name="comment"]').val(res.data.comment)
                    .prop('disabled', true);
                $(currentProcItem).attr('id', `proc_${res.data.id}`);
                $(currentProcItem).attr('data-proc-id', res.data.id);
                $(currentProcItem).attr('data-ds-id', res.data.data_source_id);
            }
        }
    });

    // TODO: request to run import data job
    // importData(procModalCurrentProcId);

    $(`#tblProcConfig #${procModalCurrentProcId}`).data('type', '');
};

const runRegisterProcConfigFlow = (edit = false) => {
    clearWarning();

    // validate proc name null
    const validateFlg = validateProcName();
    if (!validateFlg) {
        scrollTopProcModal();
        return;
    }

    // const validDateTimeCol = validateGetDateCol();
    // if (!validDateTimeCol) {
    //     return;
    // }

    // check if date is checked
    const getDateMsgs = [];
    if ($(`table[name=selectedColumnsTable] input:checkbox[name="${procModalElements.dateTime}"]:checked`)
        .length === 0) {
        getDateMsgs.push($(csvResourceElements.msgErrorNoGetdate).text());
    }

    const selectJson = getSelectedColumnsAsJson();

    const SELECT_ROOT = Object.keys(selectJson)[0];
    const operators = selectJson[SELECT_ROOT][procModalElements.operator];
    const coefsRaw = selectJson[SELECT_ROOT][procModalElements.coef];
    const englishNames = selectJson[SELECT_ROOT][procModalElements.englishName];
    const shownNames = selectJson[SELECT_ROOT][procModalElements.shownName];
    const japaneseNames = selectJson[SELECT_ROOT][procModalElements.japaneseName];
    const localNames = selectJson[SELECT_ROOT][procModalElements.localName];
    let coefs = [];
    if (coefsRaw) {
        coefs = coefsRaw.map((coef) => {
            if (coef === '') {
                return '';
            }
            return Number(coef);
        });
    }
    let nameMsgs = englishAndMasterNameValidator(englishNames, japaneseNames, localNames);
    const coefMsgs = validateCoefOnSave(coefs, operators);


    let hasError = true;
    if (getDateMsgs.length > 0 || nameMsgs.length > 0 || coefMsgs.length > 0) {
        const messageStr = Array.from(getDateMsgs.concat(nameMsgs).concat(coefMsgs)).join('<br>');
        displayRegisterMessage(procModalElements.alertMessage, {
            message: messageStr,
            is_error: true,
        });
    } else {
        nameMsgs = englishAndMasterNameValidator([], shownNames); // check shown names only

        const missingShownName = procModali18n.noMasterName;
        if (nameMsgs.includes(missingShownName)) {
            const emptyShownameMsg = $(procModali18n.emptyShownName).text();
            const useEnglnameMsg = $(procModali18n.useEnglishName).text();
            // show modal to confirm auto filling shown names
            $(procModalElements.msgContent)
                .text(`${emptyShownameMsg}\n${useEnglnameMsg}`);
            $(procModalElements.msgModal).modal('show');
        } else if (nameMsgs.length > 0) {
            const messageStr = Array.from(nameMsgs.concat(coefMsgs)).join('<br>');
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
    if (!isAddNewMode()){
        $('table.jexcel td:nth-child(3)').css('color', 'gray');
        // $('table.jexcel td:nth-child(6)').css('color', 'gray');
    }
}

const generateSpreadSheet = () => {
    const getCols = () => {
        let headerLabels = [];
        let colWidths = [];
        $('#selectedColumnsTable').find('thead th').each((_, th) => {
            const headerName = $(th).text().trim();
            const colWidth = $(th).width();
            if (headerName) {
                headerLabels.push(headerName);
                colWidths.push(colWidth);
            }
        });
        const orgTableWidth = $('table#selectedColumnsTable').width();

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
    const tableHeadInfor = getCols();

    // get config data
    const settingModeData = getSettingModeRows();

    jspreadsheet(document.getElementById('prcSM'), {
        data: settingModeData,
        colHeaders: tableHeadInfor.headerLabels,
        colWidths: tableHeadInfor.colWidths,
        defaultColAlign: 'left',
        columns: [
            { type: 'text', readOnly: true },
            { type: 'checkbox', readOnly: !isAddNewMode() },
            { type: 'checkbox', readOnly: false },
            { type: 'checkbox', readOnly: !isAddNewMode() },
        ],
    });

    resetColor();
};

const zip = (arr, ...arrs) => arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));
const mapBoolean = v => (v ? true : '');

const getSettingModeRows = () => {
    const selectJson = getSelectedColumnsAsJson();
    const SELECT_ROOT = Object.keys(selectJson)[0]; // TODO use common function
    const dateTimes = selectJson[SELECT_ROOT][procModalElements.dateTime] || [''];
    const serials = selectJson[SELECT_ROOT][procModalElements.serial] || [''];
    const autoIncrements = selectJson[SELECT_ROOT][procModalElements.auto_increment] || [''];
    const columnNames = selectJson[SELECT_ROOT][procModalElements.columnName] || [''];
    const englishNames = selectJson[SELECT_ROOT][procModalElements.englishName] || [''];
    const japaneseNames = selectJson[SELECT_ROOT][procModalElements.japaneseName] || [''];
    const localNames = selectJson[SELECT_ROOT][procModalElements.localName] || [''];
    const operators = selectJson[SELECT_ROOT][procModalElements.operator] || [''];
    const coefsRaw = selectJson[SELECT_ROOT][procModalElements.coef] || [''];
    return zip(
        columnNames,
        dateTimes.map(mapBoolean),
        serials.map(mapBoolean),
        autoIncrements.map(mapBoolean),
        englishNames,
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

const buildDictColWithKey  = (procColumns, key='data_type') => {
    const dicCol2Type = {};
    for (let col of procColumns){
        const colName = col['column_name'];
        dicCol2Type[colName] = col[key] || '';
    }
    return dicCol2Type;
}

const checkExcelDataValid = (verticalData, validationColNames, dataTypes) => {
    const validateDatetime = (columnData, dataTypes=[]) => {  // TODO coloring for checkbox
        const normalizedColData = normalizeBoolean(columnData);
        const dupIndices =  getDupIndices(normalizedColData, FALSE_VALUES);
        const invalidSelectIndices = normalizedColData
            .map((_, idx) => idx)
            .filter((val, idx) => !FALSE_VALUES.has(`${normalizedColData[idx]}`.trim()) && dataTypes[idx] !== DataTypes.DATETIME.name)
        return [...new Set([...dupIndices, ...invalidSelectIndices])];
    }

    const validator = {
        columnName: (columnData, dataTypes=[]) => {
            // TODO OK for now. if editable -> check if valid name
            return [];
        },
        dateTime: validateDatetime,
        serial: (columnData, dataTypes=[]) => {
            const normalizedColData = normalizeBoolean(columnData);
            const serialTypes = new Set([DataTypes.STRING.name, DataTypes.INTEGER.name, DataTypes.DATETIME.name])
            const invalidSelectIndices = normalizedColData
                .map((_, idx) => idx)
                .filter((val, idx) => !FALSE_VALUES.has(`${normalizedColData[idx]}`.trim()) && !serialTypes.has(dataTypes[idx]))
            return [...new Set(invalidSelectIndices)];

        },
        order: (columnData, dataTypes=[]) => {
            return [];
        },
        auto_increment: validateDatetime,
        englishName: (columnData, dataTypes=[]) => {
            return getDupIndices(columnData);
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
                return numericTypes.has(dataTypes[idx]) && isNaN(val)
                    || `${val}`.trim() && dataTypes[idx] === DataTypes.DATETIME.name;
            }
            const numericTypes = new Set([DataTypes.REAL.name, DataTypes.INTEGER.name])
            const invalidSelectIndices = columnData.map((val, idx) => [idx, invalidCoef(val, idx)])
                .filter(x => x[1] === true)  // true = invalid
                .map(x => x[0]);
            return invalidSelectIndices;
        },
    };

    const convertIdxToExcelCol = (idx) => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUWXYZ';
        if (isEmpty(idx) || idx >= alphabet.length) return '';
        return alphabet[idx];
    };

    let errorTextCells = [];
    let errorCheckboxCells = [];
    for (const colIdx in validationColNames) {
        const validationCol = validationColNames[colIdx];
        const validationFunc = validator[validationCol];

        const columnData = verticalData[colIdx];
        let invalidRowIds = validationFunc(columnData, dataTypes);
        const invalidCells = invalidRowIds.map(rowIdx => `${convertIdxToExcelCol(colIdx)}${parseInt(rowIdx) + 1}`);

        if (['dateTime', 'serial', 'auto_increment'].includes(validationCol)) {
            errorCheckboxCells = errorCheckboxCells.concat(invalidCells);
        } else {
            errorTextCells = errorTextCells.concat(invalidCells);
        }
    }

    // validate select serial + time for same column
    const asDatetimeIdx = validationColNames.indexOf('dateTime') || 1;
    const asSerialIdx = validationColNames.indexOf('serial') || 2;
    const asDateTimeData = normalizeBoolean(verticalData[asDatetimeIdx]);
    const asSerialData = normalizeBoolean(verticalData[asSerialIdx]);
    for (const rowIdx in asDateTimeData) {
        const dtVal = asDateTimeData[rowIdx];
        const serialVal = asSerialData[rowIdx];
        if (dtVal && serialVal){
            const invalidDtCell = `${convertIdxToExcelCol(asDatetimeIdx)}${parseInt(rowIdx) + 1}`;
            const invalidSerialCell = `${convertIdxToExcelCol(asSerialIdx)}${parseInt(rowIdx) + 1}`;
            errorCheckboxCells.push(invalidDtCell);
            errorCheckboxCells.push(invalidSerialCell);
        }
    }

    resetColor();

    if (errorTextCells.length || errorCheckboxCells.length) {
        const jexcelDivId = $(procModalElements.prcSM).attr('id');
        colorErrorCells(jexcelDivId, errorTextCells);
        colorErrorCheckboxCells(jexcelDivId, errorCheckboxCells);
        return false;
    }
    return true;
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
        const editModeData = getExcelModeData();
        let editModeDataVertical = transpose(editModeData);
        const validationColNames = [
            'columnName', 'dateTime', 'serial', 'auto_increment', 'englishName', 'japaneseName', 'localName', 'operator', 'coef'
        ]

        const colName2Type = buildDictColWithKey(columns, 'data_type');
        const columnNameIdx = validationColNames.indexOf('columnName');
        const columnNames = editModeDataVertical[columnNameIdx];
        const dataTypes = columnNames.map(col => colName2Type[col] || DataTypes.STRING.name);  // set TEXT as default

        if (force) {
            sendSpreadSheetDataToSetting(editModeDataVertical, validationColNames, dataTypes).then(() => {});
        } else {
            const isValid = checkExcelDataValid(editModeDataVertical, validationColNames, dataTypes);
            if (isValid) {
                sendSpreadSheetDataToSetting(editModeDataVertical, validationColNames, dataTypes).then(() => {});
            } else {
                $(procModalElements.procConfigConfirmSwitchModal).modal('show');
                return;
            }
        }
    }

    showHideModes(isEditMode);
};

const sendSpreadSheetDataToSetting = async (editModeDataVertical, validationColNames, dataTypes) => {

    // normalize boolean values
    editModeDataVertical = cleanBooleanVerticalData(editModeDataVertical, validationColNames, dataTypes);

    // convert english name to romaji
    const englishNameIdx = validationColNames.indexOf('englishName') || 4;
    const englishNames = editModeDataVertical[englishNameIdx];
    editModeDataVertical[englishNameIdx] = await convertEnglishRomaji(englishNames);

    // transpose back to horizontal row
    const convertedEditModeData = transpose(editModeDataVertical);

    procModalElements.seletedColumnsBody.empty();
    for(let rowIdx in convertedEditModeData){
        const editModeRow = convertedEditModeData[rowIdx];
        if (isEmpty(editModeRow[0])){
            continue;
        }
        const settingModeRow = {
            data_type: dataTypes[rowIdx],
            column_name: editModeRow[0],
            is_get_date: editModeRow[1],
            is_serial_no: editModeRow[2],
            is_auto_increment: editModeRow[3],
            name_en: editModeRow[4],
            name_jp: editModeRow[5],
            name_local: editModeRow[6],
            operator: editModeRow[7] === 'Valid-like' ? 'regex' : editModeRow[7],
            coef: editModeRow[8],
        };

        procModalElements.seletedColumnsBody.append(
            genColConfigHTML(settingModeRow)
        );
    }
    validateSelectedColumnInput();
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

const selecAllToRight = (isSelect = true) => {
    const targetColIdx = $(procModalElements.checkColsContextMenu).attr('data-target-col');
    const allColsFromTable = $('table[name=latestDataTable] tr input');
    // update selection from column
    for (let i = targetColIdx; i < allColsFromTable.length; i++) {
        const targetCol = $(allColsFromTable[i]);
        const isChecked = targetCol.is(':checked');
        if (isChecked !== isSelect) {
            if (!targetCol.length) continue;
            targetCol.prop('checked', isSelect);
            selectTargetCol(targetCol[0], doValidate = false);
        }
    }

    // add validation
    validateSelectedColumnInput();

    updateSelectAllCheckbox();

    // reset attribute in context menu
    $(procModalElements.checkColsContextMenu).attr('data-target-col', '');
    hideCheckColMenu();
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
        saveProcCfg(selectJson, false);
        
        // save order to local storage
        setTimeout(() => {
            dragDropRowInTable.setItemLocalStorage($(procElements.tableProcList)[0]); // set proc table order
        }, 2000);
        recentEdit(procModalCurrentProcId);
    });

    // load tables to modal combo box
    loadTables(procModalElements.databases.find('option:selected').val());

    // Databases onchange
    procModalElements.databases.change(() => {
        hideAlertMessages();
        isClickPreview = true;
        const dsSelected = procModalElements.databases.find('option:selected').val();
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
        const currentShownTableName = $('select[name=tableName] option[selected=selected]').val() || null;
        const currentShownDataSouce = procModalElements.databases
            .find('option:selected')
            .val() || null;
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

    procModalElements.proc.on('focusout', checkDuplicateMasterName);

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
});
