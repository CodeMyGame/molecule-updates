import { create } from 'zustand';
import { ipc } from '../lib/ipc';

interface DaySession {
  id: number;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
}

interface DaySessionState {
  session: DaySession | null;
  isDayOpen: boolean;
  fetch: () => Promise<void>;
  setSession: (s: DaySession | null) => void;
}

export const useDaySessionStore = create<DaySessionState>((set) => ({
  session: null,
  isDayOpen: false,

  fetch: async () => {
    try {
      const s = await ipc<DaySession | null>(window.electronAPI.daySession.getCurrent());
      const session = s ?? null;
      set({ session, isDayOpen: !!session && !session.closedAt });
    } catch {
      set({ session: null, isDayOpen: false });
    }
  },

  setSession: (session) => {
    set({ session, isDayOpen: !!session && !session.closedAt });
  },
}));
