
const showToastr = (errors) => {
    if (!errors) {
        return;
    }
    if (errors instanceof Array) {
        errors.forEach((error) => {
            const msgTitle = `${i18n.error}`;
            const msgContent = `<p>${MSG_MAPPING[error] || JSON.stringify(error)}</p>`;
            showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.ERROR);
        });
    } else {
        const msgTitle = `${i18n.error}`;
        const msgContent = `<p>${MSG_MAPPING[errors] || JSON.stringify(errors)}</p>`;
        showToastrMsg(msgContent, msgTitle, MESSAGE_LEVEL.ERROR);
    }
};

// show toastr msg to warn about abnormal result
const showToastrDeleteNA = (dataSet, totalCount, removedCount) => {
    const i18nTexts = {
        warningTitle: $('#i18nWarningTitle').text(),
        showDeletedNA: $('#i18nDeleteNA').text() || '',
    };

    const msgTitle = i18nTexts.warningTitle || '注意';
    const msgContent = `${dataSet}: ${i18nTexts.showDeletedNA
        .replace('TOTAL_COUNT', totalCount)
        .replace('REMOVED_COUNT', removedCount)}`;
    const msg = `<p>${msgContent}</p>`;

    showToastrMsg(msg, msgTitle, MESSAGE_LEVEL.WARN);
};

const showAllDeleteNAToastrMsgs = (res, formData) => {
    const numSensors = countSelectedSensors(formData) || 1;
    if (res.removed_outlier_nan_train) {
        showToastrDeleteNA(
            i18n.trainingData,
            numSensors * res.actual_record_number_train,
            res.removed_outlier_nan_train,
        );
    }
    if (res.removed_outlier_nan_test) {
        showToastrDeleteNA(i18n.testingData,
            numSensors * res.actual_record_number_test,
            res.removed_outlier_nan_test);
    }
};
