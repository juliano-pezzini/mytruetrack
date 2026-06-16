/**
 * Apply a {@link ColumnMapping} to an {@link ImportGrid}, producing parsed
 * transactions plus non-fatal warnings for rows that could not be interpreted.
 *
 * This is the configurable replacement for the old fixed-column XLSX parsing: the
 * wizard chooses columns/strategy/number-format and this module does the extraction.
 */

import { parseAmount } from '../domain/number-format.ts';
import { abs as moneyAbs, isPositive, isZero, type Money } from '../domain/money.ts';
import type { TransactionType } from '../domain/transaction.ts';
import type {
  ColumnMapping,
  ImportGrid,
  MappingResult,
  MappingWarning,
  ParsedTransaction,
} from './types.ts';

const CREDIT_KEYWORDS = [
  'credit',
  'crédito',
  'credito',
  'receita',
  'entrada',
  'deposit',
  'income',
  'c',
];
const DEBIT_KEYWORDS = [
  'debit',
  'débito',
  'debito',
  'despesa',
  'saída',
  'saida',
  'withdrawal',
  'expense',
  'd',
];

/** Parse a date cell into ISO YYYY-MM-DD. Accepts ISO and D/M/Y (day-first) forms. */
function parseDateValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') throw new Error('empty date');

  // ISO (optionally with a time component).
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`invalid date: "${raw}"`);
    }
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // D/M/Y or M/D/Y with '/', '-' or '.' separators and a 4-digit year.
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const year = dmy[3]!;
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      // Ambiguous → assume day-first (the dominant convention for this app's users).
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`invalid date: "${raw}"`);
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  throw new Error(`invalid date: "${raw}"`);
}

function cellAt(row: readonly string[], col: number | null): string {
  if (col == null || col < 0 || col >= row.length) return '';
  return row[col] ?? '';
}

function classifyType(raw: string): TransactionType | null {
  const v = raw.toLowerCase().trim();
  if (v === '') return null;
  if (DEBIT_KEYWORDS.includes(v) || DEBIT_KEYWORDS.some((kw) => kw.length > 1 && v.includes(kw))) {
    return 'debit';
  }
  if (
    CREDIT_KEYWORDS.includes(v) ||
    CREDIT_KEYWORDS.some((kw) => kw.length > 1 && v.includes(kw))
  ) {
    return 'credit';
  }
  return null;
}

/** Extract { amount, type } for a row according to the amount strategy. */
function extractAmountAndType(
  row: readonly string[],
  mapping: ColumnMapping,
): { amount: Money; type: TransactionType } {
  switch (mapping.amountStrategy) {
    case 'single': {
      const signed = parseAmount(cellAt(row, mapping.amountColumn), mapping.numberFormat);
      const type: TransactionType = signed < 0 ? 'debit' : 'credit';
      return { amount: moneyAbs(signed), type };
    }
    case 'separate': {
      const debitRaw = cellAt(row, mapping.debitColumn);
      const creditRaw = cellAt(row, mapping.creditColumn);
      const debit =
        debitRaw === '' ? (0 as Money) : moneyAbs(parseAmount(debitRaw, mapping.numberFormat));
      const credit =
        creditRaw === '' ? (0 as Money) : moneyAbs(parseAmount(creditRaw, mapping.numberFormat));
      const hasDebit = !isZero(debit);
      const hasCredit = !isZero(credit);
      if (hasDebit && !hasCredit) return { amount: debit, type: 'debit' };
      if (hasCredit && !hasDebit) return { amount: credit, type: 'credit' };
      throw new Error('row must have exactly one of debit or credit');
    }
    case 'type_column': {
      const amount = moneyAbs(parseAmount(cellAt(row, mapping.amountColumn), mapping.numberFormat));
      const type = classifyType(cellAt(row, mapping.typeColumn));
      if (type == null) {
        throw new Error(`unrecognised transaction type: "${cellAt(row, mapping.typeColumn)}"`);
      }
      return { amount, type };
    }
    default: {
      const _exhaustive: never = mapping.amountStrategy;
      throw new Error(`unknown amount strategy: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Apply a column mapping to a grid. Rows that cannot be parsed are reported as
 * warnings (with their zero-based row index) instead of aborting the whole import.
 */
export function applyMapping(grid: ImportGrid, mapping: ColumnMapping): MappingResult {
  const transactions: ParsedTransaction[] = [];
  const warnings: MappingWarning[] = [];

  for (let i = 0; i < grid.rows.length; i++) {
    const row = grid.rows[i]!;
    try {
      const date = parseDateValue(cellAt(row, mapping.dateColumn));
      const descRaw = cellAt(row, mapping.descriptionColumn).trim();
      const description = descRaw === '' ? 'Unknown' : descRaw;
      const { amount, type } = extractAmountAndType(row, mapping);

      if (!isPositive(amount)) {
        warnings.push({ row: i, message: 'amount must be greater than zero' });
        continue;
      }

      transactions.push({ date, description, amount, type, externalId: null });
    } catch (err) {
      warnings.push({ row: i, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { transactions, warnings };
}
