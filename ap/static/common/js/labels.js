/**
 * @description State of labels true: show, false: hide
 * @example {'CSV': true, 'SQLITE': false }
 */
let labelState = {};
const labelElements = {
    processLabelList: '.process-label-list',
    processLabel: '.process-label',
    labelSearchInput: '#tblProcConfig th.search-box:eq(6) input',
    clearLabelBtn: '.clear-label-btn',
};
const getLabelStateFromLocalStorage = () => {
    const labelsState = JSON.parse(localStorage.getItem('labelState') ?? '{}');
    if (Object.keys(labelsState).length) {
        return labelsState;
    }
    return {};
};

const saveLabelStateInLocalStorage = () => {
    Object.keys(labelState).forEach((label) => {
        if (!labelState[label]) {
            delete labelState[label];
        }
    });
    localStorage.setItem('labelState', JSON.stringify(labelState));
};

/**
 * @description Filter process config object by labels from labelState in localstorage
 * @param procConfigsList
 * @returns {{}}
 */
const filterProcessConfigPlain = (procConfigsList) => {
    const procConfigs = {};
    for (let procConfig of procConfigsList) {
        if (isShowAllLabelsInUse()) {
            procConfigs[procConfig.id] = procConfig;
        } else if (procConfig.labels.filter((label) => labelState[label.name]).length > 0) {
            procConfigs[procConfig.id] = procConfig;
        }
    }
    return procConfigs;
};

const filterTraceProcessConfig = (procConfigsList) => {
    return procConfigsList.map((procConfig) => {
        const newProcConfig = { ...procConfig, hidden: true };
        if (isShowAllLabelsInUse()) {
            newProcConfig.hidden = false;
        } else if (newProcConfig.labels.filter((label) => labelState[label.name]).length > 0) {
            newProcConfig.hidden = false;
        }
        return newProcConfig;
    });
};

const getInUseLabelsFromDb = async () => {
    return await fetchData('/ap/api/setting/labels_in_use', {}, 'GET');
};

const getAllLabelsFromDb = async () => {
    return await fetchData('/ap/api/setting/labels', {}, 'GET');
};

/**
 * @description show all a list of labels
 * @returns {Promise<void>}
 */

const showAllLabelsInUse = async () => {
    const labels = await getInUseLabelsFromDb();
    labelState = getLabelStateFromLocalStorage();
    removeUnusedLabels(labels);
    const labelList = $(labelElements.processLabelList);
    // Remove only labels, keep the clear button
    labelList.find(labelElements.processLabel).remove();
    const labelsEls = labels
        .map((label) => {
            const isActive = labelState[label.name];
            return `<span data-name="${label.name}" class="process-label ${isActive ? 'active' : ''}">${label.name}</span>`;
        })
        .join('');
    // Append labels after the clear button
    labelList.append(labelsEls);

    // hide search input (this filter by input search of label column but the input is hidden)
    $(labelElements.labelSearchInput).attr('search-type', 'label');
    $(labelElements.labelSearchInput).hide();

    $(labelElements.processLabel).on('click', (e) => {
        const target = e.currentTarget;
        const label = target.textContent;

        toggleClassActiveLabel(target);
        const isActive = $(target).hasClass('active');
        const otherLabels = $(`.process-label[data-name="${label}"]`);
        otherLabels.toggleClass('active', isActive);
        labelState[label] = isActive;

        saveLabelStateInLocalStorage();
        filterProcessByLabels();
    });

    // Setup clear button
    $(labelElements.clearLabelBtn).on('click', () => {
        labelState = {};
        $(labelElements.processLabel).removeClass('active');
        saveLabelStateInLocalStorage();
        filterProcessByLabels();
    });

    filterProcessByLabels();
};

const toggleClassActiveLabel = (el) => {
    $(el).toggleClass('active');
};

/**
 * @description Add a label to the list if it doesn't exist.
 * @param {string} labelName - The name of the label to add.
 */
const addLabelIfNotExist = (labelName) => {
    let labelElement = $(`${labelElements.processLabelList} ${labelElements.processLabel}[data-name="${labelName}"]`);

    // If the label is not found in the list, add it to the list
    if (labelElement.length === 0) {
        const newLabelHtml = `<span data-name="${labelName}" class="process-label">${labelName}</span>`;
        $(labelElements.processLabelList).append(newLabelHtml);

        labelElement = $(labelElements.processLabelList).find(`.${labelName}`);
    }

    return labelElement;
};

