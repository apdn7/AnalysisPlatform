/**
 * @file Contains all constant that serve for data type dropdown.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Class contains all constant that serves for data type dropdown menu control
 */
class DataTypeDropdown_Constant {
    /**
     * A dictionary that contains title for each data type
     */
    static RawDataTypeTitle = Object.freeze({
        r: document.getElementById(DataTypes.REAL.i18nLabelID).textContent,
        t: document.getElementById(DataTypes.TEXT.i18nLabelID).textContent,
        d: document.getElementById(DataTypes.DATETIME.i18nLabelID).textContent,
        s_i: document.getElementById(DataTypes.SMALL_INT?.i18nLabelID)?.textContent,
        i: document.getElementById('i18nInteger_Int32')?.textContent,
        b_i: document.getElementById(DataTypes.BIG_INT.i18nLabelID)?.textContent,
        T: document.getElementById(DataTypes.CATEGORY?.i18nLabelID)?.textContent,
        b: document.getElementById(DataTypes.BOOLEAN.i18nLabelID).textContent,
        date: document.getElementById(DataTypes.DATE.i18nLabelID).textContent,
        time: document.getElementById(DataTypes.TIME.i18nLabelID).textContent,
    });

    /**
     * Get from api ap/api/setting/show_latest_records
     * @type {Readonly<DataGroupType>}
     */
    static DataGroupType = Object.freeze({
        DATETIME: 1,
        MAIN_SERIAL: 2,
        SERIAL: 3,
        DATETIME_KEY: 4,
        DATE: 5,
        TIME: 6,
        MAIN_DATE: 7,
        MAIN_TIME: 8,
        INT_CATE: 10,
        LINE_NAME: 20,
        LINE_NO: 21,
        EQ_NAME: 22,
        EQ_NO: 23,
        PART_NAME: 24,
        PART_NO: 25,
        ST_NO: 26,
        JUDGE: 76,
        GENERATED: 99,
        GENERATED_EQUATION: 100,
    });

    /**
     * A list of element names
     */
    static ElementNames = Object.freeze({
        englishName: 'englishName',
        systemName: 'systemName',
        japaneseName: 'japaneseName',
        localName: 'localName',
        dataType: 'dataType',
        columnName: 'columnName',
    });

    /**
     * A list of attributes that be limited to be selected one time
     */
    static UnableToReselectAttrs = Object.freeze([
        'is_get_date',
        'is_auto_increment',
        'is_main_date',
        'is_main_time',
        'is_judge',
    ]);

    /**
     * A list of attributes that be limited to select only one 1 column / process
     */
    static AllowSelectOneAttrs = Object.freeze([
        masterDataGroup.MAIN_DATETIME,
        masterDataGroup.MAIN_SERIAL,
        masterDataGroup.DATETIME_KEY,
        masterDataGroup.MAIN_DATE,
        masterDataGroup.MAIN_TIME,
        masterDataGroup.LINE_NAME,
        masterDataGroup.LINE_NO,
        masterDataGroup.EQ_NAME,
        masterDataGroup.EQ_NO,
        masterDataGroup.PART_NAME,
        masterDataGroup.PART_NO,
        masterDataGroup.ST_NO,
        masterDataGroup.JUDGE,
    ]);

    /**
     * A list of attributes for column type
     */
    static ColumnTypeAttrs = Object.freeze([
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
    ]);

    /**
     * A list of data types that allow applying format
     */
    static AllowFormatingDataType = Object.freeze([
        DataTypes.SMALL_INT?.bs_value,
        DataTypes.SMALL_INT_SEP?.bs_value,
        DataTypes.EU_SMALL_INT_SEP?.bs_value,

        DataTypes.INTEGER?.bs_value,
        DataTypes.INTEGER_SEP?.bs_value,
        DataTypes.EU_INTEGER_SEP?.bs_value,

        DataTypes.BIG_INT?.bs_value,
        DataTypes.BIGINT_SEP?.bs_value,
        DataTypes.EU_BIGINT_SEP?.bs_value,

        DataTypes.REAL?.bs_value,
        DataTypes.REAL_SEP?.bs_value,
        DataTypes.EU_REAL_SEP?.bs_value,

        DataTypes.BOOLEAN?.bs_value,
    ]);

    /**
     * A datatype default object
     * @type Readonly<DataTypeObject>
     */
    static DataTypeDefaultObject = Object.freeze({
        value: '',
        is_get_date: false,
        is_main_date: false,
        is_main_time: false,
        is_serial_no: false,
        is_main_serial_no: false,
        is_auto_increment: false,
        is_int_cat: false,
        is_judge: false,
    });

    /**
     * A list of data types sorted in ascending order by data type
     * @type {Readonly<String[]>}
     */
    static DataTypeOrder = Object.freeze([
        DataTypes.JUDGE.name,
        DataTypes.BOOLEAN.name,
        DataTypes.INTEGER.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
        DataTypes.BIG_INT.name,
        DataTypes.REAL.name,
        DataTypes.REAL_SEP.name,
        DataTypes.EU_REAL_SEP.name,
        DataTypes.TEXT.name,
    ]);
}
