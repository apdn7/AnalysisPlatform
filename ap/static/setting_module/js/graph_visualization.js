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
        graphConfigCopyAllBtn: '#copyGraphConfigAllBtn',
        graphConfigPasteAllBtn: '#pasteGraphConfigAllBtn',
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
                            class="btn btn-secondary icon-btn-xs">
                            <i class="fas fa-trash-alt fa-xs icon-secondary"></i>
                        </button>`;
let targetColumnSource;
let filterColumnSource = [];
let allFilterDetailSource = [];
let dictFilterDetail = {};

const genGraphConfigTable = (cfgProcess) => {
    filterColumnSource = [];
    const allColumns = cfgProcess.getColumns();
    allColumns.forEach((column) => {
        dictColumnName[column.shown_name] = column.id;
    });
    // get source of dropdown
    const visualizations = cfgProcess.getVisualizations();
    const columns = cfgProcess.getNumericColumns();
    // TODO: remove constant
    targetColumnSource = columns.map((column) => column.shown_name || column.name_en);
    const filters = cfgProcess.getFilters();
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
        visualization['control_column_name'] = visualization.control_column?.shown_name;
        visualization['filter_column_name'] = visualization.filter_column?.shown_name;
        visualization['filter_value'] = visualization.filter_detail?.filter_condition;
        const visualizationSpreadSheetData = new SpreadSheetVisualizationConfigData(visualization);
        dataRows.push(visualizationSpreadSheetData);
    });
    const spreadsheet = SpreadSheetVisualizationConfig.create(filterElements.graphCfgTableName, dataRows);
    // TODO: handle resize column
    // // init width for columns - Start
    // const sumColumnWidth = graphConfigColumns.reduce((sum, item) => {
    //     if (item.width && item.name !== GraphConfigColumns.delete_button) {
    //         return sum + Number(item.width);
    //     }
    //     return sum;
    // }, 0);
    // const containerWidth = $('#visualization .card-body').width();
    //
    // // not re-calculate with of Delete icon column
    // const reCalculateWidth = (col) =>
    //     col.name === GraphConfigColumns.delete_button
    //         ? col.width
    //         : parseInt((col.width / sumColumnWidth) * containerWidth);
    //
    // // calculate init column width
    // graphConfigColumns = graphConfigColumns.map((col) =>
    //     col.width ? { ...col, width: reCalculateWidth(col) } : { ...col },
    // );
    // // init width for columns - End

    // table.addFilter();
    // table.takeSnapshotForTracingChanges(trackingHeaders);
    bindClickDropdown();

    function adjustColumnWidths() {
        const containerWidth = $('#visualization .card-body').width();
        if (containerWidth < 1000) {
            return;
        }
        // get columns
        const visibleCols = $('colgroup col:visible');
        let totalWidth = 0;
        const initialWidths = [];

        visibleCols.each(function () {
            const colWidth = parseInt($(this).attr('width'));
            initialWidths.push(colWidth);
            totalWidth += colWidth;
        });
        // set width again
        visibleCols.each(function (index) {
            const percentage = initialWidths[index] / totalWidth;
            const newWidth = percentage * (containerWidth - 4); // 4 is not including border of table
            if (index !== 12) {
                // 12 is an index of delete button column in visible cols
                $(this).attr('width', newWidth);
            }
        });
    }

    window.addEventListener('resize', adjustColumnWidths);
    adjustColumnWidths();
};

const bindClickDropdown = () => {
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

    // copy all setting graph config
    $(visualModule.eles.graphConfigCopyAllBtn).click(() => {
        const spreadsheet = spreadsheetVisualizationConfig(filterElements.graphCfgTableName);
        spreadsheet.table.copyAll();
    });
    // paste all setting graph config
    $(visualModule.eles.graphConfigPasteAllBtn).click(() => {
        const spreadsheet = spreadsheetVisualizationConfig(filterElements.graphCfgTableName);
        navigator.clipboard.readText().then(function (text) {
            const tableData = transformCopiedTextToTable(text);
            if (tableData === null) {
                return;
            }
            const headers = spreadsheet.table.getVisibleHeaders();
            const headerNames = headers.map((header) => header.name);
            const dataRows = tableData.map((row) => {
                const data = _.zipObject(headerNames, row);
                return new SpreadSheetVisualizationConfigData(data);
            });

            spreadsheet.pasteAll(dataRows);
            showToastPasteFromClipboardSuccessful();
        }, showToastPasteFromClipboardFailed);
    });

    $(window).scrollTop(0);
});
