import type { Migration } from './runner';

export const addOffersTable: Migration = {
  version: 5,
  name: 'add_offers_table',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('percentage', 'flat')),
        value REAL NOT NULL,
        min_order_amount INTEGER NOT NULL,
        max_discount INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  },
};
