import { create } from 'zustand';
import { KOTStatus } from '../../shared/enums';
import { getActiveKOTs, updateKOTStatus as updateKOTStatusApi } from '../lib/kitchenApi';

export interface KOTItem {
  id: number;
  name: string;
  quantity: number;
  notes?: string;
  isNew?: boolean;
  isCancelled?: boolean;
  station?: string;
  addons?: string[];
}

export interface KOT {
  id: number;
  kotNumber: string;
  orderId: number;
  orderNumber: string;
  orderType: string;
  tableName?: string;
  status: KOTStatus;
  station: string;
  items: KOTItem[];
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string;
  readyAt?: string;
}

type StationKey = 'all' | 'main_kitchen' | 'tandoor' | 'bar' | 'dessert';

interface KOTState {
  activeKOTs: KOT[];
  completedKOTs: KOT[];
  selectedStation: StationKey;
  loading: boolean;
  error: string | null;
  refreshInterval: ReturnType<typeof setInterval> | null;

  // Actions
  fetchKOTs: () => Promise<void>;
  updateKOTStatus: (id: number, status: KOTStatus) => Promise<void>;
  setStation: (station: StationKey) => void;
  getFilteredKOTs: () => KOT[];
  getStationCounts: () => Record<StationKey, number>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

export const useKOTStore = create<KOTState>((set, get) => ({
  activeKOTs: [],
  completedKOTs: [],
  selectedStation: 'all',
  loading: false,
  error: null,
  refreshInterval: null,

  fetchKOTs: async () => {
    try {
      set({ loading: true, error: null });
      const kots = await getActiveKOTs();

      const active = kots.filter(
        (k) => k.status !== KOTStatus.SERVED
      );
      const completed = kots.filter(
        (k) => k.status === KOTStatus.SERVED
      );

      set({ activeKOTs: active, completedKOTs: completed });
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to fetch KOTs' });
    } finally {
      set({ loading: false });
    }
  },

  updateKOTStatus: async (id: number, status: KOTStatus) => {
    try {
      await updateKOTStatusApi(id, status);

      // Optimistic update
      set((state) => {
        const kotIndex = state.activeKOTs.findIndex((k) => k.id === id);
        if (kotIndex === -1) return state;

        const updatedKOT = { ...state.activeKOTs[kotIndex], status };

        if (status === KOTStatus.SERVED) {
          return {
            activeKOTs: state.activeKOTs.filter((k) => k.id !== id),
            completedKOTs: [updatedKOT, ...state.completedKOTs].slice(0, 20),
          };
        }

        const newActive = [...state.activeKOTs];
        newActive[kotIndex] = updatedKOT;
        return { activeKOTs: newActive };
      });
    } catch (err: any) {
      set({ error: err.message ?? 'Failed to update KOT status' });
      // Re-fetch to get correct state
      await get().fetchKOTs();
    }
  },

  setStation: (station: StationKey) => {
    set({ selectedStation: station });
  },

  getFilteredKOTs: () => {
    const { activeKOTs, selectedStation } = get();
    if (selectedStation === 'all') return activeKOTs;
    return activeKOTs.filter((k) => k.station === selectedStation);
  },

  getStationCounts: () => {
    const { activeKOTs } = get();
    const counts: Record<StationKey, number> = {
      all: activeKOTs.length,
      main_kitchen: 0,
      tandoor: 0,
      bar: 0,
      dessert: 0,
    };

    for (const kot of activeKOTs) {
      const station = kot.station as StationKey;
      if (station in counts) {
        counts[station]++;
      }
    }

    return counts;
  },

  startAutoRefresh: () => {
    const existing = get().refreshInterval;
    if (existing) clearInterval(existing);

    // Initial fetch
    get().fetchKOTs();

    const interval = setInterval(() => {
      get().fetchKOTs();
    }, 5000);

    set({ refreshInterval: interval });
  },

  stopAutoRefresh: () => {
    const interval = get().refreshInterval;
    if (interval) {
      clearInterval(interval);
      set({ refreshInterval: null });
    }
  },
}));
