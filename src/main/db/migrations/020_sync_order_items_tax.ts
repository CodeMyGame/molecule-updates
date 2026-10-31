import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const syncOrderItemsTax: Migration = {
  version: 20,
  name: 'sync_order_items_tax',
  up: (db: Database.Database) => {
    // For all orders where a discount was applied, re-sync order_items tax_amount and total to post-discount values
    const discountedOrders = db.prepare(`
      SELECT id, subtotal, discount_amount
      FROM orders
      WHERE discount_amount > 0 AND subtotal > 0
    `).all() as { id: number; subtotal: number; discount_amount: number }[];

    const updateItem = db.prepare('UPDATE order_items SET tax_amount = ?, total = ? WHERE id = ?');

    for (const order of discountedOrders) {
      const discountRatio = order.discount_amount / order.subtotal;
      const items = db.prepare('SELECT id, unit_price, quantity, tax_rate FROM order_items WHERE order_id = ?').all(order.id) as any[];

      for (const item of items) {
        const itemTotal = item.unit_price * item.quantity;
        const discountedTotal = Math.round(itemTotal * (1 - discountRatio));
        const itemTax = Math.round((discountedTotal * item.tax_rate) / 100);
        updateItem.run(itemTax, itemTotal + itemTax, item.id);
      }
    }
  },
};
