/**
 * Transaction — financial transaction with credit/debit type.
 *
 * Amount is always positive. Type controls direction:
 * - credit → increases account balance
 * - debit → decreases account balance
 */

import type { Money } from './money.ts';
import { isPositive } from './money.ts';

export type TransactionType = 'credit' | 'debit';

export type Transaction = Readonly<{
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: Money;
  description: string;
  transactionDate: string; // ISO date: YYYY-MM-DD
  settledDate: string | null;
  type: TransactionType;
  externalId: string | null;
}>;

export type CreateTransactionParams = {
  id: string;
  accountId: string;
  amount: Money;
  description: string;
  transactionDate: string;
  type: TransactionType;
  categoryId?: string | null;
  settledDate?: string | null;
  externalId?: string | null;
};

export function createTransaction(params: CreateTransactionParams): Transaction {
  if (!isPositive(params.amount)) {
    throw new Error('Transaction amount must be positive');
  }

  const description = params.description.trim();
  if (description === '') {
    throw new Error('Transaction description is required');
  }

  return {
    id: params.id,
    accountId: params.accountId,
    categoryId: params.categoryId ?? null,
    amount: params.amount,
    description,
    transactionDate: params.transactionDate,
    settledDate: params.settledDate ?? null,
    type: params.type,
    externalId: params.externalId ?? null,
  };
}
