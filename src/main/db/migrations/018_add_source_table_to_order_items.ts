import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addSourceTableToOrderItems: Migration = {
  version: 18,
  name: 'add_source_table_to_order_items',
  up: (db: Database.Database) => {
    const tableInfo = db.prepare("PRAGMA table_info('order_items')").all() as any[];
    const hasCol = tableInfo.some((col: any) => col.name === 'source_table_name');
    if (!hasCol) {
      db.exec('ALTER TABLE order_items ADD COLUMN source_table_name TEXT;');
    }
  },
};
