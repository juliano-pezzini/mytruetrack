// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ColumnMapping } from '../../../workers/types.ts';
import { ColumnMapper } from './ColumnMapper.tsx';

const headers = ['Date', 'Description', 'Amount', 'Categoria', 'Etiquetas'];

const mapping: ColumnMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountStrategy: 'single',
  amountColumn: 2,
  debitColumn: null,
  creditColumn: null,
  typeColumn: null,
  numberFormat: 'us',
};

const DATE_FORMAT_LABELS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD/MMM/YYYY', 'MMM/DD/YYYY'];

function renderMapper(current: ColumnMapping = mapping) {
  const onChange = vi.fn();
  render(createElement(ColumnMapper, { headers, mapping: current, onChange }));
  return onChange;
}

describe('ColumnMapper', () => {
  it('lists the date formats and renders a missing dateFormat as DD/MM/YYYY', () => {
    renderMapper();

    const select = screen.getByTestId('map-date-format') as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual(DATE_FORMAT_LABELS);
    expect(select.value).toBe('dmy');
    expect(select.selectedOptions[0]?.textContent).toBe('DD/MM/YYYY');
  });

  it('calls onChange with the chosen date format', () => {
    const onChange = renderMapper();

    fireEvent.change(screen.getByTestId('map-date-format'), { target: { value: 'mondy' } });

    expect(onChange).toHaveBeenCalledWith({ ...mapping, dateFormat: 'mondy' });
  });

  it('clears the category and tags pickers', () => {
    const current: ColumnMapping = { ...mapping, categoryColumn: 3, tagsColumn: 4 };
    const onChange = renderMapper(current);

    expect(screen.getByTestId('map-category')).toBeTruthy();
    expect(screen.getByTestId('map-tags')).toBeTruthy();

    fireEvent.change(screen.getByTestId('map-category'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ ...current, categoryColumn: null });

    fireEvent.change(screen.getByTestId('map-tags'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ ...current, tagsColumn: null });
  });

  it('calls onChange when a category or tags column is chosen', () => {
    const current: ColumnMapping = { ...mapping, categoryColumn: null, tagsColumn: null };
    const onChange = renderMapper(current);

    fireEvent.change(screen.getByTestId('map-category'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ ...current, categoryColumn: 3 });

    fireEvent.change(screen.getByTestId('map-tags'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith({ ...current, tagsColumn: 4 });
  });
});
