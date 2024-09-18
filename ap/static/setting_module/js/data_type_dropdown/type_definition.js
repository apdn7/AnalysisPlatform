/**
 * @file Manages the type definition of objects
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * A datatype object
 * @typedef {{
 *    value: string,
 *    is_get_date: boolean,
 *    is_main_date: boolean,
 *    is_main_time: boolean,
 *    is_serial_no: boolean,
 *    is_main_serial_no: boolean,
 *    is_auto_increment: boolean,
 *    is_int_cat: boolean,
 *    is_big_int?: boolean,
 *    is_master_col?: boolean,
 *    checked?: boolean,
 *    isRegisteredCol?: boolean,
 *    isRegisterProc?: boolean,
 *    raw_data_type?: string,
 * } & ProcessColumnConfig} DataTypeObject
 */

/**
 * A datatype object
 * @typedef {{
 *    SERIAL: number,
 *    PART_NO: number,
 *    EQ_NO: number,
 *    ST_NO: number,
 *    DATETIME_KEY: number,
 *    MAIN_SERIAL: number,
 *    MAIN_DATE: number,
 *    TIME: number,
 *    DATE: number,
 *    INT_CATE: number,
 *    PART_NAME: number,
 *    DATETIME: number,
 *    GENERATED_EQUATION: number,
 *    MAIN_TIME: number,
 *    LINE_NO: number,
 *    EQ_NAME: number,
 *    LINE_NAME: number,
 *    GENERATED: number,
 * }} DataGroupType
 */

/**
 * A Column type info object
 * @typedef {{
 *     is_serial_no?: boolean,
 *     is_main_serial_no?: boolean,
 *     is_line_name?: boolean,
 *     is_line_no?: boolean,
 *     is_eq_name?: boolean,
 *     is_part_name?: boolean,
 *     is_part_no?: boolean,
 *     is_st_no?: boolean,
 *     is_int_cat?: boolean,
 *     is_main_date?: boolean,
 * }} ColumnTypeInfo
 */
