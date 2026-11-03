import { describe, expect, it } from 'vitest';
import {
  compareMonths,
  currentCalendarMonth,
  dayBeforeSpan,
  formatSpanLabel,
  inclusiveDateRange,
  monthSpanForShortcut,
  shiftYear,
} from './period-span.ts';

const NOV_2026 = { year: 2026, month: 11 } as const;

describe('monthSpanForShortcut', () => {
  it('selects November 2026 for this month on 2026-11-02', () => {
    expect(monthSpanForShortcut(NOV_2026, 'this-month')).toEqual({
      start: { year: 2026, month: 11 },
      end: { year: 2026, month: 11 },
    });
  });

  it('selects September 2026 through November 2026 for last 3 months on 2026-11-02', () => {
    expect(monthSpanForShortcut(NOV_2026, 'last-3-months')).toEqual({
      start: { year: 2026, month: 9 },
      end: { year: 2026, month: 11 },
    });
  });

  it('selects November 2025 through January 2026 for last 3 months when today is January', () => {
    expect(monthSpanForShortcut({ year: 2026, month: 1 }, 'last-3-months')).toEqual({
      start: { year: 2025, month: 11 },
      end: { year: 2026, month: 1 },
    });
  });

  it('selects January 2026 through November 2026 for this year on 2026-11-02', () => {
    expect(monthSpanForShortcut(NOV_2026, 'this-year')).toEqual({
      start: { year: 2026, month: 1 },
      end: { year: 2026, month: 11 },
    });
  });

  it('selects January through January for this year when today is January', () => {
    expect(monthSpanForShortcut({ year: 2026, month: 1 }, 'this-year')).toEqual({
      start: { year: 2026, month: 1 },
      end: { year: 2026, month: 1 },
    });
  });

  it('selects December 2025 through November 2026 for last 12 months on 2026-11-02', () => {
    expect(monthSpanForShortcut(NOV_2026, 'last-12-months')).toEqual({
      start: { year: 2025, month: 12 },
      end: { year: 2026, month: 11 },
    });
  });
});

describe('formatSpanLabel', () => {
  it('shows Nov 2026 for a single month', () => {
    expect(
      formatSpanLabel({
        start: { year: 2026, month: 11 },
        end: { year: 2026, month: 11 },
      }),
    ).toBe('Nov 2026');
  });

  it('joins a longer span with an en dash', () => {
    expect(
      formatSpanLabel({
        start: { year: 2025, month: 12 },
        end: { year: 2026, month: 11 },
      }),
    ).toBe('Dec 2025 \u2013 Nov 2026');
  });

  it('uses the en-US short month names', () => {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    for (let month = 1; month <= 12; month++) {
      expect(
        formatSpanLabel({
          start: { year: 2026, month },
          end: { year: 2026, month },
        }),
      ).toBe(`${names[month - 1]} 2026`);
    }
  });
});

describe('inclusiveDateRange', () => {
  it('runs from the first day of the start month through the last day of the end month', () => {
    expect(
      inclusiveDateRange({
        start: { year: 2024, month: 1 },
        end: { year: 2024, month: 3 },
      }),
    ).toEqual({ from: '2024-01-01', to: '2024-03-31' });
  });

  it('uses 2024-02-29 as the last day of February 2024', () => {
    expect(
      inclusiveDateRange({
        start: { year: 2024, month: 2 },
        end: { year: 2024, month: 2 },
      }),
    ).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('uses 2025-02-28 as the last day of February 2025', () => {
    expect(
      inclusiveDateRange({
        start: { year: 2025, month: 2 },
        end: { year: 2025, month: 2 },
      }),
    ).toEqual({ from: '2025-02-01', to: '2025-02-28' });
  });

  it('uses the 30th as the last day of April', () => {
    expect(
      inclusiveDateRange({
        start: { year: 2026, month: 4 },
        end: { year: 2026, month: 4 },
      }).to,
    ).toBe('2026-04-30');
  });
});

describe('dayBeforeSpan', () => {
  it('returns the last day before a November start', () => {
    expect(
      dayBeforeSpan({
        start: { year: 2026, month: 11 },
        end: { year: 2026, month: 11 },
      }),
    ).toBe('2026-10-31');
  });

  it('returns 31 December of the previous year when the span starts in January', () => {
    expect(
      dayBeforeSpan({
        start: { year: 2026, month: 1 },
        end: { year: 2026, month: 1 },
      }),
    ).toBe('2025-12-31');
  });

  it('returns 2024-02-29 when the span starts in March 2024', () => {
    expect(
      dayBeforeSpan({
        start: { year: 2024, month: 3 },
        end: { year: 2024, month: 3 },
      }),
    ).toBe('2024-02-29');
  });
});

describe('shiftYear', () => {
  it('moves the year and does not clamp it', () => {
    expect(shiftYear({ year: 2026, month: 11 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftYear({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 11 });
    expect(shiftYear({ year: 1, month: 1 }, -1)).toEqual({ year: 0, month: 1 });
  });
});

describe('compareMonths', () => {
  it('orders an earlier month before a later one and treats the same month as equal', () => {
    expect(compareMonths({ year: 2026, month: 9 }, { year: 2026, month: 11 })).toBeLessThan(0);
    expect(compareMonths({ year: 2026, month: 11 }, { year: 2026, month: 11 })).toBe(0);
    expect(compareMonths({ year: 2026, month: 11 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });
});

describe('currentCalendarMonth', () => {
  it('reads the local calendar month', () => {
    expect(currentCalendarMonth(new Date(2026, 10, 2, 23, 30))).toEqual({
      year: 2026,
      month: 11,
    });
  });
});
