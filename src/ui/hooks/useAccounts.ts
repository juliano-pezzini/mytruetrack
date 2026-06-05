import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { createAccountRepository } from '../../storage/repositories/account-repository.ts';
import type { Account, CreateAccountParams } from '../../domain/account.ts';

export function useAccounts() {
  const db = useDatabase();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const repo = createAccountRepository(db);
    setAccounts(repo.getAll());
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (params: CreateAccountParams) => {
      const repo = createAccountRepository(db);
      const account = repo.create(params);
      refresh();
      return account;
    },
    [db, refresh],
  );

  const update = useCallback(
    (id: string, changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>) => {
      const repo = createAccountRepository(db);
      const account = repo.update(id, changes);
      refresh();
      return account;
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      const repo = createAccountRepository(db);
      repo.softDelete(id);
      refresh();
    },
    [db, refresh],
  );

  return { accounts, loading, create, update, remove, refresh };
}
