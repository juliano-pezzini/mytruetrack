import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import {
  createTransactionRepository,
  type DateRange,
} from '../../storage/repositories/transaction-repository.ts';
import type { Transaction, CreateTransactionParams } from '../../domain/transaction.ts';

export function useTransactions(accountId: string | null, dateRange?: DateRange) {
  const db = useDatabase();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!accountId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    const repo = createTransactionRepository(db);
    setTransactions(repo.getByAccount(accountId, dateRange));
    setLoading(false);
  }, [db, accountId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (params: CreateTransactionParams) => {
      const repo = createTransactionRepository(db);
      const txn = repo.create(params);
      refresh();
      return txn;
    },
    [db, refresh],
  );

  const update = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<Transaction, 'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'>
      >,
    ) => {
      const repo = createTransactionRepository(db);
      const txn = repo.update(id, changes);
      refresh();
      return txn;
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      const repo = createTransactionRepository(db);
      repo.delete(id);
      refresh();
    },
    [db, refresh],
  );

  return { transactions, loading, create, update, remove, refresh };
}
