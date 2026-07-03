import { ipc } from './ipc';

/** Matches billing store discount shape */
export type SyncableDiscount = {
  type: 'percent' | 'flat';
  value: number;
  reason?: string;
} | null;

/**
 * Persist cart discount to an existing order so DB grand_total matches the UI
 * (required before payment validation).
 */
export async function syncOrderDiscountToServer(
  orderId: number,
  discount: SyncableDiscount
): Promise<void> {
  if (!window.electronAPI?.orders?.applyDiscount) return;

  if (discount == null) {
    await ipc(window.electronAPI.orders.applyDiscount(orderId, null));
    return;
  }

  await ipc(
    window.electronAPI.orders.applyDiscount(orderId, {
      type: discount.type === 'percent' ? 'percentage' : 'flat',
      value: discount.value,
      reason: discount.reason,
    })
  );
}
