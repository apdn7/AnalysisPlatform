const GraphConfigColumns = {
    control_column_id: 'control_column_id',
    control_column_name: 'control_column_name',
    filter_column_id: 'filter_column_id',
    filter_column_name: 'filter_column_name',
    filter_detail_id: 'filter_detail_id',
    filter_value: 'filter_value',
    lcl: 'lcl',
    ucl: 'ucl',
    lpcl: 'lpcl',
    upcl: 'upcl',
    ymin: 'ymin',
    ymax: 'ymax',
    act_from: 'act_from',
    act_to: 'act_to',
    delete_button: 'delete_button',
    id: 'id',
    order: 'order',
    target: 'target',
    condition: 'condition',
    control_line: 'control_line',
    action_line: 'action_line',
    graph_axis_range: 'graph_axis_range',
    valid: 'valid',
};
const trackingHeaders = [
    GraphConfigColumns.control_column_name,
    GraphConfigColumns.filter_column_name,
    GraphConfigColumns.filter_value,
    GraphConfigColumns.lcl,
    GraphConfigColumns.ucl,
    GraphConfigColumns.lpcl,
    GraphConfigColumns.upcl,
    GraphConfigColumns.ymin,
    GraphConfigColumns.ymax,
    GraphConfigColumns.act_from,
    GraphConfigColumns.act_to,
];

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
        visualConfigRegister: '#visualConfigRegister',
        addVisualConfig: card.find('#addVisualConfig'),
        addNewRow: card.find('#addGraphConfigRow'),
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
        graphConfigDownloadAllBtn: '#graphConfigDownloadAllBtn',
        graphConfigCopyAllBtn: '#graphConfigCopyAllBtn',
        graphConfigPasteAllBtn: '#graphConfigPasteAllBtn',
    };

    const msg = {
        saveOK: $('#saveOK'),
        saveFailed: $('#i18nSaveFail'),
        requireValue: $('#requireValue')[0].innerHTML,
        requireSetting: $('#requireSetting')[0].innerHTML,
        duplicatedSetting: $('#duplicatedSetting')[0].innerHTML,
        ymaxLt: $('#ymaxLt')[0].innerHTML,
        uclLt: $('#uclLt')[0].innerHTML,
        prcUCLLt: $('#prcUCLLt')[0].innerHTML,
        actTimeEmpty: $('#i18nActTimeEmpty')[0].innerHTML,
        actFromGreater: $('#i18nActFromGreater')[0].innerHTML,
    };

    const showSettings = (cfgProcess) => {
        // clear current setting UI
        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        table.destroyTable();
        genGraphConfigTable(cfgProcess);
    };

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
        // const rows = getEles();
        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        const rows = table.collectDataTable();
        const actTimeObj = {};
        for (const row of rows) {
            // map column name with id

            if (!row.control_column_id) {
                errorFlg = true;
                displayMessage(eles.alertMsg, (message = { content: msg.requireValue, is_error: true }));
                break;
            }
            if (row.filter_column_id && !row.filter_detail_id) {
                errorFlg = true;
                displayMessage(eles.alertMsg, (message = { content: msg.requireValue, is_error: true }));
                break;
            }

            errorFlg = [row.ucl, row.lcl, row.upcl, row.lpcl, row.ymax, row.ymin].every(isEmpty);
            if (errorFlg) {
                displayMessage(eles.alertMsg, (message = { content: msg.requireSetting, is_error: true }));
                break;
            }

            // y-max >= y-min and ucl >= lcl
            if (row.ucl !== '' && row.lcl !== '') {
                errorFlg = Number(row.ucl) < Number(row.lcl);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, (message = { content: msg.uclLt, is_error: true }));
                    break;
                }
            }
            if (row.ymax !== '' && row.ymin !== '') {
                errorFlg = Number(row.ymax) < Number(row.ymin);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, (message = { content: msg.ymaxLt, is_error: true }));
                    break;
                }
            }
            if (row.upcl !== '' && row.lpcl !== '') {
                errorFlg = Number(row.upcl) < Number(row.lpcl);
                if (errorFlg) {
                    displayMessage(eles.alertMsg, (message = { content: msg.prcUCLLt, is_error: true }));
                    break;
                }
            }
            const trimActFrom = row.act_from.trim();
            const trimActTo = row.act_to.trim();
            if (trimActFrom === '' && trimActTo === '') {
                errorFlg = true;
                displayMessage(eles.alertMsg, (message = { content: msg.actTimeEmpty, is_error: true }));
                break;
            }

            if (!isEmpty(trimActFrom) && !isEmpty(trimActTo) && trimActFrom > trimActTo) {
                errorFlg = true;
                displayMessage(eles.alertMsg, (message = { content: msg.actFromGreater, is_error: true }));
                break;
            }

            // action time to timestamp
            const actDateFrom = trimActFrom ? new Date(trimActFrom).getTime() : 0;
            const actDateTo = trimActTo ? new Date(trimActTo).getTime() : Number.MAX_SAFE_INTEGER;
            const configSetName = `${row.control_column_id}|${row.filter_column_id}|${row.filter_detail_id}`;

            if (actTimeObj[configSetName]) {
                const actRanges = actTimeObj[configSetName];

                actRanges.forEach((actRange) => {
                    const dupRange = getDuplicateTimeRange([actDateFrom, actDateTo], actRange);
                    if (dupRange.length) {
                        errorFlg = true;
                    }
                });
                if (errorFlg) {
                    displayMessage(
                        eles.alertMsg,
                        (message = {
                            content: msg.duplicatedSetting,
                            is_error: true,
                        }),
                    );
                    break;
                }
            } else {
                actTimeObj[configSetName] = [[actDateFrom, actDateTo]];
            }
        }
        return !errorFlg;
    };

    const buildDateTime = (actDate, actTime = '') => {
        const datetimeStr = `${actDate} ${actTime}`.trim();
        if (!isEmpty(actDate)) {
            return moment.utc(moment(datetimeStr)).format();
        }
        return datetimeStr;
    };

    // register to yaml file
    const register = async () => {
        eles.alertMsgEle.css('display', 'none');
        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        const rows = table.collectDataTable();
        // const rows = getEles();
        const data = [];
        rows.forEach((row, idx) => {
            const isFromData = 0;
            data.push(
                new CfgVisualization({
                    id: row.id || null,
                    process_id: cfgProcess.id,
                    control_column_id: row.control_column_id,
                    filter_column_id: row.filter_column_id || null,
                    // filter_value: isFromData ? filterValue : null,
                    filter_value: null,
                    is_from_data: isFromData,
                    filter_detail_id: isFromData ? null : row.filter_detail_id || null,
                    ucl: String(row.ucl).length ? row.ucl : null,
                    lcl: String(row.lcl).length ? row.lcl : null,
                    upcl: String(row.upcl).length ? row.upcl : null,
                    lpcl: String(row.lpcl).length ? row.lpcl : null,
                    ymax: String(row.ymax).length ? row.ymax : null,
                    ymin: String(row.ymin).length ? row.ymin : null,
                    act_from: buildDateTime(row.act_from, ''),
                    act_to: buildDateTime(row.act_to, ''),
                    order: idx,
                }),
            );
        });

        await fetch(`/ap/api/setting/proc_config/${cfgProcess.id}/visualizations`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
            .then((response) => {
                if (!response.ok) {
                    throw Error('');
                } else {
                    return response.clone().json();
                }
            })
            .then((json) => {
                // reload page
                cfgProcess = new CfgProcess(json.data);
                showSettings(cfgProcess);
                // show message
                displayMessage(eles.alertMsg, (message = { content: msg.saveOK.text(), is_error: false }));
            })
            .catch((err) => {
                // show messg
                console.log('ERROR: ', err);
                displayMessage(
                    eles.alertMsg,
                    (message = {
                        content: msg.saveFailed.text(),
                        is_error: true,
                    }),
                );
            });
    };

    return {
        showSettings,
        validate,
        register,
        eles,
    };
})();

