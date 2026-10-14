const changeSampleDataDisplayMode = async (e) => {
    const sampleDataDisplayMode = e.value;
    const spreadsheet = getSpreadSheetFromToolsBarElement(e);
    if (sampleDataDisplayMode === SAMPLE_DATA_DISPLAY_MODES.UNIQUE) {
        await ensureUniqueSampleData(spreadsheet);
    }
    SpreadSheetProcessConfig.updateSampleDataByDisplayMode(spreadsheet, sampleDataDisplayMode);
};
