import { getDb } from '../connection';

export interface Offer {
  id: number;
  name: string;
  type: 'percentage' | 'flat';
  value: number;
  minOrderAmount: number; // paise
  maxDiscount: number | null; // paise, cap for percentage
  isActive: boolean;
  createdAt: string;
}

function rowToOffer(row: any): Offer {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    value: row.value,
    minOrderAmount: row.min_order_amount,
    maxDiscount: row.max_discount ?? null,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function getAll(): Offer[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM offers ORDER BY min_order_amount ASC').all() as any[];
  return rows.map(rowToOffer);
}

export function getActive(): Offer[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM offers WHERE is_active = 1 ORDER BY min_order_amount ASC').all() as any[];
  return rows.map(rowToOffer);
}

export function create(data: Omit<Offer, 'id' | 'createdAt'>): Offer {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO offers (name, type, value, min_order_amount, max_discount, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.name, data.type, data.value, data.minOrderAmount, data.maxDiscount ?? null, data.isActive ? 1 : 0);
  return getById(result.lastInsertRowid as number)!;
}

export function update(id: number, data: Partial<Omit<Offer, 'id' | 'createdAt'>>): Offer {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.value !== undefined) { fields.push('value = ?'); values.push(data.value); }
  if (data.minOrderAmount !== undefined) { fields.push('min_order_amount = ?'); values.push(data.minOrderAmount); }
  if (data.maxDiscount !== undefined) { fields.push('max_discount = ?'); values.push(data.maxDiscount); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  values.push(id);
  db.prepare(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id)!;
}

export function remove(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM offers WHERE id = ?').run(id);
}

export function getById(id: number): Offer | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as any;
  return row ? rowToOffer(row) : null;
}
