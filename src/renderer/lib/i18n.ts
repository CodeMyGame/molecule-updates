import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeResources, type LocaleCode } from '../locales';
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
  savedBase in localeResources ? (savedBase as LocaleCode) : 'en';

i18n.use(initReactI18next).init({
  resources: localeResources as never,
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
