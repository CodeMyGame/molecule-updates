import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addOrderItemAddonsPerfIndex: Migration = {
  version: 24,
  name: 'add_order_item_addons_perf_index',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item ON order_item_addons(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_kot_items_kot ON kot_items(kot_id);
      CREATE INDEX IF NOT EXISTS idx_kot_items_order_item ON kot_items(order_item_id);
    `);
  },
};
