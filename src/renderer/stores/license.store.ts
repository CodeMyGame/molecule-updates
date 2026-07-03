import { create } from 'zustand';
import { ipc } from '../lib/ipc';
import type { LicenseStatus } from '../../shared/types/license.types';

interface LicenseState {
  status: LicenseStatus | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
  activate: (key: string) => Promise<LicenseStatus>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const status = await ipc<LicenseStatus>(window.electronAPI.license.getStatus());
      set({ status, isLoading: false });
    } catch {
      set({ status: { state: 'unlicensed' }, isLoading: false });
    }
  },

  activate: async (key: string) => {
    const status = await ipc<LicenseStatus>(window.electronAPI.license.activate(key));
    set({ status });
    return status;
  },
}));
