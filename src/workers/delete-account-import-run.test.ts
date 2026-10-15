import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import { createAccountImportLogRepository } from '../storage/repositories/account-import-log-repository.ts';
import { createAccountRepository } from '../storage/repositories/account-repository.ts';
import { createTransactionRepository } from '../storage/repositories/transaction-repository.ts';
import { createAccountBalanceRepository } from '../storage/repositories/account-balance-repository.ts';
import { fromCents, toCents } from '../domain/money.ts';
import { deleteAccountImportRun, currentSaoPauloYearMonth } from './delete-account-import-run.ts';

describe('deleteAccountImportRun', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
    const accounts = createAccountRepository(db);
    await accounts.create({
      id: 'acc-1',
      name: 'MP',
      type: 'bank',
      initialBalance: fromCents(100000),
    });
  });

  afterEach(async () => {
    await db.close();
  });

  async function createLog(id: string, periodEnd: string) {
    const logs = createAccountImportLogRepository(db);
    return logs.create({
      id,
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd,
      importedAt: '2026-01-02T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });
  }

  it('hard-deletes only transactions linked to the deleted log row', async () => {
    await createLog('run-1', '2026-01-15');
    await createLog('run-2', '2026-01-31');
    const txns = createTransactionRepository(db);

    await txns.create({
      id: 't-run1',
      accountId: 'acc-1',
      amount: fromCents(1000),
      description: 'From run 1',
      transactionDate: '2026-01-10',
      type: 'credit',
      externalId: 'mov-1',
      importRunId: 'run-1',
    });
    await txns.create({
      id: 't-run2',
      accountId: 'acc-1',
      amount: fromCents(2000),
      description: 'From run 2',
      transactionDate: '2026-01-20',
      type: 'debit',
      externalId: 'mov-2',
      importRunId: 'run-2',
    });

    await deleteAccountImportRun(db, 'run-2');

    expect(await txns.getById('t-run2')).toBeNull();
    expect(await txns.getById('t-run1')).not.toBeNull();
    expect(await createAccountImportLogRepository(db).listByAccount('acc-1', 'mercado_pago')).toEqual(
      [expect.objectContaining({ id: 'run-1' })],
    );
  });

  it('keeps transactions whose import_run_id is empty', async () => {
    await createLog('run-1', '2026-01-15');
    const txns = createTransactionRepository(db);

    await txns.create({
      id: 't-imported',
      accountId: 'acc-1',
      amount: fromCents(1000),
      description: 'Imported',
      transactionDate: '2026-01-10',
      type: 'debit',
      importRunId: 'run-1',
    });
    await txns.create({
      id: 't-manual',
      accountId: 'acc-1',
      amount: fromCents(500),
      description: 'Manual',
      transactionDate: '2026-01-11',
      type: 'debit',
      importRunId: null,
    });

    await deleteAccountImportRun(db, 'run-1');

    expect(await txns.getById('t-imported')).toBeNull();
    expect(await txns.getById('t-manual')).not.toBeNull();
  });

  it('keeps transactions from other import runs when deleting one run', async () => {
    await createLog('run-a', '2026-01-10');
    await createLog('run-b', '2026-01-20');
    const txns = createTransactionRepository(db);

    await txns.create({
      id: 'ta',
      accountId: 'acc-1',
      amount: fromCents(1000),
      description: 'A',
      transactionDate: '2026-01-05',
      type: 'credit',
      externalId: 'ext-a',
      importRunId: 'run-a',
    });
    await txns.create({
      id: 'tb',
      accountId: 'acc-1',
      amount: fromCents(1000),
      description: 'B',
      transactionDate: '2026-01-15',
      type: 'credit',
      externalId: 'ext-b',
      importRunId: 'run-b',
    });

    // Second run skipped ext-a; first run still owns it
    await deleteAccountImportRun(db, 'run-b');

    expect(await txns.getById('tb')).toBeNull();
    expect((await txns.getById('ta'))!.importRunId).toBe('run-a');
  });

  it('recomputes the current month account_balances snapshot after delete', async () => {
    const { year, month } = currentSaoPauloYearMonth();
    const day = '10';
    const txnDate = `${year}-${String(month).padStart(2, '0')}-${day}`;

    await createLog('run-snap', txnDate);
    const txns = createTransactionRepository(db);
    const balances = createAccountBalanceRepository(db);

    await txns.create({
      id: 't-keep',
      accountId: 'acc-1',
      amount: fromCents(5000),
      description: 'Keep',
      transactionDate: txnDate,
      type: 'credit',
      importRunId: null,
    });
    await txns.create({
      id: 't-drop',
      accountId: 'acc-1',
      amount: fromCents(2000),
      description: 'Drop',
      transactionDate: txnDate,
      type: 'credit',
      importRunId: 'run-snap',
    });

    // Stale snapshot that still includes the row about to be deleted
    await balances.upsert('acc-1', year, month, 107000);

    await deleteAccountImportRun(db, 'run-snap');

    const snaps = await balances.getByAccount('acc-1');
    const current = snaps.find((s) => s.year === year && s.month === month);
    expect(current).toBeDefined();
    // initial 100000 + remaining credit 5000
    expect(toCents(current!.closingBalance)).toBe(105000);
  });

  it('throws when the log row does not exist', async () => {
    await expect(deleteAccountImportRun(db, 'missing')).rejects.toThrow('Import log not found');
  });

  it('deleting every mercado_pago log leaves no MP-inserted transactions', async () => {
    await createLog('run-all-1', '2026-01-15');
    await createLog('run-all-2', '2026-01-31');
    const txns = createTransactionRepository(db);

    await txns.create({
      id: 't-mp-1',
      accountId: 'acc-1',
      amount: fromCents(1000),
      description: 'MP run 1',
      transactionDate: '2026-01-10',
      type: 'credit',
      externalId: 'mov-all-1',
      importRunId: 'run-all-1',
    });
    await txns.create({
      id: 't-mp-2',
      accountId: 'acc-1',
      amount: fromCents(2000),
      description: 'MP run 2',
      transactionDate: '2026-01-20',
      type: 'debit',
      externalId: 'mov-all-2',
      importRunId: 'run-all-2',
    });
    await txns.create({
      id: 't-manual-keep',
      accountId: 'acc-1',
      amount: fromCents(500),
      description: 'Manual',
      transactionDate: '2026-01-12',
      type: 'debit',
      importRunId: null,
    });

    await deleteAccountImportRun(db, 'run-all-1');
    await deleteAccountImportRun(db, 'run-all-2');

    expect(await createAccountImportLogRepository(db).listByAccount('acc-1', 'mercado_pago')).toEqual(
      [],
    );

    const linked = await db.execO(
      `SELECT id FROM transactions WHERE account_id = ? AND import_run_id IS NOT NULL AND import_run_id != ''`,
      ['acc-1'],
    );
    expect(linked).toHaveLength(0);

    expect(await txns.getById('t-manual-keep')).not.toBeNull();
    expect((await txns.getById('t-manual-keep'))!.importRunId).toBeNull();
  });
});
