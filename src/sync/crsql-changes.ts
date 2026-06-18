/**
 * cr-sqlite delta sync — conflict-free multi-device sync over a `CloudProvider`.
 *
 * Each device exports its local CRDT change-log (`crsql_changes`) and uploads it to a
 * file keyed by its own cr-sqlite site id (`changes-<siteid>.bin`). On pull, a device
 * downloads every peer's change file (all `changes-*.bin` except its own), decrypts, and
 * replays the rows via `INSERT INTO crsql_changes`. cr-sqlite merges conflict-free, so
 * no device ever overwrites another's file and no user prompt is ever required.
 *
 * `crsql_changes` rows contain binary (`pk`, `val`, `site_id`) and big-integer
 * (`col_version`, `db_version`, `seq`) columns, so a typed JSON codec is used instead of
 * the plain snapshot serializer.
 */

import type { Database, SqlValue } from '../storage/database.ts';
import type { CloudProvider } from './cloud-provider.ts';
import { encrypt, decrypt, encodeBlob, decodeBlob } from '../crypto/encryption.ts';
import { savePushState, savePullState, getSyncState } from './sync-state.ts';

const CHANGES_PREFIX = 'changes-';
const CHANGES_SUFFIX = '.bin';

/** Columns of the `crsql_changes` virtual table (cr-sqlite 0.16), in fixed order. */
const CHANGE_COLUMNS = '"table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"';
const CHANGE_PLACEHOLDERS = new Array(9).fill('?').join(', ');

/** A single value within a change row — may be binary or a big integer. */
type ChangeValue = string | number | bigint | null | Uint8Array;
type ChangeRow = readonly ChangeValue[];

// --- typed JSON codec (binary- and bigint-safe) -----------------------------------------

type EncodedValue = string | number | null | { readonly t: 'b' | 'i'; readonly v: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  // btoa is available in browsers and modern Node (>= 16).
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeValue(value: ChangeValue): EncodedValue {
  if (value === null) return null;
  if (value instanceof Uint8Array) return { t: 'b', v: bytesToBase64(value) };
  if (typeof value === 'bigint') return { t: 'i', v: value.toString() };
  return value;
}

function decodeValue(encoded: EncodedValue): ChangeValue {
  if (encoded === null) return null;
  if (typeof encoded === 'object') {
    return encoded.t === 'b' ? base64ToBytes(encoded.v) : BigInt(encoded.v);
  }
  return encoded;
}

/** Serialize change rows to a JSON byte array (binary/bigint preserved). */
export function serializeChanges(rows: readonly ChangeRow[]): Uint8Array {
  const encoded = rows.map((row) => row.map(encodeValue));
  return new TextEncoder().encode(JSON.stringify(encoded));
}

/** Inverse of {@link serializeChanges}. */
export function deserializeChanges(data: Uint8Array): ChangeRow[] {
  const parsed = JSON.parse(new TextDecoder().decode(data)) as EncodedValue[][];
  return parsed.map((row) => row.map(decodeValue));
}

// --- database helpers -------------------------------------------------------------------

/** This database's cr-sqlite site id as a lowercase hex string. */
export async function getSiteId(db: Database): Promise<string> {
  const rows = await db.execA('SELECT lower(hex(crsql_site_id()))');
  const id = rows[0]?.[0];
  return typeof id === 'string' ? id : String(id ?? '');
}

/** Export the full local CRDT change-log. */
export async function exportLocalChanges(db: Database): Promise<ChangeRow[]> {
  return (await db.execA(`SELECT ${CHANGE_COLUMNS} FROM crsql_changes`)) as ChangeRow[];
}

/** Replay peer change rows into the local database; cr-sqlite merges conflict-free. */
export async function applyRemoteChanges(db: Database, rows: readonly ChangeRow[]): Promise<void> {
  for (const row of rows) {
    await db.exec(
      `INSERT INTO crsql_changes (${CHANGE_COLUMNS}) VALUES (${CHANGE_PLACEHOLDERS})`,
      row as SqlValue[],
    );
  }
}

// --- cloud orchestration ----------------------------------------------------------------

function changeFilename(siteId: string): string {
  return `${CHANGES_PREFIX}${siteId}${CHANGES_SUFFIX}`;
}

function isChangeFile(name: string): boolean {
  return name.startsWith(CHANGES_PREFIX) && name.endsWith(CHANGES_SUFFIX);
}

/**
 * Push this device's CRDT changes to the cloud as `changes-<siteid>.bin`.
 * Encrypts when a DEK is provided; uploads plaintext when `dek` is null (local-only mode).
 */
export async function pushDeltas(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const siteId = await getSiteId(db);
  const rows = await exportLocalChanges(db);
  const plaintext = serializeChanges(rows);

  const payload = dek ? encodeBlob(await encrypt(dek, plaintext)) : plaintext;
  await provider.upload(changeFilename(siteId), payload);

  const state = await getSyncState();
  await savePushState(state.lastPushedVersion + 1);
}

/**
 * Pull every peer's CRDT changes (all `changes-*.bin` except this device's own) and
 * merge them locally. No-op when there are no peer files.
 */
export async function pullDeltas(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const ownFile = changeFilename(await getSiteId(db));
  const files = await provider.list();

  let appliedAny = false;
  for (const file of files) {
    if (!isChangeFile(file.name) || file.name === ownFile) continue;

    const packed = await provider.download(file.name);
    if (!packed) continue;

    let plaintext: Uint8Array;
    if (dek) {
      plaintext = await decrypt(dek, decodeBlob(packed));
    } else {
      // A plaintext change file is a JSON array; encrypted blobs start with a random IV.
      const head = new TextDecoder().decode(packed.subarray(0, 8));
      if (!head.startsWith('[')) {
        throw new Error(
          'The remote data appears to be encrypted, but no passphrase is set. ' +
            'Please set up a passphrase to decrypt the synced data.',
        );
      }
      plaintext = packed;
    }

    await applyRemoteChanges(db, deserializeChanges(plaintext));
    appliedAny = true;
  }

  if (appliedAny) await savePullState();
}
