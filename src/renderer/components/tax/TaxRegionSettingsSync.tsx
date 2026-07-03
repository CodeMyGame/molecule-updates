import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ipc } from '../../lib/ipc';
import { getTaxRegionForLanguage } from '../../lib/taxLocalePresets';
import {
  getEffectiveTaxConfigForRegion,
  migrateSqliteTaxIntoIndiaRegionOnce,
} from '../../lib/taxConfigByRegion';
import { useCountryStore } from '../../stores/country.store';

/**
 * When the UI language changes tax region, push that region's effective defaults
 * into SQLite (menu / billing defaults). Migrates existing SQLite rates into the
 * India region store once so upgrades do not reset venues.
 */
const TaxRegionSettingsSync: React.FC = () => {
  const { i18n } = useTranslation();
  const countryId = useCountryStore((s) => s.countryId);
  const lastRegion = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const [rateRaw, incRaw] = await Promise.all([
        ipc<string | null>(window.electronAPI.settings.get('default_tax_rate')),
        ipc<string | null>(window.electronAPI.settings.get('tax_inclusive')),
      ]);
      if (cancelled) return;

      migrateSqliteTaxIntoIndiaRegionOnce(
        rateRaw != null ? String(rateRaw) : null,
        incRaw != null ? String(incRaw) : null,
      );

      const region = getTaxRegionForLanguage(i18n.language);
      const eff = getEffectiveTaxConfigForRegion(region);

      if (lastRegion.current !== region) {
        lastRegion.current = region;
        try {
          await ipc(window.electronAPI.settings.set('default_tax_rate', eff.default_tax_rate, 'general'));
          await ipc(window.electronAPI.settings.set('tax_inclusive', eff.tax_inclusive, 'general'));
        } catch {
          /* ignore */
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, countryId]);

  return null;
};

export default TaxRegionSettingsSync;
