import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { Database, SqlValue } from '../storage/database.ts';
import { generateDek } from '../crypto/key-derivation.ts';
import { createMockCloudProvider } from './mock-cloud-provider.ts';
import { clearSyncState, getSyncState } from './sync-state.ts';
import { serializeChanges, deserializeChanges, pushDeltas, pullDeltas } from './crsql-changes.ts';

type ChangeValue = string | number | bigint | null | Uint8Array;

/**
 * A fake Database that emulates just enough of cr-sqlite for the delta protocol:
 * a fixed site id, a canned `crsql_changes` export, and capture of applied INSERTs.
 */
function createFakeDb(siteId: string, changes: ChangeValue[][]) {
  const applied: ChangeValue[][] = [];
  const db: Database = {
    async exec(sql: string, params?: SqlValue[]): Promise<void> {
      if (sql.includes('INSERT INTO crsql_changes') && params) {
        applied.push(params as ChangeValue[]);
      }
    },
    async execA(sql: string): Promise<SqlValue[][]> {
      if (sql.includes('crsql_site_id')) return [[siteId]];
      if (sql.includes('FROM crsql_changes')) return changes as SqlValue[][];
      return [];
    },
    async execO(): Promise<Record<string, SqlValue>[]> {
      return [];
    },
    async close(): Promise<void> {},
  };
  return { db, applied };
}

const pkBytes = new Uint8Array([1, 2, 3, 4]);
const siteBytes = new Uint8Array([0xaa, 0xbb]);

/** A representative crsql_changes row: text, blob, int, text, bigints, blob, int, bigint. */
const rowA: ChangeValue[] = ['accounts', pkBytes, 0, 'Account A', 1n, 1n, siteBytes, 0, 1n];
const rowB: ChangeValue[] = ['transactions', pkBytes, 0, 'From B', 2n, 2n, siteBytes, 0, 2n];

describe('crsql-changes codec', () => {
  it('round-trips strings, numbers, null, blobs, and bigints', () => {
    const rows: ChangeValue[][] = [
      ['accounts', pkBytes, 0, null, 9007199254740993n, 5n, siteBytes, 0, 42n],
    ];
    const restored = deserializeChanges(serializeChanges(rows));
    expect(restored).toEqual(rows);
    // bigint identity preserved beyond Number.MAX_SAFE_INTEGER
    expect(restored[0]![4]).toBe(9007199254740993n);
    // blob round-trips as Uint8Array
    expect(restored[0]![1]).toBeInstanceOf(Uint8Array);
    expect(Array.from(restored[0]![1] as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('produces a JSON array payload', () => {
    const text = new TextDecoder().decode(serializeChanges([rowA]));
    expect(text.startsWith('[')).toBe(true);
  });
});

describe('pushDeltas / pullDeltas', () => {
  let dek: CryptoKey;

  beforeEach(async () => {
    dek = await generateDek();
    await clearSyncState();
  });

  it('pushes this device changes to changes-<siteid>.bin and round-trips', async () => {
    const { db } = createFakeDb('aa', [rowA]);
    const provider = createMockCloudProvider();

    await pushDeltas(db, provider, dek);

    const names = (await provider.list()).map((f) => f.name);
    expect(names).toContain('changes-aa.bin');

    const packed = await provider.download('changes-aa.bin');
    expect(packed).not.toBeNull();
  });

  it('encrypts the uploaded payload (no plaintext leak)', async () => {
    const { db } = createFakeDb('aa', [rowA]);
    const provider = createMockCloudProvider();

    await pushDeltas(db, provider, dek);

    const raw = await provider.download('changes-aa.bin');
    const asText = new TextDecoder().decode(raw!);
    expect(asText).not.toContain('Account A');
  });

  it('pull applies peer files and skips this device own file', async () => {
    const provider = createMockCloudProvider();

    // Peer "bb" has uploaded its changes.
    const peer = createFakeDb('bb', [rowB]);
    await pushDeltas(peer.db, provider, dek);

    // This device "aa" also has a file in the folder (must be skipped on pull).
    const self = createFakeDb('aa', [rowA]);
    await pushDeltas(self.db, provider, dek);

    // Pulling into "aa" should apply only peer "bb" rows.
    await pullDeltas(self.db, provider, dek);

    expect(self.applied).toHaveLength(1);
    expect(self.applied[0]).toEqual(rowB);
  });

  it('updates sync state after push and pull', async () => {
    const provider = createMockCloudProvider();
    const peer = createFakeDb('bb', [rowB]);
    await pushDeltas(peer.db, provider, dek);

    const self = createFakeDb('aa', [rowA]);
    await pushDeltas(self.db, provider, dek);
    // peer push incremented to 1, this device push to 2 (shared local state)
    expect((await getSyncState()).lastPushedVersion).toBe(2);

    await pullDeltas(self.db, provider, dek);
    expect((await getSyncState()).lastPulledAt).not.toBeNull();
  });

  it('pull is a no-op when there are no peer files', async () => {
    const provider = createMockCloudProvider();
    const self = createFakeDb('aa', [rowA]);

    await pullDeltas(self.db, provider, dek); // empty folder
    expect(self.applied).toHaveLength(0);
  });

  describe('unencrypted (null dek)', () => {
    it('uploads plaintext and applies it on pull', async () => {
      const provider = createMockCloudProvider();
      const peer = createFakeDb('bb', [rowB]);
      await pushDeltas(peer.db, provider, null);

      const raw = await provider.download('changes-bb.bin');
      expect(new TextDecoder().decode(raw!).startsWith('[')).toBe(true);

      const self = createFakeDb('aa', []);
      await pullDeltas(self.db, provider, null);
      expect(self.applied[0]).toEqual(rowB);
    });

    it('throws when pulling encrypted data without a passphrase', async () => {
      const provider = createMockCloudProvider();
      const peer = createFakeDb('bb', [rowB]);
      await pushDeltas(peer.db, provider, dek); // encrypted

      const self = createFakeDb('aa', []);
      await expect(pullDeltas(self.db, provider, null)).rejects.toThrow(/encrypted/i);
    });
  });
});
