import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { ipc } from '../lib/ipc';
import { useBillingStore } from '../stores/billing.store';
import { useAuthStore } from '../stores/auth.store';

export interface Order {
  id: number;
  order_number: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  status: 'active' | 'completed' | 'cancelled' | 'hold';
  table_id: number | null;
  customer_id: number | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  menu_item_id: number;
  menu_item_name: string;
  variation_name?: string;
  quantity: number;
  unit_price: number;
  total: number;
  addons: { name: string; price: number }[];
  notes?: string;
}

interface PaymentData {
  order_id: number;
  payments: {
    mode: string;
    amount: number;
    reference?: string;
  }[];
  tip?: number;
  customer?: { phone: string };
}

interface UseOrdersReturn {
  activeOrders: Order[];
  loading: boolean;
  error: string | null;
  fetchActiveOrders: () => Promise<void>;
  createOrder: () => Promise<Order>;
  holdOrder: () => Promise<void>;
  cancelOrder: (orderId: number) => Promise<void>;
  completePayment: (data: PaymentData) => Promise<void>;
  printKot: (orderId?: number, shouldPrint?: boolean) => Promise<void>;
}

export function useOrders(): UseOrdersReturn {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kotPending = useRef(false);

  const billingStore = useBillingStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const fetchActiveOrders = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await ipc<Order[]>(window.electronAPI.orders.getActive());
      setActiveOrders(orders ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(async (): Promise<Order> => {
    const { cart, orderType, selectedTableId, selectedCustomerId, discount, notes } = billingStore;

    const orderData = {
      orderType: orderType,
      tableId: selectedTableId,
      customerId: selectedCustomerId,
      staffId: (() => {
        if (!currentUser?.id) throw new Error('No staff logged in. Please log in first.');
        return currentUser.id;
      })(),
      notes,
      discount: discount
        ? { type: discount.type, value: discount.value, reason: discount.reason }
        : null,
      items: cart.map((item) => ({
        menuItemId: item.menuItem.id || null, // 0 = temp item → null
        variationId: item.variation?.id ?? null,
        addonIds: item.addons.map((a) => a.id),
        name: item.menuItem.name + (item.variation ? ` (${item.variation.name})` : ''),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.menuItem.taxRate,
        notes: item.notes ?? '',
      })),
    };

    const order = await ipc<Order>(window.electronAPI.orders.create(orderData));
    billingStore.setCurrentOrderId(order.id);
    billingStore.markItemsSynced();
    // Fetch full order to get orderItemIds for each cart item
    try {
      const fullOrder = await ipc<any>(window.electronAPI.orders.getById(order.id));
      if (fullOrder?.items) {
        billingStore.syncOrderItemIds(fullOrder.items.map((oi: any) => ({
          id: oi.id,
          menuItemId: oi.menuItemId ?? oi.menu_item_id,
          name: oi.name ?? '',
        })));
      }
    } catch { /* ignore — IDs will be set on next load */ }
    return order;
  }, [billingStore]);

  const holdOrder = useCallback(async () => {
    try {
      let orderId = billingStore.currentOrderId;

      if (!orderId) {
        const order = await createOrder();
        orderId = order.id;
      }

      await ipc(window.electronAPI.orders.updateStatus(orderId!, 'hold'));
      billingStore.clearCart();
      await fetchActiveOrders();
    } catch (err: any) {
      setError(err.message ?? 'Failed to hold order');
      throw err;
    }
  }, [billingStore, createOrder, fetchActiveOrders]);

  const cancelOrder = useCallback(
    async (orderId: number) => {
      try {
        await ipc(window.electronAPI.orders.updateStatus(orderId, 'cancelled'));
        billingStore.clearCart();
        await fetchActiveOrders();
      } catch (err: any) {
        setError(err.message ?? 'Failed to cancel order');
        throw err;
      }
    },
    [billingStore, fetchActiveOrders]
  );

  const completePayment = useCallback(
    async (data: PaymentData) => {
      try {
        // Backend atomically creates payment + marks order completed + frees table
        await ipc(window.electronAPI.payments.create(data));
        await fetchActiveOrders();
      } catch (err: any) {
        setError(err.message ?? 'Payment failed');
        throw err;
      }
    },
    [billingStore, fetchActiveOrders]
  );

  const printKot = useCallback(
    async (orderId?: number, shouldPrint: boolean = false) => {
      if (kotPending.current) return;
      kotPending.current = true;
      try {
        let id = orderId ?? billingStore.currentOrderId;

        if (!id) {
          // First KOT — create the order (which saves all current cart items)
          // createOrder() already calls markItemsSynced() internally
          const order = await createOrder();
          id = order.id;
        } else {
          // Order already exists — collect two kinds of changes:
          // 1. Quantity increases on already-synced items (delta rows)
          // 2. Brand-new items appended after the sync boundary
          const { cart, syncedItemCount, syncedQuantities } = billingStore;

          const deltaItems = cart.slice(0, syncedItemCount).flatMap((item, i) => {
            const delta = item.quantity - (syncedQuantities[i] ?? item.quantity);
            if (delta <= 0) return [];
            return [{
              menuItemId: item.menuItem.id || null,
              variationId: item.variation?.id ?? null,
              addonIds: item.addons.map((a) => a.id),
              name: item.menuItem.name + (item.variation ? ` (${item.variation.name})` : ''),
              quantity: delta,
              unitPrice: item.unitPrice,
              taxRate: item.menuItem.taxRate,
              notes: item.notes ?? '',
            }];
          });

          const newItems = cart.slice(syncedItemCount).map((item) => ({
            menuItemId: item.menuItem.id || null,
            variationId: item.variation?.id ?? null,
            addonIds: item.addons.map((a) => a.id),
            name: item.menuItem.name + (item.variation ? ` (${item.variation.name})` : ''),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.menuItem.taxRate,
            notes: item.notes ?? '',
          }));

          const allPendingItems = [...deltaItems, ...newItems];
          if (allPendingItems.length > 0) {
            await ipc(window.electronAPI.orders.addItems(id, allPendingItems));
            billingStore.markItemsSynced();
            // Sync orderItemIds for newly added items
            try {
              const fullOrder = await ipc<any>(window.electronAPI.orders.getById(id));
              if (fullOrder?.items) {
                billingStore.syncOrderItemIds(fullOrder.items.map((oi: any) => ({
                  id: oi.id,
                  menuItemId: oi.menuItemId ?? oi.menu_item_id,
                  name: oi.name ?? '',
                })));
              }
            } catch { /* ignore */ }
          }
        }

        const kotResult = await ipc<any>(
          window.electronAPI.kot.create({
            orderId: id,
          })
        );

        if (!kotResult) {
          // All items were already sent — nothing new to dispatch
          throw new Error('No new items to send to kitchen');
        }

        // Thermal print if requested and KOT was created
        // kotResult is the first KOT created; all KOTs for this order share the same orderId
        if (shouldPrint && kotResult.id) {
          try {
            await ipc(window.electronAPI.kot.printReceipt(kotResult.id));
          } catch (printErr: any) {
            // KOT was created successfully — only print failed. Bubble up as a soft warning.
            const printWarning = new Error(printErr.message ?? 'Printer not available');
            (printWarning as any).isPrintWarning = true;
            throw printWarning;
          }
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to send KOT');
        throw err;
      } finally {
        kotPending.current = false;
      }
    },
    [billingStore, createOrder]
  );

  return {
    activeOrders,
    loading,
    error,
    fetchActiveOrders,
    createOrder,
    holdOrder,
    cancelOrder,
    completePayment,
    printKot,
  };
}
