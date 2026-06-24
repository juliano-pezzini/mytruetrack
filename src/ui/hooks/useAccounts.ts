import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { useAutoSync } from './useAutoSync.ts';
import { createAccountRepository } from '../../storage/repositories/account-repository.ts';
import type { Account, CreateAccountParams } from '../../domain/account.ts';

export function useAccounts() {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const repo = createAccountRepository(db);
    const rows = await repo.getAll();
    setAccounts(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: CreateAccountParams) => {
      const repo = createAccountRepository(db);
      const account = await repo.create(params);
      await refresh();
      notifyChange();
      return account;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    async (id: string, changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>) => {
      const repo = createAccountRepository(db);
      const account = await repo.update(id, changes);
      await refresh();
      notifyChange();
      return account;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    async (id: string) => {
      const repo = createAccountRepository(db);
      await repo.softDelete(id);
      await refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { accounts, loading, create, update, remove, refresh };
}