const displayMessage = (alertID, message = { content: '', is_error: false }, card = '') => {
    if (isEmpty(alertID)) return;
    const alertIdWithCard = card === '' ? `#${alertID}` : `${card} #${alertID}`;
    $(`${alertIdWithCard}-content`).html(message.content);

    if (!message.is_error) {
        $(`${alertIdWithCard}`).css('display', 'block');
        $(`${alertIdWithCard}`).removeClass('alert-danger');
        $(`${alertIdWithCard}`).addClass('show alert-success');
    } else if (message.is_error) {
        $(`${alertIdWithCard}`).css('display', 'block');
        $(`${alertIdWithCard}`).removeClass('alert-success');
        $(`${alertIdWithCard}`).addClass('show alert-danger');
    }
};

const deleteRow = (ele) => {
    // get number of row
    const numberIndex = ele.closest('td').getAttribute('data-y');
    const table = jspreadsheetTable(filterElements.graphCfgTableName);
    table.removeSelectedRow(numberIndex);
};

const deleteIcon = `<button onclick="deleteRow(this);" type="button"
                            class="btn btn-secondary icon-btn">
                            <i class="fas fa-trash-alt fa-xs icon-secondary"></i>
                        </button>`;

const genGraphConfigTable = (cfgProcess) => {
    const allColumns = cfgProcess.getColumns();
    allColumns.forEach((column) => {
        dictColumnName[column.shown_name] = column.id;
    });
    // get source of dropdown
    const visualizations = cfgProcess.getVisualizations();
    const columns = cfgProcess.getNumericColumns();
    const targetColumnSource = columns.map((column) => column.shown_name || column.name_en);
    const filters = cfgProcess.getFilters();
    const filterColumnSource = [];
    let allFilterDetailSource = [];
    const dictFilterDetail = {};
    filters.forEach((filterColumn) => {
        if (!filterColumn.column) return;
        filterColumnSource.push(filterColumn.column?.shown_name || filterColumn.column?.name_en);
        const filterDetailSource = filterColumn.filter_details?.map((filterDetail) => filterDetail.filter_condition);
        filterColumn.filter_details?.forEach((filterDetail) => {
            dictFilterCondition[filterDetail.filter_condition] = filterDetail.id;
        });
        allFilterDetailSource = [...filterDetailSource, ...allFilterDetailSource];
        dictFilterDetail[filterColumn.column?.shown_name] = filterDetailSource;
    });
    const dataRows = [];
    // if (!visualizations.length) {
    //     dataRows.push({})
    // }
    visualizations.forEach((visualization) => {
        const row = {};
        row['id'] = visualization.id;
        row['control_column_id'] = visualization.control_column_id;
        row['control_column_name'] = visualization.control_column?.shown_name;
        row['filter_column_id'] = visualization.filter_column_id;
        row['filter_column_name'] = visualization.filter_column?.shown_name;
        row['filter_detail_id'] = visualization.filter_detail_id;
        row['filter_value'] = visualization.filter_detail?.filter_condition;
        row['lcl'] = visualization.lcl;
        row['ucl'] = visualization.ucl;
        row['lpcl'] = visualization.lpcl;
        row['upcl'] = visualization.upcl;
        row['ymin'] = visualization.ymin;
        row['ymax'] = visualization.ymax;
        // act from/to
        let actFromDate = '';
        if (visualization.act_from) {
            actFromDate = formatDateTime(visualization.act_from, 'YYYY-MM-DD HH:mm');
        }

        let actToDate = '';
        if (visualization.act_to) {
            actToDate = formatDateTime(visualization.act_to, 'YYYY-MM-DD HH:mm');
        }
        row['act_from'] = actFromDate;
        row['act_to'] = actToDate;
        row['order'] = visualization.order;
        row['delete_button'] = deleteIcon;
        dataRows.push(row);
    });
    const customColumn = {
        // Methods
        closeEditor: function (cell, save) {
            const input = cell.children[0];
            return input != null ? input.value : cell.innerHTML;
        },
        openEditor: function (cell) {
            // Create input
            const element = document.createElement('input');

            // add class DATETIME_PICKER
            element.classList.add('DATETIME_PICKER');
            element.setAttribute('is-show-time-picker', 'True');
            element.setAttribute('autocomplete', 'off');
            element.value = cell.innerHTML;
            const $element = $(element);

            // Update cell
            cell.classList.add('editor');
            cell.innerHTML = '';
            cell.appendChild(element);
            const $cell = $(cell);

            // Init picker and show popup
            initializeDateTimePicker(null, true, $cell);
            const pickerObject = $element.data('daterangepicker');
            const $pickerElement = $('div.daterangepicker');
            $pickerElement.appendTo($cell);
            const nativeMoveFn = pickerObject.move;
            let calledTime = 0;
            pickerObject.move = () => {
                // This function will be called 2 times by native library to calculate axis of picker to show.
                // Therefore, we must stop calling this function from 3 times and keep position of picker
                if (calledTime > 1) return;
                nativeMoveFn.call(pickerObject);
                const offset = $pickerElement.offset();
                offset.top -= 220;
                $pickerElement.offset(offset);
                calledTime += 1;
                if (calledTime === 2) {
                    // after the second called, the picker need to be shown fully in table
                    $pickerElement[0].scrollIntoView();
                }
            };
            pickerObject.show();

            $element.on('click', () => pickerObject.show.call(pickerObject)); // force to show picker again if user on click in input element
            $element.on('apply.daterangepicker', function (ev, picker) {
                const time = picker.startDate.format(DATETIME_PICKER_FORMAT);
                element.value = time;
                cell.innerHTML = time;
                setTimeout(function () {
                    cell.closest('div.jexcel_container').jexcel.closeEditor(cell, true);
                });
            });

            // Focus on the element
            element.focus();
        },
        getValue: function (cell) {
            return cell.innerHTML;
        },
        setValue: function (cell, value) {
            cell.innerHTML = value;
        },
    };
    const dropdownFilter = function (instance, cell, c, r, source) {
        let value = instance.jexcel.getValueFromCoords(c - 2, r);
        return dictFilterDetail[value] || [];
    };
    let graphConfigColumns = [
        {
            type: 'hidden',
            name: GraphConfigColumns.control_column_id,
        },
        {
            type: 'dropdown',
            width: '250',
            name: GraphConfigColumns.control_column_name,
            title: $('#i18nVariableName').text(),
            source: targetColumnSource,
            autocomplete: true,
            customFilter: true,
        },
        {
            type: 'hidden',
            name: GraphConfigColumns.filter_column_id,
        },
        {
            type: 'dropdown',
            width: '250',
            name: GraphConfigColumns.filter_column_name,
            title: $('#i18nVariableName').text(),
            source: filterColumnSource,
            autocomplete: true,
            customFilter: true,
        },
        {
            type: 'hidden',
            name: GraphConfigColumns.filter_detail_id,
        },
        {
            type: 'dropdown',
            width: '150',
            name: GraphConfigColumns.filter_value,
            title: $('#i18nValue').text(),
            source: allFilterDetailSource,
            filter: dropdownFilter,
            autocomplete: true,
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.lcl,
            title: $('#i18nLower').text(),
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.ucl,
            title: $('#i18nUpper').text(),
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.lpcl,
            title: $('#i18nLower').text(),
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.upcl,
            title: $('#i18nUpper').text(),
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.ymin,
            title: $('#i18nMinValue').text(),
            customFilter: true,
        },
        {
            type: 'numeric',
            width: '100',
            name: GraphConfigColumns.ymax,
            title: $('#i18nMaxValue').text(),
            customFilter: true,
        },
        {
            type: 'text',
            width: '220',
            name: GraphConfigColumns.act_from,
            title: $('#i18nDatetimeFrom').text(),
            options: { format: 'YYYY-MM-DD HH:mm', time: true },
            editor: customColumn,
            customFilter: true,
        },
        {
            type: 'text',
            width: '220',
            name: GraphConfigColumns.act_to,
            title: $('#i18nDatetimeTo').text(),
            options: { format: 'YYYY-MM-DD HH:mm', time: true },
            editor: customColumn,
            customFilter: true,
        },
        {
            type: 'html',
            width: '40',
            name: GraphConfigColumns.delete_button,
            title: ' ',
            readOnly: true,
        },
        {
            type: 'hidden',
            name: GraphConfigColumns.id,
        },
        {
            type: 'hidden',
            name: GraphConfigColumns.order,
        },
    ];

    // init width for columns
    const sumColumnWidth = graphConfigColumns.reduce((sum, item) => {
        if (item.width && name !== GraphConfigColumns.delete_button) {
            return sum + Number(item.width);
        }
        return sum;
    }, 4); // 4 is a difference between containerWidth and sum_col_width
    const containerWidth = $('#visualization .card-body').width();
    graphConfigColumns = graphConfigColumns.map((col) =>
        col.width ? { ...col, width: parseInt((col.width / sumColumnWidth) * containerWidth) } : { ...col },
    );

    const nestedHeaders = [
        [
            {
                title: $('#i18nTarget').text(),
                name: GraphConfigColumns.target,
                colspan: '1',
            },
            {
                title: $('#i18nCondition').text(),
                colspan: '2',
                name: GraphConfigColumns.condition,
            },
            {
                title: $('#i18nControlLine').text(),
                colspan: '2',
                name: GraphConfigColumns.control_line,
            },
            {
                title: $('#i18nActionLine').text(),
                colspan: '2',
                name: GraphConfigColumns.action_line,
            },
            {
                title: $('#i18nGraphAxisRange').text(),
                colspan: '2',
                name: GraphConfigColumns.graph_axis_range,
            },
            {
                title: $('#i18nValid').text(),
                colspan: '2',
                name: GraphConfigColumns.valid,
            },
            {
                title: ' ',
                colspan: '1',
                name: GraphConfigColumns.delete_button,
            },
        ],
    ];
    const table = JspreadSheetTable.createTable(
        filterElements.graphCfgTableName,
        graphConfigColumns,
        dataRows,
        nestedHeaders,
        customEvents(),
    );
    table.addFilter();
    table.takeSnapshotForTracingChanges(trackingHeaders);
    bindClickDropdown();

    function adjustColumnWidths() {
        const containerWidth = $('#visualization .card-body').width();
        if (containerWidth < 1000) {
            return;
        }
        // get columns
        const cols = $('colgroup col:visible');
        let totalWidth = 4; // 4 is a difference between containerWidth and sum_col_width

        const initialWidths = [];

        cols.each(function () {
            const colWidth = parseFloat($(this).attr('width'));
            initialWidths.push(colWidth);
            totalWidth += colWidth;
        });
        // set width again
        cols.each(function (index) {
            const percentage = initialWidths[index] / totalWidth;
            const newWidth = percentage * containerWidth;
            if (index === 12) return; // 12 is an index of delete button column in visible cols
            $(this).attr('width', newWidth);
        });
    }

    window.addEventListener('resize', adjustColumnWidths);
    adjustColumnWidths();
};

