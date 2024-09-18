const DataTypes = Object.freeze({
    NONE: {
        name: 'NONE',
        value: 0,
        label: '---',
        short: 'NONE',
        exp: 'NONE',
        org_type: 'NONE',
        operator: [''],
    },
    INTEGER: {
        name: 'INTEGER',
        value: 1,
        label: $('#i18nInteger').text() || '整数',
        i18nLabelID: 'i18nInteger',
        i18nAllLabel: 'i18nAllInt',
        short: 'Int',
        exp: 'i18nInteger',
        org_type: 'INTEGER',
        operator: ['', '+', '-', '*', '/'],
        selectionBoxDisplay: 'Int',
    },
    INTEGER_CAT: {
        name: 'INTEGER_CAT',
        value: 1,
        label: $('#i18nIntegerCat').text() || '整数(カテゴリ)',
        i18nLabelID: 'i18nIntegerCat',
        i18nAllLabel: 'i18nAllIntCatLabel',
        short: 'Int(Cat)',
        exp: 'i18nIntegerCat',
        org_type: 'INTEGER',
        operator: ['', '+', '-', '*', '/'],
        selectionBoxDisplay: 'Int(Cat)',
    },
    REAL: {
        name: 'REAL',
        value: 2,
        label: $('#i18nFloat').text() || '実数',
        i18nLabelID: 'i18nFloat',
        i18nAllLabel: 'i18nAllReal',
        short: 'Real',
        exp: 'i18nFloatTypeExplain',
        org_type: 'REAL',
        operator: ['', '+', '-', '*', '/'],
        selectionBoxDisplay: 'Real',
    },
    STRING: {
        name: 'TEXT',
        value: 3,
        label: $('#i18nString').text() || '文字列',
        i18nLabelID: 'i18nString',
        i18nAllLabel: 'i18nAllStr',
        short: 'Str',
        exp: 'i18nString',
        org_type: 'TEXT',
        operator: ['', 'Valid-like'],
        selectionBoxDisplay: 'Str',
    },
    DATETIME: {
        name: 'DATETIME',
        value: 4,
        label: $('#i18nDateTime').text() || '日付',
        i18nLabelID: 'i18nDateTime',
        short: 'CT',
        exp: 'i18nCTTypeExplain',
        org_type: 'DATETIME',
        operator: [''],
        selectionBoxDisplay: 'Datetime',
    },
    DATE: {
        name: 'DATE',
        value: 4,
        label: $('#i18nMainDate').text() || '日付',
        i18nLabelID: 'i18nMainDate',
        short: 'Date',
        exp: 'i18nCTTypeExplain',
        org_type: 'DATE',
        operator: [''],
        selectionBoxDisplay: 'Datetime',
    },
    TIME: {
        name: 'TIME',
        value: 4,
        label: $('#i18nMainTime').text() || '日付',
        i18nLabelID: 'i18nMainTime',
        short: 'Time',
        exp: 'i18nCTTypeExplain',
        org_type: 'TIME',
        operator: [''],
        selectionBoxDisplay: 'Datetime',
    },
    TEXT: {
        name: 'TEXT',
        value: 3,
        label: $('#i18nString').text() || '文字列',
        i18nLabelID: 'i18nString',
        i18nAllLabel: 'i18nAllStr',
        short: 'Str',
        exp: 'i18nString',
        org_type: 'TEXT',
        operator: ['', 'Valid-like'],
        selectionBoxDisplay: 'Str',
    },
    REAL_SEP: {
        name: 'REAL_SEP',
        value: 5,
        label: $('#i18nRealSep').text(),
        i18nLabelID: 'i18nRealSep',
        i18nAllLabel: 'i18nAllRealSep',
        short: 'Real_Sep',
        exp: '',
        org_type: 'REAL',
        operator: ['', '+', '-', '*', '/'],
    },
    INTEGER_SEP: {
        name: 'INTEGER_SEP',
        value: 6,
        label: $('#i18nIntSep').text(),
        i18nLabelID: 'i18nIntSep',
        i18nAllLabel: 'i18nAllIntSep',
        short: 'Int_Sep',
        exp: '',
        org_type: 'INTEGER',
        operator: ['', '+', '-', '*', '/'],
    },
    EU_REAL_SEP: {
        name: 'EU_REAL_SEP',
        value: 7,
        label: $('#i18nEURealSep').text(),
        i18nLabelID: 'i18nEURealSep',
        i18nAllLabel: 'i18nAllEURealSep',
        short: 'EU_Real_Sep',
        exp: '',
        org_type: 'REAL',
        operator: ['', '+', '-', '*', '/'],
    },
    EU_INTEGER_SEP: {
        name: 'EU_INTEGER_SEP',
        value: 8,
        label: $('#i18nEUIntSep').text(),
        i18nLabelID: 'i18nEUIntSep',
        i18nAllLabel: 'i18nAllEUIntSep',
        short: 'EU_Int_Sep',
        exp: '',
        org_type: 'INTEGER',
        operator: ['', '+', '-', '*', '/'],
    },
    BIG_INT: {
        name: 'BIG_INT',
        value: 10,
        org_type: 'STRING',
        operator: ['', '+', '-', '*', '/'],
    },
    SERIAL: {
        name: 'SERIAL',
        short: 'Seri',
    },
    CATEGORY: {
        name: 'CATEGORY',
        short: 'Cat',
        i18nLabelID: 'i18nCategoryOutputLabel',
    },
    BOOLEAN: {
        name: 'BOOLEAN',
        short: 'Bool',
        i18nLabelID: 'i18nBool',
        selectionBoxDisplay: 'Boolean',
        column_type: 77,
    },
    JUDGE: {
        name: 'JUDGE',
        short: 'Judge',
        i18nLabelID: 'i18nJudgementDataTypeHover',
        exp: 'i18nJudge',
    },
});

