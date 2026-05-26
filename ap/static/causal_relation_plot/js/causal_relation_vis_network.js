/**
 * @typedef {Object} NetworkData
 * @property {Array<string|number>} nodes - Array of node IDs
 * @property {Array<Array<string|number>>} edges - Array of edge tuples [from, to, weight, color]
 * @property {number[]} node_positions_x - X coordinates for each node
 * @property {number[]} node_positions_y - Y coordinates for each node
 * @property {string[]} node_labels - Labels in format "Process | Sensor"
 */

/**
 * @typedef {Object} EdgeData
 * @property {string|number} from - Source node ID
 * @property {string|number} to - Target node ID
 * @property {string} arrows - Arrow direction ('to', 'from', 'to;from')
 * @property {number} width - Edge line width
 * @property {string} color - Edge color (hex or rgba)
 */

/**
 * @typedef {Object} NodeData
 * @property {string|number} id - Unique node identifier
 * @property {number} x - X coordinate position
 * @property {number} y - Y coordinate position
 * @property {string} label - Displayed label text
 * @property {string} full_label - Complete label with process and sensor info
 */

/**
 * @typedef {'all'|'process'|'sensor'|'none'} ShowLabelType
 */

/**
 * Network visualization component for causal relationships using vis.js
 */
class CausalNetWork {
    /**
     * Label display mode constants
     * @type {{ALL: 'all', PROCESS: 'process', SENSOR: 'sensor', NONE: 'none'}}
     * @static
     */
    static showLabelType = {
        ALL: 'all',
        PROCESS: 'process',
        SENSOR: 'sensor',
        NONE: 'none',
    };

    /**
     * Shared vis.DataSet containing all nodes
     * @type {vis.DataSet|null}
     * @static
     */
    static nodes = null;

    /**
     * Shared vis.DataSet containing all edges
     * @type {vis.DataSet|null}
     * @static
     */
    static edges = null;

    /**
     * Array of node IDs for label updates
     * @type {Array<string|number>}
     * @static
     */
    static nodeIds;

    /**
     * Creates and renders a causal network visualization
     * @param {string} plotDom - DOM element ID for the network container
     * @param {NetworkData} [dicNet={}] - Network data configuration
     */
    constructor(plotDom, dicNet = {}) {
        /** @type {string} */
        this.plotDom = plotDom;

        /** @type {EdgeData[]} */
        this.edges = this.getEdges(dicNet.edges);

        /** @type {NodeData[]} */
        this.nodes = this.getNodes(dicNet);

        CausalNetWork.nodeIds = dicNet.nodes;
        this.draw();
    }

    /**
     * Transforms raw edge data into vis.js edge format
     * @param {Array<Array<string|number>>} edges - Array of [from, to, weight, color] tuples
     * @returns {EdgeData[]} Formatted edge objects for vis.js
     */
    getEdges(edges) {
        return edges.map((edge) => {
            return {
                from: edge[0],
                to: edge[1],
                arrows: 'to',
                width: edge[2] * 5,
                color: edge[3],
            };
        });
    }

    /**
     * Transforms raw node data into vis.js node format
     * @param {NetworkData} dicNet - Network configuration object
     * @returns {NodeData[]} Formatted node objects for vis.js
     */
    getNodes(dicNet) {
        const showType = CausalNetWork.getShowLabelType();
        return dicNet.nodes.map((node, i) => {
            return {
                id: node,
                x: dicNet.node_positions_x[i],
                y: dicNet.node_positions_y[i],
                label: CausalNetWork.getNodeLabelByShowType(showType, dicNet.node_labels[i]),
                full_label: dicNet.node_labels[i],
            };
        });
    }

    /**
     * Determines label display mode from checkbox states
     * @returns {ShowLabelType} Current label display type
     * @static
     */
    static getShowLabelType() {
        const showProcessName = $('#showProcessNameLabels').is(':checked');
        const showSensorName = $('#showSensorNameLabels').is(':checked');
        if (showProcessName && showSensorName) {
            return CausalNetWork.showLabelType.ALL;
        }

        if (showProcessName) {
            return CausalNetWork.showLabelType.PROCESS;
        }

        if (showSensorName) {
            return CausalNetWork.showLabelType.SENSOR;
        }

        return CausalNetWork.showLabelType.NONE;
    }

    /**
     * Extracts appropriate label portion based on display mode
     * @param {ShowLabelType} showType - Label display mode
     * @param {string} nodeLabels - Full label in "Process | Sensor" format
     * @returns {string} Extracted label text or empty string
     * @static
     */
    static getNodeLabelByShowType(showType, nodeLabels) {
        switch (showType) {
            case CausalNetWork.showLabelType.ALL:
                return nodeLabels;
            case CausalNetWork.showLabelType.PROCESS:
                return nodeLabels.split(' | ')[0];
            case CausalNetWork.showLabelType.SENSOR:
                return nodeLabels.split(' | ')[1];
            case CausalNetWork.showLabelType.NONE:
                return '';
        }
    }

    /**
     * Updates all node labels based on current checkbox states
     * @static
     */
    static updateNodeLabels() {
        const showType = CausalNetWork.getShowLabelType();
        const nodes = [];
        for (const nodeId of CausalNetWork.nodeIds) {
            const node = CausalNetWork.nodes.get(nodeId);
            node.label = CausalNetWork.getNodeLabelByShowType(showType, node.full_label);
            nodes.push(node);
        }

        this.nodes.update(nodes);
    }

    /**
     * Renders the network visualization using vis.js
     * @returns {void}
     */
    draw() {
        const edges = new vis.DataSet(this.edges);
        const nodes = new vis.DataSet(this.nodes);
        CausalNetWork.nodes = nodes;
        CausalNetWork.edges = edges;

        // create a network
        const container = document.getElementById(this.plotDom);
        var data = {
            nodes: nodes,
            edges: edges,
        };
        var options = {
            nodes: {
                shape: 'dot',
                size: 15,
                labelHighlightBold: true,
                color: {
                    border: COLOR.nodeBorder,
                    background: COLOR.node,
                    highlight: {
                        border: COLOR.nodeHighlight,
                        background: COLOR.nodeHighlight,
                    },
                    hover: {
                        border: COLOR.nodeHighlight,
                        background: COLOR.nodeHighlight,
                    },
                },
                font: {
                    color: COLOR.font,
                    bold: {},
                },
                borderWidth: 2,
                shadow: true,
            },
            layout: {
                randomSeed: 1,
            },
            physics: {
                enabled: false,
            },
        };
        new vis.Network(container, data, options);
    }
}

const COLOR = {
    node: 'rgba(137, 179, 104, 1)',
    nodeBorder: '#658f44',
    nodeHighlight: '#32afd7',
    font: '#ebebeb',
    edge: '#658f44',
    edgeHighlight: '#32afd7',
    prediction: '#375a7f',
    real: 'seagreen',
    realStartProc: '#ffffff',
    background: 'rgba(0, 0, 0, 0)',
};
