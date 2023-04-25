/* eslint-disable no-restricted-syntax,prefer-arrow-callback */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 18;
const MAX_END_PROC = 18;
tabID = null;
let currentData = null;
const graphStore = new GraphStore();

const eles = {
    endProcSelectedItem: '#end-proc-row select',
};

const i18n = {
    selectDivRequiredMessage: $('#i18nSelectDivMessage').text(),
    allSelection: $('#i18nAllSelection').text(),
};


const formElements = {
    formID: '#traceDataForm',
    btnAddCondProc: '#btn-add-cond-proc',
    endProcItems: '#end-proc-row .end-proc',
    endProcSelectedItem: '#end-proc-row select',
    plotCardId: '#plot-cards',
    plotCard: $('#barplot-cards'),
    categoryForm: '#traceDataForm',
    agpCard: '#agpCard',
    agpScale: $('select[name=agpScale]'),
    resultSection: $('.result-section'),
    divideOption: $('#divideOption')
};

const calenderFormat = {
    1: {
        group1: [
        'yyyymmddHH',
        'yymmddHH',
        'mmddHH',
        'ddHH',
        'HH',
        'yyyymmdd',
        'yymmdd',
        'mmdd',
        'dd'
        ],
        group2: [
        'yyyymm',
        'yymm',
        'mm',
        'yyyy',
        'yy'
        ]
    },
    2: {
         group1: [
        'yyyy-mm-dd_HH',
        'yy-mm-dd_HH',
        'mm-dd_HH',
        'dd_HH',
        'HH',
        'yyyy-mm-dd',
        'yy-mm-dd',
        'mm-dd',
        'dd',
        'yyyy-mm-dd_Fri',
        'yy-mm-dd_Fri',
        'mm-dd_Fri',
        'dd_Fri',
        'Fri',
        ],
        group2: [
        'yyyymm',
        'yymm',
        'mm',
        'yyyy',
        'yy'
        ]
    },
    3: {
        group1: [
         "ww"
        ]
    },
    4: {
        group1: [
        "Www",
        "Www_mm-dd"
        ]
    }
}

const AGP_EXPORT_URL = {
    CSV: {
        ext_name: 'csv',
        url: '/ap/api/agp/data_export/csv',
    },
    TSV: {
        ext_name: 'tsv',
        url: '/ap/api/agp/data_export/tsv',
    },
};

$(() => {
    // generate tab ID
    while (tabID === null || sessionStorage.getItem(tabID)) {
        tabID = Math.random();
    }
    // hide loading screen
    const loading = $('.loading');
    loading.addClass('hide');

    initializeDateTime();

    const endProcs = genProcessDropdownData(procConfigs);

    // add first end process
    const endProcItem = addEndProcMultiSelect(endProcs.ids, endProcs.names, {
        showDataType: true,
        showStrColumn: true,
        showCatExp: true,
        isRequired: true,
        showColor: true,
        colorAsDropdown: true,
        hasDiv: true,
    });
    endProcItem(() => {
        onChangeDivInFacet();
    });


    // add first condition process
    const condProcItem = addCondProc(endProcs.ids, endProcs.names, '', formElements.formID, 'btn-add-cond-proc');
    condProcItem();

    // click even of condition proc add button
    $(formElements.btnAddCondProc).click(() => {
        condProcItem();
    });

    // click even of end proc add button
    $('#btn-add-end-proc').click(() => {
        endProcItem(() => {
            onChangeDivInFacet();
        });
        updateSelectedItems();
        // checkAndHideStratifiedVar();
        addAttributeToElement();
    });

    formElements.divideOption.trigger('change');
    renderCyclicCalenderModal();


    // validation
    initValidation(formElements.formID);

    onChangeDivideOption();

    initTargetPeriod();
    toggleDisableAllInputOfNoneDisplayEl($('#for-cyclicTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-directTerm'));
    toggleDisableAllInputOfNoneDisplayEl($('#for-category'));

    // add limit after running load_user_setting
    setTimeout(() => {
        // add validations for target period
        validateTargetPeriodInput();
        keepValueEachDivision();
    }, 2000);


    initializeDateTimeRangePicker();
    initializeDateTimePicker();
});


