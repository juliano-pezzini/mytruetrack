import { useState, useEffect, useCallback, useRef } from 'react';
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
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    if (!accountId) {
      setBalance(fromCents(0));
      setLoading(false);
      return;
    }
    const accountRepo = createAccountRepository(db);
    const txnRepo = createTransactionRepository(db);
    const balRepo = createAccountBalanceRepository(db);

    const account = await accountRepo.getById(accountId);
    if (!account) {
      if (current !== requestId.current) return;
      setBalance(fromCents(0));
      setLoading(false);
      return;
    }

    const transactions = await txnRepo.getByAccount(accountId);
    const snapshots = await balRepo.getByAccount(accountId);
    const result = calculateBalance(account, transactions, snapshots, date);
    // Ignore results from a refresh that was superseded while these queries were in flight.
    if (current !== requestId.current) return;
    setBalance(result);
    setLoading(false);
  }, [db, accountId, date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
