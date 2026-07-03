import { useState, useEffect, useCallback } from 'react';
import { ipc } from '../lib/ipc';
import type {
  InventoryItem,
  Supplier,
  PurchaseOrder,
  POItem,
  StockTransaction,
  Recipe,
} from '../../shared/types/inventory.types';
import type { StockTransactionType } from '../../shared/enums';

// ---------- DTOs ----------

export interface CreateInventoryItemDTO {
  name: string;
  sku?: string;
  unit: string;
  currentStock?: number;
  minStock: number;
  costPerUnit: number;
  category?: string;
}

export interface UpdateInventoryItemDTO {
  name?: string;
  sku?: string;
  unit?: string;
  minStock?: number;
  costPerUnit?: number;
  category?: string;
  isActive?: boolean;
}

export interface StockAdjustmentDTO {
  quantity: number;
  transactionType: StockTransactionType;
  notes?: string;
}

export interface CreateSupplierDTO {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  isActive?: boolean;
}

export interface CreatePODTO {
  supplierId: number;
  notes?: string;
  items: { inventoryItemId: number; quantity: number; unitCost: number }[];
}

export interface ReceivePODTO {
  items: { poItemId: number; receivedQty: number }[];
}

export interface CreateRecipeDTO {
  menuItemId: number;
  inventoryItemId: number;
  quantityUsed: number;
  unit: string;
}

export interface UpdateRecipeDTO {
  quantityUsed?: number;
  unit?: string;
}

// ---------- Return type ----------

interface UseInventoryReturn {
  // Data
  items: InventoryItem[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  transactions: StockTransaction[];
  lowStockItems: InventoryItem[];
  loading: boolean;
  error: string | null;

  // Inventory CRUD
  fetchItems: () => Promise<void>;
  createItem: (data: CreateInventoryItemDTO) => Promise<InventoryItem>;
  updateItem: (id: number, data: UpdateInventoryItemDTO) => Promise<InventoryItem>;
  deleteItem: (id: number, data: UpdateInventoryItemDTO) => Promise<void>;
  adjustStock: (id: number, adjustment: StockAdjustmentDTO) => Promise<void>;
  getLowStock: () => Promise<InventoryItem[]>;
  getTransactions: (itemId?: number) => Promise<StockTransaction[]>;

  // Suppliers
  fetchSuppliers: () => Promise<void>;
  createSupplier: (data: CreateSupplierDTO) => Promise<Supplier>;
  updateSupplier: (id: number, data: UpdateSupplierDTO) => Promise<Supplier>;

  // Purchase Orders
  fetchPurchaseOrders: () => Promise<void>;
  createPurchaseOrder: (data: CreatePODTO) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (id: number, data: Partial<PurchaseOrder>) => Promise<PurchaseOrder>;
  receivePurchaseOrder: (id: number, data: ReceivePODTO) => Promise<PurchaseOrder>;

  // Recipes
  getRecipesByItem: (menuItemId: number) => Promise<Recipe[]>;
  createRecipe: (data: CreateRecipeDTO) => Promise<Recipe>;
  updateRecipe: (id: number, data: UpdateRecipeDTO) => Promise<Recipe>;
  deleteRecipe: (id: number) => Promise<void>;

  // Refresh all
  refetch: () => Promise<void>;
}

export function useInventory(): UseInventoryReturn {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Inventory items ----------

  const fetchItems = useCallback(async () => {
    try {
      const result = await ipc<InventoryItem[]>(window.electronAPI.inventory.getAll());
      setItems(result ?? []);
      const low = (result ?? []).filter((i) => i.currentStock <= i.minStock && i.isActive);
      setLowStockItems(low);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load inventory items');
    }
  }, []);

  const createItem = useCallback(
    async (data: CreateInventoryItemDTO): Promise<InventoryItem> => {
      try {
        const item = await ipc<InventoryItem>(window.electronAPI.inventory.create(data));
        await fetchItems();
        return item;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create inventory item');
        throw err;
      }
    },
    [fetchItems]
  );

  const updateItem = useCallback(
    async (id: number, data: UpdateInventoryItemDTO): Promise<InventoryItem> => {
      try {
        const item = await ipc<InventoryItem>(window.electronAPI.inventory.update(id, data));
        await fetchItems();
        return item;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update inventory item');
        throw err;
      }
    },
    [fetchItems]
  );

  const deleteItem = useCallback(
    async (id: number, _data: UpdateInventoryItemDTO): Promise<void> => {
      try {
        await ipc(window.electronAPI.inventory.update(id, { isActive: false }));
        await fetchItems();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete inventory item');
        throw err;
      }
    },
    [fetchItems]
  );

  const adjustStock = useCallback(
    async (id: number, adjustment: StockAdjustmentDTO): Promise<void> => {
      try {
        await ipc(window.electronAPI.inventory.adjustStock(id, adjustment));
        await fetchItems();
      } catch (err: any) {
        setError(err.message ?? 'Failed to adjust stock');
        throw err;
      }
    },
    [fetchItems]
  );

  const getLowStock = useCallback(async (): Promise<InventoryItem[]> => {
    try {
      const result = await ipc<InventoryItem[]>(window.electronAPI.inventory.getLowStock());
      const low = result ?? [];
      setLowStockItems(low);
      return low;
    } catch (err: any) {
      setError(err.message ?? 'Failed to get low stock items');
      return [];
    }
  }, []);

  const getTransactions = useCallback(async (itemId?: number): Promise<StockTransaction[]> => {
    try {
      const result = await ipc<StockTransaction[]>(
        window.electronAPI.inventory.getTransactions(itemId)
      );
      const txns = result ?? [];
      setTransactions(txns);
      return txns;
    } catch (err: any) {
      setError(err.message ?? 'Failed to get transactions');
      return [];
    }
  }, []);

  // ---------- Suppliers ----------

  const fetchSuppliers = useCallback(async () => {
    try {
      const result = await ipc<Supplier[]>(window.electronAPI.suppliers.getAll());
      setSuppliers(result ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load suppliers');
    }
  }, []);

  const createSupplier = useCallback(
    async (data: CreateSupplierDTO): Promise<Supplier> => {
      try {
        const supplier = await ipc<Supplier>(window.electronAPI.suppliers.create(data));
        await fetchSuppliers();
        return supplier;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create supplier');
        throw err;
      }
    },
    [fetchSuppliers]
  );

  const updateSupplier = useCallback(
    async (id: number, data: UpdateSupplierDTO): Promise<Supplier> => {
      try {
        const supplier = await ipc<Supplier>(window.electronAPI.suppliers.update(id, data));
        await fetchSuppliers();
        return supplier;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update supplier');
        throw err;
      }
    },
    [fetchSuppliers]
  );

  // ---------- Purchase Orders ----------

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const result = await ipc<PurchaseOrder[]>(window.electronAPI.purchaseOrders.getAll());
      setPurchaseOrders(result ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load purchase orders');
    }
  }, []);

