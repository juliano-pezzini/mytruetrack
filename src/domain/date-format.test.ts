import { describe, expect, it } from 'vitest';
import { detectDateFormat, parseImportDate, type DateFormat } from './date-format.ts';

const ALL_FORMATS: readonly DateFormat[] = ['dmy', 'mdy', 'ymd', 'dmony', 'mondy'];

const MONTH_TOKENS: readonly (readonly [string, string])[] = [
  ['jan', '01'],
  ['feb', '02'],
  ['fev', '02'],
  ['mar', '03'],
  ['apr', '04'],
  ['abr', '04'],
  ['may', '05'],
  ['mai', '05'],
  ['jun', '06'],
  ['jul', '07'],
  ['aug', '08'],
  ['ago', '08'],
  ['sep', '09'],
  ['set', '09'],
  ['oct', '10'],
  ['out', '10'],
  ['nov', '11'],
  ['dec', '12'],
  ['dez', '12'],
];

describe('parseImportDate', () => {
  it('parses 15/01/2026 as day-first and rejects 01/15/2026', () => {
    expect(parseImportDate('15/01/2026', 'dmy')).toBe('2026-01-15');
    expect(() => parseImportDate('01/15/2026', 'dmy')).toThrow(
      new Error('invalid date: "01/15/2026"'),
    );
  });

  it('parses 01/15/2026 as month-first', () => {
    expect(parseImportDate('01/15/2026', 'mdy')).toBe('2026-01-15');
  });

  it('parses an ISO date and an ISO timestamp under every format', () => {
    for (const format of ALL_FORMATS) {
      expect(parseImportDate('2026-01-15', format)).toBe('2026-01-15');
      expect(parseImportDate('2026-01-15T13:00:00', format)).toBe('2026-01-15');
    }
  });

  it('parses a year-first numeric date when the format is ymd', () => {
    expect(parseImportDate('2026/01/15', 'ymd')).toBe('2026-01-15');
  });

  it('parses Portuguese and English month tokens under dmony, in any case', () => {
    expect(parseImportDate('15/fev/2026', 'dmony')).toBe('2026-02-15');
    expect(parseImportDate('15/FEV/2026', 'dmony')).toBe('2026-02-15');
    expect(parseImportDate('15-Jan-2026', 'dmony')).toBe('2026-01-15');
    for (const [token, month] of MONTH_TOKENS) {
      expect(parseImportDate(`15/${token}/2026`, 'dmony')).toBe(`2026-${month}-15`);
      expect(parseImportDate(`15/${token.toUpperCase()}/2026`, 'dmony')).toBe(`2026-${month}-15`);
    }
  });

  it('parses Jan 15, 2026 and Jan/15/2026 as month-name first', () => {
    expect(parseImportDate('Jan 15, 2026', 'mondy')).toBe('2026-01-15');
    expect(parseImportDate('Jan/15/2026', 'mondy')).toBe('2026-01-15');
    expect(parseImportDate('JAN 15, 2026', 'mondy')).toBe('2026-01-15');
  });

  it('accepts dot and hyphen separators under day-first', () => {
    expect(parseImportDate('15.01.2026', 'dmy')).toBe('2026-01-15');
    expect(parseImportDate('15-01-2026', 'dmy')).toBe('2026-01-15');
  });

  it('rejects an unknown month, a two-digit year, a trailing time, and an out-of-range day or month', () => {
    expect(() => parseImportDate('15/Xxx/2026', 'dmony')).toThrow(
      new Error('invalid date: "15/Xxx/2026"'),
    );
    expect(() => parseImportDate('15/01/26', 'dmy')).toThrow(new Error('invalid date: "15/01/26"'));
    expect(() => parseImportDate('15/01/2026 10:30', 'dmy')).toThrow(
      new Error('invalid date: "15/01/2026 10:30"'),
    );
    expect(() => parseImportDate('15/13/2026', 'dmy')).toThrow(
      new Error('invalid date: "15/13/2026"'),
    );
    expect(() => parseImportDate('32/01/2026', 'dmy')).toThrow(
      new Error('invalid date: "32/01/2026"'),
    );
    expect(() => parseImportDate('2026-13-01', 'dmy')).toThrow(
      new Error('invalid date: "2026-13-01"'),
    );
    expect(() => parseImportDate('2026-01-32', 'ymd')).toThrow(
      new Error('invalid date: "2026-01-32"'),
    );
  });

  it('accepts 31 February without a calendar check', () => {
    expect(parseImportDate('31/02/2026', 'dmy')).toBe('2026-02-31');
  });

  it('rejects an empty or whitespace cell as an empty date', () => {
    expect(() => parseImportDate('', 'dmy')).toThrow(new Error('empty date'));
    expect(() => parseImportDate('   ', 'mdy')).toThrow(new Error('empty date'));
  });
});

