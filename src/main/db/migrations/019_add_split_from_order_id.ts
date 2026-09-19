import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addSplitFromOrderId: Migration = {
  version: 19,
  name: 'add_split_from_order_id',
  up: (db: Database.Database) => {
    const tableInfo = db.prepare("PRAGMA table_info('orders')").all() as any[];
    const hasCol = tableInfo.some((col: any) => col.name === 'split_from_order_id');
    if (!hasCol) {
      db.exec('ALTER TABLE orders ADD COLUMN split_from_order_id INTEGER REFERENCES orders(id);');
    }
  },
};
