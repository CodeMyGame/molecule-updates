import type { Migration } from './runner';

// Indexes that significantly help report queries once `orders` and
// `order_items` accumulate years of data:
// - order_items.menu_item_id: top-selling, item-wise sales
// - order_items.combo_id: combo sales reports
// - payments.created_at: payment summary by date range
// - kots.created_at: kitchen prep time reports
// All others were already created in 001_initial / 011_favorites.
export const addPerfIndexes: Migration = {
  version: 13,
  name: 'add_perf_indexes',
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_combo ON order_items(combo_id);
      CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
      CREATE INDEX IF NOT EXISTS idx_kots_created ON kots(created_at);
      CREATE INDEX IF NOT EXISTS idx_loyalty_created ON loyalty_transactions(created_at);
    `);
  },
};