describe('detectDateFormat', () => {
  it('pre-selects day-first when every sample is ambiguous', () => {
    expect(detectDateFormat(['01/02/2026'])).toBe('dmy');
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBe('dmy');
  });

  it('pre-selects day-first from 15/01/2026', () => {
    expect(detectDateFormat(['15/01/2026'])).toBe('dmy');
  });

  it('pre-selects month-first from 01/15/2026', () => {
    expect(detectDateFormat(['01/15/2026'])).toBe('mdy');
  });

  it('pre-selects year-first from an ISO date', () => {
    expect(detectDateFormat(['2026-01-15'])).toBe('ymd');
    expect(detectDateFormat(['2026-01-15T13:00:00'])).toBe('ymd');
  });

  it('pre-selects day-first month names from 15/fev/2026 and 15-Jan-2026', () => {
    expect(detectDateFormat(['15/fev/2026'])).toBe('dmony');
    expect(detectDateFormat(['15-Jan-2026'])).toBe('dmony');
  });

  it('pre-selects month-name first from Jan/15/2026 and Jan 15, 2026', () => {
    expect(detectDateFormat(['Jan/15/2026'])).toBe('mondy');
    expect(detectDateFormat(['Jan 15, 2026'])).toBe('mondy');
  });

  it('ignores ambiguous samples and keeps the only decisive vote', () => {
    expect(detectDateFormat(['01/02/2026', '01/15/2026', '03/04/2026'])).toBe('mdy');
  });

  it('picks the format with the most votes', () => {
    expect(detectDateFormat(['15/01/2026', '01/15/2026', '02/13/2026'])).toBe('mdy');
    expect(detectDateFormat(['Jan 15, 2026', 'Feb 15, 2026', '15/fev/2026'])).toBe('mondy');
  });

  it('breaks a tie by dmy, mdy, ymd, dmony, mondy', () => {
    expect(
      detectDateFormat(['15/01/2026', '01/15/2026', '2026-01-15', '15/fev/2026', 'Jan 15, 2026']),
    ).toBe('dmy');
    expect(detectDateFormat(['01/15/2026', '2026-01-15'])).toBe('mdy');
    expect(detectDateFormat(['2026-01-15', '15/fev/2026'])).toBe('ymd');
    expect(detectDateFormat(['15/fev/2026', 'Jan 15, 2026'])).toBe('dmony');
  });

  it('selects day-first when no sample votes', () => {
    expect(detectDateFormat([])).toBe('dmy');
    expect(detectDateFormat([''])).toBe('dmy');
    expect(detectDateFormat(['   '])).toBe('dmy');
    expect(detectDateFormat(['15/Xxx/2026'])).toBe('dmy');
    expect(detectDateFormat(['15/01/26'])).toBe('dmy');
    expect(detectDateFormat(['15/13/2026'])).toBe('dmy');
    expect(detectDateFormat(['32/01/2026'])).toBe('dmy');
  });
});
