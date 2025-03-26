// term of use
const TERMS_OF_USE_KEY = 'termsOfUseAccepted';
const HOME_PAGE = '/ap';
const TERMS_OF_USE_PAGE = '/ap/terms_of_use';
const PAGE_NOT_FOUND = '/ap/page_not_found';

const checkSupportedBrowser = () => {
    if (!/chrome|edg/i.test(navigator.userAgent.toLowerCase())) {
        console.log('check supported browser');
        setTimeout(() => {
            $('#informSupportedBrowser').modal('show');
        }, 300);
    }
};

const setAcceptTerms = () => {
    const apVersion = getAPVersion();
    const currentTermsOfUserAccepted = getTermsOfUserAccepted();
    currentTermsOfUserAccepted[apVersion] = 1;
    localStorage.setItem(TERMS_OF_USE_KEY, JSON.stringify(currentTermsOfUserAccepted));
    return true;
};

const getAPVersion = () => {
    try {
        return decodeURIComponent(
            document.cookie.replace(
                new RegExp(
                    `(?:(?:^|.*;)\\s*${encodeURIComponent(`${window.location.port}_app_version`).replace(/[-.+*]/g, '\\$&')}\\s*\\=\\s*([^;]*).*$)|^.*$`,
                ),
                '$1',
            ),
        );
    } catch (e) {
        return '';
    }
};

const getTermsOfUserAccepted = () => {
    let currentTermsOfUserAccepted = localStorage.getItem(TERMS_OF_USE_KEY);
    currentTermsOfUserAccepted = currentTermsOfUserAccepted ? JSON.parse(currentTermsOfUserAccepted) : null;
    if (!currentTermsOfUserAccepted || !_.isObject(currentTermsOfUserAccepted)) {
        currentTermsOfUserAccepted = {};
    }
    return currentTermsOfUserAccepted;
};

const getAcceptTerms = () => {
    const apVersion = getAPVersion();
    const currentTermsOfUserAccepted = getTermsOfUserAccepted();
    return !!currentTermsOfUserAccepted[apVersion];
};

const validateTerms = () => {
    if ([TERMS_OF_USE_PAGE].includes(window.location.pathname)) {
        // show inform supported browser modal in term_of_user page (S254$06)
        checkSupportedBrowser();
    }

    if ([TERMS_OF_USE_PAGE, PAGE_NOT_FOUND].includes(window.location.pathname) || getAcceptTerms()) {
        return;
    }

    // save bookmark link to session storage
    const bookmarkPage = ['fpp', 'stp', 'rlp', 'chm', 'agp', 'msp', 'scp', 'hmp', 'pcp', 'skd', 'cog', 'pca', 'gl'];
    if (bookmarkPage.some((page) => window.location.href.includes(`ap/${page}?bookmark_id`))) {
        sessionStorage.setItem('BOOKMARK_ADDRESS', window.location.href);
    }
    // redirect terms of use page
    window.location.replace(TERMS_OF_USE_PAGE);
};

const acceptTerms = () => {
    setAcceptTerms();

    // redirect to bookmark
    const previousPage = sessionStorage.getItem('BOOKMARK_ADDRESS');
    if (previousPage) {
        window.location.href = previousPage;
        sessionStorage.removeItem('BOOKMARK_ADDRESS');
    } else {
        window.location.replace(HOME_PAGE);
    }
};

const denyTerms = () => {
    window.location.replace(PAGE_NOT_FOUND);
};
