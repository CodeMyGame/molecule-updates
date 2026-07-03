import type { TaxRegion } from './taxLocalePresets';
import { TAX_LOCALE_PRESETS } from './taxLocalePresets';

const STORAGE_KEY = 'tax_config_by_region_v1';
const MIGRATION_KEY = 'tax_config_by_region_v1_migrated';

/** One-time: copy current SQLite tax settings into the India region store so existing venues keep their rate. */
export function migrateSqliteTaxIntoIndiaRegionOnce(
  sqliteDefaultRate: string | null | undefined,
  sqliteInclusive: string | null | undefined,
): void {
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const preset = TAX_LOCALE_PRESETS.in;
    const rate =
      sqliteDefaultRate != null && String(sqliteDefaultRate).trim() !== ''
        ? String(sqliteDefaultRate)
        : preset.defaultRate;
    setStoredTaxConfigForRegion('in', {
      default_tax_rate: rate,
      tax_inclusive: sqliteInclusive === 'true' ? 'true' : 'false',
    });
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export type RegionTaxConfig = {
  default_tax_rate: string;
  tax_inclusive: string;
};

function readAll(): Partial<Record<TaxRegion, RegionTaxConfig>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<TaxRegion, RegionTaxConfig>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Partial<Record<TaxRegion, RegionTaxConfig>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** User overrides for a region (optional fields). */
export function getStoredTaxConfigForRegion(region: TaxRegion): RegionTaxConfig | null {
  const row = readAll()[region];
  if (!row) return null;
  return { ...row };
}

export function setStoredTaxConfigForRegion(region: TaxRegion, partial: Partial<RegionTaxConfig>): void {
  const all = readAll();
  const preset = TAX_LOCALE_PRESETS[region];
  const prev = all[region];
  const base: RegionTaxConfig = prev ?? {
    default_tax_rate: preset.defaultRate,
    tax_inclusive: preset.defaultTaxInclusive ? 'true' : 'false',
  };
  all[region] = {
    default_tax_rate: partial.default_tax_rate ?? base.default_tax_rate,
    tax_inclusive: partial.tax_inclusive ?? base.tax_inclusive,
  };
  writeAll(all);
}

/** Effective config: stored overrides per region, else preset defaults. */
export function getEffectiveTaxConfigForRegion(region: TaxRegion): RegionTaxConfig {
  const preset = TAX_LOCALE_PRESETS[region];
  const stored = getStoredTaxConfigForRegion(region);
  return {
    default_tax_rate: stored?.default_tax_rate ?? preset.defaultRate,
    tax_inclusive: stored?.tax_inclusive ?? (preset.defaultTaxInclusive ? 'true' : 'false'),
  };
}
