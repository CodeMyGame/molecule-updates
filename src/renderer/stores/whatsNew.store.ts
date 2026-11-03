import { create } from 'zustand';
import { LATEST_VERSION } from '../data/changelog';
import { ipc } from '../lib/ipc';

const STORAGE_KEY = 'molecule_pos_whats_new_seen_version';
const SETTING_KEY = 'whats_new_last_seen_version';

interface WhatsNewState {
  isOpen: boolean;
  activeVersion: string;
  hasUnseenUpdate: boolean;
  openWhatsNew: (version?: string) => void;
  closeWhatsNew: () => void;
  markSeen: (version?: string) => void;
  checkAndPrompt: (currentVersion?: string) => Promise<boolean>;
}

export const useWhatsNewStore = create<WhatsNewState>((set, get) => ({
  isOpen: false,
  activeVersion: LATEST_VERSION,
  hasUnseenUpdate: false,

  openWhatsNew: (version?: string) => {
    set({
      isOpen: true,
      activeVersion: version || LATEST_VERSION,
    });
  },

  closeWhatsNew: () => {
    const { activeVersion, markSeen } = get();
    markSeen(activeVersion);
    set({ isOpen: false, hasUnseenUpdate: false });
  },

  markSeen: (version?: string) => {
    const v = version || get().activeVersion || LATEST_VERSION;
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    if (window.electronAPI?.settings?.set) {
      ipc(window.electronAPI.settings.set(SETTING_KEY, v, 'general')).catch(() => {});
    }
  },

  checkAndPrompt: async (currentVersion?: string): Promise<boolean> => {
    const version = currentVersion || LATEST_VERSION;
    let seenVersion = '';
    try {
      seenVersion = localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      /* ignore */
    }

    if (!seenVersion && window.electronAPI?.settings?.get) {
      try {
        const val = await ipc<string | null>(window.electronAPI.settings.get(SETTING_KEY));
        if (val) seenVersion = val;
      } catch {
        /* ignore */
      }
    }

    // Do not show automatically on login or version change
    const isUnseen = !seenVersion || seenVersion !== version;
    set({
      isOpen: false,
      activeVersion: version,
      hasUnseenUpdate: isUnseen,
    });
    return isUnseen;
  },
}));