const customEvents = () => {
    const onbeforechange = (instance, cell, c, r, value) => {
        const column = instance.jexcel.options.columns[c];
        let formatValue = stringNormalization(value);
        if (
            [
                GraphConfigColumns.lcl,
                GraphConfigColumns.ucl,
                GraphConfigColumns.lpcl,
                GraphConfigColumns.upcl,
                GraphConfigColumns.ymin,
                GraphConfigColumns.ymax,
            ].includes(column.name)
        ) {
            // paste float
            formatValue = parseFloat(formatValue);
            if (isNaN(formatValue)) {
                formatValue = '';
            }
        } else if ([GraphConfigColumns.act_from, GraphConfigColumns.act_to].includes(column.name)) {
            formatValue = formatDateTime(formatValue, 'YYYY-MM-DD HH:mm', {
                withMillisecs: true,
                isLocalTime: true,
            });
            if (formatValue === 'Invalid date') {
                formatValue = '';
            }
        }
        return formatValue;
    };
    const onchange = (instance, cell, c, r, value) => {
        const column = instance.jexcel.options.columns[c];
        if (column?.type == 'dropdown') {
            // find column name and set value for before column
            let fillId = null;
            if (
                column.name == GraphConfigColumns.control_column_name ||
                column.name == GraphConfigColumns.filter_column_name
            ) {
                fillId = dictColumnName[value];
            } else if (column.name == GraphConfigColumns.filter_value) {
                fillId = dictFilterCondition[value];
            }
            if (column.name == GraphConfigColumns.filter_column_name) {
                // set filter value is empty
                instance.jexcel.updateCell(Number(c) + 2, r, '');
            }
            const columnName = jspreadsheet.getColumnNameFromId([c - 1, r]);
            instance.jexcel.setValue(columnName, fillId);
        }
    };
    const oninsertrow = (instance, rowNumber, numOfRows, rowRecords, insertBefore) => {
        rowRecords.forEach((row) => {
            const table = jspreadsheetTable(filterElements.graphCfgTableName);
            const deleteColIdx = table.getIndexHeaderByName(GraphConfigColumns.delete_button);
            row[deleteColIdx].innerHTML = deleteIcon;
        });
    };
    const onload = (instance) => {
        // const index = JspreadSheetTable.getIndexHeaderByName(filterElements.graphCfgTableName, GraphConfigColumns.control_line, true)
        const firstElementChild = instance.jexcel.thead.firstElementChild.children;
        firstElementChild[1].classList.add('hint-text'); // 1: index of target column
        firstElementChild[1].setAttribute('title', $('#i18nTargetHoverMsg').text());
        firstElementChild[2].classList.add('hint-text');
        firstElementChild[2].setAttribute('title', $('#i18nConditionHoverMsg').text());
        firstElementChild[3].classList.add('hint-text', 'red');
        firstElementChild[3].setAttribute('title', $('#i18nThresholdConfigHoverMsg').text());
        firstElementChild[4].classList.add('hint-text', 'blue');
        firstElementChild[4].setAttribute('title', $('#i18nProcessThresholdHoverMsg').text());
        firstElementChild[6].classList.add('hint-text');
        firstElementChild[6].setAttribute('title', $('#i18nValidHoverMsg').text());
        // add icon sort
        instance.jexcel.thead.lastElementChild.children.forEach((tdEle, index) => {
            if ([0, 15].includes(index)) return; // ignore index column & delete column
            if ([2, 13].includes(index)) {
                tdEle.innerHTML = `
                    <span>${tdEle.innerHTML}</span>
                    <span style="color: yellow">*</span>
                    <span id="sortCol-${index}" idx="${index}" class="mr-1 sortCol" title="Sort" >
                        <i id="asc-${index}" class="fa fa-sm fa-play asc" ></i >
                        <i id="desc-${index}" class="fa fa-sm fa-play desc" ></i >
                    </span>`;
            } else {
                tdEle.innerHTML = `
                    <span>${tdEle.innerHTML}</span>
                    <span id="sortCol-${index}" idx="${index}" class="mr-1 sortCol" title="Sort" >
                        <i id="asc-${index}" class="fa fa-sm fa-play asc" ></i >
                        <i id="desc-${index}" class="fa fa-sm fa-play desc" ></i >
                    </span>`;
            }
        });
    };

    return { onchange, oninsertrow, onload, onbeforechange };
};

