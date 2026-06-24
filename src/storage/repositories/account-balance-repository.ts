import type { Database, Row } from '../database.ts';
import type { AccountBalance } from '../../domain/balance.ts';
import { fromCents } from '../../domain/money.ts';

function rowToAccountBalance(row: Row): AccountBalance {
  return {
    accountId: row.account_id as string,
    year: row.year as number,
    month: row.month as number,
    closingBalance: fromCents(row.closing_balance as number),
  };
}

export type AccountBalanceRepository = {
  upsert(accountId: string, year: number, month: number, closingBalance: number): Promise<void>;
  getByAccount(accountId: string): Promise<AccountBalance[]>;
  getLatest(accountId: string, beforeDate: string): Promise<AccountBalance | null>;
};

export function createAccountBalanceRepository(db: Database): AccountBalanceRepository {
  return {
    async upsert(
      accountId: string,
      year: number,
      month: number,
      closingBalance: number,
    ): Promise<void> {
      await db.exec(
        `INSERT INTO account_balances (account_id, year, month, closing_balance)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (account_id, year, month) DO UPDATE SET closing_balance = excluded.closing_balance`,
        [accountId, year, month, closingBalance],
      );
    },

    async getByAccount(accountId: string): Promise<AccountBalance[]> {
      return (
        await db.execO(
          'SELECT * FROM account_balances WHERE account_id = ? ORDER BY year DESC, month DESC',
          [accountId],
        )
      ).map(rowToAccountBalance);
    },

    async getLatest(accountId: string, beforeDate: string): Promise<AccountBalance | null> {
      // Parse date to get year/month boundary
      const parts = beforeDate.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);

      const rows = await db.execO(
        `SELECT * FROM account_balances
         WHERE account_id = ? AND (year < ? OR (year = ? AND month <= ?))
         ORDER BY year DESC, month DESC
         LIMIT 1`,
        [accountId, year, year, month],
      );

      if (rows.length === 0) return null;
      return rowToAccountBalance(rows[0]!);
    },
  };
}
