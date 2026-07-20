import { initReactI18next } from 'react-i18next';

import i18n from 'i18next';

import { docCookies } from '@/shared/utils/cookies';

const initI18n = async () => {
    const locale = docCookies.getLocale();
    const resources = await import(`./locales/${locale}.json`);
    await i18n.use(initReactI18next).init({
        lng: locale,
        showSupportNotice: false,
        fallbackLng: 'en',
        resources: {
            [locale]: {
                translation: resources.default,
            },
        },
        keySeparator: false,
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });
};

void initI18n();
