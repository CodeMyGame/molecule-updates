import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addParcelNumberToOrders: Migration = {
  version: 27,
  name: 'add_parcel_number_to_orders',
  up: (db: Database.Database) => {
    const tableInfo = db.prepare("PRAGMA table_info('orders')").all() as any[];
    const hasCol = tableInfo.some((col: any) => col.name === 'parcel_number');
    if (!hasCol) {
      db.exec('ALTER TABLE orders ADD COLUMN parcel_number INTEGER;');
    }

    // Backfill parcel_number for existing takeaway orders grouped by calendar day
    try {
      db.exec(`
        UPDATE orders
        SET parcel_number = (
          SELECT count(*)
          FROM orders o2
          WHERE o2.order_type = 'takeaway'
            AND date(o2.created_at, 'localtime') = date(orders.created_at, 'localtime')
            AND o2.id <= orders.id
        )
        WHERE order_type = 'takeaway' AND (parcel_number IS NULL OR parcel_number = 0);
      `);
    } catch {
      // Non-fatal if no rows exist
    }
  },
};
