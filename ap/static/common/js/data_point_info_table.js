let isInHoverInfo = false;
const dpInfoCons = {
    customdata: 'customdata',
    domID: 'dp-info-content',
    isBarChart: 'isbarchart',
    X: 'X',
    Y: 'Y',
    density: 'Density',
    datetime: 'Datetime',
    serial: 'Serial',
    from: 'From',
    to: 'To',
    value: 'Value',
    n: 'N',
    count: 'count',
    scatter: 'scatter',
    heatmap: 'heatmap',
    violin: 'violin',
    heatmapByInt: 'heatmap_by_int',
    timeseries: 'timeseries',
    dataNo: 'Number of data',
    category: 'Category',
    facet: 'Facet',
    pointIndex: 'pointIndex',
    attribute: $('#i18nAttribute'),
    lower: $('#i18nLower'),
    upper: $('#i18nUpper'),
    limit: $('#i18nLimit'),
    procLimit: $('#i18nProcLimit'),
    valid: $('#i18nValid'),
    validFrom: $('#i18nHoverValidFrom'),
    validTo: $('#i18nHoverValidTo'),
    threshLow: $('#i18nLCL'),
    threshHigh: $('#i18nUCL'),
    marginTop: 5, // margin top 5px from data point
};
const genTRItems = (firstCol, secondCol, thirdCol = null) => {
    let trEle = '<tr>';
    trEle += `<td colspan="1">${firstCol}</td>`;
    // if (!thirdCol) {
    //     trEle += `<td colspan="2">${secondCol}</td>`;
    // } else {
    //     trEle += `<td colspan="1">${secondCol}</td>`;
    //     trEle += `<td colspan="1">${thirdCol || ''}</td>`;
    // }
    trEle += `<td colspan="1">${secondCol}</td>`;
    trEle += `<td colspan="1">${thirdCol || ''}</td>`;
    trEle += '</tr>';
    return trEle;
};

let hoverInfoTimeOut = null;

const genDataPointHoverTable = (dataTable, offset, width, autoHide = true, chartID = null) => {
    // get tooltips setting to show in charts
    const tooltipsEnabled = JSON.parse(localStorage.getItem('tooltipsEnabled')) !== false;
    if (!tooltipsEnabled) return;

    initHoverInfoHandler(() => {
        const dpInforID = dpInfoCons.domID;
        $(`#${dpInforID} tbody`).html(dataTable);
        $(`#${dpInforID}`)
            .css('top', offset.y - 66 + dpInfoCons.marginTop)
            .css('left', offset.x);
        if (width) {
            $(`#${dpInforID}`).css('min-width', width);
        }
        $(`#${dpInforID}`).css('display', 'block');
    });
};
const genLabels = (source = null) => {
    const sourceLabel = source ? `(${source})` : '';
    return {
        attribute: $('#i18nAttribute').text() + sourceLabel,
        lower: $('#i18nLower').text() + sourceLabel,
        upper: $('#i18nUpper').text() + sourceLabel,
        limit: $('#i18nLimit').text() + sourceLabel,
        procLimit: $('#i18nProcLimit').text() + sourceLabel,
        valid: $('#i18nValid').text() + sourceLabel,
        validFrom: $('#i18nHoverValidFrom').text(),
        validTo: $('#i18nHoverValidTo').text(),
        threshLow: $('#i18nLCL').text() + sourceLabel,
        threshHigh: $('#i18nUCL').text() + sourceLabel,
        default: $('#partNoDefaultName').text() || 'Default',
    };
};
// use showname for Japan locale only
const filterNameByLocale = (threholdInfo) => {
    const labels = genLabels();
    const currentLocale = docCookies.getItem(keyPort('locale'));
    if (!threholdInfo.type) {
        return labels.default;
    }
    return currentLocale === localeConst.JP ? threholdInfo.type : threholdInfo.eng_name || '';
};

