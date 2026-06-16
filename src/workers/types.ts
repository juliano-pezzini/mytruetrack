/**
 * Shared types for the import pipeline (OFX, XLSX → domain transactions).
 */

import type { Money } from '../domain/money.ts';
import type { NumberFormat } from '../domain/number-format.ts';
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

/**
 * A raw tabular grid read from a spreadsheet or CSV file.
 * The first non-empty row is treated as the header; `rows` excludes it.
 * All cell values are normalised to trimmed strings.
 */
export type ImportGrid = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

/**
 * How credit/debit amounts are encoded in the file's columns.
 * - `single`: one signed amount column (negative ⇒ debit)
 * - `separate`: distinct debit and credit columns (one populated per row)
 * - `type_column`: an unsigned amount column plus a column naming the direction
 */
export type AmountStrategy = 'single' | 'separate' | 'type_column';

/**
 * User-configurable mapping from file columns to transaction fields.
 * Column references are zero-based indices into a row; `null` means "not mapped".
 */
export type ColumnMapping = {
  readonly dateColumn: number;
  readonly descriptionColumn: number;
  readonly amountStrategy: AmountStrategy;
  readonly amountColumn: number | null; // for 'single' and 'type_column'
  readonly debitColumn: number | null; // for 'separate'
  readonly creditColumn: number | null; // for 'separate'
  readonly typeColumn: number | null; // for 'type_column'
  readonly numberFormat: NumberFormat;
};

/** A non-fatal problem found while applying a mapping to a row. */
export type MappingWarning = {
  readonly row: number; // zero-based index into ImportGrid.rows
  readonly message: string;
};

/** Result of applying a column mapping to a grid. */
export type MappingResult = {
  readonly transactions: readonly ParsedTransaction[];
  readonly warnings: readonly MappingWarning[];
};

/** A reusable column mapping persisted for future imports. */
export type SavedMapping = {
  readonly id: string;
  readonly name: string;
  readonly accountId: string | null; // null ⇒ available to any account
  readonly config: ColumnMapping;
  readonly isDefault: boolean;
  readonly lastUsedAt: number; // epoch milliseconds
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
