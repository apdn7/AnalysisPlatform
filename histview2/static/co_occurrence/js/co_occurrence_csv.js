/* eslint-disable prefer-const */
const REQUEST_TIMEOUT = setRequestTimeOut(60000); // 1 minutes
let settingFile = false;
const coOccElements = {
    apiCheckFileUrl: '/histview2/api/cog/check_file',
    apiShowGraphUrl: '/histview2/api/cog/show_graph',
    fileUrlInput: 'input[name="fileUrl"]',
    connectResourceBtn: '#connectResourceBtn',
    i18nFileExist: 'i18nFileExist',
    i18nFileNotExist: 'i18nFileNotExist',
    alertMsgCheckFile: '#alertMsgCheckFile',
    showGraphBtn: '#showGraphBtn',
    delimiter: 'input[type="radio"][name="fileType"]:checked',
    aggregateBy: 'input[type="radio"][name="aggregateBy"]:checked',
    threshold: 'input[name="threshold"]',
    layout: 'input[type="radio"][name="layout"]:checked',
    plotCard: $('#plotCard'),
    plotCOG: $('#plot-card'), // TODO name
    plotCOGId: 'plot-card',
    plotPareto: $('#plotCardPareto'),
    plotParetoId: 'plotCardPareto',
    tooltipSpan: $('#tooltip-span'),
    restoreZoom: $('#restoreZoom'),
};

const i18nCoOccCfg = {
    subFolderWrongFormat: $('#i18nSubFolderWrongFormat').text(),
    fileExist: $(`#${coOccElements.i18nFileExist}`).text(),
    fileNotExist: $(`#${coOccElements.i18nFileNotExist}`).text(),
};

const HttpStatusCode = {
    isOk: 200,
    serverErr: 500,
};

const loading = $('.loading');

let s = null;
const cam = null;

const showCoOccurrencePlot = (nodes, edges) => {
    const N = nodes.length;
    const E = edges.length;

    const g = {
        nodes: [],
        edges: [],
    };

    // Generate a random graph:
    for (let i = 0; i < N; i++) {
        const node = nodes[i];
        g.nodes.push({
            id: node.id,
            label: `${node.id}: ${node.size}`,
            x: node.x,
            y: node.y,
            size: node.size,
            color: node.color || '#a9a9a9',
        });
    }

    for (let i = 0; i < E; i++) {
        const edge = edges[i];
        if (`${edge.label}` === '0') continue;

        g.edges.push({
            id: edge.id,
            label: `${edge.label}`,
            source: edge.source,
            target: edge.target,
            size: edge.label,
            color: '#a9a9a9',
            hover_color: '#00aeff',
            type: 'line',
        });
    }

    // Instantiate sigma:
    s = new sigma({
        graph: g,
        renderer: {
            container: document.getElementById(coOccElements.plotCOGId),
            type: 'canvas',
        },
        settings: {
            edgeLabelSize: 'proportional',
            defaultLabelColor: '#fff',
            defaultEdgeLabelColor: '#fff',
            defaultLabelSize: 16,
            minEdgeSize: 0.05,
            maxEdgeSize: 5,
            minNodeSize: 5,
            maxNodeSize: 20,
            enableEdgeHovering: true,
            edgeHoverColor: 'edge',
            defaultEdgeHoverColor: '#00aeff',
            edgeHoverSizeRatio: 1,
            edgeHoverExtremities: true,
            borderSize: 2,
            outerBorderSize: 2,
            defaultNodeOuterBorderColor: '#fff',
            edgeHoverHighlightNodes: 'circle',
            sideMargin: 1,
            // scalingMode: 'outside', // TODO later
        },
    });

    s.bind('clickEdge', (e) => {
        const x = e.data.captor.clientX;
        const y = e.data.captor.clientY; // todo check null
        if (y && x) {
            coOccElements.tooltipSpan.text(e.data.edge.label);
            coOccElements.tooltipSpan.css('top', `${(y - 10)}px`);
            coOccElements.tooltipSpan.css('left', `${(x + 10)}px`);
            coOccElements.tooltipSpan.css('display', 'block');
        }
    });

    s.bind('outEdge', (e) => {
        coOccElements.tooltipSpan.css('display', 'none');
    });


    s.bind('nodeClick', (e) => {
        coOccElements.tooltipSpan.css('display', 'none');
    });

    if ($(coOccElements.layout).val() === 'FORCE_ATLAS_2') {
        s.startForceAtlas2({ worker: true, barnesHutOptimize: false });

        setTimeout(() => {
            s.stopForceAtlas2();
        }, 100);

        const config = {
            nodeMargin: 3.0,
            scaleNodes: 1.3,
            gravity: 1,
        };

        // Configure the algorithm
        const listener = s.configNoverlap(config);

        // Bind all events:
        listener.bind('start stop interpolate', (event) => {
            // console.log(event.type);  // TODO
        });

        // Start the algorithm:
        s.startNoverlap();
    }

    // Initialize the dragNodes plugin:
    const dragListener = sigma.plugins.dragNodes(s, s.renderers[0]);

    // dragListener.bind('startdrag', (event) => {
    //     console.log(event);
    // });
    // dragListener.bind('drag', (event) => {
    //     console.log(event);
    // });
    // dragListener.bind('drop', (event) => {
    //     console.log(event);
    // });
    // dragListener.bind('dragend', (event) => {
    //     console.log(event);
    // });


    $('html, body').animate({
        scrollTop: coOccElements.plotCard.offset().top,
    }, 200);


    coOccElements.restoreZoom.on('click', () => {
        s.cameras[0].goTo({
            x: 0, y: 0, angle: 0, ratio: 1,
        });
    });
};

