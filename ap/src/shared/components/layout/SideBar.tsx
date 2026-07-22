import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import logo from '@/shared/assets/images/logo.png';

export default function Sidebar() {
    const { t } = useTranslation();
    // app version
    const [version, setVersion] = useState('');

    // app Location
    const [appLocation, setAppLocation] = useState('');
    useEffect(() => {
        setUpEvents();
        sidebarCollapseHandle();
        showHideShutDownButton();
        // collapse sidebar when loading page
        sidebarCollapse();
        setVersion(appContext.app_version);
        setAppLocation(appContext.app_source);
    }, []);
    return (
        <nav id="sidebar">
            <div className="sidebar-header">
                <button
                    type="button"
                    id="sidebarCollapse"
                    className="btn navbar-btn hotkey-button"
                    data-hotkey="Ctrl + /"
                >
                    <i className="fas fa-bars "></i>
                </button>
                <a href="/" className="navbar-left">
                    <img src={logo} style={{ width: '150px' }} data-type="image/x-icon" />
                </a>
            </div>

            <div className="sidebar-search">
                <span className="deleteicon">
                    <input id="sidebar-searchbox" className="form-control" placeholder={t('Search') + '...'} />
                    <span className="remove-search">x</span>
                </span>
            </div>

            <ul id="sidebarBody" className="list-unstyled components sidebar-body">
                <li className="menu-group-item visual-page">
                    <a
                        href="#traceDataSubmenu"
                        data-toggle="collapse"
                        aria-expanded="false"
                        className="side-dropdown-toggle dropdown-toggle collapsed"
                        data-tog="anlSm"
                    >
                        <i className="fas fa-chart-bar"></i>
                        <span className="nav-text">{t('Data Visualization')}</span>
                    </a>
                    <ul className="list-unstyled collapse" id="traceDataSubmenu">
                        <li data-search="FPP Full-points Plot 'Full-points Plot'">
                            <a
                                href="/ap/fpp"
                                className="go-to-page"
                                title="'Plot all data points with time axis or ID axis.'"
                            >
                                <span className="page-character">FPP</span>
                                <span className="nav-text hint-text">{t('Full-points Plot')}</span>
                            </a>
                        </li>
                        <li data-search="StP Stratified Plot 'Stratified Plot'">
                            <a
                                href="/ap/stp"
                                className="go-to-page"
                                title="'Compare data distribution with histograms and estimated density lines. Split the graph with  stratified variables.'"
                            >
                                <span className="page-character">StP</span>
                                <span className="nav-text hint-text">{t('Stratified Plot')}</span>
                            </a>
                        </li>
                        <li data-search="RLP Ridgeline Plot 'Ridgeline Plot'">
                            <a href="/ap/rlp" title="'RidgeLine Plot Hover'" className="go-to-page">
                                <span className="page-character">RLP</span>
                                <span className="nav-text hint-text">{t('Ridgeline Plot')}</span>
                            </a>
                        </li>
                        <li data-search="CHM Calendar Heat Map 'Calendar Heat Map'">
                            <a
                                href="/ap/chm"
                                className="go-to-page"
                                title="'Visualize long-term data such as annual variations in processes and parameters that can vary depending on days of the week or shifts, etc.'"
                            >
                                <span className="page-character">CHM</span>
                                <span className="nav-text hint-text">{t('Calendar Heat Map')}</span>
                            </a>
                        </li>
                        <li data-search="AgP Aggregation Plot 'Aggregation Plot'">
                            <a href="/ap/agp" className="go-to-page" title="'Aggregation Plot info'">
                                <span className="page-character">AgP</span>
                                <span className="nav-text hint-text">{t('Aggregation Plot')}</span>
                            </a>
                        </li>
                        <li data-search="MSP Multi Scatter Plot 'Multi Scatter Plot'">
                            <a
                                href="/ap/msp"
                                className="go-to-page"
                                title="'Displays a scatter chart matrix. You can create a matrix between up to four target variables.'"
                            >
                                <span className="page-character">MSP</span>
                                <span className="nav-text hint-text">{t('Multi Scatter Plot')}</span>
                            </a>
                        </li>
                        <li data-search="ScP Scatter Plot 'Scatter Plot'">
                            <a href="/ap/scp" className="go-to-page" title="'SCP Page title description'">
                                <span className="page-character">ScP</span>
                                <span className="nav-text hint-text">{t('Scatter Plot')}</span>
                            </a>
                        </li>
                        <li data-search="HMp Heatmap Plot 'Heatmap Plot Page Title'">
                            <a href="/ap/hmp" className="go-to-page" title="'Heatmap Page title description'">
                                <span className="page-character">HMp</span>
                                <span className="nav-text hint-text">{t('Heatmap Plot Page Title')}</span>
                            </a>
                        </li>
                        <li data-search="WfP waveform plot 'Waveform plot'">
                            <a href="/ap/wfp" className="go-to-page" title="'Waveform Plot Description'">
                                <span className="page-character">WfP</span>
                                <span className="nav-text hint-text">{t('Waveform plot')}</span>
                            </a>
                        </li>
                        <li data-search="PCP Parallel Coordinates Plot 'Parallel Coordinates Plot'">
                            <a
                                href="/ap/pcp"
                                className="go-to-page"
                                title="'Visualize the correlation between a large number of variables with respect to target variable.'"
                            >
                                <span className="page-character">PCP</span>
                                <span className="nav-text hint-text">{t('Parallel Coordinates Plot')}</span>
                            </a>
                        </li>
                        <li data-search="SkD Sankey Diagram 'Sankey Diagram'">
                            <a
                                href="/ap/skd"
                                className="go-to-page"
                                title="'Identify and visualize directly/indirectly correlated variables of objective(s)'"
                            >
                                <span className="page-character">SkD</span>
                                <span className="nav-text hint-text">{t('Sankey Diagram')}</span>
                            </a>
                        </li>
                        <li data-search="COG Co-occurrence Graph 'Co-occurrence Graph'">
                            <a
                                href="/ap/cog"
                                className="go-to-page"
                                title="'Visualize co-occurrence (relationships that focus on how often one phenomenon and another occur at the same time) of faults/alarms.'"
                            >
                                <span className="page-character">COG</span>
                                <span className="nav-text hint-text">{t('Co-occurrence Graph')}</span>
                            </a>
                        </li>
                    </ul>
                </li>
                <li className="menu-group-item visual-page">
                    <a
                        href="#analyzeSubmenu"
                        data-toggle="collapse"
                        aria-expanded="false"
                        className="side-dropdown-toggle dropdown-toggle collapsed"
                        data-tog="anlSm"
                    >
                        <i className="fas fa-brain"></i>
                        <span className="nav-text">{t('Analyze')}</span>
                    </a>
                    <ul className="list-unstyled collapse" id="analyzeSubmenu">
                        <li>
                            <a
                                href="#anomalyDetectionMn"
                                data-toggle="collapse"
                                aria-expanded="false"
                                className="side-dropdown-toggle dropdown-toggle collapsed"
                                data-tog="anlSm"
                            >
                                <span className="nav-text">{t('Anomaly Detection')}</span>
                            </a>
                            <ul className="list-unstyled collapse" id="anomalyDetectionMn">
                                <li data-search="PCA Principal Component Analysis 'Principal Component Analysis'">
                                    <a
                                        href="/ap/analyze/anomaly_detection/pca"
                                        className="go-to-page"
                                        title="'This function visualizes “unusual” and analyzes its factors by Principal Component Analysis.'"
                                    >
                                        <span className="page-character">PCA</span>
                                        <span className="nav-text hint-text">{t('Principal Component Analysis')}</span>
                                    </a>
                                </li>
                            </ul>
                        </li>
                        <li>
                            <a
                                href="#structureLearningMn"
                                data-toggle="collapse"
                                aria-expanded="false"
                                className="side-dropdown-toggle dropdown-toggle collapsed"
                                data-tog="anlSm"
                            >
                                <span className="nav-text">{t('Structure Learning')}</span>
                            </a>
                            <ul className="list-unstyled collapse" id="structureLearningMn">
                                <li data-search="GL Graphical Lasso 'Graphical Lasso'">
                                    <a
                                        href="/ap/analyze/structure_learning/gl"
                                        className="go-to-page"
                                        title="'GL Page Title'"
                                    >
                                        <span className="page-character">GL</span>
                                        <span className="nav-text hint-text">{t('Graphical Lasso')}</span>
                                    </a>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li id="settingPageMenu" className="menu-group-item">
                    <a
                        href="#pageSubmenu"
                        data-toggle="collapse"
                        aria-expanded="true"
                        className="side-dropdown-toggle dropdown-toggle"
                        data-tog="cfgSm"
                    >
                        <i className="fas fa-cog"></i>
                        <span className="nav-text">{t('Config')}</span>
                    </a>
                    <ul className="list-unstyled collapse show" id="pageSubmenu">
                        <li data-search="Data Source Config 'Data Source Config'">
                            <a href="/ap/config#data_source" className="go-to-page">
                                <span className="nav-text">{t('Data Source Config')}</span>
                            </a>
                        </li>
                        <li data-search="Process Config 'Process Config'">
                            <a href="/ap/config#process" className="go-to-page">
                                <span className="nav-text">{t('Process Config')}</span>
                            </a>
                        </li>
                        <li data-search="Data Link Config 'Data Link Config'">
                            <a href="/ap/config#data_link" className="go-to-page">
                                <span className="nav-text">{t('Data Link Config')}</span>
                            </a>
                        </li>
                        <li data-search="Data Export Config 'SidebarTitleDataExport'">
                            <a href="/ap/config/export_config" className="go-to-page">
                                <span className="nav-text">{t('SidebarTitleDataExport')}</span>
                            </a>
                        </li>
                        <li data-search="Filter Config 'Filter Config'">
                            <a href="/ap/config/filter" className="go-to-page">
                                <span className="nav-text">{t('Filter Config')}</span>
                            </a>
                        </li>
                        <li data-search="Display Config 'Threshold/Graph Config'">
                            <a href="/ap/config/master" title="'Master Config Hover'" className="go-to-page">
                                <span className="nav-text hint-text">{t('Threshold/Graph Config')}</span>
                            </a>
                        </li>
                        <li data-search="Job list 'Job list'">
                            <a href="/ap/config/job" className="go-to-page">
                                <span className="nav-text">{t('Job list')}</span>
                            </a>
                        </li>
                    </ul>
                </li>
                <li className="menu-group-item go-to-page" data-search="Table Viewer 'Table Viewer'">
                    <a className="nav-link" href="/ap/table_viewer">
                        <i className="fas fa-table"></i>
                        <span className="nav-text">{t('Table Viewer')}</span>
                    </a>
                </li>
                <li className="menu-group-item go-to-page" data-search="About">
                    <a className="nav-link go-to-page" href="/ap/about">
                        <i className="fas fa-info-circle"></i>
                        <span className="nav-text">About</span>
                    </a>
                </li>
                <li>
                    <br />
                </li>
                <li>
                    <br />
                </li>
                <li>
                    <br />
                </li>
            </ul>

            <div className="position-absolute p-0 m-0 w-100" style={{ bottom: 0 }}>
                <div className="sidebar-marquee" style={{ visibility: 'collapse' }}>
                    <div className="marquee">
                        <div className="marquee-content">
                            <span>
                                <p id="marquee-msg-edgeserver"></p>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="sidebar-shutdown" id="shutdownApp">
                    <span className="sidebar-btm">
                        <i className="fas fa-power-off"></i>
                    </span>
                </div>
                <div className="sidebar-footer">
                    <span id="appVersion" className="sidebar-btm">
                        {version}
                    </span>
                </div>
                <div className="sidebar-footer">
                    <span id="appLocation" className="sidebar-btm">
                        {appLocation}
                    </span>
                </div>
            </div>
            <div>
                <table
                    id="contextMenuSidebar"
                    className="context-menu"
                    style={{ display: 'none' }}
                    data-name="contextMenuSidebar"
                >
                    <tbody>
                        <tr>
                            <td>{t('New tab')}</td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, false, true);
                                }}
                            >
                                {t('New')}
                            </td>
                        </tr>
                        <tr className="takeover-item">
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, false, false, '', true);
                                }}
                            >
                                {t('Takeover')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, false, false, 'dn7');
                                }}
                            >
                                {t('DN7')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, false, false, 'analysis_platform');
                                }}
                            >
                                {t('AP')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, false, false, 'usage');
                                }}
                            >
                                Usage
                            </td>
                        </tr>
                        <tr>
                            <td>{t('Open')}</td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, true, true);
                                }}
                            >
                                {t('New')}
                            </td>
                        </tr>
                        <tr className="takeover-item">
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, true, false, '', true);
                                }}
                            >
                                {t('Takeover')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, true, false, 'dn7');
                                }}
                            >
                                {t('DN7')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, true, false, 'analysis_platform');
                                }}
                            >
                                {t('AP')}
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td
                                className="link-item"
                                onClick={() => {
                                    goToOtherPage(null, true, false, 'usage');
                                }}
                            >
                                {t('Usage')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </nav>
    );
}
