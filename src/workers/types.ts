/**
 * Shared types for the import pipeline (OFX, XLSX → domain transactions).
 */

import type { Money } from '../domain/money.ts';
import type { TransactionType } from '../domain/transaction.ts';

/** Intermediate parsed transaction before persistence. */
export type ParsedTransaction = {
  readonly date: string; // ISO: YYYY-MM-DD
  readonly description: string;
  readonly amount: Money; // always positive
  readonly type: TransactionType; // 'credit' | 'debit'
  readonly externalId: string | null;
};

/** Account info extracted from an OFX statement. */
export type ParsedAccountInfo = {
  readonly bankId: string | null;
  readonly accountId: string;
  readonly accountType: 'bank' | 'credit_card';
};

/** Full result from parsing an OFX file. */
export type ParsedStatement = {
  readonly accountInfo: ParsedAccountInfo;
  readonly currency: string;
  readonly transactions: readonly ParsedTransaction[];
  readonly balance: Money | null;
  readonly balanceDate: string | null;
};

/** Options for XLSX column mapping. */
export type XlsxParseOptions = {
  readonly dateColumn?: number; // default: 0
  readonly descriptionColumn?: number; // default: 1
  readonly amountColumn?: number; // default: 2
  readonly typeColumn?: number; // default: undefined (infer from sign)
  readonly headerRow?: boolean; // default: true (skip first row)
};

/** Result from the import service. */
export type ImportResult = {
  readonly imported: number;
  readonly skipped: number;
  readonly errors: readonly ImportError[];
};

/** A single import error (non-fatal). */
export type ImportError = {
  readonly index: number;
  readonly message: string;
};
