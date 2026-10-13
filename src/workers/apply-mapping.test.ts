import { describe, it, expect } from 'vitest';
import { applyMapping } from './apply-mapping.ts';
import { toCents } from '../domain/money.ts';
import type { ColumnMapping, ImportGrid } from './types.ts';

const baseMapping: ColumnMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountStrategy: 'single',
  amountColumn: 2,
  debitColumn: null,
  creditColumn: null,
  typeColumn: null,
  numberFormat: 'us',
};

describe('apply-mapping', () => {
  it('parses a single signed amount column (sign → type)', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['2026-01-15', 'Salary', '3000.00'],
        ['2026-01-20', 'Groceries', '-150.75'],
      ],
    };
    const { transactions, warnings } = applyMapping(grid, baseMapping);
    expect(warnings).toHaveLength(0);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({ date: '2026-01-15', type: 'credit' });
    expect(toCents(transactions[0]!.amount)).toBe(300000);
    expect(transactions[1]).toMatchObject({ type: 'debit' });
    expect(toCents(transactions[1]!.amount)).toBe(15075);
  });

  it('parses Brazilian data (EU decimals, dd/mm/yyyy, Receita/Despesa type column)', () => {
    const grid: ImportGrid = {
      headers: ['Data', 'Descrição', 'Valor', 'Tipo'],
      rows: [
        ['15/01/2026', 'Salário', '1.234,56', 'Receita'],
        ['16/01/2026', 'Mercado', '99,90', 'Despesa'],
      ],
    };
    const mapping: ColumnMapping = {
      ...baseMapping,
      amountStrategy: 'type_column',
      typeColumn: 3,
      numberFormat: 'eu',
    };
    const { transactions, warnings } = applyMapping(grid, mapping);
    expect(warnings).toHaveLength(0);
    expect(transactions[0]).toMatchObject({ date: '2026-01-15', type: 'credit' });
    expect(toCents(transactions[0]!.amount)).toBe(123456);
    expect(transactions[1]).toMatchObject({ date: '2026-01-16', type: 'debit' });
    expect(toCents(transactions[1]!.amount)).toBe(9990);
  });

  it('parses separate debit and credit columns', () => {
    const grid: ImportGrid = {
      headers: ['Data', 'Histórico', 'Débito', 'Crédito'],
      rows: [
        ['15/01/2026', 'Compra', '50,00', ''],
        ['16/01/2026', 'Depósito', '', '200,00'],
      ],
    };
    const mapping: ColumnMapping = {
      ...baseMapping,
      amountStrategy: 'separate',
      amountColumn: null,
      debitColumn: 2,
      creditColumn: 3,
      numberFormat: 'eu',
    };
    const { transactions, warnings } = applyMapping(grid, mapping);
    expect(warnings).toHaveLength(0);
    expect(transactions[0]).toMatchObject({ type: 'debit' });
    expect(toCents(transactions[0]!.amount)).toBe(5000);
    expect(transactions[1]).toMatchObject({ type: 'credit' });
    expect(toCents(transactions[1]!.amount)).toBe(20000);
  });

  it('reports a warning for an unparseable row instead of throwing', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['2026-01-15', 'Good', '10.00'],
        ['not-a-date', 'Bad date', '20.00'],
        ['2026-01-17', 'Bad amount', 'Receita'],
      ],
    };
    const { transactions, warnings } = applyMapping(grid, baseMapping);
    expect(transactions).toHaveLength(1);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]!.row).toBe(1);
    expect(warnings[1]!.row).toBe(2);
  });

  it('defaults a blank description to "Unknown"', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['2026-01-15', '', '10.00']],
    };
    const { transactions } = applyMapping(grid, baseMapping);
    expect(transactions[0]!.description).toBe('Unknown');
  });

  it('warns on an out-of-range ISO date instead of persisting it', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['2026-99-99', 'Impossible', '10.00'],
        ['2026-01-15', 'Good', '20.00'],
      ],
    };
    const { transactions, warnings } = applyMapping(grid, baseMapping);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ date: '2026-01-15' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.row).toBe(0);
  });

  it('warns when a separate row has neither debit nor credit', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Desc', 'Debit', 'Credit'],
      rows: [['2026-01-15', 'Empty', '', '']],
    };
    const mapping: ColumnMapping = {
      ...baseMapping,
      amountStrategy: 'separate',
      amountColumn: null,
      debitColumn: 2,
      creditColumn: 3,
    };
    const { transactions, warnings } = applyMapping(grid, mapping);
    expect(transactions).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it('parses 01/15/2026 as month-first and skips it under day-first', () => {
    const monthGrid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['01/15/2026', 'Rent', '10.00']],
    };
    const monthFirst = applyMapping(monthGrid, { ...baseMapping, dateFormat: 'mdy' });
    expect(monthFirst.warnings).toEqual([]);
    expect(monthFirst.transactions[0]?.date).toBe('2026-01-15');

    const dayGrid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['01/15/2026', 'Rent', '10.00'],
        ['16/01/2026', 'Sibling', '20.00'],
      ],
    };
    const dayFirst = applyMapping(dayGrid, { ...baseMapping, dateFormat: 'dmy' });
    expect(dayFirst.transactions.map((tx) => tx.description)).toEqual(['Sibling']);
    expect(dayFirst.transactions[0]?.date).toBe('2026-01-16');
    expect(dayFirst.warnings).toEqual([{ row: 0, message: 'invalid date: "01/15/2026"' }]);
  });

  it('parses an ISO cell when the date format is day-first', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['2026-01-15', 'Salary', '10.00']],
    };
    const { transactions, warnings } = applyMapping(grid, { ...baseMapping, dateFormat: 'dmy' });
    expect(warnings).toEqual([]);
    expect(transactions[0]?.date).toBe('2026-01-15');
  });

  it('copies a mapped category as a stored name and splits the tags cell', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount', 'Category', 'Tags'],
      rows: [['2026-01-15', 'Groceries', '-10.00', '  Super   Market ', 'food, travel; work']],
    };
    const { transactions, warnings } = applyMapping(grid, {
      ...baseMapping,
      categoryColumn: 3,
      tagsColumn: 4,
    });
    expect(warnings).toEqual([]);
    expect(transactions[0]?.categoryName).toBe('Super Market');
    expect(transactions[0]?.tagNames).toEqual(['food', 'travel', 'work']);
  });

  it('yields a null category and an empty tag list when those columns are unmapped or blank', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount', 'Category', 'Tags'],
      rows: [
        ['2026-01-15', 'Unmapped', '10.00', 'Groceries', 'food'],
        ['2026-01-16', 'Blank', '20.00', '   ', ' , ; '],
        ['2026-01-17', 'Out of range', '30.00', 'Groceries', 'food'],
      ],
    };

    const unmapped = applyMapping(grid, baseMapping);
    expect(unmapped.transactions[0]?.categoryName).toBeNull();
    expect(unmapped.transactions[0]?.tagNames).toEqual([]);

    const blank = applyMapping(grid, {
      ...baseMapping,
      categoryColumn: 3,
      tagsColumn: 4,
    });
    expect(blank.transactions[1]?.categoryName).toBeNull();
    expect(blank.transactions[1]?.tagNames).toEqual([]);

    const outOfRange = applyMapping(grid, {
      ...baseMapping,
      categoryColumn: 9,
      tagsColumn: 9,
    });
    expect(outOfRange.transactions[2]?.categoryName).toBeNull();
    expect(outOfRange.transactions[2]?.tagNames).toEqual([]);
  });

  it('omits a row skipped for a bad date or a bad amount', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount', 'Category', 'Tags'],
      rows: [
        ['01/15/2026', 'Bad date', '10.00', 'Groceries', 'food'],
        ['2026-01-16', 'Bad amount', 'nope', 'Travel', 'work'],
        ['2026-01-17', 'Kept', '30.00', 'Rent', 'home'],
      ],
    };
    const { transactions, warnings } = applyMapping(grid, {
      ...baseMapping,
      dateFormat: 'dmy',
      categoryColumn: 3,
      tagsColumn: 4,
    });
    expect(transactions.map((tx) => tx.description)).toEqual(['Kept']);
    expect(transactions[0]).toMatchObject({
      date: '2026-01-17',
      categoryName: 'Rent',
      tagNames: ['home'],
    });
    expect(warnings.map((warning) => warning.row)).toEqual([0, 1]);
    expect(warnings[0]?.message).toBe('invalid date: "01/15/2026"');
  });
});
