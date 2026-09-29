let sortedColIds = [];
let latestSortColIds = [];
let showOrderModalClick = 0;
let showOrderModalGraphAreaClick = 0;
let removeColIds = [];
let latestSortColIdsJumpPage = [];
const XYAxis = { 0: 'X', 1: 'Y' };
const isXYAxisPage =
    getCurrentPage() === PAGE_NAME.scp || getCurrentPage() === PAGE_NAME.hmp || getCurrentPage() === PAGE_NAME.wfp;

const orderingEls = {
    endColOrderTable: '#endColOrderTable',
    endColOrderModal: '#endColOrderModal',
    endColOrderModalOkBtn: '#btnEndColOrderModalOK',
    endColOrderModalCancelBtn: '.btnEndColOrderModalCancel',
};

let sortOrderRenderToken = 0;
const SORT_ORDER_RENDER_BATCH_SIZE = 100;

const initSortOrderTable = (tableId) => {
    const tableBody = $(`${tableId} tbody`);
    if (tableBody.hasClass('ui-sortable')) {
        tableBody.sortable('destroy');
    }
    tableBody.sortable({
        helper: dragDropRowInTable.fixHelper,
        update: () => {
            updatePriority(tableId);
        },
    });
};

const resetSortOrderTable = (tableId) => {
    const tableBody = $(`${tableId} tbody`);
    if (tableBody.hasClass('ui-sortable')) {
        tableBody.sortable('destroy');
    }
    tableBody.empty();
};

const finalizeSortOrderTable = (tableId) => {
    $(`${tableId} thead .filter-row`).remove();
    sortableTable(tableId.replace('#', ''), [0, 1, 2, 3, 4, 5]);
};

const setSortOrderLoadingState = (graphArea = '', isLoading = false, allowSubmit = true) => {
    const okBtnSelector = orderingEls.endColOrderModalOkBtn + graphArea;
    if (isLoading) {
        $(okBtnSelector).prop('disabled', true);
        $(okBtnSelector).removeClass('btn-primary');
        $(okBtnSelector).addClass('btn-secondary');
        return;
    }

    $(okBtnSelector).prop('disabled', !allowSubmit);
    $(okBtnSelector).toggleClass('btn-primary', allowSubmit);
    $(okBtnSelector).toggleClass('btn-secondary', !allowSubmit);
};

const showSortOrderLoadingRow = (tableId, graphArea = '') => {
    const colSpan = graphArea ? 6 : 7;
    const loadingText = (window.i18nCommon && window.i18nCommon.loading) || 'Loading...';
    const loadingRowHtml = `<tr class="sort-order-loading-row">
        <td colspan="${colSpan}" class="text-center py-4">
            <span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
            <span>${loadingText}</span>
        </td>
    </tr>`;
    $(`${tableId} tbody`).html(loadingRowHtml);
};

const sortListByKey = (array, key) => {
    return [...array].sort((a, b) => {
        const valueA = a[key];
        const valueB = b[key];

        if (valueA < valueB) {
            return -1;
        } else if (valueA > valueB) {
            return 1;
        } else {
            return 0;
        }
    });
};

const findIndex = (array, value) => {
    return array.indexOf(value);
};

const sortGraphs = (array, ColKey, sortedColIds) => {
    let endCols = [];
    array.forEach((data) => {
        const endCol = data[ColKey];
        let singleColID = [endCol];
        if (Array.from(endCol).length) {
            // CHM there is an array of cols id
            singleColID = endCol;
        }
        endCols = [...endCols, ...singleColID];
    });
    endCols = endCols.map((id) => Number(id));
    sortedColIds = sortedColIds.map((col) => Number(col.split('-')[1]));
    const notOrderCols = [...array].filter((colDat) => !sortedColIds.includes(colDat[ColKey]));
    const graph_sort_key = 'graph_sort_value';
    const removeIndexes = [];
    for (let i = 0; i < array.length; i++) {
        const dicVal = array[i];
        const index = findIndex(sortedColIds, dicVal[ColKey]);
        if (index === -1) {
            removeIndexes.push(i);
        } else {
            dicVal[graph_sort_key] = index;
        }
    }

    for (const idx of removeIndexes.reverse()) {
        array.splice(idx, 1);
    }

    const sortedCols = sortListByKey(array, graph_sort_key);
    return [...sortedCols, ...notOrderCols];
};