const showAgP = (clearOnFlyFilter = true) => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_END_PROC });
    updateStyleOfInvalidElements();
    if (isValid) {
        // close sidebar
        beforeShowGraphCommon(clearOnFlyFilter);

        beforeShowAGP(clearOnFlyFilter);

        queryDataAndShowAGP(clearOnFlyFilter);
    }
};

const beforeShowAGP = (clearOnFlyFilter) => {
    if (clearOnFlyFilter) {
        formElements.plotCard.empty();
    }
};

const afterShowAGP = () => {
    formElements.resultSection.css('display', 'block');
    const agpCard = $(`${formElements.agpCard}`);
    agpCard.show();
    loadingHide();
};

const collectInputAsFormData = (clearOnFlyFilter) => {
    const traceForm = $(formElements.formID);
    let formData = new FormData(traceForm[0]);

    if (clearOnFlyFilter) {
        resetCheckedCats();
        formData = transformFacetParams(formData);
        formData = bindCategoryParams(formData);
        formData = transformColorsParams(formData);

        // choose default or recent datetime
        formData = genDatetimeRange(formData);
        const compareType = formData.get('compareType');
        if (compareType === divideOptions.cyclicCalender) {
            if (!formData.get(CYCLIC_TERM.DIV_OFFSET)) {
                 const offsetH = Number(divOffset.split(':')[0]) + Number(divOffset.split(':')[1]) / 60;
                formData.set(CYCLIC_TERM.DIV_OFFSET, offsetH.toString());
            }

            const divDate = [...divFromTo];
            divDate.push(lastFrom);
            formData.set('divDates', JSON.stringify(divDate));
            formData.set('divFormats', JSON.stringify(divFormats))
        }

        if (compareType !== divideOptions.cyclicCalender) {
            formData.delete(CYCLIC_TERM.DIV_OFFSET);
            formData.delete('divDates');
            formData.delete('divFormats');
        }

        // append client timezone
        formData.set('client_timezone', detectLocalTimezone());
        lastUsedFormData = formData;
    } else {
        formData = lastUsedFormData;
        formData = transformCatFilterParams(formData);
    }
    return formData;
};

