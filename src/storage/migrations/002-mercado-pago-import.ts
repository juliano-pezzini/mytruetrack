import type { Migration } from './types.ts';

export const migration002: Migration = {
  version: 2,
  name: 'mercado-pago-import',
  up: [
    `ALTER TABLE accounts ADD COLUMN bank_code TEXT DEFAULT ''`,
    `ALTER TABLE transactions ADD COLUMN import_run_id TEXT DEFAULT ''`,
    `CREATE TABLE account_import_logs (
      id              TEXT PRIMARY KEY NOT NULL,
      account_id      TEXT NOT NULL DEFAULT '',
      source          TEXT NOT NULL DEFAULT '',
      period_start    TEXT NOT NULL DEFAULT '',
      period_end      TEXT NOT NULL DEFAULT '',
      imported_at     TEXT NOT NULL DEFAULT '',
      imported_count  INTEGER NOT NULL DEFAULT 0,
      skipped_count   INTEGER NOT NULL DEFAULT 0,
      error_count     INTEGER NOT NULL DEFAULT 0
    )`,
  ],
};
