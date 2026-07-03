import { create } from 'zustand';

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

interface CartItem {
  menuItem: MenuItem;
  variation?: Variation;
  addons: Addon[];
  quantity: number;
  notes?: string;
  unitPrice: number; // in paise (variation price or item price + addons)
  total: number; // unitPrice * quantity, in paise
  orderItemId?: number; // DB id of order_items row, set when item was loaded from an existing order
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
  orderType: OrderType;
  selectedTableId: number | null;
  selectedCustomerId: number | null;
  discount: DiscountInfo | null;
  notes: string;

  // Actions
  addToCart: (item: MenuItem, variation?: Variation, addons?: Addon[]) => void;
  addTempItemToCart: (name: string, priceInPaise: number, taxRate: number) => void;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  updateItemNotes: (index: number, notes: string) => void;
  setOrderType: (type: OrderType) => void;
  setTable: (tableId: number | null) => void;
  loadOrderIntoCart: (orderId: number, tableId: number | null, items: CartItem[], syncedCount: number, orderType?: OrderType, discount?: DiscountInfo | null, notes?: string) => void;
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

function calculateUnitPrice(item: MenuItem, variation?: Variation, addons?: Addon[]): number {
  const basePrice = variation ? item.basePrice + variation.priceDelta : item.basePrice;
  const addonsTotal = (addons ?? []).reduce((sum, a) => sum + a.price, 0);
  return basePrice + addonsTotal;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  cart: [],
  currentOrderId: null,
  syncedItemCount: 0,
  syncedQuantities: [],
  orderType: 'dine_in',
  selectedTableId: null,
  selectedCustomerId: null,
  discount: null,
  notes: '',

  addToCart: (item: MenuItem, variation?: Variation, addons?: Addon[]) => {
    const unitPrice = calculateUnitPrice(item, variation, addons);
    const addonList = addons ?? [];

    set((state) => {
      // Check if an identical item already exists in the cart (same item, variation, addons)
      const existingIndex = state.cart.findIndex((c) => {
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

  updateItemNotes: (index: number, notes: string) => {
    set((state) => ({
      cart: state.cart.map((item, i) =>
        i === index ? { ...item, notes } : item
      ),
    }));
  },

  setOrderType: (type: OrderType) => set({ orderType: type }),

  setTable: (tableId: number | null) => set({ selectedTableId: tableId }),

  loadOrderIntoCart: (orderId: number, tableId: number | null, items: CartItem[], syncedCount: number, orderType?: OrderType, discount?: DiscountInfo | null, notes?: string) =>
    set({
      cart: items,
      currentOrderId: orderId,
      syncedItemCount: syncedCount,
      syncedQuantities: items.slice(0, syncedCount).map((i) => i.quantity),
      selectedTableId: tableId,
      orderType: orderType ?? 'dine_in',
      discount: discount ?? null,
      notes: notes ?? '',
    }),

  resetForNewTable: (tableId: number) =>
    set({
      cart: [],
      currentOrderId: null,
      syncedItemCount: 0,
      syncedQuantities: [],
      selectedTableId: tableId,
      orderType: 'dine_in',
      selectedCustomerId: null,
      discount: null,
      notes: '',
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
      syncedItemCount: 0,
      syncedQuantities: [],
      orderType: 'dine_in',
      selectedTableId: null,
      selectedCustomerId: null,
      discount: null,
      notes: '',
    }),

  getSubtotal: () => {
    return get().cart.reduce((sum, item) => sum + item.total, 0);
  },

  getTaxBreakdown: () => {
    const { cart } = get();
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = get().getDiscountAmount();
    // Proportionally reduce each item's taxable base by the discount ratio
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

    const taxMap = new Map<number, number>();
    for (const item of cart) {
      const rate = item.menuItem.taxRate;
      const current = taxMap.get(rate) ?? 0;
      const discountedAmount = Math.round(item.total * (1 - discountRatio));
      taxMap.set(rate, current + discountedAmount);
    }

    const breakdown: TaxBreakdownItem[] = [];
    for (const [rate, taxableAmount] of taxMap) {
      const taxAmount = Math.round((taxableAmount * rate) / 100);
      const cgst = Math.round(taxAmount / 2);
      const sgst = taxAmount - cgst;
      breakdown.push({
        rate,
        taxableAmount,
        cgst,
        sgst,
        total: taxAmount,
      });
    }

    return breakdown.sort((a, b) => a.rate - b.rate);
  },

  getDiscountAmount: () => {
    const { discount } = get();
    if (!discount) return 0;

    const subtotal = get().getSubtotal();

    if (discount.type === 'percent') {
      const clampedPercent = Math.min(discount.value, 100);
      return Math.round((subtotal * clampedPercent) / 100);
    }
    return Math.min(discount.value, subtotal);
  },

  getRoundOff: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    const taxBreakdown = get().getTaxBreakdown();
    const totalTax = taxBreakdown.reduce((sum, t) => sum + t.total, 0);
    const rawTotal = subtotal - discountAmount + totalTax;
    return Math.round(rawTotal / 100) * 100 - rawTotal;
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    const taxBreakdown = get().getTaxBreakdown();
    const totalTax = taxBreakdown.reduce((sum, t) => sum + t.total, 0);
    const rawTotal = subtotal - discountAmount + totalTax;
    const roundOff = Math.round(rawTotal / 100) * 100 - rawTotal;
    return rawTotal + roundOff;
  },
}));
