import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const defaultPaperAndFontSize: Migration = {
  version: 21,
  name: 'default_paper_and_font_size',
  up: (db: Database.Database) => {
    // If settings table exists, insert new defaults if missing
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('paper_width', '58mm', 'billing')`).run();
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('bill_font_size', 'small', 'billing')`).run();
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('kot_font_size', 'small', 'billing')`).run();
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('dynamic_qr_bill', 'false', 'billing')`).run();
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('upi_id', '', 'billing')`).run();
    db.prepare(`INSERT OR IGNORE INTO settings (key, value, category) VALUES ('upi_payee_name', '', 'billing')`).run();

    // If existing values are still the old defaults (80mm / medium), update them to the new defaults
    db.prepare(`UPDATE settings SET value = '58mm' WHERE key = 'paper_width' AND value = '80mm'`).run();
    db.prepare(`UPDATE settings SET value = 'small' WHERE key = 'bill_font_size' AND value = 'medium'`).run();
    db.prepare(`UPDATE settings SET value = 'small' WHERE key = 'kot_font_size' AND value = 'medium'`).run();
    db.prepare(`UPDATE settings SET value = 'false' WHERE key = 'dynamic_qr_bill' AND value = 'true'`).run();
  },
};
