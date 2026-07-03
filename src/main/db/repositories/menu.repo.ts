import { getDb } from '../connection';
import type {
  MenuCategory,
  MenuItem,
  ItemVariation,
  AddonGroup,
  Addon,
  CreateMenuItemDTO,
  UpdateMenuItemDTO,
} from '../../../shared/types/menu.types';

// -- Categories --

export function getCategories(): MenuCategory[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, sort_order, is_active, parent_id FROM menu_categories ORDER BY sort_order').all() as any[];
  return rows.map(mapCategory);
}

export function getCategoryById(id: number): MenuCategory | undefined {
  const db = getDb();
  const row = db.prepare('SELECT id, name, sort_order, is_active, parent_id FROM menu_categories WHERE id = ?').get(id) as any;
  return row ? mapCategory(row) : undefined;
}

export function createCategory(data: { name: string; sortOrder?: number; parentId?: number }): MenuCategory {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO menu_categories (name, sort_order, parent_id) VALUES (?, ?, ?)'
  ).run(data.name, data.sortOrder ?? 0, data.parentId ?? null);
  return getCategoryById(result.lastInsertRowid as number)!;
}

export function updateCategory(id: number, data: Partial<{ name: string; sortOrder: number; isActive: boolean; parentId: number | null }>): MenuCategory | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  if (data.parentId !== undefined) { fields.push('parent_id = ?'); values.push(data.parentId); }

  if (fields.length === 0) return getCategoryById(id);

  values.push(id);
  db.prepare(`UPDATE menu_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCategoryById(id);
}

export function deleteCategory(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(id);
}

// Force-deletes a category by first force-deleting every item in it. Historical
// order_items rows keep their snapshotted `name`/`unit_price`/etc., but their
// menu_item_id / variation_id / addon_id references are nulled so the parent
// rows can be removed.
export function forceDeleteCategory(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const items = db.prepare('SELECT id FROM menu_items WHERE category_id = ?').all(id) as { id: number }[];
    for (const it of items) forceDeleteItemInner(db, it.id);
    db.prepare('DELETE FROM menu_categories WHERE id = ?').run(id);
  });
  tx();
}

// -- Items --

export function getItems(categoryId?: number): (MenuItem & { categoryName: string })[] {
  const db = getDb();
  let sql = `
    SELECT mi.id, mi.name, mi.short_code, mi.category_id, mi.base_price, mi.tax_rate,
           mi.is_veg, mi.is_available, mi.image_path, mi.sort_order, mi.station, mi.is_pinned,
           mc.name AS category_name,
           (SELECT COUNT(*) FROM item_variations WHERE menu_item_id = mi.id) > 0 AS has_variations,
           (SELECT COUNT(*) FROM menu_item_addon_groups WHERE menu_item_id = mi.id) > 0 AS has_addons
    FROM menu_items mi
    JOIN menu_categories mc ON mi.category_id = mc.id
  `;
  const params: unknown[] = [];
  if (categoryId !== undefined) {
    sql += ' WHERE mi.category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY mi.is_pinned DESC, mi.sort_order';

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((row) => ({
    ...mapItem(row),
    categoryName: row.category_name,
    has_variations: !!row.has_variations,
    has_addons: !!row.has_addons,
  }));
}

export function getItemById(id: number): (MenuItem & { variations: ItemVariation[]; addonGroups: (AddonGroup & { addons: Addon[] })[] }) | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, name, short_code, category_id, base_price, tax_rate,
           is_veg, is_available, image_path, sort_order, station
    FROM menu_items WHERE id = ?
  `).get(id) as any;

  if (!row) return undefined;

  const item = mapItem(row);
  const variations = getVariations(id);
  const addonGroups = getAddons(id);

  return { ...item, variations, addonGroups };
}

export function createItem(data: CreateMenuItemDTO): MenuItem {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO menu_items (name, short_code, category_id, base_price, tax_rate, is_veg, is_available, image_path, sort_order, station)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.shortCode,
    data.categoryId,
    data.basePrice,
    data.taxRate,
    data.isVeg ? 1 : 0,
    data.isAvailable !== false ? 1 : 0,
    data.imagePath ?? null,
    data.sortOrder ?? 0,
    data.station ?? null,
  );
  return mapItem(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid as number) as any);
}

