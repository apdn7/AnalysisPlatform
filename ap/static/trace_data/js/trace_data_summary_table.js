const buildTimeSeriesSummaryResultsHTML = (summaryOption, tableIndex, generalInfo, beforeRankValues = null, stepChartSummary = null, isCTCol = false) => {
    const { getProc } = generalInfo;
    const { getVal } = generalInfo;
    const { catExpBox } = generalInfo;
    let catExpBoxHtml = '';

    let CTLabel = '';
    if (isCTCol) {
        CTLabel = `(${DataTypes.DATETIME.short}) [sec]`;
    }

    if (catExpBox) {
        const hasLevel2 = catExpBox.toString().split('|').length === 2;
        catExpBoxHtml = `
        <tr>
            <th colspan="2">
                <span class="prc-name show-detail cat-exp-box" title="${hasLevel2 ? 'Level1 | Level2' : 'Level1'}">${catExpBox}</span>
            </td>
        </tr>`;
    }

    const tableTitle = `
        <table style="width: 100%; margin-top: 10px">
            <thead>
            <tr>
                <th colspan="2">
                    <span class="prc-name" title="${getProc}">${getProc}</span>
                </td>
            </tr>
            <tr>
                <th colspan="2">
                    <span class="prc-name" title="${getVal}">${getVal} ${CTLabel}</span>
                </td>
            </tr>
            ${catExpBoxHtml}
            </thead>
        </table>
    `;

    const summaryHtml = buildSummaryResultsHTML(summaryOption, tableIndex, generalInfo, beforeRankValues, stepChartSummary);

    return `
        <div style="width: 100%">
            ${tableTitle}
            ${summaryHtml}
        </div>
    `;

};

const removeClass = (element) => {
    const colClasses = element.prop('className').split(' ').filter(x => x.startsWith('col-sm'));
    for (const cls of colClasses) {
        element.removeClass(cls);
    }
};

const onChangeSummaryEventHandler = (showScatterPlot) => {
    $('input[name=summaryOption]').on('change', function f() {
        const summaryClass = $(this).val();

        if (summaryClass === 'none') {
            $('.time-series').each(function changeColWidth() {
                removeClass($(this));
                if (!showScatterPlot) {
                    $(this).addClass('col-sm-9');
                } else {
                    $(this).addClass('col-sm-8');
                }
            });

            $('.summary-col').each(function showHideSummary() {
                $(this).removeClass('col-sm-2');
                $(this).css('display', 'none');
            });
            $('.ts-col').each(function changeTSChartWidth() {
                $(this).removeClass('col-sm-10');
                $(this).addClass('col-sm-12');
            });

            $('.tschart-title-parent').show();
        } else {
            $('.time-series').each(function changeColWidth() {
                removeClass($(this));
                if (!showScatterPlot) {
                    $(this).addClass('col-sm-9');
                } else {
                    $(this).addClass('col-sm-8');
                }
            });
            $('.ts-col').each(function changeTSChartWidth() {
                $(this).removeClass('col-sm-12');
                $(this).addClass('time-series-col');
            });
            $('.summary-col').each(function showHideSummary() {
                $(this).css('display', 'block');
            });
            $('.result').each(function showUponOption() {
                $(this).css('display', 'none');
                if ($(this).hasClass(summaryClass)) {
                    $(this).css('display', 'block');
                }
            });
            $('.tschart-title-parent').hide();
        }
        // adjust cate-table length
        // get width of current Time Series chart
        setTimeout(() => {
            adjustCatetoryTableLength();
        }, 500);

        // histogram tab, summary select menu
        onChangeHistSummaryEventHandler(this);
    });
};


const onChangeHistSummaryEventHandler = (e) => {
    let summaryHeight = null;
    const summaryClass = $(e).val();
    const previousOption = $('input[name=summaryOption][data-checked=true]');
    if (summaryClass === 'none') {
        $('.hist-summary').each(function showHideSummary() {
            $(this).css('display', 'none');
        });

        if (previousOption.val() && previousOption.val() !== 'none') {
            // rescale histogram
            $('.his .hd-plot').each(function reScaleHistogram() {
                const histogramId = $(this).attr('id');
                $(`#${histogramId}`).css('height', GRAPH_CONST.histHeight);
                Plotly.relayout(histogramId, {});
            });
        }

        // mark this option as checked and remove others
        $(e).attr('data-checked', 'true');
        $('input[name=summaryOption]:not(:checked)').removeAttr('data-checked');
    } else {
        $('.hist-summary').each(function showHideSummary() {
            $(this).css('display', 'flex');
            $(this).css('justify-content', 'center');
        });
        $('.hist-summary-detail').each(function showUponOption() {
            $(this).css('display', 'none');
            if ($(this).hasClass(summaryClass)) {
                $(this).css('display', 'block');
                const h = $(this).height();
                summaryHeight = h < summaryHeight ? summaryHeight : h;
            }
        });

        // rescale only when from none -> not-none or not-none -> none to improve performance
        $('.his .hd-plot').each(function reScaleHistogram() {
            const histogramId = $(this).attr('id');
            const chartHeight = `calc(100% - ${summaryHeight + 6}px)`;
            $(`#${histogramId}`).css('height', chartHeight);
            Plotly.relayout(histogramId, {});
        });


        // mark this option as checked and remove others
        $(e).attr('data-checked', 'true');
        $('input[name=summaryOption]:not(:checked)').removeAttr('data-checked');
    }
};