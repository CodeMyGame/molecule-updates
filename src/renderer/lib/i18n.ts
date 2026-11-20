import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocaleResources, loadLocaleResource, LOCALE_CODES, type LocaleCode } from '../locales';
import { ensureCountrySeedFromLanguage } from './countryLocale';

function clearLegacyTranslationCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('ui_translations_')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

clearLegacyTranslationCache();
ensureCountrySeedFromLanguage();

const savedRaw = localStorage.getItem('app_language') ?? 'en';
const savedBase = savedRaw.split('-')[0].toLowerCase();
const savedLang: LocaleCode =
  LOCALE_CODES.includes(savedBase as LocaleCode) ? (savedBase as LocaleCode) : 'en';

i18n.use(initReactI18next).init({
  resources: defaultLocaleResources as never,
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Wrap changeLanguage to load non-bundled locales on-demand
const origChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng?: string, ...args: any[]) => {
  if (lng) {
    const base = lng.split('-')[0].toLowerCase() as LocaleCode;
    if (base !== 'en' && !i18n.hasResourceBundle(base, 'translation')) {
      try {
        const res = await loadLocaleResource(base);
        i18n.addResourceBundle(base, 'translation', res, true, true);
      } catch (err) {
        console.error(`Failed to load translations for locale: ${base}`, err);
      }
    }
  }
  return origChangeLanguage(lng, ...args);
};

// If initial language is not 'en', load it immediately
if (savedLang !== 'en') {
  void loadLocaleResource(savedLang).then((res) => {
    i18n.addResourceBundle(savedLang, 'translation', res, true, true);
    void origChangeLanguage(savedLang);
  }).catch((err) => {
    console.error(`Failed to load initial translations for locale: ${savedLang}`, err);
  });
}

export default i18n;
