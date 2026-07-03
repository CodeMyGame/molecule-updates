import { useState, useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc';
import type { Restaurant, Setting, DaySession } from '../../shared/types/settings.types';
import type { Role } from '../../shared/types/staff.types';

interface UseSettingsReturn {
  restaurant: Restaurant | null;
  settings: Record<string, string>;
  roles: Role[];
  currentSession: DaySession | null;
  loading: boolean;
  error: string | null;
  // Restaurant profile
  fetchRestaurant: () => Promise<void>;
  updateRestaurant: (data: Partial<Restaurant>) => Promise<void>;
  // Settings
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  fetchSettings: (keys: string[]) => Promise<void>;
  // Roles
  fetchRoles: () => Promise<void>;
  updateRole: (id: number, data: Partial<Role>) => Promise<void>;
  // Day session
  fetchCurrentSession: () => Promise<void>;
  openDaySession: (openingCash: number, openedBy: number, notes?: string) => Promise<void>;
  closeDaySession: (closingCash: number, closedBy: number, notes?: string) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentSession, setCurrentSession] = useState<DaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurant = useCallback(async () => {
    try {
      const data = await ipc<Restaurant>(window.electronAPI.settings.getRestaurant());
      setRestaurant(data ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load restaurant profile');
    }
  }, []);

  const updateRestaurant = useCallback(
    async (data: Partial<Restaurant>): Promise<void> => {
      try {
        await ipc(window.electronAPI.settings.updateRestaurant(data));
        await fetchRestaurant();
      } catch (err: any) {
        setError(err.message ?? 'Failed to update restaurant profile');
        throw err;
      }
    },
    [fetchRestaurant]
  );

  const getSetting = useCallback(async (key: string): Promise<string | null> => {
    try {
      const val = await ipc<string>(window.electronAPI.settings.get(key));
      if (val !== null && val !== undefined) {
        setSettings((prev) => ({ ...prev, [key]: val }));
      }
      return val ?? null;
    } catch (err: any) {
      setError(err.message ?? 'Failed to get setting');
      return null;
    }
  }, []);

  const setSetting = useCallback(async (key: string, value: string): Promise<void> => {
    try {
      await ipc(window.electronAPI.settings.set(key, value));
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err: any) {
      setError(err.message ?? 'Failed to save setting');
      throw err;
    }
  }, []);

  const fetchSettings = useCallback(async (keys: string[]): Promise<void> => {
    try {
      const results: Record<string, string> = {};
      for (const key of keys) {
        const val = await ipc<string>(window.electronAPI.settings.get(key));
        if (val !== null && val !== undefined) {
          results[key] = val;
        }
      }
      setSettings((prev) => ({ ...prev, ...results }));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load settings');
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await ipc<Role[]>(window.electronAPI.settings.getRoles());
      setRoles(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load roles');
    }
  }, []);

  const updateRole = useCallback(
    async (id: number, data: Partial<Role>): Promise<void> => {
      try {
        await ipc(window.electronAPI.settings.updateRole(id, data));
        await fetchRoles();
      } catch (err: any) {
        setError(err.message ?? 'Failed to update role');
        throw err;
      }
    },
    [fetchRoles]
  );

  const fetchCurrentSession = useCallback(async () => {
    try {
      const data = await ipc<DaySession>(window.electronAPI.daySession.getCurrent());
      setCurrentSession(data ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load day session');
    }
  }, []);

  const openDaySession = useCallback(
    async (openingCash: number, openedBy: number, notes?: string): Promise<void> => {
      try {
        await ipc(
          window.electronAPI.daySession.open({ openingCash, openedBy, notes })
        );
        await fetchCurrentSession();
      } catch (err: any) {
        setError(err.message ?? 'Failed to open day session');
        throw err;
      }
    },
    [fetchCurrentSession]
  );

  const closeDaySession = useCallback(
    async (closingCash: number, closedBy: number, notes?: string): Promise<void> => {
      try {
        await ipc(
          window.electronAPI.daySession.close({ closingCash, closedBy, notes })
        );
        await fetchCurrentSession();
      } catch (err: any) {
        setError(err.message ?? 'Failed to close day session');
        throw err;
      }
    },
    [fetchCurrentSession]
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRestaurant(), fetchRoles(), fetchCurrentSession()]);
      setLoading(false);
    };
    init();
  }, [fetchRestaurant, fetchRoles, fetchCurrentSession]);

  return {
    restaurant,
    settings,
    roles,
    currentSession,
    loading,
    error,
    fetchRestaurant,
    updateRestaurant,
    getSetting,
    setSetting,
    fetchSettings,
    fetchRoles,
    updateRole,
    fetchCurrentSession,
    openDaySession,
    closeDaySession,
  };
}
