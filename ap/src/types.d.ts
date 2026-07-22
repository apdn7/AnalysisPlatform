declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    const value: string;
    export default value;
}

declare const require: {
    context: (
        path: string,
        deep?: boolean,
        filter?: RegExp,
    ) => {
        keys: () => string[];
        <T>(id: string): T;
    };
};

// define some old global js function so tsx can understand
declare const sidebarCollapse: () => void;

declare const sidebarCollapseHandle: () => void;

declare const setUpEvents: () => void;

declare const DATETIME_PICKER_SEPARATOR: string;

declare const latestSortColIds: Array<string>;

declare let mainDataFinder: any;

declare const initializeDateTimePicker: (dtId: any = null, isClassName: boolean = false) => void;

declare const initializeDateTimeRangePicker: (dtId: any = null, isClassName: boolean = false) => void;

declare const keyPort: (key: string) => string;

declare const goToOtherPage: (href, inplace = true, emptyPage = false, mainPage = '', useLatestSetting = false) => void;

declare const handleChangeInterval: (event: unknown, to: string) => void;

declare const getExportDetails: () => any;

declare const getExportFilterDetails: () => any;

declare const getCleansingOption: () => any;

declare const detectLocalTimezone: () => string;

declare const getStartProcId: () => string;

declare const trimQuotesSpacesAndUpdate: (inputEl: any = '') => any;

declare const MAX_NUMBER_OF_SENSOR: number;

declare const checkValidations: (minMaxNumOfEndproc: any = null, formID = '') => boolean;

declare var $: any;

declare const appContext: any;

declare const showHideShutDownButton: () => void;