export function updateItem(id: number, data: Omit<UpdateMenuItemDTO, 'id'>): MenuItem | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.shortCode !== undefined) { fields.push('short_code = ?'); values.push(data.shortCode); }
  if (data.categoryId !== undefined) { fields.push('category_id = ?'); values.push(data.categoryId); }
  if (data.basePrice !== undefined) { fields.push('base_price = ?'); values.push(data.basePrice); }
  if (data.taxRate !== undefined) { fields.push('tax_rate = ?'); values.push(data.taxRate); }
  if (data.isVeg !== undefined) { fields.push('is_veg = ?'); values.push(data.isVeg ? 1 : 0); }
  if (data.isAvailable !== undefined) { fields.push('is_available = ?'); values.push(data.isAvailable ? 1 : 0); }
  if (data.imagePath !== undefined) { fields.push('image_path = ?'); values.push(data.imagePath); }
  if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
  if (data.station !== undefined) { fields.push('station = ?'); values.push(data.station || null); }

  if (fields.length === 0) return mapItem(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any;
  return row ? mapItem(row) : undefined;
}

export function deleteItem(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
}

// Force-deletes an item: nulls out historical order_items.menu_item_id and
// .variation_id references (snapshot fields like name/unit_price are kept) and
// nulls out addon refs in order_item_addons that point at addons that will be
// cascaded away by the menu_items delete. Cascade handles item_variations,
// menu_item_addon_groups, and (indirectly via FK on addon_groups linked solely
// to this item) — addon_groups themselves are not deleted here since they can
// be shared across items.
function forceDeleteItemInner(db: ReturnType<typeof getDb>, id: number): void {
  // Snapshot the variation ids that will disappear so we can null them out on
  // historical order_items first (cascade would do this, but only because the
  // FK has no ON DELETE clause we get an FK violation if FKs are enforced).
  const variationIds = db
    .prepare('SELECT id FROM item_variations WHERE menu_item_id = ?')
    .all(id) as { id: number }[];

  if (variationIds.length > 0) {
    const placeholders = variationIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE order_items SET variation_id = NULL WHERE variation_id IN (${placeholders})`
    ).run(...variationIds.map((v) => v.id));
  }

  db.prepare('UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = ?').run(id);
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
}

export function forceDeleteItem(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => forceDeleteItemInner(db, id));
  tx();
}

export function toggleAvailability(id: number): MenuItem | undefined {
  const db = getDb();
  db.prepare('UPDATE menu_items SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any;
  return row ? mapItem(row) : undefined;
}

// -- Variations --

export function getVariations(itemId: number): ItemVariation[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, menu_item_id, name, price_delta, is_default FROM item_variations WHERE menu_item_id = ?').all(itemId) as any[];
  return rows.map((r) => ({
    id: r.id,
    menuItemId: r.menu_item_id,
    name: r.name,
    priceDelta: r.price_delta,
    isDefault: !!r.is_default,
  }));
}

// -- Addons --

export function getAddons(itemId: number): (AddonGroup & { addons: Addon[] })[] {
  const db = getDb();
  const groups = db.prepare(`
    SELECT ag.id, ag.name, ag.min_select, ag.max_select, ag.is_required
    FROM addon_groups ag
    JOIN menu_item_addon_groups miag ON ag.id = miag.addon_group_id
    WHERE miag.menu_item_id = ?
  `).all(itemId) as any[];

  const getVarPrices = db.prepare(
    'SELECT variation_name, price FROM addon_variation_prices WHERE addon_id = ?'
  );

  return groups.map((g) => {
    const addons = db.prepare('SELECT id, addon_group_id, name, price FROM addons WHERE addon_group_id = ?').all(g.id) as any[];
    return {
      id: g.id,
      name: g.name,
      minSelect: g.min_select,
      maxSelect: g.max_select,
      isRequired: !!g.is_required,
      addons: addons.map((a: any) => {
        const varPrices = getVarPrices.all(a.id) as { variation_name: string; price: number }[];
        return {
          id: a.id,
          addonGroupId: a.addon_group_id,
          name: a.name,
          price: a.price,
          variationPrices: varPrices.length > 0
            ? Object.fromEntries(varPrices.map((vp) => [vp.variation_name, vp.price]))
            : undefined,
        };
      }),
    };
  });
}

// -- Variation helpers --

/** Recalculate the menu item's basePrice to the minimum variation price and adjust all deltas. */
function syncItemBasePriceWithVariations(menuItemId: number): void {
  const db = getDb();
  const item = db.prepare('SELECT base_price FROM menu_items WHERE id = ?').get(menuItemId) as any;
  if (!item) return;

  const variations = db.prepare('SELECT id, price_delta FROM item_variations WHERE menu_item_id = ?').all(menuItemId) as any[];
  if (variations.length === 0) return; // no variations, keep basePrice as-is

  const currentBase = item.base_price as number;
  const minActualPrice = Math.min(...variations.map((v: any) => currentBase + (v.price_delta as number)));

  if (minActualPrice === currentBase) return; // already correct

  // Update basePrice to the minimum variation price
  db.prepare("UPDATE menu_items SET base_price = ?, updated_at = datetime('now') WHERE id = ?").run(minActualPrice, menuItemId);

  // Recalculate all deltas relative to the new basePrice
  const delta = currentBase - minActualPrice; // amount basePrice decreased (positive means it went down)
  db.prepare('UPDATE item_variations SET price_delta = price_delta + ? WHERE menu_item_id = ?').run(delta, menuItemId);
}

// -- Variation CRUD --

export function createVariation(data: { menuItemId: number; name: string; priceDelta: number; isDefault?: boolean }): ItemVariation {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO item_variations (menu_item_id, name, price_delta, is_default) VALUES (?, ?, ?, ?)'
  ).run(data.menuItemId, data.name, data.priceDelta, data.isDefault ? 1 : 0);
  syncItemBasePriceWithVariations(data.menuItemId);
  const row = db.prepare('SELECT * FROM item_variations WHERE id = ?').get(result.lastInsertRowid as number) as any;
  return { id: row.id, menuItemId: row.menu_item_id, name: row.name, priceDelta: row.price_delta, isDefault: !!row.is_default };
}

export function updateVariation(id: number, data: { name?: string; priceDelta?: number; isDefault?: boolean; menuItemId?: number }): ItemVariation | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.priceDelta !== undefined) { fields.push('price_delta = ?'); values.push(data.priceDelta); }
  if (data.isDefault !== undefined) { fields.push('is_default = ?'); values.push(data.isDefault ? 1 : 0); }
  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM item_variations WHERE id = ?').get(id) as any;
    return row ? { id: row.id, menuItemId: row.menu_item_id, name: row.name, priceDelta: row.price_delta, isDefault: !!row.is_default } : undefined;
  }
  values.push(id);
  db.prepare(`UPDATE item_variations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  // Determine menuItemId for sync
  const row = db.prepare('SELECT * FROM item_variations WHERE id = ?').get(id) as any;
  if (row) {
    syncItemBasePriceWithVariations(row.menu_item_id);
    // Re-read after sync since priceDelta may have changed
    const updated = db.prepare('SELECT * FROM item_variations WHERE id = ?').get(id) as any;
    return updated ? { id: updated.id, menuItemId: updated.menu_item_id, name: updated.name, priceDelta: updated.price_delta, isDefault: !!updated.is_default } : undefined;
  }
  return undefined;
}

export function deleteVariation(id: number): void {
  const db = getDb();
  // Get menuItemId before deleting
  const row = db.prepare('SELECT menu_item_id FROM item_variations WHERE id = ?').get(id) as any;
  db.prepare('DELETE FROM item_variations WHERE id = ?').run(id);
  if (row) {
    syncItemBasePriceWithVariations(row.menu_item_id);
  }
}

// -- Item ↔ Addon Group linking --

export function getItemAddonGroupIds(menuItemId: number): number[] {
  const db = getDb();
  const rows = db.prepare('SELECT addon_group_id FROM menu_item_addon_groups WHERE menu_item_id = ?').all(menuItemId) as any[];
  return rows.map((r) => r.addon_group_id as number);
}

export function linkAddonGroupToItem(menuItemId: number, addonGroupId: number): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)'
  ).run(menuItemId, addonGroupId);
}

