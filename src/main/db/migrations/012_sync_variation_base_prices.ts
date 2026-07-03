import type { Migration } from './runner';

export const syncVariationBasePrices: Migration = {
  version: 12,
  name: 'sync_variation_base_prices',
  up(db) {
    // Backfill: for items with variations whose base_price isn't already the min
    // actual price, lower base_price to the min and shift each delta up by the
    // same amount so all variation actual prices stay unchanged.
    const items = db.prepare(`
      SELECT mi.id, mi.base_price
      FROM menu_items mi
      WHERE EXISTS (SELECT 1 FROM item_variations iv WHERE iv.menu_item_id = mi.id)
    `).all() as { id: number; base_price: number }[];

    const getVariations = db.prepare(
      'SELECT price_delta FROM item_variations WHERE menu_item_id = ?'
    );
    const updateBase = db.prepare(
      "UPDATE menu_items SET base_price = ?, updated_at = datetime('now') WHERE id = ?"
    );
    const shiftDeltas = db.prepare(
      'UPDATE item_variations SET price_delta = price_delta + ? WHERE menu_item_id = ?'
    );

    for (const item of items) {
      const variations = getVariations.all(item.id) as { price_delta: number }[];
      if (variations.length === 0) continue;

      const minActualPrice = Math.min(
        ...variations.map((v) => item.base_price + v.price_delta)
      );
      if (minActualPrice === item.base_price) continue;

      const shift = item.base_price - minActualPrice;
      updateBase.run(minActualPrice, item.id);
      shiftDeltas.run(shift, item.id);
    }
  },
};
