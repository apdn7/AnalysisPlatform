const cookieConsentName = keyPort() + '_cc_cookie';
const locale = docCookies.getItem(keyPort('locale'));
const hostName = window.location.hostname;
const COOKIE_EXPIRATION_DAYS = 30;
const cookieElms = {
    bannerContainer: '.cookie-banner-container',
    customAcceptAllBtn: '.data-cc-accept-all',
};

const i18nCookieLabels = {
    bannerContent: $('#i18nCookieBannerContent').text(),
    policy: $('#i18nCookiePolicy').text(),
    settings: $('#i18nCookiesSettings').text(),
    details: $('#i18nCookiesDetails').text(),
    acceptAll: $('#i18nAcceptAllCookies').text(),
    privacyPreferenceCenter: $('#i18nPrivacyPreferenceCenter').text(),
    privacyPreferenceCenterContent: $('#i18nPrivacyPreferenceCenterContent').text(),
    moreInformation: $('#i18nMoreInformation').text(),
    manageConsentPreferences: $('#i18nManageConsentPreferences').text(),
    strictlyNecessaryCookies: $('#i18nStrictlyNecessaryCookies').text(),
    strictlyNecessaryCookiesDescription: $('#i18nStrictlyNecessaryCookiesDescription').text(),
    targetingCookies: $('#i18nTargetingCookies').text(),
    targetingCookiesDescription: $('#i18nTargetingCookiesDescription').text(),
    functionalCookies: $('#i18nFunctionalCookies').text(),
    functionalCookiesDescription: $('#i18nFunctionalCookiesDescription').text(),
    performanceCookies: $('#i18nPerformanceCookies').text(),
    performanceCookiesDescription: $('#i18nPerformanceCookiesDescription').text(),
    confirmMyChoices: $('#i18nConfirmMyChoices').text(),
    allowAll: $('#i18nAllowAll').text(),
    name: $('#i18Name').text(),
    hostName: $('#i18HostName').text(),
    duration: $('#i18nDuration').text(),
    category: $('#i18nCategoryOutputLabel').text(),
    type: $('#i18nCookiesType').text(),
    description: $('#i18nDescription').text(),
    tableList: $('#i18nTableList').text(),
    rejectAll: $('#i18nCookieRejectAllBtn').text(),
    cookieFirstParty: $('#i18nCookieFirstPartyType').text(),
    cookieThirdParty: $('#i18nCookieThirdPartyType').text(),
    lifeSpanDays: $('#i18nCookieLifeSpanDays').text(),
    lifeSpanYears: $('#i18nCookieLifeSpanYears').text(),
    example: $('#i18nCookieExample').text(),
    localeCookieDescription: $('#i18nlocaleCookieDescription').text(),
    ccCookieDescription: $('#i18nccCookieDescription').text(),
    gaCookieDescription: $('#i18ngaCookieDescription').text(),
    gaxCookieDescription: $('#i18ngaxCookieDescription').text(),
};

const moreInfoBtn = `<a class="cc__link" target="_blank" href="https://cookiepedia.co.uk/giving-consent-to-cookies" style="color: #00bc8c">${i18nCookieLabels.moreInformation}</a>`;
const allowAllBtn = `<button type="button" class="pm__btn pm__btn--secondary data-cc-accept-all" style="white-space: nowrap; margin-top: 15px">${i18nCookieLabels.allowAll}</button>`;
document.documentElement.classList.add('cc--darkmode');

const headerTableList = {
    name: i18nCookieLabels.name,
    host: i18nCookieLabels.hostName,
    duration: i18nCookieLabels.duration,
    type: i18nCookieLabels.type,
    Category: i18nCookieLabels.category,
    description: i18nCookieLabels.description,
    example: i18nCookieLabels.example,
};

const necessaryCookieTableList = {
    caption: i18nCookieLabels.tableList,
    headers: headerTableList,
    body: [
        {
            name: 'locale',
            host: hostName,
            duration: 'Session',
            type: i18nCookieLabels.cookieFirstParty,
            Category: i18nCookieLabels.strictlyNecessaryCookies,
            description: i18nCookieLabels.localeCookieDescription,
            example: 'en, ja',
        },
        {
            name: 'cc_cookie',
            host: hostName,
            duration: 'Session',
            type: i18nCookieLabels.cookieFirstParty,
            Category: i18nCookieLabels.strictlyNecessaryCookies,
            description: i18nCookieLabels.ccCookieDescription,
            example: '',
        },
    ],
};

