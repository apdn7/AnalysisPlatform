const changeSampleDataDisplayMode = (e) => {
    const sampleDataDisplayMode = e.value;
    const spreadsheet = getSpreadSheetFromToolsBarElement(e);
    spreadsheet.updateSampleDataByDisplayMode(spreadsheet, sampleDataDisplayMode);
};
