import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { useAutoSync } from './useAutoSync.ts';
import { createTagRepository } from '../../storage/repositories/tag-repository.ts';
import type { Tag, CreateTagParams } from '../../domain/tag.ts';

export function useTags() {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const repo = createTagRepository(db);
    const rows = await repo.getAll();
    setTags(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: CreateTagParams) => {
      const repo = createTagRepository(db);
      const tag = await repo.create(params);
      await refresh();
      notifyChange();
      return tag;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    async (id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>) => {
      const repo = createTagRepository(db);
      const tag = await repo.update(id, changes);
      await refresh();
      notifyChange();
      return tag;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    async (id: string) => {
      const repo = createTagRepository(db);
      await repo.delete(id);
      await refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { tags, loading, create, update, remove, refresh };
}
