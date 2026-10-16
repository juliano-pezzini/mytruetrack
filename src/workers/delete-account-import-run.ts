/**
 * Delete one account import run: hard-delete linked transactions, remove the log row,
 * and refresh the current month's account_balances snapshot.
 */

import type { Database } from '../storage/database.ts';
import { createAccountImportLogRepository } from '../storage/repositories/account-import-log-repository.ts';
import { createAccountRepository } from '../storage/repositories/account-repository.ts';
import { createTransactionRepository } from '../storage/repositories/transaction-repository.ts';
import { createAccountBalanceRepository } from '../storage/repositories/account-balance-repository.ts';
import { computeMonthSnapshot } from '../domain/balance.ts';
import { toCents } from '../domain/money.ts';

/** Current calendar year/month in America/Sao_Paulo. */
export function currentSaoPauloYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  return { year, month };
}

export async function deleteAccountImportRun(db: Database, logId: string): Promise<void> {
  const logRows = await db.execO('SELECT account_id FROM account_import_logs WHERE id = ?', [
    logId,
  ]);
  if (logRows.length === 0) {
    throw new Error(`Import log not found: ${logId}`);
  }
  const accountId = logRows[0]!.account_id as string;

  await db.exec(
    'DELETE FROM transaction_tags WHERE transaction_id IN (SELECT id FROM transactions WHERE import_run_id = ?)',
    [logId],
  );
  await db.exec('DELETE FROM transactions WHERE import_run_id = ?', [logId]);

  const logRepo = createAccountImportLogRepository(db);
  await logRepo.delete(logId);

  const accountRepo = createAccountRepository(db);
  const account = await accountRepo.getById(accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const txnRepo = createTransactionRepository(db);
  const balRepo = createAccountBalanceRepository(db);
  const transactions = await txnRepo.getByAccount(accountId);
  const snapshots = await balRepo.getByAccount(accountId);
  const { year, month } = currentSaoPauloYearMonth();
  const snapshot = computeMonthSnapshot(account, transactions, snapshots, year, month);
  await balRepo.upsert(accountId, year, month, toCents(snapshot.closingBalance));
}
