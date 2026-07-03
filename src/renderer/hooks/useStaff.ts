import { useState, useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc';
import type { Staff, Role, Attendance, CreateStaffDTO } from '../../shared/types/staff.types';

interface UpdateStaffDTO {
  name?: string;
  phone?: string;
  email?: string;
  pin?: string;
  roleId?: number;
  isActive?: boolean;
  hourlyRate?: number;
}

interface UseStaffReturn {
  staff: Staff[];
  roles: Role[];
  attendance: Attendance[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Staff CRUD
  createStaff: (data: CreateStaffDTO) => Promise<Staff>;
  updateStaff: (id: number, data: UpdateStaffDTO) => Promise<Staff>;
  deleteStaff: (id: number) => Promise<void>;
  toggleActive: (id: number, isActive: boolean) => Promise<void>;
  // Attendance
  clockIn: (staffId: number) => Promise<void>;
  clockOut: (staffId: number) => Promise<void>;
  fetchAttendance: (staffId?: number, date?: string) => Promise<void>;
  // Roles
  fetchRoles: () => Promise<void>;
  updateRole: (id: number, data: Partial<Role>) => Promise<void>;
}

export function useStaff(): UseStaffReturn {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<Staff[]>(window.electronAPI.staff.getAll());
      setStaff(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load staff');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchStaff();
    fetchRoles();
  }, [fetchStaff, fetchRoles]);

  const createStaff = useCallback(
    async (data: CreateStaffDTO): Promise<Staff> => {
      try {
        const s = await ipc<Staff>(window.electronAPI.staff.create(data));
        await fetchStaff();
        return s;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create staff');
        throw err;
      }
    },
    [fetchStaff]
  );

  const updateStaff = useCallback(
    async (id: number, data: UpdateStaffDTO): Promise<Staff> => {
      try {
        const s = await ipc<Staff>(window.electronAPI.staff.update(id, data));
        await fetchStaff();
        return s;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update staff');
        throw err;
      }
    },
    [fetchStaff]
  );

  const deleteStaff = useCallback(
    async (id: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.staff.delete(id));
        await fetchStaff();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete staff');
        throw err;
      }
    },
    [fetchStaff]
  );

  const toggleActive = useCallback(
    async (id: number, isActive: boolean): Promise<void> => {
      try {
        await ipc(window.electronAPI.staff.update(id, { isActive }));
        setStaff((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive } : s))
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to toggle staff status');
        throw err;
      }
    },
    []
  );

  const clockIn = useCallback(
    async (staffId: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.staff.clockIn(staffId));
      } catch (err: any) {
        setError(err.message ?? 'Failed to clock in');
        throw err;
      }
    },
    []
  );

  const clockOut = useCallback(
    async (staffId: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.staff.clockOut(staffId));
      } catch (err: any) {
        setError(err.message ?? 'Failed to clock out');
        throw err;
      }
    },
    []
  );

  const fetchAttendance = useCallback(
    async (staffId?: number, date?: string): Promise<void> => {
      try {
        const data = await ipc<Attendance[]>(
          window.electronAPI.staff.getAttendance(staffId, date ? { date } : undefined)
        );
        setAttendance(data ?? []);
      } catch (err: any) {
        setError(err.message ?? 'Failed to fetch attendance');
      }
    },
    []
  );

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

  return {
    staff,
    roles,
    attendance,
    loading,
    error,
    refetch: fetchStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    toggleActive,
    clockIn,
    clockOut,
    fetchAttendance,
    fetchRoles,
    updateRole,
  };
}
