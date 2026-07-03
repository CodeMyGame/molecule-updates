import { useState, useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc';
import type { Customer, LoyaltyTransaction } from '../../shared/types/customer.types';

interface CreateCustomerDTO {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface UseCustomersReturn {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refetch: () => Promise<void>;
  createCustomer: (data: CreateCustomerDTO) => Promise<Customer>;
  updateCustomer: (id: number, data: UpdateCustomerDTO) => Promise<Customer>;
  getCustomerById: (id: number) => Promise<Customer>;
  searchCustomers: (query: string) => Promise<Customer[]>;
  getLoyaltyTransactions: (customerId: number) => Promise<LoyaltyTransaction[]>;
  addLoyaltyPoints: (customerId: number, points: number) => Promise<void>;
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<Customer[]>(window.electronAPI.customers.getAll());
      setCustomers(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const createCustomer = useCallback(
    async (data: CreateCustomerDTO): Promise<Customer> => {
      try {
        const customer = await ipc<Customer>(window.electronAPI.customers.create(data));
        await fetchCustomers();
        return customer;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create customer');
        throw err;
      }
    },
    [fetchCustomers]
  );

  const updateCustomer = useCallback(
    async (id: number, data: UpdateCustomerDTO): Promise<Customer> => {
      try {
        const customer = await ipc<Customer>(window.electronAPI.customers.update(id, data));
        await fetchCustomers();
        return customer;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update customer');
        throw err;
      }
    },
    [fetchCustomers]
  );

  const getCustomerById = useCallback(async (id: number): Promise<Customer> => {
    try {
      return await ipc<Customer>(window.electronAPI.customers.getById(id));
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch customer');
      throw err;
    }
  }, []);

  const searchCustomers = useCallback(async (query: string): Promise<Customer[]> => {
    try {
      return (await ipc<Customer[]>(window.electronAPI.customers.search(query))) ?? [];
    } catch (err: any) {
      setError(err.message ?? 'Failed to search customers');
      return [];
    }
  }, []);

  const getLoyaltyTransactions = useCallback(
    async (customerId: number): Promise<LoyaltyTransaction[]> => {
      try {
        return (
          (await ipc<LoyaltyTransaction[]>(
            window.electronAPI.customers.getLoyalty(customerId)
          )) ?? []
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to fetch loyalty transactions');
        return [];
      }
    },
    []
  );

  const addLoyaltyPoints = useCallback(
    async (customerId: number, points: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.customers.addLoyalty(customerId, points));
        await fetchCustomers();
      } catch (err: any) {
        setError(err.message ?? 'Failed to add loyalty points');
        throw err;
      }
    },
    [fetchCustomers]
  );

  return {
    customers: filteredCustomers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refetch: fetchCustomers,
    createCustomer,
    updateCustomer,
    getCustomerById,
    searchCustomers,
    getLoyaltyTransactions,
    addLoyaltyPoints,
  };
}
