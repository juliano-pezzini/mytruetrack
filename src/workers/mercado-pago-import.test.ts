import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../storage/init.ts';
import type { Database } from '../storage/database.ts';
import { createAccountImportLogRepository } from '../storage/repositories/account-import-log-repository.ts';
import { fromCents } from '../domain/money.ts';
import { processMercadoPagoImport } from './mercado-pago-import.ts';

function movement(overrides: Record<string, unknown> = {}) {
  return {
    movement_id: 'AbCdEfGhIjKlMnOp1',
    datetime: '2026-01-10T12:00:00.000-03:00',
    title: 'PIX in',
    amount: { currency_id: 'BRL', fraction: '10.00', cents: '1000' },
    ...overrides,
  };
}

function pageWithItems(items: unknown[]) {
  return {
    total: items.length,
    pages: 1,
    groups: [{ title: '10 de janeiro', right_content: 'Saldo', items }],
  };
}

describe('processMercadoPagoImport', () => {
  let db: Database;

  beforeEach(async () => {
    db = await initDatabase();
    await db.exec(`INSERT INTO accounts (id, name, type, initial_balance, bank_code) VALUES (?, ?, ?, ?, ?)`, [
      'acc-1',
      'MP',
      'bank',
      0,
      '323',
    ]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('commits valid rows, counts mixed row errors, and writes a mercado_pago log', async () => {
    const pages = [
      pageWithItems([
        movement({ movement_id: 'CreditMoveId00001', title: 'In' }),
        movement({
          movement_id: 'DebitMoveId000002',
          title: 'Out',
          amount: { currency_id: 'BRL', fraction: '-5.00', cents: '-500' },
        }),
        movement({
          movement_id: 'BadCurrencyId0001',
          amount: { currency_id: 'USD', fraction: '1', cents: '100' },
        }),
      ]),
    ];

    const result = await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-01-01', end: '2026-01-31' },
      pages,
      { todaySaoPaulo: '2026-02-01', importedAt: '2026-02-01T12:00:00.000Z' },
    );

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errorCount).toBe(1);

    const logs = await createAccountImportLogRepository(db).listByAccount('acc-1', 'mercado_pago');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: result.logId,
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      importedCount: 2,
      skippedCount: 0,
      errorCount: 1,
    });

    const txns = await db.execO('SELECT external_id, import_run_id, type FROM transactions WHERE account_id = ?', [
      'acc-1',
    ]);
    expect(txns).toHaveLength(2);
    expect(txns.every((r) => r.import_run_id === result.logId)).toBe(true);
  });

  it('writes a log row when zero transactions are inserted', async () => {
    const pages = [
      {
        total: 0,
        pages: 0,
        groups: [],
      },
    ];

    const result = await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-03-01', end: '2026-03-05' },
      pages,
      { todaySaoPaulo: '2026-03-05', importedAt: '2026-03-05T15:00:00.000Z' },
    );

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errorCount).toBe(0);

    const logs = await createAccountImportLogRepository(db).listByAccount('acc-1', 'mercado_pago');
    expect(logs).toHaveLength(1);
    expect(logs[0]!.periodEnd).toBe('2026-03-05');
  });

  it('clamps period_end to today when the requested end is later', async () => {
    const result = await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-01-01', end: '2026-12-31' },
      [{ total: 0, pages: 0, groups: [] }],
      { todaySaoPaulo: '2026-01-15', importedAt: '2026-01-15T00:00:00.000Z' },
    );

    const logs = await createAccountImportLogRepository(db).listByAccount('acc-1', 'mercado_pago');
    expect(logs[0]!.periodEnd).toBe('2026-01-15');
    expect(result.logId).toBe(logs[0]!.id);
  });

  it('does not lower max period_end when an older range is imported later', async () => {
    const logs = createAccountImportLogRepository(db);
    await logs.create({
      id: 'run-jan',
      accountId: 'acc-1',
      source: 'mercado_pago',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      importedAt: '2026-02-01T00:00:00.000Z',
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
    });

    await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2025-12-01', end: '2025-12-31' },
      [
        pageWithItems([
          movement({
            movement_id: 'OlderMoveId000001',
            datetime: '2025-12-10T12:00:00.000-03:00',
            title: 'Old',
          }),
        ]),
      ],
      { todaySaoPaulo: '2026-02-10', importedAt: '2026-02-10T00:00:00.000Z' },
    );

    expect(await logs.getMaxPeriodEnd('acc-1', 'mercado_pago')).toBe('2026-01-31');
  });

  it('skips duplicates and keeps the earlier import_run_id', async () => {
    const first = await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-01-01', end: '2026-01-15' },
      [pageWithItems([movement({ movement_id: 'DupMoveId00000001', title: 'Once' })])],
      { todaySaoPaulo: '2026-01-15', importedAt: '2026-01-15T00:00:00.000Z' },
    );

    const second = await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-01-15', end: '2026-01-31' },
      [pageWithItems([movement({ movement_id: 'DupMoveId00000001', title: 'Once' })])],
      { todaySaoPaulo: '2026-01-31', importedAt: '2026-01-31T00:00:00.000Z' },
    );

    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);

    const rows = await db.execO(`SELECT import_run_id FROM transactions WHERE external_id = ?`, [
      'DupMoveId00000001',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.import_run_id).toBe(first.logId);
  });

  it('stores positive integer cents on inserted rows', async () => {
    await processMercadoPagoImport(
      db,
      'acc-1',
      { start: '2026-01-01', end: '2026-01-31' },
      [
        pageWithItems([
          movement({
            movement_id: 'AmtMoveId00000001',
            amount: { currency_id: 'BRL', fraction: '15.75', cents: '1575' },
          }),
        ]),
      ],
      { todaySaoPaulo: '2026-01-31', importedAt: '2026-01-31T00:00:00.000Z' },
    );

    const rows = await db.execO(`SELECT amount FROM transactions WHERE external_id = ?`, [
      'AmtMoveId00000001',
    ]);
    expect(rows[0]!.amount).toBe(fromCents(1575));
  });
});