const getSelectedEndColIds = (parentId = '') => {
    const colIds = [];
    // show graph pages sort for all end procs so no id is passed
    // export config passes an id so that only the selected end proc is the target
    parentId = parentId ? `${parentId} ` : '';
    $(`${parentId}#end-proc-row .end-proc`).each((_, endProc) => {
        const procId = $(endProc).find('[name*="end_proc"] option:selected').val();
        const cols = $(endProc).find('li [name*=GET02_VALS_SELECT]:checked');
        cols.each((_, element) => {
            if (element.value && element.value !== 'All') {
                colIds.push(`${procId}-${element.value}`);
            }
        });
    });
    return colIds;
};

const getSelectedEndProcIds = () => {
    const procIds = [];
    $('#end-proc-row .end-proc').each((_, endProc) => {
        const procId = $(endProc).find('[name*="end_proc"] option:selected').val();
        procIds.push(procId);
    });
    return procIds;
};

const generateSortOrderColumn = (sortList, graphArea, tableID = orderingEls.endColOrderTable, renderToken = 0) => {
    if (graphArea) {
        sortList = [...latestSortColIds];
    }
    const tableId = tableID + graphArea;

    const safeToken = renderToken || ++sortOrderRenderToken;
    const tableBody = $(`${tableId} tbody`);
    resetSortOrderTable(tableId);

    if (!sortList.length || !tableBody.length) {
        $(`${tableId} tbody`).empty();
        finalizeSortOrderTable(tableId);
        setSortOrderLoadingState(graphArea, false, !isXYAxisPage);
        return;
    }

    // for scp or heatmap => get 2 last item in sortList
    sortList = isXYAxisPage ? sortList.slice(-2) : sortList;
    const $okBtnInChart = $(orderingEls.endColOrderModalOkBtn + graphArea);
    // in SCP and Heatmap page, if sortedlist <2 => disable OK button
    if (isXYAxisPage && sortList.length < 2) {
        $okBtnInChart.prop('disabled', true);
        $okBtnInChart.removeClass('btn-primary');
        $okBtnInChart.addClass('btn-secondary');
    } else if (isXYAxisPage && sortList.length === 2) {
        $okBtnInChart.prop('disabled', false);
        $okBtnInChart.addClass('btn-primary');
        $okBtnInChart.removeClass('btn-secondary');
    }

    const rows = [];
    for (const col of sortList) {
        const [procId, colId] = col.split('-');
        const cfgProc = procConfigs[procId];
        if (!cfgProc) continue;
        const dicCols = cfgProc.dicColumns;
        if (!dicCols || (dicCols && !dicCols[colId])) continue;
        rows.push({
            colId,
            procId: cfgProc.id,
            processName: cfgProc.shown_name,
            procEnName: cfgProc.name_en,
            colShowName: dicCols[colId].shown_name,
            columnName: dicCols[colId].name_en,
            dataType: dataTypeShort(dicCols[colId]),
        });
    }

    if (!rows.length) {
        finalizeSortOrderTable(tableId);
        setSortOrderLoadingState(graphArea, false, !isXYAxisPage);
        return;
    }

    let cursor = 0;
    const renderBatch = () => {
        if (safeToken !== sortOrderRenderToken) {
            return;
        }

        const end = Math.min(cursor + SORT_ORDER_RENDER_BATCH_SIZE, rows.length);
        const htmlRows = [];
        for (let idx = cursor; idx < end; idx++) {
            const row = rows[idx];
            const priority = isXYAxisPage ? (idx === 0 ? 'X' : 'Y') : idx + 1;
            htmlRows.push(
                htmlEndColOrderRowTemplate(
                    priority,
                    row.colId,
                    row.procId,
                    row.processName,
                    row.procEnName,
                    row.colShowName,
                    row.columnName,
                    row.dataType,
                    graphArea,
                ),
            );
        }

        tableBody.append(htmlRows.join(''));
        cursor = end;

        if (cursor < rows.length) {
            setTimeout(renderBatch, 0);
            return;
        }

        initSortOrderTable(tableId);
        finalizeSortOrderTable(tableId);
        setSortOrderLoadingState(graphArea, false, !isXYAxisPage || rows.length === 2);
    };

    renderBatch();
};

