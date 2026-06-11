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

declare const keyPort: (key: string) => string;

declare const goToOtherPage: (href, inplace = true, emptyPage = false, mainPage = '', useLatestSetting = false) => void;

declare const appContext: any;
