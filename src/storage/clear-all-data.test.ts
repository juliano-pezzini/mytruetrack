import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from './init.ts';
import { clearAllData } from './clear-all-data.ts';
import { SYNC_TABLES } from '../sync/sync-tables.ts';
import type { Database } from './database.ts';

async function rowCount(db: Database, table: string): Promise<number> {
  const rows = await db.execA(`SELECT COUNT(*) FROM ${table}`);
  return Number(rows[0][0]);
}

async function seedEveryTable(db: Database): Promise<void> {
  await db.exec(`INSERT INTO accounts (id, name, type) VALUES ('a1', 'Checking', 'bank')`);
  await db.exec(`INSERT INTO categories (id, name, type) VALUES ('c1', 'Food', 'expense')`);
  await db.exec(`INSERT INTO tags (id, name, color) VALUES ('t1', 'Trip', '#fff')`);
  await db.exec(
    `INSERT INTO transactions (id, account_id, amount, description, transaction_date, type)
     VALUES ('tx1', 'a1', 500, 'Lunch', '2026-01-01', 'debit')`,
  );
  await db.exec(
    `INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ('tx1', 't1')`,
  );
  await db.exec(
    `INSERT INTO account_balances (account_id, year, month, closing_balance)
     VALUES ('a1', 2026, 1, 1000)`,
  );
  await db.exec(
    `INSERT INTO auto_category_rules (id, pattern, category_id) VALUES ('r1', 'lunch', 'c1')`,
  );
  await db.exec(
    `INSERT INTO learned_category_patterns (id, category_id, keyword, first_learned_at)
     VALUES ('p1', 'c1', 'lunch', '2026-01-01')`,
  );
  await db.exec(
    `INSERT INTO auto_category_corrections (id, transaction_id, corrected_category_id, description_text)
     VALUES ('cor1', 'tx1', 'c1', 'Lunch')`,
  );
}

describe('clearAllData', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('deletes every row from all data tables', async () => {
    await seedEveryTable(db);
    // Sanity: each table has data before the wipe.
    for (const table of SYNC_TABLES) {
      expect(await rowCount(db, table)).toBeGreaterThan(0);
    }

    await clearAllData(db);

    for (const table of SYNC_TABLES) {
      expect(await rowCount(db, table)).toBe(0);
    }
  });

  it('is idempotent on an already-empty database', async () => {
    await clearAllData(db);
    await expect(clearAllData(db)).resolves.toBeUndefined();

    for (const table of SYNC_TABLES) {
      expect(await rowCount(db, table)).toBe(0);
    }
  });

  it('leaves the table structure intact (tables still queryable)', async () => {
    await seedEveryTable(db);
    await clearAllData(db);

    // A fresh insert must still succeed against the surviving schema.
    await db.exec(`INSERT INTO accounts (id, name, type) VALUES ('a2', 'Savings', 'bank')`);
    expect(await rowCount(db, 'accounts')).toBe(1);
  });
});
