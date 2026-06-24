import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import { exportDatabaseSnapshot, importDatabaseSnapshot } from './sync-engine.ts';

// Cloud push/pull now uses cr-sqlite `crsql_changes` deltas, which are unavailable under
// sql.js. Those are covered by crsql-changes.test.ts (protocol) and e2e (real merge).
// This suite covers the local snapshot backup/export serialization, which runs on sql.js.
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
