import { getDb } from '../connection';
import type { Customer, LoyaltyTransaction } from '../../../shared/types/customer.types';

export function getAll(): Customer[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM customers ORDER BY name').all() as any[];
  return rows.map(mapCustomer);
}

export function getById(id: number): Customer | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
  return row ? mapCustomer(row) : undefined;
}

export function search(query: string): Customer[] {
  const db = getDb();
  const pattern = `%${query}%`;
  const rows = db.prepare(
    'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name'
  ).all(pattern, pattern) as any[];
  return rows.map(mapCustomer);
}

export function create(data: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'totalVisits'>): Customer {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.phone ?? null,
    data.email ?? null,
    data.address ?? null,
    data.notes ?? null,
  );
  return getById(result.lastInsertRowid as number)!;
}

export function update(id: number, data: Partial<Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'totalVisits'>>): Customer | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

  if (fields.length === 0) return getById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

export function recordVisit(customerId: number, amountSpent: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE customers
    SET total_spent = total_spent + ?, total_visits = total_visits + 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(amountSpent, customerId);
}

export function findByPhone(phone: string): Customer | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone) as any;
  return row ? mapCustomer(row) : undefined;
}

export function getLoyalty(customerId: number): LoyaltyTransaction[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC'
  ).all(customerId) as any[];
  return rows.map(mapLoyaltyTransaction);
}

export function addLoyalty(
  customerId: number,
  orderId: number | null,
  points: number,
  description: string,
): LoyaltyTransaction {
  const db = getDb();

  const addInTransaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO loyalty_transactions (customer_id, order_id, points, description)
      VALUES (?, ?, ?, ?)
    `).run(customerId, orderId, points, description);

    db.prepare(`
      UPDATE customers
      SET loyalty_points = loyalty_points + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(points, customerId);

    return result.lastInsertRowid as number;
  });

  const id = addInTransaction();
  const row = db.prepare('SELECT * FROM loyalty_transactions WHERE id = ?').get(id) as any;
  return mapLoyaltyTransaction(row);
}

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    loyaltyPoints: row.loyalty_points,
    totalSpent: row.total_spent,
    totalVisits: row.total_visits,
    notes: row.notes ?? undefined,
  };
}

function mapLoyaltyTransaction(row: any): LoyaltyTransaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id ?? undefined,
    points: row.points,
    description: row.description,
    createdAt: row.created_at,
  };
}
