import type { Database, Row } from '../database.ts';
import type { Account, AccountType, CreateAccountParams } from '../../domain/account.ts';
import { createAccount } from '../../domain/account.ts';
import { fromCents, toCents } from '../../domain/money.ts';

function rowToAccount(row: Row): Account {
  return createAccount({
    id: row.id as string,
    name: row.name as string,
    type: row.type as AccountType,
    initialBalance: fromCents(row.initial_balance as number),
    isActive: row.is_active === 1,
    description: (row.description as string) || null,
  });
}

export type AccountRepository = {
  create(params: CreateAccountParams): Promise<Account>;
  getById(id: string): Promise<Account | null>;
  getAll(options?: { includeInactive?: boolean }): Promise<Account[]>;
  update(
    id: string,
    changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>,
  ): Promise<Account>;
  softDelete(id: string): Promise<void>;
};

export function createAccountRepository(db: Database): AccountRepository {
  return {
    async create(params: CreateAccountParams): Promise<Account> {
      const account = createAccount(params);
      await db.exec(
        'INSERT INTO accounts (id, name, type, initial_balance, is_active, description) VALUES (?, ?, ?, ?, ?, ?)',
        [
          account.id,
          account.name,
          account.type,
          toCents(account.initialBalance),
          account.isActive ? 1 : 0,
          account.description ?? '',
        ],
      );
      return account;
    },

    async getById(id: string): Promise<Account | null> {
      const rows = await db.execO('SELECT * FROM accounts WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToAccount(rows[0]!);
    },

    async getAll(options?: { includeInactive?: boolean }): Promise<Account[]> {
      const sql = options?.includeInactive
        ? 'SELECT * FROM accounts ORDER BY name'
        : 'SELECT * FROM accounts WHERE is_active = 1 ORDER BY name';
      return (await db.execO(sql)).map(rowToAccount);
    },

    async update(
      id: string,
      changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>,
    ): Promise<Account> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Account not found: ${id}`);

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (changes.name !== undefined) {
        sets.push('name = ?');
        values.push(changes.name);
      }
      if (changes.type !== undefined) {
        sets.push('type = ?');
        values.push(changes.type);
      }
      if (changes.description !== undefined) {
        sets.push('description = ?');
        values.push(changes.description ?? '');
      }

      if (sets.length > 0) {
        values.push(id);
        await db.exec(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return (await this.getById(id))!;
    },

    async softDelete(id: string): Promise<void> {
      await db.exec('UPDATE accounts SET is_active = 0 WHERE id = ?', [id]);
    },
  };
}
