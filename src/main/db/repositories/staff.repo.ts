import { getDb } from '../connection';
import bcrypt from 'bcryptjs';
import type { Staff, Role, Attendance, CreateStaffDTO } from '../../../shared/types/staff.types';

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
  const db = getDb();
  db.prepare("UPDATE staff SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function findByPin(pin: string): Staff | undefined {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.*, r.name AS role_name, r.permissions AS role_permissions
    FROM staff s
    JOIN roles r ON s.role_id = r.id
    WHERE s.is_active = 1
  `).all() as any[];

  for (const row of rows) {
    if (bcrypt.compareSync(pin, row.pin_hash)) {
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
  const date = new Date().toISOString().split('T')[0];
  const clockOutTime = new Date().toISOString();

  db.prepare(`
    UPDATE attendance SET clock_out = ?
    WHERE staff_id = ? AND date = ? AND clock_out IS NULL
  `).run(clockOutTime, staffId, date);

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
