/**
 * Shared helpers for turning a raw 2-D array of cells into an {@link ImportGrid}.
 */

import type { ImportGrid } from './types.ts';

/** True when a row has at least one non-empty cell. */
function isNonEmptyRow(row: readonly string[]): boolean {
  return row.some((cell) => cell !== '');
}

/**
 * Build an {@link ImportGrid} from raw rows: the first non-empty row becomes the
 * header and subsequent fully-empty rows are dropped.
 */
export function gridFromRows(allRows: readonly (readonly string[])[]): ImportGrid {
  let headerIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (isNonEmptyRow(allRows[i]!)) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return { headers: [], rows: [] };
  }

  const headers = allRows[headerIndex]!.map((c) => c.trim());
  const rows = allRows.slice(headerIndex + 1).filter(isNonEmptyRow);
  return { headers, rows };
}
