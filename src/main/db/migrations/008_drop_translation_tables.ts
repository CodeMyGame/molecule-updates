import type { Migration } from './runner';

/** Remove legacy API/DB translation storage (UI now uses locale JSON files). */
export const dropTranslationTables: Migration = {
  version: 8,
  name: 'drop_translation_tables',
  up(db) {
    db.exec(`
      DROP TABLE IF EXISTS ui_translations;
      DROP TABLE IF EXISTS menu_item_translations;
    `);
  },
};
