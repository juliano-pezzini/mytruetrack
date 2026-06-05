import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import { fromCents } from '../domain/money.ts';
import type { ParsedTransaction } from './types.ts';
import { importTransactions } from './import-service.ts';

describe('import-service', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
    // Create a target account
    db.exec(
      `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
      ['acc-1', 'Checking', 'bank', 0],
    );
  });

  afterEach(() => {
    db.close();
  });

  const baseTxns: ParsedTransaction[] = [
    {
      date: '2026-01-15',
      description: 'Salary',
      amount: fromCents(300000),
      type: 'credit',
      externalId: 'FIT001',
    },
    {
      date: '2026-01-20',
      description: 'Groceries',
      amount: fromCents(15075),
      type: 'debit',
      externalId: 'FIT002',
    },
    {
      date: '2026-01-25',
      description: 'Coffee',
      amount: fromCents(500),
      type: 'debit',
      externalId: 'FIT003',
    },
  ];

  it('imports 3 new transactions', () => {
    const result = importTransactions(db, 'acc-1', baseTxns);

    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const rows = db.execO('SELECT * FROM transactions WHERE account_id = ?', ['acc-1']);
    expect(rows).toHaveLength(3);
  });

  it('skips all on re-import (deduplication by externalId)', () => {
    importTransactions(db, 'acc-1', baseTxns);
    const result = importTransactions(db, 'acc-1', baseTxns);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(3);

    const rows = db.execO('SELECT * FROM transactions WHERE account_id = ?', ['acc-1']);
    expect(rows).toHaveLength(3); // still only 3
  });

  it('collects validation errors without aborting', () => {
    const txnsWithBad: ParsedTransaction[] = [
      baseTxns[0]!,
      {
        date: '2026-02-01',
        description: '', // empty — will fail validation
        amount: fromCents(1000),
        type: 'debit',
        externalId: 'BAD001',
      },
      baseTxns[2]!,
    ];

    const result = importTransactions(db, 'acc-1', txnsWithBad);

    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.index).toBe(1);
    expect(result.errors[0]!.message).toContain('description');
  });

  it('imports transactions without externalId (no dedup)', () => {
    const noExtId: ParsedTransaction[] = [
      {
        date: '2026-03-01',
        description: 'Cash purchase',
        amount: fromCents(2000),
        type: 'debit',
        externalId: null,
      },
      {
        date: '2026-03-01',
        description: 'Cash purchase',
        amount: fromCents(2000),
        type: 'debit',
        externalId: null,
      },
    ];

    const result = importTransactions(db, 'acc-1', noExtId);

    expect(result.imported).toBe(2); // both imported, no dedup without externalId
    expect(result.skipped).toBe(0);
  });

  it('deduplicates within the same batch', () => {
    const dupes: ParsedTransaction[] = [
      {
        date: '2026-04-01',
        description: 'Duplicate A',
        amount: fromCents(1000),
        type: 'debit',
        externalId: 'DUPE001',
      },
      {
        date: '2026-04-01',
        description: 'Duplicate B',
        amount: fromCents(1000),
        type: 'debit',
        externalId: 'DUPE001',
      },
    ];

    const result = importTransactions(db, 'acc-1', dupes);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('does not cross-deduplicate between different accounts', () => {
    db.exec(
      `INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`,
      ['acc-2', 'Savings', 'bank', 0],
    );

    importTransactions(db, 'acc-1', [baseTxns[0]!]);
    const result = importTransactions(db, 'acc-2', [baseTxns[0]!]);

    // Same externalId, different account — should import
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
