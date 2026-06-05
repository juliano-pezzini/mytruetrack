import { describe, it, expect } from 'vitest';
import { calculateBalance, computeMonthSnapshot, netChange } from './balance.ts';
import type { AccountBalance } from './balance.ts';
import { createAccount } from './account.ts';
import { createTransaction } from './transaction.ts';
import type { Transaction } from './transaction.ts';
import { fromCents, toCents } from './money.ts';
import type { Money } from './money.ts';

// --- Test Helpers ---

function bankAccount(initialCents: number = 0) {
  return createAccount({
    id: 'acct-1',
    name: 'Checking',
    type: 'bank',
    initialBalance: fromCents(initialCents),
  });
}

function creditCardAccount(initialCents: number = 0) {
  return createAccount({
    id: 'cc-1',
    name: 'Visa',
    type: 'credit_card',
    initialBalance: fromCents(initialCents),
  });
}

function txn(
  overrides: Omit<Partial<Parameters<typeof createTransaction>[0]>, 'amount'> & {
    amount: number;
    type: 'credit' | 'debit';
  },
): Transaction {
  return createTransaction({
    id: `txn-${Math.random().toString(36).slice(2, 8)}`,
    accountId: 'acct-1',
    description: 'Test',
    transactionDate: '2026-05-15',
    ...overrides,
    amount: fromCents(overrides.amount) as Money,
  });
}

describe('calculateBalance', () => {
  it('returns initialBalance when no transactions and no snapshots', () => {
    const acct = bankAccount(100000);
    const result = calculateBalance(acct, [], [], '2026-05-31');
    expect(toCents(result)).toBe(100000);
  });

  it('adds credits and subtracts debits from initialBalance', () => {
    const acct = bankAccount(100000);
    const txns = [
      txn({ amount: 300000, type: 'credit', transactionDate: '2026-05-01' }),
      txn({ amount: 5000, type: 'debit', transactionDate: '2026-05-05' }),
    ];
    const result = calculateBalance(acct, txns, [], '2026-05-31');
    // 100000 + 300000 - 5000 = 395000
    expect(toCents(result)).toBe(395000);
  });

  it('uses snapshot as base when available', () => {
    const acct = bankAccount(100000);
    const snapshots: AccountBalance[] = [
      { accountId: 'acct-1', year: 2026, month: 4, closingBalance: fromCents(200000) },
    ];
    const txns = [
      txn({ amount: 10000, type: 'credit', transactionDate: '2026-05-10' }),
    ];
    const result = calculateBalance(acct, txns, snapshots, '2026-05-31');
    // 200000 (April snapshot) + 10000 = 210000
    expect(toCents(result)).toBe(210000);
  });

  it('ignores transactions after target date', () => {
    const acct = bankAccount(100000);
    const txns = [
      txn({ amount: 5000, type: 'credit', transactionDate: '2026-05-10' }),
      txn({ amount: 9999, type: 'debit', transactionDate: '2026-06-01' }),
    ];
    const result = calculateBalance(acct, txns, [], '2026-05-31');
    // 100000 + 5000 = 105000 (June txn excluded)
    expect(toCents(result)).toBe(105000);
  });

  it('ignores transactions for other accounts', () => {
    const acct = bankAccount(100000);
    const txns = [
      txn({ amount: 5000, type: 'credit', transactionDate: '2026-05-10', accountId: 'other' }),
    ];
    const result = calculateBalance(acct, txns, [], '2026-05-31');
    expect(toCents(result)).toBe(100000);
  });

  it('selects the most recent snapshot before target', () => {
    const acct = bankAccount(100000);
    const snapshots: AccountBalance[] = [
      { accountId: 'acct-1', year: 2026, month: 3, closingBalance: fromCents(150000) },
      { accountId: 'acct-1', year: 2026, month: 4, closingBalance: fromCents(200000) },
    ];
    const txns = [
      txn({ amount: 10000, type: 'debit', transactionDate: '2026-05-15' }),
    ];
    const result = calculateBalance(acct, txns, snapshots, '2026-05-31');
    // Uses April (most recent): 200000 - 10000 = 190000
    expect(toCents(result)).toBe(190000);
  });

  it('does not use future snapshots', () => {
    const acct = bankAccount(100000);
    const snapshots: AccountBalance[] = [
      { accountId: 'acct-1', year: 2026, month: 6, closingBalance: fromCents(999999) },
    ];
    const result = calculateBalance(acct, [], snapshots, '2026-05-31');
    // June snapshot is in the future — falls back to initialBalance
    expect(toCents(result)).toBe(100000);
  });
});

