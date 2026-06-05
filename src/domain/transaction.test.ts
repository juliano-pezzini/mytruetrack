import { describe, it, expect } from 'vitest';
import { createTransaction } from './transaction.ts';
import type { TransactionType } from './transaction.ts';
import { fromCents, fromDecimal } from './money.ts';

describe('Transaction', () => {
  it('creates a credit transaction', () => {
    const txn = createTransaction({
      id: 'txn-1',
      accountId: 'acct-1',
      amount: fromDecimal('3000.00'),
      description: 'Salary',
      transactionDate: '2026-05-01',
      type: 'credit',
    });
    expect(txn.type).toBe('credit');
    expect(txn.amount).toBe(300000);
    expect(txn.categoryId).toBeNull();
    expect(txn.settledDate).toBeNull();
    expect(txn.externalId).toBeNull();
  });

  it('creates a debit transaction with optional fields', () => {
    const txn = createTransaction({
      id: 'txn-2',
      accountId: 'acct-1',
      amount: fromDecimal('150.75'),
      description: 'Groceries',
      transactionDate: '2026-05-05',
      type: 'debit',
      categoryId: 'cat-1',
      settledDate: '2026-05-06',
      externalId: 'EXT-001',
    });
    expect(txn.type).toBe('debit');
    expect(txn.categoryId).toBe('cat-1');
    expect(txn.settledDate).toBe('2026-05-06');
    expect(txn.externalId).toBe('EXT-001');
  });

  it('rejects zero amount', () => {
    expect(() =>
      createTransaction({
        id: 'txn-3',
        accountId: 'a',
        amount: fromCents(0),
        description: 'Bad',
        transactionDate: '2026-01-01',
        type: 'credit',
      }),
    ).toThrow('must be positive');
  });

  it('rejects negative amount', () => {
    expect(() =>
      createTransaction({
        id: 'txn-4',
        accountId: 'a',
        amount: fromCents(-100),
        description: 'Bad',
        transactionDate: '2026-01-01',
        type: 'debit',
      }),
    ).toThrow('must be positive');
  });

  it('rejects empty description', () => {
    expect(() =>
      createTransaction({
        id: 'txn-5',
        accountId: 'a',
        amount: fromCents(100),
        description: '',
        transactionDate: '2026-01-01',
        type: 'credit',
      }),
    ).toThrow('description is required');
  });

  it('trims description whitespace', () => {
    const txn = createTransaction({
      id: 'txn-6',
      accountId: 'a',
      amount: fromCents(100),
      description: '  Coffee  ',
      transactionDate: '2026-01-01',
      type: 'debit',
    });
    expect(txn.description).toBe('Coffee');
  });

  it('type discriminates correctly in switch', () => {
    const types: TransactionType[] = ['credit', 'debit'];
    for (const t of types) {
      switch (t) {
        case 'credit':
        case 'debit':
          break;
        default: {
          const _exhaustive: never = t;
          throw new Error(`Unknown: ${_exhaustive}`);
        }
      }
    }
  });
});
