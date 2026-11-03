import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const allowMultipleAttendanceShifts: Migration = {
  version: 23,
  name: 'allow_multiple_attendance_shifts',
  up: (db: Database.Database) => {
    // Recreate attendance table without UNIQUE(staff_id, date) constraint to support split shifts
    db.exec(`
      DROP TABLE IF EXISTS attendance_new;
      CREATE TABLE IF NOT EXISTS attendance_new (
        id INTEGER PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id),
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        date TEXT NOT NULL
      );
      INSERT INTO attendance_new (id, staff_id, clock_in, clock_out, date)
        SELECT id, staff_id, clock_in, clock_out, date FROM attendance;
      DROP TABLE attendance;
      ALTER TABLE attendance_new RENAME TO attendance;
      CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    `);
  },
};
