/**
 * Maps country + UI language to a display symbol for amounts stored in paise (INR).
 * Values are still rupees; only the prefix glyph changes for non-Indian locales.
 */

import { readStoredCountryId } from './countryLocale';

/** Indian regional languages — show ₹ when country is India. */
export const INDIAN_LANGUAGE_BASES = new Set([
  'hi',
  'ta',
  'te',
  'kn',
  'ml',
  'mr',
  'gu',
  'pa',
]);

export function baseLanguageCode(lang: string): string {
  const [primary] = lang.split(/[-_]/);
  return (primary || 'en').toLowerCase();
}

export function currencySymbolForLanguage(lang: string): string {
  const country = readStoredCountryId();
  const base = baseLanguageCode(lang);

  if (country === 'us') return '$';
  if (country === 'bd') return '\u09F3';

  if (country === 'in') {
    return '\u20B9';
  }

  switch (country) {
    case 'es':
    case 'fr':
      return '\u20AC';
    case 'cn':
    case 'jp':
      return '\u00A5';
    case 'gcc':
      return '\uFDFC';
    default:
      break;
  }

  if (INDIAN_LANGUAGE_BASES.has(base)) return '\u20B9';
  switch (base) {
    case 'en':
      return '\u20B9';
    case 'es':
    case 'fr':
      return '\u20AC';
    case 'zh':
    case 'ja':
      return '\u00A5';
    case 'ar':
      return '\uFDFC';
    case 'bn':
      return '\u09F3';
    default:
      return '\u20B9';
  }
}
