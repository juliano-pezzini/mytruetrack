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
export const SYNC_TABLES = [
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
 * Push local database state to the cloud provider.
 * Exports all data, optionally encrypts it, and uploads as a single blob.
 * When dek is null, uploads plaintext (unencrypted sync).
 */
export async function pushChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const plaintext = await exportDatabaseSnapshot(db);

  let payload: Uint8Array;
  if (dek) {
    const blob = await encrypt(dek, plaintext);
    payload = encodeBlob(blob);
  } else {
    payload = plaintext;
  }

  await provider.upload(SYNC_FILENAME, payload);

  const state = await getSyncState();
  await savePushState(state.lastPushedVersion + 1);
}

/**
 * Pull remote database state from the cloud provider.
 * Downloads, optionally decrypts, and merges into the local database.
 * When dek is null, expects plaintext snapshot (unencrypted sync).
 * No-op if no remote blob exists.
 */
export async function pullChanges(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const packed = await provider.download(SYNC_FILENAME);
  if (!packed) return; // nothing to pull

  let plaintext: Uint8Array;
  if (dek) {
    const blob = decodeBlob(packed);
    plaintext = await decrypt(dek, blob);
  } else {
    // Sanity-check: a plaintext snapshot is a JSON array of {table, rows} objects.
    // Encrypted blobs start with random IV bytes, so checking only the first byte
    // ('[') misclassifies ~1/256 of encrypted blobs as plaintext. Decode the head
    // and require both the leading '[' and a `"table"` key before trusting it.
    const head = new TextDecoder().decode(packed.subarray(0, 256));
    if (!(head.startsWith('[') && head.includes('"table"'))) {
      throw new Error(
        'The remote data appears to be encrypted, but no passphrase is set. ' +
          'Please set up a passphrase to decrypt the synced data.',
      );
    }
    plaintext = packed;
  }

  await importDatabaseSnapshot(db, plaintext);

  await savePullState();
}
