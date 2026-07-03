import type { Migration } from './runner';

export const uniqueKotNumber: Migration = {
  version: 4,
  name: 'unique_kot_number',
  up(db) {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_kots_kot_number ON kots(kot_number);`);
  },
};
