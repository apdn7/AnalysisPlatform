/**
 * @typedef {Object} BarChartData
 * @property {number[]} [x] - X-axis values (horizontal bar lengths)
 * @property {string[]} [y] - Y-axis labels (category names)
 * @property {number[]} [text] - Values to display on bars
 * @property {string} [type] - Chart type (e.g., 'bar')
 * @property {string} [orientation] - Bar orientation (e.g., 'h' for horizontal)
 */

/**
 * @typedef {Object} PlotlyLayout
 * @property {Object} font - Font configuration
 * @property {number} font.size - Font size in pixels
 * @property {string} font.color - Font color (hex)
 * @property {string} plot_bgcolor - Plot area background color
 * @property {string} paper_bgcolor - Canvas background color
 * @property {Object} margin - Chart margins
 * @property {Object} xaxis - X-axis configuration
 * @property {Object} yaxis - Y-axis configuration
 */

/**
 * Bar chart component for displaying causal relationship data with Plotly.js
 * @extends APPlot
 */
class CausalRelationBarChart extends APPlot {
    /**
     * Creates a causal relation bar chart
     * @param {HTMLElement} plotDom - DOM element to render the chart into
     * @param {BarChartData} [dicBar={}] - Chart data configuration object
     */
    constructor(plotDom, dicBar = {}) {
        super(plotDom);

        /** @type {BarChartData} */
        this.dicBar = dicBar;

        /** @type {number[]|undefined} */
        this.x = dicBar.x;

        /** @type {string[]|undefined} */
        this.y = dicBar.y;

        /** @type {string[]|undefined} */
        this.tick_text = dicBar.tick_text;

        this.draw();
        this.onTickHover();
    }

    /**
     * Generates truncated tick labels for Y-axis
     * @returns {string[]|undefined} Array of wrapped text labels or undefined
     */
    tickText() {
        return this.tick_text?.map((label) => this.wraptext(label, 19));
    }

    /**
     * Truncates text to specified length with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum character length
     * @returns {string} Original or truncated text with '...'
     */
    wraptext(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength) + '...';
    }

    /**
     * Plotly layout configuration with dark theme
     * @returns {PlotlyLayout} Layout object for Plotly
     */
    get layout() {
        return {
            font: {
                size: 12,
                color: '#65c5f1',
            },
            plot_bgcolor: '#222222',
            paper_bgcolor: '#222222',
            margin: {
                t: 10,
                r: 0,
                b: 10,
                l: 10,
            },
            xaxis: {
                automargin: true,
                autorange: 'reversed',
                gridcolor: '#283442',
                linecolor: '#506784',
                zerolinecolor: '#283442',
                zerolinewidth: 2,
                ticks: '',
            },
            yaxis: {
                automargin: true,
                autorange: 'reversed',
                gridcolor: '#283442',
                linecolor: '#506784',
                ticks: '',
                zerolinecolor: '#283442',
                zerolinewidth: 2,
                tickvals: this.y || [],
                ticktext: this.tick_text,
            },
        };
    }

    /**
     * Plotly data configuration with formatted values and hover templates
     * @returns {Object[]} Array containing chart data trace
     */
    get data() {
        return [
            {
                ...this.dicBar,
                text: this.dicBar.text.map((text) => applySignificantDigit(text)),
                customdata: this.dicBar.tick_text,
                hovertemplate: '%{customdata}<br>' + '%{text}<br><extra></extra>',
                insidetextfont: {
                    color: '#65c5f1',
                },
                insidetextanchor: 'start',
            },
        ];
    }

    onTickHover() {
        attachTickHovers(this.plotDOM);
    }
}