const transformColorsParams = (formData) => {
    // delete colorVar because there is empty selection in value
    formData.delete('colorVar');
    // get colorVar from active GUI
    const colorVars = {};
    $('select[name=colorVar]').get().forEach(ele => {
        const targetID = $(ele).data('target-var-id');
        const colorVal = $(ele).val();
        const isObjectiveVar = $(`input[name^=GET02_VALS_SELECT][value=${targetID}]`).prop('checked');
        if (colorVal && colorVal !== '' && isObjectiveVar) {
            colorVars[targetID] = colorVal;
        }
    });

    formData.append('aggColorVar', JSON.stringify(colorVars));
    return formData;
};
const queryDataAndShowAGP = (clearOnFlyFilter = true) => {
    const formData = collectInputAsFormData(clearOnFlyFilter);



    // validate form
    const hasDiv = !!formData.get('div');
    const isDivideByCat = formData.get('compareType') === CONST.CATEGORY;
    if (!hasDiv && isDivideByCat) {
        // did not select catExpBox as endProcCate
        loadingHide();
        showToastrMsg(i18n.selectDivRequiredMessage);
        return;
    }

    showGraphCallApi('/ap/api/agp/plot', formData, REQUEST_TIMEOUT, async (res) => {
        afterShowAGP();

        currentData = res;
        graphStore.setTraceData(_.cloneDeep(res));

        drawAGP(res);

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        const {catExpBox, cat_on_demand, unique_color} = res;
        if (clearOnFlyFilter) {
            clearGlobalDict();
            initGlobalDict(catExpBox);
            initGlobalDict(cat_on_demand);
            initGlobalDict(unique_color);
            initDicChecked(getDicChecked());
            initUniquePairList(res.dic_filter);
        }


        longPolling(formData, () => {
            $(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`).trigger('change');
            queryDataAndShowAGP(true);
        });
    });
};

const drawAGP = (orgData) => {
    const data = _.cloneDeep(orgData); // if slow, change
    if (!data) {
        return;
    }

    const isCyclicCalender = orgData.COMMON.compareType === divideOptions.cyclicCalender;

    // orgData.array_plotdata = array_plotdata;
    renderAgPAllChart(orgData.array_plotdata, isCyclicCalender)

    // implement order
    $(formElements.agpCard).sortable({});

    formElements.plotCard.empty();
    formElements.plotCard.show();

    $('html, body').animate({
        scrollTop: $(formElements.agpCard).offset().top,
    }, 500);

    // init filter modal
    fillDataToFilterModal(orgData.catExpBox, [], orgData.cat_on_demand,[],  orgData.unique_color || [], () => {
        queryDataAndShowAGP(false);
    });
};

const dumpData = (exportType, dataSrc) => {
    const formData = lastUsedFormData || collectInputAsFormData(true);
    formData.set('export_from', dataSrc);
    if (exportType === EXPORT_TYPE.TSV_CLIPBOARD) {
        tsvClipBoard(AGP_EXPORT_URL.TSV.url, formData);
    } else {
        exportData(
            AGP_EXPORT_URL[exportType].url,
            AGP_EXPORT_URL[exportType].ext_name,
            formData,
        );
    }
};

const handleExportData = (exportType) => {
    // hide export menu
    showGraphAndDumpData(exportType, dumpData);
};

const renderCyclicCalenderModal = () => {
    const calenderList = $('.cyclic-calender-select-option');
    calenderList.empty();
    const renderItem = (key, format, isChecked) => `
        <div class="cyclic-calender-option-item">
              <div class="custom-control custom-radio" style="width: calc(50% + 15px);">
                   <input type="radio" data-example="2022040112" onchange="onChangeDivideFormat(this)" name="${CYCLIC_TERM.DIV_CALENDER}" id="cyclicCalender_${format}${key}" 
                        class="custom-control-input to-update-time-range" value="${format}" ${isChecked ? 'checked' : ''}>
                   <label class="custom-control-label" for="cyclicCalender_${format}${key}" class="label-left">
                        <span class="sub-label">${format}</span>
                   </label>
              </div>
              <span class="cyclic-calender-option-example">2022040112</span>
        </div>
    `;
    let calenderListHtml = ''
    let index = 1;
    for (const key of Object.keys(calenderFormat)) {
        const groups = calenderFormat[key];
        let groupHtml = '';
        for (const group of Object.keys(groups)) {
            let itemHtml = '';
            const formatList = groups[group];
            for (const format of formatList) {
                const isCheck = index === 1;
                itemHtml += renderItem(key, format, isCheck);
                index ++;
            }

            const html = `
                <div class="cyclic-calender-option-group">
                ${itemHtml}
                </div>
            `;

            groupHtml += html;
        }

        const width = {
            1: 210,
            2: 266,
            3: 100,
            4: 220,
        }

        calenderListHtml += `
                <div class="cyclic-calender-option-list" style="width: ${width[key]}px">
                ${groupHtml}
                </div>
        `;
    }

    calenderList.append(calenderListHtml);
    showDateTimeRangeValue();
    generateCalenderExample();
    changeFormatAndExample($(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`));
};

const onChangeDivideFormat = (e) => {
    changeFormatAndExample(e)
}

const renderAgPChartLayout = (chartOption, chartHeight = '40vh', isCTCol = false) => {
    const { processName, columnName, facetLevel1, facetLevel2, chartId } = chartOption;
    let facet = [facetLevel1, facetLevel2].filter(f => checkTrue(f));
    const levelTitle = facet.map((el, i) => `${el}${i}`).join(' | ');
    const CTLabel = isCTCol ? ` (${DataTypes.DATETIME.short}) [sec]` : ''
    const chartLayout = `
          <div class="card chart-row graph-navi" style="height: ${chartHeight};">
            <div class="tschart-title-parent">
                <div class="tschart-title" style="width: ${chartHeight};">
                    <span title="${processName}">${processName}</span>
                    <span title="${columnName}">${columnName}${CTLabel}</span>
                    <span class="show-detail cat-exp-box" title="${levelTitle}">${facet.join(' | ')}</span>
                 </div>
            </div>
            <div class="chart-area">
                <div style="width: 100%; height: 100%" id="${chartId}"></div>
            </div>
        </div>
    `;

    // <div class="pin-chart">
    //                <span class="btn-anchor"
    //                     data-pinned="false"
    //                     onclick="pinChart('${formElements.agpCard}');"><i class="fas fa-anchor"></i></span>
    //             </div>

    return chartLayout;
}

const renderAgPAllChart = (plots, isCyclicCalender = false) => {
    if (!plots) return;
    $(formElements.agpCard).empty();
    let chartHeight = '';
    const maxCardInScreen = 3;
    if (plots.length >= maxCardInScreen) {
        chartHeight = `${98 / maxCardInScreen}vh`;
    } else {
        chartHeight = `${98 / plots.length}vh`;
    }
    plots.forEach((plotData, i) => {
        const canvasId = `agp-Chart${i}`;
        const { agg_function, color_name, end_proc_id, end_col_id } = plotData;
        const catExpBox = plotData.catExpBox ? plotData.catExpBox : [];
        const facetLevel1 = catExpBox[0];
        const facetLevel2 = catExpBox.length > 1 ? catExpBox[1] : undefined;
        const chartOption = {
            processName: plotData.end_proc_name,
            columnName: plotData.shown_name,
            facetLevel1,
            facetLevel2,
            chartId: canvasId,
        }
        const isCTCol = isCycleTimeCol(end_proc_id, end_col_id);
        const chartHtml = renderAgPChartLayout(chartOption, chartHeight, isCTCol);

        $(formElements.agpCard).append(chartHtml);
        const countByXAxis = {};
        const sumCountByXAxis = (key, n) => {
            const count = n || 0;
            if (key in countByXAxis) {
                countByXAxis[key] += count;
            } else {
                countByXAxis[key] = count;
            }
        };

        const div = isCyclicCalender ? [...divArrays] : plotData.unique_div;
        // reduce full div range
        const data = plotData.data.map(data => {
            const trace = {
                ...data,
                hoverinfo: 'none',
                line: {
                    width: 0.6,
                },
                marker: {
                    size: 5,
                },
            }
            const { x, y } = trace;
            const newX = []
            const newY = []
            for (let i = 0; i < div.length; i += 1) {
                const currDiv = div[i];
                const indexOfCurrDiv = x.indexOf(currDiv);
                newX.push(currDiv);
                if (indexOfCurrDiv !== -1) {
                    newY.push(y[indexOfCurrDiv]);
                } else {
                    newY.push(null);
                }
            }
            trace.x = [...newX]
            trace.y = [...newY]

            for (let i = 0; i < trace.x.length; i += 1) {
                const currDiv = trace.x[i];
                const indexOfCurrDiv = trace.x.indexOf(currDiv);
                sumCountByXAxis(currDiv, trace.y[indexOfCurrDiv]);
            }

            trace.x = trace.x.map(val => `t${val}`);
            return trace;
        })
        const dataFmt = plotData.fmt;
        drawAgPPlot(data, agg_function, countByXAxis, div,
            color_name || plotData.shown_name, isCyclicCalender, `${canvasId}`, divArrays, dataFmt);
    });
}
