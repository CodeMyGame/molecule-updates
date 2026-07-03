import { create } from 'zustand';
import type { CountryId } from '../lib/countryLocale';
import {
  ensureCountrySeedFromLanguage,
  readStoredCountryId,
  writeStoredCountryId,
} from '../lib/countryLocale';

ensureCountrySeedFromLanguage();

interface CountryState {
  countryId: CountryId;
  setCountryId: (id: CountryId) => void;
}

export const useCountryStore = create<CountryState>((set) => ({
  countryId: readStoredCountryId(),
  setCountryId: (id: CountryId) => {
    writeStoredCountryId(id);
    set({ countryId: id });
  },
}));
