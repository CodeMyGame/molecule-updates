import { StockTransactionType, POStatus } from '../enums';

export interface InventoryItem {
  id: number;
  name: string;
  sku?: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  category?: string;
  isActive: boolean;
}

export interface Recipe {
  id: number;
  menuItemId: number;
  inventoryItemId: number;
  quantityUsed: number;
  unit: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  status: POStatus;
  totalAmount: number;
  notes?: string;
  orderedAt?: string;
  receivedAt?: string;
  items: POItem[];
}

export interface POItem {
  id: number;
  poId: number;
  inventoryItemId: number;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

export interface StockTransaction {
  id: number;
  inventoryItemId: number;
  transactionType: StockTransactionType;
  quantity: number;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
  createdAt: string;
}
