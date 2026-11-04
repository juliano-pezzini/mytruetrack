/**
 * Calendar-month spans for the Transactions period filter.
 * Dates are built from year, month, and day. Callers pass "today".
 */

export type CalendarMonth = Readonly<{
  year: number;
  /** 1–12 */
  month: number;
}>;

export type MonthSpan = Readonly<{
  start: CalendarMonth;
  end: CalendarMonth;
}>;

export type PeriodShortcut = 'this-month' | 'last-3-months' | 'this-year' | 'last-12-months';

const SHORT_MONTHS = [
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
] as const;

const EN_DASH = '\u2013';

export function currentCalendarMonth(today: Date): CalendarMonth {
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export function monthSpanForShortcut(today: CalendarMonth, shortcut: PeriodShortcut): MonthSpan {
  switch (shortcut) {
    case 'this-month':
      return { start: today, end: today };
    case 'last-3-months':
      return { start: addMonths(today, -2), end: today };
    case 'this-year':
      return { start: { year: today.year, month: 1 }, end: today };
    case 'last-12-months':
      return { start: addMonths(today, -11), end: today };
    default: {
      const exhaustive: never = shortcut;
      return exhaustive;
    }
  }
}

export function inclusiveDateRange(span: MonthSpan): { from: string; to: string } {
  return {
    from: isoDate(span.start.year, span.start.month, 1),
    to: isoDate(span.end.year, span.end.month, lastDayOfMonth(span.end.year, span.end.month)),
  };
}

export function dayBeforeSpan(span: MonthSpan): string {
  const previous = addMonths(span.start, -1);
  return isoDate(previous.year, previous.month, lastDayOfMonth(previous.year, previous.month));
}

export function formatSpanLabel(span: MonthSpan): string {
  const start = formatMonth(span.start);
  if (span.start.year === span.end.year && span.start.month === span.end.month) return start;
  return `${start} ${EN_DASH} ${formatMonth(span.end)}`;
}

export function compareMonths(a: CalendarMonth, b: CalendarMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function shiftYear(month: CalendarMonth, delta: number): CalendarMonth {
  return { year: month.year + delta, month: month.month };
}

function addMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const index = month.year * 12 + (month.month - 1) + delta;
  const year = Math.floor(index / 12);
  const monthIndex = ((index % 12) + 12) % 12;
  return { year, month: monthIndex + 1 };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  const yearText = String(year).padStart(4, '0');
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${yearText}-${monthText}-${dayText}`;
}

function formatMonth(month: CalendarMonth): string {
  const name = SHORT_MONTHS[month.month - 1];
  if (name === undefined) throw new Error(`Invalid month: ${month.month}`);
  return `${name} ${month.year}`;
}
