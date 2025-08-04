let sortedColIds = [];
let latestSortColIds = [];
let showOrderModalClick = 0;
let showOrderModalGraphAreaClick = 0;
let removeColIds = [];
let latestSortColIdsJumpPage = [];
const isScpOrHmpPage =
    getCurrentPage() === PAGE_NAME.scp || getCurrentPage() === PAGE_NAME.hmp || getCurrentPage() === PAGE_NAME.tv;

const orderingEls = {
    endColOrderTable: '#endColOrderTable',
    endColOrderModal: '#endColOrderModal',
    endColOrderModalOkBtn: '#btnEndColOrderModalOK',
    endColOrderModalCancelBtn: '.btnEndColOrderModalCancel',
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

const getSelectedEndColIds = () => {
    const colIds = [];
    $('#end-proc-row .end-proc').each((_, endProc) => {
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

const generateSortOrderColumn = (sortList, graphArea) => {
    if (graphArea) {
        sortList = [...latestSortColIds];
    }
    let isReset = true;
    if (!sortList.length) {
        $(`${orderingEls.endColOrderTable + graphArea} tbody`).empty();
    }

    // for scp or heatmap => get 2 last item in sortList
    sortList = isScpOrHmpPage ? sortList.slice(-2) : sortList;
    const $okBtnInChart = $(orderingEls.endColOrderModalOkBtn + graphArea);
    // in SCP and Heatmap page, if sortedlist <2 => disable OK button
    if (isScpOrHmpPage && sortList.length < 2) {
        $okBtnInChart.prop('disabled', true);
        $okBtnInChart.removeClass('btn-primary');
        $okBtnInChart.addClass('btn-secondary');
    } else if (isScpOrHmpPage && sortList.length === 2) {
        $okBtnInChart.prop('disabled', false);
        $okBtnInChart.addClass('btn-primary');
        $okBtnInChart.removeClass('btn-secondary');
    }

    for (const col of sortList) {
        const [procId, colId] = col.split('-');
        const cfgProc = procConfigs[procId];
        const dicCols = cfgProc.dicColumns;
        if (!dicCols || (dicCols && !dicCols[colId])) continue;
        const colShowName = dicCols[colId].shown_name;
        const columnName = dicCols[colId].name_en;
        const dataType = dataTypeShort(dicCols[colId]);
        const procEnName = cfgProc.name_en;
        showColOrderingSetting(
            orderingEls.endColOrderTable + graphArea,
            colId,
            cfgProc.id,
            cfgProc.shown_name,
            procEnName,
            colShowName,
            columnName,
            dataType,
            isReset,
            graphArea,
        );
        isReset = false;
    }
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
    generateSortOrderColumn(sortedColIds, graphAreaSuffix);
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
        if (!useEMD && !isSaveColumnOrdering()) {
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
        <td style="text-align: center">
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

const showColOrderingSetting = (
    tableId,
    colId,
    procId,
    processName,
    procEnName,
    colShowName,
    colName,
    dataType,
    isReset = false,
    graphArea,
) => {
    const calcPriority = () => {
        if (isScpOrHmpPage) {
            return $(`${tableId} tbody tr`).length === 0 ? 'X' : 'Y';
        } else {
            return $(`${tableId} tbody tr`).length + 1;
        }
    };
    // add to modal
    const tableBody = $(`${tableId} tbody`);
    if (isReset) {
        tableBody.empty();
        tableBody.sortable({
            helper: dragDropRowInTable.fixHelper,
            update: () => {
                updatePriority(tableId);
            },
        });
    }
    const rowHtml = htmlEndColOrderRowTemplate(
        calcPriority(),
        colId,
        procId,
        processName,
        procEnName,
        colShowName,
        colName,
        dataType,
        graphArea,
    );

    tableBody.append(rowHtml);
    $(`${tableId} thead .filter-row`).remove();
    sortableTable(tableId.replace('#', ''), [0, 1, 2, 3, 4, 5]);
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
