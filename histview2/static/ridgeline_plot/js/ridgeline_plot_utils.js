
// generate HTML for tabs
const generateTabHTML = (endProcName, sensors, showViewer = false) => {
    const genNavItemHTML = (tabId, sensorMasterName, status = '') => `<li class="nav-item ${status}">
            <a href="#${tabId}" class="nav-link ${status} tab-name" role="tab" data-toggle="tab" data-original-title="${sensorMasterName}"
                >${sensorMasterName}</a>
        </li>`;

    const genTabContentHTML = (tabId, plotCardId, status = '') => `<div class="tab-pane fade show ${status}" id="${tabId}">
        <div class="card cate-plot-cards clearfix" id="${plotCardId}"></div>
    </div>`;

    const navItemHTMLs = [];
    const tabContentHTMLs = [];
    for (let sensorIdx = 0; sensorIdx < sensors.length; sensorIdx++) {
        const sensorName = sensors[sensorIdx];
        const sensorMasterName = getNode(valueInfo, [endProcName, 'value_master', sensorName], sensorName) || sensorName;
        let status = '';
        if (sensorIdx === 0) {
            status = 'active';
        }
        const tabId = `histogramsTab-${sensorIdx}`;
        const navItemHTML = genNavItemHTML(tabId, sensorMasterName, status);
        navItemHTMLs.push(navItemHTML);
        const plotCardId = `varCatePlotCards-${sensorIdx}`;
        const tabContentHTML = genTabContentHTML(tabId, plotCardId, status);
        tabContentHTMLs.push(tabContentHTML);
    }

    let viewerNavHTML = '';
    let viewerContentHTML = '';
    if (showViewer) {
        viewerNavHTML = genNavItemHTML(tabId = 'scattersTab', sensorMasterName = i18n.viewerTabName);
        viewerContentHTML = genTabContentHTML(tabId = 'scattersTab', plotCardId = 'varScatterPlotCards');
    }

    const stratifiedVarTabHTML = `<ul id="tabs" class="nav nav-tabs justify-content-end" role="tablist">
        ${navItemHTMLs.join(' ')}
        ${viewerNavHTML}
    </ul>
    <div id="tabContent" class="tab-content clearfix">
        ${tabContentHTMLs.join(' ')}
        ${viewerContentHTML}
    </div>`;

    return stratifiedVarTabHTML;
};

const showResultTabHTMLs = (endProcName, sensors, showViewer = false) => {
    const tabHTMLs = generateTabHTML(endProcName, sensors, showViewer);
    $(eles.stratifiedVarTabs).html();
    $(eles.stratifiedVarTabs).html(tabHTMLs);

    // show tooltip
    $('[data-toggle="tab"]').tooltip({
        trigger: 'hover',
        placement: 'top',
        animate: true,
        delay: 100,
        container: 'body',
    });
};

const shouldCreateNewSSESource = (formData) => {
    if (is_sse_listening) {
        return false;
    }

    const autoUpdateInterval = formData.get('autoUpdateInterval');
    if (autoUpdateInterval) {
        is_sse_listening = true;
        return true;
    }
    return false;
};

const autoUpdate = (formData) => {
    if (shouldCreateNewSSESource(formData)) {
        const source = openServerSentEvent();
        source.addEventListener(serverSentEventType.procLink, (event) => {
            $(`${eles.mainFormId} button.show-graph`).click();
        }, false);
    }
};
