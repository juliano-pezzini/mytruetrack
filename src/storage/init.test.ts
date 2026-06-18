import { describe, it, expect, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from './init.ts';
import type { Database } from './database.ts';

const EXPECTED_TABLES = [
  'accounts',
  'transactions',
  'categories',
  'tags',
  'transaction_tags',
  'account_balances',
  'auto_category_rules',
  'learned_category_patterns',
  'auto_category_corrections',
] as const;

describe('initDatabase', () => {
  let db: Database;

  afterEach(async () => {
    if (db) await closeDatabase(db);
  });

  it('creates all 9 application tables', async () => {
    db = await initDatabase();

    const tables = (
      await db.execO(
        "SELECT name FROM sqlite_master WHERE type='table' AND name != '_migrations' ORDER BY name",
      )
    ).map((r) => r.name as string);

    for (const expected of EXPECTED_TABLES) {
      expect(tables, `missing table: ${expected}`).toContain(expected);
    }
  });

  it('accounts table has correct columns', async () => {
    db = await initDatabase();
    const cols = (await db.execO('PRAGMA table_info(accounts)')).map((r) => r.name as string);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'name', 'type', 'initial_balance', 'is_active', 'description']),
    );
  });

  it('transactions table stores amount as INTEGER', async () => {
    db = await initDatabase();
    const cols = await db.execO('PRAGMA table_info(transactions)');
    const amountCol = cols.find((c) => c.name === 'amount');
    expect(amountCol).toBeDefined();
    expect(amountCol!.type).toBe('INTEGER');
  });

  it('account_balances has composite primary key', async () => {
    db = await initDatabase();
    // Insert, then insert duplicate PK should fail
    await db.exec(
      "INSERT INTO account_balances (account_id, year, month, closing_balance) VALUES ('a', 2026, 1, 1000)",
    );
    await expect(
      db.exec(
        "INSERT INTO account_balances (account_id, year, month, closing_balance) VALUES ('a', 2026, 1, 2000)",
      ),
    ).rejects.toThrow();
  });

  it('transaction_tags has composite primary key', async () => {
    db = await initDatabase();
    await db.exec("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ('t1', 'tag1')");
    await expect(
      db.exec("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ('t1', 'tag1')"),
    ).rejects.toThrow();
  });

  it('all NOT NULL columns have DEFAULT values', async () => {
    db = await initDatabase();
    // Verify we can insert with just the PK — all NOT NULL columns should have defaults
    await db.exec("INSERT INTO accounts (id) VALUES ('test-acc')");
    await db.exec("INSERT INTO categories (id) VALUES ('test-cat')");
    await db.exec("INSERT INTO tags (id) VALUES ('test-tag')");
    await db.exec("INSERT INTO transactions (id) VALUES ('test-txn')");
    await db.exec("INSERT INTO auto_category_rules (id) VALUES ('test-rule')");
    await db.exec("INSERT INTO learned_category_patterns (id) VALUES ('test-pat')");
    await db.exec("INSERT INTO auto_category_corrections (id) VALUES ('test-corr')");

    // If we get here, all defaults worked
    const acc = await db.execO("SELECT * FROM accounts WHERE id = 'test-acc'");
    expect(acc).toHaveLength(1);
    expect(acc[0]!.is_active).toBe(1);
    expect(acc[0]!.initial_balance).toBe(0);
  });

  it('does not error on re-initialization', async () => {
    db = await initDatabase();
    await db.exec("INSERT INTO accounts (id, name) VALUES ('keep', 'Kept')");
    await closeDatabase(db);

    // Re-init — migrations should be idempotent (skipped)
    db = await initDatabase();
    // New in-memory DB won't have the old data (in-memory only), but init should not throw
    expect(
      await db.execO("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"),
    ).toHaveLength(1);
  });
});