  const createPurchaseOrder = useCallback(
    async (data: CreatePODTO): Promise<PurchaseOrder> => {
      try {
        const po = await ipc<PurchaseOrder>(window.electronAPI.purchaseOrders.create(data));
        await fetchPurchaseOrders();
        return po;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create purchase order');
        throw err;
      }
    },
    [fetchPurchaseOrders]
  );

  const updatePurchaseOrder = useCallback(
    async (id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
      try {
        const po = await ipc<PurchaseOrder>(window.electronAPI.purchaseOrders.update(id, data));
        await fetchPurchaseOrders();
        return po;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update purchase order');
        throw err;
      }
    },
    [fetchPurchaseOrders]
  );

  const receivePurchaseOrder = useCallback(
    async (id: number, data: ReceivePODTO): Promise<PurchaseOrder> => {
      try {
        const po = await ipc<PurchaseOrder>(window.electronAPI.purchaseOrders.receive(id, data));
        await Promise.all([fetchPurchaseOrders(), fetchItems()]);
        return po;
      } catch (err: any) {
        setError(err.message ?? 'Failed to receive purchase order');
        throw err;
      }
    },
    [fetchPurchaseOrders, fetchItems]
  );

  // ---------- Recipes ----------

  const getRecipesByItem = useCallback(async (menuItemId: number): Promise<Recipe[]> => {
    try {
      const result = await ipc<Recipe[]>(window.electronAPI.recipes.getByItem(menuItemId));
      return result ?? [];
    } catch (err: any) {
      setError(err.message ?? 'Failed to get recipes');
      return [];
    }
  }, []);

  const createRecipe = useCallback(async (data: CreateRecipeDTO): Promise<Recipe> => {
    try {
      return await ipc<Recipe>(window.electronAPI.recipes.create(data));
    } catch (err: any) {
      setError(err.message ?? 'Failed to create recipe');
      throw err;
    }
  }, []);

  const updateRecipe = useCallback(async (id: number, data: UpdateRecipeDTO): Promise<Recipe> => {
    try {
      return await ipc<Recipe>(window.electronAPI.recipes.update(id, data));
    } catch (err: any) {
      setError(err.message ?? 'Failed to update recipe');
      throw err;
    }
  }, []);

  const deleteRecipe = useCallback(async (id: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.recipes.delete(id));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete recipe');
      throw err;
    }
  }, []);

  // ---------- Fetch all on mount ----------

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchItems(), fetchSuppliers(), fetchPurchaseOrders()]);
    } catch {
      // individual errors are already handled
    } finally {
      setLoading(false);
    }
  }, [fetchItems, fetchSuppliers, fetchPurchaseOrders]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    items,
    suppliers,
    purchaseOrders,
    transactions,
    lowStockItems,
    loading,
    error,

    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    adjustStock,
    getLowStock,
    getTransactions,

    fetchSuppliers,
    createSupplier,
    updateSupplier,

    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    receivePurchaseOrder,

    getRecipesByItem,
    createRecipe,
    updateRecipe,
    deleteRecipe,

    refetch,
  };
}
