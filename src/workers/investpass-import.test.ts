import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import type { AccountMapEntry } from '../storage/investpass-account-map.ts';
import type { InvestPassTransaction } from './investpass-types.ts';
import { processInvestPassImport } from './investpass-import.ts';

describe('processInvestPassImport', () => {
  let db: Database;

  const accountMap: AccountMapEntry[] = [
    { investPassAccountName: 'Nubank', mytruetrackAccountId: 'acc-nu', lastImportedDate: null },
    { investPassAccountName: 'Inter', mytruetrackAccountId: 'acc-inter', lastImportedDate: null },
  ];

  function makeTxn(overrides: Partial<InvestPassTransaction> = {}): InvestPassTransaction {
    return {
      id: 'aaaaaaaa-1111-2222-3333-444444444444',
      name: 'Test Purchase',
      date: '2026-06-15T14:30:00.000Z',
      amount: 100.5,
      type: 'DEBIT',
      ignored: false,
      category: null,
      account: { name: 'Nubank', institution: { name: 'Nu Pagamentos' } },
      ...overrides,
    };
  }

  beforeEach(async () => {
    db = await initDatabase();
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-nu',
      'Nubank',
      'credit_card',
      0,
    ]);
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-inter',
      'Inter',
      'bank',
      0,
    ]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('imports 2 mapped transactions and returns summary', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({ id: 'a1111111-1111-1111-1111-111111111111', name: 'Coffee', amount: 5.5 }),
      makeTxn({ id: 'b2222222-2222-2222-2222-222222222222', name: 'Lunch', amount: 25.0 }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.unmappedAccounts).toEqual([]);
    expect(result.perAccount['acc-nu']).toBeDefined();
    expect(result.perAccount['acc-nu']!.imported).toBe(2);
    expect(result.perAccount['acc-nu']!.skipped).toBe(0);
  });

  it('deduplicates re-running same transactions', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({ id: 'c3333333-3333-3333-3333-333333333333', name: 'Coffee', amount: 5.5 }),
    ];

    await processInvestPassImport(db, txns, accountMap);
    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.perAccount['acc-nu']!.imported).toBe(0);
    expect(result.perAccount['acc-nu']!.skipped).toBe(1);
  });

  it('collects unmapped account names without importing', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({
        id: 'd4444444-4444-4444-4444-444444444444',
        account: { name: 'UnknownBank', institution: { name: 'Unknown' } },
      }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.unmappedAccounts).toEqual(['UnknownBank']);
    expect(result.perAccount['acc-nu']).toBeUndefined();
  });

  it('converts UTC to São Paulo timezone (edge case: crosses day boundary)', async () => {
    // 2026-06-01T02:30:00.000Z in UTC is 2026-05-31T23:30:00 in São Paulo (UTC-3)
    const txns: InvestPassTransaction[] = [
      makeTxn({ id: 'e5555555-5555-5555-5555-555555555555', date: '2026-06-01T02:30:00.000Z' }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.perAccount['acc-nu']!.imported).toBe(1);
    // Verify the stored date
    const rows = await db.execO(
      `SELECT transaction_date FROM transactions WHERE external_id = ?`,
      ['e5555555-5555-5555-5555-555555555555'],
    );
    expect(rows[0]!.transaction_date).toBe('2026-05-31');
  });

  it('maps CREDIT type to credit', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({
        id: 'f6666666-6666-6666-6666-666666666666',
        type: 'CREDIT',
        amount: 1000.0,
        name: 'Salary',
      }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.perAccount['acc-nu']!.imported).toBe(1);
    const rows = await db.execO(
      `SELECT type FROM transactions WHERE external_id = ?`,
      ['f6666666-6666-6666-6666-666666666666'],
    );
    expect(rows[0]!.type).toBe('credit');
  });

  it('converts decimal amounts to integer cents', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({ id: 'g7777777-7777-7777-7777-777777777777', amount: 279.99 }),
      makeTxn({ id: 'h8888888-8888-8888-8888-888888888888', amount: 0.01 }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.perAccount['acc-nu']!.imported).toBe(2);
    const rows = await db.execO(
      `SELECT amount, external_id FROM transactions WHERE external_id IN (?, ?) ORDER BY amount`,
      ['g7777777-7777-7777-7777-777777777777', 'h8888888-8888-8888-8888-888888888888'],
    );
    expect(rows[0]!.amount).toBe(1);   // 0.01 → 1 cent
    expect(rows[1]!.amount).toBe(27999); // 279.99 → 27999 cents
  });

  it('rounds pathological floats correctly (IEEE 754 edge cases)', async () => {
    // 19.99 * 100 = 1998.9999999999998 in IEEE 754 — without Math.round this truncates to 1998
    // 33.33 * 100 = 3333.0000000000005 — without Math.round this could round up incorrectly
    const txns: InvestPassTransaction[] = [
      makeTxn({ id: 'k1111111-1111-4111-a111-111111111111', amount: 19.99 }),
      makeTxn({ id: 'k2222222-2222-4222-a222-222222222222', amount: 33.33 }),
      makeTxn({ id: 'k3333333-3333-4333-a333-333333333333', amount: 0.1 }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.perAccount['acc-nu']!.imported).toBe(3);
    const rows = await db.execO(
      `SELECT amount, external_id FROM transactions WHERE external_id IN (?, ?, ?) ORDER BY amount`,
      ['k1111111-1111-4111-a111-111111111111', 'k2222222-2222-4222-a222-222222222222', 'k3333333-3333-4333-a333-333333333333'],
    );
    expect(rows[0]!.amount).toBe(10);    // 0.1  → 10 cents
    expect(rows[1]!.amount).toBe(1999);  // 19.99 → 1999 cents (NOT 1998)
    expect(rows[2]!.amount).toBe(3333);  // 33.33 → 3333 cents (NOT 3334)
  });

  it('routes transactions to multiple mapped accounts', async () => {
    const txns: InvestPassTransaction[] = [
      makeTxn({
        id: 'i9999999-9999-9999-9999-999999999999',
        account: { name: 'Nubank', institution: { name: 'Nu' } },
        amount: 10.0,
      }),
      makeTxn({
        id: 'j0000000-0000-0000-0000-000000000000',
        account: { name: 'Inter', institution: { name: 'Banco Inter' } },
        amount: 20.0,
      }),
    ];

    const result = await processInvestPassImport(db, txns, accountMap);

    expect(result.unmappedAccounts).toEqual([]);
    expect(Object.keys(result.perAccount)).toHaveLength(2);
    expect(result.perAccount['acc-nu']!.imported).toBe(1);
    expect(result.perAccount['acc-inter']!.imported).toBe(1);
  });
});