export function unlinkAddonGroupFromItem(menuItemId: number, addonGroupId: number): void {
  const db = getDb();
  db.prepare(
    'DELETE FROM menu_item_addon_groups WHERE menu_item_id = ? AND addon_group_id = ?'
  ).run(menuItemId, addonGroupId);
}

// -- Addon Group CRUD --

export function getAddonGroups(): (AddonGroup & { addons: Addon[] })[] {
  const db = getDb();
  const groups = db.prepare('SELECT id, name, min_select, max_select, is_required FROM addon_groups').all() as any[];
  const getVarPrices = db.prepare(
    'SELECT variation_name, price FROM addon_variation_prices WHERE addon_id = ?'
  );
  return groups.map((g) => {
    const addons = db.prepare('SELECT id, addon_group_id, name, price FROM addons WHERE addon_group_id = ?').all(g.id) as any[];
    return {
      id: g.id,
      name: g.name,
      minSelect: g.min_select,
      maxSelect: g.max_select,
      isRequired: !!g.is_required,
      addons: addons.map((a: any) => {
        const varPrices = getVarPrices.all(a.id) as { variation_name: string; price: number }[];
        return {
          id: a.id, addonGroupId: a.addon_group_id, name: a.name, price: a.price,
          variationPrices: varPrices.length > 0
            ? Object.fromEntries(varPrices.map((vp) => [vp.variation_name, vp.price]))
            : undefined,
        };
      }),
    };
  });
}

