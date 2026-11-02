import Database from 'better-sqlite3';
import { Migration } from '../migrator';

export const addQrStyleSetting: Migration = {
  version: 22,
  name: 'add_qr_style_setting',
  up: (db: Database.Database) => {
    db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, category)
      VALUES ('qr_style', 'square', 'billing')
    `).run();
  },
};
