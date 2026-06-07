import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { createCategoryRepository } from '../../storage/repositories/category-repository.ts';
import type { Category, CreateCategoryParams } from '../../domain/category.ts';

export function useCategories() {
  const db = useDatabase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const repo = createCategoryRepository(db);
    setCategories(repo.getAll());
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (params: CreateCategoryParams) => {
      const repo = createCategoryRepository(db);
      const category = repo.create(params);
      refresh();
      return category;
    },
    [db, refresh],
  );

  const update = useCallback(
    (
      id: string,
      changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>,
    ) => {
      const repo = createCategoryRepository(db);
      const category = repo.update(id, changes);
      refresh();
      return category;
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      const repo = createCategoryRepository(db);
      repo.delete(id);
      refresh();
    },
    [db, refresh],
  );

  return { categories, loading, create, update, remove, refresh };
}
