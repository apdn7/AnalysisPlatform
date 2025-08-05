class APPlot {
    colorScale = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22'];

    /**
     *  APDN7 Plot
     *  @param {string|HTMLElement} domEle - The DOM element (or selector) where the chart will be displayed.
     */
    constructor(domEle) {
        this.plotDOM = domEle;
    }

    /**
     *  generate data
     *  @abstract
     */
    get data() {
        throw new Error('Not implemented');
    }

    /**
     *  layout definition
     *  @abstract
     */
    get layout() {
        throw new Error('Not implemented');
    }

    /**
     *  default setting of plot
     *  @returns {Object}
     */
    get defaultSetting() {
        return {
            displayModeBar: false,
            responsive: true,
            useResizeHandler: true,
            style: { width: '100%', height: '100%' },
        };
    }

    /**
     *  draw Plotly chart
     */
    draw() {
        Plotly.newPlot(this.plotDOM, this.data, this.layout, this.defaultSetting);
    }
}
