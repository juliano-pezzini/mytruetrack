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

  const refresh = useCallback(() => {
    const repo = createTagRepository(db);
    setTags(repo.getAll());
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (params: CreateTagParams) => {
      const repo = createTagRepository(db);
      const tag = repo.create(params);
      refresh();
      notifyChange();
      return tag;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    (id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>) => {
      const repo = createTagRepository(db);
      const tag = repo.update(id, changes);
      refresh();
      notifyChange();
      return tag;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    (id: string) => {
      const repo = createTagRepository(db);
      repo.delete(id);
      refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { tags, loading, create, update, remove, refresh };
}
