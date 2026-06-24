import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createCategoryRepository } from './category-repository.ts';
import type { Database } from '../database.ts';
import type { CategoryRepository } from './category-repository.ts';

describe('CategoryRepository', () => {
  let db: Database;
  let repo: CategoryRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createCategoryRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and reads back a category', async () => {
    const cat = await repo.create({ id: 'c1', name: 'Groceries', type: 'expense' });
    expect(cat.name).toBe('Groceries');
    expect(cat.type).toBe('expense');
    expect(cat.parentId).toBeNull();

    const fetched = await repo.getById('c1');
    expect(fetched!.name).toBe('Groceries');
  });

  it('creates category with parent', async () => {
    await repo.create({ id: 'parent', name: 'Food', type: 'expense' });
    const child = await repo.create({
      id: 'child',
      name: 'Restaurant',
      type: 'expense',
      parentId: 'parent',
    });

    expect(child.parentId).toBe('parent');

    const fetched = await repo.getById('child');
    expect(fetched!.parentId).toBe('parent');
  });

  it('getAll returns categories ordered by name', async () => {
    await repo.create({ id: 'c1', name: 'Zebra', type: 'expense' });
    await repo.create({ id: 'c2', name: 'Alpha', type: 'revenue' });
    await repo.create({ id: 'c3', name: 'Mid', type: 'expense' });

    const all = await repo.getAll();
    expect(all.map((c) => c.name)).toEqual(['Alpha', 'Mid', 'Zebra']);
  });

  it('updates only provided fields', async () => {
    await repo.create({ id: 'u1', name: 'Old', type: 'expense', description: 'desc' });
    const updated = await repo.update('u1', { name: 'New' });
    expect(updated.name).toBe('New');
    expect(updated.type).toBe('expense'); // unchanged
    expect(updated.description).toBe('desc'); // unchanged
  });

  it('updates all fields at once', async () => {
    await repo.create({ id: 'u2', name: 'Orig', type: 'expense' });
    const updated = await repo.update('u2', {
      name: 'Changed',
      type: 'revenue',
      parentId: 'p1',
      description: 'new desc',
    });
    expect(updated.name).toBe('Changed');
    expect(updated.type).toBe('revenue');
    expect(updated.parentId).toBe('p1');
    expect(updated.description).toBe('new desc');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.getById('nope')).toBeNull();
  });

  it('deletes a leaf category', async () => {
    await repo.create({ id: 'leaf', name: 'Leaf', type: 'expense' });
    await repo.delete('leaf');
    expect(await repo.getById('leaf')).toBeNull();
  });

  it('rejects deletion of category with children', async () => {
    await repo.create({ id: 'parent', name: 'Parent', type: 'expense' });
    await repo.create({ id: 'child', name: 'Child', type: 'expense', parentId: 'parent' });

    await expect(repo.delete('parent')).rejects.toThrow(/has 1 child/);
  });
});
