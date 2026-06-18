import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createTransactionRepository } from './transaction-repository.ts';
import { fromCents, toCents } from '../../domain/money.ts';
import type { Database } from '../database.ts';
import type { TransactionRepository } from './transaction-repository.ts';

describe('TransactionRepository', () => {
  let db: Database;
  let repo: TransactionRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createTransactionRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and reads back a transaction', async () => {
    const txn = await repo.create({
      id: 'txn-1',
      accountId: 'acc-1',
      amount: fromCents(5000),
      description: 'Coffee',
      transactionDate: '2026-06-01',
      type: 'debit',
    });

    expect(txn.id).toBe('txn-1');
    expect(toCents(txn.amount)).toBe(5000);
    expect(txn.type).toBe('debit');

    const fetched = await repo.getById('txn-1');
    expect(fetched).not.toBeNull();
    expect(toCents(fetched!.amount)).toBe(5000);
    expect(fetched!.description).toBe('Coffee');
    expect(fetched!.categoryId).toBeNull();
    expect(fetched!.externalId).toBeNull();
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.getById('no-such')).toBeNull();
  });

  it('queries by account with date range', async () => {
    await repo.create({
      id: 't1',
      accountId: 'a1',
      amount: fromCents(100),
      description: 'Jan',
      transactionDate: '2026-01-15',
      type: 'debit',
    });
    await repo.create({
      id: 't2',
      accountId: 'a1',
      amount: fromCents(200),
      description: 'Feb',
      transactionDate: '2026-02-15',
      type: 'credit',
    });
    await repo.create({
      id: 't3',
      accountId: 'a1',
      amount: fromCents(300),
      description: 'Mar',
      transactionDate: '2026-03-15',
      type: 'debit',
    });
    await repo.create({
      id: 't4',
      accountId: 'a2',
      amount: fromCents(400),
      description: 'Other',
      transactionDate: '2026-02-15',
      type: 'debit',
    });

    // All for a1
    const all = await repo.getByAccount('a1');
    expect(all).toHaveLength(3);
    // Ordered by date DESC
    expect(all[0]!.description).toBe('Mar');

    // With date range
    const feb = await repo.getByAccount('a1', { from: '2026-02-01', to: '2026-02-28' });
    expect(feb).toHaveLength(1);
    expect(feb[0]!.description).toBe('Feb');

    // Other account
    expect(await repo.getByAccount('a2')).toHaveLength(1);
  });

  it('updates only provided fields', async () => {
    await repo.create({
      id: 'u1',
      accountId: 'a1',
      amount: fromCents(1000),
      description: 'Old',
      transactionDate: '2026-01-01',
      type: 'debit',
    });

    const updated = await repo.update('u1', { description: 'New', categoryId: 'cat-1' });
    expect(updated.description).toBe('New');
    expect(updated.categoryId).toBe('cat-1');
    expect(updated.type).toBe('debit'); // unchanged
  });

  it('updates all supported fields at once', async () => {
    await repo.create({
      id: 'u2',
      accountId: 'a1',
      amount: fromCents(1000),
      description: 'Orig',
      transactionDate: '2026-01-01',
      type: 'debit',
    });

    const updated = await repo.update('u2', {
      description: 'Changed',
      categoryId: 'cat-2',
      transactionDate: '2026-02-01',
      settledDate: '2026-02-02',
      type: 'credit',
    });
    expect(updated.description).toBe('Changed');
    expect(updated.categoryId).toBe('cat-2');
    expect(updated.transactionDate).toBe('2026-02-01');
    expect(updated.settledDate).toBe('2026-02-02');
    expect(updated.type).toBe('credit');
  });

  it('throws when updating non-existent transaction', async () => {
    await expect(repo.update('nope', { description: 'X' })).rejects.toThrow(
      'Transaction not found',
    );
  });

  it('hard-deletes a transaction and its tags', async () => {
    await repo.create({
      id: 'del-1',
      accountId: 'a1',
      amount: fromCents(100),
      description: 'Bye',
      transactionDate: '2026-01-01',
      type: 'debit',
    });
    await repo.addTags('del-1', ['t1', 't2']);

    await repo.delete('del-1');

    expect(await repo.getById('del-1')).toBeNull();
    expect(await repo.getTagIds('del-1')).toHaveLength(0);
  });

  it('manages tags via addTags, removeTags, getTagIds', async () => {
    await repo.create({
      id: 'tag-txn',
      accountId: 'a1',
      amount: fromCents(100),
      description: 'Tagged',
      transactionDate: '2026-01-01',
      type: 'debit',
    });

    await repo.addTags('tag-txn', ['t1', 't2', 't3']);
    expect(await repo.getTagIds('tag-txn')).toEqual(['t1', 't2', 't3']);

    // Duplicate add is ignored
    await repo.addTags('tag-txn', ['t1']);
    expect(await repo.getTagIds('tag-txn')).toEqual(['t1', 't2', 't3']);

    await repo.removeTags('tag-txn', ['t2']);
    expect(await repo.getTagIds('tag-txn')).toEqual(['t1', 't3']);
  });
});
