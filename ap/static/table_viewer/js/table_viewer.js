/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const tableSpecialCharRegex = /\/|\*|"| /g;
const cachedColumns = {};
let dataTableInstance = null;
let DB_TABLES = [];

const ele = {
    procSelection: $('#procSelection'),
    tableSelection: $('#tableSelection'),
    sortSelection: $('#sortSelection'),
    btnRadioSortDesc: $('#btnRadioSortDesc'),
    btnRadioSortAsc: $('#btnRadioSortAsc'),
    rowLimitSelection: $('#rowLimitSelection'),
    btnViewData: $('#btnViewData'),
    tableViewData: $('#tableViewData'),
    tableViewDataId: '#tableViewData',
    loadingScreen: $('#loadingScreen'),
    formUserInput: $('#formUserInput'),
    tblViewerSpinner: '#tblViewerSpinner',
    dbsCodeInput: $('input[name=databaseCode]'),
    tableNameInput: $('input[name=tableSelection]'),
};

const buildOptionHTML = (value = '', text = '', title = '') => {
    if (value) {
        return `<option ${title ? `title="${title}"` : ''} value="${value}">${text}</option>`;
    }
    return '<option value="">---</option>';
};

const getAllDatabaseConfigTbView = async () => {
    const json = await fetch('/ap/api/setting/database_tables_source', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
        .catch();

    return json;
};

// eslint-disable-next-line no-unused-vars
const getColumnNames = async (database, tableName) => {
    if (!database || !tableName) return {};

    // parse actual table name
    const replacedTableName = tableName.replace(tableSpecialCharRegex, ''); // TODO we may need to cover more

    // check if exists in cache
    if (getNode(cachedColumns, [database, replacedTableName])) {
        return cachedColumns[database][replacedTableName];
    }

    // get columns from db
    const url = new URL('/ap/api/table_viewer/column_names', window.location.href).href;
    const params = {
        database,
        table: replacedTableName,
    };
    const paramString = new URLSearchParams(params);
    const json = await fetch(`${url}?${paramString.toString()}`)
        .then(response => response.clone().json());

    // add columns to cache
    if (cachedColumns[database]) {
        cachedColumns[database][replacedTableName] = json.cols;
    } else {
        cachedColumns[database] = {};
        cachedColumns[database][replacedTableName] = json.cols;
    }

    return json.cols || [];
};

const showSortColumnOptions = async (procId) => {
    if (!procId) {
        const sortSelectionHTML = buildOptionHTML('');
        ele.sortSelection.empty();
        ele.sortSelection.append(sortSelectionHTML);
        return;
    };

    const res = await fetchData(`/ap/api/setting/proc_filter_config/${procId}`, {}, 'GET');
    const procCfg = res.data;
    const procColumns = res.data.columns;

    const tableName = procCfg.data_source.db_detail ? procCfg.table_name : '';

    setDbsAndTableInfo(procCfg.data_source.id, tableName)
    // show loading icon
    $(ele.tblViewerSpinner).toggleClass('spinner-grow');

    let sortSelectionHTML = '';
    sortSelectionHTML += buildOptionHTML('');
    if (procColumns.length) {
        procColumns.forEach((col) => {
            const columnName = col.column_raw_name || col.column_name;
            sortSelectionHTML += buildOptionHTML(col.column_name, col.shown_name, columnName);
        });
    }

    ele.sortSelection.empty();
    ele.sortSelection.append(sortSelectionHTML);
    addAttributeToElement();
};

const queryRecordsFromDB = ((databaseCode, tableName,
    sortColumn = null, sortOrder = 'DESC', limit = null,
    callbackFunc = null) => {
    const data = {
        database_code: databaseCode,
        table_name: tableName,
        sort_column: sortColumn,
        sort_order: sortOrder,
        limit,
    };
    fetch('api/table_viewer/table_records', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.clone().json())
        .then((json) => {
            loadingShow(true);
            if (callbackFunc) {
                callbackFunc(json);
            }
            setTimeout(loadingHide, 0);
        })
        .catch(() => {
            loadingHide();
            setTimeout(loadingHide, 0);
        });
});

const setDbsAndTableInfo = (dbsCode, tableName) => {
    ele.dbsCodeInput.val(dbsCode);
    ele.tableNameInput.val(tableName);
};

const getFormInput = () => {
    // get form data
    const formData = new FormData(ele.formUserInput[0]);

    const databaseCode = formData.get('databaseCode');
    const tableName = formData.get('tableSelection');
    const sortColumn = formData.get('sortSelection');
    const sortOrder = formData.get('btnRadioSortOrder');
    const limit = formData.get('rowLimitSelection');

    return {
        databaseCode,
        tableName,
        sortColumn,
        sortOrder,
        limit,
    };
};

// create language file url from locale
const getLanguage = () => {
    const langMap = {
        en: 'English',
        ja: 'Japanese',
    };
    const locale = docCookies.getItem('locale');
    const url = new URL(`/ap/static/table_viewer/lang/${langMap[locale]}.json`, window.location.href).href;
    return url;
};

const cleanViewTable = () => {
    if ($.fn.dataTable.isDataTable(ele.tableViewDataId)) {
        dataTableInstance.destroy();
        $(ele.tableViewDataId).empty();
    }
};

const showRecordsToViewTable = (json) => {
    const selectedColumn = ele.sortSelection.val();
    const cols = [];
    json.cols.forEach((col) => {
        if (col.name !== selectedColumn) {
            cols.push({
                title: col.name,
                data: col.name,
            });
        }
    });

    // move sort column to the left
    if (selectedColumn) {
        cols.unshift({
            title: selectedColumn,
            data: selectedColumn,
        });
    }

    const { rows } = json;

    // must clean before re-initalize DataTable object
    cleanViewTable();
    dataTableInstance = $(ele.tableViewDataId).DataTable({
        data: rows,
        columns: cols,
        scrollX: true,
        scrollY: 410,
        paging: false,
        searching: true,
        ordering: false,
        info: false,
        lengthChange: true,
        language: {
            url: getLanguage(),
        },
    });
    $('#tblViewerCard').css('display', 'inherit');

    // TODO: Fix to remove empty card
    dataTableInstance.columns.adjust().draw();
    $($.fn.dataTable.tables(true)).DataTable().columns.adjust();
    setTimeout(loadingHide, 0);
};

$(() => {
    // Setting i18 for select filters
    $.fn.select2.defaults.set('language', {
        errorLoading() {
            return 'ERROR_LOADING';
        },
        inputTooLong(args) {
            return 'INPUT_TOO_LONG';
        },
        inputTooShort(args) {
            return 'INPUT_TOO_SHORT';
        },
        loadingMore() {
            return 'LOADING_MORE';
        },
        maximumSelected(args) {
            return 'MAX_SELECTED';
        },
        noResults() {
            return '';
        },
        searching() {
            return 'SEARCHING';
        },
    });
    ele.procSelection.val('');
    // on change database selection
    ele.procSelection.change(async function f() {
        const selectedProcId = this.value;
        if (!selectedProcId) return;
        // show loading icon
        $(ele.tblViewerSpinner).toggleClass('spinner-grow');

        await showSortColumnOptions(selectedProcId);
    });

    // on button click
    ele.btnViewData.click(() => {
        cleanViewTable();
        loadingShow();

        const {
            databaseCode,
            tableName,
            sortColumn,
            sortOrder,
            limit,
        } = getFormInput();

        if (!databaseCode) {
            setTimeout(loadingHide, 0);
            return;
        }
        queryRecordsFromDB(databaseCode, tableName,
            sortColumn, sortOrder, limit,
            showRecordsToViewTable);
    });
    ele.tableSelection.select2();
    ele.sortSelection.select2();

    // Load userBookmarkBar
    $('#userBookmarkBar').show();
    
    // show load settings menu
    handleLoadSettingBtns();
});