const performanceCookieTableList = {
    caption: i18nCookieLabels.tableList,
    headers: headerTableList,
    body: [
        {
            name: '_ga',
            host: hostName,
            duration: `2 ${i18nCookieLabels.lifeSpanYears}`,
            type: i18nCookieLabels.cookieFirstParty,
            Category: i18nCookieLabels.performanceCookies,
            description: i18nCookieLabels.gaCookieDescription,
            example: 'GAx.x.xxxxxx.xxxxxxx',
        },
        {
            name: '_ga_XXXXXXXXXX',
            host: hostName,
            duration: `2 ${i18nCookieLabels.lifeSpanYears}`,
            type: i18nCookieLabels.cookieFirstParty,
            Category: i18nCookieLabels.performanceCookies,
            description: i18nCookieLabels.gaxCookieDescription,
            example: '_ga_xxxxxxxxxx',
        },
    ],
};

const preferencesModalSections = [
    {
        title: i18nCookieLabels.privacyPreferenceCenter,
        description:
            i18nCookieLabels.privacyPreferenceCenterContent + '<br/>' + moreInfoBtn /*+ '<br/>' + allowAllBtn*/,
    },
    {
        title: i18nCookieLabels.strictlyNecessaryCookies,
        description: i18nCookieLabels.strictlyNecessaryCookiesDescription,
        cookieTable: necessaryCookieTableList,
        linkedCategory: 'necessary',
    },

    {
        title: i18nCookieLabels.performanceCookies,
        description: i18nCookieLabels.performanceCookiesDescription,
        cookieTable: performanceCookieTableList,
        linkedCategory: 'performance',
    },
];

CookieConsent.run({
    onFirstConsent: ({ cookie }) => {
        if (!cookie.categories.includes('performance')) {
            CookieConsent.eraseCookies(/^_ga/);
        } else {
            sendGtagConfigAndTracking();
        }
    },
    onChange: ({ cookie }) => {
        if (!cookie.categories.includes('performance')) {
            CookieConsent.eraseCookies(/^_ga/);
            gtag('consent', 'default', {
                ad_storage: 'denied',
                analytics_storage: 'denied',
            });
        } else {
            sendGtagConfigAndTracking();
        }
    },
    cookie: {
        name: cookieConsentName,
        expiresAfterDays: COOKIE_EXPIRATION_DAYS,
    },
    onConsent: ({ cookie }) => {
        $(cookieElms.bannerContainer).css('display', 'none');
    },
    categories: {
        necessary: { enabled: true, readOnly: true },
        performance: { enabled: true },
    },

    language: {
        default: locale,
        translations: {
            [locale]: {
                consentModal: {
                    layout: 'bar inline',
                    position: 'bottom center',
                    title: 'We use cookies',
                    description: i18nCookieLabels.bannerContent,
                    acceptAllBtn: i18nCookieLabels.allowAll,
                    acceptNecessaryBtn: i18nCookieLabels.rejectAll,
                    showPreferencesBtn: 'Manage Individual preferences',
                },
                preferencesModal: {
                    title: i18nCookieLabels.manageConsentPreferences,
                    acceptAllBtn: i18nCookieLabels.allowAll,
                    acceptNecessaryBtn: i18nCookieLabels.rejectAll,
                    savePreferencesBtn: i18nCookieLabels.confirmMyChoices,
                    closeIconLabel: 'Close modal',
                    sections: preferencesModalSections,
                },
            },
        },
    },
});

if (!docCookies.getItem(cookieConsentName)) {
    $(cookieElms.bannerContainer).css('display', 'block');
}

$(cookieElms.customAcceptAllBtn).on('click', function () {
    CookieConsent.acceptCategory('all');
    $(cookieElms.bannerContainer).css('display', 'none');
});
