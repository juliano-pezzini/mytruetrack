import type { Database, Row } from '../database.ts';
import type {
  Transaction,
  TransactionType,
  CreateTransactionParams,
} from '../../domain/transaction.ts';
import { createTransaction } from '../../domain/transaction.ts';
import { fromCents, toCents } from '../../domain/money.ts';

function rowToTransaction(row: Row): Transaction {
  return createTransaction({
    id: row.id as string,
    accountId: row.account_id as string,
    categoryId: (row.category_id as string) || null,
    amount: fromCents(row.amount as number),
    description: row.description as string,
    transactionDate: row.transaction_date as string,
    settledDate: (row.settled_date as string) || null,
    type: row.type as TransactionType,
    externalId: (row.external_id as string) || null,
  });
}

export type DateRange = {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
};

export type TransactionRepository = {
  create(params: CreateTransactionParams): Promise<Transaction>;
  getById(id: string): Promise<Transaction | null>;
  getByAccount(accountId: string, dateRange?: DateRange): Promise<Transaction[]>;
  update(
    id: string,
    changes: Partial<
      Pick<Transaction, 'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'>
    >,
  ): Promise<Transaction>;
  delete(id: string): Promise<void>;
  addTags(transactionId: string, tagIds: readonly string[]): Promise<void>;
  removeTags(transactionId: string, tagIds: readonly string[]): Promise<void>;
  getTagIds(transactionId: string): Promise<string[]>;
};

export function createTransactionRepository(db: Database): TransactionRepository {
  return {
    async create(params: CreateTransactionParams): Promise<Transaction> {
      const txn = createTransaction(params);
      await db.exec(
        `INSERT INTO transactions (id, account_id, category_id, amount, description, transaction_date, settled_date, type, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txn.id,
          txn.accountId,
          txn.categoryId ?? '',
          toCents(txn.amount),
          txn.description,
          txn.transactionDate,
          txn.settledDate ?? '',
          txn.type,
          txn.externalId ?? '',
        ],
      );
      return txn;
    },

    async getById(id: string): Promise<Transaction | null> {
      const rows = await db.execO('SELECT * FROM transactions WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToTransaction(rows[0]!);
    },

    async getByAccount(accountId: string, dateRange?: DateRange): Promise<Transaction[]> {
      const conditions = ['account_id = ?'];
      const params: (string | number)[] = [accountId];

      if (dateRange?.from) {
        conditions.push('transaction_date >= ?');
        params.push(dateRange.from);
      }
      if (dateRange?.to) {
        conditions.push('transaction_date <= ?');
        params.push(dateRange.to);
      }

      const sql = `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY transaction_date DESC`;
      return (await db.execO(sql, params)).map(rowToTransaction);
    },

    async update(
      id: string,
      changes: Partial<
        Pick<Transaction, 'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'>
      >,
    ): Promise<Transaction> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Transaction not found: ${id}`);

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (changes.categoryId !== undefined) {
        sets.push('category_id = ?');
        values.push(changes.categoryId ?? '');
      }
      if (changes.description !== undefined) {
        sets.push('description = ?');
        values.push(changes.description);
      }
      if (changes.transactionDate !== undefined) {
        sets.push('transaction_date = ?');
        values.push(changes.transactionDate);
      }
      if (changes.settledDate !== undefined) {
        sets.push('settled_date = ?');
        values.push(changes.settledDate ?? '');
      }
      if (changes.type !== undefined) {
        sets.push('type = ?');
        values.push(changes.type);
      }

      if (sets.length > 0) {
        values.push(id);
        await db.exec(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return (await this.getById(id))!;
    },

    async delete(id: string): Promise<void> {
      await db.exec('DELETE FROM transaction_tags WHERE transaction_id = ?', [id]);
      await db.exec('DELETE FROM transactions WHERE id = ?', [id]);
    },

    async addTags(transactionId: string, tagIds: readonly string[]): Promise<void> {
      for (const tagId of tagIds) {
        await db.exec(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
          [transactionId, tagId],
        );
      }
    },

    async removeTags(transactionId: string, tagIds: readonly string[]): Promise<void> {
      for (const tagId of tagIds) {
        await db.exec('DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?', [
          transactionId,
          tagId,
        ]);
      }
    },

    async getTagIds(transactionId: string): Promise<string[]> {
      return (
        await db.execO(
          'SELECT tag_id FROM transaction_tags WHERE transaction_id = ? ORDER BY tag_id',
          [transactionId],
        )
      ).map((r) => r.tag_id as string);
    },
  };
}
