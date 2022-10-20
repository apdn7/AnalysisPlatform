/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */
const visualModule = (() => {
    const card = $('#visualization.card');
    // elements
    const eles = {
        partnoColumn: card.find('[name=partnoColumn]'),
        partnoVal: card.find('[name=partnoValue]'), // TODO
        partnoColName: 'partnoColumn',
        partnoValName: 'partnoValue',
        ucl: 'ucl',
        lcl: 'lcl',
        prcMax: 'prcMax',
        prcMin: 'prcMin',
        ymax: 'ymax',
        ymin: 'ymin',
        actFromDate: 'actFromDate',
        actToDate: 'actToDate',
        actFromTime: 'actFromTime',
        actToTime: 'actToTime',
        visualConfigRegister: '#visualConfigRegister',
        addVisualConfig: card.find('#addVisualConfig'),
        tblConfig: card.find('#tblVisualConfig'),
        tblConfigBody: card.find('#tblVisualConfig tbody'),
        selectedOptStr: 'selected="selected"',
        defaultVal: 'default',
        alertMsg: 'alertMsgVisualization',
        alertMsgEle: $('#alertMsgVisualization'),
        confirmButton: card.find('#confirmRegister'),
        modalId: card.find('#visualConfirmModal'),
        cfgVisualizationId: 'cfgVisualizationId',
        controlColumn: 'controlColumn',
        filterType: 'filterType',
        filterTypeOption: 'filterTypeOption',
        filterColumn: 'filterColumnId',
        filterValue: 'filterValue',
        checkedFilterType: 'input[name^=filterTypeOption]:checked',
        showAll: 'showAll',
        fromFilterConfig: 'fromFilterConfig',
        filterTypeFromCfg: {
            key: 'fromFilterConfig',
            value: 'filterTypeFromConfig',
        },
        filterTypeShowAll: {
            key: 'showAll',
            value: 'filterTypeShowAll',
        },
        changeModeBtn: '#visualization .changeMode',
        spreadSheetContainer: '#visualization .editmode-container',
        spreadSheet: '#visualization .editmode-table',
        tblVisualConfig: 'tblVisualConfig',
        spreadsheetID: 'masterSM',
        confirmSwitchButton: '#confirmSwitch',
        filterConfirmSwitchModal: '#filterConfirmSwitchModal',
    };

    // yaml keys
    // const yamlKeys = {
    //     threshHigh: 'thresh-high',
    //     threshLow: 'thresh-low',
    //     prcMax: 'prc-max',
    //     prcMin: 'prc-min',
    //     ymax: 'y-max',
    //     ymin: 'y-min',
    //     chartInfo: 'chart-info',
    //     default: 'default',
    // };

    const msg = {
        saveOK: $('#saveOK'),
        saveFailed: $('#saveFailed'),
        requireValue: $('#requireValue')[0].innerHTML,
        requireSetting: $('#requireSetting')[0].innerHTML,
        duplicatedSetting: $('#duplicatedSetting')[0].innerHTML,
        ymaxLt: $('#ymaxLt')[0].innerHTML,
        uclLt: $('#uclLt')[0].innerHTML,
        prcUCLLt: $('#prcUCLLt')[0].innerHTML,
        actTimeEmpty: $('#i18nActTimeEmpty')[0].innerHTML,
        actFromGreater: $('#i18nActFromGreater')[0].innerHTML,
    };

    const i18nNames = {
        partNoDefaultName: $('#partNoDefaultName').text(),
        filterCfg: $('#i18nFilterCfgLabel').text(),
        showAllCfg: $('#i18nShowAllCfglabel').text(),
        showAllCfgID: 'i18nShowAllCfglabel',
        filterCfgID: 'i18nFilterCfgLabel',
        settingMode: $('#filterSettingMode').text(),
        editMode: $('#filterEditMode').text(),
    };

    const masterHeaderName = [
        'controlColumn',
        'filterColumnId',
        'filterValue',
        'lcl',
        'ucl',
        'prcMin',
        'prcMax',
        'ymin',
        'ymax',
        'actFromDateTime',
        'actToDateTime'];

    const openOptions = (rowIdx) => {
        $(`#${rowIdx} .mcs-container`).click((event) => {
            event.stopPropagation();
            // reset sticky columns
            $('.sticky-rcol').css('position', 'static');

            $('.mcs-container--open').hide();
            const eleIdx = event.currentTarget.id.split('_');
            $(`#mcs-filter-items-options_${eleIdx[1]}`).show();
            $(`#mcs-searchbox_${eleIdx[1]}`).focus();
        });
    };
    const hideFilterItems = (rowIdx) => {   // TODO optimize
        $('html').click(() => {
            $(`#${rowIdx} .mcs-container--open`).hide();
            $('.sticky-rcol').css('position', 'sticky');
        });
        $(`${rowIdx} .mcs-container`).click((event) => {
            event.stopPropagation();
            $('.sticky-rcol').css('position', 'sticky');
        });
    };

    // remove all highlighted
    const hoveringOptions = (rowIdx) => {
        $(`#${rowIdx}.mcs-results__option`).hover((e) => {
            $('.mcs-results__option').removeClass('mcs-results__option--highlighted');
            $(e.currentTarget).addClass('mcs-results__option--highlighted');
        });
    };

    // select the options
    const onSelectFilterTypeValue = (rowIdx) => {
        $(`#${rowIdx} .mcs-results__option`).click(async (e) => {
            const filterColumnId = $(e.currentTarget).data('mcs-id'); // TODO consider change name
            const optionName = $(e.currentTarget).data('mcs-name');
            $(`#mcs-filterType_${rowIdx}`).text(optionName); // filterTypeName
            $(`#mcs-filterType_${rowIdx}`).attr('data-selection-id', filterColumnId); // filterTypeId // TODO why?

            // set selected filter column id
            $(`#filterColumnId_${rowIdx}`).val(filterColumnId);

            // show fitler value options
            const filterValueColElement = $(`#filterValue_${rowIdx}`);
            filterValueColElement.empty().append(createDefaultOption(true));

            const filterType = $(`#${rowIdx}`).find(eles.checkedFilterType).val();
            if (filterType === eles.showAll) {
                if (filterColumnId === eles.defaultVal) {
                    return;
                }
                await cfgProcess.updateColDataFromUDB(filterColumnId);
                const sensorValues = cfgProcess.getColumnData(filterColumnId);
                const filterValueOptions = buildFilterValueOptionsFromDB(sensorValues);
                filterValueColElement.empty().append(filterValueOptions.join(''));
            } else {
                // build filter detail options
                const [filterValueOptions, _] = buildFilterValueOptionsFromFilter(filterColumnId);
                filterValueColElement.empty().append(filterValueOptions.join(''));
            }

            // auto update Act From
            autoUpdateActFrom(rowIdx);

            // update span label
            const filterTypeName = $(`#mcs-${eles.filterType}_${rowIdx}`).text();
            $(e.currentTarget).closest('td').find('.msc-label').text(filterTypeName);
        });
    };

    const onChangeFilterType = (rowIdx) => {
        $(`#${rowIdx} input[name^=filterTypeOption]`).on('change', (e) => {
            // console.log(rowIdx);
            const filterType = $(e.currentTarget).val() || eles.showAll;
            if (filterType !== eles.showAll) {
                $(`#filterTypeFromConfig_${rowIdx}`).attr('hidden', false);
                $(`#filterTypeShowAll_${rowIdx}`).attr('hidden', true);
            } else {
                $(`#filterTypeFromConfig_${rowIdx}`).attr('hidden', true);
                $(`#filterTypeShowAll_${rowIdx}`).attr('hidden', false);
            }
            $(`#filterValue_${rowIdx}`).empty().append(createDefaultOption(true));

            // auto update Act From
            autoUpdateActFrom(rowIdx);
        });
    };

    const autoUpdateActFrom = (rowIdx) => {
        let actFromDate = openWebPageDateTime.format('YYYY-MM-DD');
        let actFromTime = openWebPageDateTime.format('HH:mm');
        const root = 'ROOT';
        const genJsonData = genJsonfromHTML(eles.tblConfigBody, root, true);
        genJsonData(eles.controlColumn);
        genJsonData(eles.filterColumn);
        genJsonData(eles.filterValue);
        genJsonData(eles.actFromDate);
        genJsonData(eles.actFromTime);
        genJsonData(eles.actToDate);
        const jsonData = genJsonData(eles.actToTime);

        const currentControlColId = $(`#${eles.controlColumn}_${rowIdx}`).val();
        const currentFilterColId = $(`#filterColumnId_${rowIdx}`).val(); // TODO const
        const currentFilterValue = $(`#filterValue_${rowIdx}`).val();
        const currentSetings = jsonData[root];

        // find datetime candidates
        let datetimeCandidates = [];
        const controlColumns = currentSetings[eles.controlColumn] || [];
        const sep = ' ';
        controlColumns.forEach((controlCol, idx) => {
            if (currentControlColId === controlCol
                    && currentFilterColId === currentSetings[eles.filterColumn][idx]
                    && currentFilterValue === currentSetings[eles.filterValue][idx]) {
                datetimeCandidates.push(
                    `${currentSetings[eles.actToDate][idx]}${sep}${currentSetings[eles.actToTime][idx]}`,
                );
            }
        });
        datetimeCandidates = datetimeCandidates
            .filter(dt => dt && dt.trim())
            .sort()
            .reverse();
        if (datetimeCandidates.length) {
            [actFromDate, actFromTime] = datetimeCandidates[0].split(sep);
        }

        // set auto act from datetime
        const cfgVisualizationDbId = $(`#${eles.cfgVisualizationId}_${rowIdx}`).val();
        if (!cfgVisualizationDbId) { // it's new row. auto set for new row only
            $(`#${eles.actFromDate}_${rowIdx}`).val(actFromDate);
            $(`#${eles.actFromTime}_${rowIdx}`).val(actFromTime);
        }
    };

    const onChangeControlColumn = (rowIdx) => {
        $(`#${eles.controlColumn}_${rowIdx}`).on('change', (evt) => {
            autoUpdateActFrom(rowIdx);
            const controlColumnName = $(evt.currentTarget).find('option:selected').text();
            $(evt.currentTarget).closest('td').find('.msc-label').text(controlColumnName);
        });
    };

    const onChangeFilterValue = (rowIdx) => {
        $(`#${eles.filterValue}_${rowIdx}`).on('change', (evt) => {
            autoUpdateActFrom(rowIdx);

            // update span label
            const filterName = $(evt.currentTarget).find('option:selected').text();
            $(evt.currentTarget).closest('td').find('.msc-label').text(filterName);
        });
    };

    const onClickFilterValue = (rowIdx) => {
        const currentTdId = `#${eles.filterValue}_${rowIdx}_tr`;
        $(`${currentTdId} .select2-container`).each(function f() {
            $(this).mouseenter(async (e) => {
                e.stopPropagation();

                // get selected filter column id
                const filterColumnId = $(`#filterColumnId_${rowIdx}`).val();
                const filterType = $(`#${rowIdx}`).find(eles.checkedFilterType).val();
                // if show all
                if (filterType === eles.showAll) {
                    if (filterColumnId === eles.defaultVal) {
                        return;
                    }
                    await cfgProcess.updateColDataFromUDB(filterColumnId);
                    const sensorValues = cfgProcess.getColumnData(filterColumnId);

                    // get current selected option
                    const filterValueColElement = $(`#filterValue_${rowIdx}`);
                    const selectedFilterValue = filterValueColElement.val();

                    // build dropdown list
                    const filterValueOptions = buildFilterValueOptionsFromDB(sensorValues, selectedFilterValue);

                    // show fitler value options
                    filterValueColElement.empty().append(filterValueOptions.join(''));

                    filterValueColElement.val(selectedFilterValue);
                    filterValueColElement.select2().trigger('change');
                } else {
                    // no need to update if from config
                }
            });
        });
    };

    const buildFilterValueOptionsFromFilter = (selectedFilterColumnId, selectedFilterValue = '') => {
        const filterValueOptions = [];
        let filterValueName;
        const selectedFilter = cfgProcess.getFilterByColumnId(selectedFilterColumnId) || new CfgFilter({});

        // build filter detail options
        const filterDetails = Object.assign([], selectedFilter.filter_details) || [];
        filterDetails.unshift({
            id: eles.defaultVal,
            name: i18nNames.partNoDefaultName,
        });

        for (const filterDetail of filterDetails) {
            const selected = selectedFilterValue === filterDetail.id ? eles.selectedOptStr : '';
            filterValueOptions.push(
                `<option value="${filterDetail.id}" ${selected}>${filterDetail.name}</option>`,
            );
            if (selected) {
                filterValueName = filterDetail.name;
            }
        }

        return [filterValueOptions, filterValueName];
    };

    const buildFilterValueOptionsFromDB = (sensorValues = [], selectedFilterValue = '') => {
        const filterValueOptions = [];
        if (selectedFilterValue === eles.defaultVal) {
            filterValueOptions.push(createDefaultOption(true));
        } else {
            filterValueOptions.push(createDefaultOption(false));
        }

        for (const val of sensorValues) {
            const selected = selectedFilterValue === val ? eles.selectedOptStr : '';
            filterValueOptions.push(
                `<option value="${val}" ${selected}>${val}</option>`,
            );
        }
        return filterValueOptions;
    };

    const createDefaultOption = (selected = false) => {
        const selectOption = selected ? eles.selectedOptStr : '';
        return `<option value="${eles.defaultVal}" ${selectOption}>${i18nNames.partNoDefaultName}</option>`;
    };

    // search columns
    const searchColumns = (rowIdx) => {
        $(`#${rowIdx} .search-column`).on('keyup search', (e) => {
            const searchText = $(e.currentTarget).val();
            const dataRowID = $(e.currentTarget).data('row-id');
            const filterType = $(`input[name=${eles.filterTypeOption}_${dataRowID}]:checked`).val();
            let ulActived = '';
            if (filterType === eles.filterTypeFromCfg.key) {
                ulActived = eles.filterTypeFromCfg.value;
            } else {
                ulActived = eles.filterTypeShowAll.value;
            }
            $(`#${ulActived}_${dataRowID} li`).filter(function f() {
                $(this).toggle($(this).text().toLowerCase().indexOf(searchText) > -1);
            });
        });
    };


    // add new row
    const addConfigRow = (cfgVisualization, isAddNewRow = false) => {
        const rowIdx = `${moment().format('YYMMDDHHmmssSSS')}${generateRandomString(3)}`;

        // build control column selections
        const selectedControlCol = cfgVisualization.control_column_id;
        const controlCols = cfgProcess.getNumericColumns() || [];
        let controlColName = '';
        const controlColOptions = controlCols.map((col) => {
            const selected = col.id === selectedControlCol ? eles.selectedOptStr : '';
            if (col.id === selectedControlCol) {
                controlColName = col.name;
            }
            return `<option value="${col.id}" ${selected}>${col.name}</option>`;
        });
        // const controlColName = controlCols.filter(col => col.id == selectedControlCol)[0].name;
        // filter item (type column)
        const dicColumns = cfgProcess.dicColumns || {};
        const defaultFilterItemOption = `<li class="mcs-results__option" role="option"
                                        aria-selected="false" data-select2-id="28"
                                        id="mcs-filterValue-io-result-no_${rowIdx}"
                                        data-mcs-name="${i18nNames.partNoDefaultName}"
                                        data-mcs-id="default">${i18nNames.partNoDefaultName}</li>`;
        const fromFilterConfigItemOptions = [defaultFilterItemOption];
        cfgProcess.getFilters().forEach((filter) => {
            if (!isEmpty(filter.column_id)) { // to prevent the case N/A column in LINE filter
                const filterItemName = dicColumns[filter.column_id].name || filter.column_id || filter.name;
                fromFilterConfigItemOptions.push(
                    `<li class="mcs-results__option" id="mcs-filterValue-io-result-no_${cfgVisualization.id}"
                    role="option" aria-selected="false" 
                    data-mcs-name="${filterItemName}"
                    data-mcs-id="${filter.column_id}">${filterItemName}</li>`,
                );
            }
        });

        const showAllItemOptions = [defaultFilterItemOption];
        cfgProcess.getCategoryColumns().forEach((col) => {
            // TODO id="mcs-filterValue-io-result-no_${col.id}" uniqueness
            showAllItemOptions.push(
                `<li class="mcs-results__option" id="mcs-filterValue-io-result-no_${col.id}"
                role="option" aria-selected="false" 
                data-mcs-name="${col.name}"
                data-mcs-id="${col.id}">${col.name}</li>`,
            );
        });

        // filter item: decide show all or from config
        let isFromConfig = true;
        // let isFromConfig = false;
        let showHideFromConfig = '';
        let showHideShowAll = 'hidden';
        let checkFilterTypeFromConfig = 'checked="checked"';
        // let checkFilterTypeShowAll = '';
        if (cfgVisualization.is_from_data === false) {
            isFromConfig = true;
            showHideFromConfig = '';
            showHideShowAll = 'hidden';
            // checkFilterTypeShowAll = '';
            checkFilterTypeFromConfig = 'checked="checked"';
        }

        // selected filter column
        let selectedFilterColumnId = cfgVisualization.filter_column_id;
        let selectedFilterItemName;
        if (selectedFilterColumnId && selectedFilterColumnId !== 'default') {
            selectedFilterItemName = dicColumns[selectedFilterColumnId].name;
        } else {
            // set default if null
            selectedFilterColumnId = eles.defaultVal;
            selectedFilterItemName = i18nNames.partNoDefaultName;
        }

        // filter value (name column)
        let filterValueOptions = [];
        let filterValueName = i18nNames.partNoDefaultName;
        if (isFromConfig) {
            // build options from filter details
            const selectedFilterValue = cfgVisualization.filter_detail_id || eles.defaultVal;
            if (selectedFilterValue) {
                [filterValueOptions, filterValueName] = buildFilterValueOptionsFromFilter(selectedFilterColumnId, selectedFilterValue);
            }
        } else {
            // build options + show selected options
            const selectedFilterValue = cfgVisualization.filter_value;
            if (selectedFilterValue !== null && selectedFilterValue !== undefined) {
                filterValueName = selectedFilterValue;
                filterValueOptions.push(
                    createDefaultOption(),
                    `<option value="${selectedFilterValue}" ${eles.selectedOptStr}>${selectedFilterValue}</option>`,
                );
            } else {
                filterValueOptions.push(createDefaultOption(true));
            }
        }

        // thresholds
        const threshLow = isEmpty(cfgVisualization.lcl) ? '' : cfgVisualization.lcl;
        const threshHigh = isEmpty(cfgVisualization.ucl) ? '' : cfgVisualization.ucl;
        const prcMin = isEmpty(cfgVisualization.lpcl) ? '' : cfgVisualization.lpcl;
        const prcMax = isEmpty(cfgVisualization.upcl) ? '' : cfgVisualization.upcl;
        const yMin = isEmpty(cfgVisualization.ymin) ? '' : cfgVisualization.ymin;
        const yMax = isEmpty(cfgVisualization.ymax) ? '' : cfgVisualization.ymax;

        // act from/to
        let actFromDate = '';
        let actFromTime = '';
        if (cfgVisualization.act_from) {
            const actFromDateTime = moment(cfgVisualization.act_from).local();
            actFromDate = actFromDateTime.format('YYYY-MM-DD');
            actFromTime = actFromDateTime.format('HH:mm');
        }

        let actToDate = '';
        let actToTime = '';
        if (cfgVisualization.act_to) {
            const actToDateTime = moment(cfgVisualization.act_to).local();
            actToDate = actToDateTime.format('YYYY-MM-DD');
            actToTime = actToDateTime.format('HH:mm');
        }

        // when click add row button show editable input as default
        const inputInRows = {
            show: '',
            hide: '',
        };
        if (isAddNewRow) {
            inputInRows.show = 'show';
            inputInRows.hide = 'hide';
        }
        const rowDOM = `
            <tr name="visualInfo" id="${rowIdx}">
                <input type="hidden"  name="${eles.cfgVisualizationId}" id="${eles.cfgVisualizationId}_${rowIdx}" 
                    value="${cfgVisualization.id || ''}" ${dragDropRowInTable.DATA_ORDER_ATTR}>
                <td class="col-number"></td>
                <td class="sticky-rcol first-col">
                    <div class="msc-input ${inputInRows.show}">
                        <select name="${eles.controlColumn}" id="${eles.controlColumn}_${rowIdx}"
                            class="form-control">
                        <option value="" >---</option>
                        ${controlColOptions}
                        </select>
                    </div>
                    <div class="msc-label ${inputInRows.hide}"><span>${controlColName}</span></div>
                </td>
                <td class="sticky-rcol second-col" id="filterType_${rowIdx}">
                    <div class="msc-input ${inputInRows.show}">
                        <span id="mcs-filter-items_${rowIdx}" class="mcs mcs-container mcs-container--default"
                        data-select2-id="2" style="min-width: 80px;">
                            <span class="selection">
                                <span class="mcs-selection mcs-selection--single"
                                    role="combobox" aria-haspopup="true" aria-expanded="true"
                                     tabindex="0" aria-disabled="false"
                                     aria-labelledby="mcs-filterType_${rowIdx}"
                                     aria-owns="mcs-filterValue-io-results"
                                     aria-activedescendant="mcs-filterValue-io-result-r755----">
                                     <input type="hidden" id="filterColumnId_${rowIdx}" 
                                        name="filterColumnId" value="${selectedFilterColumnId}">
                                     <span class="mcs-selection__rendered"
                                        id="mcs-filterType_${rowIdx}"
                                        role="textbox" aria-readonly="true"
                                        title="">${selectedFilterItemName}</span>
                                    <span class="mcs-selection__arrow"
                                        role="presentation">
                                        <b role="presentation"></b>
                                    </span>
                                </span>
                            </span>
                            <span class="dropdown-wrapper" aria-hidden="true"></span>
                        </span>
                        <span id="mcs-filter-items-options_${rowIdx}"
                            class="mcs-container mcs-container--default mcs-container--open"
                            style="position: absolute;">
                            <span name="${eles.filterType}" 
                                class="mcs-dropdown mcs-dropdown--below" dir="ltr" style="width: 200px;">
                                <div class="custom-control custom-radio mcs-options hide">
                                    <input type="radio" class="custom-control-input"
                                        id="fromFlt_${rowIdx}" name="${eles.filterTypeOption}_${rowIdx}" 
                                        value="${eles.fromFilterConfig}" ${checkFilterTypeFromConfig}>
                                    <label class="custom-control-label" 
                                        for="fromFlt_${rowIdx}">${$(`#${i18nNames.filterCfgID}`).text()}</label>
                                </div>
                                <span class="mcs-search mcs-search--dropdown">
                                    <input id="mcs-searchbox_${rowIdx}"
                                        class="mcs-search__field search-column" 
                                        data-row-id="${rowIdx}" type="search">
                                </span>
                                <span class="mcs-results">
                                    <ul class="mcs-results__options" role="listbox"
                                        id="filterTypeFromConfig_${rowIdx}" aria-expanded="true"
                                        aria-hidden="false" ${showHideFromConfig}>
                                        ${fromFilterConfigItemOptions.join('')}
                                    </ul>
                                    <ul class="mcs-results__options" role="listbox"
                                        id="filterTypeShowAll_${rowIdx}" aria-expanded="true"
                                        aria-hidden="false" ${showHideShowAll}>
                                        ${showAllItemOptions.join('')}
                                    </ul>
                                </span>
                            </span>
                        </span>
                    </div>
                    <div class="msc-label ${inputInRows.hide}"><span>${selectedFilterItemName}</span></div>
                </td>
                <td class="sticky-rcol third-col" id="filterValue_${rowIdx}_tr" style="max-width: 100px;">
                    <div class="msc-input ${inputInRows.show}">
                        <select name="filterValue" 
                            id="filterValue_${rowIdx}"
                            class="form-control filter-values">
                        ${filterValueOptions.join('')}
                    </select>
                    </div>
                    <div class="msc-label ${inputInRows.hide}"><span>${filterValueName || ''}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="lcl" class="form-control" type="number" 
                            value="${threshLow}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${threshLow}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="ucl" class="form-control" type="number" 
                            value="${threshHigh}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${threshHigh}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="prcMin" class="form-control" type="number" 
                            value="${prcMin}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${prcMin}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="prcMax" class="form-control" type="number" 
                            value="${prcMax}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${prcMax}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="ymin" class="form-control" type="number" 
                            value="${yMin}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${yMin}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <input name="ymax" class="form-control" type="number" 
                            value="${yMax}" onChange="visualModule.updateLabel(this);">
                    </div>
                    <div class="msc-right msc-label ${inputInRows.hide}"><span>${yMax}</span></div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <div class="row act-inp">
                            <div class="col act-date-inp">
                                <input id="${eles.actFromDate}_${rowIdx}" name="${eles.actFromDate}" 
                                class="form-control act-date" value="${actFromDate}" 
                                onChange="visualModule.updateLabel(this, 'actDate');">
                            </div>
                            <div class="col act-time-inp">
                                <input id="${eles.actFromTime}_${rowIdx}" name="${eles.actFromTime}"
                                class="form-control act-time" value="${actFromTime}" 
                                onChange="visualModule.updateLabel(this, 'actTime');">
                            </div>
                        </div>
                    </div>
                    <div class="msc-label ${inputInRows.hide}">
                        <span class="actDate">${actFromDate}</span> <span class="actTime">${actFromTime}</span>
                    </div>
                </td>
                <td class="thresh-line">
                    <div class="msc-input ${inputInRows.show}">
                        <div class="row act-inp">
                            <div class="col act-date-inp">
                                <input name="actToDate" class="form-control act-date" 
                                    value="${actToDate}" onChange="visualModule.updateLabel(this, 'actDate');">
                            </div>
                            <div class="col act-time-inp">
                                <input name="actToTime" class="form-control act-time" 
                                    value="${actToTime}" onChange="visualModule.updateLabel(this, 'actTime');">
                            </div>
                        </div>
                    </div>
                    <div class="msc-label ${inputInRows.hide}">
                        <span class="actDate">${actToDate}</span> <span class="actTime">${actToTime}</span>
                   </div>
                </td>
                <td class="text-inline">
                    <div class="btn-grp">
                        <button onclick="visualModule.editRow(this);" type="button"
                            class="btn btn-secondary${isAddNewRow ? ' btn-recent' : ''} mcs-btn-xs">
                            <i class="fas fa-edit fa-xs icon-secondary${isAddNewRow ? ' icon-recent' : ''}"></i>
                        </button>
                    </div>
                    <div class="btn-grp">
                        <button onclick="visualModule.deleteRow(this);" type="button"
                            class="btn btn-secondary mcs-btn-xs">
                            <i class="fas fa-trash-alt fa-xs icon-secondary"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return [rowIdx, rowDOM];

    };

    const resetEditmode = () => {
        // have not previous table view
        if (!isEmpty($(eles.visualConfigRegister).attr('disabled'))) {
            $(eles.spreadSheet).parent().toggleClass('hide');
            $(eles.spreadSheetContainer).toggleClass('hide');
            $(`${eles.changeModeBtn} span`).text(` ${i18nNames.editMode}`);

            $(`#${eles.spreadsheetID}`).html('');
            $(visualConfigRegister).attr('disabled', false);
        }
    };

    // eslint-disable-next-line no-unused-vars
    const showSettings = (cfgProcess) => {
        // clear current setting UI
        eles.tblConfigBody.empty();

        // reset old editmode table
        resetEditmode();


        const visualizations = cfgProcess.getVisualizations();
        let tblConfigDOM = '';
        _.sortBy(visualizations, 'order').forEach((cfgVisualization) => {
            const [_, rowDOM] = addConfigRow(cfgVisualization);
            tblConfigDOM += rowDOM;
        });
        eles.tblConfigBody.html(tblConfigDOM);
        // resort table
        dragDropRowInTable.sortRowInTable(filterElements.tblVisualConfig);

        updateTableRowNumber(filterElements.tblVisualConfig);
    };

    const getEles = () => {
        const convertDefaultToNull = (e) => {
            if (e === eles.defaultVal || e === 'null') return null;
            return e;
        };
        const ROOT = 'root';
        const genJson = genJsonfromHTML(eles.tblConfigBody, ROOT, true);
        genJson(eles.cfgVisualizationId);
        genJson(eles.controlColumn);
        genJson(eles.filterType, (e => $(e).find(eles.checkedFilterType).val()));
        genJson(eles.filterColumn);
        genJson(eles.filterValue);
        genJson(eles.ucl);
        genJson(eles.lcl);
        genJson(eles.prcMax);
        genJson(eles.prcMin);
        genJson(eles.ymax);
        genJson(eles.ymin);
        genJson(eles.actFromDate);
        genJson(eles.actFromTime);
        genJson(eles.actToDate);
        const data = genJson(eles.actToTime)[ROOT];

        const cfgIds = data[eles.cfgVisualizationId] || [];
        const controlColumns = data[eles.controlColumn] || [];
        const filterTypeOptions = (data[eles.filterType] || []).map((e) => {
            if (isEmpty(e)) { return eles.showAll; } return e;
        });
        const filterColumns = (data[eles.filterColumn] || []).map(convertDefaultToNull);
        const filterValues = (data[eles.filterValue] || []).map(convertDefaultToNull);
        const ucls = data[eles.ucl] || [];
        const lcls = data[eles.lcl] || [];
        const prcMaxs = data[eles.prcMax] || [];
        const prcMins = data[eles.prcMin] || [];
        const ymaxs = data[eles.ymax] || [];
        const ymins = data[eles.ymin] || [];
        const actFromDates = data[eles.actFromDate] || [];
        const actFromTimes = data[eles.actFromTime] || [];
        const actToDates = data[eles.actToDate] || [];
        const actToTimes = data[eles.actToTime] || [];

        return [...Array(controlColumns.length).keys()]
            .map((e, i) => [cfgIds[i], controlColumns[i], filterTypeOptions[i], filterColumns[i],
                filterValues[i], ucls[i], lcls[i], prcMaxs[i], prcMins[i], ymaxs[i], ymins[i],
                actFromDates[i], actFromTimes[i], actToDates[i], actToTimes[i]]);
    };

    const oneOfTwoIsEmpty = arr => arr.map((e) => {
        if (isEmpty(e)) { return 1; } return 0;
    }).reduce((a, b) => a + b) == 1;

    // get duplicate time range from 2 actTimes
    const getDuplicateTimeRange = (orgTimeRange, compareTimeRange) => {
        const dupTimeRange = [];
        if (compareTimeRange[0] >= orgTimeRange[0] && compareTimeRange[0] <= orgTimeRange[1]) {
            dupTimeRange.push(compareTimeRange[0]);
        } else if (compareTimeRange[0] < orgTimeRange[0] && orgTimeRange[0] <= compareTimeRange[1]) {
            dupTimeRange.push(orgTimeRange[0]);
        }
        if (compareTimeRange[1] <= orgTimeRange[1] && compareTimeRange[1] >= orgTimeRange[0]) {
            dupTimeRange.push(compareTimeRange[1]);
        } else if (compareTimeRange[1] > orgTimeRange[1] && orgTimeRange[1] >= compareTimeRange[0]) {
            dupTimeRange.push(orgTimeRange[1]);
        }

        if (dupTimeRange[0] === dupTimeRange[1]) {
            return [];
        }
        return dupTimeRange;
    };

    // validate
    const validate = () => {
        let errorFlg = false;
        const rows = getEles();
        const actTimeObj = {};
        for (const row of rows) {
            const [cfgId, controlColumn, filterTypeOption, filterColumn, filterValue, ucl, lcl,
                prcMax, prcMin, ymax, ymin, actFromDate, actFromTime, actToDate, actToTime] = row;

            if (!controlColumn) {
                errorFlg = true;
                displayMessage(eles.alertMsg, message = { content: msg.requireValue, is_error: true });
                break;
            }

            errorFlg = [ucl, lcl, prcMax, prcMin, ymax, ymin].every(isEmpty);
            if (errorFlg) {
                displayMessage(eles.alertMsg, message = { content: msg.requireSetting, is_error: true });
                break;
            }

            // y-max >= y-min and ucl >= lcl
            if (ucl !== '' && lcl !== '') {
                errorFlg = Number(ucl) < Number(lcl);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, message = { content: msg.uclLt, is_error: true });
                    break;
                }
            }
            if (ymax !== '' && ymin !== '') {
                errorFlg = Number(ymax) < Number(ymin);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, message = { content: msg.ymaxLt, is_error: true });
                    break;
                }
            }
            if (prcMax !== '' && prcMin !== '') {
                errorFlg = Number(prcMax) < Number(prcMin);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, message = { content: msg.prcUCLLt, is_error: true });
                    break;
                }
            }

            const trimActFrom = `${actFromDate} ${actFromTime}`.trim();
            const trimActTo = `${actToDate} ${actToTime}`.trim();
            if ((trimActFrom === '' && trimActTo === '')
                || oneOfTwoIsEmpty([actFromDate, actFromTime])
                || oneOfTwoIsEmpty([actToDate, actToTime])
            ) {
                errorFlg = true;
                displayMessage(eles.alertMsg, message = { content: msg.actTimeEmpty, is_error: true });
                break;
            }

            if (!isEmpty(trimActFrom) && !isEmpty(trimActTo) && trimActFrom > trimActTo) {
                errorFlg = true;
                displayMessage(eles.alertMsg, message = { content: msg.actFromGreater, is_error: true });
                break;
            }

            // action time to timestamp
            const actDateFrom = trimActFrom ? new Date(trimActFrom).getTime() : 0;
            const actDateTo = trimActTo ? new Date(trimActTo).getTime() : Number.MAX_SAFE_INTEGER;
            const configSetName = `${controlColumn}|${filterColumn}|${filterValue}`;

            if (actTimeObj[configSetName]) {
                const actRanges = actTimeObj[configSetName];
                // eslint-disable-next-line no-loop-func
                actRanges.forEach((actRange) => {
                    const dupRange = getDuplicateTimeRange([actDateFrom, actDateTo], actRange);
                    if (dupRange.length) {
                        errorFlg = true;
                    }
                });
                if (errorFlg) {
                    displayMessage(eles.alertMsg, message = { content: msg.duplicatedSetting, is_error: true });
                    break;
                }
            } else {
                actTimeObj[configSetName] = [[actDateFrom, actDateTo]];
            }
        }
        return !errorFlg;
    };

    const buildDateTime = (actDate, actTime) => {
        const datetimeStr = `${actDate} ${actTime}`.trim();
        if (!isEmpty(actDate) && !isEmpty(actTime)) { return moment.utc(moment(datetimeStr)).format(); }
        return datetimeStr;
    };

    // register to yaml file
    const register = () => {
        eles.alertMsgEle.css('display', 'none');

        const rows = getEles();
        const data = [];
        rows.forEach((row, idx) => {
            const [cfgId, controlColumn, filterTypeOption, filterColumn, filterValue, ucl, lcl,
                prcMax, prcMin, ymax, ymin, actFromDate, actFromTime, actToDate, actToTime] = row;
            const isFromData = filterTypeOption === eles.showAll ? 1 : 0;
            data.push(new CfgVisualization({
                id: cfgId || null,
                process_id: cfgProcess.id,
                control_column_id: controlColumn,
                filter_column_id: filterColumn,
                filter_value: isFromData ? filterValue : null,
                is_from_data: isFromData,
                filter_detail_id: isFromData ? null : filterValue,
                ucl: ucl || null,
                lcl: lcl || null,
                upcl: prcMax || null,
                lpcl: prcMin || null,
                ymax: ymax || null,
                ymin: ymin || null,
                act_from: buildDateTime(actFromDate, actFromTime),
                act_to: buildDateTime(actToDate, actToTime),
                order: idx,
            }));
        });

        fetch(`/histview2/api/setting/proc_config/${cfgProcess.id}/visualizations`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
            .then((response) => {
                if (!response.ok) { throw Error(''); } else { return response.clone().json(); }
            })
            .then((json) => {
                // reload page
                cfgProcess = new CfgProcess(json.data);
                showSettings(cfgProcess);
                // show message
                displayMessage(eles.alertMsg, message = { content: msg.saveOK.text(), is_error: false });
            })
            .catch((err) => {
                // show messg
                console.log('ERROR: ', err);
                displayMessage(eles.alertMsg, message = { content: msg.saveFailed.text(), is_error: true });
            });

    };

    // delete 1 row
    const deleteRow = (e) => {
        delClosestEle(e, 'tr');
    };

    // edit row
    const editRow = (e, rowId = null) => {
        let currentRowEle = null;
        if (rowId){
            currentRowEle = $(`#${rowId}`);
        } else {
            const currentRow = e.closest('tr');
            currentRowEle = $(currentRow);
        }
        currentRowEle.find('.msc-input').toggleClass('show');
        currentRowEle.find('.msc-label').toggleClass('hide');

        // change button style
        const btn = $(e);
        $(btn).toggleClass('btn-recent');
        $(btn).find('.icon-secondary').toggleClass('icon-recent');

        initRowEvents(currentRowEle);
    };

    const initRowEvents = (currentRowEle) => {
        initRowDatetimeSelect2(currentRowEle);
        const rowIdx = currentRowEle.attr('id');
        openOptions(rowIdx);
        hideFilterItems(rowIdx);
        hoveringOptions(rowIdx);
        onChangeControlColumn(rowIdx);
        onChangeFilterType(rowIdx);
        onSelectFilterTypeValue(rowIdx);
        onChangeFilterValue(rowIdx);
        onClickFilterValue(rowIdx);
        searchColumns(rowIdx);
    }

    const initRowDatetimeSelect2 = (rowElement) => {
        rowElement.find(`.act-date`).datepicker({ dateFormat: 'yy-mm-dd' });
        rowElement.find(`.act-time`).timepicker();
        rowElement.find(`.filter-items`).select2();
        rowElement.find(`.filter-values`).select2();
    }

    const updateLabel = (e, action = '') => {
        // update span label
        const value = $(e).val();
        if (action) {
            console.log($(e).closest('td').find(`.msc-label .${action}`).text());
            $(e).closest('td').find(`.msc-label .${action}`).text(value);
        } else {
            $(e).closest('td').find('.msc-label').text(value);
        }
    };

    // filter
    const filterRow = (columnIdx) => {
        const inputVal = $(`#filter-${columnIdx}`).val();
        const filter = inputVal.toUpperCase();
        const tr = $("tr[name='visualInfo']");
        for (i = 0; i < tr.length; i++) {
            const td = tr[i].getElementsByTagName('td')[columnIdx];
            if (td) {
                const tdText = $(td).find('.msc-label span').text();
                if (tdText.toUpperCase().indexOf(filter) > -1) {
                    $(tr[i]).css('display', '');
                } else {
                    $(tr[i]).css('display', 'none');
                }
            }
        }
    };

    const getValueFromFilterOption = (filterColId, filterVal) => {
        let filterValueName;
        const selectedFilter = cfgProcess.getFilterByColumnId(filterColId) || new CfgFilter({});
        // build filter detail options
        const filterDetails = Object.assign([], selectedFilter.filter_details) || [];
        for (const filterDetail of filterDetails) {
            if (filterVal === filterDetail.id) {
                filterValueName = filterDetail.name;
            }
        }
        return filterValueName;
    };

    const getConfigItems = (filterName) => {
        console.time('getConfigItems');
        const convertDefaultToNull = (e) => {
            if (e === filterElements.defaultVal || e === 'null') return null;
            return e;
        };
        const formJsonCollecter = genJsonfromHTML(filterElements.tblConfigBody, 'root', true);
        formJsonCollecter(filterElements.cfgVisualizationId);
        formJsonCollecter(filterElements.controlColumn);
        formJsonCollecter(filterElements.filterType, (e => $(e).find(filterElements.checkedFilterType).val()));
        formJsonCollecter(filterElements.filterColumn);
        formJsonCollecter(filterElements.filterValue);
        formJsonCollecter(filterElements.ucl);
        formJsonCollecter(filterElements.lcl);
        formJsonCollecter(filterElements.prcMax);
        formJsonCollecter(filterElements.prcMin);
        formJsonCollecter(filterElements.ymax);
        formJsonCollecter(filterElements.ymin);
        formJsonCollecter(filterElements.actFromDate);
        formJsonCollecter(filterElements.actFromTime);
        formJsonCollecter(filterElements.actToDate);
        const data = formJsonCollecter(filterElements.actToTime).root;
        // return data.root;

        // const cfgIds = data[filterElements.cfgVisualizationId] || [];
        const controlColumns = data[filterElements.controlColumn] || [];
        // const filterTypeOptions = (data[filterElements.filterType] || []).map((e) => {
        //     if (isEmpty(e)) { return filterElements.showAll; } return e;
        // });
        const filterColumns = (data[filterElements.filterColumn] || []).map(convertDefaultToNull);
        const filterValues = (data[filterElements.filterValue] || []).map(convertDefaultToNull);
        const ucls = data[filterElements.ucl] || [];
        const lcls = data[filterElements.lcl] || [];
        const prcMaxs = data[filterElements.prcMax] || [];
        const prcMins = data[filterElements.prcMin] || [];
        const ymaxs = data[filterElements.ymax] || [];
        const ymins = data[filterElements.ymin] || [];
        const actFromDates = data[filterElements.actFromDate] || [];
        const actFromTimes = data[filterElements.actFromTime] || [];
        const actToDates = data[filterElements.actToDate] || [];
        const actToTimes = data[filterElements.actToTime] || [];

        const dicCols = cfgProcess.dicColumns;
        // const filteroptVal = getValueFromFilterOption(filterColumns[i], filterValues[i]);
        const getFilterName = (filterOption, filterColId = false) => {
            if (filterOption === defaultFilter.DEFAULT.name || filterColId === defaultFilter.DEFAULT.name) {
                return $(defaultFilter.DEFAULT.i18n).text();
            }

            if (filterColId) {
                return getValueFromFilterOption(Number(filterColId), Number(filterOption));
            }

            if (dicCols[filterOption]) {
                return dicCols[filterOption].name;
            }
        };
        console.timeEnd('getConfigItems');
        return [...Array(controlColumns.length).keys()]
            .map((e, i) => {
                const controlCol = dicCols[controlColumns[i]];
                let controlColName = '';
                if (controlCol) {
                    controlColName = controlCol.name;
                }
                const filterColName = getFilterName(filterColumns[i]);
                const filterColVal = getFilterName(filterValues[i], filterColumns[i]);
                console.log(filterColVal, filterValues[i], filterColumns[i]);
                return [controlColName, filterColName, filterColVal, lcls[i],
                    ucls[i], prcMins[i], prcMaxs[i], ymins[i], ymaxs[i],
                    `${actFromDates[i]} ${actFromTimes[i]}`, `${actToDates[i]} ${actToTimes[i]}`];
            });
    };

    const showHideModes = (isEditMode) => {
        // show/hide tables
        $('#tblVisualConfig').toggleClass('hide');
        $('#addVisualConfig').toggleClass('hide');
        $(eles.spreadSheet).parent().toggleClass('hide');
        $(eles.spreadSheetContainer).toggleClass('hide');

        // change text
        if (isEditMode) {
            $(`${eles.changeModeBtn} span`).text(` ${i18nNames.settingMode}`);
        } else {
            $(`${eles.changeModeBtn} span`).text(` ${i18nNames.editMode}`);
        }
        $(visualConfigRegister).attr('disabled', isEmpty($(visualConfigRegister).attr('disabled')));
    };

    const buildReferences = () => {
        const procFilters = cfgProcess.getFilters();
        const filterValues = {'default': i18nNames.partNoDefaultName};
        if (procFilters.length) {
            procFilters.forEach((filter, i) => {
                filterValues[filter.column_id] = {};
                filterValues[filter.column_id][i18nNames.partNoDefaultName.trim()] = 'default';
                filter.filter_details.forEach((f, _) => {
                    filterValues[filter.column_id][`${f.name}`] = f.id;
                });
            });
        }
        const dictCols = cfgProcess.dicColumns;
        const controlColumn = {};
        controlColumn[i18nNames.partNoDefaultName.trim()] = 'default';
        Object.keys(dictCols).forEach((key) => {
            controlColumn[dictCols[key].name] = dictCols[key].id;
        });
        return {
            controlColumn,
            filterColumnId: controlColumn,
            filterValue: filterValues,
        };
    };
    const spaceNormalize = (inputStr) => {
        let normalizedStr;
        if (typeof inputStr === 'string') {
            normalizedStr = inputStr.trim();
            normalizedStr = normalizedStr.normalize('NFKC');
            normalizedStr = normalizedStr.replace(/ +/g, ' ');
            return normalizedStr;
        }
        return inputStr;
    };
    const isValidDatetime = (actTime) => {
        const mom = moment(actTime, ["YYYY-MM-DD HH:mm", "YYYY/MM/DD HH:mm", "MM/DD/YYYY HH:mm"], false);
        return mom.isValid();
    };
    const mergeData = (editData, settingData,
        colNames = masterHeaderName,
        mapKey = 'controlColumn') => {
        const settingDataRoot = eles.tblVisualConfig;
        const settingDataRows = getNode(settingData, [settingDataRoot]) || [];
        // const settingDataRows = settingData[settingDataRoot] || [];
        const { cfgVisualizationId } = settingDataRows;
        let keyColIdx = colNames.indexOf(mapKey);
        if (keyColIdx < 0) keyColIdx = 0;
        const selectReferences = buildReferences();

        const outputRows = [];
        for (const rowIdx in editData) {
            const outputRow = {};
            const row = editData[rowIdx];
            for (const colIdx in colNames) {
                const colName = colNames[colIdx];
                let cellValue = spaceNormalize(row[colIdx]);
                if (colName in selectReferences) {
                    if (outputRow.filterColumnId) {
                        cellValue = getNode(selectReferences, [colName, outputRow.filterColumnId, cellValue]) || null;
                    } else {
                        cellValue = getNode(selectReferences, [colName, cellValue]) || null;
                    }
                }
                outputRow[colName] = spaceNormalize(cellValue);
            }
            const colId = getNode(cfgVisualizationId, [rowIdx]);
            outputRow.control_column_id = colId;

            outputRows.push({
                id: Number(colId),
                control_column_id: outputRow.controlColumn,
                is_from_data: true, // default is load config from filter data
                filter_value: null, // todo: assign filter value in case of loading config from DB
                filter_column_id: outputRow.filterColumnId,
                filter_detail_id: outputRow.filterValue,
                lcl: !isNaN(Number(outputRow.lcl)) ? outputRow.lcl : '',
                ucl: !isNaN(Number(outputRow.ucl)) ? outputRow.ucl : '',
                lpcl: !isNaN(Number(outputRow.prcMin)) ? outputRow.prcMin : '',
                upcl: !isNaN(Number(outputRow.prcMax)) ? outputRow.prcMax : '',
                ymax: !isNaN(Number(outputRow.ymax)) ? outputRow.ymax : '',
                ymin: !isNaN(Number(outputRow.ymin)) ? outputRow.ymin : '',
                act_from: isValidDatetime(outputRow.actFromDateTime) ? `${outputRow.actFromDateTime}`.trim() : '',
                act_to: isValidDatetime(outputRow.actToDateTime) ? `${outputRow.actToDateTime}`.trim() : '',
            });
        }
        return outputRows;
    };
    const generateSpreadSheet = (filterName) => {
        const getCols = () => {
            const headerLabels = [];
            const colWidths = [];
            $('#tblVisualConfig').find('thead th span').each((_, th) => {
                const colspan = $(th).parent().attr('colspan');
                const headerName = $(th).text();
                const colWidth = $(th).parent().width() + 6;
                if (colspan) {
                    headerLabels.push(...Array(Number(colspan)).fill(headerName));
                    colWidths.push(...Array(Number(colspan)).fill(colWidth / 2));
                } else if (headerName) {
                    headerLabels.push(headerName);
                    colWidths.push(colWidth);
                }
            });
            const spreadWidth = colWidths.reduce((a, b) => a + b);
            const orgTableWidth = $('table#tblVisualConfig').width();
            const minWidth = (orgTableWidth - spreadWidth - 35);
            // increase end column
            colWidths[colWidths.length - 1] = minWidth >= 100 ? minWidth : colWidths[colWidths.length - 2];
            return { headerLabels, colWidths };
        };
        const tableHeadInfor = getCols();
        // get config data
        let configDat = getConfigItems(filterName);

        if (!configDat.length) {
            configDat = [[...Array(tableHeadInfor.headerLabels.length).keys()].map(x => '')];
        }

        const numCols = tableHeadInfor.headerLabels.length;
        const firstColWidth = tableHeadInfor.colWidths[0];
        tableHeadInfor.colWidths[1] = tableHeadInfor.colWidths[1] + firstColWidth;
        jspreadsheet(document.getElementById(`${eles.spreadsheetID}`), {
            data: configDat,
            colHeaders: tableHeadInfor.headerLabels.slice(1, numCols),
            colWidths: tableHeadInfor.colWidths.slice(1, numCols),
        });
    };

    const getSettingModeData2 = (tableId) => {
        const tableIdWithSharp = `#${tableId}`;
        const func = genJsonfromHTML(tableIdWithSharp, tableId, true);
        let data;
        $(tableIdWithSharp).find('select').each((_, ele) => {
            if (ele.name) {
                data = func(ele.name, e => $(e).val());
            }
        });

        return data;
    };

    const getSettingModeData = (tableId) => {
        const tableIdWithSharp = `#${tableId} tbody tr`;
        const tblVisualConfig = {
            tblVisualConfig: {
                controlColumn: [],
                filterValue: [],
            }
        };
        $(tableIdWithSharp).each((k, tr) => {
            const controlItem = $(tr).find('select[name="controlColumn"]')[0].value;
            const filterItem = $(tr).find('input[name="filterColumnId"]')[0].value;
            tblVisualConfig.tblVisualConfig.controlColumn.push(controlItem);
            tblVisualConfig.tblVisualConfig.filterValue.push(filterItem);
        });
        return tblVisualConfig;
    };

    const getExcelModeData = (tableId) => {
        const spreadsheet = document.getElementById(tableId).jspreadsheet;
        const data = spreadsheet ? spreadsheet.getData() : [];
        return data;
    };

    const convertIdxToExcelCol = (idx) => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUWXYZ';
        if (isEmpty(idx) || idx >= alphabet.length) return '';
        return alphabet[idx];
    };

    const checkExcelDataValid = (editData,
        colNames = masterHeaderName,
        validationColNames = ['controlColumn', 'filterColumnId', 'filterValue']) => {
        const filterColAsParent = ['filterColumnId'];
        const intCols = ["lcl", "ucl", "prcMin", "prcMax", "ymin", "ymax"];
        const datetimeCols = ["actFromDateTime", "actToDateTime"];
        const settingRef = buildReferences();
        const errorCells = [];
        const errCellByIndexs = [];
        let parentId = [];

        for (const validationCol of colNames) {
            const colIdx = colNames.indexOf(validationCol);
            if (colIdx < 0) continue;

            for (const rowIdx in editData) {
                const row = editData[rowIdx];
                const cellValue = `${row[colIdx]}`.trim();
                let isError = false;
                let validator;

                if (validationColNames.includes(validationCol)) {

                    if (!parentId[rowIdx]) {
                        validator = getNode(settingRef, [validationCol, cellValue]);
                    } else {
                        validator = getNode(settingRef, [validationCol, parentId[rowIdx], cellValue]);
                        if (cellValue === settingRef.filterValue.default.trim()) {
                            validator = true;
                        }
                    }

                    // try to get validator from filterValue option (3rd col)
                    parentId[rowIdx] = null;
                    if (filterColAsParent.includes(validationCol)) {
                        parentId[rowIdx] = validator;
                    }
                } else if(intCols.includes(validationCol)) {
                    // eslint-disable-next-line no-restricted-globals
                    validator = !isNaN(Number(cellValue));
                } else {
                    // datetime
                    validator = isValidDatetime(cellValue);
                }


                // check validator
                if (!validator && cellValue !== '') {
                    isError = true;
                }
                if (isError) {
                    const errorCell = `${convertIdxToExcelCol(colIdx)}${parseInt(rowIdx) + 1}`;
                    errorCells.push(errorCell);
                }
            }
        }

        if (errorCells.length) {
            const originalStyleParams = errorCells.reduce((a, b) => ({ ...a, [b]: 'color:white;' }), {});
            const styleParams = errorCells.reduce((a, b) => ({ ...a, [b]: 'color:red;' }), {});
            document.getElementById(eles.spreadsheetID).jspreadsheet.setStyle(originalStyleParams);
            document.getElementById(eles.spreadsheetID).jspreadsheet.setStyle(styleParams);
            return false;
        }
        return true;
    };
    const validateData = editData => checkExcelDataValid(editData,
        masterHeaderName,
        ['controlColumn', 'filterColumnId', 'filterValue']) // TODO validate line name too
    ;
    const clearConfigTable = () => {
        $(eles.tblConfigBody).empty();
    };
    const sendSpreadSheetDataToSetting = (tableId, settingData, editData) => {
        console.log(settingData);
        console.log(editData);
        clearConfigTable();

        const mergedConfigRows = mergeData(editData, settingData);
        let tblConfigDOM = '';
        for (const configRow of mergedConfigRows) {
            const [_, rowDOM] = addConfigRow(configRow, false);
            tblConfigDOM += rowDOM;
        }
        $(eles.tblConfigBody).html(tblConfigDOM);
        updateTableRowNumber(eles.tblVisualConfig)
    };

    const showSpreadMode = (force = false) => {
        console.time('swithMode');
        const filterName = 'visualization';
        const isEditMode = isEmpty($(eles.visualConfigRegister).attr('disabled'));
        if (isEditMode) { // go to excel mode
            // clear spreads content before get items
            $(`#${eles.spreadsheetID}`).html('');
            generateSpreadSheet(filterName);
        } else {
            const tableId = eles.tblVisualConfig;
            const settingData = getSettingModeData(tableId);
            // const jexcelDivId = $(eles.spreadsheetID).attr('id');
            const editData = getExcelModeData(eles.spreadsheetID);
            if (force) {
                sendSpreadSheetDataToSetting(tableId, settingData, editData);
            } else {
                const validData = validateData(editData);
                // const validData = true;
                if (validData) {
                    sendSpreadSheetDataToSetting(tableId, settingData, editData);
                } else {
                    // show confirm modal
                    $(eles.filterConfirmSwitchModal).modal('show');
                    return;
                }
            }
        }
        showHideModes(isEditMode);
        console.timeEnd('swithMode');
    };


    return {
        showSettings,
        addConfigRow,
        validate,
        register,
        deleteRow,
        editRow,
        updateLabel,
        filterRow,
        showSpreadMode,
        initRowEvents,
        eles,
    };
})();

