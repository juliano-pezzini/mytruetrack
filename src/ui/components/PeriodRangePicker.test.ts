// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { PeriodRangePicker } from './PeriodRangePicker.tsx';
import type { MonthSpan } from '../../domain/period-span.ts';

const TODAY = { year: 2026, month: 11 } as const;
const NOVEMBER: MonthSpan = {
  start: { year: 2026, month: 11 },
  end: { year: 2026, month: 11 },
};

function renderPicker(span: MonthSpan = NOVEMBER) {
  const onChange = vi.fn();
  render(createElement(PeriodRangePicker, { span, today: TODAY, onChange }));
  return onChange;
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Period' }));
}

afterEach(() => {
  cleanup();
});

describe('PeriodRangePicker', () => {
  it('shows Nov 2026 on the Period button and keeps the popover closed', () => {
    renderPicker();
    const button = screen.getByRole('button', { name: 'Period' });
    expect(button.textContent).toBe('Nov 2026');
    expect(screen.queryByRole('button', { name: 'This month' })).toBeNull();
  });

  it('shows Dec 2025 – Nov 2026 when the span covers more than one month', () => {
    renderPicker({
      start: { year: 2025, month: 12 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.getByRole('button', { name: 'Period' }).textContent).toBe(
      'Dec 2025 \u2013 Nov 2026',
    );
  });

  it('opens shortcuts and month grids with no Apply control', () => {
    renderPicker();
    openPicker();
    expect(screen.getByRole('button', { name: 'This month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Last 3 months' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This year' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Last 12 months' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'From' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'To' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('applies This month and closes', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 11 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('button', { name: 'This month' })).toBeNull();
  });

  it('applies Last 3 months as September 2026 through November 2026 and closes', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Last 3 months' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 9 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('button', { name: 'Last 3 months' })).toBeNull();
  });

  it('applies This year as January 2026 through November 2026 and closes', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'This year' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 1 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('button', { name: 'This year' })).toBeNull();
  });

  it('applies Last 12 months as December 2025 through November 2026 and closes', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Last 12 months' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2025, month: 12 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('button', { name: 'Last 12 months' })).toBeNull();
  });

  it('keeps the applied span when the first month is chosen', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'From' })).getByRole('button', {
        name: 'September 2026',
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Last 3 months' })).toBeTruthy();
  });

  it('selects September 2026 through November 2026 when the end month is on or after the start', () => {
    const onChange = renderPicker();
    openPicker();
    const from = () => screen.getByRole('group', { name: 'From' });
    const to = () => screen.getByRole('group', { name: 'To' });
    fireEvent.click(within(from()).getByRole('button', { name: 'September 2026' }));
    fireEvent.click(within(to()).getByRole('button', { name: 'November 2026' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 9 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('group', { name: 'From' })).toBeNull();
  });

  it('treats an earlier end month as the new start and does not apply it', () => {
    const onChange = renderPicker();
    openPicker();
    const from = () => screen.getByRole('group', { name: 'From' });
    const to = () => screen.getByRole('group', { name: 'To' });
    fireEvent.click(within(from()).getByRole('button', { name: 'November 2026' }));
    fireEvent.click(within(to()).getByRole('button', { name: 'September 2026' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'To' })).toBeTruthy();
    fireEvent.click(within(to()).getByRole('button', { name: 'November 2026' }));
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 9 },
      end: { year: 2026, month: 11 },
    });
  });

  it('selects November 2026 when start and end are the same month', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'From' })).getByRole('button', {
        name: 'November 2026',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'To' })).getByRole('button', {
        name: 'November 2026',
      }),
    );
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 11 },
      end: { year: 2026, month: 11 },
    });
    expect(screen.queryByRole('group', { name: 'To' })).toBeNull();
  });

  it('keeps the applied span when Escape dismisses an unfinished range', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'From' })).getByRole('button', {
        name: 'September 2026',
      }),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'This month' })).toBeNull();
  });

  it('keeps the applied span when a pointerdown outside dismisses an unfinished range', () => {
    const onChange = renderPicker();
    openPicker();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'From' })).getByRole('button', {
        name: 'September 2026',
      }),
    );
    fireEvent.pointerDown(document.body);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'From' })).toBeNull();
  });

  it('steps the start year and the end year independently', () => {
    const onChange = renderPicker();
    openPicker();
    const from = screen.getByRole('group', { name: 'From' });
    const to = screen.getByRole('group', { name: 'To' });
    fireEvent.click(within(from).getByRole('button', { name: 'Previous year' }));
    fireEvent.click(within(to).getByRole('button', { name: 'Next year' }));
    expect(within(from).getByRole('button', { name: 'November 2025' })).toBeTruthy();
    expect(within(to).queryByRole('button', { name: 'November 2025' })).toBeNull();
    expect(within(to).getByRole('button', { name: 'November 2027' })).toBeTruthy();
    expect(within(from).queryByRole('button', { name: 'November 2027' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces the pending start when From is clicked again', () => {
    const onChange = renderPicker();
    openPicker();
    const from = () => screen.getByRole('group', { name: 'From' });
    const to = () => screen.getByRole('group', { name: 'To' });
    fireEvent.click(within(from()).getByRole('button', { name: 'January 2026' }));
    fireEvent.click(within(from()).getByRole('button', { name: 'March 2026' }));
    fireEvent.click(within(to()).getByRole('button', { name: 'April 2026' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      start: { year: 2026, month: 3 },
      end: { year: 2026, month: 4 },
    });
  });
});