const sortColumnGraphConfig = (containerSelector = 'table') => {
    // handle sort
    $(`${containerSelector} .sortCol`).off('click');
    $(`${containerSelector} .sortCol`).on('click', (el) => {
        el.stopPropagation();
        let asc = true;
        const sortEl = $(el.target.closest('.sortCol'));
        const isFirstClick = sortEl.attr('clicked');
        if (isFirstClick) {
            asc = false;
            sortEl.removeAttr('clicked');
        } else {
            sortEl.attr('clicked', '0');
        }

        const idx = sortEl.attr('idx');

        if (asc) {
            sortEl.removeClass('desc');
            sortEl.addClass('asc');
        } else {
            sortEl.removeClass('asc');
            sortEl.addClass('desc');
        }

        // Reset sort status in other cols
        const containerEl = sortEl.closest(containerSelector);
        const otherSortCols = $(containerEl).find(`.sortCol:not([idx=${idx}])`);
        otherSortCols.removeAttr('clicked');
        otherSortCols.removeClass('asc desc');

        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        table.sortBy(Number(idx) - 1);
    });
};

const bindClickDropdown = () => {
    // style for delete button, can not set style by class
    document.querySelectorAll('.btn.btn-secondary.icon-btn').forEach((el) => {
        el.style.width = '20px';
        el.style.height = '20px';
    });
    $('.jexcel_dropdown')
        .off('dblclick')
        .on('dblclick', function () {
            const cellRect = $(this)[0].getBoundingClientRect();

            const setDropdownPosition = (cell, $dropdown) => {
                if (cell.bottom + $dropdown.height() > window.innerHeight) {
                    // display dropdown on top
                    $dropdown.css('top', cell.top - $dropdown.height());
                } else {
                    // display dropdown below cell
                    $dropdown.css('top', cell.bottom);
                }
                $dropdown.css('bottom', '');
                $dropdown.css('opacity', 1);
            };

            // wait for dropdown display by setTimeout
            setTimeout(() => {
                const $dropdownContainer = $('.jdropdown-container');
                if ($dropdownContainer.length === 0) return;
                setDropdownPosition(cellRect, $dropdownContainer);

                $(window)
                    .off('scroll')
                    .on('scroll', () => {
                        // update cell-rect
                        const cellRectUpdate = $(this)[0].getBoundingClientRect();
                        setDropdownPosition(cellRectUpdate, $dropdownContainer);
                    });
            }, 0);
        });
};
$(() => {
    visualModule.eles.addNewRow.click(() => {
        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        table.addNewRow([]);
        bindClickDropdown();
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

    // download all setting graph config
    $(visualModule.eles.graphConfigDownloadAllBtn).click(() => {
        const table = jspreadsheetTable(filterElements.graphCfgTableName);
        const tableDataRows = table.collectDataTable();
        const dataExport = tableDataRows.map((rowData) => {
            return [
                rowData.control_column_name,
                rowData.filter_column_name,
                rowData.filter_value,
                rowData.lcl,
                rowData.ucl,
                rowData.lpcl,
                rowData.upcl,
                rowData.ymin,
                rowData.ymax,
                rowData.act_from,
                rowData.act_to,
            ];
        });
        const titleHeaders = table.getTitleHeaders();
        let titleNestedHeaders = [];
        const nestedHeaders = table.getNestedHeaders();
        nestedHeaders[0].forEach((nestedHeader) => {
            titleNestedHeaders.push(nestedHeader.title);
            if (Number(nestedHeader.colspan) > 1) {
                titleNestedHeaders = [...titleNestedHeaders, ...Array(Number(nestedHeader.colspan) - 1).fill('')];
            }
        });
        const text = [titleNestedHeaders, titleHeaders, ...dataExport].join(NEW_LINE_CHAR);
        downloadText(`${cfgProcess.name}_graph_config.csv`, text);
    });

    $(window).scrollTop(0);
});
