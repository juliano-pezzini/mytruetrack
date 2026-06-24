import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createAutoCategoryRuleRepository } from './auto-category-rule-repository.ts';
import { createLearnedPatternRepository } from './learned-pattern-repository.ts';
import { createAutoCategoryCorrectionRepository } from './auto-category-correction-repository.ts';
import type { Database } from '../database.ts';
import type {
  AutoCategoryRule,
  LearnedCategoryPattern,
  AutoCategoryCorrection,
} from '../../domain/auto-categorization.ts';

describe('AutoCategoryRuleRepository', () => {
  let db: Database;
  let repo: ReturnType<typeof createAutoCategoryRuleRepository>;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createAutoCategoryRuleRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and retrieves a rule', async () => {
    const rule: AutoCategoryRule = {
      id: 'r1',
      pattern: 'WALMART',
      categoryId: 'cat-groceries',
      priority: 10,
      isActive: true,
    };
    await repo.create(rule);

    const fetched = await repo.getById('r1');
    expect(fetched).not.toBeNull();
    expect(fetched!.pattern).toBe('WALMART');
    expect(fetched!.priority).toBe(10);
  });

  it('getActive returns only active rules ordered by priority DESC', async () => {
    await repo.create({ id: 'r1', pattern: 'LOW', categoryId: 'c1', priority: 1, isActive: true });
    await repo.create({
      id: 'r2',
      pattern: 'HIGH',
      categoryId: 'c2',
      priority: 10,
      isActive: true,
    });
    await repo.create({
      id: 'r3',
      pattern: 'INACTIVE',
      categoryId: 'c3',
      priority: 100,
      isActive: false,
    });

    const active = await repo.getActive();
    expect(active).toHaveLength(2);
    expect(active[0]!.pattern).toBe('HIGH');
    expect(active[1]!.pattern).toBe('LOW');
  });

  it('updates rule fields', async () => {
    await repo.create({ id: 'r1', pattern: 'OLD', categoryId: 'c1', priority: 1, isActive: true });
    const updated = await repo.update('r1', { pattern: 'NEW', isActive: false });
    expect(updated.pattern).toBe('NEW');
    expect(updated.isActive).toBe(false);
  });

  it('updates categoryId and priority', async () => {
    await repo.create({
      id: 'r2',
      pattern: 'STORE',
      categoryId: 'c1',
      priority: 1,
      isActive: true,
    });
    const updated = await repo.update('r2', { categoryId: 'c2', priority: 50 });
    expect(updated.categoryId).toBe('c2');
    expect(updated.priority).toBe(50);
    expect(updated.pattern).toBe('STORE'); // unchanged
  });
});

describe('LearnedPatternRepository', () => {
  let db: Database;
  let repo: ReturnType<typeof createLearnedPatternRepository>;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createLearnedPatternRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  const basePattern: LearnedCategoryPattern = {
    id: 'p1',
    categoryId: 'cat-food',
    keyword: 'pizza',
    occurrenceCount: 5,
    confidenceScore: 75,
    firstLearnedAt: '2026-01-01T00:00:00Z',
    lastMatchedAt: '2026-05-01T00:00:00Z',
    isActive: true,
  };

  it('creates and retrieves by keyword', async () => {
    await repo.create(basePattern);

    const results = await repo.getByKeyword('pizza');
    expect(results).toHaveLength(1);
    expect(results[0]!.categoryId).toBe('cat-food');
    expect(results[0]!.confidenceScore).toBe(75);
  });

  it('getByKeyword returns only active patterns', async () => {
    await repo.create(basePattern);
    await repo.create({ ...basePattern, id: 'p2', isActive: false, categoryId: 'cat-other' });

    const results = await repo.getByKeyword('pizza');
    expect(results).toHaveLength(1);
  });

  it('upsert updates existing pattern with same keyword+categoryId', async () => {
    await repo.create(basePattern);

    const updated: LearnedCategoryPattern = {
      ...basePattern,
      id: 'p-new', // different ID, same keyword+categoryId
      occurrenceCount: 10,
      confidenceScore: 90,
    };

    const result = await repo.upsert(updated);
    expect(result.occurrenceCount).toBe(10);
    expect(result.confidenceScore).toBe(90);

    // Should still be one row, not two
    const all = await repo.getByKeyword('pizza');
    expect(all).toHaveLength(1);
  });

  it('upsert inserts new pattern when keyword+categoryId is novel', async () => {
    await repo.create(basePattern);

    const newPattern: LearnedCategoryPattern = {
      ...basePattern,
      id: 'p-new',
      categoryId: 'cat-different',
    };

    await repo.upsert(newPattern);

    const results = await repo.getByKeyword('pizza');
    expect(results).toHaveLength(2);
  });
});

describe('AutoCategoryCorrectionRepository', () => {
  let db: Database;
  let repo: ReturnType<typeof createAutoCategoryCorrectionRepository>;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createAutoCategoryCorrectionRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and retrieves corrections by transaction', async () => {
    const correction: AutoCategoryCorrection = {
      id: 'corr1',
      transactionId: 'txn-1',
      originalCategoryId: 'cat-old',
      correctedCategoryId: 'cat-new',
      descriptionText: 'WALMART GROCERY',
      correctionType: 'override',
      confidenceAtCorrection: 60,
    };

    await repo.create(correction);

    const results = await repo.getByTransactionId('txn-1');
    expect(results).toHaveLength(1);
    expect(results[0]!.correctedCategoryId).toBe('cat-new');
    expect(results[0]!.correctionType).toBe('override');
    expect(results[0]!.confidenceAtCorrection).toBe(60);
  });

  it('handles null originalCategoryId', async () => {
    const correction: AutoCategoryCorrection = {
      id: 'corr2',
      transactionId: 'txn-2',
      originalCategoryId: null,
      correctedCategoryId: 'cat-new',
      descriptionText: 'NEW STORE',
      correctionType: 'manual_assign',
      confidenceAtCorrection: null,
    };

    await repo.create(correction);

    const results = await repo.getByTransactionId('txn-2');
    expect(results[0]!.originalCategoryId).toBeNull();
    expect(results[0]!.confidenceAtCorrection).toBeNull();
  });
});
