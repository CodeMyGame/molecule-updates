import type { Migration } from './runner';

export const addPinToItemsAndTables: Migration = {
  version: 15,
  name: 'add_pin_to_items_and_tables',
  up: (db) => {
    db.exec(`
      ALTER TABLE menu_items ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tables ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_menu_items_pinned ON menu_items(is_pinned);
      CREATE INDEX IF NOT EXISTS idx_tables_pinned ON tables(is_pinned);
    `);
  },
};