const dataTypeShort = (col) => {
    if (col.is_serial_no) {
        return DataTypes.SERIAL.short;
    }
    if (col.column_type === DataTypes.BOOLEAN.column_type) {
        return DataTypes.BOOLEAN.short;
    }
    if (col.is_judge) {
        return DataTypes.JUDGE.short;
    }
    if (col.is_int_category && !col.is_serial_no) {
        return DataTypes.CATEGORY.short;
    }
    const dataType = col.data_type || col.type;
    return dataType ? DataTypes[dataType].short : '';
};

const filterTypes = {
    LINE: 'LINE',
    MACHINE: 'MACHINE_ID',
    PART_NO: 'PART_NO',
    OTHER: 'OTHER',
};

const filterOptions = {
    NO_FILTER: 'NO_FILTER',
    ALL: 'ALL',
};

const CfgProcess_CONST = {
    REAL_TYPES: [
        DataTypes.REAL.name,
        DataTypes.EU_REAL_SEP.name,
        DataTypes.REAL_SEP.name,
    ],
    NUMERIC_TYPES: [
        DataTypes.REAL.name,
        DataTypes.INTEGER.name,
        DataTypes.EU_REAL_SEP.name,
        DataTypes.REAL_SEP.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
        DataTypes.DATETIME.name,
    ],
    NUMERIC_AND_STR_TYPES: [
        DataTypes.REAL.name,
        DataTypes.INTEGER.name,
        DataTypes.STRING.name,
        DataTypes.TEXT.name,
        DataTypes.EU_REAL_SEP.name,
        DataTypes.REAL_SEP.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
    ],
    ALL_TYPES: [
        DataTypes.DATETIME.name,
        DataTypes.REAL.name,
        DataTypes.INTEGER.name,
        DataTypes.STRING.name,
        DataTypes.TEXT.name,
        DataTypes.EU_REAL_SEP.name,
        DataTypes.REAL_SEP.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
    ],
    CATEGORY_TYPES: [
        DataTypes.STRING.name,
        DataTypes.INTEGER.name,
        DataTypes.TEXT.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
        DataTypes.BIG_INT.name,
    ],
    CT_TYPES: [DataTypes.DATETIME.name],
    EU_TYPE_VALUE: [
        DataTypes.REAL_SEP.value,
        DataTypes.EU_REAL_SEP.value,
        DataTypes.INTEGER_SEP.value,
        DataTypes.EU_INTEGER_SEP.value,
    ],
};

