import { create } from 'zustand';
import { ipc } from '../lib/ipc';

interface MenuItem {
  id: number;
  name: string;
  basePrice: number; // in paise
  categoryId: number;
  taxRate: number;
  isVeg: boolean;
}

interface Variation {
  id: number;
  name: string;
  priceDelta: number; // in paise
}

interface Addon {
  id: number;
  name: string;
  price: number; // in paise
}

export interface CartItem {
  menuItem: MenuItem;
  variation?: Variation;
  addons: Addon[];
  quantity: number;
  notes?: string;
  unitPrice: number; // in paise (variation price or item price + addons)
  total: number; // unitPrice * quantity, in paise
  orderItemId?: number; // DB id of order_items row, set when item was loaded from an existing order
  sourceTableName?: string;
  kotNumber?: string;
  kotStatus?: string;
  createdAt?: string;
}

export interface OutboundTransferEvent {
  targetTableName: string;
  items: { name: string; quantity: number }[];
  timestamp?: number;
}

export interface KotSummary {
  id: number;
  kotNumber: string;
  station?: string;
  status?: string;
  printedAt?: string;
  createdAt?: string;
}

type OrderType = 'dine_in' | 'takeaway' | 'delivery';

interface DiscountInfo {
  type: 'percent' | 'flat';
  value: number; // percent (0-100) or flat amount in paise
  reason?: string;
}

interface TaxBreakdownItem {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  total: number;
}

interface BillingState {
  cart: CartItem[];
  currentOrderId: number | null;
  syncedItemCount: number; // how many cart items have been saved to the DB order
  syncedQuantities: number[]; // quantity of each synced item at the time of last sync
  kots: KotSummary[];
  orderType: OrderType;
  selectedTableId: number | null;
  selectedCustomerId: number | null;
  orderStatus: 'active' | 'hold';
  discount: DiscountInfo | null;
  notes: string;
  outboundTransfers: Record<number, OutboundTransferEvent[]>;
  splitFromOrderId: number | null;
  splitFromOrderNumber: string | null;
  showKotSeparators: boolean;

  // Actions
  setShowKotSeparators: (show: boolean) => void;
  toggleKotSeparators: () => void;
  recordOutboundTransfer: (orderId: number, event: OutboundTransferEvent) => void;
  addToCart: (item: MenuItem, variation?: Variation, addons?: Addon[]) => void;
  addTempItemToCart: (name: string, priceInPaise: number, taxRate: number) => void;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  incrementQuantity: (index: number, delta: number) => void;
  updateItemNotes: (index: number, notes: string) => void;
  setOrderType: (type: OrderType) => void;
  setTable: (tableId: number | null) => void;
  setKots: (kots: KotSummary[]) => void;
  setOrderStatus: (status: 'active' | 'hold') => void;
  loadOrderIntoCart: (orderId: number, tableId: number | null, items: CartItem[], syncedCount: number, orderType?: OrderType, discount?: DiscountInfo | null, notes?: string, kots?: KotSummary[], outboundTransfersList?: OutboundTransferEvent[], splitInfo?: { splitFromOrderId?: number | null; splitFromOrderNumber?: string | null } | null, orderStatus?: 'active' | 'hold', customerId?: number | null) => void;
  resetForNewTable: (tableId: number) => void;
  setCustomer: (customerId: number | null) => void;
  applyDiscount: (discount: DiscountInfo | null) => void;
  setNotes: (notes: string) => void;
  setCurrentOrderId: (orderId: number | null) => void;
  markItemsSynced: () => void;
  syncOrderItemIds: (orderItems: { id: number; menuItemId: number; name: string }[]) => void;
  clearCart: () => void;

  // Computed getters
  getSubtotal: () => number;
  getTaxBreakdown: () => TaxBreakdownItem[];
  getDiscountAmount: () => number;
  getRoundOff: () => number;
  getGrandTotal: () => number;
}

function getInitialKotSeparators(): boolean {
  try {
    return localStorage.getItem('show_kot_separators') === 'true';
  } catch {
    return false;
  }
}

function calculateUnitPrice(item: MenuItem, variation?: Variation, addons?: Addon[]): number {
  const basePrice = variation ? item.basePrice + variation.priceDelta : item.basePrice;
  const addonsTotal = (addons ?? []).reduce((sum, a) => sum + a.price, 0);
  return basePrice + addonsTotal;
}

interface CartCalculations {
  subtotal: number;
  discountAmount: number;
  taxBreakdown: TaxBreakdownItem[];
  roundOff: number;
  grandTotal: number;
}

let lastCartRef: CartItem[] | null = null;
let lastDiscountRef: DiscountInfo | null = null;
let cachedCalc: CartCalculations | null = null;