const isDropDownChanged = () => {
    const originalSelected = getSelectedEndColIds().sort();
    return JSON.stringify(originalSelected) !== JSON.stringify([...sortedColIds].sort());
};
//
const getSensorOrderFromGUI = (sortedIds = []) => {
    const selectedSensors = getSelectedEndColIds();
    return sortedIds.filter((id) => selectedSensors.includes(id));
};

function sortByOrder(arr1, arr2) {
    const order = new Map(arr2.map((v, i) => [v, i]));
    return arr1.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}

const loadDataSortColumnsToModal = (graphAreaSuffix = '', force = false, callback = null) => {
    sortedColIds = isDropDownChanged() ? getSensorOrderFromGUI(latestSortColIds) : sortedColIds;
    if (force) {
        const sortedCols = localStorage.getItem(sortedColumnsKey);
        if (sortedCols) {
            latestSortColIds = JSON.parse(sortedCols);
            sortedColIds = [...latestSortColIds];
            localStorage.removeItem(sortedColumnsKey);
        }
    }
    const tableId = orderingEls.endColOrderTable + graphAreaSuffix;
    const currentRenderToken = ++sortOrderRenderToken;
    setSortOrderLoadingState(graphAreaSuffix, true);
    showSortOrderLoadingRow(tableId, graphAreaSuffix);
    setTimeout(() => {
        generateSortOrderColumn(sortedColIds, graphAreaSuffix, orderingEls.endColOrderTable, currentRenderToken);
    }, 0);
    if (!showOrderModalClick) {
        $(orderingEls.endColOrderModalOkBtn).on('click', (e) => {
            // remove checked cols
            for (const colId of removeColIds) {
                $(`input[name^=GET02_VALS_SELECT][value=${colId}]`).prop('checked', false).trigger('change');
            }
            removeColIds = [];
            sortedColIds = [];
            $(orderingEls.endColOrderTable)
                .find('tr')
                .each((_, element) => {
                    const colId = $(element).attr('data-colId');
                    const procId = $(element).attr('data-procId');
                    if (colId) {
                        sortedColIds.push(`${procId}-${colId}`);
                    }
                });
            // handle change XY-axis
            sortedColIds.forEach((id, index) => {
                if (XYAxis[index]) {
                    $(`#xy-axis-${id}`).text(XYAxis[index]);
                }
            });

            // Keep the latest source in sync so reopening modal preserves the ordered state.
            latestSortColIds = [...sortedColIds];
        });

        $(orderingEls.endColOrderModalCancelBtn).on('click', (e) => {
            removeColIds = [];
            generateSortOrderColumn(sortedColIds, graphAreaSuffix);
        });
    }

    if (!showOrderModalGraphAreaClick) {
        $(orderingEls.endColOrderModalOkBtn + graphAreaSuffix).on('click', (e) => {
            latestSortColIds = [];
            $(orderingEls.endColOrderTable + graphAreaSuffix)
                .find('tr')
                .each((_, element) => {
                    const colId = $(element).attr('data-colId');
                    const procId = $(element).attr('data-procId');
                    if (colId) {
                        latestSortColIds.push(`${procId}-${colId}`);
                    }
                });
            if (callback) {
                callback();
            }
        });

        $(orderingEls.endColOrderModalCancelBtn + graphAreaSuffix).on('click', (e) => {
            generateSortOrderColumn(latestSortColIds, graphAreaSuffix);
        });
    }

    if (graphAreaSuffix) {
        showOrderModalGraphAreaClick++;
    } else {
        showOrderModalClick++;
    }
};

