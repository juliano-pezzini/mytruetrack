import { describe, it, expect } from 'vitest';
import { readCsvGrid } from './csv-parser.ts';

describe('csv-parser', () => {
  it('reads a comma-delimited grid with a header row', () => {
    const grid = readCsvGrid('Date,Description,Amount\n2026-01-15,Salary,3000.00\n');
    expect(grid.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0]).toEqual(['2026-01-15', 'Salary', '3000.00']);
  });

  it('auto-detects the semicolon delimiter (common in BR exports)', () => {
    const grid = readCsvGrid('Data;Descrição;Valor\n15/01/2026;Salário;1.234,56\n');
    expect(grid.headers).toEqual(['Data', 'Descrição', 'Valor']);
    expect(grid.rows[0]).toEqual(['15/01/2026', 'Salário', '1.234,56']);
  });

  it('handles quoted fields with embedded delimiters', () => {
    const grid = readCsvGrid('Date,Description,Amount\n2026-01-15,"Store, Inc.",10.00\n');
    expect(grid.rows[0]).toEqual(['2026-01-15', 'Store, Inc.', '10.00']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const grid = readCsvGrid('A,B\n"say ""hi""",2\n');
    expect(grid.rows[0]).toEqual(['say "hi"', '2']);
  });

  it('strips a UTF-8 BOM and skips leading empty rows', () => {
    const grid = readCsvGrid('\uFEFF\nDate,Amount\n2026-01-01,5\n');
    expect(grid.headers).toEqual(['Date', 'Amount']);
    expect(grid.rows[0]).toEqual(['2026-01-01', '5']);
  });

  it('drops fully-empty data rows', () => {
    const grid = readCsvGrid('A,B\n1,2\n,\n3,4\n');
    expect(grid.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('returns an empty grid for blank input', () => {
    expect(readCsvGrid('   ')).toEqual({ headers: [], rows: [] });
  });
});
