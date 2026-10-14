/**
 * @file Contains all functions relate to parsing data.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 * @author Tran Thi Kim Tuyen <tuyenttk5@fpt.com>
 */

/**
 * Parse to Integer data
 * @param {number|string} v
 * @return {number|string} - a parsed value or empty in case cannot be parsed
 */
const parseIntData = (v) => {
    let val = trimBoth(String(v));
    if (isEmpty(val)) {
        val = '';
    } else {
        const numVal = Number(val);
        // Reject non-whole numbers (e.g. 1.2, 1.3) instead of truncating them to an integer —
        // only values that are already whole numbers (e.g. 1, 2, 1.0, 2.0) should convert.
        if (isNaN(numVal) || !Number.isInteger(numVal)) {
            val = '';
        } else {
            val = numVal;
        }
    }
    return val;
};

/**
 * Parse to Float data
 * @param {number|string} v
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
const parseFloatData = (v) => {
    let val = trimBoth(String(v));
    if (isEmpty(val)) {
        val = '';
    } else if (val.toLowerCase() === COMMON_CONSTANT.INF.toLowerCase()) {
        val = COMMON_CONSTANT.INF.toLowerCase();
    } else if (val.toLowerCase() === COMMON_CONSTANT.MINF.toLowerCase()) {
        val = COMMON_CONSTANT.MINF.toLowerCase();
    } else {
        // TODO why do we need to re-parse?
        val = parseFloat(Number(val));
        if (isNaN(val)) {
            val = '';
        }
    }
    return val;
};

/**
 * Parse to boolean data
 * @param {number|boolean|string} v
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
const parseBooleanData = (v) => {
    let val = trimBoth(String(v));
    if (['1', 'true'].includes(val)) {
        val = 'true';
    } else if (['0', 'false'].includes(val)) {
        val = 'false';
    } else {
        val = '';
    }
    return val;
};

const isNullLike = (v) => {
    if (v === null || v === undefined) return true;
    const str = String(v).trim();
    return NORMAL_NULL_VALUES.has(str);
};

/**
 * Parse to boolean data
 * @param {number|boolean|string} v
 * @param {string} formula - available for judge columns, default is 'Pos~OK|Neg=OK|NG'
 * @return {string} - a parsed value or empty in case cannot be parsed
 */
const parseJudgeData = (v, formula = undefined) => {
    if (formula) {
        const match = formula.match(JUDGE_PATTERN_VALIDATION);
        if (!match) {
            return v;
        }

        const [, pos, posDisplay, negDisplay] = match;

        // if Pos~Null|Neg=OK|NG
        if (JUDGE_NA_VALUES.has(pos)) {
            if (isNullLike(v)) {
                return posDisplay;
            }
            return negDisplay;
        }

        if (v) {
            if (String(v) === pos) {
                return posDisplay;
            }
            return negDisplay;
        }
    }

    return trimBoth(String(v));
};

/**
 * Parse Data Type for sample data in row
 * @param {SpreadSheetProcessConfig} spreadsheet - spreadsheet
 * @param dataType
 * @param {number|string?} idx - index of row in table's body
 * @param {number} columnType - column type of row in table's body
 * @param sampleDataDisplayMode
 * @param {HTMLDivElement?} dataTypeDropdownElement - a div HTML object of datatype dropdown menu
 */