// check to use upload setting file from browser
const useUploadFile = () => {
    if (settingFile.name) {
        return settingFile;
    }
    return null;
};

const showGraph = () => {
    loadingShow();

    // close sidebar
    beforeShowGraphCommon();

    coOccElements.plotCard.hide();
    coOccElements.plotCOG.html('');
    coOccElements.plotPareto.html('');

    // const fileUrl = $(coOccElements.fileUrlInput).val();
    // check uploaded file from browser
    const fileUpload = useUploadFile();
    const formDat = new FormData();
    formDat.append('url', '');
    formDat.append('delimiter', $(coOccElements.delimiter).val());
    formDat.append('aggregate_by', $(coOccElements.aggregateBy).val());
    formDat.append('threshold', $(coOccElements.threshold).val());
    formDat.append('layout', $(coOccElements.layout).val());
    formDat.append('file', fileUpload);
    $.ajax({
        url: coOccElements.apiShowGraphUrl,
        method: 'POST',
        data: formDat,
        // contentType: 'application/json',
        contentType: false,
        enctype: 'multipart/form-data',
        processData: false,
        timeout: REQUEST_TIMEOUT,
        success: (res) => {
            loadingShow(true);

            coOccElements.plotCard.show();
            coOccElements.plotCOG.show();

            const dicRes = JSON.parse(res);
            showCoOccurrencePlot(dicRes.nodes, dicRes.edges);
            loadingUpdate(75);
            showParetoPlot(dicRes.pareto);

            // move invalid filter
            // setColorAndSortHtmlEle(res.matched_filter_ids, res.unmatched_filter_ids, res.not_exact_match_filter_ids);
            // if (checkResultExist(res)) {
            //     saveInvalidFilterCaller(true);
            // } else {
            //     saveInvalidFilterCaller();
            // }

            // hide loading inside ajax
            setTimeout(loadingHide, loadingHideDelayTime(res.actual_record_number));

            // export mode
            handleZipExport(res);
        },
        error: (res) => {
            loadingHide();
            errorHandling(res);
            // export mode
            handleZipExport(res);
        },
    }).then(() => {
        loadingHide();
    });
};

const showParetoPlot = (paretoData) => {
    const prop = paretoData;
    prop.plotId = coOccElements.plotParetoId;
    paretoPlot(prop);
};

function bindUpdateThresholdValue() {
    const thresholdValue = $('#thresholdValue');
    const threshold = $('#threshold');
    thresholdValue.html(100);
    threshold.on('input change', () => {
        thresholdValue.text(threshold.val());
    });
}


$(() => {
    const dragAreaCls = '.co-occurrence-drag-area';
    const selectFileBtnId = '#selectFileBtn';
    const selectFileInputId = '#selectFileInput';
    genTriggerFileSetting(dragAreaCls, selectFileBtnId, selectFileInputId);

    loading.addClass('hide');

    $(coOccElements.showGraphBtn).on('click', () => {
        showGraph();
    });

    bindUpdateThresholdValue();

    // Load userBookmarkBar
    $('#userBookmarkBar').show();
});