const showMSPDataTable = (data, offset, chartID) => {
    const isContour = !!data.z;
    if (isContour) return;
    const getFilterInfo = (chartInfo) => {
        const labels = genLabels();
        const filterCol = filterNameByLocale(chartInfo);
        const filterDetail = chartInfo.name || labels.default;
        return {
            filterCol,
            filterDetail,
        };
    };
    const genDataTable = () => {
        const datetime = toLocalTime(data.datetime) + data.suffix_label;
        const Xlabels = genLabels('X');
        const Ylabels = genLabels('Y');
        const Xfilters = getFilterInfo(data.thresholds.x);
        const Yfilters = getFilterInfo(data.thresholds.y);
        let tblContent = '<tr>';
        tblContent += genTRItems('X', data.x);
        tblContent += genTRItems('Y', data.y);
        if (data.z) {
            tblContent += genTRItems('Density', data.z);
        }
        tblContent += genTRItems('', '');
        if (data.datetime) {
            tblContent += genTRItems('Datetime', datetime);
        }
        data.serial.forEach((serial) => {
            const serialValue = serial + data.suffix_label;
            if (serial) {
                tblContent += genTRItems('Serial', serialValue);
            }
        });
        // if (data.thresholds) {
        // filter
        tblContent += genTRItems('', '');
        tblContent += genTRItems(Xlabels.attribute, Xfilters.filterCol, Xfilters.filterDetail);
        tblContent += genTRItems(Ylabels.attribute, Yfilters.filterCol, Yfilters.filterDetail);
        // threshold table
        tblContent += genTRItems('', '');
        tblContent += genTRItems('', Xlabels.limit, Xlabels.procLimit);
        tblContent += genTRItems(
            Xlabels.threshHigh,
            data.thresholds.x['thresh-high'] || '',
            data.thresholds.x['prc-max'] || '',
        );
        tblContent += genTRItems(
            Xlabels.threshLow,
            data.thresholds.x['thresh-low'] || '',
            data.thresholds.x['prc-min'] || '',
        );
        tblContent += genTRItems(Xlabels.valid, '');
        tblContent += genTRItems(Xlabels.validFrom, data.thresholds.x['act-from'] || '');
        tblContent += genTRItems(Xlabels.validTo, data.thresholds.x['act-to'] || '');
        tblContent += genTRItems('', '');
        tblContent += genTRItems('', Ylabels.limit, Ylabels.procLimit);
        tblContent += genTRItems(
            Ylabels.threshHigh,
            data.thresholds.y['thresh-high'] || '',
            data.thresholds.y['prc-max'] || '',
        );
        tblContent += genTRItems(
            Ylabels.threshLow,
            data.thresholds.y['thresh-low'] || '',
            data.thresholds.y['prc-min'] || '',
        );
        tblContent += genTRItems(Ylabels.valid, '');
        tblContent += genTRItems(Ylabels.validFrom, data.thresholds.y['act-from'] || '');
        tblContent += genTRItems(Ylabels.validTo, data.thresholds.y['act-to'] || '');
        // }
        tblContent += '</tr>';
        return tblContent;
    };
    const dataTable = genDataTable();
    genDataPointHoverTable(dataTable, offset, 130, true, chartID);
};
const genSimpleDataTable = (yValue, nTotal) => {
    const valueLabel = $('#i18nValue').text();
    let tblContent = '<tr>';
    tblContent += genTRItems(valueLabel, yValue);
    tblContent += genTRItems('N', nTotal);
    tblContent += '</tr>';
    return tblContent;
};

const genHoverDataTable = (data) => {
    let tblContent = '<tr>';
    for (const d of data) {
        const key = d[0];
        const value = d[1];
        tblContent += genTRItems(key, value);
    }
    tblContent += '</tr>';
    return tblContent;
};

const getDataPointIndex = (data) => {
    if ('pointIndex' in data.points[0]) {
        return data.points[0].pointIndex;
    }
    return data.points[0].pointIndices[0];
};

const showInforTbl = (data, horizontal = true, chartID) => {
    if (data.points) {
        const dpIndex = getDataPointIndex(data);
        const dataPoint = data.points[0];
        let countValue = horizontal ? dataPoint.data.x[dpIndex] : dataPoint.data.y[dpIndex];
        if (dpInfoCons.customdata in dataPoint.data && dpInfoCons.count in dataPoint.data.customdata) {
            countValue = dataPoint.data.customdata.count[dpIndex] || 0;
        }
        let yValue = horizontal ? dataPoint.data.y[dpIndex] : dataPoint.data.x[dpIndex];

        yValue = applySignificantDigit(yValue);

        if (dpInfoCons.customdata in dataPoint.data && dpInfoCons.isBarChart in dataPoint.data.customdata) {
            if (dataPoint.data.customdata.isbarchart) {
                yValue = dataPoint.data.customdata.groupname.value[dpIndex];
            }
        }
        const dataTable = genSimpleDataTable(yValue, countValue);
        genDataPointHoverTable(
            dataTable,
            {
                x: data.event.pageX - 120,
                y: data.event.pageY,
            },
            130,
            true,
            chartID,
        );
    }
};
// scp

