export interface DataTypeShortSource {
    datatype?: string | null;
    type?: string | null;
    column_type?: number | null;
    is_serial_no?: boolean;
    is_judge?: boolean;
    is_int_category?: boolean;
}

export type VariableSelectPageType =
    | 'fpp'
    | 'rlp'
    | 'skd'
    | 'wfp'
    | 'hmp'
    | 'scp'
    | 'agp'
    | 'map'
    | 'gl'
    | 'stp'
    | 'msp'
    | 'chm'
    | 'pcp'
    | 'pca';

const BOOLEAN_COLUMN_TYPE = 77;
const FILTER_SUPPORTED_DATA_TYPES = ['INTEGER', 'INTEGER_SEP', 'EU_INTEGER_SEP', 'STRING', 'TEXT'];
const WFP_COLOR_SUPPORTED_COLUMN_TYPES = ['Cat', 'Seri', 'Str', 'Judge'];
const AGP_COLOR_OPTION_DATA_TYPES = [
    'INTEGER',
    'INTEGER_SEP',
    'EU_INTEGER_SEP',
    'STRING',
    'TEXT',
    'CATEGORY',
    'INTEGER_CAT',
];
const GL_SUPPORTED_DATA_TYPES = [
    'INTEGER',
    'REAL',
    'REAL_SEP',
    'INTEGER_SEP',
    'EU_REAL_SEP',
    'EU_INTEGER_SEP',
    'DATETIME',
    'DATE',
    'TIME',
];
const PLOT_EXCLUDED_COLUMN_TYPES: Partial<Record<VariableSelectPageType, readonly string[]>> = {
    wfp: ['Seri', 'Judge'],
    rlp: ['Seri', 'Judge'],
    skd: ['Seri'],
    pca: ['Seri', 'Judge'],
    hmp: ['Seri', 'Real', 'CT'],
    gl: ['Seri', 'Str', 'Judge'],
};

const DATA_TYPE_SHORT_LABELS: Record<string, string> = {
    NONE: 'NONE',
    INTEGER: 'Int',
    INTEGER_CAT: 'Int(Cat)',
    REAL: 'Real',
    STRING: 'Str',
    TEXT: 'Str',
    DATETIME: 'CT',
    DATE: 'Date',
    TIME: 'Time',
    REAL_SEP: 'Real_Sep',
    INTEGER_SEP: 'Int_Sep',
    EU_REAL_SEP: 'EU_Real_Sep',
    EU_INTEGER_SEP: 'EU_Int_Sep',
    BIG_INT: 'BIG_INT',
    BIGINT: 'BIGINT',
    CATEGORY: 'Cat',
    BOOLEAN: 'Bool',
};

const DATA_TYPE_I18N_KEYS: Record<string, string> = {
    INTEGER: 'Integer',
    INTEGER_CAT: 'Integer(Cat)',
    REAL: 'Real',
    STRING: 'String',
    TEXT: 'String',
    DATETIME: 'Datetime',
    DATE: 'main::Date',
    TIME: 'main::Time',
    REAL_SEP: 'K sep: Real',
    INTEGER_SEP: 'K sep: Int',
    EU_REAL_SEP: 'K sep: EU Real',
    EU_INTEGER_SEP: 'K sep: EU int',
    BOOLEAN: 'Boolean',
    CATEGORY: 'CategoryOutput',
};

// These values mirror the masterDataGroup column types used by data_type_dropdown.
const DATA_GROUP_TYPE_I18N_KEYS: Record<number, string> = {
    1: 'main::Datetime',
    4: 'Datetime:key',
    7: 'main::Date',
    8: 'main::Time',
    10: 'Integer(Cat)',
    19: 'Process:Str',
    20: 'LineName:Str',
    21: 'LineNo:Int',
    22: 'EqName:Str',
    23: 'EqNo:Int',
    24: 'PartName:Str',
    25: 'PartNo:Int',
    26: 'StNo:Int',
    76: 'Judge',
};

