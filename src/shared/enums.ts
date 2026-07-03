export enum OrderType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
  DELIVERY = 'delivery',
}

export enum OrderStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  MERGED = 'merged',
  HOLD = 'hold',
}

export enum PaymentMode {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  WALLET = 'wallet',
  CREDIT = 'credit',
}

export enum TableStatus {
  FREE = 'free',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  DIRTY = 'dirty',
}

export enum KOTStatus {
  PENDING = 'pending',
  SENT = 'sent',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
}

export enum StaffRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  CHEF = 'chef',
}

export enum StockTransactionType {
  PURCHASE = 'purchase',
  CONSUMPTION = 'consumption',
  WASTAGE = 'wastage',
  ADJUSTMENT = 'adjustment',
}

export enum POStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export enum DaySessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}
