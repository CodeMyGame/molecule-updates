import Database from 'better-sqlite3';
import { Migration } from './runner';

export const addVoidItemsTable: Migration = {
  version: 16,
  name: 'add_void_items_table',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS void_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        order_number TEXT,
        table_name TEXT,
        menu_item_id INTEGER,
        item_name TEXT NOT NULL,
        variation_name TEXT,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        staff_id INTEGER,
        staff_name TEXT,
        voided_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_void_items_voided_at ON void_items(voided_at);
      CREATE INDEX IF NOT EXISTS idx_void_items_order_id ON void_items(order_id);
    `);

    // Add cancellation_reason to orders if not exists
    const orderCols = db.pragma('table_info(orders)') as any[];
    if (!orderCols.some((col: any) => col.name === 'cancellation_reason')) {
      db.exec('ALTER TABLE orders ADD COLUMN cancellation_reason TEXT');
    }
  },
};