function computeCartTotals(cart: CartItem[], discount: DiscountInfo | null): CartCalculations {
  if (cachedCalc && lastCartRef === cart && lastDiscountRef === discount) {
    return cachedCalc;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percent') {
      const clampedPercent = Math.min(discount.value, 100);
      discountAmount = Math.round((subtotal * clampedPercent) / 100);
    } else {
      discountAmount = Math.min(discount.value, subtotal);
    }
  }

  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  const taxMap = new Map<number, number>();
  for (const item of cart) {
    const rate = item.menuItem.taxRate;
    const current = taxMap.get(rate) ?? 0;
    const discountedAmount = Math.round(item.total * (1 - discountRatio));
    taxMap.set(rate, current + discountedAmount);
  }

  const taxBreakdown: TaxBreakdownItem[] = [];
  let totalTax = 0;
  for (const [rate, taxableAmount] of taxMap) {
    const taxAmount = Math.round((taxableAmount * rate) / 100);
    const cgst = Math.round(taxAmount / 2);
    const sgst = taxAmount - cgst;
    totalTax += taxAmount;
    taxBreakdown.push({
      rate,
      taxableAmount,
      cgst,
      sgst,
      total: taxAmount,
    });
  }
  taxBreakdown.sort((a, b) => a.rate - b.rate);

  const rawTotal = subtotal - discountAmount + totalTax;
  const roundOff = Math.round(rawTotal / 100) * 100 - rawTotal;
  const grandTotal = rawTotal + roundOff;

  lastCartRef = cart;
  lastDiscountRef = discount;
  cachedCalc = {
    subtotal,
    discountAmount,
    taxBreakdown,
    roundOff,
    grandTotal,
  };

  return cachedCalc;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  cart: [],
  currentOrderId: null,
  syncedItemCount: 0,
  syncedQuantities: [],
  kots: [],
  orderType: 'dine_in',
  selectedTableId: null,
  selectedCustomerId: null,
  orderStatus: 'active',
  discount: null,
  notes: '',
  outboundTransfers: {},
  splitFromOrderId: null,
  splitFromOrderNumber: null,
  showKotSeparators: getInitialKotSeparators(),

  setShowKotSeparators: (show: boolean) => {
    try {
      localStorage.setItem('show_kot_separators', String(show));
    } catch { /* ignore */ }
    set({ showKotSeparators: show });
  },

  toggleKotSeparators: () => {
    const nextVal = !get().showKotSeparators;
    try {
      localStorage.setItem('show_kot_separators', String(nextVal));
    } catch { /* ignore */ }
    if (window.electronAPI?.settings?.set) {
      ipc(window.electronAPI.settings.set('show_kot_separators', String(nextVal), 'billing')).catch(() => {});
    }
    set({ showKotSeparators: nextVal });
  },

  recordOutboundTransfer: (orderId: number, event: OutboundTransferEvent) => {
    set((state) => {
      const existing = state.outboundTransfers[orderId] || [];
      return {
        outboundTransfers: {
          ...state.outboundTransfers,
          [orderId]: [...existing, event],
        },
      };
    });
  },

  addToCart: (item: MenuItem, variation?: Variation, addons?: Addon[]) => {
    const unitPrice = calculateUnitPrice(item, variation, addons);
    const addonList = addons ?? [];

    set((state) => {
      // Check if an identical item already exists in the unsent/pending batch
      const existingIndex = state.cart.findIndex((c, idx) => {
        // Do NOT merge into items that belong to a sent KOT or are already synced
        if (c.kotNumber || idx < state.syncedItemCount) return false;
        if (c.menuItem.id !== item.id) return false;
        if ((c.variation?.id ?? null) !== (variation?.id ?? null)) return false;
        if (c.addons.length !== addonList.length) return false;
        const existingIds = c.addons.map((a) => a.id).sort();
        const newIds = addonList.map((a) => a.id).sort();
        return existingIds.every((id, i) => id === newIds[i]);
      });

      if (existingIndex >= 0) {
        // Merge: increment quantity
        return {
          cart: state.cart.map((c, i) =>
            i === existingIndex
              ? { ...c, quantity: c.quantity + 1, total: c.unitPrice * (c.quantity + 1) }
              : c
          ),
        };
      }

      // New unique item
      return {
        cart: [...state.cart, {
          menuItem: item,
          variation,
          addons: addonList,
          quantity: 1,
          unitPrice,
          total: unitPrice,
        }],
      };
    });
  },

  addTempItemToCart: (name: string, priceInPaise: number, taxRate: number) => {
    set((state) => ({
      cart: [...state.cart, {
        menuItem: { id: 0, name, basePrice: priceInPaise, categoryId: 0, taxRate, isVeg: true },
        addons: [],
        quantity: 1,
        unitPrice: priceInPaise,
        total: priceInPaise,
      }],
    }));
  },

  removeFromCart: (index: number) => {
    set((state) => ({
      cart: state.cart.filter((_, i) => i !== index),
      // If removing a synced item, adjust syncedItemCount so KOT tracking stays correct
      syncedItemCount: index < state.syncedItemCount
        ? state.syncedItemCount - 1
        : state.syncedItemCount,
      syncedQuantities: state.syncedQuantities.filter((_, i) => i !== index),
    }));
  },

  updateQuantity: (index: number, quantity: number) => {
    if (quantity < 1) return;
    set((state) => ({
      cart: state.cart.map((item, i) =>
        i === index
          ? { ...item, quantity, total: item.unitPrice * quantity }
          : item
      ),
    }));
  },

  incrementQuantity: (index: number, delta: number) => {
    set((state) => {
      const item = state.cart[index];
      if (!item) return state;
      const newQty = item.quantity + delta;
      if (newQty < 1) return state;
      return {
        cart: state.cart.map((c, i) =>
          i === index
            ? { ...c, quantity: newQty, total: c.unitPrice * newQty }
            : c
        ),
      };
    });
  },

  updateItemNotes: (index: number, notes: string) => {
    set((state) => ({
      cart: state.cart.map((item, i) =>
        i === index ? { ...item, notes } : item
      ),
    }));
  },

  setOrderType: (type: OrderType) =>
    set({
      orderType: type,
      ...(type !== 'dine_in' ? { selectedTableId: null } : {}),
    }),

  setTable: (tableId: number | null) => set({ selectedTableId: tableId }),

  setKots: (kots: KotSummary[]) => set({ kots }),

  setOrderStatus: (status: 'active' | 'hold') => set({ orderStatus: status }),

  loadOrderIntoCart: (orderId: number, tableId: number | null, items: CartItem[], syncedCount: number, orderType?: OrderType, discount?: DiscountInfo | null, notes?: string, kots?: KotSummary[], outboundTransfersList?: OutboundTransferEvent[], splitInfo?: { splitFromOrderId?: number | null; splitFromOrderNumber?: string | null } | null, orderStatus?: 'active' | 'hold', customerId?: number | null) =>
    set((state) => ({
      cart: items,
      currentOrderId: orderId,
      orderStatus: orderStatus ?? 'active',
      selectedCustomerId: customerId !== undefined ? customerId : state.selectedCustomerId,
      syncedItemCount: syncedCount,
      syncedQuantities: items.slice(0, syncedCount).map((i) => i.quantity),
      kots: kots ?? [],
      selectedTableId: (orderType && orderType !== 'dine_in') ? null : tableId,
      orderType: orderType ?? 'dine_in',
      discount: discount !== undefined ? discount : state.discount,
      notes: notes ?? '',
      splitFromOrderId: splitInfo?.splitFromOrderId ?? null,
      splitFromOrderNumber: splitInfo?.splitFromOrderNumber ?? null,
      outboundTransfers: {
        ...state.outboundTransfers,
        [orderId]: outboundTransfersList ?? [],
      },
    })),

  resetForNewTable: (tableId: number) =>
    set({
      cart: [],
      currentOrderId: null,
      orderStatus: 'active',
      syncedItemCount: 0,
      syncedQuantities: [],
      kots: [],
      selectedTableId: tableId,
      orderType: 'dine_in',
      selectedCustomerId: null,
      discount: null,
      notes: '',
      splitFromOrderId: null,
      splitFromOrderNumber: null,
    }),

  setCustomer: (customerId: number | null) => set({ selectedCustomerId: customerId }),

  applyDiscount: (discount: DiscountInfo | null) => set({ discount }),

  setNotes: (notes: string) => set({ notes }),

  setCurrentOrderId: (orderId: number | null) => set({ currentOrderId: orderId }),

  markItemsSynced: () => set((state) => ({
    syncedItemCount: state.cart.length,
    syncedQuantities: state.cart.map((i) => i.quantity),
  })),

  syncOrderItemIds: (orderItems) => set((state) => {
    // Match DB order items to cart items by position (order of creation matches cart order)
    // For items that don't have an orderItemId yet, assign from the DB items
    const usedIds = new Set<number>();
    const updatedCart = state.cart.map((cartItem) => {
      if (cartItem.orderItemId) {
        usedIds.add(cartItem.orderItemId);
        return cartItem;
      }
      // Find a matching DB item not yet assigned
      const match = orderItems.find((oi) =>
        !usedIds.has(oi.id) &&
        (oi.menuItemId === cartItem.menuItem.id || oi.name.startsWith(cartItem.menuItem.name))
      );
      if (match) {
        usedIds.add(match.id);
        return { ...cartItem, orderItemId: match.id };
      }
      return cartItem;
    });
    return { cart: updatedCart };
  }),

  clearCart: () =>
    set({
      cart: [],
      currentOrderId: null,
      orderStatus: 'active',
      syncedItemCount: 0,
      syncedQuantities: [],
      kots: [],
      orderType: 'dine_in',
      selectedTableId: null,
      selectedCustomerId: null,
      discount: null,
      notes: '',
      splitFromOrderId: null,
      splitFromOrderNumber: null,
    }),

  getSubtotal: () => {
    const { cart, discount } = get();
    return computeCartTotals(cart, discount).subtotal;
  },

  getTaxBreakdown: () => {
    const { cart, discount } = get();
    return computeCartTotals(cart, discount).taxBreakdown;
  },

  getDiscountAmount: () => {
    const { cart, discount } = get();
    return computeCartTotals(cart, discount).discountAmount;
  },

  getRoundOff: () => {
    const { cart, discount } = get();
    return computeCartTotals(cart, discount).roundOff;
  },

  getGrandTotal: () => {
    const { cart, discount } = get();
    return computeCartTotals(cart, discount).grandTotal;
  },
}));
