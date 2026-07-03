import { Migration } from './runner';

export const addCreatedAtToKots: Migration = {
  version: 3,
  name: 'add_created_at_to_kots',
  up(db) {
    db.exec(`ALTER TABLE kots ADD COLUMN created_at TEXT;`);
    db.exec(`UPDATE kots SET created_at = printed_at WHERE created_at IS NULL;`);
  },
};
