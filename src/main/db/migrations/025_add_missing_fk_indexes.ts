import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addMissingFkIndexes: Migration = {
  version: 25,
  name: 'add_missing_fk_indexes',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_item_variations_menu_item ON item_variations(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_stock_txn_ref ON stock_transactions(reference_type, transaction_type);
      CREATE INDEX IF NOT EXISTS idx_stock_txn_item_date ON stock_transactions(inventory_item_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_orders_split_from ON orders(split_from_order_id);
      CREATE INDEX IF NOT EXISTS idx_orders_merged_into ON orders(merged_into_order_id);
      CREATE INDEX IF NOT EXISTS idx_addon_variation_prices_lookup ON addon_variation_prices(addon_id, variation_name);
    `);
  },
};