class CfgColumn {
    id;
    column_name;
    column_type;
    data_type;
    name_en;
    name_jp;
    name_local;
    shown_name;
    is_auto_increment;
    is_get_date;
    is_serial_no;
    is_int_category;
    is_category;
    is_judge;
    is_linking_column;
    operator;
    coef;
    order;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);
    }
}

class CfgFilter {
    id;
    name;
    column_id;
    filter_details;
    filter_type;
    parent_id;
    process_id;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);
    }
}

class CfgVisualization {
    id = null;
    process_id = null;
    control_column_id = null;
    filter_column_id = null;
    filter_value = null;
    is_from_data = null;
    filter_detail_id = null;
    ucl = null;
    lcl = null;
    upcl = null;
    lpcl = null;
    ymax = null;
    ymin = null;
    act_from = null;
    act_to = null;
    order = null;
    deleted_at = null;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);
    }
}

class CfgProcess {
    id;
    name;
    name_jp;
    name_en;
    name_local;
    shown_name;
    table_name;
    file_name; // for data preview and data-type prediction
    data_source_id;
    data_source;
    order;
    columns = [CfgColumn]; // may be dictionary {colId: columnObject}
    filters = [CfgFilter]; // may be dictionary {filterId: filterObject}
    visualizations = [CfgVisualization]; // may be dictionary {filterId: filterObject}

    // TODO use dict, remove array above
    dicColumns = {};

    // col -> univeral data
    dicColumnData = {}; // columnId -> [val1, val2, ...]

    ct_range = [];

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);

        // instantiate column objects
        this.columns = [];
        if (inObj && inObj.columns) {
            const colJsons = inObj.columns || [];
            for (const colJson of colJsons) {
                this.addColumn(colJson);
            }
        }

        // instantiate filter objects
        this.filters = [];
        if (inObj && inObj.filters) {
            const filterJsons = inObj.filters || [];
            for (const filterJson of filterJsons) {
                this.addFilter(filterJson);
            }
        }

        // instantiate filter objects
        this.visualizations = [];
        if (inObj && inObj.visualizations) {
            const visualizationJsons = inObj.visualizations || [];
            for (const vJson of visualizationJsons) {
                this.addVisualization(vJson);
            }
        }
    }

    addColumn = (column) => {
        const newColumn = new CfgColumn(column);
        this.columns.push(newColumn);
        this.dicColumns[newColumn.id] = newColumn;
    };

    addFilter = (filter) => {
        this.filters.push(new CfgFilter(filter));
    };

    addVisualization = (visualizationJson) => {
        this.visualizations.push(new CfgVisualization(visualizationJson));
    };

    getColumns = () => {
        return this.columns;
    };

    getColumnById = (colId) => {
        return this.dicColumns[colId];
    };

    getFilters = () => {
        return this.filters;
    };

    getVisualizations = () => {
        return this.visualizations;
    };

    getFiltersByType = (filterType) => {
        if (this.filters) {
            return this.filters.filter((pf) => pf.filter_type === filterType);
        }
        return null;
    };

    getOneFilterByType = (filterType) => {
        const relevantFilters = this.filters.filter(
            (filter) => filter.filter_type === filterType,
        );
        if (relevantFilters.length) {
            return relevantFilters[0];
        }
        return null;
    };

    getFilterByColumnId = (columnId) => {
        const relevantFilters = this.filters.filter(
            (filter) => `${filter.column_id}` === `${columnId}`,
        );
        if (relevantFilters.length) {
            return relevantFilters[0];
        }
        return null;
    };

    getCategoryColumns() {
        return this.columns.filter((col) =>
            CfgProcess_CONST.CATEGORY_TYPES.includes(col.data_type),
        );
    }

    getNumericColumns() {
        return this.columns.filter((col) =>
            CfgProcess_CONST.NUMERIC_TYPES.includes(col.data_type),
        );
    }

    getCTColumn() {
        return this.columns.filter(
            (col) =>
                CfgProcess_CONST.CT_TYPES.includes(col.data_type) &&
                col.is_get_date,
        );
    }

    getDatetimeColumns() {
        return this.columns.filter(
            (col) =>
                CfgProcess_CONST.CT_TYPES.includes(col.data_type) &&
                !col.is_get_date,
        );
    }

    updateColumns = async () => {
        if (this.columns && this.columns.length) {
            return;
        } else {
            await this.getColumnFromDB();
        }
    };

    getColumnFromDB = async () => {
        const url = `/ap/api/setting/proc_config/${this.id}/columns`;
        const res = await fetchData(url, {}, 'GET');
        if (res.data) {
            this.columns = [];
            for (let colJson of res.data) {
                const cfgColumn = new CfgColumn(colJson);
                this.columns.push(cfgColumn);
                this.dicColumns[cfgColumn.id] = cfgColumn;
            }
        }
    };

    updateFilters = async () => {
        if (this.filters && this.filters.length) {
            return;
        } else {
            await this.updateProcFilters();
        }
    };

    // get filter from process config
    updateProcFilters = async () => {
        const url = `/ap/api/setting/proc_config/${this.id}/filters`;
        const res = await fetchData(url, {}, 'GET');
        this.filters = [];
        if (res.data) {
            for (let filterItem of res.data) {
                const cfgFilter = new CfgFilter(filterItem);
                this.filters.push(cfgFilter);
            }
        }
    };

    setColumnData = (columnId, data) => {
        this.dicColumnData[columnId] = data;
    };

    getColumnData = (columnId) => {
        return this.dicColumnData[columnId] || [];
    };

    updateColDataFromUDB = async (columnId) => {
        if (
            this.dicColumnData[columnId] &&
            this.dicColumnData[columnId].length
        ) {
            return;
        } else {
            await this.getColumnDataFromUDB(columnId);
        }
    };

    getColumnDataFromUDB = async (columnId) => {
        if (isEmpty(columnId)) return;
        const url = `/ap/api/setting/distinct_sensor_values/${columnId}`;
        const res = await fetchData(url, {}, 'GET');
        if (res.data) {
            this.dicColumnData[columnId] = res.data || [];
        }
    };

    getXAxisSetting = () => {
        const columns = this.columns;
        return columns;
    };

    getCTRange = async () => {
        const url = `/ap/api/setting/proc_config/${this.id}/get_ct_range`;
        const res = await fetchData(url, {}, 'GET');
        if (res.data) {
            this.ct_range = res.data;
        }
    };
}