export function createAddonGroup(data: { name: string; minSelect?: number; maxSelect?: number; isRequired?: boolean }): AddonGroup & { addons: Addon[] } {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO addon_groups (name, min_select, max_select, is_required) VALUES (?, ?, ?, ?)'
  ).run(data.name, data.minSelect ?? 0, data.maxSelect ?? 5, data.isRequired ? 1 : 0);
  return {
    id: result.lastInsertRowid as number,
    name: data.name,
    minSelect: data.minSelect ?? 0,
    maxSelect: data.maxSelect ?? 5,
    isRequired: data.isRequired ?? false,
    addons: [],
  };
}

export function updateAddonGroup(id: number, data: { name?: string; minSelect?: number; maxSelect?: number; isRequired?: boolean }): AddonGroup & { addons: Addon[] } {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.minSelect !== undefined) { fields.push('min_select = ?'); values.push(data.minSelect); }
  if (data.maxSelect !== undefined) { fields.push('max_select = ?'); values.push(data.maxSelect); }
  if (data.isRequired !== undefined) { fields.push('is_required = ?'); values.push(data.isRequired ? 1 : 0); }
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE addon_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  const row = db.prepare('SELECT * FROM addon_groups WHERE id = ?').get(id) as any;
  const addons = db.prepare('SELECT id, addon_group_id, name, price FROM addons WHERE addon_group_id = ?').all(id) as any[];
  return {
    id: row.id,
    name: row.name,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    isRequired: !!row.is_required,
    addons: addons.map((a: any) => ({ id: a.id, addonGroupId: a.addon_group_id, name: a.name, price: a.price })),
  };
}

export function deleteAddonGroup(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM addon_groups WHERE id = ?').run(id);
}

// -- Addon CRUD --

export function createAddon(data: { addonGroupId: number; name: string; price: number }): Addon {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO addons (addon_group_id, name, price) VALUES (?, ?, ?)'
  ).run(data.addonGroupId, data.name, data.price);
  return { id: result.lastInsertRowid as number, addonGroupId: data.addonGroupId, name: data.name, price: data.price };
}

export function updateAddon(id: number, data: { name?: string; price?: number; addonGroupId?: number }): Addon | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
  if (data.addonGroupId !== undefined) { fields.push('addon_group_id = ?'); values.push(data.addonGroupId); }
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE addons SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  const row = db.prepare('SELECT * FROM addons WHERE id = ?').get(id) as any;
  return row ? { id: row.id, addonGroupId: row.addon_group_id, name: row.name, price: row.price } : undefined;
}

