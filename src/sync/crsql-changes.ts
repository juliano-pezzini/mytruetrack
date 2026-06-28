/**
 * cr-sqlite delta sync — conflict-free multi-device sync over a `CloudProvider`.
 *
 * Redo-log model: each device ships only the changes made *since its last push* as an
 * append-only segment file `changes-<siteid>-<dbversion>.bin`, where `<dbversion>` is the
 * highest local cr-sqlite `db_version` the segment includes. On pull, a device downloads
 * every peer segment newer than the per-peer high-water mark it has already applied (in
 * ascending version order), decrypts, and replays the rows via `INSERT INTO crsql_changes`.
 * cr-sqlite merges conflict-free, so no device overwrites another's data and no user prompt
 * is ever required.
 *
 * Because the export is filtered by `db_version`, a push transfers only the delta rather
 * than the full compacted state. The bootstrap push (watermark 0) ships everything; a new
 * peer joining later replays every retained segment to catch up.
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
const CHANGE_COLUMNS =
  '"table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"';
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
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(
      'Could not determine the cr-sqlite site id (crsql_site_id() returned no value). ' +
        'Delta sync cannot proceed without it — peer change files would collide on "changes-.bin".',
    );
  }
  return id;
}

/** This database's current cr-sqlite `db_version` (the max version of any local change). */
export async function getDbVersion(db: Database): Promise<number> {
  const rows = await db.execA('SELECT crsql_db_version()');
  const value = rows[0]?.[0];
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return 0;
}

/**
 * Export the local CRDT change-log for every change with `db_version` greater than
 * `sinceVersion` and at most `untilVersion` (inclusive). When `untilVersion` is omitted the
 * export is unbounded (useful for tests); `pushDeltas` always passes the snapshot version so
 * the segment contents match the segment filename/watermark.
 */
export async function exportLocalChanges(
  db: Database,
  sinceVersion = 0,
  untilVersion?: number,
): Promise<ChangeRow[]> {
  if (untilVersion !== undefined) {
    return (await db.execA(
      `SELECT ${CHANGE_COLUMNS} FROM crsql_changes WHERE db_version > ? AND db_version <= ?`,
      [sinceVersion, untilVersion],
    )) as ChangeRow[];
  }
  return (await db.execA(`SELECT ${CHANGE_COLUMNS} FROM crsql_changes WHERE db_version > ?`, [
    sinceVersion,
  ])) as ChangeRow[];
}

/** Replay peer change rows into the local database; cr-sqlite merges conflict-free. */
export async function applyRemoteChanges(db: Database, rows: readonly ChangeRow[]): Promise<void> {
  if (rows.length === 0) return;
  // Wrap the replay in a single transaction: far faster than per-row autocommit and
  // atomic, so a mid-stream failure rolls back instead of leaving a partial merge.
  await db.exec('BEGIN');
  try {
    for (const row of rows) {
      await db.exec(
        `INSERT INTO crsql_changes (${CHANGE_COLUMNS}) VALUES (${CHANGE_PLACEHOLDERS})`,
        row as SqlValue[],
      );
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

// --- cloud orchestration ----------------------------------------------------------------

function segmentFilename(siteId: string, version: number): string {
  return `${CHANGES_PREFIX}${siteId}-${version}${CHANGES_SUFFIX}`;
}

/** site ids are lowercase hex, so the trailing `-<digits>` segment is unambiguous. */
const SEGMENT_RE = /^changes-([0-9a-f]+)-(\d+)\.bin$/;

type Segment = { readonly siteId: string; readonly version: number };

function parseSegment(name: string): Segment | null {
  const match = SEGMENT_RE.exec(name);
  if (!match) return null;
  return { siteId: match[1]!, version: Number(match[2]) };
}

/**
 * Push this device's CRDT delta since the last push as `changes-<siteid>-<dbversion>.bin`.
 * No-op when nothing changed locally. Encrypts when a DEK is provided; uploads plaintext
 * when `dek` is null (local-only mode).
 */
export async function pushDeltas(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const siteId = await getSiteId(db);
  const since = (await getSyncState()).lastPushedVersion;
  const current = await getDbVersion(db);

  // Nothing new since the last push — don't write an empty segment.
  if (current <= since) return;

  const rows = await exportLocalChanges(db, since, current);
  if (rows.length > 0) {
    const plaintext = serializeChanges(rows);
    const payload = dek ? encodeBlob(await encrypt(dek, plaintext)) : plaintext;
    await provider.upload(segmentFilename(siteId, current), payload);
  }
  // Advance the watermark even if the filtered range was empty, so we never re-scan it.
  await savePushState(current);
}

/**
 * Pull every peer segment newer than this device's per-peer high-water mark and merge it,
 * oldest-first. No-op when there are no unapplied peer segments.
 */
export async function pullDeltas(
  db: Database,
  provider: CloudProvider,
  dek: CryptoKey | null,
): Promise<void> {
  const ownSiteId = await getSiteId(db);
  const applied: Record<string, number> = { ...(await getSyncState()).appliedPeerVersions };
  const files = await provider.list();

  const segments = files
    .map((file) => parseSegment(file.name))
    .filter((seg): seg is Segment => seg !== null && seg.siteId !== ownSiteId)
    .filter((seg) => seg.version > (applied[seg.siteId] ?? 0))
    .sort((a, b) => a.version - b.version);

  let appliedAny = false;
  for (const seg of segments) {
    const packed = await provider.download(segmentFilename(seg.siteId, seg.version));
    if (!packed) continue;

    let plaintext: Uint8Array;
    if (dek) {
      plaintext = await decrypt(dek, decodeBlob(packed));
    } else {
      plaintext = packed;
    }

    // In local-only mode the file is plaintext JSON; if it's actually an encrypted blob,
    // parsing fails — surface the actionable "set a passphrase" message rather than a raw
    // JSON parse error. (A leading-byte check is unreliable: ~1/256 encrypted blobs start
    // with '['.)
    let changes: ChangeRow[];
    try {
      changes = deserializeChanges(plaintext);
    } catch {
      if (dek) throw new Error('Failed to decode synced change data.');
      throw new Error(
        'The remote data appears to be encrypted, but no passphrase is set. ' +
          'Please set up a passphrase to decrypt the synced data.',
      );
    }

    await applyRemoteChanges(db, changes);
    applied[seg.siteId] = Math.max(applied[seg.siteId] ?? 0, seg.version);
    appliedAny = true;
  }

  if (appliedAny) await savePullState(applied);
}
