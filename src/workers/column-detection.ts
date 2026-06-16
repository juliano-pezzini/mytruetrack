/**
 * Column auto-detection — suggests a {@link ColumnMapping} from a grid's headers and
 * sample rows, so the import wizard can pre-fill sensible defaults.
 *
 * Header matching is keyword-based and bilingual (English + Portuguese) to cover the
 * Brazilian bank exports this app must support. When detection is uncertain it falls
 * back to positional defaults rather than guessing wrong.
 */

import { detectNumberFormat, type NumberFormat } from '../domain/number-format.ts';
import type { AmountStrategy, ColumnMapping, ImportGrid } from './types.ts';

/** Keyword groups per field. Lower-cased substrings, English + Portuguese. */
const KEYWORDS = {
  date: ['date', 'data', 'dia', 'posted', 'lançamento', 'lancamento', 'vencimento'],
  description: [
    'description',
    'descrição',
    'descricao',
    'memo',
    'histórico',
    'historico',
    'detalhe',
    'lançamento',
    'lancamento',
    'narrative',
    'payee',
  ],
  amount: ['amount', 'valor', 'value', 'montante', 'total'],
  debit: ['debit', 'débito', 'debito', 'saída', 'saida', 'withdrawal', 'expense', 'despesa'],
  credit: ['credit', 'crédito', 'credito', 'entrada', 'deposit', 'income', 'receita'],
  type: ['type', 'tipo', 'natureza', 'd/c', 'dc', 'indicator', 'direction'],
} as const;

function normalize(header: string): string {
  return header.toLowerCase().trim();
}

/** Find the first header index whose text contains any of the keywords. */
function findColumn(headers: readonly string[], keywords: readonly string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = normalize(headers[i]!);
    if (h !== '' && keywords.some((kw) => h.includes(kw))) {
      return i;
    }
  }
  return null;
}

/** Collect the cell values of a column across all rows (for format sampling). */
function columnSamples(grid: ImportGrid, col: number): string[] {
  const samples: string[] = [];
  for (const row of grid.rows) {
    const v = row[col];
    if (v != null && v !== '') samples.push(v);
  }
  return samples;
}

/**
 * Suggest a column mapping for the given grid.
 *
 * Strategy selection:
 * - both a debit and a credit column found ⇒ `separate`
 * - an amount column plus a distinct type column ⇒ `type_column`
 * - otherwise ⇒ `single` (sign-based)
 */
export function guessMapping(grid: ImportGrid): ColumnMapping {
  const { headers } = grid;

  const dateColumn = findColumn(headers, KEYWORDS.date) ?? 0;
  const descriptionColumn =
    findColumn(headers, KEYWORDS.description) ?? (headers.length > 1 ? 1 : 0);
  const amountColumn = findColumn(headers, KEYWORDS.amount);
  const debitColumn = findColumn(headers, KEYWORDS.debit);
  const creditColumn = findColumn(headers, KEYWORDS.credit);
  const typeColumn = findColumn(headers, KEYWORDS.type);

  let amountStrategy: AmountStrategy;
  if (debitColumn != null && creditColumn != null && debitColumn !== creditColumn) {
    amountStrategy = 'separate';
  } else if (amountColumn != null && typeColumn != null && typeColumn !== amountColumn) {
    amountStrategy = 'type_column';
  } else {
    amountStrategy = 'single';
  }

  // Sample the relevant amount column(s) to infer the decimal format.
  const formatSampleCols: number[] = [];
  if (amountStrategy === 'separate') {
    if (debitColumn != null) formatSampleCols.push(debitColumn);
    if (creditColumn != null) formatSampleCols.push(creditColumn);
  } else if (amountColumn != null) {
    formatSampleCols.push(amountColumn);
  } else {
    // Fall back to the positional amount column used below.
    formatSampleCols.push(headers.length > 2 ? 2 : headers.length - 1);
  }
  const samples = formatSampleCols.flatMap((c) => columnSamples(grid, c));
  const numberFormat: NumberFormat = detectNumberFormat(samples);

  const resolvedAmountColumn =
    amountStrategy === 'separate'
      ? null
      : (amountColumn ?? (headers.length > 2 ? 2 : headers.length - 1));

  return {
    dateColumn,
    descriptionColumn,
    amountStrategy,
    amountColumn: resolvedAmountColumn,
    debitColumn: amountStrategy === 'separate' ? debitColumn : null,
    creditColumn: amountStrategy === 'separate' ? creditColumn : null,
    typeColumn: amountStrategy === 'type_column' ? typeColumn : null,
    numberFormat,
  };
}
