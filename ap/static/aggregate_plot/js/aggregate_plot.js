/* eslint-disable no-restricted-syntax,prefer-arrow-callback */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const REQUEST_TIMEOUT = setRequestTimeOut();
const MAX_NUMBER_OF_GRAPH = 18;
const MAX_NUMBER_OF_SENSOR = 18;
tabID = null;
let currentData = null;
const graphStore = new GraphStore();
let scaleOption = scaleOptionConst.AUTO;
let isShowPercent = false;
let useDivsArray = [];
let useDivFromTo = []

const eles = {
    endProcSelectedItem: '#end-proc-row select',
};

const i18n = {
    selectDivRequiredMessage: $('#i18nSelectDivMessage').text(),
    allSelection: $('#i18nAllSelection').text(),
    outlier: $('#i18nOutlierVal').text(),
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
    divideOption: $('#divideOption'),
    scaleOption: $('select[name=yScale]'),
    yAxisPercent: $('#yAxisPercent'),
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
            "ffffh",
            "ffffq",
            "ffh",
            "ffq",
            "ffff",
            "ff",
            "h",
            "q",
            "ffffmm",
            "ffmm",
             "ww"
        ],
    },
    4: {
        group1: [
            "FY2022H1",
            "FY2022Q1",
            "FY22H1",
            "FY22Q1",
            "FY2022",
            "FY22",
            "H1",
            "Q1",
            "FY2022-mm",
            "FY22-mm",
             "Www",
            "Www_mm-dd",
            "yyyy_Www",
            "yyyy_Www_mm-dd",
            "yy_Www",
            "yy_Www_mm-dd"
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
    onChangeScaleOption();
});

const setScaleOption = (scaleOption = scaleOptionConst.AUTO) => {
    formElements.scaleOption.val(scaleOption);
    formElements.yAxisPercent.prop('checked', false);
    isShowPercent = false;
}

const getScaleOption = () => {
    return formElements.scaleOption.val();
};

const onChangeScaleOption = () => {
    formElements.scaleOption.on('change', (e) => {
        const scale = getScaleOption();
        scaleOption = scale;
        drawAGP(currentData, scaleOption, isShowPercent);
    })
}

const showAgP = (clearOnFlyFilter = true) => {
    requestStartedAt = performance.now();
    const isValid = checkValidations({ max: MAX_NUMBER_OF_SENSOR });
    updateStyleOfInvalidElements();
    setScaleOption();
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

const collectInputAsFormData = (clearOnFlyFilter, autoUpdate = false) => {
    if (autoUpdate) {
        return genDatetimeRange(lastUsedFormData);
    }
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

            // convert divFromTo from local to UTC
            const divDates = divFromTo.map(date => toUTCDateTime(date, null, true));

            formData.set('divDates', JSON.stringify(divDates));
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
const queryDataAndShowAGP = (clearOnFlyFilter = false, autoUpdate = false) => {
    const formData = collectInputAsFormData(clearOnFlyFilter, autoUpdate);



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

        // sort graphs
        if (latestSortColIds && latestSortColIds.length) {
            res.ARRAY_FORMVAL = sortGraphs(res.ARRAY_FORMVAL, 'GET02_VALS_SELECT', latestSortColIds);
            res.array_plotdata = sortGraphs(res.array_plotdata, 'end_col_id', latestSortColIds);
        }

        currentData = res;
        graphStore.setTraceData(_.cloneDeep(res));

        const scaleOption = getScaleOption();

        useDivsArray = [...divArrays];
        useDivFromTo = [...divFromTo];

        drawAGP(res, scaleOption, isShowPercent);

        // show info table
        showInfoTable(res);

        loadGraphSetings(clearOnFlyFilter);

        if (!autoUpdate) {
             $('html, body').animate({
                scrollTop: $(formElements.agpCard).offset().top,
            }, 500);
        }

        setPollingData(formData, longPollingHandler, []);

    });
};

const longPollingHandler = () => {
    $(`input[name=${CYCLIC_TERM.DIV_CALENDER}]:checked`).trigger('change');
    queryDataAndShowAGP(false, true);
}

