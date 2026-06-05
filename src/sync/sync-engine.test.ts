import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import { generateDek } from '../crypto/key-derivation.ts';
import { createMockCloudProvider } from './mock-cloud-provider.ts';
import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  pushChanges,
  pullChanges,
} from './sync-engine.ts';
import { getSyncState, clearSyncState } from './sync-state.ts';

describe('sync-engine', () => {
  let db: Database;
  let dek: CryptoKey;

  beforeEach(async () => {
    db = await initDatabase();
    dek = await generateDek();
    await clearSyncState();
  });

  afterEach(() => {
    db.close();
  });

  describe('exportDatabaseSnapshot / importDatabaseSnapshot', () => {
    it('round-trips empty database', () => {
      const snapshot = exportDatabaseSnapshot(db);
      expect(snapshot.length).toBeGreaterThan(0);

      // Import into a fresh database shouldn't throw
      const json = new TextDecoder().decode(snapshot);
      const parsed = JSON.parse(json) as { table: string; rows: unknown[] }[];
      expect(parsed).toHaveLength(9); // 9 sync tables
      for (const entry of parsed) {
        expect(entry.rows).toHaveLength(0);
      }
    });

    it('exports and imports rows', async () => {
      db.exec(
        `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
        ['acc-1', 'Checking', 'bank', 50000],
      );
      db.exec(
        `INSERT INTO categories (id, name, type) VALUES (?, ?, ?)`,
        ['cat-1', 'Groceries', 'expense'],
      );

      const snapshot = exportDatabaseSnapshot(db);

      // Import into a second database
      const db2 = await initDatabase();
      try {
        importDatabaseSnapshot(db2, snapshot);

        const accounts = db2.execO('SELECT * FROM accounts');
        expect(accounts).toHaveLength(1);
        expect(accounts[0]!.name).toBe('Checking');
        expect(accounts[0]!.initial_balance).toBe(50000);

        const categories = db2.execO('SELECT * FROM categories');
        expect(categories).toHaveLength(1);
        expect(categories[0]!.name).toBe('Groceries');
      } finally {
        db2.close();
      }
    });

    it('INSERT OR REPLACE overwrites existing rows', async () => {
      db.exec(
        `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
        ['acc-1', 'Old Name', 'bank', 1000],
      );

      // Snapshot with updated name
      const db2 = await initDatabase();
      try {
        db2.exec(
          `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
          ['acc-1', 'New Name', 'bank', 2000],
        );
        const snapshot = exportDatabaseSnapshot(db2);

        importDatabaseSnapshot(db, snapshot);

        const accounts = db.execO('SELECT * FROM accounts WHERE id = ?', ['acc-1']);
        expect(accounts).toHaveLength(1);
        expect(accounts[0]!.name).toBe('New Name');
        expect(accounts[0]!.initial_balance).toBe(2000);
      } finally {
        db2.close();
      }
    });
  });

  describe('pushChanges / pullChanges', () => {
    it('push then pull round-trips data through encryption', async () => {
      db.exec(
        `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
        ['acc-1', 'Savings', 'bank', 100000],
      );
      db.exec(
        `INSERT INTO transactions (id, account_id, amount, description, transaction_date, type) VALUES (?, ?, ?, ?, ?, ?)`,
        ['tx-1', 'acc-1', 2500, 'Coffee', '2025-01-15', 'debit'],
      );

      const provider = createMockCloudProvider();
      await pushChanges(db, provider, dek);

      // Pull into a fresh database
      const db2 = await initDatabase();
      try {
        await pullChanges(db2, provider, dek);

        const accounts = db2.execO('SELECT * FROM accounts');
        expect(accounts).toHaveLength(1);
        expect(accounts[0]!.name).toBe('Savings');

        const txns = db2.execO('SELECT * FROM transactions');
        expect(txns).toHaveLength(1);
        expect(txns[0]!.description).toBe('Coffee');
        expect(txns[0]!.amount).toBe(2500);
      } finally {
        db2.close();
      }
    });

    it('data in provider is encrypted (not plaintext)', async () => {
      db.exec(
        `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
        ['acc-1', 'Secret Account', 'bank', 0],
      );

      const provider = createMockCloudProvider();
      await pushChanges(db, provider, dek);

      const raw = await provider.download('sync-blob.bin');
      expect(raw).not.toBeNull();

      // The raw bytes should NOT contain the plaintext account name
      const asText = new TextDecoder().decode(raw!);
      expect(asText).not.toContain('Secret Account');
    });

    it('pull is a no-op when no remote blob exists', async () => {
      const provider = createMockCloudProvider();
      // Should not throw, should not modify DB
      await pullChanges(db, provider, dek);

      const accounts = db.execO('SELECT * FROM accounts');
      expect(accounts).toHaveLength(0);
    });

    it('updates sync state after push', async () => {
      const provider = createMockCloudProvider();
      await pushChanges(db, provider, dek);

      const state = await getSyncState();
      expect(state.lastPushedVersion).toBe(1);
      expect(state.lastPushedAt).not.toBeNull();
    });

    it('updates sync state after pull', async () => {
      const provider = createMockCloudProvider();
      // Push first so there's something to pull
      await pushChanges(db, provider, dek);

      const db2 = await initDatabase();
      try {
        await pullChanges(db2, provider, dek);

        const state = await getSyncState();
        expect(state.lastPulledAt).not.toBeNull();
      } finally {
        db2.close();
      }
    });

    it('increments version on successive pushes', async () => {
      const provider = createMockCloudProvider();
      await pushChanges(db, provider, dek);
      await pushChanges(db, provider, dek);

      const state = await getSyncState();
      expect(state.lastPushedVersion).toBe(2);
    });

    it('two-database convergence: both end up with same data', async () => {
      const dbA = await initDatabase();
      const dbB = await initDatabase();
      const provider = createMockCloudProvider();

      try {
        // Device A creates an account
        dbA.exec(
          `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
          ['acc-a', 'Device A Account', 'bank', 10000],
        );

        // Push A
        await pushChanges(dbA, provider, dek);

        // Pull into B
        await pullChanges(dbB, provider, dek);

        // B should now have A's account
        const bAccounts = dbB.execO('SELECT * FROM accounts');
        expect(bAccounts).toHaveLength(1);
        expect(bAccounts[0]!.id).toBe('acc-a');

        // B adds its own transaction
        dbB.exec(
          `INSERT INTO transactions (id, account_id, amount, description, transaction_date, type) VALUES (?, ?, ?, ?, ?, ?)`,
          ['tx-b', 'acc-a', 5000, 'From Device B', '2025-01-20', 'debit'],
        );

        // Push B
        await pushChanges(dbB, provider, dek);

        // Pull into A
        await pullChanges(dbA, provider, dek);

        // A should have B's transaction
        const aTxns = dbA.execO('SELECT * FROM transactions');
        expect(aTxns).toHaveLength(1);
        expect(aTxns[0]!.description).toBe('From Device B');

        // Both databases should have the same accounts and transactions
        const aAccounts = dbA.execO('SELECT id FROM accounts ORDER BY id');
        const bAccountsFinal = dbB.execO('SELECT id FROM accounts ORDER BY id');
        expect(aAccounts).toEqual(bAccountsFinal);
      } finally {
        dbA.close();
        dbB.close();
      }
    });
  });
});
