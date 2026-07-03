import { OrderType, OrderStatus, KOTStatus } from '../enums';

export interface Order {
  id: number;
  orderNumber: string;
  orderType: OrderType;
  tableId?: number;
  tableName?: string;
  customerId?: number;
  staffId: number;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  discountType?: 'percentage' | 'flat';
  discountValue: number;
  discountReason?: string;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  notes?: string;
  mergedIntoOrderId?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  menuItemId?: number;
  comboId?: number;
  variationId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  kotStatus: KOTStatus;
  kotNumber?: string;
  station?: string;
  createdAt: string;
  addons: OrderItemAddon[];
}

export interface OrderItemAddon {
  id: number;
  orderItemId: number;
  addonId: number;
  name: string;
  price: number;
}

export interface CreateOrderDTO {
  orderType: OrderType;
  tableId?: number;
  customerId?: number;
  staffId: number;
  items: CartItem[];
  notes?: string;
}

export interface CartItem {
  menuItemId?: number;
  comboId?: number;
  variationId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  notes?: string;
  addonIds?: number[];
}

export interface TaxBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  slabs: { rate: number; taxableAmount: number; cgst: number; sgst: number }[];
}
