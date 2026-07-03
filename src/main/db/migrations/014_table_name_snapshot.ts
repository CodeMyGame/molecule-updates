import type { Migration } from './runner';

// Adds a snapshot of the table name on `orders` so historical orders survive a
// force-delete of the underlying table row. The original `table_id` reference
// is set to NULL when the table is force-deleted; the snapshot keeps the name
// visible in past orders / reports.
export const addTableNameSnapshot: Migration = {
  version: 14,
  name: 'add_table_name_snapshot',
  up(db) {
    db.exec(`
      ALTER TABLE orders ADD COLUMN table_name_snapshot TEXT;
    `);
  },
};
