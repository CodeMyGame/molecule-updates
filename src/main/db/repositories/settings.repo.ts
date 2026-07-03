import { getDb } from '../connection';
import type { Setting, Restaurant, DaySession } from '../../../shared/types/settings.types';
import type { Role } from '../../../shared/types/staff.types';

export function get(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value;
}

export function set(key: string, value: string, category: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, category) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category
  `).run(key, value, category);
}

export function getAll(category?: string): Setting[] {
  const db = getDb();
  if (category) {
    const rows = db.prepare('SELECT * FROM settings WHERE category = ? ORDER BY key').all(category) as any[];
    return rows.map(mapSetting);
  }
  const rows = db.prepare('SELECT * FROM settings ORDER BY category, key').all() as any[];
  return rows.map(mapSetting);
}

export function getRestaurant(): Restaurant | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM restaurant WHERE id = 1').get() as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    gstin: row.gstin ?? undefined,
    fssai: row.fssai ?? undefined,
    logoPath: row.logo_path ?? undefined,
    currency: row.currency,
  };
}

export function updateRestaurant(data: Partial<Omit<Restaurant, 'id'>>): Restaurant | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.gstin !== undefined) { fields.push('gstin = ?'); values.push(data.gstin); }
  if (data.fssai !== undefined) { fields.push('fssai = ?'); values.push(data.fssai); }
  if (data.logoPath !== undefined) { fields.push('logo_path = ?'); values.push(data.logoPath); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }

  if (fields.length === 0) return getRestaurant();

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE restaurant SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  return getRestaurant();
}

export function getRoles(): Role[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM roles ORDER BY id').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    permissions: JSON.parse(row.permissions),
  }));
}

export function updateRole(id: number, permissions: string[]): Role | undefined {
  const db = getDb();
  db.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), id);
  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    permissions: JSON.parse(row.permissions),
  };
}

function mapSetting(row: any): Setting {
  return {
    key: row.key,
    value: row.value,
    category: row.category,
  };
}
