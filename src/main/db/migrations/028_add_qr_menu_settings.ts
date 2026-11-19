import Database from 'better-sqlite3';
import type { Migration } from './runner';

export const addQrMenuSettings: Migration = {
  version: 28,
  name: 'add_qr_menu_settings',
  up: (db: Database.Database) => {
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, category)
      VALUES (?, ?, 'qr_menu')
    `);

    insertSetting.run('qr_menu_network_enabled', 'true');
    insertSetting.run('qr_menu_subtitle', 'Scan to browse our digital menu');
    insertSetting.run('qr_menu_theme', 'noir');
    insertSetting.run('qr_menu_style', 'rounded');
    insertSetting.run('qr_menu_table_card_title', 'Scan for Digital Menu');
    insertSetting.run('qr_menu_table_card_subtitle', 'Point phone camera at QR code to view live menu & specials');
  },
};
