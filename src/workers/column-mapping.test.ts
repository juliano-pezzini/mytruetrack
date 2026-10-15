import { describe, expect, it } from 'vitest';
import { normalizeColumnMapping } from './column-mapping.ts';
import type { ColumnMapping } from './types.ts';

describe('normalizeColumnMapping', () => {
  it('fills a missing date format with dmy and missing label columns with null', () => {
    const legacy = {
      dateColumn: 0,
      descriptionColumn: 1,
      amountStrategy: 'single' as const,
      amountColumn: 2,
      debitColumn: null,
      creditColumn: null,
      typeColumn: null,
      numberFormat: 'eu' as const,
    };

    expect(normalizeColumnMapping(legacy)).toEqual({
      ...legacy,
      dateFormat: 'dmy',
      categoryColumn: null,
      tagsColumn: null,
    });
  });

  it('defaults a missing number format to us', () => {
    expect(normalizeColumnMapping({}).numberFormat).toBe('us');
    expect(normalizeColumnMapping({ numberFormat: 'eu' }).numberFormat).toBe('eu');
  });

  it('leaves mondy and existing column indexes unchanged', () => {
    const saved: ColumnMapping = {
      dateColumn: 1,
      descriptionColumn: 2,
      amountStrategy: 'separate',
      amountColumn: null,
      debitColumn: 3,
      creditColumn: 4,
      typeColumn: null,
      numberFormat: 'eu',
      dateFormat: 'mondy',
      categoryColumn: 0,
      tagsColumn: 6,
    };

    expect(normalizeColumnMapping(saved)).toEqual(saved);
  });
});
