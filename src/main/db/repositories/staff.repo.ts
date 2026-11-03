import { getDb } from '../connection';
import bcrypt from 'bcryptjs';
import { Worker } from 'worker_threads';
import type { Staff, Role, Attendance, CreateStaffDTO } from '../../../shared/types/staff.types';

// In-memory verified PIN cache (pin -> staffId) to make repeat unlocks instantaneous (0ms)
const pinCache = new Map<string, number>();

export function clearPinCache(): void {
  pinCache.clear();
}

export function getAll(): Staff[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
    FROM staff s
    JOIN roles r ON s.role_id = r.id
    WHERE s.is_active = 1
    ORDER BY s.name
  `).all() as any[];
  return rows.map(mapStaffWithRole);
}

export function getById(id: number): Staff | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
    FROM staff s
    JOIN roles r ON s.role_id = r.id
    WHERE s.id = ?
  `).get(id) as any;
  return row ? mapStaffWithRole(row) : undefined;
}

export function create(data: CreateStaffDTO): Staff {
  clearPinCache();
  const db = getDb();
  const pinHash = bcrypt.hashSync(data.pin, 10);

  const result = db.prepare(`
    INSERT INTO staff (name, phone, email, pin_hash, role_id, is_active, hourly_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.phone ?? null,
    data.email ?? null,
    pinHash,
    data.roleId,
    data.isActive !== false ? 1 : 0,
    data.hourlyRate,
  );

  return getById(result.lastInsertRowid as number)!;
}

export function update(id: number, data: Partial<CreateStaffDTO>): Staff | undefined {
  clearPinCache();
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.pin !== undefined) {
    fields.push('pin_hash = ?');
    values.push(bcrypt.hashSync(data.pin, 10));
  }
  if (data.roleId !== undefined) { fields.push('role_id = ?'); values.push(data.roleId); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  if (data.hourlyRate !== undefined) { fields.push('hourly_rate = ?'); values.push(data.hourlyRate); }

  if (fields.length === 0) return getById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

export function deleteStaff(id: number): void {
  clearPinCache();
  const db = getDb();
  db.prepare("UPDATE staff SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
}

function verifyPinInWorker(
  pin: string,
  candidates: { id: number; pinHash: string }[]
): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const workerCode = `
        const { parentPort, workerData } = require('worker_threads');
        const bcrypt = require('bcryptjs');
        const { pin, candidates } = workerData;
        let matchId = null;
        for (const c of candidates) {
          if (bcrypt.compareSync(pin, c.pinHash)) {
            matchId = c.id;
            break;
          }
        }
        parentPort.postMessage({ matchId });
      `;

      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { pin, candidates },
      });

      worker.on('message', (msg: any) => {
        resolve(msg?.matchId ?? null);
      });

      worker.on('error', () => {
        resolve(fallbackCompare(pin, candidates));
      });
    } catch {
      resolve(fallbackCompare(pin, candidates));
    }
  });
}

async function fallbackCompare(
  pin: string,
  candidates: { id: number; pinHash: string }[]
): Promise<number | null> {
  for (const c of candidates) {
    try {
      const match = await bcrypt.compare(pin, c.pinHash);
      if (match) return c.id;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function findByPinAsync(pin: string): Promise<Staff | undefined> {
  const db = getDb();

  // 1. Check in-memory verified PIN cache for instant 0ms unlock
  const cachedStaffId = pinCache.get(pin);
  if (cachedStaffId !== undefined) {
    const cachedRow = db.prepare(`
      SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
      FROM staff s
      JOIN roles r ON s.role_id = r.id
      WHERE s.id = ? AND s.is_active = 1
    `).get(cachedStaffId) as any;

    if (cachedRow) {
      return mapStaffWithRole(cachedRow);
    }
    pinCache.delete(pin);
  }

  // 2. Fetch all active candidates
  const rows = db.prepare(`
    SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
    FROM staff s
    JOIN roles r ON s.role_id = r.id
    WHERE s.is_active = 1
  `).all() as any[];

  if (rows.length === 0) return undefined;

  const candidates = rows.map((r) => ({ id: r.id, pinHash: r.pin_hash }));
  const matchedId = await verifyPinInWorker(pin, candidates);

  if (matchedId !== null) {
    const matchedRow = rows.find((r) => r.id === matchedId);
    if (matchedRow) {
      pinCache.set(pin, matchedId);
      return mapStaffWithRole(matchedRow);
    }
  }

  return undefined;
}

export function findByPin(pin: string): Staff | undefined {
  const db = getDb();

  const cachedStaffId = pinCache.get(pin);
  if (cachedStaffId !== undefined) {
    const cachedRow = db.prepare(`
      SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
      FROM staff s
      JOIN roles r ON s.role_id = r.id
      WHERE s.id = ? AND s.is_active = 1
    `).get(cachedStaffId) as any;

    if (cachedRow) {
      return mapStaffWithRole(cachedRow);
    }
    pinCache.delete(pin);
  }

  const rows = db.prepare(`
    SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
    FROM staff s
    JOIN roles r ON s.role_id = r.id
    WHERE s.is_active = 1
  `).all() as any[];

  for (const row of rows) {
    if (bcrypt.compareSync(pin, row.pin_hash)) {
      pinCache.set(pin, row.id);
      return mapStaffWithRole(row);
    }
  }
  return undefined;
}

export function clockIn(staffId: number): Attendance {
  const db = getDb();
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const clockInTime = now.toISOString();

  // If there's already an active open session (clock_out is null), return it
  const openSession = db.prepare(`
    SELECT * FROM attendance
    WHERE staff_id = ? AND clock_out IS NULL
    ORDER BY clock_in DESC, id DESC LIMIT 1
  `).get(staffId) as any;

  if (openSession) {
    return mapAttendance(openSession);
  }

  const result = db.prepare(`
    INSERT INTO attendance (staff_id, clock_in, date)
    VALUES (?, ?, ?)
  `).run(staffId, clockInTime, date);

  return {
    id: result.lastInsertRowid as number,
    staffId,
    clockIn: clockInTime,
    date,
  };
}

export function clockOut(staffId: number): Attendance | undefined {
  const db = getDb();
  const clockOutTime = new Date().toISOString();

  // Find the open session (most recent without clock_out) for this staff member
  const openSession = db.prepare(`
    SELECT * FROM attendance
    WHERE staff_id = ? AND clock_out IS NULL
    ORDER BY clock_in DESC, id DESC LIMIT 1
  `).get(staffId) as any;

  if (openSession) {
    db.prepare('UPDATE attendance SET clock_out = ? WHERE id = ?').run(clockOutTime, openSession.id);
    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(openSession.id) as any;
    return updated ? mapAttendance(updated) : undefined;
  }

  const date = new Date().toISOString().split('T')[0];
  const row = db.prepare(
    'SELECT * FROM attendance WHERE staff_id = ? AND date = ? ORDER BY id DESC LIMIT 1'
  ).get(staffId, date) as any;

  return row ? mapAttendance(row) : undefined;
}

export function getAttendance(
  staffId?: number,
  dateRange?: { startDate: string; endDate: string },
): Attendance[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (staffId !== undefined) {
    conditions.push('staff_id = ?');
    params.push(staffId);
  }
  if (dateRange?.startDate) {
    conditions.push('date >= ?');
    params.push(dateRange.startDate);
  }
  if (dateRange?.endDate) {
    conditions.push('date <= ?');
    params.push(dateRange.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM attendance ${where} ORDER BY date DESC, clock_in DESC`).all(...params) as any[];
  return rows.map(mapAttendance);
}

function mapStaffWithRole(row: any): Staff {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    pinHash: row.pin_hash,
    roleId: row.role_id,
    isActive: !!row.is_active,
    hourlyRate: row.hourly_rate,
    role: row.role_name
      ? {
          id: row.role_id,
          name: row.role_name,
          permissions: JSON.parse(row.role_permissions),
        }
      : undefined,
  };
}

function mapAttendance(row: any): Attendance {
  return {
    id: row.id,
    staffId: row.staff_id,
    clockIn: row.clock_in,
    clockOut: row.clock_out ?? undefined,
    date: row.date,
  };
}
