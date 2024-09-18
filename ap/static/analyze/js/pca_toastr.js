const showToastr = (errors) => {
    if (!errors) {
        return;
    }
    if (errors instanceof Array) {
        errors.forEach((error) => {
            const msgContent = `<p>${MSG_MAPPING[error] || JSON.stringify(error)}</p>`;
            showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
        });
    } else if (errors instanceof Object) {
        const trainDataErr = {
            is_err: errors.train_data.error,
            is_all_na:
                errors.train_data.errors &&
                errors.train_data.errors.includes('E_ALL_NA'),
            is_zero_var:
                errors.train_data.errors &&
                errors.train_data.errors.includes('E_ZERO_VARIANCE'),
        };
        const targetDataErr = {
            is_err: errors.target_data.error,
            is_all_na:
                errors.target_data.errors &&
                errors.target_data.errors.includes('E_ALL_NA'),
            is_zero_var:
                errors.target_data.errors &&
                errors.target_data.errors.includes('E_ZERO_VARIANCE'),
        };
        let msgContent = '';
        if (trainDataErr.is_all_na || targetDataErr.is_all_na) {
            msgContent += `<p>${MSG_MAPPING.E_ALL_NA}</p>`;
        }
        if (trainDataErr.is_zero_var || targetDataErr.is_zero_var) {
            msgContent += `<p>${MSG_MAPPING.E_ZERO_VARIANCE}</p>`;
        }
        if (!msgContent) {
            msgContent = `<p>${MSG_MAPPING.E_ALL_NA}</p>`;
        }
        showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
    } else {
        const msgContent = `<p>${MSG_MAPPING[errors] || JSON.stringify(errors)}</p>`;
        showToastrMsg(msgContent, MESSAGE_LEVEL.ERROR);
    }
};

// show toastr msg to warn about abnormal result
const showToastrDeleteNA = (dataSet, totalCount, removedCount) => {
    const i18nTexts = {
        showDeletedNA: $('#i18nDeleteNA').text() || '',
    };

    const msgContent = `${dataSet}: ${i18nTexts.showDeletedNA
        .replace('TOTAL_COUNT', totalCount)
        .replace('REMOVED_COUNT', removedCount)}`;
    const msg = `<p>${msgContent}</p>`;

    showToastrMsg(msg, MESSAGE_LEVEL.WARN);
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
        showToastrDeleteNA(
            i18n.testingData,
            numSensors * res.actual_record_number_test,
            res.removed_outlier_nan_test,
        );
    }
};