const parseDataTypeProc = async (
    spreadsheet,
    dataType,
    idx,
    columnType,
    sampleDataDisplayMode = null,
    sourceDataType = null,
) => {
    // change background color
    // changeBackgroundColor(ele);

    // Rows outside the current JSpreadsheet page are detached from tbody but
    // remain available in the table model. Resolve the row by model index so
    // parsing also works after navigating to page 2 and beyond.
    const rowElement = spreadsheet.table.getRowElementByIndex(Number(idx));
    const vals = [...rowElement.querySelectorAll('.sample-data')].map((el) => $(el));

    // only get sample which have value
    const tableId = spreadsheet.table.tableId;
    if (procSampleDataLength[tableId] && vals.length) {
        vals.length = procSampleDataLength[tableId];
    }

    const getParamsForFormatDatetime = () => {
        return {
            dataType: dataType,
            rowIdx: idx,
            isGeneratedMainDatetimeColumn: false, // TODO: Check isGeneratedMainDatetimeColumn
        };
    };

    const getAttributeName = (sampleDataDisplayMode, dataType, columnType) => {
        if (sampleDataDisplayMode === SAMPLE_DATA_DISPLAY_MODES.RECORDS) {
            return DATA_ORIGINAL_ATTR;
        } else {
            if (!isCategory(dataType, columnType)) {
                return CfgProcess_CONST.REAL_TYPES.includes(dataType) ? UNIQUE_REAL_DATA_ATTR : UNIQUE_INT_DATA_ATTR;
            } else {
                return columnType === masterDataGroup.INT_CATE ? UNIQUE_INT_CAT_DATA_ATTR : UNIQUE_CATEGORY_DATA_ATTR;
            }
        }
    };

    const attrName = getAttributeName(sampleDataDisplayMode, dataType, columnType);
    const getSourceValue = (element) => {
        let value = element.attr(attrName);
        // Bulk edits defer parsing until a row is visible, after its model datatype has already changed.
        const sampleDataType =
            attrName === DATA_ORIGINAL_ATTR ? element.attr('data-original-type') || sourceDataType : sourceDataType;
        if (sampleDataType !== DataTypes.BOOLEAN.name || sampleDataType === dataType) {
            return value;
        }

        // Registered Boolean columns are returned as true/false values. Preserve
        // their meaning when the user changes to a numeric or text data type.
        if (value === undefined || value === '') {
            value = element.text();
        }
        const booleanValue = parseBooleanData(value);
        if (NUMERIC_TYPES.includes(dataType)) {
            return booleanValue === 'true' ? '1' : booleanValue === 'false' ? '0' : '';
        }
        return booleanValue;
    };

    // Parse data using user provided formula
    let sampleDatas = vals.map((e) => e.attr(attrName));
    const formula = $(rowElement).find('.column-formula').text();

    // try to parse data using formula if it has formula
    const parseByFormula = (isJudgeFormula(columnType) || isDatetimeFormula(dataType, columnType)) && formula;
    if (parseByFormula) {
        const response = await fetch('/ap/api/setting/formula_convert', {
            method: 'POST',
            body: JSON.stringify({
                formula: formula,
                data: sampleDatas,
                col_type: columnType,
                data_type: dataType,
                is_sample_data: true,
                display_mode: sampleDataDisplayMode,
            }),
        })
            .then((res) => res.json())
            .catch((error) => {
                return {};
            });
        sampleDatas = response?.data ? response.data : sampleDatas;
    }
    // calculation results for percentiles should not be parsed
    const isRequireParsing = ![UNIQUE_INT_DATA_ATTR, UNIQUE_REAL_DATA_ATTR].includes(attrName);
    switch (dataType) {
        case DataTypes.INTEGER.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                const isBigInt = !!+e.attr('is-big-int');
                if (!isBigInt || isRequireParsing) val = parseIntData(val);
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.INTEGER_SEP.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                if (isRequireParsing) {
                    val = val.replaceAll(',', '');
                    val = parseIntData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.EU_INTEGER_SEP.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                if (isRequireParsing) {
                    val = val.replaceAll('.', '');
                    val = val.replaceAll(',', '.');
                    val = parseIntData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.REAL.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                if (isRequireParsing) {
                    val = parseFloatData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.REAL_SEP.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                if (isRequireParsing) {
                    val = val.replaceAll(',', '');
                    val = parseFloatData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.EU_REAL_SEP.name:
            for (const e of vals) {
                let val = getSourceValue(e);
                if (isRequireParsing) {
                    val = val.replaceAll('.', '');
                    val = val.replaceAll(',', '.');
                    val = parseFloatData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.DATETIME.name:
            if (parseByFormula) {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    const val = sampleDatas[idx];
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            } else {
                for (const e of vals) {
                    let val = e.attr(attrName);
                    spreadsheet.table.updateCell(e[0], val, true);
                }
                await showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            }
            break;
        case DataTypes.DATE.name:
            if (parseByFormula) {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    const val = sampleDatas[idx];
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            } else {
                for (const e of vals) {
                    let val = e.attr(attrName);
                    spreadsheet.table.updateCell(e[0], val, true);
                }
                await showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            }
            break;
        case DataTypes.TIME.name:
            if (parseByFormula) {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    const val = sampleDatas[idx];
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            } else {
                for (const e of vals) {
                    let val = e.attr(attrName);
                    spreadsheet.table.updateCell(e[0], val, true);
                }
                await showProcDatetimeFormatSampleData(spreadsheet, getParamsForFormatDatetime());
            }
            break;
        case DataTypes.BOOLEAN.name:
            if (parseByFormula) {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    const val = sampleDatas[idx];
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            } else {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    let val = e.attr(attrName);
                    val = parseBooleanData(val);
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            }
            break;

        default:
            if (parseByFormula) {
                for (let idx = 0; idx < vals.length; idx++) {
                    const e = vals[idx];
                    let val = sampleDatas[idx];
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            } else {
                for (const e of vals) {
                    let val = getSourceValue(e);
                    val = trimBoth(String(val));
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            }
            break;
    }
};

const parseProcDatetimeFormatSampleData = async (dataType, values, isImportedData = false) => {
    const condition = displayDatetimeFormatCondition();
    // IMPORTED values were already converted with the Process format, so only auto-format them
    const inputFormat = isImportedData ? '' : procModalElements.procDateTimeFormatInput.val().trim();
    const isAllEmpty = values.every((val) => val === '' || val === null);
    if (isAllEmpty) return values;
    if (condition.showRawData) {
        return values;
    } else {
        return await parseProcDatetimeInputFormat(inputFormat, dataType, values);
    }
};

const parseProcDatetimeInputFormat = async (inputFormat, dataType, values, isGeneratedMainDatetimeColumn = false) => {
    const clientTimezone = detectLocalTimezone();
    return fetch('/ap/api/setting/datetime_format', {
        method: 'POST',
        body: JSON.stringify({
            data: values,
            format: inputFormat,
            dataType: dataType,
            clientTimezone: clientTimezone,
            isGeneratedDatetime: isGeneratedMainDatetimeColumn,
        }),
    })
        .then((response) => response.json())
        .catch((res) => {
            console.log('Can not apply format');
        });
};