const showSCPDataTable = (data, offset, chartID, type = dpInfoCons.scatter) => {
    const genDataTable = () => {
        let tblContent = '<tr>';
        if (data.data_no) {
            tblContent += genTRItems('Number of data', data.data_no);
        }
        if (data.category) {
            tblContent += genTRItems('Category', data.category);
        }
        if (data.facet) {
            tblContent += genTRItems('Facet', data.facet);
        }
        // by type
        if (type === dpInfoCons.violin) {
            tblContent += genTRItems(data.proc_no.name, data.proc_no.value);
            tblContent += genTRItems('Upper whisker', data.upper);
            tblContent += genTRItems('Q3 P75', data.q3);
            tblContent += genTRItems('Median', data.med);
            tblContent += genTRItems('Q1 P25', data.q1);
            tblContent += genTRItems('Lower whisker', data.lower);
            tblContent += genTRItems('IQR', data.iqr);
            tblContent += genTRItems('NIQR', data.niqr);
            tblContent += genTRItems('Mode', data.mode);
            tblContent += genTRItems('Average', data.avg);
            tblContent += genTRItems('N', data.n);
        } else if ([dpInfoCons.heatmap, dpInfoCons.heatmapByInt].includes(type)) {
            tblContent += genTRItems(data.xName, data.xVal);
            tblContent += genTRItems(data.yName, data.yVal);
            // tblContent += genTRItems(data.colorName, data.color);
            let [aggFunc, aggUnit] = [data.agg_func, ''];
            if (data.agg_func.includes('[%]')) {
                [aggFunc, aggUnit] = ['Ratio', '[%]'];
            }
            tblContent += genTRItems(aggFunc, applySignificantDigit(data.agg_value) + aggUnit);
        } else {
            tblContent += genTRItems('X', data.x);
            tblContent += genTRItems('Y', data.y);
            tblContent += genTRItems('Color', data.color);
            tblContent += genTRItems('', '');
            tblContent += genTRItems('Datetime', data.datetime);
            data.serial.forEach((serial) => {
                tblContent += genTRItems('Serial', serial);
            });
            tblContent += genTRItems('Time sort', data.time_numberings);
            tblContent += genTRItems('Elapsed time', data.elapsed_time);
        }
        tblContent += genTRItems('', '');
        tblContent += genTRItems(
            'From',
            formatDateTime(data.from, DATE_FORMAT_WITHOUT_TZ, {
                withMillisecs: false,
                isLocalTime: true,
            }),
        );
        tblContent += genTRItems(
            'To',
            formatDateTime(data.to, DATE_FORMAT_WITHOUT_TZ, {
                withMillisecs: false,
                isLocalTime: true,
            }),
        );

        if (type !== dpInfoCons.heatmapByInt) {
            tblContent += genTRItems('N', data.n_total);
        }
        tblContent += '</tr>';
        return tblContent;
    };
    const dataTable = genDataTable();
    genDataPointHoverTable(dataTable, offset, 130, true, chartID);
};

const clearHoverTimeOut = () => {
    if (hoverInfoTimeOut) {
        window.clearTimeout(hoverInfoTimeOut);
        hoverInfoTimeOut = null;
    }
};

const initHoverInfoHandler = (callback) => {
    if (!hoverInfoTimeOut) {
        hoverInfoTimeOut = setTimeout(() => {
            hoverInfoTimeOut = null;
            if (isInHoverInfo) return;
            isInHoverInfo = false;
            callback();
        }, 1000);
    }
};

const unHoverHandler = (plot) => {
    plot.on('plotly_unhover', () => {
        clearHoverTimeOut();
        clearOldChartTitles();
    });
};
$(() => {
    $(`#${dpInfoCons.domID}`).on('mouseleave', function () {
        $(this).hide();
        isInHoverInfo = false;
    });
    $(`#${dpInfoCons.domID}`).on('mouseover', function () {
        isInHoverInfo = true;
    });
    $(window).on('click', function (e) {
        if (!e.target.closest(`#${dpInfoCons.domID}`) && $(`#${dpInfoCons.domID}`).css('display') === 'block') {
            $(`#${dpInfoCons.domID}`).hide();
            isInHoverInfo = false;
        }

        if (!e.target.closest('context-menu')) {
            $('.context-menu').hide();
        }
    });
});
