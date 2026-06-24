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

  const refresh = useCallback(async () => {
    const repo = createCategoryRepository(db);
    const rows = await repo.getAll();
    setCategories(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: CreateCategoryParams) => {
      const repo = createCategoryRepository(db);
      const category = await repo.create(params);
      await refresh();
      notifyChange();
      return category;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    async (
      id: string,
      changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>,
    ) => {
      const repo = createCategoryRepository(db);
      const category = await repo.update(id, changes);
      await refresh();
      notifyChange();
      return category;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    async (id: string) => {
      const repo = createCategoryRepository(db);
      await repo.delete(id);
      await refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { categories, loading, create, update, remove, refresh };
}
