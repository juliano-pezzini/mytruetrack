import type { Database } from './database.ts';
import { SYNC_TABLES } from '../sync/sync-tables.ts';

/**
 * Delete every row from all data tables, leaving an empty but structurally intact database.
 *
 * Rows are removed with `DELETE FROM` (not `DROP TABLE`) so that cr-sqlite records the
 * deletions as CRR tombstones — this is what lets the wipe propagate to other devices on the
 * next sync push. Dropping/recreating tables would discard the change-tracking and break
 * convergence.
 *
 * The deletes run inside a single transaction so the wipe is atomic: a mid-wipe failure
 * rolls back completely rather than leaving some tables empty and others populated.
 *
 * Tables are cleared in reverse dependency order (junction/child tables first) so the
 * operation stays valid even if foreign-key enforcement is ever enabled.
 */
export async function clearAllData(db: Database): Promise<void> {
  await db.exec('BEGIN');
  try {
    for (const table of [...SYNC_TABLES].reverse()) {
      await db.exec(`DELETE FROM "${table}"`);
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
