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
});
