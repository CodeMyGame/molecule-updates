import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addOrdersStatusCreatedIndex: Migration = {
  version: 30,
  name: 'add_orders_status_created_index',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    `);
  },
};
