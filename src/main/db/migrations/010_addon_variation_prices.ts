import type { Migration } from './runner';

export const addonVariationPrices: Migration = {
  version: 10,
  name: 'addon_variation_prices',
  up(db) {
    // Addon prices can vary based on the selected item variation.
    // e.g. Cheese Burst costs ₹49 for Regular pizza, ₹79 for Medium.
    // Keyed on variation_name (not variation_id) because addon groups are shared
    // across items in a category and all items share the same variation names.
    db.exec(`
      CREATE TABLE addon_variation_prices (
        id INTEGER PRIMARY KEY,
        addon_id INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
        variation_name TEXT NOT NULL,
        price INTEGER NOT NULL,
        UNIQUE(addon_id, variation_name)
      );
    `);

    // Seed variation prices for existing addons that need them.
    // Find the Pizza Crust Options group and Waffle Toppings group created in migration 009.
    const pizzaGroup = db.prepare(
      "SELECT id FROM addon_groups WHERE name = 'Pizza Crust Options'"
    ).get() as { id: number } | undefined;

    if (pizzaGroup) {
      const addons = db.prepare(
        'SELECT id, name, price FROM addons WHERE addon_group_id = ?'
      ).all(pizzaGroup.id) as { id: number; name: string; price: number }[];

      const insertPrice = db.prepare(
        'INSERT INTO addon_variation_prices (addon_id, variation_name, price) VALUES (?, ?, ?)'
      );

      for (const addon of addons) {
        // Base price is already the Regular price. Add Medium override.
        if (addon.name === 'Cheese Burst') {
          insertPrice.run(addon.id, 'Regular', 4900);
          insertPrice.run(addon.id, 'Medium', 7900);
        } else if (addon.name === 'Thin Crust') {
          insertPrice.run(addon.id, 'Regular', 2000);
          insertPrice.run(addon.id, 'Medium', 4000);
        }
      }
    }

    const waffleGroup = db.prepare(
      "SELECT id FROM addon_groups WHERE name = 'Waffle Toppings'"
    ).get() as { id: number } | undefined;

    if (waffleGroup) {
      const addons = db.prepare(
        'SELECT id, name, price FROM addons WHERE addon_group_id = ?'
      ).all(waffleGroup.id) as { id: number; name: string; price: number }[];

      const insertPrice = db.prepare(
        'INSERT INTO addon_variation_prices (addon_id, variation_name, price) VALUES (?, ?, ?)'
      );

      for (const addon of addons) {
        if (addon.name === 'Ice Cream') {
          insertPrice.run(addon.id, '2 Pieces', 3900);
          insertPrice.run(addon.id, '4 Pieces', 5900);
        }
      }
    }
  },
};
