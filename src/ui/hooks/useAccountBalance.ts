import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase.ts';
import { createAccountRepository } from '../../storage/repositories/account-repository.ts';
import { createTransactionRepository } from '../../storage/repositories/transaction-repository.ts';
import { createAccountBalanceRepository } from '../../storage/repositories/account-balance-repository.ts';
import { calculateBalance } from '../../domain/balance.ts';
import type { Money } from '../../domain/money.ts';
import { fromCents } from '../../domain/money.ts';

export function useAccountBalance(accountId: string | null, date: string) {
  const db = useDatabase();
  const [balance, setBalance] = useState<Money>(fromCents(0));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!accountId) {
      setBalance(fromCents(0));
      setLoading(false);
      return;
    }
    const accountRepo = createAccountRepository(db);
    const txnRepo = createTransactionRepository(db);
    const balRepo = createAccountBalanceRepository(db);

    const account = accountRepo.getById(accountId);
    if (!account) {
      setBalance(fromCents(0));
      setLoading(false);
      return;
    }

    const transactions = txnRepo.getByAccount(accountId);
    const snapshots = balRepo.getByAccount(accountId);
    const result = calculateBalance(account, transactions, snapshots, date);
    setBalance(result);
    setLoading(false);
  }, [db, accountId, date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