const showSortColModal = (graphArea = null, callback) => {
    const graphAreaSuffix = Number(graphArea) ? 'GraphArea' : '';
    $(orderingEls.endColOrderModal + graphAreaSuffix).modal('show');
    loadDataSortColumnsToModal(graphAreaSuffix, false, callback);
};

const initShowGraphCommon = () => {
    $('button.show-graph').on('click', () => {
        clearOnFlyFilter = true;
        const useEMD = getParamFromUrl('jump_key');
        if (isDropDownChanged()) {
            sortedColIds = [];
        }
        if (!sortedColIds.length) {
            sortedColIds = getSensorOrderFromGUI(latestSortColIds);
        }
        if (!useEMD && !isSaveColumnOrdering() && !isXYAxisPage) {
            latestSortColIds = [...sortedColIds];
        } else {
            // filer checked sensor with latest records
            latestSortColIds = getSensorOrderFromGUI(latestSortColIds);
        }
    });
};

const htmlEndColOrderRowTemplate = (
    priority,
    colId,
    procId,
    processName,
    procEnName,
    showName,
    colName,
    dataType,
    graphArea,
) => `<tr class="order-row-table" data-procId="${procId}" data-colId=${colId}>
        <td style="text-align: center" ${dragDropRowInTable.DATA_ORDER_ATTR}>${priority}</td>
         <td style="padding: 2px 5px 2px 15px; height: 40px;"> ${procEnName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${processName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${colName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${showName} </td>
        <td class="position-relative" style="padding: 2px 5px 2px 15px;"> ${dataType} 
            <span title="Move to top" onclick="handleGoToTopRow(this)" class="go-top-icon"><i class="fas fa-step-forward"></i></span>
            <span title="Move to bottom" onclick="handleGoToTopRow(this, 'bottom')" class="go-top-icon bottom"><i class="fas fa-backward-step"></i></span>
        </td>
       ${
           !graphArea
               ? `
        <td class="delete-order-column" style="text-align: center">
            <button onclick="handleDeleteColumn(this)" type="button" class="btn btn-secondary icon-btn btn-right">
                <i class="fas fa-trash-alt icon-secondary"></i>
            </button>
        </td> `
               : ''
       }
    </tr>`;

const handleDeleteColumn = (e) => {
    delClosestEle(e, 'tr');
    // uncheck selected columns
    const id = $(e).parent().parent().attr('data-colId');
    removeColIds.push(id);
};

const handleGoToTopRow = (e, type = 'top') => {
    const _this = $(e);
    const targetTr = _this.parents('tr');
    const targetTbody = _this.parents('tbody');
    targetTbody.remove(targetTr);
    if (type === 'bottom') {
        targetTbody.append(targetTr);
    } else {
        targetTbody.prepend(targetTr);
    }
    const tableId = _this.parents('table').attr('id');
    updatePriority(`#${tableId}`);
};

const createOrUpdateSensorOrdering = (event, checkAll = false) => {
    const selectedEndCols = getSelectedEndColIds();
    if (!$(event.target).attr('name').includes('GET02_VALS_SELECT')) {
        return;
    }
    // if click All input, use default ordering by GUI
    if (checkAll) {
        latestSortColIds = selectedEndCols;
        return;
    }

    const columnID = $(event.target).val();
    const procID = $(event.target).data('proc-id');
    if (procID) {
        const orderingID = `${procID}-${columnID}`;
        const isAdd = $(event.target).is(':checked');
        if (isAdd && !latestSortColIds.includes(orderingID) && selectedEndCols.includes(orderingID)) {
            latestSortColIds.push(orderingID);
        }
        if (!isAdd) {
            latestSortColIds = latestSortColIds.filter((col) => col !== orderingID);
        }
    }
};
