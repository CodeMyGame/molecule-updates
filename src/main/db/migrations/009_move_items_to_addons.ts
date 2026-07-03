import type { Migration } from './runner';

export const moveItemsToAddons: Migration = {
  version: 9,
  name: 'move_items_to_addons',
  up(db) {
    // Move 12 menu items that are actually add-ons into the addon system.
    // For pizza crust options (items 79, 80) that had size-based variations,
    // we use the base (Regular) price since the addon system has flat pricing.

    const insertGroup = db.prepare(
      'INSERT INTO addon_groups (name, min_select, max_select, is_required) VALUES (?, ?, ?, 0)'
    );
    const insertAddon = db.prepare(
      'INSERT INTO addons (addon_group_id, name, price) VALUES (?, ?, ?)'
    );
    const linkStmt = db.prepare(
      'INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)'
    );

    function createGroupAndLink(
      name: string,
      categoryId: number,
      maxSelect: number,
      addons: { name: string; price: number }[],
      excludeItemIds: number[],
    ): void {
      const groupId = insertGroup.run(name, 0, maxSelect).lastInsertRowid;
      for (const a of addons) {
        insertAddon.run(groupId, a.name, a.price);
      }
      const items = db.prepare(
        `SELECT id FROM menu_items WHERE category_id = ? AND id NOT IN (${excludeItemIds.join(',')})`
      ).all(categoryId) as { id: number }[];
      for (const item of items) {
        linkStmt.run(item.id, groupId);
      }
    }

    // 1. Cold Coffee Add-ons (category 1) — items 3, 4
    createGroupAndLink('Cold Coffee Add-ons', 1, 2, [
      { name: 'Ice Cream', price: 3900 },
      { name: 'Choco Chips', price: 1900 },
    ], [3, 4]);

    // 2. Hot Dog Add-ons (category 3) — item 22
    createGroupAndLink('Hot Dog Add-ons', 3, 1, [
      { name: 'Extra Cheese', price: 3000 },
    ], [22]);

    // 3. Maggi Add-ons (category 4) — item 28
    createGroupAndLink('Maggi Add-ons', 4, 1, [
      { name: 'Extra Cheese', price: 4900 },
    ], [28]);

    // 4. Fries Add-ons (category 5) — items 34, 37, 38
    createGroupAndLink('Fries Add-ons', 5, 3, [
      { name: 'Extra Cheese', price: 4900 },
      { name: 'Extra Meyo/Cheese Dip', price: 3000 },
      { name: 'Schezwan/Spicy Meyo', price: 3000 },
    ], [34, 37, 38]);

    // 5. Sandwich Add-ons (category 7) — item 57
    createGroupAndLink('Sandwich Add-ons', 7, 1, [
      { name: 'Extra Cheese', price: 3900 },
    ], [57]);

    // 6. Waffle Toppings (category 8) — item 64
    createGroupAndLink('Waffle Toppings', 8, 1, [
      { name: 'Ice Cream', price: 3900 },
    ], [64]);

    // 7. Pizza Crust Options (category 9) — items 79, 80
    createGroupAndLink('Pizza Crust Options', 9, 1, [
      { name: 'Cheese Burst', price: 4900 },
      { name: 'Thin Crust', price: 2000 },
    ], [79, 80]);

    // 8. Wrap Add-ons (category 14) — item 111
    createGroupAndLink('Wrap Add-ons', 14, 1, [
      { name: 'Extra Cheese', price: 4900 },
    ], [111]);

    // Delete the 12 addon-like menu items (ON DELETE CASCADE removes their variations)
    const idsToDelete = [3, 4, 22, 28, 34, 37, 38, 57, 64, 79, 80, 111];
    const deleteStmt = db.prepare('DELETE FROM menu_items WHERE id = ?');
    for (const id of idsToDelete) {
      deleteStmt.run(id);
    }
  },
};
