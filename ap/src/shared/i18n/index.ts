import { initReactI18next } from 'react-i18next';

import i18n from 'i18next';

import { docCookies } from '@/shared/utils/cookies';

const FALLBACK_LOCALE = 'en';

type TranslationModule = {
    default: Record<string, string>;
};

const loadTranslation = async (locale: string): Promise<{ locale: string; resources: Record<string, string> }> => {
    try {
        const resources = (await import(`./locales/${locale}.json`)) as TranslationModule;
        return { locale, resources: resources.default };
    } catch {
        const resources = (await import(`./locales/${FALLBACK_LOCALE}.json`)) as TranslationModule;
        return { locale: FALLBACK_LOCALE, resources: resources.default };
    }
};

export const initI18n = async (): Promise<void> => {
    const requestedLocale = docCookies.getLocale() || FALLBACK_LOCALE;
    const { locale, resources } = await loadTranslation(requestedLocale);

    await i18n.use(initReactI18next).init({
        lng: locale,
        showSupportNotice: false,
        fallbackLng: FALLBACK_LOCALE,
        resources: {
            [locale]: {
                translation: resources,
            },
        },
        keySeparator: false,
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });
};

export const i18nReady = initI18n();
