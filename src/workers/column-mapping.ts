/**
 * Fill fields that pre-feature saved mappings do not have.
 * A missing date format is day-first. Missing category and tags columns are unmapped.
 */

import type { ColumnMapping } from './types.ts';

export function normalizeColumnMapping(config: Partial<ColumnMapping>): ColumnMapping {
  return {
    dateColumn: config.dateColumn ?? 0,
    descriptionColumn: config.descriptionColumn ?? 0,
    amountStrategy: config.amountStrategy ?? 'single',
    amountColumn: config.amountColumn ?? null,
    debitColumn: config.debitColumn ?? null,
    creditColumn: config.creditColumn ?? null,
    typeColumn: config.typeColumn ?? null,
    numberFormat: config.numberFormat ?? 'us',
    dateFormat: config.dateFormat ?? 'dmy',
    categoryColumn: config.categoryColumn ?? null,
    tagsColumn: config.tagsColumn ?? null,
  };
}
