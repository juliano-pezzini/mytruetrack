import type { Database, Row } from '../database.ts';

export type AccountImportLog = Readonly<{
  id: string;
  accountId: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  importedAt: string;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessages: readonly string[];
}>;

export type CreateAccountImportLogParams = {
  id: string;
  accountId: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  importedAt: string;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessages?: readonly string[];
};

function parseErrorMessages(value: unknown): readonly string[] {
  if (typeof value !== 'string' || value === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function rowToLog(row: Row): AccountImportLog {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    source: row.source as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    importedAt: row.imported_at as string,
    importedCount: row.imported_count as number,
    skippedCount: row.skipped_count as number,
    errorCount: row.error_count as number,
    errorMessages: parseErrorMessages(row.error_messages),
  };
}

export type AccountImportLogRepository = {
  create(params: CreateAccountImportLogParams): Promise<AccountImportLog>;
  listByAccount(accountId: string, source: string): Promise<AccountImportLog[]>;
  getMaxPeriodEnd(accountId: string, source: string): Promise<string | null>;
  delete(id: string): Promise<void>;
};

export function createAccountImportLogRepository(db: Database): AccountImportLogRepository {
  return {
    async create(params: CreateAccountImportLogParams): Promise<AccountImportLog> {
      const log: AccountImportLog = {
        id: params.id,
        accountId: params.accountId,
        source: params.source,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        importedAt: params.importedAt,
        importedCount: params.importedCount,
        skippedCount: params.skippedCount,
        errorCount: params.errorCount,
        errorMessages: params.errorMessages ?? [],
      };
      await db.exec(
        `INSERT INTO account_import_logs
          (id, account_id, source, period_start, period_end, imported_at, imported_count, skipped_count, error_count, error_messages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.id,
          log.accountId,
          log.source,
          log.periodStart,
          log.periodEnd,
          log.importedAt,
          log.importedCount,
          log.skippedCount,
          log.errorCount,
          JSON.stringify(log.errorMessages),
        ],
      );
      return log;
    },

    async listByAccount(accountId: string, source: string): Promise<AccountImportLog[]> {
      return (
        await db.execO(
          `SELECT * FROM account_import_logs
           WHERE account_id = ? AND source = ?
           ORDER BY imported_at DESC`,
          [accountId, source],
        )
      ).map(rowToLog);
    },

    async getMaxPeriodEnd(accountId: string, source: string): Promise<string | null> {
      const rows = await db.execO(
        `SELECT MAX(period_end) AS max_end FROM account_import_logs
         WHERE account_id = ? AND source = ?`,
        [accountId, source],
      );
      const maxEnd = rows[0]?.max_end;
      if (maxEnd === null || maxEnd === undefined || maxEnd === '') return null;
      return maxEnd as string;
    },

    async delete(id: string): Promise<void> {
      await db.exec('DELETE FROM account_import_logs WHERE id = ?', [id]);
    },
  };
}