const drawAGP = (orgData, scale = scaleOption, showPercent = isShowPercent) => {
    const data = _.cloneDeep(orgData); // if slow, change
    if (!data) {
        return;
    }

    // orgData.array_plotdata = array_plotdata;
    renderAgPAllChart(orgData.array_plotdata, orgData.COMMON.compareType, scale, showPercent)

    // implement order
    $(formElements.agpCard).sortable({});

    formElements.plotCard.empty();
    formElements.plotCard.show();

    // init filter modal
    fillDataToFilterModal(orgData.filter_on_demand, () => {
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
                   <input type="radio" data-example="2022040112" data-unit="${DIVIDE_FORMAT_UNIT[format]}" onchange="onChangeDivideFormat(this)" name="${CYCLIC_TERM.DIV_CALENDER}" id="cyclicCalender_${format}${key}" 
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
            1: 205,
            2: 252,
            3: 147,
            4: 280,
        }

        calenderListHtml += `
                <div class="cyclic-calender-option-list" style="width: ${width[key]}px">
                ${groupHtml}
                </div>
        `;
    }

    calenderList.append(calenderListHtml);
    showDateTimeRangeValue();
    const selectContent = document.getElementById('cyclicCalender-content');
    selectContent.addEventListener('open', (e) => {
        generateCalenderExample();
    })
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

const renderAgPAllChart = (plots, compareType = '', scaleOption, showPercent = false) => {
    if (!plots) return;
    $(formElements.agpCard).empty();
    let chartHeight = '';
    const maxCardInScreen = 3;
    if (plots.length >= maxCardInScreen) {
        chartHeight = `${98 / maxCardInScreen}vh`;
    } else {
        chartHeight = `${98 / plots.length}vh`;
    }

    const isCyclicCalender = compareType === divideOptions.cyclicCalender;

    plots.forEach((plotData, i) => {
        const canvasId = `agp-Chart${i}`;
        const { end_proc_id, end_col_id } = plotData;
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

        let div = isCyclicCalender ? [...useDivsArray] : plotData.unique_div;

        if (compareType === divideOptions.cyclicTerm) {
            div = currentData.COMMON.cyclic_terms;
            div = div.map((term) => term.map(t => formatDateTime(t)).join(' -<br>'))
        }

        if (compareType === divideOptions.directTerm) {
            div = currentData.time_conds.map(term => [term['start_dt'], term['end_dt']]);
            div = div.map((term) => term.map(t => formatDateTime(t)).join(' -<br>'))
        }


        // reduce full div range
        let data = plotData.data.map(data => {
            let trace = {
                ...data,
                hoverinfo: 'none',
                line: {
                    width: 0.6,
                },
                marker: {
                    size: 5,
                },
            }
            let { x, y } = trace;
            if ([divideOptions.directTerm, divideOptions.cyclicTerm].includes(compareType)) {
                x = x.map((term) => term.split(' | ').map(t => formatDateTime(t)).join(' -<br>'))
            }
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

        data = data.map(trace => {
            if (trace.type.toLowerCase() === 'bar' && showPercent) {
                return toPercent(countByXAxis, trace);
            }

            return trace;
        })
        const isReal = [DataTypes.REAL.name, DataTypes.DATETIME.name].includes(plotData.data_type);
        const yScale = isReal ? getScaleInfo(plotData, scaleOption) : null;
        drawAgPPlot(data, plotData, countByXAxis, div, isCyclicCalender, `${canvasId}`, yScale, showPercent, currentData.div_from_to);
    });
}

const toPercent = (countByXAxis, traceData) => {
    let { x, y } = traceData;
    y = y.map((val, i) => {
        if (!val) return 0;
        const xVal = x[i].slice(1);
        const total = countByXAxis[xVal];
        const percent = val / total;
        return percent;
    })

    return {
        ...traceData,
        x,
        y
    }
};

const showYAxisPercent = (e) => {
     isShowPercent = $(e).is(':checked');
     drawAGP(currentData, scaleOption, isShowPercent);
};
