import { getDb } from '../connection';
import type { InventoryItem, StockTransaction } from '../../../shared/types/inventory.types';
import { StockTransactionType } from '../../../shared/enums';

export function getAll(): InventoryItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM inventory_items ORDER BY name').all() as any[];
  return rows.map(mapInventoryItem);
}

export function getById(id: number): InventoryItem | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id) as any;
  return row ? mapInventoryItem(row) : undefined;
}

export function create(data: Omit<InventoryItem, 'id' | 'isActive'>): InventoryItem {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO inventory_items (name, sku, unit, current_stock, min_stock, cost_per_unit, category)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.sku ?? null,
    data.unit,
    data.currentStock,
    data.minStock,
    data.costPerUnit,
    data.category ?? null,
  );
  return getById(result.lastInsertRowid as number)!;
}

export function update(id: number, data: Partial<Omit<InventoryItem, 'id'>>): InventoryItem | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.sku !== undefined) { fields.push('sku = ?'); values.push(data.sku); }
  if (data.unit !== undefined) { fields.push('unit = ?'); values.push(data.unit); }
  if (data.currentStock !== undefined) { fields.push('current_stock = ?'); values.push(data.currentStock); }
  if (data.minStock !== undefined) { fields.push('min_stock = ?'); values.push(data.minStock); }
  if (data.costPerUnit !== undefined) { fields.push('cost_per_unit = ?'); values.push(data.costPerUnit); }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

  if (fields.length === 0) return getById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

export function adjustStock(
  id: number,
  quantity: number,
  type: StockTransactionType,
  referenceType?: string,
  referenceId?: number,
  notes?: string,
): InventoryItem | undefined {
  const db = getDb();

  const adjustInTransaction = db.transaction(() => {
    const rawQty = Number(quantity) || 0;
    // For wastage and consumption, always deduct regardless of signed input
    // For purchase, always add regardless of signed input
    // For adjustment, preserve direction (positive adds, negative subtracts)
    let adjustedQty: number;
    let loggedQty: number;

    if (type === StockTransactionType.PURCHASE) {
      adjustedQty = Math.abs(rawQty);
      loggedQty = Math.abs(rawQty);
    } else if (type === StockTransactionType.WASTAGE || type === StockTransactionType.CONSUMPTION) {
      adjustedQty = -Math.abs(rawQty);
      loggedQty = Math.abs(rawQty);
    } else {
      // ADJUSTMENT
      adjustedQty = rawQty;
      loggedQty = Math.abs(rawQty);
    }

    db.prepare(`
      UPDATE inventory_items
      SET current_stock = MAX(0, current_stock + ?), updated_at = datetime('now')
      WHERE id = ?
    `).run(adjustedQty, id);

    db.prepare(`
      INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, type, loggedQty, referenceType ?? null, referenceId ?? null, notes ?? null);
  });

  adjustInTransaction();
  return getById(id);
}

export function getLowStock(): InventoryItem[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM inventory_items WHERE current_stock <= min_stock AND is_active = 1 ORDER BY name'
  ).all() as any[];
  return rows.map(mapInventoryItem);
}

export function getTransactions(
  itemId?: number,
  dateRange?: { startDate?: string; endDate?: string },
  limit = 200,
  offset = 0,
): StockTransaction[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (itemId !== undefined) {
    conditions.push('st.inventory_item_id = ?');
    params.push(itemId);
  }
  if (dateRange?.startDate) {
    conditions.push('st.created_at >= ?');
    params.push(dateRange.startDate);
  }
  if (dateRange?.endDate) {
    conditions.push('st.created_at <= ?');
    params.push(dateRange.endDate);
  }

  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const safeOffset = Math.max(0, Number(offset) || 0);
  params.push(safeLimit, safeOffset);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT st.*, ii.name as item_name, ii.unit
    FROM stock_transactions st
    LEFT JOIN inventory_items ii ON st.inventory_item_id = ii.id
    ${where}
    ORDER BY st.created_at DESC, st.id DESC
    LIMIT ? OFFSET ?
  `).all(...params) as any[];

  return rows.map((row) => ({
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    itemName: row.item_name ?? undefined,
    unit: row.unit ?? undefined,
    transactionType: row.transaction_type as StockTransactionType,
    quantity: row.quantity,
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }));
}

function mapInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? undefined,
    unit: row.unit,
    currentStock: row.current_stock,
    minStock: row.min_stock,
    costPerUnit: row.cost_per_unit,
    category: row.category ?? undefined,
    isActive: !!row.is_active,
  };
}
