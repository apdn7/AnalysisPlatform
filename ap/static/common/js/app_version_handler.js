/**
 * @file Contain all common functions to serve checking application's version.
 * @author Pham Minh Hoang <hoangpm6@fpt.com>
 */

const ANNOUNCE_UPDATE_TIME = 60;
const LIMIT_CHECKING_NEWER_VERSION_TIME = 60;

/**
 * Get value by key name in Cookie
 * @param name - a key name in cookie
 * @return {string} - value
 */
window.getCookie = function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + keyPort(name) + '=([^;]+)'));
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
 * } | undefined>}
 */
function getLatestRelease() {
    const onRejected = (error) => {
        console.debug(error);
        return undefined;
    };
    const apiUrl = 'https://api.github.com/repos/apdn7/AnalysisPlatform/releases/latest';
    return fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    })
        .then((response) => {
            if (!response.ok) {
                return onRejected(`Response status: ${response.status}`);
            }
            return response.json();
        })
        .catch(onRejected);
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
    const [appVersion, version, sprintNumber, commitHash] = /^(v.*)\.(\d+)\.([A-Za-z0-9]+)/g.exec(
        appContext.app_version,
    );
    return {
        appVersion,
        version,
        sprintNumber,
        commitHash,
    };
}

/**
 * Check current version of application is in update or not
 * @return {Promise<boolean | undefined>} true: in update, otherwise.
 */
async function isCurrentVersionInUpdate() {
    const promiseReleaseInfo = getLatestRelease();
    const currentVersionInfo = getCurrentVersionInfo();
    const releaseInfo = await promiseReleaseInfo;
    if (releaseInfo === undefined) {
        console.debug('Cannot check latest version in Github.');
        return undefined;
    }

    const latestVersion = releaseInfo.tag_name;
    console.info(`The latest version in Github is ${latestVersion}`);
    return currentVersionInfo.version === latestVersion;
}

/**
 * blink icon and change name of option in 1 minutes, then revert to normal stage automatically.
 */
function announceNewVersion() {
    const tourButtonElement = document.getElementById('tour-btn');
    const autolinkElement = document.getElementById('githubLink');
    const previousQuestionIconHTML = tourButtonElement.innerHTML;
    const previousAutolinkContentHTML = autolinkElement.innerHTML;

    tourButtonElement.innerHTML = '<i class="fa fa-info-circle blink_btn" aria-hidden="true"></i>';
    autolinkElement.innerHTML =
        '<i class="fa-brands fa-github"></i> ' +
        document.getElementById('i18nDownloadNewVersion').textContent.trim() +
        ' <i class="fa fa-external-link-alt"></i>';

    // revert icon and option to normal stage after 60 seconds
    setTimeout(() => {
        tourButtonElement.innerHTML = previousQuestionIconHTML;
        autolinkElement.innerHTML = previousAutolinkContentHTML;
    }, ANNOUNCE_UPDATE_TIME * 1000);
}

/**
 * Check latest version and announce by blink icon and change name of option
 *
 * Note: If time from startup to now is exceeded, it will do nothing although there is a newer version on GitHub.
 * @return {Promise<void>}
 */
async function checkNewVersion() {
    const appStartupTime = moment.utc(appContext.app_startup_time).local();
    const now = moment();

    // calculate the time from startup to now is many seconds through
    const passingTime = (now - appStartupTime) / 1000;
    if (passingTime < LIMIT_CHECKING_NEWER_VERSION_TIME) {
        const isUpdated = await isCurrentVersionInUpdate();
        // in case of out update
        if (isUpdated) {
            console.info('Application is IN UPDATE');
            return; // current app is in update, do nothing
        } else if (isUpdated === undefined) {
            console.info('Bypass checking new version');
            return;
        }

        // in case of out update
        console.info('Application is OUT UPDATE');
        announceNewVersion();
    } else {
        // in case passingTime is over than announceUpdateTime, it is no longer valid to check version
        //  or announce new version
    }
}