/**
 * @description Activate a label, even if it's already active.
 * @param {string} labelName - The name of the label to be activated.
 */
const activateLabel = (labelName) => {
    let labelElement = $(`${labelElements.processLabelList} ${labelElements.processLabel}[data-name="${labelName}"]`);

    if (labelElement.length === 0) {
        return;
    }

    labelElement.addClass('active');
    // Update the label state as active (true)
    labelState = getLabelStateFromLocalStorage();
    labelState[labelName] = true;
    saveLabelStateInLocalStorage();
};

/**
 * @description filter process by labels
 */
const filterProcessByLabels = () => {
    const regex = /^\/ap\/config(?!\/)/;
    if (regex.test(window.location.pathname)) {
        filterListOfProcessInTable();
        // reload trace config in vis network
        const traceConfigs = filterTraceProcessConfig(fullProcessConfig);
        reloadTraceConfig(traceConfigs, false);
    } else if (PAGES.includes(getCurrentPage())) {
        updateProcessListAfterFilter('', procConfigs);
    }
};

/**
 * @description This function is filter process of table tblProcConfig
 */
const filterListOfProcessInTable = () => {
    const labels = new Set();
    $(`${labelElements.processLabel}.active`).each((i, el) => {
        labels.add($(el).text());
    });
    // filter by input filter of label column
    $(labelElements.labelSearchInput)
        .val([...labels].join('|'))
        .trigger('change');
};

/**
 * @description Check cases of show all labels if the first time load app then labelState is null -> show all
 * @description LabelState have and all labels are false -> show all
 * @returns {boolean}
 */
const isShowAllLabelsInUse = () => {
    const labelState = getLabelStateFromLocalStorage();
    return !Object.keys(labelState).length || Object.values(labelState).every((v) => !v);
};

/**
 * @description remove labels in localstorage if not in labels list
 * @param labels list of labels object {id: '', name: ''}
 */
const removeUnusedLabels = (labels) => {
    labels = labels.map((label) => label.name);
    for (const label of Object.keys(labelState)) {
        if (!labels.includes(label) || !labelState[label]) {
            delete labelState[label];
        }
    }
};

/**
 * @description Update options of select after filter labels
 * @param processSelectorId if none get all select has class .process-selector
 * @param processConfigs list of process configs
 */

const updateProcessListAfterFilter = (processSelectorId = '', processConfigs) => {
    const selectors = processSelectorId ? $(`#${processSelectorId}`) : $('.process-selector');

    selectors.each((i, el) => {
        const _thisSelector = $(el);
        const currentValue = _thisSelector.val();
        // check if it has no data link option (start process)
        const noDataLinkOptionEl = _thisSelector.find('option[value="0"]');
        const noDataLinkOption =
            noDataLinkOptionEl.length > 0 ? `<option value="0">${noDataLinkOptionEl[0].text}</option>` : null;
        const endProcs = genProcessDropdownData(processConfigs);
        const options = genProcessSelectOptions(endProcs.ids, endProcs.names, noDataLinkOption);
        // update filtered option values
        _thisSelector.empty().append(options);
        _thisSelector.val(currentValue);

        // remove column div if selected value is empty
        if (!_thisSelector.val()) {
            _thisSelector.parents('.end-proc').find('.list-item').remove();
            _thisSelector.parents('.cond-proc').find('.list-item').remove();
        }
    });
    updateSelectedItems();
};

const sendDataGAWhenClickFilterButton = (filterButtonPosition = '') => {
    if (!filterButtonPosition) return;
    if (isUserConsentCookieAndGA()) {
        gtag('event', 'apdn7_events_tracking', {
            dn_app_version: appContext.app_version?.split('.').slice(0, -1).join('.'),
            dn_app_source: appContext.app_source,
            dn_app_group: appContext.app_group,
            dn_app_type: appContext.app_type,
            dn_app_os: appContext.app_os,
            dn_filter_label_btn_position: filterButtonPosition,
        });
    }
};

$(() => {
    showAllLabelsInUse();

    $('.filter-label-btn-event').on('click', (e) => {
        const position = e.currentTarget.getAttribute('data-position');
        sendDataGAWhenClickFilterButton(position);
    });
});
