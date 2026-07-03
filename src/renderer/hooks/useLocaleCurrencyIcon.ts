import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Coins, DollarSign, Euro, IndianRupee, JapaneseYen } from 'lucide-react';
import { INDIAN_LANGUAGE_BASES, baseLanguageCode } from '../lib/currencyLocale';
import { useCountryStore } from '../stores/country.store';
import type { CountryId } from '../lib/countryLocale';

/** Lucide icon for the active country + language (amounts remain INR). */
export function getCurrencyIconForLanguage(
  language: string,
  countryId: CountryId,
): LucideIcon {
  const base = baseLanguageCode(language);

  if (countryId === 'us') return DollarSign;
  if (countryId === 'bd') return Coins;

  if (countryId === 'in') {
    return IndianRupee;
  }

  if (countryId === 'es' || countryId === 'fr') return Euro;
  if (countryId === 'cn' || countryId === 'jp') return JapaneseYen;
  if (countryId === 'gcc') return Coins;

  if (INDIAN_LANGUAGE_BASES.has(base)) return IndianRupee;
  if (base === 'en') return IndianRupee;

  return IndianRupee;
}

export function useLocaleCurrencyIcon(): LucideIcon {
  const { i18n } = useTranslation();
  const countryId = useCountryStore((s) => s.countryId);
  return useMemo(
    () => getCurrencyIconForLanguage(i18n.language, countryId),
    [i18n.language, countryId],
  );
}
