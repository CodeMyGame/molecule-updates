import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addCustomersNameIndex: Migration = {
  version: 31,
  name: 'add_customers_name_index',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    `);
  },
};
