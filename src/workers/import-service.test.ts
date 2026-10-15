import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { suggestCategory } from '../domain/auto-categorization-service.ts';
import { fromCents } from '../domain/money.ts';
import type { Database } from '../storage/database.ts';
import { initDatabase } from '../storage/init.ts';
import { createAutoCategoryRuleRepository } from '../storage/repositories/auto-category-rule-repository.ts';
import { createCategoryRepository } from '../storage/repositories/category-repository.ts';
import { createTagRepository } from '../storage/repositories/tag-repository.ts';
import { createTransactionRepository } from '../storage/repositories/transaction-repository.ts';
import type { ParsedTransaction } from './types.ts';
import { importTransactions } from './import-service.ts';

describe('import-service', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
    // Create a target account
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-1',
      'Checking',
      'bank',
      0,
    ]);
  });

  afterEach(async () => {
    await db.close();
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

  it('imports 3 new transactions', async () => {
    const result = await importTransactions(db, 'acc-1', baseTxns);

    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const rows = await db.execO('SELECT * FROM transactions WHERE account_id = ?', ['acc-1']);
    expect(rows).toHaveLength(3);
  });

  it('skips all on re-import (deduplication by externalId)', async () => {
    await importTransactions(db, 'acc-1', baseTxns);
    const result = await importTransactions(db, 'acc-1', baseTxns);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(3);

    const rows = await db.execO('SELECT * FROM transactions WHERE account_id = ?', ['acc-1']);
    expect(rows).toHaveLength(3); // still only 3
  });

  it('collects validation errors without aborting', async () => {
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

    const result = await importTransactions(db, 'acc-1', txnsWithBad);

    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.index).toBe(1);
    expect(result.errors[0]!.message).toContain('description');
  });

  it('imports transactions without externalId (no dedup)', async () => {
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

    const result = await importTransactions(db, 'acc-1', noExtId);

    expect(result.imported).toBe(2); // both imported, no dedup without externalId
    expect(result.skipped).toBe(0);
  });

  it('deduplicates within the same batch', async () => {
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

    const result = await importTransactions(db, 'acc-1', dupes);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('does not cross-deduplicate between different accounts', async () => {
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-2',
      'Savings',
      'bank',
      0,
    ]);

    await importTransactions(db, 'acc-1', [baseTxns[0]!]);
    const result = await importTransactions(db, 'acc-2', [baseTxns[0]!]);

    // Same externalId, different account — should import
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('stores importRunId on newly inserted rows', async () => {
    const result = await importTransactions(db, 'acc-1', [baseTxns[0]!], 'run-a');

    expect(result.imported).toBe(1);
    const rows = await db.execO(
      'SELECT import_run_id FROM transactions WHERE account_id = ? AND external_id = ?',
      ['acc-1', 'FIT001'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.import_run_id).toBe('run-a');
  });

  it('keeps the earlier import_run_id on skipped duplicates', async () => {
    await importTransactions(db, 'acc-1', [baseTxns[0]!], 'run-first');
    const second = await importTransactions(db, 'acc-1', [baseTxns[0]!], 'run-second');

    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);

    const rows = await db.execO(
      'SELECT import_run_id FROM transactions WHERE account_id = ? AND external_id = ?',
      ['acc-1', 'FIT001'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.import_run_id).toBe('run-first');
  });

  it('leaves import_run_id empty when importRunId is omitted', async () => {
    await importTransactions(db, 'acc-1', [baseTxns[0]!]);
    const rows = await db.execO(
      'SELECT import_run_id from transactions WHERE account_id = ? AND external_id = ?',
      ['acc-1', 'FIT001'],
    );
    expect(rows[0]!.import_run_id).toBe('');
  });
});

function row(
  description: string,
  type: ParsedTransaction['type'],
  extra: Partial<ParsedTransaction> = {},
): ParsedTransaction {
  return {
    date: '2026-05-01',
    description,
    amount: fromCents(1000),
    type,
    externalId: null,
    ...extra,
  };
}

describe('importTransactions categories and tags', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance) VALUES (?, ?, ?, ?)`, [
      'acc-1',
      'Checking',
      'bank',
      0,
    ]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('stores a new debit category as expense and links it on the transaction', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('Store', 'debit', { externalId: 'D1', categoryName: '  Super   Market ' }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const categories = await createCategoryRepository(db).getAll();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      name: 'Super Market',
      type: 'expense',
      parentId: null,
      description: null,
    });

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns).toHaveLength(1);
    expect(txns[0]!.categoryId).toBe(categories[0]!.id);
  });

  it('stores a new credit category as revenue', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('Paycheck', 'credit', { externalId: 'C1', categoryName: 'Salary' }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const categories = await createCategoryRepository(db).getAll();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      name: 'Salary',
      type: 'revenue',
      parentId: null,
      description: null,
    });

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns[0]!.categoryId).toBe(categories[0]!.id);
  });

  it('reuses a category created earlier in the same import when the direction differs', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('Store', 'debit', {
        date: '2026-05-01',
        externalId: 'A',
        categoryName: 'Market',
      }),
      row('Refund', 'credit', {
        date: '2026-05-02',
        externalId: 'B',
        categoryName: 'Market',
      }),
    ]);

    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(0);

    const categories = await createCategoryRepository(db).getAll();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: 'Market', type: 'expense' });

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    const store = txns.find((txn) => txn.description === 'Store');
    const refund = txns.find((txn) => txn.description === 'Refund');
    expect(store?.categoryId).toBe(categories[0]!.id);
    expect(refund?.categoryId).toBe(categories[0]!.id);
  });

  it('links the one existing category even when its type differs', async () => {
    await createCategoryRepository(db).create({
      id: 'cat-1',
      name: 'Market',
      type: 'revenue',
    });

    const result = await importTransactions(db, 'acc-1', [
      row('Store', 'debit', { externalId: 'A', categoryName: 'Market' }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const categories = await createCategoryRepository(db).getAll();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ id: 'cat-1', name: 'Market', type: 'revenue' });

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns[0]!.categoryId).toBe('cat-1');
  });

  it('stores the first new tag as #E11D48 and the next as #0EA5E9 with one link each', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('Lunch', 'debit', { externalId: 'T1', tagNames: ['food', 'travel'] }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const tags = await createTagRepository(db).getAll();
    const food = tags.find((tag) => tag.name === 'food');
    const travel = tags.find((tag) => tag.name === 'travel');
    expect(food?.color).toBe('#E11D48');
    expect(travel?.color).toBe('#0EA5E9');

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    const links = await db.execO('SELECT tag_id FROM transaction_tags WHERE transaction_id = ?', [
      txns[0]!.id,
    ]);
    expect(links.map((link) => link.tag_id as string).sort()).toEqual(
      [food!.id, travel!.id].sort(),
    );
  });

  it('skips a duplicate externalId and creates neither a category nor a tag', async () => {
    await importTransactions(db, 'acc-1', [row('Salary', 'credit', { externalId: 'FIT001' })]);

    const result = await importTransactions(db, 'acc-1', [
      row('Salary again', 'credit', {
        externalId: 'FIT001',
        categoryName: 'Ghost',
        tagNames: ['ghost'],
      }),
    ]);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(await createCategoryRepository(db).getAll()).toHaveLength(0);
    expect(await createTagRepository(db).getAll()).toHaveLength(0);
  });

  it('skips an externalId accepted earlier in the batch and does not classify it', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('First', 'debit', { externalId: 'DUP' }),
      row('Second', 'debit', {
        externalId: 'DUP',
        categoryName: 'Ghost',
        tagNames: ['ghost'],
      }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(await createCategoryRepository(db).getAll()).toHaveLength(0);
    expect(await createTagRepository(db).getAll()).toHaveLength(0);
  });

  it('records the thrown row index and still imports a later row', async () => {
    const result = await importTransactions(db, 'acc-1', [
      row('First', 'debit', { externalId: 'OK1', categoryName: 'Kept' }),
      row('', 'debit', { externalId: 'BAD', categoryName: 'Orphan' }),
      row('Later', 'debit', { externalId: 'OK2', categoryName: 'Later Cat' }),
    ]);

    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.index).toBe(1);
    expect(result.errors[0]!.message).toContain('description');

    const categories = await createCategoryRepository(db).getAll();
    expect(categories.map((category) => category.name).sort()).toEqual([
      'Kept',
      'Later Cat',
      'Orphan',
    ]);

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns.find((txn) => txn.description === 'First')?.categoryId).toBe(
      categories.find((category) => category.name === 'Kept')?.id,
    );
    expect(txns.find((txn) => txn.description === 'Later')?.categoryId).toBe(
      categories.find((category) => category.name === 'Later Cat')?.id,
    );
    expect(txns.find((txn) => txn.description === '')).toBeUndefined();
  });

  it('records a category resolution error for that row and still imports a later row', async () => {
    const collidingId = '11111111-1111-4111-8111-111111111111';
    await db.exec(`INSERT INTO categories (id, name, type) VALUES (?, ?, ?)`, [
      collidingId,
      'Already',
      'expense',
    ]);
    const randomUUID = crypto.randomUUID.bind(crypto);
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      spy.mockImplementation(randomUUID);
      return collidingId;
    });

    try {
      const result = await importTransactions(db, 'acc-1', [
        row('First', 'debit', { categoryName: 'Broken' }),
        row('Later', 'debit', { categoryName: 'Kept' }),
      ]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ index: 0 });
      expect(result.errors[0]!.message.toLowerCase()).toContain('unique');

      const categories = await createCategoryRepository(db).getAll();
      expect(categories.map((category) => category.name).sort()).toEqual(['Already', 'Kept']);
      const txns = await createTransactionRepository(db).getByAccount('acc-1');
      expect(txns.map((txn) => txn.description)).toEqual(['Later']);
      expect(txns[0]!.categoryId).toBe(categories.find((category) => category.name === 'Kept')?.id);
    } finally {
      spy.mockRestore();
    }
  });

  it('links a category created by an earlier import and does not insert another', async () => {
    await importTransactions(db, 'acc-1', [
      row('Store', 'debit', { externalId: 'A', categoryName: 'Market' }),
    ]);
    const created = await createCategoryRepository(db).getAll();
    expect(created).toHaveLength(1);

    const result = await importTransactions(db, 'acc-1', [
      row('Refund', 'credit', { externalId: 'B', categoryName: 'market' }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const categories = await createCategoryRepository(db).getAll();
    expect(categories).toHaveLength(1);
    expect(categories[0]!.id).toBe(created[0]!.id);
    expect(categories[0]!.type).toBe('expense');

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns.find((txn) => txn.description === 'Refund')?.categoryId).toBe(created[0]!.id);
  });

  it('leaves an empty category null when an auto-category rule would match the description', async () => {
    await createCategoryRepository(db).create({
      id: 'cat-grocery',
      name: 'Groceries',
      type: 'expense',
    });
    const rules = createAutoCategoryRuleRepository(db);
    await rules.create({
      id: 'rule-1',
      pattern: 'walmart',
      categoryId: 'cat-grocery',
      priority: 0,
      isActive: true,
    });
    expect(suggestCategory('WALMART SUPERCENTER', await rules.getActive(), [])?.categoryId).toBe(
      'cat-grocery',
    );

    const result = await importTransactions(db, 'acc-1', [
      row('WALMART SUPERCENTER', 'debit', {
        externalId: 'W1',
        categoryName: '   ',
        tagNames: [' , ; '],
      }),
    ]);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const txns = await createTransactionRepository(db).getByAccount('acc-1');
    expect(txns[0]!.categoryId).toBeNull();
    expect(await createTransactionRepository(db).getTagIds(txns[0]!.id)).toEqual([]);
    expect(await createCategoryRepository(db).getAll()).toHaveLength(1);
    expect(await createTagRepository(db).getAll()).toHaveLength(0);
  });
});
