import { describe, it, expect } from 'vitest';
import { createCategory } from './category.ts';
import type { CategoryType } from './category.ts';

describe('Category', () => {
  it('creates a root expense category', () => {
    const cat = createCategory({ id: 'cat-1', name: 'Food', type: 'expense' });
    expect(cat.id).toBe('cat-1');
    expect(cat.name).toBe('Food');
    expect(cat.type).toBe('expense');
    expect(cat.parentId).toBeNull();
    expect(cat.description).toBeNull();
  });

  it('creates a child category with parentId', () => {
    const cat = createCategory({
      id: 'cat-2',
      name: 'Groceries',
      type: 'expense',
      parentId: 'cat-1',
    });
    expect(cat.parentId).toBe('cat-1');
  });

  it('creates a revenue category with description', () => {
    const cat = createCategory({
      id: 'cat-3',
      name: 'Salary',
      type: 'revenue',
      description: 'Monthly salary',
    });
    expect(cat.type).toBe('revenue');
    expect(cat.description).toBe('Monthly salary');
  });

  it('trims whitespace from name', () => {
    const cat = createCategory({ id: 'cat-4', name: '  Dining Out  ', type: 'expense' });
    expect(cat.name).toBe('Dining Out');
  });

  it('rejects empty name', () => {
    expect(() => createCategory({ id: 'cat-5', name: '', type: 'expense' })).toThrow(
      'name is required',
    );
  });

  it('rejects whitespace-only name', () => {
    expect(() => createCategory({ id: 'cat-6', name: '   ', type: 'expense' })).toThrow(
      'name is required',
    );
  });

  it('type discriminates correctly in switch', () => {
    const types: CategoryType[] = ['revenue', 'expense'];
    for (const t of types) {
      switch (t) {
        case 'revenue':
        case 'expense':
          break;
        default: {
          const _exhaustive: never = t;
          throw new Error(`Unknown type: ${_exhaustive}`);
        }
      }
    }
  });
});
