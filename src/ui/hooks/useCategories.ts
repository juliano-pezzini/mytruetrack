import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { useAutoSync } from './useAutoSync.ts';
import { createCategoryRepository } from '../../storage/repositories/category-repository.ts';
import type { Category, CreateCategoryParams } from '../../domain/category.ts';

export function useCategories() {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
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
      notifyChange();
      return category;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    (
      id: string,
      changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>,
    ) => {
      const repo = createCategoryRepository(db);
      const category = repo.update(id, changes);
      refresh();
      notifyChange();
      return category;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    (id: string) => {
      const repo = createCategoryRepository(db);
      repo.delete(id);
      refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { categories, loading, create, update, remove, refresh };
}
