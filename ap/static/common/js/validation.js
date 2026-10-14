let uniqueRequiredArr = [];
let requiredInputs = null;
let invalids = [];
let currentFormID = '';
let checkObjectiveVar = true; // option to validate objective var
let initialValidationTimeout = null;

function findValidationInputs(selector, root = currentFormID) {
    const $root = $(root);
    const inputs = new Set($root.find(selector).toArray());
    // Virtual rows keep their controls and values even while detached from the form.
    $root.find('[data-virtualized="true"]').each((_, list) => {
        list._virtualList?.querySelectorAll(selector).forEach((input) => inputs.add(input));
    });
    return $([...inputs]);
}

function getUniqueRequiredArr() {
    const uniqueNames = [];
    return requiredInputs
        .map((i, el) => {
            if (el.name === 'objectiveVar' && !checkObjectiveVar) {
                return null;
            }
            if (uniqueNames.indexOf(el.name) === -1) {
                uniqueNames.push(el.name);
                const type = el.tagName === 'INPUT' ? el.type : null;
                return {
                    tagName: el.tagName,
                    name: el.name,
                    id: el.id,
                    type,
                };
            }
            return null;
        })
        .filter((v) => v !== null);
}

function setClass(selector, className) {
    findValidationInputs(selector).addClass(className);
}

function getValueSelect(name) {
    return findValidationInputs(`select[name=${name}]`).children('option:selected').val();
}

function getValueCheckbox(name) {
    return findValidationInputs(`input[type=checkbox][name=${name}]:checked`).val();
}

function getValueText(name) {
    return findValidationInputs(`input[type=text][name=${name}]`).val();
}

function getValueRadio(name) {
    return findValidationInputs(`input[type=radio][name=${name}]:checked`).val();
}

function getValueInputByType(type, name) {
    if (type === 'checkbox') {
        return getValueCheckbox(name);
    }
    if (type === 'radio') {
        return getValueRadio(name);
    }
    return getValueText(name);
}

function checkValidations(minMaxNumOfEndproc = null, formID = '') {
    invalids = [];
    if (formID) {
        currentFormID = formID;
    }

    requiredInputs = findValidationInputs('.required-input:not(select[name=catExpBox])');

    uniqueRequiredArr = getUniqueRequiredArr();

    for (const ob of uniqueRequiredArr) {
        let value = null;

        if (ob.tagName === 'SELECT') {
            value = getValueSelect(ob.name);
        } else {
            value = getValueInputByType(ob.type, ob.name);
        }
        if (!value) {
            if (/VALS_SELECT/.test(ob.name) || /end_proc/.test(ob.name)) {
                if (!checkRelatedVariablesOfProcess(ob.name)) invalids.push({ name: ob.name, id: ob.id });
            } else {
                invalids.push({ name: ob.name, id: ob.id });
            }
        }
    }

    if (minMaxNumOfEndproc) {
        return invalids.length <= 0 && validateSelectedNumberOfEndProcs(minMaxNumOfEndproc);
    }

    return invalids.length <= 0;
}

function updateStyleButtonByCheckingValid(isExternalValid = undefined) {
    const btn = $(currentFormID).find(':button.show-graph');
    btn.removeAttr('disable');
    btn.removeAttr('style');
    const isValid = (isExternalValid !== undefined ? isExternalValid : checkValidations()) && checkHasDiv();
    if (!isValid) {
        btn.addClass('btn-secondary');
        btn.removeClass('btn-primary valid-show-graph');
    } else {
        btn.addClass('btn-primary valid-show-graph');
        btn.removeClass('btn-secondary');
        // update validation message after reselect an objective variable
        const $endProcDiv = $('.end-proc');
        const isInvalidMsgShown = $endProcDiv.hasClass('invalid');
        if (isInvalidMsgShown) {
            $endProcDiv.removeClass('invalid').removeClass('invalid-message');
        }
    }
}

const checkHasDiv = () => {
    const inputs = findValidationInputs('select[name=catExpBox]');
    return !inputs.hasClass('required-input') || inputs.toArray().some((input) => input.value === '3');
};

function onchangeRequiredInput() {
    const formID = currentFormID;
    requiredInputs = findValidationInputs('.required-input');
    requiredInputs.off('change.showGraphValidation').on('change.showGraphValidation', (el) => {
        if (currentFormID !== formID) return;
        compareSettingChange();
        setTimeout(() => {
            if (currentFormID !== formID) return;
            updateStyleButtonByCheckingValid();
            const dataIdToEnableCTTime = $(formElements.showCT_Time).data('target-id-to-enable-ct');
            // First condition: check for individual checkboxes
            // Second condition: when all checkboxes are checked, only the event for check-all checkbox occurs
            // TODO: Can we refactor this?
            if (
                (dataIdToEnableCTTime && el.currentTarget?.id === dataIdToEnableCTTime) ||
                el.currentTarget?.id.includes('checkbox-all-end-proc-val')
            ) {
                enableCycleTimeAnalysis();
            }
        }, 300);
    });
    updateStyleButtonByCheckingValid();
}

