import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  startFreshVault,
} from './sync-engine.ts';
import { createMockCloudProvider } from './mock-cloud-provider.ts';
import { pushDeltas } from './crsql-changes.ts';
import { generateDek, generateSalt } from '../crypto/key-derivation.ts';
import { saveKeyData, hasKeyData, clearKeyData } from '../crypto/key-store.ts';
import { VAULT_METADATA_FILENAME } from './vault-metadata.ts';

// Cloud push/pull now uses cr-sqlite `crsql_changes` deltas, which are unavailable under
// sql.js. Those are covered by crsql-changes.test.ts (protocol) and e2e (real merge).
// This suite covers the local snapshot backup/export serialization, which runs on sql.js.
describe('startFreshVault', () => {
  beforeEach(async () => {
    await clearKeyData();
  });

  it('clears cloud sync data and local key store', async () => {
    const provider = createMockCloudProvider();
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: generateSalt(),
      iterations: 600_000,
    });
    const dek = await generateDek();
    const siteId = 'aa';
    const db = {
      async exec(): Promise<void> {},
      async execA(sql: string): Promise<unknown[][]> {
        if (sql.includes('crsql_site_id')) return [[siteId]];
        if (sql.includes('crsql_db_version')) return [[1]];
        if (sql.includes('FROM crsql_changes')) {
          return [
            ['accounts', new Uint8Array([1]), 0, 'x', 1n, 1n, new Uint8Array([1]), 0, 1n],
          ];
        }
        return [];
      },
      async execO(): Promise<Record<string, unknown>[]> {
        return [];
      },
      async close(): Promise<void> {},
    };

    await pushDeltas(db, provider, dek);
    expect(await provider.download(VAULT_METADATA_FILENAME)).not.toBeNull();
    expect(await hasKeyData()).toBe(true);

    await startFreshVault(provider);
    expect(await provider.list()).toEqual([]);
    expect(await hasKeyData()).toBe(false);
  });

  it('does not clear key store when cloud clear fails', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: generateSalt(),
      iterations: 600_000,
    });
    const base = createMockCloudProvider();
    const provider = {
      ...base,
      async delete(filename: string): Promise<void> {
        if (filename === VAULT_METADATA_FILENAME) {
          throw new Error('metadata delete failed');
        }
        return base.delete(filename);
      },
    };
    await base.upload('changes-aa-1.bin', new Uint8Array([1]));
    await base.upload(VAULT_METADATA_FILENAME, new Uint8Array([123]));

    await expect(startFreshVault(provider)).rejects.toThrow(/metadata delete failed/i);
    expect(await hasKeyData()).toBe(true);
  });
});

describe('sync-engine snapshot (local backup)', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  it('round-trips empty database', async () => {
    const snapshot = await exportDatabaseSnapshot(db);
    expect(snapshot.length).toBeGreaterThan(0);

    const json = new TextDecoder().decode(snapshot);
    const parsed = JSON.parse(json) as { table: string; rows: unknown[] }[];
    expect(parsed).toHaveLength(9); // 9 sync tables
    for (const entry of parsed) {
      expect(entry.rows).toHaveLength(0);
    }
  });

  it('exports and imports rows', async () => {
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-1',
      'Checking',
      'bank',
      50000,
    ]);
    await db.exec(`INSERT INTO categories (id, name, type) VALUES (?, ?, ?)`, [
      'cat-1',
      'Groceries',
      'expense',
    ]);

    const snapshot = await exportDatabaseSnapshot(db);

    const db2 = await initDatabase();
    try {
      await importDatabaseSnapshot(db2, snapshot);

      const accounts = await db2.execO('SELECT * FROM accounts');
      expect(accounts).toHaveLength(1);
      expect(accounts[0]!.name).toBe('Checking');
      expect(accounts[0]!.initial_balance).toBe(50000);

      const categories = await db2.execO('SELECT * FROM categories');
      expect(categories).toHaveLength(1);
      expect(categories[0]!.name).toBe('Groceries');
    } finally {
      await db2.close();
    }
  });

  it('INSERT OR REPLACE overwrites existing rows', async () => {
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-1',
      'Old Name',
      'bank',
      1000,
    ]);

    const db2 = await initDatabase();
    try {
      await db2.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
        'acc-1',
        'New Name',
        'bank',
        2000,
      ]);
      const snapshot = await exportDatabaseSnapshot(db2);

      await importDatabaseSnapshot(db, snapshot);

      const accounts = await db.execO('SELECT * FROM accounts WHERE id = ?', ['acc-1']);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]!.name).toBe('New Name');
      expect(accounts[0]!.initial_balance).toBe(2000);
    } finally {
      await db2.close();
    }
  });
});
