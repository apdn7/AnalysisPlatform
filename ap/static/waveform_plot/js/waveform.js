class WaveformPlot extends APPlot {
    constructor(
        plotDOM,
        {
            trace_groups = [],
            x_title = undefined,
            y_title = undefined,
            color_name = '',
            div_name = '',
            yMax = undefined,
            yMin = undefined,
            xFmt = '',
            yFmt = '',
            judgeColor = undefined,
        } = {},
    ) {
        super(plotDOM);
        this._trace_groups = trace_groups;
        this._xtitle = x_title;
        this._ytitle = y_title;
        this._color_name = color_name;
        this._div_name = div_name;
        this._yMax = yMax;
        this._yMin = yMin;
        this._xFmt = xFmt;
        this._yFmt = yFmt;
        this._judgeColor = judgeColor;
    }
    /**
     * get traces from a grouped color
     * if data was encoded by base64, (with plotly.js version >=3.0.1)
     * x, y should be {...line.array_x, ...line.array_y}
     * line.x = {dtype: 'f8', bdata: base64string }
     * @returns {Array}
     */
    traces(groupData, groupName, color = undefined) {
        let hoverTemplate = '';
        hoverTemplate += this._color_name ? `${this._color_name}: ${groupName}<br>` : '';
        const traceTemplate = {
            name: groupName,
            legendgroup: groupName,
            marker: {
                color: this._judgeColor ? JUDGE_COLOR_DEFAULT[this._judgeColor[groupName]] : color,
            },
            type: 'scatter',
            mode: 'lines',
            orientation: 'v',
            xaxis: `x`,
            yaxis: `y`,
        };
        return groupData.map((line, lid) => {
            return {
                x: line.array_x,
                y: line.array_y,
                div: line.div,
                showlegend: !lid && !!this._color_name,
                hoverinfo: 'none',
                ...traceTemplate,
            };
        });
    }
    /**
     * Get data combined from traces and their settings to draw the chart.
     * @returns {Array}
     */
    get data() {
        return Object.keys(this._trace_groups.color)
            .map((colorGroup, idx) => {
                return this.traces(this._trace_groups.color[colorGroup], colorGroup, this.colorScale[idx]);
            })
            .flat();
    }

    /**
     * WaveformPlot layout definition
     * @returns {Object}
     */
    get layout() {
        const layout = {
            plot_bgcolor: '#222222',
            paper_bgcolor: '#222222',
            hovermode: 'closest',
            margin: {
                l: 50,
                r: 80,
                b: 50,
                t: 5,
            },
            xaxis: {
                title: {
                    text: this._xtitle || '',
                    font: {
                        size: 12,
                        color: 'rgb(0,194,255)',
                    },
                },
                overlaying: 'x',
                tickformat: this._xFmt && this._xFmt.includes('e') ? '.1e' : '',
                gridcolor: '#444444',
                showgrid: true,
                showticklabels: true,
                spikemode: 'across',
                spikethickness: 1,
                spikedash: 'solid',
                tickfont: {
                    size: 8,
                    color: 'rgba(255,255,255,1)',
                },
            },
            yaxis: {
                title: {
                    text: this._ytitle || '',
                    font: {
                        size: 12,
                        color: 'rgb(0,194,255)',
                    },
                },
                tickformat: this._yFmt && this._yFmt.includes('e') ? '.1e' : '',
                overlaying: 'y',
                gridcolor: '#444444',
                showgrid: true,
                showticklabels: true,
                spikemode: 'across',
                spikethickness: 1,
                spikedash: 'solid',
                tickfont: {
                    size: 8,
                    color: 'rgba(255,255,255,1)',
                },
            },
            legend: {
                title: {
                    text: this._color_name,
                },
                font: {
                    size: 12,
                    color: '#ffffff',
                },
                bgcolor: 'transparent',
            },
        };

        if (this._yMax && this._yMin) {
            layout.yaxis.range = [this._yMin, this._yMax];
            layout.yaxis.autorange = false;
        }
        return layout;
    }

    onHover() {
        const waveformPLot = document.getElementById(this.plotDOM);
        waveformPLot.on('plotly_hover', (data) => {
            const dataPoint = data.points && data.points[0];
            const position = { x: data.event.pageX - 120, y: data.event.pageY };
            const { x, y } = dataPoint;
            const hoverInfo = [
                [this._div_name, dataPoint.data.div],
                [this._xtitle, applySignificantDigit(x)],
                [this._ytitle, applySignificantDigit(y)],
            ];
            genDataPointHoverTable(genHoverDataTable(hoverInfo), position, 120, true);
        });
        unHoverHandler(waveformPLot);
    }
}
