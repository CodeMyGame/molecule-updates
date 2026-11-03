import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;
let checkpointTimer: NodeJS.Timeout | null = null;

export function checkpointWal(mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE'): void {
  if (!db) return;
  try {
    db.pragma(`wal_checkpoint(${mode})`);
  } catch {
    // If database is busy or locked, back off safely
  }
}

export function getDbPath(): string {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'molecule.db');
  } catch {
    // Fallback when app is not ready (e.g., during testing)
    return path.join(process.cwd(), 'molecule.db');
  }
}

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDbPath();
  db = new Database(dbPath);

  // Performance and reliability pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('wal_autocheckpoint = 1000');

  // Periodic passive WAL checkpoint every 30 minutes to prevent WAL log bloat
  if (!checkpointTimer) {
    checkpointTimer = setInterval(() => {
      checkpointWal('PASSIVE');
    }, 30 * 60 * 1000);
    checkpointTimer.unref?.();
  }

  return db;
}

export function closeDb(): void {
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
  }
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    db.close();
    db = null;
  }
}

export { db };
