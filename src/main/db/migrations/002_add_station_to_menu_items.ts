import type { Migration } from './runner';

export const addStationToMenuItems: Migration = {
  version: 2,
  name: 'add_station_to_menu_items',
  up(db) {
    db.exec(`
      ALTER TABLE menu_items ADD COLUMN station TEXT;
    `);
  },
};
