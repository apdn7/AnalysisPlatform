/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
const filterCfgGenerator = ((cardId, filterType = filterTypes.OTHER) => {
    const conditionFormula = {
        matches: 'MATCHES',
        endswith: 'ENDSWITH',
        startswith: 'STARTSWITH',
        contains: 'CONTAINS',
        regex: 'REGEX',
        substring: 'SUBSTRING',
        orSearch: 'OR_SEARCH',
        andSearch: 'AND_SEARCH',
    };
    const applySearchFormulas = [conditionFormula.matches, conditionFormula.andSearch, conditionFormula.orSearch];
    const multipleSelect2Formulas = [conditionFormula.andSearch, conditionFormula.orSearch];
    const singleSelect2Formulas = [conditionFormula.matches];

    /* eslint-disable no-undef */
    const eles = {
        addConfigBtn: `.card#${cardId} [name=addConfig]`,
        name: 'filterName',
        filterDetailId: 'filterDetailId',
        filterCondition: 'filterCondition',
        filterConditionSelect2Name: 'filterConditionSelect2',
        startDigit: 'startDigit',
        registerBtn: `.card#${cardId} [name=configRegister]`,
        searchInput: `.card#${cardId} [name=SearchOtherFilter]`,
        changeModeBtn: `.card#${cardId} .changeMode`,
        deleteBtn: `.card#${cardId} [name=configDelete]`,
        confirmDeleteFilterBtn: `.card#${cardId} .delete-cfg-btn`,
        confirmButton: `.card#${cardId} #confirmRegister`,
        confirmSwitchButton: `.card#${cardId} [name=confirmSwitch]`,
        formula: 'filterConditionFormula',
        columnName: `.card#${cardId} [name=columnName]`,
        filterTitle: 'filterTitle',
        filterTitleName: `.card#${cardId} input[name=filterTitle]`,
        filterIdInput: `.card#${cardId} input[name=filterId]`,
        filterConditionInput: `.card#${cardId} input[name=filterCondition]`,
        filterConditionSelect2: `.card#${cardId} select[name=filterConditionSelect2]`,
        filterId: 'filterId',
        filterDetailParentId: 'filterDetailParentId',
        tblConfigId: `tblConfig${cardId}`,
        tblConfigBody: `#tblConfig${cardId} tbody`,
        conditionFormula: `.card#${cardId} [name=filterConditionFormula]`,
        modalId: `.card#${cardId} #filterConfirmModal`,
        switchModalId: `.card#${cardId} [name=filterConfirmSwitchModal]`,
        deleteModal: `.card#${cardId} .delete-cfg-modal`,
        selectedOptStr: 'selected="selected"',
        alertMsg: 'alertMsgSetting',
        alertCard: `.card#${cardId}`,
        thisCard: `.card#${cardId}`,
        spreadSheetContainer: `.card#${cardId} .editmode-container`,
        spreadSheet: `.card#${cardId} div[name=jexcel]`,
        noColumn: 'no_columns',
        otherColumnIdPrefix: 'otherColumnName',
    };

    const i18n = {
        requireTarget: $('#filterRequireTarget'),
        requireLine: $('#filterRequireLine'),
        requireFilter: $('#filterRequireFilter'),
        requireCondition: $('#filterRequireCondition'),
        dupFilter: $('#filterDupFilter'),
        dupCondition: $('#filterDupCondition'),
        saveOK: $('#saveOK').text(),
        saveFailed: $('#saveFailed').text(),
        matches: $('#filterMatches'),
        endsWith: $('#filterEndsWith'),
        startsWith: $('#filterStartsWith'),
        contains: $('#filterContains'),
        regex: $('#filterRegex'),
        substring: $('#filterSubstring'),
        orSearch: $('#filterOrSearch'),
        andSearch: $('#filterAndSearch'),
        noColumn: $('#i18nNAColumn').text(),
        settingMode: $('#filterSettingMode').text(),
        editMode: $('#filterEditMode').text(),
    };

    const startDigitOptionsHTML = '<option value="1" selected="selected">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option><option value="32">32</option><option value="33">33</option><option value="34">34</option><option value="35">35</option><option value="36">36</option><option value="37">37</option><option value="38">38</option><option value="39">39</option><option value="40">40</option><option value="41">41</option><option value="42">42</option><option value="43">43</option><option value="44">44</option><option value="45">45</option><option value="46">46</option><option value="47">47</option><option value="48">48</option><option value="49">49</option><option value="50">50</option><option value="51">51</option><option value="52">52</option><option value="53">53</option><option value="54">54</option><option value="55">55</option><option value="56">56</option><option value="57">57</option><option value="58">58</option><option value="59">59</option><option value="60">60</option><option value="61">61</option><option value="62">62</option><option value="63">63</option><option value="64">64</option><option value="65">65</option><option value="66">66</option><option value="67">67</option><option value="68">68</option><option value="69">69</option><option value="70">70</option><option value="71">71</option><option value="72">72</option><option value="73">73</option><option value="74">74</option><option value="75">75</option><option value="76">76</option><option value="77">77</option><option value="78">78</option><option value="79">79</option><option value="80">80</option><option value="81">81</option><option value="82">82</option><option value="83">83</option><option value="84">84</option><option value="85">85</option><option value="86">86</option><option value="87">87</option><option value="88">88</option><option value="89">89</option><option value="90">90</option><option value="91">91</option><option value="92">92</option><option value="93">93</option><option value="94">94</option><option value="95">95</option><option value="96">96</option><option value="97">97</option><option value="98">98</option><option value="99">99</option><option value="100">100</option>';

    const findFilterCondType = (formula) => {
        if ([conditionFormula.andSearch, conditionFormula.orSearch].includes(formula)) {
            return 2;
        }
        if ([conditionFormula.matches].includes(formula)) {
            return 1;
        }
        return 0;
    };

    const genSelectValueOptions = (filterCondition, select2Type, filterColumnData) => {
        const selectedValues = select2Type === 2 ? `${filterCondition}`.split(/[ ]+/) : [filterCondition]; // TODO split into 2 cases
        const selectedValueOptions = [];
        for (const val of selectedValues) {
            if (!isEmpty(val)) {
                selectedValueOptions.push(`<option value="${val}">${val}</option>`);
            }
        }
        const filterValueOptions = [];
        for (const val of filterColumnData) {
            if (!selectedValues.includes(`${val}`)) {
                filterValueOptions.push(`<option value="${val}">${val}</option>`);
            }
        }
        return [selectedValues, selectedValueOptions, filterValueOptions];
    };

    const bindEventsAfterAddRow = (startFromSelectPrefix, filterStartPosition, select2Type, selectedValues) => {
        // show startDigit select for partial match only
        // TODO add to function
        $(`#${startFromSelectPrefix}Select`).on('change', function changeFormulaHandler() {
            const startDigitElement = $(`#${startFromSelectPrefix}StartDigit`);
            const formulaElement = $(this);
            if (formulaElement.val() === `${conditionFormula.substring}`) {
                startDigitElement.css('display', 'block');
            } else {
                startDigitElement.css('display', 'none');
            }
            const condSelect2 = $(`#${startFromSelectPrefix}CondSelect2`);
            const condInput = $(`#${startFromSelectPrefix}CondInput`);

            exchangeSelectedValues(formulaElement, condSelect2, condInput);
        });

        if (select2Type) {
            const condSelect2 = $(`#${startFromSelectPrefix}CondSelect2`);
            condSelect2.select2(genSelect2Param(select2Type));
            condSelect2.val(selectedValues).trigger('change');
        }

        // normalization
        convertTextH2Z($(eles.thisCard));
    };

    const exchangeSelectedValues = (formulaElement, condSelect2, condInput) => {
        const [changeAction, newValue] = decideChangeAction(formulaElement, condSelect2, condInput);
        if (changeAction === 'x->2') {
            condSelect2.select2(genSelect2Param(2));
            condSelect2.val(null).trigger('change');
            condInput.attr('hidden', true);
            assignValueToSelect2(condSelect2, newValue);
        } else if (changeAction === 'x->1') {
            condSelect2.prop('multiple', false).select2(genSelect2Param(1));
            condSelect2.val(null).trigger('change');
            condInput.attr('hidden', true);
            assignValueToSelect2(condSelect2, newValue);
        } else if (changeAction === 'x->0') {
            let val = newValue || [];
            if (typeof (val) === 'string') {
                val = [val];
            }
            condInput.val(val.join(' '));
            condInput.attr('hidden', false);
            condSelect2.select2().next().hide();
        }
        const newFormula = formulaElement.val();
        formulaElement.attr('previousValue', newFormula);
    };

    const decideChangeAction = (formulaElement, condSelect2, condInput) => {
        const newFormula = formulaElement.val();
        const oldFormula = formulaElement.attr('previousValue');
        if (singleSelect2Formulas.includes(newFormula) && multipleSelect2Formulas.includes(oldFormula)) {
            return ['x->1', condSelect2.val()];
        }
        if (singleSelect2Formulas.includes(newFormula) && !applySearchFormulas.includes(oldFormula)) {
            return ['x->1', condInput.val()];
        }
        if (multipleSelect2Formulas.includes(newFormula) && singleSelect2Formulas.includes(oldFormula)) {
            return ['x->2', condSelect2.val()];
        }
        if (multipleSelect2Formulas.includes(newFormula) && !applySearchFormulas.includes(oldFormula)) {
            return ['x->2', condInput.val()];
        }
        if (!applySearchFormulas.includes(newFormula) && applySearchFormulas.includes(oldFormula)) {
            return ['x->0', condSelect2.val()];
        }
        return ['DO_NOTHING', null];
    };

    const generateLineOptionsHTML = (lineValues, lineMasters, selectedLine = '') => {
        // build line select options
        let linesHTML = '<option value="">---</option>';
        [].concat(lineValues).forEach((lineValue, i) => {
            let optionHTML = '';
            if (selectedLine === lineValue) {
                optionHTML = `<option selected="true" value="${lineValue}">${lineMasters[i]}</option>`;
            } else {
                optionHTML = `<option value="${lineValue}">${lineMasters[i]}</option>`;
            }
            linesHTML = linesHTML.concat(optionHTML);
        });

        return linesHTML;
    };


    const addConfigRow = (filterId = '', filterName = '', filterCondition = '',
        filterFunction = conditionFormula.matches, filterStartPosition = '',
        parentId = '', lineIds = [''], lineNames = ['---'], isMachineRow = false) => {
        const options = [i18n.matches, i18n.endsWith, i18n.startsWith, i18n.contains, i18n.regex, i18n.substring,
            i18n.orSearch, i18n.andSearch].map(e => e[0].innerText);
        const formula = filterFunction;
        const defaultSelected = conditionFormula.matches === formula ? eles.selectedOptStr : '';
        const endsSelected = conditionFormula.endswith === formula ? eles.selectedOptStr : '';
        const startsSelected = conditionFormula.startswith === formula ? eles.selectedOptStr : '';
        const regexSelected = conditionFormula.regex === formula ? eles.selectedOptStr : '';
        const substringSelected = conditionFormula.substring === formula ? eles.selectedOptStr : '';
        const orSearchSelected = conditionFormula.orSearch === formula ? eles.selectedOptStr : '';
        const andSearchSelected = conditionFormula.andSearch === formula ? eles.selectedOptStr : '';
        const showStartFrom = conditionFormula.substring === formula ? 'display:block' : 'display:none';
        const startFromSelectPrefix = generateRandomString(6); // use for startFromSelect

        const select2Type = findFilterCondType(formula);
        const hideCondInput = select2Type ? 'hidden' : '';
        const hideCondSelect2 = select2Type ? '' : 'hidden';
        const selectedColumn = $(eles.columnName).val();
        const filterColumnData = filterStore.getSelectedProcessConfig().getColumnData(selectedColumn);
        filterCondition = stringNormalization(filterCondition);
        filterName = stringNormalization(filterName);
        const [selectedValues, selectedValueOptions, filterValueOptions] = genSelectValueOptions(filterCondition, select2Type, filterColumnData);

        // build line select options
        let lineHTML = '';
        if (isMachineRow) {
            const lineOptionsHTML = generateLineOptionsHTML(
                [].concat(lineIds),
                [].concat(lineNames), parentId,
            );
            lineHTML = `<td>
                <select id="line${filterName}" name="filterDetailParentId" class="form-control select2-selection--single">
                    ${lineOptionsHTML}
                </select>
            </td>`;
        }

        $(eles.tblConfigBody).append(`
        <tr name="info">
            <td class="col-number"></td>
            <td style="display: none">
                <input name="filterDetailId" class="form-control" type="text" value="${filterId}">
            </td>
            ${lineHTML}
            <td>
                <input name="filterName" class="form-control" type="text" value="${filterName}"
                ${dragDropRowInTable.DATA_ORDER_ATTR}>
            </td>
            <td class="td-lg">
                <input name="filterCondition" id="${startFromSelectPrefix}CondInput"  class="form-control" type="text" value="${filterCondition}" ${hideCondInput}>
                <select name="filterConditionSelect2" id="${startFromSelectPrefix}CondSelect2" class="form-control convert-h2z" ${hideCondSelect2}>
                    ${selectedValueOptions.join('')}
                    ${filterValueOptions.join('')}
                </select>
            </td>
            <td class="">
                <select name="filterConditionFormula" partno="${filterId}" id="${startFromSelectPrefix}Select" class="form-control" previousValue="${formula}">
                    <option value="">---</option>
                    <option value="${conditionFormula.andSearch}" ${andSearchSelected}>${options[7]}</option>
                    <option value="${conditionFormula.orSearch}" ${orSearchSelected}>${options[6]}</option>
                    <option value="${conditionFormula.substring}" ${substringSelected}>${options[5]}</option>
                    <option value="${conditionFormula.matches}" ${defaultSelected}>${options[0]}</option>
                    <option value="${conditionFormula.startswith}" ${startsSelected}>${options[2]}</option>
                    <option value="${conditionFormula.endswith}" ${endsSelected}>${options[1]}</option>
                    <option value="${conditionFormula.regex}" ${regexSelected}>${options[4]}</option>
                </select>
            </td>
            <td class="text-center">
                <div class="" style="${showStartFrom}" id="${startFromSelectPrefix}StartDigit">
                    <select class="form-control select2-selection--single" name="startDigit" id="${startFromSelectPrefix}StartFromSelect">
                        ${startDigitOptionsHTML}
                    </select>
                </div>
            </td>
            <td class="text-center">
                <button onclick="delClosestEle(this, 'tr');" type="button" class="btn btn-secondary btn-left">
                    <i class="fas fa-trash-alt icon-secondary"></i>
                </button>
            </td>
        </tr>
        `);

        // load startDigit value to UI
        if (substringSelected) {
            $(`#${startFromSelectPrefix}StartFromSelect`).val(`${filterStartPosition}`);
        }

        bindEventsAfterAddRow(startFromSelectPrefix, filterStartPosition, select2Type, selectedValues);
    };

    const calcByteLength = (val) => {
        let leg = val.length;
        for (const i in val) {
            if (val.hasOwnProperty(i)) {
                const db = val[i].charCodeAt(0).toString(16).length === 4;
                if (db) leg += 1;
            }
        }
        return leg;
    };

    const calcMaxLengthColName = (columns) => {
        let maxLen = 0;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].name) {
                if (calcByteLength(columns[i].name) > maxLen) {
                    maxLen = columns[i].name.length;
                }
            }
        }
        return maxLen;
    };

    const appendColumnList = (columnElement, columns) => {
        [].concat(columns).forEach((col) => {
            columnElement.append(
                `<option value="${col.id}" title="${col.column_name}" class="shorten-name">${col.name}</option>`,
            );
        });
    };

    const genSelect2Param = (type = 1, data = []) => {
        const params = {
            width: '100%',
            allowClear: true,
            tags: true,
            placeholder: '',
        };
        if (type === 2) {
            params.multiple = true;
            params.tokenSeparators = [' ', '\n'];
        }
        if (data && data.length) {
            params.data = data;
        }
        return params;
    };

    const bindOnchangeColumnEvent = () => {
        // // TODO column on change, code here, refactor later
        $(eles.columnName).unbind('change');
        $(eles.columnName).on('change', async function updateColumnData() {
            const colId = $(this).val();
            const procConfig = filterStore.getSelectedProcessConfig();
            await procConfig.updateColDataFromUDB(colId);
            const newColumnData = procConfig.getColumnData(colId);
            const select2Data = newColumnData.map(val => ({ id: val, text: val }));
            $(eles.filterConditionSelect2).each(function updateOptions() {
                const condSelect2 = $(this);
                const formula = condSelect2.closest('tr').find('select[name=filterConditionFormula]').val();
                const select2Type = findFilterCondType(formula);
                const selectedValue = condSelect2.val();
                condSelect2.empty();
                condSelect2.select2(genSelect2Param(select2Type, select2Data));
                assignValueToSelect2(condSelect2, selectedValue);

                if (!select2Type) {
                    condSelect2.select2().next().hide();
                }
            });
        });
    };
    const genColumnNameSelectBox = (procConfig, selectedColumn = '') => {
        const columnElement = $(eles.columnName);
        columnElement.empty();
        columnElement.append('<option value="">---</option>');
        columnElement.val('');
        const { columns } = procConfig;
        appendColumnList(columnElement, columns);
        columnElement.val(selectedColumn);
        columnElement.id = bindOnchangeColumnEvent();
    };

    const genLineColumnNameSelectBox = (procConfig, selectedLineColumn = '') => {
        const columnElement = $(eles.columnName);
        columnElement.empty();
        columnElement.append('<option value="">---</option>');
        columnElement.append(`<option value="${eles.noColumn}" data-column="N/A">${i18n.noColumn} </option>`);
        columnElement.val('');
        const { columns } = procConfig;
        const maxLen = calcMaxLengthColName(columns);
        appendColumnList(columnElement, columns, maxLen);
        if (isEmpty(selectedLineColumn)) {
            columnElement.val(eles.noColumn);
        } else {
            columnElement.val(selectedLineColumn);
        }

        bindOnchangeColumnEvent();
    };

    const showLineSetting = async (processConfig) => {
        // clear card
        clearCurrentCardSettings();

        // gen column select box
        genLineColumnNameSelectBox(processConfig);

        const cfgProcess = filterStore.getSelectedProcessConfig();

        const { filters } = processConfig;
        const filterConfig = getFilterByType(filters, filterType);
        if (filterConfig) {
            const filterCardId = htmlCardId.LINE;
            const filterColumnId = filterConfig.column_id;
            await cfgProcess.updateColDataFromUDB(filterColumnId);
            showSettings(processConfig, filterCardId, filterConfig);
        }
    };

    const showMachineSetting = async (processConfig) => { // todo refactor
        // clear card
        clearCurrentCardSettings();

        // gen column select box
        genColumnNameSelectBox(processConfig);

        const cfgProcess = filterStore.getSelectedProcessConfig();

        const { filters } = processConfig;
        const filterConfig = getFilterByType(filters, filterTypes.MACHINE_ID);
        if (filterConfig) {
            const filterCardId = htmlCardId.MACHINE_ID;
            const filterColumnId = filterConfig.column_id;
            await cfgProcess.updateColDataFromUDB(filterColumnId);
            showSettings(processConfig, filterCardId, filterConfig);
        }
    };

    const getFilterByType = (filters, filterType) => {
        for (const filterConfig of filters) {
            if (filterConfig && filterConfig.filter_type === filterType) {
                return filterConfig;
            }
        }
        return null;
    };

    const showPartnoSetting = async (processConfig) => {
        // clear card
        clearCurrentCardSettings();

        // gen column select box
        genColumnNameSelectBox(processConfig);

        const cfgProcess = filterStore.getSelectedProcessConfig();

        const { filters } = processConfig;
        const filterConfig = getFilterByType(filters, filterTypes.PART_NO);
        if (filterConfig) {
            const filterCardId = htmlCardId.PART_NO;
            const filterColumnId = filterConfig.column_id;
            await cfgProcess.updateColDataFromUDB(filterColumnId);
            showSettings(processConfig, filterCardId, filterConfig);
        }
    };

    const clearColumn = () => {
        const columnElement = $(eles.columnName);
        columnElement.empty();
        columnElement.append('<option value="">---</option>');
    };

    const clearConfigTable = () => {
        $(eles.tblConfigBody).empty();
    };

    const clearCurrentCardSettings = () => {
        // clear current setting UI
        clearColumn();
        $(eles.filterIdInput).val('');
        clearConfigTable();
        resetGUI();
    };

    const extractFilterDetail = (filter) => {
        const filterId = filter.id;
        const filterDetailIds = [];
        const filterDetailConditions = [];
        const filterDetailFunctions = [];
        const filterDetailFromPositions = [];
        const filterDetailNames = [];
        const filterDetailParentIds = [];
        const selectedColumnId = filter.column_id;
        const filterName = filter.name;
        const filterDetails = filter.filter_details || [];
        filterDetails.forEach((filterDetail) => {
            filterDetailIds.push(filterDetail.id);
            filterDetailConditions.push(filterDetail.filter_condition);
            filterDetailFunctions.push(filterDetail.filter_function);
            filterDetailFromPositions.push(filterDetail.filter_from_pos);
            filterDetailNames.push(filterDetail.name);
            filterDetailParentIds.push(filterDetail.parent_detail_id);
        });

        return [filterId, selectedColumnId, filterDetailIds, filterDetailConditions, filterDetailNames, filterDetailParentIds,
            filterDetailFunctions, filterDetailFromPositions, filterName];
    };

    const getFilterDetails = (procConfig, filterType) => { // todo move
        // get filter details
        const selectedColumnId = null;
        const filterName = null;
        const filterId = null;
        const filters = procConfig.filters || [];
        const filterDetailIds = [];
        const filterDetailConditions = [];
        const filterDetailFunctions = [];
        const filterDetailFromPositions = [];
        const filterDetailNames = [];
        const filterDetailParentIds = [];
        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            if (filter.filter_type === filterType) {
                return extractFilterDetail(filter);
            }
        }
        return [filterId, selectedColumnId, filterDetailIds, filterDetailConditions, filterDetailNames, filterDetailParentIds,
            filterDetailFunctions, filterDetailFromPositions, filterName];
    };

    const getLineNameById = (filterDetail, filterLineID) => {
        const [_0, _1, lineIds, _2, lineNames] = filterDetail;
        if (lineIds.includes(filterLineID)) {
            const lineIndex = lineIds.indexOf(filterLineID);
            return lineNames[lineIndex];
        }
        return null;
    };

    // eslint-disable-next-line no-unused-vars
    const showSettings = (procConfig, filterCardId, filterConfig) => {
        if (!procConfig) return;

        clearCurrentCardSettings();

        // extract filter details
        const [filterId, selectedColumn, filterDetailIds, filterConds, filterNames, parentIds,
            filterFunctions, filterFromPositions, filterName] = extractFilterDetail(filterConfig);
        const [_0, _1, lineIds, _2, lineNames, _3] = getFilterDetails(procConfig, filterTypes.LINE);

        // generate select column
        if (filterCardId === htmlCardId.LINE) {
            genLineColumnNameSelectBox(procConfig, selectedColumn);
        } else {
            genColumnNameSelectBox(procConfig, selectedColumn);
        }

        // set filter_id to match db record when save/delete
        $(eles.filterIdInput).val(filterId);

        // set filter title/name
        $(eles.filterTitleName).val(filterName);
        // add config detail row
        filterDetailIds.forEach((filterDetailId, idx) => {
            if (filterCardId === htmlCardId.MACHINE_ID) {
                // only machine has parent column
                addConfigRow(
                    filterDetailId,
                    filterNames[idx],
                    filterConds[idx],
                    filterFunctions[idx],
                    filterFromPositions[idx],
                    parentIds[idx],
                    lineIds,
                    lineNames,
                    true,
                );
            } else {
                addConfigRow(filterDetailId, filterNames[idx], filterConds[idx], filterFunctions[idx], filterFromPositions[idx]);
            }
        });

        // resort table
        dragDropRowInTable.sortRowInTable(eles.tblConfigId, procConfig.id);
        updateTableRowNumber(eles.tblConfigId);
    };

    const collectSelect2Values = () => {
        const select2Elements = $(eles.filterConditionSelect2);
        return select2Elements.map((i, ele) => {
            const val = $(ele).val();
            if (isEmpty(val)) return val;
            if (typeof (val) === 'object') {
                return val.join(' ');
            }
            return val;
        });
    };

    const getEles = () => {
        const target = $(eles.columnName).children('option:selected').val();
        const ROOT = 'root';
        const genJson = genJsonfromHTML($(eles.thisCard), ROOT, true);
        genJson(eles.name);
        genJson(eles.filterId);
        genJson(eles.filterDetailParentId);
        genJson(eles.filterCondition);
        genJson(eles.filterConditionSelect2Name);
        genJson(eles.filterDetailId);
        genJson(eles.startDigit);
        genJson(eles.filterTitle);
        const data = genJson(eles.formula);
        const filterId = data[ROOT][eles.filterId] || [];
        const filterDetailParentIds = data[ROOT][eles.filterDetailParentId] || [];
        const names = data[ROOT][eles.name];
        const formulas = data[ROOT][eles.formula];
        const filterConditionInputs = data[ROOT][eles.filterCondition];
        const filterConditionSelect2s = collectSelect2Values();
        const filterConditions = [];
        for (const i in formulas) {
            if (applySearchFormulas.includes(formulas[i])) {
                filterConditions.push(filterConditionSelect2s[i]);
            } else {
                filterConditions.push(filterConditionInputs[i]);
            }
        }
        const filterDetailIds = data[ROOT][eles.filterDetailId];
        const startFroms = data[ROOT].startDigit;
        const filterTitle = data[ROOT][eles.filterTitle] || [];
        return [filterId.join(''), target,
            names, filterConditions, formulas, filterDetailIds, startFroms,
            filterTitle.join(''), filterDetailParentIds];
    };

    // eslint-disable-next-line no-unused-vars
    const displayMessage = (alertID, message = { content: '', is_error: false }, card = '') => {
        if (isEmpty(alertID)) return;
        const alertIdWithCard = card === '' ? `#${alertID}` : `${card} #${alertID}`;
        $(`${alertIdWithCard}-content`).html(message.content);
        const alert = $(`${alertIdWithCard}`);
        if (!message.is_error) {
            alert.css('display', 'block');
            alert.removeClass('alert-danger');
            alert.addClass('show alert-success');
            // setTimeout(() => {
            //     alert.removeClass('show alert-success');
            //     alert.css('display', 'none');
            // }, 5000);
        } else if (message.is_error) {
            alert.css('display', 'block');
            alert.removeClass('alert-success');
            alert.addClass('show alert-danger');
            // setTimeout(() => {
            //     alert.removeClass('show alert-danger');
            //     alert.css('display', 'none');
            // }, 5000);
        }
    };

    const invalidSetting = arr => !arr || ['', undefined, null].some(v => arr.includes(v));
    const genDuplicateCheckString = (...args) => {
        const SEPARATE = '|';
        let compareStr = '';
        for (const param of args) {
            if (Array.isArray(param)) {
                compareStr += param.sort().join();
            } else {
                compareStr += param.toString();
            }
            compareStr += SEPARATE;
        }

        return compareStr;
    };

    const validate = () => {
        let result = true;
        const [filterId, target, names, conditions, formulas, filterDetailIds, startFroms,
            filterTitle, filterDetailParentIds] = getEles();
        // when there is no data ( maybe user want to delete all data)
        if (names === null) {
            return result;
        }

        // check other null
        if (!target) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.requireTarget.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }

        if (invalidSetting(filterDetailParentIds)) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.requireLine.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }

        if (invalidSetting(names)) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.requireFilter.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }

        if (invalidSetting(conditions) || invalidSetting(formulas)) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.requireCondition.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }


        // check duplicate names
        const duplCheckNames = [];
        for (const i in names) {
            if (filterDetailParentIds.length) {
                duplCheckNames.push(`${filterDetailParentIds[i]}|${names[i]}`);
            } else {
                duplCheckNames.push(names[i]);
            }
        }
        if (new Set(duplCheckNames).size !== duplCheckNames.length) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.dupFilter.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }

        const duplCheckStrings = [];
        for (const i in formulas) {
            let parentId = '';
            if (filterDetailParentIds.length) {
                parentId = filterDetailParentIds[i];
            }
            const cond = preProcessCond(conditions[i], formulas[i]);
            const startFrom = preProcessStartDigit(startFroms[i], formulas[i]);
            const duplCheckStr = genDuplicateCheckString(parentId, cond, formulas[i], startFrom);
            duplCheckStrings.push(duplCheckStr);
        }
        if (new Set(duplCheckStrings).size !== duplCheckStrings.length) {
            displayMessage(eles.alertMsg,
                message = { content: i18n.dupCondition.text(), is_error: true }, eles.alertCard);
            result = false;
            return result;
        }

        return result;
    };

    const preProcessStartDigit = (startFrom, formula) => {
        if (formula !== conditionFormula.substring) return '';
        return startFrom;
    };

    const preProcessCond = (condition, formula) => {
        if (multipleSelect2Formulas.includes(formula)) {
            return `${condition}`.split(/[ ]+/).sort().join('|');
        }
        return condition;
    };

    const updateLineListForMachine = (procConfig) => {
        const usedLineSelectDropdowns = $('#tblConfig_machine select[name=filterDetailParentId]'); // const filterDetailParentId

        // get new line settings
        const [_0, _1, lineIds, _2, lineNames] = getFilterDetails(procConfig, filterTypes.LINE);

        // new selection key
        const nSKeys = [''].concat(lineIds);
        // new selecction value
        const nSNames = ['---'].concat(lineNames);
        usedLineSelectDropdowns.each((index, item) => {
            const selecedLine = $(item).val();
            let opt = '';
            let selected = '';
            nSKeys.forEach((value, key) => {
                if (selecedLine === `${value}`) {
                    selected = ' selected="selected"';
                } else {
                    selected = '';
                }
                opt += `<option value="${value}"${selected}>${nSNames[key]}</option>`;
            });
            $(item).empty();
            $(item).html(opt);
        });
    };

    // update order of tr when drag drop
    const updateOrder = (event) => {
        const tblBody = event.target;
        const processId = $(`#${filterElements.processListId}`).val();
        dragDropRowInTable.setItemLocalStorage(tblBody, processId);
    };

    const getConfigItems = (filterName) => {
        const i18nFormulas = {
            MATCHES: '#filterMatches',
            ENDSWITH: '#filterEndsWith',
            STARTSWITH: '#filterStartsWith',
            CONTAINS: '#filterContains',
            REGEX: '#filterRegex',
            SUBSTRING: '#filterSubstring',
            OR_SEARCH: '#filterOrSearch',
            AND_SEARCH: '#filterAndSearch',
        };
        const formJsonCollecter = genJsonfromHTML(`#${filterName}`, 'root', true);
        formJsonCollecter(filterElements.filterName);
        formJsonCollecter(filterElements.filterCondition);
        formJsonCollecter(filterElements.startDigit);
        formJsonCollecter(filterElements.filterId);
        formJsonCollecter(filterElements.filterDetailParentId);
        formJsonCollecter(filterElements.filterDetailId);
        formJsonCollecter(filterElements.filterTitle);
        const data = formJsonCollecter(filterElements.filterFormula).root;
        const filterDetailParentIds = data[filterElements.filterDetailParentId] || [];
        const names = data[filterElements.filterName];
        const formulas = data[filterElements.filterFormula];

        const filterConditionInputs = data[filterElements.filterCondition];
        const filterConditionSelect2s = collectSelect2Values();
        const filterConditions = [];
        for (const i in formulas) {
            if (applySearchFormulas.includes(formulas[i])) {
                filterConditions.push(filterConditionSelect2s[i]);
            } else {
                filterConditions.push(filterConditionInputs[i]);
            }
        }
        const filterDetailIds = data[filterElements.filterDetailId];
        const startFroms = data.startDigit;
        if (!filterDetailIds) {
            return [];
        }
        const filterDetails = getFilterDetails(filterStore.getSelectedProcess(), filterTypes.LINE);

        return [...Array(filterDetailIds.length).keys()].map((e, i) => {
            const filterRaw = [];
            if (filterDetailParentIds.length) {
                if (filterDetailParentIds[i]) {
                    const lineName = getLineNameById(filterDetails, Number(filterDetailParentIds[i]));
                    filterRaw.push(lineName);
                } else {
                    filterRaw.push('');
                }
            }
            filterRaw.push(names[i]);
            filterRaw.push(filterConditions[i]);
            filterRaw.push($(i18nFormulas[formulas[i]]).text());
            if (formulas[i] === 'SUBSTRING') {
                filterRaw.push(startFroms[i]);
            } else {
                filterRaw.push('');
            }
            return filterRaw;
        });
    };

    const switchMode = async (spreadTableDOM, force = false) => {
        const isEditMode = isEmpty($(eles.registerBtn).attr('disabled'));
        if (isEditMode) { // go to excel mode
            $(eles.spreadSheet).html('');
            await generateSpreadSheet(spreadTableDOM);
        } else { // convert -> back to setting mode
            const tableId = eles.tblConfigId;
            const settingData = getSettingModeData(tableId);
            const jexcelDivId = $(eles.spreadSheet).attr('id');
            const editData = getExcelModeData(jexcelDivId);
            if (force) {
                sendSpreadSheetDataToSetting(tableId, settingData, editData);
            } else {
                const validData = validateData(editData);
                if (validData) {
                    sendSpreadSheetDataToSetting(tableId, settingData, editData);
                } else {
                    $(eles.switchModalId).modal('show');
                    return;
                }
            }
        }
        showHideModes(isEditMode);
    };


    const validateData = (editData) => {
        if (cardId !== htmlCardId.MACHINE_ID) {
            return checkExcelDataValid(editData,
                ['filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'],
                ['filterConditionFormula', 'startDigit']);
        }
        return checkExcelDataValid(editData,
            ['lineName', 'filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'],
            ['lineName', 'filterConditionFormula', 'startDigit']); // TODO validate line name too
    };

    const sendSpreadSheetDataToSetting = (tableId, settingData, editData) => {
        clearConfigTable();

        if (cardId !== htmlCardId.MACHINE_ID) {
            const mergedConfigRows = mergeData(
                editData,
                settingData,
                ['filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'],
                'filterName',
            );
            for (const configRow of mergedConfigRows) {
                const {
                    filterDetailId,
                    filterName,
                    filterCondition,
                    filterConditionFormula,
                    startDigit,
                } = configRow;
                addConfigRow(filterDetailId, filterName, filterCondition, filterConditionFormula, startDigit);
            }
        } else {
            const mergedConfigRows = mergeData(editData, settingData,
                ['lineName', 'filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'],
                'filterName');
            const [_0, _1, lineIds, _2, lineNames] = getFilterDetails(filterStore.getSelectedProcess(), filterTypes.LINE);

            for (const configRow of mergedConfigRows) {
                const {
                    filterDetailId,
                    lineName,
                    filterName,
                    filterCondition,
                    filterConditionFormula,
                    startDigit,
                } = configRow;

                addConfigRow(
                    filterDetailId,
                    filterName,
                    filterCondition,
                    filterConditionFormula,
                    startDigit,
                    lineName,
                    lineIds,
                    lineNames,
                    true,
                );
            }
        }

        updateTableRowNumber(eles.tblConfigId);
    };

    const convertIdxToExcelCol = (idx) => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUWXYZ';
        if (isEmpty(idx) || idx >= alphabet.length) return '';
        return alphabet[idx];
    };

    const checkExcelDataValid = (editData,
        colNames = ['filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'],
        validationColNames = ['filterConditionFormula']) => {
        const formulas = [i18n.matches, i18n.endsWith, i18n.startsWith, i18n.contains, i18n.regex, i18n.substring,
            i18n.orSearch, i18n.andSearch].map(e => e[0].innerText);
        formulas.push('');

        const [_0, _1, lineIds, _2, validLineNames, _3] = getFilterDetails(filterStore.getSelectedProcess(), filterTypes.LINE);
        validLineNames.push('');

        const errorCells = [];
        for (const validationCol of validationColNames) {
            const colIdx = colNames.indexOf(validationCol);
            if (colIdx < 0) continue;

            for (const rowIdx in editData) {
                const row = editData[rowIdx];
                const cellValue = row[colIdx];
                let isError = false;
                if (validationCol === 'filterConditionFormula' && !formulas.includes(cellValue)) { // formula
                    isError = true;
                } else if (validationCol === 'lineName' && !validLineNames.includes(cellValue)) { // line name
                    isError = true;
                } else if (validationCol === 'startDigit' && !isEmpty(cellValue)) { // digit
                    if (!(Number(cellValue) >= 1 && Number(cellValue) <= 100)) {
                        isError = true;
                    }
                }
                if (isError) {
                    const errorCell = `${convertIdxToExcelCol(colIdx)}${parseInt(rowIdx) + 1}`;
                    errorCells.push(errorCell);
                }
            }
        }

        if (errorCells.length) {
            const jexcelDivId = $(eles.spreadSheet).attr('id');
            resetColor(jexcelDivId);
            colorErrorCells(jexcelDivId, errorCells);
            return false;
        }
        return true;
    };

    const resetColor = (jexcelDivId) => {
        $(`#${jexcelDivId}`).find('table td').css('color', 'white');
    };

    const buildReferences = () => { // TODO collect dynamically
        const dicFormulaName2Val = {};
        dicFormulaName2Val[i18n.matches.text()] = conditionFormula.matches;
        dicFormulaName2Val[i18n.endsWith.text()] = conditionFormula.endswith;
        dicFormulaName2Val[i18n.startsWith.text()] = conditionFormula.startswith;
        dicFormulaName2Val[i18n.contains.text()] = conditionFormula.substring;
        dicFormulaName2Val[i18n.regex.text()] = conditionFormula.regex;
        dicFormulaName2Val[i18n.substring.text()] = conditionFormula.substring;
        dicFormulaName2Val[i18n.orSearch.text()] = conditionFormula.orSearch;
        dicFormulaName2Val[i18n.andSearch.text()] = conditionFormula.andSearch;

        const [_0, _1, lineIds, _2, validLineNames, _3] = getFilterDetails(filterStore.getSelectedProcess(), filterTypes.LINE);
        const dicLineName2Val = validLineNames.reduce((o, k, i) => ({ ...o, [k]: lineIds[i] }), {});

        return {
            lineName: dicLineName2Val,
            filterConditionFormula: dicFormulaName2Val,
        };
    };

    const mergeData = (editData, settingData, colNames = ['filterName', 'filterCondition', 'filterConditionFormula', 'startDigit'], mapKey = 'filterName') => {
        const settingDataRoot = eles.tblConfigId;
        const settingDataRows = settingData[settingDataRoot] || [];
        const settingKeyVals = settingDataRows[mapKey] || [];
        let keyColIdx = colNames.indexOf(mapKey);
        if (keyColIdx < 0) keyColIdx = 0;
        const selectReferences = buildReferences();

        const outputRows = [];
        for (const rowIdx in editData) {
            const outputRow = {};
            const row = editData[rowIdx];
            for (const colIdx in colNames) {
                const colName = colNames[colIdx];
                let cellValue = row[colIdx];
                if (colName in selectReferences) {
                    // cellValue = selectReferences[colName][cellValue] || cellValue;
                    cellValue = getNode(selectReferences, [colName, cellValue]) || cellValue;
                }
                outputRow[colName] = cellValue;
            }
            const keyVal = row[keyColIdx] || row[0]; // "15~"
            let filterDetailId = '';
            const matchedRowIdx = settingKeyVals.indexOf(keyVal);
            if (matchedRowIdx >= 0) { // update
                filterDetailId = settingDataRows.filterDetailId[matchedRowIdx];
            }
            outputRow.filterDetailId = filterDetailId;
            outputRows.push(outputRow);
        }
        return outputRows;
    };

    const generateSpreadSheet = async (spreadTableDOM) => {
        const numRows = $(eles.tblConfigBody).find('tr').length;
        if (!numRows) {
            await $(eles.addConfigBtn).click();
        }

        // get config data
        const configDat = getConfigItems(cardId);

        const getCols = () => {
            const headerLabels = [];
            const colWidths = [];
            $(`#tblConfig${cardId}`).find('thead th').each((_, th) => {
                const colspan = $(th).attr('colspan');
                let headerName = $(th).text();
                headerName = headerName.replaceAll('\n', '').trim();
                const colWidth = $(th).width() + 6;
                if (colspan) {
                    headerLabels.push(...Array(Number(colspan)).fill(headerName));
                    colWidths.push(...Array(Number(colspan)).fill(colWidth / 2));
                } else if (headerName) {
                    headerLabels.push(headerName);
                    colWidths.push(colWidth);
                }
            });
            const spreadWidth = colWidths.reduce((a, b) => a + b);
            const orgTableWidth = $(`#${cardId} form`).width();
            // increase end column
            colWidths[colWidths.length - 1] += orgTableWidth - spreadWidth - 50;
            return { headerLabels, colWidths };
        };
        const tableHeadInfor = getCols();

        const numCols = tableHeadInfor.headerLabels.length;
        jspreadsheet(document.getElementById(`${spreadTableDOM}`), {
            data: configDat,
            colHeaders: tableHeadInfor.headerLabels.slice(1, numCols),
            colWidths: tableHeadInfor.colWidths.slice(1, numCols),
            defaultColAlign: 'left',
        });
    };

    const resetGUI = () => { // todo refactor later
        $(`#tblConfig${cardId}`).removeClass('hide');
        $(eles.spreadSheetContainer).addClass('hide');
        $(eles.addConfigBtn).removeClass('hide');
        $(`${eles.changeModeBtn} span`).text(` ${i18n.editMode}`);
        $(eles.registerBtn).attr('disabled', false);
    };

    const showHideModes = (isEditMode) => {
        // show/hide tables
        $(`#tblConfig${cardId}`).toggleClass('hide');
        $(eles.spreadSheetContainer).toggleClass('hide');
        $(eles.addConfigBtn).toggleClass('hide');

        if (isEditMode) {
            $(`${eles.changeModeBtn} span`).text(` ${i18n.settingMode}`);
        } else {
            $(`${eles.changeModeBtn} span`).text(` ${i18n.editMode}`);
        }
        $(eles.registerBtn).attr('disabled', isEmpty($(eles.registerBtn).attr('disabled')));
    };


    const register = () => {
        const [filterId, selectedColumnName, filterDetailNames, filterConditions, filterFunctions, fitlerDetailIds, filterStartFroms,
            filterName, filterDetailParentIds] = getEles();

        const processId = $(filterElements.processList).val();

        const requestData = {
            filterId,
            columnName: selectedColumnName === eles.noColumn ? null : selectedColumnName,
            filterDetailParentIds,
            filterDetailNames,
            filterConditions,
            filterFunctions,
            fitlerDetailIds,
            filterStartFroms,
            filterName,
            processId,
            filterType,
        };

        fetch('/histview2/api/setting/filter_config', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        })
            .then((response) => {
                if (!response.ok) {
                    throw Error('');
                } else {
                    return response.clone().json();
                }
            })
            .then((res) => {
                displayMessage(eles.alertMsg,
                    { content: i18n.saveOK, is_error: false }, eles.alertCard);

                const procConfig = res.proc;

                // update procConfig filterStore
                filterStore.setSelectedProcess(procConfig);

                // refresh settings
                if (filterType === filterTypes.LINE) {
                    showLineSetting(procConfig).then(() => {
                        updateLineListForMachine(procConfig);
                    });
                } else if (filterType === filterTypes.MACHINE_ID) {
                    showMachineSetting(procConfig).then(() => {
                    });
                } else if (filterType === filterTypes.PART_NO) {
                    showPartnoSetting(procConfig).then(() => {
                    });
                } else if (filterType === filterTypes.OTHER) {
                    const savedFilterId = res.filter_id;
                    const { filters } = procConfig;
                    for (const filterConfig of filters) { // todo refactor, return the whole filter
                        if (filterConfig.id === savedFilterId) {
                            showSettings(procConfig, cardId, filterConfig);
                        }
                    }
                }
            })
            .catch(() => {
                displayMessage(eles.alertMsg,
                    { content: i18n.saveFailed, is_error: true }, eles.alertCard);
            });
    };

    // delete other div
    const deleteConfigHTML = () => {
        $(eles.thisCard).fadeOut();
        setTimeout(() => {
            $(eles.thisCard).remove();
        }, 500);
    };

    const clearFilter = () => {
        // clear current setting UI
        $(eles.tblConfigBody).empty();
        $(eles.columnName).val('');
        $(`${eles.alertCard} ${eles.alertMsg}`).val('');
    };

    const deleteFilter = () => {
        deleteConfigHTML();

        const filterId = $(eles.filterIdInput).val();
        if (!filterId) return;

        fetch(`/histview2/api/setting/filter_config/${filterId}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        })
            .then((response) => {
                if (!response.ok) {
                    throw Error('');
                } else {
                    return response.clone().json();
                }
            })
            .then(() => {
                // displayMessage(eles.alertMsg,
                //     { content: validatorMessages.saved, is_error: false }, eles.alertCard);
            })
            .catch(() => {
                // displayMessage(eles.alertMsg,
                //     { content: validatorMessages.saveFail, is_error: true }, eles.alertCard);
            });
    };

    const genEvents = () => {
        // register a filter other
        $(eles.registerBtn).click(() => {
            if (validate() === false) return;
            $(eles.modalId).modal('show');
        });

        $(eles.confirmButton).off('click').on('click', (e) => {
            register();
        });

        $(eles.addConfigBtn).off('click').on('click', (e) => {
            if (cardId === htmlCardId.MACHINE_ID) {
                const [_0, _1, lineIds, _2, lineNames] = getFilterDetails(filterStore.getSelectedProcess(), filterTypes.LINE);
                addConfigRow('', '', '', conditionFormula.matches, '', '',
                    lineIds, lineNames, true); // todo check default
            } else {
                addConfigRow();
            }
            updateTableRowNumber(eles.tblConfigId);
        });

        $(eles.deleteBtn).click(() => {
            $(eles.deleteModal).modal('show');
        });

        $(eles.confirmDeleteFilterBtn).click(() => {
            deleteFilter();
        });

        $(eles.changeModeBtn).unbind('click');
        $(eles.changeModeBtn).off('click').click((e) => {
            const spreadTableDOM = $(e.currentTarget).attr('data-sm');
            switchMode(spreadTableDOM).then(() => {});
        });
        $(eles.confirmSwitchButton).off('click').click((e) => {
            const spreadTableDOM = $(e.currentTarget).attr('data-sm');
            switchMode(spreadTableDOM, true).then(() => {
            });
        });

        $(eles.thisCard).each(function () {
            this.addEventListener('contextmenu', baseRightClickHandler, false);
            this.addEventListener('mouseup', handleMouseUp, false);
        });

        $(eles.searchInput).on('change', (e) => {
            const { value } = e.currentTarget;
            searchTableContent(`tblConfig${cardId}`, value);
        });

        $(eles.searchInput).on('input', (e) => {
            const { value } = e.currentTarget;
            searchTableContent(`tblConfig${cardId}`, value, false);
        });
    };

    return {
        showLineSetting,
        showMachineSetting,
        showSettings, // todo rename
        showPartnoSetting,
        clearFilter,
        genEvents,
        genColumnNameSelectBox,
        deleteFilter,
        eles,
    };
});

const genSmartHtmlOther = (procId, cardId = null) => {
    let currId;
    let tableId = null;
    let idNo;
    if (cardId) {
        currId = cardId;
        tableId = `tblConfig${cardId}`;
    } else {
        const existOthers = $(`${filterElements.filterOthers}`).map((_, e) => e.id.slice(-2)).toArray();
        for (let i = 1; i <= 99; i++) {
            idNo = `0${i}`.slice(-2);
            if (!existOthers.includes(idNo)) {
                currId = htmlCardId.FILTER_OTHER + idNo;
                tableId = `tblConfig${htmlCardId.FILTER_OTHER}${idNo}`;
                break;
            }
        }
    }
    // create filter other object ,generate events, clear copy source data
    const otherFuncs = filterCfgGenerator(currId, filterTypes.OTHER);
    filterElements.addFilterOther.before(`<div name="filterOtherCard" class="card graph-navi" id="${currId}"></div>`);
    const prevCard = filterElements.filterTemplate.clone();
    $(prevCard).find('table').attr('id', tableId);
    $(prevCard).find('#alertMsgSetting').removeClass('show');
    $(prevCard).find('#alertMsgSetting').removeClass('alert-danger');
    $(prevCard).find('#alertMsgSetting').removeClass('alert-success');
    $(prevCard).find('#alertMsgSetting')[0].style.display = 'none';

    // change attr for spreadsheet
    const cardNo = currId.split('filter-other')[1];
    // $(prevCard).find('form[name=other01Filter]').attr('name', `other${cardNo}Filter`);
    $(prevCard).find('#other01SM').attr('id', `other${cardNo}SM`);
    $(prevCard).find('#sModeOther01').attr('data-sm', `other${cardNo}SM`);
    $(prevCard).find('#sModeOther01').attr('id', `sModeOther${cardNo}`);

    $(prevCard).find('#accordionOther01').attr('id', `accordionOther${cardNo}`);
    $(prevCard).find('#headingOther01').attr('id', `headingOther${cardNo}`);
    $(prevCard).find('#collapseOther01').attr('id', `collapseOther${cardNo}`);
    $(prevCard).find('[name=minMaxBtn]').attr('data-parent', `#accordionOther${cardNo}`);
    $(prevCard).find('[name=minMaxBtn]').attr('href', `#collapseOther${cardNo}`);
    $(prevCard).find('[name=minMaxBtn]').attr('aria-controls', `collapseOther${cardNo}`);
    $(prevCard).find('#collapseOther01').attr('aria-labelledby', `headingOther${cardNo}`);
    $(prevCard).find('#collapseOther01').attr('id', `collapseOther${cardNo}`);

    $(`.card#${currId}`).append($(prevCard).children().clone());
    const otherColumnName = $(`.card#${currId} [name=columnName]`)[0];
    // otherColumnName.id = `otherColumnName${idNo}`;
    $(otherColumnName).addClass('select2-selection--single');
    $(otherColumnName).addClass('select-n-columns');

    otherFuncs.clearFilter();
    otherFuncs.genEvents();

    // drag & drop for tables
    $(`#${tableId} tbody`).sortable({
        helper: dragDropRowInTable.fixHelper,
        update: updateOrder,
    });

    return otherFuncs;
};

const getTextOfSelectBox = (e) => {
    if (e.selectedIndex > -1) {
        return e.options[e.selectedIndex].text;
    }
    return null;
};

const getSettingModeData = (tableId) => {
    const tableIdWithSharp = `#${tableId}`;
    const func = genJsonfromHTML(tableIdWithSharp, tableId, true);
    let data;
    $(tableIdWithSharp).find('input').each((_, ele) => {
        if (ele.name) {
            data = func(ele.name);
        }
    });
    $(tableIdWithSharp).find('select').each((_, ele) => {
        if (ele.name) {
            // data = func(ele.name, e => e.options[e.selectedIndex].text);
            data = func(ele.name, getTextOfSelectBox);
        }
    });

    return data;
};

const getExcelModeData = (jexcelDivId) => {
    const data = document.getElementById(jexcelDivId).jspreadsheet.getData();
    return data;
};

$(() => {
    filterElements.addFilterOther.click(() => {
        const otherFuncs = genSmartHtmlOther(filterStore.getSelectedProcessId());
        otherFuncs.genColumnNameSelectBox(filterStore.getSelectedProcess());

        addAttributeToElement($(otherFuncs.eles.thisCard));
        collapseConfig();
    });
});