export function showDataTypeShort(col: DataTypeShortSource): string {
    if (col.is_serial_no) {
        return 'Seri';
    }

    if (col.column_type === BOOLEAN_COLUMN_TYPE) {
        return 'Bool';
    }

    if (col.is_judge) {
        return 'Judge';
    }

    if (col.is_int_category && !col.is_serial_no) {
        return 'Cat';
    }

    const dataType = (col.datatype || col.type || '').trim().toUpperCase();
    return dataType ? DATA_TYPE_SHORT_LABELS[dataType] || dataType : '';
}

export function getDataTypeI18nKey(dataType: string, columnType?: number | null): string {
    const normalizedDataType = dataType.trim().toUpperCase();

    if (columnType === 2) {
        return normalizedDataType === 'TEXT' || normalizedDataType === 'STRING'
            ? 'main::Serial:Str'
            : 'main::Serial:Int';
    }

    if (columnType === 3) {
        return normalizedDataType === 'TEXT' || normalizedDataType === 'STRING' ? 'Serial:Str' : 'Serial:Int';
    }

    return (
        (columnType != null && DATA_GROUP_TYPE_I18N_KEYS[columnType]) ||
        DATA_TYPE_I18N_KEYS[normalizedDataType] ||
        dataType
    );
}

export function canShowFilterCheckbox(col: DataTypeShortSource): boolean {
    const dataType = getNormalizedDataType(col);
    return FILTER_SUPPORTED_DATA_TYPES.includes(dataType);
}

/**
 * Whether the Variable Select row shows the Plot checkbox.
 */
export function canShowPlotCheckbox(pageType: VariableSelectPageType, col: DataTypeShortSource): boolean {
    return !(PLOT_EXCLUDED_COLUMN_TYPES[pageType] || []).includes(showDataTypeShort(col));
}

export function canUseAgpColorDropdownOption(col: DataTypeShortSource): boolean {
    // Include serial number (seri) type
    if (col.is_serial_no) {
        return true;
    }
    return AGP_COLOR_OPTION_DATA_TYPES.includes(getNormalizedDataType(col));
}

// Mirrors isCategory() in ap/static/common/js/base.js, which the MAP end process cell uses to
// decide whether the i-Main layout field is selectable. DataTypes.STRING.name is 'TEXT';
// 'STRING' is accepted as its stored alias. is_int_category / is_judge are already resolved
// by the backend, so they are reused instead of re-deriving them from column_type.
const CATEGORY_DATA_TYPES = ['DATETIME', 'TEXT', 'STRING', 'BOOLEAN', 'JUDGE'];

export function isCategoryColumn(col: DataTypeShortSource): boolean {
    return (
        CATEGORY_DATA_TYPES.includes(getNormalizedDataType(col)) ||
        Boolean(col.is_judge) ||
        Boolean(col.is_int_category) ||
        col.column_type === BOOLEAN_COLUMN_TYPE
    );
}

function getNormalizedDataType(col: DataTypeShortSource): string {
    return (col.datatype || col.type || '').trim().toUpperCase();
}

export function canShowPageTypeControl(pageType: VariableSelectPageType, col: DataTypeShortSource): boolean {
    if (
        pageType === 'hmp' ||
        pageType === 'scp' ||
        pageType === 'agp' ||
        pageType === 'rlp' ||
        pageType === 'skd' ||
        pageType === 'map'
    ) {
        return true;
    }

    if (pageType === 'fpp') {
        const dataType = getNormalizedDataType(col);
        return FILTER_SUPPORTED_DATA_TYPES.includes(dataType);
    }

    if (pageType === 'wfp') {
        return WFP_COLOR_SUPPORTED_COLUMN_TYPES.includes(showDataTypeShort(col));
    }

    if (pageType === 'gl') {
        if (col.is_serial_no || col.is_int_category) {
            return false;
        }
        return GL_SUPPORTED_DATA_TYPES.includes(getNormalizedDataType(col));
    }

    return true;
}
