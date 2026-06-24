/**
 * Sync engine — CRDT delta sync via cr-sqlite + local snapshot serialization.
 *
 * Cloud sync (`pushChanges` / `pullChanges`) exchanges conflict-free `crsql_changes`
 * deltas — see `crsql-changes.ts`. The JSON snapshot helpers below are retained for the
 * local encrypted backup/export path only (they also run under sql.js in tests, where
 * cr-sqlite's `crsql_changes` is unavailable).
 */

import type { Database, Row } from '../storage/database.ts';
import type { CloudProvider } from './cloud-provider.ts';
import { pushDeltas, pullDeltas } from './crsql-changes.ts';
import { SYNC_TABLES } from './sync-tables.ts';

export { SYNC_TABLES };

type TableSnapshot = {
  readonly table: string;
  readonly rows: readonly Row[];
};

type DatabaseSnapshot = readonly TableSnapshot[];

/**
 * Export all syncable table data from the database as a Uint8Array (JSON).
 * Used for the local encrypted backup/export path.
 */
export async function exportDatabaseSnapshot(db: Database): Promise<Uint8Array> {
  const snapshot: TableSnapshot[] = [];
  for (const table of SYNC_TABLES) {
    const rows = await db.execO(`SELECT * FROM ${table}`);
    snapshot.push({ table, rows });
  }
  const json = JSON.stringify(snapshot);
  return new TextEncoder().encode(json);
}

/**
 * Import a snapshot into the database using INSERT OR REPLACE.
 * Used for the local encrypted backup/restore path.
 */
export async function importDatabaseSnapshot(db: Database, data: Uint8Array): Promise<void> {
  const json = new TextDecoder().decode(data);
  const snapshot: DatabaseSnapshot = JSON.parse(json) as DatabaseSnapshot;

  for (const { table, rows } of snapshot) {
    if (!SYNC_TABLES.includes(table as (typeof SYNC_TABLES)[number])) {
      continue; // skip unknown tables
    }
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((col) => row[col] ?? null);
      await db.exec(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );
    }
  }
}

/**
 * Push local CRDT changes to the cloud provider as a per-device delta file.
 * Encrypts when a DEK is provided; uploads plaintext when `dek` is null.
 */
export async function pushChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  await pushDeltas(db, provider, dek);
}

/**
 * Pull and merge every peer's CRDT changes from the cloud provider.
 * Conflict-free (cr-sqlite merge); no-op when there are no peer delta files.
 */
export async function pullChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  await pullDeltas(db, provider, dek);
}
