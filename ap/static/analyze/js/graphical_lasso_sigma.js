const drawGraphicalLassoSigma = (canvasId, data) => {
    const sigmaLayout = {
        graph: data,
        renderer: {
            container: canvasId,
            type: 'canvas',
        },
        settings: {
            defaultNodeColor: '#ec5148',
            defaultLabelColor: '#fff',
            defaultEdgeLabelColor: '#fff',
            defaultLabelSize: 16,
            minEdgeSize: 1,
            maxEdgeSize: 10,
            minNodeSize: 10,
            borderSize: 2,
            outerBorderSize: 2,
            defaultNodeOuterBorderColor: '#fff',
            enableEdgeHovering: true,
            edgeHoverColor: 'edge',
            edgeHoverSizeRatio: 1,
            edgeHoverExtremities: true,
            edgeHoverHighlightNodes: 'circle',
            sideMargin: 1,
        },
    };

    const s = new sigma(sigmaLayout);
    const dragListener = sigma.plugins.dragNodes(s, s.renderers[0]);
    dragListener.bind('dragend', function (event) {
        if (nodePositionData) {
            nodePositionData[event.data.node.id] = {
                x: event.data.node.x,
                y: event.data.node.y,
            };
        }
    });
};
