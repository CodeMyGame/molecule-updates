/**
 * Country-first region: each country maps to UI languages and display currency.
 * Amounts remain stored in paise (INR); only symbols / icons change.
 */

import type { LocaleCode } from '../locales';

/** Labels for language picker (English names + native script + flag). */
export const LOCALE_DISPLAY: Record<
  LocaleCode,
  { label: string; native: string; flag: string }
> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧' },
  hi: { label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  ta: { label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  te: { label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  kn: { label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  ml: { label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  mr: { label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  bn: { label: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
  gu: { label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  pa: { label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷' },
  ar: { label: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  zh: { label: 'Chinese', native: '中文', flag: '🇨🇳' },
  ja: { label: 'Japanese', native: '日本語', flag: '🇯🇵' },
};

export type CountryId = 'in' | 'bd' | 'es' | 'fr' | 'gcc' | 'cn' | 'jp' | 'us';

export type CountryCurrencyMode =
  | 'inr'
  | 'usd'
  | 'eur'
  | 'cny'
  | 'jpy'
  | 'sar'
  | 'bdt';

export type CountryDef = {
  id: CountryId;
  flag: string;
  nameKey: string;
  languages: LocaleCode[];
  defaultLang: LocaleCode;
  currency: CountryCurrencyMode;
};

export const COUNTRIES: CountryDef[] = [
  {
    id: 'in',
    flag: '🇮🇳',
    nameKey: 'language.country.in',
    languages: ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa'],
    defaultLang: 'en',
    currency: 'inr',
  },
  {
    id: 'bd',
    flag: '🇧🇩',
    nameKey: 'language.country.bd',
    languages: ['bn'],
    defaultLang: 'bn',
    currency: 'bdt',
  },
  {
    id: 'es',
    flag: '🇪🇸',
    nameKey: 'language.country.es',
    languages: ['es'],
    defaultLang: 'es',
    currency: 'eur',
  },
  {
    id: 'fr',
    flag: '🇫🇷',
    nameKey: 'language.country.fr',
    languages: ['fr'],
    defaultLang: 'fr',
    currency: 'eur',
  },
  {
    id: 'gcc',
    flag: '🇦🇪',
    nameKey: 'language.country.gcc',
    languages: ['ar'],
    defaultLang: 'ar',
    currency: 'sar',
  },
  {
    id: 'cn',
    flag: '🇨🇳',
    nameKey: 'language.country.cn',
    languages: ['zh'],
    defaultLang: 'zh',
    currency: 'cny',
  },
  {
    id: 'jp',
    flag: '🇯🇵',
    nameKey: 'language.country.jp',
    languages: ['ja'],
    defaultLang: 'ja',
    currency: 'jpy',
  },
  {
    id: 'us',
    flag: '🇺🇸',
    nameKey: 'language.country.us',
    languages: ['en'],
    defaultLang: 'en',
    currency: 'usd',
  },
];

const BY_ID: Record<CountryId, CountryDef> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c])
) as Record<CountryId, CountryDef>;

export function getCountryById(id: CountryId): CountryDef {
  return BY_ID[id] ?? BY_ID.in;
}

const INDIAN_LANGS = new Set<LocaleCode>(['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa']);

/** Guess country from a UI language code (used when migrating old installs with no app_country). */
export function inferCountryFromLanguage(lang: string): CountryId {
  const base = (lang.split(/[-_]/)[0] || 'en').toLowerCase() as LocaleCode;
  if (base === 'bn') return 'bd';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'ar') return 'gcc';
  if (base === 'zh') return 'cn';
  if (base === 'ja') return 'jp';
  if (INDIAN_LANGS.has(base)) return 'in';
  if (base === 'en') return 'in';
  return 'in';
}

const STORAGE_COUNTRY = 'app_country';

export function readStoredCountryId(): CountryId {
  try {
    const raw = localStorage.getItem(STORAGE_COUNTRY);
    if (raw && raw in BY_ID) return raw as CountryId;
  } catch {
    /* ignore */
  }
  return 'in';
}

/** Call once on app init before reading country (i18n bootstrap). */
export function ensureCountrySeedFromLanguage(): void {
  try {
    if (localStorage.getItem(STORAGE_COUNTRY)) return;
    const lang = localStorage.getItem('app_language') ?? 'en';
    localStorage.setItem(STORAGE_COUNTRY, inferCountryFromLanguage(lang));
  } catch {
    /* ignore */
  }
}

export function writeStoredCountryId(id: CountryId): void {
  try {
    localStorage.setItem(STORAGE_COUNTRY, id);
  } catch {
    /* ignore */
  }
}
