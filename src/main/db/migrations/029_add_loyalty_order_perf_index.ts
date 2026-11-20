import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addLoyaltyOrderPerfIndex: Migration = {
  version: 29,
  name: 'add_loyalty_order_perf_index',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_loyalty_order ON loyalty_transactions(order_id);
    `);
  },
};
