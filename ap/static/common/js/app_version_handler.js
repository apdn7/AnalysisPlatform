/**
 * @file Contain all common functions to serve checking application's version.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

/**
 * Get value by key name in Cookie
 * @param name - a key name in cookie
 * @return {string} - value
 */
window.getCookie = function getCookie(name) {
    const match = document.cookie.match(
        new RegExp('(^| )' + name + '=([^;]+)'),
    );
    if (match) return match[2];
};

/**
 * Get latest release of DN7 application
 * @return {Promise<{
 *   "url": string,
 *   "assets_url": string,
 *   "upload_url": string,
 *   "html_url": string,
 *   "id": number,
 *   "author": {},
 *   "node_id": string,
 *   "tag_name": string,
 *   "target_commitish": string,
 *   "name": string,
 *   "draft": boolean,
 *   "prerelease": boolean,
 *   "created_at": string,
 *   "published_at": string,
 *   "assets": [],
 *   "tarball_url": string,
 *   "zipball_url": string,
 *   "body": string,
 * }>}
 */
function getLatestRelease() {
    const apiUrl =
        'https://api.github.com/repos/apdn7/AnalysisPlatform/releases/latest';
    return fetch(apiUrl, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    }).then((response) => response.json());
}

/**
 * Get current version of DN7
 * @return {{
 *     sprintNumber: string,
 *     appVersion: string,
 *     version: string,
 *     commitHash: string,
 * }} - version of DN7
 */
function getCurrentVersionInfo() {
    const [appVersion, version, sprintNumber, commitHash] =
        /^(v.*)\.(\d+)\.([A-Za-z0-9]+)/g.exec(getCookie('app_version'));
    return {
        appVersion,
        version,
        sprintNumber,
        commitHash,
    };
}

/**
 * Check current version of application is in update or not
 * @return {Promise<boolean>} true: in update, otherwise.
 */
async function isCurrentVersionInUpdate() {
    const releaseInfo = getLatestRelease();
    const currentVersionInfo = getCurrentVersionInfo();
    const latestVersion = (await releaseInfo).tag_name;
    console.info(`The latest version in Github is ${latestVersion}`);
    return currentVersionInfo.version === latestVersion;
}

/**
 * blink icon and change name of option in 1 minutes, then revert to normal stage automatically.
 */
function announceNewVersion() {
    const announceUpdateTime = parseInt(getCookie('announce_update_time'));
    const tourButtonElement = document.getElementById('tour-btn');
    const autolinkElement = document.getElementById('githubLink');
    const previousQuestionIconHTML = tourButtonElement.innerHTML;
    const previousAutolinkContentHTML = autolinkElement.innerHTML;

    tourButtonElement.innerHTML =
        '<i class="fa fa-info-circle blink_btn" aria-hidden="true"></i>';
    autolinkElement.innerHTML =
        '<i class="fa-brands fa-github"></i> ' +
        document.getElementById('i18nDownloadNewVersion').textContent.trim() +
        ' <i class="fa fa-external-link-alt"></i>';

    // revert icon and option to normal stage after 60 seconds
    setTimeout(() => {
        tourButtonElement.innerHTML = previousQuestionIconHTML;
        autolinkElement.innerHTML = previousAutolinkContentHTML;
    }, announceUpdateTime * 1000);
}

/**
 * Check latest version and announce by blink icon and change name of option
 *
 * Note: If time from startup to now is exceeded, it will do nothing although there is a newer version on GitHub.
 * @return {Promise<void>}
 */
async function checkNewVersion() {
    const appStartupTime = moment.utc(getCookie('app_startup_time')).local();
    const limitCheckingNewerVersionTime = parseInt(
        getCookie('limit_checking_newer_version_time'),
    );
    const now = moment();

    // calculate the time from startup to now is many seconds through
    const passingTime = (now - appStartupTime) / 1000;
    if (passingTime < limitCheckingNewerVersionTime) {
        // in case of out update
        if (await isCurrentVersionInUpdate()) {
            console.info('Application is IN UPDATE');
            return; // current app is in update, do nothing
        }

        // in case of out update
        console.info('Application is OUT UPDATE');
        announceNewVersion();
    } else {
        // in case passingTime is over than announceUpdateTime, it is no longer valid to check version
        //  or announce new version
    }
}

(() => {
    // Wait for document ready to check new version
    setTimeout(() => checkNewVersion().catch((e) => console.warn(e)), 200);
})();
