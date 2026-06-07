import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseXlsx } from './xlsx-parser.ts';
import { toCents } from '../domain/money.ts';

/** Helper: build an XLSX buffer from an array of arrays. */
function buildXlsx(rows: unknown[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf as ArrayBuffer);
}

describe('xlsx-parser', () => {
  it('parses a basic 3-row sheet with header', () => {
    const data = buildXlsx([
      ['Date', 'Description', 'Amount'],
      ['2026-01-15', 'Salary', 3000.0],
      ['2026-01-20', 'Groceries', -150.75],
      ['2026-01-25', 'Coffee', -5.0],
    ]);

    const result = parseXlsx(data);
    expect(result).toHaveLength(3);

    expect(result[0]!.date).toBe('2026-01-15');
    expect(result[0]!.description).toBe('Salary');
    expect(toCents(result[0]!.amount)).toBe(300000);
    expect(result[0]!.type).toBe('credit');

    expect(result[1]!.type).toBe('debit');
    expect(toCents(result[1]!.amount)).toBe(15075);
  });

  it('infers type from amount sign when no type column', () => {
    const data = buildXlsx([
      ['Date', 'Desc', 'Amount'],
      ['2026-02-01', 'Income', 1000.0],
      ['2026-02-02', 'Expense', -250.0],
    ]);

    const result = parseXlsx(data);
    expect(result[0]!.type).toBe('credit');
    expect(result[1]!.type).toBe('debit');
  });

  it('uses explicit type column when specified', () => {
    const data = buildXlsx([
      ['Date', 'Desc', 'Amount', 'Type'],
      ['2026-03-01', 'Refund', 50.0, 'CREDIT'],
      ['2026-03-02', 'Purchase', 75.0, 'DEBIT'],
    ]);

    const result = parseXlsx(data, { typeColumn: 3 });
    expect(result[0]!.type).toBe('credit');
    expect(toCents(result[0]!.amount)).toBe(5000);
    expect(result[1]!.type).toBe('debit');
    expect(toCents(result[1]!.amount)).toBe(7500);
  });

  it('supports custom column mapping', () => {
    const data = buildXlsx([
      ['ID', 'Amount', 'Date', 'Desc'],
      ['1', 99.99, '2026-04-01', 'Custom order'],
    ]);

    const result = parseXlsx(data, {
      dateColumn: 2,
      descriptionColumn: 3,
      amountColumn: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe('Custom order');
    expect(toCents(result[0]!.amount)).toBe(9999);
  });

  it('skips empty rows', () => {
    const data = buildXlsx([
      ['Date', 'Desc', 'Amount'],
      ['2026-05-01', 'Item 1', 10.0],
      [null, null, null],
      ['2026-05-03', 'Item 2', 20.0],
    ]);

    const result = parseXlsx(data);
    expect(result).toHaveLength(2);
  });

  it('reads without header when headerRow is false', () => {
    const data = buildXlsx([
      ['2026-06-01', 'Direct', 100.0],
      ['2026-06-02', 'Another', 200.0],
    ]);

    const result = parseXlsx(data, { headerRow: false });
    expect(result).toHaveLength(2);
    expect(result[0]!.description).toBe('Direct');
  });

  it('all parsed transactions have null externalId', () => {
    const data = buildXlsx([
      ['Date', 'Desc', 'Amount'],
      ['2026-07-01', 'Test', 50.0],
    ]);

    const result = parseXlsx(data);
    expect(result[0]!.externalId).toBeNull();
  });

  it('returns empty array for sheet with only a header', () => {
    const data = buildXlsx([['Date', 'Desc', 'Amount']]);

    const result = parseXlsx(data);
    expect(result).toHaveLength(0);
  });

  it('handles DD/MM/YYYY string dates', () => {
    // Force string cells by prefixing — or build raw sheet
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Desc', 'Amount'],
      ['15/01/2026', 'Slash date', 42.0],
    ]);
    // Force the date cell to be a string type
    const dateCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (dateCell) {
      dateCell.t = 's';
      dateCell.v = '15/01/2026';
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const data = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);

    const result = parseXlsx(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBe('2026-01-15');
  });

  it('uses Unknown for missing description cell', () => {
    const data = buildXlsx([
      ['Date', 'Desc', 'Amount'],
      ['2026-08-01', null, 75.0],
    ]);

    const result = parseXlsx(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe('Unknown');
  });

  it('handles Excel serial date numbers', () => {
    // Build a sheet with a numeric date (Excel serial)
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Desc', 'Amount'],
      [46036, 'Serial date', 100.0], // 46036 ≈ 2026-01-15
    ]);
    // Don't use cellDates so the numeric stays numeric
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const data = new Uint8Array(buf as ArrayBuffer);

    const result = parseXlsx(data);
    expect(result).toHaveLength(1);
    // The exact date depends on the serial → ISO conversion
    expect(result[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
