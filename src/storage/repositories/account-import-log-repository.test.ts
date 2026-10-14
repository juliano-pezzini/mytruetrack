import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createAccountImportLogRepository } from './account-import-log-repository.ts';
import type { Database } from '../database.ts';
import type { AccountImportLogRepository } from './account-import-log-repository.ts';

describe('AccountImportLogRepository', () => {
  let db: Database;
  let repo: AccountImportLogRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createAccountImportLogRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates a log row with source and reads it back via listByAccount', async () => {
    const log = await repo.create({
      id: 'log-1',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      importedAt: '2026-02-01T12:00:00.000Z',
      importedCount: 5,
      skippedCount: 2,
      errorCount: 1,
    });

    expect(log.id).toBe('log-1');
    expect(log.accountId).toBe('acc-1');
    expect(log.source).toBe('mercado_pago');
    expect(log.periodStart).toBe('2026-01-01');
    expect(log.periodEnd).toBe('2026-01-31');
    expect(log.importedAt).toBe('2026-02-01T12:00:00.000Z');
    expect(log.importedCount).toBe(5);
    expect(log.skippedCount).toBe(2);
    expect(log.errorCount).toBe(1);

    const listed = await repo.listByAccount('acc-1', 'mercado_pago');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(log);
  });

  it('listByAccount filters by source so frontiers do not mix', async () => {
    await repo.create({
      id: 'mp-1',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-15',
      importedAt: '2026-01-16T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });
    await repo.create({
      id: 'other-1',
      accountId: 'acc-1',
      source: 'other_source',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      importedAt: '2026-03-01T00:00:00.000Z',
      importedCount: 3,
      skippedCount: 0,
      errorCount: 0,
    });

    const mpOnly = await repo.listByAccount('acc-1', 'mercado_pago');
    expect(mpOnly).toHaveLength(1);
    expect(mpOnly[0]!.id).toBe('mp-1');

    const otherOnly = await repo.listByAccount('acc-1', 'other_source');
    expect(otherOnly).toHaveLength(1);
    expect(otherOnly[0]!.id).toBe('other-1');
  });

  it('listByAccount returns only rows for the given account', async () => {
    await repo.create({
      id: 'a1',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-10',
      importedAt: '2026-01-11T00:00:00.000Z',
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
    });
    await repo.create({
      id: 'a2',
      accountId: 'acc-2',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-20',
      importedAt: '2026-01-21T00:00:00.000Z',
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
    });

    const listed = await repo.listByAccount('acc-1', 'mercado_pago');
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe('a1');
  });

  it('getMaxPeriodEnd returns the greatest period_end for the account and source', async () => {
    await repo.create({
      id: 'older',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
      importedAt: '2026-01-01T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });
    await repo.create({
      id: 'newer',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      importedAt: '2026-02-01T00:00:00.000Z',
      importedCount: 2,
      skippedCount: 0,
      errorCount: 0,
    });
    await repo.create({
      id: 'other-src',
      accountId: 'acc-1',
      source: 'other_source',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      importedAt: '2026-04-01T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });

    expect(await repo.getMaxPeriodEnd('acc-1', 'mercado_pago')).toBe('2026-01-31');
    expect(await repo.getMaxPeriodEnd('acc-1', 'other_source')).toBe('2026-03-31');
  });

  it('getMaxPeriodEnd returns null when no logs exist for the pair', async () => {
    expect(await repo.getMaxPeriodEnd('acc-missing', 'mercado_pago')).toBeNull();
  });

  it('delete removes the log row and updates max period_end', async () => {
    await repo.create({
      id: 'keep',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2025-12-01',
      periodEnd: '2025-12-15',
      importedAt: '2025-12-16T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });
    await repo.create({
      id: 'remove',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      importedAt: '2026-02-01T00:00:00.000Z',
      importedCount: 2,
      skippedCount: 0,
      errorCount: 0,
    });

    await repo.delete('remove');

    const listed = await repo.listByAccount('acc-1', 'mercado_pago');
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe('keep');
    expect(await repo.getMaxPeriodEnd('acc-1', 'mercado_pago')).toBe('2025-12-15');
  });
});