// eslint-disable-next-line no-unused-vars
const displayMessage = (alertID, message = { content: '', is_error: false }, card = '') => {
    if (isEmpty(alertID)) return;
    const alertIdWithCard = card === '' ? `#${alertID}` : `${card} #${alertID}`;
    $(`${alertIdWithCard}-content`).html(message.content);

    if (!message.is_error) {
        $(`${alertIdWithCard}`).css('display', 'block');
        $(`${alertIdWithCard}`).removeClass('alert-danger');
        $(`${alertIdWithCard}`).addClass('show alert-success');
        // setTimeout(() => {
        //     $(`${alertIdWithCard}`).removeClass('show alert-success');
        //     $(`${alertIdWithCard}`).css('display', 'none');
        // }, 10000);
    } else if (message.is_error) {
        $(`${alertIdWithCard}`).css('display', 'block');
        $(`${alertIdWithCard}`).removeClass('alert-success');
        $(`${alertIdWithCard}`).addClass('show alert-danger');
        // setTimeout(() => {
        //     $(`${alertIdWithCard}`).removeClass('show alert-danger');
        //     $(`${alertIdWithCard}`).css('display', 'none');
        // }, 10000);
    }
};


$(() => {
    // add new row
    visualModule.eles.addVisualConfig.click(() => {
        const [rowId, rowDOM] = visualModule.addConfigRow(new CfgVisualization(), true);
        visualModule.eles.tblConfigBody.append(rowDOM);
        visualModule.initRowEvents($(`#${rowId}`));
        updateTableRowNumber(visualModule.eles.tblVisualConfig);
    });

    // validate
    $(visualModule.eles.visualConfigRegister).click(() => {
        if (visualModule.validate() === false) return;
        visualModule.eles.modalId.modal('show');
    });

    // register yaml
    visualModule.eles.confirmButton.click(() => {
        visualModule.register();
    });

    $(visualModule.eles.changeModeBtn).unbind('click');
    $(visualModule.eles.changeModeBtn).click(() => {
        visualModule.showSpreadMode();
    });

    $(visualModule.eles.confirmSwitchButton).off('click').click((e) => {
        visualModule.showSpreadMode(true);
    });
    $(window).scrollTop(0);
});
