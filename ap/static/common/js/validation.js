let uniqueRequiredArr = [];
let requiredInputs = null;
let invalids = [];
let currentFormID = '';
let checkObjectiveVar = true; // option to validate objective var

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
    $(currentFormID).find(selector).addClass(className);
}

function getValueSelect(name) {
    return $(currentFormID)
        .find(`select[name=${name}]`)
        .children('option:selected')
        .val();
}

function getValueCheckbox(name) {
    return $(currentFormID)
        .find(`input[type=checkbox][name=${name}]:checked`)
        .val();
}

function getValueText(name) {
    return $(currentFormID).find(`input[type=text][name=${name}]`).val();
}

function getValueRadio(name) {
    return $(currentFormID)
        .find(`input[type=radio][name=${name}]:checked`)
        .val();
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

    requiredInputs = $(currentFormID).find('.required-input');

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
                if (!checkRelatedVariablesOfProcess(ob.name))
                    invalids.push({ name: ob.name, id: ob.id });
            } else {
                invalids.push({ name: ob.name, id: ob.id });
            }
        }
    }

    if (minMaxNumOfEndproc) {
        return (
            invalids.length <= 0 &&
            validateSelectedNumberOfEndProcs(minMaxNumOfEndproc)
        );
    }

    return invalids.length <= 0;
}

function updateStyleButtonByCheckingValid() {
    const btn = $(currentFormID).find(':button.show-graph');
    btn.removeAttr('disable');
    btn.removeAttr('style');
    const isValid = checkValidations();
    if ($(formElements.showCT_Time).length) {
        if ($(formElements.showCT_Time)[0].ready === true) {
            $(formElements.showCT_Time).attr('disabled', false);
            $(formElements.showCT_Time)[0].ready = null;
        }
    }
    if (!isValid) {
        btn.addClass('btn-secondary');
        btn.removeClass('btn-primary valid-show-graph');
    } else {
        btn.addClass('btn-primary valid-show-graph');
        btn.removeClass('btn-secondary');
    }
}

function onchangeRequiredInput() {
    requiredInputs = $(currentFormID).find('.required-input');
    requiredInputs.change((el) => {
        compareSettingChange();
        setTimeout(() => {
            updateStyleButtonByCheckingValid();
        }, 300);
    });
}

function checkRelatedVariablesOfProcess(name) {
    const index = name.match(/\d+/g);
    const parent = $(`#end-proc-process-div-${index[1]}-parent`);
    const hasCatExp = parent.find('[name=catExpBox]').val();
    const hasLabel =
        $(`[name=GET02_CATE_SELECT${index[1]}]:checked`).length > 0;
    const hasColor = parent.find('[name=colorVar]:checked').length > 0;
    //end_proc
    const atLeastOneColumn =
        $('input[name^=GET02_VALS_SELECT]:checked').length > 0;

    return hasCatExp || hasLabel || hasColor || atLeastOneColumn;
}

function updateStyleOfInvalidElements() {
    updateStyleButtonByCheckingValid();
    $(currentFormID).find('.invalid').removeClass('invalid');
    $(currentFormID).find('.invalid').removeClass('invalid-message');
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
            setClass(
                `#end-proc-process-cate-div-${index[1]}-parent`,
                'invalid',
            );
        } else if (
            /end_proc_cate/.test(name) ||
            /categoryVariable/.test(name)
        ) {
            const index = name.match(/\d+/g);
            setClass(`#end-proc-process-cate-div-${index}-parent`, 'invalid');
        } else {
            const target = document.getElementsByName(name);
            setClass(target, 'invalid');
        }

        if (name === 'objectiveVar' && checkObjectiveVar) {
            const parentEl = $(`#${id}`).closest('.card.end-proc');
            const parentId = $(`#${id}`).closest('.card.end-proc').attr('id');
            setClass(`#${parentId}`, 'invalid invalid-message');
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
    if (formID) {
        currentFormID = formID;
        $(formID).submit(function (e) {
            e.preventDefault();
        });
    }

    updateStyleButtonByCheckingValid();
    setTimeout(() => {
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
                i18nCommon.availableSelectMinMaxSensor
                    .replace('MIN', min)
                    .replace('MAX', max),
                MESSAGE_LEVEL.ERROR,
            );

            return false;
        }
    }

    if (!min && max) {
        if (endProcs.length > max) {
            showToastrMsg(
                i18nCommon.availableSelectMaxSensor.replace('MAX', max),
                MESSAGE_LEVEL.ERROR,
            );
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
    } else {
        btnDOM.addClass('btn-primary');
        btnDOM.removeClass('btn-secondary');
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
