/* eslint-disable no-undef */

const isInteger = (x) => {
    let value = x;
    if (typeof value === 'string' && /^\s*(\+|-)?\d+\s*$/.test(value)) {
        value = Number(value);
    }
    if (typeof value === 'number') {
        return value === Math.floor(value);
    }
    return false;
};

// eslint-disable-next-line no-restricted-globals
const isNumber = value => !isNaN(value);

const predictValueDatatype = (value) => {
    if (isEmpty(value)) return DataTypes.NONE.value;
    if (isInteger(value)) return DataTypes.INTEGER.value;
    if (isNumber(value)) return DataTypes.REAL.value;

    const parsedDate = moment(value);
    if (parsedDate && parsedDate.isValid()) {
        return DataTypes.DATETIME.value;
    }
    if (typeof value === 'string') return DataTypes.STRING.value;

    return DataTypes.NONE.value;
};

// eslint-disable-next-line no-unused-vars
const predictDatatypes = (csvData) => {
    if (isEmpty(csvData)) return [];

    const { header, content } = csvData;
    if (isEmpty(header) || isEmpty(content)) return [];

    const columnWithDatatype = {};
    const columnDatatype = [];
    header.forEach((col, colIndex) => {
        columnWithDatatype[col] = DataTypes.NONE.value;
        columnDatatype[colIndex] = DataTypes.NONE.value;
    });

    content.forEach((row) => {
        const rowArray = [].concat(row);
        if (!isEmpty(row) && row.length === header.length) {
            rowArray.forEach((field, fieldIndex) => {
                // predict datatype
                const predictiveDatatype = predictValueDatatype(field);

                // compare datatypes and decide
                const currentDatatype = columnDatatype[fieldIndex];
                if (!isEmpty(predictiveDatatype) && predictiveDatatype > currentDatatype) {
                    columnDatatype[fieldIndex] = predictiveDatatype;
                }
            });
        }
    });

    header.forEach((col, colIndex) => {
        columnWithDatatype[col] = columnDatatype[colIndex];
    });

    return columnWithDatatype;
};
