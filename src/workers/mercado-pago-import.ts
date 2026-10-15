/**
 * Commit a finished Mercado Pago binnacle fetch: map pages, import rows, write log.
 * Caller must not invoke this when any page failed.
 */

import type { Database } from '../storage/database.ts';
import { createAccountImportLogRepository } from '../storage/repositories/account-import-log-repository.ts';
import { flattenBinnaclePages } from './mercado-pago-mapper.ts';
import { importTransactions } from './import-service.ts';

export const MERCADO_PAGO_IMPORT_SOURCE = 'mercado_pago';

export type MercadoPagoImportPeriod = Readonly<{
  start: string;
  end: string;
}>;

export type ProcessMercadoPagoImportOptions = Readonly<{
  /** YYYY-MM-DD in America/Sao_Paulo — used to clamp period_end. */
  todaySaoPaulo: string;
  /** ISO timestamp stored on the log row. Defaults to now. */
  importedAt?: string;
  /** Optional fixed log id (tests). */
  logId?: string;
}>;

export type MercadoPagoImportResult = Readonly<{
  logId: string;
  imported: number;
  skipped: number;
  errorCount: number;
}>;

function clampPeriodEnd(requestedEnd: string, todaySaoPaulo: string): string {
  return requestedEnd > todaySaoPaulo ? todaySaoPaulo : requestedEnd;
}

/**
 * Map fetched binnacle pages, insert valid movements linked to a new import run,
 * and always write one account_import_logs row (including zero-insert finishes).
 */
export async function processMercadoPagoImport(
  db: Database,
  accountId: string,
  period: MercadoPagoImportPeriod,
  pages: readonly unknown[],
  options: ProcessMercadoPagoImportOptions,
): Promise<MercadoPagoImportResult> {
  const { rows, errors: mapErrors } = flattenBinnaclePages(pages);
  const logId = options.logId ?? crypto.randomUUID();
  const periodEnd = clampPeriodEnd(period.end, options.todaySaoPaulo);
  const importedAt = options.importedAt ?? new Date().toISOString();

  const importResult = await importTransactions(db, accountId, rows, logId);
  const errorCount = mapErrors.length + importResult.errors.length;

  const logs = createAccountImportLogRepository(db);
  await logs.create({
    id: logId,
    accountId,
    source: MERCADO_PAGO_IMPORT_SOURCE,
    periodStart: period.start,
    periodEnd,
    importedAt,
    importedCount: importResult.imported,
    skippedCount: importResult.skipped,
    errorCount,
  });

  return {
    logId,
    imported: importResult.imported,
    skipped: importResult.skipped,
    errorCount,
  };
}
