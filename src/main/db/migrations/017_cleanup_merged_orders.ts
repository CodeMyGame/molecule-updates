import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const cleanupMergedOrders: Migration = {
  version: 17,
  name: 'cleanup_merged_orders',
  up: (db: Database.Database) => {
    // Zero out financial totals for any existing merged orders
    db.exec(`
      UPDATE orders
      SET subtotal = 0,
          discount_amount = 0,
          discount_value = 0,
          discount_type = NULL,
          tax_amount = 0,
          grand_total = 0,
          round_off = 0
      WHERE status = 'merged';
    `);
  },
};
