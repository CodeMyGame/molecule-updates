import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addParcelNameToOrders: Migration = {
  version: 26,
  name: 'add_parcel_name_to_orders',
  up: (db: Database.Database) => {
    const tableInfo = db.prepare("PRAGMA table_info('orders')").all() as any[];
    const hasCol = tableInfo.some((col: any) => col.name === 'parcel_name');
    if (!hasCol) {
      db.exec('ALTER TABLE orders ADD COLUMN parcel_name TEXT;');
    }
  },
};
