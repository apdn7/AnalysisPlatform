
let sortedColIds = [];
let latestSortColIds = [];
let showOrderModalClick = 0;
let showOrderModalGraphAreaClick = 0;
let removeColIds = [];

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
    sortedColIds = sortedColIds.map(col => Number(col.split('-')[1]));
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

    return sortListByKey(array, graph_sort_key);
};

const getSelectedEndColIds = () => {
    const colIds = [];
    $('#end-proc-row .end-proc').each((_, endProc) => {
        const procId = $(endProc).find('[name*="end_proc"] option:selected').val();
        const cols = $(endProc).find('li [name*=GET02_VALS_SELECT]:checked')
        cols.each((_, element) => {
            if (element.value && element.value !== 'All') {
                colIds.push(`${procId}-${element.value}`)
            }
        });
    });
    return colIds;
};

const generateSortOrderColumn = (sortList, graphArea) => {
    if (graphArea) {
        sortList = [...latestSortColIds];
    }
    let isReset = true;
    for (const col of sortList) {
        const [procId, colId] = col.split('-');
        const cfgProc = procConfigs[procId];
        const dicCols = cfgProc.dicColumns;
        const colShowName = dicCols[colId].shown_name;
        const columnName = dicCols[colId].name_en;
        const dataType = dicCols[colId].data_type;
        const procEnName = cfgProc.name_en;
        showColOrderingSetting(orderingEls.endColOrderTable + graphArea, colId, cfgProc.id, cfgProc.shown_name, procEnName, colShowName, columnName, dataType, isReset, graphArea);
        isReset = false;
    }
};

const isDropDownChanged = () => {
    const originalSelected = getSelectedEndColIds().sort();
    return JSON.stringify(originalSelected) !== JSON.stringify([...sortedColIds].sort());
}

const loadDataSortColumnsToModal = (graphAreaSuffix = '', force = false, callback = null) => {
    sortedColIds = isDropDownChanged() ? getSelectedEndColIds() : sortedColIds;
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
            $(orderingEls.endColOrderTable).find('tr').each((_, element) => {
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
            $(orderingEls.endColOrderTable + graphAreaSuffix).find('tr').each((_, element) => {
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
        showOrderModalGraphAreaClick ++;
    } else {
        showOrderModalClick ++;
    }
}

const showSortColModal = (graphArea = null, callback) => {
    const graphAreaSuffix = Number(graphArea) ? 'GraphArea' : '';
    $(orderingEls.endColOrderModal + graphAreaSuffix).modal('show');
    loadDataSortColumnsToModal(graphAreaSuffix, false, callback);
}

const initShowGraphCommon = () => {
    $('button.show-graph').on('click', () => {
        clearOnFlyFilter = true;
        if (isDropDownChanged()) {
            sortedColIds = [];
        }
        if (!sortedColIds.length) {
            sortedColIds = getSelectedEndColIds();
        }
        latestSortColIds = [...sortedColIds];
    });
};

const htmlEndColOrderRowTemplate = (priority, colId, procId, processName, procEnName, showName, colName, dataType, graphArea) => `<tr class="order-row-table" data-procId="${procId}" data-colId=${colId}>
        <td style="text-align: center" ${dragDropRowInTable.DATA_ORDER_ATTR}>${priority}</td>
         <td style="padding: 2px 5px 2px 15px; height: 40px;"> ${procEnName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${processName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${colName} </td>
        <td style="padding: 2px 5px 2px 15px;"> ${showName} </td>
        <td class="position-relative" style="padding: 2px 5px 2px 15px;"> ${DataTypes[dataType].short} 
            <span title="Move to top" onclick="handleGoToTopRow(this)" class="go-top-icon"><i class="fas fa-step-forward"></i></span>
            <span title="Move to bottom" onclick="handleGoToTopRow(this, 'bottom')" class="go-top-icon bottom"><i class="fas fa-backward-step"></i></span>
        </td>
       ${!graphArea ? `
        <td style="text-align: center">
            <button onclick="handleDeleteColumn(this)" type="button" class="btn btn-secondary icon-btn btn-right">
                <i class="fas fa-trash-alt icon-secondary"></i>
            </button>
        </td> ` : '' }
    </tr>`;


const handleDeleteColumn = (e) => {
    delClosestEle(e, 'tr');
    // uncheck selected columns
    const id = $(e).parent().parent().attr('data-colId');
    removeColIds.push(id);
};

const showColOrderingSetting = (tableId, colId, procId, processName, procEnName, colShowName, colName, dataType, isReset = false, graphArea) => {
    const calcPriority = () => $(`${tableId} tbody tr`).length + 1;
    // add to modal
    const tableBody = $(`${tableId} tbody`);
    if (isReset) {
        tableBody.empty();
        tableBody.sortable({
            helper: dragDropRowInTable.fixHelper, update: () => {
                updatePriority(tableId)
            },
        });
    }
    const rowHtml = htmlEndColOrderRowTemplate(calcPriority(), colId, procId, processName, procEnName, colShowName, colName, dataType, graphArea)
    tableBody.append(rowHtml)
    $(`${tableId} thead .filter-row`).remove();
    sortableTable(tableId.replace('#', ''), [0, 1, 2, 3, 4, 5])
};

const handleGoToTopRow = (e, type='top') => {
    const _this = $(e);
    const targetTr = _this.parents('tr');
    const targetTbody = _this.parents('tbody');
    targetTbody.remove(targetTr);
    if (type === 'bottom') {
        targetTbody.append(targetTr);
    } else {
        targetTbody.prepend(targetTr);
    }
    const tableId = _this.parents('table').attr("id");
    updatePriority(`#${tableId}`)
}