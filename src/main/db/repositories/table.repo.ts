import { getDb } from '../connection';
import type { Table, Floor, CreateTableDTO, UpdateTableDTO } from '../../../shared/types/table.types';
import { TableStatus } from '../../../shared/enums';

export function getAll(): (Table & { floorName: string })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, f.name AS floor_name
    FROM tables t
    JOIN floors f ON t.floor_id = f.id
    ORDER BY f.name, t.is_pinned DESC, t.name
  `).all() as any[];
  return rows.map((row) => ({
    ...mapTable(row),
    floorName: row.floor_name,
  }));
}

export function getByFloor(floorId: number): Table[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tables WHERE floor_id = ? ORDER BY is_pinned DESC, name').all(floorId) as any[];
  return rows.map(mapTable);
}

export function create(data: CreateTableDTO): Table {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO tables (floor_id, name, capacity, pos_x, pos_y, shape, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.floorId, data.name, data.capacity, data.posX, data.posY, data.shape, TableStatus.FREE);
  const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid as number) as any;
  return mapTable(row);
}

export function update(id: number, data: Omit<UpdateTableDTO, 'id'>): Table | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.floorId !== undefined) { fields.push('floor_id = ?'); values.push(data.floorId); }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.capacity !== undefined) { fields.push('capacity = ?'); values.push(data.capacity); }
  if (data.posX !== undefined) { fields.push('pos_x = ?'); values.push(data.posX); }
  if (data.posY !== undefined) { fields.push('pos_y = ?'); values.push(data.posY); }
  if (data.shape !== undefined) { fields.push('shape = ?'); values.push(data.shape); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

  if (fields.length === 0) {
    const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as any;
    return row ? mapTable(row) : undefined;
  }

  values.push(id);
  db.prepare(`UPDATE tables SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as any;
  return row ? mapTable(row) : undefined;
}

export function deleteTable(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM tables WHERE id = ?').run(id);
}

// Force-deletes a table by snapshotting its name into past orders, then nulling
// the table_id reference so the row can be removed without losing history.
function forceDeleteTableInner(db: ReturnType<typeof getDb>, id: number): void {
  db.prepare(
    `UPDATE orders
     SET table_name_snapshot = COALESCE(table_name_snapshot, (SELECT name FROM tables WHERE id = ?))
     WHERE table_id = ?`
  ).run(id, id);
  db.prepare('UPDATE orders SET table_id = NULL WHERE table_id = ?').run(id);
  db.prepare('DELETE FROM tables WHERE id = ?').run(id);
}

export function forceDeleteTable(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => forceDeleteTableInner(db, id));
  tx();
}

export function updateStatus(id: number, status: TableStatus): Table | undefined {
  const db = getDb();
  db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, id);
  const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as any;
  return row ? mapTable(row) : undefined;
}

export function getFloors(): Floor[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM floors ORDER BY name').all() as any[];
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export function createFloor(name: string): Floor {
  const db = getDb();
  const result = db.prepare('INSERT INTO floors (name) VALUES (?)').run(name);
  return { id: result.lastInsertRowid as number, name };
}

export function updateFloor(id: number, name: string): Floor {
  const db = getDb();
  db.prepare('UPDATE floors SET name = ? WHERE id = ?').run(name, id);
  return { id, name };
}

export function deleteFloor(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM floors WHERE id = ?').run(id);
}

// Force-deletes a floor by force-deleting every table on it first.
export function forceDeleteFloor(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const tbls = db.prepare('SELECT id FROM tables WHERE floor_id = ?').all(id) as { id: number }[];
    for (const t of tbls) forceDeleteTableInner(db, t.id);
    db.prepare('DELETE FROM floors WHERE id = ?').run(id);
  });
  tx();
}

function mapTable(row: any): Table {
  return {
    id: row.id,
    floorId: row.floor_id,
    name: row.name,
    capacity: row.capacity,
    posX: row.pos_x,
    posY: row.pos_y,
    shape: row.shape,
    status: row.status as TableStatus,
    isPinned: !!row.is_pinned,
  };
}

export function togglePin(id: number): Table | undefined {
  const db = getDb();
  db.prepare('UPDATE tables SET is_pinned = 1 - is_pinned WHERE id = ?').run(id);
  const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as any;
  return row ? mapTable(row) : undefined;
}
