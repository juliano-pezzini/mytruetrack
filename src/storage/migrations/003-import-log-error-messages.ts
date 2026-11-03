import type { Migration } from './types.ts';

export const migration003: Migration = {
  version: 3,
  name: 'import-log-error-messages',
  up: `ALTER TABLE account_import_logs ADD COLUMN error_messages TEXT NOT NULL DEFAULT ''`,
};