describe('calculateBalance — credit card', () => {
  it('credit card purchases make balance more negative', () => {
    const cc = creditCardAccount(0);
    const txns = [
      txn({ amount: 5000, type: 'debit', transactionDate: '2026-05-01', accountId: 'cc-1' }),
      txn({ amount: 15000, type: 'debit', transactionDate: '2026-05-05', accountId: 'cc-1' }),
    ];
    const result = calculateBalance(cc, txns, [], '2026-05-31');
    // 0 - 5000 - 15000 = -20000
    expect(toCents(result)).toBe(-20000);
  });

  it('credit card payment (credit) reduces debt', () => {
    const cc = creditCardAccount(-50000); // owes $500
    const txns = [
      txn({ amount: 10000, type: 'credit', transactionDate: '2026-05-15', accountId: 'cc-1' }),
    ];
    const result = calculateBalance(cc, txns, [], '2026-05-31');
    // -50000 + 10000 = -40000
    expect(toCents(result)).toBe(-40000);
  });

  it('credit card paid in full reaches zero', () => {
    const cc = creditCardAccount(-30000);
    const txns = [
      txn({ amount: 30000, type: 'credit', transactionDate: '2026-05-20', accountId: 'cc-1' }),
    ];
    const result = calculateBalance(cc, txns, [], '2026-05-31');
    expect(toCents(result)).toBe(0);
  });
});

describe('computeMonthSnapshot', () => {
  it('computes snapshot from initialBalance when no prior snapshots', () => {
    const acct = bankAccount(100000);
    const txns = [
      txn({ amount: 50000, type: 'credit', transactionDate: '2026-05-10' }),
      txn({ amount: 20000, type: 'debit', transactionDate: '2026-05-20' }),
    ];
    const snap = computeMonthSnapshot(acct, txns, [], 2026, 5);
    expect(snap.accountId).toBe('acct-1');
    expect(snap.year).toBe(2026);
    expect(snap.month).toBe(5);
    // 100000 + 50000 - 20000 = 130000
    expect(toCents(snap.closingBalance)).toBe(130000);
  });

  it('uses previous month snapshot as base', () => {
    const acct = bankAccount(100000);
    const prevSnapshots: AccountBalance[] = [
      { accountId: 'acct-1', year: 2026, month: 4, closingBalance: fromCents(200000) },
    ];
    const txns = [
      txn({ amount: 10000, type: 'credit', transactionDate: '2026-05-15' }),
    ];
    const snap = computeMonthSnapshot(acct, txns, prevSnapshots, 2026, 5);
    // 200000 + 10000 = 210000
    expect(toCents(snap.closingBalance)).toBe(210000);
  });

  it('returns base when no transactions in month', () => {
    const acct = bankAccount(100000);
    const snap = computeMonthSnapshot(acct, [], [], 2026, 5);
    expect(toCents(snap.closingBalance)).toBe(100000);
  });

  it('excludes transactions from other months', () => {
    const acct = bankAccount(100000);
    const txns = [
      txn({ amount: 5000, type: 'credit', transactionDate: '2026-04-15' }),
      txn({ amount: 10000, type: 'credit', transactionDate: '2026-05-15' }),
      txn({ amount: 99999, type: 'credit', transactionDate: '2026-06-01' }),
    ];
    const snap = computeMonthSnapshot(acct, txns, [], 2026, 5);
    // Only May txn included: 100000 + 5000 (April, included since no snapshot) + 10000 = 115000
    // Actually: no snapshot → all txns up to May end. April txn IS included.
    expect(toCents(snap.closingBalance)).toBe(115000);
  });
});

describe('netChange', () => {
  it('computes net change from credits and debits', () => {
    const txns = [
      txn({ amount: 300000, type: 'credit' }),
      txn({ amount: 5000, type: 'debit' }),
      txn({ amount: 1500, type: 'credit' }),
    ];
    const result = netChange(txns);
    // 300000 - 5000 + 1500 = 296500
    expect(toCents(result)).toBe(296500);
  });

  it('returns zero for empty list', () => {
    expect(toCents(netChange([]))).toBe(0);
  });
});
