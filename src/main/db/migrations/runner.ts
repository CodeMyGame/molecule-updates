import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  // Create the migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const getApplied = db.prepare('SELECT version FROM _migrations');
  const appliedVersions = new Set(
    getApplied.all().map((row: any) => row.version)
  );

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, name) VALUES (?, ?)'
  );

  // Sort migrations by version and run in order
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sorted) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    console.log(`Running migration ${migration.version}: ${migration.name}`);

    const runInTransaction = db.transaction(() => {
      migration.up(db);
      insertMigration.run(migration.version, migration.name);
    });

    runInTransaction();

    console.log(`Migration ${migration.version} applied successfully`);
  }
}
