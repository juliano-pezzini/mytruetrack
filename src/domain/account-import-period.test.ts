import { describe, it, expect } from 'vitest';
import { isValidAccountImportPeriod, suggestAccountImportPeriod } from './account-import-period.ts';

describe('suggestAccountImportPeriod', () => {
  it('suggests first day of current São Paulo month through today when there are no logs', () => {
    const result = suggestAccountImportPeriod([], '2026-10-13');
    expect(result).toEqual({ start: '2026-10-01', end: '2026-10-13' });
  });

  it('suggests first of month through today on a month boundary day', () => {
    const result = suggestAccountImportPeriod([], '2026-03-01');
    expect(result).toEqual({ start: '2026-03-01', end: '2026-03-01' });
  });

  it('suggests max periodEnd through today when logs exist', () => {
    const result = suggestAccountImportPeriod(
      [{ periodEnd: '2026-01-31' }, { periodEnd: '2025-12-15' }],
      '2026-02-10',
    );
    expect(result).toEqual({ start: '2026-01-31', end: '2026-02-10' });
  });

  it('keeps the greatest periodEnd after an older run (frontier does not move backward)', () => {
    const result = suggestAccountImportPeriod(
      [
        { periodEnd: '2026-01-31' },
        { periodEnd: '2025-12-31' }, // older range imported later
      ],
      '2026-02-05',
    );
    expect(result.start).toBe('2026-01-31');
    expect(result.end).toBe('2026-02-05');
  });

  it('falls back to the remaining max periodEnd after the previous max is deleted', () => {
    const remaining = [{ periodEnd: '2025-12-31' }];
    const result = suggestAccountImportPeriod(remaining, '2026-02-05');
    expect(result).toEqual({ start: '2025-12-31', end: '2026-02-05' });
  });

  it('returns current month through today again when all logs are gone', () => {
    const result = suggestAccountImportPeriod([], '2026-02-05');
    expect(result).toEqual({ start: '2026-02-01', end: '2026-02-05' });
  });
});

describe('isValidAccountImportPeriod', () => {
  it('returns false when start is after end', () => {
    expect(isValidAccountImportPeriod('2026-02-10', '2026-02-01')).toBe(false);
  });

  it('returns true when start equals end', () => {
    expect(isValidAccountImportPeriod('2026-02-01', '2026-02-01')).toBe(true);
  });

  it('returns true when start is before end', () => {
    expect(isValidAccountImportPeriod('2026-01-01', '2026-01-31')).toBe(true);
  });
});
