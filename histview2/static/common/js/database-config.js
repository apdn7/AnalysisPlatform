/* eslint-disable no-unused-vars */
class Databases {
    constructor(configurations = {}) {
        // DB required attributes
        this.REQUIRED_ATTRS = [
            'name',
            'type',
        ];
        // DB optional attributes
        this.OPTIONAL_ATTRS = [
            'host',
            'port',
            'password',
            'username',
            'schema',
            'comment',
            'directory',
            'polling-frequency',
            'universal_db',
            'proc_id',
            'column_names',
            'data_types',
            'use_os_timezone',
        ];

        this.POLLING_FREQ = 0;

        // Default config
        this.DEFAULT_CONFIGS = {
            POSTGRESQL: {
                type: 'postgresql',
                port: 5432,
                schema: 'public',
                dbname: '',
                host: '',
                username: '',
                password: '',
                use_os_timezone: false,
            },
            SQLITE: {
                type: 'sqlite',
                dbname: '',
                use_os_timezone: false,
            },
            MSSQL: {
                type: 'mssqlserver',
                port: 1433,
                schema: 'dbo',
                dbname: '',
                host: '',
                username: '',
                password: '',
                use_os_timezone: false,
            },
            MYSQL: {
                type: 'mysql',
                port: 3306,
                schema: null,
                dbname: '',
                host: '',
                username: '',
                password: '',
                use_os_timezone: false,
            },
            ORACLE: {
                type: 'oracle',
                port: 1521,
                schema: null,
                dbname: '',
                host: '',
                username: '',
                password: '',
                use_os_timezone: false,
            },
            CSV: {
                type: 'csv',
                directory: '',
                delimiter: 'CSV',
                'polling-frequency': 1,
                use_os_timezone: false,
            },
        };

        // DB Instance init
        this.set(configurations);
        this.tmpCfg = {};
    }

    // Set instances
    set(configurations = {}) {
        this.instances = {
            db: configurations,
            csv: {},
        };
    }

    // Add a DB into instances
    add(configurations = {}) {
        if (this.validate(configurations).isValid) {
            Object.assign(this.instances.db, configurations);
        }
        return this.instances;
    }

    // Delete a special DB in instances
    delete(id, attrs = []) {
        if (attrs.length === 0) {
            delete this.instances.db[id];
        } else {
            // delete this.instances.db[id]
            attrs.forEach((item) => {
                delete this.instances.db[id][item];
            });
        }
        return this.instances.db;
    }

    // Validate required attributes of db configurations
    validate(configurations = {}) {
        const item = Object.values(configurations);
        if (item.length > 0) {
            const attrs = Object.keys(item[0])
                .filter(k => this.REQUIRED_ATTRS.includes(k));
            const missingAttrs = this.REQUIRED_ATTRS.filter(i => attrs.indexOf(i) === -1);
            const missingValues = Object.values(attrs).filter(k => item[0][k] === '');
            const message = missingAttrs.length === 0 ? 'MISSING_ATTRS' : (missingValues.length === 0 ? 'MISSING_VALUE' : null);
            return {
                isValid: missingAttrs.length === 0 && missingValues.length === 0,
                // isValid: missingAttrs.length === 0,
                missingAttrs,
                // missingValues,
                message,
            };
        }
        return {
            isValid: false,
            missingAttrs: this.REQUIRED_ATTRS,
            message: null,
        };
    }

    // Reset all DB instances
    reset() {
        this.instances.db = {};
        this.tmpCfg = {};
        return this.instances;
    }

    // Get DB Config from ID and Type
    getDBCfg(id, type) {
        this.dbCfg = {};
        // At first, get from tmp instance
        if (Object.keys(this.tmpCfg).includes(id) && this.tmpCfg[id].type === type) {
            this.dbCfg = { ...this.instances.db[id], ...this.tmpCfg[id] };
        } else if (Object.keys(this.instances.db).includes(id) && type === this.instances.db[id].type) {
            // If current DB instance includes request ID && re-assign origin type
            // get origin data item
            this.dbCfg = this.instances.db[id];
        } else {
            const key = Object.keys(this.DEFAULT_CONFIGS).filter(k => this.DEFAULT_CONFIGS[k].type === type);
            this.dbCfg = this.DEFAULT_CONFIGS[key];
        }
        return this.dbCfg;
    }

    // Set tmp Information for change DB without push 'OK' button
    setTmpCfg(id, attrs = {}) {
        const tmpItem = {};
        tmpItem[id] = attrs;
        if (Object.keys(this.tmpCfg).includes(id)) {
            Object.assign(this.tmpCfg[id], attrs);
        } else {
            Object.assign(this.tmpCfg, tmpItem);
        }
    }

    // Remove tmp Information
    resetTmp() {
        this.tmpCfg = {};
    }

    getPollingFreq() {
        return this.POLLING_FREQ;
    }

    setPollingFreq(freq) {
        this.POLLING_FREQ = freq;
    }
}

const REQUIRED_ATTRS = [
    'name',
    'type',
];
// DB optional attributes
const OPTIONAL_ATTRS = [
    'host',
    'port',
    'password',
    'username',
    'schema',
    'comment',
    'directory',
    'polling-frequency',
    'universal_db',
    'proc_id',
    'column_names',
    'data_types',
    'use_os_timezone',
];
