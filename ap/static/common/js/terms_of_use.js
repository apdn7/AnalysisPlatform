// term of use
const TERMS_OF_USE_KEY = 'termsOfUseAccepted';
const HOME_PAGE = '/ap';
const TERMS_OF_USE_PAGE = '/ap/terms_of_use';
const PAGE_NOT_FOUND = '/ap/page_not_found';
const setAcceptTerms = () => {
    localStorage.setItem(TERMS_OF_USE_KEY, '1');
    return true;
};

const getAcceptTerms = () => {
    const flag = localStorage.getItem(TERMS_OF_USE_KEY);
    return flag === '1';
};

const validateTerms = () => {
    if ([TERMS_OF_USE_PAGE, PAGE_NOT_FOUND].includes(window.location.pathname) || getAcceptTerms()) {
        return;
    }
    // redirect terms of use page
    window.location.replace(TERMS_OF_USE_PAGE);
};

const acceptTerms = () => {
    setAcceptTerms();
    window.location.replace(HOME_PAGE);
};

const denyTerms = () => {
    window.location.replace(PAGE_NOT_FOUND);
};
