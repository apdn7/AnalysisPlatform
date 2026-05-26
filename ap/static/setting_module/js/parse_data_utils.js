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
        val = parseInt(Number(val));
        if (isNaN(val)) {
            val = '';
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
const parseDataTypeProc = async (spreadsheet, dataType, idx, columnType, sampleDataDisplayMode = null) => {
    // change background color
    // changeBackgroundColor(ele);

    const vals = [...$(`#${spreadsheet.table.table.el.id}`).find(`tr:eq(${Number(idx) + 1}) .sample-data`)].map((el) =>
        $(el),
    );
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

    // Parse data using user provided formula
    let sampleDatas = vals.map((e) => e.attr(attrName));
    const formula = $(`#${spreadsheet.table.table.el.id}`)
        .find(`tr:eq(${Number(idx) + 1}) .column-formula`)
        .text();

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
                let val = e.attr(attrName);
                const isBigInt = !!+e.attr('is-big-int');
                if (!isBigInt || isRequireParsing) val = parseIntData(val);
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.INTEGER_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                if (isRequireParsing) {
                    val = val.replaceAll(',', '');
                    val = parseIntData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.EU_INTEGER_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
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
                let val = e.attr(attrName);
                if (isRequireParsing) {
                    val = parseFloatData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.REAL_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
                if (isRequireParsing) {
                    val = val.replaceAll(',', '');
                    val = parseFloatData(val);
                }
                spreadsheet.table.updateCell(e[0], val, true);
            }
            break;
        case DataTypes.EU_REAL_SEP.name:
            for (const e of vals) {
                let val = e.attr(attrName);
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
                    let val = e.attr(attrName);
                    val = trimBoth(String(val));
                    spreadsheet.table.updateCell(e[0], val, true);
                }
            }
            break;
    }
};

const parseProcDatetimeFormatSampleData = async (dataType, values) => {
    const condition = displayDatetimeFormatCondition();
    const inputFormat = procModalElements.procDateTimeFormatInput.val().trim();
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
