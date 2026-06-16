/**
 * Locale-aware decimal parsing for statement imports.
 *
 * Bank exports use different conventions for the decimal and thousands separators:
 * - US:  "1,234.56"  → thousands ",", decimal "."
 * - EU/BR: "1.234,56" → thousands ".", decimal ","
 *
 * `detectNumberFormat` infers the convention from a set of sample cell values so the
 * wizard can pick a sensible default; `parseAmount` converts a single raw cell into
 * exact integer-cent `Money` for a known format.
 */

import { fromDecimal, type Money } from './money.ts';

export type NumberFormat = 'us' | 'eu';

/** Strip currency symbols/letters and whitespace, keeping digits, separators and sign. */
function stripNoise(raw: string): string {
  return raw.replace(/[^0-9.,()+-]/g, '').trim();
}

/**
 * Analyse a single sample and vote for a format.
 * Returns 'us', 'eu', or null when the sample is ambiguous / non-numeric.
 */
function voteForSample(sample: string): NumberFormat | null {
  const cleaned = stripNoise(sample).replace(/[()+-]/g, '');
  if (cleaned === '') return null;

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  // Both separators present: the rightmost one is the decimal separator.
  if (hasDot && hasComma) {
    return cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? 'eu' : 'us';
  }

  // Only commas.
  if (hasComma) {
    const commaCount = (cleaned.match(/,/g) ?? []).length;
    if (commaCount > 1) return 'us'; // multiple commas → US thousands grouping
    const after = cleaned.slice(cleaned.lastIndexOf(',') + 1);
    if (after.length !== 3) return 'eu'; // "1234,56" / "12,5" → comma is decimal
    return null; // single comma + 3 digits (e.g. "1,234") is ambiguous
  }

  // Only dots.
  if (hasDot) {
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount > 1) return 'eu'; // multiple dots → EU thousands grouping
    const after = cleaned.slice(cleaned.lastIndexOf('.') + 1);
    if (after.length !== 3) return 'us'; // "1234.56" / "12.5" → dot is decimal
    return null; // single dot + 3 digits (e.g. "1.234") is ambiguous
  }

  return null; // no separators → no signal
}

/**
 * Infer the number format from sample cell values.
 * Defaults to 'us' when there is no clear signal.
 */
export function detectNumberFormat(samples: readonly string[]): NumberFormat {
  let us = 0;
  let eu = 0;
  for (const sample of samples) {
    const vote = voteForSample(sample);
    if (vote === 'us') us++;
    else if (vote === 'eu') eu++;
  }
  return eu > us ? 'eu' : 'us';
}

/**
 * Parse a raw cell value into `Money` (integer cents) for a known format.
 * Handles a leading/trailing sign and accounting-style parentheses for negatives.
 *
 * @throws if the value contains no parseable number.
 */
export function parseAmount(raw: string, format: NumberFormat): Money {
  const cleaned = stripNoise(raw);
  if (cleaned === '') {
    throw new Error(`Invalid amount value: "${raw}"`);
  }

  const isNegative = cleaned.includes('(') || cleaned.includes('-');

  // Reduce to digits + separators, then normalise to a plain decimal string.
  let digits = cleaned.replace(/[()+-]/g, '');
  if (format === 'eu') {
    digits = digits.replace(/\./g, '').replace(',', '.');
  } else {
    digits = digits.replace(/,/g, '');
  }

  if (digits === '' || digits === '.') {
    throw new Error(`Invalid amount value: "${raw}"`);
  }

  const money = fromDecimal(digits);
  return (isNegative ? (-money as Money) : money);
}
