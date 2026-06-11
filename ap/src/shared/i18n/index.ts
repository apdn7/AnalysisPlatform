import i18n from 'i18next';
import { docCookies } from '@/shared/utils/cookies';
import { initReactI18next } from 'react-i18next';

const initI18n = async () => {
    const locale = docCookies.getLocale();
    const resources = await import(`./locales/${locale}.json`);
    i18n.use(initReactI18next).init({
        lng: locale,
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

initI18n();
