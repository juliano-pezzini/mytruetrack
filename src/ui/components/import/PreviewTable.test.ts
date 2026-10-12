// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import type { ClassifiedImportRow } from '../../../domain/import-classification.ts';
import { fromCents } from '../../../domain/money.ts';
import type { MappingResult, ParsedTransaction } from '../../../workers/types.ts';
import { PreviewTable } from './PreviewTable.tsx';

function txn(description: string, type: ParsedTransaction['type']): ParsedTransaction {
  return {
    date: '2026-01-15',
    description,
    amount: fromCents(1000),
    type,
    externalId: null,
  };
}

const transactions: ParsedTransaction[] = [
  txn('Store', 'debit'),
  txn('Pay', 'credit'),
  txn('Refund', 'debit'),
  txn('Blank', 'debit'),
  txn('Fifth', 'debit'),
  txn('Sixth', 'debit'),
];

const classified: readonly ClassifiedImportRow[] = [
  {
    category: { kind: 'existing', id: 'c1', name: 'Super Market' },
    tags: [
      { kind: 'existing', id: 't1', name: 'food' },
      { kind: 'create', name: 'travel', color: '#E11D48' },
    ],
  },
  {
    category: { kind: 'create', name: 'Salary', type: 'revenue' },
    tags: [],
  },
  {
    category: { kind: 'planned', name: 'Market', type: 'expense' },
    tags: [{ kind: 'planned', name: 'work' }],
  },
  {
    category: { kind: 'none' },
    tags: [],
  },
  {
    category: { kind: 'none' },
    tags: [],
  },
  {
    category: { kind: 'create', name: 'Hidden', type: 'expense' },
    tags: [{ kind: 'create', name: 'hidden', color: '#0EA5E9' }],
  },
];

const result: MappingResult = {
  transactions,
  warnings: [{ row: 6, message: 'invalid date: "01/15/2026"' }],
};

function categoryCell(rowIndex: number): string {
  const rows = screen.getAllByRole('row').slice(1);
  return within(rows[rowIndex]!).getAllByRole('cell')[4]!.textContent ?? '';
}

function tagsCell(rowIndex: number): string {
  const rows = screen.getAllByRole('row').slice(1);
  return within(rows[rowIndex]!).getAllByRole('cell')[5]!.textContent ?? '';
}

describe('PreviewTable', () => {
  it('renders an existing category as its stored name', () => {
    render(createElement(PreviewTable, { result, classified }));
    expect(categoryCell(0)).toBe('Super Market');
  });

  it('renders a category this import will create with its type', () => {
    render(createElement(PreviewTable, { result, classified }));
    expect(categoryCell(1)).toBe('Salary (revenue)');
    expect(categoryCell(2)).toBe('Market (expense)');
  });

  it('renders tags in cell order joined by a comma', () => {
    render(createElement(PreviewTable, { result, classified }));
    expect(tagsCell(0)).toBe('food, travel');
    expect(tagsCell(2)).toBe('work');
  });

  it('renders an empty category and empty tags as blank cells', () => {
    render(createElement(PreviewTable, { result, classified }));
    expect(categoryCell(3)).toBe('');
    expect(tagsCell(3)).toBe('');
    expect(tagsCell(1)).toBe('');
  });

  it('keeps the five-row preview cap and the warning list', () => {
    render(createElement(PreviewTable, { result, classified }));
    expect(screen.queryByText('Sixth')).toBeNull();
    expect(screen.queryByText('Hidden (expense)')).toBeNull();
    expect(screen.getByText('…and 1 more')).toBeTruthy();
    expect(screen.getByText('Row 7: invalid date: "01/15/2026"')).toBeTruthy();
  });
});
