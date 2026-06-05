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
  create(params: CreateTransactionParams): Transaction;
  getById(id: string): Transaction | null;
  getByAccount(accountId: string, dateRange?: DateRange): Transaction[];
  update(
    id: string,
    changes: Partial<
      Pick<Transaction, 'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'>
    >,
  ): Transaction;
  delete(id: string): void;
  addTags(transactionId: string, tagIds: readonly string[]): void;
  removeTags(transactionId: string, tagIds: readonly string[]): void;
  getTagIds(transactionId: string): string[];
};

export function createTransactionRepository(db: Database): TransactionRepository {
  return {
    create(params: CreateTransactionParams): Transaction {
      const txn = createTransaction(params);
      db.exec(
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

    getById(id: string): Transaction | null {
      const rows = db.execO('SELECT * FROM transactions WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToTransaction(rows[0]!);
    },

    getByAccount(accountId: string, dateRange?: DateRange): Transaction[] {
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
      return db.execO(sql, params).map(rowToTransaction);
    },

    update(
      id: string,
      changes: Partial<
        Pick<
          Transaction,
          'categoryId' | 'description' | 'transactionDate' | 'settledDate' | 'type'
        >
      >,
    ): Transaction {
      const existing = this.getById(id);
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
        db.exec(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return this.getById(id)!;
    },

    delete(id: string): void {
      db.exec('DELETE FROM transaction_tags WHERE transaction_id = ?', [id]);
      db.exec('DELETE FROM transactions WHERE id = ?', [id]);
    },

    addTags(transactionId: string, tagIds: readonly string[]): void {
      for (const tagId of tagIds) {
        db.exec(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
          [transactionId, tagId],
        );
      }
    },

    removeTags(transactionId: string, tagIds: readonly string[]): void {
      for (const tagId of tagIds) {
        db.exec(
          'DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?',
          [transactionId, tagId],
        );
      }
    },

    getTagIds(transactionId: string): string[] {
      return db
        .execO('SELECT tag_id FROM transaction_tags WHERE transaction_id = ? ORDER BY tag_id', [
          transactionId,
        ])
        .map((r) => r.tag_id as string);
    },
  };
}
