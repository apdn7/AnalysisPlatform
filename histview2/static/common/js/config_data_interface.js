const DataTypes = Object.freeze({
    NONE: {
        name: 'NONE',
        value: 0,
        label: '---',
        short: 'NONE',
        exp: 'NONE',
    },
    INTEGER: {
        name: 'INTEGER',
        value: 1,
        label: $('#i18nInteger').text() || '整数',
        i18nLabelID: 'i18nInteger',
        i18nAllLabel: 'i18nAllInt',
        short: 'Int',
        exp: 'i18nInteger',
    },
    REAL: {
        name: 'REAL',
        value: 2,
        label: $('#i18nFloat').text() || '実数',
        i18nLabelID: 'i18nFloat',
        i18nAllLabel: 'i18nAllReal',
        short: 'Real',
        exp: 'i18nFloatTypeExplain',
    },
    STRING: {
        name: 'TEXT',
        value: 3,
        label: $('#i18nString').text() || '文字列',
        i18nLabelID: 'i18nString',
        i18nAllLabel: 'i18nAllStr',
        short: 'Str',
        exp: 'i18nString',
    },
    DATETIME: {
        name: 'DATETIME',
        value: 4,
        label: $('#i18nDateTime').text() || '日付',
        i18nLabelID: 'i18nDateTime',
        short: 'CT',
        exp: 'i18nCTTypeExplain',
    },
    TEXT: {
        name: 'TEXT',
        value: 3,
        label: $('#i18nString').text() || '文字列',
        i18nLabelID: 'i18nString',
        i18nAllLabel: 'i18nAllStr',
        short: 'Str',
        exp: 'i18nString',
    },
});


class CfgColumn {
    id;
    name;
    column_name;
    column_type;
    data_type;
    english_name;
    is_auto_increment;
    is_get_date;
    is_serial_no;
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

    static filterTypes = {
        LINE: 'LINE',
        MACHINE: 'MACHINE_ID',
        PART_NO: 'PART_NO',
        OTHER: 'OTHER',
    }

    static filterOptions = {
        NO_FILTER: 'NO_FILTER',
        ALL: 'ALL',
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
    table_name;
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

    static REAL_TYPES = [DataTypes.REAL.name];
    static NUMERIC_TYPES = [DataTypes.REAL.name, DataTypes.INTEGER.name];
    static NUMERIC_AND_STR_TYPES = [DataTypes.REAL.name, DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name];
    static ALL_TYPES = [DataTypes.DATETIME.name, DataTypes.REAL.name, DataTypes.INTEGER.name, DataTypes.STRING.name, DataTypes.TEXT.name];
    static CATEGORY_TYPES = [DataTypes.STRING.name, DataTypes.INTEGER.name, DataTypes.TEXT.name];
    static CT_TYPES = [DataTypes.DATETIME.name];

    constructor(inObj) {
        // set data
        Object.assign(this, inObj);

        // instantiate column objects
        this.columns = [];
        if (inObj && inObj.columns) {
            const colJsons = inObj.columns || [];
            for (const colJson of colJsons) {
                this.addColumn(colJson)
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
    }

    addFilter = (filter) => {
        this.filters.push(new CfgFilter(filter));
    }

    addVisualization = (visualizationJson) => {
        this.visualizations.push(new CfgVisualization(visualizationJson));
    }

    getColumns = () => {
        return this.columns;
    }

    getColumnById = (colId) => {
        return this.dicColumns[colId];
    }

    getFilters = () => {
        return this.filters;
    }

    getVisualizations = () => {
        return this.visualizations;
    }

    getFiltersByType = (filterType) => {
        if (this.filters) {
            return this.filters.filter(pf => pf.filter_type === filterType);
        }
        return;
    }

    getOneFilterByType = (filterType) => {
        const relevantFilters = this.filters.filter(filter => filter.filter_type === filterType);
        if (relevantFilters.length) {
            return relevantFilters[0];
        }
        return null;
    }

    getFilterByColumnId = (columnId) => {
        const relevantFilters = this.filters.filter(filter => `${filter.column_id}` === `${columnId}`);
        if (relevantFilters.length) {
            return relevantFilters[0];
        }
        return null;
    }

    getCategoryColumns() {
        return this.columns.filter(col => CfgProcess.CATEGORY_TYPES.includes(col.data_type));
    }

    getNumericColumns() {
        return this.columns.filter(col => CfgProcess.NUMERIC_TYPES.includes(col.data_type));
    }

    getCTColumn() {
        return this.columns.filter(col => CfgProcess.CT_TYPES.includes(col.data_type) && col.is_get_date);
    }

    getDatetimeColumns() {
        return this.columns.filter(col => CfgProcess.CT_TYPES.includes(col.data_type) && !col.is_get_date);
    }

    updateColumns = async () => {
        if (this.columns && this.columns.length) {
            return;
        } else {
            await this.getColumnFromDB();
        }
    }


    getColumnFromDB = async () => {
        await fetch(`/histview2/api/setting/proc_config/${this.id}/columns`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        })
            .then(response => response.clone().json())
            .then(json => {
                this.columns = [];
                for (let colJson of json.data) {
                    const cfgColumn = new CfgColumn(colJson);
                    this.columns.push(cfgColumn);
                    this.dicColumns[cfgColumn.id] = cfgColumn;
                }
            });
    }

    updateFilters = async () => {
        if (this.filters && this.filters.length) {
            return;
        } else {
            await this.updateProcFilters();
        }
    }

    // get filter from process config
    updateProcFilters = async () => {
        await fetch(`/histview2/api/setting/proc_config/${this.id}/filters`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        })
            .then(response => response.clone().json())
            .then(json => {
                this.filters = [];
                for (let filterItem of json.data) {
                    const cfgFilter = new CfgFilter(filterItem);
                    this.filters.push(cfgFilter);
                }
            });
    }

    setColumnData = (columnId, data) => {
        this.dicColumnData[columnId] = data;
    }

    getColumnData = (columnId) => {
        return this.dicColumnData[columnId] || [];
    }

    updateColDataFromUDB = async (columnId) => {
        if (this.dicColumnData[columnId] && this.dicColumnData[columnId].length) {
            return;
        } else {
            await this.getColumnDataFromUDB(columnId);
        }
    }

    getColumnDataFromUDB = async (columnId) => {
        if (isEmpty(columnId)) return;

        await fetch(`/histview2/api/setting/distinct_sensor_values/${columnId}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        })
            .then(response => response.clone().json())
            .then(json => {
                const sensorValues = json.data || [];
                this.dicColumnData[columnId] = sensorValues;
            }).catch((e) => {
                console.log(e);
            });
    }
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
            this.add_column(csv_col)
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
            this.add_process(proc)
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
    return ((order1 < order2) ? -1 : ((order1 > order2) ? 1 : 0));
}

const genProcessDropdownData = (procConfigs = {}) => {
    const ids = [''];
    const names = ['---'];
    Object.values(procConfigs).sort(sortByOrderOrID).forEach((proc) => {
        ids.push(proc.id);
        names.push(proc.name);
    });

    return {
        ids,
        names,
    };
}