class CfgDataSourceDB {
    id;
    host;
    port;
    dbname;
    schema;
    username;
    password;
    hashed;
    use_os_timezone;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);
    }
}

class CfgCsvColumn {
    id;
    data_source_id;
    column_name;
    data_type;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);
    }
}

class CfgDataSourceCSV {
    id;
    directory;
    skip_head;
    skip_tail;
    delimiter;
    etl_func;
    csv_columns;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);

        // instantiate column objects
        this.csv_columns = [];
        const csv_cols = inObj.csv_columns || [];
        for (const csv_col of csv_cols) {
            this.add_column(csv_col);
        }
    }

    add_column(column) {
        this.csv_columns.push(new CfgCsvColumn(column));
    }
}

class CfgDataSource {
    id;
    name;
    type;
    comment;
    order;
    db_detail;
    csv_detail;
    processes;

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);

        // instantiate column objects
        this.processes = [];
        const procs = inObj.processes || [];
        for (const proc of procs) {
            this.add_process(proc);
        }

        this.csv_detail = new CfgDataSourceCSV(inObj.csv_detail);
        this.db_detail = new CfgDataSourceDB(inObj.db_detail);
    }

    add_process(proc) {
        this.processes.push(new CfgProcess(proc));
    }
}

function sortByOrderOrID(proc1, proc2) {
    const order1 = proc1.order + 1 || proc1.id;
    const order2 = proc2.order + 1 || proc2.id;
    return order1 < order2 ? -1 : order1 > order2 ? 1 : 0;
}

const genProcessDropdownData = (procConfigs = {}) => {
    const ids = [''];
    const names = ['---'];
    Object.values(procConfigs)
        .sort(sortByOrderOrID)
        .forEach((proc) => {
            ids.push(proc.id);
            names.push({
                shown_name: proc.shown_name,
                name_en: proc.name_en,
            });
        });

    return {
        ids,
        names,
    };
};
