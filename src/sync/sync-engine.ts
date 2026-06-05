/**
 * Sync engine — export/import database snapshots, push/pull via CloudProvider.
 *
 * Design: In Node.js tests we serialize all table rows as JSON → encrypt → upload.
 * In production, cr-sqlite's `crsql_changes` will be used instead. This module
 * provides the encrypt-upload / download-decrypt plumbing that both approaches share.
 */

import type { Database, Row } from '../storage/database.ts';
import type { CloudProvider } from './cloud-provider.ts';
import { encrypt, decrypt, encodeBlob, decodeBlob } from '../crypto/encryption.ts';
import { savePushState, savePullState, getSyncState } from './sync-state.ts';

const SYNC_FILENAME = 'sync-blob.bin';

/** Tables to sync, in dependency-safe insertion order. */
const SYNC_TABLES = [
  'accounts',
  'categories',
  'tags',
  'transactions',
  'transaction_tags',
  'account_balances',
  'auto_category_rules',
  'learned_category_patterns',
  'auto_category_corrections',
] as const;

type TableSnapshot = {
  readonly table: string;
  readonly rows: readonly Row[];
};

type DatabaseSnapshot = readonly TableSnapshot[];

/**
 * Export all syncable table data from the database as a Uint8Array (JSON).
 */
export function exportDatabaseSnapshot(db: Database): Uint8Array {
  const snapshot: TableSnapshot[] = [];
  for (const table of SYNC_TABLES) {
    const rows = db.execO(`SELECT * FROM ${table}`);
    snapshot.push({ table, rows });
  }
  const json = JSON.stringify(snapshot);
  return new TextEncoder().encode(json);
}

/**
 * Import a snapshot into the database using INSERT OR REPLACE.
 */
export function importDatabaseSnapshot(db: Database, data: Uint8Array): void {
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
      db.exec(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
      );
    }
  }
}

/**
 * Push local database state to the cloud provider.
 * Exports all data, encrypts it, and uploads as a single blob.
 */
export async function pushChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey,
): Promise<void> {
  const plaintext = exportDatabaseSnapshot(db);
  const blob = await encrypt(dek, plaintext);
  const packed = encodeBlob(blob);
  await provider.upload(SYNC_FILENAME, packed);

  const state = await getSyncState();
  await savePushState(state.lastPushedVersion + 1);
}

/**
 * Pull remote database state from the cloud provider.
 * Downloads, decrypts, and merges into the local database.
 * No-op if no remote blob exists.
 */
export async function pullChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey,
): Promise<void> {
  const packed = await provider.download(SYNC_FILENAME);
  if (!packed) return; // nothing to pull

  const blob = decodeBlob(packed);
  const plaintext = await decrypt(dek, blob);
  importDatabaseSnapshot(db, plaintext);

  await savePullState();
}
