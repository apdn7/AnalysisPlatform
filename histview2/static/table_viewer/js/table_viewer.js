/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const tableSpecialCharRegex = /\/|\*|"| /g;
const cachedColumns = {};
let dataTableInstance = null;
let DB_TABLES = [];

const ele = {
    dbSelection: $('#dbSelection'),
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
};

const buildOptionHTML = (value = '', text = '') => {
    if (value) {
        return `<option value="${value.id}">${text}</option>`;
    }
    return '<option value="">---</option>';
};

const buildTableOptionHTML = (value = '', text = '') => {
    if (value) {
        return `<option value="${value}">${text}</option>`;
    }
    return '<option value="">---</option>';
};

const getAllDatabaseConfigTbView = async () => {
    const json = await fetch('/histview2/api/setting/database_tables_source', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.clone().json())
        .catch();

    return json;
};

const showDatabase = async () => {
    const dbInfo = await getAllDatabaseConfigTbView();

    // show tables
    DB_TABLES = dbInfo;

    let dbSelectionHTML = '';
    dbSelectionHTML += buildOptionHTML('');
    dbInfo.forEach((dbCode) => {
        if (dbCode.db_detail) {
            const dbMasterName = dbCode.name;
            const dbType = dbCode.type;
            const dbHost = dbCode.db_detail.host || dbCode.db_detail.dbname;
            dbSelectionHTML += buildOptionHTML(dbCode, `${dbMasterName} (${dbType}, ${dbHost})`);
        }
    });
    ele.dbSelection.empty();
    ele.dbSelection.append(dbSelectionHTML);
};

const showTables = (dbCode) => {
    if (!dbCode) {
        const tableSelectionHTML = buildOptionHTML('');
        ele.tableSelection.empty();
        ele.tableSelection.append(tableSelectionHTML);
        return;
    }

    let tables;
    // APIを呼び出し
    $.ajax({
        url: `api/setting/database_table/${dbCode}`,
        method: 'GET',
        cache: false,
    }).done((res) => {
        tables = res.tables;

        // テーブルがあるのかをチェックする。
        ele.tableSelection.empty();
        if (tables) {
            let tableSelectionHTML = '';
            tables.forEach((table) => {
                tableSelectionHTML += buildTableOptionHTML(table, table);
            });
            ele.tableSelection.append(tableSelectionHTML);
        }
    });
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
    const url = new URL('/histview2/api/table_viewer/column_names', window.location.href).href;
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

const showSortColumnOptions = async (tblCode) => {
    if (!tblCode) {
        const sortSelectionHTML = buildOptionHTML('');
        ele.sortSelection.empty();
        ele.sortSelection.append(sortSelectionHTML);
        return;
    }

    const selectedDB = ele.dbSelection.val();
    const selectedTable = ele.tableSelection.val();
    const columns = await getColumnNames(selectedDB, selectedTable);

    let sortSelectionHTML = '';
    sortSelectionHTML += buildOptionHTML('');
    if (columns) {
        columns.forEach((col) => {
            // sortSelectionHTML += buildOptionHTML(col, col);
            sortSelectionHTML += buildTableOptionHTML(col.name, col.name);
        });
    }

    ele.sortSelection.empty();
    ele.sortSelection.append(sortSelectionHTML);
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

const getFormInput = () => {
    // get form data
    const formData = new FormData(ele.formUserInput[0]);

    databaseCode = formData.get('dbSelection');
    tableName = formData.get('tableSelection');
    sortColumn = formData.get('sortSelection');
    sortOrder = formData.get('btnRadioSortOrder');
    limit = formData.get('rowLimitSelection');

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
    const url = new URL(`/histview2/static/table_viewer/lang/${langMap[locale]}.json`, window.location.href).href;
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
    // init state
    setTimeout(() => {
        // get tables + show tables
        showDatabase();
    }, 0);
    showTables(ele.dbSelection.val());

    // on change database selection
    ele.dbSelection.change(function f() {
        const selectedDB = this.value;

        // show loading icon
        $(ele.tblViewerSpinner).toggleClass('spinner-grow');

        setTimeout(() => {
            showTables(selectedDB);
            // hide loading icon
            $(ele.tblViewerSpinner).toggleClass('spinner-grow');
        }, 1000);

        // get default table and show sort columns
        setTimeout(() => {
            const selectedTable = ele.tableSelection.val();
            showSortColumnOptions(selectedTable);
        }, 3000);
    });
    // on change table selection
    ele.tableSelection.change(function f() {
        const selectedTable = this.value;
        showSortColumnOptions(selectedTable);
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

        if (!databaseCode || !tableName) {
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
});
