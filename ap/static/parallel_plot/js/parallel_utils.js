class ParallelPlot {
    constructor(domID, traceData, maxWidth, maxHeight) {
        this.plotDOMId = domID;
        this.traceData = traceData;
        this.objective = undefined;
        this.explain = undefined;
        this.autoAssignMaxCorr = true;
        this.plotWidth = maxWidth;
        this.plotHeight = maxHeight;

        this.data = {};
        this.layout = {};
        this.dimensions = [];
        this.allDimensions = [];
        this.nominalVars = [];
        this.fromJump = false;
        this.selectedOrder = [];
        this.selectedConstraintRange = {};
        this.objectiveDimInfo = {};

        // init objective variable
        this.setObjective();

        // init settings
        this.setSettings();
    }

    // check type of variable is number or category
    isNumberVariable(colId, colData = undefined) {
        if (!colData) {
            [colData] = this.traceData.array_plotdata.filter((col) => String(col.col_detail.col_id) === String(colId));
        }
        if (!colData) {
            // not found column data
            return undefined;
        }
        return !colData.col_detail.is_category;
    }

    // set maxCorr(isAuto) {
    //     this.autoAssignMaxCorr = isAuto;
    // }
    setObjective(objectiveId, isExplain = false) {
        if (!objectiveId) {
            objectiveId = this.traceData.COMMON.objectiveVar;
            if (_.isArray(objectiveId)) {
                objectiveId = objectiveId[0];
            }
        }
        const [colData] = this.traceData.array_plotdata.filter(
            (col) => String(col.col_detail.col_id) === String(objectiveId),
        );
        if (colData) {
            const updateCol = {
                id: Number(objectiveId),
                data: colData.array_y,
                procId: colData.col_detail.proc_id,
                name: `${colData.col_detail.proc_id}-${objectiveId}`,
                type: colData.col_detail.data_type,
                asNumber: this.isNumberVariable(objectiveId, colData),
            };

            if (isExplain) {
                // if there is already objective, do no thing
                if (updateCol.id !== this.objective.id) {
                    this.explain = updateCol;
                }
            } else {
                this.objective = updateCol;
            }
        }
    }

    // plot setting from GUI
    setSettings(settings) {
        let defaultShowChart =
            this.objective && this.objective.asNumber
                ? ParallelProps.showVariables.ALL
                : ParallelProps.showVariables.CATEGORY;
        this.settings = {
            showVars: defaultShowChart,
            orderBy: ParallelProps.orderBy.correlation,
            corrSetting: {
                byCorr: false, // default
                min: undefined, // get variable which corr >= min value
                top: 8, // show top 8 largest corr. cols
                dimNum: undefined, // if min is set, show top 'dim_num' cols >= min
            },
            valueOrder: ParallelProps.valueOrder.DESC, // order value of dimension, from top to bot
        };
        if (settings) {
            this.settings.showVars = settings.showVars || this.settings.showVars;
            this.settings.orderBy = settings.orderBy || this.settings.orderBy;
            this.settings.fineSelect = settings.fineSelect || false;
            this.settings.yScaleOption = settings.yScaleOption || scaleOptionConst.AUTO;
            if (settings.corrSetting) {
                // reset corrSetting
                this.settings.corrSetting = {};
                if (this.settings.orderBy === ParallelProps.orderBy.correlation) {
                    this.settings.corrSetting = settings.corrSetting.byCorr
                        ? {
                              byCorr: true,
                              min: settings.corrSetting.minCorr,
                              dimNum: settings.corrSetting.varNum,
                              top: undefined,
                          }
                        : {
                              byCorr: false,
                              min: undefined,
                              dimNum: undefined,
                              top: settings.corrSetting.top,
                          };
                }
            }

            // set order default value for paracat only
            if (this.settings.showVars === ParallelProps.showVariables.CATEGORY) {
                this.settings.orderBy = ParallelProps.orderBy.process;
            }
            this.settings.useCorrDefaultThreshold =
                settings.useCorrDefaultThreshold !== undefined ? settings.useCorrDefaultThreshold : true;
        }
        // reset custom ordering
        this.selectedOrder = [];
    }

    setJump(isJump) {
        this.fromJump = isJump;
    }

    setOrdering(ordering, useDimID = false) {
        this.selectedOrder = ordering;
        if (useDimID) {
            this.selectedOrder = this.selectedOrder
                .map((dimID) => {
                    const selectedDim = this.allDimensions.filter(
                        (dim) => dim.dimID === dimID && dim.dimID !== this.objective.name,
                    );
                    return selectedDim.length ? selectedDim[0] : undefined;
                })
                .filter((dim) => dim !== undefined);
        }

        let objectiveDim = this.allDimensions.filter((dim) => dim.dimID === this.objective.name);
        objectiveDim = objectiveDim.length ? objectiveDim[0] : null;
        // push origin objective variable
        if (objectiveDim) {
            this.selectedOrder.push(objectiveDim);
        }
        // update setting
        this.settings.orderBy = ParallelProps.orderBy.selected_order;
    }

    // bind events of plot
    bindEvents() {
        const plotDOM = document.getElementById(this.plotDOMId);
        // bind event after plot
        plotDOM.on('plotly_afterplot', () => {
            const dPVar = this.dimensions.map((dim) => dim.dimID);
            const dNames = this.dimensions.map((dim) => dim.dimName);
            const axisDim = $('.axis-title');
            if (this.settings.fineSelect) {
                axisDim.addClass('fineSelect');
            }
            if (dPVar.length) {
                dPVar.forEach((dimension, i) => {
                    $(axisDim[i]).attr('data-dpv', dimension);
                    // $(axisDim[i]).attr('data-dName', dNames[i]);
                });
                dNames.forEach((dimension, i) => {
                    $(axisDim[i]).attr('data-dName', dimension);
                });
            }
            const isParacat = [ParallelProps.showVariables.CATEGORY, ParallelProps.showVariables.CATEGORIZED].includes(
                this.settings.showVars,
            );
            if (isParacat && this.objective.id && this.dimensions) {
                // update dimension color for category variables
                const dimInSVG = document.getElementsByClassName('dimension');
                this.dimensions.forEach((dim, i) => {
                    // add custom data
                    $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dpv', dim.dimID);
                    $($(dimInSVG[i]).find('.dimlabel')[0]).attr('data-dName', dim.dimName);
                    if (dim.isCategorize) {
                        $($(dimInSVG[i]).find('.dimlabel')[0]).attr('is-categorize', dim.isCategorize);
                    }
                });
            }
            if (!this.fromJump || !latestSortColIds) {
                bindChangeDimColor(this.objective, isParacat);
            }
        });
        // bind hover event
        plotDOM.on('plotly_hover', (data) => {
            if (!data.points) return;
            const count = data.points.length;
            const offset = {
                x: data.event.pageX - 120,
                y: data.event.pageY,
            };
            const ratio = applySignificantDigit((count / this.traceData.actual_record_number) * 100);
            const tbl = genHoverDataTable([
                ['N', applySignificantDigit(count)],
                ['Ratio', `${ratio}%`],
            ]);

            genDataPointHoverTable(tbl, offset, 100, true, 'paracord-plot');
        });
        // bind unhover event
        unHoverHandler(plotDOM);
        // update dimension position for pcp
        $('.axis-title').each((i, el) => {
            const isCategory = $(el).attr('data-unformatted').toString().includes('is-category');
            if (isCategory) {
                const showFilterClass = 'show-detail click-only';
                $(el).find('tspan:last-child tspan').addClass(showFilterClass);
            }
        });
        // update dimension position for pcat
        $('.axis-title, text.dimlabel').contextmenu((e) => {
            const label = $(e.currentTarget).text();
            const dimInfo = $(e.currentTarget).data('dpv');

            if (label && dimInfo) {
                // [targetSensorName] = label.split(' ');
                // targetDim = dimInfo.split('-').map(i => Number(i));
                $('#contextMenuParallelPlot .menu-item').attr('data-target-dim', dimInfo);
            }
            selectTargetDimHandler(e);
        });
    }

    genCorrValue() {
        if (this.autoAssignMaxCorr) {
            const corrVals = this.data.length ? this.data.map((i) => (i.correlation ? Number(i.correlation) : 0)) : [];
            const maxCorr = Math.round(Math.max(...corrVals) * 0.8 * 1000) / 1000;
            if (maxCorr) {
                const corrDOM = $('input[name=corr_value]');
                corrDOM.val(maxCorr);
                corrDOM.attr(CONST.DEFAULT_VALUE, maxCorr);
            }
        }
    }

    genDefaultSetting() {
        const elementTopVar = $(`input[name='top_vars']`);
        const elementMaxVar = $(`input[name='max_vars']`);
        const defaultTopVar = elementTopVar.attr(CONST.DEFAULT_VALUE);
        const defaultMaxVar = elementMaxVar.attr(CONST.DEFAULT_VALUE);
        elementTopVar.val(this.settings.corrSetting.top ? this.settings.corrSetting.top : defaultTopVar);
        elementMaxVar.val(this.settings.corrSetting.dimNum ? this.settings.corrSetting.dimNum : defaultMaxVar);
    }

    // gen chart options
    genPlotlyIconsSetting() {
        return {
            modeBarButtonsToRemove: [
                'zoom2d',
                'pan2d',
                'select2d',
                'lasso2d',
                'zoomIn2d',
                'zoomOut2d',
                'hoverClosestCartesian',
                'hoverCompareCartesian',
                'toggleSpikelines',
                'sendDataToCloud',
            ],
            displaylogo: false,
        };
    }

    // gen plot layout
    genLayout() {
        const widthByDim = 130 * this.dimensions.length;
        let plotWidth = this.plotWidth - 50;
        if (widthByDim >= this.plotWidth) {
            plotWidth = widthByDim;
        }
        return {
            plot_bgcolor: '#303030',
            paper_bgcolor: '#303030',
            font: { color: CONST.WHITE },
            colorbar: {
                thickness: 1,
            },
            width: plotWidth,
            height: this.plotHeight,
            padding: {
                t: 30,
            },
            margin: { l: 150, r: 150 },
        };
    }

    // get dimension values with NA
    // genDimValWithNA(sensorDat) {
    //     return sensorDat.array_y.map((i) => {
    //         if (CONST.NAV.includes(i)) {
    //             return CONST.NA;
    //         }
    //         return i || 0;
    //     });
    // }

    // gen dimension range text for real sensor
    genDimRangeText(dimValues, infIDX, minfIDX, isInt = false, fmt = '', fineSelect = false, [yMin, yMax]) {
        const notNADim = dimValues.filter((i) => i === 0 || i);
        // const [minText, maxText] = findMinMax(notNADim);
        const [minText, maxText] = [yMin, yMax];
        const rangeVals = maxText - minText;
        const stepVals = rangeVals / 9;
        const fractionDigit = rangeVals <= 1 ? 4 : 2; // change 3 => 4 to fix 0.0000
        const irrNum = maxText?.toString().includes('e') || minText?.toString().includes('e');
        let tickVals = Array(
            ...new Set(
                Array(...Array(10)).map((v, i) => {
                    const tickVal = minText + stepVals * i;
                    if (isInt) {
                        return parseInt(tickVal, 10);
                    }

                    if (fmt && (fmt.includes('e') || irrNum)) {
                        return applySignificantDigit(tickVal, 4, fmt);
                    }
                    return parseFloat(tickVal.toFixed(fractionDigit));
                }),
            ),
        );

        // check inf/-inf

        const naPosition =
            infIDX.length > 0 && minfIDX.length > 0 ? 3 : infIDX.length > 0 || minfIDX.length > 0 ? 2 : 1;
        // inf position
        const infDumVal = minText - stepVals;
        const minfDumVal = minText - 2 * stepVals;
        let naVals = false;
        // check dim have na values
        const naDumVal = minText - naPosition * stepVals;
        // if fine select on -> do not transform values
        const transDim = dimValues.map((v, i) => {
            if (CONST.NAV.includes(v) && !fineSelect) {
                if (infIDX.includes(i)) {
                    return infDumVal;
                } else if (minfIDX.includes(i)) {
                    return minfDumVal;
                } else {
                    naVals = true;
                    return naDumVal;
                }
            }
            if (CONST.NAV.includes(v) && fineSelect) {
                return null;
            }
            return v;
        });

        let tickText = tickVals;
        if (infIDX.length > 0) {
            tickText = [...tickText, COMMON_CONSTANT.INF];
            tickVals = [...tickVals, infDumVal];
            // tickText = [COMMON_CONSTANT.INF, ...tickText];
            // tickVals = [infDumVal, ...tickVals];
        }
        if (minfIDX.length > 0) {
            tickText = [COMMON_CONSTANT.MINF, ...tickText];
            tickVals = [minfDumVal, ...tickVals];
        }
        if (naVals) {
            tickText = [COMMON_CONSTANT.NA, ...tickText];
            tickVals = [naDumVal, ...tickVals];
        }
        return {
            values: transDim,
            ticktext: tickText,
            tickvals: tickVals,
        };
    }
    // gen dimension label for PCat
    genPCatDimLabel(colData, corr) {
        // labelColor will be set after plot chart
        const isNumCol = this.isNumberVariable(colData.end_col_id, colData);
        let dimProcName = shortTextName(colData.col_detail.proc_shown_name, CONST.LIMIT_SIZE_NAME);
        let dimSensorName = shortTextName(colData.col_detail.col_shown_name);

        let dimLabel = `${dimSensorName} ${dimProcName}`;
        if (isNumCol) {
            dimLabel = `${dimSensorName}[${applySignificantDigit(corr)}]`;
        }

        return dimLabel;
    }
    // gen dimension color
    genPCPDimLabel(colData, corr) {
        let labelColor = CONST.WHITE;
        const startProcID = this.traceData.COMMON.start_proc;
        const isNumCol = this.isNumberVariable(colData.end_col_id, colData);

        if (this.objective.id === Number(colData.end_col_id)) {
            labelColor = CONST.YELLOW;
        } else if (Number(colData.col_detail.proc_id) === Number(startProcID)) {
            labelColor = CONST.LIGHT_BLUE;
        }
        let dimProcName = shortTextName(colData.col_detail.proc_shown_name, CONST.LIMIT_SIZE_NAME);
        let dimSensorName = shortTextName(colData.col_detail.col_shown_name);
        let dimLabel = `<span style="color: ${labelColor};" class="dim-sensor">${dimSensorName}</span><br>`;
        dimLabel += `<span style="color: ${labelColor};" class="dim-proc">${dimProcName}[${applySignificantDigit(corr)}]</span>`;
        if (!isNumCol) {
            let special_corr = '';
            if (ParallelProps.intTypes.includes(colData.col_detail.type)) {
                special_corr = `[${applySignificantDigit(corr)}]`;
            }
            dimLabel = `<span style="color: ${labelColor};">${dimSensorName}</span><br>`;
            dimLabel += `<span is-category style="color: ${labelColor};">${dimProcName}${special_corr}</span>`;
        }
        return dimLabel;
    }
    markupNAValue(dimValue) {
        let encodedValue = {};
        const NADefinition = [null, undefined, 'NA'];
        const hasNA = !!dimValue.filter((i) => NADefinition.includes(i)).length;
        if (hasNA) {
            const uniqValues = Array.from(new Set(dimValue));
            const minValue = Math.min(...uniqValues.filter((i) => !NADefinition.includes(i)));
            const naValue = minValue - 1;
            encodedValue = { NA: naValue };
            dimValue = dimValue.map((i) => (NADefinition.includes(i) ? naValue : i));
        }
        return [dimValue, encodedValue];
    }
    rearrangeDimValue(colData, dim, asPCat = true) {
        const isCategoryCol = !this.isNumberVariable(colData.end_col_id, colData);
        const sortFunc = (a, b) => {
            return this.settings.valueOrder === ParallelProps.valueOrder.DESC ? b - a : a - b;
            // if (this.settings.valueOrder === ParallelProps.valueOrder.DESC) {
            //     return (a > b ? -1 : 1);
            // }
            // return (b > a ? -1 : 1);
        };
        const naIdx = dim.tickvals.indexOf(CONST.NAV);
        const naValues = {
            categoryarray: asPCat ? dim.categoryarray[naIdx] : null,
            group: asPCat ? dim.group[naIdx] : null,
            ticktext: asPCat ? dim.ticktext[naIdx] : null,
            tickvals: asPCat ? dim.tickvals[naIdx] : null,
        };
        // todo: remove NA before sort
        let tickValsSorted = [...dim.tickvals].sort(sortFunc);
        let sortIndex = tickValsSorted.map((tick) => dim.tickvals.indexOf(tick));
        dim.categoryarray = asPCat ? sortIndex.map((idx) => dim.categoryarray[idx]) : null;
        dim.group = asPCat ? sortIndex.map((idx) => dim.group[idx]) : null;
        dim.ticktext = sortIndex.map((idx) => dim.ticktext[idx]);
        dim.tickvals = sortIndex.map((idx) => dim.tickvals[idx]);

        if (isCategoryCol && Object.keys(colData.rank_value).length) {
            if (dim.ticktext.includes('NA')) {
                const naIdx = dim.ticktext.indexOf('NA');
                dim.values = dim.values.map((i) => (i == naIdx ? -1 : i));
            }
        }
        return dim;
    }

    // this function using to check if the data include valid chartInfo or not
    checkIsValidChartInfo(chartInfos) {
        return chartInfos.some((chartInfo) => {
            for (let key in chartInfo) {
                if (chartInfo[key] != null) {
                    return true;
                }
            }
            return false;
        });
    }

    // get yScale, colValue base on chartInfo (using for PCP and PCat Dimension)
    getYScaleAndColValue({ colData, colValue }) {
        // get y scale select value
        const yScaleSelectValue = this.settings.yScaleOption;

        // get yScale Value [yMin, yMax]
        let yScale = getScaleInfo(colData, yScaleSelectValue);
        const isValidChartInfo = this.checkIsValidChartInfo(colData['chart_infos']);

        // if: colValue not having valid chartInfo and "yScale Select Value" is Threshold
        // OR "yScale Select Value" is auto range
        // OR if colValue not having valid chartInfo and "yScale Select Value" is setting_config
        // => set is DimRange is full
        if (
            (!isValidChartInfo && yScaleSelectValue === scaleOptionConst.THRESHOLD) ||
            yScaleSelectValue === scaleOptionConst.AUTO ||
            (!isValidChartInfo && yScaleSelectValue === scaleOptionConst.SETTING)
        ) {
            yScale = getScaleInfo(colData, scaleOptionConst.FULL_RANGE);
        }

        return { colValue, yScale };
    }

    // gen dimension data
    genPCPDimension(colData) {
        const { colValue, yScale } = this.getYScaleAndColValue({
            colData,
            colValue: [...colData.array_y],
        });

        const fmt = this.traceData.fmt[colData.end_col_id];
        const [yMin, yMax] = [yScale['y-min'], yScale['y-max']];
        const isIntColType = colData.col_detail.data_type === DataTypes.INTEGER.name;

        let dim = this.genDimRangeText(
            colValue,
            colData.inf_idx,
            colData.m_inf_idx,
            isIntColType,
            fmt,
            this.settings.fineSelect,
            [yMin, yMax],
        );

        // for int or string col with ranked encoding
        if (!_.isEmpty(colData.rank_value)) {
            const ranking = Object.keys(colData.rank_value);
            dim.tickvals = ranking;
            if (ranking.length > MAX_CAT_LABEL) {
                const step = Math.floor(ranking.length / MAX_CAT_LABEL);
                dim.tickvals = ranking.filter((k) => Number(k) === 0 || (Number(k) + 1) % step === 0);
            }
            dim.tickvals = dim.tickvals.map((i) => Number(i));
            dim.ticktext = dim.tickvals.map((i) => colData.rank_value[i]);
        }
        dim.tickvals = dim.tickvals.map((i) => Number(i));
        dim = this.rearrangeDimValue(colData, dim, false);
        // get dimRange in dim.tickvals instead of dim.values
        const dimRange = findMinMax(dim.tickvals);
        // if auto range & full range
        // extend dimension range
        const isExtendingRange = [scaleOptionConst.AUTO, scaleOptionConst.FULL_RANGE].includes(
            this.settings.yScaleOption,
        );
        if (isExtendingRange) {
            const dimRangeValue = findMinMax(dim.values);
            dimRange[0] = Math.min(dimRange[0], dimRangeValue[0]);
            dimRange[1] = Math.max(dimRange[1], dimRangeValue[1]);
        }
        let corr = getCorrelation(this.traceData.corrs, colData.col_detail.col_id, this.objective.id);
        dim.ticktext = dim.ticktext.map((i) => String(i));
        const notShowTicks = this.settings.fineSelect && !colData.col_detail.is_category;
        // store calculated values of objectiveDimension only for colorbar calculation
        if (colData.col_detail.col_id === this.objective.id) {
            this.objectiveDimInfo = {
                values: dim.values,
                ticktext: dim.ticktext,
                tickvals: dim.tickvals,
                is_judge: colData.col_detail.is_judge,
            };
        }
        return {
            values: dim.values,
            ticktext: notShowTicks ? null : dim.ticktext,
            tickvals: notShowTicks ? null : dim.tickvals,
            label: this.genPCPDimLabel(colData, corr),
            process: colData.col_detail.proc_id,
            is_judge: colData.col_detail.is_judge,
            dimID: `${colData.col_detail.proc_id}-${colData.col_detail.col_id}`, // dPV
            dimName: `${colData.col_detail.col_shown_name} ${colData.col_detail.proc_shown_name}`,
            // isReal: 1, // todo remove
            isNum: this.isNumberVariable(colData.end_col_id, colData),
            correlation: corr,
            range: dimRange,
            colId: colData.end_col_id,
        };
    }
    // gen dimension data
    genPCatDimension(colData) {
        // hide scale y when selection is CATEGORY
        if (
            this.settings.showVars === paracordsSetting.showVariables.CATEGORY ||
            this.settings.showVars === paracordsSetting.showVariables.CATEGORIZED
        ) {
            $(formElements.yScaleOption).parent().addClass('hidden-important');
        }

        let rankValues = {};
        const isNumber = this.isNumberVariable(colData.end_col_id, colData);
        let dim = {
            categoryorder: 'array', // set 'array' to ordering groups by ticktext
            values: [...colData.array_y].map((i) => (i !== null ? Number(i) : i)),
        };
        // categorized real data or big int
        if (colData.categorized_data.length) {
            dim.values = colData.categorized_data;
            [dim.values, rankValues] = this.markupNAValue(dim.values);
            if (colData.col_detail.data_type === DataTypes.INTEGER.name) {
                dim.values = dim.values.map((i) => parseInt(i));
            }
            dim.tickvals = Array.from(new Set(dim.values)).map((i) => Number(i));
            dim.ticktext = dim.tickvals;
        }

        // for int or string col with ranked encoding
        if (!_.isEmpty(colData.rank_value)) {
            const ranking = Object.keys(colData.rank_value);
            dim.tickvals = ranking;
            if (ranking.length > MAX_CAT_LABEL) {
                const step = Math.floor(ranking.length / MAX_CAT_LABEL);
                dim.tickvals = ranking.filter((k) => Number(k) === 0 || (Number(k) + 1) % step === 0);
            }
            dim.tickvals = dim.tickvals.map((i) => Number(i));
            dim.ticktext = dim.tickvals.map((i) => colData.rank_value[i]);
        }
        dim.categoryarray = dim.tickvals;
        dim.group = dim.tickvals;

        // sort value and re-arrange for nominal dimension
        dim = this.rearrangeDimValue(colData, dim);
        const corr = getCorrelation(this.traceData.corrs, colData.col_detail.col_id, this.objective.id);
        if (isNumber) {
            dim.ticktext = dim.ticktext.map((i) => {
                if (Object.keys(rankValues).length && i === rankValues.NA) {
                    return 'NA';
                }
                return `${applySignificantDigit(i)}`;
            });
        } else {
            dim.ticktext = dim.ticktext.map((i) => String(i));
        }
        return {
            values: dim.values,
            ticktext: dim.ticktext,
            tickvals: dim.tickvals,
            group: dim.group,
            categoryarray: dim.categoryarray,
            // categoryorder: 'category descending',
            label: this.genPCatDimLabel(colData, corr),
            process: colData.col_detail.proc_id,
            is_judge: colData.col_detail.is_judge,
            dimID: `${colData.col_detail.proc_id}-${colData.col_detail.col_id}`, // dPV
            dimName: `${colData.col_detail.col_shown_name} ${colData.col_detail.proc_shown_name}`,
            isNum: this.isNumberVariable(colData.end_col_id, colData),
            colID: colData.end_col_id,
            // isReal: 0,
            correlation: corr,
        };
    }
    validateObjectiveType(colType = null) {
        if (this.traceData['from_jump_emd']) {
            return true;
        }
        colType = colType || this.objective.type;
        const showVars = this.settings.showVars;
        return ParallelProps.validDataTypes[showVars].includes(colType);
    }
    validateCorr(colData) {
        return (
            this.settings.corrSetting.min <= Math.abs(this.traceData.corrs.corr[this.objective.id][colData.end_col_id])
        );
    }
    filterDimension(colData) {
        let isValid = this.validateObjectiveType(colData.col_detail.data_type);
        if (
            isValid &&
            this.settings.orderBy === ParallelProps.orderBy.correlation &&
            this.settings.corrSetting.min !== undefined
        ) {
            isValid = this.validateCorr(colData);
        }
        return isValid;
    }
    updateDefaultCorrThreshold(dimensions) {
        const explainDims = dimensions.filter((dim) => dim.dimID !== this.objective.name);
        const corrVals = explainDims.length ? explainDims.map((i) => (i.correlation ? Number(i.correlation) : 0)) : [];
        const maxCorr = Math.round(Math.max(...corrVals) * 0.8 * 1000) / 1000;
        if (maxCorr) {
            $('input[name=corr_value]').val(maxCorr);
            $('input[name=corr_value]').attr(CONST.DEFAULT_VALUE, maxCorr);
        }
    }
    orderDimension(dimension) {
        if (this.selectedOrder.length) {
            return this.selectedOrder;
        }
        // todo: order dimension by setting
        // limitation
        let limit = this.settings.corrSetting.top || this.settings.corrSetting.dim_num || dimension.length;
        // add one more to show objective var
        limit += 1;
        if (dimension.length && this.settings.orderBy === ParallelProps.orderBy.correlation && limit !== 0) {
            // order by correlation number of dimension
            dimension.sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation));
            dimension = [...dimension].reverse().slice(0, limit).reverse();
        }
        // objective variable in last column
        const objectiveDimension = dimension.filter((dim) => dim.dimID === this.objective.name);

        let explainDimension = [];
        if (this.explain) {
            explainDimension = dimension.filter((dim) => dim.dimID === this.explain.name);
        }
        let otherDimensions = [
            ...dimension.filter(
                (dim) => dim.dimID !== this.objective.name && (this.explain ? dim.dimID !== this.explain.name : true),
            ),
        ];

        if (this.settings.orderBy === ParallelProps.orderBy.correlation) {
            otherDimensions = otherDimensions.sort(propComparator(this.settings.orderBy));
        }

        if (this.settings.orderBy === ParallelProps.orderBy.setting) {
            otherDimensions = otherDimensions.sort(propComparator('colId'));
        }

        if (this.settings.orderBy === ParallelProps.orderBy.process) {
            const order = this.traceData.proc_link_order;
            if (order) {
                otherDimensions = otherDimensions?.sort((x, y) => order.indexOf(x.process) - order.indexOf(y.process));
            }
        }
        let nonObjectiveDimension = [...otherDimensions, ...explainDimension];
        // append objectiveDimension at the end after sorting
        dimension = [...nonObjectiveDimension, ...objectiveDimension];
        // update corr default threshold
        if (this.settings.useCorrDefaultThreshold) {
            this.updateDefaultCorrThreshold(dimension);
        }
        return dimension;
    }
    genMarkupDataForEndDim() {
        // apply for category dimension only (str & int<128)
        const endDim = this.dimensions[this.dimensions.length - 1];
        const is_judge = endDim.is_judge;
        const NAValue = -1;
        //  use tickvals instead of raw data to avoid range error
        //  (Maximum call stack size exceeded)
        const maxVal = Math.max(...endDim.tickvals) + 1;
        // detect NA group
        let hasNA = false;
        if (endDim.ticktext.includes(CONST.NA)) {
            let naIdx = endDim.ticktext.indexOf(CONST.NA);
            if (naIdx < 0 && Object.keys(endDim).includes('group')) {
                naIdx = endDim.group.indexOf(CONST.NA);
            }
            hasNA = naIdx >= 0;
            if (hasNA) {
                endDim.categoryarray.splice(naIdx, 1);
                endDim.group.splice(naIdx, 1);
                endDim.ticktext.splice(naIdx, 1);
            }
        }

        // create dummy values
        let dummyVals = endDim.values;
        let uniqueVals = Array.from(new Set(dummyVals)).sort((a, b) => (is_judge ? b - a : a - b));
        let reverseVals = is_judge ? [...uniqueVals] : [...uniqueVals].reverse();
        // add NA again
        if (hasNA) {
            uniqueVals = [...uniqueVals.filter((i) => i !== NAValue), NAValue];
            reverseVals = [...reverseVals.filter((i) => i !== NAValue), NAValue];
        }
        // create dummy value
        endDim.values = dummyVals.map((i) => reverseVals[uniqueVals.indexOf(i)]);

        // update categoryarray
        endDim.categoryarray = uniqueVals;

        if (hasNA) {
            endDim.values = endDim.values.map((i) => (i === NAValue ? maxVal : i));
            endDim.categoryarray = endDim.categoryarray.map((i) => (i === NAValue ? maxVal : i));
        }
        // update tickvals
        endDim.tickvals = endDim.categoryarray;

        // update ticktext
        const tickWoNA = is_judge ? endDim.ticktext : endDim.ticktext.reverse();
        endDim.ticktext = hasNA ? [...tickWoNA.filter((i) => i !== CONST.NA), CONST.NA] : tickWoNA;
        endDim.ticktext = is_judge ? [...endDim.ticktext] : [...endDim.ticktext].reverse();

        // update group
        endDim.group = endDim.categoryarray;
        return endDim;
    }

    genPCatData() {
        const endDim = this.genMarkupDataForEndDim();
        const colorScale = endDim.is_judge ? genColorScaleForJudge(endDim.ticktext) : colorPallets.JET_REV.scale;
        // const endDim = this.dimensions[this.dimensions.length - 1];
        const lineCfg = {
            color: endDim.values,
            colorscale: colorScale,
            showscale: false,
            // reversescale: true,
        };
        return [
            {
                type: 'parcats',
                dimensions: this.dimensions,
                line: lineCfg,
                hoveron: 'color',
                hoverinfo: 'none',
                labelfont: { size: 10.5 },
                arrangement: 'freeform',
            },
        ];
    }
    genPCPData() {
        const fmt = this.traceData.fmt[this.objective.id];
        const objectiveDimInfo = this.objectiveDimInfo;
        // get colors for lines from objective dimension data (replaced NA with naDumVal etc)
        const colors = objectiveDimInfo.values;
        const { tickVals, tickText, nTicks } = this.calcParcoordsLineColorBar(objectiveDimInfo);
        const colorScale = objectiveDimInfo.is_judge
            ? genColorScaleForJudge(objectiveDimInfo.ticktext)
            : dnJETColorScale;
        return [
            {
                type: 'parcoords',
                line: {
                    showscale: true,
                    reversescale: false,
                    colorscale: colorScale,
                    color: colors,
                    colorbar: {
                        tickformat: fmt,
                        tickvals: tickVals,
                        ticktext: tickText,
                        nticks: nTicks,
                    },
                },
                labelfont: { size: 10.5 },
                hoverinfo: 'none',
                dimensions: this.dimensions,
            },
        ];
    }
    // gen dimension data
    genData(useCurrentObjectiveVar = true) {
        const asDiscretePlot = [ParallelProps.showVariables.CATEGORY, ParallelProps.showVariables.CATEGORIZED].includes(
            this.settings.showVars,
        );
        let dimension = [];
        if (useCurrentObjectiveVar && !this.validateObjectiveType()) {
            return [];
        }
        if (this.traceData.COMMON.is_nominal_scale === 'true') {
            this.nominalVars = this.traceData.category_cols.map((col) => col.col_id);
        }
        dimension = this.traceData.array_plotdata
            .filter((colData) => this.filterDimension(colData))
            .map((colData) => (asDiscretePlot ? this.genPCatDimension(colData) : this.genPCPDimension(colData)));
        this.allDimensions = [...dimension];
        this.dimensions = this.orderDimension(dimension);
        if (asDiscretePlot) {
            this.data = this.genPCatData();
        } else {
            this.data = this.genPCPData();
        }
    }

    setSelectedValue(colId, constraintRange) {
        if (constraintRange) {
            this.selectedConstraintRange[colId] = constraintRange;
        } else {
            delete this.selectedConstraintRange[colId];
        }
    }

    getTickFormat(format) {
        const tickFormat = ParallelProps.tickFormat;
        if (format === tickFormat.integer) return tickFormat.integer;
        if (format === tickFormat.none) return tickFormat.none;
        if (tickFormat.patternReal.test(format)) return tickFormat.real;
        return tickFormat.logarithm;
    }

    formatTickVals(data, format) {
        if (!data.length) return data;
        const tickFormatObj = ParallelProps.tickFormat;
        if (format === tickFormatObj.real) {
            const [, digit] = format.match(ParallelProps.tickFormat.patternReal);
            return data.map((v) => v.toFixed(digit));
        }
        return data;
    }

    calcParcoordsLineColorBar(dimObjective) {
        const format = this.traceData.fmt[this.objective.id];
        const nTickMax = ParallelProps.colorBarSetting.nTickMax;
        const nTickMin = ParallelProps.colorBarSetting.nTickMin;
        const tickFormat = this.getTickFormat(format);
        const dataTickVals = dimObjective.tickvals;
        let uniqueColorData;
        let tickVals = null,
            tickText = null,
            nTicks = null;

        const calcColorBarFormatChar = () => {
            const tickValsOrg = [...dimObjective.tickvals];
            const tickTextOrg = [...dimObjective.ticktext];
            const valsIgnore = [COMMON_CONSTANT.NA, COMMON_CONSTANT.INF, COMMON_CONSTANT.MINF];
            const indexIgnore = tickTextOrg.reduce((r, v, i) => r.concat(valsIgnore.includes(v) ? i : []), []);
            let tickVals = tickValsOrg.filter((_, index) => !indexIgnore.includes(index));
            let tickText = tickTextOrg.filter((_, index) => !indexIgnore.includes(index));
            if (tickVals.length > nTickMax) {
                tickVals = getNValueInArray(tickVals, nTickMax);
                tickText = getNValueInArray(tickText, nTickMax);
            }
            return { tickVals, tickText, nTicks };
        };

        const calcColorBarFormatNumeric = (uniqueColorData) => {
            const lengthColorData = uniqueColorData.length;
            if (lengthColorData > nTickMax) {
                nTicks = nTickMax;
            } else {
                tickVals = this.formatTickVals(uniqueColorData, tickFormat);
            }
            return { tickVals, tickText, nTicks };
        };

        switch (tickFormat) {
            case ParallelProps.tickFormat.none:
                return calcColorBarFormatChar();
            case ParallelProps.tickFormat.integer:
                uniqueColorData = [...new Set(dataTickVals.map(Math.floor))];
                return calcColorBarFormatNumeric(uniqueColorData, tickFormat);
            case ParallelProps.tickFormat.real:
                uniqueColorData = [...new Set(dataTickVals)];
                return calcColorBarFormatNumeric(uniqueColorData, tickFormat);
            case ParallelProps.tickFormat.logarithm:
                uniqueColorData = [...new Set(dataTickVals)];
                return calcColorBarFormatNumeric(uniqueColorData, tickFormat);
            default:
            // Nothing
        }
    }

    // show parallel graph
    show(isReturnToDefaultOrderingParams) {
        // gen dimension data
        this.genData();
        this.genCorrValue();
        if (isReturnToDefaultOrderingParams) {
            this.genDefaultSetting();
        }
        // get chart layout
        const layout = this.genLayout();
        // gen icons setting
        const iconSettings = this.genPlotlyIconsSetting();
        Plotly.newPlot(this.plotDOMId, this.data, layout, iconSettings);
        $(`#${this.plotDOMId}`).show();
        this.bindEvents();
    }
}
