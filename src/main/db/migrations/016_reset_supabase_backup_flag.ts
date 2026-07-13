import type { Migration } from './runner';

export const resetSupabaseBackupFlag: Migration = {
  version: 16,
  name: 'reset_supabase_backup_flag',
  up: (db) => {
    try {
      db.prepare("DELETE FROM settings WHERE key = 'last_supabase_backup'").run();
    } catch {
      // settings table might not have been created yet during initial run (handled by migration 1 anyway)
    }
  },
};
