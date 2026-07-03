import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;

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

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export { db };
