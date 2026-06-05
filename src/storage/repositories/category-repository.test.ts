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

  afterEach(() => closeDatabase(db));

  it('creates and reads back a category', () => {
    const cat = repo.create({ id: 'c1', name: 'Groceries', type: 'expense' });
    expect(cat.name).toBe('Groceries');
    expect(cat.type).toBe('expense');
    expect(cat.parentId).toBeNull();

    const fetched = repo.getById('c1');
    expect(fetched!.name).toBe('Groceries');
  });

  it('creates category with parent', () => {
    repo.create({ id: 'parent', name: 'Food', type: 'expense' });
    const child = repo.create({ id: 'child', name: 'Restaurant', type: 'expense', parentId: 'parent' });

    expect(child.parentId).toBe('parent');

    const fetched = repo.getById('child');
    expect(fetched!.parentId).toBe('parent');
  });

  it('getAll returns categories ordered by name', () => {
    repo.create({ id: 'c1', name: 'Zebra', type: 'expense' });
    repo.create({ id: 'c2', name: 'Alpha', type: 'revenue' });
    repo.create({ id: 'c3', name: 'Mid', type: 'expense' });

    const all = repo.getAll();
    expect(all.map((c) => c.name)).toEqual(['Alpha', 'Mid', 'Zebra']);
  });

  it('updates only provided fields', () => {
    repo.create({ id: 'u1', name: 'Old', type: 'expense', description: 'desc' });
    const updated = repo.update('u1', { name: 'New' });
    expect(updated.name).toBe('New');
    expect(updated.type).toBe('expense'); // unchanged
    expect(updated.description).toBe('desc'); // unchanged
  });

  it('updates all fields at once', () => {
    repo.create({ id: 'u2', name: 'Orig', type: 'expense' });
    const updated = repo.update('u2', { name: 'Changed', type: 'revenue', parentId: 'p1', description: 'new desc' });
    expect(updated.name).toBe('Changed');
    expect(updated.type).toBe('revenue');
    expect(updated.parentId).toBe('p1');
    expect(updated.description).toBe('new desc');
  });

  it('returns null for non-existent id', () => {
    expect(repo.getById('nope')).toBeNull();
  });

  it('deletes a leaf category', () => {
    repo.create({ id: 'leaf', name: 'Leaf', type: 'expense' });
    repo.delete('leaf');
    expect(repo.getById('leaf')).toBeNull();
  });

  it('rejects deletion of category with children', () => {
    repo.create({ id: 'parent', name: 'Parent', type: 'expense' });
    repo.create({ id: 'child', name: 'Child', type: 'expense', parentId: 'parent' });

    expect(() => repo.delete('parent')).toThrow(/has 1 child/);
  });
});
