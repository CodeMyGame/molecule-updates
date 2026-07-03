import { useState, useEffect, useCallback, useMemo } from 'react';
import { ipc } from '../lib/ipc';
import { TableStatus } from '../../shared/enums';
import type { Table, Floor, CreateTableDTO, UpdateTableDTO } from '../../shared/types/table.types';

interface UseTablesReturn {
  floors: Floor[];
  tables: Table[];
  tablesByFloor: (floorId: number) => Table[];
  loading: boolean;
  error: string | null;
  createTable: (data: CreateTableDTO) => Promise<Table>;
  updateTable: (data: UpdateTableDTO) => Promise<Table>;
  deleteTable: (id: number) => Promise<void>;
  updateTableStatus: (id: number, status: TableStatus) => Promise<void>;
  createFloor: (name: string) => Promise<Floor>;
  updateFloor: (id: number, name: string) => Promise<Floor>;
  deleteFloor: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTables(): UseTablesReturn {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [floorData, tableData] = await Promise.all([
        ipc<Floor[]>(window.electronAPI.tables.getFloors()),
        ipc<Table[]>(window.electronAPI.tables.getAll()),
      ]);
      setFloors(floorData ?? []);
      setTables(tableData ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tablesByFloor = useCallback(
    (floorId: number) => tables.filter((t) => t.floorId === floorId),
    [tables]
  );

  const createTable = useCallback(
    async (data: CreateTableDTO): Promise<Table> => {
      try {
        const table = await ipc<Table>(window.electronAPI.tables.create(data));
        await fetchData();
        return table;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create table');
        throw err;
      }
    },
    [fetchData]
  );

  const updateTable = useCallback(
    async (data: UpdateTableDTO): Promise<Table> => {
      try {
        const { id, ...rest } = data;
        const table = await ipc<Table>(window.electronAPI.tables.update(id, rest));
        await fetchData();
        return table;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update table');
        throw err;
      }
    },
    [fetchData]
  );

  const deleteTable = useCallback(
    async (id: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.tables.delete(id));
        await fetchData();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete table');
        throw err;
      }
    },
    [fetchData]
  );

  const updateTableStatus = useCallback(
    async (id: number, status: TableStatus): Promise<void> => {
      try {
        await ipc(window.electronAPI.tables.updateStatus(id, status));
        setTables((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status } : t))
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to update table status');
        throw err;
      }
    },
    []
  );

  const createFloor = useCallback(
    async (name: string): Promise<Floor> => {
      try {
        const floor = await ipc<Floor>(window.electronAPI.tables.createFloor(name));
        await fetchData();
        return floor;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create floor');
        throw err;
      }
    },
    [fetchData]
  );

  const updateFloor = useCallback(
    async (id: number, name: string): Promise<Floor> => {
      try {
        const floor = await ipc<Floor>(window.electronAPI.tables.updateFloor(id, name));
        await fetchData();
        return floor;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update floor');
        throw err;
      }
    },
    [fetchData]
  );

  const deleteFloor = useCallback(
    async (id: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.tables.deleteFloor(id));
        await fetchData();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete floor');
        throw err;
      }
    },
    [fetchData]
  );

  return {
    floors,
    tables,
    tablesByFloor,
    loading,
    error,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus,
    createFloor,
    updateFloor,
    deleteFloor,
    refetch: fetchData,
  };
}
