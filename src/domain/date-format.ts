/**
 * Explicit statement date formats.
 *
 * `detectDateFormat` picks a default from sample cells. `parseImportDate` reads
 * one cell in a chosen format and returns `YYYY-MM-DD`.
 */

export type DateFormat = 'dmy' | 'mdy' | 'ymd' | 'dmony' | 'mondy';

const FORMAT_ORDER: readonly DateFormat[] = ['dmy', 'mdy', 'ymd', 'dmony', 'mondy'];

const MONTH_TOKENS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  fev: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  out: 10,
  nov: 11,
  dec: 12,
  dez: 12,
};

type IsoDate = {
  readonly year: string;
  readonly monthText: string;
  readonly dayText: string;
  readonly month: number;
  readonly day: number;
};

function invalidDate(raw: string): never {
  throw new Error(`invalid date: "${raw}"`);
}

function splitDateParts(trimmed: string): readonly string[] {
  return trimmed.split(/[/.\s-]+/).map((part) => part.replace(/,/g, ''));
}

function matchIso(trimmed: string): IsoDate | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso == null) return null;
  const year = iso[1];
  const monthText = iso[2];
  const dayText = iso[3];
  if (year == null || monthText == null || dayText == null) return null;
  return {
    year,
    monthText,
    dayText,
    month: Number(monthText),
    day: Number(dayText),
  };
}

function inRange(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function isFourDigitYear(part: string): boolean {
  return /^\d{4}$/.test(part);
}

function readNumber(part: string, raw: string): number {
  if (!/^\d{1,2}$/.test(part)) invalidDate(raw);
  return Number(part);
}

function readYear(part: string, raw: string): string {
  if (!isFourDigitYear(part)) invalidDate(raw);
  return part;
}

function readMonthToken(part: string, raw: string): number {
  const month = MONTH_TOKENS[part.toLowerCase()];
  if (month == null) invalidDate(raw);
  return month;
}

function toIso(year: string, month: number, day: number): string {
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

function dayInRange(part: string): boolean {
  if (!/^\d{1,2}$/.test(part)) return false;
  const day = Number(part);
  return day >= 1 && day <= 31;
}

function voteForSample(sample: string): DateFormat | null {
  const trimmed = sample.trim();
  if (trimmed === '') return null;

  const iso = matchIso(trimmed);
  if (iso != null) {
    return inRange(iso.month, iso.day) ? 'ymd' : null;
  }

  const parts = splitDateParts(trimmed);
  if (parts.length !== 3) return null;
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  const third = parts[2] ?? '';
  if (!isFourDigitYear(third)) return null;

  if (MONTH_TOKENS[first.toLowerCase()] != null) {
    return dayInRange(second) ? 'mondy' : null;
  }
  if (MONTH_TOKENS[second.toLowerCase()] != null) {
    return dayInRange(first) ? 'dmony' : null;
  }

  if (!/^\d{1,2}$/.test(first) || !/^\d{1,2}$/.test(second)) return null;
  const lead = Number(first);
  const trail = Number(second);
  if (lead > 12 && lead <= 31 && trail >= 1 && trail <= 12) return 'dmy';
  if (trail > 12 && trail <= 31 && lead >= 1 && lead <= 12) return 'mdy';
  return null;
}

/**
 * Parse one date cell.
 *
 * An ISO `YYYY-MM-DD` prefix is accepted under every format. Otherwise the cell
 * is read in `format` order. Month must be 1–12 and day 1–31. There is no
 * calendar check, so `31/02/2026` is `2026-02-31` under day-first.
 *
 * @throws `empty date` when the cell is empty or whitespace.
 * @throws `invalid date: "<raw>"` when a non-empty cell does not match.
 */
export function parseImportDate(raw: string, format: DateFormat): string {
  const trimmed = raw.trim();
  if (trimmed === '') throw new Error('empty date');

  const iso = matchIso(trimmed);
  if (iso != null) {
    if (!inRange(iso.month, iso.day)) invalidDate(raw);
    return `${iso.year}-${iso.monthText}-${iso.dayText}`;
  }

  const parts = splitDateParts(trimmed);
  if (parts.length !== 3) invalidDate(raw);
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  const third = parts[2] ?? '';

  let year: string;
  let month: number;
  let day: number;

  switch (format) {
    case 'dmy': {
      day = readNumber(first, raw);
      month = readNumber(second, raw);
      year = readYear(third, raw);
      break;
    }
    case 'mdy': {
      month = readNumber(first, raw);
      day = readNumber(second, raw);
      year = readYear(third, raw);
      break;
    }
    case 'ymd': {
      year = readYear(first, raw);
      month = readNumber(second, raw);
      day = readNumber(third, raw);
      break;
    }
    case 'dmony': {
      day = readNumber(first, raw);
      month = readMonthToken(second, raw);
      year = readYear(third, raw);
      break;
    }
    case 'mondy': {
      month = readMonthToken(first, raw);
      day = readNumber(second, raw);
      year = readYear(third, raw);
      break;
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`unknown date format: ${String(_exhaustive)}`);
    }
  }

  if (!inRange(month, day)) invalidDate(raw);
  return toIso(year, month, day);
}

/**
 * Choose a date format from sample cells.
 * Each non-empty cell casts at most one vote. The winner is the format with
 * the most votes. Ties, and a ballot with no votes, follow `dmy`, `mdy`,
 * `ymd`, `dmony`, `mondy`.
 */
export function detectDateFormat(samples: readonly string[]): DateFormat {
  const votes: Record<DateFormat, number> = {
    dmy: 0,
    mdy: 0,
    ymd: 0,
    dmony: 0,
    mondy: 0,
  };

  for (const sample of samples) {
    const vote = voteForSample(sample);
    if (vote != null) votes[vote] += 1;
  }

  let selected: DateFormat = 'dmy';
  let best = 0;
  for (const format of FORMAT_ORDER) {
    const count = votes[format];
    if (count > best) {
      selected = format;
      best = count;
    }
  }
  return selected;
}
