import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { useAutoSync } from './useAutoSync.ts';
import {
  createTransactionRepository,
  type DateRange,
} from '../../storage/repositories/transaction-repository.ts';
import type { Transaction, CreateTransactionParams } from '../../domain/transaction.ts';

export function useTransactions(accountId: string | null, dateRange?: DateRange) {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    const repo = createTransactionRepository(db);
    const rows = await repo.getByAccount(accountId, dateRange);
    setTransactions(rows);
    setLoading(false);
  }, [db, accountId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (params: CreateTransactionParams) => {
      const repo = createTransactionRepository(db);
      const txn = await repo.create(params);
      await refresh();
      notifyChange();
      return txn;
    },
    [db, refresh, notifyChange],
  );

  const update = useCallback(
    async (
      id: string,
      changes: Partial<
        Pick<Transaction, 'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'>
      >,
    ) => {
      const repo = createTransactionRepository(db);
      const txn = await repo.update(id, changes);
      await refresh();
      notifyChange();
      return txn;
    },
    [db, refresh, notifyChange],
  );

  const remove = useCallback(
    async (id: string) => {
      const repo = createTransactionRepository(db);
      await repo.delete(id);
      await refresh();
      notifyChange();
    },
    [db, refresh, notifyChange],
  );

  return { transactions, loading, create, update, remove, refresh };
}
