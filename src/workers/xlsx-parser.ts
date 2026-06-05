/**
 * XLSX parser — converts spreadsheet files into ParsedTransaction[].
 *
 * Reads the first sheet with configurable column mapping.
 * If no type column is specified, credit/debit is inferred from amount sign.
 */

import * as XLSX from 'xlsx';
import { fromDecimal, abs as moneyAbs, isNegative } from '../domain/money.ts';
import type { TransactionType } from '../domain/transaction.ts';
import type { ParsedTransaction, XlsxParseOptions } from './types.ts';

const DEFAULTS: Required<XlsxParseOptions> = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  typeColumn: -1, // -1 = not set, infer from sign
  headerRow: true,
};

/** Convert an Excel serial date number to ISO YYYY-MM-DD. */
function excelDateToIso(serial: number): string {
  // Excel epoch is 1900-01-01 (serial 1), but has the Lotus 1-2-3 leap year bug (serial 60 = Feb 29 1900, which doesn't exist)
  const utcDays = serial - 25569; // days since Unix epoch
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize a cell value to a date string. */
function parseDate(cell: XLSX.CellObject | undefined): string {
  if (!cell) throw new Error('Missing date cell');

  // If xlsx parsed it as a date
  if (cell.t === 'd' && cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }

  // Numeric (Excel serial date)
  if (cell.t === 'n' && typeof cell.v === 'number') {
    return excelDateToIso(cell.v);
  }

  // String date — try ISO-ish formats
  if (typeof cell.v === 'string') {
    const trimmed = cell.v.trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // DD/MM/YYYY
    const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  throw new Error(`Cannot parse date from cell: ${String(cell.v)}`);
}

/**
 * Parse an XLSX file into ParsedTransaction[].
 */
export function parseXlsx(
  data: Uint8Array,
  options?: XlsxParseOptions,
): ParsedTransaction[] {
  const opts = { ...DEFAULTS, ...options };
  if (options?.typeColumn === undefined) {
    opts.typeColumn = -1;
  }

  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('XLSX file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName]!;
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const startRow = opts.headerRow ? range.s.r + 1 : range.s.r;
  const transactions: ParsedTransaction[] = [];

  for (let r = startRow; r <= range.e.r; r++) {
    const dateCell = sheet[XLSX.utils.encode_cell({ r, c: opts.dateColumn })];
    const descCell = sheet[XLSX.utils.encode_cell({ r, c: opts.descriptionColumn })];
    const amountCell = sheet[XLSX.utils.encode_cell({ r, c: opts.amountColumn })];

    // Skip empty rows
    if (!dateCell && !descCell && !amountCell) continue;
    if (!amountCell) continue;

    const description = descCell?.v != null ? String(descCell.v).trim() : 'Unknown';

    // Parse amount
    const amountStr = typeof amountCell.v === 'number'
      ? amountCell.v.toFixed(2)
      : String(amountCell.v);
    const rawAmount = fromDecimal(amountStr);

    // Determine type
    let type: TransactionType;
    if (opts.typeColumn >= 0) {
      const typeCell = sheet[XLSX.utils.encode_cell({ r, c: opts.typeColumn })];
      const typeStr = String(typeCell?.v ?? '').toUpperCase().trim();
      type = typeStr === 'CREDIT' ? 'credit' : 'debit';
    } else {
      type = isNegative(rawAmount) ? 'debit' : 'credit';
    }

    const amount = moneyAbs(rawAmount);

    transactions.push({
      date: parseDate(dateCell),
      description,
      amount,
      type,
      externalId: null,
    });
  }

  return transactions;
}
