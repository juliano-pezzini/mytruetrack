/**
 * CSV parser — converts delimited text into an {@link ImportGrid}.
 *
 * Handles quoted fields (with embedded delimiters, quotes and newlines) and
 * auto-detects the delimiter, since Brazilian/European exports commonly use ";"
 * (comma is reserved for the decimal separator).
 */

import { gridFromRows } from './grid.ts';
import type { ImportGrid } from './types.ts';

const DELIMITERS = [';', ',', '\t'] as const;
type Delimiter = (typeof DELIMITERS)[number];

/** Pick the delimiter that appears most often on the first non-empty line. */
function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  let best: Delimiter = ',';
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Parse CSV content into rows of trimmed string cells. */
function parseRows(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // handled by the following '\n'; ignore lone CR
    } else {
      field += ch;
    }
  }

  // Flush the final field/row if the file does not end with a newline.
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  return rows;
}

/** Read CSV text into an {@link ImportGrid}. */
export function readCsvGrid(text: string): ImportGrid {
  const content = text.replace(/^\uFEFF/, ''); // strip UTF-8 BOM
  if (content.trim() === '') {
    return { headers: [], rows: [] };
  }
  const delimiter = detectDelimiter(content);
  return gridFromRows(parseRows(content, delimiter));
}
