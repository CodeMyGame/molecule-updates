import type { Migration } from './runner';

export const addFavoritesTable: Migration = {
  version: 11,
  name: 'add_favorites_table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY,
        menu_item_id INTEGER NOT NULL UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE,
        added_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_item ON favorites(menu_item_id);
    `);
  },
};