export function deleteAddon(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM addons WHERE id = ?').run(id);
}

// -- Addon Variation Prices --

export function getVariationNamesForAddonGroup(addonGroupId: number): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT iv.name FROM item_variations iv
    JOIN menu_item_addon_groups miag ON miag.menu_item_id = iv.menu_item_id
    WHERE miag.addon_group_id = ?
    ORDER BY iv.name
  `).all(addonGroupId) as { name: string }[];
  return rows.map((r) => r.name);
}

export function setAddonVariationPrices(addonId: number, variationPrices: Record<string, number>): void {
  const db = getDb();
  db.prepare('DELETE FROM addon_variation_prices WHERE addon_id = ?').run(addonId);
  const insert = db.prepare(
    'INSERT INTO addon_variation_prices (addon_id, variation_name, price) VALUES (?, ?, ?)'
  );
  for (const [variationName, price] of Object.entries(variationPrices)) {
    insert.run(addonId, variationName, price);
  }
}

// -- Combo CRUD --

export function getCombos(): any[] {
  const db = getDb();
  const combos = db.prepare('SELECT * FROM combos ORDER BY name').all() as any[];
  return combos.map((c) => {
    const items = db.prepare(`
      SELECT ci.id, ci.combo_id, ci.menu_item_id, ci.quantity, mi.name as item_name
      FROM combo_items ci
      JOIN menu_items mi ON ci.menu_item_id = mi.id
      WHERE ci.combo_id = ?
    `).all(c.id) as any[];
    return {
      id: c.id,
      name: c.name,
      price: c.price,
      taxRate: c.tax_rate,
      isActive: !!c.is_active,
      items: items.map((i: any) => ({
        id: i.id,
        comboId: i.combo_id,
        menuItemId: i.menu_item_id,
        quantity: i.quantity,
        item_name: i.item_name,
      })),
    };
  });
}

export function createCombo(data: { name: string; price: number; taxRate?: number; isActive?: boolean; items?: any[] }): any {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO combos (name, price, tax_rate, is_active) VALUES (?, ?, ?, ?)'
  ).run(data.name, data.price, data.taxRate ?? 5.0, data.isActive !== false ? 1 : 0);
  const comboId = result.lastInsertRowid as number;

  if (data.items && data.items.length > 0) {
    const stmt = db.prepare('INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES (?, ?, ?)');
    for (const item of data.items) {
      stmt.run(comboId, item.menuItemId ?? item.menu_item_id, item.quantity ?? 1);
    }
  }

  return getCombos().find((c) => c.id === comboId);
}

export function updateCombo(id: number, data: { name?: string; price?: number; taxRate?: number; isActive?: boolean; items?: any[] }): any {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
  if (data.taxRate !== undefined) { fields.push('tax_rate = ?'); values.push(data.taxRate); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE combos SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  if (data.items !== undefined) {
    db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(id);
    const stmt = db.prepare('INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES (?, ?, ?)');
    for (const item of data.items) {
      stmt.run(id, item.menuItemId ?? item.menu_item_id, item.quantity ?? 1);
    }
  }

  return getCombos().find((c) => c.id === id);
}

export function deleteCombo(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM combos WHERE id = ?').run(id);
}

// -- Mappers --

function mapCategory(row: any): MenuCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: !!row.is_active,
    parentId: row.parent_id ?? undefined,
  };
}

function mapItem(row: any): MenuItem {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    categoryId: row.category_id,
    basePrice: row.base_price,
    taxRate: row.tax_rate,
    isVeg: !!row.is_veg,
    isAvailable: !!row.is_available,
    imagePath: row.image_path ?? undefined,
    sortOrder: row.sort_order,
    station: row.station ?? undefined,
    isPinned: !!row.is_pinned,
  };
}

export function togglePin(id: number): MenuItem | undefined {
  const db = getDb();
  db.prepare('UPDATE menu_items SET is_pinned = 1 - is_pinned WHERE id = ?').run(id);
  const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any;
  return row ? mapItem(row) : undefined;
}
