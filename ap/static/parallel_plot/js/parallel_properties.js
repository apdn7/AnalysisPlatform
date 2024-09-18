class ParallelProps {
    constructor() {}
    static showVariables = {
        ALL: 'all',
        REAL: 'real',
        CATEGORY: 'category',
        NUMBER: 'number',
        CATEGORIZED: 'categorized_real',
    };
    // static corrOrdering = {
    //     orderBy: ['correlation', 'top'],
    //     corrValue: ['corr_value', 'max_vars'],
    //     orderLim: ['top_vars'],
    //     all: ['correlation', 'top', 'corr_value', 'max_vars', 'top_vars'],
    // }
    static orderBy = {
        selected_order: 'selected_order',
        setting: 'setting',
        process: 'process',
        correlation: 'correlation',
    };

    static realTypes = [
        DataTypes.REAL.name,
        DataTypes.REAL_SEP.name,
        DataTypes.EU_REAL_SEP.name,
    ];
    static intTypes = [
        DataTypes.INTEGER.name,
        DataTypes.INTEGER_SEP.name,
        DataTypes.EU_INTEGER_SEP.name,
        DataTypes.BIG_INT.name,
    ];
    static catTypes = [DataTypes.STRING.name];
    static datetimeType = [DataTypes.DATETIME.name];
    // valid data types init
    static validDataTypes = {
        all: [
            ...this.realTypes,
            ...this.intTypes,
            ...this.catTypes,
            ...this.datetimeType,
        ],
        real: this.realTypes,
        number: [...this.realTypes, ...this.intTypes],
        category: [...this.catTypes, ...this.intTypes],
        categorized_real: [
            ...this.realTypes,
            ...this.intTypes,
            ...this.catTypes,
        ],
        datetime: [...this.datetimeType],
    };

    // sort value setting
    static valueOrder = {
        DESC: 'desc',
        ASC: 'asc',
    };
}
