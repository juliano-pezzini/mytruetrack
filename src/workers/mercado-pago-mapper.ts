/**
 * Map Mercado Pago binnacle JSON pages to ParsedTransaction rows.
 *
 * PoC envelope: { total, pages, groups[] }. Day groups expose movements under `items`.
 * Amount: `fraction` is signed reais (`.` is a thousands separator); `cents` is the
 * unsigned centavo digits (`00`–`99`). Negative ⇒ debit.
 */

import { z } from 'zod';
import { fromCents } from '../domain/money.ts';
import type { ImportError, ParsedTransaction } from './types.ts';

const AmountSchema = z.object({
  currency_id: z.string().optional(),
  fraction: z.string().optional(),
  cents: z.string().optional(),
});

const MovementItemSchema = z.object({
  movement_id: z.string().min(1),
  datetime: z.string(),
  title: z.string(),
  amount: AmountSchema,
  description: z.string().optional(),
  metadata: z.unknown().optional(),
});

const DayGroupSchema = z
  .object({
    // Day-header chrome. The live binnacle sends right_content as an object.
    title: z.unknown().optional(),
    right_content: z.unknown().optional(),
    items: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const BinnaclePageSchema = z.object({
  total: z.number(),
  pages: z.number(),
  groups: z.array(DayGroupSchema),
});

export type MapBinnacleItemResult = ParsedTransaction | { readonly error: string };

/**
 * Convert an ISO datetime to YYYY-MM-DD in America/Sao_Paulo.
 */
function convertDateToSaoPaulo(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Compose signed centavos from the live binnacle split.
 * `fraction` is signed reais (`.` thousands separator). `cents` is unsigned
 * centavos, one or two digits. A missing `cents` is `00`. Negative ⇒ debit.
 */
function parseSignedCents(amount: z.infer<typeof AmountSchema>): number | null {
  const fractionRaw = amount.fraction?.trim() ?? '';
  const centsRaw = amount.cents?.trim() ?? '';
  if (fractionRaw === '' && centsRaw === '') return null;

  let sign = 1;
  let reaisRaw = fractionRaw;
  if (reaisRaw.startsWith('-')) {
    sign = -1;
    reaisRaw = reaisRaw.slice(1).trim();
  }

  const reaisDigits = reaisRaw.replace(/\./g, '');
  if (reaisDigits !== '' && !/^\d+$/.test(reaisDigits)) return null;
  if (centsRaw !== '' && !/^\d{1,2}$/.test(centsRaw)) return null;

  const reais = reaisDigits === '' ? 0 : Number(reaisDigits);
  const centavos = centsRaw === '' ? 0 : Number(centsRaw);
  if (!Number.isSafeInteger(reais) || !Number.isSafeInteger(centavos)) return null;

  const absolute = reais * 100 + centavos;
  if (!Number.isSafeInteger(absolute)) return null;
  return sign < 0 ? -absolute : absolute;
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid value';
  const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
  return `${path}: ${issue.message}`;
}

function valueKeys(value: unknown): string {
  if (value === null || typeof value !== 'object') return typeof value;
  return Object.keys(value).sort().join(', ');
}

export function mapBinnacleItem(item: unknown): MapBinnacleItemResult {
  const parsed = MovementItemSchema.safeParse(item);
  if (!parsed.success) {
    return {
      error: `Invalid movement item (${firstIssue(parsed.error)}; keys: ${valueKeys(item)})`,
    };
  }

  const { movement_id, datetime, title, amount } = parsed.data;

  if (amount.currency_id !== 'BRL') {
    return { error: 'currency_id must be BRL' };
  }

  const description = title.trim();
  if (description === '') {
    return { error: 'title/description is required' };
  }

  const date = convertDateToSaoPaulo(datetime);
  if (date === null) {
    return { error: 'datetime is not a valid ISO datetime' };
  }

  const signedCents = parseSignedCents(amount);
  if (signedCents === null) {
    return { error: 'amount is not a valid integer cent value' };
  }

  const absolute = Math.abs(signedCents);
  if (absolute <= 0) {
    return { error: 'amount must be positive' };
  }

  return {
    date,
    description,
    amount: fromCents(absolute),
    type: signedCents < 0 ? 'debit' : 'credit',
    externalId: movement_id,
  };
}

export function flattenBinnaclePages(pages: readonly unknown[]): {
  rows: ParsedTransaction[];
  errors: ImportError[];
} {
  const rows: ParsedTransaction[] = [];
  const errors: ImportError[] = [];
  let index = 0;

  for (const page of pages) {
    const envelope = BinnaclePageSchema.safeParse(page);
    if (!envelope.success) {
      errors.push({
        index,
        message: `Invalid binnacle page envelope (${firstIssue(envelope.error)})`,
      });
      index++;
      continue;
    }

    for (const group of envelope.data.groups) {
      for (const item of group.items ?? []) {
        const result = mapBinnacleItem(item);
        if ('error' in result) {
          errors.push({ index, message: result.error });
        } else {
          rows.push(result);
        }
        index++;
      }
    }
  }

  return { rows, errors };
}
