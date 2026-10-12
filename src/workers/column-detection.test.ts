import { describe, it, expect } from 'vitest';
import { guessMapping } from './column-detection.ts';
import type { ImportGrid } from './types.ts';

describe('column-detection', () => {
  it('detects English headers with a single signed amount column', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['2026-01-15', 'Salary', '3000.00']],
    };
    const m = guessMapping(grid);
    expect(m.dateColumn).toBe(0);
    expect(m.descriptionColumn).toBe(1);
    expect(m.amountStrategy).toBe('single');
    expect(m.amountColumn).toBe(2);
    expect(m.numberFormat).toBe('us');
  });

  it('detects Portuguese headers and EU number format', () => {
    const grid: ImportGrid = {
      headers: ['Data', 'Descrição', 'Valor'],
      rows: [
        ['15/01/2026', 'Salário', '1.234,56'],
        ['16/01/2026', 'Mercado', '99,90'],
      ],
    };
    const m = guessMapping(grid);
    expect(m.dateColumn).toBe(0);
    expect(m.descriptionColumn).toBe(1);
    expect(m.amountStrategy).toBe('single');
    expect(m.amountColumn).toBe(2);
    expect(m.numberFormat).toBe('eu');
  });

  it('detects separate debit/credit columns', () => {
    const grid: ImportGrid = {
      headers: ['Data', 'Histórico', 'Débito', 'Crédito'],
      rows: [['15/01/2026', 'Compra', '50,00', '']],
    };
    const m = guessMapping(grid);
    expect(m.amountStrategy).toBe('separate');
    expect(m.debitColumn).toBe(2);
    expect(m.creditColumn).toBe(3);
    expect(m.amountColumn).toBeNull();
  });

  it('detects an amount + type column layout', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Value', 'Type'],
      rows: [['2026-01-15', 'Salary', '3000.00', 'credit']],
    };
    const m = guessMapping(grid);
    expect(m.amountStrategy).toBe('type_column');
    expect(m.amountColumn).toBe(2);
    expect(m.typeColumn).toBe(3);
  });

  it('falls back to positional defaults for unknown headers', () => {
    const grid: ImportGrid = {
      headers: ['A', 'B', 'C'],
      rows: [['2026-01-15', 'x', '10.00']],
    };
    const m = guessMapping(grid);
    expect(m.dateColumn).toBe(0);
    expect(m.descriptionColumn).toBe(1);
    expect(m.amountStrategy).toBe('single');
    expect(m.amountColumn).toBe(2);
  });

  it('pre-selects Categoria and Etiquetas', () => {
    const grid: ImportGrid = {
      headers: ['Data', 'Descrição', 'Valor', 'Categoria', 'Etiquetas'],
      rows: [['15/01/2026', 'Mercado', '10,00', 'Food', 'food']],
    };
    const m = guessMapping(grid);
    expect(m.categoryColumn).toBe(3);
    expect(m.tagsColumn).toBe(4);
  });

  it('uses the leftmost header that contains a category or tags keyword', () => {
    const grid: ImportGrid = {
      headers: ['Category notes', 'Categoria', 'Etiqueta', 'Tags'],
      rows: [['2026-01-15', 'Food', 'food', 'extra']],
    };
    const m = guessMapping(grid);
    expect(m.categoryColumn).toBe(0);
    expect(m.tagsColumn).toBe(2);
  });

  it('leaves category and tags unmapped when no header contains those keywords', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['2026-01-15', 'Salary', '10.00']],
    };
    const m = guessMapping(grid);
    expect(m.categoryColumn).toBeNull();
    expect(m.tagsColumn).toBeNull();
  });

  it('sets dateFormat to dmony for a 15/fev/2026 date column', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['15/fev/2026', 'Rent', '10.00']],
    };
    expect(guessMapping(grid).dateFormat).toBe('dmony');
  });

  it('sets dateFormat to dmy for an ambiguous 01/02/2026 date column', () => {
    const grid: ImportGrid = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [['01/02/2026', 'Rent', '10.00']],
    };
    expect(guessMapping(grid).dateFormat).toBe('dmy');
  });
});