function checkRelatedVariablesOfProcess(name) {
    const index = name.match(/\d+/g).at(-1);
    const parent = $(currentFormID).find(`#end-proc-process-div-${index}-parent`);
    const hasCatExp = findValidationInputs('[name=catExpBox]', parent)
        .toArray()
        .some((input) => !!input.value);
    const hasLabel = findValidationInputs(`[name=GET02_CATE_SELECT${index}]:checked`).length > 0;
    const hasColor = findValidationInputs('[name=colorVar]:checked', parent).length > 0;
    //end_proc
    const atLeastOneColumn = findValidationInputs('input[name^=GET02_VALS_SELECT]:checked').length > 0;

    return hasCatExp || hasLabel || hasColor || atLeastOneColumn;
}

function updateStyleOfInvalidElements() {
    updateStyleButtonByCheckingValid();
    findValidationInputs('.invalid').removeClass('invalid invalid-message');
    for (let i = 0; i < invalids.length; i++) {
        const { name, id } = invalids[i];
        if (/VALS_SELECT/.test(name)) {
            const index = name.match(/\d+/g);
            setClass(`#end-proc-process-div-${index[1]}-parent`, 'invalid');
        } else if (/end_proc/.test(name) && !/end_proc_cate/.test(name)) {
            const index = name.match(/\d+/g);
            setClass(`#end-proc-process-div-${index}-parent`, 'invalid');
        } else if (/CATE_SELECT/.test(name)) {
            const index = name.match(/\d+/g);
            setClass(`#end-proc-process-cate-div-${index[1]}-parent`, 'invalid');
        } else if (/end_proc_cate/.test(name) || /categoryVariable/.test(name)) {
            const index = name.match(/\d+/g);
            setClass(`#end-proc-process-cate-div-${index}-parent`, 'invalid');
        } else {
            setClass(`[name="${name}"]`, 'invalid');
        }

        if (name === 'objectiveVar' && checkObjectiveVar) {
            const parentEl = $(currentFormID)
                .find('.card.end-proc')
                .filter((_, card) => findValidationInputs(`#${id}`, card).length > 0);
            parentEl.addClass('invalid invalid-message');
            parentEl.attr('data-content', $('#i18nInvalidObjectiveVar').text());
        }
    }
    if (invalids.length) {
        $('html, body').animate(
            {
                scrollTop: $(currentFormID).find('.invalid').offset().top - 100,
            },
            300,
        );
    }
}

function initValidation(formID = '', isCheckObjectiveVar = true) {
    checkObjectiveVar = isCheckObjectiveVar;
    clearTimeout(initialValidationTimeout);
    if (formID) {
        currentFormID = formID;
        $(formID)
            .off('submit.showGraphValidation')
            .on('submit.showGraphValidation', function (e) {
                e.preventDefault();
            });
    }

    const validationFormID = currentFormID;
    $(validationFormID)
        .off('virtualListUpdated.showGraphValidation')
        .on('virtualListUpdated.showGraphValidation', () => {
            if (currentFormID !== validationFormID) return;
            onchangeRequiredInput();
        });
    onchangeRequiredInput();
    initialValidationTimeout = setTimeout(() => {
        if (currentFormID !== validationFormID) return;
        updateStyleButtonByCheckingValid();
    }, 2000);
}

function setCurrentForm(formID) {
    currentFormID = formID;
    initValidation(currentFormID);
}

function validateSelectedNumberOfEndProcs(minMaxNumOfEndproc) {
    const { min, max } = minMaxNumOfEndproc;
    const form = $(currentFormID);
    const formData = new FormData(form[0]);
    const endProcs = [];

    for (const item of formData.entries()) {
        const key = item[0];
        const value = item[1];
        if (/GET02_VALS_SELECT/.test(key)) {
            if (value !== 'All') {
                endProcs.push(value);
            }
        }
    }

    if (min && max) {
        if (endProcs.length < min || endProcs.length > max) {
            showToastrMsg(
                i18nCommon.availableSelectMinMaxSensor.replace('MIN', min).replace('MAX', max),
                MESSAGE_LEVEL.ERROR,
            );

            return false;
        }
    }

    if (!min && max) {
        if (endProcs.length > max) {
            showToastrMsg(i18nCommon.availableSelectMaxSensor.replace('MAX', max), MESSAGE_LEVEL.ERROR);
            return false;
        }
    }

    return true;
}

function updateBtnStyleWithValidation(btnDOM = '', isValid = true) {
    // set data attr to submit
    $(btnDOM).attr('data-has-ct', isValid);
    // change color for submit button
    if (!isValid) {
        btnDOM.addClass('btn-secondary');
        btnDOM.removeClass('btn-primary');
        btnDOM.prop('disabled', true);
    } else {
        btnDOM.addClass('btn-primary');
        btnDOM.removeClass('btn-secondary');
        btnDOM.prop('disabled', false);
    }
}

// function onchangeRequiredInput() {
//     requiredInputs = $(currentFormID).find('.required-input');
//     requiredInputs.change((el) => {
//         compareSettingChange();
//         setTimeout(() => {
//             updateStyleButtonByCheckingValid();
//         }, 300);
//     });
// }

const enableCycleTimeAnalysis = () => {
    if ($(formElements.showCT_Time).length) {
        if ($(formElements.showCT_Time)[0].ready === true) {
            $(formElements.showCT_Time).attr('disabled', false);
            $(formElements.showCT_Time)[0].ready = null;
        }
    }
};
