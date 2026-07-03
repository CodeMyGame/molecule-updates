/**
 * Region-specific tax defaults for restaurant / food retail POS.
 * Rates are simplified references (typical reduced / food-related rates where applicable).
 * Users must verify with a local accountant — see i18n footnotes in Settings.
 */

import { normalizeLangCode } from './taxTerminology';
import { readStoredCountryId } from './countryLocale';

export type TaxRegion = 'in' | 'cn' | 'jp' | 'es' | 'fr' | 'gcc';

export type TaxLocalePreset = {
  region: TaxRegion;
  /** Typical default % for new menu items (food service context) */
  defaultRate: string;
  defaultTaxInclusive: boolean;
  /** Reference slabs shown in Settings (jurisdiction-typical) */
  slabs: string[];
  maxRate: number;
  /** i18n key: taxLocale.footnotes.<region> */
  footnoteKey: string;
};

/** Map UI language → tax region (restaurant operates under that regime for config UI). */
export function getTaxRegionForLanguage(langCode: string): TaxRegion {
  try {
    const cid = readStoredCountryId();
    if (cid === 'cn') return 'cn';
    if (cid === 'jp') return 'jp';
    if (cid === 'es') return 'es';
    if (cid === 'fr') return 'fr';
    if (cid === 'gcc') return 'gcc';
  } catch {
    /* ignore */
  }
  const base = normalizeLangCode(langCode);
  switch (base) {
    case 'zh':
      return 'cn';
    case 'ja':
      return 'jp';
    case 'es':
      return 'es';
    case 'fr':
      return 'fr';
    case 'ar':
      return 'gcc';
    default:
      // en + all Indian regional languages → India GST
      return 'in';
  }
}

/**
 * Presets (food / restaurant–oriented references):
 * - IN: GST slabs 5 / 12 / 18 / 28 % (non-AC dining often 5%).
 * - CN: VAT 6 % catering & lifestyle services; 9 / 13 % other goods (MOF / common references).
 * - JP: 10 % standard dine-in; 8 % reduced takeout food — default 10 % for sit-down POS.
 * - ES: IVA 10 % restaurant meals; 4 / 21 % other.
 * - FR: TVA 10 % on-premise catering; 5.5 / 20 % other.
 * - GCC: many states use VAT; Saudi 15 % common — UAE 5 %; default 15 % with footnote to verify.
 */
export const TAX_LOCALE_PRESETS: Record<TaxRegion, TaxLocalePreset> = {
  in: {
    region: 'in',
    defaultRate: '5',
    defaultTaxInclusive: false,
    slabs: ['5', '12', '18', '28'],
    maxRate: 28,
    footnoteKey: 'taxLocale.footnotes.in',
  },
  cn: {
    region: 'cn',
    defaultRate: '6',
    defaultTaxInclusive: false,
    slabs: ['6', '9', '13'],
    maxRate: 13,
    footnoteKey: 'taxLocale.footnotes.cn',
  },
  jp: {
    region: 'jp',
    defaultRate: '10',
    defaultTaxInclusive: false,
    slabs: ['8', '10'],
    maxRate: 10,
    footnoteKey: 'taxLocale.footnotes.jp',
  },
  es: {
    region: 'es',
    defaultRate: '10',
    defaultTaxInclusive: false,
    slabs: ['4', '10', '21'],
    maxRate: 21,
    footnoteKey: 'taxLocale.footnotes.es',
  },
  fr: {
    region: 'fr',
    defaultRate: '10',
    defaultTaxInclusive: false,
    slabs: ['5.5', '10', '20'],
    maxRate: 20,
    footnoteKey: 'taxLocale.footnotes.fr',
  },
  gcc: {
    region: 'gcc',
    defaultRate: '15',
    defaultTaxInclusive: false,
    slabs: ['5', '15'],
    maxRate: 15,
    footnoteKey: 'taxLocale.footnotes.gcc',
  },
};

export function getTaxLocalePresetForLanguage(langCode: string): TaxLocalePreset {
  return TAX_LOCALE_PRESETS[getTaxRegionForLanguage(langCode)];
}

/** Parsed default tax % from settings, clamped to the locale max; null if missing/invalid. */
export function parseSettingsTaxPercent(
  settingsDefaultTaxRate: string | number | undefined | null,
  langCode: string
): number | null {
  const parsed = parseFloat(String(settingsDefaultTaxRate ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const maxRate = getTaxLocalePresetForLanguage(langCode).maxRate;
  return Math.min(maxRate, parsed);
}

/**
 * Tax % stored on a cart line when adding from the menu.
 * - Non-India: use configured default (menu seed often 5% regardless of region).
 * - India (GST): keep per-item slab from the menu unless the item is still at the
 *   reference default slab (5%); then use Settings → default tax rate so changing
 *   tax configuration updates the cart without re-editing every item.
 */
export function resolveTaxRateForCartLine(
  menuItemTaxRate: number,
  settingsDefaultTaxRate: string | number | undefined | null,
  langCode: string
): number {
  const region = getTaxRegionForLanguage(langCode);
  const s = parseSettingsTaxPercent(settingsDefaultTaxRate, langCode);
  const preset = getTaxLocalePresetForLanguage(langCode);
  const canonicalDefault = parseFloat(preset.defaultRate);

  if (region === 'in') {
    if (s !== null && Number.isFinite(canonicalDefault)) {
      if (Math.abs(menuItemTaxRate - canonicalDefault) < 1e-6) {
        return s;
      }
    }
    return menuItemTaxRate;
  }

  if (s !== null) return s;
  const pd = parseFloat(preset.defaultRate);
  return Number.isFinite(pd) ? Math.min(preset.maxRate, pd) : menuItemTaxRate;
}

/** When loading order rows with no tax column, use settings / locale instead of a hardcoded 5. */
export function resolveOrderItemTaxRateFallback(
  rawTax: unknown,
  settingsDefaultTaxRate: string | number | undefined | null,
  langCode: string
): number {
  const n = typeof rawTax === 'number' ? rawTax : parseFloat(String(rawTax ?? '').trim());
  if (Number.isFinite(n) && n >= 0) {
    const maxRate = getTaxLocalePresetForLanguage(langCode).maxRate;
    return Math.min(maxRate, n);
  }
  const s = parseSettingsTaxPercent(settingsDefaultTaxRate, langCode);
  if (s !== null) return s;
  const preset = getTaxLocalePresetForLanguage(langCode);
  const pd = parseFloat(preset.defaultRate);
  return Number.isFinite(pd) ? Math.min(preset.maxRate, pd) : 0;
}
