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
  create(params: CreateAccountParams): Account;
  getById(id: string): Account | null;
  getAll(options?: { includeInactive?: boolean }): Account[];
  update(id: string, changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>): Account;
  softDelete(id: string): void;
};

export function createAccountRepository(db: Database): AccountRepository {
  return {
    create(params: CreateAccountParams): Account {
      const account = createAccount(params);
      db.exec(
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

    getById(id: string): Account | null {
      const rows = db.execO('SELECT * FROM accounts WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToAccount(rows[0]!);
    },

    getAll(options?: { includeInactive?: boolean }): Account[] {
      const sql = options?.includeInactive
        ? 'SELECT * FROM accounts ORDER BY name'
        : 'SELECT * FROM accounts WHERE is_active = 1 ORDER BY name';
      return db.execO(sql).map(rowToAccount);
    },

    update(id: string, changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>): Account {
      const existing = this.getById(id);
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
        db.exec(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return this.getById(id)!;
    },

    softDelete(id: string): void {
      db.exec('UPDATE accounts SET is_active = 0 WHERE id = ?', [id]);
    },
  };
}
